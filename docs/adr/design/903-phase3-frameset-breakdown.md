# ADR-903 Phase 3 — frameset 흡수 sub-breakdown

> 본 문서는 [ADR-903](../completed/903-ref-descendants-slot-composition-format-migration-plan.md) Phase 3 (G3 Gate) 의 **sub-phase 분할** 과 정량 측정 기반 마이그레이션 plan 이다. ADR 본문 §Decision §G3 + 기존 [breakdown §P3](903-ref-descendants-slot-composition-format-migration-plan-breakdown.md#p3-framesetlayouttemplate-흡수) 의 high-level overview 를 sub-phase 단위 실행 계획으로 분해.
>
> **상위 ADR**: ADR-903 (Status: Implemented — 2026-04-26, completed/ 이관)
> **Phase 진입 시점**: P0/P1/P2 D-A~D-C 완결 후 (HEAD `1803830c` 기준 canonical 144/144 + type-check 3/3 PASS, Gate G2 = 12 / G3 = 403)

## 1. 측정 baseline (2026-04-25)

### 1.1 Keyword 별 분포 (`apps/builder/src/` 재귀)

| Keyword           | ref     | 비중   | 의미                                       |
| ----------------- | ------- | ------ | ------------------------------------------ |
| `layout_id`       | **282** | 70.0%  | element ownership marker (`page_id` 와 짝) |
| `currentLayoutId` | 75      | 18.6%  | 현재 선택된 layout id (store selector)     |
| `useLayoutsStore` | 42      | 10.4%  | layouts[] store 직접 참조                  |
| `fetchLayouts`    | 13      | 3.2%   | layout 목록 fetch                          |
| `createLayout`    | 10      | 2.5%   | layout 생성 action                         |
| **total**         | **403** | 100.0% | (baseline 2026-04-22 = 355, drift +48)     |

측정 명령 (G3 정본):

```bash
grep -rnE "createLayout|useLayoutsStore|currentLayoutId|fetchLayouts|layout_id" \
  apps/builder/src/ --include='*.ts' --include='*.tsx' | wc -l
```

### 1.2 디렉터리 카테고리 분포 (Top→Down)

| 카테고리                       | ref     | files  | 분류                             |
| ------------------------------ | ------- | ------ | -------------------------------- |
| `factories/definitions/**`     | **124** | **10** | element factory layout_id 주입   |
| `builder/stores/**`            | 56      | 6      | layouts store + element creation |
| `preview/**`                   | 35      | 6      | preview iframe 경로              |
| `panels/nodes/LayoutsTab/**`   | 33      | 1      | NodesPanel Layout 탭 UI          |
| `panels/properties/editors/**` | 33      | 7      | PageLayoutSelector 외 editor 6종 |
| `builder/hooks/**`             | 28      | 5      | iframe messenger / page manager  |
| `adapters/**`                  | 23      | 3      | canonical legacy-layout adapter  |
| `types/**`                     | 16      | 2      | layout.types.ts + element types  |
| `builder/main/**`              | 11      | 1      | BuilderCore.tsx entry            |
| `builder/panels/**` (other)    | 9       | 3      | ComponentsPanel 외               |
| `builder/workspace/**`         | 9       | 4      | canvas integration               |
| `builder (other)`              | 11      | 6      | utils / lib                      |
| `lib/db/**`                    | 6       | 1      | indexedDB adapter                |
| `resolvers/**`                 | 5       | 1      | canonical resolver test          |
| `other`                        | 4       | 3      | misc                             |
| **total**                      | **403** | **59** |                                  |

### 1.3 핵심 패턴 샘플

**Factory pattern** (`DisplayComponents.ts:19-20`):

```ts
const ownership = layoutId
  ? { page_id: null, layout_id: layoutId }
  : { page_id: pageId, layout_id: null };
```

→ 모든 element factory 가 page 와 layout 의 mutual-exclusive ownership 를 직접 표현. **canonical 후**: ownership marker 자체 소멸 — element 의 위치는 canonical document tree 의 부모 reusable frame node 가 결정.

**Store selector pattern** (`layoutActions.ts:54-69`):

```ts
const { currentLayoutId } = get();
const isCurrentLayoutValid =
  currentLayoutId && sortedData.some((l) => l.id === currentLayoutId);
const newCurrentLayoutId = shouldAutoSelect
  ? defaultLayout?.id
  : isCurrentLayoutValid
    ? currentLayoutId
    : null;
set({ currentLayoutId: newCurrentLayoutId });
```

→ layouts[] array + currentLayoutId 선택 추적이 page selection 과 별도 state 로 운영. **canonical 후**: 단일 document tree 내부 reusable frame 노드 selection 으로 통합.

**Panel UI pattern** (`LayoutsTab.tsx`, 33 ref): layout CRUD UI 가 page CRUD 와 별도 탭 — **canonical 후**: NodesPanel `FramesTab` 또는 통합 tree view 에서 reusable frame 노드 직접 편집.

## 2. Sub-phase 분할

ADR-903 P3 의 G3 통과 조건 (a)~(e) 를 의존 순서 기반 6 sub-phase 로 분할:

```
P3-A (Types + Adapter foundation)
   ↓
P3-B (Stores 해체)  ←  병렬 가능: P3-C (NodesPanel UI)
   ↓                                     ↓
P3-D (Factory + Hooks + Preview runtime path)
   ↓
P3-E (Persistence) → P3-F (Test cleanup) → G3 통과
```

### 2.1 P3-A: Types + Adapter foundation (~39 ref / 5 files)

**대상**: `types/builder/layout.types.ts` (13 ref), `types/builder/*.ts` (3 ref), `adapters/canonical/slotAndLayoutAdapter.ts` (9 ref), `adapters/canonical/index.ts` (6 ref), `adapters/canonical/__tests__/integration.test.ts` (8 ref)

**작업**:

1. `LegacyLayoutId` / `LegacyLayoutOwnership` 타입을 `@deprecated` 마크 + `legacy-layout` adapter 모듈로 격리.
2. `slotAndLayoutAdapter` 의 bidirectional 변환 보강:
   - `legacyLayoutToCanonicalFrame(layout: LegacyLayout): CanonicalFrameNode`
   - `canonicalFrameToLegacyLayout(node: CanonicalFrameNode): LegacyLayout` (read-through 기간)
3. `adapters/canonical/index.ts` 의 export surface 에 P3 후속 phase 의 호출자가 의존할 entry 추가:
   - `useCanonicalReusableFrames()` hook (read-through, store 의 `layouts[]` → canonical view)
   - `selectCurrentReusableFrameId(state)` selector

**Surface mapping 결과** ([Team 2 분석](#3-에이전트-팀-병렬-분석-산출물-2026-04-25)): 5 파일 합계 **36 exports** (단순 39 ref 보다 큰 surface). 분류: deprecate 16 / migrate 4 / keep 16. 외부 호출자 18 파일 (P3-B/C/D 변환 대상). 신규 surface 5건 권고:

1. `selectCanonicalReusableFrames(doc): FrameNode[]`
2. `createReusableFrameNode(name, children, slot?): FrameNode`
3. `CanonicalPageRef = RefNode & { descendants }` 타입
4. `extractSlotMetaFromNode(frame): SlotMeta[]`
5. `hoistLayoutAsReusableFrame(legacyLayout, elements): FrameNode`

의외 발견: `convertPageLayout` 가 `builder/stores/elements.ts` 에서 index.ts 경유 아닌 직접 import → P3-B 분리 단계 명확화 필요.

**Sub-Gate G3-A**: 타입 emit 0 error + adapter integration test 8/8 PASS + **`legacyOwnershipToCanonicalParent()` 구현 완성** (Team 3 권고 #6 — P3-D 진입 시 데이터 손실 방지의 hard precondition). ref 감소 0 (foundation 단계 — surface 정의만).

**P3-B 진입 전 필수 안전망 7건** ([Team 3 분석](#3-에이전트-팀-병렬-분석-산출물-2026-04-25)):

1. `elementCreation.ts` — layout 편집 히스토리 조건에 `// TODO(P3-B)` 마킹 + canonical context 대체 계획 확정
2. `elementSanitizer.ts` — `CloudElement.page_id: string | null` 타입 수정 선행 (현재 `string` required vs 런타임 `null` — Hidden bug D2 와 동일 위치)
3. `useIframeMessenger.ts` — `UPDATE_ELEMENTS` postMessage 에 `version: "legacy-1.0"` 스텁 추가 (P3-D Preview 동시 배포 기반)
4. `layoutActions.ts` — `currentLayoutId` 직접 접근 사이트 dev-only migration 경고 logging
5. `usePageManager.ts` — `initializeProject` layout loading 경로에 `// TODO(P3-D)` 마킹
6. G3-A 통과 조건에 `legacyOwnershipToCanonicalParent()` 구현 완성 추가 (위 Sub-Gate G3-A 에 반영됨)
7. localStorage `"composition-layouts"` persist key migration 계획 확정 (새로고침 후 selectedReusableFrameId 초기화 방지)

**Risk**: LOW (P3-A 자체) / **HIGH (P3-D 진입 시 미충족 위험)**. P3-A 단독 작업은 신규 타입 + adapter 표면 추가만으로 기존 호출 사이트 미변경. 단, 위 안전망 #6 미충족 상태에서 P3-D 진입 시 기존 IndexedDB 의 `layout_id` 기반 elements 가 `getByLayout()` API 소멸 이후 읽기 불가 → **사용자 데이터 손실** (Team 3 평가).

### 2.2 P3-B: Stores 해체 (~56 ref / 6 files)

**대상**: `builder/stores/layouts.ts` (18 ref), `builder/stores/utils/layoutActions.ts` (21 ref), `builder/stores/utils/elementCreation.ts` (7 ref), `builder/stores/utils/elementSanitizer.ts` (6 ref), 외 2 파일 (4 ref)

**작업**:

1. `useLayoutsStore.layouts[]` → adapter 경유 read-through 로 축소. write 경로 (`createLayout` / `deleteLayout` / `updateLayout`) 는 canonical document tree 내부 `reusable: true` 노드 mutation 으로 변환.
2. `currentLayoutId` selector → canonical document 의 selected reusable frame id (`selectedReusableFrameId`) 로 rename + 의미 단일화.
3. `layoutActions.ts` 의 page-layout sync 로직 (`isCurrentLayoutValid` 검증 등) → canonical document 내 reusable frame 존재성 체크로 대체.
4. `elementCreation.ts` 의 `{ page_id, layout_id }` ownership 주입 → canonical tree 의 부모 노드 결정 기반으로 제거. 신규 element 생성 시 ownership marker 불요.
5. `elementSanitizer.ts` 의 `layout_id` 정리 로직 → reusable frame 참조 무결성 체크로 대체.

**Sub-Gate G3-B**:

```bash
grep -rnE "useLayoutsStore|currentLayoutId|fetchLayouts|createLayout" \
  apps/builder/src/builder/stores/ --include='*.ts' --include='*.tsx' | wc -l
```

→ 0 또는 adapter import 만 잔존. 전체 G3 ref **403 → ~347** (-56).

**Risk**: HIGH. store 단계에서 page-layout 이원화 해체 시 기존 page 의 ownership 추적이 깨짐. **mitigation**: P3-A 의 read-through adapter 가 동시 동작, fixtures 기반 회귀 테스트 (canonical document → legacy layouts[] 변환 등가성) 필수.

### 2.3 P3-C: NodesPanel UI 재설계 (~75 ref / 11 files)

**병렬 가능 with P3-B** (UI layer 만 변경, store API surface 는 P3-A adapter 로 stable).

**대상**: `panels/nodes/LayoutsTab/LayoutsTab.tsx` (33 ref), `panels/properties/editors/{PageLayoutSelector,PageParentSelector,...}` (33 ref), `panels (other)` (9 ref)

**작업**:

1. `LayoutsTab.tsx` → `FramesTab.tsx` 재명명 + canonical reusable frame CRUD UI:
   - `createLayout` 호출 → `createReusableFrame(name, type)` (canonical document 내부 신규 `reusable: true` 노드 추가)
   - layout 목록 표시 → canonical document tree 의 reusable 노드 selector 결과 표시
   - selection 상태 → `selectedReusableFrameId` (P3-B)
2. `PageLayoutSelector.tsx` (13 ref): page 의 layout 연결 선택 → canonical 의 page 노드가 어떤 reusable frame 을 `ref` 하는지 선택 UI.
3. `PageParentSelector.tsx` (9 ref): 동등 패턴.
4. `LayoutBodyEditor.tsx` / `LayoutSlugEditor.tsx` 신규 또는 기존 통합:
   - frame body 편집 → canonical reusable frame 노드의 children 편집
   - frame slug → frame 노드의 metadata.slug 또는 id
5. `LayoutPresetSelector` / `ElementSlotSelector`: canonical `slot` 메타데이터 직접 편집 UI 로 통합.

**Sub-Gate G3-C**:

```bash
grep -rnE "createLayout|useLayoutsStore|currentLayoutId|fetchLayouts|layout_id" \
  apps/builder/src/builder/panels/ --include='*.ts' --include='*.tsx' | wc -l
```

→ 0 또는 adapter import 만 잔존. 전체 G3 ref **~347 → ~272** (-75).

**Risk**: MEDIUM. UI 재설계 → 기존 사용자의 layout 인식 모델 변경 (Layouts tab 소실, Frames tab 신설). **mitigation**: 1차 release 에서 alias label "Layouts (Frames)" 또는 changelog 강조.

### 2.4 P3-D: Factory + Hooks + Preview runtime path (~207 ref / 26 files)

**P3 최대 작업**. P3-B + P3-C 완료 후 진입.

**대상**: `factories/definitions/*.ts` (124 ref / 10), `builder/hooks/{useIframeMessenger,usePageManager,...}` (28 ref / 5), `preview/{App.tsx,layoutResolver.ts,CanvasRouter.tsx,...}` (35 ref / 6), `builder/main/BuilderCore.tsx` (11 ref / 1), `builder/workspace/**` (9 ref / 4)

**작업**:

1. **Factory ownership marker 제거** (124 ref):

   ```ts
   // Before
   const ownership = layoutId
     ? { page_id: null, layout_id: layoutId }
     : { page_id: pageId, layout_id: null };
   const element = { ...baseElement, ...ownership };

   // After
   // ownership 자체 제거 — element 위치는 부모 노드가 결정
   const element = baseElement;
   ```

   10개 factory 파일 전수 sweep. `{ page_id, layout_id }` 필드 declaration 도 element type 에서 제거.

2. **Hooks 마이그레이션** (28 ref):
   - `useIframeMessenger.ts`: postMessage payload 의 `layout_id` 필드 → canonical reusable frame id 또는 path
   - `usePageManager.ts`: page CRUD 가 layout 와 분리된 관리 → canonical document 내 page 노드 단일 관리
3. **Preview 마이그레이션** (35 ref):
   - `preview/App.tsx`: P2 옵션 C (별도 worktree) 와 합류 시점 — `layout_id` 기반 hybrid 분기 12건 (G2) 와 함께 canonical 단일화 완성
   - `preview/utils/layoutResolver.ts`: P2 D-A 에서 dev compare 로 등가성 입증된 canonical resolver 로 직접 대체. legacy resolver 모듈 자체 deprecate
   - `preview/router/CanvasRouter.tsx`: route param 의 layout_id → reusable frame id
4. **BuilderCore.tsx** (11 ref): entry point 의 layout init flow → canonical document load → reusable frame discover
5. **Workspace canvas** (9 ref): `workflowEdges.ts` 등의 layout-aware 분기 → canonical 단일

**Sub-Gate G3-D**:

```bash
grep -rnE "createLayout|useLayoutsStore|currentLayoutId|fetchLayouts|layout_id" \
  apps/builder/src/builder/factories/ apps/builder/src/builder/hooks/ \
  apps/builder/src/preview/ apps/builder/src/builder/main/ \
  apps/builder/src/builder/workspace/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

→ 0. 전체 G3 ref **~272 → ~65** (-207).

**Risk**: CRITICAL.

- (a) factory ownership 제거 → 기존 IndexedDB 저장 데이터 (legacy ownership 포함) 로드 시 호환성 깨짐
- (b) preview path canonical 단일화 → P2 옵션 C 와 직접 의존 — 옵션 C 미완 상태 P3-D 진입 금지
- (c) postMessage schema 변경 → builder ↔ preview 양측 동시 배포 필요

**mitigation**:

- P3-A adapter 의 `legacyOwnershipToCanonicalParent()` 가 IndexedDB load 시점 자동 변환
- P2 옵션 C 완료 (G2 = 0) 가 P3-D 진입 hard precondition
- postMessage version 필드 도입 (`composition-1.0` vs legacy)

### 2.5 P3-E: Persistence (~10 ref / 4 files)

**대상**: `lib/db/indexedDB/adapter.ts` (6 ref), 기타 (4 ref / 3 files)

**작업**:

1. IndexedDB schema 의 `layout_id` 컬럼 → 신규 `parent_node_path` 또는 제거
2. Migration script: 기존 사용자 DB 의 legacy schema → canonical schema 1회 변환
3. Persistence schema version field 도입 (`schema: "composition-1.0"`)

**Sub-Gate G3-E**:

```bash
grep -rnE "layout_id" apps/builder/src/lib/ apps/builder/src/utils/ \
  --include='*.ts' --include='*.tsx' | wc -l
```

→ 0 또는 migration script 한정. 전체 G3 ref **~65 → ~55** (-10).

**Risk**: HIGH. **사용자 데이터 마이그레이션** — 1회성 변환 실패 시 작업 손실.
**mitigation**:

- 변환 전 자동 backup (IndexedDB → JSON dump)
- canonical 변환 실패 시 legacy schema 유지 + 경고 표시 (graceful degradation)
- E2E 테스트: legacy fixture 50+ 케이스 → canonical 변환 정합성 검증

### 2.6 P3-F: Test cleanup (~5 ref / 1 file)

**대상**: `resolvers/canonical/__tests__/integration.test.ts` (5 ref)

**작업**: 기존 layout_id 기반 fixture → canonical reusable frame fixture 로 재작성. 일부는 P3-A adapter 검증 fixture 로 보존 (legacy 호환 회귀).

**Sub-Gate G3-F**: canonical resolver test 전수 PASS + adapter compat test PASS. 전체 G3 ref **~55 → ~50 (adapter only)**.

### 2.7 G3 최종 통과 조건

```bash
grep -rnE "createLayout|useLayoutsStore|currentLayoutId|fetchLayouts|layout_id" \
  apps/builder/src/ --include='*.ts' --include='*.tsx' \
  | grep -vE "apps/builder/src/adapters/legacy-layout/" \
  | wc -l
```

→ **0** (adapter shim 제외). adapter shim 자체는 P5 G5 시점에 완전 해체.

## 3. 의존 그래프 + 일정 추정

| Sub-phase | 의존                             | 병렬 가능 with | 추정 시간 | 위험     |
| --------- | -------------------------------- | -------------- | --------- | -------- |
| **P3-A**  | (없음)                           | —              | ~4h       | LOW      |
| **P3-B**  | P3-A                             | P3-C           | ~8h       | HIGH     |
| **P3-C**  | P3-A                             | P3-B           | ~12h      | MEDIUM   |
| **P3-D**  | P3-B + P3-C + **P2 옵션 C 완료** | —              | ~20h      | CRITICAL |
| **P3-E**  | P3-D                             | —              | ~6h       | HIGH     |
| **P3-F**  | P3-E                             | —              | ~2h       | LOW      |
| **total** |                                  |                | **~52h**  |          |

**권장 분할 PR 단위**:

- PR-1: P3-A (foundation, low-risk merge first)
- PR-2: P3-B + P3-C 동시 (병렬 진행, 통합 테스트 후 merge)
- PR-3: P3-D (별도 worktree 권장, P2 옵션 C 완료 후 진입)
- PR-4: P3-E + P3-F (마이그레이션 + cleanup)

## 4. ADR-903 본문 G3 (a)~(e) 매핑

| Gate 조건 | sub-phase 커버                                          |
| --------- | ------------------------------------------------------- |
| (a)       | P3-B (store 해체) + P3-D (runtime canonical 단일)       |
| (b)       | P3-C (NodesPanel UI 재설계)                             |
| (c)       | P3-A~F 전수 (G3 measurement 명령 = 0)                   |
| (d)       | P3-C (UI 재설계 + 기능 등가성 보존)                     |
| (e)       | P3-B (store) + P3-D (runtime + persistence sync) + P3-E |

## 5. 회귀 검증 매트릭스

| 검증 항목                              | 위치                                               | sub-phase |
| -------------------------------------- | -------------------------------------------------- | :-------: |
| canonical document → legacy layouts[]  | `adapters/canonical/__tests__/integration.test.ts` |   P3-A    |
| reusable frame CRUD round-trip         | `builder/stores/__tests__/layoutActions.test.ts`   |   P3-B    |
| FramesTab UI snapshot                  | `panels/nodes/__tests__/FramesTab.test.tsx`        |   P3-C    |
| factory ownership 제거 후 element 등록 | `factories/__tests__/elementCreation.test.ts`      |   P3-D    |
| Preview canonical render 시각 등가성   | `parallel-verify` skill (Chrome MCP)               |   P3-D    |
| IndexedDB legacy → canonical migration | `lib/db/__tests__/migration.test.ts`               |   P3-E    |
| canonical resolver fixture 전수 PASS   | `resolvers/canonical/__tests__/`                   |   P3-F    |

## 6. 후속 Phase 와의 관계

> 상세 sub-breakdown:
>
> - **P4**: [903-phase4-editing-semantics-breakdown.md](903-phase4-editing-semantics-breakdown.md) (637L, 6 sub-phase / ~46h, HIGH 위험 2건 = P4-A subtree materialize / P4-B path-based descendants)
> - **P5**: [903-phase5-persistence-imports-breakdown.md](903-phase5-persistence-imports-breakdown.md) (~620L, 6 sub-phase / ~42h, HIGH 위험 1건 = P5-B migration script)
> - **신규 필드 P0 land 검증**: [903-additional-fields-land-status.md](903-additional-fields-land-status.md) — P0 실제 70% land (메모리 100% 표시 정정 권고)

### P3 → P4 의존

- **P4-A (detach subtree materialize)** 가 P3-D 의 canonical tree mutation API 에 의존. P3-D 완료 후 진입 권장
- **P4-B (path-based descendants)** 가 P3-A 의 `legacyOwnershipToCanonicalParent()` adapter 와 정합. P3-A G3-A Sub-Gate 완성 후 진입 권장
- P4-D (시각 마커) 가 P3-A 신규 surface 5건 (특히 `extractSlotMetaFromNode`) 활용

### P3 → P5 의존

- **P5-B (legacy → canonical migration script)** 가 P3-E persistence sub-phase 의 후속. P3-E 가 `_meta` 별도 store + backupKey land 후 진입
- **P5-C (adapter shim 완전 해체)** 가 P4 G4 통과 후 (decisions.md 결정 5 옵션 채택). P3-A 의 adapter shim 이 P5-C 에서 제거됨
- P5-D/E (imports resolver) 는 P3 와 독립 — P0 스텁 + ResolverCache 활용

### P4 → P5 의존

- **P4-B 완료 후 P5 진입 권장** (P4-B 의 path-key 가 P5-B migration script 의 변환 대상)
- adapter shim lifecycle: P4 G4 통과 → shim 제거 착수 → P5 IndexedDB canonical schema 전환 → G5 최종 (P3 decisions.md 결정 5 연계)

### G4/G5 측정

- **G4** (UI marker 정합 + override semantics): P4-F 후 시점에 측정 진입 가능
- **G5** (persistence 완결): P5-B migration 99%+ 성공률 + P5-C shim grep = 0 + P5-D imports e2e PASS

## 7. 결정 사항 (architect 권고 결과)

> 상세 권고 + 위험 평가 + 선택지 비교: [903-phase3-decisions.md](903-phase3-decisions.md) (529L). 본 섹션은 권고 결과 요약만.

| ID    | 결정                          | 권고                                                                               | 사용자 결정 | 차단 대상    |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------- | :---------: | ------------ |
| **1** | page 노드 canonical 표현      | layout 있는 page = `type:"ref"`, 독립 page = `type:"frame" + metadata.type:"page"` |    필수     | P3-A 첫 커밋 |
| **2** | Layout slug 매핑              | `metadata.slug` (`frame.id = slug` 즉시 기각 — descendants path 구분자 충돌)       |  기본 채택  | —            |
| **3** | IndexedDB schema version 위치 | `_meta` 별도 object store + `backupKey` 필드 (기존 store 무침범)                   |  기본 채택  | P3-E 착수    |
| **4** | P3-D 진입 차단 메커니즘       | CI Gate (option A) + Checklist (option B) 병행                                     |    권장     | P3-D 착수    |
| **5** | Adapter shim lifecycle        | P4 완료 시점 (G4 통과 후) 해체 — P5 무기한 잔존 기각                               |  기본 채택  | —            |

**결정 1** 만 P3-A 첫 커밋 전에 사용자 confirm 필요. 결정 2/3/5 는 architect 권고로 즉시 적용 가능 (이견 없을 시). 결정 4 는 P3-D 진입 시점에 CI 환경 결정.

## 8. 3-에이전트 팀 병렬 분석 산출물 (2026-04-25)

P3-A 진입 전 본 sub-breakdown 의 §2.1 (P3-A 작업) + §7 (결정 사항) 의 정밀화를 위해 3-agent 팀 병렬 dispatch:

| Team | Agent     | 산출물                                                                  | 주요 발견                                                                                                              |
| ---- | --------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | architect | [903-phase3-decisions.md](903-phase3-decisions.md) (529L)               | 결정 5건 권고 (위 §7 흡수). 사용자 결정 필수 항목 = 결정 1                                                             |
| 2    | Explore   | task output 경유 (Explore 도구 미보유로 file write 불가)                | 5 파일 합계 36 exports / 외부 호출자 18 파일 / 신규 surface 5건 권고 (§2.1 흡수). `convertPageLayout` 직접 import 발견 |
| 3    | debugger  | [903-phase3a-regression-risk.md](903-phase3a-regression-risk.md) (487L) | HIGH+ 회귀 5개 / 사용자 데이터 손실 시나리오 1건 / 안전망 7건 (§2.1 G3-A 흡수) / 잠재 hidden bug 4건 (D1-D4)           |

**잠재 hidden bug (P3 무관)**:

- **D2 (MED)**: `elementSanitizer.ts:97` — `CloudElement.page_id: string` (required) vs layout element 의 `page_id: null` 런타임 → DB 에 `page_id=""` 저장. P3-A 안전망 #2 와 동일 위치, 즉시 수정 가치 있음.
- **D1/D3/D4 (LOW)**: stale closure / parent_id 재매핑 / merge 순서 — 별도 이슈 처리.
