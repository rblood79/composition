# ADR-188 Phase 5 / G6 — live parity 및 120Hz trace

검증일: 2026-08-22  
결과: **GREEN — Phase 5 완료, ADR-188 Implemented 승격 가능**

Machine-readable 요약:

- [188-phase-5-g6-live-parity.json](188-phase-5-g6-live-parity.json)
- raw result: `/private/tmp/adr188-g6-layout-final-5x.json`
- raw SHA-256: `79bc2988bd2ee07ea64109bac4809f5cd0a752bb5c845b50c228e1e63f1737a7`
- CDP trace: 15개, gzip 합계 2.2MB

## RED 재검증에서 확인한 하니스 결함

최초 RED는 제품 layout hot path를 측정한 결과가 아니었다.

1. 기존 `adr187-presentation-baseline.mjs`는 ColorArea의 paint interaction을 발화해
   layout runtime apply가 0인 상태였다. 0ms를 layout 성능 근거로 사용할 수 없었다.
2. dense fixture는 N=5,000 노드를 모두 가시 영역에 배치했다. 따라서 문서 크기 `N`이
   아니라 가시 draw workload `V=N`의 CanvasKit 비용을 측정했고, 46~57ms
   `SkiaCanvas.renderFrame` 및 terminal React task를 만들었다.
3. canonical fixture에 Skia 내부 synthetic type인 `Box`를 사용해 Preview가 `<box>`를
   생성했다. strict console error는 제품 컴포넌트가 아니라 fixture type 오류였다.
4. 브라우저에서 `renderCommands.ts`를 동적 import하면 Vite query가 다른 module
   instance를 만들 수 있어 실제 SkiaCanvas singleton과 다른 cold cache를 읽었다.

수정된 하니스는 paint lane을 보존하면서 `--lane layout`과
`--fixture-profile document-scale`을 추가했다. document-scale fixture는 canonical
`frame`을 사용하고 target 1개만 가시 상태로 유지하며 나머지는 화면 밖에 배치한다.
query opt-in read-only debug boundary는 동적 import 없이 실제
`EditorPresentationTransactionRuntime`과 SkiaCanvas가 소비하는 command-stream
singleton을 읽는다.

## 실행 범위

- 인증된 실제 Builder에서 새 프로젝트를 만들고 상단
  `Compare Mode (Preview + Skia)` split을 켰다.
- 기존 live 확인의 Style 패널 `Left` geometry commit을 유지하고, 같은 production
  singleton runtime에 숫자형 `style.patch {left, top}`을 120Hz 목표 cadence로 1초간
  발화했다.
- N=50/500/5,000에서 tier당 5회, 총 15회 실행했다. 총 문서 N은 증가시키되 가시
  workload는 target 1개로 고정했다.
- target을 body 우측 clip 경계까지 이동해 원본 120px 중 40~42px만 보이는 상태를
  만들고 DOM/Skia draw/hit clipping을 비교했다.
- apply 중 canonical store 불변, cancel 후 Preview/Skia/canvas pixel 복원을 확인했다.

재현 명령:

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://localhost:5173 \
  --duration-ms 1000 \
  --repeats 5 \
  --tiers 50,500,5000 \
  --fixture-profile document-scale \
  --lane layout \
  --out /private/tmp/adr188-g6-layout-final-5x.json \
  --trace-dir /private/tmp/adr188-g6-layout-final-5x-traces
```

## 120Hz N-tier 결과

아래 값은 tier별 5회 중앙값이다. `runtime apply`는 실제 presentation runtime의
frame callback, `Skia frame`은 실제 `SkiaCanvas.renderFrame` CDP duration이다.

|     N | runtime apply p95 / p99 | Skia frame p95 / p99 | Preview handle p95 / p99 | long task | 결과  |
| ----: | ----------------------: | -------------------: | -----------------------: | --------: | :---- |
|    50 |         0.163 / 0.193ms |      0.904 / 0.987ms |          0.093 / 0.151ms |         0 | GREEN |
|   500 |         0.179 / 0.221ms |      0.994 / 1.181ms |          0.203 / 0.242ms |         0 | GREEN |
| 5,000 |         0.165 / 0.179ms |      1.487 / 1.548ms |          1.017 / 1.091ms |         0 | GREEN |

15개 run 중 최악값도 runtime apply p95/p99 `0.200/0.315ms`, Skia frame
p95/p99 `1.509/1.751ms`다. hard constraint인 p95 `<4ms`, p99 `<8.33ms`를
충분히 만족한다. N=50→5,000에서 runtime apply 중앙 p95는
`0.163→0.165ms`로 발산하지 않았다. Skia/Preview 비용 증가는 전체 document rebuild가
아니라 command stream 배열 길이와 Preview DOM document 크기의 상수 가시 target
소비 비용이며 둘 다 frame budget 안이다.

모든 run에서 다음 hot-path counter가 0이었다.

- canonical/legacy write
- global layout publish 및 projection signature
- bridge full rebuild
- Preview full-document message
- stale callback after terminal

반면 `targetIncrementalPatchCount`는 runtime apply 수와 1:1이었고 cancel terminal에서
canonical subtree restore 1회만 추가됐다.

## DOM / Skia / hit / pixel parity

| 계약           | live 결과                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------- |
| geometry       | Preview `left/top`과 Skia bounds가 동일 descriptor를 반영                                 |
| clipping       | Preview visible width 40~~42px = Skia `hitBounds.width` 40~~42px                          |
| hit-test       | 실제 WASM SpatialIndex center query에 `adr187-target` 포함                                |
| revision       | draw/hit snapshot이 같은 presentation revision에서 교체되고 cancel revision이 단조 증가   |
| command span   | N별 command count 621 / 3,321 / 30,321, target subtree span과 count는 apply 전후 불변     |
| canonical 보호 | before/during/after store style이 모두 `left=20px`, `top=30px`                            |
| Preview cancel | apply 값 348~~350px / 43~~45px에서 `20px / 30px`로 복원                                   |
| canvas pixel   | 15/15 run에서 during composited screenshot hash 변화, cancel 후 before hash와 정확히 일치 |

`canvas.toBlob()`은 CanvasKit WebGL back buffer를 읽지 못해 빈 프레임 hash를 만들므로
증거에서 제외했다. pixel 근거는 trace 구간 밖에서 캡처한 브라우저 composited canvas
screenshot의 SHA-256이다.

## Console 및 환경

- console error/warn: 0
- page error: 0
- focused Vitest: 3 files / 28 tests PASS
- `pnpm run codex:typecheck`: 신규 위반 0, 기존 baseline 43건
- Vite production bundle: 성공

local static production host는 ADR-187 Phase 0에 기록된 기존 dynamic WASM asset
`composition-engine-pkg/composition_engine.js` 미복사 제약이 있어 Skia live gate로
사용하지 않았다. G6은 해당 WASM을 실제 로드하고 실제 Builder split에서 draw/hit을
소비하는 dev Builder로 검증했다. 이 제한은 ADR-188 변경으로 생기지 않았으며, 잘못된
fallback 수치를 GREEN 근거로 사용하지 않았다.

## 판정

초기 RED의 세 조건은 모두 종결됐다.

- cold Skia snapshot: 실제 singleton read-only 관측으로 해소
- N=5,000 long task: layout 전용 constant-visible-workload trace 15회에서 0
- lowercase `<box>` console error: canonical `frame` fixture로 교정, error/warn 0

따라서 G6은 GREEN이며 Phase 5를 Implemented로 종결한다. ADR-188의 G0~G6가 모두
완료됐으므로 ADR 상태를 `Accepted`에서 `Implemented`로 승격할 수 있다.
