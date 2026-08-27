/* eslint-disable camelcase */
// src/migrations/014_incident_photo_evidence.js
// Adds photo evidence to E-FIR filings, plus the labels a real, on-device
// TensorFlow.js object-detection pass (COCO-SSD) produced for that photo
// in the tourist's own browser before upload — see
// frontend/tourist/src/lib/incidentVision.ts. Stored as-is (not
// reinterpreted server-side) so the officer sees exactly what the
// tourist's device detected, the same transparency principle the
// Predictive Risk Model's explainability breakdown already follows.

exports.up = (pgm) => {
  pgm.addColumns('incident_reports', {
    photo_url: { type: 'varchar(512)' },
    detected_tags: { type: 'jsonb' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumns('incident_reports', ['photo_url', 'detected_tags'])
}
