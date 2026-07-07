---
name: component-design
description: 새 UI 컴포넌트를 생성/설계하거나 기존 컴포넌트의 구조를 변경(catalog 등록, S2 전환)해야 할 때 발동. 단순 버그 수정/스타일 변경에는 사용하지 않는다.
TRIGGER when: user mentions "새 컴포넌트", "컴포넌트 만들어", "컴포넌트 구현", "컴포넌트 설계", "S2 전환", "S2 기능 추가", "컴포넌트 추가", "new component", "implement component", "design component", or asks to create, design, or implement a new UI component for composition.
user-invocable: true
scope: 새 컴포넌트 생성 또는 기존 컴포넌트의 구조적 변경 (단순 버그 수정, 스타일 변경은 제외)
---

# Component Design Skill

Skill 문서를 활용하여 컴포넌트를 설계하고 구현하는 통합 워크플로우입니다.

## 워크플로우 개요

```
1. 리서치 (React Aria / Spectrum Skill 문서)
2. 구현 (Read/Write/Edit + composition-patterns)
3. 타입 검증 (pnpm type-check)
4. 시각적 검증 (Chrome MCP, 선택)
```

## Phase 1: React Aria 리서치

새 컴포넌트 구현 전 프로젝트 내 Skill 문서로 공식 API와 패턴을 조사한다.

### 1-1. 컴포넌트 문서 확인

```
Read .claude/skills/react-aria/references/components/{ComponentName}.md
```

대상 컴포넌트의 API, Props, 사용 예제, 접근성 패턴을 확인한다.

### 1-2. 가이드/훅 참조 (필요 시)

```
Read .claude/skills/react-aria/references/guides/collections.md    → 컬렉션 패턴
Read .claude/skills/react-aria/references/guides/selection.md      → 선택 패턴
Read .claude/skills/react-aria/references/guides/forms.md          → 폼 패턴
Read .claude/skills/react-aria/references/interactions/usePress.md → 인터랙션 훅
```

### 1-3. React Spectrum S2 참조 (디자인 시스템 비교 시)

```
Read .claude/skills/react-spectrum/references/components/{ComponentName}.md
```

Adobe의 Spectrum 2 디자인 시스템 구현을 참조하여 composition 컴포넌트와 비교한다.

### 1-4. 조사 결과 정리

- 사용할 React Aria hooks/components 목록
- Props 인터페이스 설계 기준
- 키보드/접근성 요구사항
- composition 컨벤션과의 매핑 포인트

## Phase 2: 구현

composition-patterns 스킬의 규칙을 따르며 구현한다.

### 구현 순서 (composition 컴포넌트 — catalog cutover 체계, ADR-142/912/913/914)

> **시각 SSOT 는 spec 파일이 아니라 catalog 다.** spec 파일(`packages/specs/src/components/`) 신규 생성은 D1 ARIA 예외(현존 Frame/Group/Slot 3개 류)에만 허용.

1. **타입 + 기본 props** — `apps/builder/src/types/builder/unified.types.ts` 에 Props 타입 추가. 기본 props 는 `getDefaultProps(type)` 분기: catalog 파생 대상이면 `ENTRY_DERIVED_DEFAULT_TYPES` 등록 + `deriveDefaultPropsFromCatalog` (`types/builder/defaultPropsDerivation.ts`), 아니면 `DEFAULT_PROPS_MAP` literal row. `factories/entryUniverse.ts` facet 정합 확인 — `entryUniverseContract.test.ts` 의 INVENTORY freeze 카운트 갱신 (정본: `docs/adr/design/914-entry-universe-inventory.md`)
2. **시각 정본 (catalog)** — ① `packages/shared/src/catalog/bindings/{Component}.binding.ts` binding 작성 → ② `componentCatalog.ts` entry 등록 (kind/family/cutover/binding/panel) — cutover 게이트는 `getCatalogCutoverTypes()` → `cutover.ts::isCatalogCutover` 로 자동 파생 → ③ `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts` — build 산출물 아님, **직접 편집 정본**) 에 variants/sizes/fill rule 추가 → ④ `pnpm generate:css` 로 rule 기반 CSS 재생성
3. **Factory** — `apps/builder/src/builder/factories/definitions/` 에 생성 팩토리 등록 (자식 tree 필요 시 complex creator)
4. **Preview** — 기본은 catalog generic 경로(`apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`)로 자동 렌더. self-compose delegating(RAC/internal)이 필요할 때만 `packages/shared/src/renderers/` 에 renderer 추가 + `rendererMap` (`renderers/index.ts`) 등록
5. **Skia** — catalog 경로 1차: `buildCatalogShapes` (`packages/specs/src/renderers/buildCatalogShapes.ts`) + builder 측 rule 주입 `resolveSkiaVisualRule.ts`. `TAG_SPEC_MAP` (`apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`) 은 잔존 spec(D1 예외) 전용 예외 경로 — 신규 컴포넌트 등록 금지
6. **Property Editor** — 스타일 패널 에디터 추가 (필요 시)

**실무 사례**: commit `c936f54a3` (DialogFooter childSpec→catalog cutover, 2026-06-15) — binding 신설 → componentCatalog entry 등록 → CanonicalNodeRenderer 태그 매핑 → generate-css virtual CSS → spec 물리 삭제 순서가 위 절차와 일치.

### React Aria 내재화 원칙

- 외부 라이브러리 추가 설치 금지 (번들 500KB 제약)
- React Aria hooks/components는 이미 프로젝트 의존성 — 직접 import 가능
- React Aria 패턴을 composition 컨벤션에 맞게 변환:
  - 스타일링 → tv() + CSS
  - 상태 → Zustand 슬라이스
  - 렌더링 → catalog rule (`COMPONENT_RULES_TABLE`) + Skia `buildCatalogShapes`

## Phase 3: 타입 검증

구현 완료 후 타입 진단을 확인한다.

```bash
pnpm type-check
```

- 에러 0개 확인
- 경고 검토 및 필요 시 수정

## Phase 4: 시각적 검증 (Chrome MCP, 선택)

Storybook이나 개발 서버로 실제 렌더링을 확인한다.

### 4-1. 탭 준비

```
mcp__claude-in-chrome__tabs_context_mcp(createIfEmpty: true)
mcp__claude-in-chrome__tabs_create_mcp()
```

### 4-2. Storybook/Dev 서버 이동

```
mcp__claude-in-chrome__navigate(url: "http://localhost:6006", tabId: {tabId})
# 또는
mcp__claude-in-chrome__navigate(url: "http://localhost:5173", tabId: {tabId})
```

### 4-3. 시각적 확인

```
mcp__claude-in-chrome__computer(action: "screenshot", tabId: {tabId})
```

- 레이아웃 정렬 확인
- 인터랙션 동작 확인
- 반응형 크기 확인

## Phase 생략 조건

| Phase                | 생략 가능 조건                                        |
| -------------------- | ----------------------------------------------------- |
| Phase 1 (React Aria) | React Aria 미지원 컴포넌트, 단순 버그 수정            |
| Phase 3 (type-check) | 생략 불가 — Stop hook 이 `.ts/.tsx` 변경 시 자동 실행 |
| Phase 4 (Chrome)     | 서버 미실행, 시각적 변화 없는 수정                    |

## 산출물 템플릿

### Phase 1 리서치 산출물

| 항목             | 내용                                              |
| ---------------- | ------------------------------------------------- |
| React Aria hooks | (사용할 hooks/components 목록)                    |
| Props 인터페이스 | (핵심 props 설계)                                 |
| 접근성 요구사항  | (키보드 네비게이션, ARIA 패턴)                    |
| composition 매핑 | (tv() 스타일, Zustand 연동, catalog rule/binding) |

### Phase 2 구현 체크리스트

- [ ] 타입 + 기본 props (`unified.types.ts` `getDefaultProps` 분기 / `deriveDefaultPropsFromCatalog`)
- [ ] `entryUniverse.ts` facet 정합 (`entryUniverseContract.test.ts` INVENTORY 카운트)
- [ ] catalog binding + entry (`bindings/{Component}.binding.ts` + `componentCatalog.ts`)
- [ ] catalog rule (`COMPONENT_RULES_TABLE`) + `pnpm generate:css`
- [ ] Factory 정의 (`factories/definitions/`)
- [ ] Preview 경로 확인 (generic `CanonicalNodeRenderer` 또는 delegating `rendererMap`)
- [ ] Skia catalog 경로 확인 (`buildCatalogShapes` — 신규 `TAG_SPEC_MAP` 등록 금지)
- [ ] Property Editor (선택)
- [ ] `/cross-check` 렌더링 정합성 검증

## Evals

### Positive (발동해야 하는 경우)

- "DateTimePicker 컴포넌트 새로 만들어줘" → ✅ 새 컴포넌트 생성 워크플로
- "Select에 S2 기능 추가하고 싶어" → ✅ S2 전환 워크플로
- "Tabs 컴포넌트 설계해줘" → ✅ 컴포넌트 설계
- "React Aria 기반으로 Dialog 구현" → ✅ React Aria 컴포넌트 구현

### Negative (발동하면 안 되는 경우)

- "Button 색상 버그 수정" → ❌ 버그 수정 → systematic-debugging
- "CSS만 변경해줘" → ❌ 스타일 수정, 컴포넌트 구조 변경 아님
- "Store 리팩토링" → ❌ 상태 관리 작업
- "기존 컴포넌트 삭제해줘" → ❌ 삭제 작업, 설계 워크플로 불필요
