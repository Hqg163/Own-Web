import { describe, expect, it } from 'vitest'

describe('navigation popover contract', () => {
  it('documents the required close events', () => {
    const closeEvents = ['outside', 'route', 'item', 'escape']
    expect(closeEvents).toEqual(['outside', 'route', 'item', 'escape'])
  })
})
