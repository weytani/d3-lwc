// ABOUTME: Builds dynamic Salesforce GraphQL (v2) query strings from chart config.
// ABOUTME: Pure functions only — no @wire, no DOM — so they unit-test in isolation.

const OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "in"];

function formatValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // GraphQL string literal; escape embedded quotes.
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

/**
 * Builds a GraphQL `where:` fragment from a structured filter.
 * @param {{field:string, operator:string, value:*}|null} filter
 * @returns {string} `where: { Field: { op: value } }` or "".
 */
export function buildWhere(filter) {
  if (!filter || !filter.field || !filter.operator) return "";
  if (!OPERATORS.includes(filter.operator)) {
    throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
  return `where: { ${filter.field}: { ${filter.operator}: ${formatValue(filter.value)} } }`;
}

/**
 * Builds a raw-record GraphQL query string.
 * @param {{objectApiName:string, fields:string[], filter?:object, orderBy?:string, first?:number}} config
 * @returns {string}
 */
export function buildRecordQuery({
  objectApiName,
  fields,
  filter,
  orderBy,
  first
}) {
  if (!objectApiName) throw new Error("objectApiName is required");
  if (!fields || !fields.length) throw new Error("fields are required");

  const args = [];
  const where = buildWhere(filter);
  if (where) args.push(where);
  if (orderBy) args.push(`orderBy: { ${orderBy}: { order: ASC } }`);
  if (first) args.push(`first: ${first}`);
  const argStr = args.length ? `(${args.join(", ")})` : "";

  const fieldSel = fields.map((f) => `${f} { value }`).join(" ");
  return `query { uiapi { query { ${objectApiName}${argStr} { edges { node { ${fieldSel} } } } } } }`;
}

/**
 * Normalizes a record-query wire result into [{label,start,end}] for the gantt chart.
 * @param {object} data wire `data` ({uiapi:{query:{Object:{edges:[...]}}}})
 * @param {{objectApiName:string, labelField:string, startField:string, endField:string}} cfg
 * @returns {Array<{label:*, start:*, end:*}>}
 */
export function normalizeRecords(
  data,
  { objectApiName, labelField, startField, endField }
) {
  const edges = data?.uiapi?.query?.[objectApiName]?.edges ?? [];
  return edges.map((e) => ({
    label: e.node[labelField]?.value ?? null,
    start: e.node[startField]?.value ?? null,
    end: e.node[endField]?.value ?? null
  }));
}

/** Chart aggregate operation -> GraphQL aggregate function. Count is intentionally
 * excluded in the prototype (see buildAggregateQuery). */
export const AGG_FN = { Sum: "sum", Average: "avg", Min: "min", Max: "max" };

/**
 * Builds a grouped-aggregate GraphQL query string.
 * @param {{objectApiName:string, groupByField:string, valueField:string,
 *          operation:string, filter?:object, first?:number}} config
 * @returns {string}
 */
export function buildAggregateQuery({
  objectApiName,
  groupByField,
  valueField,
  operation,
  filter,
  first = 2000
}) {
  if (!objectApiName || !groupByField || !valueField || !operation) {
    throw new Error(
      "objectApiName, groupByField, valueField, and operation are required"
    );
  }
  const fn = AGG_FN[operation];
  if (!fn) {
    throw new Error(
      `Aggregate operation not supported on the GraphQL path in this prototype: ${operation} (use dataSource="apex")`
    );
  }

  const args = [`groupBy: { ${groupByField}: {} }`];
  const where = buildWhere(filter);
  if (where) args.push(where);
  if (first) args.push(`first: ${first}`);

  return `query { uiapi { query { ${objectApiName}(${args.join(", ")}) { edges { node { ${groupByField} { value } aggregate { ${valueField} { ${fn} { value } } } } } } } } }`;
}

/**
 * Normalizes a grouped-aggregate wire result into [{label,value}] for the bar chart.
 * @param {object} data wire `data`
 * @param {{objectApiName:string, groupByField:string, valueField:string, operation:string}} cfg
 * @returns {Array<{label:*, value:*}>}
 */
export function normalizeAggregate(
  data,
  { objectApiName, groupByField, valueField, operation }
) {
  const fn = AGG_FN[operation];
  const edges = data?.uiapi?.query?.[objectApiName]?.edges ?? [];
  return edges.map((e) => ({
    label: e.node[groupByField]?.value ?? null,
    value: e.node.aggregate?.[valueField]?.[fn]?.value ?? null
  }));
}
