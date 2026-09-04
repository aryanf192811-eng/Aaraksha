// backend/scripts/seed_destination_highlights.js
// One-off data-fill for the 031_destination_highlights.js migration --
// documentary-style "what makes this place unique" bullets, researched
// against Wikipedia/UNESCO/Britannica/official state tourism sites (see
// chatbot.md's provenance discipline). Deliberately excludes any fact the
// research pass flagged as unconfirmed/contested (e.g. Majuli's exact
// current area, Kanchenjunga's exact height in meters, Pemayangtse's
// "ta-tshang" ordination detail) rather than guessing a number.
// Run: node scripts/seed_destination_highlights.js
'use strict'
const { Pool } = require('pg')

const HIGHLIGHTS = {
  '612f3c6f-cfda-4f58-bcfb-29f5be490346': [ // Tawang
    "Tawang Monastery — Gaden Namgyal Lhatse — was founded in 1680-81 by Merak Lama Lodre Gyatso at the request of the 5th Dalai Lama, and remains India's largest Buddhist monastery.",
    'The monastery complex sits inside a 925-foot compound wall originally built to house 700 monks.',
    'The 14th Dalai Lama sheltered here briefly in 1959 after fleeing Tibet; Chinese troops occupied the monastery for six months during the 1962 war without desecrating it.',
    'The 6th Dalai Lama, Tsangyang Gyatso, was born near Tawang at Urgelling Monastery.',
    'Tawang sits at roughly 3,000m elevation, about 10 miles from the Line of Actual Control with China.',
  ],
  '8137eee2-0eea-4fc1-a3cc-282f3ccd5985': [ // Ziro Valley
    "The Apatani Cultural Landscape has been on UNESCO's Tentative List for World Heritage status since April 2014.",
    'Unlike neighbouring hill tribes who practise slash-and-burn farming, the Apatani grow wet-rice paddy combined with fish cultivation in the same fields, without using plough animals.',
    'The cultivated valley floor spans about 32 sq km within a 1,058 sq km plateau, at 1,688-2,438m elevation.',
    'Older Apatani women still bear the tribe’s traditional facial tattoos and nose plugs, a practice banned since the 1970s that was originally adopted, per tribal accounts, to protect women from raiders.',
  ],
  'ac413340-6356-434a-a16c-7e0e971a51eb': [ // Jorhat
    'Jorhat became the Ahom kingdom’s capital in 1794, after the seat of power shifted from Rangpur, remaining so until the British takeover following the 1826 Treaty of Yandabo.',
    'Burmese forces occupied the town from 1819 to 1825, before being defeated by British forces under Lt. Col. Alfred Richards.',
    'Jorhat is home to the Tocklai Tea Research Institute, one of the world’s oldest and largest tea research centres.',
    'The Asam Sahitya Sabha, Assam’s leading literary institution, has been headquartered here since 1926, reflecting Jorhat’s status as Assam’s cultural capital.',
  ],
  '4a244c6f-e48d-47e5-8ea7-b93fbec39fba': [ // Kaziranga
    'Kaziranga was inscribed as a UNESCO World Heritage Site in 1985 and covers roughly 1,090 sq km today.',
    'It began as a reserve forest on 1 June 1905, after Mary Curzon — wife of Viceroy Lord Curzon — visited in 1904, failed to see a single rhino, and pressed her husband to act.',
    'The park holds roughly two-thirds of the world’s entire wild population of greater one-horned rhinoceroses.',
    'It also shelters about 57% of the world’s wild water buffalo population and was declared a Tiger Reserve in 2006.',
  ],
  '3f78db55-75af-4232-bcc6-1e1071402840': [ // Majuli Island
    'Guinness World Records recognises Majuli as the world’s largest river island, formed between the Brahmaputra and its Kherkutia Xuti anabranch.',
    'The island has shrunk dramatically from roughly 1,300 sq km in the 1790s, and continues to erode severely today.',
    'Majuli became the centre of Assamese Neo-Vaishnavite culture after the saint Srimanta Sankardeva established monasteries (satras) here in the 15th-16th century; of an original ~65, only about 22 remain active.',
    'Shamaguri Satra is renowned for its tradition of hand-crafted masks used in Bhaona theatrical performances.',
    'Majuli became India’s first river island to be designated a full administrative district, in 2016.',
  ],
  '9dcaae57-e1ec-4a1f-9c55-be6132a2b2ce': [ // Imphal
    "Kangla Fort was the seat of Manipur's Ningthouja dynasty for centuries, its citadel construction dated to the reign of King Khagemba beginning in 1611.",
    'The fort was razed by British forces in 1891 after the Anglo-Manipur War; its ruins, including the paired lion-dragon Kangla Sha sculptures, remain sacred to the Meitei people today.',
    'Ima Keithel ("Mother’s Market") traces to the 16th century, when a forced-conscription system pulled Manipuri men into military service, leaving women to run the region’s trade — a tradition that hardened into today’s rule that only married, divorced, or widowed women may hold a stall.',
    'Around 5,000-6,000 women trade daily at the market, making it the largest all-women-run market in Asia.',
  ],
  '5a1f2a0f-6f43-44c8-8a0d-aa28ffc93fad': [ // Loktak Lake
    'At up to 287 sq km, Loktak is the largest freshwater lake in Northeast India, its surface patched with phumdis — floating mats of soil and vegetation that rise and sink with the seasons.',
    'The lake was designated a Wetland of International Importance under the Ramsar Convention in March 1990.',
    'Keibul Lamjao National Park, on the lake’s southeastern shore, is the world’s only floating national park — its ground is phumdi, not land.',
    'It is the last natural refuge of the Sangai, the Manipur brow-antlered deer, whose population fell to just 14 animals in 1975 before recovering to roughly 260.',
    'About 100,000 people live around the lake in roughly 55 hamlets, many fishing families whose huts sit directly on the floating phumdi mats.',
  ],
  'cff4ea51-4d93-4d41-a3d2-7431dff24b04': [ // Cherrapunji (Sohra)
    'Known by its indigenous Khasi name Sohra, it holds the Guinness World Record for the greatest rainfall in a 12-month period: 26,461mm between August 1860 and July 1861.',
    'Its average annual rainfall is roughly 11,430mm (450 inches), among the highest of any inhabited place on Earth.',
    'The region’s living root bridges are grown by training rubber fig tree roots across streams over 10-15 years; the oldest documented bridge still in use is estimated at over 500 years old.',
    'Sohra sits on the southern edge of the Shillong Plateau, about 53km southwest of Shillong.',
  ],
  'f9a363e4-ee75-42b1-9524-54ee12a86e13': [ // Shillong
    'Shillong sits at 1,495-1,965m on the Shillong Plateau, described as the only major uplifted structural block in the northern Indian shield.',
    'The British made it the capital of undivided Assam in 1874, a status it held for 98 years until Meghalaya became a separate state in 1972.',
    'Its nickname "Scotland of the East" originated with 19th-century British officers, who found its rolling green hills and misty climate reminiscent of the Scottish Highlands.',
    'The city’s name derives from Lei Shyllong, a deity Khasi tradition holds resides on Shillong Peak, the area’s highest point.',
  ],
  '548ae922-bfcc-4681-a996-b5e8730d8842': [ // Aizawl
    'Aizawl was formally established as a British military outpost, Fort Aijal, on 25 February 1890.',
    'Its name derives from Mizo "ai" (a variety of cardamom) and "zawl" (flatland) — "field of cardamom" — even though the city itself sits on a ridge near 1,132m elevation.',
    'The city rose through a sequence of shifting political status — capital of the British Lushai Hills, then Assam’s Mizo District, then the Mizoram Union Territory — before becoming state capital when Mizoram achieved statehood in 1987.',
  ],
  '189b829c-80fa-4500-ba6b-712130083ef9': [ // Champhai
    'Champhai sits at roughly 1,678m in a valley — unusual, since most Mizoram towns perch directly on ridgelines.',
    'Known as the "Rice Bowl of Mizoram," its irrigated paddy terraces trace to 1898, when the British encouraged rice cultivation here to supply colonial soldiers and labourers.',
    'On 1 March 1966, the Mizo National Front’s attack on the Assam Rifles post at Champhai marked the opening move of its armed independence bid, triggering the two-decade Mizo insurgency.',
    'The town connects to Myanmar via the border crossing at Zokhawthar, about 28km away, where a bridge over the Tiau river has long carried cross-border trade.',
  ],
  'ebedf083-68ef-46e1-95be-c4d8571ab630': [ // Dzukou Valley
    'The valley floor sits at roughly 2,438-2,452m and straddles the Nagaland-Manipur boundary.',
    'Its signature bloom, the pink-and-white Dżköu lily (Lilium mackliniae), flowers here only from around May/June into the monsoon.',
    'The most common trekking approach climbs from the Angami villages of Viswema or Zakhama, both within about 25km of Kohima.',
    'The valley’s dwarf bamboo cover makes it fire-prone: major wildfires struck in 2006, over the 2020-21 New Year, and again in January 2026.',
  ],
  '405efd98-60c1-4a4d-98fb-fcc9817da1fc': [ // Longwa Village
    'Longwa sits directly on the India-Myanmar border in Nagaland’s Mon district, ruled by an Angh (hereditary chief) whose authority extends over roughly 60 Konyak villages spanning both countries.',
    'The Angh’s house is literally bisected by the international border — one half sits in India, the other in Myanmar.',
    'The Konyak are Nagaland’s largest tribe and were, within living memory, its most feared headhunters, a practice formally banned by the Indian government in 1960.',
    'A road connects Longwa to Loji village across the border in Myanmar, reflecting how thoroughly the Konyak homeland straddles what is, for its people, a modern-drawn frontier.',
  ],
  'bd5c5968-a348-4323-93c1-30ef06eda4c6': [ // Gangtok
    'Gangtok, at 1,650m elevation, became Sikkim’s capital in 1894 when Chogyal Thutob Namgyal relocated the seat of government from Tumlong.',
    'Kanchenjunga, the world’s third-highest peak, is visible from the city on clear days — the mountain most Sikkimese regard as a sacred guardian deity.',
    'Rumtek Monastery, 24km outside the city, was rebuilt from 1966 by the 16th Karmapa after he fled Chinese-occupied Tibet in 1959, recreating the original Tibetan seat of the Karma Kagyu lineage.',
  ],
  'a0b6acc2-34ae-4ec9-93ce-6fc8434b77f5': [ // Pelling
    'Pemayangtse Monastery began as a small shrine around 1650-51, before being formally re-founded on its present site in 1705 — making it, after Dubdi Monastery, the second-oldest monastery in Sikkim.',
    'It belongs to the Nyingma order, the oldest school of Tibetan Buddhism.',
    'Pelling is one of Sikkim’s principal viewpoints for Kanchenjunga, looking directly across at the peak’s southwest face from the opposite side of the valley from Gangtok.',
  ],
}

async function run(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    let updated = 0
    for (const [id, highlights] of Object.entries(HIGHLIGHTS)) {
      const res = await pool.query('UPDATE destinations SET highlights = $2::jsonb WHERE id = $1', [id, JSON.stringify(highlights)])
      if (res.rowCount > 0) updated++
      else console.warn(`  ! no destination found for id ${id}`)
    }
    console.log(`Updated highlights for ${updated}/${Object.keys(HIGHLIGHTS).length} destinations against ${databaseUrl.split('@')[1]}`)
  } finally {
    await pool.end()
  }
}

require('dotenv').config()
;(async () => {
  await run(process.env.DATABASE_URL)
})()
