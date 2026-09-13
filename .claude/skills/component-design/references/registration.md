### 구현 순서 (composition 컴포넌트 — catalog cutover 체계, ADR-142/912/913/914)

> **시각 SSOT 는 spec 파일이 아니라 catalog 다.** spec 파일(`packages/specs/src/components/`) 신규 생성은 D1 ARIA 예외(현존 Frame/Group/Slot 3개 류)에만 허용.

1. **타입 + 기본 props** — `apps/builder/src/types/builder/unified.types.ts` 에 Props 타입 추가. 기본 props 는 `getDefaultProps(type)` 분기: catalog 파생 대상이면 `ENTRY_DERIVED_DEFAULT_TYPES` 등록 + `deriveDefaultPropsFromCatalog` (`types/builder/defaultPropsDerivation.ts`), 아니면 `DEFAULT_PROPS_MAP` literal row. `factories/entryUniverse.ts` facet 정합 확인 — `entryUniverseContract.test.ts` 의 INVENTORY freeze 카운트 갱신 (정본: `docs/adr/design/914-entry-universe-inventory.md`)
2. **시각 정본 (catalog)** — ① `packages/shared/src/catalog/bindings/{Component}.binding.ts` binding 작성 → ② `componentCatalog.ts` entry 등록 (kind/family/cutover/binding/panel) — cutover 게이트는 `getCatalogCutoverTypes()` → `cutover.ts::isCatalogCutover` 로 자동 파생 → ③ `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts` — build 산출물 아님, **직접 편집 정본**) 에 variants/sizes/fill rule 추가 → ④ `pnpm generate:css` 로 rule 기반 CSS 재생성
3. **Factory** — `apps/builder/src/builder/factories/definitions/` 에 생성 팩토리 등록 (자식 tree 필요 시 complex creator)
4. **Preview** — 기본은 catalog generic 경로(`apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`)로 자동 렌더. self-compose delegating(RAC/internal)이 필요할 때만 `packages/shared/src/renderers/` 에 renderer 추가 + `rendererMap` (`renderers/index.ts`) 등록
5. **Skia** — catalog 경로 1차: `buildCatalogShapes` (`packages/specs/src/renderers/buildCatalogShapes.ts`) + builder 측 rule 주입 `resolveSkiaVisualRule.ts`. `TAG_SPEC_MAP` (`apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`) 은 잔존 spec(D1 예외) 전용 예외 경로 — 신규 컴포넌트 등록 금지
6. **Property Editor** — 스타일 패널 에디터 추가 (필요 시)

**실무 사례**: commit `c936f54a3` (DialogFooter childSpec→catalog cutover, 2026-06-15) — binding 신설 → componentCatalog entry 등록 → CanonicalNodeRenderer 태그 매핑 → generate-css virtual CSS → spec 물리 삭제 순서가 위 절차와 일치.
