## Phase 2: 컴포넌트별 5-레이어 교차 검증

**Step 0 — catalog 등록 선판정**: 컴포넌트 키가 `packages/shared/src/catalog/generated/componentRulesTable.ts` 의 `COMPONENT_RULES_TABLE` 에 존재하면 **catalog 경로** (variants/sizes/containerStyles 해당 키), 미존재 시에만 잔존 spec 경로 (Frame/Group/Slot 3개). 판정 후 아래 테이블 작성:

| 레이어               | 파일                                                                                                                                         | 검증 항목                                                                                                                 | 상태 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Catalog/Spec**     | catalog: `componentRulesTable.ts` 해당 키 + `catalog/bindings/{Name}.binding.ts` / 잔존 spec: `packages/specs/src/components/{Name}.spec.ts` | catalog: variants, sizes, containerStyles / 잔존 spec: render.shapes(), properties                                        |
| **Factory**          | `apps/builder/src/builder/factories/definitions/*.ts`                                                                                        | 기본 props, style, 자식 구조                                                                                              |
| **CSS Renderer**     | `packages/shared/src/components/styles/{Name}.css` + `styles/generated/{Name}.css`                                                           | data-variant/data-size 선택자, 토큰                                                                                       |
| **Skia Renderer**    | `tagSpecMap.ts` + `StoreRenderBridge.ts` + `buildBoxNodeData.ts` + `specTextStyle.ts` + `utils.ts`                                           | TAG_SPEC_MAP / isCatalogCutover, TEXT_BEARING_SPECS, INTRINSIC_MEASURE_TAGS (측정) · resolveDefaultDisplay (기본 display) |
| **Preview Renderer** | `packages/shared/src/renderers/*.tsx`                                                                                                        | variant/size props 전달, data-\* 속성                                                                                     |

## Phase 3: 정합성 검증 항목

각 컴포넌트에 대해 아래를 확인합니다:

### 3.1 Variant 정합성

- [ ] Spec `defaultVariant`와 React 컴포넌트 기본값 일치
- [ ] Spec `variants` 키와 CSS `[data-variant="..."]` 선택자 일치
- [ ] Preview 렌더러가 `variant` prop을 컴포넌트에 전달

### 3.2 Size 정합성

- [ ] Spec `defaultSize`와 React 컴포넌트 기본값 일치
- [ ] Size casing 일관성 (sm/md/lg, S/M/L 혼용 금지)
- [ ] Spec sizes의 fontSize/paddingX/paddingY/lineHeight/borderWidth가 CSS와 일치
- [ ] Preview 렌더러가 `size` prop을 컴포넌트에 전달

### 3.3 Skia 레이아웃 정합성

- [ ] `INTRINSIC_MEASURE_TAGS` (분류표 `INLINE_BLOCK_TAG_CLASSIFICATION`, utils.ts) 등록 여부 (fit-content 측정 필요 시 — 기본 display 는 catalog `containerStyles.display` 가 정본, ADR-923 Phase 5)
- [ ] `TEXT_BEARING_SPECS` 등록 여부 (텍스트 폭 측정 필요 시)
- [ ] `DEFAULT_SIZE_BY_TAG` 등록 여부
- [ ] `calculateContentWidth`의 `isFormElement` 경로 포함 여부
- [ ] `calculateContentHeight`의 `isButtonLike` 경로 포함 여부

### 3.4 토큰 정합성

- [ ] Spec TokenRef와 CSS 변수 매핑 일치 (css-tokens.md 참조)
- [ ] 금지된 M3 토큰 사용 없음
- [ ] `--bg-inset` / `{color.layer-2}` 필드 배경 통일 (해당 시)

### 상태 정합성

hover/disabled/focus 등 변경된 상태의 값은 현재 catalog와 theme/tokens에서 확인해
각 소비자에 대조합니다. 특정 시점의 숫자를 보편적 기준으로 사용하지 않습니다.
