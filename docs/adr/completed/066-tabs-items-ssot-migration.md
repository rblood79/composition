# ADR-066: Tabs items SSOT 전환 — RAC Collection Items 패턴 정합

## Status

Implemented — 2026-04-15

## Context

### 배경

composition 현재 Tabs 데이터 모델은 Tab과 TabPanel을 독립 store element로 분리해 `props.tabId` 매칭으로 페어링한다. N개 탭당 **2N개 element rows**가 DB에 저장되며, `TabsEditor.createNewTab`과 `elementRemoval`이 페어 단위로 add/remove 로직을 수동 관리한다.

RAC/RSP 공식 레퍼런스(`https://react-spectrum.adobe.com/Tabs`, `https://react-aria.adobe.com/Tabs`)의 dynamic collection 패턴은 단일 `items` 배열을 `<TabList items={items}>` / `<TabPanels items={items}>` 양쪽에 전달하고 render function으로 렌더한다. N개 탭 = 1개 items 배열로 관리.

```tsx
<TabList items={tabs}>{item => <Tab id={item.id}>{item.title}</Tab>}</TabList>
<TabPanels items={tabs}>{item => <TabPanel id={item.id}>{item.content}</TabPanel>}</TabPanels>
```

ADR-063 3-domain 분할 관점에서 이는 **D2(Props/API) 정렬**이며, 현재 분산된 Tab element 구조는 RAC reference API와 divergence. items 단일 SSOT로 전환하여 정렬한다.

### SSOT 체인 내 위상 (D1/D2/D3)

- **D1 (DOM/접근성)**: 변경 없음 — RAC `<Tabs>/<TabList>/<Tab>/<TabPanels>/<TabPanel>` DOM 구조 그대로 사용
- **D2 (Props/API)**: **정렬 대상** — RAC `items` prop + render function API로 전환
- **D3 (시각 스타일)**: 변경 없음 — 기존 Tab/TabList/TabPanel spec 스타일 유지

### Hard Constraints

- `pnpm type-check` 3/3 통과
- `pnpm build:specs` CSS 생성 수량 변화 없음 (기존 107개 유지)
- Tab 패밀리 시각 결과(fontWeight/indicator/padding) 현재 동작과 동일
- title 변경 시 layoutVersion bump → Skia 즉시 반영 (ADR-066 직전 수정된 `LAYOUT_AFFECTING_PROP_KEYS` 경로 유지)

### Soft Constraints

- 개발 단계 — **DB 마이그레이션 수행하지 않음** (사용자 명시 결정 2026-04-15). 기존 저장된 Tabs 프로젝트는 broken 수용.
- per-Tab 개별 스타일/variant 편집 기능 상실 수용 (items 항목은 `id` + `title`만)
- Tab element 소멸로 레이어 트리 Tab row는 **가상 노드**(items 파생, selectable=false)로 표시

## Alternatives Considered

### 대안 A: 현상 유지 (Tab element 분산 + tabId 페어링)

- 설명: 데이터 모델 변경 없이 TabsEditor UI만 unified 리스트 모양으로 개선 (옵션 C, 이전 세션)
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — RAC API divergence 장기 유지, per-Tab element 2N개 부담 지속
  - 마이그레이션: LOW (변경 없음)
- 기각 사유: ADR-063 D2 원칙(RAC 참조 정렬) 위배 상태 고착화

### 대안 B: 하이브리드 (items 메타 + Tab element 자동 동기화)

- 설명: items SSOT 도입하되 store reducer가 Tab/TabPanel element도 자동 sync로 유지
- 위험:
  - 기술: MEDIUM — 두 표현 동기화 코드 복잡
  - 성능: LOW
  - 유지보수: **MEDIUM** — "어느 쪽이 SSOT인가" 모호, 규칙 위반 여지
  - 마이그레이션: MEDIUM
- 기각 사유: SSOT 원칙 위반 가능성 — items와 element 두 진실이 양존

### 대안 C: items SSOT + TabPanel element만 유지 (선택)

- 설명: Tab element 소멸, items 단일 SSOT. TabPanel element는 자식 subtree 호스팅 전용으로 유지. items[i].id ↔ TabPanel.customId 매칭.
- 위험:
  - 기술: MEDIUM — 렌더 체인/Skia 가상 Tab 경로 재설계, implicitStyles Tab 처리 변경
  - 성능: LOW — element 수 N개 절감
  - 유지보수: LOW — SSOT 단일화로 장기 개선
  - 마이그레이션: LOW (사용자 명시 불필요)
- 선택 사유: RAC API 정합 + TabPanel 자식 자유 편집 유지 + SSOT 원칙 준수

### 대안 D: 완전 SSOT (TabPanel element도 items에 흡수)

- 설명: items[i].contentTreeId → 별도 element tree 참조. TabPanel element도 소멸.
- 위험:
  - 기술: **HIGH** — contentTreeId 참조 메커니즘 신설 필요
  - 성능: LOW
  - 유지보수: MEDIUM — 참조 체계 유지비
  - 마이그레이션: **HIGH**
- 기각 사유: HIGH 2축. contentTree 참조 메커니즘 부재로 투자비용이 RAC 정합 이득보다 큼

### Risk Threshold Check

| 대안                                | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ----------------------------------- | ----- | ---- | -------- | ------------ | ---------- |
| A (현상유지)                        | L     | L    | **H**    | L            | 1          |
| B (하이브리드)                      | M     | L    | M        | M            | 0          |
| C (items + TabPanel 유지, **선택**) | M     | L    | L        | L            | 0          |
| D (완전 items)                      | **H** | L    | M        | **H**        | 2          |

**판정**: C와 B 모두 HIGH-free, C가 모든 축에서 B 이상 → C 선택. A는 유지보수 HIGH + RAC divergence 고착, D는 투자비 과대.

## Decision

**대안 C 선택** — items SSOT + TabPanel element 유지.

### Q 결정사항 (2026-04-15 사용자 확정)

| Q                                              | 옵션                                                             | 선택     | 근거                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| **Q1. Skia 렌더에서 개별 Tab shape 생성 방법** | (a) spec composite / **(b) 가상 Tab element 배열**               | **(b)**  | 기존 `ElementSprite` 렌더 경로 재활용, spec 복잡도 증가 회피                       |
| **Q2. TabList 우측 +/- 버튼 UI 위치**          | **(α) Canvas overlay (DOM)** / (β) Skia shape / (γ) Preview only | **(α)**  | 빌더 전용 기능이므로 DOM 오버레이 적절, 기존 select overlay 패턴 재활용            |
| **Q3. 최소 1개 유지 가드**                     | **적용** / 미적용                                                | **적용** | RAC 공식 예시도 `if (tabs.length > 1)` 가드. 빈 items 상태 시각적/접근성 회귀 방지 |

### 데이터 모델

**Before (현재)**:

```
Tabs (element)
├── TabList (element)
│   ├── Tab (element) ─ props.tabId="abc" + title
│   └── Tab (element) ─ props.tabId="def" + title
└── TabPanels (element)
    ├── TabPanel (element) ─ props.tabId="abc" + children subtree
    └── TabPanel (element) ─ props.tabId="def" + children subtree
```

**After**:

```
Tabs (element) — props.items: [{id:"abc", title:"T1"}, {id:"def", title:"T2"}]
├── TabList (element)             ← 자식 Tab element 없음
└── TabPanels (element)
    ├── TabPanel (element, customId="abc") ─ children subtree
    └── TabPanel (element, customId="def") ─ children subtree
```

### Pairing 규칙

- `items[i].id` ↔ `TabPanel.customId` (1:1)
- items에 항목 추가 → store reducer가 매칭 customId의 TabPanel element 생성
- items에서 항목 제거 → 매칭 TabPanel element + 자식 subtree cascade 삭제
- `defaultSelectedKey` / `selectedKey` = items[i].id

### Skia 렌더 (Q1=b)

TabList의 implicitStyles 처리에서 items.length만큼 **가상 Tab element** 배열 생성해 Taffy 자식으로 주입. 각 가상 Tab은 실제 store row 아님(page_id 없음, 렌더 전용 ephemeral). 기존 `buildSpecNodeData` 경로 재사용 → Tab spec shapes 그대로 동작.

가상 Tab 식별: `id: `${tabsId}:virtualTab:${itemId}`` (page/레이어 트리에는 미등록). spatialIndex hit test는 실제 Tabs element id로 매핑 (Tab 클릭 = 해당 items[i] 선택).

### TabList 우측 +/- 버튼 (Q2=α)

Builder canvas의 DOM overlay layer에 Tabs 선택 시 TabList 우측에 `<button>+</button><button>-</button>` 렌더. 클릭 시 각각 `addTabItem(tabsId)` / `removeTabItem(tabsId, lastItemId)` dispatch. 기존 selection overlay 컴포넌트에 편승.

### 최소 1개 가드 (Q3)

- `addTabItem`: 무조건 허용 (상한 없음)
- `removeTabItem`: `items.length <= 1` 시 no-op + console.warn. UI에서 삭제 버튼 비활성화.

### 기각 대안 재확인

- A 기각: RAC divergence 고착 불가
- B 기각: SSOT 이중 진실 지양
- D 기각: contentTree 참조 비용 과대

> 구현 상세: [066-tabs-items-ssot-migration-breakdown.md](../design/066-tabs-items-ssot-migration-breakdown.md)

## Gates

**잔존 HIGH 위험 없음** — Gate 테이블 생략 가능하지만 구현 완료 판정 기준 명시.

| 검증 항목                            | 통과 조건                                                    |
| ------------------------------------ | ------------------------------------------------------------ |
| 1. `pnpm build:specs`                | 107개 CSS 유지 (수량 변화 없음)                              |
| 2. `pnpm type-check`                 | 3/3 성공                                                     |
| 3. 신규 Tabs 요소 삽입               | 기본 items=2 + TabPanel×2 생성, 시각 동일                    |
| 4. Item Management UI에서 Add/Remove | items 변경 → TabPanel 동기 add/remove, 최소 1개 가드 동작    |
| 5. TabList 우측 +/- 버튼             | DOM 오버레이 Add/Remove 동일 동작                            |
| 6. TabPanel 자식 subtree 편집        | 기존처럼 자유 드래그/추가/삭제 가능                          |
| 7. defaultSelectedKey 전환           | items[i].id 기반 정상 동작                                   |
| 8. title 변경                        | layoutVersion bump → Skia 즉시 갱신 (ADR-066 직전 수정 유지) |

## Consequences

### Positive

- RAC Collection Items API 정합 (ADR-063 D2 정렬)
- Store element 수 50% 감소 (Tab element 소멸, N개 절감)
- TabsEditor add/remove 로직 단순화 (items 배열 1개 mutation)
- SSOT 단일화 → 페어링 버그 발생 여지 소멸
- TabList 우측 +/- 오버레이 UX로 RAC 레퍼런스 수준 편집성 제공

### Negative

- per-Tab 개별 스타일/variant/disabled 편집 기능 상실 (사용자 수용)
- 개발 단계 저장 프로젝트의 기존 Tabs는 broken 상태 (마이그레이션 미수행, 사용자 수용)
- Tab element 기반 기존 runtime 로직(implicitStyles TabList 처리, elementReorder/Removal Tab+TabPanel 페어 로직) 전면 재설계 필요
- 가상 Tab 렌더 경로 신설 — 디버깅 시 "왜 레이어 트리엔 Tab 없는데 Skia엔 보이지?" 주의 필요 (문서/주석으로 완화)
- TabEditor.tsx 파일 삭제 (Tab element 소멸로 개별 편집기 불필요)
