---
name: humanise
description: Write or rewrite text in a natural human voice, or remove AI writing patterns from existing text. Use for humanise, humanize, unslop, and requests to make writing sound human.
metadata:
  category: documentation
---

# Humanise

Write or rewrite text so it reads like a competent human wrote it. For technical docs, Slack messages, business communications, emails, PRDs, and incident reports. Works from scratch given a topic, or rewrites pasted text.

## How to use

- For a rewrite, preserve meaning, factual claims, uncertainty, and the intended tone. Return the humanised text only.
- For a draft, use the supplied topic and context. Return the draft only.

Output the text directly, without a preamble or commentary on changes. Keep names, quotations, code, and established technical terms accurate. Add specifics only when the supplied context supports them.

---

## Rules

### 1. Sentence rhythm and clarity

Vary sentence length naturally. Split dense sentences when the reader would need to backtrack. Give each sentence one main idea.

Write complete sentences with articles and verbs. Replace compressed fragments, arrows, and unexplained abbreviations with readable prose. "Parser rejects bad date → exit 2, no write" becomes "The parser rejects a bad date, exits with code 2, and writes nothing."

### 2. Plain words

Replace stock AI vocabulary and business filler with plain wording. Keep a word when it has a precise technical meaning in context.

| Word or phrase | Replace with |
|--------|-------------|
| delve | look, dig into |
| crucial, pivotal, key (adj) | important, or just drop it |
| leverage (verb) | use |
| utilize | use |
| ensure | make sure, confirm |
| enhance | improve |
| align with | match, fit, follow |
| facilitate | help, enable |
| showcase | show |
| highlight (verb) | note, point out |
| robust | solid, strong |
| seamless | smooth |
| streamline | simplify, cut |
| comprehensive | full, complete |
| innovative | new |
| cutting-edge | latest |
| ecosystem | system, stack, tooling |
| synergy | (delete) |
| going forward | from now on |
| at the end of the day | (delete) |
| circle back | follow up |
| bandwidth | time, capacity |
| actionable | useful, specific |
| impactful | effective |
| it's worth noting that | (delete — just say it) |
| in order to | to |
| due to the fact that | because |
| at this point in time | now |

Also check for "additionally", "enduring", "fostering", "garner", "interplay", "intricate", "testament", "underscore", "vibrant", and abstract uses of "landscape" or "tapestry". Say the specific thing they describe, or cut them.

Use concrete technical terms instead of metaphorical jargon such as "substrate", "wedge", "vector", "locus", "nexus", "primitive", "bedrock", "modality", "paradigm", "north star", or "flywheel". "Ratchet" may mean a limit that only tightens; "evacuate the code" means move the code out. Preserve literal domain terms, such as a vector in linear algebra.

### 3. Grammar

**Simple verbs.** Prefer "is" and "has" to "serves as", "stands as", "boasts", and decorative uses of "features".

**Substantive clauses.** Replace superficial tails such as "highlighting", "ensuring", "reflecting", or "showcasing" with a supported fact, or cut them. "We updated the config, ensuring stability" becomes "We updated the config." State the stability result separately only when the evidence supports it.

**Direct statements.** Replace "not only X, but also Y" and "not just X, but Y" with the actual point.

**Cut hedging.** "It could potentially be argued" → "It may be". "In order to achieve this" → "To achieve this".

**Active voice.** Name the actor when it matters. "Queries are validated" becomes "The compiler validates queries." Passive voice is fine when the actor is unknown or irrelevant.

**Precise verbs and measurements.** Replace adverbs that prop up weak verbs. "Significantly improves latency" becomes the measured change when available. Otherwise use wording supported by the evidence.

**Consistent terms.** Use the same word for the same thing. Avoid cycling through synonyms merely for variety.

### 4. Structure

**No announcements.** Never open with "Let's dive in", "Here's what you need to know", "In this document we will explore". Start with the content.

**Specific attribution.** Name the source behind "Experts say", "Industry reports suggest", or "Some teams believe" when it is available. Otherwise omit the unsupported claim rather than presenting it as fact.

**No puffed-up endings.** Don't close with "The future is bright", "This marks an exciting new chapter", "These changes reflect our commitment to excellence." End on a concrete fact or the immediate next step.

**No filler under headings.** First sentence after a heading carries real content — not "Performance matters." or "Security is important."

**No throat-clearing.** "It's worth noting that the retry logic was updated" → "The retry logic was updated."

**Concrete over abstract.** "Under 200ms" not "fast". "Three engineers" not "a small team".

**Mechanisms over feelings.** "Types that follow your schema" becomes "A column rename fails the build" when that is the actual behavior. Explain what the reader can do or know. Cut generic claims that could appear unchanged in another project's documentation.

**Literal prose.** Replace aphorisms, rhetorical fragments, personified code, and figurative verbs with their literal meaning. "A dial worth turning" becomes "a parameter worth varying."

**Natural grouping.** Use as many items as the content needs. Avoid forcing a group of three or a "from X to Y" range whose endpoints do not share a meaningful scale.

### 5. Formatting and tone

- Use periods or commas to separate thoughts. Avoid em dashes and substitutes such as en dashes, hyphens, or parenthetical asides.
- Use colons before lists or examples, rather than as loose connectors between clauses.
- Use sentence case headings and straight quotation marks in editable prose.
- Keep bold for useful emphasis. Remove decorative emojis from headings and bullets.
- Turn redundant inline headers such as "**Performance:** Performance improved..." into prose. A short lead-in that names an item and introduces new detail is useful.
- Respond directly. Remove chatbot greetings, praise, and closings such as "Of course!", "Great question!", "I hope this helps!", and "Let me know if...".

### 6. Slack-specific

- Lead with the most important thing
- One idea per message block
- Use bullets when they make parallel items easier to scan
- No formal salutations or sign-offs in channel messages
- Bold for actual emphasis, not decoration

### 7. Technical docs

- State what something IS before what it DOES
- Tables over prose for comparisons
- Code examples over prose explanations where possible

---

## Final pass

Read the result once for factual fidelity and once for voice. Confirm that it starts with the point, uses concrete wording and readable sentences, and ends on a relevant fact or next step. Remove remaining filler, unsupported implications, decorative formatting, and editorial commentary. Preserve the author's intent and level of certainty.

## Reference

[Unslop writing patterns](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md)
