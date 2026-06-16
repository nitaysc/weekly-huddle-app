import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, X, Trash2 } from "lucide-react";
import {
  SPORTS, sessionTime, startOfWeek, weekDates, rotationFor,
  DAY_NAMES_FULL, MONTH_NAMES, type SportId,
} from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { useActiveCrew, useCrewMembers } from "@/hooks/use-crew";
import {
  fetchSessionsRange, fetchAttendance, toDateKey,
  setSchedule, clearSchedule, resolvedSportFor, setSessionOverrides,
  type ScheduleSportId, type SessionOverrides, type SessionRow,
} from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plan — Strike & Flow" },
      { name: "description", content: "Weekly training calendar for your crew." },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<Date | null>(null);
  const days = weekDates(anchor);
  const rotation = rotationFor(anchor);
  const { activeCrew, crews } = useActiveCrew();
  const members = useCrewMembers(activeCrew?.id);
  const qc = useQueryClient();

  const myCrew = crews.find((c) => c.id === activeCrew?.id);
  const isOwner = myCrew?.role === "owner";

  const sessionsKey = ["sessions-range", activeCrew?.id, toDateKey(days[0]), toDateKey(days[6])] as const;
  const sessions = useQuery({
    queryKey: sessionsKey,
    enabled: !!activeCrew,
    queryFn: () => fetchSessionsRange(activeCrew!.id, days[0], days[6]),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["sessions-range", activeCrew?.id] });
    qc.invalidateQueries({ queryKey: ["session-for", activeCrew?.id] });
  };

  const setMut = useMutation({
    mutationFn: ({ date, sport }: { date: Date; sport: ScheduleSportId }) =>
      setSchedule(activeCrew!.id, date, sport),
    onSuccess: invalidateAll,
  });

  const clearMut = useMutation({
    mutationFn: (date: Date) => clearSchedule(activeCrew!.id, date),
    onSuccess: invalidateAll,
  });


  const shiftWeek = (delta: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(startOfWeek(d));
  };

  const monthLabel = `${MONTH_NAMES[days[0].getMonth()]} ${days[0].getDate()} – ${MONTH_NAMES[days[6].getMonth()]} ${days[6].getDate()}`;

  return (
    <div className="pb-28 stagger">
      <header className="px-6 pt-10 pb-5 animate-in">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
          Rotation • Week {rotation}
        </p>
        <h1 className="font-display text-4xl uppercase tracking-tight leading-none">Plan</h1>
        {isOwner && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
            Owner mode · tap <Pencil className="inline size-3 -mt-0.5" /> to change any day
          </p>
        )}
      </header>

      <div className="px-6 mb-6 flex items-center justify-between animate-in">
        <button onClick={() => shiftWeek(-1)} className="size-10 rounded-full border border-border bg-surface grid place-items-center active:scale-95 transition-transform">
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <p className="font-display text-lg uppercase leading-none">{monthLabel}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase mt-1">
            {days[0].getFullYear()}
          </p>
        </div>
        <button onClick={() => shiftWeek(1)} className="size-10 rounded-full border border-border bg-surface grid place-items-center active:scale-95 transition-transform">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="px-4 space-y-3 animate-in">
        {days.map((d) => {
          const { sportId, row } = resolvedSportFor(d, sessions.data);
          const s = sportId && sportId !== "rest" ? SPORTS[sportId as SportId] : null;
          const isToday = d.toDateString() === new Date().toDateString();
          const sessionRow = row;
          const ov = (row?.overrides ?? {}) as SessionOverrides;
          const displayName = ov.name ?? s?.name;
          const displayLocation = ov.location ?? s?.location;
          const displayDuration = ov.duration ?? s?.duration;
          const displayStart = row?.starts_at ? new Date(row.starts_at) : sessionTime(d);
          const startLabel = `${displayStart.getHours().toString().padStart(2, "0")}:${displayStart.getMinutes().toString().padStart(2, "0")}`;
          return (
            <div
              key={d.toISOString()}
              className={`rounded-2xl border bg-surface overflow-hidden relative ${
                isToday ? "border-primary" : "border-border"
              }`}
            >
              {isOwner && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(d); }}
                  className="absolute top-2 right-2 z-10 size-8 rounded-full bg-background/80 backdrop-blur border border-border grid place-items-center active:scale-95"
                  aria-label="Edit day"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              {row?.is_override && (
                <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 font-mono text-[8px] uppercase font-bold tracking-wider rounded bg-primary text-primary-foreground">
                  Custom
                </span>
              )}
              {s ? (
                <Link
                  to="/activity/$id"
                  params={{ id: s.id }}
                  search={{ date: toDateKey(d) }}
                  className="flex gap-4 p-3 active:scale-[0.99] transition-transform"
                >
                  <img
                    src={s.image}
                    alt={displayName ?? s.name}
                    loading="lazy"
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                        {DAY_NAMES_FULL[d.getDay()]} • {d.getDate()}
                      </p>
                      {isToday && (
                        <span className="font-mono text-[9px] uppercase font-bold text-primary">Today</span>
                      )}
                    </div>
                    <h3 className="font-display text-2xl uppercase leading-none mt-1">
                      {displayName}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: `var(--color-${s.colorVar})` }}
                      />
                      <p className="text-[11px] text-muted-foreground truncate">
                        {startLabel} · {displayDuration} min · {displayLocation}
                      </p>
                    </div>
                    {sessionRow ? (
                      <SessionGoing sessionId={sessionRow.id} members={members.data ?? []} />
                    ) : (
                      <p className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest mt-2">
                        No RSVPs yet
                      </p>
                    )}
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-4 p-4 opacity-70">
                  <div className="size-10 rounded-full border-2 border-dashed border-border grid place-items-center">
                    <span className="font-display text-base">{d.getDate()}</span>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                      {DAY_NAMES_FULL[d.getDay()]}
                    </p>
                    <p className="text-sm">Rest day</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


      <div className="px-6 mt-8 animate-in">
        <div className="rounded-2xl border border-dashed border-border p-4 bg-surface/40">
          <p className="font-mono text-[10px] uppercase text-muted-foreground mb-2">Rotation rules</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li><span className="text-primary">Week A:</span> Mon/Thu Boxing · Tue/Fri Calisthenics</li>
            <li><span className="text-primary">Week B:</span> Mon/Thu Basketball · Tue/Fri Volleyball</li>
            {isOwner && <li className="text-muted-foreground/70">As owner, your custom days override the rotation.</li>}
          </ul>
        </div>
      </div>

      {editing && isOwner && (() => {
        const resolved = resolvedSportFor(editing, sessions.data);
        return (
          <EditDaySheet
            date={editing}
            row={resolved.row}
            currentSport={resolved.sportId}
            onClose={() => setEditing(null)}
            onSave={async (sport, overrides) => {
              await setSessionOverrides(activeCrew!.id, editing, sport, overrides);
              invalidateAll();
              setEditing(null);
            }}
            onQuickPick={async (sport) => {
              await setMut.mutateAsync({ date: editing, sport });
              setEditing(null);
            }}
            onReset={async () => {
              await clearMut.mutateAsync(editing);
              setEditing(null);
            }}
            busy={setMut.isPending || clearMut.isPending}
          />
        );
      })()}
    </div>
  );
}

function EditDaySheet({
  date, row, currentSport, onClose, onSave, onQuickPick, onReset, busy,
}: {
  date: Date;
  row: SessionRow | null;
  currentSport: ScheduleSportId | null;
  onClose: () => void;
  onSave: (sport: ScheduleSportId, overrides: SessionOverrides) => void;
  onQuickPick: (sport: ScheduleSportId) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const [sport, setSport] = useState<ScheduleSportId>(currentSport ?? "rest");
  const [advanced, setAdvanced] = useState(false);
  const isOverride = !!row?.is_override;

  // Defaults: existing overrides → fall back to SPORTS template → empty
  const base = sport !== "rest" ? SPORTS[sport as SportId] : null;
  const ov = (row?.overrides ?? {}) as SessionOverrides;
  const [form, setForm] = useState<SessionOverrides>({
    name: ov.name ?? base?.name,
    tagline: ov.tagline ?? base?.tagline,
    location: ov.location ?? base?.location,
    duration: ov.duration ?? base?.duration,
    difficulty: ov.difficulty ?? base?.difficulty,
    equipment: ov.equipment ?? base?.equipment ?? [],
    warmup: ov.warmup ?? base?.warmup ?? [],
    workout: ov.workout ?? base?.workout ?? [],
    notes: ov.notes ?? "",
    startTime: ov.startTime ?? "18:30",
  });

  // Raw multi-line text buffers so users can press Enter to add new rows.
  // We only parse these into arrays at save time.
  const [equipmentText, setEquipmentText] = useState<string>(
    (ov.equipment ?? base?.equipment ?? []).join("\n"),
  );
  const [warmupText, setWarmupText] = useState<string>(
    (ov.warmup ?? base?.warmup ?? []).join("\n"),
  );
  const [workoutText, setWorkoutText] = useState<string>(
    (ov.workout ?? base?.workout ?? [])
      .map((w) => `${w.title} | ${w.detail}`)
      .join("\n"),
  );

  const parseList = (text: string) =>
    text.split("\n").map((s) => s.trim()).filter(Boolean);

  const parseWorkout = (text: string) =>
    text
      .split("\n")
      .map((line) => {
        const [t, ...rest] = line.split("|");
        const title = (t ?? "").trim();
        const detail = rest.join("|").trim();
        return title ? { title, detail } : null;
      })
      .filter(Boolean) as Array<{ title: string; detail: string }>;

  // When sport changes, refresh defaults from the new sport template
  const switchSport = (next: ScheduleSportId) => {
    setSport(next);
    const b = next !== "rest" ? SPORTS[next as SportId] : null;
    setForm((f) => ({
      ...f,
      name: b?.name,
      tagline: b?.tagline,
      location: b?.location,
      duration: b?.duration,
      difficulty: b?.difficulty,
    }));
    setEquipmentText((b?.equipment ?? []).join("\n"));
    setWarmupText((b?.warmup ?? []).join("\n"));
    setWorkoutText((b?.workout ?? []).map((w) => `${w.title} | ${w.detail}`).join("\n"));
  };


  const choices: Array<{ id: ScheduleSportId; label: string; color?: string }> = [
    { id: "boxing", label: "Boxing", color: "var(--color-boxing)" },
    { id: "cali", label: "Cali", color: "var(--color-cali)" },
    { id: "basket", label: "Basket", color: "var(--color-basket)" },
    { id: "volley", label: "Volley", color: "var(--color-volley)" },
    { id: "rest", label: "Rest" },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center px-0 pb-24" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[440px] bg-surface border-t border-border rounded-t-3xl flex flex-col animate-in"
        style={{ maxHeight: "calc(100dvh - 7rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Edit day</p>
            <h3 className="font-display text-2xl uppercase leading-none mt-1">
              {DAY_NAMES_FULL[date.getDay()]} {date.getDate()}
            </h3>
          </div>
          <button onClick={onClose} className="size-9 rounded-full border border-border grid place-items-center">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* Sport picker — always visible */}
          <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest mb-2">Sport</p>
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {choices.map((c) => {
              const active = sport === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => switchSport(c.id)}
                  disabled={busy}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border font-mono text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 transition ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/40"
                  }`}
                >
                  {c.color
                    ? <span className="size-2 rounded-full" style={{ background: c.color }} />
                    : <span className="size-2 rounded-full bg-muted-foreground/50" />}
                  {c.label}
                </button>
              );
            })}
          </div>

          {sport !== "rest" && (
            <>
              <button
                onClick={() => setAdvanced((v) => !v)}
                className="w-full flex items-center justify-between py-2 mb-2 text-left"
              >
                <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                  Customize details
                </span>
                <span className="font-mono text-[10px] text-primary">{advanced ? "Hide" : "Show"}</span>
              </button>

              {advanced && (
                <div className="space-y-3 mb-4">
                  <Row label="Name">
                    <input
                      className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                      value={form.name ?? ""}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </Row>
                  <Row label="Tagline">
                    <input
                      className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                      value={form.tagline ?? ""}
                      onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    />
                  </Row>
                  <div className="grid grid-cols-2 gap-3">
                    <Row label="Start time">
                      <input
                        type="time"
                        className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                        value={form.startTime ?? "18:30"}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      />
                    </Row>
                    <Row label="Duration (min)">
                      <input
                        type="number"
                        min={5}
                        className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                        value={form.duration ?? 60}
                        onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value || "0", 10) })}
                      />
                    </Row>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Row label="Level">
                      <select
                        className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                        value={form.difficulty ?? "Medium"}
                        onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </Row>
                    <Row label="Place">
                      <input
                        className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                        value={form.location ?? ""}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </Row>
                  </div>
                  <Row label="Equipment (one per line)">
                    <textarea
                      rows={4}
                      className="w-full bg-background border border-border rounded-lg p-2 text-sm font-mono"
                      value={equipmentText}
                      onChange={(e) => setEquipmentText(e.target.value)}
                    />
                  </Row>
                  <Row label="Warm-up (one per line)">
                    <textarea
                      rows={4}
                      className="w-full bg-background border border-border rounded-lg p-2 text-sm font-mono"
                      value={warmupText}
                      onChange={(e) => setWarmupText(e.target.value)}
                    />
                  </Row>
                  <Row label="Session plan (one per line: Title | Detail)">
                    <textarea
                      rows={6}
                      className="w-full bg-background border border-border rounded-lg p-2 text-sm font-mono"
                      value={workoutText}
                      onChange={(e) => setWorkoutText(e.target.value)}
                    />
                  </Row>
                  <Row label="Notes for the crew">
                    <textarea
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                      value={form.notes ?? ""}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </Row>

                </div>
              )}
            </>
          )}

          {isOverride && (
            <button
              onClick={onReset}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-muted-foreground font-mono text-[10px] uppercase tracking-wider disabled:opacity-50"
            >
              <Trash2 className="size-3.5" /> Reset to rotation default
            </button>
          )}
        </div>

        <div
          className="shrink-0 p-4 border-t border-border bg-surface flex gap-2"
          style={{ paddingBottom: "calc(1rem + max(env(safe-area-inset-bottom), 12px))" }}
        >
          {!advanced || sport === "rest" ? (
            <button
              onClick={() => onQuickPick(sport)}
              disabled={busy}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-mono text-[11px] uppercase font-bold tracking-wider disabled:opacity-50"
            >
              {sport === "rest" ? "Set as rest day" : `Set ${choices.find(c => c.id === sport)?.label}`}
            </button>
          ) : (
            <button
              onClick={() => onSave(sport, {
                ...form,
                equipment: parseList(equipmentText),
                warmup: parseList(warmupText),
                workout: parseWorkout(workoutText),
              })}
              disabled={busy}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-mono text-[11px] uppercase font-bold tracking-wider disabled:opacity-50"
            >
              Save changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function SessionGoing({
  sessionId, members,
}: {
  sessionId: string;
  members: Array<{ user_id: string; profile: { initials: string; avatar_color: string; avatar_url: string | null } }>;
}) {
  const att = useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: () => fetchAttendance(sessionId),
  });
  const going = (att.data ?? []).filter((a) => a.status === "going");
  const goingMembers = members.filter((m) => going.some((g) => g.user_id === m.user_id));
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex -space-x-1.5">
        {goingMembers.slice(0, 4).map((m) => (
          <Avatar
            key={m.user_id}
            initials={m.profile?.initials ?? "··"}
            color={m.profile?.avatar_color ?? "hsl(45 90% 50%)"}
            imageUrl={m.profile?.avatar_url ?? null}
            size={20}
            ring="border-surface"
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">
        {going.length} going
      </span>
    </div>
  );
}
