import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download, Lock, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { Disclaimer, Disclosure, Screen } from "@/components/fola/ui";
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
import { Switch } from "@/components/ui/switch";
import { api, qk } from "@/lib/api";
import { longDate, money, shortDate } from "@/lib/format";
import { updateSettings, useSettings, type TextSize } from "@/lib/settings";
import type { Fact } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "What Fola knows about you" },
      {
        name: "description",
        content:
          "See everything Fola believes about you, where it came from, and fix or delete it.",
      },
      { property: "og:title", content: "What Fola knows about you" },
      {
        property: "og:description",
        content: "See, fix or delete everything Fola knows about you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const LANGS = [
  { v: "en", l: "English" },
  { v: "so", l: "Somali" },
  { v: "pl", l: "Polish" },
  { v: "ur", l: "Urdu" },
  { v: "ar", l: "Arabic" },
  { v: "cy", l: "Welsh" },
];

function ProfilePage() {
  const { data: p, isLoading } = useQuery({ queryKey: qk.profile, queryFn: api.getProfile });
  const qc = useQueryClient();
  const settings = useSettings();

  if (isLoading || !p)
    return (
      <Screen>
        <div className="card-fola mt-6 h-64 animate-pulse" />
      </Screen>
    );

  const fromBank = p.facts.filter((f) => f.source !== "user");
  const told = p.facts.filter((f) => f.source === "user");
  const pct = Math.round(p.profile_completeness * 100);

  const download = async () => {
    const reports = await api.getReports();
    const blob = new Blob([JSON.stringify({ profile: p, reports, settings }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fola-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Screen>
      <header className="bleed flex items-center gap-4 bg-blind pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-blind-foreground">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-signal font-display text-3xl font-black text-signal-foreground"
          aria-hidden
        >
          {p.user.first_name[0]}
        </span>
        <div>
          <h1 className="text-3xl leading-tight text-signal">
            {p.user.first_name} {p.user.last_name}
          </h1>
          <p className="text-lg font-bold">What Fola knows about you</p>
        </div>
      </header>

      <section className="card-fola mt-4 p-5" aria-labelledby="nw-h">
        <h2 id="nw-h" className="text-xl">
          Net worth <span className="num ml-1">{money(p.net_worth.current)}</span>
        </h2>
        <div
          className="mt-3 h-32"
          role="img"
          aria-label={`Net worth over time, from ${money(p.net_worth.history[0]?.value ?? 0)} to ${money(p.net_worth.current)}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={p.net_worth.history}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString("en-GB", { month: "short" })
                }
                interval="preserveStartEnd"
                minTickGap={60}
                tick={{ fontSize: 15, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                formatter={(v: number) => [money(v), "Net worth"]}
                labelFormatter={(l: string) => longDate(l)}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-chart-1)"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 divide-y border-t">
          {p.accounts.map((a) => (
            <li key={a.id} className="flex justify-between gap-3 py-2">
              <span>{a.name}</span>
              <strong className="num shrink-0 whitespace-nowrap">{money(a.balance)}</strong>
            </li>
          ))}
          {p.liabilities.map((l) => (
            <li key={l.name} className="flex justify-between gap-3 py-2">
              <span>
                {l.name}{" "}
                <span className="text-sm text-muted-foreground">
                  ({l.type === "monthly" ? "paid each month" : "owed"})
                </span>
              </span>
              <strong className="num shrink-0 whitespace-nowrap text-warning">
                {money(-l.balance)}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-fola mt-5 p-5" aria-labelledby="know-h">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="know-h" className="text-xl">
            How well Fola knows you
          </h2>
          <span className="num text-lg">{pct}%</span>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="How well Fola knows you"
        >
          <div
            className="h-full rounded-full bg-signal transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3">
          A few quick questions help Fola check for more help you could get. It only asks what
          matters.
        </p>
        <Link
          to="/chat"
          search={{ text: "Am I missing any help?" }}
          className="btn btn-primary mt-3"
          aria-label="Answer Fola's questions now"
        >
          Answer a few questions
        </Link>
      </section>

      <FactGroup title="Fola worked this out from your bank" facts={fromBank} inferred />
      <FactGroup title="You told Fola" facts={told} />

      <section className="card-fola mt-6 space-y-5 p-5" aria-labelledby="set-h">
        <h2 id="set-h" className="text-2xl">
          Settings
        </h2>
        <div>
          <label htmlFor="lang" className="font-bold">
            Language
          </label>
          <select
            id="lang"
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
            className="mt-1 block min-h-12 w-full rounded-xl border-2 border-input bg-card px-3"
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <option key={l.v} value={l.v}>
                {l.l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="speak" className="font-bold">
            Speak replies out loud
          </label>
          <Switch
            id="speak"
            checked={settings.speakReplies}
            onCheckedChange={(v) => updateSettings({ speakReplies: v })}
            aria-label="Speak replies out loud"
            className="scale-125"
          />
        </div>
        <div>
          <p className="font-bold" id="ts-label">
            Text size
          </p>
          <div role="radiogroup" aria-labelledby="ts-label" className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["normal", "Normal"],
                ["large", "Large"],
                ["xl", "Extra large"],
              ] as [TextSize, string][]
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={settings.textSize === v}
                aria-pressed={settings.textSize === v}
                className="chip"
                onClick={() => updateSettings({ textSize: v })}
                aria-label={`Text size ${l}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="optin" className="font-bold">
              Find opt-in opportunities
            </label>
            <Switch
              id="optin"
              checked={settings.optInOpportunities}
              onCheckedChange={(v) => updateSettings({ optInOpportunities: v })}
              aria-label="Find opt-in opportunities"
              className="scale-125"
            />
          </div>
          <p className="mt-2 text-base text-muted-foreground">
            Some charities, universities and employers run grants, bursaries and mentoring for
            under-represented groups. If you turn this on, Fola may ask optional questions (like
            your ethnic background) only to find these. It never changes any benefit decision.
          </p>
        </div>
      </section>

      <section className="card-fola mt-6 space-y-3 p-5" aria-labelledby="data-h">
        <h2 id="data-h" className="text-2xl">
          Your data
        </h2>
        <button
          className="btn btn-outline w-full"
          onClick={download}
          aria-label="Download everything Fola knows about you"
        >
          <Download className="size-5" aria-hidden /> Download everything Fola knows
        </button>
        <DeleteEverything onDone={() => qc.invalidateQueries()} />
      </section>

      <Disclaimer />
    </Screen>
  );
}

function confidenceTag(c: number) {
  return c >= 0.8 ? "Fairly sure" : "Not sure";
}

function FactGroup({
  title,
  facts,
  inferred,
}: {
  title: string;
  facts: Fact[];
  inferred?: boolean | undefined;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-xl">{title}</h2>
      {facts.length === 0 && (
        <p className="mt-2 text-muted-foreground">
          {inferred
            ? "Nothing yet."
            : "Nothing yet. When you tell Fola something, it shows here so you can check it."}
        </p>
      )}
      {facts.length > 0 && (
        <ul className="card-fola mt-3 divide-y overflow-hidden">
          {facts.map((f) => (
            <FactRow key={f.key} f={f} inferred={inferred} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FactRow({ f, inferred }: { f: Fact; inferred?: boolean | undefined }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(f.value));
  const refresh = () => qc.invalidateQueries({ queryKey: qk.profile });
  const patch = useMutation({
    mutationFn: (p: Partial<Fact>) => api.patchFact(f.key, p),
    onSuccess: () => {
      refresh();
      toast.success("Saved");
    },
  });
  const del = useMutation({
    mutationFn: () => api.deleteFact(f.key),
    onSuccess: () => {
      refresh();
      toast("Removed");
    },
  });
  const sensitive = f.sensitivity === "special_category";

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted-foreground">
            {sensitive && <Lock className="mr-1 inline size-4" aria-label="Sensitive" />}
            {f.label}
          </p>
          {!editing && (
            <p className="text-lg font-bold leading-snug break-words">{String(f.value)}</p>
          )}
        </div>
        {inferred ? (
          f.confidence < 1 && (
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-sm font-bold",
                f.confidence >= 0.8 ? "bg-info-soft text-info" : "bg-warning-soft text-warning",
              )}
            >
              {confidenceTag(f.confidence)}
            </span>
          )
        ) : (
          <span className="shrink-0 text-sm text-muted-foreground">{longDate(f.updated_at)}</span>
        )}
      </div>
      {sensitive && (
        <p className="mt-1 text-sm text-muted-foreground">
          Only used to check help you could get. Never shared.
        </p>
      )}
      {editing && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            patch.mutate({ value: val });
            setEditing(false);
          }}
        >
          <label htmlFor={`fact-${f.key}`} className="sr-only">
            {f.label}
          </label>
          <input
            id={`fact-${f.key}`}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="min-h-12 flex-1 rounded-xl border-2 border-input bg-card px-3"
            aria-label={`New value for ${f.label}`}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" aria-label={`Save ${f.label}`}>
            Save
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </form>
      )}
      {inferred && f.evidence && (
        <Disclosure summary="How do you know?">
          <p>{f.evidence}</p>
        </Disclosure>
      )}
      {!editing && (
        <div className="mt-1 flex flex-wrap gap-1">
          {inferred ? (
            <>
              {!f.confirmed && (
                <button
                  className="btn btn-ghost min-h-11 px-3"
                  onClick={() => patch.mutate({ confirmed: true })}
                  aria-label={`That's right: ${f.label} is ${f.value}`}
                >
                  <Check className="size-5" aria-hidden /> That's right
                </button>
              )}
              <button
                className="btn btn-ghost min-h-11 px-3 underline"
                onClick={() => setEditing(true)}
                aria-label={`Not right: change ${f.label}`}
              >
                Not right?
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${f.label}`}
              >
                <Pencil className="size-5" aria-hidden /> Edit
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="btn btn-ghost text-destructive"
                    aria-label={`Delete ${f.label}`}
                  >
                    <Trash2 className="size-5" aria-hidden /> Delete
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{f.label}"?</AlertDialogTitle>
                    <AlertDialogDescription className="text-base">
                      Fola will forget this. It may ask again if it matters later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-12">Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      className="min-h-12 bg-destructive text-destructive-foreground"
                      onClick={() => del.mutate()}
                    >
                      Yes, delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function DeleteEverything({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  return (
    <AlertDialog open={step > 0} onOpenChange={(o) => !o && setStep(0)}>
      <AlertDialogTrigger asChild>
        <button
          className="btn btn-danger w-full"
          onClick={() => setStep(1)}
          aria-label="Delete everything Fola knows"
        >
          Delete everything
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {step === 1 ? "Delete everything?" : "Are you really sure?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {step === 1
              ? "This removes your reports and everything you told Fola."
              : "This can't be undone. Your reports will be gone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12">Keep my data</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-12 bg-destructive text-destructive-foreground"
            onClick={async (e) => {
              if (step === 1) {
                e.preventDefault();
                setStep(2);
                return;
              }
              await api.deleteEverything();
              onDone();
              setStep(0);
              toast("Everything deleted");
            }}
          >
            {step === 1 ? "Continue" : "Yes, delete everything"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
