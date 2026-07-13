# ADR-070 구현 상세 — MenuItem CSS 색상 SSOT (Codex 리뷰 v2)

> ADR 본문: [070-popover-item-css-ssot.md](../../completed/070-popover-item-css-ssot.md)

본 문서는 ADR-070 P1+P2 구현 상세 + 후속 ADR(B/C) 설계 준비를 정리한다.

> **scope 재정의 (Codex 리뷰 반영)**: 초안의 P3(ListBoxItem.spec 신설)은 simple archetype의 layout/size 동시 emit으로 ListBox.css와 cascade 충돌 → 별도 ADR로 분리. `states.selected` 색상은 VariantSpec.selectedBackground와 SSOT 분산 우려로 본 ADR scope에서 제외 → hover/disabled만 emit.

## Phase 분할

| Phase        | 작업                                                            | 영향 파일                                       | 위험 등급 | 예상 시간 |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------- | --------- | --------- |
| P1           | StateEffect 색상 필드 + Generator hover/disabled 색상 emit 분기 | state.types.ts, CSSGenerator.ts, snapshot tests | LOW       | 1.5h      |
| P2           | MenuItem.spec hover/disabled 색상 정의                          | MenuItem.spec.ts, generated/MenuItem.css        | LOW       | 0.5h      |
| Verification | Chrome MCP light/dark 시각 정합 + snapshot diff                 | —                                               | —         | 1h        |
| **합계**     |                                                                 |                                                 |           | **3h**    |

## P1: StateEffect + Generator 인프라 확장

### 변경 파일

| 파일                                               | 변경 내용                                                                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/types/state.types.ts`          | StateEffect interface에 optional 색상 필드 추가: `background?: TokenRef`, `text?: TokenRef`, `border?: TokenRef`. **selected 색상은 추가하지 않음** (VariantSpec.selectedBackground 단일 소스 유지) |
| `packages/specs/src/renderers/CSSGenerator.ts`     | `generateStateStyles` 확장: hover/disabled 분기에 background/color/border emit 추가. **selected 분기는 추가하지 않음** (Codex 지적)                                                                 |
| `packages/specs/src/renderers/__tests__/*.test.ts` | 영향 받는 4 test 파일 (snapshot/animationRewrite/sizeSelectors/rootSelectors) 중 snapshot test 1건만 update 예상 (MenuItem.css 색상 라인 추가)                                                      |

> **`generateBaseStyles` 미변경**: 본 ADR은 hover/disabled 한정. 기본 색상은 향후 대안 (variants 또는 baseColor 신설)으로 분리.

### Generator emit 패턴

```css
/* MenuItem 예시 */
.react-aria-MenuItem[data-hovered] {
  background: var(--bg-overlay);
}

.react-aria-MenuItem[data-disabled] {
  opacity: 0.38;
  color: color-mix(in srgb, var(--fg) 38%, transparent);
}

/* selected는 emit 안 함 — VariantSpec.selectedBackground가 정본 */
```

### 회귀 검증

- 108 CSS 재생성 후 git diff = MenuItem.css에 hover/disabled 색상 라인 추가만
- 다른 107개 CSS는 변경 0 (StateEffect 새 필드는 optional, 색상 미정의 spec은 emit 0 — no-op)
- snapshot test diff = MenuItem.css 1건
- archetype="simple" 26개 spec snapshot 변경 0
- ColorSwatch/Tag (states.selected 미사용 — 둘 다 variants.selected 사용) 변경 0

## P2: MenuItem.spec hover/disabled 색상 정의

### 변경 파일

| 파일                                             | 변경                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `packages/specs/src/components/MenuItem.spec.ts` | `states.hover.background` + `states.disabled.text` 색상 토큰 추가 |

### 토큰 차용 (ListBox.css ListBoxItem 패턴)

| 상태                | 적용 위치                 | 토큰                                                 |
| ------------------- | ------------------------- | ---------------------------------------------------- |
| hover               | `states.hover.background` | `{color.layer-1}` (= `var(--bg-overlay)`)            |
| disabled            | `states.disabled.text`    | `color-mix` 38% (현재 spec에 opacity 0.38 이미 존재) |
| **selected (제외)** | —                         | VariantSpec 패턴 채택 시 (본 ADR 외)                 |

### 검증

- `pnpm build:specs` → MenuItem.css에 색상 라인 추가 확인
- `index.css:139`에 `@import "./generated/MenuItem.css"` 이미 존재 (확인됨 — 추가 작업 불필요)
- Chrome MCP: Menu trigger 클릭 → popover dropdown → MenuItem hover/disabled 시각 정합

### RAC className 부여 전제

RAC `<MenuItem>`은 표준 동작으로 `react-aria-MenuItem` 클래스 자동 부여 (Menu.tsx에 명시 부여 코드 부재 — `Menu.tsx:554`의 wrapper도 className 전달 안 함). 셀렉터 매칭은 RAC 표준 동작에 의존.

## Verification 체크리스트

### Snapshot diff

- [ ] `pnpm build:specs` 실행
- [ ] `git diff packages/shared/src/components/styles/generated/` = MenuItem.css 색상 라인만 변경
- [ ] 다른 107 CSS 변경 0 확인
- [ ] archetype="simple" 26개 spec snapshot 변경 0 확인
- [ ] ColorSwatch/Tag snapshot 변경 0 확인 (states.selected 미사용)

### Chrome MCP

- [ ] dev 서버 시작
- [ ] Menu 추가 → trigger 클릭 → popover dropdown 표시
- [ ] light mode: MenuItem hover 시 약한 회색 배경, disabled 시 38% 텍스트 + opacity
- [ ] dark mode 토글: MenuItem hover/disabled 토큰 자동 반전
- [ ] selectionMode="none" 기본 → MenuItem selected 시각화 없음 (의도된 RAC 동작 — 본 ADR과 무관)

### Type-check

- [ ] `pnpm type-check` 3/3 PASS

## 후속 ADR 설계 준비

### ADR-B: Select/ComboBox items SSOT (ADR-068 패턴 확장) + renderMenu wiring

**상황**:

- `CollectionRenderers.tsx:761` `renderMenu`가 `element.props.selectionMode/selectedKeys/onSelectionChange`를 MenuButton에 안 넘김 → Inspector에서 selectionMode 변경해도 inner Menu 미반영
- Select/ComboBox는 ADR-068 패턴(items SSOT) 미적용 — children-manager 방식

**제안 작업**:

- Select/ComboBox에 ADR-068 패턴 적용 (items SSOT, StoredXxxItem 타입, ItemsManager UI)
- 부수: renderMenu wiring 정리 (selectionMode/selectedKeys 전달 path 보강)

**본 ADR과의 관계**: 본 ADR P2의 wiring 이슈도 함께 해소

### ADR-C: ListBoxItem.spec 신설 + ListBox skipCSSGeneration 해체

**상황 (Codex 통찰)**:

simple archetype `generateBaseStyles`가 layout/size 직접 emit:

```css
.react-aria-{Name} {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  /* + size별 height/padding/font-size/border-radius/gap */
}
```

ListBox.css의 `.react-aria-ListBoxItem`은 이미 `display: flex (column)`, `padding: var(--spacing) var(--spacing-md)`, `gap`, `font-weight`, `cursor`, `outline`, `transition` 등 구조 스타일 직접 정의 → 같은 셀렉터에 두 정의 충돌.

**결론**: ListBoxItem.spec 단독 신설 불가. ListBox.css 전체 해체 (구조+색상 동시 spec 이전)와 묶어 진행 필수.

### 표현 가능/불가능 매핑 (ADR-C 진입 시)

| 패턴                                                            | spec 표현                             | 비고                                      |
| --------------------------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| ListBoxItem 색상 (background/color)                             | ✅ 본 ADR 인프라                      | hover/disabled은 본 ADR P1 활용           |
| ListBoxItem 구조 (display/padding/gap)                          | ⚠️ archetype 또는 baseStyle 신설 검토 | simple과 다른 layout 필요                 |
| ListBox 컨테이너 색상 (`--bg-raised`, border, padding)          | ✅ ListBox.spec.states/baseStyle 활용 | 가능                                      |
| `--lb-accent`, `--lb-padding` 등 컴포넌트 내부 CSS 변수         | ⚠️ 부분                               | composition spec 또는 generator 확장 필요 |
| `[data-orientation="horizontal"]` / `[data-layout="grid"]` 분기 | ❌ 미지원                             | container variants 인프라 추가 필요       |
| Section/Header 슬롯 셀렉터                                      | ✅ slotStyles                         | 기존 인프라                               |
| `[slot="label"]`, `[slot="description"]` 자식 슬롯              | ✅ slotStyles                         | 동일                                      |
| `transition: all 150ms ease`                                    | ✅ states 단순 추가                   | 단순                                      |

### Phase 분할 (ADR-C 별도 ADR 시)

- **C1**: ListBoxItem.spec 신설 (구조 + 색상 동시) + ListBox.css의 ListBoxItem 부분 제거
- **C2**: ListBox 컨테이너 spec 색상 정의 + ListBox.css의 컨테이너 부분 제거
- **C3**: Section/Header 슬롯 spec 이전
- **C4**: orientation/layout 분기 — generator container variants 인프라 추가 (ROI 검토)

### Gate (ADR-C 진입 시 필수)

| Gate | 시점    | 통과 조건                                                                               | 실패 시 대안                                       |
| ---- | ------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| C-G1 | C1 후   | ListBoxItem 셀렉터 단일 정의 + Chrome MCP light/dark 시각 정합 + scroll/keyboard 회귀 0 | manual 잔존 (해체 보류)                            |
| C-G2 | C2 후   | ListBox 컨테이너 셀렉터 단일 정의 + Chrome MCP 회귀 0                                   | 동일                                               |
| C-G3 | C3 후   | Section/Header 슬롯 spec 표현                                                           | 동일                                               |
| C-G4 | C4 시도 | orientation/layout 분기 표현 가능 — generator 인프라 추가 필요                          | **인프라 부재 시 manual 잔존 100% OK** (강제 금지) |

### 권장 진행 순서

```
1. ADR-070 (본 ADR — P1 + P2)              ← 인프라 + MenuItem dark mode
2. ADR-B (Select/ComboBox items SSOT)       ← renderMenu wiring 동시 정리
3. ADR-C (ListBox 구조+색상 spec 이전)      ← ListBoxItem.spec 신설 + ListBox 해체
```

ADR-B 후 element tree 정리되면 ADR-C scope 자연 축소 가능.

## 롤백 계획

| Phase | 롤백 비용 | 방법                                                               |
| ----- | --------- | ------------------------------------------------------------------ |
| P1    | LOW       | git revert (StateEffect 필드 + Generator hover/disabled 분기 제거) |
| P2    | LOW       | MenuItem.spec 색상 필드 삭제 (3-4줄)                               |

## Gate 실행 결과 (2026-04-17)

### G1 — P1 완료 후 snapshot diff 검증: PASS

- `pnpm type-check` 3/3 PASS
- `pnpm build:specs`로 108 CSS 재생성 후 P1 단독 상태에서 `git diff packages/shared/src/components/styles/generated/` = **0 라인** (색상 미정의 spec은 emit 0 = no-op 확증)
- snapshot test `CSSGenerator.snapshot.test.ts`: 116/117 PASS. 1 FAIL(Menu.css)은 본 ADR 무관한 pre-existing debt(commit `0de6b33a feat(menu): enhance Menu component with variant support and styling` 이후 snapshot 미갱신 상태)임을 stash 분리 실측으로 확증
- archetype="simple" 26개 spec 및 ColorSwatch/Tag snapshot 변경 0

### G2 — P2 완료 후 Chrome MCP 시각 정합: PASS (구조 검증)

- P2 후 `git diff packages/shared/src/components/styles/generated/MenuItem.css` = **1 라인 추가** (`background: var(--bg-overlay);` in `[data-hovered]` block)
- Preview iframe에서 `.react-aria-MenuItem[data-hovered] { background: var(--bg-overlay); }` 규칙 로드 확증 (MCP javascript_tool로 CSSOM 측정)
- `--bg-overlay` 토큰 light = `#fafafa`, dark = `var(--color-neutral-800)` — preview-system.css line 166/299 양쪽 정의로 자동 반전 구조 보장
- RAC `<MenuItem>`이 `react-aria-MenuItem` 클래스 + `[data-hovered]` 속성 자동 부여하는 전제 실측 확증 (사용자가 제공한 popover DOM 분석)

## 추가 수행 작업 (본 ADR 범위 외 — Addendum 1)

본 ADR 구현 검증 중 사용자가 Menu popover 컨테이너 자체의 light/dark inverse 팔레트를 지적하여 다음 조치가 추가로 이루어짐. 자세한 배경과 후속 ADR-071 계획은 ADR-070 본문 Addendum 1 참조.

| 파일                                                       | 변경                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/specs/src/components/Menu.spec.ts`               | `skipCSSGeneration: true` 추가 + `skipVariantCss: true` 제거 (중복)                |
| `packages/shared/src/components/styles/Menu.css`           | **신규 수동 CSS** — ListBox.css의 `.react-aria-ListBox` 규칙 복제 (container 한정) |
| `packages/shared/src/components/Menu.tsx`                  | import 경로 `generated/Menu.css` → `Menu.css`                                      |
| `packages/shared/src/components/styles/index.css`          | 동일 경로 조정                                                                     |
| `packages/shared/src/components/styles/generated/Menu.css` | 삭제 (build:specs에서 재생성 안 됨)                                                |

### SSOT 부채 명시

- ADR-036 Spec-First 역행
- ADR-059 skipCSSGeneration 해체 역행 (+1건)
- ADR-063 D3 symmetric consumer 손상 (Skia=Spec 직접, DOM=수동 CSS)

ADR-071(Generator `containerStyles` 인프라)로 정방향 복원 예정.
