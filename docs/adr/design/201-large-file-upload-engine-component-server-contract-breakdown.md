# ADR-201 Breakdown: 대용량 파일 업로드 — 독립 전송 엔진 + FileUpload 컴포넌트 + Spring 서버 계약

> 2026-09-02 초안. ADR 본문: [201-large-file-upload-engine-component-server-contract.md](../201-large-file-upload-engine-component-server-contract.md).
> Phase 0 inventory 는 본 문서의 표를 갱신하는 commit 으로 freeze 한다 (M3 — 추정/실측 gap 은 inventory 보강이지 fork 사유가 아님).

## 1. 전제 lock-in (fork 아님 — 완전 신규 주제)

- 본 ADR 은 기존 ADR 의 분리/fork 가 아니다. `grep -rliE 'file ?upload|파일 업로드|\btus\b|resumable upload' docs/adr .claude/rules` 실측 (2026-09-02) — 선행 결정 0건. hit 3건은 전부 부수 언급: ADR-007 (`:933` export JSON 10MB DoS 차단 / `:1133` 프로젝트 파일 업로드 aria-label), ADR-030 (`:136` FileTrigger 를 S2 Inputs 목록에 등재), ADR-014 (`:261` 폰트 파일 업로드 버튼 교체).
- **사용자 확정 4건 (2026-09-01, 메모리 `project-file-upload-component-target-environment`)**: ① `docs/explanation/research/FILE_UPLOAD.md` 의 라이브러리 (Uppy/tus-js-client/FilePond) 를 그대로 쓰지 않고 자체 구현 ② 파일 크기 GB 단위 ③ 업로드 대상은 대다수 비-Cloud, 초기 고객 = Apache/Tomcat + Oracle DB + Spring 기반 Java (Java 8 + Spring 5 하한) ④ 전송 엔진은 composition 밖에서도 쓰는 독립 package + 서버 계약 문서와 Spring 참조 구현 **둘 다** 포함.
- 의존 방향: `@composition/upload` (신규, 최하층 — shared/specs/react 미의존) ← `@composition/shared` (FileUpload 렌더러) ← builder/publish. ADR-158 (interaction rules) 은 base — 본 ADR 은 `CAPABILITY_REGISTRY` 에 RAC 실존 이벤트만 등재하는 consumer. ADR-152/157/159 (dataBinding) 와는 직교 — 업로드는 dataBinding 을 쓰지 않고 `ApiEndpoint` 타입만 재사용.
- SSOT 경계: D1 = RAC `DropZone` + `FileTrigger` + `GridList` (기존 binding 재사용, ARIA 신규 0) / D2 = RAC prop 명 + tus-js-client·Uppy 옵션 명 참조 (RSP·S2 에 FileUpload 부재) / D3 = catalog rule `FileUpload` + 자식 DropZone/ProgressBar rule 재사용. 전송 엔진은 D1/D2/D3 어디에도 속하지 않는 **런타임 층** (canonical document 밖 — publish `InteractionRuntime` override 층 동형). 경계 변경 없음.
- Rust/wasm 코어 기각 (ADR §대안 D) 의 **재개 조건**: 브라우저 탭 수명을 넘는 네이티브 데스크톱 업로드 에이전트가 로드맵에 확정될 때. 2026-09-02 실측 — electron 의존 0 · `apps/desktop` 부재 (ADR-134 Phase 9 이관 기록과 동일).

## 2. Current Baseline (2026-09-01~02 실측, HEAD `b06ddd643` → **2026-09-17 Phase 0 재grep으로 freeze, HEAD `5b2346c12`**)

> Phase 0 재grep 결과 (2026-09-17): 사실 관계는 전부 유지 (XHR 0건 · `selectedFiles` write 1곳 · capability 미등재 · 전송 런타임 0). 줄 번호와 3건의 실체가 바뀌었다 — ① `InteractionAction` 에 `SetStateAction` 이 추가돼 4종 ② `ApiEndpoint` 의 실제 타입명은 `ApiEndpointDefinition` (`id` 포함, `headers` 는 `ApiEndpointHeader[] | Record`) ③ builder 의 cloud SDK 의존은 2026-09-12 로컬 라이선스 인증 전환으로 제거되어 0건. 아래 표는 그 재측정 값이다.

| 항목                | 실측                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 입력 UI             | `FileTrigger` (RAC, family①, `componentCatalog.ts:205`) · `DropZone` (internal `renderer:"dropzone"`, family⑥, `:995`) — catalog 등록 + `PALETTE_ORDER` 노출 (`paletteItems.ts:244-245`) + oracle (`paletteOracle.ts:286/292`). `acceptDirectory` 폴더 선택 prop 기존 (`FileTrigger.binding.ts:58`)                                                                                                                                              |
| 진행률 UI           | `ProgressBar` compound (factory `DisplayComponents.ts:210 createProgressBarDefinition` — Label+Value+Track 3 자식, DOM/Skia 대칭 확립, `ProgressBar.binding.ts`). catalog `componentCatalog.ts:613`                                                                                                                                                                                                                                              |
| 전송 런타임         | **0건**. `renderFileTrigger` (`packages/shared/src/renderers/FormRenderers.tsx:1047`) 는 파일 **이름만** `selectedFiles` prop 에 `updateElementProps` 로 기록 (`:1089`, 소비처 = 이 1곳뿐) — 런타임 상태를 문서 채널에 쓰는 잘못된 경로. `renderDropZone` (`:1106`) 은 `onDrop` 을 `createEventHandlerMap` 에 위임                                                                                                                               |
| 이벤트 어휘         | `CAPABILITY_REGISTRY` (`packages/shared/src/interactions/capabilityRegistry.ts`) 에 DropZone/FileTrigger **미등재** → 규칙 0. `InteractionAction = NavigateAction \| ToastAction \| CapabilityAction \| SetStateAction` (`interactionRule.types.ts:64`, 4종) — 업로드/HTTP 액션 없음                                                                                                                                                             |
| XHR/업로드 진행률   | `XMLHttpRequest` · `upload.onprogress` 사용 **0건** (apps/builder · apps/publish · packages/shared)                                                                                                                                                                                                                                                                                                                                              |
| 스토리지            | Cloud Storage (`storage.from` / `/storage/v1`) 사용 0건. builder 의 cloud SDK 의존은 **제거됨** (2026-09-12 로컬 라이선스 인증 전환) — builder/publish 모두 0건                                                                                                                                                                                                                                                                                  |
| endpoint/인증 설정  | `ApiEndpointDefinition { id, name, baseUrl, path, method?, headers?: ApiEndpointHeader[] \| Record<string,string>, queryParams?, bodyType? … }` (`packages/shared/src/types/collection.types.ts:104`, header 타입 `:95`) — Data 패널 API source. 재사용 대상                                                                                                                                                                                     |
| publish 배포 형태   | 정적 앱 + `/project.json` 로드 (`apps/publish/src/App.tsx:377`) → Tomcat webapp 정적 리소스로 동봉 가능 (same-origin). 문서 안 값은 전부 공개. 런타임 override 층 `apps/publish/src/renderer/InteractionRuntime.tsx:132` (`updateElementProps: patchOverride`)                                                                                                                                                                                   |
| package 선례        | `@composition/specs` — tsup esm/cjs + `exports` 서브 entry + `files: dist`, `private` 아님, react optional peer (`packages/specs/package.json`). `@composition/sample-data` — 의존 0 workspace package + `boundary.static.test.ts` 역방향 import 게이트 (ADR-220). `@composition/shared` 는 `private: true` + src export. `packages/engine` 은 Rust crate → `wasm-pack` 산출 (gitignored) 을 builder 가 소비                                     |
| 등록 지점           | catalog entry `componentCatalog.ts` `primitiveEntry` · binding `bindings/*.binding.ts` · rule `generated/componentRulesTable.ts` · `paletteItems.ts:184` `PALETTE_ORDER` (+ `paletteOracle.ts`) · factory `factories/definitions/` · defaults `apps/builder/src/types/builder/unified.types.ts` + `defaultPropsDerivation.ts` · rendererMap `packages/shared/src/renderers/index.ts` · publish `apps/publish/src/registry/ComponentRegistry.tsx` |
| CI ratchet          | `factories/__tests__/componentRegistrationContract.test.ts:131` `BASELINE_RATCHET = {rendererMap:0, TAG_SPEC_MAP:0, getDefaultProps:0}`                                                                                                                                                                                                                                                                                                          |
| 번들 규칙           | `CLAUDE.md` 초기 번들 <500KB · `component-design/SKILL.md` 외부 라이브러리 추가 금지 · `perf-dynamic-imports` 규칙 · initial 번들 상한 정본 = ADR-202 (Builder ≤1,319,829 / Preview ≤592,000)                                                                                                                                                                                                                                                    |
| 관련 방침           | `DATA_PANEL.md §13.4` Oracle 직접 연결 금지 — Backend API 경유. 메모리 `project-publish-link-only-defer-until-builder-stable` (publish 는 기능 링크만 — live 는 preview 우선)                                                                                                                                                                                                                                                                    |
| 엔진 크기 (Phase 1) | `@composition/upload` 측정값은 §2-1 표 (Phase 1 종료 시 기록)                                                                                                                                                                                                                                                                                                                                                                                    |

### 2-1. `@composition/upload` 측정 (Phase 1 — G1, 2026-09-17)

측정 조건: Chromium 151.0.7922.34 (Playwright, headless, `visibilityState: visible`), macOS arm64, mock TUS 서버 (Node http, localhost, stream 커밋), 파일은 디스크 sparse (`mkfile -n`) 를 `<input type=file>` 에 setInputFiles — 실제 `File`. 힙은 CDP `Runtime.getHeapUsage` (`performance.memory` 는 10MB 양자화라 보조). 재현 `packages/upload-engine/scripts/live.mjs g0|heap|resume`, 결과 `scripts/results/*.json`.

| 항목                       | 측정값                                                                                                                                                                                  | 조건                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0 first-nail (100MB, XHR) | 진행률 15 이벤트 (단조) · 단절 2회 → HEAD 재개 (50.14MB / 75.08MB) · 재전송 합 8MB · 완료                                                                                               | 소켓 reset (Chromium 자동 재시도 → 409 → HEAD) + 서버 400ms 다운 (E_NETWORK → backoff → HEAD)                                                                                                              |
| core+tus (초기 청크, gzip) | **5,852 B** (상한 6,144)                                                                                                                                                                | `createUploadQueue` 소비자 번들, esbuild minify + splitting, entry + 정적 import 청크 폐쇄                                                                                                                 |
| 지연 청크 (gzip)           | dry-run 666 B · fetch 451 B · multipart 470 B                                                                                                                                           | 옵션이 켜질 때만 `import()`                                                                                                                                                                                |
| react entry (초기, gzip)   | 6,064 B                                                                                                                                                                                 | `useUploadQueue` 포함                                                                                                                                                                                      |
| IIFE (`./vanilla`, gzip)   | **8,068 B** (상한 10,240)                                                                                                                                                               | 지연 청크까지 전부 inline                                                                                                                                                                                  |
| 4GB 힙 Δ (3회 중앙값)      | peak Δ **2.22 MB** (2.20 / 2.28 / 2.22) · GC 후 Δ 1.02 MB                                                                                                                               | 4GB × 3 파일 parallel 3 (12GB, 11.4s ≈ 1.08 GB/s), dryRun 아님, 처녀 힙 = 새 컨텍스트, 상한 64MB                                                                                                           |
| 재개 3경로 재전송 바이트   | 네트워크 단절 **4.06 MB** · 새로고침 **0** · 탭 종료 **0** — 전부 ≤ chunkSize 8MB, creation 1회                                                                                         | 256MB, 100MB 지점에서 단절/reload/close, localStorage 값에 파일명 0 확인                                                                                                                                   |
| 적합성 스위트              | 79 PASS (mock 31 · 공격 corpus 18 · 상태기계 22 · 에러 표 4 · 경계 3 · 크기 1)                                                                                                          | `pnpm -F @composition/upload test`                                                                                                                                                                         |
| tusd 대조군                | **v2.10.1 darwin-arm64 8/8 PASS** — 생성/완료/내용 · 저장소 재개 · 409 (HEAD 경로) · cancel DELETE + 404→E_EXPIRED 재생성 · Tus-Max-Size 선차단 · traversal 이름 원문 보존 · parallel 3 | tusd 는 `checksum` 미광고 → 클라이언트가 헤더를 싣지 않음 · 409 에 `Upload-Offset` 없음 · `.info` Offset 미갱신 (파일 크기가 진실) — 발견 결함 1건 수리: `Number(null)=0` 으로 offset 0 오인 (`headerInt`) |

### Phase 0 재grep (착수 직전 필수)

```bash
rg -n "XMLHttpRequest|upload\.onprogress" apps/builder/src apps/publish/src packages/shared/src   # 0 유지 확인
rg -n "selectedFiles" packages/shared/src apps/builder/src                                          # 잘못된 채널 소비처 전수
rg -n "DropZone|FileTrigger" packages/shared/src/interactions/capabilityRegistry.ts                 # 등재 여부
rg -n "ApiEndpoint" packages/shared/src apps/builder/src --glob '!*.test.*' -l                       # 재사용 타입 소비처
rg -n "primitiveEntry\(\"(DropZone|FileTrigger|ProgressBar)\"" packages/shared/src/catalog/componentCatalog.ts
ls packages/specs/package.json && rg -n "\"exports\"|tsup" packages/specs/package.json              # package 선례 형태
```

## 3. 시스템 설계

### 3-1. 패키지 구조·의존 방향

```
packages/upload-engine/            @composition/upload  (runtime dependency 0)
  src/core/protocol/               sans-I/O 상태기계 — (state, event) → (state, commands[])   ← 훗날 Rust 이식 대상
  src/core/drivers/                XhrDriver(브라우저) · FetchDriver(Node/Electron) · StorageDriver(localStorage 재개 정보)
  src/core/queue.ts                동시 N · pause/resume/cancel · 지수 backoff · 폴더 트리 평탄화
  src/adapters/tus.ts              TUS 1.0 core+creation+expiration (+checksum/termination/concatenation 감지)
  src/adapters/cloud.ts         tus + chunk 6MB clamp + `x-upsert`
  src/adapters/multipart.ts        FormData POST fallback (재개 없음, 소용량)
  src/react/                       useUploadQueue · useUploadItem            (react = optional peer, `./react` entry)
  src/vanilla/                     CompositionUpload.create(el, opts) — headless 바인딩 + 최소 DOM (`./vanilla`, IIFE)
```

- `package.json`: `@composition/specs` 동형 — tsup `esm,cjs` + `iife --global-name CompositionUpload` + `--dts`, `exports` `.`/`./react`/`./vanilla`, `files: dist`, `private` 아님.
- 의존 방향 `upload ← shared ← builder/publish` 단방향. `packages/upload-engine` 안에서 `@composition/*`·`react-aria-components` import 는 eslint `no-restricted-imports` 로 차단 (react 는 `src/react/**` 한정 허용).
- shared 의 `FileUploadRenderer` 는 `import("@composition/upload/react")` lazy — 첫 파일 선택 시 chunk. builder 초기 chunk Δ 0.

### 3-2. sans-I/O 코어 계약

```ts
type UploadState = { id; fingerprint; size; offset; url?; status: "queued"|"creating"|"uploading"|"paused"|"done"|"error"; attempt; lastError? }
type UploadEvent = { kind: "start" } | { kind: "created"; url } | { kind: "chunk-sent"; bytes } | { kind: "offset"; offset } | { kind: "fail"; status?; retryable } | { kind: "pause" } | { kind: "resume" } | { kind: "cancel" }
type Command     = { kind: "http"; method; url; headers; body?: { file; start; end } } | { kind: "persist"; fingerprint; url } | { kind: "forget"; fingerprint } | { kind: "wait"; ms } | { kind: "emit"; ... }
reduce(state, event): [UploadState, Command[]]   // 순수 함수 — 브라우저 API 0
```

- driver 는 `Command` 를 실행하고 결과를 `UploadEvent` 로 되돌린다. XhrDriver 만 `File.slice(start,end)` 를 body 로 넘긴다 (전체 읽기 0). 진행률은 `xhr.upload.onprogress` → `chunk-sent`.
- 재개: fingerprint = `sha256(name|size|lastModified|endpoint)` (파일명 평문 저장 0) → StorageDriver 에 `url` 만. 재개 시 `HEAD` → `Upload-Offset` 이 진실 (클라이언트 카운터 무시). 완료·만료·거부 시 `forget`.
- 상태기계 적합성 스위트 = mock TUS 서버 (Node `http`, 외부 의존 0) 대상 시나리오 corpus. Rust 이식 시 같은 corpus 로 대조 (ADR-916 golden 방식 동형).

### 3-3. TUS 어댑터·서버 계약 요약 (정본: `docs/reference/upload/server-contract.md`)

| 항목        | 계약                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 버전        | `Tus-Resumable: 1.0.0`. 필수 확장 `creation`, `expiration`. 선택 `checksum`(sha1/sha256), `termination`, `concatenation` — `OPTIONS` 의 `Tus-Extension` 으로 감지 후 활성    |
| 생성        | `POST {endpoint}` + `Upload-Length` + `Upload-Metadata`(`filename`, `filetype`, `relativePath` base64) → `201 Location: /upload/{uuid}`. `Upload-Defer-Length` **비허용**    |
| 전송        | `PATCH {url}` `Content-Type: application/offset+octet-stream` + `Upload-Offset` → `204 Upload-Offset`. 불일치 `409`. PATCH 차단 환경: `POST + X-HTTP-Method-Override: PATCH` |
| 재개        | `HEAD {url}` → `Upload-Offset`, `Upload-Length`, `Upload-Expires`                                                                                                            |
| 청크        | 기본 8MB (Apache `Timeout` 60s 회선 안전), 어댑터 clamp (Cloud 6MB 고정). `chunkSize: Infinity` = 단일 PATCH 스트리밍 (실패 시 offset 재개)                                  |
| 인증        | 쿠키 세션 (`withCredentials`) 기본 + `ApiEndpoint.headers` 정적 헤더 + 런타임 `getHeaders()` provider (CSRF 토큰 등 동적 값). 문서에 비밀 저장 **금지**                      |
| 보안 의무   | §3-6                                                                                                                                                                         |
| 호환 대조군 | tusd (Go 레퍼런스 서버) 에 동일 스위트 PASS — 계약이 "우리 참조 서버에만 맞는 방언" 이 되는 것을 차단                                                                        |

### 3-4. `FileUpload` compound — 등록 8지점 + capability

| 지점          | 내용                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| catalog entry | `primitiveEntry("FileUpload", "forms", …)` category forms, icon `CloudUpload`. source `kind:"internal"`, `renderer:"fileupload"`                                                                                                                                                   |
| binding       | `FileUpload.binding.ts` — accepts: `endpoint`(ApiEndpoint ref) · `protocol`(enum tus/cloud/multipart) · `chunkSize` · `parallelUploads` · `maxFileSize` · `acceptedFileTypes` · `allowsMultiple` · `acceptDirectory` · `autoUpload` · `retryDelays` · `showPreview` · `isDisabled` |
| rule          | `COMPONENT_RULES_TABLE.FileUpload` — 컨테이너 shell (fill 투명·gap) 만. 자식 시각은 DropZone/Button/ProgressBar 기존 rule. 신규 시각 채널 0 → Generator 확장 불필요                                                                                                                |
| factory       | `createFileUploadDefinition` — DropZone(label/description) + FileTrigger>Button("파일 선택") + FileList(GridList, 샘플 행 2) + 행 내부 ProgressBar 자식 자동 생성                                                                                                                  |
| defaults      | `deriveDefaultPropsFromCatalog` + `ENTRY_DERIVED_DEFAULT_TYPES` 등록, `entryUniverse` facet + INVENTORY 카운트 갱신                                                                                                                                                                |
| rendererMap   | `renderFileUpload` (preview·publish 공용) — 런타임 상태는 `useUploadQueue` 내부, 문서 write 0. 기존 `renderFileTrigger` 의 `selectedFiles` 문서 write 제거                                                                                                                         |
| PALETTE_ORDER | forms 그룹에 `FileUpload` 추가 + `paletteOracle.ts` 항목                                                                                                                                                                                                                           |
| publish       | `ComponentRegistry.tsx` 등록                                                                                                                                                                                                                                                       |
| Skia          | `buildCatalogShapes` generic box shell + 자식 노드 (DropZone dashed box · Button · GridList 샘플 행 · ProgressBarTrack value_fill_bar) — **디자인 타임 정적 합성만**, 엔진 import 0                                                                                                |
| capability    | `CAPABILITY_REGISTRY.FileTrigger.events = ["onSelect"]`, `DropZone.events = ["onDrop"]` (RAC 실존 — G1 충족). 커스텀 완료/오류 이벤트는 v1 미등재 (ADR §R2)                                                                                                                        |
| preview 안전  | preview 기본 = mock endpoint (dry-run, 바이트 미전송), 실서버는 Data 패널 `useMockData` 동형 토글                                                                                                                                                                                  |

### 3-5. Spring 참조 구현 (`examples/upload-server-spring/`)

- Maven · Java 8 · Spring MVC 5.3 · servlet 3.1 · Tomcat 9 (Boot 비의존, 전자정부 표준프레임워크 호환 가능한 API 만). pnpm/turbo 대상 제외 (`pnpm-workspace.yaml` 미포함), 별도 CI job (`mvn -q test`, JDK 8).
- 변형 2종: ① `TusController` — jar 무의존, `request.getInputStream()` → `RandomAccessFile.seek(offset)` 1회 쓰기, `@RequestMapping(method = PATCH)` + `X-HTTP-Method-Override` 필터 ② `tus-java-server` 라이브러리 위임 변형 (선택).
- 저장: 파일 바이트 = 웹루트 밖 디렉터리 (webapp 내부면 기동 실패), 저장명 UUID. 메타 = Oracle `UPLOAD_SESSION(id, owner_id, file_name, file_type, total_size NUMBER, upload_offset NUMBER, storage_path, status, created_at, expires_at)`; offset 갱신 `MERGE` + `SELECT … FOR UPDATE` 로 PATCH 직렬화. 개발 프로파일은 H2 (Oracle 모드).
- 완료 후 상태 `SCANNING → APPROVED|REJECTED` 훅 (AV 스캔 연동 지점, 참조 구현은 no-op 스캐너).
- `examples/upload-client-jsp/` — IIFE `<script>` 1줄로 위 서버에 업로드하는 JSP 1장 (JSTL, CSRF meta 태그 → `getHeaders()`).

### 3-6. 보안 계약 (ADR §R3 — `server-contract.md §Security` 의무 조항)

| 층          | 의무                                                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 클라이언트  | 문서/`ApiEndpoint` 에 정적 비밀 0 (정적 게이트) · localStorage 에 파일명·내용 0 (fingerprint 해시 + url 만, 완료 시 삭제) · 파일명은 `textContent`/React escape · 미리보기는 `<img>` + 크기 상한, SVG/HTML 제외 · `Allow-Origin:*`+credentials 거부 |
| 프로토콜    | `Upload-Metadata` 디코드 후 경로 검증 (`..`·절대경로·널바이트·CRLF·NFC 정규화·Windows 예약명·길이) · `Tus-Max-Size` · `Upload-Defer-Length` 비허용 · upload id UUIDv4 + 소유자 바인딩 (HEAD/PATCH/DELETE 마다) · offset 불일치 409 · TLS 필수       |
| 서버        | 웹루트 밖 저장 + 서버 생성 파일명 · 확장자 화이트리스트 + 매직바이트 · 격리→스캔→승인 · 압축 미해제 · 다운로드 `attachment`+`nosniff` · quota/동시 수/TTL GC · prepared statement · 감사 로그 (CRLF 제거)                                           |
| 공격 corpus | traversal 파일명 12종 · `Upload-Length` 초과 · offset 불일치 · 타인 upload URL · metadata 널바이트 · CSRF 토큰 없는 PATCH — mock 서버 + 참조 서버 양쪽에서 전부 거부                                                                                |

## 4. Phase

| Phase | 내용                                                                                                                                                                                          | 산출물·검증                 |
| :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
|   0   | inventory freeze (§2 재grep) + mock TUS 서버 (Node `http`) + **first-nail**: XhrDriver 로 100MB 파일 1개 진행률 수신 + 강제 단절 후 HEAD offset 재개 1케이스                                  | G0                          |
|   1   | `@composition/upload` core (상태기계·queue·drivers) + tus 어댑터 + package 빌드 (esm/cjs/iife) + 적합성 스위트 + 공격 corpus (클라이언트 측) + 힙·재전송·크기 측정                            | G1                          |
|   2   | `server-contract.md` + `examples/upload-server-spring/` (변형 ① 필수, ② 선택) + `examples/upload-client-jsp/` + 참조 서버·tusd e2e                                                            | G2 · G4 (서버 측)           |
|   3   | composition `FileUpload` compound — 등록 8지점 · capability 등재 · `renderFileTrigger` selectedFiles 문서 write 제거 · Skia 정적 합성 · preview mock 토글 · `/cross-check` · 정적 비밀 게이트 | G3 · G4 (클라이언트 측)     |
|   4   | live exercise — preview 에서 ≥1GB 실파일 업로드·중단·재개 (참조 서버 대상) + JSP 예제 동일 시나리오 + CHANGELOG + README                                                                      | G5 · `### Live Exercise` 절 |

Phase 1 → 2 는 순차 (계약이 클라이언트 적합성 스위트에서 굳은 뒤 서버 작성). Phase 3 은 Phase 1 완료 후 Phase 2 와 병렬 가능.

## 5. 검증 체크리스트

- [ ] `packages/upload-engine` runtime dependency 0 · `@composition/*`/`react-aria-components` import 0 (eslint) · react 는 `src/react/**` 한정
- [ ] core+tus ≤ 6KB gz · IIFE ≤ 10KB gz · builder 초기 chunk Δ 0 · publish 초기 Δ ≤ +2KB gz (baseline = 같은 디렉터리 detached checkout — 메모리 `reference-bundle-delta-baseline-build-detached-checkout`)
- [ ] 4GB 합성 파일 업로드 중 JS 힙 Δ ≤ 64MB (Chrome Task Manager / `performance.memory`, 3회 중앙값)
- [ ] 단절·새로고침·탭 종료 3경로 재개 시 재전송 ≤ chunkSize
- [ ] mock 서버 적합성 스위트 + 공격 corpus 전부 PASS · tusd 대조군 동일 PASS
- [ ] 참조 서버: 1GB 업로드→중단→재개, override 모드, 소유자 403, TTL GC, webroot 저장 기동 거부, CSRF 없는 PATCH 403
- [ ] 등록 8지점 + `componentRegistrationContract.test.ts` ratchet 0/0/0 + `paletteOracle` + `entryUniverseContract` INVENTORY
- [ ] `CAPABILITY_REGISTRY` DropZone/FileTrigger 등재 (RAC 실존 이벤트만) + `capabilityRegistry.test.ts` G1 PASS
- [ ] `selectedFiles` 문서 write 0 (grep)
- [ ] `/cross-check` FileUpload 샘플 상태 Skia↔DOM bbox Δ ≤ 1px
- [ ] 문서/`ApiEndpoint` 비밀 패턴 정적 게이트 PASS
- [ ] `pnpm type-check` 0 · `mvn -q test` PASS (JDK 8)
- [ ] live: preview ≥1GB 실파일 + JSP 예제 — Chrome MCP 또는 사용자 confirm 구분 기재

## 6. 위험 대응 매핑 (ADR §Risks ↔ Phase)

| Risk | Phase | 대응 지점                                                                                        |
| ---- | :---: | ------------------------------------------------------------------------------------------------ |
| R1   | 1·2·4 | OPTIONS 사전 점검 + 에러 코드 표 + override 모드 + 계약서 knob 표 (Apache/Tomcat/Spring) — G2/G5 |
| R2   |   3   | RAC 실존 이벤트만 등재, 완료/오류는 컴포넌트 내부 표시 — 커스텀 이벤트는 ADR-158 예외 절차 후속  |
| R3   |  2·3  | §3-6 의무 조항 + 공격 corpus + 정적 비밀 게이트 — G4                                             |
| R4   |   1   | 힙 측정 3회 중앙값 + 미리보기 크기 상한 + 청크별 checksum 만 — G1                                |
| R5   |  2·3  | `getHeaders()` provider + 쿠키 기본 + JSP 예제 CSRF meta                                         |
| R6   |   2   | examples 별도 CI job (JDK 8) — 계약 버전 = package 버전                                          |
| R7   |   3   | 대칭 정의 = 디자인 타임 샘플 상태 1종 (ADR-157 샘플 정책 동형)                                   |
| R8   |   3   | oracle + ratchet + INVENTORY freeze                                                              |

## 7. 비스코프 (후속 판정)

- `s3-multipart` 어댑터 (고객 백엔드 presign) · `chunked`(resumable.js 호환) 어댑터 — 고객 요구 발생 시 어댑터 1개 추가 (코어 무변경).
- 커스텀 이벤트 (`onUploadComplete`/`onUploadError`) 의 interaction rule 등재 — ADR-158 internal-source 예외 절차.
- 압축 전송·전체 파일 해시 — GB 규모에서 비현실적 (§3-6 압축 미해제 원칙과 정합).
- 네이티브 데스크톱 에이전트 + Rust 코어 — §1 재개 조건.
- 다운로드(이어받기) 컴포넌트 — 별도 ADR.
