import type { FolaAction, FolaNotification, Profile, Report } from "@/lib/types";

export function initialProfile(): Profile {
  return {
    user: { id: "u01", first_name: "Daniel", last_name: "Okafor", dob: "1987-03-14", postcode: "LS9 7AB", council: "Leeds City Council", preferred_language: "en", accessibility: [] },
    net_worth: {
      current: 676.48, assets: 976.48, liabilities: 300.0, currency: "GBP",
      history: [
        { date: "2026-05-07", value: 48.83 }, { date: "2026-06-07", value: 270.95 }, { date: "2026-07-07", value: 469.29 },
        { date: "2026-08-07", value: 695.17 }, { date: "2026-09-07", value: 370.01 }, { date: "2026-10-07", value: 709.6 },
        { date: "2026-11-07", value: 676.48 },
      ],
    },
    accounts: [{ id: "u01-a1", name: "Current account", type: "current", balance: 976.48 }],
    liabilities: [{ type: "loan", name: "Budgeting Advance (DWP)", balance: 300.0 }],
    facts: [
      { key: "benefits_received", label: "Benefits", value: "Universal Credit, Child Benefit", source: "inferred", confidence: 0.98, confirmed: false, evidence: "DWP UC £1,353.07 on the 15th every month; HMRC Child Benefit £251.40 every 4 weeks", sensitivity: "financial", updated_at: "2026-11-07T09:00:00Z" },
      { key: "children_count", label: "Children", value: 3, source: "inferred", confidence: 0.9, confirmed: false, evidence: "Child Benefit of £251.40 every 4 weeks matches 3 children", sensitivity: "personal", updated_at: "2026-11-07T09:00:00Z" },
      { key: "employment_status", label: "Work", value: "Employed (part-time)", source: "inferred", confidence: 0.85, confirmed: false, evidence: "Swift Logistics pays £950 on the 28th", sensitivity: "personal", updated_at: "2026-11-07T09:00:00Z" },
      { key: "housing_tenure", label: "Home", value: "Council / social rent", source: "inferred", confidence: 0.8, confirmed: false, evidence: "£560 rent to Leeds CC Housing on the 1st", sensitivity: "personal", updated_at: "2026-11-07T09:00:00Z" },
      { key: "council", label: "Council", value: "Leeds City Council", source: "bank", confidence: 1, confirmed: true, evidence: "Council tax direct debit + postcode", sensitivity: "personal", updated_at: "2026-05-01T09:00:00Z" },
      { key: "preferred_language", label: "Language", value: "English", source: "user", confidence: 1, confirmed: true, sensitivity: "personal", updated_at: "2026-05-01T09:00:00Z" },
    ],
    profile_completeness: 0.45,
  };
}

export function initialNotifications(): FolaNotification[] {
  return [
    { id: "n1", type: "financial", severity: "warning", title: "New subscription doesn't look like you",
      body: "YouTube Music has charged you £10.99 every month since 3 September. You've never paid for music before.",
      money: { amount: 131.88, period: "year", direction: "save" },
      evidence: [
        { txn_id: "u01-t0187", date: "2026-09-03", merchant: "YouTube Music", amount: -10.99 },
        { txn_id: "u01-t0228", date: "2026-10-03", merchant: "YouTube Music", amount: -10.99 },
        { txn_id: "u01-t0273", date: "2026-11-03", merchant: "YouTube Music", amount: -10.99 },
      ],
      source_url: null, suggested_prompt: "Help me cancel YouTube Music", status: "new", created_at: "2026-11-07T09:00:00Z" },
    { id: "n2", type: "demographic", severity: "warning", title: "Your Universal Credit may be too low",
      body: "The two-child limit ended on 6 April 2026. You get Child Benefit for 3 children, but your UC hasn't gone up since. You could be missing £303.94 a month.",
      money: { amount: 303.94, period: "month", direction: "gain" },
      evidence: [
        { txn_id: "u01-t0016", date: "2026-05-15", merchant: "DWP Universal Credit", amount: 1353.07 },
        { txn_id: "u01-t0244", date: "2026-10-15", merchant: "DWP Universal Credit", amount: 1353.07 },
      ],
      source_url: "https://www.gov.uk/universal-credit/what-youll-get", suggested_prompt: "Is my Universal Credit wrong?", status: "new", created_at: "2026-11-07T09:01:00Z" },
    { id: "n3", type: "demographic", severity: "info", title: "Your children may get free school meals",
      body: "Since September 2026, every family on Universal Credit in England can get free school meals. You still pay ParentPay £46 a month.",
      money: { amount: 460, period: "year", direction: "save" },
      evidence: [{ txn_id: "u01-t0237", date: "2026-10-10", merchant: "ParentPay", amount: -46.0 }],
      source_url: "https://www.gov.uk/apply-free-school-meals", suggested_prompt: "How do I get free school meals?", status: "new", created_at: "2026-11-07T09:02:00Z" },
    { id: "n4", type: "financial", severity: "info", title: "Cheaper broadband you can get",
      body: "You pay Virgin Media £38 a month. People on Universal Credit can get Virgin Media Essential for £12.50.",
      money: { amount: 306, period: "year", direction: "save" },
      evidence: [{ txn_id: "u01-t0240", date: "2026-10-12", merchant: "Virgin Media", amount: -38.0 }],
      source_url: "https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs", suggested_prompt: "Switch me to cheaper broadband", status: "new", created_at: "2026-11-07T09:03:00Z" },
    { id: "n5", type: "demographic", severity: "info", title: "25% off council tax?",
      body: "If you're the only adult at home, you can get 25% off. You pay £118 a month in full.",
      money: { amount: 295, period: "year", direction: "save" },
      evidence: [{ txn_id: "u01-t0269", date: "2026-11-01", merchant: "Leeds City Council", amount: -118.0 }],
      source_url: "https://www.gov.uk/council-tax/who-has-to-pay", suggested_prompt: "Can I get 25% off council tax?", status: "seen", created_at: "2026-11-07T09:04:00Z" },
  ];
}

export interface MockActionDef extends FolaAction {
  notification_id: string;
  category: "financial" | "demographic";
  result_message: string;
  sources: string[];
  follow_up?: { reply: string; quick_replies?: string[] | undefined } | undefined;
}

export function initialActions(): Record<string, MockActionDef> {
  return {
    act1: {
      id: "act1", type: "send_email", title: "Cancel YouTube Music", impact: { amount: 131.88, period: "year" },
      preview: { to: "support@google.com", subject: "Please cancel my YouTube Music subscription", body: "Hello,\n\nPlease cancel my YouTube Music subscription immediately and refund the last charge of £10.99, which I did not knowingly agree to.\n\nThanks,\nDaniel Okafor" },
      status: "pending", notification_id: "n1", category: "financial", result_message: "Email sent to support@google.com", sources: [],
      follow_up: { reply: "Done. That's £131.88 a year back. While I've got you, would you be willing to answer a quick question? I think your Universal Credit might be too low.", quick_replies: ["Sure", "Not now"] },
    },
    act2: {
      id: "act2", type: "fill_form", title: "Ask UC to pay for all 3 children", impact: { amount: 303.94, period: "month" },
      preview: { form_name: "Universal Credit journal: report a change", fields: [
        { label: "Change", value: "Two-child limit removed from 6 April 2026" },
        { label: "Children living with me", value: "3 (born 2012, 2015, 2019)" },
        { label: "Request", value: "Please add the child element for my third child and back-date to 6 April 2026" },
      ] },
      status: "pending", notification_id: "n2", category: "demographic", result_message: "Message sent to your UC journal", sources: ["https://www.gov.uk/universal-credit/what-youll-get"],
      follow_up: { reply: "Sent. I've saved it to your report in case you need to show it later. Can I check one more thing? You may also be able to stop paying for school meals.", quick_replies: ["Go on", "Later"] },
    },
    act3: {
      id: "act3", type: "fill_form", title: "Apply for free school meals", impact: { amount: 460, period: "year" },
      preview: { form_name: "Free school meals (Leeds City Council)", fields: [
        { label: "Parent", value: "Daniel Okafor" }, { label: "Benefit", value: "Universal Credit" },
        { label: "Children", value: "3, all school age" }, { label: "Postcode", value: "LS9 7AB" },
      ] },
      status: "pending", notification_id: "n3", category: "demographic", result_message: "Form sent to Leeds City Council", sources: ["https://www.gov.uk/apply-free-school-meals"],
    },
  };
}

export function initialReports(): Report[] {
  return [
    {
      id: "r0", created_at: "2026-11-03T10:00:00Z", updated_at: "2026-11-03T10:05:00Z",
      title: "Checked your council tax", category: "demographic", status: "in_progress",
      money: { amount: 295, period: "year" },
      steps: [
        { at: "2026-11-03T10:00:00Z", kind: "noticed", text: "You pay full council tax (£118/month) but you're the only adult at home" },
        { at: "2026-11-03T10:02:00Z", kind: "proposed", text: "Fola suggested applying for the 25% single person discount" },
        { at: "2026-11-03T10:05:00Z", kind: "waiting", text: "Waiting for you to confirm no other adults live with you" },
      ],
      sources: ["https://www.gov.uk/council-tax/who-has-to-pay"],
      next_step: "Tell Fola if anyone else aged 18+ lives with you.",
    },
  ];
}
