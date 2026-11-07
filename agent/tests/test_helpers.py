"""Unit tests for the deterministic helpers (no network)."""

import copy
import json

from agent import brain
from agent.tests.fixtures import PROFILE, RULES, TRANSACTIONS, make_context

UC_RULE = RULES[0]


# --- anomalies -------------------------------------------------------------

def test_youtube_music_flagged():
    found = brain.detect_anomalies(TRANSACTIONS)
    assert [a["merchant"] for a in found] == ["YouTube Music"]
    a = found[0]
    assert a["amount"] == 10.99
    assert a["first_seen"] == "2026-10-18"
    assert a["months_seen"] == 1
    assert a["transaction_ids"] == ["t-ytm-1"]


def test_long_standing_subscriptions_not_flagged():
    found = {a["merchant"] for a in brain.detect_anomalies(TRANSACTIONS)}
    assert "Netflix" not in found
    assert "giffgaff" not in found
    assert "Clarks" not in found  # one-off shopping is not a subscription


def test_recurring_new_merchant_over_two_months():
    txs = TRANSACTIONS + [{"id": "t-ytm-2", "date": "2026-11-18", "description": "GOOGLE *YouTube Music",
                           "merchant": "YouTube Music", "amount": -10.99, "category": "subscription"}]
    a = brain.detect_anomalies(txs)[0]
    assert a["merchant"] == "YouTube Music" and a["months_seen"] == 2 and a["occurrences"] == 2


def test_no_anomalies_on_empty():
    assert brain.detect_anomalies([]) == []


def test_spending_summary():
    s = brain.spending_summary(TRANSACTIONS)
    assert [m["month"] for m in s["months"]] == ["2026-08", "2026-09", "2026-10"]
    aug = s["months"][0]
    assert aug["money_in"] == 2000.00
    assert aug["money_out"] == round(650 + 98.40 + 95 + 10 + 5.99 + 84.20 + 91.35, 2)
    assert s["months"][0]["top_categories"][0]["category"] == "housing"
    assert len(brain.spending_summary(TRANSACTIONS, months=1)["months"]) == 1


# --- eligibility -----------------------------------------------------------

def test_uc_child_needs_info_before_fact():
    r = brain.check_eligibility(UC_RULE, PROFILE, {})
    assert r["status"] == "needs_info"
    assert r["question"] == "Do all three of your children live with you, and are they all under 18?"
    assert r["missing_fact"] == "children_live_with_user"


def test_uc_child_eligible_once_confirmed():
    r = brain.check_eligibility(UC_RULE, PROFILE, {"children_live_with_user": True,
                                                    "children_ages": [4, 9, 14]})
    assert r["status"] == "eligible"
    assert r["missing_child_elements"] == 1
    assert r["estimated_monthly_gain"] == 303.94


def test_uc_child_eligible_with_fact_in_profile():
    p = copy.deepcopy(PROFILE)
    p["facts"] = {"children_live_with_user": True, "children_all_under_18": True}
    assert brain.check_eligibility(UC_RULE, p)["status"] == "eligible"


def test_uc_child_not_eligible_two_children():
    p = copy.deepcopy(PROFILE)
    p["household"]["children"] = p["household"]["children"][:2]
    r = brain.check_eligibility(UC_RULE, p, {"children_live_with_user": True})
    assert r["status"] == "not_eligible" and "three or more" in r["reason"]


def test_uc_child_not_eligible_without_uc():
    p = copy.deepcopy(PROFILE)
    p["benefits"] = [{"name": "Child Benefit", "monthly_amount": 254.80}]
    r = brain.check_eligibility(UC_RULE, p, {"children_live_with_user": True})
    assert r["status"] == "not_eligible" and "Universal Credit" in r["reason"]


def test_uc_child_not_eligible_children_elsewhere():
    r = brain.check_eligibility(UC_RULE, PROFILE, {"children_live_with_user": False})
    assert r["status"] == "not_eligible" and r["reason"]


def test_uc_older_child_needs_education_question():
    r = brain.check_eligibility(UC_RULE, PROFILE, {"children_live_with_user": True,
                                                    "children_ages": [4, 9, 18]})
    assert r["status"] == "needs_info" and "college" in r["question"]


def test_generic_rule_needs_info_then_eligible():
    rule = RULES[1]
    assert brain.check_eligibility(rule, PROFILE, {})["status"] == "needs_info"
    assert brain.check_eligibility(rule, PROFILE, {"receives_single_person_discount": False})["status"] == "eligible"
    p = copy.deepcopy(PROFILE)
    p["household"]["adults"] = 2
    assert brain.check_eligibility(rule, p, {})["status"] == "not_eligible"


# --- drafting & speech -----------------------------------------------------

def test_draft_cancel_subscription():
    ctx = make_context()
    a = brain.draft_action("cancel_subscription", ctx, ctx["notifications"][1], "user did not sign up")
    assert a["type"] == "cancel_subscription"
    assert a["notification_id"] == "n-ytm"
    assert "YouTube Music" in a["title"]
    assert a["draft"]["to"] == "YouTube Music customer support (via Google Payments)"
    assert "Purchases and memberships" in a["summary"]
    assert "@" not in json.dumps(a)  # never invent email addresses
    assert "refund" in a["draft"]["body"]
    assert not {"id", "status", "created_at"} & set(a)


def test_draft_uc_claim():
    ctx = make_context()
    ctx["profile"]["facts"] = {"children_live_with_user": True, "children_ages": [4, 9, 14]}
    a = brain.draft_action("submit_claim", ctx, ctx["notifications"][0])
    assert a["type"] == "submit_claim" and a["notification_id"] == "n-uc-child-element"
    assert a["form"]["fields"]["child_elements_requested"] == 1
    assert "6 April 2026" in a["draft"]["body"]


def test_draft_action_never_raises():
    a = brain.draft_action("nonsense", {})
    assert a["type"] == "send_email" and "title" in a


def test_strip_markdown():
    s = brain.strip_markdown("## Hi\n**Good news!** You can:\n- save *£10.99*\n- see [gov.uk](https://gov.uk)")
    assert "*" not in s and "#" not in s and "[" not in s
    assert "£10.99" in s and "gov.uk" in s


def test_chat_fallback_without_network(monkeypatch):
    def boom():
        raise RuntimeError("no network")
    monkeypatch.setattr(brain, "_get_client", boom)
    out = brain.chat("hello", make_context())
    assert out["reply"] == brain.FALLBACK_REPLY
    assert "pending_action" not in out


# --- rules.json condition DSL (shape used by data/rules.json) ---------------

DSL_RULE = {
    "id": "healthy_start", "name": "Healthy Start", "type": "benefit", "monthly_value": 18.42,
    "eligibility": {"all": [
        {"field": "on_universal_credit", "op": "==", "value": True},
        {"field": "youngest_child_age", "op": "<", "value": 4},
        {"field": "monthly_earned_income", "op": "<=", "value": 408},
        {"field": "benefit_names", "op": "not_contains", "value": "Healthy Start"}],
        "required_facts": [{"key": "pregnant_or_child_under_4_confirmed", "expected": True,
                            "question": "Is your youngest child under 4?"}]},
    "follow_up_questions": ["Is your take-home pay from work £408 a month or less?"],
    "action_type": "submit_claim",
}


def test_dsl_rule_paths():
    p = copy.deepcopy(PROFILE)
    p["household"]["children"][0]["age"] = 3
    p["monthly_earned_income"] = 395.0
    r = brain.check_eligibility(DSL_RULE, p, {})
    assert r["status"] == "needs_info" and r["question"] == "Is your youngest child under 4?"
    assert brain.check_eligibility(DSL_RULE, p, {"pregnant_or_child_under_4_confirmed": True})["status"] == "eligible"
    p["monthly_earned_income"] = 900.0
    r = brain.check_eligibility(DSL_RULE, p, {"pregnant_or_child_under_4_confirmed": True})
    assert r["status"] == "not_eligible" and "900" in r["reason"]


def test_uc_rule_with_dsl_shape_and_engine_fact_names():
    rule = dict(UC_RULE, eligibility={"all": [{"field": "children_count", "op": ">=", "value": 3}],
                                      "required_facts": [{"key": "children_live_with_user", "expected": True,
                                                          "question": "..."}]})
    p = copy.deepcopy(PROFILE)
    p["benefits"][0] = {"name": "Universal Credit", "monthly_amount": 1412.4, "children_included": 2}
    assert brain.check_eligibility(rule, p, {})["status"] == "needs_info"
    r = brain.check_eligibility(rule, p, {"children_live_with_user": True, "children_eligible_age": True})
    assert r["status"] == "eligible" and r["child_elements_paid"] == 2


def test_normalise_facts_sets_engine_aliases():
    f = brain.normalise_facts({"children_live_with_user": "yes", "children_ages": [4, 9, 14]})
    assert f["children_live_with_user"] is True
    assert f["children_all_under_18"] is True and f["children_eligible_age"] is True
