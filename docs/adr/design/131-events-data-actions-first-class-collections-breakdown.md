# ADR-131 구현 상세 — events/data/actions 일급 컴포넌트 루트 컬렉션

본 문서는 [ADR-131](../131-events-data-actions-first-class-collections.md) 의 phase plan / inventory / gate 측정 방법 / framing 4 질문 lock-in 을 정의한다.

## 1. framing 4 질문 lock-in

`adr-writing.md` §"ADR Fork / 분리 결정 시 framing checkpoint" 통과 lock-in.

| #   | 질문                          | 답                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류              | **응용**. ADR-116 canonical schema = base (`CompositionDocument` 구조 자체). 본 ADR = §3 Extension namespace 결정의 supersede. 단 사용자 framing 상 "완전 신규 ADR" 형식 (partial supersede header 마커 대신 본문 supersede 명시)                                                                                                                                            |
| 2   | schema 직교성                 | **직교 아님**. ADR-116 §3 (`x-composition.events                                                                                                                                                                                                                                                                                                                             | actions | dataBinding`) 와 본 ADR (`document.events | data | actions`) 는 같은 영역 — events/actions/dataBinding 의 storage location. 본 ADR 이 ADR-116 §3 partial supersede |
| 3   | baseline framing reverse 검증 | **reverse 정당**. ADR-116 §3 근거 ("Pencil-compatible core 와 분리 → namespace extension") 은 일관되나, 사용자 정정 ("Pencil format 에는 events/databinding 이 없다") + Pencil 정통 조사 (`docs/pencil-copy/format-model.md` top-level = `version` / `children` / `themes` / `variables` 만) 결과 더 본질적 정합 = root collection 분리 (ADR-110 themes/variables 패턴 정합) |
| 4   | codex 3차 미루지 말 것        | 본 ADR 본문 + design land 직후 codex 1차 진입 예정 — Phase 0 inventory + Phase 1 schema 결정 동시 review                                                                                                                                                                                                                                                                     |

### 사용자 explicit confirm 이력

- 2026-05-12 (본 세션) — 사용자 lock-in:
  - "pencil app 의 format 에는 databinding 과 event 가 없다" (framing trigger)
  - "indexdb 내에 token 이나 theme 처럼 별도로 두고 그내부 node 수준에 각각 두게" (옵션 (C) + ADR-110 패턴 차용)
  - "events / data / actions 모두 독립 node + UI node 구분 없이 동등하게 평평" (flat node 철학)
  - "Props 안 string id 참조" (binding mechanism)
  - "완전 신규 adr" (supersede 형식 결정)
  - "(C) 본 ADR = events / data / actions 만 — prompt / context 는 후속 ADR" (scope 결정)
  - "(3) events-data-actions-first-class-collections — 구체 입장 명시" (제목 결정)

## 2. Pencil 정통 조사 evidence

`docs/pencil-copy/format-model.md` 기준 Pencil `.pen` Format (version 2.6 / 2.8):

### Top-Level 키

| Key         | Meaning                 |
| ----------- | ----------------------- |
| `version`   | Document schema version |
| `children`  | Root scenegraph nodes   |
| `themes`    | Theme dimensions        |
| `variables` | Design tokens           |

→ **events / dataBinding / actions 부재**.

### Node Taxonomy

| Type                                                    | Role                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| `frame`                                                 | container, layout box, component master, slot host |
| `text`                                                  | text layer                                         |
| `ref`                                                   | component instance                                 |
| `icon_font` / `path` / `rectangle` / `ellipse` / `line` | shape primitive                                    |
| `prompt`                                                | AI prompt node stored on canvas                    |

→ Pencil 정통의 비-UI 카테고리 = `prompt` (canvas-placed) + `context` field (node-attached). composition events/data/actions 와 **별 카테고리**. 본 ADR scope 외 — 후속 ADR.

## 3. Phase 분해

### Phase 0 — Inventory + Baseline freeze

- 산출물:
  - `x-composition.events|actions|dataBinding` direct consumer grep 측정 (Phase 1 lock-in baseline)
  - `Element.events` / `Element.dataBinding` legacy read/write site grep
  - 사용자 IndexedDB 실 데이터 사용처 0 확정 (마이그레이션 cost 수식화)
  - 본 design §1 framing 4 질문 lock-in 완료
- 검증: grep baseline 기록 (commit hash 포함). type-check 무변경 (문서만)
- 추정: LOW ~30분

### Phase 1 — Schema land (G1)

- 산출물:
  - `packages/shared/src/types/composition-document.types.ts` 에 다음 추가:
    - `CompositionDocument.events?: SerializedEvent[]`
    - `CompositionDocument.data?: SerializedData[]`
    - `CompositionDocument.actions?: SerializedAction[]`
  - 신규 타입 정의:
    ```ts
    interface SerializedEvent {
      id: string;
      type: "event";
      kind: string; // "onPress" / "onSelectionChange" / ...
      target: string; // UI node id (where event 발생)
      actionRef?: string; // actions[] 의 id 참조
      condition?: Record<string, unknown>;
    }
    interface SerializedData {
      id: string;
      type: "data";
      kind: "collection" | "value" | "field";
      source: string; // endpoint / static value / field path
      config?: Record<string, unknown>;
    }
    interface SerializedAction {
      id: string;
      type: "action";
      kind: string; // "navigate" / "setValue" / "fetch" / ...
      config?: Record<string, unknown>;
      next?: string[]; // chain
    }
    ```
  - 기존 `CompositionExtension` (ADR-116 §3) 에 `@deprecated ADR-131` 마커
- 검증:
  - `pnpm type-check` 3/3 PASS
  - 41+ canonical consumer 회귀 0 (optional field 추가)
- 추정: LOW ~30분 ~ 1h
- **Gate G1 PASS** = 위 산출물 완료

### Phase 2 — Adapter migration (G2)

- 산출물:
  - `legacyToCanonical()` adapter: `Element.events` → `document.events`. target = element.id 자동 binding. id 충돌 회피
  - `canonicalToLegacy()` adapter: `document.events` (target 별 grouping) → `Element.events`. legacy export boundary 만
  - ADR-116 `x-composition.events|actions|dataBinding` → `document.events|actions|data` migration helper (dev data 미존재 시 no-op)
  - IndexedDB schema 변경: `documents` store 의 `events` / `data` / `actions` column 추가 (또는 별도 store 분리 — Phase 2 결정 분기 lock-in)
- 검증:
  - adapter unit test PASS (round-trip 정확성)
  - vitest canonical 광역 회귀 0
- 추정: MED ~1d
- **Gate G2 PASS** = adapter round-trip + IndexedDB write/read 정확

### Phase 3 — Store / Bridge API

- 산출물:
  - `canonicalDocumentStore` 신규 액션:
    - `setEvents` / `updateEvent` / `addEvent` / `removeEvent`
    - `setData` / `updateData` / `addData` / `removeData`
    - `setActions` / `updateAction` / `addAction` / `removeAction`
  - bridge hooks:
    - `useDocumentEvents()` / `useDocumentData()` / `useDocumentActions()`
    - `useEventsForTarget(nodeId)` — filter (where event.target === nodeId)
  - clone-on-write immutability 유지 (ADR-116 패턴 정합)
- 검증:
  - 신규 store action unit test PASS
  - 회귀 0
- 추정: MED ~1d

### Phase 4 — Consumer rewrite

- 산출물:
  - `EventsPanel.tsx` — `selectedElement.events` 직접 읽기 → `useEventsForTarget(selectedId)` 경유
  - `inspectorActions.updateSelectedEvents` → `document.events` mutation
  - AI tools `createElement` dataBinding 경로 → `document.data` write
  - PropertiesPanel data binding 변경 감지 → `useDocumentData()` 구독
- 검증:
  - type-check PASS
  - targeted vitest (EventsPanel + inspectorActions + AI tools)
- 추정: MED ~1d

### Phase 5 — Inspector UI 3 panel (G3)

- 산출물:
  - EventsPanel — WHEN → IF → THEN 블록 재사용 + `target: nodeId` selector 추가 (selected element 자동 채움)
  - DataPanel (신규) — `kind` (collection / value / field) selector + source 입력 + config UI
  - ActionsPanel (신규) — `kind` selector + config + chain (`next[]`) editor
  - 3 panel 모두 root collection 직접 편집 (no element selection 필요)
- 검증:
  - Chrome MCP visual evidence 3 panel 동작
  - cross-check (Skia / CSS 영향 0 — events/data/actions 는 invisible behavior layer)
- 추정: MED ~1-2d
- **Gate G3 PASS** = 3 panel 동작 + visual evidence

### Phase 6 — ADR-116 §3 cleanup (G4)

- 산출물:
  - `x-composition.events|actions|dataBinding` direct read / write site (Phase 0 baseline 16 site) → 모두 root collection 경로 전환
  - grep gate test: `x-composition\.(events|actions|dataBinding)` baseline 0 차단 (boundary 외)
  - ADR-116 본문 §3 마지막에 "Partially superseded by ADR-131 (root collection 분리)" 마커 추가
  - ADR-116 design breakdown 의 §Extension namespace 결정 부분에 supersede 메모
- 검증:
  - grep gate PASS (baseline 0)
  - type-check PASS
- 추정: LOW ~30분 ~ 1h
- **Gate G4 PASS** = grep gate baseline 0 + ADR-116 marker

## 4. 결정 분기 (Phase 2 IndexedDB schema 영역)

Phase 2 진입 시 lock-in 필요:

| 분기 | 옵션                                                                                                                               | 채택 후보                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | (a) `documents` store row 의 column 확장 (`events: SerializedEvent[]`) / (b) 별도 store 분리 (`events` / `data` / `actions` store) | **(b) 채택 (2026-05-13 사용자 framing)** — `design_themes / variables / data_tables / api_endpoints / transformers` 패턴 정합. DevTools 표시 + cross-project query 일관성. canonical document root field 는 SSOT 로 유지, 별 store 는 fan-out mirror (`persistActiveCanonicalDocument` 가 sync, full-set replacement). 초기 (a) 채택을 사용자 framing ("design_themes 등은 빈 테이블인데 생성되어있음") 으로 (b) 로 swap (Phase 7). |
| D2   | adapter 위치 — `apps/builder/src/adapters/canonical/**` 안                                                                         | 기존 adapter boundary 유지                                                                                                                                                                                                                                                                                                                                                                                                          |
| D3   | migration helper — ADR-116 dev data 가 미존재면 no-op                                                                              | dev fixture 만 변환 path 검증                                                                                                                                                                                                                                                                                                                                                                                                       |

## 5. UI node ↔ events/data/actions 참조 mechanism

UI node 의 `props` 안 **string id 참조**:

```json
{
  "id": "btn-1",
  "type": "Button",
  "props": {
    "onPress": "ev1", // events[].id 참조
    "label": "Submit"
  }
}
```

```json
{
  "id": "listbox-1",
  "type": "ListBox",
  "props": {
    "dataSource": "listData" // data[].id 참조
  }
}
```

### 순환 참조 차단

- validator: `validate-specs` 패턴 정합 — `document.events[].actionRef` 가 `actions[].id` 에 존재해야 함. `actions[].next[]` 가 다른 actions[].id 참조 시 DAG 검증
- Phase 1 schema land 시 정적 type guard + Phase 3 store action 에 runtime validator

## 6. Pencil import / export 호환

본 ADR 결정 시 Pencil import / export adapter 영향:

- **import**: Pencil `.pen` 파일에 events / data / actions 부재 → 그대로 `document.events|data|actions = []` 또는 `undefined`
- **export**: composition `document.events|data|actions` 가 있어도 Pencil format 으로 export 시 drop (Pencil 호환 모드) 또는 별도 sidecar 파일 (composition extension 모드) — 향후 ADR 결정 영역, 본 ADR 결정 영역 아님

## 7. 검증 evidence 체크리스트

각 Phase 종결 시 다음 evidence 본문 진행 로그에 기록:

- [ ] `pnpm type-check` 결과 (3/3 PASS)
- [ ] targeted vitest 결과 (test count + PASS rate)
- [ ] grep baseline 측정값 (Phase 0 baseline ↔ Phase 6 0건)
- [ ] Chrome MCP screenshot evidence (Phase 5)
- [ ] ADR-116 §3 marker 갱신 PR (Phase 6)

## 8. 후속 ADR 시사

Pencil `prompt` node (visible canvas artifact) 와 `context` field (node-attached AI 메타) 도입은 본 ADR scope 외. 후속 ADR 발의 시:

- framing 4 질문 다시 적용 (visible 카테고리 vs invisible 카테고리)
- 본 ADR `document.events|data|actions` 패턴 응용 가능 여부 평가
- ADR-110 themes/variables / 본 ADR events/data/actions / 후속 prompt/context — root collection 패턴이 누적 시 schema 일관성 평가

## 9. 잔존 의문 (Phase 0 inventory 시 lock-in 필요)

- EventsPanel 의 WHEN → IF → THEN 블록 모델이 SerializedEvent + SerializedAction `next[]` 체인으로 정확히 매핑 가능한가? (Phase 1 schema land 전 prototype)
- AI tools 의 dataBinding endpoint 매핑이 SerializedData 의 `source` / `config` 로 충분한가? (`apps/builder/src/services/ai/tools/createElement.ts:30,76-82`)
- IndexedDB store 분리 시점 (Phase 2 vs 별도 ADR) 의 trade-off 측정 (현재 dev data 미존재 → Phase 2 안 simple column 확장 우선)
