# ADR-914: Component Entry Universe Collapse

## Status

Implemented - 2026-06-22 (Accepted 2026-06-20 → Implemented 승격, deletion 축 적대 검증으로 가능분 소진 확인 + live builder exercise + 사용자 confirm)

## Context

ADR-912는 catalog SSOT collapse를 완료했지만, 완료 범위는 시각, 구조, size
SOURCE 축으로 한정된다. ADR-912 본문은 이 경계를 명시한다. `componentRulesTable`
한 entry에서 CSS generator, Skia base-layout, Style Panel preset이 값을 읽는 축은
닫혔지만 다음 손등록 surface는 아직 남아 있다.

- `rendererMap`: DOM/Preview self-compose, RAC wrapper, child recursion skip 정책.
- `ComponentFactory.creators` / `COMPLEX_COMPONENT_TAGS`: palette add 시 canonical child
  element tree를 직접 생성하는 함수 registry.
- `DEFAULT_PROPS_MAP`: catalog binding defaults로 6종만 파생되고, 나머지는 literal
  default props 함수로 유지.
- `propagationRegistry`: parent props를 child props/style로 전파하는 별도 spec-shaped
  registry.
- child runtime filtering/injection: `SYNTHETIC_CHILD_PROP_MERGE_TAGS`,
  `POPOVER_CHILDREN_TAGS`, Label necessity injection, field/collection child filtering.

따라서 "1 component = 1 registration"은 현재 시각, 구조, size SOURCE 축에 한해서만
맞다. 사용자가 요청한 "rendererMap/factory/default props/propagation/child-filtering까지
전부 제거"는 ADR-912의 scope 확장이 아니라, component entry를 구성하는 런타임 권한
전체를 별도 축으로 collapse하는 신규 ADR이 필요하다.

**Fork / 전제 점검 lock-in**

1. **base / 응용 분류**: ADR-912 = catalog visual/structure/size SOURCE collapse. ADR-914
   = component entry runtime authority collapse. ADR-912의 후속 base cleanup이지만
   해결 축이 다르므로 신규 ADR로 분리한다.
2. **schema 직교성**: ADR-914는 `ComponentRule`을 두껍게 만들지 않는다. entry-level
   runtime facet은 `ComponentRule` visual schema와 분리한다.
3. **선행 ADR 전제 reverse 검증**: ADR-912의 "무조건적 1 component = 1 registration 주장
   금지" 문구를 그대로 승계한다. 본 ADR의 성공 조건은 그 금지를 해제하는 것이다.
4. **사용자 confirm**: 2026-06-20 사용자가 "전부 제거 설계"를 신규 ADR로 생성하라고
   지시했다. 구현은 본 ADR 설계 review 후 phase별 실행한다.

**3-Domain 분류**

- **D1 DOM / 접근성 / render delegation**: `rendererMap`, RAC wrapper delegation,
  `DELEGATING_INTERNAL_RENDERERS`, `DELEGATING_RAC_RENDERERS`.
- **D2 Props / API / defaults / propagation**: `DEFAULT_PROPS_MAP`, binding default,
  propagation rules, parent-to-child prop projection.
- **D3 visual / layout / child runtime**: Skia child filtering, synthetic prop merge,
  necessity indicator injection, popover-hosted child exclusion.

본 ADR은 D1/D2/D3를 가로지른다. 그래서 visual catalog rule에 더 필드를 넣는 식으로
닫지 않고, component entry universe를 별도 runtime contract로 둔다.

**Hard Constraints**

1. `ComponentRule`은 D3 visual/structure/size rule로 유지한다. renderer/factory/default/
   propagation/child-runtime을 `ComponentRule`에 섞어 `ComponentSpec v2`를 만들지 않는다.
2. `packages/shared`는 builder 실행 함수를 import하지 않는다. shared catalog에는
   serializable metadata와 adapter id만 둘 수 있다.
3. D1 self-compose renderer는 entry가 대체 가능함을 증명하기 전 삭제하지 않는다.
   `rendererMap` 위임이 child recursion, RAC controller, `childrenByParent`를 보존하는
   경우는 먼저 facet으로 모델링해야 한다.
4. Factory child tree 생성은 canonical document 저장 순서, id 안정성, reusable origin
   hydration, refresh persistence를 보존해야 한다.
5. Default props 전환은 기존 project hydrate와 palette add 결과의 observable props를
   보존한다. literal default 제거는 diff fixture 없이는 금지한다.
6. Propagation 전환은 전파 순서, conflict skip, child lookup grain을 보존한다.
7. `componentRegistrationContract.test.ts`는 replacement `entryUniverseContract`가 같은
   누락 차단 능력을 갖기 전 제거하지 않는다.
8. "전부 제거"는 독립 손등록 registry 제거를 뜻한다. load-bearing adapter 함수는 entry가
   선언한 adapter id로 남을 수 있지만, 별도 registry drift surface로 남으면 실패다.

**Soft Constraints**

- ADR-912/913과 같은 작은 proof slice 우선. leaf defaults, 단순 reusable composite,
  단일 propagation family 순서로 증명한다.
- renderer/factory/propagation/child-filtering을 한 phase에서 섞지 않는다.
- gate가 red면 deletion보다 facet 모델을 먼저 보정한다.

## Alternatives Considered

### 대안 A: Gated Component Entry Universe (채택)

- 설명: component 하나의 entry에서 render, defaults, creation, propagation, childRuntime
  facet을 선언한다. builder/shared 경계를 지키기 위해 executable function은 adapter id로
  참조하고, 각 runtime이 자기 local adapter map을 소비한다. 기존 registry는 facet별로
  증명된 뒤 제거한다.
- 위험:
  - 기술: MEDIUM - facet resolver와 contract test가 필요하다.
  - 성능: MEDIUM - render/default/creation lookup path가 하나 더 생기지만 memoized map으로
    고정 가능하다.
  - 유지보수: MEDIUM - entry schema review가 필요하지만 drift 위치는 하나로 줄어든다.
  - 마이그레이션: MEDIUM - proof slice별 ratchet으로 절단 가능하다.

### 대안 B: 5개 registry를 파일별로 직접 삭제

- 설명: `rendererMap`, factory, `DEFAULT_PROPS_MAP`, propagation registry,
  child-filtering set을 각각 opportunistic하게 제거한다.
- 위험:
  - 기술: HIGH - self-compose renderer와 child recursion skip 의미를 잃기 쉽다.
  - 성능: MEDIUM.
  - 유지보수: HIGH - 삭제 기준이 registry마다 달라 새 drift surface가 생긴다.
  - 마이그레이션: HIGH - 어떤 component가 어느 축에서 안전한지 추적하기 어렵다.

### 대안 C: ADR-912 안에 후속 phase로 흡수

- 설명: ADR-912 design breakdown에 남은 registry 제거 phase를 계속 추가한다.
- 위험:
  - 기술: MEDIUM.
  - 성능: LOW.
  - 유지보수: HIGH - ADR-912의 완료 경계가 흐려져 visual SOURCE collapse와 runtime entry
    collapse가 섞인다.
  - 마이그레이션: MEDIUM.

### 대안 D: 현 registry 유지 + contract test만 강화

- 설명: `componentRegistrationContract`와 grep gate만 강화하고 registry 구조는 유지한다.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: HIGH - 사용자가 요구한 "전부 제거" 목표를 만족하지 못한다.
  - 마이그레이션: LOW.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  M   |    M     |      M       |     0      |
| B    |  H   |  M   |    H     |      H       |     3      |
| C    |  M   |  L   |    H     |      M       |     1      |
| D    |  L   |  L   |    H     |      L       |     1      |

루프 판정: 대안 A가 HIGH+ 0개로 threshold를 통과한다. 대안 B는 삭제 순서만 있고
새 authority 모델이 없어 폐기한다. 대안 C는 ADR-912 완료 경계를 다시 흐린다. 대안 D는
요구사항 미충족이다.

## Decision

**대안 A: Gated Component Entry Universe**를 선택한다.

결정 내용:

1. component entry는 기존 visual catalog와 별개로 runtime facet을 가진다.
   `render`, `defaults`, `creation`, `propagation`, `childRuntime`이 최소 facet이다.
2. shared catalog에는 serializable declaration만 둔다. builder-only creation,
   propagation, Skia filtering 함수는 entry의 adapter id를 통해 builder local map에서
   resolve한다.
3. 기존 registry는 "facet에서 파생 가능 + parity fixture green + contract ratchet green"인
   slice만 제거한다.
4. `rendererMap`의 모든 entry를 곧바로 없애지 않는다. generic fallback으로 대체 가능한
   entry는 삭제하고, load-bearing self-compose는 `render.adapter` facet으로 entry 소유권을
   옮긴 뒤 별도 registry drift surface를 제거한다.
5. `ComponentFactory.creators`는 no-child leaf, reusable composite origin, declared child
   template, factory delegate로 분류한다. delegate가 남는 동안에도 delegate id는 entry가
   소유해야 한다.
6. `DEFAULT_PROPS_MAP`은 binding `accepts.default`와 local default overlay로 전환한다.
   literal map은 entry-derived resolver가 대체한 row부터 제거한다.
7. `propagationRegistry`는 `ComponentSpec` 모양의 shadow object를 버리고 entry
   `propagation.rules`로 이관한다.
8. child filtering/injection은 entry `childRuntime` facet으로 declarative membership을
   옮긴다. 계열 고정 inline 예외는 entry allowlist와 grep gate로 추적한다.

> 구현 상세: [914-component-entry-universe-collapse-breakdown.md](../design/914-component-entry-universe-collapse-breakdown.md)

## Risks

| ID  | 위험                                                                                         | 심각도 | 대응                                                                                     |
| --- | -------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------- |
| R1  | `rendererMap` self-compose 제거가 RAC controller, wrapper DOM, child recursion skip을 깨뜨림 |  HIGH  | G3 render facet classification + per-family DOM/Skia/Preview parity                      |
| R2  | entry facet이 커져 `ComponentSpec v2`가 됨                                                   |  HIGH  | G0 schema boundary review. `ComponentRule` 확장 금지, executable 함수 shared import 금지 |
| R3  | default props 파생이 기존 palette add props를 바꿔 hydration/Panel baseline이 drift          |  HIGH  | G2 defaults golden fixture. 기존 literal row와 derived row deep-equal 비교               |
| R4  | propagation rule 이관 중 order/skip/child lookup grain이 바뀜                                |  HIGH  | G5 propagation fixture. parent edit -> child props/style diff 0                          |
| R5  | factory child tree 이관이 canonical id/order/reusable origin persistence를 깨뜨림            |  HIGH  | G4 creation fixture. add/refresh/origin idempotence/browser smoke                        |
| R6  | child-filtering facet이 Skia layout `filteredChildIds`와 Preview children 재귀를 분리        |  HIGH  | G6 childRuntime fixture. layout child ids, render commands, Preview child count parity   |
| R7  | 너무 넓은 sweep으로 ADR-913/Table/ListBox projection 등 인접 debt를 같이 끌어옴              | MEDIUM | phase scope cap. 한 phase는 한 facet + 한 proof family만 허용                            |

## Gates

| Gate                       | 시점              | 통과 조건                                                                                                                                                                                                                                          | 실패 시 대안                                                  |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| G0 Inventory freeze        | Phase 0           | `rendererMap`, `DEFAULT_PROPS_MAP`, factory creators, propagation registrations, child-runtime sets + ADR-139 baseline/exception의 count와 owner classification 문서화. ADR-912 카운트는 자기모순(factory 60/55/45)이라 source 불가 — 전수 재실측  | count 불명확 또는 ADR-912 숫자 베낌 시 구현 착수 금지         |
| G1 Entry contract scaffold | Phase 1           | `entryUniverseContract`가 existing component set을 읽고 registry별 missing/extra를 report. 아직 삭제 없음                                                                                                                                          | contract가 false green이면 ADR-139 contract 유지              |
| G2 Defaults proof          | Phase 2           | proof family에서 `getDefaultProps(type)` 결과가 기존 literal과 deep-equal, derived row만 literal 삭제                                                                                                                                              | mismatch 시 local overlay로 보정 후 재측정                    |
| G3 Render proof            | Phase 3           | renderer entry를 generic/internal/delegating/dead로 분류하고, 삭제 대상은 Preview DOM + Skia parity green                                                                                                                                          | self-compose 필요 발견 시 adapter facet으로 전환, 삭제 보류   |
| G4 Creation proof          | Phase 4           | factory creator 제거 family가 palette add, refresh, reusable origin hydration에서 canonical tree diff 0                                                                                                                                            | id/order drift 시 factory delegate 유지                       |
| G5 Propagation proof       | Phase 5           | parent prop edit 후 child props/style updates가 기존 propagation engine과 diff 0                                                                                                                                                                   | order/skip 모델 보강 전 registry 삭제 금지                    |
| G6 ChildRuntime proof      | Phase 6           | child filtering/injection membership이 entry facet에서 파생되고 layout filtered ids + render commands parity green                                                                                                                                 | Preview/Skia divergence 시 facet split                        |
| G7 Contract swap           | Phase 7           | `componentRegistrationContract`가 막던 missing drift를 `entryUniverseContract`가 전부 대체, baseline append 금지. exception allowlist(`TAG_SPEC_MAP` 11 / `rendererMap` 4 / `getDefaultProps` 2)의 intended 부재 차단 의미도 entry contract로 흡수 | exception 항목이 false missing 판정되면 두 contract 병행 유지 |
| G8 Live browser smoke      | 각 deletion phase | Builder add/edit/refresh + Preview console/page error 0. UI-visible change가 있으면 screenshot parity                                                                                                                                              | smoke 미실행 시 Implemented 승격 금지                         |

## Consequences

### Positive

- 새 component 추가 시 visual rule, renderer delegation, defaults, creation, propagation,
  child runtime이 한 entry universe에서 검토된다.
- 독립 registry drift를 contract로만 붙잡는 상태에서 벗어나 registry 자체를 phase별로 줄인다.
- ADR-912의 축 한정 문구를 해제할 명확한 완료 조건이 생긴다.
- `componentRegistrationContract`는 `entryUniverseContract`로 졸업할 수 있다.

### Negative

- 한 번에 삭제하는 작업이 아니다. proof slice별로 기존 registry와 entry facet이 병행되는 기간이 생긴다.
- shared/builder dependency boundary 때문에 entry declaration과 runtime adapter map이 분리된다.
- self-compose renderer와 composite factory는 일부 adapter delegate로 남을 수 있다. 단 그 delegate는
  entry가 소유하고 contract가 추적해야 한다.
- D1/D2/D3를 가로지르므로 각 phase는 browser/live 검증 없이는 닫을 수 없다.

## 진행 로그

### Phase 0~8 결과 (2026-06-20 ~ 2026-06-22)

entry universe spine + contract + 5 facet(render / defaults / creation / propagation / childRuntime)
proof 를 phase 별로 land 했다. 상세는 [breakdown](../design/914-component-entry-universe-collapse-breakdown.md) 참조.

| Phase                          | 결과                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Phase 0 Inventory Freeze       | ✅ Implemented 2026-06-20 — 5 surface 전수 재실측 (ADR-912 자기모순 카운트 불사용)                               |
| Phase 1 Entry Spine + Contract | ✅ Implemented 2026-06-20 — `entryUniverseContract` read-only spine, 삭제 0                                      |
| Phase 2 Defaults Facet         | ✅ Implemented 2026-06-20 — `DEFAULT_PROPS_MAP` 5 row 삭제 (Button/Badge/Link/ToggleButton/Text), Icon carve-out |
| Phase 3 Render Facet           | ✅ Phase 3-A SSOT 역전 (renderFacetDeclaration). Phase 3-B dead row 삭제 = **보류** (진짜 dead ≈ 0)              |
| Phase 4 Creation Facet         | ✅ Implemented 2026-06-21 — 3-mode + Avatar creator 제거 + COMPLEX_COMPONENT_TAGS SSOT 명문화                    |
| Phase 5 Propagation Facet      | ✅ Implemented 2026-06-21 — `createPropagationOnlySpec` shadow wrapper 31 family 전멸, rule-only 전환            |
| Phase 6 ChildRuntime Facet     | ✅ SYNTHETIC/POPOVER + (a) field visible filter Implemented. (b)(c) DROP (아래 Residual)                         |
| Phase 7 Contract Swap          | ✅ Implemented 2026-06-21 — `entryUniverseContract` 24 PASS, `componentRegistrationContract` 졸업 조건 정의      |

### Deletion 축 적대 검증 결론 (2026-06-22)

Decision 4~8 의 deletion 가능분이 더 남았는지 적대 검증(4 agents, refute-default byte-identical oracle)으로
실측한 결과 **confirmed 추가 삭제 후보 0건**. deletion 가능분은 이미 전부 land(Phase 2/4/5/6-a) 되었거나
정당하게 보류(아래 Residual)된 상태로, 추가로 끌어올 deletion slice 가 없다는 것이 deletion 축의 종착 상태다.

### Residual — 의도된 잔존 (closure blocker 아님)

| 영역                                                      | 분류               | 보류 사유                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision 4 — `rendererMap` dead row                       | **scope-out**      | 진짜 dead ≈ 0. legacy fallback(`preview/App.tsx:63` `?canonical=0` escape hatch 주석 + `:552`/`:784`/`:827` `rendererMap[type]` 룩업)이 의도된 안전망이라 cutover 54 row 전부 `rendererMap[type]` 도달 가능 = dead 아님. 삭제 선행조건(legacy 경로 제거 = render 아키텍처 재구축)은 §1 Out of scope (ADR-910 영역 근접)               |
| Decision 6 — `DEFAULT_PROPS_MAP` 86 row                   | **conflict-gated** | catalog default ↔ factory default 충돌 실측 확정 (CheckboxGroup/RadioGroup orientation vertical↔horizontal, Meter value 75↔50). G2 deep-equal fixture 0/86 (oracle 6종만). 프로젝트 §6 Deletion Rule("default props row 는 deep-equal fixture 없이 삭제 금지")이 차단. 전수 conflict 감사 + per-type overlay + fixture 작성 선행 필요 |
| Decision 7 — `registerPropagationSpec` dead adapter       | **parity-BC**      | production call 0건이나 `propagationRegistry.phase5.test.ts` parity oracle 이 능동 사용 + export BC + 등록 surface 실제 축소 0. 삭제하려면 parity test 재작성(또 다른 surface 추가) 선행 → surface-minimization 기준 작업 가치 0                                                                                                      |
| Decision 8 — (b) PROGRESSBAR/SLIDER / (c) Label necessity | **DROP**           | exclusion-default + prop-driven/live gating 이라 추출할 declarative membership 실체 0 → facet = dormant artifact. (b) 2026-06-21 / (c) 2026-06-22 DROP                                                                                                                                                                                |

부수 발견 (collapse 직교, 별도 fix scope): (c) recon 중 Form `necessityIndicator` 3(+1)경로 게이트 비대칭
정합성 버그 — implicitStyles 만 12-tag set gate, Skia/Taffy 는 prop-only. Form(set 밖, 유일 binding surface)
직속 bare Label 에서 측정↔렌더 발산. collapse 와 직교하므로 별도 fix scope 로 기록만 (즉석 fix/fork 금지, M3).

### 검증

- type-check baseline PASS (회귀 0)
- ADR-914 contract/proof 6 suite 55 tests PASS (entryUniverseContract 25 / componentRegistrationContract / propagationRegistry.phase5 / defaultPropsDerivation / getDefaultPropsEntryParity / renderFacetDeclarationContract)
- live builder exercise (2026-06-22): Button palette add → `deriveDefaultPropsFromCatalog("Button")` 파생 props(Primary/M/Fill/"Button"/Type=Button) 정상 적용 + 캔버스 렌더 + Inspector 표시 + Layers 노드 추가 정상. console error 0, unknown-tag warning 0. 검증 후 undo (store 무오염)
