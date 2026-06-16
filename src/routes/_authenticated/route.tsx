import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function AuthenticatedLayout() {
  // Re-key on the top-level section so transitions fire on tab/route changes.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const key = pathname.split("/").slice(0, 3).join("/") || pathname;
  return (
    <div key={key} className="page-transition">
      <Outlet />
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
