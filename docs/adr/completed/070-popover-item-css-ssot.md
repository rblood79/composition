# ADR-070: MenuItem CSS 색상 SSOT — StateEffect hover/disabled 색상 emit 인프라

> **SSOT domain**: D3 (시각 스타일) — popover 내 RAC `<MenuItem>`의 light/dark 시각 정합. CSSGenerator의 state 색상 emit 인프라(hover/disabled)를 신설하여 Spec → CSS 자동 파생 SSOT(ADR-036) 적용 범위를 확장한다. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), 선례: [ADR-068](068-menu-items-ssot-and-menuitem-spec.md).
>
> **Codex 리뷰 반영(2026-04-17)**: 초안의 "states.selected 신설"은 selected SSOT를 VariantSpec.selectedBackground와 분산시키는 위반으로 판정 → **selected 처리 본 ADR scope 제외**. 초안의 "ListBoxItem.spec 신설(P3)"은 simple archetype이 layout/size까지 함께 emit하여 manual ListBox.css와 cascade 충돌 → **ListBoxItem.spec은 별도 ADR(P4 묶음)로 분리**.

## Status

Implemented — 2026-04-17 (Codex 리뷰 반영 v2)

> Addendum 1 참조: Menu container 수동 CSS 임시 전환이 본 ADR 범위 외에서 추가 수행됨. ADR-071 후속 예정.

## Context

### 발단

ADR-068(2026-04-17 Implemented) 후 검증에서 **popover 내 `<MenuItem>` 의 light/dark 테마가 부조화** 함이 확인되었다. 동일 위치의 `<ListBoxItem>`(Select/ComboBox dropdown)은 manual `styles/ListBox.css`로 정상 동작 — 즉 두 쌍 모두 popover collection 패턴이지만 색상 SSOT 처리 방식이 다름.

### 근본 원인

`packages/specs/src/components/MenuItem.spec.ts`에 색상 토큰(background/color/border)이 정의되지 않았고, **CSSGenerator의 `generateStateStyles`가 색상 emit을 지원하지 않음**(`CSSGenerator.ts:771-830`은 boxShadow/transform/scale/opacity만 처리). variants는 `[data-variant="..."]` 셀렉터로만 emit되며 — RAC `<MenuItem>` 은 data-variant 자동 부여 안 함 → 셀렉터 미매치 → `generated/MenuItem.css`에 색상 라인 0건. RAC의 표준 동작으로 `<MenuItem>`은 자동 `react-aria-MenuItem` 클래스를 부여하므로 셀렉터 매칭 자체는 보장됨.

### 본 ADR scope (Codex 리뷰 후 축소)

| 포함                                                                                                                              | 제외                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1**: StateEffect에 optional 색상 필드 추가(background/text/border) + `generateStateStyles` 색상 emit 분기(hover/disabled 한정) | **selected 색상 처리** — 기존 `VariantSpec.selectedBackground/selectedText/selectedBorder` 활용 (ColorSwatch/Tag 선례). 본 ADR은 selected 미정의 → 셀렉터 emit 0         |
| **P2**: MenuItem.spec에 `states.hover` 색상 정의 (ListBox hover 토큰 차용)                                                        | **ListBoxItem.spec 신설** — simple archetype이 layout/size까지 함께 emit → manual ListBox.css 구조 정의와 cascade 충돌. ListBox skipCSSGeneration 해체와 묶어 별도 ADR로 |
| index.css에 `@import "./generated/MenuItem.css"` 등록 확인 (line 139에 이미 존재)                                                 | renderMenu의 `selectionMode/selectedKeys` wiring 누락(`CollectionRenderers.tsx:761`) — 본 ADR scope 외 (별도 fix 또는 후속 ADR-B에 흡수)                                 |

### Hard Constraints

1. `pnpm type-check` 3 tasks 통과
2. `pnpm build:specs` 정상 (CSS 개수 변동 없음 — MenuItem.css 색상 라인만 추가)
3. Chrome MCP light/dark 시각 정합 (Menu trigger dropdown의 MenuItem hover/disabled)
4. 기존 107개 CSS 파일 snapshot diff = 0 (StateEffect 새 필드는 optional, 색상 미정의 spec은 emit 0)
5. ADR-059 부합성 — skipCSSGeneration 신규 추가 금지

### Soft Constraints

- 본 ADR은 **D3 색상 SSOT 한정** — D2(items SSOT) 마이그레이션은 ADR-B(Select/ComboBox), 구조 SSOT(ListBox.css 해체)는 ADR-C(별도)
- `states.hover/disabled`만 색상 emit — selected는 향후 컴포넌트가 VariantSpec 패턴 채택 시 자동 적용
- MenuItem의 `selectionMode` 기본 "none" → MenuItem `[data-selected]` 셀렉터는 사용자가 selectionMode 명시 시에만 RAC가 부여 (의도된 RAC 동작) → 본 ADR과 무관

## Alternatives Considered

### 대안 A: Manual CSS 즉시 우회

- **설명**: `MenuItem.spec.skipCSSGeneration: true` 전환 + `styles/MenuItem.css` 새 파일 작성(ListBox 토큰 패턴 차용) + index.css `@import` 등록.
- **근거**: ListBox.css가 이미 동일 패턴으로 정상 동작 중 — 단순 복제로 즉시 회복 가능. 30초 작업.
- 위험:
  - 기술: **LOW** — 기존 패턴 답습
  - 성능: **LOW** — CSS 추가 1KB
  - 유지보수: **HIGH** — ADR-059(skipCSSGeneration 해체) 역행 채무 1건 추가. 미래 누군가 다시 해체 작업 필요
  - 마이그레이션: **LOW** — 1줄 복원으로 롤백 가능

### 대안 B: 통합 인프라 ADR (P1+P2 + ListBoxItem.spec + ListBox 해체 통합)

- **설명**: StateEffect 색상 emit + MenuItem 색상 + ListBoxItem.spec + ListBox skipCSSGeneration 해체를 단일 ADR에 통합.
- **근거**: popover collection 영역 D3 SSOT 완전 정합을 단일 ADR로 종결.
- 위험:
  - 기술: **HIGH** — Codex 리뷰 확증: simple archetype이 layout/size까지 emit하여 ListBox.css의 ListBoxItem 구조 정의(`display: flex (column)`, custom padding/gap/transition 등)와 cascade 충돌. ListBoxItem.spec 단독 진입 불가 — ListBox.css 전체 해체와 동시 진행 필수
  - 성능: **LOW**
  - 유지보수: **MEDIUM** — Generator 인프라 + ListBox manual CSS 동시 변경
  - 마이그레이션: **HIGH** — ListBox.css의 일부 패턴(`[data-orientation="horizontal"]`/`[data-layout="grid"]`/`--lb-*` 컴포넌트 내부 CSS 변수)이 현 generator로 표현 가능한지 미확정 → 부분 해체 위험

### 대안 C: 분리 ADR — 본 ADR은 P1+P2(MenuItem 한정), ListBoxItem.spec/ListBox 해체는 별도 ADR — **선정**

- **설명**: 본 ADR은 **MenuItem 색상 SSOT + StateEffect hover/disabled 색상 emit 인프라**로 좁힘. ListBoxItem.spec 신설은 **ListBox skipCSSGeneration 해체와 묶어 별도 ADR**로 진행 (구조+색상 동시 spec 이전이 의미적으로 옳음 — Codex 리뷰 통찰).
- **근거**: P1(인프라)+P2(MenuItem 색상)는 mechanical(추가형 변경, optional 필드, 단일 spec 색상). 회귀 검증 부담 낮음. ListBoxItem은 구조 충돌 위험 + ListBox.css 해체 의미 결합도 → 분리 진행이 정직. 외부 참고: ADR-068이 동일 분리 전략(Menu items SSOT만, Select/ComboBox는 후속) 적용해 성공.
- 위험:
  - 기술: **LOW** — optional 필드 추가, 단일 spec 색상 정의, hover/disabled emit 분기는 추가형
  - 성능: **LOW**
  - 유지보수: **LOW** — StateEffect에 색상 명시 필드 추가로 가독성↑
  - 마이그레이션: **LOW** — git revert 1건으로 전체 롤백

### Risk Threshold Check

| 대안 | 기술     | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | -------- | ---- | -------- | ------------ | :--------: |
| A    | LOW      | LOW  | **HIGH** | LOW          |     1      |
| B    | **HIGH** | LOW  | MEDIUM   | **HIGH**     |     2      |
| C    | LOW      | LOW  | LOW      | LOW          |     0      |

루프 판정: 대안 A는 HIGH 1건(채무), 대안 B는 HIGH 2건(구조 충돌 + 해체 미지수), 대안 C는 HIGH 0건. **대안 C 채택**. CRITICAL 0건이므로 근본 다른 접근 추가 불필요.

## Decision

**대안 C: 분리 ADR — 본 ADR은 MenuItem 한정 (P1+P2), ListBoxItem/ListBox 해체는 별도 ADR**을 선택한다.

선택 근거:

1. **HIGH 위험 0건** — 인프라 확장(StateEffect optional 필드)과 MenuItem 색상 정의는 모두 추가형 변경. 색상 미정의 spec은 emit 0 (no-op) 보장
2. **Codex 리뷰 반영 정직성** — selected SSOT는 VariantSpec.selectedBackground 단일 소스로 유지(분리 시도 포기), ListBoxItem은 구조 충돌 회피 위해 별도 ADR로 분리
3. **세션 cohesion** — ADR-068 검증 → Menu variants 추가 → button-base 정합 → skipVariantCss 신설 → MenuItem dark mode 흐름의 자연스러운 마무리. 인프라가 generator에 갖춰지면 후속 ADR이 안전하게 진행 가능
4. **롤백 비용 LOW** — 모든 변경이 optional 필드 + 추가 emit + 단일 spec 색상 → git revert 1건 복원

기각 사유:

- **대안 A 기각**: ADR-059 역행 채무 누적이 명백한 비용. 30초 절약 위해 미래 인프라 부담을 늘리는 것은 비합리
- **대안 B 기각**: Codex 리뷰가 확증한 구조 충돌(simple archetype이 layout/size 동시 emit) + ListBox.css 표현 한계 미지수가 ADR Implemented 판정을 불확실하게 만듦. ADR-068이 검증한 분리 전략 적용

> 구현 상세: [070-popover-item-css-ssot-breakdown.md](../design/completed/070-popover-item-css-ssot-breakdown.md)

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                                                                                     |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| G1   | P1 완료 후 | `pnpm build:specs` 후 git diff = MenuItem.css에 hover/disabled 색상 라인 추가만, 다른 107 CSS 변경 0. snapshot test diff 4 test 파일 중 영향 받는 파일은 MenuItem.css 1건 한정. **archetype="simple" 26개 spec snapshot 변경 0 확인** (색상 미정의 spec은 emit 0). **ColorSwatch/Tag 변경 0 확인** (states.selected 미사용) | StateEffect 필드 분기 조건 보강 (typeof check 등) 또는 영향 범위 좁히기 (archetype 화이트리스트) |
| G2   | P2 완료 후 | Chrome MCP light/dark 토글: Menu trigger dropdown의 MenuItem hover/disabled 시각 정합. RAC가 자동 부여하는 `react-aria-MenuItem` 클래스 + `[data-hovered]`/`[data-disabled]` 셀렉터 매칭 확인                                                                                                                               | spec 토큰 재조정 (예: hover background를 `{color.layer-1}` ↔ `{color.neutral-subtle}` 중 선택)   |

잔존 HIGH 위험 없음 (ListBoxItem 구조 충돌 + selected SSOT 분산 두 위험 모두 scope 외로 격리).

## Consequences

### Positive

- **MenuItem D3 SSOT 정합**: 색상이 Spec에서 단일 정의 → CSSGenerator로 자동 emit → light/dark theme 자동 정합. ADR-036 Spec-First 정신 popover MenuItem 영역에 확장
- **재사용 가능 인프라**: StateEffect hover/disabled 색상 emit 분기는 향후 다른 컴포넌트(예: 후속 ADR의 ListBoxItem.spec)에 동일 적용 가능
- **selected SSOT 단일성 유지**: VariantSpec.selectedBackground 단일 소스 보존 (Codex 지적 반영 — states.selected 색상 신설 회피)
- **ADR-068 패턴 후속**: MenuItem CSS 색상 정합 = ADR-068 D2(items SSOT) 정합과 짝을 이루는 D3 정합 완성

### Negative

- **selected 색상 미지원**: 본 ADR은 hover/disabled 한정. selected 색상이 필요한 컴포넌트는 VariantSpec.selectedBackground 패턴 사용 필수 (기존 ColorSwatch/Tag 선례)
- **ListBoxItem dark mode 미해결 (잔존)**: ListBoxItem 색상 SSOT 정합은 별도 ADR(ListBox skipCSSGeneration 해체와 묶음). 단, 현재 manual ListBox.css가 light/dark 정합 중이므로 사용자 영향 0
- **renderMenu wiring 이슈 잔존**: `CollectionRenderers.tsx:761` `renderMenu`가 `element.props.selectionMode/selectedKeys`를 MenuButton에 안 넘김 → Inspector에서 selectionMode 변경해도 inner Menu 미반영. 본 ADR scope 외 — 별도 fix 또는 후속 ADR-B(items SSOT)에 흡수
- **archetype="simple" 26개 spec 영향**: `generateStateStyles` 확장 시 hover/disabled 색상 emit 분기가 26개 simple archetype spec에 노출. 그러나 색상 미정의 spec은 emit 0 (no-op). G1 snapshot diff 0으로 회귀 0 검증

## 후속 ADR 로드맵

| ADR     | 내용                                                                                                                 | 본 ADR과의 관계                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ADR-071 | Generator `containerStyles` 인프라 + Menu container Spec 정방향 복원 (본 ADR Addendum 1에서 생긴 수동 CSS debt 해체) | **우선** — 본 세션에서 생긴 debt 즉시 청산 대상. Menu 한정이며 ListBox는 별도 ADR-C에서 표현 한계 실측 필요. |
| ADR-B   | Select/ComboBox items SSOT (ADR-068 패턴 확장) + renderMenu/CollectionRenderers wiring 정리                          | 본 ADR P2의 inner Menu wiring 이슈도 함께 해소 가능. ADR-068 후속 과제. ADR-071과 독립(D2 축)                |
| ADR-C   | ListBoxItem.spec 신설 + ListBox skipCSSGeneration 해체 (구조+색상 동시 spec 이전)                                    | 본 ADR P1 + ADR-071 인프라 활용. 단, ListBox.css의 `[data-orientation]`/`--lb-*` 등 표현 한계 사전 분석 필수 |
| ADR-D   | (선택) selected 색상 SSOT 통합 — VariantSpec.selectedBackground vs StateEffect.selected 정책 정본화                  | 본 ADR이 VariantSpec 단일 소스 유지 결정. 향후 selected 컴포넌트 증가 시 정본 ADR 필요할 수 있음             |

권장 진행 순서: **본 ADR(070)** → **ADR-071(Menu container 정방향 복원)** → **ADR-B(items SSOT 확장)** → **ADR-C(ListBox 구조+색상 spec 이전)** — ADR-071/ADR-B는 독립 축이므로 순서 교환 가능. ADR-B 후 element tree 정리되면 ADR-C scope 자연 축소 가능.

## Addendum 1 — Menu container 임시 수동 CSS 전환 (2026-04-17)

본 ADR 구현 검증 중 사용자가 Preview popover 내 **Menu 컨테이너**(`.react-aria-Menu`)의 light/dark 팔레트가 inverse(검은 배경/흰 텍스트) 상태임을 지적. MenuItem hover 배경(`var(--bg-overlay)`)이 이 inverse container 위에서 가시적 의미가 약화되었음. 근본 원인은 `Menu.spec.defaultVariant = "primary"`(= `{color.neutral}` = `var(--fg)`)가 `generateBaseStyles`에 의해 `.react-aria-Menu` base에 주입되어 발생. Menu.spec의 `variants`는 주석상 "Skia trigger button 색상 전용"이지만 `skipVariantCss: true`가 base의 `defaultVariant` 주입까지는 차단하지 않음.

### 본 ADR 범위 외 조치(debt 명시 수용)

사용자가 "Menu 컬러 스타일을 ListBox와 동일하게" 지시함에 따라 다음 **ADR-036/059/063 역행 방향** 조치를 수행:

- `Menu.spec.ts`: `skipCSSGeneration: true` + `skipVariantCss: true` 제거 (중복).
- `packages/shared/src/components/styles/Menu.css`: 수동 CSS 신규 작성(ListBox.css의 `.react-aria-ListBox` 규칙 복제 — `background: var(--bg-raised)` / `color: var(--fg)` / `border: 1px solid var(--border)` / `padding / gap / max-height / overflow / outline / data-focus-visible / data-empty`).
- `Menu.tsx`: `import "./styles/generated/Menu.css"` → `import "./styles/Menu.css"`.
- `styles/index.css`: 동일 경로 조정.
- `styles/generated/Menu.css`: 삭제 (build:specs에서 재생성되지 않음).

### SSOT 부채 인식

위 조치는 다음 정본과 명시적으로 **역방향**이다:

| 정본                           | 관계                                              |
| ------------------------------ | ------------------------------------------------- |
| ADR-036 Spec-First             | 역행 (Spec → 수동 CSS)                            |
| ADR-059 skipCSSGeneration 해체 | 역행 (수동 CSS 1건 신규 추가)                     |
| ADR-063 D3 symmetric consumer  | 손상 (Skia는 Spec 직접 참조, DOM은 수동 CSS 경유) |

본 Addendum은 이 부채를 **명시적으로 기록**하고, 후속 **ADR-071(Generator containerStyles 인프라 + Menu 정방향 복원)** 에서 해체하는 것을 전제한다.

### 근본 해결이 B 또는 C 경로를 요구하는 이유

- 경로 A(단일 Spec의 `defaultVariant` 조정): `generateBaseStyles`가 단일 palette만 주입하는 구조 제약으로 ListBox의 독립 container 스타일(`bg-raised` / `max-height` / `overflow` / `gap` 등)을 완전 재현 불가. 근사(ListBox `bg-raised` vs Menu `bg-overlay`)만 달성 + Skia Menu trigger 팔레트까지 동시 변경되는 부작용.
- 경로 B(Generator `containerStyles` 필드 신설): Menu/ListBox 등 dual-role spec의 container-전용 스타일을 variants 축과 분리 emit. 재사용 가능 인프라. **ADR-071 채택 방향.**
- 경로 C(Menu/MenuTrigger spec 구조 분리): 근본적이나 element tree 영향으로 ADR-068 규모 리팩토링. 경로 B 인프라 완성 후 선택적으로 재검토.

### ADR-071 예고 요점

- Generator 타입에 `containerStyles?: { background?: TokenRef; text?: TokenRef; border?: TokenRef; padding?: string; gap?: string; maxHeight?: string; overflow?: string; ... }` 추가.
- `generateBaseStyles`에서 `containerStyles` 존재 시 `defaultVariant.background/text/border` 주입을 스킵(override semantic) 또는 variants와 완전 분리.
- Menu.spec: `skipCSSGeneration: false` + `containerStyles = { background: "{color.bg-raised}", text: "{color.neutral}", ... }`(또는 등가 TokenRef) 정의. 수동 `Menu.css`는 해체.
- Gate: 다시 한 번 Chrome MCP 실측 정합 확인 + 108 CSS 중 Menu.css만 재도입, 다른 CSS 변경 0.
