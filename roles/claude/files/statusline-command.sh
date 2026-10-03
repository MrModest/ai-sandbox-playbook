#!/usr/bin/env bash
# Claude Code status line — 3-row layout
#
# Row 1: ~/D/P/reisenotiz (main +1056 -647) | Sonnet 4.6 [xhigh] | ctx:10% (20k)
# Row 2: current ○○○○○○○○○○ 2% ↻ 4hr 53min
# Row 3: weekly  ●○○○○○○○○○ 9% ↻ sun 10:00am

input=$(cat)

# ── Raw fields ────────────────────────────────────────────────────────────────
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
effort=$(echo "$input" | jq -r '.effort.level // empty')
# Fall back to settings.json effortLevel if JSON doesn't carry it
if [ -z "$effort" ]; then
  effort=$(jq -r '.effortLevel // empty' "$HOME/.claude/settings.json" 2>/dev/null)
fi

used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
ctx_window_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
used_tokens=$(echo "$input" | jq -r '
  .context_window.current_usage |
  if . then
    (.input_tokens // 0) + (.output_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)
  else empty end')

five_hour_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_hour_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_day_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
seven_day_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# ── ANSI color constants ──────────────────────────────────────────────────────
RESET=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
WHITE=$'\033[0m'          # default terminal color (white in dark themes)
CYAN=$'\033[36m'
GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
DIM_GRAY=$'\033[2;37m'

# ── Starship-style path abbreviation ─────────────────────────────────────────
# Each parent dir compressed to first letter; last segment kept full.
# e.g. /Users/me/Projects/reisenotiz → ~/P/reisenotiz
starship_path() {
  local full="$1"
  local home="$HOME"
  # Replace $HOME prefix with ~
  local p="$full"
  [[ "$full" == "$home"* ]] && p="~${full#"$home"}"
  # Split into segments
  IFS='/' read -ra segs <<< "$p"
  local count="${#segs[@]}"
  if [ "$count" -le 2 ]; then
    echo "$p"
    return
  fi
  local result=""
  local i
  for (( i=0; i<count-1; i++ )); do
    local seg="${segs[$i]}"
    if [ -z "$seg" ]; then
      # leading slash / empty (shouldn't happen after ~ substitution)
      result+="/"
    elif [ "$seg" = "~" ]; then
      result+="~"
    else
      # Abbreviate to first character
      result+="${seg:0:1}"
    fi
    result+="/"
  done
  result+="${segs[$((count-1))]}"
  echo "$result"
}

short_path=""
[ -n "$cwd" ] && short_path=$(starship_path "$cwd")

# ── Git branch + diff stats ───────────────────────────────────────────────────
git_branch=""
git_added=""
git_removed=""
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null \
    || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  if [ -n "$git_branch" ]; then
    diff_stat=$(git -C "$cwd" diff --shortstat --no-optional-locks 2>/dev/null)
    git_added=$(echo "$diff_stat" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+')
    git_removed=$(echo "$diff_stat" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+')
  fi
fi

# ── Helper: dot bar (10 dots) ─────────────────────────────────────────────────
dot_bar() {
  local pct_int="$1"
  local filled=$(( (pct_int + 5) / 10 ))
  [ "$filled" -gt 10 ] && filled=10
  local empty=$(( 10 - filled ))
  # Pick filled-dot color based on usage threshold
  local dot_color
  if [ "$pct_int" -lt 50 ]; then
    dot_color="$GREEN"
  elif [ "$pct_int" -le 80 ]; then
    dot_color="$YELLOW"
  else
    dot_color="$RED"
  fi
  local bar="" i
  for (( i=0; i<filled; i++ )); do bar+="${dot_color}●${RESET}"; done
  for (( i=0; i<empty;  i++ )); do bar+="${DIM_GRAY}○${RESET}"; done
  printf '%b' "$bar"
}

# ── Helper: time remaining until unix timestamp ───────────────────────────────
format_time_remaining() {
  local reset_ts="$1"
  [ -z "$reset_ts" ] || [ "$reset_ts" = "null" ] && return
  local now secs hrs mins
  now=$(date +%s)
  secs=$(( reset_ts - now ))
  [ "$secs" -le 0 ] && { printf 'now'; return; }
  hrs=$(( secs / 3600 ))
  mins=$(( (secs % 3600) / 60 ))
  if [ "$hrs" -gt 0 ]; then
    printf '%dhr %dmin' "$hrs" "$mins"
  else
    printf '%dmin' "$mins"
  fi
}

# ── Helper: day+time for 7-day reset ─────────────────────────────────────────
format_day_reset() {
  local reset_ts="$1"
  [ -z "$reset_ts" ] || [ "$reset_ts" = "null" ] && return
  date -d "@$reset_ts" "+%a %H:%M" 2>/dev/null \
    | tr '[:upper:]' '[:lower:]'
}

# ── Helper: format token count as Xk ─────────────────────────────────────────
fmt_tokens() {
  local n="$1"
  if [ "$n" -ge 1000 ] 2>/dev/null; then
    awk "BEGIN {printf \"%.0fk\", $n/1000}"
  else
    printf '%s' "$n"
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# ROW 1: path (git info) | Model [effort] | ctx:X% (Yk)
# ═════════════════════════════════════════════════════════════════════════════
row1=""
DIM_SEP="${DIM}|${RESET}"

# Path segment
if [ -n "$short_path" ]; then
  row1+="${BOLD}${short_path}${RESET}"
fi

# Git segment
if [ -n "$git_branch" ]; then
  git_seg="${CYAN}${git_branch}${RESET}"
  if [ -n "$git_added" ] || [ -n "$git_removed" ]; then
    git_seg+=" ${GREEN}+${git_added:-0}${RESET} ${RED}-${git_removed:-0}${RESET}"
  fi
  row1+=" (${git_seg})"
fi

# Model + effort
if [ -n "$model" ]; then
  model_seg="${CYAN}${model}${RESET}"
  if [ -n "$effort" ]; then
    if [ "$effort" = "xhigh" ]; then
      model_seg+=" ${YELLOW}[${effort}]${RESET}"
    else
      model_seg+=" [${effort}]"
    fi
  fi
  row1+=" ${DIM_SEP} ${model_seg}"
fi

# Context
if [ -n "$used_pct" ]; then
  pct=$(printf '%.0f' "$used_pct")
  ctx_seg="${DIM}ctx:${RESET}${pct}%"
  if [ -n "$used_tokens" ]; then
    tok_fmt=$(fmt_tokens "$used_tokens")
    ctx_seg+=" (${tok_fmt})"
  elif [ -n "$ctx_window_size" ]; then
    # Fallback: show window size if no per-call usage yet
    tok_fmt=$(fmt_tokens "$ctx_window_size")
    ctx_seg+=" (${tok_fmt})"
  fi
  row1+=" ${DIM_SEP} ${ctx_seg}"
fi

# ═════════════════════════════════════════════════════════════════════════════
# ROW 2: current ○…○ X% ↻ Xhr Ymin   | extra usage: on/off | balance: €Z
# ═════════════════════════════════════════════════════════════════════════════
row2=""

if [ -n "$five_hour_pct" ]; then
  pct_int=$(printf '%.0f' "$five_hour_pct")
  bar=$(dot_bar "$pct_int")
  time_left=$(format_time_remaining "$five_hour_reset")
  pct_fmt=$(printf '%3d%%' "$pct_int")
  row2="${DIM}current${RESET} ${bar} ${pct_fmt}"
  [ -n "$time_left" ] && row2+=" ${DIM}↻${RESET} ${time_left}"
fi

# ═════════════════════════════════════════════════════════════════════════════
# ROW 3: weekly  ●…○ X% ↻ day HH:MMam
# ═════════════════════════════════════════════════════════════════════════════
row3=""

if [ -n "$seven_day_pct" ]; then
  pct_int=$(printf '%.0f' "$seven_day_pct")
  bar=$(dot_bar "$pct_int")
  day_reset=$(format_day_reset "$seven_day_reset")
  pct_fmt=$(printf '%3d%%' "$pct_int")
  row3="${DIM}weekly${RESET}  ${bar} ${pct_fmt}"
  [ -n "$day_reset" ] && row3+=" ${DIM}↻${RESET} ${day_reset}"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Output — join non-empty rows with newlines
# ═════════════════════════════════════════════════════════════════════════════
out=""
for row in "$row1" "$row2" "$row3"; do
  [ -z "$row" ] && continue
  [ -n "$out" ] && out+=$'\n'
  out+="$row"
done

printf '%s' "$out"
