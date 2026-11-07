"""Fola's brain: Claude tool use over deterministic money and benefit helpers.

Public interface (see docs/PROJECT.md):

    chat(message, context, history=None) -> {reply, pending_action?, profile_updates?}
    draft_action(action_type, context, notification=None, notes=None) -> Action (no id/status/created_at)

context = {"profile": {...}, "transactions": [...], "rules": [...], "notifications": [...]}
history = [{"role": "user" | "assistant", "content": "plain text"}, ...] oldest first.

The deterministic helpers (detect_anomalies, check_eligibility, check_all_eligibility,
spending_summary) never call the network and are unit-tested on their own.
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

log = logging.getLogger("fola.brain")

AGENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = AGENT_DIR.parent
SYSTEM_PROMPT_PATH = AGENT_DIR / "prompts" / "system.md"

try:  # load ANTHROPIC_API_KEY etc. from the repo-root .env (never printed)
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env", override=False)
except Exception:  # pragma: no cover - dotenv is optional at import time
    pass

DEFAULT_MODEL = "claude-opus-5-5"
MAX_TOOL_ROUNDS = 6
FALLBACK_REPLY = (
    "Sorry, I'm having a bit of trouble thinking right now. "
    "Your information is safe. Please try again in a moment."
)

ACTION_TYPES = ("cancel_subscription", "send_email", "submit_claim", "fill_form")

# Who receives a cancellation message, and how the user can cancel themselves.
# No email addresses: we only name a recipient descriptively unless a contact is verified.
VENDOR_CONTACTS = {
    "youtube music": {"to": "YouTube Music customer support (via Google Payments)",
                      "how": "the YouTube app or youtube.com: your profile, Purchases and memberships, YouTube Music, Deactivate"},
    "youtube premium": {"to": "YouTube Premium customer support (via Google Payments)",
                        "how": "the YouTube app or youtube.com: your profile, Purchases and memberships, Deactivate"},
    "spotify": {"to": "Spotify customer support", "how": "your Spotify account page: Manage your plan, Cancel"},
    "netflix": {"to": "Netflix customer service", "how": "your Netflix account page: Cancel membership"},
    "disney+": {"to": "Disney+ customer support", "how": "your Disney+ account: Subscription, Cancel"},
    "amazon prime": {"to": "Amazon customer service", "how": "your Amazon account: Prime membership, End membership"},
    "apple": {"to": "Apple Support", "how": "iPhone Settings: your name, Subscriptions"},
}

SUBSCRIPTION_CATEGORIES = {
    "subscription", "subscriptions", "entertainment", "streaming", "music", "digital",
    "software", "apps", "media", "gaming",
}
SUBSCRIPTION_HINTS = (
    "music", "premium", "prime", "netflix", "spotify", "disney", "subscription", "membership",
    "youtube", "apple.com", "itunes", "audible", "now tv", "xbox", "playstation", "icloud",
)

NUMBER_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight"}


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    s = str(value)[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def _month(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _merchant_of(tx: dict) -> str:
    return str(tx.get("merchant") or tx.get("description") or "Unknown").strip()


def _money(x: float) -> str:
    return f"£{abs(x):,.2f}"


def _profile_facts(context: dict) -> dict:
    profile = context.get("profile") or {}
    facts = dict(profile.get("facts") or {})
    facts.update(context.get("_session_facts") or {})
    return facts


def _children(profile: dict) -> list[dict]:
    hh = profile.get("household") or {}
    kids = hh.get("children") or profile.get("children") or []
    return [k for k in kids if isinstance(k, dict)]


def _has_benefit(profile: dict, name: str) -> bool:
    target = _norm(name)
    for b in profile.get("benefits") or []:
        bname = _norm(b.get("name") if isinstance(b, dict) else b)
        if target in bname or bname in target:
            return True
    return False


def _benefit(profile: dict, name: str) -> dict | None:
    target = _norm(name)
    for b in profile.get("benefits") or []:
        if isinstance(b, dict) and target in _norm(b.get("name")):
            return b
    return None


def _truthy(v: Any) -> bool | None:
    if isinstance(v, bool):
        return v
    if v is None:
        return None
    s = _norm(v)
    if s in {"true", "yes", "y", "1"}:
        return True
    if s in {"false", "no", "n", "0"}:
        return False
    return None


def strip_markdown(text: str) -> str:
    """Make model output safe for text-to-speech: no markdown, bullets or emoji."""
    if not text:
        return ""
    t = text
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"(\*\*|__)(.*?)\1", r"\2", t)
    t = re.sub(r"(?<!\w)[*_](?!\s)(.+?)(?<!\s)[*_](?!\w)", r"\1", t)
    t = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", t, flags=re.M)
    t = re.sub(r"^\s*>\s?", "", t, flags=re.M)
    t = re.sub(r"^\s*[-*_]{3,}\s*$", "", t, flags=re.M)
    t = re.sub(r"[\U0001F300-\U0001FAFF☀-➿️]", "", t)
    t = t.replace("*", "").replace("#", "")
    # Join the remaining lines into flowing speech.
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    out = ""
    for ln in lines:
        if out and not out.endswith((".", "!", "?", ":", ",")):
            out += "."
        out += (" " if out else "") + ln
    return re.sub(r"\s{2,}", " ", out).strip()


# ---------------------------------------------------------------------------
# Deterministic helper 1: subscription anomaly detection
# ---------------------------------------------------------------------------

def _looks_like_subscription(merchant: str, txs: list[dict]) -> bool:
    cats = {_norm(t.get("category")) for t in txs}
    if cats & SUBSCRIPTION_CATEGORIES:
        return True
    m = _norm(merchant)
    if any(h in m for h in SUBSCRIPTION_HINTS):
        return True
    amounts = {round(abs(float(t.get("amount") or 0)), 2) for t in txs}
    months = {_month(_parse_date(t.get("date"))) for t in txs if _parse_date(t.get("date"))}
    return len(txs) >= 2 and len(amounts) == 1 and len(months) == len(txs)


def detect_anomalies(transactions: list[dict], today: date | str | None = None,
                     new_window_days: int = 90, min_history_days: int = 30) -> list[dict]:
    """Flag recurring charges that appear only recently with no earlier history.

    A merchant is an anomaly when its first payment is within ``new_window_days`` of
    the latest transaction, the account has at least ``min_history_days`` of history
    before that first payment, and the charge looks like a subscription.
    Long-standing subscriptions (seen since early in the history) are not flagged.
    """
    dated = []
    for t in transactions or []:
        d = _parse_date(t.get("date"))
        try:
            amt = float(t.get("amount") or 0)
        except (TypeError, ValueError):
            continue
        if d is not None:
            dated.append((d, amt, t))
    if not dated:
        return []
    history_start = min(d for d, _, _ in dated)
    end = _parse_date(today) or max(d for d, _, _ in dated)

    by_merchant: dict[str, list[tuple[date, float, dict]]] = defaultdict(list)
    for d, amt, t in dated:
        if amt < 0:
            by_merchant[_norm(_merchant_of(t))].append((d, amt, t))

    anomalies = []
    for key, rows in by_merchant.items():
        rows.sort(key=lambda r: r[0])
        first, last = rows[0][0], rows[-1][0]
        txs = [r[2] for r in rows]
        merchant = _merchant_of(txs[-1])
        if (end - first).days > new_window_days:
            continue
        if (first - history_start).days < min_history_days:
            continue
        if not _looks_like_subscription(merchant, txs):
            continue
        amount = round(abs(rows[-1][1]), 2)
        months_seen = sorted({_month(d) for d, _, _ in rows})
        contact = VENDOR_CONTACTS.get(_norm(merchant))
        anomalies.append({
            "merchant": merchant,
            "amount": amount,
            "monthly_cost": amount,
            "annual_cost": round(amount * 12, 2),
            "first_seen": first.isoformat(),
            "last_seen": last.isoformat(),
            "months_seen": len(months_seen),
            "occurrences": len(rows),
            "category": txs[-1].get("category"),
            "transaction_ids": [t.get("id") for t in txs if t.get("id")],
            "history_months_before": max(0, _months_between(history_start, first)),
            "reason": (
                f"New recurring charge from {merchant} of {_money(amount)} first seen on "
                f"{first.isoformat()}, with no payments to them in the "
                f"{(first - history_start).days} days of history before that."
            ),
            "vendor_contact": contact,
        })
    anomalies.sort(key=lambda a: a["first_seen"], reverse=True)
    return anomalies


# ---------------------------------------------------------------------------
# Deterministic helper 2: monthly spending summary
# ---------------------------------------------------------------------------

def spending_summary(transactions: list[dict], months: int | None = None) -> dict:
    """Money in, money out and top categories per calendar month (oldest first)."""
    buckets: dict[str, dict] = {}
    for t in transactions or []:
        d = _parse_date(t.get("date"))
        if d is None:
            continue
        try:
            amt = float(t.get("amount") or 0)
        except (TypeError, ValueError):
            continue
        b = buckets.setdefault(_month(d), {"month": _month(d), "money_in": 0.0, "money_out": 0.0,
                                           "categories": defaultdict(float)})
        if amt >= 0:
            b["money_in"] += amt
        else:
            b["money_out"] += -amt
            b["categories"][t.get("category") or "other"] += -amt
    rows = []
    for m in sorted(buckets):
        b = buckets[m]
        cats = sorted(b["categories"].items(), key=lambda kv: kv[1], reverse=True)
        rows.append({
            "month": m,
            "money_in": round(b["money_in"], 2),
            "money_out": round(b["money_out"], 2),
            "net": round(b["money_in"] - b["money_out"], 2),
            "top_categories": [{"category": c, "amount": round(v, 2)} for c, v in cats[:5]],
        })
    if months:
        rows = rows[-months:]
    avg_out = round(sum(r["money_out"] for r in rows) / len(rows), 2) if rows else 0.0
    avg_in = round(sum(r["money_in"] for r in rows) / len(rows), 2) if rows else 0.0
    return {"months": rows, "average_money_in": avg_in, "average_money_out": avg_out,
            "average_net": round(avg_in - avg_out, 2)}


# ---------------------------------------------------------------------------
# Deterministic helper 3: benefit eligibility
# ---------------------------------------------------------------------------

def _result(rule: dict, status: str, reason: str, question: str | None = None, **extra) -> dict:
    out = {
        "rule_id": rule.get("id"),
        "rule_name": rule.get("name"),
        "status": status,
        "reason": reason,
        "monthly_value": rule.get("monthly_value"),
        "source_url": rule.get("source_url"),
        "action_type": rule.get("action_type"),
    }
    if question:
        out["question"] = question
        out["missing_fact"] = extra.pop("missing_fact", None)
    out.update(extra)
    return out


def _is_uc_child_rule(rule: dict) -> bool:
    rid = _norm(rule.get("id"))
    name = _norm(rule.get("name"))
    return ("two_child" in rid or "child_element" in rid or "two-child" in name
            or "two child" in name or ("child element" in name and "universal credit" in name))


def _children_question(n: int) -> str:
    if n <= 1:
        return "Does your child live with you, and are they under 18?"
    if n == 2:
        return "Do both of your children live with you, and are they both under 18?"
    word = NUMBER_WORDS.get(n, str(n))
    return f"Do all {word} of your children live with you, and are they all under 18?"


def _check_uc_child_element(rule: dict, profile: dict, facts: dict) -> dict:
    kids = _children(profile)
    n = len(kids)
    if not _has_benefit(profile, "Universal Credit"):
        return _result(rule, "not_eligible",
                       "The extra child element is part of Universal Credit, and you are not "
                       "currently getting Universal Credit.")
    if n < 3:
        return _result(rule, "not_eligible",
                       f"The two-child limit only affected families with three or more children. "
                       f"You have {n}, so your Universal Credit should already include "
                       f"them all.")

    live = _truthy(facts.get("children_live_with_user"))
    if live is None:
        return _result(rule, "needs_info", "We need to check who lives with you.",
                       _children_question(n), missing_fact="children_live_with_user")
    if live is False:
        return _result(rule, "not_eligible",
                       "The child element is paid to the person the children normally live with, "
                       "so it can't be added to your claim for children who live elsewhere.")

    # Ages: confirmed in facts beat the profile.
    ages = facts.get("children_ages")
    if isinstance(ages, (list, tuple)) and ages:
        try:
            ages = [int(a) for a in ages]
        except (TypeError, ValueError):
            ages = None
    else:
        ages = None
    under_18 = _truthy(facts.get("children_all_under_18", facts.get("children_eligible_age")))
    if ages is None:
        if under_18 is None:
            profile_ages = [k.get("age") for k in kids if isinstance(k.get("age"), (int, float))]
            if len(profile_ages) == n:
                # Living-with confirmed in conversation and ages are in the profile.
                ages = [int(a) for a in profile_ages]
            else:
                return _result(rule, "needs_info", "We need to check your children's ages.",
                               _children_question(n), missing_fact="children_all_under_18")
        elif under_18:
            ages = [min(int(k.get("age", 0) or 0), 17) for k in kids] or [0] * n

    in_education = _truthy(facts.get("older_children_in_approved_education"))
    qualifying = 0
    needs_edu = False
    for a in ages or []:
        if a < 18:
            qualifying += 1
        elif a < 20:
            if in_education is True:
                qualifying += 1
            elif in_education is None:
                needs_edu = True
    if needs_edu:
        return _result(rule, "needs_info", "An older child may still count if they are in education.",
                       "Is your older child still in full-time school or college, like A levels?",
                       missing_fact="older_children_in_approved_education")

    paid = facts.get("uc_child_elements_paid")
    if paid is None:
        uc = _benefit(profile, "Universal Credit") or {}
        paid = uc.get("child_elements_paid", uc.get("children_included", 2))
    try:
        paid = int(paid)
    except (TypeError, ValueError):
        paid = 2
    missing = max(0, qualifying - paid)
    if missing == 0:
        return _result(rule, "not_eligible",
                       f"Your Universal Credit already includes all {qualifying} of your children who qualify.")
    per_child = float(rule.get("monthly_value") or 303.94)
    return _result(
        rule, "eligible",
        f"From 6 April 2026 the two-child limit was removed. Your Universal Credit includes {paid} "
        f"of your {qualifying} qualifying children, so you should get {missing} more child "
        f"element{'s' if missing > 1 else ''}, about {_money(per_child * missing)} a month.",
        qualifying_children=qualifying, child_elements_paid=paid, missing_child_elements=missing,
        estimated_monthly_gain=round(per_child * missing, 2),
    )


def derived_fields(profile: dict, facts: dict | None = None) -> dict:
    """Same derived fields as api/engine.py so rules.json conditions mean the same thing."""
    hh = profile.get("household") or {}
    kids = _children(profile)
    benefits = [b for b in profile.get("benefits") or [] if isinstance(b, dict)]
    uc = _benefit(profile, "Universal Credit")
    housing = profile.get("housing") or {}
    ctx = {
        "on_universal_credit": uc is not None,
        "uc_children_included": (uc or {}).get("children_included", (uc or {}).get("child_elements_paid", 0)),
        "children_count": len(kids),
        "youngest_child_age": min((k.get("age", 99) for k in kids), default=None),
        "school_age_children_count": sum(1 for k in kids if k.get("in_school") or 5 <= (k.get("age") or 0) <= 16),
        "adults": hh.get("adults", 1),
        "monthly_earned_income": profile.get("monthly_earned_income", profile.get("monthly_income", 0)),
        "nation": profile.get("nation", "England"),
        "council": profile.get("council"),
        "council_tax_discounts": housing.get("council_tax_discounts", []),
        "benefit_names": [b.get("name") for b in benefits],
    }
    ctx.update(profile.get("facts") or {})
    ctx.update(facts or {})
    return ctx


_OPS = {
    "==": lambda a, b: a == b, "!=": lambda a, b: a != b, ">=": lambda a, b: a >= b,
    ">": lambda a, b: a > b, "<=": lambda a, b: a <= b, "<": lambda a, b: a < b,
    "contains": lambda a, b: b in a, "not_contains": lambda a, b: b not in a,
}


def _check_conditions(rule: dict, profile: dict, facts: dict) -> dict:
    """Evaluate the rules.json DSL: {"all": [{field, op, value|value_field}],
    "required_facts": [{key, expected, question}]}."""
    elig = rule.get("eligibility") or {}
    ctx = derived_fields(profile, facts)
    for cond in elig.get("all") or []:
        field, op = cond.get("field"), cond.get("op")
        left = ctx.get(field)
        right = ctx.get(cond["value_field"]) if "value_field" in cond else cond.get("value")
        if left is None:
            return _result(rule, "needs_info", f"We don't know {field.replace('_', ' ')} yet.",
                           _question_for(rule, field), missing_fact=field)
        try:
            ok = _OPS[op](left, right)
        except (KeyError, TypeError):
            continue
        if not ok:
            return _result(rule, "not_eligible", _fail_reason(field, op, right, left))
    for f in elig.get("required_facts") or []:
        key = f.get("key") if isinstance(f, dict) else f
        expected = f.get("expected", True) if isinstance(f, dict) else True
        if ctx.get(key) is None:
            q = (f.get("question") if isinstance(f, dict) else None) or _question_for(rule, key)
            return _result(rule, "needs_info", f"We need to know: {key.replace('_', ' ')}.", q, missing_fact=key)
        actual = _truthy(ctx[key]) if isinstance(expected, bool) else ctx[key]
        if actual != expected:
            return _result(rule, "not_eligible",
                           f"This needs {key.replace('_', ' ')} to be {'yes' if expected is True else 'no' if expected is False else expected}.")
    return _result(rule, "eligible", f"You look eligible for {rule.get('name')}.")


def _question_for(rule: dict, key: str) -> str:
    qs = rule.get("follow_up_questions") or []
    if isinstance(qs, dict) and qs.get(key):
        return qs[key]
    if isinstance(qs, list) and qs:
        q = qs[0]
        return q if isinstance(q, str) else q.get("question", "")
    return f"Can you tell me about {key.replace('_', ' ')}?"


def _fail_reason(field: str, op: str, right: Any, left: Any) -> str:
    nice = field.replace("_", " ")
    if field == "on_universal_credit":
        return "This help is only for people getting Universal Credit."
    if op == "not_contains":
        return f"You already have {right}."
    if op in ("<", "<="):
        return f"This is for people whose {nice} is {'under' if op == '<' else 'at most'} {right}, and yours is {left}."
    if op in (">", ">="):
        return f"This needs {nice} to be {'more than' if op == '>' else 'at least'} {right}, and yours is {left}."
    return f"This needs {nice} to be {right}, and yours is {left}."


def _check_generic(rule: dict, profile: dict, facts: dict) -> dict:
    """Small declarative checker for rules.json `eligibility` objects.

    Understood keys (all optional): benefits_any, benefits_none, min_children, max_children,
    max_child_age, adults_max, adults_min, max_monthly_income, min_age, max_age, council,
    city, required_facts ({fact: expected_value} or [fact, ...]).
    Anything else, or a plain-text eligibility, comes back as `needs_review` for the model.
    """
    elig = rule.get("eligibility")
    kids = _children(profile)
    hh = profile.get("household") or {}
    if isinstance(elig, dict) and ("all" in elig or isinstance(elig.get("required_facts"), list)
                                   and elig.get("required_facts") and isinstance(elig["required_facts"][0], dict)):
        return _check_conditions(rule, profile, facts)
    if not isinstance(elig, dict):
        return _result(rule, "needs_review",
                       "This rule needs judgement. Use its description and follow-up questions.",
                       eligibility=elig, follow_up_questions=rule.get("follow_up_questions"))

    def fail(reason: str) -> dict:
        return _result(rule, "not_eligible", reason)

    if elig.get("benefits_any") and not any(_has_benefit(profile, b) for b in elig["benefits_any"]):
        return fail(f"This needs you to be getting {' or '.join(elig['benefits_any'])}.")
    for b in elig.get("benefits_none") or []:
        if _has_benefit(profile, b):
            return fail(f"This can't be paid alongside {b}.")
    if "min_children" in elig:
        max_age = elig.get("max_child_age", 18)
        n = len([k for k in kids if (k.get("age") or 0) < max_age])
        if n < int(elig["min_children"]):
            return fail(f"This needs at least {elig['min_children']} children under {max_age}.")
    if "max_children" in elig and len(kids) > int(elig["max_children"]):
        return fail(f"This is for households with up to {elig['max_children']} children.")
    adults = hh.get("adults")
    if "adults_max" in elig and adults is not None and adults > int(elig["adults_max"]):
        return fail(f"This is for households with {elig['adults_max']} adult{'s' if elig['adults_max'] != 1 else ''}.")
    if "adults_min" in elig and adults is not None and adults < int(elig["adults_min"]):
        return fail(f"This needs at least {elig['adults_min']} adults in the home.")
    income = profile.get("monthly_income")
    if "max_monthly_income" in elig and income is not None and income > float(elig["max_monthly_income"]):
        return fail(f"Your income is above the limit of {_money(float(elig['max_monthly_income']))} a month.")
    age = profile.get("age")
    if "min_age" in elig and age is not None and age < int(elig["min_age"]):
        return fail(f"This is for people aged {elig['min_age']} or over.")
    if "max_age" in elig and age is not None and age > int(elig["max_age"]):
        return fail(f"This is for people aged {elig['max_age']} or under.")
    for key in ("council", "city"):
        if key in elig and profile.get(key) and _norm(elig[key]) not in _norm(profile.get(key)):
            return fail(f"This scheme is only for {elig[key]}.")

    required = elig.get("required_facts") or {}
    if isinstance(required, list):
        required = {k: True for k in required}
    questions = rule.get("follow_up_questions") or []
    for i, (fact, expected) in enumerate(required.items()):
        if fact not in facts or facts.get(fact) is None:
            q = None
            if isinstance(questions, list) and i < len(questions):
                q = questions[i] if isinstance(questions[i], str) else questions[i].get("question")
            elif isinstance(questions, dict):
                q = questions.get(fact)
            return _result(rule, "needs_info", f"We need to know: {fact}.",
                           q or f"Can you tell me about {fact.replace('_', ' ')}?", missing_fact=fact)
        actual = facts.get(fact)
        if isinstance(expected, bool):
            if _truthy(actual) is not expected:
                return fail(f"This needs {fact.replace('_', ' ')} to be {'yes' if expected else 'no'}.")
        elif actual != expected:
            return fail(f"This needs {fact.replace('_', ' ')} to be {expected}.")
    return _result(rule, "eligible", f"You look eligible for {rule.get('name')}.")


def check_eligibility(rule: dict, profile: dict, facts: dict | None = None) -> dict:
    """Return {status: eligible | not_eligible | needs_info | needs_review, reason, question?, ...}."""
    facts = {**((profile or {}).get("facts") or {}), **(facts or {})}
    try:
        if _is_uc_child_rule(rule):
            return _check_uc_child_element(rule, profile or {}, facts)
        return _check_generic(rule, profile or {}, facts)
    except Exception as exc:  # never let a malformed rule break the conversation
        log.warning("eligibility check failed for %s: %s", rule.get("id"), exc)
        return _result(rule, "needs_review", "This rule could not be checked automatically.")


def check_all_eligibility(rules: list[dict], profile: dict, facts: dict | None = None) -> list[dict]:
    return [check_eligibility(r, profile, facts) for r in rules or []]


# ---------------------------------------------------------------------------
# Action drafting (deterministic templates; fast and safe for a live demo)
# ---------------------------------------------------------------------------

def _find_rule(context: dict, rule_id: str | None = None, notification: dict | None = None,
               notes: str | None = None) -> dict | None:
    rules = context.get("rules") or []
    rid = rule_id or (notification or {}).get("rule_id")
    if rid:
        for r in rules:
            if r.get("id") == rid:
                return r
    text = _norm(" ".join(filter(None, [rid, notes, (notification or {}).get("title"),
                                        (notification or {}).get("body")])))
    if text:
        if "child" in text:
            for r in rules:
                if _is_uc_child_rule(r):
                    return r
        for r in rules:
            if _norm(r.get("name")) and _norm(r.get("name")) in text:
                return r
    return None


def _find_merchant(context: dict, merchant: str | None = None, notification: dict | None = None,
                   notes: str | None = None) -> dict | None:
    """Return the anomaly-like record for the merchant to cancel."""
    txs = context.get("transactions") or []
    anomalies = detect_anomalies(txs)
    if merchant:
        for a in anomalies:
            if _norm(merchant) in _norm(a["merchant"]) or _norm(a["merchant"]) in _norm(merchant):
                return a
    ids = set((notification or {}).get("transaction_ids") or [])
    if ids:
        for a in anomalies:
            if ids & set(a["transaction_ids"]):
                return a
        hits = [t for t in txs if t.get("id") in ids]
        if hits:
            return _merchant_record(_merchant_of(hits[-1]), txs)
    text = _norm(" ".join(filter(None, [merchant, notes, (notification or {}).get("title"),
                                        (notification or {}).get("body")])))
    for a in anomalies:
        if _norm(a["merchant"]) in text:
            return a
    if merchant:
        return _merchant_record(merchant, txs)
    return anomalies[0] if anomalies else None


def _merchant_record(merchant: str, txs: list[dict]) -> dict:
    rows = sorted([t for t in txs if _norm(merchant) in _norm(_merchant_of(t))],
                  key=lambda t: str(t.get("date")))
    amount = round(abs(float(rows[-1].get("amount") or 0)), 2) if rows else 0.0
    return {
        "merchant": _merchant_of(rows[-1]) if rows else merchant,
        "amount": amount,
        "first_seen": str(rows[0].get("date"))[:10] if rows else None,
        "last_seen": str(rows[-1].get("date"))[:10] if rows else None,
        "months_seen": len({str(t.get("date"))[:7] for t in rows}),
        "transaction_ids": [t.get("id") for t in rows if t.get("id")],
        "vendor_contact": VENDOR_CONTACTS.get(_norm(merchant)),
    }


def _notification_by_id(context: dict, nid: str | None) -> dict | None:
    if not nid:
        return None
    for n in context.get("notifications") or []:
        if n.get("id") == nid:
            return n
    return None


def _guess_notification(context: dict, kind: str) -> dict | None:
    for n in context.get("notifications") or []:
        if kind == "financial" and n.get("type") == "financial":
            return n
        if kind == "uc" and n.get("type") == "demographic" and "child" in _norm(
                f"{n.get('rule_id')} {n.get('title')}"):
            return n
    return None


def _cancel_action(context: dict, notification: dict | None, notes: str | None,
                   merchant: str | None = None, action_type: str = "cancel_subscription") -> dict:
    profile = context.get("profile") or {}
    name = profile.get("name") or "the account holder"
    rec = _find_merchant(context, merchant, notification, notes) or {"merchant": merchant or "the company",
                                                                     "amount": 0.0}
    m = rec["merchant"]
    contact = rec.get("vendor_contact") or VENDOR_CONTACTS.get(_norm(m)) or {}
    to = contact.get("to") or f"{m} customer support"
    how = contact.get("how") or f"your {m} account settings, or by contacting {m}"
    notification = notification or _guess_notification(context, "financial")
    amount = rec.get("amount") or 0.0
    first = rec.get("first_seen")
    lines = [
        "Hello,",
        "",
        f"I am writing to cancel my {m} subscription with immediate effect.",
        (f"I have been charged {_money(amount)} a month since {first}." if first else
         f"I have been charged {_money(amount)} a month."),
    ]
    note_l = _norm(notes)
    if any(k in note_l for k in ("didn't sign", "did not sign", "not sign", "never signed", "unauthor",
                                 "don't recognise", "do not recognise", "didnt sign")):
        lines.append("I did not knowingly sign up for this subscription. Please refund any charges "
                     "that were taken without my clear consent.")
    lines += [
        "Please confirm in writing that the subscription has been cancelled and that no further "
        "payments will be taken.",
        "",
        "Thank you,",
        name,
    ]
    summary = (f"Send a message to {to} to cancel the {_money(amount)} a month subscription"
               f"{' and ask for a refund' if 'refund' in ' '.join(lines) else ''}, and ask them to confirm. "
               f"You can also cancel it yourself in {how}. You can block future payments through your bank too.")
    return {
        "type": action_type,
        "title": f"Cancel {m}",
        "summary": summary,
        "notification_id": (notification or {}).get("id"),
        "merchant": m,
        "monthly_value": amount,
        "draft": {"to": to, "subject": f"Cancel my {m} subscription", "body": "\n".join(lines)},
        "form": None,
        "details": {
            "merchant": m, "monthly_amount": amount, "first_seen": first,
            "transaction_ids": rec.get("transaction_ids", []),
            "also_cancel_in": how,
        },
    }


def _uc_child_action(context: dict, rule: dict, notification: dict | None, notes: str | None,
                     action_type: str) -> dict:
    profile = context.get("profile") or {}
    facts = _profile_facts(context)
    kids = _children(profile)
    ages = facts.get("children_ages") or [k.get("age") for k in kids]
    elig = check_eligibility(rule, profile, facts)
    missing = elig.get("missing_child_elements") or max(1, len(kids) - 2)
    per_child = float(rule.get("monthly_value") or 303.94)
    name = profile.get("name") or "Claimant"
    kid_desc = []
    for i, k in enumerate(kids):
        age = ages[i] if i < len(ages or []) else k.get("age")
        kid_desc.append(f"{k.get('name') or f'Child {i + 1}'} (age {age})")
    kids_txt = ", ".join(kid_desc) if kid_desc else f"{len(kids)} children"
    body = "\n".join([
        "Hello,",
        "",
        "I would like to report a change and ask for my Universal Credit to be reviewed.",
        f"The two-child limit was removed from 6 April 2026. I have {len(kids)} children who live with "
        f"me and are all under 18: {kids_txt}.",
        f"My Universal Credit currently includes the child element for only "
        f"{elig.get('child_elements_paid', 2)} of them.",
        f"Please add the child element for my other {'child' if missing == 1 else 'children'} "
        f"from 6 April 2026, and backdate any payments I have missed.",
        "",
        "Please let me know if you need anything else from me.",
        "",
        "Thank you,",
        name,
    ] + ([f"", f"Note: {notes}"] if notes else []))
    fields = {
        "claimant_name": name,
        "benefit": "Universal Credit",
        "change_type": "Children: two-child limit removed (6 April 2026)",
        "number_of_children": len(kids),
        "children": kids_txt,
        "children_live_with_claimant": "Yes" if _truthy(facts.get("children_live_with_user")) else "To confirm",
        "all_children_under_18": "Yes" if (_truthy(facts.get("children_all_under_18"))
                                           or all((a or 0) < 18 for a in ages or [])) else "To confirm",
        "child_elements_currently_paid": elig.get("child_elements_paid", 2),
        "child_elements_requested": missing,
        "estimated_extra_per_month": _money(per_child * missing),
        "effective_from": "2026-04-06",
        "request": "Add the missing child element(s) and backdate to 6 April 2026",
        "address": profile.get("address") or profile.get("city"),
        "source": rule.get("source_url"),
    }
    notification = notification or _guess_notification(context, "uc")
    return {
        "type": action_type,
        "title": "Ask Universal Credit to add your third child",
        "summary": (f"Send a message in your Universal Credit journal asking them to add the child "
                    f"element for {missing} more {'child' if missing == 1 else 'children'}, about "
                    f"{_money(per_child * missing)} a month, backdated to 6 April 2026."),
        "notification_id": (notification or {}).get("id") or rule.get("notification_id"),
        "rule_id": rule.get("id"),
        "monthly_value": round(per_child * missing, 2),
        "draft": {"to": "Universal Credit journal (your online account)",
                  "subject": "Change of circumstances: add child element after two-child limit removal",
                  "body": body},
        "form": {"name": "Universal Credit: report a change of circumstances", "fields": fields},
        "details": {"rule_id": rule.get("id"), "source_url": rule.get("source_url")},
    }


def _generic_rule_action(context: dict, rule: dict, notification: dict | None, notes: str | None,
                         action_type: str) -> dict:
    profile = context.get("profile") or {}
    facts = _profile_facts(context)
    name = profile.get("name") or "Claimant"
    council = profile.get("council") or "my local council"
    to_council = "council" in _norm(f"{rule.get('name')} {rule.get('description')}")
    to = (f"{council} benefits team" if to_council else
          f"{rule.get('name')} team")
    body = "\n".join([
        "Hello,",
        "",
        f"I would like to apply for {rule.get('name')}.",
        str(rule.get("description") or "").strip(),
        "My details are below. Please tell me if you need anything else.",
        "",
        f"Name: {name}",
        f"Address: {profile.get('address') or profile.get('city') or ''}",
        f"Household: {(profile.get('household') or {}).get('adults', 1)} adult(s), "
        f"{len(_children(profile))} child(ren)",
        *(f"{k.replace('_', ' ').capitalize()}: {v}" for k, v in facts.items()),
        *([f"Note: {notes}"] if notes else []),
        "",
        "Thank you,",
        name,
    ])
    return {
        "type": action_type,
        "title": f"Apply for {rule.get('name')}",
        "summary": f"Send an application for {rule.get('name')} to {to}.",
        "notification_id": (notification or {}).get("id") or rule.get("notification_id"),
        "rule_id": rule.get("id"),
        "draft": {"to": to, "subject": f"Application: {rule.get('name')}", "body": body},
        "form": {"name": f"{rule.get('name')} application",
                 "fields": {"name": name, "benefit": rule.get("name"), "council": council,
                            "children": len(_children(profile)), **facts}},
        "details": {"rule_id": rule.get("id"), "source_url": rule.get("source_url")},
    }


def draft_action(action_type: str, context: dict, notification: dict | None = None,
                 notes: str | None = None, *, merchant: str | None = None,
                 rule_id: str | None = None) -> dict:
    """Build an Action (without id/status/created_at) from templates. Never raises."""
    context = context or {}
    action_type = action_type if action_type in ACTION_TYPES else "send_email"
    try:
        if isinstance(notification, str):
            notification = _notification_by_id(context, notification)
        if action_type == "cancel_subscription":
            return _cancel_action(context, notification, notes, merchant)
        rule = _find_rule(context, rule_id, notification, notes)
        is_financial = (notification or {}).get("type") == "financial" or (merchant and not rule)
        if action_type == "send_email" and is_financial:
            return _cancel_action(context, notification, notes, merchant, action_type="send_email")
        if rule is not None:
            if _is_uc_child_rule(rule):
                return _uc_child_action(context, rule, notification, notes, action_type)
            return _generic_rule_action(context, rule, notification, notes, action_type)
        profile = context.get("profile") or {}
        return {
            "type": action_type,
            "title": (notification or {}).get("title") or "Message on your behalf",
            "summary": notes or "Send a message on your behalf.",
            "notification_id": (notification or {}).get("id"),
            "draft": {"to": "", "subject": (notification or {}).get("title") or "Enquiry",
                      "body": f"Hello,\n\n{notes or (notification or {}).get('body') or ''}\n\n"
                              f"Thank you,\n{profile.get('name') or ''}"},
            "form": None,
        }
    except Exception as exc:
        log.warning("draft_action failed: %s", exc)
        return {"type": action_type, "title": "Draft action", "summary": notes or "Draft action",
                "notification_id": (notification or {}).get("id") if isinstance(notification, dict) else None,
                "draft": None, "form": None}


# ---------------------------------------------------------------------------
# Claude tool use
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "detect_anomalies",
        "description": "Find new or unusual recurring charges in the user's transactions: merchants that "
                       "started charging recently with no earlier history. Returns merchant, amount, "
                       "first_seen date, months_seen and transaction ids. Use for any question about a "
                       "charge, subscription or financial alert.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_spending_summary",
        "description": "Monthly money in, money out, net and top spending categories, oldest month first, "
                       "plus averages.",
        "input_schema": {
            "type": "object",
            "properties": {"months": {"type": "integer", "description": "How many recent months. Default all."}},
            "additionalProperties": False,
        },
    },
    {
        "name": "check_eligibility",
        "description": "Check benefit rules against the profile and all known facts. Returns per rule: "
                       "status eligible, not_eligible (with reason), needs_info (with the exact question "
                       "to ask next), or needs_review. Omit rule_id to check every rule.",
        "input_schema": {
            "type": "object",
            "properties": {"rule_id": {"type": "string", "description": "A rule id from the rules list."}},
            "additionalProperties": False,
        },
    },
    {
        "name": "record_fact",
        "description": "Save new facts the user has just told you so you never ask again. Call this before "
                       "other tools whenever the user shares something about their life, household, "
                       "children, health, work, housing or a charge. Use short snake_case keys and simple "
                       "values, e.g. {\"children_live_with_user\": true, \"children_all_under_18\": true, "
                       "\"children_ages\": [4, 9, 14]}.",
        "input_schema": {
            "type": "object",
            "properties": {"facts": {"type": "object", "description": "Fact keys to values."}},
            "required": ["facts"],
        },
    },
    {
        "name": "propose_action",
        "description": "Prepare a draft action for the user to approve: a cancellation email to a vendor "
                       "(cancel_subscription), a Universal Credit or council message (send_email), a benefit "
                       "claim or change of circumstances (submit_claim), or form contents (fill_form). This "
                       "NEVER sends anything; the user must approve it. Returns the draft so you can "
                       "summarise it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action_type": {"type": "string", "enum": list(ACTION_TYPES)},
                "notification_id": {"type": "string", "description": "The related notification id, if any."},
                "rule_id": {"type": "string", "description": "The related benefit rule id, if any."},
                "merchant": {"type": "string", "description": "The merchant, for subscription actions."},
                "notes": {"type": "string", "description": "Anything the user said that the draft should "
                                                            "reflect, e.g. 'user did not sign up for this'."},
            },
            "required": ["action_type"],
            "additionalProperties": False,
        },
    },
]


def normalise_facts(facts: dict) -> dict:
    """Keep synonyms in step so both brain.py and api/engine.py see the fact."""
    out = dict(facts)
    ages = out.get("children_ages")
    if isinstance(ages, (list, tuple)) and ages:
        try:
            ages = [int(a) for a in ages]
            out["children_ages"] = ages
            if all(a < 18 for a in ages):
                out.setdefault("children_all_under_18", True)
        except (TypeError, ValueError):
            pass
    u18 = _truthy(out.get("children_all_under_18"))
    elig_age = _truthy(out.get("children_eligible_age"))
    if u18 is True and elig_age is None:
        out["children_eligible_age"] = True
    if elig_age is True and u18 is None and "children_ages" not in out:
        out["children_all_under_18"] = True
    for k, v in list(out.items()):
        if isinstance(v, str) and _truthy(v) is not None:
            out[k] = _truthy(v)
    return out


class _Session:
    """Per-call state shared between tools."""

    def __init__(self, context: dict):
        self.context = context
        self.facts: dict = {}
        self.pending_action: dict | None = None

    @property
    def all_facts(self) -> dict:
        return {**((self.context.get("profile") or {}).get("facts") or {}), **self.facts}

    def run(self, name: str, args: dict) -> Any:
        ctx = self.context
        if name == "detect_anomalies":
            found = detect_anomalies(ctx.get("transactions") or [])
            return {"anomalies": found} if found else {"anomalies": [], "note": "No new recurring charges found."}
        if name == "get_spending_summary":
            return spending_summary(ctx.get("transactions") or [], args.get("months"))
        if name == "check_eligibility":
            rules = ctx.get("rules") or []
            rid = args.get("rule_id")
            chosen = [r for r in rules if r.get("id") == rid] if rid else rules
            if rid and not chosen:
                return {"error": f"No rule with id {rid}.", "rule_ids": [r.get("id") for r in rules]}
            results = check_all_eligibility(chosen, ctx.get("profile") or {}, self.all_facts)
            for r in results:
                if r["status"] == "eligible":
                    r["next_step"] = (f"Call propose_action now with action_type "
                                      f"{r.get('action_type') or 'submit_claim'} and rule_id {r['rule_id']}, "
                                      f"then ask the user to approve the draft.")
                elif r["status"] == "needs_info":
                    r["next_step"] = "Ask the user this question, in warm words, and nothing else."
            return {"results": results}
        if name == "record_fact":
            facts = args.get("facts")
            if not isinstance(facts, dict) or not facts:
                return {"error": "facts must be a non-empty object"}
            self.facts.update(normalise_facts(facts))
            return {"saved": facts, "all_known_facts": self.all_facts}
        if name == "propose_action":
            ctx2 = {**ctx, "_session_facts": self.facts}
            notification = _notification_by_id(ctx, args.get("notification_id"))
            action = draft_action(args.get("action_type", "send_email"), ctx2, notification,
                                  args.get("notes"), merchant=args.get("merchant"), rule_id=args.get("rule_id"))
            self.pending_action = action
            return {"status": "drafted, waiting for the user's approval (nothing has been sent)",
                    "action": action}
        return {"error": f"Unknown tool {name}"}


_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic

        _client = anthropic.Anthropic(max_retries=2, timeout=60.0)
    return _client


def _model() -> str:
    return os.environ.get("FOLA_MODEL") or DEFAULT_MODEL


def _effort() -> str:
    return os.environ.get("FOLA_EFFORT") or "low"


def _system_prompt() -> str:
    try:
        return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        return "You are Fola, a kind, plain-English money coach. Never act without permission."


def _context_block(context: dict) -> str:
    profile = dict(context.get("profile") or {})
    profile.pop("net_worth_history", None)
    rules = [{k: r.get(k) for k in ("id", "name", "type", "description", "monthly_value", "source_url",
                                     "action_type", "follow_up_questions")}
             for r in context.get("rules") or []]
    data = {
        "today": date.today().isoformat(),
        "profile": profile,
        "known_facts": profile.get("facts") or {},
        "notifications": context.get("notifications") or [],
        "rules": rules,
        "pending_actions": [{k: a.get(k) for k in ("id", "type", "title", "notification_id")}
                            for a in context.get("pending_actions") or []],
        "transaction_count": len(context.get("transactions") or []),
    }
    return "User context (JSON):\n" + json.dumps(data, ensure_ascii=False, default=str)


def _clean_history(history: list[dict] | None) -> list[dict]:
    out: list[dict] = []
    for h in history or []:
        if not isinstance(h, dict):
            continue
        role = h.get("role")
        role = {"agent": "assistant", "fola": "assistant", "human": "user"}.get(role, role)
        if role not in ("user", "assistant"):
            continue
        content = h.get("content", h.get("text", h.get("message")))
        if not isinstance(content, str) or not content.strip():
            continue
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n" + content
        else:
            out.append({"role": role, "content": content})
    while out and out[0]["role"] != "user":
        out.pop(0)
    if out and out[-1]["role"] == "user":  # the new message will be the next user turn
        out.append({"role": "assistant", "content": "I understand."})
    return out


_fallbacks_supported = True


def _create(client, **kwargs):
    """messages.create with server-side refusal fallbacks, degrading gracefully if unsupported."""
    global _fallbacks_supported
    import anthropic

    if _fallbacks_supported:
        try:
            return client.beta.messages.create(betas=["server-side-fallback-2026-07-01"],
                                               extra_body={"fallbacks": "default"}, **kwargs)
        except anthropic.BadRequestError as exc:
            if "fallback" not in str(exc).lower():
                raise
            log.info("server-side fallbacks unavailable; continuing without them")
            _fallbacks_supported = False
    return client.messages.create(**kwargs)


def chat(message: str, context: dict, history: list[dict] | None = None) -> dict:
    """One conversational turn. Never raises; returns {reply, pending_action?, profile_updates?}."""
    context = context or {}
    session = _Session(context)
    reply_text = ""
    try:
        import anthropic

        client = _get_client()
        system = [
            {"type": "text", "text": _system_prompt()},
            {"type": "text", "text": _context_block(context), "cache_control": {"type": "ephemeral"}},
        ]
        messages: list[dict] = _clean_history(history) + [{"role": "user", "content": message or ""}]
        for _ in range(MAX_TOOL_ROUNDS):
            response = _create(
                client,
                model=_model(),
                max_tokens=4096,
                system=system,
                tools=TOOLS,
                messages=messages,
                output_config={"effort": _effort()},
            )
            if response.stop_reason == "refusal":
                reply_text = ("I'm sorry, I can't help with that one. Citizens Advice can give you free, "
                              "confidential help.")
                break
            texts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
            if texts:
                reply_text = " ".join(texts)
            tool_uses = [b for b in response.content if getattr(b, "type", None) == "tool_use"]
            if response.stop_reason != "tool_use" or not tool_uses:
                break
            messages.append({"role": "assistant", "content": response.content})
            results = []
            for tu in tool_uses:
                try:
                    out = session.run(tu.name, tu.input if isinstance(tu.input, dict) else {})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": json.dumps(out, ensure_ascii=False, default=str)})
                except Exception as exc:
                    log.warning("tool %s failed: %s", tu.name, exc)
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": f"Error: {exc}", "is_error": True})
            messages.append({"role": "user", "content": results})
    except Exception as exc:  # network, auth, rate limits, anything: degrade gracefully
        log.warning("chat failed: %s: %s", type(exc).__name__, exc)
        if not reply_text:
            reply_text = FALLBACK_REPLY

    reply = strip_markdown(reply_text) or (
        "I've prepared that for you. Would you like me to send it?" if session.pending_action else FALLBACK_REPLY)
    out: dict = {"reply": reply}
    if session.pending_action:
        out["pending_action"] = session.pending_action
    if session.facts:
        out["profile_updates"] = session.facts
    return out


__all__ = [
    "chat", "draft_action", "detect_anomalies", "check_eligibility", "check_all_eligibility",
    "spending_summary", "strip_markdown",
]
