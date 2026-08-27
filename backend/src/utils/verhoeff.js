// src/utils/verhoeff.js
// The Verhoeff checksum algorithm — the same public, standard algorithm
// UIDAI uses to generate Aadhaar's 12th (checksum) digit. Validating it
// catches a fat-fingered or made-up 12-digit sequence that happens to
// pass the plain \d{12} regex but is mathematically impossible as a real
// Aadhaar number — genuinely stronger than format-only validation,
// without claiming (falsely) that we checked it against a live UIDAI
// database, which this platform has no production DigiLocker/eKYC
// partner credentials to do. That distinction is deliberate: this is
// local, honest, real math — not a fake "verified" claim.
'use strict'

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

// True if the 12-digit string satisfies the Verhoeff checksum.
function isValidVerhoeff(numString) {
  if (!/^\d+$/.test(numString)) return false
  const digits = numString.split('').reverse().map(Number)
  let c = 0
  for (let i = 0; i < digits.length; i++) {
    c = D[c][P[i % 8][digits[i]]]
  }
  return c === 0
}

module.exports = { isValidVerhoeff }
