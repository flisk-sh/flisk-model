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

## Where it stands

- The scorer was checked against a fake server that answers perfectly (12/12). No real model has been scored yet.
- The dataset is **tiny**: 29 unique valid `service.json` files across the local flisk repos (26 train, 3 valid). A LoRA needs hundreds to thousands of examples, so more data comes first: generate variations from the schema, and mine docs and agent sessions.

## Next

1. Score two or three open models for a baseline. If one already passes most tasks, stop: serve it with `flisk resource brain --type inference`.
2. If not, grow the dataset and the task list, and hold the eval tasks out of training.
3. Only then try a small LoRA (mlx-lm on a Mac for a demo, a rented GPU for a real run).
