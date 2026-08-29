import { render } from 'katex'

const MATH_SELECTOR = '[data-math]'

export function enhanceMath(root: ParentNode): number {
  const elements: HTMLElement[] = []
  if ('matches' in root && typeof root.matches === 'function' && root.matches(MATH_SELECTOR)) {
    elements.push(root as HTMLElement)
  }
  root.querySelectorAll<HTMLElement>(MATH_SELECTOR).forEach((element) => elements.push(element))

  let rendered = 0
  for (const element of elements) {
    if (element.dataset.mathRendered === 'true' || element.dataset.mathError === 'true' || element.querySelector('.katex')) continue
    const value = element.dataset.math?.trim()
    if (!value) continue
    const displayMode = element.matches('[data-math-block], .math-block')
    try {
      render(value, element, {
        displayMode,
        throwOnError: false,
        strict: 'warn',
        trust: false,
        maxSize: 10,
        maxExpand: 100,
      })
      element.dataset.mathRendered = 'true'
      rendered += 1
    } catch (_) {
      element.textContent = value
      element.dataset.mathError = 'true'
    }
  }
  return rendered
}
