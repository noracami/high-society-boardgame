import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3001'

describe('E2E Tests', () => {
  it('GET /up - health check', async () => {
    const response = await fetch(`${BASE_URL}/up`)
    const text = await response.text()
    expect(text).toBe('OK')
  })

  it('GET / - frontend returns 200', async () => {
    const response = await fetch(`${BASE_URL}/`)
    expect(response.status).toBe(200)
  })

  it('CSP header contains frame-ancestors', async () => {
    const response = await fetch(`${BASE_URL}/`)
    const csp = response.headers.get('content-security-policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain('frame-ancestors')
  })

  it('X-Frame-Options header is removed', async () => {
    const response = await fetch(`${BASE_URL}/`)
    const xfo = response.headers.get('x-frame-options')
    expect(xfo).toBeNull()
  })

  it('POST /api/token - API is accessible', async () => {
    const response = await fetch(`${BASE_URL}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'test' }),
    })
    // Should return an error status (400, 401, or 500) with a fake code
    expect([400, 401, 500]).toContain(response.status)
  })

  it('GET /some/random/path - SPA fallback', async () => {
    const response = await fetch(`${BASE_URL}/some/random/path`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<div id="app">')
  })
})
