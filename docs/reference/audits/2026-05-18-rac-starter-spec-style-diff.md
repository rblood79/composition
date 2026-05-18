# react-aria-starter ↔ composition Spec 시각 스타일 diff 감사

**날짜:** 2026-05-18
**목적:** `react-aria-starter/src`(RAC 스타일 참조 원본) 업데이트분을 composition Spec(D3 SSOT)에 반영하기 위한 Phase 0 실측.
**방법:** registered 컴포넌트 ↔ `react-aria-starter/src` 스타일을 5 패밀리 병렬 감사. 각 delta 는 starter/composition 양쪽 `file:line` + 값 인용.
**방법론 (CRITICAL):** composition 은 자체 토큰 체계(`--accent`/`--text-*`/`--bg-*`)를 쓴다. **토큰 이름 차이는 diff 아님.** 치수값·신규 rule·구조·상태 동작 차이만 delta 로 집계 (ADR-140 의 "composition 토큰 체계로 내재화" 원칙).
**범위:** Table 패밀리 + Tree·TagGroup·ColorPicker·GridList·ColorArea·ColorSlider 제외 — generated CSS 미보유 skipCSSGeneration 컨테이너로 ADR-059(skipCSSGeneration 해체) 후속 이관. ProgressCircle 등 starter CSS 미존재 컴포넌트 제외. 제외 컴포넌트 관련 감사 항목(H11 Tag pill, §2 MED 의 Tree selected divider·GridListItem 카드 shadow·ColorArea aspect-ratio·ColorSlider track height)은 ADR-141 범위 외.
**한계:** 병렬 agent 감사 결과 — HIGH 항목은 채택 시점에 per-item 재확인 필요.

---

## 0. 패턴 요약 — delta 는 6개 군으로 수렴

| 패턴                          | 내용                                                                                           | 해당 컴포넌트                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **P1 형태 (pill/원형)**       | starter `border-radius: 9999px` ↔ composition `radius-md/lg` 사각                              | SearchField, Tag, ColorSwatch, ColorSwatchPicker, icon-only Button/ToggleButton  |
| **P2 상태 micro-interaction** | starter 의 press-scale/chevron rotate/panel height/checkmark draw/패널 전환 ↔ composition 누락 | Disclosure, TabPanel, Checkbox, ToggleButtonGroup                                |
| **P3 입체 box-shadow**        | starter inset/3d box-shadow ↔ composition flat                                                 | Switch thumb, Slider fill, ProgressBar/Meter fill                                |
| **P4 치수 격차**              | padding/radius/max-width/track-height/thumb-size 숫자값 차이                                   | Dialog, Modal, Popover, Tooltip, ProgressBar/Meter, ColorThumb/Slider, Separator |
| **P5 구조 차이**              | overlap/inner-span/grid-subgrid 등 selector 구조                                               | ToggleButtonGroup, RangeCalendar, Menu                                           |
| **P6 상태 누락 (개별)**       | drop-target/[role=alert]/selected 그룹 divider 등                                              | DropZone, Form, ListBox, Tree                                                    |

> **채택 판정 주의:** 각 delta 가 "starter 업데이트 → 채택" 인지 "composition 의도적 발산 → 유지" 인지는 **per-item 제품 판단**. 본 감사는 데이터만 제공. 특히 P1(형태)·P3(입체감)은 composition 디자인 언어 의도일 수 있음.

---

## 1. HIGH — 18건

| #   | 컴포넌트          | starter                                                                                     | composition                                                                                        | delta |
| --- | ----------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----- |
| H1  | Button            | `Button.css:25-30` icon-only `width:32px; border-radius:9999px` (원형)                      | `generated/Button.css:86-89` `[data-icon-only]` `padding:0; aspect-ratio:1` (radius 미설정 → 사각) | P1    |
| H2  | ToggleButton      | `ToggleButton.css:34-38` icon-only `width:32px; border-radius:9999px`                       | `generated/ToggleButton.css:61-64` radius 미설정                                                   | P1    |
| H3  | ToggleButtonGroup | `ToggleButtonGroup.css:35,40` 인접 버튼 `margin-inline-start:-1px` (테두리 겹침)            | margin 겹침 rule 없음                                                                              | P5    |
| H4  | ToggleButtonGroup | `ToggleButtonGroup.css:39-46` first/last child `border-radius` 모서리 분리                  | 그룹 컨테이너만 radius, 자식 모서리 처리 없음                                                      | P5    |
| H5  | Link              | `Link.css:8` `text-decoration:underline` + `:15-17` hover `text-decoration-thickness:1.5px` | `generated/Link.css` underline rule 자체 없음                                                      | P6    |
| H6  | SearchField       | `SearchField.css:31` Input `border-radius:9999px` (pill)                                    | `generated/SearchField.css:283` `border-radius:var(--radius-md)` (사각)                            | P1    |
| H7  | DropZone          | `DropZone.css:24-32` `&[data-drop-target]{outline:2px solid; background 강조}`              | `data-drop-target` 분기 없음 (data-focus-visible 만)                                               | P6    |
| H8  | RangeCalendar     | `RangeCalendar.css:50-93` 범위 선택 = border 띠(`border-top/bottom:0.5px`, `--tint-700`)    | `RangeCalendar.css:11-41` solid `background:var(--accent)` 채움                                    | P5    |
| H9  | RangeCalendar     | `RangeCalendar.css:40-48` CalendarCell inner `span` 2층 (scale/focus-ring 담당)             | inner span 구조 없이 cell 직접 스타일, focus offset `2px`↔`-2px`                                   | P5    |
| H10 | DateRangePicker   | `DateRangePicker.css:54` `[slot=end]{margin-right:1.75rem}` (트리거 버튼 겹침 방지)         | `generated/DateRangePicker.css:269` margin-right 없음                                              | P4    |
| H11 | Tag               | `TagGroup.css:28-29` `border-radius:9999px` pill + `height:var(--spacing-5)` (20px) 고정    | `TagGroup.css:37` `border-radius:var(--radius-md)` 사각, height 미지정                             | P1    |
| H12 | Dialog            | `Dialog.css:8` `padding:var(--spacing-10)` (40px)                                           | `generated/Dialog.css:16` md `padding:8px 8px`                                                     | P4    |
| H13 | Popover           | `Popover.css:14` `padding:8px` + MenuTrigger `padding:0` 예외                               | `generated/Popover.css:21` md `padding:16px`, 예외 없음                                            | P4    |
| H14 | Modal             | `Modal.css:30` `border-radius:var(--radius-xl)` (16px)                                      | `overlays.css:26` `border-radius:var(--radius-md)`                                                 | P4    |
| H15 | Modal             | `Modal.css:35` `max-width:min(500px,90vw)`                                                  | `overlays.css:32` `max-width:300px`                                                                | P4    |
| H16 | Disclosure        | `Disclosure.css:48-56` chevron `rotate:0→90deg; transition:rotate 200ms`                    | chevron rotate rule 없음                                                                           | P2    |
| H17 | Disclosure        | `Disclosure.css:61-63` Panel `height` + `transition:height 250ms` (펼침 애니메이션)         | DisclosureContent height transition 없음                                                           | P2    |
| H18 | ProgressBar       | `ProgressBar.css:27-44` fill `linear-gradient` shimmer + 3d box-shadow + `animation`        | `generated/ProgressBar.css:162-167` 단색 fill                                                      | P2/P3 |

## 2. MEDIUM — 주요 27건 (요약)

- **Actions**: Button/ToggleButton 고정 height(`spacing-8`=32px) ↔ composition `height:auto`+padding; transition 속성/시간(200ms↔150ms); Button 아이콘 18px↔16px; Toolbar gap(4px↔8px)·separator margin(4px↔10px); ToggleButtonGroup vertical orientation 미지원.
- **Forms**: NumberField `::after` focus/invalid 오버레이 + Group box-shadow; NumberField Input width `5.25rem`; SearchField clear-button 색상(dark↔overlay); Checkbox indicator 18px↔20px + checkmark draw(`stroke-dasharray`); Radio dot 구현(scale 애니↔border-width); Switch track 22×38↔20×36 + selected thumb 내부 그림자; Slider thumb 22↔20px + fill 광택 box-shadow; Form gap(24↔16px) + `[role=alert]` 박스; DropZone padding/min-height.
- **Select/DateTime**: DatePicker/DateRangePicker/DateField 고정 height(32px) + overflow 스크롤(`overflow-x:auto;scrollbar-width:none`); ComboBox/DateInput 우측 chevron padding 비대칭; DateField segment 상하 padding(2px); Calendar 셀 cqw 크기 모델 + container query 분기.
- **Color/Collections**: ColorArea `aspect-ratio:1`↔고정높이; ColorThumb border 2↔4px·크기 18↔16px; ColorSlider track 24↔20px; GridListItem 카드 shadow↔border; ListBox/Tree 인접 selected 그룹 divider; TabList 하단 border; TabPanel entering/exiting 전환; Tab padding(10px 균일↔4/12); Breadcrumbs current 색상(fg↔accent).
- **Overlay/Display**: Dialog title `margin-bottom:1em`; Popover/Tooltip shadow 강도; Tooltip padding(4/8↔6/10); Toast width(230↔min 280) + view-transition(400↔300ms); Separator 두께(2↔1px) + 세로 min-height 32px; ProgressBar/Meter track height(10↔8px); Meter fill 3d box-shadow + 기본색(green↔info); ProgressBar indeterminate 메커니즘.

## 3. LOW — 미세값 (요약)

transition duration(200↔150ms) 전반, segment focus radius(4px↔radius-xs), Calendar invalid 표현, Menu min-width, Tree chevron stroke(3↔2px), ColorSwatch 크기(32↔28px), DateField placeholder italic(패밀리 내 불일치) 등 ~20건.

## 4. composition 초과 확장 (diff 아님 — 보고 제외 확인분)

Toast `data-position` 6종, ProgressBar `data-size` 5단계, Calendar `[data-today]` dot, Breadcrumbs `::after` separator, 다수 컴포넌트의 xs~xl 다중 size 체계 — composition 이 starter 단일 size 를 확장한 의도적 영역.

---

## 5. 다음 단계 — 채택 판정

본 감사는 Phase 0 (데이터). HIGH 18 + MED 27 각각을 **(a) starter 업데이트 채택 / (b) composition 의도적 발산 유지 / (c) 보류** 로 판정해야 하며, 이 판정 + 채택분의 Spec 반영 방식이 ADR Decision 대상.

- 패턴 P1(형태)·P3(입체감)은 디자인 언어 의도 가능성 — 일괄 채택/기각 판정 적합.
- P2(micro-interaction)는 ADR-140 선례(press-scale)와 동일 계열 — Spec `states` + StateEffect 경유.
- P4(치수)는 개별 값 판정.

감사 대상 agent ID (재질의용): Actions `a485dd127400c4f41` / Forms `ae8247630743e4d66` / Select·DateTime `adb4883028b956e13` / Color·Collections `af130f3084977d542` / Overlay·Display `abb245285bdb58fbb`.

실측 기준 커밋: `aaf90aa5a` (2026-05-18).
