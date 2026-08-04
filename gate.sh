#!/bin/bash
# Corrected baseline gate — spec-mockup-engine v2 Step 5
# FIX vs the handoff version: the original computed `pre` inside a command
# substitution using `[ -n "$gl" ] && A || B`, which captures BOTH branches'
# output. `pre` came back as "0\n1", `[ "$pre" -eq 0 ]` threw
# "integer expression expected", and the no-hero-photo check NEVER FIRED.
cd "$(dirname "$0")/demo" || exit 1
targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then targets=(*/); fi
for d in "${targets[@]}"; do
  d="${d%/}"
  f="$d/index.html"
  [ -f "$f" ] || continue
  fails=""

  gl=$(grep -n 'id="gallery"' "$f" | head -1 | cut -d: -f1)
  if [ -n "$gl" ]; then
    pre=$(head -n "$((gl-1))" "$f" | grep -c '<img')
  else
    pre=$(grep -c '<img' "$f")
  fi
  pack=$(grep -o 'style-pack: P[0-9]*' "$f" | grep -o 'P[0-9]*' | head -1)

  [ "$(grep -o '<img' "$f" | wc -l)" -lt 4 ] && fails="$fails img<4"
  if [ "$pre" -eq 0 ] && [ "$pack" != "P05" ] && [ "$pack" != "P13" ]; then
    fails="$fails no-hero-photo"
  fi
  [ "$(grep -o 'tel:' "$f" | wc -l)" -lt 3 ] && fails="$fails tel<3"
  # Banned headline formulas — check HEADINGS only. "built right" in body prose
  # is fine; as a headline it fails the skill's portability test.
  heads=$(grep -oiE '<h[12][^>]*>.*?</h[12]>' "$f" | sed 's/<[^>]*>/ /g')
  echo "$heads" | grep -qiE 'built on |built right|proudly serving' && fails="$fails BANNED-HEADLINE"
  grep -qi 'e36b1e' "$f" && fails="$fails UNC-ORANGE"
  grep -q '@media print' "$f" || fails="$fails no-print-css"
  grep -q 'style-pack:' "$f" || fails="$fails no-pack-comment"
  grep -q '<form' "$f" || fails="$fails no-form"
  grep -q '<nav' "$f" || fails="$fails no-nav"

  # within-page duplicate image URLs
  dup=$(grep -o 'src="https://[^"]*"' "$f" | sort | uniq -d | wc -l)
  [ "$dup" -gt 0 ] && fails="$fails DUP-IMG-ON-PAGE"

  [ -n "$fails" ] && echo "$d:$fails"
done
