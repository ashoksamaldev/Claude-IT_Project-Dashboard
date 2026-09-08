#!/bin/sh
# Extract index.html's script block and run it under the fake-DOM harness.
# Usage: run-harness.sh [path/to/index.html] [path/to/assertions.js]
set -e
HTML="${1:-index.html}"
TESTS="$2"
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
sh "$DIR/extract-js.sh" "$HTML" > "$T/app.js"
[ -s "$T/app.js" ] || { echo "ERROR: empty extraction from $HTML"; exit 1; }
if [ -n "$TESTS" ]; then
  "$JSC" "$DIR/harness.js" -- "$T/app.js" "$(CDPATH= cd -- "$(dirname -- "$TESTS")" && pwd)/$(basename -- "$TESTS")"
else
  "$JSC" "$DIR/harness.js" -- "$T/app.js"
fi
