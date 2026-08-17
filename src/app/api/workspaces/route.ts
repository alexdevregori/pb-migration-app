import { NextRequest, NextResponse } from 'next/server'
import { ProductboardClient } from '@/lib/productboard/client'
import type { PBEntityConfig, PBJiraIntegration, PBReleaseGroup, WorkspaceIdentity, WorkspaceInfo } from '@/lib/productboard/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchCurrentUser(client: ProductboardClient): Promise<WorkspaceIdentity | undefined> {
  try {
    const res = await client.request<{ data: { name: string; email: string } }>('/v1/me')
    return { name: res.data.name, email: res.data.email }
  } catch {
    return undefined
  }
}

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
      rawProducts,
      rawJiraIntegrations,
      rawSourceMembers,
      sourceUser,
      destUser,
    ] = await Promise.all([
      fetchWorkspaceConfig(source),
      fetchWorkspaceConfig(dest),
      source.paginate<PBReleaseGroup>('/v2/entities?type[]=releaseGroup'),
      source.paginate<{ id: string; fields: { name: string } }>('/v2/entities?type[]=product&archived=false'),
      source.paginate<PBJiraIntegration>('/v2/jira-integrations').catch(() => [] as PBJiraIntegration[]),
      source.paginate<{ id: string; fields: { email?: string; name?: string } }>('/v2/members').catch(() => []),
      fetchCurrentUser(source),
      fetchCurrentUser(dest),
    ])

    const sourceMembers = rawSourceMembers
      .filter((m) => m.fields?.email)
      .map((m) => ({ email: m.fields.email!, name: m.fields.name ?? m.fields.email! }))

    const info: WorkspaceInfo = {
      statuses,
      products: rawProducts.map((p) => ({ id: p.id, name: String(p.fields.name) })),
      releaseGroups,
      customFields,
      destStatuses,
      destCustomFields,
      sourceMembers,
      jiraIntegrations: rawJiraIntegrations.map((j) => ({
        id: j.id,
        name: j.fields.name,
        status: j.fields.integrationStatus,
      })),
      sourceUser,
      destUser,
    }

    return NextResponse.json(info)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
