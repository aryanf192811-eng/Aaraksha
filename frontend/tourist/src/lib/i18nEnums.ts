// src/lib/i18nEnums.ts
// Thin wrapper around t() for the enums.* namespace — falls back to the
// raw backend value (e.g. "HIGH_RISK") instead of i18next's default
// "enums.zoneType.HIGH_RISK" key-echo if a value doesn't have a
// translation yet, since a raw enum string is still more readable to a
// user than a dotted key path.
import type { TFunction } from 'i18next'

type EnumGroup = 'sosCategory' | 'travelType' | 'zoneType' | 'tsiLabel' | 'tripStatus' | 'scamCategory' | 'crowdLevel' | 'feltSafe' | 'activityType' | 'packingCategory' | 'difficulty' | 'connectivity' | 'incidentCategory' | 'incidentStatus' | 'newsSeverity'

export function tEnum(t: TFunction, group: EnumGroup, value: string | null | undefined): string {
  if (!value) return ''
  return t(`enums.${group}.${value}`, { defaultValue: value })
}
