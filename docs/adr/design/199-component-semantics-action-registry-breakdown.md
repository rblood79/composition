# ADR-199 구현 상세 — 컴포넌트 시맨틱 액션 레지스트리 + 투영 불변식

> 본문: [199-component-semantics-action-registry.md](../199-component-semantics-action-registry.md)
> 상태: Proposed — 2026-08-30 (착수 전, 사용자 승인 대기)

---

## 1. 전제 lock-in (adr-writing.md §ADR Fork / 분리 결정 4 질문)

본 ADR 은 기존 ADR 의 잔여 영역 분리가 아니라 **완전 신규 주제** (표면 노출 축 SSOT) 이므로 Phase 0 fork 게이트 해당 없음. 다만 인접 ADR 과의 의존 방향은 아래로 고정한다.

1. **base / 응용 분류**: 본 ADR = **base** (액션 정의 축). ADR-182 (컨텍스트 메뉴) · ADR-192 (액션 바) · ADR-195 (실행 축 commandRegistry) · ADR-196 (agent 표면) 은 **응용/소비자**. 본 ADR 이 세 표면의 *항목 정의*를 대체하고, 각 표면은 렌더/필터만 남긴다.
2. **schema 직교성**: 액션 descriptor 는 `SHORTCUT_DEFINITIONS` (키 조합) · `COMMAND_META` (precondition/mutation/undo) 와 **직교 축**이다 — 같은 id 를 키로 쓰되 필드가 겹치지 않는다. specialization 아님.
3. **선행 ADR 전제 reverse 검증**: ADR-192 의 "바는 항목을 새로 정의하지 않는다 (182 파생)" 전제는 **유지**된다. 본 ADR 은 그 전제를 한 단계 위로 올릴 뿐이다 — 182 도 항목을 새로 정의하지 않고 레지스트리에서 파생한다. 방향 반전 없음.
4. **codex 1차 진입 시점**: 본 문서 + 본문 작성 완료 직후 (Phase 0 착수 전).

---

## 2. Phase 0 — inventory freeze (착수 전 필수) ✅ Implemented 2026-08-30

현행 4개 표면의 **항목 · 라벨 · 가용성 조건 · 순서**를 표로 고정한다. 이 표가 이관 후 동일성 판정의 기준선이다.

| 액션 id                   | Properties 패널                 | 컨텍스트 메뉴 (ADR-182)           | 액션 바 (ADR-192)               | 단축키 / agent                        |
| ------------------------- | ------------------------------- | --------------------------------- | ------------------------------- | ------------------------------------- |
| `go-to-origin`            | 아이콘, `Go to component`       | `원본으로 이동 / Go to component` | 메뉴 항목 파생, allowlist 1번   | —                                     |
| `detach-instance`         | 아이콘, `Detach instance`       | `인스턴스 분리 / Detach instance` | allowlist 2번                   | `⌘⌥X` · agent `detachInstance`        |
| `toggle-component-origin` | 라벨, `Create/Detach component` | `컴포넌트 만들기/분리 / Create…`  | allowlist 3번 (2026-08-30 편입) | `⌘⌥K` · agent `toggleComponentOrigin` |
| `select-instances`        | 아이콘, `Select instances (N)`  | **없음**                          | **없음**                        | —                                     |

freeze 산출물: [`docs/adr/evidence/199-surface-inventory.md`](../evidence/199-surface-inventory.md) (4표면 매트릭스 · 순서/라벨/가용성 · 4상태 × 3표면 G2 대조표 · 수치 기준선). **freeze 로 새로 드러난 발산 3건** — D1 메뉴 순서가 패널·바와 반대 (의도적 통일 대상, HC5 예외), D3 원본 없는 인스턴스에서 패널은 비활성·메뉴는 미노출 (보존), D4 `detach-instance` 만 메뉴에서 다중 선택을 받음 (`selectedElements.find` — descriptor 는 단일 노드 계약, 다중 경로는 표면 필터로 보존).

### 2-1. 현행 중복 실측 (2026-08-30)

| 축               | 정의 지점 수 | 파일                                                                                                                                                        |
| ---------------- | -----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 라벨             |            2 | `ComponentSemanticsSection.tsx` (영문) · `canvasContextMenuProviders.ts` (한/영 병기)                                                                       |
| 순서             |            2 | 패널 JSX 배치 · `actionBarPolicy.ts:ACTION_BAR_ALLOWLIST`                                                                                                   |
| 가용성 호출 조건 |            3 | 패널 (`isInstance`/`isOrigin`/`instanceIds.length`) · 메뉴 (`isComponentOrigin`/`detachableElement`) · 바 (항목 id 존재로 역추론 `resolveActionBarContext`) |
| 실행 + 확인      |            4 | 패널 · 메뉴 · `CanvasSelectionShortcuts.tsx` · `useGlobalKeyboardShortcuts.ts` (agent 는 executor confirm 게이트 별도)                                      |

호출부 총계: `detachInstance` 5 · `toggleComponentOrigin` 4 · `requestEditingSemanticsDetachConfirmation` 4.

---

## 3. Phase 1 — descriptor 축 추가 (정의만, 소비 0) ✅ Implemented 2026-08-30

`apps/builder/src/builder/config/componentSemanticsActions.ts` (신규 198줄) + `componentSemanticsActions.test.ts` (12건).

**확정 시그니처** (스케치 대비 2곳 확장 — Phase 0 freeze 가 드러낸 발산 D3·D4 를 흡수):

| 필드                                   | 확정 형태                                              | 이유                                                                                                                |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `label(target, ctx)`                   | 함수 (고정 문자열 아님)                                | `toggle-component-origin` 은 `reusable` 로 뒤집히고 `select-instances` 는 수를 단다                                 |
| `icon(target)`                         | 함수                                                   | 같은 이유 — 만들기/분리로 그림도 뒤집힌다                                                                           |
| `isAvailable(target, ctx)`             | 노출 여부                                              | —                                                                                                                   |
| **`isEnabled?(target, ctx)`** (추가)   | 노출됐지만 지금 누를 수 없음                           | 발산 D3 보존 — 원본 못 찾은 인스턴스에서 패널은 비활성, 메뉴는 미노출. 표면이 어느 쪽으로 표현할지 정함             |
| **`ActionAvailabilityContext`** (추가) | `{ hasResolvedOrigin, instanceCount, selectionSize }`  | 노드 하나로 알 수 없는 맥락. `selectionSize` 는 발산 D4 (메뉴 다중 detach) 대비 — descriptor 는 단일 노드 계약 유지 |
| `surfaces`                             | `properties-panel` / `context-menu` / `action-bar` 3종 | 단축키·agent 는 노출 표면이 아니라 명령 축 → `commandId` 로 연결                                                    |

`EditingSemanticsTarget` = `{ id, componentRole?, ref?, masterId?, reusable? }` — **`type` 없음** (HC3). 술어 3종(`isEditingSemanticsInstance` / `isEditingSemanticsOrigin` / `canDetachInstance`)은 재정의하지 않고 `adapters/canonical/editingSemantics` 에서 그대로 가져다 쓴다 — 축 판정은 이미 일치했고 (freeze 발산 D5) 이관 대상은 호출 지점이다.

진입점 `resolveComponentSemanticsActions(surface, target, ctx)` 가 배열 순서 · 표면 필터 · 가용성을 한 번에 적용한다. 메뉴 병기 조립도 `formatBilingualLabel` 로 같이 둔다.

**G1 결과**: `pnpm type-check` 0 · 신규 12건 PASS · 관련 스위트 137 PASS (`config` / `actionBar` / `contextMenu` / `editingSemantics`) · `commandMeta.static.test.ts` 단언 무변경 · 소비처 0. 잔여 실패 1건 `shortcutDisplay.static.test.ts` 는 ADR-196 표면 2곳의 `⌘Z` 리터럴로 **선행 실패** (본 phase 무관, 신규 파일 glyph 리터럴 0).

## 4. Phase 2 — 표면 이관 (소비처 3개, 순서 고정) ✅ Implemented 2026-08-30

| 순서 | 파일                                                                 | 변경                                                                                                  |
| ---: | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
|    1 | `builder/panels/properties/ComponentSemanticsSection.tsx`            | 버튼 4개를 `COMPONENT_SEMANTICS_ACTIONS.filter(isAvailable)` 매핑으로 교체. 라벨/아이콘/순서 제거     |
|    2 | `builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts` | 컴포넌트 블록(현행 335~400) 을 같은 배열 매핑으로 교체. `actionItem` 은 유지 (182 스키마)             |
|    3 | `builder/components/overlay/actionBar/actionBarPolicy.ts`            | `ACTION_BAR_ALLOWLIST.instance` 의 컴포넌트 축 3항목을 레지스트리 순서에서 파생. 나머지 컨텍스트 유지 |

각 단계 종료 시 commit 가능 상태 + 해당 표면 live 확인.

**G2 결과 (live, Chrome MCP)**: 4상태 × 3표면이 Phase 0 기준선과 일치. 변화는 D1 (메뉴 순서 통일) 1건 — HC5 명시 예외. 상세 표: [evidence §7](../evidence/199-surface-inventory.md#7-phase-2-live-실측-g2-2026-08-30-chrome-mcp).

**live 에서만 드러난 선행 결함 1건 (D7 → R7)**: `ref` 노드의 캔버스 사영이 인스턴스 자신의 `reusable` 을 싣지 않아 Instance·Origin 노드의 우클릭 메뉴가 `컴포넌트 만들기` (no-op) 를 띄운다. 이관 전후 동일이라 회귀는 아니며 **Phase 4 (투영 불변식)** 로 흡수한다 — 술어가 아니라 입력을 만드는 쪽이 빠뜨리는 형태다.

---

## 5. Phase 3 — 실행/확인 경로 통합 ✅ Implemented 2026-08-30

`apps/builder/src/builder/utils/componentSemanticsRunner.ts` 신규 (파일 표 §8 대비 신규 1 증가 — 아래 §5-1).

- `runComponentSemanticsAction(id, input)` 하나가 확인 다이얼로그 payload 조립 + store 액션 호출을 소유. 반환값은 **store 를 실제로 건드렸는가** (확인 취소·조건 미충족 = `false`).
- 이관한 호출부 5곳: `ComponentSemanticsSection.tsx` · `canvasContextMenuProviders.ts` · `CanvasSelectionShortcuts.tsx` · `useGlobalKeyboardShortcuts.ts` · `services/agent/agentCommands.ts`.
- agent 경로는 **executor confirm 게이트 유지** (ADR-196 계약) — 중복 다이얼로그를 막는 `{ confirm: "skip" }` 로 부른다.
- 라벨 fallback 은 패널 규칙(`componentName ?? customId ?? origin 이름 ?? type`)으로 통일 — 메뉴·단축키 3곳이 origin 을 되짚지 않던 차이를 흡수 (R2). `componentSemanticsRunner.test.ts` 11건이 규칙과 4 경로 동일성을 고정한다.
- **통일 확인**: `requestEditingSemanticsDetachConfirmation` 호출 1곳 (러너), `detachInstance(` / `toggleComponentOrigin(` store 호출 1곳 (러너) — 그 외 표면 소스에 0건.

### 5-1. 착수 중 판단 2건 (사후 보고)

1. **파일 1개 추가** — 러너를 레지스트리(`builder/config/`)에 두면 config 계층이 store 에 의존하게 되어 `builder/utils/` 로 분리했다. 파일 표 신규 3 → 4.
2. **ADR-196 정적 게이트 갱신** — `agentCommands.test.ts` 의 `EXPECTED_STORE_CALLS` 가 `toggleComponentOrigin(` / `detachInstance(` 문자열을 소스에서 직접 찾고 있었다. 게이트의 뜻("agent handler 가 그 액션의 실행 경로를 실제로 부르는가")은 유지하되 대상을 러너 호출로 바꿨다 — `runComponentSemanticsAction("<id>"` 2건 + `confirm: "skip"` 1건 단언으로 대체.

3. **`EditingSemanticsTarget` / `toEditingSemanticsTarget` 을 어댑터로 이관** — Phase 2 에서 레지스트리(`builder/config/`)에 뒀더니 ADR-116 G5 (legacy mirror 필드 `componentRole` / `masterId` 의 이름은 `adapters/canonical/**` 안에서만) 를 어겼다. 전수 게이트가 잡아 `adapters/canonical/editingSemantics.ts` 로 옮기고 레지스트리는 re-export 만 한다. 러너의 element 타입도 표시 이름 필드만 적고 판정은 `unknown` 을 받는 어댑터 술어에 넘긴다.

**G2 live (Chrome MCP)**: 캔버스 메뉴 · ⌘⌥X 두 경로에서 같은 분리 다이얼로그가 열리고 (`Detaching button_1 will turn it into a standalone element…`), 취소 시 인스턴스가 그대로 남는다 (`type:"ref"` + `reusable` 보존). 다이얼로그 중복 노출 0.

---

## 6. Phase 4 — 투영 불변식

1. **잔존 `type` 참조 제거 (착수 시점 1건)** — `isEditingSemanticsInstance` 의 `candidate.type === "ref"` disjunct (`adapters/canonical/editingSemantics.ts:47`). 2026-08-30 수리는 `canDetachInstance` 만 사영 불변 필드로 바꿨고 instance 축 술어는 그대로였다. 제거 순서: ⓐ `RefNode.ref: string` required 확인 완료 (`composition-document.types.ts:885`) → canonical 공간에서 잉여 ⓑ legacy `elementsMap` / mirror 경로에 `type:"ref"` + `ref` 부재 노드가 없음을 grep + `editingSemantics.test.ts` fixture 로 확인 ⓒ 확인 후 제거, 미확인이면 제거 대신 사유를 allowlist 에 등재.
2. 정적 게이트 `editingSemanticsProjection.static.test.ts`:
   - `editingSemantics.ts` 소스에서 `candidate.type` / `.type ===` 참조 0건 (allowlist 주석 필요 시 사유 명시).
   - 술어 4종(`isEditingSemanticsInstance` / `isEditingSemanticsOrigin` / `canDetachInstance` / `getEditingSemanticsOriginId`) 에 대해 **사영 3종 fixture** (canonical node · 캔버스 interactionNodesMap 파생 · legacy elementsMap) 로 같은 결과를 반환하는 표 테스트.
3. **사영이 4필드를 싣는지** 확인/수리 (R7) — `renderers/rendererInput.ts:476` · `skia/StoreRenderBridge.ts:242-281`. 그리고 `CanvasActionElement` 타입에 `ref?` / `reusable?` / `componentRole?` / `masterId?` 를 명시 (현재 구조적으로 통과할 뿐 타입에 없음 — 계약을 타입으로 고정).

---

## 7. Phase 5 — 정적 게이트 (표면 파생 동일성)

`componentSemanticsActions.static.test.ts`:

- 패널 · 메뉴 소스에 컴포넌트 액션 라벨 리터럴 0건 (레지스트리 경유만).
- `ACTION_BAR_ALLOWLIST.instance` 의 컴포넌트 축 항목 순서 == 레지스트리 순서.
- 레지스트리 id 중 **메뉴·바에 노출되는 것** (`surfaces` 에 `context-menu` 또는 `action-bar` 포함) 이 ADR-182 item id 계약 집합에 존재. 패널 전용 id (`select-instances` — 현행 182 집합에 없음, `actionBarPolicy.test.ts:229` 계약 7종에도 없음) 는 대상 밖 — 계약 집합에 넣으면 메뉴에 항목을 추가해야 해 HC5 (항목 집합 이관 전후 동일) 와 충돌한다.

---

## 8. 파일 변경 요약

| 파일                                                                     | 종류             |
| ------------------------------------------------------------------------ | ---------------- |
| `builder/config/componentSemanticsActions.ts`                            | 신규             |
| `builder/config/componentSemanticsActions.static.test.ts`                | 신규             |
| `adapters/canonical/__tests__/editingSemanticsProjection.static.test.ts` | 신규             |
| `builder/panels/properties/ComponentSemanticsSection.tsx`                | 수정             |
| `builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts`     | 수정             |
| `builder/components/overlay/actionBar/actionBarPolicy.ts`                | 수정             |
| `builder/utils/componentSemanticsRunner.ts`                              | 신규             |
| `builder/utils/componentSemanticsRunner.test.ts`                         | 신규             |
| `builder/panels/properties/CanvasSelectionShortcuts.tsx`                 | 수정             |
| `services/agent/agentCommands.ts`                                        | 수정             |
| `services/agent/agentCommands.test.ts`                                   | 수정 (게이트)    |
| `builder/hooks/useGlobalKeyboardShortcuts.ts`                            | 수정             |
| `builder/workspace/canvas/actions/canvasActions.ts`                      | 수정 (타입)      |
| `adapters/canonical/editingSemantics.ts`                                 | 수정 (주석/타입) |

신규 5 · 수정 10 (Phase 3 종료 시점 실측). 사용자 문서/프로젝트 파일 스키마 변경 0.

---

## 9. Phase별 Gate 매핑

| Phase | Gate      |
| ----- | --------- |
| 0     | G0        |
| 1     | G1        |
| 2     | G2 · G3-a |
| 3     | G2 · G5   |
| 4     | G3-b      |
| 5     | G3 · G4   |

---

## 10. 체크리스트

- [ ] Phase 0 inventory freeze 문서 작성 (`docs/adr/evidence/199-surface-inventory.md`)
- [ ] descriptor 타입 + 배열 (소비 0) — type-check 통과
- [ ] 패널 이관 + live 4상태 확인
- [ ] 메뉴 이관 + live 확인 (우클릭 4상태)
- [ ] 바 순서 파생 + `actionBarPolicy.test.ts` 갱신
- [x] 실행/확인 경로 통합 + 라벨 fallback 통일
- [ ] 잔존 `type` 참조 1건 제거 (안전성 ⓐⓑ 확인 후) + 투영 불변식 게이트 2종
- [ ] 표면 파생 동일성 게이트
- [ ] CHANGELOG (사용자-가시 변화 있을 때만 — 항목 집합이 동일하면 면제)
- [ ] `### Live Exercise` 절 작성 후 Implemented 승격
