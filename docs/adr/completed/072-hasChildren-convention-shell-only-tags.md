# ADR-072: `_hasChildren` 컨벤션 SSOT + Shell-only 컨테이너 태그 재분류

## Status

Implemented — 2026-04-18 (Proposed 2026-04-17)

## Context

composition의 Skia 렌더 파이프라인은 spec `render.shapes(props, size, state)`에 `_hasChildren` boolean을 주입하여 부모 컨테이너가 자식 존재 여부에 따라 다른 shapes를 반환하도록 한다. `packages/specs/src/components/*.spec.ts` 108개 파일 중 **54개가 이 분기를 사용**한다.

2026-04-17 Calendar 중복 렌더 버그 조사 중 드러난 구조적 결함:

- `buildSpecNodeData.ts`의 단일 Set `CHILD_COMPOSITION_EXCLUDE_TAGS`가 **서로 다른 두 가지 의도**(자식 props 통합 렌더 컨테이너 + shell-only 컨테이너)를 겸용하여 `_hasChildren` 주입을 일괄 차단.
- 그 결과 Shell-only 패턴 태그(예: Calendar)도 주입을 받지 못해 standalone 분기가 실행되고, 자식 Element가 동시에 독립 Skia 노드로 렌더링되어 **UI 중복**이 발생.
- Card/Dialog/Section 등 15개 태그는 standalone 분기가 빈 container placeholder 수준이라 **시각 증상이 숨겨져** 있었으나, 잠재 버그는 동일.

본 ADR은 Calendar/RangeCalendar를 `SHELL_ONLY_CONTAINER_TAGS`로 이동한 과도기 상태에서, 나머지 15개 후보의 **단계적 재분류**와 **`_hasChildren` 컨벤션 SSOT 문서화**를 마무리한다.

**Hard Constraints**:

1. 기존 105 vitest 테스트 회귀 0
2. `pnpm type-check` 3/3 패키지 통과 유지
3. Calendar/RangeCalendar 대칭 테스트(3 케이스) 유지
4. Skia rebuild hot path(`buildSpecNodeData`)에 O(1) lookup만 추가 허용
5. **Shell-only 이동 대상 태그는 factory definition이 자식 Element(텍스트/아이콘 등)를 자동 생성함을 사전 확인**. 자식 없이 `props.children`/`props.text`만으로 렌더하는 컴포넌트(예: Tooltip의 text+arrow standalone 분기)를 이동하면 **기본 상태에서 내용 소실**
6. **standalone 분기 라인 수 ≥ 50**인 태그(Popover 168 / Tooltip 190 / Disclosure 125 / ColorPicker 103)는 "빈 placeholder" 가정에서 제외하고 내용 정독 필수

**Soft Constraints**:

- Chrome MCP `Page.captureScreenshot`이 CanvasKit/WebGL 충돌로 timeout — 시각 회귀 검증은 Vitest 대칭으로 대체
- SSOT 체인 정본([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)) D3(시각 스타일) 정리 작업이며, D1(DOM/RAC) / D2(Props/RSP) 경계 침범 금지

## Alternatives Considered

### 대안 A: 일괄 재분류 (15개 동시 이동)

- 설명: 15개 후보 spec을 한 번에 감사하여 분류 결정 후 Set 멤버 일괄 이동
- 근거: 외부 리서치 불필요한 내부 구조 정리. Boris monorepo 대규모 리팩토링 사례에서 "일괄 이동 + 종합 테스트" 전략 관찰. composition 내 ADR-059 B1~B5 종결이 유사 패턴(대량 Set 해체)
- 위험:
  - 기술: **H** — 15개 spec standalone 분기 감사 시 놓치는 케이스(예: 생각보다 복잡한 synthetic merge 로직 포함) 발생 시 Calendar류 중복 재발
  - 성능: L — Set 멤버 이동뿐
  - 유지보수: L — SSOT 1회 정리 후 안정
  - 마이그레이션: **H** — 한 commit에 15개 태그 동작 변경. 회귀 발생 시 원인 좁히기 어렵고 rollback 범위 큼

### 대안 B: Phase별 단계 재분류 (3 Phase)

- 설명: 3개 그룹으로 나눠 순차 이동 + 각 Phase마다 Gate 통과 후 다음 진행
  - **Phase 1 (Empty-placeholder 확인됨, 7개)**: Card, Dialog, Section, Disclosure, DisclosureGroup, Form, Popover — standalone 분기가 빈 container placeholder임이 확인된 태그
  - **Phase 2 (Group/Control + 실렌더 감사 필요, 6개)**: ButtonGroup, CheckboxGroup, RadioGroup, ToggleButtonGroup, ColorPicker, **Tooltip** — group은 자식 Checkbox/Radio/ToggleButton이 독립 Skia 노드. Tooltip/ColorPicker/Disclosure 등 standalone 50줄+ 태그는 factory 자식 자동 생성 여부 확인 후 이동 판정. factory가 text/아이콘 자식을 생성하지 않으면 Shell-only 이동 금지(Plain 분류)
  - **Phase 3 (incrementalSync expansion 단독 판정, 2개)**: TabPanel, TabPanels — `_hasChildren` 분기 **부재 확인됨**. 본 Phase는 "Set에 유지할지"를 `incrementalSync` 자식→부모 rebuild 필요성으로만 판정. 불필요 시 양 Set 모두에서 제거(Plain)
- 근거: ADR-059(composite field skipCSSGeneration 해체) Phase 1~5 체계 선례. 각 Phase Gate에서 type-check + vitest + 시각 sanity 확인 후 진행하여 회귀 조기 감지. 본 세션 Calendar 수정도 같은 패턴(증상 관찰 → 원인 추적 → 최소 변경 → 검증)으로 성공
- 위험:
  - 기술: **M** — 각 Phase 감사 범위가 작아 오류 파악 쉬움. 여전히 spec standalone 분기 오판 가능성 존재
  - 성능: L — 동일
  - 유지보수: L — 동일 종착점
  - 마이그레이션: L — Phase당 commit 분리로 rollback 쉬움. 문제 발견 시 해당 태그만 원복

### 대안 C: 현 상태 유지 + 주석 강화

- 설명: 과도기 상태를 동결하고 JSDoc에 "15개는 이동 후보나 증상 없어 보류" 명시. 새 컨테이너 추가 시에만 올바른 Set에 등록
- 근거: Calendar 버그는 이미 수정됨. 나머지 15개는 현재 증상 없음. 투자 대비 효과 낮다는 관점
- 위험:
  - 기술: **M** — 신규 컨테이너 추가 시 컨벤션 부재로 잘못된 Set에 등록될 가능성. 교육 부담으로 남음
  - 성능: L
  - 유지보수: **H** — 2 Set이 "과도기"라는 상태가 장기 유지되면 의미 혼동 누적. Set 이름과 실제 멤버 의미 불일치(Synthetic-merge Set에 실은 shell-only인 태그 15개 포함)가 향후 디버깅 시 오도
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  L   |    L     |      H       |     2      |
| B    |  M   |  L   |    L     |      L       |     0      |
| C    |  M   |  L   |    H     |      L       |     1      |

**루프 판정**: 대안 B는 HIGH+ 0개로 임계 통과. 대안 A는 마이그레이션 위험이 HIGH이고 기술 위험 HIGH가 겹쳐 rollback 비용 큼. 대안 C는 유지보수 부채를 장기화. 추가 대안 생성 불필요.

## Decision

**대안 B: Phase별 단계 재분류**를 선택한다.

선택 근거:

1. Phase별 commit 분리로 회귀 조기 감지 + 좁은 범위 rollback 가능 — 마이그레이션 위험 LOW
2. ADR-059 B1~B5 체인과 본 세션 Calendar 수정에서 검증된 "작은 Phase + Gate" 전략 재사용
3. Vitest 대칭(`calendar-symmetry.test.ts` 패턴)을 Phase별 확장하여 수학적 증명으로 Chrome MCP 시각 검증 불가 한계를 대체
4. 3-Domain SSOT 정본(ADR-063) D3 내부 정리로 경계 안전

기각 사유:

- **대안 A 기각**: 15개 동시 이동 시 회귀 발생 시 어느 태그가 원인인지 좁히기 어렵고 rollback 시 정상 이동된 태그까지 되돌아감. ADR-059의 phase 접근이 이미 유효성 입증.
- **대안 C 기각**: 2 Set의 이름·내용 불일치를 장기 유지하면 미래 디버깅 시 Calendar 버그 같은 분석 다시 반복됨. 교육 비용도 누적.

> 구현 상세: [072-hasChildren-convention-shell-only-tags-breakdown.md](../../adr/design/072-hasChildren-convention-shell-only-tags-breakdown.md)

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                 | 실패 시 대안                                                      |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| G1   | Phase 1 종료 | 7개 태그 이동 후 `pnpm type-check` 3/3 + 신규 Vitest 대칭(≥6 케이스) + 기존 105 test 회귀 0 + Popover standalone 빈 container 최종 확인                                   | 실패 태그만 Set에서 원복, 개별 spec 감사 후 재시도 또는 제외      |
| G2   | Phase 2 종료 | 6개 태그 이동 후 G1 조건 + ToggleButtonGroup selection 회귀 0 + **Tooltip/ColorPicker/Disclosure factory 자식 자동 생성 여부 감사 결과 문서화** (이동 or Plain 분류 결정) | 실패 태그 원복, `_indicatorMode`/`_groupPosition` 상호작용 재설계 |
| G3   | Phase 3 종료 | TabPanel/TabPanels `_hasChildren` 분기 부재 확인 + `incrementalSync` expansion 필요성 판정 + 양 Set 유지/제거 결정 문서화 + ADR-066(items SSOT) 회귀 0                    | 판정 불확실 시 본 ADR scope에서 제외하고 후속 ADR 신설            |
| G4   | 전체 종료    | `.claude/rules/canvas-rendering.md` `_hasChildren` 컨벤션 섹션 추가 + memory 포인터 갱신                                                                                  | 문서 미비 시 Status를 Accepted에서 보류, 다음 세션 보강           |

## Consequences

### Positive

- **SSOT 명확화**: `SHELL_ONLY_CONTAINER_TAGS` / `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 이름과 멤버 의미 일치. Calendar 버그 유형 재발 차단.
- **신규 컨테이너 spec 추가 시 판정 가이드 확보**: `.claude/rules/canvas-rendering.md`에 3분류 정의 + 판정 알고리즘 문서화. 컨벤션 학습 비용 감소.
- **잠재 버그 선제 해소**: Card/Dialog/Section 등 standalone 분기가 placeholder 수준이라 증상 없던 15개 태그도 의도대로 shell-only 동작 확정.
- **ADR-063 3-Domain D3 정합성 강화**: Spec SSOT 내 컨테이너 렌더 계약을 한 곳에 정리하여 D3 대칭(Skia ↔ CSS consumer) 안정.

### Negative

- **15개 spec standalone 분기 감사 비용**: 각 spec 정독 + 판정 필요. 특히 standalone ≥ 50줄 태그(Popover/Tooltip/Disclosure/ColorPicker)는 내용 정독 + factory definition 교차 확인 필수. 실측 세션당 30~60분 소요 예상.
- **Phase 2 factory 자식 감사 추가 비용**: Tooltip/ColorPicker/Disclosure는 factory가 자식 Element를 자동 생성하는지 별도 확인 필요(생성하지 않으면 Shell-only 이동 금지 → Plain 분류). 오판 시 기본 상태 UI 소실.
- **Vitest 케이스 증가**: 3 Phase 합산 약 40~50 신규 케이스(후보 15개 × 자식 0/1/2 케이스 평균). 테스트 런타임은 Set lookup + layout 계산만이라 영향 미미.
- **과도기 중 Set 이름·멤버 불일치 지속**: Phase 진행 중 일시적으로 `SYNTHETIC_CHILD_PROP_MERGE_TAGS`에 shell-only 태그가 남아있음. Phase 3 종료 전까지 JSDoc에 명시적 과도기 주석 유지.

## Implementation (2026-04-18)

Phase 1~3 완료. 13개 태그 재분류 + 2개 태그 SYNTHETIC 제거.

| Phase | 이동/변경                                                           | SHA        | Gate 통과                                       |
| ----- | ------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| 1     | Card/Dialog/Section/DisclosureGroup → SHELL_ONLY                    | `47fcec86` | type-check 3/3 + vitest 16 PASS + Calendar 대칭 |
| 2-A   | ButtonGroup/CheckboxGroup/RadioGroup/ToggleButtonGroup → SHELL_ONLY | `14c35591` | type-check 3/3 + vitest 16 PASS 추가            |
| 2-B   | Disclosure/Form/Popover/Tooltip/ColorPicker → SHELL_ONLY            | `67a2133c` | type-check 3/3 + vitest 15 PASS 추가            |
| 3     | TabPanel/TabPanels SYNTHETIC 제거 (Shell-only 이동 안 함)           | `b9a43743` | type-check 3/3 + vitest 6 PASS 추가             |

**Phase 2 재분할 경위**: 원 breakdown은 Phase 2를 6개 일괄로 설계했으나 난이도 차이 때문에 2-A(Group 류 4개, 저위험)와 2-B(실렌더 5개, factory 자식 감사 후 판정)로 분리 수행. Phase 1 연기분(Disclosure/Form/Popover)이 Phase 2-B로 합류하여 총 5개 이동.

**Phase 3 판정**: TabPanel/TabPanels `shapes: () => []` 확증 — 자식 props 미사용으로 SYNTHETIC 멤버십의 두 효과(incrementalSync rebuild expansion + stale-ref 교체) 모두 무효. Shell-only 이동도 의미 없음. SYNTHETIC에서만 제거.

**최종 Set 상태**:

- `SHELL_ONLY_CONTAINER_TAGS` (15): Calendar, RangeCalendar, Card, Dialog, Section, DisclosureGroup, ButtonGroup, CheckboxGroup, RadioGroup, ToggleButtonGroup, Disclosure, Form, Popover, Tooltip, ColorPicker
- `SYNTHETIC_CHILD_PROP_MERGE_TAGS` (11): Breadcrumbs, ComboBox, GridList, ListBox, Select, Table, Tabs, TagGroup, Toolbar, Tree — 진정한 synthetic-merge 컨테이너만 유지

**검증 누적**:

- `pnpm type-check` 3/3 PASS (모든 Phase)
- `shell-only-tags.test.ts` 53 + `calendar-symmetry.test.ts` 3 = **56 PASS**
- 기존 vitest 회귀 0

**G4 완료**: `.claude/rules/canvas-rendering.md` `_hasChildren` 컨벤션 섹션 추가 + 메모리 파일 `child-composition-exclude-tags.md` → `hasChildren-container-convention.md` rename.
