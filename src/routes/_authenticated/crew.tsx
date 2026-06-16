import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Send, LogOut, Camera, Loader2, BellRing, Megaphone } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { useActiveCrew, useCrewMembers, useMyProfile, useSignOut } from "@/hooks/use-crew";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, sendMessage, toggleReaction, type MessageRow } from "@/lib/messages";
import { uploadAvatar, updateMyProfile } from "@/lib/profile";
import { sendTestPush, sendCrewBroadcast } from "@/lib/push.functions";


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

  // Chat presence — tell the server we're viewing the chat so push is suppressed
  useEffect(() => {
    if (!activeCrew?.id || !profile.data?.id) return;
    const ping = async () => {
      const until = new Date(Date.now() + 45_000).toISOString();
      await supabase
        .from("crew_members")
        .update({ chat_open_until: until })
        .eq("crew_id", activeCrew.id)
        .eq("user_id", profile.data!.id);
    };
    ping();
    const t = setInterval(ping, 25_000);
    return () => {
      clearInterval(t);
      // Clear presence on leave
      supabase
        .from("crew_members")
        .update({ chat_open_until: new Date(0).toISOString() })
        .eq("crew_id", activeCrew.id)
        .eq("user_id", profile.data!.id);
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
        <ProfileEditor />
        <NotificationPrompt />
        <PushTestButton />
      </section>


      <section className="mb-6 animate-in">
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 no-scrollbar">
          {memberList.map((m) => (
            <div key={m.user_id} className="flex flex-col items-center gap-2 shrink-0 w-16">
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
      setResult(r.ok ? "Sent ✓ — check your device" : `Failed (${r.status})`);
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
