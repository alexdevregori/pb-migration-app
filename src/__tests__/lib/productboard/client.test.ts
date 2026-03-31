import { ProductboardClient } from '@/lib/productboard/client'

const BASE_URL = 'https://api.productboard.com'

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': '49',
      'X-RateLimit-Limit': '50',
      ...headers,
    },
  })
}

describe('ProductboardClient', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    jest.useRealTimers()
  })

  describe('request()', () => {
    it('sends Authorization header with Bearer token', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ data: {} }))

      const client = new ProductboardClient('my-token')
      await client.request('/v2/entities')

      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/v2/entities`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      )
    })

    it('retries on 429 and waits Retry-After seconds', async () => {
      jest.useFakeTimers()

      fetchSpy
        .mockResolvedValueOnce(mockResponse('', 429, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(mockResponse({ data: { id: 'abc' } }))

      const client = new ProductboardClient('token')
      const promise = client.request('/v2/entities')

      await jest.runAllTimersAsync()
      const result = await promise

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: { id: 'abc' } })
    })

    it('throws after 3 consecutive 429s', async () => {
      jest.useFakeTimers()

      fetchSpy.mockResolvedValue(mockResponse('', 429, { 'Retry-After': '1' }))

      const client = new ProductboardClient('token')
      const promise = client.request('/v2/entities')

      const assertion = expect(promise).rejects.toThrow('Rate limit exceeded after 3 retries')
      await jest.runAllTimersAsync()
      await assertion
    })

    it('throws on non-429 error responses', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ error: 'Unauthorized' }, 401))

      const client = new ProductboardClient('bad-token')
      await expect(client.request('/v2/entities')).rejects.toThrow('API error 401')
    })
  })

  describe('paginate()', () => {
    it('collects all pages following links.next', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          mockResponse({
            data: [{ id: '1' }, { id: '2' }],
            links: { next: `${BASE_URL}/v2/entities?pageCursor=cursor-2` },
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            data: [{ id: '3' }],
            links: { next: null },
          })
        )

      const client = new ProductboardClient('token')
      const results = await client.paginate('/v2/entities')

      expect(results).toHaveLength(3)
      expect(results.map((r: any) => r.id)).toEqual(['1', '2', '3'])
    })

    it('returns single page when links.next is null', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ data: [{ id: '1' }], links: { next: null } })
      )

      const client = new ProductboardClient('token')
      const results = await client.paginate('/v2/entities')

      expect(results).toHaveLength(1)
    })
  })
})
