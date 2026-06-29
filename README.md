# dndbeyond-mcp

A TypeScript MCP (Model Context Protocol) server for D&D Beyond. Gives Claude (and other MCP-compatible AI assistants) access to your D&D Beyond characters, campaigns, spells, monsters, items, and more.

> **This is a fork** of [AlexWorland/dndbeyond-mcp](https://github.com/AlexWorland/dndbeyond-mcp). It adds **edition-aware reference lookups** (2014 vs 2024, resolved via D&D Beyond's `isLegacy` flag) for spells, conditions, and monsters, and makes **`check_auth` a real session-liveness probe**. It is the MCP backend for [dndtools](https://github.com/dmjohnston89/dndtools) and is **built from source** (not published to npm — see Installation). Released via annotated tags (current: **`v0.4.0`**); see [Fork changes](#fork-changes).

> **Disclaimer:** This project uses unofficial, reverse-engineered D&D Beyond endpoints. It is not affiliated with, endorsed by, or supported by D&D Beyond or Wizards of the Coast. Endpoints may change without notice.

## Features

- **Character Management** — Read character sheets, update HP, spell slots, death saves, currency
- **Campaign Access** — List campaigns, view party rosters
- **Reference Lookups** — Search and retrieve spells, monsters, magic items, feats, conditions, classes — **edition-aware** (2014/2024) for spells, conditions, and monsters
- **Workflow Prompts** — Session prep, encounter building, level-up guidance, spell recommendations
- **Browser-Based Auth** — Playwright-powered login flow (no manual cookie extraction)

## Installation

This fork is **not published to npm**, so `npx dndbeyond-mcp` will not work. Build it from source and check out the pinned release tag:

```bash
git clone https://github.com/dmjohnston89/dndbeyond-mcp
cd dndbeyond-mcp
git checkout v0.4.0
npm ci
npm run build
```

The built server entrypoint is `build/src/index.js`.

## Setup

Before using the server, authenticate with D&D Beyond:

```bash
npm run setup
```

This opens a browser window where you log into D&D Beyond normally. The server captures your session cookie automatically and saves it to `~/.dndbeyond-mcp/config.json`.

## Claude Desktop Configuration

Add this to your Claude Desktop configuration file, pointing at the built entrypoint (absolute path):

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dndbeyond": {
      "command": "node",
      "args": ["/abs/path/to/dndbeyond-mcp/build/src/index.js"]
    }
  }
}
```

After adding the configuration, restart Claude Desktop.

## Tools

### Character
- `get_character` — Full character sheet by ID or name
- `list_characters` — All your characters
- `update_hp` — Apply damage or healing
- `update_spell_slots` — Use or restore spell slots
- `update_death_saves` — Record death saves
- `update_currency` — Modify gold/silver/copper
- `use_ability` — Decrement limited-use features

### Campaign
- `list_campaigns` — Your active campaigns
- `get_campaign_characters` — All characters in a campaign

### Reference
- `search_spells` / `get_spell` — Spell lookup with filters; accepts an optional `edition` (`2014`/`2024`)
- `search_monsters` / `get_monster` — Monster stat blocks; `edition`-aware (collapses cross-edition duplicate names, tags other-edition-only results)
- `search_items` / `get_item` — Magic item catalog
- `search_feats` — Feat discovery
- `get_condition` — Condition rules; accepts an optional `edition` (`2014`/`2024`, default `2014`)
- `search_classes` — Class/subclass info

### Utility
- `setup_auth` — Re-run login flow
- `check_auth` — Verify the session is live (performs a real cobalt-token liveness probe against D&D Beyond, not just a config-file existence check)

## Resources

| URI | Description |
|-----|-------------|
| `dndbeyond://characters` | Your character list |
| `dndbeyond://character/{id}` | Character sheet |
| `dndbeyond://character/{id}/spells` | Spell list |
| `dndbeyond://character/{id}/inventory` | Inventory |
| `dndbeyond://campaigns` | Your campaigns |
| `dndbeyond://campaign/{id}/party` | Party roster |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `character-summary` | Full character rundown |
| `session-prep` | DM session preparation |
| `encounter-builder` | Balanced encounter design |
| `spell-advisor` | Spell recommendations |
| `level-up-guide` | Level-up walkthrough |
| `rules-lookup` | Rules clarification |

## Fork changes

Released as annotated tags (dndtools pins one by tag):

- **`v0.2.0`** — Edition-aware **conditions**: a 2024 (SRD 5.2) condition set plus an `edition` parameter on `get_condition` (default `2014`).
- **`v0.3.0`** — Edition-aware **monster search + lookup**: `search_monsters` / `get_monster` resolve the requested edition via D&D Beyond's `isLegacy` flag — preferring the selected edition, collapsing cross-edition duplicate names, and keeping/tagging other-edition-only results. Mirrors the existing `get_spell` edition handling.
- **`v0.4.0`** — `check_auth` is now a **real session-liveness probe**: it performs a cobalt-token exchange against D&D Beyond rather than only checking whether a config file exists, so callers can detect an expired-but-present cookie.

## Security

This server stores your D&D Beyond session cookie locally at `~/.dndbeyond-mcp/config.json`. The cookie provides full access to your D&D Beyond account. Never share this file. The server only communicates with `dndbeyond.com` domains.

## License

MIT
