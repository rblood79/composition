# ADR-305 breakdown — 빌더 chrome 과 사용자 컴포넌트 CSS 완전 분리

> 본문: [ADR-305](../305-builder-chrome-component-css-separation.md). 이 문서는 인벤토리 · Phase · 파일 · 검증 순서만 담는다. 결정 · 대안 · 위험은 본문이 정본.

## 1. 전제 lock-in (fork checkpoint 4 질문)

1. **base / 응용**: ADR-295 의 응용이 아니라 그 Decision 9 빌더 쪽 기구의 대체이고, ADR-028 (`[data-context="builder"]` 변수 스코프) 의 다음 단계다. 295 의 값 결정 (S2 값 · 값의 형 · 토큰 이름) 은 사용자 컴포넌트에만 걸리고 그대로 남는다.
2. **schema 직교성**: 문서 스키마 · catalog rule · 생성기 무변경. 바뀌는 것은 각 문서의 CSS import 목록 · 빌더 chrome 시트 · Preview 쪽 수동 시트의 빌더 몫 · 빌드 진입 하나 — 직교.
3. **선행 전제 reverse 검증**: 295 Decision 9 의 전제 「빌더 위젯은 생성 시트를 읽는다 → 빌더 root 를 고정해야 한다」 를 뒤집는다. 근거 = 빌더 문서에 사용자 DOM 이 없다 (Canvas Skia · Preview iframe) · `/publish` 는 별도 진입으로 옮긴다. 사용자 confirm: 2026-11-09 「빌더와 제공되는 컴퍼넌트는 분리되어야 맞지않나」 · 「#1. 수동 시트도 이번에 나눠 완전한 분리를 해야한다, #2. 경로를 전체 페이지 이동으로 바꿔」.
4. **판독에 전제 검증을 미루지 않음**: Phase 0 의 CSSOM 계수가 분류를 실측으로 확정한다 (G0).

## 2. 인벤토리 (2026-11-09, main `d07e097be`)

### 2.1 빌더 문서가 싣는 시트

| 묶음                                                    | 수                                                                                                                                                            | 처리                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성 시트 (`builder-components.css` 의 `./generated/*`) | 43                                                                                                                                                            | 빌더에서 삭제. 빌더 위젯에 닿는 13 가족 (§2.2) 의 값은 빌더 chrome 시트로                                                                                                   |
| 공유 수동 시트 (빌더 ∩ Preview, foundation 내용 포함)   | 43                                                                                                                                                            | 빌더에서 삭제. 빌더가 쓰는 규칙은 빌더 chrome 시트로 사본 (§2.3)                                                                                                            |
| 빌더 전용 수동 시트                                     | 4 (ColorArea · ColorSlider · ColorWheel · builder-listbox-section)                                                                                            | 빌더 쪽 유지 (위치를 빌더 chrome 시트 폴더로 옮길지는 Phase 0 분류)                                                                                                         |
| 고정 시트                                               | 2 (`builder-catalog-vars.css` 216 줄 · `builder-catalog-pins.css` 689 줄)                                                                                     | 삭제 (원본 삭제 — execute 때 파일명으로 사용자 확인)                                                                                                                        |
| `theme.css` (`index.css:27`)                            | 1 → 6 하위                                                                                                                                                    | `preview-system.css` 는 빌더에서 삭제 · `builder-system.css` 는 빌더 전용 · `shared-tokens.css` · 팔레트 생성 3 은 Phase 0 판정 (선택자 없는 `:root` 원시 변수면 공유 허용) |
| 중립 서체 시트                                          | 1 (`pretendard/dist/web/static/pretendard.css` — `@font-face` 만 · 빌더 `main.tsx:37` · Preview `preview/index.tsx:14` · Publish `App.tsx:38` 가 직접 import) | 세 진입 공유 유지 (Decision 1 중립 시트) — 경계 게이트가 내용 파싱으로 중립인지 확인                                                                                        |

공유 수동 43: `../CollectionErrorState` · ActionList · animations · Badge · base · Breadcrumbs · Button · Calendar · CalendarCommon · ChatContainer · ChatInput · ChatMessage · Checkbox · ColorPicker · ColorSwatch · ColorSwatchPicker · Content · EventHandlerManager · EventPalette · EventSection · Field · forms · GridList · Group · Link · ListBox · Menu · overlays · Popover · ProgressBar · Radio · RangeCalendar · Separator · Skeleton · Switch · Table · TagGroup · Toast · ToggleButton · ToggleButtonGroup · Tooltip · Tree · utilities (8,866 줄 · gzip 54,536 B). 이 중 `data-catalog-id` 분기가 있는 19장 · 154곳: Table 31 · Tree 22 · utilities 19 · ListBox 16 · Popover 7 · GridList 6 · Radio 6 · TagGroup 6 · ToggleButton 6 · CalendarCommon 4 · ColorPicker 4 · ColorSwatchPicker 4 · Link 4 · Checkbox 2 · Menu 2 · RangeCalendar 2 · Switch 2 · Breadcrumbs 1 · Calendar 1.

### 2.2 빌더 위젯에 닿는 생성 시트 — 13 가족

| 시트                             | 빌더 소비 (대표)                                                                                                                                                    | 비고                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ActionButton · ActionButtonGroup | `components/ui/ActionButton.tsx` (shared 래퍼) → `ActionIconButton` 33 파일 · `ContextualActionBar`                                                                 | shared `ActionButton.tsx:52-55` 가 class 를 늘 단다                             |
| ToggleButton · ToggleButtonGroup | shared `ToggleButton.tsx:74-75` · `ToggleButtonGroup.tsx:109-110` — Design 패널 절 · `PropertySegment` · `PropertyChipGroup` · `PanelToggleGroup` · `BuilderHeader` | 2026-11-09 회귀 지점. 그룹은 `data-density="regular"` 기본 (gap 8 — 295 전부터) |
| Input (+ TextArea · FieldBox)    | `PropertyInput.components.tsx:262` · `VariableTable.tsx:255,267,309` · `FieldValueInput.tsx:124,165,181,193,221,258,403` · `ui/SearchField.tsx:70` 안 Input         | SearchField 루트는 `builder-search-field` 로 덮음                               |
| TextField                        | `auth/Signin.tsx:140` · `CatalogCodeViewPanel.tsx`                                                                                                                  |                                                                                 |
| NumberField                      | `PropertyNumberInput.tsx:80` · `glyphSizeAction.tsx:33` · `CatalogSpacingInput.tsx:97`                                                                              | 기본 class                                                                      |
| Select                           | `PropertySelect.components.tsx:289` (소비 58 파일) · `CompactSelect.tsx:32` · `CollectionBinding.tsx`                                                               | `.react-aria-Popover[data-trigger="Select"]` (`Select.css:142-154`) 도 맞는다   |
| ComboBox                         | `PropertyUnitInput.components.tsx` · `FieldValueInput.tsx:384,423`                                                                                                  |                                                                                 |
| Menu                             | `PropertyRowMenu.tsx` · `DataGrid.components.tsx` · `CatalogGridTrackLayer.tsx:1047,1056`                                                                           |                                                                                 |
| Dialog                           | `RowForm.tsx:325` · `ColumnEditorPopover.tsx:124` · `EditingSemanticsImpactDialog.tsx:101`                                                                          | `ConfirmDialog.tsx:55-56` 는 class 지정으로 이미 피한다                         |
| Slider                           | `PropertySlider.tsx:146`                                                                                                                                            |                                                                                 |

소비 0 (정적 분류 — G0 가 live 로 확정): ActionBar · LinkButton · LabeledValue · RangeSlider · SegmentedControl · SegmentedControlItem · SelectBoxGroup · SelectBox · DateInput · CheckboxGroup · Form · FileTrigger · DropZone · DateField · TimeField · DatePicker · DateRangePicker · ColorField · Card · ProgressBar · Meter · Pagination · Disclosure · Accordion · Slot · CatalogStates + 사용처가 모두 class 를 덮는 Tabs · Modal · Toolbar · RadioGroup.

### 2.3 공유 수동 시트의 처리 규칙

시트마다 규칙을 셋으로 나눈다 (Phase 0 분류표):

| 규칙 종류   | 판정                                                                                                | 빌더 쪽                                  | Preview 쪽 |
| ----------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- |
| 빌더 전용   | `:not([data-catalog-id])` 분기 · 빌더 패널 전용 class (Chat · Event 계열 등) · Preview CSSOM 매치 0 | 빌더 chrome 시트로 이동                  | 삭제 (G3)  |
| 사용자 전용 | `[data-catalog-id]` 분기 · 빌더 CSSOM 매치 0                                                        | —                                        | 유지       |
| 양쪽        | 둘 다 매치 (예: 기본 `.react-aria-Popover`)                                                         | 빌더 chrome 시트에 사본 (빌더 스냅샷 값) | 유지       |

### 2.4 함께 지우거나 바꿀 것

| 대상                                                                                                                                                                                                                                                                                                                                                       | 처리                                                                | Phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| `builder-components.css` (생성 43 · 공유 43 import · 낡은 머리말) · `foundation.css` 빌더 경로                                                                                                                                                                                                                                                             | 빌더 chrome 시트 목록으로 교체 · 머리말 정정                        | 4     |
| `apps/builder/src/index.css:27` 의 `theme.css`                                                                                                                                                                                                                                                                                                             | 빌더 전용 테마 진입 (builder-system + 공유 원시 변수) 으로          | 4     |
| `styles/index.css` (Preview) 의 `theme.css` → `builder-system.css`                                                                                                                                                                                                                                                                                         | Preview 전용 테마 진입 (preview-system + 공유 원시 변수) 으로       | 1     |
| `builderCatalogVars.static.test.ts` · `fixtures/adr295-builder-consumed-generated-baseline.json`                                                                                                                                                                                                                                                           | 새 경계 게이트로 대체 후 삭제                                       | 4     |
| `packages/shared/src/components/styles/__tests__/generatedCssLoadInventory.static.test.ts` · `catalogRuntime/__tests__/s2MissingComponents.test.tsx:96` · `apps/builder/tests/parity/adr297ManualStateParity.browser.test.ts:14` · `adr297DomPaintParity.browser.test.ts:17` · `apps/builder/scripts/adr295BuilderGeneratedSheets.mjs:93-124` (+ `.d.mts`) | 옛 빌더 import 집합 전제를 갱신 또는 삭제                           | 4 · 5 |
| `apps/builder/src/main.tsx:50,109-122` (`/publish/*` route · lazy import) · `openCatalogPublish.ts:19` · `lib/assets/assetUrlResolver.ts:4` (「같은 탭의 `/publish/*` route」 전제)                                                                                                                                                                        | 별도 진입으로 이동 · 이동 URL · 자산 URL 확인                       | 1     |
| `apps/builder/vite.config.ts:336-339` (진입 2) · `.github/workflows/deploy.yml:96-97` (번들 측정 2 진입)                                                                                                                                                                                                                                                   | 진입 `publish/index.html` 추가 · 측정 3 진입                        | 1     |
| `componentRulesTable.ts` 주석 (`:2311` · `:4237-4242` · `:8318` · `:8333-8337` · `:8426` · `:11399-11400` · `:11940-11945` · `:14310` · `:14859-14860` · `:14948-14950` · `:15492`) · `CSSGenerator.ts:489-490`                                                                                                                                            | 주석만 정정 (rule 값 · 선택자 무변경)                               | 6     |
| `.claude/rules/css-tokens.md` §컨트롤 크기 · `ssot-hierarchy.md` D3 · `panel-structure.md` · `canvas-rendering.md` 의 고정 시트 서술                                                                                                                                                                                                                       | 새 경계로 정정                                                      | 6     |
| `package.json` (`test:css-boundary` 새 명령 · `codex:preflight` 에 추가) · `scripts/codex/css-boundary-gate.sh` (새) · `.githooks/pre-push` (CSS · 진입 경로 변경 push 에서 호출 — `PERF_RATCHET` 과 별도)                                                                                                                                                 | 경계 게이트 배선 (G2 실행 경로)                                     | 4     |
| `apps/builder/index.html` `<html>`                                                                                                                                                                                                                                                                                                                         | `data-document="builder"` 정적 속성 (chrome 시트 범위 — Decision 3) | 1     |

## 3. Phase

실행 순서 = 번호 순서. `/publish` 진입 분리 (Phase 1) 가 chrome 시트 (Phase 2 ~) 보다 먼저다 — chrome 시트의 범위 `:root[data-document="builder"]` 는 빌더 문서에 사용자 DOM 이 없을 때만 맞다 (ADR Decision 3).

### Phase 0 — 분류표 · 두 스냅샷 하니스 (G0)

- **빌더 하니스** `apps/builder/scripts/adr305-builder-snapshot.mjs` (headed Playwright, `BUILDER_URL`): 빌더 화면 목록 (Design 패널 Property · Layout · Style · Text · Screen · Data 그리드 + RowForm · 변수 표 · PropertySelect 열린 목록 · PropertyRowMenu · Canvas 간격 입력 · Grid track 메뉴 · 헤더 · 대시보드 · Sign-in · History · Navigator) × 위젯 상태 (휴지 · hover · pressed · selected · disabled · focus-visible · invalid · 열림) → 대상 요소와 직계 부품의 computed style JSON. 열린 overlay (PropertySelect · PropertyRowMenu · Grid track 메뉴 · Dialog · Toast) 는 `document.body` portal 의 요소를 직접 잡고, 그 요소에 `[data-context]` 조상이 없음을 같이 기록한다 (리뷰 round 1 h1 — 앱 div 아래만 재면 portal 이 빠진다).
- **Preview 하니스** `apps/builder/scripts/adr305-preview-snapshot.mjs`: 팔레트 전 컴포넌트를 놓은 프로젝트를 Preview iframe 과 Publish (`dist` 를 `/composition/` prefix 로 정적 서빙) 에서 열어 컴포넌트 × 상태 (같은 행렬 + 열린 overlay) 의 computed style JSON.
- **CSSOM 계수**: 두 문서에서 시트의 규칙마다 매치 요소 수 → §2.3 분류표 (빌더 전용 · 사용자 전용 · 양쪽) 와 §2.1 의 중립 시트 (원시 변수 · `@font-face`) 판정. 정적 분류와 다르면 분류표를 실측대로 (사후 보고).
- 조건 · 대조군은 본문 Gates 머리말. 기준 JSON 은 run artifact, 결론 요약은 §5.

### Phase 1 — `/publish` 별도 진입 · 사용자 쪽 테마 진입 (G4)

- `apps/builder/publish/index.html` (+ 진입 모듈 — publish 앱 · `styles/index.css` · `pretendard.css` 만) · `vite.config.ts` 입력 추가 → 출력 `dist/publish/index.html`.
- `main.tsx` 의 `/publish/*` route · lazy import 삭제.
- **Preview · Publish 테마에서 `builder-system.css` 제거 (옛 Phase 5 에서 앞당김 — 리뷰 round 2 m4)**: Publish 진입은 `apps/publish/src/styles/index.css` → `components/index.css` → `styles/index.css:32` → `theme.css:35` 로 `builder-system.css` 를 싣는다. 사용자 쪽 테마 진입을 따로 두어 (`theme.css` 의 하위 6장 중 `builder-system.css` 를 뺀 목록) `styles/index.css` 가 그것을 싣게 한다. 빌더는 Phase 4 까지 `theme.css` 그대로. Preview · Publish 스냅샷 Δ 0 (빌더 쪽 단계와 독립 — Phase 0 하니스만 있으면 된다).
- `openCatalogPublish.ts` 이동 URL = `new URL("publish/", new URL(import.meta.env.BASE_URL, location.origin))` (dev `/publish/` · production `/composition/publish/`). unit: base `/` · `/composition/` 두 값에서 URL 이 base 아래 · 끝 `/` · `project` query 보존.
- `assetUrlResolver.ts` 의 설치 지점을 새 진입에 둔다.
- `deploy.yml` 번들 측정에 `--entry publish/index.html` 추가 · ADR-201 상한 안.
- 확인 (G4): `dist` 를 `/composition/` prefix 아래 rewrite 없는 정적 서버로 띄워 `/composition/publish/?project=…` 200 · 새로고침 · 빌더에서 Publish 열기 (dev · `dist` 두 곳). 빌더 문서 CSSOM 에서 `[data-catalog-id]` 요소 0.
- `apps/builder/index.html` 의 `<html>` 에 `data-document="builder"` 를 둔다 (아직 이 속성을 읽는 규칙 없음 — 화면 변화 0).
- 같은 base 누락이 Preview iframe 주소에도 있다 (`CatalogPreviewFrame.tsx:209` `src="/preview.html…"`). 이 ADR 범위 밖 — 완료 보고에 후속으로 적는다.

### Phase 2 — 빌더 chrome 시트: 생성 시트 13 가족 (G1)

- 위치: `apps/builder/src/builder/styles/widgets/` 가족별 파일, `@layer builder-system`, 범위 `:root[data-document="builder"]` (body portal 포함). 기존 `form-controls.css` · `inspector-layout.css` · `builder-control-*.css` 와 같은 선택자를 두 파일이 쓰지 않는다 (css-tokens.md) — 겹치면 기존 파일로 합친다.
- 값 = 빌더 하니스 기준 JSON → chrome 토큰. `--catalog-token-*` 금지.
- 옛 시트가 실린 채 빌더 스냅샷 Δ 0 (열린 overlay 의 portal 요소 포함). 커밋 4 ~ 5 묶음 (버튼 · 토글 · 입력 · 선택 · Dialog/Menu/Slider).
- 정적 게이트 신설 `apps/builder/src/builder/styles/__tests__/chromeWidgetSheets.static.test.ts` — widgets 시트의 선택자가 모두 `:root[data-document="builder"]` 범위 · `--catalog-token-` 0 · `@media` 0. 이 파일은 Phase 4 의 전용 명령에 들어간다.

### Phase 3 — 빌더 chrome 시트: 공유 수동 시트의 빌더 몫 (G1)

- §2.3 분류표의 「빌더 전용」 · 「양쪽」 규칙을 빌더 chrome 시트로 (foundation 의 base · forms · overlays · utilities · animations 포함 — 빌더가 쓰는 것만). 범위는 Phase 2 와 같다.
- 옛 시트가 실린 채 빌더 스냅샷 Δ 0. 시트 묶음 단위 커밋.

### Phase 4 — 빌더 문서에서 옛 시트 삭제 · 경계 게이트 배선 (G2)

- `builder-components.css` 에서 생성 43 · 공유 수동 43 import 삭제 · 빌더 테마 진입에서 `preview-system.css` 삭제 · 고정 시트 2 삭제 (사용자 확인 뒤 — `.publish-app` 예외 선택자도 여기서 같이 사라진다. 남은 참조 0 확인).
- 빌더 스냅샷 Δ 0. 다르면 해당 가족을 Phase 2 · 3 방식으로 보강.
- 경계 게이트 (`chromeWidgetSheets.static.test.ts` 에 조항 추가):
  - 세 진입 (`index.html` → `main.tsx` · `preview.html` → `preview/index.tsx` · `publish/index.html` → 그 진입 모듈) 의 import 그래프를 정적으로 펼친다 — 진입 모듈과 그 import 의 `import "*.css"`, CSS `@import`, `node_modules` 시트까지 실제 파일로 해석한다. 배럴만 비교하지 않는다.
  - 빌더 집합 ∩ (Preview ∪ Publish) 집합의 시트마다 postcss 로 파싱해 중립 (`--*` 선언만 있는 규칙 · `@font-face` · 그것을 감싼 `@layer` · 주석만) 인지 확인. Phase 4 시점 교집합 예상 = `pretendard.css` + 공유로 남긴 변수 시트 (`shared-tokens.css` · 팔레트 생성 3 중 Phase 0 판정분). `builder-system.css` 는 Phase 1 에서 사용자 쪽에서 · `preview-system.css` 는 이 Phase 에서 빌더 쪽에서 빠지므로 교집합에 없다.
  - 빌더 소스 CSS 에 `--catalog-token-` 0.
- 배선: `package.json` `test:css-boundary` (= 위 테스트 파일만 vitest 실행) · `scripts/codex/css-boundary-gate.sh` (항상 실행 — TS 변경 조건 없음, CSS 만 바뀐 변경도 대상) 를 `codex:preflight` 에 추가 · `.githooks/pre-push` 에 경로 조건 (`\.css$` · `apps/builder/(index|preview)\.html` · `apps/builder/publish/` · `apps/builder/src/(main|preview/index)\.tsx` · `apps/publish/src/App\.tsx` · `apps/builder/vite\.config\.ts`) 이 맞으면 `pnpm test:css-boundary` — `PERF_RATCHET` 과 별도 블록, 실패 즉시 exit 1.
- 원복 RED (bash 파일 + trap 복원 + cmp): ① `builder-components.css` 에 생성 시트 import 1줄 되돌림 → `pnpm test:css-boundary` nonzero · pre-push 를 그 변경 범위의 stdin 으로 직접 실행해 nonzero ② `pretendard.css` 대신 요소 선택자가 든 임시 시트를 세 진입 공통으로 넣음 → nonzero. 복원 뒤 둘 다 0.
- §2.4 의 Phase 4 테스트 · 스크립트 정리.

### Phase 5 — Preview · Publish 쪽에서 빌더 몫 빼기 (G3)

- 공유였던 수동 시트에서 「빌더 전용」 규칙 삭제 (`:not([data-catalog-id])` 분기의 빌더 쪽 · 빌더 패널 전용 시트) — 시트 하나 · 분기 묶음 하나마다 Preview · Publish 스냅샷 Δ 0. Δ 가 나면 그 규칙은 사용자 쪽으로 재분류하고 남긴다.
- `pnpm validate:sync` diff 0 (생성 CSS 무변경).

### Phase 6 — 문서 · live (G5)

- §2.4 Phase 6 항목 정정 · `pnpm docs:stale-symbols`.
- G5 live (Chrome MCP) · CHANGELOG · ADR `### Live Exercise` · 295 본문에 대체 포인터 · 028 본문에 후속 포인터.

## 4. 커밋 단위

Phase 0 1 · Phase 1 1 ~ 2 · Phase 2 4 ~ 5 · Phase 3 3 ~ 5 · Phase 4 1 ~ 3 · Phase 5 3 ~ 5 · Phase 6 1. 총 14 ~ 22. 각 커밋 뒤 두 스냅샷 Δ 0 이 유지된다 — 중간에서 멈춰도 두 문서의 화면은 같다.

## 5. 실측 기록

(Phase 0 결과를 여기에 요약 — 분류표 · 기준 JSON 은 로컬 run artifact)
