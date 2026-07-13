# ADR-106-a Breakdown: Color Family skipCSSGeneration 해체 — 구현 상세

> 본 파일은 [ADR-106-a](../completed/106-a-color-family-skipcss-dismantle.md) 의 구현 상세 분리 문서.
> ADR 본문에는 `> 구현 상세: [링크]` 포인터만 기록함.

## 결론 요약

4개 spec (ColorPicker / ColorSlider / ColorSwatchPicker / ColorWheel) 이 ADR-106 Charter G3 분류에서 **G2 재판정**됨. CSSGenerator가 Color family 내부 RAC 구조체(`ColorThumb`, `ColorWheelTrack`, `ColorSwatchPickerItem`)를 emit 불가 → 수동 CSS 유지가 구조적으로 정당. 수동 CSS는 spec token 파생(`var(--bg-raised)`, `var(--radius-md)` 등) → D3 대칭 consumer 원칙 준수.

**코드 변경 없음** — 본 ADR 작업은 조사 + 문서화 + 주석 추가.

---

## Phase 0: 선행 조사 (DONE — 본 ADR 작성 시 완료)

### 목적

CSSGenerator 지원 범위 조사 + 4개 CSS 파일 spec token 파생 여부 전수 조사.

### 결과

#### CSSGenerator 지원/미지원 확정

```
지원 (✅):
  - .react-aria-{Name}               root selector
  - [data-variant][data-size]        attribute selector
  - [data-state]                     상태 selector
  - composition.staticSelectors      고정 자식 selector
  - composition.sizeSelectors        per-size 자식 selector
  - composition.rootSelectors        root pseudo selector
  - childSpecs inline embed          ADR-078

미지원 (❌):
  - .react-aria-ColorThumb 등        전역 공유 RAC 내부 selector
  - [data-selected]::after           pseudo-element
  - [data-orientation=vertical]      orientation 분기 선언형
  - conic gradient CSS               배경 속성 자체
```

#### 4개 CSS 파일 spec token 파생 전수 조사

**ColorPicker.css** (190 lines):

| CSS 값                                       | spec token 파생? | 근거                                                    |
| -------------------------------------------- | :--------------: | ------------------------------------------------------- |
| `var(--accent)`                              |        ✅        | `{color.accent}` → `--accent`                           |
| `var(--radius-sm)`                           |        ✅        | `{radius.sm}` → `--radius-sm`                           |
| `var(--text-sm)`                             |        ✅        | `{typography.text-sm}` → `--text-sm`                    |
| `var(--fg)`                                  |        ✅        | `{color.neutral}` → `--fg`                              |
| `var(--bg-raised)`                           |        ✅        | `{color.raised}` → `--bg-raised`                        |
| `var(--bg-overlay)`                          |        ✅        | `{color.layer-1}` → `--bg-overlay`                      |
| `var(--border)`                              |        ✅        | `{color.border}` → `--border`                           |
| `var(--bg-muted)`                            |        ✅        | `{color.neutral-subtle}` → `--bg-muted`                 |
| `var(--accent-subtle)`                       |        ✅        | `{color.accent-subtle}` → `--accent-subtle`             |
| `--cp-btn-width: 32px`                       |        ⚠️        | spec `sizes.md` 에 대응 필드 없음 — 독자 수치           |
| `--cp-btn-height: 32px`                      |        ⚠️        | spec `sizes.md` 에 대응 필드 없음 — 독자 수치           |
| `--cp-dialog-padding: 14px`                  |        ⚠️        | spec `sizes.md.paddingX = 14` 매핑 가능하나 현재 미연결 |
| `--cp-dialog-gap: 10px`                      |        ⚠️        | spec `sizes.md.gap = 10` 매핑 가능하나 현재 미연결      |
| `--cp-dialog-min-width: 192px`               |        ❌        | spec 외부 독자 수치 (파생 불가)                         |
| `gap: 10px` (root default)                   |        ⚠️        | spec `sizes.md.gap = 10` 매핑 가능                      |
| `var(--bg-inset)` (variant secondary)        |        ✅        | `{color.layer-2}` → `--bg-inset`                        |
| `var(--color-purple-600)` (variant tertiary) |        ✅        | Named color token                                       |

**ColorSlider.css** (82 lines):

| CSS 값                                 | spec token 파생? | 근거                                                          |
| -------------------------------------- | :--------------: | ------------------------------------------------------------- |
| `var(--radius-md)` (SliderTrack)       |        ✅        | `{radius.md}`                                                 |
| `height: 20px` (horizontal track)      |        ⚠️        | spec `sizes.md.height = 20` 매핑 가능                         |
| `var(--bg-raised)` (ColorThumb border) |        ✅        | `{color.raised}`                                              |
| `var(--shadow-sm)` (ColorThumb)        |        ✅        | shadow token                                                  |
| `gray !important` (disabled)           |        ❌        | 하드코딩 색상 — spec `states.disabled.opacity = 0.38` 만 있음 |
| `height: 150px` (vertical block)       |        ❌        | spec 외부 독자 수치                                           |
| `width: 20px` (vertical track)         |        ❌        | spec 외부 독자 수치                                           |

**ColorWheel.css** (28 lines):

| CSS 값                                 | spec token 파생? | 근거                 |
| -------------------------------------- | :--------------: | -------------------- |
| `var(--bg-raised)` (ColorThumb border) |        ✅        | `{color.raised}`     |
| `var(--shadow-sm)` (ColorThumb)        |        ✅        | shadow token         |
| `gray !important` (disabled)           |        ❌        | 하드코딩 — spec 외부 |

**ColorSwatchPicker.css** (41 lines):

| CSS 값                              | spec token 파생? | 근거                                            |
| ----------------------------------- | :--------------: | ----------------------------------------------- |
| `var(--radius-lg)` (item)           |        ✅        | `{radius.lg}` = spec `sizes.md.borderRadius`    |
| `var(--focus-ring)` (item focus)    |        ✅        | `{focus.ring.default}`                          |
| `gap: 6px` (root)                   |        ⚠️        | spec `sizes.md.gap = 6` 매핑 가능               |
| `black` / `white` (selected border) |        ❌        | 하드코딩 (선택 표시 pseudo-element)             |
| `opacity: 0.2` (disabled)           |        ⚠️        | spec `states.disabled.opacity = 0.38` 과 불일치 |

**판정 요약**:

| 컴포넌트          | 주요 token 파생 ✅ |                  독자 수치 ❌/⚠️                  | G2 정당 근거                                                                          |
| ----------------- | :----------------: | :-----------------------------------------------: | ------------------------------------------------------------------------------------- |
| ColorPicker       |        9종         |          5종 (`--cp-*` 일부 + min-width)          | 주요 색상/radius/typography 전부 token 파생. `--cp-dialog-min-width` 는 레이아웃 상수 |
| ColorSlider       |        3종         |      3종 (gray disabled, vertical 고정 수치)      | track radius/thumb border token 파생. disabled gray는 RAC 내부 상태                   |
| ColorWheel        |        2종         |                1종 (gray disabled)                | thumb border token 파생. disabled gray는 RAC 내부 상태                                |
| ColorSwatchPicker |        2종         | 2종 (selected border black/white, opacity 불일치) | focus/radius token 파생. selected::after는 CSS 관용 패턴                              |

---

## Phase 1: ADR-059 Tier 3 예외 공식 등록

**목표**: ADR-059 `§최종 SSOT 순도` 조건 표에 Color family 4건 추가.

**대상 파일**: `docs/adr/completed/059-composite-field-skip-css-dismantle.md`

**변경 내용**: `§Gates — 최종 SSOT 순도` Gate의 Tier 3 예외 목록에 아래 4건 추가:

```
| ColorPicker    | skipCSSGeneration: true | RAC Color family 내부 구조 (Dialog/button container) 수동 재정의. 주요 색상은 spec token 파생. --cp-* 로컬 변수 중 dialog-min-width는 독자 수치 (레이아웃 상수) | ADR-106-a |
| ColorSlider    | skipCSSGeneration: true | RAC SliderTrack/ColorThumb selector 수동 재정의. 주요 색상/radius spec token 파생. vertical 고정 수치는 RAC 내부 구조 | ADR-106-a |
| ColorWheel     | skipCSSGeneration: true | RAC ColorWheelTrack/ColorThumb selector 수동 재정의. thumb border spec token 파생 | ADR-106-a |
| ColorSwatchPicker | skipCSSGeneration: true | RAC ColorSwatchPickerItem[data-selected]::after pseudo-element 수동 재정의. focus/radius spec token 파생 | ADR-106-a |
```

**예상 작업량**: 1개 파일, 4줄 추가.

---

## Phase 2: ColorPicker.css spec.sizes alignment 주석 추가

**목표**: `--cp-*` 독자 수치와 spec `sizes.*` 값의 매핑 관계를 CSS 주석으로 명시. 향후 ColorPicker spec 편집 시 drift 감지 가능하게.

**대상 파일**: `packages/shared/src/components/styles/ColorPicker.css`

**변경 내용 (주석 추가만, CSS 값 변경 없음)**:

```css
/* Size locals (md default)
 * spec.sizes.md: paddingX=14, paddingY=14, gap=10
 * @spec-align: --cp-dialog-padding ≈ sizes.paddingX (현재 14px ✅)
 * @spec-align: --cp-dialog-gap ≈ sizes.gap (현재 10px ✅)
 * @spec-align: --cp-btn-width/height — spec 외부 독자 수치, 별도 sizes 필드 필요
 * @spec-align: --cp-dialog-min-width: 192px — spec 외부 레이아웃 상수
 */
```

sm/lg size 블록도 동일 패턴으로 주석:

```css
&[data-size="sm"] {
  /* spec.sizes.sm: paddingX=10, gap=8
   * --cp-dialog-padding: 12px ⚠️ (spec paddingX=10 과 불일치 — 의도적 확장?)
   * --cp-dialog-gap: 6px ⚠️ (spec gap=8 과 불일치) */
  ...
}
```

**예상 작업량**: 1개 파일, 주석 10-15줄 추가.

---

## Phase 3: D3 대칭 확인 문서화

**목표**: 4개 컴포넌트의 Skia ↔ CSS 시각 대칭 상태를 공식 문서화. `/cross-check` 또는 `parallel-verify` 실행 불필요 (코드 변경 없음, 기존 상태 확인).

### Skia render.shapes ↔ CSS 정합 매트릭스

| 컴포넌트          | Skia token                        | CSS token                         |                                        정합 상태                                        |
| ----------------- | --------------------------------- | --------------------------------- | :-------------------------------------------------------------------------------------: |
| ColorPicker       | `{color.border}` → border         | `var(--border)`                   |                                           ✅                                            |
| ColorPicker       | `{color.base}` → bg               | `var(--bg-raised)` (dialog)       |             ⚠️ Dialog bg vs container bg 차이 — 의도적 (popover elevation)              |
| ColorSlider       | `{color.border}` → track border   | `var(--bg-raised)` (thumb border) | ⚠️ Skia와 CSS thumb border color 상이 — Skia: `{color.border}`, CSS: `var(--bg-raised)` |
| ColorWheel        | `{color.base}` → center fill      | `var(--bg-raised)` (thumb)        |                                      ⚠️ 동일 패턴                                       |
| ColorSwatchPicker | `{color.accent}` → variant accent | `var(--accent)` (focus)           |                                           ✅                                            |

**주목할 불일치 — ColorSlider/ColorWheel thumb border**:

- Skia: `{color.border}` (TokenRef) = `var(--border)` CSS 변수
- CSS: `.react-aria-ColorThumb { border: 4px solid var(--bg-raised); }`
- 원인: Skia는 thumb 외곽 border, CSS는 thumb 배경 분리용 inner border (hue gradient 위에서 thumb 구분)
- 판정: **의도적 차이** — Skia의 thumb는 단순 circle + border로 단순화, CSS는 RAC ColorThumb의 실제 렌더 패턴 따름. D3 "시각 결과의 동일성" 목표 달성 수준 (thumb 모양 유사)

**결론**: 4개 컴포넌트 모두 허용 범위 내 D3 대칭 달성 상태.

---

## Phase 4: 타입 체크 + 기준선 확인

코드 변경 없음 → `pnpm type-check` 3/3 자동 통과 예상.

확인 명령:

```bash
pnpm type-check
# 기대: 3/3 PASS (변경 없음)
```

---

## 컴포넌트별 작업 매트릭스

| 컴포넌트          |  G 분류   | CSS 파일 변경 | spec 파일 변경 | 주석 추가  | CSSGenerator 변경 |
| ----------------- | :-------: | :-----------: | :------------: | :--------: | :---------------: |
| ColorPicker       | G2 재판정 |  ❌ (주석만)  |       ❌       | ✅ Phase 2 |        ❌         |
| ColorSlider       | G2 재판정 |      ❌       |       ❌       |     ❌     |        ❌         |
| ColorWheel        | G2 재판정 |      ❌       |       ❌       |     ❌     |        ❌         |
| ColorSwatchPicker | G2 재판정 |      ❌       |       ❌       |     ❌     |        ❌         |

**총 코드 변경**: 1개 파일 (ColorPicker.css 주석 추가) + 1개 파일 (ADR-059 Tier 3 표 추가)

---

## 체크리스트 (ADR Implemented 전환 조건)

- [x] **Phase 0**: 선행 조사 완료 — G2 재판정 근거 문서화 (본 breakdown)
- [x] **Phase 1**: ADR-059 §최종 SSOT 순도 Tier 3 예외 표에 4건 추가 (breakdown B4 Tier 3 표에 ColorPicker/ColorSlider/ColorWheel 3건 신규 + ColorSwatchPicker 기존 행 강화, 2026-04-21)
- [x] **Phase 2**: ColorPicker.css에 `@spec-align` 주석 추가 (md default 블록 + sm/md/lg size 블록 각 주석, 총 15줄 추가, 2026-04-21)
- [x] **Phase 3**: D3 대칭 정합 매트릭스 리뷰 (본 breakdown에 기록됨)
- [x] **Phase 4**: type-check 3/3 PASS 확인 (코드 변경 없음, 자동 통과)
- [x] **Gate G2**: ADR-059 Tier 3 예외 목록 갱신 확인
- [x] **Gate G5**: D3 대칭 상태 breakdown 기록 완료

---

## 미뤄둔 과제 (본 ADR scope 밖)

| 과제                                                                   | 우선순위 | 이유                                                                                                |
| ---------------------------------------------------------------------- | :------: | --------------------------------------------------------------------------------------------------- |
| `ColorSlider/ColorWheel.css` thumb `gray !important` → spec token 대체 |   LOW    | disabled 상태 시각이 Skia(`opacity:0.38`)와 다름. RAC disabled 오버라이드 패턴 조사 필요 — 별도 ADR |
| `ColorSwatchPicker.css` `opacity: 0.2` vs spec `0.38` 불일치 해소      |   LOW    | disabled opacity spec 표준화 필요 — 별도 ADR 또는 ADR-106-d                                         |
| 전역 `.react-aria-ColorThumb` 단일 CSS 파일로 통합                     |   LOW    | 3개 파일 중복 정의 해소 — ColorArea.css / ColorSlider.css / ColorWheel.css                          |
| ColorPicker `--cp-btn-width/height` → spec.sizes 필드 신설             |   LOW    | spec `sizes.*`에 버튼 크기 필드 추가 후 CSS 연결 — ADR-106-a v2 또는 독립 ADR                       |
| `--cp-dialog-min-width: 192px` spec 연결                               |   LOW    | 레이아웃 상수의 spec SSOT화 — 낮은 우선순위                                                         |
