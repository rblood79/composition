# ADR-247 breakdown — cold entry 정적 셸

> 본문: [247-cold-entry-static-shell.md](../completed/247-cold-entry-static-shell.md)

## 0. 전제 lock-in (fork 아님)

| 질문                    | 답                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 별도 ADR 인가           | 예 — ADR-244 (부팅 네트워크 단축) 와 분리, 사용자 판정 2026-09-27 "별도 ADR". 244 는 W1 을 짧게, 247 은 W0 · W1 에 보여 줄 것을 다룬다                                         |
| 의존 방향               | 없음. 측정 하니스 (production build + Pages mock + cold 직접 진입) 만 공유 — 먼저 실행하는 ADR 이 만들고 다른 쪽이 재사용                                                      |
| schema 직교성           | 문서 · canonical · history 변경 0. 새 `localStorage` 키 1 개 (`composition-shell-snapshot`) — 도구 상태                                                                        |
| SSOT                    | D1 · D2 · D3 밖 (빌더 chrome 부팅 표현). 셸 색은 builder 테마 토큰에서 빌드 시 추출 또는 computed 스냅샷 — 손 복제 금지 (HC4)                                                  |
| 결정 지점 (사용자 질문) | 본문 Decision 의 2 개 — 2026-09-27 착수 전 측정 (§7-1) 뒤 사용자 확정: ① W1 패널 골격 = 보인다 ② go/no-go = Chromium 4x W0 p50 ≥ 300 ms 또는 다크 첫 paint 흰색 (측정 결과 go) |

## 1. Phase 개요

| Phase | 내용                                              | 산출물                                                     | Gate |
| ----- | ------------------------------------------------- | ---------------------------------------------------------- | ---- |
| 0     | production cold entry 측정 · 부팅 mark · go/no-go | 하니스 스크립트 · mark 2 · evidence                        | G0   |
| 1     | 최소 셸 (테마 배경 · 점 배경 · 진행 막대)         | `index.html` 인라인 셸 · Vite 플러그인 · 오버레이 이어받기 | G1   |
| 2     | 스냅샷 셸 (헤더 · 패널 골격 · 빈 캔버스)          | 스냅샷 기록기 · 인라인 일치 판정 · presented 교체          | G2   |
| 3     | Live Exercise · 문서                              | README · CHANGELOG · 메모리                                | G3   |

## 2. Phase 0 — 측정 (go/no-go)

### 2-1. 부팅 경계 mark

지금 부팅에 `performance.mark` 가 없다 (`__composition_PERF__` 의 `boot.*` label 은 ring buffer 전용, user timing 기본 off — `perfMarks.ts:205,228-254`). 항상 켜지는 mark 2 개를 둔다 (비용: 부팅당 2 회).

| mark                               | 위치                                                         | 뜻                                          |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `composition:builder.first-commit` | `BuilderCore` 첫 mount layout effect                         | React 가 builder 트리를 처음 commit (W0 끝) |
| `composition:builder.presented`    | `isBuilderPresented` false → true 인 commit 의 layout effect | chrome 이 드러남 (W1 끝)                    |

### 2-2. 하니스

`apps/builder/scripts/cold-entry-shell.mjs` (신규, ADR-244 Phase 0 가 먼저 만들었으면 그것을 확장):

- `vite build` 산출물을 Pages 헤더 mock (`Cache-Control: max-age=600`, basename `/composition`, 없는 경로 → `404.html`) 로 서빙.
- 조건: 캐시 비움 · `localStorage` 조건 (없음 / 테마만 / 테마 + 배치 + 스냅샷) · 테마 light/dark · 뷰포트 1440×900 · 1920×1080 · Chromium CPU 1x/4x · WebKit.
- 수집: navigation start 기준 FP · FCP · `builder.first-commit` · `builder.presented` · `layout-shift` entry (hadRecentInput 제외, 부팅 구간) · **첫 paint 배경색** (CDP screencast 또는 `page.screenshot` 을 rAF 마다 — 첫 비어 있지 않은 프레임의 배경 픽셀).
- n ≥ 10 · p50/p95 · run 별 JSON.

### 2-3. go/no-go

- go: Chromium 4x W0 p50 ≥ 300 ms **또는** dark 첫 paint 가 흰색 (배경 픽셀 휘도 > 0.9).
- no-go: 둘 다 아님 → ADR Rejected, evidence 에 수치 · 조건 기록. mark 2 개는 남긴다 (ADR-244 가 쓴다).

## 3. Phase 1 — 최소 셸

> 실행 시 바뀐 것 (셸 = 앱 class 재사용 · 점 배경 생략 · 오버레이 라벨 배치): §7-2.

### 3-1. 파일 변경표

| 파일                                                                                                                           | 변경                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/index.html`                                                                                                      | `<head>` 인라인 `<style id="composition-shell-style">` · `<script id="composition-shell">` 자리 (내용은 플러그인이 채움) · `<body>` 에 `<div id="composition-shell" aria-busy="true" hidden>`                                                                   |
| `apps/builder/vite.config.ts` — `staticShellPlugin()` (신규 함수, 기존 `spaFallbackPlugin` · `devIdentityPlugin` 과 같은 자리) | `transformIndexHtml` — `builder-system.css` 에서 light/dark 의 배경 · 진행 막대 색 토큰, `Workspace.css` 의 `.dot-background--base` 규칙을 추출해 인라인 CSS 생성 · 인라인 script (`apps/builder/shell/staticShell.js`, 신규 · 의존 0) 주입 (dev · build 둘 다) |
| `apps/builder/vite.config.ts` (plugins)                                                                                        | `staticShellPlugin()` 을 `spaFallbackPlugin()` 앞에 등록 — 404.html 도 같은 셸                                                                                                                                                                                  |
| `apps/builder/src/builder/main/BuilderCore.tsx`                                                                                | 첫 commit layout effect 에서 셸 → React 오버레이 이어받기 (셸 진행 막대 제거는 오버레이가 같은 사각형을 그린 commit 에서) · mark 2                                                                                                                              |
| `apps/builder/src/main.tsx`                                                                                                    | builder 경로가 아니면 mount 직후 셸 노드 제거 (HC3 이중 안전)                                                                                                                                                                                                   |
| `apps/builder/src/builder/styles/modules/error-loading.css`                                                                    | 오버레이 진행 막대 사각형을 셸과 같은 규칙으로 (값 공유는 플러그인이 CSS 변수로)                                                                                                                                                                                |

### 3-2. 인라인 script 계약

1. `location.pathname` 이 `<base>/builder/` 로 시작하지 않으면 아무것도 하지 않는다.
2. 테마: `localStorage["composition-ui"]` 의 themeMode (JSON 파싱 실패 · 예외 → `auto`) → `auto` 면 `matchMedia("(prefers-color-scheme: dark)")`. `<html data-builder-theme>` 를 **먼저** 붙인다 (앱의 `useEffect` 와 같은 값 — 앱은 그대로 둔다).
3. UI 배율: `--ui-scale` 을 같은 저장소에서 읽어 셸에도 적용 (앱 `.app { zoom }` 과 같은 식).
4. 셸 노드 `hidden` 해제. 네트워크 0 · 동기 1 회 · try/catch 전체.

### 3-3. 이어받기

- 셸 진행 막대 = 값 0 · 채움 없음 (R3). React 오버레이 첫 commit 은 15 (`project`) 부터 — 같은 사각형에 채움이 생긴다. 셸 막대 제거와 오버레이 막대 표시는 같은 commit 의 layout effect (paint 전).
- 점 배경: 셸 점 배경은 `Workspace.css` `.dot-background--base` 규칙을 빌드 시 그대로 옮긴다. 이 규칙은 JS 가 넣는 `--dot-inset` (`DotBackground.tsx` `BG_INSET`) 을 읽으므로 셸은 규칙의 fallback 값으로 그린다 — fallback 과 `BG_INSET` 이 다르면 G1 ② 가 shift 로 잡는다 (그때 fallback 을 `BG_INSET` 에 맞춘다).

## 4. Phase 2 — 스냅샷 셸 (사용자 결정 1 "보인다" — 확정 2026-09-27)

### 4-1. 스냅샷 형식 (`localStorage["composition-shell-snapshot"]`)

```json
{
  "v": 1,
  "build": "<빌드 id — import.meta.env 에서>",
  "viewport": { "w": 1920, "h": 1080 },
  "uiScale": 100,
  "theme": "dark",
  "layoutVersion": "<composition-panel-layout 의 버전·해시>",
  "colors": { "app": "…", "header": "…", "panel": "…", "border": "…" },
  "rects": [
    { "role": "header", "x": 0, "y": 0, "w": 1920, "h": 48 },
    { "role": "panel", "x": 0, "y": 48, "w": 280, "h": 1032, "title": true },
    { "role": "canvas", "x": 280, "y": 48, "w": 1360, "h": 1032 }
  ]
}
```

- 사각형은 `getBoundingClientRect` (zoom 반영 결과) · 색은 `getComputedStyle`. 크기 상한 8 KB (넘으면 쓰지 않음).

### 4-2. 기록 시점

> 실행 시 바뀐 것: presented 직후 idle 1 회뿐 · 대상은 루트 아래 가장 바깥의 칠해진 상자 — §7-2.

- `builder.presented` 직후 idle 1 회.
- 패널 배치 커밋 (ADR-922 coordinator 의 interaction end persist) · 뷰포트 resize 종료 · UI 배율 · 테마 변경 뒤 idle (debounce 500 ms).

### 4-3. 인라인 일치 판정

`build` · `viewport` (현재 `innerWidth/innerHeight`) · `uiScale` · `theme` (3-2 결과) · `layoutVersion` 이 모두 같을 때만 `rects` 를 절대 위치 div 로 그린다 (테두리 · 배경만, 텍스트 · 아이콘 0). 하나라도 다르면 최소 셸.

### 4-4. 교체

- 셸 골격 제거 = `isBuilderPresented` 가 true 가 되는 commit 의 layout effect (실제 chrome 의 `visibility:hidden` 해제와 같은 paint).
- 원복 RED (G2): 제거를 다음 rAF 로 늦추면 겹침 프레임, 앞당기면 빈 프레임이 rAF 샘플링에 잡혀야 한다.

## 5. Phase 3 — Live Exercise · 문서

- headed Chromium 으로 dark · 저장 배치 · cold 직접 진입 녹화 → 셸 → 실제 교체 · 사용자 confirm.
- README · CHANGELOG (사용자-가시) · 메모리 (부팅 표현 함정이 나오면).

## 6. 착수 전 5-질문 (measurement-validity §1)

| Q                | 답                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 대상 출처     | 실제 빌더 production build · 사용자 저장 상태 조건 (없음 / 테마 / 테마 + 배치 + 스냅샷) — 합성 문서는 부팅 비용 규모에만 쓴다                                                   |
| Q2 불리 케이스   | 첫 방문 (스냅샷 없음) · 배치 변경 직후 · 뷰포트 변경 · 배포 직후 (빌드 id 불일치) · WebKit 사생활 모드 (`localStorage` 예외)                                                    |
| Q3 대조군        | 같은 빌드에서 셸 끔 (플러그인 env 스위치) arm 과 교대 측정 — FP · 흰 프레임 · layout-shift 비교                                                                                 |
| Q4 소비 경로     | 셸이 실제 배포 경로 (`index.html` 과 `404.html` 둘 다) 에 실리는지 빌드 산출물에서 확인 · dev 에서만 도는 형태 금지                                                             |
| Q5 oracle 독립성 | 판정 기준은 브라우저가 낸 값 (`layout-shift` entry · `getBoundingClientRect` · 픽셀) — 셸이 스스로 쓴 스냅샷 값과 대조하지 않는다 (스냅샷 ↔ 실제는 G2 가 실제 DOM 을 다시 잰다) |

## 7. 실행 결과

### 7-1. 착수 전 측정 — 사용자 결정 2 개의 근거 (2026-09-27, 사용자 "측정해서 확인해")

코드 변경 없이 바깥에서 쟀다 — `bf88a3c17` 의 `vite build` 산출물 · Pages 흉내 정적 서버 (base `/composition/` · gzip · `max-age=600` · 없는 경로 → `404.html`) · Playwright headless (`channel: "chrome"`, WebKit 2336) · 1440×900 · 매 실행 새 컨텍스트 (HTTP 캐시 빔) · 네트워크 "10 Mbps" = CDP 10 Mbps / 지연 100 ms. W0 = navigation → `#root` 첫 자식 (MutationObserver), W1 = W0 끝 → `.app:not(.builder-booting)` (presented). 첫 paint 색 = CDP screencast 프레임 픽셀.

| 조건                      | W0 p50 / p95 (ms) |  FP p50 | W1 p50 / p95 (ms) | presented p50 (ms) | 다크: 흰 프레임이 잡힌 실행                    |
| ------------------------- | ----------------: | ------: | ----------------: | -----------------: | ---------------------------------------------- |
| Chromium 1x · 무제한      |         128 / 132 |     144 |         378 / 392 |                501 | 4/10 (commit ~26 ms → 첫 paint)                |
| Chromium 1x · 10 Mbps     |     1,888 / 1,892 |   1,904 |     5,538 / 5,550 |              7,449 | 1/10                                           |
| **Chromium 4x · 무제한**  |     **438 / 451** |     468 |         931 / 961 |              1,372 | **7/10 (commit ~70 ms → 첫 paint ~466 ms)**    |
| **Chromium 4x · 10 Mbps** | **2,162 / 2,200** |   2,188 |     5,733 / 5,736 |              7,900 | **4/10 (commit ~375 ms → 첫 paint ~2,200 ms)** |
| WebKit · 무제한           |         212 / 217 | FCP 252 |         446 / 453 |                665 | 측정 불가 (아래)                               |

n: W0 · 흰 프레임 = Chromium 10 · WebKit 5 (없는 프로젝트 경로 — W0 는 프로젝트와 무관), W1 = Chromium 5 · WebKit 3 (dashboard 에서 만든 실제 프로젝트, IndexedDB 포함 저장 상태).

판독:

- **첫 paint 는 React 첫 commit 뒤다** — FP = W0 + 16 ~ 30 ms. 그 전에는 문서가 아무것도 칠하지 않는다 (`html` · `body` 배경 computed = 투명, 테마 속성도 첫 commit 과 같은 순간). 다크 테마에서 흰 프레임이 잡힌 실행은 흰색이 문서 commit 부터 첫 paint 까지 이어졌다 (4x · 10 Mbps 에서 약 1.8 초). 나머지 실행은 첫 paint 전 프레임이 없었다 — screencast 는 compositor 가 새 프레임을 낼 때만 보내므로 "흰색이 안 보였다" 와 "이전 화면을 유지했다" 를 구별하지 못한다. 흰 프레임은 **있다**, 빈도는 이 도구로 확정하지 못한다.
- 라이트 테마도 첫 paint 전 흰색 (255) → 테마 배경 (228) 으로 바뀐다 — 다크보다 작지만 같은 종류.
- WebKit 은 screencast 가 없고 `page.screenshot` 이 로드 끝까지 기다려 투명 프레임만 돌려줬다 — 다크 흰 화면은 미측정, 시간만.
- **W1 이 W0 보다 길다** — 10 Mbps 에서 W1 5.5 ~ 5.7 초 동안 사용자는 점 배경 + 진행 막대만 본다 (presented 7.4 ~ 7.9 초). 무제한 네트워크 4x 에서도 0.93 초. W1 은 이 ADR 이 줄이지 않는다 (CanvasKit wasm · 폰트 TTF — ADR-244 · research Track A 범위). CLAUDE.md "초기 로드 < 3 초" 는 10 Mbps 조건에서 넘는다.

결정 근거로 옮기면:

- **결정 2 (go/no-go)**: go 조건 둘 다 성립 — Chromium 4x W0 p50 438 ms (무제한) · 2,162 ms (10 Mbps) ≥ 300 ms, 다크 첫 paint 전 흰 프레임 관측 (4x 7/10 · 4/10). 단, 1x 무제한 (128 ms) 에서는 기준 미만 — 효과는 CPU · 네트워크가 느린 진입에 몰린다.
- **결정 1 (W1 패널 골격)**: W1 이 W0 의 2 ~ 3 배 (10 Mbps 5.5 초) 라 셸이 W0 만 덮으면 사용자가 보는 빈 구간의 대부분이 남는다 — 패널 골격을 W1 까지 유지해야 셸의 효과가 보인다.

한계 (Q1 · Q8): 로컬 서버라 실제 Pages CDN 지연 · TLS 없음 · 네트워크 조건은 합성 · 신규 기본 프로젝트 · 저장 배치 없음 · headless. Phase 0 (G0) 는 부팅 mark 2 개를 넣고 같은 하니스로 재측정한다. 측정 스크립트는 세션 scratchpad (`p6/`).

### 7-2. 실행 기록 — Phase 0 ~ 3 (2026-09-27, 사용자 `/execute-adr 247`)

#### 설계에서 바꾼 것 (구현 중 실측으로)

| 항목                  | breakdown 원안                                                                               | 실행                                                                                                                  | 근거                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 셸 색 · 크기 (§3-1)   | 플러그인이 `builder-system.css` 토큰 · `.dot-background--base` 규칙을 추출해 인라인 CSS 생성 | 셸을 **앱과 같은 class** (`.app` · `.canvas-container` · `.loading-*`) 로 그린다 — 인라인 CSS 0                       | main CSS 는 head 의 render-blocking stylesheet 라 첫 paint 전에 항상 도착한다 (빌드 산출물 확인: `.loading-progress` · 토큰 · `.app { zoom }` 전부 `main-*.css`). 인라인 CSS 를 따로 두어도 첫 paint 가 앞당겨지지 않고, 값 복제는 0 이 된다 (HC4 보다 강함)                                  |
| 점 배경 (§3-3)        | 셸이 `.dot-background--base` 로 그림                                                         | 그리지 않는다                                                                                                         | 점 격자 (간격 · 위상) 는 캔버스 pan/zoom 에서 나온다 (`dotBackgroundMetrics.ts`) — 셸은 알 수 없다. 기본값으로 그리면 첫 commit 에 격자가 움직인다 (W1 실측 `--dot-gap 16px · --dot-ty 6px` ≠ fallback 20px · 0)                                                                              |
| 진행 막대 자리 (§3-3) | 오버레이 규칙을 셸과 같게                                                                    | `.loading-text` · `.loading-percent` 를 막대 위아래에 띄워 (absolute) 막대만 흐름에 둔다                              | 막대 y 가 라벨 글꼴 높이와 무관해진다 (종전 가운데 정렬 column 은 라벨 19.5 px · 퍼센트 18 px 차로 막대가 0.75 px 아래)                                                                                                                                                                       |
| 부팅 layout-shift     | 셸 교체 구간만                                                                               | 라벨 · 퍼센트를 문구 · 자릿수가 바뀔 때 새 노드로 (`key`) · 상자 폭 고정                                              | 기존 오버레이가 "데이터 로딩" → "캔버스 초기화" · 15% → 100% 에서 가운데 정렬 글자 시작점이 움직여 layout-shift 0.0001 (대조군도 같은 값) — HC2 합 0 을 위해 같이 고침                                                                                                                        |
| 골격 대상 (§4-1)      | 헤더 · 패널 frame · 캔버스 영역                                                              | 루트 `.header` · `.panel-dock-stage` 아래 **가장 바깥의 칠해진 상자** (배경 · 테두리 · 그림자) — 안으로 내려가지 않음 | 헤더는 막대가 아니라 섬 (group) 들이고 (배경 투명), 레일도 섬이다. 캔버스 영역은 최소 셸 배경이 이미 그린다                                                                                                                                                                                   |
| 기록 시점 (§4-2)      | presented idle + 배치 · resize · 배율 · 테마 변경 뒤 idle                                    | **presented 직후 idle 1 회뿐**                                                                                        | 세션 중 · 떠날 때 쓰면 저장되지 않는 상태가 섞인다 — 하니스가 Compare Mode 를 켠 채 쓴 스냅샷이 다음 진입 헤더 섬과 36 px 어긋났다. presented 순간의 chrome 은 영속 상태 + viewport 로만 정해진다. 배치 · viewport 를 바꾼 뒤 첫 진입은 일치 키가 달라 최소 셸이고 그 진입이 새 스냅샷을 쓴다 |
| 빌드 id               | `import.meta.env`                                                                            | 플러그인이 빌드마다 id 를 만들어 `<meta name="composition-build">` (앱) 와 인라인 script 인자 (셸) 로 같이 넘긴다     | 두 쪽이 한 값을 읽는다                                                                                                                                                                                                                                                                        |
| initial 번들          | Δ ≤ 0                                                                                        | 스냅샷 기록기를 presented idle 에 동적 import · 셸 해제 함수만 initial (`staticShellRelease.ts`)                      | 정적 import 면 +738 B, 공유 모듈 chunk 분리 해소 뒤 +267 B                                                                                                                                                                                                                                    |
| 파일 (§3-1) | `apps/builder/shell/staticShell.js` · `main.tsx` 비 builder 제거 | `src/staticShell/` — `staticShell.ts` (마크업 · 인라인 boot · 일치 판정, `vite.config.ts` `staticShellPlugin()` 이 `toString()` 으로 주입) · `staticShellRelease.ts` (교체 · 정리) · `shellSnapshot.ts` (기록기, 지연 로드) · `scheduleShellSnapshotWrite.ts`. 비 builder 정리는 `AppLayout` layout effect | 인라인 boot 를 unit 으로 직접 부르고, 같은 함수가 주입된다 (해시 함수도 인자로 같이 주입) |
| 배율 조건 (G2)        | {90 · 100 · 125}                                                                             | {80 · 100 · 120}                                                                                                      | 앱의 `UiScale` 값이 80 / 100 / 120 뿐이다 (`uiStore.ts`)                                                                                                                                                                                                                                      |
#### 게이트 결과

측정 공통: `apps/builder/scripts/cold-entry-shell.mjs` (신규 하니스) · 같은 커밋 트리의 `vite build` 두 arm — 셸 (`on`) 과 `COMPOSITION_STATIC_SHELL=off` 대조군 (`off`, 셸 마크업 · script 만 빠지고 나머지 동일) · Pages 흉내 서버 · 매 진입 새 브라우저 · 새 컨텍스트 (HTTP 캐시 빔) · headless · 조건마다 arm 교대.

**G0 — go 재확인.** 부팅 mark 2 개 (`composition:builder.first-commit` · `composition:builder.presented`) 배선. 대조군 Chromium 4x W0 p50 380 ~ 382 ms (≥ 300 ms), 다크 첫 paint 전 흰 프레임 15/20 → go 유지.

**G1 — 최소 셸 (n = 10, 없는 프로젝트 경로 = W0 · 첫 paint 전용).**

| 조건 | 첫 paint p50 on / off (ms) | 셸 표시 p50 (ms) | W0 p50 on / off (ms) | 다크: 흰 프레임 실행 on / off | 막대 차 · CLS |
| --- | ---: | ---: | ---: | --- | --- |
| Chromium 1x · 1440 · 1920 | 28 ~ 44 / 148 ~ 152 | 13 ~ 16 | 109 ~ 112 / 110 ~ 111 | 0/20 / 5/20 | 0 px · 0 |
| Chromium 4x · 1440 · 1920 | 72 ~ 80 / 496 ~ 500 | 49 ~ 50 | 381 ~ 384 / 379 ~ 382 | 0/20 / 15/20 | 0 px · 0 |
| WebKit · 1440 · 1920 | (paint timing 없음) | 85 ~ 91 | 181 ~ 183 / 180 ~ 181 | 측정 불가 (screencast 없음) | 0 px · (API 없음) |

- ① 다크 첫 paint = 셸 배경 (휘도 0.07 ~ 0.1), 흰 프레임 0/40 (Chromium). 라이트는 1/40 실행에 흰 프레임 1 장 (대조군 23/40).
- ② 셸 막대 ↔ React 막대 사각형 차 0 px (전 실행) · 교체 전후 layout-shift 0.
- ③ dashboard · signin · publish · `/` 에서 셸 · 골격 노드 없음 (live probe). dashboard · signin 의 `data-builder-theme` 는 그 화면 자체 훅 (`useBuilderChromeTheme`) 이 세운 기존 값이다.
- ④ 저장 예외 · 빈 값 · 손상 JSON → 최소 셸 · 부팅 계속 (unit).
- ⑤ 빌드 추출 색 — 해당 없음 (추출 없이 main CSS 를 그대로 씀, 위 표).
- ⑥ initial JS gzip +267 B (1,413,113 → 1,413,380, ADR-201 상한 1,421,000 안). **Δ ≤ 0 은 못 맞췄다** — 부팅 mark 2 · 셸 해제 · 기록기 지연 import 호출 몫. 2026-09-27 사용자 수용 ("+267B 수용"). 인라인 셸 (마크업 + script) gzip +592 B (≤ 4 KB).
- ⑦ 첫 paint 가 대조군보다 앞섬: 4x 에서 약 420 ms, 10 Mbps 에서 380 vs 2,244 ms.
- W0 · presented 는 두 arm 이 같다 — 셸이 부팅을 늦추지 않는다 (HC6). 10 Mbps · 4x · 실제 프로젝트: presented p50 7,964 / 7,962 ms.

**G2 — 스냅샷 골격 (Chromium · WebKit 각 72 조건 × n 2 = 288 진입).** viewport {1280×720 · 1440×900 · 1920×1080 · 2560×1440} × 배율 {80 · 100 · 120} × 테마 {light · dark} × 배치 {기본 · 좌 패널 · 좌우 패널}. 조건마다 같은 엔진으로 먼저 진입 → 배치 변형 → 새로고침 (presented 가 스냅샷 기록) → 그 저장 상태로 cold 진입.

- 288/288 진입에서 골격이 그려짐 (상자 4 · 6 · 8) · 골격 ↔ presented 순간 실제 chrome 상자 최대 차 **0.02 px** · 상자 수 차 0 · presented 전 골격 없는 프레임 0 · presented 뒤 골격 남은 프레임 0 · 부팅 layout-shift 0 (Chromium).
- 불리 케이스 (Chromium · WebKit 4x dark 1440 좌 패널, n 3): viewport 변경 · 빌드 id 변경 · 배치 원문 변경 → 셋 다 골격 0 · 최소 셸 · layout-shift 0.
- 원복 RED (Chromium 4x dark 1440 좌 패널, n 3): 골격 제거를 2 rAF 늦춤 → 겹침 2 프레임 · 첫 commit 으로 앞당김 → 빈틈 33 프레임 · 정상 → 0 / 0. unit 원복: 일치 판정에서 빌드 · 배치 키를 빼면 2 FAIL.

**G3 — live (headed Chromium) · 사용자 confirm "확인했어" (2026-09-27).** 아래 "live" 와 본문 `### Live Exercise`.

한계: 로컬 서버 (CDN · TLS 없음) · 네트워크는 CDP 합성 · WebKit 첫 paint 색은 못 쟀다 (screencast 없음 · 셸 표시 rAF 시각만) · 신규 프로젝트 (패널 내용이 가벼움 — 골격은 frame 상자만 그리므로 내용과 무관).

#### live — headed Chromium cold 진입 (2026-09-27)

production build · Pages 흉내 서버 · 다크 · 저장 배치 (좌 Navigator · 우 AI 패널) · CPU 4x · 10 Mbps · 새 컨텍스트. screencast 121 프레임:

- 353 ms: 흰 프레임 1 장 — 새 탭의 이전 문서 (about:blank). CSS 도착 전이라 페이지가 칠할 수 없는 구간.
- 365 ms: 셸 + 패널 골격 (헤더 섬 2 · 패널 2 · 레일 2 · 빈 진행 막대). first-paint 380 ms.
- 2,145 ms (첫 commit): 진행 막대 · 라벨 · 점 배경이 같은 자리에 붙는다. 골격은 남는다.
- 8,162 ms (presented): 실제 헤더 · Navigator · AI 패널 · 레일이 골격 자리 그대로 드러난다.
