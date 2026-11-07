import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronRight, Landmark, PoundSterling, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, markSeen, qk } from "@/lib/api";
import { longDate, money, perPeriod } from "@/lib/format";
import { shouldAutoRead, speak } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { FolaNotification } from "@/lib/types";

export function SpottedList({ accessibility }: { accessibility?: string[] | undefined }) {
  const { data: reports = [] } = useQuery({ queryKey: qk.reports, queryFn: api.getReports });
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: qk.notifications, queryFn: api.getNotifications });
  const readOnce = useRef(false);
  const open = data.filter((n) => n.status !== "resolved");
  const done = data.filter((n) => n.status === "resolved");
  const total = open.reduce(
    (a, n) =>
      a + (n.money ? (n.money.period === "year" ? n.money.amount / 12 : n.money.amount) : 0),
    0,
  );

  useEffect(() => {
    if (readOnce.current || !open[0] || !accessibility) return;
    readOnce.current = true;
    if (shouldAutoRead(accessibility)) speak(`${open[0].title}. ${open[0].body}`);
  }, [open, accessibility]);

  return (
    <section aria-labelledby="spotted-h">
      <div className="flex items-end justify-between gap-3">
        <h2 id="spotted-h" className="text-2xl">
          {isLoading
            ? "Checking your money…"
            : open.length
              ? `Fola spotted ${open.length} ${open.length === 1 ? "thing" : "things"}`
              : "Nothing new to sort"}
        </h2>
        {total > 0 && (
          <p className="num shrink-0 text-right text-success">
            +{money(total, true)}
            <span className="block font-sans text-sm font-bold text-muted-foreground">a month</span>
          </p>
        )}
      </div>

      {isError && (
        <div className="card-fola mt-3 p-4">
          <p>Fola couldn't load what it spotted.</p>
          <button className="btn btn-outline mt-2" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {isLoading && <div className="card-fola mt-3 h-64 animate-pulse" aria-label="Loading" />}

      {open.length > 0 && (
        <ul className="card-fola mt-3 divide-y overflow-hidden">
          {open.map((n) => (
            <SpottedRow key={n.id} n={n} />
          ))}
        </ul>
      )}

      {reports.length > 0 && (
        <Link
          to="/reports"
          className="mt-3 flex min-h-12 items-center gap-3 rounded-xl bg-success-soft px-4 py-2 font-bold text-success hover:brightness-95"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">
            <Check className="size-4" aria-hidden />
          </span>
          <span className="flex-1">{reports.length} sorted already. See your journey log</span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      {done.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Already sorted">
          {done.map((n) => (
            <li
              key={n.id}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-success-soft px-4 py-2 font-bold text-success"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">
                <Check className="size-4" aria-hidden />
              </span>
              <span>
                Sorted: <span className="font-semibold">{n.title}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SpottedRow({ n }: { n: FolaNotification }) {
  const [open, setOpen] = useState(false);
  const Icon = n.type === "financial" ? PoundSterling : Landmark;
  const gain = n.money?.direction === "gain";
  const toggle = () => {
    setOpen((v) => !v);
    markSeen(n.id);
  };

  return (
    <li className="p-4">
      <div className="flex gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border-[3px]",
            n.status === "new" ? "border-signal bg-primary-soft" : "border-border bg-card",
          )}
          aria-hidden
        >
          <Icon className="size-5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-lg font-bold leading-snug">
            {n.status === "new" && <span className="sr-only">New: </span>}
            {n.title}
          </h3>
          {n.money && (
            <p className="num mt-0.5 text-success">
              {gain ? "+" : "Save "}
              {money(n.money.amount)}
              <span className="font-sans font-bold">
                {perPeriod(n.money.period) === "/mo"
                  ? " a month"
                  : perPeriod(n.money.period) === "/yr"
                    ? " a year"
                    : ""}
              </span>
            </p>
          )}
          <p className={cn("mt-1 text-base text-muted-foreground", !open && "line-clamp-2")}>
            {n.body}
          </p>

          {open && (
            <div className="mt-3 space-y-3 rounded-lg bg-muted/70 p-3 text-base">
              {n.evidence && n.evidence.length > 0 && (
                <div>
                  <p className="font-bold">Payments Fola looked at</p>
                  <ul className="mt-1 space-y-1">
                    {n.evidence.map((e) => (
                      <li key={e.txn_id} className="flex justify-between gap-3">
                        <span>
                          {longDate(e.date)} · {e.merchant}
                        </span>
                        <span className="num">{money(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {n.questions && n.questions.length > 0 && (
                <div>
                  <p className="font-bold">Fola will need to ask</p>
                  <ul className="mt-1 list-disc pl-5">
                    {n.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {n.source_url && (
                <a
                  href={n.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-bold text-info underline"
                >
                  Read the rule on {new URL(n.source_url).hostname}
                </a>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-1">
            <Link
              to="/chat"
              search={{ notification_id: n.id, text: n.suggested_prompt }}
              onClick={() => markSeen(n.id)}
              className="btn btn-primary min-h-11 whitespace-nowrap px-5"
              aria-label={`Sort it with Fola: ${n.title}`}
            >
              Sort it
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="btn btn-ghost min-h-11 px-3"
            >
              {open ? "Less" : "Why?"}
              <ChevronDown
                className={cn("size-5 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={() => speak(`${n.title}. ${n.body}`)}
              className="btn btn-ghost ml-auto size-11 min-h-11 p-0"
              aria-label={`Read aloud: ${n.title}`}
            >
              <Volume2 className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
