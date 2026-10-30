---
description: Canvas/Skia 렌더링 관련 파일 작업 시 적용
paths:
  - "apps/builder/src/builder/workspace/canvas/**"
  - "**/nodeRenderers*"
  - "apps/builder/src/builder/catalogRuntime/canvas*.ts"
  - "apps/builder/src/builder/catalogRuntime/ruleShapes.ts"
  - "apps/builder/src/builder/catalogRuntime/textMeasure.ts"
  - "packages/shared/src/catalog/runtime/rulePaint.ts"
  - "packages/shared/src/catalog/runtime/compositionRoot.ts"
  - "packages/shared/src/catalog/runtime/presence.ts"
  - "packages/rendering/src/renderers/**"
---

# Canvas 렌더링 규칙

> **SSOT 체인 연계**: Skia 렌더는 [ssot-hierarchy.md](ssot-hierarchy.md) **D3(시각 스타일)의 direct consumer**. CSS/DOM consumer와 **대등(symmetric)** — 한쪽이 다른 쪽 기준 아님. 대칭 = "시각 결과의 동일성" (구현 방법 자유). catalog/spec 이 D1(DOM) 침범 금지.
>
> **2026-07-08**: D3 SSOT 는 [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md)(Implemented) 로 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens 로 전환됨. 본 문서의 "Spec" 이라는 낱말은 옛 이름이다 — 컴포넌트당 spec 파일과 `packages/specs` 는 ADR-248 (2026-10-04) 에서 삭제됐고 Frame/Group/Slot 도 catalog 경로다 (ADR-036 은 Superseded by ADR-142).
>
> 구현 상세는 [canvas-details.md](../skills/composition-patterns/reference/canvas-details.md) 참조

## 0. 렌더링 버그 수정 원칙 (CLAUDE.md 에서 이관 2026-08-31)

2개 렌더링 타겟 (CSS/Skia)의 catalog 정의·origin template → CSS·DOM·Skia consumer → editor 경로를 함께 확인하고 `/cross-check`로 검증한다. 구조·상태 조립은 [RAC 조립 계약](../skills/composition-patterns/rules/domain-rac-composition.md)을 따른다. 동일 패턴은 관련 소비자를 검색하되 요청 범위만 수정한다.

- 같은 루트 상자는 CSS `structure.containerStyles`와 Canvas `containerStyles` 정의를 공유하고 typed box 변환을 거친다. **Why:** Button·ToggleButton의 Canvas 복사본에서 `width: fit-content`가 빠져 flex column에서 342px로 늘어났으며, CSS는 각각 약 68px·115px를 유지했다. trigger와 popover처럼 서로 다른 상자는 합치지 않는다.
- 콘텐츠 높이를 유지하는 버튼 루트는 `height: fit-content`를 선언하고 CSS size 축의 `auto`로 덮거나 typed box에서 숫자만 남기지 않는다. **Why:** row Frame 400px에서 기본 버튼이 양쪽 renderer 모두 400px로 stretch됐고, ButtonGroup은 별도 DOM 경로에서 catalog 높이 전달도 누락됐다.

## 1. Skia 단일 렌더러 (ADR-900)

- Skia 가 화면 + 이벤트 (EventBoundary) 를 통합 처리하고, 엔진 계산 결과 (x/y/w/h) 로 직접 배치한다. 다른 렌더러 · 레이아웃 층을 끼우지 않는다.
- 부분 갱신 영역은 device pixel 정수 경계로 바깥 정렬하고, clear·재렌더·standby 복사에 같은 AA 없는 clip을 쓴다. contributor 조회도 정렬된 영역을 scene 좌표로 역변환한다. **Why (2026-10-30)**: 소수점 AA clip에서 clear와 SrcOver를 반복하면 불투명 경계 alpha가 255→191→171로 줄어 어두운 배경에 선택선 같은 잔상이 남았다 (실제 CanvasKit 재현).

## 2. Component Spec 규칙

- TokenRef 숫자 연산 시 `resolveToken()` 변환 필수. **Why**: 미변환 시 NaN 전파
- `_hasChildren` 체크: 배경 shapes 직후, standalone shapes 직전 배치. **Why**: 자식 유무에 따라 shapes 분기
- 신규 컴포넌트 (child 포함) 추가 → catalog 등록만 (`catalog/bindings/{Name}.binding.ts` + `componentCatalog.ts` entry + `COMPONENT_RULES_TABLE` rule + `pnpm generate:css`). spec 파일 · `TAG_SPEC_MAP` · `packages/specs` 는 ADR-248 (`ddc5fc603`) 에서 삭제됐다 — 어떤 컴포넌트에도 spec 경로를 새로 만들지 않는다 (Frame/Group/Slot 도 catalog 입력)
- Spec fontSize 우선순위: `props.size` 명시 시 `size.fontSize` 우선. **Why**: Propagation은 size prop만 변경, style.fontSize 미갱신
- Spec Container Dimension Injection: `_containerWidth`/`_containerHeight` props 주입 (`catalogRuntime/ruleShapes.ts`). `BOX_SIZE_TYPES` Set 등록 필수 (옛 `buildSpecNodeData.ts` `CONTAINER_DIMENSION_TAGS` — Phase 4e-9-8 삭제). **Why**: Spec shapes가 레이아웃 엔진 결과를 모르면 우측/중앙 배치 불가

## 2.5.5. Fill token consumer 계약 (ADR-908 Implemented 2026-04-24)

VariantSpec 의 배경 계열 필드 + IndicatorModeSpec 의 background\* 는 `FillTokenSpec` (fillStyle × state 2축) + `FillStateTokens` 하나로 통합돼 있다. legacy `background / backgroundHover / backgroundPressed / backgroundAlpha / selectedBackground* / emphasizedSelectedBackground / outlineBackground / subtleBackground` 필드는 없다.

### Fill token 구조

타입 정의는 소스가 정본 — `packages/rendering/src/types/spec.types.ts` 의 `FillStateTokens` (state 축: `base` 필수, 나머지 선택) / `FillTokenSpec` (fillStyle 축: `default` 필수, `outline`/`subtle` 은 `Partial`, `alpha` 0-1). 여기에 복사본을 두지 않는다 (drift 방지).

### Consumer 규약

- `packages/rendering` 의 consumer (`renderers/CSSGenerator.ts` · `variantColors.ts` · `skiaPrimitives.ts` 등 `VariantSpec` 을 읽는 모든 곳) 는 항상 `resolveFillTokens(variant)` / `resolveIndicatorFill(im)` 경유로 fill 접근. **Why**: 단일 진입점 유지 + 향후 merge/override 확장 포인트 보존
- `variant.background` / `variant.backgroundHover` 등 직접 property access **금지** (타입상 존재 안 함, compile error).
- hover / pressed 는 optional 이므로 consumer 에서 fallback 필요: `fill.default.hover ?? fill.default.base` 패턴.

### 금지 패턴 (ADR-908 Phase 4)

- ❌ VariantSpec / IndicatorModeSpec 에 `background` / `backgroundHover` / `backgroundPressed` / `selectedBackground*` / `outlineBackground` / `subtleBackground` / `backgroundAlpha` 개별 필드 신규 도입
- ❌ `variantSpec.background*` / `variant.background*` / `im.background*` property access — 타입 삭제됨, 단일 진입점만 사용
- ❌ `variantSpecToFillTokens()` 호출 — Phase 4-c 에서 삭제됨, `resolveFillTokens()` 만 사용
- ❌ local const 의 property 이름에 legacy naming 유지 (DropZone/Card 예시는 historical, 신규 금지)

## 2.6. Container style pipeline (ADR-907 Implemented)

컨테이너의 padding·gap·border·font 값은 catalog rule과 노드의 typed field에서 읽는다.
DOM은 `packages/shared/src/catalog/runtime/domBinding.runtime.ts`의 `catalogDomStyle`, Canvas의
shape는 Builder `catalogRuntime/ruleShapes.ts`와 shared `runtime/rulePaint.ts`, 레이아웃 입력은 shared `runtime/compositionRoot.ts`의
`styleOf`에서 해당 값을 소비한다. `props.style`은 consumer가 구성한 입력일 수 있지만
저작·저장 정본이 아니다 ([style-ssot.md](style-ssot.md)).

- CSS 값 해석은 `packages/rendering/src/primitives/cssValueParser.ts`의 `parsePxValue` ·
  `parsePadding4Way` · `parseGapValue` · `parseBorderWidth`를 사용한다.
- shape가 컨테이너 간격을 직접 소비하면 `primitives/containerSpacing.ts`의
  `resolveContainerSpacing` 또는 해당 공용 metric resolver를 사용한다. root 간격과
  item 내부 간격을 같은 속성으로 섞지 않는다.
- 신규 binding은 노드 style을 자기 DOM 요소에 전달한다. RAC가 요소를 만들지 않거나
  부모가 소유하는 부품은 해당 계약에 따라 처리하고, 별도 상자를 임의 생성하지 않는다.
- TextArea의 Prefix는 공통 FieldBox에서 첫 입력 줄에 정렬하고, Side Label 선택자는 Prefix Group 안의 입력도 인식한다.
  **Why (2026-10-14)**: 한 줄용 center를 쓰면 rows=3에서 Prefix가 placeholder보다 20px 아래에 놓인다.
- Canvas 텍스트의 line-height는 자기 visual 다음 inheritedText를 읽고, 부모 변경 때 상속 leaf를 다시 계획한다.
  **Why (2026-10-14)**: SelectValue는 버튼의 줄 높이를 상속한다. 측정에만 반영하면 상자는 중앙이어도 placeholder 글자가 어긋난다.
  직접 형제 textarea만 찾는 CSS는 Prefix Group 삽입 후 매칭되지 않아 Side Label이 Canvas보다 22.5px 아래에 놓였다.
  Canvas 검증은 상자 좌표와 글자 내부 여백을 함께 본다. **Why (2026-10-14)**: Prefix Input의 paddingTop=0이
  rule paint에서 누락되어 상자가 일치해도 placeholder에 기본 size 여백(S/M/L/XL: 2/4/8/12px)이 다시 붙었다.
- Canvas 글자 binding (`canvasBinding.ts` `bindings.text` — `textInset`) 의 글자 inset · 폭은 `catalogBoxModel` 의 변 padding + border 로 잡는다 — rule 의 `visual.paddingX` 를 직접 읽거나 inset 0 으로 두지 않는다. **ADR-276 (2026-10-20)**: Button · ToggleButton 은 자체 글자를 그리지 않는다 — 글자는 template 의 Text{label} 자식 (`Button > Icon{icon} + Text{label}`, 옛 IconButton template) 이고 Layout 정렬을 따른다. `bindings.button` 은 상자 (+ pending 원) 만.
  **Why (2026-10-14)**: Button 에 네 변 padding 4 를 쓰면 배치 · DOM 은 상자를 줄이는데 글자만 `paddingX` 12 inset 에 24px 좁은 maxWidth 로 놓여 줄이 넘쳐 밖으로 나갔다 (사용자 Compare Mode 재현). Text · Label · Heading · Paragraph 는 inset 0 고정이라 padding-left 24 를 써도 글자가 상자 모서리에 붙었다.
- 노드 트리의 자식 배치는 엔진이 계산한다. 삭제된 `calculateContentHeight` 분기나
  컴포넌트별 spec·옛 renderer 등록표를 재생성하지 않는다.
- 검증은 변경된 spacing/typed field를 기본값과 다르게 설정해 DOM·Canvas·레이아웃에
  도달하는지 확인한다. 인접 runtime/spacing 검사와 `/cross-check`를 사용한다.
- Canvas 증분 갱신은 엔진에 적용된 입력 snapshot (`getAppliedLayoutInput`) 전체를 비교한다.
  형제 배치·줄바꿈 범위의 display/position 판정도 같은 입력을 읽는다.
  **Why (2026-10-14)**: Prefix Group은 기본 block에서 파생 flex로 바뀐다. 기본 상자로
  판정하면 Prefix 텍스트 폭이 바뀌어도 Input의 Canvas 좌표가 남아 placeholder와 겹친다.
  자신의 크기가 그대로여도 margin·grid placement는 형제를 이동시키므로 부모 배치를 검사한다.
  **Why (2026-10-14)**: box model·layout만 비교하면 한쪽 border와 Table의 파생 열 정보가
  빠지고, 크기 변경만 따라가면 margin·grid 배치 뒤 형제가 과거 좌표에 남는다 (9개 재현).
  입력 snapshot은 엔진의 기존 직렬화 결과를 재사용해 텍스트 재측정 없이 읽는다.

- (ADR-276 전) 자식 노드와 자체 Label을 함께 그리는 버튼은 DOM의 익명 텍스트·group span도 엔진 부품으로 계산했다 — 2026-10-20 부터 Button · ToggleButton 에 자체 Label 이 없어 익명 글자 part 는 없다 (`partsFor` 는 그룹 ToggleButton 의 content span wrapper part 만 둔다).
  **Why (2026-10-14)**: ToggleButton에 Icon을 추가하면 Label이 사라졌고, 고정 폭 버튼의 Label 편집은 Icon 좌표를 남겼다. 부품 입력도 증분 비교하며, 텍스트 부품은 자기 폭으로 줄바꿈하고 autoCenter로 부모 폭을 덮지 않는다.
- 자기 타이포그래피를 Reset할 때도 현재 부모 체인에서 inheritedText를 다시 해석한다.
  **Why (2026-10-14)**: Body를 Inter→Arial로 바꾼 뒤 Text의 Menlo를 Reset하면 상속 값이 비었지만, 재로드는 Arial이었다. 일곱 상속 키의 Reset/Undo/Redo를 fresh root와 비교한다.
- 상속 Reset 검증은 해당 DOM 요소가 상속하는 키와 자체 CSS 기본값을 구분한다.
  **Why (2026-10-14)**: Body 자간 4px에서 Text는 Reset 직후 DOM·Canvas 모두 4px였지만, 네이티브 ToggleButton은 normal을 복원한다. 텍스트를 담는 Body의 속성을 소비자가 거절하거나 ToggleButton 경계를 건너 상속하면 양쪽 결과가 달라진다.
- Icon DOM wrapper의 기본 width·height는 공통 glyph 크기를 쓰되 저작 치수를 보존한다.
  **Why (2026-10-14)**: fontSize만 전달하면 SVG는 XS 16px·XL 48px인데 wrapper는 24px로 남았다. 특정 부모의 height:auto 선택자로 우회하지 않는다.

## 2.5. `_hasChildren` 컨벤션 (ADR-072)

컨테이너 rule 은 shared `catalog/runtime/rulePaint.ts` 의 **3-branch 로직** (Builder `catalogRuntime/rulePaint.ts` 는 재수출 소비자) 에 따라 `_hasChildren` 주입을 받는다 (옛 `buildSpecNodeData.ts` 의 같은 로직이 이름만 바뀌어 옮겨졌다 — `TreeItem`은 Plain에서도 제외). 신규 컨테이너 추가 시 아래 판정 절차를 따른다.

### 3분류 정의

| 분류                | Set                      | `_hasChildren=true` 주입 | 예시                                                                                                    |
| ------------------- | ------------------------ | :----------------------: | ------------------------------------------------------------------------------------------------------- |
| **Shell-only**      | `SHELL_ONLY_TYPES`       |  **자식 수 무관 항상**   | 현재 멤버는 shared `rulePaint.ts`에서 확인                                                              |
| **Synthetic-merge** | `CHILD_PROP_MERGE_TYPES` |         **차단**         | 현재 멤버는 같은 파일에서 확인                                                                          |
| **Plain**           | (양쪽 다 미포함)         |      자식 있을 때만      | TabPanel, TabPanels (shapes=[]), Frame (ADR-130 — canonical layout container) 및 대부분의 일반 컨테이너 |

### 판정 알고리즘 (신규 컨테이너 추가 시)

1. 현재 rule/primitive가 자식 props를 합쳐 그리는 경우 기존 `CHILD_PROP_MERGE_TYPES` 계약을 확인한다. 새 RAC 조립 부품을 부모 shapes에 다시 합치는 기본 절차로 사용하지 않는다.
2. origin template의 자식 노드가 내용을 그리며, 자식이 없어도 부모 standalone 내용이 돌아오면 안 되면 **Shell-only**다.
3. 그 외 자식 유무에 따라 standalone과 shell을 전환하면 **Plain**이다. 부모가 계속 그려야 하는 부분은 실제 binding/primitive에서 확인한다.
4. 멤버십과 예외는 `packages/shared/src/catalog/runtime/rulePaint.ts`가 정본이다. 등록만 바꾸지 말고 DOM·Canvas의 자식 소유와 함께 대조한다.

### 금지 패턴

- ❌ template/binding의 자식 렌더가 없는 타입을 Shell-only로 옮겨 기본 UI를 없앰
- ❌ 부모 shapes와 독립 자식 노드에서 같은 내용을 두 번 그림
- ❌ 자식 개수만으로 모든 타입을 처리해 Shell-only가 자식 0개일 때 standalone으로 복귀함
- ❌ factory/spec 파일을 새로 만들어 판정 근거로 삼음 — 현재 origin template·rule·binding을 읽는다

## 3. 텍스트 측정 동기화

측정은 두 곳이다 (2026-10-04 개정). **레이아웃 측정** (엔진에 주는 텍스트 크기) 은 `catalogRuntime/textMeasure.ts` `catalogTextMeasure` — CanvasKit 이 준비되면 페인트와 같은 paragraph 로 재고 (기본 font feature 가 advance 를 바꾸므로), 준비 전에만 Canvas 2D (`utils/textMeasure.ts`) 로 잰다. **페인트 줄바꿈 hint** 는 `nodeRendererText.ts` 가 Canvas 2D 로 정한 줄바꿈을 `\n` 으로 넣어 CanvasKit 렌더에 강제한다 (ADR-051) — `needsFallback` 분기 (letterSpacing · wordSpacing · white-space≠normal · break-all) 는 hint 없이 CanvasKit paragraph 그대로. 두 기준이 다르므로 줄 수 발산은 둘을 나란히 대조한다. ParagraphStyle 변경 시 **동시 업데이트**: nodeRendererText.ts · specShapeConverter.ts · TextMeasureStyle 인터페이스.

- CanvasKit `heightMultiplier`에 `halfLeading: true` 필수. **Why**: CSS line-height 상하 균등 분배
- fontFamilies: 측정기와 렌더러가 **동일한 배열** 사용. CSS 체인 전체를 `split(",")` → `resolveFamily()` 매핑. **Why**: font 설정 불일치 → 텍스트 줄바꿈 위치 어긋남
- strutStyle: `heightMultiplier > 0` 시 `forceStrutHeight: true` — 측정기/렌더러 양쪽 동일 적용
- 측정 font: 텍스트 leaf 의 text · font 는 `textLeaf` (`compositionRoot.ts`) 가 catalog resolved record (`node.visual` · `catalogTextTypography`) 에서 읽는다 — 렌더와 같은 값. 옛 `extractSpecTextStyle` 은 2026-10-05 삭제
- Paragraph API: 콘텐츠 폭=`getLongestLine()`, max-content=`getMaxIntrinsicWidth()`. `getMaxWidth()` 사용 금지
- WASM Paragraph 객체 캐싱 금지는 **측정 경로 한정** (Canvas 2D 세그먼트 캐시는 결과값 폭만 보관). 렌더 측 paragraph 는 **텍스트 노드 소유 retained + deferred 폐기** (ADR-174 — 전역 content-키 LRU/상한 재도입 금지: 상한→퇴거→프레임 중 폐기가 텍스트 소실의 병인. paragraph 생성은 `MakeFromFontCollection` + 공유 FontCollection 경유만 — per-call `ParagraphBuilder.Make` 는 paragraph 마다 ~5.78MB variable font 인스턴스를 복제 보유시킨다, 정적 가드 `nodeRendererText.static.test.ts`)
- **Layout 보정 금지**: 측정 경로 (`catalogTextMeasure` · `utils.ts` 측정 함수) 에 `+2/+4px` 경험 보정 사용 금지. **Why**: 측정은 CanvasKit paragraph (준비 전 Canvas 2D) 의 값 그대로 엔진에 넘긴다. 남는 sub-pixel 차이는 **렌더링 단**(nodeRendererText.ts)에서 post-layout `getMaxIntrinsicWidth()` 교정으로 처리.
- **min/max-content 스칼라 경로 (ADR-165)**: 텍스트 leaf 폭 intrinsic 은 `styleOf` (`compositionRoot.ts`) 가 `catalogTextMeasure` (`catalogRuntime/textMeasure.ts`) 로 `contentMinWidth`(최장 단어)/`contentMaxWidth`(단일줄) 스칼라 2종을 측정해 엔진 NodeStyle 로 공급 — 엔진이 fit/min/max-content 공식과 §4.5 floor 를 소유. min-content 측정은 max-content 와 **동일 font 체인** (inline style 우선 fontFamily/fontWeight/fontSize) 필수 — 불일치 시 floor 가 다른 폰트 기준으로 어긋남. CanvasKit 준비 뒤에는 렌더와 같은 paragraph 로 재고, 준비 전에는 Canvas 2D (`utils.ts` `calculateMinContentWidth` · `calculateMaxContentWidth`) 로 잰다.
- **CanvasKit 오발 줄바꿈 교정**: nodeRendererText.ts에서 `paragraph.layout()` 후 `\n` 없는 단일줄 텍스트가 줄바꿈되면 `getMaxIntrinsicWidth() + 1`로 재layout. **Why**: Canvas 2D↔CanvasKit 엔진 차이로 같은 텍스트가 다른 폭으로 측정됨. CanvasKit 자체 측정 기반 교정이므로 경험적 tolerance 불필요.

## 4. Spec-CSS 경계

- 모든 컴포넌트의 CSS 는 catalog rule → `packages/rendering/scripts/generate-css.ts` 가 `renderers/CSSGenerator.ts` 로 만든다 (Frame/Group/Slot 포함). 옛 spec 의 `skipCSSGeneration` 선언은 ADR-248 에서 삭제됐다
- Generated CSS는 `@layer components { ... }` 래핑 필수. **Why**: unlayered 시 수동 CSS override 실패
- Switch thumb의 의도된 눌림 확대 `scale: 1.2 1`은 유지하고 이동은 독립 `translate`로 분리한다. 확대 기준은 선택 시 오른쪽, 해제 시 왼쪽 끝이다. **Why (2026-10-19)**: `scale: 1.2 1`과 `transform: translateX(100%)`를 함께 쓰면 이동량까지 확대돼 M thumb가 오른쪽으로 2.8px 돌출했다 (실제 Preview 재현). 바깥 끝을 고정하면 트랙 안쪽으로만 늘어난다.
- Switch indicator는 thumb를 세로 중앙에 배치한다. **Why (2026-10-19)**: XL 트랙 30px·thumb 24px에 border 2px만으로 배치하면 위 2px·아래 4px가 되어 Canvas의 중앙 배치보다 1px 위로 치우친다.
- Switch XL의 좌우 끝 여백도 `(trackHeight - thumbSize) / 2`로 잡고 이동량은 `trackWidth - trackHeight`로 계산한다. **Why (2026-10-19)**: XL의 `translate: 100%`는 24px이어서 세로 중앙 정렬 뒤에도 오른쪽 여백이 2px로 남았다. Canvas의 offset 3px에 맞추려면 시작 여백 3px·이동량 22px이 필요하다.
- Label은 catalog `COMPONENT_RULES_TABLE.Label` 경로 하나로 렌더링한다. **Why**: 중복 등록 시 이중 렌더링
- Label 기본 크기: fit-content (CSS + Factory + 레이아웃 엔진 3경로 동기화 필수)
- Label size delegation: catalog `COMPONENT_RULES_TABLE.Label` 의 size 블록 + `CATALOG_SIZE_PROPAGATION` (부모 size → Label). 옛 레이아웃 경로의 `LABEL_SIZE_STYLE` DFS 주입은 2026-10-05 삭제

## 5. 토큰/테마 정합성

- Field 컴포넌트 입력 영역 배경: CSS `--bg-inset` / Spec `{color.layer-2}` 통일. **Why**: 시각적 일관성
- Select/ComboBox/SearchField gap: 모든 경로에서 고정 4px
- Dark Mode Token: adaptive 배경(`{color.neutral}`) → 텍스트에 `{color.base}` (not `{color.white}`). **Why**: dark mode에서 반전
- Skia color-mix: `mixWithBlackSrgb()` 사용 (oklch 근사 금지). **Why**: srgb 혼합과 수학적으로 다른 결과
- Necessity Indicator: CSS `renderNecessityIndicator` 와 catalog Canvas (`styleOf` 측정 `labelSuffix` · Skia 렌더) 가 같은 표시를 그린다
- ToggleButton의 기본 Icon은 owner 텍스트 색상을 상속하고, owner 변경의 derived dependents에 포함한다. 명시한 Icon 색상은 보존한다.
  **Why (2026-10-14)**: 강조된 선택 버튼의 글자는 흰색인데 Icon은 기본 fg로 남았다. DOM Icon의 자체 fg보다 color:inherit를 우선하고 SVG는 currentColor를 쓴다. Canvas는 같은 catalog owner paint를 읽으며, 기본값과 같은 명시 색상도 저작 선택으로 판정한다.

## 6. 레이아웃 통합

- Size Delegation: 부모 size → 자식 투영은 `CATALOG_SIZE_PROPAGATION` (`packages/shared/src/catalog/document/sizePropagation.ts`, catalog resolver 가 읽는다) 하나가 정본 — 옛 `propagationRegistry` 는 2026-10-05 삭제. catalog Canvas 대응: `rulePaint.ts` `SHELL_ONLY_TYPES` · `CHILD_PROP_MERGE_TYPES`, `ruleShapes.ts` `BOX_SIZE_TYPES`
- Calendar 계열 (CalendarGrid/CalendarHeader): catalog 경로 렌더 — CalendarHeader 는 `BOX_SIZE_TYPES`, Calendar/RangeCalendar 는 Shell-only. 상세: canvas-details.md
- Popover 자식(Calendar/RangeCalendar): 레이아웃 엔진 계산에서 제외. **Why**: Preview Popover 표시
- Collection Item Font: catalog rule (GridListItem/ListBoxItem) 하나가 레이아웃 측정과 Skia 렌더에 같이 쓰인다 (옛 `injectCollectionItemFontStyles` 는 2026-10-05 삭제)
- Arc Shape: `type: "box"` + `arc` 데이터로 변환. 트랙도 arc(360°)로 렌더링. **Why**: renderSolidBorder inset 차이
- Pointer → Move: 이동 대상은 `CatalogSession` 의 selection (`canvasGesture.ts` `beginMove`) — 판정은 현재 맥락 깊이로 정규화된 `picking.target` (`CatalogCanvas.tsx`). 히트한 원시 id 를 직접 넘기지 않는다. **Why**: 내부 자식 의도치 않은 이동

## 6.5 Drag-and-Drop 원칙

- 시각적 offset 변경 금지 → **문서 명령** (`moveNodes` → `host.execute` → `workspace.execute`, `canvasGesture.ts`) 필수. **Why**: visual hack은 drop 시 원위치 + Skia 미동기화
- 좌표 변환: DOM clientX/Y → canvas 좌표 시 viewport offset + zoom 반영 필수. **Why**: pan/zoom 적용된 canvas와 DOM은 1:1 아님
- 이벤트 리스너: `useRef`로 핸들러 참조 유지. **Why**: 드래그 중 리렌더 → addEventListener 소실
- 드래그 상태 변수에 `eslint-disable` 주석. **Why**: 이벤트 핸들러 내에서만 참조되어 linter가 미사용으로 오판

## 7. 금지 패턴 종합

- ❌ Label factory에 `width/height: "fit-content"` 누락 (레이아웃 엔진 auto 와 다름)
- ❌ Label generated CSS 부활 (부모 CSS 변수 상속 깨짐)
- ❌ CSS `var(--text-md)` 사용 (미정의 → `var(--text-base)` 사용)
- ❌ Label lineHeight를 숫자로 전달 (parseLineHeight가 배율로 해석 → `"20px"` 문자열 필수)
- ❌ Label height에 `Math.ceil(fontSize * 1.5)` 같은 추정값 사용 (catalog `Label` size 블록 역참조 필수)
- ❌ PARENT_VARIANT_TO_LABEL_TOKEN 방식 부활 (catalog `COMPONENT_RULES_TABLE.Label` variants 사용)
- ❌ fontFamily 문자열을 단일 배열 요소로 전달 (`split(",")` 필수)
- ❌ `getMaxWidth()`로 콘텐츠 폭 계산 (`getLongestLine()` 사용)
- ❌ `type: "arc"` 별도 사용 (HMR 이슈 → box + arc 데이터)
- ❌ 트랙에 circle + stroke (inset 차이 → arc 360° 사용)
- ❌ `size.height/2`로 세로 중앙 (`containerHeight/2` 사용)
- ❌ 레이아웃 타이밍을 우회하려는 publishLayoutMap 해킹 · notifyLayoutChange() 강제 호출 (테마 변경 뒤 1회 호출은 css-tokens.md §Dark Mode 의 계약)
- ❌ parentElement를 useMemo 내 직접 참조 (stale closure)
- ❌ 히트한 원시 id 를 이동 대상으로 직접 전달 (session selection · 정규화된 `picking.target` 사용)
- ❌ `calculateContentWidth`에 측정기 종류별 `+N` 보정 추가 (CSS 정합 파괴 → nodeRendererText `+1` 마진 사용)
- ❌ 텍스트 leaf 에 width/minWidth 주입 재도입 (ADR-165 스칼라 계약과 이중 적용 — `contentMinWidth`/`contentMaxWidth` 공급이 정본. 비텍스트 leaf 의 width 주입 시 minWidth 동시 주입은 잔존 계약 유지)
- ❌ overflow 기준 flexShrink 주입 보정 (구 Step 5.7) TS 재도입 (automatic minimum size 는 엔진 소속 — `flex.rs` §4.5, ADR-164. layout-engine.md §"TS 잔존 계약" 참조)

## 8. Overflow Scroll 가이드라인 동기화

렌더/bounds 산출은 Command Stream 단일 경로다. 스크롤 무효화는 registryVersion 경유.

- 스크롤 위치는 **property node** (`skia/propertyNodes.ts` `scrollNodeOf` — ADR-269) 하나가 정본이다. 명령 (`CHILDREN_BEGIN` 은 `ownerId` 만) · node data 에 굽지 않는다. `visitElement` 는 자식 boundsMap 좌표에서 부모의 테이블 위치를 뺀다 (`scrollOffsetOf`). **Why**: boundsMap은 절대 좌표 → 렌더링의 `canvas.translate`와 동기화 필요. 스크롤은 `canvasBinding.ts` `placeScroll` 이 테이블 갱신 + 자손 맵 Δ (`applyScrollDelta`) 로 끝내고 `update()` 의 `propertyChanged` 로 발행한다 — 소유자 서브트리를 다시 기록하지 않는다 (sticky 머리를 담은 자식만 예외)
- `executeRenderCommands` AABB 컬링 (`translateStack`): `CMD_CHILDREN_BEGIN` 의 scroll translate 를 컬링 절대좌표 스택에도 반영 필수 — BEGIN 이 연 것 (clip · scroll) 을 `childrenFrameStack` 에 남기고 `CMD_CHILDREN_END` 는 그것만 닫는다 (짝이 어긋나면 production 밖에서 throw). scrollbar 는 END 가 테이블의 `bar` 로 그린다. **Why**: 미반영 시 스크롤로 뷰포트에 들어온 자식이 스크롤 전 좌표로 판정되어 오컬링 — hover outline (boundsMap 경로) 만 보이고 본체 미렌더 (2026-07-16 수정). END 가 기록 시점 값으로 닫으면 기록 뒤 스크롤에서 save/restore 가 ±1 어긋난다 (ADR-269 r1 H1)

## 8.5–8.8 인터랙션 규칙 → [canvas-interaction.md](canvas-interaction.md)

히트 바운드(§8.5) · hover 그룹 하이라이트(§8.6) · 선택 박스 좌표계(§8.7) · 드래그 의도 판정(§8.8) 은 2026-08-31 분리 — `canvas/{interaction,selection}/**` · overlay/paint-order/pointer/drag 파일 작업 시 자동 로드.

## 9. 렌더 identity ↔ 편집 대상 분리 (ADR-248 catalog runtime — 2026-10-04 개정)

> 옛 Page Frame projection 경로 (ADR-135/136 — `::page-frame::` projected ID · `renderNodesMap` / `sceneNodesMap` · `resolveCanonicalMoveTarget` · `sceneVersion` signature · `canonicalDocumentToElements`) 는 ADR-248 Phase 4 에서 store 와 함께 삭제됐다. 원칙 (렌더 공간 id 를 문서에 쓰지 않는다) 은 아래 형태로 남는다.

- **identity 는 렌더 키, 문서 키가 아니다**: 해석된 노드의 `identity` = `instancePath` + `sourceId` (`packages/shared/src/catalog/resolution/positions.ts` `CatalogPosition`). composition root 레코드 · Canvas 명령 · overlay 가 이 키를 쓴다. 문서 · IndexedDB · 히스토리에는 저장하지 않는다.
- **편집은 `EditTarget` 으로**: 같은 position 의 `target` (소유 노드 또는 instance address 가 붙은 template position) 이 명령의 대상이다. identity 문자열을 쪼개 문서 id 로 쓰지 않는다. 이동 · 삽입은 `moveNodes` 등 catalog 명령 하나로 간다.
- **Canvas 무효화**: 전역 `sceneVersion` 카운터는 없다. `canvasBinding.ts` 가 `root.subscribeCanvas` dirty → rect diff 로 바뀐 subtree 만 다시 만든다 ([layout-engine.md](layout-engine.md) 「레이아웃 재계산 경로」 6단계).
- **root 에 붙인 구독은 root 교체를 따라간다**: breakpoint · 테마를 바꾸면 workspace 가 root 를 새로 만든다 (`workspace.subscribeRoot`). Canvas 가 root 에 직접 붙인 구독 (`subscribePreviews` 등) 은 그 콜백에서 새 root 로 옮긴다 (`CatalogCanvas.tsx`). **Why (2026-10-15)**: 미리보기 구독이 처음 root 에 남아, Tablet · Mobile 에서 Styles 드래그 (border · fill) 가 commit 전까지 그려지지 않았다 (사용자 보고).
- 증분 step 에서 「이 instance 의 template 이 바뀐 prop 을 묶는가」 는 노드 자신의 정의만이 아니라 record 가 접은 층 (`collapsedSourceIds`) 의 정의 전부로 판정한다 (`compositionRoot.ts` `bindingDependents`).
  **Why (2026-10-15)**: Create component 로 만든 TextField 컴포넌트의 instance 는 정의가 `accepts: {}` 라 Label · Description · placeholder 쓰기가 Canvas · Preview 에 다음 구조 변경 뒤에야 반영됐다 (사용자 보고). `{label}` 을 묶는 composite 는 원본 (lib 컴포넌트 instance) 의 정의이고, record 는 그 층을 접어 가장 안쪽 primitive 정의를 든다.

## 9.5 페이지 레이아웃 적용 — 해석은 한 곳, consumer 는 둘 (2026-10-04 개정)

- 페이지는 레이아웃을 **body 를 레이아웃 정의 (`DefinitionEntry.usage: "layout"`) 의 instance 로 만들고 template slot 을 `fillSlot` override 로 채워** 적용한다 (`packages/shared/src/catalog/document/types.ts`, 생성 명령 `createLayout`).
- 펼침은 shared resolver (`catalog/resolution/resolver.ts` `resolveCatalogNode` · `positions.ts`) 한 곳이 한다. Canvas (`compositionRoot.ts`) 와 DOM (`domBinding.runtime.ts`, Preview 는 `preview/catalog/catalogPreviewSession.ts`) 는 같은 해석 결과 (`CatalogConsumerNode`) 를 소비한다 — 옛 경로처럼 축마다 합성 층 (`resolvePageWithFrame` · `projectPageFrameNode` · `pageFrameProjection.ts`) 을 두지 않는다.
- `workspace.root.pageFrameRects()` 의 "page frame" 은 Canvas 위 페이지 사각형이며 레이아웃 투영과 무관하다.

### 금지 패턴

- ❌ identity (`instancePath` + `sourceId`) 를 문서 · 히스토리 payload 에 저장하거나 명령 대상 id 로 직접 사용
- ❌ 레이아웃 · slot 펼침을 Canvas 또는 DOM 한쪽에 따로 구현 (D3 symmetric consumer — 해석은 resolver 하나)
- ❌ 레이아웃 적용 변경을 한 consumer 에서만 확인하고 종결 — Canvas · Preview 양쪽 확인 (`/cross-check`)

## 10. 게이트/플래그 단일 registry (2026-08-15)

- Canvas 게이트/플래그의 유일 정의처는 `wasm-bindings/featureFlags.ts`. 파일 밖 boolean 게이트 상수 신설 금지 — `featureFlags.test.ts` 의 registry 계약이 기계 집행 (registry 밖 게이트 상수 0건 + 게이트별 코드 소비처 ≥1)
- 소비자 0건이 된 게이트는 **삭제**한다 — 전환 계획·완료 사실은 ADR/CHANGELOG 가 기록. 의도적 보존은 `INTENT_PRESERVED` allowlist 에 사유와 함께 등재
- **Why**: ADR-900 잔재 게이트 9개가 소비자 0건인 채 "토글할 수 있는 것" 으로 잘못 읽히며 수개월 잔존했고, 발견 수단이 수동 전수 스윕뿐이었다 (memory: `project-pixijs-removal-residue-gates-always-false`). 가드는 발견 시점을 커밋 시점으로 앞당긴다

## 상세 레퍼런스

- [Canvas 렌더링 구현 상세](../skills/composition-patterns/reference/canvas-details.md)
- [SPEC_CSS_BOUNDARY.md](../../docs/legacy/SPEC_CSS_BOUNDARY.md)
