# ADR-145 Design Breakdown — ListBox Template Element SSOT (Lite framing)

> 본 design breakdown 은 ADR-145 의 구현 상세 — Phase scope, 파일 경계, 검증 방법 정의. ADR 본문은 결정 / 위험 / Gate 만 보유.
>
> **Round 3 정정 (2026-05-27)**: Lite framing — figma/Retool/Frame(ADR-130)/composition Preview 가 이미 검증한 industry-standard tree+가상화 패턴을 ListBox 에도 정상 적용. perf proof / 4 fixture / `descendantsFingerprint` 비용 측정 책임 자임 폐기. Phase 0/A/B/E 4 Phase 로 정상화.

## §0. Phase 0 — Inventory Freeze (ListBox 단일)

### Scope

- ListBox 현재 collection-item 구조 inventory (`props.items` SSOT, factory 자식 0, Skia composite paint)
- hydration migration helper (`isLegacyListBoxWithoutTemplate`) 작성 — 기존 프로젝트의 ListBox element 에 `ListBoxItem` template child 자동 주입
- 추정 vs 실측 gap 측정 (memory `feedback-analysis-precision-patterns`)

### §0.3 ListBox 현재 구조 evidence

| 항목                       | 위치                                                                                              | 현황                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SYNTHETIC 멤버             | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:167`                         | "ListBox" 멤버                                                                                       |
| factory child 자동 생성    | `apps/builder/src/builder/factories/definitions/SelectionComponents.ts`                           | 자식 element 0 (props.items 만 전달)                                                                 |
| spec render.shapes         | `packages/specs/src/components/ListBox.spec.ts:285-501`                                           | `props.items` 받아 `flatItems` 펼친 후 `renderOneItem` 으로 모든 row paint                           |
| RAC primitive              | `react-aria-components@1.17.0/src/ListBox.tsx:251-358`                                            | `createLeafComponent` ListBoxItem                                                                    |
| Preview 가상화             | `packages/shared/src/components/ListBox.tsx:31`                                                   | `@tanstack/react-virtual` 사용 (RAC Virtualizer 아님), `enableVirtualization && hasDataBinding` 분기 |
| Frame canonical 4 메커니즘 | `apps/builder/src/adapters/canonical/frameElementScope.ts:24-25,96`, `frameLayoutCascade.ts:4,35` | reusable/slot/ref/descendants 정상 동작 — ADR-130 Implemented 2026-05-13                             |

### Deliverables

| 산출물                     | 위치                                                                           | 목적                                                       |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| ListBox inventory §        | 본 design breakdown §0.3                                                       | ListBox 단일 구조 freeze                                   |
| hydration migration helper | `apps/builder/src/adapters/canonical/legacyListBoxTemplateMigration.ts` (신규) | 기존 ListBox element 1회 `ListBoxItem` template child 주입 |

### Gate G0 통과 조건

- ListBox inventory freeze (위 evidence 테이블)
- hydration migration helper unit test PASS

## §A. Phase A — ListBox Template Element 도입 (factory + canonical 직렬화)

### Scope

- ListBox factory 에 `ListBoxItem` template child 자동 생성 추가
- canonical document schema 에 template element 위치 정의 (ListBox 의 descendants path 안)
- `buildSpecNodeData.SYNTHETIC_CHILD_PROP_MERGE_TAGS` 의 ListBox 멤버 contract 정밀화 — template element 동반 가능 (`_hasChildren` 주입 조건 정밀화: template 존재 + data row 자식 없음)

### 변경 파일

- `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` — ListBox factory 정의에 `ListBoxItem` template child 자동 생성 추가
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — `_hasChildren` 주입 조건 ListBox 분기 정밀화
- `apps/builder/src/adapters/canonical/*` — canonical document 직렬화 시 ListBox 의 `ListBoxItem` template element 보존

### canonical 4 메커니즘 검증 방법 (Round 3 정정)

Frame (ADR-130) 이 이미 reusable/slot/ref/descendants 4 메커니즘 검증 완료 (`frameElementScope.ts:24-25,96`). ListBox 도 동일 canonical 메커니즘 적용이므로 **별도 4 fixture 입증 불요**. 검증 방법:

- factory + canonical 직렬화 round-trip PASS
- type-check baseline 무증가
- cross-check ListBox 1 회 (Phase B 와 함께) — Frame 검증된 메커니즘 재사용 확인

### Gate G1 통과 조건

- ListBox factory 자동 `ListBoxItem` template 생성 + canonical document 직렬화 round-trip PASS
- hydration migration 으로 기존 프로젝트 ListBox element 에 template element 주입 round-trip PASS

## §B. Phase B — ListBoxSpec render.shapes Patch + Skia viewport intersection 통합

### Scope

- `ListBoxSpec.render.shapes` 가 `ListBoxItem` template element style 우선 소비
- 기존 hardcoded item style 제거 (`paddingX` / `itemHeight` 등) → template element style 참조
- `props.items` data 와 template style 결합 paint
- **Skia 측 viewport intersection 통합** — visible row 만 paint (industry-standard pattern: figma WebGPU tile-based + Retool react-window + composition Preview `@tanstack/react-virtual` 와 동등 패턴 적용)

### 변경 파일

- `packages/specs/src/components/ListBox.spec.ts` — `render.shapes` 가 template 참조 + viewport-aware
- `packages/specs/src/components/ListBoxItem.spec.ts` — template style 정의 진입점 (현재 spec 그대로 사용)
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — viewport intersection helper (ListBox spec render 안에서 사용)

### viewport intersection 검증 방법 (Round 3 정정)

figma + Retool + composition Preview 가 이미 industry-standard pattern production 검증 — ListBox Skia 측도 동등 패턴 적용. 검증 방법:

- cross-check ListBox CSS↔Skia 정합 (CSS 측 자체 가상화 + Skia 측 viewport intersection 시각 결과 동일)
- type-check baseline 무증가
- 사용자 실측 (Phase B 완료 후 builder 에서 ListBox row 다수 추가 → 60fps 확인)

**별도 1000/10000/100000 row fixture 측정 불요** — already-known-good 패턴 재증명 over-engineering.

### Gate G2 통과 조건

- cross-check ListBox CSS↔Skia 정합 PASS
- D3 SSOT 위반 0 (`render.shapes` 가 `props.items` style 직접 hardcode 안 함)
- Skia viewport intersection 정상 동작 (사용자 실측)
- type-check baseline 무증가

## §E. Phase E — Implemented 승격 + 문서 동기화

### Scope

- README.md / CHANGELOG.md 갱신 (ADR-145 Implemented 진입 + Phase 0/A/B 요약)
- ADR-076 본문에 ADR-145 patch 참조 추가 (`completed/` archive 동기화)
- type-check baseline 무증가 확인
- cross-check ListBox 최종 PASS
- CHANGELOG drift 14일/100 commits 임계 초과 시 catch-up block 선행 작성 (`.claude/rules/changelog.md` §2 적용)

### Gate G3 통과 조건 (이전 G5, Round 3 정정으로 G3 로 압축)

- type-check baseline 무증가
- `pnpm test` PASS
- cross-check ListBox PASS
- ADR-076 본문에 ADR-145 patch 참조 추가
- CHANGELOG / README 동시 갱신
- drift 임계 초과 시 catch-up block 선행

## §F. Phase F — 후속 ADR fork 결정 (본 ADR scope 외, 사용자 결정 시점)

본 ADR 의 ListBox 시범 성공 후, 나머지 10 컴포넌트 (Breadcrumbs / ComboBox / GridList / Menu / Select / Table / TagGroup / Tabs / Toolbar / Tree) 의 후속 ADR fork 결정. 각 컴포넌트의 특수성 (ADR-145 본문 §"후속 후보 ADR" 참조) 별 case-by-case 처리.

본 Phase 는 본 ADR 의 실행 단계 외 — 사용자 결정 후 별도 ADR 들로 fork.

## §G. Phase G — 폐기된 Phase 기록 (Round 2 → Round 3 정정 사유)

> 본 § 는 historical reference. Round 2 의 Phase C / Phase D 가 Round 3 정정으로 폐기된 사유 보존.

### Round 2 Phase C (canonical SSOT 4 fixture verification) — 폐기

- 의도: reusable / slot / ref / descendants 4 메커니즘이 ListBox + `ListBoxItem` 에서 정상 동작 입증
- 폐기 사유: Frame (ADR-130 Implemented 2026-05-13) 이 이미 4 메커니즘 검증 완료 (`frameElementScope.ts`, `frameLayoutCascade.ts`). ListBox 도 동일 canonical 메커니즘 적용 → 별도 fixture 입증은 already-verified 패턴 재증명 over-engineering. Phase A 의 canonical 직렬화 round-trip + Phase B 의 cross-check 로 충분

### Round 2 Phase D (Skia Virtualizer perf proof + `descendantsFingerprint` stub 해제) — 부분 폐기

- 의도: 1000/10000/100000 row × ListBox 60fps + scroll fps 회귀 0 측정 + `computeDescendantsFingerprint` (`canonical-resolver.types.ts:39 @stub Phase 2+`) stub 해제 후 1000 노드 5 depth fingerprint 비용 측정
- 폐기 사유:
  - **perf proof 부분 폐기**: figma WebGPU tile-based + Retool react-window + composition Preview `@tanstack/react-virtual` 가 이미 production 규모 검증한 industry-standard pattern → ListBox Skia 측도 동등 패턴 적용, 별도 fixture 측정은 already-known-good 재증명. Phase B 에 viewport intersection 통합으로 흡수, cross-check + 사용자 실측으로 검증
  - **`descendantsFingerprint` stub 해제 분리**: canonical resolver 영역의 별도 stub 작업으로, ListBox 단일 시범 ADR scope 와 직교. 별도 후속 작업으로 분리 (본 ADR scope 외)

## 부록 — RAC reference 코드 위치 (ListBox 영역)

| RAC 패턴                          | 위치                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| CollectionBuilder hidden tree     | `node_modules/.pnpm/react-aria-components@1.17.0/.../src/Collection.tsx` |
| createLeafComponent (ListBoxItem) | `react-aria-components@1.17.0/src/ListBox.tsx:251-358`                   |
| Virtualizer visible-only          | `react-aria-components@1.17.0/src/Virtualizer.tsx`                       |

각 Phase 진행 시 RAC 소스 직접 참조 (`.claude/rules/react-aria-skill.md` §"GitHub 소스코드 직접 참조" 적용).

## 부록 — 외부 reference (industry-standard tree+가상화 검증)

| reference                             | 핵심 출처                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| figma WebGPU tile-based               | https://www.figma.com/blog/figma-rendering-powered-by-webgpu/                                                  |
| figma layer tree + visible-only paint | https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/                                     |
| Retool react-window 가상화 tree       | https://retool.com/blog/designing-a-ui-for-tree-data                                                           |
| 일반 virtual scrolling 패턴           | https://dev.to/lalitkhu/rendering-massive-tables-at-lightning-speed-virtualization-with-virtual-scrolling-2dpp |
| nocode component tree                 | https://www.nocode.tech/lessons/using-the-component-tree                                                       |
