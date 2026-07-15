# ADR-151 Design Breakdown: 빌더 잔여 CSS↔Skia 발산·잠재 결함 일소

> 본 문서는 [ADR-151](../151-builder-residual-parity-defect-remediation.md)의 구현 상세입니다.
> ADR 본문은 결정만 기록하고, Phase 목록 / 파일 변경표 / 체크리스트는 여기에만 둡니다.
>
> **상태: 착수 금지 (사용자 지시 2026-07-16)** — 본 문서는 계획 확정 전 설계 자료이며, Phase 실행은 사용자 승인 후 시작한다.

## 1. 버그 인벤토리 (2026-07-16 기준 실측·검증 결과)

### 1-A. 라이브 실측 잔여 발산 (2026-07-13/14 sweep 실측, 이후 미수정 확인)

출처: 44종 battery 라이브 sweep (테스트 프로젝트 `adr916-parity-sweep`). dw/dh = Skia − CSS 오차(px).

| #   | 컴포넌트          | 실측 오차              | 추정 원인 축                                                                                      | 규모 |
| --- | ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------- | ---- |
| B1  | Calendar          | dw+22 / dh+18          | CalendarGrid 셀 메트릭 (셀 폭·행 높이 산출이 DOM 실측과 불일치)                                   | 대형 |
| B2  | RangeCalendar     | dw+40 / dh+42          | B1 과 동일 축 (2-month grid 로 오차 2배 증폭)                                                     | 대형 |
| B3  | Card              | dh-3                   | card-description 폰트 상속 16/24 vs catalog Description 14/20 — 3경로 동기화 필요                 | 중형 |
| B4  | Link              | dh-5                   | 텍스트 leaf 메트릭 (lineHeight 산출 경로)                                                         | 중형 |
| B5  | Tree              | dh+6                   | **재현 불가 — explicit-height 주입 경로 미해명** (조사 우선)                                      | 중형 |
| B6  | Tabs              | TabPanels padding 잔여 | TabPanels padding 3경로 비대칭                                                                    | 중형 |
| B7  | Menu              | 표현 자체 발산         | factory `width:100%` 목록 표현 vs Skia 렌더러 트리거 chip — **설계 판단 보류 (사용자 결정 지점)** | 중형 |
| B8  | Table             | dh-2                   | 소형 — 허용 오차 판정 대상                                                                        | 소형 |
| B9  | StatusLight       | dh+3                   | 소형 — 허용 오차 판정 대상                                                                        | 소형 |
| B10 | ToggleButton      | dh+2.5                 | 소형 — 허용 오차 판정 대상                                                                        | 소형 |
| B11 | ToggleButtonGroup | dw+2.8                 | 소형 — 허용 오차 판정 대상                                                                        | 소형 |
| B12 | Badge             | dh+2                   | 소형 — `a3656130a` (Icon/Badge propPassthrough) 반영 후 재실측 필요                               | 소형 |
| B13 | Checkbox          | dw 소폭                | 소형 — 허용 오차 판정 대상                                                                        | 소형 |

### 1-B. fresh factory 기본 폭 분류 비대칭 (회귀 아님 — 재구축 battery 에서만 노출)

구 battery 는 수동 폭 튜닝으로 가려져 있었고, factory 기본값으로 새로 생성한 요소에서 노출된다.

| #   | 컴포넌트                     | 증상                                  | 원인 축                                   |
| --- | ---------------------------- | ------------------------------------- | ----------------------------------------- |
| B14 | Disclosure / DisclosureGroup | width fit-content ↔ stretch 분류 발산 | 폭 분류 (INLINE_BLOCK / fit-content 판정) |
| B15 | Heading / Text               | width 발산                            | 텍스트 leaf 폭 분류                       |
| B16 | Separator                    | Skia width 0                          | Skia 경로 기본 폭 미산출                  |
| B17 | RadioGroup                   | 오차 6.7                              | 그룹 컨테이너 폭 산출                     |

### 1-C. 코드 실측 확인 잠재 결함 (노출 경로 좁음 — 활성화 조건 정의 후 수정/보류 판정)

| #   | 결함                                | 실측 근거 (2026-07-16 확인)                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B18 | fontVariant 텍스트 측정 비대칭      | `canvas2dSegmentCache.ts:392 needsFallback()` 이 `fontVariant` 미검사 + `buildFontString()` 이 font 문자열에 fontVariant 미포함 → Canvas 2D 측정 경로(`USE_CANVAS2D_MEASURE=true` 기본)가 fontVariant 를 무시. CanvasKit 렌더(`canvaskitTextMeasurer.ts:229 resolveFontVariantFeatures`)는 적용 → 측정↔렌더 폭 불일치 가능. 단 패널 UI 에 fontVariant 편집 경로 없음 — 노출 조건 좁음 |
| B19 | position:fixed 카메라 역보정 미활성 | `renderCommands.ts:824` — "camera 역보정 인프라 (TODO: cameraX/Y 파라미터 수신 후 활성화)". fixed 요소가 pan/zoom 시 viewport 고정으로 렌더되지 않음                                                                                                                                                                                                                                  |
| B20 | useStyleSource parent 체크 미구현   | `useStyleSource.ts:57` TODO — 부모 요소 style 소스 미확인 → 스타일 소스 배지가 상속값에 대해 부정확 표시 가능                                                                                                                                                                                                                                                                         |

### 1-D. stale 판정 (이번 ADR 제외 — 인벤토리 정정 기록)

| 항목                                                                           | 판정                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button catalog height=0 sentinel 붕괴 진단                                     | **비활성** — `utils.ts deriveSizeConfig()` (644행) 가 `height` 필드를 결과에 매핑하지 않아 `configHeight` 는 항상 undefined → 자연 높이 경로 사용. 메모리 `project-button-configheight-zero-sentinel-collapse` 는 정정 대상 |
| ADR-100 구 이슈 (GridListItem overflow / TagGroup Show all / body 색 하드코딩) | 기록 시점 이후 엔진 교체(ADR-916)·chip projection(ADR-912)·테마 override 도입으로 **stale 가능성 높음** — Phase 0 재실측에서 재현되는 것만 인벤토리에 편입                                                                  |
| instanceActions `set` 1차 잔존                                                 | ADR-122 §Residual 에 기록된 의도된 보류 — 본 ADR 범위 제외                                                                                                                                                                  |

## 2. 허용 오차 판정 기준 (Decision 보조 — ADR 본문 §Decision 의 기준 상세)

1. **±2px 이내 + 원인이 텍스트 측정 엔진 차이(Canvas 2D↔CanvasKit↔브라우저)로 규명된 경우**: 수용 (ADR-042 사용자 결정 승계). 수용 항목은 golden 기대값에 오차 포함해 고정.
2. **원인 미상 오차는 크기 무관 수용 금지**: 원인 규명 후에만 수용/수정 판정 (B5 Tree dh+6 류).
3. **±3px 초과 또는 폭 분류(카테고리성) 발산**: 무조건 수정 대상.

## 3. Phase 계획

> 각 Phase 는 commit 가능한 상태로 종료 (CLAUDE.md phase 분할 원칙). 완료 선언은 live behavior exercise (Chrome MCP 실측) 필수 — test/type-check 단독 종결 금지.

### Phase 0: 재실측 인벤토리 freeze

- battery 재구축 (메모리 `project-adr916-post-cutover-parity-sweep-inventory` §battery 재구축 패턴 + `window.__composition_LAYOUT_DEBUG__` 하니스 재사용)
- B1~B17 전 항목 dw/dh 재실측 — 07-14 이후 수정분 (`a3656130a` 등) 반영 상태 확정
- ADR-100 구 이슈 3건 재현 시도 → 재현분만 편입
- 산출물: 본 문서 §1 표의 실측치 갱신 + 수정/수용/보류 1차 분류

### Phase 1: 대형 발산 — Calendar / RangeCalendar (B1, B2)

- CalendarGrid 셀 메트릭 산출 경로 (`calculateContentHeight` calendar 분기 + catalog CalendarGrid/CalendarCell sizes) 를 DOM 실측 기반으로 정렬
- 선행 참조: `feedback-calendar-width-fit-content-3-layer-and-2pass-residual` (width 3계층 수정 이력 — 동일 계층 구분 적용)
- 검증: cross-check (Calendar, RangeCalendar) + tree_golden 케이스 추가

### Phase 2: 중형 — 텍스트 메트릭 계열 (B3, B4, B6) + Tree 조사 (B5)

- B3 Card: card-description 폰트를 catalog Description(14/20) 과 3경로 (generated CSS / Skia / layout) 동기화 — `pnpm generate:css` 동반
- B4 Link: 텍스트 leaf lineHeight 경로 (`extractSpecTextStyle` 등록 여부) 확인 후 정렬
- B6 Tabs: TabPanels padding 3경로 대조
- B5 Tree: dh+6 재현 조건 규명 (explicit-height 주입 경로 추적) — 규명 결과에 따라 수정 또는 §2 기준 수용
- 검증: cross-check 각 컴포넌트

### Phase 3: fresh factory 폭 분류 계열 (B14~B17)

- fit-content ↔ stretch 분류를 컴포넌트별 DOM 실측 기준으로 재분류 (07-13 1차 수정의 Switch/StatusLight/Breadcrumbs 패턴 — `INLINE_BLOCK_TAGS` / getDefaultProps / inline-flex CSS 3축)
- Separator Skia width 0 은 별도 원인 (Skia 경로 기본 폭) — RAC aria-orientation 미방출 계약 (07-14 수정) 과 교차 확인
- **BC 확인**: factory 기본값 변경은 신규 생성 요소에만 적용 — 기존 프로젝트 저장 요소는 props.style 이 이미 직렬화되어 무영향 (Phase 0 에서 기존 요소 1건 로드로 확증)

### Phase 4: 소형 오차 판정 (B8~B13)

- §2 기준 적용: 원인 규명 → ±2px 이내 텍스트 측정 기인이면 수용 처리 (golden 기대값 고정), 아니면 수정
- 수용/수정 판정 결과를 본 문서에 기록 (판정 근거 1줄씩)

### Phase 5: 잠재 결함 (B18~B20)

- B18 fontVariant: 노출 경로 (패널 미노출) 재확인 → 방어 수정 (`needsFallback` 에 fontVariant 검사 1줄) 또는 명시 보류 판정
- B19 position:fixed: preview/publish 에서 fixed 사용 가능 여부 확인 → 사용 가능하면 cameraX/Y 배선, 불가하면 보류 판정 기록
- B20 useStyleSource: 스타일 소스 배지 정확도 — 소규모 수정 또는 보류 판정
- 본 Phase 는 전 항목 "수정 없이 보류" 종결 가능 (과잉 변경 금지 원칙)

### Phase 6: 재발 방지 + 종결

- tree_golden battery 에 Phase 1~4 수정 컴포넌트 케이스 추가 (Chrome 실측 golden — 독립 oracle 원칙, `feedback-dual-run-diff-zero-blind-to-uncovered-input-dimension`)
- sweep 하니스 최종 1회 실행 — 잔여 오차 전수 기록 (수용 판정 포함)
- CHANGELOG 반영 + ADR Implemented 승격 (live behavior 검증 블록 명시)

### 사용자 결정 대기 항목 (Phase 밖)

- **B7 Menu 표현**: factory 목록 표현 vs 렌더러 트리거 chip — 어느 쪽이 정본인지는 제품 표현 결정 (scope 결정 지점). Phase 진행과 무관하게 사용자 확인 후 별도 처리.

## 4. 파일 변경 예상 (Phase 0 재실측 후 확정)

| 영역            | 예상 파일                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------- |
| 레이아웃 메트릭 | `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (calendar/text leaf/그룹 분기) |
| catalog         | `packages/shared/src/catalog/generated/componentRulesTable.ts` (+ `pnpm generate:css` 재생성)      |
| 텍스트 측정     | `apps/builder/src/builder/workspace/canvas/utils/canvas2dSegmentCache.ts` (B18 한정)               |
| 렌더 커맨드     | `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts` (B19 한정)                      |
| factory         | `apps/builder/src/builder/factories/**` (B14~B17 폭 분류)                                          |
| golden          | `packages/composition-engine/**/tree_golden*` + sweep 하니스                                       |

> 추정 파일 수 대비 실측 1.5배 초과 시 M4 절차 아님 — 종결 계약 (자율 진행 + 사후 보고) 적용, 단 scope 자체 변경 (결정 지점 ④) 이면 질문.

## 5. 검증 체크리스트 (Phase 공통)

- [ ] `pnpm type-check` PASS
- [ ] 해당 컴포넌트 `/cross-check` PASS (CSS↔Skia 시각 대칭)
- [ ] Chrome MCP 라이브 실측 — dw/dh 재측정치 commit 메시지에 기록
- [ ] catalog 수정 시 `pnpm generate:css` 동반
- [ ] 수용 판정 항목은 판정 근거 1줄 + golden 기대값 고정
