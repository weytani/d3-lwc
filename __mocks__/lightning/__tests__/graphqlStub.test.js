// ABOUTME: Verifies the lightning/graphql test stub resolves and emits.
import { gql } from "lightning/graphql";

describe("lightning/graphql stub", () => {
  it("reconstructs an interpolated gql query string", () => {
    const objectName = "Opportunity";
    const result = gql`query { uiapi { query { ${objectName} { x } } } }`;
    expect(result).toContain("Opportunity");
  });
});
