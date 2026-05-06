# ADR-117: CanvasKit PathBuilder 전환 및 0.41.1 업그레이드

## Status

Proposed — 2026-05-02

## Context

`apps/builder`는 `canvaskit-wasm` `^0.40.0`을 사용하며, lockfile 기준 현재 설치
버전은 `0.40.0`이다. npm registry 조회 기준 최신 버전은 `0.41.1`이고,
CanvasKit upstream changelog는 `0.41.0`에서 `Path` 객체를 immutable로 바꾸고
`PathBuilder`를 노출했으며, `0.41.1`에서 `PathBuilder` 성능 문제와 `libpng`
업데이트를 반영했다고 기록한다.

현재 Skia 렌더러는 `new ck.Path()` 후 `moveTo`, `lineTo`, `arcToTangent`,
`addRect`, `addArc` 등으로 path를 직접 구성하는 패턴을 여러 렌더링 경로에서
사용한다. 따라서 `canvaskit-wasm`만 단순 bump하면 성능 개선보다 먼저 path
호환성 문제가 발생할 가능성이 높다.

공식 변경 근거:

- CanvasKit changelog:
  <https://github.com/google/skia/blob/main/modules/canvaskit/CHANGELOG.md>
- `0.41.1` release commit:
  <https://chromium.googlesource.com/skia/+/3c68f3ffd7c9bc781494cdb85e718ff1e6f49d84>
- `PathBuilder` type declaration:
  <https://skia.googlesource.com/skia/+/a31411879251/modules/canvaskit/npm_build/types/index.d.ts>

**Hard Constraints**:

1. `canvaskit-wasm` bump 전에 Skia path 생성 경로의 직접 mutable `Path` 사용을
   제거하거나 명시적 compatibility wrapper 안으로 격리해야 한다.
2. `Path.MakeFromSVGString()` 기반 icon path 경로는 동작 보존 대상이며, SVG path
   문자열 파싱 자체를 재작성하지 않는다.
3. 업그레이드 후 Builder Canvas smoke에서 path-heavy 표면(clip, border, icon,
   workflow edge)이 비어 있거나 누락되면 Gate 실패로 본다.
4. 성능 개선은 부가 효과로만 취급한다. 공개 benchmark 수치가 없으므로, 업데이트
   성공 조건은 "프레임 성능 무회귀"와 "path 호환성 확보"로 둔다.
5. package bump는 `apps/builder/package.json`, `pnpm-lock.yaml`, 배포되는
   `canvaskit.wasm` artifact 경로의 실제 로드 성공까지 함께 검증해야 한다.

**Soft Constraints**:

- Canvas/Skia 렌더링 경로 외의 scene invalidation, text metrics, image cache
  개선은 이 ADR 범위에 포함하지 않는다.
- path API 변경 대응을 이유로 renderer 전체 구조를 재작성하지 않는다.
- 0.40.0 환경과 0.41.1 환경을 동시에 장기간 지원하는 복잡한 abstraction은 피한다.

## Alternatives Considered

### 대안 A: 0.40.0 유지, 업그레이드 보류

- 설명: `canvaskit-wasm`을 현재 버전에 고정하고 path API 전환을 미룬다.
- 근거: 현재 렌더러가 mutable `Path` 패턴에 맞춰 작성되어 있어 즉시 변경 비용이
  없다.
- 위험:
  - 기술: M — upstream API 방향과 코드 패턴이 계속 벌어진다.
  - 성능: L — 현재 성능을 유지하지만 `PathBuilder` 관련 개선도 받지 못한다.
  - 유지보수: H — 다음 CanvasKit 업데이트에서 누적 마이그레이션 비용이 커진다.
  - 마이그레이션: H — 언젠가 한 번에 처리해야 하는 path call site가 증가한다.

### 대안 B: `canvaskit-wasm`만 0.41.1로 bump 후 실패 지점 패치

- 설명: package 버전을 먼저 올리고 런타임/타입 오류가 드러나는 파일만 수정한다.
- 근거: 변경량을 즉시 확인할 수 있고, 실제 실패 표면만 건드릴 수 있다.
- 위험:
  - 기술: H — path 생성 누락이 런타임 시각 결함으로 숨어 들어갈 수 있다.
  - 성능: M — `PathBuilder` 전환 없이 fallback 패치가 섞이면 성능 판단이 불명확하다.
  - 유지보수: H — renderer마다 다른 임시 패치가 생겨 path 생성 규칙이 분산된다.
  - 마이그레이션: H — 시각 회귀를 발견한 뒤 사후 수정하는 흐름이 된다.

### 대안 C: PathBuilder compatibility wrapper 도입 후 0.41.1 bump

- 설명: path 생성 helper를 먼저 만들고 mutable `Path` call site를 wrapper로
  수렴시킨 뒤 `canvaskit-wasm`을 `0.41.1`로 올린다.
- 근거: CanvasKit의 새 API 방향을 반영하면서도 renderer별 변경을 작은 단위로
  검증할 수 있다. 0.40.0 단계에서는 wrapper가 기존 `Path` 생성 방식을 감싸고,
  bump 이후에는 `PathBuilder` 기반 생성으로 전환한다.
- 위험:
  - 기술: M — `PathBuilder` API 세부 이름과 ownership lifecycle은 Phase 0에서
    실제 타입으로 확정해야 한다.
  - 성능: L — wrapper 비용은 path construction 비용에 비해 작게 유지할 수 있다.
  - 유지보수: L — path 생성 규칙이 한 곳으로 모인다.
  - 마이그레이션: M — 여러 렌더러 파일을 순차 변경해야 한다.

### 대안 D: Skia renderer path command layer 재설계

- 설명: path construction을 renderer command IR로 끌어올리고 모든 도형/edge
  path를 data command로 직렬화한다.
- 근거: 장기적으로 testable command pipeline이 될 수 있다.
- 위험:
  - 기술: H — CanvasKit upgrade보다 큰 렌더러 재설계가 된다.
  - 성능: M — command allocation이 늘어날 수 있다.
  - 유지보수: H — 현행 renderer 구조와 괴리가 커진다.
  - 마이그레이션: H — 이번 dependency update의 범위를 초과한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | H            |     2      |
| B    | H    | M    | H        | H            |     3      |
| C    | M    | L    | L        | M            |     0      |
| D    | H    | M    | H        | H            |     3      |

루프 판정: 대안 A/B/D는 HIGH가 1개 이상이므로 primary path로 채택하지 않는다.
대안 C는 HIGH 이상 위험이 없고, `PathBuilder` 전환과 dependency bump를 분리해
검증할 수 있으므로 이 ADR의 채택안으로 충분하다.

## Decision

**대안 C: PathBuilder compatibility wrapper 도입 후 0.41.1 bump**를 선택한다.

선택 근거:

1. `Path` immutable 전환을 먼저 코드 구조로 흡수해 단순 package bump의 런타임
   실패 위험을 낮춘다.
2. path 생성 규칙을 wrapper/helper로 모으면 이후 CanvasKit API 변경도 렌더러
   전역 수정 없이 대응할 수 있다.
3. `0.41.1`의 `PathBuilder` 성능 수정은 wrapper 전환 이후에만 의미 있게
   평가할 수 있다.

기각 사유:

- **대안 A 기각**: upgrade debt를 쌓아 두는 방식이며, upstream API 방향과 현행
  코드 패턴의 차이를 더 키운다.
- **대안 B 기각**: 시각 회귀가 런타임에서 뒤늦게 발견될 수 있고, renderer별
  임시 패치를 만들 가능성이 높다.
- **대안 D 기각**: dependency update를 renderer architecture rewrite로 확대한다.

> 구현 상세: [117-canvaskit-pathbuilder-upgrade-breakdown.md](design/117-canvaskit-pathbuilder-upgrade-breakdown.md)

## Residual Risks

- `PathBuilder`의 TypeScript 선언과 JS runtime API가 기존 `Path` mutator와 1:1로
  대응하지 않을 수 있다. Phase 0 spike에서 `detach()`, `detachAndDelete()`,
  `snapshot()` lifecycle과 `close()` 반환값을 실제 package 타입 기준으로 확정한다.
- `Path.MakeFromSVGString()` 반환 객체의 immutable 동작은 보존되더라도, icon stroke
  렌더링의 antialiasing 또는 bounds가 미세하게 달라질 수 있다.
- `libpng` 업데이트는 이미지 디코딩 경로에 영향을 줄 수 있으나, 이 ADR은 path
  migration을 primary scope로 두고 image decode 회귀는 smoke gate로만 확인한다.

## Gates

| Gate                | 시점           | 통과 조건                                                                                                  | 실패 시 대안                        |
| ------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| G0: API 확인        | Phase 0 종료   | `canvaskit-wasm@0.41.1`의 `PathBuilder` 생성, `detach()`/`detachAndDelete()`/`snapshot()` lifecycle, `close()` 반환값을 실제 타입 또는 runtime spike로 확정 | 0.40.0 유지, ADR 보류               |
| G1: path inventory  | Phase 0 종료   | `new ck.Path()` 및 path mutator call site 목록을 파일별로 기록하고 허용 예외를 분류                        | inventory 완료 전 구현 금지         |
| G2: wrapper 수렴    | Phase 1-2 종료 | Skia renderer의 직접 mutable `Path` 생성이 helper 또는 명시 허용 경로로만 남음                             | 해당 renderer slice rollback        |
| G3: dependency bump | Phase 3 종료   | `canvaskit-wasm` `0.41.1` lockfile 반영, Builder에서 `canvaskit.wasm` 로드 성공                            | package bump rollback               |
| G4: 시각 smoke      | Phase 4 종료   | clip, partial border, inset/outset border, icon, workflow edge가 desktop/mobile smoke에서 누락 없이 렌더링 | 해당 path builder mapping 수정      |
| G5: 성능 무회귀     | Phase 4 종료   | path-heavy scene p95 frame time이 0.40.0 baseline 대비 +10% 이내, blank frame 0                            | 0.40.0 rollback 또는 wrapper 최적화 |

## Consequences

### Positive

- CanvasKit `0.41.x`의 path API 방향에 맞춰 Skia renderer compatibility debt를
  선제적으로 줄인다.
- path construction이 helper 경계로 모여 이후 renderer별 path 생성 규칙을 테스트하기
  쉬워진다.
- `PathBuilder` 관련 upstream 성능 수정과 `libpng` 업데이트를 받을 수 있다.

### Negative

- 단순 dependency bump보다 구현 범위가 크며, 여러 Skia renderer 파일을 순차
  검증해야 한다.
- 공개 benchmark가 없으므로 "성능 향상"은 보장할 수 없고, 자체 smoke/benchmark로
  무회귀를 입증해야 한다.
- wrapper 도입 중에는 0.40.0 fallback과 0.41.1 `PathBuilder` path가 일시적으로
  함께 고려된다.
