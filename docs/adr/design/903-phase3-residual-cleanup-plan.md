# ADR-903 P3 잔여 cleanup plan — LayoutsTab 제거 후속

> 본 문서는 cleanup PR #219 (LayoutsTab orphan 제거) 머지 후 ADR-903 P3 단계에서 제거 가능한 deprecated 심볼/구조의 인벤토리. Explore agent (Team 3) 가 read-only 분석한 결과를 정리.

## 1. 핵심 통계

- **deprecatable 진입점**: 7개 (useLayoutsStore, currentLayoutId, fetchLayouts, createLayout, setCurrentLayout, useLayouts hook, layout_id DB column)
- **deprecatable type exports**: 22개 (`apps/builder/src/types/builder/layout.types.ts` 의 13 @deprecated + adapter/store 9)
- **영향 파일**: 51개
- **deprecatable LOC**: ~1,880 (P3-D: ~1,712 / P3-E: ~170)
- **즉시 제거 가능 (zero usage)**: 0건 — 모든 심볼이 아직 사용 중

## 2. 카테고리별 정리

### (a) 즉시 제거 가능 — 0 items

LayoutsTab cleanup 이후 잔여 deprecated 심볼은 모두 active caller 보유. 단순 unused export 0건.

### (b) P3-D Runtime 후 제거 가능 — 8 symbols, ~1,712 LOC

| 심볼                 | 사용처 수 | 영향 파일                            | 제거 시점 | 위험도 |
| -------------------- | :-------: | ------------------------------------ | --------- | :----: |
| `useLayoutsStore`    |    23     | layoutActions / hooks / panels       | P3-D 완료 |  MED   |
| `currentLayoutId`    |    45     | edit mode / layout actions / preview | P3-D 완료 |  MED   |
| `fetchLayouts`       |     8     | usePageManager / layoutsService      | P3-D 완료 |  LOW   |
| `createLayout`       |     5     | layoutActions / FramesTab            | P3-D 완료 |  MED   |
| `setCurrentLayout`   |    12     | edit mode store / hooks              | P3-D 완료 |  LOW   |
| Layout type group    | 7 imports | types/layout.types                   | P3-D 완료 |  LOW   |
| LayoutCreate/Update  | 4 imports | services/layouts.ts                  | P3-D 완료 |  LOW   |
| slot extension types | 6 imports | adapter/components                   | P3-D 완료 |  LOW   |

**전제**: `selectedReusableFrameId` (canonical) 가 `currentLayoutId` 의 모든 사용처를 cover. P3-D 진입 후 grep `currentLayoutId` = 0 도달 시 일괄 제거.

### (c) P3-E Persistence 후 제거 가능 — 4 symbols, ~170 LOC

| 심볼                                    | 사용처 수 | 영향 파일                               | 제거 시점             | 위험도 |
| --------------------------------------- | :-------: | --------------------------------------- | --------------------- | :----: |
| `layout_id` (DB column)                 |    309    | 51 파일 (services / supabase / adapter) | P3-E schema migration |  HIGH  |
| Store internals (legacy resolver types) |    ~30    | resolvers / store utils                 | P3-E 완료             |  MED   |
| `LayoutsService.fetchByProject` 등      |     8     | services/layouts.ts                     | P3-E 완료             |  MED   |
| Legacy migration script entry           |     4     | services/migrations                     | P3-E 완료             |  HIGH  |

**전제**: P3-E 가 IndexedDB + Supabase schema 양방향 마이그레이션 완료. `layout_id` column 이 deprecated 상태로 한 sprint 유지 후 drop.

### (d) BC permanent — 10 symbols, ~55 LOC

| 심볼                                         | 영향                 | 보존 사유                                                  |
| -------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| `LayoutTreeItem` / `PageTreeItem`            | UI tree types        | UI 마이그레이션 완료 후 재평가                             |
| `EditMode` / `EditContext` / `EditModeStore` | edit mode 분기       | UI 미러링 + canonical mode toggle 안정화 후                |
| `SlotInfo`                                   | slot metadata helper | canonical slot model 이 superset 이지만 외부 consumer 가능 |
| `NodesPanelTab` enum                         | UI 탭 식별자         | NodesPanelTabs 유지 (Pages/Layouts 표기)                   |

**보존 사유**: 외부 integration (preview 외부 publish, AI agent 도구) 가 import 가능 → 영구 `@deprecated` 마크 유지.

## 3. 누적 LOC 절감 추정

| 단계        |    LOC |   누적 |
| ----------- | -----: | -----: |
| (a) 즉시    |      0 |      0 |
| (b) P3-D    | ~1,712 | ~1,712 |
| (c) P3-E    |   ~170 | ~1,882 |
| (d) BC 보존 |      0 | ~1,882 |

**LayoutsTab cleanup 추가**: -619 LOC (이미 PR #219 land).

**누적 ADR-903 P3+ 절감**: ~2,501 LOC

## 4. cleanup PR 추가 후보

`chore/adr-903-cleanup-layoutstab` (#219) 에 추가 가능한 (a) 카테고리 항목:

- **없음** — 모든 잔여 deprecated 심볼이 active caller 보유. P3-D/E 완료 전 추가 cleanup 불가.

후속 cleanup PR 은 P3-D 완료 commit 직후 별도 발의 권고.

## 5. P3-D / P3-E 진입 시 작업 액션

### P3-D 진입 시 (8 symbols 일괄 처리)

1. `selectedReusableFrameId` 가 모든 `currentLayoutId` 사용처 cover 검증 (grep = 0)
2. `useLayoutsStore` 의 selector → canonical `useReusableFrames` (가칭) 로 점진 마이그레이션
3. `useLayouts` hook 은 P3-C 에서 이미 도입됨 — selector source 만 canonical 으로 swap
4. `layoutActions.ts` CRUD 함수는 canonical document mutation API 으로 교체
5. type exports 는 마지막 단계 (의존성 모두 제거 후) 일괄 삭제

### P3-E 진입 시 (4 symbols schema migration)

1. Supabase schema migration: `layout_id` column → `parent_canonical_id` (가칭) rename
2. IndexedDB migration: 동일
3. Legacy resolver types: canonical resolver 가 모든 케이스 cover 검증 후 삭제
4. legacy migration script: 1 sprint 유지 후 archive

## 6. 관련 문서

- ADR-903: `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md`
- P3 sub-breakdown: `docs/adr/design/903-phase3-frameset-breakdown.md`
- P3-D Runtime breakdown: `docs/adr/design/903-phase3d-runtime-breakdown.md` (Team 2 산출)
- P3-A 회귀 위험: `docs/adr/design/903-phase3a-regression-risk.md`
- LayoutsTab cleanup PR: #219 (`chore/adr-903-cleanup-layoutstab`)
- 옵션 C resolve 0 진단: `docs/adr/design/903-option-c-resolve-zero-diagnosis.md` (Team 1 산출)
- ADR-110 Phase 1 themes adapter: `feat/adr-110-phase1-themes-adapter` (Team 4 산출)
