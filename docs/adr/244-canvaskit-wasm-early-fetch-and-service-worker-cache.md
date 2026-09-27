# ADR-244: 초기 로드 — CanvasKit wasm 미리 받기 · 고유 경로화 (Service Worker precache 는 측정 조건부 보류)

## Status

Proposed — 2026-09-27 (사용자 `/create-adr` — "병렬로 한번에 설계해". 출처: Chrome case study 대조 — Photoshop web 의 Service Worker precache · Google Search speculation rules 의 의도 기반 선요청)

## Context

### 문제

프로젝트 목록 (dashboard) 에서 카드를 누르면 빌더 JS 는 이미 받아져 있다 — `main.tsx:43-44` 가 `Dashboard` · `Builder` 를 정적 import 하므로 builder 코드는 initial 에 있다. 빌더 화면에 들어간 뒤 캔버스가 뜰 때까지 남은 일은 전부 **Skia 부팅**이고, 이 부팅은 route 가 바뀐 뒤에야 시작한다:

1. `SkiaCanvas.tsx:605-632` 마운트 effect → `setBootstrapPhase("wasm")` → `initAllWasm()` (`wasm-bindings/init.ts:15-52`) 가 engine wasm (`engine_bg-*.wasm` 406,190 B, 해시 경로) 과 CanvasKit 을 병렬로 받는다.
2. CanvasKit: `initCanvasKit.ts:51` 가 glue chunk (`canvaskit-*.js` 118,653 B, 해시) 를 `import()` 하고, `:55-57` `locateFile` 이 **고정 경로** `${BASE_URL}wasm/canvaskit.wasm` (7,317,345 B raw) 를 준다. 이 파일은 `scripts/prepare-wasm.mjs:32-42` 가 postinstall (`package.json:48`) 에 `canvaskit-wasm@0.42.0` (`apps/builder/package.json:35` `^0.42.0`) 에서 복사하고 git 은 추적하지 않는다 (`.gitignore:26`).
3. wasm 이 끝난 **뒤에** `setBootstrapPhase("fonts")` → `loadBuiltinFontsToSkia()` (`loadCustomFontsToSkia.ts:62-90`) 가 `PretendardVariable.ttf` 6,739,320 B · `InterVariable.ttf` 879,708 B 를 순서대로 받는다 (`fontManager.ts:93` `fetch`). 두 번째 방문부터는 `fontManager.ts:90` 이 IndexedDB `composition-fonts` 에서 읽어 네트워크를 타지 않는다.
4. `surface` → `first-frame` → `acknowledgePresentedFrame` 이 `isCanvasReady=true` · `bootstrapPhase="ready"` (`canvasLifecycle.ts:84-101`) — 프로젝트 revision 을 담은 프레임이 실제 surface 에 flush 된 뒤에만 켜진다.

CanvasKit 로더의 실제 동작 (`node_modules/.pnpm/canvaskit-wasm@0.42.0/.../bin/canvaskit.js`, 함수 `hb`): `fetch(url, {credentials: "same-origin"})` → `WebAssembly.instantiateStreaming`, 실패 시 ArrayBuffer 경로. glue 에 `instantiateWasm` · `wasmBinary` 주입 지점이 없다 (문자열 0건) — **미리 컴파일한 `WebAssembly.Module` 을 로더에 넘길 수 없고**, 미리 받기는 같은 URL 의 캐시 (HTTP 캐시 또는 Service Worker 의 Cache Storage) 를 거쳐야만 효과가 난다.

배포 조건 (2026-09-27 `curl -I` 실측, `https://rblood79.github.io/composition/`):

- GitHub Pages 는 모든 파일에 `cache-control: max-age=600` · 약한 ETag · gzip 을 준다. `canvaskit.wasm` 전송 크기 **2,963,390 B** (gzip). 헤더를 바꿀 수 없어 해시 자산도 `immutable` 이 될 수 없다 — 10 분이 지나면 자산마다 조건부 재검증 (304 왕복) 이 붙는다.
- `canvaskit.wasm` 은 고정 경로, glue 는 해시 chunk 다. canvaskit-wasm 버전이 바뀐 배포 직후 10 분 안에는 **새 glue + HTTP 캐시의 옛 wasm** 조합이 가능하다 (instantiate 의 import 불일치). 지금은 max-age=600 이 그 창을 10 분으로 묶지만, 고정 경로를 cache-first 로 두는 모든 캐시 층은 이 창을 무기한으로 늘린다.
- **배포가 3 주째 멈춰 있다**: gh-pages 최종 갱신 2026-09-04, `deploy.yml` 최근 5 회 모두 failure (GitHub 공개 API, 2026-09-27). 배포본에서 `fonts/PretendardVariable.ttf` 는 404 다 (09-07 추가 파일). 실제 GitHub Pages 에서 현재 코드를 잴 수 없다 — 측정은 로컬 production 빌드 + GitHub Pages 헤더 모사 서버로 한다.
- `peaceiris/actions-gh-pages@v4` (`deploy.yml:192-199`) 는 `keep_files` 없이 이전 파일을 지운다 — 배포 전에 열린 탭은 이후 lazy chunk 요청이 404 가 된다 (ADR-242 패널 chunk 와 같은 부류).

PWA 요소는 없다: manifest · Service Worker 등록 · Workbox 가 `apps/builder/src` · `index.html` · `preview.html` · `apps/publish/src` 에 0 건. COOP/COEP 없음 (`vite.config.ts:256`).

모듈 실패 캐시 함정 (`vite.config.ts:155-165`, ADR-242 후속): WebKit 은 실패한 `modulepreload` 를 새로고침 뒤에도 기억하고, Chrome 은 실패한 module fetch 를 문서 module map 에 기억해 같은 URL `import()` 가 요청 없이 실패한다 (메모리 `feedback-suspense-fallback-throttle-masks-lazy-panel-latency`). dashboard 와 builder 는 **같은 SPA 문서**라, dashboard 에서 미리 부른 `import()` 가 한 번 실패하면 builder 의 같은 chunk `import()` 까지 막힌다.

외부 사례:

- **Photoshop web** (web.dev "Photoshop's journey to the web"): Workbox Service Worker 가 JS · wasm 을 precache 하고, V8 은 Service Worker 캐시에서 온 wasm 의 최적화 코드를 캐시한다. 팀은 코드 초기화 시간 **−75% 를 추정**했다 ("기기에 따라 다름" — 측정값이 아님). V8 문서 ("Code caching for WebAssembly developers") 의 조건 — 스트리밍 컴파일 · 같은 URL · 캐시에서 온 응답 — 은 지금 로더 (`instantiateStreaming` + HTTP 캐시) 도 만족할 수 있어, Chrome 두 번째 방문에서 이미 코드 캐시를 쓰고 있을 가능성이 있다. **−75% 는 이 저장소로 옮길 수 없는 수치**이고 cold/warm 실측이 먼저다.
- **Google Search speculation rules**: 다음 화면 자원을 hover 의도 ("moderate" eagerness) 에서만 받아 낭비를 줄인다. API (문서 navigation · prerender 전용, Chromium 전용) 는 SPA 안 route 전환에 해당하지 않고, **"의도 · idle 에 다음 화면의 무거운 자원을 받는다" 는 패턴**만 쓴다. `<link rel=prefetch>` 는 Safari 기본 지원이 확인되지 않아 의존하지 않는다.
- **Compression dictionary transport** (Chrome 130+, Safari 미지원): 재배포 delta 에 맞지만 GitHub Pages 가 `Use-As-Dictionary` 헤더를 줄 수 없다 → 범위 밖.

성능 목표 정합: CLAUDE.md 는 "초기 로드 < 3 초 · 초기 번들 < 500 KB" 이고, 실제 운영 상한은 ADR-201 재승인 절 **Builder ≤ 1,421,000 / Preview ≤ 623,000 B gzip (만료 2026-10-25)** 이다 (ADR-242 후속 기록 Builder 1,401,576 · Preview 622,126). 이 ADR 은 initial 을 줄이는 ADR 이 아니다 — initial 은 늘리지 않고 (HC1), 계약 지표는 "빌더 진입 → 첫 캔버스 프레임" 이다. 500 KB 목표와의 간격은 이 ADR 이 다루지 않는다.

### SSOT 3-Domain 판정

D1 · D2 · D3 어느 것도 아니다. 자원 로드 시점 · 캐시 경로만 바꾼다 — DOM · ARIA · props · Canvas/Preview 시각 결과 변경 0.

### Hard constraints

- **HC1 번들** — Builder · Preview initial gzip Δ ≤ **0 B** (별도 worktree clean 빌드 before/after, `adr209-bundle-closure.mjs`). 미리 받기 구현은 initial closure 밖 chunk 여야 한다.
- **HC2 버전 정합** — 어떤 캐시 층에서도 CanvasKit glue 와 wasm 은 **같은 빌드**의 쌍이다. canvaskit 이 바뀐 재배포 뒤 새로 연 탭은 새 쌍만 쓴다.
- **HC3 불리한 경우 비악화** — 첫 방문 즉시 클릭 · 주소창 직접 진입 (`/builder/:id` 새로고침, dashboard 없음) 의 진입 → ready p95 가 대조군 대비 +5 % 이내.
- **HC4 실패 격리** — 미리 받기 실패 (오프라인 · 404 · abort) 가 builder 부팅을 막지 않는다. 로더는 언제나 자기 경로로 다시 받는다. module map 오염 0.
- **HC5 브라우저** — Chrome (Chromium) 과 WebKit 둘 다 측정한다 (Firefox 는 우선 대상 아님 — 메모리 `user-browser-targets-firefox-not-priority`).

### Soft constraints

- 새 런타임 의존 0 이 기본. Workbox 같은 의존은 대안 B 가 채택될 때만 따진다.
- `navigator.connection.saveData` (Chromium) 이 켜져 있으면 미리 받지 않는다.
- 같은 origin (`rblood79.github.io`) 의 저장 공간은 IndexedDB 프로젝트 · 폰트 캐시와 공유한다 (`storageProtection.ts:76` `storage.persist()`). 캐시 층을 더하면 이 몫이 늘어난다.
- 측정 하니스는 기존 `vite preview --base /composition/` 관례 (ADR-242) 와 Playwright Chromium · WebKit 을 쓴다. Compare Mode · Preview 검증은 쓰지 않는다 (메모리 `feedback-no-compare-mode-preview-checks-now`).

## Alternatives Considered

### 대안 A: dashboard 에서 의도 · idle 에 미리 받기 (Service Worker 없음)

- 설명: dashboard 가 그려지고 idle 이 되면 (WebKit 은 `requestIdleCallback` 대신 timeout) 작은 lazy chunk 하나를 불러 CanvasKit wasm · engine wasm (필요 시 glue JS · 폰트 ttf) 을 **`fetch` 로 받아 끝까지 흘려 보낸다** (HTTP 캐시에 저장, 메모리에 보관하지 않음). 프로젝트 카드 hover · focus · press 시작은 같은 동작을 앞당긴다. JS 는 `import()` 로 미리 부르지 않는다 (module map 오염 회피). 미리 받는 중에 사용자가 들어오면 `initCanvasKit` 이 진행 중인 받기를 기다린 뒤 로더를 부른다 (window 전역 promise — `initCanvasKit.ts:12-13` 의 전역 키 관례). 로더에 모듈을 넘길 수 없으므로 `WebAssembly.compileStreaming` 예열은 Chrome 코드 캐시를 채우는지 Phase 0 에서 확인될 때만 변형으로 둔다. 외부 사례: speculation rules 의 hover 의도 패턴 · Photoshop 의 "다음에 쓸 wasm 을 미리".
- 위험: 기술(L) / 성능(M) / 유지보수(L) / 마이그레이션(L)
  - 성능 M: 첫 방문 즉시 클릭이면 미리 받기와 부팅이 대역폭을 나눠 오히려 늦을 수 있다. 진행 중 진입에서 브라우저가 같은 URL 요청을 합치지 않으면 두 번 받는다 (WebKit 미확인). 프로젝트를 열지 않는 방문은 ~3 MB (gzip) 가 낭비. 10 분 뒤 재검증 왕복 · 주소창 직접 진입은 개선되지 않는다.

### 대안 B: Service Worker precache (Workbox 또는 직접 작성)

- 설명: `/composition/` 범위 SW 가 CanvasKit · engine wasm · glue · 폰트를 설치 때 precache 하고, 해시 자산 `/assets/*` 는 cache-first, 문서 navigation 은 network-first. 새 배포는 새 SW (precache manifest 의 revision) 로 알리고, 새 SW 는 모든 탭이 닫힐 때까지 대기 (`skipWaiting` 금지 — 실행 중 탭의 자산이 바뀌면 HC2 위반). production 에서만 등록, 문제 시 같은 URL 에 무력화 SW 를 배포하는 kill switch 필요.
- 위험: 기술(M) / 성능(M) / 유지보수(H) / 마이그레이션(H)
  - 기술 M: 고정 경로 wasm 을 cache-first 로 두면 HC2 위반 창이 무기한 — 대안 D 가 선행 조건. SW 가 오류 응답을 합성하면 WebKit · Chrome 모듈 실패 캐시에 남는다 → 모든 실패를 네트워크로 넘겨야 한다.
  - 성능 M: Chrome 코드 캐시는 HTTP 캐시로도 이미 얻을 수 있어 SW 의 추가 이득은 "10 분 뒤 재검증 왕복 제거 · HTTP 캐시 축출 내성" 뿐일 수 있다 — 크기는 미측정. 첫 방문에는 설치 precache 가 부팅과 대역폭을 나눈다.
  - 유지보수 H: SW 수명주기 (대기 · 활성 · 여러 탭) 가 모든 배포의 동작을 바꾼다. 범위 `/composition/` 에 `/publish/*` route 가 함께 들어온다. `localhost:4173` 에 등록된 SW 는 이후 다른 로컬 빌드 · 하니스에 옛 자산을 준다 (이 저장소는 production preview 하니스를 자주 돌린다). WebKit 은 7 일 사용 없는 사이트의 스크립트 저장소 (SW 등록 · Cache Storage) 를 지운다 — best-effort 캐시.
  - 마이그레이션 H: 결함 있는 SW 는 사용자 브라우저에 남아 코드 revert 로 사라지지 않는다 — kill switch SW 배포가 유일한 되돌리기.
  - 부수 이득: 이전 배포 탭의 chunk 404 (peaceiris 가 파일 삭제) 를 SW 캐시가 막을 수 있다 · 오프라인 셸.

### 대안 C: A + B

- 설명: dashboard 의도 · idle 에 SW precache 를 채운다.
- 위험: 기술(M) / 성능(M) / 유지보수(H) / 마이그레이션(H) — B 의 위험을 그대로 가진다.

### 대안 D: CanvasKit wasm 을 해시 경로로 (빌드 산출물화)

- 설명: `initCanvasKit.ts` 에서 `canvaskit-wasm/bin/canvaskit.wasm?url` 을 import 해 Vite 가 `assets/canvaskit-<hash>.wasm` 으로 내보내게 하고 `locateFile` 이 그 URL 을 준다. postinstall 복사 (`prepare-wasm.mjs`) · `public/wasm/` · `.gitignore:26` · `deploy.yml:50` 경로 필터의 `wasm` 을 정리한다. GitHub Pages 는 긴 캐시 헤더를 못 주므로 **이것만으로 속도 이득은 없다** — 이득은 HC2 (glue · wasm 쌍 고정) 와 모든 cache-first 층의 선행 조건.
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L)
  - 기술 L: `vite-plugin-wasm` (`vite.config.ts:144`) 이 `?url` 요청을 가로채지 않는지 빌드 산출물로 확인. 재배포 전 열린 탭은 옛 wasm 이 404 가 된다 (지금은 새 wasm 이 섞여 불일치) — 조용한 불일치가 명시적 부팅 실패로 바뀐다.

### 대안 E: 아무것도 안 함

- 설명: 현재 부팅 경로 유지. Phase 0 측정에서 네트워크 몫이 작으면 (Chrome 코드 캐시 · 폰트 IndexedDB 캐시가 이미 warm 을 덮는 경우) 정답이 될 수 있다.
- 위험: 기술(L) / 성능(M) / 유지보수(L) / 마이그레이션(L)
  - 성능 M: 첫 방문 · 10 분 뒤 방문의 wasm 받기 · 컴파일이 모두 route 전환 뒤 직렬로 남는다 (크기 미측정). HC2 의 10 분 불일치 창도 그대로.

### 검토 후 제외

- Compression dictionary transport — GitHub Pages 헤더 불가 · Safari 미지원.
- `<link rel=prefetch>` · Speculation Rules API — Safari 기본 지원 불확실 / SPA 안 route 전환에 적용되지 않음.
- wasm 바이트를 IndexedDB 에 저장해 blob URL 로 `locateFile` — 폰트 캐시 (`fontManager.ts:386-437`) 와 같은 방식이지만 blob URL 은 Chrome wasm 코드 캐시를 잃고, 캐시 무효화를 직접 만들어야 한다.

### Risk Threshold Check

| 대안 | HIGH+                       | 판정                                                                      |
| ---- | --------------------------- | ------------------------------------------------------------------------- |
| A    | 없음 (성능 M)               | 통과 — Phase 0 측정이 네트워크 몫을 보여 줄 때                            |
| B    | 유지보수 H · 마이그레이션 H | A + D 가 HIGH 없이 첫 방문 · warm 을 다루므로 보류 (재개 조건은 Decision) |
| C    | 유지보수 H · 마이그레이션 H | B 와 같은 이유로 보류                                                     |
| D    | 없음                        | 통과 — 속도 이득 0, HC2 와 모든 cache-first 의 선행 조건                  |
| E    | 없음 (성능 M)               | Phase 0 이 네트워크 몫 < 기준이면 성능 몫은 E 로 종결 (D 만 적용)         |

HIGH 없는 조합 (D + A) 이 있어 루프 불필요.

## Decision

**대안 D 를 적용하고, Phase 0 측정이 기준을 넘으면 대안 A 를 더한다. 대안 B (Service Worker) 는 보류한다.**

1. **Phase 0 먼저** — production 빌드를 GitHub Pages 헤더 모사 서버 (max-age=600 · 약한 ETag · gzip · 서버측 대역폭/RTT 제한 · 요청 기록) 로 띄우고 Chromium · WebKit 에서 "카드 press → `isCanvasReady`" 를 조건별 (첫 방문 즉시 클릭 · 첫 방문 대기 뒤 클릭 · 10 분 안 재방문 · 10 분 뒤 재방문 · 주소창 직접 진입) 로 재고, wasm 받기 / 컴파일 · instantiate / 폰트 / surface · 첫 프레임 구간으로 나눈다. 판정 규칙은 측정 전에 고정한다: 첫 방문 (제한 프로파일) 에서 **route 전환 뒤 네트워크 대기 몫 (wasm + 폰트 받기 구간의 합집합 길이 — 병렬로 받는 engine · CanvasKit wasm 을 겹쳐 세지 않는다, breakdown §2.2) 이 press → ready p50 의 30 % 이상**이면 A 로 진행, 아니면 성능 몫은 E 로 종결하고 D 만 적용한다.
2. **D** — CanvasKit wasm 을 해시 산출물로 옮겨 glue · wasm 쌍을 빌드 단위로 고정한다 (HC2). 성능 결정과 무관하게 적용한다. 복사 스크립트 파일 삭제는 사용자 승인 뒤.
3. **A (조건부)** — dashboard idle 과 카드 의도 (hover · focus · press 시작) 에 lazy chunk 가 wasm (+ Phase 0 이 폰트 구간 비중을 보이면 폰트 ttf) 을 `fetch` 로 받아 HTTP 캐시에 둔다. JS 는 미리 `import()` 하지 않고, 미리 받기 chunk 는 builder 의 lazy chunk 를 정적 import 하지 않는다 (정적 가드). 진행 중 진입은 전역 promise 를 기다려 두 번 받지 않는다. saveData 면 건너뛴다.
4. **B 재개 조건** — A + D 적용 뒤 측정에서 (a) 10 분 뒤 재방문의 재검증 왕복이 10 분 안 재방문 대비 p95 +200 ms 이상 남거나, (b) 사용자 실제 프로필에서 HTTP 캐시 축출로 wasm 을 다시 받는 사례가 확인되거나, (c) 재배포 전 열린 탭의 chunk 404 를 막아야 할 제품 요구가 생기면 — 그때 사용자 판정으로 새 ADR 을 연다 (scope 변경).

**위험 수용 근거**: A 의 성능 M (대역폭 경합 · 이중 받기 · 낭비) 은 G2 의 불리한 경우 3 종 (즉시 클릭 · 진행 중 진입 · 직접 진입) 을 대조군과 같은 빌드에서 재서 관리하고, 기준을 넘으면 트리거를 의도 전용으로 좁히거나 A 를 되돌린다 — 최악의 결과는 "D 만 적용된 현재와 같은 속도" 다. module map 오염 (R3) 은 JS 를 미리 import 하지 않는 설계와 정적 가드로 차단한다.

**기각 · 보류 사유**:

- B · C: 속도 이득의 크기가 미측정인데 (Chrome 은 HTTP 캐시로도 코드 캐시를 얻을 수 있다), 결함 시 되돌리기가 사용자 브라우저에 남는 SW 로 막힌다 — 유지보수 · 마이그레이션 H 를 떠안을 근거가 Phase 0 전에는 없다. 재개 조건을 위에 기록한다.
- E: HC2 의 10 분 불일치 창을 그대로 둔다. 성능 몫은 Phase 0 판정 규칙에 따라 E 로 끝날 수 있다 — 그 경우에도 D 는 적용한다.
- D 단독 (성능 목적): GitHub Pages 헤더 제약으로 속도 이득 0 — 그래서 D 는 정합성 목적으로만 채택한다.

**범위 밖**: 배포 실패 복구 (`deploy.yml` 최근 5 회 failure) · `keep_files` 로 옛 chunk 보존 · GitHub Pages 깊은 링크 404 (`/composition/builder/x` 404 — `404.html` 없음) · 폰트 ttf 의 해시 경로화 (IndexedDB 폰트 캐시가 URL 로 무효화 — 고정 경로라 내용이 바뀌어도 갱신 안 됨, 별도 판단) · initial 500 KB 목표.

> 구현 상세: [244-initial-load-breakdown.md](design/244-initial-load-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 첫 방문 즉시 클릭 · 느린 망에서 미리 받기가 부팅 · dashboard 자원과 대역폭을 나눠 진입이 오히려 늦어진다                                                                                          |  HIGH  | G2 불리 조건 (즉시 클릭 p95 +5 % 이내) · 기준 초과 시 트리거를 의도 전용으로 좁히거나 A 되돌림                                                                                                                                                                                                                                                                                                                                                                                                  |
| R2  | 진행 중 진입에서 브라우저가 같은 URL 요청을 합치지 않아 wasm 을 두 번 받는다 (WebKit 미확인)                                                                                                      |  MED   | 전역 promise 대기 · G2 에서 서버 요청 기록으로 wasm 전송 1 회 확인                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R3  | 미리 받기 chunk 의 `import()` 실패 또는 builder 와 공유하는 lazy chunk 를 정적 import 해 module map 이 오염 — builder 의 같은 chunk 가 요청 없이 실패 (Chrome 문서 단위 · WebKit 새로고침 뒤까지) |  HIGH  | JS 는 `fetch` 로만 예열 · 정적 가드 (미리 받기 chunk 의 정적 import 그래프 ∩ builder lazy chunk = ∅) · G4 실패 주입                                                                                                                                                                                                                                                                                                                                                                             |
| R4  | `?url` 해시화가 `vite-plugin-wasm` · dev 서버 · browser 테스트 (`initCanvasKit` 을 쓰는 visual-parity) · CI 경로 필터와 어긋난다                                                                  |  MED   | G1 — 빌드 산출물 · dev 부팅 · visual-parity smoke · `deploy.yml:50` 필터 갱신                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R5  | D 뒤 재배포 전 열린 탭이 옛 해시 wasm 404 로 캔버스 부팅 실패 (지금은 새 wasm 과 섞여 불일치)                                                                                                     |  MED   | D 에 **부팅 요청 실패 (wasm · 부팅 chunk) 시 자동 새로고침 1 회** 포함 — 캔버스 부팅 전이라 편집 손실 없음, build id 별 `sessionStorage` 표식으로 반복 차단, 두 번째 실패는 기존 `failCanvasBootstrap` 오류 표시 (G1). `keep_files` 로 옛 자산 보존은 채택 안 함 (배포마다 해시 chunk 전부가 gh-pages 에 쌓인다). 부팅 밖 **lazy JS chunk** (패널 등) 의 옛 탭 404 는 D 이전부터 있다 (`deploy.yml` 에 `keep_files` 없음 · `vite:preloadError` 처리 없음) — 일반 처리는 범위 밖 (B 재개 조건 c) |
| R6  | 측정 무효 — 배포 중단으로 실제 GitHub Pages 를 잴 수 없고, 모사 서버 (HTTP/1.1 · 로컬 디스크) 가 CDN · HTTP/2 와 다르다                                                                           |  MED   | 모사 서버가 헤더 · 압축 · 대역폭/RTT 를 명시 재현, 측정 조건 기록. 배포 복구 뒤 실제 GitHub Pages 1 회 재측정 (사용자 확인 대상)                                                                                                                                                                                                                                                                                                                                                                |
| R7  | 프로젝트를 열지 않는 dashboard 방문의 전송 낭비 (~3 MB gzip, 폰트 포함 시 더 큼)                                                                                                                  |  LOW   | idle 트리거는 dashboard 가시 상태에서만 · saveData 건너뜀 · 10 분 창 안 재방문은 HTTP 캐시가 흡수                                                                                                                                                                                                                                                                                                                                                                                               |

HIGH 는 R1 · R3 — 각각 G2 · G4 에 대응한다.

## Gates

측정 공통 조건 (measurement-validity §1): production 빌드 (`vite build` → 헤더 모사 서버, base `/composition/`) · Playwright Chromium · WebKit · `visibilityState=visible` 확인 · 조건마다 n ≥ 10, p50/p95 · 서버측 제한 프로파일 (무제한 · 10 Mbps/100 ms RTT) 두 가지 · Chromium 은 CPU 1x/4x (WebKit 은 CPU 제한 불가 — 기록) · 대조군 = **같은 빌드**에서 미리 받기 끔 (런타임 스위치) + 변경 전 SHA 별도 worktree 빌드 · 측정 대상 = 새 프로젝트 1 + 요소 수가 많은 프로젝트 1 (규모 전용) · 계약 지표 = **카드 press → `isCanvasReady=true`** (`canvasLifecycle.ts:84-101`, 실제 surface flush ack) · 보조 = 서버 요청 기록 (자산별 전송 횟수 · 바이트) 과 Resource Timing `transferSize`.

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 실패 시 대안                                                                                                       |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 종료 | 브라우저 2 × 조건 5 (첫 방문 즉시 클릭 · 첫 방문 대기 뒤 클릭 · 10 분 안 재방문 · 10 분 뒤 재방문 [서버 max-age=0 + ETag 로 모사] · 주소창 직접 진입) × 프로파일 2 의 press → ready p50/p95 와 구간 분해 (wasm 받기 · 컴파일/instantiate · 폰트 · surface/첫 프레임) 기록. Chrome warm 의 컴파일 구간으로 코드 캐시 사용 여부 판정. A 진행 판정 (네트워크 대기 몫 ≥ 30 % — 구간 합집합 길이, 자산별 합산 금지) 기록                                                                                                    | 조건 누락 시 보강 후 재측정. 몫 < 30 % 면 성능 몫은 E 로 종결 (D 만 진행) — 결과를 Status 에 기록                  |
| G1   | Phase 1 (D)  | 빌드에 `canvaskit-<hash>.wasm` 1 개 · `public/wasm` 참조 0 · dev 부팅 · visual-parity smoke PASS. **재배포 모사**: 빌드 N (bin/canvaskit) 로 부팅 → 빌드 N+1 (glue · wasm 모두 다른 변형) 배포 → 새 탭이 N+1 쌍만 요청 (서버 기록) · 부팅 성공 · 옛 탭은 builder 진입 시 옛 해시 wasm · 부팅 chunk 404 → 자동 새로고침 1 회 → N+1 쌍으로 부팅 성공 · 새로고침 표식이 남은 상태의 두 번째 실패는 반복 없이 오류 표시 (Chromium · WebKit). 원복 RED: D 를 되돌리면 재배포 모사가 옛 wasm 을 HTTP 캐시에서 쓰는 것을 검출 | 경로 수리. `?url` 불가 시 빌드 플러그인으로 해시 복사 (design §3) 후 재측정                                        |
| G2   | Phase 2 (A)  | 유리 조건 (첫 방문 대기 뒤 클릭, 제한 프로파일): press → ready p95 가 같은 빌드 대조군 대비 **−20 % 이상 또는 −300 ms 이상** (Chromium · WebKit 각각). 불리 조건: 즉시 클릭 · 주소창 직접 진입 p95 **+5 % 이내**, 진행 중 진입의 wasm 전송 **1 회** (서버 기록). 미리 받기 동안 dashboard long task 증가 0. 원복 RED: 미리 받기 호출을 되돌리면 builder 부팅 시 wasm `transferSize > 0` 검출                                                                                                                           | 불리 조건 초과 → 트리거를 의도 전용으로 좁혀 재측정, 그래도 초과면 A 되돌림 (D 만 유지). 유리 조건 미달 → A 되돌림 |
| G3   | Phase 2 종료 | Builder · Preview initial gzip Δ ≤ 0 (변경 전 SHA 별도 worktree clean 빌드 vs after worktree, `adr209-bundle-closure.mjs`) · 미리 받기 chunk 가 initial closure 밖 (`dynamicTargets` 에만)                                                                                                                                                                                                                                                                                                                             | 호출 지점 축소 · 상쇄 불가 시 Δ 와 원인을 기록하고 ADR-201 재승인 절에서 사용자 판정                               |
| G4   | Phase 2      | 실패 주입 3 종 (미리 받기 wasm 요청 abort · 404 · 미리 받기 chunk 자체 404) → builder 부팅 성공 · builder chunk 재요청 정상 · page error 0 (Chromium · WebKit, WebKit 은 새로고침 뒤 한 번 더). 정적 가드 테스트 (미리 받기 chunk 의 정적 import 가 builder lazy chunk · `canvaskit-wasm` 을 가리키면 실패) 원복 RED → GREEN                                                                                                                                                                                           | 실패 경로 수리 — 미리 받기는 언제나 조용히 포기                                                                    |

### Live Exercise

(Implemented 승격 시 기재 — production 빌드 Chromium · WebKit 에서 dashboard → builder 진입 · 재배포 모사 · 실패 주입 결과, 배포 복구 시 실제 GitHub Pages 재측정 여부)

## Consequences

### Positive

- CanvasKit glue 와 wasm 이 빌드 단위 쌍이 되어, canvaskit 갱신 배포 뒤의 조용한 instantiate 불일치가 사라진다 (D). postinstall 복사 단계 하나가 줄어 fresh clone · CI 의 준비 단계가 단순해진다.
- (A 채택 시) dashboard 에 머무는 동안 CanvasKit 받기가 끝나, 첫 방문의 빌더 진입에서 wasm 네트워크 대기가 빠진다.
- 빌더 진입 시간을 조건 · 브라우저 · 구간별로 재는 하니스가 생겨, 이후 초기 로드 판단 (B 재개 · 폰트 · 500 KB 목표) 이 실측 위에서 이뤄진다.

### Negative

- D 뒤 재배포 전 열린 탭은 캔버스 부팅이 404 로 실패한다 (새로고침으로 복구) — 조용한 불일치 대신 명시적 실패.
- (A 채택 시) 프로젝트를 열지 않는 dashboard 방문도 wasm 을 받는다 · dashboard 모듈에 미리 받기 호출 지점이 생기고, 미리 받기 chunk 의 import 경계를 정적 가드가 계속 지켜야 한다.
- 10 분 뒤 재검증 왕복 · 주소창 직접 진입 · HTTP 캐시 축출은 A + D 로 개선되지 않는다 — B 재개 조건으로 남는다.
