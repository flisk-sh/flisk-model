#!/usr/bin/env bash
# Continues training from the v2 adapter on the widened-phrasing data, resumes after a GPU crash, then scores on all three tests.
cd "$(dirname "$0")"
export FLISK_REPO="${FLISK_REPO:-../flisk}"
TOTAL=${1:-500}; AD=adapters/wolf-1.5b-v3; BASE=mlx-community/Qwen2.5-Coder-1.5B-Instruct-4bit; INIT=adapters/wolf-1.5b-v2/adapters.safetensors
mkdir -p $AD; cp adapters/wolf-1.5b-v2/adapter_config.json $AD/ 2>/dev/null
: > train-v3.status
for attempt in 1 2 3 4; do
  LAST=$(ls $AD/0*_adapters.safetensors 2>/dev/null | sort | tail -1)
  if [ -n "$LAST" ]; then DONE=$((10#$(basename "$LAST" | cut -c1-7))); cp "$LAST" /tmp/wolf-resume3.safetensors; else DONE=0; cp $INIT /tmp/wolf-resume3.safetensors; fi
  REMAIN=$((TOTAL - DONE)); [ $REMAIN -le 0 ] && break
  echo "attempt $attempt: $DONE steps done, $REMAIN to go" >> train-v3.status
  ./.venv-mlx/bin/python -m mlx_lm lora --model $BASE --train --data data-v3 --iters $REMAIN --batch-size 4 --num-layers 16 --learning-rate 5e-5 --max-seq-length 768 --mask-prompt --adapter-path $AD --resume-adapter-file /tmp/wolf-resume3.safetensors --steps-per-eval 100 --save-every 25 >> train-v3.log 2>&1 && break
  echo "attempt $attempt crashed; resuming" >> train-v3.status; sleep 20
done
echo "training finished" >> train-v3.status
./.venv-mlx/bin/python -m mlx_lm server --model $BASE --adapter-path $AD --port 8090 > mlx-server.log 2>&1 &
SP=$!; for i in $(seq 1 60); do curl -sf localhost:8090/v1/models >/dev/null && break; sleep 3; done
for t in tasks-b tasks-wild tasks-wild2; do node eval.mjs --model default_model --base-url http://localhost:8090/v1 --tasks $t --prompt v1 --out evals/results/v3-$t.json > train-v3.$t.txt 2>&1; echo "scored $t" >> train-v3.status; done
kill $SP
echo "SCORED" >> train-v3.status
