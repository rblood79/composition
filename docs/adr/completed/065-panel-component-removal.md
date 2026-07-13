# ADR-065: Panel 컴포넌트 제거 — SSOT D2 위반 해소

## Status

Implemented — 2026-04-15

## Context

### 배경

composition에는 `Panel`이라는 독립 컴포넌트가 존재한다. 본 컴포넌트는 외부 권위(React Aria Components 또는 React Spectrum)에 정의되지 않은 **composition 고유 커스텀 컴포넌트**로, `variant: "default" | "tab" | "sidebar" | "card" | "modal"` 5종을 임의 도입했다.

본 세션 직전(2026-04-15) 수행된 Tabs 구조 정합 작업에서 RAC 레퍼런스 구조(`Tabs > TabList + TabPanels > TabPanel`)에 따라 `TabPanel` spec을 신설해 Tabs 내 Panel 역할을 이관했다. 이 결과 Panel은 **독립 컨테이너 역할**만 남았고, 해당 역할은 이미 존재하는 RAC 정합 컴포넌트(`Group`, `Section`, `Card`)로 모두 대체 가능함이 확인됐다.

### SSOT 체인 위배 (3-Domain 분할 기준)

본 ADR은 SSOT 체인 정본 [ADR-063](063-ssot-chain-charter.md) / [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)의 **D2(Props/API)** 위반 해소 건이다.

- **D2 위반**: RSP 미규정 `variant` 5종 임의 도입 — 정본 규칙 §6 금지 패턴 "Spec에 RSP 미규정 prop 도입 (D2 위반)"에 정확히 해당
- **D3 간접 영향**: `PanelSpec.variants`가 정의한 시각 스타일은 Group/Section/Card가 이미 커버 (시각 domain 대체재 존재)
- **D1 무관**: RAC Panel primitive 자체가 존재하지 않음 (대체 없는 삭제)

### 현재 사용 현황 (2026-04-15 조사 결과)

| 분류                 | 위치                                                                                                                        | 비고                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Spec / CSS / Wrapper | `Panel.spec.ts`, `Panel.css`, `Panel.tsx`                                                                                   | 4파일                                          |
| 등록 포인트          | `specs/index.ts`, `specs/components/index.ts`, `tagToElement.ts`, `tagSpecMap.ts`, `specRegistry.ts`                        | 5파일                                          |
| Runtime fallback     | `implicitStyles.ts`, `HierarchyManager.ts`, `treeUtils.ts`, `elementReorder.ts`, `elementRemoval.ts`, `useLayerTreeData.ts` | TabPanel 이관 후 `\|\| "Panel"` fallback 6개소 |
| UI 노출              | `ComponentList.tsx`, `i18n/translations.ts`, `metadata.ts`                                                                  | 3파일                                          |
| Variant 타입         | `componentVariants.types.ts` (apps/builder + packages/shared 중복)                                                          | 2파일                                          |
| Templates            | `layoutTemplates.ts` — `dashboardWithPanelTemplate`                                                                         | Panel → Card 치환                              |
| AI 프롬프트 / 도구   | `systemPrompt.ts`, `tools/definitions.ts`                                                                                   | 2파일                                          |
| 이벤트 레지스트리    | `componentRegistry.ts` — `Panel: ["show", "hide", "toggle"]`                                                                | 1파일                                          |
| Publish 레지스트리   | `apps/publish/.../ComponentRegistry.tsx`                                                                                    | 1파일                                          |
| CSS Presets          | `cssComponentPresets.ts` — `PanelSizePreset`, `PanelColorPreset`, `PANEL_FALLBACKS`, `PANEL_COLOR_FALLBACKS`, getter 2개    | ~150줄 블록                                    |

### Hard Constraints

- **Type-check 3/3 통과**: 본 변경 후 `pnpm type-check`가 `@composition/specs`, `@composition/shared`, `@composition/builder`, `@composition/publish` 전부 통과해야 함
- **build:specs 통과**: CSS 자동 생성 108개 유지 (Panel.css 1개 감소 → 107개)
- **시각 회귀 없음**: `dashboardWithPanelTemplate` Card 치환 후 기존 템플릿 시각 결과 동일 수준 유지

### Soft Constraints

- 저장된 legacy 프로젝트 데이터에 `tag: "Panel"` 요소가 있을 수 있음 — **마이그레이션 미수행 결정**(사용자 지시, 2026-04-15). Legacy 프로젝트 로드 시 해당 요소는 unknown tag로 처리됨

## Alternatives Considered

### 대안 A: Panel 완전 제거 + Card/Section 대체 (선택)

- **설명**: Panel spec/wrapper/CSS/runtime fallback/UI 노출/presets/템플릿 모든 흔적 제거. 템플릿 내 Panel → Card 치환. 저장 데이터 마이그레이션 없음.
- **위험**:
  - 기술: **LOW** — mechanical edit 중심, 의미론적 판단은 템플릿 치환 1건만
  - 성능: **LOW** — 번들 감소 (Panel.tsx, Panel.css, presets ~150줄 제거)
  - 유지보수: **LOW** — SSOT 위반 제거로 오히려 장기 유지보수 감소
  - 마이그레이션: **MEDIUM** — legacy 프로젝트에 `tag: "Panel"`이 있으면 unknown tag 경고 발생. 하지만 마이그레이션 미수행은 사용자가 명시적으로 수용

### 대안 B: Panel 축소 — `default` variant만 유지, RAC Group 래퍼화

- **설명**: Panel을 유지하되 variants를 제거하고 RAC `<Group>` 단순 래퍼로 재정의.
- **위험**:
  - 기술: **LOW**
  - 성능: **LOW**
  - 유지보수: **MEDIUM** — Panel과 Group의 역할 중복 → 향후 "어느 걸 써야 하나" 혼란 재발
  - 마이그레이션: **LOW** — 기존 Panel 데이터 계속 로드 가능
- **기각**: Group이 이미 존재 → 래퍼 도입은 SSOT 원칙 위배(같은 D3 시각 결과의 중복 consumer). ADR-063의 D2 원칙("RSP에 없는 커스텀 prop 임의 도입 금지")에도 여전히 저촉될 수 있음

### 대안 C: 유지 + Deprecation 마킹

- **설명**: Panel 코드는 유지하되 신규 사용 경로(ComponentList 팔레트, AI 프롬프트)만 차단. Console warning 추가.
- **위험**:
  - 기술: **LOW**
  - 성능: **LOW**
  - 유지보수: **HIGH** — dead code 장기 유지, SSOT 위반 영구화. ADR-059/062가 정리한 "skipCSSGeneration 해체", "Field variant 제거" 기조와 역행
  - 마이그레이션: **LOW**
- **기각**: composition 프로젝트가 일관되게 걸어온 "SSOT 위반은 해체" 방향(ADR-057/058/059/060/061/062) 위배. Deprecation이 일시적으로 보여도 실제 제거 계획 없이 마킹만 하는 것은 금지

### Risk Threshold Check

| 대안          | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------- | ---- | ---- | -------- | ------------ | ---------- |
| A (제거)      | L    | L    | L        | M            | 0          |
| B (축소)      | L    | L    | M        | L            | 0          |
| C (deprecate) | L    | L    | **H**    | L            | 1          |

**판정**: HIGH 대안 1개(C)지만 B와 A가 모두 HIGH-free → 루프 불필요. A/B 중 SSOT 정합성이 가장 높은 A 선택.

## Decision

**대안 A 선택** — Panel 컴포넌트 전면 제거.

### 선택 근거

1. **SSOT 체인 정본(ADR-063) 집행**: D2 위반 제거는 정본 규칙 §4-2 "위반 감지 및 대응" 절차의 정상 적용
2. **대체재 완비**: Card(시각 강조), Section(일반 컨테이너), Group(RAC 순수 래퍼) 이미 존재 — 기능 손실 없음
3. **Tabs 역할 이관 완료**: TabPanel spec 신설로 Panel의 유일한 구조적 역할이 소멸
4. **일관된 체계**: ADR-057/058/059/060/061/062 "SSOT 위반 해체" 방향과 정합

### 기각 사유 재확인

- **B 기각**: Panel을 Group 래퍼로 축소해도 Group과의 역할 중복이 SSOT 위반 재발 여지 → "위반 제거" 목적 미달성
- **C 기각**: Deprecation 마킹은 프로젝트가 걸어온 해체 기조와 역행, `HIGH` 유지보수 위험

### 대체 매핑 (사용자 결정, 2026-04-15)

| Panel 사용처                      | 대체 컴포넌트 |
| --------------------------------- | ------------- |
| 일반 컨테이너                     | **Section**   |
| variant=card                      | **Card**      |
| variant=sidebar/modal             | 불필요 (제거) |
| `dashboardWithPanelTemplate` 내부 | **Card**      |

### 마이그레이션 정책

**마이그레이션 없음** (사용자 명시 결정):

- Legacy 프로젝트 로드 시 `tag: "Panel"` 요소는 unknown tag로 처리됨
- DB 스크립트 변환 / 런타임 변환 / spec 최소화 유지 모두 수행하지 않음
- 이 결정은 사용자 권한으로 수용됨

### 구현 상세

본 ADR은 구현 상세가 mechanical edit 중심이라 **별도 breakdown 문서를 분리하지 않는다**. 아래 체크리스트가 실행 단위.

**Phase 1: Spec / Wrapper / CSS 제거 (4파일 삭제)**

- [ ] `packages/specs/src/components/Panel.spec.ts` 삭제
- [ ] `packages/shared/src/components/Panel.tsx` 삭제
- [ ] `packages/shared/src/components/styles/generated/Panel.css` 삭제 (build:specs 재실행으로 자동 삭제 확인)
- [ ] `packages/specs/src/index.ts` — PanelSpec export 제거
- [ ] `packages/specs/src/components/index.ts` — PanelSpec export 제거

**Phase 2: 등록 포인트 제거 (5곳)**

- [ ] `packages/specs/src/runtime/tagToElement.ts` — import + TAG_SPEC_MAP 엔트리 제거
- [ ] `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts` — Panel 제거
- [ ] `apps/builder/src/builder/panels/properties/specRegistry.ts` — Panel 제거
- [ ] `packages/shared/src/renderers/index.ts` — `Panel: renderPanel` 제거
- [ ] `packages/shared/src/components/index.tsx` — `export { Panel }` 제거
- [ ] `packages/shared/src/components/list.ts` — `export * from "./Panel"` 제거

**Phase 3: Runtime fallback 제거 (6곳) — `|| "Panel"` 만 삭제, `"TabPanel"` 단독 체크로 남김**

- [ ] `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:930, 1006`
- [ ] `apps/builder/src/builder/utils/HierarchyManager.ts:385`
- [ ] `apps/builder/src/builder/utils/treeUtils.ts:153`
- [ ] `apps/builder/src/builder/stores/utils/elementReorder.ts:102`
- [ ] `apps/builder/src/builder/stores/utils/elementRemoval.ts:150` — `|| tag === "Panel"` 제거
- [ ] `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts:148-150` — Panel display name 블록 제거

**Phase 4: UI 노출 제거 (3파일)**

- [ ] `apps/builder/src/builder/panels/components/ComponentList.tsx:87` — Panel 팔레트 엔트리 제거
- [ ] `apps/builder/src/i18n/translations.ts:217` — `panel: "Panel"` 제거
- [ ] `packages/shared/src/components/metadata.ts:630-631` — Panel 메타 제거

**Phase 5: Variant 타입 정의 제거 (2파일)**

- [ ] `apps/builder/src/types/builder/componentVariants.types.ts:110-113` — `PanelVariant` 타입 제거
- [ ] `packages/shared/src/types/componentVariants.types.ts:162-194` — `PanelVariant` 중복 정의 제거

**Phase 6: Templates / AI / 이벤트 / Publish 정리**

- [ ] `apps/builder/src/builder/templates/layoutTemplates.ts` — `dashboardWithPanelTemplate` 내부 Panel → Card 치환 (필요 시 이름 `dashboardWithCardTemplate`으로 리네이밍 검토)
- [ ] `apps/builder/src/services/ai/systemPrompt.ts:25` — Panel 제거
- [ ] `apps/builder/src/services/ai/tools/definitions.ts:21` — Panel 제거
- [ ] `apps/builder/src/builder/stores/componentRegistry.ts:97` — Panel 이벤트 엔트리 제거
- [ ] `apps/publish/src/registry/ComponentRegistry.tsx:37, 50, 438-440` — Panel lazy import + register 제거

**Phase 7: CSS Presets 제거**

- [ ] `apps/builder/src/builder/workspace/canvas/utils/cssComponentPresets.ts:1582-1732` — `PanelSizePreset`, `PanelColorPreset`, `PANEL_FALLBACKS`, `PANEL_COLOR_FALLBACKS`, `getPanelSizePreset`, `getPanelColorPreset` 전 구간 삭제. 외부에서 호출하는 코드가 있으면 동시 제거

**Phase 8: README.md 갱신**

- [ ] `docs/adr/README.md` 테이블에 ADR-065 행 추가 (Status: Implemented 후)

## Gates

본 ADR은 **잔존 HIGH 위험 없음** — Gate 테이블 생략 가능하지만 구현 완료 판정 기준은 명시.

| 검증 항목                                                        | 통과 조건                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. `pnpm build:specs`                                            | CSS 생성 107개 (Panel.css 1개 감소 확인)                                                      |
| 2. `pnpm type-check`                                             | @composition/specs, @composition/shared, @composition/builder, @composition/publish 전부 성공 |
| 3. `grep -rn "Panel"` (spec/wrapper/CSS/runtime/UI/presets 범위) | 의도적 잔존(변수명, 주석 히스토리, Builder IDE의 "Panel" 용어) 외 0건                         |
| 4. 기존 `dashboardWithPanelTemplate`                             | Card 치환 후 템플릿 로드 시 시각 동일성 확인 (수동)                                           |
| 5. 신규 프로젝트 빈 캔버스 → 기본 Tabs 삽입                      | TabPanel 정상 동작, 에러 없음                                                                 |

## Consequences

### Positive

- SSOT D2 위반 1건 해소 (RSP 미규정 variant 5종 제거)
- 번들 감소: Panel.tsx, Panel.css, Panel presets (~150줄), legacy fallback 6개소 제거
- 대체 컴포넌트(Card/Section/Group) 3각 역할 분담 명확화
- 유지보수 부담 감소: Panel과 TabPanel의 역할 혼동 원천 차단

### Negative

- **Legacy 프로젝트 호환성 상실** — DB에 `tag: "Panel"` 요소가 저장된 기존 프로젝트는 로드 시 unknown tag로 처리됨. 마이그레이션 미수행 결정은 사용자 명시적 수용 (2026-04-15)
- 사용자 문서(없으면 생략), 스크린샷 가이드 등에 Panel이 언급된 경우 수동 업데이트 필요 — 별도 추적 없음
- AI 시스템 프롬프트에서 Panel 제거 → AI가 기존 Panel 생성 지시를 받을 경우 대체 컴포넌트(Card/Section) 추천하도록 프롬프트 업데이트 필요 (Phase 6에서 수행)
