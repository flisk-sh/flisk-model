# Roadmap

Where `flisk-model` and [inference.flisk.si](https://inference.flisk.si) are going, in order, with the test that decides each step.

## Where we are (honest)

| | Status |
|---|---|
| Test | 62 held-out questions, graded by the real Flisk validator. Works, but small. |
| Best small model | Prompted Qwen 7B: **54/62**. Trained 1.5B: **46/62** (partial run, **0/10 on whole stacks**). Claude Haiku and Sonnet: **57/62**, given no Flisk documentation. |
| Inference service | Live, but it runs on one Mac behind a tunnel, and only the owner can sign in. It is a demo, not a service. |
| Users | None yet. Nobody has told us this solves a problem for them. |
| Not measured | Cost per request, speed, and how Claude does when it is *given* the schema (which is how agents really use it). |

## The question that decides everything

**Why would anyone use this instead of Claude with the Flisk schema in its context?** A big model with the docs will probably score above 57. So this model cannot win on accuracy. It can win on **cost, speed, running offline or privately, and being free of API limits**. Every step below is built to prove or disprove that.

## Phase 0: make the claims solid (2 weeks)

- Finish the full training run (compact JSON answers, 2,170 examples) and publish its score next to the partial one. If whole stacks are still weak, say so.
- Measure what we have not: **cost per 1,000 requests, time to first answer, and answer length** for every model, including Claude through the API.
- Add the missing baseline: **Claude with the Flisk schema in its prompt.** This is the number that decides whether a small model has a point.
- Grow the test from 62 to 200+ questions, with a second, private set that is never published, and run it in CI against the live validator.
- **Gate:** the trained 1.5B reaches at least 54/62 and the cost and speed numbers exist. If not, stop and rethink before building more.

## Phase 1: make it reliable (1 to 2 months)

- **Constrained decoding.** Force the output to match the real `service.json` schema (JSON-schema or grammar mode), so invalid JSON is impossible. This is the biggest cheap gain.
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

## Risks and rules we hold ourselves to

- **Demand is unproven.** No users yet. Phase 2's gate exists for this reason.
- **Do not train on Claude's answers to build a competing model.** Anthropic's terms restrict that. Our data comes from specs checked by the validator, which is allowed and keeps the ground truth honest. Any other teacher model needs its licence read first.
- **Small tests lie.** 62 questions means one or two questions of difference is noise. Publish the size next to every number.
- **No hidden wins.** Always show cost and speed beside accuracy, publish failures, and keep a private test set so we are not just fitting the public one.
- **One maintainer, one laptop.** Keep every step small enough that one person can finish it.

## How we will know it is better

| Measure | Today | Target |
|---|---|---|
| Held-out score (small model) | 46 to 54 of 62 | 58+ of 62, on 200+ questions |
| Whole-stack questions | 0 to 8 of 10 | 9 of 10 |
| Invalid JSON | not tracked | 0%, by constrained decoding |
| Cost per 1,000 requests | not measured | published, with Claude beside it |
| Time to answer | about 20 s (cold), about 4 s (warm) | under 2 s |
| Uptime | the laptop | 99% a month |
| Real users | 0 | at least 10 using it from Flisk |
