import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Send, Smile, LogOut } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useActiveCrew, useCrewMembers, useMyProfile, useSignOut } from "@/hooks/use-crew";

export const Route = createFileRoute("/_authenticated/crew")({
  head: () => ({
    meta: [
      { title: "Crew — Strike & Flow" },
      { name: "description", content: "Your training crew and group chat." },
    ],
  }),
  component: CrewPage,
});

interface ChatMsg {
  id: string;
  who: string;
  text: string;
  reactions: string[];
  mine?: boolean;
}

function CrewPage() {
  const { activeCrew } = useActiveCrew();
  const members = useCrewMembers(activeCrew?.id);
  const profile = useMyProfile();
  const signOut = useSignOut();

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!activeCrew) return;
    await navigator.clipboard.writeText(activeCrew.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Chat stays local for now (persistence coming in wave 2)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: "1", who: "Demo", text: "Group chat will sync across the crew in the next update 👋", reactions: ["🔥"] },
  ]);
  const [draft, setDraft] = useState("");
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMsgs((m) => [...m, {
      id: String(Date.now()),
      who: profile.data?.display_name ?? "You",
      text: t, reactions: [], mine: true,
    }]);
    setDraft("");
  };

  if (!activeCrew) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground font-mono text-xs uppercase">Loading…</div>;
  }

  const memberList = members.data ?? [];

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

      {/* Invite code */}
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
      </section>

      {/* Members */}
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

      {/* Chat (mock for now) */}
      <section className="px-4 animate-in">
        <div className="bg-surface rounded-2xl border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-display text-base uppercase tracking-wide">Group chat</p>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">Preview</span>
          </div>

          <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
            {msgs.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
                <div
                  className="size-7 rounded-full grid place-items-center font-mono text-[9px] font-bold text-background"
                  style={{ background: m.mine ? "hsl(45 90% 50%)" : "hsl(195 70% 55%)" }}
                >
                  {m.who.slice(0, 2).toUpperCase()}
                </div>
                <div className={`max-w-[70%] ${m.mine ? "items-end" : ""} flex flex-col gap-1`}>
                  {!m.mine && (
                    <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">{m.who}</span>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm ${
                      m.mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background border border-border rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.reactions.length > 0 && (
                    <div className="flex gap-1">
                      {m.reactions.map((r, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded-full bg-background border border-border">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border flex items-center gap-2">
            <button className="size-9 grid place-items-center text-muted-foreground">
              <Smile className="size-5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message the crew…"
              className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              onClick={send}
              className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center active:scale-95 transition"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
