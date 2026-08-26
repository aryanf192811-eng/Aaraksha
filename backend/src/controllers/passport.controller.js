'use strict'
const passportService = require('../services/passport.service')
const { sendSuccess } = require('../utils/response')
const logger = require('../utils/logger')

const generatePassport = async (req, res, next) => {
  try {
    const pdfStream = await passportService.generate(req.params.tripId, req.tourist.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="journey-passport-${req.params.tripId.slice(0,8)}.pdf"`)
    pdfStream.pipe(res)
    pdfStream.on('error', err => { logger.error({ err: err.message }, 'PDF stream error'); next(err) })
  } catch (err) { next(err) }
}

// Recomputes the same hash chain printed on the PDF, straight from current
// platform records — lets anyone holding a passport confirm the printed
// hash still matches, without re-downloading or re-parsing the whole PDF.
const getIntegrityHash = async (req, res, next) => {
  try {
    const result = await passportService.getIntegrityHash(req.params.tripId, req.tourist.id)
    sendSuccess(res, result)
  } catch (err) { next(err) }
}

module.exports = { generatePassport, getIntegrityHash }
