import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ChevronRight, MapPin, Clock, Flame, LogOut } from "lucide-react";
import {
  SPORTS, QUOTES,
  rotationFor, weekDates,
  DAY_NAMES, MONTH_NAMES,
} from "@/lib/data";
import { Countdown } from "@/components/Countdown";
import { Avatar } from "@/components/Avatar";
import {
  useActiveCrew, useCrewMembers, useMyProfile, useSignOut,
} from "@/hooks/use-crew";
import {
  ensureSession, fetchAttendance, fetchSessionsRange,
  effectiveSessionFor, nextResolvedSession,
  setMyAttendance, toDateKey,
} from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Today — Strike & Flow" },
      { name: "description", content: "Your crew's training today: countdown, attendance and details." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCrew, crews, isLoading: crewsLoading } = useActiveCrew();
  const profile = useMyProfile();
  const signOut = useSignOut();

  useEffect(() => {
    if (!crewsLoading && crews.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [crewsLoading, crews.length, navigate]);

  const now = new Date();
  const rotation = rotationFor(now);
  const week = weekDates(now);
  const quote = QUOTES[now.getDate() % QUOTES.length];

  const members = useCrewMembers(activeCrew?.id);

  // Load overrides for the next ~3 weeks so the home card reflects owner edits.
  const rangeStart = week[0];
  const rangeEnd = new Date(now);
  rangeEnd.setDate(now.getDate() + 21);
  const sessionsRangeQ = useQuery({
    queryKey: ["sessions-range", activeCrew?.id, toDateKey(rangeStart), toDateKey(rangeEnd)],
    enabled: !!activeCrew,
    queryFn: () => fetchSessionsRange(activeCrew!.id, rangeStart, rangeEnd),
  });

  const next = nextResolvedSession(now, sessionsRangeQ.data);

  // ensure today/next session exists for the crew and load attendance
  const sessionQ = useQuery({
    queryKey: ["session-for", activeCrew?.id, next ? toDateKey(next.date) : null],
    enabled: !!activeCrew && !!next,
    queryFn: () => ensureSession(activeCrew!.id, next!.date),
  });

  const attendanceQ = useQuery({
    queryKey: ["attendance", sessionQ.data?.id],
    enabled: !!sessionQ.data?.id,
    queryFn: () => fetchAttendance(sessionQ.data!.id),
  });

  const rsvp = useMutation({
    mutationFn: async (status: "going" | "maybe" | "out") => {
      if (!sessionQ.data) return;
      await setMyAttendance(sessionQ.data.id, status);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionQ.data?.id] }),
  });

  if (!next || !activeCrew) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground font-mono text-xs uppercase">
        Loading…
      </div>
    );
  }

  const sessionStart = next.start;
  const isToday = sessionStart.toDateString() === now.toDateString();

  const attendance = attendanceQ.data ?? [];
  const myAttendance = attendance.find((a) => a.user_id === profile.data?.id);
  const statusMap = new Map(attendance.map((a) => [a.user_id, a.status]));
  const allMembers = members.data ?? [];
  const goingMembers = allMembers.filter((m) => statusMap.get(m.user_id) === "going");
  const maybeMembers = allMembers.filter((m) => statusMap.get(m.user_id) === "maybe");
  const outMembers = allMembers.filter((m) => statusMap.get(m.user_id) === "out");


  return (
    <div className="pb-28 selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="px-6 pt-10 pb-5 flex justify-between items-end animate-in">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1 truncate">
            {activeCrew.name} • Week {rotation}
          </p>
          <h1 className="font-display text-4xl uppercase tracking-tight leading-none">
            Strike &amp; Flow
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={signOut}
            className="size-10 rounded-full border border-border bg-surface grid place-items-center text-muted-foreground active:scale-95 transition"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
          <Link
            to="/crew"
            className="size-10 rounded-full border border-border bg-surface grid place-items-center font-mono text-xs text-primary"
          >
            {profile.data?.initials ?? "··"}
          </Link>
        </div>
      </header>

      {/* Hero session card */}
      <section className="px-4 mb-8">
        <Link
          to="/activity/$id"
          params={{ id: next.sportId }}
          search={{ date: toDateKey(next.date) }}
          className="hero-sheen block relative bg-surface rounded-3xl overflow-hidden border border-border transition-transform duration-200 active:scale-[0.98] animate-in"
        >
          <img
            src={next.image}
            alt={next.name}
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
              {next.difficulty}
            </span>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-6">
            <div className="flex justify-between items-end mb-5">
              <div className="min-w-0">
                <h2 className="font-display text-5xl uppercase leading-[0.9] tracking-tight">
                  {next.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 truncate">{next.tagline}</p>
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
                  {goingMembers.slice(0, 4).map((m) => (
                    <Avatar
                      key={m.user_id}
                      initials={m.profile?.initials ?? "··"}
                      color={m.profile?.avatar_color ?? "hsl(45 90% 50%)"}
                      imageUrl={m.profile?.avatar_url ?? null}
                      ring="border-background"
                    />
                  ))}
                  {goingMembers.length === 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      No RSVPs yet
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-semibold">{goingMembers.length}</span> going
                </p>
              </div>
              <ChevronRight className="size-5 text-primary" />
            </div>
          </div>
        </Link>
      </section>

      {/* RSVP shortcut */}
      <section className="px-6 mb-8 animate-in">
        <p className="font-mono text-[10px] uppercase text-muted-foreground mb-2">Your RSVP</p>
        <div className="grid grid-cols-3 gap-2">
          {(["going", "maybe", "out"] as const).map((s) => {
            const active = myAttendance?.status === s;
            const color =
              s === "going" ? "going" : s === "maybe" ? "maybe" : "out";
            return (
              <button
                key={s}
                onClick={() => rsvp.mutate(s)}
                disabled={rsvp.isPending || !sessionQ.data}
                className={`py-3 rounded-xl border font-mono text-[11px] uppercase font-bold tracking-wider transition disabled:opacity-50 ${
                  active
                    ? `bg-${color}/15 border-${color} text-${color}`
                    : "border-border text-muted-foreground bg-surface"
                }`}
              >
                {s === "going" ? "I'm in" : s === "maybe" ? "Maybe" : "Can't"}
              </button>
            );
          })}
        </div>
      </section>

      {/* Who's in */}
      <section className="px-6 mb-8 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">Who's in</h3>
        <div className="space-y-3">
          <RsvpRow label="Going" tone="going" members={goingMembers} />
          <RsvpRow label="Maybe" tone="maybe" members={maybeMembers} />
          <RsvpRow label="Can't" tone="out" members={outMembers} />
        </div>
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
            const eff = effectiveSessionFor(d, sessionsRangeQ.data);
            const s = eff ? SPORTS[eff.sportId] : null;
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
              <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Crew size</p>
              <p className="font-display text-3xl flex items-center gap-1.5">
                {members.data?.length ?? "—"}
                <Flame className="size-5 text-primary" />
              </p>
            </div>
            <div className="pl-1">
              <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">
                {MONTH_NAMES[now.getMonth()]} RSVPs
              </p>
              <p className="font-display text-3xl mt-2">{attendance.filter(a => a.status === "going").length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Session brief */}
      <section className="px-6 mb-8 animate-in">
        <h3 className="font-display text-xl uppercase mb-3">Session brief</h3>
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{next.description}</p>
          <div className="grid grid-cols-2 gap-3">
            <Meta icon={<Clock className="size-3.5" />} label="Duration" value={`${next.duration} min`} />
            <Meta icon={<MapPin className="size-3.5" />} label="Location" value={next.location} />
          </div>
          {next.notes && (
            <div className="mt-1 p-3 rounded-xl border border-primary/40 bg-primary/5">
              <p className="font-mono text-[9px] uppercase text-primary tracking-widest mb-1">Note from owner</p>
              <p className="text-xs text-foreground whitespace-pre-wrap">{next.notes}</p>
            </div>
          )}
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

function RsvpRow({
  label,
  tone,
  members,
}: {
  label: string;
  tone: "going" | "maybe" | "out";
  members: Array<{ user_id: string; profile?: { display_name?: string | null; initials?: string | null; avatar_color?: string | null; avatar_url?: string | null } | null }>;
}) {
  const toneClass =
    tone === "going" ? "text-going border-going/40 bg-going/10"
    : tone === "maybe" ? "text-maybe border-maybe/40 bg-maybe/10"
    : "text-out border-out/40 bg-out/10";
  return (
    <div className="bg-surface border border-border rounded-2xl p-3 flex items-center gap-3">
      <span className={`px-2 py-1 rounded-full border font-mono text-[10px] uppercase tracking-widest shrink-0 ${toneClass}`}>
        {label} · {members.length}
      </span>
      <div className="flex -space-x-2 min-w-0 overflow-hidden">
        {members.slice(0, 6).map((m) => (
          <Avatar
            key={m.user_id}
            initials={m.profile?.initials ?? "··"}
            color={m.profile?.avatar_color ?? "hsl(45 90% 50%)"}
            imageUrl={m.profile?.avatar_url ?? null}
            size={28}
            ring="border-surface"
          />
        ))}
        {members.length === 0 && (
          <span className="font-mono text-[10px] text-muted-foreground uppercase">—</span>
        )}
      </div>
      {members.length > 0 && (
        <p className="text-xs text-muted-foreground truncate ml-auto">
          {members.map((m) => m.profile?.display_name ?? "Friend").join(", ")}
        </p>
      )}
    </div>
  );
}
