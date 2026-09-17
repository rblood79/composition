# ADR-201: 대용량 파일 업로드 — 독립 전송 엔진 + FileUpload 컴포넌트 + Spring 서버 계약

## Status

Implemented — 2026-09-17 (Proposed 2026-09-02 → In Progress 09-17 사용자 `/execute-adr 201` worktree 3개 병렬 착수 → Phase 0~4 + G0·G1·G2a·G2b·G3·G4·G5 전부 실측 → Implemented 09-17. `reviews/201.md` round 1 HIGH 3 / MED 3 / LOW 4 전부 fixed)

> 출처: 2026-09-01 사용자 요청 — [FILE_UPLOAD.md](../../explanation/research/FILE_UPLOAD.md) (RAON K Upload 유사 오픈소스 5종 비교) 검토 후 라이브러리를 그대로 쓰지 않고 composition 컴포넌트로 자체 구현하기로 결정. 사용자 확정 전제 4건 (GB 단위 파일 · 업로드 대상 대다수 비-Cloud · 초기 고객 Java 8 + Spring 5 + Tomcat + Oracle · 엔진은 독립 package + 서버 계약·Spring 참조 구현 둘 다) 은 [breakdown §1](../design/201-large-file-upload-engine-component-server-contract-breakdown.md) 에 lock-in. 완전 신규 주제 (fork 아님 — 선행 결정 0건 실측).

## Context

**SSOT 3-domain 위치**: D1 = **RAC `DropZone` + `FileTrigger` + `GridList`** (기존 binding 재사용, ARIA 신규 작성 0) / D2 = **RAC prop 명 + tus-js-client·Uppy 옵션 명 참조** (`endpoint`/`chunkSize`/`retryDelays`/`parallelUploads` — RSP v3·S2 에 FileUpload 가 없어 업계 표준 클라이언트의 옵션 명을 참조 원천으로 둔다) / D3 = **catalog `COMPONENT_RULES_TABLE.FileUpload` 컨테이너 shell + 자식 DropZone/ProgressBar 기존 rule**. 전송 엔진은 D1/D2/D3 어디에도 속하지 않는 **런타임 층** — canonical document 밖에서 동작하며 publish `InteractionRuntime` override 층과 동형 (문서 편집이 아니라 런타임 동작). 경계 교차 없음. **Generator 확인 (선차단 #2)**: 신규 시각 채널 0 — 기존 rule 채널만 소비하므로 generate-css 확장 불필요.

**D2 판정 기록 (review round 1 h3 — ADR-194 R5 동형, prop 단위)**: 외부 원천 선언은 194 선례로 허용되나 `ssot-hierarchy.md` §3 은 prop 단위로 적용된다. binding accepts 는 아래 표의 prop 만, 표 밖 이름은 코드 리뷰 거부. 같은 표를 `FileUpload.binding.ts` 상단 주석에 둔다 (G3 통과 조건).

| prop                | 원천                                                            | 판정                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceptedFileTypes` | RAC `FileTriggerProps`                                          | 채택 (기존 `FileTrigger.binding.ts` 동일)                                                                                                                                                                   |
| `allowsMultiple`    | RAC `FileTriggerProps`                                          | 채택                                                                                                                                                                                                        |
| `acceptDirectory`   | RAC `FileTriggerProps`                                          | 채택                                                                                                                                                                                                        |
| `isDisabled`        | RAC `FileTriggerProps` / `DropZoneProps`                        | 채택                                                                                                                                                                                                        |
| `endpoint`          | tus-js-client `endpoint` (값은 `ApiEndpointDefinition` 참조 id) | 채택 — 어댑터 (tus/multipart) 는 endpoint 정의에서 파생, D2 표면에 `protocol` 없음                                                                                                                          |
| `chunkSize`         | tus-js-client `chunkSize`                                       | 채택                                                                                                                                                                                                        |
| `retryDelays`       | tus-js-client `retryDelays`                                     | 채택                                                                                                                                                                                                        |
| `parallelUploads`   | tus-js-client `parallelUploads`                                 | 채택                                                                                                                                                                                                        |
| `maxFileSize`       | Uppy `restrictions.maxFileSize`                                 | 채택                                                                                                                                                                                                        |
| `autoProceed`       | Uppy `autoProceed`                                              | 채택 (초안의 `autoUpload` 를 원천 명으로 정렬)                                                                                                                                                              |
| `showPreview`       | custom                                                          | 채택 — 근거: 파일 행 썸네일 on/off 는 D3 시각 표면이라 D2 prop 이 필요, 참조 라이브러리는 UI 플러그인 옵션 (Uppy Dashboard `showLinkToFileUploadResult` 류) 로만 가져 동등 명 없음. 값은 boolean 1개로 한정 |
| ~~`protocol`~~      | 없음                                                            | **제거** — endpoint 정의에서 파생 (어댑터 자동 선택)                                                                                                                                                        |

### 문제 — 입력 UI 는 있고 전송이 없다

2026-09-01~02 실측 (breakdown §2, HEAD `b06ddd643`):

- `FileTrigger`(RAC) · `DropZone`(internal) 은 catalog 등록 + palette 노출 (`paletteItems.ts:231-232`) 상태이고 `acceptDirectory` 폴더 선택까지 prop 으로 있다. `ProgressBar` compound 는 DOM/Skia 대칭이 확립돼 있다.
- **전송 런타임 0건** — `renderFileTrigger` (`packages/shared/src/renderers/FormRenderers.tsx:1037`) 는 파일 **이름만** `selectedFiles` prop 에 `updateElementProps` 로 기록한다 (런타임 상태를 문서 채널에 쓰는 잘못된 경로). `renderDropZone` (`:1078`) 의 `onDrop` 은 `createEventHandlerMap` 에 위임되지만 `CAPABILITY_REGISTRY` 에 DropZone/FileTrigger 가 **미등재**라 규칙을 걸 수 없고, `InteractionAction` 은 `navigate | toast | capability` 3종 (`interactionRule.types.ts:47`) — 업로드/HTTP 액션이 없다.
- `XMLHttpRequest`·`upload.onprogress` 사용 0건, Cloud Storage 사용 0건, `cloud SDK` 는 builder 에만 있고 publish 앱에는 없다.
- 문서의 결론 "Uppy + tus 서버" 는 라이브러리 채택 안이다. Uppy core + Dashboard + Tus 플러그인은 100KB+ gz (추정) 이고 UI 가 RAC/catalog 밖이라 D1/D3 대칭이 깨진다. 문서에서 가져올 것은 **TUS 1.0 프로토콜** (POST 생성 → HEAD offset 조회 → PATCH 청크 반복, 오픈 표준 — Vimeo/Cloudflare/Cloud 채택) 이다. ADR-194 (차트) 가 같은 상황에서 "라이브러리 비교 → 의존 0 자체 구현" 으로 간 선례다 (194 는 뒤에 ADR-209 가 런타임에 Recharts 를 도입해 부분 대체됐다 — B 기각은 선례가 아니라 크기 + D3 이중화로 자립한다).
- 초기 고객 환경 (Apache/Tomcat + Spring + Oracle) 에서는 TUS raw-body PATCH 가 multipart 청크보다 유리하다 — Spring `spring.servlet.multipart.max-file-size` (기본 1MB) 와 Tomcat `maxPostSize` 는 multipart/form 파싱에만 걸리고, `request.getInputStream()` → `RandomAccessFile.seek(offset)` 1회 쓰기로 병합 단계가 없다. 반면 컴포넌트만 제공하면 고객은 서버를 못 만든다 — RAON K 가 Java/.NET 서버 모듈을 함께 파는 이유이므로 **서버 계약 + 참조 구현**이 산출물이어야 한다.

**Hard Constraints**:

1. **의존·번들** — 신규 런타임 의존 **0**. 엔진 core+tus ≤ **6KB gz**, IIFE 전체 ≤ **10KB gz**. initial 번들은 저장소 정본 절차 (착수 시 ADR-202 재승인 **Builder ≤ 1,319,829 / Preview ≤ 592,000 B gzip, 만료 2026-10-16** → **2026-09-17 201 재승인 1,328,315 / 601,346 로 대체**, §initial 번들 상한 재승인) 를 따른다 — 등록 8지점 (catalog·binding·rule·factory·palette) 은 정적 import 라 Builder initial 에, `renderFileUpload` shell 은 shared rendererMap 이라 Preview initial 에 실리므로 **Δ 0 은 불가**. 통과 조건은 ① 엔진 chunk 가 initial closure 밖 (`initialFiles.has(uploadEngineChunk) === false`, 첫 파일 선택 시 `import()`) ② 등록·shell Δ 를 같은 디렉터리 detached checkout baseline 로 실측해 **ADR-201 initial 상한 재승인 절** (Builder/Preview 절대 상한 + 만료일, 사용자 승인) 에 기록 ③ `adr201-bundle-gate.mjs` (202 판정기 동형 + ①) PASS. publish 앱 Δ 는 gate 밖 참고치 (link-only 방침). (review round 1 h2 — 2026-09-17: 500KB 예시 인용과 SKILL.md 오인용 제거)
2. **GB 메모리 계약** — 파일 전체 읽기 0 (`File.slice` 를 XHR body 로 직접). 4GB 합성 파일 업로드 중 JS 힙 Δ ≤ **64MB** (3회 중앙값 — 판정은 힙 스냅샷 JS 데이터 Δ, raw `usedJSHeapSize` 는 JIT·계측 버퍼가 섞여 참고치: ADR-218 종결 방식). 전체 파일 해시 금지 — 청크별 checksum 만.
3. **재개 계약** — 네트워크 단절·새로고침·탭 종료 3경로 모두 재개 시 재전송 바이트 ≤ chunkSize. 서버 `Upload-Offset` 이 진실, 클라이언트 카운터는 힌트.
4. **엔진 독립** — `@composition/upload` 는 `@composition/shared`/`specs`/`react`/`react-aria-components` 미의존 (react 는 `/react` entry 의 optional peer). eslint 로 역방향 import 0. IIFE 단독으로 JSP 페이지에서 동작. 의존 방향 `upload ← shared ← builder/publish` 단방향.
5. **서버 계약 호환** — 표준 TUS 1.0 core + `creation` + `expiration` (선택 `checksum`/`termination`/`concatenation` 은 `OPTIONS` 감지). 참조 서버 = Java 8 + Spring MVC 5 + servlet 3.1 + Tomcat 9 (Boot 비의존). 같은 클라이언트 스위트가 **tusd** (Go 레퍼런스 서버) 도 통과 — 계약이 참조 서버 방언이 되는 것을 차단. **선행 조건 (review round 1 h1)**: 실행 머신에 Temurin JDK 8 (또는 8 target 컴파일이 가능한 17) + Maven 3 + Tomcat 9 + **tusd release 바이너리** (단일 실행 파일 — Go·docker 불요). 2026-09-17 실측 이 머신에는 전부 없어 G2 를 G2a/G2b 로 분리한다 (§Gates).
6. **등록 완결** — catalog entry · binding · rule · `PALETTE_ORDER`(+oracle) · factory · defaults · rendererMap · publish registry 8지점 전부. `componentRegistrationContract.test.ts` ratchet 0/0/0 유지.
7. **보안 계약** — 문서/`ApiEndpoint` 에 정적 비밀 0 (publish 는 `/project.json` 을 그대로 서빙 — `apps/publish/src/App.tsx:359`). 서버 계약 §Security 의무 조항 (웹루트 밖 저장 · 소유자 바인딩 · 경로 검증 · TTL GC · CSRF) 을 참조 서버가 실물로 충족하고 공격 corpus 를 전부 거부.
8. **Builder 캔버스 무전송** — Skia 는 디자인 타임 정적 합성만, 엔진 import 0 (메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview`).

**Soft Constraints**:

- ADR-158 G1 (interaction event = RAC/RSP 실존 callback) — `onUploadComplete` 류 커스텀 이벤트는 등재 근거가 없다 (registry 정책이 차단, 테스트는 `^on[A-Z]` 명명 규약만 검사한다 — review round 1 m1). v1 은 RAC 실존 `onSelect`/`onDrop` 만 등재 (§Risks R2).
- publish 는 기능 링크만 (메모리 `project-publish-link-only-defer-until-builder-stable`) — live 는 preview 우선, publish 축은 JSP 예제(IIFE) 로 대신 검증.
- ADR-134 Phase 9 (Electron) 시점 미확정 — 네이티브 업로드 에이전트 로드맵 없음. Rust 코어 (대안 D) 재개 조건으로만 남긴다.
- 참조 구현은 Java — TS 모노레포 밖 언어라 CI 가 별도 (§Risks R6).
- 초기 고객의 Apache `Timeout` (기본 60s) 이 청크 1개 전송 시간을 제한 → 기본 chunkSize 8MB, 계약서에 knob 표.

## Alternatives Considered

### 대안 A: TS 독립 package 엔진 (sans-I/O 코어 + XHR driver) + TUS 어댑터 + `FileUpload` compound + Spring 참조 서버 (권장)

- 설명: `packages/upload-engine` (`@composition/upload`, 의존 0) — 순수 함수 상태기계 `reduce(state, event) → [state, commands]` + driver (XHR/Fetch/Storage) + 어댑터 (tus 기본 · cloud clamp · multipart fallback) + `/react` · `/vanilla`(IIFE) entry. composition 은 `FileUpload` compound (DropZone + FileTrigger>Button + GridList 파일 목록 + ProgressBar) 의 `renderFileUpload` 가 `/react` 를 lazy 소비. 서버 계약 문서 + `examples/upload-server-spring/` (Java 8/Spring 5, jar 무의존 컨트롤러 + `tus-java-server` 변형) + `examples/upload-client-jsp/`.
- 근거: tus-js-client 의 구조 (creation → HEAD → PATCH 루프, fingerprint→storage 재개, `overridePatchMethod`) 와 Uppy Golden Retriever (새로고침 복구) 의 통찰을 프로토콜 수준에서 채택. sans-I/O 는 Python `h11`/`sans-io` 패턴 — I/O 를 driver 로 분리해 테스트·이식성 확보. `@composition/specs` 의 tsup/exports 형태와 `engine` 의 "독립 엔진, composition 은 consumer" 구조를 그대로 따른다.
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

### 대안 D: Rust/wasm 코어 (`engine` 동형)

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

> 구현 상세: [201-large-file-upload-engine-component-server-contract-breakdown.md](../design/201-large-file-upload-engine-component-server-contract-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **고객 인프라 불일치로 무음 실패** — Apache `Timeout`/`LimitRequestBody`, Tomcat `maxSwallowSize`, WAF 의 PATCH 차단, CSP. 코드 경로 — 신규: 어댑터 `OPTIONS` 사전 점검 (`packages/upload-engine/src/adapters/tus.ts`), driver 에러 분류 (`src/core/drivers/xhr.ts`), `renderFileUpload` 오류 표시 (`packages/shared/src/renderers/`); 기존: 런타임 상태가 흐를 override 층 `apps/publish/src/renderer/InteractionRuntime.tsx:126` (`updateElementProps: patchOverride`), preview 의 `renderDropZone` `onDrop` 위임 `FormRenderers.tsx:1078`. 서버: 참조 컨트롤러 override 필터 |  HIGH  | `OPTIONS` 로 `Tus-Extension`·`Tus-Max-Size` 확인 후 시작, 에러를 코드 (`E_PATCH_BLOCKED`/`E_PROXY_TIMEOUT`/`E_OFFSET_MISMATCH` …) 로 노출, 계약서에 knob 표 — **G2·G5**                                                                                                                                                                                                                             |
| R2  | ADR-158 G1 — 커스텀 완료/오류 이벤트는 RAC 실존 callback 이 아니라 등재 근거가 없다 (registry 정책이 차단 — 기존 테스트는 명명 규약만 검사하므로 등재하면 Events 패널 노출 → 무음 no-op 규칙이 된다, review round 1 m1)                                                                                                                                                                                                                                                                                                                                                         |  MED   | v1 은 RAC 실존 `onSelect`(FileTrigger)/`onDrop`(DropZone) 만 등재 — `["onSelect"] as const satisfies readonly (keyof FileTriggerProps)[]` 류 타입 단언으로 컴파일 시 실존 증명 (G3). 완료·오류는 컴포넌트 내부 표시. 커스텀 이벤트는 ADR-158 개정 또는 별도 ADR 로 후속                                                                                                                             |
| R3  | **보안** — 문서에 굳은 비밀 (`ApiEndpointDefinition.headers` `packages/shared/src/types/collection.types.ts:104` → `/project.json` 서빙 `apps/publish/src/App.tsx:377`; ADR-212 vault 는 `{{secret.NAME}}` placeholder 만 문서에 두고 ADR-213 `redactEndpointSecrets` 는 AI provider 경계만 가린다 — 201 게이트는 그 둘의 소비자), 런타임 값의 문서 write 선례 (`FormRenderers.tsx:1037` `selectedFiles`), `Upload-Metadata` 경로 조작 (참조 서버 `TusController` 디코드 지점), 웹루트 안 저장 (Tomcat `webapps/` = JSP 업로드 RCE)                                             |  HIGH  | breakdown §3-6 의무 조항 + 공격 corpus (traversal 12종·초과 길이·offset 불일치·타인 URL·널바이트·CSRF 없는 PATCH) 를 mock·참조 서버 양쪽에서 전부 거부 + 정적 게이트 = "FileUpload 참조 endpoint headers 에 placeholder 가 아닌 auth 값 0" (ADR-213 `AUTH_HEADER_KEYS` 재사용) · preview/publish 런타임 (vault 없음) 은 placeholder 헤더를 **제거**하고 쿠키 세션 / `getHeaders()` 에 위임 — **G4** |
| R4  | GB 힙 — 미리보기·해시·XHR 버퍼가 조용히 파일 전체를 읽는다 (`FileReader`/`arrayBuffer()` 1회로 계약 붕괴)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |  MED   | 미리보기 `<img>` + 크기 상한, 청크별 checksum 만, 4GB 힙 Δ ≤ 64MB 측정 3회 중앙값 — G1                                                                                                                                                                                                                                                                                                              |
| R5  | publish 인증 경로 — 쿠키 세션 외 토큰 주입 경로 부재 (publish 앱에 cloud·auth 없음)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |  MED   | `withCredentials` 기본 + 런타임 `getHeaders()` provider (JSP 는 CSRF meta 태그) — 정적 비밀 금지와 짝                                                                                                                                                                                                                                                                                               |
| R6  | Java 참조 구현 stale — TS 모노레포 밖 언어, turbo/vitest 대상 아님                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |  MED   | `examples/` 별도 CI job (`mvn -q test`, JDK 8) + 계약 버전 = package 버전, 계약 변경 = major — G2                                                                                                                                                                                                                                                                                                   |
| R7  | Skia 정적 합성 ↔ DOM 런타임 표시 시각 발산 (파일 행·진행 막대는 런타임 값)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |  LOW   | 대칭 정의를 디자인 타임 샘플 상태 1종으로 한정 (ADR-157 샘플 정책 동형), `/cross-check` 는 그 상태만                                                                                                                                                                                                                                                                                                |
| R8  | 등록 8지점 누락 (과거 `PALETTE_ORDER` 결손 4건 — 메모리 `feedback-palette-order-array-is-exposure-ssot-not-catalog`)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |  MED   | oracle + ratchet + `entryUniverseContract` INVENTORY freeze — G3                                                                                                                                                                                                                                                                                                                                    |

## Gates

| Gate | 시점                 | 통과 조건                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                                                                                     |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 종료         | inventory freeze (breakdown §2 재grep 0 diff) + mock TUS 서버 가동 + **first-nail**: XhrDriver 로 100MB 파일 1개 `upload.onprogress` 진행률 수신 + 강제 단절 후 `HEAD` offset 재개 1케이스 PASS                                                                                                                                                                          | 착수 중단 — driver 계층 재설계 (fetch streaming 등) 후 재시도                                                    |
| G1   | Phase 1 종료         | mock 서버 적합성 스위트 (core/creation/expiration/checksum + 공격 corpus 클라이언트 측) 전부 PASS · 4GB 합성 파일 힙 Δ ≤ 64MB (3회 중앙값) · 단절/새로고침/탭 종료 재개 재전송 ≤ chunkSize · core+tus ≤ 6KB gz / IIFE ≤ 10KB gz · `@composition/*`·react import 0 (eslint)                                                                                               | 크기 초과 → 어댑터 별도 entry 분리; 힙 초과 → chunkSize·driver 재설계; 재개 실패 → 상태기계 수정 후 재측정       |
| G2a  | Phase 2 종료 (R1)    | **로컬 실행 가능** — mock TUS 서버 + **tusd release 바이너리** 대조군에 같은 클라이언트 적합성 스위트 PASS (Go·docker 불요)                                                                                                                                                                                                                                              | tusd 불일치 = 클라이언트 또는 계약 방언 → 수정 후 재실행                                                         |
| G2b  | Phase 2 종료 (R1·R6) | **사용자 머신 실행 + 증거** — Spring 참조 서버 (Java 8/Spring 5/Tomcat 9) e2e: 1GB 업로드→중단→재개 · override 모드 · 소유자 403 · TTL GC · webroot 저장 기동 거부 · CSRF 없는 PATCH 403 · 로컬 `mvn -q test` PASS 로그 + workflow 파일 존재 (러너 green 은 ADR-198 잔여). 로그·confirm 을 `docs/adr/evidence/201-g2b-*.md` 로 기록. **G2b 없이 Implemented 불가**       | 계약서 수정 + 클라이언트 재조정 (프로토콜 변경 = major). 도구 부재 시 사용자에게 설치·실행 요청 (자동 설치 금지) |
| G3   | Phase 3 종료 (R8)    | 등록 8지점 + ratchet 0/0/0 + oracle + INVENTORY · binding accepts == D2 판정 표 (Context) · `CAPABILITY_REGISTRY` events 타입 단언으로 RAC 실존 증명 + G1 PASS · `selectedFiles` 문서 write 0 · `/cross-check` 샘플 상태 bbox Δ ≤ 1px · 엔진 chunk initial closure 밖 + 등록·shell Δ 실측 → initial 상한 재승인 절 · `adr201-bundle-gate.mjs` PASS · `pnpm type-check` 0 | 누락 지점 보강 후 재실행; 대칭 실패 → catalog rule/factory 정렬 (Skia 전용 표현 금지)                            |
| G4   | Phase 2·3 (R3)       | endpoint headers placeholder 외 auth 값 0 정적 게이트 PASS · 런타임 placeholder 헤더 제거 테스트 · 참조 서버 공격 corpus 전부 거부 (G2b) · 저장 경로 webroot 검증 실물 (G2b)                                                                                                                                                                                             | Implemented 승격 차단 — 의무 조항 미충족 항목 수리 전 종결 금지                                                  |
| G5   | Phase 4 (R1)         | **live** — preview 에서 ≥1GB 실파일 업로드·중단·재개 (G2a 환경이면 tusd 대상, G2b 환경이면 참조 서버 대상 — Chrome MCP 또는 사용자 confirm 구분 기재) + JSP 예제 페이지에서 IIFE 로 동일 시나리오 (G2b 와 같은 사용자 머신 증거) · `### Live Exercise                                                                                                                    |

2026-09-17, 실행자 Claude (headed/headless Playwright Chromium 151.0.7922.34 — Chrome MCP 아님 · 사용자 confirm 아님). 실파일 = `mkfile -n 1g` sparse 1,073,741,824 B + ZIP 매직바이트 (참조 서버 확장자 화이트리스트 · 매직바이트 검사 통과). 참조 서버 = `examples/upload-server-spring` `mvn cargo:run` (JDK 17 로 `-source/-target 1.8` 컴파일, Tomcat 9, H2 Oracle 모드, 저장 `/tmp/adr201-g5/uploads` 웹루트 밖, `-Dupload.cors.allowedOrigins=http://localhost:5173`). oracle = 서버 `HEAD` `Upload-Offset` (5173 origin 에서 credentials fetch — CORS Expose-Headers) + 저장 파일 실물 크기. 결과 JSON: `docs/adr/evidence/201-g5-preview.json` · `201-g5-jsp.json` (로컬).

**G5 preview 축 — `apps/builder/scripts/adr201-g5-live.mjs` 10/10 PASS (71.6s)**

| 단계                                                                                                      | 실측                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 참조 서버 dev-login → 쿠키                                                                                | `JSESSIONID@/upload` · `XSRF-TOKEN@/` (Path `/`, HttpOnly 아님)                                                             |
| Data 패널 Add API (`http://localhost:8080/upload/upload`) → Params 탭 「미리보기에서 실제 업로드」 스위치 | `define_endpoint` → `api_endpoints` 1건 `uploadDryRun: false` (Phase 4 토글)                                                |
| 팔레트 FileUpload + `endpoint` prop 연결                                                                  | 문서에는 endpoint id 만 (URL·비밀 0, HC7)                                                                                   |
| Compare Preview → FileTrigger input 에 1GB `setInputFiles`                                                | 엔진 lazy 로드 → `OPTIONS` → `POST` 201 (X-CSRF-TOKEN = 쿠키값) → `PATCH` 8MB 진행, HEAD `Upload-Length` 1,073,741,824      |
| 중단 A — `context.setOffline(true)` 3.5s (20%, 서버 offset 209,715,200)                                   | PATCH 1 실패 → backoff → `HEAD` 218,103,808 재동기 → 같은 URL 로 계속 (24%, 260,046,848) — 재전송 1 청크                    |
| 중단 B — 45% 에서 builder `page.reload` → Compare 다시 → 같은 파일 재선택                                 | localStorage `cu:<fingerprint>` 1건 → `HEAD` 478,150,656 → 그 offset 부터 (POST 재생성 0 · URL 동일 · 재전송 0)             |
| 완료                                                                                                      | `HEAD` offset == length == 1,073,741,824 · 저장 파일 1,073,741,824 B · 행 `done` · `cu:*` forget 0건                        |
| wire                                                                                                      | POST 1 · PATCH 204 ×128 (= 1GB / 8MB) + 실패 1 (오프라인) · 전부 X-CSRF-TOKEN                                               |
| 문서 write 0 · page error 0 · console error 0                                                             | `st.elements` 에 selectedFiles·파일명 0 (오프라인 구간 XHR 오류 로그 · API 편집기 자동 Send 의 GET 405 는 제외 — 아래 함정) |

**G5 JSP 축 — `apps/builder/scripts/adr201-g5-jsp-live.mjs` 7/7 PASS (49.5s)**: 참조 서버 war 에 동봉된 `upload.jsp` (same-origin, IIFE global `CompositionUpload`, CSRF = `<meta name="_csrf">` → `getHeaders`) 에서 같은 1GB → 일시정지 버튼 (서버 offset 2.5s 정지 176,160,768 → 재개 같은 URL) → 오프라인 3.5s (436,207,616 → HEAD 재동기 → 478,150,656) → 완료 offset == length · 저장 파일 실물 · `cu:*` forget. wire: POST 1 · PATCH 204 ×127 + 실패 2 (pause abort 1 · 오프라인 1) — abort 된 PATCH 1건은 서버가 이미 적용해 offset 이 앞서 있었다 (**서버 `Upload-Offset` 이 진실**, 클라이언트 카운터 불인정 — HC3 실증).

**G5 가 잡은 결함·함정 (전부 수리·기록)**:

1. 참조 서버 CSRF 403 이 CORS 헤더 없이 나가 브라우저에서 `E_NETWORK` 로 보였다 (필터가 MVC CORS 앞) — 원인은 아래 2 였고, 계약 §9 표의 "403 → E_UNAUTHORIZED" 는 same-origin 에서만 성립. 교차 출처 운영은 계약이 권장하지 않는다 (§5).
2. **builder API 편집기의 자동 Send 가 dev proxy (`/api/proxy`) 를 지나 참조 서버에 새 세션을 만들고, 그 `Set-Cookie` 가 5173 응답으로 돌아와 호스트 `localhost` 의 `XSRF-TOKEN` 을 다른 세션 값으로 덮었다** → 하니스는 endpoint 정의 뒤 dev-login 을 다시 한다. 제품 영향: dev 서버 한정 (production builder 는 proxy 없음 · publish 는 same-origin).
3. JSP 초안이 엔진 API 를 잘못 가정 (`subscribe(event)` · `autoUpload` · `item.error`) → 실제 시그니처 (`subscribe(items[])` · `autoProceed` · `lastError`) 로 정정. DispatcherServlet `/` 가 정적 `js/*.iife.js` 를 삼켜 404 → `configureDefaultServletHandling` 추가.
4. `XSRF-TOKEN` 쿠키 Path 는 `/` — 컨텍스트 경로 (`/upload`) 면 다른 컨텍스트의 publish 페이지가 `document.cookie` 로 못 읽는다.
5. API 편집기 자동 Send 는 TUS endpoint 에 GET 을 보내 405 를 콘솔에 남긴다 (데이터 소스가 아닌 endpoint 의 노이즈 — 결함 아님). → **후속 1 로 수리 (아래)**.

**후속 2건 (2026-09-17, Implemented 뒤 같은 날)** — 둘 다 G5 가 드러낸 것.

1. **업로드 endpoint 의 GET 프로브 노이즈 (UX)** — 실행기가 `405`/`412` + `Tus-Resumable` 응답을 "업로드 endpoint" 로 분류한다 (`stores/utils/uploadEndpointProbe.ts`): `console.error`·`errors` Map 대신 `console.info` 1줄, API 편집기 Response 탭은 실패 상태 줄·본문 대신 **업로드 endpoint 안내** (`[data-upload-endpoint]` = TUS 버전 · `Allow` 메서드 · "데이터 소스가 아니다") + 「미리보기에서 실제 업로드」 스위치를 그 자리에 함께 그린다 (Params 탭과 같은 `define_endpoint` 경로). 자동 Send 자체는 유지 — 생성 시점엔 endpoint 종류를 알 수 없고, 응답이 분류 근거다. 함정: `{version}` 파라미터 메시지는 `formattedMessages` 함수 등록이 있어야 치환된다 (정적 문자열만 두면 live 에서 `TUS {version}` 그대로 노출 — 첫 live 실행이 잡음).
2. **FileUpload active 분기 lazy 분리 (번들)** — `FileUpload.tsx` 는 idle 껍데기 (입력 표면 + 샘플 행 + 유입 컨텍스트) 만 initial 에 남고, endpoint 해석 (`resolveUploadEndpoint` → vault placeholder 게이트) · CSRF 쿠키→헤더 · 엔진 옵션 조립 · 런타임 행 (GridList + ProgressBar) 은 `FileUploadActive.tsx` 로 옮겨 첫 파일 유입 때 `import()` 한다. 엔진은 그 뒤 `loadEngine` 으로 따로 — 막힌 endpoint (`E_UNAUTHORIZED`/`E_NO_ENDPOINT`) 면 엔진은 여전히 로드되지 않는다 (m4). 게이트 `adr201-bundle-gate.mjs` 에 `uploadActiveLazy` 조건 추가 (self-test 음성 fixture 5).

| 실측 (before `ae749d9db` clean → after 같은 revision + 후속 2건, `docs/adr/evidence/201-followup-*`) |                                                           Builder initial gz |                                   Preview initial gz |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------: | ---------------------------------------------------: |
| before                                                                                               |                                                                    1,328,840 |                                              601,515 |
| after                                                                                                |                                                                    1,329,106 |                                              601,303 |
| Δ                                                                                                    | **+266** (후속 1 의 편집기 분기·i18n ko/en·프로브 분류기 추가 − 후속 2 절감) | **−212** (raw −1,802; preview 에는 후속 1 코드 없음) |

절감이 예상 (~2.5 KB) 보다 작다 — active 분기는 JSX 속성 이름 반복이라 gzip 이 잘 되고 initial 에서 빠진 실제 gzip 몫은 ~250 B 였다. 게이트 판정: `uploadEngineLazy`·`uploadActiveLazy`·Δ·Preview 절대 상한 통과, **Builder 절대 상한 (1,328,315) 은 before 시점에 이미 +525 초과** (ADR-201 종결 뒤 들어온 다른 세션의 PageHeaderLayer 커밋 `2c00aa0d3`·`ae749d9db` 몫) → 후속 뒤 +791. 이 초과분은 201 의 재승인 범위가 아니라 별도 판정 대상이다.

**후속 live — `adr201-g5-live.mjs` 12/12 PASS (71.7s, headless Chromium)**: 종전 10 단계 + ① 자동 Send 405 → Response 탭 `[data-upload-endpoint="1.0.0"]` · "Upload endpoint (TUS 1.0.0)" · Allow `POST, OPTIONS` · 전송 토글 · 실패 상태 줄 0 · '실행 실패' console.error 0 (하니스 제외 목록에서 이 항목 삭제) ② lazy 경계 — 파일 선택 전 `FileUploadActive`·엔진 모듈 요청 0, 선택 직후 (21.8s) 둘 다 `/@fs/…` 로 요청. 1GB 업로드 → 단절 3.5s 재개 → 새로고침 재개 → 완료 offset == length. 함정: **하니스 실행 중 소스를 편집하면 dev 서버 HMR 이 preview iframe 을 교체해 `Frame was detached` 로 끝난다** (첫 실행 8/9 — `translations.ts` 편집이 원인, 재실행 12/12).

**선행 기록 (통합 시점, 2026-09-17)** — 엔진 G0 100MB 진행률 15회 · 단절 2회 재개 재전송 8MB · G1 4GB×3 힙 Δ 중앙값 2.22MB · 재개 3경로 4.06MB/0/0 · core+tus 5,852 B / IIFE 8,068 B gz · **tusd v2.10.1 대조군 8/8 (G2a)** · G2b `mvn -q test` 53/53 (JDK 17) + cargo 기동 curl 흐름 · 웹루트 저장 기동 거부 실물 · FileUpload 실배선 live 20/20 (engine=loaded) · initial 번들 상한 재승인 (사용자).

## Consequences

### Positive

- `@composition/upload` 가 composition 밖 (JSP/Spring 고객 페이지, 향후 Electron/Node) 에서도 동작하는 첫 독립 TS package — `engine` 의 "독립 엔진 + consumer" 구조를 TS 층에도 확립. `packages/upload-engine` 신설, `@composition/specs` 동형 배포 형태.
- 잘못된 런타임→문서 채널 (`renderFileTrigger` `selectedFiles` write) 제거 — canonical document 가 런타임 상태로 오염되지 않는다.
- `CAPABILITY_REGISTRY` 에 DropZone/FileTrigger 가 등재되어 기존 두 컴포넌트도 규칙 트리거가 된다.
- 서버 계약 문서 + Spring 참조 구현 + JSP 예제로 초기 고객 (Java 8/Spring 5/Tomcat/Oracle) 이 즉시 도입 가능 — 다른 언어 서버는 표준 TUS 구현체 (tusd/tus-node-server/tusdotnet) 로 대체 가능.
- 보안 의무 조항이 계약·공격 corpus·정적 게이트로 코드화 — "보안 업로드" 를 문구가 아니라 검증으로 제공.

### Negative

- 저장소에 Java 산출물 (`examples/upload-server-spring/`) 이 들어와 별도 CI job (JDK 8) 과 계약 버전 동기 부담이 생긴다 (R6).
- 등록 8지점 + capability + package 1개 신설로 Phase 3 변경 파일이 넓다 (catalog · binding · rule · factory · defaults · rendererMap · palette · publish registry · `FormRenderers.tsx`).
- 커스텀 완료/오류 이벤트를 interaction rule 로 못 건다 (v1) — 업로드 후 페이지 이동 같은 연쇄는 ADR-158 개정 또는 별도 ADR 후속까지 컴포넌트 내부 표시로 한정.
- Skia 는 샘플 상태만 그리므로 빌더 캔버스에서 실제 진행률·파일 목록은 보이지 않는다 — preview 에서만 확인 (설계상 의도, R7).
