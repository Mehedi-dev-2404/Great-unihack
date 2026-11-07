import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { api, qk, type UpcomingStop } from "@/lib/api";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const monthName = (ym: string, withYear = false) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });

export const stopDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** What to ask Fola when a bill may bounce. */
export const shortfallPrompt = (s: UpcomingStop) =>
  `My ${s.label.toLowerCase()} on ${stopDay(s.date)} may be ${money(s.shortfall ?? 0, true)} short. Help me sort it before it bounces.`;

/** Pick the stop the blind announces: the next one Fola has something to say about, else the next one. */
export function headlineStop(stops: UpcomingStop[]): UpcomingStop | undefined {
  const visible = stops.filter((s) => !s.hidden);
  return (
    visible.find((s) => s.shortfall) ??
    visible.find((s) => s.tone === "chance") ??
    visible.find((s) => s.tone === "risk") ??
    visible[0]
  );
}

/** The next few dated stops, predicted from payments that repeat. Sits in the first viewport. */
export function RouteNext() {
  const { data: stops = [], isLoading } = useQuery({
    queryKey: qk.upcoming,
    queryFn: api.getUpcoming,
  });
  if (isLoading)
    return (
      <section className="card-fola h-72 animate-pulse" aria-label="Loading the route ahead" />
    );
  if (stops.length === 0) return null;
  const visible = stops.filter((s) => !s.hidden);
  const short = visible.find((s) => s.shortfall);
  const shown = visible.slice(0, 5);
  if (short && !shown.includes(short)) shown.push(short);

  return (
    <section className="card-fola overflow-hidden" aria-labelledby="next-h">
      <div className="px-5 pt-4">
        <h2 id="next-h" className="text-2xl">
          Route ahead
        </h2>
      </div>
      <ol className="route-ol mt-2 px-5 pb-2">
        {shown.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2"
          >
            <span
              className="stop-dot"
              data-tone={s.tone === "risk" ? "risk" : s.tone === "chance" ? "chance" : undefined}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block font-display text-sm font-extrabold text-muted-foreground">
                {stopDay(s.date)}
              </span>
              <span className="block font-bold leading-snug">{s.label}</span>
              {s.note &&
                (s.notification_id ? (
                  <Link
                    to="/chat"
                    search={{ notification_id: s.notification_id }}
                    className={cn(
                      "mt-0.5 inline-block text-sm font-bold underline",
                      s.tone === "risk" ? "text-destructive" : "text-success",
                    )}
                  >
                    {s.note}
                  </Link>
                ) : s.shortfall ? (
                  <Link
                    to="/chat"
                    search={{ text: shortfallPrompt(s) }}
                    className="mt-0.5 inline-block text-sm font-bold text-destructive underline"
                  >
                    {s.note}
                  </Link>
                ) : (
                  <span className="text-sm font-bold">{s.note}</span>
                ))}
            </span>
            <span className={cn("num text-right text-lg", s.amount > 0 && "text-success")}>
              {s.amount > 0 ? "+" : ""}
              {money(s.amount)}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t px-5 py-2 text-sm text-muted-foreground">
        Worked out from the payments that repeat in your account.
      </p>
    </section>
  );
}

/**
 * Signature move: the next 12 months as two routes from today, read like a timetable:
 * "No change" (grey, thin) and "With Fola" (yellow).
 */
export function RouteAhead() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.forecast,
    queryFn: api.getForecast,
  });
  const [all, setAll] = useState(false);

  if (isError) {
    return (
      <section className="card-fola p-5" aria-labelledby="route-h">
        <h2 id="route-h" className="text-2xl">
          Your next 12 months
        </h2>
        <p className="mt-2">Fola couldn't work out your forecast just now.</p>
        <button className="btn btn-outline mt-3" onClick={() => refetch()}>
          Try again
        </button>
      </section>
    );
  }
  if (isLoading || !data) {
    return (
      <section className="card-fola h-96 animate-pulse" aria-label="Loading your next 12 months" />
    );
  }

  const months = data.months;
  const last = months[months.length - 1];
  const shown = all
    ? months
    : [...months.slice(0, 3), ...(last && months.length > 3 ? [last] : [])];
  const extra = last ? Math.round(last.with_fola - last.baseline) : 0;
  const question = `How do I get the extra ${money(extra, true)}?`;

  return (
    <section className="card-fola overflow-hidden" aria-labelledby="route-h">
      <div className="px-5 pt-5">
        <h2 id="route-h" className="text-2xl">
          Your next 12 months
        </h2>
        <p className="mt-1 text-muted-foreground">
          Two routes from today: no change, and with Fola.
        </p>
      </div>

      <div
        className="mt-4 grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-end gap-x-2 border-y-2 border-foreground px-5 py-2 text-sm font-bold"
        aria-hidden
      >
        <span>Month</span>
        <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
          <span className="h-1 w-3 rounded bg-chart-2" />
          No change
        </span>
        <span className="flex items-center justify-end gap-1.5">
          <span className="h-1.5 w-3 rounded bg-signal" />
          With Fola
        </span>
      </div>

      <ol className="route-ol route-two px-5 py-3" aria-label="Your money, month by month">
        <Stop tone="here" label="Today" baseline={data.current} fola={data.current} />
        {shown.map((m, i) => (
          <Stop
            key={m.month}
            label={monthName(m.month, i === shown.length - 1 && !all)}
            baseline={m.baseline}
            fola={m.with_fola}
            end={m === last}
          />
        ))}
      </ol>

      {months.length > 4 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="flex min-h-12 w-full items-center justify-center gap-2 border-t font-bold hover:bg-muted"
        >
          {all ? "Show fewer months" : `Show all ${months.length} months`}
          <ChevronDown
            className={cn("size-5 transition-transform", all && "rotate-180")}
            aria-hidden
          />
        </button>
      )}

      {extra > 0 && (
        <Link
          to="/chat"
          search={{ text: question }}
          className="block bg-primary-soft px-5 py-4 hover:bg-accent"
          aria-label={`Ask Fola: ${question}`}
        >
          <span className="num text-xl text-success">+{money(extra, true)}</span>
          <span className="font-bold">
            {" "}
            by {last ? monthName(last.month, true) : "next year"} if you say yes to Fola's
            suggestions.
          </span>
          <span className="mt-1 block font-bold underline">Show me how</span>
        </Link>
      )}

      {data.assumptions.length > 0 && (
        <details className="group border-t px-5 py-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-bold">
            How Fola worked this out
            <ChevronDown
              className="size-5 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-base text-muted-foreground">
            {data.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Stop({
  label,
  baseline,
  fola,
  tone,
  end,
}: {
  label: string;
  baseline: number;
  fola: number;
  tone?: "here" | undefined;
  end?: boolean | undefined;
}) {
  const risk = baseline < 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-x-2 py-2">
      <span className="flex min-w-0 items-center gap-3">
        <span className="stop-dot" data-tone={risk ? "risk" : tone} aria-hidden />
        <span
          className={cn("font-display font-extrabold leading-tight", end ? "text-lg" : "text-base")}
        >
          {label}
        </span>
      </span>
      <span
        className={cn(
          "num text-right text-base",
          risk ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <span className="sr-only">With no change: </span>
        {money(baseline, true)}
      </span>
      <span
        className={cn(
          "num text-right",
          end ? "text-xl" : "text-lg",
          fola > baseline && "text-success",
        )}
      >
        <span className="sr-only">With Fola: </span>
        {money(fola, true)}
      </span>
    </li>
  );
}
