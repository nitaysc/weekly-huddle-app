import { createFileRoute } from "@tanstack/react-router";
import { Plus, Send, Smile } from "lucide-react";
import { useState } from "react";
import { FRIENDS } from "@/lib/data";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/crew")({
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

const SEED_MSGS: ChatMsg[] = [
  { id: "1", who: "Marcus", text: "Bringing my new wraps tonight 🥊", reactions: ["🔥","💪"] },
  { id: "2", who: "Kai",    text: "I'll grab water bottles for everyone", reactions: ["🙌"] },
  { id: "3", who: "You",    text: "Let's rotate to bag 3 first, less queue", reactions: [], mine: true },
  { id: "4", who: "Ava",    text: "Running 10 min late — start without me!", reactions: ["👍"] },
];

function CrewPage() {
  const [msgs, setMsgs] = useState(SEED_MSGS);
  const [draft, setDraft] = useState("");

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMsgs((m) => [...m, { id: String(Date.now()), who: "You", text: t, reactions: [], mine: true }]);
    setDraft("");
  };

  return (
    <div className="pb-28">
      <header className="px-6 pt-10 pb-5 flex items-end justify-between animate-in">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{FRIENDS.length} members</p>
          <h1 className="font-display text-4xl uppercase tracking-tight leading-none">Crew</h1>
        </div>
        <button className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center active:scale-95 transition">
          <Plus className="size-5" strokeWidth={2.5} />
        </button>
      </header>

      {/* Members horizontal */}
      <section className="mb-6 animate-in">
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 no-scrollbar">
          {FRIENDS.map((f) => (
            <div key={f.id} className="flex flex-col items-center gap-2 shrink-0 w-14">
              <div className="relative">
                <Avatar friend={f} size={48} ring="border-background" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background"
                  style={{
                    background:
                      f.status === "going" ? "var(--color-going)" :
                      f.status === "maybe" ? "var(--color-maybe)" :
                      f.status === "out" ? "var(--color-out)" : "hsl(220 10% 40%)",
                  }}
                />
              </div>
              <span className="text-[10px] truncate w-full text-center">{f.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Chat */}
      <section className="px-4 animate-in">
        <div className="bg-surface rounded-2xl border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-display text-base uppercase tracking-wide">Group chat</p>
            <span className="font-mono text-[10px] text-going uppercase flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-going animate-pulse" /> Live
            </span>
          </div>

          <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
            {msgs.map((m) => {
              const f = FRIENDS.find((x) => x.name === m.who);
              return (
                <div key={m.id} className={`flex gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
                  {f && <Avatar friend={f} size={28} ring="border-surface" />}
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
              );
            })}
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
