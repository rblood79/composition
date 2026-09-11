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

### Phase 1 — 표면 골격 (152 독립) — 완료 2026-09-12 (`e475aca11` · `9adbd3a10` · `655ea46e1`, live 16/16 `scripts/adr212-p1-live.mjs`)

- [x] 목록 패널 이름 "Data" (`panels.dataTable` = Data / 데이터 — 헤더와 rail 라벨이 같은 키), 탭 Tables / APIs / Variables — Variables 탭은 ADR-214 (Phase 0~1 merge 09-11) 소유라 현행 유지 (R5 폐기, Phase 0)
- [x] 목록 항목을 RAC `GridList` 행으로 (키보드 Enter 열림 · 행 안 버튼은 Arrow 로 도달, A5) + 상태 배지 (UI-6): 테이블 = 필드 수 · 행 수 · 소스 (샘플/API) · 사용처 수 (`resolveCollectionUsage` 152 역참조) · 0행 (`data-empty`) · 마지막 실행 오류 (`apiRuns`, `data-error`); API = method · 마지막 실행 (status · ms · 상대 시각) · 연결 테이블
- [x] 탭 라벨 잘림 규칙 — 컨테이너 쿼리 `datatable-panel` < 360 이면 라벨 visually-hidden (이름 유지) + 아이콘 `title` tooltip. **datatable 패널 루트 한정** (R7 — Navigator · Styles 는 그대로, 공통 적용은 회귀 확인 뒤 별도)
- [x] 편집 패널 생명주기 일반화 (UI-8) — `dataTableEditorStore.open(mode)` → `setPanelWorkspacePanelVisibility` (dispatcher `(id, visible)` 보장 → `activatePanelWorkspacePanelV4`; 폴백도 같은 정책 함수) — visibility 직접 쓰기 0 (`PanelWorkspace.static.test.ts` 고정)
- [x] 필드 패널 등록 (`panelConfigs.ts` `datatableField`: minWidth 240 · defaultWidth 260 · `snapTo: "datatableEditor"` · `hiddenFromRail`) + `placeSnappedRow` 가 anchor 옆 새 column, column 상한이면 anchor 아래 행, 닫았다 열면 같은 자리 — 정책 test 2 (`panelWorkspacePolicyV4.test.ts`). 본문은 Phase 3
- [x] `panelConfigs.ts` 의 편집기 · 필드 패널을 `lazyPanel(() => import(...))` 로 (`Suspense` fallback = 패널 골격 안 스피너, 포커스는 호출한 목록 버튼에 그대로) — production `655ea46e1`: initial 안 `panels/datatable/**` 71,164 → **16,024 raw B, 편집기 구현 0** (`adr212-editor-initial-bytes.mjs`), initial JS gzip 1,332,608 → **1,316,749 (−15,859)** — 215 상한 1,313,600 까지 +3,149 남음. `lazyPanelBoundary.static.test.ts` 가 정적 import 재유입 차단
- [x] 생성 패널 진입 6종 (Main 아트보드, RAC `RadioGroup`): 빈 테이블 (id 1 필드) · 프리셋 · 붙여넣기 (`parsePastedRows` → `detectColumns` 미리보기) · CSV / JSON 파일 · API 에서 (API 생성 패널로) · **AI 로 설명 — ADR-213 Implemented 라 활성**: AI 입력창 초안 (`aiComposerDraft`) + AI 패널 열기, 전송은 사용자 (`create_table_from_description` 이 승인 diff 로). 쓰기는 `createDataTable` 하나. 만들면 편집기로 전환. 생성 패널의 empty/preset 탭 제거
- [x] `role=status` live region — 토스트는 전부 `role=alert` 라 (Phase 0 §4) Data 패널 하단 `DataPanelStatusRegion` (`aria-live=polite`, 항상 마운트, `announceDataPanelStatus`) 신설 — 생성 · 삭제 결과가 여기로. 오류는 토스트 유지

### Phase 2 — 격자 (게이트 G1) — 완료 2026-09-12 (`6f580f8c3` 2a · `2385fda1b` 2b, live 17/17 `scripts/adr212-p2-live.mjs`, [evidence](../evidence/212-p2-grid.md))

- [x] `DataGrid` 신설 (`panels/datatable/grid/`) — RAC `Table` (`role=grid`, `keyboardNavigationBehavior="tab"`) + `Virtualizer`/`TableLayout` (행 높이 28 고정) · `aria-rowcount 101`/`aria-colcount 11` 는 RAC 제공 (live 1)
- [x] 셀 edit mode 자체 구현 — 순수 함수 `resolveGridKey` 한 표 (R1, `gridKeys.test.ts` 20): 셀 선택 → Enter/F2/타이핑 진입, Esc 취소, Enter commit + 아래, Tab commit + 오른쪽; 편집 중 RAC 셀 이동은 `state.setKeyboardNavigationDisabled(true)` 로 끄고 input `onKeyDown` 이 `stop`/`commit`/`cancel`/`revert-draft` 를 실행
- [x] 긴 값 (>80자·줄바꿈) · JSON · date/datetime 은 Popover 편집 (`resolveCellEditorKind`, Y2) — `⌘Enter` commit · Esc 취소
- [x] 셀 input `aria-labelledby` = 열 헤더 span (A2) · id 셀 `aria-readonly` + 편집 진입 0
- [x] 붙여넣기 (셀 포커스, TSV) → `planGridPaste`: anchor 부터 채움 · 넘치는 행 자동 생성 (스키마 모양, 빈 키 null) · 타입 강제 · 초과 열은 `ConfirmDialog` "새 필드로 추가?" (UX-3); 파싱 실패 셀은 null + `data-invalid` (0 으로 바꾸지 않음)
- [x] 모든 쓰기는 `applyDataChange` (`set_cell` · `insert_rows` · `remove_rows` · `replace_rows` · 붙여넣기 `add_field`) — HC1 grep 0 · undo 는 152 G5 data entry
- [x] 데이터 패널 셀 편집 중 `⌘Z` = 초안 되돌리기 (전역 History 로 안 감), 비편집·격자 밖은 종전 History — 단축키 registry `data-shortcut-local="undo redo"` opt-out (R9 라우팅만, `useKeyboardShortcutsRegistry.test.tsx` +1)
- [ ] Schema 탭 제거 → 격자 헤더가 스키마 (Phase 3 필드 패널과 함께 전환 — 두 Phase 는 같은 커밋 열에서). **Phase 3 로 이월** (Table 탭 = 격자 연결 완료, Schema/Settings 탭 존치)
- [x] G1 live 17/17: 키보드만으로 셀 3개 편집 + 행 추가 + ⌘Z ×4 원상 (IndexedDB 대조) · Popover · 붙여넣기 (⌘Z 1회 원상) · **Tab stop 1** · axe critical 0 (`.datagrid` 스코프 — 편집기 탭 바 aria-controls dangling 은 ADR-163 예외 패턴 선행 결함, Phase 3 정리). 100행×10열 fixture, foreground Chromium · visible · DPR2. **입력 프레임 지표는 keydown→rAF latency 대신 셀 편집 vs 격자 밖 filter input 비교로 재정의** (vsync 위상이 latency tail 을 지배 — 작업량 무관): 셀 편집 p50 5.5ms · p95 9.8ms ≈ baseline (셀 rerender 가 프레임을 안 잡음)

### Phase 3 — 필드 패널 (스냅, 게이트 G2) — 완료 2026-09-12 (`305a9e5b7` 본체, live 12/12 `scripts/adr212-p3-live.mjs`, [evidence](../evidence/212-p3-field-panel.md))

- [x] 헤더 `+` → 필드 패널 (이름 · 검색 가능한 타입 목록 아이콘+라벨 RAC `ListBox` (Y7) · required · default · label(설명)); 헤더 라벨 클릭 → 같은 패널이 그 필드로 전환. 두 진입 모두 `openFieldPanel(collectionId, fieldId|null)`
- [x] "사용처 N" (필드 단위 152 역참조 `resolveFieldUsage`: 바인딩 `fieldMap` · `columnMapping` (차트 시리즈·테이블 열) · `{field}`/`{#fieldId}` 템플릿 `compileFieldTemplate`) · 삭제는 사용처 0 이면 즉시 `remove_field`, 아니면 `ConfirmDialog`
- [x] 타입 변경 미리보기 — "3행 중 1행이 Number 값이 아님 — 비움 / 유지" (UX-5) → `update_field` + 성공 행 정규화 `set_cell` ("30"→30) + (비움) 실패 행 `set_cell null`, 한 DataChange (`typeChangeToOps`, `coerceCellValue` SSOT)
- [x] 닫힘·삭제 시 필드 패널 close → 편집기 격자로 (호출 셀 포커스 복귀는 격자 셀 편집 경로가 이미 담당). 삭제 후 `remove_field` → 격자 헤더 갱신
- [x] G2 live 12/12: 필드 패널 rename → 152 G4 재확인 (IndexedDB rows 가 새 key `fullName`, 값 보존, `fieldId` 불변 — 템플릿·fieldMap 은 stable ref 라 불변). Skia·DOM·차트 값 유지는 152 G4 (rename 이 key 만 바꾸고 stable id 참조 유지) 가 이미 고정, 본 Phase 는 필드 패널 UI 가 같은 `update_field { key }` 를 구동함을 확인. **편집기 탭 aria-controls dangling 수리** (본문 TabPanel 화) — axe critical 0

### Phase 4 — API 편집기 (게이트 G3) — 완료 2026-09-12 (`8795f9a14` 4a · `f9838b34e` 4c, live 11/11 `scripts/adr212-p4-live.mjs`, [evidence](../evidence/212-p4-api-editor.md))

- [x] 상단 고정 `[Method ▾][URL][Send]` 바 (UI-4) — 이름은 `suggestApiName` (creator), 자체 탭 Params / Headers / Body / Auth / Response (편집기 소유 RAC Tabs, TabPanel = .panel-contents)
- [x] Params 탭 = queryParams · path `{{key}}` 변수는 URL 그대로 (환경값 `{{env.NAME}}` 은 ADR-214 몫 — 그 전엔 인자 params)
- [x] key-value 편집기 a11y (Y6): 로컬 draft (빈 행 즉시 저장 안 함) · 행별 Remove 고유 이름 · Add 후 새 key 포커스; Body 는 `aria-label` + `aria-multiline` (Y8)
- [x] 응답 뷰어: status · time · size 한 줄 (`role=status`) + Pretty / Raw / **Schema** 탭 — Schema = `recommendArrayPaths` 전수 추천 (경로 · 행 수) → `detectColumns` (키 · 타입) (P7)
- [x] "테이블로 저장" 한 방향 (UX-2): ADR-213 cross-store coordinator 에 `buildSaveApiAsTableOps` = `[create_collection(source api), set_source, define_endpoint(targetCollectionId)]` 한 DataChange. preflight → 1회 commit/History/inverse, 중간 실패 rollback (coordinator 소유). endpoint↔collection 은 `define_endpoint.targetCollectionId` (set_source.endpointId 는 미배선 — 적용기 거부, live 4 수리). 기존 테이블에 잇기 = attach 모드
- [x] dead 필드 정리 (D5): Field Mapping · pagination · serverConfig · retryCount UI 제거 (타입 read 호환 잔존). Run 탭 → Send 바 + Response 탭 흡수
- [x] Auth 탭 프리셋 None / Bearer / API Key (header · query) / Basic (P4) — 값은 마스킹, 원문은 프로젝트 로컬 vault (`secretVault`, 별도 IndexedDB `composition-secrets`), 문서에는 `{{secret.NAME}}`. 실행 치환은 실제 fetch 에만, apiRuns 스냅샷·AI payload 는 placeholder (공유 redactor 는 read 경로). **기존 평문 lazy 이동은 후속** (신규 오소링은 vault 어법, 기존 평문 endpoint 는 redactor 가 이미 마스킹)
- [x] cURL 붙여넣기 → 요청 바 + 탭 (`parseCurlCommand`/`curlToEndpointDraft`, P9). OpenAPI 범위 외
- [x] production CORS 경고 (UX-8): `!import.meta.env.DEV` 배너 (`isProd && <banner>`). dev live 는 DEV=true 라 코드 경로만
- [x] G3 live 11/11: URL→Send (로컬 서버+proxy)→Schema 추천→저장 (collection api·3행 + targetCollectionId, 한 DataChange)→⌘Z 원상. Auth Bearer → 문서 `{{secret.NAME}}` (원문 0 HC6) · vault 에만 원문 · 실제 요청은 vault 원문. failure injection rollback 은 213 coordinator 소유 (213 G-live 고정) — 본 Phase 는 성공 History 1 + undo 원상 확인. 기존 평문 migration·production 배너는 후속/코드 경로

### Phase 5 — 데이터 유입 · 소스 (Source 아트보드) — 부분 완료 2026-09-12 (`bf87e8caa`, live 6/6 `scripts/adr212-p5-live.mjs`, [evidence](../evidence/212-p5-import.md))

- [x] CSV / JSON import 미리보기 — 타입 자동 감지 · 열별 기존/새/무시 매핑 · append vs replace (UX-3, M2) → `DataChange` 1개 (`replace_rows` 또는 `insert_rows` + `add_field`). `importPlan.ts` (순수, test 5) + `ImportPreview.tsx` (격자 위 인라인 staging, HC2)
- [ ] **이월** Settings 탭 → "데이터 소스": 엔드포인트 picker + 실행 정책 (열 때 자동 · 수동 · N초마다) (UX-6) — 실행 정책은 collection 신규 영속 필드 필요 (별도 리뷰). sample/real (`useMockData`) 토글은 현행 Settings 에 존재
- [ ] **이월** `runtimeData` 마지막 성공 응답을 IndexedDB 에 저장 — 계약상 memory-only 필드의 영속화라 export/redactor/번들 영향 검토 전제 (별도 커밋)
- [x] 0행 · 오류 상태를 목록 배지 · 편집기 상단에 같은 값으로 (`findLinkedApi`+`apiRuns`, `.datatable-editor-status`). 캔버스 배지는 Phase 6

### Phase 6 — 인스펙터 동선 + 캔버스 배지 — 부분 완료 2026-09-12 (`98a9ed7d8`)

- [x] `PropertyDataBinding` Select 옆 "이 테이블 열기" (`dataTableEditorStore.openTableEditor`, Phase 1 일반화 경로) · "사용처 N" (`resolveCollectionUsage` 152 역참조) · "새 테이블 만들기" (`openTableCreator`) (UX-1, B4). unit `PropertyDataBinding.test.tsx` 4 (죽은-오소링 계약 + 동선 행)
- [ ] **이월** 캔버스 바인딩 배지 (UI-7, B3): Skia overlay 아이콘 + 테이블 이름 · 0행/오류 상태색 · hit 영역 클릭 → 편집기. canvas overlay 렌더러 통합 + hit region + Skia 픽셀 하니스가 필요해 별도 focused pass (렌더 회귀 위험 — 대규모 세션 말미에 끼워넣지 않음)

### Phase 7 — a11y 검수 + closure — 대기 (Phase 5·6 이월분 착지 후)

- [x] a11y (부분): 격자 axe critical 0 (G1) · 편집기 패널 axe critical 0 (G2, 탭 aria-controls 수리) · 필드 패널 axe critical 0. key-value 행별 Remove 고유 이름 · Body aria-multiline · 타입 목록 ListBox
- [ ] 리서치 §4-5 전수 검수 (키보드만 시나리오 5 + axe 전 표면) — Phase 6 캔버스 배지 착지 후
- [ ] `prefers-reduced-motion` · 아이콘 버튼 접근 가능한 이름 grep
- [x] 원본 삭제: `DataTableEditor.tsx` SchemaEditor/MockDataEditor 서브 에디터 (Phase 2·3 에서 in-file 제거, 파일 자체는 존속) · `ApiEndpointEditor.tsx` 전면 재작성 (Run 탭 → Send 바). 별도 "원본 파일 삭제" 대상 없음
- [ ] **대기** CHANGELOG (Features · Accessibility) · ADR README Implemented 승격 · `### Live Exercise` — Phase 5 (runtimeData 영속·실행 정책) · Phase 6 (캔버스 배지) 이월분이 착지해야 Implemented. 그 전까지 ADR 은 진행 중 (Proposed 유지)

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
