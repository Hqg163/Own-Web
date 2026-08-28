# Own-Web product baseline

## Domains

| Domain | Purpose | Entry points |
| --- | --- | --- |
| Public blog | Read and discover public writing | `/`, `/explore`, `/posts/:slug`, `/u/:username` |
| Creation | Author and manage a user's posts | `/creation`, `/write`, `/posts/:id/edit` |
| Private workspace | Personal profile, learning materials, mail, and media | `/dashboard`, `/personal/*` |

## Non-negotiable behavior

- Preserve the existing account, study, mail, image, video, music, and blog capabilities when refactoring UI.
- Author identity and ownership derive from the authenticated server session, never a client-provided user ID or URL parameter.
- A post's `public`, `private`, `followers`, and `unlisted` visibility controls every read path: listing, detail, comments, media, metadata, and search.
- Compatibility endpoints that accept a user identifier must either validate it or intentionally ignore it and always scope data to the authenticated user. Cover the chosen behavior with a regression test.
- Destructive operations need a clear confirmation and an outcome message. Never silently delete files, posts, or media.

## Standard change report

For implementation work, report: changed behavior, preserved behavior, files changed, checks run, and any untested risk. For visual work, include a real project screenshot when requested.
