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
   * Executes a server-side GROUP BY aggregation and returns label/value pairs.
   * Validates object and field existence via Schema describe, and sanitizes
   * the optional filter clause against injection.
   *
   * @param objectName   - API name of the SObject to query
   * @param groupByField - Field to group results by
   * @param valueField   - Field to aggregate (ignored for Count)
   * @param operation    - One of 'Sum', 'Count', 'Average'
   * @param filterClause - Optional WHERE clause (without the WHERE keyword)
   * @return List of maps with 'label' and 'value' keys
   * @throws AuraHandledException for invalid inputs
   */
  @AuraEnabled(cacheable=true)
  public static List<Map<String, Object>> getAggregatedData(
    String objectName,
    String groupByField,
    String valueField,
    String operation,
    String filterClause
  ) {
    // Validate operation
    Set<String> validOperations = new Set<String>{ 'Sum', 'Count', 'Average' };
    if (String.isBlank(operation) || !validOperations.contains(operation)) {
      throw buildException('Invalid operation: must be Sum, Count, or Average');
    }

    // Validate object exists
    if (String.isBlank(objectName) || !Schema.getGlobalDescribe().containsKey(objectName)) {
      throw buildException('Invalid object: ' + objectName);
    }

    Schema.DescribeSObjectResult objDescribe = Schema.getGlobalDescribe()
      .get(objectName)
      .getDescribe();
    Map<String, Schema.SObjectField> fieldMap = objDescribe.fields.getMap();

    // Validate groupByField exists
    if (String.isBlank(groupByField) || !fieldMap.containsKey(groupByField)) {
      throw buildException('Invalid groupByField: ' + groupByField);
    }

    // Validate valueField exists (required for Sum and Average)
    if (operation != 'Count') {
      if (String.isBlank(valueField) || !fieldMap.containsKey(valueField)) {
        throw buildException('Invalid valueField: ' + valueField);
      }
    }

    // Sanitize filter clause
    String sanitizedFilter = '';
    if (String.isNotBlank(filterClause)) {
      sanitizedFilter = filterClause.replaceAll('[;]', '');
      String upperFilter = sanitizedFilter.toUpperCase();
      List<String> blockedKeywords = new List<String>{
        'INSERT', 'UPDATE', 'DELETE', 'UPSERT', 'MERGE'
      };
      for (String keyword : blockedKeywords) {
        if (upperFilter.contains(keyword)) {
          throw buildException('Filter clause contains forbidden keyword: ' + keyword);
        }
      }
    }

    // Build aggregate expression and query
    String aggregateExpr;
    if (operation == 'Sum') {
      aggregateExpr = 'SUM(' + String.escapeSingleQuotes(valueField) + ')';
    } else if (operation == 'Count') {
      aggregateExpr = 'COUNT(Id)';
    } else {
      aggregateExpr = 'AVG(' + String.escapeSingleQuotes(valueField) + ')';
    }

    String escapedGroupBy = String.escapeSingleQuotes(groupByField);
    String query = 'SELECT ' + escapedGroupBy + ', ' + aggregateExpr + ' val'
      + ' FROM ' + String.escapeSingleQuotes(objectName);

    if (String.isNotBlank(sanitizedFilter)) {
      query += ' WHERE ' + sanitizedFilter;
    }

    query += ' GROUP BY ' + escapedGroupBy
      + ' ORDER BY ' + aggregateExpr + ' DESC'
      + ' LIMIT 200';

    try {
      List<AggregateResult> results = Database.query(query);
      List<Map<String, Object>> output = new List<Map<String, Object>>();

      for (AggregateResult ar : results) {
        Map<String, Object> row = new Map<String, Object>();
        row.put('label', ar.get(groupByField));
        row.put('value', ar.get('val'));
        output.add(row);
      }

      return output;
    } catch (QueryException e) {
      throw buildException('Aggregation query failed: ' + e.getMessage());
    } catch (Exception e) {
      throw buildException('Aggregation failed: ' + e.getMessage());
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

  /**
   * Computes Pearson correlation coefficient and linear regression for two
   * numeric fields from a SOQL query result set.
   *
   * @param queryString - SOQL query that returns records with the target fields
   * @param xField      - API name of the independent variable field
   * @param yField      - API name of the dependent variable field
   * @return Map with keys 'r' (correlation), 'slope', and 'intercept' (nulls if n < 2)
   * @throws AuraHandledException for invalid or failed queries
   */
  @AuraEnabled(cacheable=true)
  public static Map<String, Decimal> getCorrelation(
    String queryString,
    String xField,
    String yField
  ) {
    if (String.isBlank(queryString)) {
      throw buildException('Query string cannot be empty');
    }
    if (String.isBlank(xField) || String.isBlank(yField)) {
      throw buildException('Both xField and yField are required');
    }

    // Basic SOQL injection prevention
    String sanitized = queryString.trim();
    if (!sanitized.toUpperCase().startsWith('SELECT')) {
      throw buildException('Query must start with SELECT');
    }

    // Enforce row limit if not specified (skip for aggregate queries)
    String upperQuery = sanitized.toUpperCase();
    if (!upperQuery.contains(' LIMIT ') && !hasAggregateFunctions(upperQuery)) {
      sanitized = sanitized + ' LIMIT ' + MAX_RECORDS;
    }

    List<SObject> records;
    try {
      records = Database.query(sanitized);

      // Enforce field-level security (skip AggregateResult)
      if (!records.isEmpty() && !(records[0] instanceof AggregateResult)) {
        SObjectAccessDecision decision = Security.stripInaccessible(
          AccessType.READABLE,
          records
        );
        records = decision.getRecords();
      }
    } catch (QueryException e) {
      throw buildException('Invalid query: ' + e.getMessage());
    } catch (Exception e) {
      throw buildException('Query execution failed: ' + e.getMessage());
    }

    // Extract paired numeric values, skipping nulls and non-numerics
    List<Decimal> xValues = new List<Decimal>();
    List<Decimal> yValues = new List<Decimal>();

    for (SObject rec : records) {
      Object xRaw = rec.get(xField);
      Object yRaw = rec.get(yField);

      if (xRaw == null || yRaw == null) {
        continue;
      }
      if (!(xRaw instanceof Decimal) && !(xRaw instanceof Integer) &&
          !(xRaw instanceof Long) && !(xRaw instanceof Double)) {
        continue;
      }
      if (!(yRaw instanceof Decimal) && !(yRaw instanceof Integer) &&
          !(yRaw instanceof Long) && !(yRaw instanceof Double)) {
        continue;
      }

      xValues.add((Decimal) xRaw);
      yValues.add((Decimal) yRaw);
    }

    Map<String, Decimal> result = new Map<String, Decimal>();
    Integer n = xValues.size();

    // Need at least 2 data points for correlation/regression
    if (n < 2) {
      result.put('r', null);
      result.put('slope', null);
      result.put('intercept', null);
      return result;
    }

    // Compute sums for Pearson r and linear regression
    Decimal sumX = 0;
    Decimal sumY = 0;
    Decimal sumXY = 0;
    Decimal sumX2 = 0;
    Decimal sumY2 = 0;

    for (Integer i = 0; i < n; i++) {
      Decimal x = xValues[i];
      Decimal y = yValues[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    // Pearson correlation coefficient
    // r = (n * sumXY - sumX * sumY) / sqrt((n * sumX2 - sumX^2) * (n * sumY2 - sumY^2))
    Decimal numerator = (n * sumXY) - (sumX * sumY);
    Decimal denomA = (n * sumX2) - (sumX * sumX);
    Decimal denomB = (n * sumY2) - (sumY * sumY);
    Decimal denomProduct = denomA * denomB;

    Decimal r = null;
    if (denomProduct > 0) {
      r = numerator / Math.sqrt(denomProduct.doubleValue());
    }
    result.put('r', r);

    // Linear regression: slope and intercept
    Decimal meanX = sumX / n;
    Decimal meanY = sumY / n;
    Decimal slopeDenom = sumX2 - (n * meanX * meanX);

    Decimal slope;
    Decimal intercept;
    if (slopeDenom == 0) {
      slope = 0;
      intercept = meanY;
    } else {
      slope = (sumXY - (n * meanX * meanY)) / slopeDenom;
      intercept = meanY - (slope * meanX);
    }

    result.put('slope', slope);
    result.put('intercept', intercept);

    return result;
  }

  /**
   * Executes a SOQL query and computes descriptive statistics on a numeric field.
   * Returns count, min, max, mean, median, and population standard deviation.
   *
   * @param queryString - The SOQL query to execute
   * @param valueField  - API name of the numeric field to analyze
   * @return Map with keys: count, min, max, mean, median, stdDev
   * @throws AuraHandledException for invalid queries or missing field
   */
  @AuraEnabled(cacheable=true)
  public static Map<String, Decimal> getStatistics(String queryString, String valueField) {
    if (String.isBlank(queryString)) {
      throw buildException('Query string cannot be empty');
    }
    if (String.isBlank(valueField)) {
      throw buildException('Value field cannot be empty');
    }

    // Basic SOQL injection prevention
    String sanitized = queryString.trim();
    if (!sanitized.toUpperCase().startsWith('SELECT')) {
      throw buildException('Query must start with SELECT');
    }

    // Enforce row limit if not specified (skip for aggregate queries)
    String upperQuery = sanitized.toUpperCase();
    if (!upperQuery.contains(' LIMIT ') && !hasAggregateFunctions(upperQuery)) {
      sanitized = sanitized + ' LIMIT ' + MAX_RECORDS;
    }

    try {
      List<SObject> results = Database.query(sanitized);

      // Enforce field-level security (skip AggregateResult)
      if (!results.isEmpty() && !(results[0] instanceof AggregateResult)) {
        SObjectAccessDecision decision = Security.stripInaccessible(
          AccessType.READABLE,
          results
        );
        results = decision.getRecords();
      }

      // Extract numeric values, skipping nulls and non-numeric entries
      List<Decimal> values = new List<Decimal>();
      for (SObject record : results) {
        Object fieldValue = record.get(valueField);
        if (fieldValue == null) {
          continue;
        }
        if (fieldValue instanceof Decimal) {
          values.add((Decimal) fieldValue);
        } else if (fieldValue instanceof Integer) {
          values.add(Decimal.valueOf((Integer) fieldValue));
        } else if (fieldValue instanceof Long) {
          values.add(Decimal.valueOf((Long) fieldValue));
        } else if (fieldValue instanceof Double) {
          values.add(Decimal.valueOf((Double) fieldValue));
        }
      }

      // Edge case: no valid numeric values
      if (values.isEmpty()) {
        return buildEmptyStats();
      }

      values.sort();
      Integer count = values.size();

      Decimal minVal = values[0];
      Decimal maxVal = values[count - 1];

      // Mean
      Decimal sum = 0;
      for (Decimal v : values) {
        sum += v;
      }
      Decimal mean = sum / count;

      // Median
      Decimal median;
      Integer mid = count / 2;
      if (Math.mod(count, 2) == 1) {
        median = values[mid];
      } else {
        median = (values[mid - 1] + values[mid]) / 2;
      }

      // Population standard deviation: sqrt(sum((x - mean)^2) / count)
      Decimal sumSquaredDiffs = 0;
      for (Decimal v : values) {
        Decimal diff = v - mean;
        sumSquaredDiffs += diff * diff;
      }
      Decimal variance = sumSquaredDiffs / count;
      Decimal stdDev = Decimal.valueOf(Math.sqrt(variance.doubleValue()));

      Map<String, Decimal> stats = new Map<String, Decimal>();
      stats.put('count', Decimal.valueOf(count));
      stats.put('min', minVal);
      stats.put('max', maxVal);
      stats.put('mean', mean);
      stats.put('median', median);
      stats.put('stdDev', stdDev);
      return stats;
    } catch (QueryException e) {
      throw buildException('Invalid query: ' + e.getMessage());
    } catch (Exception e) {
      throw buildException('Query execution failed: ' + e.getMessage());
    }
  }

  /**
   * Returns a statistics map with all values set to zero for empty result sets.
   */
  private static Map<String, Decimal> buildEmptyStats() {
    Map<String, Decimal> stats = new Map<String, Decimal>();
    stats.put('count', 0);
    stats.put('min', 0);
    stats.put('max', 0);
    stats.put('mean', 0);
    stats.put('median', 0);
    stats.put('stdDev', 0);
    return stats;
  }
}
