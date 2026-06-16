#!/usr/bin/env bash
# ABOUTME: Syncs d3-lwc source files into the agentforce-dev project.
# ABOUTME: Copies Apex classes, shared LWC modules, chart components, and Jest mocks.

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SRC="$HOME/code/d3-lwc"
DST="$HOME/code/agentforce-dev"

SRC_CLASSES="$SRC/force-app/main/default/classes"
DST_CLASSES="$DST/force-app/main/d3/classes"

SRC_LWC="$SRC/force-app/main/default/lwc"
DST_LWC="$DST/force-app/main/d3/lwc"

SRC_MOCKS="$SRC/__mocks__"
DST_MOCKS="$DST/__mocks__"

# ---------------------------------------------------------------------------
# Verify directories exist
# ---------------------------------------------------------------------------
if [[ ! -d "$SRC" ]]; then
    echo "ERROR: Source directory does not exist: $SRC"
    exit 1
fi

if [[ ! -d "$DST" ]]; then
    echo "ERROR: Destination directory does not exist: $DST"
    exit 1
fi

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
copied_classes=0
copied_shared=0
copied_charts=0
copied_mocks=0

# ---------------------------------------------------------------------------
# 1. Apex classes (cls + meta.xml)
# ---------------------------------------------------------------------------
echo "=== Copying Apex classes ==="
APEX_FILES=(
    "D3ChartController.cls"
    "D3ChartController.cls-meta.xml"
    "D3ChartControllerTest.cls"
    "D3ChartControllerTest.cls-meta.xml"
)

mkdir -p "$DST_CLASSES"
for f in "${APEX_FILES[@]}"; do
    cp "$SRC_CLASSES/$f" "$DST_CLASSES/$f"
    echo "  $f"
    copied_classes=$((copied_classes + 1))
done

# ---------------------------------------------------------------------------
# 2. Shared LWC modules (all files in each directory)
# ---------------------------------------------------------------------------
echo ""
echo "=== Copying shared LWC modules ==="
SHARED_MODULES=(
    "dataService"
    "chartUtils"
    "themeService"
    "d3Lib"
)

for mod in "${SHARED_MODULES[@]}"; do
    echo "  $mod/"
    mkdir -p "$DST_LWC/$mod"
    rsync -a --delete "$SRC_LWC/$mod/" "$DST_LWC/$mod/"
    copied_shared=$((copied_shared + 1))
done

# ---------------------------------------------------------------------------
# 3. Chart components (all files EXCEPT meta.xml — those need manual merge)
# ---------------------------------------------------------------------------
echo ""
echo "=== Copying chart components (excluding meta.xml) ==="
CHART_COMPONENTS=(
    "d3BarChart"
    "d3DonutChart"
    "d3Treemap"
    "d3Histogram"
    "d3ScatterPlot"
    "d3ForceGraph"
    "d3LineChart"
    "d3Sankey"
    "d3Choropleth"
    "d3Gauge"
    "d3AreaChart"
    "d3BoxPlot"
    "d3BulletChart"
    "d3CalendarHeatmap"
    "d3FunnelChart"
    "d3Heatmap"
    "d3RadarChart"
    "d3SparklineGrid"
    "d3StackedBarChart"
    "d3WaterfallChart"
    "d3HorizontalBarChart"
    "d3PieChart"
    "d3LollipopChart"
    "d3ProgressBar"
    "d3DivergingBarChart"
    "d3WaffleChart"
    "d3SunburstChart"
    "d3BubbleChart"
    "d3ChordDiagram"
    "d3GanttChart"
)

for comp in "${CHART_COMPONENTS[@]}"; do
    echo "  $comp/"
    mkdir -p "$DST_LWC/$comp"
    rsync -a --delete --exclude='*.js-meta.xml' "$SRC_LWC/$comp/" "$DST_LWC/$comp/"
    copied_charts=$((copied_charts + 1))
done

# ---------------------------------------------------------------------------
# 4. __mocks__/ directory (full replace)
# ---------------------------------------------------------------------------
echo ""
echo "=== Copying __mocks__/ ==="
rsync -a --delete "$SRC_MOCKS/" "$DST_MOCKS/"
copied_mocks=1
echo "  __mocks__/ (full replace)"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Sync complete ==="
echo "  Apex classes:      $copied_classes files"
echo "  Shared modules:    $copied_shared directories"
echo "  Chart components:  $copied_charts directories"
echo "  Mocks:             replaced"
echo ""
echo "WARNING: Remember to manually merge jest.config.js moduleNameMapper and meta.xml files"
