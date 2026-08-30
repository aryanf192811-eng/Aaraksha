// src/migrations/018_vadodara_seed.js
// Screening round demo data — Parul University, Vadodara, Gujarat, where
// the actual SIH screening happens. Coordinates for "Parul University" are
// the real GPS fix this session's own live device testing repeatedly
// captured (22.29249-22.29278 N, 73.34506-73.36517 E range), not an
// estimate. "Vadodara" uses the city's standard published coordinates as a
// second, broader-radius destination.
//
// A destination alone doesn't make it show up anywhere useful -- also
// backfills one existing demo tourist's active trip to include Parul
// University as a stop, so Dashboard/Latest Alerts/Risk Overview all have
// real, geographically-correct content for that account during the
// screening, rather than only Northeast India entries a Gujarat-based
// judge/tester has no reason to be near.
'use strict'

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO destinations (
      name, state, latitude, longitude, connectivity, difficulty, altitude_m,
      zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
      nearest_police_km, govt_advisory, popularity_index, description, best_months
    )
    SELECT 'Parul University', 'Gujarat', 22.29257080, 73.34510910, 'GOOD', 'EASY', 39,
      'SAFE', false, 'Parul Sevashram Hospital', 1.5,
      2.0, NULL, 60,
      'A large private university campus in Waghodia, Vadodara district -- host of SIH 2025''s screening round. Well-connected, flat terrain, no altitude or connectivity concerns.',
      'Year-round'
    WHERE NOT EXISTS (SELECT 1 FROM destinations WHERE name = 'Parul University');

    INSERT INTO destinations (
      name, state, latitude, longitude, connectivity, difficulty, altitude_m,
      zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
      nearest_police_km, govt_advisory, popularity_index, description, best_months
    )
    SELECT 'Vadodara', 'Gujarat', 22.3072, 73.1812, 'GOOD', 'EASY', 39,
      'SAFE', false, 'SSG Hospital', 3.0,
      2.5, NULL, 70,
      'Gujarat''s cultural capital -- Laxmi Vilas Palace, Sayaji Baug, and a major university town. Well-connected, flat terrain.',
      'October-March'
    WHERE NOT EXISTS (SELECT 1 FROM destinations WHERE name = 'Vadodara');
  `)

  // Give one existing demo tourist an active trip through this destination,
  // so the account judges are likely to log into already shows local
  // content on Dashboard/Risk Overview instead of only Northeast India.
  // Picks whichever demo tourist already has an ACTIVE trip (there's
  // always at least one seeded) rather than hardcoding a specific name,
  // so this stays correct if the seed roster ever changes.
  pgm.sql(`
    DO $$
    DECLARE
      parul_id uuid;
      target_trip_id uuid;
      target_stops jsonb;
    BEGIN
      SELECT id INTO parul_id FROM destinations WHERE name = 'Parul University';

      SELECT id, stops INTO target_trip_id, target_stops
      FROM trips WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;

      IF target_trip_id IS NOT NULL AND parul_id IS NOT NULL THEN
        UPDATE trips SET stops = target_stops || jsonb_build_array(jsonb_build_object(
          'city', 'Parul University', 'state', 'Gujarat', 'destinationId', parul_id::text,
          'lat', 22.29257080, 'lng', 73.34510910, 'days', 1,
          'arrivalDate', NULL, 'departureDate', NULL, 'activities', '[]'::jsonb,
          'notes', 'SIH 2025 screening round', 'connectivity', 'GOOD', 'difficulty', 'EASY',
          'altitude_m', 39, 'zone_type', 'SAFE', 'hospital_km', 1.5, 'eta_minutes', NULL
        ))
        WHERE id = target_trip_id;
      END IF;
    END $$;
  `)
}

exports.down = (pgm) => {
  // Deliberately does not remove the trip-stop backfill (can't cleanly
  // identify which array element was added after other edits) -- the
  // destinations themselves are safe to remove since nothing else
  // references them by a hard foreign key that would block this.
  pgm.sql(`DELETE FROM destinations WHERE name IN ('Parul University', 'Vadodara');`)
}
