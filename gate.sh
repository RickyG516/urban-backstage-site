#!/bin/bash
# Corrected baseline gate — spec-mockup-engine v2 Step 5
# FIX vs the handoff version: the original computed `pre` inside a command
# substitution using `[ -n "$gl" ] && A || B`, which captures BOTH branches'
# output. `pre` came back as "0\n1", `[ "$pre" -eq 0 ]` threw
# "integer expression expected", and the no-hero-photo check NEVER FIRED.
cd "$(dirname "$0")/demo" || exit 1

# Non-prospect pages (non-contractor niches living in the library). Single
# source of truth is demo/.non-prospects, shared with tools/enrich_audit.py so
# the two gates cannot drift apart. Strip comments and blanks.
skip=""
if [ -f .non-prospects ]; then
  skip=$(sed 's/#.*//' .non-prospects | tr -d ' \t' | grep -v '^$')
fi

bad=0
targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then targets=(*/); fi
for d in "${targets[@]}"; do
  d="${d%/}"
  f="$d/index.html"
  [ -f "$f" ] || continue
  if [ -n "$skip" ] && printf '%s\n' "$skip" | grep -qx "$d"; then continue; fi
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

  if [ -n "$fails" ]; then echo "$d:$fails"; bad=1; fi
done

# Exit code must mean "something failed", not "the last page was clean".
# Previously the loop ended on `[ -n "$fails" ] && echo`, which returns 1
# whenever $fails is EMPTY - so a fully clean run exited nonzero and any
# `gate.sh && next-step` chain silently never ran.
exit "${bad:-0}"
