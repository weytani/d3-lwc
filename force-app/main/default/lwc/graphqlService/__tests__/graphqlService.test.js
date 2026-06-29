// ABOUTME: Unit tests for the graphqlService query builders and normalizers.
import {
  buildWhere,
  buildRecordQuery,
  normalizeRecords,
  buildAggregateQuery,
  normalizeAggregate,
  AGG_FN
} from "c/graphqlService";

describe("buildWhere", () => {
  it("returns empty string for no filter", () => {
    expect(buildWhere(null)).toBe("");
    expect(buildWhere({})).toBe("");
  });

  it("quotes string values", () => {
    expect(buildWhere({ field: "Stage", operator: "eq", value: "Won" })).toBe(
      'where: { Stage: { eq: "Won" } }'
    );
  });

  it("leaves numeric values unquoted", () => {
    expect(buildWhere({ field: "Amount", operator: "gt", value: 100 })).toBe(
      "where: { Amount: { gt: 100 } }"
    );
  });

  it("throws on an unsupported operator", () => {
    expect(() =>
      buildWhere({ field: "X", operator: "between", value: 1 })
    ).toThrow("Unsupported filter operator: between");
  });
});

describe("buildRecordQuery", () => {
  it("builds a record query with fields, filter, orderBy, and first", () => {
    const q = buildRecordQuery({
      objectApiName: "Project__c",
      fields: ["Name", "Project_Start__c", "Project_End__c"],
      filter: { field: "Status__c", operator: "eq", value: "Active" },
      orderBy: "Project_Start__c",
      first: 500
    });
    expect(q).toContain("Project__c(");
    expect(q).toContain('where: { Status__c: { eq: "Active" } }');
    expect(q).toContain("orderBy: { Project_Start__c: { order: ASC } }");
    expect(q).toContain("first: 500");
    expect(q).toContain("Name { value }");
    expect(q).toContain("edges { node {");
  });

  it("omits the argument list when no filter/orderBy/first given", () => {
    const q = buildRecordQuery({
      objectApiName: "Account",
      fields: ["Name"]
    });
    expect(q).toContain("Account { edges");
    expect(q).not.toContain("(");
  });

  it("throws when objectApiName or fields are missing", () => {
    expect(() => buildRecordQuery({ fields: ["Name"] })).toThrow(
      "objectApiName is required"
    );
    expect(() => buildRecordQuery({ objectApiName: "Account" })).toThrow(
      "fields are required"
    );
  });
});

describe("normalizeRecords", () => {
  it("maps edges to {label,start,end} using ISO string values", () => {
    const data = {
      uiapi: {
        query: {
          Project__c: {
            edges: [
              {
                node: {
                  Name: { value: "Apollo" },
                  Project_Start__c: { value: "2026-01-01" },
                  Project_End__c: { value: "2026-03-01" }
                }
              }
            ]
          }
        }
      }
    };
    expect(
      normalizeRecords(data, {
        objectApiName: "Project__c",
        labelField: "Name",
        startField: "Project_Start__c",
        endField: "Project_End__c"
      })
    ).toEqual([{ label: "Apollo", start: "2026-01-01", end: "2026-03-01" }]);
  });

  it("returns [] when the object node is absent", () => {
    expect(
      normalizeRecords(
        { uiapi: { query: {} } },
        {
          objectApiName: "Project__c",
          labelField: "Name",
          startField: "s",
          endField: "e"
        }
      )
    ).toEqual([]);
  });
});

describe("buildAggregateQuery", () => {
  it("builds a groupBy + sum query", () => {
    const q = buildAggregateQuery({
      objectApiName: "Opportunity",
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Sum",
      first: 2000
    });
    expect(q).toContain("Opportunity(");
    expect(q).toContain("groupBy: { StageName: {} }");
    expect(q).toContain("first: 2000");
    expect(q).toContain("StageName { value }");
    expect(q).toContain("aggregate { Amount { sum { value } } }");
  });

  it("includes a where filter when provided", () => {
    const q = buildAggregateQuery({
      objectApiName: "Opportunity",
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Average",
      filter: { field: "IsClosed", operator: "eq", value: true }
    });
    expect(q).toContain("avg { value }");
    expect(q).toContain("where: { IsClosed: { eq: true } }");
  });

  it("throws for an unsupported operation (e.g. Count)", () => {
    expect(() =>
      buildAggregateQuery({
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count"
      })
    ).toThrow(/Count/);
  });
});

describe("normalizeAggregate", () => {
  it("maps grouped aggregate edges to [{label,value}]", () => {
    const data = {
      uiapi: {
        query: {
          Opportunity: {
            edges: [
              {
                node: {
                  StageName: { value: "Prospecting" },
                  aggregate: { Amount: { sum: { value: 1000 } } }
                }
              },
              {
                node: {
                  StageName: { value: "Closed Won" },
                  aggregate: { Amount: { sum: { value: 5000 } } }
                }
              }
            ]
          }
        }
      }
    };
    expect(
      normalizeAggregate(data, {
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      })
    ).toEqual([
      { label: "Prospecting", value: 1000 },
      { label: "Closed Won", value: 5000 }
    ]);
  });
});

describe("AGG_FN", () => {
  it("maps chart operations to GraphQL aggregate functions", () => {
    expect(AGG_FN).toEqual({
      Sum: "sum",
      Average: "avg",
      Min: "min",
      Max: "max"
    });
  });
});
