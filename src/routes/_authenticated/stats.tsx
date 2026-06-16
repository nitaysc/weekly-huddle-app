import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Flame, Target, TrendingUp } from "lucide-react";
import { FRIENDS, SPORTS } from "@/lib/data";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Stats — Strike & Flow" },
      { name: "description", content: "Personal records, streaks and crew leaderboard." },
    ],
  }),
  component: StatsPage,
});

// Mock 8-week attendance series
const WEEKLY = [2, 3, 4, 3, 4, 4, 3, 4];

function StatsPage() {
  const max = Math.max(...WEEKLY);
  const me = FRIENDS[0];
  const leaderboard = [...FRIENDS].sort((a, b) => b.attended - a.attended);

  return (
    <div className="pb-28">
      <header className="px-6 pt-10 pb-3 animate-in">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Your numbers</p>
        <h1 className="font-display text-4xl uppercase tracking-tight leading-none">Stats</h1>
      </header>
      <p className="px-6 pb-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground animate-in">
        Preview · real attendance stats arrive in the next update
      </p>

      {/* Headline stats */}
      <section className="px-4 grid grid-cols-2 gap-3 mb-6 animate-in">
        <StatCard icon={<Flame className="size-4" />} label="Streak" value="12" unit="days" />
        <StatCard icon={<Trophy className="size-4" />} label="Sessions" value="48" unit="total" />
        <StatCard icon={<Target className="size-4" />} label="This month" value="14/22" unit="goal" />
        <StatCard icon={<TrendingUp className="size-4" />} label="Best month" value="22" unit="June" />
      </section>

      {/* Chart */}
      <section className="px-4 mb-6 animate-in">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex justify-between items-baseline mb-4">
            <p className="font-display text-lg uppercase">Last 8 weeks</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Sessions</p>
          </div>
          <div className="flex items-end gap-2 h-32">
            {WEEKLY.map((v, i) => {
              const h = (v / max) * 100;
              const isLast = i === WEEKLY.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${isLast ? "bg-primary" : "bg-border"}`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">W{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Personal records */}
      <section className="px-6 mb-6 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">Personal records</h3>
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          <Record sport="Calisthenics" metric="Max pull-ups" value="14" />
          <Record sport="Calisthenics" metric="Max push-ups" value="42" />
          <Record sport="Calisthenics" metric="Max dips" value="22" />
          <Record sport="Boxing" metric="Heavy bag rounds" value="8" />
          <Record sport="Basketball" metric="3pt streak" value="6" />
        </div>
      </section>

      {/* Sport breakdown */}
      <section className="px-6 mb-6 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">By sport</h3>
        <div className="space-y-2">
          {Object.values(SPORTS).map((s, i) => {
            const v = [16, 14, 10, 8][i];
            const pct = (v / 16) * 100;
            return (
              <div key={s.id} className="bg-surface rounded-xl border border-border p-3">
                <div className="flex justify-between items-baseline mb-2">
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{v} sessions</p>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: `var(--color-${s.colorVar})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Leaderboard */}
      <section className="px-6 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">Crew leaderboard</h3>
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {leaderboard.map((f, i) => (
            <div
              key={f.id}
              className={`flex items-center gap-3 p-3 ${f.id === me.id ? "bg-primary/5" : ""}`}
            >
              <span className={`font-display text-lg w-6 text-center ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                {i + 1}
              </span>
              <Avatar friend={f} size={32} ring="border-surface" />
              <p className="flex-1 text-sm font-semibold">{f.name}</p>
              <p className="font-mono text-xs">{f.attended}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <p className="font-mono text-[10px] uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className="font-display text-3xl leading-none">{value}</p>
      <p className="font-mono text-[10px] text-muted-foreground uppercase mt-1">{unit}</p>
    </div>
  );
}

function Record({ sport, metric, value }: { sport: string; metric: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{metric}</p>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">{sport}</p>
      </div>
      <p className="font-display text-2xl text-primary leading-none">{value}</p>
    </div>
  );
}
