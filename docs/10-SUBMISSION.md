# 10 — Submission

## What to send
1. The live link (production URL, no login).
2. A note of **at most 200 words**: the fan problem, how the solution helps, the AI tools used.
Deadline: 15 Oct 2026 (aim for 14 Oct). Then a virtual demo round, then an in-person round at Dream11, Mumbai.

## Draft note (about 150 words — edit with real details, keep under 200)
> **Problem.** F1 is hard to follow live. New fans see a gap shrink or a pit stop and don't know why it matters; devoted fans need real data but engineering tools are scattered and English-only.
>
> **Solution.** PITWALL.AI is a second screen for a race. Tap any overtake, pit stop or gap change and get a plain explanation in English or Hinglish, with an evidence strip showing the exact numbers behind it. Easy mode teaches newcomers; Pro mode gives the full workstation: track map with braking zones, driver comparison, strategy and tyre pace. Every number is labelled measured, derived or estimate, and the AI is only allowed to quote values computed from real lap data.
>
> **AI tools.** Z.ai LLM for explanations and chat, validated so it cannot invent numbers; an AI coding agent to build the app. Data: OpenF1 and FastF1 (replay, since live data is paid).

Check the word count before sending (`wc -w`).

## Demo script (2 minutes)
1. **0:00** Landing: "Watch the race. Understand the race." Pick a race.
2. **0:15** Easy mode: scrub to a moment, tap it. Show the explanation and evidence strip. Toggle Hinglish.
3. **0:45** Switch to Pro: track map, braking zones, tap a corner, open Compare for two drivers.
4. **1:15** Ask the AI a normal question, then a trap ("how hard did he brake?") and show it declining honestly.
5. **1:35** Methods page: measured / derived / estimate and the known limits.
6. **1:50** Close: "Same engine works for cricket ball-by-ball. Built replay-first because live data is paid; live plugs into the same stores."

## Questions to expect and honest answers
- *Why not live?* Live OpenF1 is a paid feed; replay uses the same pipeline and screens. Live is a flag, not a rewrite.
- *How do you stop hallucinations?* Code computes facts, the model only phrases them, server checks every number against the context, and unanswerable questions get "the data cannot show this".
- *Why F1 for Dream11?* Same fan job (understand and engage during a live sport), Hinglish for the Indian audience, and the engine ports to cricket.
- *What would you do next?* Live mode, cricket data via ball-by-ball feeds, voice commentary in Hindi, personalised alerts for a followed driver.
- *What are the limits?* No brake pressure, steering, ERS or tyre temperature; tyre life and undercut odds are models; radio coverage varies.

## Final checklist
- [ ] Link works in a private window on a phone.
- [ ] Note under 200 words, includes problem, help, AI tools.
- [ ] Demo recorded or rehearsed twice.
- [ ] README and Methods credit data sources.
- [ ] Nothing in the app claims a signal the data lacks.
