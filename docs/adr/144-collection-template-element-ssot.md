# ADR-144: Collection 컴포넌트 Template Element SSOT — RAC dynamic collection 정통 패턴 적용

> **Superseded by [ADR-145](completed/145-listbox-template-element-single-component-proof.md)** — 2026-05-27
>
> 최종 계보 (2026-07-08 확인): ADR-145 (Implemented) → ADR-146 (Implemented) → ADR-147 (Superseded) → **[ADR-148](148-reusable-slot-system-unification.md)** — 잔여 collection item slot 확산은 ADR-148 Phase 4 로 흡수.

## Status

**Superseded by ADR-145** — 2026-05-27 (사용자 결정, codex Round 5 L1 taxonomy 정정)

### 폐기 사유

Codex Round 4 독립 리뷰 (2026-05-27) 가 본 ADR 의 단일 Family axis (`template element 존재 여부`) 가 본질 axis 가 아님을 발견:

- `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버십 ↔ child element 자동 생성 여부 ↔ items SSOT 강도 — **3 axis 가 직교**
- Tabs = items SSOT (Tab) + child element (TabList/TabPanels) hybrid → Family A/B 단일 분류 불가
- Toolbar = factory child 자동 생성 + items prop 없음 → Family A 분류 오류
- Menu = Skia render.shapes 가 trigger 만 그림 (item rows 는 Preview-only) → Family A perf gate 검증 불가
- `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 실제 set 에 Family B (Breadcrumbs/Tabs/Tree) 포함된 10개인데 ADR 본문은 A-1 = 7 주장

→ 11 컴포넌트 단일 일괄 ADR 본질 정밀도 부족. 사용자 결정 (2026-05-27 "adr-144 폐기후 ListBox 단일 에 집중"): **본 ADR 폐기 + ListBox 단일 시범 ADR (ADR-145) fork**. 성공 시 나머지 10 컴포넌트 (Breadcrumbs/ComboBox/GridList/Menu/Select/Table/TagGroup/Tabs/Toolbar/Tree) 는 각각 별도 후속 ADR 결정.

본 ADR 본문은 historical reference 로 보존 — Round 1-3 정정 이력 + Codex Round 2/4 리뷰 결과 가 후속 ADR 의 framing 검증 자료. 본 ADR scope 의 결함 분석 결과는 ADR-145 §Context "ADR-144 와의 관계" 에 요약.

### 원본 Status (보존)

Proposed — 2026-05-27 (Round 3, 2026-05-27 — codex Round 2 독립 리뷰 결함 3건 정정 반영)

## Context

### 문제 정의

composition 의 collection 컴포넌트 11개는 child element 모델 axis 로 2 family 분리됨 (Round 3 정정 — codex Round 2 H1 scope-evidence mismatch 반영):

| Family                      | 컴포넌트 (수)                                                                  | child element 자동 생성 | template element SSOT | 본 ADR 적용                                |
| --------------------------- | ------------------------------------------------------------------------------ | :---------------------: | :-------------------: | ------------------------------------------ |
| **A. template 부재**        | ListBox / ComboBox / GridList / Menu / Select / TagGroup / Table / Toolbar (8) |            ✗            |           ✗           | **신규 도입 대상** — Phase A-D 실행        |
| **B. template 존재 (기존)** | Breadcrumbs / Tabs / Tree (3)                                                  |            ✓            |     ✓ (이미 작동)     | **verification only** — Phase C fixture 만 |

#### Family A (8) — template element 부재 = 본 ADR scope

`props.items[]` 기반 composite paint, element tree 에 collection-item 없음. 내부 메커니즘 2 갈래:

| 갈래                                 | 멤버                                                                    | 위치                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A-1. SYNTHETIC_CHILD_PROP_MERGE_TAGS | ComboBox / GridList / ListBox / Select / Table / TagGroup / Toolbar (7) | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:163-178` |
| A-2. Menu items SSOT 별 branch       | Menu (1)                                                                | ADR-068 의 `_hasChildren` 분기 제거 영역 (`buildSpecNodeData.ts:168` 주석)    |

#### Family B (3) — template element 이미 존재 = verification only

- **Breadcrumbs**: factory 가 `Breadcrumb` child 자동 생성 (`apps/builder/src/builder/factories/definitions/GroupComponents.ts:420-432`), spec 의 `items` field 가 `children-manager` 로 child element 관리 (`packages/specs/src/components/Breadcrumbs.spec.ts:141`)
- **Tree**: factory 가 `TreeItem` child 자동 생성 (`apps/builder/src/builder/factories/definitions/LayoutComponents.ts:213-230`), spec render.shapes 가 shell 만 그리고 child TreeItem element 가 행 렌더 (`packages/specs/src/components/Tree.spec.ts:248` 주석: "Tree 는 자식 TreeItem Element 가 각자 행을 렌더한다 — Preview renderTree 와 D3 대칭")
- **Tabs**: factory 가 `TabList` + `Tab` + `TabPanels` child 자동 생성 (`apps/builder/src/builder/factories/definitions/LayoutComponents.ts:39-55`). props.items + child element hybrid 패턴 (items 는 dynamic tab 추가, child 는 ARIA structure)

Family B 는 canonical descendants path 가 이미 작동 가능 (child element 존재). 본 ADR 은 Family B 에 대해 **변경 없음** — 단 Phase C 안에 reusable / slot / ref / descendants 4 fixture 가 Family B 도 PASS 함을 verification.

### Family A 의 canonical incompatibility

ADR-116/122 (canonical document SSOT) + ADR-112 (Editing Semantics 6요소 + Slot section base) 도입 이후, Family A 의 composite items 구조가 canonical SSOT 와 incompatible 함이 드러남:

| canonical 메커니즘                   | 작동 조건                              | Family A composite 상태                   |
| ------------------------------------ | -------------------------------------- | ----------------------------------------- |
| `RefNode.descendants[path]` override | path 가 reference 할 element node 필요 | items entry 는 element 아님 → 진입점 부재 |
| slot projection                      | slot 은 element child 영역 위에서 작동 | item 단위 slot 불가능                     |
| ref reference                        | ref id 가 element id 만 인식           | item entry id 는 props 안 string          |
| reusable instance per-item override  | item 단위 mutation entry 필요          | 부모 props.items 통째로만 override 가능   |

`packages/shared/src/types/canonical-resolver.types.ts:7-12` 의 `descendants` 정의가 "ref root 를 루트로 하는 subtree path-based override" 로 element tree path 를 전제. 단 `computeDescendantsFingerprint` (line 39) 는 `@stub Phase 2+` 상태 — R4 의 측정 timing 은 stub 해제 후 (M3 정정).

### Hard constraints

- composition product target = 엔터프라이즈급 빌더 (60fps 최저선, memory `feedback-composition-enterprise-target`)
- 1000+ row collection 처리 시 fps 회귀 0
- canonical document SSOT 정합 (ADR-116 / ADR-122 후속)
- ADR-132 `useCollectionData` + **`collections.runtimeData`** 진입점 보존 (Round 3 정정 — codex Round 2 M2 terminology drift 반영. `data_tables` → `collections` rename Implemented, `packages/shared/src/hooks/useCollectionData.tsx:6` 단일 sink)
- RAC 본래 D1 (DOM / ARIA / 키보드) 변경 0 — `react-aria-components@1.17.0` `createLeafComponent` / `CollectionBuilder` / `Virtualizer` 패턴은 그대로 차용

### SSOT 체인 3-domain 분류 (`.claude/rules/ssot-hierarchy.md`)

- **D1 (DOM / 접근성, RAC 절대 권위)**: `createLeafComponent` 로 등록된 `ListBoxItem` / `MenuItem` / `Row` + `Cell` 패턴 — 본 ADR 변경 0, 차용만
- **D2 (Props / API, RSP 참조)**: collection-item 의 사용자 편의 props (selected / disabled / id 등) — 기존 spec 보존
- **D3 (시각 스타일, Spec SSOT)**: **Family A** collection-item template element 의 spec / canonical descendants 위치 / spec render.shapes 의 template-data 결합 paint — **본 ADR 적용 영역**

### Baseline framing reverse 검증 (사용자 explicit confirm, 2026-05-27)

ADR-066 (Tabs items SSOT) / ADR-068 (Menu items SSOT) / ADR-073 (Select / ComboBox items SSOT) / ADR-076 (ListBox items SSOT) 의 composite 채택 motivation = "child item N 증가 시 N Skia 노드 폭증 회피 (퍼포먼스)". 그러나:

1. 위 결정은 canonical document + reusable / slot / ref / descendants 도입 이전 시점 baseline
2. canonical SSOT 도입 후 composite 자체가 path 진입점 부재로 reusable 모델과 incompatible (**Family A 만**)
3. RAC dynamic collection 본래 패턴 = **template element 1개 + items data props + Virtualizer (visible 영역만 paint)** 으로 위 퍼포먼스 baseline 도 동시에 해소 (1000만 row 도 viewport 안 N row 만 paint)

→ Family A 의 "N Skia 노드 폭증" 가정이 무효화. template-data 결합 모델 + Virtualizer 가 정답. Family B 는 baseline reverse 무관 (이미 child element 모델).

### framing checkpoint 4 질문 lock-in (`.claude/rules/adr-writing.md`)

1. **base / 응용 분류**: 본 ADR = base (Family A 8 컴포넌트 template-data 결합 모델 도입 + Family B 3 컴포넌트 verification). 응용 = 각 컴포넌트의 canonical reusable / slot / ref / descendants 활용 검증 (별도 ADR 후속)
2. **schema 직교성**: specialization 관계 — canonical descendants path 가 element tree 위에서만 작동 → Family A template element 도입이 schema prerequisite. Family B 는 이미 specialization 충족
3. **baseline framing reverse**: ADR-066/068/073/076 의 "퍼포먼스" motivation 이 canonical context + Virtualizer 결합으로 patch (전면 reverse 아닌 partial — items props SSOT 는 유지, Family A 만 patch)
4. **codex 3차 미루지 말 것**: 본 Context 내 framing 검증 완료. codex Round 2 가 Round 1 의 11 일반화 결함 잡음 → Round 3 에서 8 + 3 분리로 framing 정밀화

## Alternatives Considered

### 대안 A: Family A template-data 결합 모델 + Skia Virtualizer 통합 — RAC 정통 패턴 (채택)

- 설명:
  - **Family A (8)**: collection-item template element 1개 (ListBoxItem / MenuItem / Row + Cell 등) 를 canonical element tree 멤버로 추가
  - **Family B (3, Breadcrumbs / Tabs / Tree)**: 변경 0 — Phase C verification fixture 만
  - `props.items[]` data layer 유지 (ADR-132 `useCollectionData` + `collections.runtimeData` sink 정합)
  - 부모 spec `render.shapes` (Family A) 가 template element style × items data 결합으로 visible row 만 paint
  - Skia 측 viewport intersection 으로 Virtualizer 통합 (visible 영역 외 paint skip)
- 외부 reference: `react-aria-components@1.17.0/src/{ListBox,Collection,Virtualizer,Tree}.tsx` — `CollectionBuilder` hidden tree + `createLeafComponent` template + `Virtualizer` `state.visibleViews`. composition self-contained 발명 회피 (memory `feedback-external-reference-first` 적용)
- 위험:
  - 기술 MED — Family A 8 컴포넌트 generic 적용 + Table Row+Cell 2-level + Menu items SSOT 별 branch 특수 처리
  - 성능 LOW — Virtualizer 통합 후 1000만 row 도 viewport paint 만, 회귀 0 expected
  - 유지보수 MED — `SYNTHETIC_CHILD_PROP_MERGE_TAGS` contract 확장 (자식 props merge + template element 동반)
  - 마이그레이션 MED — Family A factory 자식 자동 생성 + 기존 프로젝트 hydration migration 필요 (template element 추가)

### 대안 B: 11 컴포넌트 전수 element 화 (data row 마다 element)

- 설명: ListBoxItem N 개 element 를 canonical tree 에 직접 추가, props.items 폐기, data binding 도 element-level 로 이동
- 위험:
  - 기술 LOW
  - 성능 **CRITICAL** — 1000 row → 1000 element + 1000 Skia 노드 + 1000 Taffy layout 노드 → fps 폭락
  - 유지보수 **CRITICAL** — ADR-132 (`useCollectionData` + `collections.runtimeData`) 전면 reverse 필요
  - 마이그레이션 HIGH — 기존 데이터 row 를 element 로 변환 시 schema 폭증
- 기각 사유: 성능 CRITICAL, composition product target (60fps 최저선) 위반

### 대안 C: Schema 확장 (props.items entry id 부여 + descendants resolver patch)

- 설명: composite 유지하면서 props.items[i].id 에 canonical descendants resolver 가 path resolve 가능하도록 schema 확장. element tree 변경 0
- 위험:
  - 기술 **HIGH** — `descendants` 가 element tree 위 path 기반 설계인데 props access path 와 다른 layer 통합 필요. `canonical-resolver.types.ts` 의 stable hash 계산 alg 도 2 layer 분기
  - 성능 LOW
  - 유지보수 **CRITICAL** — canonical SSOT 의 element path vs props path 2 layer 분기 — D3 SSOT 의미 흐려짐
  - 마이그레이션 MED
- 기각 사유: schema 본질 위반 — canonical descendants 는 element tree 위에서만 valid 한 설계 의도. 2 layer 분기는 향후 보수 비용 폭증

### 대안 D: ListBox 단일 시범 후 7 Family A 컴포넌트 별도 ADR fork

- 설명: ListBox 만 먼저 트리 전환 (template element + Virtualizer), 7 Family A 컴포넌트는 별도 ADR
- 위험:
  - 기술 LOW
  - 성능 LOW
  - 유지보수 **HIGH** — 동일 RAC 패턴 Family A 8 컴포넌트를 7 ADR fork 시 consolidation burden 누적 + schema 본질 동일성 위반 (memory `feedback-adr-consolidation-burden-not-essence` 적용)
  - 마이그레이션 LOW
- 기각 사유: Family A 8 컴포넌트가 같은 RAC dynamic collection 패턴 (`createLeafComponent` + `CollectionBuilder` + `Virtualizer`) 을 공유 — schema 본질 동일. ADR fork = consolidation-burden 회피 동기, 본질 동일성 vs fork burden trade-off 에서 본질 우선

### Risk Threshold Check

| 대안 | 기술  | 성능  | 유지보수 | 마이그레이션 | 판정               |
| ---- | :---: | :---: | :------: | :----------: | ------------------ |
| A    |  MED  |  LOW  |   MED    |     MED      | **채택** (HIGH+ 0) |
| B    |  LOW  | **C** |  **C**   |     HIGH     | 즉시 기각          |
| C    | **H** |  LOW  |  **C**   |     MED      | 즉시 기각          |
| D    |  LOW  |  LOW  |  **H**   |     LOW      | HIGH+ 발생 — 기각  |

대안 A 가 유일하게 HIGH+ 0. 루프 종료.

## Decision

대안 A 채택. **Family A 8 컴포넌트** template element SSOT (canonical descendants 진입점) + items props (data layer 보존) + Skia Virtualizer (visible 영역 paint) 3-layer 결합 모델로 일괄 전환. **Family B 3 컴포넌트 (Breadcrumbs / Tabs / Tree)** 는 변경 없이 Phase C verification fixture 만.

### 위험 수용 근거

- **R1 (Virtualizer 통합 누락 시 1000+ row fps 회귀)**: Phase D 가 ADR scope 안 — Family A 대표 perf fixture 측정 후 통과
- **R2 (Family A 8 컴포넌트 phase 별 정리 burden)**: RAC 패턴 동일 → Phase A/B 가 generic 적용. Table Row+Cell 2-level / Menu items SSOT 별 branch 같은 특수 컴포넌트만 별도 phase 분기
- **R3 (`SYNTHETIC_CHILD_PROP_MERGE_TAGS` + Menu 별 branch contract 확장)**: 멤버십 자체 폐기 아님. 멤버는 유지하면서 "자식 props merge + template element 자식 동반" 으로 contract 의미 확장. `buildSpecNodeData.ts` 의 `_hasChildren` 주입 조건만 정밀화 (template element 존재 시 주입, data row 자식 X). Menu 도 동일 정밀화 (별 branch 안)

### 기각된 대안 사유 (요약)

- 대안 B: 성능 CRITICAL — 1000 row → 1000 element fps 폭락
- 대안 C: schema 본질 위반 — canonical descendants 의 element path 전제 깨뜨림
- 대안 D: 유지보수 HIGH — 동일 RAC 패턴 schema 본질 동일성 위반

> 구현 상세: [144-collection-template-element-ssot-breakdown.md](design/144-collection-template-element-ssot-breakdown.md)

## Risks

| ID  | 위험                                                                                             | 심각도 | 대응                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Skia Virtualizer 통합 누락 시 1000+ row fps 회귀 (Family A 8)                                    |  MED   | Phase D 안 회귀 fixture (1000 / 10000 / 100000 row × Family A 대표 — ListBox / Table / Menu / GridList — 60fps + scroll fps) 측정 후 통과 (Round 3 정정 — codex Round 2 M3 G4 under-scoped 반영) |
| R2  | Family A 8 컴포넌트 phase 별 정리 burden 누적                                                    |  MED   | Phase A/B generic, 특수 컴포넌트 (Table / Menu) 만 분기. Phase 0 inventory 로 사전 freeze                                                                                                        |
| R3  | ADR-066/068/073/076 baseline reverse 가 stale 인용 유발                                          |  LOW   | 본문 §Context 에 "Family A 만 patch (전면 reverse 아님)" 명시 — items props SSOT 유지 사실 강조                                                                                                  |
| R4  | canonical descendants path resolver 가 신규 element tree depth 깊어지면 fingerprint 비용 증가    |  LOW   | `computeDescendantsFingerprint` (canonical-resolver.types.ts:39) 가 `@stub Phase 2+` 상태 — stub 해제 후 Phase D 안에서 1000 노드 5 depth 가정으로 측정                                          |
| R5  | Family A factory 자동 자식 생성 시 기존 프로젝트 hydration 회귀 (template element 미존재 → 생성) |  MED   | Phase 0 에 hydration migration helper 추가 (`isLegacyFamilyACollectionWithoutTemplate` 감지 → 1회 template 주입). Family B 는 helper 불필요                                                      |
| R6  | Family B (Breadcrumbs / Tabs / Tree) 가 canonical descendants 와 정합 못 함 가정 결함 위험       |  LOW   | Phase C 안 verification fixture 로 Family B 3 컴포넌트도 reusable / slot / ref / descendants 4 메커니즘 PASS 확인                                                                                |

잔존 HIGH 위험 없음. R1 / R2 / R5 가 Gate G4 / G1 / G0 1:1 매핑. R6 = G3.

## Gates

| Gate | 시점                       | 통과 조건                                                                                                                                                                                                                                                                | 실패 시 대안                                                                                                 |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 (inventory) 완료   | Family A 8 컴포넌트 collection-item 구조 (Table 2-level / Menu items SSOT 별 branch 포함) inventory freeze + Family B 3 컴포넌트 기존 child element 구조 verification baseline + hydration migration helper (Family A 전용) 작성                                         | inventory 누락 시 1.5x scope inflation 위험 — Phase 0 보강 commit                                            |
| G1   | Phase A 완료               | Family A 8 컴포넌트 template element factory 자동 생성 + canonical document 직렬화 PASS                                                                                                                                                                                  | factory 자식 자동 생성 회귀 시 `SHELL_ONLY_CONTAINER_TAGS` ↔ `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버십 재검토 |
| G2   | Phase B 완료               | Family A 8 컴포넌트 부모 spec render.shapes 가 template element style 우선 소비 (cross-check ListBox / Menu / GridList / Table / TagGroup / Toolbar / Select / ComboBox CSS↔Skia 정합)                                                                                   | spec.shapes 가 props.items style 직접 hardcode 시 D3 SSOT 위반 — 정정 후 재진행                              |
| G3   | Phase C 완료               | Family A 8 + Family B 3 = 11 컴포넌트 모두 reusable instance template style override + slot inject + ref reference + descendants override 4 fixture PASS                                                                                                                 | descendants path resolver 가 template element id reference 실패 시 ADR-122 boundary helper 점검              |
| G4   | Phase D 완료               | Family A 대표 4 컴포넌트 (ListBox / Table / Menu / GridList) × {1000 / 10000 / 100000 row} fixture 60fps + viewport scroll fps 회귀 0 측정 + `computeDescendantsFingerprint` stub 해제 후 1000 노드 5 depth fingerprint 비용 측정 (Round 3 정정 — codex Round 2 M3 적용) | Virtualizer 통합 미완성 시 viewport intersection 직접 구현 phase 추가                                        |
| G5   | Phase E (Implemented 승격) | type-check baseline 무증가 + `pnpm test` + cross-check Family A 8 컴포넌트 PASS + CHANGELOG / README 동시 갱신 + drift 14일/100 commits 임계 초과 시 catch-up block 선행 작성 (`.claude/rules/changelog.md` §2 적용)                                                     | 1건이라도 실패 시 Implemented 승격 보류                                                                      |

## Consequences

### Positive

- canonical document SSOT 정합 (ADR-116 / ADR-122 완결성 강화) — Family A collection-item 영역도 canonical SSOT 진입점 보유. Family B 는 이미 정합
- reusable / slot / ref / descendants 4 메커니즘이 Family A collection-item template 에 적용 가능
  - 디자인 도구 사용자가 ListBoxItem default style 변경 → 모든 row 반영
  - slot 으로 ListBoxItem 안에 icon inject
  - ref 로 template reuse (Menu / Select / ComboBox 가 같은 ListBoxItem template 참조)
  - per-instance override (reusable 인스턴스마다 ListBoxItem style 다름)
- ADR-132 `collections.runtimeData` 진입점 보존 — runtime data binding 영향 0
- RAC dynamic collection 정통 패턴 정합 — composition self-contained 발명 회피
- Skia Virtualizer 통합 — Family A 1000만 row 도 viewport paint 만으로 60fps 보장

### Negative

- Family A 8 컴포넌트 phase 별 정리 작업량 (Phase A-E 추정 ~3-5 주, design breakdown 참조 — Round 2 의 11 추정 대비 단축)
- ADR-066 / ADR-068 / ADR-073 / ADR-076 본문에 patch 참조 추가 의무 — `completed/` archive 동기화 + README.md 갱신
- `buildSpecNodeData.SYNTHETIC_CHILD_PROP_MERGE_TAGS` contract 의미 확장 — "`_hasChildren` 차단 + 자식 props merge" 에서 "자식 props merge + template element 자식 동반" 으로 contract 정밀화. Menu items SSOT 별 branch 도 동일 정밀화. 신규 개발자 onboarding 시 contract 학습 비용 증가

## 관련 ADR

- ADR-066 (Tabs items SSOT) — baseline framing reverse 대상 (Family A 분류 시 Tabs 가 Family B 로 재분류됨에 따라 본 ADR scope 외, 단 ADR-066 의 Tab items SSOT 자체는 Family B 의 Tabs 패턴에 흡수됨)
- ADR-068 (Menu items SSOT + MenuItem Spec) — Family A-2 별 branch, baseline framing reverse 대상, patch 참조 추가
- ADR-073 (Select / ComboBox items SSOT) — Family A, baseline framing reverse 대상, patch 참조 추가
- ADR-076 (ListBox items SSOT) — Family A, baseline framing reverse 대상, patch 참조 추가
- ADR-100 (Unified Skia Engine) — Virtualizer Phase D 가 Skia 측 viewport intersection 통합으로 부분 확장
- ADR-112 (Editing Semantics UI 6요소 + Slot section base) — reusable component / slot 추상 base
- ADR-116 / ADR-122 (canonical document SSOT / canonical-only-runtime) — 본 ADR 의 base
- **ADR-132 (`useCollectionData` + `collections.runtimeData`)** — runtime data layer 진입점 보존 (Round 3 정정 — terminology 정합)

## 사용자 explicit confirm

- 2026-05-27 — 사용자가 본 framing 4 질문 통과 후 "ADR 작성해 144번 순서일것이다" 명시 신호 (memory `feedback-describe-vs-prescribe-separation` 통과)
- 2026-05-27 — Round 2 정정: 사용자 "리뷰내용 수정 반영해" 명시 신호 후 review-adr Round 1 발견 8 이슈 (HIGH 1 / MED 4 / LOW 3) 반영
- 2026-05-27 — Round 3 정정: 사용자 "결함부분 수정반영해" 명시 신호 후 codex Round 2 발견 신규 3 이슈 (HIGH 1 scope-evidence mismatch / MED 1 ADR-132 terminology drift / MED 1 G4 perf gate under-scoped) 반영

진행 단계는 Phase 0 inventory 부터 — 사용자 별도 신호 ("Phase 0 진행해" 등) 후 실행.

## Round 3 정정 이력 (2026-05-27, codex Round 2 독립 리뷰 반영)

| 등급 | ID       | 정정 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :--: | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH | codex-H1 | scope-evidence mismatch — 11 컴포넌트 일반화 ("props.items composite + element tree item 없음") 해체. Family A 8 (template 부재, 본 ADR 적용) + Family B 3 (template 존재, verification only) 로 재분류. Breadcrumbs (`Breadcrumb` child 자동 생성, spec `children-manager`) + Tree (`TreeItem` child 가 행 렌더) + Tabs (`TabList`/`Tab`/`TabPanels` child 자동 생성) 가 Family B 로 이동 — 본 ADR 적용 대상 아님. §Context 갈래 테이블 / Alternatives 위험 / Decision / Risks / Gates 전수 동기화 |
| MED  | codex-M2 | ADR-132 terminology drift — `data_tables.runtimeData` → `collections.runtimeData` 전수 정정 (ADR-132 가 `data_tables → collections` rename Implemented). Hard constraint / 대안 A 외부 reference / Consequences / 관련 ADR 4 곳 정합                                                                                                                                                                                                                                                                |
| MED  | codex-M3 | G4 perf gate under-scoped — ListBox fixture 만 → Family A 대표 4 컴포넌트 (ListBox / Table / Menu / GridList) × {1000 / 10000 / 100000 row} fixture 로 확장. R1 위험 대응 동기화                                                                                                                                                                                                                                                                                                                    |

## Round 2 정정 이력 (2026-05-27, Claude review-adr Round 1 반영)

| 등급 | ID  | 정정 내용                                                                                                                                     |
| :--: | --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH | H1  | scope freeze — "9 컴포넌트" → "11 컴포넌트 (SYNTHETIC 10 + Menu items SSOT 별 branch 1)" (Round 3 에서 Family A 8 + Family B 3 으로 재정밀화) |
| MED  | M1  | ADR-138 (Component Palette Reusable) 인용 mismatch → ADR-112 / ADR-116 / ADR-122                                                              |
| MED  | M2  | 메모리 link 5건 모두 inline 인용                                                                                                              |
| MED  | M3  | R4 대응에 "computeDescendantsFingerprint stub 해제 후 Phase D 측정" timing 명시                                                               |
| MED  | M4  | Menu items SSOT (ADR-068) 별 branch 처리 방식 명시                                                                                            |
| LOW  | L1  | design breakdown §A factory 경로 glob 정밀화                                                                                                  |
| LOW  | L2  | 대안 D 의 "본질 동일성 위반" 을 유지보수 HIGH 4축 안 재분류                                                                                   |
| LOW  | L3  | Gate G5 에 CHANGELOG drift catch-up 의무 명시                                                                                                 |
