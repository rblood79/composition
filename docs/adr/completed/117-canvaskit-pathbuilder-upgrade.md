# ADR-117: CanvasKit PathBuilder 전환 및 0.42.0 업그레이드

## Status

**Implemented — 2026-08-28** (Phase 0~~4 / G0~~G5 완료. CanvasKit `0.42.0`,
`PathBuilder` 단일 생성 경로, desktop/mobile live smoke와 p95 무회귀 검증 통과).

이력: 2026-05-02 Proposed 작성 → **2026-08-27 재설계** (대상 버전 0.41.1 → 0.42.0,
Phase 0 API spike + path inventory 실측 반영, 대안 B 위험 재평가) → 2026-08-27 착수 전 보강
(미기재 위험 R8~~R10 추가, G3 production 번들 로드 포함) → 2026-08-27 Accepted 승격 →
2026-08-28 Phase 1~~4 / G0~G5 완료, Implemented 승격

### 구현 결과

- 20개 mutable `Path` construction site를 `buildPath` seam으로 수렴시키고,
  `canvaskit-wasm`을 `^0.42.0`으로 올려 `PathBuilder` + `detachAndDelete()` 단일 lifecycle로
  전환했다. 직접 mutable `Path`, 0.40.0 fallback, 로컬 shim과 mock 잔존은 0건이다.
- fresh dev와 production chunk에서 7,317,345-byte WASM 로드, WebGL surface 생성과
  Skia 49파일 375 tests를 통과했다.
- G4에서 발견한 초기 이미지 placeholder 고착은 `loadSkImage()`가 CanvasKit의 공유 init
  Promise를 기다리도록 근본 원인을 수정했다. PNG/JPEG/WebP decode, 9개 path-heavy 표면,
  Orthogonal/Bezier edge·arrow·indicator, zoom snapshot blit을 1280×720과 390×844에서 확인했다.
- G5 0.42.0 p95는 Orthogonal/Bezier 각 `9.3/9.3/9.3 ms`, 양쪽 median `9.3 ms`로
  0.40.0 baseline 대비 `+0.0%`였다. 6회 long task 0, blank frame 0이며 +10% 상한
  `10.23 ms`를 통과했다.

## Context

**Domain (3-domain 분할)**: D3 시각 스타일의 direct consumer인 Builder Skia의 **구현 의존성 갱신**이다. SSOT(catalog/theme)·D1/D2 경계 변경 없음, CSS/DOM consumer 무영향 — 대칭 검증 대상은 "업그레이드 전후 Skia 결과 동일"뿐이다.

### 버전 현황 (2026-08-27 registry 실측)

`apps/builder`는 `canvaskit-wasm` `^0.40.0`을 사용하며 lockfile/installed 버전은
`0.40.0`(2025-03-31)이다. 2026-05-02 설계 시점의 최신은 `0.41.1`이었으나 그 후
`0.42.0`(2026-08-18)이 공개됐다. 세 릴리스 모두 미반영 상태다.

| 버전   | 일자       | 변경 (upstream CHANGELOG)                                                                                                                                                                                                         | composition 영향                                                                                                   |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0.41.0 | 2026-03-18 | **Breaking**: `Path` immutable, `PathBuilder` 노출. `FontMetrics`에 underline/strikeout 추가. emsdk 컴파일 설정 수정                                                                                                              | Skia renderer의 mutable `Path` 사용 20곳 전부 런타임 TypeError (아래 실측)                                         |
| 0.41.1 | 2026-04-07 | `PathBuilder` 성능 문제 수정, libpng 1.6.56                                                                                                                                                                                       | `imageCache.ts:338` `MakeImageFromEncoded` 디코드 경로                                                             |
| 0.42.0 | 2026-08-18 | `PathBuilder.setFillType`이 복사본 대신 JS 객체 참조를 반환하도록 수정. `MakeImageFromCanvasImageSource` VideoFrame 치수 수정. `Canvas.drawImageCubic`/`drawImageOptions` 기본 `Fast_SrcRectConstraint` (filter/mipmap 옵션 보존) | `nodeRendererBorders.ts:434` EvenOdd fill (0.41.x 결함 대상). `SkiaRenderer.ts:817` snapshot blit `drawImageCubic` |

패키지 entry(`bin/canvaskit.js`, `exports`, `types`)와 `@webgpu/types@0.1.21` 의존성은
0.40.0과 동일하다. `bin/canvaskit.wasm`은 7,094,511 → 7,317,345 bytes (+223KB, +3.1%).

### API 변경 실측 (0.42.0 타입 선언 + Node 런타임 spike)

- **`Path`(0.42.0)에 남은 메서드**: `computeTightBounds / contains / copy / countPoints /
equals / getBounds / getFillType / getPoint / isEmpty / makeAsWinding / makeCombined /
makeDashed / makeSimplified / makeStroked / makeTrimmed / setFillType / toCmds /
toSVGString`. 구 `op / dash / simplify / stroke / trim`은 `make*` 계열로 개명(현행
  코드 사용 0건). `Path.MakeFromSVGString / MakeFromCmds / MakeFromOp` factory는 유지.
- **`PathBuilder`(0.42.0)**: `moveTo / lineTo / quadTo / cubicTo / conicTo / arcToTangent /
arcToOval / arcToRotated / addRect / addRRect / addCircle / addOval / addArc / addPath /
addPolygon / close / setFillType / transform / offset` + 종료 API `detach()` (Path 반환
  후 builder 비움) / `detachAndDelete()` (Path 반환 후 builder delete) / `snapshot()`
  (Path 반환, builder 유지). 런타임에는 타입 미선언 `reset()` / `arc()`도 존재.
- **런타임 spike 결과** (`canvaskit-wasm@0.42.0`, Node):
  - `new ck.Path()`는 생성되지만 `moveTo === undefined` → 현행 mutable 사용 전부
    `TypeError`로 **조기·명시적** 실패 (조용한 시각 결함 아님). 단 `Path.setFillType`은
    남아 있어 `nodeRendererBorders.ts:434`만 단독으로는 통과.
  - `PathBuilder.close()`는 **런타임에서 builder 자신을 반환** — 타입 선언(`close(): Path`)과
    불일치. `close()` 반환값을 ownership 이전으로 쓰면 안 된다.
  - 모든 mutator가 같은 builder 참조를 반환(체이닝 안전). `setFillType` 도 동일 (0.42.0
    수정 확인).
  - `detachAndDelete()` 후 builder 재사용은 `BindingError`. EvenOdd donut(`addRect` +
    `addRRect` + `setFillType`)이 builder 경유로 동일하게 동작.

### 현행 코드 inventory (2026-08-27 grep 실측)

| 파일 (`apps/builder/src/builder/workspace/canvas/skia/`) | `new ck.Path()` | mutator 호출 (close·setFillType 포함) | lifecycle                                                 | 비고                                                                                                                       |
| -------------------------------------------------------- | :-------------: | :-----------------------------------: | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `nodeRendererClip.ts`                                    |        5        |                  21                   | caller 반환 → `renderCommands.ts:2188` delete (호출 2185) | round-rect/inset/circle/ellipse/polygon clip. 반환 타입이 `ReturnType<CanvasKit["Path"]["prototype"]["constructor"]>` 별칭 |
| `nodeRendererShapes.ts`                                  |        5        |                  25                   | 즉시 `delete()`                                           | arc(1) + partial border 4변. SVG icon은 `Path.MakeFromSVGString` (유지 대상)                                               |
| `nodeRendererBorders.ts`                                 |        4        |                  19                   | 즉시 `delete()`                                           | inset/outset 3D clip 2 + inner-shadow EvenOdd donut 1 + arc 1                                                              |
| `workflowRenderer.ts`                                    |        3        |                  19                   | `scope.track()`                                           | orthogonal(arcToTangent) + bezier(`cubicTo` 유일 사용) + arrow + indicator line                                            |
| `nodeRendererImage.ts`                                   |        1        |                   6                   | `scope.track()`                                           | placeholder mountain                                                                                                       |
| `hoverRenderer.ts`                                       |        1        |                   2                   | `scope.track()`                                           | overflow hatching (`renderOverflowHatching`). hover outline은 `drawRect`라 Path 이관 대상 아님                             |
| `slotMarkerRenderer.ts`                                  |        1        |                   2                   | `scope.track()`                                           | marker line                                                                                                                |
| **합계 (7 파일)**                                        |     **20**      |                **94**                 | track 6 / 즉시 delete 9 / 반환 5                          | = path 명령 87 + `close()` 6 + `setFillType` 1. `cubicTo` 1. `op/stroke/dash/trim/transform/offset` 0                      |

이 외 `disposable.ts:25`는 주석, `components/particle/canvasUtils.ts`·
`selection/resizeCursors.ts`는 HTML Canvas 2D (대상 아님). 테스트 mock은
`nodeRendererImage.test.ts`의 `MockPath` 1건. 7개 파일은 2026-07-27 ~ 08-27 사이 모두
수정 이력이 있어(`workflowRenderer.ts`는 당일) Phase 2 착수 시 재grep이 필요하다.

### Hard Constraints

1. `canvaskit-wasm` bump 전에 Skia renderer의 직접 mutable `Path` 사용 20곳을 helper 경계로
   수렴시킨다. bump 후 `pnpm type-check` baseline 대비 신규 위반 0 (builder는 `scripts/type-check-baseline.sh`, 현재 baseline 0줄) — 0.42.0 타입에서 `Path` mutator가 전부
   제거되므로 type-check가 이관 누락을 정적으로 드러낸다 (`ReturnType<...>` 별칭과 테스트
   mock만 예외이므로 함께 정리).
2. `Path.MakeFromSVGString()` 기반 icon 경로는 동작 보존 대상이며 SVG 파싱을 재작성하지 않는다.
3. 업그레이드 후 Builder Canvas smoke에서 path-heavy 표면(clip, partial border, inset/outset,
   inner shadow, icon, image placeholder, workflow edge/arrow, overflow hatching, hover/slot
   marker)이 비어
   있거나 누락되면 Gate 실패.
4. 성능은 "무회귀"가 성공 조건이다 — path-heavy scene p95 frame time이 0.40.0 baseline 대비
   +10% 이내, blank frame 0.
5. bump는 `apps/builder/package.json` + `pnpm-lock.yaml` + `scripts/prepare-wasm.mjs`가
   복사하는 `apps/builder/public/wasm/canvaskit.wasm`(gitignore, 7,317,345 bytes)의 실제
   로드 성공까지 검증한다 — dev 서버와 production 번들(`vite build` + `vite preview`) 양쪽.
6. **최소 버전 0.42.0** — 0.41.x는 `PathBuilder.setFillType` 복사 반환 결함으로 EvenOdd
   donut(inner shadow) 경로가 helper 체이닝 계약과 어긋난다. `^0.42.0` 고정.
7. `SkiaRenderer.ts:817` snapshot blit(`drawImageCubic`, zoom mismatch 시)의 시각 결과가
   0.42.0 기본 constraint 변경 후에도 동일해야 한다.

### Soft Constraints

- scene invalidation, text metrics, image cache 개선은 범위 밖. `FontMetrics` underline/
  strikeout 추가는 additive라 대응 불요.
- path API 변경 대응을 이유로 renderer 구조를 재작성하지 않는다.
- 0.40.0/0.42.0 동시 지원 창은 **Phase 1~2 한 구간**으로 제한하고 bump phase에서 0.40.0
  분기를 제거한다.

## Alternatives Considered

### 대안 A: 0.40.0 유지, 업그레이드 보류

- 설명: `canvaskit-wasm`을 현재 버전에 고정하고 path API 전환을 미룬다.
- 근거: 즉시 변경 비용이 없다.
- 위험:
  - 기술: M — upstream과 3 릴리스 차이가 계속 벌어진다.
  - 성능: L — 현재 성능 유지, `PathBuilder` 성능 수정·libpng 갱신도 받지 못한다.
  - 유지보수: H — 다음 CanvasKit 갱신 때 누적 마이그레이션 비용이 커진다.
  - 마이그레이션: H — 언젠가 한 번에 처리해야 하는 call site가 증가한다 (5월 이후에도 7개
    파일 전부 수정됨).

### 대안 B: `canvaskit-wasm`만 0.42.0으로 bump 후 실패 지점 직접 패치

- 설명: 버전을 먼저 올리고 type-check/런타임 오류가 드러나는 파일만 `PathBuilder`로 직접
  고친다. helper 없음.
- 근거 (2026-08-27 재평가): 실패는 조용하지 않다 — mutator 87곳 전부 type-check에서
  드러나고 런타임은 `TypeError`. 2026-05 설계의 "시각 결함으로 숨어 든다"는 전제는
  실측으로 기각된다.
- 위험:
  - 기술: M — `close()` 타입/런타임 불일치 같은 함정을 7개 파일이 각자 처리한다.
  - 성능: L — 동일 API 전환이라 helper 여부와 무관.
  - 유지보수: M — path 생성 규칙·mock이 파일별로 분산 (`MockPath` → 파일별 `MockPathBuilder`).
  - 마이그레이션: M — bump + 7 파일 수정이 한 commit 묶음이어야 해서 phase 분할 commit이
    불가능하고 rollback 단위가 크다 (CLAUDE.md §대규모 작업 phase 분할 원칙과 충돌).

### 대안 C: PathBuilder helper 도입 후 0.42.0 bump (채택)

- 설명: `buildPath(ck, (b) => …): Path` 한 개의 생성 seam을 먼저 만들고 20곳을 순차
  수렴시킨 뒤 bump한다. helper는 0.40.0에서는 `new ck.Path()`를, 0.42.0에서는
  `ck.PathBuilder` + `detachAndDelete()`를 감싼다(`typeof ck.PathBuilder` 분기 1개). bump
  phase에서 0.40.0 분기를 삭제한다.
- 근거: 각 파일 이관이 0.40.0 위에서 **동작 변화 0으로 commit 가능**하고, 타입/런타임 함정
  (`close()` 반환, ownership)을 한 곳에서만 처리한다. 테스트 mock도 helper 1개.
- 위험:
  - 기술: L — API는 spike로 확정됨 (G0 통과).
  - 성능: L — helper 비용은 closure 1개. builder 할당 비용은 G5로 측정, 실패 시 `detach()`
    기반 재사용 builder로 전환 가능.
  - 유지보수: L — path 생성 규칙이 한 곳으로 모인다.
  - 마이그레이션: L — 파일 단위 commit, rollback = 해당 commit revert.

### 대안 D: Skia renderer path command layer 재설계

- 설명: path construction을 renderer command IR로 끌어올리고 data command로 직렬화한다.
- 근거: 장기적으로 testable command pipeline이 될 수 있다.
- 위험:
  - 기술: H — dependency update보다 큰 renderer 재설계.
  - 성능: M — command allocation 증가.
  - 유지보수: H — 현행 구조와 괴리.
  - 마이그레이션: H — 이 ADR 범위를 초과.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | H            |     2      |
| B    | M    | L    | M        | M            |     0      |
| C    | L    | L    | L        | L            |     0      |
| D    | H    | M    | H        | H            |     3      |

루프 판정: A/D는 HIGH가 있어 제외. B는 재평가 결과 HIGH 0으로 채택 가능 범위에
들어왔으나, C가 4축 모두 B 이하이고 phase 분할 commit·단일 mock seam을 추가로 확보하므로
C를 채택한다. B는 C의 fallback (helper 도입 중 문제가 생기면 남은 사이트를 직접 전환).

## Decision

**대안 C: PathBuilder helper 도입 후 `canvaskit-wasm` `^0.42.0` bump**를 선택한다.

선택 근거:

1. `Path` immutable 전환을 helper 한 곳에 흡수해 20곳/87 호출을 파일 단위로 commit하면서
   0.40.0 위에서 동작 변화 0을 유지한다.
2. `close()` 타입/런타임 불일치, `detachAndDelete()` 후 재사용 금지, 반환 `Path` delete
   책임 같은 lifecycle 규칙을 helper 계약으로 고정한다.
3. 최소 버전을 0.42.0으로 두어 `setFillType` 복사 반환 결함(0.41.x)을 회피하고 libpng·
   `PathBuilder` 성능 수정을 함께 받는다.
4. 잔존 위험이 전부 MEDIUM 이하라 위험 수용 가능 — 각 위험은 아래 Gate로 관리한다.

기각 사유:

- **대안 A 기각**: 3 릴리스 부채를 더 쌓는다. 7개 파일이 계속 수정되고 있어 미룰수록 이관
  대상이 늘어난다.
- **대안 B 기각**: HIGH는 없으나 phase 분할 commit이 불가능하고 함정 처리·mock이 7곳으로
  분산된다. C의 fallback으로만 둔다.
- **대안 D 기각**: dependency update를 renderer architecture rewrite로 확대한다.

> 구현 상세: [117-canvaskit-pathbuilder-upgrade-breakdown.md](../design/117-canvaskit-pathbuilder-upgrade-breakdown.md)

## Risks

| ID  | 위험                                                                                                                         | 심각도 | 대응                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `PathBuilder.close()` 타입 선언(`Path`) ≠ 런타임(builder) — 반환값을 Path로 쓰면 다음 CanvasKit 갱신 때 깨진다               |   M    | helper가 `close()` 반환값을 버리고 `void`로 노출. helper 단위 테스트에 계약 고정                                                           |
| R2  | 0.42.0 `drawImageCubic` 기본 `Fast_SrcRectConstraint` — zoom mismatch snapshot blit의 경계 샘플링이 달라질 수 있다           |   M    | G4에 zoom 1.0 ≠ snapshot zoom 상태 시각 항목 추가. 차이 발견 시 `drawImageOptions`/paint로 명시 지정                                       |
| R3  | `PathBuilder` WASM 객체 할당이 per-path 비용을 늘려 path-heavy scene 회귀                                                    |   M    | G5 p95 +10% 게이트. 실패 시 helper 내부를 module-level builder + `detach()` 재사용으로 교체 (호출부 무변경)                                |
| R4  | inventory drift — 7개 파일이 최근 30일 내 모두 수정됨, Phase 2 착수 시점에 사이트 수가 달라질 수 있다                        |   M    | Phase 2 착수 직전 G1 grep 재실행, breakdown 표 갱신 commit 후 이관 시작 (M3 원칙: gap은 inventory 보강, fork 사유 아님)                    |
| R5  | libpng 1.6.56 디코드 차이 (`MakeImageFromEncoded`)                                                                           |   L    | G4 image smoke (PNG/JPEG/WebP 각 1)                                                                                                        |
| R6  | wasm +223KB 초기 로드                                                                                                        |   L    | G3에서 초기 로드 <3초 기준 재측정 (JS 번들 500KB 기준과 별도 artifact)                                                                     |
| R7  | 테스트 mock drift — `MockPath`가 mutable API를 흉내내 helper 도입 후 dead                                                    |   L    | helper mock 1개로 교체, `MockPath` 제거                                                                                                    |
| R8  | Phase 1~2 동안 설치된 0.40.0 타입 선언에 `PathBuilder` 가 없어 helper 의 0.42.0 분기가 type-check 를 못 통과한다             |   M    | helper 파일 내부 한정 구조적 로컬 타입(`PathBuilderLike`)으로 접근, export 금지. Phase 3 에서 `canvaskit-wasm` 타입으로 교체·삭제          |
| R9  | helper 의 0.42.0 분기는 Phase 3 bump 전까지 dead code — mock 테스트만 통과하고 실제 wasm 검증이 bump 시점이 처음             |   M    | Phase 1 에 실 wasm 통합 테스트(`@vitest-environment node`, scratchpad 0.42.0 tgz 경로 env 주입) 1회, Phase 3 후 설치 패키지 기준 상시 가드 |
| R10 | glue JS `bin/canvaskit.js` 가 emsdk 갱신으로 재컴파일 — dev 서버 통과가 production 번들(`vite build`) 통과를 보장하지 않는다 |   L    | G3 에 `vite build` + `vite preview` 로드 1회 포함. 로드 구조(fetch/instantiateStreaming/require 호출 수)는 0.40.0 과 동일 실측             |

잔존 HIGH 위험 없음. Gate는 MEDIUM 위험 R1~R4의 통과 조건을 명시하기 위해 유지한다.

## Gates

| Gate                | 시점                             | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안                                                                         |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| G0: API 확인        | Phase 0 종료                     | ✅ **2026-08-27 통과** — 0.42.0 타입 + Node 런타임 spike로 `PathBuilder` 생성, `detach/detachAndDelete/snapshot`, `close()` 반환(builder), `setFillType` 참조 반환 확정                                                                                                                                                                                                                        | —                                                                                    |
| G1: path inventory  | Phase 0 종료 + Phase 2 착수 직전 | ✅ 2026-08-27 20곳/94호출(path 명령 87 + close 6 + setFillType 1)/7파일 기록. Phase 2 착수 시 재grep 결과가 표와 다르면 표 갱신 commit 후 진행                                                                                                                                                                                                                                                 | inventory 갱신 전 이관 금지                                                          |
| G2: helper 수렴     | Phase 2 종료                     | ✅ **2026-08-27 통과** — skia 디렉터리에서 `new ck.Path(`는 helper 파일 1곳, breakdown Phase 2 Migration Gate 정규식(`transform/offset` 제외 — `buildSpecNodeData.ts:439 rule.transform`은 Path 아님) 매치는 helper 내부뿐. `Path.MakeFromSVGString` 1곳 허용. 0.40.0 위에서 unit test + live smoke 동작 변화 0                                                                                | 해당 파일 commit revert                                                              |
| G3: dependency bump | Phase 3 종료                     | ✅ **2026-08-28 통과** — lockfile `canvaskit-wasm@0.42.0`, `public/wasm/canvaskit.wasm` 7,317,345 bytes. `PathBuilder` 단일 경로, 0.40.0 분기·`PathBuilderLike`·constructor `ReturnType`·`MockPath` 0건. type-check 신규 위반 0, 실 WASM + Skia 49파일/372테스트 PASS. fresh dev Builder 67-element seed 렌더, production chunk cold-load 93 ms + PathBuilder/WebGL surface + console error 0. | package bump revert (helper는 유지)                                                  |
| G4: 시각 smoke      | Phase 4 종료                     | ✅ **2026-08-28 통과** — 9개 표면, PNG/JPEG/WebP decode, Orthogonal/Bezier+arrow/indicator, 61→60% snapshot blit을 desktop 1280×720 + mobile 390×844에서 확인. blank·artifact·CanvasKit/page error 0. 초기 raster placeholder 고착은 `loadSkImage()`의 CanvasKit init 대기로 수정하고 회귀 테스트 고정                                                                                         | 해당 helper mapping 수정 또는 `drawImageOptions` 명시                                |
| G5: 성능 무회귀     | Phase 4 종료                     | ✅ **2026-08-28 통과** — canonical 67 elements, 1280×720, fit 60%, 60→61→60% pulse. 0.42.0 Orthogonal/Bezier 각 p95 `9.3/9.3/9.3 ms`, median `9.3 ms`, baseline 대비 `+0.0%` ≤ `10.23 ms`. 6회 long task 0, blank frame 0, FPS 120~121                                                                                                                                                         | helper 내부 builder 재사용(`detach()`) 전환 → 재측정, 그래도 실패 시 0.40.0 rollback |

## Consequences

### Positive

- CanvasKit 0.41.0 breaking change를 helper 한 곳에 흡수해 20곳/87 호출의 compatibility
  debt를 청산하고 upstream 최신(0.42.0)에 맞춘다.
- path construction이 `buildPath` seam으로 모여 renderer별 path 규칙을 단위 테스트할 수
  있고, 테스트 mock도 1개로 줄어든다.
- `PathBuilder` 성능 수정(0.41.1), `setFillType` 수정(0.42.0), libpng 1.6.56을 받는다.

### Negative

- 단순 bump보다 구현 범위가 크다 — helper 1 + 7 파일 순차 commit + bump commit.
- 공개 benchmark가 없어 "성능 향상"은 보장할 수 없고 자체 `path-heavy-117` 시드 문서 +
  `__composition_PROFILER` p95로 무회귀만 입증한다 (`scenarios.ts` 하네스는 duration/name만
  소비해 fixture를 만들지 못함).
- Phase 1~2 동안 helper에 0.40.0/0.42.0 분기가 공존한다 (Phase 3에서 제거). 0.42.0 분기는 그
  구간에 dead code 이고 로컬 타입 shim 에 의존한다 — 실 wasm 통합 테스트(R9)가 유일한 실행 검증.
- `drawImageCubic` 기본 constraint 변경은 이 ADR의 primary scope 밖 표면이지만 bump에
  딸려 오므로 G4로 확인해야 한다.
