# Button 조합 RSP 정합 — 자식 color 상속 + display 고정

## 작성일

2026-06-26

## 배경 — 문제 실증 (Chrome MCP 확인)

빌더에서 사용자가 Button 안에 Icon + Text 를 자식 element 로 직접 조합한 상태:

```
Button (primary variant, 검은 배경)
  ├ Icon  "settings"  color=검정(--fg)
  └ Text  "Text"      color=검정(--fg)
```

**증상**: Button 검은 배경 위 Icon·Text 가 둘 다 검정색 → 캔버스에서 빈 검은 박스로 보임 (아이콘·글자 묻힘).

**구조(D1)는 이미 RSP 정합** — `<Button><Icon/><Text/></Button>` 는 RSP 조합 모델 그 자체. 빠진 것은 그 구조에 따라와야 할 **시각 동작(D3)**:

- RSP: `<Button>` 에 color 1회 설정 → 자식 텍스트 + SVG(`currentColor`) 자동 상속 (자식 color override 0건).
- composition: 구조는 RSP인데 상속 메커니즘 부재 → 자식이 자체 `--fg` 고정 → 검정 위 검정.

## root cause (3 단절)

1. **단절 ① (CSS)**: leaf CSS 가 `color: var(--fg)` 명시 → Button 색 상속 차단. 위치: `generated/Text.css:21,34`, `generated/Icon.css:21,34`, `Label.css` 수동.
2. **단절 ② (Skia)**: Skia 에 부모 Button → 자식 color 전파 메커니즘 0건 (`grep parentColor|inheritColor` 0). 자식 `node.text.color` 는 자체 토큰.
3. **단절 ③ (CSS, 예방)**: Button `display: var(--btn-display, inline-flex)` / `justify-content: var(--btn-justify, center)` 변수화 — RSP 는 immutable 고정.

## SSOT 3-domain 위상

- **D1 (DOM/구조)**: 변경 없음. `<Button><Icon/><Text/></Button>` 구조 보존.
- **D2 (Props/API)**: 변경 없음.
- **D3 (시각 스타일)**: 본 작업 전부. CSS(Preview) ↔ Skia(Builder) **대등 대칭** — 동일 시각 결과.

## 결정 — context-aware 상속 (RSP 정확 복제)

leaf standalone 은 `var(--fg)` 유지, **Button(`.button-base`) 자식일 때만** Button color 상속. RSP 가 ToggleButton 에서 쓰는 `> span`/`> span > svg` 패턴과 동형. standalone 안전 + Button 안에서만 상속.

### 그룹 A — CSS color 상속 (Preview, 단절 ①·③ 일부)

`packages/shared/src/components/styles/Button.css` (수동, `@layer components`):

```css
.button-base {
  /* color: var(--button-text) 는 utilities.css:19 기존 */
  & > * {
    color: inherit;
  } /* ← 신규: 직계 자식 Icon/Text 가 Button 색 상속 */
}
```

- **방식 ①** (확정): generated CSS 무편집. `.button-base > *` 의 `inherit` 가 leaf 의 `color: var(--fg)` 명시를 이김 (specificity + cascade). "DO NOT EDIT MANUALLY" generated CSS 존중.
- Icon SVG 는 `stroke="currentColor"` (IconRenderers.tsx:39) → `color: inherit` 로 Button 색 따라감.
- specificity 동급 충돌 시 `.button-base > *` 직접 selector 로 우위 확보 (plan 단계 확정).

### 그룹 B — display 고정 (Preview, 단절 ③)

`Button.css` 변수 → RSP immutable 고정:

```css
/* 현재 */
display: var(--btn-display, inline-flex);
justify-content: var(--btn-justify, center);
/* 변경 */
display: inline-flex;
justify-content: center;
```

- `--btn-display` / `--btn-justify` 변수 정의처 grep 후 orphan 제거.
- `align-items: center` 는 이미 고정 (Button.css:5).
- 예방적 정합 — 실제 깨짐 증상 없음, RSP 구조 immutability 보장 목적.

### 그룹 C — Skia color 전파 (Builder, 단절 ②)

Collection Item font 패턴 차용. 자식 Text/Icon node 빌드 시 부모가 Button(`.button-base`)이면 Button 의 resolved `--button-text` 색을 자식에 주입:

- `node.text.color` ← Button color (Text 자식)
- Icon stroke ← Button color (Icon 자식)
- 위치: `buildSpecNodeData.ts` 자식 color 결정 지점 + ElementSprite `parentDelegated` selector (plan 단계 grep 확정).
- standalone(부모≠Button) 은 기존 `--fg` 유지 — context-aware.

### 그룹 D — Skia display 정합 검증 (Builder)

Button 이 Taffy 에서 inline-flex (가로 중앙 + gap) 고정인지 확인. CSS 고정값 전환 후 `/cross-check` 로 양 경로 시각 대칭 검증.

## 데이터 흐름

### CSS 경로 (Preview)

```
.button-base { color: var(--button-text) }   ← Button 자신 (기존)
   ↓ CSS 상속
.button-base > * { color: inherit }          ← 신규 (그룹 A)
   ↓
  Text: color: var(--fg) 명시 ──┐
  Icon SVG: stroke=currentColor ┴→ inherit 가 명시 이김 → Button 색 적용
```

### Skia 경로 (Builder)

```
buildSpecNodeData: Button node resolved color(--button-text) 계산
   ↓ 부모가 .button-base 면 (그룹 C)
자식 Text node.text.color ← Button color
자식 Icon stroke ← Button color
```

## 검증 (완료 기준 — live behavior 게이트)

1. `pnpm type-check` PASS (baseline 69).
2. `/cross-check` — CSS↔Skia 시각 대칭 (color 상속 + display 고정).
3. **live exercise (Chrome MCP)**: 실증한 동일 Button(primary, Icon "settings" + Text) 에서 **Preview·Builder 양쪽 Icon/Text 가 흰색(Button color) 상속하여 검은 배경 위 보이는지** 확인.
4. display: Button variant 바꿔도 가로 중앙 정렬 유지.

## 범위 가드

- D3 시각만. D1(DOM 구조)/D2(props) 무변경.
- generated CSS 무편집 (방식 ①).
- `.button-base` 적용 컴포넌트(Button/ToggleButton) 한정. 다른 컨테이너 무영향.
- icon 토글 자동생성(프로퍼티 → 자식 element) 은 본 작업 제외 — 구조는 이미 수동 조합으로 존재.

## ADR-915 와의 관계

별개 주제. ADR-915 = 폼 prop parity 복원(D2). 본 작업 = Button 조합 시각 상속(D3). 미커밋 상태인 ADR-915 design breakdown(P1.5-c dead 기록)과 독립.
