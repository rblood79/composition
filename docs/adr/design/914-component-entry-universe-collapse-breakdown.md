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

### Phase 2 - Defaults Facet Proof ✅ Implemented 2026-06-20 (Phase 2a Button + Phase 2b Badge/Link/ToggleButton/Text)

> **Phase 2a (Button 단일, commit `3d64cea67`)**: 첫 deletion phase. `DEFAULT_PROPS_MAP` 의
> Button row 삭제 + `getDefaultProps` entry-derived (`ENTRY_DERIVED_DEFAULT_TYPES={Button}`) 단일
> source 이전. Plan 7-step (diff fixture → facet 확장 → Option A 분기 → 이중 contract proxy 권한
> 이전(reversible) → row 삭제 → G8 smoke). **Icon 제외** (random iconName 합성이 map row 에만
> 존재 → row 삭제 시 회귀). G2 통과: getDefaultPropsEntryParity 4/4 (deep-equal + strict key-set) +
> 두 contract 병행 20/20 + ADR-912 oracle 3/3. 회귀 0 (stash baseline 비교, vitest 58fail 전부
> pre-existing). G8 live: Button derived props(primary/md/fill) 정상 렌더. nested `<button>` 부수
> 발견은 creation 영역 (inventory §10, Phase 4).
>
> **Phase 2b (Badge/Link/ToggleButton/Text, commit `774cf1f79`)**: Phase 2a 메커니즘 4종 확장.
> `ENTRY_DERIVED_DEFAULT_TYPES={Button,Badge,Link,ToggleButton,Text}` + `DEFAULT_PROPS_MAP` 4 row
> 삭제. 4종 모두 현 row 가 이미 `deriveDefaultPropsFromCatalog` 위임이라 row 삭제 = 호출 경로 단축,
> 값 byte-identical (conflict 0, random 합성 0). **Icon 은 carve-out 유지** (random iconName).
> G2 통과: getDefaultPropsEntryParity PROOF_FAMILY 5종 (deep-equal + strict key-set + facet==accessor
>
> - source 분기) + 영향 4 suite 27 tests PASS (entryUniverseContract / componentRegistrationContract
>   ADR-139 invariant B / ADR-912 oracle). 회귀 0 (stash baseline 58fail/1698pass == 적용 후 동일).
>   G8 live (HMR builder, projectId `6fca094a`): `getDefaultProps` live import 4종 oracle byte-identical
>   PASS + palette-add factory→store Text props `{size:md, children:Text}` = oracle 일치 PASS (원복 완료).

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

> **Phase 3-A (파생 역전, 삭제 0) ✅ Implemented 2026-06-20 (commit `1998a611d`)**:
> delegating render facet 의 SSOT 를 `renderFacetDeclaration.ts` 로 역전했다. 기존엔
> `entryUniverse.ts` 가 `CanonicalNodeRenderer.tsx` 의 `DELEGATING_INTERNAL_RENDERERS`(18) /
> `DELEGATING_RAC_RENDERERS`(10) set 을 _읽어서_ mirror 했는데(Phase 1 read-only spine), 이제
> 두 소비처(CanonicalNodeRenderer hot-path 분기 + entryUniverse render facet mode 판정)가
> **동일 declaration 을 source 로 공유**한다. set 28종 membership + 위임 사유는 declaration 으로
> 1:1 이전됐고, 두 set 은 `deriveDelegatingInternalRenderers()` / `deriveDelegatingRacRenderers()`
> 파생으로 교체됐다 (값 byte-identical, insertion order 보존). circular import 없음 (declaration
> 은 순수 데이터, defaultPropsDerivation Option A 패턴 동형).
>
> **삭제 0**: `rendererMap` dead/generic row 삭제는 본 phase 에서 하지 않는다 (§6: "generic
> 으로 보인다는 grep 만으로 삭제 금지"). dead 확증은 row 별 도달성 검증이 끝난 **별도 slice
> (Phase 3-B)**. INTERNAL_RENDERERS(26 React.ElementType 매핑)는 declaration scope 밖이라
> CanonicalNodeRenderer export 유지.
>
> **검증**: `renderFacetDeclarationContract.test.ts` parity A (파생 set == 현 28종 멤버+순서) /
> B (inventory 18+10) / C (위임 사유 무손실) + entryUniverseContract 17/17 PASS + type-check
> exit 0 회귀 0 + full builder suite stash-baseline attribution (58fail/1698pass baseline →
> 58fail/1705pass, 새 contract 7 PASS, 새 fail 0; `CanonicalNodeRenderer.field.test.tsx` 2 fail 은
> baseline 격리 재현으로 pre-existing 확정) + G8 live (HMR'd 모듈에서 파생 set == export set
> byte-identical / entry facet mode 정상 / Home 페이지 delegating-internal Nav 정상 렌더 +
> rawLeak 0 + React unknown-tag warning 0).
>
> **Phase 3-B (rendererMap dead row 삭제) — 보류 결론 2026-06-21 (recon 완료, 삭제 0)**:
> dead row 식별 recon 결과 **진짜 dead ≈ 0** — 삭제 보류. legacy 경로 제거가 선행돼야 성립하며
> 그것은 ADR-914 scope 밖이다.
>
> **recon 방법**: Explore agent 2 병렬(App.tsx legacy 경로 도달성 + delegating 자식 렌더 경로)
> → main verifier file:line 교차검증. 진단 probe(임시 vitest)로 set 연산 추출 후 probe 삭제.
>
> **3경로 도달성 (dead 판정 기준)**:
>
> | 경로             | 동작 (file:line)                                                                                                                                                                                                                                                          | dead 영향                                 |
> | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
> | canonical 최상위 | `App.tsx:873-915` (default). cutover→generic, delegating→`rendererMap[type]` 위임                                                                                                                                                                                         | cutover 54 top-level 이 generic 으로 빠짐 |
> | legacy fallback  | `App.tsx:925-993`. `?canonical=0` opt-out **또는** canonical 빈결과(`:896`)/예외(`:916`) 시 — cutover 무시, `rendererMap` 을 **모든 type 1차 진입점**으로 사용 (3 함수: renderElementInternal `:552` / renderLayoutElement `:784` / renderPageElementWithChildren `:827`) | **여기서 거의 모든 row 가 LIVE**          |
> | delegating 자식  | `recursiveRenderElement` (`CanonicalNodeRenderer.tsx:354-379`). sub-part 는 부모 self-compose, cutover 미대상 sub-part 는 generic raw tag                                                                                                                                 | sub-part self-compose 가 정본             |
>
> **결론 근거**: legacy fallback 은 `App.tsx:871` 주석("document 미수신/resolve 실패 시 legacy
> fallback") + `:63` 주석("`?canonical=0` 명시적 opt-out 가능")이 명시하는 **의도된 안전망/escape
> hatch** 이지 dead 가 아니다. legacy 가 살아있는 한 cutover 54 top-level row 전부가 `?canonical=0`
> 또는 canonical 실패 시 `rendererMap[type]` 으로 도달 가능 = dead 아님. §6("generic 으로 보인다는
> grep 만으로 삭제 금지")이 정확히 이 상황을 경고 — set 연산상 "cutover→canonical generic" 이
> 사실이어도 legacy 도달성을 무시한 삭제는 `?canonical=0` 즉시 파손.
>
> **sub-part 분류**: (a) rendererMap **미등록** 12종(SelectTrigger/SelectValue/SelectIcon/SliderTrack/
> SliderOutput/SliderThumb/ProgressBarTrack/ProgressBarValue/MeterTrack/MeterValue/TableRow/TableCell)
> = 삭제 대상 자체 없음(row 부재). (b) **등록** 9종(ListBoxItem/GridListItem/TreeItem/Tag/TabList/
> TabPanels/Breadcrumb/Column/Cell) = 부모 delegating renderer self-compose 가 정본이라 직접 함수
> 호출처 0 이지만, legacy `renderElement → rendererMap[type]` 간접 경로에서 sub-part element 가
> tree 에 존재하면 도달 → "self-compose 라 dead" 단정은 legacy 안전망 무시 (recon agent over-claim
> 을 main 검증으로 정정).
>
> **선행조건 (Phase 3-B 성립 조건)**: legacy fallback 경로(App.tsx 3 함수) 제거 또는 sub-part 가
> canonical 에서 별도 노드로 비존재 증명. legacy fallback 제거 = render 경로 아키텍처 + `?canonical=0`
> 안전망 제거 결정 = **ADR-914 scope 밖** (§1 Out of scope, render 경로 재구축은 ADR-910 영역에 근접).
> 별도 ADR/결정 사항이며 본 phase 에서 자동 진행하지 않는다.
>
> **Phase 3 종합**: Phase 3-A 로 render facet **SSOT 역전**(declaration single source)은 완결됐다.
> §3.3-2 "entry render facet 과 actual adapter map 이 extra/missing 없이 일치" 는 Phase 3-A 의
> `renderFacetDeclarationContract` + `entryUniverseContract` 로 충족. dead row 삭제(Phase 3-B)는
> legacy 안전망 제거 선행 작업 뒤로 분리.

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

> **Phase 4-A (creation facet 3-mode) + 4-B (Avatar creator 제거) ✅ Implemented 2026-06-21**
>
> recon (Workflow w86cnogm1, 5 recon + 3 적대 검증) + 사용자 결정 2건 후 진행. 4-C
> (COMPLEX membership 방향 역전)는 별도 sub-phase 로 분리 (R7 한 phase 한 facet 한 family).
>
> **4-A — creation facet 3-mode 확장**: `CreationFacetMode` binary `none|complex` →
> `none|reusableOrigin|complex` (`entryUniverse.ts:54`). `resolveCreationMode()` 가
> reusableOrigin(`REUSABLE_COMPOSITE_ORIGINS` 파생, 추가 손등록 0) > complex
> (`COMPLEX_COMPONENT_TAGS`) > none(leaf) 우선순위로 판정. 사용자 결정 (2026-06-21):
> delegate(Table custom creator) 식별용 새 손등록 set 은 collapse 목적(surface 감소)에
> 역행하므로 미도입 — declaredChildren/delegate 는 complex 에 포괄.
>
> **4-B — Avatar creator 제거 (proof family 1개, surface-minimization)**: `createAvatar`
> 메서드 + `creators` 맵 Avatar 키 + 미사용 import 제거 (`ComponentFactory.ts`).
> Avatar 는 `COMPLEX_COMPONENT_TAGS` 미포함 leaf → `useElementCreator:192` COMPLEX gate
> 뒤 `createComplexComponent` 도달 0 (dead creator). palette-add 는 항상 else 분기
> (`useElementCreator:203-260`) 로 `getDefaultProps("Avatar")` 단일 element 생성.
>
> **G4 (palette add tree diff 0) 보증**: else 분기 `getDefaultProps("Avatar")` ==
> 구 `createAvatarDefinition` parent.props **byte-identical** + 자식 0 → creator 삭제
> 전후 tree 불변. `entryUniverseContract.test.ts` G4 oracle 로 코드 고정. definition
> 함수 자체는 `DisplayComponents.ts` 에 보존 (factoryOwnership.test).
>
> **placeable SSOT 분리 확증**: palette UI `placeable` = `PALETTE_ORDER` + 하드코딩
> (`paletteItems.ts:247`) — `getRegisteredTypes()` 와 독립. Avatar creator 제거 →
> ComponentFactory placeable(`getRegisteredTypes`)에서만 빠짐, palette 노출 영향 0.
>
> **nested-button (inventory §10) scope 제외 (사용자 결정)**: 적대 검증(verify-0)이
> "creation element 2개 생성" 주장을 REFUTE — standalone Button 자식 생성 0,
> 동일 id/timestamp 2겹 emit 은 `CanonicalNodeRenderer.tsx:424` render seam(Phase 3).
> Phase 4(creation) scope 아님.
>
> 검증: type-check 0 신규 위반 (baseline 71 불변, ComponentFactory 라인 시프트만 갱신) +
> entryUniverseContract 15 passed (신규 5 + G4 oracle) + 회귀 0 (selectFamilyFactoryLayout
> 2 fail 은 ADR-912 R1 pre-existing, HEAD baseline 동일 재현 attribution 확정) + dev server
> HTTP 200 transform 0 + **live: builder 에서 Avatar palette-add 정상 렌더 사용자 confirm**.
> INVENTORY.creators 55 → 54.
>
> **Phase 4-C (COMPLEX_COMPONENT_TAGS membership SSOT 명문화) ✅ Implemented 2026-06-21**
>
> 사용자 결정 (2026-06-21, AskUserQuestion): **방향 B — 별도 declaration 파일 신설 없이
> `constants.ts` 의 `COMPLEX_COMPONENT_TAGS` 자체를 creation facet `complex` mode 의 SSOT
> 로 명문화**. 전제 점검 결과 Phase 3-A (renderFacetDeclaration) 와 prerequisite 가 다름:
> Phase 3-A 는 set 정의가 2곳(CanonicalNodeRenderer) 분산 + circular import 위험을 declaration
> 신설로 해소한 실질 가치가 있었으나, 4-C 의 두 소비처(`entryUniverse.ts:183` /
> `useElementCreator.ts:192`)는 **이미 동일 `constants.ts` 단일 SSOT 를 공유**하고 circular
> import 도 분기도 없다. declaration 신설은 surface 만 늘릴 뿐 collapse 목적(손등록 surface
> 감소)에 역행 → 차단 메모리 feedback-execute-adr-surface-minimization 정합. 따라서 set 자체를
> SSOT 로 명문화하고 contract 가 facet ⟺ membership 정합을 검증.
>
> **변경 (런타임 동작 0, JSDoc + contract test 만)**:
>
> - `constants.ts` — `COMPLEX_COMPONENT_TAGS` JSDoc 을 creation facet `complex` mode SSOT 로
>   계약화 (양방향 1:1 + 소비처 2곳 congruent 명시). 비주석 변경 라인 0.
> - `entryUniverse.ts` — `resolveCreationMode()` JSDoc 에 membership SSOT 소유 관계 명시
>   (complex⟸COMPLEX_COMPONENT_TAGS / reusableOrigin⟸isReusableCompositeType). 비주석 라인 0.
> - `entryUniverseContract.test.ts` — Phase 4-C 신규 3 test: (a) complex mode ⟺
>   COMPLEX_COMPONENT_TAGS 양방향 parity (정·역방향, reusableOrigin 우선순위 고려) (b)
>   reusableOrigin mode ⟺ isReusableCompositeType (c) 세 mode disjoint (none ∩ complex ∩
>   reusableOrigin = ∅). count-only(==48) 검증을 ownership 증명으로 격상.
>
> **검증**: type-check 0 신규 위반 (baseline 71 불변 — JSDoc-only 라 코드 라인 시프트 0) +
> entryUniverseContract 18 passed (15 + 신규 3) + factories `__tests__` 5 suite 72 passed
> 회귀 0 + 두 source 파일 비주석 변경 라인 0 확인 (런타임 동작 불변 → Phase 4-B live confirm
> 유효, 추가 live exercise 불요). §3.3-4 "creation facet 이 ComponentFactory delegation 여부를
> 설명" + breakdown §4 작업 3번 "COMPLEX_COMPONENT_TAGS membership 을 creation facet 에서 파생"
> 충족 (declaration 역전 대신 SSOT 명문화 + contract 소유 증명으로 달성).

목표: `ComponentFactory.creators`를 creation facet으로 축소한다.

분류:

- `none`: factory child tree가 필요 없는 leaf.
- `reusableOrigin`: Toolbar/Form 선례처럼 Components page reusable origin으로 대체 가능.
- `declaredChildren`: small static child template으로 선언 가능.
- `delegate`: event handler, data binding, child id/order logic 때문에 함수 유지 필요.

작업:

- creation facet resolver를 추가한다.
- proof family 하나에서 creator를 제거하거나 adapter id 소유권을 entry로 옮긴다.
- `COMPLEX_COMPONENT_TAGS` membership을 creation facet에서 파생한다. ← ✅ **4-C Implemented 2026-06-21** (declaration 역전 대신 set 자체를 SSOT 로 명문화 + contract 양방향 parity 소유 증명)

Gate:

- palette add canonical tree diff 0. ← ✅ G4 oracle 보증 + live confirm
- refresh after add에서 origin/component page idempotent. ← ✅ 단일 element, live confirm
- undo/redo/delete가 기존과 동일. ← ✅ 단일 element (창작 경로 불변, else 분기)

### Phase 5 - Propagation Facet Proof

> **Phase 5 (proof family = Switch) ✅ Implemented 2026-06-21**
>
> 사용자 결정 (2026-06-21, AskUserQuestion): proof family **1개 + adapter 신설** (R7
> 한 phase 한 facet 한 family). 28 family 전체 전환은 회귀 위험 HIGH(28 family live 동작
> 영향) + R7 위반이라 보류, 나머지 27 family 의 `createPropagationOnlySpec` 제거는 후속
> slice.
>
> **구조 통찰**: 모든 consumer(`buildSpecNodeData` / `fullTreeLayout` / `propagationEngine` /
> `PropertiesPanel`)는 `getPropagationRules` / `getParentTagsForChild` /
> `getRegisteredPropagationTags` **3 API 만** 소비하고 `ComponentSpec` object 자체를 읽지
> 않는다 (`registerPropagationSpec` 도 내부에서 `spec.propagation.rules` 만 추출). 따라서
> shadow `ComponentSpec` wrapper(element/variants/sizes/states/render 전부 dummy)는 dead weight.
>
> **변경**:
>
> - `propagationRegistry.ts` — `registerPropagationRules(type, rules)` adapter 신설
>   (shadow spec 없이 rule 배열 직접 등록). `ensureBuilt` 가 `specEntries`(shadow) +
>   `ruleEntries`(rule-only) 양쪽을 동일 `indexEntry` 헬퍼로 순회 → forwardIndex/reverseIndex
>   byte-identical. proof family **Switch**: `switchPropagationSpec` shadow object →
>   `switchPropagationRules: PropagationRule[]` + `registerPropagationRules("Switch", ...)`.
>   `_resetPropagationRegistry` 가 ruleEntries 도 초기화.
> - `propagationRegistry.phase5.test.ts` (신규) — order/parity fixture 6 test:
>   rule-only 등록 == shadow spec 등록 deep-equal / order 보존(size→children) / 필드
>   무손실(override/childProp) / reverse index `switch`∈parents(Label) / registered set
>   포함 / shadow+rule-only 혼재 공존.
>
> **검증**: type-check 0 신규 위반 (baseline 71 불변) + Phase 5 fixture 6 passed (rule-only
> ⟺ shadow spec byte-identical) + entryUniverseContract 18 passed (propagation facet
> `registered` 에 Switch 정상) + **회귀 0** (clean baseline 58 fail/1713 pass ↔ 적용 후
> 58 fail/1719 pass — fail 동일, pass +6 = 신규 fixture, /tmp checkout-HEAD attribution
> 확정. 58 fail 전부 pre-existing ADR-913 snapshot 등 propagation 직교) + **live: builder
> 에서 Switch size/children 편집 → 자식 Label 전파 정상 사용자 confirm**.

> **Phase 5 후속 slice (나머지 30 family shadow spec 제거) ✅ Implemented 2026-06-21**
>
> Phase 5 의 `registerPropagationRules` adapter (byte-identical 검증 완료) 를 나머지 전
> family 에 적용. proof family Switch 외 30 family 의 `createPropagationOnlySpec(name, rules)`
> shadow ComponentSpec wrapper → `xxxPropagationRules: PropagationRule[]` 상수 +
> `registerPropagationRules(type, rules)` 직접 등록. 사용자 결정 (2026-06-21,
> AskUserQuestion): 후속 slice = "Phase 5 — 27 propagation family" (실측 30, Switch 제외).
>
> **변경** (`propagationRegistry.ts` 단일 파일, 순 -50줄):
>
> - 28 변수형 spec (`cardPropagationSpec` … `comboBoxPropagationSpec`) +
>   collection item 2개 (`createCollectionItemPropagationSpec("GridListItem"/"ListBoxItem")`
>   → 단일 상수 `collectionItemPropagationRules` 공유, name 무관 동일 rule) → 전부 rule 배열.
> - 30 `registerPropagationSpec(type, xxxSpec)` 호출 → `registerPropagationRules(type, xxxRules)`.
> - `createPropagationOnlySpec` shadow wrapper 정의 + `noopShapes` + `Shape` import 제거
>   (호출처 0). `registerPropagationSpec` adapter + `specEntries` 는 **병행 보존** (dead
>   adapter 제거는 R7 surface 확대 + export BC → 별도 판단, 본 slice 는 shadow 제거 본질에 집중).
>
> **검증**: type-check exit 0 + Phase 5 fixture 6 passed + entryUniverseContract 24 passed +
> factories `__tests__` 78 passed (회귀 0) + **oracle byte-identical 갈음**: 변환 전후 전체
> registry forward(`getPropagationRules`) + reverse(`getParentTagsForChild`) 31 tags 전수
> JSON diff = 0 (변환 전 baseline ↔ 변환 후 post snapshot). 변경=등록 형태만, rule 데이터
> byte-identical → consumer 5개(buildSpecNodeData/fullTreeLayout/PropertiesPanel/
> propagationEngine/entryUniverse)가 3 API 만 소비(Phase 5 구조 통찰) → propagation engine
> 입력 동일 → 사용자-가시 전파 동작 불변. live: Chrome 확장 미연결로 MCP 불가 → 사용자 결정
> (oracle byte-identical 로 갈음, Phase 5 의 live Switch confirm 을 30 family 확장). G5 (parent
> prop edit → child diff 0) 충족 (oracle = registry 출력 동일성 = engine 입력 동일성).

목표: `createPropagationOnlySpec` shadow object를 제거한다.

작업:

- `PropagationRuleDeclaration`을 entry facet에 둔다. ← ✅ rule 배열을 SSOT 로 (Switch proof)
- current `registerPropagationSpec(type, spec)` adapter가 entry rules를 읽게 한다. ← ✅ `registerPropagationRules` adapter 신설 (ensureBuilt 양쪽 순회)
- proof family 하나에서 spec-shaped constant를 제거한다. ← ✅ Switch `switchPropagationSpec` 제거 + **후속 slice 로 나머지 30 family 전부 `createPropagationOnlySpec` shadow wrapper 제거 (Implemented 2026-06-21, oracle byte-identical)**

Gate:

- parent prop edit -> child props/style update diff 0. ← ✅ fixture byte-identical + live confirm
- skip-if-set, styleValue, parentProp optional behavior parity. ← ✅ fixture 필드 무손실 (Switch 는 override only, skipIfSet/styleValue 는 CardHeader 등 27 family 후속)
- order-sensitive propagation fixture green. ← ✅ order 보존(size→children) fixture green

### Phase 6 - ChildRuntime Facet Proof

> **Phase 6 (proof family = SYNTHETIC_CHILD_PROP_MERGE_TAGS 단일 메커니즘) ✅ Implemented 2026-06-21**
>
> recon (Workflow w8rz17q0t, 4 recon + 4 적대 검증) + 사용자 결정 2건 후 진행. 4 child-runtime
> 메커니즘 중 **SYNTHETIC 만** 순수 declarative-transfer/LOW (적대 검증 recon-confirmed). 나머지
> 3개는 Phase 5 식 안전 transfer 불가 → 후속 slice/adapter 설계로 분리 (R7 한 phase 한 facet 한
> family).
>
> **4 메커니즘 recon+적대 검증 판정**:
>
> | 메커니즘                          | 멤버       | transfer 판정 (적대 검증 후) | risk | 근거 (file:line)                                                                                                          |
> | --------------------------------- | ---------- | ---------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
> | `SYNTHETIC_CHILD_PROP_MERGE_TAGS` | 9          | declarative-transfer ✅      | LOW  | 5 소비처 전부 단순 `set.has(type)` boolean (buildSpecNodeData:915/1243 + StoreRenderBridge:315/320/549)                   |
> | `POPOVER_CHILDREN_TAGS`           | 2          | declarative (facet dormant)  | MED  | 단순 `set.has()` 1 소비처 (implicitStyles:1962) 이나 facet mirror 미사용 지적                                             |
> | Label necessity injection         | 12-tag+DFS | adapter-id-required          | HIGH | 3경로 동기화(CSS/Taffy/Skia) + DFS 부모 traversal (implicitStyles:2214 / fullTreeLayout:1155 / buildSpecNodeData:1085)    |
> | field/collection visible filter   | 14 분기    | adapter-id-required          | MED  | `formatProgressValue`/`sliderFormattedValue` live-prop 동적 합성 (implicitStyles:1657/1772) — byte-identical fixture 불가 |
>
> **사용자 결정 (2026-06-21, AskUserQuestion 2건)**:
>
> 1. **scope = SYNTHETIC 단일 source transfer** (R7). 차단 메모리 우선 평가:
>    necessity/field-filter 를 지금 facet 으로 끌어올리면 소비처가 mirror 만 읽는 dormant
>    foundation 위험(feedback-no-dormant-foundation-ahead-of-flip) + 4 메커니즘 동시 = surface
>    폭증(feedback-execute-adr-surface-minimization). 따라서 SYNTHETIC 단일로 좁힘.
> 2. **방식 = SSOT 명문화 + contract 소유증명** (Phase 4-C 식). set 정의 위치
>    (buildSpecNodeData.ts:187)는 유지, childRuntime facet 이 이 membership 을 소유함을 JSDoc
>    계약 + entryUniverseContract 양방향 parity 로 증명. 5 소비처 직접 `SYNTHETIC.has()` 호출은
>    정본 유지(이미 단일 set import — surface 증가 0). 런타임 동작 0 변경 → 회귀 위험 LOW.
>
> **변경 (런타임 동작 0, JSDoc + contract test 만)**:
>
> - `buildSpecNodeData.ts` — `SYNTHETIC_CHILD_PROP_MERGE_TAGS` JSDoc 을 childRuntime facet
>   `syntheticPropMerge` membership SSOT 로 계약화 (양방향 1:1 + 소비처 5곳 단순 `set.has` 명시).
>   비주석 변경 라인 0.
> - `entryUniverse.ts` — `syntheticMergeSet`/`popoverHostedSet` 에 두 membership 권한 source
>   소유 관계 JSDoc 명시. 비주석 변경 라인 0.
> - `entryUniverseContract.test.ts` — count-only(syntheticPropMerge==9 / popoverHosted==2) 2개를
>   양방향 ownership parity 2개로 격상: (a) `syntheticPropMerge ⟺ SYNTHETIC_CHILD_PROP_MERGE_TAGS.has`
>   (정·역방향) (b) `popoverHosted ⟺ POPOVER_CHILDREN_TAGS.has` (정·역방향 + Button disjoint sanity).
>   SYNTHETIC/POPOVER set import 추가.
>
> **검증**: type-check 0 신규 위반 (baseline 71 불변 — JSDoc-only 라 코드 라인 시프트 0) +
> entryUniverseContract 18 passed (count-only 2 → parity 2 교체, 총수 불변) + factories `__tests__`
> 5 suite 72 passed 회귀 0 + SYNTHETIC/POPOVER 직접 소비 테스트 (shell-only-tags / colorContainerCutover)
> 15 passed 회귀 0 + 두 source 파일 비주석 변경 라인 0 확인 (런타임 동작 불변 → Phase 4-B/5 live
> confirm 유효, 추가 live exercise 불요). §3.3-6 "childRuntime facet 과 synthetic/filtering membership
> 이 extra/missing 없이 일치" 충족 (SYNTHETIC 축 — POPOVER 동축 동시 격상, necessity/field-filter 는
> adapter-required 후속).
>
> **후속 slice (3 메커니즘)**: POPOVER source transfer 실질성 재확인(현 SSOT 명문화로 contract 가
> 읽음 — dormant 해소) / Label necessity injection adapter id 분리(3경로 동기화 보존) / field·collection
> visible filter adapter id 분리(live-prop 동적 합성 격리). 각각 별도 phase/ADR 판정.

> **Phase 6 후속 slice (a) — field/datepicker visible filter membership facet ✅ Implemented 2026-06-21**
>
> recon (Workflow w5i3sqdgi, 3 recon + 12 적대 검증) + 사용자 결정 2건 후 진행. 적대 검증이 design
> 추정 vs 실측 **3 gap** 적발 (M3 — 절차 결함, fork trigger 아님):
>
> | design 추정 (§516)    | 실측 (적대 검증 confirmed)                                                                                                   |
> | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
> | "14 분기"             | filteredChildren 재할당 site 11 / `children.filter` 가시성 분기 8 / tag 17 — 어느 기준에도 14 없음                           |
> | risk MED 단일         | MED~HIGH 편차 (PROGRESSBAR/SLIDER/datefield=HIGH, field membership=LOW~MED)                                                  |
> | fixture 불가 "2 함수" | 5 요인 (+ Skia mirror buildSpecNodeData:673 + tabpanels selectedKey + synthetic-label labelText + field sideMode style 합성) |
>
> **사용자 결정 (2026-06-21, AskUserQuestion 2건)**:
>
> 1. **scope = field/datepicker membership facet 단일** (R7). 차단 메모리 우선 평가:
>    feedback-no-derived-adr-mid-execution(M3) = 추정 vs 실측 gap 은 Phase 0 inventory freeze
>    부실(절차 결함)이지 fork trigger 아님 → 본 slice 안에서 §516 stale 추정 정정.
>    feedback-execute-adr-surface-minimization = field(LOW~MED) + PROGRESSBAR/SLIDER(HIGH) 동시
>    진행은 surface 폭증 → field/datepicker 단일로 좁힘. PROGRESSBAR/SLIDER/tabpanels live-prop
>    adapter 는 별도 후속 slice (byte-identical fixture 불가).
> 2. **방식 = oracle byte-identical 로 live 갈음** (Chrome 확장 미연결). filter 코드 이동이
>    oracle(8컨테이너×hasLabel 2케이스 전수, pre/post diff 0)로 가시성 동작 불변 증명 +
>    facet 은 contract test 전용 소비처(런타임 builder 경로 미연결) → CLAUDE.md "runtime-0-change
>    exempt, prior live confirm remains valid" (ADR-912 field cutover live 확인 유효).
>
> **변경 (가시성 동작 byte-identical, dormant 회피 코드 이동)**:
>
> - `implicitStyles.ts` — `FIELD_VISIBLE_CHILD_TAGS` 단일 declarative 맵 신설 (컨테이너 type →
>   비-Label 가시 child.type set). 4 filter 분기 (combobox/select/searchfield:1323 /
>   numberfield:1382 / textfield·textarea:1539 / datefield·timefield:1591) 의 inline `c.type`
>   비교 / 분기별 local `WRAPPER_TAGS` 를 **이 맵 직접 소비** 로 교체. **dormant 회피
>   (feedback-no-dormant-foundation-ahead-of-flip)**: filter 와 facet 이 동일 맵을 소비 →
>   POPOVER 선례 동형 비-dormant. Label gate(hasLabel live)·sideMode 합성·SelectTrigger padding
>   주입은 맵 밖 adapter 잔존.
> - `entryUniverse.ts` — childRuntime facet 에 `fieldVisibleChildTags: readonly string[] | null`
>   추가, FIELD_VISIBLE_CHILD_TAGS 를 lowercase 정규화 mirror (정렬 배열 노출).
> - `entryUniverseContract.test.ts` — Phase 6 후속 parity test 1개 추가: per-container 양방향
>   (`facet 비-null ⟺ 맵 포함 + 배열 내용 일치` 정방향 / `맵 멤버 placeable ⟹ facet 정확 노출`
>   역방향 + Button/DatePicker null disjoint sanity). INVENTORY.fieldVisibleContainers=8.
>
> **검증**: type-check 0 + entryUniverseContract **25 passed**(24→25, 신규 1) + factories
> `__tests__` **79 passed**(회귀 0) + implicitStyles 직접 test (textField/sideLabel/checkboxRadio/
> resolveContainerStylesFallback) **57 passed**(회귀 0) + **oracle byte-identical** (8컨테이너×
> hasLabel 2케이스 가시성 동작 pre/post diff 0). datepicker 는 제외형 filter (`!POPOVER.has`) 라
> 포함형 맵 대상 아님 — Phase 6 popoverHosted facet 이 그 membership 소유 (facet null 확인).
>
> **잔여 후속 slice**: childRuntime facet 후속 3 메커니즘 (necessity / field-filter / live-prop)
> 모두 결론. (a) field/datepicker membership facet ✅ Implemented / (b) PROGRESSBAR/SLIDER/tabpanels
> live-prop adapter ❌ DROP (collapse 무관, 아래 §"(b) DROP 판정") / (c) Label necessity injection
> ❌ DROP (dormant + (b) 동형, 아래 §"(c) DROP 2026-06-22"). childRuntime facet 축은 SYNTHETIC/
> POPOVER/fieldVisible 3 facet 으로 종결, 후속 facet 화 대상 0.

> **Phase 6 후속 slice (b) — PROGRESSBAR/SLIDER live-prop adapter ❌ DROP 2026-06-21**
>
> recon + 적대 검증 (Workflow wh8wawwj5, 3 recon + 10 적대 검증) 결과 **proceed 추천 0건**
> (defer-low-value 8 / block-dormant 2). 사용자 결정(2026-06-21): ADR-914 collapse phase 에서
> 명시적 drop.
>
> **(a) 와 구조적 역(inverse) — 동형 작업 아님**:
>
> | 축              | (a) FIELD (implicitStyles inclusion-whitelist)                   | (b) PROGRESSBAR/SLIDER (exclusion-default)                              |
> | --------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
> | filter topology | `(c.type==="Label"?hasLabel:false) \|\| visibleTags.has(c.type)` | `if(Label)return hasLabel; if(Value)return showValueLabel; return true` |
> | set 멤버십 의미 | `set.has()` = **가시성 verdict 자체**                            | 추출할 set **0건** (grep 확증 — child-visibility Set/\_TAGS/.has 0)     |
> | default 분기    | 미포함 = HIDE                                                    | 미포함 = **무조건 visible** (Track/Thumb `return true`)                 |
> | 추출 SSOT 맵    | FIELD_VISIBLE_CHILD_TAGS (8 컨테이너 실재)                       | 대응물 부재                                                             |
>
> 참조 child type 전부 (1) live-prop gate (Label→hasLabel, Value→showValueLabel, Output→showValue)
> **또는** (2) unconditional pass (Track/Thumb) → set 멤버십이 가시성을 결정하는 child type 0개 =
> facet 으로 옮길 declarative membership 실체 없음. live-prop 텍스트 합성(formatProgressValue
> implicitStyles:1696 + Skia mirror buildSpecNodeData:673 / sliderFormattedValue inline:1813)은
> entry universe collapse(등록 surface 제거)와 **직교**한 render-text 합성 — facet 이전 대상 아님.
>
> **차단 메모리 평가 (차단 카테고리 선행 — MEMORY.md tie-breaking)**:
>
> - feedback-no-dormant-foundation-ahead-of-flip — **걸림**: exclusion-default + live gating 잔존이라
>   filter 가 같은 set 직접 소비 불가 → facet 은 contract mirror 만 = dormant foundation. (a) 가
>   이 메모리 통과한 유일 이유(filter 코드 이동 동반 runtime 소비)가 (b) 에서 재현 불가.
> - feedback-execute-adr-surface-minimization — **걸림**: 줄어드는 등록 surface 0 (PROGRESSBAR_TAGS/
>   SLIDER_TAGS 는 layout dispatch set 이지 손등록 registry 아님) 인데 facet 필드 + parity test
>   추가 = net surface 증가. (a) 는 흩어진 inline 비교 consolidate 이득이라도 있었으나 (b) 는 그조차 0.
>
> 차단 메모리 2개 모두 걸리므로 정당화 카테고리 인용 자체가 위반 (ADR-127 우회 사례 동형).
>
> **실제 가치 1건 (collapse 무관, 별도 scope)**: sliderFormattedValue 의 Skia mirror 부재 비대칭
> (formatProgressValue 는 layout↔Skia 2 경로 cross-consume 단일 export, sliderFormattedValue 는
> layout 단일 inline) 해소 + helper 통일은 render-text 정합 가치이나 entry universe collapse 와
> 직교 → ADR-914 slice 로 묶는 것은 관점 부정합. 필요 시 별도 작업/ADR 판정 (현재 미진행).

> **Phase 6 후속 slice (c) — Label necessity injection ❌ DROP 2026-06-22**
>
> recon + 적대 검증 (Workflow ww752v8o1, 3 recon + 3 적대 refute + 1 synthesize, 7 agent 동일
> file:line 수렴) 결과 **종합 판정 BLOCK (dormant + 별도 scope)**. 사용자 결정(2026-06-22):
> ADR-914 collapse phase 에서 명시적 drop. §515 의 "adapter-id-required HIGH, 3경로 동기화" 추정을
> 실측 기반(dormant + (b) 동형)으로 정정.
>
> **(a) 와 비동형, (b) PROGRESSBAR/SLIDER 와 동형 — set 은 verdict 아니라 보조 gate**:
>
> | 축             | (a) FIELD (inclusion-whitelist)                                  | NECESSITY (exclusion-default, (b) 동형)                                   |
> | -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
> | set.has() 의미 | 가시성 **verdict 자체** (미포함=HIDE)                            | prop-driven 주입에 대한 **보조 gate** (1차 조건은 `parentNecessity` prop) |
> | 경로 일관성    | 4 분기 모두 동일 export set 직접 소비                            | 3경로 중 **2/3 은 set 무시** (prop 만으로 주입)                           |
> | set 형태       | inline → `FIELD_VISIBLE_CHILD_TAGS` export 추출 (code-move 가치) | 이미 **local const single set** (implicitStyles:483, 미-export), 추출분 0 |
>
> 3경로 실측 (file:line):
>
> - `implicitStyles.ts:2253` — `parentNecessity && NECESSITY_INDICATOR_TAGS.has(containerTag)` (12-tag set gate + 부모 prop 둘 다)
> - `buildSpecNodeData.ts:588-602` (`resolveLabelNecessity`) → `:1105` — **set 참조 0**, 부모 `necessityIndicator` prop 만
> - `fullTreeLayout.ts:1150-1169` — **set 참조 0**, `parentProps.necessityIndicator` prop 만
>
> set 멤버십이 시스템 전역 주입 verdict 를 단독 결정하지 못함(2/3 경로가 prop-driven default 주입) =
> (b) exclusion-default 의 "default 동작 + 한 경로 보조 gate" 구조 정확 부합. facet 으로 옮길
> declarative membership 실체 없음.
>
> **차단 메모리 평가 (차단 카테고리 선행 — MEMORY.md tie-breaking)**:
>
> - feedback-no-dormant-foundation-ahead-of-flip — **걸림**: NECESSITY_INDICATOR_TAGS 는 local const
>   single set + self-consumer 1곳(`:2253`). facet 도입 후에도 consumer 는 `.has()` 직접 호출 유지,
>   facet 은 mirror-only contract artifact. (a) 가 통과한 유일 이유(inline 추출 + filter runtime
>   직접 소비)가 necessity 에서 재현 불가(이미 named set, Skia/Taffy 는 set 무시). POPOVER 선례의
>   비-dormant 최소 조건(export const + filter 직접 소비)조차 미충족.
> - feedback-execute-adr-surface-minimization — **걸림**: facet 화 = export 승격 +1 / facet 필드 +1 /
>   parity test +1 = surface 순증, 줄어드는 등록 surface 0. necessity suffix 주입은
>   `getNecessityIndicatorSuffix` (FieldNecessityIndicator.ts:9-18) 의 prop→텍스트 render-text 합성 =
>   (b) formatProgressValue 동류, 5개 등록 surface(rendererMap/factory/default/propagation/child-filtering)
>   어느 것도 아님 → collapse 기여 0.
>
> 차단 메모리 2개 모두 걸리므로 정당화 카테고리 인용 자체가 위반 (ADR-127 우회 사례 동형).
>
> **부수 발견 — 3(+1)경로 정합성 버그 (collapse 직교, 별도 fix scope)**: `necessityIndicator` prop
> 을 binding.accepts 로 가진 컴포넌트는 **Form 단 1개** (`Form.binding.ts:65`, 라이브 편집 surface).
> Form 은 12-tag set 밖(`unified.types.ts:944`). Form 직속 bare Label + Form `necessityIndicator`
> 설정 시 implicitStyles(`:2253`)는 `form ∉ set` 미주입 / Skia(`:1105`)·Taffy(`:1155`)는 부모 prop
> 보고 주입 → **측정↔렌더 발산**. propagation 규칙 0건(Form→field necessityIndicator 전파 없음),
> 기본 템플릿 `Form>FormField>Label` 은 4경로 모두 미주입(대칭, 무해). 트리거 표면이 "Form 직속 bare
> Label + necessityIndicator" 1구성으로 좁음. **사용자 결정(2026-06-22): 별도 fix scope 로 분리
> 기록만** — collapse 와 무관하므로 본 실행 중 즉석 fix/fork 금지(M3 feedback-no-derived-adr-mid-execution).
> 수정 방향(Skia/Taffy 에 set gate 추가 통일 vs implicitStyles set 제거 후 form 포함)은 의도 결정
> 사항이라 별도 trigger 시 처리.

목표: child filtering/injection membership을 entry childRuntime facet으로 이전한다.

대상:

- `SYNTHETIC_CHILD_PROP_MERGE_TAGS`. ← ✅ **Phase 6 Implemented 2026-06-21** (SSOT 명문화 + contract 양방향 parity 소유 증명)
- `POPOVER_CHILDREN_TAGS`. ← ✅ 동축 동시 격상 (popoverHosted ⟺ POPOVER.has parity)
- Label necessity injection. ← ❌ **(c) DROP 2026-06-22** (dormant + (b) exclusion-default 동형 — NECESSITY_INDICATOR_TAGS 는 local const single set + self-consumer 1곳, 3경로 중 2/3 은 set 무시 prop-driven 주입, render-text 합성이라 collapse 기여 0. 아래 §"(c) DROP 2026-06-22" 참조. 부수: Form 비대칭 버그 별도 fix scope 기록)
- field/collection visible child filtering branches. ← ✅ **(a) field/datepicker membership facet Implemented 2026-06-21** (FIELD_VISIBLE_CHILD_TAGS SSOT 추출 + filter·facet 동일 맵 소비 비-dormant + 양방향 parity, oracle byte-identical). **(b) PROGRESSBAR/SLIDER/tabpanels live-prop adapter — ❌ DROP 2026-06-21** (collapse 무관, 아래 §"(b) DROP 판정" 참조)

작업:

- declarative membership부터 이관한다. ← ✅ SYNTHETIC/POPOVER 양방향 parity 로 facet 소유 증명
- function-level filter가 필요한 경우 adapter id로 분리한다. ← (a) field-filter 는 inclusion-whitelist 라 declarative facet 으로 충분(adapter 불요, Implemented). necessity/(b) live-prop 은 exclusion-default + prop-driven/live gating 이라 추출할 declarative membership 0 → adapter id 분리도 dormant artifact → 둘 다 DROP (collapse 무관)
- `filteredChildIds`와 render command child boundaries를 fixture로 고정한다. ← ✅ 런타임 0 변경 → 기존 경로 보존, contract parity 추가 고정

Gate:

- layout `filteredChildIds` parity. ← ✅ 런타임 동작 불변 (POPOVER.has 필터 경로 보존)
- render commands child begin/end parity. ← ✅ 런타임 동작 불변 (SYNTHETIC.has 분기 보존)
- Preview children count parity. ← ✅ 런타임 동작 불변

### Phase 7 - Contract Swap + Registry Cleanup ✅ Implemented 2026-06-21

> **진행 로그 (2026-06-21)**: entryUniverseContract 를 primary gate 로 승격 — ADR-139
> invariant B forward leg 2개 + exception 흡수 matrix 흡수. ultracode recon(3) + 적대
> 검증(3) 으로 design 추정("matrix 추가만") vs 실측("선행 substrate 신설 필요") gap 적발
> (swap_risk 3/3 HIGH). 사용자 결정(2026-06-21): facet 신설 후 full swap.
>
> **적대 검증 교정 (recon 오류 정정)**:
>
> - recon "9 TAG_SPEC_MAP gap" → 실측 load-bearing 은 **3개뿐**: `DataTable / Image /
Navigation` (placeable & !TAG_SPEC_MAP & !catalog). 나머지 7개(ColorPicker /
>   ColorSwatchPicker / Disclosure / DisclosureGroup / Nav / ProgressCircle / StatusLight)
>   는 catalog cutover 경유로 invariant B 통과 → exception non-load-bearing.
> - rendererMap load-bearing 3개: `InlineAlert / TextArea / frame` (placeable & !rendererMap).
> - `MenuItem`(TAG_SPEC_MAP) / `List`(rendererMap) 는 **placeable=false** → entry universe
>   진입점 밖. ADR-139 invariant A (spec 파일 universe) 잔재라 entry matrix 대상 외 — ADR-139
>   contract 가 계속 담당.
> - getDefaultProps exception 2개(`Navigation / DataTable`)는 placeable, Phase 1~6 의
>   defaults facet 이 이미 흡수(`entryUniverseContract.test.ts:356-357`).
>
> **gap 처리 (M3 — 추정 vs 실측은 절차 결함, fork 아님)**: design Phase 0 inventory 가
> "substrate 신설 필요"를 명시하지 못한 절차 결함 → 본 phase 안에서 흡수 (새 ADR fork 금지,
> adr-writing.md M3). surface-minimization 대비 Gate 정합 우선 — TAG_SPEC_MAP intended-absent
> 표현은 substrate 신설 없이 원천 불가하므로 facet 2개 신설이 필수 (적대 검증 명시).
>
> **변경**:
>
> - `entryUniverse.ts` — `ComponentEntryRuntime.render` 에 `hasTagSpecEntry` /
>   `hasCatalogCutover` substrate 2개 신설(`@composition/specs` TAG_SPEC_MAP +
>   `@composition/shared` getCatalogCutoverTypes, 대소문자 무시). resolver 가 즉시 노출,
>   contract 가 즉시 소비 → dormant 아님.
> - `entryUniverseContract.test.ts` — Phase 7 신규 6 test: substrate parity / invariant B
>   forward leg #1(placeable⟹rendererMap, exception 제외) / forward leg #2(placeable⟹
>   TAG_SPEC_MAP OR catalog, exception 제외) / exception 흡수 matrix(placeable exception
>   전수 intended-absent 통과 + false-positive 0) / load-bearing negative(3+3 exception
>   의존 증명) / negative fixture(가짜 미등록 감지).
> - ADR-139 `componentRegistrationContract` 는 **병행 유지** — invariant A(spec 파일 universe
>   ⟹ TAG_SPEC_MAP) + baseline ratchet(append 금지, §3.3-7) 담당. baseline 은 전부 빈 객체
>   (ratchet 0)라 실질 차단은 exception + forward leg → entry contract 가 흡수, baseline ratchet
>   은 spec universe 와 함께 ADR-139 잔류.
>
> **검증**: type-check exit 0(error 0) + entryUniverseContract **24 passed**(18 → 24, 신규 6) +
> ADR-139 contract **10 passed**(병행 green) + factories `__tests__` **78 passed**(72 → 78, 회귀 0).
> live: entryUniverse 소비처 = entryUniverseContract.test.ts 뿐(grep 확정, 런타임 builder 경로
> 미연결) → 런타임 동작 0 변경(Phase 4-C/6 동형, registration wiring 불변). product 등록
> 경로 1 byte 미변경, contract 가 그 등록을 읽어 검증하는 범위만 확대 → 기존 live confirm 유효,
> 추가 exercise 불요. Gate: 병행 green 1 phase 이상(Phase 1~7 = 7 phase) ✅ / exception 흡수
> matrix green(17 항목 전수, false-positive 0) ✅ / registry leftover audit(MenuItem/List =
> placeable 아님, ADR-139 잔류) ✅.

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
