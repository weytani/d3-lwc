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
            throw new AuraHandledException('Query string cannot be empty');
        }
        
        // Basic SOQL injection prevention
        String sanitized = queryString.trim();
        if (!sanitized.toUpperCase().startsWith('SELECT')) {
            throw new AuraHandledException('Query must start with SELECT');
        }
        
        // Enforce row limit if not specified
        String upperQuery = sanitized.toUpperCase();
        if (!upperQuery.contains(' LIMIT ')) {
            sanitized = sanitized + ' LIMIT ' + MAX_RECORDS;
        }
        
        try {
            // Execute query with record-level security (with sharing)
            List<SObject> results = Database.query(sanitized);
            
            // Enforce field-level security
            SObjectAccessDecision decision = Security.stripInaccessible(
                AccessType.READABLE, 
                results
            );
            
            return decision.getRecords();
        } catch (QueryException e) {
            throw new AuraHandledException('Invalid query: ' + e.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Query execution failed: ' + e.getMessage());
        }
    }
}
