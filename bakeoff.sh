#!/usr/bin/env bash
# Scores several small open models on the held-out set (tasks-b) with the short prompt, then removes each model.
cd "$(dirname "$0")"
export FLISK_REPO="${FLISK_REPO:-../flisk}"
OL=./.ollama-bin/ollama
: > evals/bakeoff.txt
for m in qwen2.5-coder:1.5b qwen2.5-coder:3b qwen3:1.7b qwen3:4b llama3.2:3b phi4-mini smollm2:1.7b; do
  if $OL pull "$m" >/dev/null 2>&1; then
    for p in v1 v2; do
      r=$(node eval.mjs --model "$m" --tasks tasks-b --prompt $p 2>&1 | grep -E "passed" | sed 's/.*): //')
      echo "$m | prompt $p | ${r:-eval failed}" >> evals/bakeoff.txt
    done
    [ "$m" != "qwen2.5-coder:3b" ] && $OL rm "$m" >/dev/null 2>&1
  else
    echo "$m | pull failed (not in the library?)" >> evals/bakeoff.txt
  fi
done
echo DONE >> evals/bakeoff.txt
