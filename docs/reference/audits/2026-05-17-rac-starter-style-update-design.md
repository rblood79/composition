# react-aria-starter 유래 스타일 업데이트 — 도입 설계 단위

> 작성: 2026-05-17 · 선행 문서: [2026-05-17-rac-starter-style-update-check.md](./2026-05-17-rac-starter-style-update-check.md)
> 목적: 체크 단계에서 식별한 후보 C1~C5를 구체적 도입 설계 단위로 분해. 코드 수정은 미수행 — 설계까지.
> 기준: composition 자체 Spec D3 SSOT 유지. starter는 시각 참조이지 상위 권위가 아님.

## 설계를 결정하는 두 가지 아키텍처 사실

1. **`StateEffect.scale` + CSSGenerator emit 이미 존재**
   `packages/specs/src/types/state.types.ts`의 `StateEffect`에 `scale?: number` / `transform?: string` 필드가 있고, `CSSGenerator.ts:1033-1034`(pressed) / `:981-982`(hover)가 `transform: scale(${scale})`를 이미 emit한다. press-scale 도입에 **신규 spec capability·generator 변경 불필요** — spec의 `states.pressed.scale` 값만 설정하면 된다.

2. **Skia `componentState`는 "default" | "disabled"만**
   `buildSpecNodeData.ts:1000-1014` + `:1080` 주석("현재 componentState는 'default' | 'disabled'만 가능"). Builder Skia는 hover/pressed를 **렌더하지 않는다**. press-scale은 순전히 Preview/Publish의 실제 CSS 인터랙션 사안 → **Skia consumer 작업 0건**. ssot-hierarchy.md 시각 대칭 관점: Skia가 pressed를 안 그리므로 비대칭 자체가 발생하지 않는다.

→ 결론: C1(press-scale)은 generated CSS / 수동 CSS 측 변경만으로 완결. Skia·spec 타입·generator 코드 변경 없음.

## 설계 단위 요약

| 단위 | 대상                                                      | 변경 위치                         | 분류                                           | 작업량    |
| ---- | --------------------------------------------------------- | --------------------------------- | ---------------------------------------------- | --------- |
| C1-a | Button·ToggleButton press-scale                           | spec `states.pressed.scale`       | 즉시 적용 가능                                 | 매우 작음 |
| C1-b | Calendar cell·GridList item·Tag·remove-button press-scale | 수동 CSS                          | 즉시 적용 가능                                 | 작음      |
| C1-c | Disclosure 헤더 press-scale                               | `DisclosureHeader.spec.ts states` | 즉시 적용 가능                                 | 매우 작음 |
| C2   | Switch thumb press 신축 + selected inner-shadow           | 수동 `Switch.css`                 | 설계 결정(범위) 필요                           | 작음      |
| C3   | Checkbox 체크마크 stroke                                  | —                                 | **채택 기각** (의도적 분기) + dead CSS cleanup | 매우 작음 |
| C4   | Separator 세로 min-height                                 | 수동 `Separator.css`              | 즉시 적용 가능                                 | 매우 작음 |
| C5   | Toast View Transitions 모더나이제이션                     | 수동 `Toast.css`                  | 선택 (낮음)                                    | 중간      |

---

## C1 — Press-scale micro-interaction

starter는 `[data-pressed]` 시 요소를 `scale: 0.9~0.98`로 축소하는 촉각 눌림 피드백을 일관된 디자인 언어로 적용한다. composition은 전무. 도입 시 3개 sub-unit으로 분해.

### C1-a — leaf spec (Button, ToggleButton)

- **현재**: `Button.spec.ts` / `ToggleButton.spec.ts`의 `states.pressed = { boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)" }`
- **starter 참조**: `Button.css` / `ToggleButton.css` — `&[data-pressed] { scale: 0.95 }`
- **변경 위치**: `packages/specs/src/components/Button.spec.ts`, `ToggleButton.spec.ts` — `states.pressed`
- **변경 내용**:
  ```ts
  pressed: {
    scale: 0.95,
    // boxShadow 처리는 아래 설계 결정 참조
  }
  ```
  CSSGenerator가 자동으로 `[data-pressed] { transform: scale(0.95); }` emit. **generator 코드 변경 0**.
- **설계 결정 1 — 기존 inset boxShadow 처리**: composition은 현재 inset-shadow로 눌림 피드백을 표현한다. starter는 scale-only. 선택지 (a) scale + boxShadow 병존 (b) scale 단독, boxShadow 제거. **권장 (b)** — 병존 시 시각 과중, starter 디자인 언어 정합. 단 사용자-가시 변경이므로 명시 확인.
- **설계 결정 2 — transition**: button archetype base의 transition은 `background 0.15s ease, border-color 0.15s ease` — `transform` 미포함. scale을 부드럽게 애니메이션하려면 transition에 `transform` 추가 필요. 미추가 시 press 시 즉시 점프(애니메이션 없음 — 기능은 동작). 처리: button archetype base transition 문자열에 `transform 0.15s ease` 추가 (`cssEmitMode: "button-base"` 경로). 영향 범위 = button archetype 전체(Button/ToggleButton/Link).
- **D3 대칭**: CSS consumer(Preview/Publish)만 수혜. Skia consumer는 pressed 미렌더 → 작업 0.
- **위험**: LOW. button archetype 전체에 transition 변경이 파급 — Link 등 다른 button archetype 컴포넌트의 transition도 바뀜(transform 미사용이면 무해).
- **검증**: `pnpm build:specs` → CSSGenerator snapshot 갱신(`@composition/specs` 326 test). Preview에서 Button press 시 축소 육안.

### C1-b — 수동 CSS sub-element (Calendar cell, GridList item, Tag, remove-button)

starter의 press-scale이 root가 아닌 sub-element(셀/항목/태그)에 적용된 경우. composition은 해당 컴포넌트가 skipCSSGeneration + 수동 CSS이므로 수동 CSS를 편집.

| sub-element       | starter                                                                 | composition 변경 위치                                                                         | 변경                                                         |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Calendar 셀       | `CalendarCell[data-pressed] { scale: 0.9 }` + `transition: scale 200ms` | 수동 `Calendar.css` `.react-aria-CalendarCell`                                                | `&[data-pressed] { scale: 0.9 }` + base `transition`에 scale |
| GridList 항목     | `GridListItem[data-pressed] { scale: 0.98 }`                            | 수동 `GridList.css` `.react-aria-GridListItem` (기존 `&[data-pressed]` 블록 line 62/141 존재) | 해당 블록에 `scale: 0.98`                                    |
| Tag               | `Tag[data-pressed] { scale: 0.96 }`                                     | 수동 `TagGroup.css` `.react-aria-Tag`                                                         | `&[data-pressed] { scale: 0.96 }` + transition               |
| Tag remove-button | `.remove-button[data-pressed] { scale: 0.9 }`                           | 수동 `TagGroup.css` `.remove-button`                                                          | `&[data-pressed] { scale: 0.9 }`                             |

- **D3 대칭**: 수동 CSS는 Preview/Publish DOM만 소비. Skia는 별도 spec shapes로 셀/항목 렌더 — pressed 미렌더 → 작업 0.
- **위험**: LOW. 단 ssot-hierarchy.md 관점 — 수동 CSS는 skipCSSGeneration 잔존 영역(ADR-059 해체 대상). press-scale을 수동 CSS에 추가하는 것은 기존 수동 CSS 일관성에는 부합하나, 장기적으로는 spec 파생이 정답. 현 시점 수동 CSS 추가 수용.
- **검증**: Preview에서 셀/항목/태그 press 시 축소 육안.

### C1-c — Disclosure 헤더

- **현재**: `DisclosureHeader.spec.ts:85` — `states: {}`. generated `DisclosureHeader.css`는 archetype 기본 emit으로 `[data-pressed] { background: transparent }`만 보유.
- **starter 참조**: `Disclosure.css` — `.disclosure-button[data-pressed] { scale: 0.97 }`
- **변경 위치**: `packages/specs/src/components/DisclosureHeader.spec.ts` — `states` (현재 빈 객체)
- **변경 내용**:
  ```ts
  states: {
    pressed: { scale: 0.97 },
  }
  ```
  CSSGenerator가 `[data-pressed] { transform: scale(0.97); }` emit.
- **확인 사항**: composition Disclosure의 클릭 가능한 헤더가 `DisclosureHeader`인지 — generated `DisclosureHeader.css`에 이미 `[data-pressed]`가 emit되므로 헤더가 인터랙티브 요소임이 확인됨. 헤더 외 별도 button sub-element가 있으면 그쪽으로 조정.
- **D3 대칭 / 위험 / 검증**: C1-a와 동일.

---

## C2 — Switch thumb press 신축 + selected inner-shadow

- **현재**: 수동 `Switch.css` — thumb는 `.indicator:before` 의사요소. press 변형 없음, selected 시 평면.
- **starter 참조**: `Switch.css`
  - `&[data-pressed] .handle { scale: 1.2 1; border-radius: var(--height) / calc(var(--height) * 1.2); }` — thumb 가로 신축
  - `&[data-selected] .handle { box-shadow: inset 0 0 0 1px ..., inset 0 -4px 4px oklch(from var(--tint) 85% c h / .3); }` — thumb 하단 inner-shadow
- **변경 위치**: 수동 `packages/shared/src/components/styles/Switch.css` — `.indicator:before`
- **변경 내용**:
  ```css
  &[data-pressed] .indicator:before {
    scale: 1.2 1; /* 비균일 — StateEffect.scale(number) 불가, 수동 CSS 필수 */
    border-radius: ...; /* 신축에 맞춘 비대칭 radius */
  }
  ```
- **설계 결정 — 채택 범위**: (a) scale 신축만 (b) scale + selected inner-shadow 전부. starter의 inner-shadow는 `oklch(from var(--tint) ...)` 의존 — composition 토큰 체계로 환산 필요. **권장 (a)** — scale 신축만 (단순, 토큰 무관). inner-shadow는 시각 polish로 후순위 분리.
- **D3 대칭**: 수동 Switch.css = Preview/Publish DOM. Skia Switch thumb는 spec shapes 렌더 — pressed 미발생 → 작업 0.
- **위험**: LOW. 비균일 scale은 `StateEffect.scale`(number 균일)로 표현 불가 → C1처럼 spec 경유 불가, 수동 CSS 전용. spec capability 확장(`transform` string 사용)도 가능하나 Switch 단일 사례라 수동 CSS가 비용 효율적.
- **검증**: Preview에서 Switch press 시 thumb 가로 신축 육안.

---

## C3 — Checkbox 체크마크 stroke — 채택 기각 (의도적 분기)

- **검증 결과**: composition `Checkbox.tsx:83-91`은 체크마크를 **Lucide `<CheckIcon size={16} strokeWidth={4}>`(선택 시) / `<Minus strokeWidth={4}>`(indeterminate 시)** 로 조건부 렌더한다. Lucide 아이콘은 `stroke-linecap/linejoin: round`를 기본 내장, `strokeWidth`도 prop으로 설정됨.
- **판정**: starter의 체크마크는 항상 존재하는 `<svg>` + `stroke-dasharray`/`stroke-dashoffset` draw-on 애니메이션. composition은 조건부 mount되는 Lucide 아이콘 — **의도적으로 다른 설계**. starter 방식 도입은 "업데이트 수용"이 아니라 체크마크 렌더 방식 전면 재설계 → **채택 기각**.
- **부수 cleanup (starter 무관, composition 내부)**: `Checkbox.css`의 `&[data-selected] svg { stroke-dashoffset: 44 }`는 `stroke-dasharray` 부재 + 조건부 mount 아이콘 탓에 **시각 효과 없는 dead CSS**. 제거 권장 — composition 내부 정리 단위(본 starter 도입과 별개).

---

## C4 — Separator 세로 방향 min-height

- **현재**: 수동 `Separator.css` — `.vertical` / `[aria-orientation='vertical']`는 `width: 1px/2px`만, min-height 없음 → flex 컨테이너에서 0으로 collapse 가능.
- **starter 참조**: `Separator.css` — `&[aria-orientation="vertical"] { min-height: 32px }`
- **변경 위치**: 수동 `packages/shared/src/components/styles/Separator.css` — vertical 규칙
- **변경 내용**: vertical 규칙에 `min-height: 32px` 1줄 추가.
- **D3 대칭**: Skia Separator는 spec shapes로 렌더 — 세로 Separator의 최소 길이는 레이아웃(Taffy) 차원 문제. 수동 CSS만 고치면 Preview/Skia 비대칭 발생 가능 → Skia/Taffy 측 세로 Separator 최소 높이도 동기화 필요. **확인 사항**: SeparatorSpec의 세로 처리 + factory 기본 height.
- **위험**: LOW~MED. 단순 CSS 1줄로 보이나 Skia/layout 동기화 누락 시 Preview만 32px, Builder는 0 — `/cross-check` 필요.
- **검증**: `/cross-check` Separator — 세로 방향 Preview ↔ Skia.

---

## C5 — Toast View Transitions 모더나이제이션 (선택, 우선순위 낮음)

- **현재**: 수동 `Toast.css` — fixed-position + position 변형(top/bottom × left/right/center), 자체 입·퇴장 처리.
- **starter 참조**: `Toast.css` — `view-transition-class: toast` + `::view-transition-new/old(.toast)` + `@keyframes slide-in/out`. View Transitions API 기반 입·퇴장.
- **변경 위치**: 수동 `Toast.css` + RAC ToastRegion 렌더 경로
- **설계 결정**: View Transitions API는 메커니즘 자체가 다름(브라우저 API). 채택 시 (1) RAC ToastRegion의 view-transition 지원 여부 (2) 대상 브라우저 지원 (3) Skia 측 Toast 렌더와의 정합 확인 필요.
- **권장**: 우선순위 낮음 — composition의 현 Toast 동작은 정상. 별도 모더나이제이션 단위로 분리, C1~C4 완료 후 재평가.

---

## 부수 — generated Separator.css 비-인터랙티브 상태 emit (starter 무관)

`generated/Separator.css`가 비-인터랙티브 Separator에 `[data-hovered]`/`[data-pressed]`/`[data-focus-visible]`/`[data-disabled]`를 emit. CSSGenerator의 archetype→state emit이 비-인터랙티브 archetype 분기가 없는 quirk. starter 도입과 무관 — CSSGenerator 정리 단위로 별도 분리. C3 dead CSS cleanup과 묶어 "composition 내부 CSS 정리" 단위로 처리 가능.

---

## 권장 진행 순서

1. **C1-a** — Button/ToggleButton spec `states.pressed.scale` + button archetype transition. 가장 작고 즉시.
2. **C1-c** — DisclosureHeader spec states.
3. **C1-b** — 수동 CSS sub-element (Calendar/GridList/Tag).
4. **C4** — Separator 세로 min-height (Skia/layout 동기화 동반).
5. **C2** — Switch thumb (채택 범위 설계 결정 후).
6. **C5** — Toast View Transitions (선택, 후순위).
7. **부수** — Checkbox.css dead CSS + Separator generated 상태 emit 정리 (composition 내부, starter 무관).

## ADR 필요 여부

- **C1 전체**: ~6개 컴포넌트에 사용자-가시 micro-interaction(press-scale)을 신규 도입 — 디자인 언어 추가 + 3+ 파일 변경. ADR 1건이 적절(press-scale 인터랙션 도입 결정 + button archetype transition 변경 영향 기록). C1-a/b/c는 그 ADR의 design breakdown phase로 묶음.
- **C2/C4/C5**: 개별 spec·CSS 조정 수준 — 독립 ADR 불요. C2/C4는 C1 ADR의 후속 항목 또는 단순 수정, C5는 별도 모더나이제이션 작업.
- **C3**: 채택 기각 — ADR 불요.

본 문서는 설계까지. ADR 작성·코드 수정은 사용자 지시 후 진행.
