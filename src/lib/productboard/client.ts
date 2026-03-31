import type { PBListResponse } from './types'

const BASE_URL = 'https://api.productboard.com'
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ProductboardClient {
  private token: string
  private remainingRequests = 50

  constructor(token: string) {
    this.token = token
  }

  async request<T>(pathOrUrl: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    // Proactive throttle when nearing the rate limit
    if (this.remainingRequests < 5) {
      await sleep(200)
    }

    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })

    // Update rate limit tracking
    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (remaining) {
      this.remainingRequests = parseInt(remaining, 10)
    }

    // Handle rate limiting
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`)
      }
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10)
      await sleep(retryAfter * 1000)
      return this.request<T>(pathOrUrl, options, retryCount + 1)
    }

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`API error ${response.status}: ${body}`)
    }

    return response.json() as Promise<T>
  }

  async paginate<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = []

    let url: string = path
    if (params) {
      const qs = new URLSearchParams(params).toString()
      url = `${path}?${qs}`
    }

    let nextUrl: string | null = null

    do {
      const page: PBListResponse<T> = await this.request<PBListResponse<T>>(nextUrl ?? url)
      results.push(...page.data)
      nextUrl = page.links?.next ?? null
    } while (nextUrl)

    return results
  }
}
