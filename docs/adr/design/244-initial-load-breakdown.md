# ADR-244 구현 상세 — CanvasKit wasm 미리 받기 · 고유 경로화

> 본문: [ADR-244](../244-canvaskit-wasm-early-fetch-and-service-worker-cache.md). 이 문서는 phase · 파일 · 측정 절차만 담는다. 결정 · 위험 · gate 판정은 본문이 정본.
>
> **개정 2026-10-05**: ADR-248 catalog 전환 뒤 코드 인용을 전부 다시 대조했다 — 부팅 진입점 `CatalogBuilderCore.tsx` · 종점 `composition:builder.presented` mark · 문서 열기 구간 · 배포 복구 · `deploy.yml` 경로 필터 없음.

## §1 전제 점검 (fork · 의존 방향)

- 새 ADR 이며 기존 ADR 의 잔여 분리가 아니다. ADR-242 (패널 lazy · idle 선로드 · WebKit modulepreload 함정 수리) 와 ADR-201 (initial 상한) 은 **제약으로만** 읽는다 — 의존 방향: 244 → 242 · 201 (역방향 없음).
- ADR-248 (catalog 문서 · runtime) 과 ADR-247 (정적 셸 · 부팅 mark) 은 **측정 지점으로만** 읽는다 — 244 는 부팅 effect 의 순서 · 문서 열기 · 셸을 바꾸지 않는다.
- base / 응용 구분 없음. 저장 스키마 변경 0 · SSOT 경계 변경 0.
- Service Worker (대안 B) 는 이 ADR 의 phase 가 아니다. 재개는 본문 Decision 4 의 조건 + 사용자 판정.

## §2 Phase 0 — 측정 하니스 · 기준선 (제품 동작 변경 0)

### 2.1 GitHub Pages 헤더 모사 서버 `apps/builder/scripts/adr244-pages-server.mjs` (신규)

- `dist/` 를 `/composition/` 아래로 제공. 모든 응답 `Cache-Control: max-age=600` (옵션 `--max-age <초>` — "10 분 뒤" 조건은 아래 만료 arm 절차) · 약한 ETag · `If-None-Match` → 304 · gzip (`application/wasm` · js · css · ttf).
- 서버측 대역폭 · RTT 제한 (`--rate 10mbps --rtt 100`) — Chromium CDP 제한과 달리 WebKit 에도 같은 조건을 준다.
- 요청 기록 (경로 · 상태 · 전송 바이트 · 시각) 을 JSON 으로 — 이중 받기 · 재배포 모사 판정의 외부 oracle.
- **만료 arm ("10 분 뒤 재방문") 준비 (리뷰 244 R3 m3)**: 이미 `max-age=600` 으로 저장된 응답은 서버 헤더를 나중에 0 으로 바꿔도 fresh 로 남아 재검증 요청이 가지 않는다 (freshness 는 저장된 응답의 헤더로 계산 — RFC 9111, Chrome 154 격리 실험에서 서버 기록 200 한 건뿐). 그래서 만료 arm 은 **독립 브라우저 profile** 을 처음부터 짧은 수명 (`--max-age 2`) 서버로 prime 하고, 3 초 이상 기다린 뒤 측정 방문을 한다. **사전 조건**: 측정 방문의 서버 기록에 wasm · 폰트 자산마다 `If-None-Match` 조건부 요청 → 304 가 있어야 유효 표본이다 (없으면 그 표본은 폐기 — fresh hit 는 "10 분 안" arm 과 같다). 캐시 전체 삭제는 cold arm 이므로 대체하지 않는다. WebKit 은 격리 실험에서 순차 fetch 도 캐시를 재사용하지 않았다 — 같은 사전 조건으로 걸러지며, 걸러진 수를 기록한다.
- `--dist` 두 개를 받아 실행 중 교체 (재배포 모사, G1).
- 주소창 직접 진입 조건: 서버는 실제 GitHub Pages 처럼 없는 경로 (`/composition/builder/*` · `/composition/dashboard`) 에 `dist/404.html` 을 **404 상태로** 응답한다. `404.html` 은 빌드가 `index.html` 을 복사해 내보낸다 (`vite.config.ts:182` `spaFallbackPlugin`). 서버 구현은 `spa-deep-link-live.mjs` 의 정적 서버를 재사용한다 (`adr248-g5-boot-bundle.mjs` `serveDist` 는 없는 경로를 200 으로 주므로 이 조건에 쓰지 않는다).

### 2.2 부팅 측정 하니스 `apps/builder/scripts/adr244-boot-latency.mjs` (신규)

- Playwright `chromium` · `webkit`. **표본마다 새 persistent profile** (디스크 캐시) — Playwright 일반 context 는 WebKit 에서 `fetch()` 응답을 HTTP 캐시에 두지 않아 재방문 조건이 성립하지 않는다 (`adr244-cache-probe.mjs`, [evidence §6](../evidence/244-phase0-baseline.md)). profile 준비: 서버를 `no-store` 로 두고 dashboard 에서 프로젝트를 만든 뒤 폰트 DB 를 지운다 (프로젝트는 있고 자산은 처음 받는 상태). 인증은 저장된 세션의 localStorage 를 init script 로 심는다. 요소 수가 많은 프로젝트는 준비 단계만 harness 빌드로 제공해 context 안에서 시드한다 (`--seed-count` · `--seed-dist`).
- 시각 기록 (page 안 `performance.now()` · User Timing):
  - `t_press` — 카드 `pointerdown` (RAC `onPress` 대상, `dashboard/index.tsx:184` · `:224`).
  - `t_presented` — `composition:builder.presented` mark (`CatalogBuilderCore.tsx:289`). 계약 지표의 종점.
  - 구간 경계 — 부팅 effect (`CatalogBuilderCore.tsx:175-211`) 의 단계 사이에 **측정용 `performance.mark` 를 추가**한다 (`composition:builder.boot.wasm` · `.fonts` · `.document` · `.workspace` — `stage()` 호출 자리, 동작 변경 0). 옛 `canvasLifecycle` store 의 `bootstrapPhase` 는 쓰는 곳이 없어 구독 대상이 아니다.
  - Resource Timing — `canvaskit*.wasm` · `engine_bg-*.wasm` · `*.ttf` 의 `startTime` · `responseEnd` · `transferSize`.
- 구간: wasm 받기 = `responseEnd − max(startTime, t_press)` (자산별 참고 열), 컴파일/instantiate ≈ `boot.wasm mark − max(wasm responseEnd, engine responseEnd)`, 폰트 = `boot.fonts − boot.wasm` (내장 + 사용자 폰트), 문서 열기 = `boot.workspace − boot.fonts` (library · `CatalogStorage.load` · data store · workspace 생성), 첫 프레임 = `t_presented − boot.workspace`.
- **네트워크 대기 몫 (A 진행 판정의 분자)**: 부팅이 기다린 요청 (`canvaskit*.wasm` · `engine_bg-*.wasm` · 부팅 폰트 `*.ttf`) 마다 구간 `[max(startTime, t_press), responseEnd]` 을 `[t_press, t_presented]` 로 자른 뒤 **합집합 길이**를 잰다. engine · CanvasKit wasm 은 병렬로 초기화되므로 (`wasm-bindings/init.ts:15-52`) 자산별 길이를 더하면 겹친 구간을 두 번 센다 — 합산 금지. 폰트는 wasm 뒤에 순차로 오므로 합집합이 그대로 이어 붙인다. 판정 = 합집합 길이 p50 / press → presented p50 ≥ 30 % (새 프로젝트 기준 — 본문 R8). A 의 이득 상한 참고로 CanvasKit wasm 구간 중 engine wasm 과 겹치지 않는 길이를 따로 기록한다.
- 조건 5 (본문 G0) × 브라우저 2 × 프로파일 2 × n ≥ 10. Chromium 은 CPU 1x/4x 추가. 프로젝트 2 종 (새 프로젝트 · 요소 수가 많은 프로젝트).
- 기록 manifest: SHA · `git status --porcelain` dirty 수 (**빌드 시점**의 제품 소스 dirty > 0 이면 폐기 — 메모리 `feedback-baseline-build-separate-worktree-original-deps`. 실행 시점 dirty 가 하니스 스크립트뿐이면 그 사실을 evidence 에 적는다) · 브라우저 버전 · `visibilityState` · 프로파일 · 프로젝트 종류 · 요소 수.
- 하니스 실행 중 소스 편집 금지 (HMR 무관한 production 빌드지만 dist 교체 방지).

### 2.3 산출

- **완료 (2026-10-05)**: [evidence/244-phase0-baseline.md](../evidence/244-phase0-baseline.md) — A 진행 (몫 81 ~ 87 %) · 폰트 포함 (42 ~ 52 %) · `compileStreaming` 예열 제외 (컴파일 9 ~ 46 ms) · 실제 Pages 방향 일치. 아래 항목은 그 문서가 답한다.
- Chrome warm 컴파일 구간 비교로 코드 캐시 사용 여부 기록 (10 분 안 재방문 vs 첫 방문의 컴파일 구간).
- `WebAssembly.compileStreaming` 예열 변형은 Phase 0 에서 1 회 탐색 측정만 (dashboard 에서 예열 → builder 진입 컴파일 구간). 코드 캐시가 채워지지 않으면 이후 phase 에서 제외.
- 실제 GitHub Pages 1 회 (본문 R6): 배포된 빌드에서 Chromium 조건 2 종의 press → presented · wasm `transferSize` — 모사 서버 값과 방향 비교. 측정용 mark 가 배포된 뒤에 잰다.

## §3 Phase 1 — 대안 D: CanvasKit wasm 해시 경로

> **구현 2026-10-06** — 아래 표대로. 정리: `scripts/prepare-wasm.mjs` · `package.json` 의 `prepare:wasm` · `.gitignore` 의 `apps/builder/public/wasm/` 삭제 (사용자 승인 2026-10-06). `builtinFontFormat.test.ts` 가 `public/wasm/canvaskit.wasm` 을 읽고 있어 패키지 경로 (`require.resolve("canvaskit-wasm/bin/canvaskit.wasm")`) 로 바꿨다 — fresh clone 에는 복사본이 없다. 복구 판정은 `src/builder/main/staleDeployRecovery.ts` (`reloadIfStaleDeploy`), 실패 처리에서 `!code && !opened` 일 때만 부른다. buildId 는 빌드마다 새 값 (`<시각>-<난수>` — 같은 커밋을 다시 빌드해도 해시 자산 이름이 같다는 보장이 없어 빌드가 단위). 재배포 모사 하니스 `apps/builder/scripts/adr244-redeploy-sim.mjs`. 결과는 본문 Status.

| 파일                                                              | 변경                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/initCanvasKit.ts` | `import canvaskitWasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url"` · `locateFile` (`:56`) 이 이 URL 반환 (파일명 검사 후) · `:28` · `:53` 주석 갱신 |
| `apps/builder/src/vite-env.d.ts` (필요 시)                        | `?url` 타입 — Vite client 타입이 이미 제공하면 변경 0                                                                                                   |
| `scripts/prepare-wasm.mjs` · `package.json:42,45`                 | postinstall 에서 `prepare:wasm` 제거. **스크립트 파일 삭제는 사용자 승인 뒤** (승인 전에는 호출만 끊고 파일 유지)                                       |
| `.gitignore:25-26`                                                | `apps/builder/public/wasm/` 줄 정리 (승인 뒤 · 로컬 `public/wasm/` 잔존 파일은 사용자 확인 후 제거)                                                     |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/init.ts` | `catch` (`:49-51`) 가 로그 뒤 다시 throw                                                                                                                |
| `apps/builder/src/builder/main/CatalogBuilderCore.tsx`            | 부팅 effect `.catch` (`:263`) 에 옛 배포 판정 · 복구 1 회 (아래)                                                                                        |
| `apps/builder/vite.config.ts`                                     | `version.json` 내보내기 · `__BUILD_ID__` define                                                                                                         |
| `CLAUDE.md` §명령 · 환경                                          | `pnpm install` 설명의 "canvaskit wasm 복사" 삭제                                                                                                        |

- `deploy.yml` 변경 없음 — 경로 필터가 없어 (main push 마다 배포) 갱신할 조건이 없다.
- **옛 탭 복구 (리뷰 244 R1 h1 · R2)** — 세 부분이 함께 있어야 동작한다.
  1. **오류 전달**: 지금 `initAllWasm` 은 오류를 로그만 남기고 삼킨다 (`wasm-bindings/init.ts:49-51`) — 부팅 effect 의 `.catch` 는 원래 404 가 아니라 뒤따르는 `getCanvasKit()` (`CatalogBuilderCore.tsx:181`) 오류를 받는다. `initAllWasm` 의 `catch` 가 로그 뒤 **다시 throw** 한다 (호출처는 `CatalogBuilderCore.tsx:179` 하나 — `wasmReady` 는 그대로 false).
  2. **옛 배포 판정 — 오류 종류를 해석하지 않는다**: 빌드가 `version.json` (`{ buildId }`) 을 dist 루트에 내보내고 같은 값을 `__BUILD_ID__` (Vite `define`) 로 번들에 넣는다. 부팅 effect 의 `.catch` 가 `state.kind = "failed"` 를 세우기 **전에** `fetch(import.meta.env.BASE_URL + "version.json", { cache: "no-store" })` 로 서버의 buildId 를 읽어 **내 buildId 와 다르면 옛 배포**다. wasm 404 · 부팅 chunk 404 · glue/wasm 불일치가 모두 같은 판정으로 잡히고, 브라우저마다 다른 오류 문구 (Chrome `Failed to fetch dynamically imported module` · WebKit `Importing a module script failed`) 를 해석하지 않는다. 같은 buildId 이거나 probe 자체가 실패하면 배포 문제가 아니므로 기존 실패 화면. `CatalogStorageError` (`PROJECT_NOT_FOUND` · `UNSUPPORTED_PROJECT_FORMAT`) 는 배포와 무관하므로 probe 없이 기존 실패 화면으로 간다.
  3. **복구 URL**: 현재 URL 을 `location.reload()` 한다. 실제 Pages 는 `/composition/builder/*` 에 `404.html` (= `index.html`) 을 주므로 SPA 가 다시 부팅해 같은 프로젝트로 들어간다 (Chromium · WebKit 4/4 — `spa-deep-link-live.mjs`, 대조군 404.html 없음 1/3). 반복 차단 표식 = `sessionStorage` 에 서버 buildId — 같은 buildId 로 이미 복구를 시도했으면 반복하지 않고 실패 화면. workspace 를 열기 전 (`:212` 이전 실패) 이라 편집 손실 없음 — 실패가 workspace 생성 뒤라면 복구하지 않는다.
  - 기각한 방법: 루트 `?resume=/builder/<id>` 로 이동하고 루트 라우트가 경로를 복원하는 방식 — 404.html 이 생겨 필요 없어졌다 (제품 코드 추가 · 임의 경로 이동 검사 부담만 남는다). `keep_files` 로 옛 자산 보존은 본문 R5 기각 사유 그대로.
  - unit: buildId 다름 → `reload` 1 회 · 같음 → 0 · probe 실패 → 0 · 표식 있음 → 0 · `CatalogStorageError` → probe 0 · `initAllWasm` 이 원래 오류를 다시 throw.
  - 모사 서버 (§2.1) 는 `version.json` 을 `no-store` 로 주고, 없는 경로는 Pages 와 같이 `404.html` 을 404 상태로 응답한다 — G1 재배포 모사에서 새로고침 뒤 부팅까지 확인.
- 확인: 빌드 산출물에 `assets/canvaskit-<hash>.wasm` 1 개 · `vite-plugin-wasm` (`vite.config.ts:236`) 의 ESM 래퍼가 생기지 않음 · dev (`/@fs/` 경로) 부팅 · browser 테스트 부팅 (`tests/adr248-g3/paletteBaseCanvas.browser.test.ts` · `test:parity`).
- `?url` 이 막히면 대체: 작은 Vite 플러그인이 `generateBundle` 에서 wasm 을 `emitFile` (해시 이름) 하고 `import.meta` 상수로 URL 을 넘긴다.
- G1 재배포 모사: 빌드 N 은 `bin/canvaskit.*`, 빌드 N+1 은 `bin/full/canvaskit.*` (glue · wasm 모두 다름) 를 쓰는 임시 변형 — 측정 전용 worktree 에서만, main 에 커밋하지 않는다.
- 원복 RED: D 커밋을 되돌린 빌드에서 재배포 모사가 "새 glue + HTTP 캐시 옛 wasm" 요청 패턴 (서버 기록에 wasm 요청 0 또는 304) 을 보이는지.

## §4 Phase 2 — 대안 A: 미리 받기 (G0 판정이 진행일 때만)

### 4.1 모듈 경계

- `apps/builder/src/dashboard/canvasWarmup.ts` (신규, lazy chunk) — 받을 URL 목록 (`canvaskit-wasm/bin/canvaskit.wasm?url` · engine wasm URL · 조건부 폰트 `resolveFontUrl("fonts/PretendardVariable.ttf")` 등) 과 받기 함수.
  - `fetch(url, { credentials: "same-origin" })` (CanvasKit 로더와 같은 모드) → `response.body.pipeTo(new WritableStream())` 로 끝까지 흘림 (메모리 보관 0).
  - **자산별 promise (리뷰 244 R3 h1)**: `window.__composition_CANVAS_WARMUP__` 은 promise 하나가 아니라 `Map<절대 URL, Promise<void>>` 다 (`initCanvasKit.ts:12-13` 전역 키 관례). 소비자는 **자기 URL 의 항목만** 기다린다 — CanvasKit 로더가 폰트 받기를, 폰트 로더가 wasm 받기를 기다리는 일이 없다. 전체를 묶은 promise 는 만들지 않는다.
  - **폰트는 IndexedDB 에 없을 때만 받는다**: 받기 전에 `composition-fonts` store 를 열어 그 폰트 키가 있으면 URL 을 목록에서 뺀다 (`fontManager.ts:386` `getFromCache` 와 같은 키 — 키 계산은 initial 에 있는 작은 순수 함수로 공유, `fontManager` 자체는 import 하지 않는다). IDB 를 열 수 없으면 폰트를 받지 않는다 (안전한 쪽). HTTP 폰트 캐시는 축출됐지만 IDB 폰트가 살아 있는 재방문에서 필요 없는 6.7 MB 전송 · 대기가 생기지 않는다.
  - engine wasm URL 은 `engine-pkg/engine_bg.wasm?url` 로 얻는다 — `vite-plugin-wasm` 이 내보내는 파일과 **같은 해시 경로**인지 빌드 산출물로 확인하고, 다르면 engine 은 미리 받기 대상에서 뺀다 (다른 URL 을 받으면 낭비만 남는다).
  - **정적 import 금지 대상**: `initCanvasKit` · `canvaskit-wasm` · `wasm-bindings/*` · builder lazy chunk. 허용: initial 에 이미 있는 모듈만.
- `apps/builder/src/dashboard/index.tsx` — dashboard 가 그려진 뒤 idle (`requestIdleCallback` · 없으면 `setTimeout`, `lazyPanel.tsx:140-141` 관례) 과 카드 `onHoverStart` · `onFocus` · `onPressStart` 에서 `import("./canvasWarmup")` 1 회. `navigator.connection?.saveData` · `document.visibilityState !== "visible"` 이면 건너뜀. 실패는 조용히 무시.
- **소비자 3 곳이 각자 자기 자산만 기다린다** — 공통 helper `awaitWarmup(url, 상한)` (initial 에 있는 작은 모듈: Map 에 그 URL 이 있으면 상한 시간 (예: 10 s) 안에서 기다리고, 없음 · 실패 · 초과면 바로 진행):
  - `initCanvasKit.ts` — `CanvasKitInit` 호출 전에 CanvasKit wasm URL.
  - `wasm-bindings/engineWasm.ts` — `import("./engine-pkg/engine.js")` (`:112`) 전에 engine wasm URL (리뷰 244 R3 m2). `initAllWasm` 은 engine 을 CanvasKit 보다 먼저 시작하므로 (`init.ts:31-45`) 이 대기가 없으면 진행 중인 예열 요청과 겹쳐 같은 자산을 두 번 받는다 (WebKit 격리 실험 2 회 전송).
  - `fontManager.ts` `loadFont` — `getFromCache` 가 miss 일 때만 (`:90-93`), `fetch` 전에 그 폰트 URL. IDB hit 면 Map 을 보지 않는다.
- 폰트 포함 여부: Phase 0 에서 첫 방문 폰트 구간이 press → presented 의 20 % 이상일 때만. 폰트는 두 번째 방문부터 IndexedDB (`fontManager.ts:90`) 가 덮으므로 이득은 첫 방문 한정.

### 4.2 정적 가드

- `apps/builder/src/dashboard/canvasWarmup.static.test.ts` (신규) — 소스의 import 문을 읽어 금지 대상 (§4.1) 을 가리키면 실패. 원복 RED: 금지 import 1 줄을 넣으면 RED.
- 번들 확인은 G3 (`adr209-bundle-closure.mjs` 의 `dynamicTargets` 에 warmup chunk, initial 집합에 없음).

### 4.3 G2 측정 조건 추가

- 즉시 클릭 (dashboard 표시 직후 press) · 대기 뒤 클릭 (idle 받기 완료 확인 뒤) · 진행 중 진입 (받기 시작 후 200 ms 에 press) · 주소창 직접 진입.
- 진행 중 진입의 전송 1 회 판정은 **CanvasKit wasm · engine wasm 각각** 서버 기록으로 본다 (Chromium · WebKit).
- 불리 조건 추가 (리뷰 244 R3 h1): **IDB 폰트 있음 + HTTP 캐시 비움 + 제한 프로파일** 재방문 — 서버 기록에 폰트 ttf 요청 0, press → presented 가 대조군 +5 % 이내. 원복 RED: 자산별 Map 을 promise 하나로 되돌리면 이 조건에서 폰트 전송과 대기가 검출된다.
- 대조군: 같은 빌드에 `?warmup=0` (또는 localStorage 스위치) 로 끔 — 빌드 편차 제거. 변경 전 SHA worktree 빌드는 G3 번들 비교와 D 전후 비교에만.
- dashboard long task: `PerformanceObserver("longtask")` (Chromium) — WebKit 은 미지원, 기록만.

### 4.4 G4 실패 주입

- 하니스 `--fail warm-abort` (서버가 미리 받기 요청만 중간 끊기 — 요청 헤더 표식은 쓰지 않고 시각 창으로 구분) · `--fail warm-404` (첫 요청만 404) · `--fail warmup-chunk-404`.
- 기대: builder 부팅 성공 · builder 가 받는 wasm · chunk 요청 정상 · page error 0 · WebKit 은 새로고침 뒤 한 번 더.

## §5 Phase 3 — 종결

- G3 번들 (변경 전 SHA · after 둘 다 별도 worktree, frozen lockfile, `pnpm wasm:build:engine`) · README · CHANGELOG · Live Exercise.
- 실제 GitHub Pages 에서 Chromium 조건 2 (첫 방문 대기 뒤 클릭 · 10 분 안 재방문) 1 회 재측정 — D (+ A) 가 배포된 뒤, Phase 0 의 실제 Pages 값과 비교.

## §6 Service Worker 재개 시 확인 목록 (참고 — 이 ADR 의 phase 아님)

재개 조건 충족 시 새 ADR 의 Context 로 옮길 항목:

- 해시 경로 (Phase 1) 선행 · precache manifest revision · `skipWaiting` 금지 (실행 중 탭 자산 교체 = HC2 위반) · kill switch SW (같은 URL, 모든 캐시 삭제 + unregister).
- 범위 `/composition/` 에 들어오는 것: 빌더 문서 · `/publish/*` route · `preview.html` (Preview iframe 은 `CatalogPreviewFrame.tsx:131` 이 `/preview.html?catalog=1` 루트 절대 경로라 production 범위 밖 — 실제 동작 확인 필요).
- 등록은 배포 호스트에서만 (`localhost:4173` 등록 시 이후 로컬 빌드 · 하니스가 옛 자산을 받는다).
- SW 가 오류 응답을 합성하지 않는다 (모듈 실패 캐시) · 모든 실패는 네트워크로.
- WebKit 7 일 스크립트 저장소 삭제 · origin 공유 quota (IndexedDB 프로젝트 · 폰트) · `storage.persist()` 와의 관계.
- 이전 배포 탭의 chunk 404 완화 (peaceiris 파일 삭제) 가 SW 의 부수 이득인지 측정.
- main push 마다 배포되는 주기에서 SW 대기 (waiting) 가 쌓이는 정도.
