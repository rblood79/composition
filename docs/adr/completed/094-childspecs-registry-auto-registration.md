# ADR-094: childSpecs 자동 registry 등록 — Skia 축 SSOT 복구

## Status

Implemented — 2026-04-21

## Context

composition SSOT 체인 ([ADR-063](063-ssot-chain-charter.md) / [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)) 은 D3 시각 스타일을 **Skia ↔ CSS 2-consumer symmetric** 구조로 정의. 그러나 `childSpecs` 패턴 (ADR-078/090/092/093) 은 **CSS 축만 공급** 하고 Skia 축은 여전히 `TAG_SPEC_MAP` registry 에 의존 — 대칭 깨진 상태.

### 실측 — debt 선언적 문서화 증거

**`apps/builder/src/builder/workspace/canvas/layout/engines/resolveContainerStylesFallback.test.ts:92-102`** 가 이 debt 를 명시적으로 선언:

```ts
// ADR-083 Phase 0 주의: ListBoxItemSpec 은 TAG_SPEC_MAP 미등록 (ListBox.childSpecs
//   경로로 Skia 렌더) → Phase 0 LOWERCASE_TAG_SPEC_MAP 에도 미포함 → fallback 조회 불가.
//   ListBoxItem containerStyles 는 CSS emit / ADR-079 P1 cascade 에만 기여하며, Skia
//   layout 경로(implicitStyles) 로는 별도 ADR (ListBoxItemSpec 을 TAG_SPEC_MAP 에 등록
//   또는 childSpecs lookup 추가) 로 확장 필요. 본 test 는 그 상태를 선언적으로 문서화.
describe("listboxitem — TAG_SPEC_MAP 미등록 (Phase 0 범위 외)", () => {
  it("empty parentStyle → {} (childSpecs 전용 spec 은 lookup 미작동)", () => {
    const fb = resolveContainerStylesFallback("listboxitem", {});
    expect(fb).toEqual({});
  });
});
```

### Codex round 2 지적 (2026-04-21)

ADR-092/093 리뷰 교차검증 중 Codex 가 동일 문제 재지적:

- `tagSpecMap.ts:109` `TAG_SPEC_MAP` 은 child spec 미포함
- `implicitStyles.ts:95` `LOWERCASE_TAG_SPEC_MAP` 도 `TAG_SPEC_MAP` 에서 파생 → child spec 미포함
- `useLayoutAuxiliary.ts:25` Style Panel layout value 조회도 `TAG_SPEC_MAP` 기반
- "childSpecs 만으로 Skia/Taffy 가 child spec 읽는다" 는 ADR 전제가 **거짓**

### 누적 debt 범위

- **ADR-078** ListBoxItem.spec — Skia 축 미공급 (test 선언)
- **ADR-090** GridListItem.spec — 동일 debt 추정
- **ADR-092** (Proposed, Card slot) — 동일 debt 반복 예정
- **ADR-093** (Proposed, Synthetic-merge) — 동일 debt 반복 예정

즉 childSpecs 패턴을 쓰는 모든 ADR 이 Skia 축에서 **사실상 no-op** 상태. CSS 축만 작동 = D3 symmetric 원칙 미준수.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) 대칭 복구 인프라**. 본 ADR 자체는 시각 스타일 값 변경 없음 — registry 경로 확장으로 child spec 이 **Skia 축 (layout + sprite + style panel) 에서도 읽히도록** 인프라 정비. 후속 ADR (091/092/093 재정정 포함) 이 이 인프라 위에서 실질 SSOT 복구.

### Hard Constraints

1. **기존 `TAG_SPEC_MAP` 호환 유지** — 수동 등록된 62 spec 영향 0
2. **ListBoxItem drift 대응** (Codex round 3 H2 정정): 실측 결과 `ListBoxItem.spec.ts:52-57` 는 `display:flex / flexDirection:column / alignItems:flex-start / justifyContent:center` 4 속성 포함. `implicitStyles.ts:778-787` ListBoxItem 분기는 `display/flexDirection/gap/padding` 만 주입 — **alignItems/justifyContent 2 속성 미주입** 상태. auto-registration 후 `resolveContainerStylesFallback` 이 이 2 속성 주입 시작 → **drift 발생 확정**. no-op 아님. Phase 1 에 Chrome MCP 실측 + 값 정합 단계 필수 (flex column + alignItems 변경으로 자식 cross-axis stretch→flex-start 차이 발생 가능)
3. **Phase 1 검증**: `resolveContainerStylesFallback.test.ts:92-102` 선언적 debt 테스트를 **"ListBoxItem containerStyles 읽힘"** PASS 로 전환
4. `pnpm type-check` 3/3 + specs 166/166 + builder 217/217 PASS
5. **Skia 축 registry 소비처 5곳 일관 확장** (Codex round 3 H1 정정): 아래 소비처 전부 확인 필요. 일부만 확장 시 consumer 간 drift 발생:
   - `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts:109` — `TAG_SPEC_MAP` 자체 + `:28/91` `getSpecForTag()`
   - `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:95` — `LOWERCASE_TAG_SPEC_MAP`
   - `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts:87-91` — `isSpecPath()` → `getSpecForTag()` 의존 (Skia 렌더 경로 게이트)
   - `apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts:96` — Style Panel 스타일 preset 경로, 직접 `TAG_SPEC_MAP` 읽음
   - `apps/builder/src/builder/panels/styles/hooks/useLayoutAuxiliary.ts:25` — Inspector layout value 조회
   - **`packages/specs/src/runtime/tagToElement.ts:120/225` + `apps/builder/src/preview/App.tsx:425/530`** — preview/runtime tag 해석. `hasSpec(el.tag)` false 시 data-size/variant 빠지고 `getElementForTag()` 가 `tag.toLowerCase()` fallback → **CardHeader 가 `<cardheader>` 커스텀 태그로 렌더**. Codex round 4 H1 발견 — child spec 미등록 시 preview DOM/CSS 경로 복구 실패. **본 ADR scope 내 승격** (Phase 5 신설)

### Soft Constraints

- ADR-078/090 retroactive 검증 (Addendum 1 대상) — 자동 등록 후 실제 SSOT 복구 증거 확보
- Inspector (style panel) 는 ADR-082 작업 기반, child spec 편집 UX 확장 별도 ADR

## Alternatives Considered

### 대안 A: `TAG_SPEC_MAP` + `LOWERCASE_TAG_SPEC_MAP` 생성 시 `childSpecs` 자동 전개 (선정)

- 설명: `tagSpecMap.ts:109` `TAG_SPEC_MAP` 과 `implicitStyles.ts:95` `LOWERCASE_TAG_SPEC_MAP` 을 build-time 1회 확장. 각 spec 순회 시 `spec.childSpecs?.forEach(child => entries.push([child.name, child]))` 추가. PascalCase 키와 lowercase 키 모두 자동 등록. `getSpecForTag()` / `isSpecPath()` / `specPresetResolver` / `useLayoutAuxiliary` / **`hasSpec` (Preview)** 등 모든 소비처가 동일 registry 소비 → 자동 혜택. **`tagToElement.ts` 의 `TAG_TO_ELEMENT` 자체 registry 도 child spec entries 자동 추가** (Phase 5) → preview DOM 에서 `<div>` 로 정상 렌더
- 근거: build-time 1회 변환 (성능 비용 0) + 기존 수동 등록 관행 유지. ADR-078/090/092/093 모두 즉시 자동 적용. **consumer 파일 변경 0** — 모든 consumer 가 동일 registry 소비
- 위험:
  - 기술: LOW — Map 확장 단순 로직
  - 성능: LOW
  - 유지보수: LOW — 중앙 집중, consumer 는 변경 없음
  - 마이그레이션: **MED** (Codex round 3 H2 반영) — ListBoxItem.containerStyles (`alignItems:flex-start + justifyContent:center`) 가 **기존 implicitStyles 분기에 미주입 상태** → auto-registration 후 주입 시작. 자식 cross-axis 동작 변경 가능성 (stretch → flex-start). Chrome MCP 실측 필수, 변경 감지 시 해당 ADR 재검토

### 대안 B: 각 child spec 을 `TAG_SPEC_MAP` 에 수동 등록

- 설명: `ListBoxItem: ListBoxItemSpec`, `GridListItem: GridListItemSpec` 등 수동 entry 추가
- 근거: 명시적, registry 가 truth
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MED** — childSpecs 패턴 쓰는 ADR 마다 registry entry 추가 요구 (ADR-092/093 도 manual 작업) → DRY 위반
  - 마이그레이션: LOW

### 대안 C: `resolveContainerStylesFallback` 에 child lookup 로직 추가

- 설명: registry 미등록 시 모든 spec 의 `childSpecs` 배열 순회하여 이름 매칭
- 근거: registry 불변, lookup 만 확장
- 위험:
  - 기술: LOW
  - 성능: **MED** — 매 lookup 마다 O(spec 수 × childSpecs) 순회 (캐시 없음)
  - 유지보수: MED — `useLayoutAuxiliary` / `specSizeField` 등 다른 consumer 가 동일 로직 중복 구현 필요
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                    | HIGH+ 수 | 판정                      |
| ----------------------- | :------: | ------------------------- |
| A: build-time 자동 전개 |    0     | PASS                      |
| B: 수동 등록            |    1     | (DRY 위반 → 기각)         |
| C: lookup 로직          |    2     | (성능 + 중복 구현 → 기각) |

대안 A HIGH+ 0 — pass.

## Decision

**대안 A 채택**. `LOWERCASE_TAG_SPEC_MAP` build-time 생성 시 `childSpecs` 자동 전개. `TAG_SPEC_MAP` 본체는 불변 유지 (PascalCase 수동 등록 관행 보존).

### Phase 구성

- **Phase 1 (1세션, 양 registry 동시 확장 — Codex round 3 H1 반영)**:
  1. `tagSpecMap.ts:109` `TAG_SPEC_MAP` 생성 시 childSpecs 자동 전개 (PascalCase 키) → `getSpecForTag()` / `isSpecPath()` / `specPresetResolver` 자동 혜택
  2. `implicitStyles.ts:95` `LOWERCASE_TAG_SPEC_MAP` 동일 확장 (lowercase 키) → `resolveContainerStylesFallback` / `specSizeField` 자동 혜택
  3. `useLayoutAuxiliary.ts:25` 확인 — 위 registry 중 어느 것 쓰는지 점검, 그대로 작동해야 함
  4. `resolveContainerStylesFallback.test.ts:92-102` ListBoxItem 테스트 **PASS 로 전환** + 반환값이 `{display:"flex", flexDirection:"column", alignItems:"flex-start", justifyContent:"center"}` 검증
- **Phase 2 (0.5세션, drift 감지 + 실측)**:
  - ListBoxItem drift 체크: auto-reg 후 alignItems:flex-start + justifyContent:center 가 신규 주입 → **ListBox 자식 정렬 변화 가능**. Chrome MCP `ListBox` 시각 비교 (before/after). 시각 변동 있으면: (a) spec containerStyles 값을 기존 분기 값에 정렬하거나 (b) 의도된 변화로 수용 + 테스트 스냅샷 갱신
  - GridListItem 동일 체크
- **Phase 3 (retroactive 검증)**: ADR-078 ListBoxItem + ADR-090 GridListItem 실제 SSOT 복구 증거 확보. `specSizeField("listboxitem", "md", "paddingX")` 가 유효값 반환하는지 test 작성
- **Phase 4 (tagToElement.ts 확장 — Codex round 4 H1 scope 승격)**: `packages/specs/src/runtime/tagToElement.ts` 의 자체 registry 에 childSpecs entries 자동 추가. `hasSpec()` / `getElementForTag()` 가 child tag (CardHeader/CardContent/CardFooter/TagList/RadioItems/CheckboxItems) 인식 → preview DOM 에서 (a) `<div>` 로 정상 렌더 (현재 `<cardheader>` 커스텀 태그 문제 해소), (b) `data-size/variant` 속성 주입 복구. 이 단계 없이는 CSS 축 (`react-aria-CardHeader` selector) 미작동 → D3 대칭 복구 실패
- **Phase 5 (preview 실측)**: Chrome MCP Preview 로 Card/TagGroup/RadioGroup/CheckboxGroup 렌더 → DOM inspector 에서 child element 가 `<div>` 로 나오고 data-size 속성 주입되는지 확인. `App.tsx:494` TagList 수동 예외 로직 **제거 가능** (tagToElement 통합되므로)
- **검증**: type-check + specs + builder + Chrome MCP 실측 (ListBox/GridList 시각 변동 명시적 수용)

### Addendum 후속 ADR 의존

- **ADR-091 재정정**: ICON_SIZE_MAP Class A 재분류 시 IconSpec.sizes 참조 경로는 `specSizeField` 사용 — ADR-094 인프라 불필요 (Icon 은 부모 spec)
- **ADR-092 재정정**: CardHeader/CardContent/CardFooter childSpecs 등록 → ADR-094 자동 등록 → Skia 축 소비 확보
- **ADR-093 재정정**: TagList/RadioItems/CheckboxItems childSpecs 등록 → 동일

## Risks

| ID  | 위험                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | ListBoxItem 자동 등록 후 실제 layout 변경 발생 — alignItems/justifyContent drift 확인                                                                                                                      |  MED   | **실측 확정 (Codex round 3 H2)**: spec 은 `alignItems:flex-start + justifyContent:center` 포함, 분기는 미주입 → auto-reg 후 신규 주입. Phase 2 에서 Chrome MCP 실측 후 시각 변동 수용 or spec 값 조정 결정            |
| R2  | `tagSpecMap.ts` PascalCase 확장 시 `StoreRenderBridge.isSpecPath()` 가 child spec 을 "Spec 경로" 로 판정 → Skia 렌더 경로 진입                                                                             |  MED   | Phase 1 에서 Skia 렌더링 child spec 동작 검증 필수. `element: "div"` + `render.shapes: () => []` 인 childSpec 들은 실제 Skia 그리기 없음 → 안전. 예외 spec 있으면 개별 처리                                           |
| R3  | `useLayoutAuxiliary` Inspector 가 child spec 을 읽기 시작하면 Style Panel UX 변화                                                                                                                          |  LOW   | Inspector 는 ADR-082 scope. 본 ADR 은 registry 만 확장, UX 영향 검증                                                                                                                                                  |
| R4  | `tagToElement.ts:120/225` 자체 registry 가 child spec 미포함 → preview 렌더에서 child tag `<cardheader>` 커스텀 태그로 렌더 + data-size/variant 속성 누락 → CSS selector (`.react-aria-CardHeader`) 미작동 |  MED   | Codex round 4 H1 반영 — **본 ADR scope 내 승격**. Phase 4 에서 tagToElement registry 에 childSpecs entries 자동 추가. Phase 5 preview 실측으로 `<div>` + data-size 주입 확인. App.tsx:494 TagList 수동 예외 제거 가능 |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음. 검증 기준:

- type-check 3/3 PASS ✅ (2026-04-21 확인)
- specs 166/166 PASS ✅
- builder 227/227 PASS ✅ (기존 217 + Phase 1 `gridlistitem` +1 + Phase 3 `tagSpecMap.test.ts` +9 = 227). `resolveContainerStylesFallback.test.ts` ListBoxItem 케이스 PASS 전환 완료 + GridListItem 신규 PASS.
- `rg "childSpecs 전용 spec 은 lookup 미작동" apps/builder` = 0 ✅ (선언적 debt 주석 해소)
- Chrome MCP 실측 결과: **현재 프로젝트 페이지에 ListBoxItem/GridListItem element 없음 (ADR-076 items SSOT 로 대체)** → 가시적 drift 0. 레거시 프로젝트에서 ListBoxItem 이 element 로 존재하는 경우 `alignItems:flex-start + justifyContent:center` 주입 시작 (spec 선언값 정합). 시각 변경은 spec SSOT 의 의도된 결과로 수용.

## 구현 결과 (2026-04-21)

- **Phase 1**: `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts` `BASE_TAG_SPEC_MAP` + `expandChildSpecs()` 도입. `LOWERCASE_TAG_SPEC_MAP` 은 파생이므로 자동 전파. `resolveContainerStylesFallback.test.ts:92-124` ListBoxItem/GridListItem 양쪽 케이스 PASS 전환.
- **Phase 2**: 현재 프로젝트 페이지 ListBox 1건 — ListBoxItem element 부재, items SSOT 경로 → 실측 시각 변동 없음. 레거시 element 환경의 변동은 spec 선언에 정합되는 의도된 변화로 수용 방침.
- **Phase 3**: `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.test.ts` 신규 — ListBoxItem/GridListItem `sizes.md.paddingX/containerStyles/getSpecForTag` 9 케이스 retroactive 검증.
- **Phase 4**: `packages/specs/src/runtime/tagToElement.ts` 의 자체 `TAG_SPEC_MAP` 에 동일 `expandChildSpecs(BASE_TAG_SPEC_MAP)` 적용. 현 시점 childSpecs 는 ListBoxItem/GridListItem 2건 → 후속 ADR-092/093 가 CardHeader/TagList 등 등록 시 `hasSpec/getElementForTag` 자동 작동.
- **Phase 5**: `App.tsx:494` TagList 수동 예외 제거 — **후속 ADR-093 scope 로 이관**. 본 ADR 은 registry 확장 인프라만 담당, 실제 제거는 TagList 가 TagGroup.childSpecs 에 등록된 후 가능.

### Addendum 1 — Phase 5 완결 (2026-04-21, ADR-093 이후)

ADR-093 에서 `TagGroupSpec.childSpecs: [TagListSpec]` 배선 완료 → `expandChildSpecs(BASE_TAG_SPEC_MAP)` 이 `tagToElement` `TAG_SPEC_MAP` 에 TagList 자동 등록 → `getElementForTag("TagList")` 가 TagListSpec.element(="div") 반환 가능 상태. `apps/builder/src/preview/App.tsx:494` 의 `case "TagList": return "div"` switch 분기 **제거 완료**. Preview DOM 이 default case 의 spec registry 조회 경로로 TagList → "div" 반환 + data-size/variant 자동 주입. **Phase 5 종결**. 검증: type-check 3/3 PASS.

## Consequences

### Positive

- **D3 symmetric 원칙 복구** — Skia ↔ CSS 양축 대칭 공급
- ADR-078/090 누적 debt 해소 (retroactive)
- ADR-092/093 구현 시 자동 적용 — 개별 ADR 이 registry 등록 scope 를 걱정할 필요 없음
- 향후 childSpecs 패턴 쓰는 ADR 일괄 혜택
- 중앙 집중 인프라 — consumer 파일 변경 없음

### Negative

- 기존 `implicitStyles.ts` child tag 분기 (ListBoxItem `:775-789`, GridListItem `:758-773`, CardHeader `:1841-1854` 등) 가 **중복 주입 경로** 가 됨 (fallback + 분기). R1 검증 후 분기 해체 여부 결정 필요 — 별도 sweep ADR 가능
- `LOWERCASE_TAG_SPEC_MAP` 엔트리 수 증가 → 디버깅 시 매핑 확인 복잡도 소폭 증가

## 참조

- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — 첫 childSpecs 패턴 (Skia 축 debt 시작)
- [ADR-090](090-gridlistitem-spec-and-skia-metric-ssot.md) — 2번째 childSpecs 패턴
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 symmetric 원칙 정본
- [ADR-083](083-archetype-base-styles-lifting.md) — `LOWERCASE_TAG_SPEC_MAP` Phase 0 인프라
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 consumer 정의
