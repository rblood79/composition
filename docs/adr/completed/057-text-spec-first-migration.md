# ADR-057: specShapeConverter Text Shape Feature Parity 이식

> **SSOT domain**: D3 (시각 스타일). Text 컴포넌트의 Skia consumer가 Spec 시각 정의를 소비하는 경로 복원. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](063-ssot-chain-charter.md).

## Status

Implemented — 2026-04-10 (commit `475d8168`)

## 원칙 — Spec SSOT + Symmetric Consumers (ADR-036 준수)

본 ADR의 모든 의사결정은 다음 원칙에 기반한다:

1. **Spec이 SSOT**. `typography` 토큰을 포함한 spec 정의가 유일한 source이며, Preview/Publish(DOM/CSS)와 Builder(Skia)는 모두 이 spec의 **대등한 consumer**다. 어느 consumer도 다른 consumer의 기준이 아니다.

2. **CSS와 Skia는 symmetric pipeline**. "CSS가 기준, Skia가 따라간다"가 아니라, 두 경로가 동일 spec source로부터 동일 결과를 산출하는지 교차 검증한다.
   - `typography` 토큰 → CSS 변수 → browser CSS engine → Preview/Publish
   - `typography` 토큰 → spec `shapes()` → Skia → Builder Canvas

3. **ADR-057의 본질**. ADR-005(2026-03-03 Implemented)가 이미 Skia 렌더러(`nodeRendererText.ts`)와 공유 유틸(`textWrapUtils.ts`)에 CSS 텍스트 래핑 에뮬레이션을 **완전히 구현**했다. 그러나 **상류 조립 파이프라인**(`buildSpecNodeData.ts` + `specShapeConverter.ts`)이 해당 필드를 `SkiaNodeData.text`에 완전히 주입하지 않아 spec 경로에서 renderer의 기존 구현이 소비되지 않는다. ADR-057은 이 **상류 조립 파이프라인의 주입 누락**을 해결한다.

4. **Phase 분할의 의미**. 13개 필드는 "CSS가 가진 기능을 Skia가 못 가짐"이 아니라 **"상류 조립 파이프라인의 주입 범위가 부분적"**이라는 것이다. Layout 영향 필드(`layoutVersion` 트리거 필요)와 Paint 영향 필드로 분리하여 blast radius를 축소한다.

5. **≤1px 정합성의 의미**. 두 consumer가 동일 source로부터 대칭 파생되는지 검증하는 것. 회귀 발생 시 **"어느 consumer가 spec을 잘못 해석했는가"**로 분류하며, CSS/Skia 중 어느 쪽도 특권화하지 않는다.

   | 증상                          | 1차 조사 지점           | 가능한 원인                                                   |
   | ----------------------------- | ----------------------- | ------------------------------------------------------------- |
   | Preview만 틀림                | CSS consumer 경로       | CSSGenerator, `@layer components` cascade, variable           |
   | Skia만 틀림                   | Skia consumer 경로      | `buildSpecNodeData`, `specShapeConverter`, `nodeRendererText` |
   | Preview + Skia 동일 방향 오류 | Spec source             | 토큰 값 / `spec.sizes` / `spec.variants` 정의                 |
   | Preview + Skia 상이 방향 오류 | 양쪽 consumer 독립 오역 | spec 인터페이스 모호성                                        |

## Context

### 핵심 상황

**ADR-005 (2026-03-03 Implemented)** — CSS 텍스트 래핑 속성(`white-space`, `word-break`, `overflow-wrap`, `text-overflow`, `overflow`)에 대한 CanvasKit 에뮬레이션이 **이미 완료**되어 있다. CanvasKit 0.40은 `wordBreak`/`breakStrategy` 같은 네이티브 API를 제공하지 않으므로, `paragraph.layout(width)` 조절과 토큰 분할을 이용한 에뮬레이션 방식이 `nodeRendererText.ts` + `textWrapUtils.ts`에 구현되었다.

### Spec 경로의 상류 조립 파이프라인

현재 spec 경로(`Button`/`Badge`/`Label`/`Description`/`InlineAlert`)는 아래 3단계를 거친다:

```
1. Spec의 shapes() 함수 → Shape[] 반환
         ↓
2. specShapesToSkia() (specShapeConverter.ts:140)
   — Shape[] → SkiaNodeData 변환 (text shape은 L671~818)
         ↓
3. buildSpecNodeData() 후처리 (buildSpecNodeData.ts:707~775)
   — element.props.style을 SkiaNodeData.text로 override
         ↓
   nodeRendererText (ADR-005 에뮬레이션 소비)
```

### 현재 결손의 실제 위치 (실측 2026-04-10)

**결손 지점 1 — `specShapeConverter.ts:775~780`**:

```typescript
let decoration: number | undefined;
if (shape.textDecoration === "underline") {
  decoration = 1;
} else if (shape.textDecoration === "line-through") {
  decoration = 4;
}
```

- `underline`(1)/`line-through`(4)만 처리, `overline`(2) 미지원
- 조합 비트마스크(예: underline+line-through) 미지원
- `decorationStyle`(solid/double/dotted/dashed/wavy), `decorationColor` 미지원

**결손 지점 2 — `buildSpecNodeData.ts:749~765`**:

```typescript
if (specNode.children) {
  const labelNowrap = isLabelInNowrapParent(element, elementsMap);
  const isNowrapTag = tag === "Tag" || tag === "Badge";

  for (const child of specNode.children) {
    if (child.type === "text" && child.text) {
      const effectiveWhiteSpace =
        (style.whiteSpace as string) ??
        (labelNowrap || isNowrapTag ? "nowrap" : undefined);
      if (effectiveWhiteSpace) {
        child.text.whiteSpace = effectiveWhiteSpace as ...;
      }
    }
  }
}
```

- **현재 `whiteSpace`만 부분 주입 중** — Tag/Badge 기본 nowrap + Label-in-nowrap-parent 상속 + `style.whiteSpace` override
- 나머지 12개 필드(`wordBreak`, `overflowWrap`, `textIndent`, `clipText`, `textOverflow`, `wordSpacing`, `fontVariant`, `fontStretch`, `textShadows`, `verticalAlign`, `lineHeight` override, `textDecoration` override)는 **전혀 주입 안 됨**

### 구현 매트릭스 (실측)

| #   | Feature                        | `SkiaNodeData.text` 타입 |   `nodeRendererText.ts` 처리   |                                     상류 조립 주입 현황                                     |
| --- | ------------------------------ | :----------------------: | :----------------------------: | :-----------------------------------------------------------------------------------------: |
| 1   | `whiteSpace`                   |            ✅            |  ✅ (L101~146, textWrapUtils)  |                  🟡 `buildSpecNodeData.ts:749~765` Tag/Badge 특수 케이스만                  |
| 2   | `wordBreak`                    |            ✅            | ✅ (L112~492, 4분기 완전 처리) |                                             ❌                                              |
| 3   | `overflowWrap`                 |            ✅            |         ✅ (L113~473)          |                                             ❌                                              |
| 4   | `lineHeight`/`leading`         | ✅ (`heightMultiplier`)  |               ✅               |         🟡 `specShapeConverter.ts:686~690`에서 spec 기본값만 (style override 불가)          |
| 5   | `textIndent`                   |         ✅ (L86)         |      ✅ (L120, 293, 582)       |                                             ❌                                              |
| 6   | `clipText` (`overflow`→clip)   |         ✅ (L89)         |         ✅ (L124, 572)         |                                             ❌                                              |
| 7   | `textDecoration`               |            ✅            |               ✅               | 🟡 `specShapeConverter.ts:775~780`에서 underline/line-through만 (overline/style/color 누락) |
| 8   | `textOverflow`                 |         ✅ (L83)         |           ✅ (L122)            |                                             ❌                                              |
| 9   | `wordSpacing`                  |         ✅ (L71)         |      ✅ (L139, 371, 515)       |                                             ❌                                              |
| 10  | `fontVariant`                  |         ✅ (L87)         |      ✅ (L136, 353, 437)       |                                             ❌                                              |
| 11  | `fontStretch`                  |         ✅ (L88)         |      ✅ (L137, 336, 438)       |                                             ❌                                              |
| 12  | `textShadow` (`textShadows[]`) |         ✅ (L91)         |         ✅ (L222~224)          |                                             ❌                                              |
| 13  | `verticalAlign`                |         ✅ (L79)         |         ✅ (L154~204)          |                                             ❌                                              |

**결론**:

- 하류(`nodeRendererText.ts` + `textWrapUtils.ts`) — 13개 feature 전부 구현 완료
- `SkiaNodeData.text` 타입 — 13개 필드 전부 정의 완료
- 상류 조립 (`buildSpecNodeData.ts` + `specShapeConverter.ts`) — **2개 필드만 부분 구현** (`whiteSpace` + `textDecoration` 일부)
- 본 ADR의 실제 작업: **상류 조립 2개 지점 확장** — 파일 2개, 코드 약 30~50줄 추가

### Hard Constraints

1. **기존 spec 경로 사용자(Button/Badge/Label/Description/InlineAlert) 회귀 없음** — 필드 주입이 renderer의 기본값 fallback 경로와 충돌하지 않아야 한다. StylesPanel에서 필드를 설정하지 않은 경우 현재 동작과 동일해야 한다. 특히 `buildSpecNodeData.ts:749~765`의 기존 whiteSpace 특수 케이스(Tag/Badge nowrap, Label-in-nowrap-parent) 동작이 유지되어야 한다.
2. **ADR-005 에뮬레이션 로직 불변** — `nodeRendererText.ts`와 `textWrapUtils.ts`의 구현은 **변경하지 않는다**. 본 ADR의 작업 범위는 **2개 파일**에 한정된다:
   - `buildSpecNodeData.ts:749~765` — 기존 whiteSpace-only loop를 13개 필드 전체 override로 확장
   - `specShapeConverter.ts:775~780` — `textDecoration` 비트마스크를 overline 포함 풀셋으로 확장
3. **Layout 영향 감지 메커니즘 정합성** — 본 ADR의 필드 주입은 아래 3개 계층과 정합해야 하며, **대부분 이미 정합되어 있어 추가 등록 불필요**. Codex 재검증(2026-04-10)으로 확인된 실제 코드 구조:
   - **`apps/builder/src/builder/stores/utils/elementUpdate.ts:19~70` `NON_LAYOUT_PROPS_UPDATE`** (블랙리스트) — style-level layout 감지. `textDecoration`/`textDecorationColor`/`textDecorationStyle`/`textShadow`가 Paint-only로 이미 등록됨 → Phase B Paint 필드와 정합
   - **`elementUpdate.ts:73~87` `INHERITED_LAYOUT_PROPS_UPDATE`** (자식 상속) — `whiteSpace`/`wordBreak`/`overflowWrap`/`lineHeight`/`letterSpacing`/`wordSpacing` 등 Phase A Layout 필드가 이미 상속 대상으로 등록됨
   - **`apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:100~133` `LAYOUT_PROP_KEYS`** (props-level) — `element.props.*` 수준 키 (`children`/`size`/`value`/`iconName`/`formatOptions` 등). `style.*` 필드와 **무관**. 본 ADR의 style 필드 주입 작업과 **독립적**
   - **`LAYOUT_AFFECTING_PROPS`는 현재 코드에 존재하지 않는다** (apps/builder/src 내 grep 0건). 이전 ADR 버전의 오표기. 본 ADR은 해당 심볼을 참조하지 않는다
   - Phase A Gate에서 `textIndent`/`overflow`/`textOverflow`/`fontVariant`/`fontStretch`/`verticalAlign` 등 두 집합 모두에 없는 필드의 감지 동작을 실측 확인. 누락 발견 시 `elementUpdate.ts` 해당 집합에 추가
4. **60fps 유지** — 필드 주입이 per-frame 비용을 저해하지 않아야 한다. 기존 loop 내 필드 확장이므로 추가 순회 비용 없음.
5. **`button-text-wrapping-css-skia-parity.md` 5-layer 체크리스트 통과** — `measureWrapped` / `verifyLines` / `specShapeConverter paddingTop/Bottom` / `computeDrawY` / `lineHeightPx fallback` 전 경로 재검증
6. **`SkiaNodeData.text` 인터페이스 확장 불필요** — 대부분 필드는 이미 정의되어 있음 (`nodeRendererTypes.ts` 실측). 타입 변경 없음.
7. **ADR-036 Spec-First / ADR-005 CSS Text Wrapping / ADR-100 Unified Skia / ADR-021 Theme** 모두 공존

### Soft Constraints

- ADR-058 (TEXT_TAGS 해체)의 선결 조건 확보
- StylesPanel Typography 편집이 모든 spec 경로 컴포넌트에서 동일 동작
- 향후 `font-feature-settings`, variable font 추가 시 `buildSpecNodeData` override loop + `specShapeConverter` 2곳만 수정

## Alternatives Considered

### 대안 A: 현상 유지

- 설명: 상류 조립의 부분 구현을 영속화. 사용자는 Button/Badge에 Typography 고급 속성을 설정할 수 없음을 수용.
- 근거: 최소 변경, 회귀 위험 제로
- 위험:
  - 기술: L — 변경 없음
  - 성능: L — 현상 유지
  - 유지보수: **H** — ADR-036 SSOT 위반 영속화, ADR-058 봉쇄, StylesPanel inconsistency 지속
  - 마이그레이션: L

### 대안 B: `nodeRendererText`가 `element.props.style`을 직접 조회

- 설명: renderer가 `SkiaNodeData.text` 대신 `element.props.style`을 직접 읽도록 변경
- 근거: 상류 조립 파이프라인 수정 없이 해결
- 위험:
  - 기술: M — renderer가 shape 추상화를 우회
  - 성능: L
  - 유지보수: **H** — renderer가 element props에 결합 → SkiaNodeData 데이터 모델 깨짐, Spec-First 원칙 역행
  - 마이그레이션: M
- 기각: ADR-036 위반

### 대안 C: 상류 조립 파이프라인 2개 지점 확장 + Layout/Paint 단계 분할 (본 제안)

- 설명:
  - **`buildSpecNodeData.ts:749~765`** — 기존 whiteSpace-only override loop를 **일반화**하여 12개 추가 필드(`wordBreak`, `overflowWrap`, `textIndent`, `clipText`(`overflow: hidden/clip` 파생), `textOverflow`, `wordSpacing`, `fontVariant`, `fontStretch`, `textShadows`(parseTextShadow 재사용), `verticalAlign`, `lineHeight` override, `textDecoration` override)를 같은 loop에서 `style.*` → `child.text.*` 주입
  - **`specShapeConverter.ts:775~780`** — `decoration` 비트마스크를 풀셋으로 확장 (underline + overline + line-through 조합 + `decorationStyle`/`decorationColor`)
  - Phase A (Layout 영향 6개) → Phase B (Paint 영향 7개)로 분할하여 검증 단계화. Renderer는 변경하지 않음.
- 근거:
  - ADR-036 Spec-First 준수 — 상류 조립이 SSOT 경로
  - ADR-005 기존 구현 완전 재사용 — `nodeRendererText` + `textWrapUtils`는 불변
  - 기존 whiteSpace override 패턴을 **일반화**하는 작업이므로 새 패턴 도입이 아님
  - Phase 분할로 `layoutVersion` 트리거 필요 필드(A)와 paint-only 필드(B)의 검증 비용 독립화
  - 작업 범위가 좁은 2개 지점에 집중 (`buildSpecNodeData.ts`의 단일 loop + `specShapeConverter.ts`의 decoration 분기)
- 위험:
  - 기술: **L** — renderer 무변경, 기존 override 패턴 일반화. 기존 사용자 회귀 리스크 최소
  - 성능: L — loop 내 필드 분기 추가만, per-frame 비용 무영향
  - 유지보수: **L** — 단일 지점 SSOT로 수렴
  - 마이그레이션: **L** — `buildSpecNodeData.ts` loop 확장 + `specShapeConverter.ts` decoration 분기 확장 + `LAYOUT_AFFECTING_PROPS`/`LAYOUT_PROP_KEYS` 2곳 등록

### 대안 D: 신설 `textShape v2` 인터페이스 병존

- 설명: 새 `textShape` 인터페이스를 정의하고 기존 5개 사용자를 점진 이전
- 근거: 기존 API 완전 보호
- 위험:
  - 기술: **H** — 두 인터페이스 병존 기간 동안 분기 로직 증가
  - 성능: L
  - 유지보수: **H** — 마이그레이션 완료 시점 불확실
  - 마이그레이션: **H** — 5개 컴포넌트 spec 재작성 필요
- 기각: 기존 상류 조립이 정상 작동 중. 병존 복잡도가 loop 확장 리스크를 초과

### Risk Threshold Check

| 대안                         | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---------------------------- | ----- | ---- | -------- | ------------ | :--------: |
| A (현상 유지)                | L     | L    | **H**    | L            |     1      |
| B (renderer 직접 조회)       | M     | L    | **H**    | M            |     1      |
| C (**상류 조립 2지점 확장**) | **L** | L    | L        | L            |   **0**    |
| D (v2 인터페이스 병존)       | **H** | L    | **H**    | **H**        |     3      |

루프 판정: **대안 C는 HIGH+ 0개**. 대안 A/B는 유지보수 H로 SSOT 위반 지속, 대안 D는 HIGH+ 3개로 비권장. 대안 C가 원칙 정합성과 실행 가능성 양면에서 유일 최적해.

**선택 기준**: ADR-005의 기존 구현과 기존 whiteSpace override 패턴을 완전 재사용. Phase A/B 분할은 `layoutVersion` 트리거 유무에 따른 검증 단계화.

## Decision

**대안 C: 상류 조립 파이프라인 2개 지점 확장 + Layout/Paint 단계 분할**을 선택한다.

기각 사유:

- **대안 A**: ADR-058 봉쇄 + SSOT 위반 지속
- **대안 B**: renderer가 shape 추상화를 우회하여 Spec-First 원칙 역행
- **대안 D**: 기존 상류 조립이 정상 작동 중이므로 v2 병존은 불필요한 복잡도

### 실행 구조 (요약)

작업은 **상류 조립 2개 파일**에 집중. Layout 영향 감지는 `elementUpdate.ts`의 기존 `NON_LAYOUT_PROPS_UPDATE` / `INHERITED_LAYOUT_PROPS_UPDATE` 메커니즘이 **이미 대부분 정합**하므로 명시적 등록 작업은 없다:

| 파일                                                                              | 작업                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` (L749~765)  | 기존 whiteSpace-only override loop를 12개 필드 전체로 일반화. 기존 Tag/Badge/Label-in-nowrap-parent 특수 케이스는 유지                                                                        |
| `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts` (L775~780) | `decoration` 비트마스크 풀셋 확장 (+overline, +조합, +style, +color)                                                                                                                          |
| `apps/builder/src/builder/stores/utils/elementUpdate.ts` (Phase A Gate 검증 단계) | **조건부** — Phase A Gate에서 `textIndent`/`overflow`/`fontVariant`/`fontStretch`/`verticalAlign`의 layout 영향 감지 실측 후 누락 발견 시 `INHERITED_LAYOUT_PROPS_UPDATE` 등 해당 집합에 추가 |

**Phase A — Layout 영향 필드 주입 (선행)**

| #   | Feature        | 작업 지점                      | 작업 내용                                                                     | 현재 layout 영향 감지 상태                                                        |
| --- | -------------- | ------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `whiteSpace`   | `buildSpecNodeData.ts:749~765` | 기존 Tag/Badge 특수 케이스 **유지** + 일반 `style.whiteSpace` override 확인   | ✅ `INHERITED_LAYOUT_PROPS_UPDATE` (layout 감지 + 자식 상속)                      |
| 2   | `wordBreak`    | 동일 loop                      | `style.wordBreak` → `child.text.wordBreak` override 추가                      | ✅ `INHERITED_LAYOUT_PROPS_UPDATE`                                                |
| 3   | `overflowWrap` | 동일 loop                      | `style.overflowWrap` → `child.text.overflowWrap` override 추가                | ✅ `INHERITED_LAYOUT_PROPS_UPDATE`                                                |
| 4   | `lineHeight`   | 동일 loop                      | `style.lineHeight` → `child.text.lineHeight` override 추가 (spec 기본값 우선) | ✅ `INHERITED_LAYOUT_PROPS_UPDATE`                                                |
| 5   | `textIndent`   | 동일 loop                      | `style.textIndent` → `child.text.textIndent` override 추가                    | ⚠️ 두 집합 모두 없음 → 블랙리스트 회피로 layout 감지됨 (상속 없음, CSS 표준 부합) |
| 6   | `clipText`     | 동일 loop                      | `style.overflow: hidden                                                       | clip`→`child.text.clipText: true` override 추가                                   | ⚠️ `overflow`가 `NON_LAYOUT_PROPS_UPDATE`에 없음 → layout 감지됨 |

**Phase A Gate**:

- `elementUpdate.ts`의 layout 영향 감지가 Phase A 6개 필드 변경 시 정상 동작 확인 (필드 변경 → `layoutVersion` 증가 → `fullTreeLayoutMap` 재계산)
- `INHERITED_LAYOUT_PROPS_UPDATE` 등록 필드(whiteSpace/wordBreak/overflowWrap/lineHeight)의 자식 상속 동작 무회귀
- `textIndent`/`overflow(clipText)`의 layout 영향 감지 실측 확인. **누락 발견 시 `elementUpdate.ts`에 추가**
- Button/Badge wrap 동작 ≤1px (기본 케이스: `whiteSpace: normal`)
- Label `nowrap` 동작 무회귀 (기존 fit-content + `whiteSpace: nowrap` 패턴)
- Tag/Badge의 기존 nowrap 기본값 유지 확인 (`buildSpecNodeData.ts:749~765`의 기존 특수 케이스 무회귀)
- 2-pass reflow 정상 (`TEXT_LEAF_TAGS` 경로 Checkbox/Radio/Switch 내부 Label)
- `button-text-wrapping-css-skia-parity.md` 5-layer 체크리스트 5항목 통과
- 필드 미설정 시 기본값 fallback 경로 무변화 (기존 사용자 무영향)

**Phase B — Paint 영향 필드 주입 (후행)**

| #   | Feature                         | 작업 지점                           | 작업 내용                                                                                                                                                       |
| --- | ------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | `textDecoration` 풀셋           | `specShapeConverter.ts:775~780`     | 비트마스크 확장: underline(1) + overline(2) + line-through(4) + 조합 + `decorationStyle` + `decorationColor`                                                    |
| 7'  | `textDecoration` style override | `buildSpecNodeData.ts:749~765` loop | `style.textDecoration` → `child.text.decoration` override (spec 기본값보다 우선)                                                                                |
| 8   | `textOverflow`                  | 동일 loop                           | `style.textOverflow` → `child.text.textOverflow` override 추가                                                                                                  |
| 9   | `wordSpacing`                   | 동일 loop                           | `style.wordSpacing` → `child.text.wordSpacing` override 추가                                                                                                    |
| 10  | `fontVariant`                   | 동일 loop                           | `style.fontVariant` → `child.text.fontVariant` override 추가                                                                                                    |
| 11  | `fontStretch`                   | 동일 loop                           | `style.fontStretch` → `child.text.fontStretch` override 추가                                                                                                    |
| 12  | `textShadow`                    | 동일 loop                           | `parseTextShadow(style.textShadow)` → `child.text.textShadows[]` override 추가 (`parseTextShadow`는 `styleConverter.ts` 또는 `buildTextNodeData.ts`에서 재사용) |
| 13  | `verticalAlign`                 | 동일 loop                           | `style.verticalAlign` → `child.text.verticalAlign` override 추가                                                                                                |

**Phase B Gate**:

- Button/Badge/Label/Description/InlineAlert 시각 회귀 ≤1px 전체
- 60fps 유지
- `textDecoration` 풀셋과 기존 부분 구현(underline/line-through)의 동작 호환
- 기존 `textShadow` 미설정 사용자 무영향
- `parseTextShadow` 재사용 시 import 경로 정리 완료

> 작업 규모가 2개 파일 + 2곳 등록으로 집중되고 feature 수도 13개로 고정되어 있어 별도 breakdown 문서는 작성하지 않는다. Phase 경계 검증은 본 ADR의 Gates 테이블로 관리한다.

## Gates

**잔존 HIGH 위험 없음**. 대안 C는 모든 축에서 LOW이므로 Gate는 단계별 검증 체크포인트로 기능한다.

| Gate                         | 시점            | 통과 조건                                                                                                                                                                                            | 실패 시 대안                                                           |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Phase A Layout 필드 주입     | Phase A 완료    | `buildSpecNodeData.ts:749~765` loop에 6개 필드 추가 완료, `elementUpdate.ts` layout 감지 실측 (6개 필드 변경 → layoutVersion 증가 확인), Button/Badge wrap/nowrap ≤1px, Tag/Badge 기존 nowrap 무회귀 | 필드별 개별 주입 재시도, `elementUpdate.ts`에서 누락 필드 확인 및 추가 |
| 5-layer 버그 재발 방지       | Phase A 완료    | `button-text-wrapping-css-skia-parity.md` 체크리스트 5항목 통과                                                                                                                                      | 문제 필드 주입 보류                                                    |
| 기본값 fallback 무영향       | Phase A 완료    | 필드 미설정 시 Phase 이전과 동일 렌더링 (기존 사용자 무회귀)                                                                                                                                         | 주입 로직에 optional 체인 강화                                         |
| `decoration` 풀셋 비트마스크 | Phase B 진입 전 | `specShapeConverter.ts:775~780` 확장 완료, 기존 underline/line-through 호환                                                                                                                          | 기존 분기 유지 후 overline만 추가                                      |
| Phase B Paint 필드 주입      | Phase B 완료    | 5개 기존 사용자 ≤1px 전체, `textDecoration` 풀셋 호환, `textShadow` 정상 렌더링                                                                                                                      | 개별 feature 부분 롤백                                                 |
| 성능 비회귀                  | Phase B 완료    | Canvas 60fps 유지 (기존 벤치 대비 ±1fps)                                                                                                                                                             | 성능 저하 feature 식별 후 최적화                                       |
| 2-pass reflow 무회귀         | 각 Phase 완료   | Checkbox/Radio/Switch 내부 Label 세로 출력 버그 미재발                                                                                                                                               | `TEXT_LEAF_TAGS` 경로 분리 유지                                        |

## Consequences

### Positive

- **5개 기존 spec 경로 사용자가 13개 Typography feature 즉시 획득** — Button/Badge/Label/Description/InlineAlert에 `textShadow`, `wordBreak`, `whiteSpace`, `overflowWrap`, `textOverflow`, `wordSpacing` 등 전 기능 사용 가능
- **StylesPanel Typography 신뢰성 확보** — 어느 컴포넌트에 설정해도 동일 렌더링 결과
- **ADR-005 완전 재사용** — 중복 구현 0건, `nodeRendererText` + `textWrapUtils` 그대로 활용
- **ADR-058 선결 조건 충족** — TEXT_TAGS 해체 시 `Text`/`Heading`이 spec 경로로 이전해도 기능 손실 없음
- **SSOT 단일화 진전** — `buildSpecNodeData.ts`의 override loop와 `specShapeConverter.ts`의 decoration 분기가 13개 feature의 상류 SSOT가 됨
- **기존 패턴 일반화** — 새 패턴 도입이 아닌, `buildSpecNodeData.ts:749~765`의 기존 whiteSpace override 루프를 확장하는 작업이므로 학습 비용 없음
- **renderer/타입 무변경** → 기존 사용자 회귀 리스크 최소
- **작업 집중도** — 2개 파일의 좁은 분기 수정만 필요. layout 영향 감지는 `elementUpdate.ts`의 기존 blacklist/상속 메커니즘이 이미 대부분 정합하여 명시적 등록 불필요
- **향후 확장 기반** — `font-feature-settings`, variable font 추가 시 동일 loop + 동일 decoration 분기만 수정

### Negative

- **2개 파일 변경** — 변경 지점이 `specShapeConverter.ts` 단일이 아니라 `buildSpecNodeData.ts` + `specShapeConverter.ts` 2개. 단 두 파일 모두 좁은 분기 수정
- `buildSpecNodeData.ts` override loop 확장 → 코드 분량 증가 (약 30~40줄 예상)
- Phase A Gate에서 `textIndent`/`overflow`/`textOverflow`/`fontVariant`/`fontStretch`/`verticalAlign` 등 `NON_LAYOUT_PROPS_UPDATE`/`INHERITED_LAYOUT_PROPS_UPDATE` 양쪽에 미등록 필드의 layout 감지 동작 실측 필요. 누락 발견 시 `elementUpdate.ts`에 추가 (이전 ADR 버전에서 잘못 표기한 `LAYOUT_AFFECTING_PROPS` 심볼은 현재 코드에 존재하지 않으므로 참조 금지)
- `textDecoration` 풀셋으로 확장 시 기존 부분 구현(underline/line-through)과의 호환성 검증 필요
- `parseTextShadow` 유틸 재사용 필요 — 현재 `buildTextNodeData.ts`에 있으므로 `styleConverter.ts`로 이동 또는 import 경로 정리

### 후속 작업

- **ADR-058**: TEXT_TAGS 예외 경로 해체 (Text/Heading/Paragraph/Kbd/Code Spec-First 전환). 본 ADR 완료가 선결 조건
- ADR-021 dark mode + color-mix 정합성 재검증 — Paint feature 이식 후
- `font-feature-settings` HIGH 이슈(ADR-100 Phase 10+ 미해결) 통합 — 본 ADR 완료 후 `buildSpecNodeData` override loop + `specShapeConverter` decoration 분기에 추가 가능
- `parseTextShadow` 헬퍼 위치 정리 — `buildTextNodeData.ts`에서 `styleConverter.ts`로 이동하여 양쪽 경로에서 import
