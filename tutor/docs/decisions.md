# AI Tutor — Decision Log

## Resolved

| # | Decision | Choice | Rationale |
|---|----------|--------|------------|
| 1 | Kid's age/grade | 6 years old, 小学校 1年 | Trunk decision — determines everything below |
| 2 | Subjects | 国語 + 算数 | Two subjects, Japanese school curriculum |
| 3 | Relationship to kokugo app | New standalone chat app | kokugo is worksheet processor; tutor is conversational agent |
| 4 | Interaction modality | Multimodal: voice or text in, anything out | Kid interacts solo, no parent mediation |
| 5 | Platform | Tablet-first, responsive to phone | Natural for 6-year-old |
| 6 | Teaching loop | Hybrid: structured curriculum backbone + curiosity-driven exploration | Pure exploration lacks scaffolding; pure drill is boring |
| 7 | Long-term memory | Yes — skill map, preferences, struggle patterns, curriculum progress | Defining feature of a tutor vs. Q&A bot |
| 8 | Memory granularity | Compacted summaries, not raw session logs | Avoid token bloat |
| 9 | Scope | Single kid (my son) for now, multi-tenant arch ready | Alpha usage; scale later |
| 10 | Agent orchestration | True agent loop with tool calling (Type C) | Needs to be "really smart and understand my kid" |
| 11 | Agent tools | All proposed tools accepted | Full toolbelt |
| 12 | Safety | All guardrails: content, grounding, emotional, audit, limits | Non-negotiable |
| 13 | Tech stack language | TypeScript (Next.js) | User wants to learn TypeScript |
| 14 | Frontend framework | Next.js | Vercel deployment in future |
| 15 | Database | Local PostgreSQL → Supabase later | Structured + pgvector; Supabase when scaling |
| 16 | LLM provider | Gemini initially, model-agnostic abstraction | Proven in kokugo; swap later |
| 17 | Input mode UI | Explicit buttons (Upload / Ask / Exercise) + AI intent detection fallback | Clarity for kid, graceful handling |

| 18 | Session lifecycle | Single screen, no landing/home, straight to chat, open-ended (no fixed duration) | No middle steps; kid taps icon and starts talking |
| 19 | Chat layout | Left pane (input controls) + right pane (chat window) | Left: text/camera/voice. Right: chat history + responses |
| 20v2 | Response format types (v1 launch) | Just 2: Chat (text + auto-play voice) and Exercise card (problem + answer input) | Simplest useful set; illustrations, games, stories deferred |
| 21 | Left pane input UI | 3 large icon buttons stacked vertically: mic (default, press-and-hold), camera (native app), keyboard (standard) | Voice-first since kid is 6 and may not read fluently |
| 29 | Exercise card rendering | AI generates interactive HTML; app renders in sandboxed iframe, display-only for v1 | Kid answers via standard left pane input; JS interactivity inside exercise HTML deferred to v2 |
| 30 | Thinking/loading indicator | Mascot character with thinking animation | Text dots too subtle for 6-year-old; mascot gives personality and makes waiting playful |
| 31 | Parent dashboard (v1) | Two tabs: History (session list + transcripts) and Observations (read-only AI insights about kid) | Time limits, weekly summaries, export are v2 |
| 32 | Voice input UX | Tap to start, tap to stop (not press-and-hold) | Tablet press-and-hold awkward for small hands; visible recording indicator prevents forgetting to stop |
| 33 | Voice output | Friendly character voice, slightly slower than normal. Replay + stop buttons per bubble. Device volume control. | Kid-friendly without being baby-talk |
| 34 | Camera/worksheet capture flow | Preview after capture with retake/send buttons. Photo appears as image bubble in chat. AI extracts problems and responds naturally. | No separate processing screen; seamless chat flow |
| 35 | Chat history persistence | Persistent chat thread (like LINE). Raw history always visible on scroll. AI compacts sessions into memory separately for context injection. | Same pattern as Hermes Agent and OpenClaw: raw persists, memory is compacted layer |
| 36 | Screen time / break enforcement | None for v1 | Parent dashboard time-limit settings are v2; AI might suggest breaks conversationally but nothing is enforced |
| 37 | Mascot | Simple bear (くま). Appears in loading animation, first-launch greeting, and idle. SVG, replaceable. | Exact design deferred; placeholder is fine |
| 38 | App open behavior (returning kid) | AI waits silently. Kid sees last session's chat and speaks first. | Detecting app-open vs refresh vs PWA resume is noisy; silent wait is simpler |
| 39 | Top-level chrome | Nothing. Two panes fill the screen. Gear icon floats in bottom-right corner. | Less chrome = less for 6-year-old to accidentally tap |
| 40 | Exercise card flow | AI decides each step. No auto-advance or drill mode. Agent observes answer, then decides next response. | Keeps the agent loop clean: observe → decide → respond |
| 22 | Curriculum data | No curriculum data for now; AI infers kid's level from input, especially captured worksheet photos | No 学習指導要領 integration yet |
| 23 | Behavior without worksheet | AI generates problems from long-term memory of past sessions | Smart enough to continue without parent-prepared materials |
| 24 | Error/offline handling | One cute failure illustration for all error states; simple debouncing for rapid taps | Kid can't fix network issues, so don't pretend they can |
| 25 | PWA | Yes — "add to home screen" for full-screen app-like feel on tablet | Parent sets up once; kid taps icon like a native app |
| 26 | Onboarding | Launch straight into chat; AI learns about the kid conversationally | No parent setup screen, no intro wizard |
| 27 | Parent features | Small gear icon (hidden in corner) + 4-digit PIN → parent dashboard: session history, AI observations, time limits, weekly summary | Kid never sees it; single codebase |
| 28 | Game mode UX (v1) | Tap-the-answer quizz only; inline in chat (no full-screen takeover); stars/stickers per-session (no persistent economy); no timer | Drag-to-match too complex for v1; timers stress 6-year-olds |
| 41 | Memory storage backend | File-based (markdown + jsonl), no PostgreSQL for v1 | Scale doesn't justify a database for one kid; OpenClaw model works at larger scale; migration script is a one-afternoon job later |
| 42 | Memory flush before compression | Yes — silent agent turn extracts observations before compaction | Both reference repos do this; prevents data loss when conversation middle is summarized; one extra LLM call at session end is negligible |
| 43 | Past session context injection | Last 5 session summaries or budget-capped at 1500 tokens (newest-first), whichever smaller | Enough to see ~2 weeks of practice patterns; OpenClaw's budget-capped model prevents bloat when sessions are dense |
| 44 | Memory tiers | Three tiers: Working (T1, raw messages), Session (T2, daily notes), Long-Term (T3, MEMORY.md) | OpenClaw's tier model: each tier has its own compaction boundary and injection strategy |
| 45 | Background memory consolidation | Deferred to v2 (dreaming pipeline) | Explicit observation recording is sufficient for one kid; add automated promotion when manual curation becomes impractical |
| 46 | Agent tools (v1) | 3 tools: `record_observation`, `memory_search`, `compact_session` | 6 of the 9 spec tools were dropped — they were either data already in context (MEMORY.md), LLM core output (generate/explain/evaluate), or data that doesn't exist yet (curriculum). Every tool call adds latency for the kid. |
| 47 | Agent loop pattern | Hermes iteration budget + tool dispatch, simplified | Prefetch memory → assemble context → LLM call → dispatch tools if any → loop (max 5 iterations) → deliver response. No retry/fallback complexity for v1. |
| 48 | System prompt assembly | OpenClaw bootstrap files: SOUL.md + AGENTS.md injected as stable prefix | SOUL.md = who the tutor is (tone, voice, boundaries). AGENTS.md = how it operates (tool conventions, decision rules). Stable prefix (~4250 tokens) never changes mid-session, enabling prefix caching. |
| 49 | Tutor persona | SOUL.md for persona, AGENTS.md for operational instructions | No Hermes-style SKILL.md plugin system — the tutor is a single-purpose agent, not a plugin host |
| 50 | Exercise generation & evaluation | Not tools — they're the LLM response itself. Response type marker (`chat` / `exercise`) tells frontend how to render. | Making them tools adds a round trip with no benefit; the LLM already has full context to produce/evaluate inline |

## Open / TODO

| # | Item | Status |
|---|------|--------|
| — | STT/TTS: Investigate best option for Japanese kids' voice | TODO |
| — | Kid identity (hardcoded, env var, or AI-learned?) | Not discussed |
| — | Parent PIN setup (how is initial PIN configured?) | Not discussed |
| — | Specific memory schema / compaction algorithm | Not discussed |
| — | AI agent tools refinement for v1 (trim for 2 response formats?) | Not discussed |
| — | PWA offline strategy (service worker caching) | Not discussed |
| — | Drag-to-match, stories, illustrations — deferred to v2 |

## Interview paused at

UX/spec layer mostly done (40 decisions). Next session: tech layer — memory schema, agent tool refinement, STT/TTS selection, PWA service worker strategy, database schema.
