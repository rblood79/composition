# ADR-248 Phase 3 독립 소비자 조립 점검 — 미완료

## 2026-09-30 Tab·Tag label 글자색 채널 · census 상태 채널 재집계 (최신)

**Tab·Tag label 글자색 (새 runtime 공백 수리).** DOM 은 `TabsIndicator.css` · `TagGroup.css` `.react-aria-Tab/Tag .react-aria-Text.react-aria-Text { color: inherit }` 로 label 이 항목 글자색을 물려받는다 — Tab: rule text (neutral-subdued) · `[data-hovered]` textHover (neutral) · `[data-selected] { color: var(--fg) }` (수동 CSS), Tag: `--tag-text` (neutral · 선택 on-accent). 새 runtime 은 label 에 Text 자기 색 (#171717) 을 고정으로 칠했다 (선택 · hover · 비선택 모두 같음).
- 수리: 항목이 자신을 칠하는 결정 (선택 = collection 파생 또는 표시 상태, variant, size, 상태 칠 — `ruleShapes.ts` `catalogRulePaint`) 을 label 색도 같이 읽는다 (`catalogRuleTextColor`). rule 에 없는 수동 CSS 사실 (Tab 선택 글자 `--fg`) 은 `manualBoxRules.ts` `MANUAL_ITEM_LABEL_COLORS` 한 곳. composition root 가 label 의 `derivedProps.color` 로 싣고 (label 자기 작성 색이 있으면 그것), `catalogTextMetrics` 가 Canvas · DOM 에 같은 값을 준다 — Breadcrumb 현재 항목 (`_isLast`) 과 같은 경로.
- 증분: 선택을 정하는 record (Tabs · collection · 형제 Tab) 와 항목 자신이 바뀌면 그 항목들의 label 도 다시 파생 (`catalogDerivedPropsDependents` → `catalogItemLabels`). 값 편집 (첫 Tab `isDisabled`) 으로 선택이 옮겨질 때 다른 Tab 의 label 도 갱신되고 결과 = 새 root.
- 원복 RED 3 (phase3Presence): 수동 선택색 제거 → 1 실패 · label 의존 제거 → 1 실패 (Tab 자기 props 가 바뀌는 descendant 편집 사례는 전체 재계획이라 이 누락을 못 잡아, 값 편집 반례를 추가) · `catalogTextMetrics` 파생색 무시 → 1 실패.
- 남음: Tag disabled 글자 `--fg-disabled` 는 Skia 색 토큰 표에 대응 토큰이 없어 넣지 않았다 (새 쪽은 disabled 에서도 chip 글자색). G3 는 글자 영역을 L3 에서 빼므로 수치 영향 0 — 4 장면 재측정 결과 불변 (base 62·1·1 · axis 372·2·6·6 · state 75 · child 33·1).

**census 상태 채널 재집계 (측정 정정).** `statesWithTypedStateRule` 0/468 은 type 정의 자신의 `stateRules` 만 센다 — rule 기반 type 의 상태 칠은 rule 실행기가 표시 상태를 읽어 그리고 (`CATALOG_RULE_EXECUTOR_PAINT_STATES` — hover · pressed · 선택), disabled 흐림은 state 조건 `conditionalRules` 다. 그래서 0 은 "상태 미실행" 이 아니다. census 에 축별 새 runtime 채널 (`stateChannels`) 과 합계 (`statesByChannel`) 를 추가했다.

| 채널 | 축 |
| --- | --- |
| rest (base) | 100 |
| rule 실행기 칠 (hover · pressed · selected) | 238 |
| typed 상태 규칙 (stateRules · state 조건 규칙) | 57 |
| 없음 | 73 |

없음 73의 내역 (코드 확인):
- focusVisible 45 — Canvas 는 focus ring 을 그리지 않는다. 구 Canvas 도 같다 (`buildSpecNodeData.ts` "Focus ring: … 지원하게 되면 활성화"). old = new, Canvas↔DOM 은 기존 비대칭 (DOM outline).
- hover · pressed 24 — Text · Label · Heading · Paragraph · Description · FieldError · Icon: RAC 가 `data-hovered` / `data-pressed` 를 내지 않는 요소 (생성 CSS 블록만 있음). SelectTrigger · SelectValue · SelectIcon: owner 가 칠하는 read-only sub-part. Group: 잔존 spec (native) — 상태 origin 없음.
- disabled 4 — Breadcrumb · ButtonGroup: DOM 요소에 rule sheet 가 붙지 않아 (`manualBoxRules` `replace` — 생성 CSS 미로드 · renderer div) 생성 `[data-disabled] { opacity }` 가 Preview 에서도 적용되지 않는다. Breadcrumbs: opacity 1 (흐림 없음). Icon: RAC 가 disabled 를 내지 않는다.

**검증:** type-check 통과 · shared 1,522 · specs 1,393 · builder 8,140 통과 (새 테스트 2).

## 2026-09-30 Tab·선택 항목 수리 · 판정기 픽셀 귀속 좁힘 · pressed 가장자리 (이전 — 수치는 위 절로 갱신)

**pressed Button·IconButton · ToggleButton (L3 5건) — 구 결함.** 구 Canvas 가 fit-content 상자의 고유 폭을 정수로 올린다 (`layout/engines/utils.ts` `Math.ceil(injectWidth)` · 글자 폭 ceil): Button 글자 43 vs 42.45, ToggleButton 90 vs 89.11, IconButton label 42 vs 41.58 → 상자가 0.4–0.9px 넓다. 새 Canvas = 격리 DOM (≤0.003px). 기하 허용 1px 안이라 geometry 는 통과하고, 진한 채움 (pressed · 선택) 의 오른쪽 가장자리 세로 줄만 L3 에 걸렸다. 판정기: 허용 안 쌍 중 구 폭이 새 폭의 정수 올림이고 새 폭 = DOM 폭 (≤0.05) 인 쌍 → `subpixel-intrinsic-width-ceil` (oldDefect), 움직인 세로 가장자리 띠만 귀속.

**Tab (RAC 레퍼런스 기준, 사용자 지시 2026-09-30).** 레퍼런스 = 선택 Tab 아래 3px `SelectionIndicator` (가로 전체 폭), 선택 아닌 Tab 은 없음. 제품 CSS (`TabsIndicator.css` `::before` · `SelectionIndicator`) 도 같다.
- 새 쪽 결함 1: 막대 primitive `tab_indicator` 는 `_isSelected` 를 읽는데 새 runtime 이 넘기지 않았다 → 선택 Tab 막대 0 (단독 origin · Tabs 안 모두). base Tabs 는 TabList 승인 쌍 귀속이 막대 픽셀까지 덮어 PASS 로 보였다.
- 새 쪽 결함 2: Tabs 안 Tab 의 선택이 없었다 → `catalogDerivedProps` 가 Tabs 선택 key (명시 key, 없으면 첫 enabled Tab — DOM 과 같은 `catalogTabsSelection`) 로 `_isSelected` 파생, 세로면 `orientation`. Tabs · Tab `isDisabled` 편집은 형제 Tab 까지 다시 파생 (증분 = 새 root).
- 단독 Tab origin 은 Preview 에서 RAC 항목이 아니라 일반 `div` (data-selected · data-orientation 없음) → 막대 없음. 레퍼런스 기준으로 새 Canvas 는 막대를 그리고, Preview 쪽은 Phase 4 제품 수리 후보 (단독 항목 호스트가 선택 표시 상태를 RAC 에 넘기지 않음).

**Tag 선택 (새 쪽 결함).** typed 기본값 `variant: "default"` 를 `resolveCatalogVariantName` 이 작성된 variant 로 읽어 selected variant 를 못 골랐다 → 채움·테두리 없음 (DOM 은 `[data-selected]` 가 variant 보다 이김 → accent). 새 runtime 은 선택 상태 + rule 에 `selected` variant + 작성 variant 가 기본값일 때 selected variant.

**collection 안 항목 선택 (위 수리의 결과로 드러남).** TagGroup · ListBox · Tabs origin 의 항목은 선택 상태 origin 의 인스턴스라 origin 의 표시 상태 (selected) 를 물려받아 전부 선택으로 칠해졌다 (Tag 수리 직후 base TagGroup 4개 모두 accent). RAC 는 collection 이 선택을 정한다: resolver 가 자기 collection 안 항목의 selected/unselected 표시 상태를 무시하고 (`collectionItems.ts` 표 하나를 resolver · presence 가 같이 읽음), presence 가 DOM binding 과 같은 key 로 `_isSelected` 파생 (Tabs 선택 key · ListBox `selectedKey` · TagGroup/GridList/Tree 없음).

**ListBoxItem 선택 배경 (새 쪽 결함, 이미지 확인으로 찾음).** 구 모델은 선택 가능한 항목 origin 에 작성된 style (배경 `--accent-subtle`) 이 선택 모양이고, 항목이 선택이 아닐 때 `--unselected` 층이 지운다 (`stateVariantLayers` 층 순서). typed 변환은 그 배경을 무조건 visual 로 펼쳐 unselected · hover · pressed · focus · disabled 가 모두 연한 파랑이었다. typed template 에 `stateRules` (상태별 작성 visual) 를 추가하고, 변환기가 `--unselected` 가 지우는 origin style 키를 origin 의 `stateRules.selected` 로 옮긴다 (계약 공백 1건 해소 — `STYLE_VALUE_NOT_SCALAR` null). 흰색 ↔ `--accent-subtle` 차이는 pixelmatch 0.1 문턱 아래라 L3 (HC6 지표 그대로) 가 보지 못한다 — 원복해도 G3 는 PASS, 막는 것은 단위 테스트 (원복 RED).

**판정기 — 승인 쌍 픽셀 귀속을 좁힘 (측정 누수 수리).** 종전: 승인 쌍의 old ∪ new 상자 안 L3 차이를 전부 그 차이로 귀속 → Tag 선택 모양 소실 (state Tag ratio 0.42) 이 outside 0 으로 PASS 였다. 지금:
- 상자 변화가 쓸고 지나간 부분만 귀속: 서로 겹치지 않는 부분 + 가장자리 띠 (허용 + 모서리 호 깊이 0.3 × radius). 두 상자가 함께 덮는 안쪽의 칠 변화는 막는다.
- 크기 그대로 움직인 쌍은 이동량만큼 옮겨 칠을 비교 (pixelmatch 0.1, 가장자리 띠 제외).
- icon · avatar · image leaf 와 한쪽에만 있는 노드는 상자 전체. text leaf 는 어느 한쪽에서 잉크인 픽셀 (상자 최빈색에서 24 넘게 벗어남) 만 — 글자 영역은 새 쪽 잉크만 알아서 구 잉크가 L3 에 남기 때문이고, 글자 아래 바탕색이 바뀌면 여전히 막는다.
- 남은 한계 2: ① pixelmatch 0.1 문턱 아래의 옅은 색조 차이 (위 ListBoxItem) ② base · axis 는 배율 0.675 라 작은 칩 안쪽 대부분이 글자 영역 (L4) · 가장자리 띠 (L3e, 완료 조건 아님) 로 빠진다 — Tag 수리 중 TagGroup 4개가 모두 accent 였을 때도 base PASS 였다 (배율 5 인 state 장면과 단위 테스트가 잡는다). 둘 다 지표 · L3e 결정의 결과라 기준은 그대로 두고 기록만.

**원복 RED 4 (phase3Presence):** ruleShapes 원복 → 1 실패 · presence 선택 파생 원복 → 3 실패 · resolver collection 무시 원복 → 1 실패 · 생성 library stateRules 원복 → 1 실패.

**G3 (4 장면 재측정, 수리 + 판정기 좁힘 후)**

| 장면 | PASS | FAIL | 남은 FAIL |
| --- | --- | --- | --- |
| base 64 | 62 | 1 | FileUpload (Phase 4) · UNVERIFIED 1 (Icon) |
| axis 386 | 372 | 2 | FileUpload 2 · UNVERIFIED 6 (Icon) · NOT_RUN 6 |
| state 75 | 75 | 0 | — (Tab·Tag 변형 8 = 사용자 판정 ① 로 승인) |
| child 34 | 0 | 0 | UNVERIFIED 33 (기준선 child 캡처 없음) · NOT_RUN 1 |

**Icon (axis xl L3 FAIL → Icon 전부 UNVERIFIED, 입력 불일치).** 구 팔레트는 Icon 삽입 때 `POPULAR_ICONS` 에서 무작위 이름을 고른다 (`apps/builder/src/types/builder/unified.types.ts` Icon 기본 props). G0 시나리오는 그 이름을 기록하지 않았다 (base frozen = bookmark, axis frozen = bell; base replay 는 다른 아이콘이라 frozen 과 불일치). 새 typed 삽입은 이름이 없어 DOM/Preview Icon 과 같은 이름 없음 대체 (원) 를 그린다 — 같은 입력의 비교가 아니다. 종전 PASS 5건도 가는 획이라 문턱 아래였을 뿐. 판정기: `OLD_UNRECORDED_INPUT.Icon` → L3 기록만 · UNVERIFIED. frozen 과 맞는 이름을 후보 대입으로 고르는 것은 oracle 에 입력을 맞추는 것이라 하지 않는다. 위치: 구 Canvas 는 glyph 를 상자 위쪽에, DOM 은 `inline-flex` `align-items: center` 로 세로 가운데 (svg y 71 = 30 + (130−48)/2) — 새 = DOM.

**판정 필요 — 선택 가능한 항목 상태 변형의 선택 여부.** 구 Canvas 는 Tab · Tag 의 hover · pressed · focus · disabled 변형을 "선택 + 상태" 로, ListBoxItem · GridListItem · TreeItem · ToggleButton 의 같은 변형은 "비선택 + 상태" 로 그린다. 차이의 원인은 구 origin 데이터 하나: Tab · Tag origin 만 legacy `_isSelected: true` prop 을 갖고 (이관 전 selected 템플릿 흔적) 변형이 그것을 물려받는다. 새 모델은 가족 공통으로 "비선택 + 상태" (표시 상태는 한 층, 변형이 origin 의 선택을 덮음). 레퍼런스는 hover 된 Tab 에 막대를 그리지 않는다 (선택된 Tab 만). 선택지: ① 새 모델 유지 — 구 Tab·Tag 변형을 구 결함으로 인정 ② Tab·Tag 변형만 선택 유지 (typed 에 상속 선택 채널 추가).

**사용자 판정 2026-09-30: ①.** 판정기 `APPROVED_STATE_PAINT` `item-variant-inherited-selection` (oldDefect, owner Tab·Tag × state hover·pressed·focus-visible·disabled): root old ∪ new 상자의 칠 차이를 귀속 (geometry · Canvas↔DOM 은 그대로 판정), 그 상자는 이동 보정 칠 비교에서도 제외. Tab·Tag 의 selected · unselected 는 규칙 밖 — 그대로 검증된다.

**검증:** type-check 통과 · shared 1,522 · specs 1,393 · builder 8,138 통과.

## 2026-09-30 DateRangePicker · IconButton 수리 · picker 트리거 여백 (이전 — 수치는 위 절로 갱신)

**1. 제품 Canvas — DatePicker · DateRangePicker 트리거 오른쪽 여백 = ComboBox (사용자 지시)**: 구 Canvas 의 picker 분기 (`implicitStyles.ts` datepicker/daterangepicker) 는 트리거 (SelectTrigger) 에 catalog 여백을 주입하지 않아 SelectTrigger 기본 여백 (좌우 12) 이 남았다. Select/ComboBox 분기처럼 `withSpecPadding` (왼쪽 paddingX · 오른쪽 paddingY) 을 넣었다. catalog 선언도 같다 — DatePicker `--dp-group-padding` md `4 4 4 12`, ComboBox `--combo-container-padding-right` md 4. 테스트 `pickerTriggerPadding.test.ts` (5 size × 2 picker = ComboBox 좌우 여백) · 원복 RED 5. **live** (dev 서버 5173 = 현재 작업 트리, 팔레트 삽입 재생 스크립트): DatePicker · DateRangePicker 트리거 paddingRight 12 → 4, 달력 버튼 x 219 → 227 (ComboBox 펼침 버튼과 같은 x 227 · 오른쪽 끝 245). Preview 는 일반 `.react-aria-Button` `min-width: 68px` 가 세 트리거 버튼을 모두 68 로 넓히는 결함 (C, Phase 4) 그대로다.

**2. 새 runtime — DateInput = RAC segment 행 (DateRangePicker Canvas↔DOM 21px)**: 새 Canvas 가 DateInput 폭을 구 Canvas 자리표시 문자열 (`MM / DD / YYYY`, 대문자 · 띄어쓰기) 하나로 쟀다. RAC DOM 은 `Intl.DateTimeFormat` 순서의 segment 를 따로 그리고 (en `mm` `/` `dd` `/` `yyyy`, 편집 칸마다 catalog `.react-aria-DateSegment` `padding: 0 2px`), DateRangePicker 는 시작·끝 입력 사이에 `–` span 과 트리거 gap 을 둔다. `racDateSegmentParts` (`packages/shared/src/catalog/document/dateSegments.ts` — RAC placeholders 의 builder 제공 locale 부분, 시간 칸 `––`) 와 `catalogDateSegmentPaddingX` (`rulePartRules.ts`) 로 새 runtime `segmentText` 가 같은 행을 잰다. 결과: DateRangePicker 새 Canvas DateInput 217.6 → 196.4 (DOM 196.4), base · axis 5 · child 모두 Canvas↔DOM 통과. 남은 old/new 차이 (172 → 196.4) 는 DatePicker 와 같은 D (구 전용 여백 · Preview 68px 버튼) 규칙에 DateRangePicker 를 넣었다. 테스트 `phase3Presence` "segment row" · 원복 RED.

**3. 새 runtime — Button 자식 색 상속 (state IconButton)**: Preview `utilities.css` `.button-base > :is(.react-aria-Icon, .react-aria-Text, .react-aria-Label) { color: inherit }` 로 Button 직계 자식이 Button 글자색을 받는데, 새 runtime 은 자식이 자기 rule 색 (#171717) 이었다. Button 정의에 변형 · fillStyle · hover 별 자식 색 part rule 을 넣었다 (catalog `colors.text` · `outlineText` · `textHover`; disabled 는 불투명도만). `withRuleParts` 가 정의 자신의 part rule 을 컴파일 규칙 앞에 합친다. 테스트 `phase3Presence` "Button's Icon and Text" (기본 · hover · pressed) · 원복 RED. state IconButton hover · disabled · focus-visible 통과.

| 시나리오 | PASS | 승인 통과 | Preview 결함 추종 | FAIL | UNVERIFIED | NOT_RUN |
| --- | --- | --- | --- | --- | --- | --- |
| base 64 | 63 | 25 | 8 | 1 (FileUpload) | 0 | 0 |
| axis 386 | 377 | 158 | 59 | 3 (FileUpload 2 · Icon xl L3 1) | 0 | 6 |
| state 75 | 65 | 42 | 19 | 10 (L3: Tab 5 · ToggleButton 3 · Button pressed 1 · IconButton pressed 1) | 0 | 0 |
| child 34 | 0 | — | 8 | 0 | 33 | 1 |

**남은 원인 조사**: state Tab 5 (구는 단독 Tab origin 에 선택 밑줄) · pressed Button · IconButton 과 ToggleButton 3 (오른쪽 가장자리 세로 줄 x ≈ 619–628 / 689) · axis Icon xl 1. FileUpload = Phase 4.

검증: `pnpm type-check` PASS · shared 1,522 · specs 1,393 · builder 8,137 통과 (실패 0) · G3 네 시나리오 재측정 (위 표).

## 2026-09-30 노드별 승인 규칙 적용 (이전 — 수치는 위 절로 갱신)

**사용자 결정 (2026-09-30)**: ① A (결정 반영) · B (구 Canvas 결함) 는 새 쪽이 맞는 차이로 인정 ② C (Preview 결함) · D (양쪽 이탈) 는 Phase 3 에서 "Preview 결함 추종" 으로 표시해 통과 처리하고 Phase 4 에서 제품과 함께 고친다 ③ 그룹 size 는 RSP 처럼 항목에 전달되는 것이 맞다 (Preview 의 미전달 = Preview 결함).

**판정기 변경** (`apps/builder/tests/adr248-g3/approvedDifferences.ts` · `paletteBaseCanvas.browser.test.ts`):
- 1px 초과 짝마다 규칙 (소유 컴포넌트 × 노드 종류 × 허용 축) 을 찾는다. 달라진 축이 모두 규칙의 축 안에 있어야 하고, 새 노드는 Canvas↔DOM 다리를 통과해야 한다 (DOM 상자가 없는 노드는 규칙이 `noDomBox` 로 명시할 때만). 짝 없는 노드는 별도 규칙 (새 쪽 노드 종류 · 구 쪽 경로) 으로만 승인한다.
- 승인된 짝의 구 ∪ 새 상자 (geometry 허용 오차만큼 키움) 안의 비텍스트 차이만 그 차이로 귀속하고, 나머지 L3 는 같은 차단식 (ratio > 0.001 AND maxByte > 2) 으로 판정한다.
- 결과 행에 `approvedDifferences` · `approvedClasses` · `previewDefectFollowed` 를 기록하고, 요약에 승인 통과 수와 Preview 결함 추종 수를 센다. 원래 geometry 판정은 `strictPass` 로 남긴다.
- 조사 중 분류 이동: Slider sm 트랙 (제품 `<SliderTrack>` 에 `data-size` 가 없어 상자는 8, 막대만 4) · NumberField 트리거 (catalog 트리거 높이를 읽는 stylesheet 없음) · Checkbox label (label span 이 Checkbox size 를 받지 않음) → C. ColorField Input (구가 md 30 고정, 제품은 size 별 `--cf-input-*`) · TextArea xl Input (고정 높이 안의 Label 줄 높이 연쇄) · 상태 변형 `Icon` 경로 (= 빈 icon 상자) → B.

| 시나리오 | PASS (승인 포함) | 승인 통과 | Preview 결함 추종 | FAIL | UNVERIFIED | NOT_RUN |
| --- | --- | --- | --- | --- | --- | --- |
| base 64 | 62 | 24 | 8 | 2 | 0 | 0 |
| axis 386 | 372 | 153 | 59 | 8 | 0 | 6 |
| state 75 | 62 | 42 | 19 | 13 | 0 | 0 |
| child 34 | 0 | — | 8 | 1 | 32 | 1 |

child 는 child 캡처 PNG 가 없어 L3 를 재지 못하므로 geometry 가 승인돼도 UNVERIFIED 다.

**남은 FAIL**
- 새 쪽 결함 (수리): DateRangePicker — 새 Canvas DateInput 217.6 · 버튼 x 264.6 vs 새 DOM 196.4 · 243.4 (base · axis 5 · child). state IconButton hover · pressed · disabled · focus-visible — catalog primary 글자색은 모든 상태에서 `{color.base}` (흰색, 구 = catalog) 인데 새 쪽은 아이콘 · 글자를 어둡게 그린다.
- 결정 완료 FAIL: FileUpload (Phase 4) base 1 · axis 2.
- 원인 조사: state Tab 5 (구는 단독 Tab origin 에 선택 밑줄, 새 쪽 없음) · state Button pressed 1 · ToggleButton 3 (오른쪽 가장자리 1px 열) · axis Icon xl 1.

## 2026-09-30 남은 FAIL 노드 종류별 판정 목록 (이전 — 판정은 위 절로 갱신)

대상: base 26 · axis 161 · state 55 · child 18 FAIL (L3e 제외 뒤). 짝 1px 초과 geometry 쌍을 노드 종류 × 소유 컴포넌트로 묶고 (G3 JSON `overOnePx` · `newInput.self.type`), L3 · Canvas↔DOM 실패를 따로 묶었다. "새=DOM" 은 새 DOM binding 과의 일치이지 제품 Preview 와의 일치가 아니다 — 원인 칸은 앞 절들의 제품 코드 대조 기록과 이번 확인이다. 판정 칸의 A~F 는 아래 결정 요청 번호.

**A. 사용자 결정으로 이미 새 쪽이 정본 (구 기준선이 옛 값)**

| 노드 ⟵ 소유 | 짝 | 차이 (구 → 새) | 근거 결정 |
| --- | --- | --- | --- |
| Label ⟵ ProgressBar · Meter · Slider | 25 | 높이 69 → 20 | ② Label fit-content |
| Label ⟵ Form | 14 | 폭 38 → 49 (`*` 표시) | ⑤ 빈 necessityIndicator = icon |
| Link ⟵ Nav · Link(state) · ProgressBarValue · SliderOutput 폭 · Separator ⟵ Toolbar x | 49 | 1~2px | ① Link · value 굵기 400 |
| SelectValue ⟵ Select | 7 | 폭 180 → 176 | ④ 트리거 gap 4 |
| DisclosureHeader · Disclosure ⟵ Disclosure(Group) | 26 | 안쪽 여백 12 → 34 (chevron 18 + gap 4) · 높이 | ⑧ chevron 18 · gap 4 |
| Text · Tab ⟵ Tabs (sm) · Text ⟵ TagGroup | 22 | label 글꼴 = 항목 글꼴 | ⑨ 항목 rule 정본 |
| Breadcrumb ⟵ Breadcrumb (state) · L3 Breadcrumb · Breadcrumbs L | 4 | 폭 110 → 106.7 · 구분자 칠 | ⑦ 구분자 Icon |

**B. 구 Canvas 결함 (catalog 선언 = 새, 구만 벗어남)**

| 노드 ⟵ 소유 | 짝 | 차이 (구 → 새) | 원인 |
| --- | --- | --- | --- |
| Label ⟵ field 가족 13종 (xs · sm) | 49 | 높이 16 → 14.3 · 17.1 | 구가 줄 높이 16 고정 — catalog `text-2xs/xs--line-height` |
| └ 연쇄: SelectTrigger · Input · DateInput · SelectIcon(Select) ⟵ field, Button · ButtonGroup · TextField · FieldError · Input ⟵ Form (sm) | 약 40 | y 1~8px | 위 Label 높이 차이가 아래로 밀림 |
| SelectIcon · SelectValue ⟵ SearchField | 12 | 아이콘 18 → 16 · 값 폭 158 → 182 | 구: SelectTrigger rule 18 · 빈 값 clear 버튼 |
| Checkbox ⟵ CheckboxGroup | 10 | 폭 82 → 83.3 | 구: wrapper flex-start 하드코드 |
| Label ⟵ Switch · Switch (state) · L3 Switch | 20 | 폭 45 → 42.4 | 구: Label rule 600 으로 측정 (제품 400 텍스트 노드) |
| SliderOutput ⟵ Slider | 6 | 높이 69 → 20 | 구: catalog md 20 미주입 |
| Label ⟵ DateRangePicker | 5 | 폭 1px | 구 측정 부산물 |
| Image ⟵ Card | 8 | 높이 200 → 0 | 구 엔진이 확정 0 을 미지정으로 봄 |
| Breadcrumbs · Breadcrumb ⟵ Breadcrumbs | 20 | 컨테이너 24 → 130 · 조각 y 30 → 83.6 | 구: 작성 높이를 size 높이로 덮음 |
| DisclosureContent ⟵ Disclosure(Group) | 17 | 높이 20 → 36 | 구: staticSelector padding 8 미소비 |
| TableHeader · TableBody ⟵ Table · Heading · Description ⟵ Popover | 26 | 1px (border 예약) | 구: border 안쪽 예약 없음 |
| TabList · TabPanels · TabPanel ⟵ Tabs | 14 | 폭 220 → 126 · 높이 101 → 24 | 구: 100% · flexGrow 하드코드 |
| ListBoxItem · Text ⟵ ListBoxItem (state) · L3 | 24 | 폭 93 → 114.7 | 구: collection 조상 없이 slot 글꼴 |
| MenuItem · Text ⟵ MenuItem (state) · L3 | 25 | 폭 280 → 247.5 · label x 74 → 42 | 구: 빈 `{icon}` 을 24 상자로 흐름에 넣음 |

**C. Preview 결함 — Phase 3 새 쪽이 Preview 를 따름 (Phase 4 에서 제품과 함께 수리)**

| 노드 ⟵ 소유 | 짝 | 차이 (구 → 새) | Preview 원인 |
| --- | --- | --- | --- |
| SelectIcon ⟵ ComboBox · DatePicker · DateRangePicker · SelectValue ⟵ ComboBox | 28 | 버튼 18 → 68 · 값 폭 180 → 130 | 일반 Button `min-width` 68 이 catalog 18 을 이김 |
| Breadcrumb ⟵ Breadcrumbs (높이) | (B 와 같은 짝) | 24 → 22.9 | 생성 `Breadcrumb.css` 미로드 |
| Button ⟵ Pagination · L3 Pagination | 36 | y 84 → 49.5 | Table 손 CSS 가 Pagination 을 줄바꿈 |
| TagList · Tag · Text ⟵ TagGroup | 34 | TagList 106 → 64 · Tag y 109 → 88 | 제품 wrapper 가 RAC 구조 밖이라 100% 미해석 |
| Avatar · Tag · Text ⟵ Tag (state) · L3 Tag | 18 | avatar 16 → 32 | 단독 Tag 에 slot 미부여 |
| GridListItem · Text ⟵ GridListItem (state) · L3 | 24 | 폭 125 → 129.7 | 단독 item slot 미부여 |
| Text ⟵ Tree | 12 | x 65 → 62.9 | 손 CSS chevron 폭 수축 |
| TreeItem · Text ⟵ TreeItem (state) · L3 | 21 | 폭 105 → 83 | 단독 host 에 `data-composition-tree` 없음 → 손 Tree.css 미적용 |
| Header ⟵ ListBoxSection | 1 | y 2 → 0 | 생성 CSS 미로드 |
| ToggleButton ⟵ ToggleButtonGroup · Radio · Label ⟵ RadioGroup · Label ⟵ CheckboxGroup (xs · sm) | 26 | 항목이 md 상자 (48×20 → 78.9×30 · gap 6 → 8) | 그룹 `[data-size]` 가 항목에 전달되지 않음 (생성 블록 dead) — 구는 전파 |

**D. 둘 다 벗어남 (catalog 값을 어느 쪽도 그리지 않음)**

| 노드 ⟵ 소유 | 짝 | 차이 | 원인 |
| --- | --- | --- | --- |
| CalendarHeader · CalendarGrid ⟵ Calendar · RangeCalendar | 28 | 헤더 높이 0 → 42 (catalog 30) · grid y +42 | 구 0 높이 · Preview 68px 탐색 버튼 → heading 두 줄 |
| DateInput ⟵ DatePicker | 7 | 폭 172 → 130 | 구 전용 paddingX 12 · Preview 68px 버튼 |
| Header ⟵ GridListSection | 1 | 220×24 → 104×21 | 양쪽 |

**E. 결정 완료 — FAIL 유지 (FileUpload = Phase 4)**: FileTrigger · ProgressBar · ProgressBarTrack · ProgressBarValue · Label ⟵ FileUpload (27 짝) · Canvas↔DOM 3 · L3 3.

**F. 판정 대상 아님 — 새 쪽 결함 (수리)**
- DateRangePicker DateInput · SelectIcon: 새 Canvas ≠ 새 DOM (Canvas↔DOM 7, 최대 21px).
- SliderTrack · SliderThumb ⟵ Slider (sm): 새 쪽 track 8 (md) — catalog `sm.indicator.trackHeight` 4 · Preview `.slider-track-bg` 4. size 가 track 에 닿지 않는다.

**G. 원인 미확정 — 조사 후 분류**
- Input ⟵ ColorField (xs): 높이 30 → 20 · padding 4/12 → 1/4.
- SelectTrigger · SelectIcon · SelectValue ⟵ NumberField (xs): 트리거 20 → 26 (padding 1 → 4) · 아이콘 14 → 10 · 값 x +8.
- Label ⟵ Checkbox (sm): 57×16 → 65.4×20.
- geometry 차이 없이 L3 만 실패: state IconButton 4 · Button 1 · ToggleButton 3 · Tab 5 (indicator 줄 영역) · axis Icon xl 1 · Form lg/xl 2 · TagGroup lg 1.

## 2026-09-30 label 글자색 = S2 neutral-subdued · 새 runtime 조각 label 색 (이전 — 판정 수치는 그대로 유효)

**사용자 결정 (2026-09-29)**: label (일반 텍스트와 구분하는 보조 텍스트) 색은 RAC starter 의 `var(--text-color)` (본문색) 가 아니라 RSC (S2) 기준 `light-dark(#505050, #afafaf)` 이다. 적용 범위 = `neutral-subdued` **토큰 값 자체** (catalog 가 이미 S2 와 같은 이름을 쓴다). 현재 조각 (마지막 crumb) 은 **accent 유지**.

- **토큰 값**: 테마가 neutral 팔레트 5종 (slate · gray · zinc · neutral · stone) 의 단계로 색을 만들므로 hex 를 박지 않고 가장 가까운 단계로 옮겼다. light 700 (#404040) → **600 (#525252 ≈ #505050)**. dark 는 400 (#a3a3a3) 이 #afafaf 에 가장 가까운 단계라 그대로다 (300 은 #d4d4d4). 같은 값을 읽는 세 곳을 함께 바꿨다: `packages/specs/src/primitives/colors.ts` (catalog 토큰 · 구 Canvas · 새 runtime library) · `apps/builder/src/utils/theme/neutralToSkiaColors.ts` (neutral preset 동기화) · `preview-system.css` `--fg-muted` (Preview). 영향: 이 토큰을 쓰는 catalog rule 18개 (Breadcrumb · Tab · Description · TreeItem · SelectIcon · Skeleton · StatusLight 등) 와 Preview `--fg-muted` 52곳이 light 에서 한 단계 밝아진다.
- **새 runtime 조각 label 색**: 이전에는 label Text 가 Text 기본색 (본문 #171717) 이었다. part rule 이 catalog 토큰 색을 싣도록 `withRuleParts` 에 library 테마를 넘기고 (`{color.*}` 만 `sourceToken` 으로 변환), Breadcrumbs → (Breadcrumb 경유) Text part rule 에 `Breadcrumb.colors.text` 를 둔다 — Preview `.react-aria-Link .react-aria-Text { color: inherit }` 의 Link 색. 현재 조각 label 은 `catalogTextMetrics` 가 굵기와 함께 `var(--accent)` 를 준다 (Preview `[data-current]` `--breadcrumb-accent` = `--accent`; Canvas 는 기존 `cssVarColor` 로 토큰 해석). Canvas 와 DOM 이 같은 함수를 읽는다.
- G3 는 글자 영역을 비교에서 빼므로 label 색은 G3 수치에 들어가지 않는다. 토큰 변경 뒤 네 시나리오를 다시 쟀고 수치는 바로 아래 절과 같다 (base PASS 38 · FAIL 26 / axis 219 · 161 / state 20 · 55 / child FAIL 18 · UNVERIFIED 15) — 비텍스트 칠의 한 단계 차이는 L3 차단식 (ratio > 0.001 AND maxByte > 2) 을 넘지 않았다.

검증: `pnpm type-check` PASS · shared 1,522 · specs 1,393 · builder 8,130 통과 (실패 0) · 새 runtime 테스트 `phase3Presence` "crumb label" (보통 조각 #525252 · 현재 조각 var(--accent)) — 원복 RED 2 (part rule 색 제거 → #171717 · accent 제거 → #525252) · 팔레트 스냅숏 `semanticPaletteMap.snapshot` 갱신.

## 2026-09-29 L3e 를 완료 조건에서 뺌 (이전 — 판정 수치는 그대로 유효)

**사용자 결정 (2026-09-29)**: L3e 3px 모서리 band 는 완료 조건에서 뺀다. band 는 계속 따로 떼어 기록하고 (얇은 상자의 도색 누락을 찾는 진단값 — ProgressBar fill 누락 선례), geometry ≤1 CSS px · Canvas↔DOM 계약 · 비텍스트 L3 (pixelmatch 0.1, ratio > 0.001 AND maxByte > 2 차단) 판정식은 그대로다. ADR-248 본문 HC6 절과 breakdown 의 G3 문안을 같은 결정으로 고쳤다.

harness (`apps/builder/tests/adr248-g3/paletteBaseCanvas.browser.test.ts`) 변경은 판정 한 줄이다: 세 다리가 모두 통과하면 `UNVERIFIED` 대신 `PASS`, `L3e` 항목은 `gated: false` 로 기록. system child scene 은 기준선에 child PNG 가 없어 L3 다리를 재지 못하므로 **UNVERIFIED 그대로** 둔다 (L3 미측정은 통과가 아니다). 제품 코드 변경 0.

| 시나리오      | PASS | FAIL | UNVERIFIED | NOT_RUN | Canvas↔DOM | 실패 다리 (geometry · canvasDom · L3) |
| ------------- | ---- | ---- | ---------- | ------- | ---------- | ------------------------------------- |
| base 64       | 38   | 26   | 0          | 0       | 62/64      | 26 · 2 · 2                            |
| axis 386      | 219  | 161  | 0          | 6       | 373/380    | 160 · 7 · 12                          |
| state 75      | 20   | 55   | 0          | 0       | 75/75      | 42 · 0 · 50                           |
| child 34      | 0    | 18   | 15         | 1       | 32/33      | 18 · 1 · 0 (L3 미측정)                |

이전 UNVERIFIED 가 그대로 PASS 로 옮겨졌고 FAIL 집합은 바뀌지 않았다 (같은 코드 · 같은 기준선에서 다시 잼). Phase 3 완료는 남은 FAIL (대부분 구 Canvas 결함 · Preview 결함 추종으로 분류된 old/new 차이 — 결함 ledger) 의 처리가 막고 있다.

## 2026-09-29 ⑦ Breadcrumb 구분자 = 편집 가능한 Icon (이전 — 판정은 위 절로 갱신)

**사용자 결정 (2026-09-29)**: 구분자 `::after` "›" 를 편집 가능한 Icon 요소로 · 크기 = 글자 크기 따름 S/M/L 14/16/18 · 간격 = 지금 보이는 간격 유지 0/2/4 · `separator` 문자 prop 제거 (로딩 골격 "/" 도 Icon) · 배치 crumb · icon · crumb (RAC `ol > li` 라 `li[Link, Icon]`). 제품 D3 · 구조 변경, 미커밋.

| 층 | 변경 |
| --- | --- |
| catalog | `Breadcrumb.variants.default.trailingIcon {chevron-right, neutral-subdued}` · `Breadcrumb.sizes` `iconSize 14/16/18` · `gap 0/2/4` · `Breadcrumbs.sizes.gap 0/2/4` · 공용 읽기 `catalogBreadcrumbSeparatorIcon(size)` |
| slot 역할 | `SLOT_ROLES` 에 `separator` · `ITEM_SLOT_ROLE_TABLE.Breadcrumb = [label (필수), separator]` → Properties 역할 표면에서 끄기 · origin 에 되살리기 |
| 문서 | 항목 origin = [Text `Label` (slot 없음 — RAC Link 는 Text slot context 가 없다), Icon `Separator` (`slot: separator`, optional)] · marker `metadata.itemSlots: 1` 이 있으면 repair 가 자식을 건드리지 않는다 (사용자가 지운 구분자를 되살리지 않음) · 이관 전 leaf origin 은 자기 글자를 label 로 옮긴다 · instance 글자 `props.children` → `descendants.Label.children` (`migrateBreadcrumbLabelsToSlot`, 멱등, 기존 label patch 가 이긴다) · 정적 목록 이관 · Slot "+" 도 label patch |
| Preview DOM | `CanonicalNodeRenderer` 가 separator 역할 자식을 shared `Breadcrumb` 의 `separator` 로 넘긴다 → `li[Link(Text), Icon]`, RAC `isCurrent` 면 그리지 않음 · 자식 없는 조각 (legacy plain) · 데이터 행 · 로딩 골격 = catalog 기본 Icon · 손 `Breadcrumbs.css`: `::after` 삭제, `--breadcrumb-icon-size` / `--breadcrumb-gap` (크기 블록에서 `gap` 재선언 — 생성 기본 블록 `gap: 2px` 가 base 를 이기고 생성기는 0 을 내보내지 않는다), 구분자 상자 = Icon 크기 (생성 Icon.css 높이 24 대신), label Text inherit |
| 구 Canvas | `breadcrumb_crumb`: 자식 있으면 투명, 자식 없는 조각은 label + gap + catalog Icon · scene 에서 현재 조각 (`_isLast` · `--current`) 의 구분자 prune · `itemLabelInheritance` (label = 조각 size 글자 · Link 줄 높이 비율 · 400 / 현재 700 accent, 구분자 = iconSize · 색) · implicitStyles (owner gap · 구분자 상자 정사각) · 폭 측정 = 자식 합 + gap |
| 새 runtime | `Breadcrumbs` parts (조각 gap · `via: Breadcrumb` Text 글꼴 · Icon 크기) · `Breadcrumb` 기본값 (단독 조각 16 · 2) · presence (현재 조각 구분자 숨김 · label `_isLast`) · `catalogTextMetrics` 가 현재 label 굵기를 한 곳에서 (Canvas paint · DOM 인라인 공용) · DOM binding 도 구분자를 Link 뒤로 · typed origin 재생성 |
| 제거 | `Breadcrumbs.separator` (binding · 두 DOM renderer · 컴포넌트) · `breadcrumbSeparatorAfterPaddingXPx` |

**측정 중 잡은 비대칭 3건 (수리)**: ① 새 DOM binding 이 현재 조각 label 을 400 으로 인라인 (Canvas 700) — base Breadcrumbs Canvas↔DOM 1.38px → 0.014 ② size S 에서 생성 기본 블록 `gap: 2px` 가 손 CSS 0 을 이김 — axis 4.02px ③ Components 단독 조각 (Breadcrumbs 밖) 은 owner parts 가 없어 새 Canvas 구분자 24 · 간격 0 — state 8px. 셋 다 고친 뒤 Canvas↔DOM 은 이전과 같다.

**재측정 (FAIL · UNVERIFIED · Canvas↔DOM, PASS 0)**: base 26 · 38 · 62/64 · axis 161 · 219 · NOT_RUN 6 · 373/380 · state 55 · 20 · 75/75 · child 18 · 15 · NOT_RUN 1 · 32/33 — 이전 절과 같다. ledger 1px 초과 짝: base 65 · state 106 · child 30. Breadcrumbs old/new 는 동결 G0 기준선 ("›" 모양) 대비 조각 폭이 바뀌어 (예: 첫 조각 64 → 60.6) 기준선과 달라지는 것이 결정대로다.

**Live (실제 builder 5173, Playwright headless)**: 팔레트 재생 Breadcrumbs · Link · Tabs · TagGroup · GridList · Button — Tabs · TagGroup · Button 은 G0 PNG 와 바이트 동일, Breadcrumbs · Link · GridList 만 다름 (결정대로). 구 Canvas Breadcrumbs: "Home › Category › Page" chevron Icon, 마지막 accent 굵게, 첫 조각 61 = label 43 + 2 + 16 (DOM 60.56), owner gap 2. 처음 재생에서 구분자 상자가 16×24 (Icon rule 높이) 라 글리프가 위로 붙은 것을 보고 두 소비자 모두 정사각으로 고쳐 가운데 정렬 (y 34, 16×16). Preview 는 보지 않았다 (보호 규칙) — unit 의 DOM 구조 단언이 근거.

**검증**: type-check PASS · shared 1,517 · specs 1,392 · builder 8,128 통과. 새 회귀: `breadcrumbSeparatorIcon.test.tsx` 5 (이관 · 되살림 금지 · label 이관 · DOM `li[Link, Icon]` · Canvas 글자 상속) · `skiaPrimitives.breadcrumbCurrentWeight` +3 · 갱신: `adr237Phase3.breadcrumbs` (origin 모양 · Δnode 7 · 구분자 prune) · `adr923TextLeafContentSignal` (조각 사이 gap) · `adr923IntrinsicMeasureBaseline` (breadcrumb 64 → 58) · `adr113DescendantsGrepGate` allowlist. 원복 RED 확인: scene prune · `isCurrent` 제외 · label 상속 · DOM 분리 4곳 + repair marker (새 테스트가 seed metadata 의 marker 를 물려받아 이관 전 origin 을 건너뛰는 결함을 잡음). builder 전체 실행 5회 중 2회 unhandled `window is not defined` (전부 통과 상태, 새 테스트 단독 3회 재현 0 — 기존 flaky 로 기록).

**계획 잔여 2건 추가 구현**: ① 데이터 행 (문서 노드 없는 조각) 이 항목 origin 의 구분자 설정을 따른다 — 공용 `resolveBreadcrumbSeparatorTemplate(ownerSlot, lookup)` (owner `slot[0]` → ref 체인 끝 origin 의 separator 자식: 없음 = catalog 기본 · 지움/끔 = 없음 · 이름) 을 구 Canvas projection (`_separatorIcon` → `breadcrumb_crumb` · 폭 측정) 과 Preview (`RenderContext.resolveBreadcrumbSeparator` → `Breadcrumbs.separatorTemplate`) 가 같이 부른다. ② shared `Icon` svg `aria-hidden="true"` (Icon 은 이름을 싣지 않는 장식 글리프 — lucide 기본값과 같음). 회귀: shared `breadcrumbSeparatorTemplate.test.tsx` 5 · builder 데이터 행 1 · specs primitive 1, 원복 RED 2 (Canvas 주입 · DOM null). 검증: type-check PASS · shared 1,522 · specs 1,393 · builder 8,129 · G3 base · state 불변.

**남은 것**: 새 runtime label 색 채널 (현재 Text rule 색 — Tab · Tag 와 같은 공백, geometry 무관) · publish 는 template 공급 경로가 없어 데이터 행이 catalog 기본 Icon · 새 runtime 은 데이터 행 경로 없음 (정적 자식만) · 커밋 시 G0 게이트 검토 (catalog · 생성 CSS · 손 CSS · 이관).

## 2026-09-29 판정 불가 10문항 답 적용 · Tab·Tag label 글꼴 (이전 — 수치는 위 절로 갱신)

**사용자 답 (2026-09-29)**: ① 버튼 500 · 링크 400 ② Label `height: fit-content` 를 catalog 로 ③ Button 안 Icon · Label = Button 척도 (M 18) ④ Select 트리거 gap 4 ⑤ 필수면 빈 `necessityIndicator` 도 `*` ⑥ Card 는 RSC 기반으로 components page 의 Card 프로퍼티에서 slot system 을 쓰는 방향 ⑦ Breadcrumb current 굵기 700 을 catalog 로, 구분자 `::after` 는 빌더 Icon 으로 ⑧ Disclosure chevron M 18 ⑨ 답 없음 ⑩ GridListItem 에 굵기 600 없음.

값 답은 제품 D3 변경이다. 한 소비자만 움직이면 제품 Canvas ↔ Preview 가 갈리므로 catalog · 생성 CSS · 구 Canvas · 새 runtime 을 함께 바꿨다 (미커밋 작업본).

| 답 | 변경 | 소비자 |
| --- | --- | --- |
| ① | `Button` · `ToggleButton` `sizes.*.fontWeight: 500`, `Link` `sizes.*.fontWeight: 400` + `variants.*.textWeight: 400` | 생성 CSS 는 `sizes.fontWeight` 만 내보낸다 (`CSSGenerator.ts:1017`) · 구 Canvas 는 `textWeight ?? 500` · 새 쪽 `buttonDefinition` 이 `sizes.fontWeight` 를 읽게 수리 |
| ② | `Label.structure.containerStyles.height: "fit-content"` | DOM 은 손 `Label.css` 그대로 (skipCSSGeneration) · 패널 preset 이 선언값을 보인다 (테스트 갱신) |
| ③ | 변경 없음 | 앞 절의 glyph · 줄 높이 수리로 이미 Button 척도 |
| ④ | Select `.react-aria-Button` delegation bridges `gap: var(--spacing-xs)` | 생성 `Select.css` · 구 Canvas 는 이미 field 트리거 gap 4 (`implicitStyles` `fieldTriggerRowStyle`) |
| ⑤ | 빈 값 = icon (`FieldNecessityIndicator.ts` 두 함수) | Canvas suffix · Preview 요소가 같은 판정 — binding default · 패널 표시와 같아짐 |
| ⑦ 굵기 | 새 필드 `ComponentRuleVariant.currentTextWeight` · `Breadcrumb` 700 | 구 primitive `breadcrumb_crumb` · 구 측정 `utils.ts` · 새 root (`catalogCurrentTextWeight`) · 손 `Breadcrumbs.css` 700 (생성 `Breadcrumb.css` 미로드) |
| ⑧ | `Disclosure.sizes.md.iconSize` 16 → 18 | 생성 `--icon-size` (트리거 Button 이 이미 18 을 재선언 — 보이는 변화 없음) |
| ⑩ | `GridListItem` 두 variant 의 `textWeight: 600` 삭제 · `gridlist_card` label 기본값 600 → 400 · 손 `GridList.css` 항목 root 와 label Text 의 600 삭제 | 구 Canvas label 주입 (`injectCollectionLabelWeight`) 은 선언이 없으면 주입하지 않는다 — 한쪽만 바꿨을 때 구 Canvas label 만 가늘어진 것을 live 로 잡아 함께 정리 |

**새 쪽 Preview 추종 — Tab · Tag label 글꼴**: 손 CSS `.react-aria-Tab/Tag .react-aria-Text.react-aria-Text { font-size · font-weight · line-height: inherit }` 를 typed part rule 로 (`manualBoxRules.ts` `itemLabelFontParts` — 항목 rule size 글자, 줄 높이 미선언은 root 1.5). Tab md 14/21/500 · Tag md 14/20/400. base Tabs 1px 초과 짝 6 → 2 · TagGroup 9 → 5 (남은 것은 TagList 높이 — Preview 결함).

**재측정 (FAIL · UNVERIFIED · Canvas↔DOM, PASS 0)**: base 26 · 38 · 62/64 · axis 161 · 219 · NOT_RUN 6 · 373/380 · state 55 · 20 · 75/75 · child 18 · 15 · NOT_RUN 1 · 32/33. ledger 1px 초과 짝: base 80 → 65 · state 124 → 106 · child 30. 남은 Canvas↔DOM 실패는 FileUpload · DateRangePicker 그대로 (Phase 4). 중간에 Button 굵기가 새 Canvas 에 안 실려 base 60/64 · axis 362/380 으로 떨어졌던 것을 `buttonDefinition` 수리로 되돌렸다.

**Live (실제 builder, Playwright headless — Chrome MCP 탭이 hidden 이라 RAF 정지)**: `adr248-palette-old-replay.mjs` 의 팔레트 삽입을 현재 dev (5173) 에 재생해 G0 기준선 PNG 와 대조 — Link · Breadcrumbs · GridList 만 달라짐 (Link 글자 400 · 현재 조각 "Page" 700 · 카드 label 보통 굵기), ProgressBar · Meter · TextField · Select · Button · Disclosure · Tabs · TagGroup 은 바이트 동일. Preview 는 보지 않았다 (보호 규칙) — 생성 CSS diff 5 파일과 손 CSS 3 파일이 근거.

**검증**: type-check PASS · shared 1,517 · builder 8,123 · specs 1,389 통과. 회귀 추가 3 (`fieldNecessityIndicator` · `skiaPrimitives.breadcrumbCurrentWeight` · `manualBoxRules.itemLabel`, 앞 둘은 원복 RED 확인) · 기존 2 갱신 (GridListItem 굵기 · Label height preset).

**state TreeItem 제품 상자 (실측)**: 제품 Preview 는 단독 TreeItem origin 을 `hostOrphanCollectionItem` 의 RAC `Tree` (`display: contents`) 로 감싸는데 이 host 에 `data-composition-tree` 가 없어 손 `Tree.css` (전부 `[data-composition-tree]` 범위) 가 닿지 않는다. 임시 브라우저 렌더 (제품 `TreeItem` + bundle CSS + 테마, 측정 후 삭제) 결과: `.react-aria-TreeItem` display block 68×76 — chevron 이 일반 `.react-aria-Button` (min-width 68 · padding 4 12) 68×26, label 68×24, info 버튼 32×25 가 세로로 쌓인다. 구 Canvas (105×32) · 새 쪽 (83×32) 은 한 줄 행이다. Preview 결함이며, 새 쪽은 이 깨진 쌓임을 따르지 않았다 (② 의 예외로 보고). Phase 4 후보: orphan Tree host 에 `data-composition-tree`.

**Card (⑥)**: 사용자 2026-09-29 — S2 구조 재편은 기록해 두고 ADR-248 뒤 별도 ADR. **Disclosure gap (⑧)**: 4 (DisclosureHeader `leadingIcon.gap` 6 → 4). **⑨**: 항목 rule 이 정본 (현 상태 확정).

**남은 것**: ⑥ Card — ADR-240 이 이미 Card 네 영역 (preview/header/content/footer) 에 slot 을 두었다. RSC (S2) 는 설치돼 있지 않고 저장소 기록상 CardHeader 없이 Content 안 title 이다. 무엇을 바꿀지 (CardHeader 제거 · footer padding 값 · 영역 노출) 확인이 필요하다. ⑦ 구분자 → Icon 은 origin · typed 템플릿 · `Breadcrumb.tsx` (자식 전체를 Link 로 감싼다) · 손 CSS · 구/새 Canvas 를 함께 바꾸는 구조 변경이고, 마지막 조각 숨김 (현재 `:last-child` / `_isLast`) · aria-hidden · 크기 · 기존 `separator` prop 처분이 걸린다. ⑧ gap (4 vs 6) · ⑨ · value 가족 굵기 (구 Canvas 500 기본값, Preview 는 이번 변경으로 Select 트리거가 500) 는 답이 없다.

## 2026-09-29 old/new 짝 RAC 기준 재분류 · 새 쪽 입력 손실 수리 (이전 — 수치는 위 절로 갱신)

**판정 기준 (사용자 결정 2026-09-29)**: 레퍼런스는 RAC 이고 RAC 는 headless — **DOM 구조만** 가진다 (D1, 설치 패키지). 스타일은 theme 가 가지며 theme 는 적용에 따라 달라지므로, 기준은 고정 모양이 아니라 **값이 catalog 에서 파생되었는가** 다. 현재 catalog 가 theme 값을 가지고 생성한다 — 선언 = catalog rule 이 참조하는 theme token 값, 손으로 쓴 컴포넌트 CSS 는 선언이 아니다. Preview 가 기준에서 벗어난 경우 Phase 3 새 Canvas 는 **Preview DOM 을 따른다 (②)** 고 "Preview 결함 추종" 으로 표시해 Phase 4 에서 제품과 함께 고친다. 이 분류는 G3 판정을 바꾸지 않는다 (HC6 · L3e 미승인 그대로).

**측정 전제 정정**: harness 의 DOM leg 는 제품 Preview 렌더러가 아니라 새 DOM binding 이고, 해석한 상자·글자 값을 inline style 로 넣는다 (`domBinding.tsx` `catalogDomStyle`). 그래서 inline 축에서 "새=DOM" 은 처음부터 성립하며 **제품 Preview 와 같다는 근거가 아니다**. 재분류는 묶음마다 제품 Preview 값을 제품 코드 (`renderers/*` · 로드되는 CSS) 로 따로 따졌다. 이 과정에서 새=DOM 뒤에 숨은 **새 쪽 입력 손실**이 드러났다.

**새 쪽 결함 — 수리 (제품 파일 무변경)**

| 결함 | 원인 | 수리 |
| --- | --- | --- |
| IconButton 아이콘 24 (제품 18) | 제품 `renderIcon` 은 `style.fontSize` 를 size 척도보다 먼저 읽는데 (`IconRenderers.tsx:26-35`), 새 DOM binding 은 `iconSize` 로 덮고 새 Canvas 도 `iconSize` 만 읽었다 | `catalogGlyphSize` (boxModel) — 작성 `fontSize` > `iconSize`, layout · Canvas paint · DOM 세 소비자가 한 값 |
| IconButton label 줄 높이 21 (제품 20) | 변환기가 `lineHeight: "20px"` 를 거부 | leaf 의 px 줄 높이 → 비율 N / fontSize (자식이 있으면 상속이 달라 gap 유지) |
| Card Footer `paddingTop` 0 (구 origin 8) · DropZone padding 24 | 변환기 visual 목록이 typed 확장 (변별 padding · paddingX/Y · minWidth) 을 몰라 버림 | 목록 보강 + `"Npx"` → 숫자. origin 재생성: 표현 필드 2,118 → 2,124 · gap 837 → 831 |

회귀: `phase3Presence` glyph 테스트 (원복 RED 확인) · origin 변환 대조 (px 단위 규칙 명시) 통과. 재측정 (FAIL · UNVERIFIED · Canvas↔DOM): base 27 · 37 · 62/64 · axis 167 · 213 · 373/380 · state 62 · 13 · 75/75 · child 18 · 15 · 32/33 · PASS 0. ledger 1px 초과 짝: base 88 → 80 · state 136 → 124 · child 34 → 30.

**재분류 표** (묶음 · 대표 짝, 제품 코드 대조 — 근거 파일:라인은 조사 기록)

| 분류 | 묶음 |
| --- | --- |
| **구 Canvas 결함** (구 Canvas 만 catalog 에서 벗어남) | SearchField 아이콘 16 · clear 버튼 숨김 (구: SelectTrigger rule 18 · 빈 값 거르지 않음) · CheckboxGroup items 폭 (구: wrapper flex-start 하드코드) · Switch label/root (구: Label rule 600 으로 측정, 제품은 Switch 400 텍스트 노드) · SliderOutput 높이 (catalog md 20 미주입) · DateRangePicker label (측정 부산물) · Card Preview/Image 200 (구 엔진이 확정 0 높이를 미지정으로 봄) · Breadcrumbs 컨테이너 24 (구: 작성 높이를 size 높이로 덮음) · DisclosureContent padding (catalog staticSelector 미소비) · Table · Popover border 예약 · Tabs TabList 폭 (구: 100% 하드코드) · TabPanels flexGrow · state ListBoxItem (구: collection 조상 없이 slot 글꼴) · state MenuItem (구: 빈 `{icon}` 을 24 상자로 흐름에 넣음) · Tree 중첩 label (구가 접힌 행을 그려 다른 행과 짝지어짐) |
| **Preview 결함** (Phase 3 새 쪽은 추종) | ComboBox 트리거 버튼 68 · DatePicker 버튼 폭 (일반 Button `min-width` 68 이 catalog 폭 18 을 이김) · Breadcrumb 높이 22.86 (생성 `Breadcrumb.css` 미로드) · Pagination 줄바꿈 (Table 손 CSS 가 Pagination 에 wrap) · TagList 높이 (제품 wrapper 가 RAC 구조 밖이라 100% 미해석) · state Tag avatar 32 (단독 Tag 에 slot 미부여) · state GridListItem description 600 (단독 item slot 미부여) · Tree 1단계 label (손 CSS chevron 폭 수축) · state TreeItem (binding renderer 미등록으로 legacy 경로 — 새 쪽도 catalog 와 다름) · ListBoxSection header y (생성 CSS 미로드) |
| **둘 다 벗어남** | Calendar · RangeCalendar 헤더 (구 0 높이 · Preview 68px 버튼 → 두 줄 42, catalog 30) · DatePicker DateInput 폭 · x (구 Canvas 전용 paddingX 12 · Preview 68px) · GridListSection header · FileUpload FileTrigger (Phase 4) |
| **판정 불가 — 사용자 질문** | ① 버튼 · 링크 · value 가족 글자 굵기: catalog `textWeight` 선언 없음 — 구 Canvas 500 fallback, 제품 400 (Nav · Toolbar · ButtonGroup · ToggleButton · Link · ProgressBarValue · SliderOutput 폭 1~2px) ② Label `height: fit-content` 가 손 CSS 에만 있음 (ProgressBar · Meter · Slider label 69 → 20) ③ Button 안 Icon · Label 크기: Button.sizes (18 · 20px) 와 Icon/Text sizes (24 · 1.5) 충돌 ④ Select 트리거가 Button rule gap 8 을 받는 것이 의도인지 ⑤ 필수 field `*` : binding default `necessityIndicator: icon` 을 빈 prop 에 적용하는지 (구 문서 Preview 는 붙이지 않음) ⑥ Card Footer: 생성 CSS padding 0 과 catalog 주석의 8px 중 정본 ⑦ Breadcrumb 구분자 · current 굵기 (손 CSS 에만 선언) ⑧ Disclosure 헤더 chevron · gap: DisclosureHeader rule (18/6) 과 Disclosure staticSelectors (16/4) 중 정본 ⑨ Tab · Tag 안 label 글꼴: 항목 rule 과 Text rule 중 정본 (제품 Preview = 항목 글꼴 상속, 구 Canvas 와 같음) ⑩ GridListItem `textWeight: 600` 이 description 에도 적용되는지 |

**새 쪽이 제품 Preview 와 다른 채 남은 것 (다음 수리)**: Tab · Tag 안 label 글꼴 — 제품은 손 CSS 상속 규칙 (`TabsIndicator.css:34-39` · `TagGroup.css:18-23`) 으로 항목 글꼴 (Tab 14/21 · Tag 14/20) 을 쓰는데 새 쪽은 Text rule (16/24) 이다. ② 원칙상 새 쪽이 따라야 하는 결함이다 (⑨ 의 답과 무관하게 Phase 3 에서는 Preview 추종). state TreeItem 은 제품 경로가 legacy renderer 라 제품 상자를 먼저 확정해야 한다.

**DOM 짝 없는 노드의 대응 상자 (설치 RAC 구조 기준 제안)**: CalendarHeader → `.react-aria-Calendar > header` (제품 합성, RAC 는 header 를 만들지 않음) · TabPanels → RAC `div.react-aria-TabPanels` (제품은 그리지 않음 → 유일한 자식 TabPanel 로 대조) · TagList → RAC `div.react-aria-TagList[role=grid]` (제품이 `display: contents` → `.tag-list-wrapper`) · Popover 닫힌 내용 → 열린 상태의 `.react-aria-Popover` 직계 자식 (닫히면 RAC 가 렌더하지 않음) · Switch Label → `.react-aria-Switch` 직계 텍스트 노드 · SearchField clear 버튼 → 빈 값이면 상자 없음 · FileTrigger → 제품 `button.react-aria-FileTrigger`. 짝 지정은 사용자 확인 뒤 harness 에 반영한다.

## 2026-09-29 Calendar 헤더 합성 · 남은 새 쪽 Canvas↔DOM 원인 판정 (이전 — 수치는 위 절로 갱신)

범위는 확정된 새 소비자 결함의 국소 수리다. 판정식 · HC6 · L3e 미승인 · gate 문안 · 기준선은 바꾸지 않았고, 측정 범위도 넓히지 않았다.

**Calendar · RangeCalendar 헤더 (새 쪽 결함 → 수리)**. 제품 DOM `<header>` 는 탐색 Button 2개 · Heading (`flex: 1`) 의 flex 행이다 (`Calendar.tsx`). 탐색 버튼은 `Calendar.css` 폭 (`height + --spacing-xs`) 보다 일반 `.react-aria-Button` 기본 `min-width: 68px` 가 이겨 68px 이고 (버튼에 `data-size` 없음 — Phase 4 후보로 기록한 그 결함), Heading 은 남는 폭 (md: 202 − 136 − gap 12 = 54) 이 가장 긴 단어 ("September" 72.9) 보다 좁아 min-content 폭에서 두 줄 (line-height 1.5 × 14 = 21) 이 된다 → 헤더 42px. typed CalendarHeader 는 버튼 높이 30 만 써서 day grid 가 12px 위에 있었다. 또 typed 헤더 자식의 `children` ("2026년 9월") · `locale` 은 구 앱이 만들 때 고정한 값인데, DOM 은 이것을 읽지 않고 Calendar root props + 현재 월로 RAC 제목 (`useVisibleRangeDescription`: `{ month: "long", year: "numeric" }`) 을 만든다.

| 수리 | 내용 |
| --- | --- |
| 제목 한 곳 파생 | `catalogCalendarTitle` (shared, RAC 형식 · `locale` + `calendarSystem` → `-u-ca-` · `maxVisibleMonths` > 1 은 월 범위). presence 의 derived props 가 CalendarHeader 에 `children` 으로 싣고 (owner 편집 시 재계획), Canvas paint (`inline_icon_text`) 와 layout 이 이 값 하나를 읽는다. 헤더 자식의 자기 텍스트는 layout 측정에서 제외 |
| 헤더 행 합성 | `catalogCalendarHeaderParts` (owner size 의 버튼 높이 · 버튼 폭 = max(높이 + spacing-xs, Button 기본 size `minWidth`) · Heading 글꼴 = size 의 font-size · bold · `--text-base--line-height` 비율). 헤더 content 폭 = 버튼 2 + gap 2 + Heading min-content (0% basis 항목은 그 이상 기여하지 않음), 높이 = max(버튼, 남는 폭에서 줄바꿈한 Heading) — 기존 rewrap 경로 (min-content 이상 폭) 를 그대로 쓴다 |
| day table 늘림 | auto 폭 table 은 flex column 에서 늘어나지 않는다 (DOM 196 유지) → typed grid 에 `maxWidth` = 열 폭. sm 축에서 root 폭이 헤더 min-content 로 정해지는 경우가 드러남 |
| 환경 locale | Calendar root 에 locale 이 없으면 RAC 는 둘러싼 `I18nProvider` (없으면 `navigator.language`) 를 쓴다. composition root 에 환경 locale 입력 (선택) 을 두고, harness 는 DOM leg provider 와 같은 `FIXTURE_LOCALE` (en-US) 을 넘긴다 (글꼴과 같은 환경 조건). typed Calendar 정의는 `locale` 을 받지 않아 root locale 은 늘 비어 있다 — DOM binding 도 같은 root prop 을 넘기므로 두 소비자의 입력은 같다 |

결과: Calendar · RangeCalendar Canvas↔DOM **base 2 · axis 10 · child 2 전부 0px**. 판정은 geometry FAIL 유지 (구 Canvas 헤더 0 높이 — §6.1 구 쪽 차이). 회귀 테스트 `phase3Presence` (헤더 제목이 헤더 자식이 아니라 Calendar 에서 · 환경 locale · 헤더 행 폭/높이 · size 증분 편집 = 새로 만든 root) — 원복 RED 2건 (제목 파생 끔 → 실패, 버튼 폭을 높이로 → 실패) 확인 후 복구.

| 측정 | 앞 절 | 이번 |
| --- | ---: | ---: |
| base 64 | FAIL 28 · UNVERIFIED 36 · Canvas↔DOM 60/64 | FAIL 28 · UNVERIFIED 36 · **62/64** |
| axis 386 | FAIL 169 · UNVERIFIED 211 · NOT_RUN 6 · 363/380 | FAIL 169 · UNVERIFIED 211 · NOT_RUN 6 · **373/380** |
| state 75 | FAIL 62 · UNVERIFIED 13 · 75/75 | 같음 (Calendar 없음) |
| system child 34 | FAIL 19 · UNVERIFIED 14 · NOT_RUN 1 · 30/33 | FAIL 19 · UNVERIFIED 14 · NOT_RUN 1 · **32/33** |

ledger: base 짝 88 — 후보 68 → **70** · 새 쪽 12 → **10** (FileUpload 8 · DateRangePicker 2) / child 짝 34 — 후보 23 → **25** · 새 쪽 4 → **2** (DateRangePicker) / state 새 쪽 0 그대로. CalendarHeader 는 여전히 "DOM 짝 없음" 이다 (`<header>` 에 catalog 표지 없음 — 대응 상자 지정은 사용자 규칙 결정 항목).

**남은 새 쪽 Canvas↔DOM 원인 판정 (수리 안 함 — 제품 수리 필요)**
- **Breadcrumbs L 1.05px**: 앞 절 줄바꿈 판정 수리 (min-content 이상 폭) 뒤 axis 실패 목록에 없다 — 닫힘.
- **DateRangePicker** (base 1 · axis 5 · child 1): typed 입력 문제가 아니다. Canvas 의 DateInput 문자열은 제품 placeholder 빌더 `buildDateInputDisplayText` ("MM / DD / YYYY", 범위는 "… – …") 이고 layout 측정과 Skia paint (`datefieldSegments`) 가 같은 함수를 쓴다. DOM 은 RAC segment "mm" "/" "dd" "/" "yyyy" (편집 segment 마다 padding 0 2px) 두 벌 + "–" + gap 이다 (md: 90.9 × 2 + 6.6 + 8 = 196.4 vs Canvas 217.55). DatePicker · DateField 는 DateInput 이 flex 로 늘어나 같은 차이가 가려지고, 범위의 시작 DateInput 은 내용 폭이라 드러난다. 고치려면 추적 제품 파일 (placeholder 빌더 · Skia primitive) 을 바꿔야 해 Phase 3 제품 출력 불변 결정에 따라 **Phase 4 후보 (날짜 placeholder Canvas↔Preview 비대칭, 기록됨)** 로 남긴다.
- **FileUpload**: Phase 4 (사용자 결정).

따라서 base · axis · child 의 새 쪽 Canvas↔DOM 차이는 전부 제품 수리 두 건 (FileUpload · 날짜 placeholder) 으로 좁혀졌다. typed 쪽에서 더 닫을 새 소비자 결함은 이 세 장면에서 0 이다.

**제품 출력 불변**: 변경은 미추적 Phase 3 파일 (`catalogRuntime/compositionRoot.ts` · `presence.ts` · `catalog/resolvers/resolveCatalogRuleCanvasBox.ts` · `catalog/document/manualBoxRules.ts` 주석) · harness · 테스트뿐이다. `compositionRoot` · `presence` 는 기존 앱이 import 하지 않는다. `resolveCatalogRuleCanvasBox.ts` 는 기존 `implicitStyles.ts` 가 `resolveCatalogRuleCanvasBox` 를 읽는 공용 파일이지만 (`catalog/index.ts` 재수출), 이번 변경은 새 export 2개 추가와 새 runtime 만 쓰던 `catalogCalendarHeaderHeight` 제거이며 제품 코드가 이 셋을 부르는 곳은 0 (grep) — 제품 출력 경로 무변경.

**G5 미검증 (2) 판정 — 크기 불변 · baseline 변화의 조상 상승**: 가설 = baseline 으로 배치되는 상자 (flex/grid baseline 그룹, block 줄 상자의 atomic inline) 는 형제가 크기 불변 편집에도 움직일 수 있다 — container baseline 은 내용 위치에서 합성되므로 (Rust `tree.rs` · `block.rs` §10.8.1 폴백 · `flex.rs` `baseline_group`) 고정 높이에서 padding 을 맞바꾸면 크기는 그대로인데 baseline 이 움직인다. `canvasBinding` 의 상승은 크기 변화만 보므로 이 경우 형제를 읽지 않는다. 반증 사례를 만들려 했으나 **도달 조건이 없다**: 인스턴스는 layout 을 쓰지 못하고 (`NodeEntry` 에 layout 없음), code catalog library (definitions · templates · rules) 와 fixture library 어디에도 inline-level `display` 나 `baseline` 정렬이 없다 (전수 탐색 0). 이 전제를 `phase3BindingDelta` guard 테스트로 고정했다 — library 가 둘 중 하나를 선언하면 실패하고, 그때 baseline 인지 상승이 먼저 필요하다 (표본 주입 RED 확인). 판정: 현재 결함 아님 (LOW, 전제 고정). (1) flex/grid 부모 형제 O(형제 수) 는 정합 문제가 아니라 비용 항목으로 그대로 남는다.

**G0 호환 게이트 (다른 세션 커밋 `831148f24` · `904469b40`, ADR-249 전체 메뉴)**: 기준선 이후 제품 소스 27개 (수정 13 · 신규 11 · 등록분 blob 갱신 3) 가 게이트에 걸렸다. 파일별 diff 를 G0 스크립트 단계와 대조했다 (판독 agent 표를 근거 파일·라인으로 재확인):
- 키보드 경로 불변 — `useKeyboardShortcutsRegistry` keydown (입력칸 skip · scope 일치 · `preventDefault` · 인자 없는 `handler()`) 그대로, 바뀐 것은 handler 타입과 registry 에 게시만 하는 `canRun`. `BuilderCanvas` zoom-to-selection 은 대상 계산을 함수로 뺐을 뿐 계산 · 조건 · scope 등록이 같다 → ⇧1/⇧2 재생 불변.
- **앞 등록 사유 정정**: `BuilderHeader.tsx` 사유의 "모든 G0 시나리오에서 메뉴는 닫혀 있다" 는 틀렸다 — `adr248-g0-storage-surface-oracle.mjs` 가 전체 메뉴를 열고 루트 `Export` 를 누른다. HEAD 에서 Export 는 File 하위 메뉴로 옮겨졌지만, 이 스크립트는 HEAD = 기준선을 assert 해 기준선 worktree 에서만 돌고 export 는 같은 `onExportProject` 라 동결된 zip · 저장 값은 그대로다 (UI 경로만 달라짐). 사유 문구를 고쳤다.
- 레일에서 Theme (왼쪽) · History (오른쪽) 버튼이 빠진다. 레일 폭 (fit-content 40px) 과 그 폭을 읽는 canvas inset, 저장되는 레일 순서는 그대로다. 레일 띠가 찍히는 것은 전체 뷰포트 system-child PNG 33장뿐인데, 이것은 freeze audit 가 hash 로만 확인하고 G3 비교가 소비하지 않는다 (child 장면은 픽셀 leg 없음). 비교에 쓰는 캡처 clip 은 모두 x 70 ~ 1200 안이다.
- 나머지 (명령 팔레트 · 우클릭 메뉴 · History 패널 · agent read model · 메뉴 전용 모듈과 CSS) 는 G0 시나리오가 열지 않는 표면이다.
blob 고정 `REVIEWED_UNRELATED` 에 사유와 함께 등록했다. 작업 중 다른 세션이 `6dd0c0965` (새로고침 부팅 셸의 패널 골격 · presented chrome localStorage 스냅샷 기록기 제거) 를 커밋해 6개가 더 걸렸다 — 부팅 중에만 보이는 셸과 표시 뒤 localStorage 기록이고, G0 스크립트는 빈 context 에서 부팅 뒤에만 캡처하며 storage oracle 은 localStorage 를 읽지 않는다. 삭제 2개를 등록하려고 게이트에 `blob: null` (검토된 삭제 — 다시 생기면 실패) 을 추가했다. G0 번들 기준선 `bundle-builder.json` 의 `shellSnapshot` chunk 는 소비처가 없는 기록이다.

검증: catalogRuntime 64/64 (guard 포함) · shared 1,512/1,512 · builder 전체 (HEAD `6dd0c0965`) 998 files · 8,119 통과 · 실패 0 (앞 절의 `borderGeometry.static` 실패는 다른 세션 작업 뒤 통과) · 브라우저 parity 1회차 1,582 통과 · 실패 1 (GeometryDelta case 1 — 기록된 flaky) · 2회차 1,583 통과 · 실패 0 · skip 2 — 같은 파일 단독 4/4 · adr248 3파일 묶음 3/3 · 이어 전체 4회 연속 1,583 통과 (전체 6회 중 1회 실패, 실패 메시지 미확보) · G3 harness base · axis · state · child 각 1/1 (최종 코드로 재실행, 위 표 수치) · ledger 3종 재생성 · `pnpm type-check` 4회 중 첫 회 exit 1 (출력에 TS 오류 없음) · 이후 3회 PASS. G3 **FAIL 유지**, L3e UNVERIFIED, Phase 4 미착수, 커밋 없음.

## 2026-09-29 state origin 75 · system child scene 확장 · typed 표시 상태·상태 규칙·slot 역할 · 측정 정정 (이전 — Canvas↔DOM 수치는 위 절로 갱신)

판정식 · HC6 수치 · L3e 미승인 · gate 문안 · 기준선은 바꾸지 않았다. 병렬 Codex 세션이 먼저 만든 `adr248-state-origin-old-replay.mjs` 는 사용자가 그 세션을 판정 전용으로 돌린 뒤 이 흐름이 이어받았다.

**구 쪽 oracle**
- state origin: `adr248-state-origin-old-replay.mjs` (G0 worktree `2a5c970`, dirty 0). G0 스크립트의 캔버스 포커스 클릭 (300,300) 이 카메라가 Components 페이지로 옮기기 전에 들어가면 Home 페이지를 찍어 ⇧2 가 무효가 되는 경합이 있어, 클릭 뒤 `currentPageId` 를 확인하고 다시 여는 재시도를 넣었다 ([재현](248-phase3-state-origin-old-replay.json)). **72/75 PNG 가 frozen 과 byte 동일**, 3개 (ListBoxItem focus-visible · Tab 기본/unselected) 는 origin 화면 영역 밖 캡처 맨 위 17px 띠의 이웃 요소만 다르다 (origin 영역은 동일).
- system child scene: G0 [기준선](248-baseline/system-child-scene.json) 이 자식의 부모 기준 layout 을 이미 담고 있어 재생이 필요 없다. 자식 PNG 는 동결되지 않았다.

**새 쪽 harness** ([state](248-phase3-state-origin-canvas.json) · [child](248-phase3-system-child-canvas.json))
- `ADR248_SCENARIO=state`: origin 의 typed composite 를 단독으로 두고, zoom-to-selection 이 구 root 를 canvas 중앙에 둔 위치에 새 root 의 왼쪽 위를 맞춘다. 캡처의 이웃 origin 은 fixture 가 아니라 픽셀 비교를 구 ∪ 새 root 상자 + 6 CSS px 로 한정한다 (예산 아님, 결과에 기록). 자식은 typed template ID (`lib:template:<구 origin 노드 ID>`) 로 짝짓는다 (ref origin 의 이름 경로는 base origin 자식 순서로 대응).
- `ADR248_SCENARIO=child`: 구 스크립트와 같이 root 는 (30,30) 220×130, section 은 같은 크기 host (ListBox·GridList·Menu) 안에 크기 없이 넣는다. 자식을 template ID 로 짝짓고 geometry 와 Canvas↔DOM 계약만 잰다 — 픽셀 leg 없음 (최선 UNVERIFIED).

| 측정 | 첫 실행 | 수리 뒤 |
| --- | ---: | ---: |
| state origin 75 | FAIL 50 · UNVERIFIED 8 · NOT_RUN 17 · Canvas↔DOM 51/58 | **FAIL 62 · UNVERIFIED 13 · NOT_RUN 0 · PASS 0 · Canvas↔DOM 75/75** |
| system child scene 34 | FAIL 20 · UNVERIFIED 13 · NOT_RUN 1 · Canvas↔DOM 27/33 | **FAIL 19 · UNVERIFIED 14 · NOT_RUN 1 (Radio — 구 store 거부) · Canvas↔DOM 30/33** |
| base 64 (재측정) | FAIL 28 · UNVERIFIED 36 · 60/64 | **FAIL 28 · UNVERIFIED 36 · 60/64** (Switch → FAIL · ListBox · GridList → UNVERIFIED) |
| axis 386 (재측정) | FAIL 169 · UNVERIFIED 211 · NOT_RUN 6 · 362/380 | **FAIL 169 · UNVERIFIED 211 · NOT_RUN 6 · 363/380** |

state 의 FAIL 이 첫 실행보다 많은 것은 NOT_RUN 17 이 실행되고 아래 측정 정정이 버튼 채움 차이를 드러냈기 때문이다. base · axis 는 수가 같아 보이지만 구성이 바뀌었다 — Switch (base 1 · axis 6) 가 label 이 DOM 과 같은 글꼴이 되어 새로 FAIL (구 Canvas 와 갈림), slot 역할 수리로 ListBox · GridList 가 UNVERIFIED 가 됐다.

**수리 (공통 의미론 → typed 입력, 시험 전용 binding 없음)**

| 의미론 | 수리 | 닫은 사례 |
| --- | --- | --- |
| state origin 의 강제 상태 (`metadata.variant`, `METADATA_NOT_IN_CONTRACT` 70) | `LibraryTemplateNode.displayState` (`DisplayStateName`) 신설 · 변환기가 root `metadata.variant` 를 옮김 (gap 70 → 0). resolver 는 바깥 인스턴스 층의 값이 이기게 template root 로 내리고 (구 앱: ref 자기 상태만), `isSelected`/`isDisabled`/`isExpanded` 를 받는 정의에 싣고, 노드 해석 상태로 `stateRules` · `conditionalRules` · 부모 part rule (owner 상태) 을 고른다 | Checkbox 6 · Radio 6 UNVERIFIED |
| 상태 paint typed 규칙 (census 0/468) | rule `structure.states.disabled.opacity` → typed 조건 규칙 (`isDisabled` · state disabled → `opacity`) · Canvas 는 구 Canvas 와 같은 opacity layer effect, DOM 은 같은 값 inline + 생성 `[data-disabled]` · Button hover 는 `borderHover`/`textHover` 까지 | disabled 전 종 · Button hover 테두리 |
| 채워지지 않은 `{icon}` placeholder | 구 Skia 는 그리지 않고 DOM `Icon` 은 null: presence 에서 이름 없는 glyph 는 상자 없음 | ListBoxItem · Tag 12 실행 |
| 단독 Breadcrumb | DOM orphan host 가 숨은 다음 crumb 을 붙여 구분자를 보인다: 새 Canvas 도 orphan 은 기본 구분자, `current` 표시 상태는 마지막. Breadcrumb 의 Link line-height 비율을 Breadcrumbs part 에서 crumb 자신으로 · RAC 마지막 crumb `_isLast` (구분자 없음 · 현재 모양 · 측정 굵기 600) | Breadcrumb Canvas↔DOM |
| owner 가 자기 `children` 텍스트를 그리는 자식 | `renderSwitch` 는 자식 Label 이 아니라 자기 텍스트를 Switch 글꼴로 그림 → `Switch > Label` part (size 글꼴 · line-height · 400) | Switch Canvas↔DOM |
| 접힌 Disclosure · 닫힌 Menu | presence: 접힌 Disclosure 의 패널 (단독 `isExpanded`, group 은 펼침 key) · Menu 항목 (닫힌 Popover) 은 상자 없음 | Disclosure collapsed · Menu |
| section Header | `ListBox.css` descendant 규칙 (text-sm · 700 · padding 0 12 · margin-bottom 4) · GridList 는 RAC `GridListHeader` (block, GridList 글꼴) | section 2 |
| 변환 원천 | reusable origin 변환 입력을 제품 프로젝트 생성 함수 (`createInitialProjectDocument`) 로 — Menu item template 보장이 빠져 있었다 (origin 130 → 136) | MenuItem 5 실행 |
| collection item slot 역할 | typed Text · Heading · Description · Icon · Avatar 가 `slot` 을 받음 (slot gap 18 → 6, 남은 6 = Card · NumberField 의 다른 역할) · DOM 은 Preview `itemSlotAttr` 와 같은 조건 (collection 조상 ListBox · Menu · GridList · TagGroup, 역할 icon · avatar · label · description) 에서만 `slot` 속성 · Canvas 는 수동 CSS 사실을 part rule 로: ListBox 경유 item label 600 · description text-xs · icon 절대 배치 (left 12 · top 50% · 16px, typed layout 에 `position: absolute` + `insetLeft`/`insetTop` 추가) · 그 item 의 `:has([slot=icon])` 들여쓰기 34 (presence) · GridListItem 의 Text 600 (collection 불필요 — `.react-aria-GridListItem .react-aria-Text:not([slot=description])`) · GridList 경유 description 원래 굵기 · TagList 경유 Tag icon 14 · avatar 16 + 4px 간격 | base ListBox · GridList UNVERIFIED |
| CSS 줄바꿈은 단어 사이에서만 | rewrap 이 CanvasKit 의 긴 단어 강제 분할을 따라 두 줄로 감싸던 것을, min-content (가장 긴 단어) 이상 폭에서 줄을 나누게 함 — 상자보다 긴 한 단어는 CSS 처럼 한 줄로 넘친다 | GridList "Downloads" (600) |

**측정 정정 2건 (harness)**
1. **텍스트 영역이 버튼 채움을 가리고 있었다.** 채움 상자를 함께 그리는 text 노드 (Button 등) 의 노드 상자 전체를 L4 텍스트 영역으로 빼서, 채움 색 차이가 L3 에 들어오지 않았다 (ADR-198 §6 "전체 허용치로 가리지 않는다" · §7 토큰 색 변경 음성 탐침 위반). 이제 텍스트 영역 = 순수 텍스트 leaf 상자 + 새 leg 의 글자 잉크 (폰트 없이 한 번 더 그려 달라지는 픽셀) 를 geometry 허용치 (1 CSS px × zoom + 1) 만큼 넓힌 것. 더 엄격한 방향이다.
2. **테마 환경.** 구 Builder 는 프로젝트를 열 때 활성 테마 snapshot 을 설치해 토큰 맵 (`lightColors` · `typography` · `radius` …) 을 덮어쓴다 (neutral-hover #c3c3c3 → neutral preset 300 #d4d4d4). 새 leg 는 설치 전 원시 토큰으로 라이브러리를 만들고 있었다. 새 프로젝트의 기본 테마를 제품과 같은 경로 (`resolveThemeSnapshot`) 로 풀어 Canvas 토큰 맵과 DOM `THEME_VARS` `:root` 에 설치한다 (글꼴 · locale 과 같은 환경 조건). 앞서 기록한 accent 색 비대칭 (#155DFC vs 테마 --accent) 도 이것이다.

**ledger** ([state](248-phase3-g3-state-old-defect-ledger.json) · [child](248-phase3-g3-child-old-defect-ledger.json) · [base](248-phase3-g3-old-defect-ledger.json))
- state: 1px 초과 짝 136 — 새=DOM·구≠DOM 130 · DOM 짝 없음 6 (Switch Label) · **새 쪽 0** · 짝 없는 구 노드 11 (ListBoxItem · MenuItem 의 그리지 않는 16×16 icon 상자). GridListItem 6 은 slot 역할 수리 뒤 geometry 후보가 됐다: 단독 item 에 Preview 는 `slot` 을 내지 않아 description 도 `:not([slot=description])` 로 600 이 되고 새 쪽이 그대로 따른다 (구 Canvas 만 description 을 400 으로 그림).
- child: 짝 34 — 후보 23 · DOM 짝 없음 7 (Popover 닫힌 overlay 내용 · Tabs 패널 · Calendar 헤더 · Switch Label) · 새 쪽 4 (Calendar · RangeCalendar · DateRangePicker — 기존 기록) · 짝 없는 구 노드 1 (SearchField 빈 값 clear 버튼).
- base: 짝 88 — 후보 68 · DOM 짝 없음 8 · 새 쪽 12 (FileUpload · Calendar · RangeCalendar · DateRangePicker) · 짝 없는 구 노드 2.

**발견 (판정 변경 없음)**
- 구 Canvas 는 단독 collection item origin 에도 ListBox slot 역할 글꼴 (label 600 · description xs · icon 절대 배치) 을 그리지만, 구 Preview 는 collection 조상이 없으면 `slot` 속성을 내지 않아 적용하지 않는다 — 구 쪽 비대칭 (ListBoxItem 폭). GridListItem 은 반대로 Preview 가 `slot` 없이도 Text 를 600 으로 그린다 (앞 판단 "GridList L3 = 구 비대칭" 을 정정: 새 쪽 결손이었고 이번에 수리).
- palette ListBox · GridList · TagGroup **안의** 항목은 slot 역할 수리 전에는 새 Canvas 와 새 DOM 이 함께 `slot` 을 빠뜨려 "새=DOM" 이 구 결함 근거가 되지 못했다 (판정자와 설계자가 같은 입력). 수리 뒤 ListBox · GridList 는 새=DOM=구 (UNVERIFIED) 이다.
- Button state 4 는 구 쪽이 텍스트 폭을 올림 (41.58 → 43) 해 새=DOM 과 1px 차이다. geometry 는 통과하지만 500% 캡처에서 5 clip px 가 되어 3px L3e 띠를 넘는다 — 기준 그대로 FAIL.
- typed 라이브러리는 만들 때 설치된 토큰 맵을 읽어 값을 고정한다. 테마 변경 반영은 Phase 4 전환 항목이다.

**제품 출력 불변**: 이 절의 변경은 전부 미추적 Phase 3 모듈 (`catalogRuntime/*` · `catalog/document/*` · `catalog/resolution/resolver.ts`) · harness · 스크립트다. 기존 Builder/Preview/Publish 소스가 이 모듈을 import 하는 곳 0 (grep).

**G0 호환 게이트**: 다른 세션 커밋 `ea7893dad` (services/ai prompt audit — AI 패널 대화 이력 · prompt · 도구 설명) 가 기준선 이후 제품 소스 10개를 바꿔 게이트가 반응했다. G0 시나리오는 AI 패널을 열지 않아 출력과 무관 — blob 고정 `REVIEWED_UNRELATED` 에 사유와 함께 등록 (i18n 2개는 `96ab2cee1` 등록분의 blob 을 갱신).

검증: shared 1,512/1,512 · builder 전체 8,132 통과 · 실패 1 (`borderGeometry.static` — 기존, 무관) · 브라우저 parity 1,583 통과 · skip 2 · 실패 0 — GeometryDelta case 1 단독 3회 중 1회 실패 (기존 flaky, 이번엔 단독에서도 관측) · catalogRuntime 62/62 · G3 harness base · axis · state · child 각 1/1 · reusable origin 변환 대조 1/1 · `pnpm type-check` PASS. G3 **FAIL 유지**, L3e UNVERIFIED, Phase 4 미착수, 커밋 없음.

## 2026-09-29 variant/size 386축 확장 · 축 공통 의미론 수리 (이전 — 수치는 위 절 재측정으로 갱신)

사용자 결정 (FileUpload Phase 4 · HC6 유지 · 노드별 규칙 확정 전 판정 유지) 뒤, 막히지 않은 다음 항목인 **production 팔레트 64종의 단일 variant·size 축 386개** ([G0 기준선](248-baseline/palette-variant-size/baseline.json)) 로 G3 harness 를 넓혔다. 판정식 · HC6 수치 · L3e 미승인 · gate 문안 · 기준선은 바꾸지 않았다.

**구 쪽 oracle**: `adr248-palette-old-replay.mjs --scenario axis` — G0 worktree (`2a5c970`, dirty 0) dev 서버에서 G0 axis 스크립트와 같은 편집 순서 (`updateElement({ props: { ...baseProps, [prop]: value } })`) 로 386축을 재생하고 축마다 구 layout rect 를 기록 ([재현 기록](248-phase3-palette-axis-old-replay.json)). **376/386 PNG 가 frozen 과 byte 동일**, 불일치 10 = Calendar·RangeCalendar 오늘 날짜 강조 (base 와 같은 구 앱 비결정성). base 모드는 수정 뒤에도 기존 결과와 byte 동일하게 재현된다 (Button·Card 대조).

**새 쪽**: 같은 harness 에 `ADR248_SCENARIO=axis` (DOM leg locale 은 글꼴처럼 `en-US` 고정 — Canvas date placeholder 와 같은 locale) ([결과](248-phase3-palette-axis-canvas.json)). 축 prop 은 인스턴스 계약이 받으면 저작하고, 받지 않는 축은 **구 앱에서 그 저작이 no-op 이었을 때만** (frozen 축 PNG = frozen base PNG) 무편집으로 실행한다 — 25축. 구 앱이 실제로 소비한 6축 (TagGroup variant accent/neutral/negative · Popover variant accent/neutral/surface) 은 새 계약에 그 prop 이 없어 `NOT_RUN: AXIS_PROP_NOT_IN_CONTRACT_OLD_CONSUMED` 로 남긴다.

| 측정 | 첫 실행 | 수리 뒤 |
| --- | ---: | ---: |
| axis 386 판정 | FAIL 168 · UNVERIFIED 193 · NOT_RUN 30 (계약 밖 축) | **FAIL 169 · UNVERIFIED 211 · NOT_RUN 6 · PASS 0** |
| axis 새 Canvas↔격리 DOM 계약 | 294/356 → (축 authoring 규칙 뒤) 316/380 | **362/380** |
| base 64 판정 | FAIL 27 · UNVERIFIED 37 | **FAIL 28 · UNVERIFIED 36** (ComboBox — 아래 제품 출력 원복) |
| base Canvas↔DOM | 63/64 | **60/64** (FileUpload · DateRangePicker · Calendar · RangeCalendar) |

**제품 출력 불변 — 앞 절 대조에서 빠진 2건 (정정)**: 이 작업 흐름이 앞 단계에서 넣은 **Preview 출력 변경 2건**이 남아 있었다. ① ComboBox · DatePicker · DateRangePicker · SearchField 아이콘 버튼 delegation 의 `min-width: unset` (rule 4곳 + 생성 CSS 4줄 — 일반 `.react-aria-Button` size `min-width` 68px 이 아이콘 버튼을 넓히던 것을 막음), ② `CalendarCommon.css` 탐색 버튼 `min-width: 0` (같은 68px 이 month heading 을 두 줄로 밀던 것). 앞 절의 "제품 파일 3개 대조" 는 이 둘을 빠뜨렸다. 사용자 결정 (Phase 3 기존 제품 출력 불변 · 제품 수리는 Phase 4 · 그때까지 FAIL) 대로 **둘 다 원복했다** (제품 파일 diff 0). 그 결과 새 typed 경로는 제품 DOM 그대로 아이콘 버튼 68px 을 따라가 base ComboBox 가 old/new geometry FAIL (구 Canvas 18 vs 새=DOM 68) 이 되고, Calendar · RangeCalendar 는 DOM heading 줄바꿈을 typed 헤더가 표현하지 못해 전 축 Canvas↔DOM FAIL 이다. 두 DOM 결함 (일반 Button `min-width` 가 합성 아이콘/탐색 버튼을 넓힘) 은 FileUpload 와 함께 **Phase 4 제품 수리 후보**로 기록한다. 이 흐름의 나머지 추적 파일 변경 (`toRacProps` 입력 타입 확장 · `TABLEVIEW_CHILD_STYLE`/`ARCHETYPE_BASE_STYLES` export · perf 하니스 `loadStorageState` · CHANGELOG · 테스트) 은 출력 변경이 없다.

**수리 (공통 의미론 → typed 입력 · 증분 Rust, 시험 전용 binding 없음)**

| 의미론 | 수리 | 닫은 축 |
| --- | --- | --- |
| 생성 CSS 가 로드되지 않는 상자 (`UNLOADED_GENERATED_CSS` B/D/E) | `manualBoxRules`: `Input` = 수동 `base.css` 상자 (width 100% · 1px border · 고정 height 없음) · `omit` 신설 (`SelectTrigger`/`SelectValue`/`DisclosureHeader`/`CalendarHeader` height, `ProgressBarValue`/`MeterValue` lineHeight — 그 값은 어느 stylesheet 도 읽지 않는다) | TextField·ColorField·NumberField·ComboBox·SearchField·Select 전 size |
| CSS `line-height` 상속 | text leaf 에 자기 값이 없으면 가장 가까운 조상 값 (DateInput segment 에만 있던 규칙 일반화), 조상 값이 바뀌면 자손 leaf 재계획 (`lineHeightInheritors`) | Select value · ProgressBar/Meter value |
| owner 자신에 선언된 소비 변수 | `ownerVariablePartRules`: `composition.containerStyles` / `containerVariants.size` 의 `--label-*` 등 → `CONSUMED_VARIABLES` 자식 (delegation 보다 낮은 우선순위) | ProgressBar·Meter·TextArea label |
| size 별 자식 선택자 | `composition.sizeSelectors` 컴파일 (`.X[data-size] .bar` / `.value`) | ProgressBar·Meter track·value |
| 다른 RAC 컴포넌트로 렌더되는 type | `domStyleRuleType`: binding `source.component` 가 다르면 그 rule 의 selector (generator 의 "selector unmatchable" skip 과 같은 조건 — TextArea ← TextField). owner 에 없는 size 규칙은 거른다 | TextArea |
| slider thumb | generator `generateSliderSizeMetrics` 와 같은 `indicator.thumbSize` → `SliderThumb` (via SliderTrack) | Slider |
| 루트에 `data-size` 가 없는 owner | `rootSizeAttribute` (Form = 없음 · RadioGroup `data-radio-size` · CheckboxGroup `data-checkbox-size` · TagGroup `data-tag-size`): 생성 `[data-size]` 값은 기본 size 로 고정, 실제 속성에 걸린 수동 CSS 사실은 size 조건 part 로 (group Label 글자 · TagList 간격/최소 높이 · Radio/Checkbox indicator) | Form · RadioGroup · CheckboxGroup · TagGroup |
| wrapper 를 거치는 규칙의 조건·우선순위 | `PartRule.child.viaProps` (wrapper 의 resolved prop 조건 — item indicator 는 그룹 size, gap 은 item 자신의 size) · resolver 가 부모 규칙 뒤에 조부모 `via` 규칙 적용 (owner 를 거치는 selector 가 더 구체적) | RadioGroup · CheckboxGroup |
| `font-size: inherit` / 상속 글자 | Disclosure trigger = Disclosure size 글자 + Button 기본 line-height 비율 + chevron 최소 높이 · Breadcrumb (sheet 미로드) = Breadcrumbs size 글자 | Disclosure · Breadcrumbs S |
| 자동 최소 크기 | `min-width: unset` 을 0 이 아니라 `auto` 로 (flex item 은 min-content) — 검증에 `minWidth`/`minHeight` `"auto"` 허용 | (DateRangePicker 에서 드러남, 아래) |
| calendar 부품 size | header 행 · day table 은 owner Calendar 의 size (typed 부품 자신의 size 는 DOM 이 읽지 않음), owner size 변경 시 재계획 | Calendar grid 높이 |

**Canvas↔DOM 남은 18 (axis) · 4 (base)** — 모두 새 쪽:

- FileUpload 2 (+ base): 사용자 결정대로 Phase 4.
- DateRangePicker 5 (+ base): Canvas segment 측정 문자열은 기존 제품 함수 `buildDateInputDisplayText` 의 `"MM / DD / YYYY"` (대문자·공백) 이고 RAC DOM 은 `mm/dd/yyyy` + 편집 segment 마다 좌우 2px padding 이다. 자동 최소 크기를 CSS 대로 고치자 이 폭 차이가 드러났다 (DOM 196.4 vs Canvas 217.6 @md, DOM 이 넘친다). RAC placeholder 표는 react-stately 비공개 내부라 가져오지 않았다 — **새 쪽 측정 결손 + 제품 Canvas↔Preview 비대칭으로 기록** (base Canvas↔DOM 63 → 62 는 이것 때문이다).
- Calendar · RangeCalendar 전 축 10 (+ base 2): typed CalendarHeader 는 단일 leaf 라 DOM `<header>` 의 버튼·heading 합성을 표현하지 못한다 — 제품 DOM 은 탐색 버튼이 일반 Button `min-width` 68px 로 넓어져 heading 이 두 줄로 줄바꿈된다 (위 원복). 헤더 합성 모델 (또는 Phase 4 제품 수리) 이 필요하다.
- Breadcrumbs L 1: 넘치는 마지막 crumb 이 Canvas 에서 1.05px 더 줄어든다 (min-content 측정 차이, 미조사).

**old/new geometry (HC6 그대로)**: axis FAIL 168 중 147 이 geometry 단독이다. 축 고유 FAIL 중 새=DOM 인 것은 field Label 높이 (구 24 vs 새=DOM 22.86) · ToggleButtonGroup/Checkbox/Switch (구 Canvas 만 size 를 자식에 전파, DOM 은 전파하지 않음) · DateField/TimeField label 이다 — 모두 **구 쪽 차이로 기록할 뿐 판정은 FAIL 유지** (§6.1, 사용자 결정). base [ledger](248-phase3-g3-old-defect-ledger.json) 재생성: 1px 초과 짝 99 — 후보 80 · DOM 짝 없음 7 · 새 쪽 결손 12 (FileUpload 8 · DateRangePicker 2 · Calendar 1 · RangeCalendar 1) · 짝 없는 구 노드 2. ComboBox 는 새로 FAIL 이 됐지만 그 짝은 새=DOM (제품 DOM 결함을 따름) 이다.

**발견 (판정 변경 없음)**:

- RadioGroup · CheckboxGroup · TagGroup · Form 의 **생성 CSS `[data-size]` 블록은 제품 DOM 에서 한 번도 맞지 않는다** (루트가 `data-size` 를 싣지 않음). 실제 size 는 수동 CSS 가 자기 속성으로 처리한다. 생성 CSS 가 선언한 size 값 (그룹 글자 · gap · label 변수) 은 dead 이다 — 제품 D3 채널 결손으로 기록 (Phase 3 에서 제품 수리 안 함).
- 날짜 placeholder: 제품 Canvas 는 `"MM / DD / YYYY"`, Preview RAC 는 locale 별 placeholder (ko `연도. 월. 일.`) — harness 는 글꼴처럼 DOM leg locale 을 `en-US` 로 고정했다 (`I18nProvider`).
- L3 단독 차단 2: Icon xl (0.0013/232) · Card lg (0.0010/94). 나머지 L3 차단은 구/새 geometry 차이의 결과다.
- 이번 흐름에서 다른 세션 커밋 `96ab2cee1` (헤더 메뉴) 이 G0 기준선 이후 제품 소스를 바꿔 G0 호환 게이트 (`baselineCompatibleHead`) 가 반응했다. 변경을 검토해 (메뉴는 G0 시나리오에서 닫혀 있고 대시보드는 state 없으면 조기 반환, i18n 은 메뉴 label 키 삭제뿐) blob 고정 `REVIEWED_UNRELATED` 에 사유와 함께 등록했다. 주석만 바뀐 파일 5개는 게이트가 이미 통과시킨다.

검증: shared 1,512/1,512 · builder 전체 8,102 통과 · 실패 1 (`borderGeometry.static` — 다른 세션 ADR-247 커밋 `f80a0146e`, 무관) · 브라우저 parity 1,583 통과 · skip 2 (env-gated 5k 기준선) · 실패 0 — adr248 묶음 단독 실행 3회 중 1회 GeometryDelta case 1 실패 (기존 flaky, 단독 4/4) · 팔레트 G3 harness base 1/1 · axis 1/1 · `pnpm type-check` PASS. 수정한 parity fixture 1: `adr248CatalogRealDom` Select/ComboBox trigger 는 이제 고정 rule height 없이 측정된 값 줄 높이를 쓰므로 제품 측정기 (`catalogTextMeasure`) 를 넘긴다 (단언 30 · DOM ≤1px 그대로). G0 호환 게이트의 `REVIEWED_UNRELATED` 에 `96ab2cee1` 파일 5개를 blob 고정으로 등록했다. G3 **FAIL 유지**, L3e UNVERIFIED, Phase 4 미착수, 커밋 없음.

## 2026-09-29 제품 출력 불변 대조 · old/new geometry 노드 ledger (이전)

**사용자 결정 (2026-09-29, 이 절의 재료에 대한 답)**:

- FileUpload 는 **Phase 4 로 미룬다**. Phase 3 의 기존 제품 출력 불변 계약을 유지하고 별도 제품 수리는 지금 하지 않는다 — 그때까지 FileUpload 는 G3 FAIL 로 기록한다 (새 쪽 결함 8짝 · FileTrigger DOM 짝 없음 1).
- old/new geometry 판정은 **현행 HC6 유지**. ledger 의 새=DOM · 구≠DOM 82짝은 규칙 변경을 검토할 근거일 뿐, 그 분류로 26종을 일괄 구 결함으로 승인하지 않는다. DOM 짝 없는 7짝은 대응 상자를 정해야 하고, FileUpload 새 쪽 결함 8짝은 별도로 남는다.
- 노드별 규칙이 확정되기 전까지 **G3 FAIL 27 · UNVERIFIED 37 · PASS 0, L3e UNVERIFIED 유지**. gate 문안·기준선 변경 없음.

사용자 검토 (2026-09-29) 가 요청한 두 확인과 결정 재료다. **G3 판정 · gate 문안 · HC6 기준은 바꾸지 않았다** (FAIL 27 · UNVERIFIED 37 · PASS 0 그대로).

**브라우저 parity 비통과 구분**: 앞 절의 1,582/1,585 = 실패 1 (합동 실행에서만 나는 기존 GeometryDelta case 1) + skip 2. skip 2 는 `adr923LayoutBaseline.browser.test.ts` 의 5k 노드 p50/p95 기록 2건으로, `VITE_ADR923_BASELINE=1` 일 때만 도는 env-gated `describe.skipIf` 다 (2026-09-17 커밋 `9317de375`, 이 작업과 무관). 이번 재실행은 **1,583 통과 · skip 2 · 실패 0**.

**기존 제품 출력 불변 대조 (breakdown §임시 코드: "기존 앱의 생성/저장 경로를 바꾸면 해당 변경을 Phase 4 로 옮긴다 · 공용 유틸 재사용은 출력 불변이 검증된 순수 함수로 한정")** — 앞 절이 보고한 두 변경은 이 계약 위반이었다. 둘 다 제품 경로에서 뺐다.

| 변경 | 제품 도달 경로 (실측) | 조치 | 확인 |
| --- | --- | --- | --- |
| Rust 확정 0 높이 | 엔진은 현재 Builder 와 공유 → Card preview 안 Image 선택 상자 200 → 0 | 트리 단위 opt-in `set_definite_zero_height` (기본 false, `setStrictInput` 과 같은 방식). 새 runtime `CatalogCompositionRoot` 만 켠다. 끈 경로는 추가 분기 전부 `zero_h_definite = false` 로 HEAD 와 같은 식 | cargo 440/440 — 회귀 테스트가 켠 경우 0, **끈 경우 종전 200** 을 함께 단언 · 제품 호출부 grep: 켜는 곳은 `catalogRuntime/compositionRoot.ts` 1곳뿐 |
| IllustratedMessage `heading`/`description` 기본값 | binding `accepts.default` 는 `toRacProps` (prop 없을 때 Preview 가 기본값 렌더) · 패널 currentValue · `defaultPropsDerivation` · AI catalog 가 읽는다 → 제품 출력 변경 | binding 파일 원복 (diff 0). 삽입 content 는 새 runtime 전용 `ruleDefinition.ts` `INSERTION_DEFAULTS` 가 소유 (factory 는 그대로) | G3 출력 JSON 이 원복 전과 byte 동일 (시각 필드 제외 diff 0) |

그 밖에 이 작업 흐름이 손댄 제품 파일 3개도 대조했다.

- `implicitStyles.ts` (현재 Builder layout 입력): 공용 순수 함수 `resolveCatalogRuleCanvasBox` · `catalogTextAreaInputHeight` 로 옮긴 부분을 HEAD 원본 사본과 차등 대조했다 — `resolveContainerStylesFallback` 은 rule 전 type (소문자·Pascal) × size (미지정·빈값·선언 size·미지 size) × 부모 style 키 21종으로 **34,986 사례 diff 0**, TextArea 입력 높이 77 사례 diff 0. 사본에 gap 변형을 넣으면 3,200 diff 로 반응한다 (probe 는 확인 뒤 삭제).
- `renderCommands.ts` · `nodeRendererTypes.ts`: `clipBorderInset` 선택 필드. 설정하는 곳은 새 runtime `canvasBinding.ts` 1곳뿐이고, 없으면 inset 0 이라 clip rect 식이 HEAD 와 같다 (layout 폭은 음수가 아니므로 `max(0, …)` 도 같은 값).

**결정 1 재료 — old/new geometry 노드 ledger** ([ledger](248-phase3-g3-old-defect-ledger.json), 생성 `apps/builder/scripts/adr248-g3-old-defect-ledger.mjs` — harness 출력만 읽는다): geometry 다리가 막힌 27종의 1px 초과 짝 **97** 마다 구 rect · 새 rect · 같은 새 노드의 격리 DOM rect · 자기와 조상의 old/new 엔진 입력 차이를 붙였다.

| 분류 | 짝 | type |
| --- | ---: | --- |
| 후보 (새↔DOM ≤1px · 구↔DOM >1px) | 82 | 19종은 전 짝이 후보: ProgressBar · Card · Breadcrumbs · Nav · Pagination · DisclosureGroup · Disclosure · IconButton · Toolbar · ButtonGroup · CheckboxGroup · Select · Slider · Meter · Form · Table · ListBox · DatePicker · DateRangePicker |
| DOM 짝 없음 (대체 상자를 사례별로 지정해야 함) | 7 | Tabs (TabPanels) · TagGroup (TagList `display: contents`) · Calendar · RangeCalendar (CalendarHeader) · Popover 닫힌 내용 2 · FileUpload FileTrigger |
| 새 쪽 결함 | 8 | FileUpload (DropZone 이 52 로 눌려 아래 행이 전부 73px 위) |
| 짝 없는 구 노드 | 2 | SearchField (구 clear 버튼 — RAC 는 빈 값이면 숨김) · Tree (구 접힌 하위 항목 — RAC 는 접힌 항목을 렌더하지 않음) |

후보 82짝 중 75짝은 자기·조상 노드에 old/new 엔진 입력 차이가 기록돼 있다. 나머지 7짝 (Card 4 · DisclosureGroup 2 · Form 1) 은 자기·조상 입력이 같아 원인이 형제 입력 또는 구 엔진 경로다 (Card 는 확정 0 높이 — 끈 엔진이 200 을 내는 사례). **ledger 는 판정을 바꾸지 않는다** — 26종 일괄 면제가 아니라, 사용자가 승인할 old/new 다리 규칙을 노드 단위로 적용할 재료다.

**결정 2 재료 — FileUpload (a) 의 Preview 출력 변경 범위**:

- 현재 상태: 구 Canvas (현재 Builder) 는 FileTrigger 0×0 (안 보임) · DropZone 52, Preview DOM 은 FileTrigger UA 기본 button · DropZone 120 → 현재 Builder 와 Preview 도 이미 다르다.
- FileTrigger: 생성 CSS (`generated/FileTrigger.css`) 에 size 상자 (height · padding) 와 variant paint (fill · text · border · hover/pressed) 가 없다. (a) 는 이를 emit 해 **모든 FileTrigger (단독 · FileUpload 안) 의 Preview/Publish 모양이 UA button → catalog 버튼** (sm 32/12 · md 40/24 · lg 48/32, default = layer-1 fill · neutral text · border, accent = accent fill · on-accent text) 으로 바뀐다.
- DropZone: `--icon-size` 는 생성 CSS 가 내지만 `.dropzone-icon` 을 읽는 규칙이 없어 lucide 기본 24px 이다. (a) 는 md 32 · lg 40 으로 키운다 (sm 24 는 같음). 고정 height (80/120/160) 안의 내용 높이가 8/16px 늘어 넘침 여부는 적용 전 격리 DOM 으로 재야 한다.
- 계약 충돌: 이것은 기존 Preview 출력 변경이므로 breakdown §임시 코드상 ADR-248 Phase 3 안에서 할 수 없다. 별도 제품 결함 수리 (CHANGELOG 대상) 로 먼저 하거나 Phase 4 로 미루는 선택이 필요하다.

검증: engine cargo 440/440 · shared 1,512/1,512 · builder 전체 8,090 통과 · 실패 1 (`borderGeometry.static` — 다른 세션 ADR-247 커밋 `f80a0146e`, 무관) · 브라우저 parity 1,583 통과 · skip 2 · 실패 0 · 팔레트 G3 harness 1/1 (결과 byte 동일) · `pnpm type-check` PASS.

## 2026-09-29 팔레트 Canvas↔DOM 계약 63/64 · 남은 old/new geometry FAIL 은 구 쪽 차이 (이전 — 제품 경로 변경 2건은 위 절에서 정정)

[결과](248-phase3-palette-base-canvas.json) (harness 는 같은 파일·같은 판정식): **FAIL 27 · UNVERIFIED 37 · PASS 0**, 새 Canvas↔격리 RAC DOM 계약 **63/64** (앞 절 56). 차단 다리: geometry 27 · Canvas↔DOM 1 (FileUpload) · L3 2 (Pagination · FileUpload). HC6 수치·마스크·G0 정본·판정식은 바꾸지 않았다.

**이번 수리 (공통 의미론 → typed 입력 · 증분 Rust · 제품 binding)**

| 의미론 | 수리 | 닫은 사례 |
| --- | --- | --- |
| collapsed composite 의 template root 가 받는 part rule | resolver `ParentContext.collapsed` — composite 인스턴스가 자기 template root 를 투영할 때 part rule 은 구조 부모 기준 (consumer tree 가 두 층을 하나로 합치는 것과 같은 규칙) | Breadcrumbs crumb line box |
| 생성 CSS 가 로드되지 않는 rule | `manualBoxRules` `Breadcrumb` — `UNLOADED_GENERATED_CSS` B 범주, 상자 = 수동 `Breadcrumbs.css` | Breadcrumb 높이 24 → 22.86 |
| text max-content 는 소수 | text leaf `contentMaxWidth` = 정확 advance, `rewrap` 비교도 같은 값 (ceil 누적 제거) | Breadcrumbs x 누적 1.03 · Tabs · Meter · ProgressBar 0.2~1.0 → ≤0.02 |
| 같은 type 자식 여럿을 가르는 owner 토큰 | `SUBPART_CHILD_PROPS` (SearchField `.search-icon svg` → `iconName: search`, `.react-aria-Button` → `x`) · `… svg` 토큰 = glyph `iconSize` · token base 규칙에도 같은 child props | SearchField 아이콘 16 · clear 버튼 18 |
| RAC 상태 표시 | presence `catalogSearchFieldOfClear` — `data-empty` 면 clear 버튼 display none (scope/dependents 포함) | SearchField input 폭 158 → 182 |
| DOM 이 읽지 않는 sub-part style | converter gap `DOM_UNREAD_SUBPART_STYLE` — field trigger 의 `SelectIcon` 인라인 style 은 어느 DOM renderer 도 읽지 않는다 (grep 0) → Canvas 전용 style 을 template 에 싣지 않음 | SearchField 아이콘 18 |
| 요소 style 을 받는 DOM 상자 | harness: subject 상자 = renderer 최외곽 요소 (TagGroup 은 style 을 RAC TagGroup 밖 `div` 에 싣는다) · `TagList` 의 `height: 100%` 는 auto 높이 RAC TagGroup 기준이라 무효 → typed 에서 제거 | TagGroup 130 → 88 · tag y 64.5 → 54 |
| **확정 0 높이 column flex (Rust)** | `height_is_definite_zero` — 저작 `0px` 또는 부모 분배/stretch 가 0 으로 확정한 column 의 main 은 definite 0 (종전 `explicit_h` 0 = 미지정 센티넬이라 자식이 indefinite 로 풀림). 회귀 테스트 `definite_zero_height_column_shrinks_children` 3사례 (Chrome 산술) | Card preview Image 200 → 0 |
| 여러 DOM 부품을 대표하는 typed 자식 | `catalogSubpartDomUnion` — DateRangePicker 의 typed DateInput 1개 = RAC start/end 쌍 (+ 구분자) 합집합 | DateRangePicker 101.9 → 0.001 |
| RAC 소유 값의 sub-part 투영 | record `derivedProps` (`catalogDerivedProps`): ProgressBar/Meter track 의 fill % · TreeItem `_treeLevel`/`_hasTreeChildren`/`isExpanded` — Canvas 는 resolved props 위에 칠하고 DOM owner 는 자기 것을 렌더. 소유자 편집 시 dependents 재계획 | ProgressBar·Meter fill 누락 (L3e 에 가려 있던 도색 결함, L3e 차이 292/440 → 0) · Tree chevron |
| owner 가 합성하는 DOM 상자 (catalog 노드 없음) | `catalogComposedParts` — slot chrome 과 같은 비-record Rust 노드. TreeItem chevron 버튼 (20px 수축 · level 들여쓰기), CheckboxGroup/RadioGroup items wrapper (`catalogItemsWrapper` — rule `containerVariants.orientation.nested` + size 변수). wrapper 자식 geometry 는 record 부모 기준으로 접어 반환 | Tree 35.9 → 0.006 · CheckboxGroup 2.02 → 0.01 |
| 수동 상자 | `TreeItem` (Tree.css 행) · `Radio` (`width: fit-content`) | RadioGroup |
| 삽입 기본값 | IllustratedMessage binding 기본값 = 팔레트 factory 값 ("No results") — 구 삽입 content 와 같은 입력 | IllustratedMessage L3 550 → 0 |

**남은 FAIL 27 분류** — harness 가 old/new 1px 초과 짝마다 같은 새 노드의 격리 DOM 상자를 함께 기록한다 (`canvasDom.geometryArbiter`):

- **old ≠ new, new = DOM (26종)**: ProgressBar · Meter · Slider (label 행 늘림) · Card (preview Image 0) · Tabs (TabList 폭 · TabPanel) · Breadcrumbs · Nav · Toolbar · ButtonGroup · Form (구 폭 ceil · Form 필수 표시 상속 없음) · Pagination (wrap) · Disclosure(Group) (패널 padding · chevron) · IconButton · SearchField (구 clear 버튼 표시 · 아이콘 18) · CheckboxGroup (구 items 폭 균등 없음) · Select · DatePicker · DateRangePicker · Table · ListBox · Tree (구 행 24 · chevron 없음) · TagGroup · Calendar · RangeCalendar (구 header 0 높이) · Popover (구 border 미예약). DOM 짝이 없는 5노드 (TabPanels · TagList `display: contents` · CalendarHeader · Popover 닫힌 내용) 는 DOM 에서 같은 역할의 상자 (TabPanel · `.tag-list-wrapper` · `<header>`) 와 대조해 새 값과 같다. 이 사례들은 breakdown §6.1 대로 **구 쪽 차이로 기록할 뿐 면제·PASS 소급하지 않는다** — 그래서 G3 는 이 26종에서 old/new geometry 다리가 계속 차단된다.
- **FileUpload (새 쪽 미해결)**: DropZone 은 DOM `DropZone.tsx` 가 아이콘 (lucide 기본 24px — catalog `iconSize` md 32 미적용) · label · description 을 합성하고 생성 CSS `height: 120px` 로 눌리지 않는다. 새 Canvas 는 그 내용을 그리지도 측정하지도 않아 형제에 밀려 52 로 준다. FileTrigger 는 생성 CSS 가 rule 의 size/variant 상자를 emit 하지 않아 (`composition.containerStyles` 가 `compositionOwnsContainerBox`) DOM 이 UA 기본 button (padding 1px 6px · border 2px) 으로 보인다 — catalog 가 선언한 버튼 (md height 40 · paddingX 24 · fill) 은 어느 소비자도 그리지 않는다. 어느 쪽을 D3 결과로 볼지 정해야 Canvas 를 맞출 수 있다.

**발견 기록 (판정 변경 없음)**

- typed library 의 color token 은 `primitives/colors.ts` (accent = Tailwind blue-600 `#155DFC`) 이고 DOM 테마 `--accent` 는 `oklch(from var(--tint) 55% c h)` (≈ `#3660F0`, 구 Canvas 와 같음). pixelmatch 0.1 안이라 L3 를 막지 않지만 새 Canvas↔DOM 색 비대칭이다 (Slider fill 등).
- L3 영역식은 3px band 를 L3e 로 뺀다 — 8px 트랙 같은 얇은 상자는 통째로 L3e 라 ProgressBar fill 누락이 L3 0 으로 보였다. L3e 차이를 type 별로 함께 읽어야 한다 (이번에 fill 누락을 찾은 경로).
- Icon 삽입 iconName 은 구 앱이 무작위라 frozen 과 다를 수 있다 (L3e 20px).
- GridListItem template root 의 `children: "{label}"` 은 composite accepts 가 비어 해석되지 않은 채 남는다 (그리기 경로 영향 없음).

검증: shared 1,512/1,512 · builder catalogRuntime+layout+adapters 1,037/1,037 · engine cargo 440/440 (+ 새 회귀 1) · 브라우저 parity 1,582/1,585 (실패 1 = 합동 실행에서만 나는 기존 GeometryDelta case 1, 단독 2/2 · adr248 14/14 PASS) · 팔레트 harness 1/1 · `pnpm type-check` PASS. builder 전체 8,088 중 실패 1 = `borderGeometry.static` (`staticShell/shellSnapshot.ts:67`, ADR-247 커밋 `f80a0146e` — 다른 세션, 이 작업과 무관). 이 작업이 만든 G5 legacy-field grep gate 위반 1 (`slotOverlay.ts` `componentRole`) 은 canonical `reusable`/`ref` 로 고쳐 복구했다.

**G4/G5·Builder entry 재확인 (현재 코드)**

- G4 독립 저장·복원: 기존 code catalog Text+template IDB·JSON·folder 왕복 1/1, 그리고 새 [`phase3PaletteStorageRoundtrip`](../../../apps/builder/src/builder/catalogRuntime/__tests__/phase3PaletteStorageRoundtrip.test.ts) — G3 harness 와 같은 경로로 팔레트 **64/64** type 을 project node 로 만들고 width 편집 → Undo → Redo → IDB 저장 → load → JSON·folder 교환 뒤 문서와 resolved tree 가 같다 (composite 는 width 가 template root 에 닿는 것까지). 원복 RED 는 돌리지 않았다. 저장 중 project 전환·강제 실패·탭 충돌·publish 진입점은 여전히 미검증 → G4 UNVERIFIED.
- G5: 60/600/5k leaf 편집 결정적 카운트 3/3 (변경 입력 1 + resolver 조상만 방문) · 문서 byte 0/1/60/600/5k 1/1 · 소비자 원자성 10/10 — 현재 코드에서 같은 값. production paired p95·heap·bundle 은 Phase 4 연결 뒤 항목 → G5 UNVERIFIED.
- Builder entry 격리: `catalogRuntime/` 과 `packages/shared/src/catalog/document/` 를 import 하는 제품 파일은 두 폴더 밖에 0 (grep) — 현재 Builder·Publish entry 는 새 runtime 에 닿지 않는다. 공유된 것은 순수 함수 `resolveCatalogRuleCanvasBox` (구 implicitStyles 와 공용, 결과 동일 — layout 테스트 통과) 와 Rust 엔진뿐이다. **엔진의 확정 0 높이 수리는 현재 Builder Canvas 에도 적용된다** (Card preview 안 Image 상자가 0 — Preview DOM 과 같은 값; preview 가 `overflow: hidden` 이라 보이는 픽셀은 같다). 브라우저 parity 1,582 PASS.

G3 **FAIL 유지**, G4/G5 UNVERIFIED, Phase 3 미완료, Phase 4 미착수.

## 2026-09-29 팔레트 64종 old/new Canvas 규모 비교와 layout 입력 경로 (이전)

**census 실행 129/130** (파리티 아님): 위임 DOM binding (collection 8종 포함) · 단독 item 호스팅 · 닫힌 overlay · Tabs 선택 패널 (`ownsDescendant` — RAC 는 선택된 TabPanel 만 렌더, 키 없으면 RAC 기본 첫 활성 탭) · Tree 접힌 하위 항목. 남은 1건 `ColorSlider` 단독은 RAC `useColorSliderState` 가 value/defaultValue 를 요구하는데 등록 계약에 value 가 없다 — **구 Preview generic 경로도 같은 오류**를 낸다 (`toRacProps` → `RAC.ColorSlider` 실측 `useColorSliderState requires a value or defaultValue`). 구 결함으로 기록하고 값을 지어내지 않았다.

**구 쪽 oracle 보충** ([재현 기록](248-phase3-palette-old-replay.json), 스크립트 `apps/builder/scripts/adr248-palette-old-replay.mjs`): frozen [팔레트 기준선](248-baseline/palette-production-base/baseline.json)은 카메라를 표시값 68% 로만 남겼다. G0 기준 commit `2a5c970` 을 별도 worktree (그 lockfile 설치 · 엔진 wasm 빌드 · dirty 0, gitignored `.env`/license 만 복사) 의 dev 서버로 띄워 같은 시나리오를 재실행했다. **61/64 PNG 가 frozen 과 바이트 동일**, 2회 반복 동일. 카메라는 64건 모두 zoom 0.675 · pan (72, 85.5) = `computeFitViewport` (1440×900 / 페이지 1920×1080 × 0.9) 와 일치. 불일치 3건은 구 앱 비결정성이다 — Icon 기본 아이콘 선택이 실행마다 다름 (137px), Calendar·RangeCalendar 는 오늘 날짜 강조 (176px). 같은 실행에서 삽입 subtree 의 구 layout rect (경로 ID) 를 geometry oracle 로 기록했다.

**새 쪽** ([결과](248-phase3-palette-base-canvas.json), [PNG](248-phase3-palette-base-canvas/), `apps/builder/tests/adr248-g3/paletteBaseCanvas.browser.test.ts`, 전용 config `vitest.adr248-g3.browser.config.ts` = frozen 캡처와 같은 headless Chrome channel): code library → composition root (Rust layout · 제품 측정기 `catalogTextMeasure`) → 제품 Canvas binding → `renderCommands` → CanvasKit **WebGL**, 같은 카메라·clip, 날짜는 캡처일 2026-09-28 고정. 판정은 HC6 그대로 — geometry 구조 짝 노드 ≤1 CSS px · 짝 없는 노드 0, L3 = clip − 텍스트 상자 − L3e 3px band 에서 pixelmatch 0.1 ratio > 0.001 AND maxByte > 2 차단, L3e 기록만 (예산 미승인 UNVERIFIED), 텍스트 상자 기록만 (HC6 텍스트 예산 없음). L3e 가 미승인이라 어떤 type 도 PASS 가 될 수 없다.

| 결과       | 수  | 비고                                                                                                                                                                |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASS       | 0   | L3e 미승인                                                                                                                                                          |
| UNVERIFIED | 17  | geometry ≤1 · L3 미차단. Button·Badge·Skeleton·Avatar·StatusLight·ToggleButton 등은 L3 maxByte **0** (픽셀 완전 일치) — 카메라·래스터 환경 재현이 정확하다는 대조군 |
| FAIL       | 47  | 46종 geometry, IllustratedMessage 1종 L3 만 (0.0027 / 232)                                                                                                          |

2회 실행의 type별 결과는 byte 동일하다.

**FAIL 원인 = 새 layout 입력에 구 엔진 입력 의미론이 없음** (대표 사례, 새 vs 구 절대 rect):

- 글자 intrinsic 폭: Tab 항목 24 vs 58, 그 Label 0×0 vs 34×21 (rule-backed 노드는 `button`/`label` binding 외 측정 입력 없음) · 측정 반올림 TextField label 64.63 vs 63, Checkbox 67.19 vs 66, Dialog 105.50 vs 104.
- indicator 공간: Checkbox label x 30 vs 58 (구 phantom indicator).
- grid: ProgressBar label/value/track 구 grid 배치 vs 새 세로 적층 (value 30×69 at x 220 vs 220×34 at y 88).
- margin: Separator y 38 vs 30.
- 부모 padding·숨김 sub-part: Table 행 (39,31) vs (30,30), TextField 빈 description (30,92) vs (30,30).

이 의미론은 구 `calculateFullTreeLayout` 의 `traversePostOrder` (1,225줄) 오케스트레이션에 있다. **사용자 판정 (2026-09-29)**: 구 파이프라인 재사용은 불승인 — 구 실행기는 canonical `frameMirror` 를 import 하고 (`layoutRootKey.ts:1`) 전역 상태와 매 호출 전체 DFS 를 써서 HC1 (Builder canonical 사용 0) · breakdown §6.2 (leaf 편집 전체 scan 0) 와 맞지 않는다. **기본 경로 = typed 입력 확장 + 증분 Rust 경로 수리**, 필요한 계산만 작은 순수 함수로 공유한다. 구 전체 파이프라인은 비교 oracle 로만 쓴다. typed 입력 확장은 ADR-248 소비자 조립 범위 안이다 — 앞서 "세 경로 모두 계약 밖" 이라 적은 판정은 틀렸다. 수리는 실패를 공통 의미론별로 분류해 진행하고, 짝 없는 노드가 있는 사례는 자식 대응 관계를 먼저 확인한다.

G3 전체 판정은 **FAIL 유지** (기존 PASS 0 · FAIL 2 · UNVERIFIED 142 집계와 별도로 팔레트 64종 사전 근거 FAIL 47 · UNVERIFIED 17). HC6 수치·마스크·G0 정본은 바꾸지 않았다. G4/G5 전체 UNVERIFIED, Phase 3 미완료, Phase 4 미착수.

검증: shared 1,511/1,511 · catalogRuntime 58/58 · 격리 Chromium adr248 14/14 · 팔레트 G3 harness 1/1 (2회 결과 동일) · `pnpm type-check` PASS.

## 2026-09-29 공통 실행기·composite=root·typed enabled/자손 patch

**SelectTrigger ARIA 단언 실패 원인**: 테스트가 RAC Select 트리거를 `role="combobox"` 로 가정했다. 설치된 `react-aria` 3.52 `useSelect` 는 `useMenuTrigger({ type: "listbox" })` 로 트리거 `<button>` 에 `aria-haspopup="listbox"` 만 붙이고 `role` 을 두지 않는다 (`role="combobox"` 는 ComboBox 의 input). 제품 binding 은 바뀌지 않았고 단언만 설치본 계약으로 고쳤다 — 격리 Chromium 8/8.

**공통 경로 (시험 전용 type binding 없음)**:

- `ruleDefinition.ts` — 등록 type 전부 (frame/Group/Slot 제외) 의 typed definition: 등록 props 계약 + `COMPONENT_RULES_TABLE` rule 의 루트 상자 선언 (CSSGenerator 의 archetype/composition/containerStyles/size emit 과 skip 규칙) 을 typed 기하로, rule 자체는 `ruleId` → `CatalogLibrary.rules` (read-only D3 코드 데이터, revision digest 포함).
- `ruleShapes.ts` (Canvas) — 구 generic 경로의 순수 함수 (`buildCatalogShapes`·skia primitive·`resolveCatalogPaint`·`specShapesToSkia`) 를 typed rule + resolved props 로 호출. 라이브러리 값과 다른 resolved visual 만 저작 override 로 올린다 (`libraryVisual.ts`).
- DOM rule 실행기 — 등록 source (`rac` → RAC 컴포넌트, `internal` → `INTERNAL_RENDERERS`) + `toRacProps` data-* (생성 class CSS 가 라이브러리 값을 소유), 저작 visual 만 inline. Preview 위임 렌더러 type 은 `CATALOG_DOM_BINDING_REQUIRED` 로 명시 실패.
- composite 인스턴스 = template root (ADR §3.4 "instance root 값"): resolver 가 인스턴스의 저작 props/visual/sizing 을 root 에 적용하고, composition root 가 composite 층을 root 로 합친다 (DOM wrapper div 제거, `collapsedIds`). template binding 은 구 `templateBinding.ts` 계약 (propsSchema 키 한정, 값 없으면 schema 기본값, 둘 다 없으면 placeholder 보존, 중첩 composite 는 자기 binding) 으로 일반화 — IconButton 이름 분기 제거.
- typed `enabled` (G0 필드 매핑 `node.enabled`) 와 라이브러리 template `descendantPatches` · composite 인스턴스 accepts = root ∪ schema (`instanceContract`). 변환 gap 1,110 → 914 (구 `descendants` 88·`enabled`·인스턴스 prop 125 표현).

**재집계 (판정 변경 없음)**: census 는 G0 coverage 가 `INDIRECT_PARENT_CONTEXT_ONLY` 로 분류한 33 type 을 이제 부모 composite 안에서 실행한다 (단독 실행으로 세지 않음). 실행 **42/130** — 단독 21 · composite 16 · 부모 문맥 3 · 시험 fixture 2. 남은 실패는 Preview 위임 렌더러 48종의 DOM binding 부재가 대부분이다. 실행은 파리티가 아니다: G3 **PASS 0 · FAIL 2 · UNVERIFIED 142**, HC6 수치·L3e 미승인 그대로.

**G0 HEAD**: 다른 세션의 docs·starter 제거 커밋 3건으로 HEAD 가 바뀌어, 기준 HEAD 문자열 일치 단언 7건을 `baselineCompatibleHead` (기준 HEAD 조상 + 제품 소스 경로의 주석 제외 내용 동일) 로 바꿨다. 이번 diff 의 제품 경로 변경은 주석 5파일뿐이다.

검증: shared 610/610 · catalogRuntime 58/58 · 격리 Chromium adr248 14/14 (합동 실행 1/3회 GeometryDelta case 1 DOM notify 0 — 단독 2/2·합동 2/2 재실행 PASS, 원인 미조사) · type-check PASS.

## 2026-09-29 공통 binding 후 G3 재집계와 투영 계약 차단 (최신)

현재 [실행 census](248-phase3-g3-census.json)는 등록 universe **130 type / 468 state**를 그대로 사용한다. 기본 인스턴스 실행은 **12/130** (기존 8종 + Button, Icon, SelectIcon, FieldError), source code definition 실행 10종 중 2종(Group, Slot)은 여전히 시험 fixture definition이다. composite 64종 모두 공통 wrapper를 통과하지만 전체 template이 실제 Canvas·DOM 경로를 통과한 것은 **Button 1종**이다. 따라서 composite wrapper만으로 나머지 63종을 실행으로 세지 않았다. `IconButton`은 필요한 binding ID가 모두 있지만 template `iconName: "{icon}"`이 unresolved인 채 glyph painter에 도달해 `FAILED_AT_CANVAS`다. 나머지는 composite binding 결손 62, 직접 binding 결손 37, typed definition 결손 18이다. 누락 binding ID 99종 중 최상위는 `selecttrigger` 7종, 다음은 `calendarheader`·`calendargrid`·`input`·`selectvalue`·`listboxitem`·`dateinput` 각 5종이다.

이번 구현은 등록 Button 규칙의 variant/size 기본 visual과 공통 Canvas text-box · shared RAC Button, 등록 Icon/SelectIcon 규칙의 size/color와 공통 Lucide Canvas `icon_path` · shared DOM Icon, FieldError의 기존 텍스트 rule과 공통 text painter · DOM error span을 제품 binding 경로에 연결했다. `premium/genai` hover/pressed에 쓰인 `{color.purple-hover}`·`{color.purple-pressed}`는 현 토큰표에서 해석되지 않아 상태 rule을 임의 색으로 채우지 않았다. **등록 state에 대응하는 typed stateRules는 0/468**이며, 실행 12종 소속 state 38개도 state/HC6 PASS가 아니다. 같은 제품 DOM binding의 격리 Chromium Button·Icon·FieldError 사례 1/1, source library 3/3 (Button outline·SelectIcon size resolver 포함), Rust WASM→Canvas→DOM census 1/1, code catalog IDB·JSON·폴더 왕복 1/1을 확인했다.

다음 최빈도 `selecttrigger`는 현재 제품 binding 주석상 Select/ComboBox/NumberField/SearchField 등의 **부모 RAC가 self-compose하고 독립 DOM 노드는 0개**인 sub-part다. 반면 새 reusable template은 `type-SelectTrigger` 자식 노드를 독립 ID로 가진다. 현 `DomBinding`/census 계약은 각 resolved node의 DOM 요소를 요구한다. 단순 `<div>`나 독립 RAC Button으로 채우면 D1의 부모 소유 ARIA/상호작용 의미를 바꾼다. `IconButton`의 `{icon}`/`{label}`처럼 template placeholder도 composite `accepts/defaults: {}`와 resolver의 무보간 경로 때문에 실행 의미가 없다. **부모 흡수 sub-part의 typed 노드 ID·DOM/ARIA 소유와 template placeholder 값 공급/누락 정책**은 현 설계로 결정되지 않는다. 이 두 투영 계약을 정하기 전에는 남은 binding ID를 일괄 추가해 G3 실행 수를 높일 수 없다.

G3 판정은 기존 **PASS 0 · FAIL 2 · UNVERIFIED 142**, HC6 geometry ≤1 CSS px · 비텍스트 L3 ratio ≤0.001 및 L3e 미승인 상태 그대로다. G4는 독립 code catalog 저장·복원/교환 1/1과 이전 실패·충돌 근거만 유효하며 전체는 UNVERIFIED다. G5는 이전 60/600/5k leaf 결정적 카운트 3/3 · 문서 byte 0/1/60/600/5k 5/5 근거를 재사용한다. 새 library definition은 저장 snapshot 0 B 경계를 유지하지만 production paired p95·heap·bundle은 Phase 4 연결 뒤 항목이어서 G5 전체 UNVERIFIED다. Phase 3 미완료, Phase 4 제품 entry 미착수다.

## 2026-09-29 공통 제품 binding 및 독립 gate 재판정 (최신)

[현재 실행 census](248-phase3-g3-census.json)와 [source inventory](248-phase3-code-catalog-inventory.json)는 등록 130 type·요구 시각 축 1,333개·slot role 14개의 범위를 유지한다. source-derived text 정의는 2→5개다. 실제 typed library 인스턴스 → resolver → Rust WASM → 제품 Canvas binding → 제품 DOM binding의 SSR 출력에서 모든 resolved node가 렌더됐는지 검사했다. 실행 가능한 기본 type은 **8/130** (Description, Group, Heading, Label, Paragraph, Slot, Text, frame)이고, 이 중 Group·Slot은 시험 fixture definition만 있으므로 code catalog 정의까지 갖춘 것은 6개다. 등록 state 축 468개 중 실행 가능한 type에 속한 것은 18개이나 typed state rule은 **0/468**이다. 따라서 기본 type 실행을 state·시각 parity PASS로 세지 않는다.

| 미실행 분류        | type | 제품 경로 결손                                                                                                                                                                        |
| ------------------ | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| composite template |   64 | 공통 composite wrapper는 Canvas 투명/작성 paint 컨테이너와 DOM 중립 div로 실행되지만, template 자식의 실제 binding이 더 필요하다. 기존 binding만으로 끝까지 실행되는 composite는 0개. |
| 직접 정의          |   40 | 해당 leaf/control의 실행 binding과 상태·시각 계약이 필요하다.                                                                                                                         |
| typed 정의 없음    |   18 | 등록 source에서 typed 정의 자체를 파생해야 한다.                                                                                                                                      |

누락 실행 ID는 **103개**다. `label`·`description`은 동일 Canvas text painter와 각각 RAC Label·description slot DOM에, `paragraph`는 같은 painter와 `p` DOM에 연결했다. 세 정의의 기본값·size·색·글꼴은 실제 등록/rule/token에서 파생하고, 격리 Chromium DOM에서 resolved 글자 크기와 요소/slot/text를 확인했다. `FieldError`는 RAC field invalid 문맥에 따라 DOM 출력이 달라 단독 generic text binding으로 통과 처리하지 않았다. 각 type의 개별 시험 binding은 추가하지 않았다. composite wrapper와 이 text leaf 경로는 `catalogRuntime/`의 제품 모듈이며, Builder entry에는 아직 연결하지 않았다.

독립 **G4 준비 근거**: 기존 Phase 2 시험의 IDB 실패·중단·탭 충돌·프로젝트 전환 및 JSON/폴더 명시 거부 근거를 재사용하고, [현재 code library 시험](../../../apps/builder/src/builder/catalogRuntime/__tests__/phase3CodeLibraryStorage.test.ts)으로 Text 편집→Undo/Redo→IDB 저장/재로딩과 composite template 보존, JSON·폴더 export/import를 1/1 확인했다. 제품 Builder refresh·iframe stale/gap·publish 진입점은 Phase 4 연결 뒤 판정한다. 외부 `.pen`은 2026-09-29 범위 정정에 따라 G4에 넣지 않는다.

독립 **G5 결정적 카운트**: 변경된 root에서 `phase3DeltaScale`의 60/600/5k leaf 편집 3/3과 `phase3BindingDelta`의 실제 Canvas/DOM leaf 갱신을 포함한 인접 17/17이 통과했다. leaf당 graph entries 순회 0·table clone 0·record 교체 1·full serialization 0·layout input 방문 1·resolver 방문 2·무관 통지 0이다. [문서 byte](248-phase3-document-byte-budget.json)의 0/1/60/600/5k **5/5** 기존 근거는 library snapshot 0 B 조건으로 재사용한다. production paired p95·heap·bundle·실제 동일 소비자 판정은 Phase 4 항목이며 G5 최종 PASS가 아니다.

검증: 새 census·code library 저장·G5 인접 Vitest **17/17**, shared source library **2/2**, 격리 Chromium leaf DOM **1/1**, scoped Prettier·ESLint(기존 Fast Refresh warning 1, error 0), TypeScript 검사 PASS. 기존 reusable origin 재생성 대조는 실행 locale이 `en-US`로 달라 생성 정본의 `ko-KR`와 Calendar 4값이 달랐고, 시험 입력의 날짜·locale을 정본 생성 조건으로 고정해 1/1 PASS로 복구했다. **G3 PASS 0·FAIL 2·UNVERIFIED 142**, 전체 G4/G5 **UNVERIFIED**, Phase 3 **미완료**다. HC6 geometry ≤1 CSS px·비텍스트 ratio ≤0.001 및 L3e 미승인 상태, 기존 G0/coverage 근거는 바꾸지 않았다. Phase 4 제품 entry 전환은 시작하지 않았다.

## 2026-09-29 G3 등록 type·state 재집계 — 이전 판정

재집계만 했다. G3 판정 (PASS 0 · FAIL 2 · UNVERIFIED 142) 과 coverage manifest 는 바꾸지 않았다. 산출: [`248-phase3-g3-census.json`](248-phase3-g3-census.json), 시험 `phase3G3Census.test.tsx` (2회 실행 동일 해시).

방법: 등록 universe 를 현재 소스 `componentCatalog` (184 항목) ∪ `COMPONENT_RULES_TABLE` (129 type) 에서 다시 뽑았다 → **130 type** (G0 와 같은 집합). type 마다 현재 typed library (`buildCodeCatalogLibrary` — reusable origin 이 있으면 그 composite, 없으면 직접 정의, 둘 다 없으면 시험 fixture library) 의 정의로 인스턴스 1개를 만들어 제품 경로 composition root (실제 Rust wasm) → `bindCatalogCanvas` → `renderCatalogDom` (정적 렌더) 에 태웠다. 판정은 실행 결과이고, "resolved node 중 제품 binding 7종 (frame · rectangle · box · group · slot · text · heading) 밖의 bindingId 가 있으면 실패" 와 130/130 일치함을 시험에서 확인했다.

| 분류                                                        | type 수 | 등록 state (G0 structure+paint 축) |
| ----------------------------------------------------------- | ------- | ---------------------------------- |
| 실행 가능 — 제품 code library 정의 (Text · Heading · frame) | 3       | 6                                  |
| 실행 가능 — 시험 fixture library 정의만 (Group · Slot)      | 2       | 3                                  |
| composite — template 이 새 binding 필요                     | 64      | 290                                |
| 직접 정의는 있으나 binding 없음                             | 42      | 119                                |
| typed 정의 없음                                             | 19      | 50                                 |
| 합계                                                        | 130     | 468                                |

- composite 64종은 기존 7 binding 만으로 실행되는 경우가 **0**이다. 두 가지가 겹친다. (1) composite 인스턴스 노드 자체가 `bindingId` 없이 resolve 된다 (64/64). (2) template root 가 그 type 의 RAC 컴포넌트 정의 (`type-Button` 등) 라 자기 binding 이 필요하다. template 의 누락 binding 수는 1개 15종 · 2개 16종 · 3개 10종 · 4개 이상 23종.
- state: typed `stateRules` 가 있는 등록 state 0/468. 실행 가능한 type 의 등록 state 9개도 typed state 규칙은 없다. state 를 별도 origin 변형 (`Button/Hover` 등) 으로 가진 type 14종 — 모두 root binding 누락으로 실행 불가.
- 누락 bindingId 106종 (composite 인스턴스 "binding 없음" 포함). 가장 많이 막는 것: composite 인스턴스 64 · `label` 23 · `button` · `description` · `selecticon` · `selecttrigger` · `icon` · `fielderror` 각 7.
- typed 정의 없음 19종: Code · ColorArea · ColorPicker · ColorSlider · ColorWheel · Field · FormField · IllustratedMessage · Kbd · MenuItem · MenuSection · Paragraph · Section · Skeleton · TableCell · TableRow · TailSwatch · Toast · body.

첫 공용 누락군 (제안, 이번에 구현하지 않음) — **텍스트 leaf 4종: Label · Description · FieldError · Paragraph**. 규칙 모양이 Text/Heading 과 같다 (단일 `default` variant · `colors.text` · `textWeight` · 모든 size 에 fontSize/lineHeight/borderRadius · 등록 accepts `children,size` · internal renderer = 소문자 type). 그래서 기존 `textDefinition` 파생과 Canvas `text` binding (Heading 이 이미 그대로 쓴다) 을 공유한다. 같은 모양인 DisclosureContent 는 RAC Disclosure 문맥이 필요한 panel 이라 제외했다. 다음 한 묶음의 수정 범위:

1. `codeCatalogLibrary.ts` — `CODE_CATALOG_SUPPORTED_TYPES` 에 4종 추가 (type 확장 — 다음 작업).
2. `canvasBinding.ts` — 4종을 `bindings.text` 에 연결.
3. `domBinding.tsx` — D1 요소: Label → RAC `Label`, Description → RAC `Text slot="description"`, Paragraph → `p`, FieldError → RAC `FieldError`. FieldError 는 field 문맥 밖이나 valid 일 때 DOM 이 아무것도 그리지 않아 Canvas 와 갈릴 수 있고, field 가족 안에서는 D3 read-only sub-part 규칙상 parent 가 소유한다 — 이 묶음에서 먼저 판정할 항목.
4. `compositionRoot.ts` — `contentTextBindings` 에 이미 있는 `label` (측정 content box 경로) 과 text leaf 경로 중 하나로 정리.
5. 검증: census 재실행 (실행 가능 5 → 9 기대) · 4종 Canvas–DOM 대표 사례.

이 묶음만으로 실행 가능해지는 composite 는 0이다. composite 는 인스턴스 binding (64종 공통 전제) 과 root type binding 이 따로 필요하다.

## 2026-09-29 소비자 오류 G2 원자성 — commit 경계를 소비자 뒤로

판정 구분: **주입한 실패 사례 PASS** (계산 실패 · JS 경계에서 던진 엔진 예외 · 구독자 예외, 아래 표) · **실제 WASM trap 뒤 복구 UNVERIFIED** (재현하지 않았고 엔진 교체 경로 없음). 이 절은 Phase 3 consumer 원자성 근거이며 G2·G3 등 gate 판정을 바꾸지 않는다.

정정: 아래 "소비자 오류 원자성 수리" 절의 `rollbackLast` 는 역 transaction 을 새로 commit 하는 보상이었다. 계산 실패 뒤 내용은 돌아와도 revision · pending (· graph history · 저장소) 이 늘어나므로 G2 실패 원자성 PASS 가 아니다. 그 절의 판정을 철회하고 이 절로 대체한다.

수리 (commit 경계 변경):

- `graph.ts`: `commit` 이 직전 record (없으면 null) · 새로 dirty 가 된 id · history 기록 여부 · 이전 metrics 를 한 칸 보관하고, `revertCommit(revision)` 이 records · 모든 index (edge · definitionOverride) · dirty · history 기록 · metrics · revision 을 정확히 되돌린다. 비용은 바뀐 entry 수 (전체 table 복사 없음). 가장 최근 commit 한 번, 다음 commit 전까지만.
- `controller.ts`: step 을 staged → consumer → 게시 순으로 바꿨다. transaction 이 graph 에 들어간 뒤 consumer (`CatalogStepConsumer`) 가 먼저 받는다. consumer 가 던지면 `revertCommit` 후 `CatalogStepAbortedError` (`revision` = 바뀌지 않은 revision, `cause` = 실패) — pending 저장 · undo/redo · cache 무효화 · runtime 구독자 호출은 한 번도 일어나지 않는다. 성공하면 pending · history · 무효화 · runtime 구독자 → consumer 의 알림 순서로 게시하고, 구독자 오류는 전부 호출한 뒤 `CatalogSubscriberError` (`revision` = 확정 revision, `result`, `errors`) 로 한 번에 알린다. `rollbackLast` · `CatalogConsumerError` 는 삭제했다.
- `compositionRoot.ts`: root 는 runtime step 의 consumer 다. (1) 계산 — resolver · `styleOf` (text 측정) · Slot chrome, root 상태 변경 전. (2) 적용 — map 과 layout tree 갱신을 journal (바뀌는 key 의 이전 값만, Set 값은 그 key 만 복사) 과 함께 하고 `computeLayout` 까지. 어느 단계든 던지면 journal 로 map 을 되돌리고, layout 을 건드렸으면 복원된 record 로 layout tree 를 다시 만든다 (`buildLayout` — 초기 조립과 같은 함수). (3) 알림 — runtime 이 게시한 뒤. `REVISION_GAP` 도 이제 step 을 중단시킨다 (graph 는 확정되지 않는다).

정상 편집 비용: 5k leaf 편집 counts 불변 (`resolverVisits 2` · 포함 검사 1 · `layoutInputVisits 1` · 통지 1/1 — `phase3PrunedResolveEquivalence` · `phase3BindingDelta` 통과). 추가 비용은 바뀐 record 수만큼의 journal 항목과 graph 의 바뀐 entry 이전 값 한 칸. `transactionEntryTableClones` 0, layout 재구축 0 (`buildTreeBatch` 호출 수 불변).

시험 `phase3ConsumerAtomicity.test.ts` (10) — 실패 전후 비교 대상: graph export 전체 · graph index 전체 · graph revision · graph history 수 · dirty · undo/redo · pending · root 입력 map 전체 · Slot chrome 입력 · root metrics · layout 엔진에 살아 있는 style 전체. 그리고 저장 → 새 runtime 으로 다시 열기:

| 사례                                                           | 결과                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dispatch 계산 실패 (text 측정, redo 1개 쌓인 상태)             | `CatalogStepAbortedError` revision 2 · 전후 전부 동일 (rev 2 · undo 0 / redo 1 · pending 2) · 통지 0 · 새 root 와 입력·엔진 style 동일 · 다시 열기 rev 2 · 원래 값 · 저장 entry = graph export. 이어서 redo 가 rev 3 으로 적용, 다시 열기 rev 3 |
| undo 계산 실패 · redo 계산 실패                                | 각각 revision 1 · 2 로 중단, 전후 전부 동일, 다시 열기 rev 2                                                                                                                                                                                    |
| layout 엔진 실패 — `updateStyleRaw` · `computeLayout` 각각 1회 | 중단 revision 1 · 전후 전부 동일 (엔진 style 포함) · 다시 열기 rev 1 · 이어진 leaf 편집은 `layoutInputVisits 1` · 재구축 없이 증분                                                                                                              |
| 구조 편집 (노드 추가) 실패 — 측정 · `computeLayout`            | 전후 전부 동일 (graph index 포함) · 추가 노드 없음 · 저장소에도 없음                                                                                                                                                                            |
| 엔진이 계속 실패 (재구축도 실패)                               | 여전히 중단 · graph · history · pending · root 입력 전후 동일 · `cause` = `AggregateError("CATALOG_LAYOUT_UNRECOVERABLE", [편집 실패, 재구축 실패])`                                                                                            |
| 정상 leaf 편집                                                 | table clone 0 · `buildTreeBatch` 불변 · `updateStyleRaw` 1 · `clear` 0                                                                                                                                                                          |
| root 구독자 throw                                              | `CatalogSubscriberError` revision 1 (= `result.revision`) · 확정 (rev 1 · undo 1 · pending 1 · 입력 새 값) · 다른 구독자 호출 (Canvas 2 · DOM 1) · 다시 열기 rev 1 새 값                                                                        |
| runtime 구독자 throw                                           | `CatalogSubscriberError` revision 1 · root 도 소비함 · history undo 1                                                                                                                                                                           |

실제 Rust 엔진 (`adr248CatalogConsumerAtomicity.browser.test.ts`, 2): 엔진 경계에서 실제 `computeLayout` 이 편집된 tree 를 계산한 **뒤** 던지게 주입. Text `a` · Group 안 `t1` 폭 80 → 200 편집이 중단되고 revision · history · pending · 모든 record 의 geometry 가 전과 같으며 새 root geometry 와 같다. 이어서 같은 편집이 `layoutInputVisits 1` 로 적용되고 geometry (폭 200) 가 새 root 와 같다.

원복 RED (백업 파일로 되돌림, git 미사용):

| 원복                                                  | 결과                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 이전 구현 전체 (보상 commit)                          | 7/7 RED (당시 7개 시험) — 중단 revision 없음 · 엔진 실패는 그대로 전파                           |
| graph `revertCommit` 호출 제거                        | dispatch · undo/redo · 엔진 2 · 구조 2 RED                                                       |
| root journal 복원 제거                                | 엔진 2 · 구조 `computeLayout` RED                                                                |
| layout 재구축 제거                                    | 엔진 2 · 구조 `computeLayout` RED, 브라우저 2/2 RED (geometry 가 실패한 편집의 폭 200 으로 남음) |
| 게시 (pending · history) 를 consumer 앞으로           | dispatch · undo/redo · 엔진 2 RED                                                                |
| 구독자 오류를 `CatalogSubscriberError` 대신 첫 오류로 | 구독자 2 RED                                                                                     |

회귀: node 스위트 55/55 직후 브라우저 adr248 (geometry · RealDom · 원자성) 11/11 을 3회 연속 통과, "엔진이 계속 실패" 사례를 더한 뒤 node 56/56 직후 브라우저 11/11 1회 더 통과. `248-phase3-geometry-delta.json` 해시 4회 모두 실행 전과 같다 (sha256 `615cacfeb280fbf5…`). shared catalog 607/607. `pnpm type-check` 통과, ESLint 통과. evidence JSON 두 개 (`native-state-new` · `structural-new`) 의 `newExecutionAssetsSha256.compositionRoot` 는 현재 소스 해시로 다시 쓰였고, 같은 소스로 재실행하면 두 파일이 바이트 단위로 같다. 변경 전 결과 필드와의 대조는 이전 사본이 없어 하지 않았다 (추적되지 않는 파일).

남은 사항:

- 실제 WASM trap (Rust panic) 은 재현하지 않았다. 주입은 JS 경계의 예외이고, 엔진 인스턴스가 trap 뒤 계속 쓸 수 있는지는 확인하지 않았다. 계속 실패하면 위 "엔진이 계속 실패" 사례대로 graph · 입력은 전과 같지만 layout tree 는 재구축 실패 상태로 남는다 — 새 엔진 인스턴스로 교체하는 경로는 없다.
- DOM binding render→구독 사이 편집 유실은 이 작업 전에 이미 수리됐다 (`domBinding.tsx` `useSyncExternalStore` · `phase3DomSubscribeRace.test.tsx`, 아래 절). 이번 작업은 그 코드를 건드리지 않았고, 미수리 차단 항목이 아니다.
- 구조 transaction 의 검증은 여전히 `graph.exportDocument()` 로 전체 entry 를 복사한다 (이번 변경 전부터, 정상 구조 편집 경로).

## 2026-09-29 소비자 오류 원자성 수리 (철회 — 위 절로 대체)

결함: `CatalogRuntime.dispatch` 가 graph 를 commit 한 뒤 root 가 입력을 계산·적용·통지를 한 번에 섞어 했다. 도중 예외 (계산 실패 · subscriber throw) 면 graph · pending 은 확정되고 root 는 일부 record 만 바뀐 채 metrics revision 이 뒤처졌다. runtime 자신의 구독자 (`subscribeEntryField` / `subscribeResolvedField`) 가 던지면 undo history 에도 들어가지 않고 root 는 아예 반영하지 않았다.

수리:

- `controller.ts`: `reduce` 가 구독자 값 계산·알림 오류를 모으고 (중단 없음) dispatch/undo/redo 의 history 정리를 끝낸 뒤 `CatalogConsumerError(result, errors, rolledBack: false)` 로 알린다. `rollbackLast(label)` — 마지막 step 을 보상 transaction (dispatch·redo 는 inverse, undo 는 forward) 으로 되돌리고 undo/redo 스택을 step 전 상태로 복원한다 (dispatch 가 비운 redo 도 복원). graph revision 은 앞으로 간다 (보상 commit 도 pending 저장 대상).
- `compositionRoot.ts`: 반영을 3단계로 나눴다. (1) plan — resolver · `styleOf` (text 측정 포함) · Slot chrome 을 root 상태를 바꾸기 전에 모두 계산. 실패하면 runtime `rollbackLast` 후 `CatalogConsumerError(rolledBack: true)`, root 입력은 손대지 않았고 복원된 내용과 같다 (metrics revision = 보상 commit revision). (2) apply — map · layout tree 갱신만 (소비자 코드 없음). (3) notify — 상태가 모두 맞춰진 뒤 구독자 호출, 던진 오류는 모아서 끝에 `rolledBack: false` 로 알린다 (다른 구독자는 계속 호출).

시험 `phase3ConsumerAtomicity.test.ts` (Label binding 의 text 측정 실패 = 실제 소비자 계산 경로):

| 사례                                    | 결과                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dispatch 계산 실패 (redo 1개 쌓인 상태) | rolledBack · graph rev 4 = root rev 4 (commit 3 + 보상 4) · history undo 0 / redo 1 (복원) · pending 4 · 내용 원래 값 · 통지 0 · 새 root 와 입력 동일 · 복원된 redo 가 이어서 적용됨 |
| undo 계산 실패                          | rolledBack · rev 3 = 3 · history undo 1 / redo 0 · 내용 편집 값 유지 · 새 root 와 동일                                                                                               |
| redo 계산 실패                          | rolledBack · rev 6 = 6 · history undo 0 / redo 1 · 새 root 와 동일                                                                                                                   |
| root 구독자 throw                       | 확정 유지 · rev 1 = 1 · history undo 1 · pending 1 · 입력 새 값 · 같은 노드의 다른 Canvas · DOM 구독자 호출됨 · 새 root 와 동일                                                      |
| runtime 구독자 throw                    | 확정 유지 · root 가 소비함 (rev 1 = 1 · 입력 새 값) · history undo 1 · 새 root 와 동일                                                                                               |

원복 RED: root 를 이전 버전으로 되돌리면 4/4 RED. runtime 이 구독자 오류를 `CatalogConsumerError` 대신 원래 오류로 던지면 runtime 구독자 사례 RED. 원복 후 GREEN.

회귀: node 스위트 (50/50) 직후 geometry · RealDom 브라우저 (9/9) 3회 연속 통과, geometry JSON 동일. shared catalog 607/607. evidence JSON 중 `native-state-new` · `structural-new` 는 `newExecutionAssetsSha256.compositionRoot` (소스 파일 지문) 만 바뀌었고 결과 필드는 같다 — 앞 절들에서 원인을 못 밝힌 해시 변화도 이 지문이었다.

남은 범위: apply 단계의 layout 엔진 (wasm) 호출이 던지면 root 가 부분 적용된 채 남는다 — 소비자 코드는 없지만 엔진 실패는 되돌리지 않는다. 보상 commit 은 revision 을 되감지 않으므로 저장소에는 실패한 commit 과 보상 commit 이 둘 다 기록된다 (내용은 원래 값으로 수렴).

## 2026-09-29 DOM binding render→구독 사이 편집 유실 수리

결함: `domBinding.tsx` 노드 컴포넌트가 render 때 record 를 읽고 `useEffect` 에서 `subscribeDom` 을 등록했다. 그 사이에 편집이 들어오면 받을 구독자가 없어 (root DOM 통지 0) DOM 이 이전 값을 영영 유지했다 — geometry 사례 1 이 node 스위트 직후 2/2 실패한 원인.

RED (`phase3DomSubscribeRace.test.tsx`, jsdom + act): 대상 노드가 render 에서 record 를 읽은 직후 (`onNodeRender`) 같은 render 안에서 dispatch — 구독 전 편집을 결정적으로 만든다. (1) Text 내용 편집 → DOM `before` 유지 (기대 `after`). (2) Slot 아래 Text 의 render 중 Slot `size` sm 편집 → Slot · Text 모두 `14px` 유지 (기대 `12px`). 두 경우 모두 편집 시점 root DOM 통지 0.

수리 (`domBinding.tsx` 만): 노드 구독을 `useSyncExternalStore` (subscribe = `root.subscribeDom(id)`, snapshot = `root.domInputs.get(id)`) 로 바꿨다 — React 가 구독을 등록할 때 snapshot 을 다시 읽어 render 이후 바뀐 record 를 다시 그린다. Slot 아래 Text 의 부모 Slot 구독도 같은 방식의 두 번째 store 로 유지 (조건은 종전과 같음: text/heading 이고 부모가 slot 일 때만). `memo` 로 노드별 국소 렌더 유지.

GREEN: (1) DOM `after` · 렌더 수 a 2 / 형제 b 1 / Frame 1. (2) Slot · Text `12px` · 렌더 Slot 2 / Text 2 / 형제 Text 1 / Frame 1 — 무관 노드 렌더 증가 0.

반복 검증: node 스위트 (46/46) 직후 geometry + RealDom 브라우저 (9/9) 를 5회 연속 — 5/5 통과, geometry JSON 5회 모두 이전 통과 기준과 동일 해시. 사례 1·2·4 DOM 폭 = Canvas 폭 (A 120/120 · t1 120/120), DOM 노드 렌더는 편집 노드 1개, DOM 통지 1. 단독 2회 통과. 5k binding delta (DOM 렌더 = 편집 노드만) 통과. scene-root 사례의 DOM t1 120 / Canvas 80 은 Canvas 가 `rebind-required` 를 돌려준 상태라 의도된 값이다.

남은 사항: geometry 시험의 `notifies.dom: 1` 단언은 root 통지 수라 구독 등록 시점에 따라 달라질 수 있다 — 이제 DOM 값은 그와 무관하게 맞지만, 경합이 다시 생기면 이 단언이 DOM 정합과 별개로 실패할 수 있다 (5회 재현 없음). 소비자 오류 원자성 차단 항목은 그대로다.

## 2026-09-29 replace 로 들어간 노드의 편집 실패 수리

원인: 선택 재해석의 조상 사슬 `allowed` 는 record 의 parent 를 따라 올라가 replacement 와 owner (template 자식 교체면 그 사이 template record 도) 만 담았다. resolver 는 교체 지점에서 **교체된 template id** 로 `include` 를 묻는다 (`resolveOwned` 의 template root · `projectTemplate` 의 template 자식) — 그 identity (`cardA::lib:template:cardRoot` / `cardA::lib:template:cardText`) 가 사슬에 없어 `projectTemplate` 의 replace 분기에 닿지 못하고 `RESOLVED_INSTANCE_MISSING` 을 던졌다. runtime 은 이미 commit 한 뒤였다.

수리 (`compositionRoot.ts` `updateExistingInstances`): 사슬의 각 node 의 `descendantOverrides` 중 replacement 가 사슬에 있는 replace override 에 한해 `${address.instances}::${address.templatePath.at(-1)}` 를 `allowed` 에 더한다. 전체 root 재해석 우회 없음 — 편집 instance 1개 (`layoutInputVisits 1`).

시험 `phase3ReplaceEdit.test.ts` (G1 card, template root 교체 · template 자식 교체 각각): 편집 → Undo → Redo 마다 graph revision = root revision (2 → 3 → 4), history (undo 2/redo 0 → 1/1 → 2/0), pending 저장 항목 (2 → 3 → 4), replacement 의 Canvas · DOM 입력 값, 통지는 replacement 만 (Canvas 1 · DOM 1), 모든 입력 record 가 같은 graph 를 새로 조립한 root 와 같다. 재해석 비용: template root 교체 resolver 방문 3 · 포함 검사 1 / template 자식 교체 방문 4 · 검사 4 (template 자식 루프는 전체 검사 유지). RED → GREEN: 수리 전 두 사례 모두 `RESOLVED_INSTANCE_MISSING`, 수리 부분을 끄면 다시 RED.

**남은 차단 1 — 소비자 오류의 원자성 (별도 항목)** (당시 기록 · 이후 "소비자 오류 G2 원자성" 절에서 주입 실패 사례 수리): probe — fillSlot 자식 편집에서 Canvas subscriber 가 던지면 dispatch 가 오류를 내지만 graph revision 2 · history undo 2 · pending 2 는 확정되고, root 는 metrics revision 1 에 머문다 (해당 record 는 이미 새 값, 나머지 통지와 layout 재계산은 건너뜀). `CatalogRuntime.dispatch` 가 commit 한 뒤 `consume` 이 실행되는 순서라 replace 경로를 고쳐도 일반 소비자 오류에서 "확정된 graph + 일부만 갱신된 root" 가 남는다. 이번 작업에서 확대하지 않았다.

**남은 차단 2 — DOM binding 구독 경합 (원인 확정)** (당시 기록 · 이후 "DOM binding render→구독 사이 편집 유실 수리" 절에서 수리): geometry 브라우저 사례 1 이 node 스위트 직후 실행에서 2/2 실패, 단독 실행 4/4 통과. 실패 run 의 기록: 사례 1 DOM 통지 0 · DOM 노드 렌더 0 · DOM 폭 80 (Canvas 120). `domBinding.tsx` 의 노드 컴포넌트는 render 때 record 를 읽고 `useEffect` 에서 `subscribeDom` 을 등록한다 — 부하로 passive effect 가 2 프레임 안에 돌지 않으면 그 사이 편집은 통지를 받을 구독자가 없어 DOM 에 영영 반영되지 않는다. 앞 절의 "미해명 1건" 도 같은 사례 1 실패다. 이번 범위 밖이라 코드는 손대지 않았다 (evidence JSON 은 통과 run 결과로 되돌림).

## 2026-09-29 가지치기 재해석의 형제 포함 검사 — 직접 소유 경로만 따라감

위치: `resolver.ts` `resolveOwned` 의 소유 자식 루프 (`for (const childId of node.children) … selection.include(childId, childPath)`) 가 대상까지 가는 조상마다 자식 전부에 `include` 를 호출했다 (5k leaf 편집 5,000회). resolve 방문 (`onVisit`) 은 2 였지만 검사 비용은 형제 수에 비례했다.

수정: `CatalogResolutionSelection.ownedChildren?(sourceId, instancePath)` — 소유 자식 루프만 이 부분집합을 돌고 (`undefined` = 종전 전체 검사), 돌려준 자식에도 `include` 를 그대로 호출한다. `CatalogCompositionRoot.updateExistingInstances` 는 조상 사슬을 만들 때 각 칸이 "소유 자식 모양" (`childPath = [...parentPath, childId]`) 인지 `ownedHop` 으로 판정해 부모 → 자식 하나를 기록한다. 부모 `descendantOverrides` 에 그 자식이 replace/fillSlot 으로 있으면 (template root replace 가 같은 모양이다) 종전 전체 검사를 쓴다. 모양이 다른 칸 (template root 로 이어지는 부모, 대상 자신) 은 소유 자식이 경로에 없으므로 빈 목록이다. template 자식 · fillSlot 자식 · replace 루프는 손대지 않았다.

시험 `phase3PrunedResolveEquivalence.test.ts` — 편집 뒤 모든 입력 record (props · visual · layout · sizing · slot 등 전 필드) 가 같은 graph 를 새로 전체 해석한 두 번째 root 와 같다:

| 사례                               | 형제 포함 검사 전 → 후            | resolver 방문 | 통지                                        |
| ---------------------------------- | --------------------------------- | ------------- | ------------------------------------------- |
| 5k 직접 소유 Text leaf             | 5,000 → **1**                     | 2 → 2         | Canvas 1 · DOM 1, 편집 노드만 (무관 형제 0) |
| Frame > Group > Text 중첩 소유     | 4 → **2** (소유 칸당 1)           | 3 → 3         | 편집 노드만                                 |
| G1 composite card 의 fillSlot 자식 | 5 → 5 (template · slot 경로 유지) | 4 → 4         | 편집 노드만                                 |

원복 RED: `ownedChildren` 가 항상 `undefined` 를 돌려주게 하면 5k · 중첩 사례 RED (검사 5,000 · 4), fillSlot 은 GREEN (경로 불변). 원복 후 GREEN. 기존 partRules 전파 · 5k binding delta (`resolverIncludeChecks: 1` 로 갱신) · geometry delta 브라우저 4건 회귀 GREEN, evidence JSON 변화 0, shared catalog 607/607.

**차단 발견 (기존 결함, 이번 변경과 무관)**: replace 로 들어간 노드의 값 편집 (`patchNodeProp`) 은 **수정 전후 모두** `RESOLVED_INSTANCE_MISSING` 으로 dispatch 가 던진다 (template root 교체 · template 자식 교체 둘 다 probe 로 확인). 조상 사슬 `allowed` 가 replacement record 와 owner 만 담고, 경로상의 template 노드 identity (`cardA::lib:template:cardRoot`) 를 담지 않아 `projectTemplate` 에 들어가지 못한다 — runtime 은 이미 commit 한 뒤라 root 입력이 graph 와 어긋난다. 이번 범위 밖이라 코드는 손대지 않았다.

남은 범위: template 자식 · fillSlot 자식 루프는 종전 전체 검사 (template 자식 수 · fill 자식 수에 비례). 편집 노드 자신의 자식 목록 비교 (`sameList`) 와 partRules 자식 판정은 편집 노드의 자식 수에 비례 — 형제 검사가 아니다.

## 2026-09-29 block 흐름 형제 geometry 조회 생략 — 증명 조건 한정

근거 (Rust layout 계약): `block.rs` `block_layout` 은 block-level 자식 (display 코드 0/2) 의 x · y · 폭 · 높이를 컨테이너 content 폭 (`available_width`) · 자기 필드 · 앞선 형제의 높이와 margin 누적 (`current_y` · `prev_margin_bottom`) 으로만 정한다. 형제의 **폭**은 다른 자식 계산에 들어가지 않는다. 예외는 atomic inline (코드 1) 의 line box (`current_x` 줄바꿈). `tree.rs` `solve_block` 의 후처리 — margin-auto 가로 분배 (자기 폭만) · `align-content` (높이 합) · shrink-to-fit `max_right` (컨테이너 폭에만 반영) — 도 형제 폭을 형제 상자에 넘기지 않는다. 그래서 다음을 모두 만족하면 형제 rect 는 바뀔 수 없다:

1. 부모 box model `display === "block"` (`solve_block` 경로)
2. 부모 rect 불변 — 먼저 비교한다 (shrink-to-fit 폭 변화는 여기서 잡혀 형제 전체 비교로 돌아간다)
3. 바뀐 자식이 in-flow block-level (`display` 가 `inline*` 아님, absolute placement 아님)
4. 바뀐 자식의 높이 불변 (catalog 노드는 margin 키가 없어 margin 은 항상 0)

`canvasBinding.ts` 의 `blockFlowSiblingsFixed` 가 이 네 조건을 판정하고, 하나라도 어긋나면 종전대로 형제 전부를 읽는다. type 별 예외 없음.

| 배치                                      | 수정 전 geometry 조회 | 수정 후                                  | Canvas 재등록 | command 교체 |
| ----------------------------------------- | --------------------- | ---------------------------------------- | ------------- | ------------ |
| 5k Text (block Frame 폭 1440) 폭 80→120   | 5,001                 | **2** (leaf · Frame)                     | 1             | 3            |
| (1) block Frame 안 Text A 폭 80→120       | 4                     | **2**                                    | 1             | 3            |
| (2) 가로 Group 안 t1 폭 80→120            | 4                     | 4 (flex — 형제 읽음, t2 · t3 +40)        | 3             | 13           |
| (4 신규) block Frame 안 Text A 높이 20→40 | —                     | 4 (높이 변화 — 형제 읽음, B · Group +20) | 3             | 24           |
| (3) auto 크기 Frame → scene root          | `rebind-required`     | 같음                                     | —             | —            |

정합: 5k (command · boundsMap · hitBoundsMap) 와 브라우저 사례 1 · 2 · 4 (command · bounds · hitBounds · 빈 index 에서 새로 만든 spatial index) 모두 새 전체 scene 과 같다. DOM 7노드 위치 = Canvas bounds, DOM 알림은 편집 노드 1개.

원복 RED 2건: (a) 부모 block 조건 제거 → 사례 2 RED (flex 형제 stale). (b) 높이 불변 조건 제거 → 사례 4 RED. 원복 후 GREEN. 기타 evidence JSON 변화 0.

미해명 1건 (→ replace 절에서 원인 확정: DOM 구독 경합): 조건 추가 직후 첫 브라우저 실행에서 사례 1 이 한 번 실패했고 실패 메시지를 남기지 못했다. 이후 단독 5회 · 두 파일 함께 3회 · RED 원복 뒤 재실행 모두 GREEN — 재현하지 못했다.

남은 미검증: (1) flex/grid 부모는 형제를 전부 읽는다 (O(형제 수)) — 이번 증명 범위 밖. (2) 크기 불변·baseline 변화로 baseline 정렬 조상이 움직이는 경우는 조상 상승 판정 (크기 변화 기준) 이 다루지 않는다 — 현재 7 type 의 nowrap 고정 높이 Text 에선 발생 조건 없음, 반증 사례 미작성. (3) resolver 형제 포함 검사 5,000회는 그대로.

## 2026-09-29 레이아웃 편집의 geometry 국소 반영 — Canvas binding

`canvasBinding.ts` `update()` 가 layout 입력 (`catalogBoxModel`) 이나 engine rect 가 바뀐 dirty 노드를 seed 로 영향 영역을 찾는다. rect 는 부모 기준 좌표라 **위치만 바뀐 상자의 자손은 불변**이고, 크기가 바뀐 상자만 자식을 비교한다 (`descend`). seed 의 크기가 바뀌면 조상 쪽으로 올라가며 형제와 부모 rect 를 엔진에서 읽어 bound rect 와 비교하고, 부모 크기가 그대로인 지점에서 멈춘다. 바뀐 rect 를 모두 담는 가장 낮은 노드가 patch root 이고, 그 subtree 만 기존 `buildSubtreeCommandStream` + `applyCommitSubtreeCommandPatch` 로 교체한다. 바뀐 노드는 새 rect 로 Skia data 를 다시 등록한다. 올라가다 scene root (입력 밖 부모) 에 닿거나 바뀐 노드에 Slot 이 있으면 `rebind-required` (`geometry-reaches-scene-root` / `slot-geometry`). 초기 bind 는 이제 spatial index · bounds snapshot 을 발행한다 — splice 가 upsert·발행하므로 두 경로가 한 scene 상태를 쓴다 (이전 절 미검증 (4) 해소).

시험 `tests/parity/adr248CatalogGeometryDelta.browser.test.ts` (실제 Rust wasm layout · 실제 spatial index · RAC DOM, Frame 600×300 block 안 Text A · B + horizontal Group[t1 t2 t3], 결과 `248-phase3-geometry-delta.json`):

| 사례                      | 초기 생성                        | 편집 뒤 달라진 rect       | layout 결과 조회                    | Canvas 재등록 | patch root · subtree 방문 · command 교체                  | root 통지 (Canvas / DOM) | DOM 노드 렌더                                   |
| ------------------------- | -------------------------------- | ------------------------- | ----------------------------------- | ------------- | --------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| (1) Text A 폭 80→120      | 등록 7 · command 24 · DOM 렌더 7 | A (폭만)                  | 4 (A · 형제 B · Group · 부모 Frame) | 1 (A)         | A · 1 · 3                                                 | 1 / 1                    | 1 (A)                                           |
| (2) Group 안 t1 폭 80→120 | 같음                             | t1 (폭) · t2 · t3 (x +40) | 4 (t1 · t2 · t3 · Group)            | 3 (t1 t2 t3)  | Group · 4 · 13                                            | 1 / 1                    | 1 (t1) — t2 · t3 는 브라우저 layout 으로만 이동 |
| (3) auto 크기 Frame 안 t1 | 같음                             | —                         | —                                   | —             | `rebind-required` · Frame · `geometry-reaches-scene-root` | 1 / 1                    | 1 (t1)                                          |

정합: 사례 1·2 모두 교체된 stream 의 command 전체 · boundsMap · hitBoundsMap · spatial index (scene 전체 query + 각 hit box 중심 hit-test) 가 **빈 index 에서 새로 만든 전체 build** 와 같다. DOM 은 7개 노드 모두 `getBoundingClientRect` 가 Canvas bounds 와 같다.

원복 RED 2건: (a) 형제 변화 시 patch root 를 부모로 올리지 않으면 사례 2 RED. (b) 초기 bind 의 spatial index 동기화를 끄면 사례 1·2 RED (index 가 patch 한 노드만 가짐). 첫 시도에서 (b) 가 GREEN 이었다 — 새 전체 build 가 같은 전역 index 를 공유해 비교가 독립적이지 않았다. 새 build 전에 index 를 비우고 index 크기를 단언하도록 고친 뒤 RED.

5k 시험 (`phase3BindingDelta.test.tsx`) 의 폭 편집은 이제 patch 된다 (container 폭 1440 고정): 재등록 1 · command 교체 3 이지만 **layout 결과 조회 5,001** (seed 1 + 형제 4,999 + 부모 1). 크기가 바뀐 노드의 형제는 layout 모델을 모른 채 전부 읽어 비교한다 — block 흐름에서 폭 변경은 형제를 움직이지 않지만 이 방식은 그것을 알지 못한다. 교체 결과는 새 전체 build 와 같다.

남은 미검증: (1) 형제 rect 비교가 O(형제 수) — 위 5,001 조회. (2) Slot 이 바뀐 영역 안에 있거나 scene root 까지 크기가 번지면 전체 재bind. (3) 엔진이 absolute 자식의 containing block 을 직계 부모로 고정하는 전제 (layout-engine 규칙 §position:absolute) 에 기대어 "위치만 바뀐 상자의 자손은 불변" 을 쓴다. (4) CanvasKit 실제 화면 픽셀은 재지 않았다 (command · bounds 정합만).

## 2026-09-29 부모 props 편집의 partRules 자식 전파

결함: 값 편집 경로 (`CatalogCompositionRoot.updateExistingInstances`) 가 편집된 source 의 instance 만 재해석해, 부모 prop 이 partRule `when` 조건을 바꿔도 대상 자식의 resolved 값 · Canvas/DOM 입력 · 통지가 갱신되지 않았다. 수정은 영향 범위 계산만: 재해석한 instance 의 이전/이후 props 에서 바뀐 key 를 구하고, 그 key 를 `when` 에 읽는 부모 definition 의 partRule 이 겨냥하는 직계 자식 (definitionId + child props 일치) instance 를 같은 가지치기 재해석 큐에 추가한다 (`partRuleChildren`). 전체 root 재해석 · 새 dependency/cache 구조 없음. 관찰용 카운트 `resolverIncludeChecks` 를 root metrics 에 추가.

시험 `phase3PartRulePropagation.test.ts` (Panel `tone` → Label[kind=title] color, 형제 Label[kind=hint] · Text · 다른 root Text 는 무관):

| 카운트                             | 수정 전 (RED) | 수정 후                                       |
| ---------------------------------- | ------------- | --------------------------------------------- |
| 재해석 instance (layout 입력 방문) | 1 (panel)     | 2 (panel · title)                             |
| resolver 방문                      | 1             | 3 (panel · panel→title)                       |
| 형제 포함 여부 검사                | 3             | 6                                             |
| Canvas / DOM 통지                  | 1 / 1         | 2 / 2 (panel · title)                         |
| title `visual.color`               | 없음 (결함)   | `#ff0000`                                     |
| hint · plain · other               | 통지 0        | 통지 0 · 입력 record 동일 객체 (재해석 안 함) |

조건 원복 (`tone` neutral) 은 title 의 color 를 다시 없애고 통지 1회 추가. 규칙이 읽지 않는 부모 prop (`label`) 편집은 부모 1개만 재해석 · 통지. 원복 RED: 큐 추가를 빈 목록으로 바꾸면 RED, 원복 후 GREEN.

5k Text leaf 시험 (`phase3BindingDelta.test.tsx`) 은 유지하고 `resolverIncludeChecks: 5000` 을 기록한다 — 입력 전체 순회는 없지만 가지치기 재해석이 조상의 형제 5,000개 전부에 포함 여부 검사를 한다. 이 성능 문제는 이번 작업 범위 밖이며 미검증 항목으로 남는다.

## 2026-09-29 제품 binding leaf 편집 delta 소비

`CatalogCompositionRoot` 는 leaf 편집을 ID 단위로 통지하지만, 두 제품 binding 은 그 통지를 구독하지 않았다. 편집을 반영하는 방법이 `bindCatalogCanvas` 재호출 (입력 전체 순회 + `buildRenderCommandStream` 전체) 과 `renderCatalogDom` 재호출 (전체 재귀) 뿐이었다. 최소 수정:

- `canvasBinding.ts`: 초기 bind 뒤 노드별 `subscribeCanvas` 로 dirty 표시, `update()` 가 그 노드만 Skia data 를 다시 등록하고 기존 `buildSubtreeCommandStream` + `applyCommitSubtreeCommandPatch` 로 subtree command 만 교체한다. 구조 · layout 입력 (`catalogBoxModel`) · geometry · binding id · Slot (chrome 과 자식 Text 글자 상속) 변경과 splice 거부는 `rebind-required` + 사유로 돌려준다 (조용한 stale 금지).
- `domBinding.tsx`: 노드마다 `subscribeDom` 을 구독하는 `memo` 컴포넌트. Slot 아래 Text 는 부모 Slot 도 구독한다. 구조 변경은 부모 자신의 `children` delta 로 key reconcile. `renderCatalogDom` 의 입력·binding 누락 즉시 오류는 유지.

시험 `catalogRuntime/__tests__/phase3BindingDelta.test.tsx` (실제 Rust wasm layout, Frame 1 + Text 5,000):

| 구간                         | 결정적 카운트                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 초기 생성                    | 입력 5,001 · Canvas 등록 5,001 · command 15,005 · DOM 노드 렌더 5,001                                                                                                                                            |
| Text `children` 편집 1건     | changedIds 1 · resolver 방문 2 (조상 1 + leaf) · layout 입력 1 · Canvas 통지 1 · DOM 통지 1 · 전체 입력 순회 false · Canvas 재등록 1 · subtree build 1 (방문 1) · command 교체 3 · DOM 노드 렌더 1 (편집 노드만) |
| 편집 후 정합                 | 교체된 stream 의 command 전체와 boundsMap 이 새 전체 build 와 같다 · 무관한 leaf DOM 텍스트 불변                                                                                                                 |
| layout 입력 편집 (폭 80→120) | `rebind-required` / `layout-input`                                                                                                                                                                               |

원복 RED 2건: DOM `subscribeDom` 제거 · Canvas `subscribeCanvas` 제거 → 둘 다 RED, 원복 후 GREEN. 기존 Group/Frame/Slot 결과 파일 변화 0.

남은 미검증: (1) resolver 가지치기는 조상의 자식 목록 전체에 `include` 술어를 돈다 (`resolver.ts` `for (const childId of node.children)` — 5,000 회 Set 조회, resolve 방문은 아님). (2) ~~layout 입력 · geometry 변경 편집은 전체 재bind~~ — geometry 절에서 국소 반영 (scene root 도달 · Slot 은 재bind 유지). (3) ~~부모 props 변경의 partRules 결과가 자식에 전파되지 않는다~~ — 위 절에서 수리. (4) ~~splice 와 초기 build 의 전역 bounds · spatial index 비대칭~~ — geometry 절에서 초기 bind 도 발행하도록 맞춤. (5) 실제 CanvasKit 화면 · 브라우저 React commit 시간은 재지 않았다 (카운트만).

## 2026-09-29 제품 경로 Canvas·DOM binding 계층 · typed 선언 확장 · Pencil 코드 제거

단계 계약 정정(breakdown §5)에 따라 Phase 3의 resolver·Canvas·DOM binding은 Phase 4에서 그대로 쓰는 제품 경로 코드다. 새 모듈은 여전히 제품 entry에서 import 0이고 test entry에서만 조립한다.

| 항목                     | 입력 → 실제 소비자 → 산출물                                                                                                                                                                                                                                                                                                                                                                                                                                 | 판정                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typed 선언 확장 (G1)     | `types.ts` VisualField `paddingX`·`paddingY`·`minWidth`, layout 5필드(`display`·`flexDirection`·`alignItems`·`justifyContent`·`flexWrap`), `conditionalRules`(prop 조건 + 상태), `partRules`(부모 definition → 직접 자식 definition, CSS 자식 선택자 delegation 대체) → `validation.ts`·`library.ts` 검사 → `resolver.ts` (template 저작 visual이 definition 규칙보다 우선하도록 순서 수리)                                                                 | [typedRules 테스트](../../../packages/shared/src/catalog/document/__tests__/typedRules.test.ts) 3건, shared 607/607                                         |
| 공용 box model           | [`boxModel.ts`](../../../apps/builder/src/builder/catalogRuntime/boxModel.ts) 하나가 resolved 노드의 display·flex·배치·크기·padding·border를 계산 → Rust 입력(`compositionRoot.styleOf`)과 DOM CSS(`domBinding`)가 같이 읽는다. 텍스트 metric(기본 16px, Slot 안 텍스트는 Slot의 fontSize/lineHeight)도 `catalogTextMetrics` 하나를 Canvas·DOM이 같이 쓴다                                                                                                  | 기존 결함 수리: Rust `NodeStyle`에 `padding` 축약 키가 없어 Slot 외 노드의 padding이 layout에서 조용히 빠지던 문제 → 방향별 키. heading을 block leaf로 정정 |
| Canvas binding           | 테스트 support의 binding을 [`catalogRuntime/canvasBinding.ts`](../../../apps/builder/src/builder/catalogRuntime/canvasBinding.ts)·[`slotOverlay.ts`](../../../apps/builder/src/builder/catalogRuntime/slotOverlay.ts)로 옮겼다(support 파일은 re-export 1줄). 지원 visual 키 집합은 DOM과 공유                                                                                                                                                              | Group·Frame pair Canvas PNG SHA 이전과 동일                                                                                                                 |
| DOM binding              | [`catalogRuntime/domBinding.tsx`](../../../apps/builder/src/builder/catalogRuntime/domBinding.tsx): frame/rectangle/box → `div`(ARIA 없음), group → shared RAC `Group`(role·label·disabled/invalid/readOnly·aria-label·aria-orientation), slot → shared `Slot`(edit/page), text → RAC `Text`, heading → RAC `Heading`. 미등록 binding·미지원 visual 키·색 없는 border는 명시 오류                                                                           | 테스트마다 손으로 만들던 DOM 7곳과 test 전용 `renderNode`를 제거하고 이 binding으로 교체                                                                    |
| 교체 후 결과             | Group pair: DOM PNG SHA·L3·기하 **동일**. Frame pair: DOM/Canvas PNG·hit·기하 **동일**. Slot 9행: DOM PNG 9장·픽셀 수 **동일**. filled 텍스트의 요소 상자만 typed 크기(120×20, Rust와 같음)로 기록됨 — 이전 손 DOM은 자식 sizing을 적용하지 않은 inline span이었다. 이 상자가 ADR-198 노드 영역 마스크가 되어 lg filled 분모 10,362→10,400, L3 0 유지. [paint bounds](248-phase3-slot-dom-paint-bounds.json)는 `VITE_ADR248_SLOT_DOM_WRITE=1` 모드로 재생성 | 수치 판정 변화 없음                                                                                                                                         |
| G0 고정 HTML 대조        | 4사례를 정확 문자열 대신 **의미 비교**로 바꿨다. 제외 속성은 [결과 JSON](248-phase3-native-dom-comparison.json) `excludedFromComparison`에 기록: 식별 속성, inline style(구 unit 출력엔 없음), Group `aria-orientation`(구 앱 미출력 = §6.1 기존 결함, 새 값은 resolved orientation과 일치 확인), RAC `Text` class(D1)                                                                                                                                      | PASS (정적 DOM 의미만)                                                                                                                                      |
| Frame hit 시험 입력 정정 | 손 DOM이 typed 입력에 없는 `2px solid #3851a4`를 스스로 그리고 있었다. fixture에 G0 Frame border 색을 넣어 입력과 소비를 일치시켰다                                                                                                                                                                                                                                                                                                                         | hit 3/3 유지                                                                                                                                                |
| Pencil 코드 제거         | 사용자 지시로 `exchange.ts` Pencil 절, `phase3PencilAudit.test.ts`, 유효 fixture 3개, phase2 Pencil 단언 삭제. G3 테스트의 Pencil 3장면은 [typed fixture](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/typedSceneFixtures.ts)로 교체 — 입력 수·기하·픽셀·regions가 이전 결과와 3/3 동일. G0 `.pen` 기록·구 앱 adapter 불변                                                                                                            | —                                                                                                                                                           |

검증: catalogRuntime 36/36(Pencil 9건 제거), 격리 RAC 브라우저 5/5, shared catalog 607/607, `pnpm type-check` PASS, 변경 파일 ESLint 0. 제품 entry·publish에서 새 runtime import 0. 원복 RED는 실행하지 않았다.

**다음 단일 차단 항목**: 제품 binding은 frame·rectangle·box·group·slot·text·heading 7종뿐이다. 나머지 등록 type은 typed definition이 accepts뿐이고 Canvas·DOM binding이 없어 `CATALOG_*_BINDING_REQUIRED`로 멈춘다. 규칙 테이블 값을 typed 선언으로 옮기는 분류·변환과, 그것을 읽는 제품 binding(type별 RAC 컴포넌트 선택 + 공용 paint·text·box 소비)을 같은 계약으로 만들어야 G3 사례별 판정이 가능하다. G3 FAIL, G4 부분검증(새 포맷 IDB·JSON·폴더 독립 경로), G5 byte 5/5 부분 외 UNVERIFIED — 전환 후 측정 항목은 Phase 4.

## 2026-09-29 Group L3 · composite template 정본 · Pencil 음성/유효 fixture

**판정: G3 FAIL, G4 부분검증, G5 UNVERIFIED 유지. Phase 4 미착수.** HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`. HC6 수치·`INITIAL_BUDGETS`·G0 정본·기존 마스크는 바꾸지 않았고 L3e 예산은 적용하지 않았다. 사용자 정책 결정 2건(2026-09-29)을 따랐다.

### Group horizontal/sm · vertical/lg L3

입력은 G0 공개 조작 `insertGroupWithChildren` 2건이다(Group fill `#edf7ec`·`2px solid #3851a4`, 자식 Text 2개 50×40 `#e04747`/`#53a853`). typed graph → `CatalogCompositionRoot` → 실제 Rust layout → test-entry binding → 공용 `renderCommands`/CanvasKit, 같은 resolved 값 → 기존 RAC `Group`(Chromium 격리 DOM)으로 소비했다. [테스트](../../../apps/builder/src/builder/catalogRuntime/__tests__/phase3GroupPair.test.tsx) · [결과](248-phase3-group-pair.json) · [Canvas PNG](248-phase3-group-pair-canvas.png) · [DOM PNG](248-phase3-group-pair-dom.png).

| 사례          | resolved        | geometry 최대 차 | L3 non-text (Group − 자식 텍스트 노드) | 참고: 마스크 없는 Group 상자 | L3e        |
| ------------- | --------------- | ---------------- | -------------------------------------- | ---------------------------- | ---------- |
| horizontal/sm | row · gap 6     | 0.00001 CSS px   | **0/9,262, maxByte 1 → PASS**          | 16/11,968, maxByte 77 (글자) | UNVERIFIED |
| vertical/lg   | column · gap 12 | 0.00001 CSS px   | **0/9,262, maxByte 1 → PASS**          | 17/11,968, maxByte 77 (글자) | UNVERIFIED |

부모 paint(fill·border)와 자식 배치(자식 fill 상자 위치)는 L3 영역과 L1 geometry로 함께 판정했다. DOM은 `role=group`, `aria-orientation`, computed `flex-direction`·`gap`·border·background가 resolved 값과 같다. 구 Canvas ↔ 새 Canvas crop은 2,886/15,000 · 1,193/15,000으로 §6.1 확인된 기존 결함(방향·gap) 기록을 유지한다.

### Composite template: 60 reusable origin → typed `lib:*` 정본

[변환 테스트](../../../apps/builder/src/builder/catalogRuntime/__tests__/phase3ReusableOriginTemplates.test.ts)가 Builder의 실제 seed(`ensureComponentsSystemPage` → `ensureReusableCompositeOrigins`, 즉 `catalogOrigins.ts` + template ensurer; 새 문서에서 빠지는 `Modal`은 `buildCatalogOrigin`)를 한 번 변환해 [생성 모듈](../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts)에 썼다. 이 모듈이 코드 catalog 정본이며 `buildCodeCatalogLibrary()`가 읽는다. 새 runtime은 canonical 노드를 읽지 않고, library는 프로젝트 문서에 복사하지 않는다(프로젝트 byte 0). 재생성은 `ADR248_WRITE_REUSABLE_ORIGINS=1`일 때만 한다.

| 항목                                              | 값                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 등록 reusable entry                               | 60 (모두 `lib:definition:origin-<reusableId>` composite)                            |
| 함께 변환한 origin (상태 변형·항목 template 포함) | 130                                                                                 |
| template 노드                                     | 316 (stable ID = `lib:template:<canonical id>`, 자식 순서 보존)                     |
| 사용 type의 accepts-only 정의                     | 108 (`lib:definition:type-<Type>`, componentCatalog accepts, visual 없음)           |
| canonical 필드                                    | 2,418 = 표현 1,695 + [계약 차이](248-phase3-reusable-origin-contract-gaps.json) 723 |

테스트는 (1) canonical 필드를 독립 walk로 세어 "표현 ⊔ 계약 차이"와 정확히 일치함을 확인하고(누락 0 — 처음 실행에서 ref 노드 style 28필드 누락을 이 게이트가 잡아 수리), (2) 생성 모듈이 재변환 결과와 같음을, (3) 모든 template의 자식 순서·props·visual을 canonical과 독립 대조하고, (4) 60개 정의의 인스턴스를 실제 resolver로 투영해 template 구조를 확인한다. 생성 모듈의 자식 순서 1건을 바꾸면 실패한다(원복 RED).

계약 차이 723필드의 사유:

| 사유                                                 | 필드 | 의미                                                                                                                                        |
| ---------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| INSTANCE_PROP_OVERRIDE_NEEDS_DESCENDANT_OVERRIDE     |  167 | template 안 ref 인스턴스의 props/style. typed 모델에서는 NodeEntry `descendantOverrides`로만 표현되고 `LibraryTemplateNode`에는 자리가 없다 |
| METADATA_NOT_IN_CONTRACT                             |  160 | origin `metadata`(family·variant·systemOwned 등)                                                                                            |
| STYLE_FIELD_OUTSIDE_TYPED_VISUAL                     |  137 | `display`·`flexDirection`·`alignItems`·grid·margin 등 layout style. `VisualField`에 없다                                                    |
| PROP_NOT_ACCEPTED_BY_TYPE_DEFINITION                 |   93 | componentCatalog accepts에 없는 prop 또는 등록 없는 type의 prop                                                                             |
| TEMPLATE_DESCENDANT_OVERRIDE_NOT_IN_LIBRARY_TEMPLATE |   88 | template 안 ref의 `descendants`                                                                                                             |
| SLOT_RECOMMENDATION_LIST_NOT_TYPED_SLOT              |   32 | canonical `slot`(추천 origin 목록) ≠ typed `slot {name, required}`                                                                          |
| TEMPLATE_NODE_NAME_NOT_IN_CONTRACT                   |   32 | template 자식 노드 `name`                                                                                                                   |
| PROP_VALUE_NOT_SCALAR                                |   13 | 배열·객체·null prop (`items` 등)                                                                                                            |
| VISUAL_VALUE_REJECTED_BY_TYPED_CONTRACT              |    1 | 실제 validator가 거부한 visual 값 (`lineHeight` 문자열)                                                                                     |

추가 사실: 구 seed는 hydration마다 collection item key에 **새 v4 UUID**를 발급한다(노드 ID는 안정). 해당 값 22경로는 모두 계약 차이 쪽에만 있고 정규화해 기록했으며, typed template·definition에는 UUID가 0이다. type 정의는 비-composite 정의의 binding 필수 계약에 따라 소문자 type을 `bindingId`로 선언한다. 소비자에 그 binding이 없으면 기존처럼 명시 오류다. **이 결과는 구조·props 계약의 정본화이며 60종 visual parity나 consumer binding PASS가 아니다.**

### Pencil: 음성 2 · 유효 descendants/imports

> **2026-09-29 제거**: 사용자 지시로 아래 시험의 새 Pencil import/export 코드(`exchange.ts` Pencil 절), `phase3PencilAudit.test.ts`, 유효 fixture 3개를 삭제했다. 외부 `.pen` 교환은 ADR-248 필수 범위가 아니다. 이 절은 수행 기록이며 G4 근거가 아니다. G0 `.pen` 표본·해시·구 앱 결과는 [baseline](248-baseline/pen-interchange.json)에 그대로 있다. G3 테스트가 Pencil import로 만들던 3개 장면은 typed catalog fixture(`support/typedSceneFixtures.ts`)로 바꿨다.

당시 `exchange.ts`에 reusable 자식(template subtree), `descendants`(text→patch `props.children`, fill→patch `visual.fill`, 전체 노드→`replace`), `imports`(`resolveImport(path)`로 외부 파일을 읽어 project definition `pencilImport_<alias>__<id>`)를 직접 매핑했다. 당시 audit 테스트 9/9 PASS.

| fixture                                          | 결과                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| G0 `sample-descendants.pen` (원본 SHA 동결 확인) | **음성 사례**: `PENCIL_DESCENDANT_TARGET_MISSING:icon,footer` 명시 오류                                     |
| G0 `sample-imports.pen` (원본 SHA 동결 확인)     | **음성 사례**: `PENCIL_IMPORT_UNRESOLVED:./kit.pen` 명시 오류                                               |
| 신규 `valid-descendants.pen`                     | 가져오기→내보내기 JSON 동일, 재가져오기 문서 동일, resolver 결과 label "Submit"·badge fill·footer 치환 확인 |
| 신규 `valid-imports.pen` + `valid-kit.pen`       | 같은 왕복·재가져오기 동일, resolver 결과 label "Remote"                                                     |

descendant text patch를 빼는 변이에서 2건이 실패한다(원복 RED). 계약 차이 2건을 보고한다. (a) descendants의 `children` 치환은 typed `fillSlot`이 `NodeEntry.slot` 대상을 요구하는데 단순 부분집합의 `slot` 목록은 regions로 매핑되므로 `UNSUPPORTED_PENCIL_DESCENDANT_CHILDREN`으로 명시 거부한다. (b) import alias → 파일 경로는 typed 문서에 저장되지 않아 export가 같은 imports map을 인자로 받는다(`PENCIL_EXPORT_IMPORT_PATH_REQUIRED`). 가져온 kit component는 project definition으로 복사된다.

**G4 문안 충돌:** G0는 [Pencil 5 fixture](248-baseline/pen-interchange.json)를 모두 `OLD_INTERCHANGE_ROUNDTRIP_PASS`(byte 왕복)로 동결했다. 새 정책은 그중 2개를 명시 오류 음성 사례로 둔다. 따라서 "G0 Pencil 5개 의미 왕복"을 G4 조건으로 읽으면 충족할 수 없다. G4를 PASS로 표시하지 않았고, 이 문안은 사용자 판정 대상이다. (2026-09-29 범위 정정으로 해소: 외부 `.pen` 교환은 G4 조건이 아니다.)

### 검증

catalogRuntime 스위트 9파일 45/45, shared catalog document·resolution·transactions 32/32, `pnpm type-check` PASS(baseline 0). 제품 barrel·소스에서 `codeCatalogLibrary`·생성 모듈 import 0. 기존 staged 삭제 132개와 다른 미커밋 변경은 보존했다.

### 다음 단일 차단 항목

G3의 "전체 등록 component state"다. 130 type 중 typed visual definition은 Text·Heading 2개(+fixture 4)뿐이고, 나머지 type은 accepts만 있다. 각 type의 `COMPONENT_RULES_TABLE` 축(variant·size·state·composition)을 typed `visual`/`propVisualRules`/`stateRules`로 파생하고, 그 값을 읽는 Canvas binding과 격리 RAC DOM binding을 만든 뒤 축별 L1/L2/L3를 판정해야 한다. named regions, collection/Table/date/color/chart도 같은 경로에 속한다.

이 항목은 먼저 typed visual 계약의 범위 결정이 필요하다. `COMPONENT_RULES_TABLE` 129 type의 말단 값 4,872개를 세면 마지막 키가 현재 `VisualField` 22개 이름과 같은 값은 1,594개다. 표현 자리가 없는 상위 키는 `borderRadius` 444(이름만 다름), `hover`/`pressed`/`base`/`text`/`border` 등 상태·역할별 색 묶음, `paddingX` 182·`paddingY` 112, `display` 106·`flexDirection`·`alignItems`·`justifyContent` 등 layout, `delegation` 33(자식 selector), `focusRing` 38, `cursor`·`pointerEvents`다. composite template 변환의 `STYLE_FIELD_OUTSIDE_TYPED_VISUAL` 137필드도 같은 layout 필드다. G0/G1에서 고정한 typed visual 필드 목록을 넓히지 않으면 126 type의 visual을 typed definition으로 옮길 수 없고, 넓히면 G1 validator·저장 형식·Pencil 교환에 영향이 간다. generic payload나 canonical alias로 메우지 않는다.

## 2026-09-28 G3 근거 불일치 정정 · Frame clip L3 판정 (최신)

**판정: G3 FAIL 유지, G4 부분검증, G5 UNVERIFIED, Phase 4 미착수.** HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`. HC6 수치, `INITIAL_BUDGETS`, G0 정본, 기존 마스크는 바꾸지 않았다. L3e 예산은 적용하지 않았다.

**coverage 정정.** [coverage](248-phase3-coverage.json)의 Slot 표기가 [ADR-198 L3 재판정](248-phase3-slot-pixel-diff.json)과 충돌했다. 원본 PNG 18장의 SHA-256이 측정 JSON의 `sceneSha256`/`racSha256`과 9/9 일치하고, 같은 PNG를 독립 pixelmatch 0.1로 다시 재도 차이 픽셀 수가 9/9 같다(sm·md 6건과 lg filled 0, lg empty 5/10,259, lg description 5/9,907). 정정한 항목은 다음뿐이다.

| 위치                                                                         | 이전                                                              | 정정                                                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `summary.slotCanvasDomPaintParity`                                           | 1× 픽셀 차이 9/9 FAIL                                             | L3 non-text 국소 PASS 9/9 (최대 ratio 0.000505), L3e UNVERIFIED, 원시 RGB는 진단값                    |
| `summary.slotHc6NontextPixelCasesFailed`                                     | 9                                                                 | 0 (`slotL3NontextPixelCasesPassed` 9, `slotRawRgbNontextCasesDiagnosticOnly` 9 추가)                  |
| `types.Slot.canvasPixels` · `missing` · `representative.isolatedDomSemantic` | 원시 RGB 9/9 FAIL, `PAIRED_PIXEL_PARITY`                          | L3 국소 PASS 9/9, 남은 결손은 `L3E_CORNER_BAND_BUDGET`                                                |
| `types.Group` 최상위 `geometry` · `canvasPixels` · `isolatedDomSemantic`     | Slot matrix 문자열(“4/9 높이 FAIL” 등)이 Group 항목에 잘못 기록됨 | Group 자신의 대표 근거(old/new 방향·gap 수치 FAIL, static markup 2/2)로 교체, Group 픽셀은 UNVERIFIED |

Slot `g3`(구 `null` 확인된 기존 결함, old/new FAIL 기록)와 summary의 g3 PASS 0 / FAIL 2 / UNVERIFIED 142는 그대로다.

**Frame clip L3.** [재현 스크립트](../../../apps/builder/scripts/adr248-frame-clip-l3-regions.mjs)가 [pair JSON](248-phase3-frame-clip-pair.json)의 PNG SHA를 확인한 뒤 ADR-198 `compareLegs` 규칙으로 잰다. region 소속은 노드 ID이고 상자는 floor/ceil이며, 차단은 ratio와 maxByte가 **동시에** 넘을 때다. 자식은 `lib:definition:text`(“1”)이므로 ADR-198에서 `text` kind(L4)에 속한다. L3 non-text region은 Frame 노드 상자에서 자식 텍스트 노드 상자를 `VisualParityRegion.mask`(유한 사각형)로 뺀 영역이다. 스크립트는 기존 180×110 crop의 8/19,800을 먼저 재현한다. [결과](248-phase3-frame-clip-l3-regions.json):

| 사례                         | L3 non-text (텍스트 노드 분리) | 참고: mask 없는 Frame 상자 (현 compareLegs 동작) | 참고: 텍스트 노드 상자 (L4) | L3e                               |
| ---------------------------- | ------------------------------ | ------------------------------------------------ | --------------------------- | --------------------------------- |
| `clip-true-overflow-visible` | **0/7,297, maxByte 1 → PASS**  | 8/8,320 = 0.000962, maxByte 77 → 비차단          | 7/2,673, maxByte 77         | UNVERIFIED (Frame 승인 예산 없음) |
| `clip-false-overflow-hidden` | **0/7,297, maxByte 1 → PASS**  | 8/8,320 = 0.000962, maxByte 77 → 비차단          | 7/2,673, maxByte 77         | UNVERIFIED                        |

남은 8픽셀은 모두 글자 “1”의 획이다(`x98/298–100/300, y54–61`). 이 픽셀은 텍스트 노드 상자 안에 있다. 따라서 두 사례의 L3는 PASS다. L4 텍스트 판정은 이번 범위 밖이며, 텍스트 노드 상자의 7픽셀은 참고값이다(pixelmatch의 AA 이웃이 crop 경계에 따라 달라져 8이 아니라 7). 구 Canvas↔새 Canvas FAIL(visible 342, hidden 404)은 확인된 구 Frame stroke 누락 기록으로 유지한다. [pair JSON](248-phase3-frame-clip-pair.json)의 `hc6L3Verdict: UNVERIFIED_TEXT_REGION_NOT_SEPARATED`는 crop 단일 수치를 낸 테스트 출력이며, L3 판정은 이 절의 region JSON이 대체한다.

**clip 경계.** 제품 entry에는 아직 연결되지 않은 새 `catalogRuntime/canvasBinding.ts`만 `clipBorderInset`을 명시한다. 이 필드가 없는 기존 Builder `buildBoxNodeData`/`buildSpecNodeData` 경로는 HEAD와 같은 전체 상자 clip·hit를 유지한다. paint와 hit 모두 기본 inset 0을 소비한다. 기존 `renderCommands`·`subtreeCommandPatch` 단위 테스트와 legacy 격리 테스트를 포함한 3파일 39/39가 PASS다. 테스트가 다시 쓴 pair PNG 2장과 legacy isolation JSON의 SHA는 각각 Canvas `852ccbf2…`, DOM `fca60d81…`, legacy JSON `ab311549…`이며, legacy 픽셀 PNG SHA는 JSON 내부의 `d4e75e8b…`다.

**다음 단일 차단 항목:** Group 방향·gap의 새 Canvas↔격리 DOM L3다. 새 소비자 사이 geometry는 일치하지만(`(58,2)`/`(2,54)`), 같은 PNG로 잰 L3 비교가 없어 coverage의 Group `canvasPixels`는 UNVERIFIED다. 구 수치 FAIL은 확인된 기존 결함 기록으로 유지한다.

> Frame clip hidden 1건·visible 1건의 [실행 identity 감사](248-phase3-frame-clip-identity-audit.json): HEAD/scenario/viewport/DPR/theme/seed는 일치한다. §6.1은 구 build/commit과 산출물을 고정하고 새 test entry에서 같은 포맷 독립 조작·환경을 독립 실행하도록 요구하므로 신·구 build index SHA 차이는 측정 차단 사유가 아니다. 구 실행의 CanvasKit·renderCommands byte hash 부재는 출처 한계로 남긴다. 원본 해시와 G0 정본은 유지한다. G3 FAIL 유지.

**Frame clip 두 사례 독립 실행(이번 범위):** [계측 JSON](248-phase3-frame-clip-pair.json) · [새 CanvasKit 전체 command scene](248-phase3-frame-clip-pair-canvas.png) · [격리 neutral Frame DOM](248-phase3-frame-clip-pair-dom.png). G0 native-state `insertFrameWithOverflowChild`의 visible·hidden 두 명령만 선택했고, HEAD `2a5c970…`, scenario hash `49666f05…`, 1440×900/DPR1, default-light, Pretendard SHA-256 `02b09ca6…`, seed 248을 확인했다. 구 G0 PNG/해시와 신·구 build index는 변경하지 않았다. 새 실행은 Rust layout→등록 catalog binding→공용 `renderCommands`/CanvasKit 전체 scene, 같은 resolved 값→격리 DOM을 사용하며 새 test entry·binding·renderCommands·Rust/CanvasKit WASM 자산 해시를 JSON에 기록했다. 구 실행의 모듈 byte hash 부재는 출처 한계이고 신·구 build 동일성은 요구하지 않는다.

| G0 명령                      | Frame/자식 geometry, clip·semantic/style                                                                                                                                                                     | 구 Canvas↔새 Canvas, 180×110 crop L3 진단                                                                       | 새 Canvas↔DOM, 같은 crop L3 진단                                              | 계약 판정                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `clip-true-overflow-visible` | Rust는 G0 `(30,30,130,100)`/`(92,32,100,40)`과 정확히 같고 DOM도 0.8 화면 변환 역산 시 일치. Canvas 바깥 빨강, DOM 자식 hit true; Frame role 없음, `overflow:visible`, fill `#dbe7ff`, border `2px #3851a4`. | pixelmatch 0.1: **342/19,800=0.017273**, maxByte 184. 구 stroke 누락의 old/new FAIL 보존.                       | **8/19,800=0.000404**, maxByte 77. 차이 bounds `x98–100,y54–61`은 글자 영역.  | 구조·clip·style PASS; L3 전체 판정은 텍스트 영역 분리 전 UNVERIFIED, L3e 예산 미승인 UNVERIFIED. |
| `clip-false-overflow-hidden` | 같은 Frame/자식 geometry 정확히 일치. Canvas 바깥 흰색, DOM 자식 hit false; role 없음, `overflow:hidden`, 같은 fill/border.                                                                                  | **404/19,800=0.020404**, maxByte 184. 구 stroke 누락과 새 clip border 정상화 차이를 기록하며 old/new FAIL 보존. | **8/19,800=0.000404**, maxByte 77. 차이 bounds `x298–300,y54–61`은 글자 영역. | 구조·clip·style PASS; L3 전체 판정은 텍스트 영역 분리 전 UNVERIFIED, L3e 예산 미승인 UNVERIFIED. |

새 hidden scene은 자식이 오른쪽 Frame border `x326–327`을 덮었다(수정 전 새 Canvas↔DOM 70/19,800, maxByte 168; `x327,y55` 빨강 대 CSS stroke). 첫 수정에서 공용 [renderCommands](../../../apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts)가 `clipChildren`+uniform stroke인 **기존 제품 box에도 자동 inset**을 적용하는 Phase 3 격리 위반을 만들었다. `buildBoxNodeData`의 실제 overflow hidden·2px border 사례로 도달함을 확인하고, [제품 경로 HEAD 출력 회귀](248-phase3-legacy-clip-isolation.json)를 먼저 실패시켰다. 이후 제품 entry에서 접근할 수 없는 [새 catalog Canvas binding](../../../apps/builder/src/builder/catalogRuntime/canvasBinding.ts)만 `clipBorderInset`을 명시하고 공용 command의 기본값을 HEAD와 같은 0으로 되돌렸다. 같은 opt-in 수치를 paint clip과 hit clip에 전달한다. 제품 사례는 HEAD source의 full-box clip `(0,0,100,80)`, 자식 hit `(90,30,10,20)`, 오른쪽 경계 픽셀 `[224,71,71,255]`를 재현했고 PNG SHA·HEAD module SHA를 고정했다. 새 Frame hidden 회귀는 그대로 PASS, 새 Canvas↔DOM 잔여 8픽셀은 두 사례 모두 글자 위치에만 남는다. 승인된 HC6 마스크·예산·G0 oracle은 그대로이며 G3 전체 FAIL/L3e UNVERIFIED를 유지한다. 제품 fixture 1/1·새 Frame 1/1·기존 clip-aware hit bounds 6/6 PASS.

## 2026-09-28 Badge 소수 폭 paint 경계 6사례

[국소 재현 스크립트](../../../apps/builder/scripts/adr248-badge-fractional-width.mts)와 [6사례·PNG SHA·computed rect/style·crop·폰트/테마/asset identity](248-phase3-adjacent-border/fractional-width/comparison.json)는 실제 catalog Badge accent/outline/sm의 동일 border/fill/radius를 사용했다. Chromium 151, viewport 1440×900, default-light, computed `sans-serif` 12px/16px/600(외부 font asset 없음)이다. DPR1의 자연 폭 54.6875px은 [이전 고정 DOM·Skia PNG](248-phase3-adjacent-border/capture.json)의 SHA까지 일치한다. 각 행의 layout/DOM/Skia 입력 폭은 같고, 진단 대조에서만 Skia **paint copy** 폭을 device pixel 최근접 또는 캡처 폭 올림으로 바꿨다. 마스크는 기존 DOM text rect·바깥 2 CSS px 우선 규칙이고, 좌/우 3 CSS px 경계는 예산이 아닌 위치 진단이다.

| DPR·CSS 폭  | PNG 격자 | 정확 폭 L3/분모, maxByte (좌/우 경계 차이) | 최근접 paint snap L3, maxByte (좌/우) | 캡처 폭 올림 L3, maxByte (좌/우) |
| ----------- | -------- | ------------------------------------------ | ------------------------------------- | -------------------------------- |
| 1 · 54.25   | 55×22    | 7/634, 66 (0/4)                            | 0, 33 (0/0)                           | 38, 212 (0/21)                   |
| 1 · 54.6875 | 55×22    | **10/618, 74 (0/8)**                       | 0, 2 (0/0)                            | 0, 2 (0/0)                       |
| 1 · 55.25   | 56×22    | 7/640, 66 (0/4)                            | 0, 2 (0/0)                            | 38, 212 (0/21)                   |
| 2 · 54.25   | 110×44   | 19/2504, 120 (0/16)                        | 55, 224 (0/36)                        | 55, 224 (0/36)                   |
| 2 · 54.6875 | 110×44   | 32/2504, 152 (0/23)                        | 72, 224 (0/53)                        | 0, 5 (0/0)                       |
| 2 · 55.25   | 112×44   | 19/2592, 120 (0/16)                        | 55, 224 (0/36)                        | 55, 224 (0/36)                   |

캡처 격자는 `ceil(CSS 폭)×DPR`이지만 **그 격자 폭으로 paint를 올리는 규칙은 다른 폭에서 악화**한다. 최근접 device-pixel snap도 DPR2 세 건에서 차이·maxByte를 모두 키운다. 좌측 경계의 perceptual diff는 0이고 오른쪽 곡선에서 발산하며, 원본 10픽셀의 alpha는 양쪽 모두 255다. 따라서 일반적인 입력/캡처 정렬 결함이나 일관된 공용 border snap 수리 규칙은 입증되지 않았다. 제품 코드·HC6/L3/L3e 예산·마스크·G0 정본은 변경하지 않았고 Badge L3 **FAIL**, L3e **UNVERIFIED**, G3 **FAIL** 및 Phase 4 중단을 유지한다.

## 2026-09-28 Badge outline/sm L3 실패 1건 경계 진단

[고정 capture](248-phase3-adjacent-border/capture.json)의 실제 catalog·DOM computed·공용 Skia `renderBox` 입력은 transparent fill, `#155dfc` 1px solid, radius `9999px`, CSS rect **54.6875×22px**로 일치한다. 캡처 PNG는 **55×22px**이며 양쪽 SHA-256를 [10픽셀 좌표·RGBA 색쌍](248-phase3-adjacent-border/l3-comparison.json)에 고정했다. pixelmatch 0.1의 비텍스트 차이는 **10/618**, maxByte **74**, 현 L3 국소 판정 **FAIL**이다. 10픽셀 중 `x=54,y=7…14`가 8개, `(49,1)`·`(49,20)`이 2개다. 모두 alpha 255의 곡선/오른쪽 경계이며 resolved stroke alpha는 1이므로 입력 alpha 불일치는 확인되지 않았다. 원시 RGB **117/618**은 진단값으로 유지한다.

[동일 PNG·마스크 경계 probe](../../../apps/builder/scripts/adr248-badge-boundary-probe.mts)의 [결과](248-phase3-adjacent-border/badge-boundary-probe.json)는 원본 Skia 렌더를 **byte 차이 0**으로 재현했다. radius `9999→11`(22px 높이의 CSS 외곽 clamp)은 차이 10/618·maxByte 74 그대로이며, 중심선 radius `10.5`는 15픽셀로 악화한다. x 이동 ±0.3125px도 양쪽 경계를 동시에 맞추지 못한다. **폭만 54.6875→55px**로 바꾼 진단 대조는 pixelmatch 0/618·maxByte 2가 되지만, 원래 Skia 입력 폭은 실제 DOM rect와 같다. 따라서 정수 PNG crop 자체나 입력 오정렬이 확정된 것은 아니고, 소수 폭의 CSS–Skia 오른쪽 곡선 **래스터 격자/AA 차이**가 확인된 범위다. 이 대조 폭을 제품 입력에 적용하지 않았다.

ADR-198식 직사각형 **3px edge split은 진단값**으로 edge 10/426·maxByte 74, 나머지 0/192·maxByte 73이다. 둥근 곡선 AA가 직사각형 band 안팎에 걸치므로 `INITIAL_BUDGETS.edge` 0.02/64를 Badge나 Slot에 자동 적용하지 않는다. Badge L3 FAIL, L3e 별도 승인 예산 부재 **UNVERIFIED**, 전체 G3 FAIL을 유지한다. 확정된 입력/캡처 결함이 없어 공용 renderer 제품 코드는 변경하지 않았다. Slot 9/9 국소 L3 비차단, 구 Frame/Slot 결함 및 G0 원본은 그대로다.

> 사용자 판정(2026-09-28): [breakdown §6.1](248-unified-catalog-document-breakdown.md)에 Group 방향·gap, 구 Frame stroke 누락, 구 Slot projection `null`을 확인된 기존 결함으로 기록했다. G0 원본 수치·PNG·old/new FAIL은 보존하며 새 Canvas–DOM geometry/style/semantic과 ADR-198 L3/L3e는 별도로 판정한다. G3 FAIL·Phase 4 미착수는 그대로다.

## 2026-09-28 ADR-198 L3 비교식 정정 (최신 국소 판정)

ADR-248은 ADR-198 시각 검증을 유지한다. 기존 Slot 분석의 **원시 RGB 비텍스트 ratio 0.024899–0.079750을 HC6 L3 차단 판정에 사용한 것은 오류**다. 아래의 동일 PNG 9쌍·텍스트/아이콘 마스크·비텍스트 분모에서 [수정한 비교 스크립트](../../../apps/builder/scripts/adr248-slot-pixel-diff.mjs)는 ADR-198 `compareLegs`와 같은 `pixelmatch` threshold 0.1, RGBA byte 지표(`maxByte`, `meanByte`, `changedFraction`), `maxDiffRatio`와 `maxByte` **동시 초과** 차단식을 사용한다. 원시 수치와 heatmap은 진단값으로 보존했다. 비텍스트 상한 0.001/2는 기존 `INITIAL_BUDGETS.nonText` 선언값이며 이 국소 실행만으로 전체 G3 예산 승인·제품 parity를 증명하지 않는다.

| 동일 Slot PNG (sm/md/lg)              |                        empty |                       filled |                 description |
| ------------------------------------- | ---------------------------: | ---------------------------: | --------------------------: |
| L3 pixelmatch 비텍스트 차이/기존 분모 | 0/4,740 · 0/7,426 · 5/10,259 | 0/4,000 · 0/7,200 · 0/10,362 | 0/4,680 · 0/7,782 · 5/9,907 |
| maxByte (각 size 순서)                |                 12 · 13 · 96 |                 13 · 13 · 11 |                12 · 12 · 95 |

따라서 **Slot 9/9는 선언된 L3 비텍스트 상한의 국소 차단식에서 비차단**이다(최대 ratio 0.000505). 이것은 Claude scratchpad 값을 인용한 판정이 아니라 [고정 원본·해시와 산출 JSON](248-phase3-slot-pixel-diff.json)으로 재실행한 결과다. 3px 모서리 L3e band의 **별도 ratio+maxByte 승인 예산은 확인되지 않아 UNVERIFIED**다. ADR-198 파일럿의 일반 `edge` 초기 상한과 3px edgeSplit 진단은 Slot L3e 승인 예산이 아니다.

[재현 가능한 대조 capture](248-phase3-adjacent-border/capture.json)는 [스크립트](../../../apps/builder/scripts/adr248-adjacent-border-capture.mts)로 실제 catalog InlineAlert(info/sm)·Badge(accent/outline/sm)와 강제 Slot 색 solid 160×40을 동일 DPR1/default-light에서 공용 `nodeRendererBorders.renderBox`와 실제 CSS computed 값으로 대조하고 양쪽 PNG·SHA를 고정했다. [동일 L3 비교 결과](248-phase3-adjacent-border/l3-comparison.json): InlineAlert 원시 64/5,072→pixelmatch **0/5,072**, maxByte 10, 국소 비차단; Badge 원시 117/618→**10/618**, maxByte 74, **FAIL**; 강제 solid 대조군 원시 54/6,400→**0/6,400**, maxByte 3, 국소 비차단. Badge의 작은 비텍스트 분모 때문에 10픽셀 ratio가 0.016181로 커진다. 앞선 강제 dashed 319/6,400 원시값은 같은 방식의 PNG 증거가 없어 L3 판정으로 승격하지 않았다. 대조군은 제품 전체 소비자 parity가 아니다.

**계약 상태:** G3 **FAIL** 유지. Group 방향·gap은 breakdown §6.1이 명시한 새 양쪽 소비자 수리 대상으로 다룬다. 사용자 판정으로 Frame stroke와 구 Slot `null`도 §6.1의 확인된 기존 결함에 추가했으며 old/new 수치·PNG FAIL은 면제하지 않는다. 구 G0 geometry·PNG 실패와 old/new 실행 identity 미검증은 그대로이며 G4 부분검증, G5 저장 byte 5/5 부분 PASS·전체 UNVERIFIED, Phase 4 미착수다. 아래의 종전 원시 RGB 표·“Slot pixel FAIL” 문장은 **이 정정 이전의 진단/판정 이력**이며 현재 L3 판정으로 읽지 않는다. HC6 수치·G0 oracle·gate·coverage는 변경하지 않았다.

> 최신 국소 판정은 위 ADR-198 L3 비교식 정정이다. Slot의 원시 RGB 차이는 진단값으로 유지하며, G3/G4/G5 전체 판정은 변경하지 않는다.

## 2026-09-28 Slot 1× 픽셀 원인 분해·국소 수리 (선행)

**Phase 3 미완료, G3 FAIL, G4 부분검증, G5 byte 5/5만 부분 PASS·전체 UNVERIFIED.** [재현 스크립트](../../../apps/builder/scripts/adr248-slot-pixel-diff.mjs)는 동일 scenario hash `15ed15da99b59e537f95e860f0cf97a2add58f1c218abc05e69299ec8937262b`, HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, 1440×900/DPR 1/default-light/seed 248에서 220×160 Canvas scene의 Slot `(10,10)`을 160×각 높이 RAC 원본 PNG와 정수 좌표로 비교한다. editor hatch는 scene에 없다. 브라우저 테스트가 매번 새 RAC 캡처와 [고정 DOM PNG](248-phase3-slot-matrix-dom/sm-empty.png)의 **RGBA 픽셀 동일성**을 검사하고, 동일 Pretendard 파일 SHA-256 `02b09ca630e4833028600a9f958b2f72f0289b9ccfd00d2df34780a7592f8d41`을 fetch/Canvas 양쪽에서 검사한다. [DOM 실측 경계·computed style](248-phase3-slot-dom-paint-bounds.json), [Canvas 실제 text DRAW와 layout 경계](248-phase3-slot-matrix-canvas.json), [색쌍·좌표·heatmap·마스크/분모 JSON](248-phase3-slot-pixel-diff.json)을 함께 고정했다. 이것은 test entry와 격리 RAC의 실행 조건이며 old/new 전체 production module/WASM identity 증명은 아니다.

텍스트 마스크는 Canvas에 등록된 text DRAW의 layout rect(placeholder name/required/description 및 filled child)와 RAC `getBoundingClientRect()`의 해당 글자 요소 rect를 Slot 상대 좌표에서 합집합으로 잡는다. 각 픽셀 중심 포함 기준이며 **바깥 2px 테두리와 Canvas/RAC 아이콘 경계 합집합은 마스크보다 우선**한다. 텍스트 rect 안의 빈 배경도 보수적으로 제외하므로 비텍스트 분모를 명시한다. RGB 3채널 중 하나라도 다른 원시 픽셀을 세며 이미지 리사이즈·색 보정·tolerance 변경은 없다. heatmap은 글자 주황·테두리 보라·아이콘 파랑·나머지 빨강이다.

글자 마스크 안의 차이는 겹친 rect를 `filled→required→description→name` 우선순위로 단일 분류했다. sm/md/lg 순으로 name **232/274/390**, Required **316/374/448**, description **529/634/901**, filled child **181/230/329**픽셀이다. 각 role의 색쌍·좌표는 차이 JSON의 `textRoles`에 있고, 테두리·아이콘 픽셀은 어느 글자 role에도 포함되지 않는다.

| size/state     | 전체 원시 차이/픽셀 | 텍스트 마스크 픽셀·마스크 안 차이 | 비텍스트 차이/분모 (ratio) | 테두리·아이콘·기타 차이 |
| -------------- | ------------------: | --------------------------------: | -------------------------: | ----------------------: |
| sm empty       |           759/6,720 |                         1,980·548 |       211/4,740 (0.044515) |                 206·1·4 |
| sm filled      |           500/6,400 |                         2,400·181 |       319/4,000 (0.079750) |                 315·0·4 |
| sm description |         1,337/8,640 |                       3,960·1,077 |       260/4,680 (0.055556) |                 255·1·4 |
| md empty       |         1,009/9,600 |                         2,174·648 |       361/7,426 (0.048613) |                 356·1·4 |
| md filled      |           590/9,600 |                         2,400·230 |       360/7,200 (0.050000) |                 356·0·4 |
| md description |        1,583/14,240 |                       6,458·1,282 |       301/7,782 (0.038679) |                 296·1·4 |
| lg empty       |        1,106/12,800 |                         2,541·838 |      268/10,259 (0.026123) |                255·1·12 |
| lg filled      |          587/12,800 |                         2,438·329 |      258/10,362 (0.024899) |                246·0·12 |
| lg description |        2,004/16,960 |                       7,053·1,739 |       265/9,907 (0.026749) |                253·1·11 |

**국소 수리:** 기존 [Slot binding](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/catalogCanvasBinding.ts)은 child Text가 명시 글자 크기를 갖지 않을 때 부모 resolved Slot의 12/14/16px·줄높이 18/21/24px를 일시 Canvas 투영에 상속한다. RAC computed weight 400과 Canvas text 기본 weight 400, font SHA는 일치한다. filled의 원시 차이는 sm 638→500, md 710→590, lg 633→587이고, glyph ink 위치/크기는 sm Canvas/RAC 모두 `(10,13,26,9)`, md `(14,17,31,11)`/`(14,18,31,10)`, lg `(18,23,35,12)`/`(18,22,35,12)`이다. md description의 24px SVG icon은 0.5px flex 중심을 Chromium의 DPR1 장치 격자처럼 일시 Canvas paint에 반올림해 아이콘 영역 차이를 132→1픽셀, 전체 차이를 1,714→1,583으로 줄였다. Rust icon layout과 graph 값은 바꾸지 않았고 다른 DPR의 icon raster 동등성은 검증하지 않았다. 9건 Rust–RAC 높이 9/9 정확 일치와 hatch/문서 chrome 분리도 재검증했다.

**잔여 원인:** resolved fill `#e5e5e5/0.5`, dashed 1px border `#e5e7eb`, radius 6/8px는 RAC computed 값과 같다. 배경의 평탄한 내부는 동일하며 `기타` 4~12픽셀은 둥근 모서리 근처다. [md description heatmap](248-phase3-slot-pixel-heatmap-md-description.png)처럼 대부분의 비텍스트 차이는 테두리의 CSS/SKIA 점선·곡선 안티앨리어싱에 남는다. 예: sm empty 상단 `(3,0)` Canvas `(242,243,244)`/RAC `(249,249,250)`; 테두리 206픽셀은 채널 최대 차이 1–2가 48, 3–15가 158이며 16 이상은 0. lg 둥근 모서리에는 16 이상 차이 7픽셀도 남는다. 기존 공용 Skia border renderer는 별도 제품 변경 경로라 이 증거만으로 수치나 마스크를 완화하거나 임의 dash 알고리즘을 교체하지 않았다. **비텍스트 ratio 9/9가 HC6 ≤0.001을 초과하므로 대표 Slot도 pixel FAIL**이다. 구 Slot `null`, Group 방향/gap, Frame stroke 및 구조 PNG의 old/new FAIL, 미승인 known-old-defect 예외, 전체 production identity UNVERIFIED는 그대로다. 130 type/1,333축/14 role 전체 PASS로 세지 않으며 Pencil 결손 2개 명시 오류, G5 paired p95/heap/bundle 미검증, Phase 4 미착수다.

검증: Phase 2+3 독립 Vitest **37/37**, G1 **30/30**, 격리 Chromium RAC **4/4**, 차이 분석 9/9 재현, scoped ESLint, `pnpm run codex:typecheck`·`codex:guard`, Builder build, 구 Builder WebKit 공개 Frame insert smoke(240×120, Canvas 1, error 0; `/private/tmp/adr248-phase3-slot-pixel-webkit-current.json`) PASS. [coverage](248-phase3-coverage.json)는 Slot 대표 9건의 실제 비텍스트 FAIL만 추가했다. 제품 import/dist marker 0과 공유 staged 삭제 132개를 검증하고 기존 dirty 변경을 보존했다. Preview/Compare 자동 실행, 앱 제품 경로·`apps/publish` 변경, Phase 4 착수 없음.

## 2026-09-28 Slot 편집 chrome 내용 기반 높이·실제 paint 보완 (이전)

**Phase 3 미완료, G3 FAIL, G4 부분검증, G5 문서 byte 5/5 부분 PASS·전체 UNVERIFIED.** HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, G0 frozen oracle 및 HC6 수치 불변. 이전 [Slot 9행](248-phase3-slot-matrix-dom.json)의 Rust 40/40·60·80 대 RAC 42/54·89·106 반례를 같은 scenario hash `15ed15da99b59e537f95e860f0cf97a2add58f1c218abc05e69299ec8937262b`로 재실행했다.

| 계약                  | 근거·실제 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 판정                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 내용 기반 Rust 높이   | [`slotChrome.ts`](../../../apps/builder/src/builder/catalogRuntime/slotChrome.ts)가 resolved size/padding/border/iconSize 24/iconGap 8/fontSize/lineHeight 1.5/이름·필수·설명·폭에서 **일시 edit-only** icon, name, description, info, placeholder layout 자식을 만든다. 이름·설명은 Pretendard 실제 글자 폭으로 줄을 나누고, 텍스트 leaf 높이와 flex wrapper를 [기존 Rust engine](../../../apps/builder/src/builder/catalogRuntime/compositionRoot.ts)에 전달한다. 크기 minHeight 40/60/80은 그대로이며 고정 height로 바꾸지 않았다. [Canvas matrix](248-phase3-slot-matrix-canvas.json)의 Rust 높이와 [RAC matrix](248-phase3-slot-matrix-dom.json)의 실제 높이는 sm **42/40/54**, md **60/60/89**, lg **80/80/106**으로 **9/9 정확히 일치**한다. `description` leaf patch에서는 layout input 방문 1, 무관 구독 0, Undo/Redo 42↔54; 파생 chrome ID는 graph entry가 아니다. | **대표 geometry PASS 9/9**. 전체 G3 PASS 아님                                               |
| Canvas 실제 icon/text | test-entry [등록 binding](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/catalogCanvasBinding.ts)은 같은 chrome 입력을 기존 `icon_path`·`text`·dashed border·alpha fill `renderCommands`/CanvasKit으로 그린다. empty/description 6건에서 icon 1, 이름 1, Required 1, 설명이 있으면 1 DRAW; [command·paint 위치와 영역별 검은 픽셀](248-phase3-slot-matrix-canvas.json) 모두 존재한다. 예: md description의 icon 208, 이름 101, Required 133, 설명 252 dark pixel; [overlay 없는 scene PNG](248-phase3-slot-matrix-md-description-scene.png)와 별도 hatch PNG를 분리했다. filled의 editor chrome/hatch 0·Text DRAW 1, page의 Slot DRAW 0·children만 보임을 확인했다.                                                                                                                                                                                      | placeholder paint 공백 **대표 범위에서 해소**. hatch를 chrome과 동일 출력으로 계산하지 않음 |
| 1× Canvas–RAC 픽셀    | [격리 RAC 테스트](../../../apps/builder/tests/parity/adr248CatalogRealDom.browser.test.ts)의 locator 캡처가 160 CSS px→128 PNG px였던 원인은 Vitest 호스트의 **iframe 부모 `transform:matrix(0.8,0,0,0.8,0,0)`**였다. 캡처 동안만 이를 해제하고 복원해 viewport 1440×900, DPR 1, clip 폭 160 CSS px→**160 실제 PNG px**를 얻었다. 원본 이미지를 리사이즈하지 않았다. overlay 없는 Canvas scene과 RAC PNG를 같은 160px 좌표에서 비교한 원시 RGB 차이는 sm **759/638/1337**, md **1009/710/1714**, lg **1106/633/2004** 픽셀 (empty/filled/description). [DOM PNG 9장](248-phase3-slot-matrix-dom/md-description.png), [수치](248-phase3-slot-matrix-dom.json). 글자 raster·색·border의 잔여 원인과 HC6 비텍스트 분리는 미종결이다.                                                                                                                                            | **실제 픽셀 차이 9/9 FAIL**. ≤0.001 주장 없음                                               |
| old/new·범위          | 구 Slot `null` projection, Group 방향/gap, Frame stroke 및 구조 scene **11,191/248,000**픽셀 차이는 별도 old defect/HC6 FAIL로 유지한다. old/new 동일 production module/font/WASM 전체 실행 identity도 UNVERIFIED다. [coverage](248-phase3-coverage.json)는 이 Slot 대표 9건만 갱신하며 130 type/1,333축/14 role 전체 PASS로 세지 않는다. Pencil 결손 2개는 명시 오류. Frame role 없는 block·Group 기존 RAC/Rust 경로 유지, 제품 entry/barrel/store/history/panels/old mutation/import graph와 `incrementalDocuments.ts`, `apps/publish` 수정 0.                                                                                                                                                                                                                                                                                                                             | G3 FAIL, G4 부분검증, G5 전체 UNVERIFIED. Phase 4 미착수                                    |

검증: Phase 2+3 독립 Vitest **37/37**, G1 **30/30**, 격리 Chromium RAC **4/4**, scoped ESLint·Prettier, `pnpm run codex:typecheck`, `pnpm run codex:guard`, Builder build, `git diff --check` PASS. 기존 Builder `localhost:5173`에서 구 앱 WebKit 공개 Frame insert smoke는 240×120 geometry·Canvas 1·error 0 (`/private/tmp/adr248-phase3-slot-chrome-webkit-current.json`). 제품 소스→새 catalog runtime/graph import 검색 0, 생성 `dist`의 새 root/transaction marker 0; 공유 staged 삭제 132개 보존. Preview/Compare 자동 harness와 threshold·known-old-defect 예외 변경은 하지 않았다.

## 2026-09-28 Slot typed 소비 계약 재검증 (이전 상태)

**Phase 3 미완료, G3 FAIL, G4 부분검증, G5 문서 byte 5/5 부분 PASS·전체 UNVERIFIED.** HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`; staged 삭제 132개와 다른 dirty 변경을 보존했다. 아래 이전 19-command/2,829-pixel 수치는 Slot 시각 입력을 추가하기 전의 이력이다. G0 frozen oracle, HC6 수치, old Slot null·Group 방향·Frame stroke 결함은 그대로 유지한다.

| 계약                            | 실행 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 판정                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| typed Slot definition·validator | [`Slot.spec.ts`](../../../packages/specs/src/components/Slot.spec.ts)의 sm/md/lg **minHeight** 40/60/80, padding 8/12/16, gap 4/8/12, font 12/14/16, radius 6/6/8, background alpha 0.5·dashed border width 1을 read-only [`createPencilFixtureLibrary`](../../../packages/shared/src/catalog/document/pencilFixtureLibrary.ts)와 typed visual 필드에 선언했다. `size`는 `sm/md/lg`만 허용하고 `xl` transaction은 revision을 바꾸지 않고 거부한다. `minHeight`를 고정 height로 변환하지 않는다. fill/border의 구 token을 test library의 **default-light 고정 색**으로 넣었으므로 다른 theme의 token 동등성은 UNVERIFIED다.                                                                                                                     | default-light typed 입력·거부 PASS, theme 축 UNVERIFIED |
| Rust·CanvasKit·RAC 입력         | 동일 resolved Slot 값이 [`compositionRoot.styleOf`](../../../apps/builder/src/builder/catalogRuntime/compositionRoot.ts)의 기존 Rust layout, test-entry [등록 binding](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/catalogCanvasBinding.ts)의 기존 `renderCommands`/CanvasKit, [격리 RAC 소비](../../../apps/builder/tests/parity/adr248CatalogRealDom.browser.test.ts)의 기존 `Slot`에 들어간다. [Canvas matrix](248-phase3-slot-matrix-canvas.json)와 [DOM matrix](248-phase3-slot-matrix-dom.json)는 같은 scenario hash `15ed15da…`, HEAD, 1440×900, DPR 1, Pretendard, default-light, seed 248의 empty/filled/description × sm/md/lg **9건**이다. test-entry Canvas PNG 9장과 RAC screenshot 9장을 별도로 보관했다. | 실제 소비자 경로 대표 9건 실행. 전체 G3 PASS 아님       |
| editor overlay·filled/page      | [일시 context 경계](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/catalogSlotOverlay.ts)는 resolved Slot ID·Rust bounds·편집 role·visible bounds로 기존 `buildSlotMarkerTargets`를 호출하고 기존 `renderSlotHatchPattern`을 그린다. 저장 entry를 추가하지 않으며 old spec fallback을 호출하지 않는다. [보충 측정](248-phase3-slot-paint-contract.json)의 hatch **증분** 1,674픽셀, filled Text **증분** 248픽셀이다. filled와 page mode에서 hatch target 0; page mode는 Slot 자체 DRAW 0·children만 표시한다. 이 픽셀은 DOM placeholder와 동형이라고 계산하지 않는다.                                                                                                                                                     | editor target/filled/page 부분 PASS                     |
| geometry·paint·semantic         | Rust minHeight는 40/60/80. RAC 실제 높이는 sm 42/40/54, md 60/60/89, lg 80/80/106 (각 empty/filled/description 순서)라 **5/9만 ≤1px**, 4/9 FAIL. sm empty는 padding+border+icon 행이 42px이고 description의 내용 높이는 Rust에 반영되지 않는다. RAC의 icon/name/required/description과 filled/page semantic은 관측했으나 Canvas에는 placeholder icon/name/required/description text/icon command가 **0**이라 G3 paint FAIL이다. screenshot 도구가 CSS 160px을 PNG 128px로 저장해 동일 픽셀 격자 비교는 UNVERIFIED이며 ≤0.001을 주장하지 않는다.                                                                                                                                                                                                | geometry·Canvas chrome FAIL, paired pixel UNVERIFIED    |
| old/new 구조 scene              | 새 Slot box paint를 실제 command에 추가한 [20-command stream](248-phase3-structural-catalog-commands.json) 및 [PNG](248-phase3-structural-render-commands.png)는 frozen old PNG와 **11,191/248,000픽셀** 다르다. [분해](248-phase3-structural-new.json): page edge 402, Text 203, Frame edge 1,879, 나머지 8,707에 Slot box/old null 결함이 포함된다. 이 수치는 이전 2,829픽셀 비교와 paint 입력이 다르므로 같은 결과로 합치지 않는다. old/new 실행 module/font/WASM 전체 identity는 여전히 UNVERIFIED다.                                                                                                                                                                                                                                      | HC6 FAIL, 자동 예외·threshold 변경 없음                 |
| 범위·보존                       | [coverage](248-phase3-coverage.json)는 Slot 9건 대표 검증만 추가하고 130 type/1,333축/14 role 전체 PASS로 세지 않는다. Frame은 role 없는 block, Group은 기존 RAC Group·Rust row/column/gap 및 명시 paint 없을 때 자체 DRAW 0을 유지했다. Pencil 결손 2개는 명시 오류. 제품 entry/barrel/store/history/panels/old mutation/import graph, `incrementalDocuments.ts`, `apps/publish` 수정 0. Preview/Compare 자동 harness 및 Phase 4 미착수.                                                                                                                                                                                                                                                                                                      | G3 FAIL, G4 부분검증, G5 전체 UNVERIFIED                |

검증: Phase 2+3 Vitest **37/37**, G1 회귀 **30/30**, 격리 Chromium RAC **4/4**, scoped ESLint·Prettier, `pnpm run codex:typecheck`, `pnpm run codex:guard`, Builder build, `git diff --check` PASS. 실행 중 Builder `localhost:5173`에서 구 앱 WebKit 공개 Frame insert smoke는 240×120 geometry·Canvas 1·error 0으로 PASS (`/private/tmp/adr248-phase3-slot-webkit-current.json`). 제품 소스에서 새 `catalogRuntime`/catalog graph import 검색 0, 생성 `dist`의 `CatalogCompositionRoot`/새 transaction marker 검색 0. staged 삭제 132개 유지. 이 결과는 새 catalog 제품 연결 또는 G3/G4/G5 통과 근거가 아니다.

## 2026-09-28 Frame·Group 컨테이너 및 Slot 표시 계약 재검증 (이전 상태)

**Phase 3 미완료, G3 FAIL, G4 부분검증, G5 UNVERIFIED.** 아래의 이전 21-command·Slot box-only 설명은 이 절의 재실행 결과로 대체한다. G0 frozen oracle, HC6 수치, ADR 문구와 Phase 4 경계는 변경하지 않았다. HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, 별도 staged 삭제 132개를 보존했다.

| 계약               | 현재 source와 실행 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 판정                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frame              | [`compositionRoot.styleOf`](../../../apps/builder/src/builder/catalogRuntime/compositionRoot.ts)는 Frame을 `display:block`으로 Rust에 전달한다. test-entry [catalog binding](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/catalogCanvasBinding.ts)은 명시 fill/border가 있으면 기존 Skia box DRAW, 없으면 기존 container 경로를 쓴다. `overflow:hidden`은 `clipChildren`으로 기존 renderCommands clip 경로에 들어간다. [격리 RAC 브라우저 테스트](../../../apps/builder/tests/parity/adr248CatalogRealDom.browser.test.ts)는 Frame div에 RAC group role을 붙이지 않고 native 3건의 clip hit를 확인한다.                                                                                                                                                                   | 대표 geometry/clip·역할 PASS, old Frame stroke와 전체 PNG parity FAIL. Frame에 별도 RAC Group을 만들지 않았다.                                                                                                                                                                                                                                                                                                                                   |
| Group              | 같은 resolved `orientation`·size gap이 Rust의 row/column·`rowGap/columnGap`과 기존 [`Group`](../../../packages/shared/src/components/Group.tsx)의 RAC `role`/label/disabled 입력 및 격리 DOM flex style에 전달된다. 기본 `Group.css`의 block만으로 방향을 표현할 수 없어 test entry가 동일 resolved 값으로 style을 준다. 명시 fill/border가 없는 Group은 Skia `container`로 ELEMENT_BEGIN/자식/clip만 유지하고 자체 DRAW는 0이다. 보충 브라우저 조작에서 `role=region`, label, disabled opacity `0.38`을 확인했다.                                                                                                                                                                                                                                                                              | 새 Rust/Canvas/RAC 대표 방향·gap·ARIA 부분 PASS. 구 horizontal `(2,42)` 대 새 `(58,2)` 및 vertical `(2,42)` 대 새 `(2,54)`의 HC6 numeric FAIL은 유지한다. 제품 `LayoutRenderers.renderGroup` 수정은 Phase 4 경계다.                                                                                                                                                                                                                              |
| Slot               | Slot은 `display:block` 컨테이너이고, 빈 상태의 scene 자체 DRAW는 0이다. 구 제품은 [`buildSlotMarkerTargets`](../../../apps/builder/src/builder/workspace/canvas/skia/skiaOverlayHelpers.ts)로 빈 slot을 골라 [`renderSlotHatchPattern`](../../../apps/builder/src/builder/workspace/canvas/skia/slotMarkerRenderer.ts)을 별도 편집 overlay에서 실행한다. 동일 G0 Slot geometry에 기존 painter를 실행한 [보충 출력](248-phase3-slot-paint-contract.json)은 marker 2,502픽셀을 그렸다. typed graph에서 Slot에 Text를 넣은 뒤 기존 command stream의 Text DRAW 1개·248픽셀을 확인하고 marker 호출은 0으로 유지했다. [빈 PNG](248-phase3-slot-empty-marker.png), [채운 PNG](248-phase3-slot-filled-content.png). 격리 기존 RAC Slot은 name·description·required와 empty/filled/page 전환을 확인했다. | **부분 실행 / Canvas·DOM 표시 동형 FAIL.** 현재 typed Slot definition에는 size→minHeight/padding 및 dashed stroke/fill alpha, 편집 marker role의 입력이 없다. 구 Canvas는 DOM icon/name/description chrome을 그리지 않는 기존 비대칭도 있다. 기존 overlay의 입력은 `CanvasSceneNode`/편집 role·bounds·occlusion이며 catalog typed 경계가 없다. 이 seam을 구 canonical 영구 adapter로 채우지 않았다. 구 Slot `null`은 별도 old defect로 유지한다. |
| 전체 command·pixel | 동일 `adr248-structural-baseline-v1`에서 Frame/Group/Slot의 불필요한 자체 DRAW를 제거한 실제 [command stream](248-phase3-structural-catalog-commands.json)은 **19개**다. Text DRAW 1개, page shell/선택 overlay는 별도 기존 painter다. [새 PNG](248-phase3-structural-render-commands.png)는 여전히 old frozen PNG와 **2,829/248,000픽셀** 다르다. 좌표 구역 page edge 402, Text 203, Frame edge 1,879, 기타 345는 별도 [측정 JSON](248-phase3-structural-new.json)에 고정했다. 구 Frame Skia box에는 stroke가 없지만 새 typed border 2px은 실제 command로 그려진다.                                                                                                                                                                                                                            | G3 pixel FAIL. 구 stroke 누락·Slot projection null·Group 방향 결함을 새 기능을 숨겨 맞추지 않았다. Text 203·overlay page edge 402·기타 345의 최종 원인은 미확정이다.                                                                                                                                                                                                                                                                             |
| 실행 identity      | 현재 제품 public CanvasKit WASM `25ebed8e…`, Pretendard `02b09ca…`, Rust WASM `a38b3533…`는 새 test 출력의 파일 hash와 일치한다. 그러나 [old trace](248-phase3-slot-old-trace.json)는 과거 dev `/src/main.tsx` 한 모듈의 hash만 기록했고 그 실행 당시 font/WASM/전체 모듈을 보존하지 않았다. 현재 제품 dist index hash도 old trace 시점과 다르다.                                                                                                                                                                                                                                                                                                                                                                                                                                               | 현재 파일 byte 일치만 확인. **old/new 동일 production 실행 identity UNVERIFIED**; Text/overlay 차이를 asset 원인으로 확정하지 않는다.                                                                                                                                                                                                                                                                                                            |
| coverage·다른 gate | [manifest](248-phase3-coverage.json)는 130 type/1,333축/14 role의 미실행 항목을 유지하고 대표 Frame/Group/Slot만 부분 근거를 갱신했다. Pencil 유효 3개 의미 왕복과 결손 2개 명시 오류는 유지한다. [문서 byte 5/5](248-phase3-document-byte-budget.json)는 독립 부분 gate다.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | G3 PASS 0, FAIL 2, UNVERIFIED 142. G4 부분검증, G5 paired p95/heap/bundle 전 **UNVERIFIED**.                                                                                                                                                                                                                                                                                                                                                     |

검증: 독립 Phase 2+3 Vitest **36/36**, 격리 Chromium RAC 브라우저 **3/3**, `pnpm run codex:typecheck` PASS. 아래의 구 수치·정책 충돌 표는 자동 면제나 threshold 변경 없이 그대로 적용한다. Preview/Compare 자동 harness와 제품 entry/old 경로/`apps/publish`는 건드리지 않았다.

## 2026-09-28 catalog binding·픽셀 원인·문서 byte 이전 판정

**Phase 3 미완료, G3 FAIL, G4 부분검증, G5 UNVERIFIED, Phase 4 진입 불가.** 아래 절의 수작업 scene 투영 설명은 이 절의 test-entry binding 구현으로 대체한다. G0 PNG·fixture, HC6 수치와 ADR 문구는 변경하지 않았다. HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`; 공유 staged 삭제 132개와 `.gitignore` 변경은 보존했다.

| 계약                                  | 실행 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 판정                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typed resolver→등록 binding→CanvasKit | [`CatalogCompositionRoot`](../../../apps/builder/src/builder/catalogRuntime/compositionRoot.ts)의 resolved 입력에 대해 read-only library `definition.bindingId`를 조회하고, [test-entry 전용 binding](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/catalogCanvasBinding.ts)으로 Frame/Group/Slot/Text의 `SkiaNodeData`를 등록했다. 실제 `buildRenderCommandStream` 전체 21개를 [동결 출력](248-phase3-structural-catalog-commands.json)에 기록하고 `executeRenderCommands`로 [PNG](248-phase3-structural-render-commands.png)를 만들었다. [결과 JSON](248-phase3-structural-new.json)에 binding ID 4개·command hash·geometry·pixel pair·실행 asset hash가 있다. 기존 command API의 `CanvasSceneNode` 타입 경계만 test 내부에서 사용하며 `sourceNode`/구 canonical 문서 값은 만들거나 읽지 않는다. 미지원 binding/색/시각 key는 명시 오류다. | **대표 4종 test-entry binding 실행. 제품 binding 0, 130종 전체 parity 아님.** Slot은 현재 box command만 있으며 placeholder icon/name/description/filled 내용의 Canvas paint가 없음을 `unpainted`로 기록했다. RAC의 empty/filled/description은 격리 브라우저에서 확인했으나 Canvas/DOM 동형 PASS가 아니다. |
| 구조 G0 수치                          | 동일 `adr248-structural-baseline-v1` 입력·HEAD·620×400 PNG에서 2,829/248,000픽셀 다름. 고정 좌표 분해는 page edge 402, Text area 203, Frame edge 1,879, 기타 345다. 색쌍 분해에서는 구 fill `(219,231,255)`→새 stroke `(56,81,164)` 1,116 및 `(121,141,200)` 1,104, 구 선택선 `(168,209,255)`→새 `(168,208,255)` 398이다. 색쌍과 좌표 분해는 서로 다른 집계라 합산하지 않는다. 구 Frame Skia box에 stroke가 없다는 [구 실행 trace](248-phase3-slot-old-trace.json)와 새 `borderColor=#3851a4,borderWidth=2`가 stroke command로 쓰이는 [stream](248-phase3-structural-catalog-commands.json)이 2,220픽셀의 주 원인을 입증한다. page edge는 같은 선택 overlay painter를 실행해도 1채널 차이가 남는다. Text 영역은 글리프/안티앨리어싱 차이이며 구 실행의 font/WASM 전체 hash가 없어 원인 최종 귀속은 미검증이다. 기타 345픽셀도 object별 최종 귀속 전이다.          | **G3 pixel FAIL.** 구 border 누락을 재현하려고 새 stroke를 숨기지 않았다. page/Text/기타 픽셀은 동일 실행 모듈·font·WASM pairing 전 임의 색 보정하지 않는다.                                                                                                                                              |
| 실행 identity                         | old trace는 dev `/src/main.tsx` 응답 hash만 보유한다. 새 출력은 binding/compositionRoot/renderCommands/Rust WASM/CanvasKit WASM/Pretendard 파일 SHA-256를 기록했다. 양쪽의 dist index hash 일치는 실행한 모든 module/asset이 같다는 증거가 아니다. 독립 test entry를 현 제품 production build 안에서 실행하는 경로는 아직 없다.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **UNVERIFIED_DEV_SERVER_VS_VITEST.** 동일 production build paired 수치로 승격하지 않음.                                                                                                                                                                                                                   |
| G5 문서 byte 부분 gate                | [독립 byte 결과](248-phase3-document-byte-budget.json)는 G0의 mixed Text/frame·2 page 0/1/60/600/5k 정본을 같은 `TextEncoder(JSON.stringify(document))`로 비교했다. Bn은 76,182/76,823/121,583/534,201/3,926,667 B, Pn은 641/1,010/23,069/227,583/1,913,516 B다. H1 data stores와 asset binary는 양쪽에서 제외, project library snapshot은 0 B. `P0≤B0+4,096`, `Pn−P0≤1.20(Bn−B0)+4,096`은 5/5 통과한다. 새 모델은 기존 문서의 비시각 envelope를 그대로 복사하지 않아 이 측정은 동일 mixed seed의 문서 byte 부분 비교다.                                                                                                                                                                                                                                                                                                                                          | **독립 byte 부분 gate PASS, G5 전체 UNVERIFIED.** paired p95/heap/실제 동일 소비자/bundle·library cache byte 없음.                                                                                                                                                                                        |

Builder build 재실행 후 보조 old trace의 dist index hash는 `a3e33abb…`, 현 dist index는 `be95b9de…`로 달라졌다. test는 같은 HEAD·scenario hash를 계속 요구하고 `buildMatched=false`, `DIST_INDEX_CHANGED_AFTER_OLD_TRACE`를 결과에 남긴다. 이는 G0 정본 변경이나 build identity PASS가 아니다.

### known old defect와 HC6 판정 요청

| 사례                | 구 값                                                                                                        | 새 의도 값·Canvas/DOM 상호 값                                                                                                               | 수치 diff·원인                                                                                       | 제안 처분                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Group horizontal/sm | 둘째 자식 `(2,42)`; 구 horizontal도 세로 배치                                                                | Rust/Canvas `(58,2)`; 격리 RAC `row`, gap `6px`, `aria-orientation=horizontal`, 자식 `(58,2)`                                               | `(+56,−40)` CSS px. 구 Canvas 방향 결함과 새 definition row/size gap 교정                            | §3.6·§6.1 교정 유지, **old/new HC6 numeric FAIL 유지**. 제안 문안은 아래 기존 절의 사용자 판정 대기. |
| Group vertical/lg   | 둘째 자식 `(2,42)`                                                                                           | Rust/Canvas `(2,54)`; 격리 RAC `column`, gap `12px`, `aria-orientation=vertical`, 자식 `(2,54)`                                             | `(0,+12)` CSS px. 구 size gap 미적용과 새 교정                                                       | 위와 동일. old defect 자동 면제·threshold 상향 없음.                                                 |
| Slot `null`         | 공개 insert 뒤 store에 있으나 legacy-slot projection에서 scene/layout/Skia `null`, refresh 뒤 Element도 부재 | typed Slot layout `(22,152,160,80)`; 격리 RAC empty/description 및 filled 전환 존재. Canvas 등록은 box-only라 placeholder/내용은 **미일치** | old가 `null`이라 geometry 수치 diff 정의 불가. 구 projection 결함 + 새 Canvas Slot paint 누락은 별개 | 구 결함 증거 유지, 새 Slot Canvas paint를 후속 Phase 3 국소 수리. HC6 예외 승인 전 G3 FAIL.          |
| Frame border        | 구 Skia frame fill `#dbe7ff`, stroke 없음                                                                    | 새 Canvas stroke `#3851a4` 2px; 격리 RAC border 2px                                                                                         | fill→stroke 색쌍 2,220픽셀. 구 Frame border 누락; 전체 구조 PNG diff는 2,829픽셀                     | 새 border 유지. old/new pixel FAIL과 수정 의도 검토, 자동 예외 없음.                                 |

이 표의 제안은 ADR/HC6를 수정하거나 G3를 통과 처리하지 않는다. Pencil `sample-descendants.pen`의 icon/footer 결손과 `sample-imports.pen`의 `./kit.pen` 부재도 기존 명시 오류로 유지했다. G4 제품 저장·Preview iframe·Publish 연결은 여전히 미검증이다. [coverage manifest](248-phase3-coverage.json)는 130 type·1,333축·14 role에서 대표 test-entry binding 4종만 추가 기록했고, 전체 type PASS 0 / FAIL 2 / UNVERIFIED 142를 유지한다.

검증: 독립 Phase 2+3 scoped test 36개, Chromium 격리 RAC 3/3, `pnpm run codex:typecheck`, `pnpm run codex:guard`, Builder build, 기존 WebKit frame insert smoke를 실행했다. 제품 source→새 runtime import 0, 생성 dist의 새 runtime marker 0이다. Preview/Compare 자동 harness 및 `apps/publish` 수정 없음. 아래 이전 절들의 개별 결과는 이 최신 판정의 일부 근거로만 사용한다.

## 2026-09-28 Group·실제 scene·Slot 추적 최신 판정

이 절이 아래의 이전 계측·판정을 대체한다. **Phase 3 미완료, G3 FAIL, G4 부분검증, G5 UNVERIFIED, Phase 4 진입 불가**다. G0 frozen oracle은 수정하지 않았다. HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, staged 삭제 132개와 공유 dirty 변경은 그대로 보존했다.

| 계약                | 실제 입력→소비자·산출물                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 판정                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Group 방향·size gap | read-only Group definition의 기본 `orientation=vertical,size=md`와 size별 gap `sm=6,md=8,lg=12`를 같은 resolver에서 읽는다. `compositionRoot.ts`가 Rust `flexDirection`과 `rowGap/columnGap`에 주고, 독립 `renderCommands` scene 및 격리 RAC DOM은 그 geometry·prop을 소비한다. G0 native-state horizontal/sm의 둘째 자식은 구 `(2,42)`, 새 Rust `(58,2)`; vertical/lg는 구 `(2,42)`, 새 `(2,54)`다. Chromium RAC에서 각각 `flex-direction:row/column`, gap `6px/12px`, `aria-orientation:horizontal/vertical`, 자식 위치 `(58,2)/(2,54)`를 확인했다. [new geometry/command](248-phase3-native-state-new.json), [RAC test](../../../apps/builder/tests/parity/adr248CatalogRealDom.browser.test.ts).                                                                                                                                                                                                                           | **새 방향·gap·ARIA 대표 입력 PASS; old numeric parity FAIL 2건**. 새 horizontal을 old vertical 결함에 맞춰 되돌리지 않음. |
| Frame clip          | native-state 3건의 실제 Rust parent/child geometry는 구와 같고, `renderCommands`의 clip group 2개·바깥 표본 3픽셀이 구 공개 캡처와 일치한다. [새 command PNG](248-phase3-native-render-commands.png)는 해당 부분 장면이다. 같은 G0 3입력을 Chromium 격리 RAC DOM에서 렌더해 자식의 부모 상대 geometry `(92,32)`와 바깥 point hit를 확인했다. `visible` 1건은 자식 hit, `hidden` 2건은 자식 hit 0이다. DOM PNG 전체 이미지 비교는 없다.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Canvas 표본·DOM clip hit PASS / PNG parity UNVERIFIED**                                                                 |
| G0 구조 scene       | [구 G0 PNG](248-baseline/canvas.png)와 같은 `adr248-structural-baseline-v1` 공개 입력을 새 typed graph 조작으로 독립 실행했다. 실제 Rust layout의 typed descriptor를 test entry에서 `CanvasSceneNode`/`SkiaNodeData`로 명시 투영해 기존 `buildRenderCommandStream`/`executeRenderCommands`에 연결했다. 이는 제품 scene binding이 아니다. box와 **Text draw command 1개**를 실행하고, 구 앱에서 읽은 page frame·`--border` 및 선택된 page body 상태로 기존 `renderFrameAreaBorder`·`renderSelectionBox`·handles overlay를 실행했다. [새 PNG](248-phase3-structural-render-commands.png)는 실제 command 21개로 만든 620×400 출력이다. exact diff **2,829/248,000픽셀**. 이전 renderBox 3,387픽셀 probe는 전체 scene 근거로 세지 않는다. old dev server와 new Vitest source 실행 모듈 identity 동등성은 여전히 **UNVERIFIED**다. [측정 JSON](248-phase3-structural-new.json), [구 실행 resource](248-phase3-slot-old-trace.json). | **G3 pixel FAIL**. ≤0.001 충족 주장 없음.                                                                                 |
| Slot `null` 원인    | 같은 G0 공개 `addComplexElement` 후 구 store에는 `Slot`이 있다. canonical writer가 `type:frame, metadata.type:legacy-slot`로 저장하면서 `props`가 없어지고, `isCanonicalNodeProjectableToElement`와 `toCanvasSceneNode`는 이 일반 `legacy-slot`을 거른다. 실행한 구 앱에서 scene debug hook 존재, Slot scene/layout/Skia command 부재, refresh 뒤 Element도 부재를 확인했다. [trace](248-phase3-slot-old-trace.json); source `adapters/canonical/index.ts:190-212`, `stores/canonical/canonicalTraversalHelpers.ts:139-151`, `workspace/canvas/scene/canvasSceneNode.ts:633-649`. 새 typed Slot은 geometry가 있어 old null과 다르다.                                                                                                                                                                                                                                                                                           | **원인 추적 PASS / Slot G3 numeric parity FAIL**, 자동 면제 없음.                                                         |
| coverage·build      | [manifest](248-phase3-coverage.json)는 130 type·1,333 시각 축·14 role을 보존한다. type 판정은 PASS 0, FAIL 2(Group·Slot), UNVERIFIED 142(나머지 type 128+role 14)이다. 네 대표 type은 실제 command와 RAC를 부분 실행했지만 완전 binding·축 parity는 0이다. 새 assets SHA-256 일부와 구 dev `/src/main.tsx` response SHA-256를 남겼고, **실행 전체 module/asset 동일성은 확보되지 않았다**. 현재 paired old/new Builder dist index SHA-256는 `a3e33abb92a025bf2e0d007c23a0dfb7b149d487db50158af583bc807c5633cd`로 일치하지만 이 사실만으로 실행 module 동일성을 판정하지 않는다.                                                                                                                                                                                                                                                                                                                                                | **전체 G3 FAIL**                                                                                                          |

구조 scene의 exact diff를 고정 좌표 구역으로 나누면 page edge 402, Text 영역 203, Frame edge 1,879, 기타 345픽셀이다([측정 JSON](248-phase3-structural-new.json)). 이 구역 집계만으로 객체별 책임을 확정하지는 않는다. page·Frame 경계 구역의 차이만 합쳐도 2,281/248,000픽셀(0.0092)로 HC6의 비텍스트 0.001을 넘는다. 구 앱의 실제 Frame Skia box에는 fill만 있고 stroke가 없지만, 새 typed `visual.borderColor/borderWidth=2`는 command box의 stroke로 전달된다([구 trace](248-phase3-slot-old-trace.json)). §3.6의 변별 border 요구를 없애거나 구 스크린샷에 맞춰 새 border를 숨기지 않았다. 구 공개 조작 직후와 refresh 뒤 `selectedElementId`는 page body ID와 같고, 일반 page border token `--border=oklch(87% 0 none)`과 다른 파란 선은 `skiaOverlayBuilder.ts:803-823`의 selected body box/handles 경로다. 새 독립 scene에서도 같은 기존 selection painter를 실행해 page edge 차이를 1,024→402픽셀로 줄였지만 완전 일치는 아니다.

**ADR gate 충돌과 검토 제안:** [본문 HC6](../248-unified-catalog-document.md)은 동일 fixture의 Canvas/DOM geometry ≤1 CSS px, 비텍스트 pixel diff ≤0.001을 요구한다. 반면 [breakdown §3.6·§6.1](248-unified-catalog-document-breakdown.md)은 Group orientation·size gap을 definition과 양쪽 소비자에서 바로잡고, 구 horizontal/vertical 동일 세로 배치를 알려진 비대칭으로 기록해 baseline 면제로 처리하지 말라고 한다. 위 horizontal 둘째 자식은 old `(2,42)`와 corrected `(58,2)`이므로 두 문구를 **같은 old/new 수치 비교로 동시에 PASS**시킬 수 없다. 제안 문안: “G0에 원인과 기존 결함이 고정된 Group 방향·gap 사례는 구 앱 수치와의 diff를 FAIL로 별도 유지한다. 수정 동작의 합격은 catalog resolver→Rust/Canvas→RAC가 같은 row/column·gap·ARIA 값을 쓰고 Canvas/DOM 상호 geometry ≤1 CSS px 및 비텍스트 pixel diff ≤0.001을 만족할 때만 사용자 검토로 결정한다. 그 외 fixture는 기존 old/new HC6 기준을 그대로 적용한다.” 이는 **제안**이며 ADR·threshold·G3 판정을 변경하지 않았다. 사용자의 gate 문안 판정이 필요하다.

**남은 실행 경계:** 전체 구조 scene 2,829픽셀 차이의 원인별 분리·수리, 구/새 실행 모듈과 font/WASM asset identity pairing, Frame DOM clip·Slot empty/filled/description의 Canvas 및 RAC 동형 출력, 130 type/1,333축/14 role 확대가 필요하다. Pencil 유효 3개는 직접 의미 왕복을 유지하나 결손 2개는 dangling 명시 오류다. H1 data는 외부 store ID 참조의 독립 validator/index/history만 확인했으며 제품 data store 연결은 Phase 4 의존이다. G5 paired p95·heap·byte·bundle 측정은 실제 동일 소비자 조건이 없어 시작하지 않았다. Preview/Compare 자동 harness, 제품 entry cutover, apps/publish 변경은 없다.

검증: 새 root scoped Phase 2+3 **35/35**, G1 **30/30**, Chromium 격리 RAC **3/3**, `pnpm run codex:typecheck`·`codex:guard`·Builder `pnpm -F @composition/builder build` PASS. 구 Slot 공개 조작 trace는 browser error 0. 격리 WebKit 구 Builder 공개 frame insert smoke는 240×120 geometry·Canvas 1·error 0으로 PASS(`/private/tmp/adr248-phase3-webkit-current.json`). 제품 source의 새 catalog module 참조 검색 0, dist의 `CatalogCompositionRoot`/새 DB marker/transaction marker 검색 0. 범위별 ESLint·Prettier 및 `git diff --check` PASS. 기존 132개 staged 삭제는 보존했다.

## 이전 실제 소비자 경로 계측 (최신 판정에 의해 대체)

이 절이 아래의 이전 판정을 대체한다. Phase 3은 **미완료**, G3 **FAIL**, G4 **부분검증**, G5 **UNVERIFIED**다. G0/G1/G2와 단일 root leaf 비용 수리는 유지했다.

**Native-state 추가 계측:** [구 G0 pinned 정본](248-baseline/native-state-pinned/baseline.json)의 같은 scenario ID/hash와 HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, 1440×900/DPR1/font/theme/seed로 구 Builder의 공개 명령을 현재 실행 build에서 다시 수행했다. [별도 구 앱 oracle](248-phase3-native-old-current/baseline.json)은 원래 G0 값·입력을 변경하지 않으며 새 test entry가 사용한 현 Builder dist index SHA-256 `ba569b23…`와 일치한다. [새 결과](248-phase3-native-state-new.json)와 [clip probe PNG](248-phase3-native-state-new.png)에서 Frame 3건의 부모·자식 geometry가 일치하고, `overflow=visible/hidden/hidden`의 구 screenshot 표본 3픽셀이 일치했다. CanvasKit 직접 clipping probe의 부분 근거일 뿐 전체 `renderCommands` scene과 RAC DOM clip parity는 **UNVERIFIED**다. Group vertical 자식 2개는 일치했으나 horizontal 둘째 자식은 구 `(2,42)`와 새 `(52,2)`로 **FAIL**이다. 새 RAC의 horizontal row와 구 Canvas의 vertical 배치 비대칭을 자동 면제하거나 새 소비자를 세로 배치로 바꿔 가리지 않았다. [coverage](248-phase3-coverage.json)의 G3는 PASS 0, FAIL 1(Group), UNVERIFIED 143이다. scoped Phase 2+3 테스트는 아래 기록에 native-state 1건이 더해져 **35/35**다. 이전 표·문장의 Frame clip 미검증 표현은 full scene/DOM clip을 뜻한다.

**Group orientation 결정 지점:** 구 Canvas는 `horizontal`과 `vertical` 자식을 모두 세로로 배치하지만 새 Rust와 RAC는 `horizontal`을 가로로 배치한다. (A) 구 Canvas geometry를 절대 parity 목표로 삼으면 새 horizontal을 세로로 만들어 새 RAC 의미와 충돌한다. (B) orientation 의미를 가로로 유지하고 구 Canvas의 미소비를 명시 결함으로 수리·승인하려면 G0 대비 예외의 범위와 G3 허용 기준을 ADR에 확정해야 한다. 두 선택 모두 Group layout·Canvas/DOM parity·coverage에 영향을 준다. 현재는 어느 쪽도 임의 채택하지 않고 Group G3를 FAIL로 유지한다.

여기서 `buildMatched=true`는 구 앱 재실행과 새 test entry가 참조한 **Builder dist index hash의 일치**만 뜻한다. 구 앱은 dev server, 새 driver는 Vitest source import로 실행돼 양쪽 실행 모듈 번들의 완전 동일성까지 증명하지 않는다. 전체 G3 pixel/semantic PASS 근거로 확장하지 않는다.

| 계약                      | 실행 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 판정                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| G0 자식 좌표              | `adr248-baseline.mjs:23-68,113-145`의 공개 `addComplexElement`는 각 자식을 `position:absolute;left/top:${x/y}px`로 작성한다. `elementCreation.ts:322,368`이 canonical merge·저장을 호출하고 `canonicalMutations.ts:1173`이 `props`를 보존하며 `persistActiveCanonicalDocument.ts:13-31` → `incrementalDocuments.ts:120-126`이 문서를 저장한다. 구 layout의 `flexStyleAdapter.ts:180-197`은 left/top을 `insetLeft/Top`으로 보내고 `packages/engine/src/tree.rs:2387-2435`는 직계 부모 padding box를 기준으로 배치한다. G0 고정 geometry는 Frame `(40,40)`, Group `(22,22)`(Frame border 2 포함), Text `(180,0)`이고 Slot은 old layout `null`이다. | **위치 의미 확정**                                            |
| 좁은 typed node placement | `NodeEntry.placement={kind:"absolute",x,y}`를 PageEntry.placement와 분리했다. finite px 좌표만 validator가 받고 `setNodePlacement`는 역연산을 만든다. resolver·composition root가 값 변경만 영향 instance에 전달하고 실제 Rust layout 입력의 `position/insetLeft/insetTop`이 이를 소비한다. G1 정상·불법 좌표·Undo 및 Phase 3 무관 구독 0 테스트가 통과했다. 구 generic style payload와 adapter는 추가하지 않았다.                                                                                                                                                                                                                               | **대표 입력 계약 PASS, 전체 G3 아님**                         |
| 실제 geometry·CanvasKit   | [독립 결과](248-phase3-structural-new.json)는 같은 G0 scenario ID/hash, HEAD, 1440×900/DPR1/font/theme/seed와 실제 Rust WASM layout을 기록한다. Frame·Group·Text의 `x/y/width/height`는 G0 3/3 일치한다. Slot은 새 `(22,152,160,80)`이고 구 oracle이 `null`이라 parity 미판정이다. 기존 `renderBox`로 CanvasKit 620×400 PNG를 만들고 G0의 0.8 camera scale을 적용한 [새 PNG](248-phase3-structural-new.png)를 [구 PNG](248-baseline/canvas.png)와 비교했다. exact 차이 **3,387/248,000 픽셀**이다. 이 box probe에는 구 앱의 page outline·Text paint·전체 scene이 없어 §6.1 pixel 기준을 만족하지 않는다.                                         | **geometry 대표 3/3, pixel FAIL**                             |
| 격리 RAC DOM              | `adr248CatalogRealDom.browser.test.ts`를 Chromium test entry에서 실제 `Group`/`Slot`으로 마운트했다. `getBoundingClientRect()`에서 Frame `(40,40,440,260)`, Group 부모 상대 `(22,22,380,120)`, Text 부모 상대 `(180,0)`을 확인했다. Group `role=group`·`flex-direction:row`, Slot empty/description 및 자식 추가 후 filled/edit·page 동작을 확인했다. 이 한 사례는 전체 130 type·1,333축·14 role parity가 아니다.                                                                                                                                                                                                                                | **대표 geometry PASS, RAC 동작 확인, old ARIA parity 미검증** |
| Pencil 유효 3개           | [실제 소비자 실행](248-phase3-pencil-consumers.json)은 원본 `sample-minimal/slots/ref.pen`을 직접 import해 Rust layout을 실행했다. 원본은 크기 미지정으로 0폭/0높이다. 이를 숨기지 않고 각 독립 graph에 `patchNodeSizing(width=200,height=120)` 공개 보충 조작을 기록한 후 CanvasKit `renderBox`와 RAC `Slot` region을 실행했다. 원본 파일 변경은 없다. G0의 `OLD_INTERCHANGE_ROUNDTRIP_PASS`는 외부 JSON 보존만 뜻하고 구 visual oracle이 없으므로 여기서 시각 parity를 주장하지 않는다. `sample-descendants.pen`의 icon/footer와 `sample-imports.pen`의 `./kit.pen`은 계속 명시 오류다.                                                        | **실제 연결 부분검증, G4 전체 미통과**                        |
| build·coverage·성능       | [coverage manifest](248-phase3-coverage.json)에 130 type/1,333축/14 role과 대표 4 type의 부분 근거를 기록했다. G3 PASS 0·FAIL 1(Group)·UNVERIFIED 143이고, 나머지 126 typed definition과 전체 type binding·state/slot role parity는 미검증이다. 구 frozen build index SHA-256 `3474b01d…`와 현재 Builder dist index SHA-256는 [실행 결과](248-phase3-structural-new.json)에 별도 기록하며 서로 같다고 가정하지 않는다. 실제 전체 scene과 동일 build paired gate가 없으므로 §6.2 G5 p95·heap·byte·bundle은 측정하지 않았다.                                                                                                                       | **G3 FAIL / G5 UNVERIFIED**                                   |

`visual.overflow`는 새 resolver 값에 남지만 Rust `NodeStyle`이 받는 필드가 아니므로 layout JSON에 보내지 않는다. 실제 WASM이 이 키를 받은 경우 `buildTreeBatch`가 빈 handle을 반환하는 반례를 찾고 해당 입력만 제거했다. Frame 자식 clipping은 CanvasKit scene과 RAC DOM 양쪽에서 아직 검증되지 않았다.

구 Canvas reader도 확인했다. `canvasSceneNode.ts:638-675`는 canonical `node.props`를 scene node에 복사하고, `buildSkiaNodeData.ts:48-90`는 그 `props.style`과 layout map에서 Skia node의 위치·크기를 만든다. 이 연결은 구 G0 좌표가 저장 뒤 Canvas까지 도달한다는 source 근거이며, 새 모델의 전체 scene parity 근거로 대체하지 않는다.

[G0 격리 native DOM oracle](248-baseline/dom-native-pinned.json)의 scenario `adr248-native-dom-unit-v1`도 새 typed graph의 Group orientation/label/disabled와 Slot name/required/description·채운 Text를 resolver로 읽어 기존 RAC `Group`/`Slot`에 전달했다. [비교 출력](248-phase3-native-dom-comparison.json)에서 horizontal·vertical Group, empty·filled Slot의 **정적 markup 4/4가 문자열까지 일치**한다. 이 oracle은 `ISOLATED_OLD_MODULE_ORACLE`이며 자체 선언처럼 geometry/PNG 시각 환경이 없다. 따라서 4/4는 G3의 static semantic 부분 근거이고 전체 시각·상태 축 통과가 아니다.

새 format 저장 경계에서는 같은 G0 조작 후 `CatalogRuntime.save()`로 IDB durable commit을 완료하고 `CatalogStorage.load()`로 새 `CatalogGraph`를 만든 뒤 Group placement `{kind:"absolute",x:20,y:20}`을 다시 읽었다. 이는 해당 typed 필드의 독립 저장 왕복 근거이며 제품 refresh·전체 G4는 미검증이다.

실행: shared G1 **30/30**, scoped Phase 2+3 **35/35**(실제 Rust+CanvasKit 3/3 및 G0 static DOM 4/4 포함), Chromium RAC browser **1/1**, scoped ESLint, `pnpm run codex:typecheck`, `pnpm run codex:guard`, Builder `pnpm -F @composition/builder build` 모두 PASS. 구 Builder WebKit 공개 insert smoke는 frame 240×120·Canvas 존재·console/page error 0으로 PASS. 제품 소스의 새 runtime/graph import 검색 0, Builder dist의 `setNodePlacement`·`CatalogCompositionRoot` marker 0. staged 삭제 132개와 `.gitignore` 등 공유 변경은 보존했다. 전체 dirty 자동 포맷은 실행하지 않았다. Preview/Compare 자동 harness와 `apps/publish`는 실행·수정하지 않았다.

남은 G3 실행 범위는 같은 frozen build 조건의 전체 Canvas scene(페이지 외곽선·Text·clip 포함)과 old/new pixel·RAC semantic 비교, 등록 130 type/1,333축·14 role의 각 승인 사례다. 구 Slot null은 자동 면제하지 않는다. Pencil 결손 2개는 유효 template 주소와 `./kit.pen`이 제공되거나 ADR에 명시 정책이 추가될 때까지 dangling 오류로 남긴다. 실제 전체 소비자 fixture가 갖춰지기 전 G5 paired 수치는 없다. Phase 4 진입 조건은 충족하지 않았다.

[G0 Frame/Group native-state 정본](248-baseline/native-state/baseline.json)의 Group horizontal/vertical은 구 Canvas 자식 배치가 동일한 세로 방향이고 Frame clip은 refresh 뒤 mirror에서 소실되는 비대칭이다. 이번 새 DOM의 horizontal row 확인과 정적 markup 4/4는 그 기존 시각 비대칭을 자동 면제하거나 해소한 판정이 아니다. Frame overflow 자식 clip, Group 두 방향의 실제 Canvas/DOM geometry·pixel을 별도 비교해야 한다.

## 2026-09-28 연속 작업 최신 판정

이 절이 아래 **이전 판정**을 대체한다. G0/G1/G2 PASS는 유지하고 Phase 3은 계속 미완료다.

| 계약                 | 새 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 판정                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| leaf delta 비용      | `resolveCatalogNode`의 선택 경로 방문과 `sourceInstances` 역조회로 기존 root의 변경 record만 갱신한다. 단일 root 60/600/5k owned leaf에서 각 1회 편집당 resolver 방문 2(조상+대상), layout 입력 방문 1, 영향 instance 1; graph transaction entries traversal 0, entry table clone 0, record replacement 1, full document JSON serialize 0, leaf 중 `exportDocument()` 호출 0, 무관 Canvas/DOM subscriber 통지 0. record 직렬화 호출 ≤3이며 전체 signature 비교 코드를 제거했다. 초기 load/full export는 별도 cold path다. `phase3DeltaScale.test.ts`의 실제 계측이며 수치를 0으로 대입한 mock metric이 아니다. | **단일 root leaf 반례 수리 PASS(범위 한정)** |
| 관계와 history       | nested template patch, slot fill, owner child reorder, tombstone, Undo/Redo, token 변경을 독립 root에서 검증했다. 관련 instance의 값/입력만 바뀌고 다른 root·자식 subscriber 통지 0. 구조 변경은 여전히 영향 root 전체를 다시 resolve하므로 영향 subtree로 더 좁히는 비용 증거는 없다.                                                                                                                                                                                                                                                                                                                         | 정합성 부분 PASS / 구조 비용 UNVERIFIED      |
| typed fixture·Pencil | read-only `pencilFixtureLibrary.ts`에 frame/rectangle/text/group/slot의 명시 definition과 실행 ID를 두었다. NodeEntry의 이름·named region·placeholder를 typed 필드 및 validator로 추가하고 Pencil `clip`은 ADR의 `visual.overflow`로 직접 정규화했다. `sample-minimal`, `sample-slots`, `sample-ref` **3/5**는 직접 graph 의미 왕복 PASS. `sample-descendants`는 원본 reusable에 없는 `icon`/`footer` 주소, `sample-imports`는 실제 파일 없는 `./kit.pen` 때문에 명시 실패를 유지한다.                                                                                                                         | G4 부분검증, **전체 G4 미통과**              |
| G3 coverage          | [source별 manifest](248-phase3-coverage.json)에 130 type/1,333 축/14 slot role을 모두 남겼다. 현재 fixture definition은 등록 type 중 4/130(나머지 126개 누락), 실제 CanvasKit binding 0/130, 격리 RAC binding 0/130이다. 새 geometry/PNG/semantic parity 0/130이고 baseline 면제 0. Preview/Compare는 DEFERRED다.                                                                                                                                                                                                                                                                                              | **G3 미통과**                                |
| G5                   | ADR-243 main baseline commit 전제 충족. 실제 소비자 조립과 유효 전체 fixture가 없어 §6.2의 동일 장비/seed 60/600/5k, nested ref, Chromium 1x/4x, WebKit paired p95·heap·저장 byte·initial/async bundle을 실측하지 않았다. leaf 결정적 카운트는 G5 전체 PASS가 아니다.                                                                                                                                                                                                                                                                                                                                          | **G5 UNVERIFIED**                            |

**설계 결정 필요 지점:** `sample-descendants.pen`의 `icon`·`footer`는 reusable 원본에 대상 경로가 없다. ADR §3.3/§3.4는 존재하는 typed template 주소만 허용한다. 선택지는 (A) 입력을 명시 오류로 두고 유효 template/region이 있는 Pencil fixture를 별도로 확보하거나, (B) Pencil import가 누락 대상에 대해 어떤 definition/template 노드를 합성할지 새 정책을 ADR에 정하는 것이다. `sample-imports.pen`의 `./kit.pen`은 제공되지 않았다. 선택지는 (A) 외부 파일과 검증된 library definition을 제공받아 resolve하거나, (B) 미해결 외부 참조의 보존·실행 금지·재해석 규칙을 ADR에 추가하는 것이다. 현재 ADR의 dangling 금지 계약에 따라 두 fixture의 의미 왕복 PASS는 보류한다. 이 결정은 exchange뿐 아니라 schema/library 버전·validator·resolver·G3 binding 범위에 영향을 준다. generic payload나 canonical adapter는 추가하지 않았다.

**G3 geometry 입력 결정:** G0 [구조 시나리오](248-baseline/baseline.json)는 Frame/Group/Slot/Text 공개 `insert` 명령에 `x/y/width/height`를 준다. 현재 `NodeEntry`는 `sizing.width/height`는 저장하지만 node의 `x/y` 또는 placement를 소유하는 typed 필드가 없다. `PageEntry.placement`는 페이지 배치 계약이므로 자식 node의 절대 좌표로 재사용할 근거가 없다. 선택지는 (A) node에 breakpoint별 위치/배치의 typed entry를 추가하고 transaction·validator·layout·exchange 계약을 함께 정하거나, (B) 해당 좌표를 layout container의 파생 flow 입력으로 해석하는 조건과 G0 비교 사례를 명시하는 것이다. 결정 없이 고정 `x/y`를 무시하거나 `props`의 열린 payload로 숨기지 않는다. 이 지점의 G0 동일 조건 geometry/PNG 비교는 보류한다.

이 밖에 Frame/Group/Slot 대표 fixture의 실제 CanvasKit 및 격리 RAC DOM 조립, G0 동일 조건 geometry/PNG/semantic 비교, 남은 126 typed definition과 실행 binding이 필요하다. 제품 entry와 Phase 4는 건드리지 않았다.

2026-09-28, HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`. 이 문서는 breakdown §5 Phase 3, §6.1, §6.2의 **진행 근거와 미충족 계약**을 기록한다. Phase 3 완료나 G3/G4/G5 PASS 판정이 아니다.

## 선행 기준과 변경 경계

- [G0](248-baseline/g0-gate.json)는 `G0_PASS`, `remainingG0=[]`; 비교 정본 18개, 허용 기능군 10개 FROZEN, Preview/Compare 1개 DEFERRED다. [G1](248-phase1-g1-evidence.md) 29/29, [G2](248-phase2-g2-g4-evidence.md) 14/14를 재구현하지 않았다.
- ADR-243은 위 HEAD의 main commit에서 측정 기록 분기 ②로 종결됐다. 따라서 §6.2 baseline **commit 전제만** 충족한다. 동등 조건의 새 모델 paired A/B 측정은 없다.
- 별도 staged 삭제 132개, `.gitignore`, 다른 미커밋 변경은 건드리지 않았다. 기존 Builder 제품 entry/barrel/store/history/panels, `incrementalDocuments.ts`, `apps/publish` 변경 0. 새 root는 `catalogRuntime/compositionRoot.ts`에서 독립 테스트만 import한다. 구 canonical adapter, dual-write, 구 프로젝트 reader는 추가하지 않았다.

## 이전 판정 (연속 작업 전)

| 계약                      | 실제 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 판정                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| transaction → layout 입력 | `CatalogCompositionRoot`가 `CatalogRuntime.dispatch/undo/redo` 결과의 `revision/changedIds/removedIds`와 runtime의 변경 전후 영향 closure를 받아 기존 `PersistentLayoutTree`의 style/children/add/remove 및 ID별 Canvas/DOM **입력 descriptor**를 갱신한다. 독립 테스트에서 관련 root만 갱신, 무관 root subscriber 통지 0, token→consumer와 owner→child 전파, tombstone·Undo/Redo를 확인했다.                                                                                                                                                                                                   | 입력 경계 부분검증. 실제 Canvas/DOM 소비는 UNVERIFIED |
| leaf 비용                 | `graph.exportDocument()`를 leaf 중 강제 실패시켜 미호출을 확인했다. 그러나 `resolveCatalogNode(rootId)`와 `flatten(rootId)`가 영향 root의 전체 subtree를 다시 순회한다. 단일 root fixture에서 leaf 하나의 변경에도 `layoutInputVisits === inputCountBefore`, `traversedWholeInputGraph=true` 반례가 재현된다. 전체 graph scan 0, full signature rebuild 0을 주장할 수 없다.                                                                                                                                                                                                                     | **G5 위반 반례 / 미완료**                             |
| G3 Canvas/DOM             | 새 root는 layout engine 입력과 Canvas/DOM descriptor만 만든다. 실제 CanvasKit scene, 격리 RAC DOM, geometry, PNG, semantic tree 출력은 없다. [coverage manifest](248-phase3-coverage.json)는 등록 type 130개·요구 축 1,333개·slot role 14개를 전부 UNVERIFIED로 기록하며 baseline 면제 0이다. Frame fill/border/overflow, Group orientation/ARIA, Slot, named regions, selectedHover/selectedPressed, Tree/Slider, collection/Table/date/color/chart도 미검증이다. G0 leaf fixture의 **의미 입력** 한 건만 재실행했으며 해당 구 dev 출력의 실행 build ID가 불명이라 G3 시각 비교로 세지 않는다. | **G3 미통과**                                         |
| G4 독립 왕복              | G0 leaf 공개 조작 `insert Text → setText`를 새 format root에서 dispatch하고 저장·재시작·load해 text/parent/revision을 확인했다. Phase 2의 새 format IDB·JSON/folder, 실패·충돌 14개 검증은 유지된다. 실제 G0 Pencil 5개 fixture는 현재 직접 import에서 5/5 명시 오류: rectangle/name, slot/name, reusable ref/descendants, imports를 표현·매핑하지 못한다. 이 테스트는 **거부 확인**이지 의미 왕복 PASS가 아니다. H1 data store 명령, 제품 refresh, Preview iframe, Publish 진입점도 UNVERIFIED다.                                                                                              | G4 부분검증 유지, **전체 G4 미통과**                  |
| G5 성능·크기              | ADR-243 main baseline commit 전제는 충족한다. 새 소비자의 실제 Canvas/DOM과 전체 type/상태 fixture driver가 없어 동일 장비/seed의 60/600/5k, nested ref, Chromium 1x/4x, WebKit paired p95·heap·저장 byte·initial/async bundle을 측정하지 않았다. §6.2의 예산은 변경하지 않았다.                                                                                                                                                                                                                                                                                                                | **G5 UNVERIFIED**                                     |
| 제품 격리·기존 앱         | Builder build, TypeScript 검사, 독립 Vitest, 격리 WebKit frame smoke 통과. 제품 소스의 새 runtime/graph import 검색과 dist marker 검색 0. Preview/Compare는 실행하지 않았다.                                                                                                                                                                                                                                                                                                                                                                                                                    | PASS (범위 한정)                                      |

## 완료 전 필요한 작업과 설계 영향

1. root 전체 해석을 leaf/영향 closure의 record 갱신으로 줄이고, 실제 layout 입력에서 전체 순회·복사·직렬화가 0임을 단일 root 60/600/5k fixture로 계측해야 한다. 초기 로드와 full export는 별도 cold path다.
2. read-only library는 현재 box/text/slot/badge/card의 5개 fixture definition만 가진다. `VisualField`는 17개 필드이고 `NodeEntry.slot`은 `{name,required}`다. [G0 manifest](248-baseline/coverage-manifest.json)의 130 type/1,333 축과 Pencil 5개 fixture를 모두 받는 구체적 typed definition/placement/region 계약 및 CanvasKit·격리 RAC binding이 없다. 이 계약을 추가하면 Phase 1 schema/library 및 Phase 3 소비자·교환 형식에 영향을 준다. generic payload나 canonical alias로 메우지 않는다.
3. 동결된 scenario ID/입력·HEAD/build·viewport/DPR/font/theme/seed로 새 독립 driver를 공개 명령부터 실행하고 geometry ≤1 CSS px, 비텍스트 diff ≤0.001 및 semantic/RAC을 판정해야 한다. 알려진 Group/Tree/Slider/선택 상태/Frame clip 차이는 각각 수리한다. Preview/Compare는 현재 guard의 DEFERRED 경계를 유지한다.
4. G0 Pencil 5개 직접 매핑·의미 왕복, H1 data 참조, 새 format의 전체 독립 G4를 완료하고 실제 소비자 조건에서 G5 paired 예산을 측정해야 한다. 제품/Preview iframe/Publish 진입점은 Phase 4 의존 UNVERIFIED로 구분한다.

이전 턴에는 Phase 3 완료 조건을 충족하지 못해 멈췄다. 위 연속 작업 이후에도 Phase 3은 미완료이며 Phase 4 cutover와 제품 entry 교체는 시작하지 않았다.

## Phase 3 코드 catalog read-only library 경계 (2026-09-28, 진행 중)

**판정: G3 FAIL, G4 부분검증, G5 문서 byte 5/5 부분 PASS·전체 UNVERIFIED; Phase 4 진입 불가.** 이 단락은 기존 G0 동결 출력, Slot 9/9 높이·두 국소 수리, HC6 ≤0.001을 변경하지 않는다. Slot 9건의 CSS–Skia 점선/둥근 모서리 비텍스트 diff **0.024899–0.079750**은 모두 FAIL이다.

| 계약                          | 이번 실제 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 판정·남은 공백                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| §3.2 library source inventory | [재현 스크립트](../../../apps/builder/scripts/adr248-phase3-code-catalog-inventory.ts)를 `pnpm exec tsx scripts/adr248-phase3-code-catalog-inventory.ts`로 Builder cwd에서 실행했다. [출력](248-phase3-code-catalog-inventory.json)에 source 파일 SHA, `componentCatalog` 등록 184개/고유 125 type, rule 129 type, 합집합 **130 type**과 1,333축·14 role을 type/축/role별로 기록했다. 축 source는 정확한 rule key 807, rule family만 확인 468, 미확인 58이다. 이는 **source 분류**이며 소비자 PASS가 아니다. 등록 없는 rule-only는 Group·Image·MenuItem·TabPanel·TabPanels, rule 없는 등록은 IconButton이다.                                                                                                                                                                                                                                                                                                    | 130/1,333/14의 분류 재현 PASS; 실행 coverage 전체 UNVERIFIED.                                                     |
| §3.2 immutable library        | [read-only builder](../../../packages/shared/src/catalog/document/codeCatalogLibrary.ts)는 실제 `componentCatalog` primitive binding과 `COMPONENT_RULES_TABLE`, theme token resolver에서 Text·Heading의 typed children/size, color/fontSize/lineHeight/fontWeight/radius만 파생한다. `lib:definition:*` 2개, token 9개, `libraryContractVersion=1`, SHA-256 content/theme fingerprint를 [unit](../../../packages/shared/src/catalog/document/__tests__/codeCatalogLibrary.test.ts)에서 검증했다. 기존 fixture의 frame/rectangle/group/slot 4개는 **별도 fixture 유산**으로 사용했고 code-derived 2개로 세지 않는다. library는 프로젝트 graph 저장 payload에 넣지 않는다. Button은 variant/fillStyle/staticColor/state·RAC/Canvas 전체 binding 미확정이라 등록하지 않는다.                                                                                                                                       | Text/Heading 기본·size 축의 새 독립 library 경계 부분 PASS; 나머지 type·시각축은 미등록/UNVERIFIED.               |
| 공개 조작→실제 소비           | 같은 G0 `adr248-structural-baseline-v1`/hash `487150e0…`의 공개 insert 순서로 [독립 driver](../../../apps/builder/src/builder/catalogRuntime/__tests__/phase3RealConsumers.test.tsx)를 실행했다. [결과](248-phase3-code-catalog-consumer.json)는 old/new Text geometry `(180,0,160,40)` 동일, source-derived `#171717`/16px/1.5/400, Rust layout input, 기존 renderCommands의 Text DRAW와 [새 scene PNG](248-phase3-code-catalog-text-scene.png), 실제 [Chromium 격리 DOM](../../../apps/builder/tests/parity/adr248CatalogRealDom.browser.test.ts)의 RAC Group role/ARIA·row/gap과 Text 16/24px·색/weight를 고정한다. 추가 Heading insert는 transaction→resolver→Rust `(160×40)`→Canvas Text DRAW→격리 정적 Group/Heading semantic을 실행했으나 직접 old G0 Heading oracle 0이다. 같은 HEAD·viewport 1440×900·DPR1·font/theme/seed를 기록했고 old production ↔ new Vitest 실행 module identity는 UNVERIFIED다. | Text base geometry 부분 PASS; Heading old/new parity UNVERIFIED. 실제 Canvas/DOM 전체 scene·pixel 비교 PASS 아님. |
| composite 등록                | `componentCatalog` reusable 등록은 60 type에 걸쳐 있지만 origin은 `reusableId`→구 Components page canonical 데이터이고, 현재 독립 builder는 이를 typed `LibraryTemplateNode`로 읽는 계약을 갖지 않는다. Group은 rule-only native 구조와 기존 RAC Group의 실제 조합 소비를 검증했으나 **등록 composite definition PASS로 세지 않는다**. 구 canonical 문서를 읽어 새 template로 바꾸는 영구 adapter 없이 source template·slot/region 책임과 실행 binding을 확정해야 한다. [inventory](248-phase3-code-catalog-inventory.json)의 type별 `REUSABLE_ORIGIN_NOT_TYPED_LIBRARY_TEMPLATE`/`NO_COMPLETE_TYPED_VISUAL_AND_CONSUMER_BINDING`을 따른다.                                                                                                                                                                                                                                                                     | 요청한 등록 composite 1개 old/new G3는 미충족. 빈 렌더 fallback/가짜 template 없음.                               |
| delta·G4·G5                   | 기존 leaf 60/600/5k 변경 record 경로와 무관 통지 0의 계측은 아래 선행 근거와 `phase3DeltaScale.test.ts`를 재사용한다. Pencil 유효 3개/결손 2개 명시 오류 및 byte 5/5도 유지한다. 동형 전체 소비자가 없어 paired p95·heap·bundle 수치를 만들지 않았다.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | leaf 한정 PASS, G4 부분검증, G5 전체 UNVERIFIED.                                                                  |

`buildCodeCatalogLibrary()` 자체는 code-derived Text·Heading **2 definition만** 반환한다. Frame/Group/Slot 등이 필요한 G0 대표 실행은 [test-entry fixture 조립](../../../apps/builder/src/builder/catalogRuntime/__tests__/support/codeCatalogFixtureLibrary.ts)에서 기존 native fixture 4개를 합쳤다. [실행 JSON](248-phase3-code-catalog-consumer.json)은 순수 source library와 조립된 scenario library의 revision을 구분한다. native fixture를 catalog source 이전 완료로 계산하지 않는다.

같은 [source-derived Text 실행](248-phase3-code-catalog-consumer.json)에서 leaf `children` 편집을 추가 계측했다. `changedIds`는 Text 1개, graph entries 순회·table clone·full serialize 0, record 교체 1, layout 입력 방문 1, 무관 Canvas/DOM 통지 0이다. 이는 독립 root의 leaf 경계만 입증하며 전체 G5 paired 성능 검증은 아니다.

검증: Phase 2+3 scoped Vitest **38/38**, shared G1+새 library **32/32**, Chromium 격리 DOM **5/5**, scoped ESLint·Prettier·`pnpm run codex:typecheck`·`pnpm run codex:guard`·Builder build PASS. 제품 소스의 새 runtime/library import 및 최신 `dist`의 새 root marker 검색 0, HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, 별도 staged 삭제 132개 보존. 기존 Builder WebKit smoke는 제품 경로 불변이라 선행 실행 근거를 유지하고 이번 턴에는 재실행하지 않았다.

[coverage manifest](248-phase3-coverage.json)의 Text·Heading `sourceDerivedFieldEvidence`는 children/size/color/fontSize/lineHeight/fontWeight/radius(및 Text placement+size)의 **old G0 필드 oracle 유무와 새 소비 결과를 별개 값**으로 둔다. Text의 구 PNG만으로 글꼴·색 필드 수치를 소급 PASS시키지 않았고 Heading은 직접 old G0 oracle 부재를 기록했다. type 전체 PASS는 **0**, Slot/Group FAIL과 나머지 UNVERIFIED를 유지한다. 14 role에는 새 semantic/visual PASS가 없다. 현재 test entry 외 제품 entry/barrel/store/history/panels/old mutation/import graph, `incrementalDocuments.ts`, `apps/publish`를 수정하지 않았다.
