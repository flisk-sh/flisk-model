#!/usr/bin/env bash
# Waits for the LoRA run to finish, serves the adapter with MLX, and scores it on the held-out set with the SHORT prompt.
cd "$(dirname "$0")"
export FLISK_REPO=/Users/san4osq/tdk-pr-work/flisk-inference
LOG=${1:-train-1.5b.log}; BASE=${2:-mlx-community/Qwen2.5-Coder-1.5B-Instruct-4bit}; AD=${3:-adapters/wolf-1.5b}; OUT=${4:-evals/trained-1.5b.txt}
until grep -q -E "Saved final weights|Traceback" "$LOG"; do sleep 15; done
grep -q Traceback "$LOG" && { echo "training failed" > "$OUT"; tail -5 "$LOG" >> "$OUT"; exit 1; }
./.venv-mlx/bin/python -m mlx_lm server --model "$BASE" --adapter-path "$AD" --port 8090 > mlx-server.log 2>&1 &
SP=$!
for i in $(seq 1 60); do curl -sf localhost:8090/v1/models >/dev/null && break; sleep 3; done
: > "$OUT"
for t in tasks-b tasks; do
  r=$(node eval.mjs --model default_model --base-url http://localhost:8090/v1 --tasks $t --prompt v1 2>&1 | grep -E "passed" | sed 's/.*): //')
  echo "trained $BASE | tasks $t | prompt v1 (short) | ${r:-eval failed}" >> "$OUT"
done
kill $SP 2>/dev/null
echo DONE >> "$OUT"
