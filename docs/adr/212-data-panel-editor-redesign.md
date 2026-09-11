# ADR-212: Data 패널 편집기 재설계 — 스냅 패널 · `role=grid` 격자 · 요청 도구형 API 편집기

## Status

Proposed — 2026-09-11

> **선행 의존**: [ADR-152](completed/152-data-panel-collection-binding-integration.md) 는 Implemented 이며 `fieldId` · `DataChange` 적용기 · store 단일화가 본 ADR 의 base 다. Phase 2·3 은 ADR-152 G5 PASS 를 재확인한 뒤 착수한다. Phase 4의 공유 redactor와 원자적 `define_endpoint` · `bind_element` 소비자는 [ADR-213](213-data-tool-contract-propose-review-apply.md) Phase 1~~4가 소유하므로 ADR-213 G1~~G4 PASS 뒤 착수한다. Phase 1 (표면 골격과 lazy 경계) 은 두 의존과 독립이다. base/응용 분류와 fork 4 질문 lock-in 은 breakdown §1 (사용자 confirm 2026-09-11 — 리서치 §5 판정 ③ "Track 2 · 3 을 ADR 둘로").

## Context

빌더의 데이터 편집 표면은 `datatable` (목록) · `datatableEditor` (편집) 두 dock 패널이다. 2026-09-10 리서치 ([DATA_PANEL_REDESIGN_RESEARCH_2026-09](../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md)) 가 live 캡처와 코드로 실측한 결과, 결함 5 (Track 0 으로 D1 · D2 · U1 · U2 수리 완료 `66f9cb28b`, D3 은 152 몫, D4 · D5 는 본 ADR) 외에 **사용성 차단 11 · 접근성 6** 이 남아 있고, 그 대부분이 편집기의 구조에서 온다:

- 격자가 원시 `<table>` 안의 독립 `<input>` 이라 (`editors/DataTableEditor.tsx:563-603`) 스크린리더가 "편집 가능한 격자" 를 인식하지 못하고 Tab 이 셀 수만큼 (10×10 = 100 stop) 늘어난다 (A1 · A2). 키보드 셀 이동 · 다중 선택 · 붙여넣기 · 정렬 · 열 폭이 없다 (U5). 셀 commit 이 blur 뿐이고 IME 회피용 `key` 리마운트를 쓴다 (U6 — `:579-588` · `:684-696`).
- API 편집기는 실행이 Run 탭에만 있고 (P1), Import 가 새 테이블을 만들되 endpoint 와 연결하지 않아 사용자가 이름을 다시 타이핑한다 (U4 — `editors/ApiEndpointEditor.tsx:687-692` · `:267-274`). Response 탭 Field Mapping · pagination · serverConfig · retryCount 는 저장만 되고 소비처 0 (D5). 헤더 값이 평문으로 IndexedDB 와 export envelope 에 실리고 (P5), production 실행은 CORS 로 실패한다 (D4 — `stores/utils/dataActions.ts:611-618` vite dev 미들웨어 한정).
- 목록 항목이 `div role=listitem` + `onClick` 이라 키보드로 열 수 없고 (A5 — `components/DataTableList.tsx:110-115`), 0행 · 오류 · 사용처가 어디에도 보이지 않는다 (M8 · U3 · U9). 편집 패널 생명주기를 목록 store 가 layout store 를 직접 만져 소유한다 (`stores/dataTableEditorStore.ts:39-72`, UI-8).
- 사용자 판정 (2026-09-10 시안 검토): 생성 (새 테이블 · 새 API) 과 필드 편집은 **팝오버가 아니라 옆에 스냅되는 workspace 패널** — 편집기가 목록 옆에 스냅되는 기존 어법을 따른다. 그 결과 목록 | 격자 | 필드 3열이 dock 안에서 생기므로 "별도 전체 화면 워크스페이스" 대안은 캔버스가 뒤에 보이느냐만 다르다 (판정 ② 수렴).

**Domain 분류**: 본 ADR 은 **빌더 도구 UI** 다 — 3-domain 의 D1 은 RAC `Table` / `Dialog` / `Popover` 를 그대로 써서 준수하고 (격자 `role=grid` · 키보드는 RAC 가 낸다, 셀 edit mode 는 셀 안 `<input>` 의 이벤트 격리로만 얹는다), D2 (컴포넌트 props) · D3 (컴포넌트 시각) 은 변경하지 않는다. 유일한 캔버스 변경인 바인딩 배지 (UI-7) 는 Skia **overlay 층** (선택 · hover 마커와 같은 층) 의 편집 보조 표시라 Preview/Publish 에 대응물이 없다 — D3 대칭 검증 (`/cross-check`) 대상이 아니다. 저장 형식은 바꾸지 않는다 (152 가 담당).

**Hard Constraints**:

1. **쓰기는 전부 `applyDataChange`** (ADR-152 §2-3) — 편집기 · import · 소스 전환이 store 를 직접 mutate 하지 않는다. grep 가드로 고정 (`useDataStore.setState` · `updateCollection` 직접 호출 0, wrapper 만).
2. **스냅 패널 어법** — 생성 · 필드 편집은 `panelConfigs.ts` 에 등록된 workspace 패널이고 `placeOverflowRow` 정책으로 편집기 옆 열에 스냅, 자리가 없으면 아래 행. 새 rail 패널 · 팝오버 · 모달 생성 화면 금지 (사용자 판정 2026-09-10). 리사이즈 · 폭 저장 (`stores/panelLayout.ts`) 은 그대로.
3. **폭 반응** — 목록 233 · 편집기 `defaultWidth` 560 (Track 0) · 필드 패널 260. 탭 컨테이너 폭 < 360 이면 라벨 잘림 대신 아이콘 + tooltip. 어느 폭에서도 라벨이 "Sche…" 로 잘리지 않는다.
4. **접근성** — 격자는 APG grid (`role=grid` 단일 tab stop · Arrow/Home/End · Enter/F2/타이핑 진입 · Esc) · `aria-rowcount/colcount` · 셀 `aria-labelledby`; 저장 · 행 추가 · Run · import 결과는 `role=status`, 오류는 `role=alert`; 다이얼로그 닫힘 시 포커스 복귀; `window.prompt/confirm/alert` 0 (Track 0 이후 유지). 키보드만으로 시나리오 5 완료 + axe critical 0.
5. **성능·번들** — 고정 100행×10열 fixture 에서 입력 프레임 p95 ≤ 16ms, 1000행은 가상화한다. 패널 열기/닫기/리사이즈 p95 는 before arm 대비 +1ms 이내이고 >50ms long task 추가 0이다. 동일 장비 · foreground Chromium · `document.visibilityState="visible"` · DPR 2에서 cold 1회 뒤 warm 30회를 측정한다. `panelConfigs` 의 editor 구현 정적 import를 `React.lazy` panel loader로 끊고, production metafile에서 editor 구현의 initial Builder chunk 포함 bytes = 0을 고정한다. 전체 initial bundle은 실행 시점의 활성 bundle 정책을 별도로 통과해야 한다.
6. **secret** — Auth 값은 마스킹 표시하고 프로젝트 로컬 vault에 저장하며, 문서에는 `{{secret.NAME}}`만 둔다. `Authorization` · `Proxy-Authorization` · `X-API-Key` · `Api-Key` 기존 평문은 Phase 0에서 계수하고 Phase 4 로드 시 lazy 변환한다. 원문 secret은 export envelope (ADR-209) · preview `postMessage` · AI payload에 0건이어야 하며 공유 redactor와 산출물 검사를 test로 고정한다.
7. **i18n** — 모든 신규 문자열은 `datatable.*` 키 (ADR-200 자산, ko/en).

**Soft Constraints**:

- RAC `Table` 은 인라인 셀 편집을 제공하지 않는다 — 공식 권고는 셀 → Popover/Dialog 편집 (adobe/react-spectrum #6382 · #2328). 셀 내 edit mode 는 자체 구현이며 RAC 키보드 핸들러와의 충돌 표면이 있다.
- `DataTableEditor.tsx` 833행 · `ApiEndpointEditor.tsx` 885행 단일 파일 — 분할이 선행돼야 서브 표면을 독립 커밋으로 낼 수 있다.
- Track 0 이 `ApiEndpointCreator` · `VariableCreator` · `ConfirmDialog` · `resolveResponseData` · `suggestApiName` · `renameRowsKey` 를 이미 만들었다 — 재사용 자산.
- publish 는 "빌더 안정화 후" 방침 (`project-publish-link-only-defer-until-builder-stable`) — production 실행 경로 (서버 프록시) 는 범위 밖, 경고 표시까지.
- 시안 artifact `f7d8327e` (아트보드 13 + 대안 1) 가 표면 정본.

## Alternatives Considered

### 대안 A: 현행 `<table>` 격자 유지 + 점진 보강

- 설명: 격자는 그대로 두고 탭 아이콘 모드 · 목록 배지 · 스냅 생성/필드 패널 · API 요청 바만 얹는다.
- 근거: 최소 변경. Baserow 초기 버전이 `<table>`+input 으로 출발했다.
- 위험:
  - 기술: L
  - 성능: M — 100행 × 10열 input 이 전부 DOM (가상화 없음), 셀마다 `key` 리마운트
  - 유지보수: M — 격자 로직이 833행 파일 안에 남는다
  - 마이그레이션: L
  - **접근성 (본 ADR 의 4번째 축으로 추가 평가)**: **H** — `role=grid` 없음 · 100 tab stop · 셀 label 없음이 그대로 (A1 · A2 · Y1). Hard Constraint 4 위반

### 대안 B: RAC `Table` (`role=grid`) + 셀 내 edit mode 자체 구현 + Popover 보조 + 스냅 필드 패널 + 요청 도구형 API 편집기

- 설명: 격자를 RAC `Table` 로 교체 (`keyboardNavigationBehavior="tab"` · `Virtualizer` · `aria-rowcount`), 셀 편집은 두 층 — 기본은 셀 안 edit mode (Enter/F2/타이핑 진입, 셀 `<input>` `onKeyDown` 격리), 긴 값 · JSON · date 는 Popover (RAC 권고). Schema 탭은 사라지고 헤더 `+` / 헤더 클릭이 옆에 스냅되는 필드 패널을 연다. API 편집기는 `[Method][URL][Send]` 바 + Params/Headers/Body/Auth/Response 탭, 응답 Schema 탭이 배열 후보를 추천하고 "테이블로 저장" 이 collection 생성 + `targetCollectionId` 연결 + 소스 = api 를 한 번에 한다. 목록 항목은 버튼 + 배지, 편집 패널은 일반 패널 생명주기. 캔버스 바인딩 배지는 Skia overlay.
- 근거: Airtable · Notion · Glide (격자 하나가 스키마와 데이터를 같이 편집, 헤더 `+`), WAI-ARIA APG grid, RAC Table 권고 (#6382), Postman · Hoppscotch · Bruno (요청 바 + 응답 Schema), FlutterFlow · n8n (path 추천 + 미리보기), Webflow · Framer (캔버스 바인딩 표시) — 리서치 §3-1 M1 · M2 · M5 · M6 · M8, §3-2 P1 · P2 · P4 · P5 · P6 · P7 · P9, §3-3 B3 · B4, §3-6 Y1 ~ Y8.
- 위험:
  - 기술: M — 셀 edit mode 가 RAC 키 핸들러와 충돌 가능 (Y2 — 충돌 매트릭스 test 로 국소화)
  - 성능: L — 가상화 + 편집 이벤트 단위 적용기
  - 유지보수: L — 격자 · 필드 패널 · 요청 바가 독립 모듈, 쓰기는 적용기 하나
  - 마이그레이션: L — 저장 형식 무변경 (152 가 담당), `useMockData` · `targetCollection` 은 read 호환
  - 접근성: L — RAC 가 `role=grid` · 키보드를 낸다

### 대안 C: 외부 격자 라이브러리 (AG Grid Community · Glide Data Grid · TanStack Table + 자체 렌더)

- 설명: 격자만 외부 라이브러리로 두고 나머지는 대안 B 와 같다.
- 근거: Retool · Appsmith · Budibase 가 AG Grid / 자체 canvas grid 를 쓴다.
- 위험:
  - 기술: M — Glide 는 canvas 렌더라 RAC Popover · 테마 토큰과 이질, AG Grid 는 자체 a11y 모델
  - 성능: M — AG Grid Community ≈ 300KB+ (lazy chunk 라도 첫 열림 비용), Glide 는 canvas 이중 (Skia + canvas grid)
  - 유지보수: **H** — 빌더 chrome 의 D1 권위 (RAC) 와 다른 접근성 모델이 한 앱에 둘 공존 · 테마 토큰 (`--bg-raised` · `--control-size`) 을 라이브러리 CSS 에 재매핑 · 셀 편집 계약이 라이브러리 버전에 종속
  - 마이그레이션: M — 라이브러리 교체 시 격자 전면 재작업
  - 접근성: M — 라이브러리 기본값 의존 (AG Grid 는 양호, Glide 는 canvas 라 별도 DOM 미러 필요)

### 대안 D: 데이터 워크스페이스를 별도 전체 화면 (모달 route) 으로

- 설명: dock 대신 캔버스를 덮는 전체 화면에서 목록 | 격자 | 필드를 3열로 — 시안 page-2 "FullScreenAlt".
- 근거: Airtable · NocoDB 는 전체 화면 앱이다.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: M — workspace 패널 시스템 밖의 두 번째 레이아웃 모드 (리사이즈 · 폭 저장 · 단축키 라우팅을 별도 구현)
  - 마이그레이션: M — 기존 dock 편집기와 이중 유지 기간
  - 접근성: L
  - (사용자 판정) 스냅 패널 3열이 dock 안에서 같은 구성을 만들므로 차이는 캔버스가 뒤에 보이느냐뿐 — 캔버스와 같이 보며 바인딩하는 흐름 (UX-1) 이 우선

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | 접근성 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :----: | :--------: |
| A    |  L   |  M   |    M     |      L       | **H**  |     1      |
| B    |  M   |  L   |    L     |      L       |   L    |     0      |
| C    |  M   |  M   |  **H**   |      M       |   M    |     1      |
| D    |  L   |  L   |    M     |      M       |   L    |     0      |

루프 판정: B · D 가 HIGH 0 — 추가 대안 불필요. D 는 사용자 판정 ② (2026-09-10) 로 기각.

## Decision

**대안 B: RAC `Table` (`role=grid`) + 셀 내 edit mode + Popover 보조 + 스냅 필드 패널 + 요청 도구형 API 편집기**를 선택한다.

선택 근거:

1. edit mode ↔ RAC 키 충돌은 셀 `<input>`의 키 매트릭스로 국소화한다. HIGH R8은 ADR-213 G1~G4를 선행시키고 본 ADR G3의 cross-store failure injection을 통과하기 전 Phase 4를 열지 않는 방식으로 수용한다.
2. 격자 · 필드 패널 · 요청 바가 독립 모듈이고 쓰기 진입점이 152 적용기 하나라, Phase 를 독립 커밋으로 낼 수 있고 (특히 Phase 4 API 편집기는 Phase 2·3 과 병렬) scope 가 부풀면 분리 실행이 가능하다.
3. 빌더 chrome 의 D1 권위 (RAC) 안에 머문다 — 접근성 모델이 하나.
4. 사용자 판정 (스냅 패널 · dock 유지) 을 그대로 구현한다.

기각 사유:

- **대안 A 기각**: Hard Constraint 4 (APG grid) 를 만족하지 못한다 — 접근성 HIGH 가 남고 U5 · U6 이 그대로.
- **대안 C 기각**: 한 앱에 접근성 모델 둘 · 테마 재매핑 · 번들 — 유지보수 HIGH. 격자 하나를 위해 D1 권위를 벗어날 이유가 없다.
- **대안 D 기각**: 사용자 판정 ② — 스냅 3열이 dock 안에서 같은 구성이 되므로 두 번째 레이아웃 모드를 유지할 이득이 없다.

> 구현 상세: [212-data-panel-editor-redesign-breakdown.md](design/212-data-panel-editor-redesign-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                               | 심각도 | 대응                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 셀 edit mode 가 RAC `Table` 키 핸들러 (Arrow · Enter · Tab · Esc · Home/End) 와 충돌 — 편집 중 Arrow 가 셀을 옮기거나 Enter 가 두 번 처리          |  MED   | 셀 `<input>` `onKeyDown` 에서 편집 중 키를 격리, 키 × (편집/비편집) 매트릭스 test (`grid/cellEditMode.test.tsx`) + G1 키보드만 live                                       |
| R2  | 필드 패널 스냅이 workspace column 을 추가해 `BuilderCanvas` 전체 재렌더 (패널 리사이즈 GC 병인과 같은 경로) — 프레임 회귀                          |  MED   | 스냅 정책은 `placeOverflowRow` 1회 배치 (드래그 아님) · HC5의 고정 장비/fixture에서 열기·닫기·리사이즈 before/after p95와 long task를 측정, 회귀 시 overlay leaf 구독으로 |
| R3  | 152 Phase 1c 전에 Phase 2 를 시작하면 store 직접 mutate 코드가 편집기에 다시 생긴다 (HC 1 위반)                                                    |  MED   | G0 착수 조건 = 152 G5 PASS. Phase 1 만 선행 허용. grep 가드는 Phase 2 첫 커밋에 포함                                                                                      |
| R4  | secret vault가 export envelope · IndexedDB `api_endpoints` · preview postMessage · AI 컨텍스트 중 하나를 놓치거나 기존 평문을 변환하지 않으면 유출 |  MED   | 공유 redactor + vault 자리표시자 변환, 기존 평문 lazy migration, export/postMessage/AI payload 각각 원문 secret 0 test                                                    |
| R5  | Variables 탭 숨김 (ADR-214 전) 이 기존 변수를 가진 프로젝트의 접근을 끊는다                                                                        |  LOW   | 조건부 표시 — 변수 0 이면 숨김, 있으면 현행 탭 유지. 214 가 대체                                                                                                          |
| R6  | Phase 7개 — scope inflation (설계 추정 대비 1.5×) 시 리뷰 루프가 길어진다                                                                          |  MED   | Phase 4 (API) 는 Phase 2·3 과 독립 — inflation 감지 시 Phase 4·5 를 후속 ADR 로 분리 가능하게 파일 경계 유지 (breakdown §5). M4 규칙: 분할은 사용자 confirm               |
| R7  | `.panel-tablist` 아이콘 모드가 Navigator · Styles 탭에도 걸린다 (같은 클래스)                                                                      |  LOW   | 컨테이너 쿼리 조건을 `datatable` 패널 루트에 한정해 시작, 공통 적용은 회귀 확인 후 별도 커밋                                                                              |
| R8  | Phase 4가 현재 미지원인 `define_endpoint` · `bind_element`를 한 `DataChange`로 요청하면 일부 store만 변경되거나 throw한다                          |  HIGH  | ADR-213 G2·G4가 두 consumer와 cross-store preflight/commit/inverse/rollback을 먼저 구현하고, 본 ADR G3에서 failure injection까지 재검증                                   |

R8의 동적 seed는 `packages/shared/src/schemas/dataChange.ts`, `apps/builder/src/builder/stores/utils/dataChange.ts`, `apps/builder/src/services/ai/tools/bindCollection.ts` 세 경로다. R8은 G3에 1:1로 매핑한다.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                        | 실패 시 대안                                 |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| G0   | Phase 0 완료 | 분할 지도 · 쓰기 호출 전수 · Toast live region · ADR-152 G5를 freeze하고, production metafile의 editor 정적 import/initial bytes before arm과 민감 헤더 4종 평문 건수를 기록                                                                                                                     | 의존/기준선이 없으면 Phase 1 골격까지만 진행 |
| G1   | Phase 2 완료 | 키보드 셀 3개 편집·행 추가·`⌘Z` 원상·axe critical 0·Tab stop 1개. 100행×10열 fixture, foreground Chromium/DPR2/visible, cold 1+warm 30에서 입력 p95 ≤16ms                                                                                                                                        | 충돌 키 격리 수정 · 가상화 임계 조정         |
| G2   | Phase 3 완료 | 필드 패널 rename → 152 G4 시나리오 재확인 (Skia · DOM · 차트 값 유지 · 템플릿 새 이름) + 삭제 시 사용처 N 표시 + 닫힘 포커스 복귀                                                                                                                                                                | 역참조 헬퍼 수정 (152 몫이면 152 로 회귀)    |
| G3   | Phase 4 완료 | ADR-213 G1~G4 PASS 뒤 URL→Send→추천 path→저장→ListBox 행 표시. create/set-source/define-endpoint/bind preflight와 commit이 1 History entry이며 각 op failure injection에서 store·문서가 모두 원상. 기존 평문 migration 뒤 export/postMessage/AI payload 원문 secret 0, production CORS 경고 표시 | consumer/coordinator·vault·redactor 수정     |
| G4   | Phase 7 완료 | native dialog 0 (Playwright `page.on("dialog")` 카운터) · `role=status`/`alert` 발생 확인 · 키보드만 시나리오 5 · 패널 폭 233 / 300 / 636 에서 라벨 잘림 0                                                                                                                                       | 해당 표면 수리                               |
| G5   | Phase 7 완료 | production metafile에서 editor 구현 initial bytes 0. HC5 조건의 열기/닫기/리사이즈 p95가 before +1ms 이내, long task 추가 0, 전체 initial은 실행 시 활성 bundle 정책 PASS                                                                                                                        | lazy 경계·구독 범위 재조정                   |

### Live Exercise

(Implemented 승격 시 기재 — G1 ~ G5 시나리오 · 결과 · 날짜 · Playwright/Chrome MCP/사용자 confirm 구분.)

## Consequences

### Positive

- 격자가 APG grid — 스크린리더 · 키보드 사용자가 셀 단위로 편집하고, Tab stop 1개. 100행 이상도 가상화.
- 스키마와 데이터를 격자 하나에서 편집 (헤더 `+` · 스냅 필드 패널) — Schema 탭 왕복 제거. 필드 rename · 삭제가 사용처를 보여 준다.
- API 흐름이 한 방향 — URL → Send → 추천 path → 테이블로 저장 → 바인딩. dead 필드 4종 UI 제거. Auth 값이 마스킹 · export 제외.
- 0행 · 오류 · 사용처가 목록 배지 · 편집기 · 캔버스 배지 세 곳에 같은 값으로 보인다.
- `DataTableEditor` · `ApiEndpointEditor` 가 모듈로 분할 — 후속 ADR-213 (AI 제안 diff 뷰) · 013 (Quick Connect) 이 붙을 자리가 생긴다.

### Negative

- 셀 edit mode 자체 구현 (RAC 가 제공하지 않음) 을 유지해야 한다 — RAC `Table` 메이저 업그레이드 시 충돌 매트릭스 재실행.
- 패널 종류가 하나 늘어 (`datatableField`) workspace 정책 · 폭 저장 키가 늘어난다.
- secret vault 가 프로젝트 로컬 (IndexedDB) 이라 다른 기기에서는 다시 입력해야 한다 — 서버 저장은 publish 방침 해제 후.
- Schema 탭 · Run 탭 원본 삭제는 사용자 승인 후 별도 커밋 — 전환기 동안 두 경로 공존.
