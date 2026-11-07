"""Live integration tests for both demo flows. Skipped without ANTHROPIC_API_KEY.

Run only these: python3 -m pytest agent/tests -m live -s
"""

import json
import os
from pathlib import Path

import pytest

from agent import brain
from agent.tests.fixtures import make_context

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="ANTHROPIC_API_KEY not set"),
]

DATA = Path(__file__).resolve().parents[2] / "data"


def _turn(ctx, history, message):
    out = brain.chat(message, ctx, history)
    print(f"\nUSER: {message}\nFOLA: {out['reply']}")
    if out.get("pending_action"):
        print("PENDING:", json.dumps(out["pending_action"], indent=1)[:1200])
    if out.get("profile_updates"):
        print("FACTS:", out["profile_updates"])
        ctx["profile"].setdefault("facts", {}).update(out["profile_updates"])  # what the API does
    history += [{"role": "user", "content": message}, {"role": "assistant", "content": out["reply"]}]
    assert out["reply"] and out["reply"] != brain.FALLBACK_REPLY
    assert "**" not in out["reply"] and "\n-" not in out["reply"]
    return out


def test_flow_a_youtube_music_cancel():
    ctx, history = make_context(), []
    first = _turn(ctx, history, "What's this YouTube Music charge?")
    assert "10.99" in first["reply"] or "YouTube" in first["reply"]
    assert "pending_action" not in first or first["pending_action"]["type"] == "cancel_subscription"
    out = _turn(ctx, history, "I didn't sign up for that, cancel it")
    action = out.get("pending_action") or first.get("pending_action")
    assert action, "expected a pending cancel action"
    assert action["type"] == "cancel_subscription"
    assert action["draft"]["to"] and "@" not in action["draft"]["to"]
    assert "YouTube Music" in action["draft"]["subject"] + action["draft"]["body"]


def test_flow_b_uc_child_element():
    ctx, history = make_context(), []
    first = _turn(ctx, history, "Tell me about the child benefit alert")
    assert "?" in first["reply"]
    low = first["reply"].lower()
    assert "live with you" in low or "under 18" in low
    assert "pending_action" not in first
    out = _turn(ctx, history, "Yes, all three live with me and they're 4, 9 and 14")
    facts = out.get("profile_updates") or {}
    assert facts.get("children_live_with_user") is True, facts
    action = out.get("pending_action")
    assert action and action["type"] in ("submit_claim", "send_email", "fill_form")
    assert action.get("form") or action.get("draft")
    assert "Universal Credit" in json.dumps(action)


def _real_context():
    def load(name, default):
        p = DATA / name
        return json.loads(p.read_text()) if p.exists() else default
    ctx = {"profile": load("profile.json", {}), "transactions": load("transactions.json", []),
           "rules": load("rules.json", [])}
    try:  # notifications are derived by the backend engine
        from api import engine
        ctx["notifications"] = engine.build_notifications(ctx["profile"], ctx["transactions"], ctx["rules"], [])
    except Exception:
        ctx["notifications"] = load("notifications.json", [])
    return ctx


real_data = pytest.mark.skipif(not (DATA / "profile.json").exists(), reason="data/ files not written yet")


@real_data
def test_smoke_real_data_flow_a():
    ctx = _real_context()
    print("anomalies:", [(a["merchant"], a["first_seen"]) for a in brain.detect_anomalies(ctx["transactions"])])
    print("eligibility:", [(r["rule_id"], r["status"]) for r in
                           brain.check_all_eligibility(ctx["rules"], ctx["profile"])])
    assert "YouTube Music" in [a["merchant"] for a in brain.detect_anomalies(ctx["transactions"])]
    history = []
    _turn(ctx, history, "What's this YouTube Music charge?")
    out = _turn(ctx, history, "I didn't sign up for that, cancel it")
    assert out.get("pending_action", {}).get("type") == "cancel_subscription"


@real_data
def test_smoke_real_data_flow_b():
    ctx, history = _real_context(), []
    _turn(ctx, history, "Tell me about the child benefit alert")
    out = _turn(ctx, history, "Yes, all three live with me and they're 3, 9 and 14")
    assert (out.get("profile_updates") or {}).get("children_live_with_user") is True
    assert out.get("pending_action", {}).get("type") in ("submit_claim", "send_email", "fill_form")
