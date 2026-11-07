export type Period = "year" | "month" | "week" | "once";

export interface MoneyAmount {
  amount: number;
  period: Period;
  direction?: "save" | "gain" | undefined;
}

export type FactSource = "inferred" | "bank" | "user";

export interface Fact {
  key: string;
  label: string;
  value: string | number;
  source: FactSource;
  confidence: number;
  confirmed: boolean;
  evidence?: string | undefined;
  sensitivity: "financial" | "personal" | "special_category";
  updated_at: string;
}

export interface Profile {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    dob: string;
    postcode: string;
    council: string;
    preferred_language: string;
    accessibility: string[];
  };
  net_worth: {
    current: number;
    assets: number;
    liabilities: number;
    currency: string;
    history: { date: string; value: number }[];
  };
  accounts: { id: string; name: string; type: string; balance: number }[];
  liabilities: { type: string; name: string; balance: number }[];
  facts: Fact[];
  profile_completeness: number;
}

export interface EvidenceTxn {
  txn_id: string;
  date: string;
  merchant: string;
  amount: number;
}

export interface FolaNotification {
  id: string;
  type: "financial" | "demographic";
  severity: "urgent" | "warning" | "info";
  title: string;
  body: string;
  money?: MoneyAmount | null | undefined;
  evidence?: EvidenceTxn[] | undefined;
  source_url?: string | null | undefined;
  suggested_prompt?: string | undefined;
  /** Questions Fola may ask before it can act on this. */
  questions?: string[] | undefined;
  status: "new" | "seen" | "resolved";
  created_at: string;
}

export interface EmailPreview {
  to: string;
  subject: string;
  body: string;
}
export interface FormPreview {
  form_name: string;
  fields: { label: string; value: string }[];
}
export type ActionPreview = EmailPreview | FormPreview;

export function isEmailPreview(p: ActionPreview): p is EmailPreview {
  return (p as EmailPreview).to !== undefined;
}

export interface FolaAction {
  id: string;
  type:
    | "send_email"
    | "fill_form"
    | "block_merchant"
    | "cancel_subscription"
    | "submit_claim"
    | "set_reminder"
    | "top_up_transfer";
  title: string;
  /** Plain-English one-liner of what will happen. */
  summary?: string | undefined;
  notification_id?: string | undefined;
  impact?: { amount: number; period: Period } | null | undefined;
  preview: ActionPreview;
  status?: "pending" | "approved" | "declined" | undefined;
  pdf_url?: string | undefined;
}

export interface ProfileUpdate {
  key: string;
  label: string;
  value: string | number;
  confirmed: boolean;
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  pending_action?: FolaAction | null | undefined;
  profile_updates?: ProfileUpdate[] | undefined;
  quick_replies?: string[] | undefined;
}

export interface ApproveResponse {
  action: FolaAction;
  result: {
    message: string;
    follow_up?: { reply: string; quick_replies?: string[] | undefined } | undefined;
  };
  report_id: string;
}

export type StepKind =
  | "noticed"
  | "asked"
  | "answered"
  | "proposed"
  | "approved"
  | "declined"
  | "done"
  | "referred"
  | "waiting";

export interface ReportStep {
  at: string;
  kind: StepKind;
  text: string;
  action_id?: string | undefined;
  user_quote?: string | undefined;
  preview?: ActionPreview | undefined;
  referral?: { name: string; url: string } | undefined;
}

export interface Report {
  id: string;
  created_at: string;
  updated_at?: string | undefined;
  title: string;
  category: "financial" | "demographic";
  status: "resolved" | "in_progress" | "referred";
  money: { amount: number; period: Period } | null;
  steps: ReportStep[];
  sources: string[];
  next_step?: string | undefined;
  pdf_url?: string | undefined;
}

export interface Forecast {
  /** Net worth today. */
  current: number;
  /** One stop per month: where you'd be as things are vs with Fola's suggestions. */
  months: { month: string; baseline: number; with_fola: number }[];
  /** Plain-English list of how the forecast was worked out. */
  assumptions: string[];
  monthly_uplift: number;
}
