# ADR-151 Design Breakdown: 빌더 잔여 CSS↔Skia 발산·잠재 결함 일소

> 본 문서는 [ADR-151](../151-builder-residual-parity-defect-remediation.md)의 구현 상세입니다.
> ADR 본문은 결정만 기록하고, Phase 목록 / 파일 변경표 / 체크리스트는 여기에만 둡니다.
>
> **상태: 착수 승인 (2026-07-16) — Phase 0 재실측 freeze 완료.** 실행 조건: 원인 축 그룹당 1 phase + 1 커밋 / ±2px+텍스트 측정 기인 규명 시 수용 / B7 은 AskUserQuestion / tree_golden 편입 + 그룹 완료 시 cross-check.

## 1. 버그 인벤토리 (2026-07-16 기준 실측·검증 결과)

### 1-A. 라이브 실측 잔여 발산 — **2026-07-16 Phase 0 재실측 freeze**

출처: battery 재구축 라이브 실측 (테스트 프로젝트 `adr151-parity-freeze`, 21종 fresh factory, Chrome MCP + `__composition_LAYOUT_DEBUG__.getSharedLayoutMap()` ↔ Preview iframe `[data-element-id]`). dw/dh = Skia − CSS 오차(px). 07-14 sweep 대비 변동을 병기.

| #   | 컴포넌트          | 07-16 재실측 (freeze)                                                | 07-14 stale            | 판정                                                                                                   |
| --- | ----------------- | -------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| B1  | Calendar          | dw+6 / dh+2 (Skia 262×256, CSS 256×254)                              | dw+22 / dh+18          | 축소됐으나 dw ±3 초과 → **수정 (Phase 1)**                                                             |
| B2  | RangeCalendar     | dw+24 / dh+26 (Skia 262×256, CSS 238×230)                            | dw+40 / dh+42          | 대형 유지 → **수정 (Phase 1)**. Skia 는 Calendar 와 동일 262×256 인데 CSS 는 238×230 로 상이 — 원인 축 |
| B3  | Card              | dh-3 (323 vs 326)                                                    | dh-3                   | 유지 → **수정 (Phase 2)**                                                                              |
| B4  | Link              | dw+1.5 / dh-5 (27×16 vs 25.5×21)                                     | dh-5                   | 유지 → **수정 (Phase 2)**                                                                              |
| B5  | Tree              | dh+6 (80 vs 74)                                                      | dh+6 (재현 불가)       | **fresh factory 에서 재현 성공** → 조사+수정 (Phase 2)                                                 |
| B6  | Tabs              | 0 / 0 (top-level 390×53 동일; TabPanels sk 24×24 = css)              | TabPanels padding 잔여 | **재현 불가 — 해소 판정** (07-14 이후 수정 반영 추정)                                                  |
| B7  | Menu              | DOM = trigger 버튼 61.2×30 (fit-content), Skia = 390×30              | 표현 자체 발산         | 표현 발산 확정 — factory `style.width:100%` 를 Skia 만 소비 → **사용자 결정 (AskUserQuestion)**        |
| B8  | Table             | dh-2 (400 vs 402)                                                    | dh-2                   | Phase 4 판정                                                                                           |
| B9  | StatusLight       | dw+0.1 / dh+3 (24 vs 21)                                             | dh+3                   | Phase 4 판정 (±3 경계 — 원인 규명 필수)                                                                |
| B10 | ToggleButton      | dw+2.5 (116 vs 113.5)                                                | dh+2.5                 | Phase 4 판정 (실측 축은 dw — stale 기록의 dh 표기는 오기)                                              |
| B11 | ToggleButtonGroup | dw+2.8 (160 vs 157.2)                                                | dw+2.8                 | Phase 4 판정                                                                                           |
| B12 | Badge             | dw+0.9 / dh+2 (53×22 vs 52.1×20)                                     | dh+2                   | Phase 4 판정                                                                                           |
| B13 | Checkbox          | **dw+7.6** (101 vs 93.4)                                             | dw 소폭                | ±3 초과 — 소형 아님 → **수정 승격 (Phase 4 내 수정 항목)**                                             |
| B21 | GridList (신규)   | 컨테이너 0/0 (390×216 동일) — **내부 row Skia h50/gap12 vs CSS h64** | (미기록 — 신규 발견)   | 컨테이너 일치가 내부 발산을 은폐 — row 메트릭 정렬 → **수정 (Phase 2)**                                |

### 1-B. fresh factory 기본 폭 분류 비대칭 (회귀 아님 — 재구축 battery 에서만 노출)

구 battery 는 수동 폭 튜닝으로 가려져 있었고, factory 기본값으로 새로 생성한 요소에서 노출된다.

**2026-07-16 Phase 0 재실측 — 전 항목 해소 확인** (07-14 이후 수정분 반영 결과):

| #   | 컴포넌트                     | 07-14 stale 증상                      | 07-16 재실측                                                                                               | 판정                                                   |
| --- | ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| B14 | Disclosure / DisclosureGroup | width fit-content ↔ stretch 분류 발산 | 0/0 (390×56 · 390×112 양쪽 동일)                                                                           | **해소** — golden 편입만 (Phase 6)                     |
| B15 | Heading / Text               | width 발산                            | Text 0/0 (390×24 동일). Heading 은 palette 비노출 (entryUniverse 부재, composite 자식 전용) + 양쪽 0h 대칭 | **해소/비해당**                                        |
| B16 | Separator                    | Skia width 0                          | 0/0 (390×1 양쪽 동일)                                                                                      | **해소** (07-14 `:not(.vertical)` 계약 수정 반영 확인) |
| B17 | RadioGroup                   | 오차 6.7                              | 0/0 (390×84 양쪽 동일)                                                                                     | **해소**                                               |

### 1-C. 코드 실측 확인 잠재 결함 (노출 경로 좁음 — 활성화 조건 정의 후 수정/보류 판정)

| #   | 결함                                | 실측 근거 (2026-07-16 확인)                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B18 | fontVariant 텍스트 측정 비대칭      | `canvas2dSegmentCache.ts:392 needsFallback()` 이 `fontVariant` 미검사 + `buildFontString()` 이 font 문자열에 fontVariant 미포함 → Canvas 2D 측정 경로(`USE_CANVAS2D_MEASURE=true` 기본)가 fontVariant 를 무시. CanvasKit 렌더(`canvaskitTextMeasurer.ts:229 resolveFontVariantFeatures`)는 적용 → 측정↔렌더 폭 불일치 가능. 단 패널 UI 에 fontVariant 편집 경로 없음 — 노출 조건 좁음 |
| B19 | position:fixed 카메라 역보정 미활성 | `renderCommands.ts:824` — "camera 역보정 인프라 (TODO: cameraX/Y 파라미터 수신 후 활성화)". fixed 요소가 pan/zoom 시 viewport 고정으로 렌더되지 않음                                                                                                                                                                                                                                  |
| B20 | useStyleSource parent 체크 미구현   | `useStyleSource.ts:57` TODO — 부모 요소 style 소스 미확인 → 스타일 소스 배지가 상속값에 대해 부정확 표시 가능                                                                                                                                                                                                                                                                         |

### 1-D. stale 판정 (이번 ADR 제외 — 인벤토리 정정 기록)

| 항목                                                                           | 판정                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button catalog height=0 sentinel 붕괴 진단                                     | **비활성** — `utils.ts deriveSizeConfig()` (644행) 가 `height` 필드를 결과에 매핑하지 않아 `configHeight` 는 항상 undefined → 자연 높이 경로 사용. 메모리 `project-button-configheight-zero-sentinel-collapse` 는 정정 대상                                                             |
| ADR-100 구 이슈 (GridListItem overflow / TagGroup Show all / body 색 하드코딩) | **2026-07-16 재실측 — 3건 모두 재현 불가, 미편입 확정**. GridList projection row 3건 overflow 0 (마지막 row bottom 일치) / TagGroup Label+TagList overflow 0 / Skia 렌더 파일에 white 하드코드 grep 0건 + 양쪽 body 시각 동일. 단 GridList 재실측 중 **신규 내부 발산 B21 발견** (§1-A) |
| instanceActions `set` 1차 잔존                                                 | ADR-122 §Residual 에 기록된 의도된 보류 — 본 ADR 범위 제외                                                                                                                                                                                                                              |

## 2. 허용 오차 판정 기준 (Decision 보조 — ADR 본문 §Decision 의 기준 상세)

1. **±2px 이내 + 원인이 텍스트 측정 엔진 차이(Canvas 2D↔CanvasKit↔브라우저)로 규명된 경우**: 수용 (ADR-042 사용자 결정 승계). 수용 항목은 golden 기대값에 오차 포함해 고정.
2. **원인 미상 오차는 크기 무관 수용 금지**: 원인 규명 후에만 수용/수정 판정 (B5 Tree dh+6 류).
3. **±3px 초과 또는 폭 분류(카테고리성) 발산**: 무조건 수정 대상.

## 3. Phase 계획

> 각 Phase 는 commit 가능한 상태로 종료 (CLAUDE.md phase 분할 원칙). 완료 선언은 live behavior exercise (Chrome MCP 실측) 필수 — test/type-check 단독 종결 금지.

### Phase 0: 재실측 인벤토리 freeze — ✅ 완료 (2026-07-16)

- battery 재구축 완료: 프로젝트 `adr151-parity-freeze`, 21종 (complex 15 factory + simple 6 getDefaultProps). 새로고침 후 83 요소 전부 보존 — persist 가드 정상 + factory BC 확증 (기존 직렬화 요소 로드 무영향)
- B1~B17 전 항목 재실측 완료 → §1-A/§1-B 표 freeze. 요약: **수정 유지 6건** (B1/B2/B3/B4/B5/B21) + **판정 대상 6건** (B8~B13, 단 B13 Checkbox dw+7.6 은 수정 승격) + **해소 7건** (B6/B14/B15/B16/B17) + **사용자 결정 1건** (B7)
- ADR-100 구 이슈 3건 재현 불가 — 미편입 확정 (§1-D). 신규 발견 B21 (GridList 내부 row 발산) 편입
- Phase 3 은 대상 소멸 (B14~B17 해소) → **golden 편입만 Phase 6 으로 흡수, phase 자체 skip**

### Phase 1: 대형 발산 — Calendar / RangeCalendar (B1, B2) — ✅ 완료 (2026-07-16, dw 0/dh 0)

원인 3겹 확정 + 수정:

1. **generated RangeCalendar.css 미import** (`styles/index.css:96` — "generated 없음" 주석이 허위): 컨테이너 chrome (padding 8/gap 6/border 1) 전체가 죽어 CSS 238×230. import 추가 → 256×254 (Calendar 동형)
2. **셀 메트릭 gap 오용**: layout (`utils.ts` 1.2a width + calendargrid height) 과 Skia draw (`skiaPrimitives.ts calendarMonthGrid`) 가 `sizes.gap`(컨테이너 세로 gap 값 6) 을 inter-cell 간격으로 오용 → 246×204. DOM 계약은 `td { padding: 2px }` 박스 모델 (pitch = cellSize+4, gap 없음) → cellBox 식으로 정렬 → 238×200
3. **border 1px layout 미반영**: generated CSS `border: 1px solid` 을 layout 이 모름 → catalog top-level containerStyles 에 `borderWidth: "1px"` (layout 채널 — CSS diff 0) + `CONTAINER_STYLES_FALLBACK_KEYS` allowlist 에 borderWidth 편입 (specs/builder 미러 양쪽)

- 검증: 라이브 재실측 Calendar/RangeCalendar 둘 다 **Skia 256×254 = CSS 256×254 (dw 0/dh 0)**, 자식 header/grid 238 폭 일치. vitest 226/226 (구공식 미러 테스트 3건 → DOM golden 238/200 절대값으로 갱신) + type-check PASS. generated CSS diff 0 확인
- tree_golden 케이스 추가는 Phase 6 일괄 (JS-side 수정이라 1차 oracle 은 `calendarHeaderIntrinsicSize.test.ts` 절대값 golden)

### Phase 2: 중형 — 텍스트 메트릭 계열 (B3, B4, B6) + Tree 조사 (B5)

- B3 Card: card-description 폰트를 catalog Description.sizes 정본과 3경로 (generated CSS / Skia / layout) 동기화 — 목표 수치(적용 size 축)는 Phase 0 재실측으로 확정 (catalog 실측: md 12/16 · lg 14/20, `componentRulesTable.ts:4123`). `pnpm generate:css` 동반
- B4 Link: 텍스트 leaf lineHeight 경로 (`extractSpecTextStyle` 등록 여부) 확인 후 정렬 (07-16 실측: Skia 27×16 vs CSS 25.5×21 — 높이 축 5px)
- ~~B6 Tabs~~: **Phase 0 에서 해소 확인 — 제외** (top-level 0/0 + TabPanels sk=css 24×24)
- B5 Tree: dh+6 재현 조건 규명 — **fresh factory 에서 재현됨** (Skia 390×80 vs CSS 390×74). explicit-height 주입 경로 추적 → 규명 결과에 따라 수정 또는 §2 기준 수용
- B21 GridList: 내부 row 메트릭 정렬 — Skia projection row h50/gap12 (rows 블록 174) vs CSS row h64×3 (컨테이너 216 은 양쪽 동일 → 내부만 발산). Layer D resolver (`resolveGridListSpacingMetric`) ↔ CSS 실렌더 대조
- 검증: cross-check 각 컴포넌트

### Phase 3: fresh factory 폭 분류 계열 (B14~B17) — ✅ Phase 0 에서 해소 확인, skip

- 2026-07-16 재실측 결과 B14/B15/B16/B17 전 항목 0/0 (§1-B) — 07-14 이후 수정 반영으로 대상 소멸
- 잔여 작업 (golden 편입) 은 Phase 6 으로 흡수. BC 확인은 Phase 0 에서 완료 (새로고침 후 83 요소 보존)

### Phase 4: 소형 오차 판정 (B8~B13)

- §2 기준 적용: 원인 규명 → ±2px 이내 텍스트 측정 기인이면 수용 처리 (golden 기대값 고정), 아니면 수정
- **B13 Checkbox 는 07-16 재실측 dw+7.6 으로 수정 승격** — 소형 판정 아닌 원인 규명 후 수정
- B9 StatusLight dh+3 은 ±3 경계 — §2 기준 3 초과 아님이나 원인 미상 수용 금지 원칙 적용
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

- **B7 Menu 표현**: 07-16 재실측으로 발산 형태 확정 — Preview DOM 은 RAC MenuTrigger 패턴의 **트리거 버튼** (61.2×30, fit-content, factory `style.width:100%` 미소비 — display:contents wrapper), Skia 는 factory style 을 소비해 **390×30 full-width**. 어느 표현이 정본인지는 제품 결정 (scope 결정 지점) — 사용자 확인 후 별도 처리.

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
