// src/config/upload.js
// Local-disk photo storage for review submissions — no cloud storage
// account configured for this project, so this is the honest, buildable
// option: files live under backend/uploads/, served back via express.static.
'use strict'

const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { v4: uuid } = require('uuid')

const REVIEWS_UPLOAD_DIR = path.join(__dirname, '../../uploads/reviews')
fs.mkdirSync(REVIEWS_UPLOAD_DIR, { recursive: true })

const INCIDENTS_UPLOAD_DIR = path.join(__dirname, '../../uploads/incidents')
fs.mkdirSync(INCIDENTS_UPLOAD_DIR, { recursive: true })

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 4

function diskStorageFor(dir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, `${uuid()}${ext}`)
    },
  })
}

function imageFileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    // Not a MulterError, so errorHandler.js won't auto-catch it by
    // err.name — statusCode makes it fall into the generic
    // "application error with explicit statusCode" branch instead.
    return cb(Object.assign(new Error('Only JPEG, PNG, or WEBP photos are allowed'), { statusCode: 400 }))
  }
  cb(null, true)
}

const uploadReviewPhotos = multer({
  storage: diskStorageFor(REVIEWS_UPLOAD_DIR),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
  fileFilter: imageFileFilter,
}).array('photos', MAX_FILES)

// E-FIR evidence — one photo per filing. The tourist's own device already
// ran an on-device COCO-SSD object-detection pass on it before upload
// (see frontend/tourist/src/lib/incidentVision.ts); this just stores the
// image itself, the detected-tag JSON travels alongside it as a normal
// form field.
const uploadIncidentPhoto = multer({
  storage: diskStorageFor(INCIDENTS_UPLOAD_DIR),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: imageFileFilter,
}).single('photo')

module.exports = { uploadReviewPhotos, uploadIncidentPhoto, REVIEWS_UPLOAD_DIR, INCIDENTS_UPLOAD_DIR }
