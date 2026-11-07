"""Self-contained demo fixture matching the schemas in docs/PROJECT.md.

Persona: single parent on Universal Credit in Manchester with three children (4, 9, 14).
UC currently includes the child element for only two of them; the two-child limit was
removed from 6 April 2026. Three months of steady transactions plus a new YouTube Music charge.
"""

from __future__ import annotations

import copy

PROFILE = {
    "id": "u01",
    "name": "Amara Okafor",
    "age": 34,
    "city": "Manchester",
    "council": "Manchester City Council",
    "household": {"adults": 1, "children": [
        {"name": "Tobi", "age": 4}, {"name": "Zara", "age": 9}, {"name": "Daniel", "age": 14}]},
    "employment": "Part-time retail assistant",
    "monthly_income": 1450.0,
    "benefits": [{"name": "Universal Credit", "monthly_amount": 1180.00, "child_elements_paid": 2},
                 {"name": "Child Benefit", "monthly_amount": 254.80}],
    "facts": {},
    "net_worth": 812.40,
    "net_worth_history": [{"month": "2026-10", "net_worth": 812.40}],
}


def _monthly(prefix: str, months: list[str], day: str, desc: str, merchant: str, amount: float, cat: str):
    return [{"id": f"{prefix}-{m}", "date": f"{m}-{day}", "description": desc, "merchant": merchant,
             "amount": amount, "category": cat} for m in months]


MONTHS = ["2026-08", "2026-09", "2026-10"]
TRANSACTIONS = (
    _monthly("t-wage", MONTHS, "01", "WAGES ACME RETAIL", "Acme Retail", 820.00, "income")
    + _monthly("t-uc", MONTHS, "05", "DWP UC", "DWP Universal Credit", 1180.00, "benefits")
    + _monthly("t-rent", MONTHS, "02", "RENT ONE MANCHESTER", "One Manchester", -650.00, "housing")
    + _monthly("t-ctax", MONTHS, "03", "MANCHESTER CC CTAX", "Manchester City Council", -98.40, "bills")
    + _monthly("t-energy", MONTHS, "08", "OCTOPUS ENERGY", "Octopus Energy", -95.00, "bills")
    + _monthly("t-phone", MONTHS, "12", "GIFFGAFF", "giffgaff", -10.00, "bills")
    + _monthly("t-netflix", MONTHS, "15", "NETFLIX.COM", "Netflix", -5.99, "subscription")
    + _monthly("t-tesco1", MONTHS, "06", "TESCO STORES", "Tesco", -84.20, "groceries")
    + _monthly("t-tesco2", MONTHS, "20", "TESCO STORES", "Tesco", -91.35, "groceries")
    + [
        {"id": "t-ytm-1", "date": "2026-10-18", "description": "GOOGLE *YouTube Music", "merchant": "YouTube Music",
         "amount": -10.99, "category": "subscription"},
        {"id": "t-shoes", "date": "2026-10-10", "description": "CLARKS", "merchant": "Clarks",
         "amount": -38.00, "category": "shopping"},
    ]
)

RULES = [
    {
        "id": "uc_two_child_limit_removed",
        "name": "Universal Credit child element for every child (two-child limit removed)",
        "type": "benefit",
        "description": "From 6 April 2026 the two-child limit was removed, so Universal Credit includes a "
                       "child element for every child who lives with you and is under 18 (or under 20 in "
                       "approved education).",
        "eligibility": {"benefits_any": ["Universal Credit"], "min_children": 3,
                        "required_facts": {"children_live_with_user": True}},
        "follow_up_questions": ["Do all three of your children live with you, and are they all under 18?"],
        "monthly_value": 303.94,
        "source_url": "https://www.gov.uk/universal-credit/how-your-payment-is-calculated",
        "action_type": "submit_claim",
    },
    {
        "id": "council_tax_single_person_discount",
        "name": "Council Tax single person discount",
        "type": "council",
        "description": "You get 25% off your Council Tax bill if you are the only adult in your home.",
        "eligibility": {"adults_max": 1, "required_facts": {"receives_single_person_discount": False}},
        "follow_up_questions": ["Does your council tax bill already show a 25% single person discount?"],
        "monthly_value": 32.80,
        "source_url": "https://www.gov.uk/council-tax/discounts-for-people-who-live-alone",
        "action_type": "send_email",
    },
]

NOTIFICATIONS = [
    {"id": "n-uc-child-element", "type": "demographic",
     "title": "You may be missing £303.94 a month for your third child",
     "body": "The two-child limit on Universal Credit ended on 6 April 2026. Your UC still includes only "
             "two of your three children.",
     "severity": "high", "rule_id": "uc_two_child_limit_removed", "suggested_action": "submit_claim"},
    {"id": "n-ytm", "type": "financial", "title": "New YouTube Music subscription",
     "body": "A new £10.99 monthly charge from YouTube Music started on 18 October. You haven't paid "
             "them before.", "severity": "medium", "transaction_ids": ["t-ytm-1"],
     "suggested_action": "cancel_subscription"},
]


def make_context() -> dict:
    return copy.deepcopy({"profile": PROFILE, "transactions": TRANSACTIONS, "rules": RULES,
                          "notifications": NOTIFICATIONS})
