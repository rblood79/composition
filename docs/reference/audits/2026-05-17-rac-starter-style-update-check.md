# react-aria-starter 유래 스타일 업데이트 후보 체크

> 작성: 2026-05-17
> 대상: `/Users/admin/work/react-aria-starter/src` (Adobe 공식 React Aria starter docs, Storybook `localhost:6006`) ↔ composition `packages/specs` + `packages/shared/src/components/styles`
> 기준: 사용자 결정 — **composition 자체 Spec D3 SSOT를 기준으로 유지**하고, starter에서 받아들여야 할 스타일 업데이트만 후보로 식별
> 참조: `.claude/rules/ssot-hierarchy.md` (D1/D2/D3), ADR-022(S2 토큰), ADR-036(Spec-First)

## 결론 — 일관된 단일 공백은 press-scale, 나머지 차이는 대부분 의도적 분기

composition은 react-aria-starter에서 **광범위하게 의도적으로 분기**했다 (S2 하이브리드 토큰, Spec-First CSS 생성, 컴포넌트별 자체 variant·애니메이션 체계). 두 저장소의 CSS 차이 대부분은 ADR로 결정된 분기이며 "업데이트 누락"이 아니다.

starter에 있고 composition이 일관되게 결여한 **유일한 디자인 언어**는 **press-scale micro-interaction** (눌림 시 요소 축소)이다. 그 외 후보는 부분적·minor.

| 후보                                               | 범위       |  심각도   | 채택 비용                 |
| -------------------------------------------------- | ---------- | :-------: | ------------------------- |
| C1 press-scale micro-interaction                   | 9 컴포넌트 | **주요**  | 신규 spec capability 필요 |
| C2 Switch thumb press 변형 + selected inner-shadow | Switch     |   보조    | Switch spec 디테일        |
| C3 Checkbox 체크마크 stroke 속성                   | Checkbox   | 확인 필요 | 구조 검증 선행            |
| C4 Separator 세로 min-height                       | Separator  |   minor   | spec 값 1개               |
| C5 Toast View Transitions / text-wrap              | Toast 외   |   minor   | 메커니즘 차이             |

## 검증 방법

- **전수 패턴 grep** (starter 56 CSS 파일 + composition 94 generated + 수동 CSS): 인터랙션 상태, 접근성 미디어쿼리, 현대 CSS 속성 분포 비교.
- **컴포넌트 deep-read 전수 완료 (39/39 공통 컴포넌트, 2026-05-17 확장)**:
  - 1차 20개: Button, Checkbox, CheckboxGroup, Switch, ToggleButton, ToggleButtonGroup, Link, Separator, Calendar, Disclosure, GridList, Form, RangeCalendar, TagGroup, Menu, RadioGroup, Select, Tooltip, Popover, Toast, TextField/SearchField/NumberField/InputGroup.
  - 2차 18개: ColorField, ColorSwatch, ComboBox, DateField, DatePicker, DateRangePicker, Dialog, DisclosureGroup, DropZone, ListBox, Meter, Modal, ProgressBar, Table, Tabs, Tree, Breadcrumbs, Toolbar.
  - 2차 결과 — **신규 C1-tier(press-scale 급) 후보 0건**. 검증된 사실: date 필드군은 composition이 `tabular-nums` 이미 보유(`Field.css` + generated date CSS), ProgressBar는 `ProgressBar-indeterminate` 애니메이션 보유, Tabs는 `TabsIndicator.css` 보유 — 모두 공백 아님. ListBox/Meter/Modal/Table/Tree/Breadcrumbs/Toolbar의 starter 상세 스타일(layout=stack/grid, glossy fill `oklch(from ...)`, modal `@keyframes`)은 composition 자체 컴포넌트 설계(의도적 분기) 또는 token 의존. 유일한 minor 추가: DropZone `text-wrap: balance`(composition 미보유) — C5 minor에 포함.
- 토큰 **값** 차이(`--spacing-3` vs `4px 12px`)는 노이즈로 제외 — 토큰 무관 신호(상태/구조/셀렉터/속성)에 집중.

### 상태 커버리지 — composition이 starter보다 앞섬 (후보 아님)

| 패턴                                                   |          starter          |                        composition                         |
| ------------------------------------------------------ | :-----------------------: | :--------------------------------------------------------: |
| `forced-colors`                                        |          12 파일          |                   93 generated + 13 수동                   |
| `data-hovered` / `data-pressed` / `data-focus-visible` |        8 / 20 / 20        |                86 / 80 / 93 generated 전수                 |
| `prefers-reduced-motion`                               |             4             |                   20 generated + 4 수동                    |
| 오버레이 진입 애니메이션                               | 단순 transform transition | Tooltip/Popover 자체 `@keyframes` (cubic-bezier) — 더 정교 |

composition의 CSSGenerator가 모든 컴포넌트에 상태·접근성 CSS를 전수 emit하므로, 상태 커버리지·오버레이 애니메이션은 starter에서 받을 것이 없다.

## 후보 목록

### C1 — Press-scale micro-interaction [주요]

starter는 `[data-pressed]` 시 요소(또는 내부 span)를 `scale: 0.9~0.98`로 축소하는 **촉각 눌림 피드백**을 일관된 디자인 언어로 적용한다. composition은 generated CSS·spec·수동 CSS 전부 **0건**.

| 컴포넌트               | starter 용례                            | composition 현재                                             |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------ |
| Button                 | `&[data-pressed] { scale: 0.95 }`       | 없음                                                         |
| ToggleButton           | `&[data-pressed] { scale: 0.95 }`       | `box-shadow: inset 0 1px 2px rgba(0,0,0,.1)` (다른 메커니즘) |
| ToggleButtonGroup      | `&[data-pressed] > span { scale: 0.9 }` | 없음                                                         |
| Calendar 셀            | `&[data-pressed] { scale: 0.9 }`        | 없음                                                         |
| RangeCalendar 셀       | `&[data-pressed] span { scale: 0.9 }`   | 없음                                                         |
| GridList 항목          | `&[data-pressed] { scale: 0.98 }`       | 없음                                                         |
| Disclosure             | `&[data-pressed] { scale: 0.97 }`       | 없음                                                         |
| Form 버튼              | `&[data-pressed] { scale: 0.9 }`        | 없음                                                         |
| TagGroup 태그/삭제버튼 | `scale: 0.96` / `0.9`                   | 없음                                                         |

- ToggleButton만 composition이 inset-shadow로 별도 눌림 피드백을 가지나, 나머지 8개는 **눌림 변형 자체가 전무**.
- 채택 비용: 단순 CSS 수정 아님. interactive archetype(button/toggle/cell 등)에 **press transform 필드(`pressedScale` 류) 신규 도입** → CSSGenerator가 `[data-pressed]`에 emit. Skia consumer는 Builder 에디터에서 pressed가 인터랙티브 상태가 아니라 영향 적음 — Preview/Publish CSS가 주 수혜.
- D3 SSOT 정합: spec 필드로 도입하면 CSS/Skia 양 consumer 대칭 유지.

### C2 — Switch thumb press 변형 + selected thumb inner-shadow [보조]

- starter Switch: `&[data-pressed] .handle { scale: 1.2 1; border-radius 비대칭 조정 }` — thumb이 눌림 시 가로로 신축. `&[data-selected] .handle { box-shadow: inset 0 -4px 4px oklch(from var(--tint) 85% c h / .3) }` — thumb 하단 inner-shadow.
- composition Switch: thumb(`.indicator:before`)는 press 변형 없음, selected 시 평면.
- 채택: SwitchSpec indicator의 press/selected 시각 디테일. C1과 같은 press 메커니즘 계열.

### C3 — Checkbox 체크마크 stroke 속성 [확인 필요 — 확정 후보 아님]

- starter Checkbox svg: `stroke-width: 3px`, `stroke-linecap/linejoin: round`, `stroke-dasharray: 22px`, `stroke-dashoffset: 66 → 44` (선택 시 그려지는 draw-on 애니메이션).
- composition: `Checkbox.css`가 `&[data-selected] svg { stroke-dashoffset: 44 }`만 두고 **`stroke-dasharray` 부재** → dashoffset이 시각 효과 없음. `renderCheckbox`(FormRenderers.tsx:503)는 명시적 체크마크 `<svg>`를 emit하지 않음.
- 판정: composition Checkbox 체크마크 렌더 경로의 구조 검증 선행 필요. 확정 후보로 올리기 전 "체크마크가 어디서 렌더되는가 / draw-on 애니메이션 의도 여부" 확인. `stroke-dashoffset: 44`는 현재 **dead property**.

### C4 — Separator 세로 방향 min-height [minor]

- starter: `&[aria-orientation="vertical"] { min-height: 32px }`.
- composition: 세로 Separator에 min-height 없음 → flex 컨테이너에서 0으로 collapse 가능.
- 채택: SeparatorSpec 세로 사이즈에 min-height 값 1개.

### C5 — Toast View Transitions / 기타 modern CSS [minor]

- Toast: starter는 View Transitions API (`view-transition-class: toast` + `::view-transition-new/old` + `@keyframes slide-in/out`)로 입·퇴장 애니메이션. composition은 fixed-position + 자체 방식. 메커니즘 차이 — 채택은 선택.
- `text-wrap` 1파일, `view-transition` 1파일 — 영향 미미.

## 의도적 분기 — 후보 아님 (명시적 제외)

아래는 ADR로 결정된 분기 또는 composition 자체 설계로, "drift"로 보고하지 않는다.

- **토큰 네이밍**: `--spacing-N` / `--font-size` / `--radius` (starter) vs `--text-N` / 시맨틱 `--fg`·`--bg`·`--accent` (composition) — ADR-022 S2 하이브리드.
- **클래스 네이밍**: starter `.indicator` / `.handle` / `.track` vs composition `.checkbox` / `.indicator:before`.
- **variant 체계**: composition이 컴포넌트별 자체 variant 다수 보유 (Button 6종, Separator 7종 등) — starter는 단일.
- **Link 기본 밑줄**: composition은 hover 시 underline / starter는 항상 underline — composition 디자인 선택.
- **ToggleButton 눌림 메커니즘**: composition inset-shadow / starter scale — composition 자체 선택 (C1과 별개로 scale 추가 가능).
- **`prefers-color-scheme`**: starter 8파일 / composition generated 0 — composition은 명시적 theme 전환 시스템(ADR-021).
- **`:has()` icon 감지**: starter `&:has(> svg:only-child)` / composition `[data-icon-only]` 속성.
- **필드 구조**: starter SearchField `grid-template-areas`, NumberField `::after` 포커스 pseudo — composition은 spec 생성 구조.
- **Menu `.lucide-dot { scale: 3 }`**: starter의 선택 마커 렌더 트릭 — composition은 자체 selection indicator.

## 부수 관찰 (starter 무관 — composition 내부)

- `generated/Separator.css`가 비-인터랙티브 Separator에 `[data-hovered]` / `[data-pressed]` / `[data-focus-visible]` / `[data-disabled]`를 emit — archetype generator가 인터랙티브 상태를 무조건 생성하는 quirk. starter 채택과 무관, composition CSSGenerator 정리 대상.
- composition ToggleButton의 `box-shadow: inset 0 1px 2px rgba(0,0,0,0.1)` — 하드코딩 색상, 토큰 미사용.

## 권고

1. **C1 press-scale**이 유일하게 일관된 디자인 언어 공백 — 채택 가치 있음. 단 단순 CSS 패치가 아니라 **interactive archetype에 press transform spec 필드 신규 도입**이 선행. 별도 설계 단위로 분리 권고.
2. **C2**는 C1과 같은 press 계열 — C1 spec capability에 묶어 처리 가능.
3. **C3**는 composition Checkbox 체크마크 렌더 구조 검증 후 후보 확정/기각.
4. **C4 / C5**는 낮은 우선순위 — 개별 spec 값 조정.
5. 전체적으로 composition은 starter에서 의도적으로 크게 분기했고, "받아야 할 업데이트"는 소수다. starter는 D3 시각 SSOT의 상위 권위가 아니며, 채택 시에도 composition Spec을 경유해 CSS/Skia 양 consumer 대칭을 유지해야 한다.

## 후속 (사용자 결정 대기)

- 본 문서는 "체크" 단계 — 후보 식별까지. 실제 spec 수정은 미수행.
- **컴포넌트별 구조 diff 전수 완료 (2026-05-17)** — 39/39 공통 컴포넌트 deep-read 완결. 2차 18개 deep-read 결과 신규 C1-tier 후보 0건, press-scale(C1)이 유일한 일관된 디자인 언어 공백임을 재확인. 후보 목록(C1~C5)은 변경 없음.
