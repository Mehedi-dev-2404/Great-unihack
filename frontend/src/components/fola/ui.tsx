import { Link, useLocation } from "@tanstack/react-router";
import { FileText, Home, MessageCircle, User, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { money, perPeriod } from "@/lib/format";
import { speak } from "@/lib/settings";
import type { ActionPreview, MoneyAmount, Report } from "@/lib/types";
import { isEmailPreview } from "@/lib/types";

export function Screen({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className={cn("mx-auto min-h-screen w-full max-w-[480px] px-4", nav ? "pb-28" : "pb-6")}>
      {children}
      {nav && <BottomNav />}
    </div>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-[480px]">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-1 rounded-b bg-signal" aria-hidden />
                )}
                <Icon className="size-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MoneyBadge({
  m,
}: {
  m: MoneyAmount | { amount: number; period: MoneyAmount["period"] } | null | undefined;
}) {
  if (!m) return null;
  const dir = "direction" in m ? m.direction : undefined;
  const verb = dir === "gain" ? "Get " : dir === "save" ? "Save " : "+";
  return (
    <span className="num inline-flex items-center rounded-full bg-success-soft px-3 py-1 text-sm text-success">
      {verb}
      {money(m.amount)}
      {perPeriod(m.period)}
    </span>
  );
}

export function Amount({ n, className }: { n: number; className?: string }) {
  return <span className={cn(n < 0 && "text-warning", className)}>{money(n)}</span>;
}

export function ReadAloud({
  text,
  label = "Read aloud",
  compact,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`${label}: ${text.slice(0, 60)}`}
      className={cn("btn btn-ghost no-print", compact && "min-h-10 px-2")}
    >
      <Volume2 className="size-5" aria-hidden />
      {!compact && <span>{label}</span>}
    </button>
  );
}

export function PreviewView({ preview }: { preview: ActionPreview }) {
  if (isEmailPreview(preview)) {
    return (
      <div className="rounded-lg border bg-background p-3 text-base">
        <p>
          <strong>To:</strong> {preview.to}
        </p>
        <p>
          <strong>Subject:</strong> {preview.subject}
        </p>
        <div
          className="mt-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap border-t pt-2"
          tabIndex={0}
          aria-label="Email text"
        >
          {preview.body}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-background p-3 text-base">
      <p className="font-bold">{preview.form_name}</p>
      <dl className="mt-2 space-y-2">
        {preview.fields.map((f) => (
          <div key={f.label}>
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="font-semibold">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STATUS: Record<Report["status"], { label: string; cls: string }> = {
  resolved: { label: "Prepared and logged", cls: "bg-success-soft text-success" },
  in_progress: { label: "In progress", cls: "bg-warning-soft text-warning" },
  referred: { label: "Passed to adviser", cls: "bg-info-soft text-info" },
};
export function StatusPill({ status }: { status: Report["status"] }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-bold", s.cls)}>
      {s.label}
    </span>
  );
}

export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group mt-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-bold underline underline-offset-4">
        {summary}
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="no-print -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          aria-label={`Show ${o.label}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-8 text-center text-sm text-muted-foreground">
      Fola gives guidance, not regulated financial or legal advice.
    </p>
  );
}
