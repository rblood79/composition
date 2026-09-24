# ADR-240 구현 상세 — 이름 영역 · 자유 내용 slot (Card · Dialog · Popover · Tooltip)

> 본문: [ADR-240](../240-named-regions-free-content-slots.md) · base: [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) · 관련: [ADR-148](../completed/148-reusable-slot-system-unification.md) (slotRole 어휘 · 설계도 `docs/reference/components/REUSABLE_SLOT_DESIGN.md`)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-24 (AskUserQuestion — "3개로 분리"). 근거: 같은 날 `/deep-research` (react-aria.adobe.com) + `react-aria-components@1.21.0` 소스 + 코드 조사.

1. **base / 응용**: 234 (origin · instance · slot) 와 148 (slotRole 어휘 · named-region P3) 가 base. 240 은 148 이 어휘만 두고 채우기 경로를 만들지 않은 **이름 영역** 에 234 의 slot 채우기를 적용하는 응용이다.
2. **schema 직교성**: 새 저장 필드 · 새 노드 type 없음. `slot: string[]` · `descendants[path].children` (mode C) · `metadata.slotRole` 은 이미 있는 모양이다 (F1 · F2). Dialog 내용 영역은 기존 `frame` type 을 쓴다.
3. **선행 전제 역전 검증**: 240 → 234 · 148 단방향. 238 · 239 · 241 과 독립 (항목 collection 이 아니라 고정 영역).
4. **범위**: Card (preview · header · content · footer) · Dialog (title 고정 · content 영역 · footer 영역) · Popover · Tooltip (root 가 내용 영역) 의 slot 채우기 — 추천 origin 과 **자유 내용** (팔레트 primitive 포함). 판정만 (작업 없음): RAC 고정 부품 (Dialog `title` Heading · `close` Button · Calendar `previous`/`next` · Disclosure `trigger`) 은 slot 이 아니다 · Toast 는 저작 모델 밖.

## 2. 레퍼런스 — RAC (`react-aria-components@1.21.0` · starter, read-only)

| ID  | 사실                                                                                                                                                 | 근거                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R1  | Dialog provider slot = `title` (Heading — `aria-labelledby`) · `description` · `close` (Button — 닫기 동작). 그 밖의 Dialog 자식은 자유 내용.        | `dist/private/Dialog.mjs` provider `slots` · react-aria.adobe.com/Dialog |
| R2  | Popover · Tooltip · Modal 은 자유 내용 컨테이너 (이름 있는 slot 없음).                                                                               | react-aria.adobe.com/Popover · Tooltip                                   |
| R3  | Calendar `previous`/`next` · Disclosure `trigger` 는 부모가 context 로 연결하는 고정 부품 (동작 소유 = RAC).                                         | `dist/private/{Calendar,Disclosure}.mjs` provider `slots`                |
| R4  | RAC Toast 는 `UNSTABLE_ToastRegion`/`ToastQueue` — 페이지에 배치하는 요소가 아니라 런타임 큐가 띄우는 알림 (`title` · `description` · `close` slot). | `dist/exports/Toast` · starter `Toast.tsx:3-6`                           |
| R5  | RAC 에는 Card 컴포넌트가 없다 — Card 영역 (preview · header · content · footer) 은 composition 조합 (RSP · 설계도 P3) 이다.                          | RAC export 목록 · `REUSABLE_SLOT_DESIGN.md:229,242`                      |

## 3. 코드 사실 (2026-09-24, main `44ec413ad`)

| ID  | 사실                                                                                                                                                                                                                                                                                        | 위치                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `CanonicalNode.slot?: false \| string[]` = 삽입 가능한 reusable id 추천 목록 — frame 및 CardContent 등 structural shell 에서 보존.                                                                                                                                                          | `packages/shared/src/types/composition-document.types.ts:945-954`                                                                                  |
| F2  | `DescendantOverride` 3 모드 — A props patch · B `type` 교체 · **C `children` 교체 = slot 채우기** (`descendants[slotPath].children`).                                                                                                                                                       | `composition-document.types.ts:776-818`                                                                                                            |
| F3  | 인스턴스 slot 채우기 UI (`ComponentSlotFillSection`) 는 master 자식 중 `slot` 배열을 가진 노드를 찾아 mode C 로 **reusable ref 만** 넣는다 (primitive 불가) · Clear 는 그 경로 삭제.                                                                                                        | `apps/builder/src/builder/panels/properties/ComponentSlotFillSection.tsx:120-144,289-335,338-349`                                                  |
| F4  | Frame 가족 slot host = box · cardcontent · cardfooter · cardheader · frame · group · section — Dialog · DialogFooter · Popover · Tooltip 은 아니다.                                                                                                                                         | `apps/builder/src/builder/components/slotHostPolicy.ts:30-38`                                                                                      |
| F5  | Card origin 자식 = CardPreview(preview) > Image · CardHeader(header) > Heading `{title}` · CardContent(content) > Description `{description}` · CardFooter(footer, 빈) — `metadata.slotRole` + `props.slot` 은 있고 **`slot` 배열은 없다** → F3 이 Card instance 에 아무것도 보이지 않는다. | `apps/builder/src/builder/components/card/cardTemplateOrigins.ts:64-205`                                                                           |
| F6  | Dialog origin 자식 = Heading (level 2) · Description · DialogFooter > Button `slot:"close"` — slotRole · `slot` 배열 · 내용 영역 컨테이너가 없다. root = DialogTrigger (`component-dialog--content` 가 Dialog).                                                                             | `apps/builder/src/builder/factories/definitions/OverlayComponents.ts:39-121` · `components/catalogOrigins.ts:258-277`                              |
| F7  | Dialog instance `descendants` 경로 전치 선례 — `migrateDialogTriggerInstances` 가 경로 앞에 `component-dialog--content/` 를 붙이고 root props 를 옮긴다.                                                                                                                                    | `apps/builder/src/builder/components/migrateDialogTriggerInstances.ts:8-64`                                                                        |
| F8  | Popover origin = Heading + Description · Tooltip origin = Description — slot 없음.                                                                                                                                                                                                          | `OverlayComponents.ts:131-190,199-247` · 새 문서 probe (2026-09-24)                                                                                |
| F9  | slotRole 어휘에 named-region (`header` · `content` · `footer` · `preview` · `action`) 이 있으나 Dialog · Popover · Tooltip · Toast 는 쓰지 않는다 · `action` 소비처 0.                                                                                                                      | `packages/shared/src/catalog/slotRoles.ts:36-41`                                                                                                   |
| F10 | origin 자식 ref 변환은 `slotRole` 자식을 ref 로 바꾸지 않는다 · DialogTrigger 아래 Dialog 는 순환 방지로 변환 제외.                                                                                                                                                                         | `apps/builder/src/builder/components/originChildRefs.ts:327,332-337`                                                                               |
| F11 | Toast = catalog primitive · reusable origin 없음 ("생성 진입점 0") · 팔레트 없음 · 자체 ToastProvider (RAC 미사용).                                                                                                                                                                         | `packages/shared/src/catalog/componentCatalog.ts:1027-1031,1196-1199` · `packages/shared/src/components/Toast.tsx`                                 |
| F12 | CalendarHeader (prev/next) · DisclosureHeader (trigger) 는 부모가 DOM 을 self-compose 하는 고정 부품 — read-only sub-part 술어 표에는 없다.                                                                                                                                                 | `packages/shared/src/catalog/bindings/{CalendarHeader,DisclosureHeader}.binding.ts` · `catalog/resolvers/resolveDelegatedChildFontSize.ts:109-131` |
| F13 | 페이지 frame slot 선례 — 페이지 root 를 `slot_name` 으로 묶어 `descendants[slotPath].children` (mode C) 로 채운다.                                                                                                                                                                          | `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts:101-140`                                                                              |

## 4. Phase

### Phase 0 — inventory freeze (G0)

- F1~F13 재grep. instance 영역 채우기의 쓰기 경로 표 — Properties Slot 절 · Canvas drop (instance 안 영역에 팔레트 항목 drop 이 지금 어디로 가는지 · `dropTargetResolver`) · 붙여넣기 · AI tool.
- 진단 RED:
  - (a) Card instance 선택 → Slot 채우기 절이 비어 있다 (F3 · F5).
  - (b) mode C 로 primitive (Text · Image) 를 넣으면 Preview · Canvas 가 그리는지 — 해석기 지원 여부 확인 (F2 의 C 가 ref 외 노드를 받는가).
  - (c) Dialog instance 에 내용을 더할 자리가 없다 (F6).
  - (d) instance 자기 자식으로 넣은 Popover 내용이 inherited 자식 뒤 순서로 놓이는지 (237 `alignSiblingOrderToChildrenMap` 과 같은 축).
  - (e) **mode C 로 채운 노드의 편집** (리뷰 r1 h3): `descendants[영역].children` 의 Text `t` 를 Properties 에서 고치면 쓰기는 `descendants["영역/t"]` (`inspectorActions.ts:481-510` `buildInstanceDescendantPatches`) 로 가는데, 두 해석기는 mode C 배열 안 노드 props 를 읽는다 (Canvas `canonicalRefResolution.ts:755-775` · Preview `resolvers/canonical/index.ts:481-494`) → 화면 무변화 RED. 234 Tab Slot "+" 항목 (같은 mode C) 이 이미 이 결함을 가지는지 같이 잰다.
  - (f) 저장된 history 가 있는 페이지에서 Dialog 구조 이관 → Undo/Redo 가 이관 전 경로 스냅샷을 되살리는지 (리뷰 r1 h2 — `historyIndexedDB.ts:300-315` 는 저장 이벤트를 그대로 복원).
- 이관 수식 실측: Dialog origin 구조 변경 (Description → Content frame 안 · DialogFooter 안 Actions frame 추가) 에 따른 기존 instance `descendants` 경로 전치 건수 · Δbyte · 이관 대상 Dialog instance 를 담은 페이지의 저장 history 항목 수.
- DialogFooter 배치 실측: catalog DialogFooter 의 `justifyContent` · `gap` — 빈 Actions frame (폭 0) 이 Close 위치를 바꾸는지 (flex-end 면 Close 오른쪽 끝 고정).

### Phase 1 — 영역 slot seed (G1)

- **영역 = origin 자식 컨테이너 + `slotRole` + `slot` 배열**. 추천 목록 (seed, 사용자 편집 가능 — 없을 때만):

  | origin  | 영역 (slotRole) | host 노드                                        | 추천 (reusable)                       |
  | ------- | --------------- | ------------------------------------------------ | ------------------------------------- |
  | Card    | preview         | CardPreview                                      | Image 계열 (Phase 0 에서 origin 확인) |
  | Card    | header          | CardHeader                                       | Badge · Button (icon)                 |
  | Card    | content         | CardContent                                      | Button · Link · TagGroup              |
  | Card    | footer          | CardFooter                                       | Button · Link                         |
  | Dialog  | content         | 새 `frame` "Content" (Description 을 안으로)     | Button · TextField · Checkbox · …     |
  | Dialog  | footer (action) | 새 `frame` "Actions" (DialogFooter 안, Close 앞) | Button                                |
  | Popover | content         | root — instance 자기 자식 (mode C 아님)          | Button · Link                         |
  | Tooltip | content         | root — instance 자기 자식 (mode C 아님)          | (추천 없음 — 자유 내용만)             |

- Popover · Tooltip 을 slot host 로 (F4 확장 — 표의 행). DialogFooter 자신은 host 가 아니다 — 안의 Actions frame 이 host (frame 은 이미 host 가족).
- **Dialog footer 구조** (리뷰 r1 h1): mode C 는 host 자식을 통째로 바꾼다 (`resolvers/canonical/index.ts:481-494`). DialogFooter 를 host 로 두면 채우는 순간 Close (`slot:"close"`) 가 사라진다. 그래서 Close 는 **제자리 (DialogFooter 직계) 에 두고**, 그 앞에 새 `frame` "Actions" 를 넣어 action 영역 host 로 삼는다. Close 경로가 바뀌지 않으므로 기존 `…/DialogFooter/<Close>` override 는 그대로 적용된다. 빈 Actions frame 의 픽셀 영향은 Phase 0 배치 실측 — Close 위치가 바뀌면 Actions frame 을 이관 없이 새 문서에만 seed.
- **Dialog 구조 이관**: origin 에 Content frame 을 넣고 Description 을 그 안으로 · DialogFooter 안에 Actions frame. 기존 instance 의 Description 경로 patch 는 F7 선례대로 경로 전치 (1회 · 멱등). 이동하는 노드는 Description 하나 — title · Close 는 경로 불변.
- **history 경로 이관** (리뷰 r1 h2): 문서 이관과 같은 전치 함수를 저장 history 의 노드 스냅샷 (replace event 의 prev/next instance) 에도 적용한다. 전치할 수 없는 모양의 항목이 있는 페이지는 그 페이지의 저장 history 를 비운다 (명시적 무효화 — 이관 로그에 기록). Undo 가 이관 전 경로를 되살리지 않는 것이 조건.
- title Heading · close Button 은 고정 부품 (R1) — 영역 밖에 두고 slot 후보로 넣지 않는다.

### Phase 2 — 자유 내용 채우기 (G2)

- Slot 채우기 절이 추천 origin 에 더해 **팔레트 primitive** (Text · Heading · Image · Icon …) 를 영역에 넣는다 — Card · Dialog 영역은 mode C `children` 에 plain 노드 (Phase 0 (b) 결과로 해석기 보강 범위 확정) · Popover · Tooltip root 는 instance 자기 자식 (237 `placedChildren` — inherited Heading · Description 뒤에 덧붙는다, Clear = 자기 자식 삭제).
- Canvas drop: instance 안 영역 host 위 drop = 그 영역 mode C 추가 (영역 밖 inherited 노드에는 drop 금지 — 234 구조 보존).
- **채운 노드 편집** (리뷰 r1 h3): 채운 노드는 instance 소유다. 편집 쓰기는 `descendants["영역/노드"]` patch 가 아니라 **mode C 배열 안 그 노드** 를 고친다 (두 해석기가 읽는 자리). Properties · Styles · fills 쓰기 경로가 synthetic id 의 조상에 mode C host 가 있으면 배열 노드를 대상으로 삼는다 — history 는 instance replace event (기존 형태). 진단 (e) 가 234 Tab 항목에서도 RED 면 같은 수리로 함께 닫는다.

### Phase 3 — 성능 · BC (G3 · G4)

- G3: headed A/B (대조 arm = 240 전 빌드) — fixture = Card 50 · Dialog 20 instance (영역 채움 3 노드씩) · 불리 조작 (Card origin 편집 · breakpoint).
- G4: 이관 전후 Canvas 픽셀 동일 (Card · Dialog · Popover instance) · Dialog 경로 전치 뒤 기존 patch 적용 결과 동일 (Description · Close override 포함) · **저장 history 가 있는 페이지의 이관 → Undo → Redo 가 이관 뒤 경로로 동작** · 재hydration Δ0.

## 5. 실행 기록

### Phase 0 — G0 inventory freeze (2026-09-24, 기준 `61d29f98a` · worktree `adr-240`)

- **F1~F13 재확인**: `44ec413ad..61d29f98a` 사이 변경은 `docs/adr/**` 뿐 → 라인 그대로. 정정 1건:
  - **F6 정정** — seed Dialog origin 의 trigger (`component-dialog__1`) 와 Close (`component-dialog__2_3_1`) 는 plain Button 이 아니라 **Button origin ref** (`originChildRefs` 가 바꾼다) — Close 는 `props.slot:"close"`. Heading (`__2_1`) · Description (`__2_2`) · DialogFooter (`__2_3`) 는 plain. 구 문서 (trigger 이관 전 origin 이 Dialog 였던 문서) 는 `repairCatalogOrigin` 이 본문 자식 id 를 그대로 둬 `component-dialog--content > component-dialog__1 (Heading) · __2 (Description) · __3 (DialogFooter)` — **Description id 가 문서 세대마다 다르다**.
- **새 코드 사실** (G0 추가 — Phase 1·2 설계 입력):

| ID  | 사실                                                                                                                                                                                                                                                                                                      | 위치                                                                                             | 영향                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| F14 | Slot 채우기 UI 경로 = `customId ?? id` — Card 영역 (name 보유) 은 `component-card__content`. Preview 는 id · name segment 둘 다 받고 (`applyDescendantsToTree` idPath 우선), **Canvas 는 name segment (`getCanonicalRefPathSegment`) 만** 받는다 → 지금 UI 로 Card 를 채우면 Canvas 만 상속 자식을 그린다 | `ComponentSlotFillSection.tsx:95-97,129-130` · `resolvers/canonical/index.ts:335-341` · 진단 (g) | Phase 1: UI 키를 `getCanonicalRefPathSegment` 로 (또는 Canvas 가 id 키도 받게) — 두 leg 같은 키                               |
| F15 | `collectSlotHosts` 는 master **자식부터** 돈다 — root 의 `slot` 은 Slot 채우기 절에 안 나온다                                                                                                                                                                                                             | `ComponentSlotFillSection.tsx:120-144`                                                           | Popover · Tooltip root 영역은 절이 root 를 따로 보여야 한다 (instance 자기 자식 추가 — mode C 아님)                           |
| F16 | `CardPreview` 는 `FRAME_SLOT_HOST_TYPES` 에 없다                                                                                                                                                                                                                                                          | `slotHostPolicy.ts:30-38` · 진단 (a)                                                             | Phase 1 host 표에 추가                                                                                                        |
| F17 | `repairCatalogOrigin` 은 기존 origin 의 `children` 을 그대로 둔다 (사용자 편집 보존)                                                                                                                                                                                                                      | `catalogOrigins.ts:253-311`                                                                      | Dialog Content · Actions frame 은 repair 로 안 들어간다 — origin 구조 이관을 따로 (Description 은 id 가 아니라 구조로 찾는다) |
| F18 | 팔레트 클릭 삽입 부모: synthetic 영역 (`card-inst/Content`) 선택 → 패널 노드 목록에 synthetic 이 없어 **body 로 빠진다** · Card instance 선택 → instance 자기 자식 (inherited Footer 뒤, `type:"ref"` 라 CardFooter 라우팅 미적용)                                                                        | `ComponentsPanel.tsx:56` · `useElementCreator.ts:162-176,236-256` · probe 실측                   | Phase 2: 영역 host 선택 시 그 영역 mode C 로                                                                                  |
| F19 | Canvas mode C synthetic 노드는 `fills` 를 싣지 않는다 (`getOverrideNodeProps` 가 제외 · synthetic 에 재부착 없음) — Preview `resolveNode` 는 싣는다                                                                                                                                                       | `canonicalRefResolution.ts:575-593,760-785`                                                      | Phase 2 G2 두 leg unit 에 fills 행 포함 (판독 — 반증 1 건으로 확정)                                                           |
| F20 | Canvas 이동 drop 은 `isExplicitSlotHost` (slot 배열) 를 instance guard **앞에서** 통과시킨다                                                                                                                                                                                                              | `dropTargetResolver.ts:242-244,289-296`                                                          | Phase 1 에서 origin 영역이 `slot` 을 가지면 synthetic 영역 노드가 reparent 대상이 될 수 있다 — Phase 2 drop 판정 unit         |

- **seed 실측** (`createInitialProjectDocument` — origin 120):
  - Card = `component-card__{preview,header,content,footer}` (name Preview · Header · Content · Footer, `slotRole` + `props.slot`, `slot` 배열 0) · preview 안 Image · header 안 Heading `{title}` · content 안 Description `{description}` · footer 빈.
  - Popover = Heading · Description (plain) · Tooltip = Description (plain) · `slot` 0.
  - 추천 목록 후보 origin: Badge · Button · IconButton · Link · TagGroup · TextField · Checkbox · ToggleButton 존재. **Image reusable origin 없음** → Card preview 추천은 `[]` (F3 은 빈 목록이면 모든 reusable 을 후보로 보인다 — `getFillCandidateOptions:157-160`). primitive (Image) 는 Phase 2 자유 내용이 맡는다.
  - mode C 는 host 자식을 통째로 바꾼다 — Card header 를 채우면 `{title}` Heading, content 를 채우면 `{description}` 이 빠진다 (Decision 2 "교체" 그대로 · 234 Frame slot 과 같은 동작). G1 unit 에 명시 행으로 둔다.
- **이관 수식 실측**:
  - (ii) Dialog instance 1 개당 전치 키 = `descendants` 중 경로가 Description 노드 (`<Dialog 본문 segment>/<Description segment>` 과 그 하위) 인 키 — Description 은 자식이 없어 0~1. 전치 = 경로에 `<Content frame segment>/` 삽입 → **Δbyte = +len(segment)+1 per 키** (frame name "Content" 면 +8). trigger 이관 (`migrateDialogTriggerInstances`) **뒤** 에 돌아야 한다 (옛 `component-dialog/…` 경로는 먼저 `--content/` 를 받는다). Close (`…/DialogFooter/<Close>`) · title 경로 불변.
  - seed · 새 문서: Dialog instance 0 → 전치 0 · 저장 history 0.
  - **사용자 문서 수 · 저장 history 항목 수는 G4 로 이월** — IndexedDB 는 origin (포트 포함) 단위라 이 worktree dev 서버 (다른 포트) 에서는 사용자 문서가 안 보이고, 240 빌드가 문서를 한 번 열면 이관이 끝난다. G4 에서 이관 빌드를 열기 전 같은 origin 의 IDB 를 읽기 전용으로 센다 (Dialog instance 수 · Description patch 키 수 · 그 페이지의 history 항목 수).
- **DialogFooter 배치** (코드 판독): 배치 정본 = factory 인라인 `display:flex · justifyContent:flex-end · gap:"8px"` (catalog DialogFooter 는 `containerStyles: undefined`). frame 기본 = padding 0 · gap 0 · flex column · 자식 없음 → 0×0. flex-end 행에서 [Actions 0 폭, gap 8, Close] 는 Close 를 오른쪽 끝에 둔다 → **Close 위치 불변 예상**. 픽셀 확인은 G1 live (Skia).
- **진단 RED 9** (`components/__tests__/adr240Diagnostics.test.tsx`, `it.fails` — 원인 확인: `it` 로 바꿔 실행한 실패 메시지 대조):
  - (a) Card origin 영역 4 `slot` 배열 없음 (`preview: expected false`) · CardPreview `isSlotHostElement` = false
  - (c) Dialog 본문에 content 영역 host 없음
  - (e) Card Content mode C Text `t` 에 `"Content/t"` patch (쓰기 경로가 만드는 키) → Preview · Canvas 둘 다 `'A'` (편집 B 무시)
  - (e2) mode C 안 **ref 자식** (234 Slot "+" 모양) 도 같은 결함 → Phase 2 수리가 234 Tab 항목도 닫는다
  - (f) 이관 뒤 문서에 이관 전 스냅샷 (옛 경로 A) replace event Undo → Description = `'origin'` (리뷰 r1 h2 시나리오 그대로)
  - (g) id 경로 키 mode C → Canvas 는 상속 Description 을 그린다 (F14)
- **기준선 GREEN 10**: F5 Card 영역 모양 · (b) mode C primitive Text 가 두 leg 에 실린다 (Preview resolved · Canvas synthetic `card-inst/Content/t`) → **해석기 보강 불요, R2 는 쓰기 키 (F14) · 편집 (e) · fills (F19) 로 좁혀짐** · F6 Dialog 모양 (정정) · (d) Popover 자기 자식 = Heading · Description · Button 순서 두 leg 같음 · (e)(e2) 두 leg 같은 값 A · (f) 새 경로 patch 는 이관 뒤 origin 에서 적용 · (g) Preview id 키 수용.
- **쓰기 경로 표** (instance 영역 채우기):

| 경로                   | 위치                                                                                                                      | 지금                                                                                | 240 처리                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| origin seed · repair   | `cardTemplateOrigins.ts` · `catalogOrigins.ts` (`buildRawCatalogOrigin` · `repairCatalogOrigin`) · `OverlayComponents.ts` | 영역 `slot` 0 · Dialog 내용 영역 없음                                               | Phase 1 — `slot` seed (없을 때만) · Dialog Content/Actions frame (새 문서 seed + 기존 문서 구조 이관, F17) |
| Slot 채우기 절         | `ComponentSlotFillSection.tsx:286-350`                                                                                    | master 자식의 `slot` 만 · ref 만 · 키 `customId ?? id` (F14) · root 제외 (F15)      | Phase 1 키 통일 · root 영역 · Phase 2 primitive                                                            |
| 팔레트 클릭            | `ComponentsPanel.tsx:43-116` → `resolveCreationParentForType`                                                             | synthetic 영역 선택 → body · instance 선택 → 자기 자식 (F18)                        | Phase 2 — 영역 host 선택 = 그 영역 mode C                                                                  |
| Canvas 이동 drop       | `useDragBridge.ts` → `dropTargetResolver.ts:289-296`                                                                      | instance 안 거부 · 단 slot 배열 host 는 guard 앞 통과 (F20)                         | Phase 2 — 영역 host 만 · inherited · 고정 부품 거부                                                        |
| Properties/Styles 편집 | `inspectorActions.ts:855-876` (`buildInstanceDescendantPatches`)                                                          | synthetic 은 항상 바깥 `descendants[path]` mode A (mode C 판정 없음) — 진단 (e)(e2) | Phase 2 — 조상에 mode C host 가 있으면 배열 노드 수정                                                      |
| history                | `canonicalHistoryEvents.ts:317-341` · `historyIndexedDB.ts:296-330`                                                       | replace = instance 전체 remove + insert 저장 · 그대로 재삽입 — 진단 (f)             | Phase 1 — 같은 전치를 저장 스냅샷에 · 불가 페이지 history 무효화 (`clearPageHistory`)                      |
| 붙여넣기 · AI tool     | `multiElementCopy.ts` · 일반 요소 생성                                                                                    | 선택 부모 기준 (팔레트와 같은 부모 해석 가정 — 판독)                                | 변경 없음 (범위 밖 기록) — Phase 2 에서 synthetic 선택 붙여넣기 1 행 확인                                  |
| hydration              | `ensureCatalogOrigins` (`migrateDialogTriggerInstances` 먼저)                                                             | trigger 이관만                                                                      | Phase 1 — trigger 이관 뒤 Dialog 구조 이관 · instance 경로 전치 (멱등)                                     |

### Phase 1 — G1 영역 slot seed · Dialog 영역 구조 이관 · 경로 전치 (2026-09-24)

- **구현**:
  - `components/regionSlotOrigins.ts` (`ensureRegionSlots` — origin 파이프라인 `ensureGroupSlots` 뒤, 자식 ref 변환 뒤라 영역 frame 은 plain): Card 영역 4 · Popover · Tooltip root `slot` seed (없을 때만) · Dialog 본문 구조 이관 (Description → `frame` "Content" `component-dialog__content-region` · DialogFooter 안 Close 앞 `frame` "Actions" `component-dialog__actions-region`, `metadata.slotRole` content / action) · 구조를 옮긴 pass 에서만 문서 전체 Dialog instance 경로 전치. 새 문서와 기존 문서가 같은 함수 (factory definition 무변경 — 팔레트 plain Dialog · AI 생성은 영역 밖).
  - `components/dialogRegionPaths.ts`: 전치 표를 **이관 뒤 origin 에서** 읽는다 (Description id 가 세대마다 다름 — F17). id · segment 두 형태 · 하위 키 포함 · 새 키가 있으면 새 키 우선 · 멱등. `applyCanonicalHistoryEventsToDocument` 가 재생 대상 문서로 같은 표를 만들어 insert/remove 스냅샷을 전치 → **history 무효화 불요** (저장 IDB 는 그대로, 재생 시점 전치 · 멱등).
  - `slotHostPolicy.ts`: Frame 가족 host += cardpreview · popover · tooltip (F16) · `SELF_LIST_SLOT_HOST_TYPES` += Popover · Tooltip (instance root "+" = 자기 자식 — F15 는 `FrameSlotSection` 이 이미 처리하는 모양) · `isSlotContractItem` — 이름 영역 · 자유 내용 root 는 해석된 ref 만 대조 (상속 Title · Description 경고 0).
  - `components/slotFillPath.ts` + `ComponentSlotFillSection`: 경로 키 = segment (F14 닫힘 — Canvas · Properties 쓰기와 같은 키) · 옛 `customId ?? id` 키는 읽기 폴백 · 다음 채우기/비우기에서 segment 키로 이관.
  - 추천 목록 (`REGION_SLOT_SEEDS`): Card preview `[]` · header Badge · IconButton · content Button · Link · TagGroup · footer Button · Link · Dialog Content Button · TextField · Checkbox (`--unselected` 먼저 — 234 변형 이관이 추천 목록에 휴지 변형을 끼우는 규칙과 같은 순서, 안 맞추면 230 BC 가 추천 목록 변경을 잡는다) · Actions Button · Popover Button · Link · Tooltip `[]`.
- **G1 unit** (`adr240Phase1.regionSlots.test.tsx` 16 + diagnostics 갱신 — (a)(c)(f) `it`, 30 PASS · 5 expected fail = (e)(e2) 4 → Phase 2 · (g) 1 LOW deferred):
  - seed 모양 · 멱등 (`ensureRegionSlots(seed) === seed` · 재hydration 직렬화 동일) · 사용자 값 보존 (`false` · 편집한 목록) · host 판정 · 계약 대상.
  - 240 전 모양 fixture (`toPre240` — G0 seed 실측 모양) → hydration: Description 키 전치 · title · Close 키 불변 · **Δbyte = +8 per 키** · 두 번째 hydration 같은 키 · Preview · Canvas 에서 Description `Edited` · Close `Done` 그대로 · 구 세대 id (`component-dialog--content`) 도 구조로 전치 · history 재생 (옛 경로 A Undo → 새 경로 A · Redo B).
  - Slot 채우기: Card 영역 경로 `Preview/Header/Content/Footer` (옛 키 `component-card__*`) · Dialog `component-dialog__2/Content` · `…/component-dialog__2_3/Actions` · 옛 키 폴백 · 이관 · Card Content Button 두 leg · Dialog Actions 채움 뒤 Close 존재 + override `Cancel` 두 leg · Dialog Content TextField 두 leg.
- **원복 RED 8/8** (편집 역적용 → 두 파일 실행 → 복원): R1 seed off 13 · R2 전치 off 5 · R3 history 전치 off 2 · R4 host 표 off 2 · R5 계약 분기 off 1 · R6 UI 키 = id 1 · R7 Actions 를 Close 뒤 5 · R8 멱등 가드 off 1.
- **회귀**: builder 917 파일 — 실패 6 = base `61d29f98a` 에서도 실패 5 (propertyFieldIcons · adr113 grep gate 44 건 (새 파일 2 는 allowlist — canonical `RefNode.descendants` 를 고쳐 쓰는 경계, groupItemInsert 선례) · factoryInlineDirtyBaseline Dialog · historyActions.static · AI catalog) + textAxisGate (worktree 에 git 무시 evidence 파일 없음). shared 2 실패는 packages 무변경 (기존). type-check PASS.
- **live** (`apps/builder/scripts/adr240-live-exercise.mjs`, headed Playwright · worktree dev 서버 5181 · Skia layout · store, Compare Mode · Preview 미개방) **6/6**: seed 모양 · Card instance Slot 채우기 절 영역 4 → Content 에 Button (store 키 `Content` · Skia rect `live-card/Content/component-button` · 상속 Description 사라짐) · Dialog instance (`defaultOpen` — Canvas 는 열린 Dialog 만 그림) 영역 Content · Actions → Actions 에 Button: **Close rect 전후 동일 (x 252 · 68×30)** · 새 Button 이 Close 왼쪽 · Popover instance "+" → 자기 자식 Button 이 Description 아래 (y 76 ≥ 48+16) · reload 보존 · page error 0.
- **이월**: 기존 사용자 문서의 이관 전후 픽셀 동일 (base arm 대조) · 저장 history 가 있는 실제 페이지의 이관 → Undo → Redo live 는 G4 (Phase 3). (g) 옛 id 키 채움을 Canvas 가 못 읽는 것 (234 이후 name 을 가진 host 에 채운 문서) 은 LOW deferred — UI 가 다음 채우기 · 비우기에서 segment 키로 옮긴다.
