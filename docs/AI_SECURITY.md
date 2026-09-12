# AI Agent / RAG v1 security model

## Authorization is server-side

AI imports the existing post access policy rather than duplicating client controls. The server re-reads the requested post before accepting selection context, builds Qdrant metadata scope from the authenticated user, then rehydrates every candidate from MySQL and rechecks `public`, owner, follower and unlisted-share-token access before reranking or model context. Private drafts are author-only; an unlisted token is not inferred or enumerated.

Conversations, messages, feedback, Memory and settings for signed-in users always include `user_id` in their data operation. Guest conversations are held only in the current process; only an HMAC guest-session marker can be written to usage. This avoids both raw anonymous-ID storage and cross-user IDOR through browser-supplied IDs.

## Prompt, tool and output controls

The system instruction marks article text, retrieval chunks, selected text and tool results as untrusted data. It forbids instruction following from them, secret/system-prompt disclosure, fabricated citations, permission bypasses and hidden-reasoning disclosure. Only five static read-only tools can run, each with Zod validation, timeout and response limit; arbitrary SQL, shell, URL, MCP and model-selected tool calls do not exist. The workflow stops at three tool rounds.

The Vue chat surface renders Markdown through `marked` and DOMPurify with a restricted tag/attribute list. Citations are structured links produced by the server response composer, rather than trusting provider HTML. The AI UI regression sends hostile model-shaped HTML and verifies it cannot create an image or execute code.

## Abuse controls and telemetry

All AI routes remain behind the application Origin/no-store middleware and use the existing HttpOnly session validation when present. Chat validates request shape and size, model registry membership, daily guest/user allowance, per-IP window, per-subject concurrency and global daily request/token ceilings before model work. Browser cancellation propagates an AbortSignal upstream and records aborted rather than complete status.

Logs contain only request ID, anonymous marker or user ID, selected model/intent, timing, chunk IDs/tool names, token usage and status. They must not contain message body, selection content, prompts, secrets or Cookies. Treat unexpected content in provider or Qdrant logs as an incident: revoke provider/Qdrant keys, preserve minimal redacted evidence, invalidate affected sessions where warranted, check `ai_usage`/index jobs, and rebuild the index after remediation.

## Required regression checks

Run `npm run test:ai-security` and `npm run test:ai-ui` after changing authorization, model, streaming or rendering code. They cover private/unlisted access, candidate rehydration before rerank, illegal tools, Memory scope, prompt defenses, SSE boundary/quotas, and hostile Markdown output. Also run existing API/security suites; the full runner invokes the AI test suite as part of `npm run test:all`.

For an explicitly approved live-provider check, set `AI_LIVE_TESTS=1` in the
current shell and run `npm run ai:live:security`. It uses random synthetic
private, follower-only and unlisted posts under temporary accounts; verifies
guest RAG denial, authorized follower/share-token RAG, Skill allowlisting and
server-side Context Builder revalidation; then deletes the fixtures and their
filtered Qdrant points in `finally`. Its output is intentionally limited to a
request ID, check names and counts. This verifies policy enforcement around a
real embedding/rerank/Qdrant path, but it does not turn stochastic model text
into a proof of prompt-injection resistance: retain deterministic system
prompt, tool-schema and DOMPurify regression tests for that contract.

`npm run ai:live:account` is the complementary real-provider persistence
check. It creates a temporary private account, verifies selected-model and
explicit-Memory persistence with a real Qwen ordinary-chat response, asserts
conversation/Memory IDOR isolation, then deletes the account in `finally`.
It emits only a generated request ID, check names and counts; it never logs a
message body, credential, Cookie or account identifier.
