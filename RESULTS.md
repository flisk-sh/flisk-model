# Results

Three held-out tests, never trained on. **Machine-written (62):** generated from specs, phrasing and names unseen in training. **Natural set 1 (26):** written by hand in casual, messy wording; now a development set, because I tuned the generator after seeing its failures. **Natural set 2 (29, clean):** written by hand and committed *before* the generator was widened. This is the fair one. How the tests work is in [TESTS.md](TESTS.md).

| Model | What it is | Machine-written (62) | Natural set 1 (26, development) | **Natural set 2 (29, clean)** | Avg answer length |
|---|---|---|---|---|---|
| **flisk-wolf 1.5B, trained (round 2)** | Tiny open model + our training, wider phrasing | **60** (97%) | **18** (69%) | **17** (59%) | 48 tokens |
| **Claude Haiku 5.5** | Large hosted model | **57** (92%) | **15** (58%) | **17** (59%) | not measured |
| **Claude Sonnet 5.5** | Large hosted model | **57** (92%) | **16** (62%) | **17** (59%) | not measured |
| **flisk-wolf (prompted)** | Small open model + long instructions | **54** (87%) | **18** (69%) | **17** (59%) | 78 tokens |
| **flisk-wolf 1.5B, trained (round 1)** | Tiny open model + our training | **62** (100%) | **16** (62%) | **14** (48%) | 48 tokens |
| **Qwen2.5-Coder 1.5B (plain)** | Tiny open model, untouched | **14** (23%) | not run | not run | 81 tokens |
| **Qwen2.5-Coder 7B (plain)** | Small open model, untouched | **13** (21%) | not run | not run | 82 tokens |

**Passed** means every rule for that question held (see TESTS.md). Re-graded on 2026-11-10: the grader now also checks appType, port, stack and dependsOn against Flisk's published schema. Every row was run again, gave the same answers as before, and was graded on those. It cost Claude Haiku and Sonnet one question each on natural set 2 (appType "container", which is not a Flisk type) and the plain Qwen models three each. **Avg answer length** is the model's own output tokens per question: fewer is cheaper and faster.

How each row was run:
- **Claude Haiku 5.5**: run blind as a separate Claude Haiku instance. It saw only the questions and the one-sentence instruction. Answer length was not measured.
- **Claude Sonnet 5.5**: run blind as a separate Claude Sonnet instance, the same way. Answer length was not measured.
- **flisk-wolf (prompted)**: Qwen2.5-Coder 7B with the Flisk rules and four worked examples built into its prompt (about 1,100 extra tokens on every call). Not trained.
- **Qwen2.5-Coder 7B (plain)**: the base model with the same short instruction as the others. No Flisk rules, no training.
- **Qwen2.5-Coder 1.5B (plain)**: the base model with the short instruction. No Flisk rules, no training.
- **flisk-wolf 1.5B, trained (round 1)**: Qwen2.5-Coder 1.5B fine-tuned with a LoRA for 400 steps on 2,170 machine-written examples (five phrasing styles), on a MacBook Pro M1. Short instruction only.
- **flisk-wolf 1.5B, trained (round 2)**: Round 1 continued for 500 more steps on 3,300 examples in dozens of phrasing styles (terse, chatty, key-value, typos, shuffled order), on the same MacBook. Short instruction only.

Read this honestly: 62 questions is a small test, it measures one narrow job (writing Flisk config files), and Claude Haiku and Sonnet are far larger general models. The point is how close a small model can get to them on this one job, and at what cost.
