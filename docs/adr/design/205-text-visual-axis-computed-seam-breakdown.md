# ADR-205 design breakdown — 텍스트 시각 축 computed 단일 seam

> 본 문서가 구현 상세의 정본이다. ADR 본문은 결정·위험·게이트만 둔다.
> 상태: **Phase 0~5 반영 완료 (2026-09-05) — ADR Implemented.** 조건부 후속이던 Phase 4·5 도
> 같은 날 사용자 지시로 이어서 반영했다 ([evidence §10](../evidence/205-text-axis-gap-matrix.md)
> · [§11](../evidence/205-text-axis-gap-matrix.md)). R7 은 Phase 5 로 종결.

## 1. Fork 게이트 4 질문 lock-in

본 ADR 은 **완전 신규 주제**다 (기존 ADR 의 잔여 영역 분리도, base/응용 split 도 아님).
그래도 인접 ADR 과의 방향을 오해하지 않도록 4 질문을 명시 lock-in 한다
(`.claude/rules/adr-writing.md` §ADR Fork).

1. **base / 응용 분류**: ADR-051 (Canvas 2D 텍스트 측정) 은 "무엇으로 재는가"(측정 엔진),
   본 ADR 은 "무슨 값을 재는가"(측정기·렌더러의 입력 해소). 두 축은 **직교**이며 한쪽이 다른
   쪽의 specialization 이 아니다. 본 ADR 은 ADR-051 의 **입력**을 고치므로 051 의 후속도
   선행도 아니다 — 상위 권위는 D3 (ADR-063 charter · ADR-142 SSOT 재정의).
2. **schema 직교성**: ADR-051 은 `TextMeasureStyle` 을 **소비**하고, 본 ADR 은 그 값을
   **생산**하는 지점을 단일화한다. schema 교집합은 `TextMeasureStyle` 한 타입뿐이고 서로
   다른 방향에서 만난다 → 직교.
3. **선행 ADR 전제 reverse 검증**: ADR-051 의 전제("측정은 브라우저 폰트 엔진이어야 CSS
   정합")를 본 ADR 이 그대로 쓴다. 의존 방향 반전 없음 —
   `grep -rn "TextMeasureStyle" apps/builder/src | grep -v test` 로 생산/소비 방향 확인.
4. **codex 3차까지 미루지 않음**: 위 1~3 을 착수 전 시점(2026-09-05)에 lock-in.

**사용자 confirm 기록**: 2026-09-05 세션 — AskUserQuestion "결선 범위" 에서 **전 축 결선
(ADR 규모)** 선택 + `/create-adr 텍스트 시각 축 computed 단일 seam — letterSpacing 결선`
직접 입력. 본문 self-lock-in 이 아니라 사용자 선택이 선행했다.

## 2. Phase 0 — 코드 사실 표 (착수 전 전수 대조용) ✅ 반영 완료 2026-09-05

각 행은 사실 1줄 + 경로:라인 + 확인 명령. 리뷰어는 명령을 그대로 실행해 대조할 수 있다.

| #   | 사실                                                                                                                                                                                                                                                                                                                | 경로:라인                                                                                           | 확인 명령                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F1  | `cssResolver` 가 텍스트 CSS 17종을 상속 속성으로 선언하고 그 안에 `letterSpacing` 이 있다                                                                                                                                                                                                                           | `layout/engines/cssResolver.ts:43`                                                                  | `sed -n '33,53p' apps/builder/src/builder/workspace/canvas/layout/engines/cssResolver.ts`                      |
| F2  | `CSS_INITIAL_VALUES.letterSpacing = 0` — 초기값도 이미 정의                                                                                                                                                                                                                                                         | 같은 파일 `:78`                                                                                     | `grep -n "letterSpacing: 0," …/cssResolver.ts`                                                                 |
| F3  | `ComputedStyle` 타입에 `letterSpacing: number` 가 있고 `ROOT_COMPUTED_STYLE` 이 0 을 준다                                                                                                                                                                                                                           | 같은 파일 `:233, :242, :274`                                                                        | `sed -n '233,280p' …/cssResolver.ts`                                                                           |
| F4  | `resolveStyle()` 이 inline + cascade 키워드 + 상속을 해소해 `ComputedStyle` 을 만든다                                                                                                                                                                                                                               | 같은 파일 `:581`                                                                                    | `sed -n '575,600p' …/cssResolver.ts`                                                                           |
| F5  | `enrichWithIntrinsicSize` 가 `_computedStyle` 을 이미 인자로 받는다                                                                                                                                                                                                                                                 | `layout/engines/utils.ts:4913`                                                                      | `sed -n '4913,4925p' …/utils.ts`                                                                               |
| F6  | 그 함수는 computed 를 `whiteSpace`(`resolveTextLeafWhiteSpace`) 외에 fontSize·fontFamily·fontWeight 에도 쓴다 (inline → computed → default)                                                                                                                                                                         | 같은 파일 `:5026` · `:5051` · `:5240` · `:5247` · `:5250`                                           | `grep -n "_computedStyle" …/utils.ts`                                                                          |
| F7  | 레이아웃 텍스트 측정은 `measureTextWidth(text, fontSize, family, weight, extra?)` 로 호출마다 스타일 조립                                                                                                                                                                                                           | 같은 파일 `:1341`                                                                                   | `grep -n "measureTextWidth(" …/utils.ts`                                                                       |
| F8  | 인라인 fontSize override 가 `parseNumericValue(style?.fontSize)` 패턴으로 **21곳**에 흩어져 있다                                                                                                                                                                                                                    | 같은 파일 (21 occurrences)                                                                          | `grep -c "parseNumericValue(style?.fontSize)" …/utils.ts`                                                      |
| F9  | 레이아웃 **폭 leg** 은 인라인+computed letterSpacing 을 이미 소비한다 — `parseNumericValue(style?.letterSpacing) ?? computedStyle?.letterSpacing ?? 0` (wordSpacing·fontStyle·fontStretch·fontVariant·lineHeight·textTransform 도 같은 규칙)                                                                        | `utils.ts:2210-2255` (`calculateContentWidth` 일반 요소 분기)                                       | `sed -n '2205,2255p' …/utils.ts`                                                                               |
| F9b | 그 분기의 진입은 `enrichWithIntrinsicSize` 이며 `_computedStyle` 을 넘긴다 (텍스트 leaf 포함)                                                                                                                                                                                                                       | `utils.ts:5210` · `:5219`                                                                           | `sed -n '5204,5226p' …/utils.ts`                                                                               |
| F9c | spec shape 채널(`inlineSpecStyle?.letterSpacing`)은 그와 별개이며 F12 때문에 항상 undefined                                                                                                                                                                                                                         | `utils.ts:2101` · `utils/specTextStyle.ts:291`                                                      | `sed -n '2095,2105p' …/utils.ts` · `sed -n '285,295p' …/specTextStyle.ts`                                      |
| F10 | Skia 텍스트 노드의 letterSpacing 은 `shape.letterSpacing` 에서만 온다 (인라인 style 읽는 경로 없음)                                                                                                                                                                                                                 | `skia/specShapeConverter.ts:891`                                                                    | `grep -n "letterSpacing" …/specShapeConverter.ts`                                                              |
| F11 | 렌더가 `node.text.letterSpacing` 을 Canvas 2D 측정 스타일로 그대로 넘긴다                                                                                                                                                                                                                                           | `skia/nodeRendererText.ts:532` (그 외 463 · 648)                                                    | `grep -n "letterSpacing" …/nodeRendererText.ts`                                                                |
| F12 | catalog `COMPONENT_RULES_TABLE` · 잔존 spec 3개에 letterSpacing 정의 **0건** → F10/F11 의 값은 항상 undefined                                                                                                                                                                                                       | `packages/shared/src/catalog/generated/componentRulesTable.ts`                                      | `grep -c letterSpacing packages/shared/src/catalog/generated/componentRulesTable.ts` → 0                       |
| F13 | DOM/Preview 는 renderer root 에 `style={element.props.style}` 를 그대로 실어 브라우저 cascade 가 처리한다                                                                                                                                                                                                           | `packages/shared/src/renderers/**` (62곳, ADR-907 Layer C 계약)                                     | `grep -rn "style={element.props.style" packages/shared/src/renderers/ \| wc -l`                                |
| F14 | CSSGenerator 는 spec `size.letterSpacing` 을 `letter-spacing` 으로 emit 한다 (인라인과 별개 채널)                                                                                                                                                                                                                   | `packages/specs/src/renderers/CSSGenerator.ts:969-971`                                              | `sed -n '965,975p' packages/specs/src/renderers/CSSGenerator.ts`                                               |
| F15 | **live**: 인라인 `letterSpacing: "2px"` 인 Text 의 Skia scene node `text` 객체에 `letterSpacing` 키가 없다                                                                                                                                                                                                          | 2026-09-05 Chrome MCP 실측                                                                          | 빌더에서 `__composition_SKIA_DEBUG__.getSkiaNode(id)` → `text` 키 확인 (fontSize·lineHeight 는 도달)           |
| F16 | **live**: 같은 요소의 Skia 줄바꿈이 Chrome DOM 의 `letter-spacing: 0` 결과와 일치 (ls 2 결과와 불일치)                                                                                                                                                                                                              | 2026-09-05 Chrome MCP 실측                                                                          | `evidence/051-letterspacing-canvas2d.md` §5 표                                                                 |
| F17 | 측정기 쪽은 이미 letterSpacing 을 CSS 규칙대로 잰다 (2026-09-05 `8b6c1bd22`)                                                                                                                                                                                                                                        | `utils/canvas2dSegmentCache.ts` `needsFallback` · `getOrMeasureWidth`                               | `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/utils/canvas2dSegmentCache.test.ts` |
| F18 | Skia 에는 인라인 style 을 텍스트 자식으로 옮기는 **일반화 블록**이 이미 있다 (ADR-057 Phase A/B, **13종** — whiteSpace·wordBreak·overflowWrap·lineHeight·textIndent·clipText·textDecoration(+style/color)·textOverflow·**wordSpacing**·fontVariant·fontStretch·textShadow·verticalAlign). **letterSpacing 만 부재** | `skia/buildSpecNodeData.ts:2050-2165`                                                               | `sed -n '2050,2070p' …/buildSpecNodeData.ts` · `grep -c letterSpacing …/buildSpecNodeData.ts` → 0              |
| F19 | 레이아웃 **wrap/height leg** 은 letterSpacing 인자 자체가 없다 — 줄 수를 만드는 leg 이고 F16 증상의 원인                                                                                                                                                                                                            | `utils.ts:5469` `measureTextWithWhiteSpace` → `utils/textMeasure.ts:531` `measureWrappedTextHeight` | `sed -n '5469,5482p' …/utils.ts` · `sed -n '531,545p' …/utils/textMeasure.ts`                                  |
| F20 | Skia scene build 경로에 `ComputedStyle` 이 **존재하지 않는다** — 참조 0건, `specShapesToSkia` 는 요소 style 도 computed 도 받지 않으며 `resolveStyle()` 결과는 재귀 지역 변수로만 산다                                                                                                                              | `canvas/skia/**` (0건) · `specShapeConverter.ts:162` · `fullTreeLayout.ts:1872`                     | `grep -rn "ComputedStyle\|resolveStyle(" apps/builder/src/builder/workspace/canvas/skia/` → 0                  |
| F21 | `node.text.letterSpacing` 은 paragraph **캐시 키**에도 들어간다 — 결선 시 같이 갱신하지 않으면 stale paragraph                                                                                                                                                                                                      | `skia/textParagraphKey.ts:44`                                                                       | `grep -n "letterSpacing" …/skia/textParagraphKey.ts`                                                           |

### Phase 0 산출물 — 반영 결과 (2026-09-05)

**생성물**: [evidence/205-text-axis-gap-matrix.md](../evidence/205-text-axis-gap-matrix.md) —
`scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다 (`--check` 로 drift 검사, Phase 2 에서 pre-push 배선).

측정 결과: 속성 **22개** (A 16 ∪ B 14). 측정 축 중 **wrap leg 과 Skia 인라인 양쪽에 미도달**인 것은
`letterSpacing` · `fontStyle` · `textTransform` **3개**뿐이고, Phase 1 범위는 그중 live 증상(F15·F16)의
원인인 **`letterSpacing` 한 축**으로 확정된다. 예상했던 결손 3자리 중 ①wrap leg ②Skia 인라인은 표로
확증됐고, ③게이트는 Phase 2 에서 만든다. 상세·후속 목록은 생성물 §4.

### Phase 0 산출물 (설계 시점 정의)

- **텍스트 CSS 속성 격차표**: 텍스트 CSS 속성 × {DOM 소비 · layout 폭 leg 도달 · layout wrap leg 도달 · Skia 도달} × {인라인 채널 · 상속 채널}. F1~F21 을 그 표의 첫 행들로 채운다. **이 표가 Phase 1 의 범위를 정한다** — 추정으로 범위를 잡지 않는다.
- 속성 집합의 출처는 코드 2곳의 합집합이다 (R4) — `cssResolver.INHERITABLE_PROPERTIES` 의 텍스트 항목(F1, `visibility` 제외) ∪ ADR-057 블록이 소비하는 비상속 텍스트 속성(F18). 어느 쪽도 단독으로는 "DOM 이 소비하는 텍스트 CSS 속성 집합" 이 아니다.
- 격차표는 코드가 생성한다 (게이트 G4 의 입력과 같은 소스).
- 현 시점 예상 결손 3자리 (G0 가 확증할 대상): ① wrap leg (F19) · ② Skia 인라인 (F18) · ③ 게이트 부재. 상속 축의 layout↔paint 발산 (F20, R7) 은 Phase 5 입력으로 별도 열에 기록만 한다.

## 3. Phase 1 — seam 신설 (letterSpacing 단독 소비자, 인라인 채널만) ✅ 반영 완료 2026-09-05

- `resolveTextRenderStyle(style, computed?)` 신설 — 위치는 `canvas/utils/` (layout·skia 양쪽에서 import 가능한 곳). 반환은 `TextMeasureStyle` 의 텍스트 축 조각.
- 규칙은 `resolveTextLeafWhiteSpace` (F6) 와 같다: inline 우선, 없으면 computed, cascade 키워드는 computed 가 해석한 값. **`computed` 는 선택 인자** — 없으면 인라인만 해소한다.
- 이 phase 에서는 **letterSpacing 한 축만** seam 을 통해 흐르게 한다. fontSize 21곳(F8) 은 건드리지 않는다.
- **소비자 3곳** (각각 현행 결손이 다르다 — F9·F19·F18 대조):
  - (a) 레이아웃 **폭 leg** — `calculateContentWidth` 일반 요소 분기 (`utils.ts:2210-2212`). 이미 인라인+computed 를 읽으므로 **값 변화 0**이고, 조립 로직만 seam 호출로 교체한다 (동작 무변경 리팩터 — 원복 RED 는 seam 미경유 검출 테스트로).
  - (b) 레이아웃 **wrap/height leg** — `measureTextWithWhiteSpace` (`utils.ts:5469`) → `measureWrappedTextHeight` (`utils/textMeasure.ts:531`) → `measureWrapped`. **여기가 실제 결손이다** (F19). 세 계층에 letterSpacing 을 실어 줄 수가 CSS 와 맞게 한다. computed 는 호출부가 이미 쥐고 있다 (F9b).
  - (c) Skia 텍스트 노드 — `buildSpecNodeData.ts:2050-2165` 의 ADR-057 블록(F18)에 letterSpacing 을 seam 경유로 추가한다. **`specShapeConverter` 가 아니다** — 그 함수는 요소 style 도 computed 도 받지 않는다 (F20). 우선순위는 인라인 > `shape.letterSpacing` (R6). `textParagraphKey.ts:44` 캐시 키 동반 갱신 (F21).
- **상속(computed)은 이 phase 의 Skia leg 에 넣지 않는다** — scene build 에 `ComputedStyle` 이 없어(F20) cascade 배선이 필요하고, 그것은 Phase 5 다. Phase 1 종료 시점의 상태: 인라인 ls 는 layout·Skia 모두 일치, 상속 ls 는 layout 만 반영 (R7).

## 4. Phase 2 — 대칭 게이트 ✅ 반영 완료 2026-09-05

- 두 축을 같이 본다 (G4):
  - **집합 대조** — 텍스트 CSS 속성 집합 ↔ seam 필드 집합. 새 텍스트 속성이 한쪽에만 생기면 RED.
  - **도달 검사** — 각 속성이 두 소비자(layout wrap leg · Skia 텍스트 노드)에 실제로 닿는지. 필드는 있는데 표면에 안 닿는 형태(F15 가 그 형태였다)를 집합 대조만으로는 못 잡는다.
- 집합의 출처는 §2 Phase 0 산출물의 합집합 규칙 (F1 ∪ F18) — 손 목록 신설 금지.

## 5. Phase 3 — live + 회귀 ✅ 반영 완료 2026-09-05

- 빌더 Text 에 인라인 `letter-spacing: 2px` → Skia 줄바꿈이 Chrome DOM 오라클과 일치.
- `evidence/051-letterspacing-canvas2d.md` §1 의 오라클 스크립트를 그대로 재사용.
- 부모 상속 케이스(부모에 `letter-spacing`, 자식 Text 는 미지정)는 **불일치가 예상 결과**다 (R7) — 그 값을 실측해 Phase 5 착수 판정의 입력으로 기록한다.

## 6. Phase 4 — fontSize ✅ 반영 완료 2026-09-05

착수 전 인벤토리에서 **21곳이 4가지 우선순위로 갈리고 그중 3곳만 computed 를 읽는다**는 것이
드러났다 (인라인 즉시반환 5 · catalog/spec 기본 13 · spec 우선 3 · computed 소비 3). 전부를 한
해소식으로 뭉치면 나머지 18곳에 상속이 새로 생기는 **동작 변경**이라, seam 은 인라인 채널만
공급하고 뒤 fallback 은 호출부에 남겼다 — 수렴되는 것은 **파싱 규칙 하나**다.

그 인벤토리가 결손을 하나 찾았다: seam 에 `fontSize` 축을 선언한 순간 G4 ② 가 RED 가 됐고,
`resolveSpecFontSize` 가 px 문자열(= 인라인 style 의 정본 저장 형태)을 버리고 있었다. 수리와
근거는 [evidence §10](../evidence/205-text-axis-gap-matrix.md).

## 7. Phase 5 — Skia 상속 배선 ✅ 반영 완료 2026-09-05

착수 전 확인의 결론: **fork 불필요**. 두 갈래(재계산 vs 보존 채널 신설) 중 어느 쪽도 아닌
셋째 길이 있었다 — 레이아웃은 이미 요소마다 `ComputedLayout` 을 만들어 Skia 로 보내고
scene build 는 그것을 읽는다. 새 채널이 아니라 **있는 레코드에 선택 필드 `textAxes` 하나를
더하는 것**이라 계약 신설이 아니고, 값도 순회 중 누적이라 재계산이 아니다.

핵심 계약 둘: (a) `resolveStyle` 결과를 그대로 싣지 않는다 — 미선언과 CSS 초기값을 구별하지
못해 catalog 기본을 0 으로 덮는다 (R6). 조상이 **선언한** 축만 싣고 필드 부재가 "아무도
선언하지 않았다" 는 뜻이다. (b) letterSpacing 한 축만 — fontSize 는 layout 18곳이 상속을
읽지 않아 Skia 만 상속시키면 거울상 결손이 된다. 상세: [evidence §11](../evidence/205-text-axis-gap-matrix.md).

## 8. 범위 밖

- `wordSpacing` — `ctx.measureText` 미반영, upstream pretext 도 미지원 (ADR-051 §B4-7). Skia 쪽은 ADR-057 블록(F18)이 이미 인라인을 운반하므로 seam 수렴 대상일 뿐 신규 결선이 아니다.
- 텍스트 **렌더** 속성 중 측정에 영향 없는 것 (`color` 등) 은 이미 다른 경로가 소유.
- catalog 에 letterSpacing 축을 추가하는 것 (대안 C, 기각).
- ADR-057 블록의 나머지 12종을 seam 으로 옮기는 것 — Phase 4 와 같은 조건부 수렴 대상.
- `fontSize` 상속 — **결손이 아님이 실측으로 확정** (2026-09-05,
  [evidence §12](../evidence/205-text-axis-gap-matrix.md)). 컴포넌트 CSS 가 `font-size` 를
  선언하므로 Preview 도 상속하지 않는다 (부모 23px 아래 `.react-aria-Text` 16px). 캔버스가
  catalog 기본으로 그리는 현재 동작이 대칭이며, 상속을 이으면 오히려 발산이 생긴다.
