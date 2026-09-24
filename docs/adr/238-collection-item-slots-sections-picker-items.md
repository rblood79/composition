# ADR-238: 목록 항목 안 slot · Section 층 · Select/ComboBox 항목 origin — origin · instance · slot 적용 확장

## Status

Proposed — 2026-09-24

설계 요청: 사용자 (2026-09-24) — "listbox 내의 list 내부도 slot 구조화" 질문 → `/deep-research` (react-aria.adobe.com, reusable · origin · instance · slot 으로 분해 · 조립 가능한 것) → 후보 6 중 사용자 선택 "1+2+3" (AskUserQuestion) 으로 `/create-adr`. 237 이 "범위 밖 (후속 ADR)" 으로 남긴 Select · ComboBox 항목 origin · Menu section 을 포함한다. 전제 기록: [breakdown §1](design/238-collection-item-slots-sections-picker-items-breakdown.md#1-전제-확정-기록-fork-4-질문--사용자-confirm).

## Context

### 문제

[ADR-234](completed/234-variant-instances-and-slot-filled-collections.md) · [ADR-237](completed/237-origin-instance-slot-extension.md) 로 목록 틀 · 그룹 · Breadcrumbs 가 "slot = 추천 항목 · 목록 = instance 자식" 이 됐지만, RAC collection 구조의 나머지 세 층이 모델 밖에 있다.

1. **항목 안 역할 — 구조는 있는데 표면이 없다.** 항목 origin 은 역할 자식 (icon · label · description · shortcut · avatar) 을 이미 갖고 (F1), instance 는 `descendants` 로 역할을 켜고 끌 수 있다 (F3). 그러나 Properties 에 항목 instance 의 역할 on/off 가 없고, 역할 재생성 액션은 소비처 0 이다 (F4). RAC 는 역할마다 provider 가 받는 slot 이름이 정해져 있어 (R1 · R2) 아무 역할이나 실으면 "Invalid slot" 크래시가 난다 (F5 — GridListItem label 실측).
2. **Section — `items` 엔트리 모양뿐이다.** ListBox · Menu · GridList 의 section 은 `items` 안의 `{type:"section"}` 엔트리다 (F6, ADR-099). 정적 목록 이관은 section 이 섞인 `items` 를 건너뛰어 (F7) 그런 목록은 234 뒤에도 `items` 모델에 남는다 — 같은 ListBox 가 section 유무에 따라 두 모델로 갈린다. RAC 는 section 을 collection 의 한 층 (`ListBoxSection` + `Header`) 으로 둔다 (R3).
3. **Select · ComboBox — 항목이 `items` 배열뿐이다.** RAC 의 목록은 `Popover > ListBox > ListBoxItem` 이라 항목 컴포넌트가 ListBox 와 같은데 (R5), composition 은 `items` 가 SSOT (F9) 라 ListBoxItem origin 의 모양 · 상태 변형이 Select popover 에 닿지 않는다.

### 3-Domain

- **D1 (RAC, 관찰만)**: section 은 RAC 컴포넌트 (`ListBoxSection` · `MenuSection` · `GridListSection` · `Header`/`GridListHeader` · `Separator`) 를 그대로 쓴다. 항목 역할의 `slot` 이름은 RAC provider 가 받는 이름 (R2) 으로만 제한한다. DOM 구조 재작성 없음.
- **D2**: 새 컴포넌트 prop 없음. 새 canonical 노드 type 3 (RAC 이름 그대로 — `ListBoxSection` · `MenuSection` · `GridListSection`).
- **D3 (시각)**: section 모양 = 새 catalog entry 3 + 기존 `Header` rule (F12). 항목 모양 = ListBoxItem origin (Select · ComboBox 가 같은 origin 을 쓴다). 두 consumer 대칭은 234 그대로.
- **SSOT 경계 변경 없음.** 필드 sub-part (Label · Input · SelectTrigger · FieldError) 는 parent delegation 유지 (ADR-923).
- **Generator (체크리스트 #2)**: 새 section entry 는 생성 CSS archetype 을 명시한다 (`archetypeDefaultCohort.static.test.ts` ratchet). section 안 항목 selector 는 RAC class (`.react-aria-ListBoxSection` 등) — 생성기의 자식 selector emit 은 Phase 0 에서 확인.

### 코드 사실

레퍼런스 R1~~R6 · 코드 사실 F1~~F12 (경로:라인) 는 [breakdown §2 · §3](design/238-collection-item-slots-sections-picker-items-breakdown.md#2-레퍼런스--rac-react-aria-components1210--react-ariaadobecom--starter-packagesreact-aria-startersrc-read-only).

### Hard constraints

- **RAC slot 이름 계약**: 항목 역할 자식의 `slot` 은 그 항목 provider 가 받는 이름만 (R1 · R2) — 표에 없는 이름은 저장 경로에서 거부.
- **RAC key 유일성 (R4)**: 한 collection 안 정적 항목 key 는 section 을 가로질러 유일 — 같은 origin 을 참조하는 instance 형제 (section instance 둘 · 그 상속 항목) 에서도.
- **시각 결과 보존 이관**: section 이 섞인 정적 목록 · 정적 Select/ComboBox 를 열었을 때 Canvas 픽셀이 이관 전과 같다. 재hydration Δnode · Δbyte 0.
- **선택 계약 불변**: 이관 뒤 Select · ComboBox `selectedKey` 가 이관 전과 같은 항목을 가리키고, 다시 선택했을 때 저장되는 `selectedValue` 도 이관 전과 같다 (행 `id` → 항목 `props.id` · 행 `value` → 항목 `props.value` — 두 값은 다르다). 검색어 `textValue` 는 명시값 보존 · ComboBox 자유 입력 (`inputValue`) 표시 우선순위 불변. Menu per-section selection 필드 (F6) 는 section 노드 props 로 그대로.
- **BC 수식**: 문서당 (i) Components 페이지 새 노드 — section origin 3 × (section 1 + Header 1 + 항목 ref 2) = 12 · Select/ComboBox origin 항목 ref 4 × 2 = 8 (Phase 0 실측 확정) (ii) section 이 섞인 정적 목록 1개당 section `s` · 항목 `m` → 노드 `2s + m` (iii) 정적 Select/ComboBox 1개당 행 `k` → ref 자식 `k` (항목당 150~250 B, 234 실측 범위) (iv) 바인딩 목록 · 사용자 저작 항목 자식 Δ0.
- **성능**: `scene.build` p95 증가 ≤ +1 ms (fixture 는 breakdown Phase 4).

### Soft constraints

- Components 페이지 = 테마 자리 (데이터 바인딩 없음, 09-21 판정) 유지.
- Preview iframe / Compare Mode 는 사용자 지시 (09-22) 가 풀리기 전까지 live 검증에 쓰지 않는다 — renderer unit + 사용자 확인 (09-24 예외는 237 · Disclosure 조사 한정).
- Select · ComboBox popover 항목은 Canvas 에 그려지지 않는다 (Menu 와 같음 — 편집은 Layers · Properties).

## Alternatives Considered

### 대안 A: 234 모델을 세 층으로 넓힌다 — 항목 역할 표 · section canonical 노드 · Select/ComboBox 항목 instance 자식

- 설명: 항목 type → 역할 · RAC slot 이름 표 하나를 두고 instance 역할 on/off 를 `descendants.enabled` 로 쓴다. section 을 RAC 이름의 canonical type 으로 만들고 section origin 을 owner slot 후보로 둔다. Select · ComboBox 는 Menu 선례대로 owner 자신이 목록 틀이 되고 ListBoxItem origin 의 instance 를 자식으로 갖는다. section · Select 정적 `items` 는 234 가족 표로 이관, 바인딩은 `items` 유지.
- 근거: RAC 구조 (R1~R5) · 234 규칙 하나 · Menu 선례 (F10).
- 위험: 기술 M (새 type 3 의 두 leg 배선 · RAC key 경로 유일화) / 성능 M (section · Select 항목 실제 노드화) / 유지보수 L (section · Select 가 목록 규칙 하나로 모인다) / 마이그레이션 **H** (section 목록 · Select `selectedKey` 이관을 시각 · 선택 보존으로)

### 대안 B: `items` 엔트리 모델 유지 + 항목 역할 표면만

- 설명: section 과 Select · ComboBox 는 `items` 에 두고 ItemsManager 로 편집한다. 항목 역할 on/off 표면만 더한다.
- 위험: 기술 L / 성능 L / 유지보수 **H** (같은 ListBox 가 section 유무로 두 모델 · Select 항목 모양이 ListBoxItem origin 과 따로) / 마이그레이션 L
- 한계: 234 의 "정적 목록 = instance 자식" 이 section · Select 에서 끊긴다. Select popover 항목에 origin 변형 (hover · selected) 이 닿지 않는다.

### 대안 C: section 을 Frame/Group 묶음으로 표현

- 설명: 새 type 없이 목록 안에 Frame 을 두고 Header Text + 항목을 넣는다.
- 위험: 기술 **H** (RAC collection 은 section 컴포넌트가 아닌 자식을 collection 항목으로 못 읽는다 — D1 침범) / 성능 L / 유지보수 M / 마이그레이션 M
- 한계: 접근성 (섹션 이름 · `aria-labelledby`) 과 키보드 탐색이 RAC 계약에서 빠진다.

### 대안 D: Select · ComboBox 에 canonical ListBox 자식을 두고 그 안에 항목

- 설명: RAC anatomy (`Popover > ListBox`) 를 문서에 그대로 옮겨 Select > ListBox (숨김) > ListBoxItem.
- 위험: 기술 M / 성능 L / 유지보수 **H** (선택 주인이 둘 — Select `selectedKey` 와 ListBox 자신의 선택 props 가 같은 문서에 공존) / 마이그레이션 M
- 한계: 숨은 ListBox 자식이 Layers · 팔레트 규칙 (목록 틀 = owner) 과 어긋난다. Menu 선례와 다른 모양.

### Risk Threshold Check

| 대안 | HIGH+          | 판정                                                                                 |
| ---- | -------------- | ------------------------------------------------------------------------------------ |
| A    | 마이그레이션 H | 범위 (1+2+3) 충족 — H 는 G5 (가족별 픽셀 · 선택 동일) 로 관리, 실패 가족은 이관 보류 |
| B    | 유지보수 H     | 두 모델 공존이 section · Select 로 굳는다                                            |
| C    | 기술 H         | RAC collection 계약 위반 (D1)                                                        |
| D    | 유지보수 H     | 선택 주인 이중                                                                       |

모든 대안이 HIGH 1 이상 → 루프 1회: HIGH 를 피하는 대안은 "이관 없이 새 문서만 새 모델" (A 에서 이관 제외) 인데 두 모델 공존 (B 의 H) 을 그대로 남긴다. A 의 H 는 234 · 237 과 같은 방식 (이관 전 빌드 arm 픽셀 · 선택 oracle) 으로 가족별 Gate 를 통과해야 적용하므로 수용한다.

## Decision

**대안 A** — 234 모델을 세 층으로 넓힌다.

1. **항목 안 slot**: 항목 역할 표 하나 (ListBoxItem · MenuItem · GridListItem · Tag → 허용 역할 · RAC slot 이름 · 필수 여부). 항목 instance 의 Slot 절이 optional 역할 on/off 를 `descendants[역할].enabled` 로 쓴다 (label 은 필수 — 끌 수 없다). origin 에서 표에 있으나 자식이 없는 역할을 더할 수 있다 (GridListItem icon). GridListItem `selection` · `drag` 와 Tag `remove` 는 owner 설정이 켜는 부품이라 역할이 아니다 (R6).
2. **Section 층**: 새 type `ListBoxSection` · `MenuSection` · `GridListSection` (+ `Header`, Menu 는 `Separator`). section origin 3 을 Components 페이지에 두고 owner origin slot 후보에 더한다 (owner slot 이 없을 때만 seed). section 도 slot host (후보 = 그 목록의 항목 origin). 두 leg 의 정적 항목 key — instance 자기 자식은 `props.id` (없으면 노드 id), origin 에서 상속된 항목은 `props.id` 유무와 관계없이 항상 `<instance key>/<항목 key>` (R4 · F8 · 리뷰 r1 h1).
3. **Select · ComboBox**: owner 자신이 목록 틀 (Menu 선례) — 정적 항목 = ListBoxItem origin instance 자식 · section = `ListBoxSection` instance. Canvas 는 트리거만, Preview 는 Popover > ListBox 합성. 이관이 행 `id` → 항목 `props.id` · `value` → `props.value` · `textValue` (명시값) → `props.textValue` 로 옮겨 `selectedKey` · `selectedValue` · 검색을 보존. Canvas 표시 우선순위 (`inputValue` → 선택 항목 글자 → placeholder) 는 그대로. 바인딩은 `items` 유지.
4. **이관**: section · separator 가 섞인 정적 `items` 와 정적 Select/ComboBox `items` 를 234 가족 표로 옮긴다. 하위 메뉴 행이 있는 Menu 는 계속 건너뛴다.

기각: B 는 section · Select 에서 두 모델 공존이 굳는다 · C 는 RAC collection 계약 (D1) 을 깬다 · D 는 선택 주인이 둘이 되고 Menu 선례와 모양이 갈린다.

범위 밖 (후속 ADR): Tree (재귀 항목 · chevron/selection/drag) · Table (열 × 행) · Dialog · Toast 이름 영역 (`title` · `close` · `description`) · 자유 내용 slot (Card · Dialog · Popover) · Menu 하위 메뉴 (SubmenuTrigger) · LoadMore 항목 · ColorSwatchPicker 항목.

> 구현 상세: [238-collection-item-slots-sections-picker-items-breakdown.md](design/238-collection-item-slots-sections-picker-items-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                             | 심각도 | 관리                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------- |
| R1  | Select · ComboBox 이관 뒤 `selectedKey` 가 다른 항목을 가리키거나 비선택이 된다 (행 `id` · `value` · 항목 key 의 대응이 어긋남)                                                                                                  |  HIGH  | G3 선택 oracle (이관 전 빌드 arm 의 SelectValue 글자 · Preview 초기 선택) + G5 — 실패 시 이관 보류                  |
| R2  | section 목록 이관 뒤 Canvas 헤더 행 · 항목 간격이 달라진다 (layout 의 section entry 높이 계산 → 실제 노드)                                                                                                                       |  HIGH  | G5 픽셀 oracle (이관 전 빌드 arm) — 실패 가족은 이관 보류, origin · slot 만 둠                                      |
| R3  | 같은 section origin 의 instance 형제에서 상속 항목 key 가 겹쳐 RAC 선택 · 포커스가 두 항목에 걸린다 (F8 — 44ec413ad 와 같은 뿌리). 상속 항목의 `props.id` 는 origin 값이라 `props.id` 우선 규칙으로는 막히지 않는다 (리뷰 r1 h1) |  HIGH  | G2 진단 RED (c) (`props.id` 있는 상속 항목 포함) → 상속 항목 항상 접두 key 로 GREEN · Preview 객체 동일성 조회 확장 |
| R4  | 역할 on/off 가 label 을 꺼 항목의 접근 가능한 이름이 사라지거나, 표 밖 slot 이름이 저장돼 Preview 가 크래시한다 (F5)                                                                                                             |  MED   | 역할 표 필수 표시 · 저장 경로 거부 unit (G1)                                                                        |
| R5  | section · Select 항목 실제 노드화로 `scene.build` 증가 (234 R4 · 237 R5 와 같은 성격)                                                                                                                                            |  MED   | G4 A/B — 미달 시 사용자 판정 (237 선례: 해석 증분화 먼저)                                                           |
| R6  | 바인딩 목록의 section entry 는 `items` 에 남아 section 표현이 두 가지로 공존한다 (ItemsManager 바인딩 전용 UI)                                                                                                                   |  LOW   | 234 규칙 (바인딩 = `items`) 그대로 기록                                                                             |

## Gates

| Gate | Phase   | 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 실패 시                           |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| G0   | Phase 0 | F1~~F12 재확인 · 진단 RED 5 (breakdown §4 (a)~~(e)) · 쓰기 경로 표 · 이관 수식 실측 (Components 새 노드 · section 목록 Δbyte · Select 항목당 byte)                                                                                                                                                                                                                                                                                                                                | 사실 불일치 → 본문 개정 후 재승인 |
| G1   | Phase 1 | unit (원복 RED): 항목 instance 역할 on/off 가 두 leg 에 반영 · label 끄기 거부 · 표 밖 slot 이름 저장 거부 · GridListItem icon 역할 추가 후 Preview 크래시 0 · live (Skia · store): ListBox instance 항목 description 켜기 → 행 높이 변화 · reload 그대로                                                                                                                                                                                                                         | 해당 항목 type 보류               |
| G2   | Phase 2 | unit (원복 RED): section 3 type 두 leg 렌더 (Preview = RAC section 컴포넌트, renderer unit) · Header 글자 · Menu Separator · section Slot "+" · **같은 section origin instance 둘의 상속 항목 key 유일 (진단 (c) GREEN)** · Menu per-section selection 보존 · live (Skia): ListBox section 2 · 항목 layout rect                                                                                                                                                                   | section type 보류                 |
| G3   | Phase 3 | unit (원복 RED): Select · ComboBox 항목 instance 자식 · ListBoxItem origin 편집이 popover 항목에 닿음 (Preview renderer unit) · **`selectedKey` 이관 전후 같은 항목 (SelectValue 글자 · Preview 초기 선택 · 클릭 writeback 의 `selectedValue` = 행 `value`, fixture 는 `id` ≠ `value`)** · ComboBox 입력 필터가 명시 `textValue` 로 (label 과 다른 검색어 fixture) · `inputValue` 자유 입력 표시 보존 (reload · Undo/Redo) · 바인딩 무변경 · live (Skia): 트리거 SelectValue 글자 | Select/ComboBox 이관 보류         |
| G4   | Phase 4 | 같은 세션 headed A/B (대조 arm = 238 전 빌드 worktree) · `scene.build` p95 median Δ ≤ +1 ms · 측정 대상 = 사람이 만든 모양 fixture (Q1) · 불리 조작 포함 (항목 origin 편집 · breakpoint 전환, Q2) · 총비용 A/B (Q3)                                                                                                                                                                                                                                                               | 사용자 판정                       |
| G5   | Phase 4 | BC: 가족별 이관 전후 Canvas 픽셀 동일 (section 목록 3 · Select · ComboBox, oracle = 238 전 빌드 arm) · 선택 동일 · Δbyte 수식 일치 · 재hydration Δ0 (unit + IndexedDB 저장 층 live)                                                                                                                                                                                                                                                                                               | 실패 가족 이관 보류               |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- ListBox · Menu · GridList · Select · ComboBox 의 항목 · section 이 한 규칙 (origin · instance · slot) 으로 모인다 — RAC collection 구조와 같은 층.
- 항목 instance 에서 역할 (icon · description · shortcut …) 을 켜고 끌 수 있다.
- ListBoxItem origin 하나가 ListBox · Select · ComboBox 항목 모양을 같이 정한다 (상태 변형 포함).
- section 이 섞인 목록도 정적 목록 규칙을 탄다 — 목록 모델이 section 유무로 갈리지 않는다.

### Negative

- 새 canonical type 3 과 catalog entry 3 — 두 leg 배선 · 팔레트 규칙 · AI tool 카탈로그 유지 범위가 넓어진다.
- Components 페이지 노드가 약 20 늘어난다.
- Select · ComboBox popover 항목은 Canvas 에 보이지 않아 Layers · Properties 로만 편집한다 (Menu 와 같음).
- 바인딩 목록의 section 은 `items` 엔트리로 남는다 (R6).
