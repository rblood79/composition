# ADR-158 구현 상세 — Interactions 재설계 (한 줄 규칙 + capability registry + Preview 실행)

> 본문: [ADR-158](../completed/158-interactions-rules-capability-registry.md). 본 문서는 구현 상세 전용 (Phase / 파일 목록 / 스키마 / capability 표).

## §0. Phase 0 Inventory freeze (실측 2026-07-25, HEAD `137c20784`)

Phase 0 완료 기준의 표 3개. 이후 phase 의 판정 근거이자 Phase 4 삭제 경계의 기준선.

### 표 ① — 은퇴 대상 코드 인벤토리

`apps/builder/src/builder/panels/events/` — **92파일 / ts·tsx 14,327 LOC + css 2,876 LOC = 17,203 LOC**

| 디렉터리      | 파일 |   LOC | 성격                                      |
| ------------- | ---: | ----: | ----------------------------------------- |
| `.` (루트)    |    7 | 3,207 | EventsPanel + EventsPanel.css(792)        |
| `actions/`    |   26 | 2,675 | 액션 에디터 25종                          |
| `data/`       |    4 | 1,676 | actionMetadata(715) / eventTemplates(579) |
| `components/` |   10 | 1,378 | 공용 UI                                   |
| `preview/`    |    4 | 1,163 | EventDebugger(541)                        |
| `editors/`    |    7 | 1,076 | VariableBindingEditor(410) 등             |
| `execution/`  |    4 |   952 | eventExecutor                             |
| `hooks/`      |    7 |   952 | —                                         |
| `utils/`      |    5 |   938 | —                                         |
| `types/`      |    4 |   932 | eventTypes(397)                           |
| `blocks/`     |    7 |   935 | block-editor.css(620)                     |
| `pickers/`    |    3 |   668 | EventTypePicker(367)                      |
| `state/`      |    4 |   651 | —                                         |

**실측 정정 2건** (본문 §Context 수치 대비):

1. LOC 14,317 → **14,327** (ts·tsx). 92파일은 일치. CSS 2,876 LOC 는 본문 수치에 미포함이었음 — 은퇴 총량은 17,203 LOC.
2. **은퇴 scope 누락 발견**: `apps/builder/src/utils/events/` **3파일 1,419 LOC** (`eventEngine.ts` 1,267 / `actionHandlerRegistry.ts` 104) 가 ADR 본문·breakdown 어디에도 없다. Preview 런타임 측 잔재이므로 **Phase 4 은퇴 대상에 추가**. 총 은퇴 규모 = **95파일 / 18,622 LOC**.

**외부 → 내부 참조 (삭제 시 파손 지점, 4건)**:

| 참조원                                            | 심볼                  | Phase 4 처리                                  |
| ------------------------------------------------- | --------------------- | --------------------------------------------- |
| `builder/panels/core/panelConfigs.ts:37`          | `EventsPanel`         | Phase 2 에서 `InteractionsPanel` 로 교체 완료 |
| `builder/inspector/types.ts:2,235`                | `EventHandler` (type) | 신규 `InteractionRule` 로 교체                |
| `types/builder/unified.types.ts:3`                | `ElementEvent`        | 은퇴 (mirror 소멸과 동반)                     |
| `types/integrations/supabase.types.ts:3`          | `ElementEvent`        | 은퇴 (동상)                                   |
| `preview/App.tsx:42` · `preview/types/index.ts:3` | `EventEngine`         | **추가분** — utils/events 은퇴와 동반         |

### 표 ② — registry 어휘 대조표 (`types/events/events.registry.ts` 415줄)

**EVENT_REGISTRY 24종** (본문은 혼재만 지적, 전수는 여기서 확정):

| 판정                     | 개수 | 항목                                                                                                                                       |
| ------------------------ | ---: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **은퇴 — DOM 별칭**      |   10 | onClick · onDoubleClick · onMouseEnter · onMouseLeave · onMouseDown · onMouseUp · onKeyDown · onKeyUp · onKeyPress · onInput               |
| **은퇴 — 비RAC·미구현**  |    3 | onScroll · onResize · onLoad (`implemented:false`)                                                                                         |
| **유지 후보 — RAC 실존** |   11 | onPress · onSelectionChange · onAction · onOpenChange · onChangeEnd · onExpandedChange · onRemove · onChange · onSubmit · onFocus · onBlur |

- 은퇴 10종은 본문 §Decision 목록과 **일치** (검증 완료).
- 유지 후보 11종은 §3 capability 표의 `events` 축 상한 — 실제 등재는 컴포넌트별로 표 ③ 판정과 교차.

**IMPLEMENTED_ACTION_TYPES 47종** — camelCase 28 + snake_case 별칭 19 (`CAMEL_ACTION_LABELS` 28키 / `SNAKE_TO_CAMEL` 19키로 확증). 본문 수치와 일치. 전량 은퇴 → capability + 앱 액션 2종(navigate/toast)으로 대체.

**When 축 실행 경로 — provider 0건 (dead seam)**:

| 심볼                                           |  소비 |  공급 | 판정                                                                              |
| ---------------------------------------------- | ----: | ----: | --------------------------------------------------------------------------------- |
| `RenderContext.services.createEventHandlerMap` |    15 | **0** | 옵셔널 체인 + `?? {}` 폴백 → 항상 빈 맵                                           |
| `EventEngine.executeEvent`                     | **0** |     1 | 인스턴스는 preview 싱글톤으로 존재·context 주입(App.tsx:653,673)하나 **호출 0건** |
| preview 의 `element.events` read               | **0** |     — | 0건                                                                               |

→ 본문 "이벤트를 올바로 소비하는 런타임 0개" **재확인**. 정밀화: _인스턴스 0_ 이 아니라 **인스턴스는 있으나 동작 호출 0** (`syncVariables` 만 호출됨 — 변수 동기화 용도, 이벤트와 무관).

### 표 ③ — Preview controlled/uncontrolled 실태 (R1 근거 · G1 입력)

**2분류가 아니라 3분류**다. uncontrolled 라도 `key` 에 해당 상태가 포함되면 prop patch 가 remount 로 반영되므로, generic prop patch dispatcher 관점에서는 동작 가능하다.

| 분류    | 정의                                         | capability 동작                     |
| ------- | -------------------------------------------- | ----------------------------------- |
| **(a)** | controlled — 상태 prop 직접 소비             | ✅ 즉시                             |
| **(b)** | uncontrolled + `key` 에 상태 포함 → remount  | ✅ 단 내부 상태(포커스·스크롤) 소실 |
| **(c)** | `default*` 만 + `key` 고정, 또는 prop 미배선 | ❌ 무반응                           |

| 컴포넌트                  | Preview 렌더 위치               | 상태 prop                                                 | key                                              | 분류     |
| ------------------------- | ------------------------------- | --------------------------------------------------------- | ------------------------------------------------ | -------- |
| Tree                      | CollectionRenderers.tsx:141,151 | `expandedKeys`/`selectedKeys` + on\*Change                | `element.id` (고정)                              | **(a)**  |
| TagGroup                  | CollectionRenderers.tsx:388     | `selectedKeys`                                            | `element.id`                                     | **(a)**  |
| Modal                     | LayoutRenderers.tsx:916         | `props.isOpen === false → display:none`                   | `element.id`                                     | **(a′)** |
| ListBox                   | SelectionRenderers.tsx:645      | `defaultSelectedKeys`                                     | `${id}:${selectionSignature}`                    | **(b)**  |
| GridList                  | SelectionRenderers.tsx:1017     | `defaultSelectedKeys`                                     | `${id}:${gridSelectionSignature}`                | **(b)**  |
| Checkbox                  | FormRenderers.tsx:557           | `defaultSelected`                                         | `${id}:${isSelected}:…`                          | **(b)**  |
| ToggleButton (standalone) | CollectionRenderers.tsx:717     | `defaultSelected` (조건부 spread)                         | `${id}:${isSelected}`                            | **(b)**  |
| RadioGroup                | FormRenderers.tsx:858           | `defaultValue`                                            | `${id}:${selectedRadioValue}`                    | **(b)**  |
| Slider                    | SelectionRenderers.tsx:1787     | `defaultValue`                                            | `${id}-${value}-${min}-${max}`                   | **(b)**  |
| Tabs                      | LayoutRenderers.tsx:140         | `defaultSelectedKey`                                      | `${id}:${defaultSelectedKey}`                    | **(b)**  |
| Disclosure                | LayoutRenderers.tsx:1653,1668   | `defaultExpanded`                                         | `${id}:${isExpanded}`                            | **(b)**  |
| Select                    | SelectionRenderers.tsx:1305     | `defaultSelectedKey`                                      | `element.id` (고정)                              | **(c)**  |
| ComboBox                  | SelectionRenderers.tsx:1580     | `defaultSelectedKey`/`defaultInputValue`                  | `element.id` (고정)                              | **(c)**  |
| TextField                 | FormRenderers.tsx:168           | `defaultValue`                                            | `element.id` (고정)                              | **(c)**  |
| NumberField               | FormRenderers.tsx:247           | `defaultValue`                                            | `element.id` (고정)                              | **(c)**  |
| SearchField               | FormRenderers.tsx:333           | `defaultValue`                                            | `element.id` (고정)                              | **(c)**  |
| Switch                    | FormRenderers.tsx:926           | `defaultSelected`                                         | `element.id` (고정)                              | **(c)**  |
| Table                     | TableRenderer.tsx:348           | **selection prop 0건**                                    | `element.id`                                     | **(c)**  |
| DisclosureGroup           | LayoutRenderers.tsx:1583        | `defaultExpandedKeys`                                     | `${id}:${multiple}` (확장상태 미포함)            | **(c)**  |
| DatePicker / Calendar     | DateRenderers.tsx:125,196       | `defaultValue`                                            | id+locale+calendarSystem(+isTime) — value 미포함 | **(c)**  |
| Popover / Tooltip         | LayoutRenderers.tsx:673,585     | **`isOpen`/`onOpenChange` 미배선**                        | `element.id`                                     | **(c)**  |
| Menu                      | CollectionRenderers.tsx:764     | **`isOpen` 미배선**                                       | —                                                | **(c)**  |
| Form                      | FormRenderers.tsx:111           | `onSubmit`/`onReset` 미배선 — 특례(ref `requestSubmit()`) | `element.id`                                     | **특례** |

**§3 capability 표에 대한 정정 필요 사항** (Phase 1 에서 반영):

- **Modal 은 RAC `<Modal>`/`<ModalOverlay>` 가 아니다** — `renderModal` 이 `props.isOpen === false → display:none` 인 평범한 `<div>` 를 낸다. 즉 Modal 의 `open`/`close` 는 공통 `show`/`hide` 와 **같은 메커니즘**이며 별도 capability 로 둘 근거가 약하다. RAC `isOpen` racRef 는 `Modal.tsx` 컴포넌트 타입(`ModalOverlayProps`)에만 존재하고 렌더 경로가 쓰지 않는다.
- **Popover / Tooltip / Menu 의 `open`/`close` 는 G1 미충족** — 렌더러가 `isOpen`/`onOpenChange` 를 아예 전달하지 않는다. controlled 전환 전 등재 금지.
- **Table 의 `selectItem`/`clearSelection` 은 G1 미충족** — selection prop 자체가 0건 (본문 R1 이 지목한 그 항목).
- (c) 분류 전량이 G1 게이트에 걸린다: Select · ComboBox · TextField · NumberField · SearchField · Switch · DisclosureGroup · DatePicker · Calendar.
- **(b) 분류의 G1 판정은 Phase 1 결정 사항** — R1 문언대로 "uncontrolled = 등재 금지" 를 엄격 적용하면 등재 가능 capability 가 (a) 3종으로 축소되어 G2 의 4종 동작 시연조차 불가능해진다. 권고: **(b) 는 등재 허용** (prop patch 가 remount 로 실제 반영됨 — 동작 검증 가능), 단 registry 에 `remount: true` 를 표기해 내부 상태 소실을 명시. (c) 만 보류.

### Phase 1 진입 시 확정된 등재 가능 범위 (권고안 기준)

| 대상                                | 등재 capability                                     |
| ----------------------------------- | --------------------------------------------------- |
| 전체 시각 요소                      | `show` / `hide` / `toggle` (공통)                   |
| Tree                                | selectItem · clearSelection · expand · collapse     |
| TagGroup                            | selectItem · clearSelection                         |
| ListBox · GridList                  | selectItem · clearSelection (remount)               |
| Checkbox · ToggleButton(standalone) | check · uncheck · toggle (remount)                  |
| RadioGroup · Slider                 | setValue (remount)                                  |
| Tabs                                | selectTab (remount, prop 명 = `defaultSelectedKey`) |
| Disclosure                          | expand · collapse (remount)                         |
| Form                                | submit · reset (특례 — ref)                         |
| 앱 액션                             | navigate · toast                                    |

보류(G1 미충족, Phase 3 이후 controlled 전환 시 해제): Select · ComboBox · TextField · NumberField · SearchField · Switch · Table · DisclosureGroup · DatePicker · Calendar · Popover · Tooltip · Menu.

## §1. Fork checkpoint lock-in (adr-writing.md 4 질문)

1. **base/응용 분류**: 본 ADR 은 단일 수직 슬라이스 (어휘 SSOT + UI + 런타임 1경로) — base/응용 분리 없음. publish 동작·cross-event reuse 는 후속 ADR (응용) 로 명시 이관.
2. **schema 직교성**: `InteractionRule` 스키마는 ADR-131 root collection 의 entry 형태 교체 — 직교 (root collection 메커니즘 자체는 무변경).
3. **선행 ADR 전제 reverse 검증**: ADR-149 의 전제 "기존 EventHandler 스키마 유지 + 편집 계층 우선" 을 승계하지 않음 — 사용자 재제기 (2026-07-20 "여전히 너무 복잡, 달라진 것 없음") 로 전제 재개 조건 (a) 성립. 소비 런타임 0개 실측 (ADR-149 recon) 이 스키마 drop 의 근거.
4. **codex 1차 진입 전 통과**: 위 1-3 은 brainstorm 세션에서 사용자 confirm 완료 (복잡성 4축 → 한 줄 규칙형 → 컴포넌트 고유 기능 위주 → RAC 검증 반영 승인 + ADR 생성 발의).

## §2. 신규 스키마 — InteractionRule

```ts
/** canonical events root collection 의 entry (기존 EventHandler 대체) */
interface InteractionRule {
  id: string;
  elementId: string; // 트리거 요소
  trigger: string; // RAC callback 이름 — CAPABILITY_REGISTRY[type].events 에 실존해야 함
  action:
    | { kind: "navigate"; params: { path: string } } // 앱 액션 1
    | { kind: "toast"; params: { message: string } } // 앱 액션 2
    | {
        kind: "capability";
        targetId: string; // 구동 대상 요소
        capability: string; // CAPABILITY_REGISTRY[targetType].capabilities 키
      };
}
```

- 저장 위치: `CompositionDocument.events` root collection (ADR-131) — 메커니즘 유지, entry 스키마만 교체.
- write 진입점: `updateEventsRootCollection` (ADR-149 2a wrapper) 시그니처를 `InteractionRule[]` 로 갱신 — 단일 진입점 유지.
- 기존 `EventHandler` 데이터: 마이그레이션 없이 drop (본문 §Decision — BC 수식화: 소비 런타임 0 → 사용자 영향 0%).
- `condition` / `debounce` / `throttle` / 다중 `actions[]` / 템플릿: 스키마에서 원천 제거.
- **읽기 경로 (리뷰 round 1 정정)**: 신규 `useInteractionRules` 는 canonical `events` root collection 을 **직접 read** — 구 패널의 legacy projection (`selectedElement.events`, EventsPanel.tsx 헤더 주석 "canonical-synced legacy projection") 비의존. ADR-149 가 후속 이관했던 "builder-side reader canonical 전환" 을 신규 패널은 처음부터 canonical read 로 달성.
- **ADR-149 adapter 처리 방침 (리뷰 round 1 정정)**: 역방향 adapter `migrateRootCollectionToLegacy` (`apps/builder/src/adapters/canonical/rootCollectionMigration.ts`) 와 legacy `element.events` mirror 파생 (`rootCollectionEventsWrite.ts`) 은 **구 EventHandler 스키마 전용** — Phase 1 에서 신규 스키마 대상 mirror 파생을 중단하고, Phase 4 에서 구 registry 와 동반 은퇴. `element.events` mirror 소멸 시 publish `ElementRenderer.tsx:76-90` 의 legacy 소비는 `events === undefined → return {}` no-op 으로 안전 (실측 2026-07-20).

## §3. Capability Registry — 단일 파일 SSOT

위치: `packages/shared/src/interactions/capabilityRegistry.ts` (신규 — metadata.ts 의 supportedEvents 를 대체·흡수)

```ts
interface CapabilityDef {
  label: string;
  /** RAC controlled prop 근거 (G1 게이트 — 없으면 등재 금지) */
  prop: string;
  /** 설정값 — "!self" = 현재값 토글, null = 해제 */
  value: unknown | "!self";
  /** RAC 레퍼런스 문서 인용 (G1 증빙) */
  racRef: string;
}

interface ComponentCapability {
  /** When 축 — RAC/RSP 레퍼런스 실존 callback 만 */
  events: string[];
  /** Do 축 — 이 컴포넌트가 "당할 수 있는" 고유 기능 */
  capabilities: Record<string, CapabilityDef>;
}

export const CAPABILITY_REGISTRY: Record<string, ComponentCapability>;
```

### 공통 capability (모든 시각 요소)

| 키       | prop (style 경유)       | 값        |
| -------- | ----------------------- | --------- |
| `show`   | `style.display` restore | 이전 값   |
| `hide`   | `style.display`         | `"none"`  |
| `toggle` | `style.display`         | `"!self"` |

### 컴포넌트별 capability 표 (RAC 레퍼런스 검증 완료 — 2026-07-20)

| 컴포넌트 type                         | events (When)                            | capabilities (Do)                                       | RAC 근거 (controlled prop)     |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| Button / Link                         | `onPress`                                | (공통만)                                                | Button.md `onPress`            |
| Modal / Popover / Tooltip             | `onOpenChange`                           | `open` / `close`                                        | `isOpen`                       |
| Select                                | `onSelectionChange` / `onOpenChange`     | `selectItem` / `clearSelection` / `open` / `close`      | `selectedKey`, `isOpen`        |
| ComboBox                              | `onSelectionChange` / `onInputChange`    | `selectItem` / `clearSelection` / `setInput`            | `selectedKey`, `inputValue`    |
| ListBox / GridList / TagGroup / Table | `onSelectionChange`                      | `selectItem` / `clearSelection`                         | `selectedKeys`                 |
| Tree                                  | `onSelectionChange` / `onExpandedChange` | `selectItem` / `clearSelection` / `expand` / `collapse` | `selectedKeys`, `expandedKeys` |
| Tabs                                  | `onSelectionChange`                      | `selectTab`                                             | `selectedKey`                  |
| Checkbox / Switch / ToggleButton      | `onChange`                               | `check` / `uncheck` / `toggle`                          | `isSelected`                   |
| TextField / NumberField / SearchField | `onChange` / `onSubmit`(SearchField)     | `setValue` / `clear`                                    | `value`                        |
| Slider / RadioGroup                   | `onChange` / `onChangeEnd`(Slider)       | `setValue`                                              | `value`                        |
| Disclosure / DisclosureGroup          | `onExpandedChange`                       | `expand` / `collapse`                                   | `isExpanded`/`expandedKeys`    |
| DatePicker / Calendar                 | `onChange`                               | `setValue` / `open`(Picker)                             | `value`, `isOpen`              |
| Menu (Trigger)                        | `onAction` / `onOpenChange`              | `open` / `close`                                        | `isOpen`                       |
| Form                                  | `onSubmit` / `onReset`                   | `submit` / `reset` — **특례: DOM `requestSubmit()`**    | (controlled prop 없음)         |

**특례 2건** (generic prop patch 로 환원 불가):

1. **Toast**: 대상 컴포넌트 아님 — 앱 액션 `toast` 로 처리. RAC `ToastQueue.add()` (현재 `UNSTABLE_` 접두 — R2).
2. **Form submit/reset**: DOM `form.requestSubmit()` / `reset()` ref 경유 (RAC 이 native form 위임 — D1 침범 아님, RAC 공식 패턴).

### 은퇴 대상 (어휘)

- `EVENT_REGISTRY` 의 DOM 별칭: `onClick` / `onDoubleClick` / `onMouseEnter` / `onMouseLeave` / `onMouseDown` / `onMouseUp` / `onKeyDown` / `onKeyUp` / `onKeyPress` / `onInput` — RAC 레퍼런스 비실존 또는 RAC 대응 이름 존재 (`onPress`, `onHoverStart/End`).
- `IMPLEMENTED_ACTION_TYPES` 28종 + snake_case 별칭 19종 전체 — capability + 앱 액션 2종으로 대체.

## §4. Preview 실행 dispatcher

위치: `apps/builder/src/preview/interactions/` (신규)

```
dispatcher.ts        — InteractionRule → 실행. 분기 3개뿐:
                       capability → runtimeStore controlled prop patch (generic)
                       navigate   → preview router 페이지 전환
                       toast      → ToastQueue.add()
useInteractionBindings.ts — 요소 렌더 시 trigger callback 주입
                       (rules 를 elementId 로 색인 → RAC callback prop 생성)
```

- **수신 경로**: canonical events root collection → 기존 preview messaging seam (`messageHandler.ts` / `builderPropSync.ts`) 으로 rules 전달 → `runtimeStore` 보관.
- **실행**: Preview 렌더러가 요소별 `useInteractionBindings(elementId)` 로 callback props 를 받아 RAC 컴포넌트에 스프레드. Preview 는 runtime store 전용 (builder store 직접 참조 금지 — 기존 원칙 유지).
- **controlled 배선 게이트 (R1)**: capability 대상 컴포넌트가 Preview 에서 uncontrolled 렌더 중이면 (기존 확인: Table selection uncontrolled 패턴) 해당 컴포넌트 capability 는 controlled 전환 완료 전 registry 등재 금지. Phase 0 inventory 에서 컴포넌트별 controlled/uncontrolled 실태 표 작성.
- **성능**: dispatch 는 이벤트 발생 시 1회 store patch — 렌더 hot path (rAF/layout) 침범 없음.

## §5. 신규 UI 모듈 — `apps/builder/src/builder/panels/interactions/`

목표 ≤ 15파일 (G4), 계획 10파일:

| #   | 파일                     | 역할                                                           |
| --- | ------------------------ | -------------------------------------------------------------- |
| 1   | `InteractionsPanel.tsx`  | 패널 루트 — 규칙 목록 + 빈 상태 + 추가 버튼                    |
| 2   | `RuleRow.tsx`            | 한 줄 요약 (`onPress → 열기 @ Modal#login`) + 인라인 펼침      |
| 3   | `TriggerPicker.tsx`      | When — 선택 요소 type 의 `events` 목록                         |
| 4   | `ActionPicker.tsx`       | Do — 앱 액션 2종 + "컴포넌트 기능…" 진입                       |
| 5   | `TargetPicker.tsx`       | 대상 요소 선택 (capability 보유 요소만 필터)                   |
| 6   | `CapabilityPicker.tsx`   | 대상 type 의 capabilities 목록                                 |
| 7   | `ParamField.tsx`         | navigate 페이지 선택 / toast 메시지 입력                       |
| 8   | `useInteractionRules.ts` | selectedElement 규칙 read + `updateEventsRootCollection` write |
| 9   | `InteractionsPanel.css`  | 스타일 (시맨틱 변수만)                                         |
| 10  | `types.ts`               | InteractionRule re-export + 패널 로컬 타입                     |

- 인라인 편집 필드 3개 이내 (trigger / action / target·param) — 조건·타이밍·고급 섹션 없음.
- 패널 등록 (리뷰 round 1 정정): `panels/core/panelConfigs.ts` 의 `id: "events"` config 항목 교체 (`component: EventsPanel → InteractionsPanel`, 현행 panelConfigs.ts:195-207). `<Activity mode="hidden">` gating 은 `layout/PanelContainer.tsx` (ADR-155) 그대로.

## §6. Phase 분해

| Phase    | 내용                                                                                                            | 완료 기준                                                                                                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0** ✅ | Inventory freeze — panels/events 92파일 목록 / registry 어휘 대조표 / Preview controlled·uncontrolled 실태 표   | **완료 2026-07-25** — §0 에 표 3개 기록. 정정 2건(LOC·은퇴 scope) + capability 표 정정 5건 도출                                                                                                                                                                                                                                |
| **1** ✅ | `CAPABILITY_REGISTRY` + `InteractionRule` 스키마 + `updateEventsRootCollection` 시그니처 갱신                   | **완료 2026-07-25** (`89ab4154b`) — G1 정적 가드 18 케이스 + racRef 전건 RAC 문서 실측 대조. 구 패널은 deprecated node-projection 경로로 분리                                                                                                                                                                                  |
| **2** ✅ | InteractionsPanel UI 10파일 + PanelContainer 교체                                                               | **완료 2026-07-25** (`616950cca`) — 11파일. live CRUD 확증 + getSnapshot 무한루프 회귀 수정·테스트 동반                                                                                                                                                                                                                        |
| **3** ✅ | Preview dispatcher + bindings + messaging 연결                                                                  | **완료 2026-08-16** — G2 4종 live 확증 (cutover 트리거 Button×3/Link×1). 배선 결손 3건 동반 수리: 대상 축 `Modal.binding.accepts.isOpen` 누락 / 트리거 축 catalog generic 경로의 `createEventHandlerMap` 미호출(116 타입) / 실행 override 미판독(`toRacProps`·`toReactStyle`)                                                  |
| **4** ✅ | 구 시스템 은퇴 — panels/events 92파일 + **utils/events 3파일** + registry 구 어휘 + ADR-149 legacy adapter 삭제 | **완료 2026-08-16** — 사용자 명시 삭제 승인 후 96파일 / 19,513 LOC 제거. type-check PASS(baseline 43 불변) + grep 잔존 0(묘비 주석만) + live 빌더 부팅·Interactions CRUD 왕복. `EVENT_REGISTRY` 는 RAC 실존 11종으로 축소 존치 — `ItemsManager` 의 `event-id` 드롭다운이 live consumer 였다(§0 표 ① 파손 지점 6곳에 없던 항목) |

- Phase 간 커밋 분리 (phase 당 1+ 커밋, main 직접 push).
- Phase 4 의 파일 삭제는 CLAUDE.md 마이그레이션 원칙 — "ok/진행해" 는 삭제 승인 아님, 별도 확인 질문 필수.
- Phase 4 은퇴 총량 (§0 표 ① 정정 반영): **95파일 / 18,622 LOC** (panels/events 92 + utils/events 3). 외부 참조 파손 지점 6곳은 §0 표 ① 하단 표 참조.

### Phase 3 진입 시 선행 확인 (Phase 0~2 에서 확보한 사실)

- **트리거 배선 현황**: `RenderContext.services.createEventHandlerMap` 은 소비 15곳 / **공급 0곳** 인 dead seam 이다. 소비 지점은 Card · Button · Modal · Breadcrumbs · Link · Toast · Pagination (LayoutRenderers) / ListBox · GridList · Select · ComboBox (SelectionRenderers) / DropZone (FormRenderers) **12종뿐** — Tree · TagGroup · Checkbox · ToggleButton · RadioGroup · Slider · Tabs · Disclosure · Form 은 spread 지점 자체가 없다. `useInteractionBindings` (§4) 는 provider 를 채우는 것만으로는 부족하고 **미배선 렌더러에 spread 를 추가**해야 한다.
- **capability 동작 3분류**: (a) controlled 는 prop patch 즉시 반영, (b) remount 는 patch 후 `key` 변경으로 반영, (c) 는 registry 미노출이라 dispatcher 가 만날 일이 없다. dispatcher 는 (a)/(b) 를 구분할 필요가 없다 — 둘 다 "prop 을 patch" 로 동일하다.
- **G2 4종 달성 경로**: navigate·toast 는 앱 액션 (dispatcher 직접), hide·show 는 공통 `style.display` patch, modal open 은 `Modal.isOpen` patch → `renderModal` 이 `display:none` 을 해제. 넷 다 보류(c) 분류와 무관하다.

## §7. 후속 ADR 이관 목록 (본 ADR 범위 밖)

- publish 앱 동작 (Preview 와 동일 dispatcher 재사용 전제 — 스키마는 이미 소비 가능 형태)
- cross-event reuse / 조건부 실행 (필요 실증 후)
- builder(Skia) 쪽 인터랙션 미리보기 (Skia=빌더≠프론트엔드 원칙상 비대상 — 재제기 시에만)
