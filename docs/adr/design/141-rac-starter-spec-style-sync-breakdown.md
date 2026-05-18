# ADR-141 구현 상세 — react-aria-starter 참조 스타일의 Spec D3 반영

> 본 문서는 [ADR-141](../141-rac-starter-spec-style-sync.md) 의 구현 상세. 결정 근거·대안·위험은 ADR 본문 참조.

## 1. 작성 맥락 (fork 아님 확인)

본 ADR 은 base/응용 fork 가 아니라 **신규 initiative ADR** 이다. ADR-063(SSOT charter)·ADR-140(press-scale)을 prerequisite 로 참조하되 어느 ADR 도 재오픈하지 않는다. ADR-140 은 P2 패턴의 부분 선례(press-scale 단일 축)이고, ADR-141 은 6 패턴 전체를 다룬다.

- Phase 0 인벤토리: [2026-05-18-rac-starter-spec-style-diff.md](../../reference/audits/2026-05-18-rac-starter-spec-style-diff.md) (HIGH 18 + MED 27 + LOW ~20, 6 패턴).
- skipCSSGeneration 분류: [2026-05-18-spec-ssot-inventory.md](../../reference/audits/2026-05-18-spec-ssot-inventory.md) (33 분류). 본 ADR 은 generated CSS 미보유 skipCSSGeneration 컨테이너(Tree·TagGroup·ColorPicker·GridList·ColorArea·ColorSlider + Table)를 범위에서 제외 — ADR-059·ADR-106(charter + 후속 a/b/d)가 CSSGenerator 구조적 미지원으로 인한 G2 정당 Tier 3 예외로 이미 분류함. 단 sub-component `DisclosureContent`(H17)·`ColorSwatchPicker`(P1)는 skipCSSGeneration 이나 본 ADR 잔존, `RangeCalendar`(H8/H9)는 generated CSS 가 `index.css` 미연결 — 반영 경로는 해당 Phase 착수 시 확정(ADR 본문 §Spec 반영 경로).

## 2. 패턴별 채택 판정 상세

| 패턴                     | 추천                      | 판정 근거                                                                                                                                                          | Spec 반영 경로                                         |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **P1 형태** (pill/원형)  | **보류 — 디자인 결정**    | starter `border-radius:9999px` ↔ composition `radius-md/lg`. composition 이 일관되게 사각 계열을 쓰므로 의도적 디자인 언어일 개연성 높음. 일괄 채택/기각 양자택일. | (채택 시) VariantSpec/SizeSpec `borderRadius` TokenRef |
| **P2 micro-interaction** | **채택**                  | chevron rotate / panel height transition / checkmark draw / 패널 전환 — 기능적 피드백. ADR-140 press-scale 과 동일 계열.                                           | Spec `states` + StateEffect / generated CSS transition |
| **P3 입체 box-shadow**   | **보류 — 디자인 결정**    | Switch thumb / Slider·ProgressBar·Meter fill 의 inset/3d shadow. composition flat 이 의도면 기각. P1 과 함께 디자인 결정.                                          | (채택 시) Spec shadow 필드                             |
| **P4 치수**              | **개별 채택**             | padding/radius/max-width/track-height 숫자 격차. 단 의도 가능 항목 제외 검토 — 예: Dialog `padding:8px` 은 자식 슬롯(DialogFooter 등) 구조 탓일 수 있음.           | SizeSpec 수치                                          |
| **P5 구조**              | **개별 — cross-check 후** | ToggleButtonGroup overlap / RangeCalendar range-band / Menu grid-subgrid. Generator emit 능력(R2) 확인 필요.                                                       | render.shapes + CSSGenerator                           |
| **P6 상태 누락**         | **채택**                  | drop-target / `[role=alert]` / selected divider — 단순 기능 누락.                                                                                                  | Spec states / generated CSS                            |

### P1/P3 디자인 결정 항목 (G3 Gate 대상)

채택 전 explicit confirm 필요:

- P1: SearchField·ColorSwatch·ColorSwatchPicker·icon-only Button/ToggleButton 을 starter pill(`9999px`) 로 통일할 것인가, composition `radius-md/lg` 유지할 것인가. (Tag pill 은 TagGroup 범위 제외로 ADR-059 후속 이관.)
- P3: Switch thumb·Slider/ProgressBar/Meter fill 에 입체 box-shadow 를 도입할 것인가.

결정 기준: composition 디자인 시스템 오너의 의도 확인. 미결 시 본 ADR 의 P1/P3 Phase 는 착수하지 않는다 (R3 대응).

## 3. Phase 구성

| Phase       | 범위                                                                       | 패턴     | Gate    |
| ----------- | -------------------------------------------------------------------------- | -------- | ------- |
| **Phase 0** | 감사 (완료)                                                                | —        | —       |
| **Phase 1** | P2 — H16 chevron rotate 반영 / 5항목 재분류 (§4.1)                         | P2       | G1 + G2 |
| **Phase 2** | P6 — H5 Link underline / H7 DropZone drop-target 반영, 2항목 재분류 (§4.2) | P6       | G1 + G2 |
| **Phase 3** | P4 — per-item 조사 결과 기계적 채택 0건, 전수 exclude/defer (§4.3)         | P4       | G1 + G2 |
| **Phase 4** | P5 — per-item 조사 결과 기계적 채택 0건, 전수 exclude/defer (§4.4)         | P5       | G1 + R2 |
| **Phase 5** | P1·P3 G3 기각(사각/flat 유지) / Modal H14·H15 채택 (§4.5)                  | P1·P3·P4 | G3      |

Phase 1→2→3 은 순차. Phase 4 는 R2(Generator emit 능력) 확인 결과에 종속. Phase 5 는 G3(디자인 결정) 통과 전 미착수.

**반영 경로**: 범위 제외(Table + Tree·TagGroup·ColorPicker·GridList·ColorArea·ColorSlider) 후 본 ADR 타겟은 대다수가 generated CSS 보유 → Spec 수정 → `pnpm build:specs` 재생성으로 반영된다. 예외 — `DisclosureContent`(H17, Phase 1)·`ColorSwatchPicker`(P1, Phase 5)는 skipCSSGeneration sub-component 로 generated CSS 가 없어, 해당 delta 의 반영 경로(parent ADR-078 child inline-emit / skipCSSGeneration 재판정)는 해당 Phase 착수 시 확정한다. 또한 `RangeCalendar`(H8/H9, Phase 4)는 generated CSS 파일이 있으나 `index.css` 가 import 안 함(수동 `RangeCalendar.css` 가 live) → 수동/dual-CSS 경로(ADR 본문 R5).

## 4. 컴포넌트별 delta 매핑

HIGH 18 + MED 27 의 항목별 starter/composition `file:line` 은 감사 문서 §1·§2 에 수록. Phase 매핑:

- **Phase 1 (P2)**: H16 chevron rotate 반영 완료, 잔여 5항목 재분류 — §4.1 참조.
- **Phase 2 (P6)**: H5 Link underline + H7 DropZone drop-target 반영 완료, 잔여 2항목 재분류 — §4.2 참조.
- **Phase 3 (P4)**: per-item 조사 결과 기계적 채택 0건 — 전수 exclude/defer, §4.3 참조.
- **Phase 4 (P5)**: per-item 조사 결과 기계적 채택 0건 — 전수 exclude/defer, §4.4 참조.
- **Phase 5 (P1·P3)**: G3 디자인 결정 — P1·P3 기각, Modal H14·H15(Phase 3 defer 분) 채택. §4.5 참조.

### 4.1 Phase 1 (P2) 실행 결과 (2026-05-18)

per-item 조사 결과 P2 6항목 중 **H16 만 Spec 단독 반영 가능** — 나머지 5항목은 아래 사유로 재분류 (ADR 본문 R6).

| 항목                                       | 결과                       | 사유 / 후속 경로                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H16** Disclosure chevron rotate          | ✅ 반영                    | `DisclosureSpec.composition` 신설 — `staticSelectors`(`.disclosure-chevron` base svg) + `rootSelectors`(`&[data-expanded]` → `rotate:90deg`). CSSGenerator `compositionOwnsContainerBox` 정밀화 동반 — `composition` 객체 존재만으로 size emit 을 skip 하던 over-broad 조건을 layout/containerStyles/containerVariants 일 때만 skip 으로 교정. |
| **H17** Disclosure panel height transition | 재분류 — renderer-level    | `DisclosureContent` `skipCSSGeneration:true` + CSS 파일 부재 + starter 의 `--disclosure-panel-height`(RAC JS 측정 변수) 부재. 순수 Spec 수정 불가 — RAC DisclosurePanel height interpolation 도입 또는 수동 CSS 경로 = 별도 작업.                                                                                                              |
| **H18** ProgressBar fill 애니메이션        | 재분류 — P3 계열 (Phase 5) | starter `.fill` 의 상시 동작 shimmer(`@keyframes progress-fill`) + 3d box-shadow 는 상태 트리거 micro-interaction 이 아닌 장식. 감사도 H18 을 "P2/P3" 분류 — ADR Decision 의 P3 보류와 동일 계열, Phase 5 디자인 결정 대상.                                                                                                                    |
| **TabPanel** entering/exiting 전환         | 재분류 — 미확인            | `&[data-entering]`/`&[data-exiting]` rootSelectors 필요. RAC `TabPanel` 의 해당 data-attr emit 여부 미확인 — RAC 소스 확인 후 Phase 4(P5 구조) 또는 별도.                                                                                                                                                                                      |
| **Checkbox** checkmark draw                | 재분류 — 별도              | Skia 가 checkmark 를 `line` shape 2개로 렌더(SVG `<path>` 부재) → `stroke-dasharray` draw 는 Preview 전용 D3 비대칭. 수동 `Checkbox.css` 영역 + dead CSS(`stroke-dashoffset:44`, ADR-140 §5) 잔존 — composition 내부 CSS 정리와 함께 별도.                                                                                                     |
| **ToggleButtonGroup** pressed              | 불요 (no-op)               | ADR-140 §1 — 각 ToggleButton 의 `states.pressed.scale`(C1-a)로 이미 transitive 반영. 신규 작업 없음.                                                                                                                                                                                                                                           |

**H16 D3 대칭 잔존(R1)**: Skia(DisclosureHeader `icon_font`)는 transient rotate 를 렌더하지 않아 expand 시 Skia chevron 방향(`>` 고정)과 Preview(`v` 회전)가 어긋난다. ADR-140 R5(pressed Skia 비대칭 의도 수용)와 동일 계열 — Skia chevron 방향 동기화는 후속 항목.

### 4.2 Phase 2 (P6) 실행 결과 (2026-05-18)

per-item 조사 결과 P6 4항목 중 **H5·H7 만 Spec 반영 가능** — 나머지 2항목은 아래 사유로 재분류 (ADR 본문 R7).

| 항목                         | 결과                 | 사유 / 후속 경로                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H5** Link underline        | ✅ 반영              | `LinkSpec.composition.rootSelectors` 신설 — `&`(base `text-decoration:underline`) + `&[data-hovered]`(`text-decoration-thickness:1.5px`). base underline 은 Skia `render.shapes` 의 `textDecoration:"underline"` 과 대칭. `containerStyles` 는 고정 `ContainerStylesSchema` 라 text-decoration 미수용 → `rootSelectors "&"` 경유. hover 두께는 Preview 전용(R1 — ADR-140 R5 선례). |
| **H7** DropZone drop-target  | ✅ 반영              | `DropZoneSpec.composition.rootSelectors["&[data-drop-target]"]` — `background:var(--bg-inset)` + `color:var(--accent)`. Skia `render.shapes` 의 `isDropTarget` 활성 시각(bg→layer-2, text→accent)과 대칭. starter 의 `outline` 은 Skia 대응 없어 제외.                                                                                                                             |
| **Form `[role=alert]`**      | 재분류 — 의도적 발산 | composition 은 전용 `InlineAlert` 컴포넌트(`.react-aria-InlineAlert`, `role=alert`)로 alert 박스를 제공 — starter 의 form-scoped 무명 `[role=alert]` 스타일은 composition 의 의도적 발산. `.react-aria-Form [role=alert]` 추가 시 InlineAlert 와 이중 스타일 충돌. 후속 불요.                                                                                                      |
| **ListBox** selected divider | 재분류 — Skia 미대응 | starter 의 인접 selected 그룹 divider 는 `:has(+ [data-selected])` + `::after` + adjacent sibling. Skia `render.shapes` 는 item 을 독립 roundRect 로 렌더 — 대응 없음. 반영 시 Preview 전용 D3 비대칭. manual `ListBox.css`(ADR-076 §0-2 정당 예외) 영역 — 별도.                                                                                                                   |

**CSSGenerator 정밀화 동반**: Phase 1 이 `skipHeight`/`skipPadding` 게이트를 `compositionOwnsContainerBox` 로 정밀화했으나, variant CSS 게이트 2곳(`generateCSS` 의 variant 블록 / `generateBaseStyles` 의 default variant 색상)은 broad `!spec.composition` 을 유지하고 있었다. Phase 2 가 Link 에 `composition` 추가 시 Link 의 variant(primary/secondary) CSS 가 누락 → 4개 site 를 모듈 레벨 `compositionOwnsContainerBox()` 단일 헬퍼로 통합 정정 (inline 중복 2곳 포함).

**H7 base 비대칭 잔존**: generated `DropZone.css` 는 base border/background 가 부재(Skia 만 dashed border + bg 렌더). drop-target 의 border-color 변화는 base border 부재로 CSS 미반영 — H7(drop-target 상태) scope 외의 base-level 비대칭. 별도 항목.

### 4.3 Phase 3 (P4) 실행 결과 (2026-05-18)

per-item 조사 결과 P4 치수 항목 중 **기계적 채택 대상 0건** — 전수 exclude/defer (ADR 본문 R8, 사용자 결정 "문서화 종결 + 계속 진행").

| 항목                                        | 결과                        | 사유                                                                                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H12** Dialog padding (8↔40)               | exclude — 의도적 multi-size | composition Dialog 는 xs~xl padding 스케일(2/4/8/12/16) 보유. starter 단일 40px ↔ composition md 8px 비교는 multi-size vs single-size — audit §4 가 "composition 이 starter 단일 size 를 확장한 의도적 영역"으로 명시. 스케일 값 재조정은 디자인 결정 영역. |
| **H13** Popover padding (16↔8)              | exclude — 의도적 multi-size | composition Popover sm/md/lg = 12/16/20 스케일. starter 의 `[data-trigger=MenuTrigger] padding:0` 예외는 starter 의 Menu-in-Popover 아키텍처 전용 — composition 은 Menu/Select 가 독립 컴포넌트.                                                            |
| **Tooltip** padding (6/10↔4/8)              | exclude — 의도적 multi-size | composition sm/md/lg = 4-8 / 6-10 / 8-12. sm 이 starter 값(4/8)과 일치 — composition md 는 스케일 상의 한 점.                                                                                                                                               |
| **Meter·ProgressBar** track height (8↔10)   | exclude — 의도적 multi-size | `.track` height 가 `sizeSelectors` 로 xs~lg 차등(`var(--spacing-xs/sm/md/lg)`). composition 의 deliberate multi-size.                                                                                                                                       |
| **Toast** width (auto↔230)                  | exclude — 의도적 발산       | composition Toast 는 content-width + `data-position` 6종 + 5-size 모델. starter 고정 230px 와 다른 디자인.                                                                                                                                                  |
| **Separator** 두께 (1↔2)                    | exclude — 다른 디자인 모델  | composition Separator 는 variant 기반(solid/dashed/dotted/accent/neutral/surface) — starter 의 단순 `background+height:2px` 와 다른 디자인.                                                                                                                 |
| **H14·H15** Modal radius/max-width          | defer → Phase 5             | 수동 `overlays.css`(R5 dual-CSS) 의 단일값(`radius-md`, `max-width:300px`). starter(`radius-xl`, `min(500px,90vw)`)로 변경 시 전 기존 modal 가시 BC. 의도 판별 불가 — Phase 5 디자인 결정 surface 에 합류.                                                  |
| **H10** DateRangePicker `[slot=end]` margin | defer → Phase 5             | starter `margin-right:1.75rem` 은 starter Group 레이아웃 보정값. composition DateRangePicker 는 `--drp-btn-width` 자체 레이아웃 — `[slot=end]` 오버랩 여부는 런타임 검증 필요. Phase 5 surface 에 합류.                                                     |

**핵심 발견**: P4 "치수 격차" 의 대부분은 composition 이 starter 의 단일-size 컴포넌트를 deliberate multi-size 스케일로 확장한 결과다. starter 단일값 ↔ composition md 값의 직접 비교는 성립하지 않으며, 채택은 composition 의 size 스케일 자체를 재설계하는 디자인 결정이 된다. 본 §4.3 의 exclude 기준은 차기 starter 감사가 동일 항목을 재플래그하지 않도록 보존한다.

### 4.4 Phase 4 (P5) 실행 결과 (2026-05-18)

per-item 조사 결과 P5 구조 항목 중 **기계적 채택 대상 0건** — 전수 exclude/defer (ADR 본문 R9).

| 항목                                              | 결과                       | 사유                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H3·H4** ToggleButtonGroup overlap/corner-radius | exclude — 다른 디자인 모델 | starter 는 segmented-control(버튼 `margin-inline-start:-1px` 테두리 겹침 + first/last child 모서리 분리). composition ToggleButtonGroup 은 `data-indicator` indicator-mode — `SelectionIndicator` 가 선택 버튼 뒤로 슬라이딩, 버튼은 `background:transparent; border-width:0`. 버튼에 테두리가 없어 overlap(`-1px`) 자체가 무의미 — composition 의 의도적 디자인 발산. |
| **H8·H9** RangeCalendar range-band / inner-span   | defer — R2 + R5            | range-band 는 `border-top/bottom:0.5px` 형제 selector 띠 — CSSGenerator emit 불가(R2). RangeCalendar 는 `generated/RangeCalendar.css` 가 `index.css` 미연결, 수동 `RangeCalendar.css` 가 live(R5) → Spec 수정이 시각 미반영. CSSGenerator 능력 확장 또는 수동 CSS 경로 = 별도 작업.                                                                                    |
| **MED** Menu grid-subgrid                         | defer — R2                 | starter Menu 의 `grid-template-columns: subgrid` 구조 — CSSGenerator emit 불가(R2). 별도 작업.                                                                                                                                                                                                                                                                         |

**Phase 4 = R2 종속 phase**: breakdown §3 이 "Phase 4 는 R2(Generator emit 능력) 확인 결과에 종속"으로 사전 명시. R2 가 RangeCalendar range-band·Menu grid-subgrid 를 emit 불가로 확정하므로 H8/H9/Menu 의 defer 는 ADR R2 게이트의 예정된 귀결. ToggleButtonGroup 은 R2 와 무관하게 composition 디자인 발산으로 exclude.

### 4.5 Phase 5 (P1·P3 + Modal) 실행 결과 (2026-05-18)

G3 게이트 — composition 디자인 시스템 오너에게 P1 형태·P3 입체감 + Phase 3 defer 분(Modal)을 surface. 사용자 explicit 결정:

| 항목                                                                           | 결정 | 사유 / 반영                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1 형태** (icon-only Button/ToggleButton 원형, SearchField·ColorSwatch pill) | 기각 | composition 이 전 컴포넌트에서 일관되게 `radius-md/lg` 사각 계열 사용 — 의도적 디자인 언어. ADR Decision 의 "composition radius-md 가 의도면 기각" 확정. 코드 변경 0.                                                                                                                                     |
| **P3 입체 box-shadow** (Switch thumb, Slider/ProgressBar/Meter fill)           | 기각 | composition 의 flat 디자인이 의도적. H18 ProgressBar shimmer 포함 전수 기각. 코드 변경 0.                                                                                                                                                                                                                 |
| **H14·H15 Modal** radius/max-width                                             | 채택 | radius lg→xl: `ModalSpec.sizes.md.borderRadius` `{radius.xl}` + 수동 `overlays.css` `var(--radius-xl)` (R5 dual-CSS — generated/Modal.css ↔ overlays.css 양쪽 일치로 cascade 무관 보장). max-width 300px→`min(500px,90vw)`: `min()` 복합값이라 `ContainerStylesSchema` 미수용 → 수동 `overlays.css` 전용. |

**P1/P3 기각의 영속성**: 본 §4.5 + ADR Decision 의 P1/P3 항목은 차기 starter 감사가 SearchField pill·icon-only 원형·Switch/Slider 3d 등을 재플래그하지 않도록 "composition 의도적 발산" 기준으로 보존된다.

**Modal Skia 무관**: `ModalSpec.render.shapes: () => []` — Skia 는 Modal 을 렌더하지 않음(overlay portal). radius 변경은 generated `Modal.css` + 수동 `overlays.css` 의 Preview 경로에만 영향, D3 Skia↔CSS 대칭 대상 아님.

## 5. BC 영향 수식화 (R4 대응)

| Phase           | 시각 변경 컴포넌트                      | BC 성격                                                                                    |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| Phase 1 (P2)    | Disclosure (chevron rotate 1, §4.1)     | 신규 애니메이션 추가 — 정적 스냅샷 BC 없음, 동작만 추가                                    |
| Phase 2 (P6)    | Link·DropZone (2, §4.2)                 | 신규 상태/장식 스타일 추가 — 정적 스냅샷 BC 없음, 상태만 추가                              |
| Phase 3 (P4)    | 없음 (전수 exclude/defer, §4.3)         | 코드 변경 0 — 조사·문서화 phase                                                            |
| Phase 4 (P5)    | 없음 (전수 exclude/defer, §4.4)         | 코드 변경 0 — 조사·문서화 phase                                                            |
| Phase 5 (P1·P3) | Modal (radius/max-width 1) — P1·P3 기각 | Modal radius/max-width 가시 변경 — modal 1종 국소 BC. P1/P3 기각으로 형태/입체감 회귀 없음 |

Phase 1·2 는 가산적(BC 낮음), Phase 3 는 레이아웃 영향, Phase 5 는 BC 최대 — 디자인 결정 + 사용자 공지 필요.

## 6. 체크리스트 (Phase 공통)

각 Phase 착수 시:

- [ ] 대상 컴포넌트 Spec(`packages/specs/src/components/*.spec.ts`) 변경
- [ ] `pnpm build:specs` — generated CSS 재생성
- [ ] CSSGenerator snapshot 갱신 + `pnpm test` (specs)
- [ ] `pnpm type-check` 통과
- [ ] cross-check — 대상 컴포넌트 Builder Skia ↔ Preview CSS 시각 대칭 (G1)
- [ ] starter 토큰을 composition 토큰으로 내재화했는지 확인 (`--tint-*` 직접 차용 0건)
- [ ] CHANGELOG 엔트리 (Phase 완결 시)

## 7. 미해결 / 후속

- Table 패밀리 + Tree·TagGroup·ColorPicker·GridList·ColorArea·ColorSlider — 본 ADR 범위 외. ADR-059·ADR-106(charter + 후속 a/b/d)가 CSSGenerator 구조적 미지원(RAC 내부 selector·`::after`·orientation)으로 인한 G2 정당 Tier 3 예외로 이미 분류함(Color 4건 106-a / TagGroup 106-b / Tag·SearchField·Field 106-d / Table·Tree·GridList·ColorArea 는 106 charter) — `해체 후속` 이 아니라 CSSGenerator 능력 확장 ADR 의 대상. 이관 감사 항목: H11(Tag pill), MED 의 Tree selected divider·GridListItem 카드 shadow·ColorArea aspect-ratio·ColorSlider track height.
- CSSGenerator 형제 selector emit 능력 — Phase 4 착수 전 확인. 미지원 시 해당 P5 delta 는 수동 CSS 경로 또는 보류.
- P1/P3 디자인 결정 — 본 ADR 외부 (디자인 시스템 오너 confirm).
