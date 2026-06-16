import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

  // Track direction for entrance animation (tabs + push/pop into detail pages)
  const prevIdxRef = useRef(idx);
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  useLayoutEffect(() => {
    const prev = prevIdxRef.current;
    const prevPath = prevPathRef.current;
    const isDetail = (p: string) => p.startsWith("/activity");
    if (isDetail(pathname) && !isDetail(prevPath)) {
      // Push into a detail page
      setDirection(1);
    } else if (!isDetail(pathname) && isDetail(prevPath)) {
      // Pop back from detail
      setDirection(-1);
    } else if (idx >= 0 && prev >= 0 && idx !== prev) {
      setDirection(idx > prev ? 1 : -1);
    } else {
      setDirection(0);
    }
    prevIdxRef.current = idx;
    prevPathRef.current = pathname;
  }, [idx, pathname]);


  // Live drag state
  const pageRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const locked = useRef<"x" | "y" | null>(null);
  const widthRef = useRef(0);

  const setTransform = (dx: number, withTransition = false) => {
    const el = pageRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease"
      : "none";
    const w = widthRef.current || el.offsetWidth || 1;
    const ratio = Math.max(-1, Math.min(1, dx / w));
    const opacity = 1 - Math.abs(ratio) * 0.35;
    el.style.transform = `translate3d(${dx}px, 0, 0)`;
    el.style.opacity = String(opacity);
  };

  const reset = (withTransition = true) => {
    const el = pageRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? "transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease"
      : "none";
    el.style.transform = "";
    el.style.opacity = "";
  };

  const flyOut = (dir: 1 | -1, onDone: () => void) => {
    const el = pageRef.current;
    if (!el) return onDone();
    const w = widthRef.current || el.offsetWidth || 0;
    el.style.transition = "transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease";
    el.style.transform = `translate3d(${-dir * w * 0.35}px, 0, 0)`;
    el.style.opacity = "0";
    window.setTimeout(onDone, 200);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (idx < 0) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    dragging.current = false;
    locked.current = null;
    widthRef.current = pageRef.current?.offsetWidth ?? window.innerWidth;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null || idx < 0) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      locked.current = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
    }
    if (locked.current !== "x") return;
    dragging.current = true;
    // Resistance at edges where no neighbor exists
    let eff = dx;
    if ((dx > 0 && idx === 0) || (dx < 0 && idx === TABS.length - 1)) {
      eff = dx * 0.25;
    }
    setTransform(eff);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) {
      return;
    }
    const t = e.changedTouches[0];
    const dx = (t?.clientX ?? startX.current) - startX.current;
    const wasDragging = dragging.current;
    startX.current = null;
    startY.current = null;
    dragging.current = false;
    if (idx < 0 || locked.current !== "x" || !wasDragging) {
      locked.current = null;
      return;
    }
    locked.current = null;
    const w = widthRef.current || 1;
    const threshold = Math.min(80, w * 0.18);
    if (dx <= -threshold && idx < TABS.length - 1) {
      flyOut(1, () => navigate({ to: TABS[idx + 1] }));
    } else if (dx >= threshold && idx > 0) {
      flyOut(-1, () => navigate({ to: TABS[idx - 1] }));
    } else {
      reset(true);
    }
  };

  // Clear inline styles whenever the route actually changes so the entrance animation can play
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "";
    el.style.opacity = "";
  }, [pathname]);

  const animClass =
    direction === 1
      ? "page-slide-in-right"
      : direction === -1
        ? "page-slide-in-left"
        : "page-transition";

  return (
    <div
      className="min-h-dvh overflow-x-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        startX.current = null;
        startY.current = null;
        locked.current = null;
        if (dragging.current) reset(true);
        dragging.current = false;
      }}
    >
      <div key={pathname} ref={pageRef} className={animClass} style={{ willChange: "transform, opacity" }}>
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
