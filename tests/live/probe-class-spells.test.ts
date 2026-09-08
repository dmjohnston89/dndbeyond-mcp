import { describe, it, expect } from "vitest";
import { getLiveClient } from "./setup.js";
import { ENDPOINTS } from "../../src/api/endpoints.js";

/**
 * THROWAWAY DIAGNOSTIC — delete after use. Not part of the permanent suite.
 *
 * Answers the open question in BACKLOG.md's "Read-tool correctness" entry: does
 * D&D Beyond's character payload carry a `classSpells[]` sibling to `spells`,
 * holding the character's actual class spellcasting list? getAllSpells() reads
 * only the five `spells.*` buckets and never touches classSpells, so if it is
 * present and populated, every prepared caster's spellbook is invisible to
 * get_character, get_definition and cast_spell.
 *
 * Run against a PREPARED caster (wizard/cleric/druid) — a warlock or an
 * innate-only caster proves nothing.
 *
 *   DDB_PROBE_CHARACTER_ID=12345678 npm run test:live -- probe-class-spells
 *
 * The id is the number in the character's D&D Beyond URL:
 *   https://www.dndbeyond.com/characters/12345678
 */

const ID = Number(process.env.DDB_PROBE_CHARACTER_ID);

interface SpellEntry { definition?: { name?: string; level?: number } }
interface ClassSpellGroup { characterClassId?: number; spells?: SpellEntry[] }

describe("PROBE: does the character payload carry classSpells?", () => {
  it("reports the spell-bearing shape of one character", async () => {
    expect(
      Number.isFinite(ID),
      "Set DDB_PROBE_CHARACTER_ID to the number from the character's D&D Beyond URL",
    ).toBe(true);

    const client = await getLiveClient();
    const raw = await client.get<Record<string, unknown>>(
      ENDPOINTS.character.get(ID),
      `probe:class-spells:${ID}`,
      0,
    );

    const out: string[] = [];
    out.push(`\n=== character ${ID}: ${String(raw.name ?? "?")} ===`);
    out.push(`top-level keys: ${Object.keys(raw).sort().join(", ")}`);

    const buckets = (raw.spells ?? {}) as Record<string, SpellEntry[] | null>;
    out.push("\nspells.* buckets — the ONLY thing getAllSpells() reads:");
    let bucketTotal = 0;
    for (const k of ["race", "class", "background", "item", "feat"]) {
      const v = buckets[k];
      const n = Array.isArray(v) ? v.length : -1;
      if (n > 0) bucketTotal += n;
      out.push(`  spells.${k}: ${n < 0 ? (v === null ? "null" : "absent") : n}`);
    }
    out.push(`  -> total visible today: ${bucketTotal}`);

    const cs = raw.classSpells as ClassSpellGroup[] | undefined;
    out.push(`\nclassSpells present: ${cs !== undefined}`);
    if (Array.isArray(cs)) {
      let csTotal = 0;
      cs.forEach((g, i) => {
        const n = Array.isArray(g.spells) ? g.spells.length : 0;
        csTotal += n;
        out.push(`  [${i}] characterClassId=${g.characterClassId} spells=${n}`);
      });
      const names = cs
        .flatMap((g) => (g.spells ?? []).map((s) => s.definition?.name))
        .filter(Boolean);
      out.push(`  -> total INVISIBLE today: ${csTotal}`);
      out.push(`  sample: ${names.slice(0, 12).join(", ")}`);
      out.push(
        csTotal > 0
          ? "\nVERDICT: CONFIRMED — these spells exist in the payload and are dropped."
          : "\nVERDICT: classSpells exists but is empty for this character; try a prepared caster.",
      );
    } else {
      out.push("\nVERDICT: NOT CONFIRMED — no classSpells on this payload. The gap is elsewhere.");
    }

    console.log(out.join("\n"));
  });
});
