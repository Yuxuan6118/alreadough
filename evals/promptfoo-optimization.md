# AlreaDough Coach Prompt Optimization

Run date: 2026-09-04

The same 12 high-friction cases were evaluated against Release, Assumption, and Subconscious Coach prompts. Each answer was graded independently with a six-part LLM rubric: desire preservation, emotional precision, method fidelity, concrete specificity, natural language, and safety precision. The passing threshold was 0.80.

| Coach | Baseline | First optimized run | Final verified score | Final pass rate |
|---|---:|---:|---:|---:|
| Release | 0.872 | 0.944 | 0.944 | 12 / 12 |
| Assumption | 0.899 | 0.947 | 0.947 | 12 / 12 |
| Subconscious | 0.887 | 0.902 | 0.936 | 12 / 12 |

## What changed

- **Release:** every softening step now returns to the exact desired outcome through a concrete ten-second scene, body feeling, or completed-state line. Practical actions may support steadiness but cannot replace the desire.
- **Assumption:** when belief feels difficult, the Coach explicitly keeps the destination and chooses one small ordinary end-state scene instead of retreating into generic soothing or stacking several techniques.
- **Subconscious:** resistance is treated as a wording-intensity mismatch rather than a rejection of the desire. The Coach now offers exactly three desire-specific versions—direct, natural, and bridge—and asks which one feels most receivable. Generic grounding cannot replace the subconscious-language method unless requested.

## Validation notes

- Baseline: 33 of 36 responses passed the LLM rubric.
- First optimized run: 35 of 36 passed.
- A focused rerun of all 12 Subconscious cases after the final correction passed 12 of 12, raising that Coach's average from 0.902 to 0.936.
- The valid baseline consumed 73,797 tokens, the first optimized run 76,573 tokens, and the final focused rerun 26,336 tokens.
- An earlier raw run contained a language-incompatible English word-count assertion; unspaced Chinese was counted as one word. That assertion was removed and was not used to judge Coach quality.

These results are a repeatable engineering benchmark, not proof of clinical efficacy or real-user outcomes. User testing and outcome surveys remain necessary.
