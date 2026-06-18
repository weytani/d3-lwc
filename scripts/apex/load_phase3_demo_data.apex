// ABOUTME: Inserts ~60 demo Opportunities populated with every field the Phase 3 D3 charts read.
// ABOUTME: Run via: sf apex run -o AGENT -f scripts/apex/load_phase3_demo_data.apex (leaves existing opps untouched).

// Valid org picklist values (verified against AGENT org).
List<String> stages = new List<String>{
  'Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition',
  'Id. Decision Makers', 'Proposal/Price Quote', 'Negotiation/Review',
  'Closed Won', 'Closed Lost'
};
// Probability roughly tracking each stage (explicitly set so Bubble has a y-axis).
Map<String, Integer> stageProb = new Map<String, Integer>{
  'Prospecting' => 10, 'Qualification' => 20, 'Needs Analysis' => 35,
  'Value Proposition' => 50, 'Id. Decision Makers' => 60,
  'Proposal/Price Quote' => 75, 'Negotiation/Review' => 90,
  'Closed Won' => 100, 'Closed Lost' => 0
};
List<String> leadSources = new List<String>{
  'Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List',
  'Other', 'Partner', 'Trade Show'
};
List<String> types = new List<String>{
  'New Customer', 'Existing Customer - Upgrade',
  'Existing Customer - Replacement', 'Existing Customer - Downgrade'
};

Date today = Date.today();
List<Opportunity> opps = new List<Opportunity>();

for (Integer i = 0; i < 60; i++) {
  String stage = stages[Math.mod(i, stages.size())];
  String src = leadSources[Math.mod(i * 3 + 1, leadSources.size())];
  String typ = types[Math.mod(i * 2, types.size())];

  // Varied, realistic amounts ($8k – $620k) with some spread per stage.
  Decimal amount = 8000 + Math.mod(i * 8311, 600000) + (i * 250);

  // Forecast units: positive integers, varied (12 – ~5000).
  Integer units = 12 + Math.mod(i * 137, 5000);

  // Project window: start spread over the next ~5 months, end strictly after start.
  Date pStart = today.addDays(Math.mod(i * 9, 150));
  Date pEnd = pStart.addDays(20 + Math.mod(i * 7, 90)); // end always > start

  Date closeDate = (stage == 'Closed Won' || stage == 'Closed Lost')
    ? today.addDays(-Math.mod(i * 5, 120))   // closed in the past
    : today.addDays(15 + Math.mod(i * 11, 180)); // open in the future

  opps.add(new Opportunity(
    Name = '[D3DEMO] ' + typ + ' #' + (i + 1) + ' (' + src + ')',
    StageName = stage,
    Probability = stageProb.get(stage),
    Amount = amount,
    LeadSource = src,
    Type = typ,
    CloseDate = closeDate,
    Project_Start__c = pStart,
    Project_End__c = pEnd,
    Forecast_Units__c = units
  ));
}

insert opps;
System.debug('INSERTED_DEMO_OPP_COUNT=' + opps.size());
for (Integer s = 0; s < 3; s++) {
  Opportunity o = opps[s];
  System.debug('SAMPLE ' + o.Name + ' | stage=' + o.StageName + ' | amt=' + o.Amount
    + ' | prob=' + o.Probability + ' | src=' + o.LeadSource + ' | type=' + o.Type
    + ' | start=' + o.Project_Start__c + ' | end=' + o.Project_End__c
    + ' | units=' + o.Forecast_Units__c);
}
