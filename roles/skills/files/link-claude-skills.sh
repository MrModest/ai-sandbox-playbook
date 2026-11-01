#!/usr/bin/env bash
set -euo pipefail
src="$HOME/.agents/skills"
dst="$HOME/.claude/skills"
mkdir -p "$dst"

for d in "$src"/*/; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  [ "$name" = "synced" ] && continue
  if [ -e "$dst/$name" ] && [ ! -L "$dst/$name" ]; then
    echo "skip $name: real directory exists in $dst" >&2
    continue
  fi
  ln -sfn "$src/$name" "$dst/$name"
done

# prune links whose target was removed
for l in "$dst"/*; do
  if [ -L "$l" ] && [ ! -e "$l" ]; then rm "$l"; fi
done
