# ADR-205 design breakdown — 텍스트 시각 축 computed 단일 seam

> 본 문서가 구현 상세의 정본이다. ADR 본문은 결정·위험·게이트만 둔다.
> 상태: 설계, Phase 0 대기.

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

## 2. Phase 0 — 코드 사실 표 (착수 전 전수 대조용)

각 행은 사실 1줄 + 경로:라인 + 확인 명령. 리뷰어는 명령을 그대로 실행해 대조할 수 있다.

| #   | 사실                                                                                                          | 경로:라인                                                             | 확인 명령                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F1  | `cssResolver` 가 텍스트 CSS 17종을 상속 속성으로 선언하고 그 안에 `letterSpacing` 이 있다                     | `layout/engines/cssResolver.ts:43`                                    | `sed -n '33,53p' apps/builder/src/builder/workspace/canvas/layout/engines/cssResolver.ts`                      |
| F2  | `CSS_INITIAL_VALUES.letterSpacing = 0` — 초기값도 이미 정의                                                   | 같은 파일 `:78`                                                       | `grep -n "letterSpacing: 0," …/cssResolver.ts`                                                                 |
| F3  | `ComputedStyle` 타입에 `letterSpacing: number` 가 있고 `ROOT_COMPUTED_STYLE` 이 0 을 준다                     | 같은 파일 `:233, :242, :274`                                          | `sed -n '233,280p' …/cssResolver.ts`                                                                           |
| F4  | `resolveStyle()` 이 inline + cascade 키워드 + 상속을 해소해 `ComputedStyle` 을 만든다                         | 같은 파일 `:581`                                                      | `sed -n '575,600p' …/cssResolver.ts`                                                                           |
| F5  | `enrichWithIntrinsicSize` 가 `_computedStyle` 을 이미 인자로 받는다                                           | `layout/engines/utils.ts:4913`                                        | `sed -n '4913,4925p' …/utils.ts`                                                                               |
| F6  | 그 함수가 computed 를 소비하는 텍스트 속성은 **`whiteSpace` 하나뿐** (`resolveTextLeafWhiteSpace`)            | 같은 파일 `:5026`                                                     | `grep -n "_computedStyle" …/utils.ts`                                                                          |
| F7  | 레이아웃 텍스트 측정은 `measureTextWidth(text, fontSize, family, weight, extra?)` 로 호출마다 스타일 조립     | 같은 파일 `:1341`                                                     | `grep -n "measureTextWidth(" …/utils.ts`                                                                       |
| F8  | 인라인 fontSize override 가 `parseNumericValue(style?.fontSize)` 패턴으로 **21곳**에 흩어져 있다              | 같은 파일 (21 occurrences)                                            | `grep -c "parseNumericValue(style?.fontSize)" …/utils.ts`                                                      |
| F9  | 레이아웃의 letterSpacing 유일 유입은 `inlineSpecStyle?.letterSpacing` 이며 그 값은 spec text shape 에서 온다  | `utils.ts:2101` · `utils/specTextStyle.ts:291`                        | `sed -n '2095,2105p' …/utils.ts` · `sed -n '285,295p' …/specTextStyle.ts`                                      |
| F10 | Skia 텍스트 노드의 letterSpacing 은 `shape.letterSpacing` 에서만 온다 (인라인 style 읽는 경로 없음)           | `skia/specShapeConverter.ts:891`                                      | `grep -n "letterSpacing" …/specShapeConverter.ts`                                                              |
| F11 | 렌더가 `node.text.letterSpacing` 을 Canvas 2D 측정 스타일로 그대로 넘긴다                                     | `skia/nodeRendererText.ts:532` (그 외 463 · 648)                      | `grep -n "letterSpacing" …/nodeRendererText.ts`                                                                |
| F12 | catalog `COMPONENT_RULES_TABLE` · 잔존 spec 3개에 letterSpacing 정의 **0건** → F10/F11 의 값은 항상 undefined | `packages/shared/src/catalog/generated/componentRulesTable.ts`        | `grep -c letterSpacing packages/shared/src/catalog/generated/componentRulesTable.ts` → 0                       |
| F13 | DOM/Preview 는 renderer root 에 `style={element.props.style}` 를 그대로 실어 브라우저 cascade 가 처리한다     | `packages/shared/src/renderers/**` (62곳, ADR-907 Layer C 계약)       | `grep -rn "style={element.props.style" packages/shared/src/renderers/ \| wc -l`                                |
| F14 | CSSGenerator 는 spec `size.letterSpacing` 을 `letter-spacing` 으로 emit 한다 (인라인과 별개 채널)             | `packages/specs/src/renderers/CSSGenerator.ts:969-971`                | `sed -n '965,975p' packages/specs/src/renderers/CSSGenerator.ts`                                               |
| F15 | **live**: 인라인 `letterSpacing: "2px"` 인 Text 의 Skia scene node `text` 객체에 `letterSpacing` 키가 없다    | 2026-09-05 Chrome MCP 실측                                            | 빌더에서 `__composition_SKIA_DEBUG__.getSkiaNode(id)` → `text` 키 확인 (fontSize·lineHeight 는 도달)           |
| F16 | **live**: 같은 요소의 Skia 줄바꿈이 Chrome DOM 의 `letter-spacing: 0` 결과와 일치 (ls 2 결과와 불일치)        | 2026-09-05 Chrome MCP 실측                                            | `evidence/051-letterspacing-canvas2d.md` §5 표                                                                 |
| F17 | 측정기 쪽은 이미 letterSpacing 을 CSS 규칙대로 잰다 (2026-09-05 `8b6c1bd22`)                                  | `utils/canvas2dSegmentCache.ts` `needsFallback` · `getOrMeasureWidth` | `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/utils/canvas2dSegmentCache.test.ts` |

### Phase 0 산출물

- **텍스트 CSS 속성 격차표**: `cssResolver` 텍스트 속성 17종 × {DOM 소비 여부, layout 측정 도달 여부, Skia 텍스트 노드 도달 여부}. F1~F17 을 그 표의 첫 행들로 채운다. **이 표가 Phase 1 의 범위를 정한다** — 추정으로 범위를 잡지 않는다.
- 격차표는 코드가 생성한다 (게이트 G4 의 입력과 같은 소스).

## 3. Phase 1 — seam 신설 (letterSpacing 단독 소비자)

- `resolveTextRenderStyle(style, computed)` 신설 — 위치는 `canvas/utils/` (layout·skia 양쪽에서 import 가능한 곳). 반환은 `TextMeasureStyle` 의 텍스트 축 조각.
- 규칙은 `resolveTextLeafWhiteSpace` (F6) 와 같다: inline 우선, 없으면 computed, cascade 키워드는 computed 가 해석한 값.
- 이 phase 에서는 **letterSpacing 한 축만** seam 을 통해 흐르게 한다. fontSize 21곳(F8) 은 건드리지 않는다.
- 소비자 2곳: (a) 레이아웃 텍스트 측정 (`measureTextWidth` 호출 지점 중 텍스트 leaf 경로), (b) Skia 텍스트 노드 (`specShapeConverter` 가 shape 대신 seam 값을 우선).

## 4. Phase 2 — 대칭 게이트

- DOM 이 소비하는 텍스트 CSS 속성 집합 ↔ seam 필드 집합 대조 정적 테스트. 새 텍스트 속성이 한쪽에만 생기면 RED.
- 집합의 출처는 `cssResolver` 의 텍스트 속성 목록 (F1) — 손 목록 신설 금지.

## 5. Phase 3 — live + 회귀

- 빌더 Text 에 `letter-spacing: 2px` → Skia 줄바꿈이 Chrome DOM 오라클과 일치.
- `evidence/051-letterspacing-canvas2d.md` §1 의 오라클 스크립트를 그대로 재사용.

## 6. Phase 4 (조건부) — fontSize 21곳 수렴

Phase 1~3 이 종결되고 seam 이 한 phase 를 버틴 뒤에만 착수. 착수 전 별도 판정 —
21곳을 한 번에 옮기면 회귀 표면이 커서 phase 를 더 쪼갠다.

## 7. 범위 밖

- `wordSpacing` — `ctx.measureText` 미반영, upstream pretext 도 미지원 (ADR-051 §B4-7).
- 텍스트 **렌더** 속성 중 측정에 영향 없는 것 (`color` 등) 은 이미 다른 경로가 소유.
- catalog 에 letterSpacing 축을 추가하는 것 (대안 C, 기각).
