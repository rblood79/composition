# ADR-903: ref/descendants + slot 기본 composition 포맷 전환 계획

## Status

Implemented — 2026-04-26 (Phase 0/1/2 완결 + Phase 3 G3 (a)/(e) + IndexedDB schema 자동 migration write-through 완결. G3 (b)/(c)/(d) Layout/Slot 시스템 frameset 재구성 + G4 Editing Semantics UI 5요소 + G5 (b)~(f) `tag → type` rename + hybrid 6 필드 cleanup + imports/DesignKit 통합 = **신규 ADR 로 분리** — 본 ADR 의 핵심 (canonical document migration + resolver 공통화 + IndexedDB schema 자동 migration) 은 완결)

### 진행 로그

- 2026-04-26: **옵션 C default 활성화** — Preview canonical render path 가 production 에서 default 동작 (PR #227 `feat/adr-903-canonical-default` 머지, commit `db462688`). P2 옵션 C completion = P3-D 진입 hard precondition 충족 (sub-breakdown §결정 4 / phase3d-runtime-breakdown.md §P3-D 의존성). P2 dev 비교 로그 정리 (PR #226 `chore/adr-903-revert-debug-logs`, commit `377e5980`) → console drift 0.
- 2026-04-26: **P3-D-3 GREEN 마감** — `layoutActions` canonical 전환 완료 (commit `109af146`, PR #234). `createGetLayoutSlotsAction` 의 `elements.filter(layout_id)` 패턴 → `selectCanonicalDocument(state, pages, layouts).children` 의 reusable `FrameNode` 직접 lookup 으로 전환. `createDeleteLayoutAction` cascade 진입 전 canonical guard 추가. vitest layoutActions 6/6 PASS.
- 2026-04-26: **P3-D-4 Phase A/B/C land** — workflow renderer 정합화 3 phase 완결 (세션 30~31). Phase C minimal stub land 후 PR 모두 머지.
- 2026-04-26: **P3-D-5 6/6 종결** — BuilderCore + workspace canvas 영역 canonical 전환 (세션 33). Step 1~5d (indirection layer + workflow edges 경로 fully canonical, 8 commits) + Step 5e (BuilderCore L283/L457 + useCanvasDragDropHelpers 3 분기 caller doc 전수 도입, 3 commits) + Step 5f (LayoutGroup schema 변경 NOOP, 분석 only — `getLegacyPageLayoutId` prefix stripping 으로 이미 canonical 호환 입증). **5/5 caller chain fully canonical**. 회귀 위험 0 (type-check 3/3 + integration test 43/43). 미머지 PR 잔여: P3-D-1 (factory ownership) / P3-D-2 (elementCreation canonical context). 진행도 ~98% (옵션 C default + P3-D-3/D-4/D-5 land, P3-D-1/D-2 머지 + Phase C 정합화 후 ~99%, RC-2 검증 + Implemented 승격 가능 시점).
- 2026-04-26: **P3-D-4 Phase C 정합화 plan land** (PR #238 머지, commit `e5cbc148`). `usePageManager.ts` 의 minimal stub (L516-527) 정합화 4-step 분해 (C-1 helper 추출 → C-2 DB 조회 통합 → C-3 중복 제거 → C-4 cleanup). 선행 의존: P3-D-1 머지. 회귀 위험 MED. 위치: `docs/adr/design/903-p3d4-phase-c-residual.md` (336 LOC).
- 2026-04-26: **P3-E persistence sub-breakdown plan land** (commit `84da7f32`, 직접 main commit). IndexedDB schema 마이그레이션 6-step 분해 (E-1 `_meta` stub → E-2 backup → E-3 migration dry-run + 50+ fixture → E-4 진입조건 → E-5 dev warning → E-6 write-through). 결정 3 채택 (`_meta` object store + backupKey, DB_VERSION 7→8). 안전망 3중 (IndexedDB ACID + localStorage backup + schemaVersion fallback). G5 (b)(c) land 매핑. 위치: `docs/adr/design/903-phase3e-persistence-breakdown.md` (620 LOC).
- 2026-04-26: **잔여 grep audit 2026-04-26 land** (commit `c0afc071`, 직접 main commit). 9 grep pattern 측정 결과 — `layout_id`/`page_id` 직접 비교 73 건 모두 adapter/bridge 내부 격리 (회귀 위험 0). G3 (c) 60% 완료 (15 파일 → canonical bridge), G5 (b) baseline 832 ref non-adapter. **재설계 필요 카테고리 = 0** (회귀 위험 LOW). **P3-E 진입 가능 = YES** / Phase 4 진입 가능 = CONDITIONAL (P3 G3 통과 후). 위치: `docs/adr/design/903-residual-grep-audit-2026-04-26.md` (536 LOC).
- 2026-04-26: **Phase 4 G4 sub-breakdown 검증** — agent dispatch 결과 기존 `903-phase4-editing-semantics-breakdown.md` (637 LOC, 2026-04-25) 가 이미 7 요구사항 baseline + P4-A~F 6 sub-phase 분할 + Sub-Gate G4-A~G4-F 모두 cover 확증. 신규 plan 작성 불필요 (중복 회피).
- 2026-04-26: **P3-D-2 GREEN land** (cherry-pick 3 commits `98565c32`/`4c374600`/`9b02ae45`, 직접 main commit). `elementCreation.ts` canonical parent context 전환 완료 — RED 14 actual test (494 LOC) + RED 재구성 + GREEN 구현 (97 LOC change). vitest 57/57 PASS (신규 14 + integration 43). type-check 3/3 PASS. **P3-D-1 은 이전 세션에 이미 main merged 상태 확증** (`merge-base = HEAD` 검증). P3-D 6 sub-phase 중 D-1/D-2/D-3/D-4/D-5 모두 land 완료, **Phase C 정합화 진입 가능**. ADR-903 진행도 ~98% → ~99%.
- 2026-04-26: **P3-E E-1~E-5 main land** (PR #239/#240/#241 + 직접 commit, 세션 33~34). `_meta` object store + `MetaRecord` 타입 (E-1) → `createMigrationBackup` localStorage backup (E-2) → `runLegacyToCanonicalMigration` dry-run + 50+ fixture round-trip (E-3, 60/60 GREEN) → `initializeProject` migration entry 연결 dry-run (E-4) → `getByLayout` dev console.warn + utils TODO 주석 (E-5). 모두 read-only 단계. ADR-903 진행도 ~99% → ~99.9%.
- 2026-04-26: **P3-E E-6 main land** (PR #242 머지 `1f74ea9a`, 세션 35). `runLegacyToCanonicalMigration` write-through 활성화 (`dryRun=false` 시 `elements.updateMany` + `meta.set("composition-1.0")` / 실패 시 `meta.set("legacy")` + console.warn fallback) + `getByLayout` canonical strict (composition-1.0 record 1건 이상 시 빈 배열) + utils canonical 전환 (`elementUtils.findLayoutBodyElement` → `frameNodeIdForLegacyLayout(layoutId, doc)` wrapper + parent_id 매칭 / `findUrlConflict` dead code 제거) + caller chain doc 4단 도입 (`ComponentCreationContext.doc` 필수 → `ComponentFactory.createComplexComponent` → `useElementCreator.handleAddElement` → `ComponentsPanel.tsx` 가 `selectCanonicalDocument` 호출) + G3-E grep 명령 보완 (`createIndex`/`indexNames`/`getAllByIndex` 인자 = P5-C 영역 분리 명문화). 검증: type-check 3/3 + 변경영역 vitest 170/170 + E-1~E-6 7 test files 90/90 GREEN + G3-E grep (보완 명령) **0건**. **P3-E 6/6 sub-phase 완결** — ADR-903 진행도 ~99.9% → **~100%** (dev 환경 수동 검증 + Implemented 승격 대기).
- 2026-04-26: **P3-E E-6 후속 sweep main land** (PR #244 머지 `c7ac3cf1`, 세션 35 추가). 본 ADR scope 의 layout_id 매칭 잔여 caller 중 helper 단순 교체 가능한 3 영역 정합화 — `ComponentsPanel.tsx` (panel UI 진입점), `ElementSlotSelector.tsx` (Slot 선택 UI), `LayoutPresetSelector/usePresetApply.ts` (프리셋 적용) — 모두 `belongsToLegacyLayout(el, layoutId, doc)` helper (P3-D-5 step 5c 도입) 로 전환. 회귀 위험 0 (helper legacy fallback 보존). 검증: type-check 3/3 PASS.
- 2026-04-26: **ADR-903 Status `Accepted → Implemented` 승격** (세션 35 종결). Phase 0/1/2 완결 + Phase 3 (a)/(e) + IndexedDB schema 자동 migration write-through 완결. **잔여 영역 = 신규 ADR 로 분리**:
  - **G3 (b)/(c)/(d) Layout/Slot 시스템 frameset 재구성** — 기존 `LayoutsTab` → `FramesTab` 재설계 + repo-wide 결합 해체 + frame authoring UI 치환 + 잔여 layout_id caller (FramesTab/layoutActions/usePageManager/PageLayoutSelector) → **신규 ADR (Layout/frameset 완전 재설계, pencil app 호환)** 로 흡수. 사용자 결정: "변경 format 에 맞게 (pencil app 과 동일하게) 완전 재설계"
  - **G4 Editing Semantics UI 5요소** — reusable/ref/override 시각 마커 3종 + 양방향 탐색 + detach UI + resetDescendantsOverride + "N개 인스턴스 영향" 미리보기 → 별도 ADR (design 문서 `903-phase4-editing-semantics-breakdown.md` 그대로 활용)
  - **G5 (b)/(c)/(d)/(e)/(f) `tag → type` rename + hybrid 6 필드 cleanup** — 1472 ref / 184 파일 일괄 rename + roundtrip 검증 + DB schema 전환 → 별도 ADR (design 문서 `903-phase5-persistence-imports-breakdown.md` 의 P5-C 부분)
  - **P5-D/E/F imports resolver + DesignKit 통합** — 외부 `.pen` fetch + ResolverCache + DesignKit 재매핑 → 별도 ADR
- 2026-04-26: **본 ADR 의 종결 scope** = (1) canonical document 타입 + adapter 계약 land (G1) (2) Resolver 공통화 + 옵션 C default (G2) (3) frameset → reusable/ref/slot 표현 가능성 + preview/persistence sync (G3 a/e) (4) IndexedDB schema 자동 migration write-through (G5 a). 4가지 core 가 완결됨. 잔여 4개 영역은 **별도 ADR 로 supersede 분할 land** 예정.
- 2026-04-28: **P3-E follow-up — `getByLayout` 7 caller canonical 마이그레이션** (직접 main commit, 세션 46). P3-E E-6 의 `getByLayout` canonical strict (composition-1.0 record 시 빈 배열) 가 caller migration 압박으로 land 됐으나, 7 live caller (`BuilderCore.tsx:283` / `FramesTab.tsx:146,240` / `dashboard/index.tsx:381` / `utils/projectSync.ts:219` / `usePageManager.ts:207` / `PageLayoutSelector.tsx:109`) 가 마이그레이션되지 않은 채 ADR-903 Implemented 종결. **사용자 dev 환경에서 시각 회귀 발견**: layout preset 선택 시 영역 구분 slot 들이 Skia 캔버스에 미렌더 (composition-1.0 프로젝트에서 `getByLayout` 빈 배열 → element 미로드 → bounds map 부재 → Skia 무시). 본 land = `adapter.ts` 에 신규 API `getDescendants(parentId)` 추가 (BFS `parent_id` index 재귀, 순환 방지) + `types.ts` 인터페이스 시그니처 추가 + 7 caller 일괄 교체. canonical-pre-1.0 / 1.0 / 1.1 모두 동일 결과 보장. 검증: type-check 3/3 PASS (FULL TURBO) + Builder dev runtime store evidence (Slot 3 등록 확증). **ADR framing 정정**: 본 회귀가 ADR-111 monitoring 차단으로 인식됐으나 실제는 ADR-903 P3-E caller migration 잔존 작업 — ADR-111 frame.children 정규화와 schema 직교. ADR-113 Step 4-4 의 "ADR-111 monitoring 후" marker 도 schema 직교성 재검토 가능.

## Context

composition은 현재 Builder(Skia)와 Preview/Publish(DOM + CSS, React Aria Components 기반)라는 두 렌더 경로를 가진다. [ADR-063](./063-ssot-chain-charter.md)은 이 둘의 **컴포넌트 렌더링 SSOT 체인**을 D1(RAC DOM/접근성) / D2(RSP Props/API) / D3(Spec 시각)으로 정립했지만, **page/layout/document composition 포맷**과 **컴포넌트 재사용 문법**은 아직 단일 정본으로 정리되지 않았다.

### Domain (SSOT 체인 - [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **없음** - 본 ADR은 D1/D2/D3 상위에 위치하는 **문서 구조 / composition source model** 결정이다.
- **D1/D2/D3와의 관계**: `reusable: true + type:"ref" + descendants + slot` 포맷은 페이지/레이아웃/재사용 구조를 정의하고, 그 결과로 생성된 `resolved tree`가 D1/D2/D3 체인을 거쳐 Builder/Preview/Publish에 소비된다.
- **경계 정당화**: 본 ADR은 RAC DOM 구조나 RSP Props 계약, Spec 시각 정의를 직접 바꾸지 않는다. 대신 그들이 소비하는 상위 구조 포맷과 resolver를 정의한다.

### 문제

현재 구조는 composition source format이 **하이브리드**다.

1. `Element` 레코드는 `parent_id`, `page_id`, `layout_id`, `slot_name`, `componentRole`, `masterId`, `overrides`, `descendants`를 함께 가진다 [packages/shared/src/types/element.types.ts](../../packages/shared/src/types/element.types.ts).
2. Layout/Slot은 `tag="Slot"` + `Page.layout_id` + page element `slot_name` 조합으로 별도 해석된다 [apps/builder/src/types/builder/layout.types.ts](../../apps/builder/src/types/builder/layout.types.ts).
3. Preview는 `resolveLayoutForPage()`로 layout-slot 합성을 수행하지만 [apps/builder/src/preview/utils/layoutResolver.ts](../../apps/builder/src/preview/utils/layoutResolver.ts), Skia 경로는 `useResolvedElement()`에서 instance root props만 병합한다 [apps/builder/src/builder/workspace/canvas/sprites/useResolvedElement.ts](../../apps/builder/src/builder/workspace/canvas/sprites/useResolvedElement.ts).
4. `descendants`는 타입과 유틸은 있으나 실제 공통 resolved-tree 파이프라인에 정착하지 못했다 [apps/builder/src/utils/component/instanceResolver.ts](../../apps/builder/src/utils/component/instanceResolver.ts).
5. frameset 성격의 반복 레이아웃은 `layoutTemplates`와 현재 layout/slot 시스템으로 표현되지만 [apps/builder/src/builder/templates/layoutTemplates.ts](../../apps/builder/src/builder/templates/layoutTemplates.ts), 기본 포맷 자체가 ref/slot-aware 하지는 않다.

### Hybrid 필드 사용 현황 (수량)

2026-04-22 기준 `apps/builder/src/` + `packages/shared/src/` 내 `.ts`/`.tsx` 코드베이스 grep 결과:

| 필드                       | 참조 건수 |     참조 파일 수 | 비고                                                                                                                                 |
| -------------------------- | --------: | ---------------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `tag` (노드 discriminator) |  **1031** |          **154** | pencil 공식 `type` 으로 **단일화 rename 대상** (매핑 아닌 직접 rename). 2026-04-22 재측정 (최초 기록 1026 에서 5 건 증가)            |
| `layout_id`                |       258 |               53 | adapter 전환                                                                                                                         |
| `masterId`                 |        55 |               13 | adapter 전환                                                                                                                         |
| `componentRole`            |        41 |               12 | adapter 전환                                                                                                                         |
| `descendants`              |        39 |               15 | key runtime UUID → stable id path 재정의                                                                                             |
| `slot_name`                |        25 |               12 | adapter 전환                                                                                                                         |
| `overrides`                |        23 |                9 | adapter 전환                                                                                                                         |
| **hybrid 전체 합**         |  **1472** | **184 (unique)** | tag 1031 + 기존 hybrid 6필드 441 (2026-04-22 Round 12 실측 재측정 — 154 는 tag 단독 파일 수 였던 것이 합집합으로 오기재된 것을 정정) |

- `apps/builder/src/preview/App.tsx` 단일 파일에 hybrid 분기 **12건** (layout_id 6회 + slot_name 6회)
- `apps/builder/src/builder/templates/layoutTemplates.ts` 에 `tag="Slot"` / `slot_name` 선언 **28건**
- **`Element.tag` → `Element.type` 단일화**: pencil.dev 공식 schema 와의 field-name 정합을 위한 **직접 rename** (매핑 테이블 행 아님). 1031 참조 / 154 파일 규모 (2026-04-22 실측) — canonical 전환에서 가장 큰 단일 작업
- 즉 canonical format 전환 시 **참조 1472건 / unique 184 파일 (tag + hybrid 6 합집합) / Slot template 선언 28건** 이 rename 또는 adapter 대상이다. 세부 내역: tag 단독 1031 ref / 154 파일 + hybrid 6필드 441 ref / 76 파일 + 합집합 184 파일. 정확한 재측정 명령은 아래 "정량 Gate 측정 명령 표" §M1·M4·M4b·M4c 참조

이 상태를 유지하면 다음 문제가 계속 남는다.

- **포맷 이중화**: 일반 element tree / layout-slot / master-instance가 서로 다른 문법으로 공존
- **resolver 이중화**: Preview와 Skia가 동일 source를 동일 방식으로 해석하지 못함
- **frameset 특수화**: 반복 레이아웃을 기본 composition 문법이 아니라 예외 기능으로 유지
- **컴포넌트 모델 비선언성**: 재사용 컴포넌트가 문서 자체의 문법(`reusable`, `ref`, `descendants`)이 아니라 `componentRole/masterId` 메타필드 조합으로 표현됨
- **slot 의도 비가시성**: "이 영역은 교체 가능한 컨텐츠 홀더"라는 의도가 포맷 레벨 속성이 아니라 런타임 규칙과 에디터 로직에 숨어 있음
- **편집 semantics 불일치**: copy/paste, detach, delete, duplicate, slot assign 규칙이 포맷 단일성 없이 파편화

Pencil의 `.pen` 포맷은 이 지점에서 더 선언적이다. 공식 문서는 재사용 컴포넌트를 `reusable: true`로 선언하고, 인스턴스를 `type:"ref"`로 만들며, `descendants`에서 `ok-button/label` 같은 경로로 중첩 자식을 정밀 오버라이드하거나 `children` 교체를 수행한다고 설명한다. 또한 `slot`은 특정 컨테이너가 children 교체를 의도한 자리라는 점과 추천 가능한 reusable component ID 목록까지 문서 스키마에 직접 담는다. composition이 이 방향으로 전환한다면, 포맷 전환은 곧 **컴포넌트 재사용 모델 전환**을 의미한다. [The .pen Format](https://docs.pencil.dev/for-developers/the-pen-format), [.pen Files](https://docs.pencil.dev/core-concepts/pen-files)

### NodesPanel Layout(Frame) 기능의 역사적 맥락

현재 composition `NodesPanel > LayoutsTab` ([apps/builder/src/builder/panels/nodes/LayoutsTab/LayoutsTab.tsx](../../apps/builder/src/builder/panels/nodes/LayoutsTab/LayoutsTab.tsx))의 "Layout 생성/편집" 기능은 **CSS/DOM 기반 빌더 시대에 만든 시스템**이다. 당시 전제는:

- Builder와 Preview가 모두 CSS 렌더러여서, 페이지 간 공통 layout shell을 재사용하려면 **DB 레벨 `layout_id` 외래키**와 **tag="Slot"** 특수 element 를 도입해야 했다
- `LayoutsTab.createLayout` / `LayoutBodyEditor` / `LayoutSlugEditor` / `LayoutPresetSelector` / `ExistingSlotDialog` / `ElementSlotSelector` 는 모두 이 CSS 시대의 layout-vs-page 이원화 모델에 맞춘 UI 다
- `useLayoutsStore` 는 `layouts[]` 를 `elements[]` 와 분리 저장하는 2-table 스토어로 설계되어 있다

현재 composition은 Builder 를 **Skia/WebGL** 로 전환 중이며 (ADR-100 Unified Skia Engine land 완료), canonical composition format 도입 후에는 **"layout" 이 별도 개념이 아니라 `reusable frame` (pencil `type:"frame"` + `reusable: true` + `slot`) 의 한 사례**가 된다. 즉 pencil 의 "반복되는 layout = reusable frame" 은 composition 의 CSS 시대 `layout_id/slot` 시스템을 **기능 측면에서 완전히 포섭**한다.

따라서 본 ADR 은 단순히 `layout_id` 를 adapter 로 감싸는 것이 아니라, **NodesPanel Layout UI 자체를 `reusable frame authoring UI` 로 재설계**하여 CSS 시대 산물을 Skia 시대의 canonical frame 모델로 승격한다. 기능 상실 없음 — 모든 기존 layout 기능(공통 shell 재사용, slot 지정, page 별 content 채우기) 은 canonical `reusable + ref + slot + descendants[slotPath].children` 조합으로 1:1 대응된다.

### pencil `.pen` schema 커버리지 범위

pencil 공식 `.pen` schema 는 (a) document-level (`version`/`themes`/`imports`/`variables`/`children`) (b) entity-level 공통 필드 (`id`/`name`/`context`/`metadata`/`rotation`/`opacity`/`flipX/Y`/`enabled`/`theme`/`layoutPosition`) (c) primitive type 13종 (`rectangle`/`ellipse`/`line`/`polygon`/`path`/`text`/`note`/`prompt`/`context`/`icon_font`/`frame`/`group`/`ref`) (d) Fill/Stroke/Effect/Shape/Text/Flexbox/IconFont 별 상세 필드 로 구성된다. 본 ADR 은 **전체 schema 중 구조적 뼈대만 1차 채택**하고, 상세 시각 필드(Fill 4종 / Stroke detail / Effect / Blend mode 18종 / mesh_gradient 등) 는 D3 (Spec) 경계 안에서 후속 결정한다.

### composition tag vocabulary 와 pencil type vocabulary 관계 (결정)

pencil 은 **primitive-centric** (`rectangle`/`ellipse`/`text`/`path` 등 저수준 도형) 이고 composition 은 **component-centric** (`Button`/`Card`/`TextField` 등 116개 고수준 컴포넌트 + Spec 기반 Skia 렌더) 이다. 두 vocabulary 가 같은 `type` 필드를 공유할 때 관계를 아래와 같이 **확정**한다:

- **canonical `Element.type` 의 값 공간 = composition Component vocabulary (116) + pencil 공용 구조 타입 3개 (`ref`, `frame`, `group`)**
- **pencil primitive 10종 (`rectangle`/`ellipse`/`line`/`polygon`/`path`/`text`/`note`/`prompt`/`context`/`icon_font`)** 은 composition canonical 에 **직접 값으로 등장하지 않음**. composition 의 component 가 이미 primitive 를 Spec (D3) 로 정의하고 Skia 로 렌더하는 layer 를 내장하기 때문.
- **pencil `.pen` 파일 import** 시에는 **import adapter** 가 primitive → 가장 가까운 composition component 로 매핑 (예: `rectangle` → `Card`/`frame` 변형, `text` → `Text` component, `icon_font` → `Icon` component). 매핑 불가 primitive 는 `frame` + 해당 시각 속성으로 fallback.
- **pencil `.pen` 파일 export** 시에는 **export adapter** 가 composition component → pencil primitive 조합으로 converter. 표준 pencil 뷰어가 읽을 수 있는 수준의 시각 근사 유지.
- 즉 **composition canonical 은 pencil schema 의 "superset 도 subset 도 아니며, 필드명 정합 + 구조 정합 + adapter 경유 변환 호환"** 성격. pencil-native 1:1 호환이 목표 아님, 대신 필드명/구조 일치로 미래 연동 가능성 확보.

### Hard Constraints

1. **렌더 결과 보존** - 기존 Preview/Publish와 Builder(Skia)의 시각 회귀를 허용하지 않는다. 최종 전환 시 기존 주요 레이아웃/페이지 기준 회귀 0건이어야 한다.
2. **점진 전환 가능** - 기존 IndexedDB/스토어 기반 프로젝트를 한 번에 재직렬화하지 않고, adapter 경로로 단계적 마이그레이션이 가능해야 한다.
3. **단일 resolver** - 최종적으로 `ref resolve -> descendants apply -> slot contract validate -> resolved tree` 순서의 공통 해석 파이프라인 1개만 유지한다. legacy `slot_name` 기반 입력은 resolver 진입 전에 canonical descendants/slot 형태로 정규화한다.
4. **편집 성능 유지** - Builder 편집 경로는 현 수준의 반응성을 유지해야 한다. 전환 과정에서 copy/paste/drag/selection이 체감 저하를 만들면 안 된다.
5. **ADR-063 비침범** - D1(RAC), D2(RSP), D3(Spec) 권한 경계를 건드리지 않는다.
6. **하위 호환 롤백 가능** - 각 Phase는 feature flag 또는 adapter 경로로 되돌릴 수 있어야 한다.
7. **문서-네이티브 컴포넌트 재사용** - 재사용 컴포넌트는 `componentRole/masterId` 메타필드가 아니라 `reusable: true`, `type:"ref"`, path-based `descendants`로 표현되어야 한다.
8. **포맷 레벨 slot 선언** - slot은 별도 `Slot` 노드 특수처리가 아니라 컨테이너의 schema 속성으로 존재해야 하며, 필요 시 추천 가능한 reusable component ID 목록을 담을 수 있어야 한다.
9. **NodesPanel Layout(Frame) UI 재구현** - CSS 시대 산물인 `LayoutsTab.createLayout` / `LayoutBodyEditor` / `LayoutSlugEditor` / `LayoutPresetSelector` / `ElementSlotSelector` 등 layout-vs-page 이원화 UI 를 **canonical `reusable frame authoring UI`** 로 재설계한다. `useLayoutsStore` 의 `layouts[]` 별도 저장도 canonical document tree 내부 `reusable: true` 노드로 흡수한다. 기능 상실 없음 — 공통 shell 재사용 / slot 지정 / page 별 content 채우기 모두 `reusable + ref + slot + descendants[slotPath].children` 조합으로 1:1 대응.
10. **문서-level 메타 필드 (`version`/`themes`/`imports`/`variables`) + Frame 전용 컨테이너 필드 (`clip`/`placeholder`/`slot`) 채택** - 단순한 element tree 가 아닌 pencil-정합 문서 schema:
    - **`version: string`** (문서 root 필수). **`composition-*` 네임스페이스로 고정**. 초기값 `"composition-1.0"`. pencil `"2.10"` 네임스페이스는 **금지** — composition canonical 은 pencil 과 1:1 호환이 아닌 adapter 기반 변환 포맷이므로 pencil 버전 문자열을 공유하면 외부 도구가 pencil 파일로 오인하여 잘못된 파서로 열 위험이 있음. breaking change 시 `"composition-2.0"` 처럼 major 증가, additive 변경 시 `"composition-1.1"` 처럼 minor 증가. read-through adapter 는 `version` 접두사 (`composition-`) 검사 후 migration 경로 선택
    - **`themes?: {[key: string]: string[]}`** (문서 root). composition 기존 ADR-021 Theme 시스템(Tint / dark mode) 을 canonical `themes` 축 선언으로 투영. 엔티티 level `theme?` override 지원은 Phase 별 단계 land. **구현 phase 및 read-only adapter → write-through 전환 계획: [ADR-110](110-canonical-themes-variables-land-plan.md)**
    - **`variables?: {[key: string]: VariableDefinition}`** (문서 root). composition 기존 Spec TokenRef + `variableBindings?: string[]` (element.types.ts:105) 을 canonical `variables` 와 `NumberOrVariable`/`StringOrVariable`/`ColorOrVariable` 참조 문법으로 투영. 기존 CSS 변수 체계(ADR-022)는 `variables` output 으로 자동 emit. **구현 phase 및 resolver 통합 계획: [ADR-110](110-canonical-themes-variables-land-plan.md)**
    - **`imports?: {[key: string]: string}`** (문서 root). **참조형 import hook** — 외부 `.pen` 또는 canonical 문서 파일을 URL/path 로 참조하고 해당 문서의 reusable 노드를 `ref: "<importKey>:<nodeId>"` 로 인스턴스화. **실제 구현은 Phase 5 이후 연기** (스텁 타입만 P0 에 land). composition 기존 DesignKit `kitLoader.ts`/`kitExporter.ts` 는 **참조형 import 가 아니라 복사-적용 파이프라인** (`kitLoader.ts:259` `localId → new UUID` 재발급 + 프로젝트 삽입 / `kitExporter.ts:33` snapshot JSON export) 이므로 canonical `imports` 와 의미가 다르다. DesignKit 은 **별도 migration track** 으로 분리 — 본 ADR 의 canonical 전환과 독립적으로 유지되며, 향후 참조형 import 모델과 통합할지 여부는 별도 ADR 에서 결정
    - **Frame 전용 `clip?: BooleanOrVariable`** — children clipping (현재 composition 의 `overflow: hidden` 과 매핑)
    - **Frame 전용 `placeholder?: boolean`** — empty frame UI hint (P0 에서 composition 의 기존 빈 컨테이너 스타일과 매핑)
    - **엔티티 공통 `name?: string` + `metadata?: { type: string; [key]: any }`** — reusable 전용이 아닌 모든 노드에 사용자 표시 이름 + extensibility hook 제공. composition 기존 `componentName` 은 `name` 으로 rename 또는 `metadata.componentName` 으로 이관
11. **원본/인스턴스/override UI-UX 가시성** - pencil/Figma 류 디자인 툴과 동등한 **문서-네이티브 재사용 모델 UX** 를 제공한다. 구체 요구:
    - **원본 노드 시각 마커** — `reusable: true` 노드를 LayerTree / Canvas / DesignKit 패널에서 고유 아이콘/색상/라벨(`componentName`)로 표시. 일반 노드와 1-glance 구분
    - **인스턴스 노드 시각 마커** — `type:"ref"` 노드를 별도 마커(예: link 아이콘 + 원본 참조 표시) 로 표시. 인스턴스임을 즉시 인지 가능
    - **override 노드 시각 마커** — `descendants[path]` 에 의해 override 된 자식 노드는 별도 마커(예: dot 또는 색상 변화)로 "원본과 다름" 표시
    - **원본-인스턴스 탐색 액션** — 인스턴스 컨텍스트에서 "원본으로 이동" / 원본 컨텍스트에서 "이 원본을 사용하는 모든 인스턴스 보기" 양방향 탐색 UI
    - **`detachInstance` semantics 재구현 + UI 액션** — 현재 구현 (`instanceActions.ts:80`) 은 **루트 instance 의 props 만 병합 + `componentRole`/`masterId`/`overrides`/`descendants` 메타필드 제거** 로 끝남 (라인 121 ADR-040 주석 "props 변환만 → 구조 불변" 확증). 구조 materialize 와 자식 subtree 복제는 **미구현**. 또한 현재 descendants 는 `instanceResolver.ts:81` 에서 child ID (runtime UUID) 기반 조회. canonical 전환 시 (a) **subtree materialize** — ref 해제 후 master 의 자식 subtree 를 instance 하위로 실제 복제 + 새 id 재발급 (b) **path-based descendants 적용** — child ID 가 아닌 stable id path 기반 override 적용 (c) UI 액션 연결 — 우클릭 메뉴 + 단축키 + Properties 패널 + 경고 다이얼로그 ("원본 연결이 끊기며 이후 원본 변경이 반영되지 않음"). 즉 이것은 **UI 연결** 이 아니라 **새 detach semantics 구현** 이다
    - **override reset/revert 액션** — 현재 코드베이스에 0건 구현. `resetDescendantsOverride(instanceId, path)` 및 전체 reset 액션 신규 구현. Properties 패널에서 override 된 필드별 "원본으로 복원" 버튼 제공
    - **원본 편집 시 전파 표시** — 원본 편집 중에는 canvas/patch 미리보기로 "N개 인스턴스에 반영됨" 표시. 개별 인스턴스의 override 는 보존됨을 명시

### Soft Constraints

- frameset 기능은 별도 전용 엔진이 아니라 기본 composition 포맷의 한 사례로 흡수한다
- Pencil 유사 문서 모델(`reusable`, `ref`, `descendants`, `slot`)을 참고하되, ADR-063의 RAC/RSP/Spec 체인은 유지한다
- 현재 flat `elements` 저장소와 인덱스는 전환 기간 동안 adapter로 존치 가능하다
- 대규모 빅뱅 재작성보다 resolver-first 전환을 우선한다

## Alternatives Considered

### 대안 A: 문서-네이티브 composition/component 포맷 + resolver-first 점진 마이그레이션

- 설명: 일반 object tree 위에 `reusable: true`, `type:"ref"`, path-based `descendants`, 컨테이너 `slot` 메타데이터를 갖는 **문서-네이티브 canonical format**을 선언하고, 우선 **공통 resolved-tree resolver**를 도입한다. 초기에는 기존 `Element/Page/Layout` 저장 구조를 유지하되 adapter가 신포맷으로 투영한다. 이후 Preview/Skia를 같은 resolved tree에 연결하고, 마지막 단계에서 저장 포맷과 편집 semantics를 점진 전환한다.
- 근거:
  - Pencil 공식 문서는 `.pen`이 object tree 기반 포맷이며 `reusable: true`, `type:"ref"`, `descendants`, `slot`을 문서 핵심 문법으로 사용한다고 설명한다. [The .pen Format](https://docs.pencil.dev/for-developers/the-pen-format)
  - 같은 문서는 `ok-button/label` 같은 descendant path override, descendant node replacement, descendants 하위 `children` 교체, slot 추천 컴포넌트 목록까지 schema 차원에서 다룬다.
  - 현재 composition 코드에서도 layout-slot과 master-instance가 이미 부분 도입되어 있어, 메타필드 중심 모델을 문서 문법으로 승격시키는 편이 자연스럽다.
- 위험:
  - 기술: **MEDIUM** - 기존 flat store와 신포맷 adapter를 일정 기간 병행해야 한다
  - 성능: **LOW** - resolver 캐시/dirty subtree invalidation을 전제로 하면 병목이 구조적으로 줄어든다
  - 유지보수: **LOW** - 최종 상태는 포맷/해석기/렌더러 경계가 가장 단순하다
  - 마이그레이션: **MEDIUM** - editor operations, persistence, import/export를 순차 전환해야 한다

### 대안 B: 저장 포맷, 스토어, 편집기, 렌더러를 한 번에 신포맷으로 빅뱅 교체

- 설명: `Element/Page/Layout` 현재 구조를 빠르게 폐기하고, DB/store/editor/runtime 전체를 새 composition/component 포맷으로 즉시 갈아탄다.
- 근거:
  - 최종 상태에 가장 빨리 도달한다
  - adapter/bridge를 오래 유지하지 않아도 된다
  - 설계 타협 없이 새 문법을 바로 강제할 수 있다
- 위험:
  - 기술: **HIGH** - store, preview, skia, history, import/export, templates, persistence가 동시에 깨질 수 있다
  - 성능: **MEDIUM** - 신 resolver와 편집 연산 성능을 실전 데이터 없이 한 번에 검증해야 한다
  - 유지보수: **MEDIUM** - 초기 구현 속도는 빠르지만 회귀 분석과 디버깅 비용이 급증한다
  - 마이그레이션: **CRITICAL** - 기존 프로젝트/세이브 파일/undo history/복사-붙여넣기 semantics 전체에 직접 충돌한다

### 대안 C: 현재 하이브리드 포맷 유지, frameset만 ref/slot 스타일로 부분 개선

- 설명: 일반 element tree와 master-instance 체계는 유지하고, frameset/layout 관련 기능만 `ref/descendants + slot` 식으로 보강한다.
- 근거:
  - 초기 작업량이 가장 적다
  - 현재 layout/slot 템플릿 자산을 재활용하기 쉽다
  - preview resolver를 크게 흔들지 않고 기능 증설이 가능하다
- 위험:
  - 기술: **LOW** - 단기 구현 난이도는 낮다
  - 성능: **MEDIUM** - Preview/Skia가 서로 다른 resolver를 유지하면 최적화 지점이 분리된다
  - 유지보수: **HIGH** - 포맷 2중화가 영속화되어 frameset, layout, component instance가 영구 예외가 된다
  - 마이그레이션: **LOW** - 기존 프로젝트는 거의 건드리지 않는다

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  M   |  L   |    L     |      M       |     0      |
|  B   |  H   |  M   |    M     |      C       |     2      |
|  C   |  L   |  M   |    H     |      L       |     1      |

- 대안 A는 HIGH 이상이 0개이며, 중간 단계 adapter 비용만 관리하면 된다.
- 대안 B는 `stores/elements`, `preview/utils/layoutResolver`, `workspace/canvas/sprites/useResolvedElement`, persistence/export 경로를 동시에 교체해야 하므로 기술 HIGH + 마이그레이션 CRITICAL이다.
- 대안 C는 단기 안정성은 좋지만 포맷 이중화를 고착화하여 장기 유지보수 HIGH를 남긴다.

**루프 판정**: 대안 A가 유일하게 HIGH+ 0개다. 추가 대안 루프 없이 선택 가능하다.

## Decision

**대안 A: 문서-네이티브 composition/component 포맷 + resolver-first 점진 마이그레이션**을 선택한다.

선택 근거:

1. **문서 포맷 단일화**와 **컴포넌트 재사용 모델 단일화**를 동시에 달성하면서도, 저장 포맷과 편집기를 한 번에 깨지 않는다.
2. `resolved tree`를 먼저 공통화하면 Preview와 Skia가 동일 source를 소비하게 되어, 이후 렌더 회귀를 구조적으로 줄일 수 있다.
3. frameset을 별도 기능이 아니라 `reusable` layout shell + `ref` instance + `descendants` children 교체 + `slot` 선언으로 표현되는 기본 composition 문법의 한 사례로 흡수할 수 있다.
4. slot을 포맷 메타데이터로 승격하면 "교체 가능한 컨텐츠 영역"과 추천 컴포넌트 목록이 문서 스키마에 직접 남는다.
5. ADR-063의 D1/D2/D3 체인을 건드리지 않고, 그 위의 상위 document/component model만 교체할 수 있다.
6. 신포맷 도입 후에도 flat 인덱스/스토어는 캐시/저장 adapter로 존치할 수 있어, 성능과 마이그레이션 리스크를 동시에 제어하기 쉽다.

기각 사유:

- **대안 B 기각**: 최종 상태는 깨끗하지만 코드 경로 동시 교체 범위가 너무 넓다. `packages/shared/src/types/element.types.ts`, `apps/builder/src/preview/utils/layoutResolver.ts`, `apps/builder/src/builder/workspace/canvas/sprites/useResolvedElement.ts`, `apps/builder/src/builder/stores/elements.ts`, persistence/export 경로를 한 번에 바꾸는 것은 마이그레이션 CRITICAL이다.
- **대안 C 기각**: frameset만 신포맷으로 감싸면 기본 문서 포맷과 컴포넌트 재사용 모델은 계속 `componentRole/masterId` 중심 메타체계로 남는다. 이 경우 "새 composition 포맷"이 기본 문법이 아니라 또 다른 예외 기능이 된다.

> 구현 상세: [903-ref-descendants-slot-composition-format-migration-plan-breakdown.md](../design/903-ref-descendants-slot-composition-format-migration-plan-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 기존 `layout_id / slot_name / componentRole / masterId` 하이브리드 필드가 adapter 단계에서 장기간 남아 source-of-truth 혼동을 만들 수 있음                                                                                                                                                                                                                                                                                                          | MEDIUM | Phase 1에서 canonical component grammar(`reusable`, `ref`, `descendants`, `slot`)와 legacy adapter 경계를 문서/타입으로 분리하고, 신규 기능은 canonical format에만 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R2  | Preview와 Skia가 공통 resolver를 소비하기 전까지는 부분 이중화가 남아 회귀 분석 비용이 증가                                                                                                                                                                                                                                                                                                                                                         | MEDIUM | Phase 2를 최우선으로 두어 `resolved tree` 공통 소비를 먼저 완료하고, legacy resolver는 read-only fallback으로 제한                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R3  | `descendants` 타깃을 runtime UUID에서 stable node id/path로 옮길 때 copy/paste, duplicate, detach semantics가 깨질 수 있음                                                                                                                                                                                                                                                                                                                          | MEDIUM | Phase 3에서 id/path remap 규칙과 serialization 규칙을 고정하고, 편집 연산 테스트를 집중 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R4  | DB 저장 포맷 전환을 너무 이르게 시작하면 undo/history/import/export 경로가 동시 회귀할 수 있음                                                                                                                                                                                                                                                                                                                                                      | MEDIUM | 저장 포맷 전환은 마지막 Phase로 미루고, 그 전까지는 adapter 기반 shadow write 또는 read-through만 허용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R5  | `Element.tag` → `Element.type` 단일 rename 규모(1031 참조 / 154 파일, 2026-04-22 실측)에서 부분 누락/typo 발생 시 일부 경로만 canonical `type` 을 기대하게 되어 runtime discriminator 오판(`undefined tag`) 가능                                                                                                                                                                                                                                    | MEDIUM | (a) adapter 입력 지점에서 `tag → type` 정규화를 일방향 1회 수행 (b) TypeScript 타입 정의에서 `tag` 필드 제거하여 compile-time 으로 누락 참조 전량 노출 (c) `ast-grep` 또는 `tsc --noEmit` 기반 자동 rename 도구로 1031 참조 일괄 처리 후 수동 review (d) `DataBinding.type` / `FieldDefinition.type` 과의 구조적 혼동 차단 3중 방어: ① scope 분리 규칙 명문화 (객체 경로 `element.type` vs `element.props.columnMapping.*.type` vs `element.dataBinding.type` 3단계 nesting 격리) ② **TypeScript literal union discriminator** — `Element.type: ComponentTag` (116-literal union) vs `FieldType` (7-literal union) 완전 disjoint 로 정의, 실측 값 공간 교집합 0건 ③ **runtime type guard** `isCanonicalNode(obj): obj is Element` — `type` + `id` + (optional `children`) 조합 체크 도입, tree walker 에서 `if (!isCanonicalNode(child)) continue` 방어 강제 |
| R6  | 원본/인스턴스/override UI-UX 가시성이 **현재 코드베이스에서 대부분 미구현** (grep 실측: LayerTree role 표시 0건 / DesignKit role 마커 0건 / `resetDescendantsOverride` 0건). canonical format 전환 후 사용자가 reusable/ref/override 차이를 인지 못하면 무분별 detach / 의도치 않은 override 덮어쓰기 / 원본 편집 영향 범위 오판 가능                                                                                                               | MEDIUM | (a) Phase 4 범위에 UI/UX 신규 구현 정식 포함 — Hard Constraint #10 5개 요구(시각 마커 3종 + 탐색 액션 + detach UI + override reset + 전파 표시)를 Gate G4 측정 조건으로 박제 (b) 전환 초기에는 canvas 툴팁/패널 배지 같은 **low-friction 마커 우선 도입**, fancy animation 은 후순위 (c) detach/reset override 는 모두 **undo-able** 로 구현, 실수 복구 가능 (d) 원본 편집 전에 "N개 인스턴스 영향" 미리보기 다이얼로그로 사용자 인지 강제                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R7  | DesignKit 을 pencil `imports` 로 재매핑 가능한 참조형 자산으로 혼동하면 **복사-적용 파이프라인과의 의미 차이로 범위 과소평가** 위험. 실측: `kitLoader.ts:259` 는 `localId → new UUID` 재발급 + 프로젝트 삽입, `kitExporter.ts:33` 은 snapshot JSON export. 즉 DesignKit 은 "외부 문서 참조" 가 아니라 "자산 복제". pencil `imports` 와 의미가 다르며, 본 ADR 에 섞어 land 하면 canonical 전환과 DesignKit 재설계가 같은 Gate 로 묶여 실행 누락 가능 | MEDIUM | (a) Hard Constraint #10 `imports` 항목에서 DesignKit 재매핑 삭제, 참조형 hook 스텁만 P0 에 land. 실제 구현은 Phase 5 이후 연기 (b) DesignKit 은 **별도 migration track** 으로 분리. 본 ADR 은 snapshot 파이프라인을 해체하지 않고 canonical format 과 공존시킨다. 향후 참조형 import 모델과 통합 여부는 **별도 ADR** (c) G1/G5 측정 조건에서 DesignKit 파일 (kitLoader/kitExporter/DesignKitPanel) 을 canonical 필수 전환 대상에서 제외 (d) canonical 문서 tree 에 DesignKit 복사본 삽입 시 `metadata.importedFrom: "designkit:<kit-id>"` 로 출처 추적                                                                                                                                                                                                                                                                                                       |

잔존 HIGH 위험 없음.

## Gates

| Gate                         | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                               |
| ---------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| G1: Canonical Format 고정    | Phase 0 완료 | (a) `reusable: true`, `type:"ref"`, `descendants` path/children replacement 규칙, `slot` 메타데이터 및 추천 컴포넌트 목록 규칙, resolver 순서가 ADR + 타입으로 고정됨 (b) **`Element.tag` → `Element.type` 단일화 rename 규칙 고정** (pencil 공식 field name 정합, 매핑 아닌 직접 rename). `DataBinding.type` / `FieldDefinition.type` 은 scope 분리로 그대로 존속 (c) **문서-level 메타 필드 4종 (`version`/`themes`/`imports`/`variables`) 타입 정의 완료** — `version` 은 `composition-*` 네임스페이스 고정 (초기값 `"composition-1.0"`, pencil `"2.10"` 사용 금지), `themes` 는 ADR-021 Theme 매핑, `variables` 는 ADR-022 TokenRef 매핑, `imports` 는 **참조형 hook 스텁만** (DesignKit 복사-적용 파이프라인은 별도 track — R7 참조). 규칙 전부 `composition-document.types.ts` 에 land (d) **Frame 전용 컨테이너 필드 3종 (`clip`/`placeholder`/`slot`) 타입 정의 완료** (e) **`type` 값 공간 policy 확정** — composition Component 116 + pencil 구조 타입 3 (`ref`/`frame`/`group`) 합집합. pencil primitive 10종은 import/export adapter 경유 매핑 규칙 land. `ComponentTag` literal union 정의 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 설계 미완이면 ADR 보강 후 Phase 1 보류                     |
| G2: Resolver 공통화          | Phase 2 완료 | (a) `resolveLayoutForPage()` 및 `useResolvedElement()` 의 legacy 분기 call-site count = 0 (grep 기준 측정) (b) Preview/Skia 양쪽이 canonical resolver 의 `resolved tree` 만 소비 (c) `apps/builder/src/preview/App.tsx` 의 hybrid 12건(layout_id 6 + slot_name 6) 분기 전원 canonical resolver 경유로 치환                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Preview/Skia 중 한 경로라도 미연결이면 adapter 기간 연장   |
| G3: Frameset 흡수            | Phase 3 완료 | (a) 기존 frameset/layout 템플릿이 `reusable` layout shell + `slot` 선언 + `ref` 기반 page instance로 표현되고, 별도 전용 엔진/전용 데이터 규칙이 제거됨 (b) **NodesPanel `LayoutsTab` → `FramesTab` 재설계 완료** — `createLayout` → `createReusableFrame` 전환, `LayoutBodyEditor`/`LayoutSlugEditor`/`LayoutPresetSelector`/`ElementSlotSelector` 가 canonical `ref`/`slot`/`descendants` 직접 조작 (c) **repo-wide 결합 해체** — breakdown "정량 Gate 측정 명령" **§M7** (재귀 grep + include `*.ts`/`*.tsx` + `wc -l`) 결과 = 0 또는 adapter-only 참조만 잔존. 2026-04-22 baseline 355 ref. 명령 전문은 breakdown 참조 — ADR Gate 표 안 inline code 는 markdown pipe 해석으로 깨지므로 본문 중복 금지. 실측된 panel 외부 결합 지점 전부 포함: `main/BuilderCore.tsx:273` (`useLayoutsStore.getState().currentLayoutId`), `hooks/useIframeMessenger.ts:193`(동일),`workspace/canvas/BuilderCanvas.tsx:187` (`useLayoutsStore((s) => s.layouts)`), `components/dialog/AddPageDialog.tsx:52`(동일),`panels/properties/editors/PageLayoutSelector.tsx:27` (`fetchLayouts`포함),`stores/layouts.ts`본체,`stores/utils/layoutActions.ts`, `workspace/canvas/skia/workflowEdges.ts`, `preview/App.tsx`, `preview/router/CanvasRouter.tsx`, `preview/utils/layoutResolver.ts`, `preview/store/types.ts`, `lib/db/indexedDB/adapter.ts`, `inspector/editors/registry.ts`, `utils/urlGenerator.ts`, `utils/element/elementUtils.ts`, `workspace/canvas/hooks/useCanvasDragDropHelpers.ts`, `stores/utils/elementSanitizer.ts`(2026-04-22 실측 panel 외부 38 파일 결합) (d) CSS 시대 layout-vs-page 이원화 UI 전원 canonical frame authoring UI 로 치환 — 기능 상실 0 (공통 shell 재사용 / slot 지정 / page content 채우기 전부 동작) (e) runtime/persistence/preview sync 경로 모두 canonical`ref`/`frame`consumer 로 전환.`useLayoutsStore` 는 Phase 5 G5 완료 시점에 완전 해체 (Phase 3 에서는 adapter-only 로 축소) | layout-slot 어댑터 유지, 전용 기능 신규 추가 금지          |
| G4: Editing Semantics 안정화 | Phase 4 완료 | (a) copy/paste, duplicate, detach, delete, slot assign, undo/redo가 id/path + ref/slot semantics 기준으로 회귀 0건 (b) **원본/인스턴스/override UI-UX 5요소 land 완료** — ① LayerTree/Canvas/DesignKit 에서 `reusable: true` / `type:"ref"` / override 노드 각각 고유 시각 마커 표시 ② 원본↔인스턴스 양방향 탐색 액션 ③ `detachInstance` UI 연결 (우클릭 + 단축키 + Properties 패널) + 경고 다이얼로그 ④ `resetDescendantsOverride` 액션 신규 구현 + Properties 패널 필드별 "원본으로 복원" 버튼 ⑤ 원본 편집 시 "N개 인스턴스 영향" 미리보기 (c) detach/reset override 모두 undo 복구 가능 (d) 관련 연산/UI 단위 테스트 추가 — reusable/ref/override 시각 마커 렌더링 + detach 후 subtree materialize + reset 후 descendants 키 제거 검증                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 연산별 fallback 유지, 저장 포맷 전환 연기                  |
| G5: Persistence 전환         | Phase 5 완료 | (a) 기존 프로젝트 100% read-through 로드 가능 (샘플 프로젝트 + `mockLargeDataV2` 100% 통과) (b) **`tag` → `type` rename 1031 ref (2026-04-22 실측)** + `layout_id` 258 / `masterId` 55 / `componentRole` 41 / `descendants` 39 / `slot_name` 25 / `overrides` 23 = **hybrid 전체 1472 ref / 184 파일 (tag + hybrid 6 합집합, Round 12 재측정)** 이 canonical serializer/rename 을 경유하도록 grep 기준 0 miss (c) roundtrip(load → 저장 → 재로드) 시각 회귀 0건 (d) `layoutTemplates.ts` 28건 Slot 선언 전원 canonical format 으로 serialize (e) DB 저장 스키마 `tag` 컬럼 → `type` 전환 (read-through 우선, write-through 후행) (f) **repo-wide legacy layout API 최종 0건** — breakdown "정량 Gate 측정 명령" **§M7** 결과 = **0** 또는 **`apps/builder/src/adapters/legacy-layout/**` 디렉터리 한정 shim 참조만 잔존**. 명령 전문은 breakdown 참조 — ADR Gate 표 안 inline code 는 markdown pipe 해석으로 깨지므로 본문 중복 금지. 2026-04-22 baseline = 355 ref.`useLayoutsStore` 본체(`stores/layouts.ts`) 및 `BuilderCore.tsx`/`useIframeMessenger.ts`/`BuilderCanvas.tsx`/`AddPageDialog.tsx`/`PageLayoutSelector.tsx`/`stores/utils/layoutActions.ts`/`workspace/canvas/skia/workflowEdges.ts` 포함 전 경로 해체                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | legacy persistence 어댑터 유지, destructive migration 금지 |

## Consequences

### Positive

- 문서 구조 포맷이 `reusable + ref + descendants + slot` 중심으로 단일화된다
- 컴포넌트 재사용 모델이 메타필드 조합이 아니라 문서-네이티브 문법으로 승격된다
- Preview와 Skia가 동일 `resolved tree`를 소비하게 되어 구조적 정합성 확보가 쉬워진다
- frameset이 별도 특수 기능이 아니라 기본 composition 문법의 한 사례가 된다
- 이후 layout shell, reusable component, page composition, template system을 같은 문법으로 확장할 수 있다
- ADR-063의 RAC/RSP/Spec 체인을 그대로 유지하면서 상위 구조만 정리할 수 있다

### Negative

- 중간 단계 동안 legacy adapter와 canonical format이 병행되어 문서/타입 복잡도가 일시적으로 증가한다
- editor operations, history, persistence, import/export까지 영향 범위가 넓어 장기 작업이 된다
- `packages/shared/src/types/element.types.ts`와 builder 내부 타입/스토어 경계 재정리가 필요하다
- component authoring UI, instance override UI, slot authoring UI까지 전환 범위에 포함되어 구현 스코프가 커진다
- 완료 전까지는 "신포맷 정본 + 구포맷 저장 어댑터"라는 임시 구조를 감수해야 한다

## References

- [ADR-063: SSOT 체인 정본 정의 — 3-Domain 분할](./063-ssot-chain-charter.md)
- [The .pen Format](https://docs.pencil.dev/for-developers/the-pen-format)
- [.pen Files](https://docs.pencil.dev/core-concepts/pen-files)
- [packages/shared/src/types/element.types.ts](../../packages/shared/src/types/element.types.ts)
- [apps/builder/src/types/builder/layout.types.ts](../../apps/builder/src/types/builder/layout.types.ts)
- [apps/builder/src/preview/utils/layoutResolver.ts](../../apps/builder/src/preview/utils/layoutResolver.ts)
- [apps/builder/src/builder/workspace/canvas/sprites/useResolvedElement.ts](../../apps/builder/src/builder/workspace/canvas/sprites/useResolvedElement.ts)
- [apps/builder/src/utils/component/instanceResolver.ts](../../apps/builder/src/utils/component/instanceResolver.ts)
- [docs/pencil-extracted/engine/16_mcp-processor.txt](../pencil-extracted/engine/16_mcp-processor.txt)
- [docs/pencil-extracted/index.txt](../pencil-extracted/index.txt)
