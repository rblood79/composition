# ADR-140 구현 상세 — press-scale micro-interaction 도입

> 본 문서는 [ADR-140](../140-press-scale-micro-interaction.md)의 구현 상세 (Phase / 파일 변경표 / 체크리스트).
> 선행 분석: [docs/reference/audits/2026-05-17-rac-starter-style-update-check.md](../../reference/audits/2026-05-17-rac-starter-style-update-check.md) + [-design.md](../../reference/audits/2026-05-17-rac-starter-style-update-design.md)

## §1. 범위 + 설계 결정

### 범위

react-aria-starter의 `[data-pressed] { scale: 0.9~0.98 }` 촉각 눌림 피드백을 composition에 도입. 대상:

| sub-unit | 컴포넌트                  | scale            | 도입 경로                                                                     |
| -------- | ------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| C1-a     | Button, ToggleButton      | 0.95             | spec `states.pressed.scale`                                                   |
| C1-c     | Disclosure 헤더           | 0.97             | `DisclosureHeader.spec.ts states.pressed.scale`                               |
| C1-b     | Calendar/RangeCalendar 셀 | 0.9              | 수동 `CalendarCommon.css` (Calendar·RangeCalendar 공통 CalendarCell selector) |
| C1-b     | GridList 항목             | 0.98             | 수동 `GridList.css`                                                           |
| C1-b     | Tag                       | 0.96             | 수동 `TagGroup.css`                                                           |
| C1-b     | Tag remove-button         | 0.9              | 수동 `TagGroup.css`                                                           |
| C2       | Switch thumb              | `1.2 1` (비균일) | 수동 `Switch.css`                                                             |

범위 외 (starter audit 9개 gap 중 본 ADR이 직접 다루지 않는 항목과 그 사유):

- **ToggleButtonGroup** — starter는 `&[data-pressed] > span { scale: 0.9 }`로 group 내부 span에 적용하나, composition ToggleButtonGroup은 ToggleButton 자식으로 구성되며 각 ToggleButton이 C1-a(`states.pressed.scale`)로 press-scale을 이미 받는다 → group 단위 별도 작업 불요(C1-a로 transitively 커버).
- **Form 버튼** — starter audit의 'Form 버튼'은 Form 내 `<Button>`이며 composition Button이 C1-a로 press-scale을 받는다 → 별도 작업 불요(C1-a로 커버).
- **RangeCalendar 셀** — Calendar 셀과 동일 selector(`CalendarCommon.css`의 Calendar·RangeCalendar 공통 `.react-aria-CalendarCell`)를 공유하므로 C1-b 한 변경으로 함께 반영된다(별도 항목 아님).
- **C3**(Checkbox 체크마크 — 채택 기각), **C4**(Separator min-height), **C5**(Toast View Transitions). C3 dead CSS / Separator generated 상태 emit 정리는 composition 내부 작업으로 별도.

### 설계 결정 (확정 — 2026-05-17 사용자 확정 완료)

- **DD1 — 기존 inset-shadow 처리**: Button/ToggleButton `states.pressed`는 현재 `boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)"`(`Button.spec.ts:337-339` / `ToggleButton.spec.ts:146-148`). 선택지 (a) scale+boxShadow 병존 (b) scale 단독, boxShadow 제거.
  → **확정: (b) scale 단독, boxShadow 제거**. 근거: starter 디자인 언어 정합(starter는 press 피드백으로 scale만 사용), 병존 시 시각 과중. inset-shadow 제거는 사용자-가시 변경이므로 CHANGELOG Features 반영(ADR R3).
- **DD2 — C2 채택 범위**: Switch thumb 선택지 (a) press scale 신축만 (b) scale + selected thumb inner-shadow.
  → **확정: (a) press scale 신축만**. 근거: 단순, 토큰 무관, 작업 범위 최소. inner-shadow는 후순위 polish로 분리(본 ADR 범위 외).
- **DD3 — button archetype transition**: scale을 부드럽게 애니메이션하려면 button archetype 공통 transition(`CSSGenerator.ts:71,128`의 `transition: background 0.15s ease, border-color 0.15s ease`)에 `transform` 추가 필요. 미추가 시 press 시 즉시 점프(기능은 동작).
  → **확정: `transform 0.15s ease` 추가**. 근거: press 축소가 부드럽게 애니메이션. 영향 = button archetype 전체(Button/ToggleButton/Link 등 — transform 미사용 컴포넌트는 transition 항목 추가가 무해 no-op, ADR R2).

## §2. Phase

### Phase 0 — Inventory freeze + 설계 결정 확정

- ✅ DD1/DD2/DD3 사용자 확정 완료 (2026-05-17 — §1 참조).
- ✅ button archetype 공통 transition 정의 위치 확인 — `CSSGenerator.ts:71,128` 2곳.
- composition Disclosure 클릭 헤더가 `DisclosureHeader`임을 확인 (generated `DisclosureHeader.css`에 `[data-pressed]` emit 확인됨).
- 현 CSSGenerator snapshot test + `@composition/specs` 전체 test suite PASS baseline 기록.

### Phase 1 — C1-a leaf spec (Button, ToggleButton)

- `Button.spec.ts` / `ToggleButton.spec.ts`의 `states.pressed`에 `scale: 0.95` 추가 + 기존 `boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)"` 제거 (DD1=(b) 확정).
- button archetype 공통 transition(`CSSGenerator.ts:71,128`)에 `transform 0.15s ease` 추가 (DD3 확정).
- `pnpm build:specs` → generated `Button.css` / `ToggleButton.css`에 `[data-pressed] { transform: scale(0.95); }` 생성 + inset-shadow 미존재 확인.

### Phase 2 — C1-c DisclosureHeader spec

- `DisclosureHeader.spec.ts`의 `states: {}` → `states: { pressed: { scale: 0.97 } }`.
- `pnpm build:specs` → generated `DisclosureHeader.css` 확인.

### Phase 3 — C1-b 수동 CSS sub-element

- `CalendarCommon.css` — Calendar/RangeCalendar 공통 `.react-aria-CalendarCell` state selector에 `[data-pressed] { scale: 0.9 }` + base `transition`에 scale 추가. 공통 selector이므로 Calendar·RangeCalendar 셀 양쪽이 한 번에 반영된다.
- `GridList.css` `.react-aria-GridListItem` — 기존 `&[data-pressed]` 블록에 `scale: 0.98` + `transition-property`에 scale.
- `TagGroup.css` `.react-aria-Tag` — `&[data-pressed] { scale: 0.96 }` + transition. `.remove-button` — `&[data-pressed] { scale: 0.9 }`.

### Phase 4 — C2 Switch thumb

- `Switch.css` — `&[data-pressed] .indicator:before`에 비균일 `scale: 1.2 1` 적용 (DD2=(a) press scale 신축만 확정).
- inner-shadow polish는 본 ADR 범위 외 (DD2 (b) 미채택 — §5 후속).

### Phase 5 — 검증

- `pnpm build:specs` + `pnpm type-check`.
- CSSGenerator snapshot 갱신 — 의도된 diff(Button/ToggleButton/DisclosureHeader 3개 generated CSS의 `[data-pressed]` 변경분)만, 그 외 snapshot bit-identical. `@composition/specs` 전체 test suite 통과 확인.
- `/cross-check` — Button/ToggleButton/Calendar/GridList/Tag/Disclosure/Switch (Skia는 pressed 미렌더 → default 상태 무변경 확인 = 회귀 없음).
- Preview에서 각 컴포넌트 press 시 축소 육안.

## §3. 파일 변경표

| 파일                                                       | 변경                                                                 | Phase |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ----- |
| `packages/specs/src/components/Button.spec.ts`             | `states.pressed`에 `scale: 0.95` 추가 + `boxShadow` 제거 (DD1)       | 1     |
| `packages/specs/src/components/ToggleButton.spec.ts`       | `states.pressed`에 `scale: 0.95` 추가 + `boxShadow` 제거 (DD1)       | 1     |
| `packages/specs/src/components/DisclosureHeader.spec.ts`   | `states.pressed` 신규 (`scale: 0.97`)                                | 2     |
| `packages/specs/src/renderers/CSSGenerator.ts` (71·128)    | button archetype 공통 transition에 `transform 0.15s ease` 추가 (DD3) | 1     |
| `packages/shared/src/components/styles/CalendarCommon.css` | CalendarCell `[data-pressed]` scale (Calendar·RangeCalendar 공통)    | 3     |
| `packages/shared/src/components/styles/GridList.css`       | GridListItem `[data-pressed]` scale                                  | 3     |
| `packages/shared/src/components/styles/TagGroup.css`       | Tag + remove-button `[data-pressed]` scale                           | 3     |
| `packages/shared/src/components/styles/Switch.css`         | thumb `[data-pressed]` scale                                         | 4     |
| `packages/shared/src/components/styles/generated/*.css`    | `build:specs` 재생성 (Button/ToggleButton/DisclosureHeader)          | 1·2   |
| CSSGenerator snapshot 테스트 fixture                       | 의도 diff 반영                                                       | 5     |

## §4. 검증 체크리스트

- [x] DD1/DD2/DD3 사용자 확정 완료 (2026-05-17 — DD1=(b) scale 단독 / DD2=(a) press scale 신축만 / DD3=transform 추가).
- [ ] `pnpm build:specs` PASS — generated CSS에 `transform: scale()` emit 확인.
- [ ] `pnpm type-check` PASS.
- [ ] CSSGenerator snapshot — 의도된 3개 CSS diff 외 0.
- [ ] `/cross-check` — 7개 컴포넌트 default 상태 회귀 없음 (Skia 무변경).
- [ ] Preview에서 7개 컴포넌트 press 축소 육안 확인.
- [ ] CHANGELOG 반영 (사용자-가시 micro-interaction 신규 = Features 트리거).

## §5. 후속 (범위 외 — 본 ADR 미포함)

- C4 Separator 세로 min-height — 별도 단순 수정.
- C5 Toast View Transitions — 별도 모더나이제이션.
- Checkbox.css dead `stroke-dashoffset: 44` 제거 + generated Separator.css 비-인터랙티브 상태 emit 정리 — composition 내부 CSS 정리 단위.
- 수동 CSS(C1-b/C2)의 spec 화 — ADR-059(skipCSSGeneration 해체) 진행 시 함께 처리.
