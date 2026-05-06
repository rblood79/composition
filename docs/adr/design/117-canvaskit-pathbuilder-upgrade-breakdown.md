# ADR-117 Breakdown: CanvasKit PathBuilder 전환 및 0.41.1 업그레이드

## Scope

이 문서는 `canvaskit-wasm` `0.40.0 → 0.41.1` 업그레이드를 위해 필요한 Skia
path construction 전환 작업을 정의한다. 목표는 성능 개선 보장이 아니라
`Path` immutable 전환 대응과 CanvasKit runtime future compatibility 확보다.

## Current Baseline

- 직접 dependency: `apps/builder/package.json`의 `canvaskit-wasm`.
- 현재 lockfile: `canvaskit-wasm@0.40.0`.
- 최신 registry 결과: `0.41.1`.
- 관련 upstream 변경:
  - `0.41.0`: `Path` immutable, `PathBuilder` 노출, `FontMetrics` underline/strikeout
    metrics 추가.
  - `0.41.1`: `PathBuilder` performance issue 수정, `libpng 1.6.56` update.

## Phase 0: API Spike + Inventory

### 작업

1. `canvaskit-wasm@0.41.1` 타입과 runtime에서 `PathBuilder` API 이름을 확정한다.
   현재 공식 type declaration 기준 ownership transfer API는 `finish()`가 아니라
   `detach()`, `detachAndDelete()`, `snapshot()`이다.
2. 현행 mutable `Path` 사용을 파일별로 inventory화한다.
3. `Path.MakeFromSVGString()`처럼 유지 가능한 factory path와 직접 migration 대상 path를
   분리한다.
4. `canvaskit.wasm` artifact가 `scripts/prepare-wasm.mjs` 또는 public wasm 경로와
   어떤 방식으로 동기화되는지 확인한다.

### 확인 명령

```bash
pnpm outdated -r --format json canvaskit-wasm vite-plugin-wasm
rg -n "new ck\\.Path\\(|\\.moveTo\\(|\\.lineTo\\(|\\.quadTo\\(|\\.cubicTo\\(|\\.arcToTangent\\(|\\.addArc\\(|\\.addRect\\(|\\.addRRect\\(|\\.addCircle\\(|\\.addOval\\(" apps/builder/src/builder/workspace/canvas/skia
rg -n "Path\\.MakeFromSVGString|MakePath|PathBuilder|canvaskit-wasm" apps/builder packages
```

### 산출물

- `PathBuilder` 실제 API 메모.
- `detach()` / `detachAndDelete()` / `snapshot()` / `close()` 반환값별 lifecycle
  결정.
- migration 대상 파일 목록.
- 허용 예외 목록.

## Phase 1: Path Construction Helper 도입

### 작업

1. `apps/builder/src/builder/workspace/canvas/skia/pathBuilderCompat.ts`를 추가한다.
2. helper는 0.40.0 단계에서는 기존 `Path` 생성 방식으로 동작하고, 0.41.1 단계에서는
   `PathBuilder` 기반으로 path를 완성한다.
3. helper API는 renderer 코드가 CanvasKit의 mutable path 세부 API에 직접 의존하지
   않도록 최소 method set만 제공한다.

### Helper 요구사항

- 지원 method:
  - `moveTo`
  - `lineTo`
  - `quadTo`
  - `cubicTo`
  - `arcToTangent`
  - `addRect`
  - `addRRect`
  - `addCircle`
  - `addOval`
  - `addArc`
  - `close`
  - `toPath`
- lifecycle:
  - `toPath()` 후 반환된 `Path`는 기존 renderer의 `canvas.drawPath()`와 동일하게 사용한다.
  - 0.41.1 기본 구현은 one-shot builder에서 `detachAndDelete()`를 우선 사용한다.
  - builder 재사용이 필요한 특수 경로만 `detach()` 또는 `snapshot()`을 명시적으로 선택한다.
  - `close()`는 path command 추가 method로만 취급하고, 반환값을 ownership transfer로
    사용하지 않는다.
  - builder 또는 임시 path가 별도 delete를 요구하면 helper가 책임진다.
  - 반환 path delete 책임은 기존과 동일하게 caller 또는 `SkiaResourceScope`가 가진다.

### 금지

- renderer 파일에서 `ck.PathBuilder`를 직접 new/import 하지 않는다.
- helper 도입을 이유로 draw order, paint 설정, bounds 계산을 변경하지 않는다.

## Phase 2: Renderer Migration

| 대상                     | 현재 패턴                                               | 전환 방향                                                          | 검증 포인트                         |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| `nodeRendererClip.ts`    | round rect, inset/circle/ellipse/polygon path 직접 생성 | helper 기반 path 생성                                              | clip path 누락 0, rounded clip 보존 |
| `nodeRendererShapes.ts`  | partial border, arc, icon path                          | partial border/arc는 helper, SVG icon은 `MakeFromSVGString()` 유지 | partial border radius/dash 보존     |
| `nodeRendererBorders.ts` | inset/outset clip path, arc path                        | helper 기반 path 생성                                              | 3D border clip 양쪽 색상 보존       |
| `nodeRendererImage.ts`   | placeholder mountain icon path                          | helper 또는 간단 shape helper                                      | image placeholder 렌더링 보존       |
| `slotMarkerRenderer.ts`  | marker line path                                        | helper 기반 path 생성                                              | component/slot marker 보존          |
| `hoverRenderer.ts`       | hover outline path                                      | helper 기반 path 생성                                              | hover guide 누락 0                  |
| `workflowRenderer.ts`    | orthogonal/bezier edge, arrow path                      | helper 기반 path 생성                                              | edge/arrow 방향 보존                |

### Migration Gate

```bash
rg -n "new ck\\.Path\\(" apps/builder/src/builder/workspace/canvas/skia
rg -n "\\.(moveTo|lineTo|quadTo|cubicTo|arcToTangent|addArc|addRect|addRRect|addCircle|addOval|close)\\(" apps/builder/src/builder/workspace/canvas/skia
```

통과 기준:

- 직접 `new ck.Path()`는 `pathBuilderCompat.ts`와 명시 허용 factory wrapper에만 남긴다.
- `Path.MakeFromSVGString()`은 예외로 허용한다.
- path mutator 호출은 helper 내부 또는 helper wrapper call에 한정한다.

## Phase 3: `canvaskit-wasm` 0.41.1 Bump

### 작업

1. `apps/builder/package.json`의 `canvaskit-wasm` specifier를 `^0.41.1`로 변경한다.
2. `pnpm-lock.yaml`을 갱신한다.
3. wasm artifact 준비 스크립트가 public wasm을 복사한다면 `canvaskit.wasm` 경로도 실제
   `0.41.1` binary가 로드되는지 확인한다.
4. package bump와 path migration을 같은 PR/commit 묶음으로 유지한다.

### 확인 명령

```bash
pnpm install --lockfile-only
pnpm install --ignore-scripts
pnpm run prepare:wasm
pnpm -F @composition/builder exec vite --version
```

`pnpm install --ignore-scripts`는 lockfile만 바뀐 상태와 installed tree가 어긋나는
상황을 피하기 위해 사용한다.

## Phase 4: Verification

### Static / Type

```bash
pnpm run codex:typecheck
pnpm run codex:format
```

### Targeted Smoke

필수 smoke scene:

- rounded clip이 있는 frame.
- partial border + dash + radius가 있는 node.
- inset/outset border가 있는 node.
- icon path가 있는 component.
- image placeholder.
- workflow edge orthogonal + bezier + arrow.
- hover/slot/component marker overlay.

### Browser / Visual

검증 기준:

- Canvas가 blank가 아니다.
- console error/pageerror 0.
- smoke scene에서 path 기반 요소 누락 0.
- desktop과 mobile viewport 모두에서 workflow edge와 clip이 유지된다.

### Performance

성능은 "향상"이 아니라 "무회귀"로 측정한다.

필수 benchmark scenario:

- `path-heavy-117`
  - rounded clip frame
  - partial border + dash + radius node
  - inset/outset border node
  - icon path component
  - image placeholder
  - workflow edge orthogonal + bezier + arrow
  - hover/slot/component marker overlay

실행 방식:

- 기존 `apps/builder/src/builder/workspace/canvas/benchmarks/canvasBenchmark.ts` 또는
  `devProfiler.ts` 경로에 위 fixture를 연결한다.
- G5는 이 scenario가 추가된 뒤에만 판정한다. 단순 `static-*`, `mutate-*`,
  `drag-*`, `zoom-*` scenario 결과만으로는 G5를 통과시킬 수 없다.

권장 baseline:

- 0.40.0 + mutable `Path`: path-heavy scene frame time p95.
- 0.41.1 + `PathBuilder`: 같은 scene frame time p95.

통과 기준:

- p95 frame time이 baseline 대비 +10% 이내.
- blank frame 0.
- path-heavy interaction 중 long task 급증 없음.

## Rollback

1. `canvaskit-wasm` specifier와 lockfile을 `0.40.0` 상태로 되돌린다.
2. helper migration은 유지 가능하다. 0.40.0 fallback path가 동작하면 코드 구조 개선으로
   남겨도 된다.
3. 0.41.1 runtime 전용 API가 helper 밖에 남아 있으면 rollback 전에 제거한다.

## Completion Checklist

- [ ] G0: `PathBuilder` 실제 API 확인 완료.
- [ ] G1: path inventory와 허용 예외 목록 작성.
- [ ] G2: 직접 mutable `Path` 생성이 helper 경계로 수렴.
- [ ] G3: `canvaskit-wasm@0.41.1` lockfile 반영 및 wasm load 성공.
- [ ] G4: path-heavy smoke scene 시각 검증 통과.
- [ ] `path-heavy-117` benchmark scenario 추가.
- [ ] G5: frame time p95 baseline +10% 이내.
- [ ] `docs/CHANGELOG.md`에 CanvasKit runtime update 기록.
