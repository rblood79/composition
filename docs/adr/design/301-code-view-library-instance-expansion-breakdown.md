# ADR-301 Design Breakdown — 코드 보기의 trigger 조립형 Library instance 펼치기

> 본문: [301-code-view-library-instance-expansion.md](../completed/301-code-view-library-instance-expansion.md). 선행: ADR-296 (파일 트리 · anchor 표 · Apply · `overrides` 역문법 · Library 파일) · 285 (identity · 재생성 대조) · 282 (Library 읽기 전용 · `unlockOrigin`) · 278 (오버레이 본체 = slot). **착수 조건: B 수리 (slot 이름 = `slot.name` · 접힌 태그 = 팔레트 type `<Popover>` — RAC import) 가 main 에 있어야 한다 (2026-11-05 완료 · 커밋 `2620043a8`)** — 이 ADR 의 생성기 변경이 그 코드 위에 쌓인다.

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-11-05 「/create-adr A」)

1. **base / 응용**: ADR-296 = base (파일 트리 · anchor 표 · Apply 다섯 단계 · 역문법 묶음). **ADR-301 = 응용** — 그 틀 안에서 노드 종류 하나 (trigger 조립형 Library instance) 의 코드 모양과 그 자리의 역문법을 바꾼다. 문서 스키마 · 명령 변경 0.
2. **schema 직교성**: 문서 스키마는 더하지 않는다. 코드 보기의 anchor 표 (`codeView/types.ts` `CodeViewAnchorTarget`) 에 `position` 한 종류 — 296 anchor 표의 specialization 이라 301 이 296 의 후속이다.
3. **선행 ADR 전제 reverse 검증**: 285 (코드 → 문서 명령, 정본 = 문서) · 282 (Library 읽기 전용 · unlock 명시적) · 281 (instance 몫 = descendant patch · address 규칙) · 278 (오버레이 본체 slot) 의 의존 방향은 그대로 — 301 은 네 결정의 소비자다. 뒤집는 것은 **296 Decision 4 의 「Library instance 몫 = `overrides` prop (파일 경계)」** 중 펼친 instance 한 조각 → 「자리」 경계. 의존 방향이 아니라 코드 모양이고 사용자 지시가 confirm.
4. **판독 전 전제**: 위 세 줄이 여기 있으므로 판독 (phase 당 1 + 수리 1) 은 본문 정합만 본다.

## 2. Phase 0 inventory (착수 때 freeze — 아래는 2026-11-05 설계 실측)

### 2a. 원본 분류 (G0 가 팔레트 62 전부 채운다)

펼침 판정 = template 루트 type 이 overlay trigger. 2026-11-05 순회 결과 6 가족이다.

| 원본                                    | 분류           |  직계 노드 | slot 자리 (`slot.name`)            | `{key}` 바인딩 자리                                                              | 중첩 자리 (요소 하나로 쓴다)    |
| --------------------------------------- | -------------- | ---------: | ---------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| Popover (`component-popover`)           | 펼침           |          7 | `content` (frame, OverlayArrow 뒤) | overlay: size · placement · offset · crossOffset · shouldFlip · containerPadding | trigger Button                  |
| Tooltip                                 | 펼침           |          6 | `content`                          | 〃                                                                               | trigger                         |
| Menu (MenuTrigger)                      | 펼침           |          8 | `Items`                            | —                                                                                | trigger · MenuItem              |
| PreviewTrigger                          | 펼침           |          7 | `content`                          | 〃                                                                               | trigger                         |
| Dialog (DialogTrigger > Modal > Dialog) | 펼침           |         10 | `content` · `actions`              | —                                                                                | trigger · Button ×2             |
| Sheet (SheetTrigger)                    | 펼침           |         10 | `content`                          | —                                                                                | trigger                         |
| Select · ComboBox                       | 필드 래퍼      |         13 | —                                  | —                                                                                | 지금 모양 (안쪽 = Library 파일) |
| DatePicker · DateRangePicker            | 필드 래퍼      |     9 · 11 | —                                  | —                                                                                | 〃                              |
| ContextualHelp                          | 필드 래퍼 (S2) |          8 | —                                  | —                                                                                | 〃                              |
| Tabs · Table · Card                     | 구조형         | 7 · 10 · 8 | G0                                 | —                                                                                | 사용자 결정 1                   |

채워야 할 열: `{key}` 별 읽는 자리 수 · 레퍼런스 사용 코드 ↔ 지금 코드의 차이 · 바운드 instance 의 코드 모양 (`<Select items>{item => …}`) · `enabled:false` 가 기본인 template 노드.

### 2b. 코드 경로 (바뀌는 곳)

| 층                 | 파일                                                                                                                                                      | 지금                                                               | 301                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성 — 태그        | `packages/shared/src/codeView/generate.ts` `componentTag :2722` · `writeNode :2770`                                                                       | `lib:` 건너뜀 → template 루트 type 하나 (B 뒤: `<Popover>` import) | 루트가 overlay trigger 면 `writeInstanceTree` (template 트리 · 투영 값 · slot inline · 중첩 instance 는 요소 하나) · 나머지는 그대로                                                                                                                                                                                                                                              |
| 생성 — slot        | `generate.ts :2970-3003` `writeSlots`                                                                                                                     | `<Slot name=…>`                                                    | 펼친 instance 에서는 slot 자리 frame `<div className="frame">` (자리 class — `codeViewAddressKey` 의 마지막 segment, 선언 이름 아님) 안에 inline · 나머지는 그대로                                                                                                                                                                                                                |
| 생성 — instance 몫 | `generate.ts :2587` `overridesCode`                                                                                                                       | `overrides={{…}}`                                                  | 펼친 instance 루트는 호출하지 않음 (요소 attribute 로) · 중첩 요소 · 나머지는 그대로                                                                                                                                                                                                                                                                                              |
| 생성 — 값 투영     | `packages/shared/src/catalog/resolution/resolver.ts :612` `bindTemplateValue` · `templateOwners.ts :67 · :124`                                            | resolver 안                                                        | 코드 보기가 같은 함수를 부른다 (둘째 해석기 금지) — export 가 없으면 export 만 추가                                                                                                                                                                                                                                                                                               |
| anchor             | `packages/shared/src/codeView/types.ts` `CodeViewAnchorTarget`                                                                                            | node · attribute(nodeId) · text(nodeId) …                          | `position {ownerId, key}` 추가 · attribute · text 가 `position` 참조를 든다 (`nodeId \| position`)                                                                                                                                                                                                                                                                                |
| 자리 키            | `packages/shared/src/codeView/files/overrides.ts :103` `codeViewAddressKey` · `:126` `codeViewAddressOf`                                                  | `overrides` · CSS 경로                                             | 키 생성은 그대로 재사용 · `position` 역변환은 class 경로만 읽는다 (slot 이름 우선 분기는 `<Slot name>` 몫)                                                                                                                                                                                                                                                                        |
| identity           | `packages/shared/src/codeView/inverse/identity.ts`                                                                                                        | unit = nodeId                                                      | unit id 에 `position` 키 허용 (문자열이라 그대로) · kept 짝은 같은 키                                                                                                                                                                                                                                                                                                             |
| 역문법 — 자리      | `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts :1600` `planOverrides` · 요소 분기 (`:2147 · :2226`)                                             | `overrides` 객체 → descendant 명령                                 | 요소 분기가 `position` anchor 를 만나면 같은 명령 (`setFields` descendant · `setWholeField(enabled)` · address 규칙 · `insertNodes` descendant 부모) · prop 은 유효 값을 만든 층에 쓴다 (patch 가 있으면 instance patch · 없고 `{key}` 를 읽는 자리가 하나면 root prop · 그 밖은 새 descendant patch — 「쓰기 층 판정」 행) · 구조 변경은 `readOnlyPosition` 거절 + unlock 스니펫 |
| 재생성 대조        | `codeViewEdit.ts :3412` `compareRegenerated` · `:3504-3525` 요소 비교 · `compare` 호출 `:417`                                                             | 자식 수 · `visibleState` 동일 요구                                 | 재생성본 anchor 를 받아 `planner.hiddenPositions` 의 키 · 숨김이 맞는 요소만 건너뜀 · 나머지 그대로                                                                                                                                                                                                                                                                               |
| 쓰기 층 판정       | `packages/shared/src/catalog/resolution/templateOwners.ts` `overridesAt` · `layeredOverride` · `resolver.ts :2241-2269`                                   | 없음                                                               | 유효 값 작성 층 판정 한 곳 — 둘째 해석기 금지 · key 를 읽는 자리 수는 template 순회                                                                                                                                                                                                                                                                                               |
| 거절 종류          | `codeViewEdit.ts :202` (`readOnlyFile` …)                                                                                                                 | —                                                                  | `readOnlyPosition` 추가 · 문구 KO/EN (`panels/codeView/codeViewMessages.ts`)                                                                                                                                                                                                                                                                                                      |
| 스타일 경로        | `packages/shared/src/codeView/files/styles.ts :679-688`                                                                                                   | `codeViewAddressKey` 경로 선택자                                   | 무변경 (page 의 `className` 이 같은 키)                                                                                                                                                                                                                                                                                                                                           |
| 어휘표 · 필드 대조 | `packages/shared/src/codeView/vocabulary.ts` · `fieldCoverage.ts`                                                                                         | Library instance = `overrides` 행 (유지)                           | 펼친 instance 행 추가 (`position` 요소 · attribute · `{false &&}`) · `read` 실증                                                                                                                                                                                                                                                                                                  |
| Library 파일       | `packages/shared/src/codeView/files/library.ts`                                                                                                           | 읽기 전용 파일                                                     | 무변경 (레퍼런스의 `Select.tsx` 자리)                                                                                                                                                                                                                                                                                                                                             |
| 접기               | `apps/builder/src/builder/panels/codeView/CodeEditor.tsx` · `packages/shared/src/codeView/types.ts` `CodeViewResult`                                      | `foldGutter` 수동 접기만                                           | 결과에 본체 자리 범위 · 열림 판정 (`catalogOverlayOpen`) · 편집기가 `foldEffect` 로 초기 적용 · Open 변경 자리만 재적용                                                                                                                                                                                                                                                           |
| Files 목록         | `packages/shared/src/codeView/files/tree.ts` `catalogStyle` · `panels/codeView/catalogSheets.ts` · `CatalogCodeViewPanel.tsx:139` · `fieldCoverage.ts:51` | 읽기 전용 catalog 시트                                             | 목록 · 파일 종류 · lazy 시트 제거 · `adr296Style.test.tsx` 갱신                                                                                                                                                                                                                                                                                                                   |

### 2c. 기준선 (G0 가 잰다)

- 번들: Builder initial 1,411,708 · Preview 323,910 (ADR-300 G4, 2026-11-03) — B 수리 뒤 HEAD worktree 에서 다시.
- 생성 시간: 가장 큰 page (CMS 22 page 재현) + Menu instance 10 개 page (불리 arm) — 측정 조건 (기기 · 4x 여부) 기록.
- golden: 284 fixture 5 (plants · photos · kanban · ios-list · emoji) + 296 golden (`adr296-page.tsx.txt` 등) 의 before.

## 3. Phase

| Phase | 내용                                                                                                                                                                 | 닫힘    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | B 반영 확인 · inventory 2a 전수 · RED (`adr301Phase0.test.tsx`) · 기준선 2c · 사용자 결정 1 · 2 · 5 · 7                                                              | G0      |
| 1     | 생성 — `writeInstanceTree` (6 가족 · 중첩 요소 하나) · `position` anchor · 펼친 루트 `overrides` 제거 · golden · 레퍼런스 구조 동치 · 나머지 불변 · 전수 왕복 strict | G1      |
| 2     | 역문법 — 자리 분기 (prop · 바인딩 자리 · handler · 삭제 · slot 추가 · 거절 + unlock) · identity `position` · 격리 · 패널 동일 · 원복 RED · 사용자 결정 3 · 4         | G2      |
| 3     | 접기 (기본 fold · Open 연동 · 세션 유지) · Files 의 catalog CSS 제거 · 컴포넌트 파일 안의 펼친 instance · 구조형 (사용자 결정 1 결과) · 사용자 결정 6                | G1 · G3 |
| 4     | 번들 · 생성 시간 · live · 문서 (296 Decision 4 한 줄 · vocabulary · CHANGELOG · 메모리 `project-code-view-is-rac-reference-code` 갱신)                               | G4 · G5 |

각 Phase 끝 = commit 가능 상태 (CLAUDE.md §phase 분할). scope inflation 1.5× 이상은 사후 보고.

## 4. 코드 모양 (Popover instance — 사용자 결정 2 · 5 · 7 권고안)

```tsx
// src/pages/Home.tsx — instance `popover_1` (Library origin, size: "L" 작성 · content 에 Switch 2 채움)
<DialogTrigger className="popover">
  <Button className="trigger" label="Settings" />
  <Popover className="overlay" size="L">
    <OverlayArrow className="arrow" />
    <div className="frame">
      <Switch defaultSelected>Wi-Fi</Switch>
      <Switch>Mute</Switch>
    </div>
  </Popover>
</DialogTrigger>
```

- `className` = 자리 키의 마지막 segment (`codeViewAddressKey`) — `Home.css` 의 `.popover .overlay { … }` · `.popover .frame { … }` 와 같은 이름. slot 선언 이름 `content` 는 펼친 코드에 나오지 않는다.
- `size="L"` 은 instance 가 쓴 값 → 그 값을 만든 층에 쓴다 (patch 가 있으면 patch, 없으면 instance `props.size`). 기본값 (placement 등) 은 생략.
- `label="Settings"` 는 trigger 자리 (중첩 Button instance) 의 patch 또는 instance prop — Button 원본의 `label` 이 `{label}` 바인딩이면 instance 체인 `[popover_1, lib:template:component-popover__trigger]` 의 root prop.
- trigger Button 의 안쪽 (Icon · Text) 을 고친 값은 `<Button … overrides={{…}} />` — 지금 문법 그대로.
- Switch 둘은 `fillSlot` 의 소유 노드 — 지금처럼 `node` anchor.
- Description 을 `{false && …}` 로 감싸거나 통째 지우면 Apply 뒤 코드는 `{false && <Description className="description" …/>}` 다 (`hiddenPositions` 정규화).
- 닫혀 있으면 `<Popover …>` 안쪽이 fold 로 접힌 채 열린다. Select 는 이 ADR 뒤에도 `<Select label="…" />` 하나다.

## 5. 거절 표 (Phase 2)

| 편집                                        | 결과                                                 |
| ------------------------------------------- | ---------------------------------------------------- |
| Popover 에 둘째 자식 (`content` 밖) 추가    | `readOnlyPosition` + unlock 스니펫                   |
| `<Popover>` → `<Modal>` type 변경           | 〃                                                   |
| trigger Button 을 Popover 뒤로 이동         | 〃                                                   |
| 펼친 instance 루트에 `overrides={{…}}` 작성 | `outsideVocabulary` (펼친 뒤에는 자리 표현만)        |
| `content` 안 Switch 추가 · 삭제 · 이동      | 받는다 (`fillSlot`)                                  |
| 안쪽 prop · handler · 삭제                  | 받는다 (유효 값 층 · address 규칙 · `enabled:false`) |

## 6. 열린 질문 (execute-adr 때 — 본문 사용자 결정 7 건 외)

- `isOpen` 이 변수에 묶인 자리를 `catalogOverlayOpen` 이 어떻게 읽는지 Phase 3 에서 확인한다 — 코드 보기 안에 둘째 판정을 두지 않는다.
- 컴포넌트 파일 (`src/components/<Name>.tsx`) 안 펼친 instance 의 자리 키는 template 노드 기준 (`instances` 가 template id 로 시작) — `codeViewAddressKey` 가 그 체인을 받는지 Phase 0 에서 확인 (받지 않으면 함수 확장, 새 키 형식 금지).

## 7. 기록 (실행 — 2026-11-08, `/execute-adr 301`)

### Phase 0 (G0)

- B 수리 main 반영 확인 (`2620043a8`). inventory 는 HEAD `0d43803f6` 의 팔레트 68 (설계 때 62 → S2 6 추가) 을 하나씩 놓아 순회 (`.agent/runs/2026-11-08-adr301-phase0/artifacts/inventory-head-0d43803f6.json` — template 트리 · 작성 prop · page 코드, local 전용). template 루트가 overlay trigger 인 원본은 그대로 6 (Popover · Dialog = DialogTrigger · Tooltip · Menu · Sheet · PreviewTrigger). §6 열린 질문: 컴포넌트 파일 안 instance 의 자리 키는 `codeViewAddressKey` 가 그대로 받는다 (새 키 형식 없음) · 변수 Open 은 `isOpen` 이 아니라 변수의 `source` 로 쓰여 문서 prop 이 비므로 판정이 닫힘.
- 2a 의 바인딩 열 실측: Popover 의 overlay 자리 `size` · `placement` · `offset` · `crossOffset` · `shouldFlip` · `containerPadding` · `slot` (읽는 자리 1) · Menu `size` (ActionButton · Popover · Menu — 읽는 자리 3) · Sheet overlay `position` · `swipeDirection` · `snapPoints` · `preventDismissal` · Sheet `overscrollPadding`. 기본 꺼진 template 노드 0 (6 가족).
- 사용자 결정 1 · 2 · 5 · 7 = 권고안. **결정 1 정정**: 질문에서 TagGroup · ActionBar 를 「레퍼런스는 `<TagGroup><Label/><TagList>`」 로 잘못 적었다 — 레퍼런스의 사용 코드는 RAC `TagGroup.md` §Content `<TagGroup label items>{item => <Tag/>}` · S2 `ActionBar.md` `<ActionBar><ActionButton/>…` (안쪽 Label · clear 버튼은 컴포넌트 파일). 판정을 「루트의 직계 자식이 **모두** RAC 요소 slot 자리 (frame · RadioItems · CheckboxItems 아님)」 로 좁혀 Tabs · Table · Card (CardView 안 instance) 만 펼친다 — 같은 template 사실이고 사용자 원칙 (레퍼런스 차이가 있는 가족만) 과 같다. TagGroup · ActionBar 의 `<Slot name="Tags">` · `<Slot name="Actions">` 는 296 모양 그대로.
- 번들 · 생성 시간 기준선은 Phase 4 에서 base worktree (`0d43803f6`) 와 한 번에 대조 (같은 명령 · 같은 기계).

### Phase 1 (G1) — 생성 · 자리 unit

- `files/overrides.ts`: `codeViewExpandedRoot` (판정 한 곳 — 생성 · 역문법 · 패널이 같이) · `codeViewPositionUnit` / `codeViewPositionOf` (attribute · text anchor 의 `nodeId` 자리 참조) · `codeViewPositionBindings` · `codeViewExpandedBoundKeys` · `codeViewAddressOf(…, classOnly)` (자리 키의 역변환은 class 경로만).
- `generate.ts`: `expandedRootOf` (판정 + 표현 가능 조건 — replace · 원본 규칙 off · 바운드 · 작성 글자 · **자기 자식** · 같은 자리 같은 When 규칙 둘이면 접힌 모양) · `writePositions` / `writePosition` · `importType` · `ruleFunction` (자리 handler 와 `overrides` 의 규칙 함수가 같은 모양). 루트에는 자리가 읽지 않는 instance prop 만.
- 역문법: `planElements` 가 `position` anchor 를 unit 으로 (state = owner 포함 — 다른 instance 와 짝 안 됨) · 펼친 instance 의 자식은 자리만 (새 요소 → `readOnlyPosition`) · slot 자리의 자식은 `fillSlot` 자리에 배치 · 새 `<Popover />` 입력은 재생성본의 `<DialogTrigger>` 와 같은 원본이면 통과 (`expandedTypeOf`).
- G1 16/16 (`adr301Expansion.test.tsx`), 원복 RED 13/16 (판정 끔). 기존 테스트 재작성 2 파일 — `adr296LibraryOverlay` (B 의 overlay 태그 단언 → 펼친 모양 · 접힌 instance 의 선언 slot 이름은 TagGroup 으로) · `adr296Component` Card slot (→ `<Content className="content">`). golden 5 · 296 golden 은 변화 없음 (해당 가족 없음 — plants 의 TagGroup 은 판정 정정으로 접힌 모양).

### Phase 2 (G2) — 자리 쓰기

- `planPosition` · `removedPosition` · `hiddenPositions` (재생성 대조는 owner · class · `{false &&` · 개수 감소가 모두 맞는 그 요소만 건너뜀) · 펼친 루트의 `overrides` → `outsideVocabulary` · 중첩 원본 자리의 `overrides` → `planOverrides(…, {unit, prefix})` · 거절 문구 KO/EN + 패널 거절 보고의 「Unlock to edit <Name>」 버튼 (`unlockOrigin` 한 명령). 사용자 결정 3 · 4 = 권고안.
- **296 결함 수리 (같은 Phase — unlock 출구가 G2 조건)**: unlock 된 Library 원본의 Local 파일은 생성기가 `codeViewLibraryReader` 로 class 표를 읽고 planner 는 stage reader 로 읽어 (`lib:` 정의 미해석 → 빈 표) 노드 class 를 작성자 class 로 읽었다 — 그 파일의 어떤 편집도 className 대조로 거절 (Select · Popover · Card 재현, 301 무관). `codeViewApply.ts` 가 planner 에 같은 reader 를 준다.
- G2 18/18 (`adr301Positions.test.tsx` — Heading 글자 · trigger label patch · 바인딩 단독 자리 → instance prop · root L + patch S → patch M · 제거 · Menu 다중 reader → 그 자리 patch · 패널 같은 편집과 문서 동일 · `{false &&}` · 통째 삭제 · 삭제 + 다른 편집 · 다른 숨김 유지 · handler 편집 · 제거 · 격리 · 거절 4 · unlock 뒤 Local 편집 · slot 추가). 원복 RED 4: 키에서 owner 제거 13 RED · 바인딩 분기 제거 1 · 삭제 정규화 제거 3 · unlock reader 원복 1. 어휘표 행 1 (`writePosition` → `planPosition`, `adr296Vocabulary` strict 포함 56/56).

### Phase 3 (G3) — 접기 · Files

- `CodeViewResult.folds` (본체 자리 = 루트 바로 아래 `Modal` · `Popover` · `Tooltip` · `SheetOverlay`, 판정 `catalogOverlayOpen` — 본체 자기 값 > trigger 값, 변수 Open 은 닫힘 = 사용자 결정 6 권고안) · `CodeEditor` `folds` prop (Open 이 바뀐 자리만 `foldEffect` / `unfoldEffect`, 초안이 있으면 적용 보류) · 패널이 baseline 의 folds 를 넘김.
- Files: `catalogStyle` 파일 종류 · `codeViewFileTree` 의 `catalogStyles` 옵션 · 패널의 시트 lazy 로드 삭제 · `fieldCoverage` 파일 목록 정리 · `adr296Style` 단언을 「catalog CSS 0 · Library 파일 유지」 로. `panels/codeView/catalogSheets.ts` 는 참조 0 이 되어 사용자 승인 (2026-11-08) 뒤 삭제.
- G3 12/12 (`adr301Folds.test.tsx` — 6 가족 본체 fold 하나 · Open on/off/defaultOpen · 본체 직접 Open · 변수 Open · 구조형 fold 없음 · 편집기 fold/unfold · 손으로 연 fold 유지). 원복 RED 1 (판정을 trigger 값만으로 → 본체 직접 Open 반례).

### Phase 4 (G4 · G5)

- 번들 (`.cache/adr301-bundle` — base `0d43803f6` · after = base + 301 diff, 두 worktree 각 `pnpm install --frozen-lockfile` · `pnpm -F @composition/builder build` · `adr209-bundle-closure.mjs`): Builder initial JS gz 1,512,523 → 1,512,754 (**+231 B ≤ +256**) · Preview 151,181 → 151,182 (+1 B — `preview-*.js` 안 lazy chunk 파일 이름 hash, 코드 무변). 절대값은 ADR-302 · 303 기록과 같은 로컬 환경 차이라 Δ 만 쓴다.
- 생성 시간 (`adr301GenTime.bench.test.ts`, `ADR301_BENCH=1` — Menu 10 + Popover 10 + Dialog 10 page, median 9): base 3.13 · 2.93 ms (372 줄) → after 4.07 · 3.98 ms (542 줄) = ×1.33 (≤ ×2).
- live 5174 16/16 — 본문 `### Live Exercise`.
- 회귀 대조 (같은 명령, base worktree): builder unit (`src/preview` · `codeView` · `catalogRuntime`) base 297 실패 → after 299 — 차이 2 파일 (`adr256SlotInsertOptions` · `phase4eG5LeafScope`) 은 전체 부하의 5 s timeout, 단독 11/11 PASS. shared base 48 → after 49 — 차이 `g0DescendantRoutes` 1 은 로컬 전용 G0 기준선 파일이 base worktree 에 없어 skip 된 것 (ADR-303 기록과 같음). 301 신규 회귀 0.
- 판독 (reviewer, phase 전체 1 회): HIGH 1 — instance 가 자기 `children` 을 가지면 펼친 뒤 그 page 전체 Apply 가 `readOnlyPosition` (재현 RED → `expandedRootOf` 에 자기 자식 조건 → GREEN). LOW deferred 3: fold 판정이 template 자체 `isOpen` 기본값을 읽지 않음 (표시만) · 채운 slot 아래 template 노드의 `{key}` 도 reader 수에 셈 (patch 쪽으로 기울 뿐 동작 정상) · bench 는 `runIf` 로 평소 skip.
- 수리 검증 (같은 판독자, round 2): HIGH 0 — 판독 루프 닫힘 (`review-loop-closure.md` §1). LOW deferred 1 추가: 코드에서 그 instance 의 **마지막** 자기 자식을 지우면 재생성본이 펼친 모양이 되어 `notInCode` (문서 무손상 · Layers 삭제가 출구).
- 구현 판독 round 3 (codex, 커밋 `c3a484194` 뒤): MEDIUM 1 — 새 `<Popover size="L" />` 입력의 Apply 가 `notInCode` (`size`): 대조가 바깥 root 끼리라 생성기가 자리로 옮겨 쓴 바인딩 prop 을 못 찾음. 재현 RED → 새 펼친 요소의 바인딩 prop 은 그것을 읽는 자리 (`codeViewExpandedBindingProps`) 의 값과 비교 → GREEN · 원복 RED 2 · live 17/17.
