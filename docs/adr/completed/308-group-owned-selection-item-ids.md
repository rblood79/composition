# ADR-308: 선택은 그룹이 저장한다 — 항목 `id` 보장 · 그룹 선택 속성 · 항목 `isSelected` 삭제

## Status

Implemented — 2026-11-12 (G3 통과 · `### Live Exercise` 참조. Accepted 같은 날 — 사용자 `/execute-adr 308` + [reviews/308](../reviews/308.md) round 2 pending 0 · HIGH 전부 fixed)

> **Phase 3 닫힘 (2026-11-12)**: 항목 `isSelected` 계약 (`ITEM_SELECTED_PROP_CONTRACT`) 과 Radio `isSelected` 삭제 — `isSelected` 는 단독 state 4 type (Card · Checkbox · Switch · ToggleButton) 에만. 계약 64 (사용자 결정 1 (a)). Code 보기 — 항목은 `id=` 를 한 번만 (R6), 그룹 값 · 항목 `id` 왕복. 결함 3 수리: Value 칸 선택지가 `{label}` (항목의 template 바인딩) 으로 나옴 · Code 보기가 쓴 배열 (`defaultSelectedKeys={['a']}`) 을 되읽지 못함 · 표시 상태 표본 시험의 기대값. G3 — (a) `propSectionConsistency` (b) `adr308CodeView` 4 (원복 RED 3) (c) Builder +1,655 · Preview −1 B (d) type-check · shared · builder 스위트 (e) live. 상세: breakdown §6.

> **사용자 결정 1 (2026-11-12, Phase 3 착수 전 AskUserQuestion)**: (a) 계약 번호를 올린다 (권고안) — LIBRARY_CONTRACT_VERSION 63 → 64, 계약 63 프로젝트는 열리지 않는다. ADR-306 은 다음 번호 (65) 를 쓴다.

> **Phase 0 닫힘 (2026-11-12)**: G0 — 설치 S2 · RAC 타입 표 = breakdown §2 (Table 펼침 행만 삭제 — 빌더에 중첩 Row 없음). 문서 정의는 이미 Tabs · ListBox · GridList · TagGroup · Menu · Table · Tree 의 선택 키를 받고 (`ruleDefinition.ts` `COLLECTION_KEY_ACCEPTS`), Row · Card · ToggleButton · Disclosure 는 `id` 를 받지 않는다 (Phase 1 대상). 바운드 컬렉션은 정적 항목과 섞이지 않는다 (행 항목 `id` = 행 key). key 출처 표에서 판정 함수와 다른 출처 넷 (SegmentedControl 대체값 · Row HTML id · 그룹 ToggleButton · Accordion Disclosure record id). 번들 기준선 Builder 1,522,678 · Preview 151,352 B — HEAD 가 이미 ADR-201 상한 초과 (이 ADR 이전). 상세: breakdown §6.

> **Phase 2 닫힘 (2026-11-12)**: 선택 · 펼침을 그룹이 저장하고 Canvas · DOM · dispatcher 가 판정 함수 하나 (`runtime/groupSelection.ts`) 를 읽는다. 패널 = 그룹 Value 구획의 칸 하나 (단일 드롭다운 · 다중 · 펼침 체크 목록, 데이터 연결은 표본 행 key) + 항목 Content 「Item ID」 (key 변경 → 그룹 값 · TabPanel 짝 같은 명령), 항목 Selected 숨김. G2 — (a) 11 그룹 × 값 4 종 Canvas = RAC oracle · HTML id 를 단 Row · ToggleButton (b) 10 사례 편집 · Undo · Redo = 새 bind (c) 남은 항목 읽기 19 자리 목록화 · 옛 집계 함수 0 (d) live ToggleButtonGroup · CardView · Accordion (e) Do 행렬 3 (f) Tab key 변경 · 삭제 정리. 결함 2 수리 (단일 ToggleButtonGroup 에 key 문자열 · ComboBox 옵션 의존). 원복 RED r1 13 · r2′ 2 · r3 3 · r4 1 · r5 1. 상세: breakdown §6.

> **사용자 결정 2 · 3 · 4 (2026-11-12, Phase 2 착수 전 AskUserQuestion)**: 2 = (a) 항목 Content 구획에 「ID」 칸 · 3 = 단일 선택은 항목 드롭다운, 다중 선택 · 펼침은 항목 체크 목록 · 4 = (a) 데이터 연결 그룹의 선택지는 표본 행 key. 셋 다 권고안.

> **Phase 1 닫힘 (2026-11-12)**: G1 — 16 그룹의 Library 원본 항목이 모두 작성 key 를 갖고 그룹 안에서 겹치지 않는다 · 그룹 binding 14 가 S2 선택 · 펼침 속성을 받는다 (숨김 — Select `value` 는 새 값 형 `selectionValue`) · (b) 16 그룹에서 같은 그룹 안 복제 · 붙여넣기 뒤 key 중복 0 (`adr308SelectionItemKeys.test.tsx` 53, 원복 RED 14 · 2 · 5). 결함 2 수리 — 자식 있는 TreeItem 복제의 자식 key 중복 (이 ADR 이전부터) · CheckboxGroup 이 `value` 를 받게 되자 「검색 추가」 변수의 시작값 `null` 로 Preview 가 멈춤 (`null` = 빈 선택). live: ToggleButton · Card 복제 → Code 보기 · Preview RAC key 고유, 콘솔 0. 선택 동작 변화 0.

- 사용자 요청: `/create-adr` (2026-11-12, 「커밋후 /create-adr」 — Design 패널 「Value」 구획 커밋 `ea02e5f33` 뒤).
- 방향을 정한 사용자 원문 (같은 날 대화 순서대로):
  - 「선택을 그룹과 항목 중 어느것에 맞추는것이 현재 빌더 구조와 개념상 더 맞나」
  - 「props 가 구현되지않아서 그런것 아닌가?」 — 항목 `id` 가 구현되지 않아 선택이 항목에 저장됐다는 지적.
  - 「해당방법은 레퍼런스 권장방법인가? 또한 컴퍼넌트 조합에서도 사용가능한 props 를 상속가능한 것인가」
  - 「react-aria/mergeProps 이기능도 있지않나」
  - 「진행해」 — 방향 (항목 `id` 구현 → 그룹이 선택 저장 → 항목 `isSelected` 삭제) 승인.
- 확정 전제 3 (구현 중 다시 묻지 않는다): ① 선택의 저장 자리는 그룹이다 ② 항목의 key 는 레퍼런스의 `id` (Radio · Checkbox 는 `value`) 다 ③ 옛 문서의 값을 새 자리로 옮기는 코드는 넣지 않는다 (개발 단계 규칙).
- 조사로 바뀐 점 (사용자에게 보고함): 「`id` 를 비우면 노드 id 를 key 로」 는 기각 — 대안 C 참조. 작성한 `id` 만 key 로 쓴다.
- 2026-11-12 Codex 판독 round 1 (사용자 「Codex에 ADR-308 리뷰 요청해」 → 「지적내용 수장반영해」): HIGH 5 · MEDIUM 1 — 6건 모두 코드로 확인하고 본문 · breakdown 에 반영 (F19 ~ F23 · Decision 1 · 3 · 7 · R4 · R5 · R9 · R10 · G1 · G2). 기록: [reviews/308](../reviews/308.md).
- 분리 (fork) 아님: 선행 ADR 의 잔여 작업을 떼어낸 것이 아니라 새 결정이다. 선행 결정과의 관계는 Context §선행 결정.

## Context

### 도메인

- **D2 (Props/API)** 가 주 대상이다. 선택 · 펼침의 prop 이름과 소유자를 설치된 S2 · RAC 표면에 맞춘다 — 그룹의 `selectedKeys` · `selectedKey` · `value` · `expandedKeys`, 항목의 `id` · `value`. 항목 `isSelected` 는 S2 · RAC 의 컬렉션 항목에 없는 composition 확장 (`d2Provenance.ts`) 이었다.
- **D1 (DOM/접근성)** 무변경. RAC 가 그룹 state 로 항목의 `aria-selected` · `data-selected` 를 낸다 — 지금도 그렇고, 그룹에 넘기는 값의 출처만 바뀐다.
- **D3 (시각 스타일)** 무변경. 항목의 선택 모양은 rule 의 `isSelected` 조건 가지 그대로다 — Canvas 가 그 조건 값을 어디서 읽는지만 바뀐다 (항목 prop → 그룹 값).
- 경계 교차 없음. Canvas · DOM 두 consumer 가 같은 판정 함수를 읽어야 한다는 D3 대칭 원칙이 Gate 의 기준이다.

### 문제

Design 패널에서 「지금 선택된 것」 을 정하는 칸이 컴포넌트마다 다른 자리에 있고, 일부 컴포넌트에는 아예 없다. 원인은 저장 자리다 — 빌더는 선택을 **항목 노드의 `isSelected`** 에 저장하고 그룹의 선택 값을 항목들에서 모아 만든다. 레퍼런스는 반대다 (그룹이 항목 `id` 의 집합을 갖는다).

### 코드 사실 (main `ea02e5f33` 실측)

| #   | 사실                                                                                                                                                                                                                                                                                                                                                      | 근거                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 레퍼런스: 「All items in a collection must have a unique id, which is used for selection」 — 항목은 `id`, 그룹은 `selectedKeys={[…]}`                                                                                                                                                                                                                     | `.claude/skills/react-aria/references/guides/collections.md:118-120,171-176`                                                                                        |
| F2  | S2 그룹의 선택 속성: Tabs · SegmentedControl · ComboBox = `selectedKey` 쌍 / ListView · TableView · TreeView · TagGroup · Menu · CardView · ToggleButtonGroup · SelectBoxGroup = `selectedKeys` 쌍 / Picker · RadioGroup · CheckboxGroup = `value` 쌍 / TreeView · TableView · Accordion = `expandedKeys` 쌍                                              | `.claude/skills/react-spectrum/references/components/*.md` API 표                                                                                                   |
| F3  | 항목의 key 는 `resolveStaticItemKey(props, record.id)` — `props.id` 가 없으면 **record id** (`${instancePath}::${sourceId}`) 라 instance 마다 다르다                                                                                                                                                                                                      | `packages/shared/src/catalog/slotRoles.ts:363-373` · `runtime/compositionRoot.ts:622-626`                                                                           |
| F4  | 그룹이 선택 속성을 받는 binding 은 4 (Tabs `defaultSelectedKey` · RadioGroup `value` · SegmentedControl · SelectBoxGroup). ListBox · GridList · Tree · Table · TagGroup · CardView · Menu · Select · ComboBox · ToggleButtonGroup · CheckboxGroup 은 받지 않는다                                                                                          | `packages/shared/src/catalog/bindings/*.binding.ts`                                                                                                                 |
| F5  | 항목 `isSelected` 계약 12 type: `ITEM_SELECTED_PROP_CONTRACT` (TreeItem · ListBoxItem · SelectBox · Row · Tab · GridListItem · MenuItem) + 직접 선언 (Tag · Card · Radio · Checkbox · ToggleButton)                                                                                                                                                       | `document/itemLinks.ts:43-47,91` · 각 binding                                                                                                                       |
| F6  | 그룹 값은 항목에서 모은다 — `catalogStateSourceValue` 가 Tabs · SelectBoxGroup · ToggleButtonGroup · TagGroup · CardView · 그 밖 컬렉션 · Select · ComboBox · CheckboxGroup · RadioGroup 가지마다 항목 `isSelected` 를 읽는다                                                                                                                             | `runtime/delegatedDom.runtime.ts:4124-4273,547-577` · `document/collectionItems.ts:88-97` · `runtime/pickerSelection.ts:71-85`                                      |
| F7  | Canvas 도 항목 prop 에서 읽는다 — `catalogCollectionItemSelected` · `catalogRadioGroupValue` · `catalogStateValue` 의 `isSelected` 가지, rule 칠은 `...node.props` 로 시작                                                                                                                                                                                | `runtime/presence.ts:514-549,3910-3920,3927-3974` · `runtime/rulePaint.ts:304,322-330`                                                                              |
| F8  | 그룹 DOM 렌더 9 자리가 항목 변화를 감시한다 (`watchesChildren`) — 그룹 state 가 항목 prop 에 의존해서다                                                                                                                                                                                                                                                   | `runtime/delegatedDom.runtime.ts:1851,3105,3157,3320` 외                                                                                                            |
| F9  | 패널의 그룹 칸 2 (Tabs 「Selected tab」 · RadioGroup 「Value」) 는 그룹에 저장하지 않는다 — 고르면 그 항목의 `isSelected` 를 쓰고 다른 항목을 끈다. 주석: 「a Tab's key can be its record identity, which the document does not keep」                                                                                                                    | `apps/builder/src/builder/catalogRuntime/singleSelection.ts:245-321` · `bindings/Tabs.binding.ts:50-60`                                                             |
| F10 | SegmentedControl 은 이미 그룹 전용이다 — `selectedKey ?? defaultSelectedKey ?? 첫 enabled 항목`, 항목 key 는 `props.id ?? sourceId ?? id`. SelectBoxGroup 은 그룹 값 우선 + 항목 fallback (혼합)                                                                                                                                                          | `runtime/segmentedSelection.ts:22-37` · `runtime/selectBoxSelection.ts:6-23`                                                                                        |
| F11 | 「+」 로 넣는 컬렉션 항목은 이미 `id: crypto.randomUUID()` 를 받고, Tab 의 TabPanel 은 그 key 를 `itemId` 로 받는다. `insertCollectionItem` 은 그룹의 `selectedKey(s)` · Tree `expandedKeys` 를 쓸 수 있다 (호출자 없음)                                                                                                                                  | `apps/builder/src/builder/catalogRuntime/itemInsert.ts:347,484` · `packages/shared/src/catalog/commands/collections.ts:326-379,473-479`                             |
| F12 | 작성한 항목 `id` 는 복제 · 붙여넣기에서 보존되고, **`COLLECTION_FAMILIES` 8 가족 (Tabs · TagGroup · SelectBoxGroup · ListBox · GridList · Menu · Breadcrumbs · Tree) 안에서만** 겹치면 개명된다 (`catalogCopiesWithFreshKeys` — 그 밖의 host 는 개명 전에 그대로 돌려준다). 놓을 때 slot 항목은 새 노드 id 로 복사되지만 props (`id` 포함) 는 그대로 온다 | `commands/collections.ts:63-105,209-215,271-301` · `commands/materialize.ts:391-406,795-818`                                                                        |
| F13 | 원본 template 항목의 `id`: ListBox · GridList · Tree · SideNav · SegmentedControl 은 있음 / Tabs (TabPanel 은 순서로 짝) · TagGroup · Menu · ToggleButtonGroup · CardView 는 없음. 그룹이 작성 id 로 항목을 가리키는 선례 = SideNav `expandedKeys: ["item-2"]`                                                                                            | `document/generated/reusableOriginLibrary.ts:2238,2460,6004,7873,8763` · `document/rangeSegmentsOrigins.ts:159,186`                                                 |
| F14 | 노드 id 를 가리키는 prop 값은 참조 색인에 없다 — `referencedIds` 는 override 주소 · `!var` · interaction 대상 등만 색인하고, `cloneNodeSubgraph` 는 props 를 그대로 복제한다                                                                                                                                                                              | `document/graph.ts:184-263` · `commands/clone.ts:23-206`                                                                                                            |
| F15 | 문서 검증은 binding 이 받지 않는 prop 을 거절하고 (`PROP_NOT_ACCEPTED`), 계약 번호가 다른 문서는 거부한다 — 「An earlier contract's document is refused, never re-mapped」 (지금 63)                                                                                                                                                                      | `document/graph.ts:1855,1933` · `document/types.ts:158-160`                                                                                                         |
| F16 | 컴포넌트 속성의 `text` · `variable` 은 대상 노드의 **prop** 을 쓰고, `boolean` 은 노드의 보임 (`enabled`) 만 바꾼다 — 항목 `isSelected` 는 컴포넌트 속성으로 연결할 수 없다                                                                                                                                                                               | `document/types.ts:1081-1125`                                                                                                                                       |
| F17 | 부모 context 로 내려오는 그룹 속성은 설치 RAC 가 `mergeProps(contextProps, props)` 로 합친다. 빌더의 slot context 전달도 같은 함수다                                                                                                                                                                                                                      | `apps/builder/node_modules/react-aria-components/dist/private/utils.mjs:100` · `packages/shared/src/catalog/runtime/domBinding.components.tsx:469`                  |
| F18 | 항목 key 와 HTML id 는 다른 자리다 — key = `props.id`, HTML id = `NodeEntry.metadata.htmlId` (DOM 은 static 항목 · TabPanel · CardView Card 에 `htmlId` 를 싣지 않는다)                                                                                                                                                                                   | `document/types.ts:1275-1281` · `runtime/domBinding.runtime.ts:4536-4587`                                                                                           |
| F19 | 항목 key 를 내는 자리가 하나가 아니다 — Row 는 HTML id 가 있으면 그것이 key (항목 key 목록 · DOM 둘 다, `withHtmlId` 가 작성 key 를 덮음) · 그룹 안 ToggleButton 은 RAC 에 record id 를 넘기고 상태 frame 도 `selectedKeys.has(record id)` · Accordion 안 Disclosure 의 key 도 record id                                                                  | `runtime/delegatedDom.runtime.ts:592-600,3232-3238,3694-3699` · `runtime/domBinding.runtime.ts:3030-3036,4576-4586` · `runtime/delegatedDom.components.tsx:124-132` |
| F20 | dispatcher 의 `stateOwnerOf` 는 수신자 id 만 바꾸고 읽기 · 쓰기는 그 Do 의 `def.prop` 그대로다 — 그룹 안 Checkbox · ToggleButton 의 check · toggle Do 는 boolean `isSelected` 를 쓴다                                                                                                                                                                     | `packages/shared/src/interactions/dispatcher.ts:781,829-832` · `interactions/concepts/toggle.ts:20-25`                                                              |
| F21 | Accordion 의 펼침은 자식 Disclosure 의 `isExpanded` 를 모아 만들고 (없으면 펼침), 단일 펼침이면 첫 후보만 남긴다. Preview 의 클릭도 자식 `isExpanded` 에 쓴다                                                                                                                                                                                             | `runtime/presence.ts:245-252` → `packages/shared/src/utils/accordionExpansion.ts:41-70` · `runtime/delegatedDom.runtime.ts:3772-3778`                               |
| F22 | Accordion binding 은 `allowsMultipleExpanded` 만 받고 `expandedKeys` 를 받지 않는다                                                                                                                                                                                                                                                                       | `packages/shared/src/catalog/bindings/Accordion.binding.ts:16`                                                                                                      |
| F23 | Tabs 의 Tab ↔ TabPanel 짝은 `panel.props.itemId === Tab key` 이고, `itemId` 가 있는 panel 은 순서 짝에서 빠진다                                                                                                                                                                                                                                           | `runtime/presence.ts:466-480`                                                                                                                                       |

### 제약

- **Hard**: initial 번들 상한 Builder ≤ 1,414,000 · Preview ≤ 327,000 B gzip (ADR-201 재승인 값, 만료 2026-11-25). `d2S2Alignment.static.test.ts` — 보이는 `accepts` 키는 설치 S2 타입에 있거나 `d2Provenance.ts` 에 있어야 한다. Preview/Publish 의 상태는 첫 render 부터 controlled (ADR-280 — `catalogControlledProps`). 문서 변환 코드 금지 (사용자 규칙 · F15).
- **Soft**: 그룹 16 type · 항목 12 type · consumer 3 (Canvas · DOM · dispatcher) 을 한 번에 건드린다. 읽기와 쓰기를 나눠 넣으면 중간 상태에서 패널이 쓴 값을 아무도 읽지 않는다.

### 선행 결정

- 2026-10-13 사용자 결정 「radioGroup, Tabs 등은 하나의 값만 선택되어야한다」 (`singleSelection.ts`): 불변식은 유지한다. 단일 선택 그룹이 key 하나를 갖는 것으로 구조가 보장하므로 「다른 항목 끄기」 처리는 없어진다.
- ADR-280 (controlled 상태) · ADR-281 (패널 = RAC 가 받는 것만) · ADR-287 (유도 Do): 그룹 개념 (선택 Do) 은 이미 그룹 소유다. 이 ADR 은 **시작 상태의 출처** 를 항목 집계에서 그룹 prop 으로 바꾼다.
- ADR-261 · 294 (컴포넌트 속성 · 입력 변수): 변경 없음. 그룹 prop 이 생기면 기존 `text` · `variable` 속성이 선택을 넘길 수 있게 된다 (F16).
- Design 패널 「Value」 구획 (`ea02e5f33`): 그룹 칸이 들어갈 자리. 「한 개념 한 칸」 규칙 (쌍둥이 속성은 받기만) 을 그대로 따른다.

## Alternatives Considered

### 대안 A: 지금 방식 확장 — 항목에 저장, 그룹 칸은 항목에 대신 쓰기

- 설명: Tabs · RadioGroup 의 방식 (F9) 을 ListBox · GridList · Select 등 나머지 그룹에도 넣는다. 그룹 칸이 고른 항목의 `isSelected` 를 쓴다.
- 근거: 저장 형식 · 읽는 쪽 변경 0. 패널 칸만 추가.
- 한계: 데이터에 연결된 목록은 항목이 틀 하나라 행을 고를 수 없다. instance 마다 다른 선택은 항목마다 override 를 따로 써야 한다. 컴포넌트 속성 · RAC context 로 선택을 넘길 수 없다 (F16 · F17). 항목 집계 12+ 자리와 `watchesChildren` (F6 ~ F8) 이 그대로 남고 그룹이 늘 때마다 늘어난다. D2 확장 (`isSelected` 12 type) 이 영구화된다.
- 위험: 기술(L) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)

### 대안 B: 그룹에 저장, key = 작성한 항목 `id` (레퍼런스 방식)

- 설명: 선택 그룹의 항목이 모두 작성 `id` (Radio · Checkbox 는 `value`) 를 갖게 하고, 그룹이 그 key 를 자기 prop 에 저장한다. Canvas · DOM · dispatcher 는 그룹 값만 읽는다 (SegmentedControl 모델 — F10). 항목 `isSelected` 는 지운다 (단독 ToggleButton · Checkbox · Switch 의 것은 RAC 자체 state 라 남는다).
- 근거: F1 · F2 (레퍼런스) · F10 (저장소 안 완성 모델) · F11 · F12 (id 부여 · 보존 · 충돌 개명이 이미 있음) · F13 (작성 id 로 가리키는 선례) · F16 · F17 (조합 경로가 열린다).
- 한계: 읽는 쪽 30여 자리와 쓰는 쪽 (패널 · 원본 기본값 · 필터 자동 생성) 을 같은 커밋에서 바꿔야 한다. 옛 문서의 항목 선택은 읽지 않는다.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(M)

### 대안 C: 그룹에 저장, key = 노드 id (`sourceId`)

- 설명: 항목 `id` 를 새로 채우지 않고 문서 노드 id 를 key 로 쓴다.
- 근거: 고유성이 자동이다. 항목 쪽 변경이 없다.
- 한계: 그룹 prop 이 노드 참조가 된다 — 색인 (`referencedIds`) · 복제 props 사상 · 붙여넣기 · detach · materialize · createComponent · swap · 삭제 정리 7 자리에 재작성을 새로 넣어야 한다 (F14). 놓을 때 항목이 새 노드 id 를 받으므로 (F12) Library 원본은 기본 선택을 표현할 수 없다 (`lib:` template 이 `project:` id 를 가리킬 수 없음). Code 보기에 `id="project:node:…"` 가 나오고, 컴포넌트 속성으로 넘기는 값이 읽을 수 없는 문자열이 된다. 레퍼런스 방식이 아니다 (F1 — `id` 는 작성자가 준다).
- 위험: 기술(**H**) / 성능(L) / 유지보수(**H**) / 마이그레이션(M)

### 대안 D: 두 자리 병행 — 그룹 값 우선, 없으면 항목 `isSelected`

- 설명: SelectBoxGroup 의 지금 방식 (F10) 을 모든 그룹에 적용한다. 옛 문서가 그대로 동작한다.
- 한계: 같은 사실의 저장 자리가 둘이다 — 패널이 어느 쪽을 보여 주고 어느 쪽에 쓰는지, 둘이 다를 때 Canvas 와 DOM 이 같은 답을 내는지를 그룹마다 지켜야 한다. 항목 집계 · `watchesChildren` · D2 확장이 모두 남는다. 「한 개념 한 칸」 결정과 어긋난다.
- 위험: 기술(M) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)

### Risk Threshold Check

| 대안 | HIGH+ | 판정                                                        |
| ---- | :---: | ----------------------------------------------------------- |
| A    |   1   | 유지보수 — 구조 한계 (데이터 행 · 조합) 는 줄일 방법이 없다 |
| B    |   0   | 통과                                                        |
| C    |   2   | 기술 · 유지보수 — 재작성 7 자리가 대안의 본체라 회피 불가   |
| D    |   1   | 유지보수 — 두 자리가 대안의 정의라 회피 불가                |

HIGH 0 인 대안 B 가 있어 루프를 돌지 않는다.

## Decision

**대안 B** 를 채택한다.

1. **항목 key = 작성한 `id`**. 선택 · 펼침 그룹의 항목 (ListBoxItem · GridListItem · TreeItem · Row · Tag · MenuItem · Tab · Card (CardView 안) · ToggleButton (그룹 안) · SegmentedControlItem · SelectBox · Disclosure (Accordion 안)) 은 작성 `id` 를 갖는다. Radio · Checkbox (그룹 안) 의 key 는 레퍼런스대로 `value` 다. Library 원본 template 의 항목과 넣기 명령이 값을 채운다. `id` 는 HTML id (`metadata.htmlId`) 와 다른 자리에 그대로 둔다 (F18). **key 를 내는 함수도 하나다** (`catalogItemKey`) — DOM 이 RAC 에 넘기는 항목 `id`, 그룹 DOM 의 항목 key 목록 · remount key, Canvas 판정, 상태 frame 의 선택 검사가 모두 이 함수를 쓴다. Row 의 HTML id 우선 · 그룹 안 ToggleButton 과 Accordion 안 Disclosure 의 record id (F19) 를 이 함수로 바꾸고, 상태 frame 의 식별자 (record id) 는 key 와 따로 둔다.
2. **그룹이 선택을 저장한다**. 속성 이름은 설치 S2 표면 (F2) 그대로, 저장은 가족의 기존 관례를 따른다 — key 선택은 `defaultSelectedKey(s)` (Tabs · SegmentedControl · SelectBoxGroup 선례), 값 선택은 `value` (RadioGroup 선례), 펼침은 `expandedKeys` (SideNav 선례). 쌍둥이 속성은 받기만 하고 패널에 내지 않는다. 읽는 순서는 controlled → default → 그룹 종류의 RAC 기본 (Tabs · SegmentedControl 은 첫 enabled 항목, 나머지는 비어 있음).
3. **읽는 곳은 판정 함수 하나**. Canvas (`presence.ts`) · DOM (`delegatedDom.runtime.ts`) · dispatcher (`catalogRuntimeStateOf`) 가 「그룹의 선택 값」 과 「이 항목이 선택됐는가」 를 같은 함수로 읽는다. 항목 `props.isSelected` · `isExpanded` 를 그룹 선택 · 펼침의 출처로 읽는 코드는 남기지 않는다. **dispatcher 는 수신자와 값을 함께 바꾼다** — 그룹 안 항목을 대상으로 한 선택 · 펼침 Do (check · uncheck · toggle · 펼치기 · 접기) 는 그룹을 수신자로 삼고, 항목의 boolean 을 그룹 값에 그 항목 key 를 넣거나 빼는 쓰기로 바꾼다 (F20 — 수신자만 바꾸면 그룹에 `isSelected` 가 기록된다). 단일 선택 · 단일 펼침은 넣기가 교체다.
4. **항목 `isSelected` 삭제**. F5 의 12 type 에서 그룹 선택 용도의 계약을 지운다. 단독 ToggleButton · Checkbox · Switch · 단독 Card 의 `isSelected` 는 RAC 자체 state 라 남는다. `showWhen: isSelected` 는 RAC render prop 이라 남고, 값은 3 의 판정 함수에서 온다.
5. **패널**. 그룹의 「Value」 구획에 칸 하나 — 선택지는 그 그룹의 항목 (key · 글자). 항목의 Selected 스위치는 없앤다.
6. **옛 문서 값은 옮기지 않는다** (확정 전제 ③). 처리 방식은 사용자 결정 1.
7. **key 를 바꾸는 쓰기는 그 key 를 가리키는 곳을 같은 명령에서 고친다**. 항목 `id` 를 고치면 그룹의 선택 · 펼침 값과 짝 TabPanel 의 `itemId` (F23) 를, 항목을 지우면 그룹 값에서 그 key 를 정리한다. 복제 · 붙여넣기의 충돌 개명은 `COLLECTION_FAMILIES` 밖의 선택 · 펼침 그룹 (CardView · Table · ToggleButtonGroup · Accordion · SegmentedControl) 과 `value` 를 key 로 쓰는 항목 (그룹 안 Radio · Checkbox) 까지 넓힌다 (F12).

### 기각 사유

- **A**: 데이터 행 선택 · instance 별 선택 · 컴포넌트 속성 · RAC context — 사용자가 물은 조합 경로 넷이 구조상 닫혀 있다. 칸을 늘릴수록 집계 자리가 는다.
- **C**: 조사 전 실행자가 권했던 안. F12 · F14 실측으로 재작성 7 자리와 Library 기본 선택 불가가 드러났고, 레퍼런스 방식도 아니다 (사용자 질문 「레퍼런스 권장방법인가?」 의 답이 「아니다」).
- **D**: 옛 문서 호환을 얻는 대신 저장 자리 둘을 영구히 맞춰야 한다. 개발 단계 규칙상 그 호환은 요구가 아니다.

### 위험 수용 근거

B 의 잔존 위험은 「많은 자리를 한 번에 바꾼다」 는 실행 위험이고 구조 위험이 아니다. 완성 모델 (SegmentedControl) 과 필요한 기반 (F11 · F12) 이 저장소에 이미 있어 새 기구를 만들지 않는다. 실행 위험은 Phase 를 읽기 준비 (동작 변화 0) → 전환 (한 커밋) → 삭제로 나누고 Gate 로 막는다.

### 사용자 결정 4건 (구현이 닿을 때 묻는다)

1. **옛 문서** (Phase 3 착수 전): (a) 계약 번호를 올린다 — 저장소 관례 (F15), 이전 계약의 프로젝트는 열리지 않는다. ADR-306 도 계약을 올리므로 순서를 맞춘다 / (b) 번호를 올리지 않고 항목 `isSelected` 를 받기만 하고 읽지 않는다 — 옛 프로젝트가 열리되 선택만 사라지고, 죽은 속성이 `accepts` 에 남는다. 권고 (a).
2. **항목 `id` 칸** (Phase 2): (a) 항목의 Content 구획에 「ID」 칸을 낸다 — 컴포넌트 속성 · 규칙 값 · Code 에서 뜻 있는 이름 (`home`) 을 쓸 수 있다 / (b) 숨긴다 (자동 값만). 권고 (a).
3. **칸 모양** (Phase 2): 단일 선택 = 드롭다운, 다중 선택 · 펼침 = 항목 체크 목록 (2026-11-12 시안 A · B 의 조합). 사용자가 「디자인 부분은 뒤에 결정」 이라 했으므로 Phase 2 착수 때 확정받는다.
4. **데이터에 연결된 그룹의 칸** (Phase 2): 행 key 는 데이터에서 온다. (a) 칸의 선택지를 표본 행의 key 로 낸다 / (b) key 를 직접 적는 글자 칸 / (c) 이번 범위에서 빼고 「데이터 연결 목록의 선택은 규칙 (Do) 으로」 안내만. 권고 (a).

> 구현 상세: [308-group-owned-selection-item-ids-breakdown.md](../design/308-group-owned-selection-item-ids-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                        | 심각도 | 대응                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Canvas 와 DOM 이 다른 항목을 선택으로 그린다 — 판정이 두 벌로 남는 경우 (`presence.ts:514-549` · `delegatedDom.runtime.ts:4124-4273` · `rulePaint.ts:304`)                                                                                                                  |  HIGH  | 판정 함수 하나 (Decision 3) + G2 (a) 그룹 16 type × 상태 행렬에서 Canvas 선택 = DOM 선택                                                                                                                    |
| R2  | 그룹 prop 을 고쳐도 항목이 다시 그려지지 않는다 — 항목 칠이 owner 값에 의존하게 되는데 dirty 확장이 빠지는 경우 (`canvasBinding.ts:1038-1039` · `presence.ts:2124-2138` · `compositionRoot.ts` 의 의존 전파)                                                                |  HIGH  | G2 (b) 편집 · Undo · Redo 뒤 증분 결과 = 새 bind (메모리 `feedback-canvas-child-painted-from-owner-needs-dirty-expansion`)                                                                                  |
| R3  | 읽기만 바뀌고 쓰는 곳이 남는다 — 패널 · 원본 기본값 · 필터 자동 생성 · materialize 가 항목 `isSelected` 를 계속 쓴다 (`singleSelection.ts` · `viewAuthoring.ts:604-672` · `materialize.ts:820-838`)                                                                         |  HIGH  | 읽기 · 쓰기 한 커밋 (Phase 2) + G2 (c) 정적 검사: 그룹 선택 용도의 항목 `isSelected` 읽기 · 쓰기 0                                                                                                          |
| R4  | 항목 key 가 한 그룹 안에서 겹친다 — 복제 개명이 8 가족에서만 돌아 (F12) CardView · Table · ToggleButtonGroup · Accordion · SegmentedControl 의 같은 그룹 안 복제는 key 가 그대로 겹치고 RAC 컬렉션이 중복 key 를 받는다. 직접 고친 id · 정적 항목과 데이터 행의 혼합도 같다 |  HIGH  | Decision 7 — Phase 1 에서 개명 범위를 선택 · 펼침 그룹 전부와 `value` 항목으로 넓힌다 (원본 항목에 id 를 넣는 Phase 와 같은 커밋). 직접 고친 값은 패널이 거절 안내. 혼합은 G0 에서 현행 동작을 기록. G1 (b) |
| R5  | 그룹 안 항목을 대상으로 한 선택 · 펼침 Do 가 그룹에 닿지 않는다 — `stateOwnerOf` 는 수신자만 바꿔 그룹에 `isSelected` 가 기록되고 `value` 는 그대로다 (F20 — `dispatcher.ts:781,829` · `concepts/toggle.ts:20`)                                                             |  HIGH  | Decision 3 — 수신자 · 값 변환을 함께 (항목 boolean → 그룹 값의 key 넣기 · 빼기). G2 (e) · `adr280Phase0.test.ts` 회귀                                                                                       |
| R9  | DOM 이 RAC 에 넘기는 항목 key 가 판정 함수의 key 와 다르다 — Row 는 HTML id, 그룹 안 ToggleButton · Accordion 안 Disclosure 는 record id (F19). Canvas 는 선택, RAC 는 미선택이 된다                                                                                        |  HIGH  | Decision 1 — key 함수 하나를 DOM 주입 · 항목 key 목록 · remount key · 상태 frame 검사가 같이 쓴다. G2 (a) 행렬에 HTML id 있는 Row · 그룹 안 ToggleButton · Accordion 을 넣는다                              |
| R10 | Tab 의 `id` 를 고치면 TabPanel 짝이 끊긴다 — `itemId` 가 옛 key 를 가리키고 순서 짝에서도 빠진다 (F23)                                                                                                                                                                      |  MED   | Decision 7 — 같은 명령에서 짝 TabPanel `itemId` 를 고친다. G2 (f)                                                                                                                                           |
| R6  | Code 보기: 항목 `id` 와 사용자 HTML id 가 둘 다 있으면 `id=` 가 두 번 나온다 (`codeView/generate.ts:3311-3312`)                                                                                                                                                             |  MED   | Phase 3 — 항목 type 은 HTML id 를 내지 않는다 (DOM 과 같게 — F18)                                                                                                                                           |
| R7  | 번들 상한 (Builder 여유가 수백 B 대)                                                                                                                                                                                                                                        |  MED   | G3 (c) 전후 측정. 집계 코드 삭제로 줄어들 것으로 추정 — 실측으로 확인                                                                                                                                       |
| R8  | 옛 문서의 선택이 사라지거나 문서가 열리지 않는다                                                                                                                                                                                                                            |  MED   | 사용자 결정 1 — (a) 면 계약 63 문서 100% 가 열리지 않고 (ADR-306 과 같은 영향), (b) 면 항목에 선택을 둔 문서만 그 선택을 잃는다. CHANGELOG 에 명시                                                          |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                                                   |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0 종료 | 설치 S2 · RAC 타입에서 뽑은 「그룹 × 선택 · 펼침 속성 × 항목 key 속성」 표가 breakdown §2 와 같다 · 항목 `isSelected` 읽기 · 쓰기 자리 목록 확정 · 번들 기준선 기록                                                                                                                                                                                                                                                                                                                                                                                                 | 표가 다르면 breakdown 을 실측으로 고친 뒤 진행 (새 ADR 사유 아님)              |
| G1   | Phase 1 종료 | 선택 · 펼침 그룹의 Library 원본 항목이 모두 작성 key 를 갖고 그룹 안에서 겹치지 않는다 (정적 테스트) · 그룹 binding 이 F2 의 속성을 받는다 (Accordion `expandedKeys` 포함, `d2S2Alignment` PASS) · (b) 선택 · 펼침 그룹 전 가족 (16) 에서 같은 그룹 안 복제 · 붙여넣기 뒤 key 중복 0 (그룹 안 Radio · Checkbox 는 `value`) · 기존 스위트 결과 변화 0                                                                                                                                                                                                                | 겹치는 원본은 id 를 고친다. 동작이 바뀌면 원인을 Phase 2 로 옮기지 않고 수리   |
| G2   | Phase 2 종료 | (a) 그룹 16 type 마다 그룹 값 → Canvas 항목 선택 = DOM 항목 선택 (단일 · 다중 · 빈 값 · 없는 key) (b) 그룹 값 편집 · Undo · Redo 뒤 증분 = 새 bind (c) 정적 검사: 그룹 선택 용도의 항목 `isSelected` 읽기 · 쓰기 0 (d) live — 가족별 1 type 씩 패널에서 고르고 Canvas · Preview · 새로고침 확인, 콘솔 오류 0 (e) 그룹 안 항목 대상 Do 행렬 — check · uncheck · toggle · 펼치기 · 접기 실행 뒤 그룹 값에 key 가 들고 나며 항목 prop 에는 쓰이지 않는다 (단일 · 다중) (f) Tab `id` 변경 뒤 선택 Tab 의 panel 이 그대로 보인다 · 항목 삭제 뒤 그룹 값에 그 key 가 없다 | (a) (b) 실패는 판정 함수 · dirty 확장 수리. 한 가족만 실패해도 커밋하지 않는다 |
| G3   | Phase 3 종료 | (a) 항목 `isSelected` 계약이 단독 state 4 type 에만 남는다 (b) Code 보기 왕복 — 그룹 값 · 항목 `id` 가 한 번씩 나오고 다시 읽힌다 (c) 번들 ≤ ADR-201 상한 (d) `pnpm type-check` · shared · builder 스위트 (e) live — 새 프로젝트에서 Tabs · ListBox · Select · CheckboxGroup · ToggleButtonGroup                                                                                                                                                                                                                                                                    | (c) 초과는 사용자에게 상한 재승인 요청                                         |

측정 조건 (`measurement-validity.md` §1): G2 (a) 의 기준값은 설치 RAC 가 그 그룹 값으로 내는 `data-selected` 다 (외부 oracle — Canvas 판정과 독립). 불리한 경우를 행렬에 넣는다 — 그룹 값에 없는 key · 빈 값 · instance 안의 그룹 (override 로 다른 값) · 정적 항목과 데이터 행의 혼합 · 중첩 그룹 (Tabs 안 ListBox) · HTML id 를 단 Row · 그룹 안 ToggleButton · Accordion 단일 펼침 (뒤 항목만 펼친 값). G2 (b) 의 대조군은 같은 문서의 새 bind 다.

HIGH 위험 R1 → G2 (a), R2 → G2 (b), R3 → G2 (c), R4 → G1 (b), R5 → G2 (e), R9 → G2 (a). 집행은 로컬 테스트 스위트 + `pnpm type-check` (Stop hook) + live 이다.

### Live Exercise

**실행자 (2026-11-12, Chrome MCP — 사용자 Chrome · dev 서버 5173)**

| Phase | 프로젝트                               | 시나리오                                                                                                                                        | 결과                                                                                                                                            |
| ----- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `adr308-p1-live` (새 프로젝트)         | ToggleButtonGroup · CardView 의 항목 ⌘D → Code 보기 · Preview RAC `data-key`                                                                    | PASS — key 고유 (`toggle-1` · 새 key · `toggle-2` / `card-1` · 새 key · `card-2` · `card-3`)                                                    |
| 2     | `adr308-p1-live`                       | ToggleButtonGroup 「Selected items」 Toggle 2 · CardView 체크 목록 두 줄 · Accordion 「Expanded items」 Section 2 → Canvas · Preview · 새로고침 | PASS — Canvas 칠 = Preview `aria-pressed` · `aria-selected` · 펼침, 새로고침 뒤 유지                                                            |
| 3     | `adr308-p3-live` (계약 64 새 프로젝트) | Tabs 「Selected tab」 Tab 2 → Code 보기 · Preview                                                                                               | PASS — `<Tabs defaultSelectedKey="tab-2">` · `<Tab id="tab-1">` · `<TabPanel itemId="tab-1">`, Preview Tab 2 선택                               |
| 3     | `adr308-p3-live`                       | CheckboxGroup Value 체크 목록 Option 2 → Canvas · Publish                                                                                       | PASS — Canvas Option 2 체크 · Publish `checked` [false, true]                                                                                   |
| 3     | `adr308-p3-live`                       | Select Value 드롭다운 → Cat → Publish · 새로고침                                                                                                | 첫 관찰 FAIL (선택지가 `{label}`) → 수리 뒤 PASS — 선택지 Aardvark · Cat · Dog · Kangaroo, Publish `SelectValue` 「Cat」, 새로고침 뒤 칸 값 Cat |

| 3 | `adr308-p3-live` | ListBox 놓기 → 「Selected item」 (단일 — 선택지 칩) Starred → Selection mode Multiple → 「Selected items」 체크 목록에 Starred 유지 · Archive 체크 → Canvas · Publish | PASS — Canvas Starred · Archive 칠, Publish `aria-selected` inbox false · starred true · archive true |

콘솔 오류 0 (세 Phase 모두). 남은 비대칭 (이 ADR 이전부터): Canvas 의 Select trigger 는 선택한 항목 글자가 아니라 늘 placeholder 를 그린다 — SelectValue template 이 `{placeholder}` 에 묶여 있고 선택 글자를 넣는 Canvas 경로가 없다 (HEAD 동일). ToggleButtonGroup 은 Phase 2 live, 나머지 가족은 G2 (a) 단위 시험 (설치 RAC oracle) 으로.

## Consequences

### Positive

- Design 패널: 선택 · 펼침 칸이 모든 그룹의 「Value」 구획 한 자리에 생긴다 (지금 칸이 없는 ListBox · GridList · Table · Tree · TagGroup · Menu · CardView · Select · ComboBox · CheckboxGroup · ToggleButtonGroup · Accordion 포함).
- instance 마다 다른 선택이 그룹 prop override 하나로 된다. 컴포넌트 속성 (`text` · `variable`) 과 RAC context 로 선택을 넘길 수 있다.
- Code 보기가 레퍼런스 코드와 같은 모양이 된다 (`<Tabs defaultSelectedKey="home">` · `<Tab id="home">`) — 지금은 `<Tab isSelected>`.
- 항목 집계 12+ 자리 · `watchesChildren` · `singleSelection.ts` 의 「다른 항목 끄기」 가 없어진다. D2 확장 `isSelected` 가 8 type 에서 빠진다.

### Negative

- 옛 문서의 항목 선택은 사라진다 (또는 문서가 열리지 않는다 — 사용자 결정 1).
- Phase 2 는 소스 40여 자리 (판독 round 1 로 key 출처 · dispatcher 변환 · Accordion 추가) · 테스트 13 파일 이상을 한 커밋에서 바꾼다.
- 항목마다 `id` 가 생겨 Code 출력과 문서 크기가 조금 는다 (항목당 prop 1).
- 사용자가 `id` 를 직접 고치면 그룹의 key 가 가리키는 항목이 없어질 수 있다 — 패널이 같은 명령에서 그룹 값을 따라 고쳐야 한다 (breakdown Phase 2).
