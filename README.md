# flisk-model

**Can a small model write correct Flisk config files, and can we make it as good as the big ones?**

[Flisk](https://github.com/flisk-sh/flisk) runs a software stack on your laptop from small `service.json` files. This repo tests how well different AI models write them, and trains a tiny one on a MacBook. How the test works, in plain English: **[TESTS.md](TESTS.md)**.

## Results

Two held-out tests the models were never trained on. Every answer is graded by the real Flisk validator, with no human judging.

- **Machine-written (62 questions):** generated from specs, with phrasing and names that do not appear in training.
- **Natural wording (26 questions):** written by hand in casual, terse and messy language, with typos. The training generator never produced anything like it.

| Model | What it is | Machine-written test (62) | Natural-wording test (26) | Single | Stack | Repair | Avg answer length |
|---|---|---|---|---|---|---|---|
| **flisk-wolf 1.5B (trained)** | Tiny open model + our training | **62** (100%) | **16** (62%) | 40/40 | 10/10 | 12/12 | 48 tokens |
| **Claude Haiku 5.5** | Large hosted model | **57** (92%) | **15** (58%) | 39/40 | 6/10 | 12/12 | not measured |
| **Claude Sonnet 5.5** | Large hosted model | **57** (92%) | **16** (62%) | 39/40 | 6/10 | 12/12 | not measured |
| **flisk-wolf (prompted)** | Small open model + long instructions | **54** (87%) | **18** (69%) | 34/40 | 8/10 | 12/12 | 78 tokens |
| **Qwen2.5-Coder 1.5B (plain)** | Tiny open model, untouched | **17** (27%) | not run | 5/40 | 0/10 | 12/12 | 81 tokens |
| **Qwen2.5-Coder 7B (plain)** | Small open model, untouched | **16** (26%) | not run | 4/40 | 0/10 | 12/12 | 82 tokens |

How each row was run:
- **Claude Haiku 5.5**: run blind as a separate Claude Haiku instance. It saw only the questions and the one-sentence instruction. Answer length was not measured.
- **Claude Sonnet 5.5**: run blind as a separate Claude Sonnet instance, the same way. Answer length was not measured.
- **flisk-wolf (prompted)**: Qwen2.5-Coder 7B with the Flisk rules and four worked examples built into its prompt (about 1,100 extra tokens on every call). Not trained.
- **Qwen2.5-Coder 7B (plain)**: the base model with the same short instruction as the others. No Flisk rules, no training.
- **Qwen2.5-Coder 1.5B (plain)**: the base model with the short instruction. No Flisk rules, no training.
- **flisk-wolf 1.5B (trained)**: Qwen2.5-Coder 1.5B fine-tuned with a LoRA for 400 steps on 2,170 verified examples with compact JSON answers, on a MacBook Pro M1 (about 80 minutes). Asked with the short instruction only.

### What the numbers say

- **A perfect score that is not what it looks like.** The trained 1.5B model got **62 of 62** on the machine-written test, up from 17 for the same model untrained. On the natural-wording test it got **16 of 26 (62%)**, level with Claude Sonnet (16) and Haiku (15). The machine-written test used the same generator family as the training data (five phrasing styles, training loss 0.000), so the model learned that style very well. The natural-wording test is the honest one.
- **On natural wording, nobody is good yet.** The prompted 7B model leads with 18, and the three others sit within two questions of each other. With only 26 questions, that gap is noise.
- **Why Claude loses points.** It was never told Flisk's vocabulary. It writes `"container"` or `"backend"` where Flisk wants `bring-your-own`, leaves out health-check paths, and misses `exposeViaProxy`. Given the Flisk schema it would likely do much better; this test gave it none.
- **Why the trained model loses points.** Mostly it drops the Docker image when the request is worded in an unfamiliar way ("a redis:7 container for the shop stack"): 5 of its 10 misses. It also garbled two names (`worker_cleanup-job`).
- **Answers are short.** The trained model averages 48 tokens per answer on the machine-written test, against 78 for the prompted 7B, and it needs no 1,100-token prompt on every call.
- **What it proves.** A small model trained on a laptop for about 80 minutes matches Claude on this narrow job when the wording is natural, and beats it on the generated test. What it does not yet prove is that it handles real users' wording, because it has not seen enough of it.

Caveat: 26 questions is a small sample, so one or two questions of difference is noise. Claude's answer length was not measured, and Claude was given no Flisk documentation.

## What is here

| File | What it does |
|---|---|
| [`TESTS.md`](TESTS.md) | The test, in plain English, with one example per question group |
| [`RESULTS.md`](RESULTS.md) | The results table on its own |
| [`ROADMAP.md`](ROADMAP.md) | Where this is going, with the test that decides each step |
| `eval.mjs` | Scores any model (any OpenAI-compatible server, or a file of answers) |
| `gen-dataset.mjs` | Builds the verified training data and the held-out test |
| `report.mjs` | Builds the results table |
| `make-modelfile.mjs` | Bakes the Flisk rules into an Ollama model called `flisk-wolf` |
| `server.mjs` | Console with GitHub sign-in, API keys and a metered `/v1` endpoint |
| `site/` | The Flisk Inference console page |

**Other task files.** `tasks-b.json` is the held-out test used for every number above. The other files in `evals/` (`tasks.json`, `tasks-hard.json`, `tasks-stack*.json`, `tasks-jobs.json` and so on) are early development sets that the first prompts were tuned on, so they are not fair tests.

## Reproduce

```bash
export FLISK_REPO=/path/to/flisk      # a checkout with cli/dist built: the real validator
node gen-dataset.mjs                  # training data and the held-out test
node eval.mjs --model qwen2.5-coder:7b --tasks tasks-b --prompt v1
node report.mjs                       # writes RESULTS.md
```

Training uses [MLX](https://github.com/ml-explore/mlx-lm) on Apple Silicon: `python -m mlx_lm lora --model mlx-community/Qwen2.5-Coder-1.5B-Instruct-4bit --train --data data ...`. Qwen2.5-Coder 1.5B and 7B are Apache 2.0; the 3B model is research-only, so it is not used. This repo is [MIT](LICENSE); any model weights you train from Qwen follow Qwen's licence.

## Status

Trained model: full 400-step run. Next: much more varied phrasing in the training data (the natural-wording test stays held out), then a 7B version. The public demo of the prompted model runs on a laptop through a tunnel, so it is not always on. Its code is now [flisk-inference](https://github.com/flisk-sh/flisk-inference); the older `server.mjs` and `site/` here are kept only as a fallback.
