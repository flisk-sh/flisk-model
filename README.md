# flisk-model

**Can a small model write correct Flisk config files, and can we make it as good as the big ones?**

[Flisk](https://github.com/flisk-sh/flisk) runs a software stack on your laptop from small `service.json` files. This repo tests how well different AI models write them, and trains a tiny one on a MacBook. How the test works, in plain English: **[TESTS.md](TESTS.md)**.

## Results

62 held-out questions, every model scored the same way (the real Flisk validator, no human judging).

| Model | What it is | Passed (of 62) | Single (40) | Stack (10) | Repair (12) | Avg answer length |
|---|---|---|---|---|---|---|
| **Claude Haiku 5.5** | Large hosted model | **57** (92%) | 39/40 | 6/10 | 12/12 | not measured |
| **Claude Sonnet 5.5** | Large hosted model | **57** (92%) | 39/40 | 6/10 | 12/12 | not measured |
| **flisk-wolf (prompted)** | Small open model + long instructions | **54** (87%) | 34/40 | 8/10 | 12/12 | 78 tokens |
| **flisk-wolf 1.5B (trained, step 125)** | Tiny open model + our training | **46** (74%) | 35/40 | 0/10 | 11/12 | 75 tokens |
| **Qwen2.5-Coder 1.5B (plain)** | Tiny open model, untouched | **17** (27%) | 5/40 | 0/10 | 12/12 | 81 tokens |
| **Qwen2.5-Coder 7B (plain)** | Small open model, untouched | **16** (26%) | 4/40 | 0/10 | 12/12 | 82 tokens |

How each row was run:
- **Claude Haiku 5.5**: run blind as a separate Claude Haiku instance. It saw only the questions and the one-sentence instruction. Answer length was not measured.
- **Claude Sonnet 5.5**: run blind as a separate Claude Sonnet instance, the same way. Answer length was not measured.
- **flisk-wolf (prompted)**: Qwen2.5-Coder 7B with the Flisk rules and four worked examples built into its prompt (about 1,100 extra tokens on every call). Not trained.
- **Qwen2.5-Coder 7B (plain)**: the base model with the same short instruction as the others. No Flisk rules, no training.
- **Qwen2.5-Coder 1.5B (plain)**: the base model with the short instruction. No Flisk rules, no training.
- **flisk-wolf 1.5B (trained, step 125)**: Qwen2.5-Coder 1.5B fine-tuned with a LoRA on 2,243 verified examples on a MacBook Pro M1, asked with the short instruction only. Scored on the last saved checkpoint, step 125 of a planned 150: the run then crashed (GPU out of memory), and a first version of the training data had also cut stack answers short.

### What the numbers say

- **Training works.** The same tiny 1.5B model went from **17 to 46 of 62** after a short fine-tune on a laptop. On single-service questions it jumped from 5 to **35 of 40**, about the same as the prompted 7B model (34) and close to Claude (39).
- **Big models are not magic here.** Claude Haiku and Sonnet both scored 57. They were never told Flisk's own setting names, so they missed the same question type: a service "that must not get a Traefik route" needs `exposeViaProxy: false`, which they did not know.
- **Instructions can stand in for training, at a cost.** The prompted 7B model reached 54 by carrying about 1,100 extra words of rules on every request. It even beat Claude on whole stacks (8 of 10 vs 6). The trained model needs none of that.
- **Weak spot: whole stacks (0 of 10).** The trained model fails the multi-file questions. The reason is visible: those answers are long, and my training run cut them off at 768 tokens, so it learned to stop early. The fix is already planned (shorter, compact JSON and a longer limit), and it is also the cheapest way to cut answer length.
- **Plain small models fail the same test.** Untrained Qwen 1.5B and 7B pass the repair questions (the error message names the fix) but only 4 to 5 of 40 single-service questions.

Caveat: 62 questions is a small sample, so one or two questions of difference is noise. Claude's answer length was not measured.

## What is here

| File | What it does |
|---|---|
| [`TESTS.md`](TESTS.md) | The test, in plain English, with one example per question group |
| [`RESULTS.md`](RESULTS.md) | The results table on its own |
| `eval.mjs` | Scores any model (any OpenAI-compatible server, or a file of answers) |
| `gen-dataset.mjs` | Builds the verified training data and the held-out test |
| `report.mjs` | Builds the results table |
| `make-modelfile.mjs` | Bakes the Flisk rules into an Ollama model called `flisk-wolf` |
| `server.mjs` | Console with GitHub sign-in, API keys and a metered `/v1` endpoint |
| `site/` | The Flisk Inference console page |

## Reproduce

```bash
export FLISK_REPO=/path/to/flisk      # a checkout with cli/dist built: the real validator
node gen-dataset.mjs                  # training data and the held-out test
node eval.mjs --model qwen2.5-coder:7b --tasks tasks-b --prompt v1
node report.mjs                       # writes RESULTS.md
```

Training uses [MLX](https://github.com/ml-explore/mlx-lm) on Apple Silicon: `python -m mlx_lm lora --model mlx-community/Qwen2.5-Coder-1.5B-Instruct-4bit --train --data data ...`. Qwen2.5-Coder 1.5B and 7B are Apache 2.0; the 3B model is research-only, so it is not used.

## Status

Trained model: step 125 of 150, one checkpoint. Next: compact-JSON training data and a longer sequence limit to fix whole stacks, then a 7B version. The public demo of the prompted model runs on a Mac through a tunnel, so it is not always on.
