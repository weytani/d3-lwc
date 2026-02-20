// ABOUTME: Test class for D3ChartController Apex controller.
// ABOUTME: Tests SOQL execution, security enforcement, injection prevention, and boundary conditions.

/**
 * Test class for D3ChartController.
 * Tests SOQL execution with various scenarios.
 *
 * @author D3 Chart Library
 * @since 1.0
 */
@isTest
private class D3ChartControllerTest {
  @TestSetup
  static void setup() {
    List<Account> accounts = new List<Account>();

    // Technology accounts (3) with known AnnualRevenue and NumberOfEmployees
    accounts.add(new Account(Name = 'Tech Alpha', Industry = 'Technology', AnnualRevenue = 100, NumberOfEmployees = 10));
    accounts.add(new Account(Name = 'Tech Beta', Industry = 'Technology', AnnualRevenue = 200, NumberOfEmployees = 20));
    accounts.add(new Account(Name = 'Tech Gamma', Industry = 'Technology', AnnualRevenue = 300, NumberOfEmployees = 30));

    // Finance accounts (2)
    accounts.add(new Account(Name = 'Fin Delta', Industry = 'Finance', AnnualRevenue = 400, NumberOfEmployees = 40));
    accounts.add(new Account(Name = 'Fin Epsilon', Industry = 'Finance', AnnualRevenue = 500, NumberOfEmployees = 50));

    insert accounts;
  }

  // ═══════════════════════════════════════════════════════════════
  // VALID QUERY TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_ValidQuery_ReturnsRecords() {
    // Execute
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT Id, Name FROM Account'
    );
    Test.stopTest();

    // Verify
    System.assertEquals(5, result.size(), 'Should return 5 accounts');
  }

  @isTest
  static void testExecuteQuery_WithLimit_RespectsLimit() {
    // Execute
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT Id, Name FROM Account LIMIT 2'
    );
    Test.stopTest();

    // Verify
    System.assertEquals(2, result.size(), 'Should respect LIMIT clause');
  }

  @isTest
  static void testExecuteQuery_WithAggregation_Works() {
    // Execute
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT Industry, COUNT(Id) cnt FROM Account GROUP BY Industry'
    );
    Test.stopTest();

    // Verify - should return aggregated results
    System.assert(result.size() > 0, 'Should return aggregated results');
  }

  // ═══════════════════════════════════════════════════════════════
  // EMPTY / NULL QUERY TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_EmptyQuery_ThrowsException() {
    // Execute & Verify
    Test.startTest();
    try {
      D3ChartController.executeQuery('');
      System.assert(false, 'Should have thrown exception');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('cannot be empty'),
        'Error should mention empty query'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testExecuteQuery_NullQuery_ThrowsException() {
    // Execute & Verify
    Test.startTest();
    try {
      D3ChartController.executeQuery(null);
      System.assert(false, 'Should have thrown exception');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('cannot be empty'),
        'Error should mention empty query'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testExecuteQuery_WhitespaceOnly_ThrowsException() {
    Test.startTest();
    try {
      D3ChartController.executeQuery('   ');
      System.assert(
        false,
        'Should have thrown exception for whitespace-only query'
      );
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('cannot be empty'),
        'Error should mention empty query for whitespace-only input'
      );
    }
    Test.stopTest();
  }

  // ═══════════════════════════════════════════════════════════════
  // SOQL INJECTION PREVENTION TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_NonSelectQuery_ThrowsException() {
    // Execute & Verify
    Test.startTest();
    try {
      D3ChartController.executeQuery('DELETE FROM Account');
      System.assert(false, 'Should have thrown exception');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('must start with SELECT'),
        'Error should mention SELECT requirement'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testExecuteQuery_InsertAttempt_ThrowsException() {
    Test.startTest();
    try {
      D3ChartController.executeQuery(
        'INSERT INTO Account (Name) VALUES (\'Hack\')'
      );
      System.assert(false, 'Should have thrown exception for INSERT');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('must start with SELECT'),
        'Error should reject INSERT queries'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testExecuteQuery_UpdateAttempt_ThrowsException() {
    Test.startTest();
    try {
      D3ChartController.executeQuery('UPDATE Account SET Name = \'Hack\'');
      System.assert(false, 'Should have thrown exception for UPDATE');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('must start with SELECT'),
        'Error should reject UPDATE queries'
      );
    }
    Test.stopTest();
  }

  // ═══════════════════════════════════════════════════════════════
  // CASE INSENSITIVITY TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_LowercaseSelect_Works() {
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'select Id, Name from Account LIMIT 3'
    );
    Test.stopTest();

    System.assert(result.size() <= 3, 'Lowercase SELECT should work');
  }

  @isTest
  static void testExecuteQuery_MixedCaseSelect_Works() {
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SeLeCt Id, Name FROM Account LIMIT 3'
    );
    Test.stopTest();

    System.assert(result.size() <= 3, 'Mixed case SELECT should work');
  }

  // ═══════════════════════════════════════════════════════════════
  // LIMIT ENFORCEMENT TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_NoLimit_AddsDefaultLimit() {
    // Create more accounts to test limit behavior
    List<Account> moreAccounts = new List<Account>();
    for (Integer i = 0; i < 100; i++) {
      moreAccounts.add(new Account(Name = 'Bulk Account ' + i));
    }
    insert moreAccounts;

    // Execute - query without LIMIT should have one added
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT Id, Name FROM Account'
    );
    Test.stopTest();

    // Verify - should return results (with auto-added limit)
    System.assert(result.size() > 0, 'Should return results');
    System.assert(result.size() <= 2000, 'Should respect max records limit');
  }

  @isTest
  static void testExecuteQuery_ExistingLimit_RespectsExistingLimit() {
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT Id, Name FROM Account LIMIT 1'
    );
    Test.stopTest();

    System.assertEquals(1, result.size(), 'Should respect existing LIMIT of 1');
  }

  // ═══════════════════════════════════════════════════════════════
  // MALFORMED QUERY TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_MalformedQuery_ThrowsException() {
    // Execute & Verify
    Test.startTest();
    try {
      D3ChartController.executeQuery('SELECT FROM InvalidObject__xyz');
      System.assert(false, 'Should have thrown exception');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid query'),
        'Error should mention invalid query'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testExecuteQuery_LeadingWhitespace_StillWorks() {
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      '   SELECT Id, Name FROM Account LIMIT 2'
    );
    Test.stopTest();

    System.assertEquals(
      2,
      result.size(),
      'Leading whitespace should be trimmed'
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBQUERY AND EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testExecuteQuery_SubqueryInSelect_Works() {
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT Id, Name, (SELECT Id FROM Contacts) FROM Account LIMIT 5'
    );
    Test.stopTest();

    System.assert(result.size() > 0, 'Subqueries should be supported');
  }

  @isTest
  static void testExecuteQuery_CountQuery_Works() {
    Test.startTest();
    List<SObject> result = D3ChartController.executeQuery(
      'SELECT COUNT(Id) cnt FROM Account'
    );
    Test.stopTest();

    // COUNT queries return AggregateResult
    System.assertEquals(
      1,
      result.size(),
      'COUNT query should return one aggregate result'
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // getAggregatedData TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testGetAggregatedDataSum() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getAggregatedData(
      'Account', 'Industry', 'AnnualRevenue', 'Sum', null
    );
    Test.stopTest();

    System.assert(results.size() > 0, 'Should return aggregated results');

    // Build a lookup by label for verification
    Map<String, Object> byLabel = new Map<String, Object>();
    for (Map<String, Object> row : results) {
      byLabel.put((String) row.get('label'), row.get('value'));
    }

    // Technology: 100 + 200 + 300 = 600
    System.assertEquals(600, (Decimal) byLabel.get('Technology'), 'Technology sum should be 600');
    // Finance: 400 + 500 = 900
    System.assertEquals(900, (Decimal) byLabel.get('Finance'), 'Finance sum should be 900');
  }

  @isTest
  static void testGetAggregatedDataCount() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getAggregatedData(
      'Account', 'Industry', 'AnnualRevenue', 'Count', null
    );
    Test.stopTest();

    Map<String, Object> byLabel = new Map<String, Object>();
    for (Map<String, Object> row : results) {
      byLabel.put((String) row.get('label'), row.get('value'));
    }

    System.assertEquals(3, (Integer) byLabel.get('Technology'), 'Technology count should be 3');
    System.assertEquals(2, (Integer) byLabel.get('Finance'), 'Finance count should be 2');
  }

  @isTest
  static void testGetAggregatedDataAverage() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getAggregatedData(
      'Account', 'Industry', 'AnnualRevenue', 'Average', null
    );
    Test.stopTest();

    Map<String, Object> byLabel = new Map<String, Object>();
    for (Map<String, Object> row : results) {
      byLabel.put((String) row.get('label'), row.get('value'));
    }

    // Technology avg: (100+200+300)/3 = 200
    System.assertEquals(200, (Decimal) byLabel.get('Technology'), 'Technology average should be 200');
    // Finance avg: (400+500)/2 = 450
    System.assertEquals(450, (Decimal) byLabel.get('Finance'), 'Finance average should be 450');
  }

  @isTest
  static void testGetAggregatedDataWithFilter() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getAggregatedData(
      'Account', 'Industry', 'AnnualRevenue', 'Sum', 'Industry = \'Technology\''
    );
    Test.stopTest();

    System.assertEquals(1, results.size(), 'Filter should return only one industry group');
    System.assertEquals('Technology', (String) results[0].get('label'), 'Filtered label should be Technology');
    System.assertEquals(600, (Decimal) results[0].get('value'), 'Filtered sum should be 600');
  }

  @isTest
  static void testGetAggregatedDataInvalidObject() {
    Test.startTest();
    try {
      D3ChartController.getAggregatedData(
        'TotallyFakeObject__xyz', 'Industry', 'AnnualRevenue', 'Sum', null
      );
      System.assert(false, 'Expected exception for invalid object');
    } catch (AuraHandledException e) {
      System.assert(e.getMessage().contains('Invalid object'), 'Error should mention invalid object');
    }
    Test.stopTest();
  }

  @isTest
  static void testGetAggregatedDataInvalidField() {
    Test.startTest();
    try {
      D3ChartController.getAggregatedData(
        'Account', 'NonExistentField__xyz', 'AnnualRevenue', 'Sum', null
      );
      System.assert(false, 'Expected exception for invalid field');
    } catch (AuraHandledException e) {
      System.assert(e.getMessage().contains('Invalid groupByField'), 'Error should mention invalid groupByField');
    }
    Test.stopTest();
  }

  @isTest
  static void testGetAggregatedDataInvalidOperation() {
    Test.startTest();
    try {
      D3ChartController.getAggregatedData(
        'Account', 'Industry', 'AnnualRevenue', 'Invalid', null
      );
      System.assert(false, 'Expected exception for invalid operation');
    } catch (AuraHandledException e) {
      System.assert(e.getMessage().contains('Invalid operation'), 'Error should mention invalid operation');
    }
    Test.stopTest();
  }

  @isTest
  static void testGetAggregatedDataInjectionPrevention() {
    Test.startTest();
    try {
      D3ChartController.getAggregatedData(
        'Account', 'Industry', 'AnnualRevenue', 'Sum', 'DELETE FROM Account'
      );
      System.assert(false, 'Expected exception for injection attempt');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('forbidden keyword'),
        'Error should mention forbidden keyword: ' + e.getMessage()
      );
    }
    Test.stopTest();
  }

  // ═══════════════════════════════════════════════════════════════
  // getStatistics TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testGetStatisticsBasic() {
    // Setup data has AnnualRevenue: 100, 200, 300, 400, 500
    Test.startTest();
    Map<String, Decimal> stats = D3ChartController.getStatistics(
      'SELECT AnnualRevenue FROM Account ORDER BY AnnualRevenue ASC',
      'AnnualRevenue'
    );
    Test.stopTest();

    System.assertEquals(5, stats.get('count'), 'Count should be 5');
    System.assertEquals(100, stats.get('min'), 'Min should be 100');
    System.assertEquals(500, stats.get('max'), 'Max should be 500');
    System.assertEquals(300, stats.get('mean'), 'Mean should be 300');
    System.assertEquals(300, stats.get('median'), 'Median of 5 values should be the middle value (300)');

    // Population stdDev: sqrt(((100-300)^2+(200-300)^2+(300-300)^2+(400-300)^2+(500-300)^2)/5)
    //   = sqrt((40000+10000+0+10000+40000)/5) = sqrt(20000) ≈ 141.42
    Decimal expectedStdDev = Decimal.valueOf(Math.sqrt(20000));
    // Allow small floating-point tolerance
    System.assert(
      Math.abs(stats.get('stdDev') - expectedStdDev) < 0.01,
      'StdDev should be ~141.42, got: ' + stats.get('stdDev')
    );
  }

  @isTest
  static void testGetStatisticsEvenCount() {
    // Query only the 4 non-middle values: 100, 200, 400, 500
    // Median should be (200+400)/2 = 300
    Test.startTest();
    Map<String, Decimal> stats = D3ChartController.getStatistics(
      'SELECT AnnualRevenue FROM Account WHERE AnnualRevenue != 300',
      'AnnualRevenue'
    );
    Test.stopTest();

    System.assertEquals(4, stats.get('count'), 'Count should be 4');
    System.assertEquals(300, stats.get('median'), 'Median of even count should be average of two middle values');
  }

  @isTest
  static void testGetStatisticsSingleRecord() {
    Test.startTest();
    Map<String, Decimal> stats = D3ChartController.getStatistics(
      'SELECT AnnualRevenue FROM Account WHERE AnnualRevenue = 100',
      'AnnualRevenue'
    );
    Test.stopTest();

    System.assertEquals(1, stats.get('count'), 'Count should be 1');
    System.assertEquals(100, stats.get('min'), 'Min should equal the single value');
    System.assertEquals(100, stats.get('max'), 'Max should equal the single value');
    System.assertEquals(100, stats.get('mean'), 'Mean should equal the single value');
    System.assertEquals(100, stats.get('median'), 'Median should equal the single value');
    System.assertEquals(0, stats.get('stdDev'), 'StdDev of single value should be 0');
  }

  @isTest
  static void testGetStatisticsEmptyQuery() {
    Test.startTest();
    Map<String, Decimal> stats = D3ChartController.getStatistics(
      'SELECT AnnualRevenue FROM Account WHERE AnnualRevenue = -99999',
      'AnnualRevenue'
    );
    Test.stopTest();

    System.assertEquals(0, stats.get('count'), 'Count should be 0 for empty results');
    System.assertEquals(0, stats.get('min'), 'Min should be 0 for empty results');
    System.assertEquals(0, stats.get('max'), 'Max should be 0 for empty results');
    System.assertEquals(0, stats.get('mean'), 'Mean should be 0 for empty results');
    System.assertEquals(0, stats.get('median'), 'Median should be 0 for empty results');
    System.assertEquals(0, stats.get('stdDev'), 'StdDev should be 0 for empty results');
  }

  @isTest
  static void testGetStatisticsInvalidQuery() {
    Test.startTest();
    try {
      D3ChartController.getStatistics('INVALID SOQL GARBAGE', 'AnnualRevenue');
      System.assert(false, 'Expected exception for invalid query');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('must start with SELECT'),
        'Error should mention SELECT requirement'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetStatisticsBlankField() {
    Test.startTest();
    try {
      D3ChartController.getStatistics('SELECT AnnualRevenue FROM Account', '');
      System.assert(false, 'Expected exception for blank field');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Value field cannot be empty'),
        'Error should mention empty value field'
      );
    }
    Test.stopTest();
  }

  // ═══════════════════════════════════════════════════════════════
  // getCorrelation TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testGetCorrelationPositive() {
    // Setup data: AnnualRevenue and NumberOfEmployees both increase linearly
    // (100,10), (200,20), (300,30), (400,40), (500,50) → perfect positive correlation
    Test.startTest();
    Map<String, Decimal> result = D3ChartController.getCorrelation(
      'SELECT AnnualRevenue, NumberOfEmployees FROM Account',
      'AnnualRevenue',
      'NumberOfEmployees'
    );
    Test.stopTest();

    System.assert(result.get('r') != null, 'Correlation r should not be null');
    System.assert(result.get('r') > 0.9, 'Should have strong positive correlation, got: ' + result.get('r'));
    System.assert(result.get('slope') > 0, 'Slope should be positive');
  }

  @isTest
  static void testGetCorrelationNearZero() {
    // Delete setup data and create accounts with no correlation pattern
    delete [SELECT Id FROM Account];
    List<Account> accounts = new List<Account>();
    accounts.add(new Account(Name = 'A1', AnnualRevenue = 100, NumberOfEmployees = 50));
    accounts.add(new Account(Name = 'A2', AnnualRevenue = 200, NumberOfEmployees = 10));
    accounts.add(new Account(Name = 'A3', AnnualRevenue = 300, NumberOfEmployees = 40));
    accounts.add(new Account(Name = 'A4', AnnualRevenue = 400, NumberOfEmployees = 20));
    accounts.add(new Account(Name = 'A5', AnnualRevenue = 500, NumberOfEmployees = 30));
    insert accounts;

    Test.startTest();
    Map<String, Decimal> result = D3ChartController.getCorrelation(
      'SELECT AnnualRevenue, NumberOfEmployees FROM Account',
      'AnnualRevenue',
      'NumberOfEmployees'
    );
    Test.stopTest();

    System.assert(result.get('r') != null, 'r should not be null');
    System.assert(
      Math.abs(result.get('r')) < 0.5,
      'Correlation should be weak, got: ' + result.get('r')
    );
  }

  @isTest
  static void testGetCorrelationSingleRecord() {
    Test.startTest();
    Map<String, Decimal> result = D3ChartController.getCorrelation(
      'SELECT AnnualRevenue, NumberOfEmployees FROM Account WHERE Name = \'Tech Alpha\'',
      'AnnualRevenue',
      'NumberOfEmployees'
    );
    Test.stopTest();

    System.assertEquals(null, result.get('r'), 'r should be null for single record');
    System.assertEquals(null, result.get('slope'), 'slope should be null for single record');
    System.assertEquals(null, result.get('intercept'), 'intercept should be null for single record');
  }

  @isTest
  static void testGetCorrelationZeroDenominator() {
    // All same x values → denominator is zero → r should be null
    delete [SELECT Id FROM Account];
    List<Account> accounts = new List<Account>();
    accounts.add(new Account(Name = 'Same1', AnnualRevenue = 100, NumberOfEmployees = 10));
    accounts.add(new Account(Name = 'Same2', AnnualRevenue = 100, NumberOfEmployees = 20));
    accounts.add(new Account(Name = 'Same3', AnnualRevenue = 100, NumberOfEmployees = 30));
    insert accounts;

    Test.startTest();
    Map<String, Decimal> result = D3ChartController.getCorrelation(
      'SELECT AnnualRevenue, NumberOfEmployees FROM Account',
      'AnnualRevenue',
      'NumberOfEmployees'
    );
    Test.stopTest();

    System.assertEquals(null, result.get('r'), 'r should be null when x values are all identical');
    System.assertEquals(0, result.get('slope'), 'slope should be 0 when x values are identical');
  }

  @isTest
  static void testGetCorrelationInvalidFields() {
    Test.startTest();
    try {
      D3ChartController.getCorrelation(
        'SELECT AnnualRevenue FROM Account', '', 'AnnualRevenue'
      );
      System.assert(false, 'Expected exception for blank xField');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('xField and yField are required'),
        'Error should mention required fields'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetCorrelationInvalidQuery() {
    Test.startTest();
    try {
      D3ChartController.getCorrelation('DELETE FROM Account', 'AnnualRevenue', 'NumberOfEmployees');
      System.assert(false, 'Expected exception for non-SELECT query');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('must start with SELECT'),
        'Error should mention SELECT requirement'
      );
    }
    Test.stopTest();
  }
}
