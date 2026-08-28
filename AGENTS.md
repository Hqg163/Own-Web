# Own-Web project instructions

## Read first

For any change to this repository, read these files before editing:

1. `.codex/DESIGN_SYSTEM.md` for a visual or interaction change.
2. `.codex/PRODUCT_BASELINE.md` for an information-architecture or feature change.
3. The applicable skill under `.codex/skills/` when its description matches the request.

## Product contract

- Own-Web combines a public community blog with a private workspace.
- Preserve existing routes and working capabilities unless the user explicitly authorizes removal. Old routes may redirect, but must remain usable during a migration.
- Public blog content and private workspace data are different security domains. Enforce visibility and ownership in server APIs; never rely on hidden client controls.
- Prefer small, reversible changes. Run the relevant checks after each logical change: `npm run build` and `npm run api:check`; add targeted tests when changing permissions or data mutation.

## UI contract

- Reuse `src/style.css` tokens and `AppIcon.vue`; do not introduce a second palette, arbitrary gradients, emoji UI icons, or page-local light/dark token systems.
- Keep the established editorial/workspace direction: warm neutral surfaces, one muted blue-gray accent, restrained borders and shadows, 8px spacing scale.
- Verify a changed route in the running app before declaring UI work complete. Capture an actual project screenshot when the user requests visual review.

## Keep prompts short

The user can normally state only: desired outcome, target area, and any exceptional constraint. Treat this file and `.codex/` as the durable context; do not ask them to repeat it.
