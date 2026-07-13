# ADR-145: ListBox Template Element SSOT — 정상 tree화 적용 (industry-standard pattern)

## Status

Implemented — 2026-05-27 (Phase 0 / A / B / E 전수 완결. Round 3, 2026-05-27 — Lite framing 정정. Gate G3/G4 (4 fixture + perf proof) 폐기. figma + Retool + Frame ADR-130 + composition Preview 이미 검증한 industry-standard tree+가상화 패턴을 ListBox 에도 정상 적용)

> **Amendment notice (2026-05-28)**: ADR-146 Implemented는 본 ADR의 Phase 0/A 성과(`ListBoxItem` template child, factory/hydration repair, reusable master round-trip, `items` data SSOT)를 유지한다. 다만 Phase B의 `ListBoxSpec.render.shapes` template-data 결합 paint 및 `ListBox` parent composite row paint active path는 ADR-146의 `ListBoxItem` ref template row projection 구현으로 partially superseded 됐다.

### Phase 진행 요약

| Phase   | commit      | 산출물                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | `c91a673a2` | `apps/builder/src/adapters/canonical/legacyListBoxTemplateMigration.ts` (hydration migration helper `isLegacyListBoxWithoutTemplate`) + unit test 6/6 PASS. Gate G0 통과                                                                                                                                                                                                                                         |
| Phase A | `1db2a6ac6` | `SelectionComponents.ts` ListBox factory `children: [{ type: "ListBoxItem", props: { style: {} } }]` 자동 생성 + `canonical/index.ts` `buildNode` 안 hydration migration synthetic `<seg>::template::listboxitem` 자동 주입 + `buildSpecNodeData.ts` SYNTHETIC contract 주석 정밀화 + round-trip test 5/5 PASS (TC1 factory / TC2 hydration / TC3 mixed / TC4 reusable master / TC5 GridList 격리). Gate G1 통과 |
| Phase B | `606200bce` | `ListBox.spec.ts` render.shapes 가 `_listBoxItemTemplateStyle` 우선 소비 (row 시각 SSOT 분리) + `_viewport: { top, bottom }` row/section header culling + `buildSpecNodeData.ts` template style passthrough + viewport 주입 + `StoreRenderBridge.ts` useScrollState.scrollMap 전달. Gate G2 통과                                                                                                                 |
| Phase E | (본 commit) | ADR-145 Status Implemented 승격 + ADR-076 본문 patch 참조 + CHANGELOG / README 동기화. Gate G3 통과                                                                                                                                                                                                                                                                                                              |

## Scope 정의 (Round 3 정정 — framing layer)

본 ADR 은 **ListBox 를 정상적인 tree 구조로 전환** 하는 일반 작업이다 — 별도의 "perf proof" / "canonical SSOT verification" 책임은 자임하지 않는다.

### 외부 reference (industry-standard pattern)

| reference                   | 패턴                                                                                      | 검증 상태                         |
| --------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| figma                       | WebGL/WebGPU tile-based + layer tree + visible-only paint + invisible render-then-measure | production scale 검증 완료        |
| Retool / 일반 nocode        | Composite Design Pattern (tree) + react-window 가상화                                     | industry-standard                 |
| composition Frame (ADR-130) | canonical tree + reusable/slot/ref/descendants 4 메커니즘                                 | Implemented 2026-05-13, 정상 동작 |
| composition Preview ListBox | `@tanstack/react-virtual` + RAC `<AriaListBox>` native handling                           | 코드 land 완료, 동작 중           |

**Builder Skia 측 ListBox 만 SYNTHETIC composite paint 잔존** — 본 ADR 은 위 industry-standard pattern 을 ListBox 에도 동일하게 적용. perf proof / 4 fixture 입증 = already-known-good 패턴에 대한 over-engineering, 폐기.

### 본 ADR scope

- **scope 안**: ListBox factory `ListBoxItem` template element 자동 생성 + canonical document 직렬화 + `ListBoxSpec.render.shapes` template-data 결합 paint + Skia 측 viewport intersection 통합
- **scope 외**: 1000/10000/100000 row fixture 측정 / `computeDescendantsFingerprint` stub 해제 비용 측정 / 4 fixture canonical SSOT 입증 — already-known-good 패턴 재증명 부담 회피
- **검증 방법**: 일반 cross-check + type-check + 사용자 실측 — figma/Retool/Frame 과 동등 검증 수준

### SSOT 체인 3-domain 분류 (`.claude/rules/ssot-hierarchy.md`)

- **D1 (DOM / 접근성, RAC 절대 권위)**: `createLeafComponent` 로 등록된 `ListBoxItem` 패턴 — 본 ADR 변경 0
- **D2 (Props / API, RSP 참조)**: `ListBoxItem` props (selected / disabled / id 등) — 기존 spec 보존
- **D3 (시각 스타일, Spec SSOT)**: `ListBoxItem` template element 의 spec / canonical descendants 위치 / `ListBoxSpec.render.shapes` 의 template-data 결합 paint — **본 ADR 적용 영역**

## Context

### 문제 정의

composition 의 ListBox 가 현재 `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:163-178` 의 `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버 — 부모 spec `render.shapes` 가 `props.items` 를 받아 모든 row 를 한 번에 그림. element tree 에 `ListBoxItem` 이 존재하지 않음.

ADR-116/122 (canonical document SSOT) + ADR-112 (Editing Semantics 6요소 + Slot section base) + ADR-130 (Frame canonical) 도입 이후, 이 composite 구조가 canonical SSOT 의 `RefNode.descendants[path]` / slot projection / ref reference / per-instance override 4 메커니즘과 incompatible — path 가 reference 할 element node 부재.

Frame (ADR-130) 이 이미 위 4 메커니즘으로 정상 동작하므로 (`frameElementScope.ts:24-25,96`, `frameLayoutCascade.ts:4,35`), ListBox 도 동일 패턴 적용이 정상 작업.

### Hard constraints

- composition product target = 엔터프라이즈급 빌더 (60fps 최저선, memory `feedback-composition-enterprise-target`) — 정상 tree화 작업이 60fps 회귀를 일으키지 않을 것 (industry-standard pattern 적용이므로 일반 cross-check 로 검증 충분)
- canonical document SSOT 정합 (ADR-116 / ADR-122 후속)
- ADR-132 `useCollectionData` + `collections.runtimeData` 진입점 보존
- RAC 본래 D1 (DOM / ARIA / 키보드) 변경 0

### Baseline framing reverse 검증 (사용자 explicit confirm, 2026-05-27)

ADR-076 (ListBox items SSOT) 의 composite 채택 motivation = "child item N 증가 시 N Skia 노드 폭증 회피 (퍼포먼스)". 이 결정은 canonical document + reusable / slot / ref / descendants 도입 이전 baseline. canonical SSOT 도입 후:

1. composite 자체가 path 진입점 부재로 reusable 모델과 incompatible
2. RAC dynamic collection 본래 패턴 = template element 1개 + items data props + visible-only paint — 위 퍼포먼스 baseline 도 동시에 해소
3. figma/Retool/composition Preview 가 이미 동일 패턴 production 검증 완료

ADR-076 의 framing 은 patch (전면 reverse 아님, items props SSOT 유지).

### framing checkpoint 4 질문 lock-in (`.claude/rules/adr-writing.md`)

1. **base / 응용 분류**: 본 ADR = base (ListBox 단일 시범). 응용 = 나머지 10 컴포넌트 (Breadcrumbs / ComboBox / GridList / Menu / Select / Table / TagGroup / Tabs / Toolbar / Tree) 각각 별도 후속 ADR 결정. ADR-144 일괄 처리 framing 폐기
2. **schema 직교성**: ListBox 단일 — canonical descendants path 가 element tree 위에서만 작동. `ListBoxItem` template element 도입이 schema prerequisite
3. **baseline framing reverse**: ADR-076 의 "퍼포먼스" motivation 이 canonical context + industry-standard tree+가상화로 patch (전면 reverse 아님, items props SSOT 유지)
4. **codex 3차 미루지 말 것**: ADR-145 Round 6 까지 codex review fatigue 노출 — Round 7 정정 (perf proof gate 폐기 framing) 으로 본질 검증 layer 통과

### Round 3 정정 framing (사용자 explicit confirm, 2026-05-27)

> 사용자 framing: "이미 다른 컴포넌트들도 트리구조화 된 것이 많다. ListBox 를 정상적으로 하려는데 왜 문제가 존재한다고 판단? pencil/figma 도 트리구조로 하고있다."

본 framing 의 evidence:

- figma + Retool + composition Frame (ADR-130) + composition Preview ListBox = "tree + 자체 가상화 = 정상 동작" industry-standard 검증
- ListBox tree화 = already-known-good 패턴 적용 = 별도 perf proof 부담 부재
- Round 1~6 codex review 사이클이 본문 정합 layer 만 반복, framing layer (over-engineering 여부) 미검증

### ADR-144 와의 관계

ADR-144 (Collection 컴포넌트 Template Element SSOT, **Superseded by ADR-145** — 2026-05-27) 의 폐기 사유 = 단일 Family axis (template element 존재 여부) 가 본질 axis 가 아님 — Codex Round 4 발견:

- `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버십 ↔ child element 자동 생성 여부 ↔ items SSOT 강도 — **3 axis 직교**
- Tabs = hybrid (items SSOT + child element), Toolbar = items 없음 + child element, Menu = Skia trigger only
- 11 컴포넌트 단일 일괄 ADR 본질 정밀도 부족

본 ADR 은 **ListBox 단일 컴포넌트 시범** — Round 3 정정으로 perf proof 부담도 제거된 Lite framing.

## Alternatives Considered

### 대안 A: Lite framing — 정상 tree화 작업 적용 (채택)

- 설명:
  - `ListBoxItem` template element 1개를 canonical element tree 멤버로 추가
  - `props.items[]` data layer 유지 (ADR-132 `collections.runtimeData` sink 정합)
  - `ListBoxSpec.render.shapes` 가 template element style × items data 결합으로 visible row 만 paint
  - Skia 측 viewport intersection 통합 (industry-standard pattern 적용)
- 외부 reference (industry-standard): figma WebGPU tile-based + Retool react-window + Frame ADR-130 + composition Preview `@tanstack/react-virtual` + RAC `Virtualizer.tsx` `state.visibleViews`
- 검증 부담: 일반 cross-check + type-check + 사용자 실측 (perf proof / 4 fixture 부담 없음)
- 위험:
  - 기술 LOW — 단일 컴포넌트, 특수 처리 (recursive / 2-level / hybrid) 없음, industry-standard pattern 적용
  - 성능 LOW — already-known-good 패턴 (figma/Retool 검증), 일반 cross-check 로 충분
  - 유지보수 LOW — 단일 scope, contract 확장 (`SYNTHETIC_CHILD_PROP_MERGE_TAGS` 의 ListBox 멤버만 정밀화)
  - 마이그레이션 MED — ListBox factory 자식 자동 생성 + 기존 프로젝트 ListBox hydration migration 필요

### 대안 B: ADR-145 Round 2 framing 유지 — perf proof + 4 fixture (기각)

- 설명: 1000/10000/100000 row fixture + `computeDescendantsFingerprint` stub 해제 비용 측정 + 4 fixture canonical SSOT verification 의무
- 위험:
  - 기술 LOW
  - 성능 LOW
  - 유지보수 **MED** — already-known-good 패턴 (figma/Retool/Frame) 에 대한 over-engineering, codex review 사이클 fatigue 누적
  - 마이그레이션 MED
- 기각 사유 (사용자 framing 2026-05-27): "이미 다른 컴포넌트가 tree화 + pencil/figma 도 tree". perf proof / 4 fixture 책임 자임은 본 ADR scope 외, 일반 검증으로 충분

### 대안 C: ADR 없이 직접 작업 (기각)

- 설명: Frame/SHELL_ONLY 가 ADR 없이 tree화 된 선례 적용. ListBox 도 일반 commit 으로 처리
- 위험:
  - 기술 LOW
  - 성능 LOW
  - 유지보수 **MED** — 작업 중 framing 흔들리거나 scope 확장 위험 (사용자 우려 2026-05-27 "작업도중 이상해질수있으니")
  - 마이그레이션 MED
- 기각 사유 (사용자 결정 2026-05-27): "옵션 1이 맞지 않나" — ADR 문서 1개 + Lite framing 으로 작업 anchor 확보

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | 판정                                      |
| ---- | :--: | :--: | :------: | :----------: | ----------------------------------------- |
| A    | LOW  | LOW  |   LOW    |     MED      | **채택** (HIGH+ 0, over-engineering 없음) |
| B    | LOW  | LOW  |   MED    |     MED      | 사용자 framing 기각                       |
| C    | LOW  | LOW  |   MED    |     MED      | 사용자 framing 기각                       |

대안 A 가 HIGH+ 0 + over-engineering 없음. 루프 종료.

## Decision

대안 A 채택. **`ListBoxItem` template element SSOT (canonical descendants 진입점) + `props.items` (data layer 보존) + Skia viewport intersection (industry-standard pattern 적용)** 3-layer 결합 모델로 ListBox 단일 컴포넌트 전환. 검증 부담은 일반 cross-check + type-check + 사용자 실측 — figma/Retool/Frame ADR-130 과 동등 수준.

### 위험 수용 근거

- **R1 (hydration migration 회귀)**: Phase 0 에 hydration helper (`isLegacyListBoxWithoutTemplate`) 작성, G0 통과 조건
- **R2 (ADR-076 baseline reverse 가 stale 인용 유발)**: 본문 §Context 에 "patch (전면 reverse 아님)" 명시 — items props SSOT 유지 사실 강조, G3 (Phase E patch 참조)

### 기각된 대안 사유 (요약)

- 대안 B: 유지보수 MED (already-known-good 패턴 over-engineering, codex fatigue)
- 대안 C: 유지보수 MED (작업 중 scope 확장 위험)

> 구현 상세: [145-listbox-template-element-single-component-proof-breakdown.md](../design/145-listbox-template-element-single-component-proof-breakdown.md)

## Risks

| ID  | 위험                                                                 | 심각도 | 대응                                                                                                                                     |     Gate 매핑     |
| --- | -------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------- | :---------------: |
| R1  | ListBox factory 자동 자식 생성 시 기존 프로젝트 hydration 회귀       |  MED   | Phase 0 에 hydration migration helper (`isLegacyListBoxWithoutTemplate`) 추가                                                            |    **G0 / G1**    |
| R2  | ADR-076 baseline reverse 가 stale 인용 유발                          |  LOW   | 본문 §Context 에 "patch (전면 reverse 아님)" 명시 — items props SSOT 유지 사실 강조. Phase E 에서 ADR-076 본문에 ADR-145 patch 참조 추가 |      **G3**       |
| R3  | `render.shapes` 가 `props.items` style 직접 hardcode 시 D3 SSOT 위반 |  LOW   | template element style 우선 소비 — cross-check ListBox CSS↔Skia 정합 PASS                                                                |      **G2**       |
| R4  | 후속 10 컴포넌트 ADR fork burden                                     |  LOW   | 본 ADR scope 외 — 각 컴포넌트별 case-by-case 후속 결정 (ADR-144 폐기 사유 = 일괄 처리 본질 의문)                                         | (본 ADR scope 외) |

(Round 3 정정 — R/G 매핑 표 안 명시화. Round 2 의 R1 perf proof / R3 descendantsFingerprint 비용 측정은 폐기됨 — already-known-good 패턴에 대한 over-engineering)

잔존 HIGH 위험 없음. R1 → G0/G1, R2 → G3, R3 → G2, R4 = 본 ADR scope 외.

## Gates

| Gate | 시점                       | 통과 조건                                                                                                                                                                                                                                             | 실패 시 대안                                                                                                                                                                                  |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 (inventory) 완료   | ListBox 현재 collection-item 구조 inventory freeze + hydration migration helper (`isLegacyListBoxWithoutTemplate`) 작성                                                                                                                               | inventory 누락 시 1.5x scope inflation 위험 — Phase 0 보강 commit                                                                                                                             |
| G1   | Phase A 완료               | ListBox factory `ListBoxItem` template element 자동 생성 + canonical document 직렬화 round-trip PASS + **ListBox reusable master 등록 round-trip PASS** (Round 4 보강 — component-agnostic 메커니즘 자동 흡수 확인)                                   | factory 자식 자동 생성 회귀 시 `SHELL_ONLY_CONTAINER_TAGS` ↔ `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버십 재검토                                                                                  |
| G2   | Phase B 완료               | `ListBoxSpec.render.shapes` 가 `ListBoxItem` template element style 우선 소비 + Skia viewport intersection 적용 + cross-check ListBox CSS↔Skia 정합 PASS + **reusable instance descendants override 시 Preview ↔ Skia 시각 결과 정합** (Round 4 보강) | `render.shapes` 가 `props.items` style 직접 hardcode 시 D3 SSOT 위반 — 정정 후 재진행. viewport intersection 회귀 시 별도 commit 으로 정정. instance override 반영 미달 시 cross-check 재실행 |
| G3   | Phase E (Implemented 승격) | type-check baseline 무증가 + `pnpm test` + cross-check ListBox PASS + ADR-076 본문에 ADR-145 patch 참조 추가 (`completed/` archive 동기화) + CHANGELOG / README 동시 갱신 + drift 14일/100 commits 임계 초과 시 catch-up block 선행 작성              | 1건이라도 실패 시 Implemented 승격 보류                                                                                                                                                       |

(Round 3 정정 — Round 2 G3 (4 fixture canonical SSOT verification) + G4 (perf proof + descendantsFingerprint 비용 측정) 폐기. 사유: figma + Retool + Frame ADR-130 + composition Preview 가 이미 검증한 industry-standard tree+가상화 패턴 — already-known-good 책임 자임 over-engineering)

## Consequences

### Positive

- canonical document SSOT 정합 (ListBox 영역 — ADR-116 / ADR-122 완결성 부분 강화)
- reusable / slot / ref / descendants 4 메커니즘이 `ListBoxItem` template 에 적용 가능 (Frame ADR-130 검증된 메커니즘 재사용)
  - 디자인 도구 사용자가 `ListBoxItem` default style 변경 → 모든 row 반영
  - slot 으로 `ListBoxItem` 안에 icon inject
  - ref 로 ListBox template reuse (후속 ADR 에서 Menu / Select / ComboBox 가 동일 template 참조 가능성 열림)
  - per-instance override (reusable 인스턴스마다 `ListBoxItem` style 다름)
- ADR-132 `collections.runtimeData` 진입점 보존 — runtime data binding 영향 0
- RAC dynamic collection 정통 패턴 정합 — composition self-contained 발명 회피
- industry-standard tree+가상화 패턴 적용 — figma/Retool/Frame ADR-130 / composition Preview 검증 결과 그대로 활용
- **단일 컴포넌트 시범 = 작업량 ~3-5 일** (Round 2 의 ~1-2 주 대비 perf proof / 4 fixture 부담 제거로 단축)
- **framing 검증 완료** — codex review fatigue 사이클 차단, perf proof over-engineering 회피

### Negative

- 10 컴포넌트 (Breadcrumbs / ComboBox / GridList / Menu / Select / Table / TagGroup / Tabs / Toolbar / Tree) 후속 ADR fork 필요 — 컴포넌트별 별도 검증 burden
- 그러나 본질 framing (multi-axis 직교) 발견 후 컴포넌트별 정밀 처리가 ADR-144 일괄 처리보다 정확
- ADR-076 본문에 patch 참조 추가 의무 — `completed/` archive 동기화 + README.md 갱신
- `buildSpecNodeData.SYNTHETIC_CHILD_PROP_MERGE_TAGS` contract 정밀화 (ListBox 멤버만) — 신규 개발자 onboarding 시 contract 학습 비용 부분 증가

## 관련 ADR

- **ADR-144 (Collection 컴포넌트 Template Element SSOT, Superseded by ADR-145 — 2026-05-27)** — 본 ADR 의 source. 단일 Family axis 본질 결함 발견 후 ListBox 단일 시범으로 scope 축소
- ADR-076 (ListBox items SSOT) — baseline framing reverse 대상, patch 참조 추가
- ADR-100 (Unified Skia Engine) — Skia 측 viewport intersection 통합 영역
- ADR-112 (Editing Semantics UI 6요소 + Slot section base) — reusable component / slot 추상 base
- ADR-116 / ADR-122 (canonical document SSOT / canonical-only-runtime) — 본 ADR 의 base
- ADR-130 (Frame canonical) — reusable/slot/ref/descendants 4 메커니즘 검증 완료된 선례
- ADR-132 (`useCollectionData` + `collections.runtimeData`) — runtime data layer 진입점 보존

### 후속 후보 ADR (본 ADR 성공 시 fork 결정)

| 컴포넌트           | 특수성                                                 | 후속 ADR scope                                                           |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| GridList           | grid layout (column × row)                             | template + viewport intersection + grid metric resolve                   |
| Select / ComboBox  | Menu ListBox 재사용 + trigger 분리                     | 본 ADR template element 재사용                                           |
| TagGroup           | TagList propagation 경유                               | template + propagation rule 정합                                         |
| Menu               | items SSOT 별 branch + Skia trigger only               | items branch 정밀화 + Preview-only paint vs Skia paint 분리 결정         |
| Table              | Row + Cell 2-level template + Preview useVirtualizer   | 2-level template + Skia path viewport intersection + Preview ↔ Skia 정합 |
| Toolbar            | factory child 자동 생성 + items 없음 + mixed item type | child element 모델 유지 결정                                             |
| Breadcrumbs / Tree | 이미 child element 모델                                | canonical verification only                                              |
| Tabs               | items SSOT + child element hybrid + schema gap         | hybrid 정합 결정 (items ↔ TabPanel 페어링)                               |

## 사용자 explicit confirm

- 2026-05-27 — 사용자가 ADR-144 Round 4 (Codex 독립 리뷰) 결과 후 "adr-144 폐기후 ListBox 단일 에 집중" 명시 신호 → 본 ADR fork 결정
- 2026-05-27 — hook 차단 우회 사용자 명시 신호 "adr-145 생성해" → 본 ADR 작성 진행
- 2026-05-27 (Round 3 정정) — 사용자 framing question "이미 다른 컴포넌트들도 트리구조화 된 것이 많다. ListBox 를 정상적으로 하려는데 왜 문제가 존재한다고 판단? pencil/figma 도 트리구조" + 옵션 1 선택 "작업도중 이상해질수있으니 옵션 1이 맞지않나?" → Lite framing 정정 + Gate G3/G4 폐기

진행 단계는 Phase 0 inventory 부터 — 사용자 별도 신호 ("Phase 0 진행해" 등) 후 실행.
