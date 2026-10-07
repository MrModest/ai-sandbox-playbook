# ai-sandbox-playbook

Ansible playbook that provisions an Ubuntu 24.04 (x86_64) VM with Claude Code, Codex and Pi, plus their plugins, skills, MCP servers and supporting CLI tools.

## Prerequisites

On the control machine:

```sh
brew install ansible        # or: pipx install ansible
ansible-galaxy collection install -r requirements.yml
```

On the target: SSH access as the user in `inventory.yml`, with sudo.

## Setup

1. Point `inventory.yml` at your VM (host and `ansible_user`).
2. Put the vault password in `.vault_pass` (gitignored; `ansible.cfg` reads it).
3. Fill the secrets: `ansible-vault edit vars/vault.yml`

   | Variable | Used for |
   |---|---|
   | `vault_become_pass` | sudo password on the VM |
   | `vault_context7_api_key` | context7 MCP |
   | `vault_github_mcp_token` | GitHub MCP |
   | `vault_hatchdoor_token` | hatchdoor MCP |
   | `vault_home_assistant_mcp_url` | Home Assistant MCP webhook URL |
   | `vault_codex_openai_api_key` | Codex `auth.json` |
   | `vault_pi_openai_api_key` | Pi `auth.json` |

## Run

```sh
ansible-playbook playbook.yml
```

Run a single role with tags: `base`, `nodejs`, `skills`, `claude`, `codex`, `pi`, `shell`. Example:

```sh
ansible-playbook playbook.yml --tags claude
```

`claude`, `codex` and `pi` need `nodejs` to have run once; `pi` also needs `base` (its MCP servers use serena and uvx).

The playbook is idempotent: a second run should report `changed=0`.

## After the first run

- Claude Code uses OAuth: SSH in, run `claude`, then `/login`. Codex and Pi use the API keys from the vault.
- Node comes from nvm, which loads only in interactive shells. Use `zsh -lic '…'` for non-interactive commands over SSH.

## Layout

| Role | Installs |
|---|---|
| `base` | apt packages (incl. `gh` from GitHub's repo), fd, yq, rtk, hl, herdr, uv, serena + rtk/herdr configs |
| `nodejs` | nvm, Node, pnpm, global npm packages (codex, gitnexus, TypeScript LSP, agent-browser + its Chrome) |
| `skills` | `~/.agents/skills`, shared by all harnesses (Codex and Pi read it natively; Claude gets a `~/.claude/skills` symlink) |
| `claude` | Claude Code, plugin marketplaces and enabled plugins, settings, `CLAUDE.md`, statusline, MCP servers |
| `codex` | ponytail plugin, `config.toml`, `auth.json` |
| `pi` | managed Pi installation, config, extensions, packages, MCP servers, `auth.json` |
| `shell` | zsh: starship (same `starship.toml` as macOS), autosuggestions, and syntax highlighting |

MCP servers are declared once in `playbook.yml` (`mcp_servers`) and rendered into each harness's own format. MCPs bundled with plugins or extensions aren't listed there.

Versions in each role's `defaults/main.yml` are minimums: a tool is installed when missing or older, and a newer one (e.g. after `pi update`) is never downgraded. Standalone binaries (rtk, hl, yq, herdr, starship, Claude Code) are only installed when missing. `node_version` is in `playbook.yml`.
