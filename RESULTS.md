# Results

Two held-out tests, never trained on. **Machine-written (62):** generated from specs with phrasing and names unseen in training. **Natural wording (26):** written by hand in casual, terse and messy wording, with typos. How the tests work is in [TESTS.md](TESTS.md).

| Model | What it is | Machine-written test (62) | Natural-wording test (26) | Single | Stack | Repair | Avg answer length |
|---|---|---|---|---|---|---|---|
| **flisk-wolf 1.5B (trained)** | Tiny open model + our training | **62** (100%) | **16** (62%) | 40/40 | 10/10 | 12/12 | 48 tokens |
| **Claude Haiku 5.5** | Large hosted model | **57** (92%) | **15** (58%) | 39/40 | 6/10 | 12/12 | not measured |
| **Claude Sonnet 5.5** | Large hosted model | **57** (92%) | **16** (62%) | 39/40 | 6/10 | 12/12 | not measured |
| **flisk-wolf (prompted)** | Small open model + long instructions | **54** (87%) | **18** (69%) | 34/40 | 8/10 | 12/12 | 78 tokens |
| **Qwen2.5-Coder 1.5B (plain)** | Tiny open model, untouched | **17** (27%) | not run | 5/40 | 0/10 | 12/12 | 81 tokens |
| **Qwen2.5-Coder 7B (plain)** | Small open model, untouched | **16** (26%) | not run | 4/40 | 0/10 | 12/12 | 82 tokens |

**Passed** means every rule for that question held (see TESTS.md). **Avg answer length** is the model's own output tokens per question: fewer is cheaper and faster.

How each row was run:
- **Claude Haiku 5.5**: run blind as a separate Claude Haiku instance. It saw only the questions and the one-sentence instruction. Answer length was not measured.
- **Claude Sonnet 5.5**: run blind as a separate Claude Sonnet instance, the same way. Answer length was not measured.
- **flisk-wolf (prompted)**: Qwen2.5-Coder 7B with the Flisk rules and four worked examples built into its prompt (about 1,100 extra tokens on every call). Not trained.
- **Qwen2.5-Coder 7B (plain)**: the base model with the same short instruction as the others. No Flisk rules, no training.
- **Qwen2.5-Coder 1.5B (plain)**: the base model with the short instruction. No Flisk rules, no training.
- **flisk-wolf 1.5B (trained)**: Qwen2.5-Coder 1.5B fine-tuned with a LoRA for 400 steps on 2,170 verified examples with compact JSON answers, on a MacBook Pro M1 (about 80 minutes). Asked with the short instruction only.

Read this honestly: 62 questions is a small test, it measures one narrow job (writing Flisk config files), and Claude Haiku and Sonnet are far larger general models. The point is how close a small model can get to them on this one job, and at what cost.
