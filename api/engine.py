"""Derives notifications (anomaly detector + rules engine) and the net-worth forecast from data/."""
from __future__ import annotations

import calendar
import math
import re
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean
from typing import Any

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

# ---------------------------------------------------------------- helpers


def _d(s: str) -> date:
    return date.fromisoformat(s[:10])


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _gbp(x: float) -> str:
    return f"£{x:,.2f}"


def _nice_date(d: date) -> str:
    return f"{d.day} {d.strftime('%b %Y')}"


def complete_months(transactions: list[dict]) -> list[str]:
    """Months ('YYYY-MM') fully covered by the transaction history."""
    if not transactions:
        return []
    dates = sorted(_d(t["date"]) for t in transactions)
    first, last = dates[0], dates[-1]
    out = []
    y, m = first.year, first.month
    while (y, m) <= (last.year, last.month):
        start = date(y, m, 1)
        end = date(y, m, calendar.monthrange(y, m)[1])
        if first <= start and last >= end:
            out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def avg_monthly(transactions: list[dict], pred) -> float:
    months = complete_months(transactions)
    if not months:
        return 0.0
    total = sum(t["amount"] for t in transactions if t["date"][:7] in months and pred(t))
    return total / len(months)


def resolved_ids(actions: list[dict]) -> tuple[set[str], set[str]]:
    """(notification/rule ids handled by an approved action, merchants cancelled)."""
    handled, cancelled = set(), set()
    for a in actions:
        if a.get("status") != "approved":
            continue
        if a.get("notification_id"):
            handled.add(a["notification_id"])
        if a.get("rule_id"):
            handled.add(a["rule_id"])
        if a.get("type") == "cancel_subscription" and a.get("merchant"):
            cancelled.add(a["merchant"].lower())
    return handled, cancelled


# ---------------------------------------------------------------- anomaly detector


def detect_new_recurring(transactions: list[dict], cancelled: set[str] | None = None) -> list[dict]:
    """Flag merchants with a recurring (roughly monthly, similar amount) outgoing charge
    that is absent from the earliest part of the history."""
    cancelled = cancelled or set()
    if not transactions:
        return []
    history_start = min(_d(t["date"]) for t in transactions)
    baseline_end = history_start + timedelta(days=30)

    by_merchant: dict[str, list[dict]] = defaultdict(list)
    for t in transactions:
        if t["amount"] < 0:
            by_merchant[t["merchant"]].append(t)

    established = sorted(
        {m for m, ts in by_merchant.items() if any(t.get("category") == "subscription" for t in ts)
         and min(_d(t["date"]) for t in ts) < baseline_end}
    )

    out = []
    for merchant, ts in by_merchant.items():
        if merchant.lower() in cancelled or len(ts) < 2:
            continue
        ts = sorted(ts, key=lambda t: t["date"])
        first = _d(ts[0]["date"])
        if first < baseline_end:
            continue  # merchant already present in the earliest history
        amounts = [abs(t["amount"]) for t in ts]
        avg = mean(amounts)
        if max(amounts) - min(amounts) > 0.1 * avg:
            continue  # not a fixed-price charge
        gaps = [(_d(b["date"]) - _d(a["date"])).days for a, b in zip(ts, ts[1:])]
        if not all(25 <= g <= 35 for g in gaps):
            continue  # not monthly
        out.append({
            "merchant": merchant,
            "monthly_amount": round(avg, 2),
            "first_seen": first.isoformat(),
            "charges": len(ts),
            "transaction_ids": [t["id"] for t in ts],
            "established_subscriptions": established,
        })
    return out


def anomaly_notifications(transactions: list[dict], actions: list[dict]) -> list[dict]:
    _, cancelled = resolved_ids(actions)
    notes = []
    for a in detect_new_recurring(transactions, cancelled):
        others = [m for m in a["established_subscriptions"] if m != a["merchant"]]
        other_txt = f" You already pay for {', '.join(others)}." if others else ""
        body = (
            f"A new {_gbp(a['monthly_amount'])} monthly charge from {a['merchant']} started on "
            f"{_nice_date(_d(a['first_seen']))} and has been taken {a['charges']} times. "
            f"It doesn't match anything in your earlier spending.{other_txt} "
            f"If you didn't mean to sign up, cancelling saves {_gbp(a['monthly_amount'] * 12)} a year."
        )
        notes.append({
            "id": f"n-sub-{_slug(a['merchant'])}",
            "type": "financial",
            "title": f"New {a['merchant']} subscription",
            "body": body,
            "severity": "medium",
            "rule_id": None,
            "transaction_ids": a["transaction_ids"],
            "suggested_action": "cancel_subscription",
            "merchant": a["merchant"],
            "monthly_value": a["monthly_amount"],
            "questions": ["Did you mean to sign up for this?"],
        })
    return notes


# ---------------------------------------------------------------- shortfall predictor
# Mirrors predictStops() in frontend/src/lib/api.ts so voice and screen quote the same number.

SHORTFALL_HORIZON_DAYS = 35


def _add_month_same_day(d: date) -> date:
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def current_account_balance(profile: dict) -> float:
    savings = sum(s.get("balance", 0) for s in profile.get("savings") or [])
    return float(profile.get("net_worth", 0.0)) - savings


def upcoming_payments(transactions: list[dict], today: date, horizon_days: int = SHORTFALL_HORIZON_DAYS):
    """(stops, recurring merchants): repeating payments (weekly, 4-weekly, monthly) due from today."""
    by_merchant: dict[str, list[dict]] = defaultdict(list)
    for t in transactions:
        by_merchant[t["merchant"]].append(t)
    horizon = today + timedelta(days=horizon_days)
    stops, recurring = [], set()
    for merchant, ts in by_merchant.items():
        if len(ts) < 2 or len({round(t["amount"]) for t in ts}) > 1:
            continue
        ts = sorted(ts, key=lambda t: t["date"])
        gaps = sorted((_d(b["date"]) - _d(a["date"])).days for a, b in zip(ts, ts[1:]))
        gap = gaps[len(gaps) // 2]
        if 6 <= gap <= 8:
            step, weekly = (lambda d: d + timedelta(days=7)), True
        elif 27 <= gap <= 28.5:
            step, weekly = (lambda d: d + timedelta(days=28)), False
        elif 28.5 < gap <= 32:
            step, weekly = _add_month_same_day, False
        else:
            continue
        recurring.add(merchant)
        last = ts[-1]
        cur = _d(last["date"])
        while True:
            cur = step(cur)
            if cur > horizon:
                break
            if cur < today:
                continue
            stops.append({"merchant": merchant, "date": cur, "amount": last["amount"], "weekly": weekly,
                          "category": last.get("category"), "transaction_ids": [t["id"] for t in ts]})
    stops.sort(key=lambda s: (s["date"], -s["amount"]))
    return stops, recurring


def predict_shortfall(profile: dict, transactions: list[dict], today: date | None = None) -> dict | None:
    """Walk the current-account balance forward through upcoming bills plus average everyday
    spending. Returns the first bill that would take it below zero, or None."""
    if not transactions:
        return None
    today = today or date.today()
    stops, recurring = upcoming_payments(transactions, today)
    if not stops:
        return None
    last_date = max(_d(t["date"]) for t in transactions)
    since = last_date - timedelta(days=60)
    everyday = -sum(t["amount"] for t in transactions
                    if t["merchant"] not in recurring and t["amount"] < 0 and _d(t["date"]) > since) / 60
    bal, at = current_account_balance(profile), today
    for i, s in enumerate(stops):
        bal -= everyday * max(0, (s["date"] - at).days)
        at = s["date"]
        bal += s["amount"]
        if not s["weekly"] and s["amount"] < 0 and bal < 0:
            income = next((x for x in stops[i + 1:] if x["amount"] > 0), None)
            return {
                "merchant": s["merchant"],
                "category": s["category"],
                "due_date": s["date"].isoformat(),
                "amount": round(-s["amount"], 2),
                "shortfall": math.ceil(-bal),
                "everyday_spend_per_day": round(everyday, 2),
                "transaction_ids": s["transaction_ids"],
                "next_income": {"merchant": income["merchant"], "date": income["date"].isoformat(),
                                "amount": round(income["amount"], 2)} if income else None,
            }
    return None


def shortfall_notifications(profile: dict, transactions: list[dict], actions: list[dict],
                            today: date | None = None) -> list[dict]:
    sf = predict_shortfall(profile, transactions, today)
    if not sf:
        return []
    is_rent = sf["category"] == "rent"
    nid = "n-rent-shortfall" if is_rent else f"n-shortfall-{_slug(sf['merchant'])}"
    done = [a for a in actions if a.get("notification_id") == nid and a.get("status") == "approved"]
    if any(a.get("type") != "set_reminder" for a in done):
        return []  # money moved or otherwise sorted
    what = "rent" if is_rent else f"{sf['merchant']} payment"
    due = _d(sf["due_date"])
    income = sf["next_income"]
    before_txt = ""
    if income and income["merchant"] and (_d(income["date"]) - due).days > 0:
        days = (_d(income["date"]) - due).days
        before_txt = (f", {days} day{'s' if days != 1 else ''} before your {income['merchant']} payment "
                      f"arrives on {_nice_date(_d(income['date']))}")
    body = (f"Your {_gbp(sf['amount'])} {what} to {sf['merchant']} is due on {due.strftime('%a')} "
            f"{_nice_date(due)}{before_txt}. With your usual spending you may be about "
            f"£{sf['shortfall']} short. ")
    body += ("Missed rent can lead to arrears, so it's worth sorting now." if is_rent
             else "A failed payment can bring a charge, so it's worth sorting now.")
    return [{
        "id": nid,
        "type": "financial",
        "title": f"You may be about £{sf['shortfall']} short for {what}",
        "body": body,
        "severity": "high",
        "rule_id": None,
        "transaction_ids": sf["transaction_ids"],
        "suggested_action": "top_up_transfer",
        "merchant": sf["merchant"],
        "due_date": sf["due_date"],
        "shortfall": sf["shortfall"],
        "bill_amount": sf["amount"],
        "next_income": income,
        "monthly_value": None,
        "reminder_set": bool(done),
        "questions": ["Would you like a reminder, or to move a little money across from savings before then?"],
    }]


# ---------------------------------------------------------------- rules engine


def derived_fields(profile: dict) -> dict:
    hh = profile.get("household", {}) or {}
    children = hh.get("children", []) or []
    benefits = profile.get("benefits", []) or []
    uc = next((b for b in benefits if b.get("name") == "Universal Credit"), None)
    housing = profile.get("housing", {}) or {}
    ctx = {
        "on_universal_credit": uc is not None,
        "uc_children_included": (uc or {}).get("children_included", 0),
        "children_count": len(children),
        "youngest_child_age": min((c.get("age", 99) for c in children), default=None),
        "school_age_children_count": sum(1 for c in children if c.get("in_school") or 5 <= c.get("age", 0) <= 16),
        "adults": hh.get("adults", 1),
        "monthly_earned_income": profile.get("monthly_earned_income", profile.get("monthly_income", 0)),
        "nation": profile.get("nation", "England"),
        "council": profile.get("council"),
        "council_tax_discounts": housing.get("council_tax_discounts", []),
        "benefit_names": [b.get("name") for b in benefits],
    }
    facts = profile.get("facts", {}) or {}
    ages = facts.get("children_ages") or [c.get("age") for c in children]
    try:
        ctx["all_children_under_18"] = all(int(a) < 18 for a in ages) if ages else None
    except (TypeError, ValueError):
        ctx["all_children_under_18"] = None
    ctx.update(facts)
    return ctx


def _check(cond: dict, ctx: dict) -> tuple[bool | None, str]:
    field, op = cond["field"], cond["op"]
    if field not in ctx or ctx[field] is None:
        return None, f"{field} unknown"
    left = ctx[field]
    right = ctx.get(cond["value_field"]) if "value_field" in cond else cond.get("value")
    try:
        ok = {
            "==": lambda: left == right,
            "!=": lambda: left != right,
            ">=": lambda: left >= right,
            ">": lambda: left > right,
            "<=": lambda: left <= right,
            "<": lambda: left < right,
            "contains": lambda: right in left,
            "not_contains": lambda: right not in left,
        }[op]()
    except (KeyError, TypeError):
        return None, f"cannot evaluate {field} {op}"
    return ok, f"{field} {op} {cond.get('value_field', right)} (is {left})"


def _required_facts(rule: dict) -> list[tuple[str, Any, str]]:
    """Normalise required_facts: {key: expected} (+ fact_questions) or [{key, expected, question}]."""
    elig = rule.get("eligibility", {}) or {}
    req = elig.get("required_facts") or {}
    fq = elig.get("fact_questions") or {}
    fu = rule.get("follow_up_questions") or []
    out = []
    if isinstance(req, dict):
        for i, (k, exp) in enumerate(req.items()):
            q = fq.get(k) or (fu[i] if i < len(fu) else f"Can you tell me about {k.replace('_', ' ')}?")
            out.append((k, exp, q))
    else:
        for f in req:
            out.append((f["key"], f.get("expected", True), f.get("question", f["key"])))
    return out


def evaluate_rule(rule: dict, profile: dict, transactions: list[dict]) -> dict:
    ctx = derived_fields(profile)
    elig = rule.get("eligibility", {}) or {}
    passed, failed, unknown = [], [], []
    for cond in elig.get("all", []):
        ok, why = _check(cond, ctx)
        (passed if ok else unknown if ok is None else failed).append(why)

    questions, contradicted = [], []
    for key, expected, question in _required_facts(rule):
        if key not in ctx or ctx[key] is None:
            questions.append(question)
        elif ctx[key] != expected:
            contradicted.append(f"{key} is {ctx[key]}")

    if failed or contradicted:
        status = "not_eligible"
    elif questions or unknown:
        status = "needs_info"
    else:
        status = "eligible"

    return {
        "rule_id": rule["id"],
        "name": rule["name"],
        "status": status,
        "passed": passed,
        "failed": failed + contradicted,
        "unknown": unknown,
        "questions": questions,
        "monthly_value": rule_value(rule, ctx, transactions),
        "source_url": rule.get("source_url"),
    }


def rule_value(rule: dict, ctx: dict, transactions: list[dict]) -> float:
    basis = rule.get("value_basis", "fixed")
    base = rule.get("monthly_value") or 0.0
    if basis == "per_missing_child":
        missing = max(0, ctx.get("children_count", 0) - ctx.get("uc_children_included", 0))
        return round(base * missing, 2)
    vft = rule.get("value_from_transactions")
    if vft:
        def pred(t):
            if "category" in vft and t.get("category") != vft["category"]:
                return False
            if "merchant" in vft and t.get("merchant") != vft["merchant"]:
                return False
            if "description_contains" in vft and vft["description_contains"] not in t.get("description", ""):
                return False
            return t["amount"] < 0
        spend = -avg_monthly(transactions, pred)
        if basis == "percent_of_council_tax":
            return round(spend * rule.get("value_percent", 0) / 100, 2)
        return round(spend, 2)
    return round(base, 2)


def evaluate_all(profile: dict, rules: list[dict], transactions: list[dict]) -> list[dict]:
    return [evaluate_rule(r, profile, transactions) for r in rules]


def rule_notifications(profile, rules, transactions, actions) -> list[dict]:
    handled, _ = resolved_ids(actions)
    notes = []
    for rule in rules:
        nid = rule.get("notification_id") or f"n-{_slug(rule['id'])}"
        if nid in handled or rule["id"] in handled:
            continue
        ev = evaluate_rule(rule, profile, transactions)
        if ev["status"] == "not_eligible":
            continue
        value = ev["monthly_value"]
        value_txt = f" That could be worth about {_gbp(value)} a month." if value else ""
        if ev["status"] == "eligible":
            lead = "You look eligible."
        else:
            lead = "You may be eligible; I just need to check: " + " ".join(ev["questions"])
        severity = "high" if value >= 100 else "medium" if value >= 10 or rule.get("type") == "benefit" else "low"
        notes.append({
            "id": nid,
            "type": "demographic",
            "title": rule["name"],
            "body": f"{rule['description']} {lead}{value_txt}",
            "severity": severity,
            "rule_id": rule["id"],
            "transaction_ids": [],
            "suggested_action": rule.get("action_type"),
            "eligibility_status": ev["status"],
            "questions": ev["questions"],
            "monthly_value": value,
            "source_url": rule.get("source_url"),
        })
    return notes


def build_notifications(profile, transactions, rules, actions) -> list[dict]:
    notes = (shortfall_notifications(profile, transactions, actions)
             + rule_notifications(profile, rules, transactions, actions)
             + anomaly_notifications(transactions, actions))
    # A bill about to bounce is the most urgent thing, so it leads.
    notes.sort(key=lambda n: (SEVERITY_ORDER.get(n["severity"], 9), not n.get("shortfall"),
                              -(n.get("monthly_value") or 0)))
    return notes


# ---------------------------------------------------------------- forecast


def _add_months(ym: str, n: int) -> str:
    y, m = int(ym[:4]), int(ym[5:7])
    m += n
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return f"{y:04d}-{m:02d}"


def forecast(profile, transactions, notifications, actions, months: int = 12,
             eligibility: list[dict] | None = None) -> dict:
    """with_actions counts only money we're confident about: cancellations the user controls and
    benefits whose rules they already meet. Benefits that still need answers go in with_possible."""
    current = float(profile.get("net_worth", 0.0))
    hist = profile.get("net_worth_history") or []
    start_month = hist[-1]["month"] if hist else date.today().strftime("%Y-%m")
    full = complete_months(transactions)
    avg_flow = avg_monthly(transactions, lambda t: True)
    status_by_rule = {e["rule_id"]: e["status"] for e in (eligibility or [])}

    assumptions = [
        f"Baseline: your average net flow over {len(full)} full months of transactions "
        f"({', '.join(full)}) is {_gbp(avg_flow) if avg_flow >= 0 else '-' + _gbp(-avg_flow)} a month, "
        "and it carries on unchanged."
    ]

    baseline_adj = 0.0
    for a in actions:
        if a.get("status") == "approved" and a.get("type") == "cancel_subscription" and a.get("monthly_value"):
            baseline_adj += a["monthly_value"]
            assumptions.append(f"Already done: {a['title']} saves {_gbp(a['monthly_value'])}/mo.")

    uplift = possible = 0.0
    maybe: list[str] = []
    counted: set[str] = set()
    for n in notifications:
        v = n.get("monthly_value") or 0
        if v <= 0:
            continue
        counted.add(n["id"])
        if n["type"] == "financial":
            uplift += v
            assumptions.append(f"Cancel {n.get('merchant', n['title'])} saves {_gbp(v)}/mo.")
        elif n.get("eligibility_status") == "eligible":
            uplift += v
            assumptions.append(f"{n['title']} adds about {_gbp(v)}/mo (you meet the rules).")
        else:
            possible += v
            maybe.append(f"{n['title']} (up to {_gbp(v)}/mo)")
    for a in actions:
        v = a.get("monthly_value") or 0
        nid = a.get("notification_id")
        if v <= 0 or (nid and nid in counted):
            continue
        if a.get("status") == "pending" or (a.get("status") == "approved" and a.get("type") != "cancel_subscription"):
            if nid:
                counted.add(nid)
            state = "pending your OK" if a["status"] == "pending" else "submitted, awaiting decision"
            if a.get("type") == "cancel_subscription" or status_by_rule.get(a.get("rule_id")) == "eligible":
                uplift += v
                assumptions.append(f"{a['title']} ({state}) adds about {_gbp(v)}/mo.")
            else:
                possible += v
                maybe.append(f"{a['title']} ({state}, up to {_gbp(v)}/mo)")
    if maybe:
        assumptions.append("Not counted until we confirm you qualify: " + "; ".join(maybe) + ".")
    assumptions.append("No new debts, price rises or one-off costs are included. Figures are estimates, not advice.")

    baseline, with_actions, with_possible = [], [], []
    for i in range(1, months + 1):
        m = _add_months(start_month, i)
        b = current + (avg_flow + baseline_adj) * i
        baseline.append({"month": m, "net_worth": round(b, 2)})
        with_actions.append({"month": m, "net_worth": round(b + uplift * i, 2)})
        with_possible.append({"month": m, "net_worth": round(b + (uplift + possible) * i, 2)})

    return {
        "current_net_worth": round(current, 2),
        "horizon_months": months,
        "average_monthly_net_flow": round(avg_flow, 2),
        "monthly_uplift_from_actions": round(uplift, 2),
        "monthly_uplift_possible": round(possible, 2),
        "baseline": baseline,
        "with_actions": with_actions,
        "with_possible": with_possible,
        "upcoming_risks": [{k: n.get(k) for k in ("id", "title", "merchant", "due_date", "shortfall", "bill_amount")}
                           for n in notifications if n.get("shortfall")],
        "assumptions": assumptions,
    }
