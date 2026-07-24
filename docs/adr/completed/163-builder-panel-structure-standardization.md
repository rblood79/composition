# ADR-163: 빌더 패널 표준 구조화 — 레퍼런스 기반 전 패널 DOM/클래스/CSS 정본 통일

## Status

Implemented — 2026-07-25

> Proposed — 2026-07-24 · 리뷰 round 2 승인 가능 (이슈 0 / pending 0) → Accepted 승격 후 execute-adr 착수 (2026-07-25).
>
> **Implemented — 2026-07-25**: Phase 1~4-c 전 phase 완결 (execute-adr, 같은 날). Phase 1 dead 블록 제거 + `panel-system.static.test.ts` + `.claude/rules/panel-structure.md` 신설 / Phase 2~3 root `.panel` 병기 6패널 (diff 0) / Phase 4-a `.section-divider` 예약 prefix 회수 / Phase 4-b `--inspector-row-columns` 토큰 single-source (9회 재선언 → 1) / Phase 4-c `tab-*` 8종 70곳 회수 + TagEditor invalid HTML 교정 + Tailwind 인라인 전량 제거 + datatable squat 전량 회수 + `reservedPrefix.static.test.ts`.
>
> **실측 정정 5건** (전부 §0 census miscount — Phase 0 inventory 부실이며 scope 변경 아님, adr-writing.md M3 로 각 phase 안 흡수): `panel-tabs` 4중 정의 → 단일 정의 / `.iconButton` 5중 정의 → base 0 + context override 5 / `.empty-state` 2중 → `EmptyState` 컴포넌트 단일 소스 / settings·monitor → scope 밖·예외 / row 래퍼 5종 → 8개 + pattern-A. 그 결과 "중복 정의 통합" 은 Consequences 원안보다 작고, 실제 산출은 **예약 prefix 정본 회수 + 토큰 single-source + 정적 가드 2개** 다 (§Consequences 정정 참조).

## Context

빌더 좌우 패널 13종의 UI 구조가 패널마다 상이하다. 사용자 지정 위계 (2026-07-24): **Properties/Styles 패널이 레퍼런스**, Components/DataTable/DataTableEditor 는 추종 대상, **Nodes 는 예외**, 나머지는 미완으로 레퍼런스를 따라간다. **Events 패널 내부는 보류** (사용자 결정 2026-07-24: 전면 재구성 대기 — field 시스템 포함 대상 외, design §6).

실측 결과 (상세 현황표: design §0) 세 층위의 문제가 확인됐다:

1. **표준 시각 정본이 dead**: `apps/builder/src/builder/components/styles/panel-system.css` 360~480행 — "styles/properties 패널 전용" 주석이 달린 블록이 `.section`(39행) 안에 `.panel-wrapper[data-panel=…]` 를 중첩해, 계산 선택자의 조상-자손 순서가 실제 DOM 과 반대가 되어 **영구 무매칭**. `.properties-aria`/`.fieldset-legend`/`.component-fieldset`/`.layout-direction` 등 표준 필드 그룹 스타일 전량이 한 번도 적용된 적 없고, 현행 시각은 top-level live 규칙(27행) + `inspector-layout.css` + 브라우저 기본값의 우연 조합이다. 이 간극은 "중복이니 삭제" 오판을 유발한다 (2026-07-24 실제 회귀 1회 발생 후 복원).
2. **중복 class 정의 + 경쟁 체계**: `.panel-tabs` 4개 파일, `.iconButton` 5개 파일, `.empty-state` 2개 파일에서 반복 정의. 패널 root 클래스 6종 이탈 (`.themes-panel`/`.panel-settings` 어순 역전 포함). 같은 역할에 다른 클래스 체계가 병존 — 버튼 3계열 (`.iconButton`/`.control-button` — 정의처가 패널 밖 `Workspace.css`/`ActionIconButton`), 탭 3계열, 섹션 내 row 배치 3패턴 (래퍼 이름 5종 + 인스펙터 3열 grid 템플릿 9회 재선언, design §0). 중복 정의는 특이성 동률 + import 순서 의존 오버라이드 체인을 만든다 (`inspector-layout.css:249` "panel-system.css의 .fieldset-actions 리셋" 주석이 실증).
3. **표준의 명문화 부재**: 공용 부품(`Section`/`PanelHeader`)은 존재하나 어느 패널이 무엇을 따라야 하는지 규칙 파일이 없어, 신규 패널마다 독자 구조가 재생산된다 (Monitor/AI/Events 등). 네이밍/상관관계도 미규정 — camelCase 이탈, 접두 없는 bare modifier, `properties-aria` 를 `<div>`+`<legend>` 로 쓴 invalid HTML (`TagEditor.tsx:56,217`), Tailwind 인라인 잔존 6파일 (기존 CRITICAL 규칙 위반) 이 방치돼 있다 (design §0 census: 패널 영역 고유 클래스 970종).

**SSOT 3-domain 판정**: 본 ADR 은 빌더 시스템 UI (builder-system layer) 대상 — 사용자 캔버스 컴포넌트의 D1/D2/D3 SSOT 체인 비관여. catalog/spec/Generator 확장 없음 (Generator 자식 selector emit 질문 해당 없음).

**Hard Constraints**:

1. **시각 회귀 0** — 사용자 결정 (2026-07-24): dead CSS 복구는 "현행 시각 유지" 방향. 복구 전후 computed style diff 0 을 게이트로 측정.
2. 기존 테스트 green 유지 (`ComponentSemanticsSection.test.tsx` 18건 등) + `pnpm type-check` PASS.
3. Nodes 패널은 예외 — 구조 변경 금지 (사용자 확정).
4. BC 없음 — 빌더 내부 UI 로 사용자 프로젝트 데이터/스키마 무영향 (재직렬화 0 파일, 사용자 영향 0%).

**Soft Constraints**:

- 패널 13종 마이그레이션은 phase 분할 — 각 phase 종료 시 커밋 가능 상태 (CLAUDE.md 대규모 작업 원칙).
- `data-panel` id 는 panelConfigs/persist key 로 쓰여 rename 회피.

## Alternatives Considered

### 대안 A: 국소 정리 — dead 블록 삭제 + 메모리 기록만

- 설명: 죽은 360~480행을 제거하고 현행 live 규칙을 사실상 정본으로 인정. 패널 구조는 손대지 않음.
- 근거: dead code 제거는 최소 비용. 이번 세션 메모리 2건이 이미 함정을 기록.
- 위험:
  - 기술: L — 삭제만이라 즉시 안전
  - 성능: L — 변화 없음
  - 유지보수: H — 표준 부재 지속: 신규 패널 독자 구조 재생산, 중복 정의 5중첩 방치, 레퍼런스-미완 격차 고착
  - 마이그레이션: L — 없음

### 대안 B: 표준 정의 + 전 패널 단계적 정렬 (레퍼런스 기반)

- 설명: (1) Properties/Styles 실측 구조를 표준으로 명문화 (`.claude/rules/panel-structure.md`), (2) dead CSS 를 현행 시각 유지 값으로 top-level 복구 + 정적 가드 테스트, (3) 추종 → 미완 순 tier 별 phase 마이그레이션, (4) 중복 class 통합. 예외(Nodes, Monitor 판정) 명문화.
- 근거: 업계 패널 UI 표준화 패턴 — VSCode Webview UI Toolkit / Figma 플러그인 패널이 구조 primitive(panel/section/field-group) 고정 + 콘텐츠만 자유를 채택. 본 프로젝트 ITCSS 레이어링 (ADR-002) 과 정합 — 구조 정본을 한 파일(panel-system.css) top-level 로 모으고 패널 CSS 는 고유 클래스만. CSS 중첩 함정(`&` 없는 중첩 = descendant)은 CSS Nesting 명세 확정 동작이라 정적 가드로 기계 차단 가능 (기존 `historyActions.static.test.ts` 패턴 재사용).
- 위험:
  - 기술: L — 신기술 없음, 구조 이동 + 클래스 치환
  - 성능: L — 중복 규칙/오버라이드 체인 감소로 스타일시트 축소 방향. 단 CSS 매칭 비용은 원래 미미 — 주 이득은 예측 가능성이며 성능 향상을 주장하지 않음
  - 유지보수: L — 규칙 파일 + 정적 가드로 재발 차단, 이후 신규 패널 비용 감소
  - 마이그레이션: M — 패널 11종 순차 수정 중 시각 회귀 가능성. phase 당 라이브 확인 + computed diff 게이트로 완화

### 대안 C: CSS 전면 재설계 (빅뱅 — tv()/CSS Modules 재작성)

- 설명: 패널 CSS 전체를 컴포넌트 단위 tv() 또는 CSS Modules 로 재작성하고 전 패널을 동시 전환.
- 근거: tailwind-variants 는 프로젝트 표준 스타일링 (ADR-002). 신규 코드라면 자연스러운 선택.
- 위험:
  - 기술: M — 8,800+ 줄 CSS 의 일괄 치환, builder-system 토큰 체계와 이중 전환
  - 성능: L — 결과 동등
  - 유지보수: M — 전환기 이중 체계 장기 공존
  - 마이그레이션: C — 빅뱅 전환은 시각 회귀 검증 표면이 전 패널 동시 — 실패 시 롤백 단위가 전체. ADR-144 사례 (34 commit revert) 재연 위험

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |    H     |      L       |     1      |
| B    |  L   |  L   |    L     |      M       |     0      |
| C    |  M   |  L   |    M     |      C       |   1 (C)    |

루프 판정: 대안 B 가 HIGH+ 0 으로 통과 — 추가 대안 루프 불요. (HIGH threshold 미초과이므로 Phase 별도 ADR 분리 질문도 비해당 — 단일 ADR 내 phase 로 충분.)

## Decision

**대안 B: 표준 정의 + 전 패널 단계적 정렬**을 선택한다.

선택 근거:

1. 잔존 위험이 마이그레이션 M 단 하나이며, phase 당 커밋 + 라이브 확인 + computed diff 0 게이트로 회귀 반경을 패널 1개로 국한할 수 있다.
2. 사용자 요구 4축 (중복 축소 / 오버라이드 정리 / 모듈화 / 세부 표준화) 을 모두 충족하는 유일한 대안 — A 는 앞의 3축을 방치, C 는 표준화를 달성하나 위험이 불수용.
3. dead CSS 의 "현행 시각 유지" 복구는 지금 렌더를 명시적 정본으로 승격 — 코드-렌더 간극 자체를 소멸시켜 동일 문제 재제기를 구조적으로 차단한다 (정적 가드 병행).

기각 사유:

- **대안 A 기각**: 유지보수 H — 표준 부재가 문제의 근원인데 그것을 존치. 중복 5중 정의와 신규 패널 독자 구조 재생산이 계속된다.
- **대안 C 기각**: 마이그레이션 CRITICAL — 빅뱅 전환의 롤백 단위가 전체. 단계 전환(B)이 동일 종착지를 위험 분산으로 도달한다.

> 구현 상세: [163-builder-panel-structure-standardization-breakdown.md](../design/163-builder-panel-structure-standardization-breakdown.md)

## Risks

| ID  | 위험                                                                              | 심각도 | 대응                                                                                                                                 |
| --- | --------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | dead CSS 복구 시 "현행 시각 유지" 판정 누락 선언이 시각 변화 유발                 |  MED   | Phase 1 을 스냅샷 → 선언별 판정표 → 복구 → 재스냅샷 diff 0 순서로 고정 (G1). Styles 패널은 Activity hidden 이라 **패널을 열어** 실측 |
| R2  | phase 중단 시 표준/비표준 패널 이중 공존 장기화                                   |  MED   | phase 당 독립 커밋 + design §7 체크리스트로 잔여 추적. 공존 자체는 기능 무해 (구조 클래스는 additive)                                |
| R3  | `.section` 중첩 dead 패턴 재발 (신규 CSS 작성 시)                                 |  MED   | `panel-system.static.test.ts` 정적 가드 (G2) + `.claude/rules/panel-structure.md` glob 자동 로드                                     |
| R4  | 중복 class 통합(`.iconButton` 5중) 시 파일별 값 차이가 의도된 오버라이드일 가능성 |  LOW   | 통합 전 정의별 diff 대조 — 값 상이 시 의도 판정 후 병합 (design §5 4-a)                                                              |
| R5  | `.fieldset-row` 통합 (패턴 A→B 전환 포함) 시 grid 재배치로 시각 회귀              |  MED   | Phase 4-b 를 G1 방식 computed 스냅샷 diff 재사용 + G4 라이브 확인으로 게이트 (design §5 4-b)                                         |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점                     | 통과 조건                                                                                                                                                                                                  | 실패 시 대안                                                     |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| G1   | Phase 1 완료 시          | properties/styles(패널 열어 실측)/theme 패널 computed style 재스냅샷 diff 0                                                                                                                                | 판정표로 회귀 선언 역추적 → 해당 선언만 현행값 대체 후 재측정    |
| G2   | Phase 1 이후 상시        | `panel-system.static.test.ts` — `.section` 블록 내 `.panel-wrapper` 중첩 선택자 0건                                                                                                                        | 위반 선택자를 top-level 로 이동                                  |
| G3   | 매 phase 커밋 전         | `pnpm type-check` PASS + 관련 vitest green                                                                                                                                                                 | 수정 전 커밋 금지                                                |
| G4   | 패널별 마이그레이션 직후 | 해당 패널 Chrome MCP 라이브 확인 (렌더 + 주요 인터랙션 1회 exercise). Phase 2/3 구조 정렬로 **의도된 시각 변화는 커밋 메시지에 항목화**하고, 항목화되지 않은 변화는 0 (Phase 1 의 diff 0 과 구분되는 기준) | 즉시 rollback 후 원인 격리 — CLAUDE.md live behavior 게이트 정합 |

## Consequences

### Positive

> **실측 정정 (2026-07-25 종결 시점)**: 아래 3번 항목의 "중복 정의 축소" 는 §0 census miscount 에 근거했다. 실측 결과 `.panel-tabs`(단일 정의) / `.iconButton`(base 0 + 정당한 context override 5) / `.empty-state`(`EmptyState` 컴포넌트가 이미 단일 소스) 는 **통합 대상 실체가 없었고**, row 래퍼도 5종이 아니라 8개 + pattern-A 였다. 실제 달성분은 정정본으로 대체한다.

- 표준 구조가 코드(`panel-system.css` top-level)와 규칙(`.claude/rules/panel-structure.md`)의 이중 정본으로 실체화 — "쓰여 있으나 적용 안 되는 CSS" 간극 소멸.
- 신규 패널 작성 비용 감소: `Section`/`PanelHeader` + 예약 구조 클래스 조합으로 시작.
- **예약 prefix 정본 회수**: `.section-divider`(→ panel-system.css 승격) / `.panel-tabs`·`.panel-tab`·`.panel-selection`·`.panel-option`·`.section-tabs`·`.section-tab`·`.section-header*`(→ 도메인 접두 rename) / `tab-*` 8종 70곳(→ `editor-*`). 구조 클래스와 경쟁하던 로컬 정의 소멸.
- **인스펙터 3열 grid 템플릿 9회 재선언 → `--inspector-row-columns` 토큰 1개** (Phase 4-b, diff 0).
- **정적 가드 2개로 재발 기계 차단**: `panel-system.static.test.ts`(dead 중첩) + `reservedPrefix.static.test.ts`(예약 prefix base 정의 — negative control 확증).
- 네이밍/상관관계 계약 명문화 (prefix 예약표 + fieldset/legend 필수 쌍 + state 는 data-attr 우선) — invalid HTML 2곳 + Tailwind 잔존 7파일 해소(패널 영역 grep 0 도달).
- Themes 등 fieldset+legend 를 이미 쓰는 패널이 표준 스타일을 실제로 받게 됨.

### Negative

- 마이그레이션 기간 중 표준/비표준 공존 — design §0 현황표가 추적 기준. **종결 시점 잔여**: nodes(확정 예외) / events(보류, 전면 재구성 대기) / monitor(dev tool 예외) / settings(scope 밖).
- 정적 가드 테스트 ~~1개~~ **2개** 추가 유지 비용 (`panel-system` + `reservedPrefix`).
- `properties-aria` 등 일부 부정확한 네이밍을 예약어로 고정 (rename 기각, design §5-4) — 의미는 규칙 문서로만 보정. `data-panel` id camel/단수 혼재도 동일(persist key BC).
- 인스펙터 8개 row 래퍼는 `.fieldset-row` 로 **소급 통일하지 않았다** (Phase 4-b A방식, 사용자 confirm). `.fieldset-row` 는 신규 패널용 forward-standard 로 문서에만 존재하며, 실제 CSS 정의는 첫 신규-패널 소비자와 함께 도입한다(dormant 금지).

### 후속 (본 ADR scope 밖)

- **`.control-button` 정의 부재**: `className="control-button add|secondary|delete"` 18곳(6파일)에서 `.control-button` 과 modifier 모두 CSS 정의 0건 — live 실측상 GridList 인스펙터 "Add GridListItem" 버튼이 **순수 `<button>` 과 계산값 완전 동일**(bg transparent / padding 0 / cursor default). 18곳 중 5곳이 live(ItemsManager 4 + ChildItemManager 1). 네이밍 위반이 아니라 **스타일 정의 부재**라 "네이밍/규칙 위반 정리"인 Phase 4-c 밖 — 별도 판정 필요.
- **`properties/editors/` dead chain**: 배럴 소비처 0 (live 경로는 `useEditContract` + GenericFieldRenderer). Phase 4-c 가 교정한 파일 다수가 렌더 경로 없음 — 삭제는 사용자 승인 사안이라 미실시, 기록만.
- `components/styles/index.css`(1,169줄 잡화) 분할 — 구조 클래스 무관.
