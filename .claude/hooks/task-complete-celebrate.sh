#!/bin/bash
# Stop hook: celebrate a finished task with a macOS dialog and an optional
# WhatsApp share. Wired up in .claude/settings.json.
#
# Claude Code passes the hook event as JSON on stdin. We only need two things
# from it: stop_hook_active (to avoid re-firing when a Stop hook itself
# continued the session) and cwd (to name the project in the message).
#
# The dialog is shown by a detached child process so the hook returns
# immediately: a Stop hook that blocks on user input would sit against the
# hook timeout while the dialog waits, and Claude Code would look hung.

set -u

# GUI dialogs are macOS-only. Anywhere else this is a no-op, not a failure.
[ "$(uname -s)" = "Darwin" ] || exit 0
command -v osascript >/dev/null 2>&1 || exit 0

payload=$(cat)

# Minimal JSON reads - jq is not a dependency of this project.
case "$payload" in
  *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;;
esac

project="${CLAUDE_PROJECT_DIR:-$PWD}"
project_name=$(basename "$project")

# Percent-encode stdin byte by byte, so UTF-8 (emoji included) survives.
urlencode() {
  printf '%s' "$1" | od -An -tx1 -v | tr ' ' '\n' | while read -r h; do
    [ -z "$h" ] && continue
    case "$h" in
      3[0-9]|4[1-9]|4[a-f]|5[0-9]|5a|6[1-9]|6[a-f]|7[0-9]|7a|2d|2e|5f|7e)
        printf '%b' "\\x$h" ;;
      *)
        printf '%%%s' "$h" ;;
    esac
  done
}

celebrate() {
  # AppleScript string literals: escape backslash first, then the quote.
  esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

  local title="Task complete"
  local heading="Congratulations! You finished a task on ${project_name}."

  local m1="Congratulations! Just wrapped up a task on ${project_name}."
  local m2="Another one done on ${project_name}. The board is moving."
  local m3="Task complete on ${project_name} - shipped and verified."
  local m4="Milestone reached on ${project_name}. Thanks for the push!"
  local m5="Done and dusted on ${project_name}."

  local choice
  choice=$(osascript <<APPLESCRIPT 2>/dev/null
display dialog "$(esc "$heading")" with title "$(esc "$title")" buttons {"Close", "Share on WhatsApp"} default button "Share on WhatsApp" with icon note
if button returned of result is "Share on WhatsApp" then
  set theMessages to {"$(esc "$m1")", "$(esc "$m2")", "$(esc "$m3")", "$(esc "$m4")", "$(esc "$m5")"}
  set picked to choose from list theMessages with title "$(esc "$title")" with prompt "Pick a message to share:" default items {item 1 of theMessages} OK button name "Share" cancel button name "Cancel"
  if picked is not false then
    return item 1 of picked
  end if
end if
return ""
APPLESCRIPT
)

  [ -n "$choice" ] || return 0
  open "https://wa.me/?text=$(urlencode "$choice")"
}

celebrate >/dev/null 2>&1 &
disown 2>/dev/null

exit 0
