# ADR-247: cold entry 정적 셸 — CanvasKit 부팅 전 패널 골격 · 빈 캔버스를 정적 HTML 로 먼저 그리고 layout shift 게이트로 지킨다

## Status

Implemented — 2026-09-27, **2026-09-29 결정 1 변경: 패널 골격 제거** (아래 Decision 결정 1 참조 — 셸은 대안 B 최소 셸로 돌아갔다) (Phase 0 ~ 3 / G0 ~ G3, 같은 날. G3 사용자 confirm "확인했어" · HC5 initial JS +267 B 사용자 수용 "+267B 수용") · In Progress — 2026-09-27 (사용자 `/execute-adr 247`) · Proposed — 2026-09-27 (사용자 `/create-adr cold entry 정적 셸 — CanvasKit 부팅 전 패널 골격 · 빈 캔버스 정적 HTML + layout shift 게이트`. 출처: claude.dev "How we made claude.ai faster" 제안 5 — 정적 composer + 드리프트 게이트. ADR-244 와 별도 ADR 로 두는 것은 사용자 판정 2026-09-27 "별도 ADR")

## Context

### 문제

빌더 URL 로 곧장 들어오면 (새로고침 · 북마크 · Pages 깊은 링크) 화면은 두 구간을 지난다.

| 구간 | 기간                                          | 지금 보이는 것                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0   | HTML 도착 → initial JS 실행 → 첫 React commit | **아무것도 없다.** `apps/builder/index.html` body 는 `<div id="root">` 와 module script 뿐이다 (인라인 style · script · 골격 0). 배경은 브라우저 기본 흰색이다. initial JS 는 Builder ≤ 1,421,000 B gzip (ADR-201 재승인 상한, 만료 2026-10-25) 이고 `Dashboard` · `Builder` 는 정적 import 다 (`main.tsx:43-44`).                                                              |
| W1   | 첫 React commit → `isBuilderPresented`        | 점 배경 (`DotBackground`) 과 진행 막대 오버레이 (`BuilderCore.tsx:1601` · 단계별 15 → 45 → 55~95 → 100, `:28-49`). 헤더 · 패널 · 캔버스는 **mount 됐지만 `visibility:hidden`** (`error-loading.css:59-68`, 2026-09-02 `060ddfd09` · 09-18 `366de3f9f`). 한 번에 같은 geometry 로 드러내려는 설계다 — "첫 render부터 loading이어야 chrome flash가 없다" (`BuilderCore.tsx:251`). |

W1 의 끝은 CanvasKit wasm (7,317,345 B) · 폰트 (Pretendard 6,739,320 B · Inter 879,708 B) · surface · 일치하는 첫 flush 확인이다 (ADR-244 Context). 테마는 `data-builder-theme` 를 `useEffect` 가 첫 paint **뒤에** 붙인다 (`BuilderCore.tsx:426-456`) — 다크 테마 사용자는 W0 의 흰 화면 뒤 어두운 화면을 본다 (Phase 0 이 확인).

글의 교훈은 "JS 가 오기 전에 앱처럼 보이는 정적 셸을 먼저 그리되, 셸과 실제 앱의 geometry 가 어긋나지 않게 드리프트 게이트를 둔다" 다. composition 은 두 곳이 다르다:

1. **패널 geometry 는 사용자별이다** — V4 solver 가 저장된 배치 (`localStorage["composition-panel-layout"]`, `panelLayout.ts:207`) · 측정한 stage 크기 (`PanelWorkspace.tsx:1639`) · 비율 크기 · UI 배율 (`.app { zoom: var(--ui-scale) }`, `uiStore.ts:65`) 로 px 를 만든다. 빌드 시점 하나의 정적 셸로는 기본 배치만 맞는다.
2. **index.html 을 모든 경로가 쓴다** — dashboard · signin · publish 도 같은 문서이고, 빌드가 `index.html` 을 `404.html` 로 복사한다 (`vite.config.ts:171-177`, Pages 깊은 링크). 셸은 builder 경로에서만 그려야 한다.

측정 공백: W0 · W1 길이, 다크 흰 화면, 부팅 중 layout shift 는 **잰 적이 없다**. `perf-baseline --cold-entries` 의 ready 판정은 store · `.app:not(.builder-booting)` · 캔버스 요소 존재뿐이고 (`perf-baseline.mjs:293-300`) FCP · CLS 는 수집하지 않는다. `localWebVitals.ts` (`web-vitals` onCLS/onLCP) 는 BuilderCore 에서 시작만 하고 읽는 곳이 없다. research 문서 §3-5 의 cold entry 수치 (`render.frame` 266.9 ~ 427.7 ms) 는 dev 서버 · 신규 프로젝트 생성 경로 · 첫 Skia 프레임 비용이지 W0 · W1 이 아니다.

### 이 ADR 이 다루지 않는 것 — ADR-244 · 243 · 246 과의 경계

- **ADR-244 (wasm 미리 받기 · 고유 경로화)** 는 W1 을 **짧게** 한다 (네트워크). 이 ADR 은 W0 · W1 동안 **무엇을 보여 주나** 를 다룬다 (화면). 서로 의존하지 않는다 — 둘 다 production build cold entry 측정이 필요하므로 먼저 실행하는 쪽이 만든 측정 하니스를 다른 쪽이 재사용한다.
- **ADR-243** 은 cold entry 를 범위 밖으로 둔다 (243 본문 :115).
- **ADR-246** ratchet 은 cold boot 를 재지 않는다. 부팅 카운트를 ratchet 에 넣는 것은 범위 밖.
- 첫 Skia 프레임 비용 (research §4 Track A: 폰트 · paragraph · surface bootstrap) · initial 번들 축소 · 부팅 순서 변경은 범위 밖.

### SSOT 3-Domain 판정

D1 · D2 · D3 어느 것도 아니다 — 사용자 문서가 아니라 **빌더 chrome 의 부팅 표현** 이다. 컴포넌트 catalog · spec · Skia/Preview 대칭과 무관하다. 단, 셸 색은 builder 테마 토큰 (`packages/shared/src/components/styles/theme/builder-system.css`) 과 같은 값이어야 하므로 **값을 손으로 옮겨 적지 않는다** (HC4).

### Hard constraints

- **HC1 가짜 ready 금지** — 셸은 조작 가능해 보이지 않는다 (`pointer-events:none` · `aria-busy` · 커서). `isBuilderPresented` 의 정의 (일치하는 첫 flush 확인 → 진행 막대 100% paint, `BuilderCore.tsx:1544-1599`) 는 바꾸지 않는다. 셸의 진행 표시는 실제 단계보다 앞서지 않는다 (research §3-5 :141 "timeout · 가짜 진행률 · ready 선처리 금지").
- **HC2 layout shift 0** — 셸에서 앱으로 넘어갈 때 계속 보이는 요소 (배경 · 진행 막대 · 패널 골격 · 헤더) 의 사각형이 ±1 CSS px 안이고, 부팅 구간의 `layout-shift` entry 합 (hadRecentInput 제외) = 0. Chromium 과 WebKit.
- **HC3 builder 경로 한정** — dashboard · signin · publish · 404 경로에서 셸이 그려지지 않는다 (DOM 에 남지도 않는다).
- **HC4 값 복제 금지** — 셸의 geometry 와 색은 앱이 마지막으로 그린 결과 또는 빌드 시점에 토큰 원본에서 추출한 값만 쓴다. solver · 토큰 값을 인라인 코드로 다시 구현하지 않는다.
- **HC5 initial 번들 Δ ≤ 0** (실행 결과 +267 B gzip — 2026-09-27 사용자 수용) — ADR-201 게이트 기준. 인라인 셸 (HTML + CSS + script) 은 gzip ≤ 4 KB.
- **HC6 저장 실패에 안전** — `localStorage` 가 비었거나 예외를 던지거나 (WebKit 사생활 모드) 값이 오래됐으면 패널 골격 없이 최소 셸로 그린다. 셸이 앱 부팅을 막거나 늦추지 않는다 (인라인 script 는 동기 1회 · 네트워크 0).

### Soft constraints

- W0 에 다크 테마 사용자에게 흰 화면이 없다.
- 기존 부팅 설계 ("chrome 은 한 번에 같은 geometry 로 드러낸다") 를 유지한다 — 셸이 보여 주는 패널 골격은 실제 패널이 드러나는 순간 **같은 자리에서** 교체된다.
- 측정 하니스는 ADR-244 Phase 0 과 공유할 수 있게 production build + Pages 헤더 mock 서버 형태로 둔다.

## Alternatives Considered

### 대안 A: 빌드 시점 사전 렌더 (글의 방식) — 기본 배치의 빌더 chrome 을 빌드 때 HTML 로 굽는다

- 설명: 빌드 단계에서 `BuilderShell` (헤더 · PanelWorkspace 기본 배치 · 빈 캔버스) 을 jsdom/SSR 로 렌더해 `index.html` 에 넣고, live 와 뷰포트 N 개에서 사각형을 대조하는 드리프트 게이트를 둔다.
- 위험: 기술 **H** (React Aria · zustand persist · `localStorage` · 측정 layout effect 를 SSR 에서 돌려야 한다 — 빌더 chrome 은 SSR 을 전제로 짜여 있지 않다) / 성능 M (사전 렌더 HTML 이 크다 — HC5 4 KB 를 넘기 쉽다) / 유지보수 M (빌드 파이프라인 추가) / 마이그레이션 L. 저장 배치 · UI 배율을 바꾼 사용자는 **항상** shift 를 겪는다 — 사전 렌더가 맞는 것은 기본 배치 · 특정 뷰포트뿐.

### 대안 B: 최소 셸 — 테마 배경 · 점 배경 · 진행 막대만 (패널 골격 없음)

- 설명: `index.html` 에 builder 경로일 때만 동작하는 인라인 script + CSS. 저장된 테마 (`composition-ui` 의 themeMode, auto 면 `prefers-color-scheme`) 로 배경을 칠하고, React 오버레이와 **같은 자리 · 같은 크기** 의 진행 막대 (값 없는 상태) 를 그린다. React 오버레이가 첫 commit 에서 같은 픽셀을 이어받는다. 패널은 지금처럼 presented 때 드러난다.
- 위험: 기술 L / 성능 L / 유지보수 L (진행 막대 사각형 1 개만 맞추면 된다) / 마이그레이션 L. 얻는 것도 작다 — W0 의 흰 화면과 무반응만 없앤다. 사용자가 요청한 "패널 골격" 이 없다.

### 대안 C: 마지막 표시 geometry 스냅샷 셸 — 앱이 그린 결과를 다음 cold entry 의 셸로 쓴다

- 설명: 빌더가 presented 될 때마다 (그리고 패널 배치 · 뷰포트 · UI 배율 · 테마가 바뀐 뒤 idle 에) 실제 chrome 의 **계산된 결과** — 뷰포트 크기 · UI 배율 · 테마 · 헤더와 각 패널 프레임의 사각형 · 캔버스 영역 · 배경 · 패널 · 테두리 색 (`getComputedStyle`) · 빌드 id — 를 `localStorage["composition-shell-snapshot"]` 에 쓴다. `index.html` 의 인라인 script 는 builder 경로이고 스냅샷의 뷰포트 · UI 배율 · 빌드 id 가 지금과 같을 때만 그 사각형으로 헤더 · 패널 골격 · 빈 캔버스를 그린다. 아니면 대안 B 의 최소 셸로 내려간다. 셸은 첫 React commit 에서 지우지 않고 **presented 되는 프레임에 실제 chrome 과 교체** 한다 (W1 동안 실제 chrome 은 지금처럼 숨어 있다).
- 위험: 기술 M (교체 프레임을 맞춰야 한다 — presented 와 같은 commit 에서 셸 제거) / 성능 L (인라인 script 는 JSON 1개 파싱 + 사각형 수십 개) / 유지보수 **L** (solver 를 다시 구현하지 않는다 — solver 의 출력이 곧 입력이다. 색도 computed 값) / 마이그레이션 L (새 저장 키 1 개 · 문서 스키마 무관). 첫 방문 · 뷰포트 변경 직후 · 배포 직후 첫 진입은 최소 셸이다.

### 대안 D: 앱 안에서 chrome 을 먼저 드러냄 — 첫 commit 부터 실제 헤더 · 패널을 보이고 캔버스 영역만 오버레이

- 설명: `builder-booting` 숨김을 헤더 · 패널에서 빼고, 패널 내용만 로딩 상태로 둔다. 정적 HTML 은 없다.
- 위험: 기술 M (패널이 프로젝트 데이터 전에 빈 상태 → 채워진 상태로 바뀌며 흔들린다 · 조작을 막아야 한다) / 성능 M (W1 동안 패널 렌더가 부팅 main thread 와 경쟁) / 유지보수 M (패널마다 로딩 상태) / 마이그레이션 L. W0 은 그대로 흰 화면이다 — 정적 셸 요청의 핵심 (JS 전) 을 다루지 않는다. 2026-09-02 · 09-18 의 "chrome 은 한 번에" 설계를 뒤집는다.

### Risk Threshold Check

| 대안 | HIGH+      | 판정                                                   |
| ---- | ---------- | ------------------------------------------------------ |
| A    | 기술 H     | 회피 대안 있음 (C 가 같은 목적을 SSR 없이 달성) → 기각 |
| B    | 없음       | 채택 (C 의 하위 경로 · 첫 Phase)                       |
| C    | 없음       | 채택                                                   |
| D    | 없음 (M 3) | W0 미해결 · 기존 설계 반전 → 기각                      |

## Decision

**대안 C (마지막 표시 geometry 스냅샷 셸) 를 채택하고, 대안 B 를 그 하위 경로이자 첫 Phase 로 둔다.**

- Phase 0 — 측정 먼저 (go/no-go). production build · Pages 헤더 mock · 직접 진입 cold (캐시 비움) · Chromium/WebKit · CPU 1x/4x · n ≥ 10. 잰다: W0 (navigation → 첫 React commit) · W1 (첫 commit → presented) · 첫 paint 배경색 (테마별) · 부팅 구간 `layout-shift` 합. 부팅 경계에 `performance.mark` 를 둔다 (첫 commit · presented — 지금은 0 개).
  - **go 조건**: Chromium 4x 에서 W0 p50 ≥ 300 ms, 또는 다크 테마 첫 paint 가 흰색. 둘 다 아니면 이 ADR 은 **Rejected (측정 근거)** 로 닫는다 — 보일 것이 없는 구간을 채우지 않는다.
- Phase 1 — 최소 셸 (대안 B). 테마 배경 · 점 배경 · 진행 막대 (React 오버레이와 같은 사각형) · builder 경로 판정 · 저장 실패 폴백. 테마 · 점 배경 색은 빌드 시점에 `builder-system.css` 토큰에서 추출해 인라인 CSS 로 생성한다 (Vite `transformIndexHtml`, HC4).
- Phase 2 — 스냅샷 셸 (대안 C). 스냅샷 기록 (presented · 배치/뷰포트/배율/테마 변경 뒤 idle) · 인라인 script 가 일치 판정 후 헤더 · 패널 골격 · 빈 캔버스를 그림 · presented 프레임에 교체.
- Phase 3 — Live Exercise · 문서.

**위험 수용 근거**: C 의 기술 M (교체 프레임) 은 G2 의 사각형 대조 (셸 ↔ 실제, ±1 px) 와 부팅 `layout-shift` 합 0 으로 관리하고, 어긋나면 Phase 2 를 되돌려 Phase 1 (최소 셸) 로 남긴다 — 최악의 결과는 "W0 흰 화면만 없어진 상태" 다. 스냅샷이 오래된 경우 (배포 · 뷰포트 · 배율 변경) 는 일치 판정이 최소 셸로 내려보내 shift 를 만들지 않는다.

**기각 사유**: A — 빌더 chrome 을 SSR 로 돌리는 비용 (기술 H) 에 비해 맞는 경우가 기본 배치 · 특정 뷰포트뿐이다. D — W0 (JS 전 흰 화면) 을 다루지 않고, "chrome 은 한 번에 같은 geometry 로" 라는 현재 부팅 설계를 뒤집는다.

**사용자 결정 (Phase 착수 전)** — 2026-09-27 착수 전 측정 ([breakdown §7-1](../design/247-cold-entry-static-shell-breakdown.md)) 뒤 사용자 "확정하고 커밋해" 로 두 항목 확정:

1. **W1 동안 패널 골격을 보일 것인가** — 지금은 W1 에 점 배경 + 진행 막대만 보인다 (09-02 설계). Phase 2 는 그 구간에 빈 패널 골격 (테두리 · 배경 · 헤더 막대, 내용 없음) 을 보인다. 실제 패널은 여전히 presented 순간에 같은 자리에서 드러난다. **확정: 보인다** — W1 (10 Mbps 5.5 ~ 5.7 초 · 4x 무제한 0.93 초) 이 W0 의 2 ~ 3 배라 셸이 W0 만 덮으면 빈 구간 대부분이 남는다.
   - **2026-09-29 변경: 보이지 않는다 (사용자 결정 "골격 제거").** 사용자 신고 — 새로고침 때 좌 · 우 dock 레일 · 헤더 Viewport controls 가 캔버스보다 먼저 보인다. 대시보드 → 프로젝트 SPA 이동은 인라인 script 가 돌지 않아 골격이 없고, cold entry 만 골격이 그려져 두 진입의 부팅 화면이 달랐다. 스냅샷 기록기 (`shellSnapshot.ts` · `scheduleShellSnapshotWrite.ts`) · 골격 해제 · 빌드 id meta 를 삭제하고 셸을 대안 B (캔버스 배경 · 진행 막대 · 테마) 로 줄였다. HC1 · HC3 · HC4 · HC6 (W0 흰 화면 방지) 은 그대로 유지. 같은 변경에서 부팅 중 보이던 캔버스 스크롤바도 `builder-booting` 숨김 목록에 넣었다. live: dev 5173 새로고침 · 대시보드 진입 둘 다 부팅 샘플 중 보이는 chrome 0.
2. **go/no-go 기준** — W0 p50 ≥ 300 ms (Chromium 4x) 또는 다크 흰 화면. **확정 · 착수 전 측정에서 go** — Chromium 4x W0 p50 438 ms (무제한) · 2,162 ms (10 Mbps), 다크 첫 paint 전 흰 프레임 관측 (4x 7/10 · 4/10). Phase 0 (G0) 는 부팅 mark 를 넣고 같은 조건으로 재확인한다.

> 구현 상세: [247-cold-entry-static-shell-breakdown.md](../design/247-cold-entry-static-shell-breakdown.md)

## Risks

| ID  | 위험                                                                   | 심각도 | 대응                                                                                                                                                            |
| --- | ---------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 스냅샷이 오래돼 셸 골격과 실제 패널 자리가 다름 → 교체 순간 shift      |  MED   | 일치 키 (뷰포트 w·h · UI 배율 · 빌드 id · 배치 버전) 가 하나라도 다르면 최소 셸. G2 가 배치 변경 · 뷰포트 변경 · 배포 직후 3 경우를 명시 측정 (불리 케이스, Q2) |
| R2  | 셸이 조작 가능해 보여 사용자가 준비 전에 누름                          |  MED   | `pointer-events:none` · `aria-busy="true"` · `cursor:progress` · 진행 막대 유지. 셸 안에 버튼 · 텍스트 입력 모양을 그리지 않는다 (사각형 · 테두리만)            |
| R3  | 셸 진행 표시가 실제보다 앞섬 (가짜 진행률)                             |  MED   | 셸 진행 막대는 값 없음 (indeterminate 아님 · 0 고정 · 채움 없음). React 오버레이가 첫 commit 에서 실제 단계 값으로 이어받는다                                   |
| R4  | 셸 교체 프레임이 실제 chrome 표시와 어긋나 한 프레임 빈 화면 또는 겹침 |  MED   | 셸 제거를 `isBuilderPresented` 가 true 가 되는 commit 의 layout effect 에서 수행 (paint 전). G2 가 presented 전후 rAF 샘플링으로 "빈 프레임 0 · 겹침 0" 확인    |
| R5  | 인라인 셸이 dashboard · publish 에 남음                                |  LOW   | 경로 판정 (basename 포함) · 앱 mount 시 builder 경로가 아니면 즉시 제거 · G1 에서 4 경로 확인                                                                   |
| R6  | 빌드 추출 색과 런타임 토큰이 어긋남 (테마 편집 · 토큰 변경)            |  LOW   | 추출은 빌드마다 · 스냅샷이 있으면 computed 색이 우선 · G1 에 추출값 = 런타임 computed 대조 테스트                                                               |

잔존 HIGH 위험 없음.

## Gates

측정 공통: production build (`vite build` + Pages 헤더 mock 서버 — `Cache-Control: max-age=600`, basename `/composition`) · 직접 진입 (캐시 · storage 상태를 조건별로 명시) · Chromium + WebKit (Playwright) · `visibilityState=visible` · 결과는 run 별 파일. 측정 5-질문 (measurement-validity §1) 은 breakdown §6.

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 실패 시                                                              |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| G0   | Phase 0 | W0 · W1 · 첫 paint 배경색 · 부팅 `layout-shift` 합을 Chromium 1x/4x · WebKit 에서 n ≥ 10 (p50/p95) · 테마 light/dark · 뷰포트 2 개. 부팅 경계 `performance.mark` 2 개 (첫 commit · presented) 배선. go 조건 판정 기록                                                                                                                                                                                                                                     | no-go → Rejected (측정 근거 기록)                                    |
| G1   | Phase 1 | 최소 셸: ① dark 첫 paint 배경 = dark 토큰 (흰 프레임 0, rAF 샘플링) ② 셸 진행 막대 ↔ React 오버레이 막대 사각형 ±1 px · 교체 전후 `layout-shift` 0 ③ dashboard · signin · publish · 404(=builder 깊은 링크) 4 경로에서 builder 경로만 셸 ④ `localStorage` 예외 · 빈 값 · 손상 JSON → 최소 셸 · 부팅 성공 ⑤ 빌드 추출 색 = 런타임 computed ⑥ ADR-201 게이트 Δ ≤ 0 · 인라인 gzip ≤ 4 KB ⑦ W0 동안 첫 paint 시각 (FP) 이 대조군 (셸 없음) 보다 앞섬          | 해당 항목 수리. ⑦ 실패 (앞서지 않음) 면 셸 위치 (head 인라인) 재검토 |
| G2   | Phase 2 | 스냅샷 셸: 뷰포트 {1280×720 · 1440×900 · 1920×1080 · 2560×1440} × UI 배율 {90 · 100 · 125} × 테마 {light · dark} × 배치 {기본 · 저장 변형 2} 에서 셸 ↔ 실제 chrome 사각형 ±1 px · presented 전후 rAF 샘플링 빈 프레임 0 · 겹침 0 · 부팅 `layout-shift` 합 0 (Chromium · WebKit). 불리 케이스 3 (배치 변경 직후 · 뷰포트 변경 · 빌드 id 변경) → 최소 셸 · shift 0. **원복 RED**: 교체를 한 프레임 늦추면 (presented 다음 rAF) 빈 프레임 또는 겹침으로 FAIL | 교체 시점 수리 · 반복 실패 시 Phase 2 되돌림 (Phase 1 유지)          |
| G3   | Phase 3 | Live Exercise: 실제 빌더 cold 진입 (dark · 저장 배치) 을 headed 로 녹화해 셸 → 실제 교체 확인 + 사용자 confirm · README · CHANGELOG                                                                                                                                                                                                                                                                                                                       | —                                                                    |

### Live Exercise

- **2026-09-27 headed Chromium 녹화 (실행자)**: production build · Pages 흉내 서버 · 다크 · 저장 배치 (좌 Navigator · 우 AI 패널) · CPU 4x · 10 Mbps · 새 컨텍스트 cold 직접 진입. 365 ms 에 셸 + 패널 골격 (헤더 섬 · 패널 2 · 레일 2 · 빈 진행 막대, first-paint 380 ms — 셸 없는 빌드는 2,244 ms) → 첫 commit 2,145 ms 에 진행 막대 · 라벨 · 점 배경이 같은 자리로 이어짐 → presented 8,162 ms 에 실제 헤더 · 패널 · 레일이 골격 자리 그대로 드러남. 상세 · 게이트 수치: [breakdown §7-2](../design/247-cold-entry-static-shell-breakdown.md).
- **사용자 confirm**: 2026-09-27 "확인했어" — 녹화 프레임 (셸 + 골격 365 ms · 부팅 중 · presented) 확인. 같은 응답에서 HC5 미달분 (initial JS gzip +267 B — 부팅 mark · 셸 해제 · 기록기 지연 import 호출, ADR-201 상한 안) 수용.

## Consequences

### Positive

- 빌더 URL 직접 진입에서 JS 가 오기 전부터 사용자 테마의 앱 모양이 보인다 — 흰 화면 · 테마 깜빡임이 없어진다 (G0 이 보인 만큼).
- 셸 geometry 의 원본이 solver 출력 하나라 셸과 앱이 따로 진화하지 않는다. 드리프트는 일치 키가 막고 G2 가 잰다.
- 부팅 경계 `performance.mark` 와 부팅 `layout-shift` 측정이 생겨 ADR-244 (부팅 단축) 의 효과도 같은 자로 잰다.

### Negative

- `index.html` 에 인라인 script · CSS 가 생기고, 빌드 단계 (토큰 색 추출) 가 하나 늘어난다.
- 새 `localStorage` 키 1 개 (`composition-shell-snapshot`) 와 그 기록 시점 (presented · 배치 변경 뒤 idle) 이 생긴다.
- 첫 방문 · 배포 직후 · 뷰포트 변경 직후 진입은 패널 골격 없이 최소 셸이다.
- W1 의 길이는 줄지 않는다 — 이 ADR 은 보여 주는 것만 바꾼다 (짧게 하는 것은 ADR-244 · research Track A).
