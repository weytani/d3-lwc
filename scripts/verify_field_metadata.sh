#!/usr/bin/env bash
# ABOUTME: Verifies the three Phase 3 Opportunity custom field metadata files exist and are well-formed.
# ABOUTME: Used as the red/green gate for the declarative field-metadata tasks (no Apex/Jest involved).
set -euo pipefail

DIR="force-app/main/default/objects/Opportunity/fields"
fail=0

check_field() {
  local file="$1" type="$2" extra="$3"
  if [[ ! -f "$file" ]]; then
    echo "MISSING: $file"; fail=1; return
  fi
  grep -q "<type>${type}</type>" "$file" || { echo "BAD TYPE in $file (expected ${type})"; fail=1; }
  if [[ -n "$extra" ]]; then
    grep -q "$extra" "$file" || { echo "MISSING '${extra}' in $file"; fail=1; }
  fi
  # fullName must equal the API name in the file (matches filename stem)
  local stem; stem="$(basename "$file" .field-meta.xml)"
  grep -q "<fullName>${stem}</fullName>" "$file" || { echo "BAD fullName in $file (expected ${stem})"; fail=1; }
}

check_field "$DIR/Project_Start__c.field-meta.xml"   "Date"   ""
check_field "$DIR/Project_End__c.field-meta.xml"     "Date"   ""
check_field "$DIR/Forecast_Units__c.field-meta.xml"  "Number" "<scale>0</scale>"

if [[ "$fail" -ne 0 ]]; then
  echo "FIELD METADATA VERIFICATION FAILED"; exit 1
fi
echo "FIELD METADATA VERIFICATION PASSED"
