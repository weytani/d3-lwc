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
            accounts.add(new Account(
                Name = 'Test Account ' + i,
                Industry = 'Technology'
            ));
        }
        insert accounts;
    }
    
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
    static void testExecuteQuery_EmptyQuery_ThrowsException() {
        // Execute & Verify
        Test.startTest();
        try {
            D3ChartController.executeQuery('');
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('cannot be empty'), 
                'Error should mention empty query');
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
            System.assert(e.getMessage().contains('cannot be empty'), 
                'Error should mention empty query');
        }
        Test.stopTest();
    }
    
    @isTest
    static void testExecuteQuery_NonSelectQuery_ThrowsException() {
        // Execute & Verify
        Test.startTest();
        try {
            D3ChartController.executeQuery('DELETE FROM Account');
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('must start with SELECT'), 
                'Error should mention SELECT requirement');
        }
        Test.stopTest();
    }
    
    @isTest
    static void testExecuteQuery_MalformedQuery_ThrowsException() {
        // Execute & Verify
        Test.startTest();
        try {
            D3ChartController.executeQuery('SELECT FROM InvalidObject__xyz');
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Invalid query'), 
                'Error should mention invalid query');
        }
        Test.stopTest();
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
}
