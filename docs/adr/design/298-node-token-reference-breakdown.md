# ADR-298 Design Breakdown — 노드 값의 토큰 참조 저장 · Design 패널 토큰 먼저 (토큰 모델 A)

> 본문: [298-node-token-reference-panel-token-first.md](../298-node-token-reference-panel-token-first.md) · 분석 (정본 인벤토리): [TOKEN_MODEL_A_NODE_TOKEN_REFERENCE_2026-11](../../explanation/research/TOKEN_MODEL_A_NODE_TOKEN_REFERENCE_2026-11.md) · 시안: `docs/design/styles-token-model/` (gitignore 로컬, 2026-11-01 295 값으로 갱신). 기준 main `dd7a12602` (2026-11-01).

## 1. 분리 4 질문 lock-in (adr-writing.md §Fork)

295 breakdown §1 이 295 ↔ A 의 경계를 이미 적었다. 298 작성 시점에 코드로 다시 확인한 결과 **질문 2 의 답이 바뀌었다** (스키마 변경 → 거의 없음). 사용자 confirm = 이번 `/create-adr` (2026-11-01, 295 Decision 7 의 「다음 ADR」).

| #   | 질문                           | 답 (2026-11-01)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용                    | **295 = base** (값), **298 = 응용** (그 값을 노드가 이름으로 참조하는 저장 · 입력기). 295 Implemented 10-31 — 선행 충족. 296 (코드 보기) 은 298 의 선행이 아니라 **이미 닫힌 표면** — 노드 토큰을 `var(--catalog-token-*)` 로 양방향 (F4).                                                                                                                                                                                                                                                                |
| 2   | schema 직교성                  | 295 breakdown 은 「A 가 typed field 에 토큰 참조 축을 더한다 (문서 스키마 변경)」 로 예상했으나 실제 `visual` 은 `TokenUse` 를 이미 받는다 (`types.ts:185, 485-494`). 298 의 스키마 변경은 `fills` 색 · `layout` inset 두 자리뿐 (F8) — 295 의 `ThemeSnapshot` 출력과 직교. 298 은 295 의 specialization 이 아니라 **소비자**.                                                                                                                                                                            |
| 3   | 선행 전제 reverse 검증         | 295 Decision 5 「이름 · 라벨 그대로, preset 값 oracle = 활성 snapshot」 · Decision 9 「`--catalog-token-*` 이름 공간」 · Decision 8 「chrome 은 대상 아님」 을 그대로 승계 — grep: `deviceTypography.ts` 가 노드 글자 토큰을 이미 그 이름으로 낸다 (D5 는 그 확장). 293 (색 변수 → DOM) 과의 의존: 293 이 색 `cssVars` 를 만들었고 298 의 색 칩은 그 변수를 참조한다 — 293 → 298 자연 순서, 반전 근거 없음. 297 (rule 상태 트리) 과는 파일 겹침만 (resolver.ts — 297 은 paint 분기, 298 은 `tokenValue`). |
| 4   | 판독에 전제 검증을 미루지 않음 | 위 1 ~ 3 은 ADR 작성 시점 코드 grep (분석 §1 · §2 의 라인 인용). 리뷰는 사용자 요청 시 `review-adr`.                                                                                                                                                                                                                                                                                                                                                                                                      |

## 2. 인벤토리 (2026-11-01 실측 — Phase 0 이 재확인 · 보강)

### 2.1 이미 있어 변경 0

| 장치                                                 | 파일                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `TokenUse` · `AuthoredValue` · `VisualWrites`        | `packages/shared/src/catalog/document/types.ts:185, 249-256, 485-494`                                                        |
| resolver `tokenValue` · `DANGLING_TOKEN` · 출처 기억 | `packages/shared/src/catalog/resolution/resolver.ts:216-247, 739-769` · `document/themedToken.ts`                            |
| 그래프 `tokenRefs` 색인 · 무효화                     | `document/graph.ts:98-110, 392-408` · `runtime/compositionRoot.ts:5021-5051`                                                 |
| 빌더 테마 변경 root 재해석                           | `apps/builder/src/builder/catalogRuntime/workspace.ts:253-304`                                                               |
| 코드 보기 Page.css 토큰 변수 · 파서                  | `packages/shared/src/codeView/files/styles.ts:272-297` · `apps/builder/src/builder/catalogRuntime/codeViewStyles.ts:334-403` |

### 2.2 바뀌는 파일 (추정 — Phase 0 freeze)

| 영역                  | 파일                                                                                                                                                                                                  | 변경                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 토큰 표 (D2)          | `packages/shared/src/catalog/document/codeCatalogLibrary.ts:95-125` · `ruleDefinition.ts:115-137` · 신규 `document/libraryTokenScale.ts`                                                              | 테마 무관 id · 단계 전체 생성 · 옛 `_light` / `_dark` 별칭 조회                                 |
| 검증 (D4)             | `document/graph.ts:1823-1871` (`validateTokenFields`)                                                                                                                                                 | 4변 padding · 코너 radius · 변별 border · lineHeight · fontFamily · boxShadow 허용 형 확장      |
| 스키마 (D1 · Phase 3) | `document/types.ts:446-489` (`LayoutWrites` · fills) · `document/validation.ts:943`                                                                                                                   | inset · fills 색에 `TokenUse`                                                                   |
| 패널 쓰기 · 읽기 (D4) | `apps/builder/src/builder/catalogRuntime/styleFields.ts:134-139, 440-448` · `editContract.ts:338-342` · `commands/fields.ts`                                                                          | `cssPx` 토큰 통과 · `catalogStyleView` 객체 올림                                                |
| 입력기 (D4 · D6)      | `components/property/PropertyUnitInput.runtime.ts` (`getInputDisplayValue` :232-257 · `labelMode` :54 · memo :800-823 · commit :209-219) · `.components.tsx:115-127` · 신규 scrub                     | 칩 모드 (opt-in) · 스케일 밖 점 · 비움 표시 · 포인터 scrub                                      |
| preset 표 (D3)        | `components/property/propertyUnitPresets.ts`                                                                                                                                                          | 토큰 표에서 파생 (라벨 ↔ 토큰) · `PAGE_GAP_PRESETS` 삭제 · border width 토큰화                  |
| 절 위젯 (D4)          | `panels/styles/sections/BorderSection.tsx:220-257` · `EffectSection.tsx:360-374` · `TypographySection.tsx` · `PaddingFields.tsx` · Position 칸                                                        | Width 토큰 칸 (결정 3) · shadow 토큰 commit · Size 두 묶음 메뉴 · Line Height auto · Padding 칩 |
| 색 (Phase 3)          | `ColorPickerPalettes.components.tsx:160, 181` · fill 소비처 (Phase 0 인벤토리)                                                                                                                        | Theme 먼저 (결정 4) · `TokenUse` commit                                                         |
| DOM (D5)              | `packages/shared/src/catalog/runtime/deviceTypography.ts` · `authoredStyle.ts:46-60, 132-139` · `compositionRoot.ts:1387-1430` (`sameRecord`) · `catalogPreviewSession.ts:800-806` (`setColorScheme`) | 변수 변환 축 확장 · 출처 비교 · 모드 전환 재해석                                                |
| Canvas (D6)           | `workspace/canvas/catalog/spacingGeometry.ts:320-342` · `canvasGesture.ts:1446-1460`                                                                                                                  | 토큰 단계 스냅 · ⌥ 1px                                                                          |
| 그림자 (D7)           | `layout/engines/implicitStyles.ts:155-161` (`normalizeShadowForTheme`) · `utils/fillAdapter.ts:316-332` (`shadowLiteralToCssVar` · `adaptElementStyle`, 호출 0)                                       | 토큰 저장 뒤 역매핑 삭제 여부 (기존 리터럴 문서 때문에 Phase 5 판단)                            |
| 테스트                | `styleFields` · `PropertyUnitInput` · `graph` 검증 · `codeViewStyles` 왕복 · `adr295PaletteSymmetry.browser.test.ts` 확장 (노드 토큰 arm)                                                             |                                                                                                 |

추정 ~30 파일 (테스트 제외). Phase 0 실측이 1.5x 를 넘으면 사후 보고 (adr-writing.md M3).

### 2.3 라벨 → 토큰 → 값 (값은 활성 snapshot 에서 읽는다 — 표의 숫자는 desktop 기준 참고)

| 라벨 | spacing | radius        | border                       | shadow | 본문 글자 (행간)                                  | 제목 글자 (행간)               |
| ---- | ------- | ------------- | ---------------------------- | ------ | ------------------------------------------------- | ------------------------------ |
| XS   | xs 4    | xs 2          | —                            | —      | text-xs 12 (16)                                   | text-heading-xs 18 (22)        |
| S    | sm 8    | sm 4          | thin 1                       | sm     | text-sm 14 (18)                                   | text-heading-sm 20 (24)        |
| M    | md 12   | md 8          | —                            | md     | text-base 16 (20)                                 | text-heading-md 22 (26)        |
| L    | lg 16   | lg 10         | thick 2                      | lg     | text-lg 18 (22)                                   | text-heading-lg 28 (32)        |
| XL   | xl 24   | xl 16         | —                            | —      | text-xl 20 (24)                                   | text-heading-xl 36 (42)        |
| 기타 | 숫자    | None 0 · Full | none 0 · hairline 0.5 (숫자) | none   | 2xs 11 · 2xl 22 · 3xl 25 · 4xl 28 · 5xl 36 (숫자) | heading-2xl 45 · 3xl 58 (숫자) |

border 는 라벨이 아니라 토큰 이름 (none · thin · thick) 그대로 (메모리 `feedback-panel-scale-labels…`). 색은 Theme 팔레트의 토큰 이름 (accent 100…900 · neutral 50…950 · 상태색 · border …).

## 3. Phase 계획

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                        | Gate              | 사용자 결정 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------- |
| 0     | 인벤토리 freeze (§2.2 호출처 수 · fills 색 소비처 · 라이브러리 토큰 전수 · `_light`/`_dark` id 를 담은 fixture 문서) · RED 3 (preset commit = px · `catalogStyleView` 객체 누락 · DOM 그림자 dark live 재현) · 추정 2 (F10 `setColorScheme` · F12 `sameRecord`) live 판정 · 295 G2 두 arm 하니스 재실행 PASS                                                                                                                                | G0                | 7           |
| 1     | 토큰 층 — 테마 무관 라이브러리 토큰 단계 전체 표 (옛 `_light` · `_dark` entry 유지 + 추가 — 별칭 층 아님) · 행간 계약 (D4 ① ② — resolver 가 짝 ÷ fontSize 배율 재계산 · px → 배율) · `validateTokenFields` 확장 · DOM 변수 변환 축 확장 (spacing · radius · border · shadow · 색) · `sameRecord` 출처 비교 · `setColorScheme` 재해석. 패널 변경 0 → 화면 변화 0 (기존 참조 해석값 · 생성 CSS · Page.css 동일 — tokens · revision 은 달라짐) | G1 · G2 (DOM arm) | 1           |
| 2     | 패널 — `cssPx` · `catalogStyleView` 토큰 통과 · preset 표 파생 · `PropertyUnitInput` 칩 모드 · Gap · Padding · Radius · Border Width (결정 3) · Shadow · Font Size 두 묶음 · Line Height auto (결정 5) · 감사 C4 · E2 (결정 6) · 코드 보기 왕복                                                                                                                                                                                             | G2 · G3           | 3 · 5 · 6   |
| 3     | 색 · Position — `fills` 색 · `layout` inset 에 `TokenUse` (스키마) · 팔레트 Theme 먼저 (결정 4) · 그라데이션 스톱 · Position 칸 칩 · 소비처 전부 · **코드 보기** `codeViewFillsCss` 토큰 → `var()` 출력 · `codeViewFillsOf` / `codeViewFillColor` 의 `var()` 역파싱 · `tokenOf` 의 layout `SET({kind:"token"})` 복원 (리뷰 h1)                                                                                                              | G4                | 2 · 4       |
| 4     | Canvas 핸들 토큰 스냅 · 입력기 포인터 scrub · 스케일 밖 · 비움 표시                                                                                                                                                                                                                                                                                                                                                                         | G5                | —           |
| 5     | live · 번들 · 그림자 역매핑 삭제 판단 · CHANGELOG · README · 시안 대조 (Layout · Style · Text 3장과 화면 일치) · Implemented                                                                                                                                                                                                                                                                                                                | G5                | —           |

Phase 1 과 2 는 커밋을 나눈다 — Phase 1 은 「동작 변경 0」 (review-loop-closure §3 축소 절차), Phase 2 부터 live 필수.

## 4. Gate 하니스

- **G1 동일성**: `buildCodeCatalogLibrary()` 투영에서 `tokens` · `revision` 을 뺀 나머지 (definitions 의 해석 결과) diff 0 + 옛 entry 전부가 새 투영의 `tokens` Map 에 같은 값으로 존재 · 생성 CSS `validate:sync` · 코드 보기 Page.css 출력 fixture diff 0. 새 entry 표: 축 × 단계 전부가 `ref` 로 활성 snapshot 값과 같다 (oracle = `resolveThemeSnapshot`, 손 표 금지). 원복 RED: 옛 entry 제거 → `_light` id 를 가진 fixture 문서가 `DANGLING_TOKEN`. (리뷰 h3)
- **G2 두 arm**: `adr295PaletteSymmetry.browser.test.ts` 에 노드 토큰 arm (Frame 에 gap · padding · radius · border · shadow · 색 토큰) 추가 — Canvas 픽셀 == DOM 픽셀, inline 선언 (`style.getPropertyValue`) 이 `var(--catalog-token-*)` 를 담음, computed 는 수치 — 테마 (radius preset) · 모드 (`setColorScheme`) · 터치 보기 전환 전후 두 수치가 rule 값과 같이 바뀜 (선언 검사와 분리, 리뷰 h4). 295 G2 하니스는 박스 차이 + DOM 스크린샷뿐이라 paint 픽셀 oracle (색 · 그림자) 을 Phase 0 에 더한다 (LOW deferred 흡수). 측정 조건: DPR 1 · 보이는 탭 (measurement-validity Q2 — 불리 케이스 = 리터럴과 같은 값의 토큰 교체, R2).
- **G3 왕복**: `codeViewStyles` 단위 — 패널 토큰 저장 → Page.css 줄 → 편집 Apply → 같은 `tokenId`; 리터럴 → 토큰 · 토큰 → 리터럴 교체.
- **G4 fill**: fills 색 토큰 두 arm + 그라데이션 스톱 + 코드 보기 `background` 왕복 · 소비처 인벤토리 전부 (원복 RED).
- **G5 live**: Chrome MCP (하니스 포트, 사용자 5173 금지) — Gap M · Radius L · Border thin · Shadow S · Font Size 제목 M 선택 → Canvas · Preview · Code 동시 변화 → 테마 · 모드 · 터치 전환 → Undo 1 · 새로고침 유지 · 콘솔 0. 번들 `adr201-bundle-gate.mjs`. 패널 입력 프레임 p95.

## 5. 사용자 결정 — 묻는 시점 (본문 표와 같음)

질문: Phase 0 착수 때 7 · Phase 2 착수 때 3 · 6 · Phase 3 착수 때 2. 자율 진행 + 사후 보고: 1 (Phase 1) · 4 (Phase 3) · 5 (Phase 2) — 리뷰 round 1 판정 (결정 지점 밖의 구현 · 표시 계약). 결정 2 가 「넣지 않음」 이면 Phase 3 은 후속 ADR 로 (R3) — 결정 지점 ① 이라 그때 묻는다.

## 6. 기록 (Phase 종결마다)

### 6.0 Phase 0 (2026-11-01 — G0 닫힘, 사용자 결정 7 = 선행 `/fix`)

| 항목 | 실측 (dirty tree — ADR-297 Phase 3 WIP 포함) |
| --- | --- |
| 라이브러리 토큰 (`buildCodeCatalogLibrary`) | 149 개 · id 전부 `lib:token:<ref>_light` (dark 0). ref 분류: typography 14 · radius 8 (none · xs · sm · md · lg · xl · 2xl · full) · color 24 · size 19 · length 84 (`{length.size.height.M*3/8}` 같은 식 토큰). **spacing · shadow · border.width · 제목 typography 는 0** — Phase 1 의 테마 무관 표가 새로 만든다 |
| `_light` id fixture | 기존 fixture 0 (`phase4eTheme.test.tsx:90` 주석만) — Phase 1 G1 원복 RED 가 만든다 |
| 패널 쓰기 | `cssPx` 호출 6 (비테스트) · `catalogStyleView` 호출 7 (sizing · effectiveStyle · responsiveFields 2 · aiHost · catalogStylesHost 2) |
| fills 색 소비처 (Phase 3) | 33 파일 (`catalogFillItems` · `fillsToCssBackgroundStyle` · `codeViewFillsCss` · 패널 Fill 계열 · AI fill 도구) · inset 19 파일 — §2.2 추정 (~30, 전 phase) 대비 1.5 배 이상 → 사후 보고 (adr-writing M3) |
| preset 상수 | Radius M commit = 8 (S2 값, ADR-295) · spacing preset 은 `themedTokenRef` 밖이라 jsdom 에서 `var()` 그대로 → `CatalogStyleValueError` (브라우저는 computed px) · border width 1 · 2 · 4 · 8 · 12 · `PAGE_GAP_PRESETS` 사용 0 |
| F10 `setColorScheme` | 코드 확정 — `colorMode` 만 갱신, root 재생성 없음 (`catalogPreviewSession.ts:800-806`, root 는 `:1999` 에서 `colorMode` 로 만든다) → Phase 1 RED |
| F12 `sameRecord` | 현재 영향 0 (DOM 은 값 리터럴만) — Phase 1 의 `var()` 출력 도입 시 출처 비교 필요 (`RESOLVED_TOKEN_REFS` WeakMap 은 비교 밖) |
| F11 그림자 | 코드 재현 — Canvas `applyCatalogAuthoredPaint(…, root.colorMode)` → `normalizeShadowForTheme` = dark 값 · DOM `catalogAuthoredDomStyle` = light 리터럴 (`shadowLiteralToCssVar` production 호출 0) |
| RED | `apps/builder/src/builder/catalogRuntime/__tests__/adr298Red.test.ts` — GREEN 준비 2 + `it.fails` 3 (① Phase 2 · ② Phase 2 · ③ 선행 `/fix`). 각 `it.fails` 를 `it` 으로 바꾸면 실패 사유가 계약 그대로임을 확인 (8 ≠ token · undefined · 같은 리터럴) |
| 기준선 | 295 G2 `adr295PaletteSymmetry.browser.test.ts` desktop 274/274 · touch 274/274 PASS |
| 결정 7 선행 `/fix` (F11) | `catalogAuthoredDomStyle` (`packages/shared/src/catalog/runtime/authoredStyle.ts`) 가 `shadowLiteralToCssVar` 를 부른다 — RED ③ GREEN (light · dark preset sm · md · lg → `var(--shadow-*)`, 임의 CSS · inset 토글 · none · inset preset 은 원문 = Canvas 와 같은 판정). 원복 RED 1 (inline = light 리터럴). 인접 스위트 builder 5 파일 76 · shared 4 파일 21 PASS · type-check shared · builder 0. live 5178 (Playwright, 저장 인증 세션 · 테마 darkMode dark): Canvas alpha 0.24/0.12/0.24 = Preview computed, 원복 arm Preview 0.08/0.04/0.08 |


### 6.1 Phase 1 (2026-11-01 — G1 · G2 DOM arm 닫힘)

| 항목 | 결과 |
| --- | --- |
| D2 토큰 표 | `packages/shared/src/catalog/document/libraryTokenScale.ts` (`libraryTokenId` · `libraryTokenScaleRefs` · `addLibraryTokenScale`) — `buildCodeCatalogLibrary` 가 digest 앞에서 더한다. 옛 `_light` 149 유지 |
| D4 검증 표 | `graph.ts` `LENGTH_TOKEN_FIELDS` (29 키) — fontFamily · boxShadow 는 이미 string 토큰을 받았다 (F7 정정: 막힌 것은 길이 키) |
| D4 행간 | `resolver.ts` `LINE_WRITES` · `finishLineHeight` (소유 노드 · template 위치 두 끝) · `LINE_FINISHED` → `instanceRoot` 가 배율을 함께 넘김 |
| D5 DOM | `runtime/nodeTokenCss.ts` `catalogNodeTokenCss` — `catalogDomStyle` 끝 · rule 요소 경로 (`catalogDeviceControlCss` 뒤) 두 곳. 출처 = `AUTHORED_TOKEN_REFS` (문서 쓰기만, `copyResolvedTokenRefs` 가 함께 복사) |
| F12 | `catalogSameResolvedTokenRefs` (resolved · authored 두 맵) — `sameRecord` |
| F10 | 색 · 그림자 변수화로 해소 — root 재생성 없음 |
| 테스트 | `adr298TokenScale.test.ts` 3 · `adr298Phase1.test.ts` 9 · 원복 RED 5 arm (`scratchpad/revert298p1.sh` — 출처 비교 1 · 행간 2 · 검증 표 4 · DOM 3 · 토큰 표 10 행 실패) |
| 범위 조정 | rule 토큰의 변수화는 제외 — 기존 테스트 14 (adr253 · adr254 · adr259 · inlineAlert) 가 rule 리터럴 inline 을 기대하고, 시트가 변수를 국소 재정의하면 Canvas 와 갈린다 |
| live G2 | 5178 Playwright — 27/27 (선언 `var()` 7 축 × 3 arm + arm 유효성 2 + 선언 불변 1), 콘솔 0 |
| 회귀 | builder 4,085 통과 · 실패 10 = HEAD 목록 (builderCatalogVars c · calendarReferenceBox 2 · formContext · phase4e11 · phase4eG5LeafScope · interactionWhenReach Calendar 4) · shared 2,309 통과 (designDataSurfaceGaps 파일 — 다른 세션 편집 중) |
| LOW deferred | G2 픽셀 arm · 터치 arm |

### 6.2 Phase 2 (2026-11-01 — G2 · G3 · G5 패널 몫 닫힘, 사용자 결정 3 · 6 = 권고안)

| 항목 | 결과 |
| --- | --- |
| 사용자 결정 | 3 = 「토큰 칸으로」 (Border Width — 2026-09-15 슬라이더 판정 변경) · 6 = 「묶는다」 (감사 C4 · E2) · 5 = auto (자율 · 보고) |
| 패널 토큰 글자 | `catalogRuntime/panelTokens.ts` — `var(--…)` (`tokenToCSSVar`) ↔ `TokenUse` (`panelTokenUse` · `panelTokenVar`). shared `libraryTokenRef` 가 scale id · 옛 `_light` id 를 ref 로 |
| 쓰기 · 읽기 (D4 · F5 · F6) | `styleFields.ts` `catalogStyleWrites` — 길이 키 · 코너 · `lineHeight` (`auto` = 제거) · `boxShadow` 토큰 / `catalogStyleView` — TokenUse → 변수 글자 |
| preset 표 (D3) | `propertyUnitPresets.ts` 토큰 표 파생 (숫자 0) · `group` (Font Size 본문 · 제목) · `PAGE_GAP_PRESETS` 삭제 · commit = 토큰 (`getPresetCommitValue`) |
| 칩 모드 (D4) | `PropertyUnitInput` — 칩 + 해석값 · 숫자 입력 = 리터럴 · 보기만 하고 떠나면 토큰 유지 · 화살표는 해석값에서 리터럴 · 묶음 메뉴 (`ListBoxSection` + `Header`) · `afterControl` (상태 문구) |
| 절 | Border Width 토큰 칸 (슬라이더 · ⋮ 삭제) · Radius · Padding · Gap 칩 · Effect 그림자 `{shadow.*}` + legend 칩 · Blur 단위 입력칸 (C4) · Font Size 두 묶음 · Line Height auto · Size (Max H · Ratio) · Position 상태 문구 `slot="description"` (E2 — 절 아래 `<p>` 3 · `.position-summary` 삭제) |
| 범위 조정 | layout longhand = CSS 글자 → 한 줄 flex Gap 토큰은 `visual.gap` + 주축 longhand 삭제, grid Gap X · Y 는 해석값 리터럴 (layout 토큰 형은 Phase 3 inset 과 함께). 표시 순서: 한 줄 flex 의 Gap = 주축 longhand ?? `gap` (`useLayoutValues`) |
| 규칙 | `.claude/rules/style-ssot.md` §2 토큰 preset 줄 — commit 이 해석값 → 토큰 참조 (Why 갱신) |
| 테스트 | `adr298Phase2Panel.test.tsx` 7 · G3 `adr298CodeViewRoundTrip.test.tsx` 2 (Apply 가 같은 tokenId · 토큰 → 토큰 → 리터럴 → 토큰) · RED ① ② → GREEN · 기존 테스트 정정 4 (단위 입력 preset commit · Border 정적 · Effect legend · 토큰 표 개수 149 → 대응 검사) |
| 원복 RED | `scratchpad/revert298p2.sh` 7 arm 전부 RED (쓰기 7 · 읽기 6 · preset commit 7 · blur 유지 2 · 그림자 1 · Gap 주축 1 · E2 1 행 실패) |
| live G5 | 5178 Playwright · 실제 패널 클릭 — 35/35 · 콘솔 0 (ADR 본문 Live Exercise) |
| 회귀 | builder components · catalogRuntime · panels · preview · styles 5,098 통과 · 실패 6 = 내 변경 밖 (catalogHistoryLabels `toastShape` 번역 · chromeIsland `workspace-panel-frame` · interactionWhenReach Calendar 4 — Phase 1 목록과 같은 몫) · shared document · codeView 411 통과 · type-check builder 0 (shared 의 `codeCatalogLibrary.ts` 오류는 다른 세션 미커밋 편집 — 내 파일 0) |
| LOW deferred | 터치 arm · 픽셀 arm (Phase 1 과 같음) |


### 6.3 Phase 3 (2026-11-02 — G4 · G5 색 · Position 몫 닫힘, 사용자 결정 2 = 넣는다 · 4 = Theme 먼저)

| 항목 | 결과 |
| --- | --- |
| 사용자 결정 | 2 = 「넣는다」 (2026-11-02 질문 답 — fills 색 · inset 스키마 변경) · 4 = Theme 먼저 (자율 · 보고) |
| 스키마 (D1) | `types.ts` — `CatalogFillColor = string \| TokenUse` (색 층 · 그라데이션 스톱, mesh 점은 리터럴 그대로), `CatalogFillLayer<C>` · record 는 `CatalogResolvedFillLayer` (색 = `#RRGGBBAA`), `LayoutTokenField` (insetLeft · Top · Right · Bottom · rowGap · columnGap) · `LayoutWrites = WriteValue<string \| TokenUse>` · 형 검증 `validation.ts` (`fillColor` · `layoutWrites` — 그 밖 layout 칸의 토큰은 `INVALID_LAYOUT_VALUE`) · 토큰 형 검증 `graph.ts` `validatePaintLayoutTokens` (fill = color · layout = length/number, 노드 · 반응형 층 · patch) · 토큰 색인 `tokenRefs` 에 fills · layout |
| resolver | `resolvedFills` — 색 토큰을 record 의 색 모드 `#RRGGBBAA` 로 (`catalogFillColorOf`, `transparent` = `#00000000`), 출처는 새 층 · 스톱 객체에 (`FILL_TOKEN_REFS` → `catalogFillTokenRef`). `applyLayoutWrites` 를 resolver 안으로 — 토큰 = px 글자 (엔진 입력 그대로) + 출처 (`RESOLVED` · `AUTHORED_TOKEN_REFS`), layout 이 복사되는 자리 (template authored · instance root) 에 출처도 (`assignLayout` · `copyResolvedTokenRefs`) |
| DOM (D5) | fill — `catalogFillTokenVars` (`authoredStyle.ts`) 가 토큰 층 · 스톱의 색을 그 변수로, `fillAdapter` 가 `var()` 를 그대로 (opacity < 1 = `color-mix(in srgb, var(--x) N%, transparent)` — srgb 의 alpha 와 같은 값) · layout — `catalogLayoutTokenCss` (`nodeTokenCss.ts`) 가 작성 inset · gap longhand 의 토큰을 변수로 · `sameRecord` 가 fill · layout 출처도 비교 (F12 — 같은 값의 리터럴 → 토큰이 DOM listener 에 닿음) |
| 코드 보기 (D8 · G4 · 리뷰 h1) | `codeViewFillsCss(fills, reader, tokens)` — 색 토큰 = `codeViewTokenVar` (`background: var(--bg-muted)` — 색은 테마 변수 이름, visual 색 토큰과 같은 이름 · ADR 본문의 `--catalog-token-color-*` 예상은 실측으로 정정) · `codeViewFillsOf(…, tokenColor)` 가 `var()` 를 색 토큰으로 (그라데이션 스톱 포함) · inset · gap longhand 의 `var()` 는 `catalogStyleWrites` 경로 (아래) · `tokenOf` 가 테마 무관 scale id 를 rule 의 `_light` 짝보다 먼저 (D2) |
| 패널 | `panelTokens.ts` — `panelFillColor` · `panelFillItems` · `panelFillLayers` · `panelResolvedFillLayers` (미리보기 = 활성 모드 hex) · `panelColorTokenName`. host (`catalogStylesHost`) · 문서 색 수집 · AI host 가 같은 변환. `styleFields` — 색 칸 (color · backgroundColor · borderColor) 의 `{color.*}` 변수 = 토큰, inset · rowGap · columnGap 의 길이 토큰 변수 = 토큰, 읽기는 변수 글자. 색 피커 Theme 팔레트 = 토큰 스와치 20 (Accent · Surface · Neutral · Status — 활성 테마 · 모드 값, commit = 토큰 변수 `tokenToCSSVar`) 를 Document 앞에 (결정 4 — 옛 accent · neutral 사다리는 토큰이 아니라 삭제) · `ColorPickerPanel` · `PropertyColor` · Fill 행 · Fill 팝오버 · 그라데이션 편집기가 토큰을 해석값 + 이름으로 표시 · Grid Gap X · Y = longhand 토큰 (Phase 2 의 해석값 리터럴 · 한 줄 flex `visual.gap` 우회 제거) · Position 칸 = 토큰 inset 의 칩 + px (`position.ts` 가 spacing 토큰 inset 을 쓰고, Center 축은 반대 변을 음수로 써야 해 px) |
| 범위 조정 | Position 칸의 단계 메뉴는 넣지 않았다 — `PropertyUnitInput` 은 preset 이 있으면 단위 메뉴를 preset 메뉴로 바꿔 `%` inset 을 잃는다 (`TransformSection.test` 가 잡음). 단위 + 단계 한 메뉴는 같은 위젯을 고치는 Phase 4 로. mesh 점 색은 리터럴 (토큰 칸 없음) |
| 테스트 | `adr298Phase3.test.ts` 10 (색 층 · opacity · 스톱 · 형 거절 · F12 · inset · gap longhand · layout 형 거절 · 패널 글자 · 팔레트 20 토큰 왕복) · G4 `adr298CodeViewRoundTrip.test.tsx` +2 (`background` 토큰 ↔ 리터럴 ↔ 그라데이션 스톱 · `left` 토큰 ↔ 리터럴) · `adr298Phase3Panel.test.tsx` 3 (Theme 먼저 · 스와치 = 토큰 · 행 이름 · Gap X · Position 칩) · 기존 테스트 정정 2 (Phase 2 한 줄 flex Gap → longhand 토큰 · adr296 코드 보기 Apply = scale id) |
| 원복 RED | `scratchpad/revert298p3.sh` 16 arm 전부 RED (resolver 토큰 → hex · 출처 기억 · DOM 변수 · 스키마 · 토큰 형 · layout px · DOM layout 변수 · sameRecord fill · layout 출처 · 코드 보기 fill · 패널 layout 쓰기 (패널 · 코드 보기 inset) · 팝오버 토큰 commit · Theme 먼저 · 패널 fill 쓰기 · 스와치 = 토큰 변수). 처음 쓴 arm 2 개는 GREEN — F12 테스트의 oracle 이 record 객체 (step 마다 새로 만듦) 라 DOM listener 로 바꿨고, 코드 보기 쪽 layout 토큰 분기는 `catalogStyleWrites` 와 중복이라 지웠다 |
| live 결함 1 | 스와치가 `var(--<이름>)` 을 commit — 토큰 이름과 변수가 다른 8 개 (`{color.base}` = `var(--bg)` …) 는 토큰이 되지 않았다 (live 재현 · 단위 테스트는 같은 이름 `accent` 만). 수리 = `tokenToCSSVar` 값 commit + 팔레트 20 토큰 왕복 게이트 |
| live G4 · G5 | 5178 Playwright · 실제 패널 클릭 — 20/20 · 콘솔 0 (ADR 본문 Live Exercise) |
| 회귀 | builder 전체 7,910 통과 · 실패 13 = 내 변경 밖 (catalogHistoryLabels · chromeIsland · interactionWhenReach Calendar 4 · labelKeyCatalog 키 수 · chart browser 3 · 부하 평균 18 ~ 28 에서 시간 초과 2 — 단독 · 상한 완화로 통과, graph.ts 되돌림 대조 3,424 · 3,455 ms ≈ 현재 3,470 · 3,485 ms) · Phase 2 의 Font Size 칩 판정이 도메인 술어 ratchet (`"Body"` 비교) 에 걸려 `group === "Heading"` 으로 · shared catalog · codeView · utils 1,630 통과 (실패 1 = Toast 수동 CSS — 내 변경 밖) · type-check builder · shared 0 |
| LOW deferred | 터치 · 픽셀 arm (Phase 1 과 같음) · 프로젝트 토큰 편집 → fills · layout 토큰 노드 재해석 (`tokenRefs` 색인 추가 — Builder 는 테마 변경마다 root 를 다시 만들어 현재 재현 경로 없음) |
