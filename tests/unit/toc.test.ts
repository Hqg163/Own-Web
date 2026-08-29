import { describe, expect, it } from 'vitest'
import { createHeadingId } from '../../src/utils/toc'

describe('heading ids', () => {
  it('keeps readable ids unique for Chinese and duplicate headings', () => {
    const used = new Set<string>()
    expect(createHeadingId('介绍', used)).toBe('介绍')
    expect(createHeadingId('介绍', used)).toBe('介绍-2')
    expect(createHeadingId('介绍', used)).toBe('介绍-3')
  })

  it('normalizes formulas and punctuation without creating an empty id', () => {
    const used = new Set<string>()
    expect(createHeadingId('公式 $\\theta_{t+1}$：推导', used)).toBe('公式-theta-t-1-推导')
    expect(createHeadingId('!!!', used)).toBe('section-1')
  })
})
