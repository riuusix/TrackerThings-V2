import { prisma } from './prisma'
import {
  UserScheduleMapping,
  MappingFieldType,
  upsertUserMapping,
  removeUserMapping
} from './scheduleParser'

const MAX_MAPPINGS_PER_USER = 100

export function getUserMappingSettingKey(userId: number): string {
  return `schedule_mappings_user_${userId}`
}

export async function getUserScheduleMappings(userId: number): Promise<UserScheduleMapping[]> {
  if (!userId || userId <= 0) return []
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { settingKey: getUserMappingSettingKey(userId) }
    })
    if (!record?.settingValue) return []
    const parsed = JSON.parse(record.settingValue)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m: any) =>
        m &&
        typeof m.id === 'string' &&
        typeof m.field === 'string' &&
        typeof m.sourceKey === 'string' &&
        typeof m.targetValue === 'string'
    )
  } catch (err) {
    console.warn('[ScheduleCorrections] Failed to load user schedule mappings:', err)
    return []
  }
}

export async function saveUserScheduleMappings(
  userId: number,
  mappings: UserScheduleMapping[]
): Promise<UserScheduleMapping[]> {
  if (!userId || userId <= 0) return []
  const trimmed = mappings.slice(0, MAX_MAPPINGS_PER_USER)
  try {
    const key = getUserMappingSettingKey(userId)
    await prisma.systemSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: JSON.stringify(trimmed) },
      create: { settingKey: key, settingValue: JSON.stringify(trimmed) }
    })
  } catch (err) {
    console.warn('[ScheduleCorrections] Failed to save user schedule mappings:', err)
  }
  return trimmed
}

export async function addOrUpdateUserScheduleMapping(
  userId: number,
  input: {
    id?: string
    field: MappingFieldType
    sourceKey: string
    targetValue: string
    metadata?: UserScheduleMapping['metadata']
  }
): Promise<UserScheduleMapping[]> {
  const existing = await getUserScheduleMappings(userId)
  const updated = upsertUserMapping(existing, {
    id: input.id,
    field: input.field,
    sourceKey: input.sourceKey,
    targetValue: input.targetValue,
    metadata: input.metadata
  })
  return saveUserScheduleMappings(userId, updated)
}

export async function deleteUserScheduleMapping(
  userId: number,
  mappingId: string
): Promise<UserScheduleMapping[]> {
  const existing = await getUserScheduleMappings(userId)
  const updated = removeUserMapping(existing, mappingId)
  return saveUserScheduleMappings(userId, updated)
}

