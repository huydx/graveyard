# AI Tutor — Spec

## Overview

An AI tutor chat app for a 6-year-old Japanese boy. Multimodal input (voice, text, image), multimodal output (text, voice, visuals, games, stories). The AI agent autonomously decides the best pedagogical response format.

## User Profile

- **Age**: 6 years old (小学校 1年生)
- **Language**: Japanese
- **Subjects**: 国語 (kokugo) and 算数 (sansuu)
- **Device**: Tablet-first, responsive to phone
- **Interaction**: Kid uses it independently (no parent mediation needed per session)

## Layout

Two-pane layout (tablet-first, responsive to phone):
- **Left pane** — Input controls (narrow strip)
- **Right pane** — Chat window (main area)

## Input Modes

Three input modes selectable via large icon buttons in the left pane:
1. **Voice** (default) — Tap to start, tap to stop. Visible recording indicator (pulsing icon + waveform). Primary mode since kid is 6.
2. **Camera** — Opens native camera app to capture a worksheet/print.
3. **Keyboard** — Standard system keyboard for text input.

Fallback: AI can also detect intent from freeform chat even if the wrong mode was used.

## Session Flow

- Single screen, no landing/home/middle step
- Kid taps app icon → straight into chat
- Open-ended duration (no fixed time limit)
- **First launch**: AI introduces itself and starts learning about the kid conversationally. No onboarding wizard or parent setup screen.
- **Returning**: AI waits silently. Kid sees last session's chat and speaks first.
- **Chat history**: Persistent thread (like LINE). Raw history always visible on scroll. AI compacts sessions into memory separately for context injection.

## Chrome

- Nothing. Two panes fill the screen.
- Parent gear icon (PIN-protected) floats in bottom-right corner.
- No top bar, no bottom nav, no title.

## Thinking / Loading

- Mascot character (bear/くま) with thinking animation while AI processes.
- Mascot also appears in first-launch greeting and idle animation.

## Camera Flow

- Kid taps camera icon → native camera opens → preview with retake/send buttons
- Sent photo appears as image bubble in chat
- AI extracts problems and responds naturally (no separate processing screen)

## Exercise Card Rendering

- AI generates interactive HTML to visualize the problem
- App renders in sandboxed iframe, display-only for v1
- Kid answers via standard left pane input (voice or text)
- AI decides pacing: after feedback, AI chooses next response (chat or another card)

## Voice Output

- Every AI message auto-plays voice via TTS
- Replay button on each bubble, stop button during playback
- Friendly character voice, slightly slower than normal adult speed

## Response Formats (AI-decided, v1)

The agent chooses between two formats:
1. **Chat** — Text bubble with auto-play voice. Covers plain answers, explanations, praise, encouragement, and conversation.
2. **Exercise card** — One problem with answer input. Kid answers via voice or text, AI evaluates immediately. Covers single problems and drill sequences (by repeating cards).

## Curriculum

- No preloaded curriculum data for v1
- AI infers kid's level from input, especially captured worksheet photos
- When no worksheet is provided, AI generates problems from long-term memory of past sessions

## Error Handling

- Single cute failure illustration for all error states (network down, AI failure, voice fail)
- Simple debouncing on tap-heavy interactions (mode switching)

## AI Agent Model

### Orchestration: True agent loop (Type C)

The AI can make multiple tool calls per interaction:
- Check skill map before generating a problem
- Evaluate an answer
- Update memory after an observation
- Look up curriculum to decide what's next

### Tools

| Tool | Purpose |
|------|---------|
| `lookup_skill(kid_id, skill)` | Get mastery level for a learning objective |
| `lookup_preferences(kid_id)` | Engagement patterns, interests |
| `record_observation(kid_id, observation)` | Persist an insight about the kid |
| `get_next_objective(kid_id, subject)` | What to work on next |
| `lookup_curriculum(grade, subject, topic)` | 学習指導要領 reference |
| `generate_problem(kid_id, skill, format)` | Create a problem at the right level |
| `explain_concept(skill, level)` | Simple explanation |
| `evaluate_answer(kid_id, problem, answer)` | Right/wrong + error pattern |
| `compact_session(kid_id)` | Summarize session into extracted insights |

## Long-Term Memory

Must track (compacted, not raw session logs):

| Category | What it stores |
|----------|---------------|
| **Skill map** | Per learning objective: mastered / practicing / not started |
| **Struggle patterns** | Repeated mistakes (e.g., "confuses れ・ね・わ") |
| **Preference profile** | Interests (dinosaurs > princesses), format preferences (visual > verbal), attention span, gamification response |
| **Curriculum progress** | Position within 学習指導要領 scope, prerequisites, next topics |

Raw session logs are compacted into summary insights to avoid token bloat.

## Safety

All of the following must be enforced:

- **Content filtering** — refuse inappropriate topics (tuned for Japanese children's context)
- **Grounding** — no hallucinated harmful advice, no medical/financial claims
- **Emotional safety** — never shame, mock, or frustrate. Graceful de-escalation on repeated failure. Suggest breaks.
- **Parent audit** — all interactions reviewable
- **Usage limits** — screen time caps, session timeouts, break reminders

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Frontend** | Next.js | For future Vercel deployment |
| **Database** | Local PostgreSQL | Migrate to Supabase later |
| **LLM** | Gemini (initially) | Abstracted for model swapping |
| **STT/TTS** | TODO: investigate | Web Speech API first, Gemini Live as fallback |
| **Auth** | Single-user for now | Multi-tenant architecture ready |

## Parent Features

- Small gear icon in corner of the screen
- Protected by 4-digit PIN
- Dashboard includes: session transcripts, AI observations about kid, time limit settings, weekly summary
- Kid never sees this UI

## PWA

- "Add to home screen" install flow
- Full-screen launch (no browser chrome)
- Service worker for offline fallback illustration

## Scope

- **Phase 1**: Single kid (my son), alpha usage
- **Future**: Multi-tenant when needed (use kokugo's multi-user pattern as reference)

## Relationship to kokugo

- kokugo is a worksheet-scanning web app (国語 practice from prints)
- This tutor is a conversational chat app (interactive, agent-driven)
- Different products, different architecture (Go vs Next.js)
- Some patterns reusable (Gemini integration, voice input approach)
