# Legacy Documents (레거시 문서)

> 이 폴더의 문서는 과거 아키텍처 기준으로 작성되었으며, 역사적 참조 목적으로 보관합니다.

## 완료된 마이그레이션/리팩토링

| 파일                         | 레거시 사유                                      |
| ---------------------------- | ------------------------------------------------ |
| REACT_ARIA_MIGRATION_1_14.md | React Aria 1.14.0 업그레이드 + data-\* 전환 완료 |
| DATASET_RENAME.md            | Dataset → DataTable 리네이밍 완료                |
| ESM_IMPORTS.md               | ESM 마이그레이션 완료                            |
| TYPESCRIPT_ERRORS_FIX.md     | TypeScript 에러 수정 완료                        |
| BUILD_ERRORS.md              | 빌드 에러 해결 완료                              |
| DOCS_REORGANIZATION_PLAN.md  | 문서 재구성 완료                                 |

## PGLite 관련

| 파일                     | 레거시 사유            |
| ------------------------ | ---------------------- |
| PGLITE_IMPLEMENTATION.md | Supabase 전환으로 보류 |
| PGLITE_QUICK_START.md    | Supabase 전환으로 보류 |
| PGLITE_VALIDATION.md     | Supabase 전환으로 보류 |

## 아키텍처/설계 (구조 변경)

| 파일                       | 레거시 사유                |
| -------------------------- | -------------------------- |
| DATA_SYNC.md               | Local-first 전환으로 무효  |
| FILE_SYNC.md               | 동기화 아키텍처 변경       |
| PERF_PROBLEM.md            | 초기 성능 분석 (해결 완료) |
| PENCIL_VS_XSTUDIO_UI_UX.md | 초기 설계 참고용           |
| RENDERING_ARCHITECTURE.md  | PixiJS 전환기 렌더링 구조  |

## 기타

| 파일                     | 레거시 사유             |
| ------------------------ | ----------------------- |
| REDESIGN_PLAN.md         | 리디자인 완료           |
| INSPECTOR_TESTING.md     | Inspector 구조 변경     |
| PERFORMANCE_BENCHMARK.md | 성능 기준 변경          |
| PERFORMANCE_REPORT.md    | 성능 기준 변경          |
| PREVIEW_STATE_RESET.md   | Preview 구조 변경       |
| EVENT_TESTING.md         | 이벤트 테스트 구조 변경 |
| ELECTRON_SETUP.md        | Electron 미사용         |

## Workflow / UI

| 파일               | 레거시 사유                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WORKFLOW.md        | `apps/builder/src/workflow/` 삭제 완료. Phase 1~4 CanvasKit 기반 워크플로우 오버레이로 완전 전환. ReactFlow(@xyflow/react) + dagre 의존성 제거 완료                                    |
| REACT_ARIA_1.13.md | react-aria-components 현재 버전 1.15.1. 1.13.0 기준 업데이트 계획 문서로 두 버전 이상 초과된 구식 문서                                                                                 |
| STYLE_SYSTEM.md    | Phase 2~4 미구현 설계안. `styleStore.ts`, `tokenResolver.ts`, `atomicCssGenerator.ts`, `cssVariableGenerator.ts` 미존재. 현재 Zustand 섹션 훅 + themeStore와 catalog D3 SSOT로 운영 중 |
