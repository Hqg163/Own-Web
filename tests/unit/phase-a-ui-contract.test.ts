import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeCapabilities } from '../../src/services/session'

const readView = (name: string) => readFileSync(new URL(`../../src/components/views/${name}.vue`, import.meta.url), 'utf8')

describe('Phase A identity UI contract', () => {
  it('normalizes only server-provided boolean capabilities', () => {
    expect(normalizeCapabilities({ isSiteOwner: true, isAdmin: false })).toEqual({ isSiteOwner: true, isAdmin: false })
    expect(normalizeCapabilities({ isSiteOwner: 1, isAdmin: 'true' })).toEqual({ isSiteOwner: false, isAdmin: false })
    expect(normalizeCapabilities(null)).toEqual({ isSiteOwner: false, isAdmin: false })
  })

  it('keeps the owner-only entry and CTA server-capability gated', () => {
    const creation = readView('Creation')
    const projects = readView('Projects')
    const settings = readView('Settings')

    expect(creation).toContain('v-if="session.capabilities.isSiteOwner"')
    expect(creation).toContain('AppIcon name="grid"')
    expect(projects).toContain('v-if="session.capabilities.isSiteOwner"')
    expect(projects).toContain('to="/creation/projects"')
    expect(projects).toContain('AppIcon name="plus"')
    expect(settings).toContain('当前身份')
    expect(settings).toContain('session.user?.email')
    expect(settings).toContain('当前未确认登录身份')
  })
})
