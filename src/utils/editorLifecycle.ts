export type DraftContent = {
  title?: string
  excerpt?: string
  content?: string
}

/**
 * A new editor may keep a local recovery snapshot, but should not create a
 * server row for a title field that was merely focused or briefly edited.
 * Two visible characters are enough for a deliberate title/body start; this
 * also makes a one-character type/delete cycle unambiguously empty.
 */
export function hasMeaningfulDraftContent(value: DraftContent): boolean {
  return [value.title, value.excerpt, value.content]
    .some((part) => Array.from(String(part || '').trim()).length >= 2)
}

