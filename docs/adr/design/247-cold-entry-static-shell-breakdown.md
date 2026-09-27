# ADR-247 breakdown — cold entry 정적 셸

> 본문: [247-cold-entry-static-shell.md](../247-cold-entry-static-shell.md)

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
