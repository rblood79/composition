# ADR-244 구현 상세 — CanvasKit wasm 미리 받기 · 고유 경로화

> 본문: [ADR-244](../244-canvaskit-wasm-early-fetch-and-service-worker-cache.md). 이 문서는 phase · 파일 · 측정 절차만 담는다. 결정 · 위험 · gate 판정은 본문이 정본.

## §1 전제 점검 (fork · 의존 방향)

- 새 ADR 이며 기존 ADR 의 잔여 분리가 아니다. ADR-242 (패널 lazy · idle 선로드 · WebKit modulepreload 함정 수리) 와 ADR-201 (initial 상한) 은 **제약으로만** 읽는다 — 의존 방향: 244 → 242 · 201 (역방향 없음).
- base / 응용 구분 없음. 저장 스키마 변경 0 · SSOT 경계 변경 0.
- Service Worker (대안 B) 는 이 ADR 의 phase 가 아니다. 재개는 본문 Decision 4 의 조건 + 사용자 판정.

## §2 Phase 0 — 측정 하니스 · 기준선 (코드 동작 변경 0)

### 2.1 GitHub Pages 헤더 모사 서버 `apps/builder/scripts/adr244-pages-server.mjs` (신규)

- `dist/` 를 `/composition/` 아래로 제공. 모든 응답 `Cache-Control: max-age=600` (옵션 `--max-age 0` 으로 "10 분 뒤" 모사) · 약한 ETag · `If-None-Match` → 304 · gzip (`application/wasm` · js · css · ttf).
- 서버측 대역폭 · RTT 제한 (`--rate 10mbps --rtt 100`) — Chromium CDP 제한과 달리 WebKit 에도 같은 조건을 준다.
- 요청 기록 (경로 · 상태 · 전송 바이트 · 시각) 을 JSON 으로 — 이중 받기 · 재배포 모사 판정의 외부 oracle.
- `--dist` 두 개를 받아 실행 중 교체 (재배포 모사, G1).
- 주소창 직접 진입 조건: 서버는 실제 GitHub Pages 처럼 없는 경로 (`/composition/builder/*` · `/composition/dashboard`) 에 `dist/404.html` 을 **404 상태로** 응답한다. `404.html` 은 빌드가 `index.html` 을 복사해 내보낸다 (`vite.config.ts` `spaFallbackPlugin` — 2026-09-27 사용자 판정, 이 ADR 밖 별도 커밋. 그전에는 Pages 에서 이 경로가 404 로 끝나 직접 진입 자체가 되지 않았다). 서버 구현은 `spa-deep-link-live.mjs` 의 정적 서버를 재사용한다.

### 2.2 부팅 측정 하니스 `apps/builder/scripts/adr244-boot-latency.mjs` (신규)

- Playwright `chromium` · `webkit`. 컨텍스트마다 새 저장소 (첫 방문) 또는 같은 컨텍스트 재사용 (재방문).
- 시각 기록 (page 안 `performance.now()`):
  - `t_press` — 카드 `pointerdown` (RAC `onPress` 대상, `dashboard/index.tsx:191` · `:231`).
  - `useCanvasLifecycleStore.subscribe` 로 `bootstrapPhase` 전이 시각 (`wasm` · `fonts` · `surface` · `first-frame` · `ready`).
  - Resource Timing — `canvaskit*.wasm` · `engine_bg-*.wasm` · `*.ttf` 의 `startTime` · `responseEnd` · `transferSize`.
- 구간: wasm 받기 = `responseEnd − max(startTime, t_press)` (자산별 참고 열), 컴파일/instantiate ≈ `fonts 시작 − max(wasm responseEnd, engine responseEnd)`, 폰트 = `surface − fonts`, 나머지 = `ready − surface`.
- **네트워크 대기 몫 (A 진행 판정의 분자)**: 부팅이 기다린 요청 (`canvaskit*.wasm` · `engine_bg-*.wasm` · 부팅 폰트 `*.ttf`) 마다 구간 `[max(startTime, t_press), responseEnd]` 을 `[t_press, t_ready]` 로 자른 뒤 **합집합 길이**를 잰다. engine · CanvasKit wasm 은 병렬로 초기화되므로 (`SkiaCanvas.tsx:609-610` · `wasm-bindings/init.ts:15-52`) 자산별 길이를 더하면 겹친 구간을 두 번 센다 — 합산 금지. 폰트는 wasm 뒤에 순차로 오므로 합집합이 그대로 이어 붙인다. 판정 = 합집합 길이 p50 / press → ready p50 ≥ 30 %. A 의 이득 상한 참고로 CanvasKit wasm 구간 중 engine wasm 과 겹치지 않는 길이를 따로 기록한다.
- 조건 5 (본문 G0) × 브라우저 2 × 프로파일 2 × n ≥ 10. Chromium 은 CPU 1x/4x 추가.
- 기록 manifest: SHA · `git status --porcelain` dirty 수 (> 0 이면 폐기 — 메모리 `feedback-baseline-build-separate-worktree-original-deps`) · 브라우저 버전 · `visibilityState` · 프로파일 · 프로젝트 종류.
- 하니스 실행 중 소스 편집 금지 (HMR 무관한 production 빌드지만 dist 교체 방지).

### 2.3 산출

- `docs/adr/evidence/244-phase0-baseline.md` (로컬 evidence) — 표 + A 진행 판정 (네트워크 대기 몫 ≥ 30 %).
- Chrome warm 컴파일 구간 비교로 코드 캐시 사용 여부 기록 (10 분 안 재방문 vs 첫 방문의 컴파일 구간).
- `WebAssembly.compileStreaming` 예열 변형은 Phase 0 에서 1 회 탐색 측정만 (dashboard 에서 예열 → builder 진입 컴파일 구간). 코드 캐시가 채워지지 않으면 이후 phase 에서 제외.

## §3 Phase 1 — 대안 D: CanvasKit wasm 해시 경로

| 파일                                                              | 변경                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/initCanvasKit.ts` | `import canvaskitWasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url"` · `locateFile` 이 이 URL 반환 (파일명 검사 후) |
| `apps/builder/src/vite-env.d.ts` (필요 시)                        | `?url` 타입 — Vite client 타입이 이미 제공하면 변경 0                                                                 |
| `scripts/prepare-wasm.mjs` · `package.json:45,48`                 | postinstall 에서 `prepare:wasm` 제거. **스크립트 파일 삭제는 사용자 승인 뒤** (승인 전에는 호출만 끊고 파일 유지)     |
| `.gitignore:26`                                                   | `apps/builder/public/wasm/` 줄 정리 (승인 뒤 · 로컬 `public/wasm/` 잔존 파일은 사용자 확인 후 제거)                   |
| `.github/workflows/deploy.yml:50`                                 | 경로 필터 `apps/builder/public/(fonts                                                                                 | wasm)/`→`apps/builder/public/fonts/`+`pnpm-lock.yaml` 의 canvaskit 변경 감지 추가 |
| `docs/RENDERING_ARCHITECTURE.md` §5.2                             | 로드 경로 설명 갱신                                                                                                   |

- **옛 탭 복구 (리뷰 244 R1 h1 · R2)** — 세 부분이 함께 있어야 동작한다.
  1. **오류 전달**: 지금 `initAllWasm` 은 오류를 로그만 남기고 삼킨다 (`wasm-bindings/init.ts:48-50`) — `SkiaCanvas.tsx` 의 `catch` 는 원래 404 가 아니라 뒤따르는 `getCanvasKit()` 오류를 받는다. `initAllWasm` 의 `catch` 가 로그 뒤 **다시 throw** 한다 (호출처는 `SkiaCanvas.tsx:610` 하나 — `wasmReady` 는 그대로 false).
  2. **옛 배포 판정 — 오류 종류를 해석하지 않는다**: 빌드가 `version.json` (`{ buildId }`) 을 dist 루트에 내보내고 같은 값을 `__BUILD_ID__` (Vite `define`) 로 번들에 넣는다. 부팅 실패 시 `fetch(import.meta.env.BASE_URL + "version.json", { cache: "no-store" })`로 서버의 buildId 를 읽어 **내 buildId 와 다르면 옛 배포**다. wasm 404 · 부팅 chunk 404 · glue/wasm 불일치가 모두 같은 판정으로 잡히고, 브라우저마다 다른 오류 문구 (Chrome`Failed to fetch dynamically imported module`· WebKit`Importing a module script failed`) 를 해석하지 않는다. 같은 buildId 이거나 probe 자체가 실패하면 배포 문제가 아니므로 기존 `failCanvasBootstrap` 오류 표시.
  3. **복구 URL**: 현재 URL 을 `location.reload()` 한다. 실제 Pages 는 `/composition/builder/*` 에 `404.html` (= `index.html`) 을 주므로 SPA 가 다시 부팅해 같은 프로젝트로 들어간다 (Chromium · WebKit 4/4 — `spa-deep-link-live.mjs`, 대조군 404.html 없음 1/3). 반복 차단 표식 = `sessionStorage` 에 서버 buildId — 같은 buildId 로 이미 복구를 시도했으면 반복하지 않고 오류 표시. 캔버스 부팅 전이라 편집 손실 없음.
  - 기각한 방법: 루트 `?resume=/builder/<id>` 로 이동하고 루트 라우트가 경로를 복원하는 방식 — 404.html 이 생겨 필요 없어졌다 (제품 코드 추가 · 임의 경로 이동 검사 부담만 남는다). `keep_files` 로 옛 자산 보존은 위 R5 기각 사유 그대로.
  - unit: buildId 다름 → `reload` 1 회 · 같음 → 0 · probe 실패 → 0 · 표식 있음 → 0 · `initAllWasm` 이 원래 오류를 다시 throw.
  - 모사 서버 (§2.1) 는 `version.json` 을 `no-store` 로 주고, 없는 경로는 Pages 와 같이 `404.html` 을 404 상태로 응답한다 — G1 재배포 모사에서 새로고침 뒤 부팅까지 확인.
- 확인: 빌드 산출물에 `assets/canvaskit-<hash>.wasm` 1 개 · `vite-plugin-wasm` 의 ESM 래퍼가 생기지 않음 · dev (`/@fs/` 경로) 부팅 · browser 테스트 (`vitest.browser.config.ts`) 부팅.
- `?url` 이 막히면 대체: 작은 Vite 플러그인이 `generateBundle` 에서 wasm 을 `emitFile` (해시 이름) 하고 `import.meta` 상수로 URL 을 넘긴다.
- G1 재배포 모사: 빌드 N 은 `bin/canvaskit.*`, 빌드 N+1 은 `bin/full/canvaskit.*` (glue · wasm 모두 다름) 를 쓰는 임시 변형 — 측정 전용 worktree 에서만, main 에 커밋하지 않는다.
- 원복 RED: D 커밋을 되돌린 빌드에서 재배포 모사가 "새 glue + HTTP 캐시 옛 wasm" 요청 패턴 (서버 기록에 wasm 요청 0 또는 304) 을 보이는지.

## §4 Phase 2 — 대안 A: 미리 받기 (G0 판정이 진행일 때만)

### 4.1 모듈 경계

- `apps/builder/src/dashboard/canvasWarmup.ts` (신규, lazy chunk) — 받을 URL 목록 (`canvaskit-wasm/bin/canvaskit.wasm?url` · engine wasm URL · 조건부 폰트 `resolveFontUrl("fonts/PretendardVariable.ttf")` 등) 과 받기 함수.
  - `fetch(url, { credentials: "same-origin" })` (CanvasKit 로더와 같은 모드) → `response.body.pipeTo(new WritableStream())` 로 끝까지 흘림 (메모리 보관 0).
  - 결과 promise 를 `window.__composition_CANVAS_WARMUP__` 에 둔다 (`initCanvasKit.ts:12-13` 전역 키 관례).
  - **정적 import 금지 대상**: `initCanvasKit` · `canvaskit-wasm` · `wasm-bindings/*` · builder lazy chunk. 허용: initial 에 이미 있는 모듈만.
- `apps/builder/src/dashboard/index.tsx` — dashboard 가 그려진 뒤 idle (`requestIdleCallback` · 없으면 `setTimeout`, `lazyPanel.tsx:135-146` 관례) 과 카드 `onHoverStart` · `onFocus` · `onPressStart` 에서 `import("./canvasWarmup")` 1 회. `navigator.connection?.saveData` · `document.visibilityState !== "visible"` 이면 건너뜀. 실패는 조용히 무시.
- `initCanvasKit.ts` — `CanvasKitInit` 호출 전에 `window.__composition_CANVAS_WARMUP__` 가 있으면 상한 시간 (예: 10 s) 안에서 기다림, 실패 · 초과면 무시하고 진행.
- 폰트 포함 여부: Phase 0 에서 첫 방문 폰트 구간이 press → ready 의 20 % 이상일 때만. 폰트는 두 번째 방문부터 IndexedDB (`fontManager.ts:90`) 가 덮으므로 이득은 첫 방문 한정.

### 4.2 정적 가드

- `apps/builder/src/dashboard/canvasWarmup.static.test.ts` (신규) — 소스의 import 문을 읽어 금지 대상 (§4.1) 을 가리키면 실패. 원복 RED: 금지 import 1 줄을 넣으면 RED.
- 번들 확인은 G3 (`adr209-bundle-closure.mjs` 의 `dynamicTargets` 에 warmup chunk, initial 집합에 없음).

### 4.3 G2 측정 조건 추가

- 즉시 클릭 (dashboard 표시 직후 press) · 대기 뒤 클릭 (idle 받기 완료 확인 뒤) · 진행 중 진입 (받기 시작 후 200 ms 에 press) · 주소창 직접 진입.
- 대조군: 같은 빌드에 `?warmup=0` (또는 localStorage 스위치) 로 끔 — 빌드 편차 제거. 변경 전 SHA worktree 빌드는 G3 번들 비교와 D 전후 비교에만.
- dashboard long task: `PerformanceObserver("longtask")` (Chromium) — WebKit 은 미지원, 기록만.

### 4.4 G4 실패 주입

- 하니스 `--fail warm-abort` (서버가 미리 받기 요청만 중간 끊기 — 요청 헤더 표식은 쓰지 않고 시각 창으로 구분) · `--fail warm-404` (첫 요청만 404) · `--fail warmup-chunk-404`.
- 기대: builder 부팅 성공 · builder 가 받는 wasm · chunk 요청 정상 · page error 0 · WebKit 은 새로고침 뒤 한 번 더.

## §5 Phase 3 — 종결

- G3 번들 (변경 전 SHA · after 둘 다 별도 worktree, frozen lockfile, `pnpm wasm:build:engine`) · README · CHANGELOG · Live Exercise.
- 배포가 복구돼 있으면 실제 GitHub Pages 에서 Chromium 조건 2 (첫 방문 대기 뒤 클릭 · 10 분 안 재방문) 1 회 재측정 — 복구 전이면 "미측정 · 사용자 확인 대상" 으로 기록.

## §6 Service Worker 재개 시 확인 목록 (참고 — 이 ADR 의 phase 아님)

재개 조건 충족 시 새 ADR 의 Context 로 옮길 항목:

- 해시 경로 (Phase 1) 선행 · precache manifest revision · `skipWaiting` 금지 (실행 중 탭 자산 교체 = HC2 위반) · kill switch SW (같은 URL, 모든 캐시 삭제 + unregister).
- 범위 `/composition/` 에 들어오는 것: 빌더 문서 · `/publish/*` route · `preview.html` (Preview iframe 은 `main/BuilderCanvas.tsx:66` 이 `/preview.html` 루트 절대 경로라 production 범위 밖 — 실제 동작 확인 필요).
- 등록은 배포 호스트에서만 (`localhost:4173` 등록 시 이후 로컬 빌드 · 하니스가 옛 자산을 받는다).
- SW 가 오류 응답을 합성하지 않는다 (모듈 실패 캐시) · 모든 실패는 네트워크로.
- WebKit 7 일 스크립트 저장소 삭제 · origin 공유 quota (IndexedDB 프로젝트 · 폰트) · `storage.persist()` 와의 관계.
- 이전 배포 탭의 chunk 404 완화 (peaceiris 파일 삭제) 가 SW 의 부수 이득인지 측정.
