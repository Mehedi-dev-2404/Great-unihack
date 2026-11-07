"""Fola backend: FastAPI app implementing the API contract in docs/PROJECT.md.

Run from the repo root:  uvicorn api.main:app --port 8000
"""
from __future__ import annotations

import importlib
import logging
import re
import sys
import threading
import uuid
from typing import Any, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import engine, store
from .actions import ACTION_TYPES, execute, now_iso, template_draft

load_dotenv(store.REPO_ROOT / ".env")
if str(store.REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(store.REPO_ROOT))

log = logging.getLogger("fola.api")

app = FastAPI(title="Fola API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- brain (optional)

_brain = None
_brain_lock = threading.Lock()


def get_brain():
    """Import agent.brain lazily so the app still starts if it's missing or broken."""
    global _brain
    if _brain is not None:
        return _brain
    with _brain_lock:
        try:
            _brain = importlib.import_module("agent.brain")
        except Exception as e:  # noqa: BLE001 - any import problem means "use the fallback"
            log.warning("agent.brain unavailable, using fallback: %s", e)
            return None
    return _brain


# ---------------------------------------------------------------- models


class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None


class ActionIn(BaseModel):
    type: Literal["cancel_subscription", "send_email", "submit_claim", "fill_form"]
    notification_id: Optional[str] = None
    notes: Optional[str] = None


class FactsIn(BaseModel):
    facts: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------- shared state helpers

_histories: dict[str, list[dict]] = {}
MAX_HISTORY = 40


def _state() -> dict:
    profile = store.load("profile") or {}
    transactions = store.load("transactions") or []
    rules = store.load("rules") or []
    actions = store.load("actions") or []
    notifications = engine.build_notifications(profile, transactions, rules, actions)
    return {
        "profile": profile,
        "transactions": transactions,
        "rules": rules,
        "actions": actions,
        "notifications": notifications,
    }


def _context(st: dict) -> dict:
    return {
        "profile": st["profile"],
        "transactions": st["transactions"],
        "rules": st["rules"],
        "notifications": st["notifications"],
        "pending_actions": [a for a in st["actions"] if a.get("status") == "pending"],
        "eligibility": engine.evaluate_all(st["profile"], st["rules"], st["transactions"]),
    }


def _find_notification(st: dict, nid: Optional[str], action_type: Optional[str] = None) -> Optional[dict]:
    if nid:
        n = next((n for n in st["notifications"] if n["id"] == nid), None)
        if n:
            return n
    if action_type:
        return next((n for n in st["notifications"] if n.get("suggested_action") == action_type), None)
    return None


FACT_ALIASES = {
    "children_living_with_user": "children_live_with_user",
    "all_children_live_with_user": "children_live_with_user",
    "all_children_under_18": "children_all_under_18",
}


def _canonical_facts(updates: dict) -> dict:
    """Map fact names from the voice agent/brain onto the names rules.json uses."""
    out = {FACT_ALIASES.get(k, k): v for k, v in (updates or {}).items()}
    if isinstance(out.get("children_live_with_user"), int) and not isinstance(out["children_live_with_user"], bool):
        out["children_live_with_user"] = out["children_live_with_user"] > 0
    ages = out.get("children_ages")
    if isinstance(ages, str):
        nums = [int(n) for n in re.findall(r"\d+", ages)]
        if nums:
            out["children_ages"] = nums
    try:
        from agent.brain import normalise_facts
        out = normalise_facts(out)
    except Exception:
        pass
    return out


def _merge_facts(updates: dict) -> dict:
    updates = _canonical_facts(updates)
    with store.LOCK:
        profile = store.load("profile") or {}
        facts = profile.get("facts") or {}
        facts.update(updates or {})
        profile["facts"] = facts
        store.save("profile", profile)
    return profile


def _finalize_action(raw: dict, st: dict, action_type: Optional[str] = None,
                     notification_id: Optional[str] = None) -> dict:
    """Assign id/status/created_at, link it to a notification, persist it."""
    a = dict(raw or {})
    a["type"] = a.get("type") or action_type or "send_email"
    if a["type"] not in ACTION_TYPES:
        a["type"] = "send_email"
    n = _find_notification(st, a.get("notification_id") or notification_id, a["type"])
    a["notification_id"] = a.get("notification_id") or notification_id or (n or {}).get("id")
    if n:
        a.setdefault("rule_id", n.get("rule_id"))
        if n.get("merchant"):
            a.setdefault("merchant", n["merchant"])
        a.setdefault("monthly_value", n.get("monthly_value"))
    a.setdefault("title", a["type"].replace("_", " ").capitalize())
    a.setdefault("summary", a["title"])
    a.setdefault("draft", None)
    a.setdefault("form", None)
    a["id"] = "a-" + uuid.uuid4().hex[:10]
    a["status"] = "pending"
    a["created_at"] = now_iso()
    with store.LOCK:
        actions = store.load("actions") or []
        actions.append(a)
        store.save("actions", actions)
    return a


def _draft(action_type: str, st: dict, notification: Optional[dict], notes: Optional[str]) -> dict:
    brain = get_brain()
    if brain is not None and hasattr(brain, "draft_action"):
        try:
            out = brain.draft_action(action_type, _context(st), notification, notes)
            if isinstance(out, dict) and (out.get("draft") or out.get("form")):
                out.setdefault("type", action_type)
                return out
        except Exception as e:  # noqa: BLE001
            log.warning("brain.draft_action failed, using template: %s", e)
    return template_draft(action_type, st["profile"], notification, notes)


# ---------------------------------------------------------------- fallback chat

YES = re.compile(r"\b(yes|yeah|yep|yup|they do|correct|that's right|all of them|sure|please do|go ahead|ok|okay)\b", re.I)
NO = re.compile(r"\b(no|nope|not really|they don't|don't)\b", re.I)


def _stub_chat(message: str, st: dict) -> dict:
    msg = message.lower()
    notes = st["notifications"]
    fin = next((n for n in notes if n["type"] == "financial"), None)
    uc = next((n for n in notes if n.get("rule_id") == "uc_two_child_limit_removed"), None)

    if fin and ("cancel" in msg or (fin.get("merchant", "").lower() in msg and "stop" in msg)):
        action = template_draft("cancel_subscription", st["profile"], fin, None)
        action["notification_id"] = fin["id"]
        return {
            "reply": (f"Okay. I've drafted an email to cancel {fin['merchant']}, which saves £{fin['monthly_value']:.2f} "
                      "a month. Shall I send it?"),
            "pending_action": action,
        }

    if uc and (YES.search(msg) or "child" in msg or "universal credit" in msg) and not NO.search(msg):
        if uc.get("questions") and not YES.search(msg):
            return {"reply": f"{uc['title']}: {uc['questions'][0]}"}
        if uc.get("questions"):
            updates = {"children_live_with_user": True, "children_all_under_18": True}
        else:
            updates = {}
        action = template_draft("submit_claim", st["profile"], uc, None)
        action["notification_id"] = uc["id"]
        out = {
            "reply": ("Thank you. That means your Universal Credit should include all three children, about "
                      f"£{uc['monthly_value']:.2f} more a month. I've drafted a change-of-circumstances note for your "
                      "UC journal. Would you like me to send it?"),
            "pending_action": action,
        }
        if updates:
            out["profile_updates"] = updates
        return out

    if NO.search(msg) and uc and uc.get("questions"):
        return {"reply": ("That's okay. The extra child element is only paid for children who live with you and are "
                          "under 18, or under 20 in approved education. If that changes, tell me and I'll check again. "
                          "If you're unsure, Citizens Advice can help.")}

    if notes:
        top = notes[0]
        q = f" {top['questions'][0]}" if top.get("questions") else ""
        more = f" I also have {len(notes) - 1} other thing{'s' if len(notes) > 2 else ''} to look at with you." if len(notes) > 1 else ""
        return {"reply": f"The most important thing right now: {top['title']}. {top['body']}{q}{more}"}
    return {"reply": "You're all up to date. I can't see anything that needs your attention right now."}


# ---------------------------------------------------------------- routes


@app.get("/health")
def health():
    return {"status": "ok", "brain": get_brain() is not None}


@app.get("/api/profile")
def get_profile():
    return store.load("profile") or {}


@app.post("/api/profile/facts")
def post_facts(body: FactsIn):
    return _merge_facts(body.facts)


@app.get("/api/notifications")
def get_notifications():
    return _state()["notifications"]


@app.get("/api/eligibility")
def get_eligibility():
    """Extra: per-rule eligibility with reasons (handy for explaining a 'no' kindly)."""
    st = _state()
    return engine.evaluate_all(st["profile"], st["rules"], st["transactions"])


@app.get("/api/transactions")
def get_transactions():
    """Extra: raw transactions, newest first."""
    return sorted(store.load("transactions") or [], key=lambda t: t["date"], reverse=True)


@app.post("/api/chat")
def post_chat(body: ChatIn):
    sid = body.session_id or "default"
    history = _histories.setdefault(sid, [])
    st = _state()

    result: Optional[dict] = None
    source = "stub"
    brain = get_brain()
    if brain is not None and hasattr(brain, "chat"):
        try:
            out = brain.chat(body.message, _context(st), list(history))
            if isinstance(out, dict) and out.get("reply"):
                result, source = out, "brain"
        except Exception as e:  # noqa: BLE001
            log.warning("brain.chat failed, using stub: %s", e)
    if result is None:
        result = _stub_chat(body.message, st)

    resp: dict[str, Any] = {"reply": result["reply"], "source": source, "session_id": sid}
    updates = result.get("profile_updates")
    if isinstance(updates, dict) and updates:
        _merge_facts(updates)
        resp["profile_updates"] = updates
        st = _state()
    pa = result.get("pending_action")
    if isinstance(pa, dict) and pa:
        resp["pending_action"] = _finalize_action(pa, st)

    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": resp["reply"]})
    del history[:-MAX_HISTORY]
    return resp


@app.get("/api/actions")
def list_actions(status: Optional[Literal["pending", "approved", "declined"]] = Query(None)):
    actions = store.load("actions") or []
    if status:
        actions = [a for a in actions if a.get("status") == status]
    return sorted(reversed(actions), key=lambda a: a.get("created_at", ""), reverse=True)


@app.post("/api/actions")
def create_action(body: ActionIn):
    st = _state()
    notification = _find_notification(st, body.notification_id, None if body.notification_id else body.type)
    if body.notification_id and notification is None:
        raise HTTPException(404, f"notification {body.notification_id} not found or already resolved")
    raw = _draft(body.type, st, notification, body.notes)
    raw["type"] = body.type
    if notification:
        raw["notification_id"] = notification["id"]
    return _finalize_action(raw, st, body.type, body.notification_id)


def _get_action(actions: list[dict], action_id: str) -> dict:
    a = next((a for a in actions if a.get("id") == action_id), None)
    if a is None:
        raise HTTPException(404, f"action {action_id} not found")
    return a


@app.post("/api/actions/{action_id}/approve")
def approve_action(action_id: str):
    with store.LOCK:
        actions = store.load("actions") or []
        a = _get_action(actions, action_id)
        reports = store.load("reports") or []
        if a["status"] == "approved":
            existing = next((r for r in reports if r.get("action_id") == action_id), None)
            if existing:
                return existing
        if a["status"] == "declined":
            raise HTTPException(409, "action was declined")
        report = execute(a)
        a["status"] = "approved"
        a["approved_at"] = report["created_at"]
        a["report_id"] = report["id"]
        store.save("actions", actions)
        reports.append(report)
        store.save("reports", reports)
    return report


@app.post("/api/actions/{action_id}/decline")
def decline_action(action_id: str):
    with store.LOCK:
        actions = store.load("actions") or []
        a = _get_action(actions, action_id)
        if a["status"] == "approved":
            raise HTTPException(409, "action was already approved")
        a["status"] = "declined"
        a["declined_at"] = now_iso()
        store.save("actions", actions)
    return a


@app.get("/api/reports")
def list_reports():
    return sorted(reversed(store.load("reports") or []), key=lambda r: r.get("created_at", ""), reverse=True)


@app.get("/api/forecast")
def get_forecast(months: int = Query(12, ge=1, le=60)):
    st = _state()
    return engine.forecast(st["profile"], st["transactions"], st["notifications"], st["actions"], months)


@app.post("/api/reset")
def reset():
    """Restore demo state: no actions/reports, empty facts, chat history cleared."""
    with store.LOCK:
        store.save("actions", [])
        store.save("reports", [])
        profile = store.load("profile") or {}
        profile["facts"] = {}
        store.save("profile", profile)
    _histories.clear()
    return {"status": "reset"}
