# ADR-237: origin · instance · slot 적용 확장 — 그룹 컨테이너 slot · Breadcrumbs 항목 · 항목 상태 변형

## Status

Implemented — 2026-09-24 (`/execute-adr 237` Phase 0~~4 / G0~~G5 같은 날 종결 — [실행 기록](../design/237-origin-instance-slot-extension-breakdown.md#7-실행-기록)) · Accepted — 2026-09-24 (사용자 `/execute-adr 237`, Codex 리뷰 판독 1 + 수리 검증 1 종결 후) · Proposed — 2026-09-24

G4 는 사용자 판정 2단계로 닫았다 (2026-09-24): ① 같은 세션 A/B (237 전 빌드 대조) 에서 Breadcrumbs 100 × 5 편집이 +3.5~~3.7 ms 로 미달 → "해석 증분화 먼저" (leaf ref instance 재사용 — ownerEdit +3.7 → +1.5~~2.0) ② 남은 미달 (Breadcrumbs ownerEdit +1.5~2.0 · 항목 origin 편집 +4.1 ms @500 항목) → "예외로 기록 후 승격". CheckboxGroup 100 × 5 는 세 조작 모두 통과. 잔존 위험 R5 참조.

설계 요청: 사용자 (2026-09-24) — "components page 의 컴퍼넌트들 reusable, origin, instance, slot 화를 더 진행 가능한 컴퍼넌트 RAC 레퍼런스 기준으로 분석" → 분석 결과 네 묶음 중 사용자 선택 "1+2" 로 `/create-adr`. 범위와 전제 (234 = base, 237 = 적용 확장, 새 저장 필드 없음) 는 AskUserQuestion 으로 확정 ([breakdown §1](../design/237-origin-instance-slot-extension-breakdown.md#1-전제-확정-기록-fork-4-질문--사용자-confirm)).

## Context

### 문제

[ADR-234](234-variant-instances-and-slot-filled-collections.md) 가 "변형 = 가장 완성된 상태 origin 의 instance · slot = 목록 틀의 추천 항목 · 목록 = instance 자식" 을 정했지만 적용은 목록 틀 5종 (TabList · TagList · ListBox · GridList · Menu) 과 상태 변형 6종에 그쳤다. RAC 레퍼런스와 대조하면 같은 구조인데 모델 밖에 있는 곳이 세 갈래다.

1. **그룹 컨테이너 — 자식은 instance 인데 slot 이 없다.** CheckboxGroup · RadioGroup · ToggleButtonGroup · DisclosureGroup · ButtonGroup · Pagination · AvatarGroup · Nav · Toolbar 는 RAC 에서 독립 컴포넌트를 자식으로 받고 (breakdown R1), origin 자식은 이미 origin 의 ref 다 (F2). 그러나 Slot "+" 판정이 type 별 if 문 5종에 고정돼 (F1) instance 에서 항목을 추가할 길이 없다 — 사용자 모델 ④단계 ("instance 에서 slot 항목 추가") 가 막혀 있다. 선택은 Checkbox · ToggleButton 에서 두 leg 가 같은 계약을 쓴다 — 자식 `isSelected` 가 정본이고 RAC key 는 node id 다 (F6 · F11). Radio 는 다르다: Canvas 표시는 그룹 `value` 가 있으면 그것을 먼저 읽고, Preview 는 `isSelected` 인 첫 자식을 먼저 읽는다 (F14) — 두 값이 어긋나면 두 leg 가 다른 항목을 선택으로 그린다. 237 은 Slot 으로 넣은 항목이 두 leg 가 같게 읽는 모양으로만 저장되게 한다. 곁가지 결함 2: CardView 의 Card 자식은 plain 에 남았고 (F3), IconButton 은 변형 base 판정이 id 비교라 변형이 없다 (F4).
2. **Breadcrumbs — RAC collection 인데 `items` 가상 행.** 정적 `<Breadcrumb id>` 자식 구조 (R3) 이지만 Canvas 는 `items` projection, Preview 는 `items` 정본 + 자식 BC 폴백이다 (F8). 234 가 범위 밖으로 남겼다.
3. **항목 · Disclosure 상태 — RAC render props 는 있는데 변형 노드가 없다.** 항목 5종의 hover · pressed · focus-visible · disabled (R4) 와 Disclosure `isExpanded` (R5) 는 Components 페이지에 변형 origin 이 없어 테마 자리에서 편집할 수 없다 (F5 · F7). GridListItem 은 selected 쌍도 없다.

### 3-Domain

- **D3 (시각)**: 상태별 모양의 정본 = 변형 노드 덮어쓰기 (234 그대로). 두 consumer 가 같은 층을 겹친다 — Canvas 는 선언적 상태 (selected · disabled · 새 expanded), Preview 는 RAC render props.
- **D1 (RAC, 관찰만)**: 그룹의 선택 key 계약 (R2) · Breadcrumbs 정적 자식과 마지막 = current 규칙 (R3) · render props (R4 · R5) 를 그대로 쓴다. DOM 구조 재작성 없음.
- **D2**: 새 컴포넌트 prop 없음. Slot "+" 는 기존 prop (`isSelected` · Radio `value`) 값만 채운다.
- **SSOT 경계 변경 없음.** RAC 내부 sub-part (Label · Input · SelectTrigger · DisclosureHeader/Content 등) 는 parent rule delegation 유지 (09-21 판정 (a)).
- **ADR-236 과의 관계**: 236 의 타입 특성 표가 먼저 반영되면 237 의 slot host 표는 그 위치에 둔다 (표 내용은 237 이 정한다). 의존 방향 없음.

### 코드 사실

레퍼런스 R1~~R5 · 코드 사실 F1~~F10 (경로:라인) 은 [breakdown §2 · §3](../design/237-origin-instance-slot-extension-breakdown.md#2-레퍼런스--rac-starter-packagesreact-aria-startersrc-read-only).

### Hard constraints

- **시각 결과 보존 이관**: 기존 문서를 열었을 때 Canvas 픽셀이 이관 전과 같다 (Breadcrumbs 정적 목록 · CardView · 그룹 origin). 재hydration Δnode · Δbyte 0.
- **BC 수식**: 문서당 (i) Components 페이지 새 변형 노드 — 항목 5종 × 상호작용 4 (20) + GridListItem `--unselected` 1 + Disclosure `--collapsed` 1 + IconButton 4 = 26 노드 (Phase 0 실측 확정) (ii) 그룹 origin 9 에 `slot` 필드 +1 (iii) 사용자 정적 Breadcrumbs 1개당 항목 `n` → ref 자식 `n` (항목당 150~250 B 추정, 234 실측 범위) (iv) CardView 1개당 Card 3 → ref + `enabled:false` patch. 바인딩 목록 · 사용자 저작 그룹 자식 Δ0.
- **선택 계약 불변 · 삽입 후 두 leg 일치**: Slot 으로 넣은 그룹 항목의 선택은 기존 reader (Checkbox · ToggleButton = 자식 `isSelected` · node id / Radio = 그룹 `value` 우선 (Canvas) · 첫 `isSelected` 자식 (Preview)) 를 바꾸지 않고, 삽입 직후 두 leg 가 같은 항목을 선택으로 그린다. 단일 선택 그룹 (RadioGroup · `selectionMode:"single"` ToggleButtonGroup) 에 선택 후보를 넣으면 한 history 항목 안에서 형제 선택을 해제한다 (RadioGroup 은 그룹 `value` 도 새 항목 값으로 — Preview onChange writeback 과 같은 모양). Radio `value` 는 그룹 안 유일값.
- **성능**: `scene.build` p95 증가 ≤ +1 ms (Breadcrumbs 100 × 5 · CheckboxGroup 100 × 5 fixture, 234 G4 방식).
- **상태는 구조를 지우지 않는다**: 상태 변형은 상태가 표시를 정하는 자식 (DisclosureContent 등) 에 `enabled:false` 를 싣지 않는다 — `enabled` 는 상태 해석 전에 자식을 지워 (F12) 반대 상태로 되돌릴 수 없다. RAC 도 상태가 바뀌어도 DOM 구조는 같다.
- **RAC 계약**: hover · pressed · focus 는 Canvas 가 그리지 않는다 (150 A1 철회) — Components 페이지 변형 노드 자신만 강제 상태.

### Soft constraints

- Components 페이지 = 테마 자리 (데이터 바인딩 없음, 09-21 판정) 유지.
- Preview iframe / Compare Mode 는 사용자 지시 (09-22) 가 풀리기 전까지 live 검증에 쓰지 않는다 — renderer unit + 사용자 확인.

## Alternatives Considered

### 대안 A: 234 모델을 그대로 확장 — slot host 표 · 기존 선택 계약 위의 그룹 slot · 항목 상태 변형 · Breadcrumbs 이관

- 설명: slot host 판정을 type 별 if 문에서 표 하나 (host → 후보 · 넣기 동작 · key 배정) 로 바꾸고 그룹 9종을 행으로 더한다. 그룹 선택은 기존 자식 `isSelected` 계약을 그대로 쓰고 Slot "+" 가 그 값을 채운다. 변형 대상 표를 항목 템플릿 5 · IconButton · Disclosure 로 넓힌다 (상태 어휘 `expanded` 추가). Breadcrumbs 를 234 정적 목록 가족에 더한다.
- 근거: RAC 구조 (R1~R5) · 234 의 규칙 하나 (완성된 상태 origin + ref 변형 · slot = 추천 항목).
- 위험: 기술 M (상태 어휘 추가가 두 leg 공용 모듈을 지난다 · 항목 wrapper render props 확인) / 성능 M (Breadcrumbs 실제 노드화) / 유지보수 L (if 문 → 표, 규칙 수렴) / 마이그레이션 **H** (Breadcrumbs `items` → 자식 · CardView re-root 를 시각 보존으로)

### 대안 B: 그룹에 Frame 식 "자식 넣기" 만 허용 — 선택 값 · Radio key 처리 없이

- 설명: 그룹 9종을 `FRAME_SLOT_HOST_TYPES` 처럼 host 로 열고 아무 origin ref 나 넣게 한다.
- 위험: 기술 L / 성능 L / 유지보수 M / 마이그레이션 L
- 한계: 넣은 Radio 가 기존 자식과 같은 `value` 를 가져 RAC 선택이 둘 다 켜진다 (진단 RED (b)). 선택 상태 후보를 골라도 `isSelected` 가 안 실려 선택 모양이 나오지 않는다. 추천 항목 목록 (slot) 의 뜻이 사라진다.

### 대안 C: 항목 상태 모양을 catalog 상태 토큰에 두고 변형 노드를 만들지 않는다

- 설명: 항목 hover · pressed 는 지금처럼 catalog rule fill state 토큰이 정하고, Components 페이지에는 노드를 두지 않는다.
- 위험: 기술 L / 성능 L / 유지보수 M (상태 정본이 두 곳 — 선택은 변형 노드, hover 는 토큰) / 마이그레이션 L
- 한계: 사용자 판정 (09-21 "상태별 별도 origin" · 09-23 "변형 = origin 의 instance") 과 어긋난다. 테마 자리에서 항목 hover 를 편집할 수 없다.

### 대안 D: Breadcrumbs 는 `items` 유지 + 항목 origin 을 템플릿 read-through 로

- 설명: 229 방식처럼 Breadcrumb origin 을 두되 목록은 `items` 가상 행으로 두고 origin style 을 읽어 그린다.
- 위험: 기술 M / 성능 L / 유지보수 **H** (234 가 대체한 템플릿 모델 부활 — 정적 목록 뜻이 컴포넌트마다 갈림) / 마이그레이션 L
- 한계: instance 에서 항목을 추가 · 편집하는 경로가 234 목록 5종과 다르다.

### Risk Threshold Check

| 대안 | HIGH+          | 판정                                                                        |
| ---- | -------------- | --------------------------------------------------------------------------- |
| A    | 마이그레이션 H | 범위 (1+2) 충족 — H 는 G5 (가족별 픽셀 동일) 로 관리, 실패 가족은 이관 보류 |
| B    | 없음           | Radio key 중복 · 선택 후보 무효                                             |
| C    | 없음           | 사용자 판정 불충족                                                          |
| D    | 유지보수 H     | 234 모델과 두 뜻 공존                                                       |

HIGH 가 없는 B · C 는 RAC 계약 또는 사용자 판정을 채우지 못해 기각한다. A 의 HIGH 는 234 와 같은 방식 (이관 전 빌드 arm 픽셀 oracle) 으로 가족별 Gate 를 통과해야 적용한다.

## Decision

**대안 A** — 234 모델을 그대로 넓힌다.

1. **slot host 표**: Slot "+" host · 후보 · 넣기 동작 · 값 채우기를 표 하나가 정한다. 기존 5종은 행으로 옮기고 동작 무변경. 새 행 = 그룹 9종 (CheckboxGroup · RadioGroup · ToggleButtonGroup · DisclosureGroup · ButtonGroup · Pagination · AvatarGroup · Nav · Toolbar).
2. **그룹 origin slot**: 9종 origin 에 `slot: [후보 origin]` — 새 문서 seed, 기존 문서 hydration repair (reusable 이고 slot 이 없을 때만).
3. **선택 계약 (review round 1 h1)**: 두 leg 의 현행 선택 reader (F6 · F11 · F14) 는 바꾸지 않는다 — 그룹 `value`/`selectedKeys` 를 새 원천으로 만들지 않고 uncontrolled + key re-mount 경로도 그대로. Slot "+" 는 선택 상태 origin 후보면 `isSelected: true`, `--unselected` 면 `false` 를 새 자식 prop 으로 쓰고, Radio 는 그룹 안 유일 `value` 를 배정한다. **단일 선택 정규화 (round 2 h3)**: RadioGroup 에 선택 후보를 넣으면 한 history 항목 안에서 새 Radio `isSelected: true` · 형제 Radio `isSelected: false` · 그룹 `value` = 새 Radio `value` (Preview onChange writeback 과 같은 모양 — Canvas 는 그룹 `value`, Preview 는 첫 `isSelected` 자식을 읽어도 같은 항목). `selectionMode:"single"` ToggleButtonGroup 은 형제 `isSelected: false` 만 (ToggleButton writeback 은 자식만 쓴다 — round 2 l1). 비선택 후보는 형제 · 그룹 값을 건드리지 않는다.
4. **IconButton · CardView 수리**: 변형 base 판정 = reusable origin 이고 root type 이 표에 있음 (id 비교 폐지). CardView Card 자식 = Card origin ref + origin 에만 있는 자식 `enabled:false`.
5. **항목 · Disclosure 변형**: 변형 대상 표 = base 요소 6 + 항목 템플릿 5 (Tab · Tag · ListBoxItem · GridListItem · MenuItem — hover · pressed · focus-visible · disabled) + IconButton + Disclosure. GridListItem 은 origin = selected + `--unselected` (234 이관 함수). Disclosure 는 origin = 펼침 + `--collapsed` = ref + props `isExpanded: false` 와 style patch 만 (review round 1 h2 — 구조 patch 금지, 본문 표시는 유효 펼침 상태가 정한다). 상태 어휘에 `expanded` 추가 — Canvas 유효 상태 = 강제 (Components 변형 노드) → `isDisclosureExpandedInContext` (prop 부재 = 펼침 · 그룹 단일 펼침 제약, round 1 m1), Preview = RAC render prop `isExpanded`.
6. **Breadcrumbs**: 항목 origin `component-breadcrumb-item-default` (링크 모양) + `--current` ref. Breadcrumbs origin 이 slot host (목록 틀 = owner 자신). 정적 `items` → Breadcrumb instance 자식 이관 (234 가족 표에 추가), 바인딩 목록은 `items` 유지. 마지막 = current 판정은 RAC 위치 규칙이 정본.

기각: B 는 Radio key 중복과 선택 후보 무효가 남는다 · C 는 사용자 판정 (상태별 origin) 불충족 · D 는 234 가 대체한 템플릿 모델을 되살린다.

범위 밖 (후속 ADR): Select · ComboBox 항목 origin (Menu 선례) · Tree (중첩 · 펼침) · Table/TableView (열 × 행) · Menu section/submenu · Checkbox indeterminate · 자유 내용 컨테이너 (Card · Dialog · Popover) 의 내용 slot.

> 구현 상세: [237-origin-instance-slot-extension-breakdown.md](../design/237-origin-instance-slot-extension-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                        | 심각도 | 관리                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------- |
| R1  | Breadcrumbs 이관 후 구분자 · 마지막 항목 모양이 Canvas 에서 달라진다 (projection → 실제 자식)                                                                                                                                                                                                               |  HIGH  | G5 픽셀 oracle (이관 전 빌드 arm) — 실패 시 이관 보류, origin · slot 만 둠 |
| R2  | 항목 wrapper 중 render props 로 상태 층을 못 겹치는 것이 있어 hover 변형이 Preview 에 안 닿는다                                                                                                                                                                                                             |  MED   | G2 원복 RED — 실패 wrapper 는 변형 seed 보류 + 보고                        |
| R3  | `expanded` 어휘 추가가 두 leg 공용 상태 모듈의 기존 층 순서를 바꾼다                                                                                                                                                                                                                                        |  MED   | 234 `stateVariantLayers` 층 순서 unit 계승 + 새 상태 행만 추가             |
| R4  | Radio `value` 배정이 사용자가 직접 쓴 `value` 와 충돌하거나, 복사 · 붙여넣기 · AI tool 경로가 선택 `isSelected` 를 다른 모양으로 쓴다. 기존 문서에 이미 그룹 `value` 와 자식 `isSelected` 가 어긋난 RadioGroup 은 237 전부터 두 leg 가 갈린다 (F14 — 237 은 삽입 경로만 정규화, 기존 불일치 수리는 범위 밖) |  MED   | 쓰기 경로 표 (G0) · 경로별 unit (G1)                                       |
| R5  | Breadcrumbs 실제 노드화로 `scene.build` 증가 (234 R4 와 같은 성격). **실측 (G4, 사용자 판정 "예외로 기록 후 승격" 2026-09-24)**: 항목 500 개 문서의 owner 편집 +1.5~2.0 ms · 항목 origin 편집 +4.1 ms · breakpoint +1.0 (해석 증분화 뒤). 재개 조건 = 실제 문서에서 체감 저하 보고                          |  MED   | leaf ref instance 재사용 (G4 1단계) · 잔여는 예외 기록                     |
| R6  | 상태 변형 편집 (Styles 패널) 이 상태가 표시를 정하는 자식에 `enabled:false` 를 써 반대 상태에서 본문이 사라진다                                                                                                                                                                                             |  MED   | 변형 쓰기 경로에서 해당 patch 거부 unit (G2) · 왕복 검증                   |

## Gates

| Gate | Phase   | 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 실패 시                           |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| G0   | Phase 0 | F1~~F10 재확인 · 진단 RED 7 (breakdown §4 (a)~~(g)) · 쓰기 경로 표 · 이관 수식 실측 (새 변형 노드 수 · slot 필드 · Breadcrumbs 항목당 byte · CardView patch)                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 사실 불일치 → 본문 개정 후 재승인 |
| G1   | Phase 1 | unit (원복 RED): 기존 5 host 동작 무변경 · 그룹 9종 Slot "+" · Slot 으로 넣은 Checkbox/ToggleButton/Radio 의 선택이 Canvas 모양 · Preview 초기값 (`defaultValue`/`defaultSelectedKeys`) · 클릭 writeback 에서 같은 key (node id, Radio 는 `value`) · Radio `value` 유일 · **선택된 Radio A 가 있는 그룹에 선택 후보 B 삽입 → Canvas 표시 reader (`buildSpecNodeData` 그룹 `value` 우선) 와 Preview 초기 선택이 모두 B · A 는 비선택 · undo 한 번에 원래대로** · 단일 선택 ToggleButtonGroup 같은 입력 · 그룹 값만 있는 기존 문서 동작 무변경 · IconButton 변형 생성 · CardView ref 이관 전후 Canvas 픽셀 동일 | 해당 그룹/수리 보류               |
| G2   | Phase 2 | 항목 5종 변형 노드 · 변형 편집이 해당 상태에만 (Preview renderer unit — render props 경로) · GridListItem selected 쌍 이관 · Disclosure origin 참조 · `--collapsed` 참조 각각 닫힘 → 펼침 → 닫힘 왕복에서 본문 · chevron · 상태 층이 같이 바뀜 (두 leg) · 단일 펼침 그룹의 둘째 Disclosure 는 raw `isExpanded:true` 여도 접힘 층 · 상태 변형의 구조 patch 거부 · 234 층 순서 unit 무변경                                                                                                                                                                                                                      | 실패 wrapper 는 변형 보류 + 보고  |
| G3   | Phase 3 | Breadcrumbs slot · Slot "+" 항목 instance · 정적 목록 두 leg 가 자식을 그림 · 마지막 = current · 바인딩 목록 무변경 · 쓰기 경로별 unit                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Breadcrumbs 이관 보류             |
| G4   | Phase 4 | 같은 세션 headed A/B (234 G4 방식, 대조 arm = 이관 전 빌드) · `scene.build` p95 median Δ ≤ +1 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 사용자 판정                       |
| G5   | Phase 4 | BC: 가족별 이관 전후 Canvas 픽셀 동일 (Breadcrumbs · CardView, oracle = 이관 전 빌드 arm) · Δbyte 수식 일치 · 재hydration Δ0 (unit + IndexedDB 저장 층 live)                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 가족 이관 보류               |

### Live Exercise

실제 builder (dev 서버 · headed Playwright · 새 프로젝트, Compare Mode · Preview iframe 미개방 — 사용자 지시) 에서 Skia layout · scene · store · IndexedDB 로 확인했다 (2026-09-24).

- `adr237-live-exercise.mjs` **9/9**: seed (그룹 origin 9 slot · 변형 26 ref · Breadcrumbs 자식 3 · CardView Card ref 3) · 그룹 instance 9 에 Slot "+" (instance 자기 자식 1 · 선택 후보 `isSelected:true` · Radio 유일 `value` · 접힘 후보 `isExpanded:false` · Canvas layout rect) · RadioGroup 선택 후보 두 번 → Skia reader 로 둘째만 선택 · 그룹 value = 둘째 · undo 한 번에 첫째 선택 복원 · Disclosure 닫힘 → 펼침 → 닫힘 (scene `isExpanded` · 본문 layout 높이 0 → 20 → 0) · Breadcrumbs instance crumb 3 가로 배치 · Slot "+" 4 번째 crumb 이 오른쪽 · reload 그대로 · page error 0.
- `adr237-g5-bc-live.mjs` **19/19 픽셀 Δ0**: 237 전 빌드 (`ee6ecb890` worktree) 가 저장한 문서를 IndexedDB 로 옮겨 reload — Breadcrumbs (origin · palette instance · plain items · items override) · CardView · DisclosureGroup (단일 펼침 포함) · Disclosure · GridList (+ GridListItem 역할 짝) · 그룹 3 · IconButton · Tabs · 재hydration Δ0 · 오류 0.
- `adr237-g4-perf-ab.mjs`: 위 G4 판정 수치.
- live 에서 잡은 결함 2 (수리): instance 자기 자식 (Slot "+" 항목) 이 Canvas layout 에서 상속 자식 앞에 놓임 (Preview 와 발산) · 자동 폭 Breadcrumbs 의 마지막 crumb 이 구분자 폭까지 잡혀 넓어짐 (190 → 210).
- `adr237-compare-mode.mjs` **7/7** (사용자 지시 "Compare Mode 로 체크해" — Preview iframe 을 연 확인, 2026-09-24): CheckboxGroup Slot "+" 선택 후보 → Preview 새 Checkbox 만 `data-selected` · Skia 도 선택 · RadioGroup 선택 후보 두 번 → Preview · Skia reader 모두 둘째만 · ToggleButtonGroup (single) 새 항목만 선택 · DisclosureGroup 접힘 후보 → Preview 접힘 · Skia `isExpanded:false` · Breadcrumbs instance + "+" → crumb 4 · 마지막만 `data-current` · Tab `--hover` 변형 편집 → hover 한 Tab 만 빨강, 떠나면 복귀 · page error 0.
- Compare Mode 화면에서 본 237 밖 기존 발산 (237 전 문서 모양 · G5 Skia Δ0 으로 확인): 그룹 origin 의 상속 항목 라벨이 Preview "Checkbox"/"Radio" (Label 자식) vs Skia "Option 1"/"Option 2" (root `children`) · Skia DisclosureGroup instance 본문 좁은 줄바꿈. → 2026-09-24 후속 수리: 본문 줄바꿈 `742fd3ee3` · 상속 항목 라벨 (seed 전파값 patch + 기존 문서 repair + Preview delegating 렌더의 로컬 id 중복 — 두 Checkbox 가 마지막 Label 을 그림) · Skia 전용 DisclosureGroup 1px 테두리 (catalog `borderWidth` none).

## Consequences

### Positive

- Components 페이지의 그룹 · 목록 · 항목이 한 규칙 (완성된 상태 origin · ref 변형 · slot 추천 항목 · instance 자식) 으로 모인다 — RAC 구조와 같은 모양.
- instance 에서 Slot "+" 로 그룹 항목을 추가할 수 있다 (사용자 모델 ④ 확장).
- Slot 으로 넣은 그룹 항목이 기존 선택 계약에 그대로 올라탄다 — 선택 상태 후보를 고르면 두 leg 에서 선택 모양.
- Slot host 판정이 표 하나로 줄어 새 컴포넌트 추가 비용이 행 하나가 된다.

### Negative

- Components 페이지 노드가 약 26 늘어난다 (변형 노드).
- Breadcrumbs 정적 목록은 노드 수가 늘어 `scene.build` 비용이 오른다 (R5).
- 상태 어휘가 6개가 되어 (`expanded`) 두 leg 공용 모듈 유지 범위가 넓어진다.
- Select · ComboBox · Tree · Table 은 여전히 `items`/plain 모델이라 후속 ADR 까지 두 모델이 공존한다.
