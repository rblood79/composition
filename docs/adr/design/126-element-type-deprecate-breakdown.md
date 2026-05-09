# ADR-126 구현 상세 — Element 타입 Deprecate 및 canonical-native 전환

본 문서는 [ADR-126](../126-element-type-deprecate.md)의 Phase 계획, inventory 분류, Gate 측정 방법을 정의한다.

**진입 조건**: ADR-123 + ADR-124 + ADR-125 모두 `Implemented` 후에야 Phase 1 이상 착수 가능. Phase 0(inventory freeze)은 선행 수행 가능.

---

## 1. Fork Checkpoint (ADR-writing.md §ADR Fork / 분리 결정 시)

| 질문                           | 판정                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base / 응용 분류               | ADR-126은 **응용 ADR**. base = ADR-123(node/path model) + ADR-124(alias/resolver) + ADR-125(store cache). ADR-126은 그 위에서 `Element` 타입을 소비하던 consumer를 전환.                    |
| schema 직교성                  | `Element` shape는 canonical node shape의 specialization(flat projection)이 아니라 entirely different flat record. 두 schema는 직교가 아니며 ADR-126은 canonical side로 소비자를 이동시킨다. |
| baseline framing reverse 검증  | ADR-122 soft constraint("runtime source 제거 → derived view 축소 → boundary quarantine 순서")를 baseline으로 승계. 이 순서는 ADR-126에서도 유효하다. Phase 0→1→2→3→4→5→6 순서가 이를 반영.  |
| codex 1차 진입 전 framing 통과 | 4 질문 답변이 ADR 본문 §Context §Decision에 lock-in됨. sub-phase 분해 전 사용자 confirm 획득 필수.                                                                                          |

---

## 2. Target State

| Layer               | Target                                                                                 | 금지                                                     |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| hot path consumer   | canonical-native node/path/alias model 소비                                            | `Element[]` 파생 view를 hot path read source로 사용      |
| derived view        | boundary allowlist 파일로 격리 (`canonicalDocumentToElements`, `useCanonicalElements`) | non-boundary production 호출                             |
| store cache         | canonical-native snapshot / selector (ADR-125 결과물)                                  | `elementsMap`/`childrenMap`을 `Element` key/value로 유지 |
| history/undo        | canonical patch/event 계약 기반 diff                                                   | `Element[]` diff 기반 undo history                       |
| boundary (허용)     | projectSync, exportLegacyDocument, cloud/export/import/publish adapter                 | —                                                        |
| `Element` 타입 파일 | `@deprecated` 마킹 + boundary allowlist 파일로 이동                                    | hot path에서 신규 `Element` 타입 import                  |

---

## 3. Phase 0 — Inventory Freeze

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

| Bucket              | 의미                                                                                           | Phase                       |
| ------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| `derived-view`      | `canonicalDocumentToElements`, `useCanonicalElements`, `useCanonicalSelectedElement` 정의/호출 | Phase 5 제거                |
| `store-cache`       | `elementsMap`, `childrenMap` store state에서 `Element` key/value 참조                          | Phase 3 전환 (ADR-125 연동) |
| `hot-path-consumer` | Skia/layout/Preview/Properties/LayerTree/History/drag-drop에서 `Element` 타입 직접 소비        | Phase 2/4 전환              |
| `boundary-allowed`  | projectSync, exportLegacyDocument, cloud/export/import/publish adapter                         | 유지 허용                   |
| `test-doc`          | tests, fixtures, docs, static gates                                                            | Phase 6 정렬                |

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

**목표**: ADR-123/124/125에서 구축된 canonical-native node/path/alias model이 `Element` 없이 hot path를 커버하는지 검증한다. 실제 코드 변경 최소.

### 작업

1. ADR-123 canonical-native node model API 검토 — `Element`와 1:1 매핑 필요 없는 필드 목록 작성
2. ADR-124 alias/resolver API 검토 — `parent_id` flat 조회를 canonical tree traversal로 대체하는 resolver 확인
3. ADR-125 store cache 결과물 검토 — `elementsMap`/`childrenMap`이 canonical-native snapshot으로 교체됐는지 확인
4. hot path consumer 목록에서 canonical-native 대체 가능 여부 판정

### Phase 1 Gate (G1)

- canonical-native node/path/alias API가 `Element` 없이 Skia/layout/Preview hot path를 커버하는 타입 설계가 존재한다
- type-check 0 error
- FPS 측정 baseline 수립 (Phase 2 비교용)

---

## 5. Phase 2 — hot path consumer 전환 (Skia / layout / Preview / Properties / LayerTree)

**목표**: render/selection/layout hot path에서 `Element` 타입 import를 canonical-native로 전환한다.

### 우선 전환 대상 파일

| 파일                                      | 현재 의존                     | 전환 방향                                  |
| ----------------------------------------- | ----------------------------- | ------------------------------------------ |
| `StoreRenderBridge.ts`                    | `Element[]` → Skia node input | canonical scene snapshot 직접 소비         |
| `renderCommands.ts`                       | `Element` 기반 render tree    | canonical-native node traversal            |
| `rendererInput.ts`                        | `Element[]` input             | canonical-native resolved tree             |
| `canonicalRefResolution.ts`               | `Element` 기반 ref resolution | canonical-native ref node API              |
| `panels/properties/**`                    | `Element` selected node read  | ADR-124 canonical-native property read API |
| `panels/nodes/LayerTree`                  | `Element[]` tree model        | canonical-native node/path model           |
| Layout engine input (`fullTreeLayout.ts`) | `Element[]`                   | ADR-125 canonical-derived snapshot         |

### 전환 패턴

```typescript
// Before
function renderElement(element: Element): void {
  const children = childrenMap.get(element.id) ?? [];
  // ...
}

// After (canonical-native)
function renderNode(node: CanonicalNode, context: RenderContext): void {
  const children = context.resolver.children(node);
  // ...
}
```

### Phase 2 Gate (G2)

```bash
# hot path consumer에서 Element 타입 import 0건 검증 (boundary/test 제외)
rg -n "import.*\bElement\b" \
  apps/builder/src/builder/workspace \
  apps/builder/src/builder/panels \
  apps/builder/src/resolvers \
  --include="*.ts" --include="*.tsx" \
  | grep -v "boundary\|adapter\|test\|spec\|\.test\."
```

- 위 명령 결과 0건
- `pnpm type-check` 0 error
- 60fps 실측 PASS (Phase 1 baseline 대비 -5% 이내)
- Skia/Preview targeted Vitest PASS

---

## 6. Phase 3 — store cache canonical-native 전환

**목표**: `elementsMap` / `childrenMap` store state의 `Element` key/value 타입 참조를 canonical-native로 전환한다. ADR-125 결과물과 연동.

### 작업

1. ADR-125에서 이미 전환된 부분 확인 — 중복 전환 방지
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

| Phase   | 목표                             | 주요 산출물                                    | Gate | 진입 조건                   |
| ------- | -------------------------------- | ---------------------------------------------- | ---- | --------------------------- |
| Phase 0 | Inventory freeze                 | bucket 분류 + prerequisite 확인                | G0   | 없음 (즉시 수행 가능)       |
| Phase 1 | canonical-native model 검증      | hot path 커버 가능 여부 + FPS baseline         | G1   | ADR-123/124/125 Implemented |
| Phase 2 | hot path consumer 전환           | Skia/layout/Preview/Properties/LayerTree       | G2   | G1 PASS                     |
| Phase 3 | store cache 전환                 | `elementsMap`/`childrenMap` canonical-native   | G3   | G2 PASS + ADR-125 연동      |
| Phase 4 | history/inspector/drag-drop 전환 | 나머지 consumer + boundary allowlist           | G4   | G3 PASS                     |
| Phase 5 | derived view 제거                | `canonicalDocumentToElements` non-boundary 0건 | G5   | G4 PASS                     |
| Phase 6 | final verification               | `@deprecated` 마킹 + browser smoke + preflight | G6   | G5 PASS                     |

---

## 11. 관련 파일 (Phase 0 seed — 실 코드 기준 재측정 필요)

### derived-view bucket

- `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` (정의)
- `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` (호출 ~2건)

### store-cache bucket

- `apps/builder/src/builder/stores/elements.ts`
- `apps/builder/src/types/builder/unified.types.ts` (store state 인터페이스)

### hot-path-consumer bucket (Phase 2 우선)

- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`
- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`
- `apps/builder/src/adapters/canonical/canonicalRefResolution.ts`
- `apps/builder/src/resolvers/canonical/storeBridge.ts`
- `apps/builder/src/builder/panels/properties/**`
- `apps/builder/src/builder/panels/nodes/**` (LayerTree)

### hot-path-consumer bucket (Phase 4)

- `apps/builder/src/builder/stores/history/historyActions.ts`
- `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts`
- `apps/builder/src/builder/stores/utils/instanceActions.ts`
- `apps/builder/src/builder/stores/inspectorActions.ts`
- drag-drop handler files

### boundary-allowed bucket (유지)

- `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`
- `apps/builder/src/adapters/canonical/legacyElementSanitizer.ts`
- `apps/builder/src/adapters/canonical/frameElementLoader.ts`
- `apps/builder/src/utils/projectSync.ts`
- `packages/shared/src/utils/export.utils.ts`
- `apps/builder/src/utils/element/elementUtils.ts` (boundary adapter 내부 유틸)

---

## 12. 공존 기간 상한

Phase 1 착수 시점(ADR-123/124/125 Implemented 후) 기준으로 **90일** 내 Phase 6 완결을 목표로 한다. 90일 초과 시 잔존 consumer를 ADR 본문 residual로 기록하고 별도 cleanup ADR 발의.
