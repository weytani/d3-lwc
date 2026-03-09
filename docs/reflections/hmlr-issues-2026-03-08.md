# HMLR Memory System — Issue Analysis (2026-03-08)

## Symptoms

1. **Duplicate facts accumulating**: ~60 entries in Known Facts that represent ~8 unique facts. The "D3 LWC Phase 2 components" fact appears 8+ times. The "CLAUDECODE env var stripping" fact appears 15+ times.

2. **FactScrubber not deduplicating on ingest**: Each `mem_add` call creates new facts even when semantically identical facts already exist. The scrubber should be detecting and merging these.

3. **`mem_garden` failing silently**: The gardener tool (designed for maintenance/consolidation) was rejected — unclear if this is a permissions issue (same as `mem_add` was) or an internal error. Need to test with proper permissions.

4. **`mem_add` required explicit permission whitelisting**: The tool was being silently rejected because it wasn't in `settings.local.json` allow list. Fixed by adding all `mcp__hmlr-memory__*` tools to the d3-lwc project allow list. **This fix may need to be applied to other projects too.**

5. **Repeated ingestion from retries**: When `mem_add` fails (permission rejection), the user retries, and if the tool eventually succeeds, prior partial ingestions may have already created facts. 14 submissions of the same reflection were counted.

## Root Causes to Investigate

### A. FactScrubber Dedup Logic (`~/code/hmlr-memory`)

The FactScrubber should:
- Compare incoming facts against existing facts using embedding similarity
- Merge/supersede duplicates instead of creating new entries
- Have a similarity threshold for "same fact" detection

**Questions:**
- Is the similarity threshold too high (requiring near-exact match)?
- Is dedup running at all during `mem_add`? Or only during `mem_garden`?
- Are embeddings being generated correctly for comparison?

### B. Gardener Reliability

`mem_garden` is the consolidation pass that should:
- Find duplicate/near-duplicate facts
- Merge them into single canonical entries
- Prune superseded facts

**Questions:**
- Is it erroring internally (check logs at `~/.hmlr/`)?
- Does it need the LLM provider to be working? (`claude-cli` provider shells out to `claude` binary — nested Claude sessions have the `CLAUDECODE` env var issue)
- Is the gardener hitting the CLAUDECODE blocking issue documented in MEMORY.md?

### C. Permission Propagation

The `settings.local.json` fix was applied only to `~/code/d3-lwc/.claude/settings.local.json`. Other projects that use HMLR will have the same silent rejection problem.

**Projects to check:**
- `~/code/agentforce-dev/.claude/settings.local.json`
- `~/code/hmlr-memory/.claude/settings.local.json`
- Any other project with a `.claude/settings.local.json` that has an explicit allow list

## Recommended Actions

### Immediate (next session at desk)

1. **Check HMLR logs**: `ls -la ~/.hmlr/` — look for error logs from gardener runs
2. **Test gardener in hmlr-memory project**: `cd ~/code/hmlr-memory && claude` then run `mem_garden` directly
3. **Check if CLAUDECODE env stripping works**: The gardener uses the `claude-cli` provider which needs `env -u CLAUDECODE claude` — verify this path works
4. **Propagate permissions**: Add HMLR tools to allow lists in all active projects

### Short-term (hmlr-memory codebase)

5. **Audit FactScrubber dedup**: Read the dedup logic in the ingestion pipeline — is it comparing embeddings? What's the threshold?
6. **Add dedup-on-ingest**: If dedup only runs during gardening, add a pre-ingest check that queries existing facts by embedding similarity before creating new ones
7. **Manual cleanup**: Run gardener successfully once to consolidate the ~60 → ~8 facts

### Medium-term

8. **Add idempotency to `mem_add`**: Hash the input text and skip if an identical hash exists
9. **Rate-limit repeated submissions**: If the same text is submitted within N minutes, skip silently
10. **Gardener scheduling**: The `com.weytani.claude-docs-audit.plist` runs weekly — consider a similar launchd plist for `mem_garden`

## Files Referenced

- HMLR project: `~/code/hmlr-memory/` (branch: `develop`)
- HMLR DB: `~/.hmlr/memory.db`
- Embedding model: `BAAI/bge-small-en-v1.5` (local_files_only=True)
- Provider: `claude-cli` (shells out to `claude` binary)
- d3-lwc permissions fix: `~/code/d3-lwc/.claude/settings.local.json`
