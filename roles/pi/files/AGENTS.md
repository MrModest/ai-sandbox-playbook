# Global Instructions

## Bash tools

- Use `fd` instead of `find` and `rg` instead of `grep`.
- I have `jq` and `yq` installed. Use them to work with JSON and YAML files.
- Additional cli tools available to you: `gh` for GitHub, `hl` for JSON log view.

## MCPs available
- `serena` — semantic code navigation/editing for current workspace: symbol overview, references, implementations, diagnostics, safe renames/deletes, project memories. If scope includes multiple repositories or search outside current repo, use `gitnexus` instead.
- `gitnexus` — indexed-repo code graph search, symbol context, API/tool maps, and impact analysis.

## GitNexus (global rules)

**Important:** Prefer `gitnexus` MCP tools over `fd`/`rg` for broad code search, symbol discovery, cross-repo lookup, impact analysis, and execution-flow questions when the target repo is indexed. Direct `read` is fine when an exact file/path is already known.

- You are able to search in different repos, not only the current one.
- Call `gitnexus_list_repos()` to see all available repos for search.
- Always pass `repo:` when targeting a specific repo.
- Run `gitnexus_impact` before editing any symbol; warn user on HIGH/CRITICAL risk.
