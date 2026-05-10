# ADR-126 구현 상세 — Element 타입 Deprecate 및 canonical-native 전환

본 문서는 [ADR-126](../126-element-type-deprecate.md)의 Phase 계획, inventory 분류, Gate 측정 방법을 정의한다.

**진입 조건**:

- Phase 1 이상: ADR-123 + ADR-124 + ADR-125 모두 `Implemented` 후 착수 가능. Phase 0(inventory freeze)은 선행 수행 가능.
- Phase 2 이상: Phase 1 G1 PASS + ADR-127 `Implemented` 후 착수 가능. ADR-127은 canonical traversal helper + scene model canonical-native export prerequisite다.

---

## 1. Fork Checkpoint (ADR-writing.md §ADR Fork / 분리 결정 시)

| 질문                           | 판정                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base / 응용 분류               | ADR-126은 **응용 ADR**. Phase 1 base = ADR-123(cloud document-level row schema) + ADR-124(canonical-only history entry schema) + ADR-125(render input canonical-native contract). Phase 2 prerequisite = ADR-127(canonical traversal helper + scene model 재설계). base/prerequisite가 cloud transport / history persistence / render input / traversal API / scene model 의 legacy `Element` 의존을 각각 제거하면, ADR-126이 그 위에서 잔존 `Element` consumer를 canonical-native model로 전환하고 타입을 boundary allowlist로 격리한다. |
| schema 직교성                  | `Element` shape는 canonical node shape의 specialization(flat projection)이 아니라 entirely different flat record. 두 schema는 직교가 아니며 ADR-126은 canonical side로 소비자를 이동시킨다.                                                                                                                                                                                                                                                                                                                                               |
| baseline framing reverse 검증  | ADR-122 soft constraint("runtime source 제거 → derived view 축소 → boundary quarantine 순서")를 baseline으로 승계. 이 순서는 ADR-126에서도 유효하다. Phase 0→1→2→3→4→5→6 순서가 이를 반영.                                                                                                                                                                                                                                                                                                                                                |
| codex 1차 진입 전 framing 통과 | 4 질문 답변이 ADR 본문 §Context §Decision에 lock-in됨. sub-phase 분해 전 사용자 confirm 획득 필수.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 2. Target State

| Layer               | Target                                                                                 | 금지                                                     |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| hot path consumer   | canonical-native node/path/alias model 소비                                            | `Element[]` 파생 view를 hot path read source로 사용      |
| derived view        | boundary allowlist 파일로 격리 (`canonicalDocumentToElements`, `useCanonicalElements`) | non-boundary production 호출                             |
| store cache         | canonical-derived read-only cache 유지 (ADR-125 render input contract 후 잔존 cache)   | `elementsMap`/`childrenMap`을 `Element` key/value로 유지 |
| history/undo        | canonical patch/event 계약 기반 diff                                                   | `Element[]` diff 기반 undo history                       |
| boundary (허용)     | projectSync, exportLegacyDocument, cloud/export/import/publish adapter                 | —                                                        |
| `Element` 타입 파일 | `@deprecated` 마킹 + boundary allowlist 파일로 이동                                    | hot path에서 신규 `Element` 타입 import                  |

---

## 3. Phase 0 — Inventory Freeze

**Status: Done — 2026-05-10** ([126-inventory.md](126-inventory.md))

**목표**: `Element` 타입 사용처를 bucket으로 분류하고, Phase 1~6 진입 기준을 확정한다.

### Measurement command seed

```bash
# Element 타입 import 위치 (unified.types.ts 에서 가져오는 경우)
rg -n "from.*unified\.types.*Element|from.*types.*Element\b" \
  apps/builder/src packages/shared/src apps/publish/src \
  --include="*.ts" --include="*.tsx"

# Element[] 타입 annotation 위치
rg -n ": Element\[\]|<Element\b|Element>" \
  apps/builder/src packages/shared/src \
  --include="*.ts" --include="*.tsx" \
  | grep -v "HTMLElement\|ReactElement\|JSXElement\|ElementEvent\|ElementRef"

# canonicalDocumentToElements / useCanonicalElements 호출 위치
rg -n "canonicalDocumentToElements\(|useCanonicalElements\(" \
  apps/builder/src \
  --include="*.ts" --include="*.tsx"
```

### Bucket 정의

| Bucket              | 의미                                                                                                                                                             | Phase          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `derived-view`      | `canonicalDocumentToElements`, `useCanonicalElements`, `useCanonicalSelectedElement` 정의/호출                                                                   | Phase 5 제거   |
| `store-cache`       | `elementsMap`, `childrenMap` store state에서 `Element` key/value 참조. Direct hot-path `useStore.getState()` read는 ADR-125 이후 0건이나 store state 타입은 잔존 | Phase 3 전환   |
| `hot-path-consumer` | Skia/layout/Preview/Properties/LayerTree/History/drag-drop에서 `Element` 타입 직접 소비                                                                          | Phase 2/4 전환 |
| `boundary-allowed`  | projectSync, exportLegacyDocument, cloud/export/import/publish adapter                                                                                           | 유지 허용      |
| `test-doc`          | tests, fixtures, docs, static gates                                                                                                                              | Phase 6 정렬   |

### Phase 0 Gate (G0)

ADR-123, ADR-124, ADR-125 status를 확인한다:

```bash
grep -A2 "^## Status" \
  docs/adr/123-*.md \
  docs/adr/124-*.md \
  docs/adr/125-*.md \
  docs/adr/completed/123-*.md \
  docs/adr/completed/124-*.md \
  docs/adr/completed/125-*.md \
  2>/dev/null
```

세 ADR 중 하나라도 `Implemented` 아니면 Phase 1 진입 금지.

---

## 4. Phase 1 — canonical-native model 검증

**Status: Done — 2026-05-10** ([126-phase1-validation.md](126-phase1-validation.md))

**목표**: ADR-123/124/125 Implemented 후 잔존하는 `Element` consumer를 식별하고, canonical-native model이 hot path를 `Element` 없이 커버하는지 검증한다. Phase 2에서 필요한 ADR-127 prerequisite(helper API + scene model export shape) 필요성도 확정한다. 실제 코드 변경 최소.

### 작업

1. ADR-123 closure 후 cloud transport boundary 외 `Element` 사용처 식별 — Builder hot path에서 cloud row API 의존이 사라졌는지 확인
2. ADR-124 closure 후 history payload에 legacy `Element` snapshot field가 사라졌는지 확인 — canonical event sequence 가 단일 source인지
3. ADR-125 closure 후 render input contract가 canonical-native로 닫혔는지 확인 — layout engine map shape input 제거 + Preview UPDATE_ELEMENTS receive 제거 + order_num 갱신 0건
4. 위 3 base 의 잔존 consumer 목록에서 canonical-native 대체 가능 여부 판정

### Phase 1 Gate (G1)

- canonical-native node/path/alias API가 `Element` 없이 Skia/layout/Preview hot path를 커버하는 타입 설계가 존재한다
- type-check 0 error
- FPS 측정 baseline 수립 (Phase 2 비교용)

---

## 5. Phase 2 — hot path consumer 전환 (Skia / layout / Preview / Properties / LayerTree)

**목표**: render/selection/layout hot path에서 `Element` 타입 import를 canonical-native로 전환한다.

### 5.0. Scope 재측정 (2026-05-10 — agent 우회 사례 후 재freeze)

ADR-127 발의 배경 §1 의 측정 — Phase 2 G2 grep gate scope (`workspace/canvas + panels + resolvers`) 실측 **70 file**. ADR-126 본문 §"현재 Element 타입 사용 규모" 추정 ~400 line (hot path consumer) 와 일치하지만, file 단위로는 본 §5 의 기존 "우선 전환 대상 file" sub-list (7 file) 와 G2 전체 scope 추정 (~28 file) 모두 실측 70 file 대비 과소 (실측/추정 = 2.5배, sub-list 만 보면 10배) 였다. 이 괴리가 **단일 phase + 단일 grep gate** 구조에서 agent 의 type alias rename 우회 (`Element → LegacyElement`) 가 형식적 PASS 만들 수 있던 root cause.

→ Phase 2 를 **directory 단위 5 sub-group** 으로 재분할하고, 각 sub-group 마다 **caller cascade evidence + targeted vitest + type-check** 의무를 명시한다. grep gate 는 마지막 검증 layer 일 뿐 단독 PASS 기준 아님.

### 5.1. Sub-group 분할 (Phase 2-A ~ 2-E, follow-up 2-F)

| Sub-group | scope                                                                                                                                                  | 주요 변경                                                                                                                                                                                                                                                                                                                                                                                                           | 예상 file   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **2-A**   | Skia render path (`workspace/canvas/skia/**` + `workspace/canvas/scene/**`)                                                                            | `StoreRenderBridge.sync()` / `renderFromMaps()` / `buildNodeForElement()` 가 받는 input 을 ADR-127 의 `CanonicalSceneModel.nodes` (scene model 직접 access) 로 교체. 현재 `canonicalSceneModelLegacy.ts` getter 통한 indirect access 를 직접 access 로 swap. **2026-05-10 실측 24 file** (skia 16 + scene 8). layoutCache 의 fullTreeLayout 진입 직전 Element[] projection 은 boundary helper 유지 (Phase 2-B 위임) | **24 file** |
| **2-B**   | Layout engine (`workspace/canvas/layout/**`, 특히 `fullTreeLayout.ts` + `enrichWithIntrinsicSize`)                                                     | ADR-125 Phase 2-b skip 영역 (DFSContext.elementsMap) cleanup. `processedElementsMap` cascade 함수 시그니처 + caller 동시 swap                                                                                                                                                                                                                                                                                       | ~8 file     |
| **2-C**   | Renderer input + ref resolution (`renderers/rendererInput.ts` + `adapters/canonical/canonicalRefResolution.ts` + `resolvers/canonical/storeBridge.ts`) | `pageElements: Element[]` → `pageNodes: CanonicalNode[]` 함수 시그니처 변경. `buildChildrenMap` → `getChildrenByParent()` (ADR-127 helper)                                                                                                                                                                                                                                                                          | ~8 file     |
| **2-D**   | Panels (properties + nodes/LayerTree) (`builder/panels/properties/**` + `builder/panels/nodes/**`)                                                     | selected node read + LayerTree tree model 을 canonical-native `useCanonicalNode` / `getNodeMap()` (ADR-127 helper) 로 swap                                                                                                                                                                                                                                                                                          | ~25 file    |
| **2-E**   | Preview render (`apps/builder/src/preview/**` + `services/messaging.ts` 의 layout 관련 receive)                                                        | `UPDATE_ELEMENTS` receive 잔존 정리 (ADR-125 closure 와 정합). `preview/utils/layoutResolver.ts` canonical scene snapshot 수신                                                                                                                                                                                                                                                                                      | ~7 file     |

**Phase 4 로 위임** (Phase 2 scope 외): BuilderCore mount / utility (treeUtils / multiElementCopy / smartSelection / selectionMemory / idGeneration / idValidation) / AI tools (createElement / canonicalToolReadModel) / messaging (canvasDeltaMessenger / iframeMessenger) / history actions / drag-drop / inspector actions / Factory definitions (TableComponents 등).

### 5.2. 진정 reverse 패턴 (agent 우회 차단 명시)

각 sub-group commit 은 다음 4 요건을 **모두** 충족해야 한다. 하나라도 누락 시 commit 차단:

1. **함수 시그니처 변경** — `function f(el: Element): void` → `function f(node: CanonicalNode, ctx?: ...): void` (parameter type + return type 둘 다 검토)
2. **caller cascade 동반** — 변경 함수의 모든 caller (직접/간접) 가 단일 commit 안에서 같이 변경. 부분 변경 시 type-check 가 fail 하므로 type-check 0 error 가 cascade 완결성을 자동 검증
3. **lookup pattern 변경** — `childrenMap.get(el.id)` → `getChildren(node)` 또는 `node.children` 직접 access. ADR-127 helper API (`getChildren / getParent / getAncestors / findByPath / getNodeMap / getChildrenByParent`) 만 사용
4. **type alias rename 금지** — `Element` 식별자를 `LegacyElement` 같은 alias 로 바꿔 grep gate 통과시키는 패턴 절대 금지. memory `feedback-adr-essence-priority-over-formal-pass` 인용 — 형식적 PASS vs 진정 reverse 명시 분리 의무

### 전환 패턴 예시

```typescript
// ❌ Before — Element 직접 소비
function renderElement(element: Element): void {
  const children = childrenMap.get(element.id) ?? [];
  // ...
}

// ❌ 우회 패턴 (금지) — type alias rename 만으로 grep gate 통과
import type { LegacyElement as Element } from "..."; // 절대 금지
function renderElement(element: Element): void {
  // 행위 동일
  const children = childrenMap.get(element.id) ?? [];
}

// ✅ After — canonical-native (진정 reverse)
import type { CanonicalNode } from "@composition/shared/types/composition-document.types";
import { getChildren } from "@/builder/stores/canonical/canonicalTraversalHelpers";

function renderNode(node: CanonicalNode): void {
  const children = getChildren(node); // = node.children, ordered
  // ...
}
// → caller cascade: BuilderCanvas / hooks / scene model build 모두 같이 변경
```

### 5.3. Sub-group 별 검증 요건 (Gate G2-A ~ G2-E + follow-up G2-F)

각 sub-group 완료 시 모두 통과 필수. 단일 sub-group commit 단위:

| 검증 항목                       | 기준                                                                                      | 우회 차단                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **caller cascade evidence**     | sub-group 안의 변경 함수 list + 각 caller list 가 commit message body 또는 PR 본문에 명시 | type alias rename 우회 시 caller list 0개 → 자동 차단      |
| **type-check**                  | `pnpm type-check` 0 error                                                                 | 부분 cascade 시 type 불일치 → fail                         |
| **targeted vitest**             | sub-group directory 의 `__tests__/**` 또는 `*.test.ts(x)` PASS                            | scene model / helper API test 가 변경 행위 검증            |
| **grep gate (보조)**            | `rg -n "import.*\bElement\b" <sub-group dir>` 결과 0건 (boundary/test 제외)               | 단독 PASS 기준 아님 — 위 3 검증과 AND 조건                 |
| **FPS gate (2-A/2-B 만)**       | 60fps 실측 PASS (Phase 1 baseline 120.5 대비 -5% bound = 114fps 이상)                     | render path 변경 sub-group 만 적용 (2-A Skia / 2-B layout) |
| **render parity (2-A/2-B/2-E)** | Builder ↔ Preview 시각 결과 동일 — `cross-check` skill 또는 수동 screenshot diff          | render path / preview 변경 sub-group 만 적용               |

### 5.4. Phase 2 종료 Gate (G2 — 종합)

5 sub-group (2-A ~ 2-E) 모두 land 후 종합 검증. 2-F는 2-A~2-D 후속
residual cleanup 이므로 동일 검증 요건을 적용한다:

```bash
# Phase 2 종료 grep gate (보조 검증, 단독 PASS 기준 아님)
rg -n "import.*\bElement\b" \
  apps/builder/src/builder/workspace \
  apps/builder/src/builder/panels \
  apps/builder/src/resolvers \
  apps/builder/src/preview \
  --include="*.ts" --include="*.tsx" \
  | grep -v "boundary\|adapter\|test\|spec\|\.test\."
```

- 위 명령 결과 0건 (sub-group 모두 land 후 자동 충족)
- `pnpm type-check` 0 error (전체 monorepo)
- 5 sub-group 및 2-F follow-up 의 caller cascade evidence 가 ADR 진행 로그에 누적
- 60fps 실측 PASS (전체 render path 통합)
- `Element` 타입 alias rename 0건 — `rg -n "(Legacy|Old|Deprecated)Element\b" apps/builder/src` 결과 0 (또는 명시적 boundary file 만)
- Skia/Preview targeted Vitest PASS (2-A/2-B/2-E 검증)
- panels properties + nodes targeted Vitest PASS (2-D 검증)

---

## 6. Phase 3 — store cache canonical-native 전환

**목표**: `elementsMap` / `childrenMap` store state의 `Element` key/value 타입 참조를 canonical-native로 전환한다. ADR-125 render input contract closure 후 store cache 가 canonical-derived read-only 로 좁아진 상태에서 진행.

### 작업

1. ADR-122/125 closure 후 direct hot-path read 가 0건인지 확인 — `useStore.getState().elementsMap|childrenMap` 0 hit 는 direct read closure 근거일 뿐 store state 타입 closure 로 간주하지 않는다
2. `unified.types.ts` store state 인터페이스에서 `elements: Element[]` 제거 또는 canonical-derived readonly 타입으로 교체
3. `elements.ts` store slice에서 `Element[]` state 제거 또는 deprecated 마킹
4. `useElements`, `useElementById`, `useChildElements` hook이 canonical-native source를 사용하는지 확인 (ADR-122 Phase 4에서 일부 전환됨)

### Phase 3 Gate (G3)

```bash
# store state에서 Element key/value 참조
rg -n "elementsMap.*Element|Element.*elementsMap|childrenMap.*Element" \
  apps/builder/src/builder/stores \
  --include="*.ts"
```

- 위 명령 결과 non-deprecated 참조 0건
- `pnpm -F @composition/builder exec vitest run src/builder/stores` PASS

---

## 7. Phase 4 — history / inspector / drag-drop consumer 전환

**목표**: Phase 2에서 다루지 않은 나머지 hot path consumer를 전환한다.

### 대상 파일

| 파일                        | 현재 의존                    | 전환 방향                      |
| --------------------------- | ---------------------------- | ------------------------------ |
| `historyActions.ts`         | `Element[]` 기반 diff/undo   | canonical patch/event 계약     |
| `canonicalHistoryEvents.ts` | `Element[]` undo result      | canonical-native event         |
| `instanceActions.ts`        | `Element` instance 조작      | canonical-native ref node API  |
| `inspectorActions.ts`       | `Element` selected lookup    | canonical-native selection     |
| drag-drop handlers          | `Element` 기반 position/move | canonical-native node position |

### Phase 4 Gate (G4)

boundary allowlist grep:

```bash
# boundary allowlist 외 Element[] 생성 0건
rg -n "Element\[\]|: Element\b" \
  apps/builder/src \
  --include="*.ts" --include="*.tsx" \
  | grep -v "boundary\|adapter\|projectSync\|export\|import\|publish\|\.test\.\|legacy"
```

- 위 명령 결과 0건
- undo/redo Vitest targeted PASS
- `inspectorActions` canonical read gate PASS

---

## 8. Phase 5 — derived view 제거

**목표**: `canonicalDocumentToElements()`, `useCanonicalElements()`, `useCanonicalSelectedElement()` non-boundary 호출을 모두 제거한다.

### 작업

1. `canonicalElementsView.ts` non-boundary export 함수들에 `@deprecated` 마킹 확인 (Phase 2에서 선행 가능)
2. non-boundary 호출처 0건 확인 (grep gate)
3. boundary 파일로의 re-export 정리 (`exportLegacyDocument.ts`, `projectSync.ts` 등)
4. `canonicalElementsView.ts` hot path 함수 파일 자체를 boundary allowlist 디렉토리로 이동

### Phase 5 Gate (G5)

```bash
# non-boundary에서 canonicalDocumentToElements / useCanonicalElements 호출
rg -n "canonicalDocumentToElements\(|useCanonicalElements\(" \
  apps/builder/src \
  --include="*.ts" --include="*.tsx" \
  | grep -v "boundary\|adapter\|export\|projectSync\|\.test\."
```

- 위 명령 결과 0건
- `canonicalElementsView.ts` 자체가 boundary 디렉토리로 이동됨
- `pnpm type-check` 0 error

---

## 9. Phase 6 — final verification + Element 타입 @deprecated 마킹

**목표**: 전체 검증 + `Element` 인터페이스를 `@deprecated` 마킹하여 신규 추가를 경고 레벨에서 차단한다. 타입 삭제는 이 ADR scope 밖.

### 작업

1. `unified.types.ts`의 `Element` 인터페이스에 `@deprecated` JSDoc 추가

   ```typescript
   /**
    * @deprecated ADR-126 완결. canonical-native node/path/alias model 사용.
    * boundary allowlist (projectSync, exportLegacyDocument, cloud/export/import adapter)에서만 허용.
    * 타입 삭제는 별도 cleanup ADR.
    */
   export interface Element { ... }
   ```

2. `eslint-plugin-deprecation` 설정에 `Element` 추가 (신규 import 경고)
3. browser smoke: create/edit/delete/undo/redo/reorder/origin-instance/refresh 회귀 0
4. `pnpm run codex:preflight` PASS
5. ADR 본문 Status `Proposed → Implemented` 업데이트

### Phase 6 Gate (G6)

| 검증 항목         | 명령                                                                                               | 통과 기준                           |
| ----------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| type-check        | `pnpm type-check`                                                                                  | 0 error                             |
| store unit tests  | `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical src/adapters/canonical` | PASS                                |
| shared utils      | `pnpm -F @composition/shared exec vitest run src/utils`                                            | PASS                                |
| browser smoke     | 수동 + Chrome MCP                                                                                  | create/edit/delete/undo/redo 회귀 0 |
| boundary grep     | Phase 4 grep gate                                                                                  | 0건                                 |
| derived view grep | Phase 5 grep gate                                                                                  | 0건                                 |
| preflight         | `pnpm run codex:preflight`                                                                         | PASS                                |
| FPS               | 실측                                                                                               | 60fps 기준 -5% 이내                 |

---

## 10. Phase Plan 요약

| Phase       | 목표                                                          | 주요 산출물                                                                                     | Gate | 진입 조건                             |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| Phase 0     | Inventory freeze                                              | bucket 분류 + prerequisite 확인                                                                 | G0   | 없음 (즉시 수행 가능)                 |
| Phase 1     | canonical-native model 검증                                   | hot path 커버 가능 여부 + FPS baseline                                                          | G1   | ADR-123/124/125 Implemented           |
| **Phase 2** | **hot path consumer 전환 (5 sub-group + residual follow-up)** | sub-group 별 caller cascade evidence + targeted vitest + type-check                             | G2   | G1 PASS + ADR-127 Implemented         |
| ↳ 2-A       | Skia render path                                              | `workspace/canvas/skia/**` + `scene/**` (실측 24 file). scene model 직접 access swap            | G2-A | G1 PASS + ADR-127 Implemented         |
| ↳ 2-B       | Layout engine                                                 | `workspace/canvas/layout/**` (~8 file). `processedElementsMap` cascade                          | G2-B | 2-A PASS (render path 의존)           |
| ↳ 2-C       | Renderer input + ref resolution                               | `rendererInput.ts` + `canonicalRefResolution.ts` + `storeBridge.ts` (~8 file)                   | G2-C | 2-A PASS                              |
| ↳ 2-D       | Panels (properties + nodes/LayerTree)                         | `panels/properties/**` + `panels/nodes/**` (~25 file)                                           | G2-D | 2-C PASS (canonical helper API 의존)  |
| ↳ 2-E       | Preview render                                                | `preview/**` + `services/messaging.ts` layout receive (~7 file)                                 | G2-E | 2-A PASS (scene snapshot 송신측 의존) |
| Phase 3     | store cache 전환                                              | `elementsMap`/`childrenMap` store state 타입 canonical-native 또는 deprecated readonly snapshot | G3   | G2 PASS                               |
| Phase 4     | history/inspector/drag-drop/AI tools/messaging                | 나머지 consumer + boundary allowlist (BuilderCore mount / utility / Factory 포함)               | G4   | G3 PASS                               |
| Phase 5     | derived view 제거                                             | `canonicalDocumentToElements` non-boundary 0건                                                  | G5   | G4 PASS                               |
| Phase 6     | final verification                                            | `@deprecated` 마킹 + browser smoke + preflight                                                  | G6   | G5 PASS                               |

**Phase 2 진입 권고 순서**: 2-A → 2-C → 2-B → 2-E → 2-D. 이유 — 2-A (Skia render path) 가 ADR-127 helper API 직접 access 진입점이라 가장 작은 scope 로 진정 reverse 패턴 검증 가능. 2-A 완료 후 cascade 학습값으로 2-B/2-C/2-E/2-D 적용. agent dispatch 사용 여부는 2-A 직접 land 결과 후 판단 (memory `feedback-agent-completion-failure-pattern` — HIGH 위험 작업 agent dispatch 신뢰도 낮음).

---

## 11. 관련 파일 (Phase 0 inventory + Phase 2 sub-group 매핑)

전체 50+ file inventory 는 [126-inventory.md](126-inventory.md) §3 참조. 본 §11 은 Phase 2 sub-group 별 우선 진입 file + Phase 4 위임 file 매핑.

### derived-view bucket (Phase 5 제거)

- `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` (정의)
- `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` (호출 ~2건)

### store-cache bucket (Phase 3 — direct read closure 확인 + store state 타입 전환)

- `apps/builder/src/builder/stores/elements.ts`
- `apps/builder/src/types/builder/unified.types.ts` (store state 인터페이스)
- direct read 측정: `useStore.getState().elementsMap|childrenMap` production hit = **0** (inventory §3-B)
- 잔여: `ElementsState.elementsMap: Map<string, Element>` / `childrenMap: Map<string, Element[]>` 타입 참조는 Phase 3 G3 에서 제거 또는 deprecated readonly snapshot 으로 정렬

### hot-path-consumer bucket — Phase 2 sub-group 매핑

#### 2-A. Skia render path

**Status: Core Landed — 2026-05-10**

2-A는 `Element` 타입 표면을 이름만 바꾸는 방식이 아니라 canonical document 에서
renderable `CanvasSceneNode` graph 를 생성한 뒤 Skia render bridge/command stream 이
그 graph 를 직접 소비하도록 전환했다.

**구현 결과**:

- 신규 `canvasSceneNode.ts`:
  - `buildCanvasSceneGraph(doc)` — `CompositionDocument.children` 에서 renderable scene node flat projection + `nodesMap` + `childrenByParent` + `parentById` 생성
  - `buildCanvasScenePageIndex(graph)` — legacy `rebuildPageIndex(Element[])` 대신 canonical scene graph 기반 page index 생성
- `canonicalSceneModel.ts`:
  - `canonicalDocumentToElements()` 내부 호출 제거
  - `sceneNodes` / `sceneNodesMap` / `sceneChildrenByParent` / `sceneParentById` export 추가
  - `pageIndex` 를 `buildCanvasScenePageIndex(sceneGraph)` 로 derive
- `rendererInput.ts`:
  - `SkiaRendererInput` 에 scene graph fields 추가
  - canonical scene graph 미주입 시에만 legacy bootstrap fallback graph 생성
- Skia caller cascade:
  - `SkiaCanvas` `StoreRenderBridge.sync()` 입력을 `sceneNodesMap` / `sceneChildrenByParent` 로 전환
  - `StoreRenderBridge` / `renderCommands` / `skiaFramePipeline` / visible roots / node data builders 의 `Element` 타입 표면을 `CanvasSceneNode` 로 전환

**G2-A evidence**:

- 변경 함수/consumer cascade:
  - `buildCanonicalSceneModel()` → `BuilderCanvas` → `createSkiaRendererInput()` → `SkiaCanvas` → `StoreRenderBridge.sync()`
  - `buildSkiaFrameContent()` / `buildViaCommandStream()` → `renderCommands` → node data builders
  - `collectVisibleFrameRoots()` / `collectVisiblePageRoots()` → canonical scene maps
- Grep gate:
  - `workspace/canvas/skia/**` + `workspace/canvas/scene/**` production `Element` import/raw hit 0
  - Skia production `rendererInput.elementsMap|childrenMap` hit 0
  - `(Legacy|Old|Deprecated)Element` hit 0
- Verification:
  - `pnpm -F @composition/builder type-check` PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia src/builder/workspace/canvas/scene src/builder/workspace/canvas/renderers` — 18 files / 152 tests PASS (`HTMLCanvasElement.getContext()` jsdom warning only)
  - `git diff --check` PASS
  - browser smoke `/builder/adr-126-phase2a-smoke`: canvas 1440x952, data URL nonblank, console/page error 0, rAF median 120.5fps / p10 112.4 / p99 135.1

**잔여를 Phase 2/5에 위임**:

- `CanvasSceneNode` 는 transition alias `parent_id` / `page_id` / `componentName` 을 가진다. 신규 Skia code 는 `parentId` / `pageId` / `name` 을 선호해야 하며 alias 제거는 lookup/caller cascade 잔여 정리와 함께 진행한다.
- `BuilderCanvas` 의 `getSceneModel*Legacy` fallback 과 store `Element` import, `rendererInput.ts` 의 render-tree fallback `Element` shape 는 2026-05-10 canvas renderer input/bootstrap projection follow-up 에서 제거됐다. 초기 bootstrap legacy store 변환만 `canonicalSceneModelLegacy.ts` boundary 로 격리한다.

- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`
- `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts` (Element type read)
- `apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts` (legacy getter caller)
- `apps/builder/src/builder/workspace/canvas/scene/buildSpecNodeData.ts`
- 기타 `workspace/canvas/skia/**` + `workspace/canvas/scene/**` Element 타입 import file

#### 2-B. Layout engine

**Status: Core Landed — 2026-05-10**

2-B core 는 layout code 가 Builder store `Element` 타입을 직접 import 하던 표면을
layout 전용 최소 contract 로 분리하고, page/frame layout publisher input 명칭과
shape 를 실제 역할에 맞게 정리했다.

**구현 결과**:

- `apps/builder/src/builder/workspace/canvas/layout/layoutNode.ts`
  - `CanvasLayoutNode` layout contract 도입
  - legacy store node 와 canonical `CanvasSceneNode` 양쪽이 구조적으로 통과 가능한 최소 shape 로 고정
- `apps/builder/src/builder/workspace/canvas/layout/**`
  - production `Element` import/raw type surface 제거
  - `fullTreeLayout.ts`, `implicitStyles.ts`, `utils.ts`, Taffy engine 계층이 `CanvasLayoutNode` 를 소비
- `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`
  - layout cache input 을 `CanvasSceneNode` 전용에서 `CanvasLayoutNode` 로 낮춰 layout contract boundary 를 명시
- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`
  - `PixiPageRendererInput` → `LayoutPublisherInput`
  - `buildPixiPageRendererInput()` → `buildPageLayoutPublisherInput()`
  - `buildFrameRendererInput()` → `buildFrameLayoutPublisherInput()`
  - page/frame layout publisher input 의 `bodyElement` / `elementById` / `pageElements` 를 `CanvasLayoutNode` 로 전환
- `BuilderCanvas` caller cascade:
  - page layout publisher input 과 frame layout publisher input 이 새 함수명/shape 를 소비
  - `useLayoutPublisher` 가 `LayoutPublisherInput` 을 소비

**G2-B evidence**:

- Grep gate:
  - `workspace/canvas/layout/**` + `workspace/canvas/scene/layoutCache.ts` + `workspace/canvas/hooks/useLayoutPublisher.ts` production `Element` raw/type hit 0
  - production `PixiPageRendererInput|buildPixiPageRendererInput|buildFrameRendererInput` hit 0
- Targeted tests:
  - `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/layout src/builder/workspace/canvas/scene/layoutCache.ts src/builder/workspace/canvas/renderers` — 10 files / 63 tests PASS
- Type-check:
  - `pnpm -F @composition/builder type-check` PASS

**잔여를 Phase 5에 위임**:

- `rendererInput.ts` 의 `SkiaRendererInput.elements/elementsMap/childrenMap` 은 2026-05-10 follow-up 에서 `CanvasSceneNode` contract 로 전환됐다.
- `BuilderCanvas` 의 `getSceneModel*Legacy` fallback 과 store `Element` import 는 제거됐고, bootstrap 변환은 `canonicalSceneModelLegacy.ts` boundary 로 격리됐다.
- `CanvasLayoutNode` 는 transition 중 `parent_id/page_id/layout_id` legacy field 를 허용한다. alias 제거는 Phase 5 boundary 정리에서 처리한다.

- `apps/builder/src/builder/workspace/canvas/layout/fullTreeLayout.ts` (`enrichWithIntrinsicSize`, `processedElementsMap`)
- `apps/builder/src/builder/workspace/canvas/layout/layoutCache.ts`
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
- 기타 `workspace/canvas/layout/**` Element 타입 import file

#### 2-C. Renderer input + ref resolution

**Status: Core Landed — 2026-05-10**

2-C core 는 ref resolver 자체가 `Element` 타입에 고정되어 있던 문제를 먼저 닫았다.

**구현 결과**:

- `apps/builder/src/adapters/canonical/canonicalRefResolution.ts`
  - `Element` import 제거
  - `CanonicalRefResolvableNode` generic contract 도입
  - `resolveCanonicalRefElement<T>()`, `resolveCanonicalRefElementsMap<T>()`, `resolveCanonicalRefTree<T>()` 로 generic화
  - `parent_id/page_id/layout_id` 와 `parentId/pageId/layoutId` 양쪽을 읽고 쓰도록 transition field bridge 제공
- `apps/builder/src/resolvers/canonical/storeBridge.ts`
  - `Element` import 제거
  - `resolveInstanceWithSharedCache<T extends CanonicalRefResolvableNode>()` 로 generic화
  - legacy component mirror field / canonical `ref` 양쪽 instance를 동일 경로로 처리
- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`
  - 주입된 `CanvasSceneGraph` 를 `resolveCanonicalRefTree<CanvasSceneNode>()` 로 직접 resolve
  - canonical scene graph 미주입 시에만 legacy bootstrap fallback graph 생성

**G2-C evidence**:

- Grep gate:
  - `canonicalRefResolution.ts` + `storeBridge.ts` `Element` raw/type hit 0
- Targeted tests:
  - `createSkiaRendererInput.test.ts` 에 canonical scene graph ref resolution 회귀 테스트 추가
  - `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/renderers src/builder/utils/canonicalRefResolution.test.ts src/resolvers/canonical` — 9 files / 113 tests PASS
- Type-check:
  - `pnpm -F @composition/builder type-check` PASS
- Diff hygiene:
  - `git diff --check` PASS

**잔여를 Phase 2-B/2-D에 위임**:

- `rendererInput.ts` 의 render-tree fallback `Element` shape 와 `BuilderCanvas` legacy `getSceneModel*Legacy` fallback 은 2026-05-10 canvas renderer input/bootstrap projection follow-up 에서 제거됐다.
- 잔여는 transition alias 제거와 Phase 3/4/5 consumer 전환으로 이월한다.

- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`
- `apps/builder/src/adapters/canonical/canonicalRefResolution.ts`
- `apps/builder/src/resolvers/canonical/storeBridge.ts`

#### 2-D. Panels (properties + nodes/LayerTree)

**Status: Core Landed — 2026-05-10**

2-D core 와 frame tree read/load follow-up 은 panels read path 와 canvas interaction
read model 이 Builder store `Element` import 를 직접 소비하던 표면을 최소 구조
contract 로 분리했다. 전체 G2-D 종료는 아니며, 생성형 property editor / drop
target resolver 는 후속 slice 로 남긴다.

**구현 결과**:

- 신규 `apps/builder/src/builder/panels/panelNode.ts`
  - properties / LayerTree 가 읽는 최소 `PanelNode` contract 정의
  - `id`, `type`, `props`, `parent_id`, `page_id`, `layout_id`, slot/ref/component mirror transition field 만 허용
- `useCanonicalPropertyRead.ts`
  - `Element` import 제거
  - property sections 가 `PanelNode[]`, `ReadonlyMap<string, PanelNode>`, `ReadonlyMap<string, PanelNode[]>` 를 소비
- `LayersSection.tsx` + `LayerTree/*`
  - `buildLayerSectionElementMap`, `resolveLayerTreeEditingContext`, `useLayerTreeData`, `LayerTreeNode`, item delete/click props 를 `PanelNode` 기반으로 전환
  - canonical LayerTree source merge/dedupe 는 type alias rename 없이 caller cascade 동반 전환
- `ComponentSemanticsSection.tsx`, `ComponentSlotFillSection.tsx`, `FrameSlotSection.tsx`
  - component origin/slot/fill read path 의 store `Element` import 제거
  - slot/fill update patch cast 는 `Partial<PanelNode>` 로 좁힘
- 신규 `apps/builder/src/builder/workspace/canvas/interaction/interactionNode.ts`
  - selection / context menu / drag / hover / scroll 이 공유하는 최소 `CanvasInteractionNode` contract 정의
- `selectionHitTest.ts`, `selectionModel.ts`, `canvasContextMenu.ts`
  - hit-test / selected bounds / detach context menu input 을 `CanvasInteractionNode` map 으로 전환
- `BuilderCanvas.tsx`, `useDragBridge.ts`, `useElementHoverInteraction.ts`, `useScrollWheelInteraction.ts`, `SkiaCanvas.tsx`
  - interactive refs / drag / hover / scroll input 을 `rendererInput.sceneNodesMap` + `sceneChildrenByParent` 로 전환
  - `CanvasSceneNode.layout_id` transition alias 를 보강해 existing frame mirror helper 가 scene node 에서도 frame body 를 판정 가능하게 유지
- `apps/builder/src/adapters/canonical/frameElementLoader.ts`
  - store `Element` import/cast 제거
  - `loadFrameElements()` 반환을 `FrameElementNode` structural contract 로 전환
- `FramesTab.tsx`, `FrameElementTree.tsx`
  - frame tree read/delete/click props 를 `PanelNode` 기반으로 전환
  - frame loader + frame tree production store `Element` import hit 0
- `LayoutPresetSelector/usePresetApply.ts`
  - store `Element` import/cast 제거
  - 기존 slot 탐지 / canonical replace filter / slot create payload 를 `PresetElementNode` / `PresetSlotElement` structural contract 로 전환
  - production `Element` raw/type/import hit 0
- `LayoutPresetSelector/usePresetApply.static.test.ts`
  - store `Element` fixture import/cast 제거
  - static guard 에 `types/builder/unified.types` / `as Element` 부정 검증 추가
- 신규 `apps/builder/src/builder/panels/properties/editors/propertyEditorNode.ts`
  - property editor child/add payload 용 `PropertyEditorElementPayload` / `PropertyEditorChildNode` structural contract 정의
- `ListBoxItemEditor.tsx`, `TagEditor.tsx`, `TreeItemEditor.tsx`
  - generated child add payload 에서 store `Element` import 제거
  - `ListBoxItemEditor` / `TagEditor` customId 생성은 `useCanonicalPropertyElements()` 를 소비
- `tabsItemActions.ts`, `TabsEditor.tsx`
  - TabPanel lookup input 을 caller 주입 `PropertyEditorChildNode[]` 로 전환
  - `tabsItemActions.ts` 의 `useStore.getState().elements` direct read 제거
- `useCollectionItemManager.ts`
  - collection children/read result 를 `CollectionItemNode` structural contract 로 전환
  - Supabase insert 후 store add payload cast 를 store `Element` 대신 `CollectionItemNode` 로 축소
- `ChildItemManager.tsx`
  - generated child add payload 를 `ChildItemPayload` 로 전환
  - customId 생성은 `useCanonicalPropertyElements()` 를 소비
  - direct `useStore.getState().elements` read 제거
- `TableEditor.tsx`, `TableHeaderEditor.tsx`
  - row/column/cell/group create payload 를 `TableEditorElementPayload` / `TableHeaderElementPayload` structural contract 로 전환
  - `TableHeaderEditor` 의 column/cell lookup 과 customId 생성은 canonical property elements 를 소비
  - table generated editor production store `Element` import/raw payload hit 0
- `dropTargetResolver.ts`
  - store `Element` import 제거
  - drag/drop target read model, children map, projection helper, reorder helper를 `DropTargetNode` structural contract 로 전환
- `dropTargetResolver.test.ts`
  - local `DropTargetNode` fixture 로 전환

**G2-D core evidence**:

- Grep gate:
  - panels read path (`useCanonicalPropertyRead`, `LayersSection`, `LayerTree`, Component semantics/slot/fill sections) store `Element` import hit 0
  - canvas interaction core (`selectionHitTest`, `selectionModel`, `canvasContextMenu`, drag/hover/scroll hooks) store `Element` import hit 0
  - `rendererInputRef.current.elementsMap|childrenMap` interaction hook input hit 0
- Targeted tests:
  - `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/ComponentSlotFillSection.test.tsx src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/panels/nodes/LayersSection.test.ts src/builder/workspace/canvas/interaction/selectionModel.test.ts src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts` — 11 files / 82 tests PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab src/adapters/canonical/__tests__/frameElementLoader.test.ts` — 5 files / 45 tests PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts` — 1 file / 4 tests PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts` — 1 file / 5 tests PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/hooks/useCollectionItemManager.static.test.ts src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts` — 2 files / 4 tests PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts` — 1 file / 6 tests PASS
  - `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/selection/dropTargetResolver.test.ts` — 1 file / 13 tests PASS
- Type-check:
  - `pnpm -F @composition/builder type-check` PASS

**잔여를 Phase 2/4/5에 위임**:

- `rendererInput.ts` render-tree fallback 과 `BuilderCanvas` legacy bootstrap projection 은 2026-05-10 follow-up 에서 닫혔다.
- 남은 canvas 계열 debt 는 `CanvasSceneNode` transition alias 제거와 Phase 4 drag/drop helper 잔여 consumer 정리다.

- `apps/builder/src/builder/panels/properties/**` (selected node read + property panels)
- `apps/builder/src/builder/panels/nodes/**` (LayerTree tree model)
- `apps/builder/src/builder/panels/properties/hooks/useCanonicalPropertyRead.ts`
- `apps/builder/src/builder/panels/nodes/LayersSection.tsx`

#### 2-E. Preview render

**Status: Core Landed — 2026-05-10**

2-E core 는 Preview runtime 이 이미 갖고 있던 `RuntimeElement` /
`PreviewElement` 경계를 Builder store `Element` 로 되돌리는 cast/import 를 제거하고,
message/url/layout resolver 의 preview-local contract 를 명시했다.

**구현 결과**:

- `apps/builder/src/preview/App.tsx`
  - store `Element` import 제거
  - `resolveCanonicalRefTree<PreviewElement>()` 로 canonical ref resolution 직접 수행
  - `isLegacyFrameElementForFrame()` caller cast 제거
- `apps/builder/src/preview/utils/layoutResolver.ts`
  - builder `Element` / layout result type import 제거
  - preview-local `ResolvedElement`, `ResolvedSlotContent`, `LayoutResolutionResult`, `SlotValidationError` 정의
  - resolver input/output 을 `PreviewElement` 로 전환
- `apps/builder/src/services/messaging.ts`
  - `MessagingElement` / `MessageProps` contract 도입
  - iframe message payload 에서 store `Element` / `ComponentElementProps` import 제거
- `apps/builder/src/utils/urlGenerator.ts` + `preview/router/CanvasRouter.tsx`
  - `UrlPage` / `UrlLayout` contract 도입
  - preview router 의 builder `Page` import 제거
- `apps/builder/src/adapters/canonical/frameElementScope.ts` / `frameElementLoader.ts`
  - preview caller 가 store `Element` cast 없이 frame mirror helper 를 호출할 수 있도록 frame helper 를 generic node contract 로 완화

**G2-E evidence**:

- Grep gate:
  - `apps/builder/src/preview/**` + `apps/builder/src/services/messaging.ts` + `apps/builder/src/utils/urlGenerator.ts` production `Element` raw/type import hit 0
  - 같은 scope production `UPDATE_ELEMENTS` hit 0
- Targeted tests:
  - `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/adapters/canonical/__tests__/frameElementLoader.test.ts` — 2 files / 9 tests PASS
- Type-check:
  - `pnpm -F @composition/builder type-check` PASS

**잔여를 Phase 2/4/5에 위임**:

- 잔여 생성형 property editor write payload caller 는 후속 panels/write payload slice에서 정리한다.

- `apps/builder/src/preview/utils/layoutResolver.ts`
- `apps/builder/src/preview/App.tsx`
- `apps/builder/src/services/messaging.ts` (iframe message payload boundary)

#### 2-F. Canvas renderer input/bootstrap projection follow-up

**Status: Landed — 2026-05-10**

2-F는 2-A~2-D 후에도 Phase 5 잔여로 남아 있던 `rendererInput.ts` render-tree
`Element` shape 와 `BuilderCanvas` legacy scene projection fallback 을 닫은 정리
slice다.

**구현 결과**:

- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`
  - `Element` import 제거
  - `SkiaRendererInput.elements/elementsMap/childrenMap` 을 `CanvasSceneNode` contract 로 전환
  - `CreateSkiaRendererInputOptions.sceneChildrenByParent/sceneNodes/sceneNodesMap` 을 필수 입력으로 전환
  - canonical scene graph 미주입 시 내부에서 legacy graph 를 만드는 fallback 제거
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
  - `getSceneModelElementsLegacy` / `getSceneModelElementsMapLegacy` / `getSceneModelChildrenByParentLegacy` 호출 제거
  - store `Element` import 제거
  - scene snapshot, workflow/data-source edges, Skia renderer input 이 모두 `sceneNodes` / `sceneNodesMap` / `sceneChildrenByParent` 를 소비
- `apps/builder/src/builder/stores/canonical/canonicalSceneModelLegacy.ts`
  - active canonical document 가 아직 없는 bootstrap fallback 용 `buildLegacyCanvasSceneGraph()` boundary 추가
  - legacy store `Element[]` → `CanvasSceneGraph` 변환을 workspace/canvas 밖 transition boundary 로 격리

**G2 follow-up evidence**:

- Grep gate:
  - `BuilderCanvas.tsx` + `renderers/rendererInput.ts` production store `Element` import/raw type hit 0
  - 같은 scope `getSceneModel*Legacy` / `canonicalDocumentToElements(` hit 0
- Targeted tests:
  - `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts src/builder/workspace/canvas/hooks/useScrollWheelInteraction.static.test.ts` — 4 files / 10 tests PASS
- Type-check:
  - `pnpm -F @composition/builder type-check` PASS

**잔여를 Phase 3/4/5/6에 위임**:

- Phase 3: store-cache state type (`elementsMap` / `childrenMap`) 전환
- Phase 4: history / inspector / drag-drop / AI tools / messaging 잔여 consumer 전환
- Phase 5: `canonicalDocumentToElements` / `useCanonicalElements` derived-view 제거와 transition alias 정리
- Phase 6: final grep audit, `Element` deprecated marking, browser smoke

### hot-path-consumer bucket — Phase 4 위임 (BuilderCore + utility + AI + drag-drop + history + inspector)

- `apps/builder/src/builder/main/BuilderCore.tsx` (mount)
- `apps/builder/src/builder/stores/history/historyActions.ts`
- `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts`
- `apps/builder/src/builder/stores/utils/instanceActions.ts`
- `apps/builder/src/builder/stores/inspectorActions.ts`
- `apps/builder/src/builder/utils/treeUtils.ts` / `multiElementCopy.ts` / `smartSelection.ts` / `selectionMemory.ts`
- `apps/builder/src/utils/element/idGeneration.ts` / `idValidation.ts`
- `apps/builder/src/services/ai/tools/createElement.ts` / `canonicalToolReadModel.ts`
- `apps/builder/src/utils/dom/iframeMessenger.ts` / `apps/builder/src/builder/utils/canvasDeltaMessenger.ts`
- `apps/builder/src/builder/factories/definitions/TableComponents.ts`
- drag-drop handler files

### boundary-allowed bucket (유지 — Phase 4/5/6 grep gate exempt)

- `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`
- `apps/builder/src/adapters/canonical/legacyElementSanitizer.ts`
- `apps/builder/src/adapters/canonical/legacyElementFields.ts`
- `apps/builder/src/adapters/canonical/legacyElementsApiService.ts`
- `apps/builder/src/adapters/canonical/frameElementLoader.ts`
- `apps/builder/src/builder/stores/canonical/canonicalSceneModelLegacy.ts` (ADR-127 transition boundary, workspace scope 외)
- `apps/builder/src/utils/projectSync.ts`
- `packages/shared/src/utils/export.utils.ts`
- `apps/builder/src/utils/element/elementUtils.ts` (boundary adapter 내부 유틸)

---

## 12. 공존 기간 상한

Phase 1 착수 시점(ADR-123/124/125 Implemented 후) 기준으로 **90일** 내 Phase 6 완결을 목표로 한다. Phase 2는 ADR-127 Implemented 이후에만 착수한다. 90일 초과 시 잔존 consumer를 ADR 본문 residual로 기록하고 별도 cleanup ADR 발의.
