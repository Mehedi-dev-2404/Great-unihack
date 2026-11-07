"""Template action drafts (fallback when agent/brain.py is unavailable) and simulated execution."""
from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

ACTION_TYPES = {"cancel_subscription", "send_email", "submit_claim", "fill_form", "set_reminder", "top_up_transfer"}
OUTCOMES = {
    "cancel_subscription": "cancelled",
    "send_email": "sent",
    "submit_claim": "submitted",
    "fill_form": "submitted",
    "set_reminder": "scheduled",
    "top_up_transfer": "scheduled",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _children_lines(profile: dict) -> str:
    kids = (profile.get("household") or {}).get("children", [])
    return "\n".join(f"- {c.get('name')}, aged {c.get('age')}" for c in kids)


def _nice(d: date) -> str:
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"


def shortfall_draft(action_type: str, profile: dict, notification: dict | None) -> dict:
    """set_reminder / top_up_transfer for a bill that may bounce (n-rent-shortfall)."""
    n = notification or {}
    merchant = n.get("merchant") or "your bill"
    what = "rent" if n.get("id") == "n-rent-shortfall" else f"{merchant} payment"
    shortfall = float(n.get("shortfall") or 0)
    bill = n.get("bill_amount")
    try:
        due = date.fromisoformat(n["due_date"])
    except (KeyError, TypeError, ValueError):
        due = None
    due_txt = _nice(due) if due else "the due date"

    if action_type == "set_reminder":
        when = max(date.today(), due - timedelta(days=2)) if due else None
        label = (f"{what.capitalize()} of £{bill:.2f} to {merchant} is due {due_txt}. "
                 f"You may be about £{shortfall:.0f} short." if bill else f"{what.capitalize()} due {due_txt}.")
        reminder = {"date": when.isoformat() if when else None, "label": label}
        return {
            "type": action_type,
            "title": f"Remind me before {what} is due",
            "summary": f"Send you a reminder on {_nice(when) if when else 'the day before'} that {what} is due {due_txt}.",
            "reminder": reminder,
            "draft": None,
            "form": {"name": "Reminder", "fields": reminder},
        }

    # top_up_transfer: only from an account already on the profile, never one read out by voice
    accounts = sorted(profile.get("savings") or [], key=lambda a: -(a.get("balance") or 0))
    source = accounts[0] if accounts else None
    want = math.ceil((shortfall + 10) / 10) * 10 if shortfall else 50  # small buffer, rounded to £10
    max_amount = min(want, source.get("balance", 0)) if source else 0
    before = (due - timedelta(days=1)) if due else None
    transfer = {
        "from_account": source.get("name") if source else None,
        "to_account": "Current account",
        "max_amount": max_amount,
        "before_date": before.isoformat() if before else None,
        "recurring": True,
        "only_if_needed": True,
    }
    if not source:
        summary = "There is no savings account on file to move money from."
    else:
        summary = (f"Move up to £{max_amount:.0f} from {source['name']} to your current account by "
                   f"{_nice(before) if before else 'the day before'}, only if needed to cover {what}. "
                   "It repeats each month and you can cancel any time.")
    return {
        "type": action_type,
        "title": f"Top up from savings before {what}",
        "summary": summary,
        "transfer": transfer,
        "draft": None,
        "form": {"name": "Top-up transfer", "fields": transfer},
    }


def template_draft(action_type: str, profile: dict, notification: dict | None, notes: str | None) -> dict:
    """Return an Action without id/status/created_at."""
    if action_type in ("set_reminder", "top_up_transfer"):
        return shortfall_draft(action_type, profile, notification)
    name = profile.get("name", "the customer")
    n = notification or {}
    extra = ""  # drafter notes are internal; never put them in the message

    if action_type == "cancel_subscription":
        merchant = n.get("merchant") or "the subscription"
        amount = n.get("monthly_value")
        amt = f" of £{amount:.2f} a month" if amount else ""
        return {
            "type": action_type,
            "title": f"Cancel {merchant}",
            "summary": f"Email {merchant} to cancel the subscription{amt} and stop future payments.",
            "merchant": n.get("merchant"),
            "draft": {
                "to": f"{merchant} customer support",
                "subject": f"Please cancel my {merchant} subscription",
                "body": (
                    f"Hello,\n\nI'm writing to cancel my {merchant} subscription{amt}, effective immediately. "
                    "I did not intend to keep this subscription. Please stop any further payments and "
                    "confirm the cancellation in writing.\n\n"
                    f"Thank you,\n{name}{extra}"
                ),
            },
            "form": None,
        }

    if action_type == "submit_claim":
        title = n.get("title") or "Universal Credit change of circumstances"
        is_uc = (n.get("rule_id") or "").startswith("uc_") or not n
        if is_uc:
            body = (
                "Change of circumstances: child element for all my children\n\n"
                "The two-child limit in Universal Credit was removed from 6 April 2026. My award still only "
                "includes the child element for 2 children, but I am responsible for 3 children who live with me "
                "and are all under 18:\n"
                f"{_children_lines(profile)}\n\n"
                "Please update my award to include the child element for all three children, and tell me "
                "whether any back-payment from April 2026 is due.\n\n"
                f"{name}{extra}"
            )
            return {
                "type": action_type,
                "title": "Claim UC child element for your third child",
                "summary": "Send a change-of-circumstances note in your UC journal asking DWP to add the child element for all 3 children.",
                "draft": {
                    "to": "DWP Universal Credit (online journal)",
                    "subject": "Change of circumstances: add child element for all 3 children",
                    "body": body,
                },
                "form": {
                    "name": "Universal Credit: report a change of circumstances",
                    "fields": {
                        "claimant_name": name,
                        "change_type": "Children: add child element (two-child limit removed 6 April 2026)",
                        "number_of_children": len((profile.get("household") or {}).get("children", [])),
                        "children_live_with_claimant": "Yes",
                        "all_under_18_or_in_approved_education": "Yes",
                    },
                },
            }
        return {
            "type": action_type,
            "title": f"Claim: {title}",
            "summary": f"Submit a claim for {title}.",
            "draft": {"to": n.get("source_url", "the relevant office"), "subject": f"Claim for {title}",
                      "body": f"I would like to claim {title}.\n\n{name}{extra}"},
            "form": None,
        }

    if action_type == "fill_form":
        title = n.get("title") or "Application form"
        hh = profile.get("household") or {}
        return {
            "type": action_type,
            "title": f"Apply: {title}",
            "summary": f"Fill in the application for {title} with your details for you to check.",
            "draft": None,
            "form": {
                "name": title,
                "fields": {
                    "applicant_name": name,
                    "council": profile.get("council"),
                    "receives_universal_credit": "Yes",
                    "children": [f"{c.get('name')} ({c.get('age')})" for c in hh.get("children", [])],
                    "monthly_take_home_pay_from_work": profile.get("monthly_earned_income"),
                    "notes": notes or "",
                },
            },
        }

    # send_email (default)
    title = n.get("title") or "your request"
    council = profile.get("council", "the council")
    if n.get("rule_id") == "council_tax_single_person_discount":
        body = (
            "Hello,\n\nI am the only adult (18 or over) living at my address; my three children are all under 18. "
            "Please apply the 25% single person discount to my Council Tax account and adjust my instalments.\n\n"
            f"Thank you,\n{name}{extra}"
        )
        to, subject = f"{council} – Council Tax", "Request for single person discount"
    else:
        body = f"Hello,\n\nI'm writing about {title}.\n\nThank you,\n{name}{extra}"
        to, subject = council, f"About {title}"
    return {
        "type": "send_email",
        "title": f"Email: {subject}",
        "summary": f"Send an email to {to}: {subject}.",
        "draft": {"to": to, "subject": subject, "body": body},
        "form": None,
    }


def execute(action: dict) -> dict:
    """Simulate execution and return a Report."""
    outcome = OUTCOMES.get(action.get("type"), "submitted")
    details: dict[str, Any] = {
        "draft": action.get("draft"),
        "form": action.get("form"),
        "notification_id": action.get("notification_id"),
        "rule_id": action.get("rule_id"),
        "simulated": True,
        "delivery": "prepared_and_logged",
        "note_for_agent": "Demo mode: the message is prepared and logged with today's date, but nothing was actually sent. Do not say it was sent or delivered.",
    }
    if action.get("type") == "cancel_subscription":
        details["merchant"] = action.get("merchant")
        details["monthly_saving"] = action.get("monthly_value")
    elif action.get("type") in ("set_reminder", "top_up_transfer"):
        details["reminder"] = action.get("reminder")
        details["transfer"] = action.get("transfer")
        details["note_for_agent"] = ("Demo mode: this is scheduled and logged, but no real reminder or transfer is set up "
                                     "with a bank yet. Say it is set up and logged; do not claim money has moved.")
    elif action.get("monthly_value"):
        details["estimated_monthly_value"] = action.get("monthly_value")
    ts = now_iso()
    return {
        "id": "r-" + uuid.uuid4().hex[:10],
        "action_id": action["id"],
        "type": action.get("type"),
        "title": action.get("title"),
        "created_at": ts,
        "summary": f"Prepared and logged on {ts[:10]}: {action.get('summary', '')}",
        "outcome": outcome,
        "details": details,
    }
