import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Clock, MapPin, Cloud, Dumbbell, Flame, Check,
} from "lucide-react";
import { useState } from "react";
import { SPORTS, type SportId, nextSession } from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { useActiveCrew, useCrewMembers, useMyProfile } from "@/hooks/use-crew";
import {
  ensureSession, fetchAttendance, setMyAttendance, toDateKey,
  type AttendanceStatus,
} from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/activity/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  head: ({ params }) => {
    const s = SPORTS[params.id as SportId];
    return {
      meta: [
        { title: s ? `${s.name} — Strike & Flow` : "Activity" },
        { name: "description", content: s?.description ?? "" },
        ...(s ? [{ property: "og:image" as const, content: s.image }] : []),
      ],
    };
  },
  loader: ({ params }) => {
    const s = SPORTS[params.id as SportId];
    if (!s) throw notFound();
    return null;
  },
  notFoundComponent: () => (
    <div className="px-6 pt-20 text-center">
      <p className="font-display text-2xl uppercase">Activity not found</p>
      <Link to="/" className="text-primary font-mono text-xs uppercase mt-4 inline-block">Go home →</Link>
    </div>
  ),
  errorComponent: () => (
    <div className="px-6 pt-20 text-center">
      <p>Something went wrong loading this activity.</p>
    </div>
  ),
  component: ActivityPage,
});

function ActivityPage() {
  const { id } = Route.useParams();
  const { date: dateParam } = Route.useSearch();
  const baseSport = SPORTS[id as SportId];
  const { activeCrew } = useActiveCrew();
  const profile = useMyProfile();
  const members = useCrewMembers(activeCrew?.id);
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Prefer an explicit date passed from Home/Plan; otherwise fall back to the
  // next rotation day for this sport.
  const target = dateParam
    ? parseDateKey(dateParam)
    : (findNextDateForSport(id as SportId) ?? new Date());

  const sessionQ = useQuery({
    queryKey: ["session-for", activeCrew?.id, toDateKey(target)],
    enabled: !!activeCrew,
    queryFn: () => ensureSession(activeCrew!.id, target),
  });


  // Merge per-session overrides on top of the default sport definition
  const ov = (sessionQ.data?.overrides ?? {}) as Partial<typeof baseSport> & { startTime?: string };
  const sport = {
    ...baseSport,
    ...(ov.name ? { name: ov.name } : {}),
    ...(ov.tagline ? { tagline: ov.tagline } : {}),
    ...(ov.location ? { location: ov.location } : {}),
    ...(ov.duration ? { duration: ov.duration } : {}),
    ...(ov.difficulty ? { difficulty: ov.difficulty } : {}),
    ...(ov.equipment && (ov.equipment as string[]).length ? { equipment: ov.equipment } : {}),
    ...(ov.warmup && (ov.warmup as string[]).length ? { warmup: ov.warmup } : {}),
    ...(ov.workout && (ov.workout as Array<{title: string; detail: string}>).length ? { workout: ov.workout } : {}),
  };
  const overrideNotes = (sessionQ.data?.overrides as { notes?: string } | undefined)?.notes;

  const attendanceQ = useQuery({
    queryKey: ["attendance", sessionQ.data?.id],
    enabled: !!sessionQ.data?.id,
    queryFn: () => fetchAttendance(sessionQ.data!.id),
  });

  const rsvp = useMutation({
    mutationFn: async (status: AttendanceStatus) => {
      if (!sessionQ.data) return;
      await setMyAttendance(sessionQ.data.id, status);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionQ.data?.id] }),
  });

  const attendance = attendanceQ.data ?? [];
  const myStatus = attendance.find((a) => a.user_id === profile.data?.id)?.status;
  const byStatus = (s: AttendanceStatus) =>
    new Set(attendance.filter((a) => a.status === s).map((a) => a.user_id));
  const going = byStatus("going");

  // Effective session start: row.starts_at (already reflects override time) → fallback.
  const sessionStart = sessionQ.data?.starts_at
    ? new Date(sessionQ.data.starts_at)
    : target;
  const timeLabel = `${sessionStart.getHours().toString().padStart(2, "0")}:${sessionStart.getMinutes().toString().padStart(2, "0")}`;
  const dayLabel = sessionStart.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="pb-28 stagger">
      {/* Hero */}
      <div className="relative">
        <img
          src={sport.image}
          alt={sport.name}
          width={800}
          height={1000}
          className="w-full aspect-[4/5] object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/60" />
        <Link
          to="/"
          className="absolute top-10 left-4 size-10 rounded-full bg-background/70 backdrop-blur border border-border grid place-items-center"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="absolute top-10 right-4 px-3 py-1.5 rounded-full bg-background/70 backdrop-blur border border-border font-mono text-[10px] uppercase tracking-widest">
          {dayLabel} · {timeLabel}
        </div>
        <div className="absolute bottom-0 inset-x-0 p-6">
          <span
            className="inline-block px-2 py-1 font-mono text-[10px] font-bold uppercase rounded mb-3"
            style={{ background: `var(--color-${sport.colorVar})`, color: "hsl(220 15% 5%)" }}
          >
            {sport.tagline}
          </span>
          <h1 className="font-display text-6xl uppercase leading-[0.85] tracking-tight">
            {sport.name}
          </h1>
        </div>
      </div>

      <section className="px-4 -mt-2 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <Meta icon={<Clock className="size-3.5" />} label="Time" value={timeLabel} />
          <Meta icon={<Clock className="size-3.5" />} label="Duration" value={`${sport.duration}m`} />
          <Meta icon={<Flame className="size-3.5" />} label="Level" value={sport.difficulty} />
          <Meta icon={<MapPin className="size-3.5" />} label="Place" value={sport.location.split(",")[0]} />
        </div>
      </section>


      <section className="px-6 mb-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{sport.description}</p>
        {overrideNotes && (
          <div className="mt-3 p-3 rounded-xl border border-primary/40 bg-primary/5">
            <p className="font-mono text-[9px] uppercase text-primary tracking-widest mb-1">Note from owner</p>
            <p className="text-xs text-foreground whitespace-pre-wrap">{overrideNotes}</p>
          </div>
        )}
        {sport.outdoor && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Cloud className="size-3.5 text-primary" />
            Outdoor session — check the weather before heading out.
          </div>
        )}
      </section>

      {/* Attendance */}
      <section className="px-6 mb-6">
        <p className="font-mono text-[10px] uppercase text-muted-foreground mb-2">Your status</p>
        <div className="grid grid-cols-3 gap-2">
          {(["going", "maybe", "out"] as const).map((s) => {
            const active = myStatus === s;
            const cls = active
              ? s === "going" ? "bg-going/15 border-going text-going"
                : s === "maybe" ? "bg-maybe/15 border-maybe text-maybe"
                : "bg-out/15 border-out text-out"
              : "border-border text-muted-foreground bg-surface";
            return (
              <button
                key={s}
                onClick={() => rsvp.mutate(s)}
                disabled={rsvp.isPending || !sessionQ.data}
                className={`py-3 rounded-xl border font-mono text-[11px] uppercase font-bold tracking-wider transition disabled:opacity-50 ${cls}`}
              >
                {s === "going" ? "I'm in" : s === "maybe" ? "Maybe" : "Can't"}
              </button>
            );
          })}
        </div>
      </section>

      {/* Crew */}
      <section className="px-6 mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-xl uppercase">Crew · {going.size} going</h3>
        </div>
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {(members.data ?? []).map((m) => {
            const aRow = attendance.find((a) => a.user_id === m.user_id);
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-3">
                <Avatar
                  initials={m.profile?.initials ?? "··"}
                  color={m.profile?.avatar_color ?? "hsl(45 90% 50%)"}
                  imageUrl={m.profile?.avatar_url ?? null}
                  ring="border-surface"
                />
                <p className="flex-1 text-sm font-semibold">
                  {m.profile?.display_name ?? "Friend"}
                  {m.user_id === profile.data?.id && (
                    <span className="ml-2 font-mono text-[9px] uppercase text-muted-foreground">you</span>
                  )}
                </p>
                <StatusBadge status={aRow?.status as AttendanceStatus | undefined} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Equipment */}
      <section className="px-6 mb-6">
        <h3 className="font-display text-xl uppercase mb-3 flex items-center gap-2">
          <Dumbbell className="size-4 text-primary" /> Equipment
        </h3>
        <div className="flex flex-wrap gap-2">
          {sport.equipment.map((e) => (
            <span key={e} className="px-3 py-1.5 rounded-full border border-border bg-surface text-xs font-medium">
              {e}
            </span>
          ))}
        </div>
      </section>

      {/* Warm up */}
      <section className="px-6 mb-6">
        <h3 className="font-display text-xl uppercase mb-3">Warm-up</h3>
        <ul className="bg-surface border border-border rounded-2xl divide-y divide-border">
          {sport.warmup.map((w) => {
            const isChecked = !!checked[w];
            return (
              <li key={w}>
                <button
                  onClick={() => setChecked((c) => ({ ...c, [w]: !c[w] }))}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <span
                    className={`size-5 rounded border grid place-items-center transition ${
                      isChecked ? "bg-primary border-primary" : "border-border"
                    }`}
                  >
                    {isChecked && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                  </span>
                  <span className={`text-sm ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                    {w}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Workout blocks */}
      <section className="px-6 mb-6">
        <h3 className="font-display text-xl uppercase mb-3">Session plan</h3>
        <div className="space-y-2">
          {sport.workout.map((w, i) => (
            <div key={w.title} className="flex gap-3 bg-surface border border-border rounded-2xl p-4">
              <span className="font-display text-2xl text-primary leading-none w-8 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{w.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{w.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function findNextDateForSport(sportId: SportId): Date | null {
  const now = new Date();
  for (let i = 0; i < 21; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const next = nextSession(d);
    if (next && next.sport.id === sportId) return next.date;
  }
  return null;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  const out = new Date();
  out.setFullYear(y, (m || 1) - 1, d || 1);
  out.setHours(12, 0, 0, 0);
  return out;
}


function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-3 text-center">
      <p className="flex items-center justify-center gap-1 font-mono text-[9px] uppercase text-muted-foreground mb-1">
        {icon} {label}
      </p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AttendanceStatus | undefined }) {
  const map = {
    going: "text-going border-going/40 bg-going/10",
    maybe: "text-maybe border-maybe/40 bg-maybe/10",
    out: "text-out border-out/40 bg-out/10",
  } as const;
  if (!status) {
    return (
      <span className="font-mono text-[10px] uppercase font-bold px-2 py-1 rounded border text-muted-foreground border-border">
        —
      </span>
    );
  }
  const label = status === "going" ? "Going" : status === "maybe" ? "Maybe" : "Out";
  return (
    <span className={`font-mono text-[10px] uppercase font-bold px-2 py-1 rounded border ${map[status]}`}>
      {label}
    </span>
  );
}
