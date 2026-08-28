---
name: own-web-ui-consistency
description: Update Own-Web UI while preserving the project's editorial/workspace design system, shared icons, responsive behavior, and actual visual verification. Use for page, component, style, icon, layout, or interaction work; not for backend-only changes.
---

# Own-Web UI consistency

Read `../../DESIGN_SYSTEM.md` and the target component before editing.

Keep the requested behavior intact. Reuse `src/style.css`, shared controls, and `AppIcon.vue`; do not create a page-specific theme or replace functional controls with decorative placeholders.

For a legacy page, first identify its actions, loading/error/empty states, and keyboard behavior. Then bring its layout and controls into the shared system without changing routes or API contracts.

Verify the affected route in the running project in light and dark mode, plus a narrow viewport when the layout changes. Run `npm run build`. If the user asks to see the result, provide an actual screenshot of the running Own-Web route and label any external visual references as references.
