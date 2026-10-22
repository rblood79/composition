# RAC · S2 API 표면 분석과 「개념 모듈」 제안 — deep-research 보고 (2026-10-22)

> 목적: 사용자가 컴포넌트를 커스터마이징 (prop 변경 · slot 교체 · origin→instance 파생 · override) 한 뒤에도 상호작용 · 상태를 컴포넌트별 손 등재가 아닌 **재사용 가능한 개념 모듈**로 합성할 수 있는지, RAC (react-aria-components 1.22.1 · react-aria 3.53.1 · react-stately 3.51.0) 와 S2 (`@react-spectrum/s2` 1.8.1) 의 공개 API · 레퍼런스 사이트 · 유지보수자 발언을 근거로 답한다. 「RSC」 는 React Spectrum Components (S2) 로 해석했다.
>
> 방법: `/deep-research` 워크플로 (run `wf_70daa625-c83`) — 6 각도 검색 · 27 출처 · 128 claim 추출 · 25 claim 3-표결 검증 (확정 21 · 기각 4) · 11 finding 으로 합성. 설치본 대조 2건 (§4 · §6) 은 이 보고 작성 시 직접 보강했다. 선행 연구 [INTERACTION_REDESIGN_RAC_S2_2026-10.md](INTERACTION_REDESIGN_RAC_S2_2026-10.md) (22 개념 분류 · registry gap) 의 후속이며, 이 문서는 ADR 이 아니다.
>
> 신뢰도 표기: **high** = 공식 문서 또는 유지보수자 발언 + 설치본 대조 3-0 · **medium** = 2-1 표결 또는 종합 제안 · **low** = 외부 근거 없이 프로젝트 정본만 인용.

## 0. 요약

1. **공식 지지 경계는 hook 층이 아니라 Context · slot · Provider 층이다** (high). 부모가 state 를 소유하고 `Provider` 로 자식 RAC 의 `XContext` 에 props 를 주입하면 자식 구현을 그대로 재사용한다 (CustomNumberField · Table/GridList 의 selection Checkbox 교체). `useControlledState` 같은 유틸은 2024-04 · 2025-07 두 번 「문서화하지 않고 모노패키지에 넣지 않는다」 로 확정됐다. 따라서 개념 모듈은 **「runtime 이 controlled 상태를 소유하고 공개 Context 로 주입하는 Provider 층」** 으로 설계한다 (§1 · §2).
2. 검증된 함정 4개가 설계 불변식을 정한다 (high): mergeProps 는 이벤트를 chain 하므로 「로컬이 덮어쓴다」 가 아니다 · 모르는 RAC `slot` 이름은 throw 하며 자체 식별자를 `slot` 에 얹지 말라는 것이 유지보수자 입장 · Tabs 의 collection Context 가 임의 중첩에서 상속돼 throw 하고 clear 는 소비자 책임 · `value` 키 무조건 spread 는 uncontrolled→controlled 전환을 systemic 결함으로 만든다 (§3).
3. Trigger 래퍼 가족에서 **open 의 소유자는 overlay 본체**다 — RSP 는 trigger 없는 열기를 DialogTrigger 수정이 아닌 DialogContainer 로 풀었고, RAC 는 `<Modal isOpen onOpenChange>` 단독 렌더가 공식 controlled 패턴 (§3-4).
4. 상태 머신 (Zag) 은 「동작 ↔ 뷰 프레임워크 분리」 의 선례이지 개념 단위 분해의 선례가 아니다 — 컴포넌트 단위 machine 이라 RAC 의 state/behavior hook 분리와 동형. 갈아탈 근거 없음, statechart 표기만 빌린다 (§5, medium).
5. S2 시각 prop 경계 (질문 4) 는 외부 검증 claim 0 — 프로젝트 정본 (D2 = S2 고정 · 시각 축은 D3 catalog) 으로만 답하고, 설치본 보강으로 **S2 가 RAC Toolbar 를 렌더하는 컴포넌트는 ActionButtonGroup 1개**, `GroupContext` 를 공급하는 컴포넌트는 14개임을 확인했다 (§6, low→medium).
6. 제안: `InteractionConcept` 계약 스키마 (§7.1) · When/Do 축 매핑 (§7.2) · 불변식 I1~~I6 (§7.3) · 도입 단계 P0~~P5 (§7.4). 제안은 검증 claim 의 종합이지 1차 출처가 직접 보증하는 설계가 아니다 — ADR 로 올릴 때 Phase 0 인벤토리 (코드 근거 A 등급) 를 먼저 붙인다.

## 1. 질문 1 — 외부 도구가 「개념 단위」 로 재사용할 수 있는 공식 경계

### 1.1 3층 아키텍처가 1차 분류 축 (high)

React Spectrum 아키텍처 페이지는 각 컴포넌트를 **state hook** (뷰 시스템 가정 없음) · **behavior hook** (플랫폼 종속, DOM props 반환) · **component** (스타일 · 렌더) 로 나누고, state hook 은 「데이터 입력이 있거나 사용자가 바꾸는 시각 상태 (펼침/접힘) 가 있는 상호작용 컴포넌트에만 있다」 고 명시한다. 설치본 react-stately 3.51.0 의 dependencies 에 react-dom · @react-aria 가 없어 「뷰 무관」 과 부합한다.

→ composition 개념 목록의 1차 축: **behavior 전용** (press · hover · focus · keyboard — state 없음, `data-*` 속성과 render props 로만 노출) vs **state 보유** (toggle · value · singleSelection · multiSelection · expansion · open — `useToggleState` · `useListState` · `useOverlayTriggerState` …).

한정: 「개념 단위 재사용」 은 이 연구의 해석이고 페이지의 명시 목적은 「디자인 시스템 간 컴포넌트 동작 재사용」 이다. 같은 페이지가 component 층을 unstyled/styled 로 다시 나눠 실무상 RAC (Context/slot) 가 4번째 층처럼 존재하며, 문서는 「Most applications should start with React Aria Components」 로 hook 직접 사용을 2차 경로로 둔다.

- 출처: [architecture](https://react-spectrum.adobe.com/architecture) (공식 · mdx 마지막 수정 2023-11-20) · [hooks 가이드](https://react-aria.adobe.com/hooks) (공식)

### 1.2 공식 지지 표면 = Context · slot · Provider · useContextProps · useSlottedContext (high, 1 claim 2-1)

- 공식 customization 문서: 「Each React Aria Component exports a corresponding context … local props taking precedence」 · 「replace a component used as part of a larger pattern with a custom implementation」 · 「their React Aria Components implementations can be reused」.
- 설치본 1.22.1 `dist/types/exports/slots.d.ts` 가 `DEFAULT_SLOT` · `Provider` · `useContextProps` · `useSlottedContext` 를 public 서브패스로 export 한다 (package.json `./*` 공개 · `./private/*` 만 null).
- 세 축이 분리돼 있다: 부품 교체는 `useContextProps` (merge) · slot 별 context prop 읽기는 `useSlottedContext` (비병합) · 컴포넌트 **상태** 읽기는 별도 `XStateContext`.
- 같은 컴포넌트 다수는 `slot` prop + provider 의 `slots` 객체로 구분하고 이름 없는 자식은 `DEFAULT_SLOT` 키를 받는다 (키가 없으면 'A slot prop is required' throw · `slot={null}` 은 context 전체 opt-out).
- 실제 부품 교체 사례: GridList.mjs:378-391 · Table.mjs:649-662 가 `CheckboxContext` 에 `slots.selection` 을 주입한다.

**정정 2건 (검증자 요구)**: ① 「모든 컴포넌트가 Context 를 export」 는 과장 — 1.22.1 의 `*Context` export 116개 가운데 ListBoxItem · MenuItem · Row · Cell · Tab · TreeItem · Tag 같은 항목 단위, FileTrigger · PreviewTrigger · Virtualizer, DisclosureGroup · Toast 는 props Context 가 없고 `Internal*Context` 도 섞여 있어 「export = 공식 지지」 가 자동 성립하지 않는다. ② 「로컬 우선」 은 스칼라 한정 — §3-1 참조. Context 자체의 semver 안정성 문구는 문서에 없다.

- 출처: [customization](https://react-aria.adobe.com/customization) · [Table](https://react-aria.adobe.com/Table) · [GridList](https://react-aria.adobe.com/GridList) · [mergeProps](https://react-aria.adobe.com/mergeProps) (모두 공식) · 설치본 `react-aria-components@1.22.1/dist/types/exports/slots.d.ts`

### 1.3 hook 층의 위치와 안정성 — 「문서화된 모노패키지 export」 까지만 (high, 1 claim 2-1)

- hooks 는 RAC 보다 앞선 공개 API (react-aria 3.0.0 = 2020-10-01, RAC 1.0.0-alpha.1 = 2023-04-05, `npm view` 확인). 2023-04-05 릴리스 노트: 「abstracts away all of the glue code … drop down to hooks for even more customizability where needed」.
- 그러나 `useControlledState` (@react-stately/utils) · `useDescription` (@react-aria/utils) 은 메인테이너 (reidbarber, 2024-04-18) 가 「aren't documented, and aren't _necessarily_ intended to be public APIs」 라 했고, 2025-07 PR #8620 (export 시도) 은 「Discussed with the team and we decided not to include in the monopackage」 로 merge 되지 않았다. docs issue #1858 도 문서 없이 종결. 2026-03 #9850 뒤 `react-stately/useControlledState` subpath 가 빌드 산출물로 있지만 루트 barrel 과 문서에 없다. react-aria v1.17.0 노트 「new exports will not be added」 가 「모노패키지 = 지지 표면」 방향을 재확인.
- RSP versioning 페이지는 v3 전용으로 hook 안정성 · private 경로에 대한 진술이 0 — 근거로 쓸 수 없다.
- **기각 (0-3)**: 「hook 층 전체가 개념 단위 재사용의 공식 지지 경계」. 외부 사용자 (adriantrunzo) 도 `@react-stately/utils` 직접 import 를 「feels a bit like using undocumented internals」 로 인식했다.
- 한정: 「`@react-stately/utils` 패키지 전체가 보장 밖」 은 추론이며 「necessarily」 완화 표현이 있다 (2-1).

- 출처: [릴리스 2023-04-05](https://react-spectrum.adobe.com/releases/2023-04-05.html) · [issue #6222](https://github.com/adobe/react-spectrum/issues/6222) · [PR #8620](https://github.com/adobe/react-spectrum/pull/8620) · [issue #1858](https://github.com/adobe/react-spectrum/issues/1858) · [PR #9850](https://github.com/adobe/react-spectrum/pull/9850) · [v1.17.0](https://react-aria.adobe.com/releases/v1-17-0) · [versioning](https://react-spectrum.adobe.com/react-spectrum/versioning.html)

## 2. 결론 1 — 개념 모듈의 구현 층

| 길                                                    | 공식 지지 | composition 판정                                               |
| ----------------------------------------------------- | --------- | -------------------------------------------------------------- |
| runtime 이 state 소유 → `Provider` 로 `XContext` 주입 | ✅ 문서   | **채택** — 개념 모듈의 본체                                    |
| RAC 부품 교체 (`useContextProps` + `slots`)           | ✅ 문서   | 채택 — slot 교체는 RAC 가 정의한 slot 이름으로만 (§3-2)        |
| 문서화된 hook (usePress · useToggleState …) 직접 조립 | ✅ 문서   | 2차 경로 — RAC 로 못 덮는 경우만                               |
| `useControlledState` 등 유틸 import                   | ❌        | 금지 — 같은 규칙 (`value !== undefined`) 자체 구현 (불변식 I5) |
| `dist/private/*` 경로                                 | ❌ null   | 금지                                                           |

## 3. 질문 2 — controlled prop 을 runtime 이 소유할 때의 함정 (검증 4 + 설치본 보강 1)

### 3-1. mergeProps 는 「덮어쓰기」 가 아니다 (high)

`useContextProps` = `useSlottedContext(context, props.slot)` 뒤 `mergeProps(contextProps, props)`. mergeProps 문서: 「Event handlers are chained, classNames are combined, ids are deduplicated … For all other props, the last prop object overrides」. style 은 별도 코드로 병합. → runtime 핸들러와 사용자 저작 핸들러가 **둘 다 실행**된다. override 가 「교체」 를 뜻하면 context 쪽에서 그 키를 제거해 chain 을 끊어야 한다.

### 3-2. `slot` 네임스페이스는 RAC 소유 (high)

`useSlottedContext` 는 둘러싼 context 에 `slots` 맵이 있을 때 `slot` 이 맵에 없는 키면 throw 한다 (issue #9283, 1.13.0 보고 → 설치본 1.22.1 `dist/private/utils.mjs:77-106` 에 `throw new Error(… Valid slot names are …)` 그대로). 유지보수자 입장 — snowystinger: 「Our general stance is that you shouldn't use slot for your own contexts. Instead, you should have something like `myDSSlot`」 · devongovett: 「Erroring on unknown slot names preserves forward compatibility」. 공인 우회는 자체 context 에서 slot 을 소비한 뒤 RAC 에 `slot={null}`. 이슈는 open (확정 결정이 아닌 입장 표명).

→ composition 의 slot · 부품 식별자를 RAC `slot` prop 에 얹는 설계는 지지되지 않는다. 빌더는 Dialog · Group · Field 등 slotted Provider 아래에 자식을 두는 것이 기본이라 실무적으로 유효한 함정.

- 출처: [issue #9283](https://github.com/adobe/react-spectrum/issues/9283)

### 3-3. Context 암묵 상속이 임의 중첩에서 깨진다 — clear 는 소비자 책임 (high)

RAC 1.19.0 기준 Tabs 안 TabList 옆의 collection 컴포넌트 (TagGroup · Menu · ListBox · GridList) 는 자체 collection 을 만들지 않고 Tabs 의 CollectionDocumentContext 를 상속해 hidden render pass 에서 throw 한다 (`TypeError: Cannot destructure property 'onAction' of '_utils.listMap.get(...)'`; Tabs 없는 대조군은 정상). 유지보수자는 2026-09-17 not_planned 로 닫으며 「We can't clear the context because it may be used outside the popover intentionally. You'd be expected to clear the appropriate contexts」. 1.22.1 에도 react-aria 3.53.1 `CollectionBuilder.mjs:33-35` 「If a document was provided above us … Just render the content」 가 남아 있고 `useIsHidden` 가드는 Popover · Dialog · Menu 3 파일뿐.

**기각 (0-3) 2건 — 설계 근거로 쓰지 말 것**: 「controlled Popover (Trigger 래퍼 없음) 안의 Menu 가 useMenuItem.ts:173 에서 throw」 · 「공식 입장 = Context 상속 경계는 비공식 영역」. 주장 범위는 「Tabs 행의 collection throw + not_planned + clear 는 소비자 책임」 까지.

- 출처: [issue #10368](https://github.com/adobe/react-spectrum/issues/10368) · [PR #10019](https://github.com/adobe/react-spectrum/pull/10019) · [PR #10367](https://github.com/adobe/react-spectrum/pull/10367)

### 3-4. uncontrolled→controlled 전환은 systemic 결함이 된다 (high)

react-stately `useControlledState` 는 `value !== undefined` 만으로 controlled 를 판정하고 (설치본 3.51.0 `useControlledState.mjs:21-22` 실측), 전환 시 dev 모드에서만 「WARN: A component changed from uncontrolled to controlled」 를 낸다 (production 침묵). mittwald/flow (RAC 위 디자인 시스템) 의 `useControlledHostValueProps` 하나가 `value` 를 무조건 spread 해 8 field 컴포넌트의 소유권을 바꿨고 경고는 7개 (CodeEditor 는 CodeMirror 자체 상태라 무증상), Storybook 443 story 콘솔 sweep 에서 22 story (클릭만, 하한). 수정 PR #3078: 「keep field values controlled from the first render」 — 첫 render 부터 빈값/NaN/null 로 controlled 고정.

- 출처: [mittwald/flow #3027](https://github.com/mittwald/flow/issues/3027) · [PR #3078](https://github.com/mittwald/flow/pull/3078) · 설치본 `react-stately@3.51.0/dist/private/utils/useControlledState.mjs`

### 3-5. selection 에서 `selectedKeys` 와 `defaultSelectedKeys` 를 둘 다 주면 (설치본 보강, high)

`useMultipleSelectionState.mjs:40` 이 `useControlledState(selectedKeysProp, defaultSelectedKeys, onSelectionChange)` 를 그대로 호출한다 → `selectedKeys !== undefined` 면 controlled 이고 `defaultSelectedKeys` 는 **초기값으로도 쓰이지 않는다**. 따라서 사용자 결정 10-13 의 항목 `isSelected` → 컬렉션 `defaultSelectedKeys` 집계는 uncontrolled 경로이며, runtime 이 `selectedKeys` 를 소유하는 순간 집계값은 runtime 의 **초기 controlled 값**으로 옮겨 넣어야 한다 (둘 다 넘기면 default 는 무시되고, 조건부로 넘기면 I1 전환 함정). 이 보강으로 workflow 가 남긴 열린 질문 3 은 닫힌다.

### 3-6. Trigger 래퍼 가족 — open 의 소유자는 overlay 본체 (high)

RSP 는 「trigger 자식 없이 외부 상태로 다이얼로그 열기」 를 DialogTrigger 변경이 아니라 별도 컴포넌트 DialogContainer 로 해결했다 (issue #1039, 2020-09 dannify → PR #1082 「support controlled dialogs … cases where there is no trigger element」, 메뉴 항목에서 열기 #966 도 함께 종결). 현행 문서도 DialogTrigger 「accepts exactly two children」 · DialogContainer 「no trigger element or when the trigger unmounts while the dialog is open」. RAC 에는 DialogContainer 가 없고 `<Modal isOpen onOpenChange>` 단독 렌더가 공식 controlled 패턴.

→ RAC 수준에서 **open 개념의 소유자 = overlay 본체** (Modal · Popover · Tooltip), Trigger 래퍼 (DialogTrigger · MenuTrigger · TooltipTrigger) 는 trigger 자식과 overlay 를 잇는 결합기. 선행 연구 §4-d 의 「trigger owner 가 Trigger 노드」 는 **When 축 (onOpenChange 가 어디서 나는가)** 에 한정되고, Do 축 (`open.open/close`) 의 수신자는 overlay 본체다.

**기각 (0-3)**: 「controlled 여도 두 번째 자식이 없으면 런타임 오류」 — 「상태 소유」 와 「trigger 자식 필수」 의 결합을 단정하지 말 것. 한정: DialogContainer 결정은 RSP (v3 · S2) 층의 것.

- 출처: [issue #1039](https://github.com/adobe/react-spectrum/issues/1039) · [PR #1082](https://github.com/adobe/react-spectrum/pull/1082) · [DialogTrigger](https://react-spectrum.adobe.com/react-spectrum/DialogTrigger.html) · [DialogContainer](https://react-spectrum.adobe.com/react-spectrum/DialogContainer.html) · [RAC Modal](https://react-aria.adobe.com/Modal)

## 4. 열린 질문 가운데 설치본으로 닫은 것

| 열린 질문 (workflow)                                          | 보강 결과                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| selection 의 `selectedKeys` vs `defaultSelectedKeys` 우선순위 | §3-5 — controlled 가 이기고 default 는 무시 (`useMultipleSelectionState.mjs:40`)                                                                                                                                                                                                                                    |
| S2 가 RAC Toolbar · Group 을 내부에서 렌더하는 컴포넌트 목록  | §6 — Toolbar 는 `ActionButtonGroup.mjs` 1개 · `GroupContext` 참조는 ActionButton · ActionButtonGroup · AvatarGroup · ButtonGroup · CheckboxGroup · Dialog · FullscreenDialog · IllustratedMessage · ListView · RadioGroup · SelectBoxGroup · SideNav · TagGroup · ToggleButton (S2 1.8.1 `dist/private/*.mjs` grep) |

남은 열린 질문 2개: Radix (data-state + asChild) · Base UI · Ark UI 의 controlled 전환 · slot 네임스페이스 규칙 대조 (불변식 I1 · I2 의 일반성 검증) · `react-stately/useControlledState` subpath 가 semver 보호 표면인지 (유지보수자 확인 필요).

## 5. 질문 3 — 상태 머신 기반 vs hook 기반 (medium, 1 claim 2-1)

- Zag.js 는 statechart 로 모델링하되 SCXML 을 따르지 않는 독자 API (`@zag-js/core` 가 minimal XState FSM). 동기는 Chakra UI 의 자기 보고 진단 「Most these bugs are associated with the orchestration within useEffect, useMemo, useCallback」 — 정량 자료 없음 · Chakra UI Vue 에서도 재현됐다고 적어 React hook 고유 결함이 아니라 「프레임워크별 effect/reactivity 조율 층」 의 문제. framework-agnostic 재사용이 동급 동기.
- 구조: machine 정의 (accordion · menu 등 **컴포넌트 단위** NPM 패키지) + 어댑터 (React · Solid · Vue 3 · Svelte · Preact · Vanilla).
- **함의**: Zag 는 「동작 ↔ 뷰 프레임워크 분리」 의 선례이지 press/hover 같은 개념 단위 분해의 선례가 아니다. 이 분리는 RAC 의 state hook (뷰 무관) / behavior hook (DOM) 과 동형 → composition 이 머신으로 갈아탈 근거가 되지 않는다. 개념 모듈의 상태 전이 표 (idle → pressed → released) 문서화에 statechart 표기만 빌리는 것이 적정.
- **범위 공백**: Radix · Ark UI · Base UI · Headless UI · Downshift · Framer/Figma/Pen.dev variant 모델 · Webflow/Framer interactions 패널은 검색은 됐으나 (Plasmic variants · Framer academy · Webflow interaction-schema · Figma variants help) 검증을 통과한 claim 이 0 — 비교는 Zag 한 곳에 머문다. Framer 모델은 메모리 `reference-framer-components-model-2026-10` 가 별도 정본.

- 출처: [Zag introduction](https://zagjs.com/overview/introduction) (1.46.0) · [@zag-js/core README](https://unpkg.com/@zag-js/core@1.42.0/README.md) · [discussion #392](https://github.com/chakra-ui/zag/discussions/392) · [discussion #1547](https://github.com/chakra-ui/zag/discussions/1547) — vendor 자기 서술

## 6. 질문 4 — S2 시각 prop 과 동작 prop 의 경계 (low → 설치본 보강 medium)

외부 검증 claim 0. 프로젝트 정본 (`.claude/rules/ssot-hierarchy.md` D2 절 — 사용자 결정 2026-10-09 · 게이트 `d2S2Alignment.static.test.ts` 2026-10-14) 기준: S2 1.8.1 은 RAC 위에 Spectrum 2 를 얹은 구현이라 동작 · 상태 · 데이터 prop 은 RAC 이름 그대로 (`isSelected` · `selectedKeys` · `orientation` · `onSelectionChange`), 시각 prop 은 Spectrum 축 (`variant` · `size` · `isEmphasized` · `fillStyle` · `staticColor` · `isQuiet` · `density`).

→ 개념 모듈은 **동작 prop 축 (RAC 이름) 만 소유**하고 시각 축은 D3 catalog (`COMPONENT_RULES_TABLE`) 가 소유한다. 사용자 커스터마이징 (variant 변경 · Design 패널 override) 이 개념의 controlled 삼중 계약을 건드리지 않는 경계가 자연 분리된다.

설치본 보강 (§4 표): S2 가 RAC `Toolbar` 를 렌더하는 것은 ActionButtonGroup 뿐 (선행 연구 부록 B 와 일치) — ActionButtonGroup 을 catalog 에서 Toolbar 계열로 다룰 때 `ToolbarContext` 주입이 개념 모듈 경로가 된다. `GroupContext` 는 14 컴포넌트가 참조하므로 S2 의 Group 은 「시각 묶음」 이 아니라 RAC `Group` Context 의 소비자다 (D1 ↔ D3 분리 사례 — ssot-hierarchy.md §1 「RAC Group ↔ canonical frame」 과 정합). S2 style macro / `UNSAFE_className` 과 Provider 주입의 충돌 여부는 미검증 (S2 스타일은 쓰지 않으므로 실무 영향 없음).

## 7. 질문 5 — 제안 (medium: 검증 claim 의 종합)

### 7.1 `InteractionConcept` 계약 스키마 초안

```ts
interface InteractionConcept {
  id:
    | "press"
    | "hover"
    | "focus"
    | "keyboard"
    | "toggle"
    | "value"
    | "valueCommit"
    | "inputValue"
    | "singleSelection"
    | "multiSelection"
    | "expansion"
    | "open"
    | "action"
    | "clear"
    | "remove"
    | "sort"
    | "resize"
    | "loadMore"
    | "dragDrop"
    | "form";
  /** §1.1 3층 — state hook 유무 */
  layer: "behavior" | "state";
  /** state 개념만: X / defaultX / onXChange 삼중 (isSelected/defaultSelected/onChange · selectedKeys/defaultSelectedKeys/onSelectionChange · isOpen/defaultOpen/onOpenChange) */
  contract?: { value: string; default: string; onChange: string };
  /** 게이트 — 선행 연구 §1 (isReadOnly 가 hover 까지 끈다 · isPending 이 onKeyDown 도 지운다) */
  gates: Array<"isDisabled" | "isReadOnly" | "isPending">;
  /** §3-6 — selection 은 collection, open 은 overlay 본체. Trigger 래퍼는 결합기 */
  owner: "self" | "collection" | "overlay";
  /** Provider 주입 대상 — 공개 export 만, slot 은 RAC 가 정의한 이름만 ('selection' · 'increment' · 'drag') */
  racContexts: Array<{ context: string; slot?: string }>;
  /** behavior 개념이 노출하는 상태 속성 — Canvas 는 소비하지 않음 */
  dataAttrs: string[];
  /** When 축 — RAC 이벤트 prop */
  events: string[];
  /** Do 축 — 다른 노드가 호출할 수 있는 명령 */
  commands: string[];
  /** §3-3 — 중첩 경계에서 초기화할 상속 Context */
  clearsContexts?: string[];
}
```

각 필드의 근거: `layer` ← 3층 아키텍처 · `racContexts`/`slot` ← Provider + `slots` 패턴과 #9283 · `events` chain ← mergeProps 규칙 · `owner` ← DialogContainer 결정 + RAC Modal controlled 패턴 · `clearsContexts` ← #10368.

### 7.2 When / Do 축 매핑

- **When** = 개념의 RAC 이벤트 prop (`onPress` · `onHoverStart` · `onFocusChange` · `onChange` · `onSelectionChange` · `onOpenChange` · `onAction`). mergeProps 가 chain 하므로 사용자 저작 핸들러와 runtime 핸들러가 공존 — 실행 순서 (context 먼저 → 로컬) 를 계약에 명시. open 가족의 When 은 Trigger 래퍼 노드에서 난다 (선행 연구 §4-d).
- **Do** = 다른 노드의 개념이 노출하는 command (`value.set` · `toggle.flip` · `selection.select/clear` · `expansion.expand/collapse` · `open.open/close/toggle` · `form.submit/reset`). runtime 이 controlled 상태를 소유하고 Provider 로 주입하므로 **command 실행 = runtime 상태 변경 → Context 재주입**. open 의 Do 수신자는 overlay 본체 (§3-6).
- 사용자 커스터마이징 표면 (Design 패널의 variant · size) 은 스키마 밖 — D3 catalog 소유 (§6).
- ADR-214 `IMPLICIT_STATE_SOURCES` (관찰) 와 capability (쓰기) 가 같은 개념 표를 소비하면 prop 이름 불일치가 구조적으로 사라진다 (선행 연구 요약 7).

### 7.3 커스터마이징 뒤에도 개념이 깨지지 않는 불변식

| #   | 불변식                         | 내용                                                                                                                                                                                                                                                                                                   | 근거       |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| I1  | 소유 모드 고정                 | 노드 mount 시 controlled/uncontrolled 를 한 번 결정. `value` 류 키는 조건부 spread (`undefined` 를 넘기지 않음), controlled 면 첫 render 부터 빈값/null 로 채움. origin→instance 파생 · override 추가/제거로 소유자가 바뀌면 remount `key`. 전환 경고는 dev 전용이므로 dev 모드 게이트 테스트로 잡는다 | §3-4 · 3-5 |
| I2  | RAC `slot` 네임스페이스 불가침 | composition 의 slot · 부품 식별자는 자체 prop 으로 운반. RAC 로 넘길 때는 RAC 가 정의한 slot 이름으로만 변환하거나 `slot={null}`                                                                                                                                                                       | §3-2       |
| I3  | Context 경계 초기화            | 사용자가 slot 을 교체하거나 임의 중첩할 때 상속 Context (CollectionDocument 등) 를 Provider 로 명시 clear 하고 개념이 `racContexts` 로 선언한 것만 통과. 「Tabs 행에 collection」 이 기본 회귀 케이스                                                                                                  | §3-3       |
| I4  | 병합 의미 명시                 | 핸들러 chain · className 결합 · 스칼라 로컬 우선. override 가 「교체」 면 context 쪽에서 그 키를 제거해 chain 을 끊는다                                                                                                                                                                                | §3-1       |
| I5  | 공개 표면만                    | Context · Provider · useContextProps · useSlottedContext · 문서화된 hook 만. `useControlledState` 는 같은 규칙의 자체 구현. 「선언한 Context export 가 설치본에 존재」 하는 정적 게이트 (`d2S2Alignment` 와 같은 꼴)                                                                                   | §1.3       |
| I6  | open 소유자 = overlay 본체     | `isOpen/onOpenChange` 는 Modal · Popover · Tooltip 본체가 받는다. trigger 없는 instance 는 controlled overlay 단독. Trigger 래퍼 가족은 trigger 자식과 overlay 를 둘 다 slot 으로 보존                                                                                                                 | §3-6       |

### 7.4 단계적 도입 순서

| 단계 | 범위                                         | 요점                                                                                                                                                                                                                                                                 | 측정 등급 |
| ---- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| P0   | 인벤토리                                     | 개념 × 공개 Context 존재 표 (116 Context vs 항목 단위 · FileTrigger · Virtualizer 예외) 를 현재 Preview renderer (props 식 15 · 선별 8 · 무시 3 — 메모리 `project-builder-must-reach-rac-composition-level`) 와 `CAPABILITY_REGISTRY` 28 type (선행 연구 §4) 에 대조 | A (코드)  |
| P1   | behavior — press · hover · focus             | state 없음, `data-*` 와 render props 만 소비. I4 만 관여 — 위험 최저                                                                                                                                                                                                 | A         |
| P2   | toggle · value                               | 삼중 계약 + I1 remount. mittwald 사례 (value 무조건 spread) 를 원복 RED 회귀 테스트로                                                                                                                                                                                | A         |
| P3   | singleSelection · multiSelection · expansion | collection 소유 (I3). 항목 `isSelected` 집계는 runtime 이 `selectedKeys` 를 소유하는 순간 **초기 controlled 값**으로 옮긴다 — 둘 다 넘기지 않기 (§3-5)                                                                                                               | A         |
| P4   | open · action                                | overlay 가족 + Trigger 래퍼 (I6). DialogTrigger 안 Tabs 등 #10367 가드 케이스 확인. deferred 13 종 중 8 종 해제 후보 (선행 연구 §4-b)                                                                                                                                | A         |
| P5   | dragDrop · form                              | 복합 개념 — 마지막                                                                                                                                                                                                                                                   | A         |

각 phase 는 원복 RED + live 1회로 닫고, phase 당 판독 1 + 수리 검증 1 (`.claude/rules/review-loop-closure.md` §3).

## 8. 결정 지점 (사용자 결정 필요 — 4개 결정 지점에 해당하는 것만)

선행 연구 §6 과 같다. 이 연구가 더한 판단 재료:

1. **(3) SSOT 경계** — 「Preview/Publish runtime 이 controlled prop 을 소유하고 Provider 로 주입」 은 RAC 가 문서로 지지하는 소비 방식이므로 D1 침범이 아니다 (§1.2). runtime 은 RAC DOM · ARIA 를 바꾸지 않고 props 만 공급한다. 다만 I3 의 Context clear 는 RAC 가 「소비자 책임」 으로 넘긴 영역이라 composition 이 소유하는 규칙이 된다.
2. **(4) scope** — ADR-158 「한 규칙 = 한 줄」 유지 vs Do 축 인자 전달 허용. §7.2 의 command 목록 (`selection.select(keys)` · `value.set(v)`) 은 인자가 있어야 닫힌다.

## 9. 한계 · 시의성

- 범위 공백: 질문 3 의 Radix · Ark UI · Base UI · Headless UI · Downshift · Framer/Figma/Pen.dev · Webflow 비교와 질문 4 의 외부 근거는 검증 통과 0 (§5 · §6).
- 2-1 표결 3건은 본문에 정정 문구를 병기했다 (§1.2 「모든 컴포넌트」 · §1.3 「necessarily」 · §5 Zag 동기). 기각 4건은 §1.3 · §3-3 · §3-6 에 적어 설계 근거에서 제외했다.
- remount key · collection 집계 충돌은 외부 검증 출처가 없고 I1 규칙에서 연역한 것이며, §3-5 는 설치본 대조로만 보강했다.
- issue #9283 은 open, #10368 은 not_planned 로 상태가 바뀔 수 있고, `react-stately/useControlledState` subpath 처럼 export 표면이 움직이는 중. 코드 대조는 모두 설치본 (RAC 1.22.1 · react-aria 3.53.1 · react-stately 3.51.0 · S2 1.8.1) 기준.
- 제안 (§7) 은 종합이지 1차 출처가 직접 보증하는 설계가 아니다 — ADR 로 올릴 때 P0 인벤토리를 먼저 붙인다.

## 부록. 출처 품질 표 (claim 을 낸 출처만)

| 출처                                                                                                                          | 품질                     | 각도                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------- |
| react-aria.adobe.com/customization · /hooks · /mergeProps · /Modal · /Table · /GridList                                       | 공식 문서                | 공식 경계 · 함정                       |
| react-spectrum.adobe.com/architecture · /releases/2023-04-05 · /react-spectrum/versioning                                     | 공식 문서                | 공식 경계 · 3층 아키텍처               |
| adobe/react-spectrum #6222 · #8620 · #1858 · #9850 · #9283 · #10368 · #10019 · #10367 · #1039 · #1082                         | 유지보수자 발언          | hook 안정성 · slot · Context · Trigger |
| mittwald/flow #3027 · #3078                                                                                                   | 2차 (디자인 시스템 사례) | controlled 전환                        |
| zagjs.com introduction · @zag-js/core README · chakra-ui/zag discussions #392 · #1547                                         | vendor 자기 서술         | 상태 머신 비교                         |
| 설치본 `node_modules/.pnpm/{react-aria-components@1.22.1, react-aria@3.53.1, react-stately@3.51.0, @react-spectrum+s2@1.8.1}` | 1차 (코드)               | 전 항목 대조                           |
| `.claude/rules/ssot-hierarchy.md` · `d2S2Alignment.static.test.ts` · `d2Provenance.ts`                                        | 프로젝트 정본            | 질문 4                                 |

워크플로 통계: 각도 6 · 출처 27 · claim 128 추출 · 25 검증 (확정 21 · 기각 4) · 11 finding · agent 110 · 23분. 원자료: `~/.claude/projects/-Users-admin-work-composition/311cbb81-9d8d-4f7e-8569-4c88bc5f59a3/subagents/workflows/wf_70daa625-c83/journal.jsonl`.
