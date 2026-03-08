# ABOUTME: Generates realistic Salesforce test data CSVs for SFDMU import.
# ABOUTME: Creates 300 Accounts and 5000 Opportunities with distribution requirements from PROJECT-SPEC.md.

import csv
import math
import random
from datetime import datetime, timedelta

random.seed(42)

# --- Configuration ---

ACCOUNT_COUNT = 300
OPPORTUNITY_COUNT = 5000

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

# Company name components for realistic names
PREFIXES = [
    "Apex",
    "Nova",
    "Stellar",
    "Peak",
    "Summit",
    "Cascade",
    "Horizon",
    "Meridian",
    "Vertex",
    "Quantum",
    "Nexus",
    "Prism",
    "Atlas",
    "Zenith",
    "Vanguard",
    "Catalyst",
    "Pinnacle",
    "Stratos",
    "Ember",
    "Forge",
    "Cobalt",
    "Onyx",
    "Titan",
    "Helix",
    "Cipher",
    "Flux",
    "Orbit",
    "Pulse",
    "Vector",
    "Matrix",
]

SUFFIXES = [
    "Systems",
    "Solutions",
    "Industries",
    "Corp",
    "Group",
    "Labs",
    "Technologies",
    "Dynamics",
    "Ventures",
    "Partners",
    "Analytics",
    "Networks",
    "Digital",
    "Innovations",
    "Enterprises",
    "Services",
    "Global",
    "Capital",
    "Works",
    "Logic",
]


def generate_company_names(count):
    """Generate unique company names from prefix/suffix combinations."""
    names = set()
    while len(names) < count:
        name = f"{random.choice(PREFIXES)} {random.choice(SUFFIXES)}"
        names.add(name)
    return sorted(names)


def generate_accounts(count):
    """Generate Account records with parent hierarchy (~40% have parents, max 3 levels)."""
    names = generate_company_names(count)
    accounts = []

    for i, name in enumerate(names):
        accounts.append(
            {
                "Name": name,
                "ParentId": "",
                "Industry": random.choice(INDUSTRIES),
            }
        )

    # Assign parents to ~40% of accounts (max 3 levels deep)
    # Level 0: no parent (root) — first 60%
    # Level 1: parent is a root account
    # Level 2: parent is a level-1 account
    # Level 3: parent is a level-2 account
    root_count = int(count * 0.60)
    level1_start = root_count
    level1_count = int(count * 0.25)
    level2_start = level1_start + level1_count
    level2_count = int(count * 0.10)
    level3_start = level2_start + level2_count

    # Level 1 accounts reference root accounts
    for i in range(level1_start, min(level1_start + level1_count, count)):
        parent_idx = random.randint(0, root_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    # Level 2 accounts reference level 1 accounts
    for i in range(level2_start, min(level2_start + level2_count, count)):
        parent_idx = random.randint(level1_start, level1_start + level1_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    # Level 3 accounts reference level 2 accounts
    for i in range(level3_start, count):
        parent_idx = random.randint(level2_start, level2_start + level2_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    return accounts


def generate_log_normal_amount():
    """Generate Amount with log-normal distribution: $1K–$5M, median ~$50K."""
    # ln(50000) ≈ 10.82
    mu = 10.82
    sigma = 1.2
    amount = random.lognormvariate(mu, sigma)
    # Clamp to $1K–$5M
    amount = max(1000, min(5000000, amount))
    return round(amount, 2)


def generate_close_date():
    """Generate CloseDate spread across 18 months with weekday bias."""
    today = datetime(2026, 3, 7)
    start = today - timedelta(days=365)
    end = today + timedelta(days=183)
    total_days = (end - start).days

    while True:
        day_offset = random.randint(0, total_days)
        date = start + timedelta(days=day_offset)
        # 80% weekday bias
        if date.weekday() < 5 or random.random() < 0.20:
            return date.strftime("%Y-%m-%d")


def generate_opportunities(count, account_names):
    """Generate Opportunity records with distributions per PROJECT-SPEC.md."""
    opportunities = []

    for i in range(count):
        stage = random.choices(STAGE_NAMES, weights=STAGE_WEIGHTS, k=1)[0]
        opp_type = random.choice(TYPES)
        lead_source = random.choice(LEAD_SOURCES)
        amount = generate_log_normal_amount()
        close_date = generate_close_date()
        account_name = random.choice(account_names)

        # Probability correlated with stage ±10% noise
        base_prob = STAGE_PROBABILITY[stage]
        noise = random.uniform(-10, 10)
        probability = max(0, min(100, round(base_prob + noise)))

        # Closed status
        is_closed = stage in ("Closed Won", "Closed Lost")
        is_won = stage == "Closed Won"

        opp_name = f"{account_name} - {opp_type} - {i + 1:05d}"

        opportunities.append(
            {
                "Name": opp_name,
                "StageName": stage,
                "Type": opp_type,
                "Amount": amount,
                "Probability": probability,
                "CloseDate": close_date,
                "LeadSource": lead_source,
                "IsClosed": str(is_closed).lower(),
                "IsWon": str(is_won).lower(),
                "AccountId": account_name,
            }
        )

    return opportunities


def write_csv(filename, records, fieldnames):
    """Write records to CSV file."""
    with open(filename, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def print_stats(accounts, opportunities):
    """Print distribution statistics for verification."""
    print(f"\n--- Data Generation Summary ---")
    print(f"Accounts: {len(accounts)}")
    print(f"Opportunities: {len(opportunities)}")

    # Parent distribution
    with_parents = sum(1 for a in accounts if a["ParentId"])
    print(f"\nAccounts with parents: {with_parents} ({with_parents/len(accounts)*100:.0f}%)")

    # Stage distribution
    print("\nStage Distribution:")
    stage_counts = {}
    for opp in opportunities:
        stage_counts[opp["StageName"]] = stage_counts.get(opp["StageName"], 0) + 1
    for stage in STAGE_NAMES:
        count = stage_counts.get(stage, 0)
        print(f"  {stage}: {count} ({count/len(opportunities)*100:.1f}%)")

    # Amount stats
    amounts = [opp["Amount"] for opp in opportunities]
    amounts.sort()
    print(f"\nAmount Range: ${min(amounts):,.2f} - ${max(amounts):,.2f}")
    print(f"Amount Median: ${amounts[len(amounts)//2]:,.2f}")
    print(f"Amount Mean: ${sum(amounts)/len(amounts):,.2f}")

    # Type distribution
    print("\nType Distribution:")
    type_counts = {}
    for opp in opportunities:
        type_counts[opp["Type"]] = type_counts.get(opp["Type"], 0) + 1
    for t, c in sorted(type_counts.items()):
        print(f"  {t}: {c} ({c/len(opportunities)*100:.1f}%)")

    # Closed stats
    closed = sum(1 for opp in opportunities if opp["IsClosed"] == "true")
    print(f"\nClosed: {closed} ({closed/len(opportunities)*100:.1f}%)")


if __name__ == "__main__":
    print("Generating Account data...")
    accounts = generate_accounts(ACCOUNT_COUNT)

    account_names = [a["Name"] for a in accounts]

    print("Generating Opportunity data...")
    opportunities = generate_opportunities(OPPORTUNITY_COUNT, account_names)

    print("Writing Account.csv...")
    write_csv(
        "Account.csv",
        accounts,
        ["Name", "ParentId", "Industry"],
    )

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
        ],
    )

    print_stats(accounts, opportunities)
    print("\nDone! Files written to current directory.")
