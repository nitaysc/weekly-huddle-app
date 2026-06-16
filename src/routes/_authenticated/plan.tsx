import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, X, Trash2 } from "lucide-react";
import {
  SPORTS, sessionTime, startOfWeek, weekDates, rotationFor,
  DAY_NAMES_FULL, MONTH_NAMES, type SportId,
} from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { useActiveCrew, useCrewMembers, useMyProfile } from "@/hooks/use-crew";
import {
  fetchSessionsRange, fetchAttendance, toDateKey,
  setSchedule, clearSchedule, resolvedSportFor,
  type ScheduleSportId,
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
  const profile = useMyProfile();
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

  const setMut = useMutation({
    mutationFn: ({ date, sport }: { date: Date; sport: ScheduleSportId }) =>
      setSchedule(activeCrew!.id, date, sport),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKey }),
  });

  const clearMut = useMutation({
    mutationFn: (date: Date) => clearSchedule(activeCrew!.id, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKey }),
  });

  const shiftWeek = (delta: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(startOfWeek(d));
  };

  const monthLabel = `${MONTH_NAMES[days[0].getMonth()]} ${days[0].getDate()} – ${MONTH_NAMES[days[6].getMonth()]} ${days[6].getDate()}`;

  return (
    <div className="pb-28">
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
                  className="flex gap-4 p-3 active:scale-[0.99] transition-transform"
                >
                  <img
                    src={s.image}
                    alt={s.name}
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
                      {s.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: `var(--color-${s.colorVar})` }}
                      />
                      <p className="text-[11px] text-muted-foreground truncate">
                        {sessionTime(d).getHours().toString().padStart(2, "0")}:30 · {s.duration} min · {s.location}
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

      {editing && isOwner && (
        <EditDaySheet
          date={editing}
          currentSport={resolvedSportFor(editing, sessions.data).sportId}
          isOverride={!!resolvedSportFor(editing, sessions.data).row?.is_override}
          onClose={() => setEditing(null)}
          onPick={async (sport) => {
            await setMut.mutateAsync({ date: editing, sport });
            setEditing(null);
          }}
          onReset={async () => {
            await clearMut.mutateAsync(editing);
            setEditing(null);
          }}
          busy={setMut.isPending || clearMut.isPending}
        />
      )}
    </div>
  );
}

function EditDaySheet({
  date, currentSport, isOverride, onClose, onPick, onReset, busy,
}: {
  date: Date;
  currentSport: ScheduleSportId | null;
  isOverride: boolean;
  onClose: () => void;
  onPick: (sport: ScheduleSportId) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const choices: Array<{ id: ScheduleSportId; label: string; color?: string }> = [
    { id: "boxing", label: "Boxing", color: "var(--color-boxing)" },
    { id: "cali", label: "Calisthenics", color: "var(--color-cali)" },
    { id: "basket", label: "Basketball", color: "var(--color-basket)" },
    { id: "volley", label: "Volleyball", color: "var(--color-volley)" },
    { id: "rest", label: "Rest day" },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[440px] mx-auto bg-surface border-t border-border rounded-t-3xl p-5 pb-8 animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
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
        <div className="grid grid-cols-2 gap-2 mt-5">
          {choices.map((c) => {
            const active = currentSport === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                disabled={busy}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left font-mono text-[11px] uppercase font-bold tracking-wider disabled:opacity-50 transition ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/40"
                }`}
              >
                {c.color && (
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                )}
                {c.label}
              </button>
            );
          })}
        </div>
        {isOverride && (
          <button
            onClick={onReset}
            disabled={busy}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted-foreground font-mono text-[11px] uppercase tracking-wider disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Reset to rotation default
          </button>
        )}
      </div>
    </div>
  );
}

function SessionGoing({
  sessionId, members,
}: {
  sessionId: string;
  members: Array<{ user_id: string; profile: { initials: string; avatar_color: string } }>;
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
