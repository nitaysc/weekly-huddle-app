import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type ToolUIPart } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Paperclip, X } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { getThreadMessages } from "@/lib/chat-threads.functions";
import { useActiveCrew } from "@/hooks/use-crew";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [{ title: "Coach — Chat" }],
  }),
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCrew } = useActiveCrew();
  const getMessages = useServerFn(getThreadMessages);

  const initialQ = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: () => getMessages({ data: { threadId } }),
    staleTime: 0,
  });

  if (initialQ.isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <ChatThreadInner
      key={threadId}
      threadId={threadId}
      crewId={activeCrew?.id ?? null}
      initialMessages={(initialQ.data ?? []) as unknown as UIMessage[]}
      onBack={() => {
        qc.invalidateQueries({ queryKey: ["chat-threads"] });
        navigate({ to: "/chat" });
      }}
    />
  );
}

interface InnerProps {
  threadId: string;
  crewId: string | null;
  initialMessages: UIMessage[];
  onBack: () => void;
}

function ChatThreadInner({ threadId, crewId, initialMessages, onBack }: InnerProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<{ name: string; mediaType: string; dataUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setAccessToken(s?.access_token ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const transport = useChatTransport(accessToken, threadId, crewId);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  const focusComposer = () => {
    requestAnimationFrame(() => composerRef.current?.focus());
  };
  useEffect(() => {
    focusComposer();
  }, [threadId]);
  useEffect(() => {
    if (status === "ready") focusComposer();
  }, [status]);

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: typeof pendingFiles = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      next.push({ name: f.name, mediaType: f.type, dataUrl });
    }
    setPendingFiles((cur) => [...cur, ...next]);
  };

  const onSubmit = async () => {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;
    if (!accessToken) return;
    const parts: UIMessage["parts"] = [];
    for (const f of pendingFiles) {
      parts.push({ type: "file", url: f.dataUrl, mediaType: f.mediaType, filename: f.name });
    }
    if (text) parts.push({ type: "text", text });
    await sendMessage({ parts });
    setInput("");
    setPendingFiles([]);
    focusComposer();
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="shrink-0 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-[440px] px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-muted-foreground" aria-label="Back">
            <ArrowLeft className="size-5" />
          </button>
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight">Coach</div>
            <div className="text-[11px] text-muted-foreground">
              {crewId ? "Planning your crew week" : "AI workout coach"}
            </div>
          </div>
        </div>
      </header>

      <Conversation className="flex-1 mx-auto w-full max-w-[440px]">
        <ConversationContent className="px-4 pt-4 pb-2 gap-6">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<Sparkles className="size-8 text-primary" />}
              title="Plan your week with Coach"
              description="Try: “Make tomorrow a custom hangout day with pizza after” or “What's the plan this week?”"
            />
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return <MessageResponse key={i}>{part.text}</MessageResponse>;
                  }
                  if (part.type === "file" && (part.mediaType ?? "").startsWith("image/")) {
                    return (
                      <img
                        key={i}
                        src={part.url}
                        alt={part.filename ?? "attachment"}
                        className="rounded-lg max-h-64 object-cover"
                      />
                    );
                  }
                  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                    const tp = part as ToolUIPart;
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={tp.type} state={tp.state} />
                        <ToolContent>
                          <ToolInput input={tp.input} />
                          <ToolOutput output={tp.output} errorText={tp.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
          {error && (
            <div className="text-xs text-destructive px-2">
              {error.message || "Something went wrong. Try again."}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 mx-auto w-full max-w-[440px] px-3 pb-4 pt-2">
        {pendingFiles.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {pendingFiles.map((f, i) => (
              <div key={i} className="relative shrink-0">
                <img src={f.dataUrl} alt={f.name} className="size-16 rounded-lg object-cover border" />
                <button
                  onClick={() => setPendingFiles((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 size-5 rounded-full bg-background border border-border flex items-center justify-center"
                  aria-label="Remove"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <PromptInput
          onSubmit={(_, e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <PromptInputTextarea
            ref={composerRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Plan a day, add a custom session, ask for tips…"
            disabled={!accessToken}
          />
          <PromptInputFooter className="justify-between">
            <PromptInputButton
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              <Paperclip className="size-4" />
            </PromptInputButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <PromptInputSubmit status={status} disabled={!accessToken || (!input.trim() && pendingFiles.length === 0)} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function useChatTransport(accessToken: string | null, threadId: string, crewId: string | null) {
  return new DefaultChatTransport({
    api: "/api/chat",
    headers: (): Record<string, string> =>
      accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: () => ({ threadId, crewId }),
  });
}
