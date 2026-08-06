'use strict'
const { z } = require('zod')
const { SCAM_CATEGORIES } = require('../constants/enums')

const CreateScamReportSchema = z.object({
  destinationId: z.string().uuid(),
  category:      z.enum(Object.values(SCAM_CATEGORIES)),
  description:   z.string().min(10).max(2000),
  incidentDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

module.exports = { CreateScamReportSchema }
