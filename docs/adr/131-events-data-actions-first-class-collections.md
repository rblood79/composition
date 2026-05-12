# ADR-131: events/data/actions 일급 컴포넌트 루트 컬렉션

## Status

Proposed — 2026-05-12

## Context

### 3-domain 분류 (ADR-063 정합)

본 ADR 은 [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) 의 D1 (DOM/접근성) / D2 (Props/API) / D3 (시각 스타일) 중 **어느 직접 영역에도 속하지 않는 schema architecture layer** 결정이다. 단 D2 (Props/API) 와 연계 — UI node `props` 가 events/data/actions 의 id 를 string 으로 참조 (`props.onPress: "ev1"`).

### 문제 framing

[ADR-116 (Canonical Document SSOT 전환)](completed/116-canonical-document-ssot-transition.md) Phase 5 §3 은 events / actions / dataBinding 을 **`x-composition` extension namespace** 로 분리 결정 (각 `CanonicalNode` 의 top-level 확장 필드 `node["x-composition"].events`). 결정 근거 = "Pencil-compatible canonical core 와 명확히 분리 + JSON 검색 쉬움".

본 ADR 의 framing 정정: **Pencil 정통 format 에는 events / dataBinding 이 존재하지 않는다**. `docs/pencil-copy/format-model.md` 의 Pencil `.pen` Top-Level 키 = `version` / `children` / `themes` / `variables` 만. Node taxonomy 의 비-UI 카테고리 = `prompt` (canvas-placed AI artifact) + `context` field (node-attached AI 메타) 둘 다 events/data 와 **별 카테고리** (visible canvas vs invisible behavior).

즉 ADR-116 §3 의 framing "Pencil-compat core 와 분리하기 위한 namespace extension" 은 Pencil 에 그 카테고리 자체가 없다는 점을 반영하지 못한 framing 이다. **events/data/actions 는 composition 고유 layer 이며, Pencil 외부 root collection 으로 격리하는 것이 더 본질적 정합** — ADR-110 (themes / variables 도입) 의 `CompositionDocument.themes` / `variables` 와 동일 패턴.

### Hard Constraints

1. **Pencil format 호환**: Pencil import / export 시 events / data / actions 는 unknown 영역. Pencil round-trip 에서 drop 또는 sidecar 처리 가능해야 함 (Pencil consumer 가 무시할 수 있는 위치)
2. **ADR-110 패턴 정합**: `CompositionDocument.themes` / `variables` 가 이미 root collection. 동일 직렬화 / persistence 패턴 재사용
3. **schema 일관성**: 새 behavior 카테고리 (예: 후속 ADR 의 prompt / context) 추가 시 동일 패턴 적용 가능해야 함
4. **순환 참조 차단**: UI node props 의 string id 참조 + actions `next[]` chain 이 DAG 검증 가능해야 함
5. **마이그레이션 cost**: ADR-116 §3 cutover 직후 1.5주 — 사용자 IndexedDB 실 데이터 거의 미존재, direct cutover 허용

### Soft Constraints

- 현재 EventsPanel / Inspector dataBinding 편집 UI 가 `selectedElement.events|dataBinding` 직접 read/write — 재배선 cost MED
- AI tools (`createElement.ts`) 의 dataBinding endpoint 매핑이 SerializedData `source/config` 로 충분한지 prototype 필요
- IndexedDB schema 변경 — `documents` store row column 확장 우선, 별도 store 분리는 데이터 양 폭증 시 후속 ADR

### baseline grep (Phase 0 inventory 시 commit hash 와 함께 기록 예정)

- `x-composition\.(events|actions|dataBinding)` direct consumer site
- `Element\.(events|dataBinding)` legacy read / write site
- ADR-116 §3 인용 ADR 문서 site

## Alternatives Considered

### 대안 A: Root collection 분리 (events / data / actions 각각 `CompositionDocument` level)

- 설명: `CompositionDocument.events: SerializedEvent[]` / `data: SerializedData[]` / `actions: SerializedAction[]`. 각 entry = flat node `{id, type:"event|data|action", ...}`. UI node `props` 안 string id 참조 (`onPress: "ev1"`). IndexedDB persistence 는 row column 확장 또는 store 분리
- 근거:
  - ADR-110 themes / variables 가 이미 동일 root collection 패턴 검증 (`CompositionDocument.themes` / `variables`)
  - Pencil 정통의 `prompt` node 가 UI children 안 first-class node 라는 "AI instructions 도 first-class artifact" 철학 정합 (visible 카테고리 한정. invisible behavior 는 root collection 으로 카테고리 분리 자연)
  - data 가 본질 cross-node 공유 자원 — root collection 위치가 multi-consumer 자연 (대안 B 의 본질 한계 회피)
  - 사용자 framing lock-in (2026-05-12 본 세션 explicit confirm)
- 위험:
  - 기술: **LOW** — ADR-110 themes / variables 패턴 검증 완료, 신규 type 추가 + adapter 변환만
  - 성능: **LOW** — collection 단일 lookup O(1). UI render path 영향 0 (events / data / actions 는 invisible behavior)
  - 유지보수: **LOW** — schema 일관성 ↑, 새 카테고리 추가 시 동일 패턴
  - 마이그레이션: **LOW** — ADR-116 §3 dev data 거의 미존재, direct cutover

### 대안 B: ADR-116 §3 유지 (`x-composition.events|actions|dataBinding` node extension)

- 설명: 현재 채택안. 각 `CanonicalNode` 의 `x-composition` 확장 필드. ADR-116 Phase 5 G7 Extension Boundary 가 본 결정의 closure
- 근거: ADR-116 §3 — "Pencil-compatible core 와 명확히 분리 + JSON 검색 쉬움"
- 위험:
  - 기술: LOW
  - 성능: LOW (node-attached property access)
  - 유지보수: **MEDIUM** — node-level extension 이므로 node 마다 부착. data 가 cross-node 공유 자원일 때 어느 node 에 부착할지 mental model 모호 (page node? document root? floating?). lookup 이 tree traversal 필요
  - 마이그레이션: LOW (현재 baseline)
  - **본질 한계**: data 의 cross-node 공유 자원 성격 표현 부재 — events 는 node-attached 자연 (특정 node 의 동작) 이나 data 는 multi-node 가 같은 dataSource 참조하는 mechanism 이 node-attached 와 충돌

### 대안 C: Hybrid (events / actions node-attached, data root collection)

- 설명: events / actions 는 ADR-116 §3 유지 (특정 node 동작에 종속). data 는 root collection (cross-node 공유 자원)
- 근거: 의미적 카테고리 분리 — 부착성과 cross-node 공유성을 따로 처리
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM-HIGH** — 카테고리별 위치가 달라 mental model 분기 (events 어디? data 어디? actions 어디?). 새 behavior 카테고리 추가 시 위치 결정 매번 필요
  - 마이그레이션: LOW
  - **본질 한계**: schema 일관성 약함, 사용자 framing "flat 평등" 과 충돌

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 | 본질 한계        |
| ---- | :--: | :--: | :------: | :----------: | :--------: | ---------------- |
| A    |  L   |  L   |    L     |      L       |     0      | 없음             |
| B    |  L   |  L   |    M     |      L       |     0      | data 공유 mental |
| C    |  L   |  L   |   M-H    |      L       |     0      | 일관성 약함      |

대안 A 는 모든 축 LOW + 본질 한계 없음. 대안 B / C 는 HIGH+ 없으나 본질 한계 존재. 루프 추가 불필요 — 대안 A 채택.

## Decision

**대안 A: Root collection 분리**를 채택한다.

선택 근거:

1. ADR-110 themes / variables 패턴 검증 완료 — 기술 위험 LOW
2. data 의 cross-node 공유 자원 성격을 자연 표현 — 대안 B 본질 한계 회피
3. schema 일관성 ↑ — 새 behavior 카테고리 (후속 ADR 의 prompt / context 등) 추가 시 동일 패턴 적용 가능
4. Pencil 정통 호환 자연 — Pencil 에 events / data / actions 가 없으므로 root collection 도 Pencil consumer 가 무시 가능, adapter 단순
5. 사용자 framing lock-in (Pencil format 에 events / dataBinding 없음 정정 + "indexdb 내에 token 이나 theme 처럼 별도로 두고" + "events / data / actions 모두 독립 node + 평평")

**ADR-116 §3 partial supersede**: 본 결정이 `x-composition.events` / `actions` / `dataBinding` extension namespace 결정을 대체. ADR-116 본문 §3 에 "Partially superseded by ADR-131 — root collection 분리로 전환" 마커 추가 (Phase 6 closure 작업).

기각 사유:

- **대안 B 기각**: data 의 cross-node 공유 자원 성격 표현 본질 한계. node-attached 위치 결정 mental model 모호 (page? root? floating?). 사용자 정정 framing ("Pencil 에 events / dataBinding 없음") 과의 정합도 부족
- **대안 C 기각**: schema 일관성 약함 (카테고리별 위치 분기). 새 behavior 카테고리 추가 시 위치 결정 매번. 사용자 framing "flat 평등" 과 충돌

### Pencil prompt / context 카테고리는 본 ADR scope 외

Pencil `prompt` node (visible canvas artifact) 와 `context` field (node-attached AI 메타) 는 events / data / actions (invisible behavior) 와 **별 카테고리**. 본 ADR 에서 통합 결정하지 않음 — surface 최소화 (consolidation-burden 차단 메모리 정합). 후속 ADR 발의 시 framing 4 질문 다시 적용.

> 구현 상세: [131-events-data-actions-first-class-collections-breakdown.md](design/131-events-data-actions-first-class-collections-breakdown.md)

## Risks

| ID  | 위험                                                                                      | 심각도 | 대응                                                                                                      |
| --- | ----------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------- |
| R1  | ADR-116 §3 기존 `x-composition.events\|actions\|dataBinding` direct consumer 마이그레이션 |  LOW   | Phase 0 inventory grep baseline + Phase 6 grep gate 0 차단 (boundary 외)                                  |
| R2  | EventsPanel UI 재배선 — 현재 `selectedElement.events` 직접 read/write                     |  MED   | Phase 4 (consumer rewrite) + Phase 5 (Inspector UI 3 panel) 별도 분리. Chrome MCP visual evidence Gate G3 |
| R3  | UI node `props` string id 참조 순환 — events `actionRef` → actions `next[]` → events      |  MED   | Phase 1 schema land 시 정적 type guard + Phase 3 store action runtime validator (DAG 검증)                |
| R4  | IndexedDB schema 변경 — `documents` row column 확장 vs 별도 store                         |  LOW   | Phase 2 D1 분기 lock-in (column 확장 우선, store 분리는 데이터 양 폭증 시 후속 ADR)                       |
| R5  | EventsPanel WHEN→IF→THEN 블록 모델 ↔ SerializedEvent + SerializedAction `next[]` 매핑     |  MED   | Phase 0 inventory 시 prototype + Phase 1 schema land 전 매핑 lock-in. 실패 시 schema 재설계               |
| R6  | Pencil import / export adapter 의 events / data / actions 처리 (drop vs sidecar)          |  LOW   | 본 ADR scope 외 — 향후 Pencil import / export ADR 결정 영역                                               |

## Gates

| Gate                     | 시점    | 통과 조건                                                                                                                                                                                       | 실패 시 대안              |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| G1: Schema lock-in       | Phase 1 | `CompositionDocument.events\|data\|actions` 타입 정의 + `SerializedEvent\|Data\|Action` 신규 타입 + ADR-116 §3 deprecated 마커 + `pnpm type-check` 3/3 PASS + canonical consumer 회귀 0         | 타입 재설계 (R5 영향)     |
| G2: Adapter parity       | Phase 2 | `legacyToCanonical()` + `canonicalToLegacy()` round-trip 정확. IndexedDB write/read 정확. ADR-116 §3 migration helper PASS. vitest canonical 광역 회귀 0                                        | adapter 재설계            |
| G3: Inspector UI 3 panel | Phase 5 | EventsPanel (재배선) + DataPanel (신규) + ActionsPanel (신규) 3 panel 동작 + Chrome MCP screenshot evidence + cross-check skill PASS (Skia / CSS 영향 0 확증)                                   | UI 재설계 (R2 mitigation) |
| G4: ADR-116 §3 cleanup   | Phase 6 | `x-composition\.(events\|actions\|dataBinding)` direct consumer site grep 0 (boundary 외) + grep gate test land + ADR-116 본문 §3 "Partially superseded" 마커 + design breakdown supersede 메모 | 잔여 cleanup loop         |

## Consequences

### Positive

- canonical schema 일관성 ↑ — themes / variables / events / data / actions 모두 root collection 패턴
- data 의 cross-node 공유 자원 성격 자연 표현 — `useEventsForTarget(nodeId)` / `useDocumentData()` 가 명확한 mental model
- IndexedDB store 분리 또는 column 확장 — query 효율 + ADR-110 패턴 정합
- 새 behavior 카테고리 추가 시 동일 패턴 적용 가능 — 확장성 ↑
- ADR-116 §3 본질 한계 (data multi-node 공유 mechanism 부재) 해소
- Pencil round-trip adapter 단순화 — Pencil 에 없는 카테고리이므로 root collection 이 import / export 시 자연 drop 가능

### Negative

- ADR-116 §3 partial supersede — ADR-116 본문 marker 추가 + design breakdown supersede 메모 (문서 비용 LOW)
- EventsPanel UI 재배선 cost — 현재 `selectedElement.events` 직접 read 패턴 → `useEventsForTarget(selectedId)` 경유 변경 (R2 mitigation 으로 Phase 4-5 분리)
- DataPanel / ActionsPanel 신규 panel 설계 cost — 현재 data binding 편집 UI 부재, AI tools / endpoint string 입력만 (Phase 5 G3)
- 후속 ADR (prompt / context first-class) 결정 시 root collection 패턴 누적 시 schema 평가 필요 — schema 일관성 평가 비용 (design §8)

## References

- [ADR-110: Canonical Themes / Variables](completed/110-canonical-themes-variables-land-plan.md) — root collection 패턴 baseline
- [ADR-116: Canonical Document SSOT 전환](completed/116-canonical-document-ssot-transition.md) — §3 Extension namespace 결정 (본 ADR 이 partial supersede)
- [ADR-063: SSOT Chain Charter](completed/063-ssot-chain-charter.md) — 3-domain 분할 정본
- [docs/pencil-copy/format-model.md](../pencil-copy/format-model.md) — Pencil `.pen` Format Model 1.1.53
- [docs/adr/design/903-canonical-examples.md](design/903-canonical-examples.md) — Pencil canonical 정통 예제 4종 (events / data 부재 확인)
