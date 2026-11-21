[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Jo3st4r/csv-reader-speed-01-bot/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Jo3st4r/csv-reader-speed-01-bot/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# Faster CSV reader — 5× the reference, byte-identical answers

A faster drop-in for make.fun's own csv-reader 1.0.0, written for
[Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
— make.fun, pool $100, top 10 entries share the prize.

## What it does

`solve.js` exports `run(input)` returning exactly csv-reader 1.0.0's answer
`{columns, rows, errors}` for every `{text, header}` input, including its
broken-row policy: BOM dropped, LF/CRLF record ends, lone CRs dropped
(`stray_cr`), quoted fields with `""` escapes and CR/LF read as LF inside,
junk after a closing quote (`quote_junk`), quotes that never close read again
as unquoted (`unterminated_quote`), short rows padded and long rows cut
(`short_row` / `long_row` with their counts).

## How it is faster

One pass over the text, fields cut out with bulk slices instead of building
every field one character at a time: a tight `charCodeAt` scan for unquoted
fields, `indexOf` to find each closing quote, and a plain slice for any
quoted segment with no line break inside. No dependencies, no network, no
state kept between calls.

Local numbers on the kit's practice set (6 cases, ~10.2 MB of CSV):

- `solve()` alone: **~101 ms median vs ~496 ms** for the house baseline
  (~4.9× faster)
- Whole driver end to end (same `main.ts`, JSON in/out included):
  **~665 ms median vs ~1501 ms** for the baseline (~2.2× faster)
- `grade-local --driver process`: **6/6 cases passed**, eligible ranked yes,
  prize yes

## Layout

- `solve.js` — the reader (ES module, dependency-free)
- `main.ts` — the harness driver: reads `/input/cases.json`, answers each
  case with `run`, writes `/output/answers.json`
- `package.json` — `{"type": "module"}`
- `.makefun/freshness.json` — drand anchor dating this repository
- `.makefun/owner.json` — payout wallet claim file
