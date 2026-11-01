# Global Instructions

## Local tools

- Use `fd` instead of `find` and `rg` instead of `grep`.
- `jq` and `yq` are installed. Prefer structured queries for large JSON/YAML files; read small files directly when clearer.
- Additional CLI tools: `gh` for GitHub, `hl` for viewing JSON logs.

## Code navigation and impact

- Use `serena` for semantic navigation and editing within the current workspace.
- Start with `gitnexus` for broad code discovery, execution-flow questions, and cross-repository lookup when the target repositories are indexed. Use `fd`/`rg` for known paths and focused text searches.
- Discover indexed repositories with `gitnexus_list_repos()` when the target or index availability is unknown; reuse that information during the task. Pass `repo` explicitly for repository-scoped queries.
- Before changing shared behavior, signatures, exports, cross-repository contracts, or renaming/deleting symbols, use `gitnexus_impact` to inspect dependents. Also use it when callers or blast radius are unclear. Isolated implementation edits do not require a graph check by default.
- Warn the user before edits with HIGH/CRITICAL impact. Treat UNKNOWN, stale, or incomplete results as missing evidence, not proof of safety.
- When an index or semantic tool is unavailable or insufficient, inspect source and references with local tools and run relevant checks. Report material uncertainty; do not let optional tooling block work that can be verified locally.

## Scope and verification

- For review, explanation, diagnosis, or planning requests, inspect and report; implement changes only when requested.
- For requested changes, carry out in-scope local edits and relevant non-destructive validation. Ask when an ambiguity materially changes the outcome; resolve routine details from available context.
- Get authorization before destructive actions, external writes, purchases, or material scope expansion unless already explicitly authorized. Durable memory writes follow the policy below.
- Run checks appropriate to the change and report what ran, results, and anything unverified. Broaden or repeat checks when failures, further changes, or unresolved risks justify it.

## Human-readable writing

- Use the `humanise` skill whenever drafting or revising text intended for human readers, including reports, commit messages, PR titles and descriptions, documentation, reviews, emails, and user-facing responses. Apply it before sharing, saving, or publishing the text.
- Preserve factual claims, uncertainty, technical terms, quotations, and required formats. Apply the skill to prose without changing code, commands, or machine-readable data.

## Durable memory

`hatchdoor` is the cross-session knowledge vault: reusable domain knowledge, decisions, and guides.

### Retrieval

Search when missing historical or private context could materially change the answer:

- The user asks to continue earlier work or recall a prior discussion or decision.
- The task depends on prior conventions, preferences, architecture, or incident history.
- A recurring failure or high-impact change may have relevant lessons or constraints, especially in deployment, databases, auth, payments, infrastructure, or memory systems.

Reuse relevant context already loaded. A task merely mentioning an existing project or tool does not by itself require a vault search.

Use `search_notes` for content questions, `query_notes` for tag/path/frontmatter selection, and `get_note_links` for backlinks. Prefer the relevant vault and `space/` tag when known; use tag-capable queries for space filtering. A vault `scope` is not a `space/` tag. Broaden retrieval when the appropriate space is unknown or initial results are insufficient.

If memory is unavailable, continue from current evidence when possible and disclose any missing history that could affect the result.

### Writing

- At the end of substantial work, consider saving facts that would prevent rediscovery: validated gotchas, decisions and rationale, reusable workflows, architecture, or recurring preferences. Skip routine progress and facts already covered.
- Before creating, updating, or reorganising a note, read `Meta/Vault-Conventions`. It is the authority for folders, tags, frontmatter, scope, and linking; keep those mechanics there rather than duplicating them here. If unavailable, defer the write.
- Search for an existing note before creating one; extend the relevant note instead of duplicating it.
- Store durable knowledge only. Exclude secrets, credentials, raw personal data, and transient task state. Mark inferences explicitly rather than recording them as established facts.
