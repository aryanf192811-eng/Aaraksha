'use strict'
const { z } = require('zod')
const { SCAM_CATEGORIES } = require('../constants/enums')

const CreateScamReportSchema = z.object({
  destinationId: z.string().uuid(),
  category:      z.enum(Object.values(SCAM_CATEGORIES)),
  description:   z.string().min(10).max(2000),
  // An untouched HTML date input leaves react-hook-form holding '' (not
  // undefined) — the regex below then rejects the empty string outright,
  // 400ing on the field's own "optional" label. Preprocess '' to undefined
  // first, same fix already applied to CreateTripPage's budgetInr.
  incidentDate: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
  ),
})

module.exports = { CreateScamReportSchema }
