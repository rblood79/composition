# ADR-141 구현 상세 — react-aria-starter 참조 스타일의 Spec D3 반영

> 본 문서는 [ADR-141](../141-rac-starter-spec-style-sync.md) 의 구현 상세. 결정 근거·대안·위험은 ADR 본문 참조.

## 1. 작성 맥락 (fork 아님 확인)

본 ADR 은 base/응용 fork 가 아니라 **신규 initiative ADR** 이다. ADR-063(SSOT charter)·ADR-140(press-scale)을 prerequisite 로 참조하되 어느 ADR 도 재오픈하지 않는다. ADR-140 은 P2 패턴의 부분 선례(press-scale 단일 축)이고, ADR-141 은 6 패턴 전체를 다룬다.

- Phase 0 인벤토리: [2026-05-18-rac-starter-spec-style-diff.md](../../reference/audits/2026-05-18-rac-starter-spec-style-diff.md) (HIGH 18 + MED 27 + LOW ~20, 6 패턴).
- 부수 참고: [2026-05-18-spec-ssot-inventory.md](../../reference/audits/2026-05-18-spec-ssot-inventory.md) (skipCSSGeneration 33 분류 — 본 ADR 직접 대상 아님).

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

- P1: SearchField·Tag·ColorSwatch·ColorSwatchPicker·icon-only Button/ToggleButton 을 starter pill(`9999px`) 로 통일할 것인가, composition `radius-md/lg` 유지할 것인가.
- P3: Switch thumb·Slider/ProgressBar/Meter fill 에 입체 box-shadow 를 도입할 것인가.

결정 기준: composition 디자인 시스템 오너의 의도 확인. 미결 시 본 ADR 의 P1/P3 Phase 는 착수하지 않는다 (R3 대응).

## 3. Phase 구성

| Phase       | 범위                                  | 패턴  | Gate    |
| ----------- | ------------------------------------- | ----- | ------- |
| **Phase 0** | 감사 (완료)                           | —     | —       |
| **Phase 1** | P2 micro-interaction 채택             | P2    | G1 + G2 |
| **Phase 2** | P6 상태 누락 채택                     | P6    | G1 + G2 |
| **Phase 3** | P4 치수 개별 채택 (의도 항목 제외)    | P4    | G1 + G2 |
| **Phase 4** | P5 구조 — Generator 능력 확인 후 개별 | P5    | G1 + R2 |
| **Phase 5** | P1/P3 — 디자인 결정 후에만 착수       | P1·P3 | G3      |

Phase 1→2→3 은 순차. Phase 4 는 R2(Generator emit 능력) 확인 결과에 종속. Phase 5 는 G3(디자인 결정) 통과 전 미착수.

## 4. 컴포넌트별 delta 매핑

HIGH 18 + MED 27 의 항목별 starter/composition `file:line` 은 감사 문서 §1·§2 에 수록. Phase 매핑:

- **Phase 1 (P2)**: H16·H17 Disclosure(chevron rotate / panel height), H18 ProgressBar(fill 애니메이션 일부), MED TabPanel 전환·Checkbox checkmark draw·ToggleButtonGroup pressed.
- **Phase 2 (P6)**: H5 Link underline, H7 DropZone drop-target, MED Form `[role=alert]`·ListBox/Tree selected divider.
- **Phase 3 (P4)**: H10 DateRangePicker `[slot=end]` margin, H12·H13 Dialog/Popover padding(의도 검토), H14·H15 Modal radius/max-width, MED track-height·Tooltip padding 등.
- **Phase 4 (P5)**: H3·H4 ToggleButtonGroup overlap/radius, H8·H9 RangeCalendar range-band/inner-span, MED Menu 구조.
- **Phase 5 (P1·P3)**: H1·H2 icon-only 원형, H6 SearchField pill, H11 Tag pill + H18 ProgressBar 3d / MED Switch·Slider·Meter box-shadow.

## 5. BC 영향 수식화 (R4 대응)

| Phase           | 시각 변경 컴포넌트                                        | BC 성격                                                 |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Phase 1 (P2)    | Disclosure·TabPanel·Checkbox·ProgressBar (~5)             | 신규 애니메이션 추가 — 정적 스냅샷 BC 없음, 동작만 추가 |
| Phase 2 (P6)    | Link·DropZone·Form·ListBox·Tree (~5)                      | 신규 상태 스타일 추가 — 기존 상태 무변경                |
| Phase 3 (P4)    | Dialog·Modal·Popover·DateRangePicker 등 (~10)             | 치수 변경 — 기존 프로젝트 레이아웃 미세 이동 가능       |
| Phase 5 (P1·P3) | SearchField·Tag·ColorSwatch·Button·Switch·Slider 등 (~12) | 형태/입체감 변경 — 전 기존 프로젝트 시각 회귀           |

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

- Table 패밀리 — 본 ADR 범위 외 (별도 아키텍처 검토).
- CSSGenerator 형제 selector emit 능력 — Phase 4 착수 전 확인. 미지원 시 해당 P5 delta 는 수동 CSS 경로 또는 보류.
- P1/P3 디자인 결정 — 본 ADR 외부 (디자인 시스템 오너 confirm).
