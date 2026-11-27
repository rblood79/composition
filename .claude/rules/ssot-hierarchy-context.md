---
description: SSOT 체인 배경 맥락 — 역사적 맥락(§0) · 용어 사전(§2) · 주요 ADR 관계(§5) · 사례 · 집행 메커니즘 · 허용 패턴(§9). ADR 작성 · catalog · rendering · Canvas 작업 시 자동 로드 (정본 ssot-hierarchy.md 에서 2026-08-31 · 11-19 분리)
paths:
  - "docs/adr/**"
  - "packages/shared/src/catalog/**"
  - "packages/rendering/**"
  - "apps/builder/src/builder/workspace/canvas/**"
---

# SSOT 체인 — 배경 맥락 (역사 · 용어 · ADR 관계)

> 정본 규칙은 [ssot-hierarchy.md](ssot-hierarchy.md) (상시 로드 — 3-Domain 분할 · 경계 판정 · 집행 · 금지/허용 패턴). 이 문서는 그 정본의 §0 · §2 · §5 (2026-08-31) 와 사례 · 집행 · 허용 패턴 (§9, 2026-11-19) 을 옮긴 것으로, 절 번호는 인용 안정성을 위해 정본 번호를 유지한다. 매 세션 상주할 필요가 없어 ADR · catalog · rendering · Canvas 작업 시에만 로드된다.

## 0. 역사적 맥락 (왜 이 구조인가)

1. **Phase 1**: Builder와 Preview 모두 DOM/CSS — Spec 불필요, 정합성 문제 없음
2. **Phase 2**: 대규모 프로젝트 한계 → Builder를 WebGL/Skia로 전환. Preview는 DOM/CSS(React Aria Components) 유지 → **두 화면 정합성 문제 발생**
3. **Phase 3**: SSOT 원칙 + Spec 도입 (정합성 복구 목적)
4. **ADR-063 charter 작성 시점 (2026-04-13)**: 원칙 미준수로 정합성 재발 — 본 규칙은 그 재발 방지 명문화
5. **ADR-142 · ADR-248**: D3 SSOT 를 컴포넌트당 spec 에서 catalog + theme/tokens 로 재정의하고 spec 파일을 전부 삭제 (§5)

## 2. 용어 사전

| 용어                         | 정의                                           | 적용 대상                                        |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| **SSOT (Source of Truth)**   | 단일 source. 해당 domain 내에서 유일 정의 권한 | D3에서 catalog 에만 적용 (Frame/Group/Slot 포함) |
| **권위 (authority)**         | domain 전체를 지배하는 외부 기준               | D1에서 RAC에만 적용                              |
| **reference**                | 설계 시 참조하는 외부 원천 (결정권 없음)       | D2에서 RSP에 적용                                |
| **consumer**                 | SSOT에서 파생되어 결과를 소비                  | D3의 Builder(Skia) / Preview(DOM+CSS)            |
| **symmetric**                | 두 consumer가 대등 — 한쪽이 다른 쪽 기준 아님  | D3의 Skia ↔ CSS                                  |
| **직접 consumer (direct)**   | SSOT에서 직접 파생                             | Skia, catalog generated CSS (`generate-css.ts`)  |
| **간접 consumer (indirect)** | 중간 변환 경유                                 | Preview(binding→CSS→DOM), Publish                |

## 5. 주요 ADR과의 관계

- **ADR-036 (Spec-First, Superseded by ADR-142)**: 컴포넌트당 spec 파일을 D3 SSOT로 둔 메커니즘 — ADR-142로 폐기. 역사적 기록으로 보존
- **ADR-057/058 (Text Spec-First Phase 1~4)**: D3 내부 정리 (spec 시대). Phase 5 Deferred = D1(DOM 구조)을 RAC에 맡긴 결정 — 본 규칙에 완전 정합
- **ADR-059 (skipCSSGeneration 해체)**: D3 내부 정리 (spec 시대). "CSS가 SSOT에서 파생되어야" = D3 symmetric consumer 복원
- **ADR-062 (Field variant 제거)**: D2 정리. RSP 미규정 prop 제거 + RSP 규정 prop(isQuiet) 보강
- **ADR-063 (본 charter)**: 본 규칙의 ADR 형식 정식화
- **ADR-142 (Starter/Spec Component System Cutover, Implemented 2026-06-02)**: D3 SSOT를 컴포넌트당 spec 파일에서 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection으로 재정의. ADR-036/907/908의 spec 스키마 메커니즘을 폐기 (907/908 의 primitive · fill 계약은 `packages/rendering` 에 존속, spec 파일은 ADR-248 에서 전부 삭제)

## 9. ssot-hierarchy.md 에서 옮긴 사례 · 집행 (2026-11-19)

> 상시 로드 비용을 줄이려고 정본에서 옮겼다. 원문 그대로 — 정본의 §4 · §7 은 여기를 가리킨다.

### D3 — 사고 기록 (Why 2026-11-05 · 11-13 · 11-27)

- **Why (2026-11-05)**: Publish의 layer 밖 `:focus-visible` 기본값이 catalog의 `data-focus-visible` 분기를 덮어 마우스 Menu hover에도 2px outline을 그렸다. 앱 기본 focus 규칙은 컴포넌트 상태 규칙보다 낮은 우선순위에 둔다.
- **Why (2026-11-13)**: 같은 기제가 margin 에서도 났다 — Publish 의 layer 밖 `* { margin: 0 }` 이 catalog margin (SideNav 행 `margin-top: 6px` · SideNavHeader `margin-bottom: 8px`) 을 지워 Publish 만 행이 붙었다 (`@layer preview-system` 으로 옮김). 그리고 CSS 생성기는 `emitContainerStyles` 에 줄이 없는 rule 값 (SideNav `min-width` · SideNavHeader `margin-bottom` · Token `white-space` …) 을 버렸고, size 블록의 `padding: 0px 0px` 가 rule 이 선언한 padding 한쪽 (SideNavHeader · Toast) 을 덮었다 — Canvas 는 둘 다 읽었다. 앱 reset 은 가장 낮은 layer 에, rule 값은 두 consumer 가 모두 쓴다 (`CSSGenerator.containerStyles.test.ts` 가 모든 rule 의 키를 검사).
- **Why (2026-11-27, ADR-321 Phase 5)**: 세 번째 — Publish 의 layer 밖 `img, picture, video, canvas, svg { display: block; max-width: 100% }` 가 Rating 별의 `display: none` (윤곽 · 채운 별 둘 중 하나를 숨기는 rule) 을 이겨 Publish 만 별 다섯이 모두 채워졌다 (`@layer preview-system` 으로 옮김). Publish `index.css` 에 layer 밖 선택자를 새로 두지 않는다.

### D1 ↔ D3 분리 사례 — RAC Group ↔ canonical frame

**D1 ↔ D3 분리 사례 — RAC `Group` ↔ canonical `frame` (ADR-130 Implemented 2026-05-13)**:

- RAC `Group` = D1 ARIA semantic (`role: "group"`, `aria-label`) — catalog Group definition/primitive binding
- canonical `frame` = D3 layout container — catalog frame definition (skipCSSGeneration:true, ARIA role 없음)
- 진입점 단일화: builder palette / multi-select grouping / pencil import 모두 `type: "frame"`. RAC ARIA Group 으로 layout 의도 흡수 금지 (D1 침범)
- ADR-130 당시의 canonical schema `FrameNode` (`clip`/`placeholder` 1차 필드) 타입은 지금 코드에 없다 — frame 은 catalog 문서의 `frame` 정의 노드다. `frame` 을 Group 의 alias 로 두는 패턴 금지 — ARIA role emit 으로 D1 침범 (옛 `BASE_TAG_SPEC_MAP` 은 ADR-248 에서 삭제)
- **frame 의 HTML 요소 = `elementType` (사용자 결정 2026-11-24)**: frame 은 `div` · `main` · `section` · `header` · `footer` · `nav` · `article` · `aside` 중 하나로 그려진다 (`catalog/document/frameElementType.ts` — Design 패널 「HTML tag」, D2 는 composition 확장). 바뀌는 것은 DOM 요소뿐이다 — role 은 쓰지 않고 Canvas 는 읽지 않는다. Layers 행 이름은 사용자 이름 → 태그 (`div` 아닐 때) → 「Frame」, 그룹 명령이 만든 frame 은 노드 이름 「Group」 (태그 목록에 group 을 넣지 않는다 — HTML 요소가 아니고 `role="group"` 은 RAC Group 의 것). 태그별 컴포넌트를 새로 만들지 않는다 (옛 Section 은 `div` 였다). **페이지의 main**: 레이아웃 없는 페이지의 본문은 `<main>` 이고, 본문 안 `main` frame 이 있으면 본문이 `div` 로 물러난다 (`runtime/pageMain.components.tsx` — DOM 층에서만 정한다, 그려진 `main` frame 이 context 로 본문에 알린다). 레이아웃 페이지의 content 자리는 ADR-304.

### 생성 CSS archetype 미지정 = 중립 상자

**생성 CSS archetype 미지정 = 중립 상자 (ADR-223 Implemented 2026-09-18)**: catalog `structure.archetype: "default"` 의 생성 CSS base 는 `container` 와 같은 block · box-sizing · font-family 뿐이다 — Skia 가 읽지 않는 버튼 어법 (inline-flex · align/justify center · cursor · user-select · transition) 을 기본값으로 싣지 않는다. 정렬·크기 (geometry) 는 `structure.containerStyles` 로 두 consumer 가 같이 읽고, Canvas 저작 surface 에 대응이 없는 DOM interaction (cursor · user-select · transition) 은 `composition.rootSelectors["&"]` 가 catalog 정본이되 Canvas 는 소비하지 않는다 (Card · Tab). 신규 entry 는 archetype 또는 `composition.layout` 을 명시한다 (`archetypeDefaultCohort.static.test.ts` ratchet).

### §4 집행 메커니즘

#### 집행 메커니즘 (원 §4)

##### 4-1. 대칭 검증 수단

- **runtime**: `/cross-check` skill (단일 컴포넌트 · 패밀리는 영향 컴포넌트마다 반복)
- **검증 대상**: 시각 결과 일치 — Builder Skia 렌더와 Preview DOM/CSS 렌더의 스크린샷 or 구조적 비교
- **자동 게이트**: D2 prop 은 `d2S2Alignment.static.test.ts`, D3 값은 `d3S2Alignment.static.test.ts` · `componentRulesTable.static.test.ts`, Canvas ↔ DOM 은 `apps/builder/tests/parity/` (browser) 와 ADR-248 G3 하니스 (`vitest.adr248-g3.browser.config.ts`). 하니스 PASS 를 전체 시각 동일성으로 확대하지 않는다 (`/cross-check` skill)

##### 4-2. 위반 감지 및 대응

| 위반 유형                     | 감지                                                                        | 대응                                    |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| 수동 CSS가 SSOT에서 파생 아님 | catalog rule 에 없는 값을 가진 수동 CSS                                     | ADR 작성 → 해체 계획                    |
| consumer-to-consumer 참조     | `@sync` 주석                                                                | catalog 경유로 재작성                   |
| catalog 가 D1/D2 침범         | 코드 리뷰                                                                   | 위반 코드 즉시 거부                     |
| 시각 비대칭 (CSS≠Skia)        | `/cross-check` 실패 · parity 테스트 · G3 하니스 실패                        | 어느 쪽이 SSOT 맞는지 조사 후 양쪽 정렬 |
| RSP 미규정 prop 임의 도입     | `d2S2Alignment.static.test.ts` (S2 타입에도 `d2Provenance.ts` 에도 없는 키) | 거부, RSP 참조 요구                     |

##### 4-3. 문서 교차 참조 의무

새 ADR 작성 시 Context 섹션에서 **3개 domain 중 어느 것에 해당하는지 명시** 필수. 경계 교차 시 정당화 필요.

### §7 허용 패턴

#### 허용 패턴 (원 §7)

- ✅ catalog(`COMPONENT_RULES_TABLE`) + theme/tokens가 색상 토큰/사이즈/레이아웃 정의 (일반 컴포넌트)
- ✅ Frame/Group/Slot도 catalog가 색상 토큰/사이즈/레이아웃을 정의
- ✅ `generate-css.ts` 가 catalog SSOT 를 CSS 로 자동 변환
- ✅ Skia 렌더가 catalog 를 shape 로 변환
- ✅ RAC 컴포넌트를 그대로 사용 + CSS로 스타일 적용
- ✅ RSP props를 custom 구현으로 catalog binding에 추가
- ✅ `/cross-check`로 시각 대칭 확인
- ✅ 의심스러운 회색지대는 "시각적으로 달라질 수 있나" 기준으로 판정

### Select 다중 선택 Why (2026-11-05)

- **Why (2026-11-05, Select 다중 선택)**: RAC SelectValue의 기본값은 선택 항목 자식을 나열하므로 목록 label의 `width: 100%`까지 복제되어 간격이 벌어졌다. D1 선택 상태는 RAC에 두고, D2 S2의 2개 이상 선택 개수 표시와 단일 check / 다중 checkbox 계약은 catalog binding에서 두 소비자가 공유한다.
