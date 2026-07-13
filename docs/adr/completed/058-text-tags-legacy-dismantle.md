# ADR-058: TEXT_TAGS 예외 경로 해체 — Text/Heading/Paragraph/Kbd/Code Spec-First 전환

> **SSOT domain**: D3 (시각 스타일) 위주. Phase 5 Deferred는 D1(DOM 축) RAC 구조 수용 = 3-domain 분할 정합. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](063-ssot-chain-charter.md).

## Status

Implemented — 2026-04-11 (Phase 1~4 완료, Phase 5 Deferred)

- **Pre-Phase 0** (Preview Resolver 일반화): Implemented — `475d8168`
- **Pre-Phase 1** (CSSGenerator 안정화): Resolved — 코드 수정 불필요 (CSSGenerator는 이미 undefined 0건 생성)
- **Phase 1** (Text 마이그레이션): Implemented — `df336f00`
- **Phase 2** (Heading 마이그레이션 + `ComponentSpec.element` 함수형 확장): Implemented — `6d230558` (2026-04-10)
- **Phase 3** (Paragraph/Kbd/Code spec 신설): Implemented — `507869b0` (2026-04-10). 부수 발견: Phase 1/2에서 누락된 `generated/Text.css`, `generated/Heading.css` import도 `packages/shared/src/components/styles/index.css`에 함께 추가
- **Phase 4** (`buildTextNodeData` 폐지): Implemented — `86e0ce73` (2026-04-10). 9/9 text 컴포넌트 Skia 경로 통일 (Canvas SSOT 완성). 후속 `cd65d597`에서 Description/FieldError `spec.element`를 실제 React Aria 렌더 결과(`"span"`)와 일치시킴
- **Phase 5** (DOM 축 SSOT 완성): **Deferred — 2026-04-11**. Phase 4 완료 후 발견된 G2 갭(rendererMap이 `spec.element` 미사용)은 실존하나, **본 ADR의 원래 목표(5-point patch 근본 제거 + Canvas/Skia + CSS auto-gen SSOT 달성)는 Phase 4로 완전 달성**되었다. Phase 5는 "개념적 SSOT 완성"을 위한 미학적 작업으로, 원 ADR 스코프 밖이며 cost/benefit이 비대칭적이어서 현 시점에서 착수하지 않음. 상세 판단 근거는 아래 §Phase 5 Deferral Rationale 참조

## Phase 4 완료 후 잔존 SSOT 갭 (Post-Phase 4 Discovery)

Phase 4 완료 시점에 Canvas/Skia 축은 완전한 SSOT가 달성되었으나, 엄격한 Spec-First SSOT 기준(spec 변경 → 모든 consumer 자동 반영)에서 **3개의 갭**이 잔존한다:

|   갭   | 축                     | 영향                                                                                                             | 처리 상태                                                                                                                       |
| :----: | :--------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **G1** | CSS 축                 | Label만 `skipCSSGeneration: true`로 수동 CSS 사용 (8/9 auto-gen)                                                 | Deferred — `base.css`의 `--label-font-size` 메커니즘 재설계 필요. 스코프 별도. 후속 ADR 또는 composition-patterns 작업으로 분리 |
| **G2** | DOM 축                 | Label/Description/FieldError/InlineAlert의 rendererMap이 `spec.element` 미사용 — 하드코딩 또는 React Aria 기본값 | **Deferred — Phase 5 Deferred**. 아래 Rationale 참조                                                                            |
| **G3** | Typography features 축 | 13개 feature는 user style prop → override loop 구조. spec variants/sizes에 feature 기본값 미정의                 | 의도된 설계 (user override 우선). ADR 범위 밖                                                                                   |

## Phase 5 Deferral Rationale (2026-04-11)

Phase 5(DOM 축 SSOT 완성)는 breakdown 문서에 작업 계획이 상세히 작성되어 있으나 **현 시점에서 착수하지 않기로 결정**했다. 판단 근거:

### 1. 사용자 가치 0

Phase 5 작업의 실질 DOM 변경은 **0건**이다. `spec.element`가 현재 React Aria 렌더 결과와 이미 일치(`cd65d597`)하므로, `elementType` prop을 주입하더라도 Preview DOM/Skia Canvas/CSS 어느 것도 시각적으로 변하지 않는다. 약 2시간의 작업 산출물은 **"spec.element가 DOM을 결정한다"는 개념적 만족감**이며 사용자 경험에는 영향이 없다.

### 2. 본 ADR 원래 목표는 Phase 4로 달성

본 ADR의 Context/Decision이 명시한 목표는:

- 5-point patch 근본 제거 ✅ (Phase 1)
- `buildTextNodeData` 완전 폐지 ✅ (Phase 4)
- Text/Heading/Paragraph/Kbd/Code의 spec 경로 전환 ✅ (Phase 1~3)
- Spec-First 원칙 준수 (Canvas/Skia + CSS auto-gen) ✅ (Phase 1~4)

Phase 5는 **Phase 4 완료 후 사후 발견된 갭**에 대한 작업이며 본 ADR의 원래 선언 범위 밖이다.

### 3. 새로운 silent regression 경로 도입

Phase 5는 `LabelSpec.element` → `<Label>` 컴포넌트에 `elementType` prop으로 주입하는 결합을 도입한다. 현재는 React Aria 라이브러리가 `'label'`을 하드코딩 default로 보유하여 **우리가 망가뜨릴 수 없는** 안전망을 제공한다. Phase 5 이후에는 미래에 누군가 `LabelSpec.element`를 `"div"` 등으로 변경 시 HTML `<label for="">` 네이티브 form 연결이 **silent로** 깨질 수 있다. 접근성 관점에서 현 상태가 더 robust하다.

### 4. React Aria 버전 결합 증가

Phase 5는 `react-aria-components`의 `elementType` prop forwarding에 의존한다. 현재는 이 prop을 사용하지 않으므로 버전 업그레이드에 무관하나, Phase 5 이후에는 해당 prop의 존재/시그니처 유지가 회귀 벡터가 된다.

### 5. CLAUDE.md 원칙 충돌

프로젝트 CLAUDE.md는 명시한다:

> "Don't add features, refactor, or introduce abstractions beyond what the task requires. Don't design for hypothetical future requirements."

Phase 5는 "미래에 spec.element를 바꾸고 싶을 때"라는 가상 시나리오를 위한 작업이다. 실제로 이 시나리오는 4개 대상에서 현실적으로 발생하지 않는다:

- **Label**: 접근성 때문에 절대 `<label>` 외 값으로 변경 불가
- **Description/FieldError**: React Aria가 의도한 `<span>`이 semantic하게 정확
- **InlineAlert**: `<div role="alert">` 외 변경 사유 없음. 바꾼다면 한 줄 수정으로 족함

### 6. "미러 상태"는 정당한 균형

`spec.element = "span"`이 React Aria 렌더 결과를 정직하게 문서화하는 **한 방향 미러 관계**는 legitimate state이다. 양방향 coupling 강제가 이를 "개선"하는 것이 아니며, 오히려 "어느 쪽이 ground truth인가"를 불명확하게 만든다. 현재 구조에서는 **React Aria 라이브러리가 ground truth**이며 `spec.element`는 그 사실을 문서화한다. 명확한 책임 분리이다.

### 7. 기회비용

동일 2시간 + 검증 부하를 G1 (Label CSS auto-gen)에 투입하면 실질적 이중 관리 해소가 가능하다. G2(Phase 5)는 완성해도 "개념적 완성"에 그친다.

### 재개 조건

Phase 5를 재개해야 할 실질 조건이 발생하면 착수 검토:

- rendererMap의 React Aria 호출부에서 `elementType` 동적 제어가 실제로 필요한 사용 사례 등장
- ADR-036 Spec-First 원칙의 엄격 해석이 audit 대상이 되는 경우
- `ComponentSpec`에 `accessibilityCritical`/`elementLocked` 필드가 도입되어 접근성 silent regression 방지책이 마련된 경우

그 전까지는 **Phase 5 작업 계획은 breakdown 문서에 보존**하되 코드 변경은 하지 않는다.

## 원칙

본 ADR의 원칙 선언은 [ADR-057 §원칙](./057-text-spec-first-migration.md#원칙--spec-ssot--symmetric-consumers-adr-036-준수)을 그대로 상속한다.

핵심:

- **Spec이 SSOT**, CSS/Skia는 대등한 consumer
- **ADR-058의 본질**: 프로젝트 초기 CSS 단일 엔진 시대의 "CSS가 기준" 멘탈 모델의 잔존물인 `buildTextNodeData` 경로를 정리하여 Text/Heading/Paragraph/Kbd/Code를 spec source로 복귀시킨다. "CSS↔Skia 맞춤"이 아니라 **"잘못 배치된 consumer의 재배치"**이다.

## Context

ADR-057이 `specShapeConverter` text shape에 13개 feature parity를 이식하여 spec 경로가 충분한 표현력을 확보하면, `Text`/`Heading`/`Paragraph`/`Kbd`/`Code`가 `buildTextNodeData` 예외 경로에서 spec 경로로 이전할 수 있게 된다. 본 ADR은 이 이전 작업을 다룬다.

### 현재 예외 상태 (실측)

| 컴포넌트    | spec 존재 | `shapes()` 정의 | `skipCSSGeneration` | 렌더 경로                           | `TEXT_LEAF_TAGS` 등록 |
| ----------- | --------- | --------------- | ------------------- | ----------------------------------- | :-------------------: |
| `Text`      | ✅        | **`() => []`**  | `true`              | **`buildTextNodeData` 예외 경로**   |      ✅ (`text`)      |
| `Heading`   | ✅ (md만) | **`() => []`**  | `true`              | **`buildTextNodeData` 예외 경로**   |    ✅ (`heading`)     |
| `Paragraph` | **❌**    | —               | —                   | **spec 부재, `TEXT_TAGS`에만 등록** | **✅ (`paragraph`)**  |
| `Kbd`       | **❌**    | —               | —                   | **spec 부재, `TEXT_TAGS`에만 등록** |     **❌ 미등록**     |
| `Code`      | **❌**    | —               | —                   | **spec 부재, `TEXT_TAGS`에만 등록** |     **❌ 미등록**     |

> 참고: `utils.ts:2831`의 `TEXT_LEAF_TAGS`는 현재 `text`, `heading`, `description`, `label`, `paragraph` 5개를 포함한다. `paragraph`는 이미 2-pass reflow 대상이며, 본 ADR에서 추가로 등록할 대상은 `kbd`/`code` 뿐이다.

### 기반 인프라의 결손 지점 (실측)

Codex 검증(2026-04-10)으로 드러난 현재 코드의 3가지 선결 요구 사항:

**1. `LayoutRenderers.renderText`가 Preview의 `<p>` 생성을 독점**

`packages/shared/src/renderers/LayoutRenderers.tsx:671`의 `renderText`가 `element.props.as || "p"`로 태그를 결정하고 `data-size`/`data-element-id`를 주입한다. 이 함수를 제거하면 Preview는 `apps/builder/src/preview/App.tsx:391`의 `resolveHtmlTag` switch로 fallback되는데, 해당 switch에 **Text/Paragraph 케이스가 존재하지 않는다**(Heading/Description만 있음). `default: return tag.toLowerCase();`(L466)에 의해:

- `Text` → `<text>` ❌ (브라우저 미인식)
- `Paragraph` → `<paragraph>` ❌
- `Kbd` → `<kbd>` ✅ (우연히 lowercase가 정답)
- `Code` → `<code>` ✅ (우연)

따라서 `renderText` 제거 전에 **Preview가 spec.element를 정식 경로로 소비**하도록 Resolver를 일반화해야 한다. Hard Constraint "Text → `<p>` 불변"과 `outerHTML` diff 0 Gate는 이 선행 작업 없이 달성 불가능하다.

**2. Heading은 "저위험 시험대"가 아니다**

`packages/specs/src/types/spec.types.ts:73`: `element: keyof HTMLElementTagNameMap | "fragment"` — **정적 문자열 타입**.

`packages/specs/src/components/Heading.spec.ts`:

- L31: `element: "h3"` (정적 하드코딩)
- L73~82: `sizes: { md: {...} }` — **md 사이즈 하나만 정의**. xs/sm/lg/xl/2xl/3xl 없음

현재 Preview는 `resolveHtmlTag:397~400`에서 level prop을 읽어 `h${level}`을 동적으로 생성한다. 즉 **Heading의 semantic element는 spec.element가 아니라 props.level로 결정**된다. 그런데 Phase 1 Gate가 "xs~3xl 전 사이즈 ≤1px"를 요구하면 **존재하지 않는 사이즈를 검증하라는 요구**가 된다.

따라서 Heading은 단순 전환 대상이 아니라 **(a) sizes 모델 확장(6개 추가)** + **(b) level↔element 관계 결정**이라는 선행 인프라 작업이 필요한 복잡 대상이다.

**3. `generated/Text.css` stale undefined**

`Text.spec.ts`의 `height: 0`, `paddingX: 0`, `paddingY: 0` 같은 정상 초기값(0)을 CSSGenerator가 falsy로 오판하여 undefined가 출력되는 것으로 추정. `skipCSSGeneration: true` 제거 전에 CSSGenerator의 truthy check를 선제 수정해야 한다.

### 5-point patch 증상 (2026-04-09 발생)

`Text` 컴포넌트의 `size` prop 변경이 CSS/Skia 모두에 반영되지 않는 버그로 **5개 경로 동시 패치**(`f140f173`)가 이루어졌다:

1. `buildTextNodeData.ts` — `textStyle.fontSize || preset` 패턴에서 preset이 무시되는 버그
2. `LayoutRenderers.renderText` — `data-size` 속성 및 size-aware 스타일 미주입
3. `layout/engines/utils.ts` `calculateContentWidth` — `extractSpecTextStyle("text")`가 빈 shapes[] 때문에 null 반환
4. `layout/engines/utils.ts` `calculateContentHeight` — TEXT_LEAF_TAGS 경로 fontSize 해석 누락
5. `layout/engines/utils.ts` `enrichWithIntrinsicSize` — intrinsic width 계산 시 size preset 누락

이 5곳이 `getTextPresetFontSize()` 헬퍼를 독립적으로 호출하는 구조는 SSOT 원칙 위반이며, `Text.spec.ts`의 `shapes()`가 빈 배열을 반환하는 것이 근본 원인이다. **본 ADR은 이 근본 원인을 제거한다**.

### Hard Constraints

1. **ADR-057 Phase A/B 완료 + Gate 통과 필수** — 선결 조건 (feature parity 미확보 시 본 ADR 착수 금지)
2. **Text/Heading의 5-point patch 완전 제거** — `getTextPresetFontSize` 헬퍼의 분산 호출 소멸
3. **TextEditOverlay (ADR-027) 무회귀** — Text/Heading의 인라인 텍스트 편집이 auto-generated CSS 경로 전환 후에도 정상 동작
4. **Preview DOM semantic element 불변** — Text → `<p>`, Heading → `<h1~h6>`, Paragraph → `<p>`, Kbd → `<kbd>`, Code → `<code>`. **Pre-Phase 0 (Preview Element Resolver 일반화)이 이 제약을 보장**한다
5. **`TEXT_LEAF_TAGS` layout 엔진 셋 유지 + 확장** — `enrichWithIntrinsicSize`/2-pass reflow에 load-bearing. `paragraph`는 이미 등록됨. **`kbd`/`code` 2개만 lowercase로 추가** 등록
6. **CSS ↔ Skia 정합성 ≤1px** — ADR-057이 보장한 feature parity로 이 제약 충족
7. **`generated/Text.css` `undefined` 값 원인 선행 해결** — Pre-Phase 1이 담당. `skipCSSGeneration: true` 제거 전제
8. **`Heading.spec.ts` sizes 모델 확장 선행** — Phase 2(Heading) 진입 전 xs~3xl 6개 사이즈 추가 + level↔element 관계 결정 필수

### Soft Constraints

- `className`, CSS cascade, media query, theme variable로 텍스트 자유 제어 (현재 inline style 패치는 불가)
- 향후 `Strong`, `Em`, `Blockquote`, `Abbr` 등 HTML 의미론적 태그 추가 시 동일 spec 패턴으로 확장
- ADR-056 (Base Typography SSOT)과 시너지 — spec 경로 통일 후 단일 주입 지점

## 의존성

- **ADR-057** (필수 선행): Phase A + Phase B 완료 + Gate 통과. 본 ADR Phase 1 착수 전제
- **Pre-Phase 0** (본 ADR 내부, 모든 Phase 선행): Preview Element Resolver 일반화 — App.tsx가 spec registry 기반으로 semantic element를 해석
- **Pre-Phase 1** (본 ADR 내부, Phase 1/2 선행): CSSGenerator 안정화 — `skipCSSGeneration: true` 제거 전제
- **ADR-027 (Inline Text Editing)** 현황: Phase C 완료. Pre-Phase 0이 spec.element를 ground truth로 격상하면 Quill 오버레이는 DOM 구조 불변에 의해 자동 호환
- **ADR-056 (Base Typography SSOT)** 병행 권장: ADR-058 선행 → ADR-056은 단일 주입 지점만 수정

## Alternatives Considered

### 대안 A: 현상 유지 (5-point patch 영속화)

- 설명: ADR-057 완료 후에도 `buildTextNodeData` 경로를 유지. 향후 새 text 컴포넌트 추가 시 동일 헬퍼를 소비하도록 가이드라인화.
- 근거: 최소 변경, 회귀 위험 제로
- 위험:
  - 기술: L — 변경 없음
  - 성능: L
  - 유지보수: **H** — 5곳 동기화 부담 영구화, Text가 spec SSOT 외부에 영구 고립
  - 마이그레이션: L

### 대안 B: 일괄 전환 (5개 컴포넌트 동시 마이그레이션)

- 설명: 5개 컴포넌트를 단일 Phase에서 일괄 spec 경로로 전환.
- 근거: 작업 기간 단축
- 위험:
  - 기술: M — 5개 동시 전환 시 회귀 원인 추적 어려움
  - 성능: L
  - 유지보수: L
  - 마이그레이션: **H** — Rollback 단위가 거대함. 실패 시 전체 롤백

### 대안 C: 점진적 전환 — Text → Heading → Paragraph/Kbd/Code (본 제안)

- 설명: Pre-Phase 0/1 완료 후, 구조가 가장 단순한 Text(element: "p" 고정, sizes xs~3xl 완비)를 시험대로 먼저 전환 + 5-point patch 제거. 그 후 Heading(sizes 확장 + level 해석 선행 작업)을 후속 Phase로 진행. 마지막에 신설 컴포넌트(Paragraph/Kbd/Code).
- 근거:
  - Text는 `element: "p"` 정적 + sizes 완비 → 현재 인프라로 전환 가능한 최단 경로
  - Heading은 sizes 모델 확장 + dynamic element 해석이라는 별도 작업을 선행 요구하므로 **단순 시험대가 아님**. Text 전환 검증 후 인프라 확장 작업을 동반하여 진행이 타당
  - Text 5-point patch는 발견 당시 가장 긴급한 증상이므로 Phase 1에서 우선 해결
  - Paragraph/Kbd/Code는 spec 부재 신설 작업으로 Heading/Text 패턴 복제 가능
  - Phase별 rollback 가능, 부분 완료 상태에서도 정합성 유지
- 위험:
  - 기술: M — 각 Phase 내부 전환은 검증된 패턴 적용
  - 성능: L
  - 유지보수: L
  - 마이그레이션: **H** — Pre-Phase 2개 + 4 Phase coordinated 변경

### 대안 D: TEXT_TAGS 태그만 제거하고 `buildTextNodeData`는 legacy로 유지

- 설명: `TEXT_TAGS`에서 5개 태그만 제거하여 spec 경로로 라우팅. `buildTextNodeData` 파일은 legacy/deprecated 상태로 보존.
- 근거: 롤백 안전성
- 위험:
  - 기술: M
  - 성능: L
  - 유지보수: **M** — `buildTextNodeData`가 호출자 없이 잔존 → dead code
  - 마이그레이션: M

### 대안 E: Heading 먼저 (이전 제안, Codex 검증으로 기각)

- 설명: Heading을 시험대로 먼저 전환 (구조가 level 차이만 있는 6개 변형으로 단순하다는 가정)
- 기각 사유: 실제 코드(Heading.spec.ts) 검증 결과, Heading은 **(a) sizes: md 하나만 정의**, **(b) spec.element: "h3" 정적 하드코딩**, **(c) Preview의 h1~h6 생성은 level prop 동적 해석에 의존**. 시험대가 아닌 **선행 인프라 확장 필요 대상**. Phase 1에 배치 시 전환 절차 검증보다 Heading 인프라 확장이 더 큰 작업이 되어 "저위험 시험대"의 의미를 상실

### Risk Threshold Check

| 대안                        | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| --------------------------- | ----- | ---- | -------- | ------------ | :--------: |
| A (현상 유지)               | L     | L    | **H**    | L            |     1      |
| B (일괄 전환)               | M     | L    | L        | **H**        |     1      |
| C (**Text 먼저 점진**)      | M     | L    | L        | **H**        |     1      |
| D (태그 제거 + legacy 잔존) | M     | L    | M        | M            |     0      |
| E (Heading 먼저, 기각)      | **H** | L    | L        | **H**        |     2      |

루프 판정: 대안 A는 유지보수 H 1개(근본 원인 미해결), 대안 B/C는 마이그레이션 H 1개이지만 C는 rollback 단위가 작아 관리 가능. 대안 D는 HIGH+ 없지만 dead code 영속화로 실질 해결 아님. 대안 E는 실측 기반으로 기각됨.

**선택 기준**: 근본 원인 제거 + rollback 단위 최소화 + 실제 코드 구조에 부합. 대안 C의 Phase 경계가 점진적 검증 포인트를 제공.

## Decision

**대안 C: 점진적 전환 (Text → Heading → Paragraph/Kbd/Code → buildTextNodeData 폐지)**를 선택한다.

기각 사유:

- **대안 A**: Text가 spec SSOT 외부에 영구 고립, 5-point patch 영속화
- **대안 B**: 일괄 전환 시 회귀 원인 추적이 어려워 Gate 실패 시 전체 롤백 필요
- **대안 D**: dead code 잔존은 실질 해결이 아님, `buildTextNodeData` 완전 폐지가 목표
- **대안 E**: Heading이 선행 인프라 확장 필요 대상이므로 "저위험 시험대"가 아님 (Context 참조)

### 실행 구조 (요약)

- **Pre-Phase 0** (모든 Phase 선행, **근본 해법**): Preview Element Resolver 일반화 — `apps/builder/src/preview/App.tsx`의 `resolveHtmlTag`가 spec registry(`@composition/specs`)에서 `spec.element`를 조회하는 구조로 전환. `TAG_TO_ELEMENT` 맵 또는 동등한 SSOT 채널을 spec 패키지에서 export. Heading 같은 동적 element 해석은 spec 레벨에서 해소 (Phase 2 선행 작업과 연계)
- **Pre-Phase 1** (Phase 1/2 선행): CSSGenerator 안정화 — `generated/Text.css` `undefined` 값 원인 분석 및 수정. 가설: `if (value)` → `if (value != null)` truthy check 치환
- **Phase 1** — **Text 마이그레이션** + 5-point patch 제거 — 시험대. Text는 `element: "p"` 정적, sizes xs~3xl 완비로 Pre-Phase 0/1 완료 후 전환 가능한 최단 경로. `LayoutRenderers.renderText` 폐기, `f140f173`의 분산 동기화 소멸
- **Phase 2** — **Heading 마이그레이션** — **선행 인프라 확장 포함**: (a) `Heading.spec.ts` sizes xs~3xl 6개 추가, (b) **`ComponentSpec.element` 타입을 `string | ((props) => string)` 함수형으로 확장** (근본 해법 확정 — spec SSOT 완전 준수), `Heading.spec.ts`에서 `element: (props) => h${level}` 정의, (c) `getElementForTag`가 함수 케이스 처리, (d) h1~h6 + xs~3xl 전 사이즈 검증
- **Phase 3** — **Paragraph/Kbd/Code spec 신설** — 3개 신규 spec 파일 + `TEXT_LEAF_TAGS`에 **`kbd`/`code` lowercase 2개만** 추가 (paragraph는 이미 등록됨)
- **Phase 4** — `buildTextNodeData` 완전 폐지 + `TEXT_TAGS` 축소 — 잔존 호출자 제거, dead code 정리

각 Phase의 작업 순서, 파일 변경 목록, 검증 체크리스트, 파일 인벤토리, 회귀 진단 절차는 breakdown 문서 참조.

> 구현 상세: [058-text-tags-legacy-dismantle-breakdown.md](../design/completed/058-text-tags-legacy-dismantle-breakdown.md)

## Gates

잔존 HIGH 위험: 마이그레이션 (Pre-Phase 2개 + 4 Phase coordinated 변경). Phase 경계로 관리.

| Gate                            | 시점             | 통과 조건                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Pre-Phase 0 Resolver 일반화     | Pre-Phase 0 완료 | `getElementForTag` 헬퍼 구현 + `App.tsx resolveHtmlTag`가 spec registry 경유 + 기존 `rendererMap` 경로(Heading/Button/Text/Description/InlineAlert 등) 무회귀. **Text/Paragraph/Kbd/Code의 실제 Preview DOM 매핑 검증은 각각 Phase 1/Phase 3에서 수행** (Pre-Phase 0 시점에는 `rendererMap`이 먼저 처리하므로 resolver fallback 경로를 타지 않음) | 단순 해법(switch 하드코딩)으로 후퇴, 근본 일반화는 후속 ADR |
| Pre-Phase 1 CSSGenerator 안정화 | Pre-Phase 1 완료 | `Text.spec.ts` `skipCSSGeneration: false` 상태에서 `generated/Text.css` undefined 0건, 기존 CSS 생성자 회귀 0건                                                                                                                                                                                                                                   | `skipCSSGeneration: true` 복원, Phase 1 차단                |
| Text 5-point patch 제거         | Phase 1 완료     | 5-point patch 코드 grep 0건, Text size 변경 CSS/Skia 모두 반영, `outerHTML` diff 0건, **`rendererMap["Text"]` 제거 후 Preview가 `getElementForTag("Text")` 경로로 `<p>` 태그 정상 생성** (Pre-Phase 0의 resolver가 실전 검증되는 시점)                                                                                                            | 5-point patch 일부 복원, Phase 1 롤백                       |
| ADR-027 호환 (Text)             | Phase 1 완료     | Text 인라인 편집 Quill 오버레이 위치 ≤0.5px                                                                                                                                                                                                                                                                                                       | Phase 1.5 TextEditOverlay 재배선                            |
| Heading 인프라 확장             | Phase 2 진입 전  | `Heading.spec.ts` sizes xs~3xl 7개 정의 + `ComponentSpec.element` 함수형 타입 확장 + `getElementForTag` 함수 케이스 처리                                                                                                                                                                                                                          | Phase 2 착수 지연, 타입 확장 호환성 재검토                  |
| Heading 마이그레이션            | Phase 2 완료     | Heading level 변경 시 Preview DOM h1~h6 정확, xs~3xl 전 사이즈 ≤1px, `aria-level` 유지                                                                                                                                                                                                                                                            | Phase 2 롤백, Phase 1 유지                                  |
| ADR-027 호환 (Heading)          | Phase 2 완료     | Heading 인라인 편집 정상                                                                                                                                                                                                                                                                                                                          | Phase 2.5 TextEditOverlay 재배선                            |
| Paragraph/Kbd/Code 신설         | Phase 3 완료     | 3개 신설 spec default 렌더링 정상, `getElementForTag("Paragraph") === "p"` / `getElementForTag("Kbd") === "kbd"` / `getElementForTag("Code") === "code"` 유닛 검증, **Preview DOM tag 정확** (3개 모두 lowercase fallback 우연이 아닌 spec registry 기반 매핑), `TEXT_LEAF_TAGS`에 kbd/code 등록 확인                                             | 신설 spec 점진 보완                                         |
| `buildTextNodeData` 완전 폐지   | Phase 4 완료     | grep 0건, 전체 text 컴포넌트 ≤1px 최종 검증                                                                                                                                                                                                                                                                                                       | 잔존 호출자 재마이그레이션                                  |
| 2-pass reflow 무회귀            | 각 Phase 완료    | Checkbox/Radio/Switch 내부 Label 세로 출력 버그 미재발                                                                                                                                                                                                                                                                                            | `TEXT_LEAF_TAGS` 경로 분리 유지                             |

## Consequences

### Positive

- **ADR-036 Spec-First 완전 준수** — Text/Heading/Paragraph/Kbd/Code가 spec SSOT로 복귀. 더 이상 예외 경로 없음
- **5-point patch 근본 해결** — `getTextPresetFontSize` 분산 호출 소멸, spec source가 단일 진실
- **Preview Element Resolver 일반화** — App.tsx가 spec registry를 참조하는 구조로 전환되어 향후 새 컴포넌트 추가 시 `resolveHtmlTag` switch 수동 추가 불필요. Codex가 지적한 "Kbd/Code lowercase 우연 의존" 해소
- **Heading 인프라 확장** — sizes 모델(xs~3xl)과 level↔element 관계 정립으로 Typography 일관성 확보
- **Typography 범위 L2~L5 확보** (L1은 ADR-057이 해결):
  - **L2 StylesPanel 신뢰성** — 어느 text 컴포넌트에 적용해도 동일 결과
  - **L3 Property Editor 기반** — spec.properties 확장으로 Typography 노출 가능 (실제 노출은 별도 작업)
  - **L4 Advanced Typography 경로** — `font-feature-settings`, variable font 추가 시 단일 지점 수정
  - **L5 ADR-056 시너지** — Base Typography SSOT와 단일 주입 지점 정합
- **CSS cascade/theme/media query 정상 동작** — `className` 및 CSS override로 텍스트 자유 제어
- **DevTools 경험 개선** — inspector에서 `[data-size="md"]` 셀렉터 및 CSS 변수 체인 확인
- **Paragraph spec 신설** — 웹 콘텐츠 기본 단위 편입
- **새 semantic 텍스트 태그 추가 부담 제거** — spec 1곳만 수정

### Negative

- **Pre-Phase 2개 선행 부담** — Preview Resolver 일반화 + CSSGenerator 버그 수정이 Phase 1 진입 전 완료되어야 함
- **Preview App이 `@composition/specs` import 의존성 추가** — Pre-Phase 0 근본 해법의 불가피한 결과. 단방향 의존성이므로 순환 위험 없음
- **Heading 인프라 확장 범위 증가** — `Heading.spec.ts` sizes 6개 추가 + `ComponentSpec.element` 타입 확장(정적 string → `string | ((props) => string)` 함수형) + `getElementForTag` 함수 케이스 분기. 기존 spec 파일들의 `element` 필드는 모두 정적 문자열이므로 타입 확장은 backward-compatible
- **Phase 1의 TextEditOverlay 회귀 리스크** — Pre-Phase 0이 DOM 구조 불변을 보장하지만 `data-size`/`data-element-id` 주입 경로가 바뀌므로 Phase 1 Gate로 재검증 필요
- **Pre-Phase + 4 Phase coordinated 변경** — 중단 시 부분 통합 상태 유지. Phase 경계 커밋 및 rollback 가능성 확보 필수
- **Paragraph/Kbd/Code 3개 신설 spec 검증 부담** — 각각 default variant/size/styling 작성 + auto-generated CSS 검증

### 후속 작업

- **ADR-056 (Base Typography SSOT)** 병행 가속 — 본 ADR 완료 시 단일 주입 지점만 수정
- **`font-feature-settings` HIGH 이슈** 통합 (ADR-100 Phase 10+ 미해결) — 본 ADR 완료 후 `specShapeConverter` 단일 지점에 추가
- **Label의 `skipCSSGeneration: true` 재검토** — Description과 정합성 결정
- **`Strong`, `Em`, `Blockquote`, `Abbr` 등 HTML 의미론 태그 확장** — Phase 3 패턴 복제, Pre-Phase 0 Resolver 일반화 덕분에 자동 매핑
- **Property Editor Typography 섹션 확장** (ADR-041 연계) — spec.properties에 Typography 필드 추가로 자동 노출
- **함수형 `element` 타입 활용 확장** — Phase 2에서 도입한 `string | ((props) => string)` 타입을 조건부 태그(예: `as` prop 기반 span/div 분기) 컴포넌트에 적용 검토
