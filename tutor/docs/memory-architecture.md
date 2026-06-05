# Memory, Agent Loop & Tools Architecture

## Decisions (resolved in discussion)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Storage backend | File-based (markdown + jsonl), no PostgreSQL for v1 |
| 2 | Memory flush before compression | Yes — silent agent turn extracts observations before compression |
| 3 | Past session context injection | Last 5 session summaries or budget-capped at 1500 tokens, whichever smaller |
| 4 | Background consolidation | Deferred to v2, TODO saved |

## Pattern Reference

**Hermes Agent** provides our abstraction model:
- `MemoryProvider` ABC with lifecycle hooks → pluggable backends
- `MemoryManager` fan-out orchestration with fault isolation
- `ContextEngine` for token-budget compaction with head/tail protection
- Provider hooks for session boundaries and pre-compression extraction

**OpenClaw** provides our concrete file/tier model:
- Three explicit tiers: curated (`MEMORY.md`), daily notes (`memory/YYYY-MM-DD.md`), consolidation pipeline (dreams, v2)
- Memory flush before compression
- File-backed transparency — plain markdown, no hidden state
- Bootstrap budget with truncation
- `memory_search` tool for dynamic retrieval

---

## Memory Tiers

```
┌─────────────────────────────────────────────────────┐
│ TIER 1: Working Memory (current session)            │
│ → In-context chat history + tool call results       │
│ → Compaction boundary: session end or 75% token cap │
│ → Stored in: sessions/YYYY-MM-DD.jsonl              │
│ → Lifetime: 1 session                               │
├─────────────────────────────────────────────────────┤
│ TIER 2: Session Memory (per-session notes)          │
│ → Summary, key moments, skill observations, mood    │
│ → Compaction boundary: ~10 sessions                 │
│ → Stored in: memory/YYYY-MM-DD.md                   │
│ → Lifetime: weeks–months (kept for parent audit)    │
├─────────────────────────────────────────────────────┤
│ TIER 3: Long-Term Memory (cross-session facts)      │
│ → Skill map, struggle patterns, preferences,        │
│   curriculum position                               │
│ → Compaction boundary: manual review or deep phase  │
│ → Stored in: MEMORY.md                              │
│ → Lifetime: months–years (grows with the kid)       │
└─────────────────────────────────────────────────────┘
```

### Tier 1: Working Memory

- Current conversation messages since session start
- Stored as append-only JSONL in `sessions/YYYY-MM-DD.jsonl`
- Displayed as scrollable chat history
- Injected into LLM context directly (no summarization)
- When session ends or 75% token threshold hit → compacted into Tier 2

### Tier 2: Session Memory (daily notes)

- One markdown file per day: `memory/YYYY-MM-DD.md`
- Created by `compact_session` at session end (or by flush before mid-session compression)
- Contains:
  - Topics worked on
  - Skills practiced and results
  - Observations made about the kid
  - Mood and engagement notes
  - What worked / what didn't
- Injected: last 5 sessions into context (or budget-capped at 1500 tokens, newest-first)
- Searchable via `memory_search` tool

### Tier 3: Long-Term Memory (MEMORY.md)

- Single curated file: `MEMORY.md`
- Always injected into context (compact by design, ~500 tokens)
- Contains four sections mapping to our memory categories:

```markdown
# そうすけ — Memory

## Skill Map
| Skill | Status | Proficiency | Last Practiced | Notes |
|-------|--------|-------------|----------------|-------|
| hiragana_reading | mastered | 5/5 | 2026-05-15 | All 46 characters |
| hiragana_writing | practicing | 3/5 | 2026-05-18 | Confuses れ・ね・わ |
| number_recognition_1_20 | mastered | 5/5 | 2026-05-10 | |
| single_digit_addition | practicing | 2/5 | 2026-05-18 | Uses finger counting |
| subtraction | not_started | — | — | |

## Struggle Patterns
- **Confuses visually similar kana** (since 2026-05-10)
  - れ vs ね vs わ — mixes up the hook direction
  - Frequency: 4 sessions
  - What helps: tracing practice with arrow guides

## Preferences
- Interests: dinosaurs (0.9), trains (0.4), princesses (0.2)
- Format: visual > verbal, game > drill
- Attention span: ~8 minutes per activity
- Gamification response: high

## Curriculum Progress
| Subject | Topic | Status | Last Updated |
|---------|-------|--------|--------------|
| kokugo | hiragana | in_progress | 2026-05-18 |
| sansuu | numbers_1_20 | completed | 2026-05-10 |
| sansuu | addition_1digit | in_progress | 2026-05-18 |
| sansuu | subtraction_1digit | not_started | — |
```

---

## File Layout

```
~/.tutor/
├── MEMORY.md                  # Tier 3: curated long-term facts
├── memory/
│   ├── 2026-05-18.md          # Tier 2: today's session notes
│   ├── 2026-05-17.md          # yesterday
│   ├── 2026-05-15.md          # older
│   └── ...
├── sessions/
│   ├── 2026-05-18.jsonl       # Tier 1: raw messages (append-only)
│   └── ...
├── config.yaml                # Tutor config
└── .dreams/                   # v2: dreaming pipeline state
```

---

## Context Injection Per Turn

Assembled by `ContextAssembler` (inspired by Hermes's `ContextEngine`):

```
[System Prompt]           — static, always present
[Safety Rules]            — static, always present
[Tier 3: MEMORY.md]       — always injected (~500 tokens, compact by design)
[Tier 2: Session Context] — last 5 daily notes (~1500 token budget, truncated if exceeded)
[Tool Schemas]            — agent tools
[Tier 1: Conversation]    — current messages:
                              head (first 3 non-system msgs) — preserved
                              middle — compressed when over 75% token budget
                              tail (last 6 msgs) — preserved
```

Token budget: threshold_percent = 0.75, context_length = model's context window. If Tier 2 exceeds 1500 tokens, older sessions are dropped.

---

## Compaction Pipeline

### Trigger points

1. **Session end** — kid closes app, timeout, or `/compact` command
2. **Mid-session** — Tier 1 messages approach 75% of model context window

### Session-end compaction

```
1. [Flush] Silent agent turn (OpenClaw pattern):
   → "Save any unsaved observations about the kid to memory now."
   → record_observation() calls for each insight
   → compact_session() produces Tier 2 daily note

2. [Upsert] MEMORY.md updated from extracted observations:
   → skill_map: merge status changes
   → struggle_patterns: append new, merge duplicates
   → preference_profile: update signals
   → curriculum_progress: advance if prerequisites met

3. [Store] Tier 2 daily note written to memory/YYYY-MM-DD.md
```

### Mid-session compression

```
1. [Protect] System prompt + head (3) + tail (6) preserved verbatim

2. [Flush] Silent memory flush before compression:
   → Agent extracts any unsaved observations before middle is compressed

3. [Compress] Middle messages summarized by LLM:
   → Returns single summary message injected between head and tail

4. [Increment] compression_count++; warn if >= 2 (Hermes pattern)
```

### What survives compression

- System prompt & safety rules: **always**
- MEMORY.md (Tier 3): **always** (it lives outside the conversation)
- Head: first 3 non-system messages **preserved verbatim**
- Tail: last 6 messages **preserved verbatim**
- Middle: **summarized** into a single compressed message
- Tool state (skill lookups, etc.): **re-appended** after compression

---

## Agent Tools

Three tools for v1. Every tool call adds latency — for a 6-year-old waiting, less is more.

### Why only 3?

Six of the original 9 spec tools were dropped:

| Dropped | Reason |
|---------|--------|
| `lookup_skill` | MEMORY.md skill map is always in context (~500 tokens) |
| `lookup_preferences` | MEMORY.md preferences always injected |
| `get_next_objective` | Agent reasons from curriculum table in MEMORY.md |
| `lookup_curriculum` | No curriculum data for v1 |
| `generate_problem` | LLM core output, not a tool — generates inline |
| `explain_concept` | LLM core output, not a tool — explains inline |
| `evaluate_answer` | LLM evaluates inline, calls `record_observation` if needed |

### The 3 tools

```
record_observation(observation, category)
  → Appends to today's memory/YYYY-MM-DD.md
  → Category hint: skill | struggle | preference | curriculum
  → Called when agent notices something worth remembering
  → Does NOT write to MEMORY.md (that happens at compaction)

memory_search(query)
  → Grep across memory/*.md files (keyword match)
  → Returns relevant snippets with file references
  → Used when agent needs context beyond what's injected

compact_session()
  → Summarizes full session → writes memory/YYYY-MM-DD.md
  → Updates MEMORY.md if durable facts found
  → Called at session end (automatic) + before mid-session compression
```

---

## Agent Loop

Borrows Hermes's iteration budget + tool dispatch pattern, simplified for a single-user app.

```
Turn handler (fires per kid interaction):
  1. PREFETCH
     → MemoryManager.prefetchAll() — loads MEMORY.md + last 5 sessions

  2. ASSEMBLE CONTEXT
     → [SOUL.md] [AGENTS.md] [Safety] [MEMORY.md] [Last 5 sessions]
       [Tool schemas] [Conversation history]
     → Stable prefix (~4250 tokens) never changes mid-session

  3. AGENT LOOP (max 5 iterations)
     → LLM call (Gemini)
     → If response is a final message (chat or exercise card): break
     → If response has tool calls: execute, append results, loop again

  4. SYNC
     → MemoryManager.syncAll(user_msg, assistant_response)
     → Appends to sessions/YYYY-MM-DD.jsonl

  5. DELIVER
     → Text + TTS to kid
     → If exercise card: sandboxed iframe

Session end:
  → compact_session() triggered
  → Memory flush: silent agent turn extracts observations
  → MEMORY.md updated if new durable facts found
```

No retry/fallback complexity for v1 — if Gemini fails, show the error illustration.

### Structure borrowed

| Aspect | Source |
|--------|--------|
| Iteration budget + tool dispatch loop | Hermes `conversation_loop.py` |
| Stable prefix with bootstrap files | OpenClaw system prompt assembly |
| SOUL.md + AGENTS.md as persona layer | OpenClaw bootstrap files |
| Memory prefetch before LLM call | Hermes `MemoryManager.prefetchAll()` |
| Post-turn memory sync | Hermes `MemoryManager.syncAll()` |
| Memory flush before compression | Both (OpenClaw pattern adopted) |

---

## Memory Provider Interface

Adapted from Hermes's `MemoryProvider` ABC, simplified for v1 single-provider use:

```typescript
interface MemoryProvider {
  readonly name: string;

  // Lifecycle
  initialize(kidId: string): Promise<void>;
  shutdown(): Promise<void>;

  // Turn hooks
  prefetch(query: string): Promise<string>;                      // pre-LLM retrieval
  syncTurn(userMsg: string, assistantMsg: string): Promise<void>; // post-turn persist

  // Session hooks
  onSessionStart(sessionId: string): Promise<void>;
  onSessionEnd(messages: Message[]): Promise<void>;               // triggers flush + compact
  onPreCompress(messages: Message[]): Promise<string>;            // flush before mid-session compression

  // Context
  buildSystemPromptBlock(): Promise<string>;                      // returns MEMORY.md + last 5 daily notes

  // Tools
  getToolSchemas(): ToolSchema[];
  handleToolCall(name: string, args: Record<string, unknown>): Promise<string>;
}
```

v1 ships one built-in provider: `FileBasedMemoryProvider`. The interface is clean enough to add a PostgreSQL or external provider later.

---

## Session Lifecycle

```
New session:
  1. onSessionStart(sessionId)
  2. Agent loop runs (prefetch → LLM → syncTurn per turn)
  3. Session ends (close / timeout / /compact):
     → onSessionEnd(messages)
       → Flush: silent agent turn extracts observations
       → compact_session: write memory/YYYY-MM-DD.md
       → Upsert: update MEMORY.md from extracted facts
     → onPreCompress(messages) if mid-session compaction needed

Returning session:
  → MEMORY.md + last 5 daily notes injected into system prompt
  → Kid sees last session's chat (from sessions/*.jsonl)
  → AI waits silently for kid to speak first
```

---

## Multi-Tenant

All paths include kid_id for future multi-kid support:

```
~/.tutor/kids/{kid_id}/
├── MEMORY.md
├── memory/
├── sessions/
└── config.yaml
```

For v1 (single kid), the kid_id is hardcoded. No architectural changes needed to add a second kid later.

---

## v2: Dreaming Pipeline (TODO)

Background consolidation inspired by OpenClaw's dreaming system:

- Scheduled sweep (3 AM daily) processes recent daily notes
- Three phases: Light (ingest + deduplicate) → REM (pattern extract) → Deep (promote to MEMORY.md)
- Gates: minScore, minRecallCount, minUniqueQueries — only durable facts get promoted
- Anti-self-reinforcement: dream artifacts excluded from promotion candidates
- Human review surface: DREAMS.md shows phase summaries
- Machine state: `memory/.dreams/` stores scores and signals
