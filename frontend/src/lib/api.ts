import type {
  ApproveResponse,
  ChatResponse,
  EvidenceTxn,
  Fact,
  FolaAction,
  FolaNotification,
  Forecast,
  Profile,
  ProfileUpdate,
  Report,
  ReportStep,
} from "./types";
import { delay, mock } from "@/mocks/store";

const API: string = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").replace(
  /\/$/,
  "",
);
const useMock = !API;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function viaMock<T>(fn: () => T, ms = 600): Promise<T> {
  await delay(ms);
  return fn();
}

/* ---------------------------------------------------------------------------
 * Backend shapes (Great-unihack/docs/PROJECT.md). Every field may be missing;
 * unknown fields are ignored.
 * ------------------------------------------------------------------------- */
interface BProfile {
  id: string;
  name: string;
  age?: number;
  city?: string;
  postcode_area?: string;
  council?: string;
  household?: {
    adults?: number;
    relationship_status?: string;
    children?: { name: string; age: number; in_school?: boolean }[];
  };
  housing?: { tenure?: string; landlord?: string; monthly_rent?: number };
  employment?: string;
  monthly_income?: number;
  benefits?: { name: string; monthly_amount: number }[];
  savings?: { name: string; balance: number }[];
  debts?: { name: string; monthly_payment?: number; balance?: number }[];
  facts?: Record<string, unknown>;
  net_worth: number;
  net_worth_history?: { month: string; net_worth: number }[];
}
interface BNotification {
  id: string;
  type: "demographic" | "financial";
  title: string;
  body: string;
  severity?: "low" | "medium" | "high";
  transaction_ids?: string[];
  questions?: string[];
  monthly_value?: number | null;
  source_url?: string | null;
  merchant?: string | null;
  suggested_action?: string | null;
}
interface BAction {
  id: string;
  type: FolaAction["type"];
  title: string;
  summary?: string;
  status?: "pending" | "approved" | "declined";
  created_at?: string;
  notification_id?: string | null;
  monthly_value?: number | null;
  draft?: { to: string; subject: string; body: string } | null;
  form?: { name: string; fields: Record<string, string> } | null;
}
interface BReport {
  id: string;
  action_id?: string;
  type?: string;
  title: string;
  created_at: string;
  summary?: string;
  outcome?: string;
}
interface BForecast {
  current_net_worth: number;
  baseline: { month: string; net_worth: number }[];
  with_actions: { month: string; net_worth: number }[];
  assumptions?: string[];
  monthly_uplift_from_actions?: number;
}
interface BTxn {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category?: string;
}

/** A dated stop on the route ahead, predicted from a payment that repeats. */
export interface UpcomingStop {
  id: string;
  date: string;
  label: string;
  amount: number;
  /** risk: Fola thinks you may not want this; chance: Fola can add money here. */
  tone?: "risk" | "chance" | undefined;
  note?: string | undefined;
  notification_id?: string | undefined;
}

const DAY = 86400000;
const stopLabel = (m: string) =>
  m
    .replace(/^DWP /, "")
    .replace(/^HMRC /, "")
    .replace(/ \(wages\)$/, " wages")
    .replace(/^One Manchester$/, "Rent")
    .replace(/^Manchester City Council$/, "Council tax");

/** Predict the next date of every payment that repeats monthly or every 4 weeks. */
export function predictStops(
  txns: BTxn[],
  notes: BNotification[],
  today = new Date(),
): UpcomingStop[] {
  const by = new Map<string, BTxn[]>();
  for (const t of txns) by.set(t.merchant, [...(by.get(t.merchant) ?? []), t]);
  const stops: UpcomingStop[] = [];
  for (const [merchant, list] of by) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = new Set(sorted.map((t) => Math.round(t.amount)));
    if (amounts.size > 1) continue;
    const gaps = sorted
      .slice(1)
      .map((t, i) => (Date.parse(t.date) - Date.parse(sorted[i]!.date)) / DAY);
    const gap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
    const last = sorted[sorted.length - 1]!;
    let next: Date;
    const step = (d: Date) => {
      if (gap >= 27 && gap <= 29) return new Date(d.getTime() + 28 * DAY);
      if (gap >= 29 && gap <= 32)
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
      return null;
    };
    let cur: Date | null = new Date(`${last.date}T00:00:00Z`);
    do {
      cur = cur ? step(cur) : null;
    } while (cur && cur.getTime() < today.getTime() - DAY);
    if (!cur) continue;
    next = cur;
    const risk = notes.find((n) => n.type === "financial" && n.merchant && n.merchant === merchant);
    const chance = /universal credit/i.test(merchant)
      ? notes.find((n) => n.type === "demographic" && /universal credit/i.test(n.title))
      : undefined;
    stops.push({
      id: `${merchant}-${next.toISOString().slice(0, 10)}`,
      date: next.toISOString().slice(0, 10),
      label: stopLabel(merchant),
      amount: last.amount,
      tone: risk ? "risk" : chance ? "chance" : undefined,
      note: risk
        ? "You may not want this"
        : chance?.monthly_value
          ? `+${gbp(chance.monthly_value)} a month with Fola`
          : undefined,
      notification_id: (risk ?? chance)?.id,
    });
  }
  return stops.sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------- adapters -------------------------------- */
const plain = (key: string) => {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const plainValue = (v: unknown): string =>
  typeof v === "string"
    ? v.replace(/_/g, " ")
    : v && typeof v === "object" && !Array.isArray(v)
      ? Object.entries(v as Record<string, unknown>)
          .map(([k, x]) => `${plain(k)}: ${plainValue(x)}`)
          .join("; ")
      : v === true
        ? "Yes"
        : v === false
          ? "No"
          : Array.isArray(v)
            ? v.join(", ")
            : v == null
              ? "Not known"
              : String(v);
const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

/** Plain-English questions for facts the agent records, so Profile never shows machine keys. */
const FACT_QUESTIONS: Record<string, string> = {
  children_live_with_user: "Do your children live with you?",
  children_all_under_18: "Are all your children under 18?",
  children_eligible_age: "Are your children the right age for this help?",
  children_ages: "Your children's ages",
  relationship_status: "Your relationship status",
  employment_status: "Your work",
  savings_total: "Your savings",
  has_partner_living_with: "Do you live with a partner?",
  other: "Something else you told Fola",
};
const sentence = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
const questionFor = (key: string, value: unknown) =>
  typeof value === "boolean"
    ? `${sentence(key.replace(/_/g, " "))}?`
    : sentence(key.replace(/_/g, " "));

function toUiProfile(b: BProfile): Profile {
  const [first = b.name, ...rest] = b.name.split(" ");
  const now = new Date().toISOString();
  const bank = (key: string, label: string, value: string): Fact => ({
    key,
    label,
    value,
    source: "bank",
    confidence: 1,
    confirmed: true,
    sensitivity: "personal",
    updated_at: now,
  });
  const kids = b.household?.children ?? [];
  const facts: Fact[] = [
    b.council ? bank("council", "Council", b.council) : null,
    kids.length
      ? bank(
          "children",
          "Children",
          `${kids.length}: ${kids.map((k) => `${k.name} (${k.age})`).join(", ")}`,
        )
      : null,
    b.household?.adults != null
      ? bank("adults", "Adults at home", String(b.household.adults))
      : null,
    b.housing?.tenure
      ? bank(
          "housing",
          "Home",
          `${plain(b.housing.tenure)}${b.housing.monthly_rent ? `, ${gbp(b.housing.monthly_rent)} a month` : ""}`,
        )
      : null,
    b.employment ? bank("employment", "Work", b.employment) : null,
    b.monthly_income != null
      ? bank("monthly_income", "Money in each month", gbp(b.monthly_income))
      : null,
    ...(b.benefits ?? []).map((x) =>
      bank(`benefit_${x.name}`, x.name, `${gbp(x.monthly_amount)} a month`),
    ),
  ].filter((f): f is Fact => f !== null);
  const names = kids.map((k) => k.name);
  const proper = (t: string) =>
    names.reduce((acc, n) => acc.replace(new RegExp(`\\b${n}\\b`, "gi"), n), t);
  for (const [key, value] of Object.entries(b.facts ?? {})) {
    const pair = typeof value === "string" ? /^(.+?):\s*(yes|no|true|false)$/i.exec(value) : null;
    facts.push({
      key,
      label: pair
        ? proper(sentence(pair[1]!.replace(/_/g, " ")))
        : (FACT_QUESTIONS[key] ?? questionFor(key, value)),
      value: pair
        ? /^(yes|true)$/i.test(pair[2]!)
          ? "Yes"
          : "No"
        : proper(sentence(plainValue(value))),
      source: "user",
      confidence: 1,
      confirmed: true,
      sensitivity: "personal",
      updated_at: now,
    });
  }
  const savings = (b.savings ?? []).reduce((a, s) => a + s.balance, 0);
  return {
    user: {
      id: b.id,
      first_name: first,
      last_name: rest.join(" "),
      dob: "",
      postcode: b.postcode_area ?? "",
      council: b.council ?? "",
      preferred_language: "en",
      accessibility: [],
    },
    net_worth: {
      current: b.net_worth,
      assets: b.net_worth,
      liabilities: 0,
      currency: "GBP",
      history: (b.net_worth_history ?? []).map((h) => ({
        date: `${h.month}-01`,
        value: h.net_worth,
      })),
    },
    accounts: [
      {
        id: "current",
        name: "Current account",
        type: "current",
        balance: Math.round((b.net_worth - savings) * 100) / 100,
      },
      ...(b.savings ?? []).map((s, i) => ({
        id: `sav${i}`,
        name: s.name,
        type: "savings",
        balance: s.balance,
      })),
    ],
    liabilities: (b.debts ?? []).map((d) => ({
      type: "monthly",
      name: d.name,
      balance: d.monthly_payment ?? d.balance ?? 0,
    })),
    facts,
    profile_completeness: Math.min(1, 0.4 + Object.keys(b.facts ?? {}).length * 0.1),
  };
}

const SEEN_KEY = "fola-seen";
function seen(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
export function markSeen(id: string) {
  try {
    const s = new Set(seen());
    s.add(id);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* storage unavailable */
  }
}

function toUiNotification(
  n: BNotification,
  txns: Map<string, BTxn>,
  resolved: Set<string>,
): FolaNotification {
  const evidence: EvidenceTxn[] = (n.transaction_ids ?? [])
    .map((id) => txns.get(id))
    .filter((t): t is BTxn => !!t)
    .map((t) => ({ txn_id: t.id, date: t.date, merchant: t.merchant, amount: t.amount }));
  const prompt =
    n.suggested_action === "cancel_subscription"
      ? `Help me cancel ${n.merchant ?? "this subscription"}`
      : n.suggested_action === "submit_claim"
        ? `Help me claim this: ${n.title}`
        : `Tell me about: ${n.title}`;
  return {
    id: n.id,
    type: n.type,
    severity: n.severity === "high" ? "urgent" : n.severity === "medium" ? "warning" : "info",
    title: n.title,
    body: n.body,
    money:
      typeof n.monthly_value === "number" && n.monthly_value > 0
        ? {
            amount: n.monthly_value,
            period: "month",
            direction: n.type === "financial" ? "save" : "gain",
          }
        : null,
    evidence,
    source_url: n.source_url ?? null,
    suggested_prompt: prompt,
    questions: n.questions ?? [],
    status: resolved.has(n.id) ? "resolved" : seen().includes(n.id) ? "seen" : "new",
    created_at: new Date().toISOString(),
  };
}

function toUiAction(a: BAction): FolaAction {
  const preview = a.draft
    ? { to: a.draft.to, subject: a.draft.subject, body: a.draft.body }
    : {
        form_name: a.form?.name ?? a.title,
        fields: Object.entries(a.form?.fields ?? {}).map(([label, value]) => ({
          label,
          value: String(value),
        })),
      };
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    summary: a.summary,
    impact:
      typeof a.monthly_value === "number" && a.monthly_value > 0
        ? { amount: a.monthly_value, period: "month" }
        : null,
    preview,
    status: a.status,
    notification_id: a.notification_id ?? undefined,
  };
}

const outcomeWord = (o?: string) =>
  o === "cancelled" ? "Cancellation prepared and logged" : "Prepared and logged";

function toUiReport(r: BReport, action?: BAction, note?: BNotification): Report {
  const ui = action ? toUiAction(action) : undefined;
  const steps: ReportStep[] = [];
  if (note)
    steps.push({ at: action?.created_at ?? r.created_at, kind: "noticed", text: note.title });
  steps.push({
    at: action?.created_at ?? r.created_at,
    kind: "proposed",
    text: action?.summary ?? r.summary ?? r.title,
    action_id: r.action_id,
    preview: ui?.preview,
  });
  steps.push({ at: r.created_at, kind: "approved", text: "You said yes." });
  steps.push({
    at: r.created_at,
    kind: "done",
    text: `${outcomeWord(r.outcome)}. ${r.summary ?? ""}`.trim(),
  });
  return {
    id: r.id,
    created_at: r.created_at,
    title: r.title,
    category: note?.type ?? (r.type === "cancel_subscription" ? "financial" : "demographic"),
    status: "resolved",
    money: ui?.impact ?? null,
    steps,
    sources: note?.source_url ? [note.source_url] : [],
  };
}

function toUiForecast(f: BForecast): Forecast {
  return {
    current: f.current_net_worth,
    months: f.baseline.map((b, i) => ({
      month: b.month,
      baseline: b.net_worth,
      with_fola: f.with_actions[i]?.net_worth ?? b.net_worth,
    })),
    assumptions: f.assumptions ?? [],
    monthly_uplift: f.monthly_uplift_from_actions ?? 0,
  };
}

/* ------------------------------ live calls ------------------------------- */
async function liveNotifications(): Promise<FolaNotification[]> {
  const [ns, txns, approved] = await Promise.all([
    http<BNotification[]>("/api/notifications"),
    http<BTxn[]>("/api/transactions").catch(() => [] as BTxn[]),
    http<BAction[]>("/api/actions?status=approved").catch(() => [] as BAction[]),
  ]);
  const map = new Map(txns.map((t) => [t.id, t]));
  const resolved = new Set(approved.map((a) => a.notification_id).filter((x): x is string => !!x));
  const order = { urgent: 0, warning: 1, info: 2 } as const;
  return ns
    .map((n) => toUiNotification(n, map, resolved))
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

async function liveReports(): Promise<Report[]> {
  const [rs, actions, ns] = await Promise.all([
    http<BReport[]>("/api/reports"),
    http<BAction[]>("/api/actions?status=approved").catch(() => [] as BAction[]),
    http<BNotification[]>("/api/notifications").catch(() => [] as BNotification[]),
  ]);
  return rs.map((r) => {
    const a = actions.find((x) => x.id === r.action_id);
    return toUiReport(
      r,
      a,
      ns.find((n) => n.id === a?.notification_id),
    );
  });
}

const SESSION_KEY = "fola-session";
function sessionId(): string {
  try {
    const s = window.sessionStorage.getItem(SESSION_KEY);
    if (s) return s;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "fola-web";
  }
}

export interface ChatRequest {
  message: string;
  conversation_id?: string | undefined;
  notification_id?: string | undefined;
  notification_title?: string | undefined;
}

async function liveChat(body: ChatRequest): Promise<ChatResponse> {
  const session_id = body.conversation_id ?? sessionId();
  const message = body.notification_id
    ? `[About alert ${body.notification_id}${body.notification_title ? `: ${body.notification_title}` : ""}] ${body.message}`
    : body.message;
  const r = await http<{
    reply: string;
    pending_action?: BAction | null;
    profile_updates?: Record<string, unknown> | null;
  }>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, session_id }),
  });
  const updates: ProfileUpdate[] = Object.entries(r.profile_updates ?? {}).map(([key, value]) => ({
    key,
    label: plain(key),
    value: plainValue(value),
    confirmed: true,
  }));
  return {
    conversation_id: session_id,
    reply: r.reply,
    pending_action: r.pending_action ? toUiAction(r.pending_action) : null,
    profile_updates: updates,
  };
}

async function liveApprove(id: string): Promise<ApproveResponse> {
  const r = await http<BReport>(`/api/actions/${id}/approve`, { method: "POST" });
  return {
    action: {
      id,
      type: "send_email",
      title: r.title,
      preview: { to: "", subject: "", body: "" },
      status: "approved",
    },
    result: { message: r.summary ?? outcomeWord(r.outcome) },
    report_id: r.id,
  };
}

export const api = {
  isMock: useMock,
  getUpcoming: async (): Promise<UpcomingStop[]> => {
    if (useMock) return [];
    const [txns, notes] = await Promise.all([
      http<BTxn[]>("/api/transactions").catch(() => [] as BTxn[]),
      http<BNotification[]>("/api/notifications").catch(() => [] as BNotification[]),
    ]);
    return predictStops(txns, notes);
  },
  getProfile: () =>
    useMock ? viaMock(mock.profile) : http<BProfile>("/api/profile").then(toUiProfile),
  getNotifications: () => (useMock ? viaMock(mock.notifications) : liveNotifications()),
  getReports: () => (useMock ? viaMock(mock.reports) : liveReports()),
  chat: (body: ChatRequest) =>
    useMock
      ? viaMock(() => mock.chat(body.message, body.conversation_id, body.notification_id), 800)
      : liveChat(body),
  approve: (id: string, userQuote = "Yes, do it") =>
    useMock ? viaMock(() => mock.approve(id, userQuote)) : liveApprove(id),
  decline: (id: string) =>
    useMock
      ? viaMock(() => mock.decline(id))
      : http<unknown>(`/api/actions/${id}/decline`, { method: "POST" }).then(() => ({
          action: { id } as FolaAction,
        })),
  getForecast: () =>
    useMock
      ? viaMock(() => mock.forecast())
      : http<BForecast>("/api/forecast?months=12").then(toUiForecast),
  getPendingActions: () =>
    useMock
      ? Promise.resolve(mock.pendingActions())
      : http<BAction[]>("/api/actions?status=pending")
          .then((xs) => xs.map(toUiAction))
          .catch(() => [] as FolaAction[]),
  patchFact: (key: string, patch: Partial<Fact>) =>
    useMock
      ? viaMock(() => mock.patchFact(key, patch))
      : http<unknown>("/api/profile/facts", {
          method: "POST",
          body: JSON.stringify({ facts: { [key]: patch.value ?? patch.confirmed ?? true } }),
        }).then(() => undefined),
  deleteFact: (key: string) =>
    useMock
      ? viaMock(() => mock.deleteFact(key))
      : http<unknown>("/api/profile/facts", {
          method: "POST",
          body: JSON.stringify({ facts: { [key]: null } }),
        }).then(() => undefined),
  /** Demo reset: clears actions, reports and learned facts on the backend, and local seen-state. */
  reset: async () => {
    try {
      window.localStorage.removeItem(SEEN_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    if (!useMock) await http<unknown>("/api/reset", { method: "POST" }).catch(() => undefined);
  },
  deleteReport: async (id: string) => mock.deleteReport(id),
  deleteEverything: async () => mock.deleteEverything(),
  setVoiceListening: (on: boolean) => mock.setVoiceListening(on),
};

export const qk = {
  profile: ["profile"] as const,
  notifications: ["notifications"] as const,
  reports: ["reports"] as const,
  forecast: ["forecast"] as const,
  pending: ["actions", "pending"] as const,
  upcoming: ["upcoming"] as const,
};
