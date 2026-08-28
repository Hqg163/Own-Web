# Own-Web 第二轮复核记录

> 本文只记录第二轮复核的代码、测试、运行时和真实站点证据，不继承上一轮报告的结论。

## 基线

- Branch: `codex/community-blog-v1`
- Start HEAD: `a245cf542e47acfd7241d926c97a03ad36aef8b7`
- Real site: `http://localhost:5173`
- Automated database: `own_web_test`（临时清理）
- Public showcase database: real site database（文章保留，不 teardown）

## Evidence levels

`Code Verified` · `Unit Tested` · `API Tested` · `E2E Tested` · `Visual Verified` · `Manually Verified` · `Publicly Verified`

## Claim Verification Matrix

| Previous Claim | Code Evidence | Runtime Evidence | Test Evidence | Status | Gap |
|---|---|---|---|---|---|
| Pool/startup/migrations are stable | `api/server.js`, `api/migrations.js` | pending | existing API checks | Partially Confirmed | second-pass restart/lock evidence pending |
| Empty editor does not create a draft | `PostEditor.vue` currently calls `ensureDraft()` from autosave | reproduced as code defect | failing regression added | Not Completed | meaningful-content gate required |
| Autosave preserves a single draft | `PostEditor.vue`, `/autosave` | pending | lifecycle regression pending | Partially Confirmed | new empty lifecycle and failure retry coverage |
| Draft deletion is safe | `DELETE /api/posts/:id` exists | owner/status matrix pending | failing API regression added | Partially Confirmed | status restriction and UI confirmation |
| User menu closes on outside/Escape/route | `NavigationBar.vue` uses native details | outside close reproduced | failing E2E added | Not Completed | controlled popover required |
| Fullscreen playlist is theme-safe | `MusicZone.vue` has conflicting white child colors | light-theme conflict reproduced | failing visual/a11y fixture added | Not Completed | tokenized child states |
| Mermaid is safely rendered | current renderer emits source `<pre>` | source-only runtime observed | security/render tests pending | Partially Confirmed | strict safe rendering and fallback |
| Preview and Published use equivalent semantics | client Tiptap HTML vs server renderer | pending | parity fixture pending | Partially Confirmed | contract comparison required |
| Four rich real articles were published | current E2E uses short bodies and cleans test users | no persistent public URLs | workflow only | Contradicted | publish four deep articles on real site |
| Existing private workspace is preserved | legacy routes and media code remain | author session inspected | regression suite pending | Code Verified | complete authenticated regression pending |

## Final evidence

This section is completed only after the centralized gate and real-site publication workflow finish.

