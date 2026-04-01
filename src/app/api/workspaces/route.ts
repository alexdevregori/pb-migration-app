import { NextRequest, NextResponse } from 'next/server'
import { ProductboardClient } from '@/lib/productboard/client'
import type { PBEntityConfig, PBReleaseGroup, WorkspaceInfo } from '@/lib/productboard/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchWorkspaceConfig(client: ProductboardClient) {
  const config = await client.request<{ data: PBEntityConfig }>(
    '/v2/entities/configurations/feature'
  )
  const fieldsArray = Object.values(config.data.fields)

  const statusField = fieldsArray.find((f) => f.id === 'status')
  let statuses: { id: string; name: string }[] = []

  if (statusField) {
    if (statusField.values?.data?.length) {
      statuses = statusField.values.data
    } else {
      statuses = await client.paginate<{ id: string; name: string }>(
        '/v2/entities/fields/status/values?assignedEntityType[]=feature'
      )
    }
  }

  const customFields = fieldsArray.filter((f) => UUID_REGEX.test(f.id))
  return { statuses, customFields }
}

export async function GET(request: NextRequest) {
  const sourceKey = request.nextUrl.searchParams.get('sourceKey')
  const destKey = request.nextUrl.searchParams.get('destKey')

  if (!sourceKey || !destKey) {
    return NextResponse.json({ error: 'Missing API keys' }, { status: 400 })
  }

  try {
    const source = new ProductboardClient(sourceKey)
    const dest = new ProductboardClient(destKey)

    // Fetch both workspaces in parallel
    const [
      { statuses, customFields },
      { statuses: destStatuses, customFields: destCustomFields },
      releaseGroups,
    ] = await Promise.all([
      fetchWorkspaceConfig(source),
      fetchWorkspaceConfig(dest),
      source.paginate<PBReleaseGroup>('/v2/entities?type[]=releaseGroup'),
    ])

    const info: WorkspaceInfo = {
      statuses,
      customFields,
      releaseGroups,
      destStatuses,
      destCustomFields,
    }

    return NextResponse.json(info)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
