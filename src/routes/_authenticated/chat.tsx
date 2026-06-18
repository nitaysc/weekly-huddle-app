import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus, MessageCircle, Trash2 } from "lucide-react";
import { listThreads, createThread, deleteThread } from "@/lib/chat-threads.functions";
import { useActiveCrew } from "@/hooks/use-crew";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Coach AI" },
      { name: "description", content: "Chat with Coach, the crew's AI planner." },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCrew } = useActiveCrew();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);

  const threadsQ = useQuery({ queryKey: ["chat-threads"], queryFn: () => list() });

  const newThread = useMutation({
    mutationFn: async () => create({ data: { crewId: activeCrew?.id ?? null } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-threads"] }),
  });

  // If no threads and not loading, auto-create one
  const threads = threadsQ.data ?? [];
  useEffect(() => {
    if (!threadsQ.isLoading && threads.length === 0 && !newThread.isPending) {
      newThread.mutate();
    }
  }, [threadsQ.isLoading, threads.length, newThread]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-[440px] px-5 pt-6 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h1 className="text-xl font-semibold">Coach</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCrew ? `Planning for ${activeCrew.name}` : "Your AI crew planner"}
            </p>
          </div>
          <button
            onClick={() => newThread.mutate()}
            disabled={newThread.isPending}
            className="rounded-full bg-primary text-primary-foreground p-2 disabled:opacity-50"
            aria-label="New chat"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[440px] px-5 py-4 space-y-2">
        {threadsQ.isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent/40 transition-colors"
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="size-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(t.updated_at).toLocaleString()}
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm("Delete this chat?")) removeMutation.mutate(t.id);
                }}
                className="p-2 text-muted-foreground hover:text-destructive"
                aria-label="Delete chat"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </main>
      <BottomNav />
    </div>
  );
}
