# Changelog

All notable changes to composition will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 이전 기록 (전부 append-only):
>
> - [CHANGELOG-2026-Q3-archived.md](./CHANGELOG-2026-Q3-archived.md) — 2026-07-01 ~ 08-31 (346 엔트리)
> - [CHANGELOG-2026-H1-archived.md](./CHANGELOG-2026-H1-archived.md) — 2026-02-22 ~ 06-30 (209 엔트리)
> - [CHANGELOG-2025-archived.md](./CHANGELOG-2025-archived.md) — 2025 + 2026-02-15 이전 in-progress mixed 분량 (2026-05-15 아카이빙)

## [Supabase 인증 제거 → 라이선스 파일 + 검증 코드 로컬 인증 (폐쇄망)] - 2026-09-12

> 빌더가 인터넷 없는 사내망에서 동작해야 한다 (사용자 결정 2026-09-12). Supabase 는 실측상 **인증에만** 쓰였고 (프로젝트·문서는 이미 IndexedDB) 제거했다. 발급기 `/Users/admin/work/jwt` (`main.py` · `license_generator.html`, commit `8ff20bb`) 와 형식 계약 v1 (`docs/LICENSE_TOKEN_FORMAT.md`) 을 공유한다. live: `apps/builder/scripts/license-auth-live.mjs` 실제 빌더 10/10 (게이트 · 틀린 코드 · 통과 · 리로드/새 탭 · 만료 · 로그아웃 · 인증 중 외부 요청 0) + 서버 루트 `license.jwt` 자동 인식 1.

### Added

- **`/signin` 라이선스 활성화 화면** — 라이선스 파일 (`token.jwt`: 서버 루트 `public/license.jwt` 가 있으면 자동, 없으면 RAC `FileTrigger` 로 선택) + 6자리 검증 코드. 검증은 `auth/license/licenseToken.ts` 가 WebCrypto 만으로 (네트워크 0): `alg=ES256` 확인 → 번들 공개키 (`VITE_LICENSE_PUBLIC_KEY` — 발급기 `public_key` PEM, 헤더 없는 본문 한 줄 · JWK 도 호환) 로 서명 검증 → `exp` → 코드로 PBKDF2-SHA256(600k)→AES-GCM 복호화해 `license_key` 대조. 토큰에 코드 평문이 없어 파일만으로는 코드를 알 수 없다. 코드 5회 실패 시 60초 잠금 (서명·만료 오류는 잠금 대상 아님).
- **로컬 인증 기록** (`auth/license/localAuth.ts`, localStorage `composition-license-auth` — `vc` 봉인은 저장하지 않음). `ProtectedRoute` 가 동기로 읽어 만료 전이면 즉시 통과, 없거나 만료면 `/signin`. 만료 = 라이선스 `exp` (Unlimited 는 무기한). 대시보드 헤더에 로그아웃 (기록 삭제).
- i18n `auth.*` ko/en (18 키, `errorLocked` 는 `{seconds}` formatter 등록) · `dashboard.signOut`.

### Removed

- `@supabase/supabase-js` 의존성 · `env/supabase.client.ts` · `auth/devAutoLogin.ts` (email/password 로그인, dev 자동 로그인) · `.env` 의 `VITE_SUPABASE_*` / `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD`. 테스트 13개의 supabase mock 제거. `created_by` 는 라이선스 키.
- `.gitignore`: `apps/builder/token` · `token.jwt` · `public/license.jwt` (코드가 평문이던 구형식 `apps/builder/token` 은 재발급 대상).

## [ADR-216 Implemented — Chart 시간축 · 날짜 지시자 형식/파싱 · 가변 창 (thumb 2)] - 2026-09-12

> 근거: `docs/adr/completed/216-chart-time-axis-format-window.md` (codex round 1 → claude round 2 승인 → `/execute-adr 216` Phase 0~7 하루, `### Live Exercise` 실제 빌더 9/9 + G5 성능 5-질문 + 번들 worktree 2). 이론 원천 [CHART_TIME_AXIS_BRUSH_PATTERNS_2026-09](explanation/research/CHART_TIME_AXIS_BRUSH_PATTERNS_2026-09.md) — d3-time · d3-time-format · d3-brush 의 **규칙만** 이식, 런타임 의존 0 (d3 는 specs devDependency 오라클, 눈금 12 span × 3 count · 지시자 15 × 100 날짜 동일).

### Added

- **Properties › Content › 범주 간격 (Category Spacing)** — `등간격` (현행) / **`시간 (날짜 간격)`** (`dimensionScale:"time"`, line/area 만): `dimension` 문자열을 UTC 날짜로 읽어 **시간 간격대로** 놓는다 (빈 날은 빈 자리, 순서는 시간 순), 눈금은 달력 경계 (자정 · 월초 · 연초, d3 18단 표) 에 붙고 라벨은 **2단** (눈금마다 작은 단위 + 경계마다 큰 단위 — `1 2 3 … / Jan`, `Jan Feb … / 2026`; react-spectrum-charts 와 같은 표). Builder Canvas · Preview · Publish 가 같은 모듈을 읽는다. 범주가 전부 날짜면 패널이 "시간축으로 볼 수 있습니다" 를 안내한다 (자동 전환 아님).
- **날짜 입력 형식** (`dimensionFormat`, d3-time-format 지시자 부분집합 `%Y %y %m %d %e %H %I %M %S %L %p %a %A %b %B %j %q %Z %Q %s %%` + 패딩 `- _ 0`) — `2026/03/05` · `Mar 5, 2026` · `20260305` · epoch 초 같은 비-ISO 열을 받는다 (비우면 엄격 ISO). 날짜로 읽지 못한 행은 그려지지 않고 (`2026-02-30` 도 거부) 패널이 "N행은 날짜로 읽지 못해 제외됩니다" 로 알린다. **축 라벨 형식** (`dimensionLabelFormat`) 을 주면 한 줄 라벨. 로케일은 숫자 형식의 `valueLocale` 을 같이 쓴다 (`ko-KR` 이면 `1월 · 오후`).
- Chart binding · Preview · Skia · Properties 패널 · i18n ko/en 결선 (`ChartTimeAxisControls`).

### Changed

- **창 트랙 (ADR-211) 이 손잡이 둘 `[start, end]`** 로 바뀐다 — 시작 손잡이 = 창 이동 (화살표 1 슬롯, 최소 창 = 한 화면), 끝 손잡이 = 창 넓히기/좁히기 (End 로 전체까지 — 넓힌 창은 극값/집계로 한 화면 예산에 다시 맞춘다), 손잡이 사이를 끌면 창이 통째로 이동 (길이 보존). **창이 있는 기존 차트 (범주가 화면보다 많은 bar/line/area) 도 Canvas 의 정적 트랙에 손잡이가 둘로 보인다** (데이터 마크·축·격자·범례는 byte 동일 — ADR-216 HC1 예외). 창 상태는 저장하지 않는다.
- 시간 스케일에서 집계 (`aggregate`) 는 bucket 의 `[첫 epoch, 끝 epoch]` 을 보존해 대표 x = 첫 epoch 에 놓는다 (라벨은 `첫 ~ 끝` 그대로).
- initial 번들 상한 재승인 (사용자 2026-09-12): Builder 1,322,929 / Preview 660,197 B gzip (만료 2026-10-12) — ADR-216 순증 Builder +5,636 · Preview +5,155 (Preview 순증 한도 3 → 6 KiB 개정).

## [Chart 한국어 UI — "시리즈" → "계열"] - 2026-09-12

### Changed

- Properties 패널 Chart 의 한국어 라벨에서 "시리즈" 를 **"계열"** 로 바꿨다 (계열 · 계열 원천 · 계열 설정 · 숨은 계열 설정 · "막대 색은 계열별로 구분됩니다") — Excel · Google Sheets · Numbers 의 한국어 표기와 맞춘다. 영어 UI (Series) 와 저장 키 (`seriesConfig`, `--chart-series-N`) 는 그대로.
- Properties 패널에서 **Palette 를 Color By 바로 앞**에 배치 — 색 관련 두 필드가 이웃한다 (`3ab6d66ce`).

## [Chart 시리즈 팔레트 — Spectrum categorical 기본 + mono (accent) 선택 (ADR-215)] - 2026-09-11

> 근거: 리서치 [CHART_PALETTE_RESEARCH_2026-09](explanation/research/CHART_PALETTE_RESEARCH_2026-09.md) — Adobe react-spectrum-charts (Spectrum 2 theme 도 기본 category 는 Spectrum 1 categorical) · Pinterest Gestalt (`primary` = 단일 시리즈) · Apple (tint). 종전 시리즈 색은 named hue 8개를 Tailwind 600 으로 나열한 무지개였다 (청색 4개 · yellow 대비 부족). ADR-215 Phase 1~4 (`721fc8862` · `478108af6`).

### Changed

- **Chart 시리즈 색 8개가 Adobe Spectrum categorical 1~8 로 바뀐다** (`#0fb5ae #4046ca #f68511 #de3d82 #7e84fa #72e06a #147af3 #7326d3`, 라이트·다크 공용) — 기존 프로젝트의 모든 차트 색이 바뀐다 (저장 무변경, `seriesConfig.colorToken` 순번 `--chart-series-N` 그대로). Builder(Skia) 와 Preview/Publish 가 같은 표 (`chartPaletteMap.ts`) 를 읽는다.

### Added

- **Properties › Appearance › Palette** (`categorical` 기본 · `mono`): `mono` 는 테마 accent (`--tint`) 명도 사다리 4단 + neutral 4단 — Themes 패널에서 tint 를 바꾸면 차트도 따라간다 (CSS `oklch(from var(--tint) …)` ↔ Skia 같은 (L, chroma) 표). Series 섹션의 색 Select 는 선택된 팔레트의 순번을 보여 준다.
- 토큰 `{color.chart-categorical-1..8}` · `{color.chart-accent-1..4}` (`--chart-categorical-N` 은 생성 `theme/generated/chart-palette.css`, `--chart-accent-N` 은 `preview-system.css`). rule `Chart.chart.palettes.{id}` → 생성 CSS `.react-aria-Chart[data-palette="id"]` 블록.

## [ADR-213 Implemented — AI 데이터 tool 계약: 읽기 4 · "왜 실패했지?" · `propose_data_change` 승인 diff · bind_collection 정정 · agent `data.*` 명령 4 · 설명으로 테이블 · 붙여넣기 이해 · 반복 편집] - 2026-09-12

> 근거: `docs/adr/completed/213-data-tool-contract-propose-review-apply.md` (리뷰 Round 2 승인 → **Implemented 2026-09-12**, `### Live Exercise` G1 · G4 · G3 · G2 · AX-4 · G5 전부 Chrome MCP + Ollama qwen3:14b) · evidence `docs/adr/evidence/213-p0-inventory.md` (로컬). 2026-09-11 Phase 1~6 을 하루에 진행하고 09-12 closure (AX-6 MCP 노출 원칙 · ADR-202 편입 어댑터 자리는 design breakdown §6 · §8).

### Added

- **AI 가 데이터를 읽는다**: `list_collections` · `get_collection` (스키마 + 샘플 ≤5행) · `list_api_endpoints` · `get_api_endpoint` (인증 header/query/기존 평문 토큰은 `{{secret.KEY}}` 로 가려짐) + 시스템 프롬프트에 collection 요약 절 (50개 · 이름 80자 · 8,192 B · 2,048 토큰 상한, 넘치면 "더 있음 N").
- **AI 가 데이터를 바꾸려면 승인 diff 를 지난다**: 모델 대면 쓰기 tool 은 `propose_data_change` 하나 (스키마는 `dataChange.ts` 에서 파생 — 삭제 계열 op 없음 · origin 없음). 승인 다이얼로그가 테이블별 필드 추가/변경 · 행 수 + 샘플 3행 · 요소↔테이블 연결 · API 정의 (신규/변경, 헤더 키) · "사용처 N" 을 보여 주고, 승인하면 History 1건 (⌘Z 1회로 전체 원상). 거부하면 문서 무변경. `bind_collection` 도 같은 승인 경로 (종전 즉시 적용 · History 0 정정).
- **"왜 실패했지?"** — AI 패널에서 "마지막 API 실행이 왜 실패했어?" 라고 물으면 `explain_request_failure` 가 정의 · 보낸 요청 · 응답 status/headers · 본문 앞 2KB · 대상 테이블 스키마를 (전부 가린 뒤) 모아 원인과 `define_endpoint` 패치 제안을 답한다. 제안은 `propose_data_change` 승인으로 적용 — 승인 시 `{{secret.KEY}}` 자리는 기존 값을 그대로 둔다 (AI 가 원문을 본 적이 없으므로).
- **API 실행 스냅샷**: 실행 (성공/실패) 마다 endpoint 당 마지막 1건 (최종 URL · 헤더 · 응답 status/headers · 본문 앞 2KB) 을 세션에 남긴다. `list_api_endpoints` 의 `lastRun` 이 이것을 요약한다.
- History 패널 라벨: "API 정의 — {name}" · "데이터 연결 — {name}".
- **설명으로 테이블 만들기** (`create_table_from_description`): "블로그 글 테이블 만들어 — 제목 · 본문 · 작성자 · 게시일 · 상태" 라고 하면 AI 는 스키마와 **샘플 행 생성 규칙** (enum 값 · 숫자/날짜 범위 · 다른 테이블 참조 …) 만 정하고, 샘플 행은 빌더가 규칙대로 만들어 검증한다 (스키마에 없는 컬럼 · enum 밖 값 · 깨진 참조 0). 승인 다이얼로그가 스키마 표 (`Fields: title: string · …`) 와 샘플 행을 미리 보여 주고, 거부하면 AI 가 지적을 반영해 다시 제안한다.
- **붙여넣기 이해** (`understand_paste`): cURL 명령 · JSON · 쉼표/탭 표를 AI 패널에 붙이면 규칙 파서가 먼저 해석해 API 정의 또는 테이블 (새로/기존에 추가) 을 제안한다. 파서가 못 읽는 텍스트만 AI 가 직접 구조를 뽑는다.
- **반복 편집**: DataTable 편집기에 열어 둔 테이블/API 가 AI 턴에 자동으로 첨부된다 — "이 테이블에 tags 필드 추가해" 처럼 id 없이 말하면 그 테이블의 변경 제안 (승인 diff · "사용처 N") 이 뜬다. API 는 URL 을 가리고 헤더 키만 첨부.
- **agent 명령 `data.*` 4** (`window.__compositionAgent` · AI 패널 `run_command`): `data.openTable {name|collectionId}` · `data.openEndpoint {name|endpointId, tab?}` · `data.runEndpoint {name|endpointId}` (GET 은 Test 버튼과 같이 바로, 그 밖의 method 는 승인) · `data.importPaste {text, name|collectionId}` (JSON 배열/객체 · 탭/쉼표 표 → 새 테이블 또는 기존 테이블에 행 추가 — 승인 diff 를 지나고 `⌘Z` 1회로 원상). `run_command` 에 `args` 파라미터.

### Changed

- `bind_collection` (AI tool): `{ elementId, collectionId | collectionName, fieldMap? }` 로 정정 — legacy `source:"static"` + 행은 새 테이블 생성 + 연결 한 묶음 (승인 1회), `source:"api"|"supabase"` 는 안내 오류.
- `define_endpoint` 가 데이터 적용기에 들어왔다 (IndexedDB · 메모리 · History · rollback 이 collection · 바인딩과 한 트랜잭션). `delete_endpoint` 는 사람 전용 op (되돌리기 용).

## [Variables — 페이지 변수는 소유 페이지를 갖는다 (ADR-214 판정 C + 생성 경로 차단)] - 2026-09-11

> 근거: ADR-214 Phase 0 evidence §5 — 구 Variables UI 가 `page_id` 를 한 번도 채우지 않아 저장된 `scope:"page"` 변수가 전부 소유 페이지 없이 남아 있었다. 사용자 판정 (2026-09-11 "C + 2"): 이미 저장된 것은 프로젝트 페이지가 1개뿐일 때만 그 페이지로 귀속 (유일하게 결정적), 아니면 project + `owner-unresolved` 배지 유지 · 새로 만드는 경로는 지금부터 소유 페이지 필수. 단위 54 PASS (`variableOwnerMigration` · `dataActions.variables` · `dataChange*`) · 실제 빌더에서 exercise (page_id 없는 page 변수 로드 → Home 귀속 + write-back · Add Variable Page → page_id 저장 · 편집기 "Owner page: Home").

### Fixed

- **Data › Variables 에서 Page 범위 변수를 만들면 현재 페이지가 소유자로 저장된다** (`page_id`). 현재 페이지가 없으면 만들 수 없고 안내가 뜬다. 편집기에서 Global → Page 로 바꿔도 현재 페이지가 귀속되며, 소유 페이지가 없는 옛 page 변수에는 "현재 페이지에 귀속" 버튼이 보인다. `component` 범위는 새로 고를 수 없다 (소유 요소 id 가 없어 만들 수 없는 형태 — 이미 component 인 변수에만 표시).
- **옛 page 변수 (page_id 없음) 의 로드 귀속**: 프로젝트 페이지가 1개뿐이면 그 페이지로 (콘솔 `[ADR-214] Variable page 귀속 N건` info 1회), 2개 이상이면 종전대로 project + `owner-unresolved` (warn 1회). 귀속된 변수만 `page_id` 를 1회 저장해 고정하므로 나중에 페이지를 추가해도 home 변수는 home 에 남는다 (그 외 변수는 재직렬화 0).

## [Chart Properties 섹션 재배치 — Content(정체·데이터) · Series · Appearance(숫자 형식) · Interaction(표시 예산) + 패널 표준 어법] - 2026-09-11

> 근거: Recharts API 층 (Chart / Series / Axis / General) 과 shadcn Chart 의 `data` ↔ `ChartConfig` 분리를 분류 축으로 삼았다. ADR-209/210/211 이 Content 한 슬롯에 append 한 커스텀 컨트롤 5개를 그 축으로 나눈다. 저장 키 · D2 타입 · 시각 SSOT 변경 0 — catalog `section` 문자열과 패널 주입 채널만 바뀐다. 실제 빌더에서 Bar Chart 선택 → Content 정체 줄 (읽기 전용 종류 + 변경 액션 · 프리셋) · Series 행 (이름 · 색 · 행 메뉴 Move Up/Down/Reset) · Appearance 말미 Number Format · Interaction 말미 예산 + 상태 문구 exercise.

### Changed

- **Chart Properties 섹션**: Content = 차트 종류 (일반 Select — 종전 "Change chart type" 2단계 제거, ADR-209 "선택 0개" 문구는 팔레트 결정의 부산물로 정정) · Preset · Series Source · Category/Value/Series · Data · Sample Rows. **Series 섹션 신설** = 시리즈별 이름 · 색 · 순서 (shadcn `ChartConfig` 대응 — 시리즈 설정이 적용되지 않는 pie/범주색 bar/단일 radial 에서는 섹션 자체가 열리지 않는다). Number Format 계열은 **Appearance 말미**, 표시 예산 4 키는 **Interaction 말미** 로 이동 (`Chart.binding.ts` `section` 변경).
- **패널 표준 어법 (ADR-163) 적용**: `div[role=group][aria-label]` 4곳 → `fieldset.properties-aria` + legend · `ul/li` 목록 → `.fieldset-row` + `.fieldset-actions` 행 메뉴 (`PropertyRowMenu` 신규 공용 위젯 — `⋮` 트리거 + RAC Menu) · 유니코드 `↑↓×` → lucide (`ArrowUp`/`ArrowDown`/`ACTION_ICONS.delete`/`RotateCcw`) · Apply 는 `.control-button[data-variant="primary"]` · 폐기 토큰 `--inspector-control-size` 참조 제거.
- **힌트 문단 정리**: 정적 설명 `<p>` 7곳 제거 (i18n 키는 legend help 후속을 위해 유지). 값·데이터에 반응하는 상태 6종 (예산 적용 모드 · 행 상한 초과 · 원본에 없는 필드 · disabled 사유 3) 은 해당 필드 안 `slot="description"` 으로 이동 (`PropertySelect.afterControl` 슬롯 신규).
- `GenericFieldRenderer.sectionExtras` — section 별 말미 주입 채널. 섹션 순서는 `editorHidden` 필드를 포함한 계약의 section 첫 등장 순서 (catalog 가 배치를 소유).
- 시리즈 색 라벨 "Palette Color" → "Color" (233px 패널의 2열 행에서 잘리지 않게).
- **필드 아이콘**: `propertyFieldIcons.ts` 에 **컴포넌트 스코프 표** (`COMPONENT_KEY_ICONS.Chart`, 38 키) 신설 — 단일 컴포넌트 전용 key 가 한 섹션에 같은 kind 로 몰리면 kind 기본 (`ToggleLeft`/`List`/`Hash`) 이 같은 그림을 반복해 열의 정보가 0 이 되던 것 (Show Axis · Show Grid · Show Legend · Show Dots 가 전부 토글 아이콘). 축 `Axis3d` · 격자 `Grid2x2` · 범례 `LayoutList` · 점 `CircleDot` · 곡선 `Spline` · 라벨 `Tags` · 툴팁 `MessageSquare` · 애니메이션 `Play`/`Timer`/`Clock`/`Waves` · 예산 `Scissors`/`Sigma`/`Axis3d`. 정적 가드: 표의 key 는 binding 에 실재 · 같은 섹션 안 같은 그림 0. 시리즈 색 옵션은 `--chart-series-N` 대신 `Series N` 으로 표시 (저장값 무변경).

## [ADR-152 — Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합: `collectionId` · `fieldId` 안정 참조 · fieldMap · `DataChange` 적용기 + History · publish snapshot (Implemented)] - 2026-09-11

> 근거: `docs/adr/completed/152-data-panel-collection-binding-integration.md` (리뷰 round 4 승인, Phase 0 ~ 7 같은 날 반영). 데이터 편집 4종 · rename · 바인딩 · publish 를 실제 빌더에서 headed Playwright 하니스 8종 (`apps/builder/scripts/adr152-p{1,1b,1c,2,3,4,5,6}-live.mjs`) 으로 exercise — 10/10 · 14/14 · 14/14 · 10/10 · 9/9 · 12/12 · 6/6 · 5/5. 코드 변경은 Phase 1 ~ 6 커밋, 이 엔트리는 closure.

### Added

- **Data 패널 편집이 `⌘Z` 로 돌아온다**: 셀 편집 · 행 삭제 · CSV import · 필드 rename · collection 생성/삭제/schema 변경이 History 패널에 data entry (`Edit cell` · `Delete rows (1)` · `Replace data (2 rows)` · `Rename field — name → fullName` …, Database 아이콘) 로 남고 `⌘Z` / `⌘⇧Z` 가 요소 편집 entry 와 섞여도 각자 되돌아간다. 모든 데이터 편집은 `DataChange` (13 op, zod 단일 소스 `packages/shared/src/schemas/dataChange.ts` — JSON Schema 도 같은 소스에서) 를 지나는 적용기 `applyDataChange` 하나로 들어가며 all-or-nothing + inverse 동시 산출 (`stores/utils/dataChange.ts`). ADR-213 의 AI `propose_data_change` 가 같은 진입점을 쓴다.
- **Properties › Data 에 Value field · Icon field 선택**: collection 을 고르면 fieldMap 행 2개 (기본 `Auto`) 가 보이고, 고른 필드는 행 key (`data-key` · Select option value · Table 행 key) 와 아이콘 역할로 쓰인다 — Builder Skia 투영과 Preview DOM 이 같은 shared resolver (`resolveFieldRoles`) 를 지나 같은 key 를 낸다 (ListBox · Select · Table · Breadcrumbs · ComboBox · GridList · Menu · Tabs · TagGroup · Tree 10종).
- **필드 key 를 바꿔도 바인딩 · 템플릿 · 차트가 살아 있다**: 필드마다 안정 id (`DataField.id`) 를 부여하고 (기존 프로젝트는 로드 직후 id 없는 collection 만 1회 write-back, 이후 write 0) fieldMap · `{field}` 템플릿 저장형 (`{#<fieldId>}`, 편집기는 이름 표시) · 차트 dimension/metric 이 id 를 참조한다. `name → fullName` rename 후 재로드해도 캔버스 · Preview · 차트 · Properties 표시가 유지된다.
- **collection 이름을 바꿔도 바인딩이 유지**: `dataBinding.collectionId` (id 참조) 가 정본, `name` 은 legacy fallback. legacy `{ type:"collection", config:{…} }` 바인딩은 읽기 경계에서 v2 로 정규화 (문서 재직렬화 0).

### Changed

- **publish · export 의 collection snapshot**: 헤더 Preview payload 와 export JSON 이 `{ id, name, schema, mockData, useMockData }` 만 담는다 (runtimeData · 저장소 메타 제외). export schema 가 필드 `id` · `required` · `defaultValue` 를 strip 하던 결함 수리 — import 후에도 fieldId 참조가 유지된다.
- **Table Preview 행 identity**: Table DOM wrapper 가 다른 9종과 같은 `useResolvedCollectionItems` 를 지나 행 id (`tr[data-key]` · 선택 key) 가 fieldMap value 역할 (없으면 `id` 컬럼) 을 따른다 — Builder Skia 행 key 와 동일. 셀 값은 그대로. 같이 수리: `useResolvedCollectionItems` 의 rows 가 렌더마다 새 배열이던 것 (reload identity 에 묶임) — rows 에 반응해 setState 하는 소비자가 "Maximum update depth exceeded" 로 돌 수 있었다 (Table 정렬 live 에서 실측, 회귀 테스트 추가).
- **TagGroup Preview 행 key**: DOM 이 raw `id` 로 정규화 key 를 덮어 Skia (`U-1..3`) 와 달랐던 것 (`auto-1..3`) 을 spread 순서 수리로 대칭.

### Architecture

- collections read 경로 단일화: `useCollectionData({ dataBinding })` → `useResolvedCollectionItems` (Tabs · Tree 도 정렬), `datatableId` · `elementId` 옵션과 `DataTableService.addConsumer/removeConsumer/loadDataTable` · supabase 분기 제거. `useDataStore.collections` Map 은 id 키, resolve 는 `resolveBoundCollection` 하나.
- store 단일화: legacy `stores/datatable.ts` · `components/data/DataTable.tsx` · `hooks/useDataQueries.ts` 삭제 (사용자 승인) — `BuilderCore` 의 `LOAD_DATA_TABLE` / `SAVE_TO_DATA_TABLE` 과 `DataTablePanel` 이 `useDataStore` 만 읽는다 (React Query 병행 제거).
- `.claude/rules/state-management.md` §Collections read 진입점에 v2 계약 · `DataChange` · publish snapshot 규칙 기재. 후속 정리 (같은 날): 고아 `types/datatable.types.ts` (import 0) 삭제 · `main.tsx` `QueryClientProvider` 와 `@tanstack/react-query` 의존 제거 (소비처 0). 잔여 (기록만): publish 의 ref ListBox master slot 템플릿 미보간 (publish App 이 ref 를 확장하지 않음 — ADR-162/159 publish leg, 범위 밖).

## [데이터 패널 Track 0 결함 수리 — 응답 행 자동 감지 · 필드 key 변경 시 행 이전 · 편집기 첫 열림 폭 · prompt/confirm/alert 제거] - 2026-09-11

> 근거: `docs/explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md` §2 (D1 · D2 · U1 · U2) · §5 Track 0. ADR 없이 `/fix` 로 처리한 동작 수리 4건. live 13/13 (headless 빌더 — API 생성 → Run 컬럼 8 감지 · 변수 생성/삭제 다이얼로그 · key 변경 후 값 유지 · 편집기 560px).

### Fixed

- **API 응답에서 행을 못 찾던 문제 (D1)**: 새 엔드포인트의 기본 `dataPath` 가 `"data"` 라 jsonplaceholder 처럼 최상위가 배열인 응답이 `undefined` 가 되어 Run 탭이 "Success" 인데 본문이 비고 컬럼 감지가 안 됐다. 기본값은 빈 경로 (응답 전체) 로 바꾸고, 실행기가 경로 결과가 배열이 아니면 응답 자체 → 관례 키 (`results` · `data` · `items` …) 순으로 행 배열을 찾는다 (`utils/data/responseData.ts`, 순수 함수 + 실행기 회귀 테스트). API 편집기의 중복 감지 블록 2개도 같은 함수를 쓴다.
- **필드 key 를 바꾸면 그 컬럼 값이 사라지던 문제 (D2)**: Schema 탭에서 key 를 바꾸면 schema 만 갱신돼 `mockData` · `runtimeData` 의 값이 옛 key 아래 고아로 남았다. 이제 행 값을 새 key 로 옮기고 (열 순서 보존), 빈 key 나 이미 있는 key 로 바꾸려 하면 토스트로 거부한다. `updateCollection` 이 `runtimeData` 도 받는다.
- **편집 패널이 233px 로 열리던 문제 (U1)**: `datatableEditor` 에 `defaultWidth: 560` 을 주고, workspace 가 패널을 overflow 로 새 column 에 놓을 때 원래 column 폭만 물려받던 것을 패널의 `defaultWidth` 하한으로 고쳤다 (`panelWorkspacePolicyV4.ts`). 리사이즈 · 폭 저장은 그대로.
- **`window.prompt` · `confirm` · `alert` 6곳 제거 (U2)**: "Add API" · "Add Variable" 은 편집 패널 자리에 스냅되는 생성 패널 (`ApiEndpointCreator` — URL · 메서드 · URL 에서 자동 제안한 이름, 만들면 Run 탭으로 · `VariableCreator` — 이름 · 타입 · 범위, 중복 이름 거부) 로, 삭제 3곳은 RAC `ConfirmDialog` (항목 이름 표시 · Esc 닫기 · 확인 버튼 포커스) 로, Import 결과 2곳은 Toast 로 바꿨다. 자동화 (Playwright · Chrome MCP) 를 막던 native dialog 가 데이터 패널에서 0 이 됐다.

## [ADR-211 — 차트 표시 예산: 슬롯 fit · 창 Slider · 행 상한 R · 집계/극값/others · 예산 설정 · 성능 (Implemented)] - 2026-09-11

### Changed

- (P5) **Implemented** — G5: preflight FAIL 0 · builder 5,710 · shared 1,175 · specs 1,233 · chart Chromium 214 · live P3 하니스 13/13 (최종 main) · 구버전 프로브. 사용자 승인: Builder 번들 순증 한도 7 KiB · 전체 initial Builder 1,304,030 B / Preview 636,268 B 한시 재승인 (Publish <500,000 B 유지 · 만료 2026-10-10 또는 initial 영향 변경 시) — ADR-210 상한 대체. **호환**: `budget*` 키는 선택적 (기존 문서 재직렬화 0) · 구버전은 키를 무시하고 예산 없이 전부 그린다 (Preview) / Canvas 는 200행 샘플로 (데이터 손실 0) · 창 위치는 저장하지 않는다 · 행 상한 20,000 은 두 화면 동일. 사용자-가시 변경 (A) 행 > 200 Canvas 합계 · (B) 범주 > fitEff 창/집계/극값/others · (C) 마크 > M fitEff 축소.

### Performance

- (P4) **Builder 캔버스 차트 프레임**: Skia `renderPath` 가 SVG path 문자열 파싱 결과 (`Path`) 를 LRU 캐시 (개수 4,096 · 4 MB, 퇴출 시 해제) — 행 상한 200 이 사라져 선/영역 차트 path 가 33~65 KB 가 되자 내용 재기록마다 재파싱해 `render.frame` p95 가 +8ms 났던 것을 되돌린다 (6 Chart 800행 문서 select→편집→resize→zoom p95 10 → 6–7.6ms · 200행 × 4필드 22.4 → 4.8–5.9ms). runtime static W800 4종 16.6–17.6ms (bar 63.7 → 16.7) · 5,000행 columns bar 1,446 → 15.5ms · 5,000행 × 4 시리즈 모델 계산 최대 4.9ms · 폭 2,000 × 8 시리즈 창 이동 20회 p95 33.6ms. 측정: `docs/adr/evidence/211-p4-perf-bundle.md` (before `53c761c8b` / after 별도 clean worktree).
- (P4) **번들**: Preview 창 Slider 를 `Chart.tsx` (initial) 가 render prop 으로 넘겨 lazy Recharts 청크의 shared Slider import 가 만들던 청크 분리 (initial gzip +2.5 KiB) 제거. 순증 (gzip): Builder +6,762 B · Preview +5,653 · Publish +5,314 — Builder 는 ADR 한도 6 KiB 를 +618 B 넘고, Builder/Preview 전체 initial 은 ADR-210 승인 상한을 +6,719 / +5,643 B 넘는다 (사용자 결정 대기).

### Added

- (P3) **창 이동 Slider (Preview/Publish)**: 범주 축 차트의 범주가 예산을 넘치면 플롯 아래에 창 트랙이 생긴다 — thumb 하나로 창을 옮기고 (화살표 1 범주 · Home/End 끝 · PageUp/Down 1/10) 창 길이는 항상 같다. 창 위치는 저장하지 않는 뷰 상태 (문서 write 0) 라 데이터·차트 종류·overflow 가 바뀌면 처음으로, 크기가 바뀌면 자리에 맞춘다. Builder 캔버스는 같은 높이 (`windowTrackHeight 24`) 를 예약하고 비활성 트랙 (창 0) 을 그린다 — 두 화면의 플롯이 같다. 트랙 접근성 이름은 "Visible range".
- (P3) Chart Properties **표시 예산 설정** 4종: `범주 초과 시` (자동 / 창 / 구간 집계 / 구간 극값 유지 / 나머지 묶음 — 차트 종류가 지원하지 않는 항목은 비활성 + 사유) · `집계 통계` (합계 / 평균 / 최대 / 최소) · `범주 축` (자동 · 범주 · 순서) · `묶음 라벨` (기본 "Other", 비우면 기본으로). 저장 키 `budgetOverflow` · `budgetAggregate` · `budgetAxis` · `budgetOthersLabel` 은 전부 선택적 (기존 문서 변경 0) 이고 Builder 캔버스 · Preview · 독립 publish 가 같은 값을 읽는다. 패널 안내 `표시 {fitEff} / {n} — 창 · 구간 집계 (sum) · 구간 극값 유지 · 나머지를 하나로 묶음` (캔버스 크기 기준) 이 예산 상태를 알린다.
- (P3) 검증: specs 6 · Chromium Slider 2 · 패널 4 · 투영 1 · live 13/13 — Canvas 트랙 픽셀 · Preview/publish Slider End 로 마지막 창 (write 0) · 5,000일 line 극값 점 685 ≤ M · 누적 집계 접미 tooltip · pie 200 → "기타" · dark `--chart-others` 대비 3.42 · Properties → reload → 두 화면 → Export → publish (`docs/adr/evidence/211-p3-window-wiring.md`).

### Changed

- (P2) **사용자-가시 (B) 확장**: 범주가 예산을 넘칠 때 종류·축별로 다르게 처리한다 — 범주 축 (이름) 은 창 (P1), **기간 축** (범주가 전부 엄격 ISO-8601 날짜이고 순서가 단조일 때만 자동 판정, `budgetAxis` 로 강제 가능) 은 bar 와 누적 line/area 가 **bucket 집계** (`sum` 기본, `mean/max/min`; 범주 라벨 `첫 ~ 끝`, tooltip·값 라벨에 `sum` 접미), 비누적 line/area 는 **bucket 극값 선택** (시리즈별 최소·최대 원본 점을 보존, 결측 구간은 그대로 끊김, 점 수는 `P 5,000`/`M 800` 안으로 적응), pie/radar/radial 은 **others** (상위 범주 + "Other" 묶음, 색 `--chart-others`, 라벨 `budgetOthersLabel`). 값 축 범위는 변환 뒤 전체 데이터에서. Builder 캔버스와 Preview/Publish 가 같은 모델을 그린다.
- (P2) rule chart 채널 `others` 토큰 (catalog Chart `{color.neutral-subdued}` → CSS `--chart-others`, Skia 같은 토큰) · 설정 검증 `budgetOverflow/budgetAggregate/budgetAxis/budgetOthersLabel` (지원되지 않는 조합은 설정 오류 안내). 검증: 원본 스캔 오라클 (집계 합·평균, 극값 index 보존, gap sentinel, 적응 B 단계, others ranking, `[60,60]` → 120 domain) 전부 PASS · live 400일 bar 집계 / 3,000일 line 극값 / pie 40 → Other 세 모드 두 화면 일치 (`docs/adr/evidence/211-p2-overflow.md`). 저장 키 4개의 Properties 컨트롤·창 이동 Slider 는 P3 (위 Added).

- (P1) 차트가 **표시 예산**을 계산한다 (`packages/specs/src/chart/budget.ts` · `model.ts`, Builder Skia 와 Preview/Publish Recharts 가 같은 `resolveChartModel` 을 부른다): 플롯 픽셀 폭 / 최소 슬롯 간격 (`minSlot 8` · `minPointGap 3` · `minArc 5` · `minAxisGap 12` · `minRing 5`, P0 light/dark 실측) 으로 슬롯 수 `fit` 을 정하고 요소 마크 `M 800` · 경로 점 `P 5,000` 으로 깎는다. **사용자-가시 (B)**: bar/line/area 의 범주가 `fitEff` 를 넘으면 두 화면 모두 앞 `fitEff` 범주만 그린다 (창 0 — 창 이동 Slider 는 P3). 값 축은 전체 데이터 범위를 유지한다.
- (P1) **사용자-가시 (A)**: Canvas 전용 200행 샘플 (`CHART_SAMPLE_ROWS`) 삭제 — Builder 캔버스도 Preview 와 같은 전체 행 합계를 그린다 (5,000행이면 5,000행 합). 행 상한은 두 화면 공통 `R 20,000` (초과 시 앞 20,000행 + 진단 `budget.rowsTruncated`, Properties 안내 `chart.rowCapHint`). 플롯이 한 슬롯보다 좁으면 마크 0 + 진단 `budget.plotTooSmall` (데이터 보존).
- (P1) rule chart 채널 `budget` (catalog Chart 항목, `ComponentRuleChart.budget?`) 이 예산 상수의 정본 — `ChartMetrics` 9 필드. 검증: 손계산 오라클 18/18 · 같은 크기 두 leg visible 범주·값 byte 동일 · 행 ≤ 200 · 범주 ≤ fitEff 문서는 scene byte 동일 (스냅샷 4 · specs 315 · shared 668 · chart Chromium 212) · live 1,000 범주 bar → Canvas/Preview 41 막대, 5,000행 → 두 화면 같은 합 (`docs/adr/evidence/211-p1-budget-model.md`).
- (P0, 2026-09-10) spike 만 (제품 코드 0): 하니스 `apps/builder/scripts/adr211-budget-{model,pixel}-spike.mjs` · `adr211-impact-inventory.mjs`.

## [ADR-210 P1–P5 — 차트 다중 수치 컬럼 · 시리즈 표시 · 숫자 형식 (Implemented)] - 2026-09-10

### Added

- Chart Properties 에 **시리즈 원천** (그룹 필드 / 값 컬럼) 이 생겼다. 값 컬럼 모드는 `{month, desktop, mobile}` 같은 wide 표의 수치 컬럼을 골라 각 컬럼을 시리즈로 그린다 (Bar/Line/Area/Radar — Pie/Radial 은 비활성 + 사유). 원본 행은 변환·저장하지 않고, 같은 범주는 기존처럼 합산한다. 기존 그룹 모드 문서는 아무것도 바뀌지 않는다 (opt-in).
- **시리즈 설정**: 시리즈 표시 이름 · 팔레트 색 (`--chart-series-1..8` 토큰) · 순서 (위/아래). 순서는 누적·묶음 배치·범례·툴팁에 같이 적용된다. 숨은 시리즈의 설정은 보존됐다가 재등장 시 회복된다. 범주별 색 모드 (Pie · 단일 시리즈 Radial · Bar Color By=Category) 에서는 사유만 보인다.
- **숫자 형식**: Auto / 소수 / 통화 (ISO 코드) / 퍼센트 (비율·퍼센트 값 단위) + 숫자 로케일 (en-US/ko-KR) + 소수 자릿수. 값 라벨·축·툴팁·도넛 합계 문자열만 바뀌고 기하는 그대로다. 100% 누적 축은 형식을 켜면 항상 `%` 다. Auto 는 기존 문자열 그대로.
- 잘못된 설정 (값 필드 없음 · Pie+값 컬럼 · 통화 코드 없음 등) 은 조용히 다른 뜻으로 그리지 않고 "Check chart settings" 안내로 멈춘다 (데이터 보존). Preview/Publish 도 같은 안내를 내고 (`role=status`, 진단 코드는 `data-chart-diagnostics`) 차트를 그리지 않는다.
- (P3) Preview/Publish 의 Recharts 가 Canvas 와 **같은 문자열·색**을 낸다 — 축 눈금 (100% 누적은 `%`, 그 외 raw 형식) · 툴팁의 시리즈 표시 이름과 raw 값 형식 · 도넛/radial 합계 · 키보드 탐색 (Recharts accessibilityLayer) 툴팁도 표시 이름을 쓴다. 값 로케일은 문서 설정을 따르고 UI 언어와 무관하다 (`lang=ko` + en-US → `$`, `lang=en` + ko-KR → `US$`). 독립 publish 도 같은 결과다.

### Validation

- specs chart 274/274 · shared catalog 517/517 · builder unit 714 files/5,685 · chart Chromium 180/180 · type-check PASS. 실제 빌더 live (`apps/builder/scripts/adr210-chart-p2-live.mjs`) 6/6 — 패널 mount → 값 컬럼 적용 (canonical 단일 patch, Skia 픽셀 변화) → Undo 1회 복귀 → 통화 묶음 저장 → reload 보존.
- 구버전 (`305e4c4f7`) 은 새 설정을 무시한다: 기존 문서는 byte 동일, 새 columns 문서는 빈 차트 또는 legacy 값 필드 단일 시리즈 (데이터 손실 0, 무손실 rollback 미지원 — 업데이트 전 백업 복원이 지원 경로).
- (P5) 종결 검증: preflight FAIL 0 · builder unit 5,689 · shared 1,174 · specs 1,160 · chart Chromium 212+149 · live P2 6/6 · P3 7/7 · production network 9/9. 엔진 parity 4건 FAIL 은 기준선 `baf535258` 과 동일 (ADR-210 무관). **호환 제한**: 새 설정 (값 컬럼·시리즈 설정·숫자 형식) 문서를 구버전에 넣으면 빈 차트 또는 legacy 값 필드 단일 시리즈로 보인다 (데이터 손실 0) — 지원되는 rollback 은 업데이트 전 백업 복원. **Implemented (2026-09-10)**: 사용자가 Builder/Preview 전체 초기 번들 예외를 승인 — 상한 Builder ≤1,297,311 / Preview ≤630,625 B (최종 revision 실측값), 만료 2026-10-10 또는 initial 영향 변경 시, Publish 기본 500 KB 유지 (ADR-209 B 상한 대체). ADR-209 Series 하니스 재실행 17/18 — Export 단계 FAIL 1 은 타이밍 flake 로 분류하되 기록 유지. 후속 조사: Canvas columns 표시 셀 비용 (`CHART_SAMPLE_ROWS` 행 cap) · Chart 컨트롤 mount 비용.
- (P4) 성능: Preview/Publish 의 Bar 차트가 막대를 단순 path 로 그려 800 막대 정적 렌더 p95 116 → 75ms (legacy 800행 bar 118 → 77ms, 5000행 625 → 323ms) — 기하는 그대로 (Chromium 212/212 ≤1px). Properties 의 Chart 컨트롤 3개가 값 필드·시리즈·형식 입력이 바뀔 때만 다시 그려 showGrid 편집·크기 변경 때 재렌더 0 (다른 차트로 전환하면 선택 화면·pending 통화는 여전히 초기화). 측정 (before `baf535258` / after 별도 worktree): columns W800 4종 static p95 41–75ms (≤100) · Builder W200 6-chart frame p95 Δ −0.5…−0.6ms (≤+1) · initial gzip 순증 Builder +7,473 / Preview +4,196 / Publish +2,820 B (≤10 KiB) · lazy +305 B · production network 9/9. 전체 initial 예산 (500 KB) 은 Publish 만 충족 — Builder/Preview 는 ADR-209 한시 상한도 넘어 재승인 대기.
- (P3) chart Chromium 212/212 (신규 32: 4종 wide × 누적 방식 × 크기 × 긴 한글 이름/KRW 에서 DOM 축 눈금·범례·값 라벨의 문자열과 좌표 ≤1px, 마크 경계 ≤1px, 지정 팔레트 토큰 light/dark 실제 CSS ↔ Skia 토큰 일치, legacy 6종 문자열 보존) · dark/reduced-motion 대조군 149/149. 실제 빌더 live (`apps/builder/scripts/adr210-chart-p3-live.mjs`) 7/7 — 패널로 값 컬럼·표시 이름·`--chart-series-5`·USD 설정 → Skia 주색 변화 → Themes dark 스위치 → Compare Mode Preview 의 문자열/fill 이 Skia 픽셀과 일치 (light/dark) → hover·키보드 툴팁 canonical write 0 → 메뉴 Export → 독립 publish (3001) 같은 문자열·fill. 성능 (P4) · 문서 정합/rollback 제한 (P5) 미완.

## [ADR-209 후속 완료 — B안 승인 및 G5/G6 종결] - 2026-09-10

### Validation

- clean `651c2a363`에서 Builder/Preview/Publish 초기 JS gzip **1,289,801 / 626,424 / 390,293 B**. 이전 확정 `24a33d157`보다 감소했고 차트 lazy graph는 동일하다. 기존 의존성 최적화의 결과이며 새 차트 기능 변경은 없다.
- runtime 6종×200행 정적 p95 **40.5–43.5ms**, Builder 프레임 A/B 5쌍 최악 Δ **+0.8ms**. 실제 로그인된 production F4 **9/9**, 전이 의존성 요청 대조 **7/7**, T13 **13/13**, focused tests **43/43**, chart Chromium **170/170**, preflight PASS. Settings 실제 한국어 선택·reload·Export를 포함한 Series live **21/21** PASS.
- 하니스의 측정 worktree/출력 경로를 지정할 수 있어 이전 증거를 보존한다. T13의 설정 600ms와 실제 관측 상한 1400ms를 구분하도록 결과 문구를 정정했다(검사 조건 유지).
- 사용자 **“B 안으로 승인”**(2026-09-10)에 따라 Builder ≤1,289,801 B / Preview ≤626,424 B의 한시적 초기 gzip 상한을 확정했다. Publish <500,000 B와 차트 순증·lazy·성능 기준은 유지한다. 만료는 2026-10-10 또는 초기 closure 영향 변경 중 먼저 도래하는 시점이며, Composition 유지보수 담당이 재측정 및 축소 계획/재승인을 맡는다.
- **G5/G6·F5 완료, ADR Implemented 승격 및 completed 이관.** 전체 500KB 목표 자체를 달성한 것은 아니며 예외 자동 연장은 없다. [승인 계약과 종결 근거](adr/design/209-chart-followup-repair-breakdown.md#108-b안-승인-및-g5g6f5-종결-2026-09-10).

## [Properties 패널 — 동작하지 않던 항목 정리와 ColorField·FileTrigger Preview 복구] - 2026-09-10

### Fixed

- ColorField 의 **Description / Error Message** 가 Preview 에 반영된다. field 계열 중 ColorField 만 wrapper 위임이 빠져 있어 parent 값이 RAC 가 모르는 prop 으로 버려지고 있었다 (Label 은 propagation 다리로만 닿았다).
- FileTrigger 가 Preview 에 실제 버튼 (`.react-aria-FileTrigger`, variant·size·**Disabled** 반영) 으로 그려진다. 종전에는 RAC FileTrigger 가 DOM 을 만들지 않아 글자만 남고 클릭할 요소도 없었다.

### Removed

- Properties 패널에서 켜도 아무 일도 없던 항목 12개를 뺐다 (DOM·Skia 어느 쪽도 읽지 않던 surface). 저장된 문서의 값은 무시된다.
  - Link `External Link` · `Show External Icon` — 외부 링크는 `Target` · `Rel` 로 표현한다.
  - Form `Auto Focus` · `Restore Focus` (RAC Form 에 없는 prop)
  - Breadcrumbs `Show Root` · `Multiline` (RSP v3 개념, 미구현)
  - TableView `Allow Resizing Columns` · CardView `Columns`
  - ListBox · GridList · Tree · TagGroup 의 컬렉션 전체 `Disabled` — RAC/RSP 컬렉션은 항목별 Disabled (Items 편집) 와 `disabledKeys` 만 둔다.

### Validation

- 대조 자체: 팔레트 66 → Properties 항목 619 를 RAC 1.21.0 · RSP S2 1.7.1 타입과 대조 (RAC 275 · RSP 개념 249 · custom 84 · builder 11), custom 은 소비처 grep 으로 확인.
- 새 회귀 게이트: 제거 항목 12 (`deadSurfaceRemoval.test.ts`) · 위임 등록 2 (`CanonicalNodeRenderer.colorFieldFileTrigger.test.tsx`) · 위임 선언 parity INVENTORY rac 13→15. 필드 아이콘 레지스트리에서 단일 사용이 된 `columns` 제거, ColorField wrapper 가 `data-label-align` 기본값 `start` 를 명시 emit (ADR-923 r24m1 기본값 계약 게이트).
- shared 1,171 · builder 5,664 통과, type-check PASS. live (`apps/builder/scripts/panel-d2-audit-live.mjs`, headed Playwright): 제거 항목 11 타입 패널 부재 + ColorField Preview DOM 에 description/errorMessage 텍스트 + FileTrigger `button.react-aria-FileTrigger[data-disabled]`.
- 남은 것 (별도): FileTrigger 의 catalog rule 크기 (md 높이 40 · paddingX 24) 가 생성 CSS 와 Skia 어느 쪽에도 실리지 않는다 — 두 leg 모두 ~24px 로 대칭이라 이번 범위 밖.

## [Publish·Preview 번들 — RAC 로케일 축소와 서브패스 import] - 2026-09-10

### Changed

- Builder 와 Publish Vite 가 React Aria 번역 문자열을 `en-US`·`ko-KR` 만 남긴다. 앱 i18n (`SupportedLocale`) 과 같은 두 로케일이다.
- shared 컴포넌트와 Builder chrome 이 `react-aria-components` barrel 대신 컴포넌트 서브패스 (`/Button`, `/Select` 등) 에서 가져온다. Preview 의 `CanonicalNodeRenderer` 만 catalog 이름이 런타임에 RAC 컴포넌트를 고르므로 barrel `import *` 을 유지한다.

### Performance

- 독립 Publish 프로덕션 빌드 `main` JS: 1,697 kB (gzip 431 kB) → 1,587 kB (gzip 396 kB). Recharts 청크(436 kB)와 CSS(636 kB)는 그대로다. 압축 전 500 kB 경고는 `main` 이 아직 그 위에 있어 남는다.

## [차트 — 시리즈 연결을 해제할 수 있습니다] - 2026-09-09

### Added

- 차트 Properties 의 **Series** 목록 첫 자리에 `없음 / None` 이 항상 나온다. 고른 시리즈 컬럼을 다시 해제해 하나의 시리즈로 합칠 수 있다 (범주별 합계로 접힌다). 해제 상태는 저장·재열기·Undo/Redo 에서 유지된다.
- 컬럼 이름이 화면의 `없음` 라벨과 같으면 데이터 항목 쪽에 `없음 (필드)` 처럼 보조 표시를 붙여 해제 항목과 구별한다. 저장되는 값은 원본 컬럼명 그대로다.

### Fixed

- `reset` 이라는 이름의 실제 데이터 컬럼을 Category/Value/Series 에서 고르면 빈 값으로 저장되던 문제를 수정했다. 속성 Select 에 값 그대로 다루는 모드를 두어 원본 문자열 (`reset`, 한글 컬럼명 등) 이 손실 없이 저장된다. 스타일 패널의 기존 "초기화" 항목 동작은 그대로다.
- 데이터 연결이 `x-composition` 확장에만 저장된 요소에서 Properties 가 연결을 못 읽어, 스키마가 있는데도 차트 필드가 컬럼 목록 대신 문자열 입력으로 나오던 문제를 수정했다. 편집 계약이 공통 확장 읽기 계약을 함께 쓴다 (읽기 전용 — 화면을 위해 값을 다시 저장하지 않는다).

### Validation

- F0 실패 재현 → 수리: 확장에만 연결이 있는 canonical 문서로 실제 옵션 생산자를 통과시켜 문자열 입력 fallback 을 먼저 고정했다 (5건 RED → GREEN).
- 신규/보강 테스트 29건 (패널 옵션 생산자 17 · PropertySelect 두 모드 5 · ref/Undo/Redo 실제 inspector store 3 · 문서 왕복 2 · 집계 손계산 2), builder 5,661 · shared 1,157 · specs 1,108 · chart browser 170 통과, type-check·preflight PASS.
- 실제 Builder live 24건 통과 (F2 주요 구간) — 연결 전 문자열 입력 → 연결 후 컬럼 Select, 해제가 canonical `color: ""` 로 저장, Undo/Redo, 저장 후 reload, 실제 메뉴 Export, 독립 publish 런타임까지. 재현: `node apps/builder/scripts/adr209-series-release-live.mjs --headed` · `node apps/builder/scripts/adr209-publish-live.mjs --headed`.
- F2 잔여 live 26건 통과 (2026-09-10) — 기본 행 편집·삭제·Undo/Redo·재선택과 중복/누락/숫자 id 행 (UI id 주입 0, key 경고 0) · 4방향 padding 이 Canvas 원 이동량 = Preview 원 이동량 = 손계산 기대값 · Themes 스위치 dark 에서 Preview/Skia 토큰 변경·라벨 유지 · 독립 publish 의 content box = 입력 padding. 재현: `node apps/builder/scripts/adr209-f2-residual-live.mjs --headed` · `node apps/builder/scripts/adr209-f2-residual-publish.mjs --headed`.
- rollback 실측 (`apps/builder/scripts/adr209-rollback-probe.test.ts`, 과거 빌드 체크아웃): 직전 릴리스 `51184c8bd` 는 새 Export 를 그대로 받고, data-source envelope 이전 빌드 `31dff0c50` 은 JSON Import 만 `Unrecognized key: "collections"` 로 거부한다 — 두 빌드 모두 저장 문서의 `color: ""`·연결·미편집 노드를 편집/Undo/재저장에서 그대로 보존한다. Import 가 필요하면 `collections`/`apiEndpoints` 를 벗긴 파일을 쓰되, 구 빌드는 collection 을 복원하지 않으므로 같은 이름·컬럼의 collection 을 Data 패널에서 다시 만들기 전까지 차트가 비어 있습니다 (조건부 호환 — 상세는 breakdown §10.5).
- F3 최종 revision 측정 (2026-09-10, `24a33d157`, 별도 clean worktree): 초기 번들 gzip Builder 1,351,547 B · Preview 696,363 B · Publish 425,953 B (ADR-209 전체 순증 -17,600 / +7,103 / -217 B, 이번 후속 국소 +342 / +191 / 0 B — 10 KiB 순증 조건 통과) · 차트 lazy graph 119–120 KB (200 KiB 통과) · runtime 6종 200행 정적 p95 ≤ 39.6 ms · Builder 프레임 A/B 5쌍 Δ p95 ≤ +0.2 ms · T13 live 13/13 (animation on/off·reduced-motion·tooltip·키보드·해제 후 데이터 교체, canonical write 0). 재현: `node apps/builder/scripts/adr209-bundle-closure.mjs` · `adr209-runtime-perf.mjs` · `adr209-builder-frame-ab.mjs` · `adr209-t13-live.mjs`.
- F4 production 검증 9/9 (실제 세션 로그인, populated 프로젝트): cold boot·선택·편집 동안 차트 runtime chunk 요청 0, 차트 Preview 최초 진입 1회, 차트 없는 Preview/Publish 0. 재현: `node apps/builder/scripts/adr209-f4-production-network.mjs --headed`.
- 상세 설계: `docs/adr/design/209-chart-followup-repair-breakdown.md` §10.4–10.6 (F2·F3·F4 닫힘). 전체 초기 500 KB 는 Builder/Preview 가 기준 revision 부터 초과라 §8.5 예산 결정 (A/B) 이 남아 ADR 은 In Progress 유지.

## [AI 어시스턴트 — Claude 요청의 prompt caching · 구조화 출력 · 도구 계약 정합] - 2026-09-09

### Changed

- AI 패널이 Claude API 를 부를 때 system prompt 와 도구 정의를 prompt cache 에 올린다. 같은 세션의 두 번째 요청부터 이 부분은 캐시 read 로 청구된다 (입력가의 1/10, Fable 5.1 은 1/40). 응답의 토큰 사용량 (`cache_read_input_tokens` 포함) 을 provider 가 읽어 개발 빌드 콘솔에 표시한다.
- planner·verifier 가 Anthropic provider 에서는 구조화 출력 (`output_config.format`) 으로 JSON 을 받는다. 프롬프트의 "JSON 만 출력" 강제와 코드 펜스 추출은 OpenAI 호환 (Ollama) 경로에만 남는다.
- 안전 분류기가 붙는 모델 (Opus 5 · Fable) 에는 `fallbacks: "default"` 를 보내, 거절되면 같은 호출 안에서 권장 모델로 다시 돈다.

### Fixed

- `create_element` 도구의 type 목록이 손으로 적은 28개라 system prompt 의 카탈로그 (124) 와 어긋나던 문제를 수정했다. 골격 힌트가 만들라는 Heading·ProgressBar 가 스키마에 없었다. 이제 카탈로그의 placeable type 에서 파생한다.
- 매 요청 전에 get_editor_state 호출을 강제하던 규칙을 뺐다. 요청 컨텍스트가 이미 페이지·선택 요소를 싣는다. update_element·get_selection 도구 설명에 병합/교체 의미와 호출 시점을 적었다.

### Validation

- 요청 본문 모양·usage 파싱·구조화 출력·enum 파생을 덮는 테스트 15개 추가, AI 서비스·i18n 스위트 281개 통과, type-check PASS. 실제 캐시 hit 는 `AnthropicProvider.live.test.ts` 의 키 게이트 케이스로 잰다 — 이 환경에 Anthropic 키가 없어 미실행.
- 근거와 전체 감사 결과: `docs/explanation/research/PROMPT_AUDIT_2026-09.md` (Claude Platform 블로그 2026-09-08 권장 3축 적용).

## [차트 속성의 종류 변경 버튼이 다른 패널 버튼과 같아집니다] - 2026-09-09

### Fixed

- 차트 Properties 패널의 "Change chart type" 버튼만 테두리도 배경도 없이 맨 버튼으로 보이던 문제를 수정했다. 패널 버튼 정본을 쓰게 해서 높이가 다른 패널 필드와 같은 격자에 맞고 hover·누름·포커스 표시도 같아진다.

## [데이터 연결 — 연결한 데이터가 실제로 그려집니다] - 2026-09-09

### Fixed

- Data 패널에서 만든 DataTable이나 API를 컴포넌트에 연결해도 Preview가 연결을 무시하고 예시 항목만 그리던 문제를 수정했다. ListBox·TagGroup 등 컬렉션 컴포넌트가 연결한 데이터 행을 그린다. 연결 정보는 문서의 `x-composition` 자리에 저장되는데 Preview로 넘어가는 props에 실리지 않아, 화면을 그리는 쪽이 연결 자체를 보지 못했다.
- Builder 캔버스에서 TagGroup만 연결을 놓치고 예시 태그를 그리던 문제를 함께 수정했다. 연결은 TagGroup이 갖는데 캔버스는 자식 태그 목록에서만 찾고 있었다. 이제 캔버스와 Preview가 같은 연결에서 같은 행을 그린다.

### Validation

- 실제 Builder에서 5행짜리 DataTable을 만들어 TagGroup과 ListBox에 연결하고, Preview DOM과 Skia 캔버스가 모두 같은 5행을 그리는 것을 확인했다. 연결 전 화면을 대조군으로 같이 캡처했다.
- 읽기 우선순위 계약과 캔버스 투영 회귀를 덮는 테스트 11개를 추가했다. builder 5,620개와 shared 1,155개 통과.

## [차트 생성과 실행 분리 — ADR-209 구현, 종결 검증 진행 중] - 2026-09-09

### Added

- Charts 섹션에서 Area·Bar·Line·Pie·Radar·Radial을 바로 추가하고 종류에 맞는 속성과 프리셋을 편집한다. 저장 타입은 기존 `Chart`를 유지한다.
- Preview·Publish는 공통 lazy Recharts 3.10.1 runtime을 사용한다. 새 차트에는 애니메이션을 기본 활성화하며, 설정이 없는 기존 차트는 정적 기본값을 유지한다. reduced-motion을 존중한다.

### Changed

- Builder Canvas는 기존 기하와 원본 앞 200행 샘플을 유지한다. Preview·Publish는 전체 현재 collection rows를 사용하며 200행 이후 값도 합계에 반영한다.
- Chart와 기존 데이터 컴포넌트가 같은 DataTable/API provider를 사용한다. Export/Import와 독립 Publish에 공통 데이터 소스를 전달한다. 새 데이터 envelope의 구 버전 strict Import와 메모리 전용 runtimeData의 리로드 한계는 ADR에 명시했다.

### Fixed

- 차트의 컬렉션 필드 선택과 기본 데이터 행 편집 명칭을 `Category / Value / Series`(한국어 `범주 / 값 / 시리즈`)로 통일했다. 실제 데이터 키와 저장 매핑은 유지하며, `Value`·`Series`처럼 번역어와 겹치는 컬렉션 키도 원문 그대로 표시한다.
- Settings의 언어 변경이 차트 속성·프리셋·옵션·안내·행 편집과 차트 추가 목록·최근 사용 항목·검색 결과에 즉시 반영된다. 누락된 번역 키와 고정 문자열을 기존 번역 경로에 연결했다.
- 기존 차트의 Styles → Layout padding이 그림에 적용되지 않던 오류를 수정했다. Canvas와 Preview·Publish의 공통 기하가 전체·방향별 여백을 읽으며, 미지정 방향은 기존 기본값을 유지한다.
- ID 없는 차트 행을 선택할 때 발생하던 중복 key 콘솔 오류와 행 편집·삭제 실패를 수정했다. 원본 데이터에 ID를 강제로 추가하지 않는다.
- API 정의가 늦게 도착하거나 재시도가 성공한 뒤 이전 오류가 남던 공통 collection 상태 판정을 수정했다. DataTable 오류에는 동작하지 않는 재시도 버튼을 표시하지 않는다.
- 숨김/0 크기 차트의 가짜 기본 크기를 제거하고 실제 크기로 렌더한다. Publish의 페이지 body 레이아웃 중복 적용을 수정했다.

### Validation

- 필드 명칭·언어 전환·원본 키 보존·팔레트 생성 계약 관련 35개 테스트와 preflight를 통과했다. 전용 Builder에서 컬렉션 차트와 기본 행 편집의 한국어↔영어 전환, 한국어 검색, 검증용 차트 생성 Undo를 확인했다.
- 실제 Recharts 기하·옵션, light/dark 토큰, DPR 1/2, reduced-motion 및 canonical/ref 보존을 검증했다. G5 전체 번들 기준 결정과 production Builder 로그인 후 부트 검증이 남아 ADR 상태는 In Progress다.

## [차트 속성 — 고른 차트에 쓰이는 값만 보입니다] - 2026-09-09

### Added

- **radar/radial 제어 7종** (ADR-208). 격자 모양을 링만 남기거나 전부 끄고(`Show Spokes` · `Grid Rings` · `Fill Grid`), 다각형을 선만으로 그리고(`Fill Area`), 반원 게이지를 만들고(`Start Angle` · `End Angle`), 값 대신 범주 이름을 적을 수 있습니다(`Label Content`). shadcn/ui charts 예제 기준 커버리지가 33 → 45종(70 중), radar 는 5/14 → 11/14 입니다.

### Changed

- **속성 패널이 고른 차트 종류에 맞는 항목만 보여 줍니다.** 막대 차트를 편집하는데 `Grid Type`·`Inner Radius` 처럼 극좌표에서만 쓰이는 값이 함께 보이던 것을 없앴습니다. 값을 바꿔도 그림이 안 바뀌는 항목은 이제 화면에 나오지 않고, 종류를 바꿨다 되돌리면 숨어 있던 값은 그대로 돌아옵니다 — 숨김은 표시에만 적용되고 저장된 값은 지우지 않습니다.
- 같은 규칙으로 `Label Content` 는 값 레이블을 켰을 때만, Card 의 `Selected` 는 선택 가능으로 둔 카드에서만 보입니다. Card 쪽은 조건이 예전부터 선언돼 있었으나 화면까지 이어져 있지 않아 동작하지 않던 것을 이번에 이었습니다.

### Fixed

- 차트 속성 3종의 노출 조건이 실제 동작과 어긋나 있던 것을 바로잡았습니다 — `Stack Type` 은 선·파이 차트에서도 쓰이고, `Inner Radius` 는 radar 도 씁니다.

## [중첩 거부 — 부분 거부도 알리고 유령을 남기지 않습니다] - 2026-09-09

### Fixed

- **규칙에 걸려 들어가지 못한 요소가 조용히 유령으로 남던 결함** — 중첩 규칙 (Pen 구조 · RAC 합성 · HTML 의미) 은 배치의 **일부만** 어기면 나머지를 통과시킵니다. 그런데 통과가 있었다는 이유로 "변경됨" 이 되어, 전량 거부에만 있던 가드를 지나갔습니다. 생성 경로는 거부 사실을 아예 버리고 요소 전부를 빌더 배열에 넣었습니다. 그래서 거부된 요소가 canonical 에도 없고 저장도 안 되면서 배열에만 남았고, 사용자에게도 콘솔에도 아무 신호가 없었습니다 (새로고침하면 사라집니다). 이제 거부된 id 가 결과에 실리고, 요소 추가·복합 요소 추가·컴포넌트 팩토리·인스턴스 생성이 그 id 를 빼고 저장소·히스토리·커밋 기록에 씁니다. 거부되면 왜 못 놓였는지 토스트로 알립니다 (끌어놓기·붙여넣기가 이미 쓰던 문구 그대로).
- **되돌리기가 거부된 요소를 되살릴 수 있던 자리** — 히스토리의 삽입 이벤트를 배치 전체로 만들고 있어, 거부된 요소의 이벤트까지 기록에 들어갔습니다. 이제 통과한 요소로만 만듭니다.
- **미리보기에서 만들어진 요소가 규칙에 걸리면** 이유가 콘솔에 남습니다 (종전에는 무음 폐기).

## [Monitor 패널 제거] - 2026-09-09

### Removed

- **Monitor 패널을 삭제했습니다** (단축키 ⌃⌥M · 헤더 메뉴 항목 · 하단 레일 등록 전부). 패널의 Optimize 버튼이 메모리를 실제로 회수하지 못했고, 회수할 것 자체가 없다는 것이 측정으로 확인됐습니다. 버튼이 부르던 정리는 **빈** 페이지 히스토리 Map 항목 삭제와 이미 DB 열 때마다 도는 90일 경과 IndexedDB 정리뿐이고, 가비지 컬렉션 힌트는 `--expose-gc` 로 띄운 브라우저에서만 존재합니다. 그런데도 누르면 차트가 0 으로 리셋돼 (`setMemoryHistory([])` + 값이 안 바뀌면 다시 안 채우는 수집 조건) "Current 0 B" 라는 근거 없는 표시가 남았습니다.
- 측정 (같은 프로젝트 · 부팅 → ready → 2.5초 안정 → 강제 GC): 패널이 "Memory Usage" 로 보여주던 히스토리는 **10.6KB** 인데 렌더러 물리 메모리는 dev 415MB · production **206MB** 였습니다. 해제 가능한 Skia 캐시 (노드 픽처 · 이미지) 를 전량 비워도 렌더러 RSS 696MB → 696MB 로 변화가 측정 노이즈 이하였습니다 (LRU 상한 1024개 / 128MB 예산이 이미 스스로 관리하고, 이 문서는 그 근처에 가지 않습니다). CanvasKit WASM 은 예약 128MB 중 실제 상주가 **26.2MB** 라 (vmmap `[128.0M 26.2M 26.2M]`) 초기 메모리를 줄여도 회수량이 한 자릿수 MB 입니다. 즉 패널이 노출하던 축은 전체의 1~2% 이고 그마저 줄일 것이 없습니다.
- 하단 레일 구조 자체는 남습니다 (등록 패널이 0 이 됐을 뿐입니다). 저장된 레이아웃에 남은 `monitor` 항목은 레지스트리 대조에서 자동으로 걸러집니다 — 별도 마이그레이션이 필요 없습니다.

## [중첩 제약 — Pen 구조 · RAC 합성 · HTML 의미] - 2026-09-08

### Changed

- **토스트가 빌더 chrome 어법을 따릅니다** — 캔버스 위에 뜨는 알림이 rail · 뷰포트 컨트롤 · contextual action bar · 패널 프레임과 다른 자기만의 디자인이었습니다 (지면색 표면 · 1px 테두리 · 타입별 좌측 3px 스트라이프 · 14px 글자 · 채운 파란 액션 버튼). 이제 같은 chrome island 토큰을 씁니다. 테두리 없이 raised 표면 + 그림자 단계로 분리하고, 모서리·여백·간격은 chrome 토큰, 글자는 크롬 기준 12px, 되돌리기는 빌더 primary 컨트롤 어법 (accent 채움 + 역상 글자) 으로 도드라지게 두고, 닫기는 28px ghost 아이콘 버튼입니다. `--accent` 는 빌더에서 파랑이 아니라 중립이라 새 색상 축이 늘지 않습니다. 타입 구분은 아이콘 색이 합니다.
- **되돌리기를 누를 시간이 생겼습니다** — 알림이 5초 만에 사라져 문구를 읽고 버튼까지 가기 어려웠습니다. 되돌리기가 달린 알림은 12초, 거부 안내는 8초로 늘리고, **포인터가 올라가 있거나 안에 포커스가 있는 동안 타이머가 멈춥니다** (벗어나면 남은 시간부터 재개 — hover 만으로 수명이 늘지 않습니다). 하단 액션 바를 덮지 않도록 알림 위치도 한 줄 위로 올렸고, 액션 바를 알림 자리로 끌어다 놓은 경우에는 겹치는 만큼만 더 띄웁니다 (바가 물러나면 원래 자리로 돌아옵니다).

### Fixed

- **RAC 가 그릴 수 없는 중첩을 빌더가 만들어 내던 결함** — Button 안에 Button, Link 안에 Checkbox, Form 안에 Form, Text 안에 무엇이든, Select 안에 Button, Tabs 밖의 TabPanel 이 끌어놓기·붙여넣기·AI 도구 어디서든 통과해 문서에 남았습니다. 캔버스는 RAC 를 그리는 도구라 세 층의 제약을 **상속**합니다. Pen 구조 (`Text`·`Icon` 은 잎 — `.pen` 으로 나갈 때 `text`/`icon_font` 라 자식을 가질 수 없음) · RAC 합성 (컬렉션 컨테이너는 자기 item 만 읽고, 합성 부품은 소유자 안에서만 뜻이 있음) · HTML 의미 (interactive 는 `<button>`/`<a>` 자손 금지, `<form>` 안 `<form>` 금지, `<p>`/`<h1-6>`/`<label>` 안 블록 금지). 규칙은 canonical 스키마가 아니라 catalog 층에 있어 canonical 은 Pen 형태를 그대로 유지합니다.
- **알림 경로를 빌더 전역 하나로 통합** — 빌더 안에 알림 경로가 둘이었습니다 (전역 store · 컴포넌트별 로컬 훅). 렌더 컨테이너는 둘을 합쳐 그리는데 BuilderCore 와 Monitor 패널이 각자 컨테이너를 마운트해, Monitor 패널 (Ctrl+Alt+M) 을 열면 전역 알림이 **두 번씩** 떴습니다 (컨테이너 2 · 알림 4 · 같은 이름의 Notifications 랜드마크 2). 로컬 훅을 삭제하고 발신은 전역 store, 렌더는 BuilderCore 의 컨테이너 하나로 고정했습니다. 성능 복구 · 프로젝트 내보내기/가져오기 · 메모리 경고 알림도 이제 되돌리기 버튼 · hover 정지 같은 전역 기능을 같이 받습니다. 미리보기/publish 의 런타임 토스트는 사용자 사이트 표면이라 별개로 둡니다.
- **알림의 되돌리기가 실제로 되돌립니다** — 버튼을 눌러도 옮겨 놓인 요소가 그대로 남았습니다. 히스토리 매니저의 `undo()` 는 엔트리를 꺼내 포인터만 옮기고 문서·스토어 역적용은 스토어 action 이 하는데, 알림이 매니저를 직접 불렀습니다. 되돌리는 것이 없으면서 히스토리 위치만 어긋나던 상태입니다. 자식이 딸린 복합 요소 (ButtonGroup · TextField) 도 한 번에 되돌아갑니다.
- **끌어놓기·붙여넣기는 거부하지 않고 옮깁니다** — 넣을 수 없는 자리에 놓으면 가장 가까운 유효한 조상에 넣고 토스트로 알리며 **되돌리기** 를 줍니다. 조상 어디에도 못 두면 (예: Tabs 가 없는 곳의 TabPanel) 취소하고 이유를 알립니다.
- **AI 도구** `create_element` · `batch_design` 은 잘못된 `parentId` 를 받으면 이유와 함께 실패를 돌려줍니다 (에이전트는 토스트를 못 봅니다).
- **canonical 변이 경계가 fail-closed 백스톱** — preflight 를 거치지 않은 경로가 위반 이동·삽입을 요청하면 `changed: false` + `nestingViolation` 으로 거부합니다. 기존 노드의 제자리 prop 갱신은 검사하지 않아 옛 문서의 위반이 무관한 편집을 막지 않습니다.
- **pencil export 경계에 가드** — `Text`·`Icon` 에 자식이 있는 옛 문서는 스키마 위반 `.pen` 이 되므로 export 함수가 어느 노드인지 말하며 거부합니다 (아직 UI 에 연결된 export 경로는 없어 지금은 코드 경계의 보호입니다).
- **자기 자신을 다시 담던 컨테이너 (같은 날 후속)** — ButtonGroup 안에 ButtonGroup, TextField 안에 TextField 가 팔레트 추가·끌어놓기·붙여넣기로 들어갔습니다. RAC 컬렉션 표만 상속해 composition 자체 추상 (ButtonGroup · AvatarGroup · CardView · Pagination · Toast) 과 DOM 이 parent props 로만 self-compose 하는 field 가족 (TextField · TextArea · NumberField · SearchField · DateField · TimeField · ColorField · Select · ComboBox · DatePicker · DateRangePicker) 을 빠뜨린 것이 원인입니다. 이들은 인식하는 sub-part 밖의 자식을 Preview 에 그리지 않으므로 (Skia 만 그림 → 비대칭) 새 표 `SELF_COMPOSED_CONTAINER_CHILD_TYPES` 가 strict 로 막고, `<img>`·`<input>` 같은 void/self-contained 타입 (`DOM_LEAF_TYPES` — Image · Avatar · Chart · Input · DateInput · ColorSwatch 등 24종) 은 자식을 아예 받지 않습니다. Checkbox · Radio · Switch 는 label 슬롯 (Label · Text · Icon) 만, TableView → TableHeader/TableBody → Column/Row → Cell, Tree → TreeItem 도 같은 표에 있습니다. Card · Dialog · Popover · Disclosure 같은 열린 컨테이너는 그대로입니다.
- 규칙 표 (`RAC_COLLECTION_CHILD_TYPES` · `RAC_SUBPART_OWNER_TYPES` · `SELF_COMPOSED_CONTAINER_CHILD_TYPES`) 는 손으로 썼지만 팩토리가 실제로 만드는 합성 트리 52개 전부가 통과하는지 오라클 테스트가 고정합니다 — 표가 틀리면 표를 고칩니다.

## [차트 — radar · radial (극좌표 2종)] - 2026-09-08

### Added

- **Radar** — 범주가 원둘레에 놓이고 값이 중심에서의 거리가 됩니다. 시리즈마다 닫힌 다각형 하나로 그려져 여러 시리즈의 모양을 겹쳐 봅니다. **Grid Type** 으로 격자를 다각형/원 중에 고릅니다. 값이 없는 범주는 그 꼭짓점이 중심으로 접힙니다 (선 차트처럼 끊으면 닫힌 도형이 깨져 없는 면적이 생깁니다). 범주가 많으면 각도 레이블을 겹쳐 그리는 대신 일부만 그립니다.
- **Radial** — 범주가 링이 되고 값이 호의 각도가 됩니다. 링마다 옅은 트랙(=100% 자리)과 값 호가 겹쳐 그려집니다. 누적을 켜면 한 링 안에서 시리즈가 각도로 이어 붙습니다. Inner Radius 로 가운데 구멍 크기를 조절합니다.
- **툴팁** 은 radar 는 범주 부채꼴 (그 안의 시리즈 전부), radial 은 **링** 단위로 뜹니다 — 누적 radial 은 같은 각도에 시리즈가 쌓이므로 가리키는 대상을 반지름이 가릅니다.
- radar 는 Orientation · Curve · Show Dots 외 · Color By · Stack Type 을, radial 은 Orientation · Curve · Show Dots · Grid Type 을 **무시합니다** (각 차트에 뜻이 없는 축). 무시한다는 사실 자체를 테스트로 고정했습니다.

### Fixed

- **저장된 문서를 다시 열면 차트의 새 설정이 기본값으로 돌아가던 결함**을 고쳤습니다. 2026-09-08 확장에서 추가한 Curve · Show Dots · Show Value Labels · Color By · Inner Radius · Show Total · Show Tooltip 이 문서 로드 경로를 지나지 않아, 팔레트에서 놓을 때는 되고 저장 후 Preview·배포본에서만 기본값 차트가 나왔습니다 (빌더 캔버스는 정상이라 눈에 안 띄었습니다).

- 근거: ADR-207. 좌표 대칭 게이트 64 → **84** (radar polygon/circle · radial 단일/누적 4케이스, path `d` byte 동일) · 기하 단위 106 → **160** · 실제 CanvasKit 픽셀 8 · live 빌더 **17/17** (팔레트 전환이 캔버스 픽셀을 바꾸는지 → Preview DOM 의 격자·트랙 → 툴팁이 반지름으로 갈리는지). 번들 증가 builder +2.40KB gz · publish +2.11KB gz (한도 각 +5KB). 200행 × 4시리즈 프레임 p95 Δ radar −0.2ms / radial +0.3ms (대조군 = 같은 문서의 막대 차트, 재측정 편차 ±0.2ms, 한도 +1ms). live 1차가 잡은 결함 1건 — radial 트랙이 선으로만 그려져 고리가 동심원 2개로 읽히던 것 (좌표는 옳아서 단위·대칭 테스트는 통과했습니다).

## [차트 — 누적·곡선·점·값 레이블·도넛·툴팁 (shadcn charts 대조 반영)] - 2026-09-08

### Added

- **누적 area** 가 됩니다. 종전엔 area 를 여러 시리즈로 그리면 누적 설정과 무관하게 겹쳐 그려져 뒤 시리즈가 앞을 가렸습니다. Stack Type 에 **Stacked 100%** 도 생겼습니다 — 범주별 합을 100 으로 맞춰 비중을 비교하고, 축 눈금도 0~100 으로 읽힙니다 (막대에도 적용됩니다).
- **선 모양 (Curve)** 을 고릅니다 — Linear (직선) · Monotone (부드러운 곡선) · Step (계단). 곡선은 데이터에 없는 봉우리를 만들지 않는 단조 보간이라 값을 과장하지 않습니다. area 는 위·아래 경계가 같은 모양을 따릅니다.
- **Show Dots** — line/area 의 각 데이터 지점에 점을 찍습니다.
- **Show Value Labels** — 막대 끝 (누적이면 칸 안쪽 중앙) · 선의 점 위 · 파이 조각 안에 값을 적습니다. 칸이 글자보다 좁으면 겹쳐 못 읽는 대신 그 레이블만 생략합니다. 100% 누적이어도 **원래 값**을 적습니다.
- **Color By** — 막대 색을 시리즈 대신 **범주별**로 가릅니다 (막대마다 다른 색).
- **도넛** — Inner Radius (%) 를 올리면 파이가 도넛이 되고, **Show Total** 을 켜면 구멍 안에 합계와 값 필드 이름이 들어갑니다 (구멍이 글자보다 작으면 생략). 시리즈가 여러 개이고 누적을 켜면 **시리즈마다 링**이 하나씩 그려집니다.
- **Show Tooltip** — Preview 와 배포본에서 차트 위에 마우스를 올리면 그 범주의 시리즈 값이 뜨고, 가리키는 구간이 옅게 강조됩니다. 막대 사이 여백에서도 끊기지 않습니다. 빌더 캔버스는 종전대로 정적으로 그립니다 (hover 는 실제 화면의 몫).

### Fixed

- **파이 범례가 조각과 무관한 이름을 나열하던 결함**을 고쳤습니다. 파이는 조각이 범주인데 범례는 시리즈를 세고 있어, 화면에 없는 이름과 색이 붙었습니다. 이제 범례 항목이 색을 가르는 축을 따라갑니다 (파이·막대 범주별 색 → 범주, 그 외 → 시리즈).

- 근거: shadcn/ui charts 7개 범주 대조 (radar · radial 은 별도 ADR 로 남김). 기하 단위 106 · 좌표 대칭 게이트 64 (path `d` byte 동일 · 글자 배율 채널 대조 포함) · 실제 CanvasKit 픽셀 7 (3차 베지어 · 호 고리 구멍 신규) · live 빌더 20/20 (Skia 픽셀과 Preview DOM 을 축마다 따로 확인 — 도넛 구멍은 캔버스 잉크 15.5% 감소, 툴팁은 hover 로 "Tue A 30 B 8"). 외부 차트 라이브러리는 여전히 쓰지 않습니다.

## [차트 컴포넌트 추가 — bar · line · area · pie] - 2026-09-08

### Added

- 컴포넌트 패널 Collections 에 **chart** 가 추가됐습니다. 끌어다 놓으면 샘플 데이터가 실린 막대 차트가 바로 보이고, Properties 에서 종류 (bar / line / area / pie) · 가로세로 · 누적/나란히 · 축 · 격자 · 범례 (위/아래/좌/우) · 크기 (sm/md/lg) 를 바꿉니다. 어느 필드를 범주로 쓰고 어느 필드를 값으로 쓸지도 지정합니다 (Dimension / Metric / Series Field).
- DataTable 바인딩을 붙이면 그 데이터로 그립니다. 바인딩이 없거나 아직 0행이면 샘플 rows 로 보여 빈 상자가 되지 않습니다. 빌더 캔버스는 앞 200행까지 그리고, Preview 와 배포본은 전체를 그립니다.
- **외부 차트 라이브러리를 쓰지 않습니다** (신규 런타임 의존 0). 축·눈금·범례·마크를 자체 기하 함수로 산출하고 Builder(캔버스)와 Preview/배포본(SVG)이 **같은 좌표를 복사**합니다 — 두 화면이 다르게 보일 여지를 구조로 없앴습니다. 시리즈 색은 테마 토큰이라 dark 모드에서 양쪽이 같이 바뀝니다.
- 접근성: 차트 컨테이너에 `role="img"` 와 라벨이 붙습니다.
- v1 에 없는 것: 곡선 보간 (직선만) · 축 레이블 회전 (겹치면 건너뛰어 그립니다) · 툴팁/hover.
- 근거: ADR-194. live 빌더 11/11 (팔레트 노출 → 캔버스 픽셀 → 종류 전환 → Compare Mode 에서 Preview SVG 대조 → 팔레트 CSS 변수 도달 → role/aria) · 좌표 대칭 게이트 28 (path `d` byte 동일) · 기하 단위 43 · 실제 CanvasKit 픽셀 5 · 행 주입 6. 번들 증가 builder +6.71KB gz · publish +5.90KB gz (한도 +15KB). 200행 × 4시리즈에서 프레임 p95 Δ +0.2ms (3회 측정 +0.2 / +0.6 / −0.2, 한도 +1ms).

## [캔버스 — 화면 밖 viewport 로 저장된 프로젝트가 95% 에서 멈추던 결함] - 2026-09-07

### Fixed

- 저장된 캔버스 위치가 화면 밖이면 (예: `{x: -2147, y: -340}`) 프로젝트를 다시 열 때 "Preparing the canvas… 95%" 에서 영원히 멈추던 결함을 고쳤습니다. 화면 밖 페이지는 컬링돼 레이아웃이 발행되지 않고, 그러면 빈 프레임만 나와 첫 프레임 확인이 오지 않았습니다. 이제 그릴 것이 이 문서 상태에 실제로 없으면 빈 화면 자체를 실제 surface 제출로 확정합니다 — 화면에 맞추기 (Cmd+0) 로 되돌아오면 내용이 정상으로 그려집니다. 레이아웃이 아직 준비되지 않은 상태 (그릴 root 는 있는데 레이아웃 결과가 없는 경우) 는 종전대로 계속 기다립니다. timeout 이나 가짜 진행률로 여는 경로는 없습니다.
- 빈 화면이 계속되는 동안 매 프레임 GPU 제출이 돌던 것을 멈췄습니다 (실측 120회/초 → 입력이 바뀔 때 1회). 같은 분기가 매 프레임 `invalidateContent` 로 다음 프레임을 다시 예약하던 것이 원인입니다.
- 근거: live Playwright 재현 — 수리 전 reload 2회 모두 95% 고정 (`clearSubmission` 3,060 · readiness 기록 없음), 수리 후 ready · `clearSubmission` 2 → 2 → 2 · Cmd+0 복귀 시 `renderBoundsCount` 57. 회귀 static 3 (원복 RED 3) · 캔버스 단위 516 · parity 1,380 · visual smoke 101.

## [레이아웃 엔진 — flex baseline 정렬 · safe/unsafe · self-start/self-end] - 2026-09-07

### Fixed

- flex 컨테이너의 `align-items: baseline` / `align-self: baseline` 을 캔버스가 반영합니다 — 높이가 다른 상자·텍스트가 baseline 을 맞춰 놓이고 (h30 · h60 → 위 상자가 30 내려감, 텍스트는 글자 baseline), 그룹이 컨테이너 높이를 키웁니다. 종전엔 stretch 로 떨어졌습니다. `margin: auto` 가 있는 item 과 세로 (column) 컨테이너는 CSS 대로 start 입니다.
- `justify-content` · `align-items` · `align-self` · `align-content` 의 `safe` 접두를 반영합니다 — 내용이 넘칠 때만 start 로 (`safe center` 여유 있으면 center 150, 넘치면 0). 접두 없는 `center` 는 종전대로 양쪽으로 넘칩니다 (`unsafe` 와 같음, Chrome 동일).
- `self-start` / `self-end` 키워드가 무시되던 것을 start / end 로 반영합니다 (`align-items: self-end` 높이 200 안 50 → y 150).
- 근거: Taffy 0.10→0.14 대조 §4 ⑦ (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md`, Taffy #1109 · #1127 · #952 · #1077). Chrome 실측 fixture 26 × 2 leg (baseline 34 RED) · 엔진 단위 2 · flex 커널 슬롯 계약 21 → 22 (golden 갱신) · live 빌더 4 케이스 Chrome 동일. 이로써 Taffy 대조 §4 의 ①~⑨ 가 전부 반영됐습니다. 상세 ledger §30.

## [레이아웃 엔진 — grid 라인 이름 · auto-fill/auto-fit] - 2026-09-07

### Fixed

- `grid-template-columns: [a] 1fr [b] 1fr [c]` 처럼 대괄호 라인 이름이 있으면 캔버스가 이름을 트랙으로 세어 열이 늘어나던 결함을 고쳤습니다 (2열 150/150 이 5열 60 으로). `grid-column-start: b` · `x 2` 같은 이름 배치도 됩니다.
- `repeat(auto-fill | auto-fit, …)` 의 반복 수가 Chrome 과 어긋나던 결함을 고쳤습니다 — `minmax(auto, 200px)` · `25%` 가 1 반복으로 접혀 세로로 쌓이던 것 (Chrome 3·4 반복), 반복 밖 고정 트랙이 있으면 한 반복 과다.
- `auto-fit` 의 빈 트랙이 캔버스에 남아 item 이 좁게 그려지던 결함을 고쳤습니다 — 빈 트랙과 그 gutter 가 사라져 `repeat(auto-fit, minmax(100px,1fr))` 600 폭 2 item 이 300/300 (gap 20 이면 290/290) 이 됩니다. 명시 배치 앞의 빈 트랙도 사라집니다.
- 근거: Taffy 0.10→0.14 대조 §4 ⑥ (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md`, Taffy #1138 · #946 · #1035). Chrome 실측 fixture 19 × 2 leg (baseline 22 RED) · 엔진 단위 3 · live 빌더 3 케이스 Chrome 동일. 레이아웃 preset 의 `repeat()` 회피 사유는 이제 없습니다 (명시 나열은 설계 선택). 상세 ledger §29.

## [레이아웃 엔진 — flow-root · inline-block · absolute 상자의 margin 누출, block align-content] - 2026-09-07

### Fixed

- `display: flow-root` · `inline-block` · `position: absolute` 인 Frame 안 첫/마지막 자식의 `margin` 이 상자 밖으로 새어 캔버스에서 상자가 그만큼 낮게 잡히던 결함을 고쳤습니다 (자식 `marginTop: 40px` + 높이 10 — Preview/Chrome 상자 50 / 캔버스 10). 세 경우 모두 CSS 의 새 block formatting context 라 margin 이 상자 안에 남습니다. 빈 `flow-root` 상자도 위아래 margin 을 따로 유지합니다.
- block Frame 의 `align-content` (Chrome 123+) 를 캔버스가 반영합니다 — `center` / `end` 는 내용 묶음을 여유 공간에 정렬 (높이 200 안 50 → y 75 / 150), `space-around`·`space-evenly` 는 center 로, `space-between` 은 start 로. 내용이 넘치면 기본은 start 에 고정하고 `unsafe center` 만 위로 넘칩니다. `min-height` 가 만든 여유도 정렬합니다. `normal` 이 아닌 값이면 (`start` 포함) 첫/마지막 자식 margin 이 상자 안에 남습니다 (Chrome 동일).
- 근거: Taffy 0.10→0.14 대조 §4 ⑧ (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md`, Taffy #997 · #959). Chrome 실측 fixture 36 × 2 leg (baseline 48 RED) · 엔진 단위 4 · live 빌더 (Playwright) 에서 flow-root 상자 50 · center 자식 85 확인. 상세 `.claude/skills/composition-patterns/reference/layout-css-parity-ledger.md` §28.

## [캔버스 텍스트 — 이모지 폭 과대 · 이모지 앞뒤 줄바꿈] - 2026-09-07

### Fixed

- 이모지가 들어간 텍스트가 캔버스에서 Preview 보다 이른 줄에서 접히던 결함을 고쳤습니다. Chrome (macOS · Retina) 의 canvas 측정이 이모지 하나당 3~~4px (12~~20px 글자 크기) 넓게 나오는 브라우저 버그 (Chromium #489494015) 가 원인 — 폰트당 1회 DOM 과 대조한 보정값을 이모지 개수만큼 차감합니다. Retina 가 아니거나 24px 이상이면 차이가 0 이라 보정도 0 입니다.
- 이모지 앞에서 줄이 바뀌지 않고 이전 줄 끝에 붙어 넘치던 결함을 고쳤습니다 — Chrome 처럼 이모지 앞뒤가 모두 줄바꿈 기회입니다 (`Hello😀World` 좁은 폭 → 3줄). 국기·피부톤·가족(ZWJ) 이모지는 한 단위로 유지됩니다.
- 근거: pretext 대조 §D 순서 5 (`docs/explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md`). 사용자 Chrome 152 / DPR 2 재현 확인 후 착수. 단위 7 (파일 78) · live 4 텍스트 × 3 경계 폭에서 Chrome 줄 위치와 12/12 일치, 폭 소수점 동일. evidence `docs/adr/evidence/051-emoji-canvas-width-correction.md`.

## [캔버스 — 내용 크기 Frame 안 텍스트가 0 또는 전폭으로 접히던 결함] - 2026-09-07

### Fixed

- `width: max-content` / `min-content` / `fit-content` 인 block Frame 안의 텍스트가 캔버스에서 Frame 전폭 (400) 으로 늘어나거나, 좌우 padding 이 있으면 padding 폭만 (12) 남던 결함을 고쳤습니다. Preview/Chrome 처럼 텍스트 폭 (82.4 / 94.4 / 41.5) 이 됩니다.
- 세로 flex 의 `align-items: center` 안 block Frame 의 텍스트 (Container Align) 가 캔버스에서 폭 0 으로 사라지던 결함도 같은 원인 — 이제 82.4 @ x 158.8 (Chrome 동일).
- 원인은 엔진이 아니라 TS 공급: 텍스트 측정 스칼라가 flex/grid 자식에게만 공급돼 shrink-to-fit block 부모에서 엔진이 내용 폭을 몰랐습니다 (ledger §27). definite block 부모 (stretch) 와 `%` 폭은 종전과 같습니다. 게이트 `tests/parity/textLeafScalarBlockParent.browser.test.ts` 8 (baseline 4 RED), `containerIntrinsic` H 의 구 잔존 Δ1.5 (block 자식 텍스트 하한) 도 같은 원인이라 `[]` 로 닫힘, ADR-923 G5 fingerprint baseline 은 text/label @absent·@auto 스칼라만 의도 갱신, parity 1,218 PASS (기존 실패 2) · layout unit 475 · type-check 0.

## [레이아웃 엔진 — padding 있는 텍스트의 폭 이중 가산 · grid 안 padded 컨테이너 크기] - 2026-09-07

### Fixed

- flex 컨테이너 안 Text 에 좌우 `padding` 을 주면 캔버스 폭이 padding 만큼 더 넓어지던 결함을 고쳤습니다 (`paddingLeft: 12px` "Hello World" — Preview/Chrome 94.4 / 캔버스 107, `12 + 8` — 102.4 / 123). 세로 padding 과 padding 없는 텍스트는 종전대로입니다.
- grid 컨테이너 안에서 `padding` 이 있는 auto 크기 Frame 이 padding 만큼 작게 잡히던 결함을 고쳤습니다 — `auto` 트랙 폭 (50 → 70), `justify-items: start` 배치 폭, auto 행 높이 (20 → 40) 전부 Chrome 값.
- 근거: Taffy 0.10→0.14 대조 §4 ⑨ (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md`) — "실측 전 판정 보류" 항목을 pipeline 실측으로 확정. 엔진의 auto 축 반환 계약 (content-box) 을 leaf 까지 통일하고 grid 소비처가 pad/border 를 더합니다 (ledger §26). Chrome 차등 게이트 `tests/parity/paddedLeafIntrinsic.browser.test.ts` 16 (baseline 13 RED → GREEN), `shrinkToFitInline` 구 [잔존] 132, unit 6 · cargo 400, parity 1,210 PASS (기존 실패 2 유지), type-check 0. live (Playwright 격리 프로젝트, `getSharedLayoutMap`): flex row Frame 안 `width:auto` Text 82 / padded Text **102** (= 82 + 20, Chrome 102.4 · 종전 122), grid `auto 1fr` 안 padded Frame 70 · 내부 x 10.

## [ADR-206 Implemented — 엔진 늘어난 크기 definite 전파 + grid 암묵 트랙 준수] - 2026-09-07

### Changed

- ADR-206 을 Implemented 로 승격했습니다 (Phase 0~~3 / G0~~G5 당일 종결). 사용자-가시 변경은 아래 Phase 1 · Phase 2 엔트리 두 건이 전부이고, 이 엔트리는 종결 근거만 적습니다.
- 제품 수준 프레임 영향 확인: `pnpm perf:baseline -- --lane frame` 600 요소 — idle / pan / zoom / panel-resize 의 callback gap p95 17.5~17.8 ms, >25 ms 0 %, `render.frame` p95 ≤ 5.4 ms. 엔진 재-solve 추가 (stretch 소비자 재-solve · grid 셀 definite) 가 프레임을 밀지 않습니다. `tree_solve` bench depth 12 는 Phase 0 baseline 과 같습니다 (27,666 ns).
- 실제 빌더 exercise (Chrome MCP, 로컬 프로젝트): flex row 안 `height:100%` → `50%` 3단 전파 · 2열 grid 의 `span 3` 자식 제자리 (종전 y 100,000) · template 없는 grid 자식 폭 400 · ProgressBar Track 회귀 0.
- 남은 기록: Chrome 의 grid line 상한은 10,000,000 이고 엔진은 10,000 을 유지합니다 (의도된 편차). 내용 0 인 grid auto item 이 셀을 채우는 폴백은 LOW deferred (ADR-206 리뷰 round 1). 문서: ADR `docs/adr/completed/206-…md`, 규칙 ledger §백분율 · §25.

## [레이아웃 엔진 — grid 암묵 트랙 · 명시 grid 를 넘는 배치 (ADR-206 Phase 2)] - 2026-09-07

### Fixed

- grid 자식의 `grid-column` / `grid-row` 가 명시 트랙 수를 넘으면 (2열 grid 에 `span 3`, `grid-column-start: 4`, 1행 grid 에 `grid-row-start: 3`) 캔버스가 요소를 행 10,001 (y 100,000) 로 보내던 결함을 고쳤습니다. 이제 Preview/Chrome 처럼 그만큼 암묵 트랙이 생기고 (CSS-GRID-1 §7.6 · §8.5), 그 뒤 자동 배치는 넓어진 grid 를 씁니다. 자동 배치 자체는 종전대로 명시 열 한계를 지킵니다.
- `display: grid` 에 `grid-template-columns` 가 없으면 자식 폭이 100px 로 굳던 결함을 고쳤습니다 — 암묵 `auto` 열 1개가 컨테이너를 채웁니다 (정폭 400 → 400).
- `grid-auto-columns` / `grid-auto-rows` 목록이 첫 px 토큰만 읽히던 것을 순환 적용으로 고쳤습니다 (`1fr 2fr` → 133/267). `grid-auto-flow: column` 컨테이너의 높이가 0 이던 결함도 같이 (암묵 행이 flow 와 무관하게 섭니다).
- `grid-template-rows: repeat(2, 40px)` 같은 정수 반복이 auto 높이 grid 에서 행 하나로 접히던 결함을 고쳤습니다 (두 행 40/40). `grid-column-end: span 2` 만 준 자식이 span 을 잃던 결함도 같이.
- grid line 정수는 ±10,000 으로 clamp 합니다 (Chrome 은 10,000,000 — 실측, 의도된 편차: 백만 단위 암묵 트랙은 실사용 배치가 아니고 엔진 부담). 음수 라인은 명시 grid 끝에서 셉니다 (`-1` = 마지막 라인).
- **기존 문서 영향**: catalog 의 template 없는 grid 6 규칙 (Meter · ProgressBar · Slider 의 Track/Value · ProgressCircle) 은 canonical 자식이 없어 배치가 바뀌지 않습니다 (ADR-206 Phase 0 live 판정). 사용자가 grid Frame 에 열 수를 넘는 span 을 줬던 문서는 요소가 제자리로 돌아옵니다.
- 근거: Taffy 0.10→0.14 대조 §4 ② ④ (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md`). Chrome 차등 게이트 `tests/parity/gridImplicitTracks.browser.test.ts` (positive 11 · 대조군 4 · engine/pipeline 두 leg — baseline 9 × 2 RED → 30 GREEN), `shrinkToFitInline` 구 `[잔존] flow:column` 단언 0 → 20, grid unit 3 신규 · cargo 394 PASS · golden 28, parity 1,193 PASS (기존 실패 2 유지), `tree_solve` bench depth 12 27,666 ns (baseline 동일). 엔진 정합 규칙 ledger §25.

## [레이아웃 엔진 — 늘어난 크기가 `%` 높이의 기준이 된다 (ADR-206 Phase 1)] - 2026-09-07

### Fixed

- 부모가 늘려 준 크기 안의 `height: %` 자식이 캔버스에서 0 으로 접히던 결함을 고쳤습니다. `display: flex` (row, 높이 지정) 의 늘어난 item 안 `height: 50%` 는 Preview/Chrome 처럼 item 높이의 절반이 되고 (종전 0), 늘어난 item 이 다시 flex 컨테이너면 그 자식도 같이 늘어납니다. `flex-wrap: wrap` 의 여러 줄 · `min-height` 로 커진 컨테이너 · 세로 flex 의 `flex-grow` 로 커진 item · grid 칸 · `aspect-ratio` 로 파생된 높이도 같은 기준입니다 (CSS-FLEXBOX-1 §9.8 · CSS-GRID-1 §6.6 · CSS-SIZING-4 §5.2.2).
- 늘어난 item 에 `aspect-ratio` 만 있고 폭이 없으면 폭이 내용 크기로 남던 것을 늘어난 높이에서 파생하도록 고쳤습니다 (row 높이 200 안 `aspect-ratio: 1` → 200×200, Chrome 동일).
- **기존 문서 영향**: 로컬 프로젝트 인벤토리에서 `%` 높이 요소 0 / 269 (ADR-206 Phase 0) — 배치가 바뀌는 기존 문서는 없고, 앞으로 `%` 높이를 넣을 때 Preview 와 같은 결과를 냅니다.
- 근거: Taffy 0.10→0.14 대조 §4 ① (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md`). Chrome 차등 게이트 `tests/parity/percentSize.browser.test.ts` §ADR-206 (positive 12 baseline 전부 RED → GREEN, 대조군 9 GREEN 유지), `containerIntrinsic` K 잔존 Δ40 → 0, unit 7 · golden N11/N12, cargo 393 PASS, parity 1,164 PASS (기존 실패 2 유지), `tree_solve` bench depth 12 +1.5 %. grid 암묵 트랙 (② ④) 은 Phase 2.

## [레이아웃 엔진 — absolute 크기 min/max clamp · 빈 상자 aspect-ratio 높이] - 2026-09-07

### Fixed

- `position: absolute` 요소의 사용 크기가 `min-width`/`max-width`(세로축 동일)를 무시하던 결함을 고쳤습니다. 명시 `width: 300px` + `max-width: 100px` 은 캔버스에서 300 으로, 양측 inset 의 stretch 는 containing block 전체로 그려졌습니다 (Preview/Chrome 100). 이제 clamp 뒤 값이 사용 크기이고 `margin: auto` 는 그 값 기준으로 잉여를 나눕니다 (CSS §10.4/§10.7).
- 자식이 없는 block 요소에 `aspect-ratio` 만 주면 캔버스 높이가 0 이던 결함을 고쳤습니다. stretch 된 폭에서 높이를 파생합니다 (`width: 300` 컨테이너 안 `aspect-ratio: 2` → 300×150, Chrome 동일).
- 근거: Taffy 0.10→0.14 upstream 대조 (`docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md` §2 B4·B4c·B6). Chrome 차등 게이트 `tests/parity/absClampAspectLeaf.browser.test.ts` 12 케이스 (baseline 11 RED → 12 GREEN), cargo 421 PASS. 늘어난 flex item / grid area 의 `%` 높이 base (같은 문서 §4 ①) 는 별도 ADR 로 남깁니다.

## [실제 Builder Worker 적용 검증 후 철회] - 2026-09-07

- 실제 프로젝트에 Worker 소유 SkiaRenderer를 연결해 부트3쌍, 전체 화면 픽셀, 휠 입력6회씩을 비교했습니다. 메인 렌더 프레임 최대값은 약107→22ms로 감소했고 전체 화면 픽셀 차이는0이었습니다.
- 그러나 준비 완료는 각쌍에서100~~128ms 늦어졌고, 휠 입력→제출은 메인40.5~~46.1ms 대비 Worker60.9~77.6ms로 악화됐습니다. Worker 응답 계측은 flush 후 메인 수신까지 포함합니다.
- 사용자 유지 조건을 충족하지 못해 Worker 연결·전송 codec·runtime 주입·Worker 전용 폰트/환경 분리와 해당 테스트를 제거했습니다. 기존 main 렌더러, matching flush readiness, 폰트 파싱 최적화는 보존합니다. 초기 프로젝트 오픈 경고가 해결됐다는 판정은 하지 않습니다.

## [프로젝트 부트 후속 작업 계측과 닫힌 팔레트 행 생성 제거] - 2026-09-07

### Performance

- DB 완료 이후 문서 정규화·투영·store 발행을 개별 계측합니다. 작은 프로젝트에서 이 경로는 각1회/합계3.9ms였으며 DB 완료 경고의 대부분은 후속 React 작업이었습니다.
- 닫힌 CommandPalette에서 63개 행 JSX를 미리 만들던 `map`을 React Aria ListBox의 `items` 렌더링으로 변경했습니다. 기존 단축키·scope·열림/닫힘 수명은 유지합니다. 회귀 테스트에서 이전 코드의 닫힌 행 표시 계산63회와 수정 후0회를 확인했습니다.
- 전체 DB 완료 경고 해결이나 production 개선율을 주장하지 않습니다. 후속 `useLayoutPublisher`의 전체 레이아웃 계산이 같은 이벤트 구간에 포함되는 현상이 남았습니다.

## [Skia 폰트 이름 조회의 중복 파싱 제거] - 2026-09-07

### Performance

- 이미 생성한 Typeface의 내장 패밀리 이름을 직접 읽어, 이름 조회만을 위한 임시 `FontMgr.FromData` 재파싱을 제거했습니다. 동일 이름도 매핑에 저장해 추가 weight 로드에서 반복 조회하지 않습니다.
- FontMgr의 variable weight 선택과 Paragraph의 공유 FontCollection 경로는 유지합니다. provider 통합은 실제 700/900 글리프 폭 대조에서 차이가 확인돼 적용하지 않았습니다.
- 실제 프로젝트 부트와 관련 회귀 테스트를 검증했습니다. 전체 FontMgr 구축 및 단일 Paragraph layout의 긴 동기 호출은 남아 있으므로 프로젝트 오픈 경고의 완전한 해결은 아닙니다.

## [Skia WOFF2 반복 파싱 제거와 임시 최적화 철회] - 2026-09-07

### Performance

- CanvasKit 빌트인 폰트는 원본 Variable WOFF2를 압축 해제한 TTF를 사용합니다. variation·글리프·이름 테이블을 유지하고 브라우저 CSS는 WOFF2를 유지합니다. URL 검증을 통해 이전 WOFF2 IndexedDB 항목은 새 TTF로 교체됩니다.
- 동일 폰트 대조에서 Pretendard FontMgr 구축 531.1→1.0ms, 최초 Paragraph layout90.8→1.0ms를 관측했습니다. 작은 격리 실험 수치이며 전체 프로젝트 오픈 개선율이 아닙니다.
- 근본 비용을 줄이지 못했던 Picture 타이머 분할·전용 준비 경로를 제거했습니다. 기존 Picture 캐시, 측정 라벨, matching surface flush readiness는 유지합니다. 미커밋 Styles/단축키/팔레트 추정 최적화도 철회했습니다.
- 실제 부트에서 Paragraph max17.2ms, collection max1.0ms를 관측했지만 초기 content 기록/GPU flush를 포함한 RAF90.6ms는 남았습니다. 경고 전체 해결로 판정하지 않습니다. Worker는 제품에 추가하지 않았습니다.
- TTF 원시 크기는 두 파일 합계 약7.62MB로 WOFF2 합계2.41MB보다 큽니다. 첫 다운로드와 배포 HTTP 압축 비용은 별도 확인 대상입니다. 재생성: `scripts/prepare-skia-fonts.py`.

## [빌더 패널 접근성 — 토글 이름·트리 키보드·포커스 링·reduced motion] - 2026-09-07

### Added

- Styles 패널의 아이콘 전용 ToggleButton 33개에 접근 가능한 이름을 붙였습니다. Typography 15개(가로/세로 정렬·장식·글꼴 스타일·대소문자)와 Layout 18개(방향 3·9칸 정렬 그리드·주축 정렬 3·줄바꿈 3)이며 ko/en 라벨을 함께 추가했습니다. 그룹에만 이름이 있어 개별 옵션이 스크린리더에서 무명이던 상태를 해소합니다.
- Layers 가상화 트리(`VirtualizedTree`)에 키보드 탐색을 추가했습니다. ArrowUp/Down·Home/End 이동, ArrowRight 펼침, ArrowLeft 접기 및 부모 이동, Enter/Space 선택을 지원하며 선택 규칙은 클릭 경로와 같습니다. `focusedKey` 가 없을 때 모든 행의 `tabIndex` 가 -1 이라 Tab 으로 진입조차 못 하던 것도 roving tabindex 로 고쳤습니다.
- 전역 `prefers-reduced-motion` 대응을 추가했습니다. 빌더 CSS 43개 파일 중 3개만 개별 대응하던 것을 `utilities` 레이어의 규칙 하나가 덮습니다.

### Fixed

- Layers 트리의 가상화 전환 조건이 루트 배열 길이를 세어 단일 `body` 루트 문서에서는 값이 늘 1 이었습니다. 요소를 아무리 늘려도 가상화가 열리지 않아(행 18개에서도 비가상 트리) 전체 노드 수 기준으로 정정했습니다.
- `outline: none` 뒤에 포커스 표시가 없던 곳을 정리했습니다. 대체 스타일이 있던 12곳은 `:focus-visible` 로 전환하고, 대체가 없던 6곳(필터·검색·스냅숏 이름·줌 입력·인스펙터 입력)에는 포커스 링을 넣었습니다.

## [Builder 외부 레퍼런스 우선순위 1–5] - 2026-09-07

- IndexedDB v21에서 변경된 canonical 노드만 저장하고 transaction 완료 후 성공 처리한다. 구 문서 전환·급감 가드·백업·복원 계약을 유지한다. 큰 저장 준비에는 transaction 밖의 task yield를 적용했다.
- 카메라만 바뀌면 콘텐츠 준비를 재사용한다. 이미지 캐시는 RGBA 추정 128 MiB 예산을 적용하며 살아 있는 참조는 보호한다.
- Monitor의 FID를 Google web-vitals INP로 교체하고 INP/LoAF·환경 정보를 로컬 JSON으로 내보낸다.
- production 3쌍에서 edit CPU 중앙값 219.013→189.546ms/s(-13.45%). pan -0.77%, zoom +0.15%로 zoom CPU 개선은 확인하지 못했다. [구현·수치·저장 버전 호환성·한계](migrations/builder-performance-priorities-20260907.md).

## [줌 표시의 React 갱신 제거] - 2026-09-07

- 연속 줌에서 숫자 표시만 직접 갱신해 불필요한 React 렌더를 제거했다. 직접 입력은 유지하고 Escape 취소와 Enter 단일 확정을 검증했다.
- 120회 입력 진단의 ZoomControls 실행 99→0회. 별도 production 3쌍 CPU 중앙값 291.094→271.559ms/s(-6.71%), p95 10.4→10.5ms, p99 17.7→16.8ms. [전후 비교·한계](adr/evidence/frame-performance-reference-zoom-20260907.md).

## [React 진단 집계 정정] - 2026-09-06

- 잔존 actualDuration을 실행 횟수로 세던 진단을 정정했다. dirty 구독 제거의 Canvas 실행은 22→11회이며 DataTablePanel은 편집 중 0회였다. 기존 fiber self 집계는 철회하고 별도 production CPU/frame 값은 유지한다. [정정 증거](adr/evidence/frame-performance-reference-profile-audit-20260906.md).

## [Canvas 미사용 dirty Set 구독 제거] - 2026-09-06

- Canvas가 읽지 않는 dirty Set 구독과 renderer 전달을 제거해 Set 정리 시 불필요한 React 갱신을 줄인다. 기존 레이아웃 무효화와 실제 제출 계약은 유지한다.
- 10회 편집 진단에서 Canvas render 22→11회(기존 33→11은 bailout 포함 집계로 정정). 별도 production 3쌍 CPU 중앙값 227.579→225.727ms/s(-0.81%), p95 동일. [진단·측정·한계](adr/evidence/frame-performance-reference-dirty-20260906.md).

## [Layout publisher 서명 재사용] - 2026-09-06

- 동일 page/frame 입력의 재렌더에서 레이아웃 서명을 재사용한다. 입력 교체·layout revision·WASM ready 전환의 발행은 유지한다.
- production 3쌍 CPU 중앙값 239.748→237.404ms/s(-0.98%), p95 동일. 한 쌍 CPU 증가를 포함한 제한적 결과다. [검증과 한계](adr/evidence/frame-performance-reference-publisher-20260906.md).

## [Projection 중복 직렬화 재사용] - 2026-09-06

- 같은 scene 서명 계산에서 공유 props/배열의 중복 직렬화를 재사용한다. 호출이 끝나면 캐시를 버려 후속 내부 편집을 계속 감지한다.
- 현재 구현 대비 production 3쌍의 edit CPU 중앙값 238.904→236.226ms/s(-1.12%), frame p95 동일. [측정·검증·한계](adr/evidence/frame-performance-reference-projection-20260906.md).

## [편집 시 레이아웃 서명 계산 축소] - 2026-09-06

- 레이아웃 변경 감지 시 값이 없는 속성의 반복 문자열 할당을 줄였다. 같은 객체 내부 편집·삭제와 실제 렌더 제출/Undo 동작은 유지한다.
- 일반 production 3쌍에서 edit CPU 중앙값 241.085→234.604ms/s(-2.69%), frame p95 동일. 첫 쌍은 악화돼 장비·반복 변동성을 포함한 제한적 결과로 기록한다. [측정과 검증](adr/evidence/frame-performance-reference-edit-20260906.md).

## [CanvasKit 레퍼런스 기반 프레임 예약] - 2026-09-06

- CanvasKit 공식 가이드의 이벤트 기반 RAF를 적용해 화면 변경이 없는 동안 Skia 렌더 callback을 중지한다. 카메라·드래그·hover·리소스·cleanup·복구가 단일 pending RAF를 깨우며 animation의 종료 프레임을 보존한다.
- 현재 P1 대비 production 교차 3쌍에서 idle renderer RAF 1,202→0회/10초, main-thread task CPU 24.334→20.390ms/s(-16.209%). Chrome trace와 전체 frame interval을 함께 비교했으며 이 장비의 상대 효과로 한정한다.
- 기존 retained content/overlay와 실제 matching submission readiness를 유지한다. GPU tail의 과거 실패는 해결로 바꾸지 않고, 상세 검증 및 한계는 [레퍼런스 적용 증거](adr/evidence/frame-performance-reference-scheduler-20260906.md)에 기록한다.

## [프레임 성능 재검증·계측 경계 수리] - 2026-09-06

### Fixed

- GPU 측정 창을 초기화한 뒤 context loss가 발생하면 이전 창의 query를 새 창의 invalid에 더해 `started=0, invalid=1`이 되던 문제를 수정했습니다. 해당 순서를 회귀 테스트로 고정했습니다.
- 실제 복원 검증 하니스가 clear와 main 제출 계수 분리 이후에도 2회 제출을 요구해 timeout이 나던 문제를 수정했습니다. 복원 요청 직전보다 새 실제 main flush가 증가했는지를 확인합니다.

### Performance

- 동일 소스 3개 대조 빌드 × GPU 계측 off/on을 각 5회 비교했습니다. 600요소에서 GPU off renderer main-thread task CPU는 31.376→20.639ms/s로 34.2% 감소했습니다. Map 재사용만의 감소는 25.4%, Map을 유지한 준비 생략의 추가 감소는 11.8%입니다. capture/perfMarks/recorder 비용은 포함하며, 이전 원본 artifact의 36.0%와 구분합니다.
- pan/zoom 지연과 GPU 예산은 통과했지만, 10초 edit GPU p95는 0.327→0.944ms(+0.617ms)로 +0.5ms 예산을 넘었습니다. 동일 입력의 30초 추가 5쌍은 0.309→0.471ms(+0.161ms)였으나 원래 실패를 덮지 않고 전체 G5/설계 완료를 보류합니다. on-demand RAF도 저사양 재개 근거 미확보로 계속 보류합니다.
- [재검증 근거·각 run·범위와 한계](adr/evidence/frame-performance-remeasurement-20260906.md). 부팅 시 공통 Pretendard 정적 폰트 404는 별도 잔여로 기록했습니다.

## [패널 탭 전환 수리] - 2026-09-06

### Fixed

- 패널 탭을 바꿔도 이전 탭의 본문이 사라지지 않고 화면에 남아 두 탭이 겹쳐 보이던 문제를 수정했습니다. Navigator 의 Pages/Frames 가 함께 보였고, Styles·DataTable·Monitor 도 같은 원인이었습니다. `.panel-contents` 의 스크롤 힌트가 scroll-progress timeline 애니메이션이라 끝나지 않는데, React Aria Components 1.21+ 의 `TabPanel` 이 그 종료를 기다려 unmount 를 미룬 것이 원인입니다. 전환 중에만 힌트를 끄도록 했고, 정착한 패널의 스크롤 페이드는 그대로입니다.

## [Builder 반복 구현 공통화] - 2026-09-06

### Changed

- 8개 컴포넌트의 template origin 수집·재배치·멱등 처리, flex/block의 `margin:auto` 해석, 패널 layout 복사, canonical 문서 저장, Layout/TextMetrics 편집 취소 생명주기, Canvas page projection 타입을 공통화했습니다.
- 컴포넌트별 origin 보정, 사용자 responsive 설정, Undo/삭제 저장 옵션, Inspector 추가 저장, 편집 취소 후 재진입 정책은 유지합니다. 동작 변경과 성능 개선을 목적으로 한 변경은 아닙니다.

## [프레임 계측 정확성 수리] - 2026-09-06

### Fixed

- 프레임 계측의 GPU 타이머가 EXT_disjoint_timer_query 플래그를 결과 준비 전에 조회해 유효 표본까지 버리던 문제를 수정했습니다. GPU throttling 구간에서 유효 표본이 0으로 무너지던 원인이며, 이 수정 이전에 수집한 GPU 지표는 재수집 대상입니다.
- 측정 창을 초기화해도 이전 창의 readiness 기록과 gauge가 남아 새 창의 값으로 보고되던 문제를 수정했습니다.

## [Builder 프레임 CPU 준비 재사용] - 2026-09-06

### Performance

- 동일 입력의 children Map을 renderer 수명 안에서 재사용하고, 유효한 retained frame의 settled idle에서는 content/plan 준비를 생략합니다. animation·resource·camera·readiness 변경은 기존 제출 경로로 처리하며 연속 RAF는 유지합니다.
- 600요소 production 5쌍에서 renderer main-thread task CPU 중앙값이 32.96→21.09ms/s로 36.0% 감소했습니다. 이 값은 P1 변경 묶음 전체의 효과이며 준비 생략 단독 효과가 아닙니다. 입력 위상을 맞춘 pan/zoom 제출 지연은 회귀 예산 안입니다. 5,000요소 편집·zoom tail과 실제 저사양 검증은 남아 있으며, on-demand RAF는 조건부 보류합니다.
- **2026-09-06 정정**: 앞서 기록한 33.47→19.65ms/s(41.3%)와 GPU p95 판정은 철회했습니다. 계측 opt-in이 출하 production에는 없는 GPU 타이머를 만들고 그 동기 GL 조회가 측정 구간 안에서 실행되어, 출하 경로가 아닌 빌드를 잰 값이었습니다. 위 수치는 GPU 조회가 없는 경로에서 다시 잰 것이고, GPU 지표는 타이머 결함 수정 후 재수집 대상입니다.
- 근거·적용 범위: [프레임 성능 실행 설계 §9](adr/react-skia-zustand-frame-performance-design.md#9-실행-결과--2026-09-06).

### Fixed

- production에서 composition engine의 동적 JS import가 404를 내며 Builder 부팅이 95%에 머무는 문제를 수정했습니다. Vite가 JS/WASM 경로를 번들링하도록 연결하고, matching document의 실제 Skia 제출 이후에만 ready가 되는 계약을 유지합니다.

## [Navigator 선택 fan-out 제거 — ADR-203 Implemented] - 2026-09-06

### Performance

- **ADR-203 Implemented — LayerTree 창 렌더와 Properties 필드 구독**:
  - Navigator에서 요소를 고를 때 문서 크기만큼 트리가 다시 그려지던 비용을 가시 행만 그리도록 바꿨습니다. 600요소 선택 p50은 약 240ms에서 16.6ms로 줄었고 longtask는 0입니다.
  - **Why:** 가상화 분기가 root 개수(실문서는 body 1개)를 보고 한 번도 켜지지 않았고, RAC Tree는 선택마다 전체 행을 재렌더했습니다. 앱 행 memo로는 닿지 않아 LayerTree만 RAC `Virtualizer` + `ListLayout`으로 창을 그립니다.
  - Properties는 선택 객체 전체가 아니라 id/type과 각 필드의 canonical 값만 구독합니다. 5k에서 G6가 켜져 Phase 4를 실행했습니다.
  - persistent 5k headless p50 16.0/16.2/16.2ms, headed 8.2ms. 실제 Canvas pointer로 `perf-seed-1` 선택이 맞았습니다. p95·할당 tail은 남아 있어 제거 완료로 읽지 않습니다.
  - 위치: `apps/builder/src/builder/panels/navigator/`, `apps/builder/src/builder/panels/properties/`
  - Live Exercise: ADR 본문 `### Live Exercise` — Chrome 키보드/DnD/숨김복원, headed Playwright pointer.

## [헤더 Compare·Preview 그룹 통합] - 2026-09-06

### Changed

- 헤더 오른쪽의 Compare와 Preview를 서로 다른 chrome island에서 하나의 보기 옵션 그룹으로 합쳤습니다. Compare는 토글, Preview는 실행 버튼으로 역할은 그대로입니다.

## [Navigator 선택 성능 — ADR-203 Phase 1 스파이크] - 2026-09-05

### Performance

- ActionButton도 동일 item 참조에서 memo 처리했다. 50회 선택 실측 subtree 시간이 44.5→26.2ms로 줄었으며, 같은 action ID의 새 라벨·callback은 반영한다.
- Action Bar 옵션 메뉴의 placement callback을 안정화하고 memo를 적용했다. 50회 선택 실측에서 OptionsMenu 렌더가 100→1회, Action Bar React 누적 시간이 117.0→81.3ms로 줄었다. registry 갱신 후 모델 반영 순서는 유지한다. [근거](adr/evidence/203-actionbar-rac-analysis.md).
- 일반 LayerTree 행에 소비하는 선택·확장·focus 값만 전달하고 content를 memo 처리했다. 20개 가시 행/50회 선택의 개발 환경 실측에서 Navigator React 누적 시간이 524.1→376.9ms로 약 28% 감소했다. [전후 근거](adr/evidence/203-selection-residual-analysis.md).
- LayerTree에만 RAC Virtualizer를 연결하고 행 높이·단일 스크롤 계약을 검증했다. 600 요소 개발 환경 선택 p50 226.3→16.6ms, longtask 12→0. 공용 TreeBase·Pages·Frames는 유지한다.
- **검증 진행 중**: 600 요소 반복 3회는 p50·drop·longtask 조건을 통과했다. 60 요소는 drop 3.8/3.3/2.7%로 필수 0%를 모두 미달해 Phase 1과 ADR은 아직 완료하지 않았다. [반복 실측과 parity](adr/evidence/203-g1-revalidation.md).

### Fixed

- LayerTree에서 항목을 다른 컨테이너 안으로 옮긴 뒤 포커스가 이동 항목 대신 대상 컨테이너에 남던 문제를 고쳤다. 재부모화 DOM이 반영된 다음 frame에 이동 행 포커스를 재요청하며, 같은 행을 연속 이동해도 요청이 생략되지 않는다.

## [캔버스 accent 색 정정 · Aria Label 편집 축] - 2026-09-05

### Fixed

- **기본 상태에서 캔버스의 accent 색이 Preview 와 달랐습니다**: 강조색 버튼 등이 캔버스에서만 다른 파랑(#155dfc)으로 그려지고 Preview 는 테마 파랑(#3660f0)이었습니다. 테마 선택값에서 캔버스 색을 파생하는 동기화가 **저장된 테마 설정이 있을 때만** 돌아서, 테마를 한 번도 바꾸지 않은 프로젝트가 전부 어긋나 있었습니다. 이제 기본값에서도 파생이 적용됩니다.
  - 색을 직접 지정한 요소는 영향이 없습니다. 테마 강조색을 쓰는 요소만 Preview 와 같아집니다.

### Added

- **Aria Label 편집 축**: Properties 패널 Attributes 에 `Aria Label` 을 추가했습니다. ID·Class Name 과 같은 전 타입 공통 축이라 어떤 요소에나 지정할 수 있고, 지정하면 Preview·퍼블리시 DOM 에 그대로 실립니다.
  - 필요했던 이유: 진행률 표시처럼 **읽어 줄 이름이 필수인** 컴포넌트를 빌더에서 만들면 이름을 넣을 수단이 없었습니다.
  - 비워 두면 속성을 만들지 않습니다. 컴포넌트가 스스로 이름을 만드는 경우(예: 라벨 자식이 있는 필드)는 그쪽이 우선입니다.

## [폰트 크기가 캔버스에 반영되고, 상속된 자간도 이어집니다] - 2026-09-05

### Fixed

- **폰트 크기를 바꿔도 캔버스 글자 크기가 그대로이던 것**: Styles 패널에서 Font Size 를 조절하면 Preview 는 바뀌는데 캔버스는 16px 에 머물렀습니다. 캔버스 쪽 해석기가 숫자와 디자인 토큰만 받아들여, 패널이 저장하는 `"23px"` 같은 **px 문자열을 통째로 버리고** 기본값으로 떨어뜨리고 있었습니다. 기본 크기가 마침 그 기본값(16)이라 기본 상태에서는 증상이 없었고, 크기를 바꿀 때만 갈렸습니다.
  - 실제 빌더 확인: 저장 `"23px"` → 캔버스 16 / Preview 23px → 수리 후 양쪽 23.
  - `em`·`rem`·`%` 같은 상대 단위는 이전과 같이 무시합니다 — 해석 지점이 부모 폰트 크기를 알지 못하며, 레이아웃 경로도 같은 이유로 받지 않습니다.
- **부모에서 상속된 letter-spacing 이 캔버스 그리기에 빠지던 것**: 앞선 항목이 남긴 한계를 해소했습니다. 부모에 자간을 주고 자식 텍스트에는 주지 않은 경우, 이제 캔버스도 Preview 와 같은 위치에서 줄을 접습니다. 아무도 자간을 지정하지 않은 요소는 예전처럼 컴포넌트 기본값을 그대로 씁니다.

### Changed

- **레이아웃의 폰트 크기 해석 21곳이 한 규칙을 씁니다**: 지점마다 흩어져 있던 파싱을 하나로 모았습니다. 각 지점의 기본값 우선순위(컴포넌트 기본 / 디자인 토큰 / 고정값)는 그대로라 보이는 결과는 바뀌지 않습니다.
- **자간 시각 파리티 케이스의 글꼴**: 시스템 글꼴로 바꿨습니다. 두 비교 대상이 서로 다른 글꼴 집합을 보고 있어 케이스가 자간이 아닌 것을 재고 있었습니다.

## [Styles 패널의 letter-spacing 이 캔버스에도 반영됩니다] - 2026-09-05

### Fixed

- **letter-spacing 이 Preview 에만 반영되던 것**: Styles 패널 Typography 에서 자간을 조절하면 Preview 는 바뀌는데 캔버스는 그대로였습니다. 값이 Skia 텍스트 노드까지 가는 경로가 없었고, 줄 수를 만드는 레이아웃 측정 경로도 자간을 받지 않았습니다. 세 자리를 모두 이었습니다 — 캔버스 글자 간격과 **줄바꿈 위치**가 Preview 와 같아집니다.
  - 영향 범위: 사용자가 자간을 직접 설정한 요소만 바뀝니다. 기본값·가져오기·테마 어디에도 자간을 넣는 곳이 없어(각 0건), 설정하지 않은 문서는 보이는 결과가 그대로입니다.
  - 부모에서 **상속된** 자간은 아직 캔버스 그리기에 반영되지 않습니다 (레이아웃만 반영). 알려진 미지원이며 후속 작업입니다.
  - 앞선 항목([letter-spacing 을 Canvas 2D 가…])의 "아직 결선되어 있지 않습니다" 한계를 이 변경이 해소합니다.

### Added

- **텍스트 시각 축 게이트**: 새 텍스트 CSS 속성이 Preview 에만 반영되고 캔버스에는 빠지는 일이 커밋 시점에 잡힙니다. 속성 목록을 손으로 적지 않고 코드에서 뽑아 두 소비자에 값이 실제로 실리는지까지 확인합니다 (`codex:preflight` · push 직전 · CI).
- **자간 시각 파리티 케이스**: 캔버스와 Preview 가 같은 문단을 같은 줄 수로 접는지 보는 케이스를 추가했습니다. 결선이 끊기면 이 케이스가 먼저 깨집니다.

## [letter-spacing 을 Canvas 2D 가 CSS 와 같은 규칙으로 잽니다] - 2026-09-05

### Fixed

- **letter-spacing 폭 공식**: CanvasKit 초기화 전에 쓰이는 기본 측정기가 `글자수 − 1` 로 간격을 세고 있었습니다. CSS 는 글자마다 (마지막 글자 뒤까지) 간격을 넣으므로 항상 한 칸 좁았고, 이모지 같은 서로게이트 페어를 2글자로 셌습니다. Chrome 실측 규칙으로 고쳤습니다.

### Changed

- **letter-spacing 측정 경로**: 값이 0이 아니면 CanvasKit 으로 우회하던 것을, 브라우저가 `ctx.letterSpacing` 을 지원하면 Canvas 2D 에서 직접 재도록 했습니다 (미지원 브라우저는 종전대로 우회). 폭 캐시는 letter-spacing 별로 분리됩니다.
- 알려진 한계: 인라인 스타일의 letter-spacing 은 아직 Canvas(Skia) 렌더까지 결선되어 있지 않습니다 — Preview/CSS 에만 반영됩니다. 이번 변경은 측정 쪽 준비이며 사용자-가시 동작 변화는 없습니다. 근거·경로: [docs/adr/evidence/051-letterspacing-canvas2d.md](adr/evidence/051-letterspacing-canvas2d.md)

## [엔진 입력·문서가 조용히 어긋나던 자리에 게이트를 세웠습니다] - 2026-09-05

### Added

- **wasm 입력 strict 모드**: 레이아웃 엔진은 자기가 모르는 스타일 키를 조용히 버립니다. 그 차이가 위치 어긋남으로만 나타나 엔진 결함으로 오판된 이력이 있어, 하니스에서 켜면 그 자리에서 실패하도록 했습니다. production 은 그대로 관대합니다 (미지 키 하나로 레이아웃 전체가 실패하면 안 됩니다).
  - 켠 첫 실행이 인벤토리였습니다 — 파이프라인이 보내고 엔진이 버리는 키는 `whiteSpace` 와 `order` 둘뿐이고, 둘 다 TS 가 소유해 엔진이 안 읽어도 결과가 맞습니다 (사유와 함께 통과 목록에 등재).
  - 위치: `packages/composition-engine/src/{tree,wasm}.rs`, `canvas/wasm-bindings/{layoutBridge,compositionEngine}.ts`
- **정적 게이트 2개**: 삭제된 의존성 이름 (Taffy) 의 현재형 서술 재유입 차단 · `CSS_SUPPORT_MATRIX.md` 엔진 절과 코드의 drift 검사 (`codex:preflight` 에 추가).

### Fixed

- **엔진 필드 수 상수 드리프트**: `NODESTYLE_FIELD_COUNT` 가 54 인데 구조체는 55 필드였습니다. 필드를 더한 커밋이 상수를 안 올렸고, 검사 단언이 상수끼리만 비교해 통과하고 있었습니다. 이제 serde 가 실제로 쓰는 키 집합과 기계 대조합니다.

### Changed

- **삭제된 레이아웃 엔진 이름 정리**: ADR-916 에서 제거된 Taffy 가 소스 35 파일 주석에 현재형으로 남아 없는 라이브러리의 능력이 엔진 제약처럼 읽히고 있었습니다. 현재형 서술만 바꾸고 제거·개명·계보를 밝힌 역사 서술은 남겼습니다.
- **`docs/CSS_SUPPORT_MATRIX.md`**: 2026-04-06 에 멈춘 채 삭제된 파일을 71곳에서 인용하고 있었습니다. 엔진 capability 절 (§0) 은 이제 코드가 생성하고, 손 편집 본문은 스냅샷임을 머리말에 밝혔습니다.

### Tests

- Rust 417건 · builder `canvas/layout` 482건 · parity 1056건 통과 (parity 의 기존 실패 13 파일 + 2건은 이번 변경과 무관 — baseline 대조로 확인).
- 근거: [docs/adr/evidence/external-pattern-delta-group-a.md](adr/evidence/external-pattern-delta-group-a.md) — 게이트 RED probe · strict 첫 run 인벤토리 · baseline 대조.

## [텍스트 줄바꿈이 브라우저와 어긋나던 10가지를 고쳤습니다] - 2026-09-05

### Fixed

- **Canvas 2D 텍스트 측정 (Tier 3) 이 Chrome 과 다르게 끊던 위치 10종**: 캔버스에서만 단어가 잘못 쪼개지거나 구두점이 줄 끝에 홀로 남던 문제입니다.
  - `$100` 의 `$` 가 앞 줄 끝에 남던 것 → 숫자에 붙습니다. `50%` 의 `%` 도 앞 숫자에 붙습니다.
  - 여는 괄호·따옴표·아포스트로피 (`(` `"` `'` `「` `（`) 가 줄 끝에 홀로 남던 것 → 다음 줄로 함께 넘어갑니다. CJK 여는 괄호 규칙은 조건 오류로 실제로는 한 번도 동작하지 않는 상태였습니다.
  - 이메일·파일 경로·URL·식별자 (`support@example.com`, `foo_bar/baz_qux`, `https://…`) 가 기호에서 쪼개지던 것 → 브라우저처럼 한 단위로 둡니다. 하이픈 뒤는 그대로 끊깁니다 (전화번호 유지).
  - `word-break: keep-all` 에서 `한글abc123` · `価格1200円` 처럼 공백 없이 붙은 CJK 혼합 그룹이 쪼개지던 것 → 한 단위로 둡니다.
  - 줄 폭 계산에서 구두점·기호가 공백처럼 취급돼 폭이 과소 측정되던 것 → 공백만 줄 끝에서 흘리고 기호는 폭에 포함합니다. `Save / Cancel` 류의 fit-content 폭과 줄 수가 맞아집니다.
  - 위치: `apps/builder/src/builder/workspace/canvas/utils/canvas2dSegmentCache.ts`

### Tests

- Chrome 152 오라클 기대값 18 케이스를 `tokenize()` 실경로 fixture 로 고정했습니다 (수정 전 13 FAIL → 18 GREEN). 손으로 만든 fixture 가 동작하지 않는 규칙을 가리고 있던 기존 테스트 2건도 실경로로 교체했습니다.
- 근거: [docs/adr/evidence/051-tier3-upstream-rules-live.md](adr/evidence/051-tier3-upstream-rules-live.md) — 원복 RED 표 · 회귀 538건 · 빌더 Skia ↔ Chrome DOM 줄 위치 대조.

## [React Aria Components 1.21 — ColorArea 패치 재적용] - 2026-09-05

### Changed

- **RAC 1.20.0 → 1.21.0 묶음 업데이트**:
  - `react-aria-components` catalog pin `^1.21.0`, `react-aria` 3.52.0, `react-stately` 3.50.0, `@internationalized/date` 3.12.4 / `number` 3.6.8
  - ColorArea `aria-hidden` 가드는 upstream에 아직 없어 `patches/react-aria@3.52.0.patch`로 같은 `isActiveInput` 가드를 다시 맞췄다. 이전 `react-aria@3.51.0` 패치는 제거했다.
  - 1.21의 TokenField `caretPosition` → `selectedRange` 변경은 사용처가 없다. Menu async loading / NavigationTree는 catalog에 넣지 않았다.
  - 위치: `pnpm-workspace.yaml`, `apps/builder/package.json`, `packages/shared/package.json`, `patches/react-aria@3.52.0.patch`

### Tests

- ColorArea 포커스 전환 회귀 테스트와 shared 972건, Fill/Color 훅 테스트, publish 테스트를 1.21에서 다시 통과시켰다.

## [Builder lint 경계를 정리했습니다] - 2026-09-04

### Changed

- Fast Refresh 경고를 없애기 위해 Context·panel helper·style props·Preview registry와 순수 presentation helper를 컴포넌트 모듈에서 분리했습니다. 기존 import·정적 parity 계약은 유지합니다.

### Fixed

- locale callback 의존성, drag/viewport 이벤트 수명주기, Ruler label pool cleanup의 stale closure 경고를 수정했습니다. P2 검토가 필요한 8개 경고(clipboard·shortcut registry·일부 memo dependency)는 동작 계약 확인 후 별도 처리 대상으로 남겼습니다.

### Tests

- Builder lint가 `0 errors / 8 review warnings`로 통과하고, type-check·registration·agent-catalog preflight와 관련 focused Vitest가 통과했습니다.
- (2026-09-05 후속 4) 정적 소스 게이트 3종을 현재 코드에 맞췄습니다. 세 게이트가 지키려던 불변식은 모두 코드에 그대로 있고, 매처가 붙잡고 있던 문자열만 리팩터로 이름이 바뀌어 있었습니다. selection 게이트는 식별자 금지 대신 canonical 우선 순서를 잠그도록 다시 썼고, ADR-113 격리 게이트는 뒤늦게 생긴 canonical 경계 파일 2개를 허용 목록에 넣었으며, commit lane 순서 게이트는 개명된 canonical sync 호출을 가리키도록 고쳤습니다. 빌더 전체 스위트가 5,294건 전부 통과합니다.
- (2026-09-05 후속 3) instance 편집 계약 테스트 13건을 canonical 실제 형태에 맞췄습니다. detach 와 origin 해제는 legacy mirror 필드를 `undefined` 로 남기지 않고 아예 제거하며, ref 인스턴스의 override 와 slot 배치를 실제로 운반하는 곳은 `props` 입니다. 동작은 모두 정상이고 낡아 있던 것은 단언 형태였습니다. 확인 다이얼로그 리스너가 없는 테스트에서 `window.confirm` 폴백이 jsdom 에서 취소로 읽히던 것도 함께 고쳤습니다. 빌더 전체 스위트 실패가 16 에서 3 으로 줄었고 남은 3건은 정적 소스 게이트입니다.
- (2026-09-05 후속 2) 패널 테스트가 canonical document 를 시드하도록 공용 헬퍼 `src/builder/__tests__/panelFixture.ts` 로 통일하고, `PanelContents` 도입 (2026-09-04) 이 남긴 잔여를 닫았습니다. 배럴 전체를 교체하던 AIPanel·SettingsPanel 의 mock 은 실물을 깔고 필요한 것만 덮도록 바꿔 새 export 추가 때 다시 깨지지 않게 했고, TabPanel 본문 층을 검사하던 정적 게이트 3종은 `panelContents()` 헬퍼 경유를 정본으로 인정하도록 갱신했습니다. 빌더 전체 스위트 실패가 99 에서 16 으로 줄었습니다.
- (2026-09-05 후속) memo dependency 경고 3건을 닫았습니다 — `PropertyUnitInput` sync effect 는 memo 된 `parsed` 를 그대로 의존하고, `useColorStyleValues` 의 `themeVersion` 은 tint/neutral 이 `lightColors` 를 제자리 mutation 하는 유일한 재계산 신호라 제거하지 않고 cache key 로 명시했으며, `ApiEndpointEditor` 의 `t` 는 `useCallback` 으로 고정했습니다. Styles 패널 color 테스트 fixture 를 canonical document 시드로 고쳐 16건 실패를 복구했고 tint 변경 재해석·부모 재렌더 draft 보존 테스트를 추가했습니다. 남은 경고 5건(clipboard 2·keyboard registry 3)은 계약 설계 후 별도 처리합니다.

## [Legacy layout/history 경계를 canonical-only로 줄였습니다] - 2026-09-04

### Changed

- Builder 전역의 deprecated `layout.types.ts`를 제거했습니다. canonical adapter의 reusable frame 입력은 필요한 필드만 가진 `ReusableFrameLayoutInput`으로 축소하고, reusable frame 생성·수정과 UI 읽기는 `FrameNode` 기반 계약만 사용합니다.
- 개발 단계에서 생성된 history IndexedDB v1 snapshot payload 변환을 중단했습니다. DB v4로 직접 올라오는 v1 history entry/meta만 초기화하며, v2/v3 canonical history와 v3 snapshot 및 프로젝트 문서는 보존합니다. 저장·복원 경계는 element history에 `canonicalEvents`가 없는 entry를 받지 않습니다.
- AI read model, frame read, collection item 관리, Layout preset, history result의 aggregate document projection caller를 ADR-127 traversal lookup과 leaf projection으로 전환했습니다. `getCanonicalDocumentElementsView`/`visitCanonicalDocumentElements`는 외부 export가 아니며, 남은 full projection cache도 사용되지 않는 `byId` Map 없이 readonly 배열만 보관합니다.
- Properties·Frames·LayerTree·Canvas와 element loader/selection/text/reset mutation 경로의 legacy `Element[]` fallback을 제거했습니다. matching canonical document 전에는 Canvas가 빈 scene을 유지하고 Builder chrome readiness가 노출을 막으며, frame body/slot은 canonical frame scope만 읽습니다.
- production caller가 0인 Canvas legacy scene projection 파일과 frame hydration loader API, legacy property read index를 제거했습니다. page-frame binding은 canonical page lookup과 bootstrap body 한 건만 사용합니다.

### Fixed

- Builder bootstrap readiness가 false일 때 effect 안에서 동기 state reset을 일으키던 경로를 제거했습니다. paint 완료 상태를 project와 canonical document revision으로 식별해 새 target은 자동으로 미완료가 되며, matching renderer frame이 준비된 뒤의 paint 완료 계약을 유지합니다.

### Performance

- history load/upgrade 시 legacy payload를 순회·변환하는 adapter 비용을 제거했고, bootstrap effect의 불필요한 연쇄 render를 없앴습니다.
- 같은 document를 반복 평탄화하던 5개 caller와 selection/page/frame hot path의 stale legacy subscription을 제거했습니다. 이 wave에서는 별도 성능 측정을 실행하지 않았습니다.

### Tests

- canonical projection·selection 즉시성·ref descendants·page/frame scope·preset removal·history result 회귀 32개 파일 339개 테스트와 Builder type-check를 통과했습니다.
- 격리 Chromium에서 production module singleton으로 canonical update의 Undo/Redo·go-to-index, IndexedDB `canonicalEvents`-only 저장, user/system snapshot 복원과 복원 Undo/Redo를 실제 실행했습니다. console error/warning은 0건이었습니다.

## [제약 flex 안의 collection 이 Preview 와 같은 높이를 지킵니다 (ADR-204)] - 2026-09-04

### Fixed

- **가상화 collection 의 min-content floor (ADR-204 Implemented)**: 높이가 제한된 flex column 안에서 `overflow: visible`/`clip` 인 ListBox·GridList 가 Canvas 에서만 부모 높이로 줄어들던 문제를 고쳤습니다. Preview 는 행이 실제 자식이라 CSS §4.5 자동 최소 크기 (행 수 × 행 높이) 를 지키는데, Canvas 는 행을 투영으로 그려 레이아웃 자식이 없고 엔진도 주축이 definite 인 item 에는 floor 를 두지 않았습니다.
  - 엔진 `flex.rs` 에 §4.5 specified size suggestion 절 (`min(specified, content)`, 정확 스칼라를 가진 definite item 만) 을 두고, column definite 컨테이너는 자식 extent 를, 가상화 collection 은 `contentMinHeight` (행 수 × stride) 를 공급합니다. 같은 절이 collection 밖 일반 상자 (자식 실재, definite 높이) 의 발산도 닫습니다.
  - **Table**: Canvas 만 `minHeight: 402` 를 주입해 제약 flex 에서 줄어들지 않던 것을 제거했습니다. DOM 외곽 `.react-aria-Table` 은 catalog `min-height: 40px` 이라 같이 줄어듭니다 (Canvas 402 → 80).
  - **GridList**: Canvas 만 `overflow: hidden` 을 주입해 scroll container 로 판정되던 것을 제거했습니다. GridList.css 에 overflow 선언이 없어 Preview 는 non-scrollable 이고 min-content 164 를 지킵니다 (Canvas 80 → 164).
  - 위치: `packages/composition-engine/src/flex.rs` · `tree.rs` · `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` · `implicitStyles.ts`. 게이트: `adr204ReachMatrix.browser.test.ts` (production 24 행 Chrome ≤1px) · `adr204MinContentFloorFirstNail.browser.test.ts`. 이연: row 축 definite 컨테이너 (ADR-188 방문 수 기준선과 충돌 — 사용자 판정 대기).

## [요소 편집과 선택·스타일 읽기를 canonical 문서 기준으로 통일했습니다] - 2026-09-04

### Changed

- instance 생성·분리, 요소 update·remove가 활성 canonical 문서만 mutation source로 사용합니다. canonical 문서가 준비되지 않은 동안 오래된 legacy cache를 수정하거나 history로 기록하지 않습니다.
- 중첩 요소의 editing context 진입·종료, Styles reset의 선택 요소·부모·조부모 조회, Fill 액션의 현재 값 조회를 ADR-127 canonical node helper로 옮겼습니다. page ref의 `descendants` replacement subtree도 같은 helper cache에서 탐색합니다.
- 선택된 instance의 최신 override, Button/ListBoxItem 자식 생성용 customId 충돌 검사, Component Memory 분석도 canonical node index에서 직접 읽습니다. customId의 구 metadata 저장형식은 adapter 내부에서만 해소합니다.
- Components 팔레트와 Navigator Layers/Frames가 legacy `Element[]` 전체 projection 대신 panel 전용 canonical node 구조를 읽습니다. page·reusable frame scope, structural parent lifting, page ref descendants를 유지하며 component factory 입력도 생성에 필요한 필드로 축소했습니다.
- Page 삭제의 canonical topology 동기화는 `BuilderCore` page-shell bridge 한 곳이 담당합니다. Pages panel의 중복 full-document replacement를 제거해 부분 legacy cache가 canonical 문서를 덮는 경로를 닫았습니다.
- Select·ListBox·Menu의 items 편집은 target을 찾기 위해 canonical 문서를 매번 legacy `Element[]`로 평탄화하지 않고, document revision별 canonical projectable first-match index를 사용합니다. 활성 canonical 문서에 target이 없으면 오래된 legacy cache로 되살리지 않으며, 중복 id가 있는 잘못된 기존 문서에서도 structural node를 건너뛰고 후속 mutation과 같은 첫 DFS Element node를 선택합니다.
- 단일 요소 props 편집은 canonical 문서를 legacy `Element[]`로 전체 투영한 뒤 다시 merge하지 않습니다. revision별 target·descendant cache와 canonical tree structural sharing을 사용하고, UI용 derived array/map만 같은 순서로 증분 교체합니다. 잘못된 기존 duplicate id 문서는 구 adapter 복구 의미를 유지합니다.
- 다중 요소 props 편집도 target마다 legacy `Element[]`를 투영·재인덱싱하지 않고 revision cache로 읽은 뒤 canonical tree를 한 번만 순회합니다. canonical 문서는 batch당 한 번 push하고 UI용 derived array/map은 대상 행만 교체해 다중 선택 편집·정렬·propagation의 hot path 비용을 줄였습니다.
- production caller가 0인 `batchUpdateElements` store action과 legacy full-projection 구현을 제거했습니다. 실제 LayerTree·Canvas DnD는 canonical `children[]` 기반 `moveElementToContainer`/`moveElementToCanonicalTarget` 경로를 계속 사용합니다.
- 전체 필드 `updateElement`도 canonical target 한 건을 직접 교체하고 UI용 derived array/map의 대상 행만 갱신합니다. 구조·소유권·component/variable index 필드와 잘못된 duplicate id 호환 경로에서만 전체 index를 재구축해 customId·responsive·slot·descendants 편집의 문서 전체 projection을 제거했습니다.
- production caller가 0인 unified-store 전체 요소/current-page selector와 Canvas 요소 selector의 public export를 제거했습니다. 원본 모듈 파일은 삭제 승인 경계를 지켜 보존하고, canonical ref override helper 소유권은 ADR-127 traversal 모듈 한 곳으로 줄였습니다.

### Fixed

- 모바일·태블릿 style override를 reset할 때 선택 요소는 canonical 문서에서 읽으면서 responsive 값과 부모 baseline은 오래된 legacy map에서 읽어 reset이 누락될 수 있던 source 분리를 없앴습니다.
- Fill 액션을 canonical node index로 옮기면서도, top-level `fills` 도입 전에 저장된 문서의 `metadata.legacyProps.fills`는 adapter 경계에서 복원해 첫 편집 때 기존 fill stack이 사라지지 않게 했습니다.
- `updateElement`로 customId를 바꿀 때 이전 `metadata.customId`가 새 `metadata.legacyProps.customId`를 덮어 다음 canonical projection에서 값이 되돌아가던 adapter 우선순위를 현재 Element 값 기준으로 바로잡았습니다.
- customId·Frame Slot·Element Slot·instance Slot Fill 변경을 full-node canonical history event로 기록해 props 밖 canonical 필드 편집 뒤 Undo/Redo가 동작하도록 복구했습니다.
- ID 입력을 Enter로 확정할 때 keydown과 blur가 각각 저장해 동일한 no-op history entry를 하나 더 만들던 중복 commit을 제거했습니다.
- **Button Icon origin impact 취소와 단일 Undo**:
  - **Why**: Icon/Text 추가·제거가 먼저 실행된 뒤 마지막 Button props update에서 impact 확인을 기다려, Cancel 뒤에도 자식 mutation이 남고 history transaction이 둘로 갈렸습니다.
  - 모든 자식 mutation 전에 impact 승인을 완료하고 selection·page·project·canonical revision을 재검증합니다. 승인된 instance ID 집합에 묶인 operation token으로 Continue 뒤 Icon/Text/Button 변경을 한 history entry에 기록하며, Cancel 또는 dialog 대기 중 target 변경은 no-op입니다.
  - 위치: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`

### Performance

- Properties/Styles 패널의 단일 요소 조회를 전체 canonical `Element[]` projection과 선형 `find`에서 ADR-127 revision cache의 projectable node·parent·page/frame scope 조회로 전환했습니다. page ref descendants와 잘못된 duplicate ID의 첫-match 의미를 유지합니다.
- 5,000-node 합성 규모 A/B에서 같은 문서의 warm selection p50/p95는 0.0300/0.0392ms → 0.00121/0.00358ms, canonical mutation 뒤 이미 갱신된 traversal cache의 leaf read는 0.7769/2.1724ms → 0.00117/0.00729ms였습니다. 최초 cold read도 0.8803/1.2420ms → 0.7239/1.1751ms로 악화되지 않았고, cache scope 확장 뒤 기존 `updateElement` action은 history 23건 포함 p50/p95 1.33/1.89ms로 직전 기준 범위에 머물렀습니다. 이 수치는 합성 문서의 규모 비용 비교이며 실제 문서 분포의 개선율로 해석하지 않습니다.
- Properties/Styles의 aggregate elements/children 조회를 `getCanonicalDocumentElementsView`와 hook 인스턴스별 Map 재생성에서 ADR-127 occurrence cache 기반 문서별 공유 index로 전환했습니다. ref descendants의 parent·page/frame scope, DFS 순서, duplicate ID의 aggregate last-match 의미를 유지하면서 PanelNode adapter 경계 안에서 배열·ID Map·children Map을 한 번에 만듭니다.
- 6,000-node 합성 문서에서 elements Map 8개·children Map 3개 consumer를 GC 전처리 후 old/new 교차 실행한 결과, canonical revision 재구축 p50/p95가 4.92/7.17ms → 3.46/4.84ms였습니다. 실제 문서 분포가 아닌 aggregate 중복 생성 비용의 합성 비교입니다.
- Performance Monitor의 element count가 숫자 하나를 얻기 위해 매 수집마다 canonical 문서를 legacy `Element[]`로 두 번 투영하던 경로를 projectable canonical node 직접 count로 전환했습니다. clone-on-write document 참조별 WeakMap cache를 공유해 같은 collect 안의 store-memory 추정 재조회도 O(1)입니다.
- 5,000-node 합성 문서에서 실제 collect와 같은 count 2회 교차 측정 p50/p95가 2.095/3.593ms → 0.033/0.332ms였습니다. 실제 문서 분포나 전체 collect 시간의 개선율로 해석하지 않습니다.
- Inspector의 style·responsive·fill 편집은 선택 요소를 얻기 위해 매번 전체 `Element[]`를 만들고 Map을 재구축하지 않습니다. projectable leaf lookup과 기존 derived `elementsMap`·`childrenMap`을 재사용하며, ref master도 DFS-first ID/name/customId 호환 인덱스로 조회합니다. bootstrap 중 derived cache에서 target이 빠진 경우에만 cached canonical view 전체를 한 번 복구합니다. 5,000-node 합성 3-projection action shape에서 p50/p95가 1.766/8.972ms → 1.481/2.945ms였습니다.
- 텍스트 편집은 key 입력마다 canonical 문서를 다시 투영하지 않고 편집 시작 때 얻은 leaf snapshot을 session 동안 유지합니다. 외부 document/layout revision이 바뀌면 최신 leaf를 다시 읽어 함께 변경된 props를 보존합니다. 5,000-node 합성 13-read 편집 session p50이 3.339ms → 0.706ms였습니다.
- 텍스트 live input과 Inspector property/style preview의 canonical write를 단일 node structural-sharing helper로 전환했습니다. 선택 leaf를 이미 알고 있는 변경이 `BuilderCore.getCurrentLegacySnapshot()`을 거쳐 매 입력·preview마다 전체 document projection·ID Set·page shell filter를 생성하던 경로를 우회합니다. duplicate ID 문서는 기존 all-occurrence merge fallback을 유지합니다.
- Preview의 selection echo는 leaf lookup을 사용하고, 생성된 column/field 중복 검사는 legacy `Element[]` 대신 document 참조별 projectable ID Set을 사용합니다. 5,000-node generated-ID cold p50/p95가 0.475/3.107ms → 0.143/0.475ms였습니다.
- reusable frame 보강 로드는 frame마다 전체 문서를 투영·filter하지 않습니다. document별 frame scope와 DFS occurrence를 한 번 인덱싱해 frame 소유권과 duplicate 순서를 보존합니다. 60 frame·4,800-node 합성 전체 hydrate 재측정 p50/p95가 43.19/44.12ms → 2.14/3.58ms였습니다.
- 선택/활성화 단일 요소 read는 전체 document visitor 대신 last-match canonical lookup과 해당 leaf만 project합니다. Properties의 ref instance는 selected leaf와 DFS-first master leaf만 조합하며, store 전체 요소 selector가 document 변경마다 만들던 full view 구독을 없앴습니다.
- Navigator·Components가 공유하는 panel node projection은 clone-on-write document identity별 WeakMap cache를 사용하고, 공유 배열과 node를 readonly 경계에서 동결해 consumer 오염을 막습니다. 5,000-node 동일 프로세스 진단에서 100회 반복 cache miss 20.364ms, cache hit 0.011ms였으며 실제 UI latency 수치는 아닙니다.
- Undo/Redo/go-to-index는 canonical event 적용 전에 legacy 전체 projection을 만들지 않고, 적용기가 반환한 배열을 store와 index rebuild가 함께 사용합니다. event 또는 active document가 없는 실패 경로는 기존 derived state를 유지합니다.
- fill/style presentation commit의 정상 경로는 store mirror의 canonical document identity가 일치할 때 target 한 건만 교체하고 방금 만든 store 배열로 index를 재구축해 commit당 두 번이던 full projection을 0회로 줄였습니다. canonical revision 불일치·duplicate ID·mirror 누락·비-projectable target은 최신 문서 전체 projection으로 fail-safe 복구합니다.
- lazy page load와 page-frame binding은 ADR-127의 page-scope lookup만 project합니다. Fill presentation의 materialization context도 selected/ancestor/children canonical index만 읽어 다른 page·document 요소 객체를 만들지 않습니다.
- 연속 AI tool 호출이 같은 canonical 문서를 매번 visitor로 평탄화하고 ID/children Map을 다시 만들지 않도록 document identity별 read-model cache를 공유합니다. legacy bootstrap도 동일 elements 배열 동안 같은 index를 재사용합니다.
- instance detach·origin impact·override reset은 한 action 안에서 같은 canonical `Element[]` 복사본을 반복 생성하지 않고 document-keyed readonly view를 공유합니다. ref origin 영향이 page 경계를 넘을 수 있어 전체 문서 범위는 유지하되, store에 쓸 때만 새 배열을 만듭니다.
- 단일·다중 요소 삭제는 target/subtree를 수집할 때 읽은 readonly canonical snapshot을 동기 `executeRemoval` 구간에 그대로 전달합니다. 전체 문서의 ref/origin 영향 계산은 유지하면서 삭제 1회당 중복 `Element[]` 복사를 제거했습니다.

### Tests

- legacy-only instance/update/remove no-op, selection 즉시성·stale legacy 미복원, page ref descendants hierarchy, canonical responsive reset, 선택 노드가 사라진 Fill 액션의 stale legacy 미복원과 pre-cutover fill 보존, Button Icon impact Cancel·단일 Undo 회귀를 추가했습니다.
- panel canonical node의 page/frame scope·Slot·ref descendants, frame-bound LayerTree 합성, page 삭제 뒤 인접 body 즉시 선택, structural component creation 입력 회귀를 추가했습니다.
- items action에는 canonical 우선·stale legacy 차단·중복 id projectable first-match 회귀와 full projection 재도입 static gate를 추가했습니다. 5,000-node 합성 측정의 3회 median에서 target pre-read는 첫 조회 4.40ms → 0.96ms, 동일 revision 100회 66.09ms → 0.045ms였습니다. 격리된 551-element Builder의 12회 실제 편집은 p50 33.9ms/p95 40.4ms였고 Undo/Redo·Canvas·console을 함께 검증했습니다. 후자는 post-change 안정성 기준선이며 pre-change end-to-end 개선 수치로 해석하지 않습니다.
- 단일 props 편집에는 full `Element[]` projection·legacy merge 재도입 static gate와 structural parent lifting·page ref descendants·duplicate id·history roundtrip 회귀를 추가했습니다. 5,000-node 격리 action 20회 측정은 p50 10.08ms → 1.27–1.51ms였고, foreground synthetic Builder 1,000-node post-change 검증은 p50 0.3ms/p95 1.1ms였습니다. live 검증에서 canonical·derived selection·Undo/Redo가 일치했고 runtime error는 0이었습니다. live 수치는 post-change 안정성 기준선이며 pre-change end-to-end 개선 수치로 해석하지 않습니다.
- batch props 편집에는 full projection·legacy merge 재도입 static gate와 inherited dirty descendants, page ref descendants sibling order, duplicate id all-occurrence 호환, 동기 history/derived cache 회귀를 추가했습니다. 5,000-node 중 100개를 바꾸는 격리 action 20회 측정은 p50 17.11ms → 1.58–1.63ms였고, foreground browser post-change 검증은 p50 1.5ms/p95 2.0ms였습니다. canonical·derived selection·Undo/Redo가 일치했고 console/runtime error는 0이었습니다. live 수치는 post-change 안정성 기준선이며 pre-change end-to-end 개선 수치로 해석하지 않습니다.
- 전체 필드 편집에는 canonical target 재조회, full projection 재도입 방지, customId sibling order, duplicate id all-occurrence, structural rebuild, responsive history/layout 회귀를 추가했습니다. 5,000-node 실제 store action 20회 격리 측정은 변경 전 p50/p95 20.15/29.35ms에서 변경 후 3회 p50 1.11–1.44ms, p95 3.89–6.24ms였고, customId history 활성 최종 재측정도 p50/p95 1.17/6.52ms였습니다. foreground Builder에서는 ID 편집 1회가 history 1개만 만들고 Undo/Redo의 canonical ID가 왕복하며 console error 0임을 확인했습니다. selection 보존은 격리 store roundtrip으로 고정했습니다.
- Performance Monitor count에는 structural wrapper 제외, page ref descendants 포함, hoisted slot 포함, 새 document 참조 재계산과 legacy projection 재도입 방지 static gate를 추가했습니다.
- Inspector leaf/ref/history·cache-gap 복구·alias/ID 충돌 우선순위, text edit session revision·cancel·commit, Preview selection/generated-ID, frame scope cache·duplicate occurrence 소유권에 full projection 재도입 방지와 회귀 테스트를 추가했습니다.
- selection leaf·page-scope loader/binding·panel cache·presentation store index source·history projection reuse에 focused regression과 full-projection 재도입 static gate를 추가했습니다. duplicate ID, ref descendants, page/frame scope, selection 즉시성, Undo/Redo/go-to-index 의미를 유지합니다.
- 격리 Chromium에서 실제 IndexedDB v1 entry를 v3으로 올려 `canonicalEvents` 변환과 legacy payload strip을 확인했습니다. 같은 production history singleton으로 step2→step1 Undo, step1→step2 Redo, go-to-index 왕복을 실행했고, user/system snapshot 2개 영속과 step3→step2 복원·Undo/Redo 왕복도 확인했습니다 (console/page error 0).

## [입력 필드의 설명 문구가 캔버스에도 보입니다] - 2026-09-04

### Fixed

- 텍스트 필드 · 숫자 필드 · 날짜/시간 필드 등에 "Description" 을 입력하면 미리보기에만 한 줄이 나오고 캔버스에는 없어 높이가 달랐습니다 (예: 텍스트 필드 미리보기 83px vs 캔버스 56px). 이제 캔버스도 같은 자리에 같은 크기로 그립니다. 문서를 고칠 필요는 없습니다 — 기존 화면도 그대로 반영됩니다.
- 설명 문구의 글자 크기가 컴포넌트 크기 설정을 따르지 않고 주변 글자 크기를 물려받던 문제를 고쳤습니다 (날짜/시간/숫자 필드 md 기준 16px → 12px, 텍스트 필드 14px). 오류 메시지와 같은 기준입니다.

## [슬롯 (Slot) 의 자리 표시 상자가 내용에 맞춰 늘어납니다] - 2026-09-04

### Changed

- 슬롯 크기 (sm 40 · md 60 · lg 80px) 는 이제 **고정 높이가 아니라 최소 높이**입니다. 내용이 그보다 크면 상자가 같이 늘어납니다 (캔버스는 전부터 이렇게 다뤄 왔고, 미리보기가 이제 같아집니다).

### Fixed

- 슬롯 자리 표시 안내 (아이콘 + 슬롯 이름) 가 상자보다 커서 밖으로 넘치던 것을 한 줄 배치로 정리했습니다.

## [선택 상자의 값 텍스트에 준 스타일이 캔버스에서만 달라 보이던 문제를 정리했습니다] - 2026-09-04

### Changed

- 선택 상자 (Select · ComboBox · 검색 필드) 안의 값/안내 문구는 상위 컴포넌트의 디자인 규칙이 모양을 정합니다. 이제 캔버스도 그 규칙만 따르므로 캔버스에서만 글자가 커지거나 밀려 보이던 차이가 없어집니다. 스타일 패널은 어디서 편집해야 하는지 안내합니다.
- 값과 안내 문구 (Placeholder) 텍스트 편집은 그대로 해당 요소에서 합니다.

## [컴포넌트 팔레트에서 동작하지 않던 "color picker" 항목을 뺐습니다] - 2026-09-04

### Removed

- 팔레트의 "color picker" (TailSwatch) 는 클릭해도 요소가 추가되지 않던 항목입니다. 제공하지 않는 컴포넌트로 정리해 팔레트에서 제거했습니다. 속성 패널의 색상 선택 UI 는 그대로입니다.

## [재사용 프레임 편집에서 새로 넣은 슬롯 (Slot) 이 캔버스에 보입니다] - 2026-09-04

### Fixed

- 프레임 편집 모드에서 팔레트로 추가한 슬롯이 높이 0 으로 그려져 보이지 않았습니다. 이제 슬롯 크기 (sm 40 · md 60 · lg 80px) 만큼의 자리 표시 상자로 보입니다. 템플릿으로 만든 슬롯의 배치는 그대로입니다.

## [텍스트 영역 (TextArea) 의 높이가 캔버스와 미리보기에서 같습니다] - 2026-09-03

### Fixed

- 캔버스가 텍스트 영역을 한 줄 입력 상자 높이 (30px) 로 그려 미리보기 (3줄 = 70px) 와 달랐습니다. 이제 캔버스도 "Rows" 값과 크기 (size) 에 맞춰 줄을 쌓고 (기본 3줄 70px, 6줄 130px, lg 3줄 90px), 안내 문구 (placeholder) 도 미리보기처럼 상자 위쪽에 놓입니다.
- 스타일 패널의 "Vertical Align: top" 이 실제로 글자를 위에 붙입니다 (이전에는 아무 변화가 없었습니다).

## [History undo/redo 를 IDB-boundary migrate 전용으로 좁혔습니다] - 2026-09-03

### Changed

- undo/redo/go-to-index 는 `canonicalEvents` 만 적용합니다. `migrateV1EntryToV2` 는 IndexedDB upgrade/load 경계에만 남겼습니다.
- IDB load/upgrade 에서 context 없이 변환할 수 없는 element-axis entry(`diff`/`diffs` only 등) 는 스택에서 제거해, 되돌리기 한 칸만 소모하고 문서가 그대로인 상태를 막습니다.
- production 소비처가 없던 `undoBatchUpdate` / `redoBatchUpdate` / `undoGroupCreation` / `redoGroupCreation` 과 raw legacy read 계측 모듈을 제거했습니다.

### Tests

- historyActions migrate 부재·IDB adapter 유지 static gate, v1 fixture pre-migrate roundtrip 을 갱신했습니다.

## [HistoryEntry 에서 legacy snapshot 타입 필드를 제거했습니다] - 2026-09-03

### Changed

- `HistoryEntry.data` 에서 `element` / `prevProps` / `batchUpdates` 등 v1 snapshot 필드를 제거했습니다. raw IndexedDB payload 는 `migrateV1EntryToV2` 의 `LegacyV1SnapshotData` 로만 읽습니다.
- History 패널 라벨의 legacy snapshot 이름 분기를 제거했습니다. `canonicalEvents` 또는 truncated `elementId` 만 사용합니다. 변환에 실패한 구 IndexedDB entry 는 이름 대신 짧은 id 로 표시됩니다.

### Tests

- HistoryEntry 타입·migration LegacyV1 격리 static gate 와 label 회귀를 갱신했습니다.

## [History v1 fallback 을 제거하고 canonical 전용으로 전환했습니다] - 2026-09-03

### Changed

- undo/redo/go-to-index 가 v1 entry 를 `migrateV1EntryToV2` 로 변환한 뒤 `canonicalEvents` 만 적용합니다. legacy snapshot fallback 분기를 제거했습니다.
- migration 성공 entry 는 deprecated legacy snapshot payload 를 strip 합니다. raw legacy read 계측 경로도 소비처에서 제거됐습니다.

### Tests

- strip·fallback 제거 static gate, add/remove/batch migration, call-site roundtrip 을 갱신했습니다.

## [Legacy model migration 저위험 이관을 진행했습니다] - 2026-09-03

### Changed

- deprecated instance resolver (`resolveInstanceProps` / `resolveInstanceElement`) 를 제거하고, legacy detach 는 `mergePropsWithStyleDeep` + override mirror 로 확정 props 를 만듭니다.
- EditMode UI 타입을 `layout.types` 에서 `editMode` store 로 분리하고, Slot 소비·layout template 은 로컬 계약으로 좁혔습니다. reusable frame 목록 읽기는 `ReusableFrameLayoutSummary` 를 씁니다.
- canonical elements view 의 id 조회·page filter 는 캐시된 `getCanonicalDocumentElementsView` 를 쓰고, ref override helper 소유권은 ADR-127 traversal 모듈로 옮겼습니다.
- history v1 IndexedDB entry 의 structural add/remove 와 `prevElements`/`elements` batch 를 canonical events 로 변환합니다. legacy fallback 과 payload strip 은 raw legacy read 가 0 임을 확인하기 전까지 유지합니다.

### Tests

- leaf/static gate, history migration (add/remove/batch), IndexedDB adapter 계약, canvas/overlay/resetStyles view 경로 가드를 추가·갱신했습니다.

## [사용되지 않는 호환·rollback 계약을 정리했습니다] - 2026-09-03

### Removed

- 프로젝트 JSON 가져오기/내보내기가 canonical document를 직접 사용함에 따라 production 호출이 없는 `exportLegacyDocument` 역변환 helper와 전용 테스트를 제거했습니다. 현행 파일 호환 경로와 `legacyToCanonical` 기존 데이터 변환 테스트는 유지합니다.
- 현행 V4 panel workspace migration 체인에서 참조하지 않는 과거 V3→V2 operational rollback 구현과 전용 테스트를 제거했습니다. V3 record의 V4 승격과 exact V3 backup 기반 migration commit 검증·재개는 그대로 유지합니다.
- test-only collection migration helper를 `@composition/shared`와 `@composition/shared/utils` 공개 barrel에서 제거했습니다. 변환 계약 단위 테스트는 내부 모듈을 직접 검증합니다.

## [사용되지 않는 Builder 호환 API를 정리했습니다] - 2026-09-03

### Removed

- catalog 기본값 경로로 대체된 `createDefaultButtonProps`·`createDefaultLinkProps`·`createDefaultToggleButtonProps`·`createDefaultBadgeProps`·`createDefaultTextProps` export를 제거했습니다.
- 호출자가 없는 `loadPretendardToSkia`, `isPropertyModified`, `getModifiedProperties`, `BuilderCanvasWithFlag`를 제거했습니다. Builder의 Skia/iframe 선택은 계속 `Workspace`가 담당합니다.
- 주석만 남은 Electron 타입 stub과 제거된 style helper만 안내하던 미연결 Visual Feedback 가이드를 삭제했습니다.

### Infrastructure

- 어떤 package에서도 사용하지 않는 pnpm catalog의 `jotai` 항목을 제거했습니다.

## [AI 패널에서 모델을 설정하면 새로고침 없이 바로 씁니다] - 2026-09-03

### Fixed

- AI 패널을 연 뒤 에이전트 설정에서 endpoint·모델을 채우면, 새로고침 전까지 모든 요청이 "요청을 이해하지 못했습니다" 로만 답하던 것을 고쳤습니다 (모델 호출 자체가 없었음). 실행기를 패널이 열릴 때 한 번 만들던 것을 매 요청 시점에 만들도록 바꿔, 설정 직후 요청부터 모델을 호출합니다. 패널의 "먼저 모델을 알려 주세요" 안내도 설정을 마치고 돌아오면 바로 사라집니다.
- 모델 호출이 실패했을 때 오류 말풍선에 번역 키 이름 (`aiRuntime.providerError`) 이 그대로 보이던 것을 고쳤습니다 — 이제 "모델 호출에 실패했습니다. endpoint·모델·키 설정을 확인하세요." 로 표시됩니다.

### Tests

- `useAgentLoop.test.ts` — 미구성 상태로 연 패널이 설정 후 재렌더만으로 다음 턴부터 실행기를 쓰는지 (1건). `AnthropicProvider.live.test.ts` 신설 — `ANTHROPIC_API_KEY` (환경변수 또는 `apps/builder/.env`) 가 있을 때만 실제 Claude API 에 2턴 (도구 호출 → 원문 replay) 을 보내 400 없음을 확인하는 게이트, 키 없으면 skip.

## [AI 어시스턴트가 Claude 5 계열 (Fable 5.1 · Opus 5 · Sonnet 5) 과 호환됩니다] - 2026-09-03

### Fixed

- 에이전트 프로파일에 Claude 5 계열 모델을 넣으면 첫 요청부터 400 이 나던 것을 고쳤습니다. 어댑터가 Fable 5 이전 Messages API 계약을 전제하고 있었습니다 — 추론 강도를 `thinking.budget_tokens` 로 보내고 (Fable 5.x 는 thinking 을 끌 수도 예산을 줄 수도 없음 → 400), `temperature 0.7` 을 항상 실었으며 (비기본값 400), 도구 호출 턴의 thinking 블록을 버리고 assistant 턴을 재조립해 도구 결과를 돌려보내는 두 번째 요청이 실패했습니다. 이제 강도는 `output_config.effort` 로 보내고, temperature 는 보내지 않으며, 응답 원문 (thinking 블록·signature 포함) 을 그대로 다음 요청에 되돌립니다. Fable 5.1 레퍼런스 (overview · what's new · migration guide) 대조 결과입니다.
- 모델이 안전 분류기로 요청을 거절하면 (`stop_reason: "refusal"`) 빈 응답으로 끝나던 것을 고쳤습니다 — AI 패널에 거절 사유 (분류 카테고리) 를 표시하고 재시도하지 않습니다.

### Changed

- 시스템 프롬프트를 세션 동안 고정하고 (역할 · 전체 컴포넌트 목록 · 규칙), 페이지·선택 요소·관련 컴포넌트 상세는 이번 턴 사용자 메시지 앞에 붙입니다. Claude 5 계열은 요청 간에 system 이 바뀌면 prompt cache 가 깨지고 thinking 블록의 prefix binding 이 어긋나므로 (Fable 5.1 은 400), 이력을 append-only 로 유지합니다.
- 추론 강도 선택지에 `xhigh` · `max` 가 추가됐고 (Claude 5 effort 5단계), Anthropic 어댑터의 기본 `max_tokens` 가 2048 → 16000 으로 올랐습니다 (adaptive thinking 이 이 한도 안에서 돌아감). OpenAI 호환 어댑터의 기본값은 그대로입니다.

### Tests

- `providers.test.ts` — 요청 본문에 `output_config.effort` 만 있고 `thinking` · `temperature` 가 없는지, thinking/redacted_thinking/text/tool_use 블록을 index 순으로 모아 signature 째 replay 하는지, `refusal` + `stop_details.category` 를 노출하는지 (6건). `AgentService.test.ts` — system 고정 + 턴 컨텍스트가 마지막 user 메시지에만 붙는지, provider 원문이 다음 요청에 실리는지, refusal 이 재시도 없이 끝나는지 (3건). `systemPrompt.test.ts` 를 분리 API 로 재작성.

## [Skeleton · Avatar · TailSwatch · Slot 의 배치가 캔버스와 Preview 에서 같습니다] - 2026-09-03

### Fixed

- block 컨테이너 안에서 Skeleton 과 TailSwatch 가 캔버스에서는 내용 폭으로 줄고 (TailSwatch 는 폭 0) Preview 에서는 부모 폭을 채우던 것, Avatar 가 캔버스에서는 다음 요소와 같은 줄에 붙고 Preview 에서는 줄을 차지하던 것을 고쳤습니다. 컴포넌트 규칙 (catalog) 의 display 값을 Preview 가 실제로 쓰는 값 (Skeleton·TailSwatch block, Avatar flex) 으로 맞췄습니다.
- 재사용 프레임의 Slot 자리가 Preview 에서 내용 폭 (73px) 으로 줄어들던 것을 고쳤습니다 — Slot 스펙에 display:block 을 명시해 캔버스와 같이 부모 폭을 채웁니다.

### Tests

- `adr923Hc2ConversionRect.browser.test.ts` (5 컴포넌트 Canvas ↔ Preview 실경로 outer 상자 대조) 신설, HC2 판정표 `전환필요(후속)` 5 → 0. StatusLight 는 Preview 실경로 (`renderStatusLight` 인라인 inline-flex) 를 재측정해 규칙 무변경으로 일치 확인.

## [입력 상자 래퍼와 그룹 라벨도 부모에서 편집합니다] - 2026-09-03

### Changed

- NumberField · Select · ComboBox · SearchField · DatePicker · DateRangePicker 안의 입력 상자 래퍼 (SelectTrigger) 와 CheckboxGroup · RadioGroup · Meter · ProgressBar · Slider 안의 라벨 (Label), DatePicker · DateRangePicker 래퍼 안의 날짜 입력 (DateInput) 을 Layers 에서 선택하면 Properties 와 Styles 패널이 "부모에서 편집하는 요소" 안내를 띄웁니다. 이 요소들에 직접 준 스타일은 Preview/Publish 가 읽는 경로가 없어 캔버스에서만 달라 보였는데, 이제 캔버스도 무시합니다 — 부모의 속성으로 편집하세요. 안내의 부모 이름은 실제로 그리는 요소 (DatePicker 의 날짜 입력이면 DatePicker) 입니다.

### Fixed

- Meter · ProgressBar 의 라벨이 캔버스에서 부모의 Label 속성이 아니라 처음 만들 때의 글자 ("Storage" · "Progress") 폭으로 잡혀 Preview 보다 넓게 그려지던 것을 고쳤습니다 (400px 에서 54/61 → 40, Preview 39).

### Tests

- `adr923WrapperSubpartProjection.browser.test.ts` 3 (9 컴포넌트 — 래퍼·라벨에 아무 스타일을 얹어도 캔버스 상자가 깨끗한 상태와 같다 · Preview 상자 대조 · 래퍼 폭 = 부모 폭), bridge `read-only sub-part 확장 (후반)` 1 (owner 13 조합 + Skia). 원복 7종 재측정 — 6 은 게이트 반응, 1 (Label 숫자 grid line 주입) 은 무반응 기록.

## [Preview 메시징을 canonical document 단일 채널로 정리했습니다] - 2026-09-03

### Changed

- Builder의 Preview 전체 동기화 계약을 `UPDATE_CANONICAL_DOCUMENT` 하나로 정리했습니다. 수신처가 이미 제거된 `UPDATE_ELEMENTS` 송신·대기열 분기와 ACK 상태를 없애고, 페이지·frame 선택은 기존 Builder store 선택과 `ELEMENT_SELECTED` 경로만 사용합니다.

### Removed

- Preview가 callback을 주입하지 않아 아무 동작도 하지 않던 `REQUEST_ELEMENT_SELECTION` 메시지와 Builder의 `requestAutoSelectAfterUpdate`·`requestElementSelection` API를 제거했습니다.
- `UPDATE_ELEMENTS` 전용 page scope 확장 helper였던 `canonicalRefDependencies`와 전용 테스트를 제거했습니다. canonical document 전체 전송 경로에서는 사용되지 않습니다.

### Tests

- `useIframeMessenger.canonical.test.ts`가 제거된 bulk sync·ACK·선택 protocol과 호출자 재도입을 함께 차단합니다.

## [입력 필드의 라벨·입력 상자·오류 메시지 요소는 부모에서 편집합니다] - 2026-09-03

### Changed

- TextField · TextArea · NumberField · DateField · TimeField 안의 오류 메시지 요소 (FieldError) 와 라벨·입력 상자 요소 (Label · Input · DateInput) 를 Layers 에서 선택하면 Properties 와 Styles 패널이 편집 컨트롤 대신 "부모에서 편집하는 요소" 안내를 띄웁니다. Select · ComboBox · SearchField · ColorField · DatePicker · DateRangePicker 의 Label 도 같습니다. 이 요소에 직접 준 글자색·간격·크기는 Preview 와 Publish 가 원래 읽지 않았고 (필드가 부모 속성으로 통째로 그립니다) 캔버스에서만 달라 보였습니다. 이제 캔버스도 같은 값을 무시하고 부모 필드의 디자인 규칙 (오류 메시지 글자 14/12px · 빨간 글자 · 줄 높이 1.5, 라벨 굵기 600, 입력 상자 폭 100%) 만 쓰므로 세 화면이 같습니다. 라벨·입력 상자에 직접 준 여백·크기 때문에 캔버스에서만 필드가 커 보이던 경우도 사라집니다. 예전 문서에 남아 있던 값은 지우지 않아도 되며 어디에도 반영되지 않습니다. 오류 메시지의 표시·문구는 종전대로 부모의 Invalid · Error Message 로 편집합니다. 실측: 실제 빌더에서 요소에 색·여백·크기를 준 뒤 캔버스 상자 (87×21) 와 필드 높이 (83) 가 그대로인 것을 확인, 자동 게이트 2종 (Skia 노드 동일성 · DOM 대조 5 종).

## [Invalid 로 켠 입력 필드의 오류 메시지가 캔버스에도 보입니다] - 2026-09-03

### Fixed

- TextField · TextArea · NumberField · DateField · TimeField 를 Properties 패널에서 Invalid 로 켜고 오류 메시지를 적어도 캔버스에는 아무것도 나타나지 않고 Preview/Publish 에만 빨간 메시지가 붙던 것을 고쳤습니다. 이제 캔버스도 같은 조건에서 같은 자리에 같은 크기 (TextField·TextArea 14px · NumberField·DateField·TimeField 12px, 줄 높이 글자의 1.5배) 로 메시지를 그리고 필드 높이도 함께 늘어납니다 (TextField 56 → 83, Preview 84). 메시지를 비운 채 Invalid 만 켜면 Preview 와 같이 빈 줄 (높이 0) 과 간격만 생깁니다. 원인은 세 겹이었습니다 — 부모의 `isInvalid`/`errorMessage` 를 FieldError 자식으로 옮기는 규칙이 없었고 (label 만 있었음), 레이아웃이 부모→자식 값 전파를 부모 측정에만 쓰고 자식 자신의 엔진 입력에는 반영하지 않았으며, FieldError 글자 크기를 catalog 의 부모별 위임 값 (`.react-aria-FieldError` hint 변수) 이 아니라 기본 16px 로 재고 있었습니다. Inspector 가 아닌 경로 (AI · import) 로 부모만 바꿔도 캔버스가 다시 계산되도록 두 속성을 레이아웃 무효화 목록에 넣었습니다 (TagGroup 의 오류 메시지 편집도 같은 등재로 즉시 반영됩니다). 실측: `adr923FieldErrorStateProjection.browser.test` 5 종 × 4 상태 (DOM 과 높이·간격 1px 안), 실제 빌더에서 TextField 를 Invalid 로 켜고 끄며 Skia rect 와 publish DOM 대조.

- 위 수리에 이어, 오류 메시지 글자가 캔버스에서만 작거나 줄 간격이 좁던 나머지 경우도 고쳤습니다. (1) 예전에 만든 문서의 오류 메시지는 캔버스에서 12px·18px 높이로, Preview 에서는 14px·21px 로 그려졌습니다 — 필드를 만들 때 글자 크기를 요소에 직접 박아 넣었는데 Preview 는 그 값을 읽는 경로가 없기 때문입니다. 이제 양쪽 모두 디자인 시스템의 필드별 값 (TextField·TextArea 14px, 나머지 12px) 을 쓰고, 새로 만드는 필드에는 크기를 박아 넣지 않습니다. 저장된 문서는 그대로 두고 표시할 때만 맞춥니다. (2) 캔버스의 줄 높이가 16px 로 고정돼 Preview (글자의 1.5배) 보다 좁던 것도 맞췄습니다. (3) 오류 메시지 요소에 줄 간격을 직접 준 문서도 캔버스에서만 그 값이 적용되던 것을 함께 고쳤습니다 (Preview 는 읽는 경로가 없어 21px, 캔버스는 10px 또는 140px 로 갈렸습니다). (4) Properties 에서 Invalid 를 켜고 끌 때 오류 메시지 요소에 직접 준 스타일 (글자색·글자 크기·줄 간격 등) 이 사라지던 것을 고쳤습니다 — 상태 전파가 스타일 묶음 전체를 갈아치우고 있었습니다. 실측: 실제 빌더에서 옛 문서 형태 (글자 크기 12 + 줄 간격 10 을 얹은 요소) 를 만들어 캔버스 21px ↔ publish 21px 일치 확인, Invalid 를 껐다 켠 뒤에도 그 요소의 글자색·크기·줄 간격 유지 확인, 자동 게이트 13종 신설 (그중 5종은 Properties 패널이 store 에 쓰는 실제 함수를 통째로 돌려 스타일 보존을 확인하고, 패널이 그 함수를 우회하지 못하게 소스 구조까지 검사합니다).

## [렌더 계측이 개발 빌드의 프레임을 잡아먹지 않습니다] - 2026-09-02

### Changed

- 렌더 계측 (`perfMarks.observe`) 이 기본으로는 DevTools 용 User Timing (`performance.mark/measure`) 을 남기지 않습니다. 종전에는 프레임마다 라벨당 mark·measure·clear 여섯 번을 불렀고, 그중 `clearMeasures` 가 measure 버퍼 전체를 훑었습니다. 개발 빌드에서는 React 19.2 가 렌더마다 measure 를 그 버퍼에 쌓고 지우지 않으므로 세션이 길수록 매 프레임 계측 비용이 자랐습니다 (600 요소 유휴에서 JS busy 의 25.6% 가 계측 자체). 내부 통계 (`__composition_PERF__.snapshot`) 는 그대로이고, flame graph 에 보이게 하려면 콘솔에서 `__composition_PERF__.setUserTiming(true)` 를 켭니다. 배포 빌드에는 React 의 measure 가 없어 체감 변화는 개발 환경에 한정됩니다.

## [편집을 반복해도 메모리가 쌓이지 않습니다] - 2026-09-02

### Fixed

- 스타일·속성을 편집할 때마다 그 시점의 요소 목록 사본이 메모리에 영구히 남던 것을 고쳤습니다 (요소 60개 문서에서 편집 1회당 약 14KB, 편집·undo·redo 를 계속하면 세션이 끝날 때까지 자랍니다). 원인은 캔버스 전역 단축키 host 였습니다. 편집마다 다시 렌더되면서 일부 핸들러만 새로 만들어졌고, 살아남은 이전 핸들러가 이전 렌더의 변수 전체 (그때의 요소 목록) 를 붙잡는 사슬이 렌더 수만큼 이어졌습니다. 이제 핸들러는 최신 값을 ref 로만 읽어 렌더 사이에 바뀌지 않습니다. 실측 (`pnpm perf:baseline --actions edit`, 강제 GC 후 힙 기울기): 사이클당 +0.28MB → +0.04MB.
- 스타일 붙여넣기 핸들러도 렌더마다 새로 만들어져 같은 사슬의 한 링크였습니다. 함께 고정했습니다.

### Added

- `pnpm perf:baseline` — Builder 메모리 기준선 하니스 (`apps/builder/scripts/perf-baseline.mjs`). Playwright 로 dev 서버의 격리 프로젝트를 열어 패널 토글·페이지 전환·선택·편집(undo/redo)·줌 사이클을 돌리고, 사이클마다 강제 GC 후 JS 힙·Blink 힙·DOM 노드·리스너·ArrayBuffer·Skia 캐시 크기를 기록해 기울기로 누수를 판정합니다. `--mode attribute` (살아남은 할당의 스택 + 스냅샷 class diff) 와 `--mode retainers` (대상 객체의 최단 retainer 경로) 로 원인을 좁힙니다. React 19.2 dev 빌드가 렌더마다 남기는 `performance.measure` 항목은 앱 누수가 아니라 측정 전에 비웁니다.

## [block 컨테이너 안의 Button·inline 요소가 Chrome 과 같은 자리에 놓입니다] - 2026-09-02

### Fixed

- 캔버스에서 block 컨테이너 안에 Button 두 개를 두면 세로로 쌓이거나 (폭을 지정한 형제 뒤에서) 같은 줄에 남던 것을 고쳤습니다. 이제 Preview 와 같이 폭을 지정한 block 형제는 줄을 차지하고 Button 들은 그 아래 줄에 나란히 놓입니다 (ADR-923 Phase 5 — 레이아웃 엔진이 CSS display 값을 그대로 받아 inline 요소의 줄 배치를 직접 계산합니다. 종전에는 TS 가 block 컨테이너를 flex 로 흉내 냈습니다). ADR-923 은 2026-09-03 Implemented 로 승격됐습니다 — 실제 빌더에서 같은 시나리오를 다시 확인했고, Phase 6 에서 레이아웃 어댑터의 옛 `Taffy*` 이름을 `Engine*` 로 바꾸고 (동작 무변경) 엔진이 아직 CSS 그대로 구현하지 않는 자리 (`display:inline` · `float` · grid `subgrid`·`dense`) 를 capability matrix 로 선언해 Chrome 과의 격차를 테스트로 고정했습니다.
- catalog 의 Button · ToggleButton 기본 display 가 DOM 과 같은 `inline-flex` 가 됐습니다. Styles 패널 Layout 의 Direction 은 row 로 표시됩니다 (Phase 4 의 inline-flex 표시 정정과 함께).
- overflow 가 `hidden`/`clip`/`auto` 인 요소의 자동 높이·폭이 부모 크기로 잘리던 것을 없앴습니다. block 문맥에서는 CSS 대로 콘텐츠 크기를 유지하고, flex 문맥의 scroll container 는 엔진이 최소 크기 0 으로 줄입니다.
- CalendarGrid 의 기본 display 가 `block` 이 됐습니다 (Calendar 안에서는 변화 없음).

### Changed

- 레이아웃 엔진으로 보내는 display 값이 CSS 값 그대로 (`inline-flex` · `inline-grid` · `inline-block` 보존) 가 됐습니다. 대규모 문서 (약 5,000 노드) 의 레이아웃 p95 는 flex 위주 +4.9%, block 위주 +2.5% 로 예산 (5%) 안입니다.

## [패널 크기 조절·이동 중 바뀐 패널만 다시 그립니다] - 2026-09-02

### Changed

- 패널 workspace 의 overlay 루트가 레이아웃 snapshot 전체를 구독하지 않습니다. 종전에는 resize·move 의 매 프레임마다 dock 과 패널 frame 12개가 통째로 다시 렌더됐습니다 (한 flush 에 컴포넌트 렌더 25개, 그중 frame 12 + frame 구독자 12). 이제 geometry 가 실제로 바뀐 frame 과 그 splitter 만 렌더됩니다 (Navigator 폭 조절: frame 1 + 구독자 1, 실제 빌더에서 확인). 화면 결과와 저장되는 레이아웃은 같습니다.
  - frame 구독은 값 비교 캐시를 거칩니다. 좌표·크기·zone·cluster·resize edge 가 같으면 이전 객체를 그대로 돌려줘 렌더를 건너뜁니다. 포커스 순서 (z-index)·cluster 합류 표식·작업 영역 높이는 frame 과 따로 바뀔 수 있어 원시값으로 별도 구독합니다. 패널을 클릭해 앞으로 가져오는 동작은 그대로입니다 (실제 빌더에서 z-index 1001↔1002 전환 확인).
  - 캔버스가 읽는 `data-page-layout-*-panel-width` 는 JSX 대신 coordinator 직접 구독으로 DOM 에 씁니다. snap guide 는 drop candidate 를 스스로 읽습니다. dock 의 `data-layout-version` 속성은 읽는 곳이 없어 제거했습니다.
  - cluster 내부 splitter 와 column 경계선 (rail) 도 같은 구조입니다. 부모는 id 목록만 구독해 splitter·column 이 생기거나 없어질 때만 렌더되고, 각 splitter·rail 은 자기 geometry 를 값 비교 캐시로 읽습니다. splitter 의 aria-valuenow (앞 패널 크기)·상한 (작업 영역 높이)·z-index (cluster 포커스 순서)·anchor 방향은 원시값으로 따로 구독합니다. 이동 미리보기 flush 에서는 splitter 가 렌더되지 않습니다 (committed splitter 그대로).
  - 회귀 게이트 `PanelWorkspace.renderFanout.test.tsx` 가 flush 당 렌더 컴포넌트 수를 fiber 순회로 고정합니다 (overlay 루트·dock·toggle rail·splitter 부모·rail 부모 0, frame·splitter·rail = inline style 이 바뀐 수).

## [패널 크기 조절이 마우스를 따라옵니다] - 2026-09-02

### Fixed

- 패널 가장자리를 드래그할 때 패널이 마우스보다 늦게 따라오던 것을 고쳤습니다. 원인은 캔버스였습니다. 패널 폭이 바뀔 때마다 `BuilderCanvas` 전체가 다시 렌더돼 (페이지 재중앙 정렬용 패널 폭 값을 항상 구독) 매 프레임 수 MB 를 할당하고 GC 가 프레임을 멈췄습니다. 이 값은 frame 편집 모드에서만 쓰이므로 그때만 구독합니다. 실측 (Navigator 드래그, 50Hz 표시): 프레임 드롭 35% → 0%, 메인 스레드 차단 2초당 1.6초 → 3초당 0.06초, JS 할당 109 MB/s → 31 MB/s.
- 패널 이동 (상단 손잡이 드래그) 도 같은 경로였습니다. 이동 중에도 매 프레임 같은 신호가 캔버스로 흘러 들어갔으므로 위 수정으로 함께 해소됐습니다 (이동 중 프레임 드롭 0%).
- Action Bar 를 드래그하는 동안 바 전체가 매 move 마다 다시 렌더되고 크기를 다시 재던 것을 없앴습니다. 이제 이동 중에는 위치만 DOM 에 바로 쓰고, 놓을 때 한 번 저장합니다 (드래그 중 JS 할당 17 MB/s → idle 과 같은 1 MB/s).
- 패널 workspace 루트가 레이아웃 버전 속성 하나를 쓰기 위해 매 flush 마다 통째로 다시 렌더되던 것을 없앴습니다. 화면 결과는 같습니다.

## [크기 조절 손잡이가 드래그 중 깜박이지 않습니다] - 2026-09-02

### Fixed

- 패널·섹션·compare 구분선을 드래그하는 동안 손잡이 표시가 사라졌다 나타나던 것을 고쳤습니다. 표시가 마우스 hover 에만 묶여 있어, 패널이 한 프레임 뒤에 따라오는 사이 포인터가 10px 손잡이 영역을 벗어나면 꺼졌습니다. 이제 드래그가 진행되는 동안에는 포인터 위치와 무관하게 표시를 유지합니다.
- 드래그 중에는 화면 전체에 투명 막을 덮어 resize 커서를 유지하고, 아래 패널·캔버스의 hover 반응과 텍스트 선택이 끼어들지 않게 했습니다. 키보드 조절 (화살표·Home·End) 은 막을 띄우지 않습니다.

## [Layout 패널이 inline-flex 요소의 방향·정렬을 표시합니다] - 2026-09-02

### Fixed

- Styles 패널의 Layout 섹션에서 `display: inline-flex` 요소의 Direction (row / column) 과 Alignment 9-grid 가 비어 있던 것을 고쳤습니다. 종전에는 `flex` 만 flex 컨테이너로 보아 사용자가 지정한 `inline-flex` 요소를 block 으로 표시했습니다. 팔레트 컴포넌트 (Button 등) 의 표시는 변하지 않습니다. (ADR-923 Phase 4)

## [Navigator 의 두 섹션 사이를 드래그해 높이를 나눌 수 있습니다] - 2026-09-02

### Added

- Navigator 의 Pages / Layers 사이 (Frames 탭은 Frames / Layers 사이) 에 드래그 구분선을 넣었습니다. 위 섹션은 내용 높이까지만 차지하고, 상한 (기본은 패널 높이의 절반) 을 넘으면 그 안에서 스크롤합니다. 아래 섹션은 남는 공간을 전부 씁니다. 구분선을 드래그하면 그 값이 상한으로 저장되어 새로고침 후에도 유지되고, 더블클릭하면 기본 상한으로 돌아옵니다. 키보드 (화살표·Home·End) 로도 조절할 수 있습니다.
- Frames 탭의 Frames / Layers 섹션도 접을 수 있게 됐고, 헤더의 "모든 섹션 접기 / 펼치기" 토글이 Frames 탭에서도 동작합니다.
- 구분선 손잡이는 마우스를 올리지 않아도 항상 보입니다 (마우스를 올려도 변하지 않음). 끌 수 있는 자리라는 단서를 기본으로 드러내기 위해서입니다.
- 빌더의 크기 조절 손잡이 선을 한 규격으로 맞췄습니다. 가로형은 36×2px, 세로형은 2×36px, 보일 때 불투명도 1 이며 패널 가장자리·패널 묶음 사이·패널 안 섹션 사이가 모두 같은 토큰을 씁니다.
- compare 모드 (CSS / Canvas 나란히 보기) 의 가운데 구분선도 같은 손잡이로 바꿨습니다. 분홍 막대 대신 공통 색·두께의 전체 높이 선을 쓰고 (Navigator 와 같이 항상 표시), 키보드 (화살표·Home·End) 와 접근성 이름 (`role="separator"`) 이 생겼습니다. 저장되는 분할 비율과 20~80% 범위는 그대로입니다.

### Changed

- Navigator 는 이제 탭 전체가 한 덩어리로 스크롤하지 않고 섹션마다 따로 스크롤합니다. 페이지가 많아도 Layers 섹션이 화면 아래로 밀리지 않습니다. 이 변경으로 Layers 트리의 대용량 가상 스크롤 (300개 이상) 이 실제로 동작합니다. 종전에는 트리 높이가 묶이지 않아 전부 그려졌습니다.

## [Navigator 의 Pages·Layers 를 접을 수 있고, 페이지를 검색할 수 있습니다] - 2026-09-02

### Added

- Navigator 패널의 Pages / Layers 섹션에 접기·펼치기 chevron 을 넣었습니다. 접힘 상태는 다른 패널 섹션과 같은 방식으로 저장되어 새로고침 후에도 유지됩니다.
- Navigator 헤더 (닫기 버튼 앞) 에 "모든 섹션 접기 / 펼치기" 토글을 추가했습니다. Components 패널 헤더와 같은 버튼이며, Layouts 탭에서는 아직 섹션이 없어 비활성입니다.
- Pages 섹션에 검색을 추가했습니다 (페이지가 2개 이상일 때 돋보기 토글). 제목·slug 부분 일치로 거르고, 일치한 페이지의 상위 페이지는 계층을 유지하기 위해 함께 남기고 자동으로 펼칩니다. Escape 로 닫으면 전체 목록으로 돌아갑니다.

### Changed

- Layers 섹션과 Layouts 탭 요소 트리의 "모두 접기" 버튼 문구를 "트리 접기" 로 바꿨습니다. 헤더의 "모든 섹션 접기" 와 뜻이 겹치지 않게 하기 위해서입니다.

## [패널 헤더의 "모든 섹션 접기" 가 펼치기와 왕복하고, Styles 단축키가 다른 패널을 건드리지 않습니다] - 2026-09-02

### Fixed

- Components 패널 헤더의 "모든 섹션 접기" 버튼이 접기만 되고 다시 펼칠 수 없던 문제를 고쳤습니다. 모든 섹션이 접히면 버튼이 "모든 섹션 펼치기" (아이콘·라벨 함께) 로 바뀌고, 섹션 chevron 으로 하나씩 접어 전부 접힌 경우에도 같은 상태를 반영합니다.
- Styles 패널의 전체 접기/펼치기 단축키 (⌥S) 가 다른 패널 (Components·Monitor·History 등) 의 섹션이 하나라도 접혀 있으면 펼침이 동작하지 않던 문제와, 펼칠 때 다른 패널의 접힘 상태까지 지우던 문제를 고쳤습니다. 이제 Styles 의 섹션 4개만 판정·조작합니다.

### Added

- 패널 헤더용 공용 "모든 섹션 접기/펼치기" 토글 버튼 (`SectionGroupToggleButton`) 과 섹션 그룹 판정 helper (`useSectionGroupToggle`) 를 추가했습니다. Components 패널이 먼저 쓰며, Navigator 패널의 Pages/Layers 접기·헤더 토글·분할 조절은 후속 단계로 이어집니다.

## [목록·격자 목록의 선택 방식 기본값이 속성 패널 표시와 실제 화면에서 같아졌습니다] - 2026-09-02

### Fixed

- GridList·ListBox 의 Selection Mode 를 지정하지 않았을 때, 속성 패널은 "Single" 로 보이는데 미리보기는 선택이 꺼진 상태로 그려지던 불일치를 고쳤습니다 — 지정하지 않았을 때의 기본값을 "None" 으로 바로잡아 패널 표시와 실제 화면이 같아집니다. 빌더 팔레트와 AI 로 만든 GridList·ListBox 는 값이 기록되어 영향이 없었고, 값을 기록하지 않은 문서 (파일로 가져온 canonical 문서 등) 에서 드러났습니다 (ADR-923 Codex round 24).
- 선택 방식·선택 표시 (Selection Mode/Style) 를 지정하지 않았을 때 쓰이는 기본값을 캔버스·미리보기·가상 스크롤이 각자 따로 들고 있던 것을 한 곳에서 읽도록 통일했습니다 — 한쪽만 바뀌어 두 화면이 조용히 갈리던 여지를 없앱니다.

### Added

- `@composition/shared` 에 컴포넌트 기본값 조회 함수 (`resolveBindingPropDefault` · `resolveBindingSelectionMode` · `resolveBindingSelectionStyle` · `resolveComponentRuleByTag`) 를 추가했습니다. 지정하지 않은 prop 의 기본값을 캔버스·미리보기 어느 쪽에서도 같은 곳에서 읽기 위한 것으로, 컴포넌트 카탈로그 선언이 유일한 원천입니다 (ADR-923 round 22~24).

## [캔버스가 준비된 뒤 패널이 열리고 프로젝트 로딩 진행률을 표시합니다] - 2026-09-02

### Fixed

- Builder에 들어갈 때 Header·패널·선택 Action Bar가 빈 캔버스보다 먼저 보이던 문제를 고쳤습니다. 프로젝트 데이터와 CanvasKit·폰트·Surface가 준비되고, 현재 프로젝트 문서가 실제 Skia 프레임으로 화면에 제출된 뒤에만 이 chrome이 나타납니다.
- 기존 로딩 화면에 프로젝트 준비 단계를 반영한 진행률을 표시합니다. 시간에 따라 임의로 증가하거나 timeout으로 완료 처리하지 않으며, WebGL Canvas를 끈 경우에는 Preview iframe 준비 상태를 같은 완료 경계로 사용합니다. 진행 bar는 단계 사이를 부드럽게 채우고, 실제 첫 프레임이 제출된 뒤 100% transition까지 마친 다음 Builder chrome을 공개합니다. 별도 회전 아이콘이나 배경 패턴을 추가하지 않고 Builder 작업 영역의 dot background를 로딩 단계부터 그대로 보여줍니다.

## [설정을 지정하지 않은 표·배지가 캔버스와 미리보기에서 같은 크기로 그려집니다] - 2026-09-02

### Fixed

- 높이 설정을 지정하지 않은 표가 캔버스에서만 100px 낮게 (302px vs 미리보기 402px) 그려지던 문제를 고쳤습니다 — 값을 지정하지 않았을 때 쓰이는 기본값을 두 화면이 같은 곳에서 읽습니다. 빌더에서 새로 만든 표는 높이가 기록되어 영향이 없었고, 파일 가져오기·AI 로 만든 표에서 드러났습니다 (ADR-923 Codex round 22).
- 크기를 지정하지 않은 Badge 가 캔버스에서 한 단계 큰 크기 (보통 → 작음) 로 그려지던 문제를 고쳤습니다. Select 도 같은 축에서 반대로 어긋나 있었습니다.
- Badge 처럼 테두리 두께가 크기 설정에 들어 있는 컴포넌트가 캔버스에서 테두리 두께 (상하좌우 2px) 만큼 작게 그려지던 문제를 고쳤습니다.

## [비어 있는 목록·탭·표가 캔버스에서도 빈 만큼만 차지하고, 표 높이 설정이 미리보기에 반영됩니다] - 2026-09-02

### Fixed

- 항목이 하나도 없는 ToggleButtonGroup·Tabs·GridList·Tree·Table 이 캔버스에서 미리보기와 다른 크기로 그려지던 문제를 고쳤습니다 — 버튼이 없는 그룹은 자리를 차지하지 않고 (종전 80×30), 탭 항목이 없으면 탭 막대도 패널도 없으며 (종전 29px + 패널), 빈 목록·트리는 미리보기와 같은 빈 상태 여백 (16/24px) 을, 빈 표는 최소 높이 40px 을 따릅니다 (ADR-923 Codex round 21).
- 라벨을 비운 TagGroup 이 캔버스에서만 라벨 자리만큼 (4px) 더 높던 문제를 고쳤습니다 — 미리보기는 라벨이 비면 아예 그리지 않습니다. 설명·오류 문구도 같습니다.
- 표의 높이 모드 (고정/자동/화면 비율) 와 높이 값이 미리보기에 전혀 반영되지 않던 문제를 고쳤습니다 — 속성 패널이나 AI 로 바꾼 값이 이제 미리보기 표 높이에 그대로 적용되고 (자동 = 내용 높이), 캔버스와 같은 높이가 됩니다.
- 여백이나 최소 폭을 직접 지정한 글자 없는 버튼이 캔버스에서 미리보기보다 넓던 문제를 고쳤습니다 (여백 20 → 84px vs 68px, 여백 0·최소 폭 0 → 44px vs 2px).

## [빈 목록은 빈 만큼만 차지하고, 글자 없는 버튼·메뉴도 미리보기와 같은 상자를 가집니다] - 2026-09-02

### Fixed

- 항목을 모두 비운 ListBox/GridList 가 캔버스에서 예전 기본 항목 3개/4개 높이 (110/164px) 를 차지하던 문제를 고쳤습니다 — 미리보기처럼 여백과 테두리만 남습니다 (ADR-923 Codex round 20).
- 글자를 비운 Menu 단추가 캔버스에서 미리보기보다 넓고 높게 (106×30 vs 68×10) 그려지던 문제를 고쳤습니다 — 버튼 계열은 글자가 없으면 최소 폭과 여백만 차지하고, 짧은 글자 버튼도 이제 미리보기와 같은 최소 폭 (md 68px) 을 따릅니다.
- 글자 없는 Menu 단추가 스크린리더에 이름 없는 버튼으로 읽히던 문제를 고쳤습니다 — 사용자가 준 aria-label 이 단추에 닿고, 없으면 "Menu"/"메뉴" 를 이름으로 씁니다 (화면에는 표시되지 않음). 빌더가 만든 Menu 의 aria-label 과 legacy 미리보기 Button 의 aria-label 도 이제 전달됩니다.

## [Breadcrumbs 상자 폭이 실제 항목에 맞고, IllustratedMessage·Menu 글자를 비우면 미리보기도 비웁니다] - 2026-09-01

### Fixed

- Breadcrumbs 를 내용 맞춤(fit) 폭으로 두면 상자가 실제 항목이 아니라 예전 기본 항목 ("Home › Products › Detail") 폭으로 잡히던 문제를 고쳤습니다 — 항목을 바꾸거나 비워도 상자가 실제 내용에 맞습니다 (ADR-923 Codex round 19).
- IllustratedMessage 의 제목·설명을 비우면 캔버스는 그 줄을 접는데 미리보기는 "No content" 같은 기본 글자를 보이던 차이를 없앴습니다 — 두 화면 모두 그 줄을 접습니다 (값을 아예 넣지 않았을 때의 기본 글자는 그대로).
- Menu 버튼 글자를 비우면 미리보기가 다시 "Menu" 를 보이던 문제를 고쳤습니다.
- TagGroup 의 줄바꿈 계산이 라벨 없는 태그를 "Tag 1" 같은 글자 폭으로 재던 것을 화면에 실제로 보이는 글자 폭으로 바꿨습니다.

## [헤더·표 머리글·메뉴 글자를 비우면 미리보기도 비고, 예전 스냅샷 복원과 파일 가져오기도 보정을 거칩니다] - 2026-09-01

### Fixed

- Disclosure 헤더 · 표(Table) 열 머리글 · 트리 항목 · 메뉴 버튼의 글자를 속성 패널에서 비우면 캔버스는 비는데 미리보기는 "Section" · "Column" · "Item …" · "Menu" 같은 기본 글자를 보이던 차이를 없앴습니다 — 미리보기도 캔버스처럼 빈 채로 둡니다.
- Disclosure 의 속성 패널 Title 이 캔버스·미리보기 헤더에 반영되지 않던 문제를 고쳤습니다 (Card 의 Title 과 같은 방식으로 헤더 글자에 전달).
- 예전 스냅샷을 복원하거나 프로젝트 JSON 파일을 불러올 때 옛 문서 형태 보정 (ColorField 라벨 등) 을 건너뛰던 문제를 고쳤습니다 — 새로고침으로 여는 것과 같은 보정을 거칩니다.

## [라벨을 비우면 미리보기도 비고, 가져온 문서의 ColorField 도 라벨을 갖습니다] - 2026-09-01

### Fixed

- CheckboxGroup·RadioGroup·SearchField·ProgressBar·Meter·ComboBox·DatePicker 류의 Label 을 속성 패널에서 비우면 캔버스는 비는데 미리보기는 예전 글자 (또는 "Date Picker" 같은 기본 글자) 를 계속 보이던 문제를 고쳤습니다 — 미리보기가 캔버스와 같은 규칙 (값이 없을 때만 자식 라벨) 으로 읽습니다 (ADR-923 Codex round 17).
- 외부에서 가져온 (import) 문서의 옛 ColorField 가 미리보기에서 라벨 없이 보이던 문제를 고쳤습니다 — 가져온 문서도 열 때 같은 보정을 거칩니다.
- Disclosure 헤더 글자를 AI 가 `title` 속성에만 넣었을 때 미리보기만 그 글자를 보이던 차이를 없앴습니다 (캔버스와 같은 속성 `children` 을 읽습니다).

## [ColorField 의 라벨을 바꾸면 캔버스와 미리보기가 같은 글자를 보입니다] - 2026-09-01

### Fixed

- ColorField 의 Label 을 속성 패널 (또는 AI) 에서 바꾸면 미리보기만 바뀌고 캔버스는 "Color" 그대로였던 문제를 고쳤습니다 — 다른 입력 필드 (TextField·Select 등) 가 쓰는 부모→자식 라벨 전달 규칙이 ColorField 에만 없었습니다 (ADR-923 Codex round 16).
- 새로 추가한 ColorField 가 캔버스에는 "Color" 라벨을 보이면서 미리보기에는 라벨이 없던 문제를 고쳤습니다. 이미 만들어 둔 문서의 ColorField 도 열 때 자동으로 같은 라벨을 갖습니다.
- CheckboxGroup·RadioGroup 의 Label 을 속성 패널에서 바꿔도 캔버스·미리보기 어느 쪽에도 반영되지 않던 문제를 고쳤습니다 — 같은 전달 규칙을 추가했고, 미리보기는 그룹 라벨을 부모 값에서 먼저 읽습니다.
- 캔버스에서 요소를 더블클릭해 글자를 고칠 때, AI 가 표시되지 않는 속성 (`label` 등) 에만 글자를 넣어 둔 요소면 편집창에 캔버스·미리보기에 없는 글자가 뜨고 고쳐도 보이지 않던 문제를 고쳤습니다 — 편집창도 캔버스·미리보기와 같은 규칙으로 읽고 씁니다.

## [AI 가 만든 텍스트가 캔버스·미리보기·크기 계산에서 같은 글자를 보입니다] - 2026-09-01

### Fixed

- AI 어시스턴트가 요소를 만들거나 고칠 때 `label` 같은 다른 속성에 글자를 넣으면 캔버스만 그 글자를 그리고 미리보기·크기 계산은 `children` 을 읽어 서로 달랐던 문제를 고쳤습니다. 이제 요소 종류마다 어떤 속성이 표시 텍스트인지 한 곳에서 정하고 (기본 `children`, Text 류는 `children` → `text`, ListBox/GridList 항목과 Menu 는 `label` → `children`, 입력 필드는 `placeholder`), 캔버스·미리보기·크기 계산이 모두 같은 규칙을 씁니다 (ADR-923 Codex round 15).
- 미리보기의 FieldError 가 속성 패널에서 편집한 텍스트 (`children`) 를 무시하고 `text` 만 보이던 문제를 같은 규칙으로 고쳤습니다.
- 미리보기의 Tree 항목·Table 열 머리글·Disclosure 헤더가 캔버스는 읽지 않는 `title`/`label` 을 대신 보이던 차이를 없앴습니다 (실제 편집 경로가 쓰지 않는 속성 — AI 가 넣은 경우에만 해당).

### Changed

- AI 도구 설명에 표시 텍스트를 넣을 속성 (`children`) 을 명시했습니다.

## [Pencil 로 가져온 텍스트가 미리보기와 캔버스 양쪽에 보입니다] - 2026-09-01

### Fixed

- Pencil 에서 가져온 문서의 Text·Heading·Paragraph 가 미리보기에서 비어 있던 문제를 고쳤습니다 — Pencil 은 본문을 `text` 에 저장하는데 미리보기가 `children` 만 읽었습니다. 이제 캔버스·측정·미리보기가 같은 순서 (`children` → `text`) 로 읽습니다 (ADR-923 Codex round 14).
- 같은 날 앞선 수정 (round 13) 이 Pencil 본문과 목록 항목 (ListBox/GridList/Tree/Column) 의 `label` 을 캔버스에서 지우던 회귀를 되돌렸습니다.
- `white-space` 값에 앞뒤 공백이나 대문자가 있어도 (`" INHERIT "`) 키워드로 인식합니다.

## [텍스트의 줄바꿈 키워드·본문 원천·페이지 폭 제한이 미리보기와 같아집니다] - 2026-09-01

### Fixed

- 텍스트 요소에 `white-space: inherit`/`unset` 을 직접 지정하면 부모의 줄바꿈 설정을 무시하고 `normal` 처럼 배치되던 문제를 고쳤습니다 — 미리보기(Chrome) 처럼 부모 값을 따릅니다 (ADR-923 Codex round 13).
- Text·Heading·Paragraph·Description·Label·Kbd·Code 의 캔버스 폭·높이 측정과 Skia 렌더가 편집 표면에 없는 `label`/`text` prop 을 본문보다 먼저 읽어 미리보기와 다른 글자 폭이 실리던 문제를 고쳤습니다 — 본문 원천을 `children` 하나로 통일했고, 미리보기의 Description 도 같은 순서로 읽습니다.
- 페이지(root) 폭이 `auto` 이고 `min-width`/`max-width` 로 제한될 때 자식이 제한 전 폭으로 배치되던 문제를 고쳤습니다.

## [페이지 자동 배치가 화면 폭과 breakpoint를 반영합니다] - 2026-09-01

### Changed

- Settings의 Page Layout 선택지를 `Auto`·`Horizontal`·`Vertical`로 통일하고 기본값을 `Auto`로 설정했습니다. 기존 `zigzag` 값은 `Auto`로 읽습니다.
- `Auto` 정렬은 Canvas-local 폭에 좌·우 panel 폭, shell 여백, 양쪽 `Page Gap`을 더해 browser 전체 폭을 계산하고, 두 panel 사이의 page 영역을 기준으로 현재 zoom과 선택된 breakpoint의 page 폭이 panel과 겹치지 않도록 최대 page 수를 한 줄에 배치한 뒤 이후 page를 다음 줄로 넘깁니다.
- Settings의 Page Layout을 `Auto`·`Horizontal`·`Vertical` ToggleButtonGroup으로 바꾸고, Page Gap은 Transform의 Width와 같은 숫자 입력 셸 및 Layout Gap 아이콘을 재사용합니다. chevron 목록의 `S`·`M`·`L`은 입력값을 각각 `40`·`80`·`120`으로 교체하고 현재 값과 일치하는 항목만 check를 표시하며, preset 외 사용자값에는 check를 표시하지 않습니다. 기본값은 기존 `PAGE_STACK_GAP`과 같은 `80px`이며, 두 설정을 바꾸면 Canvas의 page 위치도 즉시 다시 정렬됩니다.
- Settings의 Theme Mode도 ToggleButtonGroup으로 통일하고, `Auto (System)` 표기는 `Auto`(한국어 locale은 `자동`)로 한 줄 표시합니다. UI Scale은 실제 값 `80`·`100`·`120`을 유지하면서 표시를 `S`·`M`·`L`로 표준화했습니다.
- Styles 패널의 Layout `Gap`·`Padding`·`Margin`과 Appearance `Border Width`·`Border Radius`를 같은 preset popover 패턴으로 통일했습니다. spacing은 `Reset`·`XS`·`S`·`M`·`L`·`XL`을 `--spacing-*` 토큰 기준으로, radius는 `--radius-*` 토큰 기준으로 제공하고 선택값은 `px`로 커밋하며 입력폼에는 숫자만 표시합니다. Reset과 대상 변경 시에도 현재 유효값으로 동기화하며, Border Width는 전용 토큰이 없어 `1px`·`2px`·`4px`·`8px`·`12px` 단계로 제공합니다. Page Gap을 포함한 preset 타입과 값 목록은 공용 property 계층의 단일 정본을 사용합니다.

## [빌더 패널의 빈 상태가 공통 패턴을 사용합니다] - 2026-09-01

### Fixed

- **DataTable·Navigator·Components·Styles·Properties·Interactions 등에서 빈 화면의 표현이 제각각이던 문제**: DataTable empty의 icon–text 구조를 공통 `EmptyState`로 승격해 아이콘, 메시지, 설명의 배치와 색상 토큰을 통일했습니다.
- **기존 패널별 empty CSS가 공통 컴포넌트와 분리되어 있던 문제**: 패널별 중복 스타일을 제거하고 도메인 아이콘만 각 화면이 주입하도록 정리했습니다. Canvas/Preview의 렌더링 empty 상태는 이번 범위에서 제외했습니다.

## [상속된 줄바꿈 설정과 최소·최대 높이 경계가 미리보기와 같아집니다] - 2026-09-01

### Fixed

- **부모에서 `white-space: pre` 를 물려받은, 공백만 있는 텍스트의 여백이 접히던 문제** (미리보기 60 / 캔버스 40): 줄 상자 신호가 요소 자신의 인라인 스타일만 보고 상속값을 버렸습니다. 이제 computed(상속) 값을 읽습니다. 배열·객체 children 이 쉼표나 `[object Object]` 로 바뀌어 줄 상자로 잡히던 것도 함께 고쳤습니다.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (`resolveTextLeafContent`, `enrichWithIntrinsicSize`)
- **높이가 자동인 상자의 `min-height: 50%` 가 폭 기준으로 풀려 아래 여백이 5px 어긋나던 문제** (미리보기 40 / 캔버스 35): CSS 에서 부모 높이가 정해지지 않은 percentage min-height 는 0 입니다. 세로 축 기준으로 풀도록 고쳤습니다.
- **`min-height` 가 `max-height` 보다 클 때 작은 쪽이 이기던 문제** (미리보기 30 / 캔버스 10): CSS 는 max 를 먼저, 그다음 min 을 적용합니다 (min 이 우선). 블록 상자·최상위 상자·grid 트랙 기여값 세 곳이 같은 순서 오류였습니다. 최상위 상자가 높이를 직접 정했을 때 min/max 를 건너뛰던 것도 고쳤습니다.
  - 위치: `packages/composition-engine/src/block.rs` (`clamp_size`), `packages/composition-engine/src/tree.rs` (`solve_block`, `fixup_root_self_size`, `track_contribution`)
- 검증: Chrome 차등 87/87 (68 케이스 + 게이트 19) · 렌더 parity 1023 회귀 0 · ADR-923 Phase 3 round 12 (evidence [923-phase3-differential.md](adr/evidence/923-phase3-differential.md))

## [공백만 있는 텍스트와 높이를 정한 상자의 아래 여백이 미리보기와 같아집니다] - 2026-09-01

### Fixed

- **내용이 공백뿐인 텍스트 요소의 위·아래 여백이 접히지 않고 그대로 남던 문제** (미리보기 40 / 캔버스 60):
  - **Why**: 엔진에 "줄 상자(line box) 가 있는가" 를 알려주는 신호를 원본 문자열이 비어 있는지로만 만들었습니다. CSS 는 `white-space: normal`/`nowrap` 에서 공백·탭·줄바꿈만 있는 내용을 줄 시작·끝에서 지우므로 줄 상자가 없고, 여백은 빈 상자처럼 접힙니다. `pre` 계열과 nbsp, `pre-line` 의 줄바꿈은 그대로 줄 상자가 됩니다.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (`textLeafRendersContent`)
- **높이를 직접 정한 상자 (`height: 50px`, `height: 0`) 안 마지막 자식의 아래 여백이 상자 밖으로 새어 다음 요소를 밀던 문제** (미리보기 50 / 캔버스 70): CSS 에서 부모와 마지막 자식의 아래 여백이 하나로 접히는 조건은 부모 높이가 `auto` 일 때뿐입니다. `min-height`/`max-height` 가 실제로 크기를 잡을 때도 (Chrome 기준) 여백은 상자 안에 남고, 잡지 않을 때는 종전처럼 접힙니다. `height: 0` 은 `auto` 가 아니므로 상자 높이도 0 (+`min-height`) 입니다.
  - 위치: `packages/composition-engine/src/tree.rs` (`solve_block`)
- 검증: Chrome 차등 75/75 (61 케이스 + 게이트 14) · 렌더 parity 1009 회귀 0 · ADR-923 Phase 3 round 11 (evidence [923-phase3-differential.md](adr/evidence/923-phase3-differential.md))

## [절대 위치 요소 드래그가 포인터를 즉시 따라갑니다] - 2026-09-01

### Fixed

- **Position을 Absolute로 바꾼 요소와 `Cmd + drag` 대상이 느리게 이동하던 문제**: 이전 retained drag 최적화가 같은 대상의 위치 변화에서 전체 command stream 재생성을 막았지만, 그 변화가 새 프레임을 표시해야 한다는 별도 신호도 없었습니다. 포인터 좌표는 정상 갱신되면서 Canvas는 대부분 idle frame으로 분류되어 화면만 드물게 표시됐습니다. drag offset 전용 presentation revision을 추가해 매 animation frame에 기존 retained picture의 translate만 다시 표시하고, registry와 content snapshot은 유지합니다.
- **Absolute 요소를 드래그할 때 선택 박스가 시작 위치에 남던 문제**: 선택 chrome의 표시 여부가 실제 drag 상태가 아니라 drop indicator 존재 여부를 사용했습니다. Absolute/manual drag는 drop target이 없을 수 있으므로 box·handle·치수 레이블이 원래 좌표에 남았습니다. 이제 drag visual presentation 상태를 직접 사용해 이동 중에는 selection chrome을 숨기고 종료 시 다시 표시합니다.
- **Absolute로 전환한 요소가 최상위 레이어로 이동하지 않던 문제**: Transform 패널에서 Absolute를 켜는 시점에 선택 요소를 canonical 형제 순서의 마지막으로 이동합니다. 스타일 변경과 레이어 순서 변경은 하나의 Undo 항목으로 기록하며, Absolute를 끌 때는 순서를 유지합니다.

### Tests

- 같은 delta 반복은 revision을 올리지 않고, 실제 target/delta 변화만 overlay frame을 갱신하며 registry/content invalidation으로 되돌아가지 않는 회귀 테스트를 추가했습니다. drop target이 없는 Absolute drag에서 selection chrome이 숨겨지는 계약과 Absolute 활성화 시 style·canonical front 이동이 단일 history transaction으로 실행되는 계약을 함께 고정했습니다.

## [여백 접힘 경계 4가지가 미리보기와 같아집니다] - 2026-09-01

### Fixed

- **높이를 `0` 으로 둔 텍스트 요소의 위·아래 여백이 하나로 접혀 다음 요소가 올라오던 문제** (미리보기 60 / 캔버스 40):
  - **Why**: 엔진은 텍스트를 직접 보지 못해 "줄 상자(line box) 가 있는가" 를 텍스트 측정 스칼라(`leafBaseline`) 로만 알 수 있는데, 그 스칼라는 flex/grid 자식이거나 폭이 자동일 때만 공급되고 높이·폭이 명시된 텍스트는 공급 전에 반환됐습니다. CSS 에서 내용이 있는 요소는 높이가 0 이어도 여백이 접히지 않습니다.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (`enrichWithIntrinsicSize`), `packages/composition-engine/src/tree.rs` (leaf 경로)
- **절대 위치(absolute) 자식만 가진 빈 상자의 여백이 접히지 않던 문제** (미리보기 40 / 캔버스 60): 흐름 밖 자식은 상자를 비우지 않는 것으로 잘못 세어졌습니다. 빈 상자 판정을 한 곳(자식 solve 플래그) 으로 모았습니다.
- **양수·음수 여백이 세 개 이상 만나면 접힌 값이 달라지던 문제** (미리보기 20 / 캔버스 35): 두 개씩 차례로 접으면 "가장 큰 양수 + 가장 작은 음수" 라는 CSS 규칙과 어긋납니다. 여백을 값이 아니라 (양수 최대, 음수 최소) 쌍으로 형제·빈 상자·부모 경계 전부에 넘기도록 바꿨습니다 (`block.rs` `MarginSet`).
- **음수 여백으로 상자 높이가 음수로 계산되던 문제** (미리보기 2 / 캔버스 −8): 자동 높이는 0 아래로 내려가지 않습니다. 같은 자리에서 "내용이 있어도 음수 여백 때문에 빈 상자로 오판" 하던 것도 함께 고쳤습니다 (미리보기 60 / 캔버스 40).
- 검증: Chrome 차등 56/56 (51 케이스 + 게이트 5) · 렌더 parity 990 회귀 0 · ADR-923 Phase 3 round 10 (evidence [923-phase3-differential.md](adr/evidence/923-phase3-differential.md))

## [요소 사이 여백과 '넘침 잘라내기' 가 미리보기와 같아집니다] - 2026-09-01

### Fixed

- **Overflow 를 `Clip` 으로 둔 flex 항목이 캔버스에서 미리보기보다 좁게 그려지던 문제**:
  - 스타일 패널에서 Overflow = Clip 을 고르면 캔버스의 항목이 내용 폭 아래로 줄어들었습니다 (미리보기는 내용 폭을 지킵니다).
  - **Why**: 엔진이 `clip` 을 `hidden` 과 같은 "스크롤 컨테이너" 로 분류해 flex 항목의 자동 최소 폭(내용 기반)을 0 으로 내렸습니다. CSS 에서 스크롤 컨테이너는 `scroll` / `auto` / `hidden` 뿐이고 `clip` 은 아닙니다. 판정 3곳(BFC · baseline · flex 최소 폭)이 각자 문자열을 비교하고 있어 하나만 어긋나 있었고, 한 술어로 합쳤습니다.
  - 위치: `packages/composition-engine/src/tree.rs` (`is_scrollable_overflow`), `flex.rs`
- **block 컨테이너 안 자식 여백(margin)이 캔버스에서 미리보기와 다르게 접히던 문제** (Chrome 실측 케이스 12건으로 확정):
  - 안쪽 여백(padding)이 있는 부모의 마지막 자식 bottom margin 이 부모 높이에 빠져 있었습니다 (미리보기 31 / 캔버스 11).
  - 내용이 없는 빈 block 의 위·아래 margin 이 하나로 접히지 않아 부모가 그만큼 더 높았습니다 (미리보기 10 / 캔버스 30).
  - flex 컨테이너(그리고 overflow 가 scroll/hidden 인 상자)의 **자기** margin 이 형제·부모와 접히지 않고 더해졌습니다.
  - block 요소 뒤에 오는 인라인 줄이 앞 요소의 bottom margin 을 무시하고 붙었습니다.
  - 높이를 `0` 으로 둔 빈 요소의 위·아래 margin 이 접히지 않아 다음 요소가 더 아래에 놓였습니다 (미리보기 40 / 캔버스 60).
  - **Why**: 엔진 block 솔버의 "빈 block" 분류를 만들어 내는 자리가 없어 (단위 테스트에서만 살아 있었음) 모든 자식이 일반 block 으로 흘렀고, 컨테이너 높이는 마지막 margin 이 부모 밖으로 빠지는지·안에 남는지를 구분하지 못한 채 자식 사각형의 합으로 계산됐습니다. BFC 상자의 margin 차단은 "자기 자식과" 만이어야 하는데 자기 margin 까지 막았습니다. CSS 2.1 §8.3.1 / §10.6.3 대로 정리했습니다.
  - 위치: `packages/composition-engine/src/block.rs`, `tree.rs` (`write_block_item` self-collapsing 분류, `solve_block` auto height)
- 검증: Chrome 차등 44/44 · 렌더 parity 978 회귀 0 · ADR-923 Phase 3 (evidence [923-phase3-differential.md](adr/evidence/923-phase3-differential.md))
