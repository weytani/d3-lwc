# ABOUTME: Generates realistic Salesforce demo-data CSVs for SFDMU import (Phase 3 charts).
# ABOUTME: PEP723 uv script; run with `uv run sfdmu/generate_data.py` — faker is auto-provisioned.
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "faker>=24.0",
# ]
# ///

import csv
import datetime
import pathlib
import random

from faker import Faker

# Deterministic output so reviewers can diff regenerated CSVs.
SEED = 42
random.seed(SEED)
fake = Faker()
Faker.seed(SEED)

# --- Configuration ---

ACCOUNT_COUNT = 600
OPPORTUNITY_COUNT = 10000
PARENT_RATIO = 0.40

# Write CSVs next to this script regardless of the caller's CWD,
# so `uv run sfdmu/generate_data.py` from the repo root lands them in sfdmu/.
OUTPUT_DIR = pathlib.Path(__file__).resolve().parent

INDUSTRIES = [
    "Technology",
    "Healthcare",
    "Financial Services",
    "Manufacturing",
    "Retail",
    "Education",
    "Energy",
    "Media",
    "Consulting",
    "Real Estate",
]

STAGE_NAMES = [
    "Prospecting",
    "Qualification",
    "Needs Analysis",
    "Value Proposition",
    "Id. Decision Makers",
    "Perception Analysis",
    "Proposal/Price Quote",
    "Negotiation/Review",
    "Closed Won",
    "Closed Lost",
]

# Weighted toward middle stages, ~30% closed (Won + Lost)
STAGE_WEIGHTS = [6, 12, 12, 9, 8, 6, 9, 8, 18, 12]

# Base probability for each stage (noise added later)
STAGE_PROBABILITY = {
    "Prospecting": 10,
    "Qualification": 20,
    "Needs Analysis": 30,
    "Value Proposition": 40,
    "Id. Decision Makers": 50,
    "Perception Analysis": 60,
    "Proposal/Price Quote": 70,
    "Negotiation/Review": 80,
    "Closed Won": 100,
    "Closed Lost": 0,
}

TYPES = [
    "New Customer",
    "Existing Customer - Upgrade",
    "Existing Customer - Replacement",
    "Existing Customer - Downgrade",
]

LEAD_SOURCES = [
    "Web",
    "Phone Inquiry",
    "Partner Referral",
    "Purchased List",
    "Other",
    "Trade Show",
    "Employee Referral",
    "External Referral",
]


def generate_company_names(count):
    """Generate `count` unique company names via faker."""
    names = set()
    while len(names) < count:
        names.add(fake.unique.company())
    return sorted(names)


def generate_accounts(count):
    """Generate Account records; ~PARENT_RATIO have a ParentId (max 3 levels deep)."""
    names = generate_company_names(count)
    accounts = [
        {"Name": name, "ParentId": "", "Industry": random.choice(INDUSTRIES)}
        for name in names
    ]

    # Layered hierarchy: ~60% roots, then level 1/2/3 each pointing one level up.
    root_count = int(count * (1.0 - PARENT_RATIO))
    level1_start = root_count
    level1_count = int(count * 0.25)
    level2_start = level1_start + level1_count
    level2_count = int(count * 0.10)
    level3_start = level2_start + level2_count

    for i in range(level1_start, min(level1_start + level1_count, count)):
        parent_idx = random.randint(0, root_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    for i in range(level2_start, min(level2_start + level2_count, count)):
        parent_idx = random.randint(level1_start, level1_start + level1_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    for i in range(level3_start, count):
        parent_idx = random.randint(level2_start, level2_start + level2_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    return accounts


def generate_log_normal_amount():
    """Amount with log-normal distribution: clamped to $1K-$5M, median ~$50K."""
    amount = random.lognormvariate(10.82, 1.2)  # ln(50000) ~= 10.82
    return round(max(1000, min(5000000, amount)), 2)


def generate_close_date():
    """CloseDate spread across 18 months (12 back, 6 forward) with weekday bias."""
    today = datetime.date(2026, 6, 15)
    start = today - datetime.timedelta(days=365)
    end = today + datetime.timedelta(days=183)
    total_days = (end - start).days
    while True:
        date = start + datetime.timedelta(days=random.randint(0, total_days))
        if date.weekday() < 5 or random.random() < 0.20:
            return date.isoformat()


def generate_project_window(close_date_iso):
    """Project_Start before the close date; Project_End strictly after Project_Start.

    Returns (start_iso, end_iso). Start lands 10-120 days before CloseDate;
    End lands 14-365 days after Start, so End is always strictly later.
    """
    close = datetime.date.fromisoformat(close_date_iso)
    start = close - datetime.timedelta(days=random.randint(10, 120))
    end = start + datetime.timedelta(days=random.randint(14, 365))
    return start.isoformat(), end.isoformat()


def generate_opportunities(count, account_names):
    """Generate Opportunity records including the three Phase 3 fields."""
    opportunities = []
    for i in range(count):
        stage = random.choices(STAGE_NAMES, weights=STAGE_WEIGHTS, k=1)[0]
        opp_type = random.choice(TYPES)
        lead_source = random.choice(LEAD_SOURCES)
        amount = generate_log_normal_amount()
        close_date = generate_close_date()
        account_name = random.choice(account_names)

        base_prob = STAGE_PROBABILITY[stage]
        probability = max(0, min(100, round(base_prob + random.uniform(-10, 10))))

        is_closed = stage in ("Closed Won", "Closed Lost")
        is_won = stage == "Closed Won"

        project_start, project_end = generate_project_window(close_date)
        # Forecast units scale loosely with deal size; integer-valued (scale 0 field).
        forecast_units = max(1, int(amount / random.uniform(800, 5000)))

        opportunities.append(
            {
                "Name": f"{account_name} - {opp_type} - {i + 1:05d}",
                "StageName": stage,
                "Type": opp_type,
                "Amount": amount,
                "Probability": probability,
                "CloseDate": close_date,
                "LeadSource": lead_source,
                "IsClosed": str(is_closed).lower(),
                "IsWon": str(is_won).lower(),
                "AccountId": account_name,
                "Project_Start__c": project_start,
                "Project_End__c": project_end,
                "Forecast_Units__c": forecast_units,
            }
        )
    return opportunities


def write_csv(filename, records, fieldnames):
    """Write records to OUTPUT_DIR/filename."""
    path = OUTPUT_DIR / filename
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    return path


def print_stats(accounts, opportunities):
    """Print distribution statistics for verification."""
    print("\n--- Data Generation Summary ---")
    print(f"Accounts: {len(accounts)}")
    print(f"Opportunities: {len(opportunities)}")

    with_parents = sum(1 for a in accounts if a["ParentId"])
    print(f"\nAccounts with parents: {with_parents} ({with_parents / len(accounts) * 100:.0f}%)")

    print("\nStage Distribution:")
    stage_counts = {}
    for opp in opportunities:
        stage_counts[opp["StageName"]] = stage_counts.get(opp["StageName"], 0) + 1
    for stage in STAGE_NAMES:
        c = stage_counts.get(stage, 0)
        print(f"  {stage}: {c} ({c / len(opportunities) * 100:.1f}%)")

    amounts = sorted(opp["Amount"] for opp in opportunities)
    print(f"\nAmount Range: ${min(amounts):,.2f} - ${max(amounts):,.2f}")
    print(f"Amount Median: ${amounts[len(amounts) // 2]:,.2f}")
    print(f"Amount Mean: ${sum(amounts) / len(amounts):,.2f}")

    units = sorted(opp["Forecast_Units__c"] for opp in opportunities)
    print(f"\nForecast Units Range: {min(units):,} - {max(units):,}")
    print(f"Forecast Units Median: {units[len(units) // 2]:,}")

    closed = sum(1 for opp in opportunities if opp["IsClosed"] == "true")
    print(f"\nClosed: {closed} ({closed / len(opportunities) * 100:.1f}%)")


if __name__ == "__main__":
    print("Generating Account data...")
    accounts = generate_accounts(ACCOUNT_COUNT)
    account_names = [a["Name"] for a in accounts]

    print("Generating Opportunity data...")
    opportunities = generate_opportunities(OPPORTUNITY_COUNT, account_names)

    print("Writing Account.csv...")
    write_csv("Account.csv", accounts, ["Name", "ParentId", "Industry"])

    print("Writing Opportunity.csv...")
    write_csv(
        "Opportunity.csv",
        opportunities,
        [
            "Name",
            "StageName",
            "Type",
            "Amount",
            "Probability",
            "CloseDate",
            "LeadSource",
            "IsClosed",
            "IsWon",
            "AccountId",
            "Project_Start__c",
            "Project_End__c",
            "Forecast_Units__c",
        ],
    )

    print_stats(accounts, opportunities)
    print(f"\nDone! Files written to {OUTPUT_DIR}")
