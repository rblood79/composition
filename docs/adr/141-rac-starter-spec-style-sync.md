# ADR-141: react-aria-starter 참조 스타일의 Spec D3 반영

## Status

Proposed — 2026-05-18

## Context

composition 은 `react-aria-starter/src` 를 React Aria Components 의 스타일 참조 원본으로 삼는다. starter 가 업데이트되면서 composition Spec(D3 시각 SSOT)이 참조와 어긋났다. 본 ADR 은 그 격차를 어떤 기준으로 Spec 에 반영할지 결정한다.

**SSOT domain**: D3 (시각 스타일) — `ssot-hierarchy.md`. Spec 이 SSOT 이고 Builder Skia 와 Preview CSS 는 symmetric consumer. 본 ADR 은 D3 내부 정합 작업이며 D1(DOM/RAC)·D2(Props/RSP) 경계를 넘지 않는다.

**Hard Constraints**:

1. composition 은 자체 토큰 체계(`--accent`/`--text-*`/`--bg-*`)를 쓴다. starter 토큰(`--tint-*`/`--font-size`)을 직접 차용할 수 없으며, 채택분은 composition 토큰으로 내재화해야 한다.
2. D3 대칭 — Spec 변경은 Builder Skia 와 Preview CSS 양쪽에 동일 시각 결과를 산출해야 한다 (cross-check 통과 필수).
3. 하위 호환 — 기존 프로젝트의 시각 결과가 바뀔 수 있다 (특히 형태·입체감 계열 채택 시).

**Soft Constraints**:

- CSSGenerator 의 emit 능력 — 일부 starter rule(RangeCalendar range-band 띠, Menu grid-subgrid, `::after` overlay)은 현재 Generator 가 emit 하지 못한다.
- starter 의 일부 스타일은 composition 이 의도적으로 발산한 디자인 결정일 수 있어, 채택 여부는 제품 판단을 요한다.

**Phase 0 감사**: `react-aria-starter/src` ↔ composition Spec 의 시각 delta 를 registered 컴포넌트 ~45 개에 대해 실측했다. HIGH 18 + MED 27 + LOW ~20, 6 패턴(P1 형태 / P2 micro-interaction / P3 입체 box-shadow / P4 치수 / P5 구조 / P6 상태 누락)으로 수렴. 상세: [2026-05-18-rac-starter-spec-style-diff.md](../reference/audits/2026-05-18-rac-starter-spec-style-diff.md).

**범위 제외**: Table 패밀리 + Tree·TagGroup·ColorPicker·GridList·ColorArea·ColorSlider 는 본 ADR 범위 외다. 이들 skipCSSGeneration 컨테이너는 ADR-059(skipCSSGeneration 해체, Implemented 2026-04-15)·ADR-106-a~d(skipCSSGeneration 감사 완결, 2026-04-21)가 이미 다뤘다 — CSSGenerator 가 RAC 내부 selector·`::after`·orientation 분기를 emit 못 해 **해체 불가가 확정된 G2 정당 Tier 3 예외**다(`해체 대기 debt` 아님). 이들로의 starter 동기화는 CSSGenerator 능력 확장 또는 수동 CSS 경로를 요하는 별도 작업이다. 본 ADR 타겟은 제외 후 대다수가 generated CSS 보유 컴포넌트이며, 잔존 skipCSSGeneration sub-component 예외는 Decision §Spec 반영 경로 참조.

## Alternatives Considered

### 대안 A: 전량 채택 (wholesale sync)

- 설명: starter 를 authoritative 로 보고 HIGH 18 + MED 27 전 delta 를 Spec 에 반영.
- 근거: 참조 원본 추종 일관성 최대 — RAC starter 가 Adobe 가 유지하는 정본이라는 점.
- 위험:
  - 기술: MEDIUM — CSSGenerator 미지원 rule(형제 selector / `::after`) 다수 → Generator 확장 선행 필요
  - 성능: LOW — 스타일 값 변경
  - 유지보수: MEDIUM — 채택 후 starter 추종 의무 고정
  - 마이그레이션: HIGH — P1(형태)·P3(입체감) 일괄 변경 시 전 기존 프로젝트 시각 회귀

### 대안 B: 패턴 선별 채택 (pattern-filtered sync)

- 설명: 6 패턴별로 채택/유지 판정. P2(micro-interaction)·P6(상태 누락)·P4(치수)는 채택 대상으로, P1(형태)·P3(입체감)은 composition 디자인 언어 의도 가능성으로 별도 판정.
- 근거: starter "개선분"과 composition "의도적 발산"을 분리. ADR-140(press-scale)이 P2 일부를 Spec `states` 경유로 채택한 선례와 동일 메커니즘 — 부분 채택이 검증된 경로.
- 위험:
  - 기술: LOW — 채택 패턴이 Generator 지원 범위 내로 한정
  - 성능: LOW
  - 유지보수: LOW — 패턴 단위 일관 판정
  - 마이그레이션: MEDIUM — 채택분에 한정된 시각 회귀

### 대안 C: 컴포넌트별 개별 판정

- 설명: 패턴 그룹 없이 ~45 컴포넌트 각각의 delta 를 개별 결정.
- 근거: 최대 정밀도 — 컴포넌트 맥락별 최적 판정.
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: HIGH — 45 컴포넌트 간 일관 기준 부재, 동일 패턴이 컴포넌트마다 다르게 처리될 위험
  - 마이그레이션: MEDIUM

### 대안 D: 감사 보존, Spec 무변경

- 설명: 감사를 reference 로만 두고 Spec 을 변경하지 않음.
- 근거: BC 0, 즉시 위험 0.
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: HIGH — 격차가 영구 누적, 다음 starter 업데이트마다 악화
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    M     |      H       |     1      |
| B    |  L   |  L   |    L     |      M       |     0      |
| C    |  L   |  L   |    H     |      M       |     1      |
| D    |  L   |  L   |    H     |      L       |     1      |

대안 B 만 HIGH+ 0건. 나머지는 각 1건이나 B 라는 HIGH+ 0 대안이 이미 존재하므로 추가 대안 루프 불요.

## Decision

**대안 B (패턴 선별 채택)** 를 선택한다.

선택 근거:

1. B 만 HIGH 위험 0건 — starter 의 명백한 개선분(P2 micro-interaction 누락, P6 상태 누락, P4 치수)과 composition 의 의도적 디자인 발산(P1 형태, P3 입체감)을 분리 판정함으로써 마이그레이션 위험을 채택분으로 한정.
2. ADR-140 이 P2 일부(press-scale)를 Spec `states` + StateEffect 경유로 채택한 메커니즘이 검증됨 — 동일 경로 재사용.

기각 사유:

- **대안 A 기각**: P1/P3 일괄 채택이 전 기존 프로젝트 시각 회귀(마이그레이션 HIGH). composition 이 flat·`radius-md` 를 의도 선택했을 가능성을 무시.
- **대안 C 기각**: 패턴 일관성 상실(유지보수 HIGH) — 동일 형태/입체감 delta 가 컴포넌트마다 다르게 처리될 위험.
- **대안 D 기각**: 격차 영구 누적 — 다음 starter 업데이트마다 악화(유지보수 HIGH).

패턴별 채택 추천(확정 판정·구현 순서는 design breakdown):

- **P2 micro-interaction → 채택** (Spec `states` + StateEffect — ADR-140 메커니즘)
- **P6 상태 누락 → 채택** (drop-target / `[role=alert]` / selected divider — 기능 누락 성격)
- **P4 치수 → 개별 채택** (의도 가능 항목 예: Dialog padding 은 자식 슬롯 구조 탓일 수 있어 제외 검토)
- **P1 형태(pill/원형) → 보류, 디자인 결정 필요** (composition `radius-md` 가 의도면 기각)
- **P3 입체 box-shadow → 보류, 디자인 결정 필요** (composition flat 이 의도면 기각)
- **P5 구조 → 개별** (RangeCalendar range-band 등 cross-check 후 판정)

### Spec 반영 경로 — D3 SSOT 정합

D3 SSOT 원칙상 시각 변경은 Spec 에 반영돼야 한다(수동 CSS 직접 편집은 consumer 수정). 본 ADR 타겟의 반영 경로:

- **generated CSS 보유 타겟 (대다수)** — Button·Dialog·Modal·Popover·Disclosure·ProgressBar·Meter·Switch·Slider·Form·NumberField·Checkbox·Radio·RangeCalendar·Calendar·DropZone·Link·Tooltip·Toast·Separator 등. Spec 수정 → `pnpm build:specs` → generated CSS 재생성. Spec 수정이 곧 D3 SSOT 수정.
- **skipCSSGeneration sub-component 예외** — `DisclosureContent`(감사 H17 패널 height transition, Phase 1)·`ColorSwatchPicker`(P1, Phase 5)는 generated CSS 가 없다(`skipCSSGeneration: true`, parent 가 inline-emit 안 함). 해당 delta 의 반영 경로(parent Disclosure 의 ADR-078 child inline-emit / skipCSSGeneration 재판정 등)는 해당 Phase 착수 시 확정한다 — 순수 Spec 수정이 아닐 수 있다.
- **이중 CSS override** — Modal/Dialog/Popover 는 generated + `overlays.css` 수동 공존. Spec 재생성분이 `@layer components` specificity 로 가려지지 않는지 Phase 별 cross-check(G1)로 확인(Risk R5).

**제외 원칙**: generated CSS 가 없는 skipCSSGeneration 컨테이너(Tree·TagGroup·ColorPicker·GridList·ColorArea·ColorSlider + Table)는 본 ADR 범위 외. ADR-059·ADR-106-a~d 가 CSSGenerator 구조적 미지원(RAC 내부 selector·`::after`·orientation)으로 인한 **G2 정당 Tier 3 예외**로 이미 분류했다 — `해체 후속` 대상이 아니라 CSSGenerator 능력 확장을 요하는 별도 작업이다. 실측 근거: 커밋 `49989e7f6` 시점 `packages/shared/src/components/styles/generated/` grep.

> 구현 상세: [141-rac-starter-spec-style-sync-breakdown.md](design/141-rac-starter-spec-style-sync-breakdown.md)

## Risks

| ID  | 위험                                                                                                                            | 심각도 | 대응                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------- |
| R1  | 채택분의 Builder Skia ↔ Preview CSS 시각 대칭 깨짐                                                                              |  MED   | 패턴별 cross-check Gate (G1)                                                                   |
| R2  | CSSGenerator 가 일부 starter rule(RangeCalendar range-band / Menu grid-subgrid) emit 불가                                       |  MED   | 채택 전 Generator 능력 확인, 불가 시 해당 delta 보류                                           |
| R3  | P1/P3 보류 항목이 디자인 결정 없이 영구 미결 표류                                                                               |  MED   | breakdown 에 디자인 결정 항목·기준 명시                                                        |
| R4  | 채택분의 기존 프로젝트 시각 회귀                                                                                                |  MED   | 채택 패턴별 BC 영향 컴포넌트 수를 breakdown 에 수식화                                          |
| R5  | 이중 CSS(Modal/Dialog/Popover `overlays.css` 수동)가 Spec 재생성분을 `@layer` specificity 로 override → Spec 수정이 시각 미반영 |  MED   | 해당 컴포넌트 Phase 착수 시 generated↔수동 우선순위 cross-check(G1), override 시 수동 CSS 정정 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점              | 통과 조건                                      | 실패 시 대안    |
| ---- | ----------------- | ---------------------------------------------- | --------------- |
| G1   | 각 패턴 채택 직후 | cross-check — 채택 컴포넌트 Skia↔CSS 시각 대칭 | 해당 delta 보류 |
| G2   | P2/P4 채택 시     | type-check 통과 + CSSGenerator snapshot 정합   | 롤백            |
| G3   | P1/P3 착수 전     | 디자인 결정 explicit confirm 없이는 미착수     | 보류 유지       |

## Consequences

### Positive

- composition Spec 이 starter 참조와 정합 — 다음 starter 업데이트 추적 비용 감소.
- P2/P6 채택으로 micro-interaction·상태 피드백(drop-target, 패널 전환 등)이 Builder·Preview 양쪽에 복원.
- 6 패턴 분류가 향후 starter 업데이트 감사의 재사용 기준이 됨.

### Negative

- 채택분마다 cross-check 재검증 부담 (`packages/specs`·`packages/shared` 전반).
- P1/P3 보류 항목은 별도 디자인 결정 시점까지 starter 와 미정합 상태로 잔존.
