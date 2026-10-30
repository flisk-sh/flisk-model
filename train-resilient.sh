#!/usr/bin/env bash
# Trains the LoRA and, if the GPU run crashes, resumes from the last saved checkpoint (up to 4 times), then scores the result.
cd "$(dirname "$0")"
export FLISK_REPO="${FLISK_REPO:-../flisk}"
TOTAL=${1:-400}; AD=adapters/wolf-1.5b-v2; BASE=mlx-community/Qwen2.5-Coder-1.5B-Instruct-4bit
mkdir -p $AD
for attempt in 1 2 3 4; do
  LAST=$(ls $AD/0*_adapters.safetensors 2>/dev/null | sort | tail -1)
  DONE=0; RESUME=()
  if [ -n "$LAST" ]; then DONE=$((10#$(basename "$LAST" | cut -c1-7))); cp "$LAST" /tmp/wolf-resume.safetensors; RESUME=(--resume-adapter-file /tmp/wolf-resume.safetensors); fi
  REMAIN=$((TOTAL - DONE)); [ $REMAIN -le 0 ] && break
  echo "attempt $attempt: $DONE steps done, $REMAIN to go" >> train-v2.status
  ./.venv-mlx/bin/python -m mlx_lm lora --model $BASE --train --data data --iters $REMAIN --batch-size 4 --num-layers 16 --learning-rate 1e-4 --max-seq-length 768 --mask-prompt --adapter-path $AD "${RESUME[@]}" --steps-per-eval 100 --save-every 25 >> train-v2.log 2>&1 && break
  echo "attempt $attempt crashed; resuming" >> train-v2.status; sleep 20
done
echo "training finished" >> train-v2.status
./.venv-mlx/bin/python -m mlx_lm server --model $BASE --adapter-path $AD --port 8090 > mlx-server.log 2>&1 &
SP=$!; for i in $(seq 1 60); do curl -sf localhost:8090/v1/models >/dev/null && break; sleep 3; done
node eval.mjs --model default_model --base-url http://localhost:8090/v1 --tasks tasks-b --prompt v1 --out evals/results/wolf-trained-v2.json > train-v2.eval.txt 2>&1
kill $SP
echo "SCORED" >> train-v2.status
