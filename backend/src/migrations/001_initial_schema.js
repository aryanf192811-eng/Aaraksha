/* eslint-disable camelcase */
// src/migrations/001_initial_schema.js

exports.up = (pgm) => {
  // Enable UUID generation
  pgm.createExtension('pgcrypto', { ifNotExists: true })

  // ── tourists ──────────────────────────────────────────────────────────
  pgm.createTable('tourists', {
    id:                     { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    full_name:              { type: 'varchar(255)', notNull: true },
    phone:                  { type: 'varchar(20)',  notNull: true, unique: true },
    email:                  { type: 'varchar(255)' },
    blood_group:            { type: 'varchar(5)' },
    medical_info:           { type: 'text' },
    emergency_contacts:     { type: 'jsonb', notNull: true, default: '[]' },
    govt_id_type:           { type: 'varchar(30)', notNull: true },
    govt_id_hash:           { type: 'varchar(64)',  notNull: true, unique: true },
    govt_id_suffix:         { type: 'char(4)',      notNull: true },
    guardian_token:         { type: 'varchar(128)', notNull: true, unique: true },
    guardian_token_expires: { type: 'timestamptz',  notNull: true },
    rescue_readiness_score: { type: 'smallint', notNull: true, default: 0 },
    password_hash:          { type: 'varchar(255)', notNull: true },
    is_active:              { type: 'boolean', notNull: true, default: true },
    profile_photo_url:      { type: 'varchar(512)' },
    created_at:             { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:             { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── trips ─────────────────────────────────────────────────────────────
  pgm.createTable('trips', {
    id:                    { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:            { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    title:                 { type: 'varchar(255)', notNull: true },
    description:           { type: 'text' },
    travel_type:           { type: 'varchar(30)', notNull: true, default: 'SOLO' },
    start_date:            { type: 'date', notNull: true },
    end_date:              { type: 'date', notNull: true },
    status:                { type: 'varchar(30)', notNull: true, default: 'PLANNED' },
    stops:                 { type: 'jsonb', notNull: true, default: '[]' },
    budget_inr:            { type: 'integer' },
    cover_image_url:       { type: 'varchar(512)' },
    packing_checklist:     { type: 'jsonb', notNull: true, default: '[]' },
    trip_notes:            { type: 'text' },
    is_public:             { type: 'boolean', notNull: true, default: false },
    public_token:          { type: 'varchar(128)', unique: true },
    tsi_score:             { type: 'smallint' },
    tsi_label:             { type: 'varchar(30)' },
    tsi_factors:           { type: 'jsonb', default: '{}' },
    tsi_recommendations:   { type: 'jsonb', default: '[]' },
    tsi_updated_at:        { type: 'timestamptz' },
    rescue_readiness:      { type: 'jsonb', default: '{}' },
    rescue_readiness_score:{ type: 'smallint', notNull: true, default: 0 },
    created_at:            { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:            { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── sos_events ────────────────────────────────────────────────────────
  pgm.createTable('sos_events', {
    id:                  { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:          { type: 'uuid', references: '"tourists"', onDelete: 'SET NULL' },
    trip_id:             { type: 'uuid', references: '"trips"',    onDelete: 'SET NULL' },
    latitude:            { type: 'decimal(10,8)', notNull: true },
    longitude:           { type: 'decimal(11,8)', notNull: true },
    location_accuracy_m: { type: 'real' },
    is_stale_location:   { type: 'boolean', notNull: true, default: false },
    category:            { type: 'varchar(50)', notNull: true, default: 'OTHER' },
    message:             { type: 'text' },
    trigger_type:        { type: 'varchar(30)', notNull: true, default: 'MANUAL' },
    status:              { type: 'varchar(30)', notNull: true, default: 'ACTIVE' },
    battery_pct:         { type: 'smallint' },
    contacts_notified:   { type: 'jsonb', notNull: true, default: '[]' },
    resolved_at:         { type: 'timestamptz' },
    resolution_notes:    { type: 'text' },
    created_at:          { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── dead_mans_switches ────────────────────────────────────────────────
  pgm.createTable('dead_mans_switches', {
    id:               { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:       { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    trip_id:          { type: 'uuid', references: '"trips"', onDelete: 'SET NULL' },
    interval_minutes: { type: 'smallint', notNull: true },
    last_reset_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    next_trigger_at:  { type: 'timestamptz', notNull: true },
    warning_sent_at:  { type: 'timestamptz' },
    status:           { type: 'varchar(20)', notNull: true, default: 'ACTIVE' },
    sos_event_id:     { type: 'uuid', references: '"sos_events"', onDelete: 'SET NULL' },
    created_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.addConstraint('dead_mans_switches', 'dms_interval_range',
    'CHECK (interval_minutes BETWEEN 15 AND 480)')

  // ── checkins ──────────────────────────────────────────────────────────
  pgm.createTable('checkins', {
    id:          { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:  { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    trip_id:     { type: 'uuid', references: '"trips"',              onDelete: 'SET NULL' },
    dms_id:      { type: 'uuid', references: '"dead_mans_switches"', onDelete: 'SET NULL' },
    latitude:    { type: 'decimal(10,8)' },
    longitude:   { type: 'decimal(11,8)' },
    battery_pct: { type: 'smallint' },
    message:     { type: 'text' },
    type:        { type: 'varchar(30)', notNull: true, default: 'MANUAL' },
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── tourist_locations (single-row per tourist) ─────────────────────
  pgm.createTable('tourist_locations', {
    tourist_id:  { type: 'uuid', primaryKey: true, references: '"tourists"', onDelete: 'CASCADE' },
    latitude:    { type: 'decimal(10,8)', notNull: true },
    longitude:   { type: 'decimal(11,8)', notNull: true },
    battery_pct: { type: 'smallint' },
    accuracy_m:  { type: 'real' },
    updated_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── govt_users ────────────────────────────────────────────────────────
  pgm.createTable('govt_users', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:          { type: 'varchar(255)', notNull: true },
    email:         { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role:          { type: 'varchar(50)',  notNull: true, default: 'TOURISM_OFFICER' },
    district:      { type: 'varchar(100)' },
    state:         { type: 'varchar(100)' },
    is_active:     { type: 'boolean', notNull: true, default: true },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── rescue_teams ──────────────────────────────────────────────────────
  pgm.createTable('rescue_teams', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:          { type: 'varchar(255)', notNull: true },
    type:          { type: 'varchar(50)',  notNull: true },
    district:      { type: 'varchar(100)', notNull: true },
    state:         { type: 'varchar(100)', notNull: true },
    contact_phone: { type: 'varchar(20)',  notNull: true },
    status:        { type: 'varchar(30)',  notNull: true, default: 'AVAILABLE' },
    latitude:      { type: 'decimal(10,8)' },
    longitude:     { type: 'decimal(11,8)' },
    capacity:      { type: 'integer', notNull: true, default: 10 },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── rescue_assignments ────────────────────────────────────────────────
  pgm.createTable('rescue_assignments', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    sos_event_id:  { type: 'uuid', notNull: true, references: '"sos_events"', onDelete: 'CASCADE' },
    team_id:       { type: 'uuid', notNull: true, references: '"rescue_teams"', onDelete: 'RESTRICT' },
    assigned_by:   { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    status:        { type: 'varchar(30)', notNull: true, default: 'ASSIGNED' },
    notes:         { type: 'text' },
    assigned_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    resolved_at:   { type: 'timestamptz' },
  })

  // ── destinations ──────────────────────────────────────────────────────
  pgm.createTable('destinations', {
    id:                   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:                 { type: 'varchar(255)', notNull: true },
    state:                { type: 'varchar(100)', notNull: true },
    latitude:             { type: 'decimal(10,8)' },
    longitude:            { type: 'decimal(11,8)' },
    connectivity:         { type: 'varchar(20)', notNull: true, default: 'MODERATE' },
    difficulty:           { type: 'varchar(20)', notNull: true, default: 'EASY' },
    altitude_m:           { type: 'integer', notNull: true, default: 0 },
    zone_type:            { type: 'varchar(30)', notNull: true, default: 'SAFE' },
    ilp_required:         { type: 'boolean', notNull: true, default: false },
    nearest_hospital_name:{ type: 'varchar(255)' },
    nearest_hospital_km:  { type: 'decimal(6,2)' },
    nearest_hospital_phone:{ type: 'varchar(20)' },
    nearest_police_km:    { type: 'decimal(6,2)' },
    govt_advisory:        { type: 'text' },
    popularity_index:     { type: 'smallint', notNull: true, default: 50 },
    description:          { type: 'text' },
    best_months:          { type: 'varchar(100)' },
    created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── weather_cache ─────────────────────────────────────────────────────
  pgm.createTable('weather_cache', {
    destination_id:  { type: 'uuid', primaryKey: true, references: '"destinations"', onDelete: 'CASCADE' },
    condition:       { type: 'varchar(50)', notNull: true, default: 'CLEAR' },
    temp_celsius:    { type: 'smallint' },
    humidity_pct:    { type: 'smallint' },
    wind_kmh:        { type: 'smallint' },
    description:     { type: 'text' },
    risk_level:      { type: 'varchar(20)', notNull: true, default: 'LOW' },
    risk_reason:     { type: 'text' },
    tsi_weather_delta: { type: 'smallint', notNull: true, default: 0 },
    fetched_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── scam_reports ──────────────────────────────────────────────────────
  pgm.createTable('scam_reports', {
    id:             { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    destination_id: { type: 'uuid', references: '"destinations"', onDelete: 'SET NULL' },
    tourist_id:     { type: 'uuid', references: '"tourists"',     onDelete: 'SET NULL' },
    category:       { type: 'varchar(50)', notNull: true },
    description:    { type: 'text', notNull: true },
    incident_date:  { type: 'date' },
    verified:       { type: 'boolean', notNull: true, default: false },
    created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── inbound_sos_sms ───────────────────────────────────────────────────
  pgm.createTable('inbound_sos_sms', {
    id:           { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    from_phone:   { type: 'varchar(20)', notNull: true },
    raw_body:     { type: 'text', notNull: true },
    parsed:       { type: 'boolean', notNull: true, default: false },
    parse_error:  { type: 'text' },
    tourist_id:   { type: 'uuid', references: '"tourists"',   onDelete: 'SET NULL' },
    sos_event_id: { type: 'uuid', references: '"sos_events"', onDelete: 'SET NULL' },
    received_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── otp_verifications ─────────────────────────────────────────────────
  pgm.createTable('otp_verifications', {
    id:                   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    phone:                { type: 'varchar(20)', notNull: true },
    otp_hash:             { type: 'varchar(64)', notNull: true },
    purpose:              { type: 'varchar(30)', notNull: true, default: 'PASSWORD_RESET' },
    expires_at:           { type: 'timestamptz', notNull: true },
    used:                 { type: 'boolean', notNull: true, default: false },
    attempts:             { type: 'smallint', notNull: true, default: 0 },
    reset_token:          { type: 'varchar(128)', unique: true },
    reset_token_expires:  { type: 'timestamptz' },
    ip_address:           { type: 'varchar(45)' },
    created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── Indexes ───────────────────────────────────────────────────────────
  pgm.createIndex('trips', 'tourist_id')
  pgm.createIndex('trips', 'status')
  pgm.createIndex('trips', ['tourist_id', 'status'])
  pgm.createIndex('sos_events', 'tourist_id')
  pgm.createIndex('sos_events', 'status')
  pgm.createIndex('sos_events', 'created_at', { order: 'DESC' })
  pgm.createIndex('dead_mans_switches', 'tourist_id')
  pgm.createIndex('dead_mans_switches', 'status')
  pgm.createIndex('dead_mans_switches', 'next_trigger_at',
    { where: "status = 'ACTIVE'" })
  pgm.createIndex('checkins', 'tourist_id')
  pgm.createIndex('checkins', 'trip_id')
  pgm.createIndex('checkins', 'created_at', { order: 'DESC' })
  pgm.createIndex('scam_reports', 'destination_id')
  pgm.createIndex('tourist_locations', 'updated_at', { order: 'DESC' })
  pgm.createIndex('rescue_assignments', 'sos_event_id')
  pgm.createIndex('otp_verifications', 'phone')
  pgm.createIndex('otp_verifications', ['phone', 'purpose', 'used'])
  pgm.createIndex('otp_verifications', 'reset_token', { where: 'reset_token IS NOT NULL' })

  // ── Updated_at trigger ───────────────────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ language 'plpgsql';

    CREATE TRIGGER trg_tourists_updated_at
      BEFORE UPDATE ON tourists
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER trg_trips_updated_at
      BEFORE UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `)
}

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips')
  pgm.sql('DROP TRIGGER IF EXISTS trg_tourists_updated_at ON tourists')
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column()')

  const tables = [
    'otp_verifications', 'inbound_sos_sms', 'scam_reports', 'weather_cache', 'destinations',
    'rescue_assignments', 'rescue_teams', 'govt_users', 'tourist_locations',
    'checkins', 'dead_mans_switches', 'sos_events', 'trips', 'tourists',
  ]
  tables.forEach(t => pgm.dropTable(t, { ifExists: true, cascade: true }))
}
