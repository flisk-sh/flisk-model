#!/usr/bin/env bash
# Waits for training to finish, then scores every local model on the held-out test, one at a time, and builds RESULTS.md.
cd "$(dirname "$0")"
export FLISK_REPO=/Users/san4osq/tdk-pr-work/flisk-inference
OL=./.ollama-bin/ollama
until grep -q DONE evals/trained-1.5b.txt 2>/dev/null || grep -q "training failed" evals/trained-1.5b.txt 2>/dev/null; do sleep 20; done
run() { node eval.mjs "$@" > /dev/null 2>&1; }
# 1. trained 1.5B on MLX, short instruction only
./.venv-mlx/bin/python -m mlx_lm server --model mlx-community/Qwen2.5-Coder-1.5B-Instruct-4bit --adapter-path adapters/wolf-1.5b --port 8090 > mlx-server.log 2>&1 &
SP=$!; for i in $(seq 1 60); do curl -sf localhost:8090/v1/models >/dev/null && break; sleep 3; done
run --model default_model --base-url http://localhost:8090/v1 --tasks tasks-b --prompt v1 --out evals/results/wolf-trained-1.5b.json
kill $SP; sleep 5
# 2. Ollama models (the public wolf shares this server)
run --model flisk-wolf --tasks tasks-b --prompt none --out evals/results/wolf-prompted.json
run --model qwen2.5-coder:7b --tasks tasks-b --prompt v1 --out evals/results/qwen7b-plain.json
$OL pull qwen2.5-coder:1.5b > /dev/null 2>&1
run --model qwen2.5-coder:1.5b --tasks tasks-b --prompt v1 --out evals/results/qwen1.5b-plain.json
$OL rm qwen2.5-coder:1.5b > /dev/null 2>&1
node report.mjs > report.log 2>&1
echo ALLDONE > evals/all-done.txt
