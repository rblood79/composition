# ADR-301 Design Breakdown — 코드 보기의 Library 원본 instance 펼치기

> 본문: [301-code-view-library-instance-expansion.md](../301-code-view-library-instance-expansion.md). 선행: ADR-296 (파일 트리 · anchor 표 · Apply · `overrides` 역문법 · Library 파일) · 285 (identity · 재생성 대조) · 282 (Library 읽기 전용 · `unlockOrigin`) · 278 (오버레이 본체 = slot). **착수 조건: B 수리 (slot 이름 = `slot.name` · 접힌 태그 = 팔레트 type `<Popover>` — RAC import) 가 main 에 있어야 한다 (2026-11-05 메인 세션 완료 · 커밋 대기)** — 이 ADR 의 생성기 변경이 그 코드 위에 쌓인다.

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-11-05 「/create-adr A」)

1. **base / 응용**: ADR-296 = base (파일 트리 · anchor 표 · Apply 다섯 단계 · 역문법 묶음). **ADR-301 = 응용** — 그 틀 안에서 노드 종류 하나 (Library 원본 instance) 의 코드 모양과 그 자리의 역문법을 바꾼다. 문서 스키마 · 명령 변경 0.
2. **schema 직교성**: 문서 스키마는 더하지 않는다. 코드 보기의 anchor 표 (`codeView/types.ts` `CodeViewAnchorTarget`) 에 `position` 한 종류 — 296 anchor 표의 specialization 이라 301 이 296 의 후속이다.
3. **선행 ADR 전제 reverse 검증**: 285 (코드 → 문서 명령, 정본 = 문서) · 282 (Library 읽기 전용 · unlock 명시적) · 281 (instance 몫 = descendant patch · address 규칙) · 278 (오버레이 본체 slot) 의 의존 방향은 그대로 — 301 은 네 결정의 소비자다. 뒤집는 것은 **296 Decision 4 의 「Library instance 몫 = `overrides` prop (파일 경계)」** 한 조각 → 「자리」 경계. 의존 방향이 아니라 코드 모양이고 사용자 지시가 confirm.
4. **판독 전 전제**: 위 세 줄이 여기 있으므로 판독 (phase 당 1 + 수리 1) 은 본문 정합만 본다.

## 2. Phase 0 inventory (착수 때 freeze — 아래는 2026-11-05 설계 초안 실측, main `79a99eb1b`)

### 2a. Library composite 원본 모양 표 (G0 가 157 전부 채운다)

| 원본 (예)                               | template 노드 | slot 자리 (`slot.name`)            | `{key}` 바인딩 자리                                                              | 중첩 Library instance                    | 바운드 행 자리       |
| --------------------------------------- | ------------: | ---------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- | -------------------- |
| Popover (`component-popover`)           |             7 | `content` (frame, OverlayArrow 뒤) | overlay: size · placement · offset · crossOffset · shouldFlip · containerPadding | trigger = Button 원본 instance (`label`) | —                    |
| Tooltip                                 |             6 | `content`                          | 〃                                                                               | trigger                                  | —                    |
| Menu (MenuTrigger)                      |             8 | `Items`                            | —                                                                                | trigger · MenuItem                       | —                    |
| ContextualHelp                          |             8 | `content` · `footer`               | variant · placement …                                                            | Button > Icon                            | —                    |
| Dialog (DialogTrigger > Modal > Dialog) |            10 | `content` · `actions`              | —                                                                                | trigger · Button ×2                      | —                    |
| Tabs                                    |             7 | `Tabs` · `Panels`                  | —                                                                                | Tab 항목                                 | —                    |
| Card                                    |             8 | 영역 4 (ADR-240)                   | —                                                                                | —                                        | —                    |
| Table                                   |            10 | TableHeader · TableBody            | —                                                                                | Column · Row                             | Row (바운드)         |
| Select                                  |            13 | ListBox `Items` (Popover 안)       | label · placeholder · size …                                                     | Label · Button · ListBox · ListBoxItem   | ListBoxItem (바운드) |
| ComboBox                                |            13 | 〃                                 | 〃                                                                               | Group > Input + Button · …               | 〃                   |
| DatePicker                              |             9 | —                                  | 〃                                                                               | Calendar                                 | —                    |

채워야 할 열: 중첩 깊이 최대 (instance 체인 길이) · `interaction` 0 확인 (`reusableOriginLibrary.ts` — 2026-11-05 실측 0) · `enabled:false` 가 기본인 template 노드 (있으면 `{false &&}` 로 나온다).

### 2b. 코드 경로 (바뀌는 곳)

| 층                 | 파일                                                                                                           | 지금                                                               | 301                                                                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성 — 태그        | `packages/shared/src/codeView/generate.ts` `componentTag :2722` · `writeNode :2770`                            | `lib:` 건너뜀 → template 루트 type 하나 (B 뒤: `<Popover>` import) | Library instance 분기 → `writeInstanceTree` (template 트리 재귀 · 투영 값 · slot inline)                                                                                                                                                 |
| 생성 — slot        | `generate.ts :2970-3003` `writeSlots`                                                                          | `<Slot name=…>`                                                    | Library instance 에서는 slot 자리 frame `<div className="<slot>">` 안에 inline · Local instance 는 그대로                                                                                                                                |
| 생성 — instance 몫 | `generate.ts :2587` `overridesCode`                                                                            | `overrides={{…}}`                                                  | Library instance 는 호출하지 않음 (요소 attribute 로)                                                                                                                                                                                    |
| 생성 — 값 투영     | `packages/shared/src/catalog/resolution/resolver.ts :612` `bindTemplateValue` · `templateOwners.ts :67 · :124` | resolver 안                                                        | 코드 보기가 같은 함수를 부른다 (둘째 해석기 금지) — export 가 없으면 export 만 추가                                                                                                                                                      |
| anchor             | `packages/shared/src/codeView/types.ts` `CodeViewAnchorTarget`                                                 | node · attribute(nodeId) · text(nodeId) …                          | `position {ownerId, key}` 추가 · attribute · text 가 `position` 참조를 든다 (`nodeId \| position`)                                                                                                                                       |
| 자리 키            | `packages/shared/src/codeView/files/overrides.ts :103` `codeViewAddressKey` · `:126` `codeViewAddressOf`       | `overrides` · CSS 경로                                             | 그대로 재사용 (B 뒤 slot 이름 반영)                                                                                                                                                                                                      |
| identity           | `packages/shared/src/codeView/inverse/identity.ts`                                                             | unit = nodeId                                                      | unit id 에 `position` 키 허용 (문자열이라 그대로) · kept 짝은 같은 키                                                                                                                                                                    |
| 역문법 — 자리      | `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts :1600` `planOverrides` · 요소 분기 (`:2147 · :2226`)  | `overrides` 객체 → descendant 명령                                 | 요소 분기가 `position` anchor 를 만나면 같은 명령 (`setFields` descendant · `setWholeField(enabled)` · address 규칙 · `insertNodes` descendant 부모) · 바인딩 자리는 instance prop · 구조 변경은 `readOnlyPosition` 거절 + unlock 스니펫 |
| 거절 종류          | `codeViewEdit.ts :202` (`readOnlyFile` …)                                                                      | —                                                                  | `readOnlyPosition` 추가 · 문구 KO/EN (`panels/codeView/codeViewMessages.ts`)                                                                                                                                                             |
| 스타일 경로        | `packages/shared/src/codeView/files/styles.ts :672-681`                                                        | `codeViewAddressKey` 경로 선택자                                   | 무변경 (page 의 `className` 이 같은 키)                                                                                                                                                                                                  |
| 어휘표 · 필드 대조 | `packages/shared/src/codeView/vocabulary.ts` · `fieldCoverage.ts`                                              | Library instance = `overrides` 행                                  | 행 교체 (`position` 요소 · attribute · `{false &&}`) · `read` 실증                                                                                                                                                                       |
| Library 파일       | `packages/shared/src/codeView/files/library.ts`                                                                | 읽기 전용 파일                                                     | 무변경                                                                                                                                                                                                                                   |

### 2c. 기준선 (G0 가 잰다)

- 번들: Builder initial 1,411,708 · Preview 323,910 (ADR-300 G4, 2026-11-03) — B 수리 뒤 HEAD worktree 에서 다시.
- 생성 시간: 가장 큰 page (CMS 22 page 재현) + Select instance 10 개 page (불리 arm) — 측정 조건 (기기 · 4x 여부) 기록.
- golden: 284 fixture 5 (plants · photos · kanban · ios-list · emoji) + 296 golden (`adr296-page.tsx.txt` 등) 의 before.

## 3. Phase

| Phase | 내용                                                                                                                                                                                                                                          | 닫힘    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | B 반영 확인 · inventory 2a 전수 · RED (`adr301Phase0.test.tsx`) · 기준선 2c · 사용자 결정 2 · 3 · 7                                                                                                                                           | G0      |
| 1     | 생성 — `writeInstanceTree` (오버레이 가족 5 먼저 → field · picker → 나머지 전수) · `position` anchor · `overrides` 제거 · golden (Popover · Dialog · Menu · Tooltip · ContextualHelp · Select) + 레퍼런스 구조 동치 테스트 · 전수 왕복 strict | G1      |
| 2     | 역문법 — 자리 분기 (prop · 바인딩 자리 · handler · 삭제 · slot 추가 · 거절 + unlock) · identity `position` · 격리 · 패널 동일 · 원복 RED · 사용자 결정 1 · 4 · 5                                                                              | G2      |
| 3     | 바운드 컬렉션 instance (행 밖 부품) · 컴포넌트 파일 안의 Library instance (template 안 template) · 사용자 결정 6                                                                                                                              | G1 · G3 |
| 4     | 번들 · 생성 시간 · live · 문서 (296 Decision 4 한 줄 · vocabulary · CHANGELOG · 메모리 `project-code-view-is-rac-reference-code` 갱신)                                                                                                        | G4 · G5 |

각 Phase 끝 = commit 가능 상태 (CLAUDE.md §phase 분할). scope inflation 1.5× 이상은 사후 보고.

## 4. 코드 모양 (Popover instance — 사용자 결정 2 · 3 · 7 권고안)

```tsx
// src/pages/Home.tsx — instance `popover_1` (Library origin, size: "L" 작성 · content 에 Switch 2 채움)
<DialogTrigger className="popover">
  <Button className="trigger" label="Settings" />
  <Popover className="overlay" size="L">
    <OverlayArrow className="arrow" />
    <div className="content">
      <Switch defaultSelected>Wi-Fi</Switch>
      <Switch>Mute</Switch>
    </div>
  </Popover>
</DialogTrigger>
```

- `className` = 자리 키의 마지막 segment (`codeViewAddressKey`) — `Home.css` 의 `.popover .overlay { … }` 와 같은 이름.
- `size="L"` 은 instance 가 쓴 값 → 편집하면 instance `props.size` (바인딩 자리). 기본값 (placement 등) 은 생략.
- `label="Settings"` 는 trigger 자리 (중첩 Button instance) 의 patch 또는 instance prop — Button 원본의 `label` 이 `{label}` 바인딩이면 instance 체인 `[popover_1, lib:template:component-popover__trigger]` 의 root prop.
- Switch 둘은 `fillSlot` 의 소유 노드 — 지금처럼 `node` anchor.
- Description 을 지우면 `{false && <Description className="description" …/>}`.

## 5. 거절 표 (Phase 2)

| 편집                                       | 결과                                            |
| ------------------------------------------ | ----------------------------------------------- |
| Popover 에 둘째 자식 (`content` 밖) 추가   | `readOnlyPosition` + unlock 스니펫              |
| `<Popover>` → `<Modal>` type 변경          | 〃                                              |
| trigger Button 을 Popover 뒤로 이동        | 〃                                              |
| Library instance 에 `overrides={{…}}` 작성 | `outsideVocabulary` (301 뒤에는 자리 표현만)    |
| `content` 안 Switch 추가 · 삭제 · 이동     | 받는다 (`fillSlot`)                             |
| 안쪽 prop · handler · 삭제                 | 받는다 (patch · address 규칙 · `enabled:false`) |

## 6. 열린 질문 (execute-adr 때 — 본문 사용자 결정 7 건 외)

- 컴포넌트 파일 (`src/components/<Name>.tsx`) 안 Library instance 의 자리 키는 template 노드 기준 (`instances` 가 template id 로 시작) — `codeViewAddressKey` 가 그 체인을 받는지 Phase 0 에서 확인 (받지 않으면 함수 확장, 새 키 형식 금지).
