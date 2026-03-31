import { NextRequest, NextResponse } from 'next/server'
import { ProductboardClient } from '@/lib/productboard/client'
import type { PBEntityConfig, PBReleaseGroup, WorkspaceInfo } from '@/lib/productboard/types'

export async function GET(request: NextRequest) {
  const sourceKey = request.nextUrl.searchParams.get('sourceKey')
  const destKey = request.nextUrl.searchParams.get('destKey')

  if (!sourceKey || !destKey) {
    return NextResponse.json({ error: 'Missing API keys' }, { status: 400 })
  }

  try {
    const source = new ProductboardClient(sourceKey)

    // Validate source key and fetch feature configuration
    const featureConfig = await source.request<{ data: PBEntityConfig }>(
      '/v2/entities/configurations/feature'
    )

    // Extract status field from feature config
    const statusField = featureConfig.data.fields.find((f) => f.id === 'status')
    let statuses: { id: string; name: string }[] = []

    if (statusField) {
      const statusValues = await source.paginate<{ id: string; name: string }>(
        `/v2/entities/fields/${statusField.id}/values`
      )
      statuses = statusValues
    }

    // Fetch all release groups from source
    const releaseGroups = await source.paginate<PBReleaseGroup>(
      '/v2/entities?type[]=releaseGroup'
    )

    // Extract custom fields (non-standard fields, identified by UUID pattern)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const customFields = featureConfig.data.fields.filter((f) => UUID_REGEX.test(f.id))

    // Validate destination key with a lightweight call
    const dest = new ProductboardClient(destKey)
    await dest.request('/v2/entities/configurations/feature')

    const info: WorkspaceInfo = {
      statuses,
      releaseGroups,
      customFields,
    }

    return NextResponse.json(info)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
