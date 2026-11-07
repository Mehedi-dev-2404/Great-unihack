import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Download, Landmark, PoundSterling, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Chips,
  MoneyBadge,
  PreviewView,
  ReadAloud,
  Screen,
  StatusPill,
} from "@/components/fola/ui";
import { api, qk } from "@/lib/api";
import { dateTime, dayGroup, longDate, money, perPeriod, shortDate, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Report } from "@/lib/types";
import { reportRef, reportSummary } from "@/lib/reports";

const statusWord = (st: Report["status"]) =>
  st === "resolved"
    ? "Prepared and logged"
    : st === "in_progress"
      ? "In progress"
      : "Passed to an adviser";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "Your reports · Fola" },
      {
        name: "description",
        content:
          "Everything Fola has done for you, with dates. A record to show the council or an adviser.",
      },
      { property: "og:title", content: "Your reports · Fola" },
      { property: "og:description", content: "Everything Fola has done for you, with dates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

type Filter = "all" | "financial" | "demographic" | "in_progress";

function ReportsPage() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: qk.reports,
    queryFn: api.getReports,
  });
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: api.getProfile });
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const s = reportSummary(reports);

  const shown = useMemo(
    () =>
      reports.filter((r) => {
        if (filter === "in_progress" && r.status !== "in_progress") return false;
        if ((filter === "financial" || filter === "demographic") && r.category !== filter)
          return false;
        return !q || r.title.toLowerCase().includes(q.toLowerCase());
      }),
    [reports, filter, q],
  );
  const groups = useMemo(() => {
    const g: { label: string; items: Report[] }[] = [];
    for (const r of shown) {
      const label = dayGroup(r.updated_at ?? r.created_at);
      const last = g[g.length - 1];
      if (last?.label === label) last.items.push(r);
      else g.push({ label, items: [r] });
    }
    return g;
  }, [shown]);

  const newestId = reports[0]?.id;
  const summaryText = `You have saved or gained ${money(s.perYear)} a year so far. ${s.done} done, ${s.inProgress} in progress, ${s.referred} passed to an adviser.`;

  return (
    <Screen>
      <header className="no-print bleed bg-blind pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-blind-foreground">
        <h1 className="text-3xl text-signal">Journey log</h1>
        <p className="mt-1 text-white/80">
          Everything Fola has done for you, with dates. Show it to the council or an adviser.
        </p>
        <p className="mt-4 text-lg font-bold">
          <span className="num text-2xl text-signal">{money(s.perYear, true)}</span> a year back so
          far
        </p>
        <p className="mt-1 text-sm text-white/80">
          {s.done} prepared and logged · {s.inProgress} in progress · {s.referred} passed to an
          adviser
        </p>
      </header>

      <div className="no-print">
        <div className="mt-5 space-y-3">
          <Chips<Filter>
            label="Filter reports"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "financial", label: "Money" },
              { value: "demographic", label: "Help & benefits" },
              { value: "in_progress", label: "In progress" },
            ]}
          />
          <label className="flex min-h-12 items-center gap-2 rounded-full border-2 border-input bg-card px-4">
            <Search className="size-5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search reports</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reports"
              aria-label="Search reports"
              className="h-11 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
          </label>
        </div>

        {isLoading && <div className="card-fola mt-5 h-24 animate-pulse" />}
        {!isLoading && reports.length === 0 && (
          <p className="card-fola mt-6 p-6 text-center">
            Nothing here yet. When Fola helps you, it's saved here so you always have a record.
          </p>
        )}
        {!isLoading && reports.length > 0 && shown.length === 0 && (
          <p className="mt-6 text-muted-foreground">No reports match.</p>
        )}

        <div className="mt-5 space-y-5">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 font-display text-lg font-extrabold">{g.label}</h2>
              <ol className="route-ol card-fola overflow-hidden px-5 py-2">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/reports/$id"
                      params={{ id: r.id }}
                      className="-mx-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3 hover:bg-muted/60"
                      aria-label={`Open report: ${r.title}`}
                    >
                      <span
                        className={cn("stop-dot", r.id === newestId && "stop-tick")}
                        data-tone={
                          r.status === "resolved"
                            ? "done"
                            : r.status === "in_progress"
                              ? "here"
                              : undefined
                        }
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-lg font-bold leading-snug">{r.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {r.category === "financial" ? (
                            <PoundSterling
                              className="mr-1 inline size-4 align-[-2px]"
                              aria-hidden
                            />
                          ) : (
                            <Landmark className="mr-1 inline size-4 align-[-2px]" aria-hidden />
                          )}
                          <span className="font-bold text-foreground">{statusWord(r.status)}</span>
                          {` · ${shortDate(r.updated_at ?? r.created_at)}, ${time(r.updated_at ?? r.created_at)}`}
                        </span>
                        {r.money && (
                          <span className="num mt-1 block text-success">
                            +{money(r.money.amount)}
                            <span className="font-sans text-sm font-bold">
                              {perPeriod(r.money.period) === "/mo"
                                ? " a month"
                                : perPeriod(r.money.period)}
                            </span>
                          </span>
                        )}
                      </span>
                      <ChevronRight className="size-6 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        {reports.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={() => window.print()}
              aria-label="Download all reports as PDF"
            >
              <Download className="size-5" aria-hidden /> Download all as PDF
            </button>
            <ReadAloud text={summaryText} label="Read summary aloud" />
          </div>
        )}
      </div>

      {/* Print version: every report in full */}
      <div className="print-only">
        <h1 className="text-2xl font-bold">
          Fola reports for {profile?.user.first_name} {profile?.user.last_name}, printed{" "}
          {longDate(new Date().toISOString())}
        </h1>
        <p>{summaryText}</p>
        {reports.map((r) => (
          <PrintReport key={r.id} r={r} />
        ))}
      </div>
    </Screen>
  );
}

function PrintReport({ r }: { r: Report }) {
  return (
    <article className="card-fola mt-4 p-4">
      <h2 className="text-xl font-bold">{r.title}</h2>
      <p>
        Status:{" "}
        {r.status === "resolved"
          ? "Done"
          : r.status === "in_progress"
            ? "In progress"
            : "Passed to adviser"}
        {r.money ? ` · ${money(r.money.amount)} per ${r.money.period}` : ""}
      </p>
      <p>Reference: {reportRef(r)}</p>
      <ol className="mt-2 list-decimal pl-6">
        {r.steps.map((s, i) => (
          <li key={i}>
            {dateTime(s.at)}: {s.text}
            {s.user_quote ? ` (You said: “${s.user_quote}”)` : ""}
            {s.preview && <PreviewView preview={s.preview} />}
          </li>
        ))}
      </ol>
      {r.sources.map((u) => (
        <p key={u}>
          <a href={u}>Rule checked</a>
        </p>
      ))}
    </article>
  );
}
