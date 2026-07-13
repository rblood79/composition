# ADR-092: Card slot 모델링 — CardHeader / CardContent / CardFooter spec 신설

## Status

Implemented — 2026-04-21

## Context

composition SSOT 체인 (ADR-036/063) 에서 Card 복합 컴포넌트의 **header/content slot 구조**가 spec SSOT 로 모델링되지 않음. ADR-087 SP5 가 "CardHeader/CardContent spec 부재로 scope 외" 명시한 후속 debt.

### 실측 — 현재 Card 구조

- **`packages/specs/src/components/Card.spec.ts`** 존재 (skipCSSGeneration: false, sizes xs~xl, CompositionSpec `childPath: ["CardHeader", "Heading"]` / `["CardContent", "Description"]` 전파 rule 있음)
- **`packages/specs/src/components/CardView.spec.ts`** 존재 (별도 용도 — 단순 카드 뷰, 본 ADR scope 외)
- **CardHeader.spec.ts / CardContent.spec.ts 부재**
- **`packages/shared/src/components/styles/generated/Card.css`** 자동 생성 (Card.spec skipCSSGeneration: false)
- **`packages/shared/src/components/styles/Card.css` 수동 파일 없음** — 모든 CSS 가 Generator 담당 중 (ADR-078 ListBox 과 다른 이상적 상태)
- **`implicitStyles.ts:1824-1870` 3 분기** 존재:
  - `card` 분기 (`:1825`): 자식 `CardHeader/CardContent` Element 에 `style.width: "100%"` 주입
  - `cardheader` 분기 (`:1841`): 자식 `Heading` Element 에 `style.flex: 1` 주입
  - `cardcontent` 분기 (`:1857`): 자식 `Description` Element 에 `style.width: "100%"` 주입
- **CardHeader/CardContent 는 실제 element 로 사용 중** — spec 부재 + element 존재 = ADR-078 ListBoxItem 상황과 동일 패턴

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. CardHeader/CardContent 의 layout primitive (display/flexDirection/alignItems) 와 size-indexed padding 이 현재 spec 부재로 implicitStyles 분기에 runtime 로직으로 분산. 정식 spec 으로 리프팅하여 3경로 (CSS/Skia/Taffy) SSOT 확보.

### RSP/RAC API 참조

- **RSP Card** (S2, react-spectrum.adobe.com): `<Card>` + child components 구조. 네이밍 (CardBody vs CardContent) 은 **본 ADR 내 WebFetch 검증 미수행** — 별도 후속 ADR 에서 RSP 네이밍 정합 확정
- **composition 현재**: `CardHeader` + `CardContent` + `CardFooter` (factory 자동 생성). 네이밍 유지 — 이미 element 사용 중, 리네이밍은 migration 비용 추가

### Hard Constraints

1. **CardHeader/CardContent/CardFooter element 호환 유지** — 기존 프로젝트 저장 데이터에 3 slot 요소 포함 시 그대로 동작
2. **Skia ↔ CSS 2-consumer 대칭 복구** (D3 symmetric) — 본 ADR 은 **[ADR-094](094-childspecs-registry-auto-registration.md) 에 의존**. ADR-094 의 childSpecs 자동 registry 등록 없이는 `childSpecs` 가 CSS 축만 공급 → Skia 축 미복구 → 대칭 실패 (Codex round 2 H2 지적)
3. **factory inline default 제거** (Codex round 2 H1): `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:155` Card 생성 시 심는 `display/gap/width/flex` inline style 을 제거. 그 값들은 Card/CardHeader/CardContent/CardFooter spec.containerStyles 로 이관. inline 이 남으면 spec 기본값을 덮어써 SSOT 복구 미달성
4. **size propagation 추가**: `Card.spec.ts:119` propagation.rules 에 `{ parentProp: "size", childPath: "CardHeader", override: true }` / `CardContent` / `CardFooter` 3건 추가. 현재 title/description 만 전파, size 전파 없음 → CardHeader/CardContent/CardFooter 가 부모 size 기반 스타일 못 받음
5. **`implicitStyles.ts` 자식 element runtime 주입 보존**: (a) Card 분기 CardHeader/CardContent 자식 width:100% 주입은 containerStyles.width="100%" 로 이관 가능 → **제거**. (b) CardHeader 분기 Heading flex:1 주입, (c) CardContent 분기 Description width:100% 주입은 **자식 Element 에 주입** 이라 spec 커버 불가 → **분기 유지** (별도 propagation 확장 ADR 대기)
6. `pnpm type-check` 3/3 + specs 166/166 + builder 217/217 PASS
7. `CardSpec.propagation.rules` (ComponentSpec **최상위 필드** — `composition.propagation` 아님, `spec.types.ts:205`) 의 기존 `childPath: ["CardHeader", "Heading"]` / `["CardContent", "Description"]` 전파 rule 은 보존 (title/description)

### Soft Constraints

- ADR-078 (ListBoxItem) + ADR-090 (GridListItem) childSpecs 패턴 3회 재사용
- **CardFooter 실제 사용 중** — `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:220` factory 가 Card 생성 시 CardFooter element 자동 생성 + `apps/builder/src/builder/hooks/useElementCreator.ts:154-176` Card action 컴포넌트를 CardFooter 로 자동 라우팅. `implicitStyles.ts` 분기는 없으나 element 사용 확인 → **본 ADR scope 포함 (CardHeader/CardContent/CardFooter 3 spec 동시 신설)** 로 확장

## Alternatives Considered

### 대안 A: CardHeader/CardContent/CardFooter 독립 spec 3 신설 + childSpecs 배선 (선정)

- 설명: `CardHeader.spec.ts` + `CardContent.spec.ts` + `CardFooter.spec.ts` 3개 신설. 각자 `archetype: "simple"`, `containerStyles` (display/flexDirection/alignItems), `sizes.md` (paddingX/Y, gap). `CardSpec.childSpecs = [CardHeaderSpec, CardContentSpec, CardFooterSpec]` 배선. ADR-078/090 패턴 재사용
- 근거: 선례 패턴 2회 검증 완료, 3회째 반복. CardFooter 는 factory 자동 생성 + Card action 자동 라우팅 중이라 spec 신설 필수
- 위험:
  - 기술: LOW — 선례 확정
  - 성능: LOW
  - 유지보수: LOW — SSOT 복귀
  - 마이그레이션: LOW — BC 0 (기존 element 호환)

### 대안 B: CompositionSpec.slots Schema 확장 — 단일 Card spec 내부 slot 메타데이터

- 설명: `CompositionSpec` 에 `slots?: Record<string, SlotSpec>` 신설. `CardSpec.composition.slots.header = { padding, fontSize, ... }` 형태. spec 파일 1개 유지
- 근거: 파일 수 감소, slot 관계가 명시적
- 위험:
  - 기술: **MEDIUM** — Schema 확장 + Generator / Skia consumer / Style Panel / Taffy 모두 새 path 지원 필요
  - 성능: LOW
  - 유지보수: **MEDIUM** — 기존 childSpecs 패턴과 이원화, 어느 때 slots vs childSpecs 사용할지 가이드 필요
  - 마이그레이션: LOW

### 대안 C: 현 상태 유지 (spec 부재 유지)

- 설명: CardHeader/CardContent spec 신설 없이 implicitStyles 분기 로직 유지
- 근거: 범위 축소
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — ADR-087 SP5 debt 영구화. ADR-063 D3 symmetric 원칙 위반 고착화
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                                         | HIGH+ 수 | 판정                                    |
| -------------------------------------------- | :------: | --------------------------------------- |
| A: 독립 spec + childSpecs (ADR-078/090 반복) |    0     | PASS                                    |
| B: CompositionSpec.slots 스키마 확장         |    2     | (MED 2 — 인프라 확장 부담 → 기각, 후속) |
| C: 현 상태 유지                              |    1     | (debt 영구화 → 기각)                    |

대안 A 가 HIGH+ 0.

## Decision

**대안 A 채택**. ADR-078 (ListBoxItem) + ADR-090 (GridListItem) 패턴 3회 재사용. 자식 Element runtime injection 로직 (Heading flex:1, Description width:100%) 은 **본 ADR scope 외** — implicitStyles 분기에 남김 (spec propagation 확장 필요한 후속 ADR).

### Phase 구성

**선행 의존성**: [ADR-094](094-childspecs-registry-auto-registration.md) (childSpecs 자동 registry 등록) 먼저 land 필수. ADR-094 없이 본 ADR 진행 시 Skia 축 SSOT 미복구 (CSS 축만 작동).

- **Phase 1 (1세션, 3 spec 신설)**:
  1. `CardHeader.spec.ts` 신설 — archetype:"simple", skipCSSGeneration:false, containerStyles (display:flex, alignItems:center, width:100%), sizes.xs~xl (paddingX/Y 부모 Card.sizes 와 정합), states
  2. `CardContent.spec.ts` 신설 — containerStyles (display:flex, flexDirection:column, width:100%), sizes.xs~xl, states
  3. `CardFooter.spec.ts` 신설 — containerStyles (display:flex, alignItems:center, justifyContent:flex-end, width:100%), sizes.xs~xl, states. factory 자동 생성 호환 유지
  4. `packages/specs/src/components/index.ts` + `packages/specs/src/index.ts` export 3건 추가
  5. `CardSpec.childSpecs = [CardHeaderSpec, CardContentSpec, CardFooterSpec]` 배선
  6. `CardSpec.propagation.rules` (ComponentSpec 최상위 필드, `spec.types.ts:205`) 에 size 전파 3건 추가 (Hard Constraint 4). **`composition.propagation` 아님** — Codex round 4 M2 정정
- **Phase 2 (0.5세션, factory inline 제거 — Codex H1)**:
  - `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:155` Card 생성 inline default `display/gap/width/flex` **제거** (spec.containerStyles 가 대신 공급, ADR-094 인프라 경유)
  - 기존 프로젝트 migration: inline style 이 store 에 저장된 Card element 는 그대로 유지 (사용자 편집 간주), 신규 생성만 spec 기반
- **Phase 3 (0.5세션, implicitStyles 분기 정리 — 내부 충돌 해소 M3)**:
  - `implicitStyles.ts:1825-1838` Card 분기 CardHeader/CardContent width:"100%" 주입 **제거** (containerStyles.width="100%" 가 대신 주입, ADR-094 경유)
  - `:1840-1854` CardHeader 자식 Heading flex:1 주입 **유지** (자식 Element injection — scope 외)
  - `:1856-1870` CardContent 자식 Description width:100% 주입 **유지**
- **Phase 4 (검증)**: type-check + specs + builder + build:specs 재생성 + Chrome MCP Card 실측 (시각 변동 없음 확인)

### 구현 파일 변경 목록

1. `packages/specs/src/components/CardHeader.spec.ts` — 신규
2. `packages/specs/src/components/CardContent.spec.ts` — 신규
3. `packages/specs/src/components/CardFooter.spec.ts` — 신규
4. `packages/specs/src/components/Card.spec.ts` — childSpecs 추가 + propagation.rules size 전파 3건
5. `packages/specs/src/components/index.ts` + `packages/specs/src/index.ts` — export 3건
6. `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:155` — Card 생성 inline default 제거 (Codex H1)
7. `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:1824-1838` — Card 분기 width:"100%" 주입 제거 (M3 내부 충돌 해소)
8. `packages/shared/src/components/styles/generated/Card.css` — build:specs 재생성

## Risks

| ID  | 위험                                                                  | 심각도 | 대응                                                                                  |
| --- | --------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------- |
| R1  | CardHeader/CardContent spec 의 `skipCSSGeneration` 값 결정            |  LOW   | Card.spec.skipCSSGeneration=false 이므로 두 자식 spec 도 false + childSpecs emit 경로 |
| R2  | CardHeader Heading flex:1 injection 은 자식 element 단위 runtime 필요 |  LOW   | 본 ADR scope 외 명시. 향후 propagation 확장 ADR 대기                                  |
| R3  | Card generated CSS 에 CardHeader/CardContent selector 중복 emit       |  LOW   | ListBoxItem 경로 선례 (ADR-078 Phase 2) 재사용 — 독립 CSS emit skip 옵션 고려         |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음. 검증 기준:

- type-check 3/3 PASS ✅ (2026-04-21 확인)
- specs 166/166 PASS ✅ (Card snapshot 1 updated — CardHeader/CardContent/CardFooter selector emit 반영)
- builder 227/227 PASS ✅ (ADR-094 영향 유지)
- Chrome MCP 실측: 현재 프로젝트 페이지에 Card element 없음 → code-level 검증으로 대체 (type-check + specs snapshot diff 로 CSS emit 구조 확증)
- `packages/shared/src/components/styles/generated/Card.css` diff — `.react-aria-CardHeader` / `.react-aria-CardContent` / `.react-aria-CardFooter` 블록 신규 emit

## 구현 결과 (2026-04-21)

- **Phase 1 (3 spec 신설)**: `packages/specs/src/components/CardHeader.spec.ts` + `CardContent.spec.ts` + `CardFooter.spec.ts` 신설. 모두 `archetype: "simple"` / `element: "div"` / `skipCSSGeneration: true` (부모 CardSpec.childSpecs 경로로 `generated/Card.css` 에 inline emit). containerStyles 에 factory inline default 이관 (display/flexDirection/alignItems/width:"100%"). sizes xs~xl gap 스케일 + `borderRadius: "{radius.none}"` 명시 (Generator `undefined` 출력 방지).
- **Phase 2 (childSpecs 배선)**: `Card.spec.ts` 에 `childSpecs: [CardHeaderSpec, CardContentSpec, CardFooterSpec]` 추가. ADR-094 `expandChildSpecs` 인프라가 `TAG_SPEC_MAP` / `LOWERCASE_TAG_SPEC_MAP` / `tagToElement TAG_SPEC_MAP` 자동 등록 → Skia/Taffy/`hasSpec`/`getElementForTag` 전 consumer 자동 조회.
- **Phase 3 (propagation 확장)**: `Card.spec.ts:propagation.rules` 에 size 전파 3 rule 추가 (CardHeader/CardContent/CardFooter 각각 `override: true`). 기존 title/description 전파 rule 보존.
- **Phase 4 (factory inline default 제거)**: `apps/builder/src/builder/factories/definitions/LayoutComponents.ts` Card 생성 시 자식 CardHeader/CardContent/CardFooter 에 inline 심던 `display/gap/width/flex` 제거. spec.containerStyles 로 이관 완료.
- **Phase 5 (implicitStyles Card 분기 조정)**: `implicitStyles.ts:1824-1840` Card 분기의 `style.width: "100%"` 주입 제거 (CardHeader/CardContent.spec.containerStyles.width="100%" 로 이관). CardHeader 분기 (Heading flex:1 주입) + CardContent 분기 (Description width:100% 주입) 는 자식 Element mutation 이라 spec 커버 불가 — 분기 유지 (R2 명시).
- **Phase 6 (`_hasChildren` 컨벤션)**: CardHeader/CardContent/CardFooter 는 `spec.render.shapes: () => []` 이므로 자식 수와 무관하게 시각 변화 없음 → **Plain 분류** 적합. SHELL_ONLY_CONTAINER_TAGS / SYNTHETIC_CHILD_PROP_MERGE_TAGS 변경 불필요.
- **Phase 7 (Chrome MCP 실측)**: 현 프로젝트 페이지에 Card element 없음 → 시각 변동 0 (code-level 증거만). 향후 Card 가 포함된 페이지 생성 시 자동 작동.

### 후속 ADR 후보

- **ADR-092-A1**: CardHeader 분기 (Heading flex:1) + CardContent 분기 (Description width:100%) 의 자식 Element 주입 로직 SSOT 화. propagation rule 확장으로 spec 커버 검토. 본 ADR scope 외.
- **RSP 네이밍 정합** (`CardBody` vs `CardContent`): WebFetch 로 RSP 공식 API 검증 후 리네이밍 결정 — 별도 ADR.

## Consequences

### Positive

- ADR-087 SP5 debt 일부(Card 분기) 해소
- CardHeader/CardContent 가 Style Panel / Skia / Taffy 3경로 SSOT 로 복귀
- ADR-078/090 패턴 3회 검증 — 복합 컴포넌트 slot 모델링 표준 확립

### Negative

- 자식 element injection (Heading flex:1, Description width:100%) 은 여전히 implicitStyles 분기 잔존 — 별도 ADR 필요 (propagation 확장)
- RSP 네이밍 (`CardBody` vs `CardContent`) 정합은 별도 ADR 후속 (WebFetch 검증 필요)

## 참조

- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — ListBoxItem spec + childSpecs 선례
- [ADR-090](090-gridlistitem-spec-and-skia-metric-ssot.md) — GridListItem spec 선례 (skipCSSGeneration 고려 포함)
- [ADR-087](087-implicitstyles-residual-branches-categorized-sweep.md) — SP5 후속 후보 #1 선언
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain
