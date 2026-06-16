import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  SPORTS, sportFor, sessionTime, startOfWeek, weekDates, rotationFor,
  DAY_NAMES_FULL, MONTH_NAMES,
} from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { useActiveCrew, useCrewMembers } from "@/hooks/use-crew";
import { fetchSessionsRange, fetchAttendance, toDateKey } from "@/lib/sessions";

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
  const days = weekDates(anchor);
  const rotation = rotationFor(anchor);
  const { activeCrew } = useActiveCrew();
  const members = useCrewMembers(activeCrew?.id);

  const sessions = useQuery({
    queryKey: ["sessions-range", activeCrew?.id, toDateKey(days[0]), toDateKey(days[6])],
    enabled: !!activeCrew,
    queryFn: () => fetchSessionsRange(activeCrew!.id, days[0], days[6]),
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
          const sId = sportFor(d);
          const s = sId ? SPORTS[sId] : null;
          const isToday = d.toDateString() === new Date().toDateString();
          const sessionRow = sessions.data?.find((r) => r.session_date === toDateKey(d));
          return (
            <div
              key={d.toISOString()}
              className={`rounded-2xl border bg-surface overflow-hidden ${
                isToday ? "border-primary" : "border-border"
              }`}
            >
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
                <div className="flex items-center gap-4 p-4 opacity-60">
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
          </ul>
        </div>
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
