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

(실행 시 기록)
