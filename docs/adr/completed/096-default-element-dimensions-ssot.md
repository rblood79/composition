# ADR-096: ComponentSpec `defaultWidth?/defaultHeight?` Schema 확장 + HTML primitive defaults SSOT (ADR-091-A1)

## Status

Implemented — 2026-04-21

## Context

ADR-091 (Implemented) 은 `utils.ts` + `cssResolver.ts` 의 `Record<string, number>` 12 건 중 10 건을 Spec SSOT 또는 `primitives/` 로 이관하여 해체했다. **잔존 2 건** 이 후속 ADR 로 명시됨:

- **R2**: `utils.ts:461-472` `DEFAULT_ELEMENT_WIDTHS: Record<string, number>` (8 키)
- **R6**: `utils.ts:1428-1468` `DEFAULT_ELEMENT_HEIGHTS: Record<string, number>` (30 키)

두 Record 모두 **tag → px mapping (size 축 무관)** 이라 ADR-086 G4 `specSizeField` 패턴으로는 해체 불가. 해체하려면 **ComponentSpec 최상위 스키마 확장** 이 필요하다.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 대칭 복구**. intrinsic default 치수는 Spec 있는 컴포넌트의 "시각 기본값" 이므로 Spec SSOT 에 속한다. 단 HTML primitive tag (`div`, `p`, `li` 등) 는 ComponentSpec 이 없으므로 `packages/specs/src/primitives/` 로 이관 (ADR-091 Phase 1 Class C `FONT_STRETCH_KEYWORD_MAP` 선례 재사용).

### 실측 — Record 키 분류

**DEFAULT_ELEMENT_WIDTHS (`utils.ts:461-472`, 8 키)**:

| Spec 있음 (4)               | HTML primitive (4)      |
| --------------------------- | ----------------------- |
| input/select/textarea/image | img/video/canvas/iframe |

**DEFAULT_ELEMENT_HEIGHTS (`utils.ts:1428-1468`, 30 키)**:

| Spec 있음 (4)                | HTML primitive (26)                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| button/select/textarea/image | p/span/h1~h6/div/section/article/header/footer/nav/aside/main/img/video/canvas/ul/ol/li/table/tr/td/th |

**총 5 spec 이관 대상** (Button / Input / Select / TextArea / Image). "62 spec 감사" 초기 추정은 실측 후 **5 spec** 으로 축소.

**HTML primitive 이관 대상**: 총 26 tag → `primitives/elementDefaults.ts` 신설.

### Hard Constraints

1. **BC 영향 0%** — Record 값 변경 없이 1:1 이관. 저장된 프로젝트 데이터는 `width`/`height` 명시 style 을 포함하므로 default 경로 진입 시에만 영향. 기존 tag → px 값 불변 = 렌더 결과 diff 0.
2. **재직렬화 파일 수 0** — Spec 필드가 optional, 저장 포맷 무관.
3. **테스트 기준선 유지** — type-check 3/3 + specs 166/166 + builder 227/227 PASS.
4. **Record 카운트 최종 0** — `rg "Record<string, number>" apps/builder/src/builder/workspace/canvas/layout/engines/{utils,cssResolver}.ts` 결과 0 건.
5. **Generator 영향 0** — `defaultWidth`/`defaultHeight` 는 CSS Generator emit 대상 외 (layout runtime fallback 전용). `packages/specs/src/renderers/CSSGenerator.ts` 변경 불필요.

### Soft Constraints

- ADR-091 Addendum 2 `SizeSpec.intrinsicHeight?` 선례 대비 **Spec 최상위 필드 추가** (size-indexed 아님) — 스키마 레벨 결정 차이 있음
- `LOWERCASE_TAG_SPEC_MAP` 은 `implicitStyles.ts:96` local. 소비처 (`utils.ts`) 에서 재사용하려면 hoist 필요 (ADR-083 Phase 0 선례 확장)

### 소비 코드 경로 (grep 가능 인용 — 반복 패턴 체크 #1)

- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:461` — `DEFAULT_ELEMENT_WIDTHS` 선언
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1410` — `const defaultWidth = DEFAULT_ELEMENT_WIDTHS[tag]` 소비
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1428` — `DEFAULT_ELEMENT_HEIGHTS` 선언
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:2635` — `const defaultHeight = DEFAULT_ELEMENT_HEIGHTS[tag]` 소비
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:96` — `LOWERCASE_TAG_SPEC_MAP` (재사용 또는 hoist 대상)

## Alternatives Considered

### 대안 A: 하이브리드 — `ComponentSpec.defaultWidth?/defaultHeight?` + `primitives/elementDefaults.ts` (선정)

- 설명: ComponentSpec 최상위 optional 필드 신설 + Spec 있는 5 tag 1:1 이관. HTML primitive 26 tag 는 `packages/specs/src/primitives/elementDefaults.ts` 2 Record 로 이동 (ADR-091 Phase 1 Class C 선례). utils.ts Record 2 건 삭제. 소비처 lookup 체인: `spec.defaultW/H → elementDefaults → DEFAULT_WIDTH(80)/estimateTextHeight()`.
- 근거: ADR-091 Phase 1 Class C + Phase 3 Class A 선례 결합. D3 판정 기준 — Spec 있는 컴포넌트의 기본값은 Spec SSOT, 없는 HTML primitive 는 primitives/.
- 위험:
  - 기술: **LOW** — ADR-091 패턴 2 가지 재사용. Schema 확장은 optional 필드 (기존 spec 영향 0). 소비처 전환 2 곳만.
  - 성능: LOW — lookup 체인 1 단계 추가 (spec map get + optional field access) = runtime overhead 무시 가능.
  - 유지보수: LOW — D3 SSOT 복귀로 debt 청산. 향후 spec 추가 시 자연스럽게 필드 선언 가능.
  - 마이그레이션: LOW — Record 값 1:1 이관, BC 영향 0, 저장 데이터 무관.

### 대안 B: ComponentSpec 확장만 (HTML primitive 는 Record 축소 유지)

- 설명: ComponentSpec.defaultWidth?/Height? 신설. 5 spec 이관. DEFAULT_ELEMENT_HEIGHTS/WIDTHS 는 축소되지만 HTML primitive 만 남은 Record 형태로 utils.ts 에 잔존.
- 근거: 최소 변경 범위.
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — "Record 0 건 달성" 목표 미달성, `utils.ts` 내 SSOT 위반 debt 26 키 영구화. D3 primitives 분리 일관성 훼손 (ADR-091 Phase 1 Class C 와 패턴 불일치).
  - 마이그레이션: LOW

### 대안 C: `primitives/elementDefaults.ts` 만 (Schema 확장 없음)

- 설명: Spec 확장 없이 두 Record 를 통째로 `packages/specs/src/primitives/elementDefaults.ts` 로 이동. utils.ts 에서 import.
- 근거: Schema 변경 없이 위치만 이동.
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — Spec 있는 태그 (button/input/select/textarea/image) 의 기본값이 Spec 외부에 존재 → D3 SSOT 위반. 향후 Button 의 기본 높이를 바꾸려면 Spec 외 primitives 수정 필요 = discoverability 훼손.
  - 마이그레이션: LOW

### 대안 D: 현 상태 유지

- 설명: Record 2 건 잔존 (ADR-091 완결 Record 3건 중 R2/R6 2건).
- 근거: scope 축소.
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — ADR-086 G4 "Record 0 건 달성" 목표 영구 미달성. ADR-091 후속 Addendum 명시 debt 방치.
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                                | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                              |
| ----------------------------------- | :--: | :--: | :------: | :----------: | :------: | --------------------------------- |
| A: 하이브리드 (Schema + primitives) |  L   |  L   |    L     |      L       |    0     | **PASS**                          |
| B: Schema 만 (Record 26 키 잔존)    |  L   |  L   |    M     |      L       |    0     | PASS (debt 잔존)                  |
| C: primitives 만 (Schema 미확장)    |  L   |  L   |    M     |      L       |    0     | PASS (SSOT 위반 지속)             |
| D: 현 상태                          |  L   |  L   |    H     |      L       |    1     | 루프 필요 → 대안 A 가 위험 회피안 |

대안 A 가 HIGH+ 0 + SSOT 원칙 100% 준수 — threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~3):

- ✅ **#1 코드 경로 인용**: Context "소비 코드 경로" 섹션에 5 개 파일/라인 grep 가능 경로 명시 (utils.ts:461/1410/1428/2635 + implicitStyles.ts:96)
- ✅ **#2 Generator 확장 여부**: "Hard Constraint 5" — `defaultWidth/Height` 는 CSSGenerator emit 대상 외 (runtime fallback 전용), Generator 변경 불필요 명시
- ✅ **#3 BC 훼손 수식화**: "Hard Constraint 1" + breakdown "BC 영향 수식화" — **저장 프로젝트 0% 영향 / 재직렬화 파일 0 건 / 렌더 diff 0** 실측 수치
- ✅ **#4 Phase 분리 가능성**: 4 Phase 구성 (Schema / Primitives / Spec 이관 / 소비처 전환). HIGH 위험 부재로 추가 분리 불필요

## Decision

**대안 A (하이브리드) 채택**. 4 Phase 순차 해체.

선택 근거:

1. D3 SSOT 원칙 완전 준수 — Spec 있는 컴포넌트의 기본값은 ComponentSpec 에, HTML primitive 는 `packages/specs/src/primitives/`.
2. BC 영향 0% 실측 — Record 값 1:1 이관, 저장 데이터 무관.
3. ADR-091 Phase 1 Class C (primitives 분리) + Phase 3 Class A (spec.sizes 이관) 양 패턴 재사용. 신규 인프라 없음.
4. Record 카운트 2 → 0 = ADR-086 G4 완결.

기각 사유:

- **대안 B 기각**: HTML primitive 26 키 Record 잔존으로 "Record 0 건" 목표 미달성. D3 primitives 분리 일관성 훼손 (ADR-091 Phase 1 과 패턴 불일치).
- **대안 C 기각**: Spec 있는 5 컴포넌트의 기본값이 Spec 외부에 산재 → D3 SSOT 위반 + discoverability 훼손.
- **대안 D 기각**: debt 영구화, ADR-091 후속 Addendum 명시 목표 방치.

> 구현 상세: [096-default-element-dimensions-ssot-breakdown.md](../../adr/design/096-default-element-dimensions-ssot-breakdown.md)

## Risks

| ID  | 위험                                                                                                           | 심각도 | 대응                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------- |
| R1  | `LOWERCASE_TAG_SPEC_MAP` 이 `implicitStyles.ts` local → `utils.ts` 에서 재사용 불가                            |  LOW   | Phase 4 에서 `engines/tagSpecLookup.ts` 공통 모듈로 hoist 또는 `packages/specs` 에 export. ADR-083 Phase 0 선례     |
| R2  | `img` 가 DEFAULT_ELEMENT_WIDTHS/HEIGHTS 양쪽에 존재하지만 값 다름 (width 150 / height 150 vs 200 — 이미지 200) |  LOW   | breakdown 실측 표 참조. 1:1 이관 시 값 불변 (primitives.widths.img = 150, primitives.heights.img = 150)             |
| R3  | Spec 이관 후 Style Panel 에서 새 필드 편집 UI 노출 기대 ↔ 실제 미노출                                          |  LOW   | `defaultWidth/Height` 는 layout engine fallback 전용 — Style Panel 편집 대상 아님. ADR 본문 "Generator 영향 0" 명시 |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 검증 기준 (breakdown Phase 4.5):

- Phase 1 완료 후: type-check 3/3 PASS (Schema 변경만)
- Phase 2 완료 후: specs 166/166 PASS (primitives 신설)
- Phase 3 완료 후: specs 166/166 PASS (5 spec 이관, snapshot 변동 없음 예상)
- Phase 4 완료 후:
  - type-check 3/3 PASS
  - specs 166/166 PASS
  - builder 227/227 PASS
  - `rg "Record<string, number>" apps/builder/src/builder/workspace/canvas/layout/engines/{utils,cssResolver}.ts` = **0 건**
  - ADR-086 G4 완결 (implicitStyles + utils + cssResolver 3 파일 Record 0)

## 구현 결과 (2026-04-21)

4 Phase 순차 land. 커밋 체인 4건:

- **Phase 1-2** (`a5489f5a`): `ComponentSpec.defaultWidth?/defaultHeight?` Schema 확장 (spec.types.ts +27 JSDoc) + `packages/specs/src/primitives/elementDefaults.ts` 신설 (`HTML_PRIMITIVE_DEFAULT_WIDTHS` 4 키 / `HTML_PRIMITIVE_DEFAULT_HEIGHTS` 26 키) + primitives/index + src/index re-export.
- **Phase 3** (`824db5d9`): 5 spec 1:1 값 이관 — Button(h=36) / Input(w=180) / Select(w=150,h=36) / TextArea(w=200,h=80) / Image(w=280,h=200). Record 값 불변 = BC 영향 0 / 저장 데이터 재직렬화 0 / snapshot 변동 0.
- **Phase 4** (`4a0b7f86`): `utils.ts:461/1428` `DEFAULT_ELEMENT_WIDTHS/HEIGHTS` Record 2 건 완전 삭제 + `LOWERCASE_TAG_SPEC_MAP` 을 `engines/tagSpecLookup.ts` 신규 공유 모듈로 hoist (implicitStyles → utils 순환 의존 회피). getIntrinsicWidth/Height lookup 체인: `spec.defaultW/H → HTML_PRIMITIVE_DEFAULT_W/H → DEFAULT_WIDTH(80) | estimateTextHeight()`.

**실측**:

- `rg "Record<string, number>" apps/builder/src/builder/workspace/canvas/layout/engines/{utils,cssResolver}.ts` = **0 건**
- **ADR-086 G4 완결** — utils.ts + cssResolver.ts + implicitStyles.ts 3 파일 `Record<string, number>` 0 건 달성
- type-check 3/3 PASS × 4 회
- specs 166/166 PASS × 3 회 (snapshot 변동 0)
- builder 227/227 PASS × 1 회 (Phase 4 종결)

**Chrome MCP 검증**: code-level 검증으로 충분 (Record 값 1:1 이관, 렌더 결과 diff 0 수학적 확증). ADR-092/093/095 선례 동일 원칙.

## Consequences

### Positive

- **ADR-086 G4 완결**: `utils.ts` + `cssResolver.ts` + `implicitStyles.ts` 3 파일 `Record<string, number>` 0 건 달성
- **D3 SSOT 일관성**: Spec 있는 컴포넌트의 기본값 전부 ComponentSpec 내부, HTML primitive 는 `packages/specs/src/primitives/`
- **향후 확장성**: 신규 spec 추가 시 자연스럽게 `defaultWidth/Height` 필드 선언 (Button/Input 선례)
- **Discoverability**: Spec 편집자가 컴포넌트 기본값을 Spec 파일 한 곳에서 확인 가능
- **ADR-091 Addendum 1 해소**: 잔존 debt 2건 정식 처리

### Negative

- **ComponentSpec 스키마 확장**: 최상위 필드 2 개 추가 → 다른 구현자가 "언제 사용해야 하는가" 가이드 필요 (JSDoc 명시로 완화)
- **lookup 체인 1 단계 추가**: `spec.defaultW → primitives → 하드코딩 fallback` 3 단계 — 가독성 vs 유연성 trade-off
- **ADR-091 Addendum 이관 완료 아님**: `SizeSpec.intrinsicHeight?` (ADR-091 Addendum 2) 와 필드 철학 차이 — 후자는 size-indexed, 본 ADR 은 spec-level. 향후 두 축의 의미 혼동 가능성 (JSDoc 에서 역할 구분 명시 필요)

## 참조

- [ADR-091](091-utils-record-dissolution.md) — 본 ADR 의 선행, Addendum 1 명시 ("ComponentSpec.defaultWidth/Height Schema 확장 + R2/R6 해체 별도 세션 권장")
- [ADR-086](086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md) — G4 Record 0 건 목표 + `specSizeField` 헬퍼 선례
- [ADR-088](088-sizespec-columngap-slider-col-gap-dissolution.md) — `SizeSpec` optional 필드 확장 선례
- [ADR-083](083-archetype-base-styles-lifting.md) — `LOWERCASE_TAG_SPEC_MAP` Phase 0 인프라 + hoist 선례
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 symmetric consumer 정본
