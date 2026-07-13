# ADR-079: Spec defaults read-through + Layout primitive SSOT 완전화

## Status

Implemented — 2026-04-19

**커밋 체인 (main +6)**:

| Phase | Hash       | 내용                                                                     |
| ----- | ---------- | ------------------------------------------------------------------------ |
| P1    | `8a944f9b` | ContainerStylesSchema alignItems/justifyContent + ListBoxItem 리프팅     |
| fix   | `a0e89efa` | ListBox variant fallback — pre-existing crash 방어 (migration 금지 준수) |
| P2    | `8bb7109b` | Style Panel hook Spec defaults read-through                              |
| P3    | `9b6c5230` | Factory 중복 주입 제거 + implicitStyles drift 감지 test                  |
| P4    | `e639b8d8` | rearrangeShapesForColumn 블랙리스트 → 화이트리스트                       |

**Gates 충족 증거**:

- G1 — Preview DOM computed style 4속성 정합 확인 (`display:flex / flexDirection:column / alignItems:flex-start / justifyContent:center`)
- G2 — 기존 ListBox (id `8c8e6e9c`, store.props.style 미저장) 선택 시 Style Panel Flex direction 토글 i=2 (lucide-stretch-horizontal = column) `data-selected="true"` MCP 실측
- G3 — drift test 3/3 PASS, Factory store.props.style = `{ width: "100%" }` 단독 확인
- G4 — snapshot 0 updated (예측 적중, Checkbox/Radio/Switch 기존 isColumn 분기 진입 조건 불변)
- G5 — type-check 3/3 / vitest 506/506 / build:specs 109 files PASS

## Context

ADR-078 Phase 5 에서 ListBox 의 시각 정합성(padding/gap/textAlign/flex-direction) 을 복구했으나, 4종의 **구조적 우회/중복** 이 잔존한다. 본 ADR 은 이 잔존을 [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) D3 정본 관점에서 구조적으로 해체하여 **Spec 을 layout primitive 의 완전한 SSOT** 로 승격한다.

**D3 (시각 스타일) 관점 잔존 debt**

1. **Style Panel 이 Spec defaults 를 무시**
   `useLayoutAuxiliary.ts` 의 훅(`useDisplay`/`useFlexDirection`) 이 `element.props.style` 만 읽고 Spec `containerStyles` 를 fallback 으로 참조하지 않음. 결과: store 에 `display` 미저장된 기존 ListBox 는 패널에 `direction="block"` 오표시. 사용자 편집 UI (flex align/wrap 필드) 자체가 비활성.

2. **Factory store 중복 주입** (ADR-078 post-fix 의 workaround)
   `SelectionComponents.ts:createListBoxDefinition` 이 Spec 의 `containerStyles.display/flexDirection` 과 `sizes.md.gap` 을 **store.props.style 에 중복 주입**. Style Panel 이 Spec 을 못 읽어서 생긴 우회. P1 해결 시 중복 해소 대상.

3. **수동 `align-items: flex-start` override** (ADR-078 post-fix workaround)
   `ListBoxItem.spec` 이 `archetype: "simple"` 이라 Generator 가 `align-items: center` emit → flex column 구조에서 text 수평 중앙 정렬로 Skia(좌측) 와 불일치 → 수동 `ListBox.css` 에서 `align-items: flex-start` 로 상쇄. `ContainerStylesSchema` 에 `alignItems` 필드 부재로 Spec 선언 불가.

4. **`rearrangeShapesForColumn` 블랙리스트** (ADR-078 post-fix workaround)
   `buildSpecNodeData.ts:572-580` 이 `COLUMN_REARRANGE_EXCLUDE_TAGS = {ListBox, GridList}` 로 해당 태그를 차단. 원래 함수는 Checkbox/Radio/Switch 전용 indicator↔label 재배치지만 모든 flex-column 컴포넌트에 적용되던 설계 결함. 블랙리스트 방식은 신규 column-based collection 추가 시 재발 위험.

**D3 symmetric consumer 위반 축**

| 경로                                 | 현재 동작                                                   | 문제                                   |
| ------------------------------------ | ----------------------------------------------------------- | -------------------------------------- |
| Preview CSS (Generator)              | Spec archetype + containerStyles 에서 emit — Spec 직접 소비 | 정상                                   |
| Canvas Skia (render.shapes + layout) | Spec + props.style 소비 (fallback 정합)                     | 정상 (ADR-078 Phase 5)                 |
| **Style Panel (hook)**               | **store.props.style 만 읽음**                               | **Spec 읽기 경로 부재 → 3경로 비대칭** |

**Hard Constraints**

1. 기존 ListBox instance 는 store migration 없이도 정확히 표시되어야 함 (사용자 명시: 개발 단계라 migration 오버)
2. Preview DOM 정합 유지 (대칭성 불변)
3. P4(`rearrangeShapesForColumn` 화이트리스트 전환) 후 Checkbox/Radio/Switch 시각 회귀 0
4. `pnpm type-check` 3/3 PASS + `pnpm vitest --run` 회귀 0
5. 다른 컨테이너 Spec(Menu/Select/ComboBox/GridList/Tabs) 의 cascade 영향 없음 — P1/P2 는 `containerStyles` 존재 Spec 만 cover

**Soft Constraints**

- P1 `alignItems` 필드 추가는 `ContainerStylesSchema` 타입 확장 — 향후 다른 Spec 도 활용 가능
- P2 hook read-through 는 tag-agnostic (hook 자체가 특정 tag 분기 없음) 이지만, 실제 fallback 효과 범위는 **최상위** `spec.containerStyles.display/flexDirection` 선언 Spec 에 한정. 현재 선언 대상은 `ListBoxSpec` 1건 (Menu 는 overlay 라 Style Panel scope 밖). 대다수 Spec (ToggleButtonGroup/CheckboxGroup/RadioGroup/Card/Dialog 등) 은 `spec.composition.containerStyles` 내부에 display 를 선언 → 현 P2 resolver 미접근 → 후속 ADR 에서 composition 경로 통합 필요
- P3 factory 주입 제거는 신규 ListBox 경로 단일화 — 기존 element 는 P2 가 커버
- P4 화이트리스트 전환은 Checkbox/Radio/Switch 소스 확증 필요

## Alternatives Considered

### 대안 A: Phase 1~4 순차 ADR (선정)

- 설명: ContainerStylesSchema `alignItems` 추가(P1) → Style Panel hook Spec read-through(P2) → factory 중복 주입 제거(P3) → `rearrangeShapesForColumn` 화이트리스트 전환(P4). 4 Phase 가 의존 순서이며 단계별 verifiable.
- 근거: ADR-078 의 "우회/중복 4종" 을 각 Phase 가 정확히 대응. P2 가 migration 제거의 핵심 (read-through fallback).
- 위험:
  - 기술: **MEDIUM** — P2 훅 리팩토링이 전체 Style Panel 에 영향. Spec import path 확장
  - 성능: LOW — hook 계산 비용 미미 (O(1) TAG_SPEC_MAP lookup)
  - 유지보수: LOW — Spec SSOT 단일화 → drift 방지
  - 마이그레이션: LOW — 기존 instance 는 read-through 가 fallback 제공, migration 불필요

### 대안 B: P1+P2 만 진행, P3/P4 별도 ADR 로 분할

- 설명: Layout primitive SSOT 승격(P1+P2) 만 본 ADR scope. factory 중복 주입과 rearrange 화이트리스트는 후속.
- 근거: ADR scope 를 좁게 유지, 리스크 분산
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — P1+P2 완료 후에도 factory 주입 잔존이 "일시적 debt" 로 남아 오히려 오해 소지 (신규 ListBox 는 중복 주입, 기존은 Spec fallback — 이원 경로)
  - 마이그레이션: LOW
- 부분 해결이라 ADR-078 잔존 debt 와 동일한 "우회 지속" 을 남김

### 대안 C: Style Panel 을 Spec 에서 완전히 분리 (Panel-private defaults table)

- 설명: Style Panel hook 이 Spec 을 참조하지 않고 별도 `PANEL_DEFAULTS_BY_TAG` 테이블 유지. Spec 변경 시 panel 테이블 수동 동기화
- 근거: Panel 코드의 specs 패키지 의존 제거
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — SSOT 두 벌 (Spec + Panel). 동기화 부담 + drift 재발. ADR-078 에서 해체한 "LAYOUT_STYLE_KEYS ↔ Spec" 이원화 구조의 재현
  - 마이그레이션: LOW
- ADR-063 3-domain SSOT 원칙 역행

### 대안 D: 아무것도 하지 않음 (ADR-078 현상 유지)

- 설명: 당면 증상은 해결됐으므로 debt 는 문서로만 기록
- 근거: 제로 투자
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **CRITICAL** — 4종 워크어라운드가 장기 유지 → 새 컴포넌트 추가 시 동일 증상 재발. ADR-078 의 "block 처리 workaround" 경로처럼 오판 수정 반복
  - 마이그레이션: LOW
- ADR-036/059/063 SSOT 원칙 공식 포기

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 |  HIGH+ 개수  |
| ---- | :--: | :--: | :------: | :----------: | :----------: |
| A    |  M   |  L   |    L     |      L       |      0       |
| B    |  L   |  L   |  **M**   |      L       | 0 (MEDIUM 1) |
| C    |  L   |  L   |  **H**   |      L       |      1       |
| D    |  L   |  L   |  **C**   |      L       | 1 (CRITICAL) |

**루프 판정**:

- 대안 A: HIGH 0개 — 바로 채택 가능
- 대안 B: HIGH 0개 이지만 부분 해결로 우회 지속 — 본 ADR 의 목표(100% 완전화) 미달
- 대안 C: HIGH 1개 (SSOT 이원화) — ADR-063 역행. 기각
- 대안 D: CRITICAL 1개 (SSOT 원칙 공식 포기) — 기각
- **대안 A 채택** — 추가 루프 불필요

## Decision

**대안 A: Phase 1~4 순차** 을 선택한다.

선택 근거:

1. **ADR-078 잔존 debt 완전 소진** — 4종 우회/중복 각각에 Phase 가 1:1 대응
2. **Migration 불필요** — P2 read-through 가 기존 instance 의 Spec defaults 를 fallback 으로 공급. 사용자 "개발 단계 migration 불필요" 원칙과 정합
3. **Tag-agnostic 확산** — P1/P2 는 `containerStyles` 보유 Spec 모두 자동 적용. ListBox 외 Menu/GridList/Select 등 후속 SSOT 복귀 기반
4. **ADR-063 3-domain 원칙 완성** — D3 symmetric consumer 가 Preview CSS / Canvas Skia / Style Panel 3경로 모두 Spec 직접 소비
5. **단계별 verifiable** — 각 Phase 가 type-check + snapshot + MCP 시각 회귀로 독립 검증

기각 사유:

- **대안 B**: P3/P4 를 별도로 두면 "일시적 debt" 가 중기 유지 — 오해 소지 + 동일한 workaround 재발 가능. 한 번에 4종 해체가 장기 ROI 높음
- **대안 C**: SSOT 이원화 (Spec + Panel defaults 테이블) 는 ADR-063 역행. drift 재발
- **대안 D**: 현상 유지는 SSOT 원칙 공식 포기 = CRITICAL 유지보수 debt

> 구현 상세: [079-spec-defaults-read-through-layout-primitive-ssot-breakdown.md](../../adr/design/079-spec-defaults-read-through-layout-primitive-ssot-breakdown.md)

## Gates

| Gate | 시점                   | 통과 조건                                                                                                                                                 | 실패 시 대안           |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| G0   | 착수 전                | Spec 중 `containerStyles` 보유 목록 감사 + `rearrangeShapesForColumn` 소스(Checkbox/Radio/Switch) 확증                                                    | 감사 재실행            |
| G1   | Phase 1 (alignItems)   | `ContainerStylesSchema.alignItems` 필드 추가 + `ListBoxItemSpec.containerStyles` 선언 + generated CSS 에 `align-items` emit                               | 수동 CSS 유지 fallback |
| G2   | Phase 2 (read-through) | `useDisplay`/`useFlexDirection` 등이 `TAG_SPEC_MAP[tag].containerStyles` fallback 읽기 + 기존 ListBox 도 패널에 `direction="column"` 정확 표시 (MCP 실측) | 훅 범위 축소           |
| G3   | Phase 3 (factory 정리) | `createListBoxDefinition` 의 중복 주입 제거 + 신규 ListBox 생성 시 `props.style = { width: "100%" }` 만 + Style Panel/Canvas Skia/Preview 3경로 동일 값   | 주입 유지 (debt 명시)  |
| G4   | Phase 4 (화이트리스트) | `COLUMN_REARRANGE_TAGS = {Checkbox, Radio, Switch}` 화이트리스트 + Checkbox/Radio/Switch flex column 시각 회귀 0 (snapshot + MCP)                         | 블랙리스트 유지        |
| G5   | 종결                   | `/cross-check` ListBox+ListBoxItem+Checkbox+Radio+Switch + `parallel-verify` collection family                                                            | 개별 path 수정         |

**잔존 HIGH 위험**: 없음.

## Consequences

### Positive

- **ADR-063 3-domain SSOT 완전 복귀** — D3 layout primitive 가 Spec 단일 소스에서 Preview/Canvas/Panel 3경로 동시 공급
- **기존 ListBox instance 도 정확 표시** — migration 없이 P2 hook read-through 가 커버
- **신규 컴포넌트 파급** — `containerStyles.{display,flexDirection,alignItems}` 선언만으로 Spec/CSS/Canvas/Panel 자동 정합. GridList/Menu/Select/ComboBox/Tabs 등 확장 비용 감소
- **Workaround 4종 해체** — 수동 CSS align-items, factory 중복 주입, rearrange 블랙리스트, Panel Spec 무시 모두 구조적 해결
- **ADR-078 debt 완결** — 후속 과제 목록 정리

### Negative

- `ContainerStylesSchema.alignItems` 필드 추가 → 타입 변경 (optional 이라 기존 Spec 영향 0)
- Style Panel hook 이 specs 패키지 의존 — 이미 builder 전체가 specs import 중이라 추가 결합도 없음
- P4 화이트리스트 전환 시 Checkbox/Radio/Switch 재확증 필요 — snapshot test + MCP 시각 회귀 필수
- 본 ADR 구현 비용 (P1~P4) — 약 1~2 세션 추정

## References

- ADR-036 Spec-First Single Source — 상위 원칙
- ADR-059 `skipCSSGeneration` 해체 — SSOT 복귀 체인
- ADR-063 SSOT Chain Charter — D1/D2/D3 정본
- ADR-071 Generator `containerStyles` — 재사용 인프라
- ADR-078 ListBoxItem.spec + Generator 자식 selector — 본 ADR 의 직접 선행
- `ssot-hierarchy.md` — D3 symmetric consumer 원칙
- commit `d6345f49` — 본 ADR 이 해체할 workaround 4종 source
