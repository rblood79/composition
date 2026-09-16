# ADR-221 Phase 0 — 이관 전 기준선 (Skia 헤더, DOM 층 0)

> G0 산출물 (R6). `pnpm perf:baseline -- --lane frame --pages 22 [--zoom 0.1] --headed --classes idle,pan,zoom --duration-ms 3000`. 측정일 2026-09-17 · commit `5b2346c12` + 본 커밋의 하니스 옵션 (src 무변경) · dirty = docs 만 (병행 ADR-201 문서 1). G2 (Phase 3) 의 after 는 **같은 명령 · 같은 기기** 로 재고 이 표와 대조한다 — 다른 조건에서 잰 수치는 인용 금지 (measurement-validity Q3).

## 측정 조건

| 항목                | 값                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------ |
| 빌드                | development (Vite dev, `localhost:5173`)                                                    |
| 브라우저            | headed Chromium (Playwright) · visibilityState `visible` · viewport 1440×900 · DPR 1        |
| 디스플레이          | 120 Hz (idle frames 360/3 s = 119.9 fps) — cb gap p50 8.3 ms 가 vsync 1 칸                  |
| CPU throttle        | 1 (없음) · 사용자 체감 Chrome 은 4x throttle (user-chrome-cpu-throttle-4x)                  |
| 시드                | 요소 60 (Text/frame 격자) · 페이지 22 (6열 격자, x 1200 · y 1100)                            |
| 불리 케이스 (adverse) | `--zoom 0.1` → 22 페이지 전부 뷰포트 안 (applied zoom 0.1 · panOffset 40,80)              |
| 대조 (default)      | 시드 직후 카메라 그대로 (페이지 2~3 장만 뷰포트 안)                                          |
| 부류                | idle · pan (휠 ±24 px 왕복) · zoom (ctrl+휠 ±30 오실레이션) — 각 3 s                          |
| 원본 JSON           | [221-p0-before-adverse.json](221-p0-before-adverse.json) · [221-p0-before-default.json](221-p0-before-default.json) |

## adverse — 22 페이지 전부 뷰포트 안 (zoom 0.1)

| 부류 | frames/fps | callback gap p50 / p95 / p99 / max (ms) | callback >25ms % | 할당 MB/s | GC | longtask (n / ms) | render.frame p50/p95 | record.content p50/p95 | flush p95/max | stream miss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| idle | 360/119.9 | 8.3 / 9.3 / 9.4 / 11.9 | 0 | 0.1 | 0 | 0 / 0 | - | - | - | 0/0 |
| pan | 362/120.2 | 8.3 / 9.1 / 9.5 / 13.2 | 0 | 52.1 | 9 | 0 / 0 | 0.7/1.5 (359) | 0.1/0.6 (137) | 0.3/0.5 | 137/138 forced:137 |
| zoom | 361/119.9 | 8.3 / 9.2 / 9.4 / 9.4 | 0 | 12.6 | 1 | 0 / 0 | 0.1/0.5 (359) | 0.1/0.2 (45) | 0.2/0.2 | 45/45 forced:45 |
| 부류 / 선택 driver | RAF timestamp p95 / max (ms) | RAF >25ms n / % | callback delay p95 / max (ms) | LayerTree rows |
| --- | ---: | ---: | ---: | ---: |
| idle / - | 9.1 / 9.3 | 0 / 0 | 1.7 / 3.9 | 5 |
| pan / - | 9.1 / 9.4 | 0 / 0 | 0.4 / 6.4 | 5 |
| zoom / - | 9.1 / 9.4 | 0 / 0 | 0.4 / 0.8 | 5 |

## default — 시드 직후 카메라

| 부류 | frames/fps | callback gap p50 / p95 / p99 / max (ms) | callback >25ms % | 할당 MB/s | GC | longtask (n / ms) | render.frame p50/p95 | record.content p50/p95 | flush p95/max | stream miss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| idle | 360/119.9 | 8.3 / 9.3 / 9.4 / 9.8 | 0 | 0 | 0 | 0 / 0 | - | - | - | 0/0 |
| pan | 361/120.2 | 8.3 / 9.1 / 9.3 / 14 | 0 | 21.5 | 4 | 0 / 0 | 0.4/1.3 (359) | 0.4/0.6 (31) | 0.4/0.4 | 31/32 forced:31 |
| zoom | 325/108 | 8.3 / 9.4 / 15.2 / 147.5 | 1.2 | 126 | 22 | 3 / 285 | 1/3.4 (293) | 0.4/2.1 (238) | 0.8/54.3 | 237/237 forced:237 |
| 부류 / 선택 driver | RAF timestamp p95 / max (ms) | RAF >25ms n / % | callback delay p95 / max (ms) | LayerTree rows |
| --- | ---: | ---: | ---: | ---: |
| idle / - | 9.2 / 9.4 | 0 / 0 | 1.8 / 2.2 | 5 |
| pan / - | 9.1 / 9.4 | 0 / 0 | 0.4 / 6.7 | 5 |
| zoom / - | 9.3 / 141.7 | 4 / 1.2 | 1.3 / 12.2 | 5 |

## 읽는 법 (G2 대조 기준)

- **주 지표**: pan · zoom 의 `callback gap p95` (프레임 케이던스) 와 `render.frame p95` (Skia 프레임 CPU). after 에서 두 값이 이 표보다 나빠지지 않아야 G2 ② 통과.
- adverse 가 default 보다 **가볍다** (zoom p95 0.5 vs 3.4 ms, longtask 0 vs 3): 0.1 줌에서는 요소 60 개가 화면 픽셀 몇 개로 줄어 래스터 비용이 작다. DOM 헤더 층은 반대로 **페이지 수** 에 비례하므로 (22 노드 배치) adverse 가 DOM 층의 불리 케이스다 — 두 arm 을 다 대조한다.
- default zoom 의 longtask 3 / max 147 ms 는 이관 전에도 있는 값 (헤더와 무관 — 요소 래스터 재생성). after 에서 이 값이 커지면 원인 분리 필요.
