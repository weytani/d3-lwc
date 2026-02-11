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
    // Create test accounts
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 5; i++) {
      accounts.add(
        new Account(Name = 'Test Account ' + i, Industry = 'Technology')
      );
    }
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
      'SELECT Id, Name FROM Account WHERE Name LIKE \'Test Account%\''
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
}
