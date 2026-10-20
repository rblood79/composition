# ADR-276: Button 글자를 Text 자식으로 통합 · IconButton 통합

## Status

Proposed — 2026-10-20

- 사용자 요청: `/create-adr button 글자 Text 자식 통합 · IconButton 통합` (2026-10-20)
- 방향을 정한 사용자 원문 (2026-10-20): 「button컴퍼넌트의 text를 button에서 자체적으로 렌더링하고있어서 align 적용이 되지않는문제, button의 텍스트변경후 icon 추가시 text가 추가 생성되는문제, iconbutton컴퍼넌트에서 icon프러퍼티에서 아이콘삭제가 안되는문제. 여러문제가 있다- 종합했을때 button컴퍼넌트와 iconbutton 컴퍼넌트 를 통합 - button컴퍼넌트에 text를 처음부터 넣게되면 문제가 해결되지않나?」
- 선행 결정 (그대로 둔다): ADR-254 Decision 5 (template 이 부모 prop 에 묶은 글자는 그 prop 이 정본 — `{label}` 바인딩 편집 경로) · ADR-256 (빌더 = RAC 수준 조립, 사용자 결정 2026-10-09 「Icon div · 글자 span 유지」 · Decision 7 `presentWhen: "nonEmptyText"`) · ADR-260 (origin 은 page 의 노드) · 사용자 지시 2026-10-14 「마이그레이션 코드 금지 (개발 단계)」 · 구조 변경 계약 Step 3 (origin template 구조 변경 = `LIBRARY_CONTRACT_VERSION` 증가, ADR-256 사용자 승인 선례).
- 리뷰: Round 1 (2026-10-20, codex) HIGH 3 → 같은 날 수리 (`docs/adr/reviews/276.md`) — h1 글자 없는 중첩 Button 의 기본 라벨 (Decision 5) · h2 template 글자 앞의 owned Icon 순서 (Decision 1 · 2 — Icon 도 template 자리) · h3 origin 삭제 + 옛 문서 유지 조합 (Decision 7 — contract 증가 고정, 「그대로 그린다」 선택지 삭제). Round 2 (같은 날, codex) 는 h1 ~ h3 설계 해소 확인 + 수리에서 생긴 신규 HIGH 1 (h4 — Pagination · Menu · Popover · Tooltip 을 글자 없는 호스트로 잘못 분류) → 같은 날 수리 (Decision 5 를 자리별 실제 `children` 값 표로). 수리 검증 round 는 사용자 판단.

## Context

**Domain**: D2 (Button 의 글자 · 아이콘을 담는 모델 — S2 `<Button><Icon/><Text/></Button>` 의 children 조립) + D3 consumer 정합 (Canvas 가 Button 글자를 그리는 경로 · 정렬). D1 (RAC Button DOM) 은 건드리지 않는다 — RAC Button 안에 Icon · Text 요소가 들어가는 것은 S2 레퍼런스 구조 그대로다.

### 실측 (2026-10-20)

Button 에 글자 모델이 **둘** 있다.

| 모델                     | 어디서                                                                                                                                                                                                                                                                | Canvas                                                                                                                                                                                    | DOM                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ① 자체 `children` 문자열 | 팔레트 Button origin template (`lib:template:component-button` — `props.children: "Button"`, 자식 0)                                                                                                                                                                  | `canvasBinding.ts` `bindings.button` 이 **익명 글자**로 그린다 — `align: "center"` · `autoCenter: true` 고정 (626행). `withComposedText` 가 혼합 내용의 익명 글자를 자식 글자 노드로 합성 | RAC Button 의 string children (inline-flex 가 `justify-content` 로 놓는다) |
| ② Text 자식 노드         | IconButton origin template (`lib:template:component-iconbutton` — `Button > Icon{icon} + Text{label}`), 또는 Properties 에서 Button 에 아이콘을 넣는 순간 (`catalogButtonChildCommands.setIcon` 이 ① 의 글자를 Text 자식으로 옮기고 Button 의 `children` 을 `remove`) | 자식 노드 — 부모의 Layout 정렬 (`justifyContent`) 을 따른다                                                                                                                               | 자식 요소 (`span.react-aria-Text`)                                         |

사용자가 보고한 세 결함은 전부 ① 과 ② 사이에서 난다.

1. **정렬 미적용** — ① 의 Canvas 경로가 center 를 고정해 `textAlign` · Layout 정렬을 읽지 않는다. DOM 은 `justify-content` 를 따르므로 Canvas ≠ Preview.
2. **글자 중복** — 팔레트 Button 은 origin instance 다. 글자를 바꾸면 instance 에 `children` override 가 생기고, 아이콘을 넣으면 `setIcon` 이 그 override 를 Text 자식으로 옮기며 `remove` 한다. `remove` 는 override 만 지우므로 template 의 기본 라벨 "Button" 이 다시 드러난다 → Text 자식 (바꾼 글자) + 익명 글자 (template 기본값) 두 개. 글자를 바꾼 뒤에만 재현되는 이유다.
3. **IconButton 아이콘 삭제 불가** — IconButton 은 `icon` prop 이 template Icon 의 `iconName: "{icon}"` 에 묶여 있고 definition `defaults.icon = "star"` 다. prop 을 지우면 기본값 star 로 돌아간다. 「없음」 은 기본값이 없을 때만 표현된다 — 채워지지 않은 `{icon}` 자리 (path 데이터 없는 글리프) 는 Canvas 상자 · DOM 요소 둘 다 없다 (`catalogHiddenAtRest`, `packages/shared/src/catalog/runtime/presence.ts` 730 ~ 737행).

S2 1.8.1 (D2 정본) 의 Button children 은 `<Icon/> <Text/>` 조립이고 IconButton 이라는 컴포넌트는 없다 (icon-only 는 ActionButton + `aria-label`). 이 저장소의 IconButton 은 「아이콘이 붙은 Button」 reusable (ADR-148 Phase 2) 이라 Button + `setIcon` 과 같은 것이 둘이다.

**해석 순서 (Round 1 h2 의 근거)**: composite instance 의 자식은 template 자식 다음 소유 자식이다 — resolver 가 template root 부터 펼친 뒤 `node.children` 을 붙이고 (`packages/shared/src/catalog/resolution/resolver.ts` 1233 · 1292행), consumer 의 `collapsedChildren` 도 안쪽 template 자식을 먼저 둔다 (`runtime/compositionRoot.ts` 495행). 소유 자식을 `index: 0` 에 넣어도 template Text 앞에 설 수 없다.

**중첩 Button (Round 1 h1 의 근거)**: `origin-component-button` 을 부품으로 쓰는 template 자리는 27 — **자기 글자가 있는 자리 15** (Toolbar `Action 1 · 2 · 3` · Pagination `← · 1 · 2 · 3 · →` · ButtonGroup `Cancel · Save` · Menu trigger `Menu` · Dialog `Open Dialog · Close` · Popover trigger `Open Popover` · Tooltip trigger `Hover me`) · **글자 없는 자리 8** (`children: ""` + 자기 Icon 자식 또는 SelectValue — NumberField 증감 2 · SearchField 지우기 · Select trigger · Calendar month/year picker trigger 2 · ContextualHelp trigger · FieldButton) · Button 상태 변형 4 (`children` 없음). ToggleButton 은 7 — 글자 2 (ToggleButtonGroup `Toggle 1 · 2`) + 상태 변형 5. 분류는 호스트 이름이 아니라 자리별 실제 `children` 값이다 (Round 2 h4 — breakdown §2b 표). 중첩 composite 는 자기 definition 의 `accepts` 키마다 `props[key] ?? defaults[key]` 로 template 을 묶는다 (`resolver.ts` `templateBindings` 810행) — 호스트가 `label` 을 쓰지 않으면 기본 라벨이 그 자리에 나온다.

### 제약

- **D3 대칭**: Canvas · Preview 가 Button 글자를 같은 자리 · 같은 정렬로 그려야 한다 (`/cross-check`).
- **마이그레이션 코드 금지** (사용자 2026-10-14): 옛 문서의 Button (① 모델) 을 바꿔 쓰는 변환 코드는 넣지 않는다. origin template 구조를 바꾸므로 구조 변경 계약 Step 3 에 따라 contract 를 올려 옛 개발용 프로젝트를 거부한다 (ADR-251 · 256 · 275 선례). 「옛 문서를 그대로 그린다」 는 성립하지 않는다 — 문서 노드는 origin 정의 id 를 참조하므로 IconButton 정의를 지우면 `DANGLING_DEFINITION` (`document/graph.ts` 996행) 이고, 같은 버전에서 Button template 을 바꾸면 옛 `children` override 와 새 기본 `label` 이 함께 남는다.
- **Button host 전수**: 위 중첩 27 + 7 자리가 글자 유무 · 자기 Icon 자식 유무가 다르다. 글자가 있는 자리 17 은 지금 보이는 문구를 그대로 (`label` 로) 보존해야 하고, 글자 없는 자리 8 은 Text 없이 (자기 Icon 자식 또는 SelectValue 만) 그려져야 한다 — 빈 Text 의 flex 자리 · gap 도 남지 않아야 한다.
- 성능: initial 번들 상한 (ADR-201 재승인) · ratchet (ADR-246) 안.

## Alternatives Considered

### 대안 A: 두 모델 유지 + 결함 3건 개별 수리

- 설명: `bindings.button` 이 `justifyContent` · `textAlign` 을 읽게 하고, `setIcon` 이 template 기본 라벨까지 가리도록 instance 에 빈 `children` 을 쓰고 (또는 ① 글자를 `""` 로 덮고), IconButton `defaults.icon` 을 없애 「없음」 을 둔다.
- 위험: 기술(M) — 세 수리가 서로 다른 층 (Canvas binding · 명령 · prop 스키마) 이고 두 모델 전환 경계 (아이콘 제거 → 글자 복귀 · instance override · breakpoint 층) 가 그대로 남아 같은 종류의 결함이 다시 난다 / 성능(L) / 유지보수(H) — Button 글자가 「자체 문자열」 과 「Text 자식」 둘로 남아 모든 소비자 (인라인 편집 · Properties · AI write · clipboard · 원본 반영) 가 두 경로를 유지 / 마이그레이션(L) — 문서 변경 0.

### 대안 B: Button origin = IconButton template 그대로 (`Button > Icon{icon} + Text{label}`) + 생략 규칙 · IconButton 통합 (사용자 제안)

- 설명: 팔레트 Button 의 origin template 을 IconButton 과 **같은** 구조로 바꾼다 — Icon 과 Text 가 둘 다 template 자리 (노드) 이고 값은 instance 의 `icon` · `label` prop 이 묶는다 (ADR-254 Decision 5). 「없음」 은 생략 규칙으로 표현한다: `defaults.icon` 없음 → 채워지지 않은 `{icon}` 은 숨김 (presence.ts 730행, 이미 있는 규칙), Text 는 `presentWhen: "nonEmptyText"` → `label: ""` 이면 노드 자체가 없다 (`catalogAbsentByValue` 711행 — Canvas · DOM 이 같은 술어, Select 의 Label 자리가 이미 쓴다). 아이콘 추가 · 변경 · 삭제 = `icon` prop 쓰기 · 제거, 글자 = `label` prop — 자식 노드를 만들고 옮기는 명령 (`setIcon` · `clearIcon` · `setText`) 은 없어진다. Icon 이 Text 앞에 서는 순서는 template 이 고정한다 (h2). Canvas 는 Button 의 익명 글자 분기를 타지 않고 자식 노드 배치 (Layout 정렬) 를 그대로 쓴다. IconButton 은 Button 과 같은 것이 되므로 팔레트에서 빼고 origin 정의를 정리한다. 중첩 Button 자리는 `children` 값을 그대로 `label` 로 옮긴다 — 글자 있는 자리는 그 문구, `""` 인 자리는 `""` (h1 · h4).
- 위험: 기술(M) — 중첩 자리 34 전수 (`children` → `label` 이관, 값 보존) 와 자체 `children` 문자열을 읽는 코드 (`textOf(node)` · `catalogTextKey` · AI write · clipboard) 가 Button 에서는 `label` prop 을 가리켜야 한다 / 성능(L) — Button 당 template 자리 2 (IconButton · field 부품은 이미 그 구조) / 유지보수(L) — 글자 · 아이콘 경로 하나 (`{label}` · `{icon}` 바인딩, `TEXT_ONLY_SUBPART_PARENTS` 와 같은 꼴) / 마이그레이션(M) — contract 증가로 옛 개발용 프로젝트 거부 (변환 0, 사용자 프로젝트 「123」 포함 — 재생성).

### 대안 C: Button 글자를 자체 `children` 하나로 통일 (Text 자식 모델 제거)

- 설명: 반대로 Text 자식을 없애고 아이콘을 `icon` prop 으로만 두어 Canvas · DOM 이 노드 없이 합성한다 (S2 의 string children 과 같은 겉모습).
- 위험: 기술(H) — ADR-256 「빌더 = RAC 수준 조립」 (Icon · Text 가 노드) 과 반대 방향이고, 아이콘의 위치 · 크기 · 색 · 두 개 이상 (앞 · 뒤) 을 prop 으로 다시 표현해야 한다 (ADR-142 Button.binding 파일럿이 「icon 합성 분리」 로 이미 기각한 모델) / 성능(L) / 유지보수(H) — Button 만 다른 조립 규칙 / 마이그레이션(M) — IconButton · field 부품 template 전부 역변환.

### Risk Threshold Check

| 대안 | HIGH+                          |
| ---- | ------------------------------ |
| A    | 유지보수 H (두 모델 영구)      |
| B    | 없음 (기술 M · 마이그레이션 M) |
| C    | 기술 H · 유지보수 H            |

루프 불필요 — B 에 HIGH 가 없다.

## Decision

**대안 B** — Button 의 origin template 은 IconButton 의 것 (`Button > Icon{icon} + Text{label}`) 에 생략 규칙 둘을 더한 것이고, 글자 · 아이콘은 instance 의 `label` · `icon` prop 이 정본이다. IconButton 은 Button 에 통합한다.

- 위험 수용 근거: 기술 M 은 Phase 0 의 호스트 · 소비자 전수 인벤토리 (G0) 와 호스트별 `label` 쓰기 (G1 단위) 로 흡수한다. 마이그레이션 M 은 「변환 코드 없음」 원칙 안에서 contract 증가 하나로 닫는다 — 새 코드는 ② 모델 하나만 쓴다.
- 기각 사유: A 는 결함의 원인 (모델 둘) 을 남긴다 — 사용자가 본 세 결함이 그 경계에서 났다. C 는 ADR-256 · ADR-142 의 결정을 뒤집는다 (RAC 조립 · icon 합성 분리) — 그 결정의 재개 조건 (사용자 재제기) 이 없다.
- 결정 내용:
  1. **origin template**: `lib:template:component-button` = `Button > Icon (slot icon, iconName "{icon}") + Text (slot label, children "{label}", presentWhen "nonEmptyText")` — IconButton template 의 자식 둘을 그대로 가져오고 Text 에 생략 규칙을 단다. definition `origin-component-button` 의 `accepts` 에 `label` · `icon` 추가, `defaults.label = "Button"`, **`defaults.icon` 없음** (채워지지 않은 `{icon}` = 글리프 없음). Button 자체 `children` 문자열은 template 에서 뺀다. 상태 변형 4 는 template 참조라 그대로.
  2. **아이콘 = `icon` prop**: Properties 의 Icon 칸은 instance 의 `icon` prop 을 쓰고 (「없음」 = prop 제거), 자식 노드를 만들지 않는다. `catalogButtonChildCommands` (`setIcon` · `clearIcon` · `setText`) · `catalogButtonChildren` · `CatalogButtonChildFields` 는 삭제 — Button 의 Content 섹션은 오늘 IconButton 이 타는 경로 (definition `accepts` 의 `label` · `icon` 칸) 하나다. 작성자가 Icon 노드를 Button 에 더 넣는 것은 소유 자식이고 template 자식 뒤에 선다 (뒤 배치 · 두 번째 아이콘은 그 길).
  3. **글자 = `label` prop** (ADR-254 Decision 5): 인라인 편집 (`catalogTextBinding` — 이미 `{label}` 경로) · Properties Label 칸 · AI write · clipboard · 원본 반영이 같은 prop 에 쓴다. Canvas 는 Text 자식 노드 경로로 그린다. `bindings.button` 의 익명 글자 (center 고정) 분기와 `withComposedText` 의 Button · ToggleButton 호출은 삭제한다 (옛 ① 문서는 7 로 거부되므로 읽기 경로를 남기지 않는다).
  4. **정렬**: Button 글자의 가로 정렬은 Button 의 Layout 정렬이 정본이다. `textAlign` 은 Text 자식 자신의 줄 안 정렬 (여러 줄일 때) 로만 뜻이 있다 — S2 · DOM 과 같다.
  5. **중첩 Button 자리** (27 + ToggleButton 7): template Icon · Text 를 그대로 받으므로 자리마다 현재 `children` 값을 **그대로** `label` 로 옮긴다 (값 변경 0 — 분류는 호스트 이름이 아니라 자리별 값, breakdown §2b 표가 정본). 글자 있는 자리 17 (Toolbar `Action 1~3` · Pagination `← 1 2 3 →` · ButtonGroup `Cancel · Save` · Menu `Menu` · Dialog `Open Dialog · Close` · Popover `Open Popover` · Tooltip `Hover me` · ToggleButtonGroup `Toggle 1 · 2`) 는 `label: "<그 문구>"` 로 지금 보이는 글자를 보존한다. 글자 없는 자리 8 (NumberField 증감 2 · SearchField 지우기 · Select trigger · Calendar month/year picker trigger 2 · ContextualHelp trigger · FieldButton — 전부 `children: ""` + 자기 Icon 자식 또는 SelectValue) 만 `label: ""` (Text 는 노드 자체가 없다 — flex 자리 · gap 0). 상태 변형 9 는 `children` 이 없어 definition 기본 라벨 (`Button` · `Toggle Button`) 을 받는다 — 지금과 같다. 자기 Icon 자식은 그대로 둔다 (template Icon 은 `icon` 없음이라 숨김) — `icon` prop 으로 옮기는 것은 범위 밖 (표에 후보만 표기).
  6. **IconButton**: 팔레트 항목 · `component-iconbutton` origin 정의 · `reusablePropsSchemas` 의 IconButton 스키마를 정리한다 (삭제는 사용자 승인 뒤 — 사용자 결정 1).
  7. **옛 문서**: `LIBRARY_CONTRACT_VERSION` 을 1 올린다 (구조 변경 계약 Step 3 — 구현 시 소스 상수에서 다음 값을 읽는다, 지금 42). 옛 contract 문서는 `UNSUPPORTED_LIBRARY_CONTRACT` (`document/validation.ts` 1505행) · `UNSUPPORTED_PROJECT_FORMAT` (`runtime/storage.ts` 177 · 374행) 로 열리기 전에 거부된다 — IconButton 정의 삭제가 `DANGLING_DEFINITION` 에 닿지 않는다. 변환 · dual-write 0. 개발용 프로젝트 (adr275-live · 「123」) 는 재생성.
  8. **icon-only Button**: `label: ""` (Text 없음) + `aria-label` (S2 ActionButton 의 접근성 규칙). Properties 가 Text 가 없고 `aria-label` 도 없으면 안내한다 (사용자 결정 2).
  9. **ToggleButton** 은 같은 `buttonChildHost` 라 같은 규칙 (origin template `ToggleButton > Icon{icon} + Text{label}` · 중첩 7 자리 `children` → `label` 이관) 을 적용한다.

> 구현 상세: [276-button-text-child-iconbutton-merge-breakdown.md](design/276-button-text-child-iconbutton-merge-breakdown.md)

### 사용자 결정 3건 (execute-adr 가 닿을 때 묻는다)

1. **IconButton 의 남김 방식** — (a) 팔레트에서 제거 (origin 정의도 삭제 — contract 증가로 옛 참조 문서는 열리기 전에 거부되므로 안전) / (b) 팔레트에 「Button (아이콘)」 preset 으로 남김 (같은 Button origin 에 `icon` 이 든 변형). 권고 (a).
2. **icon-only 의 표현** — `label` 비움 (Text 생략) + `aria-label` 안내로 충분한지, 아니면 「아이콘만」 토글 (Text 숨김 · label 보존) 을 둘지. 권고 전자.
3. **Icon 위치 기본값** — template 이 Icon 을 Text 앞에 고정한다 (S2 기본). 뒤 배치는 `icon` 비움 + Icon 노드를 소유 자식으로 (template 자식 뒤). 다른 기본값 (template 에 뒤 자리도 두기) 을 원하면 여기서.

(Round 1 전의 결정 3 「옛 문서 그대로 vs contract 거부」 는 선택지가 아니다 — Decision 7.)

## Risks

| ID  | 위험                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 중첩 Button 자리 34 가 template Icon · Text 를 받아 글자 없는 trigger 에 "Button" 이 나오거나, 글자 있는 자리의 문구 (Pagination `← 1 2 3 →` · trigger 문구) 가 사라지거나, 빈 Text 가 flex 자리 · gap 을 차지한다     |  MED   | breakdown §2b 자리별 표 (현재 `children` 값 = 쓸 `label`) → Phase 1 에서 자리마다 값 그대로 이관. G1 단위: 34 자리 전수 — 해석된 글자 = 이관 전 `children` 값 (글자 있는 17 은 같은 문구, 없는 8 은 Text 자식 0 `catalogAbsentByValue` · 폭 변화 0) — 원복 RED 둘 (label 미기재 → "Button" · 글자 자리에 `""` → 문구 소실) |
| R2  | 자체 `children` 을 읽던 코드 (`textOf` · `catalogTextKey` · AI write · clipboard · 원본 반영 · 데이터 바인딩 `{field}`) 가 Button 에서 글자를 못 찾거나, 루트 record 의 `label` 을 잡아 편집 상자를 Button 상자에 연다 |  MED   | G0 의 소비자 표 + Phase 2 단위 (RED 먼저): Button 의 글자 = instance `label` (IconButton 과 같은 읽기). 더블클릭은 Text 자식 자리 (ADR-254 경로 — TextField Label 과 같은 진입) — 루트 `catalogTextKey` 가 `label` 을 잡으면 Text 자식 우선 규칙                                                                           |
| R3  | contract 증가로 개발용 프로젝트 (adr275-live · 사용자 「123」) 가 열리지 않는다                                                                                                                                        |  MED   | 거부 메시지 (`UNSUPPORTED_PROJECT_FORMAT`) 를 G3 에서 확인 · 사용자에게 재생성 안내 (ADR-275 와 같은 절차). 변환 코드 0 (사용자 지시 2026-10-14)                                                                                                                                                                           |
| R4  | Properties 의 Content 섹션 (Label · Icon 칸) 과 인라인 편집 · 원본 반영 (ADR-262) · `{label}` 바인딩이 서로 다른 대상에 쓴다                                                                                           |  MED   | ADR-254 Decision 5 경로 (bound text → instance 의 `label` prop) 하나로 — 인라인 편집은 이미 `catalogTextBinding` 을 탄다 (2026-10-20 live 확인: TextField Label · InlineAlert Heading). Properties 도 같은 명령 (`setFields` instance props)                                                                               |
| R5  | 숨긴 template Icon (`icon` 없음) 이 레이아웃 자리 (gap) 를 남겨 아이콘 없는 Button 의 폭이 글자보다 넓다                                                                                                               |  LOW   | G2: 아이콘 없는 Button 폭 = Text 만의 폭 (Canvas · Preview `getBoundingClientRect`) — 남으면 숨긴 record 를 엔진 입력에서 빼는 규칙 확인 (`compositionRoot.ts` 2174행)                                                                                                                                                     |
| R6  | 노드 1 ~ 2 증가 · Button 수가 많은 문서의 해석 · 레이아웃 비용                                                                                                                                                         |  LOW   | ratchet (ADR-246) · 번들 상한 (ADR-201) 그대로 — pre-push                                                                                                                                                                                                                                                                  |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 실패 시 대안                                                  |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| G0   | Phase 0        | 호스트 · 소비자 인벤토리 표 (breakdown §2 · §3) — `origin-component-button` 중첩 27 · ToggleButton 7 (§2b 표 — 자리 · 현재 `children` 값 · 자기 Icon 자식 · 쓸 `label` = 같은 값) · `type-Button` 직접 root 9 의 변경 0 · 자체 `children` 읽기 지점 전수 (grep + 호출 경로) · 사용자 결정 1 ~ 3 기록                                                                                                                                                                                                                                                    | 표가 breakdown 추정 대비 1.5× 넘으면 사후 보고 (scope 그대로) |
| G1   | Phase 1 뒤     | 단위: 새 Button instance 의 해석 자식 = Icon (숨김) + Text · `label` 쓰기 1 step · `icon` 쓰기 / 제거 1 step · 글자를 바꾼 뒤 아이콘을 넣어도 글자 1개 (원복 RED — 옛 `setIcon` 으로 2개) · 중첩 34 자리 전수의 해석된 글자 = 이관 전 `children` 값 (Pagination `← 1 2 3 →` · Menu `Menu` · Tooltip `Hover me` … 보존, 글자 없는 8 은 Text 0 · 폭 변화 0) — 원복 RED 둘 (`label` 미기재 → "Button" · 글자 자리 `""` → 소실) · IconButton 과 Button origin 의 template 구조 동일 · Button 더블클릭 = Text 자식 상자 · Undo/Redo 로 `label` · `icon` 복귀 | 결함 수리 뒤 재실행 (phase 당 판독 1 + 수리 1)                |
| G2   | Phase 2 뒤     | Canvas = DOM: Button 폭 고정 + Layout 정렬 (start · center · end) 3 · 아이콘 있음 / 없음 (없음의 폭 = 글자 폭, R5) · 두 줄 라벨 · 중첩 호스트 (NumberField · Select) — `adr248Catalog*` parity 또는 `/cross-check` 사각형 0 px (DOM oracle = Preview `getBoundingClientRect`)                                                                                                                                                                                                                                                                           | 어느 쪽이 정본인지 조사 뒤 양쪽 정렬 (ssot-hierarchy §4-2)    |
| G3   | Phase 3 뒤     | live (Chrome MCP): 팔레트 Button 더블클릭 편집 · Properties Label · Icon 설정 → 「없음」 · 정렬 변경이 Canvas · Preview 에 같이 반영 · Enter 줄바꿈 · 옛 contract 프로젝트 열기 = `UNSUPPORTED_PROJECT_FORMAT` 거부 (plain Button 문서 · IconButton 문서 둘 다 — `DANGLING_DEFINITION` 아님) · 새 프로젝트의 NumberField · Select trigger 에 글자 0 · Pagination `← 1 2 3 →` · Menu · Popover · Tooltip trigger 문구 그대로 · 콘솔 0                                                                                                                    | 결함 수리 뒤 재실행                                           |
| G4   | 커밋 뒤        | pre-push ratchet (ADR-246) · initial 번들 (ADR-201 상한) · `pnpm codex:preflight`                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 상한 초과는 사용자 승인 + 만료일 (`--raise`)                  |
| G5   | Implemented 전 | 사용자 확인 — Button · ToggleButton · 옛 IconButton 자리의 모습 · 팔레트 · 재생성한 개발용 프로젝트                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 지적 수리 뒤 재확인                                           |

## Consequences

**Positive**

- Button 글자 · 아이콘 경로가 하나 (`label` · `icon` prop → template Text · Icon 자리) — 인라인 편집 · Properties · AI · clipboard · 원본 반영이 같은 prop 에 쓴다. 보고된 결함 3건의 원인 (모델 둘 · 기본값 있는 `icon` · 익명 글자 center 고정) 이 사라진다.
- Canvas 의 Button 글자 정렬 = Layout 정렬 = DOM (D3 대칭). `bindings.button` 의 center 고정 분기 · `withComposedText` 의 Button 호출이 없어진다.
- 팔레트에서 「Button」 과 「icon button」 이 하나가 된다 (S2 와 같다). 자식 노드를 만들고 옮기는 명령 3 과 Properties 의 Button 전용 칸이 없어진다.

**Negative**

- Button 당 template 자리 2 (Layers 에 Icon · Text 자식이 보인다 — IconButton · field 부품은 이미 그렇다).
- contract 증가 — 개발용 프로젝트 (adr275-live · 「123」) 를 다시 만든다.
- 중첩 자리 34 의 `children` → `label` 이관 (값 그대로, 한 번의 template 편집, Phase 1).
- 영향 파일: `reusableOriginLibrary.ts` (Button · ToggleButton template · 중첩 34 자리 · IconButton 정의) · `document/types.ts` (contract) · `catalogRuntime/buttonChildren.ts` (삭제) · `canvasBinding.ts` (`bindings.button` · `withComposedText`) · `CatalogButtonChildFields.tsx` (삭제) · `CatalogPropertiesPanel.components.tsx` · `reusablePropsSchemas.ts` · `componentCatalog.ts` (IconButton entry) · `paletteItems.ts` · 관련 테스트 12 (breakdown §4).
