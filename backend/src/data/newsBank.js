// src/data/newsBank.js
// Curated, destination-specific news/alert templates — the demo-appropriate
// source per product decision (no external news API key), NOT generic
// filler. Each entry is grounded in something real about that place
// (its actual festivals, terrain, road access, climate pattern) so the
// rotation reads as plausible local knowledge, not random text. A cron job
// (see cron/jobs/news.job.js) rotates one of these in per destination on a
// schedule so the feed looks alive across a multi-day judging period
// without literally being random.
'use strict'

const NEWS_BANK = {
  'Dzukou Valley': [
    { category: 'WEATHER', severity: 'WARNING', headline: 'Seasonal fog rolling in above 2000m', body: 'Visibility past the second rest hut has been dropping in the afternoons. Aim to summit before midday.', source: 'IMD Regional' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'No mobile network beyond base camp', body: 'Carry a satellite communicator or agree a return time with your guide before departing base camp.', source: 'Aaraksha Curated' },
    { category: 'EVENT', severity: 'INFO', headline: 'Dzükou lily bloom season approaching', body: 'The valley\'s signature lilies typically bloom late June to early July — a popular window for trekkers.', source: 'Nagaland Tourism' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Guided trek strongly recommended', body: 'Trail markers past the ridge are sparse in low visibility. Register with a local guide before entering.', source: 'Aaraksha Curated' },
    { category: 'WEATHER', severity: 'WARNING', headline: 'Overnight temperatures dropping sharply', body: 'Camping trekkers report near-freezing nights even in the shoulder season — pack proper insulation.', source: 'IMD Regional' },
  ],
  Kaziranga: [
    { category: 'EVENT', severity: 'INFO', headline: 'Kaziranga Elephant Festival — late February', body: 'Expect heavier tourist traffic and elevated safari booking prices during the festival window.', source: 'Assam Tourism Dept' },
    { category: 'ROAD_CLOSURE', severity: 'WARNING', headline: 'Partial lane closure near Kohora range', body: 'Ongoing repair work is restricting one lane between 10am and 4pm daily. Expect delays reaching the park entrance.', source: 'Aaraksha Curated' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Morning safari slots sell out fast in peak season', body: 'Nov–Feb slots are known to sell out by early morning at the counter. Book online a day ahead.', source: 'Aaraksha Curated' },
    { category: 'WEATHER', severity: 'INFO', headline: 'Park reopens after monsoon closure', body: 'Kaziranga National Park typically closes for the monsoon and reopens around November 1st — check before planning a visit outside this window.', source: 'Assam Forest Dept' },
    { category: 'ADVISORY', severity: 'WARNING', headline: 'Rhino sightings reported near the boundary fence', body: 'Forest officials advise keeping a safe distance and staying inside designated safari vehicles at all times.', source: 'Kaziranga Forest Division' },
  ],
  Shillong: [
    { category: 'FESTIVAL', severity: 'INFO', headline: 'Shillong Cherry Blossom Festival this week', body: 'Ward\'s Lake and Police Bazar areas will see road diversions in the evenings. Book accommodation early.', source: 'Meghalaya Tourism' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Evening traffic builds up around Police Bazar', body: 'Local cafes and markets get busy after 5pm — plan extra time if you have an onward journey.', source: 'Aaraksha Curated' },
    { category: 'WEATHER', severity: 'WARNING', headline: 'Afternoon showers typical this season', body: 'Shillong sees short, heavy afternoon downpours for much of the year — carry a light rain layer even on clear mornings.', source: 'IMD Regional' },
    { category: 'EVENT', severity: 'INFO', headline: 'Live music scene active in the cafe district', body: 'Several cafes near Laitumkhrah host live sets on weekends — a good evening addition to a day trip.', source: 'Aaraksha Curated' },
  ],
  'Cherrapunji (Sohra)': [
    { category: 'WEATHER', severity: 'WARNING', headline: 'One of the wettest places on Earth — pack accordingly', body: 'Sohra sees exceptionally heavy monsoon rainfall June–September. Waterproof gear is essential, not optional.', source: 'IMD Regional' },
    { category: 'ADVISORY', severity: 'WARNING', headline: 'Root bridge trail gets slippery fast', body: 'The living root bridge trek near Sohra involves steep, wet stone steps — proper trekking shoes are strongly advised.', source: 'Aaraksha Curated' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Fog can cut visibility with little warning', body: 'Cloud cover rolls in quickly at Nohkalikai viewpoint — best visited early morning for clear views.', source: 'Aaraksha Curated' },
    { category: 'EVENT', severity: 'INFO', headline: 'Best waterfall flow typically post-monsoon', body: 'October–November tends to offer the best balance of full waterfalls and clearer skies.', source: 'Meghalaya Tourism' },
  ],
  Tawang: [
    { category: 'WEATHER', severity: 'CRITICAL', headline: 'Sela Pass closure possible with fresh snowfall', body: 'The Sela Pass route can close on short notice after heavy snow. Confirm road status with BRO before departing Dirang.', source: 'Border Roads Organisation' },
    { category: 'ADVISORY', severity: 'WARNING', headline: 'Altitude sickness commonly reported', body: 'Tawang sits above 3000m — travelers arriving quickly from lower elevations report headaches and fatigue. Acclimatize in Dirang first.', source: 'Aaraksha Curated' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Inner Line Permit required for entry', body: 'Non-residents need a valid ILP to enter Tawang district — arrange this before travel, not on arrival.', source: 'Arunachal Pradesh Govt' },
    { category: 'EVENT', severity: 'INFO', headline: 'Torgya Festival draws visitors to the monastery', body: 'The monastery\'s masked-dance festival typically falls in January and is a striking cultural event to plan around.', source: 'Tawang Monastery' },
    { category: 'WEATHER', severity: 'WARNING', headline: 'Network coverage drops past Dirang', body: 'Signal becomes patchy on the approach road — download offline maps before continuing.', source: 'Aaraksha Curated' },
  ],
  Pelling: [
    { category: 'WEATHER', severity: 'INFO', headline: 'Clearest Kanchenjunga views in early morning', body: 'Cloud cover typically builds through the day — sunrise is the most reliable window for the mountain view.', source: 'Sikkim Tourism' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Winding mountain roads to Rimbi Falls', body: 'The descent to Rimbi waterfalls involves sharp turns — those prone to motion sickness should plan accordingly.', source: 'Aaraksha Curated' },
    { category: 'EVENT', severity: 'INFO', headline: 'Pemayangtse Monastery hosts seasonal Cham dances', body: 'Check the monastery\'s calendar for masked dance performances during your visit window.', source: 'Sikkim Tourism' },
  ],
  'Majuli Island': [
    { category: 'ADVISORY', severity: 'WARNING', headline: 'Plan around the ferry timetable', body: 'Ferry crossings to Majuli run on a limited daily schedule — missing the last one means an unplanned extra night.', source: 'Aaraksha Curated' },
    { category: 'WEATHER', severity: 'WARNING', headline: 'Ferry services affected by monsoon water levels', body: 'High Brahmaputra water levels during monsoon can delay or suspend ferry crossings — check ahead in July–September.', source: 'Assam Inland Water Transport' },
    { category: 'EVENT', severity: 'INFO', headline: 'Raas Mahotsav celebrated across the island\'s Satras', body: 'The island\'s monasteries hold a major raas leela festival, typically in November — a rare cultural window.', source: 'Assam Tourism Dept' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Mask-making workshops open to visitors', body: 'Several Satras welcome visitors to observe traditional Majuli mask-making — check locally for timing.', source: 'Aaraksha Curated' },
  ],
  'Ziro Valley': [
    { category: 'EVENT', severity: 'INFO', headline: 'Ziro Music Festival draws major crowds', body: 'The valley\'s September music festival brings a significant crowd surge — book accommodation months ahead.', source: 'Ziro Festival Committee' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Apatani village visits — ask before photographing', body: 'Local etiquette expects a request before photographing residents, particularly older community members.', source: 'Aaraksha Curated' },
    { category: 'WEATHER', severity: 'INFO', headline: 'Valley stays green through the monsoon', body: 'Ziro\'s paddy fields are at their most scenic July–September, though expect regular rain.', source: 'IMD Regional' },
  ],
  'Loktak Lake': [
    { category: 'ADVISORY', severity: 'INFO', headline: 'Best phumdi views by early boat departure', body: 'The floating phumdi islands and Keibul Lamjao park are best visited on an early morning boat before wind picks up.', source: 'Manipur Tourism' },
    { category: 'WEATHER', severity: 'WARNING', headline: 'Afternoon winds can make boating choppy', body: 'Local boatmen recommend finishing lake excursions before early afternoon as winds build.', source: 'Aaraksha Curated' },
    { category: 'ADVISORY', severity: 'INFO', headline: 'Sangai deer sightings best at dawn', body: 'Keibul Lamjao National Park\'s deer are most active at first light — plan an early start.', source: 'Manipur Forest Dept' },
  ],
  'Longwa Village': [
    { category: 'ADVISORY', severity: 'INFO', headline: 'Village straddles the India-Myanmar border', body: 'The chief\'s house famously sits across both countries — a permit-free but culturally sensitive visit; ask before entering homes.', source: 'Aaraksha Curated' },
    { category: 'WEATHER', severity: 'WARNING', headline: 'Access roads difficult in heavy rain', body: 'The approach to Longwa can become slow-going in monsoon conditions — allow extra travel time.', source: 'Nagaland PWD' },
    { category: 'EVENT', severity: 'INFO', headline: 'Aoleang Festival celebrated by the Konyak community', body: 'A significant Konyak cultural festival typically held in early April — a rare chance to see traditional dress and ritual.', source: 'Nagaland Tourism' },
  ],
}

module.exports = { NEWS_BANK }
