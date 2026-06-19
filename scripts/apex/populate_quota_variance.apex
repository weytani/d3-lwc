// ABOUTME: Populates Quota_Variance__c (signed $ above/below quota) on the Phase 3 demo Opportunities.
// ABOUTME: Biases the per-opp value by LeadSource so summed-by-LeadSource roughly half net positive, half net negative.

// Per-lead-source sign + base magnitude (in dollars). Positive sources net
// clearly above quota; negative sources net clearly below. Per-opp jitter is
// added on top so individual bars vary while the LeadSource SUM keeps its sign.
Map<String, Decimal> sourceBias = new Map<String, Decimal>{
  'Web' => 38000, // +
  'Partner Referral' => 31000, // +
  'Trade Show' => 27000, // +
  'Partner' => 22000, // +
  'Phone Inquiry' => -34000, // -
  'Purchased List' => -41000, // -
  'Other' => -25000 // -
};

List<Opportunity> demo = [
  SELECT Id, Name, LeadSource
  FROM Opportunity
  WHERE LeadSource != NULL AND (Name LIKE '[D3DEMO]%' OR Name LIKE 'Project %')
];

Integer i = 0;
for (Opportunity o : demo) {
  Decimal bias = sourceBias.containsKey(o.LeadSource)
    ? sourceBias.get(o.LeadSource)
    : 0;
  // Deterministic per-opp jitter in roughly -12k..+12k so bars vary but the
  // per-source sum stays on the bias side (|bias| > jitter amplitude).
  Decimal jitter = (Math.mod(i * 4099, 24000)) - 12000;
  o.Quota_Variance__c = (bias + jitter).setScale(0);
  i++;
}

update demo;
System.debug('POPULATED_QUOTA_VARIANCE_COUNT=' + demo.size());

// Echo the grouped result the controller/chart will see.
for (AggregateResult ar : [
  SELECT LeadSource src, SUM(Quota_Variance__c) total
  FROM Opportunity
  WHERE Name LIKE '[D3DEMO]%'
  GROUP BY LeadSource
]) {
  System.debug('GROUP ' + ar.get('src') + ' => ' + ar.get('total'));
}
