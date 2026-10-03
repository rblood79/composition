# ADR-251: RadioGroup · CheckboxGroup 항목 묶음을 문서 노드로 복원 (RadioItems · CheckboxItems)

## Status

Accepted — 2026-10-03 (사용자 `/execute-adr 251` — 리뷰 round 2 이슈 0 · [reviews/251.md](reviews/251.md), 대안 A · contract 2 는 사용자 결정 기록). **P0 ~ P5 구현 · G0 ~ G4 통과 · main 1회 병합 (2026-10-03, Decision 7 — 사용자 「커밋 + main 병합」)**. Implemented 승격은 Preview 사용자 확인 뒤. 실행 기록: [breakdown §6](design/251-radio-checkbox-items-node-restore-breakdown.md).

<details><summary>이전 상태</summary>

Proposed — 2026-10-03

</details>

사용자 요청: `/create-adr RadioItems 노드 복원 (a)로 진행` (2026-10-03). 방향은 2026-09-29 에 사용자가 정했다 — 「보기에도 직관적인 것은 A」 (항목 묶음을 TagGroup > TagList 처럼 트리의 실제 노드로 둔다). 저장 포맷은 같은 요청의 (a) — library contract version 을 올리고 기존 개발용 프로젝트는 거부한다.

이 ADR 은 ADR-912 가 커밋 `9c0e15446` (2026-06-14) 으로 실행한 「CheckboxItems / RadioItems 중간 컨테이너 폐기」 를 뒤집고, [ADR-103](completed/103-checkbox-radio-items-justification.md) 이 정당화했던 3단 구조 (`Group > Items > 항목`) 로 돌아간다. 뒤따르는 Design 패널 통합 ADR 의 선행이다.

> **2026-10-03 리뷰 round 1 반영** ([reviews/251.md](reviews/251.md), Codex — HIGH 3): ① template 만 main 에 올리면 DOM 항목이 사라진다 → 구조 전환 전체를 main 1회 병합으로 (Decision 7) ② 일반 collection 삽입은 Radio · Checkbox 계약과 맞지 않는다 → 그룹 전용 삽입을 유지하고 위치만 묶음으로 (R3 HIGH · G3) ③ prop 없는 묶음은 size 전달을 끊는다 → size 를 내부 운반 값으로 선언 (Decision 2 · R1). 세 건 모두 코드에서 확인했다. 대안 A 와 contract 2 는 그대로다.

## Context

### 문제 — 상자는 하나인데 축은 둘

RadioGroup · CheckboxGroup 은 layout 축 prop 을 둘 받는다. binding 전체에서 이 둘뿐이다.

- `labelPosition` (top / side) — Label 과 항목 묶음의 배치
- `orientation` (vertical / horizontal) — 항목끼리의 배치

DOM 은 이 두 축을 두 상자에 나눠 싣는다. 그룹 root 가 `labelPosition` 을, 그 안의 `div.radio-items` 가 `orientation` 을 맡는다. 그런데 문서 트리에는 두 번째 상자가 없다.

| 층                  | 현재                                                                                                                                                  | 코드                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| library template    | `component-radiogroup` 의 자식 = Label · Radio · Radio (직속). CheckboxGroup 도 같다                                                                  | [reusableOriginLibrary.ts:3777](../../packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts) · `:3700`                                            |
| 비교 — TagGroup     | 자식 = Label · **TagList** (실제 template 노드) > Tag ×4                                                                                              | 같은 파일 `:5731` · `:5762`                                                                                                                                         |
| Canvas              | 묶음 상자를 합성 part `${node.id}::part:items` 로 투영한다. record 가 아니라서 그려지지도, 선택되지도 않는다                                          | [presence.ts:423-447](../../apps/builder/src/builder/catalogRuntime/presence.ts) `catalogComposedParts`                                                             |
| Canvas 값의 출처    | 부모 rule 의 `containerVariants.orientation[…].nested` 중 `.radio-items` 블록 + size 별 `--radio-items-gap`                                           | [rulePartRules.ts:1261-1330](../../packages/shared/src/catalog/document/rulePartRules.ts) `catalogItemsWrapper` · `componentRulesTable.ts:9374-9500`                |
| DOM                 | `delegatedDom` 이 `div.radio-items` 를 만들어 children 으로 넘기고, shared `RadioGroup` 이 children 을 한 번 더 감싼다 (코드상 이중 — live 확인은 G0) | [delegatedDom.tsx:1085](../../apps/builder/src/builder/catalogRuntime/delegatedDom.tsx) · [RadioGroup.tsx:350](../../packages/shared/src/components/RadioGroup.tsx) |
| Layers              | Label · Radio 행만 보인다. 묶음 행은 없다                                                                                                             | `positions.ts:223` `childPositions`                                                                                                                                 |
| Styles 의 Direction | RadioGroup 을 선택하면 `labelPosition` 만 쓴다. `orientation` 은 Properties 로만 닿는다                                                               | [orientationDrivenTags.ts](../../apps/builder/src/builder/panels/styles/utils/orientationDrivenTags.ts) · `useStyleActions.ts:183-200`                              |

결과: 사용자는 Layers 에서 Label 과 Radio 가 형제로 놓인 것을 보는데, 화면에서는 Radio 들만 따로 가로로 늘어선다. Direction 토글 하나가 두 축 중 하나만 가리키고, 나머지 축은 다른 패널에 있다. 이 경계에서 난 결함 커밋이 4건이다 (`b8f6788e8` · `84a7a8d12` · `805db0d1b` · `3b281b211`).

### 이력

- ADR-093 · 103 (2026-04): `Group > Items > 항목` 3단 구조를 정당화했다. 근거는 「Label 과 항목 집합의 flex 분리」 였다.
- ADR-912 `9c0e15446` (2026-06-14): react-aria-starter 예제 구조를 따라 Items 노드를 폐기하고 wrapper 를 DOM 렌더러 안으로 옮겼다. 같은 커밋이 「Skia synthetic wrapper 합성 필요」 를 후속으로 남겼다.
- ADR-248 Phase 3 `cb36b6a95`: 그 후속이 `catalogComposedParts` (비-record Rust 노드) 로 들어왔다.
- 2026-09-29: starter 스냅샷을 저장소에서 제거했고 D1 정본은 설치된 `react-aria-components` 로 명시됐다. 설치된 1.21.0 의 `RadioGroup` 은 `div.react-aria-RadioGroup` 하나에 children 을 그대로 넣는다 — 항목 묶음 컴포넌트가 없다. 반면 `TagList` 는 RAC 공개 컴포넌트다.

즉 `.radio-items` 는 RAC 구조가 아니라 composition 이 children 자리에 넣은 자체 상자다. 지금은 그 상자가 DOM 에만 있고 문서에는 없다.

### Domain (SSOT 3-domain)

- **D3 시각 스타일 (본체)**: 항목 묶음은 layout 상자다 (flex 방향 · gap). 값의 정본은 지금처럼 catalog rule (부모 rule 의 orientation · size 블록) 하나다. 이 ADR 은 값을 바꾸지 않고, 그 값을 받는 상자를 문서 노드로 만든다.
- **D1 DOM/접근성**: RAC `RadioGroup` · `CheckboxGroup` 의 DOM · ARIA · 키보드는 변경 0. `div.radio-items` 는 RAC 가 받는 children 안의 상자라 RAC DOM 재작성이 아니다. role 을 붙이지 않는다.
- **D2 Props/API**: `orientation` · `labelPosition` 은 계속 그룹의 prop 이다 (RAC · RSP 규정). 묶음 노드에 새 prop 을 만들지 않는다.

Generator 선언 (ADR 작성 규칙 #2): 생성 CSS 는 이미 자식 selector 를 내보낸다 (`generated/RadioGroup.css:88-99` `.react-aria-RadioGroup[data-orientation="…"] .radio-items`). 이 ADR 은 그 출력을 바꾸지 않는 것을 조건으로 둔다 (G4).

### 제약

- **hard — 시각 계약**: ADR-248 G3 수치를 그대로 지킨다. Canvas ↔ DOM geometry ≤ 1 CSS px, 비텍스트 픽셀 차이 ≤ 0.001.
- **hard — 저장 포맷**: template 위치 id 가 바뀐다 (`lib:template:component-radiogroup__2` 가 Radio → 묶음 노드). ADR-248 본문 99행은 「충돌하는 구조 변경은 지원 버전 검사로 실패시키고, override 가 가리키던 template ID 를 자동 재해석하거나 조용히 버리지 않는다」 이다. 사용자 판정 (a): `LIBRARY_CONTRACT_VERSION` 1 → 2.
- **hard (BC 수식)**: 보존 대상 프로젝트 0 (ADR-248 전제, 사용자 재확인). contract 1 로 저장된 개발용 프로젝트는 **전부** 열리지 않는다 (`UNSUPPORTED_LIBRARY_CONTRACT`). 변환 · 재직렬화 0 파일.
- **hard**: `apps/publish` 수정 0 · Preview 부팅 JS 에 새 의존 0 (ADR-201 initial 상한) · Skia 전용 시각 효과 0.
- **soft**: Compare Mode / Preview iframe 은 모델이 열지 않는다 — Preview 는 unit + 사용자 확인.

## Alternatives Considered

외부 사례:

- Figma auto layout — frame 하나는 방향을 하나만 가진다. 두 축이 필요하면 frame 을 중첩하고, 중첩된 frame 은 레이어 목록에 보인다.
- Webflow — Radio Button 은 wrapper 요소이고 그 안의 input · label 이 Navigator 에 각각 노드로 나온다. 화면에 있는 상자는 트리에도 있다.
- React Spectrum — `RadioGroup` · `CheckboxGroup` 구현이 항목용 상자를 따로 둔다: v3 는 Field 안의 `div.spectrum-FieldGroup-group`, S2 는 RAC 루트 안에서 Label · 항목 상자 (`gridArea: input`, orientation 별 flex 방향) · HelpText 가 형제다 (G0 2026-10-03, GitHub main 소스 확인). 설치된 RAC 1.21.0 은 루트 div 하나에 children 을 바로 넣는다.
- composition 자체 선례 — TagGroup > TagList > Tag. TagList 는 template 노드이고 Layers 에서 선택된다.

### 대안 A: 묶음을 실제 template 노드로 복원 + contract version 2 (사용자 선택)

- 설명: `RadioItems` · `CheckboxItems` definition 을 등록하고, template 을 `Label + Items > 항목` 으로 바꾼다. 묶음의 layout · gap 은 지금 `catalogItemsWrapper` 가 읽는 부모 rule 블록을 그대로 읽되, 합성 part 가 아니라 부모 → 자식 partRule 로 전달한다 (TagGroup 이 TagList 에 size 별 gap 을 주는 방식 — `manualBoxRules.ts:584-604`). DOM 은 묶음 record 가 `div.radio-items` 하나에 대응한다. Styles 의 Direction 은 묶음을 선택했을 때 owner 그룹의 `orientation` 을 쓴다. `LIBRARY_CONTRACT_VERSION` 을 2 로 올린다.
- 위험: 기술(**HIGH** — 직계 자식을 가정한 경로가 여럿이다: partRule `via` 한 단 · size 전달 · 항목 추가 · geometry 접기) / 성능(LOW — 그룹당 record 1개 증가, 비-record Rust 노드 1개 감소) / 유지보수(LOW — TagList 와 같은 모양이 되고 합성 part 특례가 준다) / 마이그레이션(MEDIUM — 기존 개발용 프로젝트 전부 거부. 보존 대상 0 전제라 수용)

### 대안 A′: 대안 A + 저장 문서 변환 (version 유지)

- 설명: contract version 을 두고, 여는 시점에 override 의 template 위치 id 를 새 구조로 옮긴다.
- 위험: 기술(MEDIUM) / 성능(LOW) / 유지보수(**HIGH** — ADR-248 이 범위에서 뺀 migration · 자동 재해석을 되살린다. 변환 코드가 영구히 남는다) / 마이그레이션(LOW)

### 대안 B: 합성 part 를 Layers 의 가상 행으로 노출 (문서 변경 0)

- 설명: 문서와 template 은 그대로 두고, `::part:items` 를 Layers 행 · Canvas 선택 대상 · Styles 대상으로 다룬다.
- 위험: 기술(**HIGH** — 선택은 position 사슬로만 풀린다 (`workspace.ts:493` `positionOfRecord`). record 가 아닌 선택 대상을 workspace · Canvas hit box (`canvasBinding.ts:733` 은 records 만 순회) · Styles host target 세 곳에 새 종류로 넣어야 한다) / 성능(LOW) / 유지보수(**HIGH** — ADR-248 4e-6-36 이 옛 Layers 의 가상 행을 없앤 방향과 반대. 「트리에 없는데 선택되는 것」 이라는 두 번째 모델이 생긴다) / 마이그레이션(LOW)

### 대안 C: DOM 의 wrapper 를 없앤다 (RAC 구조 그대로, 한 상자)

- 설명: `div.radio-items` 를 지우고 그룹 root 하나가 두 축을 다 표현한다 (grid 배치).
- 위험: 기술(**HIGH** — side label + 가로 항목 + 줄바꿈을 한 상자의 grid 로 표현해야 한다. rule 의 `orientation.nested` 와 size 변수 체계를 다시 짠다) / 성능(LOW) / 유지보수(MEDIUM) / 마이그레이션(**HIGH** — shared `RadioGroup` · `CheckboxGroup` 의 DOM 출력이 바뀌어 Preview · Publish 화면이 달라진다. `apps/publish` 수정 0 제약과 부딪힐 수 있다). 그리고 상자가 여전히 하나라 Direction 이 가리킬 축의 모호함이 그대로 남는다.

### 대안 D: 현행 유지 + Layout 탭에 「Items direction」 행 추가

- 설명: 그룹을 선택하면 Layout 탭에 `orientation` 을 쓰는 두 번째 방향 행을 보인다.
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(MEDIUM — 두 그룹만을 위한 Styles 특례 행. 트리와 화면의 구조 차이는 그대로) / 마이그레이션(LOW). 제품 위험 MEDIUM — 사용자가 2026-09-29 에 지적한 「Layers 에서 Label 과 항목이 형제」 는 풀리지 않는다.

### Risk Threshold Check

| 대안 | HIGH+                         | 판정                                          |
| ---- | ----------------------------- | --------------------------------------------- |
| A    | 기술 HIGH 1                   | Gate 로 관리 (G0 인벤토리 · G1 · G2)          |
| A′   | 유지보수 HIGH 1               | 회피 대안 존재 (A)                            |
| B    | 기술 HIGH · 유지보수 HIGH     | 회피 대안 존재                                |
| C    | 기술 HIGH · 마이그레이션 HIGH | 회피 대안 존재                                |
| D    | 없음                          | 통과 — 단 사용자가 요구한 구조 일치를 못 준다 |

HIGH 가 없는 대안은 D 하나다. D 는 위험이 낮지만 문제 (트리 ≠ 화면) 를 풀지 않는다. A 의 HIGH 는 「직계 자식 가정 경로를 빠뜨림」 한 종류이고 착수 전 인벤토리로 닫을 수 있다 — 별도 ADR 로 나눌 phase 는 없다. template · Canvas · DOM · 항목 추가는 **한 번에** main 에 들어가야 한다: template 만 바뀌면 DOM 렌더러가 그룹의 직계 항목만 모으므로 (`delegatedDom.tsx:993` · `:1054`) 항목이 화면에서 사라진다.

## Decision

**대안 A 를 채택한다** (사용자 2026-09-29 방향 · 2026-10-03 「(a)로 진행」).

결정 내용:

1. `RadioItems` · `CheckboxItems` 를 catalog type 으로 등록하고 `component-radiogroup` · `component-checkboxgroup` template 을 `Label + Items > 항목` 으로 바꾼다.
2. 묶음 상자의 값 (방향 · 정렬 · gap) 은 부모 rule 의 기존 블록이 정본이다. 묶음 노드는 **사용자가 편집하는 prop** 과 자기 시각 값을 갖지 않는다. `orientation` 은 그룹의 prop 으로 남는다. 예외는 `size` 하나 — 그룹의 size 가 항목까지 내려가려면 묶음이 그 값을 운반해야 한다 (resolver 는 자식 definition 이 `accepts.size` 를 선언했을 때만 owner size 를 쓴다 — `resolver.ts:561-580`). 묶음은 `size` 를 **내부 운반 값** 으로만 선언한다: 편집 surface 에 내지 않고 (`editorHidden`), owner 값이 항상 덮는다.
3. Canvas 의 합성 part (`catalogItemsWrapper` · `ITEMS_WRAPPERS` · `catalogComposedParts` 의 items 분기) 를 지운다. TreeItem chevron 이 쓰는 part 장치 자체는 남는다.
4. DOM 은 묶음 record 하나가 `div.radio-items` 하나에 대응한다 (class 이름 · 생성 CSS 변경 0).
5. Styles 의 Direction 은 묶음을 선택하면 owner 그룹의 `orientation` 을 쓴다. 그룹을 선택했을 때의 Direction = `labelPosition` 은 그대로다.
6. `LIBRARY_CONTRACT_VERSION` 을 2 로 올린다. contract 1 문서는 거부한다. 변환 코드는 만들지 않는다.
7. 반영 단위: 구조 전환 (template · Canvas 값 전달 · DOM · 항목 추가 · Direction) 은 worktree 에 phase 별로 커밋하고 Gate G1 ~ G4 통과 뒤 main 에 **1회 병합**한다 (ADR-248 Phase 4e 와 같은 방식). 중간 phase 를 main 에 따로 올리지 않는다.

위험 수용 근거: A 의 HIGH 는 구조가 한 단 깊어지면서 「그룹의 직계 자식 = 항목」 을 가정한 경로가 조용히 기본값으로 떨어지는 위험이다. 이 저장소에는 같은 깊이 구조 (TagGroup > TagList > Tag) 가 이미 동작하고 있어 각 경로의 정답 모양이 있다. 가정 경로는 유한하고 (breakdown §2 인벤토리), 기본값과 다른 값 (size sm · lg · xl, horizontal) 으로만 통과하는 Gate 를 둔다. 마이그레이션 위험은 보존 대상 0 이라는 ADR-248 전제를 사용자가 다시 확인해 수용한다.

기각 사유:

- **A′**: 변환 코드는 ADR-248 이 명시적으로 제외한 범위다. 보존할 프로젝트가 없는데 영구 코드를 남길 이유가 없다 (사용자 (a) 판정).
- **B**: 문서를 안 바꾸는 대신 「record 가 아닌 선택 대상」 을 세 계층에 새로 넣는다. 구조가 A 보다 복잡해지고 ADR-248 이 없앤 가상 행을 되살린다.
- **C**: 설치된 RAC 구조와는 가장 가깝지만, Preview · Publish 출력이 바뀌고 한 상자에 두 축이 남아 Direction 모호함을 풀지 못한다.
- **D**: 가장 싸지만 사용자가 요구한 것 (DOM 과 같은 구조가 Layers 에 보임) 을 주지 않는다.

> 구현 상세: [251-radio-checkbox-items-node-restore-breakdown.md](design/251-radio-checkbox-items-node-restore-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 심각도 | 대응                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 직계 자식 가정 경로 누락 — partRule `Label via Radio` 는 한 단만 건넌다 (`types.ts:275-286`) · indicator `minHeight` 는 그룹의 직계 `Radio` 대상 (`manualBoxRules.ts:158-190`) · size 전달은 구조상 직계 owner 로 판정하고 자식이 `accepts.size` 를 선언해야만 쓴다 (`sizePropagation.ts:13-14` · `resolver.ts:561-580`) — 묶음이 size 를 선언하지 않으면 lg 그룹의 항목이 md 로 떨어진다 (리뷰 round 1 격리 반증). 빠지면 기본값으로 조용히 떨어진다                                                         |  HIGH  | G0 에서 소비처 전수 목록을 고정. 묶음이 size 를 내부 운반 값으로 선언 (Decision 2). G1 은 기본값과 다른 size (sm · lg · xl) · horizontal 로만 통과               |
| R2  | Canvas ↔ DOM 위치 어긋남 — 지금은 `getGeometry` 가 감싸인 자식 rect 에 part offset 을 더해 그룹 기준으로 접는다 (`compositionRoot.ts:1192-1215`). 실제 노드가 되면 항목의 부모가 바뀐다                                                                                                                                                                                                                                                                                                                       |  HIGH  | G2 — ADR-248 G3 하니스 수치 그대로 (≤ 1 px · ≤ 0.001) + orientation 축 case 추가                                                                                 |
| R3  | 항목 추가 (「+」) 가 깨짐 — `insertGroupItem` 은 새 항목을 host 의 직속 자식으로 넣는다 (`commands/collections.ts:414`). 일반 collection 삽입 (`itemInsert.ts:255-275` · `insertCollectionItem`) 으로 옮기면 안 된다: 그 경로는 항목에 `id` 를 쓰는데 Radio · Checkbox 는 받지 않고 (`PROP_NOT_ACCEPTED`), Radio 의 고유 `value` 부여 (`collections.ts:468`) 와 선택된 형제 해제 · 그룹 `value` 갱신 (`:505-530`) 이 없다. template 안 묶음에 넣으려면 묶음이 `fillSlot` 대상이어야 한다 (`graph.ts:780-790`) |  HIGH  | 그룹 전용 삽입 (`insertGroupItem`) 을 유지하고 **삽입 위치와 형제 집계만** 묶음 기준으로 바꾼다. 묶음에 `container` trait. G3 — 연속 2회 삽입 · 선택된 항목 삽입 |
| R4  | DOM 출력 변화 — shared `RadioGroup` 의 children 감싸기와 `delegatedDom` 의 감싸기가 겹친다. 정리하다 Publish 화면이 바뀔 수 있다                                                                                                                                                                                                                                                                                                                                                                              |  MED   | G4 — 그룹당 `.radio-items` 정확히 1개 · 생성 CSS diff 0 · `apps/publish` 수정 0                                                                                  |
| R5  | contract 1 프로젝트 전부 거부 · contract 1 위치 id 를 쓰는 테스트 (`codeCatalogLibrary.test.ts:501-510`) 와 과거 증거 JSON 13 파일 (`docs/adr/design/248-*`)                                                                                                                                                                                                                                                                                                                                                  |  MED   | 의도된 동작 (사용자 (a)). 테스트는 새 id 로 고친다. 과거 증거 JSON 은 그 시점 기록이라 다시 만들지 않는다                                                        |
| R6  | Direction 의 owner 쓰기는 새 경로 — 지금 번역은 선택 요소 자신의 prop 만 쓴다. 다중 선택 · undo 묶음 · 반응형 층 제외 규칙이 따로 갈릴 수 있다                                                                                                                                                                                                                                                                                                                                                                |  MED   | 그룹 선택 경로와 같은 명령 (`catalogSemanticPatchCommand`) 을 owner target 으로 쓴다. G3                                                                         |
| R7  | 묶음 노드의 편집 범위가 정해지지 않음 — 삭제 · 이동 · 인라인 style 을 허용하면 그룹 구조가 깨질 수 있다                                                                                                                                                                                                                                                                                                                                                                                                       |  MED   | TagList 의 현재 편집 범위를 G0 에서 실측해 같은 범위로 둔다                                                                                                      |
| R8  | library 생성 파일 직접 편집 — 생성 스크립트 (`phase3ReusableOriginTemplates.test.ts`) 가 삭제돼 `reusableOriginLibrary.ts` 를 손으로 고친다                                                                                                                                                                                                                                                                                                                                                                   |  LOW   | library 검증 (`buildCodeCatalogLibrary` · graph 생성자) 이 dangling id 를 잡는다. revision digest 는 자동 계산                                                   |

## Gates

측정 조건: 대상은 팔레트가 만드는 실제 origin instance (합성 fixture 아님). 불리한 경우 = horizontal × side label × size xl × 항목 줄바꿈. oracle = 실제 브라우저 `getBoundingClientRect` (Canvas ↔ DOM leg) 로, 시스템 자신의 재생성값이 아니다.

| Gate | 시점      | 통과 조건                                                                                                                                                                                                                                                                                                                                 | 실패 시 대안                                                 |
| ---- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G0   | 착수 전   | 인벤토리 고정: ① 그룹의 직계 자식을 가정한 소비처 전수 (grep 목록 + 파일:라인) ② TagList 의 DOM 대응 · 편집 범위 실측 ③ 현재 DOM 의 `.radio-items` 개수를 unit 으로 기록 ④ React Spectrum 사례 확인                                                                                                                                       | 목록이 breakdown §2 의 1.5배를 넘으면 breakdown 보강 후 진행 |
| G1   | Phase 1·2 | 구조: library 검증 통과 · contract 1 문서가 `UNSUPPORTED_LIBRARY_CONTRACT` 로 거부됨. 값: size sm · md · lg · xl × orientation 2 × labelPosition 2 에서 묶음 gap · 항목 indicator · Label margin 이 rule 값과 같다 (기본값과 다른 case 가 원복 RED) (R1)                                                                                  | 빠진 경로를 인벤토리에 추가하고 재측정                       |
| G2   | Phase 2·3 | ADR-248 G3 하니스에서 RadioGroup · CheckboxGroup base · axis 전 case PASS (≤ 1 px · ≤ 0.001, 승인 차이 항목 수 증가 0) + `propAxisCanvasDom` 에 orientation case 추가 후 PASS (R2)                                                                                                                                                        | 어긋난 축을 rule · partRule 에서 수리. 수치 완화 금지        |
| G3   | Phase 4   | 편집: Layers 에 묶음 행이 보이고 선택됨 · 묶음의 Direction 이 owner `orientation` 을 history 1 step 으로 씀 · 그룹의 Direction 은 `labelPosition` 그대로 · 「+」 가 묶음 안에 항목을 넣음 — 연속 2회 삽입한 Radio 의 `value` 가 서로 다름 · 선택된 항목을 넣으면 형제 선택 해제 + 그룹 `value` 갱신 (unit 원복 RED + live) (R3 · R6 · R7) | Direction owner 쓰기만 다음 phase 로 미루고 구조 먼저        |
| G4   | Phase 3   | DOM: 그룹당 `.radio-items` / `.checkbox-items` 1개 · 생성 CSS diff 0 · `apps/publish` diff 0 (R4)                                                                                                                                                                                                                                         | shared 컴포넌트는 그대로 두고 `delegatedDom` 쪽만 정리       |

### Live Exercise

2026-10-03 · 실제 Builder (worktree `adr251` dev 서버 5175, headless Chrome Playwright, 빈 프로필 + 저장된 인증 세션으로 `/dashboard` 진입, 그룹마다 새 프로젝트) — `apps/builder/scripts/adr251-live.mjs`, RadioGroup · CheckboxGroup 각 6/6 PASS, 페이지 오류 0:

- L1 팔레트 검색 → 「radio group」 · 「checkbox group」 클릭 → 문서 = `Label · RadioItems > Radio ×2` (`CheckboxItems > Checkbox ×2`)
- L2 Navigator 의 Layers 에서 `RadioItems` 행 클릭 → 묶음 record 선택
- L3 Styles Direction 「Row」 → 그룹 `orientation` = horizontal · history 1 step · 묶음 layout `row` (두 번째 Radio x = 첫째 끝 + 12) · Block 비활성
- L4 ⌘Z → vertical 복귀
- L5 그룹 선택 시 Direction 「Row」 → `labelPosition` side (orientation 불변) · ⌘Z
- L6 Properties 「Insert Radio」 를 묶음 · 그룹에서 한 번씩 → 묶음 안 4개, value `option1 ~ option4`

모델 판정은 graph · layout record · geometry 로 했다 (이 환경의 Playwright 스크린샷은 Canvas 를 비운 채 찍힌다 — main 5173 대조군도 같음). Preview (Compare Mode) 는 열지 않았다 — 사용자 확인 항목.

## Consequences

### Positive

- Layers 의 구조가 화면 (DOM) 의 상자 구조와 같아진다. TagGroup 과 같은 모양이다.
- 두 축이 각자의 노드를 갖는다 — 그룹의 Direction = `labelPosition`, 묶음의 Direction = `orientation`. Properties ↔ Styles 경계 결함의 원인이 없어지고, 뒤따르는 Design 패널 통합이 이 특례를 안고 가지 않는다.
- Canvas 의 「owner 가 합성하는 상자」 특례에서 그룹 두 종이 빠진다.

### Negative

- contract 1 로 저장된 개발용 프로젝트는 열리지 않는다 (의도).
- ADR-912 의 Items 폐기 결정 (`9c0e15446`) 을 뒤집는다. `completed/912` 본문의 해당 대목에 이 ADR 을 가리키는 표기는 Implemented 승격 때 넣는다.
- 영향 파일 (대표): `packages/shared/src/catalog/document/{generated/reusableOriginLibrary.ts, rulePartRules.ts, manualBoxRules.ts, sizePropagation.ts, types.ts, commands/collections.ts}` · `packages/shared/src/domain/componentTraits.ts` · `apps/builder/src/builder/catalogRuntime/{presence.ts, delegatedDom.tsx}` · `apps/builder/src/builder/panels/styles/{utils/orientationDrivenTags.ts, hooks/useStyleActions.ts, catalog/catalogStylesHost.ts}` · `apps/builder/tests/adr248-g3/`.
- ADR-248 Phase 4 의 G3 승인 기록 중 두 그룹의 항목은 다시 승인해야 한다.
