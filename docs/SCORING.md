# Scoring methodology v1

Each observation stores `passed`, `deduction`, category, confidence, check, page and evidence ID. Passed checks deduct zero. Findings/AI do not influence scores.

For category c: `raw_c = max(0, 100 - sum(deduction_c))`. Weighted points: `raw_c × weight_c / 100`. Total: `round(sum(weighted points) / sum(measured category weights) × 100)`. Missing categories have null scores and lower coverage. Measured category coverage is not the fraction of all possible checks completed.

Defaults: Performance 25; Accessibility 20; SEO 20; Mobile 15; Technical 10; Headers 10. Settings must total 100. Every audit captures its weights; every report copies that configuration. Scores and exact formulas appear in review and reports. Expand evidence to inspect every source deduction.

Current deductions: FCP failure 20; LCP 25; CLS 20; observed long-task blocking 15. axe serious-impact rule 15, other rule failures 8. Heading skips 8. SEO metadata checks 8, structured-data suggestion 3. Missing headers 8 each. Horizontal overflow 25, small-target heuristic 10, zoom restriction 15. Other deterministic failures default to 10. Deductions cap at 100 per category.

This simple policy can penalize related checks twice (for example axe heading order plus a DOM heading check), and repeated failures on several pages accumulate. These choices are explicit and reproducible, not a calibrated industry benchmark. Before real client use, calibrate/deduplicate the scoring model against representative sites and version that methodology.

Single-run fixture performance is not real-user performance and is not comparable to a throttled Lighthouse run. Speed Index, Lighthouse TBT and field Core Web Vitals remain unavailable. Missing data never becomes an invented severe failure. Human rejection of a finding removes its interpretation from selected reports, not the underlying measurement or score.
