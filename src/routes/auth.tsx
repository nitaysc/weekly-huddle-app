import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Strike & Flow" },
      { name: "description", content: "Sign in to plan training with your crew." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pwd,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setErr(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setErr(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-16 pb-10">
      <div className="mb-10 animate-in">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
          Strike &amp; Flow
        </p>
        <h1 className="font-display text-5xl uppercase tracking-tight leading-[0.9]">
          Train with<br />your crew
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-[300px]">
          Rotating weekly sessions of boxing, calisthenics, basketball and volleyball — together.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 animate-in">
        {mode === "signup" && (
          <Field label="Name" value={name} onChange={setName} placeholder="Your name" />
        )}
        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@crew.club" required />
        <Field label="Password" value={pwd} onChange={setPwd} type="password" placeholder="••••••••" required />

        {err && (
          <p className="text-xs text-out font-mono uppercase tracking-wide">{err}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 rounded-xl bg-primary text-primary-foreground py-3.5 font-display text-base uppercase tracking-wider active:scale-[0.98] transition disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5 animate-in">
        <div className="h-px bg-border flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <button
        onClick={google}
        disabled={loading}
        className="w-full rounded-xl border border-border bg-surface py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
      >
        {mode === "signin"
          ? "New here? Create an account →"
          : "Already have an account? Sign in →"}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full bg-surface border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
