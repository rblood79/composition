# ADR-212 Design Breakdown: Data 패널 편집기 재설계 — 스냅 패널 · `role=grid` 격자 · 요청 도구형 API 편집기

> 본문: [212-data-panel-editor-redesign.md](../212-data-panel-editor-redesign.md) · 리서치 정본: [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §2 · §4-1 · §4-2 · §4-5 · 시안: claude.ai artifact `f7d8327e-490b-4052-98cd-90067f43315c` ("DataTable 패널 개선 시안", Version 6 — 아트보드 원본은 세션 scratchpad `design/src/*.html`, `docs/design/data-panel-redesign/` 이관은 착수 시)

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-09-11, 리서치 §5 판정 ③)

1. **base / 응용**: ADR-152 (참조 계약 + `DataChange` 적용기) = base, 본 ADR = **응용** (사람이 쓰는 편집 표면). 본 ADR 의 모든 쓰기는 `applyDataChange` 를 지난다 — store 직접 mutate 코드 신설 금지.
2. **schema 직교**: 본 ADR 은 collection 저장 형식을 바꾸지 않는다. 신설 타입은 UI 상태 (`gridSelection` · `fieldPanelTarget` · `secretVault` 저장 위치)뿐이다. ADR-213과 `DataChange`를 공유하며, 본 ADR Phase 4는 ADR-213이 제공하는 redactor와 `define_endpoint` · `bind_element` consumer를 사용한다.
3. **의존 방향**: ADR-152 G5 PASS → Phase 2·3. ADR-213 G1~G4 PASS → Phase 4. Phase 1의 표면 골격과 lazy loader는 독립적으로 먼저 가능하다. ADR-013 (Quick Connect) 은 본 ADR Phase 6 위의 응용이다.
4. codex 1차 진입 전 본 lock-in 완료. 판정 ② (dock vs 전체 화면) 는 스냅 패널로 수렴해 대안 D 로만 기록.

## 2. 현행 인벤토리 (2026-09-10 실측 — Phase 0 에서 freeze)

| 표면            | 파일 (행)                                                                                                                            | 문제 (리서치 #)                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 목록 패널       | `panels/datatable/DataTablePanel.tsx` (246) · `components/{DataTableList,ApiEndpointList,VariableList}.tsx`                          | 항목이 `div role=listitem`+onClick (A5) · 상태 배지 없음 (U3 · M8) · React Query 병행 (§1-3)                         |
| 편집 패널 shell | `DataTableEditorPanel.tsx` (477) · `stores/dataTableEditorStore.ts:39-72`                                                            | 목록 store 가 layout visibility 를 직접 토글 — 예외 생명주기 (UI-8)                                                  |
| 테이블 편집기   | `editors/DataTableEditor.tsx` (833) — Schema / Table / Settings                                                                      | 원시 `<table>`+`<input>` (A1 · A2 · U5 · U6) · CSV 전량 교체 (U7) · `useMockData` 전역 토글 (U10)                    |
| API 편집기      | `editors/ApiEndpointEditor.tsx` (885) — Basic / Headers / Body / Response / Run                                                      | 실행이 Run 탭에만 (P1) · Import 가 endpoint 와 연결 안 됨 (U4) · dead 필드 (D5) · 헤더 평문 (P5) · `<pre>` 응답 (P6) |
| 생성            | `editors/DataTableCreator.tsx` (295) · `ApiEndpointCreator.tsx` · `VariableCreator.tsx` (Track 0 신설)                               | 스냅 자리는 확보됨 — 테이블 생성 진입 6종 중 프리셋/빈 테이블만                                                      |
| 등록 · 폭       | `panels/core/panelConfigs.ts` (`datatableEditor.defaultWidth: 560`, Track 0) · `layout/panelWorkspacePolicyV4.ts` `placeOverflowRow` | 필드 패널 (260) 스냅 자리 정책 없음 · 탭 라벨 잘림 규칙 없음 (UI-1)                                                  |
| 알림            | `stores/toast.ts` `globalToast` · `overlay/ConfirmDialog.tsx` (Track 0 신설)                                                         | `role=status` live region 은 Toast 가 담당하는지 확인 (Y4)                                                           |
| i18n            | `i18n/translations.ts` `datatable.*` (ko/en, ADR-200)                                                                                | 자산 — 신규 키는 타입 변경 불요                                                                                      |
| 캔버스          | `workspace/canvas/skia/` overlay (선택 · hover 마커)                                                                                 | 바인딩 배지 없음 (B3)                                                                                                |

## 3. 시안 ↔ Phase 대응

| 아트보드 (artifact f7d8327e)            | 내용                                                   | Phase |
| --------------------------------------- | ------------------------------------------------------ | :---: |
| Main (목록 + 스냅 생성 패널)            | Data 패널 탭 · 배지 · 생성 패널 6 진입                 |   1   |
| ApiList                                 | method · 마지막 실행 · 연결 테이블 배지                |   1   |
| Editor (격자 + 스냅 필드 패널)          | `role=grid` 격자 · 헤더 `+` · 필드 패널 260            |  2·3  |
| Source                                  | "샘플 / 실제 데이터" · 엔드포인트 picker · 실행 정책   |   5   |
| Failure                                 | 0행 · 오류 상태 3곳 동일 표시 (목록 · 편집기 · 캔버스) |  1·6  |
| Widths (폭 반응)                        | 목록 233 · 편집기 300/636 · 필드 260 · 탭 아이콘 모드  |   1   |
| Workspace (3열)                         | 목록 \| 격자 \| 필드 — dock 안 3열                     |   3   |
| AgentReview                             | (ADR-213 몫 — 본 ADR 은 미참조)                        |   —   |
| VarsIndex · ElementState · ActionPicker | (ADR-214 몫)                                           |   —   |
| FullScreenAlt (page-2)                  | 기각 대안 D 의 low-fi                                  |   —   |

## 4. Phase 계획

### Phase 0 — Inventory freeze (게이트 G0) — 완료 2026-09-12 ([evidence](../evidence/212-p0-inventory.md))

- [x] `DataTableEditor.tsx` · `ApiEndpointEditor.tsx` 분할 지도 — 서브 에디터 경계 (Schema/Table/Settings · Basic/Headers/Body/Response/Run) 와 공유 상태 목록 (evidence §1 — Run 과 Response 가 실행 결과를 따로 든다)
- [x] 두 편집기의 store 쓰기 호출 전수 (`updateCollection` · `updateApiEndpoint` · `createDataTable` …) → 152 적용기 wrapper 로 대체 가능 여부 표 (evidence §2 — collection 3종은 이미 wrapper, **endpoint 3종은 직접 쓰기 · History 0** → Phase 4 `define_endpoint` / `delete_endpoint`)
- [x] 기존 테스트 인벤토리 (`*.i18n.test.tsx` · `fix-live.mjs` 13 체크) — 유지/대체 표 (evidence §3 — Track 0 live 스크립트는 scratchpad 소실, 본 ADR live 는 `scripts/adr212-*-live.mjs` 로 커밋)
- [x] Toast 가 `role=status` 를 내는지, RAC Toast (landmark · F6) 여부 실측 → Y4 처리 방식 결정 (evidence §4 — 토스트는 전부 `role=alert`; `role=status` 영역은 Phase 1 에서 Data 패널에 신설, 토스트 전역 변경 없음)
- [x] `BuilderCore.tsx` → `panels/index.ts` → `panelConfigs.ts` 정적 import 체인과 production metafile에서 editor 구현의 initial bytes before arm 기록 (evidence §5 — initial JS gzip 1,332,608 · 편집기 구현 40,392 raw B in initial, `scripts/adr212-editor-initial-bytes.mjs` sourcemap 귀속; **전체 initial 은 215 상한을 착수 전 +19,008 초과** — 사용자 보고 항목)
- [x] `Authorization` · `Proxy-Authorization` · `X-API-Key` · `Api-Key` 기존 평문 endpoint 건수와 export/postMessage/AI payload 경로 기록 (evidence §6 — 평문 1 건, 운반 4 경로 + AI 는 213 redactor 로 이미 마스킹)
- [x] 아트보드 원본을 `docs/design/data-panel-redesign/` 로 이관 (canvas.json + `*.dc.html`) — artifact `f7d8327e` 에서 추출 (13 아트보드 + 캡처 5, 로컬 전용)
- [x] **착수 조건**: Phase 2·3은 ADR-152 G5 PASS, Phase 4는 ADR-213 G1~~G4 PASS 후 — 둘 다 충족 (152 G5 09-11 · 213 Implemented 09-12). R5 Variables 탭 조건부 숨김은 ADR-214 Phase 0~~1 merge (09-11) 로 폐기 — 탭은 214 소유, 현행 유지

### Phase 1 — 표면 골격 (152 독립)

- [ ] 목록 패널 이름 "Data" (i18n `datatable.panelTitle`), 탭 Tables / APIs / Variables — Variables 탭은 ADR-214 (Phase 0~1 merge 09-11) 소유라 현행 유지 (R5 폐기, Phase 0)
- [ ] 목록 항목을 버튼으로 (RAC `ListBox` 또는 `GridList` — 키보드 열림, A5) + 상태 배지 (UI-6): 테이블 = 필드 수 · 행 수 · 소스 · 사용처 수 (152 `resolveBoundCollection` 역참조) · 0행/오류; API = method · 마지막 실행 (status · ms · 상대 시각) · 연결 테이블
- [ ] 탭 라벨 잘림 규칙 — `.panel-tablist` 컨테이너 폭 < 360 이면 아이콘 + tooltip (`panel-system.css`, Navigator · Styles 도 같은 클래스라 공통 적용 — 회귀 확인)
- [ ] 편집 패널 생명주기 일반화 (UI-8) — `dataTableEditorStore.open(mode)` 가 `activatePanelWorkspacePanelV4` 경유, visibility 직접 토글 제거
- [ ] 필드 패널 등록 (`panelConfigs.ts` `datatableField`: minWidth 240 · defaultWidth 260) + `placeOverflowRow` 가 편집기 옆 열에 스냅, 자리 없으면 아래 행 (Widths 아트보드) — 정책 test 1개
- [ ] `panelConfigs.ts`에서 editor 구현을 `React.lazy` loader로 로드하고 `Suspense` fallback·열림 포커스 복귀를 고정 — production initial chunk에 editor 구현 bytes 0
- [ ] 생성 패널 진입 6종 (Main 아트보드): 빈 테이블 · 프리셋 · 붙여넣기 · CSV · API 로 · AI 로 (AI 는 ADR-213 전까지 비활성 + tooltip)
- [ ] `role=status` live region — Toast 가 담당하지 못하면 패널 하단 `aria-live="polite"` 1개 (Y4)

### Phase 2 — 격자 (게이트 G1)

- [ ] `DataGrid` 신설 (`panels/datatable/grid/`) — RAC `Table` (`role=grid`, `keyboardNavigationBehavior="tab"`) + `Virtualizer` + `aria-rowcount/colcount`
- [ ] 셀 edit mode 자체 구현 — 셀 선택 → Enter / F2 / 타이핑 진입, Esc 취소, Enter commit + 아래, Tab commit + 오른쪽; 셀 `<input>` `onKeyDown` 에서 RAC 키 전파 차단 (R1 — 충돌 매트릭스 test: Arrow · Home/End · Enter · Tab · Esc × 편집/비편집)
- [ ] 긴 값 · JSON · date/datetime 은 Popover 편집 (RAC 권고 Y2)
- [ ] 셀 input `aria-labelledby` = 열 헤더 (A2) · id/computed 셀 `aria-readonly`
- [ ] 붙여넣기 → 행 자동 생성 + 타입 강제, 초과 열은 "새 필드로 추가?" (UX-3); 파싱 실패 셀은 비우고 셀 단위 표시 (0 으로 바꾸지 않음)
- [ ] 모든 쓰기는 `applyDataChange({ op: "set_cell" | "insert_rows" | "remove_rows" })` — undo 는 152 G5 경로
- [ ] 데이터 패널 포커스 중 `⌘Z` 가 History data 스택으로 (152 R9 dispatcher 위에 라우팅만)
- [ ] Schema 탭 제거 → 격자 헤더가 스키마 (Phase 3 필드 패널과 함께 전환 — 두 Phase 는 같은 커밋 열에서)
- [ ] G1 live: 키보드만으로 셀 3개 편집 + 행 추가 + undo · axe critical 0. 고정 100행×10열 fixture, foreground Chromium · visible · DPR2, cold 1+warm 30에서 입력 프레임 p95 ≤ 16ms

### Phase 3 — 필드 패널 (스냅, 게이트 G2)

- [ ] 헤더 `+` → 필드 패널 (이름 · 검색 가능한 타입 목록 아이콘+라벨 (Y7) · required · default · description); 헤더 클릭 → 같은 패널이 그 필드로 전환
- [ ] "사용처 N" (152 역참조: 바인딩 fieldMap · `{#id}` 템플릿 · 차트 시리즈) · 삭제는 사용처 0 이면 즉시, 아니면 `ConfirmDialog` 에 사용처 목록
- [ ] 타입 변경 미리보기 — "12행 중 3행이 숫자가 아님 — 비움 / 유지" (UX-5) → `update_field` + `set_cell` 묶음 1 DataChange
- [ ] 닫힘 시 포커스 복귀 (호출 헤더 셀), 삭제로 사라지면 다음 헤더 (Y5)
- [ ] G2 live: 필드 패널에서 rename → 152 G4 시나리오 재확인 (Skia · DOM · 차트 값 유지, 템플릿 새 이름)

### Phase 4 — API 편집기 (게이트 G3, ADR-213 G1~G4 PASS 뒤 착수)

- [ ] 상단 고정 `[Method ▾][URL][Send]` 바 (UI-4) — 이름은 `suggestApiName` (Track 0 자산), 탭 Params / Headers / Body / Auth / Response
- [ ] Params 탭 = queryParams · path `{{key}}` 변수 (환경값 `{{env.NAME}}` 치환은 ADR-214 Environment — 그 전엔 인자 params 만)
- [ ] key-value 편집기 a11y (Y6): 행별 Remove 고유 이름 · Add 후 새 key 포커스 · Bulk Edit 텍스트 대안; Body 는 `aria-label` + `aria-multiline` (Y8)
- [ ] 응답 뷰어: status · time · size 한 줄 (`role=status`) + Pretty / Raw / **Schema** 탭 — Schema = `columnDetector` 재사용 (키 · 타입 · 포함 · ID) + 배열 후보 **추천** (전수 탐색, `resolveResponseData` 확장 — 텍스트 path + 미리보기, P7)
- [ ] "테이블로 저장" 한 방향 (UX-2): ADR-213 cross-store coordinator에 `DataChange [create_collection, set_source(api), define_endpoint(targetCollectionId), bind_element?]`를 전달한다. 전체 op preflight 뒤 1회 commit/History/inverse를 만들고 중간 실패 시 collection·endpoint·canonical document를 모두 rollback한다. 기존 테이블에 잇기도 같은 자리. Response 탭의 자유 텍스트 Target 제거 (U4)
- [ ] dead 필드 정리 (D5): Field Mapping · pagination · serverConfig · retryCount UI 제거 (타입은 read 호환 잔존, 소비처 붙을 때 복귀)
- [ ] Auth 탭 프리셋 None / Bearer / API Key (header · query) / Basic (P4) — 값은 마스킹, 저장은 프로젝트 로컬 vault, 문서에는 `{{secret.NAME}}`. 기존 평문은 로드 시 vault로 lazy 이동하고 공유 redactor가 export/postMessage/AI payload를 차단한다
- [ ] cURL 붙여넣기 → 요청 바 + 탭 채움 (규칙 파서, P9). OpenAPI 는 범위 외
- [ ] production CORS 경고 (UX-8): `import.meta.env.DEV` 아닌 환경에서 실행 전 배너 — 서버 실행은 범위 외 (publish 방침)
- [ ] G3 live: URL→Send→추천 path→저장→ListBox 행 표시. 각 op 위치 failure injection에서 전 store/문서 원상 및 History 0, 성공은 History 1·undo 원상. 기존 평문 fixture migration 뒤 export/postMessage/AI payload에 원문 secret 0, production CORS 경고 표시

### Phase 5 — 데이터 유입 · 소스 (Source 아트보드)

- [ ] CSV / JSON import 미리보기 — 헤더행 토글 · 타입 자동 감지 · 열별 기존/새/무시 매핑 · append vs replace (UX-3, M2) → `DataChange` 1개 (`replace_rows` 또는 `insert_rows` + `add_field`)
- [ ] Settings 탭 → "데이터 소스": 샘플 데이터 사용 / 실제 데이터 사용 + 엔드포인트 picker (자유 텍스트 금지) + 실행 정책 (열 때 자동 · 수동 · N초마다) (UX-6). `useMockData` 는 read 호환
- [ ] `runtimeData` 마지막 성공 응답을 IndexedDB 에 저장 — 새로고침 후 빈 화면 없음, "캐시됨 · 다시 불러오기" 표시
- [ ] 0행 · 오류 상태를 목록 배지 · 편집기 상단 · (Phase 6) 캔버스 배지에 같은 값으로 (Failure 아트보드)

### Phase 6 — 인스펙터 동선 + 캔버스 배지

- [ ] `PropertyDataBinding` Select 옆 "새 테이블 만들기 (프리셋 / 붙여넣기)" · "이 테이블 열기" · "사용처 N" (UX-1, B4) — 열기는 `dataTableEditorStore.open` (Phase 1 일반화 경로)
- [ ] 캔버스 바인딩 배지 (UI-7): 바인딩된 collection 요소에 Skia overlay 아이콘 + 테이블 이름, 0행/오류면 상태색 — 선택/hover 마커와 같은 overlay 층, Preview/Publish 없음 (D3 대칭 대상 아님 — `/cross-check` 불요, Skia 픽셀 하니스로 존재만 확인)
- [ ] 배지 hit 영역 클릭 → 편집기 열기

### Phase 7 — a11y 검수 + closure

- [ ] 리서치 §4-5 검수 항목 전수 (격자 · 알림 · 다이얼로그 · key-value · 타입 아이콘 · 목록 버튼) — 키보드만 시나리오 5 + axe
- [ ] `prefers-reduced-motion` · 아이콘 버튼 접근 가능한 이름 grep
- [ ] 원본 삭제 승인: `DataTableEditor.tsx` Schema/Table 서브 에디터 · `ApiEndpointEditor.tsx` Run 탭 — 대체 확인 후 별도 커밋
- [ ] CHANGELOG (Features · Accessibility) · ADR README · `### Live Exercise`

## 5. 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                                                                    | Phase | 변경                                                   |
| --------------------------------------------------------------------------------------- | :---: | ------------------------------------------------------ |
| `panels/datatable/DataTablePanel.tsx` · `components/*List.tsx`                          |   1   | 패널명 · 버튼 항목 · 배지 · Variables 조건부 탭        |
| `panels/core/panelConfigs.ts` · `layout/panelWorkspacePolicyV4.ts`                      |   1   | editor lazy loader · `datatableField` 등록 · 스냅 정책 |
| `styles/panel-system.css` (`.panel-tablist`)                                            |   1   | < 360 아이콘 모드                                      |
| `stores/dataTableEditorStore.ts`                                                        |   1   | 일반 활성화 경로                                       |
| `panels/datatable/grid/DataGrid.tsx` (+ `cellEditMode.ts` · `paste.ts`) (신규)          |   2   | RAC Table `role=grid` + edit mode + Virtualizer        |
| `panels/datatable/editors/FieldPanel.tsx` (신규)                                        |   3   | 스냅 필드 패널                                         |
| `panels/datatable/editors/DataTableEditor.tsx`                                          | 2·3·5 | Schema/Table 탭 → 격자 · Settings → 데이터 소스        |
| `panels/datatable/editors/api/{RequestBar,ResponseViewer,SchemaTab,AuthTab}.tsx` (신규) |   4   | 요청 도구형 분할                                       |
| `panels/datatable/editors/ApiEndpointEditor.tsx`                                        |   4   | 분할 후 shell                                          |
| `utils/data/responseData.ts` · `columnDetector.ts`                                      |   4   | 배열 후보 전수 추천                                    |
| `stores/secretVault.ts` (신규) · export envelope 필터                                   |   4   | secret 마스킹 · 제외                                   |
| `utils/data/csvImport.ts` (신규)                                                        |   5   | 미리보기 · 매핑                                        |
| `stores/utils/dataActions.ts`                                                           |   5   | runtimeData 저장                                       |
| `components/property/PropertyDataBinding.tsx`                                           |   6   | 동선 3 버튼                                            |
| `workspace/canvas/skia/overlay/*` (binding badge)                                       |   6   | Skia overlay 배지                                      |
| `i18n/translations.ts` (`datatable.*`)                                                  | 전부  | 키 추가                                                |

## 6. 검증 전략

- 정적: edit mode 키 충돌 매트릭스 · 스냅 정책 · production metafile editor initial bytes 0 · legacy secret migration 및 export/postMessage/AI payload 원문 0 · 쓰기 경로 grep 가드
- live (게이트마다 1회, Playwright headless — Chrome MCP hidden 탭 우회 패턴 `datatable-shots-560.mjs` · `fix-live.mjs` 재사용): G1 키보드 격자 · G2 rename · G3 API 흐름 · G4 native dialog 0 + status live region
- 성능: 고정 100행×10열, foreground Chromium/DPR2/visible, cold 1+warm 30의 입력 p95 ≤16ms. 패널 열기/닫기/리사이즈 p95 ≤ before +1ms, >50ms long task 추가 0. production metafile의 editor initial bytes 0과 실행 시 활성 bundle 정책 PASS
- 판독 루프: `.claude/rules/review-loop-closure.md` — phase 당 1 + 수리 1
