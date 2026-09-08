# Handoff: dndbeyond-mcp v0.7.0 → dndtools integration

2026-09-08 · Cloud Claude Code session handing off to a **local** session. The
remaining work needs D&D Beyond auth and direct shell access, which the cloud
container does not have.

## Objective

Review and land SQLGuy's PR #12 to `dndbeyond-mcp` (done), then wire `dndtools`
to the reference surface it added (done). What remains is **verification** —
two live checks that were impossible from the cloud — and the follow-up work
they gate.

## Current state

**`dndbeyond-mcp`** — `main` @ `c964816`. PR #12 merged as `86aa94d`; annotated
tag `v0.7.0` points at it. 376 unit / 35 live tests pass. Branch
`claude/dndtools-pr-review-1m7kvh` (`15214e9`) carries a throwaway probe and
this document; not merged, not intended to be.

**`dndtools`** — `main` @ `e9a694b`. PRs #81, #82, #84, #85 merged: edition
threading, spell search, subclass tools, detail lookups. 687 tests pass. Pinned
to `v0.7.0`.

Every MCP reference tool is now reachable from dndtools **except**
`search_racial_traits`, which is broken upstream.

**Two verifications outstanding.** Both need local auth:

1. **Is `search_class_features` actually alive?** It 404'd on every input from
   v0.5.0 through v0.6.0. v0.7.0 rebuilt it from `classes()` + `subclasses()`,
   and its tests pass — but it has never been confirmed against the live API
   through dndtools' `/api/ddb/class-features` route.
2. **Does the character payload carry `classSpells`?** See the `BACKLOG.md`
   entry under "Read-tool correctness". `getAllSpells()` reads only the five
   `char.spells.*` buckets; `classSpells` — where a prepared caster's actual
   spellbook lives — is referenced nowhere in `src/`. If confirmed, every
   prepared caster's spell list is invisible to `get_character`,
   `get_definition` and `cast_spell`. Corroborated by the user observing
   incomplete prepared-spell lists, but **not yet confirmed against a payload**.

## Decisions (and why)

- **`get_condition` now defaults to 2024**, not 2014. The old default was a
  deliberate v0.2.0 choice that became a cross-tool trap once every entity was
  edition-aware. Breaking change, documented in the README's v0.7.0 entry.
- **Every compendium `get_*` defaults to 2024** when `edition` is omitted.
  Previously returned whatever the API listed first — frequently 2014. Found by
  behavioural testing, not code review; it survived four review rounds.
- **B3 (`defaultCampaignId` / `DDB_CAMPAIGN_ID`) deferred** to a follow-up off
  `main`. Design is *decided*, not just postponed —
  `docs/plans/2026-08-28-pr12-default-campaign-handoff.md`.
- **D7b (edition preference mechanism) deferred.** Config-driven defaults mean
  the same call returns different answers on different machines; that deserves
  its own PR. Design: `docs/design/2026-08-26-edition-preference-design.md`.
- **`list_sources`' `nameFilter` deliberately NOT wired into dndtools.**
  `/tools/sources` memoises the whole list per process, so local `?q=` filtering
  is correct; adding an unused param would repeat the dead-parameter pattern
  criticised upstream.
- **dndtools `/spells` requires at least one filter, not `q` specifically** —
  "every level 3 evocation" is a real query. Note `level=0` is falsy and must
  still count as a filter.
- **`/subclasses` requires `q` and/or `className`** — with neither, the MCP fans
  out across ~25 classes behind a 2 req/s limiter.
- **Boolean query params are validated, not coerced.** `?ritual=yes` → 400.
- **Detail routes are table-driven** (`DETAIL_LOOKUPS` in `ddb.ts`), absorbing
  `/spell/:name` and `/condition/:name`. `/monster/:name` and `/subclass/:name`
  stay explicit — they return extra fields.
- **The MCP's advisory notes are surfaced, not parsed away** (`parseSearchNotes`
  → `notes`). They exist so a partial answer doesn't read as a confident one.
- **`maxTokens: 4000` on the balance path left as-is** (user's call — no
  evidence of truncation). Revisit only if moving to `detail: "full"`.
- **Merge commits in dndbeyond-mcp history left as-is** (user's call).
- **`.claude/agents/ddb-tester.md` kept** — web-denied test subagent, reusable.

## Dead ends — do not retry

- **Stacking dndtools PRs.** #82 was based on #81, #83 on #82. GitHub retargets
  a stacked PR only when its base branch is *deleted* — #82 merged and deleted
  its branch in the same motion, so #83 merged into a branch that no longer led
  anywhere and `main` never received it. Recovered as #84. **Branch off `main`.**
- **`git checkout origin/main -- .`** to compare a working tree against main. It
  overwrites uncommitted work; the stash pop then conflicted across 7 files. Use
  a worktree, or commit first.
- **`npm ci` in dndtools while the server runs.** It wipes `node_modules` first
  and dies on a locked `esbuild.exe`, leaving a gutted tree. Stop the server first.
- **`.env` for local dndtools runs.** dndtools has **no `dotenv` dependency and
  never reads `.env`** — that file is for the Docker path only. Use real env
  vars. (The spawn-failure error message wrongly says "set (e.g. in .env)";
  fixing it was offered and not yet done.)
- **`/api/ddb/character/:name`** does not exist. `get_character` is only used
  internally by encounter-balance and the Claude prompts.
- **Validating a stale `campaignId`** (SQLGuy explored this). D&D Beyond
  silently ignores unresolvable campaign IDs — a live probe proved it and the
  refactor was dropped.
- **Single-campaign auto-detection** for a default campaign: silently stops
  applying the moment a second campaign is joined.

## Artifacts

- `BACKLOG.md` → `## Read-tool correctness` — the `classSpells` entry. **Final.**
- `tests/live/probe-class-spells.test.ts` — **throwaway**, on branch
  `claude/dndtools-pr-review-1m7kvh`. Delete after use.
- `docs/plans/2026-08-28-pr12-default-campaign-handoff.md` — B3 design, decided.
- `docs/design/2026-08-26-edition-preference-design.md` — D7b design.
- `docs/plans/2026-08-31-edition-awareness-test-plan.md` — SQLGuy's 30-test
  behavioural suite; the method that found the `pickByEdition` default bug.

## Verbatim essentials

```
Repos:    E:\Github\dndbeyond-mcp   E:\Github\dndtools
Server:   npm run serve  ->  http://0.0.0.0:8787
Env:      DNDBEYOND_MCP_COMMAND=node
          DNDBEYOND_MCP_ARGS=E:/Github/dndbeyond-mcp/build/src/index.js
          (real env vars — .env is NOT read; path must not contain spaces,
           ARGS is split on whitespace)
Probe:    $env:DDB_PROBE_CHARACTER_ID="<id from the DDB character URL>"
          npm run test:live -- probe-class-spells
Check 1:  Invoke-RestMethod 'http://localhost:8787/api/ddb/class-features?q=rage&className=Barbarian'
```

- Error string, exact: `'edition' must be 2014 or 2024.`
- Flaky test (pre-existing, unrelated): `deleteSummariesForBook removes only the
  matching book's summaries` — ~1 in 3 full-suite runs, passes in isolation.
  Looks like shared tmp state between parallel test files.
- dndtools model `claude-opus-4-8`: $5/MTok in, $25/MTok out. `detail: "full"`
  ≈ 15–30KB per character.
- `~/.dndbeyond-mcp/config.json` holds the `CobaltSession` — full account
  access, default file permissions, whole cookie jar. Tracked in `BACKLOG.md`
  and a bigger real risk than any npm advisory in either repo.

## Working preferences

- **Windows / PowerShell.** No Unix commands — `head`, `curl -s` etc. fail;
  `curl` is an alias for `Invoke-WebRequest`, use `curl.exe` for real curl.
- **Use lower-tier subagents where appropriate** — stated as a standing habit.
- **Ask them to decide named items** rather than assuming; they answer directly
  and expect the question to change what happens next.
- **PRs for dndtools changes**, not direct merges to `main`.
- Wants claims verified by running things, not asserted. Regression-check new
  tests by deliberately breaking the code they cover.

## Open items

**Next step:** run the two verifications above. Everything else waits on them.

**Then:**
- If `classSpells` is confirmed: fix `getAllSpells()`, add `classSpells` to
  `DdbCharacter`, regression-test with a fixture where a spell exists *only*
  there. Note this grows `detail: "full"` output.
- Balance-path measurement: `count_tokens` on a real balance request at `sheet`
  vs `full`. dndtools already has prompt-caching infrastructure
  (`anthropic.ts:139`) that the balance path does **not** use — party sheets sit
  in the volatile prompt position and are re-paid on every read. Caching them
  likely beats trimming.
- `mcpSpawnErrorMessage` fix (the misleading `.env` advice).

**Blocked:** `/ddb/racial-traits` — dead until SQLGuy's reverted fix (commit
`7756cc2` in dndbeyond-mcp, reverted by `a7d8a20`) is resurrected. Reverting was
correct scope discipline; the work exists and should be recovered, not rebuilt.

**Unresolved — the user has not answered these:**
- **UI.** Four PRs shipped typed `web/src/api.ts` bindings and zero UI
  components. Spell search, subclass lookup and the detail lookups are
  unreachable from the actual app. Deliberate, or a gap?
- **Who takes B3 / D7b / racial-traits** — SQLGuy was offered first refusal in
  the PR #12 merge comment and has not replied.
- **The flaky test** — fix, file, or leave?
- **A CLI `spells` subcommand** — raised in #82. The existing `spell` command is
  a character-contextualised Claude lookup, which is a different job.
