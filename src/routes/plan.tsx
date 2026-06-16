import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  SPORTS, sportFor, sessionTime, startOfWeek, weekDates, rotationFor,
  DAY_NAMES, DAY_NAMES_FULL, MONTH_NAMES, FRIENDS,
} from "@/lib/data";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/plan")({
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

      {/* Week paginator */}
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
                    <div className="flex -space-x-1.5 mt-2">
                      {FRIENDS.filter((f) => f.status === "going").slice(0, 4).map((f) => (
                        <Avatar key={f.id} friend={f} size={20} ring="border-surface" />
                      ))}
                    </div>
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
