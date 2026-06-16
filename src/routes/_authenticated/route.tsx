import { createFileRoute, Outlet, redirect, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABS = ["/", "/plan", "/crew", "/stats"] as const;

function tabIndex(pathname: string): number {
  if (pathname === "/") return 0;
  for (let i = 1; i < TABS.length; i++) {
    if (pathname.startsWith(TABS[i])) return i;
  }
  return -1;
}

function computeDirection(prevPath: string, nextPath: string): 1 | -1 | 0 {
  if (prevPath === nextPath) return 0;
  const isDetail = (p: string) => p.startsWith("/activity");
  if (isDetail(nextPath) && !isDetail(prevPath)) return 1;
  if (!isDetail(nextPath) && isDetail(prevPath)) return -1;
  const a = tabIndex(prevPath);
  const b = tabIndex(nextPath);
  if (a >= 0 && b >= 0 && a !== b) return b > a ? 1 : -1;
  return 0;
}

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const idx = tabIndex(pathname);

  // Direction computed synchronously so the very first render of the new key has the right anim class
  const prevPathRef = useRef(pathname);
  const direction = computeDirection(prevPathRef.current, pathname);
  useLayoutEffect(() => {
    prevPathRef.current = pathname;
  }, [pathname]);

  // Refs
  const pageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const locked = useRef<"x" | "y" | null>(null);
  const widthRef = useRef(0);
  // If set, the overlay snapshot will start at this dx (so swipe hand-off is seamless)
  const handoffDxRef = useRef<number | null>(null);

  const setTransform = (dx: number) => {
    const el = pageRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translate3d(${dx}px, 0, 0)`;
  };

  const reset = () => {
    const el = pageRef.current;
    if (!el) return;
    el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "translate3d(0, 0, 0)";
    window.setTimeout(() => {
      if (!pageRef.current) return;
      pageRef.current.style.transition = "";
      pageRef.current.style.transform = "";
    }, 340);
  };

  // Snapshot the currently-rendered page and animate it off-screen as an overlay,
  // so the incoming page can mount underneath without any flash.
  const snapshotAndFly = (dir: 1 | -1) => {
    const page = pageRef.current;
    const overlay = overlayRef.current;
    if (!page || !overlay) return;

    const clone = page.cloneNode(true) as HTMLElement;
    // Strip any running animations from the clone
    clone.className = "";
    clone.style.position = "absolute";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.right = "0";
    clone.style.minHeight = "100%";
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "10";
    clone.style.willChange = "transform, opacity, filter";
    clone.style.backgroundColor = "var(--color-background)";
    clone.style.transformOrigin = "center center";

    const startDx = handoffDxRef.current;
    handoffDxRef.current = null;
    clone.style.transition = "none";
    clone.style.transform = startDx != null
      ? `translate3d(${startDx}px, 0, 0)`
      : "translate3d(0, 0, 0)";
    clone.style.opacity = "1";
    clone.style.filter = "blur(0)";

    overlay.appendChild(clone);
    // Force layout flush, then animate out
    void clone.offsetWidth;
    clone.style.transition =
      "transform 440ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease-out, filter 360ms ease-out";
    const offset = dir === 1 ? "-22%" : "22%";
    clone.style.transform = `translate3d(${offset}, 0, 0) scale(0.96)`;
    clone.style.opacity = "0";
    clone.style.filter = "blur(8px)";

    window.setTimeout(() => {
      clone.remove();
    }, 480);
  };

  // Subscribe to router navigation so EVERY transition (tap or swipe) gets the snapshot overlay
  useEffect(() => {
    const unsub = router.subscribe("onBeforeNavigate", ({ fromLocation, toLocation }) => {
      if (!fromLocation || !toLocation) return;
      if (fromLocation.pathname === toLocation.pathname) return;
      const dir = computeDirection(fromLocation.pathname, toLocation.pathname);
      if (dir === 0) return;
      // Snapshot the current DOM BEFORE React swaps to the new route content
      snapshotAndFly(dir);
    });
    return unsub;
  }, [router]);

  const hasHorizontalScrollAncestor = (target: EventTarget | null): boolean => {
    let node = target as HTMLElement | null;
    while (node && node !== pageRef.current) {
      if (node.dataset?.noSwipe != null) return true;
      const style = window.getComputedStyle(node);
      const ox = style.overflowX;
      if ((ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 2) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (idx < 0) return;
    if (hasHorizontalScrollAncestor(e.target)) {
      startX.current = null;
      return;
    }
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
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      locked.current = Math.abs(dx) > Math.abs(dy) * 1.8 ? "x" : "y";
    }
    if (locked.current !== "x") return;
    dragging.current = true;
    let eff = dx;
    if ((dx > 0 && idx === 0) || (dx < 0 && idx === TABS.length - 1)) {
      eff = dx * 0.25;
    }
    setTransform(eff);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
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
      // Reset live transform, hand off current dx to the snapshot overlay
      handoffDxRef.current = dx;
      if (pageRef.current) {
        pageRef.current.style.transition = "none";
        pageRef.current.style.transform = "";
      }
      navigate({ to: TABS[idx + 1] });
    } else if (dx >= threshold && idx > 0) {
      handoffDxRef.current = dx;
      if (pageRef.current) {
        pageRef.current.style.transition = "none";
        pageRef.current.style.transform = "";
      }
      navigate({ to: TABS[idx - 1] });
    } else {
      reset();
    }
  };

  // Clear inline styles whenever the route changes so the entrance animation can play cleanly
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "";
    el.style.opacity = "";
    el.style.filter = "";
  }, [pathname]);

  const animClass =
    direction === 1
      ? "page-slide-in-right"
      : direction === -1
        ? "page-slide-in-left"
        : "page-transition";

  return (
    <div
      className="min-h-dvh overflow-x-hidden bg-background relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        startX.current = null;
        startY.current = null;
        locked.current = null;
        if (dragging.current) reset();
        dragging.current = false;
      }}
    >
      {/* Live page */}
      <div
        key={pathname}
        ref={pageRef}
        className={animClass}
        style={{ willChange: "transform, opacity, filter", backgroundColor: "var(--color-background)" }}
      >
        <Outlet />
      </div>
      {/* Overlay layer for outgoing page snapshots */}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 10 }}
      />
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
