# ADR-230: 기본 요소의 상태별 origin 분해 — Components 페이지에서 선택됨·비활성 (·hover·pressed) 변형을 origin 으로 정의하고 보여준다

## Status

Accepted — 2026-09-21 (Proposed 2026-09-21 같은 날 · 사용자 `/execute-adr 230`)

리뷰 round 1 h1/m2/m3 설계 보완 완료 (round 2, 이슈 0). **Phase 0 (G0) 완료** — inventory freeze (breakdown §2 F13~~F21) · 기본 요소 집합 5 (Button · ToggleButton · Link · Checkbox · Switch) · Δnode 12 · 리뷰 반증 3건 현재 코드 재현. **Phase 1 (G1 · G2) 완료 2026-09-22** — selected/disabled 변형 origin seed + 두 leg 유효 상태 overlay + opacity 단일 적용 + Preview CSS 변수/RAC 상태 selector 1장 · unit 23 · live 8/8 (breakdown §7). G3 · G4 는 UNVERIFIED.

설계 요청: 사용자 (2026-09-21, ADR-229 Phase 3 뒤) — "다른 컴포넌트들도 같은 패턴이다. 선택했을 때 · 비활성을 보여주는 스타일을 정의하고 보여줘야 하는 부분이다. Components 페이지는 각 컴포넌트들을 분해해서" + "기본적인 UI 요소들만 정의가 잘 되면 나머지는 모두 조합이지 않나, RAC 도 그 패턴이고". 전제 확정 (AskUserQuestion 2026-09-21, 메모리 `project-components-page-state-variant-origins-2026-09`): **229 종결 후 새 ADR · 형태 = 상태별 별도 origin (Tag/Default · Tag/Selected 패턴)**. ADR-229 는 같은 날 Implemented (Consequences "후속 후보" 1번이 이 ADR).

## Context

**SSOT 3-domain 관계**: **D3 의 상태 축**. 지금 상태 스타일 (hover · pressed · selected · disabled) 의 정본은 catalog rule 의 fill state 토큰 (`variants[v].fill.default.{base,hover,pressed,selected}` · `states.disabled.opacity`) 이고, 이 ADR 은 그 위에 **문서 소유 origin 노드** 층을 얹는다 (ADR-142 "조합 = canonical reusable 문서" · ADR-228 "Components 페이지 = origin 전집 + 테마 한 세트" 의 상태 축 확장). D1 (RAC DOM) 은 **경계로 존중** — hover/pressed/focus 를 빌더 캔버스가 pointer 로 재현하는 것은 ADR-150 A1 이 2026-07-20 철회한 D1/D3 오판이며, 이 ADR 도 캔버스에 interaction 을 넣지 않는다 (origin 노드는 Components 페이지에 **정적으로** 보일 뿐). D2 무변경 — 상태 prop (`isDisabled` · `isSelected`) 은 RSP 그대로.

### 문제

- Components 페이지는 "우리 프로젝트의 Button 은 이렇게 생겼다" 를 정하는 자리 (ADR-228) 인데, **어떤 상태로 보이는지** 는 정할 수 없다. selected 변형 origin 이 있는 것은 ListBoxItem · Tag 둘뿐 (ADR-148 · 229) 이고 그 외 66 컴포넌트의 상태 스타일은 catalog 토큰이라 사용자가 origin 을 손봐도 (예: Button root 배경) 선택됨/비활성/hover 는 토큰 파생값 그대로다 — "기본 배경은 바꿨는데 hover 는 옛 색" 이 즉시 보인다.
- 사용자 모델 (RAC 와 같음): 기본 요소 (Button · Input · Checkbox …) 를 잘 정의하면 나머지는 조합이다. 229 로 조합은 origin instance 가 되었으므로 (Form 안 Button = `component-button` 의 ref), 상태 스타일도 **기본 요소 origin 에만** 정의하면 조합 전체가 상속한다 — 66 × 상태 origin 이 아니라 **상태를 가진 leaf 집합 × 상태** 만 필요하다.

### 코드 사실 (2026-09-21, main `f54a857d1`)

요약 — 전문은 breakdown §2 (F1~F12, 경로:라인).

- 상태 스타일 정본 = catalog rule fill state 토큰: `hover:` 270 · `pressed:` 256 · `selected:` 16 · `disabled` 107 (`componentRulesTable.ts`). DOM 소비 = 생성 CSS `&[data-hovered]` / `[data-pressed]` / `[data-selected]` (`CSSGenerator.ts:345 · 359 · 370`) — RAC 가 data 속성을 소유한다 (D1). Skia 소비 = **선언적 상태만**: `isSelected` (`buildCatalogShapes.ts:147 · 174`) · `isDisabled` (`skiaPrimitives.ts:812 · 957 · 967` · `buildSpecNodeData.ts:1805-1810`). hover/pressed 는 Skia 가 그리지 않는다 (ADR-150 A1 철회, `5e635ebbc`).
- 변형 origin 선례: `metadata.variant === "selected"` 노드를 host `slot[1]` 로 찾는다 (`canvasSceneNode.ts:606-697` · `preview/App.tsx:341 · 412` · `slotHostPolicy.ts:174`). selected origin 의 `props.style` · `fills` 를 default origin 위에 overlay (`canvasSceneNode.ts:965-990`, DOM `TagGroup.tsx chipStyle(isSelected)`). 즉 "상태 → 다른 origin 의 style 을 겹친다" 는 두 leg 가 이미 한 자리 (item template) 에서 한다.
- instance 해소 = ref 1 → master 1 (`resolveCanonicalRefElement` · `mergePropsWithStyleDeep`, `canonicalRefResolution.ts:175-246`). 상태 origin 을 읽는 두 번째 조회는 없다.
- 상태 prop 을 가진 타입: `isDisabled` 계약 45 binding · `isSelected` 5 (Card · Checkbox · Radio · Switch · ToggleButton). 팔레트 reusable 57 (`PALETTE_REUSABLE_ORIGIN_TYPES` 52 + 손 seed 5).
- 기본 요소 원칙의 예외 = RAC 내부 sub-part (TextField 의 Label/Input/FieldError · picker 의 DateInput · 그룹의 Label): parent rule delegation (`DELEGATED_SUBPART_CHILD_TOKENS` · `SELF_COMPOSED_LABEL_PARENTS`, ADR-923). DOM 이 자식 노드를 읽지 않으므로 Input origin 의 상태 스타일이 TextField 안 Input 에 닿을 채널이 없다.
- Components body 는 flex-wrap grid (gap 24, `systemComponentsPage.ts:49-52`) — 변형 origin 이 늘면 그 옆에 나란히 선다.
- 테마 (ADR-227, Proposed) 는 토큰 값을 문서가 소유하는 축이고 이 ADR 은 origin 노드 축 — 둘 다 D3 이며 직교 (origin style 은 토큰 참조값을 담을 수 있다).

### Hard constraints

- **두 leg 대칭 (선언적 상태)**: instance 에 `isSelected` / `isDisabled` 가 있을 때 Skia 와 Preview 가 같은 상태 origin style 을 읽어 픽셀 Δ 0 (ADR-198 하니스 instance arm 확장).
- **D1 경계**: hover/pressed/focus 는 빌더 캔버스에서 재현하지 않는다 (ADR-150 A1 철회 유지). 그 상태 origin 은 Preview DOM 만 소비하고 캔버스에는 Components 페이지의 정적 노드로만 보인다.
- **사용자 체감 무변화 (instance)**: instance 선택 시 Properties/Styles 필드 · 편집 · drag · 복제가 지금과 같다. 상태 origin 은 Components 페이지에서만 편집 (신규 InspectorFieldKind 0 · state 탭 0).
- **BC**: 기존 문서 plain 노드 · 기존 origin 불변. 최초 열기 때 상태 origin 만 보충 (Δnode = 기본 요소 N × 상태 S + 자식, breakdown §2 에서 확정 — 추정 leaf 10 × 2 (selected·disabled) ≈ 20~~40 노드 · ≈ 4~~8 KB, 228 실측 205 B/노드 기준), 두 번째 열기 Δ0. 롤백 = 상태 origin seed 원복 (노드가 남아도 무해, 해소기는 부재 origin 을 catalog 토큰 폴백으로 읽는다).
- **성능**: 600 instance 문서에서 `scene.build` p95 ≤ +1 ms (ADR-228/229 와 같은 A/B) — 상태 origin 조회는 id 규약으로 O(1).
- **catalog 무변경**: rule 토큰 · PropContract 는 그대로 (origin 이 없으면 종전 시각). 상태 origin 은 토큰 위 overlay 다.

### Soft constraints

- 66 × 상태 전수화 금지 — 대상은 "상태를 가진 leaf" (breakdown §2 inventory). 조합 (Form · Toolbar · ButtonGroup …) 은 229 ref 상속.
- 변형 origin 의 이름 규약은 item template 과 같은 어법 (`Tag/Default` · `Tag/Selected` → `Button/Default` · `Button/Selected` · `Button/Disabled` …).
- 사용자가 만든 변형 (예: `Tag/Hot`) 도 같은 채널 (`metadata.variant` 자유 문자열) — 단 두 leg 가 자동으로 고르는 것은 표준 상태 이름뿐.

## Alternatives Considered

### 대안 A: 상태별 별도 origin 노드 (Tag/Selected 패턴 전 기본 요소로) — 사용자 확정 전제

- 설명: 기본 요소 origin 마다 상태 변형 origin (`component-button--selected` · `--disabled` · 2단계로 `--hover` · `--pressed` · `--focus`) 을 Components body 에 시드하고 `metadata.variant` + `metadata.variantOf` 로 묶는다. 해소: Skia 는 조상/collection 투영 후 유효 상태로 상태 origin style·fills 를 default 위에 overlay (ListBox selected 행과 같은 경로). Preview: 선언적·interaction 상태 모두 출처별 CSS 변수와 RAC 상태 selector로 전달. 사용자는 캔버스에서 상태별 노드를 나란히 보고 각각 Styles 로 편집.
- 리서치: Figma component set 의 variant property (`State=Default/Hover/Disabled`) · Framer variants · Pen/Pencil 의 origin/instance 마커 (메모리 `pencil-component-visual-markers`) — 디자인 도구 관례가 "상태 = 나란히 놓인 변형 프레임" 이다. RAC 는 상태를 data 속성으로 노출하고 스타일은 소비자 몫 — 이 ADR 의 origin 이 그 소비자.
- 위험: 기술 **HIGH** (opacity 중복 반례 및 cascade·유효 상태 계약 확장 — G0/G1/G2) / 성능 LOW (id 규약 O(1) 조회, 상태 있을 때만) / 유지보수 MEDIUM (origin 수 2~4배 — Components 페이지 밀도 · Navigator) / 마이그레이션 LOW (보충만, 롤백 무해).

### 대안 B: origin 하나 + Styles 패널 상태 탭 (상태 축을 responsive 처럼 저장)

- 설명: `component-button` 하나에 `states: { selected: {style}, disabled: {style} }` 을 두고 Styles 패널에서 상태를 골라 편집. 캔버스는 기본 상태만.
- 위험: 기술 MEDIUM (canonical 스키마에 새 축 — responsive 와 병렬로 해소기 · 패널 · diff 전부 확장) / 성능 LOW / 유지보수 **HIGH** (신규 InspectorFieldKind · 상태 탭 UI · responsive × state 조합 폭발) / 마이그레이션 MEDIUM (스키마 필드 추가).
- 사용자 기각 (2026-09-21): 캔버스에서 상태를 **보여야** 한다.

### 대안 C: 현행 유지 + 테마 토큰 (ADR-227) 으로만 상태 색을 바꾼다

- 설명: origin 은 기본 상태만, hover/pressed/selected/disabled 는 토큰 (`{color.accent-hover}` …) 을 테마에서 바꾼다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW — 그러나 요구 미충족: 토큰은 전 컴포넌트 공용이라 "Button 의 selected 만 다르게" 를 못 하고, 배경 말고 padding/border/typography 상태 차이는 토큰 축에 없다. 사용자 요구 ("분해해서 보여준다") 밖.

### 대안 D: 혼합 — 선언적 상태 (selected · disabled) 만 origin, interaction 상태 (hover · pressed · focus) 는 토큰 유지

- 설명: A 를 두 leg 가 다 그리는 상태로 한정. 공통 CSS 채널은 필요하지만 interaction 상태 규칙만 추가하지 않는다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW — 그러나 사용자가 든 예 ("선택했을 때 · 비활성") 는 덮되 "hover 는 옛 색" 문제는 남는다.

### Risk Threshold Check

| 대안 | HIGH+         | 판정                                                                    |
| ---- | ------------- | ----------------------------------------------------------------------- |
| A    | 기술 HIGH 1   | 채택 — G0 소비 경계, G1 상태 효과 단일화, G2 두 leg 반증 검증           |
| B    | 유지보수 HIGH | 기각 (사용자 기각 + 스키마 축 신설)                                     |
| C    | 0             | 기각 (요구 미충족)                                                      |
| D    | 0             | A 의 Phase 1 로 흡수 — interaction 상태는 Phase 2 (G0 결과에 따라 보류) |

리뷰 후 위험 재평가: A의 기술 HIGH는 disabled opacity 중복 실행 반례에서 확인됐다. D로 interaction만 보류해도 남는 문제이므로, 표현 형식을 바꾸지 않고 G0~G2에서 상태 효과 대체·cascade·유효 상태 입력을 선행 검증한다.

## Decision

**대안 A 를 채택하되 D 의 순서로 간다.** Phase 1 = 선언적 상태 (selected · disabled) 변형 origin — ListBox/Tag는 선례이나 일반 컴포넌트의 상태 효과 대체·유효 상태 입력은 새 배선이 필요하다. Phase 2 = interaction 상태 (hover · pressed · focus-visible) 변형 origin — Preview DOM 만 소비 (문서별 CSS 규칙 주입), 캔버스는 Components 페이지 정적 노드. 공통 CSS/유효 상태 채널이 실패하면 Phase 1도 보류한다. 선언적 상태가 통과하고 interaction 전용 배선만 실패한 경우에만 Phase 2를 보류하고 Phase 1 범위로 종결한다.

- **대상 집합 (기본 요소)**: 상태 prop 을 가진 leaf — Phase 0 inventory 로 확정하되 후보 = Button · ToggleButton · Link · Checkbox · Radio · Switch · Tab · MenuItem · GridListItem (+ 이미 있는 ListBoxItem · Tag 는 `--disabled` 만 추가). 조합 (Form · Toolbar · ButtonGroup · Pagination …) 은 229 ref 상속으로 자동. RAC 내부 sub-part (Input · Label 등) 는 **범위 밖** (ADR-923 delegation, 재개 조건 = 결정 지점 ③).
- **묶음 규약**: 변형 origin id `<origin>--<state>` · `metadata.variant = "<state>"` · `metadata.variantOf = "<origin>"` · 이름 `Button/Selected`. host `slot` 배열은 item template (collection) 에만 — leaf 는 `variantOf` 로 역참조 (한 origin 의 변형 집합 = 문서에서 `variantOf` 일치 노드).
- **유효 상태**: authored props를 곧바로 상태로 취급하지 않는다. Canvas는 RadioGroup.value→Radio.isSelected, Tabs.selectedKey→Tab._isSelected, collection 선택·조상 disabled 투영 이후의 상태를 사용한다. Preview는 RAC의 실제 data-selected/data-disabled/data-hovered/data-pressed/data-focus-visible을 소비한다. Components 페이지 정적 variant 미리보기는 별도 render-only 상태이며 canonical props/RAC 상태를 변경하지 않는다.
- **스타일 소유권**: 종전 catalog/default origin 표현을 baseline으로 두고 활성 selected → hover → pressed 순으로 상태 origin이 가진 키만 교체한다. disabled이면 hover/pressed는 배제하고 disabled가 최우선이다. focus-visible은 focus 관련 키를 보강하되 같은 키의 우선순위는 disabled > pressed > hover > selected > focus-visible이다. instance 명시 style/fills는 상태 origin보다 우선한다. origin·키 부재는 해당 축의 종전 baseline을 유지한다. 해소 전에 명시 override와 상속값의 출처를 보존한다.
- **opacity 단일화**: 상태 origin이 opacity를 소유하면 catalog disabled opacity를 대체하고 최종 opacity를 한 번만 적용한다 (0.5→0.5, 0.5×0.38 금지). instance 명시 opacity 0.8이면 0.8이 우선한다. 해당 상태 origin의 opacity가 없거나 대상 밖 plain이면 기존 경로를 보존한다. isDisabled를 false로 바꾸거나 다른 상태 표현을 비활성화하지 않는다.
- **자식 계약**: 변형 subtree는 default와 동형이어야 한다. 수/type 불일치는 진단 후 변형 무시, 자식 style은 path별 같은 소유권 규칙을 따른다.
- **편집 표면**: Components 페이지에서 변형 origin 을 plain 처럼 선택·편집 (기존 origin 편집 경로 + 영향 대화상자). instance 에는 새 필드 0. 변형 origin 의 Properties 는 root 상태 prop 을 **읽기 전용 배지** 로만 (변형 origin 자체에 `isSelected:true` 를 굽지 않는다 — 캔버스 미리보기는 해소기가 `variant` 로 상태를 가정).
- **Preview 공통 채널 (Phase 1부터)**: CSS custom property로 baseline/상태 origin/명시 instance값을 구분해 전달하고, 문서별 CSS 한 장의 RAC 상태 selector가 최종 속성을 결정한다. 관리 속성의 기존 inline 선언도 렌더 단계에서 출처별 변수로 옮겨 경합을 없앤다 (canonical 저장값 불변). 비관리 속성과 plain은 종전 경로다. blanket !important는 쓰지 않는다. origin 표식과 RAC 상태 속성은 같은 실제 요소에 매핑하고 자식 path도 실제 소비 요소에 연결한다. Phase 2는 interaction 규칙만 추가하며 D1 구조/ARIA는 변경하지 않는다.
- **기각 사유**: B — 캔버스에 상태가 안 보이고 스키마 축·패널 kind 신설 (사용자 기각). C — 요구 미충족 (컴포넌트별·비색상 상태 차이). D 단독 — hover 가 옛 색으로 남는 문제 미해결 (Phase 2 로 흡수).
- **위험 수용 근거**: G0의 반증/소비 경계 확정과 G1/G2의 opacity·cascade·유효 상태 검증 전에는 해당 상태 소비를 활성화하지 않는다. 공통 채널 실패는 Phase 1도 보류하며, 선언적 상태가 통과한 뒤 interaction 전용 실패만 Phase 2 보류로 분리한다. 밀도는 G4로 관리한다.

> 구현 상세: [230-base-element-state-variant-origins-breakdown.md](design/230-base-element-state-variant-origins-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                             | 심각도 | 대응                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Preview 에 문서별 CSS 를 싣는 채널이 없어 interaction 상태 origin 이 DOM 에 닿지 않는다 (`preview/App.tsx` · `CanonicalNodeRenderer` · Preview `index.css` 정적) |  MED   | **G0** — 채널 inventory (있으면 재사용 · 없으면 `<style>` 1장 주입 설계 + XSS 경계: 값은 CSS 값 화이트리스트). 공통 채널 실패면 Phase 1도 보류; interaction 전용 실패만 Phase 2 보류 |
| R2  | 두 leg 가 상태 우선순위를 다르게 읽는다 (Skia `isDisabled` 평탄화 `buildSpecNodeData.ts:1797-1810` — Breadcrumb 예외 · RAC `data-disabled` 가 hover 차단)        |  MED   | **G2** — 상태 조합 매트릭스 (selected×disabled · disabled×hover) 두 leg 픽셀 Δ0, Breadcrumb 예외는 inventory 에 명시                                                                 |
| R3  | Components 페이지 밀도 — leaf 10 × 상태 2~~5 = 20~~50 노드가 grid 에 흩어져 "어느 Button 이 기본인가" 를 잃는다                                                  |  MED   | **G4** — 변형은 default 오른쪽에 같은 행으로 시드 (`variantOf` 정렬) · Navigator 그룹 접기 · 배지 `Selected/Disabled` · 사용자 confirm 1회                                           |
| R4  | 변형 origin 을 사용자가 지우거나 자식을 바꾸면 해소기가 무엇을 읽는가 — 조용한 폴백은 "편집이 안 먹는다" 로 보인다                                               |  LOW   | 부재 = catalog 폴백 (명시) · subtree 불일치 = 진단 warn + default 만 (229 `diffSubtree` 규칙 재사용) · 삭제 가드는 systemOwned root 와 같은 규칙                                     |
| R5  | ADR-227 테마와 값 충돌 — 변형 origin style 에 hex 를 구우면 테마 전환이 안 먹는다                                                                                |  LOW   | seed 는 토큰 참조 (`{color.accent-hover}`) 로 굽고 사용자가 hex 를 넣는 것은 plain 과 같은 자유 (227 R 축과 동일 취급)                                                               |
| R6  | 상태 origin opacity와 catalog 효과 중복, inline/CSS 경합, self props/유효 상태 불일치                                                                            |  HIGH  | G0 반증 고정 · G1 단일 효과/출처 보존 · G2 조상 상태 및 selected×hover/pressed 실측                                                                                                  |

잔존 HIGH R6은 G0/G1/G2로 관리한다. 설계 보완만으로 구현 위험이 해소된 것으로 보지 않는다.

## Gates

| Gate | 시점      | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                                                                            |
| ---- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0   | inventory 확정: 기본 요소 집합 (상태 prop leaf) · 두 leg 상태 읽기 지점 (Skia `isSelected/isDisabled` · DOM data 속성) · Preview 문서별 CSS 주입 채널 유무 · 예상 Δnode/Δbyte · Breadcrumb 류 예외 표 · opacity 중복/inline 경합/조상 선택 반증 및 소비 위치                                                                                                                                                               | 공통 채널 실패면 Phase 1 보류; interaction 전용 실패만 Phase 2 보류 · 집합이 15 초과면 Phase 1 을 Button 가족 5 로 축소 |
| G1   | Phase 1   | unit: 변형 origin seed 멱등 · `variantOf` 묶음 · 유효 상태·키별 우선순위·명시 instance값 보존·opacity 단일 효과 · subtree 불일치 진단 · 기존 origin/plain 불변 — 원복 RED                                                                                                                                                                                                                                                  | phase 롤백                                                                                                              |
| G2   | Phase 1·2 | live 두 leg: ToggleButton/Selected 배경·border 편집 → `isSelected` instance Skia 픽셀 + Preview computed 동시 Δ · Button/Disabled opacity/색 → `isDisabled` instance (Button 은 `isSelected` 계약이 없다 — 상태 열은 타입별 계약을 따른다) · Form 안 Button (229 ref) 상속 · RadioGroup.value만 지정한 자식/Tab · opacity 0.5/명시 override 0.8 · 상태 조합 Δ0 · Phase 2 selected×hover/pressed/해제 복귀 및 disabled 차단 | 비대칭 leg 수리, 못 하면 그 상태 보류                                                                                   |
| G3   | Phase 1·2 | 600 instance A/B `scene.build` p95 ≤ +1 ms (상태 있는 instance 50%) · Preview `<style>` 1장 ≤ 8 KB / 재주입 ≤ 1회/편집                                                                                                                                                                                                                                                                                                     | 상태 origin 조회 memo · CSS 주입 debounce                                                                               |
| G4   | Phase 3   | BC: 기존 origin/plain 직렬화 불변 · 최초 보충 Δnode/Δbyte = 예상 · 재hydration Δ0 · Components 페이지 배치 (default 옆 한 줄) 사용자 confirm 1회 · 롤백 (seed 원복, 해소기 유지) 문서 열림                                                                                                                                                                                                                                 | migration 0 유지 못 하면 중단                                                                                           |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Components 페이지가 "기본 요소 × 상태" 의 정본이 된다 — Button 의 disabled/hover · ToggleButton 의 selected 를 한 번 정하면 Form · Toolbar · ButtonGroup 안 Button (229 instance) 과 사용자 페이지 instance 전부가 따른다. RAC 의 "상태는 data 속성, 스타일은 소비자" 와 canonical 문서가 일치.
- ListBoxItem · Tag 의 selected 변형이 특례가 아니라 일반 규칙의 첫 사례가 된다 (`variantOf` 규약으로 통일, item template 은 host `slot` 유지).
- 테마 (227) 가 토큰을 바꾸면 변형 origin 의 토큰 참조도 따라간다 — 두 축이 겹치지 않는다.

### Negative

- Components 페이지 노드 수가 2~~4배 (leaf 10 기준 +20~~50) — 밀도·Navigator 부담 (R3, G4).
- interaction 상태는 Preview 에서만 확인된다 (캔버스는 정적 노드) — "캔버스에서 hover 를 보고 싶다" 는 ADR-150 A1 철회와 같은 이유로 이 ADR 이 답하지 않는다.
- RAC 내부 sub-part (TextField 안 Input 의 disabled/focus) 는 여전히 parent rule delegation — "Input origin 의 상태를 TextField 가 상속" 은 범위 밖 (재개 = 결정 지점 ③).
