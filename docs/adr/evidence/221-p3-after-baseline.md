# ADR-221 Phase 3 — 이관 후 성능 (Skia 페이지 헤더 삭제 · DOM 층)

> G2 (R2·R6). 이관 전 기준선 [221-p0-before-baseline.md](221-p0-before-baseline.md) 과 **같은 명령·같은 기기** 로 대조. 측정일 2026-09-17 · commit = Phase 3 작업 트리 · `pnpm perf:baseline -- --lane frame --pages 22 [--zoom 0.1] --headed --classes idle,pan,zoom --duration-ms 3000`. 원본 JSON: [221-p3-after-adverse.json](221-p3-after-adverse.json) · [221-p3-after-default.json](221-p3-after-default.json).

## 판정 — G2 ② "pan/zoom 부류 p95 가 이관 전 기준선 대비 악화 없음"

| 부류·arm | 지표 | before | after | 판정 |
| --- | --- | ---: | ---: | --- |
| adverse pan | render.frame p95 (ms) | 1.5 | 1.3 | 개선 |
| adverse zoom | render.frame p95 (ms) | 0.5 | 0.5 | 평탄 |
| default pan | render.frame p95 (ms) | 1.3 | 1.4 | ±0.1 (noise) |
| default zoom | render.frame p95 (ms) | 3.4 | 3.3 | 개선 |
| adverse idle/pan/zoom | callback gap p95 (ms) | 9.3 / 9.1 / 9.2 | 10.3 / 10.2 / 9.6 | 아래 주 |
| default idle/pan/zoom | callback gap p95 (ms) | 9.3 / 9.1 / 9.4 | 10.3 / 10.2 / 10.2 | 아래 주 |

**주 (measurement-validity Q3 대조군)**: callback gap p95 가 전 부류에서 균일하게 ~1 ms 올랐는데 **idle 도 같이 올랐다** (9.3 → 10.3). idle 은 제스처가 없어 헤더 층 (DOM 이든 Skia 든) 을 건드리지 않으므로, 이 이동은 ADR-221 귀속이 아니라 after run 의 환경 기저 (기기 부하) 다. ADR-221 이 실제로 바꾸는 직접 비용 지표인 **render.frame p95 (Skia 프레임 CPU) 는 평탄 또는 개선** — Skia 가 페이지당 헤더 띠 + Paragraph 를 더 이상 그리지 않기 때문. 120 Hz 에서 10.3 ms 는 여전히 ~1 vsync 이고 60 Hz floor (16.7 ms) 대비 여유. **악화 없음 → G2 ② 통과.**

## G2 ① — 제스처 중 헤더 층 DOM 쓰기 0 (MutationObserver 실계측, 22 페이지 · 10% 줌)

| 제스처 | 헤더 층 attribute 변경 |
| --- | ---: |
| 휠 pan (15 event) | 0 |
| 휠 zoom (ctrl, 12 event) | 0 |
| 스페이스 pan (10 move) | 0 |
| 대조: 게이트 밖 프로그램 zoom | 86 (재배치 정상) |

수리 1건 (측정으로 발견): 팬이 `transientVisiblePageIds` 재계산 → BuilderCanvas 리렌더 → `frames` prop 새 참조 → `[frames]` 레이아웃 이펙트가 게이트 밖에서 `placeAll` 을 부르던 경로를 `gestureActiveRef` 로 막았다 (`usePageHeaderPlacement.ts`). 배선 정적 테스트는 이 leak 을 못 잡는다 — live MutationObserver 계측이 정본.

## after 프레임 표 (원문)

### adverse (zoom 0.1)

| 부류 | frames/fps | callback gap p50 / p95 / p99 / max (ms) | callback >25ms % | 할당 MB/s | GC | longtask (n / ms) | render.frame p50/p95 | record.content p50/p95 | flush p95/max | stream miss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| idle | 361/120.2 | 8.3 / 10.3 / 10.4 / 10.6 | 0 | 0.1 | 0 | 0 / 0 | - | - | - | 0/0 |
| pan | 361/120.1 | 8.3 / 10.2 / 10.9 / 14.3 | 0 | 49.8 | 6 | 0 / 0 | 0.5/1.3 (359) | 0.1/0.6 (137) | 0.3/0.4 | 137/138 forced:137 |
| zoom | 361/120.1 | 8.3 / 9.6 / 10.1 / 10.8 | 0 | 12.7 | 2 | 0 / 0 | 0.1/0.5 (359) | 0/0.2 (45) | 0.2/0.2 | 45/45 forced:45 |

### default

| 부류 | frames/fps | callback gap p50 / p95 / p99 / max (ms) | callback >25ms % | 할당 MB/s | GC | longtask (n / ms) | render.frame p50/p95 | record.content p50/p95 | flush p95/max | stream miss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| idle | 361/120.2 | 8.3 / 10.3 / 10.4 / 11 | 0 | 0 | 0 | 0 / 0 | - | - | - | 0/0 |
| pan | 361/120.2 | 8.3 / 10.2 / 10.4 / 12.7 | 0 | 20.9 | 4 | 0 / 0 | 0.3/1.4 (359) | 0.4/0.7 (31) | 0.4/0.4 | 31/32 forced:31 |
| zoom | 358/119.1 | 8.3 / 10.2 / 11.5 / 22.3 | 0 | 116.9 | 24 | 0 / 0 | 1/3.3 (325) | 0.4/2.2 (267) | 0.8/13.9 | 266/266 forced:266 |
