import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, Users, BarChart3 } from "lucide-react";

const items = [
  { to: "/",      label: "Home",  Icon: Home },
  { to: "/plan",  label: "Plan",  Icon: CalendarDays },
  { to: "/crew",  label: "Crew",  Icon: Users },
  { to: "/stats", label: "Stats", Icon: BarChart3 },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 h-20 bg-background/80 backdrop-blur-xl border-t border-border">
      <div className="mx-auto max-w-[440px] h-full flex items-center justify-around px-4">
        {items.map(({ to, label, Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              <span className="font-mono text-[9px] uppercase tracking-tighter font-semibold">
                {label}
              </span>
              <span
                className={`h-0.5 w-6 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
