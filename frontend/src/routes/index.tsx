import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Captions, CaptionsOff, Check, Keyboard, Loader2, Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RouteAhead,
  RouteNext,
  headlineStop,
  monthName,
  shortfallPrompt,
  stopDay,
} from "@/components/fola/RouteAhead";
import { SpottedList } from "@/components/fola/SpottedList";
import { PreviewView, Screen } from "@/components/fola/ui";
import { useActionDecision } from "@/components/fola/useActionDecision";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFolaVoice } from "@/hooks/useFolaVoice";
import { api, qk } from "@/lib/api";
import { money, perPeriod } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FolaAction } from "@/lib/types";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { voice?: boolean | undefined } => ({
    voice: s["voice"] === true || s["voice"] === "1" || s["voice"] === 1 ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fola · Home" },
      {
        name: "description",
        content:
          "Talk to Fola, see where your money is heading, and the help you could be missing.",
      },
      { property: "og:title", content: "Fola · Your money coach" },
      {
        property: "og:description",
        content:
          "Talk to Fola, see where your money is heading, and the help you could be missing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { voice } = Route.useSearch();
  const navigate = useNavigate();
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: api.getProfile });
  const { data: forecast } = useQuery({ queryKey: qk.forecast, queryFn: api.getForecast });
  const { data: upcoming = [] } = useQuery({ queryKey: qk.upcoming, queryFn: api.getUpcoming });
  const [showCaptions, setShowCaptions] = useState(true);
  const firstName = profile?.user.first_name;
  const v = useFolaVoice(firstName);
  const active = v.status !== "idle";

  useEffect(() => {
    if (voice) {
      void v.start();
      navigate({ to: "/", search: {}, replace: true });
    }
  }, [voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = forecast?.months[0];
  const stop = headlineStop(upcoming);

  return (
    <Screen>
      {/* Route blind */}
      <header className="bleed bg-blind pb-[4.5rem] pt-[max(1.25rem,env(safe-area-inset-top))] text-blind-foreground">
        <div className="flex items-center justify-between gap-3">
          <ResetMark />
          {profile && (
            <Link
              to="/profile"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-bold hover:bg-white/10"
              aria-label={`${firstName}, net worth ${money(profile.net_worth.current)}. See your profile`}
            >
              {firstName} · Net worth{" "}
              <span className="num text-base">{money(profile.net_worth.current, true)}</span>
            </Link>
          )}
        </div>

        {stop ? (
          <>
            <h1 className="mt-6 text-[2.1rem] leading-[1.05] text-signal">
              Next stop: {stop.label}
              <span className="mt-1 block text-xl text-white">{stopDay(stop.date)}</span>
            </h1>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="border-l-2 border-white/30 pl-3">
                <dt className="text-sm font-bold text-white/75">
                  {stop.amount > 0 ? "Coming in" : "Going out"}
                </dt>
                <dd className="num text-2xl">{money(Math.abs(stop.amount))}</dd>
              </div>
              {stop.note && (
                <div
                  className={cn(
                    "border-l-2 pl-3",
                    stop.tone === "risk" ? "border-destructive" : "border-signal",
                  )}
                >
                  <dt className="text-sm font-bold text-signal">Fola says</dt>
                  <dd className="font-bold leading-snug">
                    {stop.shortfall ? (
                      <Link
                        to="/chat"
                        search={{ text: shortfallPrompt(stop) }}
                        className="underline decoration-destructive decoration-2 underline-offset-4"
                      >
                        {stop.note}. Sort it
                      </Link>
                    ) : stop.notification_id ? (
                      <Link
                        to="/chat"
                        search={{ notification_id: stop.notification_id }}
                        className="underline decoration-signal decoration-2 underline-offset-4"
                      >
                        {stop.note}
                      </Link>
                    ) : (
                      stop.note
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <h1 className="mt-6 text-[2.1rem] leading-[1.05] text-signal">
            Next stop: {next ? monthName(next.month) : "…"}
          </h1>
        )}
        {!stop && next && (
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="border-l-2 border-white/30 pl-3">
              <dt className="text-sm font-bold text-white/75">As things are</dt>
              <dd className="num text-2xl">{money(next.baseline, true)}</dd>
            </div>
            <div className="border-l-2 border-signal pl-3">
              <dt className="text-sm font-bold text-signal">With Fola</dt>
              <dd className="num text-2xl">{money(next.with_fola, true)}</dd>
            </div>
          </dl>
        )}
      </header>

      {/* Talk */}
      <section aria-label="Talk to Fola" className="-mt-16 flex flex-col items-center">
        <div className="relative size-[152px]">
          {(v.status === "listening" || v.status === "speaking") && (
            <>
              <span className={cn("talk-ring", v.status === "speaking" && "fast")} aria-hidden />
              <span
                className={cn("talk-ring delay", v.status === "speaking" && "fast")}
                aria-hidden
              />
            </>
          )}
          <button
            type="button"
            onClick={() => (active ? v.stop() : void v.start())}
            aria-label={active ? "Stop talking to Fola" : "Talk to Fola"}
            aria-pressed={active}
            className={cn(
              "relative flex size-full items-center justify-center rounded-full border-[6px] border-background shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5)] transition-colors",
              active
                ? "bg-foreground text-signal"
                : "bg-signal text-signal-foreground hover:brightness-95",
            )}
          >
            {v.status === "connecting" ? (
              <Loader2 className="size-14 animate-spin" aria-hidden />
            ) : active ? (
              <Square className="size-12 fill-current" aria-hidden />
            ) : (
              <Mic className="size-16" strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>
        <p className="mt-3 font-display text-2xl font-extrabold" aria-live="polite">
          {v.status === "idle"
            ? "Talk to Fola"
            : v.status === "connecting"
              ? "Connecting…"
              : v.status === "speaking"
                ? "Fola is talking"
                : "Listening… tap to stop"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">Fola only acts when you say yes.</p>
        {active && (
          <div className="mt-3 w-full max-w-sm text-center">
            {showCaptions && (
              <div aria-live="polite" className="min-h-28">
                {v.userLine && (
                  <p className="mb-2 text-base text-muted-foreground">You: {v.userLine}</p>
                )}
                {v.captions.slice(-2).map((c, i, arr) => (
                  <p
                    key={c.id}
                    className={cn(
                      "caption-in text-xl font-bold leading-[1.4] transition-opacity duration-300",
                      i < arr.length - 1 && "opacity-40",
                    )}
                  >
                    {c.text}
                  </p>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowCaptions((x) => !x)}
              aria-pressed={!showCaptions}
              className="btn btn-ghost mt-1 min-h-10 px-3 text-sm"
            >
              {showCaptions ? (
                <CaptionsOff className="size-4" aria-hidden />
              ) : (
                <Captions className="size-4" aria-hidden />
              )}
              {showCaptions ? "Hide captions" : "Show captions"}
            </button>
          </div>
        )}
        {v.error && (
          <p role="alert" className="mt-2 max-w-sm text-center font-bold text-destructive">
            {v.error}
          </p>
        )}
        <Link
          to="/chat"
          className="btn btn-outline mt-3 min-h-11 px-5 text-base"
          aria-label="Type instead of talking"
        >
          <Keyboard className="size-5" aria-hidden /> Type instead
        </Link>
      </section>

      <div className="mt-6 space-y-10">
        <RouteNext />
        <SpottedList accessibility={profile?.user.accessibility} />
        <RouteAhead />
      </div>

      <VoiceApprovals active={active} />
    </Screen>
  );
}

/** Wordmark. Long-press (1.5s) resets the demo between judges. */
function ResetMark() {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirm, setConfirm] = useState(false);
  const startPress = () => {
    timer.current = setTimeout(() => setConfirm(true), 1500);
  };
  const endPress = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const reset = async () => {
    await api.reset();
    setConfirm(false);
    await qc.invalidateQueries();
    toast.success("Demo reset");
  };
  return (
    <>
      <span
        className="select-none font-display text-2xl font-black tracking-tight text-signal"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        Fola
      </span>
      {confirm && (
        <div
          role="dialog"
          aria-label="Reset demo"
          className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-xl bg-card p-4 text-card-foreground shadow-soft"
        >
          <p className="font-bold">Reset the demo?</p>
          <p className="text-sm text-muted-foreground">
            Clears actions, reports and what Fola learned.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={reset}>
              Reset
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function VoiceApprovals({ active }: { active: boolean }) {
  const { data = [] } = useQuery({
    queryKey: qk.pending,
    queryFn: api.getPendingActions,
    enabled: active,
    refetchInterval: active ? 3000 : false,
  });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const action: FolaAction | undefined = active
    ? data.find((a) => !dismissed.includes(a.id))
    : undefined;
  const { approve, decline } = useActionDecision();
  const navigate = useNavigate();

  const onYes = (a: FolaAction) =>
    approve.mutate(
      { id: a.id, quote: "Yes, do it" },
      {
        onSuccess: (r) => {
          setDismissed((d) => [...d, a.id]);
          toast.success("Prepared and logged in your journey log", {
            description: r.result.message,
            action: {
              label: "See it",
              onClick: () => navigate({ to: "/reports/$id", params: { id: r.report_id } }),
            },
          });
        },
      },
    );
  const onNo = (a: FolaAction) =>
    decline.mutate(a.id, {
      onSuccess: () => {
        setDismissed((d) => [...d, a.id]);
        toast("Not done. Nothing was sent.");
      },
    });

  return (
    <Sheet
      open={!!action}
      onOpenChange={(o) => !o && action && setDismissed((d) => [...d, action.id])}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] max-w-[480px] overflow-y-auto rounded-none border-t-8 border-t-signal"
      >
        {action && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-2xl font-extrabold">
                {action.title}
              </SheetTitle>
              <SheetDescription className="text-base">
                {action.summary ?? "Fola needs your yes before doing this."}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-6">
              {action.impact && (
                <p className="num text-xl text-success">
                  +{money(action.impact.amount)}
                  <span className="font-sans text-base font-bold">
                    {perPeriod(action.impact.period) === "/mo"
                      ? " a month"
                      : perPeriod(action.impact.period)}
                  </span>
                </p>
              )}
              <PreviewView preview={action.preview} />
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="btn btn-success min-h-14 text-lg"
                  disabled={approve.isPending}
                  onClick={() => onYes(action)}
                  aria-label={`Yes, do it: ${action.title}`}
                >
                  <Check className="size-5" aria-hidden /> Yes, do it
                </button>
                <button
                  className="btn btn-outline min-h-14 text-lg"
                  disabled={decline.isPending}
                  onClick={() => onNo(action)}
                  aria-label={`No, don't ${action.title}`}
                >
                  <X className="size-5" aria-hidden /> No
                </button>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Nothing happens unless you say yes.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
