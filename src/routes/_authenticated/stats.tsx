import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Flame, Target, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SPORTS, type SportId } from "@/lib/data";
import { useActiveCrew, useCrewMembers, useMyProfile } from "@/hooks/use-crew";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Stats — Strike & Flow" },
      { name: "description", content: "Personal records, streaks and crew leaderboard." },
    ],
  }),
  component: StatsPage,
});

interface SessionRow {
  id: string;
  session_date: string;
  sport_id: string;
}
interface AttendanceJoined {
  user_id: string;
  status: "going" | "maybe" | "out";
  session_id: string;
  sessions: SessionRow | null;
}

function startOfWeek(d: Date) {
  // Monday-based
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function StatsPage() {
  const { activeCrew } = useActiveCrew();
  const members = useCrewMembers(activeCrew?.id);
  const profile = useMyProfile();

  const since = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() - 7 * 7); // last 8 weeks incl. current
    return d;
  }, []);

  const data = useQuery({
    queryKey: ["crew-attendance", activeCrew?.id],
    enabled: !!activeCrew?.id,
    queryFn: async (): Promise<AttendanceJoined[]> => {
      const { data: sessions, error: sErr } = await supabase
        .from("sessions")
        .select("id, session_date, sport_id")
        .eq("crew_id", activeCrew!.id)
        .gte("session_date", since.toISOString().slice(0, 10));
      if (sErr) throw sErr;
      const ids = (sessions ?? []).map((s) => s.id);
      if (ids.length === 0) return [];
      const { data: att, error: aErr } = await supabase
        .from("attendance")
        .select("user_id, status, session_id")
        .in("session_id", ids)
        .eq("status", "going");
      if (aErr) throw aErr;
      const map = new Map(sessions!.map((s) => [s.id, s]));
      return (att ?? []).map((a: any) => ({
        ...a,
        sessions: map.get(a.session_id) ?? null,
      }));
    },
  });

  const myId = profile.data?.id;
  const attendance = data.data ?? [];

  // Weekly buckets
  const weekly = useMemo(() => {
    const buckets: number[] = Array(8).fill(0);
    if (!myId) return buckets;
    const baseMs = since.getTime();
    attendance
      .filter((a) => a.user_id === myId && a.sessions)
      .forEach((a) => {
        const d = new Date(a.sessions!.session_date);
        const wk = startOfWeek(d).getTime();
        const idx = Math.floor((wk - baseMs) / (7 * 24 * 60 * 60 * 1000));
        if (idx >= 0 && idx < 8) buckets[idx]++;
      });
    return buckets;
  }, [attendance, myId, since]);

  // My totals
  const mine = attendance.filter((a) => a.user_id === myId);
  const totalMine = mine.length;
  const thisWeekStart = startOfWeek(new Date()).getTime();
  const thisWeek = mine.filter(
    (a) => a.sessions && new Date(a.sessions.session_date).getTime() >= thisWeekStart,
  ).length;

  // Streak: consecutive past sessions attended
  const pastSessionDates = [...new Set(
    attendance
      .filter((a) => a.sessions && new Date(a.sessions.session_date) <= new Date())
      .map((a) => a.sessions!.session_date),
  )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  let streak = 0;
  for (const date of pastSessionDates) {
    const attended = attendance.some(
      (a) => a.user_id === myId && a.sessions?.session_date === date && a.status === "going",
    );
    if (attended) streak++;
    else break;
  }

  // Sport breakdown
  const bySport: Record<SportId, number> = { boxing: 0, cali: 0, basket: 0, volley: 0 };
  mine.forEach((a) => {
    if (a.sessions) {
      const sid = a.sessions.sport_id as SportId;
      if (sid in bySport) bySport[sid]++;
    }
  });
  const sportMax = Math.max(1, ...Object.values(bySport));

  // Leaderboard
  const tallies = new Map<string, number>();
  attendance.forEach((a) => tallies.set(a.user_id, (tallies.get(a.user_id) ?? 0) + 1));
  const leaderboard = (members.data ?? [])
    .map((m) => ({
      id: m.user_id,
      name: m.profile?.display_name ?? "Friend",
      initials: m.profile?.initials ?? "··",
      color: m.profile?.avatar_color ?? "hsl(45 90% 50%)",
      avatarUrl: m.profile?.avatar_url ?? null,
      count: tallies.get(m.user_id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const max = Math.max(1, ...weekly);

  return (
    <div className="pb-28">
      <header className="px-6 pt-10 pb-3 animate-in">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Your numbers</p>
        <h1 className="font-display text-4xl uppercase tracking-tight leading-none">Stats</h1>
      </header>
      <p className="px-6 pb-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground animate-in">
        Last 8 weeks · {activeCrew?.name ?? ""}
      </p>

      <section className="px-4 grid grid-cols-2 gap-3 mb-6 animate-in">
        <StatCard icon={<Flame className="size-4" />} label="Streak" value={String(streak)} unit="in a row" />
        <StatCard icon={<Trophy className="size-4" />} label="Sessions" value={String(totalMine)} unit="total" />
        <StatCard icon={<Target className="size-4" />} label="This week" value={String(thisWeek)} unit="going" />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Best week"
          value={String(Math.max(0, ...weekly))}
          unit="sessions"
        />
      </section>

      <section className="px-4 mb-6 animate-in">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex justify-between items-baseline mb-4">
            <p className="font-display text-lg uppercase">Last 8 weeks</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Sessions</p>
          </div>
          <div className="flex items-end gap-2 h-32">
            {weekly.map((v, i) => {
              const h = (v / max) * 100;
              const isLast = i === weekly.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${isLast ? "bg-primary" : "bg-border"}`}
                      style={{ height: `${Math.max(h, v > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">W{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 mb-6 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">By sport</h3>
        <div className="space-y-2">
          {Object.values(SPORTS).map((s) => {
            const v = bySport[s.id];
            const pct = (v / sportMax) * 100;
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

      <section className="px-6 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">Crew leaderboard</h3>
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {leaderboard.length === 0 && (
            <p className="p-4 font-mono text-[10px] uppercase text-muted-foreground text-center">
              No attendance yet — RSVP "Going" to start the count.
            </p>
          )}
          {leaderboard.map((f, i) => (
            <div
              key={f.id}
              className={`flex items-center gap-3 p-3 ${f.id === myId ? "bg-primary/5" : ""}`}
            >
              <span
                className={`font-display text-lg w-6 text-center ${i === 0 && f.count > 0 ? "text-primary" : "text-muted-foreground"}`}
              >
                {i + 1}
              </span>
              <div
                className="size-8 rounded-full grid place-items-center font-mono text-[10px] font-bold text-background"
                style={{ background: f.color }}
              >
                {f.initials}
              </div>
              <p className="flex-1 text-sm font-semibold">{f.name}</p>
              <p className="font-mono text-xs">{f.count}</p>
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
