# ADR-088: SizeSpec.columnGap? 신규 필드 + SLIDER_COL_GAP Record 해체

## Status

Implemented — 2026-04-20

## Implementation

- **Step 1**: `SizeSpec.columnGap?` optional 필드 신설 (`spec.types.ts`) + `SliderSpec.sizes.{sm,md,lg,xl}.columnGap = 16/16/20/20` 선언
- **Step 2**: `CSSGenerator.generateSizeStyles` 에 `size.columnGap` emit 확장 — `gap` shorthand 뒤에 `column-gap: Xpx` 출력. 재빌드 `generated/Slider.css` 5 블록 (base + 4 data-size) 에 `column-gap` emit 확인
- **Step 3**: `implicitStyles.ts:1611` 소비처 → `specSizeField("slider", sizeName, "columnGap") ?? 16` 전환. `SLIDER_COL_GAP` Record (`:243-249`) + 주석 제거
- **검증**: `rg "Record<string, number>" implicitStyles.ts` = **0건** (ADR-086 G4 완결). type-check 3/3 + specs 166/166 (Slider snapshot 1 updated) + builder 217/217 PASS. Preview/Canvas 16/16/20/20 대칭 복원

## Context

본 ADR 은 [ADR-086 Addendum 1](086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md#addendum-1--slider_col_gap-잔존-후속-adr-후보) 이 예고한 후속 해체 작업이다. ADR-086 Phase 2 가 10 Record 중 9 개를 폐쇄했으나 `SLIDER_COL_GAP` 1 개만 **semantic 충돌** 로 잔존했다.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. `implicitStyles.ts` (Canvas Skia consumer) 가 spec.sizes SSOT 를 **우회** 하여 파일-스코프 `Record<string, number>` 로 column-gap 값을 하드코딩. 본 ADR 은 Slider 의 column-gap 을 Spec SSOT 로 복귀시킨다.

### 잔존 debt

**`SLIDER_COL_GAP` Record 1 건** (`implicitStyles.ts:244-249`):

```ts
const SLIDER_COL_GAP: Record<string, number> = {
  sm: 16,
  md: 16,
  lg: 20,
  xl: 20,
};
```

- 소비처 1건: `implicitStyles.ts:1611` Slider 분기 (`sliderColGap = SLIDER_COL_GAP[sizeName] ?? SLIDER_COL_GAP.md`)
- `SliderSpec.sizes.sm/md/lg/xl.gap` 이 이미 존재하지만 **row-gap** 용도 (`Slider.spec.render` 내부 `offsetY = fontSize + gap` 소비)
- column-gap 과 row-gap 은 semantic 이 다름 → `sizes.gap` overwrite 불가

### 추가 발견 — D3 symmetric 대칭 debt

본 ADR 착수 전 선행 감사에서 Preview/Builder 비대칭 확인:

- Canvas (Skia, `implicitStyles.ts:1611`): sm/md/lg/xl = 16/16/20/20
- Preview (DOM, `generated/Slider.css`): `gap: 4px` shorthand (column-gap 미분리) — **4/4/4/4**
- `CSSGenerator.generateSizeStyles` (`CSSGenerator.ts:735` +) 가 `size.gap` 만 shorthand emit → `size.columnGap` 별도 필드 미지원

즉 `SLIDER_COL_GAP` Record 는 Canvas 단독 값이었고 Preview 는 다른 값 적용 중 = D3 symmetric 원칙 이미 위반 상태. 본 ADR 은 Record 해체와 동시에 **CSSGenerator emit 확장** 을 포함하여 양 consumer 가 동일 값(16/16/20/20) 을 받도록 대칭 복원한다.

### Hard Constraints

1. `SliderSpec.sizes.sm/md/lg/xl.gap` 의 row-gap 값(4/4/4/4) 유지 — `Slider.spec.render` 의 `offsetY = fontSize + gap` 계산 영향 없음
2. `implicitStyles.ts:1611` 에서 공급되는 column-gap 값 pixel-perfect 동일 (16/16/20/20)
3. **Preview DOM 의 Slider column-gap 값이 Canvas 와 동일 (16/16/20/20)** — D3 symmetric 복원. CSSGenerator 가 `size.columnGap` 필드를 shorthand `gap` 이후에 emit 하여 cascade override
4. 기존 62 spec 의 `SizeSpec` 타입 BC 유지 — optional 필드이므로 기존 spec 영향 0
5. `rg "Record<string, number>" implicitStyles.ts` 결과 0건 달성 (ADR-086 G4 잔존 항목 완전 폐쇄)
6. CSSGenerator.generateSizeStyles emit 확장이 다른 62 spec 영향 없음 — `size.columnGap == null` 인 spec 은 emit skip

### Soft Constraints

- `SizeSpec.columnGap?` 는 후속 컴포넌트 (Slider 외 column-gap 분리 필요 spec) 에서도 재사용 가능
- CSSGenerator emit 필요 여부는 Slider skipCSSGeneration=false 이지만 기존 Slider.css (manual) 가 column-gap 을 커버하는지 사전 감사

## Alternatives Considered

### 대안 A: `SizeSpec.columnGap?` optional 필드 신설 (선정)

- 설명: `packages/specs/src/types/spec.types.ts` `SizeSpec` 에 `columnGap?: number` optional 필드 추가. `SliderSpec.sizes.sm/md/lg/xl.columnGap = 16/16/20/20` 선언. `implicitStyles.ts:1611` 를 `specSizeField("slider", sizeName, "columnGap") ?? 16` lookup 으로 전환 + SLIDER_COL_GAP Record 및 주석 제거
- 근거: ADR-086 P2 가 채택한 `specSizeField` 헬퍼 패턴 그대로 확장. optional 필드이므로 BC 0
- 위험:
  - 기술: LOW — 단일 필드 추가, 단일 소비처 전환
  - 성능: LOW — specSizeField lookup O(1)
  - 유지보수: LOW — SSOT 복귀
  - 마이그레이션: LOW — BC 0

### 대안 B: `SliderSpec` 전용 dimension 필드 추가 (Slider.sizes.md.sliderColGap 등)

- 설명: SizeSpec 공유 스키마 확장 대신 Slider 전용 sub-field 추가
- 근거: 다른 spec 이 column-gap 을 요구하지 않으므로 공유 스키마 오염 회피
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — Slider 전용 nested 필드는 spec 관례 분열. 후속 column-gap 필요 spec 발생 시 sub-field 폭증 (ADR-078 대안 B 기각 사유와 동일)
  - 마이그레이션: LOW

### 대안 C: Record 영구 유지 (현재 상태 수용)

- 설명: `SLIDER_COL_GAP` Record 를 공식 패턴으로 승인. `SizeSpec.columnGap?` 도입 없이 파일-스코프 상수로 관리
- 근거: 제로 투자
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — D3 symmetric consumer 원칙 영구 위반 (파일 Record 가 Spec SSOT 우회). ADR-086 G4 "`Record<string, number>` 0건" 달성 불가
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  L   |  L   |    L     |      L       |     0      |
|  B   |  L   |  L   |  **H**   |      L       |     1      |
|  C   |  L   |  L   |  **H**   |      L       |     1      |

**루프 판정**:

- 대안 A: HIGH 0 — 바로 채택
- 대안 B: HIGH 1 (유지보수 — spec 관례 분열)
- 대안 C: HIGH 1 (유지보수 — SSOT 위반 영구화)
- **대안 A 채택** — 추가 루프 불필요

## Decision

**대안 A: `SizeSpec.columnGap?` optional 필드 신설** 을 선택한다.

선택 근거:

1. **ADR-086 P2 패턴 재사용** — `specSizeField` 헬퍼 그대로 확장. 신규 인프라 없이 기존 경로 소비
2. **BC 0** — optional 필드 추가는 기존 62 spec render/layout/CSS emit 영향 없음
3. **Semantic 명확화** — `SizeSpec.gap` (공통) / `columnGap` (column 축 분리) 2 축 명시. 향후 row-only/column-only 분리 필요 spec 에 재사용 가능
4. **ADR-086 G4 완결** — `rg "Record<string, number>" implicitStyles.ts` = 0건 달성

기각 사유:

- **대안 B 기각**: Slider 전용 sub-field 는 spec 관례 분열. ADR-078 에서 동일 사유로 기각된 "nested item schema" 패턴 반복
- **대안 C 기각**: Record 영구화는 D3 symmetric consumer 원칙 공식 포기. ADR-086 Addendum 1 자체 제안 반박

> 구현 상세: 본 ADR 은 1 Phase 3-4 파일 변경 규모이므로 별도 breakdown 문서 불필요 (adr-writing.md 스캐폴딩 규칙 예외).

## Risks

| ID  | 위험                                                                               | 심각도 | 대응                                                                                                    |
| --- | ---------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------- |
| R1  | Slider.css (manual) 가 이미 column-gap 을 emit 하는 경우 generated CSS 와 중복     |  LOW   | Phase 1 선행 감사 — Slider.css 에서 column-gap 선언 확인 후 상호 배제 판정                              |
| R2  | CSSGenerator 가 columnGap 필드를 emit 하지 않으면 Preview DOM 에 column-gap 미적용 |  LOW   | Phase 1 에서 CSSGenerator.generateSizeStyles 감사. emit 미지원 시 Slider.css manual 잔존 또는 구현 확장 |
| R3  | SLIDER_COL_GAP Record 삭제 후 다른 파일에서 참조하는 숨은 의존                     |  LOW   | Phase 2 에서 `rg "SLIDER_COL_GAP"` 전역 확인                                                            |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점      | 통과 조건                                                                                                                                                                                                     | 실패 시 대안                                          |
| :--: | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
|  G1  | Step 1 후 | `pnpm -w type-check` 3/3 PASS. `SizeSpec.columnGap?` 타입 추가 + `SliderSpec.sizes.{sm,md,lg,xl}.columnGap = 16/16/20/20` 선언 완료                                                                           | 직전 커밋 revert                                      |
|  G2  | Step 2 후 | `CSSGenerator.generateSizeStyles` 에 `size.columnGap` emit 로직 추가. `generated/Slider.css` 각 data-size 블록에 `column-gap: Xpx` emit 확인. 다른 62 spec snapshot 영향 0 (columnGap 미선언)                 | CSSGenerator emit 조건 축소 (skipGap 유사 guard 추가) |
|  G3  | Step 3 후 | `implicitStyles.ts:1611` 소비처 → `specSizeField("slider", sizeName, "columnGap") ?? 16`. SLIDER_COL_GAP Record + 주석 제거. `rg "SLIDER_COL_GAP"` 전역 결과 0건                                              | Record 주석처리 + debt 명시                           |
|  G4  | 최종      | `rg "Record<string, number>" implicitStyles.ts` = 0건. `pnpm --filter @composition/specs test --run` + `builder test --run` PASS (Slider snapshot 1건 갱신 허용). Preview/Canvas 대칭 복원 (양쪽 16/16/20/20) | Step 1-2 까지 land + debt 명시                        |

**잔존 HIGH 위험 없음**.

## Consequences

### Positive

- `implicitStyles.ts` 파일-스코프 `Record<string, number>` 전수 폐쇄 → ADR-086 G4 완결
- `SizeSpec.columnGap?` 로 row-gap/column-gap 2 축 분리 명시
- ADR-086 Addendum 1 해소 → ADR 체인 정리
- Slider column-gap 값 변경 시 Spec 단일 수정으로 양 consumer (Skia + CSS) 동기화

### Negative

- `SizeSpec` 타입에 optional 필드 1 개 추가 (타입 정의 복잡도 미미 증가)

## 반복 패턴 선차단 체크리스트 (adr-writing.md experimental seed)

- [x] #1: 코드 경로 3곳 이상 구체 인용 — `implicitStyles.ts:205-209` (SLIDER_COL_GAP 주석) / `implicitStyles.ts:237-249` (Record 정의) / `implicitStyles.ts:1611` (소비처) / `spec.types.ts:747-798 SizeSpec` / `Slider.spec.ts:108-148 sizes`
- [x] #2: Spec/Generator 확장 ADR — CSSGenerator.generateSizeStyles 가 columnGap emit 하는지 Phase 1 에서 사전 감사 명시 (R2)
- [x] #3: BC 수식화 — 영향 spec: **1** (Slider). 기존 62 spec BC 0 (optional 필드). 사용자 프로젝트 재직렬화 0
- [x] #4: Phase 분리 질문 — 1 Phase 규모이므로 분할 불필요. G2/G3 FAIL 시 Record 주석처리 fallback 명시

## References

- [ADR-086](086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md) Addendum 1 — 본 ADR 의 발의 근거
- [ADR-063](063-ssot-chain-charter.md) SSOT Chain Charter — D3 symmetric consumer 정본
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 대칭 원칙
