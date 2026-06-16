# ABOUTME: Tests the SFDMU data generator's schema, row counts, and Phase 3 field invariants.
# ABOUTME: Run with: uv run --with pytest --with faker pytest sfdmu/test_generate_data.py
import datetime
import importlib.util
import pathlib

_SPEC = importlib.util.spec_from_file_location(
    "generate_data", pathlib.Path(__file__).parent / "generate_data.py"
)
gen = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(gen)


def test_account_count_and_columns():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    assert len(accounts) == 600
    assert set(accounts[0].keys()) == {"Name", "ParentId", "Industry"}


def test_account_parent_ratio_near_40_percent():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    with_parents = sum(1 for a in accounts if a["ParentId"])
    ratio = with_parents / len(accounts)
    assert 0.35 <= ratio <= 0.45, f"parent ratio {ratio:.2f} not ~40%"


def test_ten_distinct_industries_available():
    assert len(set(gen.INDUSTRIES)) == 10


def test_opportunity_count_and_columns():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    names = [a["Name"] for a in accounts]
    opps = gen.generate_opportunities(gen.OPPORTUNITY_COUNT, names)
    assert len(opps) == 10000
    assert set(opps[0].keys()) == {
        "Name", "StageName", "Type", "Amount", "Probability",
        "CloseDate", "LeadSource", "IsClosed", "IsWon", "AccountId",
        "Project_Start__c", "Project_End__c", "Forecast_Units__c",
    }


def test_project_end_strictly_after_start():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    names = [a["Name"] for a in accounts]
    opps = gen.generate_opportunities(gen.OPPORTUNITY_COUNT, names)
    for opp in opps:
        start = datetime.date.fromisoformat(opp["Project_Start__c"])
        end = datetime.date.fromisoformat(opp["Project_End__c"])
        assert end > start, f"{opp['Name']}: end {end} not after start {start}"


def test_forecast_units_numeric_integer():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    names = [a["Name"] for a in accounts]
    opps = gen.generate_opportunities(gen.OPPORTUNITY_COUNT, names)
    for opp in opps[:200]:
        units = opp["Forecast_Units__c"]
        assert isinstance(units, int), f"Forecast_Units__c not int: {units!r}"
        assert units >= 0
