// src/migrations/019_vadodara_rescue_team.js
// A rescue_teams row has no login of its own (see migration 010's header) --
// this just gives govt a real, locally-based official team to assign SOS
// events near Parul University/Vadodara to, for an end-to-end SOS-to-rescue
// demo during the SIH screening. The demo tourist account, the OFFICIAL
// volunteer (rescuer_type='OFFICIAL', linked via team_id, actually able to
// log into the Rescuer app) and the trip are seeded via the real public/govt
// APIs in a follow-up step, not this migration -- those need real
// bcrypt/Verhoeff-valid values the app's own services already know how to
// produce correctly.
'use strict'

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO rescue_teams (name, type, district, state, contact_phone, status, latitude, longitude, capacity)
    SELECT 'Parul University Response Team', 'MEDICAL', 'Vadodara', 'Gujarat', '9099911100', 'AVAILABLE',
      22.29257080, 73.34510910, 4
    WHERE NOT EXISTS (SELECT 1 FROM rescue_teams WHERE name = 'Parul University Response Team');
  `)
}

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM rescue_teams WHERE name = 'Parul University Response Team';`)
}
