// ABOUTME: Inserts 60 demo Opportunities populated with every field the Phase 3 D3 charts read.
// ABOUTME: Only the first 12 get short "Project X" names + project dates (clean Gantt subset); the rest have NULL project dates.

// Valid org picklist values (verified against AGENT org).
List<String> stages = new List<String>{
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Id. Decision Makers',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost'
};
// Probability roughly tracking each stage (explicitly set so Bubble has a y-axis).
Map<String, Integer> stageProb = new Map<String, Integer>{
  'Prospecting' => 10,
  'Qualification' => 20,
  'Needs Analysis' => 35,
  'Value Proposition' => 50,
  'Id. Decision Makers' => 60,
  'Proposal/Price Quote' => 75,
  'Negotiation/Review' => 90,
  'Closed Won' => 100,
  'Closed Lost' => 0
};
List<String> leadSources = new List<String>{
  'Web',
  'Phone Inquiry',
  'Partner Referral',
  'Purchased List',
  'Other',
  'Partner',
  'Trade Show'
};
// Signed $ above/below quota bias per lead source. Drives Quota_Variance__c so
// that, summed by LeadSource, ~half the sources net clearly POSITIVE and half
// net clearly NEGATIVE — a true two-sided Diverging Bar Chart. Per-opp jitter is
// added on top (|bias| > jitter amplitude) so individual bars vary while the
// per-source sum keeps its sign.
Map<String, Decimal> quotaBias = new Map<String, Decimal>{
  'Web' => 38000,
  'Partner Referral' => 31000,
  'Trade Show' => 27000,
  'Partner' => 22000,
  'Phone Inquiry' => -34000,
  'Purchased List' => -41000,
  'Other' => -25000
};
List<String> types = new List<String>{
  'New Customer',
  'Existing Customer - Upgrade',
  'Existing Customer - Replacement',
  'Existing Customer - Downgrade'
};

// Curated Gantt subset: ONLY the first 12 opps get project dates, and they get
// short, distinct project names so the Gantt renders a clean, readable timeline.
// All other opps are left with NULL project dates, so the Gantt SOQL
// (WHERE Project_Start__c != null AND Project_End__c != null) returns exactly
// these 12 regardless of caching or server/client path. Other charts read
// Amount/Probability/Forecast_Units__c, not project dates, so are unaffected.
List<String> projectNames = new List<String>{
  'Project Alpha',
  'Project Bravo',
  'Project Charlie',
  'Project Delta',
  'Project Echo',
  'Project Foxtrot',
  'Project Golf',
  'Project Hotel',
  'Project India',
  'Project Juliett',
  'Project Kilo',
  'Project Lima'
};
List<Integer> ganttStartOffsets = new List<Integer>{
  0,
  12,
  25,
  38,
  50,
  63,
  75,
  88,
  100,
  112,
  122,
  130
};
List<Integer> ganttDurations = new List<Integer>{
  40,
  55,
  30,
  48,
  60,
  35,
  50,
  45,
  38,
  52,
  42,
  47
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

  // Quota variance: signed $ above/below quota, biased by lead source so the
  // Diverging Bar Chart (grouped by LeadSource, summed) shows a clear two-sided
  // split. Per-opp jitter (-12k..+12k) keeps |sum| on the bias side.
  Decimal qBias = quotaBias.containsKey(src) ? quotaBias.get(src) : 0;
  Decimal qJitter = (Math.mod(i * 4099, 24000)) - 12000;
  Decimal quotaVariance = (qBias + qJitter).setScale(0);

  // Only the first 12 opps get project dates + short Gantt names.
  Boolean isGantt = i < projectNames.size();
  Date pStart = isGantt ? today.addDays(ganttStartOffsets[i]) : null;
  Date pEnd = isGantt ? pStart.addDays(ganttDurations[i]) : null;
  String oppName = isGantt
    ? projectNames[i]
    : '[D3DEMO] ' + typ + ' #' + (i + 1) + ' (' + src + ')';

  Date closeDate = (stage == 'Closed Won' ||
    stage == 'Closed Lost')
    ? today.addDays(-Math.mod(i * 5, 120)) // closed in the past
    : today.addDays(15 + Math.mod(i * 11, 180)); // open in the future

  opps.add(
    new Opportunity(
      Name = oppName,
      StageName = stage,
      Probability = stageProb.get(stage),
      Amount = amount,
      LeadSource = src,
      Type = typ,
      CloseDate = closeDate,
      Project_Start__c = pStart,
      Project_End__c = pEnd,
      Forecast_Units__c = units,
      Quota_Variance__c = quotaVariance
    )
  );
}

insert opps;
System.debug('INSERTED_DEMO_OPP_COUNT=' + opps.size());
for (Integer s = 0; s < 3; s++) {
  Opportunity o = opps[s];
  System.debug(
    'SAMPLE ' +
      o.Name +
      ' | stage=' +
      o.StageName +
      ' | amt=' +
      o.Amount +
      ' | prob=' +
      o.Probability +
      ' | src=' +
      o.LeadSource +
      ' | type=' +
      o.Type +
      ' | start=' +
      o.Project_Start__c +
      ' | end=' +
      o.Project_End__c +
      ' | units=' +
      o.Forecast_Units__c +
      ' | quotaVar=' +
      o.Quota_Variance__c
  );
}

// Echo the Diverging Bar Chart's data: Quota_Variance__c summed by LeadSource.
// Expect a clear mix of positive and negative sums (a true two-sided chart).
for (AggregateResult ar : [
  SELECT LeadSource src, SUM(Quota_Variance__c) total
  FROM Opportunity
  WHERE Name LIKE '[D3DEMO]%'
  GROUP BY LeadSource
]) {
  System.debug('QUOTA_BY_SOURCE ' + ar.get('src') + ' => ' + ar.get('total'));
}
