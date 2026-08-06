// tests/unit/crypto.utils.test.js
import { describe, it, expect } from 'vitest'
import { hashGovtId, generateGuardianToken, generatePublicToken, normalizePhone, extractSuffix } from '../../src/utils/crypto.js'

describe('Crypto Utils', () => {
  it('hashGovtId is deterministic', () => {
    expect(hashGovtId('123456789012')).toBe(hashGovtId('123456789012'))
  })
  it('hashGovtId is 64 hex chars (SHA-256)', () => {
    expect(hashGovtId('123456789012')).toMatch(/^[a-f0-9]{64}$/)
  })
  it('different IDs produce different hashes', () => {
    expect(hashGovtId('123456789012')).not.toBe(hashGovtId('999999999999'))
  })
  it('generateGuardianToken is 128 chars', () => {
    expect(generateGuardianToken().length).toBe(128)
  })
  it('tokens are unique', () => {
    expect(generateGuardianToken()).not.toBe(generateGuardianToken())
  })
  it('normalizePhone strips +91 prefix', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210')
    expect(normalizePhone('09876543210')).toBe('9876543210')
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })
  it('extractSuffix returns last 4 chars uppercase', () => {
    expect(extractSuffix('123456789012')).toBe('9012')
    expect(extractSuffix('ABCDE12345XY')).toBe('45XY')
  })
})
