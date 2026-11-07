import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Ban,
  Check,
  FileText,
  Landmark,
  Mail,
  Mic,
  Pin,
  RotateCw,
  Scissors,
  Send,
  X,
  ArrowLeftRight,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PreviewView, ReadAloud } from "@/components/fola/ui";
import { useActionDecision } from "@/components/fola/useActionDecision";
import { api, qk } from "@/lib/api";
import { money, perPeriod, time } from "@/lib/format";
import { shouldAutoRead, speak } from "@/lib/settings";
import type { FolaAction, ProfileUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { notification_id?: string | undefined; text?: string | undefined } => ({
    notification_id: typeof s["notification_id"] === "string" ? s["notification_id"] : undefined,
    text: typeof s["text"] === "string" ? s["text"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat with Fola" },
      {
        name: "description",
        content: "Type to Fola, your money coach. Fola only acts when you say yes.",
      },
      { property: "og:title", content: "Chat with Fola" },
      {
        property: "og:description",
        content: "Type to Fola, your money coach. Fola only acts when you say yes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type ActionOutcome = { kind: "done"; message: string; report_id: string } | { kind: "declined" };
interface Msg {
  id: string;
  role: "user" | "fola";
  text: string;
  at: string;
  action?: FolaAction | null | undefined;
  outcome?: ActionOutcome | undefined;
  updates?: ProfileUpdate[] | undefined;
  error?: boolean | undefined;
}

const ICON: Record<FolaAction["type"], LucideIcon> = {
  send_email: Mail,
  fill_form: FileText,
  block_merchant: Ban,
  cancel_subscription: Scissors,
  submit_claim: Landmark,
  set_reminder: Bell,
  top_up_transfer: ArrowLeftRight,
};
const STARTERS = ["Check my subscriptions", "Am I missing any help?", "Will I be OK this month?"];
const SS_KEY = "fola-conversation-id";

let msgSeq = 0;
const mid = () => `m${++msgSeq}`;

function ChatPage() {
  const { notification_id, text } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: api.getProfile });
  const { data: notifications = [] } = useQuery({
    queryKey: qk.notifications,
    queryFn: api.getNotifications,
  });
  const [contextId, setContextId] = useState<string | undefined>(notification_id);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(text ?? "");
  const [typing, setTyping] = useState(false);
  const [quick, setQuick] = useState<string[]>([]);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [cid, setCid] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { approve, decline } = useActionDecision();

  const contextNote = notifications.find((n) => n.id === contextId);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(SS_KEY);
      if (saved) setCid(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (text) setInput(text);
  }, [text]);
  useEffect(() => {
    if (!text && contextNote?.suggested_prompt && !input && messages.length === 0)
      setInput(contextNote.suggested_prompt);
  }, [contextNote]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 4 * 30 + 24)}px`;
  }, [input]);

  const addFola = (m: Omit<Msg, "id" | "role" | "at">) => {
    setMessages((ms) => [...ms, { id: mid(), role: "fola", at: new Date().toISOString(), ...m }]);
    if (!m.error && shouldAutoRead(profile?.user.accessibility)) speak(m.text);
  };

  async function send(raw: string, echo = true) {
    const message = raw.trim();
    if (!message || typing) return;
    setQuick([]);
    setLastFailed(null);
    if (echo)
      setMessages((ms) => [
        ...ms,
        { id: mid(), role: "user", text: message, at: new Date().toISOString() },
      ]);
    setInput("");
    setTyping(true);
    try {
      const r = await api.chat({
        message,
        conversation_id: cid,
        notification_id: contextId,
        notification_title: contextNote?.title,
      });
      setCid(r.conversation_id);
      try {
        window.sessionStorage.setItem(SS_KEY, r.conversation_id);
      } catch {
        /* ignore */
      }
      addFola({ text: r.reply, action: r.pending_action ?? null, updates: r.profile_updates });
      setQuick(r.quick_replies ?? []);
      if (r.profile_updates?.length) qc.invalidateQueries({ queryKey: qk.profile });
    } catch {
      addFola({ text: "Sorry, I couldn't connect. Try again?", error: true });
      setLastFailed(message);
    } finally {
      setTyping(false);
    }
  }

  function decide(msg: Msg, yes: boolean) {
    const a = msg.action!;
    const quote = yes ? "Yes, do it" : "No";
    setMessages((ms) => [
      ...ms,
      { id: mid(), role: "user", text: yes ? "Yes, do it" : "No", at: new Date().toISOString() },
    ]);
    const setOutcome = (o: ActionOutcome) =>
      setMessages((ms) => ms.map((m) => (m.id === msg.id ? { ...m, outcome: o } : m)));
    if (yes) {
      approve.mutate(
        { id: a.id, quote },
        {
          onSuccess: (r) => {
            setOutcome({ kind: "done", message: r.result.message, report_id: r.report_id });
            if (r.result.follow_up) {
              addFola({ text: r.result.follow_up.reply });
              setQuick(r.result.follow_up.quick_replies ?? []);
            }
          },
          onError: () =>
            addFola({
              text: "Sorry, I couldn't do that just now. Nothing was sent. Try again?",
              error: true,
            }),
        },
      );
    } else {
      decline.mutate(a.id, { onSuccess: () => setOutcome({ kind: "declined" }) });
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
      <header className="bleed-flush sticky top-0 z-30 flex items-center gap-2 bg-blind py-2 text-blind-foreground">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? router.history.back() : navigate({ to: "/" })
          }
          className="btn min-w-12 px-0 hover:bg-white/10"
          aria-label="Go back"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </button>
        <div className="flex-1">
          <p className="font-display text-xl font-black leading-tight text-signal">Fola</p>
          <p className="text-sm text-white/75">Your money coach</p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/", search: { voice: true } })}
          className="flex size-12 items-center justify-center rounded-full bg-signal text-signal-foreground"
          aria-label="Switch to voice"
        >
          <Mic className="size-6" aria-hidden />
        </button>
      </header>

      {contextNote && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-2">
          <p className="flex-1 font-semibold">About: {contextNote.title}</p>
          <button
            type="button"
            onClick={() => setContextId(undefined)}
            className="btn btn-ghost min-w-12 px-0"
            aria-label="Stop talking about this"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex-1 space-y-4 px-4 py-4" aria-live="polite">
        {messages.length === 0 && !typing && (
          <div className="pt-10 text-center">
            <Avatar big />
            <p className="mt-4 font-display text-2xl font-extrabold">
              Hi {profile?.user.first_name ?? "there"}. What can I help with?
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  onClick={() => send(s)}
                  aria-label={`Ask: ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex flex-col items-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">
                {m.text}
              </div>
              <span className="mt-1 text-xs text-muted-foreground">{time(m.at)}</span>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <Avatar />
              <div className="min-w-0 flex-1">
                <div className="card-fola max-w-[95%] p-3">
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{time(m.at)}</span>
                    {!m.error && <ReadAloud text={m.text} compact />}
                  </div>
                </div>
                {m.error && lastFailed && (
                  <button
                    type="button"
                    className="chip mt-2"
                    onClick={() => send(lastFailed, false)}
                    aria-label="Retry sending"
                  >
                    <RotateCw className="mr-1.5 size-4" aria-hidden />
                    Retry
                  </button>
                )}
                {m.updates?.map((u) => (
                  <Link
                    key={u.key + String(u.confirmed)}
                    to="/profile"
                    className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
                    aria-label="See what Fola saved to your profile"
                  >
                    <Pin className="size-4 shrink-0" aria-hidden /> Saved to your profile: {u.label}
                    : {u.value} {u.confirmed ? "" : "(to check)"}
                  </Link>
                ))}
                {m.action && (
                  <ActionCard
                    msg={m}
                    onDecide={decide}
                    busy={approve.isPending || decline.isPending}
                  />
                )}
              </div>
            </div>
          ),
        )}

        {typing && (
          <div className="flex gap-2" aria-label="Fola is typing">
            <Avatar />
            <div className="card-fola flex items-center gap-1.5 px-4 py-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot size-2.5 rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 border-t bg-background px-3 pb-4 pt-2">
        {quick.length > 0 && (
          <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => send(q)}
                aria-label={`Reply: ${q}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <button
            type="button"
            onClick={() => navigate({ to: "/", search: { voice: true } })}
            className="btn btn-ghost min-w-12 px-0"
            aria-label="Talk instead"
          >
            <Mic className="size-6" aria-hidden />
          </button>
          <label htmlFor="chat-input" className="sr-only">
            Message Fola
          </label>
          <textarea
            id="chat-input"
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Type a message…"
            aria-label="Message Fola"
            className="min-h-12 flex-1 resize-none rounded-3xl border-2 border-input bg-card px-4 py-2.5 text-lg leading-[30px] focus:border-foreground focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

function Avatar({ big }: { big?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-[3px] border-foreground bg-signal font-display font-black text-signal-foreground",
        big ? "mx-auto size-16 text-3xl" : "size-8 text-base",
      )}
    >
      F
    </span>
  );
}

function ActionCard({
  msg,
  onDecide,
  busy,
}: {
  msg: Msg;
  onDecide: (m: Msg, yes: boolean) => void;
  busy: boolean;
}) {
  const a = msg.action!;
  const Icon = ICON[a.type] ?? FileText;
  if (msg.outcome?.kind === "done") {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-xl bg-success-soft p-3 font-semibold text-success">
        <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>
          Done: {msg.outcome.message} ·{" "}
          <Link to="/reports/$id" params={{ id: msg.outcome.report_id }} className="underline">
            Saved to your journey log
          </Link>
        </span>
      </div>
    );
  }
  if (msg.outcome?.kind === "declined") {
    return (
      <div className="mt-2 rounded-xl bg-muted p-3 font-semibold">Not done. Nothing was sent.</div>
    );
  }
  return (
    <div className="card-fola mt-2 overflow-hidden">
      <p className="bg-blind px-4 py-2 font-display font-extrabold text-signal">
        Fola needs your yes
      </p>
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft"
            aria-hidden
          >
            <Icon className="size-5" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-lg font-bold leading-snug">{a.title}</p>
            {a.summary && <p className="text-base text-muted-foreground">{a.summary}</p>}
            {a.impact && (
              <p className="num mt-1 text-success">
                +{money(a.impact.amount)}
                <span className="font-sans font-bold">
                  {perPeriod(a.impact.period) === "/mo" ? " a month" : perPeriod(a.impact.period)}
                </span>
              </p>
            )}
          </div>
        </div>
        <PreviewView preview={a.preview} />
        {a.pdf_url && (
          <a
            href={a.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            aria-label="View PDF of this form"
          >
            View PDF
          </a>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn btn-success min-h-14 text-lg"
            disabled={busy}
            onClick={() => onDecide(msg, true)}
            aria-label={`Yes, do it: ${a.title}`}
          >
            <Check className="size-5" aria-hidden /> Yes, do it
          </button>
          <button
            className="btn btn-outline min-h-14 text-lg"
            disabled={busy}
            onClick={() => onDecide(msg, false)}
            aria-label={`No, don't ${a.title}`}
          >
            <X className="size-5" aria-hidden /> No
          </button>
        </div>
      </div>
    </div>
  );
}
