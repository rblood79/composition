# ADR-086 Breakdown — implicitStyles size Record 해체 + Breadcrumb child layout SSOT 복귀

> ADR: [086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md](../completed/086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md)

## Phase 구성

| Phase  | 내용                                                                                                    | 소요 | Gate     |
| :----: | ------------------------------------------------------------------------------------------------------- | :--: | -------- |
| **P1** | spec.sizes 누락 필드 감사 및 보강 (Calendar padding/gap / SelectTrigger height 등)                      | 0.5h | G1/G2    |
| **P2** | `SPEC_INPUT_FONT_SIZE`/`SPEC_TRIGGER_HEIGHT`/`calPadGap` Record 를 `spec.sizes` lookup 으로 전환        | 0.8h | G1/G2    |
| **P3** | `spec.render.shapes` signature 에 optional `ctx?: { measureText }` 확장 + type 정의 + 기존 spec BC 확인 | 0.5h | G1       |
| **P4** | `Breadcrumb.spec.ts` `render.shapes` 에 itemWidth/height 계산 이관 (measureText 사용)                   | 0.8h | G1/G3    |
| **P5** | `implicitStyles.ts:955-971` Breadcrumb child 주입 제거 + parent `children` 순회만 유지                  | 0.4h | G1/G3/G4 |
| **P6** | Chrome MCP 실측 + ADR Status Implemented                                                                | 0.6h | G3       |

- P2 FAIL (R2 spec.sizes 누락) → P1 보강 재시도
- P5 FAIL (R3 child render 경로 회귀) → P5 revert, Phase 4 까지 land + 대안 B (후속 ADR) 전환

총 예상: 3.6h — 2 세션 분할 권장 (세션 A: P1+P2+검증 / 세션 B: P3+P4+P5+P6)

## 파일 변경표

| 파일                                                                               | Phase | 변경                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | :---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/components/SelectTrigger.spec.ts`                              |  P1   | `sizes.xs/sm/md/lg/xl.height` 확인 및 누락 보강 (현재 SPEC_TRIGGER_HEIGHT 기준)                                                                                                                                                                                                                                                          |
| `packages/specs/src/components/Calendar.spec.ts`                                   |  P1   | `sizes.sm/md/lg.paddingX/paddingY/gap` 확인 (현재 calPadGap 기준 4/8/12, 4/6/8)                                                                                                                                                                                                                                                          |
| `packages/specs/src/components/ProgressBar.spec.ts` / `Meter.spec.ts`              |  P1   | `sizes.sm/md/lg/xl.fontSize` + `lineHeight` resolved 값 감사 (PROGRESSBAR_FONT_SIZE 4 size 12/14/16/18 + SIZE_LINE_HEIGHT 16/20/24/28) — Revision 2 **4 size 정정**                                                                                                                                                                      |
| `packages/specs/src/components/DateField.spec.ts` / `TimeField.spec.ts`            |  P1   | `sizes.sm/md/lg/xl.height` 4 size 감사 (Rev 2 편입 + **Rev 3 xl 포함 정정** — `SPEC_TRIGGER_HEIGHT` 소비처)                                                                                                                                                                                                                              |
| `packages/specs/src/components/SearchField.spec.ts`                                |  P1   | `sizes.sm/md/lg/xl.height` + `fontSize` 4 size 감사 (Rev 2 편입 + **Rev 3 xl 포함 정정** — `SPEC_TRIGGER_HEIGHT` + `SPEC_INPUT_FONT_SIZE` 동시 소비)                                                                                                                                                                                     |
| `packages/specs/src/components/Slider.spec.ts` / `SliderTrack.spec.ts`             |  P1   | `sizes.sm/md/lg/xl` 4 size 감사 — **`fontSize`** (SLIDER_FONT_SIZE 12/14/16/18) + **`gap`** (SLIDER_COL_GAP 16/... — Rev 4 신규) + **`height`** (SLIDER_TRACK_LAYOUT_HEIGHT 14/... — Rev 4 SliderTrack) + **`lineHeight` 필드 부재 → 신규 필드 추가** (Rev 4 명시 — SliderOutput 소비)                                                   |
| `packages/specs/src/components/SelectIcon.spec.ts` 또는 `spec.sizes.iconSize` 체계 |  P1   | SelectTrigger/ComboBoxWrapper/SearchFieldWrapper 의 icon size 소비 (`:1313/:1394/:1548`) → `SPEC_ICON_SIZE` (Rev 4 신규) 대체 spec 필드 확인 또는 신규 보강                                                                                                                                                                              |
| `packages/specs/src/components/ProgressBarTrack.spec.ts` / `MeterTrack.spec.ts`    |  P1   | `sizes.sm/md/lg/xl.height` (barHeight) 감사 — PROGRESSBAR_BAR_HEIGHT 소비처 (`:1622`, Rev 4 신규)                                                                                                                                                                                                                                        |
| `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`       |  P2   | **10 상수 제거** (Rev 4 완전 폐쇄): `SPEC_ICON_SIZE` / `SPEC_INPUT_FONT_SIZE` / `SPEC_TRIGGER_HEIGHT` / `PROGRESSBAR_BAR_HEIGHT` / `PROGRESSBAR_FONT_SIZE` / `SIZE_LINE_HEIGHT` / `SLIDER_COL_GAP` / `SLIDER_TRACK_LAYOUT_HEIGHT` / `SLIDER_FONT_SIZE` / `calPadGap`. 8 소비처 분기 모두 `TAG_SPEC_MAP[tag].sizes[sizeName]` lookup 사용 |
| `packages/specs/src/types/spec.types.ts`                                           |  P3   | `ComponentSpec.render.shapes` signature 에 optional `ctx?: SpecRenderContext` 추가. `SpecRenderContext = { measureText?: (...) => number }`                                                                                                                                                                                              |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`                |  P3   | `measureTextWidth` 을 `SpecRenderContext.measureText` 로 wrap 가능한 구조 확인                                                                                                                                                                                                                                                           |
| `packages/specs/src/components/Breadcrumb.spec.ts`                                 |  P4   | `render.shapes` 에서 `ctx.measureText` 호출로 itemWidth 계산. parent props 소비 (`label`, `size`, `isLast`)                                                                                                                                                                                                                              |
| `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`       |  P5   | `:955-971` Breadcrumb child 주입 삭제 (width/minWidth/height/minHeight/display/flexDirection/alignItems/flexShrink/flexGrow)                                                                                                                                                                                                             |

## 체크리스트

### Phase 1 — spec.sizes 감사 및 보강 (Revision 4 확장)

- [ ] SelectTrigger.sizes.xs/sm/md/lg/xl.height = SPEC_TRIGGER_HEIGHT 와 동일 값 확인
- [ ] SelectTrigger/ComboBoxWrapper/SearchFieldWrapper.sizes.\*.iconSize = SPEC_ICON_SIZE 와 동일 값 확인 (**Rev 4 신규** — spec.sizes.iconSize 필드 이미 존재 확인)
- [ ] Calendar.sizes.sm/md/lg.paddingX/paddingY/gap = calPadGap 와 동일 값 확인
- [ ] ComboBoxWrapper/기타 SPEC_INPUT_FONT_SIZE 소비처 spec.sizes.fontSize TokenRef resolved 값 일치 확인
- [ ] **ProgressBar/Meter.sizes.sm/md/lg/xl.fontSize resolved = PROGRESSBAR_FONT_SIZE 4 size (12/14/16/18) 일치 확인**
- [ ] **ProgressBar/Meter.sizes.sm/md/lg/xl.lineHeight = SIZE_LINE_HEIGHT (16/20/24/28) 일치 확인**
- [ ] **ProgressBarTrack/MeterTrack.sizes.sm/md/lg/xl.height = PROGRESSBAR_BAR_HEIGHT 일치 확인** (Rev 4 신규 — `:1622` 소비)
- [ ] **DateField/TimeField.sizes.sm/md/lg/xl.height 4 size 감사** (Rev 2 편입 + Rev 3 xl 포함)
- [ ] **SearchField.sizes.sm/md/lg/xl.height + fontSize 4 size 감사** (Rev 2 편입 + Rev 3 xl 포함)
- [ ] **Slider.sizes.sm/md/lg/xl.fontSize resolved = SLIDER_FONT_SIZE (12/14/16/18) 일치 확인**
- [ ] **Slider.sizes.sm/md/lg/xl.gap = SLIDER_COL_GAP 일치 확인** (Rev 4 신규 — `:1678` 소비, 기존 spec.sizes.gap 필드 활용)
- [ ] **SliderTrack.sizes.sm/md/lg/xl.height = SLIDER_TRACK_LAYOUT_HEIGHT 일치 확인** (Rev 4 신규 — `:1726` 소비, SliderTrack 별도 spec)
- [ ] **Slider.sizes.\*.lineHeight 필드 부재 → 신규 필드 추가 선행** (Rev 4 명시 — SliderOutput 이 SIZE_LINE_HEIGHT 소비. `spec.types.ts SizeSpec.lineHeight?: TokenRef | number` 확장 후 Slider spec 에 값 선언)
- [ ] 누락 발견 시 spec.sizes 에 추가 (type 변경 시 BC 고려 — lineHeight 는 optional 신규 필드)

### Phase 2 — Record 해체 (G2 spec.sizes pixel-perfect, Revision 4 완전 폐쇄)

- [ ] **`SPEC_ICON_SIZE` 소비처 3곳** (SelectTrigger `:1313` + ComboBoxWrapper `:1394` + SearchFieldWrapper `:1548`) → `TAG_SPEC_MAP[tag].sizes[sizeName]?.iconSize` (Rev 4 신규)
- [ ] `SPEC_INPUT_FONT_SIZE` 소비처 (ComboBoxWrapper `:1333-` + SearchFieldWrapper `:1538`) → `spec.sizes[size].fontSize`
- [ ] `SPEC_TRIGGER_HEIGHT` 소비처 (SelectTrigger `:1273-1275` + DateField/TimeField `:1448` + SearchFieldWrapper `:1511`) → `TAG_SPEC_MAP[tag].sizes[sizeName]?.height`
- [ ] **`PROGRESSBAR_BAR_HEIGHT` 소비처 (`:1622` PROGRESSBAR_TAGS Track 주입) → `ProgressBarTrackSpec.sizes[sizeName]?.height`** (Rev 4 신규)
- [ ] `calPadGap` 소비처 (`:1859` Calendar) → `CalendarSpec.sizes[calSize]?.{ paddingX, paddingY, gap }`
- [ ] **`PROGRESSBAR_FONT_SIZE` 소비처 (`:1569-1653`) → `TAG_SPEC_MAP[tag].sizes[sizeName]?.fontSize` resolve**
- [ ] **`SIZE_LINE_HEIGHT` 소비처** — PROGRESSBAR_TAGS + Slider SliderOutput `:1747` → `spec.sizes[size].lineHeight` (Rev 4 spec 필드 선행 필수)
- [ ] **`SLIDER_COL_GAP` 소비처 (`:1678` Slider 분기) → `SliderSpec.sizes[sizeName]?.gap`** (Rev 4 신규)
- [ ] **`SLIDER_TRACK_LAYOUT_HEIGHT` 소비처 (`:1726` Slider 분기) → `SliderTrackSpec.sizes[sizeName]?.height`** (Rev 4 신규)
- [ ] **`SLIDER_FONT_SIZE` 소비처 (Slider Label `:1707` + SliderOutput `:1745`) → `SliderSpec.sizes[sizeName]?.fontSize` resolve**
- [ ] **Record 상수 10 개 전수 제거** (Rev 4 완전 폐쇄):
  - `:166-171` SPEC_ICON_SIZE (Rev 4)
  - `:175-180` SPEC_INPUT_FONT_SIZE
  - `:184-189` SPEC_TRIGGER_HEIGHT
  - `:204-209` PROGRESSBAR_BAR_HEIGHT (Rev 4)
  - `:211-217` PROGRESSBAR_FONT_SIZE
  - `:220-225` SIZE_LINE_HEIGHT
  - `:243-247` SLIDER_COL_GAP (Rev 4)
  - `:251-256` SLIDER_TRACK_LAYOUT_HEIGHT (Rev 4)
  - `:259-264` SLIDER_FONT_SIZE
  - `:1854-1858` calPadGap
- [ ] `rg "Record<string, number>" implicitStyles.ts` 결과 **빈 배열** 확인 (inventory 전수 폐쇄 증빙)
- [ ] `pnpm -w type-check` + `builder` 217/217 + `specs` 166/166 PASS
- [ ] **G2 Chrome MCP 실측 primary (8 소비처 전수)**: Calendar 3 size + SelectTrigger 5 size + ComboBoxWrapper 5 size + ProgressBar/Meter 4 size + DateField 4 size + TimeField 4 size + SearchField 4 size + Slider 4 size pixel-perfect 확인

### Phase 3 — spec.render signature 확장

- [ ] `SpecRenderContext` type 정의 (spec.types.ts)
- [ ] `ComponentSpec.render.shapes` 3번째 optional param 추가 `(props, size, state, ctx?)`
- [ ] 62 spec render 함수 BC 확인 — ctx 미사용, type-check PASS
- [ ] nodeRenderers.ts 등 호출부에서 ctx 주입

### Phase 4 — Breadcrumb.spec render 이관

- [ ] Breadcrumb.spec.ts render.shapes 에서 `ctx.measureText(label, fontSize, fontFamily, fontWeight)` 호출
- [ ] itemWidth = Math.ceil(textW + sepExtra) 계산 유지 (로직 동일, 위치만 spec.render 로 이동)
- [ ] Breadcrumb spec 이 `size`, `isLast`, `separator`, `separatorPadding` 같은 props 를 받도록 interface 확장

### Phase 5 — implicitStyles child 주입 제거 (G3)

- [ ] `:955-971` child Breadcrumb style 주입 제거
- [ ] Breadcrumbs parent 분기는 sorted 순회 + layout trigger 만 담당 (effectiveParent 유지)
- [ ] Breadcrumb child 의 spec.render 결과가 ElementSprite layout 파이프라인에 정상 전달됨을 확인
- [ ] child 주입 제거 후에도 Breadcrumbs 전체 레이아웃 재현 확인

### Phase 6 — 실측 + Status

- [ ] Chrome MCP Calendar sm/md/lg 3 size padding/gap 시각 동일 (G2)
- [ ] Chrome MCP SelectTrigger xs/sm/md/lg/xl 5 size height 시각 동일
- [ ] Chrome MCP Breadcrumbs 3 size × 3 label 변이 (short "Home" / medium "Dashboard" / long "Administrator Settings") 9 샘플 시각 정상 (G3)
- [ ] ADR Status Proposed → Implemented

## 커밋 계획

| 순서 | 커밋                                                                    | Phase |
| :--: | ----------------------------------------------------------------------- | :---: |
|  1   | `chore(adr-086): P1 spec.sizes 감사 + 누락 필드 보강`                   |  P1   |
|  2   | `feat(adr-086): P2 implicitStyles size Record → spec.sizes lookup 전환` |  P2   |
|  3   | `feat(adr-086): P3 spec.render SpecRenderContext 확장 (optional)`       |  P3   |
|  4   | `feat(adr-086): P4 Breadcrumb.spec render.shapes 에 itemWidth 이관`     |  P4   |
|  5   | `feat(adr-086): P5 implicitStyles Breadcrumb child 주입 제거`           |  P5   |
|  6   | `docs(adr-086): Status Proposed → Implemented`                          |  P6   |

## 롤백 전략

- **Phase 2 FAIL** (G2 pixel-perfect 실패) → Phase 2 커밋 revert. Phase 1 spec.sizes 보강은 유지 (BC 안전 개선)
- **Phase 4/5 FAIL** (G3 시각 변화) → Phase 5 revert → 분기 유지 + Phase 4 Breadcrumb.spec 은 유지 가능 (ctx 미소비시 무해)
- **대안 B 전환** — Phase 3~5 전체 revert + 본 ADR Status Partial-Implemented + 후속 ADR (Breadcrumb child 단독)

## 후속 ADR 후보

- `measureText` hook 확장 consumer: Tabs label 폭 / Select max option width / Menu 가로 정렬
- size-based 로직의 다른 consumer (Card/Section) SSOT 복귀
