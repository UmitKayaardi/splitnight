# Accuracy benchmarks

These numbers come from running the app's own server code against real receipt photos and synthetic sentences. They are kept here (and summarised in the README) and never shown in the app. Re-run with `npm run benchmark:receipts` and `npm run benchmark:assign`; each script rewrites only its own section.

<!-- receipts:start -->

## Receipt reading

Run on 2026-10-27 with `qwen/qwen3.8-27b` (repair pass: `openai/gpt-oss-120b`).

| Metric                                    | Result                            |
| ----------------------------------------- | --------------------------------- |
| Receipts tested                           | 13 (13 parsed, 0 failed)          |
| Total amount exactly right                | 12 / 12 (100.0 %)                 |
| Item count exactly right                  | 12 / 13 (92.3 %)                  |
| Item precision (name + exact price)       | 93.0 %                            |
| Item recall (name + exact price)          | 93.7 %                            |
| Item F1                                   | 93.3 %                            |
| Mean absolute price error (matched names) | 0.19 (in each receipt's currency) |
| Median latency per receipt                | 2.3 s                             |

How it is measured: each photo is downscaled in Chromium exactly as the app does it, then sent through the same server function (`parseReceiptImage`). Lines with the same name are merged on both sides; an item counts as correct when its name fuzzily matches (character-bigram similarity ≥ 0.55) **and** its line total is exactly right. Precision/recall are micro-averaged over all items. Receipts whose total is cut off in the photo are left out of the total-amount metric.
<!-- receipts:end -->

<!-- assign:start -->

## Sentence understanding

Run on 2026-10-27 with `openai/gpt-oss-120b` on 100 synthetic cases (`benchmarks/assign-cases.json`; fictional menus and names).

| Language | Cases | Every line exactly right | Lines right |
| -------- | ----- | ------------------------ | ----------- |
| English  | 60    | 59 / 60 (98.3 %)         | 99.8 %      |
| Turkish  | 10    | 10 / 10 (100.0 %)        | 100.0 %     |
| German   | 10    | 10 / 10 (100.0 %)        | 100.0 %     |
| French   | 10    | 10 / 10 (100.0 %)        | 100.0 %     |
| Spanish  | 10    | 10 / 10 (100.0 %)        | 100.0 %     |

Median latency: 1.2 s per sentence.

How it is measured: each sentence goes through the same server code as the app (`proposeAssignments`), the proposal is applied with the app's own `applyProposal` (including line splitting for "two of the three beers"), and the outcome is compared line by line: how many units of each receipt line each person ends up with (±0.02). A case only counts as right when **every** line on the receipt is right — including lines the sentence should leave alone. Cases cover shared items, quantity splits, "everyone", "everyone except", "the rest", corrections of earlier assignments, nicknames and missing diacritics, synonyms ("coke", "fizzy water", "fry-up"), several sentences at once, speech-style filler words, and people or dishes that are not on the bill.

Voice is not benchmarked with audio files: speech-to-text is Groq's Whisper, and this benchmark measures what happens after the words are known.
<!-- assign:end -->

## Prompt iterations

- **v1 (the full run above).** 99 / 100 cases correct. The one miss, en58 ("We shared the chips between all of us"), also gave everyone a share of _Fish and Chips_, because one item's name contains the other's.
- **v2.** Added one rule to the assign prompt: when one item name is part of another, the words used refer to the closest whole name. Re-running the five cases on that menu (en56–en60) gave 5 / 5, including en58. The full set was not re-run, to stay within the free tier's daily token limit, so the table above still shows v1.
