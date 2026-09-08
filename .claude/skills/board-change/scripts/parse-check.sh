#!/bin/sh
# Parse-check index.html's script block with JavaScriptCore (Node is not installed).
# Wrapping in `new Function` compiles without executing, so DOM references are harmless.
# Usage: parse-check.sh [path/to/index.html]
set -e
HTML="${1:-index.html}"
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
sh "$DIR/extract-js.sh" "$HTML" > "$T/app.js"
[ -s "$T/app.js" ] && echo "extracted $(wc -l < "$T/app.js" | tr -d ' ') lines" || { echo "ERROR: empty extraction — did the <script> tag move off column 0?"; exit 1; }
printf 'try { new Function(readFile("%s/app.js")); print("PARSE OK"); } catch (e) { print("PARSE ERROR: " + e); }\n' "$T" > "$T/check.js"
"$JSC" "$T/check.js"
