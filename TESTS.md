# How the tests work (plain English)

**The question we ask a model:** *can you turn a plain-English request into a correct Flisk config file?*

Flisk is a tool that runs a software stack on your laptop. Every service in a stack has a small settings file called `service.json`. Writing it wrong means the stack does not start, so a wrong answer is easy to spot.

There are **two tests**. The first has **62 machine-written questions** in three groups (below). The second has **26 questions written by hand** in casual, terse and messy wording, with typos, to check that a model copes with how real people ask. Same grading rules for both.

## 1. Single (40 questions): write one file

> **Question:** "Set up a migrator called "falcon-job", for the "farm" stack in Flisk. Reply with the JSON only."
>
> **Correct answer:**
> ```json
> { "schemaVersion": 1, "appName": "falcon-job", "appType": "migrator", "stack": "farm" }
> ```

The model has to know that a "migrator" is its own type, keep the name exactly, and put it in the right stack. Harder questions add ports, Docker images, health checks, restart rules, replica counts and dependencies.

## 2. Stack (10 questions): write a whole set of files that fit together

> **Question:** "Write the service.json files for a "clinic" stack: a REST service called "falcon-job" ...; an MCP server called "pebble-app" that depends on "falcon-job"; a migration runner called "meadow-app" that depends on "pebble-app"."

The answer is a list of files. Each one must be right, and every "depends on" must point at a service that exists in the list.

## 3. Repair (12 questions): fix a broken file

> **Question:** "This service.json is rejected. The validator says: `stack: required field is missing`. Fix it with the smallest change."

The model gets the broken file and the error message, and has to fix only what is wrong.

## How one question is graded

A question passes only if **all four** are true:

1. The answer is valid JSON.
2. **Flisk's own validator accepts it.** This is the same check Flisk runs before starting a stack, not our opinion.
3. Every setting the question asked for has exactly the right value (name, port, image, and so on).
4. Nothing was added that the question said not to (for example, no health check for a database that has none).

No partial credit, and a human never decides. The score is the number of questions passed out of 62.

## Why you can trust the test

- **The right answers come from code, not from a model.** A program builds each question and its answer from a settings list, and the Flisk validator must accept the answer before it is used.
- **Every question can be answered from the question alone.** We removed questions that needed information the model was never given (a first version had four of them).
- **The test is held out.** The 62 questions use different wording, names, images and commands than the training data. A check confirms no test question, and no test name, appears in training data.
- **Same questions for every model.** Claude Haiku and Claude Sonnet were given only the 62 questions and the same one-sentence instruction as the small models, with no access to the answers.

## What the test does not show

It covers one narrow job, and 62 questions is a small sample, so differences of one or two questions are noise. It says nothing about how well a model writes code, chats, or reasons. It checks that the answer is *correct and valid*, not that it is *efficient*.

Run it yourself: `node eval.mjs --model <name> --tasks tasks-b` (needs a built Flisk checkout for the validator; see the README).
