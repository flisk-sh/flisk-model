# Roadmap

Where `flisk-model` and [inference.flisk.si](https://inference.flisk.si) are going, in order, with the test that decides each step.

## Where we are (honest)

| | Status |
|---|---|
| Test | Three held-out tests (62 machine-written, natural set 1 of 26 as a development set, clean natural set 2 of 29), graded by the real Flisk validator. Works, but small. |
| Best small model | Round-2 trained 1.5B: **60/62** machine-written, **18/26** and **17/29** on the two natural sets. Prompted 7B: 54/62, 18/26, 17/29. Claude Haiku and Sonnet: 57/62, 15 to 16/26, 18/29, given no Flisk documentation. |
| Inference service | Live, but it runs on one Mac behind a tunnel, and only the owner can sign in. It is a demo, not a service. |
| Users | None yet. Nobody has told us this solves a problem for them. |
| Not measured | Cost per request, speed, and how Claude does when it is *given* the schema (which is how agents really use it). |

## The question that decides everything

**Why would anyone use this instead of Claude with the Flisk schema in its context?** A big model with the docs will probably score above 57. So this model cannot win on accuracy. It can win on **cost, speed, running offline or privately, and being free of API limits**. Every step below is built to prove or disprove that.

## Next, in this order (not tonight)

1. Fix the data gaps the misses show: a type glued onto a name, an image used as the name, a command service that never had a `stack`, and exact strings such as `postgres:16`.
2. One size check after that: an 8-bit 1.5B or the 7B. Keep it only if it wins on the clean natural set. Do not add more of the same phrasing first.
3. **Score Claude with the Flisk schema in its prompt.** It is unmeasured, and it decides whether a small model has a point at all.
4. Export the weights and move off the laptop only after that. The live model is still the prompted 7B.

## Phase 0: make the claims solid (2 weeks)

- **Round 2 result: gate missed.** Widening phrasing moved the clean set from 14 to 17 of 29, not to the 22 of 26 target. The misses are wrong names, dropped images, exact-string slips and repairs that drop the stack (see the README). **Do not retrain the same night.** Read the misses, fix the data gaps, then try an 8-bit base or the 7B before adding more of the same data.
- **(Done, for the record) Fix phrasing coverage first.** The trained model scored 62/62 on generated wording but 16/26 on natural wording, because the generator had only five phrasing styles. Add many more (terse, casual, typos, reordered, chatty), keep the natural-wording test fully held out, and retrain. Target: 22+/26.
- Measure what we have not: **cost per 1,000 requests, time to first answer, and answer length** for every model, including Claude through the API.
- Add the missing baseline: **Claude with the Flisk schema in its prompt.** This is the number that decides whether a small model has a point.
- Grow the test from 62 to 200+ questions, with a second, private set that is never published, and run it in CI against the live validator.
- **Gate:** the trained 1.5B reaches at least 22/26 on natural wording and the cost and speed numbers exist. If not, stop and rethink before building more.

## Phase 1: make it reliable (1 to 2 months)

- **Constrained decoding, on the prompted 7B that serves today.** Force the output to match the real `service.json` schema (JSON-schema or grammar mode) so invalid JSON becomes impossible. It will not fix the trained model's misses (wrong names, dropped images), which are valid JSON, but several of the 7B's clean-set misses are not JSON at all. Compare on and off on the clean natural set.
- Fix whole stacks: more stack and dependency data, and a model that plans the list of services before writing them.
- Publish the weights (MLX and GGUF) with a one-command Ollama recipe, so people can run it themselves. Check each base model's licence first: Qwen 1.5B and 7B are Apache 2.0, the 3B is not.
- Move the service off a laptop to a small hosted GPU or CPU box, with a status page and uptime numbers.
- Real accounts: GitHub sign-in open to everyone behind per-key rate limits, usage counted per key (already built), and a simple, honest price.
- **Gate:** 95% of answers valid on the private test, and the service up 99% of a month.

## Phase 2: put it where agents already are (2 to 4 months)

- Use it from inside Flisk: the MCP server and skills call it for "write this `service.json`" and "repair this rejected file", instead of a large model. Measure tokens and time saved per agent task.
- Close the loop: every answer the validator rejects becomes a new training example (opt-in), so real use improves the model.
- Add the other narrow jobs the site promises (extract fields to JSON, route tickets, triage logs), but **only after each one has its own test.** Right now only config writing and repair are tested.
- **Gate:** real users, and measured savings in agent tasks. If agents do just as well with Claude plus the schema, treat this as a research project, not a product.

## Phase 3: grow only if the gate passes (4 to 9 months)

- Preference training with the validator as the judge (reward = valid and correct), which needs no human labelling.
- Small specialist adapters per task, routed by a tiny classifier.
- A public leaderboard and open dataset, so others can test and improve it.
- Optional paid tier for higher limits or private hosting, with a free open path.

## Ideas from other projects (checked, and what we do with them)

A scan of the MLX fine-tuning ecosystem (`ml-explore/mlx-lm` is the only mainstream project; the template and toolkit repos have under 20 stars and several are months stale). What we take, and what we skip:

| Idea | Verdict |
|---|---|
| **Constrained decoding** (force the answer to match the `service.json` schema) | **Not the next training fix.** The trained model's misses are valid JSON with wrong content, which a schema does not catch. It is still worth trying on the **prompted 7B that is actually serving**, where several clean-set misses are not JSON at all. Ollama's structured-output mode and llama.cpp grammars can enforce it. Compare on and off on the clean set. |
| **Fuse the adapter and publish weights** (GGUF, MLX, a Modelfile) | **Do in Phase 1.** Nobody can self-host or contribute until this exists. |
| **A config file for training** | Done: [`configs/lora-v3.yaml`](configs/lora-v3.yaml). Not yet re-run from the file. |
| **DoRA instead of plain LoRA** | **Cheap experiment.** One flag. Keep it only if it wins on *both* natural-wording tests. |
| **On-policy preference training** (pairs of the model's own wrong answer and the correct one, from the validator) | **Phase 2.** It targets exactly what fails now (dropped Docker images, garbled names). Needs a tool beyond mlx-lm; check maturity before depending on it. |
| **Turn real usage into training environments** (the REA-style idea of replayable sessions scored by a checker) | **After there are real users.** Without real sessions it is just more synthetic data. The validator is already our scorer. |
| **Evidence trail in every answer** (explain which rules it followed) | **Skip for the main model.** It adds tokens, and the goal is fewer. Could be a separate "explain" mode later. |
| **Distil from Claude on hard cases** | **Skip unless the terms allow it.** Anthropic's terms restrict training a competing model on its outputs. A permissively licensed open teacher is fine. |
| **Streamlit or Gradio front ends for training** | **Skip for now.** Polish, not progress. |

## Risks and rules we hold ourselves to

- **Demand is unproven.** No users yet. Phase 2's gate exists for this reason.
- **Do not train on Claude's answers to build a competing model.** Anthropic's terms restrict that. Our data comes from specs checked by the validator, which is allowed and keeps the ground truth honest. Any other teacher model needs its licence read first.
- **Small tests lie.** 62 questions means one or two questions of difference is noise. Publish the size next to every number.
- **No hidden wins.** Always show cost and speed beside accuracy, publish failures, and keep a private test set so we are not just fitting the public one.
- **One maintainer, one laptop.** Keep every step small enough that one person can finish it.

## How we will know it is better

| Measure | Today | Target |
|---|---|---|
| Clean natural-wording score (small model) | 17 of 29 | 22+ of 26-sized sets, then 100+ questions |
| Machine-written score | 60 of 62 | stays at 60+ while phrasing widens |
| Invalid JSON | not tracked | 0%, by constrained decoding |
| Cost per 1,000 requests | not measured | published, with Claude beside it |
| Time to answer | about 20 s (cold), about 4 s (warm) | under 2 s |
| Uptime | the laptop | 99% a month |
| Real users | 0 | at least 10 using it from Flisk |
