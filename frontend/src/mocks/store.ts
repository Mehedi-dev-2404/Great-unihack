// In-memory mock backend. Lives only in the browser tab; resets on reload.
import type { ApproveResponse, ChatResponse, Fact, FolaAction, ProfileUpdate, Report } from "@/lib/types";
import { initialActions, initialNotifications, initialProfile, initialReports, type MockActionDef } from "./data";
import { buildForecast } from "./forecast";

const state = {
  profile: initialProfile(),
  notifications: initialNotifications(),
  actions: initialActions(),
  reports: initialReports(),
  voiceListeningSince: 0,
  convCounter: 0,
  reportCounter: 0,
};

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function publicAction(a: MockActionDef): FolaAction {
  return { id: a.id, type: a.type, title: a.title, impact: a.impact, preview: a.preview, status: a.status, pdf_url: a.pdf_url };
}

export const mock = {
  profile: () => clone(state.profile),
  notifications: () => clone(state.notifications),
  reports: () =>
    clone([...state.reports].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))),
  forecast: () => buildForecast(),

  setVoiceListening(on: boolean) {
    state.voiceListeningSince = on ? Date.now() : 0;
  },
  pendingActions(): FolaAction[] {
    const a = state.actions["act1"];
    if (a && state.voiceListeningSince && Date.now() - state.voiceListeningSince >= 5000 && a.status === "pending") {
      return [publicAction(a)];
    }
    return [];
  },

  applyProfileUpdates(updates: ProfileUpdate[]) {
    for (const u of updates) {
      const f = state.profile.facts.find((x) => x.key === u.key);
      const now = new Date().toISOString();
      if (f) {
        f.value = u.value;
        if (u.confirmed) {
          f.confirmed = true;
          f.source = "user";
          f.confidence = 1;
        }
        f.updated_at = now;
      } else {
        state.profile.facts.push({ key: u.key, label: u.label, value: u.value, source: "user", confidence: 1, confirmed: u.confirmed, sensitivity: "personal", updated_at: now });
      }
    }
    recomputeCompleteness();
  },

  patchFact(key: string, patch: Partial<Fact>) {
    const f = state.profile.facts.find((x) => x.key === key);
    if (!f) throw new Error("Not found");
    Object.assign(f, patch, { updated_at: new Date().toISOString() });
    if (patch.confirmed || patch.value !== undefined) {
      f.confirmed = true;
      f.source = "user";
      f.confidence = 1;
    }
    recomputeCompleteness();
    return clone(f);
  },
  deleteFact(key: string) {
    state.profile.facts = state.profile.facts.filter((f) => f.key !== key);
  },

  approve(id: string, userQuote: string): ApproveResponse {
    const a = state.actions[id];
    if (!a) throw new Error("Unknown action");
    a.status = "approved";
    const now = new Date();
    const t = (offsetSec: number) => new Date(now.getTime() + offsetSec * 1000).toISOString();
    const n = state.notifications.find((x) => x.id === a.notification_id);
    if (n) n.status = "resolved";
    state.reportCounter += 1;
    const report: Report = {
      id: `r${state.reportCounter}`,
      created_at: t(-60),
      updated_at: t(0),
      title: a.title,
      category: a.category,
      status: "resolved",
      money: a.impact ?? null,
      steps: [
        ...(n ? [{ at: n.created_at, kind: "noticed" as const, text: n.body }] : []),
        { at: t(-30), kind: "proposed", text: `Fola suggested: ${a.title}`, action_id: a.id, preview: a.preview },
        { at: t(-2), kind: "approved", text: "You said yes", action_id: a.id, user_quote: userQuote },
        { at: t(0), kind: "done", text: a.result_message, action_id: a.id },
      ],
      sources: a.sources.length ? a.sources : n?.source_url ? [n.source_url] : [],
    };
    state.reports.push(report);
    return { action: publicAction(a), result: { message: a.result_message, follow_up: a.follow_up }, report_id: report.id };
  },
  decline(id: string) {
    const a = state.actions[id];
    if (!a) throw new Error("Unknown action");
    a.status = "declined";
    return { action: publicAction(a) };
  },
  deleteReport(id: string) {
    state.reports = state.reports.filter((r) => r.id !== id);
  },
  deleteEverything() {
    state.reports = [];
    state.profile.facts = state.profile.facts.filter((f) => f.source !== "user");
  },

  chat(message: string, conversation_id?: string, notification_id?: string): ChatResponse {
    const cid = conversation_id ?? `c${++state.convCounter}-${Date.now()}`;
    return { conversation_id: cid, ...scriptedReply(message, notification_id) };
  },
};

function recomputeCompleteness() {
  const facts = state.profile.facts;
  const confirmed = facts.filter((f) => f.confirmed).length;
  state.profile.profile_completeness = Math.min(1, 0.3 + confirmed * 0.08);
}

function act(id: string): FolaAction | null {
  const a = state.actions[id];
  return a && a.status === "pending" ? publicAction(a) : null;
}

const NOT_NOW = "No problem. I'll only ask again if I spot something worth your time.";

function scriptedReply(raw: string, notificationId?: string): Omit<ChatResponse, "conversation_id"> {
  const m = raw.trim().toLowerCase();
  const has = (...w: string[]) => w.some((x) => m.includes(x));

  if (m === "yes, all three" || m === "yes all three") {
    const update: ProfileUpdate = { key: "children_count", label: "Children", value: 3, confirmed: true };
    mock.applyProfileUpdates([update]);
    return {
      reply: "Thanks. Then your UC should be about £303.94 a month higher. I've written a message for your UC journal asking them to add the child amount for your third child and back-pay it from April. Shall I send it?",
      profile_updates: [update],
      pending_action: act("act2"),
    };
  }
  if (m === "not now" || m === "skip" || m === "later" || m === "no") return { reply: NOT_NOW };
  if (m === "go on" || has("school meal")) return schoolMeals();
  if (m === "sure" || has("universal credit", "child", " uc", "uc ")) return ucFlow();
  if (has("youtube", "subscription", "cancel")) return youtube();
  if (/\bok\b/.test(m) || has("month", "payday")) {
    return { reply: "Looking ahead, you'll be fine this month: rent and council tax go out on 1 December and you'll have about £1,000 left after. If you act on my suggestions you could have £2,496 more by February." };
  }
  if (notificationId === "n1") return youtube();
  if (notificationId === "n2") return ucFlow();
  if (notificationId === "n3") return schoolMeals();
  return { reply: "I can help with bills, subscriptions, benefits you might be missing, or planning ahead. What's on your mind?" };
}

function youtube() {
  return {
    reply: "YouTube Music started charging you £10.99 a month on 3 September. You've never paid for music before, so this might not be something you meant to sign up for. I've written to Google asking them to cancel it and refund the last charge. Want me to send it?",
    pending_action: act("act1"),
  };
}
function ucFlow() {
  const update: ProfileUpdate = { key: "children_count", label: "Children", value: 3, confirmed: false };
  return {
    reply: "I can see Child Benefit coming in for three children, but your Universal Credit hasn't gone up since April. Since 6 April 2026 the two-child limit has ended, so UC should pay for every child. Do all three children live with you?",
    quick_replies: ["Yes, all three", "No", "Skip"],
    profile_updates: [update],
  };
}
function schoolMeals() {
  return {
    reply: "Since September, every family on Universal Credit in England gets free school meals. You're still paying ParentPay £46 a month. I've filled in Leeds City Council's form. Send it?",
    pending_action: act("act3"),
  };
}
