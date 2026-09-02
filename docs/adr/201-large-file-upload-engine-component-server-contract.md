# ADR-201: 대용량 파일 업로드 — 독립 전송 엔진 + FileUpload 컴포넌트 + Spring 서버 계약

## Status

Proposed — 2026-09-02

> 출처: 2026-09-01 사용자 요청 — [FILE_UPLOAD.md](../explanation/research/FILE_UPLOAD.md) (RAON K Upload 유사 오픈소스 5종 비교) 검토 후 라이브러리를 그대로 쓰지 않고 composition 컴포넌트로 자체 구현하기로 결정. 사용자 확정 전제 4건 (GB 단위 파일 · 업로드 대상 대다수 비-Supabase · 초기 고객 Java 8 + Spring 5 + Tomcat + Oracle · 엔진은 독립 package + 서버 계약·Spring 참조 구현 둘 다) 은 [breakdown §1](design/201-large-file-upload-engine-component-server-contract-breakdown.md) 에 lock-in. 완전 신규 주제 (fork 아님 — 선행 결정 0건 실측).

## Context

**SSOT 3-domain 위치**: D1 = **RAC `DropZone` + `FileTrigger` + `GridList`** (기존 binding 재사용, ARIA 신규 작성 0) / D2 = **RAC prop 명 + tus-js-client·Uppy 옵션 명 참조** (`endpoint`/`chunkSize`/`retryDelays`/`parallelUploads` — RSP v3·S2 에 FileUpload 가 없어 업계 표준 클라이언트의 옵션 명을 참조 원천으로 둔다) / D3 = **catalog `COMPONENT_RULES_TABLE.FileUpload` 컨테이너 shell + 자식 DropZone/ProgressBar 기존 rule**. 전송 엔진은 D1/D2/D3 어디에도 속하지 않는 **런타임 층** — canonical document 밖에서 동작하며 publish `InteractionRuntime` override 층과 동형 (문서 편집이 아니라 런타임 동작). 경계 교차 없음. **Generator 확인 (선차단 #2)**: 신규 시각 채널 0 — 기존 rule 채널만 소비하므로 generate-css 확장 불필요.

### 문제 — 입력 UI 는 있고 전송이 없다

2026-09-01~02 실측 (breakdown §2, HEAD `b06ddd643`):

- `FileTrigger`(RAC) · `DropZone`(internal) 은 catalog 등록 + palette 노출 (`paletteItems.ts:231-232`) 상태이고 `acceptDirectory` 폴더 선택까지 prop 으로 있다. `ProgressBar` compound 는 DOM/Skia 대칭이 확립돼 있다.
- **전송 런타임 0건** — `renderFileTrigger` (`packages/shared/src/renderers/FormRenderers.tsx:1037`) 는 파일 **이름만** `selectedFiles` prop 에 `updateElementProps` 로 기록한다 (런타임 상태를 문서 채널에 쓰는 잘못된 경로). `renderDropZone` (`:1078`) 의 `onDrop` 은 `createEventHandlerMap` 에 위임되지만 `CAPABILITY_REGISTRY` 에 DropZone/FileTrigger 가 **미등재**라 규칙을 걸 수 없고, `InteractionAction` 은 `navigate | toast | capability` 3종 (`interactionRule.types.ts:47`) — 업로드/HTTP 액션이 없다.
- `XMLHttpRequest`·`upload.onprogress` 사용 0건, Supabase Storage 사용 0건, `@supabase/supabase-js` 는 builder 에만 있고 publish 앱에는 없다.
- 문서의 결론 "Uppy + tus 서버" 는 라이브러리 채택 안이다. Uppy core + Dashboard + Tus 플러그인은 100KB+ gz (추정) 이고 UI 가 RAC/catalog 밖이라 D1/D3 대칭이 깨진다. 문서에서 가져올 것은 **TUS 1.0 프로토콜** (POST 생성 → HEAD offset 조회 → PATCH 청크 반복, 오픈 표준 — Vimeo/Cloudflare/Supabase 채택) 이다. ADR-194 (차트) 가 같은 상황에서 "라이브러리 비교 → 의존 0 자체 구현" 으로 간 선례다.
- 초기 고객 환경 (Apache/Tomcat + Spring + Oracle) 에서는 TUS raw-body PATCH 가 multipart 청크보다 유리하다 — Spring `spring.servlet.multipart.max-file-size` (기본 1MB) 와 Tomcat `maxPostSize` 는 multipart/form 파싱에만 걸리고, `request.getInputStream()` → `RandomAccessFile.seek(offset)` 1회 쓰기로 병합 단계가 없다. 반면 컴포넌트만 제공하면 고객은 서버를 못 만든다 — RAON K 가 Java/.NET 서버 모듈을 함께 파는 이유이므로 **서버 계약 + 참조 구현**이 산출물이어야 한다.

**Hard Constraints**:

1. **의존·번들** — 신규 런타임 의존 **0** (`CLAUDE.md` 초기 번들 <500KB, `component-design/SKILL.md` 외부 라이브러리 금지). 엔진 core+tus ≤ **6KB gz**, IIFE 전체 ≤ **10KB gz**. builder 초기 chunk Δ **0** (엔진은 첫 파일 선택 시 `import()`), publish 초기 Δ ≤ +2KB gz (렌더러 shell 만).
2. **GB 메모리 계약** — 파일 전체 읽기 0 (`File.slice` 를 XHR body 로 직접). 4GB 합성 파일 업로드 중 JS 힙 Δ ≤ **64MB** (3회 중앙값). 전체 파일 해시 금지 — 청크별 checksum 만.
3. **재개 계약** — 네트워크 단절·새로고침·탭 종료 3경로 모두 재개 시 재전송 바이트 ≤ chunkSize. 서버 `Upload-Offset` 이 진실, 클라이언트 카운터는 힌트.
4. **엔진 독립** — `@composition/upload` 는 `@composition/shared`/`specs`/`react`/`react-aria-components` 미의존 (react 는 `/react` entry 의 optional peer). eslint 로 역방향 import 0. IIFE 단독으로 JSP 페이지에서 동작. 의존 방향 `upload ← shared ← builder/publish` 단방향.
5. **서버 계약 호환** — 표준 TUS 1.0 core + `creation` + `expiration` (선택 `checksum`/`termination`/`concatenation` 은 `OPTIONS` 감지). 참조 서버 = Java 8 + Spring MVC 5 + servlet 3.1 + Tomcat 9 (Boot 비의존). 같은 클라이언트 스위트가 **tusd** (Go 레퍼런스 서버) 도 통과 — 계약이 참조 서버 방언이 되는 것을 차단.
6. **등록 완결** — catalog entry · binding · rule · `PALETTE_ORDER`(+oracle) · factory · defaults · rendererMap · publish registry 8지점 전부. `componentRegistrationContract.test.ts` ratchet 0/0/0 유지.
7. **보안 계약** — 문서/`ApiEndpoint` 에 정적 비밀 0 (publish 는 `/project.json` 을 그대로 서빙 — `apps/publish/src/App.tsx:359`). 서버 계약 §Security 의무 조항 (웹루트 밖 저장 · 소유자 바인딩 · 경로 검증 · TTL GC · CSRF) 을 참조 서버가 실물로 충족하고 공격 corpus 를 전부 거부.
8. **Builder 캔버스 무전송** — Skia 는 디자인 타임 정적 합성만, 엔진 import 0 (메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview`).

**Soft Constraints**:

- ADR-158 G1 (interaction event = RAC/RSP 실존 callback) — `onUploadComplete` 류 커스텀 이벤트는 internal-source 예외 판정이 없다. v1 은 RAC 실존 `onSelect`/`onDrop` 만 등재 (§Risks R2).
- publish 는 기능 링크만 (메모리 `project-publish-link-only-defer-until-builder-stable`) — live 는 preview 우선, publish 축은 JSP 예제(IIFE) 로 대신 검증.
- ADR-134 Phase 9 (Electron) 시점 미확정 — 네이티브 업로드 에이전트 로드맵 없음. Rust 코어 (대안 D) 재개 조건으로만 남긴다.
- 참조 구현은 Java — TS 모노레포 밖 언어라 CI 가 별도 (§Risks R6).
- 초기 고객의 Apache `Timeout` (기본 60s) 이 청크 1개 전송 시간을 제한 → 기본 chunkSize 8MB, 계약서에 knob 표.

## Alternatives Considered

### 대안 A: TS 독립 package 엔진 (sans-I/O 코어 + XHR driver) + TUS 어댑터 + `FileUpload` compound + Spring 참조 서버 (권장)

- 설명: `packages/upload-engine` (`@composition/upload`, 의존 0) — 순수 함수 상태기계 `reduce(state, event) → [state, commands]` + driver (XHR/Fetch/Storage) + 어댑터 (tus 기본 · supabase clamp · multipart fallback) + `/react` · `/vanilla`(IIFE) entry. composition 은 `FileUpload` compound (DropZone + FileTrigger>Button + GridList 파일 목록 + ProgressBar) 의 `renderFileUpload` 가 `/react` 를 lazy 소비. 서버 계약 문서 + `examples/upload-server-spring/` (Java 8/Spring 5, jar 무의존 컨트롤러 + `tus-java-server` 변형) + `examples/upload-client-jsp/`.
- 근거: tus-js-client 의 구조 (creation → HEAD → PATCH 루프, fingerprint→storage 재개, `overridePatchMethod`) 와 Uppy Golden Retriever (새로고침 복구) 의 통찰을 프로토콜 수준에서 채택. sans-I/O 는 Python `h11`/`sans-io` 패턴 — I/O 를 driver 로 분리해 테스트·이식성 확보. `@composition/specs` 의 tsup/exports 형태와 `composition-engine` 의 "독립 엔진, composition 은 consumer" 구조를 그대로 따른다.
- 위험:
  - 기술: **M** — XHR 첫 사용 + TUS 상태기계 자작 + 참조 서버가 다른 언어 (Java). mock TUS 서버 + tusd 대조군으로 닫는다.
  - 성능: L — 의존 0, lazy chunk, 네트워크가 병목 (1GB@100Mbps = 80s, 청크당 오케스트레이션 µs).
  - 유지보수: **M** — 계약 버전 ↔ package 버전 동기 + Java 예제 유지 (별도 CI).
  - 마이그레이션: L — 신규 type, **BC 0% 사용자 영향 / 재직렬화 0 파일** (기존 문서에 FileUpload 노드 없음). `selectedFiles` 문서 write 제거는 소비처 0 (Phase 0 재grep 으로 확정) — 저장된 문서에 값이 남아 있어도 무시되는 dead prop.

### 대안 B: Uppy + tus-js-client 채택 (internal binding 으로 감싸기)

- 설명: `@uppy/core` + `@uppy/dashboard` + `@uppy/tus` 를 `kind:"internal"` renderer 로 감싸고 Skia 는 정적 합성.
- 근거: FILE_UPLOAD.md 결론. ~30.9k stars, Golden Retriever, 원격 소스 (Drive/Dropbox) 플러그인.
- 위험:
  - 기술: L — 검증된 구현.
  - 성능: **H** — 100KB+ gz 가 publish 번들에 실린다 (HC1 위반). Dashboard 는 Preact 내장.
  - 유지보수: **H** — Dashboard UI 가 RAC/catalog 밖 (D1·D3 대칭 붕괴, `@sync` 금지 패턴 동형) + upstream major 추종. JSP 에서는 쓸 수 있으나 composition 안에서 시각 정본이 둘이 된다.
  - 마이그레이션: L.

### 대안 C: resumable.js 식 multipart 청크 자체 프로토콜 (Spring `MultipartFile` 친화)

- 설명: 청크마다 `POST` FormData (`chunkNumber`/`totalChunks`/`identifier`) + `GET` 존재 확인, 서버가 마지막에 병합. 고객 Spring 컨트롤러 관행에 가장 가깝다.
- 근거: resumable.js (~4.7k stars) · FileGator 채택 · 국내 Java 예제 다수.
- 위험:
  - 기술: M — 클라이언트는 단순하나 서버 병합·존재 확인 N회.
  - 성능: **M** — Spring multipart 임시 파일 → 복사 → 병합 (GB 3회 쓰기), `max-file-size`/`max-request-size` 설정 강제.
  - 유지보수: **H** — 자체 정의 프로토콜 = 표준 서버 (tusd/tus-node-server/tusdotnet) 호환 0, 고객마다 서버 재구현. 계약 문서가 곧 유일한 구현.
  - 마이그레이션: L.

### 대안 D: Rust/wasm 코어 (`composition-engine` 동형)

- 설명: 프로토콜 코어를 Rust crate 로 만들고 wasm-bindgen 으로 브라우저에 싣는다.
- 근거: 레이아웃 엔진 선례 (ADR-916). 네이티브 에이전트와 코어 공유 가능.
- 위험:
  - 기술: **H** — XHR·Blob·localStorage·timer 전부 `web-sys` glue (Rust 가 JS 를 부르는 코드), 바이트를 만지려면 JS→wasm 복사로 HC2 0-copy 파괴. Spring Security CSP 환경에서 `'wasm-unsafe-eval'` 필요, `.wasm` MIME (Tomcat 8.5 `web.xml`), 비동기 init.
  - 성능: M — 병목이 I/O 라 처리량 이득 0, wasm 수십 KB (현 엔진 89.7KB gz) + glue 로 HC1 초과 가능.
  - 유지보수: **H** — 고객 (Java 팀) F12 에서 wasm 스택 디버깅 불가, 에러의 실체 (XHR status/CORS) 는 JS 쪽.
  - 마이그레이션: L.

### 대안 E: 기존 DropZone/FileTrigger 에 런타임만 부착 (compound·독립 package 없음)

- 설명: `renderFileTrigger`/`renderDropZone` 안에 업로드 큐를 내장하고 엔진은 `@composition/shared` 내부 모듈로 둔다.
- 근거: 최소 변경, 등록 지점 추가 0.
- 위험:
  - 기술: L.
  - 성능: L.
  - 유지보수: **H** — `shared` 는 `private: true` + src export 라 JSP/외부에서 사용 불가 (HC4 위반). 파일 목록·진행률 합성이 각 렌더러에 흩어진다.
  - 마이그레이션: M — `selectedFiles` 잘못된 채널이 존속하고 leaf 에 런타임을 넣어 catalog leaf 계약 (시각 = rule, 구조 = 자식) 이 흐려진다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | L            |     0      |
| B    | L    | H    | H        | L            |     2      |
| C    | M    | M    | H        | L            |     1      |
| D    | H    | M    | H        | L            |     2      |
| E    | L    | L    | H        | M            |     1      |

루프 판정: A 가 HIGH 0 — 새 대안 추가 불필요. CRITICAL 0 이므로 근본적 다른 접근 추가 조건도 해당 없음. 루프 종료.

## Decision

**대안 A: TS 독립 package 엔진 (sans-I/O 코어 + XHR driver) + TUS 어댑터 + `FileUpload` compound + Spring 참조 서버** 를 선택한다.

선택 근거 (위험 수용):

1. 기술 M 의 실체는 "XHR 첫 사용 + 상태기계 자작 + Java 참조 구현" 인데, 첫째·둘째는 mock TUS 서버 적합성 스위트 + tusd 대조군 (G1·G2) 으로 닫히고, 셋째는 별도 CI job (G2) 으로 stale 을 막는다. 상태기계를 순수 함수로 분리하면 GB·단절·재개 시나리오를 브라우저 없이 전부 단위 테스트할 수 있다.
2. 유일하게 HC1 (의존 0·크기) · HC4 (독립 package) · HC5 (표준 호환) 를 동시에 만족한다 — B 는 크기와 시각 정본 이중화, C 는 표준 호환 0, E 는 밖에서 못 쓴다.
3. 프로토콜을 표준 (TUS) 으로 두면 참조 서버는 "권장 구현" 이지 "유일 구현" 이 아니다 — 고객이 tusd/tus-java-server/자체 컨트롤러 어느 것을 골라도 같은 클라이언트가 동작한다. 계약이 곧 이식성이다.
4. sans-I/O 분리는 대안 D 의 재개 비용을 0 으로 만든다 — 네이티브 에이전트가 필요해지면 코어만 Rust 로 옮기고 같은 corpus 로 대조한다.

기각 사유:

- **대안 B 기각**: 100KB+ 가 publish 번들에 실려 HC1 을 위반하고, Dashboard UI 가 catalog 밖이라 D3 시각 정본이 둘이 된다 (`@sync` 금지 패턴 동형). 문서의 결론은 "라이브러리를 고르는 조직" 에게 맞는 답이지 시각 SSOT 를 가진 빌더에 맞는 답이 아니다.
- **대안 C 기각**: 자체 프로토콜은 표준 서버 호환이 0 이라 고객마다 서버를 다시 만들고, Spring multipart 경로는 GB 에서 3회 디스크 쓰기 + 설정 강제다. 고객이 이미 resumable.js 식 서버를 갖고 있을 때만 어댑터 1개로 후속 (breakdown §7).
- **대안 D 기각**: 병목이 I/O 라 wasm 이 처리량을 더하지 못하고, 0-copy 계약·CSP·MIME·디버깅에서 진다. 레이아웃 엔진이 Rust 인 이유 (CPU-bound, 60Hz) 가 여기엔 없다. 재개 조건 = 네이티브 에이전트 로드맵 확정 (breakdown §1).
- **대안 E 기각**: `shared` 가 private 이라 HC4 를 구조적으로 위반하고, leaf 렌더러에 런타임을 넣어 잘못된 `selectedFiles` 채널을 존속시킨다.

> 구현 상세: [201-large-file-upload-engine-component-server-contract-breakdown.md](design/201-large-file-upload-engine-component-server-contract-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **고객 인프라 불일치로 무음 실패** — Apache `Timeout`/`LimitRequestBody`, Tomcat `maxSwallowSize`, WAF 의 PATCH 차단, CSP. 코드 경로 — 신규: 어댑터 `OPTIONS` 사전 점검 (`packages/upload-engine/src/adapters/tus.ts`), driver 에러 분류 (`src/core/drivers/xhr.ts`), `renderFileUpload` 오류 표시 (`packages/shared/src/renderers/`); 기존: 런타임 상태가 흐를 override 층 `apps/publish/src/renderer/InteractionRuntime.tsx:126` (`updateElementProps: patchOverride`), preview 의 `renderDropZone` `onDrop` 위임 `FormRenderers.tsx:1078`. 서버: 참조 컨트롤러 override 필터 |  HIGH  | `OPTIONS` 로 `Tus-Extension`·`Tus-Max-Size` 확인 후 시작, 에러를 코드 (`E_PATCH_BLOCKED`/`E_PROXY_TIMEOUT`/`E_OFFSET_MISMATCH` …) 로 노출, 계약서에 knob 표 — **G2·G5**                                    |
| R2  | ADR-158 G1 — 커스텀 완료/오류 이벤트는 RAC 실존 callback 이 아니라 등재 근거가 없다 (`capabilityRegistry.ts` G1 테스트가 차단)                                                                                                                                                                                    |  MED   | v1 은 RAC 실존 `onSelect`(FileTrigger)/`onDrop`(DropZone) 만 등재, 완료·오류는 컴포넌트 내부 표시. 커스텀 이벤트는 ADR-158 internal-source 예외 절차로 후속                                                |
| R3  | **보안** — 문서에 굳은 비밀 (`ApiEndpoint.headers` `packages/shared/src/types/collection.types.ts:72` → `/project.json` 서빙 `apps/publish/src/App.tsx:359`), 런타임 값의 문서 write 선례 (`FormRenderers.tsx:1037` `selectedFiles`), `Upload-Metadata` 경로 조작 (참조 서버 `TusController` 디코드 지점), 웹루트 안 저장 (Tomcat `webapps/` = JSP 업로드 RCE)                                                                                       |  HIGH  | breakdown §3-6 의무 조항 + 공격 corpus (traversal 12종·초과 길이·offset 불일치·타인 URL·널바이트·CSRF 없는 PATCH) 를 mock·참조 서버 양쪽에서 전부 거부 + 문서/`ApiEndpoint` 비밀 패턴 정적 게이트 — **G4** |
| R4  | GB 힙 — 미리보기·해시·XHR 버퍼가 조용히 파일 전체를 읽는다 (`FileReader`/`arrayBuffer()` 1회로 계약 붕괴)                                                                                                                                                                                                                  |  MED   | 미리보기 `<img>` + 크기 상한, 청크별 checksum 만, 4GB 힙 Δ ≤ 64MB 측정 3회 중앙값 — G1                                                                                                                     |
| R5  | publish 인증 경로 — 쿠키 세션 외 토큰 주입 경로 부재 (publish 앱에 supabase·auth 없음)                                                                                                                                                                                                                            |  MED   | `withCredentials` 기본 + 런타임 `getHeaders()` provider (JSP 는 CSRF meta 태그) — 정적 비밀 금지와 짝                                                                                                      |
| R6  | Java 참조 구현 stale — TS 모노레포 밖 언어, turbo/vitest 대상 아님                                                                                                                                                                                                                                                |  MED   | `examples/` 별도 CI job (`mvn -q test`, JDK 8) + 계약 버전 = package 버전, 계약 변경 = major — G2                                                                                                          |
| R7  | Skia 정적 합성 ↔ DOM 런타임 표시 시각 발산 (파일 행·진행 막대는 런타임 값)                                                                                                                                                                                                                                        |  LOW   | 대칭 정의를 디자인 타임 샘플 상태 1종으로 한정 (ADR-157 샘플 정책 동형), `/cross-check` 는 그 상태만                                                                                                       |
| R8  | 등록 8지점 누락 (과거 `PALETTE_ORDER` 결손 4건 — 메모리 `feedback-palette-order-array-is-exposure-ssot-not-catalog`)                                                                                                                                                                                              |  MED   | oracle + ratchet + `entryUniverseContract` INVENTORY freeze — G3                                                                                                                                           |

## Gates

| Gate | 시점                 | 통과 조건                                                                                                                                                                                                                                                                  | 실패 시 대안                                                                                               |
| ---- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 종료         | inventory freeze (breakdown §2 재grep 0 diff) + mock TUS 서버 가동 + **first-nail**: XhrDriver 로 100MB 파일 1개 `upload.onprogress` 진행률 수신 + 강제 단절 후 `HEAD` offset 재개 1케이스 PASS                                                                            | 착수 중단 — driver 계층 재설계 (fetch streaming 등) 후 재시도                                              |
| G1   | Phase 1 종료         | mock 서버 적합성 스위트 (core/creation/expiration/checksum + 공격 corpus 클라이언트 측) 전부 PASS · 4GB 합성 파일 힙 Δ ≤ 64MB (3회 중앙값) · 단절/새로고침/탭 종료 재개 재전송 ≤ chunkSize · core+tus ≤ 6KB gz / IIFE ≤ 10KB gz · `@composition/*`·react import 0 (eslint) | 크기 초과 → 어댑터 별도 entry 분리; 힙 초과 → chunkSize·driver 재설계; 재개 실패 → 상태기계 수정 후 재측정 |
| G2   | Phase 2 종료 (R1·R6) | Spring 참조 서버 (Java 8/Spring 5/Tomcat 9) e2e — 1GB 업로드→중단→재개 성공 · override 모드 PASS · 소유자 검사 403 · TTL GC · webroot 저장 기동 거부 · CSRF 없는 PATCH 403 · **tusd 대조군 동일 스위트 PASS** · `mvn -q test` CI job green                                 | 계약서 수정 + 클라이언트 재조정 (프로토콜 변경 = major). tusd 불일치 = 참조 서버 방언 → 서버 수정          |
| G3   | Phase 3 종료 (R8)    | 등록 8지점 + ratchet 0/0/0 + oracle + INVENTORY · `CAPABILITY_REGISTRY` G1 PASS · `selectedFiles` 문서 write 0 · `/cross-check` 샘플 상태 bbox Δ ≤ 1px · builder 초기 chunk Δ 0 · `pnpm type-check` 0                                                                      | 누락 지점 보강 후 재실행; 대칭 실패 → catalog rule/factory 정렬 (Skia 전용 표현 금지)                      |
| G4   | Phase 2·3 (R3)       | 문서/`ApiEndpoint` 비밀 패턴 정적 게이트 PASS · 참조 서버 공격 corpus 전부 거부 · 저장 경로 webroot 검증 실물                                                                                                                                                              | Implemented 승격 차단 — 의무 조항 미충족 항목 수리 전 종결 금지                                            |
| G5   | Phase 4 (R1)         | **live** — preview 에서 ≥1GB 실파일 업로드·중단·재개 (참조 서버 대상, Chrome MCP 또는 사용자 confirm 구분 기재) + JSP 예제 페이지에서 IIFE 로 동일 시나리오 · `### Live Exercise` 절                                                                                       | Implemented 보류 — 실패 시나리오를 R1 에러 코드로 재현·수리 후 재실행                                      |

**측정 조건 (measurement-validity §1 — Gate 표 명시 항목)**: Q1 출처 — 힙·재개 측정은 합성 파일 (규모 전용, 분포 지표 인용 없음), G5 는 사용자 실파일 · Q2 불리 케이스 — `parallelUploads` 최대(3)에서 힙 측정, Chrome 네트워크 throttle (Slow 3G) + 단절 5회 반복 재개, 프록시 timeout 시뮬레이션 (mock 서버 지연 61s) · Q3 대조군 — 힙은 업로드 전 처녀 힙 baseline, 번들은 같은 디렉터리 detached checkout baseline (메모리 `reference-bundle-delta-baseline-build-detached-checkout`) · Q4 소비 경로 — `renderFileUpload` → `import("@composition/upload/react")` → XhrDriver 실배선을 live 로 확인 (등록만으로 PASS 금지) · Q5 oracle — 서버 `Upload-Offset` 실값 (tusd 독립 구현 + 참조 서버) 이 기준, 클라이언트 자기 카운터 불인정. 측정 조건 기록: `visibilityState: visible` · 처녀 힙 · Chrome 버전 · 회선.

### Live Exercise

(Implemented 승격 시 기재 — preview ≥1GB 실파일 · JSP 예제 · 참조 서버 · 날짜 · Chrome MCP / 사용자 confirm 구분)

## Consequences

### Positive

- `@composition/upload` 가 composition 밖 (JSP/Spring 고객 페이지, 향후 Electron/Node) 에서도 동작하는 첫 독립 TS package — `composition-engine` 의 "독립 엔진 + consumer" 구조를 TS 층에도 확립. `packages/upload-engine` 신설, `@composition/specs` 동형 배포 형태.
- 잘못된 런타임→문서 채널 (`renderFileTrigger` `selectedFiles` write) 제거 — canonical document 가 런타임 상태로 오염되지 않는다.
- `CAPABILITY_REGISTRY` 에 DropZone/FileTrigger 가 등재되어 기존 두 컴포넌트도 규칙 트리거가 된다.
- 서버 계약 문서 + Spring 참조 구현 + JSP 예제로 초기 고객 (Java 8/Spring 5/Tomcat/Oracle) 이 즉시 도입 가능 — 다른 언어 서버는 표준 TUS 구현체 (tusd/tus-node-server/tusdotnet) 로 대체 가능.
- 보안 의무 조항이 계약·공격 corpus·정적 게이트로 코드화 — "보안 업로드" 를 문구가 아니라 검증으로 제공.

### Negative

- 저장소에 Java 산출물 (`examples/upload-server-spring/`) 이 들어와 별도 CI job (JDK 8) 과 계약 버전 동기 부담이 생긴다 (R6).
- 등록 8지점 + capability + package 1개 신설로 Phase 3 변경 파일이 넓다 (catalog · binding · rule · factory · defaults · rendererMap · palette · publish registry · `FormRenderers.tsx`).
- 커스텀 완료/오류 이벤트를 interaction rule 로 못 건다 (v1) — 업로드 후 페이지 이동 같은 연쇄는 ADR-158 예외 절차 후속까지 컴포넌트 내부 표시로 한정.
- Skia 는 샘플 상태만 그리므로 빌더 캔버스에서 실제 진행률·파일 목록은 보이지 않는다 — preview 에서만 확인 (설계상 의도, R7).
