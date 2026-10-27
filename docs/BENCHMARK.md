

<!-- receipts:start -->
## Receipt reading

Run on 2026-10-27 with `qwen/qwen3.8-27b` (repair pass: `openai/gpt-oss-120b`).

| Metric | Result |
| --- | --- |
| Receipts tested | 13 (13 parsed, 0 failed) |
| Total amount exactly right | 12 / 12 (100.0 %) |
| Item count exactly right | 12 / 13 (92.3 %) |
| Item precision (name + exact price) | 93.0 % |
| Item recall (name + exact price) | 93.7 % |
| Item F1 | 93.3 % |
| Mean absolute price error (matched names) | 0.19 (in each receipt's currency) |
| Median latency per receipt | 2.3 s |

How it is measured: each photo is downscaled in Chromium exactly as the app does it, then sent through the same server function (`parseReceiptImage`). Lines with the same name are merged on both sides; an item counts as correct when its name fuzzily matches (character-bigram similarity ≥ 0.55) **and** its line total is exactly right. Precision/recall are micro-averaged over all items. Receipts whose total is cut off in the photo are left out of the total-amount metric.
<!-- receipts:end -->
