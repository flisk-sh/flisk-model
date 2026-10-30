# flisk-model

Step 1 of a Flisk-specialised model: an eval and a dataset. No training yet.

The plan, Particle-style: keep a strong open base model, measure how well it does Flisk tasks, and only train a small LoRA adapter if the numbers say it is needed.

## What is here

- `eval.mjs` runs 12 Flisk tasks (write a `service.json`) against any OpenAI-compatible server (Ollama, LM Studio, vLLM, a hosted API). A task passes when the output parses, the Flisk CLI's own validator accepts it, every expected field matches and no forbidden field is present. It also prints output tokens, the number Particle cut by ~45%.
- `build-dataset.mjs` collects real `service.json` files, keeps the ones the validator accepts, and writes chat-format JSONL to `data/` (gitignored).
- `lib/validate.mjs` imports the validator from a built flisk checkout.

## Run it

```bash
export FLISK_REPO=/path/to/flisk          # needs cli/dist built
node eval.mjs --model qwen2.5-coder:7b    # defaults to http://localhost:11434/v1
node build-dataset.mjs /path/to/flisk/examples /path/to/other/flisk/projects
```

Needs Node 18+ and nothing from npm.

## Results (2026-10-30, Ollama on a 16 GB Mac, temperature 0)

| Model | Prompt | Main (12) | Held-out (8) |
|---|---|---|---|
| qwen2.5-coder:3b | v1 short | 1/12 | not run |
| qwen2.5-coder:3b | v2 Flisk rules + 4 examples | 12/12 | 8/8 |
| qwen2.5-coder:7b | v2 | 11/12 | 8/8 |

- The short prompt fails because the model invents `appType` values (`http`, `web`, `job`). The v2 prompt in `lib/templates.mjs` fixes that with no training.
- Prompt rules were written after seeing failures on `tasks.json` and `tasks-hard.json`, so those two sets are contaminated. `tasks-heldout.json` was written afterwards and is the fair one. Write a new unseen set before each claim, and keep some tasks private.
- `tasks-stack.json` (whole stacks, dependsOn must point at real services) and `tasks-repair.json` (fix a `service.json` the validator rejects) are the harder sets. They are uncontaminated: the v2 prompt has not been tuned on them.

| Model (prompt v2) | Stack (3) | Repair (5) |
|---|---|---|
| qwen2.5-coder:3b | 1/3 | 5/5 |
| qwen2.5-coder:7b | 1/3 | 5/5 |

  Repair is solved because the validator message names the fix. Stacks fail because both models drop the required `stack` field when the request names the stack only once, and the 3B model also mixed up `mcp`/`agent`. That is the first real gap a trained model, or a better prompt, has to close. `flisk doctor` output is not tested yet.
- The dataset is tiny (29 unique valid files), so training a LoRA is not justified yet.

## Next

1. Fix the stack gap (prompt first, then data), re-test on a fresh stack set, add `flisk doctor` output tasks.
2. If a model still fails those with the v2 prompt, grow the dataset and try a small LoRA. If not, ship the prompt as a Flisk skill and serve a base model with `flisk resource brain --type inference`.
3. Keep data private until you have checked which source repos are public.
