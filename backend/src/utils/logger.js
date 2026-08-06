// src/utils/logger.js
'use strict'

const pino = require('pino')
const config = require('../config/env')

const logger = pino(
  {
    level: config.log.level,
    // Redact sensitive fields from all log lines
    redact: {
      paths: [
        'req.headers.authorization',
        'body.password',
        'body.govtIdNumber',
        '*.password_hash',
        '*.govt_id_hash',
        'err.config.headers.authorization',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: 'aaraksha-backend',
      env: config.nodeEnv,
    },
  },
  config.isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname,service,env',
          singleLine: false,
        },
      })
    : undefined
)

module.exports = logger
