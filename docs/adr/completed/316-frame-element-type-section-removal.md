# ADR-316: frame 의 HTML 요소 칸 — 태그별 컴포넌트 대신 `elementType` · Layers 이름 · 그룹 이름 · Section 삭제

## Status

Implemented — 2026-11-24 (G4 — 사용자 「확인했다. 커밋해」, 본인 Builder 확인 · 아래 Live Exercise). Proposed — 2026-11-24

> **종결 (2026-11-24 — G4)**: 사용자가 실제 Builder 에서 확인했다. 첫 확인 (「확인했다」) 뒤 두 가지를 짚었다 — 「frame 의 tag프러퍼티에는 main이 불필요 한것 아닌가?」 (답: 머리글 · 바닥글 frame 을 둔 페이지와 레이아웃 페이지에 필요 → 「우선 놔두겠다」) 와 「button 2개를 group화 후 tag를 nav로 변경시 nav로 나타나지않고 group로 유지된다」 (수리 — Decision 2, [breakdown §4.6](../design/316-frame-element-type-section-removal-breakdown.md)). 수리 뒤 「확인했다. 커밋해」. G1 ~ G4 닫힘.

> **구현이 먼저 있다 (2026-11-24)**: 이 ADR 은 구현 뒤에 쓴 기록이다. 같은 날 대화에서 Claude 가 「바로 진행할지 `/create-adr` 로 ADR 을 먼저 만들지」 를 물었고, 그 답을 받지 않은 채 사용자의 「넣어」 를 진행 승인으로 읽어 구현했다. 사용자가 「adr 설계 후진행하려하지않었나?」 로 짚은 뒤 `/create-adr` 를 입력했고 「구현은 되돌리지마」 로 구현 유지를 정했다. 아래 Decision 은 구현된 모양과 같고, 구현 · 검사 기록은 [breakdown §4](../design/316-frame-element-type-section-removal-breakdown.md) 에 있다. 사용자의 실제 Builder 확인은 위 종결 기록에 있다.

> [설계 리뷰 1차](../reviews/316.md)에서 승인 보류. Calendar 인스턴스의 frame 태그 변경 뒤 Layers·Design 제목이 갱신되지 않는 문제와 G2가 옵션 선택 실패에도 통과하는 문제를 재현했다.

> **round 1 수리 (2026-11-24, 실행자)**: m1 — 두 이름 소비처가 선택한 위치의 유효 `elementType` 을 읽는다 (Decision 2 · R3 · `catalogRuntime/frameName.ts`). m2 — G2 스크립트가 패널 선택 실패를 그 항목의 실패로 집계한다 (G2 · Live Exercise). 리뷰가 미검증으로 적은 일곱 태그 상자 대조도 live 에 넣었다. 기록은 [breakdown §4.3](../design/316-frame-element-type-section-removal-breakdown.md).

> [2차 수리 검증](../reviews/316.md)에서 m1과 m2를 `fixed`로 기록했다. Popover의 content 슬롯에서 태그를 바꾸면 Layers 행과 Design 제목이 달라지는 m3(MEDIUM)가 남아 있다.

> **round 2 수리 · 리뷰 종결 (2026-11-24, 실행자 선언)**: m3 — Design 패널 제목이 Layers 와 같은 이름 순서 (사용자 이름 → slot 이름 → 태그 → 「Frame」) 를 한 함수로 읽는다 (Decision 2). 단위 테스트 (원복 RED) · live 10 번으로 확인했다. 판독 1 + 수리 검증 1 이 끝났고 두 round 모두 HIGH 0 이라 설계 · 구현 리뷰를 닫는다 ([review-loop-closure.md](../../../.claude/rules/review-loop-closure.md) §1 — round 3 을 열지 않는다). m3 의 outcome 은 실행자가 `fixed` 로 적었다 — pending 0. 기록 [breakdown §4.3](../design/316-frame-element-type-section-removal-breakdown.md). 남은 것은 G3 (번들) · G4 (사용자 확인) 다.

> **리뷰 뒤 범위 추가 (2026-11-24, 사용자 결정)**: 태그 목록에 `main` (Decision 1) · 레이아웃 없는 페이지의 본문을 기본 `<main>` 으로 (Decision 8 — 선택 질문의 답 「페이지 본문 = main」). 리뷰 round 1 · 2 는 이 두 가지를 보지 않았다. 단위 (원복 RED) · live 11 로 확인했고 번들은 다시 재지 않았다 — [breakdown §4.5](../design/316-frame-element-type-section-removal-breakdown.md).

- 사용자 요청: `/create-adr` (2026-11-24).
- 방향을 정한 사용자 원문 (2026-11-24 대화 순서대로):
  - 「컴퍼넌트중 section컴퍼넌트는 rac,rsc에 없는 html tag용이다. 필요한지 판단해」
  - 「frame 에 프러퍼티 옵션으로 div · section · header · footer · nav · article · aside 를 두자는 것 아닌가. 그렇다면 한가지 추가로. frame 프러퍼티에서 변경하게된다면 navigator-layers트리에도 변경된 tag로 나타나는것이 어떤가」
  - 「기존에 element들을 그룹화시에도 frame-(element,element) tag에 group 을 추가한다면 그룹화 한요소들은 frame 으로 표시되는것이 아니라 "group"으로 더 명확해 질수 있지않나」 → Claude 답: 태그 목록에 넣지 않고 그룹 명령이 노드 이름 「Group」 을 붙인다 (아래 대안 C 의 기각 사유).
  - 「명칭은 "frame" 그대로 사용하는것이 맞을까?」 → Claude 답: 유지, 표시 표기 둘 (Layers 의 소문자 · 그룹 명령 이름) 만 정리 → 「넣어」
  - Section 원본 파일 삭제 확인 질문에 「삭제」 · 남은 흔적 셋 (옛 타입 · i18n 키 · 옛 live 스크립트) 에 「세 가지도 정리해」
  - 「구현은 되돌리지마」
- 사용자가 이미 답한 확인 항목: 태그 목록 (처음 7 값 — 사용자 원문, 같은 날 `main` 을 더해 8 값) · Layers 에 태그 표시 · 그룹은 이름으로 · 「frame」 명칭 유지 · 그룹 명령 이름 통일 · Section 삭제 (마이그레이션 없음) · 구현 유지.
- 분리 근거: 기존 ADR 의 분리가 아니다. 선행 결정과의 관계는 [breakdown §1](../design/316-frame-element-type-section-removal-breakdown.md).
- 코드 인용은 작업 트리 (HEAD `34173e06f` + 이 ADR 의 미커밋 변경) 기준이고, 「전」 값은 HEAD 다.

## Context

### 도메인

- **D1 (DOM · 접근성)**: frame 이 내는 HTML 요소를 노드마다 고른다. role 은 쓰지 않는다 — frame 은 ARIA role 없는 layout 상자라는 [ADR-130](130-layer3-canonical-vocabulary-alignment.md) 결정 그대로이고, 요소 자체가 뜻이다. RAC 컴포넌트의 DOM 은 건드리지 않는다 (frame 은 RAC 대응이 없는 composition 상자).
- **D2 (Props)**: 새 prop `elementType` 은 S2 · design-data · v3 어디에도 없다 (layout 상자 자체가 없다) — composition 확장 (정본 순서 4번, `d2Provenance.ts`). 이름은 RAC `Text` 의 `elementType` 을 따른다.
- **D3 (시각)**: 바뀌지 않는다. 상자의 값은 frame 의 것이고 Canvas 는 `elementType` 을 읽지 않는다. 대칭 조건은 「요소가 바뀌어도 Canvas 와 Preview · Publish 의 결과가 같다」 다.

### 실측 (HEAD `34173e06f`)

| ID  | 사실                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Section 은 `<section>` 을 내지 않는다 — binding `source.renderer: "section"` 이 `INTERNAL_RENDERERS` (`runtime/domRegistry.runtime.ts`) 에 없어 `ruleDom` 의 fallback 이 `div.react-aria-Section` 을 그린다 (`runtime/domBinding.runtime.ts`), role 없음. binding 주석도 「fallback `div`, role 없음」 이라고 적는다 |
| F2  | Section 이 frame 과 다른 것은 rule 의 S · M · L 별 padding · gap · radius 기본값뿐이다 (`COMPONENT_RULES_TABLE.Section` — 칠은 투명). Size 축은 binding 주석대로 S2 · RAC · v3 어디에도 없다                                                                                                                         |
| F3  | 원본 template (`document/generated/reusableOriginLibrary.ts`) 에 `type-Section` 노드 0. 등록은 팔레트 · catalog · binding · rule · 생성 CSS · AI catalog · 개수 게이트 뿐                                                                                                                                            |
| F4  | Nav 는 다르다 — delegating renderer 가 실제 `<nav>` 와 `aria-label` (기본 「Navigation」) 을 내고, `selectedRoute` 로 현재 경로의 Link 에 `aria-current="page"` 를 준다 (`bindings/Nav.binding.ts` · `runtime/navRoute.ts`). 원본 `component-nav` 도 있다                                                            |
| F5  | frame 의 DOM 은 `bindings.frame = element("div")` 고정이고 (`domBinding.runtime.ts`), prop 계약은 `RULE_TYPE_PROP_CONTRACTS.frame` (`document/itemLinks.ts` — 상속 flag · `locale` · `dataBinding`) 이다. 노드별 요소 칸이 없다                                                                                      |
| F6  | Layers 행 이름은 노드 이름 → slot 이름 → EmptyState → **type 이름** 이라 이름 없는 frame 은 소문자 「frame」 이다 (`catalogRuntime/layerTree.ts` `nameOf`). Design 패널 제목도 type 이름이고 선택이 바뀔 때만 읽는다 (`CatalogPropertiesPanel.runtime.ts`)                                                           |
| F7  | 그룹 명령은 이름 없는 frame 을 만든다 (`catalogRuntime/canvasMenu.ts` — `definitionId: "lib:definition:type-frame"`). 같은 명령의 이름이 넷이다 — 메뉴 「그룹 만들기」 (`Group selection`) · 단축키 목록 「프레임 / 프레임 해제」 (`Frame` / `Unframe`) · History · 다중 선택 패널 「그룹화」                        |
| F8  | 브라우저 기본값: Chromium 156 · WebKit 27.2 모두 `section` · `article` · `aside` · `nav` · `header` · `footer` 안의 `h1` 을 줄이지 않는다 (16px 문서에서 32px — Playwright 실측 2026-11-24)                                                                                                                          |
| F9  | [ADR-304](../304-app-frame-layout-presets.md) (Proposed) 는 「랜드마크 요소는 type 마다 고정이고 노드별 덮어쓰기 필드가 없다 · Frame · Section 은 `div`」 를 실측으로 적고, 사용자 결정 3 에 type `Main` · `Aside` 신설을 권고한다                                                                                   |

### Hard constraints

- **HC1 (D1)**: frame 이 낼 수 있는 요소는 닫힌 목록이다. 목록 밖 값 (다른 태그 · `script`) 은 `div` 로 그려진다. 어떤 값에서도 `role` · `elementType` 속성이 DOM 에 나오지 않는다. 페이지에 `main` 안의 `main` 이 생기지 않는다 (본문과 frame 사이).
- **HC2 (D3 대칭)**: 같은 frame 을 여덟 요소로 바꿔도 Canvas 상자와 Preview · Publish 상자가 같다. sectioning 요소 안의 Heading (level 1) 글자 크기 · 굵기가 Canvas = Publish (차이 ≤ 0.05px).
- **HC3 (문서)**: 마이그레이션 코드 0 (개발 단계 방침 — 메모리 `feedback-no-document-migration-code-dev-stage`). 기존 frame 문서는 그대로 열려야 한다 (`elementType` 없는 frame = `div`).
- **HC4 (번들)**: ADR-201 initial 번들 — Δ 허용치 (Builder ≤ +4,096 · Preview ≤ +3,584 B gzip) 안, 절대 상한 (Builder ≤ 1,435,351 · Preview ≤ 327,000 B) 은 배포 workflow (`deploy.yml`, `push: main`) 가 본다. 실측은 G3.

### Soft constraints

- 사용자는 비개발자이고 기능 단위로 생각한다 (메모리 `user-non-developer-list-first-mental-model`). 개발자용 HTML 속성은 Design 패널에 내지 않는다는 결정 (2026-11-11 속성 감사) 이 있다 — 이 칸은 사용자가 직접 정한 예외다.
- 설계는 처음부터 전체 범위로 (메모리 `feedback-design-whole-scope-upfront-no-deferral`).

## Alternatives Considered

외부 근거: 캔버스형 빌더는 layout 상자 하나에 「Tag」 설정을 두는 방식이 흔하고 (Webflow 의 Div Block Tag 설정 · Framer 의 Frame Tag — 문서 기억에 근거하며 이번에 다시 확인하지 않았다), HTML 은 sectioning 요소를 `div` 와 같은 block 상자로 그린다 (F8 로 실측).

### 대안 A: 태그마다 컴포넌트 — Section 을 고쳐 `<section>` 을 내고 Header · Footer · Article · Aside 를 더한다

- 설명: `INTERNAL_RENDERERS` 에 `section` 을 등록하고 같은 모양의 type 을 태그 수만큼 둔다 (ADR-304 결정 3 의 권고 (a) 와 같은 방식).
- 위험: 기술 **LOW** / 성능 **LOW** (생성 CSS 가 type 마다 한 장) / 유지보수 **HIGH** — 같은 상자가 type 5 ~ 6 개로 갈린다: 팔레트 항목 · rule · nesting 규칙 · `SHELL_ONLY_TYPES` (`runtime/rulePaint.ts`) · `componentTraits.ts` · 개수 게이트 (`phase3G3Census` · `catalogCss` · `generatedCssLoadInventory`) 가 type 마다 늘고, frame 에 더한 기능 (상속 flag · 데이터 연결 · 그룹) 을 type 마다 다시 맞춰야 한다. 이미 놓은 frame 의 요소를 바꾸려면 type 을 바꾸는 명령이 따로 필요하다 / 마이그레이션 **LOW**.

### 대안 B: frame 의 prop `elementType` (닫힌 목록) + Section 삭제

- 설명: `RULE_TYPE_PROP_CONTRACTS.frame` 에 enum prop 하나. DOM binding 이 그 값으로 요소를 고르고 Canvas 는 읽지 않는다. Layers · Design 패널 제목 · Code 보기가 같은 값을 읽는다. Section 은 지운다.
- 위험: 기술 **LOW** (binding 한 줄 · 계약 한 항목) / 성능 **LOW** / 유지보수 **LOW** — 상자는 type 하나 그대로, 태그를 더하는 일은 목록 한 줄 / 마이그레이션 **MEDIUM** — Section 노드가 든 옛 프로젝트는 열리지 않는다 (HC3 방침으로 수용). 기존 frame 문서는 영향 없음.

### 대안 C: B + 목록에 `group` (그룹화한 상자의 표시)

- 설명: 그룹 명령이 `elementType: "group"` 을 쓰고 Layers 가 「group」 을 보인다 (사용자 제안).
- 위험: 기술 **MEDIUM** — `group` 은 HTML 요소가 아니라 DOM 에 `div` 를 내면 칸이 출력과 다른 값을 보이고, `role="group"` 을 내면 접근 이름이 필요해진다 / 성능 **LOW** / 유지보수 **HIGH** — `role="group"` 은 RAC `Group` 의 것이고 frame 이 role 을 내는 것은 ADR-130 이 D1 침범으로 금지했다 (`.claude/rules/ssot-hierarchy-context.md` §9). 「무엇인가」 (요소) 와 「어떻게 만들었나」 (그룹화) 가 한 칸에 섞여 그룹화한 상자를 section 으로 쓸 수 없다 / 마이그레이션 **LOW**.

### 대안 D: 노드 metadata 의 태그 (Attributes 절 — ID · class 와 같은 자리)

- 설명: `NodeMetadata` 에 `htmlTag` 를 두고 어떤 type 이든 요소를 바꾼다.
- 위험: 기술 **MEDIUM** — metadata 는 모든 노드의 것이라 RAC 컴포넌트의 요소까지 바꿀 길이 열린다 (D1 침범). frame 으로 제한하면 prop 계약과 다를 것이 없다 / 성능 **LOW** / 유지보수 **MEDIUM** — metadata 는 유도 Do · Code 보기의 attribute · AI catalog 의 prop 표면 밖이라 소비처를 따로 이어야 한다 / 마이그레이션 **LOW**.

### Risk Threshold Check

| 대안 | HIGH+                | 판정                                                                    |
| ---- | -------------------- | ----------------------------------------------------------------------- |
| A    | 유지보수 HIGH        | 기각 후보                                                               |
| B    | 없음 (마이그 MEDIUM) | 통과                                                                    |
| C    | 유지보수 HIGH        | 기각 후보 — 같은 목적 (Layers 에서 그룹 구분) 을 이름으로 푼다 (B 의 3) |
| D    | 없음                 | B 대비 이득 없음                                                        |

HIGH 없는 대안 (B · D) 이 있어 루프를 돌리지 않는다.

## Decision

**대안 B** 를 채택한다.

1. **frame 의 `elementType`**: 값 `div` (기본) · `main` · `section` · `header` · `footer` · `nav` · `article` · `aside`. 정본 `packages/shared/src/catalog/document/frameElementType.ts`. 목록 밖 값은 `div` 로 그린다. 바뀌는 것은 Preview · Publish 의 요소뿐 — role 없음 · Canvas 는 읽지 않음. Design 패널 Behavior 구획의 「HTML tag」 칸 (계약 분류 `accessibility`), 선택지 글자는 태그 그대로 (번역 없음).
2. **보이는 이름 하나**: Layers 행과 Design 패널 제목은 **사용자 이름 → slot 이름 → 태그 (`div` 가 아닐 때) → 「Frame」** 한 순서를 같이 쓴다 (`catalogRuntime/frameName.ts` `catalogFrameShownName` · `catalogNamedAt`). 태그는 **그 위치에서 유효한 값** 이다 — instance 안 frame 은 instance 의 patch 가 template 값을 이긴다. 패널 제목은 step 마다 다시 읽는다. **그룹 명령이 붙인 기본 이름 「Group」 은 사용자 이름이 아니다** — 태그가 `div` 가 아니면 태그가 보이고, `div` 로 되돌리면 다시 「Group」 이다 (사용자 보고 2026-11-24 「button 2개를 group화 후 tag를 nav로 변경시 nav로 나타나지않고 group로 유지된다」 — 노드 이름은 그대로 두고 보이는 이름만 양보한다, `CATALOG_GROUP_FRAME_NAME`). 사용자가 직접 적은 이름은 태그보다 앞선다.
3. **그룹 = 이름**: 그룹 명령이 만드는 frame 에 노드 이름 「Group」 을 붙인다. 요소 · role 은 frame 그대로이고 이름은 바꾸거나 지울 수 있다. 「Group」 은 「Frame」 과 같은 기본 표시라 태그를 정하면 태그가 보인다 (Decision 2). 명령 이름은 「그룹화 / 그룹 해제」 (`Group` / `Ungroup`) 하나로.
4. **Code 보기**: frame 을 그 태그로 쓴다 (`<section>`) — `elementType` 속성 · import 없음.
5. **Section 삭제**: binding · 생성 CSS · catalog 등록 · rule · 팔레트 · AI catalog · 옛 타입 · i18n 키. 마이그레이션 없음. `LIBRARY_CONTRACT_VERSION` 은 77 그대로 — `elementType` 은 더하기만 하는 prop 이고, 번호를 올리면 Section 을 쓰지 않은 프로젝트까지 열리지 않는다.
6. **Nav 유지**: 실제 `<nav>` · 접근 이름 · 현재 경로 표시가 있다 (F4). frame 의 `nav` 태그는 그 기능이 없는 상자다.
7. **「frame」 명칭 유지**: 문서 type · ADR-130 · 225 · AI 프롬프트 · Pencil 형식이 쓰는 이름이고, 요소 칸이 생겨 이름이 HTML 을 설명할 필요가 없다. 팔레트 라벨은 다른 항목과 같은 소문자 그대로다.
8. **페이지의 main (2026-11-24 사용자 결정 「페이지 본문 = main」)**: 레이아웃이 없는 페이지는 페이지 본문 상자를 `<main>` 으로 낸다 (class · 상자는 그대로 — Canvas 는 읽지 않는다). 본문 안 frame 을 `main` 으로 고르면 그 frame 이 페이지의 main 이고 본문은 `div` 로 물러난다 — `main` 안의 `main` 이 생기지 않는다. 본문이 레이아웃의 instance 인 페이지는 본문이 `div` 다 — content 자리를 `<main>` 으로 내는 것은 ADR-304 가 정한다.

**위험 수용 근거**: 남는 위험은 Section 을 쓴 옛 프로젝트가 열리지 않는 것 하나이고, 개발 단계 방침 (HC3) 과 사용자의 「삭제」 로 수용했다.

**기각 사유**

- **A**: 같은 상자를 type 여럿으로 갈라 등록 · 게이트 · 기능을 type 마다 반복한다. 지금의 Section 이 그 결과였다 (F1 — 이름만 section 인 `div` 가 여섯 달 남았다).
- **C**: `group` 은 HTML 요소가 아니고 `role="group"` 은 RAC Group 의 것이다 (ADR-130). 그룹 구분은 Layers 가 가장 먼저 읽는 노드 이름으로 얻는다.
- **D**: frame 으로 제한하는 순간 prop 계약과 같고, 제한하지 않으면 RAC 컴포넌트의 DOM 을 바꾸는 길이 된다.

> 구현 상세: [316-frame-element-type-section-removal-breakdown.md](../design/316-frame-element-type-section-removal-breakdown.md)

### 사용자 결정 2건

1. **(일부 닫힘 — 2026-11-24) ADR-304 결정 3 (랜드마크) 과의 관계** — 사용자 「main 은 기본적으로 포함되어야하지 않나?」 로 목록에 `main` 을 넣었고 (Decision 1), 「react 프로젝트 생성시에 기본적으로 main tag가 생성되지않나?」 뒤 선택 질문에 「페이지 본문 = main」 으로 답해 레이아웃 없는 페이지의 기본 main 을 구현했다 (Decision 8). 남은 것은 304 의 몫이다: 레이아웃을 쓴 페이지의 content 자리를 `<main>` 으로 내는 것과, 랜드마크를 type 신설 (`Main` · `Aside`) 대신 frame 의 태그로 풀지.
2. **(닫힘 — 2026-11-24) 실제 Builder 확인** — G4 「확인했다. 커밋해」. Design 패널의 칸 위치 (Behavior 구획) · 라벨 「HTML tag」 · 선택지가 태그 글자 그대로인 것이 맞는지 포함.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                      | 심각도 | 대응                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Section 노드가 든 옛 프로젝트가 열리지 않는다 (정의 `lib:definition:type-Section` 없음)                                                                                                                                                                                                                                                   |  MED   | 방침 (HC3) · 사용자 「삭제」 로 수용. CHANGELOG 에 Breaking 으로 적음. 영향 수는 셀 수 없다 (프로젝트는 사용자 기기의 IndexedDB 에만 있다) — 저장소 안 원본 template 의 Section 노드는 0 (F3)                                                                                                      |
| R2  | 브라우저가 sectioning 요소에 기본 스타일을 주면 (옛 UA 의 `section h1` 축소 · 앞으로의 변경) Canvas 와 DOM 이 갈린다                                                                                                                                                                                                                      |  MED   | F8 실측 (Chromium · WebKit 축소 없음) · live 스크립트 3번이 `section` 안 h1 의 Canvas = Publish 를 잰다 (G2). 갈리면 Preview · Publish 의 가장 낮은 layer reset 으로 (`text-font.md` 계약)                                                                                                         |
| R3  | (닫힘 — 리뷰 round 1 m1) Layers · 패널 제목이 instance 안 frame 의 patch 로 쓴 `elementType` 을 읽지 않았다 — Calendar 의 월 목록 frame 을 header 로 바꾸면 Preview 는 `<header>`, 이름은 「Frame」                                                                                                                                       |  MED   | 수리: 두 소비처가 선택한 위치의 유효 값을 읽는다 (`catalogRuntime/frameName.ts` `catalogFrameNameAt` — `readTargetProp`), Layers 는 그 값이 오는 id (instance · 주소의 instance · template 자리) 가 바뀐 step 에 다시 읽는다. 처음에 「재현 시나리오 없음 — LOW deferred」 로 적었던 판정이 틀렸다 |
| R4  | ADR-304 본문의 실측 문장 둘 (F9) 이 낡았다                                                                                                                                                                                                                                                                                                |  LOW   | 304 Status 에 안내 한 줄을 더했다. 본문 갱신은 304 리뷰 때 (사용자 결정 1)                                                                                                                                                                                                                         |
| R6  | `<main>` 은 페이지에 하나만 보여야 한다 (HTML 규칙). 본문과 frame 의 중첩은 본문이 물러나 막지만 (Decision 8), frame 여러 개를 `main` 으로 고르는 것은 막지 않는다. Builder Preview 에서 본문 요소가 `main` ↔ `div` 로 바뀌는 순간 페이지 DOM 이 한 번 다시 mount 된다 (열린 오버레이 · 입력 중 값이 사라진다 — 편집 중 태그를 바꿀 때만) |  LOW   | 여러 main 은 작성자 몫. 필요해지면 Publish 경고. 다시 mount 는 Preview 의 편집 순간뿐이고 Publish 는 첫 render 에서 정해진다 (record 를 한 번 훑어 정함)                                                                                                                                           |
| R5  | 사용자가 `nav` 태그 frame 과 Nav 컴포넌트를 혼동한다                                                                                                                                                                                                                                                                                      |  LOW   | Decision 6 · 규칙 문서 (`ssot-hierarchy-context.md` §9). 혼동이 실제로 보고되면 목록에서 `nav` 를 빼는 것은 한 줄                                                                                                                                                                                  |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험은 없다. 아래는 종결 조건이다 (집행 수단은 로컬 실행 · pre-push 게이트).

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                   |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| G1   | 구현           | 단위 — `frameElementType.test.ts` · `frameElementType.test.tsx` 통과 + 원복 RED 4 (DOM 요소 · Layers 이름 · 그룹 이름 · Code 태그) · HC1 (목록 밖 값 = `div` · role · 속성 없음) · 회귀 새 실패 0 · type-check                                                                                                                                                                                                                                   | 실패한 소비처 수리                             |
| G2   | 구현           | live (실제 Builder · Publish) — **패널에서 태그를 직접 고르는 조작이 성공** (실패하면 이 Gate 실패 — 명령으로 대신 쓰지 않는다) 하고, 그 값이 Layers · 패널 제목 · Publish 요소에 닿는다 (page 의 frame 과 instance 안 frame 둘 다) · slot frame 은 Layers 행과 패널 제목이 같은 slot 이름 · 여덟 태그의 상자가 Canvas 끼리 · Publish 끼리 같고 높이가 Canvas = Publish · `section` 안 h1 이 Canvas = Publish · 팔레트에 section 없음 · Nav 있음 | 갈린 consumer 를 catalog 값 기준으로 맞춤 (R2) |
| G3   | push 전        | `adr201-bundle-gate.mjs` 의 Δ · lazy 조건 통과 (HC4). 절대 상한은 배포 workflow (`deploy.yml` — `push: main`) 가 판정한다                                                                                                                                                                                                                                                                                                                        | 늘어난 쪽을 lazy 경계 밖으로                   |
| G4   | Implemented 전 | 사용자가 실제 Builder 에서 확인 (사용자 결정 2)                                                                                                                                                                                                                                                                                                                                                                                                  | 지적 수리 뒤 재확인                            |

측정 조건: G2 의 기준값은 시스템 밖이다 (Publish 의 실제 DOM `tagName` · `getComputedStyle` — headed Chrome, 새 프로젝트). 불리한 경우로 sectioning 요소 안 `h1` 을 넣었다 (F8 · R2). 성능 게이트가 아니라 대조군은 없다.

G1 · G2 는 2026-11-24 통과 기록이 있다 ([breakdown §4](../design/316-frame-element-type-section-removal-breakdown.md)). G3 (2026-11-24 실측): **Δ Builder +204 · Preview −2 B gzip** — Δ 허용치 · lazy 조건 9 개 모두 통과. 판정기의 종합 값은 `pass: false` 다 — 남은 한 조건 `builderAbsolute` (로컬 closure 1,643,334 > 1,435,351) 가 이 변경 전 기준선 (1,643,130) 에서도 실패한다. ADR-314 · 315 기록과 같은 상태이고 (로컬 closure 값은 「기준선부터 넘는다」) 이 변경이 만든 초과가 아니다. 배포 workflow 의 절대 상한 결과는 push 전이라 확인하지 못했다. **G3 닫힘 (2026-11-24, 사용자 결정 「G3 를 「증가량 통과」 로 닫아」)** — 판정 기준은 증가량 · lazy 조건이고, Builder 절대 상한의 로컬 초과는 이 ADR 밖의 일로 남긴다. **G4 닫힘 (2026-11-24)** — 사용자 「확인했다. 커밋해」 (확인 중 보고한 그룹 이름은 수리 뒤 다시 확인).

### Live Exercise

- 2026-11-24 · Playwright (headed Chrome, 새 프로젝트 「frame element live」) · `apps/builder/scripts/frame-element-type-live.mjs` 14/14 · 종료 코드 0 (리뷰 round 1 · 2 수리 뒤 — 처음 기록은 7/7 이었고 그 스크립트는 패널 선택이 실패해도 통과했다):
  1. 팔레트로 frame 둘 → Layers 행 「Frame」 둘 (소문자 없음).
  2. (2a) Design 패널 「HTML tag」 칸에서 section 을 **직접 고름** — 고르기 실패는 이 항목의 실패다 (명령으로 대신 쓰지 않는다). (2b) Layers 행 · 패널 제목 「section」.
  3. 그 frame 안 Heading level 1 — Canvas 32 · 700 = Publish `h1` 32 · 700 (`section` 안).
  4. frame 둘 선택 → 액션 바 「Group」 → 새 frame 의 노드 이름 「Group」 · Layers 행 「Group」.
  5. Publish — 그 frame 은 `<section>`, 나머지는 `<div>`, `role` · `elementtype` 속성 없음.
  6. page error 0.
  7. 팔레트에 section 항목 없음 · navigation (Nav) · frame 있음.
  8. 인스턴스 (Calendar) 안 frame 을 패널에서 header 로 고름 → Layers 행 · 패널 제목 「header」, (8b) Publish `<header>`.
  9. 여덟 태그 (`main` 포함) 의 상자 — 같은 내용의 frame 여덟 (padding 12 · 16 + Text): Canvas 여덟 모두 1920 × 48, Publish 여덟 모두 1920 × 48 (판정은 각 consumer 안의 폭 · 높이 일치와 두 consumer 사이 높이 일치).
  10. slot frame (Popover 의 `content`) 을 패널에서 header 로 고름 → 값은 header, Layers 행 · 패널 제목은 둘 다 「content」.
  11. 페이지의 main (Publish) — `main` frame 이 있으면 본문 `div` · `<main>` 1 개, 그 frame 을 `div` 로 되돌리고 Publish 를 다시 열면 본문이 `<main>` · 1 개. 두 경우 모두 `main` 안 `main` 0.
  12. 그룹 frame 을 패널에서 nav 로 고름 → Layers 행 · 패널 제목 「nav」, div 로 되돌리면 둘 다 「Group」 (사용자 보고 수리).
- 반례 재현 (리뷰 m2): 고를 선택지를 없는 이름으로 바꾼 실행용 사본 → 2a FAIL · 10/11 (뒤 항목은 각자 판정).
- exercise 하지 않은 것: ⌘G 단축키 (스크립트의 키가 캔버스 scope 에 닿지 않아 같은 명령의 액션 바 버튼으로 대신했다) · 메뉴 · 단축키 목록의 한국어 문구 표시 · WebKit 에서의 전체 실행.
- 사용자 confirm (G4, 2026-11-24): 본인 Builder 에서 확인 — 「확인했다」 → 그룹 이름 보고 → 수리 뒤 「확인했다. 커밋해」.

## Consequences

### Positive

- 시맨틱 요소가 layout 상자 하나의 칸으로 모인다 — 이미 놓은 frame 의 요소를 type 변경 없이 바꾼다.
- 이름과 다른 것을 내던 컴포넌트 (Section = `div`) 가 없어진다. type · 생성 CSS · 팔레트 항목이 하나씩 준다.
- Layers 에서 구조가 읽힌다 — 「section」 · 「nav」 · 「Group」 · 「Frame」.
- 그룹 명령의 이름이 한 가지다.
- 랜드마크가 필요한 뒤 작업 (ADR-304) 이 type 신설 없이 목록 한 줄로 풀릴 수 있다.

### Negative

- Section 을 쓴 옛 프로젝트는 열리지 않는다 (R1).
- Design 패널에 HTML 용어 칸이 하나 생긴다 — 2026-11-11 「개발자용 속성은 내지 않는다」 의 예외.
- `nav` 태그 frame 과 Nav 컴포넌트가 팔레트 · 패널에 함께 있다 (R5).
- ADR 보다 구현이 먼저였다 — 대안 비교가 구현 뒤에 쓰였다. 설계 리뷰가 다른 결론을 내면 되돌리는 비용이 생긴다.
