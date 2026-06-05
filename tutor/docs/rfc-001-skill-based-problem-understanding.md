# RFC 001: Skill-Based Problem Understanding System

- **Status**: Draft
- **Date**: 2026-06-03
- **Author**: Claude & huydx

## Summary

When そうすけ uploads a worksheet photo, the AI tutor (Kuma-sensei) should proactively analyze the image, identify the subject and problem type, and follow a structured, subject-specific workflow to guide him through the problems. After completing the exercise, the core concept should be automatically saved to long-term memory.

Currently, the app has a generic worksheet-handling prompt in `agents.md` (lines 97-105). This RFC proposes replacing it with a **skill-based system** where each subject (算数, 国語) has its own named skill with specialized prompts and phased workflows.

## Motivation

### Problems with the current approach

1. **Generic handling**: The same prompt handles math and kokugo worksheets, despite them requiring fundamentally different teaching approaches.
2. **No explicit routing**: The LLM silently infers the subject — nothing is observable or auditable.
3. **No phase structure**: No guarantee the LLM follows a consistent workflow (read → guide → check → review).
4. **Memory saving is ad-hoc**: The LLM may or may not call `record_observation`, and there's no mechanism to save the "core concept" of an exercise.
5. **Session lifecycle is broken**: `onSessionEnd` is never called, `memory_search` is hardcoded to return "not available", and tool dispatch bypasses the real MemoryProvider implementations.

### Design goals

- **Stable routing**: The LLM must explicitly declare which skill it's using — observable, auditable, and reliable.
- **Subject-specific workflows**: Math problems and kokugo problems get different phases, different teaching strategies, and different memory schemas.
- **Auto-save to memory**: Core exercise concepts flow to Tier 2 (daily notes) and Tier 3 (MEMORY.md) automatically.
- **Extensible**: Adding a new skill (e.g., science, English) should require only a new prompt file + registry entry — no code changes to the agent loop.

## Architecture

### Overview

```
📸 Image uploaded
    ↓
🔍 LLM sees image + system prompt (contains ALL skill prompts + routing instructions)
    ↓
🎯 LLM calls select_skill("math_understanding" | "kokugo_understanding")
    [Tool records activation in Tier 2, returns confirmation + phase list]
    ↓
📋 LLM follows the skill's phases IN ORDER
    [Each phase has specific instructions defined in the skill's prompt file]
    ↓
💾 LLM calls save_exercise_concept at section/worksheet completion
    [Writes immediately to Tier 2 (daily notes) and Tier 3 (MEMORY.md skill map)]
```

### Why `select_skill` is a tool (not just prompt-based)

| Concern | Prompt-only routing | `select_skill` tool |
|---------|-------------------|---------------------|
| Routing reliability | LLM silently infers — can miscategorize | LLM must explicitly call the tool — observable in tool call log |
| Parent visibility | No record of which skill was used | Every activation is logged to Tier 2 daily notes |
| Phase enforcement | LLM decides phase transitions implicitly | Phase list is returned by tool; annotations make progress trackable |
| Extensibility | Adding skills means editing large prompts | New skill = new file + one registry entry |

### Why immediate writes (not deferred to session end)

Session end is unreliable — the kid may close the browser, the tablet may sleep, the page may crash. Skill data is too important to risk losing. Each `save_exercise_concept` call writes to both Tier 2 and Tier 3 immediately. Session-end compaction (`compactSessionToDailyNote`) becomes a consolidation step, not the primary write path.

## Skill Definitions

### math_understanding (算数 りかい)

**When to activate**: Worksheet involves addition, subtraction, counting, numbers, shapes, patterns, or comparing quantities.

**Phases**:

| # | Phase | Description |
|---|-------|-------------|
| 1 | `read_problem` | Read the problem aloud. Ask そうすけ to explain it in his own words. Confirm understanding. Do NOT solve yet. |
| 2 | `guide_solution` | Let そうすけ attempt independently. Correct → specific praise for the strategy. Incorrect → point to specific mistake, give ONE hint, let retry. 2 consecutive wrong → drop difficulty. 3 consecutive right → offer harder variant. |
| 3 | `check_understanding` | Ask a variation (different numbers or context). If solves independently → understood. If struggles → return to phase 2. |
| 4 | `review_concept` | Summarize in 1-2 sentences. Connect to prior knowledge. Call `save_exercise_concept` with skill context. |

**Memory guidance**:
- Skill observations: track math ability ("Can add single digits with finger counting")
- Struggle observations: track error patterns ("Confuses + and − when both appear")
- Curriculum observations: track topic coverage ("Practiced 2-digit addition without carrying")
- Always include operation type, number range, and mistake pattern in observation content

### kokugo_understanding (国語 りかい)

**When to activate**: Worksheet involves hiragana/katakana reading, writing practice, word recognition, sentence reading, or vocabulary.

**Phases**:

| # | Phase | Description |
|---|-------|-------------|
| 1 | `read_problem` | Read worksheet instructions aloud. Point to specific characters/words. Let そうすけ attempt reading the first item. Confirm understanding. |
| 2 | `guide_practice` | Let そうすけ write/read. Correct → specific celebration. Incorrect → show correct form gently, compare with their attempt. For writing confusion → stroke-order hints. For similar characters (れ/ね/わ) → highlight distinguishing features. 2 consecutive mistakes → drop to easier characters. 3 correct → introduce new character or word. |
| 3 | `check_retention` | Ask to write/read the same character without reference. Give a new word using the practiced character. If retained → mark complete. If not → return to phase 2. |
| 4 | `review_concept` | Summarize characters practiced. Note confusion patterns specifically. Connect to reading ("このまえ よんだ えほんにも この「く」が でてきたよ"). Call `save_exercise_concept` with skill context. |

**Memory guidance**:
- Skill observations: track literacy progress ("Can read all hiragana in あ行")
- Struggle observations: track character confusions ("Confuses れ/ね/わ — mixes up hook direction")
- Curriculum observations: track topic coverage ("Practiced か行 hiragana writing")
- Always include specific characters, whether reading or writing, and mistake type

## New Tools

### select_skill

```
select_skill(skillName: "math_understanding" | "kokugo_understanding", contextNotes?: string)
```

**Behavior**:
1. Validates skill name against the registry
2. Records activation as a Tier 2 observation: `[skill] Activated skill: 算数 りかい — Worksheet shows 10 addition problems`
3. Returns phase list to the LLM: `"Skill math_understanding activated. Follow phases: read_problem → guide_solution → check_understanding → review_concept."`

### save_exercise_concept

```
save_exercise_concept(
  subject: "kokugo" | "sansuu",
  skill: string,
  proficiency: 1-5,
  problemsAttempted: number,
  problemsCorrect: number,
  notes?: string
)
```

**Behavior**:
1. Writes structured observation to Tier 2 daily notes via `tier2.appendObservation()`
2. Upserts skill entry in Tier 3 MEMORY.md skill map via `tier3.upsertSkill()`
3. Upserts curriculum progress entry via `tier3.updateCurriculum()`
4. Returns confirmation with summary

**Design note**: This tool is separate from `record_observation`. `record_observation` is for free-form, ad-hoc observations. `save_exercise_concept` is structured and quantitative — it updates the skill map with proficiency scores and attempt/correct counts.

### record_observation (enhanced)

Existing tool, enhanced with optional `skillName` and `phase` fields so observations are tagged with context:

```
record_observation(
  observation: string,
  category: "skill" | "struggle" | "preference" | "curriculum" | "mood",
  skillName?: string,   // NEW
  phase?: string         // NEW
)
```

### memory_search (fixed)

Currently hardcoded to return "Tool not available in agent loop v1". This RFC fixes it by routing through `memoryProvider.handleToolCall()`, which delegates to `tier2.searchNotes()`.

## File Changes

### New files

| File | Purpose |
|------|---------|
| `lib/agent/prompts/skills/math_understanding.md` | Math skill prompt with 4 phases |
| `lib/agent/prompts/skills/kokugo_understanding.md` | Kokugo skill prompt with 4 phases |
| `lib/agent/prompts/skills/registry.ts` | Skill definitions, prompt loading, routing prompt builder |

### Modified files

| File | Change |
|------|--------|
| `lib/agent/context.ts` | Inject all skill prompts + routing instruction into system prompt |
| `lib/agent/loop.ts` | Fix tool dispatch (delegate to provider), parse skill/phase annotations, track active skill |
| `lib/memory/provider.ts` | Add `select_skill` + `save_exercise_concept` tool schemas and handlers; fix `memory_search` routing |
| `lib/agent/tools.ts` | Add `handleSelectSkill`, update `compactSessionToDailyNote` to extract skill tool calls |
| `lib/agent/prompts/agents.md` | Remove old "Handling worksheet photos" section; add skill routing rule |
| `app/api/chat/route.ts` | Call `memoryProvider.initialize()`, handle `end-session` action |
| `app/page.tsx` | Persistent session ID (localStorage), unload beacon for session end |
| `types/index.ts` | Add `SkillDefinition`, `SkillName`, `SkillRecord` types; enhance `Observation` with optional `skillName`/`phase` |

### System prompt assembly (new order)

```
[soul.md] → [agents.md] → [Safety Rules] → [Skill Routing Instructions]
  → [All Skill Prompts] → [Memory (T3 + T2)] → [Tool Schemas]
```

The routing instruction block tells the LLM:

> When そうすけ sends a worksheet photo, you MUST:
> 1. Identify the subject (算数 or 国語) from the image
> 2. Call `select_skill` with the matching skill name
> 3. After the skill is activated, follow its phases IN ORDER
> 4. Record observations with the skill name attached
>
> Available skills:
> - `math_understanding`: For math worksheets — addition, subtraction, counting, numbers, shapes
>   Phases: read_problem → guide_solution → check_understanding → review_concept
> - `kokugo_understanding`: For kokugo worksheets — hiragana reading/writing, word recognition
>   Phases: read_problem → guide_practice → check_retention → review_concept

## Session Lifecycle Fix

### Current state (broken)

1. `sessionId` is regenerated on every render (`const sessionId = uuidv4()` in component body)
2. `memoryProvider.initialize()` is never called (directories may not exist on first write)
3. `onSessionEnd()` is defined but never called (no session lifecycle management)
4. `memory_search` returns hardcoded denial string (tool dispatch bypasses real implementation)
5. Tool dispatch in `loop.ts` uses a hardcoded `switch` that bypasses `memoryProvider.handleToolCall()`

### Fixes

1. **Persistent session ID**: Store in `useState` initialized from `localStorage`. Reuse if same-date, otherwise generate new. Prevents session fragmentation on refresh.

2. **Initialize on first use**: Call `await memoryProvider.initialize(kidId)` in the API route before `runAgentTurn`.

3. **Session-end beacon**: Add `beforeunload` listener in `page.tsx` that calls `navigator.sendBeacon("/api/chat", { kidId, sessionId, action: "end-session" })`. The API route reloads messages from Tier 1 JSONL and calls `memoryProvider.onSessionEnd()`.

4. **Fix tool dispatch**: Replace the hardcoded `switch` in `loop.ts` with delegation to `memoryProvider.handleToolCall(kidId, tc.name, tc.args)`. This single change fixes `memory_search`, `compact_session`, and `record_observation` simultaneously.

## Example Flows

### Math worksheet with 5 addition problems

```
Turn 1:
  Kid: [uploads photo of addition worksheet]
  LLM: [analyzes image, sees 5 single-digit addition problems]
  LLM → select_skill("math_understanding", "5 single-digit addition problems, numbers under 10")
  Tool → "Skill activated. Phases: read_problem → guide_solution → check_understanding → review_concept"
  LLM → [type:chat] お！たしざんの プリントだね。5もん あるよ。いっしょに やっていこう！さいしょの もんだいを みてみよう。3+5=？

Turn 2:
  Kid: 8！
  LLM → [type:chat][skill:math_understanding][phase:guide_solution] せいかい！ゆびで かぞえたのが いいね。つぎは 7+2=？

Turn 3:
  Kid: 9！
  LLM → [type:chat] そのとおり！3れんぞく せいかいだ！すごいね。じゃあ ちょっと むずかしく してみよう。6+4=？

... (continues through remaining problems)

Turn 5 (after all problems done):
  LLM → [type:chat][skill:math_understanding][phase:review_concept] 5もん ぜんぶ できたね！きょうは 10までの たしざんを れんしゅうしたよ。ゆびを つかって かぞえるのが とても じょうずに なったね。つぎは くりあがりの ある たしざんに チャレンジ しよう！
  LLM → save_exercise_concept({
    subject: "sansuu",
    skill: "single_digit_addition",
    proficiency: 4,
    problemsAttempted: 5,
    problemsCorrect: 5,
    notes: "Uses finger counting confidently. Ready for addition with carrying."
  })
```

### Hiragana writing worksheet

```
Turn 1:
  Kid: [uploads photo of hiragana practice sheet]
  LLM → select_skill("kokugo_understanding", "Hiragana writing practice for あいうえお")
  Tool → "Skill activated. Phases: read_problem → guide_practice → check_retention → review_concept"
  LLM → [type:chat] あっ！ひらがなの れんしゅうだね。「あ」「い」「う」「え」「お」が かいてあるよ。さいしょは「あ」から。かいてみよう！

Turn 2:
  Kid: [voice] かけた！
  LLM → [type:chat][phase:guide_practice] みせてみせて！...おお、「あ」が じょうずに かけてるね！つぎは「い」だよ。

... (kid writes い, う, え, お)

Turn 6:
  LLM → [type:chat][phase:check_retention] じゃあ、なにも みないで「あ」を かいてみよう！
  Kid: [writes あ from memory]
  LLM → すごい！ちゃんと おぼえてるね。「あ」は「あり」の「あ」だよ。つぎは「い」を かいてみて。
  LLM → record_observation("Can write あ and い from memory", "skill", "kokugo_understanding", "check_retention")

Turn 8 (end of session):
  LLM → save_exercise_concept({
    subject: "kokugo",
    skill: "hiragana_writing_あ行",
    proficiency: 3,
    problemsAttempted: 5,
    problemsCorrect: 4,
    notes: "あ and い written from memory. う hook direction still inconsistent. Ready for か行 next."
  })
```

## Extensibility

Adding a new skill requires only:

1. Create `lib/agent/prompts/skills/<skill_name>.md` with phases
2. Add an entry to the `SKILL_DEFINITIONS` array in `registry.ts`
3. Add the skill name to the `SkillName` type union in `types/index.ts`
4. Add the skill name to the `select_skill` parameter enum in `provider.ts`

No changes to the agent loop, context assembly, or memory system.

## Deferred to v2

- **Phase validation in code**: v1 relies on prompt instructions to enforce phase order. If the LLM skips phases, we tighten the prompt. Server-side validation can be added later.
- **Parent dashboard skill view**: Skill activations are logged to Tier 2 but not yet surfaced in the parent UI.
- **Mixed-subject worksheets**: v1 handles one skill per `select_skill` call. Worksheets with both math and kokugo require the LLM to pick the primary and switch skills later.
- **More skills**: The registry pattern supports arbitrary skills — science, English, etc. can be added without code changes.

## References

- [spec.md](./spec.md) — Product specification
- [decisions.md](./decisions.md) — Decision log (decisions 41-50 cover memory tiers, agent tools, system prompt)
- [memory-architecture.md](./memory-architecture.md) — Memory tiers, agent loop, compaction architecture
