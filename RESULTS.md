# Results

Held-out test: 62 questions the models were never trained on. How the test works is in [TESTS.md](TESTS.md).

| Model | What it is | Passed (of 62) | Single (40) | Stack (10) | Repair (12) | Avg answer length |
|---|---|---|---|---|---|---|
| **Claude Haiku 5.5** | Large hosted model | **57** (92%) | 39/40 | 6/10 | 12/12 | not measured |
| **Claude Sonnet 5.5** | Large hosted model | **57** (92%) | 39/40 | 6/10 | 12/12 | not measured |
| **flisk-wolf (prompted)** | Small open model + long instructions | **54** (87%) | 34/40 | 8/10 | 12/12 | 78 tokens |
| **flisk-wolf 1.5B (trained, step 125)** | Tiny open model + our training | **46** (74%) | 35/40 | 0/10 | 11/12 | 75 tokens |
| **Qwen2.5-Coder 1.5B (plain)** | Tiny open model, untouched | **17** (27%) | 5/40 | 0/10 | 12/12 | 81 tokens |
| **Qwen2.5-Coder 7B (plain)** | Small open model, untouched | **16** (26%) | 4/40 | 0/10 | 12/12 | 82 tokens |

**Passed** means every rule for that question held (see TESTS.md). **Avg answer length** is the model's own output tokens per question: fewer is cheaper and faster.

How each row was run:
- **Claude Haiku 5.5**: run blind as a separate Claude Haiku instance. It saw only the questions and the one-sentence instruction. Answer length was not measured.
- **Claude Sonnet 5.5**: run blind as a separate Claude Sonnet instance, the same way. Answer length was not measured.
- **flisk-wolf (prompted)**: Qwen2.5-Coder 7B with the Flisk rules and four worked examples built into its prompt (about 1,100 extra tokens on every call). Not trained.
- **Qwen2.5-Coder 7B (plain)**: the base model with the same short instruction as the others. No Flisk rules, no training.
- **Qwen2.5-Coder 1.5B (plain)**: the base model with the short instruction. No Flisk rules, no training.
- **flisk-wolf 1.5B (trained, step 125)**: Qwen2.5-Coder 1.5B fine-tuned with a LoRA on 2,243 verified examples on a MacBook Pro M1, asked with the short instruction only. Scored on the last saved checkpoint, step 125 of a planned 150: the run then crashed (GPU out of memory), and a first version of the training data had also cut stack answers short.

Read this honestly: 62 questions is a small test, it measures one narrow job (writing Flisk config files), and Claude Haiku and Sonnet are far larger general models. The point is how close a small model can get to them on this one job, and at what cost.
