# Own-Web design system

This is the visual source of truth for both the public blog and private workspace. It records the implemented baseline, not a speculative redesign.

## Intent

Calm editorial writing and a practical personal workspace. The interface should feel focused and mature, not playful, decorative, or like a collection of unrelated tools.

## Tokens and foundations

- Use the CSS custom properties in `src/style.css` (`--bg`, `--surface`, `--surface-raised`, `--text`, `--muted`, `--border`, `--accent`, `--accent-soft`, `--danger`). Extend that file first if a shared token is genuinely missing.
- Light mode uses warm neutral backgrounds; dark mode uses graphite surfaces. `--accent` is the only standard emphasis color. Danger is reserved for destructive actions.
- Use the existing 4/8/12/16/24/32/48 spacing tokens. Use `--radius-sm` for controls and `--radius` for cards/dialogs.
- Use a 1px border and the existing light `--shadow` for elevation. Avoid large blur, glass effects, neon, and broad gradients.

## Components

- Use `AppIcon.vue` for interface symbols. Add a semantic line icon to it only when no existing icon fits. Do not use emoji for UI controls, empty states, toolbars, navigation, or status.
- Primary action: `.button.button-primary`; secondary action: `.button`; low-emphasis action: `.button-ghost`; destructive action: `.button-danger` with a confirmation flow when material.
- Cards use `.card`; fields use `.field`. Labels, loading, empty, error, disabled, hover, and focus-visible states are mandatory where relevant.
- User avatars use the shared avatar component/API and must have a text fallback. Do not use remote random-avatar generators.

## Page composition

- Public pages: `container` + `page-section`, readable single-column article width, restrained information hierarchy.
- Private pages: a clear header, compact primary actions, visible task context, then lists/grids. Keep content actions near the content they affect.
- Desktop content width is at most 1200px; preserve mobile layouts at 760px and 640px breakpoints unless a component needs a well-justified additional breakpoint.
- Empty states are short and factual, using a line icon and next action when one exists. Avoid cute or apologetic wording.

## Visual acceptance checklist

Before completing a UI change, compare the result with `/`, `/dashboard`, `/personal/study`, and the relevant media or blog route:

1. Does it use the shared tokens and icons?
2. Does it retain function, keyboard access, focus state, and readable error/loading/empty states?
3. Does it work in light, dark, desktop, and narrow mobile layouts?
4. Does it look like part of the same editorial/workspace product without introducing a competing visual style?
