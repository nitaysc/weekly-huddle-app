import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, Clock, Flame } from "lucide-react";
import {
  SPORTS, FRIENDS, QUOTES,
  nextSession, rotationFor, weekDates, sportFor, sessionTime,
  DAY_NAMES, MONTH_NAMES,
} from "@/lib/data";
import { Countdown } from "@/components/Countdown";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Strike & Flow" },
      { name: "description", content: "Your crew's training today: countdown, attendance and details." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const now = new Date();
  const next = nextSession(now);
  const rotation = rotationFor(now);
  const week = weekDates(now);
  const goingFriends = FRIENDS.filter((f) => f.status === "going");
  const quote = QUOTES[now.getDate() % QUOTES.length];

  if (!next) return null;
  const { date: sessionStart, sport } = next;
  const isToday = sessionStart.toDateString() === now.toDateString();

  return (
    <div className="pb-28 selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="px-6 pt-10 pb-5 flex justify-between items-end animate-in">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
            Rotation • Week {rotation}
          </p>
          <h1 className="font-display text-4xl uppercase tracking-tight leading-none">
            Strike &amp; Flow
          </h1>
        </div>
        <Link to="/crew" className="size-10 shrink-0 rounded-full border border-border bg-surface grid place-items-center font-mono text-xs text-primary">
          YO
        </Link>
      </header>

      {/* Hero session card */}
      <section className="px-4 mb-8">
        <Link
          to="/activity/$id"
          params={{ id: sport.id }}
          className="hero-sheen block relative bg-surface rounded-3xl overflow-hidden border border-border transition-transform duration-200 active:scale-[0.98] animate-in"
        >
          <img
            src={sport.image}
            alt={sport.name}
            width={800}
            height={1000}
            className="w-full aspect-[4/5] object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <span className="px-2.5 py-1 bg-primary text-primary-foreground font-mono text-[10px] font-bold rounded uppercase">
              {isToday ? "Today" : DAY_NAMES[sessionStart.getDay()]} • {sessionStart.getHours().toString().padStart(2,"0")}:{sessionStart.getMinutes().toString().padStart(2,"0")}
            </span>
            <span className="px-2 py-1 bg-background/70 backdrop-blur text-foreground font-mono text-[10px] font-bold rounded uppercase border border-border">
              {sport.difficulty}
            </span>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-6">
            <div className="flex justify-between items-end mb-5">
              <div className="min-w-0">
                <h2 className="font-display text-5xl uppercase leading-[0.9] tracking-tight">
                  {sport.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 truncate">{sport.tagline}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">Starts in</p>
                <p className="font-display text-2xl text-primary tabular-nums">
                  <Countdown target={sessionStart} />
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {goingFriends.slice(0, 4).map((f) => (
                    <Avatar key={f.id} friend={f} ring="border-background" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-semibold">{goingFriends.length}</span> going
                </p>
              </div>
              <ChevronRight className="size-5 text-primary" />
            </div>
          </div>
        </Link>
      </section>

      {/* Week strip */}
      <section className="mb-8 animate-in">
        <div className="px-6 flex justify-between items-center mb-3">
          <h3 className="font-display text-xl uppercase">This Week</h3>
          <Link to="/plan" className="font-mono text-[10px] text-primary uppercase">
            View all →
          </Link>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-2 px-6 no-scrollbar">
          {week.map((d) => {
            const sId = sportFor(d);
            const s = sId ? SPORTS[sId] : null;
            const isCurrent = d.toDateString() === now.toDateString();
            return (
              <div
                key={d.toISOString()}
                className={`flex-none w-16 h-24 rounded-2xl border flex flex-col items-center justify-center transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface"
                }`}
              >
                <span className={`font-mono text-[10px] uppercase ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                  {DAY_NAMES[d.getDay()]}
                </span>
                <span className="font-display text-2xl leading-none mt-1">{d.getDate()}</span>
                {s ? (
                  <span
                    className="mt-2 text-[9px] font-mono font-semibold uppercase tracking-tight px-1.5 rounded"
                    style={{ background: `var(--color-${s.colorVar})`, color: "hsl(220 15% 5%)" }}
                  >
                    {s.shortName}
                  </span>
                ) : (
                  <span className="mt-2 size-1 rounded-full bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick stats */}
      <section className="px-6 mb-8 animate-in">
        <div className="bg-surface rounded-2xl p-5 border border-border">
          <div className="grid grid-cols-2 gap-4">
            <div className="border-r border-border pr-4">
              <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Your Streak</p>
              <p className="font-display text-3xl flex items-center gap-1.5">
                12
                <Flame className="size-5 text-primary" />
              </p>
            </div>
            <div className="pl-1">
              <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">
                {MONTH_NAMES[now.getMonth()]} target
              </p>
              <div className="h-2 bg-background rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "65%" }} />
              </div>
              <p className="text-[10px] font-mono mt-1 text-right text-muted-foreground">14 / 22</p>
            </div>
          </div>
        </div>
      </section>

      {/* Who's coming */}
      <section className="px-6 mb-8 animate-in">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="font-display text-xl uppercase">Who's coming</h3>
          <Link to="/crew" className="font-mono text-[10px] text-primary uppercase">All crew →</Link>
        </div>
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {FRIENDS.slice(0, 4).map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              <Avatar friend={f} ring="border-surface" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{f.streak} day streak</p>
              </div>
              <StatusPill status={f.status} />
            </div>
          ))}
        </div>
      </section>

      {/* Activity preview */}
      <section className="px-6 mb-8 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">Session brief</h3>
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{sport.description}</p>
          <div className="grid grid-cols-2 gap-3">
            <Meta icon={<Clock className="size-3.5" />} label="Duration" value={`${sport.duration} min`} />
            <Meta icon={<MapPin className="size-3.5" />} label="Location" value={sport.location} />
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="px-6 animate-in">
        <div className="border-l-2 border-primary pl-4 py-1">
          <p className="font-mono text-[10px] uppercase text-primary mb-1">Daily fuel</p>
          <p className="text-sm italic text-muted-foreground leading-snug">"{quote}"</p>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: "going" | "maybe" | "out" | "unknown" }) {
  const map = {
    going: { label: "Going", color: "text-going border-going/40 bg-going/10" },
    maybe: { label: "Maybe", color: "text-maybe border-maybe/40 bg-maybe/10" },
    out: { label: "Out", color: "text-out border-out/40 bg-out/10" },
    unknown: { label: "—", color: "text-muted-foreground border-border bg-transparent" },
  } as const;
  const { label, color } = map[status];
  return (
    <span className={`font-mono text-[10px] uppercase font-bold px-2 py-1 rounded border ${color}`}>
      {label}
    </span>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-background/50 rounded-xl border border-border p-3">
      <p className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground mb-1">
        {icon} {label}
      </p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}
