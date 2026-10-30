# flisk-model

**Can a small model write correct Flisk config files, and can we make it as good as the big ones?**

[Flisk](https://github.com/flisk-sh/flisk) runs a software stack on your laptop from small `service.json` files. This repo tests how well different AI models write them, and trains a tiny one on a MacBook. How the test works, in plain English: **[TESTS.md](TESTS.md)**.

## Results

Three held-out tests the models were never trained on. Every answer is graded by the real Flisk validator, with no human judging.

- **Machine-written (62):** generated from specs, with phrasing and names unseen in training.
- **Natural set 1 (26):** written by hand in casual, messy wording. It is now a *development* set, because I tuned the generator after seeing its failures.
- **Natural set 2 (29, clean):** written by hand and committed *before* the generator was widened. **This is the fair test.**

| Model | What it is | Machine-written (62) | Natural set 1 (26, development) | **Natural set 2 (29, clean)** | Avg answer length |
|---|---|---|---|---|---|
| **Claude Haiku 5.5** | Large hosted model | **57** (92%) | **15** (58%) | **18** (62%) | not measured |
| **Claude Sonnet 5.5** | Large hosted model | **57** (92%) | **16** (62%) | **18** (62%) | not measured |
| **flisk-wolf 1.5B, trained (round 2)** | Tiny open model + our training, wider phrasing | **60** (97%) | **18** (69%) | **17** (59%) | 48 tokens |
| **flisk-wolf (prompted)** | Small open model + long instructions | **54** (87%) | **18** (69%) | **17** (59%) | 78 tokens |
| **flisk-wolf 1.5B, trained (round 1)** | Tiny open model + our training | **62** (100%) | **16** (62%) | **14** (48%) | 48 tokens |
| **Qwen2.5-Coder 1.5B (plain)** | Tiny open model, untouched | **17** (27%) | not run | not run | 81 tokens |
| **Qwen2.5-Coder 7B (plain)** | Small open model, untouched | **16** (26%) | not run | not run | 82 tokens |

How each row was run:
- **Claude Haiku 5.5**: run blind as a separate Claude Haiku instance. It saw only the questions and the one-sentence instruction. Answer length was not measured.
- **Claude Sonnet 5.5**: run blind as a separate Claude Sonnet instance, the same way. Answer length was not measured.
- **flisk-wolf (prompted)**: Qwen2.5-Coder 7B with the Flisk rules and four worked examples built into its prompt (about 1,100 extra tokens on every call). Not trained.
- **Qwen2.5-Coder 7B (plain)**: the base model with the same short instruction as the others. No Flisk rules, no training.
- **Qwen2.5-Coder 1.5B (plain)**: the base model with the short instruction. No Flisk rules, no training.
- **flisk-wolf 1.5B, trained (round 1)**: Qwen2.5-Coder 1.5B fine-tuned with a LoRA for 400 steps on 2,170 machine-written examples (five phrasing styles), on a MacBook Pro M1. Short instruction only.
- **flisk-wolf 1.5B, trained (round 2)**: Round 1 continued for 500 more steps on 3,300 examples in dozens of phrasing styles (terse, chatty, key-value, typos, shuffled order), on the same MacBook. Short instruction only.

### What the numbers say

- **The goal was missed.** The target for round 2 was 22 or more of 26 on hand-written questions. It scored **18 of 26** on set 1 and **17 of 29 (59%)** on the clean set 2. No further training tonight; the next step starts from reading the misses.
- **It is level with Claude, not better.** On the clean set: Claude Haiku 18, Claude Sonnet 18, trained 1.5B 17, prompted 7B 17. A 1.5B model trained on a laptop for a few hours matches Claude on this narrow job when Claude is given no Flisk documentation. With 29 questions, a gap of one is noise.
- **Widening the phrasing helped, and cost a little.** Round 1 to round 2: clean set 14 to **17**, set 1 16 to **18**, machine-written 62 to **60**. The 100% on machine-written questions was never evidence the model could cope with real wording.
- **Answers are short.** 48 tokens on average, against 78 for the prompted 7B, and no 1,100-token prompt on each call. Claude's length was not measured.

### Reading the 20 misses

Every miss on the natural sets still produced valid JSON, so none is a formatting problem.

| What went wrong | Count | Examples |
|---|---|---|
| Wrong or garbled `appName` | 9 | `worker-cleanup-job` (type glued to the name), `api-gateway` for `gateway-api`, the Docker image used as the name |
| Dropped the image or the command | 5 | "a redis:7 container for the shop stack" produced no `image` |
| Slipped an exact string | 4 | stack `assistances` for `assistants`, `blog` for `blogging`, image `postgres` for `postgres:16` |
| A repair removed the stack | 2 | after fixing a command-plus-image conflict, the model dropped `stack` |

The machine-written test also lost two questions to string slips (`elixir app.ex`, `couchdb/c3`).

**Likely causes (hypotheses, not proven):** command services never had a `stack` in the training data, so a repair on one with a stack was unfamiliar; names introduced as a bare "type name" were under-represented; and a 4-bit, 1.5B model may simply copy exact strings less reliably than a bigger one.

**What will not help:** constrained decoding (forcing the output to match a JSON schema) removes invalid JSON, and there is almost none here. At best it catches the two names that are not legal Docker names. It will not fix a dropped image or a wrong name.

**What to try, in order, not tonight:** fix the data gaps above; test an 8-bit base or the 7B model to see whether copy errors come from size; add a larger, third natural-wording set; then, once the weights are exported, test constrained decoding on and off.

Caveat: 26 and 29 questions are small samples, and set 1 is contaminated by my own tuning. Claude was given no Flisk documentation and its answer length was not measured.

## What is here

| File | What it does |
|---|---|
| [`TESTS.md`](TESTS.md) | The test, in plain English, with one example per question group |
| [`RESULTS.md`](RESULTS.md) | The results table on its own |
| [`ROADMAP.md`](ROADMAP.md) | Where this is going, with the test that decides each step |
| `eval.mjs` | Scores any model (any OpenAI-compatible server, or a file of answers) |
| `gen-dataset.mjs` | Builds the first training data and the machine-written test |
| `gen-diverse.mjs` | Builds the widened-phrasing training data (round 2) |
| `train-v3.sh` | Round 2 trainer: resumes after a GPU crash, then scores all three tests |
| `evals/tasks-wild.json`, `evals/tasks-wild2.json` | The two natural-wording tests (set 2 is the clean one) |
| `configs/lora-v3.yaml` | The training settings, as a config file |
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

Round 2 finished all 500 steps and was scored on all three tests; the numbers are above, and the goal was missed. The public demo ([flisk-inference](https://github.com/flisk-sh/flisk-inference), served at inference.flisk.si) still runs the **prompted 7B**: the trained weights are not exported yet, and it runs on a laptop through a tunnel, so it is not always on. The older `server.mjs` and `site/` here are kept only as a fallback until the new portal is the only thing serving the domain. Next: read the misses, then the steps in the [roadmap](ROADMAP.md).
