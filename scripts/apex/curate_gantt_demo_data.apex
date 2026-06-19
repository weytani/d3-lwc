// ABOUTME: Curates a clean 12-row Gantt subset among the [D3DEMO] Opportunities.
// ABOUTME: Run via: sf apex run -o AGENT -f scripts/apex/curate_gantt_demo_data.apex

// Exactly 12 short, distinct project names (NATO A–L).
List<String> projectNames = new List<String>{
  'Project Alpha', 'Project Bravo', 'Project Charlie', 'Project Delta',
  'Project Echo', 'Project Foxtrot', 'Project Golf', 'Project Hotel',
  'Project India', 'Project Juliett', 'Project Kilo', 'Project Lima'
};

// Staggered start offsets (days from today) and durations (days), spread
// across ~4 months so the bars read as a clean timeline.
List<Integer> startOffsets = new List<Integer>{
  0, 12, 25, 38, 50, 63, 75, 88, 100, 112, 122, 130
};
List<Integer> durations = new List<Integer>{
  40, 55, 30, 48, 60, 35, 50, 45, 38, 52, 42, 47
};

Date today = Date.today();

// Pull all demo opps deterministically (stable order so reruns are idempotent).
List<Opportunity> demoOpps = [
  SELECT Id, Name, Project_Start__c, Project_End__c
  FROM Opportunity
  WHERE Name LIKE '[D3DEMO]%'
  ORDER BY CreatedDate, Id
];

System.debug('TOTAL_D3DEMO_OPPS=' + demoOpps.size());

List<Opportunity> toUpdate = new List<Opportunity>();
Integer ganttCount = 0;

for (Integer i = 0; i < demoOpps.size(); i++) {
  Opportunity o = demoOpps[i];
  if (i < projectNames.size()) {
    // The chosen ~12 become the Gantt rows: short name + sensible dates.
    Date pStart = today.addDays(startOffsets[i]);
    Date pEnd = pStart.addDays(durations[i]); // end always after start
    o.Name = projectNames[i];
    o.Project_Start__c = pStart;
    o.Project_End__c = pEnd;
    ganttCount++;
  } else {
    // Everyone else: clear BOTH project dates so the Gantt SOQL
    // (WHERE Project_Start__c != null AND Project_End__c != null) excludes them
    // regardless of any caching or server/client path. Other charts read
    // Amount/Probability/Forecast_Units__c, not project dates, so are unaffected.
    o.Project_Start__c = null;
    o.Project_End__c = null;
  }
  toUpdate.add(o);
}

update toUpdate;

System.debug('GANTT_ROWS_WITH_DATES=' + ganttCount);
System.debug('OPPS_DATES_CLEARED=' + (demoOpps.size() - ganttCount));

// Echo the curated Gantt rows for verification.
for (Opportunity o : [
  SELECT Name, Project_Start__c, Project_End__c
  FROM Opportunity
  WHERE Name LIKE 'Project %' AND Project_Start__c != null AND Project_End__c != null
  ORDER BY Project_Start__c
]) {
  System.debug('GANTT_ROW ' + o.Name + ' | start=' + o.Project_Start__c + ' | end=' + o.Project_End__c);
}
