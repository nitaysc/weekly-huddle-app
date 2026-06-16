import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABS = ["/", "/plan", "/crew", "/stats"] as const;

function tabIndex(pathname: string): number {
  if (pathname === "/") return 0;
  for (let i = 1; i < TABS.length; i++) {
    if (pathname.startsWith(TABS[i])) return i;
  }
  return -1;
}

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const idx = tabIndex(pathname);
  const prevIdxRef = useRef(idx);
  const [direction, setDirection] = useState<"forward" | "back" | "none">("none");

  useEffect(() => {
    const prev = prevIdxRef.current;
    if (idx >= 0 && prev >= 0 && idx !== prev) {
      setDirection(idx > prev ? "forward" : "back");
    } else {
      setDirection("none");
    }
    prevIdxRef.current = idx;
  }, [idx]);

  // Swipe gesture (only on top-level tabs)
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiping = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (idx < 0) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!swiping.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiping.current = true;
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    const dy = (e.changedTouches[0]?.clientY ?? startY.current) - startY.current;
    startX.current = null;
    startY.current = null;
    if (idx < 0) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0 && idx < TABS.length - 1) {
      navigate({ to: TABS[idx + 1] });
    } else if (dx > 0 && idx > 0) {
      navigate({ to: TABS[idx - 1] });
    }
  };

  const animClass =
    direction === "forward"
      ? "page-slide-in-right"
      : direction === "back"
        ? "page-slide-in-left"
        : "page-transition";

  return (
    <div
      className="min-h-dvh overflow-x-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div key={pathname} className={animClass}>
        <Outlet />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});
