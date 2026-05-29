"use client";

import { useEffect, useRef, useState } from "react";

import { createBrowserSupabase } from "@/lib/supabase";

import { sendMessage } from "./actions";

export type SupportMessage = {
  id: string;
  body: string;
  created_at: string;
  from_admin: boolean;
  agent: "user" | "aria" | "admin";
  parent_id: string | null;
};

type Props = {
  userId: string;
  initialRootId: string | null;
  initialStatus: string | null;
  initialMessages: SupportMessage[];
};

const ARIA_THINKING_TIMEOUT_MS = 30_000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SupportChat({ userId, initialRootId, initialStatus, initialMessages }: Props) {
  const [rootId, setRootId] = useState<string | null>(initialRootId);
  const [rootStatus, setRootStatus] = useState<string | null>(initialStatus);
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ariaThinking, setAriaThinking] = useState(false);
  const thinkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to the user's root thread once we have a rootId. Same
  // pattern as driver-app/app/support.tsx: INSERT on children for new
  // messages (admin / ARIA replies + our own confirmations); UPDATE on
  // the root for status flips (status='escalated' when ARIA hands off).
  useEffect(() => {
    if (!rootId) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`support-restaurant-${rootId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets", filter: `parent_id=eq.${rootId}` },
        (payload) => {
          const m = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.from_admin) {
            // Either ARIA or a human just replied — drop the typing
            // indicator immediately.
            clearThinking();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${rootId}` },
        (payload) => {
          const r = payload.new as { status?: string };
          if (r.status) setRootStatus(r.status);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rootId]);

  // Autoscroll the message list to the latest bubble whenever messages
  // grow or the thinking indicator appears/disappears.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, ariaThinking]);

  function startThinking() {
    setAriaThinking(true);
    if (thinkingTimer.current) clearTimeout(thinkingTimer.current);
    thinkingTimer.current = setTimeout(() => setAriaThinking(false), ARIA_THINKING_TIMEOUT_MS);
  }
  function clearThinking() {
    setAriaThinking(false);
    if (thinkingTimer.current) {
      clearTimeout(thinkingTimer.current);
      thinkingTimer.current = null;
    }
  }
  // Cleanup on unmount.
  useEffect(() => () => clearThinking(), []);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendMessage(text);
      setRootId(result.rootId);

      // Optimistic user bubble. The Realtime INSERT will arrive shortly
      // and our dedupe on id will keep it from doubling up.
      const optimistic: SupportMessage = {
        id: result.messageId,
        body: text,
        created_at: new Date().toISOString(),
        from_admin: false,
        agent: "user",
        parent_id: result.created_root ? null : result.rootId,
      };
      setMessages((prev) => (prev.some((x) => x.id === optimistic.id) ? prev : [...prev, optimistic]));
      setInput("");
      if (rootStatus !== "escalated") startThinking();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  const escalated = rootStatus === "escalated";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
      {escalated && (
        <div className="px-4 py-2 border-b border-emerald-100 bg-emerald-50 text-sm text-emerald-800 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Connected to our team — a human will reply shortly.
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} userId={userId} />)
        )}
        {ariaThinking && <TypingBubble />}
      </div>

      <form onSubmit={onSend} className="border-t border-gray-200 bg-white p-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-2">
            {error}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend(e as unknown as React.FormEvent);
              }
            }}
            placeholder={escalated ? "Reply to our team…" : "Type your message…"}
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" stroke="none">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
        <div className="text-[11px] text-gray-400 mt-1 text-right">Enter sends · Shift+Enter for newline</div>
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-2">
      <div className="text-base font-semibold text-gray-700">How can we help?</div>
      <div className="text-sm text-gray-500 max-w-xs">
        Type a message below. ARIA replies first — if it can't help, our team takes over.
      </div>
    </div>
  );
}

function Bubble({ message, userId: _userId }: { message: SupportMessage; userId: string }) {
  const fromAdmin = !!message.from_admin;
  const isAria = message.agent === "aria";
  return (
    <div className={`flex ${fromAdmin ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[82%]">
        {fromAdmin && (
          <div className="flex items-center gap-1.5 mb-1 ml-1">
            {isAria ? (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600">ARIA</span>
              </>
            ) : (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Support team</span>
              </>
            )}
          </div>
        )}
        <div
          className={[
            "rounded-2xl px-3.5 py-2.5 text-sm",
            fromAdmin
              ? "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
              : "bg-brand text-white rounded-br-md",
          ].join(" ")}
        >
          <div className="whitespace-pre-wrap break-words">{message.body}</div>
          <div className={`text-[10px] mt-1 ${fromAdmin ? "text-gray-400" : "text-white/70"} ${fromAdmin ? "text-left" : "text-right"}`}>
            {formatTime(message.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[60%]">
        <div className="flex items-center gap-1.5 mb-1 ml-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600">ARIA</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-gray-500 flex items-center gap-2">
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "0.3s" }} />
          </span>
          typing…
        </div>
      </div>
    </div>
  );
}
