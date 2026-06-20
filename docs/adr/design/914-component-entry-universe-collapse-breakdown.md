# ADR-914 구현 상세 - Component Entry Universe Collapse

> 본문: [914-component-entry-universe-collapse.md](../914-component-entry-universe-collapse.md).
> 본 문서는 phase, inventory, gate, deletion 기준만 보유한다.

## 0. 목표

ADR-912가 닫은 것은 시각, 구조, size SOURCE 축이다. ADR-914는 남은 component entry
runtime 권한을 같은 component entry universe로 모은다.

성공 조건은 다음과 같다.

- `rendererMap`, factory creators, `DEFAULT_PROPS_MAP`, propagation registry,
  child-runtime filtering set이 독립 손등록 source로 남지 않는다.
- load-bearing adapter 함수가 남더라도 entry facet이 adapter id를 소유하고 contract가
  누락/extra를 검출한다.
- `componentRegistrationContract`가 담당하던 신규 component 누락 차단 능력을
  `entryUniverseContract`가 대체한다.

## 1. Scope Lock

### In scope

| 축            | 현재 표면                                                                                      | ADR-914 목표                                                    |
| ------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| render        | `packages/shared/src/renderers/index.ts` `rendererMap`, Preview `DELEGATING_*` set             | `entry.render` facet으로 generic/internal/delegating/dead 분류  |
| defaults      | `apps/builder/src/types/builder/unified.types.ts` `DEFAULT_PROPS_MAP`                          | binding defaults + local overlay 파생                           |
| creation      | `ComponentFactory.creators`, `COMPLEX_COMPONENT_TAGS`                                          | `entry.creation` facet으로 none/reusable/template/delegate 분류 |
| propagation   | `apps/builder/src/builder/utils/propagationRegistry.ts`                                        | `entry.propagation.rules`                                       |
| child runtime | `SYNTHETIC_CHILD_PROP_MERGE_TAGS`, `POPOVER_CHILDREN_TAGS`, child filters, necessity injection | `entry.childRuntime` facet                                      |
| contract      | `componentRegistrationContract`                                                                | `entryUniverseContract` replacement                             |

### Out of scope

- ADR-913 visual value rebuild. Token/radius/color correction은 이 ADR에서 하지 않는다.
- `Group`, `frame`, `Slot` native/D1 infra 정리.
- Table variant/projection architecture 재설계.
- ADR-910/RAC Pencil format 전체 재구축.
- `ComponentRule`에 renderer/factory/propagation 필드를 직접 넣는 방식.
- 코드 실행 없는 dormant foundation. phase에서 소비처가 없는 facet은 추가하지 않는다.

## 2. Current Inventory Source

Phase 0은 아래 표면을 count와 owner classification으로 freeze한다.

| 표면                   | 기준 파일                                                                          | 현재 확인 포인트                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| shared render map      | `packages/shared/src/renderers/index.ts`                                           | `rendererMap` export                                                              |
| Preview delegation     | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`                    | `INTERNAL_RENDERERS`, `DELEGATING_INTERNAL_RENDERERS`, `DELEGATING_RAC_RENDERERS` |
| factory creators       | `apps/builder/src/builder/factories/ComponentFactory.ts`                           | `private static creators`                                                         |
| complex tags           | `apps/builder/src/builder/factories/constants.ts`                                  | `COMPLEX_COMPONENT_TAGS`                                                          |
| defaults               | `apps/builder/src/types/builder/unified.types.ts`                                  | `DEFAULT_PROPS_MAP`, `getDefaultProps`                                            |
| propagation            | `apps/builder/src/builder/utils/propagationRegistry.ts`                            | `createPropagationOnlySpec`, `registerPropagationSpec`                            |
| synthetic child merge  | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`              | `SYNTHETIC_CHILD_PROP_MERGE_TAGS`                                                 |
| layout child filtering | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`       | `POPOVER_CHILDREN_TAGS`, `filteredChildren` branches                              |
| registration contract  | `apps/builder/src/builder/factories/__tests__/componentRegistrationBaseline.json`  | ADR-139 baseline ratchet                                                          |
| registration exception | `apps/builder/src/builder/factories/__tests__/componentRegistrationException.json` | ADR-139 intended 부재 allowlist (`allowed()` = baseline OR exception)             |

Phase 0 산출물은 `docs/adr/design/914-entry-universe-inventory.md`로 둔다. 구현 phase는
inventory row를 수정하면서 진행한다.

### 2.1 ADR-912 inventory 카운트는 source가 아니다 (G0 재실측 강제)

ADR-912 본문은 같은 문서 안에서 factory 카운트가 자기모순이다 — `912.md:76`=60,
`912.md:59`=55(creators=`COMPLEX_COMPONENT_TAGS` 등치), `912.md:209`=45. 2026-06-20
실측은 `ComponentFactory.creators` 55키(54 함수, `Navigation`→`createNav` alias) /
`COMPLEX_COMPONENT_TAGS` 48이며, set-math상 `COMPLEX_COMPONENT_TAGS ⊊ creators`
(진부분집합, 차 7)라 `912.md:59`의 두 set 등치 자체가 틀렸다. 따라서 **G0 inventory는
ADR-912의 어떤 카운트도 신뢰하지 않고 위 표면 전부를 grep으로 전수 재실측한다.**
ADR-912 수치는 history 참고용일 뿐 source가 아니다. (adr-writing.md M3 — 추정 vs 실측
gap은 새 fork 사유가 아니라 Phase 0 inventory로 흡수.)

### 2.2 Registration exception은 baseline과 다르게 취급한다 (intended 부재 보존)

`componentRegistrationException.json`(2026-06-20 실측: `TAG_SPEC_MAP` 11 /
`rendererMap` 4 / `getDefaultProps` 2)은 baseline(해소 대상 known debt)과 달리
**영구 정당한 의도된 부재**다. `componentRegistrationContract.test.ts:94-95`의
`allowed()`는 `comp in exceptions[reg] || comp in baseline[reg]`로 양쪽에 의존하므로,
Phase 7 contract swap은 baseline(빈 객체)뿐 아니라 exception allowlist의 차단 의미를
누락 없이 가져가야 한다 (§3.3-8 / Phase 7 참조). exception 항목은 entry universe에서
"등록 없음이 정상(intended)"인 row로 모델링하고, 해소(삭제)하지 않는다.

## 3. Target Architecture

### 3.1 Entry facet shape (conceptual)

```ts
type ComponentEntryRuntime = {
  type: string;
  render?: {
    mode: "generic" | "internal" | "delegating" | "none";
    adapter?: string;
    childRecursion: "recursive" | "delegate" | "skip";
  };
  defaults?: {
    fromBinding?: true;
    overlay?: Record<string, unknown>;
  };
  creation?: {
    mode: "none" | "reusableOrigin" | "declaredChildren" | "delegate";
    adapter?: string;
    originId?: string;
  };
  propagation?: {
    rules: PropagationRuleDeclaration[];
  };
  childRuntime?: {
    syntheticPropMerge?: boolean;
    visibleChildren?: ChildFilterDeclaration;
    injections?: ChildInjectionDeclaration[];
  };
};
```

이 shape는 구현 지침이다. 실제 타입 이름과 위치는 phase에서 코드 구조에 맞춘다.

### 3.2 Dependency boundary

- `packages/shared/src/catalog`는 serializable declaration과 adapter id만 보유한다.
- Builder-only 함수는 builder local maps에서 adapter id로 resolve한다.
- Preview shared renderer 함수가 필요한 경우에도 entry가 adapter id를 소유하고,
  별도 `rendererMap` membership이 source가 되지 않게 한다.
- `ComponentRule`은 visual rule로 유지한다.

### 3.3 Replacement contract

`entryUniverseContract`는 최소 다음을 검증한다.

1. placeable component는 entry universe row를 가진다.
2. entry render facet과 actual Preview/renderer adapter map이 extra/missing 없이 일치한다.
3. defaults facet으로 `getDefaultProps(type)`를 resolve할 수 있다.
4. creation facet이 `ComponentFactory` delegation 여부를 설명한다.
5. propagation facet과 registered propagation rule set이 extra/missing 없이 일치한다.
6. childRuntime facet과 synthetic/filtering membership이 extra/missing 없이 일치한다.
7. 신규 component가 ADR-139 baseline 파일에 append되는 것을 계속 금지한다.
8. ADR-139 exception allowlist(`componentRegistrationException.json`: `TAG_SPEC_MAP`
   11 / `rendererMap` 4 / `getDefaultProps` 2)가 표현하던 "intended 부재" 차단 의미를
   entry universe row로 보존한다. baseline(해소 대상)과 달리 exception은 영구 정당한
   부재이므로, swap 후에도 `allowed()` = baseline OR exception이 막던 false-positive
   누락 차단 능력이 그대로 유지되는지 matrix로 증명한다.

## 4. Phases

### Phase 0 - Inventory Freeze ✅ Implemented 2026-06-20

> 산출물: [914-entry-universe-inventory.md](914-entry-universe-inventory.md) (commit `e41be0b49`).
> G0 통과: 9 표면 전수 재실측 (rendererMap 94 / INTERNAL 26 / DELEGATING_INTERNAL 18 /
> DELEGATING_RAC 10 / DEFAULT_PROPS_MAP 92[derived 6] / creators 55 / COMPLEX 48 /
> propagation 31 / SYNTHETIC 9 / POPOVER 2 / baseline 0·0·0 / exception 11·4·2).
> ADR-912 카운트 자기모순(creators 60/55/45 + COMPLEX 등치 오류) 확인 → source 불신.
> Explore agent 3 fan-out → main verifier 교차검증으로 agent 오류 2건 정정
> (rendererMap 78→94 / INTERNAL 27→26). docs-only, type-check exit 0.

목표: 삭제 전 count와 owner를 고정한다.

작업:

- `rendererMap` entry를 `generic-dead`, `internal-adapter`, `delegating-rac`,
  `delegating-internal`, `unknown`으로 분류.
- `DEFAULT_PROPS_MAP` row를 `binding-derived`, `literal-equivalent`, `literal-required`,
  `unknown`으로 분류.
- factory creators를 `no-child`, `declared-child-template`, `reusable-origin-ready`,
  `delegate-required`로 분류.
- propagation rules를 parent type별로 count하고 empty/no-op rule을 분리.
- child runtime sets/branches를 type membership 단위로 분류.
- ADR-139 baseline/exception 항목을 분리 분류. exception(`TAG_SPEC_MAP`/`rendererMap`/
  `getDefaultProps`)은 `intended-absent`로, baseline은 `debt`로 표기 (§2.2).

Gate:

- G0 inventory 문서가 신규 count를 포함한다.
- **ADR-912 카운트는 source가 아니다 (§2.1)** — 같은 문서 내 factory 수치 자기모순
  (60/55/45)이 확인됐으므로, 모든 표면을 grep으로 전수 재실측하고 ADR-912 숫자는
  history 참고로만 인용한다. count가 ADR-912와 다르면 ADR-914 inventory가 current
  source로 우선한다.
- exception allowlist(11/4/2)와 baseline을 분리 집계한다 — swap 대상(Phase 7)이
  baseline 뿐 아니라 exception 차단 의미까지 포함함을 inventory에 명시.

### Phase 1 - Entry Universe Spine + Contract (No Deletion) ✅ Implemented 2026-06-20

> commit `abb9acac1`. 신규 `entryUniverse.ts` (resolveComponentEntryRuntime /
> getEntryUniverseTypes — existing registry mirror read-only) + `entryUniverseContract.test.ts`
> (10/10 PASS). 표면 export 전환 3건 (propagationRegistry.getRegisteredPropagationTags /
> POPOVER_CHILDREN_TAGS / INTERNAL_RENDERERS — 값·동작 불변).
> G1 통과: contract current registry 1:1 green + negative fixture (`__Adr914FakeEntry__`
> 감지) + ADR-139 contract 병행 green (10/10, baseline append 금지 유지). type-check exit 0.
> additive read-only spine (런타임 경로 미연결, deletion 0) → revert 없이 비활성화 가능.

목표: 새 authority spine을 먼저 세운다.

작업:

- entry runtime resolver를 추가한다.
- existing registry를 읽어 entry facet을 mirror하는 read-only bridge를 둔다.
- `entryUniverseContract`를 추가하되 deletion은 하지 않는다.
- ADR-139 `componentRegistrationContract`는 유지한다.

Gate:

- contract가 current registry와 1:1로 green.
- negative fixture: entry 없는 신규 placeable component는 fail.
- baseline append 금지 유지.

### Phase 2 - Defaults Facet Proof 🟡 Phase 2a Implemented 2026-06-20 (Button), 나머지 4종 후속

> **Phase 2a (Button 단일, commit `3d64cea67`)**: 첫 deletion phase. `DEFAULT_PROPS_MAP` 의
> Button row 삭제 + `getDefaultProps` entry-derived (`ENTRY_DERIVED_DEFAULT_TYPES={Button}`) 단일
> source 이전. Plan 7-step (diff fixture → facet 확장 → Option A 분기 → 이중 contract proxy 권한
> 이전(reversible) → row 삭제 → G8 smoke). **Icon 제외** (random iconName 합성이 map row 에만
> 존재 → row 삭제 시 회귀). G2 통과: getDefaultPropsEntryParity 4/4 (deep-equal + strict key-set) +
> 두 contract 병행 20/20 + ADR-912 oracle 3/3. 회귀 0 (stash baseline 비교, vitest 58fail 전부
> pre-existing). G8 live: Button derived props(primary/md/fill) 정상 렌더. nested `<button>` 부수
> 발견은 creation 영역 (inventory §10, Phase 4).
>
> **Phase 2b 후속 (미착수)**: Badge/Link/ToggleButton/Text 를 `ENTRY_DERIVED_DEFAULT_TYPES` 에
> 추가 + 각 row 삭제 (각 deep-equal + strict key-set + G8 smoke 통과 후). Icon 은 carve-out 유지.

목표: `DEFAULT_PROPS_MAP` literal row를 entry-derived resolver로 대체한다.

우선 proof 후보:

- ADR-912에서 이미 `deriveDefaultPropsFromCatalog`로 닫힌 Button, Link, ToggleButton,
  Badge, Text, Icon을 golden baseline으로 삼는다.
- 다음 slice는 child 없는 leaf, binding default가 명확한 component만 선택한다.

작업:

- `getDefaultProps(type)`가 entry defaults resolver를 먼저 사용하도록 한다.
- literal row와 derived result deep-equal fixture를 추가한다.
- green row만 `DEFAULT_PROPS_MAP`에서 제거한다.

Kill criteria:

- `undefined`와 absent prop 차이로 Panel/hydration output이 바뀌면 삭제 중단.
- binding default가 RSP semantics와 충돌하면 local overlay로 명시하고 row 삭제 보류.

### Phase 3 - Render Facet Proof

목표: `rendererMap` membership을 entry render facet으로 소유권 이전한다.

분류:

- `generic`: Preview generic fallback으로 충분하다.
- `internal`: `INTERNAL_RENDERERS` adapter가 필요하다.
- `delegating`: `(element, context)` 계약, `childrenByParent`, child recursion skip이 필요하다.
- `none`: DOM에 독립 node가 도달하지 않는다.
- `dead`: current render path에서 도달하지 않는다.

작업:

- `DELEGATING_INTERNAL_RENDERERS`와 `DELEGATING_RAC_RENDERERS`를 entry render facet에서 파생한다.
- dead/generic row만 `rendererMap`에서 제거한다.
- delegating row는 adapter facet으로 옮긴 뒤 map membership이 entry-derived인지 검증한다.

Gate:

- Preview DOM className/data attrs/children count parity.
- Skia unchanged or explicitly matching.
- React unknown-tag warning 0.

### Phase 4 - Creation Facet Proof

목표: `ComponentFactory.creators`를 creation facet으로 축소한다.

분류:

- `none`: factory child tree가 필요 없는 leaf.
- `reusableOrigin`: Toolbar/Form 선례처럼 Components page reusable origin으로 대체 가능.
- `declaredChildren`: small static child template으로 선언 가능.
- `delegate`: event handler, data binding, child id/order logic 때문에 함수 유지 필요.

작업:

- creation facet resolver를 추가한다.
- proof family 하나에서 creator를 제거하거나 adapter id 소유권을 entry로 옮긴다.
- `COMPLEX_COMPONENT_TAGS` membership을 creation facet에서 파생한다.

Gate:

- palette add canonical tree diff 0.
- refresh after add에서 origin/component page idempotent.
- undo/redo/delete가 기존과 동일.

### Phase 5 - Propagation Facet Proof

목표: `createPropagationOnlySpec` shadow object를 제거한다.

작업:

- `PropagationRuleDeclaration`을 entry facet에 둔다.
- current `registerPropagationSpec(type, spec)` adapter가 entry rules를 읽게 한다.
- proof family 하나에서 spec-shaped constant를 제거한다.

Gate:

- parent prop edit -> child props/style update diff 0.
- skip-if-set, styleValue, parentProp optional behavior parity.
- order-sensitive propagation fixture green.

### Phase 6 - ChildRuntime Facet Proof

목표: child filtering/injection membership을 entry childRuntime facet으로 이전한다.

대상:

- `SYNTHETIC_CHILD_PROP_MERGE_TAGS`.
- `POPOVER_CHILDREN_TAGS`.
- Label necessity injection.
- field/collection visible child filtering branches.

작업:

- declarative membership부터 이관한다.
- function-level filter가 필요한 경우 adapter id로 분리한다.
- `filteredChildIds`와 render command child boundaries를 fixture로 고정한다.

Gate:

- layout `filteredChildIds` parity.
- render commands child begin/end parity.
- Preview children count parity.

### Phase 7 - Contract Swap + Registry Cleanup

목표: `entryUniverseContract`를 primary gate로 승격한다.

작업:

- ADR-139 contract가 검증하던 missing/extra를 entry contract가 포함하는지 matrix로 증명한다.
- **exception allowlist 흡수**: `componentRegistrationException.json`의 intended 부재
  (`TAG_SPEC_MAP` 11 / `rendererMap` 4 / `getDefaultProps` 2)를 entry universe row의
  "등록 없음이 정상" 선언으로 옮기고, `allowed()` = baseline OR exception이 막던
  false-positive 누락 차단을 entry contract가 동일하게 수행하는지 항목별 matrix로 증명한다
  (§3.3-8). exception은 해소(삭제) 대상이 아니라 영구 보존이므로, swap 후 이 11/4/2
  항목이 "누락 아님(intended)"으로 계속 통과해야 한다.
- 기존 registry baseline file append path를 제거하거나 entry contract로 redirect한다.
- README/ADR status를 갱신한다.

Gate:

- `componentRegistrationContract`와 `entryUniverseContract` 병행 green 기간 1 phase 이상.
- **exception 흡수 matrix green**: 11/4/2 intended-absent 항목이 entry contract에서도
  "누락 아님"으로 통과하고, baseline(빈 객체) + exception 양쪽 차단 의미가 누락 없이
  이관됐음을 증명. exception 항목 중 단 하나라도 false-positive로 missing 판정되면 swap 보류.
- registry별 leftover가 entry-owned adapter인지 독립 source인지 final audit.

## 5. Verification Matrix

각 deletion phase는 최소 아래를 수행한다.

| 범위               | 검증                                                  |
| ------------------ | ----------------------------------------------------- |
| docs-only planning | `git diff --check`                                    |
| TypeScript 변경    | `pnpm run codex:typecheck`                            |
| factory/defaults   | targeted Vitest + add/refresh smoke                   |
| render facet       | Preview DOM assertion + React warning 0 + Skia parity |
| propagation        | parent edit -> child diff fixture                     |
| childRuntime       | layout filtered ids + render command fixture          |
| final phase        | `pnpm run codex:preflight`                            |

## 6. Deletion Rules

- 삭제는 facet-derived path가 green인 row만 한다.
- one phase에서 두 축을 동시에 삭제하지 않는다.
- `rendererMap` delegating row는 "generic으로 보인다"는 grep만으로 삭제하지 않는다.
- factory creator는 child tree diff fixture 없이는 삭제하지 않는다.
- default props row는 deep-equal fixture 없이는 삭제하지 않는다.
- propagation row는 order fixture 없이는 삭제하지 않는다.
- child filtering branch는 layout/Preview/Skia parity fixture 없이는 삭제하지 않는다.

## 7. Rollback

- Phase 1 spine은 additive이므로 revert 없이 비활성화 가능해야 한다.
- 각 facet deletion commit은 registry row 삭제와 contract ratchet을 같은 commit에 묶는다.
- live smoke에서 regression이 나오면 해당 facet row만 원복하고 inventory에 `delegate-required`
  또는 `literal-required`로 재분류한다.

## 8. Review Checklist

- ADR-912 완료 범위를 visual/structure/size SOURCE 축으로만 표현했는가.
- "전부 제거"를 독립 registry 제거로 정의했는가.
- load-bearing adapter 함수 잔존을 실패가 아니라 entry-owned delegate로 분류했는가.
- `ComponentRule`을 확장해 ComponentSpec v2를 만들지 않았는가.
- shared -> builder dependency를 만들지 않았는가.
- deletion 전 contract와 golden fixture가 있는가.
- browser/live 검증 없이 Implemented 승격하지 않는가.
