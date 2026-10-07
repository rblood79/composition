# ADR-255 breakdown — Popover · Tooltip 원본을 trigger 조합으로

> 본문: [ADR-255](../completed/255-overlay-origins-with-trigger.md) (Accepted → Implemented 2026-10-07). 경로 약어는 본문과 같다.

## 1. 전제 기록

1. **base / 응용**: ADR-254 (컨테이너 제목 · 설명 = 부품 원본 instance) 위의 응용 — 그 자리 (`component-popover__1` · `__2` · `component-tooltip__1`) 를 그대로 두고 루트만 trigger 조합으로 감싼다. 의존 방향 반전 없음.
2. **schema 직교성**: 문서 schema 변경 0. library 내용 (두 원본 template · 새 type 하나) 과 contract (6 → 7).
3. **선행 전제 reverse 검증**: ADR-254 F7 의 「DialogTrigger 안에서도 DOM 0」 은 틀렸다 (본문 F3 — 프로브). 이 ADR 은 그 정정 위에 선다.
4. **사용자 confirm**: 2026-10-07 AskUserQuestion — 「레퍼런스 구조로 (Recommended)」 선택 (선택지에 「ADR 로 작성 후 진행」 명시).

## 2. 작업

### 2-1. TooltipTrigger type (DialogTrigger 등록을 본뜬다)

| 층            | 파일                                                                                                   | 내용                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| vocabulary    | `S/types/composition-vocabulary.ts`                                                                    | type 이름                                                                                                                     |
| catalog entry | `S/catalog/componentCatalog.ts`                                                                        | `primitiveEntry("TooltipTrigger", "overlays", …, { placeable: false })`                                                       |
| binding       | `S/catalog/bindings/TooltipTrigger.binding.ts` · `index.ts`                                            | `internal` · renderer `tooltiptrigger` · accepts `isOpen` · `defaultOpen` · `delay` · `closeDelay` · `trigger` · `isDisabled` |
| rule          | `S/catalog/generated/componentRulesTable.ts`                                                           | DialogTrigger rule 과 같은 컨테이너 (flex column · fit-content · gap 12)                                                      |
| CSS           | `generate:css` → `generated/TooltipTrigger.css` · `styles/index.css` · `builder-components.css` import | DialogTrigger 와 같은 자리                                                                                                    |
| shared        | `S/components/TooltipTrigger.tsx` · `components/index.ts`                                              | RAC `TooltipTrigger` 안에 `div.react-aria-TooltipTrigger` (DialogTrigger.tsx 와 같은 래퍼)                                    |
| DOM registry  | `X/domRegistry.tsx`                                                                                    | `tooltiptrigger`                                                                                                              |
| presence      | `X/presence.ts`                                                                                        | `TRIGGER_OVERLAY_CHILDREN.TooltipTrigger = {Tooltip}` — Canvas 는 닫힌 Tooltip 을 그리지 않는다                               |

### 2-2. 원본 template (`L`)

- Popover: `component-popover` (`type-DialogTrigger`) > `component-popover__trigger` (Button 원본, 「Open Popover」) + `component-popover__overlay` (`type-Popover`, size md · 폭 240) > `__1` · `__2`.
- Tooltip: `component-tooltip` (`type-TooltipTrigger`) > `component-tooltip__trigger` (Button 원본, 「Hover me」) + `component-tooltip__overlay` (`type-Tooltip`) > `__1`.
- `LIBRARY_CONTRACT_VERSION` 7.

### 2-3. 검증

- unit `adr255OverlayTrigger.test.ts`: 구조 · Canvas record 의 overlay 숨김 · DOM 은 trigger 버튼만 · 실제 마운트 → 버튼 press → Popover (제목 · 설명) · Tooltip 은 focus 로 열림 · 원본 편집 (Heading · Description) 이 열린 overlay 에 닿음. 원복 RED.
- ADR-254 oracle (`adr254ContainerParts`) 의 Popover · Tooltip 자리 경로 갱신 (overlay 아래로 한 단계).
- 시각 하니스 (Popover · Tooltip 은 카드 → 버튼 — 승인 기록) · 스위트 · type-check · ratchet · 번들.
- live `adr255-overlay-trigger-live.mjs` (Compare Mode): 팔레트 Popover · Tooltip → 양쪽 버튼 · Preview 에서 열면 내용.

## 3. 실행 기록

### 2026-10-07 — 구현 · 검증 (main `eef51e79f` 위)

- 2-1 · 2-2 그대로. 더해진 것 두 가지:
  - **놓은 overlay 의 편집 surface**: instance 의 type 이 trigger 라 Properties 가 `isOpen` · `defaultOpen` 만 보였다 (AI 로컬 제안 테스트가 Popover · Tooltip 의 `placement` 편집 불가로 잡았다). 원본이 overlay 의 prop (Popover: size · hideArrow · placement · offset · crossOffset · shouldFlip · containerPadding / Tooltip: variant · size · 같은 위치 5) 을 받고 기본값을 RAC 와 같게 두어 overlay 노드에 `{placement}` 식으로 바인딩한다. 편집 계약은 `reusablePropsSchemas.ts` `POPOVER_PROPS_SCHEMA` · `TOOLTIP_PROPS_SCHEMA` (각 type 의 binding 계약 + trigger 의 계약, size · variant 의 선택지는 overlay rule 단계).
  - **라이브러리 검증기** (`S/catalog/document/library.ts`): template prop 값이 그 template 을 펼치는 원본의 같은 타입 prop 바인딩 하나 (`"offset": "{offset}"`) 면 받는다 — 값은 원본 기본값 · instance 값으로 들어오고 원본 계약이 검사한다 (원본 기본값은 자리의 선택지 안이어야 한다). 이전에는 문자열 바인딩만 쓰였다.
- 공용 `components/index.ts` 는 RAC 의 `TooltipTrigger` 를 이미 export 하고 있어 (Builder UI 가 쓰는 이름) 새 shared 컴포넌트는 export 하지 않고 DOM registry 만 파일 경로로 쓴다.
- unit `adr255OverlayTrigger.test.ts` 7: 두 원본 구조 · Canvas 의 overlay 숨김 · DOM 은 trigger 만 · 실제 마운트에서 press → Popover (제목 · 설명) · 키보드 focus → Tooltip (`aria-describedby` 연결 · Description 원본 색) · 편집 계약 · `placement` · `size` 가 overlay 에 닿음. **원복 RED** 3행: library → 5/5 RED · presence → 1 · domRegistry → 1.
- 갱신: ADR-254 oracle 의 Popover · Tooltip 자리 경로 (overlay 아래 한 단계) · census type 수 137 · 생성 CSS 인벤토리 (생성 102 · index 78) · rendering byte-identical 99 · contract 표기 39곳.
- 회귀: shared 1,387 · builder 4,531 (실패 0) · rendering 1,379 · publish 11 · type-check 통과.
- 시각 하니스 69/70 — Popover · Tooltip 의 카드 → 버튼을 승인 기록 `overlay-origin-trigger-composition` · `overlay-origin-closed-overlay` 로. 남은 CardView 는 전환 전부터.
- 번들 (production, ADR-254 빌드 대비): initial JS gzip Builder +902 (1,230,374) · Preview +167 (287,113) — 상한 안.
- live 4/4 (`adr255-overlay-trigger-live.mjs`) — 본문 Live Exercise.
