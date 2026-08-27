// src/constants/legalReference.js
// Maps each E-FIR category to the applicable Bharatiya Nyaya Sanhita
// (BNS), 2023 section — India's penal code (replaced the IPC on 1 July
// 2024) — so a filed E-FIR reads as aligned with the terminology a real
// police station / CCTNS (Crime and Criminal Tracking Network & Systems)
// record would use, not a generic bug-tracker-style category label.
//
// Deliberately advisory, not authoritative: this is reference guidance for
// the officer triaging the case, not an automated legal determination —
// final section classification is always the investigating officer's own
// judgment. See INCIDENT_CATEGORIES in enums.js for the category list this
// maps from.
'use strict'

const LEGAL_REFERENCE = Object.freeze({
  THEFT: {
    act: 'Bharatiya Nyaya Sanhita, 2023',
    section: 'Section 303 — Theft',
    note: 'Section 305 applies instead if committed in a dwelling, or the value/circumstances qualify as theft in specific aggravating conditions.',
  },
  HARASSMENT: {
    act: 'Bharatiya Nyaya Sanhita, 2023',
    section: 'Section 74 / Section 78',
    note: 'Section 74 (assault/criminal force with intent to outrage modesty) or Section 78 (stalking), depending on the specific conduct described.',
  },
  ASSAULT: {
    act: 'Bharatiya Nyaya Sanhita, 2023',
    section: 'Section 115 — Voluntarily causing hurt',
    note: 'Section 117 applies instead if grievous hurt is involved.',
  },
  FRAUD: {
    act: 'Bharatiya Nyaya Sanhita, 2023',
    section: 'Section 318 — Cheating',
    note: 'Section 319 applies instead if cheating by personation is involved.',
  },
  LOST_DOCUMENT: {
    act: 'Administrative report',
    section: 'Not a cognizable offence',
    note: 'For a lost passport specifically, also file under the Passport Act, 1967 for reissuance — this E-FIR serves as the loss report.',
  },
  VEHICLE_ACCIDENT: {
    act: 'Motor Vehicles Act, 1988',
    section: 'Section 134 (duty on accident) · BNS Section 106 if death/hurt by negligence',
    note: 'Exact section depends on injury severity and fault determination.',
  },
  PROPERTY_DAMAGE: {
    act: 'Bharatiya Nyaya Sanhita, 2023',
    section: 'Section 324 — Mischief',
    note: 'Section 325/326 applies instead for aggravated mischief (fire, explosives, or higher-value loss).',
  },
  OTHER: {
    act: null,
    section: 'To be determined by investigating officer',
    note: 'Category too general for an automatic reference — the assigned officer classifies this once the case is reviewed.',
  },
})

module.exports = { LEGAL_REFERENCE }
