import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import {
  getUserScheduleMappings,
  addOrUpdateUserScheduleMapping,
  deleteUserScheduleMapping,
  saveUserScheduleMappings
} from '@/lib/scheduleCorrections'
import { MappingFieldType } from '@/lib/scheduleParser'

const VALID_FIELDS: MappingFieldType[] = [
  'namaMatkul',
  'kodeMatkul',
  'lokasi',
  'hari',
  'kelas',
  'courseByCode'
]

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const mappings = await getUserScheduleMappings(session.userId)
    return NextResponse.json({ mappings })
  } catch (error) {
    console.error('GET /api/jadwal/import/mappings error:', error)
    return NextResponse.json({ error: 'Gagal memuat kamus koreksi jadwal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const rawField = body.field === 'ruangan' ? 'lokasi' : body.field
    const field = rawField as MappingFieldType
    const sourceKey =
      typeof body.sourceKey === 'string'
        ? body.sourceKey.trim()
        : typeof body.rawPattern === 'string'
        ? body.rawPattern.trim()
        : ''
    const targetValue =
      typeof body.targetValue === 'string'
        ? body.targetValue.trim()
        : typeof body.normalizedValue === 'string'
        ? body.normalizedValue.trim()
        : ''
    const id = typeof body.id === 'string' ? body.id.trim() : undefined

    if (!VALID_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Tipe kolom koreksi tidak valid' }, { status: 400 })
    }
    if (!sourceKey || !targetValue) {
      return NextResponse.json({ error: 'Teks OCR asal dan hasil koreksi wajib diisi' }, { status: 400 })
    }
    if (field !== 'courseByCode' && sourceKey.toLowerCase() === targetValue.toLowerCase()) {
      return NextResponse.json({ error: 'Teks asal dan hasil koreksi tidak boleh identik' }, { status: 400 })
    }

    const mappings = await addOrUpdateUserScheduleMapping(session.userId, {
      id,
      field,
      sourceKey,
      targetValue,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined
    })

    return NextResponse.json({
      message: 'Koreksi berhasil disimpan',
      mappings
    })
  } catch (error) {
    console.error('POST /api/jadwal/import/mappings error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan koreksi jadwal' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const clearAll = searchParams.get('all') === 'true'

    if (clearAll) {
      await saveUserScheduleMappings(session.userId, [])
      return NextResponse.json({ message: 'Seluruh kamus koreksi dihapus', mappings: [] })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID koreksi wajib disertakan' }, { status: 400 })
    }

    const mappings = await deleteUserScheduleMapping(session.userId, id)
    return NextResponse.json({
      message: 'Koreksi berhasil dihapus',
      mappings
    })
  } catch (error) {
    console.error('DELETE /api/jadwal/import/mappings error:', error)
    return NextResponse.json({ error: 'Gagal menghapus koreksi jadwal' }, { status: 500 })
  }
}

