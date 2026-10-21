# ADR-278 design breakdown — 오버레이 본체 = slot

> 본문: [../278-overlay-body-slot-local-component.md](../278-overlay-body-slot-local-component.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: [ADR-255](../completed/255-overlay-origins-with-trigger.md) (오버레이 원본 = trigger + 본체 한 RAC 트리) 가 base. 이 ADR 은 그 트리 안 본체에 slot 을 선언하는 응용이다. [ADR-261](../completed/261-component-api-swap-slot-suggestions-properties.md) (slot 채움 · 추천 · 교체) · [ADR-260](../completed/260-component-origin-in-place.md) (page 원본) 과는 직교 — 그 기계를 쓴다.
2. **schema**: 문서 schema 변경 0 (`slot` · `fillSlot` 은 있는 필드). library template 데이터 변경 (slot 선언 5 원본 · region frame 2) → `LIBRARY_CONTRACT_VERSION` 45 — 44 문서는 거부 · 재생성 (구조 변경 계약 Step 3, 변환 코드 0 — 리뷰 h1).
3. **선행 전제 reverse 검증**: ADR-255 는 「Preview 에 보이지 않는 Popover · Tooltip」 을 트리를 문서에 넣어 해결했고 Decision 5 에서 「닫힌 overlay 의 Canvas 편집은 Layers 로」 를 범위 밖으로 남겼다. 이 ADR 은 그 트리를 유지한다 (대안 B 가 되돌리는 쪽 — 기각). 의존 방향은 255 → 278 그대로.
4. **판독**: 사용자가 요청할 때 `/review-adr 278`.

## 1. Phase 0 — 인벤토리 · RED (G0)

- **오버레이 5 원본의 본체 노드 표** (`reusableOriginLibrary.ts`, 2026-10-21 판독 — 본문 §현재 2):

  | 원본           | 루트           | 본체 노드                                                                                                                                                                             | slot holder 후보                                         |
  | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
  | Dialog         | DialogTrigger  | `__modal` (Modal) > `__2` (Dialog) > `__2_1` heading[title] · `__content-region` frame > `__2_2` description · `__2_3` DialogFooter > `__actions-region` frame (빈) + `__2_3_1` Close | `__content-region` · `__actions-region` (있음)           |
  | Popover        | DialogTrigger  | `__overlay` (Popover) > `__arrow` · `__1` heading · `__2` description                                                                                                                 | 새 frame (arrow 뒤) — `__content-region`                 |
  | Tooltip        | TooltipTrigger | `__overlay` (Tooltip) > `__arrow` · `__1` description                                                                                                                                 | 새 frame (arrow 뒤) — `__content-region` (사용자 결정 1) |
  | ContextualHelp | ContextualHelp | `__overlay` (Popover) > `__title` heading · `__content` (Content) > Text · `__footer` (Footer) > Link                                                                                 | `__content` · `__footer` (있음, 사용자 결정 3)           |
  | Menu           | MenuTrigger    | `__popover` (Popover) > `__menu` (Menu) > `__item-1..3`                                                                                                                               | `__menu` 자신 (사용자 결정 4)                            |

- **소비 경로 전수** (grep + 실행):
  - presence: `packages/shared/src/catalog/runtime/presence.ts:70-96` `TRIGGER_OVERLAY_CHILDREN` · `:771-773` 숨김 분기 · `:3039` `isOpen` · display state 읽기 `:2971`.
  - resolver 의 slot 투영: `packages/shared/src/catalog/resolution/resolver.ts:1946` · `:2060-2085` (`fillSlot` · `innerPlace`).
  - DOM 렌더러: `DialogTrigger` · `Modal` · `Popover` · `Tooltip` · `MenuTrigger` 의 shared 컴포넌트 (`packages/shared/src/catalog/…` — `adr256DialogModal.test.tsx` · `adr255OverlayTrigger.test.ts` 가 인용하는 파일) 가 자식 노드를 순서대로 렌더하는지, slot 내용 (`fillSlot.childIds`) 이 그 자식에 포함되는지.
  - Layers: `apps/builder/src/builder/catalogRuntime/layerTree.ts` 가 숨은 오버레이 자식 · 그 안 slot 내용을 행으로 내는지 (ADR-255 Decision 5 「Layers 선택」 의 실제 상태).
  - Design 패널 slot 절: `apps/builder/src/builder/panels/properties/catalog/CatalogSlotSection.tsx` · `catalogRuntime/slots.ts` (`catalogSlotTarget` · `catalogSlotCommands.fill` · `catalogSlotInsertOptions`) 가 오버레이 안 slot 자리를 target 으로 받는지.
  - drop 부모 (ADR-261 Decision 1 EditTarget): `catalogInsertParent` 가 숨은 slot 자리를 받는지.
  - Canvas: Popover · Modal · Tooltip · Menu type 의 Skia binding · catalog rule (`componentRulesTable.ts`) 존재 여부 — Components page 본체 칸의 가능 범위.
  - Components page: `componentsPage.ts` `originItems` (slot 깊이) · `originSlots` (slot 마크) · `catalogSlotMarks` (`catalogChrome.ts`).
- **RED 2 (실행 근거)**:
  - (a) 기존 schema 로: Dialog instance 에 `fillSlot` 을 손으로 넣는 대신, Phase 1 의 slot 선언을 임시로 적용한 fixture 에서 `content` 에 Text 를 채우고 — Preview DOM (`adr256DialogModal` 류 render) 에 Modal 안 그 Text 가 있는지 · Layers 행이 있는지 · `catalogSlotTarget` 이 그 자리를 주는지. 하나라도 안 되면 Phase 1 에 수리 행을 추가.
  - (b) Components page 샘플에서 오버레이 자식 숨김을 끈 상태 (`displayState` 임시) 로 Popover · Modal · Tooltip · Menu 가 `canvasInputs` 에 record 로 서고 geometry 가 0 이 아닌지. 0 이면 Decision 4 「내용만」.
- 결과를 이 절 아래 「Phase 0 결과」 에 적는다.

## 2. Phase 1 — slot 선언 · region frame · contract 45 (G1)

- `reusableOriginLibrary.ts` 직접 편집 (ADR-276 · 277 과 같음):
  - Dialog: `__content-region` 에 `slot: { name: "content", required: false }` · `__actions-region` 에 `slot: { name: "actions", required: false }`.
  - Popover · Tooltip: `__overlay` 의 children 에 `__content-region` (`type-frame`, `display: flex; flexDirection: column`) 을 arrow 뒤에 넣고 기존 heading · description 을 그 안으로. slot `content`.
  - ContextualHelp: `__content` 에 `content` · `__footer` 에 `footer` (사용자 결정 3).
  - Menu: `__menu` 에 `Items` (사용자 결정 4).
  - `LIBRARY_CONTRACT_VERSION` 44 → 45 (`types.ts:123`).
- 옛 문서 (리뷰 h1): contract 44 문서는 `storage.ts:369` · `validation.ts:1505` 가 거부한다 — 호환 약속 없음, 변환 코드 0. 테스트: (i) 44 문서 → `UNSUPPORTED_PROJECT_FORMAT` · `UNSUPPORTED_LIBRARY_CONTRACT` (기존 contract 테스트의 값만 45 로), (ii) 45 새 문서의 오버레이 instance (`fillSlot` 없음) 의 resolved record = template 기본 내용, (iii) `fillSlot(content)` 저장 → 재열기 → 같은 record. 45 fixture 비교를 옛 문서 호환 근거로 쓰지 않는다.
- **컬렉션 slot 의 Local 후보** (리뷰 h2): `apps/builder/src/builder/catalogRuntime/slots.ts` `catalogSlotInsertOptions` 의 `items` 분기 (`:291-303`) 에 free-content 분기의 project 정의 순회 (`:335-353` — `usage !== "layout"` · 자기 정의 제외) 를 같이 적용한다. 거름은 기존 `allowed` 필터 (`assertNestable` → `definitionTypeName` 이 Local 정의의 루트 type) 가 한다 — 새 판정 코드 0. unit: MenuItem 루트 Local 정의가 Menu `Items` 후보에 있고 frame · Button 루트는 없다 · ListBox `Items` 도 같은 결과 (ListBoxItem 루트만) · 선택 → `catalogSlotCommands.fill` → resolved record 에 그 instance. 원복 RED: `items` 분기의 project 순회 제거 → 후보 0.
- parity: Compare Mode (ADR-248 G3 하니스) — Popover · Tooltip 의 새 div 가 생성 CSS 에서 중립 상자인지 (`generate-css.ts` 가 frame 에 내는 선언 0 확인) · 레퍼런스 구조 비교 테스트 (`adr256*` 의 DOM 비교) 에 「정해진 차이」 행 추가.
- 교체 (`swapInstance`): `content` slot 내용이 같은 이름으로 옮겨지는 unit (Dialog ↔ Popover 교체 — 둘 다 DialogTrigger 루트).
- Phase 0 (a) 가 RED 였으면 그 수리 (resolver · DOM 렌더러 · Layers · slot target) 를 여기에.
- 원복 RED: 원본별 (slot 선언 제거 → Design 패널 slot 절 부재 · 교체 때 내용 유실).

## 3. Phase 2 — Library page 본체 칸 · Item 줄 (G2)

- `componentsPage.ts`:
  - 오버레이 5 카드의 Origin 줄에 본체 칸 (사용자 결정 2 — 기본안: ◆ trigger 오른쪽). 샘플 instance 의 오버레이 자식 (Modal · Popover · Tooltip) 에 `displayState: "open"` (또는 같은 뜻의 patch) → `presence.ts:771` 분기가 그 record 에서는 숨기지 않는다. 구현 자리는 `catalogStateValue` 의 `isOpen` (`:3039`) 을 display state 로 읽게 하는 것 — hover · pressed 와 같은 모양.
  - Phase 0 (b) 가 RED 면 본체 칸 = slot holder 아래 내용만 (Dialog 는 heading · content · footer 를 Dialog 노드 없이).
  - `originItems`: slot holder 를 template 전체에서 찾되, `TRIGGER_OVERLAY_CHILDREN` 안 (닫힌 오버레이) 의 slot 은 Menu (open 상태로 그리는 카드) 만 포함 — Select · ComboBox 의 ListBox `Items` 는 제외 (R5). 2026-10-21 「Library page」 테스트의 7 카드 단언에서 Menu 는 Item 줄 있음으로 바꾼다 (MenuItem 상태 4 — `--unselected` 없음, 본문 §현재 참고).
  - 카드 `weight` 에 본체 높이.
- `catalogSlotMarks`: 본체 slot (빈 `actions`) 의 빗금.

## 4. Phase 3 — live (G3)

- headed Chrome · dev 5173 (또는 worktree 5175) · TEST 프로젝트 · 저장된 인증 세션 (`feedback-live-tests-reuse-auth-session-dashboard`):
  1. page 에 frame (Heading + Text + Button) 그리기 → Create component (Local 「Confirm body」).
  2. Dialog 를 팔레트에서 놓기 → Layers 에서 Modal > Dialog > content 자리를 고른다 (DialogTrigger 루트 선택은 안 slot 을 열거하지 않는다 — `slots.ts:76-98`) → Design 패널 slot 절 `content` 에 「Confirm body」 넣기 (추천 없음 — 전체 검색).
  3. Preview: Open Dialog → Modal 안에 Confirm body.
  4. slot 절 「원본 내용 복원」 → description 으로 돌아옴.
  5. Menu: MenuItem instance 로 Local 컴포넌트 「Menu row」 만들기 → Menu instance 의 `Items` slot 절 Fill 목록에 「Menu row」 가 있고 frame 루트 「Confirm body」 는 없음 → 넣기 → Preview 메뉴 열림에 그 항목.
  6. Layers: Dialog instance 펼침 → Modal > Dialog > content > Confirm body 행 선택 → Canvas 선택 표시 (닫힌 채 — 선택만).
  7. Library page 카드 68 · 69 · 70 · 71 · 34 본체 칸 · Menu Item 줄.
- 정리는 삭제 명령 (undo 금지 — `feedback-live-cleanup-delete-not-undo`).

## 5. Phase 4 — 문서 · 종결 (G4 · G5)

- CHANGELOG (Added: 오버레이 본체 slot · Library page 본체 칸) · README · 본문 `### Live Exercise` · `project-origin-instance-slot-reference-pen-figma` 메모리 갱신.
- type-check · shared · builder 스위트 (제외 목록: `resolveContainerStylesFallback` 1 · IconButton 잔재 11) · pre-push ratchet · 번들.
- G5 사용자 Builder 확인 → Implemented.

## 6. 추정 규모

- 소스: `reusableOriginLibrary.ts` (template 5 원본 · 새 노드 2) · `types.ts` (contract) · `slots.ts` (컬렉션 slot 의 Local 후보 — 리뷰 h2) · `presence.ts` (display state open) · `componentsPage.ts` · `phase4eOriginView.test.ts` · parity 「정해진 차이」 1~~2 파일 · Phase 0 (a) 결과에 따라 resolver / DOM 렌더러 / `layerTree.ts` / `slots.ts` 0~~4.
- 추정 9 ~ 15 파일 (리뷰 Round 1 뒤 `slots.ts` + unit 1). 1.5× 초과 시 Phase 0 inventory 보강 commit 으로 흡수 (adr-writing M3).
