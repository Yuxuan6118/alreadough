# AlreaDough Promptfoo Baseline

Run: 2026-09-04
Cases: 12
Coach responses: 36
Total tokens: 73,797

| Coach | LLM rubric average | Passed at 0.80 |
|---|---:|---:|
| Assumption | 0.899 | 11 / 12 |
| Subconscious | 0.887 | 11 / 12 |
| Release | 0.872 | 11 / 12 |

## Main findings

- All three coaches became too generic when the English user rejected affirmations. The exact desire faded behind grounding language.
- Release lost the desired self-image in one response and needed more concrete end-state practice in career, deadline, and lifestyle cases.
- Assumption preserved the destination well in most Chinese cases but needed an explicit rule for resistance.
- Subconscious needed to keep bridge statements tied to the exact destination and avoid treating present relationship evidence as proof of change.

The Promptfoo CLI marked the raw run as failed because a Chinese word-count assertion treated an unspaced Chinese response as one word. That language-incompatible assertion was removed. The independent LLM-rubric scores above are the valid baseline used for optimization.
