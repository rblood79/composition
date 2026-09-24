# ADR-239: Tree · Menu 하위 메뉴 · ColorSwatchPicker 항목 origin — 재귀 항목의 origin · instance · slot

## Status

Proposed — 2026-09-24

설계 요청: 사용자 (2026-09-24) — RAC 조사 후보 중 ADR-238 에 넣지 않은 항목을 "설계부터 하자" → 사용자 판정 (AskUserQuestion): 3 ADR 로 분리 (239 Tree · 240 이름 영역 · 241 Table), 작은 항목 (Menu 하위 메뉴 · LoadMore · ColorSwatchPicker) 은 이 ADR 에 포함. 전제 기록: [breakdown §1](design/239-tree-submenu-swatch-item-origins-breakdown.md#1-전제-확정-기록-fork-4-질문--사용자-confirm).

## Context

### 문제

RAC 에서 **항목 안에 같은 종류 항목이 들어가는** 재귀 collection 이 셋이다 — Tree (`TreeItem` 안 `TreeItem`, R1), Menu 하위 메뉴 (`SubmenuTrigger` 안 `Menu > MenuItem`, R4), 그리고 항목이 한 층뿐이지만 같은 모양으로 반복되는 ColorSwatchPicker (R5). composition 은 이 셋에서 234 모델 (origin · instance · slot) 밖에 있다.

1. **Tree** — 항목은 이미 canonical TreeItem 요소지만 (F1) origin 자식이 plain 이고 slot · 항목 origin · 상태 변형이 없다 (F2). 게다가 **펼침이 두 leg 에서 갈린다**: Preview 는 `expandedKeys` 부재 = 전부 접힘 (RAC 기본), Canvas 는 펼침을 읽지 않고 전부 펼쳐 그린다 (F3 · F4).
2. **Menu 하위 메뉴** — `items` 의 `children` 으로만 저장되고 (F7), 정적 이관은 그런 Menu 를 건너뛰며, section 이 섞인 구조 경로에서는 Preview 가 하위 메뉴를 버린다.
3. **ColorSwatchPicker** — swatch 는 이미 ColorSwatch 자식이지만 reusable origin 이 없고, 같은 색 swatch 를 넣으면 RAC 선택이 둘 다 켜진다 (R5). binding 이 받는 prop 도 Preview picker 에 닿지 않는다 (F9).

### 3-Domain

- **D1 (RAC, 관찰만)**: 재귀 구조 · 펼침 (`expandedKeys`) · 하위 메뉴 (`SubmenuTrigger`) · swatch 선택 값 (색) 을 RAC 그대로. chevron · selection · drag 는 owner 설정이 켜는 부품 (R2) — 역할 아님.
- **D2**: 새 prop 없음. `expandedKeys` 는 Tree 기존 prop.
- **D3**: TreeItem · ColorSwatch 모양 = 새 항목 origin (Components 페이지). ColorSwatch Canvas 는 box 만 — 2026-06-11 사용자 방침 유지 (F10).
- **SSOT 경계 변경 없음.** 새 노드 type 없음.
- **선행**: [ADR-238](238-collection-item-slots-sections-picker-items.md) 의 항목 역할 표 · 경로 포함 항목 key 를 재사용 — 238 이 먼저 반영돼야 한다 (의존 239 → 238).

### 코드 사실

레퍼런스 R1~~R6 · 코드 사실 F1~~F11 (경로:라인) 은 [breakdown §2 · §3](design/239-tree-submenu-swatch-item-origins-breakdown.md#2-레퍼런스--rac-react-aria-components1210--starter-packagesreact-aria-startersrc-read-only).

### Hard constraints

- **펼침 두 leg 일치**: 같은 Tree 문서에서 Canvas 와 Preview 가 같은 항목 집합을 보인다 (정본 = `expandedKeys`).
- **Canvas 시각 보존**: 기존 문서를 열었을 때 Canvas 픽셀이 이관 전과 같다 (Tree 는 지금 전부 펼쳐 그리므로 그 상태를 `expandedKeys` 로 굳힌다). Preview Tree 는 접힘 → 펼침으로 바뀐다 (두 leg 일치를 위한 의도된 변화 — 영향 범위 = 중첩 TreeItem 이 있고 `expandedKeys` 가 한 번도 쓰이지 않은 Tree).
- **RAC key 유일**: TreeItem · MenuItem 은 깊이를 가로질러, swatch 는 색으로 유일.
- **BC 수식**: 문서당 (i) Components 새 노드 — TreeItem origin 2 + 상호작용 변형 4 + `--collapsed` 1 · ColorSwatch origin 1 · ColorSwatchPicker origin 1 (+ swatch ref 6) (ii) 사용자 Tree plain TreeItem `n` → ref `n` (iii) `children` 이 있는 정적 Menu 행 `k` → 중첩 ref `k` (iv) 사용자 ColorSwatchPicker swatch `s` → ref `s` (v) 바인딩 Tree · Menu Δ0. 항목당 byte 는 Phase 0 실측.
- **성능**: `scene.build` p95 증가 ≤ +1 ms.

### Soft constraints

- Components 페이지 = 테마 자리 (데이터 바인딩 없음).
- Preview iframe / Compare Mode 는 사용자 지시 전까지 live 검증에 쓰지 않는다 — renderer unit + 사용자 확인.

## Alternatives Considered

### 대안 A: 234 모델을 재귀 항목으로 — 항목 origin · owner 와 항목 둘 다 slot host · 펼침 정본 `expandedKeys` 를 Canvas 도 읽음

- 설명: TreeItem · ColorSwatch origin (+ 상태 변형) 을 두고, Tree · TreeItem · Menu · MenuItem · ColorSwatchPicker 를 slot host 로 연다 (항목 host 의 후보는 소속 owner 의 slot). Canvas 가 Tree `expandedKeys` 를 읽어 접힌 자식을 빼고, 기존 문서는 "지금 Canvas 에 보이는 대로" `expandedKeys` 를 채워 이관한다. Menu 의 `children` 행과 ColorSwatchPicker swatch 를 instance 자식으로 옮긴다.
- 위험: 기술 M (재귀 key · 펼침 판정의 layout/Skia 공용화) / 성능 M (깊은 Tree 의 ref 해석) / 유지보수 L (Tree 가 목록 규칙 하나로) / 마이그레이션 **H** (`expandedKeys` 이관이 Preview 표시를 바꾼다 · Menu 하위 메뉴 이관)

### 대안 B: Canvas 도 RAC 기본대로 전부 접힘 (이관 없음)

- 설명: `expandedKeys` 부재 = 접힘을 Canvas 에도 적용.
- 위험: 기술 L / 성능 L / 유지보수 L / 마이그레이션 **H** (기존 문서의 Canvas 가 중첩 항목을 전부 잃는다 — 사용자가 저작하며 보던 화면이 바뀐다)

### 대안 C: 펼침은 그대로 두고 origin · slot 만

- 설명: 두 leg 펼침 발산을 남기고 항목 origin · slot 만 도입.
- 위험: 기술 L / 성능 L / 유지보수 **H** (재귀 항목을 Slot "+" 로 넣을수록 Canvas 와 Preview 의 발산이 커진다 — D3 대칭 위반을 확대) / 마이그레이션 L

### 대안 D: Tree 를 `items` 데이터 모델 (dynamic Tree, R1 의 render 함수) 로

- 설명: TreeItem 요소를 `items` 트리로 되돌리고 항목 템플릿 하나로 그린다.
- 위험: 기술 M / 성능 L / 유지보수 **H** (234 가 대체한 템플릿 모델 부활 — 정적 목록 뜻이 Tree 만 다름) / 마이그레이션 **H** (이미 요소인 항목을 데이터로 역이관)

### Risk Threshold Check

| 대안 | HIGH+                       | 판정                                                                  |
| ---- | --------------------------- | --------------------------------------------------------------------- |
| A    | 마이그레이션 H              | Canvas 는 보존, Preview 는 두 leg 일치 방향으로만 바뀐다 — G6 로 관리 |
| B    | 마이그레이션 H              | 저작 화면 (Canvas) 을 깨는 쪽                                         |
| C    | 유지보수 H                  | 대칭 위반 확대                                                        |
| D    | 유지보수 H · 마이그레이션 H | 234 모델 역행                                                         |

모든 대안이 HIGH 1 이상 → 루프 1회: 발산을 없애려면 어느 한 leg 는 바뀌어야 한다 (A = Preview, B = Canvas). 사용자가 저작하며 보는 쪽 (Canvas) 을 보존하는 A 의 H 를 수용한다.

## Decision

**대안 A** — 234 모델을 재귀 항목으로 넓힌다.

1. **Tree**: TreeItem origin (선택 상태 + `--unselected` · 상호작용 4 · `--collapsed`) · 역할 = 238 역할 표에 TreeItem 행 (icon · label ● · description). Tree origin 자식 = TreeItem instance (중첩 예시 1) · `slot` = TreeItem origin. Tree 와 TreeItem instance 가 slot host (TreeItem 의 후보 = 소속 Tree slot). key = 238 경로 포함 key.
2. **펼침**: 정본 = Tree `expandedKeys`. Canvas layout 과 Skia 가 한 판정 함수로 접힌 자식을 빼고 chevron 방향을 정한다. 기존 문서 중 중첩 항목이 있고 `expandedKeys` 가 없는 Tree 는 부모 항목 key 전부로 채운다 (1회 · 멱등).
3. **Menu 하위 메뉴**: MenuItem instance 의 자식 MenuItem = 하위 메뉴 (Preview `SubmenuTrigger` 합성, 정적 · 구조 경로 공통). MenuItem 도 slot host. `children` 행 정적 이관.
4. **ColorSwatchPicker**: ColorSwatch origin (팔레트 밖) · ColorSwatchPicker origin (swatch ref 6 · `slot`) · slot host (넣을 때 형제와 다른 색 배정). Preview picker 에 binding props 전달. Canvas box 유지.
5. **LoadMore**: 저작 모델에 넣지 않는다 — 바인딩 목록 런타임 부품 (R6 · F11).

기각: B 는 저작 화면 (Canvas) 을 깬다 · C 는 대칭 위반을 넓힌다 · D 는 234 가 대체한 템플릿 모델로 되돌아간다.

범위 밖: TreeSection (RAC alpha) · Tree drag and drop · NavigationTree · ColorSwatch Canvas 색 (06-11 방침).

> 구현 상세: [239-tree-submenu-swatch-item-origins-breakdown.md](design/239-tree-submenu-swatch-item-origins-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                | 심각도 | 관리                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------ |
| R1  | `expandedKeys` 이관이 사용자 의도와 다른 펼침을 만든다 (Preview 에서 일부러 접어 두고 저장하지 않은 문서) 또는 Canvas 픽셀이 바뀐다 |  HIGH  | 조건 = 배열 부재만 (토글 writeback 이 쓴 `[]` 는 보존) · G6 Canvas 픽셀 oracle (239 전 빌드 arm) |
| R2  | 재귀 key 가 깊이에서 겹쳐 RAC 펼침 · 선택이 다른 항목에 걸린다                                                                      |  HIGH  | G1 진단 RED (c) → GREEN · 238 key 함수 재사용                                                    |
| R3  | Menu 하위 메뉴 이관 뒤 하위 메뉴 항목 · 순서가 달라진다                                                                             |  MED   | G3 renderer unit (이관 전 `items` 경로와 같은 트리)                                              |
| R4  | 깊은 Tree 의 ref 해석이 `scene.build` 를 늘린다                                                                                     |  MED   | G5 A/B · 미달 시 사용자 판정 (237 선례)                                                          |
| R5  | swatch 색 배정이 사용자가 의도한 같은 색 swatch (시각 견본) 를 바꾼다                                                               |  LOW   | Slot "+" 새 항목에만 배정 · 기존 swatch 는 이관 시 값 그대로                                     |

## Gates

| Gate | Phase   | 조건                                                                                                                                                                                              | 실패 시                 |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| G0   | Phase 0 | F1~~F11 재확인 · 238 반영 확인 · 진단 RED 5 (breakdown §4 (a)~~(e)) · 이관 수식 실측                                                                                                              | 사실 불일치 → 본문 개정 |
| G1   | Phase 1 | unit (원복 RED): TreeItem origin · 변형 · Tree/TreeItem Slot "+" (중첩 자리) · 재귀 key 유일 (진단 (c) GREEN) · live (Skia · store): Tree instance 에 항목 · 하위 항목 추가 → 들여쓰기 rect       | Tree slot 보류          |
| G2   | Phase 2 | unit (원복 RED): 접힌 항목의 자식이 Canvas layout · Skia 에서 빠짐 · chevron 방향 · Preview 와 같은 항목 집합 (renderer unit) · 이관 조건 (배열 부재만) · live (Skia): 펼침 토글 전후 layout 높이 | 펼침 대칭 보류          |
| G3   | Phase 3 | unit (원복 RED): MenuItem 자식 → Preview `SubmenuTrigger` (정적 · 구조 경로) · `children` 행 이관 전후 같은 트리 · 바인딩 Menu 무변경                                                             | 하위 메뉴 이관 보류     |
| G4   | Phase 4 | unit (원복 RED): ColorSwatchPicker origin · swatch Slot "+" 색 유일 · binding props Preview 도달 · live (Skia): swatch 추가 rect                                                                  | swatch slot 보류        |
| G5   | Phase 5 | 같은 세션 headed A/B (대조 arm = 239 전 빌드) · `scene.build` p95 median Δ ≤ +1 ms · fixture = 사람이 만든 모양 (Q1) · 불리 조작 (origin 편집 · 펼침 토글 · breakpoint, Q2) · 총비용 A/B (Q3)     | 사용자 판정             |
| G6   | Phase 5 | BC: Canvas 픽셀 이관 전후 동일 (Tree 중첩 · ColorSwatchPicker, oracle = 239 전 빌드 arm) · Δbyte 수식 · 재hydration Δ0 (IndexedDB 저장 층 live)                                                   | 실패 가족 이관 보류     |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Tree 가 목록 규칙 (origin · instance · slot) 을 타고, instance 의 어느 깊이에서나 Slot "+" 로 항목을 넣을 수 있다.
- Tree 펼침이 두 leg 에서 같아진다 (지금 발산).
- Menu 하위 메뉴가 section 유무와 관계없이 Preview 에 그려진다.
- ColorSwatchPicker swatch 모양을 origin 하나에서 바꾼다.

### Negative

- Components 페이지 노드가 약 16 늘어난다.
- 기존 Tree 문서의 Preview 표시가 접힘 → 펼침으로 바뀐다 (Canvas 와 일치하는 쪽).
- 238 에 의존한다 — 238 이 막히면 이 ADR 도 착수할 수 없다.
