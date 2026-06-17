import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Send, LogOut, Camera, Loader2, BellRing, Megaphone, UserMinus, Trash2, DoorOpen, X, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { useActiveCrew, useCrewMembers, useMyProfile, useSignOut, useActiveCrewId } from "@/hooks/use-crew";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, sendMessage, toggleReaction, type MessageRow } from "@/lib/messages";
import { uploadAvatar, updateMyProfile } from "@/lib/profile";
import { sendTestPush, sendCrewBroadcast } from "@/lib/push.functions";

const ADMIN_EMAIL = "7nitay7@gmail.com";


export const Route = createFileRoute("/_authenticated/crew")({
  head: () => ({
    meta: [
      { title: "Crew — Strike & Flow" },
      { name: "description", content: "Your training crew and group chat." },
    ],
  }),
  component: CrewPage,
});

const QUICK_EMOJI = ["🔥", "💪", "👀", "😂", "❤️"];

function CrewPage() {
  const navigate = useNavigate();
  const { activeCrew } = useActiveCrew();
  const members = useCrewMembers(activeCrew?.id);
  const profile = useMyProfile();
  const signOut = useSignOut();
  const qc = useQueryClient();
  const [, setActiveCrewId] = useActiveCrewId();

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!activeCrew) return;
    await navigator.clipboard.writeText(activeCrew.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const msgKey = ["messages", activeCrew?.id] as const;
  const messages = useQuery({
    queryKey: msgKey,
    enabled: !!activeCrew?.id,
    queryFn: () => fetchMessages(activeCrew!.id),
  });

  // Realtime subscription
  useEffect(() => {
    if (!activeCrew?.id) return;
    const channel = supabase
      .channel(`messages:${activeCrew.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `crew_id=eq.${activeCrew.id}` },
        () => qc.invalidateQueries({ queryKey: msgKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCrew?.id, qc]);

  // Chat presence
  useEffect(() => {
    if (!activeCrew?.id || !profile.data?.id) return;
    const crewId = activeCrew.id;
    const userId = profile.data.id;
    let interval: ReturnType<typeof setInterval> | null = null;

    const setPresence = async (active: boolean) => {
      const until = active
        ? new Date(Date.now() + 45_000).toISOString()
        : new Date(0).toISOString();
      await supabase
        .from("crew_members")
        .update({ chat_open_until: until })
        .eq("crew_id", crewId)
        .eq("user_id", userId);
    };

    const start = () => {
      if (interval) return;
      setPresence(true);
      interval = setInterval(() => setPresence(true), 25_000);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      setPresence(false);
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    window.addEventListener("blur", stop);
    window.addEventListener("focus", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("blur", stop);
      window.removeEventListener("focus", onVisibility);
      stop();
    };
  }, [activeCrew?.id, profile.data?.id]);

  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.data?.length]);

  const send = async () => {
    const t = draft.trim();
    if (!t || !activeCrew) return;
    setDraft("");
    try {
      await sendMessage(activeCrew.id, t);
    } catch (e) {
      console.error(e);
      setDraft(t);
    }
  };

  const myId = profile.data?.id;
  const memberMap = useMemo(() => {
    const map = new Map<string, { name: string; initials: string; color: string; avatarUrl: string | null }>();
    (members.data ?? []).forEach((m) => {
      map.set(m.user_id, {
        name: m.profile?.display_name ?? "Friend",
        initials: m.profile?.initials ?? "··",
        color: m.profile?.avatar_color ?? "hsl(45 90% 50%)",
        avatarUrl: m.profile?.avatar_url ?? null,
      });
    });
    return map;
  }, [members.data]);

  // Crew management helpers
  const memberList = members.data ?? [];
  const myMember = memberList.find((m) => m.user_id === myId);
  const isOwner = myMember?.role === "owner";

  const [kickTarget, setKickTarget] = useState<{ userId: string; name: string } | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const kickMember = async (userId: string) => {
    if (!activeCrew) return;
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("crew_members")
        .delete()
        .eq("crew_id", activeCrew.id)
        .eq("user_id", userId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["crew-members"] });
      setKickTarget(null);
    } catch (e: any) {
      alert(e?.message ?? "Failed to remove member");
    } finally {
      setActionBusy(false);
    }
  };

  const leaveCrew = async () => {
    if (!activeCrew || !myId) return;
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("crew_members")
        .delete()
        .eq("crew_id", activeCrew.id)
        .eq("user_id", myId);
      if (error) throw error;
      setActiveCrewId(null);
      await qc.invalidateQueries({ queryKey: ["my-crews"] });
      navigate({ to: "/onboarding" });
    } catch (e: any) {
      alert(e?.message ?? "Failed to leave crew");
    } finally {
      setActionBusy(false);
    }
  };

  const deleteCrew = async () => {
    if (!activeCrew) return;
    setActionBusy(true);
    try {
      // Delete all members first (cascades won't trigger from client)
      const { error: membersError } = await supabase
        .from("crew_members")
        .delete()
        .eq("crew_id", activeCrew.id);
      if (membersError) throw membersError;

      // Delete the crew itself
      const { error: crewError } = await supabase
        .from("crews")
        .delete()
        .eq("id", activeCrew.id);
      if (crewError) throw crewError;

      setActiveCrewId(null);
      await qc.invalidateQueries({ queryKey: ["my-crews"] });
      navigate({ to: "/onboarding" });
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete crew");
    } finally {
      setActionBusy(false);
    }
  };

  if (!activeCrew) {
    return (
      <div className="pb-28 stagger animate-in w-full">
        <header className="px-6 pt-10 pb-5 flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-8 w-40 rounded-full" />
          </div>
          <Skeleton className="size-10 rounded-full" />
        </header>
        <section className="px-4 mb-6">
          <Skeleton className="w-full h-24 rounded-2xl" />
          <Skeleton className="w-full h-20 rounded-2xl mt-4" />
        </section>
        <section className="px-6 mb-6">
          <div className="flex gap-4">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="size-12 rounded-full" />
          </div>
        </section>
        <section className="px-4">
          <Skeleton className="w-full h-64 rounded-2xl" />
        </section>
      </div>
    );
  }

  const msgs = messages.data ?? [];

  return (
    <div className="pb-28 stagger">
      <header className="px-6 pt-10 pb-5 flex items-end justify-between animate-in">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
            {memberList.length} {memberList.length === 1 ? "member" : "members"}
          </p>
          <h1 className="font-display text-4xl uppercase tracking-tight leading-none truncate">
            {activeCrew.name}
          </h1>
        </div>
        <button
          onClick={signOut}
          className="size-10 rounded-full border border-border bg-surface grid place-items-center text-muted-foreground active:scale-95 transition"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </header>

      <section className="px-4 mb-6 animate-in">
        <button
          onClick={copy}
          className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition"
        >
          <div className="text-left">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Invite code
            </p>
            <p className="font-mono text-2xl tracking-[0.4em] text-primary">
              {activeCrew.invite_code}
            </p>
          </div>
          <div className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center">
            {copied ? <Check className="size-5" /> : <Copy className="size-4" />}
          </div>
        </button>
        <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest mt-2 px-2">
          Share this code so friends can join your crew
        </p>
        <ProfileEditor />
        <NotificationPrompt />
        <BroadcastPanel crewId={activeCrew.id} isOwner={isOwner} />
        <PushTestButton />
      </section>

      {/* Members with kick option for owners */}
      <section className="mb-6 animate-in">
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 no-scrollbar">
          {memberList.map((m) => (
            <div key={m.user_id} className="flex flex-col items-center gap-2 shrink-0 w-16 relative group">
              <Avatar
                initials={m.profile?.initials ?? "··"}
                color={m.profile?.avatar_color ?? "hsl(45 90% 50%)"}
                imageUrl={m.profile?.avatar_url ?? null}
                size={48}
                ring="border-background"
              />
              <span className="text-[10px] truncate w-full text-center">
                {m.profile?.display_name ?? "Friend"}
              </span>
              {m.role === "owner" && (
                <span className="font-mono text-[8px] uppercase text-primary tracking-widest">Owner</span>
              )}
              {/* Kick button — owners can kick non-owners */}
              {isOwner && m.user_id !== myId && m.role !== "owner" && (
                <button
                  onClick={() => setKickTarget({ userId: m.user_id, name: m.profile?.display_name ?? "this member" })}
                  className="absolute -top-1 -right-1 size-5 rounded-full bg-out/90 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                  title="Remove member"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 animate-in">
        <div className="bg-surface rounded-2xl border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-display text-base uppercase tracking-wide">Group chat</p>
            <span className="font-mono text-[10px] text-going uppercase">● Live</span>
          </div>

          <div ref={scrollerRef} className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
            {messages.isLoading && (
              <div className="space-y-4 py-2">
                <div className="flex gap-2">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-2 w-16 rounded-full" />
                    <Skeleton className="h-8 w-40 rounded-2xl rounded-bl-sm" />
                  </div>
                </div>
                <div className="flex gap-2 flex-row-reverse">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="space-y-1 flex flex-col items-end">
                    <Skeleton className="h-2 w-16 rounded-full" />
                    <Skeleton className="h-8 w-32 rounded-2xl rounded-br-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-2 w-20 rounded-full" />
                    <Skeleton className="h-8 w-48 rounded-2xl rounded-bl-sm" />
                  </div>
                </div>
              </div>
            )}
            {!messages.isLoading && msgs.length === 0 && (
              <p className="text-center font-mono text-[10px] uppercase text-muted-foreground py-6">
                No messages yet — say hi 👋
              </p>
            )}
            {msgs.map((m) => (
              <MessageItem
                key={m.id}
                msg={m}
                mine={m.author_id === myId}
                author={memberMap.get(m.author_id)}
              />
            ))}
          </div>

          <div className="p-3 border-t border-border flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message the crew…"
              className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center active:scale-95 transition disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Crew management — Leave / Delete */}
      <section className="px-4 mt-6 animate-in">
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Crew settings</p>

          {/* Leave crew (non-owners, or owners if there's another owner) */}
          {!isOwner && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background active:scale-[0.98] transition"
            >
              <div className="size-9 rounded-full bg-out/15 text-out grid place-items-center shrink-0">
                <DoorOpen className="size-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">Leave crew</p>
                <p className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">You can rejoin later with the invite code</p>
              </div>
            </button>
          )}

          {/* Owner: leave crew */}
          {isOwner && memberList.length > 1 && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-background active:scale-[0.98] transition"
            >
              <div className="size-9 rounded-full bg-out/15 text-out grid place-items-center shrink-0">
                <DoorOpen className="size-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">Leave crew</p>
                <p className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">Leave but keep the crew for others</p>
              </div>
            </button>
          )}

          {/* Owner: delete crew */}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-out/40 bg-out/5 active:scale-[0.98] transition"
            >
              <div className="size-9 rounded-full bg-out/15 text-out grid place-items-center shrink-0">
                <Trash2 className="size-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-out">Delete crew</p>
                <p className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">Permanently remove the crew and all data</p>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Kick confirmation modal */}
      {kickTarget && (
        <ConfirmModal
          icon={<UserMinus className="size-5" />}
          title={`Remove ${kickTarget.name}?`}
          description="They will no longer be part of this crew. They can rejoin using the invite code."
          confirmLabel="Remove"
          busy={actionBusy}
          onConfirm={() => kickMember(kickTarget.userId)}
          onCancel={() => setKickTarget(null)}
        />
      )}

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <ConfirmModal
          icon={<DoorOpen className="size-5" />}
          title="Leave this crew?"
          description="You'll be removed from the crew. You can rejoin later with the invite code."
          confirmLabel="Leave"
          busy={actionBusy}
          onConfirm={leaveCrew}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          icon={<AlertTriangle className="size-5" />}
          title="Delete this crew?"
          description="This will permanently delete the crew, all members, messages, and sessions. This cannot be undone."
          confirmLabel="Delete forever"
          destructive
          busy={actionBusy}
          onConfirm={deleteCrew}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

/* ========== Confirm Modal ========== */
function ConfirmModal({
  icon,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      {/* Panel */}
      <div className="relative w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4 animate-in">
        <div className={`size-12 rounded-full grid place-items-center mx-auto ${destructive ? 'bg-out/15 text-out' : 'bg-primary/15 text-primary'}`}>
          {icon}
        </div>
        <h2 className="font-display text-xl uppercase text-center leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-xl border border-border bg-background font-mono text-[11px] uppercase tracking-wider active:scale-[0.98] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-3 rounded-xl font-mono text-[11px] uppercase tracking-wider active:scale-[0.98] transition disabled:opacity-50 ${
              destructive
                ? 'bg-out text-white'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageItem({
  msg,
  mine,
  author,
}: {
  msg: MessageRow;
  mine: boolean;
  author?: { name: string; initials: string; color: string; avatarUrl: string | null };
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactionEntries = Object.entries(msg.reactions ?? {});

  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar
        initials={author?.initials ?? "··"}
        color={author?.color ?? "hsl(195 70% 55%)"}
        imageUrl={author?.avatarUrl ?? null}
        size={28}
        ring="border-surface"
      />
      <div className={`max-w-[75%] flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
        <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">
          {mine ? "You" : author?.name ?? "Friend"}
        </span>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className={`px-3 py-2 rounded-2xl text-sm text-left ${
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-background border border-border rounded-bl-sm"
          }`}
        >
          {msg.text}
        </button>
        {pickerOpen && (
          <div className="flex gap-1 bg-background border border-border rounded-full px-2 py-1">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => {
                  toggleReaction(msg, e).catch(console.error);
                  setPickerOpen(false);
                }}
                className="text-base active:scale-110 transition"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {reactionEntries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reactionEntries.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(msg, emoji).catch(console.error)}
                className="text-xs px-1.5 py-0.5 rounded-full bg-background border border-border flex items-center gap-1"
              >
                <span>{emoji}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PushTestButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const send = useServerFn(sendTestPush);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (email?.toLowerCase() !== ADMIN_EMAIL) return null;

  const onClick = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await send();
      if (r.ok) {
        const note = r.invalidAliases
          ? `Sent ✓ (${r.recipients ?? 0} device${(r.recipients ?? 0) === 1 ? "" : "s"})`
          : "Sent ✓ — check your device";
        setResult(note);
      } else {
        setResult(`Failed (${r.status})`);
      }
    } catch (e: any) {
      setResult(e?.message ?? "Error");
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 4000);
    }
  };

  return (
    <div className="mt-3 bg-surface border border-dashed border-border rounded-2xl p-3 flex items-center gap-3">
      <div className="size-9 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
        <BellRing className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Admin tools</p>
        <p className="text-xs leading-tight">Send yourself a test push</p>
        {result && <p className="font-mono text-[9px] uppercase text-primary tracking-widest mt-1">{result}</p>}
      </div>
      <button
        onClick={onClick}
        disabled={busy}
        className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest disabled:opacity-50 active:scale-95 transition"
      >
        {busy ? "Sending…" : "Test"}
      </button>
    </div>
  );
}



function BroadcastPanel({ crewId, isOwner }: { crewId: string; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const broadcast = useServerFn(sendCrewBroadcast);

  if (!isOwner) return null;

  const presets: Array<{ label: string; title: string; body: string }> = [
    { label: "Be ready", title: "🔥 Get ready", body: "Next session is coming up — be ready!" },
    { label: "RSVP now", title: "🗳️ RSVP time", body: "Are you in for the next meeting? Tap to set going / out." },
    { label: "Heads up", title: "📣 Heads up", body: "Quick update from your crew owner — open the app." },
  ];

  const submit = async (t: string, b: string) => {
    if (!t.trim() || !b.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await broadcast({ data: { crewId, title: t, body: b } });
      if (r.ok) {
        setResult(`Sent ✓ to ${r.targeted ?? 0} member${(r.targeted ?? 0) === 1 ? "" : "s"}`);
        setTitle("");
        setBody("");
        setOpen(false);
      } else {
        setResult(`Failed (${r.status})`);
      }
    } catch (e: any) {
      setResult(e?.message ?? "Error");
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 4000);
    }
  };

  return (
    <div className="mt-3 bg-surface border border-border rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
          <Megaphone className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Owner broadcast</p>
          <p className="text-xs leading-tight">Push every member of the crew</p>
          {result && <p className="font-mono text-[9px] uppercase text-primary tracking-widest mt-1">{result}</p>}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest active:scale-95 transition"
        >
          {open ? "Close" : "New"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => submit(p.title, p.body)}
                disabled={busy}
                className="px-2.5 py-1 rounded-full border border-border bg-background font-mono text-[10px] uppercase tracking-widest active:scale-95 transition disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Be ready)"
            maxLength={60}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message to the crew…"
            maxLength={240}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
          <button
            onClick={() => submit(title, body)}
            disabled={busy || !title.trim() || !body.trim()}
            className="w-full px-3 py-2 rounded-full bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest active:scale-95 transition disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send broadcast"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileEditor() {
  const profile = useMyProfile();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (profile.data?.display_name && !editingName) {
      setName(profile.data.display_name);
    }
  }, [profile.data?.display_name, editingName]);

  const me = profile.data;
  if (!me) return null;

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(f);
      await updateMyProfile({ avatar_url: url });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-profile"] }),
        qc.invalidateQueries({ queryKey: ["crew-members"] }),
      ]);
    } catch (err) {
      console.error(err);
      alert("Could not upload photo. Try a smaller image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === me.display_name) {
      setEditingName(false);
      return;
    }
    setBusy(true);
    try {
      await updateMyProfile({ display_name: name });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-profile"] }),
        qc.invalidateQueries({ queryKey: ["crew-members"] }),
      ]);
      setEditingName(false);
    } catch (err) {
      console.error(err);
      alert("Could not update name.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
      <button onClick={onPick} className="relative shrink-0 active:scale-95 transition" disabled={busy} aria-label="Change photo">
        <Avatar
          initials={me.initials}
          color={me.avatar_color}
          imageUrl={me.avatar_url}
          size={56}
          ring="border-surface"
        />
        <span className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-surface">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your profile</p>
        {editingName ? (
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
              className="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
            />
            <button onClick={saveName} disabled={busy} className="px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-mono uppercase disabled:opacity-50">
              Save
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="text-left">
            <p className="font-display text-lg uppercase leading-none truncate">{me.display_name}</p>
            <p className="font-mono text-[9px] uppercase text-primary tracking-widest mt-1">Tap to edit name · photo</p>
          </button>
        )}
      </div>
    </div>
  );
}
