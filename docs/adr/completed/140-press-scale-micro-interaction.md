# ADR-140: react-aria-starter press-scale micro-interaction 도입

## Status

Implemented — 2026-05-17

Proposed → Implemented (2026-05-17): Codex 리뷰(GO-WITH-FIXES) 4건 반영 + 설계 결정 DD1/DD2/DD3 확정 후 Phase 1~5 구현·검증 완료. `pnpm type-check` baseline 547 무증가, `@composition/specs` 326/326 PASS, CSSGenerator snapshot 20개 갱신. 구현 상세·검증 결과는 [breakdown §2·§4](../design/140-press-scale-micro-interaction-breakdown.md) 참조.

## Context

composition의 D3(시각 스타일) Spec은 Adobe 공식 React Aria starter(`/Users/admin/work/react-aria-starter`, Storybook `localhost:6006`)의 디자인을 참조 원천으로 삼아 ADR-022(S2 하이브리드 토큰)·ADR-036(Spec-First)으로 의도적으로 분기·발전시켜 왔다. 2026-05-17 사용자 지시로 starter 대비 composition이 받아들여야 할 스타일 업데이트를 전수 점검(체크/설계 문서: `docs/reference/audits/2026-05-17-rac-starter-style-update-*.md`)한 결과, **starter에 있고 composition이 일관되게 결여한 유일한 디자인 언어**는 **press-scale micro-interaction** — `[data-pressed]` 시 요소를 `scale: 0.9~0.98`로 축소하는 촉각 눌림 피드백 — 으로 확인됐다.

starter는 이를 Button·ToggleButton·ToggleButtonGroup·Calendar/RangeCalendar 셀·GridList 항목·Disclosure 헤더·Tag·Form 버튼·Switch thumb 등 다수 컴포넌트에 일관 적용하나, composition은 generated CSS·수동 CSS·spec 전부 0건이다. 본 ADR은 이 단일 디자인 언어를 composition Spec D3 SSOT 경유로 도입하는 결정이다. (도입 대상·제외 대상의 정확한 분류는 breakdown §1 참조 — ToggleButtonGroup·Form 버튼은 자식 Button/ToggleButton의 C1-a로 transitively 커버된다.)

**Domain**: D3(시각 스타일). SSOT는 composition의 Spec. react-aria-starter는 시각 참조 원천이지 D3의 상위 권위가 아니다 — 도입 시에도 composition Spec을 경유해 Builder Skia ↔ Preview/Publish CSS 두 consumer의 시각 대칭을 유지한다 (`ssot-hierarchy.md` D3).

**Hard Constraints**:

1. **D3 대칭** — Builder Skia ↔ Preview/Publish CSS는 동일 Spec source에서 시각 결과 동일성을 산출해야 한다(`ssot-hierarchy.md` D3). Skia `componentState`는 `"default" | "disabled"`만 지원하며(`buildSpecNodeData.ts:1000-1014`, `:1080` 주석), Builder Skia는 hover/pressed를 렌더하지 않는다 → press-scale은 Builder Skia가 표현하지 않는 pressed 상태에만 작용한다. D3 대칭은 default·disabled 상태에서 그대로 유지되며, pressed는 Skia 비표현 상태로서 **Preview/Publish 전용 인터랙션으로 수용**한다 — 대칭 평가 범위 밖의 예외이며 Risks R5로 명시한다.
2. **하위 호환** — 기존 프로젝트 재직렬화 0. spec `states` 추가는 CSS 출력만 변경하며 element/document 데이터 스키마는 무변경.
3. **CSSGenerator snapshot 안정성** — CSSGenerator snapshot test는 press-scale 도입 컴포넌트(Button/ToggleButton/DisclosureHeader)의 generated CSS만 변경하고, 그 외 spec의 generated CSS snapshot은 bit-identical 유지한다. `@composition/specs` 전체 test suite도 통과를 유지한다.
4. **Canvas 60fps** — Skia가 pressed를 미렌더하므로 Canvas 성능 영향 0.

**Soft Constraints**:

- `StateEffect.scale?: number` 필드(`packages/specs/src/types/state.types.ts`)와 CSSGenerator의 `transform: scale()` emit(`CSSGenerator.ts:1033-1034` pressed / `:981-982` hover)이 **이미 존재** — leaf 컴포넌트 press-scale 도입에 신규 spec capability·generator 코드 변경이 불필요하다.
- sub-element(CalendarCell·GridList 항목·Tag)는 부모 spec이 sub-element 단위 `states`를 표현하지 않아 수동 CSS가 시각 스타일을 담당한다. CalendarCell의 pressed 수동 CSS는 Calendar/RangeCalendar 공통 selector를 둔 `CalendarCommon.css`에 있다(부모 Calendar는 generated CSS를 별도로 가지나 CalendarCell 상태 스타일은 수동 CSS 소관).

## Alternatives Considered

### 대안 A: 하이브리드 — leaf는 spec states, sub-element는 수동 CSS

- 설명: root-level 컴포넌트(Button·ToggleButton·DisclosureHeader)는 spec `states.pressed.scale`로 도입(CSSGenerator가 자동 emit). sub-element(Calendar 셀·GridList 항목·Tag·Switch thumb)는 해당 컴포넌트의 기존 수동 CSS 패턴을 따라 수동 CSS에 `[data-pressed] { scale }` 추가.
- 근거: react-aria-starter 자체가 root는 컴포넌트 셀렉터, sub-element는 중첩 셀렉터로 분리해 적용. composition도 leaf=spec / sub-element=수동 CSS의 현 아키텍처 경계와 일치.
- 위험:
  - 기술: L — `StateEffect.scale` + CSSGenerator emit 기존, 수동 CSS는 기존 패턴 답습.
  - 성능: L — CSS 출력만 변경, Skia 무관.
  - 유지보수: M — sub-element press-scale이 수동 CSS에 잔존(ssot debt). 단 해당 컴포넌트는 이미 skipCSSGeneration 수동 CSS 영역이라 debt가 신규 생성이 아닌 기존 영역 내 확장.
  - 마이그레이션: L — 데이터 스키마 무변경, 롤백은 spec/CSS diff 역적용.

### 대안 B: 전수 수동 CSS — 모든 컴포넌트를 수동 CSS override로 도입

- 설명: Button·ToggleButton·DisclosureHeader까지 포함해 모든 press-scale을 수동 CSS에 작성, spec을 경유하지 않음.
- 근거: 모든 press-scale을 한 메커니즘(수동 CSS)으로 통일 — 경로 단일화.
- 위험:
  - 기술: L — CSS 작성만.
  - 성능: L.
  - 유지보수: **H** — leaf 컴포넌트가 보유한 spec capability(`StateEffect.scale`)를 의도적으로 우회. generated CSS와 수동 CSS override가 같은 `[data-pressed]`를 두고 경쟁 → D3 SSOT 분산. skipCSSGeneration 미적용 leaf 컴포넌트에까지 수동 CSS를 신규 도입 = `ssot-hierarchy.md` D3 위반·ADR-059(skipCSSGeneration 해체) 역행.
  - 마이그레이션: L.

### 대안 C: 전수 spec — sub-element도 spec states로 표현

- 설명: CalendarCell·GridListItem·Tag 등 sub-element를 spec 단위로 승격하거나 부모 spec에 sub-element `states` 스키마를 신설, CSSGenerator가 sub-element 중첩 셀렉터 `[data-pressed]`를 emit하도록 확장.
- 근거: 모든 press-scale을 spec D3 SSOT 경유로 통일 — 가장 정합적인 SSOT 구조.
- 위험:
  - 기술: M — sub-element `states` 스키마 + CSSGenerator 중첩 셀렉터 emit 신규.
  - 성능: L.
  - 유지보수: M — CSSGenerator 확장 유지비. sub-element spec 모델 신규 도입.
  - 마이그레이션: M — CalendarCell/GridListItem/Tag는 현재 독립 spec이 없거나 부모에 종속 — sub-element spec 모델은 ADR-059(skipCSSGeneration 해체)와 직교하는 별도 대형 작업. press-scale 도입이라는 좁은 목적에 비해 scope 과대.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |    M     |      L       |     0      |
| B    |  L   |  L   |  **H**   |      L       |     1      |
| C    |  M   |  L   |    M     |      M       |     0      |

루프 판정: 대안 A·C 모두 HIGH+ 0 — 새 대안 추가 불요. 대안 B는 유지보수 HIGH 1건이나 A·C가 이를 회피하므로 B 채택 불가. A와 C 중 마이그레이션·기술 위험이 더 낮은 A 선택.

## Decision

**대안 A: 하이브리드 — leaf는 spec states, sub-element는 수동 CSS**를 선택한다.

선택 근거:

1. **잔존 위험 수용 가능** — A의 유일한 MED는 유지보수(sub-element press-scale의 수동 CSS 잔존). 그러나 CalendarCell·GridList 항목·Tag 같은 sub-element는 부모 spec이 sub-element 단위 `states`를 표현하지 않아 **이미 수동 CSS가 시각 스타일을 담당하는 영역**이다(예: CalendarCell은 `CalendarCommon.css`). press-scale을 그 수동 CSS에 추가하는 것은 신규 debt 생성이 아니라 기존 수동 CSS 영역 내 한 줄 확장이며, ADR-059(skipCSSGeneration 해체)·sub-element spec화가 진행될 때 해당 수동 CSS 전체와 함께 spec화될 대상에 자연 포함된다.
2. **leaf는 기존 capability 활용** — `StateEffect.scale` + CSSGenerator emit이 이미 존재하므로 Button·ToggleButton·DisclosureHeader는 spec `states.pressed.scale` 값 추가만으로 도입 완결 — generator·타입 코드 변경 0.
3. **Skia 작업 0** — Skia는 pressed를 미렌더하므로 D3 대칭 위반이 발생하지 않는다.

기각 사유:

- **대안 B 기각**: leaf 컴포넌트가 보유한 spec capability를 의도적으로 우회해 수동 CSS override를 신규 도입 — D3 SSOT 분산, skipCSSGeneration 미적용 컴포넌트에 수동 CSS 역도입, ADR-059 역행. 유지보수 HIGH.
- **대안 C 기각**: sub-element spec 모델 신설은 press-scale이라는 좁은 목적 대비 scope 과대. CalendarCell/GridListItem/Tag의 spec 승격은 ADR-059와 직교하는 별도 대형 결정으로, 본 ADR에 포함 시 범위 과대 확장.

> 구현 상세: [140-press-scale-micro-interaction-breakdown.md](../design/140-press-scale-micro-interaction-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | sub-element press-scale(C1-b·C2)이 수동 CSS에 잔존 — ssot debt                                                                          |  MED   | 신규 debt 아닌 기존 수동 CSS 영역 내 확장(sub-element는 부모 spec이 `states` 미표현). ADR-059 해체·sub-element spec화 시 해당 수동 CSS와 함께 spec화 대상으로 명시 (breakdown §5).                                                                     |
| R2  | button archetype base transition에 `transform` 추가 시 button archetype 전체(Button/ToggleButton/Link 등)로 파급                        |  LOW   | `transform`을 사용하지 않는 button archetype 컴포넌트는 transition 항목 추가가 무해(no-op). `/cross-check`로 회귀 확인.                                                                                                                                |
| R3  | Button/ToggleButton의 기존 inset-shadow press 피드백 제거(설계 결정 DD1) = 사용자-가시 변경                                             |  MED   | breakdown §1 DD1으로 명시, Phase 0에서 사용자 확정. CHANGELOG Features 반영.                                                                                                                                                                           |
| R4  | CSSGenerator snapshot 변경                                                                                                              |  LOW   | 의도된 3개 CSS(Button/ToggleButton/DisclosureHeader) `[data-pressed]` diff만 — 그 외 snapshot bit-identical 확인.                                                                                                                                      |
| R5  | pressed 상태가 Builder Skia에서 비표현 — press-scale이 Preview/Publish에만 적용되어 D3 symmetric consumer 간 pressed 시각 결과가 불일치 |  LOW   | 의도된 수용. Skia `componentState`가 `default`·`disabled`만 지원하는 현 아키텍처의 결과(`buildSpecNodeData.ts:1000-1014`). default·disabled 대칭은 무영향. Skia가 pressed를 렌더하게 되면 spec `states.pressed.scale`을 Skia 경로도 소비하도록 재평가. |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 불요. MED·LOW 위험의 통과 조건을 검증 체크리스트(breakdown §4)로 관리한다: CSSGenerator snapshot 의도 diff 확인(R4), `/cross-check` 7개 컴포넌트 default·disabled 상태 회귀 없음(R2·R5 — Skia는 pressed를 미표현하므로 default 상태 무변경 = 회귀 없음, pressed는 Preview/Publish 전용 인터랙션으로 수용), DD1 사용자 확정(R3), ADR-059 후속 명시(R1).

## Consequences

### Positive

- react-aria-starter 정합 촉각 눌림 피드백이 Preview/Publish의 7개 컴포넌트에 도입 — 사용자-가시 micro-interaction 품질 향상.
- leaf 3개(Button·ToggleButton·DisclosureHeader)는 spec `states.pressed.scale` 값 추가만으로 도입 — CSSGenerator가 자동 emit, generator/타입 코드 무변경.
- Skia 작업 0 — Canvas 성능·렌더 경로 영향 없음.

### Negative

- sub-element press-scale(Calendar 셀·GridList 항목·Tag·Switch thumb)이 수동 CSS에 작성됨 — D3 SSOT 관점의 잔존 debt(R1). ADR-059 해체 시 정리 대상.
- button archetype base transition 변경이 button archetype 전체에 파급(R2) — transform 미사용 컴포넌트는 무해하나 영향 범위 인지 필요.
- Button/ToggleButton의 기존 inset-shadow press 피드백이 제거될 경우(DD1 결정 시) 기존 시각과 달라짐 — CHANGELOG 반영 대상.
