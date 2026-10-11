# 07 — AI rules

## Principle
Code computes the facts. The model only **explains** them. If the model cannot be given the number, it must not state it.

## Two AI jobs
1. **Moment explanations** — generated offline for every moment in `moments.json` (en + Hinglish, easy + pro). No runtime cost, instant in the UI.
2. **Ask the AI** — free-form chat at runtime via `/api/ask`, grounded in a per-question context pack.

## Provider
Z.ai API (free tier). Put the base URL, model name and key in env vars (`ZAI_API_KEY`, `ZAI_BASE_URL`, `ZAI_MODEL`). Check the current docs for the exact model names and rate limits before building. Wrap calls in `lib/ai.ts` so the provider can be swapped. Handle rate limits with a short retry and a friendly error state.

## Context pack (what the model sees)
Built by code, per question or moment:
- race meta (name, lap, current `t`)
- selected drivers and the relevant slice of `stats.json`
- the moment's `evidence` array
- coverage flags (which data exists) so the model can say "radio is not available for this race"
Never send raw telemetry arrays. Send summaries with trust labels.

## System prompt (starting point)
```
You are the PITWALL.AI race explainer. You explain Formula 1 races using ONLY the facts in CONTEXT.
Rules:
1. Quote numbers exactly as given in CONTEXT. Never compute new numbers, never guess.
2. If CONTEXT does not contain what is needed, say what data is missing and stop. Do not speculate.
3. Mention the trust level when you rely on an ESTIMATE ("this is a model, not a measurement").
4. Brake data is on/off only; never claim brake pressure, steering, ERS or tyre temperature.
5. Mode EASY: one idea, plain words, explain any F1 term in one short clause. Max 3 sentences.
   Mode PRO: precise, may use terms (undercut, delta, apex), max 5 sentences.
6. Language EN or HI. HI means Hinglish: Roman-script Hindi with English F1 terms (pit stop, tyres, gap, DRS) kept in English. Natural, conversational, not formal Hindi.
7. End with nothing extra: no greetings, no disclaimers beyond rule 3.
Return JSON: {"headline": string, "text": string, "used": [evidence labels you relied on]}
```

## Output validation (server side, required)
After the model answers:
1. Parse the JSON; reject and retry once on failure.
2. **Number check:** extract every number in `text`; each must appear in the context pack (allowing formatting differences). If not, discard and retry once, then fall back to a template sentence built from the evidence.
3. Strip claims about forbidden signals (brake pressure, steering, ERS, tyre temperature, tyre wear).
4. Attach the `used` evidence to the UI evidence strip.

## UI requirements
- Every AI card shows the **evidence strip** (chips of label + value + trust).
- "What the AI can see" panel (Ask page) lists data sources and READY / NOT AVAILABLE.
- Thinking state: three dots plus a plain line ("Checking gap trend and tyre age...").
- Footer line: "Based on laps X to Y. Brake is an on/off signal, so braking distances are approximate."
- Suggested questions per page (chips). Include Hinglish versions.
- Never show a model answer that failed validation.

## Hinglish examples (tone reference)
- "Norris sector 2 mein Verstappen se lagbhag 0.3 second dheema hai, aur wajah Turn 7 ke baad ki exit hai."
- "Pit stop ka matlab hai gaadi tyres badalne ke liye ruki. Yeh stop usne gap bachane ke liye kiya."
Keep F1 terms in English; avoid heavy Sanskritised Hindi.

## Safety and honesty
- No betting or fantasy advice. No predictions presented as facts; predictions are ESTIMATE and labelled.
- Rate-limit `/api/ask` per IP (for example 20 per hour) and cap input length (300 chars) and output tokens.
- Log nothing personal. Do not store questions beyond the request.

## Evaluation (do before submission)
A file `pipeline/eval/questions.json` with about 20 questions across 3 races, including trap questions ("how hard did he brake?", "what was his tyre temperature?"). Pass criteria: no invented numbers, refuses forbidden signals, says "data missing" correctly, Hinglish reads naturally. Record results in `docs/DECISIONS.md`.

## AI tools to name in the submission note
The Z.ai LLM for explanations and chat, plus the AI coding agent used to build the app. Be specific and honest.
