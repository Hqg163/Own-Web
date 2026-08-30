import { describe, expect, it } from 'vitest'
import { capabilitiesForUser, normalizedAdminEmails, parseSiteOwnerUserId } from '../../api/lib/identity.js'

describe('site owner and admin capabilities', () => {
  it('parses only positive safe owner ids', () => {
    expect(parseSiteOwnerUserId('42')).toBe(42)
    expect(parseSiteOwnerUserId('0')).toBeNull()
    expect(parseSiteOwnerUserId('not-an-id')).toBeNull()
  })

  it('normalizes administrator emails without coupling them to the site owner', () => {
    expect([...normalizedAdminEmails(' Admin@Example.com, other@example.com ')]).toEqual(['admin@example.com', 'other@example.com'])
    expect(capabilitiesForUser({ id: 42, email: 'Admin@Example.com' }, { ownerId: 7, adminEmails: new Set(['admin@example.com']) })).toEqual({ isSiteOwner: false, isAdmin: true })
    expect(capabilitiesForUser({ id: 42, email: 'admin@example.com' }, { ownerId: 42, adminEmails: new Set(['admin@example.com']) })).toEqual({ isSiteOwner: true, isAdmin: true })
  })
})
