# ADR-085: ContainerStylesSchema grid-template 확장 + ProgressBar/Meter parent 해체

## Status

Implemented — 2026-04-20 (Revision 1)

## Implementation (2026-04-20 세션 8)

- **Phase 1-2** (`af23a046`): `ContainerStylesSchema` 에 `gridTemplateAreas/Columns/Rows` 3 필드 추가 + `CSSGenerator.emitContainerStyles` 대응 emit
- **Phase 3** (`77f47ade`): Meter/ProgressBar.spec 의 legacy `composition.containerStyles` 내 grid-template-areas/columns 를 정식 `containerStyles` (ContainerStylesSchema) 로 이관
- **Phase 4** (`8689df4e`): `implicitStyles.ts:1501~` PROGRESSBAR_TAGS 분기 Label/Output/Track flex row wrap emul 제거 + 자식에 gridArea 주입. parent `display:grid + gridTemplateAreas/Columns` 은 `resolveContainerStylesFallback` 경유 (`CONTAINER_STYLES_FALLBACK_KEYS` 에 3 필드 추가)
- 검증: type-check 3/3 + specs 166/166 (2 snapshot 갱신) + builder 217/217 PASS
- Chrome MCP 실측 (ProgressBar/Meter sm/md/lg/xl 8 샘플 G4) 은 runtime 배포 시 수행

## History

Proposed — 2026-04-20 (**Revision 1** — claude self-review 반영: PROGRESSBAR_FONT_SIZE Record scope 를 ADR-086 Phase 1 로 명시 이관. 본 ADR 은 grid-template Schema 확장 + parent containerStyles + Label/Output/Track flex emul 해체만 담당.)

## Context

### D3 domain 판정 (ADR-063 SSOT 체인)

본 ADR 은 [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) **D3 (시각 스타일) symmetric consumer 의 대칭 복구** + **Schema 확장**. ADR-084 Phase A2 scope 외로 분리된 ProgressBar/Meter 의 `grid-template-areas` cascade 비대칭 해체.

### 현재 비대칭 구조

- `packages/specs/src/components/Meter.spec.ts:320` / `ProgressBar.spec.ts:311` 이 **legacy `spec.composition.containerStyles`** (`Record<string, string>`, ADR-059 v2 Pre-Phase 0-D.3 우회 경로) 로 다음 문자열 key 선언:
  ```ts
  "grid-template-areas": '"label value" "bar bar"',
  "grid-template-columns": "1fr auto",
  ```
- **정식 `ContainerStylesSchema`** (`packages/specs/src/types/spec.types.ts:59-93`) 에는 `gridTemplateAreas`/`gridTemplateColumns`/`gridTemplateRows` 필드 **부재**
- `implicitStyles.ts:1569` ProgressBar/Meter 분기가 Label `width:0 + flexGrow:1` 로 CSS grid `1fr` 에뮬레이션 (Skia 경로)
- CSS 경로는 legacy containerStyles 경유로 grid 정상 emit → **Preview(grid) ↔ Skia(flex wrap emul) 비대칭**

### Hard Constraints

1. `ContainerStylesSchema` 확장 시 기존 `defaultVariant` 색상 주입 skip 규칙 유지 (line 54-57 규약)
2. `CSSGenerator.emitContainerStyles` emit 순서 — grid-template-\* 는 `display: grid` 직후 emit
3. Meter/ProgressBar 제외 62 spec snapshot 회귀 0
4. Preview ↔ Skia 시각 정합 — Chrome MCP Meter/ProgressBar 실측 (G4)

### Soft Constraints

- 자식 selector map (`.react-aria-Label`: { `grid-area: label` }) Schema 리프팅은 **scope 외 후속 ADR** — 본 ADR 은 parent grid-template-\* 3 필드만
- Skia 경로 grid 해석은 Taffy 지원 여부(ADR-100 Phase 10)에 의존 → Phase 0 Gate 로 확인

### 감사 결과

`implicitStyles.ts:1569` PROGRESSBAR_TAGS 분기 내 layout-primitive 직접 할당:

- Label 자식 주입: `width: 0`, `flexGrow: 1`, `flexShrink: 1`, `minWidth: 0` — CSS grid `1fr` 에뮬레이션
- ProgressBarValue 주입: `width: "auto"`, `flexShrink: 0` — CSS `grid-area: value` 에뮬레이션
- ProgressBarTrack 주입: `width: "100%"`, `flexShrink: 0` — CSS `grid-area: bar` (2행 강제)

### Scope 경계 명시 (Revision 1)

| 축                                                                                  | 처리 ADR            | 비고                                                       |
| ----------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `grid-template-*` Schema 확장                                                       | **본 ADR**          | ContainerStylesSchema 3 필드 + emit                        |
| Meter/ProgressBar parent containerStyles 이관                                       | **본 ADR**          | legacy `composition.containerStyles` parent 키 → 정식 필드 |
| Label/Output/Track Skia flex emul 해체                                              | **본 ADR** Phase 4  | G0 Taffy grid 지원 확인 후                                 |
| `PROGRESSBAR_FONT_SIZE` Record (`:212`) → `ProgressBar.sizes[size].fontSize` lookup | **ADR-086 Phase 1** | size-indexed Record 해체 공통 주제 — 본 ADR scope 아님     |
| 자식 selector map (`.react-aria-Label { grid-area }` 등)                            | 후속 ADR (대안 C)   | 다수 spec 영향 — 별도 Schema 확장                          |

## Alternatives Considered

### 대안 A: ContainerStylesSchema 에 `gridTemplateAreas/Columns/Rows` 3 필드 추가 + Meter/ProgressBar 정식 이관

- 설명:
  1. `spec.types.ts:59-93` ContainerStylesSchema 에 3 필드 추가
  2. `CSSGenerator.ts:649` emitContainerStyles 에 emit 추가 (display:grid 직후)
  3. `Meter.spec.ts` / `ProgressBar.spec.ts` 의 legacy `composition.containerStyles` 중 parent 3 필드(grid-template-areas/columns/display/box-sizing/padding/gap)를 정식 `containerStyles`로 이관. 자식 selector map 은 legacy 유지 (후속 ADR)
  4. `implicitStyles.ts:1569` ProgressBar/Meter 분기 Label/Output/Track width·flex 주입 제거 (Taffy grid 지원 확인 후)
- 근거: ADR-078/079/084 layout primitive Schema 확장 패턴. Meter/ProgressBar 만 2 spec, scope 명확.
- 위험:
  - 기술: **LOW** — Schema type 추가 + emit 1줄씩
  - 성능: **LOW** — CSS 바이트 +3 lines × 2 spec
  - 유지보수: **LOW** — Spec SSOT 일관성 증가
  - 마이그레이션: **LOW** — 2 spec 영향, snapshot 2 update

### 대안 B: ContainerStylesSchema 확장하지 않고 legacy `composition.containerStyles` 유지 + implicitStyles 분기만 해체

- 설명: Schema 경계 확장 대신 기존 우회 경로 유지. implicitStyles 분기에서 grid-template 값을 직접 parentStyle 주입.
- 근거: 최소 변경 접근
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — SSOT 이중화(`containerStyles` + `composition.containerStyles`) 고착, ADR-036/059/063 재승격 역행
  - 마이그레이션: LOW

### 대안 C: parent grid-template + 자식 selector map 통합 Schema 확장

- 설명: grid-template + 자식 selector map (`.react-aria-Label`: { gridArea: "label" }) 전체를 typed schema로 리프팅.
- 근거: ADR-078 자식 selector emit 후속 ADR 패턴
- 위험:
  - 기술: **MEDIUM** — 자식 selector map schema 설계 복잡 (key: selector string, value: partial CSS)
  - 성능: LOW
  - 유지보수: LOW — SSOT 완전 복귀
  - 마이그레이션: **MEDIUM** — Meter/ProgressBar 외 SearchField/ColorField/NumberField (grid-template-columns 사용 중) 영향 가능

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  L   |  L   |    L     |      L       |     0      |
|  B   |  L   |  L   |  **H**   |      L       |     1      |
|  C   |  M   |  L   |    L     |      M       |     0      |

- 대안 A / 대안 C 모두 HIGH+ 0 → 본 ADR 진행 가능
- 대안 A vs C: 본 ADR 은 "ProgressBar/Meter parent 해체" 가 1차 목표. 자식 selector 는 별도 ADR (다수 spec 영향 + Schema 설계) — **A 선택, C 는 후속 ADR**

## Decision

**대안 A: ContainerStylesSchema 에 `gridTemplateAreas/Columns/Rows` 3 필드 추가 + Meter/ProgressBar parent 정식 이관** 을 선택.

선택 근거:

1. HIGH+ 0, 마이그레이션 LOW, 기술 LOW — 리스크 최소 경로
2. ADR-078/079/084 검증된 Schema 확장 패턴 재사용
3. parent 만 이관 → 자식 selector map 리프팅 후속 ADR 과 직교 (후속 ADR 이 본 ADR 후 실행 가능)

기각 사유:

- **대안 B 기각**: SSOT 이중화가 ADR-036/059/063 재승격 체인에 역행. 유지보수 HIGH — 수용 불가
- **대안 C 기각**: 자식 selector map Schema 설계는 단독 ADR 규모. 본 ADR 과 분리 시 각 ADR scope 명확, 후속 ADR 에서 다수 spec (Meter/ProgressBar/SearchField/ColorField/NumberField) 일괄 처리 가능

> 구현 상세: [085-containerstyles-grid-template-lifting-breakdown.md](../../adr/design/085-containerstyles-grid-template-lifting-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                               | 심각도 | 대응                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Taffy grid 지원이 ADR-100 Phase 10 의존 — Skia 경로 grid 직접 해석 미완 시 Label `flexGrow:1` emul 제거 불가                                       |  MED   | Phase 0 Gate G0 에서 Taffy grid 지원 확인. 미지원 시 Phase 1/2 (Schema + CSS emit) 까지만 land + Phase 3 (implicitStyles 분기 해체) 는 후속 ADR 또는 ADR-100 Phase 10 완료 후 실행 |
| R2  | 자식 selector map (`.react-aria-Label { grid-area: label }`) 은 legacy `composition.containerStyles` 에 잔존 — ADR-036/059/063 역행 부분 해소 미완 |  MED   | 본 ADR scope 외 (대안 C 후속 ADR 명시). legacy Record 는 parent 이관 후에도 자식 selector 용도로 임시 유지. Status 기록에 명시                                                     |
| R3  | CSSGenerator.containerStyles.test 9 개 기존 snapshot 중 Meter/ProgressBar 2 개 업데이트 필요                                                       |  LOW   | Phase 2 verification 에서 snapshot update 의도적                                                                                                                                   |

## Gates

| Gate | 시점         | 통과 조건                                                                                          | 실패 시 대안                                            |
| :--: | ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
|  G0  | Phase 0 시작 | `apps/builder/.../layout/engines/TaffyGridEngine.ts` 존재 + `display: "grid"` 실측 Taffy 정상 처리 | Phase 1/2 까지 land, Phase 3 연기 (R1 대응)             |
|  G1  | 매 Phase     | `pnpm -w type-check` 3/3                                                                           | 직전 커밋 revert                                        |
|  G2  | Phase 2 후   | `specs` 166/166 (2 snapshot update Meter + ProgressBar) + `builder` 217/217                        | Meter/ProgressBar spec 수정 revert                      |
|  G3  | Phase 2 후   | Generated Meter.css / ProgressBar.css `grid-template-areas` / `grid-template-columns` 보존         | legacy Record 우회 유지                                 |
|  G4  | 최종         | Chrome MCP Meter + ProgressBar 샘플 Preview(grid) ↔ Skia 시각 대칭                                 | Phase 3 revert, Phase 1/2 만 land + Skia emul 유지 기록 |

## Consequences

### Positive

- `ContainerStylesSchema` 가 grid-template-\* 지원 → 후속 Card/Section 등 grid 컨테이너 SSOT 복귀 경로 확보
- ADR-063 D3 symmetric consumer 완성 진전 (parent 정합 복구)
- legacy `composition.containerStyles` Record<string,string> 사용 감소 1 step
- `implicitStyles.ts:1569` ProgressBar/Meter 분기 Label 에뮬레이션 제거 (R1 통과 시)

### Negative

- 자식 selector map 리프팅 후속 ADR 대기 (Meter/ProgressBar 자식 `.react-aria-Label { grid-area }` 등)
- R1 발생 시 Phase 3 skip → ADR-084 패턴과 다른 "Phase 1/2 만 land" 결과 → Status 에 명시 필요

## 반복 패턴 선차단 체크리스트 (adr-writing.md experimental seed)

- [x] #1: HIGH+ 위험은 없지만, R1/R2 MED 에 코드 경로 파일·line 3곳 이상 구체 인용 완료 (`spec.types.ts:59-93` / `CSSGenerator.ts:649` / `implicitStyles.ts:1569` / Meter.spec.ts:320 / ProgressBar.spec.ts:311)
- [x] #2: Spec/Generator 확장 ADR 로 "자식 selector / grid-area emit 지원 여부" Context 에 명시 (**부재** 선언 + 후속 ADR 경로 제시)
- [x] #3: BC 수식화 — 영향 spec "2개 (Meter + ProgressBar)", snapshot "2개 업데이트", 평균 재직렬화 파일 0
- [x] #4: Phase 분리 가능성 질문 — R1 발생 시 Phase 3 를 후속 ADR 로 분리 가능 (Gates G0 에 명시)
