# ADR-127: Layer 3 Canonical Vocabulary 정렬 — `type: "Group"` → `type: "frame"` 분리

## Status

Proposed — 2026-05-09

## Context

composition 의 element.type 어휘는 ADR-116 (`CompositionDocument` canonical SSOT) + ADR-122 (canonical-only runtime) 정착 과정에서 **데이터 경로 분기** 가 영구화됐다. 같은 layout container (display:flex) 의도가 진입 경로에 따라 두 element.type 으로 분리되어 사용자 본인도 어휘 origin 을 헷갈리는 상태에 도달.

| 진입 경로                   | 저장 type       | 위치                                                                                                   |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| pencil import               | `type: "frame"` | `apps/builder/src/adapters/pencil/pencilSchemaMap.ts:23-37`                                            |
| builder UI palette/grouping | `type: "Group"` | `apps/builder/src/builder/factories/definitions/GroupComponents.ts:14-30`, `elementGrouping.ts:99,116` |

**3-Domain 분할 framing 적용** ([ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md)):

- **D1 (DOM/접근성, RAC 절대 권위)**: RAC `Group` = `role="group"` ARIA semantic primitive (`packages/specs/src/components/Group.spec.ts:122`). RadioGroup/CheckboxGroup/ToggleButtonGroup 등 specialized component 가 자체 type literal 사용
- **D2 (Props/API, RSP 참조)**: 본 ADR 범위 외 (props 변경 0)
- **D3 (시각 스타일, Spec SSOT)**: canonical `frame` = layout container dedicated. `composition-document.types.ts:287-312` `FrameNode` 가 `clip` (overflow) + `placeholder` 1차 필드로 layout 전용. `composition-mapping.md:86` "Frame as layout group, analogous to div + flex"

**RAC 라이브러리 전수 조사**: layout grouping 전용 component 부재 (Group / Toolbar / Section 모두 ARIA semantic). 따라서 layout container 는 **100% composition Layer 3 영역** — RAC `Group` 으로 흡수 시 ARIA semantic 부수효과 누적.

**Hard Constraints**:

1. canonical schema 변경 = 0 (`FrameNode` / `GroupNode` interface 보존, `composition-vocabulary.ts:22-145` mix 정책 보존)
2. pencil round-trip fixture-equality 5/5 PASS 유지 (`pencilRoundtrip.test.ts:28-39`)
3. RAC ARIA Group semantic 보존 (Group.spec.ts 변경 0)
4. type-check 3/3 + `pnpm run codex:preflight` PASS (ADR-116/122 closure 표준 gate)

**Soft Constraints**:

- 사용자 인지 부담 (어휘 혼란 해소)
- builder palette 노출은 Frame 만 (RAC ARIA Group palette entry 부활은 후속 슬라이스)
- 13 row 매핑 표 ([breakdown §2](design/127-layer3-canonical-vocabulary-alignment-breakdown.md#§2-13-row-vocabulary-매핑-표-layer-3-ssot)) 가 단일 SSOT — 4 ADR (903/111/116/122) 교집합에 흩어진 결정을 단일 source 로 명문화

## Alternatives Considered

### 대안 A: `type: "frame"` 정렬 + 신규 `Frame.spec.ts`

- 설명: builder factory 진입점을 `type: "frame"` 으로 정렬 + 신규 `Frame.spec.ts` (skipCSSGeneration:true, ARIA role 없음, layout container dedicated). RAC `Group` 은 ARIA semantic 보존. legacy `type: "Group" + customId="group_N"` element 1회 hydration migration. 13 row 매핑 표 SSOT 명문화.
- 근거 (외부/내부 리서치):
  - pencil round-trip 매핑 이미 `frame` 정렬 (`pencilSchemaMap.ts:23-37`)
  - composition-mapping.md:86 명시 "Frame as layout group"
  - Adobe RAC `Group` API: ARIA semantic only, layout 의도 부재
  - Figma/Penpot 등 디자인 도구 어휘 동향: `frame` = layout primitive, `group` = ARIA/semantic grouping
  - ADR-908 Phase 4 lesson: alias 후 spec 분리 시 snapshot/CSS 82 spec regeneration 비용 발생 → 1회 분리가 long-term 효율
- 위험:
  - 기술: **LOW** — Frame.spec.ts 신규 생성은 기존 spec 패턴 답습. CSS Generator pipeline skipCSSGeneration 처리 검증됨 (ADR-105/106 사례)
  - 성능: **LOW** — Spec 추가 1개 (런타임 성능 영향 0)
  - 유지보수: **MED** — Frame.spec.ts 신규 surface 1개 + factory rename + grouping 액션 transitional period filter (legacy + new 양쪽 count) 관리. customId prefix 분기로 ARIA Group migration false positive 차단
  - 마이그레이션: **MED** — legacy `type: "Group" + customId="group_N"` element 1회 hydration migration. ARIA Group (customId 없음/다른 prefix) 보존. dev/staging 통합 테스트 1회 필요

### 대안 B: 현상 유지

- 설명: 진입 경로별 type 분기 (`Group` vs `frame`) 영구 유지. metadata.compositionType / metadata.pencilType 으로 round-trip 보장.
- 근거: 변경 비용 0. 기존 fixture/test 자동 통과.
- 위험:
  - 기술: **LOW** — 변경 0
  - 성능: **LOW**
  - 유지보수: **HIGH** — 데이터 경로 분기 영구화. 사용자 인지 부담 누적 (어휘 혼란 — 사용자 본인이 헷갈림 표명, 2026-05-09 brainstorm 세션). 신규 진입점 추가 시마다 두 type 분기 매번 결정. ADR-116/122 closure 후 잔존 debt 영구화
  - 마이그레이션: **LOW** — 변경 0이나 metadata 의존 (위험): metadata 누락 또는 corruption 시 round-trip 손실 가능

### 대안 C: `type: "frame"` 정렬 + Group.spec alias

- 설명: 대안 A 와 동일하되 `BASE_TAG_SPEC_MAP["frame"] = GroupSpec` alias. Frame.spec.ts 신규 생성 안 함.
- 근거: 변경 비용 ~5줄. 기존 Group spec 의 CSS generation pipeline 자동 활용.
- 위험:
  - 기술: **LOW** — alias 한 줄
  - 성능: **LOW**
  - 유지보수: **HIGH** — ARIA `role:"group"` 이 frame element 에도 emit (D1 침범) → a11y 정확도 ↓ 누적. FrameNode interface (`clip`/`placeholder` 1차 필드) 와 GroupSpec 비대응 → 의도 mismatch. 후행 분리 시 snapshot/CSS 재생성 (ADR-908 Phase 4 의 82 spec migration 패턴 재발)
  - 마이그레이션: **MED** — 대안 A 동일 (legacy Group → frame migration 동일 필요)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | LOW  | LOW  | MED      | MED          |     0      |
| B    | LOW  | LOW  | **HIGH** | LOW          |     1      |
| C    | LOW  | LOW  | **HIGH** | MED          |     1      |

**판정**: 대안 A 가 유일하게 HIGH+ 0 개. 대안 B/C 는 유지보수 HIGH (B 는 분기 영구화, C 는 ARIA 침범 + 후행 분리 비용). Threshold check 루프 종료.

## Decision

**대안 A: `type: "frame"` 정렬 + 신규 `Frame.spec.ts`** 를 선택한다.

선택 근거:

1. **D3 SSOT 의도 정합**: RAC `Group` (D1/ARIA) ↔ canonical `frame` (D3/layout) 분리가 ssot-hierarchy.md 3-domain framing 과 일치. alias (대안 C) 는 D1 침범 (ARIA role 이 layout element 에 emit).
2. **FrameNode interface 1:1 정합**: `composition-document.types.ts:287-312` 의 `clip`/`placeholder` 1차 필드 (layout 전용) 가 신규 Frame.spec 과 1:1 정합. GroupSpec 으로 alias 시 mismatch.
3. **회귀 격리**: Frame.spec 변경이 Group 에 무영향. Group.spec 변경이 frame 에 무영향.
4. **장기 효율**: ADR-908 Phase 4 lesson — alias 후 spec 분리 시 snapshot/CSS 82 spec regeneration 비용 발생. 1회 분리가 long-term 효율.
5. **ADR-903 surface 충돌 없음**: frame 은 이미 vocabulary lowercase pencil structural (`composition-vocabulary.ts:142-145`) 멤버. Spec 추가 시 PascalCase 118 surface 변동 0.
6. **사용자 lock-in framing 정합**: "Layer 3 = pencil-style canonical" framing 과 builder factory 진입점 정렬 일치.

기각 사유:

- **대안 B 기각**: 유지보수 HIGH (데이터 경로 분기 영구화 → 사용자 인지 부담 누적, ADR-116/122 closure 후 잔존 debt). metadata 의존 round-trip 의 fragile 성.
- **대안 C 기각**: 유지보수 HIGH (D1 ARIA 침범 + 후행 분리 비용). alias 비용 절감 (~5줄 vs ~50줄) 보다 a11y 정확도 누적 손실 + 향후 spec 분리 시 ADR-908 Phase 4 패턴 재발 비용 압도적.

> 구현 상세: [127-layer3-canonical-vocabulary-alignment-breakdown.md](design/127-layer3-canonical-vocabulary-alignment-breakdown.md)

## Risks

| ID  | 위험                                                                                 | 심각도 | 대응                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | TAG_SPEC_MAP 미등록 시 spec lookup 실패 (renderer NaN)                               |  HIGH  | Phase 1 Gate G1 (CRITICAL) — `pnpm build:specs` 통과 + 신규 unit test PASS 의무                                                                   |
| R2  | Transitional period legacy Group + new frame 공존 ID collision (`group_N` 중복 발급) |  MED   | Phase 3 filter 양쪽 count (`(el.type === "frame" \|\| el.type === "Group") && customId.startsWith("group_")`) — migration 완료 후 Group 분기 제거 |
| R3  | 사용자 추가 ARIA Group element 의 migration false positive                           |  MED   | customId prefix `group_` 분기로 차단 — ARIA Group (customId 없음/다른 prefix) 보존                                                                |
| R4  | history undo/redo 12 case 분기 누락 가능 (Explore 보고)                              |  MED   | Phase 5 grep 전수 + `historyActions.diff.test.ts:277-278` frame fixture 추가                                                                      |
| R5  | Canvas-Skia vector visual 미구현 (rectangle fill 등 → 빈 frame 렌더)                 |  MED   | 본 ADR 범위 외 — 후속 ADR (가칭 "Vector primitive Skia rendering") 분리. round-trip 손실 0 클레임은 **파일 format 한정**                          |
| R6  | lowercase `"group"` literal 즉시 제거 시 round-trip 깨짐                             |  MED   | 본 ADR 범위 외 — Phase 2/3 후속 ADR. 본 ADR 은 vocabulary 보존 + factory 진입점 정렬만                                                            |

## Gates

| Gate | 시점                    | 통과 조건                                                                                                         | 실패 시 대안                                            |
| ---- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G1   | Phase 1 종료 (CRITICAL) | `pnpm build:specs` 통과 + `Frame.spec.test.ts` PASS (4 assertion) + storybook Group snapshot 회귀 0               | Phase 진행 중단, Frame.spec 구조 재검토                 |
| G2   | Phase 2 종료            | factory unit test PASS (`createFrameLayoutDefinition` 출력 `type: "frame"` 고정) + palette 클릭 → frame 생성 통합 | Phase 2 변경 rollback, 옵션 A2 (key Group 보수) 검토    |
| G3   | Phase 3 종료            | `elementGrouping.test.ts` PASS — group/ungroup 액션 결과 type/customId 검증 + `group_N` non-duplicate             | filter 로직 재설계 (양쪽 count 우선순위)                |
| G4   | Phase 4 종료            | preview render 통합 검증 (frame 미렌더 0) + Skia layout 통합 검증 (frame container 자식 measurement OK)           | type-별 분기 추가 위치 재grep                           |
| G5   | Phase 5 종료            | history undo/redo 통합 테스트 PASS (frame 생성 → undo → 사라짐 → redo → 복원)                                     | historyActions 12 case 일반화 또는 frame 명시 case      |
| G6   | Phase 6 종료            | `pencilRoundtrip.test.ts` 5+1 fixture (legacy-group.pen 신규) PASS                                                | toPencilType switch metadata 우선순위 재검토            |
| G7   | Phase 7 종료            | dev/staging 통합 테스트 — `Group + group_N` → `frame` 변환 + ARIA Group (customId 없음) 보존                      | hydration 위치 재선택 (`tagRename.ts` vs `buildNode()`) |
| G8   | Phase 8 종료            | targeted vitest run + `pnpm tsc --noEmit` (또는 `pnpm run codex:typecheck`) PASS                                  | 회귀 fixture 추가, 타입 mismatch 격리                   |
| G9   | Phase 9 종료 (closure)  | `pnpm run codex:preflight` PASS + README ADR-127 Status 진행 + CHANGELOG `### Architecture` 섹션 추가             | preflight 실패 점검 후 Status `Implemented` 보류        |

## Consequences

### Positive

- **D3 SSOT 의도 명확화**: RAC ARIA Group ↔ canonical layout frame 분리. `composition-document.types.ts:287-312` `FrameNode` interface 가 신규 Frame.spec 과 1:1 정합 → type ↔ spec ↔ renderer 일관 정합
- **사용자 인지 혼란 해소**: 단일 진입점 (builder UI 추가 + pencil import 모두 `type: "frame"` 으로 수렴)
- **pencil round-trip 손실 0 보장 (파일 format 한정)**: 13 row 매핑 표 SSOT 명문화. metadata.pencilType 우선순위 lock-in (Phase 6 명시 case)
- **회귀 격리**: Frame/Group spec 독립 → 향후 frame 변경이 Group ARIA semantic 에 영향 0
- **ADR 정합**: ADR-903 (Spec surface freeze) / ADR-111 (frame ownership) / ADR-116 (canonical SSOT) / ADR-122 (canonical-only runtime) 4 ADR 교집합 단일 source 명문화

### Negative

- **변경 surface 5개 구역**: factory creator + grouping action + renderer dispatch + history undo/redo + auto-migration step (총 8-13 파일 수정). breakdown §7 Critical Files 참조
- **transitional period 관리**: migration 완료까지 (legacy Group + new frame 공존) elementGrouping filter 가 양쪽 count 책임. Phase 3 filter 회귀 위험
- **canvas-skia vector 시각 재현 미구현 잔존**: pencil rectangle/ellipse/line/polygon/path 의 fill/stroke 가 canvas 에 빈 frame 으로 렌더 (시각 손실). 후속 ADR 로 분리되나 **round-trip 손실 0 클레임은 "파일 format 한정"** 으로 좁힘. 사용자 가시 영역 (canvas 시각) 영구 손실 가능성
- **lowercase "group" literal cleanup 보류**: vocabulary `composition-vocabulary.ts:145` 의 `"group"` literal 은 본 ADR 범위 외 (Phase 2/3 후속 ADR). 잔존 dead-near-code 누적
- **UI 라벨 "Group" 잔존**: `keyboardShortcuts.ts:363` description / `translations.ts:219` group:"Group" 등 UX 일관성 결정 후속 슬라이스
