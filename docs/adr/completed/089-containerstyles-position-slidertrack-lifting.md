# ADR-089: ContainerStylesSchema.position? 신규 필드 + SliderTrack position:relative 리프팅

## Status

Implemented — 2026-04-20

## Implementation

- **Step 1**: `ContainerStylesSchema.position?` optional 필드 신설 (`spec.types.ts`) — enum = static/relative/absolute/fixed/sticky
- **Step 2**: `CSSGenerator.generateContainerStyleLines` (`CSSGenerator.ts:702+`) 에 `position` emit 추가 — layout primitive 블록 내. 재빌드 `generated/SliderTrack.css` 에 `position: relative` emit 확인
- **Step 3**: `implicitStyles.ts:137-154` `CONTAINER_STYLES_FALLBACK_KEYS` 에 `"position"` 추가 — `resolveContainerStylesFallback` 이 자동으로 parentStyle 에 선주입
- **Step 4**: `SliderTrack.spec.ts:42-50` `containerStyles.position = "relative"` 선언 (`display: "grid"` 와 함께)
- **Step 5**: `implicitStyles.ts:1722-1726` SliderTrack 분기의 `position: "relative"` 할당 제거 — `effectiveParent = withParentStyle(...)` 블록 해체 (resolveContainerStylesFallback 이 대신 주입). thumb 배치 로직(`children.map` + `position: absolute` + `left: ${percent}%`) 유지
- **검증**: `rg 'position: "relative"' implicitStyles.ts` = **0건**. type-check 3/3 + specs 166/166 (SliderTrack snapshot 1 updated) + builder 217/217 PASS. Preview/Canvas 대칭 복원 (Preview DOM 에 `position: relative` emit 으로 SliderThumb absolute 배치 기준 형성).

## Context

본 ADR 은 [ADR-087 후속 ADR 후보 #2](087-implicitstyles-residual-branches-categorized-sweep.md#후속-adr-후보) 가 예고한 해체 작업이다. ADR-087 SP6 이 TagGroup 등 synthetic-merge 카테고리 5 분기 중 4 분기를 해체했으나 **SliderTrack 의 `position: "relative"` 할당 1 건** 은 `ContainerStylesSchema` 가 `position` 필드를 지원하지 않아 `implicitStyles.ts` 분기에 잔존했다.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. `position` 은 요소 배치 context 를 결정하는 시각 스타일 속성이며 Canvas(Skia) 와 Preview(DOM+CSS) 양쪽 consumer 가 동일 값을 받아야 한다. 현재는 `implicitStyles.ts` (Canvas 전용) 만 할당 중이고 Preview CSS 에는 해당 선언이 없다 — D3 symmetric 원칙 위반 상태.

### 잔존 debt

**`implicitStyles.ts:1722-1726` SliderTrack 분기**:

```ts
// SliderTrack에 position:relative 설정
effectiveParent = withParentStyle(containerEl, {
  ...parentStyle,
  position: "relative",
});
```

- `position: "relative"` 는 자식 `SliderThumb` 의 `position: "absolute"` + `left: "${percent}%"` 배치 기준(containing block) 을 형성
- 분기의 나머지 로직(thumb 위치 계산) 은 per-instance `value/minValue/maxValue` 의존 → runtime 결정이므로 spec 리프팅 대상 아님. **`position: "relative"` 만 static 값 (layout-primitive)** → 리프팅 가능

### 추가 발견 — D3 symmetric 대칭 debt

Preview/Builder 비대칭 확인:

- Canvas (Skia, `implicitStyles.ts:1722`): `position: relative` 주입
- Preview (DOM, `generated/SliderTrack.css`): `position` 선언 없음 — default `static`

브라우저에서 SliderTrack 이 `position: static` 인 상태로 렌더되면 자식 SliderThumb 의 `position: absolute` 가 가장 가까운 positioned 조상(부모 Slider) 기준으로 배치됨 → **Preview 에서 thumb 위치 오차 발생 가능**. 본 ADR 은 Record/분기 해체와 동시에 **CSSGenerator emit 확장** 을 포함하여 양 consumer 가 동일 값(`position: relative`) 을 받도록 대칭 복원한다.

### Hard Constraints

1. `implicitStyles.ts:1722-1751` SliderTrack 분기의 thumb 배치 로직(`children.map` + `position: absolute` + `left: ${percent}%`) pixel-perfect 유지
2. `CONTAINER_STYLES_FALLBACK_KEYS` 확장으로 공급되는 position 값이 사용자 편집 우선 규칙 보존 (`parentStyle.position !== undefined` 시 skip)
3. **Preview DOM 의 SliderTrack position 값이 Canvas 와 동일 (`relative`)** — D3 symmetric 복원
4. 기존 62 spec 의 `ContainerStylesSchema` 타입 BC 유지 — optional 필드이므로 기존 spec 영향 0
5. CSSGenerator emit 확장이 다른 62 spec 영향 없음 — `containerStyles.position == null` 인 spec 은 emit skip
6. `implicitStyles.ts` 에 잔존한 하드코딩 `position:` 할당 0건 달성 (ADR-087 SP6 SliderTrack 잔존 debt 폐쇄)

### Soft Constraints

- `ContainerStylesSchema.position?` 는 후속 컴포넌트 (Popover trigger 등 position 요구 spec) 에서도 재사용 가능
- position enum 범위 — CSS position 값 전부(static/relative/absolute/fixed/sticky) 선언. SliderTrack 은 `relative` 만 사용하지만 Schema 확장이므로 full enum 권장

## Alternatives Considered

### 대안 A: `ContainerStylesSchema.position?` optional 필드 신설 (선정)

- 설명: `packages/specs/src/types/spec.types.ts` `ContainerStylesSchema` 에 `position?: "static" | "relative" | "absolute" | "fixed" | "sticky"` optional 필드 추가. `SliderTrackSpec.containerStyles.position = "relative"` 선언. `CSSGenerator.ts:generateContainerStyleLines` 에 `position` emit 추가. `CONTAINER_STYLES_FALLBACK_KEYS` 에 `"position"` 추가. `implicitStyles.ts:1722-1726` 의 `position: "relative"` 할당 제거 (read-through 가 대신 주입)
- 근거: ADR-085 gridTemplate\* 확장, ADR-084 flexWrap 확장, ADR-079 alignItems/justifyContent 확장과 **동일 5-touch-point 패턴**. optional 필드이므로 BC 0
- 위험:
  - 기술: LOW — 단일 필드 추가, 단일 소비처 전환
  - 성능: LOW — resolveContainerStylesFallback lookup 이미 O(1)
  - 유지보수: LOW — SSOT 복귀
  - 마이그레이션: LOW — BC 0

### 대안 B: implicitStyles SliderTrack 분기 유지 (debt 영구화)

- 설명: `ContainerStylesSchema` 확장 없이 현 상태 유지. SliderTrack position 하드코딩 분기 그대로
- 근거: 범위 축소
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — ADR-087 SP6 후속 후보 #2 debt 영구화 → ADR-063 D3 symmetric 원칙 위반 고착화. Preview thumb 위치 오차 미수정
  - 마이그레이션: LOW

### 대안 C: SliderTrack.spec.render.shapes 내부에서 position 주입

- 설명: `containerStyles` 대신 `spec.render.shapes` 또는 `spec.sizes` 에 position 값 저장 → specific consumer 가 분기 처리
- 근거: Schema 확장 회피
- 위험:
  - 기술: MEDIUM — shapes 는 Skia 렌더 전용 schema (DOM layout context 미지원)
  - 성능: LOW
  - 유지보수: **HIGH** — D3 symmetric 불가능 (shapes 는 Skia 단방향) → 대안 B 와 동일 debt
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                    | HIGH+ 수 | 판정                 |
| ----------------------- | :------: | -------------------- |
| A: Schema 확장 + 리프팅 |    0     | PASS                 |
| B: 현 상태 유지         |    1     | (debt 영구화 → 기각) |
| C: render.shapes 우회   |    2     | (양립 불가 → 기각)   |

대안 A 가 HIGH+ 0 개로 threshold pass. 루프 불필요.

## Decision

**대안 A 채택**. `ContainerStylesSchema.position?` 필드 신설 + SliderTrack 리프팅. 대안 B/C 는 D3 symmetric 원칙 위반 debt 를 고착화하므로 기각. ADR-085 gridTemplate\* 확장 선례와 동일 5-touch-point 패턴 적용.

### 구현 범위 (5-touch-point)

1. **`packages/specs/src/types/spec.types.ts`** — `ContainerStylesSchema` 에 `position?: "static" | "relative" | "absolute" | "fixed" | "sticky"` optional 필드 추가. ADR-089 주석 첨부.
2. **`packages/specs/src/renderers/CSSGenerator.ts:generateContainerStyleLines`** — `if (c.position) lines.push("position: ${c.position};")` emit 추가. layout primitive 블록 영역 내 (display / flex-direction 뒤).
3. **`apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:137-153`** `CONTAINER_STYLES_FALLBACK_KEYS` — `"position"` 추가.
4. **`packages/specs/src/components/SliderTrack.spec.ts:42-44`** — `containerStyles: { display: "grid", position: "relative" }` 선언.
5. **`apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:1722-1726`** — `position: "relative"` 할당 제거 (resolveContainerStylesFallback 가 대신 주입). thumb 배치 로직(1728-1751) 은 유지.

## Risks

| ID  | 위험                                                                | 심각도 | 대응                                                                                                        |
| --- | ------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------- |
| R1  | Preview SliderTrack position 주입으로 기존 수동 CSS 와 충돌         |  LOW   | `generated/SliderTrack.css` 는 없음(별도 수동 CSS 미사용). build:specs 재생성으로 emit 확인                 |
| R2  | 사용자 편집 position 값이 있을 경우 read-through fallback 우회 여부 |  LOW   | `resolveContainerStylesFallback` 이 이미 `parentStyle[key] !== undefined continue` 로 사용자 편집 우선 보장 |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 검증 기준 (Implementation 단계):

- type-check 3/3 PASS
- specs 166/166 PASS (SliderTrack snapshot 갱신 1건 예상)
- builder 217/217 PASS
- `rg 'position: "relative"' apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts` = 0건
- generated/SliderTrack.css 에 `position: relative` emit 확인

## Consequences

### Positive

- ADR-087 SP6 후속 후보 #2 debt 완결 — SliderTrack 하드코딩 분기 0
- D3 symmetric 대칭 복원 — Preview SliderTrack 에 `position: relative` 주입으로 thumb 위치 정확성 확보
- `ContainerStylesSchema.position?` 는 후속 spec (Popover trigger, Tooltip host 등) 에서 재사용 가능
- ADR-085 / ADR-084 / ADR-079 와 동일한 Schema 확장 관행 유지 — 패턴 학습 비용 0

### Negative

- `ContainerStylesSchema` 필드 수 증가 (gridTemplate 3 + alignItems + justifyContent + flexWrap + display + flexDirection + position = 10 layout primitive). 규모 허용 범위 내이나 향후 필드 증가 시 Schema 구조 재검토 필요 (시기 = 15 필드 초과 시)

## 참조

- [ADR-087](087-implicitstyles-residual-branches-categorized-sweep.md) — 후속 ADR 후보 #2 선언 (SP6 SliderTrack 잔존)
- [ADR-085](085-containerstyles-grid-template-lifting.md) — gridTemplate\* 확장 선례 (동일 5-touch-point 패턴)
- [ADR-084](084-implicitstyles-branch-dissolution.md) — flexWrap 확장 선례
- [ADR-079](079-spec-defaults-read-through-layout-primitive-ssot.md) — alignItems/justifyContent 확장 선례
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain 원칙
