import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, X, Trash2, Upload, Bookmark, BookmarkPlus } from "lucide-react";
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
import {
  fetchPlanTemplates, savePlanTemplate, deletePlanTemplate, uploadPlanImage,
  type PlanTemplate,
} from "@/lib/plan-templates";

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
          const isCustom = sportId === "custom";
          const s = sportId && sportId !== "rest" && !isCustom ? SPORTS[sportId as SportId] : null;
          const hasContent = !!s || isCustom;
          const isToday = d.toDateString() === new Date().toDateString();
          const sessionRow = row;
          const ov = (row?.overrides ?? {}) as SessionOverrides;
          const displayName = ov.name ?? s?.name ?? "Custom session";
          const displayLocation = ov.location ?? s?.location ?? "";
          const displayDuration = ov.duration ?? s?.duration ?? 60;
          const displayImage = isCustom ? (ov.image ?? "") : (s?.image ?? "");
          const displayColorVar = isCustom ? (ov.colorVar ?? "primary") : (s?.colorVar ?? "primary");
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
                  {isCustom ? "Custom plan" : "Custom"}
                </span>
              )}
              {hasContent ? (
                <Link
                  to="/activity/$id"
                  params={{ id: isCustom ? "custom" : (s!.id as string) }}
                  search={{ date: toDateKey(d) }}
                  className="flex gap-4 p-3 active:scale-[0.99] transition-transform"
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={displayName}
                      loading="lazy"
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-xl shrink-0 grid place-items-center font-display text-xl uppercase"
                      style={{ background: `color-mix(in srgb, var(--color-${displayColorVar}) 25%, var(--color-surface))` }}
                    >
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
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
                        style={{ background: `var(--color-${displayColorVar})` }}
                      />
                      <p className="text-[11px] text-muted-foreground truncate">
                        {startLabel} · {displayDuration} min{displayLocation ? ` · ${displayLocation}` : ""}
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

      {editing && isOwner && activeCrew && (() => {
        const resolved = resolvedSportFor(editing, sessions.data);
        return (
          <EditDaySheet
            date={editing}
            row={resolved.row}
            currentSport={resolved.sportId}
            crewId={activeCrew.id}
            onClose={() => setEditing(null)}
            onSave={async (sport, overrides) => {
              await setSessionOverrides(activeCrew.id, editing, sport, overrides);
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
  date, row, currentSport, crewId, onClose, onSave, onQuickPick, onReset, busy,
}: {
  date: Date;
  row: SessionRow | null;
  currentSport: ScheduleSportId | null;
  crewId: string;
  onClose: () => void;
  onSave: (sport: ScheduleSportId, overrides: SessionOverrides) => void;
  onQuickPick: (sport: ScheduleSportId) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const qc = useQueryClient();
  const [sport, setSport] = useState<ScheduleSportId>(currentSport ?? "rest");
  const [advanced, setAdvanced] = useState<boolean>(currentSport === "custom");
  const isOverride = !!row?.is_override;

  const base = sport !== "rest" && sport !== "custom" ? SPORTS[sport as SportId] : null;
  const ov = (row?.overrides ?? {}) as SessionOverrides;
  const [form, setForm] = useState<SessionOverrides>({
    name: ov.name ?? base?.name,
    tagline: ov.tagline ?? base?.tagline,
    location: ov.location ?? base?.location,
    duration: ov.duration ?? base?.duration ?? 60,
    difficulty: ov.difficulty ?? base?.difficulty ?? "Medium",
    equipment: ov.equipment ?? base?.equipment ?? [],
    warmup: ov.warmup ?? base?.warmup ?? [],
    workout: ov.workout ?? base?.workout ?? [],
    notes: ov.notes ?? "",
    startTime: ov.startTime ?? "18:30",
    image: ov.image ?? "",
    colorVar: ov.colorVar ?? "boxing",
    description: ov.description ?? "",
  });

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

  const [uploading, setUploading] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const templatesQ = useQuery({
    queryKey: ["plan-templates", crewId],
    queryFn: () => fetchPlanTemplates(crewId),
  });

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

  const switchSport = (next: ScheduleSportId) => {
    setSport(next);
    if (next === "custom") {
      setAdvanced(true);
      // Keep current form unless empty: seed with empty values
      setForm((f) => ({
        ...f,
        name: f.name && f.name !== base?.name ? f.name : "",
        tagline: f.tagline && f.tagline !== base?.tagline ? f.tagline : "",
        location: f.location && f.location !== base?.location ? f.location : "",
        image: f.image ?? "",
        colorVar: f.colorVar ?? "boxing",
        description: f.description ?? "",
      }));
      return;
    }
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

  const applyTemplate = (t: PlanTemplate) => {
    setSport("custom");
    setAdvanced(true);
    setShowTemplates(false);
    setForm({
      name: t.name,
      tagline: t.tagline ?? "",
      location: t.location ?? "",
      duration: t.duration,
      difficulty: t.difficulty,
      equipment: t.equipment,
      warmup: t.warmup,
      workout: t.workout,
      notes: "",
      startTime: t.start_time,
      image: t.image_url ?? "",
      colorVar: t.color_var,
      description: t.notes ?? "",
    });
    setEquipmentText(t.equipment.join("\n"));
    setWarmupText(t.warmup.join("\n"));
    setWorkoutText(t.workout.map((w) => `${w.title} | ${w.detail}`).join("\n"));
  };

  const handleImage = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadPlanImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (e) {
      console.error(e);
      alert("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const buildOverrides = (): SessionOverrides => ({
    ...form,
    equipment: parseList(equipmentText),
    warmup: parseList(warmupText),
    workout: parseWorkout(workoutText),
  });

  const handleSaveTemplate = async () => {
    if (!form.name?.trim()) {
      alert("Give your plan a name first");
      return;
    }
    setSavingTemplate(true);
    try {
      await savePlanTemplate({
        crew_id: crewId,
        name: form.name.trim(),
        tagline: form.tagline ?? null,
        image_url: form.image ?? null,
        location: form.location ?? null,
        duration: form.duration ?? 60,
        difficulty: (form.difficulty ?? "Medium") as "Easy" | "Medium" | "Hard",
        equipment: parseList(equipmentText),
        warmup: parseList(warmupText),
        workout: parseWorkout(workoutText),
        notes: form.description ?? null,
        color_var: form.colorVar ?? "boxing",
        start_time: form.startTime ?? "18:30",
      });
      qc.invalidateQueries({ queryKey: ["plan-templates", crewId] });
    } catch (e) {
      console.error(e);
      alert("Could not save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this saved plan?")) return;
    await deletePlanTemplate(id);
    qc.invalidateQueries({ queryKey: ["plan-templates", crewId] });
  };

  const choices: Array<{ id: ScheduleSportId; label: string; color?: string }> = [
    { id: "boxing", label: "Box", color: "var(--color-boxing)" },
    { id: "cali", label: "Cali", color: "var(--color-cali)" },
    { id: "basket", label: "Ball", color: "var(--color-basket)" },
    { id: "volley", label: "Volley", color: "var(--color-volley)" },
    { id: "custom", label: "Custom", color: "var(--color-primary)" },
    { id: "rest", label: "Rest" },
  ];

  const colorChoices = ["boxing", "cali", "basket", "volley"];
  const templates = templatesQ.data ?? [];

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
          {/* Sport picker */}
          <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest mb-2">Sport</p>
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {choices.map((c) => {
              const active = sport === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => switchSport(c.id)}
                  disabled={busy}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border font-mono text-[9px] uppercase font-bold tracking-wider disabled:opacity-50 transition ${
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

          {/* Saved plans (templates) */}
          {sport !== "rest" && (
            <div className="mb-4">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                  <Bookmark className="size-3" /> Saved plans ({templates.length})
                </span>
                <span className="font-mono text-[10px] text-primary">{showTemplates ? "Hide" : "Show"}</span>
              </button>
              {showTemplates && (
                <div className="space-y-1.5 mt-2">
                  {templates.length === 0 && (
                    <p className="font-mono text-[10px] text-muted-foreground/70 px-1 py-2">
                      No saved plans yet. Build one below and tap "Save as plan".
                    </p>
                  )}
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background/40">
                      {t.image_url ? (
                        <img src={t.image_url} alt={t.name} className="size-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="size-10 rounded-lg shrink-0" style={{ background: `var(--color-${t.color_var})` }} />
                      )}
                      <button
                        onClick={() => applyTemplate(t)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.tagline && (
                          <p className="text-[10px] text-muted-foreground truncate">{t.tagline}</p>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="size-8 rounded-lg border border-border grid place-items-center text-muted-foreground"
                        aria-label="Delete plan"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sport !== "rest" && sport !== "custom" && (
            <button
              onClick={() => setAdvanced((v) => !v)}
              className="w-full flex items-center justify-between py-2 mb-2 text-left"
            >
              <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                Customize details
              </span>
              <span className="font-mono text-[10px] text-primary">{advanced ? "Hide" : "Show"}</span>
            </button>
          )}

          {sport !== "rest" && (advanced || sport === "custom") && (
            <div className="space-y-3 mb-4">
              {sport === "custom" && (
                <>
                  <Row label="Cover image">
                    <div className="flex items-center gap-3">
                      {form.image ? (
                        <img src={form.image} alt="" className="size-16 rounded-xl object-cover border border-border" />
                      ) : (
                        <div
                          className="size-16 rounded-xl border border-dashed border-border grid place-items-center"
                          style={{ background: `color-mix(in srgb, var(--color-${form.colorVar ?? "boxing"}) 20%, transparent)` }}
                        >
                          <Upload className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImage(f);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="px-3 py-2 rounded-lg border border-border font-mono text-[10px] uppercase tracking-wider disabled:opacity-50"
                      >
                        {uploading ? "Uploading…" : form.image ? "Change" : "Upload"}
                      </button>
                      {form.image && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, image: "" })}
                          className="size-9 rounded-lg border border-border grid place-items-center text-muted-foreground"
                          aria-label="Remove image"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </Row>
                  <Row label="Accent color">
                    <div className="flex gap-2">
                      {colorChoices.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, colorVar: c })}
                          className={`size-8 rounded-full border-2 transition ${
                            form.colorVar === c ? "border-foreground" : "border-transparent"
                          }`}
                          style={{ background: `var(--color-${c})` }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </Row>
                </>
              )}
              <Row label="Name">
                <input
                  className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                  placeholder={sport === "custom" ? "e.g. Yoga flow" : ""}
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Row>
              <Row label={sport === "custom" ? "Bio / tagline" : "Tagline"}>
                <input
                  className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                  placeholder={sport === "custom" ? "Short pitch for the crew" : ""}
                  value={form.tagline ?? ""}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </Row>
              {sport === "custom" && (
                <Row label="Description">
                  <textarea
                    rows={3}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                    placeholder="What is this session about?"
                    value={form.description ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Row>
              )}
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
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg p-2 text-sm font-mono"
                  value={equipmentText}
                  onChange={(e) => setEquipmentText(e.target.value)}
                />
              </Row>
              <Row label="Warm-up (one per line)">
                <textarea
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg p-2 text-sm font-mono"
                  value={warmupText}
                  onChange={(e) => setWarmupText(e.target.value)}
                />
              </Row>
              <Row label="Session plan (one per line: Title | Detail)">
                <textarea
                  rows={5}
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

              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/40 bg-primary/5 text-primary font-mono text-[10px] uppercase tracking-wider disabled:opacity-50"
              >
                <BookmarkPlus className="size-3.5" />
                {savingTemplate ? "Saving plan…" : "Save as plan for later"}
              </button>
            </div>
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
          {sport === "rest" ? (
            <button
              onClick={() => onQuickPick("rest")}
              disabled={busy}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-mono text-[11px] uppercase font-bold tracking-wider disabled:opacity-50"
            >
              Set as rest day
            </button>
          ) : sport === "custom" || advanced ? (
            <button
              onClick={() => onSave(sport, buildOverrides())}
              disabled={busy || (sport === "custom" && !form.name?.trim())}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-mono text-[11px] uppercase font-bold tracking-wider disabled:opacity-50"
            >
              Save changes
            </button>
          ) : (
            <button
              onClick={() => onQuickPick(sport)}
              disabled={busy}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-mono text-[11px] uppercase font-bold tracking-wider disabled:opacity-50"
            >
              {`Set ${choices.find(c => c.id === sport)?.label}`}
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
