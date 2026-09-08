# classSpells Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `get_character` (and everything downstream of it) from silently dropping a prepared caster's class spellcasting list.

**Architecture:** D&D Beyond's character payload carries a `classSpells[]` array sibling to `spells` — one group per class, each holding the class's full known/learnable spell list with the same per-entry shape (`definition`, `prepared`, `alwaysPrepared`, `usesSpellSlot`, etc.) as the existing `spells.*` buckets. `getAllSpells()` in `src/tools/character.ts` is the single choke point every spell-reading code path goes through (`formatSpells`, `formatSpellcasting`, `searchDefinitions`, `formatCharacterFull`, `castSpell`'s resolution — 5 call sites, all via this one function). Add `classSpells` to the `DdbCharacter` type and flatten it into `getAllSpells()`'s existing concat, and every downstream consumer is fixed for free.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- This was confirmed against the live API on 2026-09-07 against character `168201367`: `classSpells` held 39 spells invisible to `getAllSpells()` today, 16 of them with `prepared: true` (Magic Missile, Shield, Fireball, Counterspell, etc.) — i.e. real prepared spells a wizard player would expect to see, not just spellbook noise.
- `classSpells` groups look like `{ characterClassId: number, spells: DdbSpell[] }` — confirmed live; each spell entry is structurally a `DdbSpell` (same `definition`/`prepared`/`alwaysPrepared`/`usesSpellSlot` fields already declared on that interface, plus extra fields TypeScript will ignore under structural typing).
- Keep `classSpells` **optional** on `DdbCharacter` (`classSpells?: DdbClassSpellGroup[]`) — dozens of existing test fixtures across `tests/tools/*.test.ts` and `tests/resources/character.test.ts` construct `DdbCharacter` objects without it, and this fix must not force edits to every one of them.
- Don't deduplicate against the existing `spells.*` buckets. The existing code already doesn't dedupe *across* those five buckets, and no overlap was observed in the live probe — matching that existing (lack of) behavior is correct scope; deduplication is a separate concern nobody has asked for.
- Run `npm test` (unit suite only — `tests/live/**` is excluded by `vitest.config.ts`) before every commit in this plan.

---

### Task 1: Flatten `classSpells` into `getAllSpells()`

**Files:**
- Modify: `src/types/character.ts:1-43` (add `DdbClassSpellGroup`, add `classSpells` field to `DdbCharacter`)
- Modify: `src/tools/character.ts:97-105` (`getAllSpells`)
- Test: `tests/tools/character-ac-spells.test.ts` (new test)

**Interfaces:**
- Produces: `DdbClassSpellGroup` (exported from `src/types/character.ts`): `{ characterClassId: number; spells: DdbSpell[] | null }`
- Produces: `DdbCharacter.classSpells?: DdbClassSpellGroup[]`
- Consumes: existing `DdbSpell` and `DdbCharacter` from `src/types/character.ts`; existing `getCharacter` from `src/tools/character.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tools/character-ac-spells.test.ts` (append a new `describe` block at the end of the file, after the existing `describe("Spell Save DC Calculation", ...)` block):

```typescript
describe("classSpells flattening", () => {
  it("surfaces a prepared spell that exists only in classSpells, not in any spells.* bucket", async () => {
    const character: DdbCharacter = {
      ...baseCharacter,
      classes: [
        {
          id: 1,
          definition: { name: "Wizard" },
          subclassDefinition: null,
          level: 5,
          isStartingClass: true,
          classFeatures: [],
        },
      ],
      inventory: [],
      modifiers: { race: [], class: [], background: [], item: [], feat: [], condition: [] },
      spells: {
        race: [],
        class: [],
        background: [],
        item: [],
        feat: [],
      },
      classSpells: [
        {
          characterClassId: 1,
          spells: [
            {
              id: 1,
              definition: {
                name: "Counterspell",
                level: 3,
                school: "Abjuration",
                description: "Interrupts another spellcaster",
                range: null,
                duration: null,
                activation: null,
                components: null,
                componentsDescription: null,
                concentration: false,
                ritual: false,
              },
              prepared: true,
              alwaysPrepared: false,
              usesSpellSlot: true,
            },
          ],
        },
      ],
    };

    const client = createMockClient();
    vi.mocked(client.get).mockResolvedValue(character);

    const result = await getCharacter(client, { characterId: 12345, detail: "sheet" });
    const text = result.content[0].text;

    expect(text).toContain("Counterspell");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- character-ac-spells -t "classSpells flattening"`
Expected: FAIL — `text` does not contain "Counterspell" (the spell is present on the fixture's `classSpells` but `getAllSpells()` never reads that field, so it's absent from the "Prepared Spells" output).

- [ ] **Step 3: Add the type**

In `src/types/character.ts`, add `classSpells?: DdbClassSpellGroup[];` to the `DdbCharacter` interface, right after the existing `hitDiceUsed?: number;` line (the last field, line 42):

```typescript
  hitDiceUsed?: number;
  classSpells?: DdbClassSpellGroup[];
}
```

Then add the new interface immediately after the `DdbSpellsContainer` interface (after line 93, before `export interface DdbSpell {`):

```typescript
export interface DdbClassSpellGroup {
  characterClassId: number;
  spells: DdbSpell[] | null;
}
```

(`DdbSpell` is declared just below `DdbSpellsContainer` in this file already — since both interfaces live in the same module, declaration order doesn't matter for TypeScript, but keep `DdbClassSpellGroup` directly above `DdbSpell` since it references it, for readability.)

- [ ] **Step 4: Flatten it in `getAllSpells()`**

In `src/tools/character.ts`, change:

```typescript
function getAllSpells(char: DdbCharacter): DdbSpell[] {
  return [
    ...(char.spells.class ?? []),
    ...(char.spells.race ?? []),
    ...(char.spells.background ?? []),
    ...(char.spells.item ?? []),
    ...(char.spells.feat ?? []),
  ];
}
```

to:

```typescript
function getAllSpells(char: DdbCharacter): DdbSpell[] {
  return [
    ...(char.spells.class ?? []),
    ...(char.spells.race ?? []),
    ...(char.spells.background ?? []),
    ...(char.spells.item ?? []),
    ...(char.spells.feat ?? []),
    ...(char.classSpells ?? []).flatMap((group) => group.spells ?? []),
  ];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- character-ac-spells -t "classSpells flattening"`
Expected: PASS

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: PASS — all existing tests still pass (no fixture in the existing suite sets `classSpells`, so `char.classSpells ?? []` is `[]` for every one of them; behavior for every existing test is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/types/character.ts src/tools/character.ts tests/tools/character-ac-spells.test.ts
git commit -m "fix: flatten classSpells into getAllSpells (get_character was dropping prepared casters' spellbooks)

Confirmed live against character 168201367: classSpells held 39 spells
invisible to getAllSpells(), 16 of them prepared (Magic Missile, Shield,
Fireball, Counterspell, etc). getAllSpells() is the single choke point
for formatSpells, formatSpellcasting, searchDefinitions,
formatCharacterFull, and castSpell's resolution, so flattening it there
fixes all five call sites at once.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Cleanup — remove the throwaway probe and close out the BACKLOG entry

**Files:**
- Delete: `tests/live/probe-class-spells.test.ts`
- Modify: `BACKLOG.md` (remove the now-fixed "Read-tool correctness" section)

**Interfaces:**
- None (docs/cleanup only, no code interfaces).

- [ ] **Step 1: Delete the throwaway diagnostic**

The test file's own header says "THROWAWAY DIAGNOSTIC — delete after use. Not part of the permanent suite." It answered its question (yes, confirmed) and Task 1 added a permanent regression test in its place.

```bash
git rm tests/live/probe-class-spells.test.ts
```

- [ ] **Step 2: Remove the fixed entry from BACKLOG.md**

Read the current `BACKLOG.md` to get exact surrounding text (the entry may have shifted slightly), then remove the entire `## Read-tool correctness` section — it currently contains exactly one bullet (the `get_character` omits class spellcasting lists entry), and that's the one just fixed. Also bump the `**Last updated:**` line at the top to today's date.

Before (section to remove entirely, including its heading):

```markdown
## Read-tool correctness

- **`get_character` omits class spellcasting lists** (`src/tools/character.ts` `getAllSpells`, `:97`;
  `src/types/character.ts` `DdbSpellsContainer`, `:87`) *(found 2026-09-06)* — ...
  [... full existing bullet text ...]
```

After: delete that whole section (heading + bullet), leaving `## Resilience correctness` followed directly by `## Write-tool safety`.

Also update line 3:

```markdown
**Last updated:** 2026-09-06
```

to:

```markdown
**Last updated:** 2026-09-07
```

- [ ] **Step 3: Run the full unit suite one more time**

Run: `npm test`
Expected: PASS (deleting a `tests/live/` file and editing `BACKLOG.md` don't touch anything `npm test` exercises, but confirm nothing else was mid-edit).

- [ ] **Step 4: Commit**

```bash
git add tests/live/probe-class-spells.test.ts BACKLOG.md
git commit -m "docs: close out classSpells backlog entry, drop throwaway probe

The probe confirmed the gap live and a permanent regression test now
covers it (previous commit), so both the diagnostic and the backlog
entry it was tracking are done.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** BACKLOG.md's fix description had three parts — (1) add `classSpells` to `DdbCharacter`, (2) flatten into `getAllSpells()`, (3) add a fixture where a spell exists only in `classSpells`. All three are Task 1. The backlog entry's closing note ("Consumers sizing prompts against `detail: "full"` should re-measure after this lands — it will grow substantially") is an observation for prompt-budget tuning elsewhere, not a code change this fix needs to make — noted here so it isn't silently dropped, but out of scope for this plan.
- **Placeholder scan:** none found — every step has literal code/commands.
- **Type consistency:** `DdbClassSpellGroup` is defined once in Task 1 Step 3 and consumed identically in Task 1 Step 1's test fixture and Step 4's implementation; no naming drift.
