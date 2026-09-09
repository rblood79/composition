# Legacy Documents (레거시 문서)

> 이 폴더의 문서는 과거 아키텍처 기준으로 작성되었으며, 역사적 참조 목적으로 보관합니다.
> 각 파일 상단에 폐기 사유 배너가 있습니다. 현행 사실은 아래 "대체 정본" 열을 따르세요.
>
> **최종 정리**: 2026-09-09 (관리 정지 디렉토리 `audit/` · `bug/` · `how-to/migration/` 통합, `reference/status/` 축소)

## 완료된 마이그레이션/리팩토링

| 파일                         | 레거시 사유                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| REACT_ARIA_MIGRATION_1_14.md | React Aria 1.14.0 업그레이드 + data-\* 전환 완료                                         |
| DATASET_RENAME.md            | Dataset → DataTable 리네이밍 완료                                                        |
| ESM_IMPORTS.md               | ESM 마이그레이션 완료                                                                    |
| TYPESCRIPT_ERRORS_FIX.md     | TypeScript 에러 수정 완료                                                                |
| BUILD_ERRORS.md              | 빌드 에러 해결 완료                                                                      |
| DOCS_REORGANIZATION_PLAN.md  | 문서 재구성 완료                                                                         |
| COMPONENT_CONSOLIDATION.md   | 2026-02 builder 모듈 통합 계획. ADR-912 catalog cutover + 모노레포 분리로 대상 구조 소멸 |
| REACT_QUERY_STYLE.md         | 전제한 서비스 계층 (`BaseApiService` 등 5종) 전부 제거됨. React Query 자체는 현재도 사용 |

## PGLite 관련

| 파일                     | 레거시 사유            |
| ------------------------ | ---------------------- |
| PGLITE_IMPLEMENTATION.md | Supabase 전환으로 보류 |
| PGLITE_QUICK_START.md    | Supabase 전환으로 보류 |
| PGLITE_VALIDATION.md     | Supabase 전환으로 보류 |

## 아키텍처/설계 (구조 변경)

| 파일                               | 레거시 사유                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| DATA_SYNC.md                       | Local-first 전환으로 무효                                                      |
| FILE_SYNC.md                       | 동기화 아키텍처 변경                                                           |
| PERF_PROBLEM.md                    | 초기 성능 분석 (해결 완료)                                                     |
| PENCIL_VS_XSTUDIO_UI_UX.md         | 초기 설계 참고용                                                               |
| RENDERING_ARCHITECTURE.md          | PixiJS 전환기 렌더링 구조                                                      |
| MONITOR_PANEL.md                   | Monitor 패널 제거 (2026-09-09). Optimize 가 회수할 메모리가 없다는 실측        |
| COMPONENT_SPEC-2026-03-snapshot.md | 2026-03 시점 컴포넌트 스펙 스냅샷. 현행 정본은 catalog `COMPONENT_RULES_TABLE` |

## 성능 계획 (PixiJS 시대 · 모노레포 전환 이전)

> 공통 사유: 대상이던 PixiJS 캔버스가 ADR-900 통합 Skia 로 대체됐고, 인용 경로가 모두 최상위 `src/…` 다.
> 대체 정본: [BUILDER_PERF_BASELINE_2026-09](../explanation/research/BUILDER_PERF_BASELINE_2026-09.md) · `pnpm perf:baseline`

| 파일                          | 레거시 사유                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| P7_IMPLEMENTATION.md          | 2025-12-13 StylePanel↔Canvas 동기화 계획                            |
| LONG_TASK_OPTIMIZATION.md     | 2025-12-23 WebGL Long Task 계획                                     |
| PERFORMANCE_IMPLEMENTATION.md | 2025-12-11 구현 체크리스트. 참조하는 `05-supplement.md` 등이 부재   |
| PANEL_OPTIMIZATION.md         | 2025-12-09 패널 최적화 계획. Transformer 전수 제거로 예시 다수 무효 |
| PERFORMANCE_BENCHMARK.md      | 성능 기준 변경                                                      |
| PERFORMANCE_REPORT.md         | 성능 기준 변경                                                      |

## 상태 목록 (CLAUDE.md 분리본 · 관리 정지)

| 파일                        | 레거시 사유                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| STATUS_COMPLETED-2025-11.md | 2025-11 완료 기능 목록. 대체 정본 [CHANGELOG](../CHANGELOG.md) · [ADR 대시보드](../adr/README.md) |
| STATUS_PLANNED-2025-12.md   | 2025-12-11 계획 목록. 대체 정본 ADR (`docs/adr/`)                                                 |
| STATUS_UNIMPLEMENTED-2026-05.md | 2026-05-13 이후 미갱신. 잔여 3항목이 어떤 ADR 에도 연결돼 있지 않음 |
| DB_COMPATIBILITY-2025-11.md | 2025-11-07 Electron/PGlite 검토 기록. 현행은 IndexedDB canonical + Supabase 인증 전용 (ADR-128) |

## 종결된 버그·감사 기록

| 파일                                 | 레거시 사유                                                           |
| ------------------------------------ | --------------------------------------------------------------------- |
| COMPONENT_AUDIT-2026-03.md           | ADR-030 착수 전 1회성 전수 조사 (2026-03-07)                          |
| BUG_TAG_VERTICAL_STACKING-2026-03.md | 2026-03-06 해결 완료. 병인 정본은 `.claude/rules/`                    |
| BUG_SKIA_BUTTON_LINEBREAK-2026-03.md | 2026-03-05 해결 완료. 병인 정본은 `.claude/rules/canvas-rendering.md` |

## 기타

| 파일                   | 레거시 사유             |
| ---------------------- | ----------------------- |
| REDESIGN_PLAN.md       | 리디자인 완료           |
| INSPECTOR_TESTING.md   | Inspector 구조 변경     |
| PREVIEW_STATE_RESET.md | Preview 구조 변경       |
| EVENT_TESTING.md       | 이벤트 테스트 구조 변경 |
| ELECTRON_SETUP.md      | Electron 미사용         |

## Workflow / UI

| 파일               | 레거시 사유                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WORKFLOW.md        | `apps/builder/src/workflow/` 삭제 완료. Phase 1~4 CanvasKit 기반 워크플로우 오버레이로 완전 전환. ReactFlow(@xyflow/react) + dagre 의존성 제거 완료                                    |
| REACT_ARIA_1.13.md | 현재 react-aria-components 는 pnpm catalog 기준 `^1.21.0`. 1.13.0 업데이트 계획 문서라 여덟 마이너 뒤처짐                                                                              |
| STYLE_SYSTEM.md    | Phase 2~4 미구현 설계안. `styleStore.ts`, `tokenResolver.ts`, `atomicCssGenerator.ts`, `cssVariableGenerator.ts` 미존재. 현재 Zustand 섹션 훅 + themeStore와 catalog D3 SSOT로 운영 중 |
| SKELETON_SYSTEM.md | 핵심인 `withSkeleton` HOC · `useSkeleton` 훅 미구현. `packages/shared/src/components/Skeleton.tsx` 와 catalog binding 만 존재                                                          |
