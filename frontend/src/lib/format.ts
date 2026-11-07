import type { Period } from "./types";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
const gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export function money(n: number, whole = false): string {
  const s = (whole ? gbp0 : gbp).format(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

export function perPeriod(period: Period): string {
  return { year: "/yr", month: "/mo", week: "/wk", once: "" }[period];
}

export function yearly(amount: number, period: Period): number {
  return period === "month" ? amount * 12 : period === "week" ? amount * 52 : amount;
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function dateTime(iso: string): string {
  return `${longDate(iso)}, ${time(iso)}`;
}

export function dayGroup(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return longDate(iso);
}
