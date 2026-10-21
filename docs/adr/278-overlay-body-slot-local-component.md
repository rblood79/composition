# ADR-278: 오버레이 본체 = slot — 기본 채움은 library, 커스터마이징은 Local 컴포넌트 instance (Framer Overlay 모델)

## Status

Accepted — 2026-10-21 (Proposed 같은 날)

> **Phase 2 · 3 종결 (2026-10-21, G2 · G3) — G5 사용자 확인 대기.** Phase 2 — display state `open` (`DisplayStateName` + patch 필드 `DescendantPatchFields.displayState`: 검증 `DISPLAY_STATE_UNKNOWN` · resolver 는 instance root 층 → patch → template 순 · patch 층 병합 `templateOwners.ts`) · `presence.ts:771` 닫힌 오버레이 분기가 `open` record 는 숨기지 않음 · Components page 는 오버레이 5 원본 (`OPEN_BODY_ORIGINS`) 의 샘플에만 root > Modal · Popover · Tooltip 자리 patch `open` 을 쓰고 (page instance · 캔버스는 닫힌 채) 샘플을 가로 「Body line」 frame 에 넣어 ◆ trigger 오른쪽에 본체 (결정 2) · `originItems` 는 깊이 무제한 (BFS) — 닫힌 오버레이 (picker Popover) 는 들어가지 않고, Item = 컬렉션 slot 안 또는 한 holder 가 2 번 이상 든 것 (trigger Button · Dialog Close · ContextualHelp footer Link 는 부품) → Menu 카드 Item 줄 = MenuItem 상태 5. 새 단위 2 (`adr278OverlayBodySlot` 10) · Library page 테스트 갱신 (오버레이 5 카드 본체 record hidden=false · geometry > 0 · trigger 오른쪽 · Select Popover 는 숨김 · Menu Item 줄 · Menu 샘플 상자 > Button). 원복 RED: presence 분기 3/18 · open patch 2/18 · resolver patch 층 3/18. Phase 3 — headed Chrome · 5173 · 새 프로젝트 「ADR278」 (contract 45): [Live Exercise](#live-exercise) 7/7. 발견 LOW deferred 2 (Fill slot 목록 74 항목이 뷰포트보다 길면 스크롤 불가 · slot 절의 Local instance 라벨이 루트 type `frame`) 는 같은 날 후속으로 닫음 — [Live Exercise](#live-exercise) 끝 문단. G4: type-check 6/6 · builder 전체 6137 통과 (실패 2 = `resolveContainerStylesFallback` · `slotIntrinsicHeight`, 둘 다 `e46011883` 에서도 실패) · shared `src/catalog` 실패 12 = IconButton 잔재.

> **Phase 1 종결 (2026-10-21, G1)** — 사용자 결정 4건 모두 권고안 (Tooltip `content` · 본체 칸은 Origin 줄 ◆ 오른쪽 · ContextualHelp `content` + `footer` · Menu `Items`). library: Dialog `content` · `actions`, Popover · Tooltip 은 OverlayArrow 뒤 region frame (`__content-region`, flex column — Popover 는 rowGap 12px 로 overlay 의 gap 유지) 에 `content`, ContextualHelp `content` · `footer`, Menu `Items` — contract 45. `slots.ts` `items` 분기가 project 정의를 후보에 넣고 기존 `assertNestable` 이 루트 type 으로 거른다 (h2). 새 단위 `adr278OverlayBodySlot` 8 (선언 · 44 거부 · 놓은 instance 의 기본 내용 소유 · Dialog 채움 → record · Preview Modal · Layers · 저장 재열기 · Popover 채움 → Preview · Swap 이동 · Dialog 채움 목록 · Menu `Items` Local 후보). 원복 RED: library 선언 되돌림 5/8 · `slots.ts` 되돌림 1/8. 정해진 차이 갱신: `adr255OverlayTrigger` (overlay 자식 = arrow + frame) · `adr256OverlayArrow` (레퍼런스 구조에 region div) · `adr254ContainerParts` (Popover · Tooltip 부품 경로 `/1/1/N` · Dialog description 이 소유 노드라 DOM id 를 가짐). contract 리터럴 44 → 45 (테스트 fixture 33 파일). type-check 6/6 · builder catalogRuntime 2372 중 제외 목록 밖 실패 0 · shared `src/catalog` 실패 12 = IconButton 잔재 (HEAD 와 같음). Compare Mode 는 Phase 3 live 에서.

> **Phase 0 종결 (2026-10-21, G0)** — 사용자 `/execute-adr 278` · 리뷰 Round 1 pending 0 · HIGH 2 fixed → Accepted. 인벤토리 + RED 3: (a) 오버레이 안 slot 채움은 Canvas record · Preview Modal · Layers · 채움 목록에 전부 닿는다 (GREEN 3/3 — 수리 행 0, 발견: 놓는 순간 기본 내용이 소유 노드) · h2 Menu `Items` Local 후보 없음 (RED 1/1 → Phase 1) · (b) 숨김을 끈 Library page 샘플에서 Modal 448×162 · Popover 240×46 · Tooltip · ContextualHelp · Menu 전부 geometry 있음 (GREEN → Decision 4 기본안, 「내용만」 불필요). 상세: [breakdown §Phase 0 결과](design/278-overlay-body-slot-breakdown.md#phase-0-결과-2026-10-21-execute-adr-278).

- 사용자 요청: `/create-adr` (2026-10-21) — 같은 날 Library page 감사 (Framer component 체계 deep research 뒤 사용자 지적 「각 컴포넌트에 맞지 않는 불필요한 요소 · 잘못된 구성」) 의 방향 3. 방향 1 · 4 · 5 는 같은 날 수리 완료 (`acb3dd68b` · `35417aa8c`).
- 방향을 정한 사용자 원문 (2026-10-21):
  - 「빌더 canvas 는 overlay 를 동작하는 것은 아니기에 components-library 기본 컴퍼넌트를 사용하던가 local 에 커스터마이징한 오버레이 화면을 디자인해 둬야 하는 것 아닌가」
  - 「Pages 에 추가한 page 를 오버레이 본체 = slot 으로 하게 하거나 Components 에 기본 컴퍼넌트나 local 에 커스터마이징한 컴퍼넌트를 slot 으로 사용하거나 어차피 동일한 내용인 듯하지만 결국 니가 제안한 "방향 3 의 재정의" 와 유사한 건가」 → 실행자 답 「같은 모델 — slot 에 무엇을 넣느냐만 다르다. Page 를 slot 내용으로는 권하지 않는다 (page = URL · 무거움 · context 끊김)」. 사용자가 이 답을 받고 `/create-adr` 를 호출했다 — Page 방식 기각은 본문 대안 C 에 기록.
- 사용자가 이미 답한 확인 항목: 참조 모델은 pen.dev · Figma · **Framer** 셋이고 선택 기준은 「가장 사용자가 편리한 것」 (2026-10-21, 메모리 `project-origin-instance-slot-reference-pen-figma`) · 놓은 instance 의 slot 내용은 instance 의 것 (2026-10-14) · 기본 원본은 루트만 편집 (2026-10-05) · Components 탭 = Library · Local page (ADR-260).
- 선행 ADR 과의 관계 (fork 4 질문 — [breakdown §0](design/278-overlay-body-slot-breakdown.md)): [ADR-255](completed/255-overlay-origins-with-trigger.md) (오버레이 원본 = trigger + 본체 한 트리) 가 base 다 — 트리 구조는 그대로 두고 본체에 slot 을 선언한다. ADR-255 Decision 5 「범위 밖: 닫힌 overlay 를 Canvas 에서 편집하는 방법 (Layers 선택으로 한다)」 이 이 ADR 의 범위다. [ADR-261](completed/261-component-api-swap-slot-suggestions-properties.md) 의 slot 채움 · 추천 · [ADR-260](completed/260-component-origin-in-place.md) 의 page 원본은 그대로 쓴다.
- 리뷰 Round 1 (codex, 2026-10-21 — [reviews/278](reviews/278.md)) HIGH 2 → 같은 날 수리: h1 contract 45 는 44 문서를 거부한다 (옛 문서 무변경 로드 약속 삭제 — Decision 2 · R6 · G1) · h2 Menu `Items` 같은 컬렉션 slot 의 채움 목록은 Library 정의만 열거해 Local 컴포넌트를 고를 수 없다 (Phase 1 구현 항목 추가 — Decision 3 · R7 · G1 · G3). 비차단 정정 2 — Framer 는 Components 안 Relative Overlay 편집 모드가 있다 (「Framer 도 하지 않음」 삭제) · 튜토리얼 URL 404 삭제.

## Context

### 도메인

- **문서 모델 (library template 의 slot 선언) + Builder Components page (Library 카드) + Design 패널 slot 절**. D1 · D2 · D3 무변경 — RAC 트리 (DialogTrigger > Button + Modal > Dialog, MenuTrigger > Button + Popover > Menu, TooltipTrigger > Button + Tooltip) 는 ADR-255 · 256 그대로이고, 본체 안의 **어느 노드가 slot 인가** 만 선언한다. slot 은 이미 있는 schema (`LibraryTemplateNode.slot` · `NodeEntry.slot` — `packages/shared/src/catalog/document/types.ts:784-787` · `:997`) 다.
- 참조 모델 (2026-10-21 deep research, 메모리 `reference-framer-components-model-2026-10`):
  - **Framer**: 오버레이 본체는 캔버스에서 디자인한 Component 이고, trigger 는 Overlay (Relative · Fixed) 로 그것을 가리킨다 (`framer.com/updates/relative-overlays` 2023-10-19 — Components 안에서 Relative Overlay 를 편집하는 모드가 있다). 전용 Modal · Tooltip · Dropdown 컴포넌트는 없다 — Menu 템플릿을 레이어에 drop 하면 Relative Overlay 가 된다.
  - **pen.dev**: component origin 안의 빈 frame 만 「Make slot」 (`docs.pencil.dev/core-concepts/slots`) — 추천 slot component 는 안내.
  - **Figma**: prototype 「Open overlay」 — 프레임 (화면) 을 오버레이로 연다.

### 현재 (실측 2026-10-21, main `35417aa8c`)

1. **Canvas 는 오버레이 본체를 그리지 않는다**: `packages/shared/src/catalog/runtime/presence.ts:70-96` `TRIGGER_OVERLAY_CHILDREN` — DialogTrigger 의 Dialog · Modal · Popover, TooltipTrigger 의 Tooltip, ContextualHelp · MenuTrigger · SubmenuTrigger · Select · ComboBox · DatePicker · DateRangePicker 의 Popover 를 「닫힌 오버레이」 로 숨긴다 (`:771-773`). `isOpen` 은 Canvas 에서 항상 false (`:3039-3040`, 「an overlay is never open」). Autocomplete 의 ListBox 만 예외로 보인다 (`:84` — Menu 노드는 어디 서든 열린 목록).
2. **본체는 slot 이 아니다**: library template 의 slot 선언 (`reusableOriginLibrary.ts`) 은 컬렉션 · 그룹 · Form · Card 에만 있다 (ListBox `Items` · Tabs `Tabs` · `Panels` · Toolbar `Actions` · Card `Preview` · `Content` · `Footer` …). 오버레이 5종의 본체 — Dialog (`component-dialog__2` > `__2_1` heading[slot=title] · `__content-region` frame > description · `__2_3` DialogFooter > `__actions-region` frame (비어 있음) + Close 버튼), Popover (`component-popover__overlay` > OverlayArrow · heading · description), Tooltip (`component-tooltip__overlay` > OverlayArrow · description), ContextualHelp (`__overlay` > title · Content · Footer), Menu (`component-menu__popover` > `__menu` > item ×3) — 에는 slot 이 0 이다. `content-region` · `actions-region` 은 slot 선언 없는 `type-frame` 이다.
3. **그래서 지금은 둘 다 안 된다**: 「library 기본 그대로」 도 본체를 볼 수 없고 (Library page 카드 34 · 68 · 69 · 70 · 71 은 trigger 버튼만 — 2026-10-21 live), 「Local 커스터마이징」 은 넣을 자리가 없다. 본체 편집은 Layers 에서 숨은 노드를 골라 Design 패널로 더듬는 것뿐이고 결과는 Preview 에서만 보인다 (ADR-255 Decision 5 가 범위 밖으로 남긴 상태).
4. **slot 기계는 다 있다**: 선언 (`slot: {name, required, suggested?}`) · instance 의 `fillSlot` (`types.ts:488`, 내용 = instance 소유 노드 — 2026-10-14) · resolver 투영 (`resolution/resolver.ts:2060-2085`, 안쪽 owner 의 slot 도 template 자리로 투영) · Design 패널 slot 절 (`apps/builder/src/builder/panels/properties/catalog/CatalogSlotSection.tsx` — 채움 · 제거 · 원본 내용 복원 · 추천 맨 위) · 교체 때 같은 slot name 으로 옮김 (ADR-261 Decision 2). 어느 것도 「slot 이 오버레이 안에 있으면 안 된다」 는 조건이 없다 — 다만 오버레이 안 slot 을 **실제로 투영 · DOM 렌더 · Layers 열거** 하는지는 Phase 0 이 확인한다 (실행 근거 없음).
5. **Components page**: 2026-10-21 수리로 Item 줄은 「declared slot 안에 있거나 두 번 이상 보유한 상태 원본」 (`componentsPage.ts` `originItems`, 루트 자식 + 손자까지만 봄). Menu 의 MenuItem 은 루트 > Popover > Menu > item 으로 증손이라 Item 줄이 없다. 원본 샘플의 slot 은 내용을 `opacity: 0` 으로 두고 빗금 (`catalogSlotMarks`), root slot 의 반복 항목은 첫 것만.
6. **Page**: 라우트다 (publish 가 page 마다 URL) · breakpoint · layout template · body instance 를 갖는다 · instance 는 trigger 가 선 page 의 context (Form `formContext.ts` · 데이터 바인딩 · 상태 소유자 `showWhen`) 를 받지만 다른 page 는 받지 못한다.

### 제약

- **D1**: 본체의 RAC 트리를 바꾸지 않는다 (Modal > Dialog · Popover > OverlayArrow …). slot holder 가 없는 본체 (Popover · Tooltip) 에 frame 을 하나 넣으면 DOM 에 div 가 하나 생긴다 — 생성 CSS · Preview parity 로 잰다 (G1).
- **slot 내용 = instance 소유** (2026-10-14): trigger instance 의 `fillSlot.childIds` 가 본체 내용이다. 원본에 반영 (ADR-262) 은 slot 내용을 반영하지 않는다 (사용자 결정 2) — 그대로.
- **기본 원본은 루트만 편집** (2026-10-05): library 오버레이 원본의 본체 글자 · 구조는 Library page 에서 고치지 못한다 — 바꾸려면 Local 컴포넌트를 slot 에 넣는다. 이것이 「library 기본 그대로 / Local 커스터마이징」 두 길의 경계다.
- **Canvas 는 오버레이를 열지 않는다** (composition 의 범위 결정 — Framer 는 Components 안 Relative Overlay 편집 모드가 있지만 page 캔버스의 trigger 옆에 본체를 펼치지는 않는다): page 캔버스에서 본체는 닫힌 채다. 본체 디자인은 Local 컴포넌트의 ORIGIN (page 에 선다 — ADR-260) 에서 한다. Library page 카드만 본체를 펼쳐 보인다.
- 번들 상한 (ADR-201 §재승인) · pre-push ratchet (ADR-246) 안.

### 생성기 질문 (반복 패턴 #2)

slot 선언은 library template 의 데이터다 — 생성기 없음 (`reusableOriginLibrary.ts` 직접 편집, ADR-276 · 277 과 같음). 새 region frame 의 CSS 는 catalog rule 에서 생성 (`generate-css.ts`) — frame 은 archetype 중립 상자라 추가 CSS 0.

## Alternatives Considered

### 대안 A: 본체 = slot (trigger 원본 안) — 기본 채움은 template 내용, 커스터마이징은 Local 컴포넌트 instance 를 slot 에

- 설명:
  - 오버레이 5종의 본체에 slot 을 선언한다. slot holder = 있는 region frame (Dialog `content-region` → `content`, `actions-region` → `actions` · ContextualHelp `Content` → `content`, `Footer` → `footer`), 없으면 새 region frame 하나 (Popover · Tooltip 의 `content`) · Menu 는 `component-menu__menu` 자신 (`Items`, ListBox 와 같음). OverlayArrow · Dialog title heading · Close 버튼은 slot 밖 (RAC 부품).
  - 기본 채움 = 지금 template 내용 (heading · description · item ×3) — 바꾸지 않으면 「library 기본 그대로」.
  - 커스터마이징 = 사용자가 어느 page 에서든 본체를 그리고 Create component (ADR-279: 원본은 Local page 카드로, 그 자리에는 instance) → trigger instance 의 slot 에 그 instance 를 넣는다 (Design 패널 slot 절 · 추천 · drag — ADR-261 그대로). Preview 는 RAC 가 Modal · Popover 안에 그 내용을 띄운다.
  - Library page 카드: ◆ trigger 옆에 **본체를 펼친 칸** (Components page 전용 — 샘플 instance 의 오버레이 자식을 presence 가 숨기지 않는 display 상태). page 캔버스는 닫힌 채.
  - Components page Item 줄: slot 안 항목은 깊이에 관계없이 찾는다 → Menu 카드에 MenuItem 상태 줄.
- 위험: 기술 **MEDIUM** / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.
  - 기술 MEDIUM: (a) 오버레이 안 slot 의 투영 · DOM · Layers 가 실제로 되는지 실행 근거가 없다 (현재 4) — Phase 0 이 RED 로 확정. (b) Library page 에서 Popover · Modal · Tooltip 을 Canvas 가 그려야 한다 — Skia 가 이 type 들을 어떻게 그리는지 (binding · rule) Phase 0 이 확인. 못 그리면 본체 칸은 본체 내용 (slot 의 기본 채움) 만 그린다.
  - 마이그레이션 LOW: contract 44 문서는 45 빌드가 거부한다 (`storage.ts:369-374` `UNSUPPORTED_PROJECT_FORMAT` · `validation.ts:1505` `UNSUPPORTED_LIBRARY_CONTRACT` — 구조 변경 계약 Step 3, ADR-276 · 277 과 같은 정책: 개발용 프로젝트 재생성, 변환 코드 0). 「옛 문서 무변경 로드」 는 약속하지 않는다 (리뷰 h1). 45 로 새로 만든 오버레이 instance 는 `fillSlot` 이 없으니 template 기본 내용이다.

### 대안 B: 본체 = 별도 「오버레이 컴포넌트」 — trigger 가 정의 id 로 가리킨다 (Framer Overlay 그대로)

- 설명: trigger 노드에 `overlay: DefinitionId` 참조 필드. 본체는 독립 컴포넌트 (Local 또는 library). Preview 가 참조를 Modal · Popover 로 감싸 띄운다.
- 위험: 기술 **HIGH** / 성능 LOW / 유지보수 **HIGH** / 마이그레이션 MEDIUM.
  - 기술 HIGH: RAC 트리 (D1) 가 문서에 없고 렌더 시점에 조립된다 — Canvas · Preview · publish 가 같은 조립을 각자 해야 한다 (ADR-255 가 Preview 미표시 때문에 트리를 문서에 넣은 이유와 정반대).
  - 유지보수 HIGH: 참조 종류가 하나 늘어 그래프 검증 (`DANGLING_DEFINITION`) · clipboard · 교체 · 삭제 정리 전부에 새 가지.

### 대안 C: Pages 의 page 를 오버레이 본체로 (Figma prototype 「Open overlay」)

- 설명: trigger 가 page 를 가리키고 Preview 가 그 page 의 body 를 Modal 에 띄운다.
- 위험: 기술 **HIGH** / 성능 MEDIUM / 유지보수 **HIGH** / 마이그레이션 MEDIUM.
  - 기술 HIGH: page = URL — 오버레이 page 가 publish 되어 주소를 갖는다 → 「라우트 아닌 page」 종류가 필요. Tooltip 한 줄 · Menu 항목 3개에 breakpoint · layout template · body instance 가 따라온다.
  - 유지보수 HIGH: 본체가 trigger page 의 context (Form · 데이터 · 상태) 를 받지 못한다 — Dialog 의 Save 가 바깥 Form 을 제출하는 연결이 끊긴다.
  - 사용자가 2026-10-21 고려했고 실행자 설명 뒤 `/create-adr` 로 넘어왔다 (Status).

### 대안 D: slot 없이 Library page 만 본체를 펼쳐 보인다

- 설명: 대안 A 의 「Library page 본체 칸」 만. 커스터마이징은 지금처럼 Layers 로.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.
- 문제: 「local 에 커스터마이징한 오버레이 화면을 디자인해 둔다」 를 채우지 못한다. 본체 편집은 여전히 숨은 노드 더듬기.

### Risk Threshold Check

| 대안 | HIGH+                     | 판정                                                                                                                          |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A    | 없음 (기술 MEDIUM)        | **채택** — slot 기계 재사용 · D1 무변경, 미확인 두 가지 (오버레이 안 slot 투영 · Canvas 의 오버레이 그리기) 는 Phase 0 RED 로 |
| B    | 기술 HIGH · 유지보수 HIGH | 기각                                                                                                                          |
| C    | 기술 HIGH · 유지보수 HIGH | 기각 (사용자 질문 → 설명 뒤 A 로)                                                                                             |
| D    | 없음 (요구 미충족)        | 기각                                                                                                                          |

루프 0회: A 에 HIGH 가 없다.

## Decision

**대안 A 채택.**

1. **slot 선언** (library template, `LIBRARY_CONTRACT_VERSION` 45):

   | 원본           | slot holder                                             | slot 이름             | 기본 채움 (지금 내용)     | slot 밖 (RAC 부품)                    |
   | -------------- | ------------------------------------------------------- | --------------------- | ------------------------- | ------------------------------------- |
   | Dialog         | `component-dialog__content-region` · `__actions-region` | `content` · `actions` | description · (비어 있음) | title heading · DialogFooter 의 Close |
   | Popover        | 새 region frame (OverlayArrow 뒤)                       | `content`             | heading · description     | OverlayArrow                          |
   | Tooltip        | 새 region frame (OverlayArrow 뒤)                       | `content`             | description               | OverlayArrow                          |
   | ContextualHelp | `__content` (Content) · `__footer` (Footer)             | `content` · `footer`  | Text · Link               | title heading                         |
   | Menu           | `component-menu__menu` 자신                             | `Items`               | item ×3                   | Popover · trigger                     |
   - slot 은 `required: false`. 추천 (`suggested`) 은 없음 — 사용자 컴포넌트 전용이라 (2026-10-14) library 원본에는 두지 않는다.
   - picker 류 (Select · ComboBox · DatePicker · DateRangePicker) 의 Popover 는 범위 밖 — 본체가 ListBox · Calendar 부품이라 교체 대상이 아니다.

2. **기본 채움 그대로 = library 기본**: `fillSlot` 이 없는 instance 는 template 내용 (heading · description · item …) 을 그린다 — 추가 작업 0. **옛 문서는 호환하지 않는다** (리뷰 h1): contract 44 로 저장된 프로젝트는 45 빌드가 로드 · 검증에서 거부하고 (`storage.ts:369` · `validation.ts:1505`) 재생성한다 — ADR-276 · 277 과 같은 정책, 변환 코드 0 (2026-10-14 「마이그레이션 코드 금지」). 저장 · 재열기 보존은 45 로 만든 문서의 새 `fillSlot` 에 대해 잰다.
3. **커스터마이징 = Local 컴포넌트 instance 를 slot 에**. 새 UI 없음 — 다만 **컬렉션 slot 의 채움 목록이 Local 후보를 열거하도록 한 곳을 고친다** (리뷰 h2): `apps/builder/src/builder/catalogRuntime/slots.ts:291-303` `catalogSlotInsertOptions` 의 `items` 분기는 `catalogPaletteDefinitionId` 로 Library 항목 type 만 후보로 만들고 project 정의 순회 (`:335-353`) 는 free-content 분기에만 있다 — Menu `Items` (와 ListBox · GridList · TagGroup `Items`) 에 MenuItem 루트 Local 컴포넌트를 넣을 길이 Design 패널에 없다 (ADR-261 Phase 3 LOW deferred 「항목만 받는 slot 의 project 추천 미노출」 이 이 ADR 에서는 핵심 흐름이라 구현 항목으로 올린다). 수리 = `items` 분기에도 project 정의 (`usage !== "layout"` · 자기 정의 제외) 를 후보로 넣고, 기존 `allowed` 필터 (`assertNestable` — `definitionTypeName` 이 Local 정의의 루트 type 을 읽는다, `commands/context.ts:211-240`) 가 MenuItem 루트만 남긴다 (frame · Button 루트는 `NESTING_NOT_ALLOWED` 로 제외). 자유 내용 slot (Dialog `content`) 은 지금 분기가 이미 Local 을 열거한다. 그 밖은 Design 패널 slot 절 · Layers drop · drag · paste 가 ADR-261 Decision 1 의 EditTarget 규칙으로 `fillSlot` 에 쓴다. 교체 (`swapInstance`) 는 같은 slot name 으로 옮긴다. Create component 흐름은 ADR-279 Decision 9 — 본체 원본은 Local page 카드로 가고 그 자리의 instance 를 slot 으로 옮긴다 (또는 slot 안에서 직접 그린 노드에 Create component → slot 안이 바로 instance).
4. **Library page 카드의 본체 칸**: ◆ trigger 칸 옆에 본체 (Popover · Modal > Dialog · Tooltip · Menu) 를 펼쳐 그린 칸. 구현은 Components page 전용 — 카드 샘플의 오버레이 자식에 대해서만 `presence.ts` 의 「닫힌 오버레이」 숨김을 끄는 display 상태 (`displayState: "open"` 또는 같은 뜻의 patch). page 캔버스 · 다른 instance 는 닫힌 채 (Framer). Canvas 가 Popover · Modal 상자 자체를 못 그리면 본체 **내용** (slot holder 아래) 만 그린다 — Phase 0 판정.
5. **Components page Item 줄**: slot 안 항목은 깊이 제한 없이 (slot holder 를 template 전체에서 찾는다) → Menu 카드 = MenuItem 상태 5.
6. 범위 밖: page 캔버스에서 선택 시 본체 펼침 (composition 의 범위 결정 — 필요하면 별도 ADR) · SubmenuTrigger · picker Popover · 오버레이 열림 interaction (Preview 실행 값, ADR-250 과 같은 선).

**위험 수용 근거**: 기술 MEDIUM 둘 다 Phase 0 에서 RED 로 확정된다 — (a) 오버레이 안 slot 을 채운 instance 가 Preview DOM 에 그 내용을 띄우는지 (parity), (b) Library page 샘플에서 Popover · Modal 이 그려지는지. (a) 가 안 되면 resolver · DOM 렌더러의 slot 경로 결함이고 이 ADR 안에서 수리한다 (slot 기계의 버그). (b) 가 안 되면 Decision 4 의 「내용만」 으로 낮춘다 — 사용자가 본체 디자인을 보는 목적은 채워진다.

**기각 사유**: B — D1 트리를 문서 밖으로 내보내 ADR-255 를 되돌린다. C — page 는 URL 이고 무겁고 context 가 끊긴다 (사용자 질문에 답한 세 가지). D — 커스터마이징 요구를 채우지 못한다.

### 사용자 결정 (execute 때 그 Phase 에서 묻는다)

1. Tooltip 본체도 slot 인가 — (기본안) 예 (`content`, RAC Tooltip 은 임의 자식을 받는다) / 아니오 (글자 한 줄이라 `{children}` prop 만).
2. Library page 본체 칸의 위치 — (기본안) Origin 줄에서 ◆ trigger 오른쪽 (◇ instance 칸 자리) / 별도 「Body」 줄.
3. ContextualHelp 의 Footer (Link) 도 slot 인가 — (기본안) 예 (`footer`) / 아니오 (`content` 만).
4. Menu 의 slot 이름 — (기본안) `Items` (ListBox · GridList 와 같음) / `content`.

> 구현 상세: [278-overlay-body-slot-breakdown.md](design/278-overlay-body-slot-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                 | 심각도 | 대응                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 오버레이 안 slot 을 채운 내용이 Preview DOM 에 안 뜨거나 Layers 에 안 보인다 (resolver `:2060-2085` · DOM 렌더러 · `layerTree.ts` 의 slot 경로가 숨은 자식을 거른다) |  MED   | Phase 0 RED (채운 instance 의 DOM · Layers 행) → 결함이면 이 ADR 에서 수리 (G0 · G1)                                                                                |
| R2  | 새 region frame (Popover · Tooltip) 이 DOM 에 div 를 더해 생성 CSS · 레퍼런스 구조 비교 (G5 류) 가 갈린다                                                            |  MED   | frame 은 중립 상자 (ADR-223) · Compare Mode parity · 구조 비교 테스트의 「정해진 차이」 목록 갱신 (G1)                                                              |
| R3  | Library page 샘플에서 Canvas 가 Popover · Modal · Tooltip 상자를 못 그린다 (binding · rule 없음)                                                                     |  MED   | Phase 0 판정 → Decision 4 의 「내용만」 (G2)                                                                                                                        |
| R4  | 본체를 펼친 카드가 높아져 Library page 열 균형 · 카드 weight 가 틀어진다                                                                                             |  LOW   | `weight` 에 본체 높이 반영 · live 로 확인 (G2)                                                                                                                      |
| R5  | `originItems` 가 깊이 제한 없이 slot 을 찾으면 다른 카드의 Item 줄이 바뀐다 (Select 의 Popover > ListBox `Items` 가 잡힘)                                            |  MED   | picker 류는 `TRIGGER_OVERLAY_CHILDREN` 의 닫힌 오버레이 안 slot 을 제외 (Menu 만 Decision 4 의 open 상태로 포함) · 2026-10-21 테스트의 7 카드 단언 유지 (G2)        |
| R6  | contract 44 문서가 45 빌드에서 열리지 않는다 (`storage.ts:369` · `validation.ts:1505`)                                                                               |  LOW   | 정책대로 거부 · 재생성 (구조 변경 계약 Step 3 — ADR-276 · 277 선례) · 변환 코드 0 · G1 은 「44 거부 + 45 새 fill 보존」 을 잰다 (리뷰 h1)                           |
| R7  | 컬렉션 slot (Menu `Items`) 의 Fill 목록이 Library 항목만 열거해 Local 컴포넌트를 고를 수 없다 (`slots.ts:291-303`)                                                   |  MED   | Phase 1 에서 `items` 분기에 project 정의 후보 추가 · `assertNestable` 로 루트 type 거름 · G1 unit (MenuItem 루트 노출 · frame 루트 제외) · G3 picker 조작 (리뷰 h2) |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                                                |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G0   | Phase 0  | 인벤토리: 오버레이 5 원본의 본체 노드 · DOM 렌더러 (`CatalogDialogTrigger` 류) · Canvas binding · rule · presence 분기 · Layers 열거 경로 전수 + RED 2: (a) Dialog instance 의 `fillSlot(content)` 에 Text 를 넣고 Preview DOM 에 그 Text 가 Modal 안에 있는지 · Layers 에 행이 있는지, (b) Components page 샘플의 Popover 자식이 그려지는지 (`canvasInputs`)                                                                                                                                                                            | (a) RED 면 결함 수리를 Phase 1 에 넣는다 · (b) RED 면 Decision 4 「내용만」 |
| G1   | Phase 1  | slot 선언 5 원본 (contract 45) · 44 문서 거부 (`UNSUPPORTED_PROJECT_FORMAT` · `UNSUPPORTED_LIBRARY_CONTRACT` 단위) · 45 새 문서의 미채움 instance = template 기본 내용 · 새 `fillSlot` 저장 → 재열기 보존 · Menu `Items` Fill 목록에 MenuItem 루트 Local 컴포넌트 노출 · frame · Button 루트 제외 (unit — 선택 → `catalogSlotCommands.fill` → resolved record) · Compare Mode parity: 채운 instance (Local 컴포넌트) 의 본체가 Preview 의 Modal · Popover · Tooltip · Menu 안에 그대로 · 교체 때 `content` 이동 · 원복 RED 전량 (원본별) | 결함 수리 후 재측정                                                         |
| G2   | Phase 2  | Library page: 카드 34 · 68 · 69 · 70 · 71 에 본체 칸 · Menu 카드 Item 줄 = MenuItem 상태 · 2026-10-21 「Library page」 테스트의 7 카드 Item 단언 유지 (picker 제외) · 열 균형 · `catalogSlotMarks` 가 본체 slot 을 빗금                                                                                                                                                                                                                                                                                                                  | 본체 칸을 「내용만」 으로                                                   |
| G3   | Phase 3  | live (headed Chrome · TEST 프로젝트): page 에서 Dialog 본체 그리기 → Create component → Dialog instance 의 Layers 에서 Modal > Dialog > content 를 골라 (DialogTrigger 루트 선택은 안 slot 을 열거하지 않는다 — `slots.ts:76-98`) Design 패널 slot 절에서 그 컴포넌트 넣기 → Preview 에서 Open Dialog 가 그 본체를 띄움 · Reset (원본 내용 복원) · Menu `Items` 의 Fill 목록에서 MenuItem 루트 Local 컴포넌트 선택 → Preview 메뉴 · Layers 에서 slot 내용 선택                                                                           | 수리 후 재실행                                                              |
| G4   | 각 Phase | type-check · shared · builder 스위트 (기존 제외 목록: `resolveContainerStylesFallback` · IconButton 잔재 11) · pre-push ratchet 등급 A · 번들 상한 안                                                                                                                                                                                                                                                                                                                                                                                    | 원인 수리                                                                   |
| G5   | 종료     | 사용자 Builder 확인 (Implemented 조건)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                                                             |

### Live Exercise

2026-10-21, headed Chrome (Claude in Chrome MCP) · dev 5173 · 새 프로젝트 「ADR278」 (contract 45 — 옛 프로젝트는 dashboard 에 보이지 않음, 정책대로). 시드는 dev handle `window.__COMPOSITION_CATALOG__` 의 `workspace.execute` (Dialog · Menu 놓기, frame Heading + Text → Create component 「Confirm body」, Menu 소유 항목 → Create component 「Menu row」), 조작은 Builder UI.

| #   | 단계                                                                                      | 결과                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Layers: DialogTrigger > Modal > Dialog > `content` (slot 배지) 선택 → Design 패널 slot 절 | PASS — `content` 절에 Description 항목 · Fill slot · Restore template content                                                                                                                                                        |
| 2   | Fill slot 목록에서 「Confirm body」 선택                                                  | PASS — 문서 `fillSlot(content)` = [Description, Confirm body instance] · slot 절 항목 2                                                                                                                                              |
| 3   | Preview (publish 탭) Open Dialog                                                          | PASS — `.react-aria-Modal` 안 Dialog: Heading 「Dialog Title」 · region div [Description 「Dialog content goes here.」 + Confirm body 「Delete 3 files?」 …] · Close                                                                 |
| 4   | Restore template content                                                                  | PASS — override 0 · Layers `content` 아래 Description (template)                                                                                                                                                                     |
| 5   | Menu `Items` slot 행 선택 → Fill slot 목록                                                | PASS — MenuItem · SubmenuTrigger · MenuSection · Section · Separator · Header · **Menu row** (frame 루트 「Confirm body」 없음) → 선택 → 문서 4 항목 → Preview 메뉴 4 항목                                                           |
| 6   | Layers 에서 slot 내용 (Confirm body instance) 행 선택                                     | PASS — 선택 target = 그 노드 · Design 패널 Component 「Confirm body · INSTANCE」 · 캔버스는 닫힌 채                                                                                                                                  |
| 7   | Library page 카드 61 Dialog · 62 Popover · 64 Tooltip · 63 ContextualHelp · 20 Menu       | PASS — ◆ trigger 오른쪽에 본체 (Modal > Dialog 제목 · 빗금 content · 빗금 actions · Close / Popover 상자 + 빗금 / Tooltip 빗금 / Need help? + 빗금 2 / Popover + 빗금 항목) · 인스턴스 칸은 닫힌 채 · Menu Item 줄 = MenuItem 상태 5 |

설계 대비 점검 (2026-10-21, 사용자 질문 「설계대로 다 구현됐나」): Decision 1 의 Tooltip `content` 와 컬렉션 slot 의 Local 후보 (ListBox `Items` — root slot) 는 단위가 없었다 → `adr278OverlayBodySlot` +2 (Tooltip 채움 → Preview 의 열린 Tooltip region · ListBox `Items` 목록에 ListBoxItem 루트 「List row」, frame 루트 제외) = 12. G1 의 Compare Mode parity 는 닫힌 오버레이 안 region div 가 Canvas 에는 그려지지 않고 Preview 의 열린 RAC Popover · Tooltip 안에만 있어 비교 대상이 없다 — Preview DOM 단위 (Popover · Tooltip) 가 그 자리를 잰다. G4 의 pre-push ratchet · 번들은 push 때 자동 (ADR-278 은 새 모듈 0).

LOW deferred 2 는 같은 날 후속으로 닫음 (사용자 요청 2026-10-21): slot 절의 Fill slot · Add content 가 평평한 panel Select 대신 Swap 과 같은 검색형 picker (`CatalogComponentPicker` — 추천 · Local · Library 묶음, 목록 자체가 `max-height: 320px` + `overflow: auto`) 를 쓰고, 채움 목록의 Local instance 행은 정의 이름 (「Confirm body」) 으로 보인다. live: Popover `content` 에서 picker 열기 → Local 2 · Library 72 묶음 · 휠 scrollTop 500 · 「Tex」 검색 4 · Text 선택 → 행 추가 → 행 제거. 정리: 프로젝트 「ADR278」 은 G5 확인용으로 남김.

## Consequences

### Positive

- 오버레이 본체가 「library 기본 그대로」 와 「Local 컴포넌트로 교체」 두 길을 갖는다 — Framer 의 Overlay 모델과 같은 작업 흐름을 기존 slot 기계만으로.
- Library page 카드 5 가 본체를 보여 준다. Menu 카드가 MenuItem 상태를 보인다.
- 본체 디자인이 page 캔버스 (instance) 와 Local page 카드 (원본 — ADR-279) 에서 되고 Preview 가 RAC 로 띄운다 — Canvas 가 오버레이를 여는 기능을 만들지 않는다.

### Negative

- Popover · Tooltip 본체에 region frame 이 하나 생긴다 (DOM div 1) — Dialog 의 `content-region` 과 같은 모양이라 새 패턴은 아니다.
- Library page 카드 5 의 높이가 늘어난다.
- 본체를 바꾸려면 Local 컴포넌트를 거쳐야 한다 — library 원본 본체 글자를 바로 고치는 길은 「루트만 편집」 원칙대로 없다.
- contract 44 개발용 프로젝트는 재생성한다 (ADR-276 · 277 과 같은 비용 — 변환 코드 0).
