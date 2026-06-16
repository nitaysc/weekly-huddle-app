import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { getPushPermission, requestPushPermission } from "@/lib/onesignal";

const DISMISS_KEY = "sf:pushPromptDismissedAt";
const DISMISS_DAYS = 7;

export function NotificationPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const perm = getPushPermission();
    if (perm !== "default") return;
    const ts = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (ts && Date.now() - ts < DISMISS_DAYS * 86400_000) return;
    // Slight delay so it doesn't feel like a popup ambush
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      await requestPushPermission();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="mt-3 bg-surface border border-primary/40 rounded-2xl p-4 relative animate-in">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 size-7 grid place-items-center text-muted-foreground active:scale-95"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
          <Bell className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base uppercase tracking-wide leading-tight">
            Stay in the loop
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            Get a quick ping when your crew chats, RSVPs, or a session is about to start. You can turn this off anytime.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={enable}
              disabled={busy}
              className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest disabled:opacity-50 active:scale-95 transition"
            >
              {busy ? "Asking…" : "Enable"}
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-full border border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground active:scale-95 transition"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
