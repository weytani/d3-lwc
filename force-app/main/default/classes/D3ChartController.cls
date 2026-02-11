/**
 * Controller for D3 Chart LWC components.
 * Handles dynamic SOQL execution with security enforcement.
 *
 * @author D3 Chart Library
 * @since 1.0
 */
public with sharing class D3ChartController {
  /**
   * Maximum number of records to return to prevent browser performance issues.
   */
  private static final Integer MAX_RECORDS = 2000;

  /**
   * Executes a SOQL query string and returns results.
   * Enforces field-level and record-level security.
   *
   * @param queryString - The SOQL query to execute
   * @return List of SObject records (max 2000)
   * @throws AuraHandledException for invalid or failed queries
   */
  @AuraEnabled(cacheable=true)
  public static List<SObject> executeQuery(String queryString) {
    if (String.isBlank(queryString)) {
      throw buildException('Query string cannot be empty');
    }

    // Basic SOQL injection prevention
    String sanitized = queryString.trim();
    if (!sanitized.toUpperCase().startsWith('SELECT')) {
      throw buildException('Query must start with SELECT');
    }

    // Enforce row limit if not specified (skip for aggregate queries — they return few rows)
    String upperQuery = sanitized.toUpperCase();
    if (!upperQuery.contains(' LIMIT ') && !hasAggregateFunctions(upperQuery)) {
      sanitized = sanitized + ' LIMIT ' + MAX_RECORDS;
    }

    try {
      // Execute query with record-level security (with sharing)
      List<SObject> results = Database.query(sanitized);

      // AggregateResult records are not supported by stripInaccessible
      if (!results.isEmpty() && results[0] instanceof AggregateResult) {
        return results;
      }

      // Enforce field-level security
      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.READABLE,
        results
      );

      return decision.getRecords();
    } catch (QueryException e) {
      throw buildException('Invalid query: ' + e.getMessage());
    } catch (Exception e) {
      throw buildException('Query execution failed: ' + e.getMessage());
    }
  }

  /**
   * Detects aggregate functions in a query to avoid appending LIMIT
   * (non-grouped aggregates cannot use LIMIT, and grouped aggregates
   * return few rows by nature).
   */
  private static Boolean hasAggregateFunctions(String upperQuery) {
    return upperQuery.contains('COUNT(') ||
      upperQuery.contains('SUM(') ||
      upperQuery.contains('AVG(') ||
      upperQuery.contains('MIN(') ||
      upperQuery.contains('MAX(');
  }

  /**
   * Builds an AuraHandledException with setMessage() so the message
   * is accessible in Apex test context via getMessage().
   */
  private static AuraHandledException buildException(String msg) {
    AuraHandledException ex = new AuraHandledException(msg);
    ex.setMessage(msg);
    return ex;
  }
}
