// src/validators/packing.validator.js
'use strict'

const { z } = require('zod')

const GeneratePackingSchema = z.object({
  tripId: z.string().uuid(),
})

module.exports = { GeneratePackingSchema }
