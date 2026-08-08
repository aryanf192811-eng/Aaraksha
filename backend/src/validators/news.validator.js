// src/validators/news.validator.js
'use strict'

const { z } = require('zod')

const NEWS_CATEGORIES = ['WEATHER', 'ROAD_CLOSURE', 'EVENT', 'ADVISORY', 'FESTIVAL', 'OTHER']
const NEWS_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL']

const PostNewsSchema = z.object({
  category: z.enum(NEWS_CATEGORIES).optional().default('ADVISORY'),
  severity: z.enum(NEWS_SEVERITIES).optional().default('INFO'),
  headline: z.string().min(3).max(255),
  body:     z.string().max(2000).optional(),
  source:   z.string().max(100).optional(),
})

module.exports = { PostNewsSchema, NEWS_CATEGORIES, NEWS_SEVERITIES }
