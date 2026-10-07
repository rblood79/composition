# ADR-255: Popover · Tooltip 원본을 trigger 조합으로 — DialogTrigger > Button + Popover · TooltipTrigger > Button + Tooltip

## Status

Implemented — 2026-10-07 (Accepted 같은 날 — 사용자 선택 「레퍼런스 구조로」: 범위 밖 발견 F7 수리 지시 「범위 밖으로 남긴 것 수정 시작해」 의 해결 방식 질문에 대한 답, 선택지에 「규모상 ADR 로 작성 후 진행」 이 포함돼 있었다. G1 · G2 · G3 통과 — [Live Exercise](#live-exercise))

## Context

### 목표

팔레트로 놓은 Popover · Tooltip 이 Preview 에 보이지 않는다 ([ADR-254](254-base-part-chain.md) F7). Canvas 는 열린 카드 · 상자를 그리는데 Preview 는 아무것도 그리지 않아 두 소비자의 결과가 다르다 (D3 대칭 위반). 사용자가 고른 해결: 레퍼런스 구조 — 원본이 trigger 와 overlay 의 조합이다.

### 사실 (2026-10-07 실측 · main `eef51e79f`)

경로 약어: `S/` = `packages/shared/src/` · `L` = `S/catalog/document/generated/reusableOriginLibrary.ts` · `X/` = `S/catalog/runtime/`

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                              | 근거                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F1  | Popover 원본의 루트는 `type-Popover`, Tooltip 원본의 루트는 `type-Tooltip` 이다 — trigger 가 없다. Dialog 원본은 `DialogTrigger > Button + Dialog` 다                                                                                                                                                                                                                                                             | `L` `component-popover` · `component-tooltip` · `component-dialog`                                        |
| F2  | RAC overlay 는 trigger 의 상태 context 가 없으면 자기 상태 (기본 닫힘) 로 그린다 — 열리지 않으므로 DOM 0. RAC Tooltip 은 standalone 이면 `triggerRef` 가 필요하다                                                                                                                                                                                                                                                 | react-aria-components 1.21.0 `dist/private/Popover.mjs` · `Tooltip.mjs` · `dist/types/src/Tooltip.d.ts`   |
| F3  | **DialogTrigger 안의 Popover 는 Preview 에서 열린다** — 문서 `DialogTrigger > Button + Popover` 를 DOM 으로 마운트하고 버튼을 누르면 Popover 와 그 제목이 나타난다 (프로브). ADR-254 F7 의 「DialogTrigger 안에서도 DOM 0」 은 DOM 집계 함수 (`catalogDomRendersNode`) 를 렌더로 잘못 읽은 것이다                                                                                                                 | 2026-10-07 임시 프로브 (react-dom client + act, `aria-expanded=true` · `.react-aria-Popover` 생김)        |
| F4  | 레퍼런스: Popover = `DialogTrigger > Button + Popover`, Tooltip = `TooltipTrigger > Button + Tooltip`                                                                                                                                                                                                                                                                                                             | react-aria.adobe.com `Popover.md` · `Tooltip.md` (2026-10-07 curl)                                        |
| F5  | TooltipTrigger 는 catalog 에 없다 (type · binding · rule · shared 컴포넌트 · DOM registry 0). DialogTrigger 는 전부 있다 — catalog entry (`placeable: false`) · binding (`isOpen` · `defaultOpen`) · rule (`container` · flex column · fit-content) · shared `DialogTrigger.tsx` (`div.react-aria-DialogTrigger` 래퍼) · `domRegistry` · presence (`TRIGGER_OVERLAY_CHILDREN` — Canvas 는 닫힌 overlay 를 숨긴다) | `S/catalog/componentCatalog.ts:1035` · `S/catalog/bindings/DialogTrigger.binding.ts` · `X/presence.ts:27` |
| F6  | RAC TooltipTrigger 는 DOM 요소를 내지 않는다 — 상태 context 와 `FocusableProvider` (trigger 에 hover · focus props 와 ref) 만 준다. 자식 사이에 래퍼 요소가 있어도 Button 이 context 로 받는다                                                                                                                                                                                                                    | `dist/private/Tooltip.mjs` `TooltipTrigger`                                                               |
| F7  | `LIBRARY_CONTRACT_VERSION` 은 6 (ADR-254)                                                                                                                                                                                                                                                                                                                                                                         | `S/catalog/document/types.ts`                                                                             |

### Domain (SSOT 3-domain)

- **D1**: RAC 가 정한 구조 그대로 — DialogTrigger · TooltipTrigger 가 trigger 와 overlay 를 잇고, 열림 · 위치 · 닫기 · 포커스는 RAC 소유. composition 은 DialogTrigger 와 같은 방식으로 TooltipTrigger 에 레이아웃 래퍼 (`div.react-aria-TooltipTrigger`, role 없음) 를 둔다 — Canvas 와 DOM 이 같은 상자를 갖게 (DialogTrigger 선례).
- **D2**: TooltipTrigger 의 prop 은 RAC/RSP 의 것만 — `isOpen` · `defaultOpen` · `delay` · `closeDelay` · `trigger` · `isDisabled`. 새 custom prop 0.
- **D3**: TooltipTrigger rule 은 DialogTrigger rule 과 같은 컨테이너 (flex column · fit-content). 닫힌 overlay 는 Canvas 도 그리지 않는다 (presence) — 두 소비자 모두 trigger 버튼만 보인다.

### 제약

- hard — 저장 포맷: 두 원본의 template 구조가 바뀐다 → `LIBRARY_CONTRACT_VERSION` 6 → 7, 앞 버전 문서 거부 (변환 0, 보존 대상 0 — ADR-253 · 254 와 같은 전제).
- hard — 번들: initial 상한 Builder ≤ 1,421,000 · Preview ≤ 623,000. `apps/publish` 수정 0.
- soft — ADR-254 의 결과 유지: Popover 제목 · 설명과 Tooltip 설명은 Heading · Description 원본의 instance 그대로 (자리 id 유지).

## Alternatives Considered

### 대안 A: 레퍼런스 구조 — 원본 = trigger 조합 (사용자 선택)

- 설명: Popover 원본 = `DialogTrigger` > Button 원본 instance (「Open Popover」) + `Popover` (기존 size · 폭 240) > 제목 · 설명. Tooltip 원본 = `TooltipTrigger` (새 type) > Button 원본 instance (「Hover me」) + `Tooltip` > 설명. Canvas 는 버튼만 (Dialog 원본과 같다), Preview 는 버튼을 누르거나 (Popover) 올리면 (Tooltip) 연다.
- 위험: 기술 **L** (DialogTrigger 등록을 그대로 본뜬다) / 성능 **L** / 유지보수 **L** / 마이그레이션 **M** (contract 7 · 팔레트 Popover · Tooltip 의 Canvas 모양이 카드 → 버튼)

### 대안 B: trigger 없는 overlay 를 Preview 에도 열린 채로

- 설명: 구조는 두고 standalone Popover · Tooltip 을 Preview 에서 고정 위치로 열어 둔다.
- 위험: 기술 **H** (RAC overlay 는 trigger 없이 위치를 잡지 못한다 — Tooltip 은 `triggerRef` 필수, D1 밖의 표시) / 유지보수 M

### 대안 C: 기록만

- 위험: 유지보수 **H** (두 소비자 결과가 계속 다르다)

### Risk Threshold Check

| 대안 | HIGH+      | 판정          |
| ---- | ---------- | ------------- |
| A    | 없음       | 선택 (사용자) |
| B    | 기술 H     | 기각          |
| C    | 유지보수 H | 기각          |

## Decision

**대안 A.**

1. **TooltipTrigger 등록**: catalog entry (`overlays`, `placeable: false` — DialogTrigger 와 같다) · binding (`internal` renderer `tooltiptrigger`, accepts = D2 의 6) · rule (DialogTrigger rule 과 같은 컨테이너) · 생성 CSS · shared `TooltipTrigger.tsx` (RAC `TooltipTrigger` 안에 `div.react-aria-TooltipTrigger`) · `domRegistry` · presence `TRIGGER_OVERLAY_CHILDREN.TooltipTrigger = {Tooltip}` · vocabulary type.
2. **Popover 원본**: 루트 `type-DialogTrigger` > `component-popover__trigger` (Button 원본 instance, 「Open Popover」) + `component-popover__overlay` (`type-Popover`, size md · 폭 240) > `component-popover__1` · `__2` (ADR-254 의 자리 그대로).
3. **Tooltip 원본**: 루트 `type-TooltipTrigger` > `component-tooltip__trigger` (Button 원본 instance, 「Hover me」) + `component-tooltip__overlay` (`type-Tooltip`) > `component-tooltip__1` (ADR-254 의 자리 그대로).
4. `LIBRARY_CONTRACT_VERSION` 7.
5. 범위 밖: 닫힌 overlay 를 Canvas 에서 편집하는 방법 (Layers 선택으로 한다 — Dialog 와 같다).

> 구현 상세: [255-overlay-origins-with-trigger-breakdown.md](../design/255-overlay-origins-with-trigger-breakdown.md)

## Risks

| ID  | 위험                                                                      | 심각도 | 대응                                                                                                |
| --- | ------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------- |
| R1  | 팔레트 Popover · Tooltip 의 Canvas 모양이 카드 → 버튼으로 바뀐다 (의도)   |  LOW   | 사용자 선택 (미리보기로 보인 변화). 시각 하니스 승인 기록에 적는다                                  |
| R2  | 래퍼 div 가 TooltipTrigger 의 `FocusableProvider` 와 Button 사이에 놓인다 |  LOW   | context 전달이라 영향 없음 (F6) — Preview 에서 hover · focus 로 열리는지 실제 마운트 · live 로 확인 |
| R3  | Popover · Tooltip 의 기존 테스트 · oracle 이 루트 type 을 전제한다        |  LOW   | 경로를 새 구조로 고친다. ADR-254 oracle 의 Popover · Tooltip 자리 경로 갱신                         |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                       | 실패 시 대안 |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| G1   | 구현 끝 | unit: 두 원본의 구조 · Canvas 는 overlay 숨김 · DOM 은 버튼만 · 실제 마운트에서 버튼 press → Popover (제목 · 설명), hover/focus → Tooltip · 원본 편집 (Heading · Description) 이 열린 overlay 에 닿음. 원복 RED | 원인 수리    |
| G2   | 구현 끝 | live (Compare Mode): 팔레트 Popover · Tooltip 이 Canvas · Preview 모두 버튼, Preview 에서 열면 내용이 보임                                                                                                      | 원인 수리    |
| G3   | 구현 끝 | shared · builder · rendering · publish 스위트 · type-check · 시각 하니스 (변화는 승인 기록으로) · ratchet · initial 번들 상한 안                                                                                | 초과분 보고  |

### Live Exercise

실제 Builder (main 빌드 `localhost:5173` · headed Chrome · Compare Mode) 에서 Playwright 로 실행했다 — 실행자의 직접 확인 (`apps/builder/scripts/adr255-overlay-trigger-live.mjs`). Preview 의 trigger 는 Compare Mode 덮개가 포인터를 받아 키보드로 눌렀다 (RAC 의 press · focus 경로).

| 날짜       | 시나리오                                                                                                      | 결과                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-07 | 팔레트로 Popover · Tooltip 을 놓음                                                                            | Canvas: `DialogTrigger` > Button + Popover (숨김) · `TooltipTrigger` > Button + Tooltip (숨김). Preview: 버튼 「Open Popover」 · 「Hover me」 만, 열린 overlay 없음      |
| 2026-10-07 | Preview 에서 「Open Popover」 를 누름 → Escape · 「Hover me」 로 키보드 focus 이동 (Tab)                      | Popover 가 버튼 아래에 열림 (제목 「Popover Title」 · 설명), Escape 로 닫힘 · Tooltip 이 열림 (「Tooltip text」)                                                         |
| 2026-10-07 | 놓은 Popover 의 `placement` = `right` (Popover 의 Properties prop — 원본이 받아 overlay 에 바인딩) 뒤 다시 엶 | Popover 가 버튼 오른쪽 (`data-placement=right`, left 130 ≥ 버튼 right 114). `top` 은 버튼이 frame 맨 위라 RAC 가 아래로 뒤집는다 (`shouldFlip`) — 그래서 `right` 로 확인 |

4/4 PASS, 콘솔 오류 0.

## Consequences

### Positive

- 팔레트 Popover · Tooltip 이 Preview 에서 실제로 동작한다 (레퍼런스와 같은 구조). Canvas 와 Preview 가 같은 것을 보인다.
- TooltipTrigger 가 catalog 에 생겨 사용자가 다른 trigger (Link 등) 와 Tooltip 을 조합할 수 있다.

### Negative

- contract 7 — 앞 버전 문서 거부.
- 놓은 Popover · Tooltip 의 내용은 Canvas 에 보이지 않는다 (Dialog 와 같다 — Layers 로 선택).
