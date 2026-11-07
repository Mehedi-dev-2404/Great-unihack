import { yearly } from "./format";
import type { Report } from "./types";

export function reportSummary(reports: Report[]) {
  const counted = reports.filter((r) => r.status === "resolved" || r.status === "in_progress");
  const perYear = counted.reduce(
    (s, r) => s + (r.money ? yearly(r.money.amount, r.money.period) : 0),
    0,
  );
  return {
    perYear: Math.round(perYear * 100) / 100,
    done: reports.filter((r) => r.status === "resolved").length,
    inProgress: reports.filter((r) => r.status === "in_progress").length,
    referred: reports.filter((r) => r.status === "referred").length,
  };
}

export function reportRef(r: Report) {
  return `FOLA-${r.id.toUpperCase()}-${r.created_at.slice(0, 10).replace(/-/g, "")}`;
}
