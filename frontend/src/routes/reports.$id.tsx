import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  FileText,
  HelpCircle,
  MessageSquare,
  Printer,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Disclosure, MoneyBadge, PreviewView, StatusPill } from "@/components/fola/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api, qk } from "@/lib/api";
import { cn } from "@/lib/utils";
import { dateTime, longDate } from "@/lib/format";
import type { StepKind } from "@/lib/types";
import { reportRef } from "@/lib/reports";

export const Route = createFileRoute("/reports/$id")({
  head: () => ({
    meta: [
      { title: "Report · Fola" },
      {
        name: "description",
        content: "A dated record of what Fola did for you, with your approval.",
      },
      { property: "og:title", content: "Report · Fola" },
      {
        property: "og:description",
        content: "A dated record of what Fola did for you, with your approval.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportDetail,
});

const STEP: Record<StepKind, { icon: LucideIcon; label: string; tone?: "done" | "here" }> = {
  noticed: { icon: Search, label: "Fola noticed" },
  asked: { icon: HelpCircle, label: "Fola asked" },
  answered: { icon: MessageSquare, label: "You answered" },
  proposed: { icon: FileText, label: "Fola proposed" },
  approved: { icon: Check, label: "You said yes", tone: "here" },
  declined: { icon: X, label: "You said no" },
  done: { icon: Check, label: "Prepared and logged", tone: "done" },
  referred: { icon: ArrowUpRight, label: "Passed on" },
  waiting: { icon: Clock, label: "Waiting" },
};

function ReportDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: reports, isLoading } = useQuery({ queryKey: qk.reports, queryFn: api.getReports });
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: api.getProfile });
  const r = reports?.find((x) => x.id === id);

  if (isLoading)
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <div className="card-fola h-60 animate-pulse" />
      </div>
    );
  if (!r) {
    return (
      <div className="mx-auto max-w-[480px] p-6 text-center">
        <p className="text-xl font-bold">We couldn't find that report.</p>
        <Link to="/reports" className="btn btn-primary mt-4">
          Back to reports
        </Link>
      </div>
    );
  }
  const steps = [...r.steps].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="mx-auto min-h-screen w-full max-w-[480px] px-4 pb-10">
      <header className="no-print sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-blind px-2 py-2 text-blind-foreground">
        <Link
          to="/reports"
          className="btn min-w-12 px-0 hover:bg-white/10"
          aria-label="Back to journey log"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <p className="flex-1 font-display text-xl font-extrabold">Journey log</p>
        <button
          className="btn min-w-12 px-0 hover:bg-white/10"
          onClick={() => window.print()}
          aria-label="Print this report"
        >
          <Printer className="size-6" aria-hidden />
        </button>
      </header>

      <p className="print-only mb-4 font-bold">
        Fola report for {profile?.user.first_name} {profile?.user.last_name}, printed{" "}
        {longDate(new Date().toISOString())}
      </p>

      <section className="card-fola mt-2 space-y-2 p-5">
        <h1 className="text-2xl">{r.title}</h1>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={r.status} />
          <MoneyBadge m={r.money} />
        </div>
        <p className="text-base">
          <strong>Reference:</strong> {reportRef(r)}
        </p>
        <p className="text-sm text-muted-foreground">
          Opened {dateTime(r.created_at)}
          {r.updated_at ? ` · Updated ${dateTime(r.updated_at)}` : ""}
        </p>
      </section>

      <section className="mt-6" aria-labelledby="tl-h">
        <h2 id="tl-h" className="text-2xl">
          What happened
        </h2>
        <ol className="route mt-4">
          <span className="route-line" aria-hidden />
          {steps.map((s, i) => {
            const st = STEP[s.kind];
            const Icon = st.icon;
            return (
              <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                <span className="stop-dot grid place-items-center" data-tone={st.tone} aria-hidden>
                  <Icon
                    className={cn("size-3.5", st.tone === "done" && "text-white")}
                    strokeWidth={3}
                  />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="font-display text-lg font-extrabold leading-tight">{st.label}</p>
                  <p className="text-sm text-muted-foreground">{dateTime(s.at)}</p>
                  <p className="mt-1">{s.text}</p>
                  {s.kind === "approved" && s.user_quote && (
                    <p className="mt-1 italic">You said: “{s.user_quote}”</p>
                  )}
                  {s.preview && (
                    <Disclosure summary="View what was proposed">
                      <PreviewView preview={s.preview} />
                    </Disclosure>
                  )}
                  {s.referral && (
                    <a
                      href={s.referral.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-bold text-info underline"
                    >
                      {s.referral.name}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {r.sources.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl">Rules Fola checked</h2>
          <ul className="mt-2 space-y-1">
            {r.sources.map((u) => (
              <li key={u}>
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-info underline"
                >
                  {u.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.status === "in_progress" && r.next_step && (
        <section className="mt-6 rounded-xl bg-warning-soft p-4">
          <h2 className="font-sans text-lg font-bold text-warning">What happens next</h2>
          <p className="mt-1">{r.next_step}</p>
          <Link
            to="/chat"
            search={{ text: `About "${r.title}": ` }}
            className="btn btn-primary no-print mt-3"
            aria-label="Ask Fola about this"
          >
            Ask Fola about this
          </Link>
        </section>
      )}

      {api.isMock && (
        <div className="no-print mt-8">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="btn btn-ghost text-destructive" aria-label="Delete this report">
                <Trash2 className="size-5" aria-hidden /> Delete report
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  This removes it from your record. Are you sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-12">Keep it</AlertDialogCancel>
                <AlertDialogAction
                  className="min-h-12 bg-destructive text-destructive-foreground"
                  onClick={async () => {
                    await api.deleteReport(r.id);
                    await qc.invalidateQueries({ queryKey: qk.reports });
                    toast("Report deleted");
                    navigate({ to: "/reports" });
                  }}
                >
                  Yes, delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Fola gives guidance, not regulated financial or legal advice. Every action here was approved
        by you.
      </p>
    </div>
  );
}
