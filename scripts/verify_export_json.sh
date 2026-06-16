#!/usr/bin/env bash
# ABOUTME: Verifies sfdmu/export.json is valid JSON and the Opportunity query includes the three Phase 3 fields.
# ABOUTME: Used as the red/green gate for the SFDMU config task.
set -euo pipefail

FILE="sfdmu/export.json"
[[ -f "$FILE" ]] || { echo "MISSING: $FILE"; exit 1; }

# Valid JSON?
uv run --no-project --with-requirements /dev/null python -c "import json,sys; json.load(open('$FILE'))" 2>/dev/null \
  || python3 -c "import json; json.load(open('$FILE'))" \
  || { echo "INVALID JSON: $FILE"; exit 1; }

for f in Project_Start__c Project_End__c Forecast_Units__c; do
  grep -q "$f" "$FILE" || { echo "MISSING field '$f' in $FILE Opportunity query"; exit 1; }
done

echo "EXPORT.JSON VERIFICATION PASSED"
