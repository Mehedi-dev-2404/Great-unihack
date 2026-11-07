# Fola mock data

10 made-up people for the demo. One JSON + one CSV each. Period: 2026-05-01 to 2026-11-07 ("today").

```
users/uNN_name.json          profile, accounts, net worth, hidden facts, expected answers
transactions/uNN_name.csv    ~6 months of current-account transactions
gen_mock.py                  regenerates everything (seeded, same output every run)
```

Regenerate: `python3 data/mock/gen_mock.py .` from the repo root. Edit a persona in `gen_mock.py`, not the output files, or your edits get overwritten.

## Rules for using it

| Key | Who sees it |
|---|---|
| `story` | Humans only (demo script). Never give to the agent. |
| `bank_knows` | The agent. This is what NatWest would already have. |
| `only_user_knows` | **Hidden from the agent.** The user reveals it when asked. Use it to answer as the user in tests. |
| `should_find` / `should_not_find` | Test answers. Run every persona before the demo and check the agent hits these. |

`rule_id` values match `data/benefit_rules.json`.

## CSV columns

`id, date, account_id, amount (negative = money out), balance_after, merchant, description, category, payment_method (card|direct_debit|standing_order|bank_transfer|cash|bank_fee), counterparty_type (income|benefit|bill|subscription|debt|spend|transfer)`

`payment_method` matters: a direct debit is cancelled via the bank, a card subscription via the vendor or a merchant block.

## The 10 people

| id | Who | Tests |
|---|---|---|
| u01 | Daniel, 38, Leeds, UC, 3 kids | **Demo A** YouTube Music · **Demo B** two-child limit ended, UC not updated (+£303.94/mo) · free school meals · social tariff · council tax 25% |
| u02 | Aisha, 27, Birmingham, single mum | Never claimed Child Benefit · Healthy Start · prefers Somali |
| u03 | Margaret, 78, Stockport, widow | Pension Credit unclaimed · council tax 25% · free TV licence · low vision |
| u04 | Tom, 24, Manchester, zero-hours | Volatile pay → forecast rent risk · 4 BNPL plans → StepChange · Spotify is normal (not an anomaly) |
| u05 | Priya, 45, Leicester, carer | Carer's Allowance (must warn it can affect mum's benefits) |
| u06 | Kwame, 19, Manchester, Black care leaver, student | Paying council tax as a student · Prime Video trial · opt-in opportunities · **guardrail: ethnicity never affects benefits** |
| u07 | Lukas, 31, Bristol, EU pre-settled | Council tax 25% · NOW TV double charge · immigration questions → refer out · Polish |
| u08 | Sarah & Ben, Sheffield, couple | **Not eligible** for UC (savings £17.2k) · savings forecast drops below £16k · McAfee renewal · two gyms |
| u09 | Jamal, 52, Bradford, disabled | Free prescriptions on UC · PIP → Citizens Advice · rising gambling after UC day (handle gently) |
| u10 | Helen, 41, Reading, £65k | Child Benefit tax charge · Tax-Free Childcare · council tax 25% |

Rates and rules: 2026-27 from gov.uk, checked 2026-11-07 (see `data/benefit_rules.json` for sources).
