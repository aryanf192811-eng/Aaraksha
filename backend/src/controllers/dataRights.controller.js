// src/controllers/dataRights.controller.js
'use strict'
const dataRightsService = require('../services/dataRights.service')
const { sendSuccess } = require('../utils/response')

const exportMyData = async (req, res, next) => {
  try {
    const data = await dataRightsService.exportMyData(req.tourist.id)
    // A direct file download, not just a JSON body — "export" should feel
    // like a real file the tourist walks away with, same reasoning as
    // every PDF download elsewhere in this codebase.
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="aaraksha-my-data-${req.tourist.id.slice(0, 8)}.json"`)
    res.send(JSON.stringify(data, null, 2))
  } catch (err) { next(err) }
}

const getPrivacyNotice = async (req, res, next) => {
  try { sendSuccess(res, await dataRightsService.getPrivacyNotice()) } catch (err) { next(err) }
}

const requestDeletion = async (req, res, next) => {
  try {
    const result = await dataRightsService.requestDeletion(req.tourist.id)
    sendSuccess(res, result, result.status === 'COMPLETED' ? 'Account deleted' : 'Deletion request recorded')
  } catch (err) { next(err) }
}

const getMyDeletionRequests = async (req, res, next) => {
  try { sendSuccess(res, await dataRightsService.getMyDeletionRequests(req.tourist.id)) } catch (err) { next(err) }
}

module.exports = { exportMyData, getPrivacyNotice, requestDeletion, getMyDeletionRequests }
