// src/repositories/destination.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class DestinationRepository extends BaseRepository {
  async findAll(filters = {}) {
    const conditions = ['1=1']
    const params = []
    let idx = 1

    if (filters.state) { conditions.push(`d.state = $${idx}`); params.push(filters.state); idx++ }
    if (filters.zoneType) { conditions.push(`d.zone_type = $${idx}`); params.push(filters.zoneType); idx++ }
    if (filters.search) {
      conditions.push(`(d.name ILIKE $${idx} OR d.state ILIKE $${idx})`)
      params.push(`%${filters.search}%`)
      idx++
    }

    return this.query(`
      SELECT d.*,
        wc.condition as weather_condition, wc.risk_level as weather_risk,
        wc.temp_celsius, wc.description as weather_desc,
        wc.risk_reason, wc.fetched_at as weather_updated_at,
        (SELECT COUNT(*)::int FROM scam_reports sr WHERE sr.destination_id=d.id) as scam_count
      FROM destinations d
      LEFT JOIN weather_cache wc ON wc.destination_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.popularity_index DESC`,
      params
    )
  }

  async findById(id) {
    return this.queryOne(`
      SELECT d.*,
        wc.condition as weather_condition, wc.risk_level as weather_risk,
        wc.temp_celsius, wc.humidity_pct, wc.wind_kmh,
        wc.description as weather_desc, wc.risk_reason, wc.tsi_weather_delta,
        wc.fetched_at as weather_updated_at
      FROM destinations d
      LEFT JOIN weather_cache wc ON wc.destination_id = d.id
      WHERE d.id = $1`,
      [id]
    )
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) return []
    return this.query(
      'SELECT * FROM destinations WHERE id = ANY($1::uuid[])', [ids]
    )
  }

  async upsertWeather(destinationId, weatherData) {
    return this.queryOne(`
      INSERT INTO weather_cache
        (destination_id, condition, temp_celsius, humidity_pct, wind_kmh,
         description, risk_level, risk_reason, tsi_weather_delta, fetched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (destination_id) DO UPDATE SET
        condition=$2, temp_celsius=$3, humidity_pct=$4, wind_kmh=$5,
        description=$6, risk_level=$7, risk_reason=$8, tsi_weather_delta=$9,
        fetched_at=NOW()
      RETURNING *`,
      [
        destinationId,
        weatherData.condition, weatherData.tempCelsius,
        weatherData.humidityPct, weatherData.windKmh,
        weatherData.description, weatherData.riskLevel,
        weatherData.riskReason, weatherData.tsiWeatherDelta,
      ]
    )
  }

  async getWeatherCache(destinationId) {
    return this.queryOne('SELECT * FROM weather_cache WHERE destination_id=$1', [destinationId])
  }

  async getWeatherCacheMap(destinationIds) {
    if (!destinationIds || destinationIds.length === 0) return {}
    const rows = await this.query(
      'SELECT * FROM weather_cache WHERE destination_id = ANY($1::uuid[])', [destinationIds]
    )
    return rows.reduce((acc, row) => ({ ...acc, [row.destination_id]: row }), {})
  }

  async isWeatherStale(destinationId, ttlMinutes) {
    const row = await this.queryOne(
      `SELECT (fetched_at < NOW() - ($2 || ' minutes')::interval) as is_stale
       FROM weather_cache WHERE destination_id=$1`,
      [destinationId, ttlMinutes]
    )
    return row?.is_stale !== false  // treat missing as stale
  }
}

module.exports = { DestinationRepository }
