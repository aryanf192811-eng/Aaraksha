// src/repositories/sosCluster.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class SOSClusterRepository extends BaseRepository {
  // Candidates for clustering: other ACTIVE/ASSIGNED SOS within the
  // window, distinct tourists (a tourist's own re-triggers are already
  // deduped elsewhere, not a cluster signal). No PostGIS anywhere in this
  // codebase -- distance filtering happens in JS via haversineKm, same as
  // anomaly.service.js's own stop-comparison loop.
  async findRecentActive(sinceIso, excludeSosId) {
    return this.query(
      `SELECT id, tourist_id, category, latitude, longitude, created_at
       FROM sos_events
       WHERE status IN ('ACTIVE','ASSIGNED') AND created_at >= $1 AND id != $2`,
      [sinceIso, excludeSosId]
    )
  }

  // Used to recompute tourist_count/category_diversity accurately when
  // extending an existing cluster with a newly-merged set of ids, rather
  // than trying to combine two partial in-memory views.
  async findSosByIds(ids) {
    return this.query(`SELECT id, tourist_id, category FROM sos_events WHERE id = ANY($1)`, [ids])
  }

  async findOpenNear(centerLat, centerLng, radiusDegrees) {
    // A cheap bounding-box pre-filter in SQL (real distance check still
    // happens in JS) -- this table stays tiny, so a full scan is fine, but
    // no reason not to narrow it first.
    return this.query(
      `SELECT * FROM sos_cluster_flags
       WHERE status IN ('OPEN','INVESTIGATING')
         AND center_latitude BETWEEN $1 AND $2
         AND center_longitude BETWEEN $3 AND $4
       ORDER BY created_at DESC`,
      [centerLat - radiusDegrees, centerLat + radiusDegrees, centerLng - radiusDegrees, centerLng + radiusDegrees]
    )
  }

  async create({ sosEventIds, centerLatitude, centerLongitude, touristCount, categoryDiversity }) {
    return this.queryOne(
      `INSERT INTO sos_cluster_flags (sos_event_ids, center_latitude, center_longitude, tourist_count, category_diversity)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [sosEventIds, centerLatitude, centerLongitude, touristCount, categoryDiversity]
    )
  }

  async extend(id, { sosEventIds, touristCount, categoryDiversity }) {
    return this.queryOne(
      `UPDATE sos_cluster_flags
       SET sos_event_ids = $2, tourist_count = $3, category_diversity = $4
       WHERE id = $1 AND status IN ('OPEN','INVESTIGATING')
       RETURNING *`,
      [id, sosEventIds, touristCount, categoryDiversity]
    )
  }

  async findById(id) {
    return this.queryOne(`SELECT * FROM sos_cluster_flags WHERE id = $1`, [id])
  }

  async findOpen() {
    return this.query(`SELECT * FROM sos_cluster_flags WHERE status IN ('OPEN','INVESTIGATING') ORDER BY created_at DESC`)
  }

  async resolve(id, status, govtUserId, resolutionNotes) {
    return this.queryOne(
      `UPDATE sos_cluster_flags
       SET status = $2, resolved_by = $3, resolution_notes = $4, resolved_at = NOW()
       WHERE id = $1 AND status IN ('OPEN','INVESTIGATING')
       RETURNING *`,
      [id, status, govtUserId, resolutionNotes ?? null]
    )
  }
}

module.exports = { SOSClusterRepository }
