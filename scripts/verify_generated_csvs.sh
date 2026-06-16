#!/usr/bin/env bash
# ABOUTME: Verifies the regenerated SFDMU CSVs have the expected row counts and Phase 3 columns.
# ABOUTME: Run AFTER `uv run sfdmu/generate_data.py`. CSVs are gitignored; this script is committed.
set -euo pipefail

ACC="sfdmu/Account.csv"
OPP="sfdmu/Opportunity.csv"
fail=0

[[ -f "$ACC" ]] || { echo "MISSING: $ACC"; exit 1; }
[[ -f "$OPP" ]] || { echo "MISSING: $OPP"; exit 1; }

# Account: header + 600 rows = 601 lines
acc_lines="$(wc -l < "$ACC" | tr -d ' ')"
[[ "$acc_lines" == "601" ]] || { echo "Account.csv has $acc_lines lines (expected 601)"; fail=1; }

# Opportunity: header + 10000 rows = 10001 lines
opp_lines="$(wc -l < "$OPP" | tr -d ' ')"
[[ "$opp_lines" == "10001" ]] || { echo "Opportunity.csv has $opp_lines lines (expected 10001)"; fail=1; }

# Opportunity header must contain the three Phase 3 fields.
opp_header="$(head -1 "$OPP")"
for f in Project_Start__c Project_End__c Forecast_Units__c; do
  echo "$opp_header" | grep -q "$f" || { echo "Opportunity.csv header missing $f"; fail=1; }
done

# Account header must be exactly the three legacy columns.
# Strip a trailing CR: csv.DictWriter emits CRLF line terminators, which head -1 retains.
acc_header="$(head -1 "$ACC" | tr -d '\r')"
[[ "$acc_header" == "Name,ParentId,Industry" ]] || { echo "Account.csv header is '$acc_header' (expected 'Name,ParentId,Industry')"; fail=1; }

# Confirm both CSVs are gitignored (no accidental commit).
git check-ignore -q "$ACC" || { echo "$ACC is NOT gitignored"; fail=1; }
git check-ignore -q "$OPP" || { echo "$OPP is NOT gitignored"; fail=1; }

if [[ "$fail" -ne 0 ]]; then
  echo "GENERATED CSV VERIFICATION FAILED"; exit 1
fi
echo "GENERATED CSV VERIFICATION PASSED"
