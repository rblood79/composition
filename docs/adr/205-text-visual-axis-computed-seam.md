# ADR-205: 텍스트 시각 축 computed 단일 seam — letterSpacing 결선

## Status

Proposed — 2026-09-05

## Context

Styles 패널이 노출하는 `letter-spacing` 이 **Preview 에만 반영되고 Canvas(Skia) 에는 도달하지
않는다**. 2026-09-05 live 실측 — 인라인 `letterSpacing: "2px"` 인 Text 의 Skia scene node
`text` 객체에는 그 키 자체가 없고 (`fontSize`·`lineHeight`·`fontFamilies` 는 도달), 줄바꿈이
Chrome 의 `letter-spacing: 0` 결과와 일치했다
([evidence](evidence/051-letterspacing-canvas2d.md) §5).

이것은 D3(시각 스타일)의 **symmetric consumer 위반**이다 — 같은 SSOT 에서 Builder 와
Preview 가 같은 시각 결과를 내야 하는데, 두 소비자가 서로 다른 입력을 읽는다.

- **DOM/Preview**: renderer root 에 `style={element.props.style}` 를 그대로 실어
  브라우저 cascade 가 상속·초기값을 처리한다 (ADR-907 Layer C, 62곳).
- **Skia**: cascade 가 없다. 속성마다 사람이 경로를 써야 한다.
  `letterSpacing` 은 `shape.letterSpacing` 에서만 오고 (`specShapeConverter.ts:891`)
  catalog·잔존 spec 에 그 정의가 **0건**이라 production 에서 항상 undefined 다.
  인라인 style 을 텍스트 자식으로 옮기는 일반화 블록이 이미 있는데
  (ADR-057 Phase A/B — `buildSpecNodeData.ts:2050-2165`, whiteSpace·wordBreak·
  overflowWrap·lineHeight·textIndent·clipText·textDecoration(+style/color)·textOverflow·
  **wordSpacing**·fontVariant·fontStretch·textShadow·verticalAlign **13종**),
  거기에 `letterSpacing` 만 빠져 있다.
- **레이아웃 측정**은 leg 이 갈린다. **폭(width) leg** 은 이미 결선돼 있다 —
  `parseNumericValue(style?.letterSpacing) ?? computedStyle?.letterSpacing ?? 0`
  (`utils.ts:2210-2212`, `enrichWithIntrinsicSize` → `calculateContentWidth` 가
  `_computedStyle` 을 넘긴다 `utils.ts:5210·5219`). 반면 **줄 수를 만드는 wrap/height leg**
  은 letterSpacing 인자 자체가 없다 (`measureTextWithWhiteSpace` `utils.ts:5469` →
  `measureWrappedTextHeight` `textMeasure.ts:531` — 시그니처에 그 축이 없다). spec shape
  유입(`inlineSpecStyle?.letterSpacing`, `utils.ts:2101`)은 세 번째 채널이고 catalog 정의
  0건이라 항상 undefined 다.

즉 결손은 **세 자리**다 — ① 레이아웃 wrap/height leg (줄 수 = live 증상), ② Skia 텍스트
노드 (ADR-057 블록의 13종에서 letterSpacing 만 빠짐), ③ 그 누락을 잡는 게이트.

인프라의 비대칭이 그 배경이다. `cssResolver` 는 텍스트 CSS 17종을 상속 속성으로 선언하고
`resolveStyle()` 이 inline + cascade 키워드 + 상속을 해소한 `ComputedStyle` 을 만든다
(`letterSpacing: number` 포함). 레이아웃은 그 값을 실제로 소비한다 —
`enrichWithIntrinsicSize` 가 `_computedStyle` 을 인자로 받고 (`utils.ts:4913`),
`whiteSpace` (`resolveTextLeafWhiteSpace`, `utils.ts:5026`) 뿐 아니라
fontSize·fontFamily·fontWeight (`utils.ts:5051·5240·5247·5250`) 와
`calculateContentWidth` 의 letterSpacing·wordSpacing·fontStyle·fontStretch·fontVariant·
lineHeight·textTransform (`utils.ts:2210-2255`) 까지 같은 규칙(inline → spec → computed →
default)으로 읽는다. **Skia 쪽에는 그 인프라가 없다** —
`grep -rn "ComputedStyle\|resolveStyle(" apps/builder/src/builder/workspace/canvas/skia/`
가 **0건**이고, `specShapesToSkia(shapes, theme, w, h, elementId)`
(`specShapeConverter.ts:162`) 는 요소 style 도 computed 도 받지 않으며, `resolveStyle()`
결과는 `fullTreeLayout.ts:1872` 의 재귀 지역 변수로만 존재해 보존·수출되지 않는다.

그 결과 두 가지가 따라온다. (1) 새 텍스트 시각 속성은 세 자리 (wrap leg 시그니처 3계층 ·
ADR-057 블록 · `textParagraphKey.ts:44` 캐시 키) 를 손으로 맞춰야 하고, 빠뜨리면
"Preview 에만 반영" 이 조용히 생긴다 — 그것을 잡는 게이트가 없다. (2) 지점마다 자기
규칙이라 CSS **상속**이 표면마다 갈린다 — 레이아웃은 부모의 letter-spacing 을 반영하는데
(`utils.ts:2211`) Skia 는 읽을 수단조차 없어, 지금도 layout↔paint 가 서로 다른 값으로
동작한다.

측정기 자체는 준비돼 있다 — 2026-09-05 `8b6c1bd22` 가 Canvas 2D 측정에 letterSpacing 을
CSS 규칙(`base + grapheme 수 × spacing`, 마지막 글자 뒤 간격 포함)대로 반영했다. 결선만 없다.

**Generator 지원 선언**: 본 ADR 은 spec/catalog schema 를 확장하지 않으므로 CSSGenerator 의
자식 selector/variant emit 지원 여부에 의존하지 않는다. Generator 는 이미
`size.letterSpacing` 을 `letter-spacing` 으로 emit 하고 있고
(`packages/specs/src/renderers/CSSGenerator.ts:969-971`), 그 채널은 본 ADR 이 다루는
**인라인 style 채널과 별개**다 — 둘의 우선순위만 R6 에서 고정한다.

**영향 범위 수식화 (BC)**: 인라인 `style.letterSpacing` 은 factory 기본값 **0건**
(`grep -rn letterSpacing apps/builder/src/builder/factories/` → 0), pencil/import 어댑터
**0건**, theme/tokens **0건** 이다. 즉 값이 생기는 유일한 경로는 사용자가 Styles 패널
Typography 에서 직접 설정하는 것뿐이며(`TypographySection.tsx:277-280`), **그 요소만**
캔버스 시각이 바뀐다. 미설정 문서는 변화 0.

**Hard Constraints**:

1. D3 대칭 — Builder(Skia) 와 Preview(DOM/CSS) 가 같은 시각 결과를 낸다
   (`.claude/rules/ssot-hierarchy.md` §1). 판정은 Chrome DOM 오라클 대조.
2. 성능 — 텍스트 측정은 layout enrich 호출마다 도는 경로이고 결과 캐시가 없다.
   `pnpm perf:baseline --lane frame` 600 요소 p95 와 `textMeasure.bench` µs 가 회귀 0.
3. 결정성 — visual-parity G3 의 10회 연속 RGBA 해시 동일 + 기존 fixture `maxByte 0` 유지
   (letterSpacing 을 실제로 쓰는 신규 fixture 는 그 대상이 아니다 — G3 참조).
4. 하위 호환 — 기존 텍스트 측정 호출 지점(fontSize 21곳 포함)의 동작을 바꾸지 않는다.
   회귀 0 을 유지한 채 수렴은 후속 phase 로 미룬다.
5. D2 — RSP 미규정 custom prop 을 신설하지 않는다. 입력은 표준 CSS 속성뿐.

**Soft Constraints**:

- ADR-051(Canvas 2D 측정)·ADR-165(intrinsic 스칼라 계약) 의 기존 계약과 공존해야 한다.
- 진행 중인 ADR-923 dirty 변경을 건드리지 않는다.
- `wordSpacing` 은 `ctx.measureText` 미반영이라 이번 범위 밖 (ADR-051 §B4-7 판정 유지).

## Alternatives Considered

### 대안 A: 속성별 배선 — 기존 지점에 letterSpacing 을 그대로 더한다

- 설명: 새 추상화 없이, 결손 세 자리에 letterSpacing 을 직접 더한다 — wrap leg 시그니처에
  인자 추가 + ADR-057 블록에 한 행 추가 + 캐시 키 갱신. 상속은 다루지 않는다.
- 근거: 저장소 안의 지배적 기존 패턴이고 fontSize·lineHeight 가 이 방식으로 동작한다.
  Skia 쪽은 ADR-057 이 이미 13종을 한 블록으로 일반화해 둬서 **한 행**이면 되므로,
  이 대안의 실제 비용은 "N개 지점 수작업" 보다 작다. 외부 대조 — Figma·Penpot 같은 캔버스
  편집기도 초기에는 속성별 배선으로 시작한다.
- 위험:
  - 기술: **L** — 새 구조가 없어 실패 모드가 좁다.
  - 성능: **L** — 지점당 필드 하나.
  - 유지보수: **H** — 축 하나당 **3파일 5지점**을 손으로 맞춰야 하고 그 누락을 잡는 게이트가
    없다. grep 가능한 경로: ① wrap leg 3계층 시그니처 (`layout/engines/utils.ts:5469`
    `measureTextWithWhiteSpace` → `utils/textMeasure.ts:531` `measureWrappedTextHeight` →
    `measureWrapped`) — 축마다 인자가 하나씩 는다, ② `skia/buildSpecNodeData.ts:2050-2165`
    ADR-057 블록 (letterSpacing 만 부재), ③ `skia/specShapeConverter.ts:891`
    `letterSpacing: shape.letterSpacing` — catalog 채널 전용, ④
    `skia/nodeRendererText.ts:463 · 532 · 648` + `skia/textParagraphKey.ts:44` 가 같은
    `node.text.letterSpacing` 을 각각 재조립 (캐시 키 미갱신 시 stale paragraph). 여기에
    폭 leg 은 이미 결선돼 있어(`utils.ts:2210-2212`) 축마다 "어디는 됐고 어디는 아닌지" 를
    사람이 기억해야 한다. CSS **상속**도 표면마다 갈린 채 남는다 — 같은 병인이 이미 두 번
    재현됐다 (letterSpacing 정의 0건 · whiteSpace 는 ADR-923 r12h1 에서야
    `utils.ts:5026` 의 computed 소비로 정정).
  - 마이그레이션: **L** — 기존 코드 변경 없음.

### 대안 B: computed 단일 seam + 두 소비자 결선 + 대칭 게이트

- 설명: `resolveTextRenderStyle(style, computed?)` 하나를 두고, 레이아웃 텍스트 측정과
  Skia 텍스트 노드가 **그 seam 만** 읽는다. 규칙은 이미 있는 선례
  `resolveTextLeafWhiteSpace(style, _computedStyle)` 와 같다 — inline 우선, 없으면
  computed, cascade 키워드는 computed 해석값. `computed` 는 **선택 인자**다: 레이아웃은
  이미 손에 쥔 `_computedStyle` 을 넘기고, Skia 는 그것을 가진 적이 없으므로 Phase 1 에서는
  넘기지 않는다 (인라인만 해소 — 상속은 조건부 Phase 5). 여기에 "텍스트 CSS 속성 집합 ↔
  seam 필드 집합 ↔ 두 소비자 도달" 대조 게이트를 붙인다. letterSpacing 이 첫 소비자.
- 근거: 인프라가 이미 있다 — `cssResolver` 가 텍스트 17종을 상속 속성으로 계산하고
  (`ComputedStyle.letterSpacing: number`), 측정 함수가 그 값을 이미 인자로 받는다.
  없는 것은 소비뿐이다 (메모리 `feedback-infra-exists-vs-wired-consumption-path`).
  외부 대조 — 브라우저 엔진(Blink/Gecko)은 shaping 직전 하나의 computed style 을 읽고,
  fulgur 도 Stylo computed 를 단일 입력으로 Parley 에 넘긴다
  (`EXTERNAL_PATTERN_DELTA_2026-09` §A1). 속성별 배선은 캐스케이드가 없는 캔버스 쪽의
  임시 형태이지 목표 형태가 아니다.
- 위험:
  - 기술: **M** — seam 이 텍스트 측정 경로를 관통하므로 회귀 표면이 넓다. 완화: Phase 1
    을 letterSpacing 한 축 + **인라인 채널만** 으로 제한한다 — cascade 를 Skia scene
    build 로 끌어오는 작업(상속)은 Phase 5 로 분리하고, fontSize 21곳은 건드리지 않는다
    (Hard 4).
  - 성능: **M** — 측정 호출마다 computed 조회가 는다. 완화: **레이아웃 소비자에 한해**
    `_computedStyle` 이 이미 같은 호출에 전달돼 있어 추가 조회가 아니라 **읽기 한 번**이다
    (`utils.ts:4913`). Skia 소비자는 Phase 1 에서 computed 를 읽지 않으므로 조회 증가 0.
    Hard 2 로 계측.
  - 유지보수: **L** — 축이 하나로 모이고, 누락은 게이트가 커밋 시점에 잡는다.
  - 마이그레이션: **M** — 상속(Phase 5)과 fontSize 수렴(Phase 4)이 둘 다 조건부·후속이다.
    그 전까지 seam 과 기존 패턴이 공존하고, Skia 는 인라인만 해소한다 (R7).

### 대안 C: catalog 에 letterSpacing 축을 추가하고 spec/catalog 경유로만 지원

- 설명: `COMPONENT_RULES_TABLE` 의 size 축에 `letterSpacing` 을 넣어 shape 로 흐르게 한다.
  인라인 `style.letterSpacing` 은 계속 미지원.
- 근거: D3 SSOT 가 catalog 라는 ADR-142 정의에 가장 곧게 맞고, 기존 `shape.letterSpacing`
  소비 경로(F10·F11)를 그대로 쓴다. CSSGenerator 도 이미 `size.letterSpacing` 을 emit 한다.
- 위험:
  - 기술: **L** — 기존 경로 재사용.
  - 성능: **L** — 변화 없음.
  - 유지보수: **M** — catalog 축이 하나 늘지만 인라인 경로의 결손은 그대로라 두 채널이
    영구 공존한다.
  - 마이그레이션: **L**.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  M   |    L     |      M       |     0      |
| C    |  L   |  L   |    M     |      L       |     0      |

루프 판정: HIGH 0 인 대안이 둘(B·C) 있으므로 새 대안 추가 없이 진행한다. C 는 위험이
낮지만 **문제를 풀지 않는다** (아래 기각 사유).

## Decision

**대안 B: computed 단일 seam + 두 소비자 결선 + 대칭 게이트**를 선택한다.

선택 근거:

1. 잔존 위험이 전부 M 이고, 둘 다 완화 수단이 코드 사실로 확인된다 — 기술 M 은 Phase 1
   범위를 letterSpacing 한 축 + 인라인 채널로 묶어 좁히고, 성능 M 은 레이아웃 소비자의
   `_computedStyle` 이 이미 같은 호출에 전달돼 있어(F5) 추가 조회가 아니라 읽기 한 번이며
   Skia 소비자는 Phase 1 에서 computed 를 읽지 않는다.
2. 이 결정만이 **재발을 막는다**. A·C 는 letterSpacing 을 고쳐도 다음 텍스트 속성에서
   같은 누락이 다시 생기고, 그것을 잡는 수단이 없다. B 의 게이트는 누락을 커밋 시점으로
   앞당긴다 (ADR-051 의 letterSpacing 분기가 5개월간 dead 였던 것을 아무도 몰랐다).
3. CSS **상속**의 해소 지점이 하나가 된다. 레이아웃은 seam 이 computed 를 받으므로 즉시
   맞고 (`utils.ts:2211` 의 현행 동작을 seam 으로 옮긴 것), Skia 는 cascade 를 scene
   build 로 배선하는 Phase 5 에서 **같은 seam 에 인자 하나를 넘기는 것**으로 닫힌다.
   A 로는 그 두 표면에 상속 규칙을 각각 다시 써야 한다.

**Phase 분리 질문** (HIGH 누적 착시 방지): 채택안은 HIGH 0 이라 threshold 초과가 아니다.
그럼에도 무거운 두 phase — Phase 4 (fontSize 21곳 수렴) 와 **Phase 5 (Skia cascade 배선
= 상속)** — 는 **본 ADR 에서 분리 가능한가**를 먼저 물었고, 답은 "분리 대신 조건부" 다.
둘 다 seam 이 한 phase 를 버틴 뒤 별도 판정으로 착수하며, 착수 시점에 그 규모가 별도 ADR
을 요구하면 그때 fork 한다. Phase 5 를 Phase 1 에 합치지 않는 이유는 표면 최소화다 —
`ComputedStyle` 은 현재 레이아웃 엔진 밖에 존재하지 않으므로(`canvas/skia/**` 참조 0건)
Phase 1 에 합치면 회귀 표면이 scene build 전체로 커지고 기술 위험이 M→H 로 오른다.
Phase 1~3 만으로 G1 (사용자-가시 결함 해소 — 인라인 letter-spacing) 이 닫히므로 Phase 4·5
는 본 ADR 의 종결 조건이 아니다. **사용자 판정 2026-09-05**: "인라인만 Phase 1, 상속은
조건부 Phase".

기각 사유:

- **대안 A 기각**: 유지보수 HIGH. 축마다 3파일 5지점 수작업 + 누락 게이트 부재 + 표면마다
  갈리는 상속이 현재 결함의 **원인**이다. Skia 쪽 비용이 ADR-057 블록 덕에 한 행이라는
  사실은 A 를 싸게 만들지만, 그 블록 자체가 "인라인만 · 상속 없음 · 게이트 없음" 형태라
  같은 결손을 다음 축에서 그대로 재생산한다. 같은 형태를 늘리는 것은 증상 수정이다.
- **대안 C 기각**: 위험은 낮지만 요구를 충족하지 못한다. Styles 패널이 노출하는 값은
  인라인 `style.letterSpacing` 이므로(D2 상 표준 CSS 속성), catalog 축만 추가하면
  사용자가 패널에서 조정한 값은 여전히 Preview 에만 반영된다. 문제 정의를 바꾸는 대안이다.

> 구현 상세: [205-text-visual-axis-computed-seam-breakdown.md](design/205-text-visual-axis-computed-seam-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | seam 도입이 텍스트 측정 폭을 미세하게 바꿔 기존 줄바꿈·fit-content 가 흔들린다                                                                                                         |  MED   | Phase 1 을 letterSpacing 한 축 + 인라인 채널로 제한 (다른 축은 seam 을 지나되 값이 종전과 동일). G3 결정성 + visual-parity 로 판정                                                                                                                            |
| R2  | 측정 호출당 computed 읽기가 늘어 편집·리사이즈 pass 비용 증가                                                                                                                          |  MED   | **레이아웃 소비자 한정** — `_computedStyle` 이 이미 전달돼 있어 추가 조회 아님 (F5). Skia 소비자는 Phase 1 에서 computed 미사용 (조회 증가 0). 늘어나는 실비용은 ls≠0 요소의 `ctx.letterSpacing` set + fontKey 분기 캐시 미스이며 G2 가 그 케이스를 명시 측정 |
| R3  | seam 과 기존 `parseNumericValue(style?.fontSize)` 패턴(21곳)이 한동안 공존해 두 규칙이 갈린다                                                                                          |  MED   | 격차표(Phase 0)가 어느 속성이 어느 규칙을 타는지 명시. Phase 4 수렴은 조건부 — seam 이 한 phase 를 버틴 뒤 별도 판정                                                                                                                                          |
| R4  | 게이트의 속성 집합이 손 목록이면 그 자체가 드리프트한다                                                                                                                                |  MED   | 집합의 출처를 코드 2곳의 합집합으로 고정 — `cssResolver.INHERITABLE_PROPERTIES` 의 텍스트 항목(F1, `visibility` 제외) ∪ ADR-057 블록이 소비하는 비상속 텍스트 속성(F18, textDecoration·textShadow·textOverflow·verticalAlign 등). 손 목록 신설 금지           |
| R5  | 인라인 letterSpacing 이 Skia 에 도달하기 시작하면 **기존 문서의 시각이 바뀐다** (지금까지 무시되던 값)                                                                                 |  MED   | 영향 범위는 사용자가 Styles 패널에서 직접 설정한 요소뿐 — factory 기본값·import 어댑터·theme 모두 0건 (Context §영향 범위). 미설정 문서는 변화 0. 의도된 변경이므로 CHANGELOG 사용자-가시 항목으로 고지하고 Phase 3 live 로 Chrome 일치를 남긴다              |
| R6  | Skia 텍스트 노드가 seam 을 읽으면 `shape.letterSpacing`(catalog 채널)과 우선순위 충돌이 생긴다                                                                                         |  LOW   | 우선순위를 CSS 와 같게 고정 — 인라인 > catalog/spec. 정적 테스트로 순서 고정                                                                                                                                                                                  |
| R7  | Phase 1 이 인라인만 해소하므로 **부모 상속 ls 에서 layout↔paint 가 갈린 채 남는다** — 레이아웃은 `computedStyle.letterSpacing` 을 반영(`utils.ts:2211`)하는데 Skia 는 읽을 수단이 없다 |  MED   | 신규 위험이 아니라 **현행 상태의 명시**다 (Phase 1 이 인라인 축만 좁혀 닫는다). Phase 0 격차표가 "인라인 / 상속" 을 별도 열로 구분하고, Phase 5 (Skia cascade 배선) 착수 판정의 입력으로 쓴다. 그때까지 상속 ls 는 알려진 미지원으로 CHANGELOG 에 기록        |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                                                                                                         |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 종료 | 텍스트 CSS 속성 × {DOM 소비 · layout 폭 leg 도달 · layout wrap leg 도달 · Skia 도달} × {인라인 · 상속} 격차표가 **코드에서 생성**되고, F1~F21 이 그 표와 모순 없음                                                                                                                                                                               | 격차가 문서화된 3자리(wrap leg · Skia · 게이트)를 넘으면 Phase 1 범위를 사용자 판정으로 재확정                                       |
| G1   | Phase 1 종료 | 인라인 `letter-spacing: 2px` Text 의 Skia 줄바꿈 == Chrome DOM 오라클 (`evidence/051-letterspacing-canvas2d.md` §1 스크립트). ls 0 도 종전 동일. **상속 ls 는 대상 아님** (R7 — Phase 5)                                                                                                                                                         | seam 우선순위(R6) 재검토 후 재측정. 2회 실패 시 Phase 1 원복 + 사용자 보고                                                           |
| G2   | Phase 1 종료 | `pnpm perf:baseline --lane frame` 600 요소 p95 회귀 0 · `textMeasure.bench` 파이프라인 µs 회귀 0. **불리 케이스 필수** (measurement-validity §1 Q2) — 기존 600 요소 문서에는 ls≠0 이 0건이라(BC 절) 새 경로가 실행되지 않으므로, **텍스트 leaf 의 절반 이상이 ls≠0 인 arm** 을 대조군과 함께 측정한다 (측정 조건 기록: 기기·DPR·visibilityState) | seam 을 텍스트 leaf 경로로만 좁히거나 prepared 캐시 도입을 별도 판정                                                                 |
| G3   | Phase 1 종료 | visual-parity smoke PASS + **G3** 10회 연속 RGBA 해시 동일. 기존 fixture `maxByte 0` (회귀 없음) **와 함께**, ls≠0 을 쓰는 신규 fixture 1개가 변경 전 arm 대비 `maxByte > 0` (= 새 경로가 실제로 그려진다)                                                                                                                                       | 발산 region 을 특정해 우선순위·상속 규칙 중 어느 쪽인지 판정. 신규 fixture 가 `maxByte 0` 이면 결선 미도달로 판정하고 Phase 1 재작업 |
| G4   | Phase 2 종료 | 두 조건 동시 — ① 텍스트 속성을 seam 필드 집합에서 하나 빼면 정적 테스트 RED (집합 대조), ② 그 속성의 **소비자 도달**(layout wrap leg · Skia 텍스트 노드)을 끊으면 RED (도달 검사 — F15 형태의 "필드는 있는데 표면에 안 닿음" 차단). pre-push 훅과 `push:main` 워크플로에서 실행                                                                  | ②만 실패하면 도달 검사를 parity fixture 기반으로 대체. 전체 실패 시 `codex:preflight` 로 옮겨 커밋 시점 검사로 강등                  |
| G5   | Phase 3 종료 | 관련 스위트 회귀 0 (`canvas` 1609+ · parity baseline 동일) + CHANGELOG·evidence 반영                                                                                                                                                                                                                                                             | 회귀 원인이 seam 이면 Phase 1 원복, 기존 결함이면 baseline 대조로 분리 기록                                                          |

## Consequences

### Positive

- Styles 패널에서 **직접 설정한** `letter-spacing` 이 Canvas 와 Preview 에서 같은 결과를
  낸다 — 지금은 Preview 에만 반영된다.
- 레이아웃 내부의 두 leg (폭 · wrap/height) 이 같은 규칙을 읽는다 — 지금은 폭만 인라인·상속
  ls 를 반영하고 줄 수는 무시한다.
- CSS 상속의 해소 지점이 seam 하나로 모인다. 레이아웃은 즉시 반영되고, Skia 는 Phase 5 에서
  같은 seam 에 인자를 하나 넘기는 것으로 닫힌다.
- 새 텍스트 시각 속성의 "한쪽에만 반영" 이 커밋 시점에 잡힌다 (G4 — 집합 대조 + 도달 검사).
  ADR-051 의 letterSpacing 분기가 5개월간 dead 였던 종류의 사각이 닫힌다.
- ADR-051 `8b6c1bd22` 로 이미 갖춘 측정 능력이 실제로 쓰이기 시작한다.

### Negative

- `canvas/utils` 에 seam 파일 1개와 정적 게이트 1개가 늘어난다.
- Phase 4 전까지 텍스트 축이 두 규칙(seam · `parseNumericValue(style?.fontSize)` 21곳)으로
  갈려 있다 — 격차표를 읽어야 어느 쪽인지 안다 (R3).
- Phase 5 전까지 **부모에서 상속된** letter-spacing 은 레이아웃만 반영하고 Skia paint 는
  무시한다 (R7). 인라인 축이 닫히는 동안 상속 축의 layout↔paint 발산은 그대로 남는다 —
  현행 상태와 같지만, 이제는 알려진 미지원으로 기록된다.
- Skia 쪽 seam 결선은 ADR-057 블록(`buildSpecNodeData.ts:2050-2165`)과 한동안 공존한다 —
  letterSpacing 은 seam 을, 나머지 13종은 그 블록을 탄다.
- 지금까지 무시되던 인라인 letter-spacing 이 반영되므로 **그 값을 쓰던 기존 문서의 캔버스
  시각이 바뀐다** (R5). Preview 와 같아지는 방향이지만 변화는 변화다.
