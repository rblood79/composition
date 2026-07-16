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

### 1-E. B22 — generated CSS `width:100%` 채널의 Skia layout 미배선 (Phase 4 중 발견 → **2026-07-16 심야 근본 원인 확정: 회귀 아님**)

| #   | 컴포넌트                                                | Phase 4 실측 (2026-07-16 오후)                                                       | Phase 0 freeze (동일 날 오전)                |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| B22 | Text / Separator / Table / Disclosure / DisclosureGroup | Skia 폭 31 (Text) / 0 (Separator·Table·Disclosure·DisclosureGroup) — CSS 는 350 정상 | 전부 0/0 (양쪽 390 동일 — §1-B B14/B16 참조) |

**근본 원인 (라이브 전진 진단으로 확정 — bisect 불필요, 초기 "stale dist 노출 회귀" 가설 기각)**:

1. **회귀 아님 — 측정 컨텍스트 차이**: 오전 freeze 는 **plain block body** (padding 만) 에서 측정 — fullTreeLayout §5.5 IFC 시뮬레이션이 block 자식에 `width:100%` 를 주입해 양쪽 390 일치. 오후 실측은 **`display:flex + flexDirection:column + alignItems:flex-start` body** (프로젝트 Home 페이지, 사용자 저작 스타일) 에서 수행 — §5.5 게이트 (`isInlineBlockSimulationParent`, 38f258203 의도된 동작) 가 진짜 flex 부모를 정확히 제외하면서 잠복 결함이 노출된 것. 세션 커밋/stash/dist 전부 무관 (합성 최소 트리 + 실페이지 데이터로 `calculateFullTreeLayout` 직접 호출 대조 실증).
2. **실존 결함 = D3 채널 누락**: 이들 컴포넌트의 DOM 폭 원천은 **CSS 의 `width: 100%` 규칙** (Text = generated archetype base / Separator = 수동 CSS `:not(.vertical)` 계약 / Table = 수동 CSS / Disclosure(Group) = generated) 인데, **Skia layout 은 이 채널을 소비하지 않는다** (catalog top-level containerStyles 부재 → fallback `{}`). block 부모에서는 §5.5 주입이 우연히 같은 값을 만들어 가려졌고, flex 부모에서는 CSS 만 width:100% 를 적용해 발산 (Text: DOM 350 vs Skia fit-content 31; iframe 내 대조 실험 — 같은 flex-start 컨테이너에서 class 없는 span 은 30.8, `.react-aria-Text` class 만 부여하면 350).
3. **범위**: base 레벨 `width:100%` 를 가진 generated CSS 는 25종 (Text/Heading/Paragraph/Description/field 류 등). field 류는 factory/composition 채널로 이미 폭이 도달하는 경우가 많아, 실측 발산 확인된 5종 (Text/Separator/Table/Disclosure/DisclosureGroup) 을 1차 수정 대상으로 한다. 나머지는 flex 부모 컨텍스트 battery 로 후속 판정.

- **영향/조치**: B8 Table dh-2 는 block body 컨텍스트 (오전 값 400 vs 402) 로 재판정 가능. bisect 사용자 허가 요청은 **철회** (회귀 아님 확정).

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

### Phase 2: 중형 — 텍스트 메트릭 계열 (B3, B4) + Tree (B5) + GridList row (B21) — ✅ 완료 (2026-07-16)

실측 결과 (수정 후): Card 390×322 = 390×322 (0/0) / Link dh 0 (dw+1.5 는 Canvas 2D↔브라우저 텍스트 측정 기인 — §2 기준 1 수용) / Tree 390×74 = 390×74 (0/0) / GridList projection row 64 = CSS 64 (pitch 76 = 64+gap12).

원인·수정 4건:

1. **B3 Card (dh-3 → 0)**: ① renderCardContent 가 Description 을 plain `card-description` div 로 렌더 → generated Description.css (catalog 파생) 미도달 → Card 폰트 16/24 상속 (Skia catalog lg 14/20 과 -4). `react-aria-Description` 클래스 + data-size/variant 부여로 catalog CSS 도달. ② CardFooter factory `borderTopWidth: "1px"` 가 borderTopStyle 부재로 DOM 은 border 0, Skia layout 만 +1 — 양쪽 어디서도 구분선을 만들지 못하는 dead 값 제거 (구분선 도입은 별도 디자인 결정)
2. **B4 Link (dh-5 → 0)**: catalog Link.sizes 에 lineHeight 토큰 pair 부재 → DOM 상속 1.5(21px) vs Skia estimateTextHeight fallback(16px) 3자 발산. lineHeight "{typography.\*--line-height}" 5 size 추가 (generated Link.css line-height emit) + utils link 분기 specStyle.lineHeight read-through
3. **B5 Tree (dh+6/-2 → 0)**: 실체는 수동 Tree.css `border: 1px solid` 의 layout 미반영 (Calendar 동형 축) — Tree containerStyles 에 borderWidth "1px". (07-14 의 +6 기록은 이후 gap 정합 수정으로 +6→-2 로 축소돼 있었음 — explicit-height 주입 가설은 기각)
4. **B21 GridList row (내부 50 vs 64 → 64=64)**: projection GridListItem 의 layout 전용 분기 부재 → generic content 24 + pad 24 + border 2 = 50. DOM 계약 (label lh + sizes.gap 2 + desc lh = 38) 분기 추가 — 컨테이너 분기(이미 64 정합)와 총합 일치

검증: vitest layout 226/226 (tree fallback lock 2건 borderWidth 반영) + rendererStyleContract 12/12 + type-check PASS + Chrome MCP 라이브 재실측 4항목.

(구) 계획 메모:

- B3 Card: card-description 폰트를 catalog Description.sizes 정본과 3경로 (generated CSS / Skia / layout) 동기화 — 목표 수치(적용 size 축)는 Phase 0 재실측으로 확정 (catalog 실측: md 12/16 · lg 14/20, `componentRulesTable.ts:4123`). `pnpm generate:css` 동반
- B4 Link: 텍스트 leaf lineHeight 경로 (`extractSpecTextStyle` 등록 여부) 확인 후 정렬 (07-16 실측: Skia 27×16 vs CSS 25.5×21 — 높이 축 5px)
- ~~B6 Tabs~~: **Phase 0 에서 해소 확인 — 제외** (top-level 0/0 + TabPanels sk=css 24×24)
- B5 Tree: dh+6 재현 조건 규명 — **fresh factory 에서 재현됨** (Skia 390×80 vs CSS 390×74). explicit-height 주입 경로 추적 → 규명 결과에 따라 수정 또는 §2 기준 수용
- B21 GridList: 내부 row 메트릭 정렬 — Skia projection row h50/gap12 (rows 블록 174) vs CSS row h64×3 (컨테이너 216 은 양쪽 동일 → 내부만 발산). Layer D resolver (`resolveGridListSpacingMetric`) ↔ CSS 실렌더 대조
- 검증: cross-check 각 컴포넌트

### Phase 3: fresh factory 폭 분류 계열 (B14~B17) — ✅ Phase 0 에서 해소 확인, skip

- 2026-07-16 재실측 결과 B14/B15/B16/B17 전 항목 0/0 (§1-B) — 07-14 이후 수정 반영으로 대상 소멸
- 잔여 작업 (golden 편입) 은 Phase 6 으로 흡수. BC 확인은 Phase 0 에서 완료 (새로고침 후 83 요소 보존)

### Phase 4: 소형 오차 판정 (B8~B13) — ✅ 완료 (2026-07-16; B8 은 B22 종속 보류)

- **B8 Table dh-2 → 보류 (B22 종속)**: Phase 4 실측 시점에 Table 이 B22 (Skia 폭 채널 붕괴, §1-E) 에 걸려 Skia 0×400 으로 측정 — dh 판정 무의미. B22 해소 후 재판정.
- **B9 StatusLight dh+3 → 해소 (24=24)**: 원인 = DOM 컴포넌트가 catalog `sizes[size].height`(md 24) 를 미소비하고 텍스트 상속 line-height 로 21px 렌더. `StatusLight.tsx` 에 rule height read-through 주입 (`> 0` sentinel 가드 — 메모리 `project-button-configheight-zero-sentinel-collapse` 승계). 라이브 실측 Skia 24 = CSS 24.
- **B10 ToggleButton dw+2.5 / B11 ToggleButtonGroup dw+2.8 → 수용**: DOM 라벨 텍스트 폭 87.52 = Canvas 2D `measureText` 87.52 동일 확증 — 잔여 오차는 Skia 폭 모델의 보수 가중 (ceil + 마진) 기인, 텍스트 측정 엔진 계열로 규명. §2 기준 1 적용 수용, golden 기대값에 오차 포함 고정 (Phase 6).
- **B12 Badge dh+2 → 해소 (dh 0)**: 원인 = catalog Badge `sizes[*].borderWidth: 1` 이 dead 값 (generated CSS 가 `border-width: 1px` 을 내지만 border-style 부재로 used value 0 — DOM 은 border 미렌더) 인데 Skia 높이 모델만 borderWidth×2 가산. catalog borderWidth 0 정정 (5 sizes) + generated Badge.css 재생성. 라이브 실측 51×20 vs 52.1×20 (dw-1.1 은 텍스트 측정 기인 수용).
- **B13 Checkbox dw+7.6 → 해소 (dw+0.6)**: 원인 = `calculateContentWidth` PHANTOM_INDICATOR 분기가 라벨 폭을 기본 폰트 (16px/400) 로 측정 — DOM 라벨은 catalog Label (14px/600) 상속. `extractSpecTextStyle("label", { size })` 경유로 정렬 (`specTextStyle.ts` TEXT_BEARING_SPECS 에 label entry 추가). 라이브 실측 94 vs 93.4.
- 검증: `pnpm build:specs` ✓ / `pnpm type-check` PASS / vitest 339/339 PASS / 라이브 재확증 (StatusLight·Badge·Checkbox·ToggleButton — Chrome MCP battery 실측)

### Phase 5: 잠재 결함 (B18~B20) — ✅ 완료 (2026-07-16)

- **B18 fontVariant → 방어 수정 반영**: `canvas2dSegmentCache.ts needsFallback()` 에 `fontVariant !== "normal"` 검사 1줄 추가 — small-caps 등은 CanvasKit 측정 경로로 우회해 측정↔렌더 (CanvasKit `resolveFontVariantFeatures`) 일치. 회귀 테스트 2건 동반 (`canvas2dSegmentCache.test.ts`, 45/45 PASS). 패널에 fontVariant 편집 UI 는 여전히 없음 — canonical 문서 직접 주입 경로 대비 방어.
- **B19 position:fixed → 보류 판정**: 스타일 패널에 CSS `position` 속성 편집 경로 자체가 없음 확인 (TransformSection 의 "fixed" 는 size mode 이며 CSS position 아님 — grep 전수). 사용자가 fixed 를 만들 방법이 없어 노출 경로 0 — cameraX/Y 배선은 position 편집 UI 도입 시점의 선행 조건으로 기록만 유지 (`renderCommands.ts:824` TODO 존치).
- **B20 useStyleSource → 보류 판정**: 스타일 소스 배지 (Inspector 표시 정확도) 는 CSS↔Skia 시각 파리티와 무관 — 본 ADR scope (파리티·잠재 렌더 결함) 밖 개선 항목. 과잉 변경 금지 원칙으로 보류 (`useStyleSource.ts:57` TODO 존치).

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
