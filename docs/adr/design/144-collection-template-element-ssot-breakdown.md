# ADR-144 Design Breakdown — Collection 컴포넌트 Template Element SSOT

> 본 design breakdown 은 ADR-144 의 구현 상세 — Phase scope, 파일 경계, 검증 fixture 정의. ADR 본문은 결정 / 위험 / Gate 만 보유. Round 3 (2026-05-27) codex Round 2 결함 반영.

## §0. Phase 0 — Inventory Freeze (사전 정리)

> [`.claude/rules/adr-writing.md`](../../../.claude/rules/adr-writing.md) §"Phase scope inflation / sub-group N≥3 시 사용자 confirm 의무" 적용 — 본 Phase 0 가 사전 inventory freeze 로 scope inflation 차단. (memory `feedback-analysis-precision-patterns` §1.5x scope inflation 차단)

### Scope

- **Family A (8)**: collection-item 구조 inventory + template 자동 생성 factory + hydration migration helper 작성
- **Family B (3)**: 기존 child element 구조 verification baseline (변경 0)
- 각 컴포넌트의 RAC primitive 매핑 확인 (createLeafComponent / createBranchComponent / TreeItem recursive 등)
- 추정 vs 실측 gap 측정 — Round 1 review 1.5x scope gap (9 → 11), Round 2 codex review 본질 framing gap (11 일반화 → 8 + 3 분리) 사례 재발 차단

### Deliverables

| 산출물                              | 위치                                                                                             | 목적                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Family A `inventory.md`             | 본 design breakdown 안 §0.3.A                                                                    | Family A 8 컴포넌트 collection-item 구조 freeze                      |
| Family B `verification baseline.md` | 본 design breakdown 안 §0.3.B                                                                    | Family B 3 컴포넌트 기존 child element 구조 freeze (변경 0 expected) |
| `hydration migration helper`        | `apps/builder/src/adapters/canonical/legacyFamilyACollectionTemplateMigration.ts` (Phase 0 신규) | Family A 기존 프로젝트 1회 template 주입                             |

### §0.3.A — Family A 8 컴포넌트 (template element 신규 도입 대상)

| 컴포넌트 | 멤버십 갈래                             | RAC primitive                                                    | 신규 template element         | 특수 처리                                                                                          |
| -------- | --------------------------------------- | ---------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| ComboBox | SYNTHETIC (A-1)                         | (Menu ListBox 재사용)                                            | ListBoxItem                   | trigger + input 분리                                                                               |
| GridList | SYNTHETIC (A-1)                         | createLeafComponent GridListItem                                 | GridListItem                  | grid layout                                                                                        |
| ListBox  | SYNTHETIC (A-1)                         | createLeafComponent ListBoxItem                                  | ListBoxItem                   | (없음)                                                                                             |
| **Menu** | **별 branch (A-2, ADR-068 items SSOT)** | createLeafComponent MenuItem + createBranchComponent MenuSection | MenuItem / MenuSection        | 2-level (item + section) + `_hasChildren` 분기 제거 영역 — Phase A 에서 SYNTHETIC 패턴 동등 정밀화 |
| Select   | SYNTHETIC (A-1)                         | (Menu ListBox 재사용)                                            | ListBoxItem                   | trigger 분리                                                                                       |
| Table    | SYNTHETIC (A-1)                         | createBranchComponent Row + Cell                                 | Row + Cell (2-level template) | Column header 별도                                                                                 |
| TagGroup | SYNTHETIC (A-1)                         | createLeafComponent Tag                                          | Tag                           | factory: `items` prop + Label child (mixed pattern)                                                |
| Toolbar  | SYNTHETIC (A-1)                         | (mixed: Button / ToggleButton / Separator / Group)               | (mixed item types)            | item type discriminated union                                                                      |

### §0.3.B — Family B 3 컴포넌트 (기존 child element 모델, verification only)

| 컴포넌트    | factory child 생성 evidence                                                                         | spec child 관리 evidence                                                                                       | 본 ADR 변경                                  |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Breadcrumbs | `factories/definitions/GroupComponents.ts:420-432` — `Breadcrumb` child 자동 생성                   | `Breadcrumbs.spec.ts:141` — `items` field `type: "children-manager"` (childTag: "Breadcrumb")                  | **변경 0** — Phase C verification fixture 만 |
| Tabs        | `factories/definitions/LayoutComponents.ts:39-55` — `TabList` + `Tab` + `TabPanels` child 자동 생성 | items + child element hybrid (items 는 dynamic tab 추가, child 는 ARIA structure)                              | **변경 0** — Phase C verification fixture 만 |
| Tree        | `factories/definitions/LayoutComponents.ts:213-230` — `TreeItem` child 자동 생성                    | `Tree.spec.ts:248` 주석: "Tree 는 자식 TreeItem Element 가 각자 행을 렌더한다 — Preview renderTree 와 D3 대칭" | **변경 0** — Phase C verification fixture 만 |

### Gate G0 통과 조건

- Family A 8 컴포넌트 inventory freeze (§0.3.A 테이블)
- Family B 3 컴포넌트 verification baseline freeze (§0.3.B 테이블)
- hydration migration helper unit test PASS (Family A 전용)

## §A. Phase A — Family A Template Element 도입 (factory + canonical 직렬화)

### Scope

- **Family A 8 컴포넌트 factory** 에 collection-item template 자동 생성 추가
- canonical document schema 에 template element 위치 정의
- `buildSpecNodeData.SYNTHETIC_CHILD_PROP_MERGE_TAGS` contract 확장 — template element 동반 가능
- **Menu items SSOT 별 branch (A-2)**: SYNTHETIC 멤버 아니지만 동일 정밀화 — `buildSpecNodeData.ts:168` ADR-068 주석 영역에서 Menu 전용 `_hasChildren` 조건 동일 분기 (template element 존재 시 주입, data row 자식 X)
- **Family B 변경 0** — 이미 child element 모델

### 변경 파일 (Phase A 진행 시 확정)

- `apps/builder/src/builder/factories/ComponentFactory.ts` — Family A 8 컴포넌트 factory 진입점
- `apps/builder/src/builder/factories/definitions/**/*.ts` — Family A 8 컴포넌트 factory 정의에 template 자식 자동 생성 추가 (Family B 는 변경 0)
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — `_hasChildren` 주입 조건 정밀화 (template 존재 + data row 없음 분기) + Menu 별 branch 동등 정밀화
- `apps/builder/src/adapters/canonical/*` — canonical document 직렬화 시 template element 보존 (Family A)

### Gate G1 통과 조건

- Family A 8 컴포넌트 factory 자동 template 생성 + canonical document 직렬화 round-trip PASS
- hydration migration 으로 기존 프로젝트 Family A template element 주입 round-trip PASS
- Family B 3 컴포넌트 변경 0 확인 (regression test)

## §B. Phase B — Family A Spec render.shapes Patch (template-data 결합 paint)

### Scope

- **Family A 8 컴포넌트** 의 `render.shapes` 가 template element style 우선 소비
- 기존 hardcoded item style 제거 (paddingX / itemHeight 등) → template style 참조
- props.items data 와 template style 결합 paint 유지 (visible 영역 paint 는 Phase D)
- **Family B 변경 0** — 이미 child element 가 각자 paint

### 변경 파일 (Phase B 진행 시 확정)

- `packages/specs/src/components/{ComboBox,GridList,ListBox,Menu,Select,Table,TagGroup,Toolbar}.spec.ts` 8개 — render.shapes 의 template 참조 path

### Gate G2 통과 조건

- cross-check Family A 8 컴포넌트 CSS ↔ Skia 정합 PASS
- D3 SSOT 위반 0 (spec.shapes 가 props.items style 직접 hardcode 안 함)

## §C. Phase C — Canonical SSOT 통합 검증 (Family A + Family B 양쪽)

### Scope

- **Family A 8** (신규 template element) + **Family B 3** (기존 child element) = **11 컴포넌트** 모두 reusable / slot / ref / descendants 4 메커니즘 PASS verification
- 4 fixture 패턴:
  - **reusable instance override**: ListBoxItem (Family A) / TreeItem (Family B) template style override → 모든 row 에 반영
  - **slot inject**: ListBoxItem (Family A) / Breadcrumb (Family B) 안에 icon inject
  - **ref reference**: Menu 가 ListBox template 참조 (Family A cross-component) / Tabs 가 Tab template 참조 (Family B cross-component)
  - **descendants override**: reusable 인스턴스마다 ListBoxItem (Family A) / TreeItem (Family B) style 다름

### 변경 파일 (Phase C 진행 시 확정)

- `apps/builder/src/__tests__/canonical-collection-template-family-a.test.ts` (신규) — Family A 4 fixture × 8 컴포넌트
- `apps/builder/src/__tests__/canonical-collection-template-family-b.test.ts` (신규) — Family B 4 fixture × 3 컴포넌트
- `apps/builder/src/adapters/canonical/canonicalRefResolution.ts` — collection-item template path resolve 확인 (변경 0 expected, fixture 만)

### Gate G3 통과 조건

- Family A 4 fixture × 8 컴포넌트 = 32 case PASS
- Family B 4 fixture × 3 컴포넌트 = 12 case PASS
- descendants path resolver 가 template element id reference 성공 (양 family)

## §D. Phase D — Family A Skia Virtualizer 통합 + descendantsFingerprint stub 해제

### Scope

- Skia 측 viewport intersection 계산 — Family A render.shapes 가 visible row 만 paint
- scroll 이벤트 시 visible range 재계산 + repaint
- RAC `Virtualizer.tsx` 의 `state.visibleViews` 패턴을 Skia 측 구현
- **`computeDescendantsFingerprint` stub 해제** (`canonical-resolver.types.ts:39 @stub Phase 2+` → 구현) + 1000 노드 5 depth fingerprint 비용 측정
- **Family B 변경 0** — 이미 child element 가 각자 paint, viewport intersection 은 element 단위로 자연 작동

### 변경 파일 (Phase D 진행 시 확정)

- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — viewport intersection helper (Family A spec render 안에서 사용)
- `packages/specs/src/components/{ListBox,Menu,GridList,Table,...}.spec.ts` — Family A 8 spec render.shapes 가 viewport-aware
- `packages/shared/src/types/canonical-resolver.types.ts` — `computeDescendantsFingerprint` stub 해제 + 실제 stable hash 구현
- `apps/builder/src/__tests__/skia-virtualizer-perf.test.ts` (신규) — Family A 대표 4 컴포넌트 (ListBox / Table / Menu / GridList) × {1000 / 10000 / 100000 row} 60fps 회귀 fixture
- `packages/shared/src/__tests__/descendantsFingerprint.bench.ts` (신규) — 1000 노드 5 depth fingerprint 비용 측정 fixture

### Gate G4 통과 조건 (Round 3 정정 — codex M3 적용)

- **Family A 대표 4 컴포넌트** × {1000 / 10000 / 100000 row} fixture 60fps + viewport scroll fps 회귀 0:
  - ListBox (단순 1-level)
  - Table (Row + Cell 2-level)
  - Menu (items SSOT 별 branch A-2)
  - GridList (grid layout 특수 — column 수 × row 수)
- `computeDescendantsFingerprint` 1000 노드 5 depth fingerprint 비용 측정 PASS (R4 대응)

## §E. Phase E — Implemented 승격 + 문서 동기화

### Scope

- README.md / CHANGELOG.md 갱신 (ADR-144 Implemented 진입 + Phase 0-D 요약)
- ADR-066 / ADR-068 / ADR-073 / ADR-076 본문에 ADR-144 patch 참조 추가 (`completed/` archive 동기화)
- type-check baseline 무증가 확인
- cross-check Family A 8 컴포넌트 최종 PASS + Family B 3 컴포넌트 regression 0 확인
- **CHANGELOG drift 14일/100 commits 임계 초과 시 catch-up block 선행 작성** (`.claude/rules/changelog.md` §2 적용)

### Gate G5 통과 조건

- type-check baseline 무증가
- `pnpm test` PASS
- cross-check Family A 8 컴포넌트 PASS + Family B 3 컴포넌트 regression 0
- CHANGELOG / README 동시 갱신 (`.claude/rules/changelog.md` 트리거 1 — ADR Implemented 승격)
- drift 임계 초과 시 catch-up block 선행 (`## [Catch-up YYYY-MM-DD ~ YYYY-MM-DD]` 헤더)

## 부록 — RAC reference 코드 위치

| RAC 패턴                          | 위치                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| CollectionBuilder hidden tree     | `node_modules/.pnpm/react-aria-components@1.17.0/.../src/Collection.tsx` |
| createLeafComponent (ListBoxItem) | `react-aria-components@1.17.0/src/ListBox.tsx:251-358`                   |
| createBranchComponent (Section)   | `react-aria-components@1.17.0/src/Collection.tsx`                        |
| Virtualizer visible-only          | `react-aria-components@1.17.0/src/Virtualizer.tsx`                       |
| Tree flattened collection         | `react-aria-components@1.17.0/src/Tree.tsx`                              |

각 Phase 진행 시 RAC 소스 직접 참조 (`.claude/rules/react-aria-skill.md` §"GitHub 소스코드 직접 참조" 적용).
