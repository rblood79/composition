# ADR-199: 컴포넌트 시맨틱 액션 레지스트리 + 투영 불변식

## Status

Accepted — 2026-08-30 (리뷰 round 1 승인 — 이슈 4건 전부 `fixed`: [reviews/199.md](reviews/199.md))

## Context

컴포넌트 시맨틱 액션 4종 — 원본으로 이동 (`go-to-origin`) · 인스턴스 분리 (`detach-instance`) · 컴포넌트 만들기/분리 (`toggle-component-origin`) · 인스턴스 선택 (`select-instances`) — 은 **5개 표면**에 노출된다: Properties 패널 Component 섹션 · 캔버스 컨텍스트 메뉴 (ADR-182) · 선택 액션 바 (ADR-192) · 단축키 (ADR-195) · agent 명령 (ADR-196).

**도메인 선언**: 빌더 시스템 UI (builder-system layer) — 사용자 캔버스 컴포넌트의 D1/D2/D3 체인 밖이다 (ADR-163 과 같은 위상). catalog/spec/CSS Generator 확장 0 이므로 "Generator 가 자식 selector/variant emit 을 지원하는가" 질문은 **해당 없음**.

축별 SSOT 는 이미 하나씩 세워져 왔다 — 정의 (`SHORTCUT_DEFINITIONS` 72) · 표기 (`formatShortcut`) · 실행 (`commandRegistry`, ADR-195) · precondition (`COMMAND_META` 72, ADR-196) · 아이콘 (`ACTION_ICONS`). **비어 있는 축은 "표면 노출"** — 어떤 액션이 어느 표면에 어떤 라벨과 순서로 서는가다. 이 축만 표면마다 재작성된다 (2026-08-30 실측):

| 축               | 정의 지점 | 실측                                                                                                       |
| ---------------- | --------: | ---------------------------------------------------------------------------------------------------------- |
| 라벨             |         2 | 패널 영문 vs 메뉴 한/영 병기                                                                               |
| 순서             |         2 | 패널 JSX · `ACTION_BAR_ALLOWLIST`                                                                          |
| 가용성 호출 조건 |         3 | 패널 `isInstance`/`isOrigin` · 메뉴 `isComponentOrigin`/`detachableElement` · 바 `resolveActionBarContext` |
| 실행 + 확인      |         4 | `detachInstance` 호출 5곳 / `toggleComponentOrigin` 4곳 / detach 확인 다이얼로그 4곳이 각자 payload 조립   |

같은 날 이 구조에서 회귀 2건이 실측됐다:

1. **노출 축 누락** — 액션 바 인스턴스 컨텍스트에 `toggle-component-origin` 이 없고 순서도 패널과 달랐다 (`actionBarPolicy.ts:ACTION_BAR_ALLOWLIST`). allowlist 를 손으로 갱신해 수리 (`068d3b512`).
2. **술어 입력 사영 불일치** — `canDetachInstance` 가 `type === "ref"` 를 읽었는데, 캔버스 상호작용 map 은 Skia `interactionNodesMap` 파생 (`BuilderCanvas.tsx:769` — `interactiveElementsMapRef.current = skiaRendererInput.interactionNodesMap`) 이라 `type` 이 렌더 컴포넌트 (`"Button"`) 로 해소된다. 같은 함수 · 다른 입력 → **캔버스 표면에서만 "인스턴스 분리" 가 통째로 사라졌다**. 술어를 `ref`/`masterId` 기준으로 고쳐 수리 (같은 commit).

두 번째는 SSOT 부재가 아니라 **술어가 읽어도 되는 필드의 계약 부재**다 — 레지스트리를 만들어도 그대로 재발한다. 따라서 본 ADR 은 두 축을 함께 다룬다.

**Hard Constraints**:

1. **HC1** — 컴포넌트 시맨틱 액션의 라벨 · 가용성 · 순서 정의 지점 = **1** (현행 라벨 2 / 순서 2 / 가용성 3). 정적 게이트로 집행.
2. **HC2** — 기존 id 계약 불변: `ShortcutId` 72 · `COMMAND_META` 72 (`Readonly<Record<ShortcutId, CommandMeta>>` 이므로 항상 동수 — `commandMeta.static.test.ts` 가 단언) · ADR-182 context menu item id 18 (separator 제외, `align` 서브메뉴 자식 6 별도) · `ACTION_BAR_ALLOWLIST` 문자열. rename 0건. 수치는 2026-08-30 실측.
3. **HC3** — 편집 시맨틱 술어는 **사영 불변 필드만** 읽고, **사영은 그 필드를 반드시 싣는다** (2026-08-30 live 로 후자 결손 1건 확인 — R7) (`componentRole` / `ref` / `masterId` / `reusable`). 종료 상태 `type` 참조 0건 — grep 게이트로 집행. **착수 시점은 0 이 아니라 1건 잔존**: `isEditingSemanticsInstance` 가 `candidate.type === "ref"` 를 읽는다 (`adapters/canonical/editingSemantics.ts:47`). 즉 Phase 4 는 게이트 추가가 아니라 **술어 변경 + 게이트**다 — 제거 안전성은 `RefNode.ref: string` required (`packages/shared/src/types/composition-document.types.ts:885`) 로 canonical 공간에서는 잉여임이 확인되나, legacy `elementsMap` 에 `type:"ref"` 이면서 `ref` 문자열이 없는 노드가 없는지를 Phase 4 에서 확인한 뒤 제거한다.
4. **HC4** — 성능: 가용성 평가는 선택 변경 · 메뉴 오픈 시점 1회, Skia 프레임 경로 진입 0. 초기 번들 증가 ≤ **+2KB gz**.
5. **HC5** — 사용자 가시 회귀 0: 4개 상태 (Standard / Origin / Instance / Instance·Origin) × 3표면 (패널 · 메뉴 · 바) 에서 항목 집합 · 순서 · 라벨이 이관 전후 동일. live exercise 로 확인.
6. **HC6 (BC 수식화)** — 사용자 영향 **0%**: 프로젝트 파일 스키마 · 공개 API 변경 0. 내부 이관 범위는 **13 call site / 7 파일** (신규 3 포함 시 10 파일).

**Soft Constraints**:

- 5표면 동시 이관은 회귀 표면적이 넓다 → 컴포넌트 시맨틱 4액션 한정으로 시작하고, 나머지 명령군 (z-order · 정렬 · 그룹) 이관은 본 ADR scope 밖.
- 명령 팔레트 (ADR-195 소비자) 가 같은 축을 필요로 할 수 있으나 본 ADR 은 노출 축만 세우고 팔레트 편입은 후속 판단.

## Alternatives Considered

### 대안 A: 컴포넌트 시맨틱 전용 신규 레지스트리 모듈

- 설명: 4액션 한정 descriptor 배열을 새 모듈로 두고 패널 · 메뉴 · 바가 소비. 명령 축 (`COMMAND_META`) 과는 id 문자열로만 느슨히 연결.
- 근거: pencil 실측 (Pen.app 번들, 2026-08-30) — 가용성 9종을 한 곳에서 계산한 맵 + `manager.actions.*` 실행자를 properties 패널과 메뉴가 공유한다. 도메인 한정 레지스트리가 실제로 동작하는 형태.
- 위험:
  - 기술: LOW — 신규 모듈 1개, 기존 계약 무변경
  - 성능: LOW — 선택 시점 평가 4건
  - 유지보수: **MEDIUM** — 명령 축과 별개의 두 번째 레지스트리가 생겨 "새 액션을 어디에 넣나" 판단이 매번 필요. 액션군이 늘면 축이 갈린다
  - 마이그레이션: LOW — 소비처 3곳

### 대안 B: 기존 명령 축 SSOT 확장 (노출 축 추가)

- 설명: `COMMAND_META` 와 같은 계층에 **표면 노출 축** (label ko/en · icon · availability · surfaces · order) 을 두고, 컴포넌트 시맨틱 4액션부터 채운다. 나머지 68 엔트리는 optional 미지정으로 남는다. 표면은 렌더/필터만 한다.
- 근거: VS Code 의 `contributes.commands` (id/title/icon/enablement) + `contributes.menus` (where/when/group·order) 분리 — 정의 1곳, 표면 배치는 조건절. Chrome DevTools front-end 의 `UI.ActionRegistration` (actionId/title/category/condition/bindings → 툴바·메뉴가 파생). 프로젝트 선례로는 ADR-195 (실행 축) · ADR-196 (agent 표면 축) 이 같은 방식으로 축을 하나씩 세웠다.
- 위험:
  - 기술: LOW — 타입 확장 + optional 필드
  - 성능: LOW — 동일
  - 유지보수: LOW — 축이 하나로 유지되고, 새 표면은 축을 읽기만 한다
  - 마이그레이션: **MEDIUM** — 72 엔트리 타입이 넓어지고 4개만 채워진 비대칭 기간이 생긴다. agent allowlist (ADR-196) 계약과의 간섭 확인 필요

### 대안 C: 정적 게이트만 추가 (정의 중복 유지)

- 설명: 표면 간 "항목 집합 · 순서 동일" 을 정적 테스트로 고정하고 정의는 지금처럼 표면마다 둔다.
- 근거: 프로젝트 선례 `actionIcons.static.test.ts` · `panelTabs.static.test.ts` — 정본 없이 게이트로 발산만 차단한 패턴이 실제로 재발을 막아 왔다.
- 위험:
  - 기술: LOW — 테스트 1~2개
  - 성능: LOW — 런타임 변화 0
  - 유지보수: **HIGH** — 라벨 문자열 2계열 · 확인 payload 4곳이 영구 잔존. 게이트는 "같아야 한다" 만 강제할 뿐 새 표면이 생기면 정의를 또 쓴다. 오늘 회귀 (1) 은 막지만 라벨 fallback 발산 (R2) 은 못 막는다
  - 마이그레이션: LOW — 코드 변경 0

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | LOW  | LOW  | MED      | LOW          |     0      |
| B    | LOW  | LOW  | LOW      | MED          |     0      |
| C    | LOW  | LOW  | **HIGH** | LOW          |     1      |

루프 판정: A · B 가 HIGH 0 이므로 **추가 대안 불요** (루프 종료). C 만 HIGH 1 이며 그 위험이 본 ADR 이 없애려는 문제 자체이므로 기각.

## Decision

**대안 B (기존 명령 축 SSOT 확장) + HC3 투영 불변식**을 채택한다. C 의 정적 게이트는 B 의 **집행 수단**으로 흡수한다 (별도 대안이 아니라 Gates 로 편입).

선택 근거:

1. 잔존 위험 최대치가 MED (마이그레이션) 이고, 72 엔트리 중 4개만 채워지는 비대칭은 optional 필드 + 게이트로 관리 가능하다. 축이 하나로 유지되므로 나중에 z-order·정렬군을 편입할 때 새 판단이 필요 없다.
2. 축별 SSOT 를 하나씩 세워 온 프로젝트 선례 (ADR-195 실행 축 → ADR-196 agent 표면 축) 의 다음 축이며, 외부 레퍼런스 (VS Code · Chrome DevTools) 도 정의/배치 분리를 같은 형태로 쓴다.
3. 투영 불변식은 레지스트리와 **직교**하지만 같은 증상 ("같은 액션이 표면마다 다르게 보임") 의 나머지 절반이라 함께 확정해야 재발이 닫힌다.

기각 사유:

- **대안 A 기각**: 두 번째 레지스트리를 만들면 "새 액션을 명령 축에 넣나 시맨틱 축에 넣나" 판단이 영구 비용으로 남는다. 4액션 한정이라는 이점은 B 에서도 optional 필드로 동일하게 얻는다.
- **대안 C 기각**: 라벨 2계열 · 확인 payload 4곳이 그대로 남아 R2 계열 발산을 못 막는다. 유지보수 HIGH 가 본 ADR 의 목적과 정면 충돌.

> 구현 상세: [199-component-semantics-action-registry-breakdown.md](design/199-component-semantics-action-registry-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                         | 심각도 | 대응                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 표면 이관 중 항목 소실/중복 — 코드 경로 `builder/panels/properties/ComponentSemanticsSection.tsx` · `builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts` (컴포넌트 블록) · `builder/components/overlay/actionBar/actionBarPolicy.ts`                                                                                                                         |  HIGH  | G0 inventory freeze 기준선 + G2 live 4상태 × 3표면 대조. Phase 2 를 표면 1개씩 3단계로 분리해 각 단계 commit 가능 상태 유지                                                                                              |
| R2  | 확인 다이얼로그 payload 통합 시 라벨 fallback 변경 — `ComponentSemanticsSection.tsx:165` (origin 이름까지 되짚음) vs `canvasContextMenuProviders.ts:386` (안 되짚음) vs `CanvasSelectionShortcuts.tsx:132` vs `useGlobalKeyboardShortcuts.ts:256`                                                                                                                            |  MED   | 패널 규칙으로 통일하고 4곳 문구를 스냅샷 테스트로 고정                                                                                                                                                                   |
| R3  | `COMMAND_META` 72 엔트리 타입 확장이 ADR-196 agent allowlist 계약과 간섭                                                                                                                                                                                                                                                                                                     |  MED   | optional 필드로만 확장 + `commandMeta.static.test.ts` 기존 단언 무변경 확인 (G1)                                                                                                                                         |
| R4  | 투영 불변식 grep 게이트 위양성 — 정당하게 `type` 을 읽어야 하는 술어 (`hasEditingSlotMarker` 는 `type === "Slot"` 을 읽는다)                                                                                                                                                                                                                                                 |  MED   | 게이트 범위를 **인스턴스/원본 축 술어 4종**으로 한정하고 나머지는 allowlist 에 사유와 함께 등재                                                                                                                          |
| R5  | 초기 번들 증가                                                                                                                                                                                                                                                                                                                                                               |  LOW   | G4 에서 ≤ +2KB gz 측정 (HC4)                                                                                                                                                                                             |
| R7  | **사영이 시맨틱 필드를 싣지 않는다** — `ref` 노드의 캔버스 사영에서 인스턴스 자신의 `reusable` 이 사라져, Instance·Origin 노드의 우클릭 메뉴가 `컴포넌트 만들기` (no-op) 를 띄운다. 패널은 `Detach component` — 같은 노드, 반대 라벨 (2026-08-30 live 실측, `evidence/199-surface-inventory.md` §7 D7). 술어가 아니라 **입력을 만드는 쪽**의 결함이라 HC3 만으로는 안 닫힌다 |  HIGH  | Phase 4 로 흡수 — 사영 3종 fixture 게이트에 `reusable`/`ref`/`masterId`/`componentRole` 4필드 보존을 포함하고, `renderers/rendererInput.ts:476` · `skia/StoreRenderBridge.ts:242-281` 경로에서 누락 필드를 채운다 (G3-b) |
| R6  | 신규 표면 (명령 팔레트 등) 이 레지스트리를 우회하고 라벨을 다시 정의                                                                                                                                                                                                                                                                                                         |  MED   | G3 정적 게이트가 "패널·메뉴 소스에 컴포넌트 액션 라벨 리터럴 0건" 을 단언 — 새 표면도 같은 게이트에 걸린다                                                                                                               |

## Gates

| Gate   | 시점              | 통과 조건                                                                                                                                                                                                                                      | 실패 시 대안                                       |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **G0** | Phase 0 종료      | 4표면 × 4액션 inventory (항목·라벨·가용성·순서) 가 `docs/adr/evidence/199-surface-inventory.md` 에 파일/라인 인용과 함께 freeze                                                                                                                | 착수 보류 — 기준선 없이는 동일성 판정 불가         |
| **G1** | Phase 1 종료      | descriptor 타입/배열 추가 후 type-check 0, 기존 테스트 스위트 무변경 통과, `COMMAND_META` 기존 단언 무변경                                                                                                                                     | optional 필드 축소 또는 대안 A 로 후퇴 (전용 모듈) |
| **G2** | Phase 2·3 각 단계 | live: 4상태 (Standard/Origin/Instance/Instance·Origin) × 3표면에서 항목 집합·순서·라벨이 G0 기준선과 동일 (Chrome MCP 실측 캡처)                                                                                                               | 해당 표면 이관 revert, 단계 재분할                 |
| **G3** | Phase 4·5 종료    | 정적 게이트 2종 통과 — ⓐ 패널·메뉴 소스에 컴포넌트 액션 라벨 리터럴 0건 + 바 순서 == 레지스트리 순서 ⓑ 술어 4종의 `type` 참조 0건 + 사영 3종 fixture 동일 결과                                                                                 | 게이트 범위 축소 (ⓑ 를 술어 4종 한정) 후 재판정    |
| **G4** | Phase 5 종료      | 초기 번들 증가 ≤ +2KB gz — 대조군 = Phase 0 착수 commit 의 `pnpm build` (builder 앱, production, 같은 기기·같은 pnpm 버전) 초기 청크 gzip 합계, 측정은 before/after 각 1회 클린 빌드. 가용성 평가가 Skia 프레임 경로에 진입 0 (호출 스택 확인) | descriptor 를 lazy import 로 분리                  |
| **G5** | 종결 직전         | 기존 스위트 (`actionBarPolicy.test.ts` · `canvasContextMenuProviders.test.ts` · `ComponentSemanticsSection.test.tsx` · `editingSemantics.test.ts`) 전량 통과 + `pnpm type-check` 0                                                             | 미통과 항목 수리 후 재실행 — 부분 통과로 종결 금지 |

### Live Exercise

(Implemented 승격 시 기재 — 실제 builder 에서 exercise 한 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분. 미기재 시 Stop hook 이 승격을 block)

## Consequences

### Positive

- 컴포넌트 액션의 라벨·순서·가용성이 한 곳에서 바뀐다 — 오늘처럼 "패널에는 있는데 바에는 없다" 를 손으로 맞추는 작업이 사라진다.
- 술어의 입력 계약이 타입 + 게이트로 고정되어, 캔버스 사영 (Skia `interactionNodesMap` 파생) 과 canonical 사영이 갈리는 종류의 회귀가 닫힌다.
- 새 표면 (명령 팔레트 등) 이 생겨도 정의를 다시 쓰지 않고 축을 읽는다.

### Negative

- `COMMAND_META` 인접 타입이 넓어지고, 72 엔트리 중 4개만 노출 축을 채운 비대칭 기간이 생긴다 (나머지는 optional 미지정).
- 표면 3곳이 레지스트리에 의존하게 되어, 레지스트리 변경의 영향 반경이 넓어진다 (그 대가로 divergence 는 사라진다).
- 정적 게이트 2종이 늘어 CI 시간이 소폭 증가하고, 정당한 예외는 allowlist 등재 비용을 치른다.
