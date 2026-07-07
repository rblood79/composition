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
| Preview DOM 렌더러    | `shared/src/renderers/` (예: `FormRenderers.tsx`)                    | RAC 기반 Preview/Publish DOM 렌더 (CSS consumer)         |
| 토큰 리졸버           | `specs/src/renderers/utils/tokenResolver.ts`                         | 토큰 → 실제 값 변환                                      |
| 색상 토큰             | `specs/src/primitives/colors.ts`                                     | 디자인 토큰 정의                                         |
| 그림자 토큰           | `specs/src/primitives/shadows.ts`                                    | 그림자 토큰 정의                                         |
| Skia Shape 변환기     | `(apps/builder) builder/workspace/canvas/skia/specShapeConverter.ts` | Shape[] → SkiaNodeData 변환                              |

자세한 설계는 `docs/COMPONENT_SPEC.md` 참조.

## 컴포넌트 패턴

| 패턴                 | 참조 파일                                       | 설명                                                             |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| React-Aria 컴포넌트  | `builder/components/dialog/AddPageDialog.tsx`   | Modal + Form 조합                                                |
| 복합 컴포넌트        | `builder/panels/properties/PropertiesPanel.tsx` | 다중 섹션 구성                                                   |
| Builder 아이콘 버튼  | `builder/components/ui/ActionIconButton.tsx`    | 공유 Button의 `.button-base` 우회, tooltip/shortcut 내장         |
| 사이드바 Nav tooltip | `builder/layout/PanelNav.tsx`                   | React Aria Button + TooltipTrigger, `.action-tooltip` CSS 재사용 |

## Property Editor 패턴

| 패턴                    | 참조 파일                            | 설명                                                                       |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| 부모+자식 동시 업데이트 | `builder/stores/inspectorActions.ts` | `updateSelectedPropertiesWithChildren()` — 부모+자식 단일 batch 히스토리   |
| Batch History 통합      | `builder/stores/inspectorActions.ts` | `batchUpdateElementProps()` — 단일 set() + batch 히스토리 + IndexedDB 저장 |

## Canvas/Skia 패턴

| 패턴               | 참조 파일                                                  | 설명                                         |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------- |
| Selection hit-test | `builder/workspace/canvas/selection/selectionHitTest.ts`   | render-space hit-test (ADR-135 ID 공간)      |
| Drop target 해석   | `builder/workspace/canvas/selection/dropTargetResolver.ts` | drag/drop 대상 해석                          |
| Viewport Control   | `builder/workspace/canvas/viewport/ViewportController.ts`  | 줌/팬 처리                                   |
| Spec → Skia 변환   | `builder/workspace/canvas/skia/specShapeConverter.ts`      | Shape[] → SkiaNodeData                       |
| Skia 노드 렌더링   | `builder/workspace/canvas/skia/nodeRenderers.ts`           | box/text/image/line/container 렌더           |
| Spec 태그 매핑     | `builder/workspace/canvas/sprites/tagSpecMap.ts`           | `getSpecForTag()` + `TAG_SPEC_MAP` (ADR-108) |

## Store 패턴

| 패턴                        | 참조 파일                                  | 설명                                                                                             |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Zustand 스토어              | `builder/stores/elements.ts`               | Elements 상태 + 인덱싱 (canonical 우선 derive)                                                   |
| 인덱스 관리                 | `builder/stores/utils/elementIndexer.ts`   | O(1) 페이지 인덱싱                                                                               |
| 요소 생성 (canonical-first) | `builder/stores/utils/elementCreation.ts`  | canonical merge → history → set → `_rebuildIndexes` → persist                                    |
| canonical mutation wrapper  | `adapters/canonical/canonicalMutations.ts` | `mergeElementsCanonicalPrimary` / `setElementsCanonicalPrimary` / `moveElementToCanonicalTarget` |
| 히스토리                    | `builder/stores/history.ts`                | HistoryManager 싱글톤 (`addEntry` / `addDiffEntry`)                                              |

## 서비스 패턴

> ADR-128 이후 Supabase 는 **auth 전용** — DB CRUD 서비스 래퍼(구 ProjectsApiService/BaseApiService)는 제거되었습니다. 문서/요소 영속은 IndexedDB canonical document 경로가 담당합니다.

| 패턴        | 참조 파일                      | 설명           |
| ----------- | ------------------------------ | -------------- |
| 에러 핸들러 | `services/api/ErrorHandler.ts` | 에러 처리 유틸 |

## Factory 패턴

| 패턴           | 참조 파일                                    | 설명               |
| -------------- | -------------------------------------------- | ------------------ |
| 컴포넌트 생성  | `builder/factories/ComponentFactory.ts`      | 복합 컴포넌트 생성 |
| 요소 생성 유틸 | `builder/factories/utils/elementCreation.ts` | 생성 파이프라인    |

## 메시징 패턴

| 패턴             | 참조 파일                               | 설명                                              |
| ---------------- | --------------------------------------- | ------------------------------------------------- |
| iframe Messenger | `utils/dom/iframeMessenger.ts`          | Origin 검증 + 버퍼링                              |
| Delta Messenger  | `builder/utils/canvasDeltaMessenger.ts` | Delta 동기화                                      |
| Message Handler  | `preview/messaging/messageHandler.ts`   | 메시지 타입 정의 (`UPDATE_CANONICAL_DOCUMENT` 등) |

## 사용법

```typescript
// 새 컴포넌트 생성 시
// 1. 참조 파일 확인 (apps/builder/src/ 기준)
// 2. 동일한 패턴 적용
// 3. 관련 규칙 준수

// 예: 새 Dialog 컴포넌트
// 참조: builder/components/dialog/AddPageDialog.tsx
// 규칙: react-aria-hooks-required, style-tv-variants
```

## ADR 참조

아키텍처 결정 배경은 다음 문서 참조:

- `docs/adr/completed/001-state-management.md` - Zustand 선택 이유
- `docs/adr/completed/002-styling-approach.md` - ITCSS + tv() 선택 이유
- `docs/adr/completed/003-canvas-rendering.md` - PixiJS 선택 이유 — **ADR-900 (`completed/900-unified-skia-rendering-engine.md`) 으로 Superseded**. PixiJS 는 완전 제거됨, 현행 렌더러는 Skia 단일
- `docs/adr/completed/004-preview-isolation.md` - iframe 격리 이유
