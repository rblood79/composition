# SPEC SSOT 화 — Phase 0 분류 인벤토리

**날짜:** 2026-05-18
**목적:** "전체 컴포넌트 SPEC SSOT 화" ADR 의 Context/Alternatives 를 실측 데이터로 고정.
**방법:** `skipCSSGeneration: true` 33 컴포넌트 + generated/manual CSS 동시 보유(이중 CSS) 18 컴포넌트를 grep 실측 → 분류.
**분류 기준:** `docs/reference/components/SPEC_CSS_BOUNDARY.md` (Leaf vs Container/Composite 경계).

---

## 0. 요약 — "전체 33" 은 33 위반이 아니다

| 모집단                           | 수  | 성격                                                      |
| -------------------------------- | --- | --------------------------------------------------------- |
| `skipCSSGeneration: true`        | 33  | 대부분 SPEC_CSS_BOUNDARY 상 **의도된** 구조 슬롯/컨테이너 |
| 이중 CSS (generated + 수동 공존) | 18  | **실제 drift/override 위험 표면**                         |

→ SSOT-화의 실작업면은 "33 skipCSSGeneration 해체" 가 아니라 **이중 CSS 18 + 이상치 2 + 컨테이너 구조 CSS 의 spec-derive 여부 결정**.

---

## 1. 모집단 A — `skipCSSGeneration: true` 33 컴포넌트 분류

| Class                      | 정의                                                                         | 수  | SSOT 조치                                     |
| -------------------------- | ---------------------------------------------------------------------------- | --- | --------------------------------------------- |
| **S** 구조 슬롯            | `render.shapes: () => []` + CSS 파일 없음. 순수 구조 슬롯                    | 12  | 무조치 — skipCSSGeneration 정당               |
| **C** 컨테이너 수동 CSS    | 수동 CSS 보유. SPEC_CSS_BOUNDARY 등재 컨테이너/합성                          | 11  | 결정 필요 — 구조 CSS 를 spec-derive 할 것인가 |
| **X** Skia shapes·CSS 부재 | `render.shapes` 실제 shape 생성하나 CSS 파일 없음 (DOM 경로는 부모 CSS 의존) | 8   | 확인 필요 — Preview 경로 스타일 출처          |
| **A** 이상치               | skipCSSGeneration 인데 generated CSS 파일 존재                               | 2   | 즉시 정정 대상                                |

### Class S — 구조 슬롯 (12) · 무조치

`CardContent` `CardFooter` `CardHeader` `CardPreview` `CheckboxItems` `DialogFooter` `FormField` `GridListItem` `Header` `ListBoxItem` `RadioItems` `TagList`

→ 전부 `render.shapes: () => []`. CSS 불요. skipCSSGeneration 정당. (CardPreview/DialogFooter/FormField 는 2026-05-18 배치 0 에서 신규 추가.)

### Class C — 컨테이너 수동 CSS (11) · 결정 필요

`ColorArea` `ColorPicker` `ColorSlider` `ColorSwatchPicker` `ColorWheel` `Field` `GridList` `Group` `Table` `TagGroup` `Tree`

→ SPEC_CSS_BOUNDARY "Color 인터랙션 / 합성 입력 / 구조 컨테이너 / 복합 탐색" 항목. 수동 CSS 가 구조("How")를 담당. **본 인벤토리의 핵심 결정 대상** — §3 참조.

### Class X — Skia shapes·CSS 부재 (8) · 확인 필요

`CalendarGrid` `CalendarHeader` `DateInput` `DateSegment` `DisclosureContent` `Frame` `Tag` `TreeItem`

→ Skia 는 `render.shapes` 로 그리나 DOM 경로 CSS 파일이 없음. CalendarGrid/Header 는 SPEC_CSS_BOUNDARY 상 `CalendarCommon.css`(부모)가 담당하는 것으로 등재됨. 나머지(DateInput/DateSegment/Frame/Tag/TreeItem/DisclosureContent)는 Preview 스타일 출처를 Phase 1 에서 확인.

### Class A — 이상치 (2) · 즉시 정정 대상

| 컴포넌트      | 이상                                                                           | 비고                                                                            |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `Label`       | skipCSSGeneration + 수동 CSS + `generated/Label.css` 동시 존재                 | `canvas-rendering.md §7` "Label generated CSS 부활 금지" 와 충돌 — Phase 1 확인 |
| `SearchField` | skipCSSGeneration 인데 `generated/SearchField.css` 존재 (data-size xs~xl emit) | childSpec inline-emit 또는 stale 산출물 — Phase 1 확인                          |

---

## 2. 모집단 B — 이중 CSS (generated + 수동 공존) 18 컴포넌트

generated CSS(spec 파생)와 수동 CSS 가 **동시 존재** → 수동 CSS 가 `@layer components` 내 specificity 로 generated 를 override. 의도된 경계 override 일 수도, spec 에서 drift 한 독자 정의일 수도 있음.

| 컴포넌트                                                                                                                | 분류 추정         | 근거                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Checkbox` `Radio` `Switch`                                                                                             | 의도 (documented) | toggle-indicator — 수동 CSS 가 indicator `::before`. SPEC_CSS_BOUNDARY "toggle-indicator 경계"                                                                  |
| `Calendar` `RangeCalendar`                                                                                              | 의도 + **drift**  | calendar archetype generated + `CalendarCommon.css`/`Calendar.css` 수동(셀). 단 RangeCalendar 는 spec `sizes` 0개 ↔ 수동 CSS `[data-size]` 3종 = **확정 drift** |
| `Label`                                                                                                                 | 이상치            | 모집단 A 와 중복 — §1 Class A                                                                                                                                   |
| `Button` `Badge` `Icon` `Separator` `Skeleton` `ColorSwatch` `Link` `Tooltip` `Breadcrumbs` `Popover` `ListBox` `Toast` | Phase 1 확인 필요 | Leaf(Button/Badge/Icon/Separator/Skeleton/ColorSwatch/Link) 가 수동 CSS 를 갖는 이유 미확인. override 인가 drift 인가 per-file 확인 필요                        |

→ 이중 CSS 18 중 **확정 drift 1건(RangeCalendar)**, **documented 의도 4건(Checkbox/Radio/Switch/Calendar)**, **이상치 1건(Label)**, **Phase 1 확인 12건**.

---

## 3. 핵심 발견 — ADR 가 풀어야 할 본질 질문

`SPEC_CSS_BOUNDARY.md` 와 `ssot-hierarchy.md`(ADR-063) 가 **구조 CSS** 에 대해 상충한다.

- **`ssot-hierarchy.md` (ADR-063)**: D3(시각 스타일)의 수동 CSS 가 Spec 파생이 아니면 위반. layout flow 도 D3 → Spec SSOT.
- **`SPEC_CSS_BOUNDARY.md`**: 구조 레이아웃("How")은 parity 문제가 아니다 — Store→CSS 와 Store→Taffy 가 독립적으로 읽으므로 구조 CSS 는 수동 관리로 충분. Container/Composite 의 `skipCSSGeneration` 은 의도.

"전체 컴포넌트 SPEC SSOT 화" 는 이 상충을 강제로 해소해야 한다. ADR 의 Alternatives 핵심 축:

1. **컨테이너 구조 CSS 까지 spec-derive** — Class C 11개 + 이중 CSS 의 컨테이너를 CSSGenerator 가 emit. CSSGenerator 가 형제·구조 selector(`td:first-child`, `[aria-disabled] + td`, RangeCalendar range-band)를 emit 가능한가가 hard constraint.
2. **구조 CSS 예외 유지, drift 만 해소** — SPEC_CSS_BOUNDARY 경계 인정. 이중 CSS 의 override-vs-drift 만 정리하고 컨테이너 수동 CSS 는 문서화된 예외로 동결.
3. **hybrid** — Leaf 는 100% spec-derive, 컨테이너 구조는 수동 CSS 를 spec 의 `containerStyles`/`composition` 으로부터 부분 파생(ADR-907 패턴 확장).

---

## 4. ADR 입력 권고

- 본 인벤토리는 **Phase 0 freeze** — ADR Context 에 모집단 A(33) / B(18) 수치 인용.
- ADR 의 hard constraint: "CSSGenerator 가 형제·구조 selector 를 emit 지원하는가" (`adr-writing.md` 반복 패턴 #2).
- Phase 1 에서 해소할 미확정: Class X 8개 Preview 스타일 출처 / 이상치 2개(Label·SearchField) / 이중 CSS Phase-1 확인 12개의 override-vs-drift.
- BC 영향: 이중 CSS 18 중 override 제거 시 시각 회귀 가능 — ADR Risk 표에 "X 컴포넌트 재스타일" 수식화 필요.

---

## 부록 — 실측 명령

```bash
# skipCSSGeneration:true 목록
grep -rl 'skipCSSGeneration: true' packages/specs/src/components/*.spec.ts

# 이중 CSS (generated + 수동 동시)
for g in packages/shared/src/components/styles/generated/*.css; do
  n=$(basename $g .css)
  test -f packages/shared/src/components/styles/$n.css && echo $n
done
```

실측 기준 커밋: `aaf90aa5a` (2026-05-18).
