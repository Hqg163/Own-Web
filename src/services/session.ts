import http, { cacheAuthenticatedUser, cachedCapabilities } from './http'

export type SessionUser = Record<string, unknown>
export type SessionCapabilities = { isSiteOwner: boolean; isAdmin: boolean }
export type SessionState = {
  authenticated: boolean
  user: SessionUser | null
  capabilities: SessionCapabilities
}

const emptyCapabilities = (): SessionCapabilities => ({ isSiteOwner: false, isAdmin: false })

export function emptySession(): SessionState {
  return { authenticated: false, user: null, capabilities: emptyCapabilities() }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseCachedUser(): SessionUser | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const value: unknown = JSON.parse(localStorage.getItem('userInfo') || 'null')
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

export function normalizeCapabilities(value: unknown): SessionCapabilities {
  return {
    isSiteOwner: isRecord(value) && value.isSiteOwner === true,
    isAdmin: isRecord(value) && value.isAdmin === true,
  }
}

export function getCachedSession(): SessionState {
  const user = parseCachedUser()
  const authenticated = typeof localStorage !== 'undefined' && localStorage.getItem('isLoggedIn') === 'true' && Boolean(user)
  return {
    authenticated,
    user: authenticated ? user : null,
    capabilities: authenticated && typeof localStorage !== 'undefined' ? normalizeCapabilities(cachedCapabilities()) : emptyCapabilities(),
  }
}

export async function loadSession({ optional = false }: { optional?: boolean } = {}): Promise<SessionState> {
  try {
    const { data } = await http.get('/api/me')
    if (!isRecord(data?.user)) throw new Error('Invalid session response')
    const user = data.user
    const capabilities = normalizeCapabilities(data.capabilities)
    cacheAuthenticatedUser(user, capabilities)
    return { authenticated: true, user, capabilities }
  } catch (error) {
    if (optional) return { authenticated: false, user: null, capabilities: emptyCapabilities() }
    throw error
  }
}
