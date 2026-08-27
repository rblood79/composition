# ADR-117 Breakdown: CanvasKit PathBuilder 전환 및 0.42.0 업그레이드

> 2026-08-27 재설계 — 대상 0.41.1 → 0.42.0. Phase 0(API spike + inventory)은 이 재설계에서
> 실측 완료(G0/G1 통과). Phase 1부터가 구현 착수 범위.
>
> 2026-08-27 착수 전 보강 — 미기재 위험 4건(ADR R8~R10 + Phase 2 commit 규칙) 반영: 0.40.0 타입
> `PathBuilder` 부재 shim, 0.42.0 분기 dead code 실 wasm 통합 테스트, production 번들 로드 검증,
> 선택 add. 재grep 결과 inventory 표와 일치(20 사이트 / 87 / close 6 / setFillType 1, skia 디렉터리
> 변경 commit 0).

## Scope

`canvaskit-wasm` `0.40.0 → ^0.42.0` 업그레이드를 위한 Skia path construction 전환. 목표는
성능 향상이 아니라 `Path` immutable 전환 대응 + upstream 최신 정합 + 무회귀 입증.

범위 밖: scene invalidation / text metrics / image cache 개선, renderer 구조 재작성,
`FontMetrics` underline·strikeout 활용.

## Current Baseline (2026-08-27 실측)

- 직접 dependency: `apps/builder/package.json` `"canvaskit-wasm": "^0.40.0"`, lockfile
  `0.40.0`. 다른 workspace 패키지는 canvaskit 미의존 (`packages/specs`는 주석만).
- registry: `0.41.0`(2026-03-18) / `0.41.1`(2026-04-07) / **`0.42.0`(2026-08-18, latest)**.
- wasm artifact: `scripts/prepare-wasm.mjs`(postinstall)가 `canvaskit-wasm/bin/canvaskit.wasm`
  → `apps/builder/public/wasm/canvaskit.wasm`(gitignore) 복사. `initCanvasKit.ts`가
  `locateFile`로 `${BASE_URL}wasm/canvaskit.wasm` 로드. 크기 7,094,511 → 7,317,345 bytes.
- 패키지 entry/exports/`@webgpu/types@0.1.21` 동일 — `vite-plugin-wasm` 경로 무관
  (canvaskit은 glue JS의 fetch 로드).

### 0.42.0 API (타입 + Node 런타임 spike 확정)

| 항목                       | 결과                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Path` 잔존 메서드         | read-only(`getBounds/computeTightBounds/contains/copy/countPoints/equals/getFillType/getPoint/isEmpty/toCmds/toSVGString`) + `setFillType(): void` + `makeAsWinding/makeCombined/makeDashed/makeSimplified/makeStroked/makeTrimmed` |
| `Path` 제거 메서드         | `moveTo/lineTo/quadTo/cubicTo/conicTo/arcTo*/rXxx/add*/close/transform/offset/reset/rewind/op/dash/simplify/stroke/trim/setIsVolatile`                                                                                              |
| `Path` factory             | `new ck.Path()`(빈 immutable path) / `MakeFromSVGString / MakeFromCmds / MakeFromOp / MakeFromVerbsPointsWeights` 유지                                                                                                              |
| `PathBuilder` 생성         | `new ck.PathBuilder()` / `new ck.PathBuilder(path)` (복사)                                                                                                                                                                          |
| `PathBuilder` mutator 반환 | 전부 같은 builder 참조 (체이닝 안전). `setFillType`도 동일 (0.42.0 수정 확인)                                                                                                                                                       |
| `PathBuilder.close()`      | 타입 선언 `Path`, **런타임 builder 반환** — 반환값 사용 금지                                                                                                                                                                        |
| `detach()`                 | `Path` 반환 + builder 비움 (재사용 가능)                                                                                                                                                                                            |
| `detachAndDelete()`        | `Path` 반환 + builder delete. 이후 호출은 `BindingError`                                                                                                                                                                            |
| `snapshot()`               | `Path` 반환 + builder 유지                                                                                                                                                                                                          |
| 타입 미선언 런타임 메서드  | `reset()`, `arc()` — 사용 금지 (선언 없음)                                                                                                                                                                                          |
| EvenOdd donut              | `addRect` + `addRRect` + `setFillType(EvenOdd)` → `detachAndDelete()` 결과 `contains(center)=false / contains(ring)=true` 확인                                                                                                      |

spike 재현 (scratch 디렉터리, repo 무변경):

```bash
npm pack canvaskit-wasm@0.42.0 && tar xzf canvaskit-wasm-0.42.0.tgz
node -e "require('./package/bin/canvaskit.js')({locateFile:(f)=>require('path').join(__dirname,'package/bin',f)}).then(ck=>{const b=new ck.PathBuilder();console.log(b.moveTo(0,0)===b, b.close()===b, typeof new ck.Path().moveTo)})"
```

## Phase 0: API Spike + Inventory — ✅ 완료 (2026-08-27)

### Inventory (G1)

`apps/builder/src/builder/workspace/canvas/skia/` 기준. 줄 번호는 2026-08-27 HEAD
(`e319a95af`).

| 파일                     | 사이트 (줄)                       | mutator 종류                                                           | lifecycle                                          | 전환 방향                                                                                                    |
| ------------------------ | --------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `nodeRendererClip.ts`    | 42, 94, 106, 112, 119             | moveTo/lineTo/arcToTangent/close, addRRect/addRect, addCircle, addOval | 반환 → `renderCommands.ts:2188` delete (호출 2185) | `buildRoundRectPath`/`buildClipPath`가 `buildPath` 반환. 반환 타입 `ReturnType<CanvasKit["Path"]…>` → `Path` |
| `nodeRendererShapes.ts`  | 80, 119, 137, 155, 173 (+220 SVG) | addArc, moveTo/lineTo/arcToTangent ×4변                                | 즉시 `delete()`                                    | 5곳 `buildPath`. 220 `MakeFromSVGString` **유지**                                                            |
| `nodeRendererBorders.ts` | 263, 291, 421, 647                | moveTo/lineTo/close ×2, addRect/addRRect/setFillType, addArc           | 즉시 `delete()`                                    | 4곳 `buildPath`. 421은 `b.setFillType(EvenOdd)`로 이전                                                       |
| `workflowRenderer.ts`    | 397, 494, 642                     | moveTo/lineTo/arcToTangent/cubicTo, moveTo/lineTo/close, moveTo/lineTo | `scope.track()`                                    | `scope.track(buildPath(…))`                                                                                  |
| `nodeRendererImage.ts`   | 74                                | moveTo/lineTo/close                                                    | `scope.track()`                                    | 동일                                                                                                         |
| `hoverRenderer.ts`       | 242                               | moveTo/lineTo                                                          | `scope.track()`                                    | overflow hatching (`renderOverflowHatching`). hover outline은 `drawRect`라 이관 대상 아님                    |
| `slotMarkerRenderer.ts`  | 53                                | moveTo/lineTo                                                          | `scope.track()`                                    | 동일                                                                                                         |

합계 20 사이트 / mutator 94 호출 (path 명령 87 + `close()` 6 + `setFillType` 1) / `cubicTo` 1.
`op/stroke/dash/trim/transform/offset/simplify` 0건 → `make*` 개명 대응 불요.

허용 예외:

- `nodeRendererShapes.ts:220` `ck.Path.MakeFromSVGString(d)` — 0.42.0 유지 API.
- `disposable.ts:25` — 주석 예시 (helper 예시로 갱신).
- `components/particle/canvasUtils.ts`, `selection/resizeCursors.ts` — HTML Canvas 2D.

테스트 mock: `nodeRendererImage.test.ts:41-46 MockPath` (moveTo/lineTo/close/delete) —
Phase 1에서 helper mock으로 교체.

bump에 딸려 오는 비-path 표면:

- `SkiaRenderer.ts:817` `drawImageCubic` — 0.42.0 기본 `Fast_SrcRectConstraint` (G4 항목).
- `imageCache.ts:338` `MakeImageFromEncoded` — libpng 1.6.56 (G4 image smoke).
- `selectionRenderer.ts:387`, `snapGuideRenderer.ts:128` `font.getMetrics()` — additive.

### 재grep 명령 (Phase 2 착수 직전 필수)

```bash
rg -n "new ck\.Path\(" apps/builder/src/builder/workspace/canvas/skia
rg -n "\.(moveTo|lineTo|quadTo|cubicTo|conicTo|arcToTangent|arcToOval|arcToRotated|addArc|addRect|addRRect|addCircle|addOval|addPath|addPoly|close|setFillType|transform|offset)\(" apps/builder/src/builder/workspace/canvas/skia --glob '!*.test.ts'
rg -n "Path\.Make|PathBuilder|MockPath" apps/builder/src
```

결과가 위 표와 다르면 표를 갱신하는 commit을 먼저 만든다 (M3 — gap은 inventory 보강,
fork 사유 아님).

## Phase 1: `buildPath` helper 도입

### 파일

`apps/builder/src/builder/workspace/canvas/skia/buildPath.ts` (+ `buildPath.test.ts`)

### API

```ts
import type {
  CanvasKit,
  FillType,
  InputRect,
  InputRRect,
  Path,
} from "canvaskit-wasm";

export interface PathSink {
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  quadTo(x1: number, y1: number, x2: number, y2: number): this;
  cubicTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): this;
  arcToTangent(x1: number, y1: number, x2: number, y2: number, r: number): this;
  addRect(rect: InputRect): this;
  addRRect(rrect: InputRRect): this;
  addCircle(cx: number, cy: number, r: number): this;
  addOval(oval: InputRect): this;
  addArc(oval: InputRect, startDeg: number, sweepDeg: number): this;
  setFillType(fill: FillType): this;
  close(): this; // 반환값은 sink 자신 — Path ownership 이전 아님
}

/** 완성된 immutable Path 를 반환한다. delete 책임은 caller (또는 scope.track). */
export function buildPath(ck: CanvasKit, build: (b: PathSink) => void): Path;
```

### 구현 규칙

- 분기 1개: `typeof ck.PathBuilder === "function"` → 0.42.0 경로 (`new ck.PathBuilder()` →
  build → `detachAndDelete()`), 아니면 0.40.0 경로 (`new ck.Path()` 에 동일 mutator 위임).
  분기는 Phase 3에서 삭제.
- **0.40.0 타입 선언에는 `PathBuilder` 가 없다** (ADR R8) — Phase 1~2 의 0.42.0 분기는 helper
  파일 내부에만 구조적 로컬 타입을 두고 접근한다:
  `interface PathBuilderLike { moveTo(...): unknown; …; close(): unknown; setFillType(f: FillType): unknown; detachAndDelete(): Path; delete(): void }`
  를 선언하고 `(ck as CanvasKit & { PathBuilder?: new () => PathBuilderLike }).PathBuilder` 로
  꺼낸다. 이 shim 은 export 하지 않으며 Phase 3 에서 `canvaskit-wasm` 의 `PathBuilder` 타입으로
  교체 후 삭제한다. 0.40.0 경로의 `Path` mutator 는 0.40.0 타입 그대로 사용 (shim 불요).
- `close()`는 sink 내부에서 builder `close()`를 호출하고 반환값을 버린다 (R1).
- `setFillType`은 builder 경로에서 `PathBuilder.setFillType`, 0.40.0 경로에서
  `Path.setFillType` — 두 경로 모두 sink `this` 반환.
- build 콜백이 throw하면 builder를 delete하고 재throw (WASM 누수 방지).
- helper 외부에서 `ck.PathBuilder`를 직접 new/import 하지 않는다.
- helper는 draw order / paint / bounds 계산에 관여하지 않는다.

### 테스트

- `buildPath.test.ts`: mock ck 2종 (PathBuilder 있음/없음)으로 (1) mutator 위임 순서,
  (2) `close()` 반환값이 sink, (3) `detachAndDelete` 1회 호출, (4) 콜백 throw 시 builder
  delete, (5) 0.40.0 경로에서 `new ck.Path()` 1회.
- `nodeRendererImage.test.ts`의 `MockPath` → `PathBuilder` 포함 mock으로 교체 (또는
  `buildPath`를 vi.mock).
- `buildPath.integration.test.ts` — **실제 wasm 로드** (ADR R9): 0.42.0 분기는 Phase 3 전까지
  설치된 0.40.0 위에서 실행되지 않는 dead code 라 mock 테스트만으로는 검증되지 않는다.
  파일 상단 `// @vitest-environment node` (builder vitest 기본은 jsdom — emscripten 환경 감지가
  web 분기로 빠지지 않게) 로 `canvaskit-wasm` 을 실제 초기화(`locateFile` 로 `bin/` 경로 지정)해
  `buildPath` 로 EvenOdd donut(`addRect` + `addRRect` + `setFillType`)을 만들고
  `contains(center)=false / contains(ring)=true`, `close()` 호출 후 builder 재사용 가능,
  `detachAndDelete` 후 반환 Path `isEmpty()=false` 를 확인한다. Phase 1 시점에는 env
  (`CANVASKIT_BIN_DIR`) 로 scratchpad 의 `canvaskit-wasm@0.42.0` `bin/` 경로를 주입해 1회 실행
  (repo 무변경, env 미설정 시 설치 패키지 = 0.40.0 경로 검증), Phase 3 bump 후 env 없이 설치
  패키지 기준 상시 회귀 가드로 승격.

## Phase 2: Renderer Migration (파일 단위 commit)

순서는 위험 오름차순 — 각 commit 후 0.40.0 위에서 type-check + 해당 unit test + live
smoke 1회.

### Commit 규칙

- **선택 add 만** — `git add <이관 파일> <테스트 파일>`, `git add -A` 금지. 7 파일 전부
  07-27~08-27 사이 수정 이력이 있고 `workflowRenderer.ts` 는 08-27 당일 수정이라 병렬 세션
  WIP 를 삼킬 위험이 있다 (메모리 `feedback-git-add-all-swallows-parallel-session-wip`).
  commit 전 `git status --short` 로 staged 가 해당 파일만인지 확인.
- 마지막 순서인 `workflowRenderer.ts` 착수 직전 해당 파일만 재grep (3 사이트 / mutator 18 /
  close 1 기준). 달라졌으면 inventory 표 갱신 commit 후 이관 (R4).

| 순서 | 대상                     | 사이트 | 검증 포인트                                                             |
| :--: | ------------------------ | :----: | ----------------------------------------------------------------------- |
|  1   | `slotMarkerRenderer.ts`  |   1    | slot/component marker 라인                                              |
|  2   | `hoverRenderer.ts`       |   1    | overflow hatching 사선, Difference + child bounds clip 보존             |
|  3   | `nodeRendererImage.ts`   |   1    | image placeholder mountain (+ mock 교체)                                |
|  4   | `nodeRendererClip.ts`    |   5    | 5 shape clip 누락 0, rounded clip 보존, `renderCommands.ts` delete 유지 |
|  5   | `nodeRendererBorders.ts` |   4    | inset/outset 양쪽 색상, inner shadow donut(EvenOdd), arc                |
|  6   | `nodeRendererShapes.ts`  |   5    | partial border radius/dash 4변, arc. SVG icon 무변경                    |
|  7   | `workflowRenderer.ts`    |   3    | orthogonal/bezier/arrow 방향, indicator line                            |

### Migration Gate (G2)

```bash
rg -n "new ck\.Path\(" apps/builder/src/builder/workspace/canvas/skia --glob '!buildPath.ts' --glob '!disposable.ts' --glob '!*.test.ts'   # production 0건 (disposable.ts 주석 예시는 Phase 3 갱신)
rg -o "buildPath\(ck" apps/builder/src/builder/workspace/canvas/skia --glob '!buildPath.ts' --glob '!*.test.ts' | wc -l   # 20곳
rg -o "\.(moveTo|lineTo|quadTo|cubicTo|arcToTangent|addArc|addRect|addRRect|addCircle|addOval|close|setFillType)\(" apps/builder/src/builder/workspace/canvas/skia --glob '!buildPath.ts' --glob '!*.test.ts' | wc -l   # PathSink 명령 94회
```

두 번째/세 번째 grep은 각각 renderer의 `buildPath` 호출 수와 그 콜백 안의 `PathSink`
명령 inventory를 고정한다. sink 명령은 helper 밖 renderer 콜백에 남는 것이 정상이라 mutator
grep 0건을 요구하지 않는다. 직접 mutable `Path` 사용은 첫 번째 grep과 Phase 3의 0.42.0
immutable `Path` type-check가 차단한다.

## Phase 3: `canvaskit-wasm` ^0.42.0 bump + 0.40.0 분기 제거

1. `apps/builder/package.json` `"canvaskit-wasm": "^0.42.0"` (최소 0.42.0 — 0.41.x 금지, ADR
   Hard Constraint 6).
2. `pnpm install` → lockfile `0.42.0`, postinstall `prepare-wasm`이 7,317,345 bytes 복사.
3. `buildPath.ts` 0.40.0 분기 삭제 → `PathBuilder` 단일 경로. `PathSink`는 유지 (seam).
4. `nodeRendererClip.ts` 반환 타입 `ReturnType<CanvasKit["Path"]["prototype"]["constructor"]>`
   → `import type { Path }`.
5. `MockPath` 잔존 0, `disposable.ts:25` 주석 갱신.
6. `pnpm type-check` baseline 대비 신규 위반 0 (builder는 `scripts/type-check-baseline.sh`, 현재 baseline 0줄) — 0.42.0 타입은 `Path` mutator를 노출하지 않으므로 helper 밖
   잔존 사용이 있으면 여기서 드러난다.
7. **production 번들 로드** (ADR R10): `pnpm -F @composition/builder build` → `vite preview` 로
   Builder 를 열어 canvaskit 로드·console error 0 확인. glue JS `bin/canvaskit.js` 가 emsdk
   갱신(0.41.0)으로 재컴파일됐고(129,433 → 120,877 bytes) `canvaskit-wasm` 은
   `optimizeDeps.include` 밖 dynamic import 라 dev 서버 통과가 production 번들 통과를 보장하지
   않는다. 로드 구조(fetch 2 / instantiateStreaming 2 / require 2 / import.meta 0)는 0.40.0 과
   동일 확인됨(2026-08-27 실측) — 위험은 L 이나 확인 비용이 build 1회라 G3 에 포함.
8. `buildPath.integration.test.ts` 를 env 없이 설치 패키지(0.42.0) 기준으로 실행 → 상시 회귀
   가드 전환.

확인 명령:

```bash
pnpm install
pnpm run prepare:wasm && ls -l apps/builder/public/wasm/canvaskit.wasm   # 7317345
grep -n "canvaskit-wasm@" pnpm-lock.yaml
pnpm type-check
rg -n "typeof ck\.PathBuilder|new ck\.Path\(" apps/builder/src   # 0건
pnpm -F @composition/builder build && pnpm -F @composition/builder preview   # production 번들 로드 1회 (Chrome MCP console error 0)
pnpm -F @composition/builder test -- buildPath.integration   # 설치 0.42.0 실 wasm
```

## Phase 4: Verification

### Static / Unit

```bash
pnpm type-check
pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia
```

### Live smoke (Chrome MCP, desktop + mobile viewport)

| 표면                                                | 확인                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ |
| rounded clip frame                                  | 자식 overflow가 둥근 모서리로 잘림                           |
| partial border + dash + radius                      | 4변 각각 dash·radius 보존                                    |
| inset / outset border                               | 대각 분할 양쪽 색상                                          |
| inner shadow (spread/offset)                        | donut EvenOdd — 안쪽 구멍 투명                               |
| icon component                                      | SVG icon stroke 동일                                         |
| image placeholder + PNG/JPEG/WebP                   | mountain path + libpng 디코드                                |
| workflow edge orthogonal/bezier/arrow + indicator   | 방향·화살표 보존                                             |
| overflow hatching / hover / slot / component marker | overflow 사선 + overlay 라인                                 |
| **zoom mismatch snapshot blit**                     | zoom 변경 직후 프레임(`drawImageCubic` 경로) 경계 artifact 0 |

기준: canvas blank 아님, console error/pageerror 0, 위 표 누락·차이 0.

### Performance (G5)

측정 수단은 `benchmarks/devProfiler.ts`의 `window.__composition_PROFILER.start()/report()`
(frameTime p95)다. `benchmarks/scenarios.ts`의 `BenchmarkScenario` 필드(elements/
mutationsPerFrame 등)는 현행 하네스가 소비하지 않는다 — `canvasBenchmark.ts:30,37`은
`duration`/`name`만 읽고 `SCENARIOS`/`runFullBaseline`은 benchmarks 밖 import 0건. 따라서
scenario 항목 추가만으로는 fixture가 만들어지지 않는다.

`path-heavy-117` = 위 smoke 표면을 모두 포함하는 **시드 문서**(builder 프로젝트). live
builder에 로드한 뒤 `__composition_PROFILER.start()` 5초 수집 → `report().frameTime.p95`를
기록한다. 기존 `static-*/mutate-*/drag-*/zoom-*/multipage-*`만으로는 G5 판정 불가.

- baseline: 0.40.0 + `buildPath`(0.40.0 분기) p95 frame time — Phase 2 종료 시 기록.
- 대상: 0.42.0 + `PathBuilder` p95.
- 통과: +10% 이내, blank frame 0, long task 급증 없음.
- 실패 시 1차: helper 내부를 module-level builder + `detach()` 재사용으로 교체 (호출부
  무변경) → 재측정. 2차: 0.40.0 rollback.

#### 0.40.0 baseline evidence (2026-08-28)

- render revision: `144811178` (`origin/main` 일치), 설치본 `canvaskit-wasm@0.40.0`.
- seed: `?benchmark=path-heavy-117&edge=<orthogonal|bezier>` dev-only canonical 문서.
  2 page / 실측 67 elements이며 rounded clip, partial dash/radius border,
  inset/outset, inner shadow, Icon 8, placeholder+PNG/JPEG/WebP Image 12,
  overflow/slot/component marker, navigation workflow edge+arrow를 포함한다.
- 환경: Codex in-app Browser, 명시 viewport `1280×720`, 120 Hz, Builder Desktop.
  source page `Fit to screen` 결과 60%에서 각 5초 run 중 `60→61→60%` zoom pulse를
  1회 실행해 snapshot blit 경로를 포함했다. workflow overlay는 각 run 전에 켰다.
- profiler 계약 보정: `start()`가 완료 p95/p99를 보존하고 `report()`가 마지막 완료
  run을 반환한다. `PerformanceObserver("longtask")`의 5초-window count/total/max와
  `documentElement.dataset` evidence도 같은 report에 기록한다.

| edge mode  | 5초 p95 samples (ms) | median p95 | p99 max | long task |
| ---------- | -------------------- | ---------- | ------- | --------- |
| Orthogonal | 9.3 / 9.3 / 9.4      | 9.3 ms     | 10.1 ms | 0 / 0 / 0 |
| Bezier     | 9.3 / 9.3 / 9.6      | 9.3 ms     | 12.1 ms | 0 / 0 / 0 |

**채택 baseline = 두 edge mode median 중 큰 값 `9.3 ms`.** 따라서 0.42.0 G5
통과 상한은 `10.23 ms`(baseline +10%)다. 6회 모두 FPS avg 120, canvas blank 0,
console error 0. 경고는 supplied project UUID의 metadata record 부재 1종만 반복됐고,
query fixture가 canonical 문서를 주입하므로 측정 surface에는 영향이 없다.

#### Phase 3 G3 evidence (2026-08-28)

- dependency: `apps/builder/package.json` specifier `^0.42.0`, lockfile package/snapshot
  둘 다 `0.42.0`. `prepare:wasm` 산출물은 정확히 `7,317,345 bytes`.
- code gate: `buildPath.ts`는 `new ck.PathBuilder()` 단일 경로를 사용하고
  callback throw 시 builder delete, 성공 시 `detachAndDelete()` ownership을 유지한다.
  `typeof ck.PathBuilder` / `new ck.Path()` / `PathBuilderLike` / `MockPath` /
  Path constructor `ReturnType` 잔존은 모두 0건.
- static/runtime: type-check baseline 신규 위반 0. helper·renderer 집중 7파일
  15 tests, Skia directory 49파일 372 tests PASS(4 skip).
- dev Builder: 기존 5173 프로세스의 0.40 glue cache와 신규 0.42 WASM이
  섞인 오류를 발견해 기각. `vite --force` fresh 5174에서 canonical 67-element
  seed가 시각 누락 없이 렌더됐고 CanvasKit export error 0, FPS 120, smoke p95
  9.3 ms, long task 0.
- production: 정식 `vite build` PASS. local `vite preview`는 build base
  `/composition/`을 mount하지 않아 `/composition/assets/*`에 HTML fallback을 반환하는
  기존 preview 제약이 있어, 동일 production chunk을 root-base로 서빙해 분리
  검증했다. app entry는 Sign In까지 console error 0, `initCanvasKit` dynamic chunk +
  7,317,345-byte WASM cold origin 93 ms, `PathBuilder` export·WebGL surface 생성·delete PASS.

## Rollback

1. `canvaskit-wasm` specifier·lockfile을 `0.40.0`으로 되돌리고 `prepare:wasm` 재실행.
2. `buildPath.ts`에 0.40.0 분기를 복원 (Phase 3 commit revert). helper와 Phase 2 이관은
   유지 가능.
3. helper 밖에 0.42.0 전용 API가 남아 있으면 제거.

## Completion Checklist

- [x] G0: `PathBuilder` API 타입 + 런타임 확인 (2026-08-27).
- [x] G1: inventory 20 사이트 / 87 호출 / 허용 예외 기록 (2026-08-27) — Phase 2 착수 시 재grep.
- [x] Phase 1: `buildPath.ts`(0.40.0 타입 shim 내부 한정) + unit 테스트 + **실 wasm 통합 테스트**(scratchpad 0.42.0 tgz 로 1회), `MockPath` 교체 (`52adb4255`, `bab053f25`).
- [x] G2: 7 파일 이관 완료, helper 밖 mutable `Path` 0건 (`097647105`까지).
- [x] G5 baseline: canonical `path-heavy-117` seed + 0.40.0 p95 `9.3 ms`, 상한 `10.23 ms` (2026-08-28).
- [x] G3: `^0.42.0` lockfile, wasm 7,317,345 bytes 로드(dev + **production 번들**), 0.40.0 분기·별칭·mock·shim 제거, type-check 0, 통합 테스트 설치 패키지 기준 PASS (2026-08-28).
- [ ] G4: smoke 표 9항목 (zoom mismatch blit 포함) desktop/mobile PASS.
- [ ] G5: p95 +10% 이내.
- [ ] `docs/CHANGELOG.md` CanvasKit 0.42.0 runtime update 기록 + README Implemented 갱신.
