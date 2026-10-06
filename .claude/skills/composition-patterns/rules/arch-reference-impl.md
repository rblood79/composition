---
title: Reference Implementations
impact: HIGH
impactDescription: 참조 구현 = 일관된 패턴, 빠른 온보딩
tags: [architecture, reference, patterns]
---

새 기능 구현 시 참조할 모범 구현 파일 목록입니다.

> **Note**: 모든 경로는 `apps/builder/src/` 기준입니다.

## Component Spec / Catalog 패턴

> **Note**: 이 표의 경로는 `packages/` 기준입니다. ADR-142 catalog cutover 이후 컴포넌트 시각 정본은 catalog(`COMPONENT_RULES_TABLE`)이며, spec 파일은 잔존 최소 집합(Frame 등)만 유지됩니다.

| 패턴                  | 참조 파일                                                            | 설명                                                     |
| --------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| 시각 정본 (catalog)   | `shared/src/catalog/generated/componentRulesTable.ts`                | `COMPONENT_RULES_TABLE` — 컴포넌트 시각 스타일 SSOT      |
| ComponentSpec 정의    | `specs/src/components/Frame.spec.ts`                                 | 잔존 canonical spec 표준 구조 (ADR-130 layout container) |
| CSS 생성기            | `specs/src/renderers/CSSGenerator.ts`                                | Spec → CSS 파일 생성                                     |
| Catalog → Skia shapes | `specs/src/renderers/buildCatalogShapes.ts`                          | catalog rule → Shape[] 생성 (Skia consumer)              |
| Preview DOM binding   | `shared/src/catalog/runtime/{domBinding,delegatedDom}.tsx`           | RAC 기반 Preview/Publish DOM 렌더 (CSS consumer)         |
| 토큰 리졸버           | `specs/src/renderers/utils/tokenResolver.ts`                         | 토큰 → 실제 값 변환                                      |
| 색상 토큰             | `specs/src/primitives/colors.ts`                                     | 디자인 토큰 정의                                         |
| 그림자 토큰           | `specs/src/primitives/shadows.ts`                                    | 그림자 토큰 정의                                         |
| Skia Shape 변환기     | `(apps/builder) builder/workspace/canvas/skia/specShapeConverter.ts` | Shape[] → SkiaNodeData 변환                              |

자세한 설계는 `docs/reference/components/COMPONENT_SPEC.md` 참조.

## 컴포넌트 패턴

| 패턴                | 참조 파일                                                                       | 설명                                                                 |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| React-Aria Dialog   | `builder/panels/properties/editors/LayoutPresetSelector/ExistingSlotDialog.tsx` | Modal + 확인 흐름                                                    |
| 복합 패널           | `builder/panels/design/DesignPanel.tsx`                                         | 탭 (Property · Layout · Style · Text · Screen) + host 주입 (ADR-252) |
| Builder 아이콘 버튼 | `builder/components/ui/ActionIconButton.tsx`                                    | 공유 Button의 `.button-base` 우회, tooltip/shortcut 내장             |
| 패널 토글 tooltip   | `builder/layout/PanelToggleGroup.tsx`                                           | `ActionTooltipTrigger`, `.action-tooltip` CSS 재사용                 |

## Property Editor 패턴

| 패턴                 | 참조 파일                                                     | 설명                                                                                                  |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Properties 편집 명령 | `builder/catalogRuntime/editContract.ts`                      | `catalogPropertiesPatchCommand` — 바뀐 키만, binding 키 분리, 여럿이면 `composeCommands` (entry 하나) |
| 패널 명령 실행       | `builder/panels/navigator/catalog/useCatalogCommandRunner.ts` | `workspace.execute` + 거절 toast                                                                      |
| Styles host          | `builder/panels/styles/catalog/catalogStylesHost.ts`          | CSS 키 → typed field 명령, 미리보기 `previewRecord`                                                   |

## Canvas/Skia 패턴

| 패턴               | 참조 파일                                                                         | 설명                                                    |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Canvas 바인딩      | `builder/catalogRuntime/canvasBinding.ts`                                         | record → Skia 명령, rect diff 무효화                    |
| Selection hit-test | `builder/catalogRuntime/canvasPick.ts`                                            | `CatalogCanvasPicking` — 맥락 깊이로 정규화한 대상      |
| 드래그 · 드롭      | `builder/catalogRuntime/canvasGesture.ts` · `dropZoneContent.ts` · `layerTree.ts` | `moveNodes` 명령으로 이동                               |
| Viewport Control   | `builder/workspace/canvas/viewport/ViewportController.ts`                         | 줌/팬 처리                                              |
| Spec → Skia 변환   | `builder/workspace/canvas/skia/specShapeConverter.ts`                             | Shape[] → SkiaNodeData                                  |
| Skia 노드 렌더링   | `builder/workspace/canvas/skia/nodeRenderers.ts`                                  | box/text/image/line/container 렌더                      |
| rule 실행기        | `builder/catalogRuntime/ruleShapes.ts` · `rulePaint.ts`                           | catalog rule → shapes · paint (`_hasChildren` 3-branch) |

## 상태 패턴 (catalog runtime — ADR-248)

| 패턴            | 참조 파일                                           | 설명                                                                            |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| 문서 graph      | `packages/shared/src/catalog/document/graph.ts`     | `CatalogGraph` — entry table + 증분 인덱스                                      |
| 명령            | `packages/shared/src/catalog/commands/`             | `insertNodes` · `setFields` · `moveNodes` · `removeTargets` · `composeCommands` |
| 편집 진입       | `builder/catalogRuntime/workspace.ts`               | `CatalogWorkspace.execute`                                                      |
| step · 히스토리 | `builder/catalogRuntime/controller.ts`              | `CatalogRuntime.step` · undo/redo · `recordExternal`                            |
| 저장            | `builder/catalogRuntime/autosave.ts` · `storage.ts` | microtask autosave → IndexedDB                                                  |
| 남은 UI store   | `builder/stores/builderUiStore.ts`                  | 패널 배치 · 캔버스 설정 (Zustand)                                               |

## 서비스 패턴

> ADR-128 이후 cloud 백엔드는 없다 (인증도 2026-09-12 로컬 라이선스로 대체, 외부 서비스 의존 0) — DB CRUD 서비스 래퍼(구 ProjectsApiService/BaseApiService)와 `services/api/` 는 제거되었습니다. 문서 영속은 `catalogRuntime/storage.ts` (IndexedDB) 가 담당합니다.

## 생성 패턴

| 패턴          | 참조 파일                                                                 | 설명                                                    |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| 팔레트 삽입   | `builder/catalogRuntime/paletteInsert.ts`                                 | `catalogPaletteInsertPlan` — 노드 하나 + 위치 후보 판정 |
| origin 템플릿 | `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` | `REUSABLE_ORIGIN_DEFINITIONS` — composite 자식 트리     |
| instance 분리 | `packages/shared/src/catalog/commands/materialize.ts`                     | `createMaterializer`                                    |

## 메시징 패턴

| 패턴         | 참조 파일                                                                               | 설명                                 |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------ |
| Preview 채널 | `builder/catalogRuntime/previewChannel.ts` · `preview/catalog/catalogPreviewSession.ts` | `CATALOG_DELTA` · `CATALOG_SNAPSHOT` |

## 사용법

```typescript
// 새 컴포넌트 생성 시
// 1. 참조 파일 확인 (apps/builder/src/ 기준)
// 2. 동일한 패턴 적용
// 3. 관련 규칙 준수

// 예: 새 Dialog 컴포넌트
// 참조: builder/panels/properties/editors/LayoutPresetSelector/ExistingSlotDialog.tsx
// 규칙: react-aria-hooks-required, style-tv-variants
```

## ADR 참조

아키텍처 결정 배경은 다음 문서 참조:

- `docs/adr/completed/001-state-management.md` - Zustand 선택 이유 — 문서 상태는 [ADR-248](../../../../docs/adr/completed/248-unified-catalog-document.md) catalog runtime 으로 옮겨졌고, Zustand 는 UI · 데이터 store 에만 남음
- `docs/adr/completed/002-styling-approach.md` - ITCSS + tv() 선택 이유
- `docs/adr/completed/003-canvas-rendering.md` - PixiJS 선택 이유 — **ADR-900 (`completed/900-unified-skia-rendering-engine.md`) 으로 Superseded**. PixiJS 는 완전 제거됨, 현행 렌더러는 Skia 단일
- `docs/adr/completed/004-preview-isolation.md` - iframe 격리 이유
