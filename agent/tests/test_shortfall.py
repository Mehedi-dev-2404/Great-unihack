"""Rent shortfall prediction, the alert built from it and the two actions it suggests."""
import json
from datetime import date
from pathlib import Path

from api import engine
from api.actions import execute, shortfall_draft

DATA = Path(__file__).resolve().parents[2] / "data"
TODAY = date(2026, 11, 7)


def _demo():
    return json.loads((DATA / "profile.json").read_text()), json.loads((DATA / "transactions.json").read_text())


def test_demo_rent_comes_up_about_80_short_before_uc():
    profile, txns = _demo()
    sf = engine.predict_shortfall(profile, txns, TODAY)
    assert sf["merchant"] == "One Manchester"
    assert sf["due_date"] == "2026-11-12"
    assert sf["shortfall"] == 80  # matches predictStops() in the frontend
    assert sf["next_income"]["date"] == "2026-11-14"


def test_no_shortfall_with_enough_money():
    profile, txns = _demo()
    profile["net_worth"] += 500
    assert engine.predict_shortfall(profile, txns, TODAY) is None


def test_shortfall_alert_leads_and_clears_after_top_up():
    profile, txns = _demo()
    notes = engine.shortfall_notifications(profile, txns, [], TODAY)
    assert notes[0]["id"] == "n-rent-shortfall" and notes[0]["severity"] == "high"
    reminder = [{"notification_id": "n-rent-shortfall", "status": "approved", "type": "set_reminder"}]
    assert engine.shortfall_notifications(profile, txns, reminder, TODAY)[0]["reminder_set"] is True
    topped = [{"notification_id": "n-rent-shortfall", "status": "approved", "type": "top_up_transfer"}]
    assert engine.shortfall_notifications(profile, txns, topped, TODAY) == []


def test_top_up_uses_an_account_on_file_and_is_capped():
    profile, txns = _demo()
    n = engine.shortfall_notifications(profile, txns, [], TODAY)[0]
    a = shortfall_draft("top_up_transfer", profile, n)
    f = a["form"]["fields"]
    assert f["from_account"] == "Manchester Credit Union savings"
    assert 80 <= f["max_amount"] <= 420
    assert f["before_date"] == "2026-11-11" and f["recurring"] is True
    report = execute({**a, "id": "a-test"})
    assert report["outcome"] == "scheduled" and report["details"]["simulated"] is True


def test_top_up_without_savings_moves_nothing():
    profile, txns = _demo()
    n = engine.shortfall_notifications(profile, txns, [], TODAY)[0]
    a = shortfall_draft("top_up_transfer", {**profile, "savings": []}, n)
    assert a["form"]["fields"]["max_amount"] == 0 and a["form"]["fields"]["from_account"] is None
