// ABOUTME: Jest test wire adapter for the v2 lightning/graphql module.
// ABOUTME: Pinned sfdx-lwc-jest ships only the v1 uiGraphQLApi stub, so this supplies v2.
import { createTestWireAdapter } from "@salesforce/wire-service-jest-util";

export class graphql extends createTestWireAdapter() {
  static emit(value, filterFn) {
    super.emit({ data: value, errors: undefined }, filterFn);
  }

  static emitErrors(errors, filterFn) {
    super.emit({ data: undefined, errors }, filterFn);
  }

  constructor(dataCallback) {
    super(dataCallback);
    graphql.emit(undefined);
  }
}

// gql is a tagged-template function; reconstruct the interpolated query string so
// tests can assert on it if needed.
export const gql = jest.fn((strings, ...values) => {
  if (!Array.isArray(strings)) return strings;
  return strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? values[i] : ""),
    ""
  );
});

export const refreshGraphQL = jest.fn();
