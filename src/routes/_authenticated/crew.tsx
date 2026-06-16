import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, Send, LogOut } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useActiveCrew, useCrewMembers, useMyProfile, useSignOut } from "@/hooks/use-crew";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, sendMessage, toggleReaction, type MessageRow } from "@/lib/messages";

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
  const { activeCrew } = useActiveCrew();
  const members = useCrewMembers(activeCrew?.id);
  const profile = useMyProfile();
  const signOut = useSignOut();
  const qc = useQueryClient();

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
    const map = new Map<string, { name: string; initials: string; color: string }>();
    (members.data ?? []).forEach((m) => {
      map.set(m.user_id, {
        name: m.profile?.display_name ?? "Friend",
        initials: m.profile?.initials ?? "··",
        color: m.profile?.avatar_color ?? "hsl(45 90% 50%)",
      });
    });
    return map;
  }, [members.data]);

  if (!activeCrew) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground font-mono text-xs uppercase">Loading…</div>;
  }

  const memberList = members.data ?? [];
  const msgs = messages.data ?? [];

  return (
    <div className="pb-28">
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
        <NotificationCTA />
      </section>

      <section className="mb-6 animate-in">
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 no-scrollbar">
          {memberList.map((m) => (
            <div key={m.user_id} className="flex flex-col items-center gap-2 shrink-0 w-16">
              <Avatar
                initials={m.profile?.initials ?? "··"}
                color={m.profile?.avatar_color ?? "hsl(45 90% 50%)"}
                size={48}
                ring="border-background"
              />
              <span className="text-[10px] truncate w-full text-center">
                {m.profile?.display_name ?? "Friend"}
              </span>
              {m.role === "owner" && (
                <span className="font-mono text-[8px] uppercase text-primary tracking-widest">Owner</span>
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
              <p className="text-center font-mono text-[10px] uppercase text-muted-foreground py-6">Loading…</p>
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
  author?: { name: string; initials: string; color: string };
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactionEntries = Object.entries(msg.reactions ?? {});

  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <div
        className="size-7 rounded-full grid place-items-center font-mono text-[9px] font-bold text-background shrink-0"
        style={{ background: author?.color ?? "hsl(195 70% 55%)" }}
      >
        {author?.initials ?? "··"}
      </div>
      <div className={`max-w-[75%] flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
        {!mine && (
          <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">
            {author?.name ?? "Friend"}
          </span>
        )}
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
