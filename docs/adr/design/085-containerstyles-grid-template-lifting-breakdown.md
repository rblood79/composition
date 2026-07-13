# ADR-085 Breakdown — ContainerStylesSchema grid-template 확장 + ProgressBar/Meter parent 해체

> ADR: [085-containerstyles-grid-template-lifting.md](../completed/085-containerstyles-grid-template-lifting.md)

## Phase 구성

| Phase | 내용                                                                                                        | 소요 | Gate     |
| :---: | ----------------------------------------------------------------------------------------------------------- | :--: | -------- |
|  P0   | Taffy grid 지원 확인 (ADR-100 Phase 10 상태 점검) + Phase 3 land 여부 결정                                  | 0.2h | G0       |
|  P1   | `ContainerStylesSchema` 에 `gridTemplateAreas/Columns/Rows` 3 필드 추가                                     | 0.2h | G1       |
|  P2   | `emitContainerStyles` 에 grid-template emit 추가 (display:grid 직후)                                        | 0.2h | G1/G2/G3 |
|  P3   | Meter/ProgressBar.spec 에서 legacy `composition.containerStyles` parent 키를 정식 `containerStyles` 로 이관 | 0.5h | G2/G3    |
|  P4   | `implicitStyles.ts:1569` ProgressBar/Meter 분기 Label/Output/Track layout-primitive 주입 제거 (G0 PASS 시)  | 0.5h | G4       |
|  P5   | Chrome MCP Meter + ProgressBar 실측 + ADR Status Implemented                                                | 0.4h | G4       |

- P0 FAIL 시 Phase 4 연기, P1~P3 + ADR Status **Partial-Implemented** (Phase 1/2 land, Phase 4 후속)
- 총 예상: 2h (G0 PASS) / 1.5h (G0 FAIL, Phase 4 연기)

## 파일 변경표

| 파일                                                                                      | Phase | 변경                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/types/spec.types.ts`                                                  |  P1   | `ContainerStylesSchema` 에 `gridTemplateAreas?: string`, `gridTemplateColumns?: string`, `gridTemplateRows?: string` 추가                                                                                   |
| `packages/specs/src/renderers/CSSGenerator.ts`                                            |  P2   | `emitContainerStyles` 에 `c.gridTemplateAreas` / `c.gridTemplateColumns` / `c.gridTemplateRows` emit (display 다음)                                                                                         |
| `packages/specs/src/components/Meter.spec.ts`                                             |  P3   | `composition.containerStyles` 에서 `grid-template-areas/columns`/`display`/`box-sizing`/`padding`/`gap` 을 `containerStyles` 로 이관. 자식 selector map(`.react-aria-Label { grid-area }` 등)은 legacy 유지 |
| `packages/specs/src/components/ProgressBar.spec.ts`                                       |  P3   | 동일 패턴                                                                                                                                                                                                   |
| `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`              |  P4   | `:1569` PROGRESSBAR_TAGS 분기에서 Label `width:0/flexGrow:1`, Output `width:"auto"`, Track `width:"100%"` 주입 제거 (G0 PASS 시)                                                                            |
| `packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap` | P2/P3 | Meter + ProgressBar 2 snapshot update (grid-template-\* 추가)                                                                                                                                               |

## 체크리스트

### Phase 0 — Taffy grid 지원 확인 (G0)

- [ ] `apps/builder/src/builder/workspace/canvas/layout/engines/TaffyGridEngine.ts` 존재 확인
- [ ] 실측: Meter sample `display: "grid"` 주입 후 Skia Label/Output/Track 배치 정상
- [ ] G0 PASS → Phase 4 실행 예정 / G0 FAIL → Phase 4 생략, 후속 ADR

### Phase 1 — Schema 확장

- [ ] `ContainerStylesSchema` 3 필드 추가 (type-check PASS)
- [ ] 기존 `defaultVariant` skip 규칙 영향 없음 확인 (주석 참조)

### Phase 2 — CSSGenerator emit

- [ ] `emitContainerStyles` 에 3 라인 emit 추가
- [ ] display:grid 직후 순서 확인
- [ ] `CSSGenerator.containerStyles.test.ts` 11 tests 회귀 0

### Phase 3 — Meter/ProgressBar spec 이관

- [ ] Meter.spec.ts parent 키 이관 + legacy `composition.containerStyles` 자식 selector 만 잔존
- [ ] ProgressBar.spec.ts 동일
- [ ] Generated Meter.css / ProgressBar.css diff: grid-template-\* 보존, 자식 selector 보존
- [ ] snapshot 2 update (G2)

### Phase 4 — implicitStyles 분기 해체 (G0 PASS 시)

- [ ] PROGRESSBAR_TAGS 분기 Label/Output/Track layout-primitive 직접 할당 제거
- [ ] size-indexed font / margin 유지 (size-based 로직은 ADR-086 scope)
- [ ] calendar-symmetry / resolveContainerStylesFallback / tokenConsumerDrift 테스트 회귀 0

### Phase 5 — 검증 + Status Implemented

- [ ] Chrome MCP Meter 샘플 Preview grid ↔ Skia 시각 대칭 (G4)
- [ ] Chrome MCP ProgressBar 샘플 동일
- [ ] ADR Status Proposed → Implemented
- [ ] README.md entry 갱신

## 커밋 계획

| 순서 | 커밋                                                               | Phase |
| :--: | ------------------------------------------------------------------ | :---: |
|  1   | `feat(adr-085): P1+P2 Schema + CSSGenerator grid-template emit`    | P1/P2 |
|  2   | `feat(adr-085): P3 Meter/ProgressBar containerStyles 이관`         |  P3   |
|  3   | `feat(adr-085): P4 implicitStyles PROGRESSBAR 분기 해체` (G0 PASS) |  P4   |
|  4   | `docs(adr-085): Status Proposed → Implemented`                     |  P5   |

## 롤백 전략

- Phase 2/3 실패 → 해당 커밋 revert (legacy composition.containerStyles 복귀)
- Phase 4 실패 (시각 회귀) → Phase 4 커밋만 revert, Phase 1/2/3 유지 (cascade 유지)

## 후속 ADR 후보

- **자식 selector map Schema 리프팅** (대안 C) — Meter/ProgressBar 자식 selector + SearchField/ColorField/NumberField grid-template-columns 일괄
- **Skia grid 직접 해석** (ADR-100 Phase 10) — Label emul 제거 전제 조건
