# ADR-051 Tier 3 — upstream 규칙 5 + computeLines 반영 증거 (2026-09-05)

정본 판정: [EXTERNAL_PATTERN_DELTA_2026-09.md](../../explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md) §D 착수 1 (pretext ①, 등급 A).
변경 커밋: `ba579c7a6`.

## 1. 원복 RED — `canvas2dSegmentCache.test.ts` (18 케이스, `tokenize()` 실경로 fixture)

수정 전 코드에 새 테스트만 얹은 상태에서 **13 FAIL / 5 PASS**.

| 케이스 | 기대 (Chrome 152 오라클) | 수정 전 실제                  | 원인                                        |
| ------ | ------------------------ | ----------------------------- | ------------------------------------------- |
| A      | `Price` / `$100`         | `Price $` / `100`             | `$` 가 non-breakable 단독 토큰              |
| C      | `call` / `(주)회사`      | `call (` / `주)회사`          | 라틴 `(` 가 forward-sticky 목록에 없음      |
| E      | `support@example.com` 1  | `support@` / `example.com`    | `@` 뒤 word-like 앞 break 허용              |
| F      | `foo_bar/baz_qux` 1      | `foo_bar/` / `baz_qux`        | 같음 (`/`)                                  |
| F2     | URL 1 단위               | `https://example.com/` / …    | 같음                                        |
| G      | `彼は` / `「こん`        | `彼は「` / `こんに`           | 행말 금칙 규칙이 `token.breakable` 조건 (dead) |
| H      | `漢字` / `（注）`        | `漢字（` / `注）で`           | 같음                                        |
| L      | `he said` / `"hello`     | `he said "` / `hello`         | 여는 따옴표 dangling                        |
| O      | `it's` / `'quoted'`      | `it's '` / `quoted'`          | 아포스트로피 forward glue 없음              |
| N      | `한글abc123` 1 (keep-all)| `한글` / `abc123`             | keep-all 이 인접 세그먼트 병합 안 함        |
| N2     | `価格1200円です` 1       | `価格1200` / `円です`         | 같음                                        |
| D      | `Save /` / `Cancel`      | `Save / Cancel` (fits 로 오판) | 연속 non-breakable 이 `pendingSpace` 덮어씀 |
| P      | `maxLineWidth` 60        | 40                            | 같음 (`" /"` 20px 누락)                     |

수정 후 **18/18 GREEN**, 파일 전체 63/63 GREEN.

`preprocessTokens` 의 구 행말 금칙 테스트 2건은 손으로 만든 `breakable: true` fixture 였다 —
`Intl.Segmenter` 는 `「` 를 `isWordLike: false` 로 내므로 그 fixture 는 실경로에 존재하지 않는
입력이었고, 5개월간 dead 규칙을 GREEN 으로 가렸다. 실경로 (`tokenize()`) fixture 로 교체했다.

## 2. 회귀

- `canvas/utils` + `canvas/skia` 스위트: 538 passed / 4 skipped / 56 files (0 FAIL)
- `pnpm type-check`: PASS (baseline 0)

## 3. Live Exercise — 빌더 Skia ↔ Chrome DOM 오라클 (2026-09-05)

- 환경: dev 서버 5173, 프로젝트 HGE, Chrome MCP. Text 요소 1개 추가 후
  `style = { width: 150px, font: 16px Arial, lineHeight: 24px }`,
  텍스트 = `Price $100 today mail support@example.com 彼は「こんにちは」と言った he said "hello world" ok`
- Chrome DOM 오라클 (`Range.getClientRects()` 코드포인트별 줄 추출, 같은 폰트·폭):

  1. `Price $100 today` 2. `mail` 3. `support@example.com`
  4. `彼は「こんにちは」と言っ` 5. `た he said "hello` 6. `world" ok`

- 빌더 Skia 렌더 (실측 스크린샷):

  1. `Price $100 today` 2. `mail` 3. `support@example.com`
  4. `彼は「こんにちは」と言` 5. `った he said "hello` 6. `world" ok`

- 판정: 이번 변경이 겨냥한 4개 경계가 전부 일치 —
  `$100` 미분리 · `support@example.com` 1 단위 · `「` 가 다음 줄로 carry · 여는 `"` 가 다음 줄로 carry.
  4↔5 줄의 한 글자 차이는 Skia font manager 에 일본어 글리프가 없어 `彼` `言` 이 tofu (▤) 로
  그려지며 advance 가 달라진 것 — 줄바꿈 규칙이 아니라 폰트 가용성 차이다 (이번 변경 범위 밖).

## 4. 범위 밖 (문서 §D 순서대로 후속)

- pretext ② 이모지 보정 — DPR 2 헤드 환경 재현 확인 후
- pretext ③ letterSpacing fallback 축소 — grapheme 수 캐시가 착수 조건
- Tier 2 `verifyLines` 제거 — 한 phase 지나 miss 0 이면 재검토
