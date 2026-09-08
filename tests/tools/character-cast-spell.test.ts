import { describe, it, expect, vi } from "vitest";
import { castSpell } from "../../src/tools/character.js";
import type { DdbClient } from "../../src/api/client.js";
import type { DdbCharacter } from "../../src/types/character.js";

const baseCharacter: DdbCharacter = {
  id: 123,
  readonlyUrl: "https://example.com",
  name: "Test Wizard",
  race: { fullName: "Human", baseRaceName: "Human", isHomebrew: false, racialTraits: [] },
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
  level: 5,
  background: { definition: null },
  stats: [
    { id: 1, value: 10 },
    { id: 2, value: 14 },
    { id: 3, value: 15 },
    { id: 4, value: 16 },
    { id: 5, value: 12 },
    { id: 6, value: 8 },
  ],
  bonusStats: [],
  overrideStats: [],
  modifiers: { race: [], class: [], background: [], item: [], feat: [], condition: [] },
  baseHitPoints: 40,
  bonusHitPoints: null,
  overrideHitPoints: null,
  removedHitPoints: 0,
  temporaryHitPoints: 0,
  currentXp: 6500,
  alignmentId: 1,
  lifestyleId: 1,
  currencies: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
  spells: { race: [], class: [], background: [], item: [], feat: [] },
  inventory: [],
  deathSaves: { failCount: 0, successCount: 0, isStabilized: false },
  traits: { personalityTraits: null, ideals: null, bonds: null, flaws: null, appearance: null },
  preferences: {},
  configuration: {},
  actions: {},
  feats: [],
  notes: { personalPossessions: null, backstory: null, otherNotes: null, allies: null, organizations: null },
  campaign: null,
} as unknown as DdbCharacter;

function fireballEntry(prepared: boolean) {
  return {
    id: 1,
    definition: {
      name: "Fireball",
      level: 3,
      school: "Evocation",
      description: "Boom",
      range: null,
      duration: null,
      activation: null,
      components: null,
      componentsDescription: null,
      concentration: false,
      ritual: false,
    },
    prepared,
    alwaysPrepared: false,
    usesSpellSlot: true,
  };
}

describe("castSpell — classSpells prepared filtering", () => {
  it("refuses to cast a classSpells-only spell that isn't prepared, and does not write", async () => {
    const character: DdbCharacter = {
      ...baseCharacter,
      classSpells: [{ characterClassId: 1, spells: [fireballEntry(false)] }],
      spellSlots: [{ level: 3, used: 0, available: 2 }],
    };

    const client = {
      get: vi.fn().mockResolvedValue(character),
      put: vi.fn(),
    } as unknown as DdbClient;

    const result = await castSpell(client, { characterId: 123, spellName: "Fireball" });
    const text = result.content[0].text;

    expect(text).toContain("known but not currently prepared");
    expect(client.put).not.toHaveBeenCalled();
  });

  it("still casts a classSpells-only spell that IS prepared, and writes the slot update", async () => {
    const character: DdbCharacter = {
      ...baseCharacter,
      classSpells: [{ characterClassId: 1, spells: [fireballEntry(true)] }],
      spellSlots: [{ level: 3, used: 0, available: 2 }],
    };

    const client = {
      get: vi.fn().mockResolvedValue(character),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as DdbClient;

    const result = await castSpell(client, { characterId: 123, spellName: "Fireball" });
    const text = result.content[0].text;

    expect(text).toContain("Cast Fireball at level 3");
    expect(client.put).toHaveBeenCalledTimes(1);
  });
});
