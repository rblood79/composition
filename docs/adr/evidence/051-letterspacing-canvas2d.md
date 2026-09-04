# ADR-051 §B4-7 — letterSpacing Canvas 2D 측정 (2026-09-05)

정본 판정: [EXTERNAL_PATTERN_DELTA_2026-09.md](../../explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md) §D 순서 4 (pretext ③).
커밋 `8b6c1bd22`.

## 1. Chrome 오라클 (2026-09-05, Chrome 152 · macOS · 16px Arial)

`ctx.letterSpacing` 과 DOM `getBoundingClientRect` 를 같은 문자열로 대조:

| 텍스트        | grapheme | base   | DOM (ls 2px) | Δ     | canvas (ls 2px) | Δ  |
| ------------- | -------- | ------ | ------------ | ----- | --------------- | -- |
| `abc`         | 3        | 25.797 | 31.797       | 6     | 31.797          | 6  |
| `hello world` | 11       | 76.484 | 98.484       | 22    | 98.484          | 22 |
| `가나다`      | 3        | 41.520 | 47.523       | 6.003 | 47.520          | 6  |

**규칙**: `base + grapheme 수 × spacing` — **마지막 글자 뒤 간격도 폭에 포함**된다
(`(n-1)` 아님). `ctx.letterSpacing` 은 DOM 과 소수점까지 같다 (가나다의 0.003 은 DOM 쪽 반올림).

**줄바꿈 판정도 같은 폭**: `"ab cd"` 를 1줄로 만드는 최소 폭을 이분 탐색 40회로 찾으면
ls 2px 에서 49.133, trailing 포함 폭은 49.141 (차 0.008 = 판정 ε). ls 0 에서도 같은 관계
(39.133 vs 39.141). 즉 **마지막 간격이 컨테이너 폭 판정에 들어간다** — hang 되지 않는다.

## 2. 문서 제안을 바꾼 지점

문서 §B4-7 은 `Intl.Segmenter({granularity:"grapheme"})` 로 토큰별 grapheme 수를 세어 산술
가산하고, §B4-13 은 그 비용을 "텍스트당 49 µs — 캐시 없이는 파이프라인의 4배" 로 재
**grapheme 수 캐시를 착수 조건**으로 걸었다.

`ctx.letterSpacing` (Chrome 99+ · Safari 17.4+ · Firefox 126+) 을 쓰면 그 축이 통째로 없어진다 —
브라우저 셰이퍼가 반영한 폭을 그대로 받으므로 grapheme 을 셀 필요가 없고, 값도 위 표대로
DOM 과 정확히 같다. 캐시 분리는 `buildFontKey` 에 `letterSpacing` 을 넣어 해결한다.
미지원 브라우저는 `needsFallback` 이 종전대로 CanvasKit 로 보낸다 (산술 경로를 따로 두면
브라우저마다 다른 값이 나오는 두 갈래가 생긴다).

## 3. 결함 정정 — `Canvas2DTextMeasurer`

`textMeasure.ts` 의 기본 측정기 (CanvasKit 초기화 **전** 에 쓰이는 production 측정기) 는
`letterSpacing * Math.max(0, text.length - 1)` 였다. 두 결함:

1. 마지막 글자 뒤 간격 누락 → CSS 보다 항상 1칸 좁음
2. `text.length` 는 UTF-16 길이 — 서로게이트 페어 (이모지) 를 2로 센다

`ctx.letterSpacing` 지원 시 셰이퍼에 맡기고, 미지원 시 `Array.from(text).length × spacing`
(grapheme 수, trailing 포함) 으로 고쳤다.

## 4. 원복 RED

`canvas2dSegmentCache.test.ts` 8건 + `textMeasure.test.ts` 3건 신규. mock `measureText` 는
Chrome 실측 규칙 (`text.length * 8 + spacing * grapheme 수`) 을 흉내낸다.

수정 전 RED 5건:

| 테스트                                            | Before          | After |
| ------------------------------------------------- | --------------- | ----- |
| `buildFontKey` 가 letterSpacing 을 키에 넣는다    | 같은 키 (오염)  | 분리  |
| letterSpacing 은 fallback 이 아니다               | `true`          | `false` |
| `getOrMeasureWidth` 가 ctx.letterSpacing 적용     | 24              | 30    |
| `measureWithCanvas2D` 가 폭·줄바꿈에 반영         | width 40        | 50    |
| `Canvas2DTextMeasurer` trailing 간격 포함         | 28              | 30    |

수정 후 `canvas` 스위트 **1609 PASS** (182 파일) · `pnpm type-check` PASS.
구 `needsFallback` 테스트 1건은 지원/미지원 두 갈래를 재는 형태로 교체했다.

## 5. Live 확인 — 이 축은 아직 Skia 에 결선되어 있지 않다 (CRITICAL 발견)

문서 §B5 는 이 항목의 live 검증을 "letter-spacing 2px Text 의 Skia↔Preview 폭·줄 수 대조" 로
정했다. **실행했더니 대조가 불가능했다** — 값이 Skia 에 도달하지 않는다.

빌더에 Text 1개를 만들고 인라인 style 을 주었다
(`width 150px · Arial 16px · lineHeight 24px · **letterSpacing 2px**`):

| 축                       | 결과                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| Chrome DOM 오라클 (ls 2) | `ab cd ef gh ij kl` / `mn op`                                        |
| Chrome DOM 오라클 (ls 0) | `ab cd ef gh ij kl mn` / `op`                                        |
| 빌더 Skia 렌더           | `ab cd ef gh ij kl mn` / `op` — **ls 0 결과**                        |
| Skia scene node          | `__composition_SKIA_DEBUG__.getSkiaNode(id)` 의 `text` 에 **`letterSpacing` 키 자체가 없다** (`fontSize` 16 · `lineHeight` 24 · `fontFamilies` 는 전부 도달) |

원인 (코드 대조):

- Skia 텍스트 노드의 `letterSpacing` 은 `specShapeConverter.ts:891` 이 **`shape.letterSpacing`**
  에서만 읽는다 — 요소 인라인 `style.letterSpacing` 을 읽는 경로가 없다.
- 레이아웃 측 유일 유입은 `utils.ts:2102` 의 `inlineSpecStyle?.letterSpacing` 인데, 그 값은
  `specTextStyle.ts:291` 이 **spec text shape** 에서 만든다.
- `grep letterSpacing packages/shared/src/catalog/generated/componentRulesTable.ts` → **0건**,
  `packages/specs/src/components/*.ts` → **0건**. 즉 shape 에 letterSpacing 을 넣는 정의가 없다.

⇒ `node.text.letterSpacing` 은 production 에서 **항상 undefined** 이고, 따라서 구
`needsFallback` 의 letterSpacing 분기는 **한 번도 실행되지 않는 dead 조건**이었다.
문서가 근거로 든 "`TypographySection.tsx:276` 노출 — production 경로" 는 **CSS/Preview 한정**이
맞고 Skia 축은 성립하지 않는다.

## 6. 이번 커밋이 한 것 / 안 한 것

- **한 것**: 측정기가 letterSpacing 을 CSS 와 같은 규칙으로 잴 수 있게 됐다 (결선되면 그대로
  맞는다). 기본 측정기의 실제 공식 결함 1건을 고쳤다.
- **안 한 것**: 인라인 `style.letterSpacing` → 레이아웃 측정 → Skia 텍스트 노드 결선.
  fontSize 인라인 override 만 해도 `utils.ts` 8곳 + catalog/shape 경로에 흩어져 있어
  (`parseNumericValue(style?.fontSize)` 패턴) 새 시각 축 하나를 D3 에 추가하는 규모다.
  scope 변경이라 사용자 판정 전까지 착수하지 않는다.
- 따라서 이번 변경의 **사용자-가시 동작 변화는 0** 이다 (dead 조건 제거 + 미결선 축의 준비).
