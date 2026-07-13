# ADR-095: Propagation schema 확장 — 자식 Element style 주입 rule

## Status

Implemented — 2026-04-21

## Context

composition SSOT 체인 ([ADR-063](063-ssot-chain-charter.md)) 은 D3 시각 스타일의 Spec SSOT 복귀를 진행 중. ADR-092 (Card slot) 완료 후 2 implicitStyles 분기(CardHeader → Heading `flex:1` / CardContent → Description `width:"100%"`) 가 "자식 Element style mutation" 형태로 잔존. ADR-092 Phase 5 에서 **"자식 Element mutation 이라 spec 커버 불가"** 명시 + ADR-092-A1 후속 언급.

### 실측 — 자식 style mutation 분기 (scope 식별)

**`apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`**:

| 위치         | 부모        | 자식 tag    | 조건                           | 주입                   | 해체 가능성            |
| ------------ | ----------- | ----------- | ------------------------------ | ---------------------- | ---------------------- |
| `:1843-1856` | cardheader  | Heading     | `!flex && !flexGrow && !width` | `flex: 1`              | 본 ADR scope           |
| `:1859-1872` | cardcontent | Description | `!width && !flex`              | `width: "100%"`        | 본 ADR scope           |
| `:566-582`   | taglist     | Tag         | `!whiteSpace`                  | `whiteSpace: "nowrap"` | 본 ADR scope 여부 판단 |

잔존 ~8 분기 (Checkbox/Radio/Switch indicator marginLeft 등) 는 **runtime 계산값** (size-based) 라 본 ADR scope 외 — 후속 ADR 에서 별도 검토.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. 자식 style 이 implicitStyles runtime 분기에 분산 → propagation schema 확장으로 부모 spec 선언으로 이관. Preview (DOM+CSS) 는 RSP 기반이라 자식 style 을 RAC 가 자동 처리하지만, Builder (Skia/Taffy) 는 implicitStyles 분기 없으면 대칭 실패. 본 ADR 은 **대칭 복구 인프라** — 후속 ADR 이 본 rule 로 다른 분기 해체 가능.

### Hard Constraints

1. **기존 `PropagationRule` 계약 유지** — 기존 `parentProp/childPath/override` size 전파 rule 영향 0 (union type 확장 또는 optional 필드 추가)
2. **자식 사용자 style 우선 보존** — 기존 implicitStyles 분기는 `cs.flex === undefined && !cs.width` 같은 조건부 주입. 본 rule 도 `skipIfSet` 개념으로 사용자 값 보존
3. **저장 데이터 호환** — 기존 CardHeader/CardContent 자식 Element 의 `props.style` 에 이미 `flex:1` / `width:"100%"` 가 있다면 rule 주입 skip (override 금지)
4. **소비 지점 단일화** — propagation rule 처리는 `apps/builder/src/builder/stores/.../propagation` 경로 또는 `implicitStyles` 전처리 단계에 single 소비처. 중복 주입 방지
5. `pnpm type-check` 3/3 + specs 166/166 + builder 227/227 PASS
6. **Phase 3 Gate**: `rg "containerTag === \"cardheader\"" implicitStyles.ts` = 0 건 + `rg "containerTag === \"cardcontent\"" implicitStyles.ts` = 0 건

### Soft Constraints

- TagList → Tag `whiteSpace:"nowrap"` 주입은 동일 패턴 — scope 포함 검토 (단 TagList 분기는 maxRows 등 runtime 로직도 혼재 → scope 외 권장)
- 후속 ADR 이 동일 rule 로 다른 분기 (DateField, Breadcrumbs 등) 해체 가능 — rule 일반성 확보

## Alternatives Considered

### 대안 A: `PropagationRule` union type 확장 — `style` rule 추가 (선정)

- 설명: 기존 `PropagationRule` (size prop 전파) 에 styleProp/styleValue/skipIfSet 를 가진 variant 추가. 부모 spec 의 `propagation.rules` 배열에 혼재 선언 가능
- 근거: 기존 schema 재사용, consumer 는 rule type 분기만 추가. Card.spec 에 `{ childPath: "Heading", styleProp: "flex", styleValue: 1, skipIfSet: [...] }` 같은 rule 선언으로 implicitStyles 분기 해체
- 위험:
  - 기술: LOW — TypeScript union type + discriminated union 으로 타입 안전 확보
  - 성능: LOW — propagation 처리 단일 패스에 rule type 분기 1회 추가
  - 유지보수: LOW — 중앙 집중 (spec SSOT), 분기 선언으로 가독성 높음
  - 마이그레이션: LOW — 기존 size 전파 rule 무영향, 신규 rule 은 optional

### 대안 B: 새 최상위 spec 필드 `childStyleInjection: ChildStyleRule[]` 분리

- 설명: propagation 과 독립된 배열. rule 종류 명확히 분리
- 근거: "size 전파" vs "style 주입" 의미 분리
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MED** — spec 필드 2개로 분산 → 새 ADR 마다 어느 쪽 써야 할지 판단 필요 (DRY 위반 우려)
  - 마이그레이션: LOW

### 대안 C: 현상 유지 — implicitStyles 분기 잔존

- 설명: Card 2 분기 유지, 다른 유사 분기도 runtime 로직으로 계속 추가
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — debt 영구화. ADR-092 Phase 5 명시 후속 작업 누락
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안               | HIGH+ 수 | 판정                   |
| ------------------ | :------: | ---------------------- |
| A: union type 확장 |    0     | PASS                   |
| B: 새 필드 분리    |    0     | (DRY 위반 우려 → 기각) |
| C: 현상 유지       |    1     | (debt 영구화 → 기각)   |

대안 A — HIGH+ 0. threshold pass.

## Decision

**대안 A 채택**. `PropagationRule` 을 union type 으로 확장. `size` 전파 rule 과 `style` 주입 rule 두 variant 공존.

### Phase 구성

- **Phase 1 — Schema 확장**: `PropagationRule` union type 변경 + `StylePropagationRule` interface 신설.

  ```ts
  // 기존 (SizePropagationRule)
  { parentProp: "size", childPath: "CardHeader", override?: true }

  // 신규 (StylePropagationRule)
  {
    type: "style",
    childPath: "Heading",           // 자식 tag (string) or 경로 (string[])
    styleProp: "flex",              // 주입할 style 필드명
    styleValue: 1,                  // 주입할 값
    skipIfSet?: ["flex", "flexGrow", "width"]  // 이들이 설정돼 있으면 skip
  }
  ```

  기존 rule 은 `type?: "size"` default 로 판정. 타입 안전: discriminated union.

- **Phase 2 — Card spec 에 style rule 적용**: `Card.spec.ts` 의 `propagation.rules` 에 2 rule 추가
  - CardHeader 자식 Heading flex:1
  - CardContent 자식 Description width:"100%"

  **주의**: propagation rule 은 부모 spec 에 선언. 즉 Card.spec 이 Heading/Description 에 직접 주입하려면 중간 child path 경유 필요.
  - 옵션 (a): Card.spec 에 `childPath: ["CardHeader", "Heading"]` 경로 형태 rule
  - 옵션 (b): CardHeader.spec / CardContent.spec 에 각각 rule 추가

  옵션 (b) 가 더 깔끔 — CardHeader 자체가 Heading 을 자식으로 갖는 spec.

- **Phase 3 — implicitStyles 분기 해체**: `implicitStyles.ts:1843-1856` + `:1859-1872` CardHeader / CardContent 분기 완전 제거. propagation 처리가 동일 주입을 담당하므로 중복 방지.

- **Phase 4 — propagation consumer 구현**: propagation rule 실행 경로 확인.
  - 기존 size rule consumer 위치 식별 (`apps/builder/src/builder/stores/` 경로 추정)
  - style rule 분기 추가 (childPath 탐색 + skipIfSet 검사 + style 주입)

- **검증**: type-check 3/3 + specs 166/166 + builder 227/227 PASS + `implicitStyles.ts` CardHeader/CardContent 분기 0 건.

### 기각 대안 사유

- 대안 B (새 필드): DRY 위반 + 미래 ADR 마다 2 필드 중 선택 고민 → 중앙 집중 원칙 위반
- 대안 C (현상 유지): ADR-092 Phase 5 명시 후속 debt 영구화

## Risks

| ID  | 위험                                                                                                                                                                           | 심각도 | 대응                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | propagation rule consumer 구현 위치 미확인 → Phase 4 에서 기존 size rule 처리 경로 재사용 검증 필요                                                                            |  MED   | Phase 0 조사 후 Phase 4 착수. ADR-048 / ADR-073 propagation 선례 참조                                                                                                            |
| R2  | CardHeader.spec 에 rule 선언 → Heading 자식이 CardHeader.childSpecs 에 없음 (factory 자동 생성 element) → rule 실행 경로 불명확                                                |  MED   | Phase 4 에서 propagation 이 "runtime 자식 Element" 대상으로 작동하는지 검증. 기존 size propagation (CheckboxGroup → CheckboxItems → Checkbox → Label) 선례로 다단 경로 지원 확증 |
| R3  | 기존 사용자 프로젝트에 CardHeader 자식 Heading 의 style.flex 없는 경우 auto-propagation 이 신규 주입 → 기존 behavior 와 동일 (implicitStyles 가 하던 일을 propagation 이 대체) |  LOW   | 무영향. Phase 3 에서 implicitStyles 분기 제거로 중복 주입 방지                                                                                                                   |
| R4  | Phase 4 구현 범위가 예상보다 큼 → size rule consumer 가 runtime propagation 이 아닌 store 저장 시점 실행이면 patch 필요                                                        |  MED   | Phase 0 조사로 scope 확정. 필요 시 ADR scope 분할                                                                                                                                |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음. 검증 기준:

- type-check 3/3 PASS ✅ (2026-04-21 확인)
- specs 166/166 PASS ✅ (snapshot 변동 없음)
- builder 227/227 PASS ✅
- `rg 'containerTag === "cardheader"' apps/builder/.../implicitStyles.ts` = **0 건** ✅
- `rg 'containerTag === "cardcontent"' apps/builder/.../implicitStyles.ts` = **0 건** ✅
- Chrome MCP 연결 끊김 → code-level 검증 (type-check + tests + 구조 검토). 후속 세션에서 Card 엘리먼트 있는 페이지 실측

## 구현 결과 (2026-04-21)

- **Phase 1 — Schema 확장**: `PropagationRule` 에 `styleValue?: string | number` + `skipIfSet?: string[]` 2 optional 필드 추가. `parentProp` 을 optional 로 완화 (styleValue 사용 시 생략 가능). 기존 size/variant 전파 rule 은 무영향.
- **Phase 2 — Engine 확장**: `propagationEngine.ts`:
  - `shouldSkipByConflict(childProps, skipIfSet)` 헬퍼 신설 — 자식 style 에 skipIfSet 필드 중 하나라도 있으면 true.
  - `buildPropagationUpdates` (Inspector primary): `isFixedStyleRule` 분기 추가 — parentProp 없고 styleValue 있을 때 값 변환 없이 직접 주입. skipIfSet 검사 + override 무효화 지원.
  - `resolvePropagatedProps` (Skia/Layout fallback): 동일 로직 반영.
- **Phase 3 — spec 선언 이전**: `CardHeader.spec.propagation.rules` 에 `{ childPath: "Heading", childProp: "flex", asStyle: true, styleValue: 1, skipIfSet: ["flex", "flexGrow", "width"] }`. `CardContent.spec.propagation.rules` 에 `{ childPath: "Description", childProp: "width", asStyle: true, styleValue: "100%", skipIfSet: ["width", "flex"] }`. 기존 implicitStyles 분기 조건 1:1 이관.
- **Phase 4 — consumer 등록 + 분기 해체**: `propagationRegistry.ts` 에 CardHeaderSpec / CardContentSpec 등록. `implicitStyles.ts:1843-1872` CardHeader / CardContent 분기 완전 제거 (주석으로 이관 명시).

### 후속 ADR 재사용 가능성

같은 `styleValue` + `skipIfSet` 패턴이 재사용 가능한 추가 분기:

- **TagList → Tag `whiteSpace:"nowrap"`** (`implicitStyles.ts:584-596`): 단 TagList 분기 내 maxRows 런타임 로직 혼재 → ADR-093-A1 items SSOT 이관과 함께 검토 권장
- **DateField / DateInput 자식 주입** 등 향후 발견되는 자식 style mutation 분기 전반

## Consequences

### Positive

- ADR-092-A1 후속 debt 해소 (Card 2 분기)
- propagation schema 일반화 → 후속 ADR 이 동일 rule 로 다른 분기 해체 가능 (DateField/Breadcrumbs/TagList 등)
- 중앙 집중 SSOT — spec 선언이 3경로(Preview/Skia/Taffy) 공통

### Negative

- Phase 4 propagation consumer 수정 필요 — scope 불명확 시 ADR 분할 발생 가능
- rule type 판정 overhead (rule 당 1회 string 비교) — 성능 영향 미미
- TagList → Tag whiteSpace 주입은 **본 ADR scope 외** (maxRows runtime 로직 혼재) — ADR-093-A1 에서 items SSOT 와 함께 검토

## 참조

- [ADR-092](092-card-slot-spec-modeling.md) — Phase 5 에서 본 후속 ADR scope 명시
- [ADR-048](048-declarative-props-propagation.md) — propagation SSOT 선례
- [ADR-073](073-select-combobox-items-ssot.md) — items SSOT + propagation 선례
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 symmetric consumer
