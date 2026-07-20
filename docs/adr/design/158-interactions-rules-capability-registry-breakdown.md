# ADR-158 구현 상세 — Interactions 재설계 (한 줄 규칙 + capability registry + Preview 발화)

> 본문: [ADR-158](../158-interactions-rules-capability-registry.md). 본 문서는 구현 상세 전용 (Phase / 파일 목록 / 스키마 / capability 표).

## §1. Fork checkpoint lock-in (adr-writing.md 4 질문)

1. **base/응용 분류**: 본 ADR 은 단일 수직 슬라이스 (어휘 SSOT + UI + 런타임 1경로) — base/응용 분리 없음. publish 발화·cross-event reuse 는 후속 ADR (응용) 로 명시 이관.
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

## §4. Preview 발화 dispatcher

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
- **발화**: Preview 렌더러가 요소별 `useInteractionBindings(elementId)` 로 callback props 를 받아 RAC 컴포넌트에 스프레드. Preview 는 runtime store 전용 (builder store 직접 참조 금지 — 기존 원칙 유지).
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
- 패널 등록: PanelContainer 의 기존 Events 슬롯 교체 (`<Activity mode="hidden">` gating 은 ADR-155 그대로).

## §6. Phase 분해

| Phase | 내용                                                                                                          | 완료 기준                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **0** | Inventory freeze — panels/events 92파일 목록 / registry 어휘 대조표 / Preview controlled·uncontrolled 실태 표 | breakdown 에 표 3개 커밋                                             |
| **1** | `CAPABILITY_REGISTRY` + `InteractionRule` 스키마 + `updateEventsRootCollection` 시그니처 갱신                 | type-check PASS + registry unit test (G1 정적 가드 포함)             |
| **2** | InteractionsPanel UI 10파일 + PanelContainer 교체                                                             | builder 에서 규칙 CRUD 동작 (수동 confirm)                           |
| **3** | Preview dispatcher + bindings + messaging 연결                                                                | **G2**: navigate/toast/hide·show/modal open 4종 Chrome MCP 발화 확증 |
| **4** | 구 시스템 은퇴 — panels/events 92파일 + registry 구 어휘 삭제                                                 | **G3**: G2 PASS + 사용자 명시 삭제 승인 후. type-check + grep 잔존 0 |

- Phase 간 커밋 분리 (phase 당 1+ 커밋, main 직접 push).
- Phase 4 의 파일 삭제는 CLAUDE.md 마이그레이션 원칙 — "ok/진행해" 는 삭제 승인 아님, 별도 확인 질문 필수.

## §7. 후속 ADR 이관 목록 (본 ADR 범위 밖)

- publish 앱 발화 (Preview 와 동일 dispatcher 재사용 전제 — 스키마는 이미 소비 가능 형태)
- cross-event reuse / 조건부 실행 (필요 실증 후)
- builder(Skia) 쪽 인터랙션 미리보기 (Skia=빌더≠프론트엔드 원칙상 비대상 — 재제기 시에만)
