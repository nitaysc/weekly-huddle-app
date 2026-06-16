import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, KeyRound } from "lucide-react";
import { createCrew, joinCrewByCode, useActiveCrewId } from "@/hooks/use-crew";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "Find your crew — Strike & Flow" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [, setActive] = useActiveCrewId();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const crew = tab === "create"
        ? await createCrew(name.trim() || "My Crew")
        : await joinCrewByCode(code);
      setActive(crew.id);
      await qc.invalidateQueries({ queryKey: ["my-crews"] });
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-16 pb-10">
      <div className="mb-8 animate-in">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
          Step 1 of 1
        </p>
        <h1 className="font-display text-4xl uppercase leading-[0.9] tracking-tight">
          Find your crew
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-[320px]">
          Start a new crew or join an existing one with a 6-character invite code.
        </p>
      </div>

      <div className="flex gap-2 mb-5 animate-in">
        <TabBtn active={tab === "create"} onClick={() => setTab("create")} icon={<Plus className="size-4" />}>
          Create
        </TabBtn>
        <TabBtn active={tab === "join"} onClick={() => setTab("join")} icon={<KeyRound className="size-4" />}>
          Join
        </TabBtn>
      </div>

      <form onSubmit={submit} className="space-y-3 animate-in">
        {tab === "create" ? (
          <Field
            label="Crew name"
            value={name}
            onChange={setName}
            placeholder="The Iron Crew"
            required
          />
        ) : (
          <Field
            label="Invite code"
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            placeholder="ABC123"
            required
            mono
          />
        )}

        {err && <p className="text-xs text-out font-mono uppercase">{err}</p>}

        <button
          disabled={loading}
          className="w-full mt-2 rounded-xl bg-primary text-primary-foreground py-3.5 font-display text-base uppercase tracking-wider active:scale-[0.98] transition disabled:opacity-50"
        >
          {loading
            ? "Working…"
            : tab === "create"
            ? "Create crew"
            : "Join crew"}
        </button>
      </form>

      <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 p-4 animate-in">
        <Users className="size-4 text-primary mb-2" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Crews work best with 3–10 friends. Your crew gets a shared schedule, RSVPs, and stats.
        </p>
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 font-mono text-[11px] uppercase font-bold tracking-wider transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border bg-surface text-muted-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  label, value, onChange, placeholder, required, mono,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`mt-1.5 w-full bg-surface border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary ${
          mono ? "font-mono tracking-[0.4em] text-center text-xl uppercase" : ""
        }`}
      />
    </label>
  );
}
