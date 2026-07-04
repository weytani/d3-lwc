#!/usr/bin/env bash
# ABOUTME: Deploys an LWC bundle that removes an @api property currently referenced
# ABOUTME: by a Lightning page, via the detach -> deploy -> reattach sequence.
#
# Salesforce validates @api property-tag removal against the ORG'S CURRENT bundle,
# not the incoming one -- deploying a page-property-value removal and the bundle's
# property-tag removal in the same deploy (or even as two separate deploys, page
# first) still fails with "You can't remove the property tag ... in use on one or
# more Lightning pages" as long as some page instance references the property, even
# if that instance sets no value for it. The only way through is to fully detach the
# component instance from every referencing page first.
#
# This script automates the mechanical, error-prone part: the deploy sequencing and
# correctly parsing `sf project deploy start --json` for success/failure (the fields
# are `result.status` / `result.success` / `result.details.componentFailures` --
# NOT a `done` field). It deliberately does NOT attempt to auto-edit the page XML:
# finding "the right" <componentInstance> block to strip requires knowing which of
# possibly several instances of the same chart type on the page is the one being
# migrated, which is judgment, not a mechanical pattern -- a blind sed/grep removal
# risks detaching the wrong instance on a page with multiple charts of the same type.
#
# Precondition: before running this script,
#   1. Edit the flexipage file in place so the target component's <itemInstances>
#      block (or just the property values) is DELETED -- the detached state.
#   2. Commit the FINAL desired state (component reattached with new properties)
#      to git HEAD. This script restores that committed state for the reattach step.
#
# Usage: ./scripts/deploy-property-removal.sh <org-alias> <flexipage-source-file> <bundle-dir> [<bundle-dir> ...]
# Example:
#   # (flexipage already hand-edited to detach the Gantt instance; final state is committed at HEAD)
#   ./scripts/deploy-property-removal.sh AGENT \
#     force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml \
#     force-app/main/default/lwc/graphqlService \
#     force-app/main/default/lwc/d3GanttChart

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <org-alias> <flexipage-source-file> <bundle-dir> [<bundle-dir> ...]" >&2
  exit 1
fi

ORG="$1"
FLEXIPAGE="$2"
shift 2
BUNDLES=("$@")

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

if [[ ! -f "$FLEXIPAGE" ]]; then
  echo "ERROR: Flexipage not found at $FLEXIPAGE" >&2
  exit 1
fi

for b in "${BUNDLES[@]}"; do
  if [[ ! -d "$b" ]]; then
    echo "ERROR: Bundle directory not found: $b" >&2
    exit 1
  fi
done

if ! git -C "$(dirname "$FLEXIPAGE")" diff --quiet -- "$FLEXIPAGE" 2>/dev/null; then
  echo "[precondition] $FLEXIPAGE has uncommitted changes (expected -- this should be your detached edit)."
else
  echo "WARNING: $FLEXIPAGE has NO uncommitted changes. Did you forget to detach the component instance first?" >&2
  read -r -p "Continue anyway? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || exit 1
fi

check_deploy() {
  local json_file="$1"
  local label="$2"
  python3 -c "
import json, sys
d = json.load(open('$json_file'))
r = d.get('result', {})
status = r.get('status')
success = r.get('success')
if not success:
    print(f'FAILED: $label -- status={status}', file=sys.stderr)
    for f in (r.get('details', {}).get('componentFailures') or []):
        print('  -', f.get('fileName'), '-', f.get('problem'), file=sys.stderr)
    sys.exit(1)
print(f'OK: $label -- status={status}')
"
}

echo "[1/3] Deploying DETACHED flexipage (component instance removed) ..."
sf project deploy start -o "$ORG" --source-dir "$FLEXIPAGE" --json > "$WORKDIR/step1.json"
check_deploy "$WORKDIR/step1.json" "detach $FLEXIPAGE"

echo "[2/3] Deploying bundle(s): ${BUNDLES[*]} ..."
sf project deploy start -o "$ORG" --source-dir "${BUNDLES[@]}" --json > "$WORKDIR/step2.json"
check_deploy "$WORKDIR/step2.json" "bundle deploy"

echo "[3/3] Restoring committed flexipage state (reattach) and deploying ..."
git checkout HEAD -- "$FLEXIPAGE"
sf project deploy start -o "$ORG" --source-dir "$FLEXIPAGE" --json > "$WORKDIR/step3.json"
check_deploy "$WORKDIR/step3.json" "reattach $FLEXIPAGE"

echo "[done] Property-removal deploy sequence complete. Verify the live render before trusting it."
