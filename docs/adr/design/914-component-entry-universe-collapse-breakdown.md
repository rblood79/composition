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
