#!/bin/sh
# Extract the single <script> block of index.html to stdout as plain JS.
# Usage: extract-js.sh [path/to/index.html]
HTML="${1:-index.html}"
awk '/^<script>/{f=1;next} /^<\/script>/{f=0} f' "$HTML"
