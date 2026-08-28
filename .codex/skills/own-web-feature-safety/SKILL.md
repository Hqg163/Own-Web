---
name: own-web-feature-safety
description: Change Own-Web blog, workspace, media, or account behavior without losing existing capabilities or weakening ownership and visibility rules. Use for routes, APIs, database changes, uploads, deletions, authentication, or feature refactors; not for purely presentational CSS changes.
---

# Own-Web feature safety

Read `../../PRODUCT_BASELINE.md` and trace the target route from UI through API before editing.

Preserve existing user-visible capabilities and legacy route compatibility unless the user explicitly authorizes removal. Prefer an additive migration or redirect over deletion.

For any protected resource, validate both authentication and ownership/visibility in the server endpoint. Do not trust `userId`, `authorId`, or a filename from the browser. Check read, list, mutation, and linked-resource paths separately.

After implementation, run `npm run api:check` and `npm run build`. Add or update a focused regression test when changing access control, deletion, uploads, or compatibility behavior. Report the access cases tested and any case that still needs a real database/manual test.
