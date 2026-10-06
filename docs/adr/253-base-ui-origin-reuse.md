# ADR-253: 기본 UI 원본의 재사용 — 부품 · 안에 넣는 컴포넌트 · 바탕을 원본의 instance 로

## Status

Accepted — 2026-10-06 (실행 중 — Phase 1 · 2 main 병합 · push `1d66260dd`. Phase 3 진행 중: Label · FieldError · Description · Input 단계 완료, 브랜치 `adr-253`)

> **2026-10-06 실행 착수** (사용자 `/execute-adr 253` · 리뷰 round 2 HIGH 0 — [reviews/253.md](reviews/253.md)): Phase 1 (원본 override 가 instance 루트까지) 을 구현했다. G1 은 한 항목을 빼고 통과했다 — 「Preview 에서 실제 hover · press 의 computed style 이 바뀐다」 는 통과하지 못한다. Preview DOM 에는 문서가 쓴 상태별 값을 싣는 채널이 없고 (`X/` 에 0건 — instance 가 쓴 상태별 값도 같다), 상태별 값을 쓰는 편집 UI 도 없다 (`setLibraryDefault` 의 `stateRules` 범위를 부르는 곳 0). 상태별 값은 해석 결과와 Canvas (Components page 의 상태 칸) 까지 닿는다. 이 항목의 처리 (DOM 채널을 이 ADR 에서 만들지 · 상태 편집 UI 가 생길 때로 미룰지) 는 사용자 판정 대기다. 기록: [breakdown §6](design/253-base-ui-origin-reuse-breakdown.md).
>
> **Phase 2** (같은 날, 브랜치 `adr-253`): Label 원본을 등록하고 TextField 의 Label 자리를 그 instance 로, Preview DOM 이 Label 노드를 직접 그리게 했다 (contract 3). G2 통과 — Components page 에서 Label 원본을 고치면 TextField 의 Label 이 Canvas 와 Preview 에서 같이 바뀌고, DOM 구조는 전환 전과 같다. 부모 delegation 의 Label 모양 선언 정리와 굵기 500 은 Phase 3 으로 옮겼다 (TextArea 가 TextField 의 CSS 범위를 같이 쓴다 — breakdown §6).

> **Phase 3 (1) Label** (같은 날, 브랜치 `adr-253`): field · 그룹 17종의 Label 이 Label 원본의 instance 이고 Preview DOM 이 그 노드를 그린다. 부모 rule 의 Label 모양 선언 0 (정적 테스트) · Label 굵기 500 · contract 4. DOM 구조는 전환 전 빌드와 같다 (17 부모 × 13 조합). 남은 단계: FieldError · Description → Input · DateInput → Group · Button.
>
> **Phase 3 (2) FieldError · Description** (같은 날, 브랜치): 두 부품의 원본을 등록하고 field · 그룹 13종의 도움말 · 오류 문구 자리를 그 instance 로 했다. Canvas 가 처음으로 도움말과 오류 문구를 그린다 (지금까지 DOM 만 그렸다). Preview 는 그 노드를 RAC 컴포넌트로 그려 자체 validation 오류가 보인다 (required · email — 전환 전에는 표시 없음, G3 ②). 부모 rule 의 두 부품 모양 선언 0. 남은 단계: Input · DateInput → Group · Button.

> **Phase 3 (3a) Input** (같은 날, 브랜치): Input 원본을 등록하고 TextField · TextArea · ColorField 의 입력칸을 그 instance 로 했다. Input rule 이 자기 stylesheet (크기 단계 + hover · focus · invalid) 를 내고, 수동 `base.css` 블록과 TextField · ColorField 의 모양 delegation 을 지웠다. Preview 는 Input 노드를 RAC `Input` 으로 그린다 (`data-size` + 문서가 쓴 값만 inline). 바뀌는 화면: 입력칸 모서리가 크기를 따른다 · ColorField 가 TextField 와 같은 입력칸 · disabled 겹침 흐림 수리 (breakdown §6 의 변화 목록). 남은 단계: Group · Button — DateInput (DateField · TimeField · picker 2종 을 한 번에: 따로 바꾸면 picker 에 새 규칙이 새어 든다 — breakdown §6) 과 ComboBox · NumberField · SearchField 의 입력칸 포함.

사용자 요청: `/create-adr` (2026-10-06). 방향은 같은 날 대화에서 사용자가 정했다.

- 「기본 ui를 origin 요소를 instance객체로 여러곳에서 재활용 해서 사용하는것이 pen.dev와 RAC의 근본적인 개념아닌가」
- 「그 기본 ui는 theme 의 최소요소라 그것만 변경하면 컴퍼넌트들 전체가 한 세트로 일관된 디자인으로 변경하자는것」
- 「pen.dev 샘플은 여러가지를 보여주기 위해서 만들어진 샘플이라 재사용의 참고패턴만 확인하는것」 — 잘된 예로 Tabs (TabList 재사용) 와 Modal 을 들었다.

이 ADR 은 [ADR-923](completed/923-layout-vocabulary-closure.md) Phase 5 후속의 내부 부품 판정 (2026-09-03, 사용자 판정 A × 2 — [evidence](evidence/923-phase5-followup-subpart-extension.md)) 을 고친다. 그 판정은 「Preview 가 부모 값만으로 그리므로 부품의 편집을 부모로 돌린다」 였고, 이 ADR 은 Preview 가 부품을 직접 그리게 해서 그 전제를 없앤다. 원본 template 구조가 바뀌므로 [ADR-251](completed/251-radio-checkbox-items-node-restore.md) 과 같은 방식으로 library contract version 을 올린다.

**사용자 확인 (2026-10-06)** — 세 항목 모두 답을 받았다 (4 는 2 의 보충).

1. 실행 범위: 「지금은 한 ADR 안에 단계로 두어도 문제가 발생하지 않는다면 그대로 진행」 — Phase 4 · 5 를 이 ADR 에 둔다. 문제가 생기지 않는 근거: 두 Phase 는 각자의 Gate (G4 · G5) 와 「그 Phase 만 미룬다」 는 후퇴안이 있어 앞 Phase 의 종결을 막지 않고, template 이 바뀌는 병합마다 contract version 을 올리므로 (Decision 9) 저장 포맷이 Phase 사이에 어긋나지 않는다. Phase 5 는 Phase 4 가 만드는 slot 채움 표현을 쓰므로 Phase 4 를 미루면 Phase 5 도 미룬다.
2. 값 차이 처리: 「RAC 레퍼런스 값 기준으로」 · 「RAC starter 보다 https://react-aria.adobe.com 레퍼런스 사이트에서」 — 부모마다 다른 값은 react-aria.adobe.com 의 Vanilla CSS 예제가 그 부품을 다루는 방식으로 모은다 (Decision 3 · breakdown §2-2).
3. contract 2 프로젝트 거부: 「상관없다. 개발단계인데 무시해도된다」.
4. 레퍼런스 값의 위치: 「레퍼런스는 스타일 일뿐이고 default theme값일 뿐이다」 — 레퍼런스 값을 부품의 기본값으로 그대로 쓰고 항목별 예외를 두지 않는다 (Label 굵기 · Select trigger 포함).

> **2026-10-06 리뷰 round 1 반영** ([reviews/253.md](reviews/253.md), Codex — HIGH 2 · MEDIUM 2): ① Select 의 항목을 ListBox instance 의 자식으로 적으면 slot 채움이 되지 않고 ListBox 루트 밖에 붙는다 → library 의 slot 채움 표현을 Phase 4 의 선행으로 옮김 (Decision 7 · 8 · G4 · G5) ② 일반 Button binding 은 RAC 의 `slot` 을 버리고 `isDisabled: false` 를 명시해 부모 context 를 덮는다 → 부품이 부모의 RAC context 를 그대로 받는 계약 추가 (Decision 5 · R10 · G3) ③ 지금의 FieldError binding 은 정적 `span` 이라 동적 validation 과 ARIA 연결이 끊긴다 → 부품을 RAC 컴포넌트로 그리고 검증 추가 (Decision 5 · R1 · G3) ④ 원본의 상태별 스타일은 template 루트 투영 뒤에 적용돼 닿지 않는다 → 상태별 전파를 Phase 1 의 범위와 G1 에 명시 (Decision 1 · G1). 네 건 모두 코드에서 확인했다. 대안 A 와 사용자 확인 4 는 그대로다.

## Context

### 목표

기본 UI 요소 (Label · Input · Button · FieldError 등) 를 한 번 정의하고, 그것만 고치면 그 요소를 쓰는 모든 컴포넌트가 한 세트로 바뀌어야 한다. token 이 값의 최소 단위라면 기본 원본은 모양의 최소 단위다.

### 지금 되는 것과 안 되는 것 (2026-10-06 실측 · main `468c6d41f`)

경로 약어: `S/` = `packages/shared/src/` · `D/` = `S/catalog/document/` · `X/` = `S/catalog/runtime/` · `R/` = `apps/builder/src/builder/catalogRuntime/` · `T` = `S/catalog/generated/componentRulesTable.ts`

| #   | 사실                                                                                                                                                                                                                                                                                                                          | 근거                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 값 (색 · 반경 · 글꼴) 은 theme token 으로 한 번에 바뀐다                                                                                                                                                                                                                                                                      | ADR-110 · ADR-227                                                                                                                                                                                   |
| F2  | 부품의 모양은 부모 rule 의 `delegation` 마다 따로 적혀 있다 — Label 11 · FieldError 10 · description 13 · Button 6 · Input 5 · DateInput 4 · Group 3. Label 글자 크기는 root 변수 채널로 4곳 (CheckboxGroup · RadioGroup · Meter · ProgressBar) 에 더 있다                                                                    | `T:13516` (TextField Label) · `T:10502` (Select) · `T:3088` (ComboBox) 등 — 전수 목록은 breakdown §2                                                                                                |
| F3  | 부모끼리 값이 다르다. FieldError md 글자 크기: TextField `text-sm` · ComboBox 등 `text-xs`. field 안 Button: ComboBox · NumberField · SearchField 는 `bg-overlay` + 그림자 · DatePicker 는 투명 + `fg-muted` · Select 는 `bg-inset` + 테두리. Input 모서리: ColorField `radius-sm` · ComboBox 0 · TextField `--border-radius` | `T:13623` · `T:3299` · `T:3264` · `T:4218` · `T:10571` · `S/components/styles/base.css:8`                                                                                                           |
| F4  | 부품 자신의 rule (Label · Input · FieldError · SelectTrigger) 은 표에 있지만 DOM 에 닿지 않는다. Label 은 CSS 생성을 건너뛰고, Input · FieldError 의 생성 CSS 는 로드하지 않는다                                                                                                                                              | `T:6779` · `T:6844` (`skipCSSGeneration`) · `T:6620` · `T:5527` · `S/components/styles/__tests__/generatedCssLoadInventory.static.test.ts:30-31`                                                    |
| F5  | Preview · Publish DOM 은 field 계열을 부모 props 만으로 조립한다. 자식 노드 (Label · Input · FieldError) 는 그리지 않고, 자식의 스타일은 DOM 에 닿지 않는다                                                                                                                                                                   | `X/delegatedDom.tsx:752-771` (`ownsChild: ownsAll` — textfield 등 11종) · `S/components/TextField.tsx:107-115`                                                                                      |
| F6  | Canvas 는 같은 자식 노드를 각자 그린다. 값은 「자식 정의 → 부모 rule 의 partRule → 자식 자신의 값」 순으로 겹친다. 그래서 자식에 쓴 스타일은 Canvas 에만 보이고 DOM 에는 없다 (지금은 패널이 편집을 부모로 돌려서 가린다)                                                                                                     | `S/catalog/resolution/resolver.ts:620-633` · `D/rulePartRules.ts:179-194` · `R/subpart.ts:19-41`                                                                                                    |
| F7  | **원본의 스타일을 고쳐도 instance 에 닿지 않는다.** Components page 에서 Button 원본의 padding · 배경을 고치면 sample 만 바뀌고, Toolbar · ButtonGroup · Pagination 안의 Button 과 page 에 놓은 Button 은 그대로다. 원본이 받는다고 선언한 prop (IconButton 의 `label`) 만 닿는다                                             | 임시 테스트 실측 (2026-10-06, 삭제함). 원인: instance 루트로 내려가는 값이 instance 가 직접 쓴 키와 `accepts` 키뿐 — `resolver.ts:512-533` `instanceRoot` · `:680-697`                              |
| F8  | type 정의에 건 override 는 전부 닿는다. `type-Button` 에 걸면 놓인 Button 과 Toolbar · ButtonGroup · Pagination 안 Button 이 모두 바뀌고, `type-Label` 에 걸면 TextField 안 Label record 가 바뀐다 (DOM 은 F5 때문에 그리지 않는다)                                                                                           | 같은 실측. `resolver.ts:983-987` (template 위치에서 `findOverride`) · `S/catalog/commands/components.ts:139-153` (모든 library 정의가 대상)                                                         |
| F9  | override 가 DOM 에 닿는 길은 그 요소의 inline style 하나다. 생성 CSS · class 채널은 없다                                                                                                                                                                                                                                      | `X/domBinding.tsx:190-336` `catalogDomStyle` · `:1020-1068`                                                                                                                                         |
| F10 | Label · Input · FieldError · Description 원본은 없다. Components page 는 원본만 보여 준다                                                                                                                                                                                                                                     | `D/generated/reusableOriginLibrary.ts` 에 `origin-component-(label\|input\|fielderror\|description)` 0건 · `X/originViewNode.ts:20-22` · `S/catalog/componentCatalog.ts:1371` (팔레트 밖 원본 목록) |
| F11 | Select · ComboBox 원본은 항목을 루트에 Label · Trigger 와 나란히 둔다. 설치된 RAC 1.21.0 은 둘 다 안에 ListBox 를 넣어 쓴다. Preview DOM 은 이 항목 자식을 그리지 않고 `items` 도 넘기지 않는다 — 코드상 Preview 의 선택 목록이 비어 있다 (live 확인은 G0)                                                                    | `reusableOriginLibrary.ts:3852` · `:4041` · `X/domBinding.tsx:509-543` · `:555-562` · `S/components/Select.tsx:148-160` · RAC `dist/private/{Select,ComboBox}.mjs` 의 `ListBoxContext`              |
| F12 | library template 은 「다른 원본의 instance + slot 채움」 을 표현하지 못한다. template 노드가 가질 수 있는 것은 한 단계 patch 뿐이다. 루트가 다른 원본의 instance 인 정의 64개는 전부 상태 변형이고 자식이 없다                                                                                                                | `D/types.ts:654-680` (`LibraryDescendantPatch` · `LibraryTemplateNode`)                                                                                                                             |
| F13 | Card · Dialog · Popover 는 제목 + 설명 + 버튼 줄을 각자 정의한다. Modal 원본은 내용이 없다                                                                                                                                                                                                                                    | `reusableOriginLibrary.ts:2216` · `:5205` · `:5322`                                                                                                                                                 |

요약: 「원본 → instance」 구조는 컬렉션 항목까지만 쓰이고 있고 (ADR-234 · 237 ~ 241), 그 구조 위에서 스타일을 내려보내는 채널이 끊겨 있다 (F7). 부품은 원본이 없고 (F10), 모양의 정본이 부모마다 흩어져 있으며 (F2 · F3), DOM 은 부품 노드를 그리지 않는다 (F5).

### 참고한 재사용 패턴

| 패턴               | pen.dev (`pencil-shadcn.pen`, 2026-10-06 조회)                                                                                   | RAC 1.21.0 (설치본)                                                                                                                                                                             | 지금                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 항목 재사용        | `Tab Item/Active` 원본 → `Inactive` 는 그 instance → `Tabs` slot 이 두 항목을 허용 → 사용처가 항목 instance 로 채움              | TabList 의 정적 `<Tab>` 자식                                                                                                                                                                    | 적용됨 (ADR-234 · 237 ~ 241)     |
| 기본 부품 재사용   | Pagination 의 ← → 는 `Button/Large/Ghost` 의 instance                                                                            | Label · Input · Button · FieldError 를 모든 field 가 조합해 쓴다. 레퍼런스 사이트 예제는 `Form` 모듈 하나가 Label · FieldError · Description · FieldButton 을 정의하고 field 10종이 가져다 쓴다 | 없음 (F5 · F10)                  |
| 안에 넣는 컴포넌트 | —                                                                                                                                | Select · ComboBox 안의 ListBox, DatePicker 안의 Calendar. 레퍼런스 사이트 예제도 Select · ComboBox 가 `ListBox` 모듈을, DatePicker 가 `Calendar` 모듈을 가져다 쓴다                             | 구조만 일부 (Calendar), DOM 은 0 |
| 바탕 재사용 사슬   | `Card` (빈 slot 3) → `Dialog` · `Modal/Left` = Card instance + slot 채움 (다시 원본) → `Modal/Center` = `Modal/Left` 의 instance | Modal · Popover 안의 Dialog                                                                                                                                                                     | 없음 (F12 · F13)                 |

pen.dev 는 구조를 그대로 옮길 대상이 아니다 (사용자 지시). 예: Pagination 의 번호 slot 은 이 ADR 의 범위가 아니다.

### Domain (SSOT 3-domain)

- **D3 시각 스타일 (본체)**: 부품의 모양 정본을 부모 rule 의 delegation 에서 부품 자신의 rule 로 옮긴다. 정본은 여전히 catalog (`COMPONENT_RULES_TABLE`) 하나이고, 그 안의 중복을 하나로 모은다. 부모는 배치 (어디에 · 얼마나 넓게) 만 정한다. D1 · D2 와의 경계는 바뀌지 않는다. 바뀌는 것은 D3 안의 소유자이고, 2026-09-03 내부 부품 판정이 그 대상이다 (결정 지점 ③ — 위 사용자 지시가 근거).
- **D1 DOM/접근성**: RAC 가 내는 DOM · ARIA · 키보드는 변경 0. field 의 부품을 RAC 의 조합 방식 (`<TextField><Label/><Input/><FieldError/></TextField>`) 으로 넘길 뿐이고, 결과 DOM 은 지금과 같아야 한다 (G2 · G3 의 DOM 구조 대조).
- **D2 Props/API**: 부모의 `label` · `description` · `errorMessage` 는 그대로 부모의 prop 이다 (RSP 규정). 부품 instance 의 텍스트는 그 prop 을 받는 자리다. 새 prop 0.

Generator 선언 (ADR 작성 규칙 #2): 생성기는 자식 selector 를 이미 내보낸다 (`packages/rendering/src/renderers/CSSGenerator.ts:1371-1488` `generateCompositionCSS` — `.react-aria-{Parent} {childSelector}`). 이 ADR 은 그 출력에서 모양 선언을 줄이는 방향이고 새 emit 기능을 요구하지 않는다.

### 제약

- **hard — 시각 계약**: ADR-248 G3 수치 그대로. Canvas ↔ DOM geometry ≤ 1 CSS px, 비텍스트 픽셀 차이 ≤ 0.001.
- **hard — 의도한 화면 변화만**: F3 의 값을 하나로 모으면 일부 컴포넌트의 모습이 바뀐다. 모으는 기준은 react-aria.adobe.com 레퍼런스 예제다 (사용자 결정). G0 에서 그 기준으로 바뀌는 목록을 고정하고, 목록 밖의 변화는 0 이다. 레퍼런스 값은 부품의 기본 theme 값이다 (사용자 「레퍼런스는 스타일 일뿐이고 default theme값일 뿐이다」) — 권위가 아니고 원본에서 고치면 전체가 바뀌므로, 기본값으로 그대로 쓰고 항목별 예외를 두지 않는다. 값은 우리 token 으로 적고 token 의 수치는 theme 이 정한다. 레퍼런스에 없는 것 (크기 xs · sm · lg · xl 단계 · quiet 변형) 은 부품 자신의 rule 값을 쓴다.
- **hard — 저장 포맷 (BC 수식)**: template 위치 id 와 정의 id 가 바뀐다. `LIBRARY_CONTRACT_VERSION` 2 → 3 (`D/types.ts:10`). contract 2 로 저장된 개발용 프로젝트는 **전부** 열리지 않는다. 변환 · 재직렬화 0 파일. 보존 대상 프로젝트 0 (ADR-248 HC3) 이 전제다 — 사용자 확인 3.
- **hard — 성능**: ADR-246 ratchet A등급 증가 0. 부품이 원본의 instance 가 되면 해석 단계가 부품마다 한 층 늘어난다 — `scene.build` 증가는 G6 에서 잰다 (ADR-234 G4 가 같은 종류의 비용으로 +2 ms 대를 기록했다).
- **hard — 번들**: Builder initial ≤ 1,421,000 · Preview ≤ 623,000 (ADR-201 재승인, 만료 2026-10-25). `apps/publish` 수정 0.
- **soft**: Skia 전용 시각 효과 0. 구조 전환은 worktree 에서 phase 별로 커밋하고 Gate 통과 뒤 main 에 병합한다 (ADR-251 Decision 7 방식).

## Alternatives Considered

외부 사례:

- **RAC** (설치본 실측): 조합이 설계의 중심이다. Select · ComboBox 가 `ListBoxContext` 를, DatePicker 가 `CalendarContext` · `DialogContext` 를 제공하고, `ButtonContext` 는 14개 · `InputContext` 는 7개 컴포넌트가 쓴다. 부품의 스타일은 부품 자신의 className 으로 준다.
- **react-aria.adobe.com 레퍼런스 예제** (Vanilla CSS, 2026-10-06 조회 — 각 컴포넌트 문서의 `.md`): `Form.tsx` · `Form.css` 가 Label · FieldError · Description · FieldButton 을 한 번 정의하고 TextField · ColorField · SearchField · NumberField · ComboBox · Select · DateField · TimeField · DatePicker · DateRangePicker 가 가져다 쓴다. Input · TextArea 는 `TextField.css` 한 곳, DateInput 은 `DateField.css` 한 곳에 있다. field 상자의 칠 (`inset`) 은 공용 정의 하나를 Input · TextArea · DateInput · DateRangePicker 의 Group 이 쓴다. 부모가 덧붙이는 것은 배치와 몇 개의 명시 차이뿐이다 (ComboBox 는 버튼 자리 padding, NumberField 는 맞닿는 쪽 모서리 0, SearchField 는 둥근 모서리). 이 예제는 D1 의 권위가 아니고 (D1 정본 = 설치된 패키지), 여기서는 D3 값 차이를 모으는 기준으로만 쓴다.
- **React Spectrum S2**: field 부품 (FieldLabel · FieldGroup · HelpText) 을 한 모듈에 두고 TextField · NumberField · Picker · ComboBox · DatePicker 가 가져다 쓴다 (공개 소스 기준 지식 — 판정 근거로는 쓰지 않는다).
- **pen.dev**: 위 표. 원본을 고치면 instance 전부가 따라오고, 달라야 하는 값만 instance 의 override 로 적는다.
- **Figma**: 컴포넌트 안에 다른 컴포넌트의 instance 를 중첩하고, 안쪽 instance 의 속성을 바깥으로 노출한다. main 컴포넌트를 고치면 전 instance 에 반영된다.
- **Material 3 · Spectrum 의 component token**: 부품 단위 값을 token 으로 두고 (`label 글자 크기` 등) 컴포넌트들이 그 token 을 읽는다. 구조 재사용 없이 값만 한 곳에 모으는 방식이다.

### 대안 A: 부품을 원본의 instance 로 + 두 렌더 경로가 같은 노드를 그린다

- 설명: ① 원본 override 가 instance 루트까지 닿도록 채널을 고친다 (F7). ② Label · Input · FieldError · Description 원본을 만들고, field 계열 template 의 부품을 그 instance 로 바꾼다. Button 은 이미 있는 원본을 쓴다. ③ 부품의 모양을 부모 delegation 에서 부품 rule 로 모으고, 부모가 달라야 하는 값은 그 자리의 명시 patch 로 적는다. ④ Preview · Publish DOM 이 field 의 부품을 자식 노드에서 그린다 (RAC 조합). ⑤ 같은 방식으로 Select · ComboBox 에 ListBox instance 를, ⑥ Dialog · Popover 에 공용 바탕을 적용한다.
- 위험: 기술(**HIGH** — DOM 경로의 `ownsAll` 11종을 자식 렌더로 바꾸면서 결과 DOM 을 지금과 같게 유지해야 한다. 값 겹침 순서 (부품 원본 ↔ 부모 partRule) 를 바꾼다. ⑥ 은 library 가 표현하지 못하는 형태다 — F12) / 성능(MEDIUM — 부품마다 해석 한 층) / 유지보수(LOW — 정본이 부품당 하나가 되고 「DOM 은 안 그리는 노드」 특례가 없어진다) / 마이그레이션(MEDIUM — contract 2 프로젝트 전부 거부 · G3 승인 기록 재승인)

### 대안 B: type 정의를 단위로 + 프로젝트 stylesheet 채널

- 설명: 원본을 새로 만들지 않는다. F8 대로 type 정의 (`type-Label` 등) 의 override 는 이미 모든 노드에 닿으므로, Components page 에 type 정의 편집면을 추가한다. DOM 은 부품을 계속 부모가 조립하고, override 를 프로젝트 stylesheet (`.react-aria-Label { … }`) 로 내보낸다. 부모 delegation 의 모양 선언은 대안 A ③ 처럼 걷어낸다.
- 위험: 기술(MEDIUM — override → CSS 채널 신설, 부모 selector 와의 우선순위) / 성능(LOW) / 유지보수(**HIGH** — 편집 단위가 둘이 된다: 팔레트 컴포넌트는 원본, 부품은 type. 같은 type 을 쓰는 원본 둘 (Button · IconButton) 을 따로 고칠 수 없다. 자식 노드에 쓴 값이 Canvas 에만 보이는 F6 의 어긋남이 그대로 남고, inline 과 stylesheet 두 채널을 같이 유지한다) / 마이그레이션(LOW — template 변경 없음)

### 대안 C: 부품 단위 token (component token)

- 설명: 구조는 그대로 두고, 부품의 모양 값을 theme token 으로 올린다 (`--label-font-size` · `--label-font-weight` 는 이미 이 형태 — `base.css:32-34`). 부모 delegation 은 그 token 만 가리키고, 사용자는 Theme 에서 부품 token 을 고친다.
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(MEDIUM — token 으로 올린 속성만 고칠 수 있다. 부품이 늘 때마다 token 목록이 는다) / 마이그레이션(LOW). 제품 위험 **HIGH** — 원본 · instance 재사용이 아니다. Components page 의 원본을 고쳐서 전체가 바뀌는 사용자 요구를 주지 못하고, F7 · F11 · F13 은 그대로 남는다.

### 대안 D: 현행 유지

- 설명: 값은 token 으로, 모양은 부모마다.
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(**HIGH** — F2 · F3 의 중복이 계속 는다. F7 은 「원본을 고치면 instance 가 따라온다」 는 Components page 의 약속이 깨진 상태다) / 마이그레이션(LOW)

### Risk Threshold Check

| 대안 | HIGH+           | 판정                                                                  |
| ---- | --------------- | --------------------------------------------------------------------- |
| A    | 기술 HIGH 1     | Gate 로 관리 (G1 · G2 수직 절단으로 먼저 닫고, 실패 시 B 채널로 후퇴) |
| B    | 유지보수 HIGH 1 | 회피 대안 존재 (A)                                                    |
| C    | 제품 HIGH 1     | 목표 미달                                                             |
| D    | 유지보수 HIGH 1 | 목표 미달                                                             |

HIGH 가 없는 대안이 없다. 한 번 더 살핀 회피안: 「A 에서 ④ (DOM 이 자식을 그림) 를 빼고 B 의 stylesheet 채널을 쓴다」 — 기술 위험은 MEDIUM 으로 내려가지만 F6 의 어긋남 (자식 값이 Canvas 에만 보임) 을 남기고 채널이 둘이 된다. 그래서 A 의 실패 시 후퇴안으로만 둔다.

별도 ADR 분리 가능성 (작성 규칙 부차 질문): ⑤ (Select · ComboBox) 와 ⑥ (바탕 사슬) 은 ① ~ ④ 없이도 정의할 수 있어 분리할 수 있다. 다만 셋 다 「원본을 instance 로 재사용하고 DOM 이 그 노드를 그린다」 는 한 결정의 적용이고 같은 contract version 을 올린다. 사용자가 한 ADR 안의 Phase 로 두기로 정했다 (확인 1).

## Decision

**대안 A 를 채택한다.** 실행은 Phase 로 나누고, 첫 수직 절단 (Label × TextField) 으로 기술 위험을 먼저 닫는다.

결정 내용:

1. **단위는 원본이다.** 사용자가 Components page 에서 고치는 것은 원본이고, 그 원본의 instance 는 어디에 있든 따라온다. 원본에 쓴 스타일이 instance 루트까지 닿게 한다 (F7 수리). 기본 스타일뿐 아니라 상태별 스타일 (hover · pressed · disabled 등 `stateRules`) 도 같다 — 지금은 상태별 값이 template 루트를 투영한 뒤에 적용돼, 바깥 record 만 바뀌고 실제로 그리는 루트는 그대로다 (`resolver.ts:681` · `:710`). 순서는 원본 override → template 루트 → 중첩 루트이고, instance 가 쓴 상태별 값이 그 위에 남는다. 이것은 Label 같은 새 원본뿐 아니라 지금 있는 Button 등 전 원본에 해당한다.
2. **부품은 원본의 instance 다.** Label · Input · FieldError · Description 원본을 팔레트 밖 원본으로 등록하고 (`NESTED_REUSABLE_ORIGIN_TYPES` — Radio 선례), field 계열 template 의 부품 자리를 그 instance 로 바꾼다. field 안의 버튼은 레퍼런스 예제의 구분을 따른다: NumberField 증감 · Select trigger 는 Button 원본의 instance (secondary), ComboBox · DatePicker · DateRangePicker 의 버튼은 FieldButton 원본 하나의 instance 다. FieldButton 은 Button 원본의 instance 에 모양 patch 를 얹은 원본이다 (상태 변형 원본과 같은 형태 — library 가 이미 표현한다).
3. **모양은 부품이 정하고, 부모는 배치만 정한다.** 부모 rule 의 delegation 에서 부품의 모양 선언 (글자 크기 · 굵기 · 색 · 테두리 · 모서리 · 배경) 을 걷어내 부품 rule 로 모은다. 부모마다 다르던 값은 레퍼런스 예제가 그 부품을 다루는 방식으로 정한다 (사용자 결정 — 항목별 처리는 breakdown §2-2). 부모 안에서 실제로 달라야 하는 모양은 template 의 그 자리에 명시 patch 로 적는다 — 숨은 차이가 아니라 적힌 차이가 된다.
4. **값의 순서**: 부품 정의 → 부모가 주는 배치 → 부품 원본에 대한 프로젝트 override → template 자리의 명시 patch → instance 가 쓴 값. 부모의 partRule 이 부품 원본의 override 를 덮지 않는다.
5. **두 렌더 경로가 같은 노드를 그린다.** Preview · Publish DOM 은 field 의 부품을 자식 노드에서 그린다 (RAC 조합). 부모의 `label` · `description` · `errorMessage` 는 template 의 자리표시 (`{label}`) 로 부품에 내려간다. 결과 DOM 구조는 지금과 같다. 부품은 부모의 RAC context 를 그대로 받아야 한다: ① field 안의 부품은 RAC 컴포넌트 (Label · Input · FieldError · `Text slot="description"` · Button) 로 그린다. 지금의 FieldError binding 처럼 context 를 읽지 않는 정적 요소로 그리지 않는다 (`X/domBinding.tsx:473`). ② RAC 가 이름을 정한 slot (NumberField 의 `increment` · `decrement`, DateRangePicker 의 `start` · `end`) 은 template 의 그 자리가 갖고 binding 이 넘긴다. `slot` 은 RAC 의 prop 이고 편집 surface 에 내지 않는 내부 운반 값이다 (ADR-251 의 `size` 선례). ③ binding 은 문서가 실제로 쓴 값만 RAC 에 넘긴다. 원본 기본값 (`isDisabled: false`) 을 명시로 넘기면 부모 context 의 값 (부모가 disabled · 증감 한계) 을 덮는다 (`X/domBinding.tsx:496` · `L:2981`). ④ 오류 문구의 책임을 나눈다: 부모 prop `errorMessage` 는 작성자가 정한 문구이고, blur · submit 으로 생기는 validation 오류의 표시와 해제는 RAC 의 실행 상태다. FieldError 의 DOM 있음/없음은 RAC 가 정하고, Canvas 는 문서의 invalid 상태로 정한다.
6. **편집 범위**: 부품의 텍스트는 계속 부모의 prop 이 정본이다 (D2). 부품의 스타일은 부품 instance 에서 고칠 수 있고 두 경로에 똑같이 보인다. 패널의 「부모에서 편집하세요」 안내는 텍스트 축에만 남긴다 (SelectValue 의 축 분리 선례 — `resolveSubpartStyleOwnerType`).
7. **안에 넣는 컴포넌트**: Select · ComboBox 는 ListBox 원본의 instance 를 갖고 항목은 그 ListBox 의 slot 에 놓인다. Preview 의 선택 목록은 그 항목에서 나온다 (F11 수리). library template 은 지금 이것을 표현하지 못한다 — 항목을 ListBox instance 의 자식으로 적으면 ListBox 의 기본 항목 3개는 루트 안에 남고 Select 의 항목은 루트 밖에 붙는다 (F12 · `resolver.ts:1118` · `:1182`). 그래서 library 의 「원본의 instance + slot 채움」 표현 (타입 · 검증 · 해석) 을 Phase 4 의 첫 작업으로 만든다.
8. **바탕 사슬**: Dialog · Popover 의 제목 · 설명 · 버튼 줄을 공용 바탕 원본에서 받는다. Decision 7 이 만든 slot 채움 표현을 쓴다. G5 에서 바탕 원본의 모양 (Card 와 합칠지 포함) 을 판정하고, 맞지 않으면 이 항목만 미룬다.
9. template 구조가 처음 바뀌는 병합 (Phase 2) 에서 `LIBRARY_CONTRACT_VERSION` 을 3 으로 올리고, 그 뒤 template 구조가 다시 바뀌는 병합마다 한 번씩 더 올린다. 앞 버전 문서는 거부한다. 변환 코드는 만들지 않는다 (사용자 확인 3).
10. 범위 밖: 원본 template 의 slot 을 데이터에서 비우는 일 (2026-10-06 「지금 구조 유지해」) · Pagination 번호 slot · Section 3종의 감싸는 노드 · owner 가 그리는 부품 (Checkbox indicator · TreeItem chevron — 2026-10-04 판정 유지).

위험 수용 근거: A 의 HIGH 는 「DOM 조립 방식을 바꾸면서 결과를 그대로 유지」 하는 것과 「값 순서 변경」 두 가지다. 둘 다 부품 하나 × 부모 하나 (Label × TextField) 로 끝까지 통과시켜 볼 수 있다 — 원본 편집 → Canvas record → Preview DOM 의 computed style 까지. 같은 조합 방식이 이미 동작하는 곳이 있다 (Dialog · Card 는 자식 노드를 각자의 binding 으로 그린다 — `S/components/Dialog.tsx:22-57` · `X/delegatedDom.tsx:1248-1277`). G2 가 실패하면 대안 B 의 stylesheet 채널로 물러나고 ④ 는 접는다. 마이그레이션 위험은 ADR-251 과 같은 전제 (보존 대상 0) 로 수용한다 — 사용자 확인 3.

기각 사유:

- **B**: 싸지만 편집 단위가 둘이 되고 (원본 · type), Canvas 와 DOM 이 다른 노드 집합을 그리는 상태를 남긴다. 사용자가 정한 개념 (원본 → instance) 과 다르다.
- **C**: 값은 한 곳에 모이지만 구조 재사용이 아니다. 원본 편집이 instance 에 닿지 않는 F7 과 Preview 목록이 비는 F11 을 고치지 못한다.
- **D**: 목표를 주지 않는다. F7 은 현행 기능의 결함이다.

> 구현 상세: [253-base-ui-origin-reuse-breakdown.md](design/253-base-ui-origin-reuse-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                           | 심각도 | 대응                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | DOM 구조와 동작이 달라짐 — `ownsAll` 을 자식 렌더로 바꾸면 조건부 부품 (label 이 비면 Label 없음 · necessity 표시) 이 어긋날 수 있다. FieldError 를 지금의 정적 `span` binding 으로 그리면 `aria-describedby` 가 가리키는 요소가 사라지고 blur · submit 으로 생기는 validation 오류가 표시되지 않는다 (`X/delegatedDom.tsx:752-771` · `S/components/TextField.tsx:107-115` · `X/domBinding.tsx:473` · `X/presence.ts:204-221`) |  HIGH  | G2 · G3 — 전환 전후 DOM 구조 대조 (요소 · class · ARIA 속성 · 순서) 를 부모 × 상태 조합으로. Label · Description 의 있음/없음은 Canvas 와 같은 presence 규칙 하나를 읽고, FieldError 는 RAC 가 정한다 (Decision 5 ④). G3 에 동적 validation 검사 |
| R2  | 값 순서 변경의 파급 — 부모 partRule 이 부품 override 를 덮지 않게 하면 partRule 에 기대던 다른 부품 (Tab · RadioItems 등) 의 값이 바뀔 수 있다 (`resolver.ts:461-505` `applyTypedRules` · `:620-633` · `D/rulePartRules.ts:1230-1300`)                                                                                                                                                                                         |  HIGH  | G1 — 순서 표를 unit 으로 고정하고 ADR-248 G3 하니스 전 case 를 돌려 승인 차이 증가 0. 배치 키와 모양 키를 나누는 목록을 G0 에서 고정                                                                                                             |
| R3  | 의도하지 않은 화면 변화 — delegation 의 모양 선언을 걷어내면 F3 의 값 차이가 사라진다. 어떤 것은 의도한 차이일 수 있다 (`T:13623` · `T:3264` · `T:4218` · `T:10571`)                                                                                                                                                                                                                                                           |  HIGH  | 기준은 레퍼런스 예제 (사용자 결정). G0 에서 그 기준으로 부품 × 부모 변화 목록을 고정한다. G3 는 목록 밖 차이 0                                                                                                                                   |
| R4  | 해석 비용 — 부품마다 instance 한 층. field 가 많은 Form 에서 `scene.build` 가 는다 (`resolver.ts:1118-1164`)                                                                                                                                                                                                                                                                                                                   |  MED   | G6 — ratchet A등급 증가 0 · 600 요소 seed 의 `scene.build` Δ 측정. 초과 시 ADR-234 의 해석 재사용 (같은 원본의 instance 는 한 번만 푼다) 을 부품에 적용                                                                                          |
| R5  | library 표현력 — Select 의 ListBox 항목과 바탕 사슬은 template 이 slot 채움을 가져야 한다 (`D/types.ts:654-680`). template instance 노드의 `children` 은 slot 채움이 아니라 중첩 루트 뒤에 따로 붙는다 (`resolver.ts:1182-1222`). 프로젝트 정의 쪽도 template 노드 자신의 override 는 해석 때 읽지 않는다 (`resolver.ts:942-944`)                                                                                              |  HIGH  | Phase 4 의 선행 작업 (Decision 7). G4 — ListBox 루트 안에 Select 의 항목만 있고 루트 밖 항목 0 · ListBox 기본 항목 0. 불가하면 Phase 4 · 5 를 미룬다                                                                                             |
| R6  | 자리표시가 원본 instance 자식에 쓰인 적이 없다 — `{label}` 은 지금 type 노드에만 있다 (0건). 구조 편집 때 그런 자리는 `POSITION_HAS_TEMPLATE_BINDING` 으로 막힌다 (`resolver.ts:991-996` · `S/catalog/commands/materialize.ts:244-245`)                                                                                                                                                                                        |  MED   | G2 — `{label}` 이 Label instance 의 텍스트로 내려가는 것을 unit + live 로 확인. 부품 자리는 구조 편집 대상이 아니므로 막힘은 의도와 같다                                                                                                         |
| R7  | contract 2 프로젝트 전부 거부 · contract 2 위치 id 를 쓰는 테스트와 G3 승인 기록                                                                                                                                                                                                                                                                                                                                               |  MED   | 의도된 동작 (사용자 확인 3). 테스트 · 승인 기록은 새 id 로 고친다                                                                                                                                                                                |
| R8  | 패널 안내 · AI 도구가 옛 판정을 읽는다 — `R/subpart.ts` · `apps/builder/src/builder/panels/delegatedSubpart.ts` · `apps/builder/src/services/ai/tools/updateElement.ts:26-43`                                                                                                                                                                                                                                                  |  MED   | Phase 3 에서 술어를 텍스트 축 · 스타일 축으로 나누고 소비처 4곳을 같이 고친다. `.claude/rules/ssot-hierarchy.md` 의 sub-part 절 갱신                                                                                                             |
| R9  | library 생성 파일 직접 편집 — `reusableOriginLibrary.ts` 를 손으로 고친다 (생성 스크립트 삭제됨)                                                                                                                                                                                                                                                                                                                               |  LOW   | library 검증 (`buildCodeCatalogLibrary`) 이 구조 오류를 잡는다. template 편집은 스크립트로 일괄 적용하고 diff 를 검토                                                                                                                            |
| R10 | 부품이 부모의 RAC context 를 잃음 — 일반 Button binding 은 `slot` 을 넘기지 않아 NumberField 가 slot 오류를 내고, `isDisabled: false` 를 명시해 부모 disabled · 최댓값에서의 증감 제한을 덮는다. 설치 RAC 는 명시 prop 을 context 보다 우선한다 (`X/domBinding.tsx:485-504` · `L:2981` · `S/components/NumberField.tsx:93` · RAC `dist/private/utils.mjs` `useContextProps`)                                                   |  HIGH  | Decision 5 ② · ③. G3 — 부모 disabled · readOnly · min/max 경계에서 증감 · 열기 · 지우기 버튼의 실제 상태와 동작                                                                                                                                  |

## Gates

측정 조건: 대상은 팔레트가 만드는 실제 원본 instance (합성 fixture 아님). 불리한 경우 = field 계열 × size xl × labelPosition side × invalid + description. oracle = 실제 브라우저의 DOM 과 `getComputedStyle` (Canvas ↔ DOM), 시스템 자신의 재생성값이 아니다. 대조군 = 전환 전 빌드 (별도 worktree) 의 같은 문서 · 같은 조합이고, 성능은 전환 전후 교대 3쌍으로 잰다. 기록 항목: 기기 · DPR · 탭 `visibilityState`.

| Gate | 시점            | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                 |
| ---- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G0   | 착수 전         | 인벤토리 고정: ① 레퍼런스 예제 기준으로 만든 부품 × 부모 변화 목록 (breakdown §2-2 를 px 단위로 전개) ② 자식을 그리지 않는 DOM binding 전수 ③ 배치 키 · 모양 키 목록 ④ live 재현 — 원본 스타일 편집이 instance 에 안 닿음 (F7) · Preview Select 목록 (F11) ⑤ 레퍼런스가 정하지 않는 항목 (크기 단계 · quiet) 의 값 = 부품 rule 값임을 확인                                                                                                                                                                                    | 목록이 breakdown §2 의 1.5배를 넘으면 breakdown 보강 후 진행 |
| G1   | Phase 1         | 원본에 쓴 스타일이 page 에 놓은 instance 와 다른 원본 안의 instance (Toolbar · ButtonGroup · Pagination) 의 Canvas record · Preview DOM 에 닿는다 (원복 RED). 상태별 스타일도 같다: 원본의 hover · pressed · disabled 값을 고치면 **실제로 그리는 template 루트** 가 그 상태에서 새 값을 갖고 (바깥 record 만 바뀌는 것은 실패), Preview 에서 실제 hover · press 의 computed style 이 바뀐다 (원복 RED). 값 순서 표 unit — instance 가 쓴 상태별 값이 원본 override 위에 남는다. G3 하니스 전 case 승인 차이 증가 0 (R2)      | 순서 변경을 부품 type 한정으로 좁힌다                        |
| G2   | Phase 2         | 수직 절단 Label × TextField: Label 원본의 굵기 · 색 · 글자 크기를 고치면 TextField 안 Label 이 Canvas 와 Preview 에서 같이 바뀐다 (live). `label` prop 이 Label 텍스트로 내려간다. 전환 전후 TextField DOM 구조 동일. G3 하니스 TextField 전 case PASS (R1 · R6)                                                                                                                                                                                                                                                              | 대안 B 의 stylesheet 채널로 후퇴하고 Decision 5 를 접는다    |
| G3   | Phase 3         | 전 부품 × 전 부모: 부모 delegation 에 부품의 모양 선언 0 (정적 테스트 — 허용 목록 = 배치 키) · DOM 구조 대조 PASS · G3 하니스 PASS 이고 차이는 G0 목록과 같다 (R1 · R3). 동작: ① 부모 disabled · readOnly · NumberField 의 min/max 경계에서 증감 버튼의 disabled 상태가 전환 전과 같고, 증감 · Select/ComboBox/DatePicker 열기 · SearchField 지우기가 실제로 동작한다 (R10) ② required · email · pattern 입력 → blur · submit → 오류가 보이고, 고치면 사라지며, 입력의 `aria-describedby` 가 가리키는 요소가 DOM 에 있다 (R1) | 통과한 부모만 반영하고 나머지는 다음 phase 로                |
| G4   | Phase 4         | library 의 slot 채움 표현: 타입 · 검증 · 해석 unit — ListBox 루트 안에 Select 의 항목만 있고 루트 밖 항목 0 · ListBox 기본 항목 0 (원복 RED) (R5). Select · ComboBox: Preview 의 선택 목록 = Canvas 의 항목 (추가 · 삭제 · 텍스트 변경이 양쪽에 반영). ListBox 원본의 스타일 편집이 Select 의 목록에 닿는다                                                                                                                                                                                                                   | Phase 4 · 5 를 미룬다                                        |
| G5   | Phase 5 착수 전 | 공용 바탕 원본의 모양 판정 (Card 와 합칠지 포함). Dialog · Popover 의 DOM · Canvas 가 전환 전과 같다                                                                                                                                                                                                                                                                                                                                                                                                                          | Decision 8 을 미루고 ADR 을 닫는다 (후속은 사용자 결정)      |
| G6   | 각 Phase 끝     | ADR-246 ratchet A등급 증가 0 · `scene.build` Δ 기록 · initial 번들 상한 안 (R4)                                                                                                                                                                                                                                                                                                                                                                                                                                               | 해석 재사용 적용. 그래도 넘으면 사용자 판정                  |
| G7   | 종결            | 사용자 확인 — Components page 에서 Label · Input · Button 원본을 고쳐 Builder 와 Preview 전체가 한 세트로 바뀌는 것                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                            |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 기본 원본 하나를 고치면 그 원본을 쓰는 전 컴포넌트가 Builder 와 Preview 에서 같이 바뀐다. Components page 가 실제로 디자인 시스템의 편집면이 된다.
- 부품의 모양 정본이 하나가 된다. 부모마다 조금씩 다르던 값 (F3) 이 없어지거나, 적힌 차이로 남는다.
- Canvas 와 DOM 이 같은 노드 집합을 그린다. 「자식에 쓴 값이 Canvas 에만 보이는」 종류의 어긋남과 그것을 가리던 패널 특례가 없어진다.
- Preview 의 Select · ComboBox 목록이 문서의 항목에서 나온다.
- Select 와 ComboBox 가 모양으로 구분된다. 지금은 둘 다 입력 상자에 화살표가 붙은 모양이라 구분이 가지 않았다 (사용자 2026-10-06). 레퍼런스 기본값에서는 Select 가 누르는 Button 이고 ComboBox 가 글자를 넣는 Input + 작은 버튼이다.

### Negative

- contract 2 로 저장된 개발용 프로젝트는 열리지 않는다 (의도).
- 일부 컴포넌트의 모습이 바뀐다 (G0 승인 목록).
- 2026-09-03 내부 부품 판정을 고친다. `.claude/rules/ssot-hierarchy.md` 의 「D3 read-only sub-part」 절과 [evidence](evidence/923-phase5-followup-subpart-extension.md) 에 이 ADR 을 가리키는 표기를 넣는다 (Implemented 승격 때).
- 부품마다 해석 한 층이 늘어난다 (G6).
- 영향 파일 (대표): `D/generated/reusableOriginLibrary.ts` · `T` · `D/rulePartRules.ts` · `D/types.ts` · `S/catalog/resolution/resolver.ts` · `S/catalog/componentCatalog.ts` · `X/{delegatedDom.tsx, domBinding.tsx, presence.ts}` · `S/components/{TextField, TextArea, NumberField, SearchField, ColorField, Select, ComboBox, DateField, TimeField, DatePicker, DateRangePicker}.tsx` · `S/components/styles/base.css` · `S/catalog/resolvers/resolveDelegatedChildFontSize.ts` · `R/{subpart.ts, componentsPage.ts, layouts.ts}` · `apps/builder/tests/adr248-g3/`.
- ADR-248 Phase 4 의 G3 승인 기록 중 field 계열 항목은 다시 승인해야 한다.
