> **⚠️ 레거시 문서**: 현재 아키텍처와 일치하지 않을 수 있습니다. 역사적 참조 목적.

# composition 문서 재구성 계획

## Diátaxis 프레임워크 기반 문서 재구성

> 작성일: 2025-12-27
> 목적: docs 디렉토리를 Diátaxis 프레임워크에 맞게 재구성하여 문서 접근성과 유지보수성 향상

---

## 개요

Diátaxis는 기술 문서를 4가지 카테고리로 구분하는 프레임워크입니다:

| 카테고리         | 목적      | 특징                                  |
| ---------------- | --------- | ------------------------------------- |
| **tutorials/**   | 학습 중심 | 처음부터 끝까지 따라하는 실습 가이드  |
| **how-to/**      | 문제 해결 | 특정 목표 달성을 위한 단계별 가이드   |
| **reference/**   | 정보 참조 | API, 스키마, 설정 등 기술적 상세 정보 |
| **explanation/** | 개념 이해 | 아키텍처, 설계 결정, 배경 지식        |

---

## Phase 1: 디렉토리 구조 생성

### 새로운 구조

```
docs/
├── tutorials/              # 학습용 실습 가이드
│   ├── getting-started/    # 시작하기
│   └── features/           # 기능별 튜토리얼
├── how-to/                 # 문제 해결 가이드
│   ├── migration/          # 마이그레이션 가이드
│   ├── troubleshooting/    # 문제 해결
│   └── development/        # 개발 워크플로우
├── reference/              # 참조 문서
│   ├── api/                # API 문서
│   ├── schemas/            # 스키마 정의
│   ├── components/         # 컴포넌트 레퍼런스
│   └── status/             # 상태 및 체크리스트
├── explanation/            # 개념 설명
│   ├── architecture/       # 아키텍처 설계
│   ├── research/           # 리서치 및 비교 분석
│   └── decisions/          # 설계 결정 기록
├── archive/                # 완료된 과거 문서 (유지)
├── CHANGELOG.md            # 변경 이력 (루트 유지)
└── README.md               # 문서 인덱스
```

---

## Phase 2: 문서 분류 및 이동

### 2.1 tutorials/ (3개 문서)

| 원본 경로                        | 이동 경로                                     |
| -------------------------------- | --------------------------------------------- |
| `ELECTRON_SETUP_GUIDE.md`        | `tutorials/getting-started/ELECTRON_SETUP.md` |
| `guides/TREE_COMPONENT_GUIDE.md` | `tutorials/features/TREE_COMPONENT.md`        |
| `event-test-guide.md`            | `tutorials/features/EVENT_TESTING.md`         |

### 2.2 how-to/ (26개 문서)

#### migration/

| 원본 경로                                    | 이동 경로                               |
| -------------------------------------------- | --------------------------------------- |
| `MIGRATION_GUIDE.md`                         | `how-to/migration/REACT_QUERY_STYLE.md` |
| `M3_MIGRATION_CHECKLIST.md`                  | `how-to/migration/M3_CHECKLIST.md`      |
| `REACT_ARIA_1.14_MIGRATION.md`               | `how-to/migration/REACT_ARIA.md`        |
| `WEBGL_MIGRATION_IMPLEMENTATION_PLAN.md`     | `how-to/migration/WEBGL.md`             |
| `REQUIRE_TO_IMPORT_FIX.md`                   | `how-to/migration/ESM_IMPORTS.md`       |
| `refactoring/DATASET_TO_DATATABLE_RENAME.md` | `how-to/migration/DATASET_RENAME.md`    |

#### troubleshooting/

| 원본 경로                      | 이동 경로                                     |
| ------------------------------ | --------------------------------------------- |
| `TYPESCRIPT_ERROR_FIXES.md`    | `how-to/troubleshooting/TYPESCRIPT_ERRORS.md` |
| `typescript-build-fix-plan.md` | `how-to/troubleshooting/BUILD_ERRORS.md`      |
| `RATE_LIMIT_FIX.md`            | `how-to/troubleshooting/RATE_LIMIT.md`        |

#### development/

| 원본 경로                                               | 이동 경로                                          |
| ------------------------------------------------------- | -------------------------------------------------- |
| `guides/CONTRIBUTING.md`                                | `how-to/development/CONTRIBUTING.md`               |
| `guides/README_prompts.md`                              | `how-to/development/README_WRITING.md`             |
| `implementation/ELECTRON_PGLITE_QUICK_START.md`         | `how-to/development/PGLITE_QUICK_START.md`         |
| `implementation/ELECTRON_PGLITE_IMPLEMENTATION_PLAN.md` | `how-to/development/PGLITE_IMPLEMENTATION.md`      |
| `features/INSPECTOR_INTEGRATION_TEST.md`                | `how-to/development/INSPECTOR_TESTING.md`          |
| `PGLITE_VALIDATION_GUIDE.md`                            | `how-to/development/PGLITE_VALIDATION.md`          |
| `CANVAS_BORDER_BOX_PLAN.md`                             | `how-to/development/CANVAS_BORDER_BOX.md`          |
| `SKELETON_SYSTEM_PLAN.md`                               | `how-to/development/SKELETON_SYSTEM.md`            |
| `PIXI_REFACTORING_PLAN.md`                              | `how-to/development/PIXI_REFACTORING.md`           |
| `P7_IMPLEMENTATION_PLAN.md`                             | `how-to/development/P7_IMPLEMENTATION.md`          |
| `PANEL_OPTIMIZATION_PLAN.md`                            | `how-to/development/PANEL_OPTIMIZATION.md`         |
| `performance/06-implementation.md`                      | `how-to/development/PERFORMANCE_IMPLEMENTATION.md` |
| `performance/12-long-task-optimization-plan.md`         | `how-to/development/LONG_TASK_OPTIMIZATION.md`     |
| `research/BENCHMARK_BASELINE_TEMPLATE.md`               | `how-to/development/BENCHMARK_TEMPLATE.md`         |
| `architecture/SRC_STRUCTURE_IMPROVEMENT_PLAN.md`        | `how-to/development/SRC_STRUCTURE.md`              |
| `architecture/BUILDER_COMPONENTS_CONSOLIDATION_PLAN.md` | `how-to/development/COMPONENT_CONSOLIDATION.md`    |

### 2.3 reference/ (51개 문서)

#### api/

| 원본 경로          | 이동 경로                    |
| ------------------ | ---------------------------- |
| `API_ENDPOINTS.md` | `reference/api/ENDPOINTS.md` |

#### schemas/

| 원본 경로                    | 이동 경로                                     |
| ---------------------------- | --------------------------------------------- |
| `DATABASE_INDEXDB_SCHEMA.md` | `reference/schemas/INDEXDB.md`                |
| `cloud-schema.md`            | `reference/schemas/CLOUD.md`                  |
| `M3_PALETTE_MAPPING.md`      | `reference/schemas/M3_PALETTE.md`             |
| `M3_COMPONENT_TEMPLATE.css`  | `reference/schemas/M3_COMPONENT_TEMPLATE.css` |
| `M3_STORYBOOK_TEMPLATE.tsx`  | `reference/schemas/M3_STORYBOOK_TEMPLATE.tsx` |

#### components/

| 원본 경로                                               | 이동 경로                                         |
| ------------------------------------------------------- | ------------------------------------------------- |
| `PANEL_SYSTEM.md`                                       | `reference/components/PANEL_SYSTEM.md`            |
| `CSS_ARCHITECTURE.md`                                   | `reference/components/CSS_ARCHITECTURE.md`        |
| `REACT_ARIA_INTEGRATION.md`                             | `reference/components/REACT_ARIA.md`              |
| `PIXI_WEBGL_INTEGRATION.md`                             | `reference/components/PIXI_WEBGL.md`              |
| `TRANSFORMER_SECURITY.md`                               | `reference/components/TRANSFORMER_SECURITY.md`    |
| `guides/PROPERTY_CUSTOM_ID_PATTERN.md`                  | `reference/components/CUSTOM_ID_PATTERN.md`       |
| `features/DATA_PANEL_SYSTEM.md`                         | `reference/components/DATA_PANEL.md`              |
| `features/INSPECTOR_STYLE_SYSTEM.md`                    | `reference/components/INSPECTOR_STYLE.md`         |
| `features/INSPECTOR_REFACTORING.md`                     | `reference/components/INSPECTOR_REFACTORING.md`   |
| `features/COLLECTION_COMPONENTS_DATA_BINDING.md`        | `reference/components/COLLECTION_DATA_BINDING.md` |
| `features/LAYOUT_PRESET_SYSTEM.md`                      | `reference/components/LAYOUT_PRESETS.md`          |
| `features/SAVE_MODE_BEHAVIOR.md`                        | `reference/components/SAVE_MODE.md`               |
| `features/REALTIME_SAVE_MODE_IMPLEMENTATION.md`         | `reference/components/REALTIME_SAVE.md`           |
| `features/SAVESERVICE_REFACTORING.md`                   | `reference/components/SAVESERVICE.md`             |
| `features/CANVAS_INTERACTIONS.md`                       | `reference/components/CANVAS_INTERACTIONS.md`     |
| `features/CANVAS_RUNTIME_ISOLATION.md`                  | `reference/components/CANVAS_ISOLATION.md`        |
| `features/DATATABLE_PRESET_SYSTEM.md`                   | `reference/components/DATATABLE_PRESETS.md`       |
| `features/NESTED_ROUTES_SLUG_SYSTEM.md`                 | `reference/components/NESTED_ROUTES.md`           |
| `features/PREVIEW_CHECKBOX_BEHAVIOR.md`                 | `reference/components/PREVIEW_CHECKBOX.md`        |
| `features/PREVIEW_STATE_RESET_BUG_SUMMARY.md`           | `reference/components/PREVIEW_STATE_RESET.md`     |
| `features/REALTIME_SAVE_BUG_FIX.md`                     | `reference/components/REALTIME_SAVE_FIX.md`       |
| `features/TOGGLEBUTTONGROUP_INDICATOR.md`               | `reference/components/TOGGLEBUTTONGROUP.md`       |
| `features/WORKFLOW_VIEW_SYNC.md`                        | `reference/components/WORKFLOW_SYNC.md`           |
| `features/border-radius-handles-webgl.md`               | `reference/components/BORDER_RADIUS_HANDLES.md`   |
| `implementation/DRAG_DROP_LAYER_TREE_IMPLEMENTATION.md` | `reference/components/DRAG_DROP_LAYER.md`         |
| `implementation/page-navigation.md`                     | `reference/components/PAGE_NAVIGATION.md`         |
| `EVENTS_PANEL_REDESIGN.md`                              | `reference/components/EVENTS_PANEL.md`            |
| `PROPERTIES_PANEL_OPTIMIZATION.md`                      | `reference/components/PROPERTIES_PANEL.md`        |
| `MONITOR_PANEL_REDESIGN.md`                             | `reference/components/MONITOR_PANEL.md`           |
| `MULTI_SELECT_IMPROVEMENTS.md`                          | `reference/components/MULTI_SELECT.md`            |
| `LAYOUT_SLOT_SYSTEM_PLAN_V2.md`                         | `reference/components/LAYOUT_SLOTS.md`            |
| `PROJECT_FILE_WEB_INTEGRATION.md`                       | `reference/components/PROJECT_FILE_WEB.md`        |

#### status/

| 원본 경로                                           | 이동 경로                                   |
| --------------------------------------------------- | ------------------------------------------- |
| `COMPLETED_FEATURES.md`                             | `reference/status/COMPLETED.md`             |
| `PLANNED_FEATURES.md`                               | `reference/status/PLANNED.md`               |
| `UNIMPLEMENTED_FEATURES.md`                         | `reference/status/UNIMPLEMENTED.md`         |
| `WEBGL_COMPONENT_MIGRATION_STATUS.md`               | `reference/status/WEBGL_MIGRATION.md`       |
| `M3_PHASE_0_COMPLETE.md`                            | `reference/status/M3_PHASE_0.md`            |
| `M3_MIGRATION_INDEX.md`                             | `reference/status/M3_INDEX.md`              |
| `M3_BROWSER_COMPATIBILITY.md`                       | `reference/status/M3_BROWSER.md`            |
| `TYPESCRIPT_ERRORS.md`                              | `reference/status/TYPESCRIPT_ERRORS.md`     |
| `REACT_ARIA_1.13_UPDATE.md`                         | `reference/status/REACT_ARIA_1.13.md`       |
| `PERFORMANCE_BENCHMARK.md`                          | `reference/status/PERFORMANCE_BENCHMARK.md` |
| `PERFORMANCE_REPORT.md`                             | `reference/status/PERFORMANCE_REPORT.md`    |
| `performance/README.md`                             | `reference/status/PERFORMANCE_INDEX.md`     |
| `performance/task.md`                               | `reference/status/PERFORMANCE_TASKS.md`     |
| `performance/03-phase-1-4.md`                       | `reference/status/PERF_PHASE_1_4.md`        |
| `performance/04-phase-5-8.md`                       | `reference/status/PERF_PHASE_5_8.md`        |
| `performance/05-supplement.md`                      | `reference/status/PERF_SUPPLEMENT.md`       |
| `performance/07-decisions.md`                       | `reference/status/PERF_DECISIONS.md`        |
| `performance/08-additional-ideas.md`                | `reference/status/PERF_IDEAS.md`            |
| `performance/11-canvas-resize-optimization.md`      | `reference/status/CANVAS_RESIZE.md`         |
| `performance/13-webgl-canvas-optimization-final.md` | `reference/status/WEBGL_CANVAS_FINAL.md`    |
| `PERFORMANCE_OPTIMIZATION_PLAN.md`                  | `reference/status/PERFORMANCE_PLAN.md`      |
| `composition_FEATURES_DB_COMPATIBILITY.md`          | `reference/status/DB_COMPATIBILITY.md`      |
| `architecture/STYLE_SYSTEM_COMPLETE.md`             | `reference/status/STYLE_SYSTEM.md`          |

### 2.4 explanation/ (14개 문서)

#### architecture/

| 원본 경로                                        | 이동 경로                                        |
| ------------------------------------------------ | ------------------------------------------------ |
| `architecture/PAGE_TYPE_SEPARATION.md`           | `explanation/architecture/PAGE_TYPES.md`         |
| `WEB_BUILDER_DATA_ARCHITECTURE_ANALYSIS.md`      | `explanation/architecture/DATA_ARCHITECTURE.md`  |
| `PROJECT_FILE_SYNC_ARCHITECTURE.md`              | `explanation/architecture/FILE_SYNC.md`          |
| `features/DATA_SYNC_ARCHITECTURE.md`             | `explanation/architecture/DATA_SYNC.md`          |
| `features/HISTORY_PANEL.md`                      | `explanation/architecture/HISTORY_PANEL.md`      |
| `implementation/NODES_PANEL_TREE_BASE_DESIGN.md` | `explanation/architecture/NODES_PANEL_DESIGN.md` |
| `implementation/DRAG_DROP_LAYER_TREE_PLAN.md`    | `explanation/architecture/DRAG_DROP_DESIGN.md`   |
| `performance/01-problem-analysis.md`             | `explanation/architecture/PERF_PROBLEM.md`       |
| `performance/02-architecture.md`                 | `explanation/architecture/PERF_ARCHITECTURE.md`  |
| `performance/10-webgl-builder-architecture.md`   | `explanation/architecture/WEBGL_BUILDER.md`      |

#### research/

| 원본 경로                                                | 이동 경로                                           |
| -------------------------------------------------------- | --------------------------------------------------- |
| `research/BUILDER_ARCHITECTURE_ANALYSIS.md`              | `explanation/research/BUILDER_COMPARISON.md`        |
| `research/REACT_SPECTRUM_S2_VS_REACT_ARIA_COMPARISON.md` | `explanation/research/REACT_SPECTRUM_COMPARISON.md` |
| `research/STYLE_PANEL_PARSING_OPTIMIZATION.md`           | `explanation/research/STYLE_PARSING.md`             |
| `research/VISUAL_BUILDER_DATA_COMPARISON.md`             | `explanation/research/VISUAL_BUILDER_DATA.md`       |
| `research/composition_REDESIGN_PLAN.md`                  | `explanation/research/REDESIGN_PLAN.md`             |
| `research/claudecodeui-inspiration.md`                   | `explanation/research/CLAUDECODE_UI.md`             |
| `PGLITE_VS_SQLITE_COMPARISON.md`                         | `explanation/research/PGLITE_VS_SQLITE.md`          |
| `benchmarks/PHOTOSHOP_WEB_UI_UX_BENCHMARK.md`            | `explanation/research/PHOTOSHOP_BENCHMARK.md`       |

---

## Phase 3: 폐기 대상 (archive로 이동)

| 원본 경로                     | 사유                               |
| ----------------------------- | ---------------------------------- |
| `ELECTRON_PUBLISH_FEATURE.md` | `ELECTRON_SETUP_GUIDE.md`로 대체됨 |

---

## Phase 4: 기존 폴더 정리

### 삭제할 빈 폴더

- `docs/features/` (모든 파일 이동 후)
- `docs/guides/` (모든 파일 이동 후)
- `docs/implementation/` (모든 파일 이동 후)
- `docs/research/` (모든 파일 이동 후)
- `docs/performance/` (모든 파일 이동 후)
- `docs/benchmarks/` (모든 파일 이동 후)
- `docs/refactoring/` (모든 파일 이동 후)

### 유지할 폴더

- `docs/archive/` - 완료된 과거 문서 (현재 7개 문서 유지)

---

## Phase 5: README.md 업데이트

새로운 구조를 반영한 문서 인덱스 작성

---

## 실행 체크리스트

- [ ] Phase 1: 새 디렉토리 구조 생성
- [ ] Phase 2.1: tutorials/ 문서 이동 (3개)
- [ ] Phase 2.2: how-to/ 문서 이동 (26개)
- [ ] Phase 2.3: reference/ 문서 이동 (51개)
- [ ] Phase 2.4: explanation/ 문서 이동 (14개)
- [ ] Phase 3: 폐기 대상 archive로 이동 (1개)
- [ ] Phase 4: 빈 폴더 삭제
- [ ] Phase 5: README.md 업데이트
- [ ] 변경사항 커밋 및 푸시

---

## 문서 통계

| 카테고리    | 문서 수             |
| ----------- | ------------------- |
| tutorials   | 3                   |
| how-to      | 26                  |
| reference   | 51                  |
| explanation | 14                  |
| archive     | 8 (기존 7 + 폐기 1) |
| **총계**    | **102**             |
