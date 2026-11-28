# Changelog

All notable changes to composition will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
엔트리는 버전이 아니라 주제 · 날짜 단위다 (SemVer 미적용 — `.claude/rules/changelog.md`).

> 이전 기록 (전부 append-only):
>
> - [CHANGELOG-2026-10-archived.md](./CHANGELOG-2026-10-archived.md) — 2026-10-03 ~ 10-31 (510 엔트리)
> - [CHANGELOG-2026-09-archived.md](./CHANGELOG-2026-09-archived.md) — 2026-09-01 ~ 09-30 (373 엔트리)
> - [CHANGELOG-2026-Q3-archived.md](./CHANGELOG-2026-Q3-archived.md) — 2026-07-01 ~ 08-31 (346 엔트리)
> - [CHANGELOG-2026-H1-archived.md](./CHANGELOG-2026-H1-archived.md) — 2026-02-22 ~ 06-30 (209 엔트리)
> - [CHANGELOG-2025-archived.md](./CHANGELOG-2025-archived.md) — 2025 + 2026-02-15 이전 in-progress mixed 분량 (2026-05-15 아카이빙)

## [Builder initial 번들 상한 재승인] - 2026-11-28

### Notes

- Builder initial 번들 상한 1,668,000 → **1,672,000** B 재승인 (사용자 결정 2026-11-28, ADR-326 결정 1 — main 이 이미 1,668,315 B 로 315 B 초과 + ADR-326 몫 약 +3,000). Preview 327,000 · 만료 2026-12-25 그대로. `adr201-bundle-gate.mjs` · `deploy.yml` · ADR-201 재승인 절.

## [Canvas — 내용 폭 flex 목록 · 줄바꿈 판정을 Chrome 과 맞춤] - 2026-11-28

### Fixed

- **내용 폭 가로 flex 상자의 폭**: 폭이 내용에 맞춰지는 가로 flex 상자 (절대 위치 · Width fit) 가 Canvas 에서 Preview 보다 좁았다 — 예: StepList S 목록 96 / 115, 라벨 줄바꿈이 갈렸다. 이제 Chrome 과 같은 폭이다.
  - **Why**: 엔진이 폭을 잴 때 항목의 `flex-basis` 길이 (StepList 단계의 `flex: 1 1 0px`) 를 그대로 썼다. Chrome 은 내용 폭을 기여로 쓰고 basis 는 `flex-grow` 0 이면 상한 · `flex-shrink` 0 이면 하한으로만 쓴다 (CSS Flexbox §9.9.1, Chrome 158 실측).
  - 위치: `packages/engine/src/flex.rs` (`resolve_flexible_lengths` Step 0 · `parse_item`)
- **Canvas 글자 줄바꿈 경계**: 칸보다 조금 넓은 글자가 Preview 는 두 줄, Canvas 상자는 한 줄이었다 (StepList S 「단계 2」 30.80 px / 칸 30.33 px).
  - **Why**: Canvas 는 0.5 px 넘게 넘쳐야 줄을 바꿨고 Chrome 은 layout unit (1/64 px) 을 넘으면 바꾼다.
  - 위치: `runtime/boxModel.ts` `CATALOG_LINE_FIT_SLACK` · `compositionRoot.ts` (줄바꿈 판정) · `textMeasure.ts` · `nodeRendererText.ts` · `textParagraphKey.ts`

### Notes

- G3 `adr295PaletteSymmetry` 의 `StepList@S · M · L` 새 실패 3건 (ADR-321 뒤 기준선 밖) 이 해소됐다 — 실패 105 = 기준선.

## [Cascader — Value 칸 드롭다운 · 검색 칸 늘 표시] - 2026-11-28

### Breaking Changes

- **Cascader 의 「Search items」 (`isSearchable`) prop 삭제**: 검색 칸을 늘 표시하므로 스위치를 없앴다. 이미 저장된 값은 읽히지 않는다.
  - 위치: `bindings/Cascader.binding.ts` · `runtime/cascader.components.tsx` · `runtime/delegatedDom.runtime.ts`

### Changed

- Design 패널의 Cascader Value 칸이 고를 수 있는 항목의 드롭다운이 됐다 (Select 와 같다). 항목은 경로 이름 (「Clothing / Men」) 으로 보이고, 「Multiple」 이면 여러 개를 고른다. 「Select any level」 을 켜면 가지 항목도 선택지에 나온다. 전에는 key 를 직접 적는 글자 칸이었다.
- Cascader 를 열면 세 방식 (columns · tree · drill) 모두 검색 칸이 늘 있다. 열었을 때 focus 는 검색 칸에 가고 첫 항목이 가상 focus 를 받는다 (화살표로 바로 이동, drill 의 목록은 Tab).

### Notes

- Builder initial 번들: 이 변경 +60 B (1,668,255 → 1,668,315 B, 같은 작업 트리에서 이 변경만 되돌려 대조). 이 변경 전에도 상한 1,668,000 을 255 B 넘은 상태다 — 배포 workflow 의 상한 검사가 막는다 (상한 재승인 또는 감량 필요).
- ADR-326 (Proposed) 추가 — Cascader 열린 목록을 원본 노드로 (Open 칸 · Canvas 펼침 · 폭 · 테두리 · 경로 줄 간격). 구현 전이다.

## [전체 메뉴에서 패널 선택 후 닫기] - 2026-11-28

### Fixed

- 왼쪽 상단 전체 메뉴에서 패널을 선택하면 패널의 열림 상태가 바뀌고 메뉴가 닫힌다. 검색 결과에서 선택할 때도 같은 동작을 한다.

## [Code Editor 패널 단축키] - 2026-11-28

### Added

- `⌥9` (Windows/Linux에서는 `Alt+9`)로 Code Editor 패널을 열고 닫을 수 있다. 작업 공간 메뉴에도 단축키를 표시한다.

## [Design 패널 Padding · Gap · Radius · Font Size 아이콘 드래그] - 2026-11-28

### Fixed

- 아이콘을 좌우로 끌면 1px씩 조절할 수 있다. 프리셋에서는 잠깐 멈춰 해당 테마 토큰을 선택하고, 계속 끌면 중간값과 XL 이후 값도 설정할 수 있다.

## [MenuItem 항목 역할 — 스위치 없이 바로 편집 · 단축키 수식키 토글 · 패널 행 구조] - 2026-11-28

### Changed

- **항목 역할 (Menu · ActionMenu · ListBox 등의 항목) 을 스위치 없이 그 자리에서 고친다** (사용자 결정): Icon 은 아이콘 고르기 칸 (고르면 보이고 ✕ 는 숨김), Description 은 글자 칸 (쓰면 보이고 비우면 숨김), Label 은 글자 칸 (「Required」 줄 대신 — 빈 글자는 쓰지 않는다). 각 편집은 Undo 한 번.
- **Shortcut = 운영체제별 수식키 토글 + Key 칸**: macOS 는 `⌃ ⌥ ⇧ ⌘` (Apple 순서로 `⇧⌘K`), 그 밖은 `Ctrl · Alt · Shift` (`Ctrl+Shift+K`). 수식키를 하나도 고르지 않으면 단축키가 꺼진다. 토글은 Menu 의 Size · Selection mode 와 같은 seg 모양이고 Key 칸은 같은 행의 액션 칸 (28) 이다. 문서에는 RAC `Keyboard` 의 글자 하나만 저장한다 — 읽어 낼 수 없는 글자는 자유 글자 칸으로 남는다.
- **Property 패널 행 구조 정리** (사용자 지적 — 「다른 fieldset 구조 패턴과 다르다」): 항목 역할을 감싸던 「Item roles」 fieldset 을 없애고 각 칸을 `fieldset-row › fieldset` 로, Content 의 「edited on the <부모>」 안내 문단을 뺐다 (부모가 정하는 칸은 원래 패널에 없다). Component 섹션의 이름 칩 · 버튼 줄은 `fieldset-row` 밖에서 섹션 본문에 바로 선다 (`fieldset-row` 는 fieldset 만 담는다).
  - live (Builder 5173, Chrome · Playwright `menu-shortcut-field-live.mjs` 12/12): Menu · ActionMenu 항목에서 ⌘ ⇧ + k → `⇧⌘K`, 수식키 0 → 꺼짐, ⌥ + p → `⌥P`, Icon 고르기 · ✕ · Description · Label, Publish 메뉴 항목 끝의 단축키 · 설명, 세 섹션의 DOM 구조 (안내 0 · fieldset 겹침 0 · Shortcut 행 = seg + `Key` 액션 칸), Size seg 와 모양 대조 (트랙 · 높이 28 · 버튼 20 · pill).
  - 위치: `catalogRuntime/shortcutText.ts` · `panels/properties/catalog/{CatalogShortcutField,CatalogItemIconField,CatalogItemTextField,CatalogItemRolesSection,CatalogComponentSection,CatalogComponentPropertiesSection,CatalogPropertiesPanel.components}.tsx` · `components/property/PropertyChipGroup.tsx` (`appearance="seg"`) · 회귀 `shortcutText.test.ts` · `phase4eItemRoles.test.tsx`

## [Keyboard (메뉴 단축키) — S2 값 · 팔레트에서 제외 · 「Shortcut」 역할 판정] - 2026-11-28

### Changed

- **Keyboard 모양 = S2 Menu `keyboard`**: 배경 · 테두리 · 모서리 · 좌우 여백을 없애고 글자만 남겼다. 글자는 `ui` (14 · 행간 18), 색은 `gray-600` (`{color.field-placeholder}`) 이다. 전에는 RAC starter `Menu.css` 의 `kbd` 칩 모양 (회색 바탕 · 테두리 · 12px) 이었다 — 예제 CSS 는 권위가 없고, 값의 정본은 S2 설치본이다 (ADR-295).
- **팔레트에서 Keyboard (keyboard shortcut) 를 뺐다** (사용자 결정): S2 에서 Keyboard 는 MenuItem 안에서만 뜻이 있다 (`KeyboardContext` → 항목의 `aria-describedby`). 메뉴 밖에서는 Text 와 같아서, MenuItem 원본의 shortcut 부품으로만 쓴다. 박스로 감싼 키 모양은 keyboard key (`Kbd`) 가 맡는다.

### Fixed

- **MenuItem 의 항목 역할에 「Shortcut」 이 없던 것**: 역할 판정 (`itemRoles.ts`) 이 자식의 `slot` prop 만 읽는데, ADR-256 Phase 5g 에서 단축키가 `Text[slot=shortcut]` 에서 RAC `Keyboard` (slot 없음) 로 바뀐 뒤 행이 빠져 있었다. 이제 자식 type 으로도 역할을 찾는다 (`ROLE_OF_TYPE` — Keyboard → shortcut). 위 항목의 Shortcut 칸 (수식키 토글 + Key) 이 이 행을 읽어 Keyboard 를 켜고 끈다.
  - live (Builder 5173, Chrome · Playwright): 팔레트 Content 에 keyboard shortcut 없음, Menu 놓기 → 첫 항목 선택 → Design 「Shortcut」 행으로 Keyboard 켜기 (당시 스위치 — 위 항목에서 수식키 토글로 바뀜) → 글자 ⌘C → Canvas record (14 · 행간 18 · 여백 · 테두리 · 모서리 0) · Publish 메뉴의 `kbd` (바탕 투명 · 테두리 0 · 14px/18px · `rgb(113, 113, 113)` · 라벨과 8 · `aria-describedby` 연결). Canvas ↔ DOM 상자 하니스 `propAxisCanvasDom` Keyboard 통과.
  - 위치: `componentRulesTable.ts` (Keyboard) · `panels/components/paletteItems.ts` · `catalogRuntime/itemRoles.ts` · 회귀 `d3S2Alignment.static.test.ts` · `paletteItems.test.ts` · `phase4eItemRoles.test.tsx`

## [Builder 패널 안내 — 저장 · 필터 바 거절 이유 · 묶음 행 메뉴 이름] - 2026-11-28

### Fixed

- **저장 · 필터 바 거절이 오류 원문으로 뜨던 것**: Design 패널 · 붙여넣기 · AI 편집이 거절되면 이유를 Builder 언어로 안내한다 (ADR-324 · 320).
  - 「모아서 저장」 의 행마다 보내기에서 연결 셋을 모두 「None」 으로 → 「수정 · 추가 · 삭제 중 연결이 하나는 있어야 합니다」 (전에는 `SAVE_CONNECTION_REQUIRED: entry.save.send`). 버전 필드가 표에서 사라진 경우도 같다 (`SAVE_VERSION_FIELD_MISSING`).
  - 필터 바의 목록 연결 거절 4개 (`FILTER_TARGETS_HOST` · `SELF` · `TAKEN` · `COLLECTION`).
  - **Why**: 패널 명령의 거절은 `operationNotice.ts` 의 코드 표에 있어야 안내가 되는데 이 코드들이 빠져 있어, `commandRunner` 가 오류 원문을 error toast 로 냈다 (i18n 감사 2026-11-28).
  - 모양 오류 `INVALID_SAVE_*` 는 패널 선택 칸으로 만들 수 없어 다른 `INVALID_*` 처럼 원문으로 둔다.
- **필터 바 시작 조건의 묶음 행 메뉴 이름**: 「g1 actions」 처럼 원시 id 였던 것을 「Group (1 condition) actions」 · 「묶음 (조건 1) 동작」 으로. Builder 영어 패널의 「Group (1 conditions)」 도 단수 · 복수를 가린다.
  - live (Builder 5173, Chrome): `site-language-texts-live.mjs` 11/11 — 3c 가 Design 패널 메뉴 이름을 읽는다.
  - 위치: `catalogRuntime/operationNotice.ts` · `panels/properties/catalog/CatalogFilterBarFields.tsx` · `i18n/messages/{en-US,ko-KR}.ts` · `i18n/types.ts` · 회귀 `catalogRuntime/__tests__/operationNoticeSaveFilter.test.ts`

### Documentation

- ADR-320 · 322 breakdown 의 「en · ko · ja · zh」 문구를 en · ko 로 (2026-11-28 ja · zh 제거 결정).

## [사이트 언어 i18n — ADR-320 · 321 · 324 · 325 문구 · en · ko 로 정리] - 2026-11-28

### Fixed

- **사이트 언어를 따르지 않던 문구**: Site 설정의 Language 가 ko 여도 영어 · 한국어로 고정되던 문구가 사이트 언어를 따른다.
  - FilterBar: 「Add filter」 · 「Edit conditions」 · 「Clear」 버튼, 칩의 「조건 메뉴」 · 「조건 삭제」 이름, 연결 전 표본 칩 (「필드 포함 값」). 원본 template 의 글자는 사이트 언어를 바꾸면 바로 바뀐다 (원본 노드의 `localizedProps` — 검증 · resolver · 놓을 때 복사가 같은 함수를 읽는다).
  - Stepper: 단계 이름 · 패널 내용 (「단계 1」 · 「단계 1 내용」), Design 「+」 가 넣는 단계 (「단계 4」).
  - 「모아서 저장」: 저장 결과 Toast (「저장 1건」 · 「1 saved」) 와 행 사유는 사이트 언어로 (전에는 한국어 고정), 저장 막대 문구 8개는 Builder 언어가 아니라 사이트 언어로 쓴다. 판정 모듈은 사유 코드를 내고 그릴 때 문구를 고른다 — 코드가 아닌 사유 (`HTTP 412` · 서버 글자) 는 그대로.
  - FilterBar 「Saved filters」 「+」 의 기본 이름 (「저장된 필터 1」 — 전에는 Builder 언어).
  - 페이지에 복사되는 글자 (놓은 Stepper 의 단계 · 저장 막대 · 「+」 항목) 는 넣는 순간의 사이트 언어로 한 번 쓰인다 — 뒤에 언어를 바꿔도 다시 번역하지 않는다.
- **칩 문구**: 「Group (1 condition)」 단수 · 복수, 숫자 (「1,234.5」) 와 날짜 필드 값 (「2026. 11. 5.」 · 「Nov 5, 2026」) 을 사이트 언어의 서식으로, 한국어 비교어는 조사 없이 「다음으로 시작」 · 「다음으로 끝남」 · 「다음 중 하나」. Rating 의 낭독 값도 사이트 언어의 숫자 서식.
- **사이트 언어가 비어 있을 때**: 우리 문구도 RAC · Canvas 처럼 브라우저 언어를 따른다 (전에는 우리 문구만 영어 — 한 화면에 두 언어가 섞였다).

### Changed

- 사이트 문구 번역 표는 en · ko 두 언어만 둔다 (사용자 결정 2026-11-28) — 25 개 파일의 ja · zh 항목 삭제, 그 밖의 언어는 영어. 언어별 동작 값 (CJK 행간 · RAC 날짜 자리 표시 · 주 시작 지역) 은 그대로.
- live (Builder → Publish, Chrome · 브라우저 ko-KR): `site-language-texts-live.mjs` 10 / 10 · ADR-324 G5 `SITE_LANG=ko` 16 / 16 · 영어 16 / 16.

## [ADR-322 · Cascader 필수 제출과 원격 계층 선택 수리] - 2026-11-28

### Fixed

- 필수 Cascader가 화면에 나타나는 첫 순간부터 빈 값 제출을 막고 여는 버튼으로 포커스를 옮긴다.
- 끝 항목만 허용하면 아직 펼치지 않은 원격 가지도 규칙의 ‘값 넣기’를 거절한다. 값 필드를 컬렉션 키와 다르게 지정해도 하위 단계는 행 키로 조회하고, 폼에는 선택한 필드의 값을 싣는다.
- 같은 단계의 key가 `07`, `07`, `07#1`이면 중복된 두 항목만 비활성화하고 `07#1`을 선택할 수 있다.

## [ADR-322 Phase 6 · Implemented — Cascader 폼 값 · 필수 검증 · 단계별 원격 로드] - 2026-11-27

### Added

- **폼 값**: Cascader 에 「Name」 을 주면 Form 제출에 고른 key 가 실린다 (다중이면 같은 이름으로 여러 값, 비면 빈 값 하나). 비활성 필드는 싣지 않는다. 「Required」 인 필드는 native Form 에서 비어 있으면 제출을 막고 오류를 보이며 여는 버튼에 focus 를 준다 (aria Form 은 막지 않는다). 폼 reset 은 시작 값으로 돌아간다.
- **단계별 원격 로드**: Data 패널의 endpoint 편집기에 「단계 전체에서 key 유일」. 이 선언이 있고 조회가 `{{ parentKey }}` 를 읽으면 (비면 첫 단계) Cascader 가 가지를 열 때 그 단계만 묻는다 — 오기 전에는 「불러오는 중…」, 실패하면 「불러오지 못함 — 다시 시도」. 연결의 새 역할 「하위 항목 있음 필드」 (boolean) 로 끝 항목을 미리 알릴 수 있다. 검색은 불러온 항목에서만 찾고 그렇다고 보인다. 선언과 달리 다른 단계에서 이미 받은 key 가 오면 두 항목을 고를 수 없고, 값이 그 key 면 비우며 콘솔에 「서버 계약 위반」 을 남긴다. 선언이 없으면 단계별로 묻지 않는다 (첫 응답만).
- live (Builder → Publish, 원격 응답은 하니스 route): Chrome 8 / 8 · WebKit 8 / 8.
- 번들: Builder 첫 화면 +289 B (Phase 1 ~ 6 합계 +5,824 B — 몫 +6,000 안, 절대 상한 1,668,000 B 안). 폼 실행 부품은 열 때 불러온다.

## [ADR-322 Phase 5 — Cascader 검색 · 다중 · 「어느 단계든」 · 규칙] - 2026-11-27

### Added

- Cascader 에 「Search items」 (항목 검색) · 「Selection Mode」 · 「Select any level」 (어느 단계든 고르기) 이 생겼다.
  - **검색**: 열면 맨 위에 검색 칸. 입력하면 단계 대신 고를 수 있는 항목 중 이름에 그 글자가 든 것이 이름 + 경로 (「역삼동 — 서울 / 강남구 / 역삼동」) 로 한 목록에 나온다. 한글은 음절로 찾는다 (「가남」 이 「각남」 을 찾지 않는다). 200 건까지, 넘으면 「N 건 더 — 더 입력해 좁히기」. Enter 가 첫 결과를 고른다.
  - **다중**: 값은 고른 항목의 key 목록. 닫힌 필드는 하나면 경로, 둘 이상이면 「2개 선택됨」 (Select 와 같은 글자). 가지를 고르면 그 가지 하나다 (하위 항목을 같이 고르지 않는다). columns 는 고르고도 목록이 열린 채.
  - **어느 단계든** (기본 꺼짐 — 끝 항목만 값): 켜면 가지도 값이 된다. columns · drill 은 하위 단계 맨 앞의 「<가지> 전체」 를, tree 는 행을 고른다. 꺼져 있으면 가지와 끝 항목이 같은 key 여도 겹치지 않는다 (단계마다 id 가 1 부터인 표).
- Interactions: When 「값이 바뀔 때」 · 「열림 변경」, Do 「값 넣기」 · 「지우기」 · 「열기 · 닫기」, 이름 붙인 상태 = 값 (다중이면 key 목록). 한 항목을 가리키지 않는 key 와, 끝 항목만 고르는 필드에 가지 key 를 쓰는 「값 넣기」 는 거절되고 콘솔에 남는다.
- live (Builder → Publish): Chrome 7 / 7 · WebKit 7 / 7 (Design 패널 라벨 · 검색 · 다중 · 어느 단계든 · 규칙 · HC5 · page error 0).
- 번들: Builder 첫 화면 +1,114 B (Phase 1 ~ 5 합계 +5,535 B — 몫 +6,000 안, 절대 상한 1,668,000 B 안). 검색 · 열린 목록은 열 때 불러온다.

### Changed

- 5,000 항목 · 4 단 Cascader 를 여는 시간: tree 는 펼친 가지의 항목만 목록에 넣고, columns 는 하위 목록을 열 때 만든다 — Chrome 4x 에서 tree 550 → 81 ms · columns 344 → 73 ms (같은 문서 Select 1,000 행 열기 383 ms).

## [ADR-322 Phase 4 — Cascader 데이터 연결] - 2026-11-27

### Added

- Cascader 를 데이터 표에 연결한다 — 「Data source」 에서 표를 고르고 Tree 처럼 「하위 항목 필드」 (중첩) 또는 「부모 ID 필드」 (평면) 를 고르면 단계가 선다. 단계마다 다른 표 (대분류 표 · 중분류 표 …) 는 안쪽 단계 항목에 자기 표를 연결하고 「상위 단계 필드」 (위 단계 항목의 key 를 가진 필드) 를 고른다. 값은 행의 key 다.
  - Preview · Publish 는 Cascader 의 행을 「더 보기」 창 없이 전부 읽는다 (첫 단계 120 행도 경로가 선다). Builder Canvas 는 다른 목록처럼 표본 행만 읽는다.
  - key 가 둘 이상의 항목에 있으면 그 항목들은 고를 수 없고, 필드 설명 자리에 「고를 수 없는 항목 N 개 — key 가 겹친다」, Design 패널에 「값 필드를 유일한 필드로 바꾼다」 가 나온다. 그런 key 의 시작 값은 key 그대로 보이고 콘솔에 거절이 남는다 (첫 항목으로 맞추지 않는다). 규칙의 값 쓰기도 같은 판정으로 거절한다.
  - live (Builder → Publish): Chrome 6 / 6 · WebKit 6 / 6.
- 번들: Builder 첫 화면 +1,125 B (Phase 1 ~ 4 합계 +4,421 B — 몫 +6,000 안, 절대 상한 1,668,000 B 안).

### Fixed

- Cascader `tree` · `drill` 의 고른 행 글자색이 accent 바탕 색 (`--accent`) 이던 것을 글자 역할 (`--accent-content`) 로 (ADR-290). Code 보기가 Cascader 를 `items` 목록으로 쓰지 않는다 (RAC 컴포넌트가 아니다).

## [Library 테마 카드 — Colors 견본 24 × 24 · Typography · Spacing 카드 제거] - 2026-11-27

### Changed

- **Library 의 Colors 카드**: 색 견본을 44 → 24px 정사각 (모서리 4) 로 줄이고 견본 아래 hex 줄을 뺐다 — 이름 한 줄만 남는다. 값은 견본을 고르면 Design 패널에서 읽는다.
  - **Why**: 사용자 2026-11-27 「color 와 font size 가 공간을 너무 차지」 → 「견본 격자, hex 빼기, 크기도 24*24」. 44px 견본 + 캡션 두 줄로 카드가 1440px 였다.

### Removed

- **Library 의 Typography · Spacing 카드**: 테마 카드는 Colors 하나만 남는다 — 그 뒤에 바로 컴포넌트 카드 (Badge …) 가 온다. 글자 크기 단계는 Themes 패널 Typography 에서 본다.
  - **Why**: 사용자 2026-11-27 「typo, spacing 은 빼도 되지 않을까」 — 두 카드는 보기만 하는 표였고 첫 줄을 1,319px 로 늘렸다.
  - live (Builder 5173 새 프로젝트 → Library, Chrome): Layers 가 Colors → Badge 순, 첫 줄 높이 1,440 → 948px (Colors 카드).
  - 위치: `catalogRuntime/componentsPage.ts` · 회귀 `catalogRuntime/__tests__/phase4eOriginView.test.ts` · `phase4eTheme.test.tsx`

## [페이지의 Select — placeholder 자리 빗금 제거] - 2026-11-27

### Fixed

- **페이지에 놓은 Select instance 의 값 칸**: Canvas page 의 Select 가 placeholder 「Choose an option...」 자리를 빈 slot 빗금으로 덮지 않는다.
  - **Why**: 바로 앞 수정 (Library 카드) 이 「비어 있어도 자기 글자를 그리는 slot」 예외를 Components 화면에만 걸었다 (`components &&`). 이제 그 slot 은 어느 화면에서도 빈 자리가 아니다 — page 는 표시 없음, 정의 보기는 빗금 없는 테두리.
  - live (Builder 5173 새 프로젝트 → 팔레트 select, Chrome): page 의 Select 값 칸에 빗금 없음.
  - 위치: `workspace/canvas/catalog/catalogChrome.ts` `catalogSlotMarks` · 회귀 `catalogRuntime/__tests__/librarySlotFallback.test.ts` (page instance 케이스 — 수정 전 RED)

## [Library 카드 — Select placeholder 자리의 빗금 제거] - 2026-11-27

### Fixed

- **Select ◆ 원본의 값 칸**: Library 의 Select 카드가 placeholder 자리를 160 × 40 빗금 상자로 덮지 않고 「Choose an option...」 을 원래 크기로 그린다 (Select 를 품은 다른 원본 안의 값 칸도 같다).
  - **Why**: S2 `renderValue` 를 옮기며 (`a581078d3`) SelectValue 가 `value` slot 이 됐는데, ◆ 카드는 비어 있는 slot 을 모두 「채울 빈 자리」 로 상자 · 빗금 처리했다. 이 slot 은 비어 있어도 placeholder 를 그린다 — 비어 있을 때 자기 글자를 그리는 slot 은 상자 · 빗금에서 뺀다 (`catalogSlotDrawsOwnContent`).
  - live (Builder 5174 새 프로젝트 → Library, Chrome): Select 카드에 빗금 없음 · Select 선택 412 × 60. 다른 빈 slot 의 빗금 58 개는 그대로 (단위).
  - 위치: `catalogRuntime/originView.ts` · `catalogRuntime/componentsPage.ts` · `workspace/canvas/catalog/catalogChrome.ts` · 회귀 `catalogRuntime/__tests__/librarySlotFallback.test.ts`

## [Library 카드 — 원본 옆 「채운 instance」 제거 (모든 카드)] - 2026-11-27

### Changed

- **Library 카드의 ◇ instance**: Navigator → Components → Library 의 카드는 ◆ 원본만 그리고, slot 을 채운 ◇ instance 를 옆에 두지 않는다 — ActionBar · StepList · Stepper · SegmentedControl · SelectBoxGroup · ResizablePanelGroup · FilterBar · ActionButtonGroup · ColorSwatchPicker 카드에서 빠졌다.
  - **Why**: 2026-10-25 사용자 결정 「instance 객체 삭제」 를 컴포넌트 이름 목록 (`ORIGIN_ONLY_CARDS`) 으로 적용해, 그 뒤에 추가된 원본에는 instance 가 다시 붙었다. 목록과 instance 칸을 지워 모든 카드에 적용한다.
  - live (Builder 5173 새 프로젝트 → Library, Chrome): 9 개 카드 모두 Layers 에 제목 + ◆ 원본 한 줄만.
  - 위치: `catalogRuntime/componentsPage.ts` · 회귀 `catalogRuntime/__tests__/libraryOriginOnlyCards.test.ts`

## [ADR-322 Phase 3 — Cascader 의 tree · drill 방식] - 2026-11-27

### Added

- Cascader 「Mode」 의 `tree` (제자리 펼침 — 고른 항목의 조상이 펼쳐진 채 열린다) 와 `drill` (한 번에 한 단계 — 맨 위 경로 줄 · 「뒤로」 · 행을 누르면 다음 단계, 끝 항목이면 고르기). 열면 목록 안으로 focus 가 들어가고 Esc 로 닫힌다. 어느 방식이든 같은 항목은 같은 값이다.
  - 큰 계층은 tree 가 보이는 행만 그린다 (RAC Virtualizer — Phase 0 측정). 열린 내용은 방식마다 처음 열 때 불러온다.
  - live (Builder → Publish): Chrome 6 / 6 · WebKit 6 / 6.
- 번들: Builder 첫 화면 Phase 1 ~ 3 합계 +3,296 B (절대 상한 1,665,000 B 안 — 결정 8 의 +3,000 은 296 B 넘어 사용자 보고). 사용자 답으로 몫 +6,000 (Phase 1 ~ 6) · Builder 절대 상한 **1,668,000 B** 재승인 (만료 2026-12-25 그대로).

## [ADR-322 Phase 2 — Cascader 의 columns 방식 (열기 · 단계 이동 · 고르기)] - 2026-11-27

### Added

- Preview · Publish 에서 Cascader 를 누르거나 Enter 로 열면 첫 단계 메뉴가 뜨고, 하위 항목이 있는 항목 (오른쪽 chevron) 은 → 또는 마우스를 올려 다음 단계를 옆에 펼친다 (← 로 한 단계 닫힘 · Esc). 끝 항목을 고르면 닫히고 값 글자가 고른 경로가 되며 focus 는 필드 버튼으로 돌아온다. 다시 열면 고른 항목이 체크로 보인다. key 가 다른 항목과 겹치는 항목은 고를 수 없다.
  - 조립은 RAC `Menu` · `SubmenuTrigger` 와 react-aria `useMenuTrigger` — 직접 쓰는 role · aria · 키 처리 없음 (정적 검사). 열린 메뉴는 처음 열 때 불러온다.
  - live (Builder → 팔레트 → Publish): Chrome 6 / 6 · WebKit 6 / 6 (키보드 전 경로 · 접근성 스냅샷 · 포인터).
- 번들: Builder 첫 화면 Phase 1 + 2 합계 +2,727 B (절대 상한 1,665,000 B 안).

## [ADR-322 Phase 1 — Cascader (여러 단계를 파고드는 선택 필드) 등록 · 닫힌 필드] - 2026-11-27

### Added

- 팔레트 「cascader」 (ComboBox 옆): 놓으면 Select 와 같은 닫힌 필드 (라벨 행 · 여는 Button · 설명 · 오류 문구) 와 세 단계 표본 항목 (`CascaderItem` 11 개 — Canvas 에는 그리지 않는다) 이 선다. 시작 값 (`defaultValue` = 항목 key) 이 있으면 Canvas 와 Publish 가 같은 글자로 고른 경로 전체 (「Electronics / Computers / Laptops」 — 사용자 결정 7) 를, 「Display: Leaf」 면 끝 항목 이름을 보인다. key 를 가진 항목이 없거나 둘 이상이면 key 를 그대로 보인다 (다른 항목으로 맞추지 않는다). 방식 (`mode`) 의 기본은 `columns` (사용자 결정 1) — 열리는 동작은 Phase 2.
- Publish 의 여는 Button 은 RAC 가 받는 prop 으로 값 + 라벨을 이름으로, 설명 · 오류 문구를 `aria-describedby` 로 잇는다. 필드 요소에 role · aria 속성을 직접 쓰지 않는다 (HC2).
  - live (Builder 5173 → 팔레트 → Publish, Chrome): 다섯 상태 (기본 · 시작 값 · L 끝 항목 · Side S · 비활성 + 오류 + 설명) 의 상자 ±1 px · 값 글자 · Button 바탕 픽셀 · 접근성 이름 19 / 19.

### Changed

- 문서 contract 86 → **87** (옛 86 문서는 열리지 않는다 — 변환 없음).
- Builder 첫 화면 번들 절대 상한 1,662,000 → **1,665,000 B** (사용자 재승인 — ADR-322 결정 8, 만료 2026-12-25 그대로). Phase 1 몫 +2,169 B (1,663,284 B).
- 위치: `docs/adr/322-cascader-hierarchical-picker.md` · `docs/adr/design/322-cascader-hierarchical-picker-breakdown.md` §8

## [ADR-320 Implemented — 필터 바 (칩 줄 · 조건 빌더 · 서버 후보 값)] - 2026-11-27

### Fixed

- 원격 목록에서 필터 칩을 열고 그대로 적용해도 기존 비교와 값을 유지한다. 브라우저가 기억한 필터를 복원한 뒤 규칙으로 조건을 추가하면 두 조건이 함께 적용된다.
- 규칙 편집기는 다중 선택 값을 배열로 저장하고, 「필드의 조건 지우기」는 중첩 묶음에서도 해당 조건을 지운다. 상대 날짜 조건을 편집할 때는 그 기간 안팎의 날짜를 모두 후보로 볼 수 있다.

### Changed

- ADR-320 을 닫았다 (사용자 지시 「Implemented 로 올리고, 본문을 completed/ 로」). 필터 바 세 개 (로컬 · `suffix` · `body` collection) 를 Builder 에서 넣고 Publish 에서 조건 추가 · 후보 값 고르기 · 서버 후보 값 검색 · 여러 목록 동시 거르기를 Chrome · WebKit 에서 확인했다 (9 / 9).
  - 조건 변경 → 표시 1x 첫 클릭 184 ms (기준 169) 는 사용자 결정 「A로 진행」 으로 받아들였다.
  - VoiceOver 청취는 하지 않았다 — 자동 근거는 Chrome 접근성 트리와 정적 D1 검사까지다.
  - 위치: `docs/adr/completed/320-filter-bar-runtime-condition-builder.md` · `docs/adr/README.md`
- Builder 첫 로드 번들은 320 합계 ≈ +8,985 B (1,660,959 / 절대 상한 1,662,000 B).

## [ADR-321 Implemented — StepList · Stepper · Rating] - 2026-11-27

### Changed

- ADR-321 을 닫았다. 단계 입력 화면 하나 (Stepper 3 단계 — Form 제출 → 평점 입력 → 집계 표시) 를 Chrome · WebKit 에서 처음부터 끝까지 확인했고, VoiceOver 로 단계 목록 · 평점 입력 · 집계 낭독을 들어 확인했다. 단계 사이를 오가도 입력한 평점이 남는다.
- Builder 첫 로드 번들은 두 컴포넌트 합 +8,589 B (사용자 답으로 확정 — 절대 상한 1,662,000 B 안).

### Fixed

- StepPanel 안에 별도 StepList를 넣고 그 단계를 삭제해도 바깥 Stepper의 패널과 내용이 보존된다. 단계 목록을 Frame으로 묶은 뒤에도 단계 추가와 키 변경이 짝 패널에 반영된다.
- 표시 전용 Rating을 입력 모드로 바꾸면 별, 폼 값, 이름 붙인 상태가 같은 정수로 바뀐다. 3.5점에서 전환하면 세 곳 모두 4점이다.

## [ADR-321 Phase 5 — Rating 의 동작 (별 누르기 · 폼 값 · 표시 전용 낭독)] - 2026-11-27

### Added

- Preview · Publish 의 **Rating** 이 입력을 받는다 — 별을 누르면 그 별까지, 화살표로 한 칸씩, 0 까지 줄이면 지워진다. 마우스를 올리면 그 별까지 채워 미리 보여 준다 (값은 그대로). 키보드 focus 는 별 줄에 테두리로 보인다.
- Rating 의 Properties 에 **Label** (낭독 이름) · **Name** (폼 값의 이름). Form 안의 Rating 은 제출 때 `name` = 별 수를 보낸다.
- Interactions 에 Rating 의 When 「변경」 · 「변경 끝」, Do 「값 넣기」, 이름 붙인 상태 (값). 「값 넣기 2.5」 는 입력에서 3, 표시 전용에서 2.5 를 쓴다.
- 표시 전용 Rating 은 「5점 만점에 N점」 으로 읽힌다 (백분율이 아니다).

### Fixed

- Slider 에 단계 사이 값을 넣는 Do (「값 넣기 2.5」, 단계 1) 의 이름 붙인 상태가 2.5 로 남고 Slider 는 3 을 보이던 것 — 상태도 3 이다.
- Publish 에서 catalog 가 숨기거나 크기를 정한 svg · img 를 앱 reset (`display: block` · `max-width: 100%`) 이 덮던 것 — reset 을 가장 낮은 layer 로 옮겨 Builder Preview 와 같다.

## [ADR-321 Phase 4 — Rating (별점)] - 2026-11-27

### Added

- 팔레트 Forms 에 **Rating** (Slider 다음) — Spectrum 별점. 별 다섯 (고정), 크기 S · M, 강조 · 비활성 · 표시 전용. 값은 0 ~ 5 이고 입력은 정수 별, 표시 전용은 반쪽 별 (0.5 단위) 까지 그린다. Canvas 와 Preview · Publish 가 같은 별을 그린다. 누르기 · 키보드 · 폼 값은 다음 단계 (Phase 5).

## [ADR-321 Phase 3 — Stepper (단계 목록 + 단계별 패널)] - 2026-11-27

### Added

- 팔레트 Layout 에 **Stepper** — StepList 와 단계마다 내용 패널 (`StepPanel`) 을 한 묶음으로 둔다. 지금 단계의 패널만 보이고, 실행 중 단계를 누르거나 규칙의 「다음 단계」 (예: Form 제출) 로 단계가 바뀌면 그 패널로 바뀐다. 패널은 Step 과 key 로 짝이라 단계의 「+」 · 삭제 · 복제 · key 수정이 짝 패널을 같이 다룬다 (Undo 한 번).

### Fixed

- Step 의 key (Item ID) 를 고치면 그 StepList 의 현재 단계 · 마지막 완료 단계 · 비활성 단계 값도 같이 고쳐진다 — 전에는 현재 단계의 key 를 고치면 현재 단계가 첫 단계로 돌아갔다.
- 「+」 로 넣은 단계의 이름이 「Item N」 이 아니라 「Step N」 이다.

## [Data 패널 — 긴 API 응답의 스키마 감지] - 2026-11-27

### Fixed

- API 응답이 2 KiB를 넘어도 스키마 탭에서 전체 JSON의 행 배열과 열을 감지하고 테이블로 저장할 수 있다. 기존 데이터 경로가 응답의 배열을 가리키지 않으면 감지한 배열 경로를 선택한다.

## [필터 바 — 서버 후보 값 · 여러 목록의 요청 (ADR-320 Phase 6)] - 2026-11-27

### Added

- API 연결 (조회 형식 「body」) 의 「Candidate values (facet)」 스위치 — 켜면 필터 바 · 열 메뉴의 값 편집기가 후보 값을 서버에 묻는다 (`{ where, facet: { field, search, cursor } }` → `{ items: [{ value, count }], nextCursor }`). 쪽 단위로 받는 표에서도 아직 불러오지 않은 행의 값을 고를 수 있다. 값 검색은 입력을 멈춘 뒤 0.25 초에 서버로 가고, 목록 끝에서 다음 값을 이어 불러온다. 스위치를 켜지 않은 연결은 지금처럼 불러온 행 기준이다.

### Changed

- 필터 바 하나가 작성자 조건이 다른 두 목록을 거를 때 각 목록의 요청이 자기 조건과 막대 조건을 함께 싣는다 (같은 collection — 대조 테스트 · live 로 확인).

### Performance

- **조건 변경 → 표시 (HC6, 10,000 행 · production)**: 4x p95 408 ~ 464 ms (기준 556 ~ 589 안) · 1x p95 184 ms (기준 169). 1x 에서 기준을 넘는 것은 18 클릭 중 첫 클릭 하나이고 나머지는 144 ms 이하다.
  - 사용자 결정 「A로 진행」 — 첫 클릭의 +15 ms 는 수리하지 않고 받아들인다. 보이는 행 먼저 그리기 (ADR-315 Phase 3) 는 이 경로에 이미 걸려 있고, 첫 실행 비용이 React commit · composition root · 조건 첫 평가 · 행 투영에 나뉘어 있어 한 곳을 고쳐 줄일 근거가 없다.
  - 위치: `docs/adr/design/320-filter-bar-runtime-condition-builder-breakdown.md` §9 Phase 6

## [필터 바 — 기억 · 주소 · 저장된 필터 · 상대 날짜 · 상태 연동 (ADR-320 Phase 5)] - 2026-11-27

### Added

- Publish 의 주소에 필터 바의 조건이 실린다 (`#/경로?f.…`) — 링크를 받은 사람이 같은 조건으로 보고, 뒤로 가기가 앞 조건으로 돌아간다. 조건만 바뀌면 브라우저 기록을 쌓지 않는다.
- 필터 바 「Remember filters」 를 켜면 Publish 의 그 브라우저가 조건을 기억해 다음에 열 때 이어서 보여 준다 (Builder Preview 는 기억하지 않는다).
- 필터 바의 「Saved filters」 메뉴 — 작성자가 패널에서 만든 이름 붙인 묶음을 고르면 그 조건으로 바뀐다. 묶음이 없으면 버튼이 없다.
- 날짜 조건의 값에 「오늘 · 어제 · 이번 주 · 지난 주 · 이번 달 · 지난 달 · 올해」 — 값 편집기와 패널의 「날짜」 에서 고르고, 날이 바뀌면 따라간다. 주의 시작은 사이트 언어를 따르고, 서버에는 그날의 날짜로 보낸다.
- Interactions: 필터 바의 Do 「조건 추가」 · 「필드의 조건 지우기」 · 「조건 전부 지우기」, When 「필터가 바뀔 때」 (`!event.count`), 이름 붙인 상태 = 적용된 조건 수.

### Changed

- 주소 · 기억 · 저장된 필터로 들어온 조건도 시작 조건처럼 판정한다 — 지워진 필드를 읽는 묶음은 통째로 빼고 「적용하지 못한 조건 N」 을 알린다. 받지 않는 조건을 넣는 Do 는 실패로 보고한다.
- 문서 형식 contract 86 (옛 85 문서는 열리지 않는다 — 변환 없음). Builder 첫 화면 번들 절대 상한 1,660,000 → 1,662,000 B (사용자 재승인).

## [필터 바 조건 빌더 — 묶음 · 「그리고 · 또는」 · 중첩 · 순서 바꾸기 (ADR-320 Phase 4)] - 2026-11-27

### Added

- Preview · Publish 의 필터 바 「조건 편집」 이 조건 빌더를 연다 — 조건과 묶음이 나무 모양으로 보이고, 묶음마다 「그리고 · 또는」 을 바꾼다. 「조건 추가」 · 「묶음 추가」, 묶음 메뉴 (조건 추가 · 묶음 추가 · 묶음 풀기 · 복제 · 위로 · 아래로 · 삭제), 조건 메뉴 (복제 · 끄기 · 묶음으로 감싸기 · 위로 · 아래로 · 삭제). 행을 끌어 순서와 소속을 바꾼다 (마우스 · 키보드). 묶음은 3 단까지 만든다.
- 묶음 칩의 메뉴에 「조건 편집」, 필터 바 Variant 「Builder」 는 칩 자리에 빌더를 바로 둔다.
- 데이터 공급 방식이 묶음을 보내지 못하는 목록 (쪽 단위 원격 · 접미사 형식) 의 필터 바는 묶음 기능을 내지 않는다.

## [필터 바 칩 줄 — 실행 중 조건 추가 · 비교 · 값 · 끄기 · 지우기 (ADR-320 Phase 3)] - 2026-11-27

### Added

- Preview · Publish 의 필터 바가 연결한 목록을 실제로 거른다 — 시작 조건이 첫 화면의 칩이고, 칩 줄에서 조건을 더하고 고친다. 「필터 추가」 = 필드 검색 메뉴 (참조 필드는 하위 메뉴) → 비교 메뉴 → 값 편집기. 칩마다 비교 · 값 버튼, 조건 메뉴 (복제 · 끄기 / 켜기 · 삭제), 삭제 버튼. 「지우기」 는 시작 조건으로 되돌린다. 키보드만으로 모든 단계를 할 수 있다.
- 한 막대의 목록 (Table · ListBox …) 이 같은 조건 하나를 읽는다 — Table 열 메뉴에서 넣은 필터가 칩으로 보이고, 칩에서 고친 열 조건을 열 메뉴가 읽는다. 데이터 공급 방식이 받지 못하는 조건은 빼고 막대 끝에 「적용하지 못한 조건 N」 을 보인다.

### Changed

- 필터의 후보 값은 편집 중인 조건 하나만 빼고 센다 — 같은 필드의 다른 조건과 작성자 조건은 그대로 적용된다 (Table 열 메뉴 포함).

## [StepList 컴포넌트 — 단계 표시와 이동 (ADR-321 Phase 1 · 2)] - 2026-11-27

### Added

- 팔레트 `StepList` (Spectrum StepList) — 단계 `Step` 셋으로 시작한다. 단계마다 이름 · 설명 한 줄 · 상태 표식을 그리고, 단계를 누르면 그 단계로 간다 (RAC Link — 지금 단계는 `aria-current`).
- 「자유 이동」 스위치 (`allowsFreeNavigation`, 기본 꺼짐 = v3 와 같은 선형 이동). Interactions 에 When 2 (단계 변경 · 완료 단계 변경) · Do 4 · 이름 붙인 상태 2 (지금 단계 · 마지막 완료 단계).

### Changed

- 문서 contract 82 → 83 (StepList · Step 정의 · 원본).

## [필터 바 컴포넌트 — 목록 위의 조건 칩 줄 (ADR-320 Phase 2)] - 2026-11-27

목록 위에 놓는 필터 바가 생겼다. 시작 조건을 칩으로 보여 주고, 연결한 목록을 같은 조건 트리로 거른다.

### Added

- 팔레트 `FilterBar` (RAC Toolbar) — 시작 조건의 루트 항목마다 `FilterChip` (RAC Group, 「필드 비교 값」) 을 반복하고, 「필터 추가」 · 「조건 편집」 · 「지우기」 버튼을 둔다 (「지우기」 는 `showClear` 로 끈다). 크기 S · M · L, 문구는 사이트 언어 (en · ko · ja · zh).
- 목록의 Property 탭 「검색 · 필터」 에 「필터 바 추가」 — 목록 바로 위에 넣고 연결까지 한 번에 (되돌리기 한 번).
- 필터 바 패널: 필터할 목록 (같은 페이지 · 같은 데이터의 목록, 다른 바가 거르는 목록 제외) · 내놓을 필드 (보이기 · 순서) · 시작 조건 · 이름 붙인 묶음. 데이터 공급 방식이 받지 못하는 조건은 패널에 표시한다 (Preview 와 같은 판정).
- 복제 · 붙여넣기 · 페이지 복제가 같이 복제된 목록에 다시 잇는다. 한 목록은 바 하나만, 목록들은 같은 데이터여야 한다 (문서 검증).

### Changed

- 문서 contract 80 → 82 (노드 필드 `filtersOf`, 값 종류 `filterQuery` · `filterPresets`).

## [Table 필터 = 조건 트리 하나 · 보낼 수 없는 조건은 끝까지 모아 여기서 (ADR-320 Phase 1)] - 2026-11-27

실행 중 Table 의 필터가 조건 트리 하나가 됐다 — 열 메뉴는 그 트리의 자기 열 조건만 읽고 쓴다. 필터 바 (다음 Phase) 가 같은 트리에 「그리고 · 또는」 묶음을 넣는다.

### Changed

- 「또는」 · 중첩 묶음을 로컬 행에서 거른다 (끈 조건 · 값이 빈 조건은 묶음에서 빠진다 — `점수 = 20 또는 (꺼짐)` 은 20 인 행만). 조건만 나열한 트리는 지금 경로 그대로.
- 지운 필드의 조건 · 요청이 담지 못하는 조건은 표 상태에 들어가지 않는다 — 데이터 정의 · 문서가 바뀌면 다시 판정한다.

### Fixed

- **같은 key 를 두 번 보내던 것**: 접미사 형식에서 `status = open 그리고 status = closed` 가 `status=open&status=closed` (다중 선택과 같은 요청) 로, endpoint 기본 query `status=open` 위의 `status = closed` 가 두 값으로 나갔다 — 둘째 조건은 보내지 않고 끝까지 모아 여기서 거른다.
- **GET · HEAD 의 `body` 형식이 조건 없는 첫 쪽을 결과로 보이던 것**: 본문을 보낼 수 없으니 조건을 보내지 않고 끝까지 모은다. 다음 쪽 cursor 를 보낼 수 없거나 같은 쪽이 반복되면 받은 쪽의 행을 보이지 않고 「조회 실패」 (읽는 중 상태 `error`).

## [「모아서 저장」 · 실행 저장소 판독 수리 — 잘못 지우기 · 덮어쓰기 · 중복 넣기 · 옛 값 표시] - 2026-11-27

ADR-324 · ADR-325 구현 판독 (round 3) 이 재현한 HIGH 8 · MEDIUM 3 을 고쳤다.

### Fixed

- **칸을 고쳤는데 서버 행이 지워지던 것**: 「수정」 연결에 DELETE endpoint 를 고를 수 있었다 — 연결마다 method 가 정해진다 (수정 PATCH · PUT, 추가 POST, 삭제 DELETE, 묶음 POST). 패널 선택지 · 문서 검증 · 전송이 같은 표를 읽는다.
- **버전 보호를 켰는데 다른 사람의 값을 덮던 것**: 조회 응답에 버전 값이 없는 행은 보내지 않는다 (「기준 버전 없음」) — 전에는 조건 없는 요청이 나갔다.
- **응답을 잃은 추가가 다음 저장에서 한 번 더 만들어지던 것**: 보낸 key 로 찾지 못해도 「반영 안 됨」 으로 닫지 않는다 (서버가 key 를 새로 매겼을 수 있다) — 「결과 확인 필요」 로 남는다.
- **지우지 않고 「저장됨」 을 알리던 것**: 저장 전 확인 조회가 여러 행을 주면 그 key 의 행이 있을 때만 그 행으로 읽는다 — 가리지 못하면 보내지 않고 「확인 조회 실패」.
- **끝낼 수 없던 「처리 중」 · 「결과 확인 필요」**: 저장 막대에 「다시 저장」 · 「대기 취소」 (Do 의 `scope: "pending"`), 저장 결과가 기다리는 행 수를 말한다.
- **같은 검색으로 돌아오면 옛 값이 보이던 것** (a → b → a): 서버가 준 새 값이 보인다.
- **서버가 key 를 준 새 행의 다음 수정이 임시 key 를 다시 보내던 것** · **행을 연결하면 대상 행의 다른 미저장 편집이 사라지던 것**.
- 「변경을 모아서 저장」 을 켠 직후 같은 스위치로 끌 수 없던 것 (저장 막대와 그 규칙을 같이 지운다 — 한 번의 undo) · 서버 id 가 `row-1` 같은 행이 저장되지 않던 것 · 주기 조회에서 지나간 행이 세션에 쌓이던 것.
- **Why**: 판정이 「보낸 key = 서버 key」 · 「여러 행 = 없음」 · 「버전이 없으면 조건 없이」 처럼 근거 없는 쪽으로 기울어 있었고, 조회 결과의 revision 이 결과마다 1 부터라 화면 캐시와 겹쳤다.

- 확인: 대역 서버 단위 반례 16 (수정 전 실패 확인) + 문서 검증 · 끄기 · 세션 회귀 3 (변이 RED), Builder → Publish live `adr324-g5-live.mjs` Chrome · WebKit 각 15/15 (패널 선택지 · 끄기 포함) · `adr325-g5-live.mjs` 각 9/9. 상세 [ADR-324 breakdown](adr/design/324-collection-manual-batch-save-breakdown.md) · [ADR-325 breakdown](adr/design/325-collection-runtime-store-three-layers-breakdown.md) 「Round 3 판독 수리」.

## [ADR-324 — Collection 「모아서 저장」: 편집을 모았다가 저장 버튼으로 변경분만 보낸다] - 2026-11-27

실행 중 Table 에서 고친 값을 바로 서버에 쓰지 않고 모아 두었다가, 보는 사람이 「저장」 을 누를 때 바뀐 것만 보낸다 (ADR-324 Phase 0 ~ 5 → Implemented). 편집 상태는 ADR-325 의 미저장 변경 층 하나다.

### Added

- **Data 패널 표 설정의 「저장」 구획**: 「변경을 모아서 저장」 스위치 · 보내는 모양 (행마다 REST · 한 요청 묶음) · 수정 · 추가 · 삭제 endpoint · 본문 (바뀐 필드 · 행 전체) · 원자성 · 큰 저장 압축 · 충돌 감지 (없음 · 버전 필드 · 저장 전 확인 조회) · 중복 방지 키 헤더. 지금 연결이 보장하는 수준을 한 줄로 밝힌다 (연결이 선언한 수준).
- **켜면 저장 막대가 들어간다** (사용자 결정 5): 연결된 Table 뒤에 「저장 안 된 변경 N건」 · 「저장」 · 「취소」 · 충돌용 「내 값으로 다시 저장」 · 「서버 값 받기」 · 「이 행에 적용」 — 보통 노드라 고치거나 지울 수 있다. Table 의 「Edit marks」 도 켠다. 편집마다 저장하던 규칙이 있으면 같이 켤 수 없어 그 규칙들을 보이고 「규칙을 지우고 켜기」 (한 번의 undo).
- **Do 「Save a collection's changes」 · 「Discard a collection's changes」**: 직접 만든 버튼에 잇는다. 값 `{{ changes.<표>.count }}` 와 버튼 비활성 조건 `!var.changes:<표>.canSave` 로 막대를 직접 만들 수도 있다. Code 보기 `list.saveChanges()` · `list.discardChanges()`.
- **닫기 경고**: 저장 안 된 변경이 있는 채 Publish 탭을 닫거나 새로 고치면 브라우저가 묻는다 (사용자 결정 2 — 변경을 브라우저에 보존하지는 않는다).

### Changed

- **저장 결과는 행마다 판정**: 202 (접수만) 는 「처리 중」 으로 남고, 200 이어도 필드 오류가 있으면 저장 안 됨 + 칸에 문구, 넣은 행은 응답의 key (본문 → `Location`) 를 받는다 — 응답이 key 를 알려 주지 않은 새 행을 다시 고쳤으면 「서버 행과 연결 필요」 로 두고 보는 사람이 행을 고른다 (자동으로 잇지 않음). 행마다 보내는 연결은 끝까지 보내고 실패한 행만 남는다 (사용자 결정 3).
- **응답을 잃으면 다시 읽어 판정**: 자동으로 다시 보내지 않는다. 내 값이면 저장됨, 수정 전 값이면 다음 저장에 다시, 그 밖이면 충돌. 브라우저가 끊긴 연결의 요청을 스스로 다시 보낸 경우 (버전 조건이 막아 412) 도 다시 읽어 저장됨으로 닫는다 (live 에서 발견).
- **충돌**: 다른 사람이 먼저 바꾼 행은 「충돌」 표시와 서버 값이 같이 보이고 (사용자 결정 4), 버전은 처음 고칠 때의 것을 보낸다 — 그 사이 다시 불러온 새 버전으로 보내지 않는다.

- 확인: 대역 서버 (`saveEndpointStub.ts` · `save-endpoint-stub.mjs`) 로 단위 24 · 원복 RED 7/7, Builder 에서 패널로 켠 프로젝트를 Publish 로 열어 Chrome · WebKit 각 13/13 (`adr324-g5-live.mjs` — 편집 쓰기 0 · 저장 PATCH 1 · 412 충돌 · 「내 값」 · 응답 유실 · 취소 · 키보드 · 닫기 경고), 즉시 저장 회귀 (`adr317-p4-edit-marks-live.mjs`) Chrome · WebKit PASS. 문서 계약 80 (옛 79 파일은 열리지 않는다 — 변환 없음). 번들 Builder 첫 화면 +4,126 B · Preview 첫 화면 JS 0 · CSS +92 B. 상세 [ADR-324](adr/completed/324-collection-manual-batch-save.md).

## [ADR-325 — 실행 중 고친 값이 페이지 이동 · 정렬 · 다시 불러오기 뒤에도 남는다] - 2026-11-27

Preview · Publish 의 실행 세션이 Collection 마다 응답 하나를 들던 것을 세 층 (행 · 조회 결과 · 미저장 변경) 의 저장소로 바꿨다 (ADR-325 Phase 0 ~ 5 → Implemented). 화면의 행은 늘 「서버가 준 행 + 아직 저장하지 않은 변경」 이다.

### Changed

- **고친 값과 「저장 안 됨」 표시가 남는다**: 다음 페이지 · 검색 · 정렬 · 규칙의 「다시 불러오기」 · 쪽 이동 · 주기 조회 · Builder 가 보낸 새 행 뒤에도 (사용자 결정 2). 전에는 다음 페이지 뒤 표시가 사라지고, 다시 불러오기 · 검색 · 정렬은 편집을 지웠다. 버리기는 세션의 취소 (`discardChanges`).
- **Publish 주기 조회가 편집 중에도 돈다**: 「저장 안 된 편집이 있으면 그 주기를 건너뛴다」 (2026-11-26) 를 지웠다 — 변경은 새 행 위에 다시 덧씌워진다.
- **조건이 다른 두 컴포넌트가 각자 서버에 묻는다** (Decision 6): 같은 Collection 을 다른 조건으로 읽는 표 · 목록이 보기마다 자기 요청을 보낸다 — 전에는 보기를 싣지 않고 Builder 의 행을 거르거나 (instance 입력이 다르면) 1 만 행까지 모두 불러왔다. 그 Collection 의 전체가 끝까지 와 있는 것이 확인될 때만 (전체 수, 또는 다음 페이지를 알려 주는 선언) 요청 없이 여기서 거른다. 보기의 「더 보기」 는 그 보기의 다음 페이지.
- **한 행은 어디서나 같은 값**: 쪽 목록 · 고정 행 · 펼친 묶음 · 보기마다의 목록이 같은 행을 같이 쓴다 — 한 곳에서 고친 행이 다른 목록에도 같은 값.
- **서버가 거른 목록에 넣은 행**: 그 보기의 조건에 맞을 때만 목록 끝에 보인다 (사용자 결정 3). 고친 행은 다시 조회할 때까지 제자리.

### Fixed

- **보기 없는 목록이 같은 Collection 의 다른 보기 행을 보이던 것**: 보기 없는 표와 보기 (예: female) 가 있는 목록을 같이 두면 표도 그 보기의 행만 보였다 — 보기 없는 쪽도 조건 하나로 세어, 표는 거르지 않은 행 · 목록은 자기 요청.
- **다시 불러오기 · 주기 조회가 보기마다의 목록을 다시 받지 않던 것** (이번 변경 중 live 로 발견): 규칙의 「다시 불러오기」 · 주기 조회는 보기 목록도 새로 받는다.
- **바인딩 값 필드로 key 를 주는 목록의 편집이 「항목 없음」 이던 것** (G0 재현 — 목록의 key 가 Collection key 필드가 아닐 때): 세션이 목록의 key 로도 행을 찾는다. 다른 목록에만 있는 행 (쪽 목록 2 쪽 · 고정 행) 도 key 로 고친다.

### Added

- **Data 패널 안내**: API 에 연결된 표에 key 필드도 `id` · `key` · `value` 열도 없으면 「실행 중 고친 값이 다시 불러오면 사라진다 — 열 설정에서 key 필드를 켜면 남는다」 (사용자 결정 1).

- 확인: Builder 에서 만든 프로젝트를 Publish 로 열어 Chrome · WebKit 각 9/9 (`adr325-g5-live.mjs` — 두 목록의 요청 · 고친 값과 표시가 다음 페이지 · 서버 정렬 · 검색 · 다시 불러오기 · 주기 조회 뒤에 남음), 즉시 저장 회귀 (`adr317-p4-edit-marks-live.mjs`) Chrome · WebKit PASS. 10,000 행 정렬 · 붙여넣기 시간 HEAD 와 같음 (노이즈 폭 안), Preview 첫 화면 번들 +0 B. 상세 [ADR-325](adr/completed/325-collection-runtime-store-three-layers.md).

## [Canvas ↔ Preview 비대칭 4건 — G3 하니스 실패 조사에서 확인한 제품 결함] - 2026-11-27

G3 하니스 (`vitest.adr248-g3.browser.config.ts`) 의 실패 133 건을 원인별로 나눈 결과 중 실제 제품 결함 4 종을 고쳤다. 나머지 (하니스 측정 · 낡은 fixture · 낡은 예외 목록) 는 별도 작업.

### Fixed

- **ProgressBar · Meter 의 값이 0 이면 Canvas 막대가 꽉 참**: 새로 놓은 ProgressBar · Meter (기본값 0 — 11-18 S2 기본값) 가 Canvas 에서는 꽉 찬 막대, Preview 에서는 빈 막대였다. 이제 Canvas 도 빈 막대다.
  - **Why**: 엔진 grid item 배치가 「명시 크기 있음」 을 풀린 값 `> 0` 으로 갈라 `width: 0%` 를 auto 로 보고 셀까지 늘였다 (0 붕괴 폴백 포함). 이제 0 (`0` · `0px` · `0%`) 도 명시 크기이고, 명시 크기는 padding + border 아래로 내려가지 않는다 (CSS border-box). 엔진 wasm 재빌드 필요 (`pnpm wasm:build:engine`).
  - 위치: `packages/engine/src/tree.rs` grid item 배치 · `place_grid_axis`
- **LabeledValue 값 칸 폭이 Preview 에서만 글자 폭**: Canvas 는 S2 기본 폭 (S 192 · M 208 · L 224 · XL 240) 이었다. 이제 양쪽 같다.
  - **Why**: S2 `fieldInput()` 의 기본 폭 (`contain: inline-size` + intrinsic width) 이 Canvas part rule 에만 있고 생성 CSS 에 없었다. 이제 rule 한 곳에 두고 생성 CSS 와 Canvas part rule 이 같이 읽는다.
  - 위치: `componentRulesTable.ts` LabeledValue `sizeSelectors` · `rulePartRules.ts` · 생성 `LabeledValue.css`
- **Meter · ProgressBar side 라벨의 간격이 Preview 에서 4px**: Canvas 는 12px 였다. 이제 양쪽 12px.
  - **Why**: 크기 블록의 `gap: 4px` (shorthand) 가 S2 `bar-utils.ts` 의 `column-gap: 12` 를 덮었다.
  - 위치: `componentRulesTable.ts` Meter · ProgressBar 크기 블록 `columnGap: 12` · 생성 `Meter.css` · `ProgressBar.css`
- **SideNavHeader 에 쓴 글자 크기 · 굵기 · 색이 Preview 에 안 나옴**: Canvas 에는 보였다. 이제 Preview 에도 보인다.
  - **Why**: header 요소의 DOM style 이 상자 값만 실어 (`catalogDomStyle`), 안 Text 가 상속할 값이 없었다 (Canvas Text 는 header 값을 읽는다). 이제 header 가 작성값을 inline 으로 싣는다.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts`
- **SideNavHeader 의 색만 바꾸면 Canvas 의 header 글자가 옛 색에 남음**: 크기를 같이 바꾸면 따라왔다. 이제 색만 바꿔도 따라온다 (위 DOM 수정 뒤 드러남 — 전에는 양쪽 다 안 바뀌어 하니스가 통과했다).
  - **Why**: 색만 쓰면 레이아웃 패스가 없어 글꼴 상속 경로가 안 Text 를 다시 계산하지 않았고, SideNav 의존 목록 (`catalogSideNavDependents`) 에 header 가 없었다.
  - 위치: `packages/shared/src/catalog/runtime/sideNav.ts`
- 확인 (SideNav 추가분): G3 `adr300SideNavParity` fixture 를 원본 구조 (내용 frame > SideNav · 바닥 frame > quiet ActionButton) 로 갱신 → 12/12 (갱신 전 12 실패 — 접기 버튼 fixture 11 · header 색 1). Canvas node data 에 그리는 곳이 없는 엔진 상자 baseline 을 싣지 않는다 (`canvasBinding.ts` `paintedNodeData` — rect 비교 `sameRect` 가 일부러 빼는 값이라 patch 장면과 새 장면이 갈렸다, 화면 영향 없음). 원복 RED (header 의존 → `incremental-header-color` 실패 · baseline → `incremental-header-edit` 실패, 바이트 복원) · shared 2,847 · builder catalogRuntime 4,326 (시간 초과 9 는 단독 73 통과) · parity 2,196 (시간 초과 1 단독 통과) · G3 117 → 105 (새 실패 0) · live (새 프로젝트 · Compare Mode — header 색만 두 번 바꿈, Canvas Text `#0050c0` / DOM `rgb(0, 80, 192)` 같음).
- 확인: 새 테스트 — parity `gridItemZeroSize` 9 (Chrome oracle, 수정 전 7 RED) · `g3SheetCanvasSameValue` 4 · `sideNavHeaderType` 2, 원복 RED (시트 · Meter · ProgressBar · header 각각 실패, 파일 6 개 바이트 복원) · Rust 569 · 엔진 leg parity 46 파일 868 · shared 2,847 · builder 관련 단위 7,780 (병렬 부하에서 시간 초과난 9 파일은 단독 재실행으로 통과) · G3 하니스 133 → 117 실패 (16 건 통과로, 새 실패 0) · live (chrome-devtools, 새 프로젝트 · 팔레트 삽입 · Compare Mode — ProgressBar · Meter Fill Canvas 0 / DOM 0 · 트랙 768, LabeledValue 값 칸 Canvas 208 / DOM 208, Meter side 트랙 x 48.99 · 폭 686.6 양쪽 같음 · DOM column-gap 12, SideNavHeader 16 · #c00000 Canvas / DOM 같음).

### Changed

- **엔진 변경 때 parity 를 자동 실행** (`scripts/agent/work.sh` 5b): `packages/engine/src` 가 바뀌면 wasm 이 소스보다 오래됐을 때 다시 빌드한 뒤 엔진 leg parity (45 파일 · 19 초) 를 돌린다.
- **parity 격자의 실패 보고를 종류로 묶음** (`tests/parity/harness.ts` `describeFailures`): 발산 케이스마다 어긋난 노드 · 축과 엔진 판정 (trace) 으로 지문을 만들어 「발산 N · 종류 K」 와 종류별 예 하나로 보인다. 격자 세 파일의 중복 `sweep` · `detail` 을 하니스 하나로.

## [ADR-318 Implemented — Resizable 분할창 (끌어서 나누는 패널 묶음)] - 2026-11-26

ADR-318 (Resizable 분할창 — react-aria 훅 + 닫힌 D1 예외) Implemented. 코드 변경 없이 남은 사용자 확인으로 닫았다 — VoiceOver 청취 사용자 「VoiceOver 청취 확인했다」 (손잡이 separator 의 이름 · 값), 사용자 확인 「adr-318 은 완료 된것 아닌가?」. 기능은 Phase 0 ~ 6 커밋 (`0048b7900` · `8143ccbe8` · `13def5364`) 그대로다.

### Changed

- ADR 본문을 `docs/adr/completed/` 로 옮기고 `### Live Exercise` 절을 적었다 (G1 ~ G6 live · HC5 · VoiceOver).
- 승격 직전 재확인: Phase 6 뒤 커밋 (`13def5364` · ADR-319 의 `canvasGesture.ts`) 을 지난 dev 서버에서 `adr318-g6-live.mjs` Chrome · WebKit 7/7 (짝 유지 명령 · Canvas 손잡이 = Default size · Layout 탭 크기 칸 · Layers 방향 아이콘 · page error 0).

## [Publish — API 에 연결한 표가 샘플 행 대신 실제 데이터를 불러온다] - 2026-11-26

Publish (헤더 Preview 탭) 에서 API endpoint 에 연결한 Collection 이 API 를 부르지 않고 Data 패널의 샘플 행을 보이던 결함을 고쳤다 (사용자 결정 2026-11-26 — 실행 정책을 따르고, 정하지 않았으면 열 때 조회).

### Fixed

- **Publish 가 API 연결 Collection 을 스스로 조회** (`catalogPreviewSession.ts` `standalone` · `apps/publish/src/catalogSession.ts`): 주소에 변수 · cursor · 보기가 없는 단순 endpoint 는 Publish 에서 요청이 0 건이었다 (실행 정책 「Auto」 여도). 이제 실행 정책대로 — 정하지 않음 · Auto = 열 때, Interval = 열 때 + 주기마다, `manual` (문서 값) = 규칙의 다시 불러오기 때만. 주기 조회는 진행 중인 조회나 저장되지 않은 편집이 있으면 그 주기를 건너뛴다.
- **샘플 행으로 넘어가지 않음** (`catalogData.ts`): Publish 에서 API 연결 Collection 은 불러온 행만 보인다 — 아직 응답이 없으면 빈 목록 · 로딩 표시. 「샘플 사용」 을 켠 Collection 과 endpoint 가 없는 Collection 은 그대로.
- **Publish 파일에 샘플 행을 싣지 않음** (`document/apiSampleRows.ts` `withoutApiSampleRows`): API 연결 Collection 의 샘플 행 (최대 1,000 행) 이 Publish 탭의 파일에서 빠진다. 프로젝트 내보내기 파일과 Builder 문서는 그대로.
- 확인: 새 테스트 7 (Publish 세션 5 · 문서 투영 2) · 원복 RED 8/8 · Builder Preview 묶음 1,300 · shared 658 회귀 0 · live (headed Chrome, Builder → Publish — 단순 · Auto · cursor 가 각 1 요청과 API 행, 「샘플 사용」 표는 샘플 유지, Publish 파일의 샘플 행 0 · Builder 문서 1).

### Changed

- **실행 정책의 기본이 「Auto」** (사용자 결정 2026-11-26, ADR-218 의 「미설정 = 수동」 을 바꿈 — `collections/executionPolicy.ts`): 정책을 정하지 않은 Collection 은 열 때 조회한다 — Builder 의 Preview (Compare Mode) 를 열 때도 한 번. Data 패널은 그 Collection 을 「Auto」 로 보인다. 「샘플 사용」 을 켠 Collection 은 조회하지 않는다.
- **「Manual」 은 저장되는 선택**: 고르면 `manual` 이 저장되고, Publish 에서는 규칙의 다시 불러오기 (조회 버튼) 를 누를 때만 조회한다 — 그전에는 빈 목록. Builder 의 Preview 는 「Manual」 Collection 을 조회하지 않고 샘플 행을 보인다.
- 확인: 새 테스트 5 (정책 읽기 2 · 패널 표시 2 · 패널 저장 1) + Builder 자동 실행 테스트 갱신 · 원복 RED 6/6 · Builder 6,134 · shared 667 회귀 0 · live (Compare Mode 를 열면 정책 없는 Collection 만 1 요청 · Publish 에서 「Manual」 은 요청 0 과 빈 표).

## [Design 패널 — Selected · Disabled keys 를 다중 select 로 (perf ratchet 조사)] - 2026-11-26

목록 그룹의 「Selected keys」 · 「Disabled items」 칸이 항목마다 체크박스를 그리던 체크 목록에서 여러 개를 고르는 select 로 바뀌었다 (사용자 결정). 닫힌 칸은 고른 항목 이름을 이어 보이고, 열면 항목 전부가 목록으로 나온다.

### Changed

- **`PanelSelect` 다중 선택** (`components/property/PanelSelect.tsx`): `selectionMode="multiple"` · `selectedKeys` · `onSelectionKeysChange` — RAC `Select` 의 multiple (`value` · `onChange`). 닫힌 동안 RAC 에는 고른 항목만 준다 (단일 선택과 같은 `closedItems`).
- **닫힌 칸 글자 = S2 Picker**: 고른 항목이 하나면 그 이름, 둘 이상이면 개수 (「2 items selected」 · 「2개 항목 선택됨」 — S2 `picker.selectedCount`), 없으면 「—」.
- **Chart 값 필드 고르기** (`ChartDataMappingControls.tsx` `ChartFieldPicker` — Series source → Value columns): 원천 열마다 Checkbox 를 그리던 목록도 같은 다중 select 로 (이름 + 오른쪽 유형). 고른 순서가 값 필드 순서다. 트리거 글자는 공용 `PanelMultiSelectValue`.
- **`SelectionKeysField`**: 그룹 항목 칸이 이 select 를 쓴다. 300 항목 목록을 고를 때 패널에 Checkbox 300 개가 생기던 것이 없어졌다 — ratchet `600:scroll-boxes` scroll DOM 속성 변경 1,568 → 70 · `60:sticky-lists` select 1,328 → 430 (원인 `4ac2d5ec3`).
- 조사: ratchet 등급 A 초과 99 건은 11-22 기준 (`cd9a9bca5`) 뒤 런타임 커밋 62 개가 쌓인 것 — 위 항목 말고는 기능 추가의 선택당 일정한 비용 (frame · Text HTML 태그 칸 · Resizable · S2 기능) 과 Text · Heading 글자 상속의 렌더 변경이다.

## [ADR-319 Implemented — Canvas 크기 미리보기 비용 (칠 메모 · 줄바꿈 묶기 · 측정 문단 재사용)] - 2026-11-26

ADR-319 Implemented (Phase 0 ~ 4). 글자가 많은 상자의 Canvas 크기 끌기 (Resizable Panel · Frame 손잡이 · Styles 크기 · 여백 · 간격 칸 끌기 — 같은 미리보기 경로) 가 가벼워졌다. 그림은 같다. 절대 기준 (모든 칸 p95 ≤ max(16.7, idle + 1.7) · LoAF 0) 은 1,000 글자 · 4x CPU 에서 미달이라 사용자 결정 1 로 「한계로 기록하고 닫기」.

### Changed

- **칠 해석 메모** (`packages/shared/src/catalog/runtime/libraryVisual.ts`): `catalogLibraryVisual` · `catalogAuthoredVisual` · `catalogDerivedConditionalVisual` 결과를 root 마다 record 객체 단위로 기억한다 (키 = 그래프 revision + locale typography rule 의 조상 locale, 결과 freeze). 우회 `catalogWithoutPaintMemo` 를 테스트 oracle (`catalogCanvasNodeData`) 이 쓴다. 규칙 `canvas-rendering.md` 에 「새 record 밖 입력은 키에도」.
- **`rewrap` 묶기** (`compositionRoot.ts`): 다음 가상 격자 전까지의 후보 rect 를 한 번에 읽는다 (wasm 조회 = 구간 수) · applied style 은 `PersistentLayoutTree.getAppliedStyleObject` (입력 JSON 이 바뀔 때 지움) · leaf 는 record 객체 + 상속 줄 높이 + revision 으로 기억 · 측정 캐시 키는 font 객체마다 폭 없는 부분을 한 번 직렬화.
- **측정 문단 보유** (`textMeasure.ts` · `workspace.holdMeasureParagraphs`): 크기 미리보기 동안 글자 leaf 마다 CanvasKit 문단 하나를 두고 폭이 바뀌면 `layout(width)` 만 다시 부른다 (결과는 새 문단과 같음 — 26 fixture × 12 폭). 여는 곳 = Canvas 크기 · 여백 손잡이, Styles 크기 · 여백 · 간격 · 테두리 폭 · inset 칸 끌기. 닫는 곳 = commit · 취소 · root 교체 · 글꼴 모음 변경 · Canvas teardown (`gestures.cancel()`) · `workspace.dispose` — 즉시 `.delete()`. 규칙 `canvas-rendering.md` §3 의 측정 경로 금지를 이 조건으로 좁혔다.
- **속도 (production A/B 교대 3 쌍 · headed Chrome)**: 다른 문장 1,000 · 1x p95 60 → 21 ms · LoAF 309 → 1 / 4x p95 320 → 81 ms · p99 359 → 81 ms. 같은 문장 1,000 · 4x p99 79 → 41 ms. CPU 프로필: `paintedNodeData` −53 % · 측정 원천 −86 % · `rewrap` 의 측정 · 엔진 밖 몫 −48 % (같은 문장) · −39 % (다른 문장 — 목표 40 % 미달 1 %p). 남은 것: 1,000 · 4x 는 엔진 · Skia · 줄 나누기 몫으로 여전히 두 프레임 이상 (한계로 기록).
- 번들 Builder initial gzip +1,250 B (1,637,725 / 1,650,000). 하니스 `adr318-heavy-panel-frame.mjs` 의 `PROFILE=1` 이 원본 CPU 프로필도 저장한다.

## [ADR-315 Implemented — Table 을 data grid 로] - 2026-11-26

ADR-315 (표 상태 모델 하나로 TanStack Table 기능 표면 전부 — 정렬 · 검색 · 필터 · 열 · 행 · 칸) Implemented. 코드 변경 없이 남은 사용자 확인으로 닫았다 — G6 VoiceOver 청취 사용자 「voiceover는 했다」, G7 사용자 확인 「통과 — Implemented 로」. 종결 live 는 Phase 7 (2026-11-21) 의 재확인 묶음 23 모드 (Chrome · WebKit) · `/cross-check` · HC4 A/B (≤ 1.10) 그대로다. Worker 는 「필요 없음」, 로컬 조회 상한 10,000 그대로 (사용자 결정 7).

### Changed

- ADR 본문을 `docs/adr/completed/` 로 옮기고 `### Live Exercise` 절을 적었다.

## [ADR-317 Implemented — Table 편집 격자 (Phase 6 종결)] - 2026-11-26

ADR-317 (Table 편집 격자 — 붙여넣기 · 채우기 손잡이 · 편집 상태 표시 · 줄무늬 행) Implemented. Phase 6 은 제품 동작 변경 없이 측정 · 검사 · 문서로 닫았다 — G6 사용자 답 「같은 표 기준으로 통과」, P5 VoiceOver 청취 「확인했다」 (붙여넣기 · 지우기 · 잘라내기 · 채우기 결과 알림을 focus 이동 없이 읽음).

### Changed

- **속도 (HC5, production · 10,000 행)**: 네 스위치를 켠 표와 끈 표의 로드 · 힙 · 정렬 클릭 · 스크롤 p95 중앙값 비율 0.91 ~ 1.09 (교대 3 쌍), Phase 0 빌드 대비 회귀 없음. 1,000 칸 붙여넣기 1x 240 ~ 275 · 4x 930 ~ 1,219 ms — 같은 표 (「Editable」 열) 의 정렬 클릭 이하 (같은 페이지 짝 3/3).
- **번들**: Phase 0 대비 Builder +1,689 · Preview +61 B gzip (사용자 결정 7 범위 안).

### Tests

- `packages/shared/src/catalog/runtime/__tests__/adr317D1Exception.static.test.ts` (3) — Table 칸 선택 모듈이 듣는 이벤트 · 다루는 키 · 쓰는 ARIA 가 `.claude/rules/ssot-hierarchy.md` 의 D1 예외 목록과 같은지.
- 하니스: `datagrid-table-vs-tanstack-live.mjs` `--with editable` · `--with adr317` · `--measure-paste` (붙여넣기 시간 + 같은 표 정렬 짝) · `--profile-paste` · `adr317-g6-crosscheck-live.mjs` (줄무늬 Canvas ↔ Publish 픽셀) · `adr317-p2-paste-live.mjs` 잘라내기 단계 · `--hold` (청취용).

## [ADR-317 Phase 5 — Table 「Striped rows」 줄무늬 행] - 2026-11-26

### Added

- **Table 「Striped rows」** (Design 패널 모양 구획 스위치, 기본 꺼짐, composition 확장 — S2 TableView 에 없고 design-data 지침은 「Don't use zebra stripes」, 사용자 답 「composition 확장으로 유지」): 보이는 순서의 둘째 데이터 행마다 옅은 바탕 (`{color.table-stripe}` — light `#f8f8f8` · dark `#1b1b1b`). 정렬 · 거르기 · 묶기 뒤 순서로 세고 (CSS `:nth-child` 아님 — 가상 표가 스크롤해도 같은 행은 같은 줄무늬), 묶음마다 다시 세며 (각 묶음 첫 행은 칠하지 않음), 트리 하위 행은 이어 세고, 상세 행은 그 행을 따르고, 고정 행은 칠하지 않는다. 데이터에 연결하지 않은 Table 은 작성한 행 순서. 「Merge same values」 열의 묶음은 첫 행의 줄무늬를 따른다 (눈에 한 칸). Builder Canvas 와 Preview · Publish 가 같은 표시를 그리고, Preview · Publish 에서는 행 hover · 선택 · 편집 표시 · 칸 선택이 줄무늬 위에 보인다.
  - 위치: `runtime/tableStripes.ts` (`catalogStripedRows`) · `resolution/resolver.ts` `boundTableRows` · `withStripedRow` · `resolution/tableColumns.ts` · `runtime/tableTracks.ts` `catalogRowStriped` · `runtime/presence.ts` · `runtime/domBinding.runtime.ts` · Row · Cell rule 파생 블록 · Table rule `partStateStyles` (생성 `Table.css`) · `bindings/Table.binding.ts` `isStriped`
- **색 토큰 `{color.table-stripe}`** (`--table-stripe`, tone 50 — Table 바탕 한 단 위 · 행 hover 아래).

### Fixed

- **Canvas: rule 이 그리는 칸이 record 의 바탕을 투명하게 그리던 것** — variant `alpha: 0` 인 rule (Table Cell) 은 record 에 적힌 바탕 (`style.backgroundColor`) 도 그 alpha 를 곱해 보이지 않았다. 적힌 바탕은 DOM inline 처럼 그대로 그린다.
  - 위치: `catalog/resolvers/resolveCatalogPaint.ts`

### Tests

- `packages/shared/src/catalog/runtime/__tests__/tableStripes.test.ts` (5) · `apps/builder/src/preview/catalog/__tests__/adr317StripedRows.test.tsx` (4) · `apps/builder/src/builder/catalogRuntime/__tests__/adr317StripedRowsCanvas.test.ts` (3) — 변이 RED 16/16 · live `apps/builder/scripts/adr317-p5-striped-rows-live.mjs` Chrome · WebKit 각 8/8.

## [ADR-318 Phase 0 ~ 6 — Resizable 분할창 (끌어서 나누는 패널 묶음 · 접기 · pill 손잡이 · 상태 연동 · 편집)] - 2026-11-26

### Breaking Changes

- **문서 contract 78 → 79 (ADR-318)**: Resizable 세 type · 원본 · Panel 접힘 Do 가 라이브러리에 더해졌다. 옛 78 문서는 열리지 않는다 (변환 없음 — 개발 단계).
  - 위치: `catalog/document/types.ts` `LIBRARY_CONTRACT_VERSION` · fixture 32 파일

### Added

- **Resizable 분할창** (팔레트 layout 「resizable panels」, composition 확장 — RAC · S2 · design-data · v3 에 없음): `ResizablePanelGroup > ResizablePanel (ResizableHandle ResizablePanel)*`. 원본은 Panel · Handle · Panel (50 / 50, 폭 100 % · 높이 200). Panel 은 아무 내용이나 담고, 기본 크기 % (`defaultSize` — 안 적으면 남은 비율을 고르게) · 최소 · 최대 (% 와 px — 사용자 결정 2) 를 받는다. Group 은 가로 · 세로 (`orientation`).
  - 크기 식 하나: Panel 몫 = `flexGrow` · `flexBasis 0px` — Canvas 엔진과 DOM 이 같은 CSS flex 로 그린다 (Chrome · WebKit 에서 Canvas 상자 = Publish 상자 = 식이 뜻한 크기, ±1 px)
  - 위치: `bindings/Resizable.binding.ts` · `rule/resizable.ts` · `document/resizableOrigins.ts` · `runtime/resizablePanels.ts` · `runtime/presence.ts` · `runtime/compositionRoot.ts` `styleOf` · `runtime/domBinding.runtime.ts` `authoredStyle` · `runtime/delegatedDom.runtime.ts`
- **Preview · Publish 에서 경계를 끌어 크기 조절 · 키보드**: 손잡이는 WAI-ARIA separator (값 = 앞 Panel 의 %, 최소 · 최대 · 대상 Panel · 이름). 화살표 (Group 축 방향만 — 5 %) · Home · End, 끌기는 양옆 두 Panel 만 바꾸고 한쪽이 최소 · 최대에 닿으면 멈춘다 (사용자 결정 4). 중첩 Group 의 손잡이는 바깥에 번지지 않고, T 자로 만나는 자리에서는 바깥 선이 잡힌다. 끌기 동작은 처음 끌 수 있는 손잡이가 그려질 때 불러온다 (lazy).
  - 끄는 동안에는 포인터가 손잡이를 벗어나도 축 커서 (col-resize · row-resize) 가 그대로다
  - 위치: `runtime/resizable.components.tsx` · `.claude/rules/ssot-hierarchy.md` §1 D1 「Resizable 손잡이 예외」 (손잡이 요소 하나의 닫힌 목록)
- **Panel 접기 · 펼치기** (`collapsible` · 접힌 크기 % · px · 「Collapsed」 시작 상태): Enter · 손잡이 더블클릭 · 끌어서 최소 크기와 접힌 크기의 가운데를 넘기면 접히고, 다시 넘기면 최소 크기로 펴진다. 펼치면 접기 전 배치로 돌아간다. 규칙 Do 「Collapse」 · 「Expand」 · 「Toggle collapse」 (접을 수 있는 Panel 에만). Canvas 는 시작 접힘을 같은 식으로 그린다.
  - 위치: `runtime/resizablePanels.ts` (`catalogResizableDisplay` · `catalogResizableMoveCollapsing`) · `interactions/concepts/collapse.ts` · `interactions/constraints.ts`
- **손잡이 모양**: 「Variant」 pill (선 가운데 캡슐 — 마우스를 올리면 길어지고 끄는 동안 더 길고 굵게 accent 색) · 「With handle」 grip (작은 상자와 점 glyph). Canvas 는 같은 값으로 그린다. 움직임 줄이기 설정이면 전환이 꺼진다.
  - 위치: `document/resizableChrome.ts` · `rule/resizable.ts` · `catalogRuntime/ruleShapes.ts` `catalogResizableHandleShapes`
- **상태 연동**: Panel 의 지금 크기 (%) · 접힘을 이름 붙인 상태 · 변수에 잇고, When 「Resize」 (놓을 때 · 키 한 단계마다) · 「Collapse change」 로 규칙을 실행한다. Group 「Remember sizes」 를 켜면 게시된 앱이 그 브라우저에서 크기 · 접힘을 기억한다 (Builder Preview 는 기억하지 않음).
  - 위치: `interactions/concepts/collapse.ts` `resizablePanelSize` · `runtime/resizableStorage.ts` · `catalogPreviewSession.ts` `rememberRuntimeProps`
- **편집**: Group 의 Panels 칸에서 Panel 을 더하면 손잡이가 같이 들어오고, Panel 을 지우면 붙은 손잡이도 같이 지워진다. 손잡이만 지우거나 옮기거나 복제할 수 없다. Group 안에서 Panel 을 옮기면 손잡이 자리는 그대로 Panel 끼리 자리를 바꾼다. Canvas 에서 Panel 을 고르면 주축 가장자리 손잡이 둘만 나오고, 끌면 「Default size」 가 바뀐다.
  - Panel 크기는 Layout 탭 Size 에서 고친다 (사용자 2026-11-26): Group 축 방향 칸 (가로 Group = Width · Min W · Max W, 세로 Group = Height 줄) 이 곧 기본 크기 (%) · 최소 · 최대 (% · px) 이고, 값을 안 적은 Panel 의 Width 에는 지금 그려지는 몫 % 가 보인다. 다른 축 칸은 꺼진다 (Group 이 정한다). Property 탭의 같은 세 칸은 뺐다 — 크기 저장 위치가 하나라 Layout 탭에서 Fill · 고정 px 를 넣어 몫을 덮던 일이 없다
  - 위치: `commands/resizablePairs.ts` · `catalogRuntime/canvasGesture.ts` (`resizablePanelShareOf`) · `panels/styles/catalog/catalogStylesHost.ts` (`catalogResizablePanelSizeAxis`) · `panels/styles/sections/TransformSection.tsx`
  - Navigator Layers 아이콘이 방향을 따른다 — Group 은 가로 두 칸 (columns-2) · 세로 두 줄 (rows-2), Panel 은 세로로 긴 상자 · 가로로 긴 상자, Handle 은 Canvas 의 선과 같은 방향 (가로 Group = 세로선). 팔레트 「resizable panels」 도 두 칸 아이콘 (`navigator/catalog/CatalogLayerIcon.tsx`)

### Fixed

- **Navigator Layers 의 Separator 아이콘이 방향을 따른다**: vertical Separator 가 가로선 아이콘으로 보이던 것을 세로선 (palette 아이콘 · 컴포넌트 안 부품 glyph 둘 다) 으로

### Notes

- 끌기 중에는 화면 (flex 값) 만 따라가고 Panel 의 크기 상태 · 이름 붙인 상태 · When 「Resize」 는 놓을 때 바뀐다 — 그 크기를 읽는 글자가 있는 문서에서 매 프레임 쓰기가 CPU 4x p95 100.9 ms 였다 (끌기 끝 쓰기 20.9 ms = idle).
- 번들 Δ (전 Phase): Builder 초기 JS gzip +5,183 B · Preview +3 B (CSS +551). VoiceOver 청취 · Implemented 승격은 남음.

## [ADR-317 Phase 4 — Table 「Edit marks」 편집 표시 · When 「Cells change」 (contract 78)] - 2026-11-26

### Breaking Changes

- **문서 contract 77 → 78 (ADR-317 Phase 4)**: 규칙 When 에 Table 「Cells change」 (`onCellsChange`) 가 더해져 문서 검증의 trigger 목록이 넓어졌다. 옛 77 문서는 열리지 않는다 (변환 없음 — 개발 단계).
  - 위치: `catalog/document/types.ts` `LIBRARY_CONTRACT_VERSION` · fixture 32 파일

### Added

- **Table 「Edit marks」** (Design 패널 Behavior 칩, 기본 꺼짐, composition 확장): Preview · Publish 에서 보는 사람이 고치고 아직 저장하지 않은 행을 표시한다 — 새 행 · 고친 행은 첫 칸 앞 가장자리 선 (초록 · 주황) 과 화면 낭독 글자 (「New row」 · 「Edited」 / 「새 행」 · 「수정됨」), 고친 칸은 옅은 주황 바탕. 붙여넣기 · 채우기 · 지우기 · EditableCell · 규칙의 append · update 가 모두 대상이다. 위치 key 로 읽는 collection (id 없음) 에서 앞에 넣거나 지워도 표시가 같은 항목을 따른다.
  - 위치: `runtime/catalogPreviewSession.ts` (`editMarks` · 편집 번호) · `resolution/resolver.ts` `withEditedRow` · `resolution/tableColumns.ts` · `runtime/domBinding.runtime.ts` · `runtime/domRegistry.components.tsx` · Table rule `rootSelectors` (생성 `Table.css`)
- **Table 규칙 When 「Cells change」** (사용자 결정 1 「Table When 하나」): 붙여넣기 · 채우기 · 지우기 한 번에 한 번 실행되고, `!event.keys` (쓴 행) · `!event.items` (그 행의 지금 값 — 저장에 보낼 것) · `!event.cells` 를 읽는다.
  - 위치: `interactions/concepts/tableEditing.ts` · `componentInteractionSpecs.ts` Table
- **저장이 성공하면 그 저장이 보낸 칸의 표시를 지운다** (사용자 결정 6 「칸까지 · 저장 성공 때도 지움」): `callEndpoint` 가 있는 규칙이 성공하면 그 규칙의 이벤트가 실은 편집과 규칙의 Do 가 저장 전에 만든 편집을 저장된 것으로 적는다. 보낸 뒤 다시 고친 칸은 남고, 실패하면 아무것도 지우지 않는다. EditableCell 의 Form 저장 규칙도 같다. 다시 불러오면 표시는 모두 사라진다.
  - 위치: `interactions/bindings.ts` (`CATALOG_EVENT_EDITS`) · `interactions/dispatcher.ts` (`editSeq` · `markEditsSaved`) · `runtime/editableCell.components.tsx`

### Tests

- `apps/builder/src/preview/catalog/__tests__/adr317EditMarks.test.tsx` (4) · `packages/shared/src/interactions/__tests__/adr317SavedEdits.test.ts` (3) · `treeData.test.tsx` (+2 — 트리 사본에서 표시 유지) — 변이 RED 11/11 · live `apps/builder/scripts/adr317-p4-edit-marks-live.mjs` (Chrome · WebKit 7/7)

## [ADR-317 Phase 3 — Table 「Fill handle」: 채우기 손잡이 · Ctrl/Cmd + D] - 2026-11-26

### Added

- **Table 「Fill handle」** (Design 패널 Behavior 칩 — 「Cell selection」 이 켜져야 보임, 기본 꺼짐, composition 확장): Preview · Publish 에서 칸 범위의 오른쪽 아래 모서리에 작은 손잡이가 생기고, 끌면 범위의 값이 그 방향 (아래 · 위 · 오른쪽 · 왼쪽 — 먼저 벗어난 축) 으로 되풀이돼 채워진다 (연속값 추론 없음 — 사용자 결정 5). 표 가장자리 근처로 끌면 자동 스크롤해 가상 표의 창 밖 행까지 닿는다. Ctrl / Cmd + D 는 범위의 첫 행을 아래 행들에 (한 행이면 위 행을 그 행에 — 사용자 결정 2). 「Editable」 열의 데이터 칸만 한 번에 쓰고 나머지는 알림에 센다.
  - 위치: `runtime/tableCellSelection.ts` (`catalogFillPlan`) · `runtime/catalogTableController.ts` `tableCellValues` · `bindings/Table.binding.ts` `allowsFilling` · Table rule `rootSelectors` (손잡이 · 닿은 칸 모양 — 생성 `Table.css`)

### Fixed

- **패널 칩이 「Fill …」 라벨을 fill 스타일 묶음으로 오인**: 칩 묶음 · 라벨의 「Fill」 접두 판정을 `fill*` key 로 좁혔다 (「Fill handle」 이 Fill 묶음의 「Handle」 로 보였다). 기존 「Fill …」 칩 (`fillStyle` · `fillGrid` · `fillArea` · `fillOffset`) 은 그대로다.
  - 위치: `panels/properties/generic/fieldEditor.ts`
- **칸 범위 끌기가 가상 표의 스크롤 중 멈추던 것**: RAC 가 스크롤 중 내용의 pointer 를 꺼 `elementFromPoint` 가 칸을 못 찾으면, 그려진 행 상자로 자리를 읽는다.

### Tests

- `apps/builder/src/preview/catalog/__tests__/adr317Fill.test.tsx` (5) · `fieldEditor.static.test.ts` (+1) — 변이 RED 6/6 · live `apps/builder/scripts/adr317-p3-fill-live.mjs` (Chrome · WebKit)

## [ADR-317 Phase 2 — Table 「Paste」: 붙여넣기 · 잘라내기 · 지우기] - 2026-11-26

칸 범위 선택 (ADR-315) 을 켠 Table 에 「Paste」 를 켜면 Preview · Publish 에서 여러 칸을 한 번에 고친다. Excel · Google Sheets · 표 자신에서 복사한 글자를 그대로 붙여넣는다.

### Added

- **Table 「Paste」** (Design 패널 Behavior 칩 — 「Cell selection」 이 켜져야 보임, 기본 꺼짐, composition 확장): Ctrl / Cmd + V 는 마지막 범위의 왼쪽 위 칸부터 보이는 행 · 열 순서로 놓고 (값 하나면 범위 전체), Ctrl / Cmd + X 는 복사 뒤 비우고, Delete · Backspace 는 범위를 비운다. 쓰는 칸은 「Editable」 열의 데이터 칸뿐 — 편집 불가 열 · 읽을 수 없는 값 · 표 끝을 넘는 칸은 쓰지 않고 센다. 한 번의 붙여넣기는 행 다시 읽기 한 번이다.
  - 결과는 표 옆의 화면 낭독용 알림 한 줄 (「칸 4개에 붙여넣음 · 2개 건너뜀」 — 한 · 영 · 일 · 중).
  - 클립보드 글자는 따옴표 칸 (칸 안 탭 · 줄바꿈 · `""`) 을 지킨다 — `collections/intake/tabText.ts`.
  - Safari 편집 메뉴: 표 안에 focus 가 있으면 `beforecopy` · `beforecut` · `beforepaste` 를 막아 복사 · 붙여넣기 메뉴를 켠다 (react-aria `useClipboard` 와 같은 방법).
  - 위치: `runtime/tableCellSelection.ts` · `runtime/domRegistry.components.tsx` (`CatalogTable` 알림) · `runtime/domBinding.runtime.ts` · `bindings/Table.binding.ts` `allowsPasting` · `document/d2Provenance.ts`
- D1 예외 (빌더 밖 사용자 컴포넌트의 직접 처리) 목록을 넓혔다 — `.claude/rules/ssot-hierarchy.md` §1 Table 칸 범위 선택 예외 (4) ~ (6).

### Tests

- `packages/shared/src/collections/intake/__tests__/tabText.test.ts` (5) · `apps/builder/src/preview/catalog/__tests__/adr317Paste.test.tsx` (8) — 변이 RED 7/7 · live `apps/builder/scripts/adr317-p2-paste-live.mjs` (Chrome · WebKit)

## [ADR-317 Phase 0 · 1 — Table 묶음 쓰기 · EditableCell 이 읽지 못한 값으로 칸을 비우지 않음] - 2026-11-26

ADR-317 (Table 편집 격자 — 붙여넣기 · 채우기 손잡이 · 편집 상태 표시 · 줄무늬 행) Accepted. Phase 0 은 시제품 (설치 RAC 1.22.1 위 제품의 칸 선택 모듈, Chrome · WebKit) 으로 붙여넣기 이벤트 · 가상 표 손잡이 끌기 · 줄무늬 짝 · 홀을 확인했고, Phase 1 은 여러 칸을 한 번에 쓰는 길을 세션에 더했다 (화면은 Phase 2 의 붙여넣기부터).

### Changed

- **EditableCell · 규칙 Do update 가 그 열 타입으로 읽을 수 없는 값을 저장하면 칸을 비우지 않고 원래 값을 남긴다** (사용자 결정 8): 숫자 열에 「abc」 를 저장하면 전에는 칸이 빈 값 (`null`) 이 됐다. 이제 그 필드는 쓰지 않고 사유를 돌려준다 (`[interactions] Editable cell: 읽을 수 없는 값이라 쓰지 않음: status`). 모든 필드가 그러면 실패라 뒤 Do (예: 저장 callEndpoint) 는 돌지 않는다. 빈 값은 그대로 빈 값으로 쓴다. 행 추가 (`append` · `insert`) 의 변환은 바뀌지 않았다.
  - **Why**: 붙여넣기는 머리글 줄 · 다른 열 글자가 섞이기 쉬워 조용한 비움이 곧 값 손실이다. 묶음 쓰기와 한 칸 편집이 같은 판정 하나를 쓴다 (ADR-317 HC2).
  - 위치: `runtime/catalogPreviewSession.ts` `itemFields` · `update`

### Added

- **세션 묶음 쓰기 `updateMany`** · **표 `editTableCells`**: 여러 행 · 여러 칸을 편집 기록 한 건 · 행 다시 읽기 1 번으로 쓴다. 「Editable」 열의 데이터 행 칸만 쓰고, 편집 불가 열 · 묶음 / 합계 / 상세 행 · key 필드 · 계산 필드 · 읽지 못한 값 · 없는 행은 사유별로 센다. 붙여넣기 · 채우기 손잡이 · 지우기 (ADR-317 Phase 2 · 3) 가 이 길을 쓴다.
  - 위치: `runtime/catalogPreviewSession.ts` · `runtime/catalogTableController.ts`

### Tests

- `apps/builder/src/preview/catalog/__tests__/adr317BatchWrite.test.tsx` (6 — 변이 RED 6/6) · live `apps/builder/scripts/adr317-p1-editable-unread-live.mjs` · 시제품 `apps/builder/scripts/adr317-phase0-prototypes.mjs`

## [LinkButton — Static color 가 Preview 에서 칠해지지 않던 것 · 세로 여백 식] - 2026-11-25

상태 칠 대조의 범위를 세다가 찾았다. 표 전수 합성 대조 (`adr297DomPaintParity`) 는 불일치 수를 단언하지 않고, 그 남은 행을 실제 노드 트리에서 다시 재는 대조 (`adr297RealPaintParity`) 의 대상 목록은 11-02 에 고정돼 있었다 — 그 뒤 합성 대조에 새로 생긴 LinkButton · TextArea · SelectValue · Button `staticColor: auto` 행은 어디서도 판정되지 않았다. 대상에 넣어 재니 넷 중 LinkButton 하나가 실제로 어긋났다.

### Fixed

- **LinkButton 의 Static color (Black · White · Auto) 가 Preview · Publish 에서 테마 칠 그대로**: Canvas 는 고정 흑백 (검정 85%) 을 칠하는데 DOM 은 `rgb(41, 41, 41)` 이었다.
  - **Why**: LinkButton 은 Button rule 의 칠 트리로 그리고 생성 시트 (`generated/LinkButton.css`) 가 색과 상태를 가진다. DOM binding 이 시트 소유 색을 inline 에서 빼는 분기가 `button` · `actionbutton` 뿐이라, LinkButton 은 해석된 바탕색이 inline 으로 나가 시트의 static · 상태 규칙을 덮었다.
  - 위치: `runtime/domBinding.runtime.ts` (시트 소유 색 분기에 `linkbutton`)
- **LinkButton 의 세로 여백 inline 식에 `undefined`**: `calc((높이 − undefined × 1.2857 − 0px) / 2)` 가 inline 으로 나가 계산 시점에 무효 → 세로 여백 0 (최소 높이가 상자를 지켜 한 줄일 때는 보이지 않았다).
  - **Why**: 가운데 맞춤 여백 식이 `style.fontSize` 를 읽는데, 글자가 시트 소유인 상자 (LinkButton) 는 inline 글자 크기가 없다. 없으면 해석값에서 같은 기기 변수를 만든다.
  - 위치: `runtime/deviceTypography.ts` `catalogDeviceControlCss`

### Tests

- `adr297RealPaintParity`: 대상에 Button `staticColor: auto` · LinkButton `staticColor: auto` · TextArea · TextArea invalid · Select 추가, inline 선언에 `undefined` 가 있으면 실패 (두 수정을 각각 되돌리면 RED).
- live 하니스 `linkbutton-static-color-live.mjs`.
- `adr297DomPaintParity`: 합성 요소가 판정하지 못하는 행 수를 종별로 고정 (`SYNTHETIC_ONLY_ROWS` — 종마다 어디서 판정하는지) — 새 종이 생기거나 행 수가 바뀌면 실패한다 (목록에서 한 종을 빼면 RED). `adr297RealPaintParity` 대상에 LinkButton outline · `staticColor: white` 추가 (테두리 0 이라 그리지 않음 — 0 행).

검증: type-check · shared 2,767 · builder unit 9,868 · parity 2,168 통과. live (dev Builder, headed Chrome, Compare Mode) — 팔레트에서 LinkButton 을 놓고 Design 패널 Static color 를 Black · White · Auto 로: Preview 칠 `rgba(0, 0, 0, 0.85)` · `rgba(255, 255, 255, 0.85)` · Auto 는 흰 바탕에서 검정 스킴, inline 바탕색 · `undefined` 없음, 세로 여백 7px, 높이 Canvas = Preview 32, 콘솔 오류 0 (5/5 PASS).

## [Table 효율 — 칸 선택 스크롤 · 서버 묶음 요청 동시 · 정렬 key · 합계] - 2026-11-25

/simplify 효율 지적 8개를 production 빌드의 Publish 에서 CPU 프로필로 잰 뒤 (headed Chrome · CPU 1x), 비용이 보인 것만 고쳤다. 측정에서 이득이 없던 disabledKeys · 고정 측정기 · 글꼴 상속 (각 0.5% 이하) 과 묶음 표 nest hash (캐시를 넣어도 151 → 146 ms) 는 그대로 두었다.

### Performance

- **칸 범위가 있는 Table 의 스크롤**: 칸이 붙을 때마다 행 전체 (가상 Table 은 10,000 행) 로 위치표를 새로 만들던 것을, 행 목록이 같은 배열이면 다시 쓴다. 10,000 행 · 600 frame 스크롤에서 그 일이 1,582 → 24 ms, 전체 9,562 → 8,155 ms (frame 당 16.96 → 14.58 ms).
  - **Why**: 위치표가 행 순서에만 달렸는데 칸마다 계산했다 — 가상 Table 은 행이 같으면 key 목록을 같은 배열로 유지한다 (`heldRowWindow`).
  - 위치: `runtime/tableCellSelection.ts` `places`
- **서버가 묶는 Table 의 열린 묶음 요청**: 같은 단계의 열린 묶음을 동시에 (한 번에 최대 6 — 브라우저의 host 당 연결 수) 요청하고, 하위 단계는 그 묶음 응답 직후 이어 간다. 열린 묶음 12 · 응답 100 ms 에서 정렬 뒤 마지막 응답이 2,755 → 860 ms.
  - **Why**: 서로 무관한 요청을 for 루프에서 하나씩 기다렸다 — 표는 모든 묶음이 끝난 뒤에야 다시 그려진다.
  - 위치: `runtime/catalogPreviewSession.ts` `syncGroupRows` · `catalogRequestSlots`
- **정렬 · 검색의 행 key 매기기와 합계**: key 를 원본 순서로 매기려고 보이는 행 전체를 정렬하던 것을 원본 자리 표시로, 합계는 행마다 template 객체 2개를 만들던 것을 필드 직접 읽기 (`rowValueOf` — 필터와 같은 읽기) 로. 10,000 행 정렬 클릭 243 → 213 ms.
  - 위치: `runtime/dataBinding.ts` `boundRowsOf` · `catalogRowTotals`

### Tests

- unit `tableCellSelectionPlaces` (칸 표시 150 번에 위치표 150 번 → 1 번 이하 · 정렬 · 열 이동 뒤 다시 읽음) · `adr315ServerRows` 「the open groups' rows are asked for at once」 (수정을 되돌리면 RED).
- 측정 하니스 `datagrid-table-vs-tanstack-live.mjs`: `--with` (기능만 켜고 확인 생략) · `--profile-fns` · `--latency` · `--measure-group-sync` · `--check-cellsel`.

검증: type-check · shared 2,767 · builder unit 9,868 통과. live (production 빌드 Publish) — `--check-cellsel` 10,000 행 범위 12 칸이 창 이동 뒤에도 같고 복사 4 행 × 3 열 PASS · `--check-totals` · `--check-authored-group` · `--check-group --column-origin` · `--check-server group|pin --display more` PASS (하니스 머리말의 조건대로 — 조건 없이 돌린 첫 실행의 FAIL 은 호출 잘못).

## [Table 고정 열 경계선 — Canvas 레이아웃에도 1px] - 2026-11-25

/simplify 정리 (derived 값 허용 목록 통합) 중에 찾았다. 고정 열의 경계선 (Column · Cell rule 의 `pinned-edge` 1px) 을 DOM 은 테두리로 그려 내용 상자가 1px 좁아지는데, Canvas 레이아웃 엔진 입력에는 그 선이 없었다.

### Fixed

- **end 쪽 고정 열의 머리글 내용이 Canvas 에서 1px 왼쪽 · 1px 넓게**: 메뉴 있는 열의 머리글 버튼이 DOM x 1 · 폭 637.33, Canvas x 0 · 폭 638.33 이었다. 이제 Canvas 엔진 입력에도 그 선의 폭이 들어간다 (두 쪽 모두 x 1 · 637.33).
  - **Why**: 고정 열의 선 (ADR-315 Phase 4) 은 DOM 쪽 목록에만 있었고, 레이아웃 쪽 목록은 Phase 6 에서 병합 선 · 합계 행만으로 따로 만들어졌다. 두 목록을 표 하나로 합치면서 차이가 드러났다.
  - 위치: `runtime/libraryVisual.ts` `OWN_DERIVED_VARIANTS` (`pinnedEdge` → 엔진 입력 포함)

검증: unit `adr315Columns` — 고정 열 Column 의 엔진 입력 `borderRight` 1px (수정을 되돌리면 `0px` 로 RED). live `table-pinned-edge-live` 3/3 (start · end 고정 열 머리글 버튼 x · 폭 Canvas = DOM, page error 0) — 수정을 되돌리면 end 열 FAIL.

## [S2 대조 남은 차이 4 — Disclosure compact · SelectBox 가로 · ListBox 아이콘 · frame 언어 서체] - 2026-11-25

사용자 「알고 남겨 둔 차이 다시 체크해줘」 → 「모두 수정해」. 2026-11-24 S2 대조 뒤 남겨 둔 네 가지를 설치 S2 1.8.2 소스와 다시 대조해 고쳤다.

### Fixed

- **Disclosure compact 의 제목 줄 버튼**: compact 에서도 한 단계만 작아졌다. S2 (`Disclosure.tsx:273`) 대로 compact 는 두 단계 (M → XS · L → S), regular · spacious 는 한 단계 (`CATALOG_SIZE_STEP_COMPACT`, 밀도를 바꾸면 바로 따라감).
- **SelectBox 가로 배치**: 행을 23 · 2 · 23 으로 적어 S2 와 달랐다 (라벨 · 설명 위치, 그림 없는 상자 높이 84). S2 대로 `min-content 2px min-content` · `grid-auto-rows: 1fr` — 그림이 첫 두 행을 걸쳐 라벨 행 46 · 설명은 2px 행 위 가운데, 설명이 없으면 그림 48 이 라벨 행, 그림이 없으면 라벨 맨 위 · 설명은 남는 행 (상자 80). DOM 은 S2 의 `:has` 블록 그대로, Canvas 는 같은 rule 항목을 상자가 보이는 부품으로 읽는다 (`catalogSelectBoxContentStyle`). 설명을 비우면 설명 요소가 없다 (S2 처럼).
- **레이아웃 엔진 — 여러 행을 걸친 항목**: 모자란 크기를 고정 트랙 (`2px`) 에도 나눠, 걸친 그림이 있는 행이 작게 나왔다. CSS Grid §12.5.1 대로 content 크기 트랙에만 나누고, 고정 트랙은 자기 길이로 센다 (높이가 확정된 두 번째 배치도 같은 값).
- **ListBox 항목 아이콘**: 16 고정 · 항목 가운데 · 간격 6 고정이었다. S2 `listboxItem` 대로 아이콘이 있는 항목은 grid — 아이콘 = 글자 줄 높이 (`1lh`, M 18 · L 20), 라벨 줄에 맞춤, 간격 `text-to-visual` (6/14 em), 좌측은 항목 여백 (`edge-to-text`).
- **ja · zh frame 안 Text 서체**: frame `locale` 이 frame 서체만 바꾸고, 안의 Text 는 문서 서체를 inline 으로 써서 Pretendard 로 남았다. Text 의 상속 서체를 가장 가까운 언어 (frame · 사이트) 로 고른다 — Canvas 와 Preview 모두 S2 일본어 · 중국어 서체.

검증: unit — `s2DisclosureHeaderAction` (compact) · `selectBoxGroupS2` 2 (가로 · 라벨만 · 그림 없음) · `s2ListBoxItemDetails` 1 · `s2FrameLocaleTextFont` 1 · 엔진 `grid_spanning_item_skips_fixed_tracks`, 갱신 `adr275PositionPredicates` · `drawnBoxModel` · parity `selectionComposites` (그림 없는 상자 84 → S2 80). 원복 RED — TS 8행 · 엔진 2행 모두 RED. 스위트 — builder · shared · rendering · parity 88 파일 · 엔진 528. live `s2-remaining-diffs-live` 6/6 (Canvas = Preview: compact 버튼 XS, SelectBox 라벨 y 32 · 설명 y 56 · 라벨만 상자 86, ListBox 아이콘 18 · 간격 6 · 라벨 줄, ja Text `adobe-clean-han-japanese`, page error 0).

## [Text 의 HTML tag — 제목은 Text 의 h 태그 · Font Size 의 Heading 묶음 = h1 ~ h6] - 2026-11-25

사용자 「heading 은 XS ~ XL 사이즈 지정이 아닌 h 태그로 되는 것이 맞지 않나 · 퍼블리싱 때도 span 이 아닌 h 태그」 → 「컴포넌트를 추가하면 컴포넌트가 또 늘어난다 · Text 컴포넌트 프로퍼티에 Tag 옵션」 → 「진행해」 → 「tag 를 h 로 바꾸면 Font Size 의 heading 도 XS ~ XL 이 아니라 h tag 의 사이즈로」 → 「1번으로 진행」. Text 탭 Font Size 메뉴가 어떤 노드에나 「Heading XS ~ XL」 을 내놓아, Text 에 고르면 제목처럼 보여도 Publish 에서 `span` 이었다. Heading 컴포넌트는 팔레트에 없어 (템플릿 안 제목만) 사용자가 h 요소를 놓을 길이 없었다.

### Added

- **Text 의 「HTML tag」 칸** (Property 탭 Behavior — `span` (기본) · `p` · `h1` ~ `h6`): RAC `Text` 의 `elementType` 으로 Preview · Publish 요소가 바뀐다. 컴포넌트를 늘리지 않는다 (frame 의 HTML tag 와 같은 방식 — 키 · 라벨 같음). slot 역할이 있는 부품 Text (라벨 · 설명) 에는 칸이 없다. 값이 없으면 칸에 `span` 이 보이고 문서 · 코드 보기에는 아무것도 쓰지 않는다 (`defaultWhen` — `default` 로 두면 모든 Text 의 해석 props 에 실려 코드 보기가 `<Text elementType="span">` 을 썼다, builder unit 23 실패로 확인).
  - Canvas 는 브라우저와 같이 그린다 — `h1` ~ `h6` 은 부모 글자 × h 배수 (h1 2 · h2 1.5 …) · bold 700, `p` 는 부모 글자 (`compositionRoot.ts` `inheritedFontOf` — Heading 과 같은 `headingFont.ts`). 작성한 글자 크기 · 굵기가 이긴다.
  - D2: S2 `Text` 에 없는 RAC prop — `d2Provenance.ts` `Text.elementType: "rac"`. 위치: `catalog/document/textElementType.ts` · `Text.binding.ts` · `domBinding.runtime.ts` · `codeCatalogLibrary.ts` (Text 정의가 받는 prop)
  - Heading 컴포넌트는 그대로 — Dialog 제목처럼 RAC `Heading slot="title"` 이 대화상자 이름을 잇는 자리에 남는다.

### Changed

- **Font Size 메뉴의 Heading 묶음 = h1 ~ h6, 제목 요소에만** — Heading 노드와 HTML tag 가 `h1` ~ `h6` 인 Text 에서 「h1 · 32 · h2 · 24 …」 (부모 글자 × h 배율 — 부모 20 이면 h1 · 40) 를 보이고, 고르면 태그가 바뀐다 (Text 는 HTML tag, Heading 은 `level`) — 직접 쓴 글자 크기는 같은 편집에서 지운다 (Undo 한 번). 「Reset」 은 지금 태그의 크기. 그 밖의 노드는 Body XS ~ XL 만.
  - **Why**: 메뉴의 옛 Heading XS ~ XL 은 S2 제목 글꼴 토큰 (18 · 20 · 22 · 28 · 36) 이라 태그와 따로 놀았다 — h2 인데 18 이 되거나, `span` 에 주면 제목처럼 보여도 화면 읽기 프로그램 · 검색엔진에 제목이 아니었다.
  - 이미 저장된 제목 토큰은 그대로 그려지고 칸에는 「H L」 처럼 보인다 (마이그레이션 없음).
  - 위치: `propertyUnitPresets.ts` `headingTagFontSizePresets` · 프리셋 `onSelect` (`PropertyUnitInput.components.tsx`) · `TypographySection.tsx` · 부모 글자 크기 `compositionRoot.ts` `parentFontSize` (host `useParentFontSize`)

### Tests

- `textElementType.test.tsx` — 칸 목록 · slot 숨김, DOM 태그 (span · h2 · p), Canvas h2 = 24 · 700, tag 편집 · Undo, 작성값 우선. 원복 RED 3 (DOM · Canvas 두 곳을 되돌림).
- `adr298Phase2Panel.test.tsx` — Font Size 묶음: Text = Body, h2 Text = h1 · 32 … h6 · 10.72, h1 고름 = HTML tag h1 + 직접 쓴 크기 삭제, Heading 의 h4 = `level` 4. 원복 RED 2 (프리셋 `onSelect` 를 끔).
- live (Playwright · 5173): Property 「HTML tag」 칸에서 h2 를 고름 → 문서 `elementType` h2 · Canvas 24 · 700 (상자 높이 36) · Font Size 메뉴 Body · Heading · slot Text 는 칸 없음 · Publish `<h2 class="react-aria-Text">` 24px · 700 (높이 36) · 기본 Text `<span>` · page error 0. h 단계: 글자 20 frame 안 h2 Text 의 메뉴 = h1 · 40 … h6 · 13.4 (현재 h2 체크) · 12 를 쓴 뒤 h1 → tag h1 · 직접 쓴 크기 없음 · Canvas 40 · 700 · 칸 40 · Undo 한 번에 h2 · 12 · Publish `<h1>` 40px · 700 · page error 0.

## [배포 재개 — Builder 번들 상한 재승인 · RAC 정적 조회] - 2026-11-25

사용자 「번들 재측정 진행해」 → 「1안과 RAC 동적 조회 수정을 함께 진행해」. gh-pages 배포가 2026-11-03 `c826549b4` 뒤 멈춰 있었다 — 배포 workflow 의 「Initial bundle ceiling」 단계가 `bbca53c78` (Builder 1,421,465 > 그때 상한 1,414,000) 부터 실패했다. 11-16 의 상한 갱신 (1,435,351) 은 Phase 증가분만 더해 실제 값 (그때 이미 1,550,233) 보다 낮았다.

### Fixed

- **배포 재개 — Builder initial 상한 1,435,351 → 1,650,000 B gzip** (사용자 재승인, 절대값 기준): `deploy.yml` · `adr201-bundle-gate.mjs` · CLAUDE.md 성능 표 · ADR-201 재승인 절. Preview 327,000 · 만료 2026-12-25 는 그대로. 로컬에서 같은 단계를 돌려 통과 (1,629,237 · 172,215).
- **Builder 첫 화면 번들 −14,487 B · Publish −15,182 B gzip**: Preview DOM 이 RAC 컴포넌트 · slot context 를 이름 글자로 꺼내 (`RAC[name]` 꼴 세 곳 — `racSlotScope.tsx` · `domBinding.runtime.ts` 바인딩 컴포넌트 · 고아 항목 host) 번들러가 RAC export 전체를 첫 화면 공용 chunk 에 남겼다 (`792815efc` 에서 +34,637 B). 정적 표 두 개로 바꿨다.
  - **Why**: 계산된 이름으로 네임스페이스를 읽으면 어떤 export 가 쓰이는지 정할 수 없어 전부 남는다.
  - 회귀 테스트 `racSlotStaticLookup.test.ts` — 표가 모든 바인딩 · host · slot context 이름을 덮는지 (Sheet 계열 5 개를 놓친 것을 이 테스트가 잡았다), 이름 글자 조회가 다시 생기지 않는지. 원복 RED 2/2.
  - 확인: 팔레트 93 항목 Publish 스윕 (`s2-text-inherit-sweep-live.mjs`) — 글자 149 일치 · page error 0.

## [overlay 여백 S2 대조 — Dialog 32 · picker 목록 8] - 2026-11-24

사용자 「overlays - popover들의 padding 값들이 모두 각각 다른데 레퍼런스와 비교해봐」. S2 는 Popover 의 `padding` (`default` 8 · `none` 0) 과 안쪽 상자의 여백으로 정한다 — Popover 8 · 자유 내용, ContextualHelp none · 24 (폭 268), Menu none · 8, Picker · ComboBox none · 목록 8, DatePicker 달력 none · 24 / 16 (바깥 `div` 의 `gap: 16` 은 자식이 RAC Dialog 하나라 달력 ↔ 시간 칸에 닿지 않는다). Popover 쪽 대조 결과 다른 곳은 picker 목록 하나였다. 이어서 사용자 「dialog, alert dialog, custom dialog, fullscreen dialog, sheet, popover, PreviewTrigger, ContextualHelp 모두 padding 값이 일정하지가 않다」 — S2 의 Dialog 여백은 `size` 와 무관하게 32 (`Dialog.tsx` header · content · footer, `CustomDialog.tsx` · `FullscreenDialog.tsx` 의 `sm` 이상) 이고 제목 ↔ 본문 16 (header `marginBottom`) 이다. S2 에서도 종류별 값은 다르다: 모달 Dialog 32 · Popover 8 · ContextualHelp 24.

### Fixed

- **Dialog · AlertDialog · CustomDialog 여백 40 → 32, 제목 ↔ 본문 12 → 16**: Dialog rule 의 크기별 여백 (16 · 24 · 40 · 48 · 56 — 옛 RAC starter `Dialog.css` 40 기준) 을 모든 크기 32 · gap 16 으로. FullscreenDialog template 의 여백 작성값 (32) 은 rule 과 같아져 뺐다 (gap 32 = S2 grid 행 32 는 유지).
- **Dialog · AlertDialog 본문 ↔ 버튼 16 → 32** (사용자 「S2 와 다른 곳 셋도 맞춰」): S2 footer 행의 `paddingTop: 32` — Dialog 의 gap 16 에 자기 ButtonGroup 의 위 여백 16 (Dialog rule `staticSelectors` `> .react-aria-ButtonGroup` — 생성 CSS 와 Canvas part rule 이 같이 읽는다). Sheet 는 template 의 `marginTop: 16` 으로 이미 32 였다.
- **FullscreenDialog 제목 줄 — 모바일에서 세로** (사용자 「모바일에서는 column 이 되어야 짤리지 않는다」): 제목 · 부제 · 버튼의 가로 줄이 좁은 화면에서 Dialog 밖으로 넘쳤다. 기본 원본 (library) template 노드도 이제 breakpoint 층 (`responsive` — tablet · mobile 의 layout · visual) 을 갖는다 — resolver 가 project 노드와 같은 순서로 적용하고, 자식 복사 (`materialize`) · 잠금 해제 사본 (`originFork`) 이 노드의 `responsive` 로 옮긴다. FullscreenDialog 의 mobile 층: 줄 `column` · 왼쪽 정렬, 부제 왼쪽, 버튼 오른쪽 (S2 `sm` 미만 배치 — 경계는 우리 mobile 768). Design 패널 Mobile 에서 보이고 고칠 수 있다.
- **팔레트 Dialog 폭 310 → 480**: S2 Dialog 의 `size` (S · M · L · XL) 는 Modal 폭이다. Dialog 원본에 `size` (기본 M) 를 두고 Modal 에 묶었다 (AlertDialog · CustomDialog 와 같은 모양, 패널 schema `component-dialog`). 전에는 Modal 에 size 가 없어 Dialog 자기 폭 310 이었다.

- **Select · ComboBox 목록 여백의 기록값 4 → 8**: DOM 은 ListBox rule 의 `inPopover` 상태 (S2 목록 `padding: 8`) 로 8 이었는데, 기록 (Design 패널 · Canvas 상자) 은 독립 목록의 4 였다.
  - **Why**: `_inPopover` 파생이 목록 항목에만 있고 목록 자체에는 없었다.
  - 수정: Popover 안 ListBox 에 `_pickerList` 파생 (`presence.ts`), `catalogBoxModel` 이 rule 의 `inPopover` padding 을 읽는다 (작성값이 이긴다).

### Tests

- `s2PopoverPadding` 14 (Popover · ContextualHelp · ActionMenu · Select · ComboBox · DatePicker · DateRangePicker 의 Popover · 안쪽 여백, Dialog · AlertDialog · CustomDialog · FullscreenDialog · Sheet 의 여백 · gap · 버튼 위 여백 = S2, 팔레트 Dialog 의 Modal size M, FullscreenDialog 제목 줄 desktop row · mobile column). live: ComboBox 목록 — Canvas 그리는 여백 8 = Publish 8 · Popover 0. `apps/builder/scripts/s2-overlay-padding-live.mjs` — 여덟 overlay 를 Publish 에서 열어 Canvas record 와 대조 8/8 (여백 · gap · 버튼 위 여백 · Modal 폭 480). `s2-fullscreen-dialog-mobile-live.mjs` — Canvas desktop row · Mobile column, Publish 창 1400 row · 390 column, 넘침 0.

## [Popover 글자 — S2 `Popover` 처럼 글자 값 없음] - 2026-11-24

사용자 「s2 레퍼런스에 맞춰」 (Popover 제목). S2 `Popover.tsx` 는 RAC Popover 안에 `div` (padding 8) 만 두고 글자 값을 주지 않는다 — Dialog 를 넣는 구성도 아니다 (앞선 「Popover 안 Dialog 의 `title-2xl`」 설명은 틀렸다).

### Changed

- **Popover 의 크기별 글자 14 제거**: 안 글자는 페이지 글자를 받는다. 자기 값이 있는 글자 (설명 12 · 목록 항목 · 메뉴 항목) 는 그대로.
- **Popover 제목**: 크기 단계 S (14) 를 빼고 브라우저 h3 (페이지 16 × 1.17 = 18.72, bold) 를 따른다.
  - **Why**: `.claude/rules/text-font.md` — S2 에 없는 owner 글자 값은 두지 않는다.
  - 위치: `componentRulesTable.ts` Popover `sizes` · `reusableOriginLibrary.ts` Popover 제목 template · 생성 `Popover.css`

### Tests

- `s2TextInheritsFont` Popover 제목 18.72 · `adr254ContainerParts` popover 제목 (자기 글자 없음).
- live: Publish 에서 Popover 를 열어 제목 h3 18.72 · 700 · 설명 12 = Canvas. 팔레트 sweep 그려지는 Text 149 · h 12 모두 Canvas = Publish.

## [frame HTML 태그 칸 · Layers 이름 · 그룹 이름 · Section 컴포넌트 삭제] - 2026-11-24

사용자 「section 컴포넌트는 … html tag 용이다. 필요한지 판단해」 → 「frame 프로퍼티 옵션으로 div · section · header · footer · nav · article · aside」 · 「Layers 트리에도 변경된 tag 로」 · 그룹은 이름으로 구분 · 명칭 정리 「넣어」.

[ADR-316](adr/completed/316-frame-element-type-section-removal.md) Implemented 2026-11-24 (G4 — 사용자가 본인 Builder 에서 확인: 「확인했다. 커밋해」).

### Added

- **frame 의 「HTML tag」 칸** (Design 패널 Behavior): `div` (기본) · `main` · `section` · `header` · `footer` · `nav` · `article` · `aside`. 상자의 모양 · 배치는 그대로이고 Preview · Publish 의 요소만 바뀐다 (role 은 쓰지 않는다 — ADR-130). Code 보기는 그 태그로 쓴다 (`<section>` — `elementType` 속성 · import 없음). 목록 밖 값은 `div`.
  - D2: S2 · RAC 에 없는 composition 확장 (`d2Provenance.ts` — 이름은 RAC `Text` 의 `elementType`).
  - 위치: `catalog/document/frameElementType.ts` (신규) · `itemLinks.ts` `RULE_TYPE_PROP_CONTRACTS.frame` · `domBinding.runtime.ts` frame binding · `codeView/generate.ts`

### Changed

- **페이지 본문이 `<main>`** (사용자 결정 「페이지 본문 = main」): 레이아웃이 없는 페이지는 Preview · Publish 에서 본문 상자가 `<main>` 이다 (전에는 `div`). 본문 안 frame 을 `main` 으로 고르면 그 frame 이 main 이고 본문은 `div` 로 물러난다 (`main` 중첩 없음). 레이아웃을 쓴 페이지의 본문은 `div` 그대로 — content 자리의 main 은 ADR-304.
  - 위치: `catalog/runtime/pageMain.components.tsx` (신규) · `domBinding.runtime.ts`
- **Layers 의 frame 행 이름**: 사용자 이름 → 태그 (`div` 가 아닐 때 — 「section」 · 「nav」 …) → 「Frame」. 전에는 타입 이름 「frame」 (소문자) 그대로였다.
  - 위치: `catalogRuntime/layerTree.ts` `nameOf`
- **Design 패널 제목도 같은 이름**: frame 을 고르면 패널 제목이 Layers 와 같은 이름 (「section」 · 「Frame」) 이다. 태그는 그 위치에서 유효한 값이다 — 컴포넌트 instance 안 frame 의 태그를 바꿔도 Layers · 제목이 따라오고, slot 인 frame 은 둘 다 slot 이름을 먼저 보인다 (`catalogRuntime/frameName.ts`, ADR-316 리뷰 round 1 · 2). 제목은 step 마다 다시 읽는다 — 전에는 선택이 바뀔 때만 읽어 이름 변경이 바로 보이지 않았다.
  - 위치: `panels/properties/catalog/CatalogPropertiesPanel.runtime.ts`
- **그룹화한 상자의 이름 「Group」**: 그룹 명령이 만드는 frame 에 노드 이름 「Group」 을 붙인다 (Layers 에 「Group」 — 이름을 바꾸거나 지울 수 있고, 요소 · role 은 frame 그대로). 그룹에 HTML 태그를 정하면 Layers · 패널 제목이 그 태그를 보인다 (`div` 로 되돌리면 다시 「Group」, 직접 적은 이름은 그대로 — 사용자 보고 「group화 후 tag를 nav로 변경시 … group로 유지된다」 수리).
  - 위치: `catalogRuntime/canvasMenu.ts`
- **그룹 명령 이름 통일**: 단축키 목록 「프레임 / 프레임 해제」 (`Frame` / `Unframe`) · 메뉴 「그룹 만들기」 (`Group selection`) → 「그룹화 / 그룹 해제」 (`Group` / `Ungroup`).
  - 위치: `i18n/messages/{ko-KR,en-US}.ts` · `config/keyboardShortcuts.ts`

### Removed

- **Section 컴포넌트** (사용자 「삭제」 2026-11-24): 팔레트 · catalog 등록 · binding · rule · 생성 CSS · AI catalog 에서 지웠다. 이름과 달리 `<section>` 이 아니라 `div.react-aria-Section` 이었고 (renderer 미등록) frame 과 padding 기본값만 달랐다 — 시맨틱 요소는 frame 의 HTML tag 칸으로 정한다. **Breaking**: 마이그레이션 코드가 없어 Section 노드를 가진 옛 프로젝트는 열리지 않는다 (개발 단계 방침). Nav 는 실제 `<nav>` · 현재 경로 표시가 있어 그대로다.
  - 위치: `bindings/Section.binding.ts` · `styles/generated/Section.css` (삭제) · `componentCatalog.ts` · `componentRulesTable.ts` · `rulePaint.ts` · `componentTraits.ts` · `s2PropAlignment.ts` · `paletteItems.ts`

### Verified

- 단위 `frameElementType.test.ts` · `frameElementType.test.tsx` (원복 RED 4/4), live `apps/builder/scripts/frame-element-type-live.mjs` 14/14 (리뷰 round 1 · 2 수리 · 페이지 main 추가 뒤 — instance 안 frame 의 이름 · slot frame 의 패널 제목 · 패널 선택 실패를 통과시키던 스크립트 · 일곱 태그 상자 대조 추가) — 팔레트에 section 항목 없음, Design 패널에서 section 선택 → Layers 「section」, 액션 바 Group → Layers 「Group」, Publish `<section>` · `<div>`, section 안 h1 글자 Canvas = Publish (32 · 700, Chromium · WebKit 모두 section 안 h1 축소 없음).

## [Text · Heading 글자 규칙 확정 — 브라우저 h 기본값 바닥 · Heading 700 · S2 대조 3건] - 2026-11-24

사용자 「TEXT size 에 대한 rule 을 정해야한다」 → 「700 으로 규칙 확정하고 세 가지 진행해」. 글자 값의 층 (문서 기본 → 브라우저 기본 → 상속 → owner → 작성값) 과 구현 계약을 규칙 파일로 정하고, 팔레트 전체 대조 (Canvas ↔ Publish) 에서 나온 세 가지를 S2 대로 고쳤다.

### Changed

- **Heading 기본 굵기 600 → 700**: owner 가 굵기를 주지 않는 Heading 은 브라우저 h 기본 bold (S2 `Heading` 은 자기 글자가 없다). InlineAlert 제목 (S2 `title-sm` bold) 도 700.
  - 위치: `componentRulesTable.ts` Heading `textWeight` · `Content.css` (Heading 글자 값 제거)
- **Dialog 계열 제목 크기 (S2 `Dialog.tsx` `title-2xl` 22 · 행간 26)**: Dialog · AlertDialog 18 → 22, FullscreenDialog 20 → 22 (Heading XXL). CustomDialog 는 S2 가 제목에 값을 주지 않아 크기 단계를 빼고 RAC Dialog 의 title h2 (부모 × 1.5 = 24) 를 따른다 — Canvas 도 RAC Dialog 가 주는 level 2 를 읽는다 (`headingFont.ts` `catalogHeadingLevel`).
- **ContextualHelp 제목 14 · 700 → 18 · 800**: S2 `ContextualHelp.tsx` 제목 글꼴 `heading-xs` (18 · 행간 22, extra-bold). 다른 owner 제목 (Dialog · FullscreenDialog · AlertDialog · IllustratedMessage · InlineAlert = S2 `title-*` bold 700, 메뉴 섹션 = `ui` bold) 은 대조 결과 그대로.
  - 위치: `reusableOriginLibrary.ts` Dialog · AlertDialog · FullscreenDialog · CustomDialog · ContextualHelp 제목 template
- **Disclosure 제목 줄**: Heading 의 `font-size: inherit` 를 지우고 (S2 `headingStyle` 은 글자 없음 — 줄 글자 × 1.17), trigger Button 이 크기별 자기 글자 (S2 `buttonStyles` `title-sm` · `title` · `title-lg` · `title-xl`, 줄 높이 `ui`) 를 갖는다. 보이는 제목은 그대로 14 · 16 · 18 · 20 bold.
  - **Why**: Heading 이 부모 글자를 그대로 받아 DOM 은 16 · 400, Canvas 기록은 18.72 로 갈렸다 (Design 패널 숫자).
  - 위치: Disclosure rule `staticSelectors` · `sizeSelectors` · `rulePartRules.ts` (trigger `var(--text-*)` → 토큰)

### Fixed

- **Breadcrumb 현재 조각의 글자 기록값**: 그리는 굵기는 700 인데 노드 기록 (Design 패널) 은 400 이었다. 조각 글자에 굵기를 박지 않고 (part rule), 현재 조각의 bold (S2 `currentStyles`) 를 상속받는다.
  - **Why**: Breadcrumbs · Breadcrumb part rule 이 글자에 굵기 400 을 줘 상속을 막았다.
  - 위치: `manualBoxRules.ts` · `compositionRoot.ts` `declaredFont`
- **Publish 의 h 글자 reset 제거**: layer 밖 `h1~h6 { font-size: inherit; font-weight: inherit }` 가 브라우저 h 기본값과 Heading 굵기를 지웠다 (S2 · RAC 에 없음). Preview 에는 없던 reset 이라 두 화면이 갈렸다.
  - 위치: `apps/publish/src/styles/index.css`

### Documentation

- **`.claude/rules/text-font.md`** (신규): Text · Heading 글자 값의 층 순서 · 구현 계약 (글자를 그리는 요소가 자기 글자 · 앱 reset 금지 · Size 칸 없음 · 기록 = 그리는 값 · 계산 한 곳) · 확인 방법.

### Tests

- `s2TextInheritsFont` +5 (Breadcrumb 현재 조각 · Disclosure 제목 줄 · owner 제목 굵기 · owner 제목 크기 S2 대조 · reset 금지 정적 검사), `adr254ContainerParts` Dialog 제목 22.
- live (Publish 에서 열어 대조): Dialog · AlertDialog · FullscreenDialog 22 · 700 · 26, CustomDialog 24 · 700 · 36 (h2), ContextualHelp 18 · 800 · 22 — Canvas 기록과 같다., Heading 굵기 기대값 700 · `disclosureHeaderFontInherit` 새 계약.
- live 하니스 `apps/builder/scripts/s2-text-inherit-sweep-live.mjs`: 팔레트 93종 + 단독 Heading — 그려지는 Text · Heading 149 개 · 보이는 h 요소 12 개의 Canvas 기록 = Publish DOM (크기 · 굵기 · 행간 · 상자 높이).

## [S2 대조 — Provider · Disclosure · Toast · 목록 로딩 · 목록 항목 (부록 D.1 「대응 있음」 5줄)] - 2026-11-24

사용자 「S2 와 대조 진행해」 → 「권장대로 세가지 진행해」 (결함 먼저 · 값 차이 · 새 기능 3건 제외). 설치 S2 1.8.2 소스와 대조한 차이를 고쳤다.

### Fixed

- **Publish 링크 주소**: Publish 는 `#/about` 경로인데 링크의 `href` 가 `/about` 이라 휠 클릭 · 새 탭 · 주소 복사가 빈 페이지였다. RAC `RouterProvider` `useHref` 로 `#/about` 을 쓴다 (`CatalogPreviewView` `hrefOf` · `catalogHashHref`).
- **Publish ⌘ · Ctrl 클릭**: 클릭을 먼저 가로채 같은 탭에서 이동했다. Publish 에서는 브라우저에 맡긴다 (새 탭). Builder Preview 는 그대로 (⌘ 클릭 = Compare Mode 선택).
- **OS 다크 모드 따라가기**: system 테마가 페이지를 열 때 한 번만 OS 모드를 읽었다. Preview · Publish 세션이 OS 전환을 구독해 새로고침 없이 바뀐다 (Builder 와 같은 `onSystemColorSchemeChange` 하나).
- **`color-scheme`**: 문서에 없어 다크 테마에서 스크롤바 · 자동완성 바탕이 밝게 남았다. 테마 적용이 `<html>` 에 그 모드를 쓴다.
- **frame 언어**: frame `locale` 이 날짜 형식만 바꾸고 요소에 `lang` 이 없었다. 요소에 `lang` 을 붙이고, 문서가 기본 서체면 그 frame 이 S2 의 그 언어 서체 (일본어 · 중국어) 를 쓴다. 서체 내려받기도 글자마다 가장 가까운 `lang` 을 읽는다.
- **Toast 모양의 쌓인 뒤 조각**: 앱 Toast 모양을 골라도 2 개 이상 쌓이면 뒤 조각이 테마 variant 색이었다. 모양 상자를 그 자리에 (내용은 숨김) 그린다.
- **Toast 닫기 버튼 이름**: 「Close」 · 「닫기」 → S2 `dialog.dismiss` 「Dismiss」 · 「무시」 (앱 region · Toast 노드).
- **Tree 항목 자기 데이터 구간의 load-more**: Tree 의 항목이 자기 데이터로 반복될 때 load-more 항목이 없어 첫 페이지 (100 행) 에서 멈췄다 (ADR-310 Decision 11 구간 sentinel 이 Tree 에만 빠져 있었다).

### Changed

- **Disclosure 제목 · 패널 (S2 `DisclosureTitle` · `DisclosurePanel`)**: 제목 글자 12 · 14 · 16 (600) → 14 · 16 · 18 · 20 bold (title 단계, 줄 높이 `ui`), trigger 좌우 여백 · chevron 간격 = 높이 × 3/8 − 1 (M 11 — 전 12 · 4), 패널 글자 = body 16 (size 와 무관), 패널 여백 위 8 · 아래 16 · 좌우 8 · 9 · 12 · 15, 펼칠 때 높이 전환 150ms (모션 줄이기면 없음). 제목 줄의 ActionButton 은 Disclosure 보다 한 단계 작고 quiet 를 받는다 (패널 안 버튼은 그대로).
- **목록 더 불러오기 스피너**: 모두 S (16) · 영어 고정 이름 → S2 대로 Tree · ListView (GridList) · Table 은 M (32) 가운데, ComboBox · Picker · Menu 는 S, CardView 는 없음. 이름은 S2 `*.loadingMore` 현지화 문구 (「추가 로드 중…」 등).
- **비활성 목록 항목**: 행 전체 opacity 0.38 → S2 대로 글자 (라벨 · 설명) 만 비활성 색.

검증: unit — `s2ProviderParity` 2 · `routeParams` 2 · `adr281Inheritance` (frame lang) · `s2ToastShape` 1 · `s2DisclosureHeaderAction` 1 · `adr256DisclosureNodeTree` · `disclosureQuietDensity` 갱신 · `adr310Runs` (Tree 구간 · 스피너) · `s2LoadMoreSpinner` 4 · `s2ListBoxItemDetails` 1. 원복 RED — 결함 7/7, 값 13 행 (중복 1 행은 지움). live — `s2-provider-toast-live` 7/7 (Publish `#/about` · Ctrl 클릭 새 탭 · OS 다크 즉시 · frame `lang` · Toast 쌓인 조각 · 닫기 이름) · `s2-disclosure-listbox-values-live` 6/6 (Canvas = Preview 제목 16 · 700 · 여백 11 · 높이 32, 패널 16 · 8 9 16, 제목 줄 ActionButton S, 비활성 항목 opacity 1). 남은 것: 항목 아이콘 `1lh` (손 `ListBox.css` 경로와 같이 고쳐야 함) · compact 밀도의 제목 줄 버튼 두 단계 · 새 기능 3 (영역별 색 모드 · toast `onClose` · ComboBox avatar 자리). 「버튼 없는 Toast 모양의 자동 닫힘」 은 재현 경로가 없다 (toast Do 검증이 동작 글자와 timeout 을 함께 받지 않는다).

## [Text · Heading 글자 상속 — S2 `Text` · `Heading` 처럼 자기 글자 없음] - 2026-11-24

### Breaking Changes

- **Text · Heading 의 Size 칸 제거**: S2 `Text` · `Heading` 에는 `size` prop 이 없다. 크기 단계는 이제 owner (Table 칸 · Tree 행 · InlineAlert · Dialog …) 와 template 만 내려준다. 글자 크기를 직접 정하려면 Styles 의 Font size 를 쓴다. 문서에 이미 저장된 `size` 값은 그대로 적용된다 (마이그레이션 없음).

### Changed

- **크기 단계가 없는 Text 는 부모의 글자를 상속한다** (사용자 「B 로 진행해 — S2 레퍼런스 대로」):
  - 상속하는 값은 글자 크기 · 굵기 · 줄 높이이고, 부모가 아무것도 정하지 않았으면 문서 기준값 (16 · 400 · 1.5) 이 쓰인다. 그전에는 늘 자기 M (16 / 20) 이었다.
  - 자기 값이 이긴다: owner 가 준 크기 단계나 Styles 에서 쓴 Font size 가 있으면 상속하지 않는다.
  - 화면이 달라지는 곳은 크기를 내려받지 않던 Text 다. 예를 들어 frame 이나 Body 에 Font size 를 주면 안의 Text 가 따라간다. Label · Tag · Button · Dialog Content 안의 Text 는 `data-size` 없이 그 부모의 글자를 받는다.
  - **Why**: RAC `Text` 는 스타일 없는 `span` 이고, S2 `Text` 의 class 는 `styles` 뿐이다 (`src/Content.tsx`). 글자는 부모 상속이나 slot context 의 `styles` 로만 정해진다. composition 은 Text 마다 M 을 늘 써서 부모의 글자를 끊었다.
- **크기 단계가 없는 Heading 은 브라우저의 h 태그 배수로 부모 글자를 받는다** (사용자 「1과2 모두」 · 「0 으로 진행해」):
  - 크기 = 부모 글자 × level 배수 (h1 2 · h2 1.5 · h3 1.17 · h4 1 · h5 0.83 · h6 0.67 — HTML 렌더링 규칙, RAC 기본 level 3). 굵기 600 · margin 0 은 그대로다 (`Content.css`).
  - owner 의 크기 단계 (Dialog · InlineAlert · Popover · Sheet …) · Menu 섹션 Header 의 글자 · 직접 쓴 값이 이긴다. Library 의 Heading 은 거의 모두 이쪽이라 화면 변화가 없다.
  - Heading 안의 Text (AlertDialog 제목) 는 Heading 의 글자를 받는다.
  - **Why**: RAC `Heading` 은 스타일 없는 `h{level}` 이고 S2 는 `styles` 만 더한다 — 혼자 놓인 S2 Heading 의 글자는 브라우저 h 규칙이다. S2 는 사용처마다 context 로 글자와 `margin: 0` 을 준다 (Dialog · InlineAlert · ContextualHelp · Menu 섹션 …).
- 구현:
  - rule 에 `inheritsFont` (`"font"` = Text · `"size"` = Heading) 를 추가했다.
  - 생성 CSS 의 기본 블록과 `Content.css` 의 Text 는 이제 글자 크기 · 줄 높이를 쓰지 않는다.
  - Canvas 는 부모의 DOM 글자를 읽는다 (`domFont` → `derivedProps`, Heading 은 `headingFont.ts` 배수). 부모 글자나 Heading level 이 바뀌면 다시 계산한다. DOM 은 글자 요소에 Canvas 가 계산한 크기를 inline 으로 쓴다 (기존 경로).
- 위치:
  - `packages/shared/src/types/catalog-style.types.ts` · `catalog/generated/componentRulesTable.ts` (Text · Heading) · `bindings/{Text,Heading}.binding.ts`
  - `document/codeCatalogLibrary.ts` · `runtime/compositionRoot.ts` (`inheritedFontOf` · `declaredFont`) · `runtime/headingFont.ts`
  - `packages/rendering/src/renderers/CSSGenerator.ts` (`skipFont`) · `packages/shared/src/components/styles/Content.css`

### Tests

- `s2TextInheritsFont.test.ts` 11개:
  - Text: frame 20 · 700 상속, Body 기준 16 · 1.5, frame 편집 · Undo 추종, 자기 Font size 우선, Size 칸 없음, 생성 CSS 기본 블록.
  - Heading: h3 = frame 20 × 1.17 · 600, level 편집 (h1 → h6) 과 안의 Text 추종, owner 크기 단계 우선, Menu 섹션 제목 14 · 700, Size 칸 없음, 생성 CSS 기본 블록.
  - 원복 RED 10행 (Text 5 · Heading 5 — 배수 · 안의 글자 상속 · level 재계산 · binding 기본값 · rule 표시) 이 각각 반응했다.
  - 기대값 갱신: `adr253FieldPartsDom` (Label · Tag 안 Text) · `adr254ContainerParts` (Dialog) · `rewrapUsedBorder` (줄 높이 1.5) · `codeCatalogLibrary` · `defaultPropsOracle` · `fieldEditor.static` (7단 예시 목록).
- live (Chrome, Compare Mode):
  - Body Font size 24 → 새 Text 의 Canvas 46×36 / 줄 높이 36, DOM 24px / 36px / `data-size` 없음.
  - TagGroup 의 Tag 글자 DOM 14 / 18, Canvas 글자 위치 Mint 111.6 = DOM 111.6.
  - Disclosure · InlineAlert 의 Heading DOM 14 · 600 · margin 0, Disclosure 제목은 비교 경계를 가로질러 어긋남 없음.
  - Table · Tree · ActionBar · InlineAlert 글자는 14 그대로였다.

## [M 크기 글자 S2 정렬 — Table · Tree · ActionBar · InlineAlert · CollectionCard] - 2026-11-24

### Fixed

- **M 크기 글자가 16 으로 그려지던 5곳을 S2 값으로** (사용자 「components library M size fontsize 전체 체크」 → 「5곳 전부 S2 기준으로」 — Library 글자 745개 전수 대조):
  - Table 칸 · 열 제목 16 → 14 (S2 `TableView` `controlFont()`), Tree 행 16 → 14 (S2 `TreeView` `ui`) — 칸 · 열 · TreeItem 의 크기가 안의 Text 에 한 단계 아래로 닿는다 (S 12 · M 14 · L 16). Tree 행은 크기마다 40 을 유지한다 (S2 행 높이).
  - ActionBar 선택 개수 16 → 14 (S2 `ui`), InlineAlert 제목 16 → 14 (S2 `title-sm` — 알림 크기 S 12 · L 16).
  - CollectionCard 설명 (frame 안) Canvas 16 → 12 — Card 의 제목 · 설명 크기가 Content 안 frame 을 건너 닿는다 (DOM 은 이미 12 — Canvas 만 달랐다).
  - **Why**: 글자는 `Text` 노드의 자기 크기 (M 16) 를 쓰는데, 이 owner 들이 S2 처럼 글자 크기를 내려주지 않았다.
  - 위치: `packages/shared/src/catalog/document/sizePropagation.ts` (`CONTROL_TEXT_STEP` · InlineAlert Heading) · `manualBoxRules.ts` (Tree 행 padding 크기별) · `selectionCompositesOrigins.ts` (ActionBar 개수) · `resolution/resolver.ts` (`CATALOG_PART_RULE_FRAMED_WRAPPERS`)

### Tests

- `s2ControlTextFontSize.test.ts` 5 — 원복 RED: sizePropagation (Table · Tree · InlineAlert) · ActionBar template · resolver (CollectionCard) 각각. `adr254ContainerParts` InlineAlert 제목 기대값 갱신, Tree 행 40 은 `adr256Followups` 가 그대로 지킨다. live: 새 프로젝트 Library 와 Compare Mode — Canvas record · Preview DOM 계산값 둘 다 14 · 12, Tree 행 40 · 설명 높이 15 일치.

## [ImageCoordinator — S2 이미지 묶음 공개] - 2026-11-24

### Added

- **ImageCoordinator** (S2 `ImageCoordinator`, 팔레트 content — Skeleton 옆): 안에 넣은 Image 들을 전부 받은 뒤 (또는 Timeout — 기본 5000 ms) 함께 보인다. 자기 상자가 없는 감싸개라 Canvas 에서 빈 것은 점선 자리, 내용을 넣으면 부모 흐름에 그대로 놓인다.
  - **Image group** (Image · ImageCoordinator): 같은 이름끼리 한 묶음 (S2 `group` — 코드의 `createImageGroup()` 대신 이름). 이름이 다른 Image 는 기다리지 않는다.
  - Card · CardView 는 S2 처럼 안의 그림을 늘 함께 보인다 (CardView 는 모든 카드를 한 묶음으로). 받지 못한 그림은 기다리지 않는다.
  - **Why**: 사용자 결정 (2026-11-24 「S2 ImageCoordinator 부분이 S2 레퍼런스 대로 구현」) — 11-23 의 「하지 않음」 을 대체.
  - 위치: `packages/shared/src/catalog/runtime/imageCoordinator.components.tsx` (S2 reducer) · `imageBox.components.tsx` (기다림 상태 `loaded`) · `bindings/ImageCoordinator.binding.ts` · `domBinding.components.tsx` (CardView) · `delegatedDom.runtime.ts` (Card)

### Tests

- `catalogImageBox.test.tsx` · `s2ImageCoordinator.test.tsx` (묶음 · 다른 group · timeout · 실패 그림 · Card · CardView) — 원복 RED 5 종. live `apps/builder/scripts/s2-image-coordinator-live.mjs` 5/5.

## [S2 프로퍼티 후보 구현 — 숨은 RAC 동작 · 패널 칸 · Column 메뉴 항목] - 2026-11-24

### Added

- **Design 패널의 새 칸** (S2 · RAC prop): Focus wrap (Menu · GridList · Tree · TagGroup · Table) · Commit behavior (NumberField) · Form value (Select · ComboBox) · Non-modal (Popover) · Close on press (TooltipTrigger) · Close on select (MenuItem · MenuSection) · 도움말 Popover 배치 (Placement · Offset · Cross offset · Container padding · Should flip — ContextualHelp) · Selection alignment (Calendar · RangeCalendar) · Rounding · Density (ColorSwatchPicker) · Density · Quiet (Accordion — 안의 Disclosure 에 전달) · Density (CardView).
- **MenuSection 선택** (S2 `selectionMode` · `selectedKeys`): 구역마다 단일 · 다중 선택 — 항목 체크는 구역이 저장한다 (ADR-308 모양).
- **SideNav 펼친 항목** (Expanded keys): 하위 항목을 가진 항목만 고른다.
- **LabeledValue · RangeSlider 의 도움말** (S2 `contextualHelp`): 라벨 행에 ContextualHelp — 이름은 라벨을 읽는다.
- **Column 메뉴 항목** (S2 Column `menuItems`): Column 의 「+」 가 MenuItem 을 넣고, Preview · Publish 의 열 메뉴가 Table 항목 뒤에 보인다 (Canvas 는 닫힌 메뉴라 그리지 않음).
- 숨은 RAC 동작 prop 50 (collection · 키보드 이동 · 글자 찾기 · 방향 · Esc · item link 등) 을 코드 보기 · 규칙 Do 로 쓸 수 있다 (패널에는 없음 — 11-11 속성 감사).

### Fixed

- **Publish 에서 CardView · ColorSwatchPicker 의 Density · Rounding 이 사라지지 않는다**: 불러올 때 쓰지 않는 prop 목록 (`UNUSED_PROPS`) 이 지웠다.
- **LabeledValue 도움말 버튼의 이름이 라벨을 읽는다**: RAC field 밖이라 Label 에 id 가 없었다 — 도움말이 있으면 S2 `fallbackLabelPropsId` 처럼 Label 에 id 를 준다.

### Tests

- `s2RacProps.test.tsx` (65) · `s2MenuSectionSelection` · `s2ContainerDensity` · `s2ColumnMenuItems` 외. live `s2-hidden-props-live` 5/5 · `s2-panel-props-live` 5/5 · `s2-visual-props-live` 6/6 · `s2-column-menu-items-live` 3/3.

## [parity 기존 실패 정리 — Meter 채움색 · 공개 컴포넌트 3종] - 2026-11-24

### Fixed

- **Preview · Publish 의 Meter 채움색이 Canvas 와 같다**: 채움이 상태색 본단 (`--informative` 등) 이라 Canvas 보다 어두웠다. S2 `Meter` 와 같은 `-visual` 단 (informative · positive · notice · negative) 으로 바꿨다.
  - **Why**: Canvas 는 S2 `Meter.tsx` fillStyles 대로 `-visual` 단을 그렸고, rule 의 DOM `--fill-color` 만 본단을 가리켰다.
  - 위치: `componentRulesTable.ts` Meter · 생성 `Meter.css`
- **자식 없이 쓴 공개 `<RangeSlider/>` · `<ActionBar/>` 가 오류로 멈추지 않는다** (Code view 가 내보내는 라이브러리): 접힌 기본 자식에 FieldLabel 이 없었고, 값 없는 Avatar · Badge 를 그리려 했다.
  - **Why**: 접힌 기본 자식을 그리는 components 표가 origin template 의 부품을 다 담지 않았다.
  - 위치: `packages/shared/src/components/{RangeSlider,selectionCompositesDefaults}.tsx`
- **공개 `<SelectBoxGroup/>` 이 원본의 기본 선택을 유지한다**: 자식 · 선택을 주지 않으면 원본 template 의 기본 선택을 쓴다.
  - **Why**: 접힌 자식은 template 에서 왔지만 선택은 group 뿌리의 `defaultSelectedKeys` 에 있어 따라오지 않았다.
  - 위치: `packages/shared/src/components/SelectBoxGroup.tsx`

### Tests

- parity 전체 88 파일 2168 건 통과 (두 번 연속). 의도된 변경 (ADR-308 그룹 선택 · SearchField S2 구조 · FieldBox · Pretendard · ADR-264 · 중첩 규칙) 뒤에 남은 기대값을 고쳤고, 앞 테스트의 포인터 · S2 서체 로드 시점에 따라 결과가 갈리던 3 곳을 고쳤다. live 스크립트 `s2-meter-fill-live.mjs`.

## [Card density · 카드 원본 4종 — S2 Card spacing · AssetCard · UserCard · ProductCard · CollectionCardPreview] - 2026-11-24

### Added

- **Card 의 Density** (S2 Card `density`): Compact · Regular · Spacious — 카드 안쪽 여백 (S2 card spacing). 크기별 값은 S2 표 그대로 (Regular XS 8 · S 12 · M 16 · L 20 · XL 24, Compact 은 6 · 8 · 12 · 16 · 20, Spacious 는 12 · 16 · 20 · 24 · 28).
- **팔레트 「asset card」 · 「user card」 · 「product card」 · 「collection card」** (S2 `Card.md` 예제 — 뿌리는 Card, 새 type 없음):
  - asset card — 정사각 미리보기 · 제목 옆 ActionMenu (카드 크기에 맞는 버튼 크기) · 설명, density Regular 고정
  - user card — 3:1 배너 · 배너 아래 끝에 반쯤 걸친 Avatar (크기 = 카드 크기: M 64 · XL 80) · 제목 · 설명 · Footer 의 StatusLight, density Spacious 고정, Variant 에 quiet 없음
  - product card — 5:1 배너 · 배너에 반쯤 걸친 thumbnail (M 40 · XL 56) · 제목 · 설명 · Footer 의 Button (카드 크기를 따름), density Spacious 고정, quiet 없음
  - collection card — 이미지 4 장 (첫 장이 3 칸 폭 3:2, 나머지 정사각) · 제목 · 폴더 아이콘 + 개수

### Changed

- **Card 바탕이 S2 와 같다** (사용자 결정 「포함」 · 「S2 크기별 폭」):
  - 미리보기 (CardPreview) 가 카드의 위 · 좌우 가장자리까지 닿는다 (전에는 여백 안에 들어가 있었다). 카드는 내용을 모서리에 맞춰 자른다 (S2 `overflow: clip` — quiet 은 자르지 않고 미리보기가 카드 모서리를 가진다).
  - 여백 값이 S2 표다 — M 은 그대로 16, XS 4 → 8 · S 8 → 12 · L 24 → 20 · XL 32 → 24. quiet Card 는 여백 0.
  - 영역 간격이 S2 와 같다 — 미리보기 아래 Content 위 여백 = spacing, Content 아래 · Footer 위 = spacing 의 ¾ (전에는 Card gap 12).
  - 혼자 선 Card 의 폭 = 크기별 S2 값 (XS 112 · S 192 · M 240 · L 320 · XL 400 — 전에는 부모 폭 100%). CardView 안 Card 는 칸을 채운다. 직접 준 폭이 이긴다.
  - 위치: `packages/shared/src/catalog/{generated/componentRulesTable.ts (Card size · density · quiet · thumbnail, CardPreview card-radius),document/rulePartRules.ts (겹 선택자 `&[data-size]` → Canvas 조건),runtime/presence.ts (`catalogCardSpacing`·`catalogCardSection`),runtime/boxModel.ts,runtime/domBinding.runtime.ts,document/generated/reusableOriginLibrary.ts}` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`

### Tests

- `s2CardDensity.test.tsx` 3 (density × size 여백 · 폭 · 미리보기 margin · Content · Footer 여백 · quiet 0 과 미리보기 모서리 — Canvas record · 기하 · Skia 상자와 DOM, CardView 안 칸 채움, detach 한 Card 의 영역 다시 계산), `s2CardPresets.test.tsx` 4 (원본 4종 — density · 정사각 · Avatar · thumbnail 겹침과 카드 크기 따라가기 · 첫 이미지 3 칸). live `s2-card-density-live` 5/5 (Components 패널 card → Design 패널 Density Compact → 원본 4종 → Publish 대조).

## [Table 합계 행 · 편집 칸 — S2 TableFooter · EditableCell] - 2026-11-23

### Added

- **Column 의 「Editable」** (S2 `EditableCell`, 사용자 결정 「세션 update · 저장은 callEndpoint」): 데이터에 연결된 Table 의 Column 을 고르고 Design 패널 Behavior 에서 켜면 그 열의 칸이 S2 편집 칸이 된다 — 값 옆 연필 버튼 (평소에는 숨고 행에 마우스를 올리거나 focus 가 들어오면 보인다), 누르면 칸 아래 popover 에 입력칸 (이름 = 열 key, 처음 값 = 칸 값) 과 취소 · 저장 버튼. 저장하면 그 행의 값이 바뀌고 (Preview · Publish 세션의 목록 데이터) Form 의 When 「onSubmit」 이 실행된다 — 서버에 저장하려면 그 규칙에 callEndpoint Do 를 붙인다. 바깥을 누르면 저장, Escape · 취소는 그대로 둔다. 끄면 칸이 원래 글자로 돌아온다.
  - 칸 구조는 S2 예제 그대로 노드다: `Cell > frame (값 Text + ActionButton[slot=edit]) + Form > TextField`. 입력칸을 바꾸거나 더 넣으려면 그 Form 을 고친다.
  - Canvas 는 값과 연필 버튼의 자리만 그린다 (버튼 글리프 · 열리지 않은 Form 은 그리지 않는다 — S2 의 휴지 상태).
- **색 토큰 `{color.table-footer}`** (`--table-footer`, S2 gray-200 — light `#e1e1e1` · dark `#323232`).

### Changed

- **Table 합계 행 (「Totals row」) 이 S2 모양이다** (S2 `TableFooter` 의 행): 바탕 gray-200 · 글자 굵게 (700). 행을 누르거나 전체 선택 (Ctrl/Cmd + A · 머리글 체크) 해도 선택되지 않는다 — 흐려지지도 않는다 (S2 `disabledBehavior: "selection"`).
  - 위치: `packages/shared/src/catalog/{generated/componentRulesTable.ts (Row · Cell `in-footer` · Table edit 버튼 상태 · Popover 편집 칸 모양),document/rulePartRules.ts,document/derivedVariantProps.ts,commands/collections.ts (`setTableColumnEditable`),runtime/presence.ts,runtime/tableTracks.ts (`catalogTableFooterPart`),runtime/domBinding.runtime.ts,runtime/domRegistry.components.tsx,runtime/editableCell.components.tsx,runtime/catalogPreviewSession.ts (`editTableRow`),runtime/compositionRoot.ts}` · `packages/rendering/src/{primitives/colorAliases.ts,renderers/utils/tokenResolver.ts}` · `apps/builder/src/builder/{catalogRuntime/tableEditableCell.ts,catalogRuntime/canvasBinding.ts,panels/properties/catalog/CatalogFilterSection.tsx}`

### Tests

- `s2TableFooter.test.tsx` 2 (Canvas · DOM 바탕 · 굵기 · Skia 칠 #e1e1e1, 누르기 · 전체 선택에도 선택 안 됨), `s2EditableCell.test.tsx` 2 (켜기 · 끄기 구조 · Canvas 숨김, popover 저장 · 취소), `s2EditableCellCanvas.test.ts` 2 (팔레트 Table instance · Builder 행 · 연결 없는 Table 은 스위치 없음), live `apps/builder/scripts/s2-editable-cell-live.mjs` 6/6.

## [Custom · fullscreen dialog — S2 Modal size · CustomDialog · FullscreenDialog] - 2026-11-23

### Added

- **Modal 의 Size** (S2 `Modal` `size`): S 400 · M 480 · L 640 · XL 960 (화면의 90% 까지), Fullscreen (화면 사방 20 안쪽), Fullscreen takeover (화면 전체 · 모서리 없음). 크기가 있으면 안의 Dialog 가 Modal 을 채운다. 크기를 안 주면 지금처럼 Dialog 자기 폭 (S2 CustomDialog 의 크기 없음과 같다).
- **Dialog 의 Padding** (S2 CustomDialog `padding`): None 이면 Dialog 여백이 0 — 내용을 가장자리까지 채운다.
- **팔레트 「custom dialog」 · 「fullscreen dialog」** (S2 `CustomDialog` · `FullscreenDialog` 문서 예제): custom = 체크 아이콘 · 제목 · 글이 가운데 놓인 대화상자 (Size · Padding · Dismissible · Escape 막기), fullscreen = 제목 · 부제 · 버튼 머리 줄 + 내용 (Variant = Fullscreen · Fullscreen takeover).

### Changed

- **alert dialog 의 Size 는 Modal 폭이다** (S2 `AlertDialog` 의 `size` 가 Modal 로 간다): 기본 M = 480. 전에는 Dialog 의 여백 크기를 바꿨다.

### Fixed

- **Canvas 에서 overlay 의 높이 상한이 단위를 잃던 것**: 열린 Modal · Popover 의 자기 `max-height` 가 px 가 아니면 (`90vh`) 숫자만 읽어 90px 로 잘렸다. px 가 아닌 값은 엔진에 `min()` 으로 넘긴다 (`overlayLayout.ts`).
  - 위치: `packages/shared/src/catalog/{generated/componentRulesTable.ts,bindings/Modal.binding.ts,bindings/Dialog.binding.ts,document/ruleDefinition.ts,document/rulePartRules.ts,document/validation.ts,resolvers/resolveCatalogRuleCanvasBox.ts,runtime/overlayLayout.ts,document/generated/reusableOriginLibrary.ts}` · `packages/shared/src/components/{Modal,Dialog}.tsx` · `packages/rendering/src/renderers/CSSGenerator.ts` (`containerVariantsOverride` — 크기별 블록이 rule 의 상자를 덮어쓰기만 함)

### Tests

- `s2CustomDialog.test.tsx` 4 (팔레트 · prop, custom M 480 · S 400 + padding 0 · 높이 = Dialog, fullscreen 사방 20 · takeover 화면 전체 · 모서리 0, 크기 없음 310 · DOM `data-size` 없음), `s2AlertDialog` Modal 크기 단언, 원복 RED 13/13, live `apps/builder/scripts/s2-custom-dialog-live.mjs` 5/5.

## [Alert dialog — S2 AlertDialog] - 2026-11-23

### Added

- **팔레트 「alert dialog」** (S2 `AlertDialog`, 사용자 결정 「노드 + 2 필드」): 확인 · 오류 · 경고용 대화상자를 한 번에 놓는다 — `Dialog role=alertdialog` 와 제목 · 본문 · 버튼이 모두 노드라 Dialog 처럼 하나씩 고칠 수 있다. Design 패널은 S2 prop 그대로: Variant (Confirmation · Information · Destructive · Error · Warning), Title, 주 · 보조 동작 글자, 취소 글자, 주 · 보조 동작 비활성, 처음 focus 버튼, Size.
  - Variant 가 주 버튼 색 (확인 = accent · 삭제 = negative · 그 밖 = primary) 과 제목 앞 아이콘 (오류 · 경고) 을 고른다. 아이콘 이름은 S2 `dialog.alert` 를 사이트 언어로 (「Alert」 · 「경고」).
  - 취소 · 보조 버튼은 글자를 적었을 때만 있다 (S2 `{cancelLabel && …}`). 모든 버튼은 누르면 대화상자를 닫는다.
- **원본 template 의 두 표현 (contract 77)**: composite 정의의 `bindingMaps` (한 prop 의 값이 고르는 template 값) · template 노드의 `presentWith` (그 prop 이 비면 자리가 없다). resolver · Layers 위치 · 원본 잠금 해제 사본 · 증분 다시 그리기가 같은 판정을 읽는다. 옛 76 문서는 열리지 않는다 (변환 없음).
- **Heading 안 Text 의 글자 단계**: Heading 의 Text 자식이 Heading 의 크기 · 굵기를 받는다 (아이콘 + 제목 한 줄 — S2 `CenterBaseline`).
  - 위치: `packages/shared/src/catalog/{document/generated/reusableOriginLibrary.ts,document/types.ts,document/validation.ts,document/library.ts,document/graph.ts,document/codeCatalogLibrary.ts,resolution/resolver.ts,resolution/positions.ts,commands/originFork.ts,runtime/compositionRoot.ts,runtime/alertDialog.ts,runtime/domBinding.runtime.ts}` · `apps/builder/src/builder/{components/reusablePropsSchemas.ts,panels/components/paletteItems.ts,catalogRuntime/componentsPage.ts}`

### Tests

- `s2AlertDialog.test.tsx` 3 (팔레트 · prop · map 검증, 기본 confirmation — 이름 · 버튼 · 닫힘 · 제목 굵기, destructive · error · warning · 버튼 글자 · autoFocus · 비활성), 원복 RED, live `apps/builder/scripts/s2-alert-dialog-live.mjs` 6/6. contract 76 → 77 fixture 32 곳.

## [Action menu — S2 ActionMenu] - 2026-11-23

### Added

- **팔레트 「action menu」** (S2 `ActionMenu`): 「더 보기」 버튼 (icon-only ActionButton, 점 세 개) 과 그 Menu 를 한 번에 놓는다 — `MenuTrigger > ActionButton + Popover > Menu` 원본 (`component-actionmenu`, S2 와 같은 조합이라 새 type 없음). Design 패널은 S2 prop 그대로 Size (버튼 XS ~ XL) · Quiet · Menu size (S ~ XL) · 열리는 방향 · 정렬, 데이터 연결. 기본 항목은 S2 문서 예제 (Copy · Cut · Paste — 아이콘 · 설명 · 단축키).
- **이름 없는 메뉴 버튼의 이름**: 글자 없는 icon-only menu trigger 버튼은 S2 `menu.moreActions` 를 사이트 언어로 받는다 (「More actions」 · 「기타 액션」 · 「その他のアクション」 · 「更多操作」). 작성한 `aria-label` 이 이긴다.
  - 위치: `packages/shared/src/catalog/{document/generated/reusableOriginLibrary.ts,componentCatalog.ts,runtime/actionMenu.ts,runtime/unavailableMenuItem.components.tsx,runtime/domBinding.runtime.ts}` · `apps/builder/src/builder/{components/reusablePropsSchemas.ts,panels/components/paletteItems.ts,catalogRuntime/componentsPage.ts}`

### Tests

- `s2ActionMenu.test.tsx` 3 (팔레트 · prop 계약, icon-only 이름 · 항목 3, size · isQuiet · menuSize 전달 · 작성 이름 우선), live `apps/builder/scripts/s2-action-menu-live.mjs` 5/5 (Components 패널 클릭 → Canvas → Design 패널 → Publish).

## [Select 값 모양 — S2 renderValue (값 칸 template 노드)] - 2026-11-23

### Added

- **Select 의 「값 모양」** (S2 Picker `renderValue`, 저장 모양 사용자 확인): Select 의 값 칸 (SelectValue) 을 고르면 Design 패널에 「값 모양」 구획이 생기고, 거기서 넣은 노드가 고른 값을 보이는 모양이 된다. 노드를 Layers · Canvas 우클릭 「행 템플릿으로 사용」 으로 표시하면 Select 의 항목마다 반복되고 (`repeat`), 고른 항목의 것만 보인다 — 여럿을 고르면 S2 의 「N개 선택」 대신 고른 항목들이 나란히. 글자는 항목의 필드를 읽는다 — 표에 연결한 Select 는 `{#필드}`, 연결하지 않은 Select 는 `{label}` · `{id}`. 고른 것이 없거나 값 모양이 없으면 지금처럼 S2 기본 (placeholder · 항목 내용 · 「N개 선택」). Canvas 는 저장된 선택으로, Preview · Publish 는 실행 중 선택 (RAC) 으로 같은 사본을 보인다. 값 칸 안에 버튼 · 링크를 넣으면 S2 처럼 console 경고. Code 보기는 `<Slot name="value">{selectedItems.map(item => (…))}</Slot>` 로 쓰고 그 본문은 읽기 전용이다.
  - 위치: `packages/shared/src/catalog/{runtime/selectValueTemplate.ts,runtime/selectValueTemplate.components.tsx,document/selectValueShape.ts,resolution/resolver.ts,runtime/presence.ts,runtime/domBinding.runtime.ts,runtime/rulePaint.ts,document/graph.ts,commands/rowTemplate.ts}` · `packages/shared/src/codeView/generate.ts` · `apps/builder/src/builder/{catalogRuntime/canvasMenu.ts,catalogRuntime/codeViewEdit.ts,catalogRuntime/codeViewViews.ts,panels/properties/catalog/CatalogPropertiesPanel.components.tsx}`

### Tests

- `s2SelectRenderValue.test.tsx` 5 (고른 것 없음 · 고름 — Canvas 사본 · placeholder 칠, Preview 실행 선택, 다중, 표 연결, Code 보기 왕복), 원복 RED, live `apps/builder/scripts/s2-select-render-value-live.mjs` 5/5 (Design 패널 넣기 · Layers 우클릭 반복 · Canvas 「[Cat]」 = Publish 「[Cat]」 → 「[Dog]」).

## [사용할 수 없는 메뉴 항목 — S2 UnavailableMenuItemTrigger] - 2026-11-23

### Added

- **Menu 의 「사용할 수 없는 항목」** (S2 `UnavailableMenuItemTrigger`): Menu 를 고르고 Design 패널 「Fill slot」 에서 `UnavailableMenuItemTrigger` 를 넣으면 항목 하나 (「Unavailable」) 와 그 도움말 (S2 `ContextualHelpPopover` 모양 — 제목 「Permission required」 + 설명) 이 생긴다. 사용할 수 없는 동안 항목은 동작하지 않고, 누르거나 펼치면 오른쪽 위에 도움말이 열린다 (RAC `SubmenuTrigger` — S2 와 같은 offset −2 · cross offset −8). 항목 끝에는 하위 메뉴 꺾쇠 대신 정보 아이콘이 보이고, 항목의 설명 (`aria-describedby`) 은 그 아이콘의 이름 (S2 `menu.unavailable` — 「사용할 수 없음, 자세히 보려면 펼치기」) 이다. 도움말 Popover 의 이름은 제목 Heading. Design 패널 「사용할 수 없음」 (S2 `isUnavailable`) 을 끄면 평범한 항목이 된다. Canvas 는 같은 정보 아이콘을 같은 자리에 그린다 (MenuItem 원본의 아이콘 노드, 조건 `isUnavailable`). Code 보기는 `<UnavailableMenuItemTrigger isUnavailable={true}>` 로 쓰고 다시 읽는다.
  - 위치: `packages/shared/src/catalog/{bindings/UnavailableMenuItemTrigger.binding.ts,runtime/unavailableMenuItem.ts,runtime/unavailableMenuItem.components.tsx,runtime/domBinding.runtime.ts,runtime/presence.ts,document/generated/reusableOriginLibrary.ts}` · `packages/shared/src/components/UnavailableMenuItemTrigger.tsx` · `apps/builder/src/builder/catalogRuntime/itemInsert.ts`

### Tests

- `s2UnavailableMenuItem.test.tsx` 3 (사용할 수 없음 — Canvas 아이콘 · 꺾쇠 숨김 · Preview 설명 · 도움말 이름, 끄기 — Canvas 가 편집을 따라감 · 평범한 항목, Code 보기 왕복), 원복 RED 8/8, live `apps/builder/scripts/s2-unavailable-menu-item-live.mjs` 6/6 (Canvas = Publish 아이콘 자리).

## [Dialog Esc 막기 · ComboBox 필터 방식 — S2 isKeyboardDismissDisabled · RAC defaultFilter] - 2026-11-23

### Added

- **Dialog 「Esc 로 닫지 않음」** (S2 Dialog `isKeyboardDismissDisabled`): Design 패널 Behavior 구획의 칩. 켜면 Preview · Publish 에서 Esc 로 Dialog 가 닫히지 않는다 (RAC Modal 의 `isKeyboardDismissDisabled` — Dialog 를 담은 Modal 의 파생 값, Dialog 가 직접 여는 modal 도). S2 Popover 는 이 prop 을 빼서 Popover 에는 두지 않았다.
- **ComboBox 「필터 방식」** — 포함 (기본, S2 · RAC 와 같음) · 으로 시작. 입력한 글자가 항목 이름의 어디든 있으면 남기거나, 이름의 처음과 맞을 때만 남긴다. 판정은 RAC `useFilter({sensitivity: "base"})` (언어 규칙 — 대소문자 · 악센트 무시). 서버가 거르는 목록 (`{{ filterText }}` endpoint) 은 서버가 준 그대로다. S2 ComboBox 에는 없는 선택이라 RAC `defaultFilter` 를 데이터로 저장한다 (`d2Provenance` `rac`). Code 보기는 `defaultFilter={filter('startsWith')}`.
  - 위치: `packages/shared/src/catalog/{bindings/Dialog.binding.ts,bindings/ComboBox.binding.ts,document/d2Provenance.ts,runtime/presence.ts,runtime/domBinding.runtime.ts,runtime/delegatedDom.runtime.ts,runtime/comboBoxSelectionText.tsx}` · `packages/shared/src/components/Dialog.tsx` · `packages/shared/src/codeView/generate.ts` · `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts` · `apps/builder/src/i18n/{labels.ts,messages/*}`

### Fixed

- **Design 패널의 「Validation rules」 · 「Unavailable dates」 라벨이 한국어 화면에서도 영어였다**: binding 라벨은 번역 키 표 (`i18n/labels.ts`) 에 있어야 번역된다 — 두 라벨을 표에 넣었다 (「검증 규칙」 · 「고를 수 없는 날짜」).

### Tests

- `s2DialogDismissible.test.tsx` +2 (Esc 꺼짐 · 켜짐 — Modal 파생 값과 Preview) · `s2D3ComboBoxFilter.test.tsx` 3 (포함 · 시작 · Code 보기 왕복), 원복 RED 6/6 · builder 9,669 · shared 2,761, live `apps/builder/scripts/s2-dialog-esc-combobox-filter-live.mjs` 6/6.

## [고를 수 없는 날짜 — S2 isDateUnavailable (요일 · 날짜 목록 · 데이터 표)] - 2026-11-23

### Added

- **날짜 컴포넌트의 「고를 수 없는 날짜」** (S2 `isDateUnavailable` — 함수가 아니라 데이터, 사용자 결정):
  - Calendar · RangeCalendar · DateField · DatePicker · DateRangePicker 의 Design 패널 Value 구획에 「고를 수 없는 날짜」 가 생겼다: 요일 단추 7개, 날짜 · 기간 목록 (「날짜 추가」 · 「기간 추가」, 줄마다 제거 메뉴). 문서에는 `isDateUnavailable: { weekdays: [0 ~ 6], dates: ["YYYY-MM-DD" | {start, end}] }` 로 저장한다 (0 = 일요일).
  - 데이터 표의 날짜도 쓸 수 있다: Collection 구획의 데이터 연결에서 표를 고르고 「고를 수 없는 날짜」 필드 (기간이면 「고를 수 없는 끝 날짜」 필드도) 를 고른다. 「검색 · 필터」 의 조건 (예: 상태 = 확정) 을 통과한 행만 날짜를 막는다. 연결은 노드의 데이터 연결 (`binding.fieldMap.unavailable` · `unavailableEnd` · `view`) 에 저장하고, 행의 날짜는 문서에 복사하지 않는다.
  - DatePicker · DateRangePicker 는 picker 의 값이 달력까지 간다 (RAC 달력 context). DateField · DatePicker 는 고를 수 없는 날짜를 값으로 받으면 오류다 (RAC 검증).
  - 그림: S2 처럼 날짜 위에 비스듬한 2px 막대 (칸 폭의 절반, -16°, 글자색). Canvas (`calendar_month_grid`) 와 생성 CSS (`[data-unavailable]::before`) 가 같은 값을 그린다. 고를 수 없는 날짜는 hover 칠이 없다.
  - RangeCalendar · DateRangePicker 의 「비연속 범위」 를 끄면 고를 수 없는 날짜를 넘어 기간을 고를 수 없고, 켜면 넘어 고를 수 있다 (RAC).
  - Code 보기는 `isDateUnavailable={unavailableDates({...})}` 로 쓰고 그대로 되읽는다.

### Fixed

- **달력의 오류 값이 Canvas 에도 보인다**: RAC 는 값이 Min · Max 밖이거나 고를 수 없는 날짜이거나 `isInvalid` 이면 그 칸을 「선택 + 오류」 로 그리는데, Canvas 달력은 선택 원을 그리지 않거나 파란 원으로 그렸다. 이제 Canvas 도 빨간 원 (범위는 빨간 띠) 이다 — 오류 칠은 수동 시트 `CalendarCommon.css` 에서 Calendar rule 로 옮겼다.
- **Preview · Publish 달력의 고를 수 없는 날짜가 빨간 글자 · 가로줄이었다**: 수동 시트에 남은 RAC starter 규칙 (`[data-unavailable]` line-through + negative 색) 을 지웠다 — S2 는 글자색 그대로에 막대.
  - 위치: `packages/shared/src/catalog/{document/unavailableDates.ts,runtime/unavailableDates.ts,runtime/calendarModel.ts,runtime/presence.ts,runtime/delegatedDom.runtime.ts,runtime/dataBinding.ts,resolution/resolver.ts,bindings/unavailableDatesProp.ts,generated/componentRulesTable.ts,rule/conditionTree.ts}` (+ 5 binding) · `packages/rendering/src/renderers/skiaPrimitives.ts` · `packages/shared/src/components/styles/CalendarCommon.css` · `apps/builder/src/builder/{panels/properties/generic/UnavailableDatesField.tsx,components/property/CollectionBinding.tsx,catalogRuntime/ruleShapes.ts,catalogRuntime/codeViewEdit.ts}` · `packages/shared/src/codeView/generate.ts`

### Tests

- `s2D3UnavailableDates.test.tsx` 10 (Calendar DOM · Canvas 같은 날짜 · 오류 값 · 작성한 isInvalid · DatePicker · DateField · 저장 모양 검사 · 비연속 범위 2 · 데이터 표 + 조건 · Code 보기 왕복) · `UnavailableDatesField.test.tsx` 3 · `CollectionBinding.test.tsx` +1, 원복 RED 13/13 · builder 9,663 · shared 2,761, live `apps/builder/scripts/s2-unavailable-dates-live.mjs` 9/9.

## [Form 서버 오류 · 검증 규칙 — S2 validationErrors · validate] - 2026-11-23

### Added

- **제출 응답의 필드 오류가 그 필드에 보인다** (S2 Form `validationErrors`, S2 체크리스트 부록 D.3 2단계):
  - endpoint 편집기 Params 탭의 「응답 경로」 에 「필드 오류 경로」 (`responseMapping.errorsPath` — 예: `errors` · `data.fieldErrors`) 가 생겼다. 필드 이름 (`name`) 마다 문구 하나 또는 여러 개 (Zod `flatten().fieldErrors` 모양).
  - Form 의 `callEndpoint` 응답 (400 · 422 거절, 또는 오류를 담은 정상 응답) 의 필드 오류가 그 Form 의 같은 `name` 필드에 오류로 보인다. 사용자가 그 칸을 고쳐 확정하면 (칸을 떠날 때) 지워지고, 성공 응답은 남은 오류를 비운다. 필드 오류가 오면 실패 toast 는 띄우지 않는다.
  - 받는 Form 은 규칙 주인 자신 또는 주인을 감싼 가장 가까운 Form 이다. 문서에는 저장하지 않는다 (실행 중 값).
- **필드의 「검증 규칙」** (S2 `validate` — 함수가 아니라 데이터 보기의 조건 트리, 사용자 결정):
  - 15종 (TextField · TextArea · SearchField · NumberField · ComboBox · Select · Checkbox · CheckboxGroup · RadioGroup · DateField · DatePicker · DateRangePicker · TimeField · ColorField · Switch) 의 Design 패널 Behavior 구획에 「검증 규칙」 목록이 생겼다. 규칙 하나 = 맞아야 하는 조건 (필드 · 비교 · 값) + 맞지 않을 때의 메시지. 「또는」 조건을 더할 수 있다.
  - 조건은 이 필드의 값 (DateRangePicker 는 시작 · 끝) 또는 같은 Form 의 다른 필드 (`name`) 를 읽고, 값은 고정 값 또는 다른 필드의 값 (`!form.<name>` — 비밀번호 확인) 이다. 비교 종류는 값 종류 (글자 · 숫자 · 날짜 · 여러 값 · 켜고 끔) 를 따른다.
  - Preview · Publish 에서 칸을 떠날 때와 제출할 때 검사한다 (S2 와 같은 시점). 맞지 않는 규칙의 메시지를 모두 보이고, native 검증 방식이면 제출을 막는다. 다른 필드를 읽는 규칙은 그 필드가 바뀌면 다시 판정한다. Canvas 는 바뀌지 않는다.
  - Code 보기는 `validate={validationRules([...])}` 로 쓰고 그대로 되읽는다.

### Changed

- **`callEndpoint` 뒤의 Do 는 응답을 기다린다** (사용자 결정 1): 전에는 응답 전에 다음 Do (예: 「저장됨」 toast · 페이지 이동) 가 실행돼 400 이 와도 「저장됨」 이 떴다. 이제 응답이 실패 (필드 오류 포함) 면 거기서 멈춘다 — Do 목록의 「실패한 Do 에서 멈춘다」 계약.
  - 위치: `packages/shared/src/interactions/{dispatcher.ts,bindings.ts}` · `collections/executeCollectionEndpoint.ts` · `catalog/runtime/{catalogPreviewInteractions.ts,delegatedDom.runtime.ts,fieldValidation.ts}` · `catalog/document/{validationRules.ts,validation.ts,valueType.ts,ruleDefinition.ts}` · `catalog/bindings/validateProp.ts` (+ 15 binding) · `codeView/generate.ts` · `apps/builder/src/builder/{panels/properties/generic/ValidationRulesField.tsx,panels/datatable/editors/ApiEndpointEditor.tsx,stores/utils/dataChange.ts,catalogRuntime/codeViewEdit.ts}`

### Tests

- `s2D3FormServerErrors.test.tsx` 8 (422 · 목록 문구 · 성공 · 오류 없는 거절 · 오류를 담은 정상 응답 · aria 에서 성공이 오류를 비움 · Do 대기 2) · `s2D3FieldValidate.test.tsx` 6 (거절 · 문구 여럿 · 「또는」 · 다른 필드 참조 · 저장 모양 검사 · Code 보기 왕복) · `dataChange.endpoints.test.ts` errorsPath draft 1, 원복 RED 19/19, live `apps/builder/scripts/s2-form-validation-live.mjs` 7/7.

## [목록 선택 막대 — S2 renderActionBar (CardView · Table · Tree)] - 2026-11-23

### Added

- **CardView · Table · Tree 에 ActionBar 를 직계 자식으로 넣으면 그 목록의 선택 막대가 된다** (S2 `renderActionBar`, S2 체크리스트 부록 D.3 2단계):
  - 넣는 법: Layers 「+」 · slot 넣기 목록에 ActionBar 가 나온다 (Table 은 Table 자리에), 나중에 넣은 항목은 막대 앞에 선다.
  - 개수 · 지우기: 막대의 개수는 목록의 선택 수 (모두 고르면 「All selected」), 선택이 없으면 막대가 보이지 않는다. 지우기 버튼 · Escape 는 목록의 선택을 비우고 목록의 `onSelectionChange` 규칙이 실행된다. Design 패널은 막대의 「Selected item count」 칸을 목록이 정한다고 안내한다.
  - 자리: 목록 아래쪽에 겹쳐 뜬다 — 좌우 · 아래 8 안, 최대 960 · 가운데 (S2 `isInContainer`). 막대가 보이는 동안 목록의 아래 여백이 막대 자리 (막대 높이 + 8 + 목록 가장자리 — CardView 는 S2 `minSpace`) 가 된다. Canvas · Preview · Publish 같은 자리.
  - DOM 은 S2 처럼 목록과 막대를 감싸개 `div` 로 묶는다 (막대는 RAC GridList · Tree · Table 안에 들어갈 수 없다 — ARIA · focus). 감싸개가 상자의 크기 · 여백 · 자리를 갖고 목록이 그 안을 채운다. 막대는 아래에서 미끄러져 들어오고 나가며 (200ms), 나타날 때 「Actions available」 을 읽어 준다 (S2 intl — 한 · 일 · 중 포함).
  - 위치: `packages/shared/src/catalog/runtime/{actionBarContainer.ts,actionBarHost.components.tsx,presence.ts,valueBindings.ts,boxModel.ts,compositionRoot.ts,delegatedDom.runtime.ts,domBinding.runtime.ts,ownerDecidedProps.ts}` · `catalog/nesting/nestingRules.ts` · `domain/componentTraits.ts` · `apps/builder/src/builder/catalogRuntime/slots.ts`

### Fixed

- **ActionBar 개수 글자가 Canvas 에서 개수를 바꿔도 그대로이던 것**:
  - **Why**: 값 글자를 다시 계산할 소유자 목록이 RAC 값 키만 보고, ActionBar 의 개수 글자 (composition 값 키) 를 빠뜨렸다.

### Tests

- `s2D3ActionBar.test.tsx` 13 (3종 Canvas 자리 · 개수 · 여백 · Preview 감싸개 · 지우기 · 넣기 순서 · 패널), 원복 RED 17/17, live `apps/builder/scripts/s2-action-bar-live.mjs` 8/8.

## [목록 비활성 항목 — S2 disabledKeys 8종 · 데이터 필드] - 2026-11-23

### Added

- **ListBox · GridList · Table · Tree · CardView · Select · ComboBox · Tabs 의 「비활성 항목」** (S2 `disabledKeys`, S2 체크리스트 부록 D.3 2단계):
  - Design 패널 Behavior 구획의 칸 하나 — 그 컴포넌트의 항목이 체크 목록으로 나오고, 고른 항목은 누를 수도 선택할 수도 없으며 비활성 색으로 그려진다 (Canvas · Preview · Publish 같음). 저장은 그룹이 항목 key 로 (ADR-308 의 선택과 같은 모양). Menu · TagGroup · SideNav 의 칸도 같은 체크 목록이 됐다 (전에는 key 를 쉼표로 입력).
  - 데이터에 연결한 목록은 데이터 연결 칸의 「Disabled field」 로 boolean 필드 하나를 고른다 — 그 필드가 `true` 인 행이 비활성 (창 밖 행 · 하위 행 포함). 문서에는 그룹이 고른 key 만 저장되고, 필드가 정한 행은 실행 때 합쳐진다.
  - 위치: `packages/shared/src/catalog/bindings/disabledKeysProp.ts` · `catalog/runtime/{groupSelection,presence,delegatedDom.runtime,dataBinding}.ts` · `catalog/resolution/resolver.ts` · `apps/builder/src/builder/catalogRuntime/singleSelection.ts` · `components/property/CollectionBinding.tsx`

### Fixed

- **Tree 가 비활성으로 만든 행의 라벨 · chevron 이 Canvas 에서만 평소 색** (live: Canvas 41 · Publish 198):
  - **Why**: Canvas 의 라벨 판정이 항목 자기 `isDisabled` 만 읽었고, Tree 를 바꿀 때 행의 라벨 · chevron 을 다시 계산하지 않았다.
- **Undo 로 비활성을 풀어도 Tree 행의 선택 Checkbox 가 비활성으로 남던 것**:
  - **Why**: 한 편집의 파생 재계산에서 뒤의 레코드가 앞에서 다시 계산한 레코드를 읽지 못했다 (`compositionRoot.ts` 의 dependents 계획이 계획한 레코드를 다음 판정에 넘기지 않음).

### Tests

- `s2D3DisabledKeys.test.tsx` 18 (8종 Canvas · Publish · 패널 체크 목록 · 데이터 필드) · `s2TreeItemDisabledText` +1 · `CollectionBinding` +2, live `apps/builder/scripts/s2-disabled-keys-live.mjs` 8/8.

## [CardView · Table 빈 상태 — S2 renderEmptyState] - 2026-11-23

### Added

- **CardView · Table 원본이 빈 상태 (IllustratedMessage) 를 기본으로 갖는다** (S2 체크리스트 부록 D.3 2단계 — 사용자 결정 2026-11-23):
  - 항목 · 연결 행이 0 이면 Canvas · Preview · Publish 가 그린다 (ListBox · GridList · Tree · TagGroup · Menu 와 같은 계약 — 놓고 데이터에 연결하면 끝, 따로 지울 수 없음 · 컬렉션과 함께만 지워짐).
  - CardView: S2 `renderEmptyState` — 두 열을 걸쳐 가운데 (`gridColumnStart 1 / End -1`), Skeleton 항목이 대신 설 때는 그리지 않는다 (S2 와 같게).
  - Table: S2 `TableBody` `renderEmptyState` — 저작 노드는 Table 의 직계 자식 (TableBody 의 자식은 늘 Row), DOM 은 RAC TableBody 의 빈 행으로 넘기고 그 `tr` · `td` 는 `display: contents` (가상 RAC 표와 같다). 위아래 40 (S2 빈 본문 inset) · 가운데.
  - 위치: `packages/shared/src/domain/componentTraits.ts` · `catalog/document/generated/reusableOriginLibrary.ts` · `catalog/runtime/{presence,domBinding.runtime,delegatedDom.runtime}.ts` · `components/styles/Table.css`

### Fixed

- **사용자 Table 의 빈 본문 글자가 기울임 · 흐린 색으로 나오던 것** — 옛 `Table.css` `[data-empty]` 규칙을 Builder 자체 표로 좁힘 (`:not([data-catalog-id])`).
  - **Why**: 사용자 컴포넌트에는 빈 본문 내용이 없던 시절의 규칙이 남아, 빈 상태의 제목 · 설명까지 기울였다.
- **CardView 의 SkeletonCollection 을 항목으로 세던 판정** — Canvas 의 「항목 있음」 (`catalogCollectionHasItems`) 이 로딩 항목 감싸개를 세지 않는다 (RAC `collection.size` 처럼).

### Tests

- `emptyState.test.tsx` (CardView · Table 추가 — 원본 · 0행 표시 · 삭제 거절) · `s2EmptyStateCollections.test.ts` · live `apps/builder/scripts/s2-empty-state-live.mjs` 6/6 (Canvas = Publish 자리 · 크기, 기울임 없음, 행이 오면 사라짐).

## [Image — S2 로딩 · 나타남 · 오류 대체 내용 · img 속성] - 2026-11-23

### Added

- **Image 안에 노드를 넣으면 그림이 없을 때 그것을 보인다 (S2 `renderError`)** — 사용자 결정 2026-11-23 「오류 대체 내용」. Image 가 자식을 받는다 (`DOM_LEAF_TYPES` 에서 뺌). source 가 있으면 숨고 없으면 보인다 (Canvas · DOM 같은 판정 `catalogImageFallbackHidden` — src 편집 때 다시 판정), DOM 은 받다가 오류가 나도 보인다 (Canvas 는 모르는 런타임 상태). 넣은 노드가 없으면 S2 처럼 `img` 그대로 (투명).
- **Image 의 S2 img 속성 7** — `crossOrigin` · `decoding` · `fetchPriority` · `loading` · `referrerPolicy` · 고유 `width` · `height` (사용자 결정 「속성 · 런타임」). DOM `img` 가 받고, Design 패널에는 내지 않는다 (11-11 속성 감사 — 코드 보기 · 규칙 · AI 가 쓴다).

### Changed

- **Image 의 Preview · Publish 로딩 = S2** — 받는 동안 상자에 Skeleton 반짝임 (`data-skeleton-look="box"` — loading Skeleton 과 같은 모양 · 움직임), 받으면 `img` 가 보인다 (200ms 넘게 걸렸으면 500ms 동안 서서히 — S2 `imgStyles`). source 가 없는 빈 Image 는 반짝이지 않는다 (Card 미리보기 자리). 위치: 새 `catalog/runtime/imageBox.components.tsx` (`CatalogImageBox`) · `domBinding.runtime.ts` · `presence.ts` · `nesting/nestingRules.ts` · `document/itemLinks.ts`.
  - 확인: 테스트 `catalogImageBox` 3 (로딩 → 나타남 · 오류 → 넣은 노드 · source 없음) · `s2ImageFallback` 2 (자식 허용 · Canvas 숨김 / 보임 / 다시 보임), 원복 RED (presence · nesting → 2 실패), S2 oracle (`adr256CardS2` — S2 mount 대조) 통과. live `apps/builder/scripts/s2-image-live.mjs` 5/5 — Canvas B (source 있음) 의 Text 숨김 · C (없음) 보임, Design 패널에 img 속성 칸 없음, Publish A 그림 (가운데 픽셀 255,0,0) · `loading="lazy"` · `fetchpriority="high"` · 4×4, B (받을 수 없는 URL) · C 「no picture」.
  - 하지 않은 것 (사용자 결정 2026-11-23): `src` 의 조건부 source 목록 (`media` · `type` · `colorScheme`) · `ImageCoordinator` (`group`).

## [FileUpload — 비활성 전달 · 런타임 목록 행 · 썸네일 · 오류는 S2 InlineAlert] - 2026-11-23

### Fixed

- **비활성 FileUpload 의 「Select files」 Button 이 눌렸고 Canvas 는 입력 표면을 켜진 채 그렸다** — ADR-201 D2 는 `isDisabled` 가 DropZone · FileTrigger Button 양쪽을 끈다고 정했지만, DOM 은 FileUpload 상자 전체를 `opacity: 0.38` 으로 흐리게만 하고 (Canvas 에는 없는 칠 — ADR-297 이 금지한 파생식) Button 은 그대로 눌렸다.
  - 수정: presence 가 FileUpload 안 DropZone · Button 에 파생 `isDisabled` (`catalogFileUploadOf` — 두 consumer 가 같은 값, 편집 때 다시 계산) · FileUpload rule 의 `DISABLED_STATE` 삭제 (자식의 S2 disabled 색이 표시)
- **Publish 의 DropZone 에 파일을 떨어뜨려도 업로드 목록에 들어가지 않았다** — DOM 등록표가 FileUpload 큐로 넘기는 `DropZoneIntake` 대신 그냥 `DropZone` 을 썼다 (FileTrigger 는 이미 `FileTriggerIntake`). 수정: `dropzone: DropZoneIntake` — FileUpload 밖에서는 그대로 DropZone.
- **파일이 들어온 뒤 목록 행에 모양이 없었고 오류는 코드 글자 (`E_TOO_LARGE`) 그대로였다** — 행 · 썸네일 class 에 생성 CSS 가 없었다.
  - 수정: FileUpload rule `composition.staticSelectors` — 목록은 샘플 행과 같은 간격 12, 행 = 썸네일 40 (모서리 sm) 옆 S2 ProgressBar. 실패한 파일 (`status: error`) 만 그 아래 S2 InlineAlert (negative · border) 에 제목 + 이유 문장 (en · ko · ja, `uploadErrorMessages.ts`), 재시도 중인 오류는 표시하지 않는다. 보낼 수 없는 uploader 상태도 같은 InlineAlert (lazy — idle 껍데기 무게 그대로, 불러오지 못하면 예전처럼 코드). 코드는 `data-code` 로 남는다.
  - 위치: `packages/shared/src/catalog/runtime/presence.ts` · `catalog/generated/componentRulesTable.ts` (FileUpload) · `catalog/runtime/domRegistry.runtime.ts` · `components/FileUpload.components.tsx` · `FileUploadActive.components.tsx` · 새 `FileUploadAlert.tsx` · `upload/uploadErrorMessages.ts` · 생성 `FileUpload.css`
  - 확인: 테스트 `fileUploadDisabled` 1 · `fileUploadComponent` +1 (행 · 경고 단언 보강), 원복 RED (소스 되돌림 → 3 실패 · 등록표만 → 1 실패). live `apps/builder/scripts/s2-fileupload-live.mjs` 5/5 — Canvas · Publish 비활성 (Button · DropZone `data-disabled` · opacity 1 · Button 글자 Canvas 221 ≈ Publish 233), Publish 행 (썸네일 40×40 옆 ProgressBar · 큰 파일만 InlineAlert 「업로드 실패 · 허용된 크기보다 큰 파일입니다.」 `E_TOO_LARGE`), endpoint 없는 Preview dry run 은 경고 없음. 번들: `FileUploadAlert` 는 Builder · Preview initial 밖 (vite build closure).

## [원래 있던 테스트 실패 21 정리 — Tab hover 색 · TabPanel min-height · Tabs Direction 토글] - 2026-11-23

### Fixed

- **Tab 글자의 hover 색이 S2 와 달랐다** — S2 `tab` 은 `baseColor` 로 hover · focus-visible · press 때 한 단 오른다 (`nextColorStop`): 선택 안 된 탭 gray-700 → gray-800, 선택된 탭 gray-800 → gray-900. 7f76a6ee8 이 선택 안 된 탭에 gray-900 을 주고 선택된 탭은 오르지 않아 두 consumer 모두 달랐다.
  - 수정: Tab rule 의 color 트리에 두 갈래 (`isHovered` · `isFocusVisible` · `isPressed` = `{color.neutral}`, 선택 안의 같은 셋 = `{color.neutral-content-hover}`) · 생성 `Tab.css`
- **TabPanel 의 `min-height: 0` 이 DOM 에서만 빠졌다** — CSS 생성기가 `containerStyles.minHeight` 의 0 을 「값 없음」 으로 읽었다 (Canvas 는 읽음). 수정: `emitContainerStyles` 가 0 을 쓴다 · 생성 `TabPanel.css`
- **Tabs 를 고르면 Layout 의 Display 토글이 `orientation` 으로 번역됐다** — 7f76a6ee8 이 Tabs 계열에 `orientation` 블록을 더해 자동 목록에 걸렸다. Tabs 의 vertical 은 `flex-direction: row` 라 번역이 반대였고 (Grid 도 꺼짐), TabList · Tab 의 `orientation` 은 Tabs 상속이다. 수정: `ORIENTATION_NOT_DRIVEN` (Tabs · TabList · Tab) — 토글은 style 에 쓴다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Tab) · `packages/rendering/src/renderers/CSSGenerator.ts` · `apps/builder/src/builder/panels/styles/utils/orientationDrivenTags.ts` · 생성 `Tab.css` · `TabPanel.css`
  - 확인: 테스트 `s2TabLabelHover` 2 (Canvas 트리 · 생성 시트), 원복 RED (Tab rule 만 되돌림 → 새 테스트 2 · `phase3Presence` 1 실패). live `apps/builder/scripts/s2-tabs-live.mjs` 4/4 — Publish 탭 휴지 80 · 41, hover 선택 안 됨 41 · 선택 19, TabPanel `min-height: 0px`, Builder 에서 Tabs 의 Display 토글 Grid 켜짐 · Row 가 `orientation` 그대로 `flexDirection: row`.

### Changed

- 테스트 기대값만 낡았던 것 (S2 정렬 · ADR-310 · 315 뒤 갱신 안 됨): shared 7 · rendering 1 · builder 10 — Tab 커서 · 글자 값 · disabled 색 · 선택 막대 2px, Separator 테두리 0 예외, Tabs 계열 archetype 목록, API 표 보류 목록 (+5 −3, 개수 418 → 420 — 옛 기준 426 은 이미 틀렸다), resolver 가 주는 값 (Tabs 방향 · 라벨 표시 · Table 열 자리), FieldLabel 행 · Tag 감싸개 frame 을 건너는 조회, Tabs 루트 slot · TableFooter slot, Navigator 아이콘을 `ACTION_ICONS` 에서. 세 패키지 실패 0 (shared 2,755 · rendering 1,814 · builder unit 9,580).

## [disabled Tree 항목의 라벨 · chevron — S2 gray-400, Canvas = Publish] - 2026-11-23

### Fixed

- **disabled TreeItem 의 라벨 · chevron 이 평소 색 (#292929) 이었다** — S2 TreeView 는 disabled 행을 `gray-400` (= `{color.disabled-content}` #c6c6c6) 으로 그린다 (`treeRow` · `expandButton`). Canvas 는 라벨 · chevron 모두, Publish 는 라벨 · chevron 글리프가 평소 색이었다 (행 자신만 `color-mix(--fg 38%)`).
  - **Why**: TreeItem 칠 트리에 `isDisabled` 가지가 없었고, 라벨 Text · chevron Icon 은 두 consumer 모두 자기 색을 가져 행의 disabled 색이 닿지 않았다. Tree sheet 의 행 색은 ADR-297 이 금지한 `color-mix` 파생식이었다.
  - 수정: TreeItem rule `isDisabled: {color.disabled-content}` (Canvas chevron 은 이 칠을 읽는다) · Tree sheet 의 행 · 라벨 Text · chevron Icon 의 disabled = `var(--fg-disabled)` · Canvas 라벨은 disabled 항목의 칠을 받는다 (`catalogDisabledTreeItemLabelItem`, 항목 변경 때 다시 계산 — `catalogTreeChevrons` 가 행 라벨도 낸다)
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (TreeItem · Tree) · `runtime/presence.ts` · `runtime/compositionRoot.ts` · 생성 `Tree.css`
  - 확인: 테스트 `s2TreeItemDisabledText` 2 (Canvas 라벨 · 글리프 disabled → 다시 켜면 휴지 색 · DOM 세 선택자), 원복 RED (전체 2 · rule 만 2 · compositionRoot 만 1). live `apps/builder/scripts/s2-tree-disabled-live.mjs` 3/3 — disabled 행 라벨 · chevron Canvas 198 · 198 = Publish 198 · 198, 평소 행 라벨 41 = 41 (전에는 Publish chevron 41 · Canvas 라벨 · chevron 41).

## [disabled field 의 입력 글자 — Canvas 도 disabled 색] - 2026-11-23

### Fixed

- **Canvas 의 disabled field 입력 글자가 휴지 색 (#292929) 이었다** — control Group 상자 안 입력 (Input · DateInput · TokenInput) 을 가진 field 전부 (TextField · TokenField · DateField 로 확인). Publish 는 `{color.disabled-content}` (#c6c6c6).
  - **Why**: 2026-11-14 부터 모든 field 의 control Group 이 상자인데, field 상태를 상자 부품에 넘기는 `fieldOfBox` 가 상자 안 입력을 건너뛰어 입력 record 에 field 의 disabled 가 닿지 않았다 (상자 Group 은 받아 테두리만 disabled 였다). 상자 안 입력 (Input · DateInput · TokenInput) 이 field 의 disabled 를 받아 자기 rule 의 `isDisabled` 글자 색으로 그린다 — DOM 의 RAC `data-disabled` 와 같다.
- **Publish 의 disabled 날짜 조각 색** — DateSegment 의 disabled 색이 `color-mix(--fg 38%)` 파생식이라 (ADR-297 금지 패턴) Canvas 의 `disabled-content` 보다 진했다 (174 · 198). Input rule 과 같은 `var(--fg-disabled)` 로.
  - 위치: `packages/shared/src/catalog/runtime/presence.ts` (`derivedPropsBeforeSkeleton` — 상자 안 입력의 `_fieldDisabled`) · `catalog/generated/componentRulesTable.ts` (DateInput 조각 delegation) · 생성 `DateInput.css`
  - 확인: 테스트 `s2DisabledFieldText` 4 (TextField · TokenField · DateField 의 Canvas 글자 = disabled-content · DateSegment 변수), 원복 RED 3 + 1. live `apps/builder/scripts/s2-disabled-field-text-live.mjs` 3/3 — 세 field 휴지 · disabled 의 입력 글자 픽셀이 Canvas 와 Publish 에서 같다 (disabled 191 · 198 / 198 · 198 / 198 · 198, 전에는 Canvas 41).

## [TokenField — 필수 표시 · 오류 상태 + 스크린 리더 전달 (4단계, D1 예외)] - 2026-11-23

### Added

- **TokenField `isRequired` · `necessityIndicator` (icon · label) · `isInvalid` · `errorMessage`** — S2 TextArea 와 같다: 라벨 행 Label 안 필수 표시 (별표 · 「(required)」 — 사이트 언어), invalid 면 상자 Group 이 invalid 테두리 · 상자 안 첫 줄 끝 S2 오류 아이콘, 설명 자리에 오류 문구 (S2 HelpText — 둘 중 하나). Form 의 `isRequired` · `necessityIndicator` 도 받는다.
- **스크린 리더 전달 — D1 예외 (사용자 결정)** — 설치본 RAC TokenField 에 required · validation 이 없고 TokenInput 이 `aria-*` prop 을 DOM 에 넘기지 않아, TokenInput (`role="textbox"`) 에 `aria-required` · `aria-invalid` 를 ref 로 붙인다 (꺼지면 지운다). 오류 문구는 RAC 의 `aria-describedby` prop 이 가리킨다 (RAC `useField` 가 설명 id 와 합친다). 예외 범위는 `.claude/rules/ssot-hierarchy.md` §1 의 목록으로 닫았다 — RAC 가 지원하면 지운다.
  - **Why**: S2 체크리스트 §4.1 TokenField 4단계. 화면 표시만 넣으면 스크린 리더에 「필수」 · 「오류」 가 가지 않는다 (사용자 「스크린 리더에 전달되도록」).
  - 위치: `packages/shared/src/catalog/bindings/TokenField.binding.ts` · `document/d2Provenance.ts` · `document/generated/reusableOriginLibrary.ts` (Label 필수 부품 4 · FieldError · 원본 `errorMessage`) · `runtime/presence.ts` (`FIELD_HINT_OWNERS` · `NODE_TREE_FIELDS` · `CATALOG_LABEL_NODE_FIELDS`) · `runtime/fieldPrefix.ts` (`CATALOG_FIELD_ERROR_ICON_FIELDS` — 첫 줄) · `runtime/tokenField.components.tsx` (`CatalogTokenField` 의 context · `CatalogTokenFieldError` · TokenInput ARIA) · `runtime/delegatedDom.runtime.ts` · `runtime/domBinding.runtime.ts` (오류 부품 · 설명 / 오류 표시 판정) · `.claude/rules/ssot-hierarchy.md`.
  - 확인: 테스트 `s2TokenFieldBox` +3 (binding · Canvas invalid 상자 · 오류 아이콘 · 오류 / 설명 표시 · DOM ARIA 3 · FieldBox `data-invalid` · 오류 아이콘), `fieldNecessityParity` 에 tokenfield (자기 label · Form label · 기본 icon — Canvas = DOM). 원복 RED 8 (binding · 힌트 소유 · 오류 아이콘 · 라벨 필수 · aria-required · aria-describedby · DOM 설명 판정 · 원본 accepts). live (`s2-tokenfield-live.mjs`, 13/13): invalid TokenField 의 textbox `aria-required="true"` · `aria-invalid="true"` · `aria-describedby` = 오류 문구 id, 오류 문구 상자 Canvas (0, 67, 150.9 × 18) = Publish, Group `data-invalid` · 상자 안 오류 아이콘 · Canvas Group invalid, 필수만 켠 field 는 `aria-required` 만, 둘 다 끈 field 는 셋 다 없음, Label 별표 · 「(필수 사항)」, 두 화면 캡처 같음.

## [TokenField — Token 모양 = 줄 안 S2 Tag 칩 · 긴 값 줄바꿈 (3단계)] - 2026-11-23

### Changed

- **Token = S2 Tag 칠의 줄 안 칩** — design-data `tag-field` 의 토큰은 S2 Tag 다 (사용자 결정 「Tag 칠을 줄 안에」). Token rule 이 Tag 의 칠 트리 (바탕 `layer-1` · 글자 `neutral` · 테두리 `border`, 선택 = `neutral` 바탕 · `base` 글자, disabled 글자) 와 `{radius.sm}` 모서리 · 테두리 1 · 좌우 여백 S2 `text-to-visual` (S 5 · M 6 · L 7 · XL 8) 을 갖는다. RAC TokenInput 은 글자 줄 안의 구간이라 상자는 CSS inline 상자 — 줄 높이는 그대로다. DOM 은 RAC Token 에 rule 의 `data-variant` · `data-size` 를 실어 선택 · disabled 칠이 생성 CSS 에서 걸린다.
- **Canvas 가 칩을 그린다** — 토큰 구간을 「글자 폭 + 좌우 여백」 의 placeholder 하나로 재고 (`catalogTextMeasure`) 그린다 (`nodeRendererText` — 칩 상자는 글꼴 content area + 테두리, 글자는 그 안). 칩 안에서 줄이 나뉘지 않는다 (Publish `white-space: nowrap`).

### Fixed

- **Canvas 가 TokenInput 의 긴 값을 줄바꿈하지 않았다** — TokenInput 이 「높이만 재는 글자」 라 폭 줄바꿈 재측정에서 빠져, 좁은 칸에서도 Canvas 는 한 줄 (18) · Publish 는 세 줄 (54) 이었다. RAC TokenInput 은 줄만큼 자라는 `pre-wrap` contenteditable 이라 이제 칸 폭에서 다시 잰다 (Canvas 54 = Publish 54).
  - **Why**: S2 체크리스트 §4.1 TokenField 3단계 「Token 모양」. 두 placeholder (칩 앞 · 뒤) 로 만들자 SkParagraph 가 placeholder 옆에서 줄을 나눠 칩 앞 여백이 앞 줄 끝에 남았다 (live 화면) — 그래서 칩 하나 = placeholder 하나.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Token) · `runtime/tokenChip.ts` (새 — 토큰 구간 · 여백 · 칩 칠) · `runtime/compositionRoot.ts` (측정 run 의 `inset` · `wrappingFieldTextTypes`) · `runtime/delegatedDom.runtime.ts` · `runtime/tokenField.components.tsx` (`CatalogToken`) · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` (`tokenInputChips`) · `catalogRuntime/textMeasure.ts` · `workspace/canvas/skia/inlineEdge.ts` (새) · `skia/nodeRendererText.ts` (`drawRunChips`) · `skia/nodeRendererTypes.ts` · `skia/textParagraphKey.ts`.
  - 확인: 테스트 `s2TokenFieldBox` +4 (rule · DOM `data-variant` · Canvas 칩 run 크기 · disabled · 긴 값 줄바꿈 · 측정 여백), 분류 목록 (`componentRulesTable.static` Token 여백 등재 · 옛 모서리 0 삭제). 원복 RED 6 (rule 칠 · DOM data-variant · Canvas 칩 · Canvas disabled · 줄바꿈 재측정 · 측정 여백). live (`s2-tokenfield-live.mjs`, 11/11): Publish Token `display: inline` · 테두리 1 · 모서리 4 · 여백 6 / 7 · 바탕 `rgb(248, 248, 248)`, 칩 테두리 색 픽셀 Canvas 1201 / Publish 1220 (한 줄) · 1241 / 1202 (300px 칸, 세 줄), 300px 칸 TokenInput 높이 Canvas 54 = Publish 54, 두 화면 캡처의 줄바꿈 위치 같음, 1 · 2단계 항목 그대로 PASS.

## [TokenField — 라벨 위치 · 라벨 정렬 · Form 상속 (S2 TextArea 패턴 2단계)] - 2026-11-23

### Added

- **TokenField `labelPosition` (top · side) · `labelAlign` (start · end, side 에서만)** — S2 TextArea 의 라벨 배치. side 는 S2 `field()` grid (`auto 1fr`) — 라벨 행은 1열 · TokenInput 첫 줄 높이에 (`--tf-side-label-offset` M 7 · L 10), 상자 Group 은 2열 맨 위, 도움말은 2열 아래. 끝 정렬은 DOM 이 라벨 글자 `text-align: end`, Canvas 가 라벨 행 `justify-content: end`.
- **Form 상속** — TokenField 가 Form 의 `labelPosition` · `labelAlign` · `size` · `isDisabled` 를 받고 (`CATALOG_FORM_FIELDS`), side Form 의 라벨 열 폭 (11rem = 176) 을 다른 field 와 같이 쓴다.
- **라벨 행 도움말 (ContextualHelp)** — S2 TextArea 처럼 TokenField 라벨 행에도 넣을 수 있다 (`CATALOG_CONTEXTUAL_HELP_FIELDS` — 같은 목록이 라벨 행의 side 선택자 별칭도 켠다).
  - **Why**: S2 체크리스트 §4.1 TokenField 2단계. 필수 표시 (`isRequired` · `necessityIndicator`) 는 넣지 않았다 — RAC TokenField 에 required · validation prop 이 없어 (`AriaTokenFieldProps` — `isDisabled` · `isReadOnly` 만) 표시만 넣으면 `aria-required` 없는 「필수」 가 된다. invalid 와 함께 결정 대기.
  - 위치: `packages/shared/src/catalog/bindings/TokenField.binding.ts` · `generated/componentRulesTable.ts` (TokenField `containerVariants` · `composition`) · `runtime/delegatedDom.runtime.ts` (`data-label-position` · `data-label-align`) · `document/formContext.ts` · `domain/componentTraits.ts` · `document/rulePartRules.ts` (`SIBLING_CONTROL_TYPES`) · `document/d2Provenance.ts`.
  - 확인: 테스트 `s2TokenFieldBox` +4 (binding 선택지 · side Canvas 위치 + DOM 속성 · 끝 정렬 · Form 상속), `fieldLabelPositionSide` · `sideLabelColumnContract` 에 TokenField, 기대값 갱신 2 (FieldLabel 소유자 · 라벨 위치 대상 목록). 원복 RED 6 (binding · 첫 줄 선택자 · DOM 속성 · Form · 라벨 행 별칭 · 첫 줄 대응표). live (`s2-tokenfield-live.mjs`, 9/9): side 라벨 행 · 상자 Canvas = Publish (M 행 0,7 · 상자 x 64.68, L 끝 정렬 행 0,10), side Form 안 TokenField 라벨 열 176 · 상자 x 183 양쪽 같음, 끝 정렬 Canvas `end` = Publish `end`, 1단계 항목 그대로 PASS.

## [TokenField — S2 TextArea 패턴: 상자 = control Group · 크기 S ~ XL · 상태 트리] - 2026-11-23

### Changed

- **TokenField 상자를 control Group (S2 `FieldGroup`) 이 그린다** — S2 에 TokenField 가 없어 S2 TextArea 를 따른다: 원본이 `TokenField > FieldLabel + Group > TokenInput + Description` 이 되고, 상자는 Group 이 Input rule 의 크기별 값 · 상태 트리 (hover · focus-within · disabled 테두리) 로 그린다. TokenInput 은 상자 (바탕 · 테두리 1 · 모서리 8 · 여백 12 / 8 · 최소 높이 36) 를 내려놓고 글자색만 Input 의 상태 트리. 상자 여백을 누르면 TokenInput 에 focus 가 간다 (S2 `FieldGroup`).
- **크기 S · M · L · XL** — TokenField 에 `size` (TextArea 와 같은 단계). 크기가 Group 을 건너 TokenInput · Token 의 글자 단계로 간다. 상자 높이는 한 줄이면 control 높이 (S 24 · M 32 · L 40 · XL 48), 모서리 7 · 8 · 9 · 10.
- **라벨 글자색 = field 상태 트리** — TextArea 처럼 disabled 면 S2 disabled 글자색 (전에는 disabled 에서도 휴지 색).

### Fixed

- **Canvas 가 TokenInput 의 두 줄 값을 한 줄로 쟀다** — rule 의 `white-space: pre-wrap` (TokenInput) · `nowrap` (Token) 이 Canvas 상자 키에 없어 버려졌다. 이제 측정 · 그리기가 DOM 처럼 읽는다 (Canvas 36 = Publish 36).
  - **Why**: S2 체크리스트 §4.1 TokenField — 「상자 값 · 상태 트리 · size 4단 · control Group 구조」. 남은 것: labelPosition · labelAlign · Form 상속 · invalid (RAC TokenField 에 validation 이 없어 결정 필요) · Token 모양.
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (`component-tokenfield__group`) · `catalog/generated/componentRulesTable.ts` (TokenField · TokenInput · Token) · `bindings/TokenField.binding.ts` (`size`) · `document/sizePropagation.ts` · `domain/componentTraits.ts` (`FIELD_CONTROL_GROUP_HOSTS` · `CATALOG_BOXED_FIELDS`) · `runtime/fieldPrefix.ts` (`BOX_INPUT_TYPES` · 여러 줄 상자 · `catalogFieldBoxInputDomStyle` — domBinding 에서 옮김) · `runtime/domBinding.runtime.ts` · `runtime/delegatedDom.runtime.ts` · `runtime/presence.ts` · `resolvers/resolveCatalogRuleCanvasBox.ts` · `document/ruleDefinition.ts` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` (`RULE_CARRIED_TEXT_KEYS`).
  - 확인: 테스트 `s2TokenFieldBox` 9 (구조 · rule 단계 · Canvas S ~ XL 상자 4 · 두 줄 높이 + Canvas 그리기 · 라벨 disabled 색 · DOM FieldBox), 원복 RED 8 (template · 상자 집합 · 상자 부품 · size 전달 · DOM 내려놓기 · whiteSpace 운반 · Canvas 허용 · 라벨 트리). 분류 목록 갱신 (`componentRulesTable.static` TokenField 계열 모서리, gap 리터럴 6 삭제). live (`apps/builder/scripts/s2-tokenfield-live.mjs`, 7/7): 여섯 TokenField 의 Group · TokenInput 상자가 Canvas = Publish (두 줄 값 포함), Publish 상자 테두리 2 · 모서리 7 / 8 / 9 / 10 · TokenInput 테두리 0 · 투명, hover 테두리 색 변화 · 상자 여백 누름 → TokenInput focus, disabled Group `data-disabled`, disabled 라벨 Canvas `#c6c6c6` = Publish `rgb(198, 198, 198)`, page error 0.

### Notes

- **disabled field 의 입력 글자가 Canvas 에서 휴지 색** — TextField 도 같다 (Canvas 의 Input · TokenInput record 가 field 의 disabled 를 받지 않음, Publish 는 회색). 이번 변경 전부터 있던 것이라 그대로 두었다.

## [MenuTrigger — Trigger 에 Context menu (S2) · ColorArea alpha 축은 채택하지 않음] - 2026-11-22

### Added

- **MenuTrigger `trigger` 에 `contextMenu`** — S2 · RAC 설치 타입의 값. 우클릭 · 터치 길게 누르기 · OS 키로 메뉴를 열고, 메뉴는 누른 자리에 선다 (RAC `useMenuTrigger` 의 `useContextMenu`). 왼쪽 클릭으로는 열리지 않고 trigger 에 `aria-haspopup` 이 붙지 않는다 (RAC). 열어 둔 (`isOpen`) context 메뉴의 Popover 는 S2 · RAC 처럼 offset 0 — Canvas 배치가 Popover 의 기본 offset 8 을 그대로 써서 Publish (버튼 바로 아래) 보다 8 아래에 그리던 것을 맞췄다 (`catalogOverlayPopoverOffset` — 작성한 offset 은 그대로 이긴다).
  - **Why**: S2 체크리스트 부록 C.1 — 설치 타입이 받는 값이 Design 패널 선택지에 없었다.
  - 위치: `packages/shared/src/catalog/bindings/MenuTrigger.binding.ts` · `catalog/runtime/overlayLayout.ts` (`catalogOverlayPopoverOffset` → `catalogOverlayPlacement`).
  - 확인: 테스트 `s2C1EnumValues` 6 (S2 설치본 offset 식 · 선택지 · offset 판정 · Canvas 배치 context 132 / press 140 / 작성 20 은 152 · ColorArea alpha oracle 2), 원복 RED 3 (선택지 · 판정 · Canvas 연결). live (`apps/builder/scripts/s2-menu-context-live.mjs`, headed Chrome, dev 5173): Publish 왼쪽 클릭 = 안 열림 · 우클릭 = 누른 자리 (44, 16) 에 메뉴 · press 메뉴는 버튼 아래 8 그대로 · 열어 둔 context 메뉴 Canvas (12, 32) = Publish (12, 32) · page error 0.

### Notes

- **ColorArea `xChannel` · `yChannel` 의 `alpha` 는 넣지 않았다** — 설치 타입 (`ColorChannel`) 은 받지만 RAC 의 면 그라데이션 (`useColorAreaGradient`) 이 alpha 축을 그리지 못하고 (rgb 는 alpha 0 · 255 가 같은 색, hsl · hsb 는 축 표에 없음) S2 ColorArea 도 다루지 않는다. 설치본이 바뀌면 `s2C1EnumValues` 의 oracle 이 실패해 다시 판정하게 한다.

## [Chart — 툴팁 모양 = S2 Tooltip · 축 글자 = 글자 토큰] - 2026-11-22

### Changed

- **Chart hover 툴팁의 모서리 · 여백 · 글자가 S2 Tooltip 값** — S2 에 Chart 가 없어 Tooltip (`Tooltip.tsx` — 모서리 `default` · 좌우 `edge-to-text` · 위아래 `centerPadding()` · 글자 `ui-sm`) 값을 따른다: 모서리 6 → 8, 여백 6 / 8 → 4 / 9, 글자 12 그대로 + 행간 16. 막대 · scatter · family 툴팁 셋이 같은 표면 style (`CHART_TOOLTIP_SURFACE`) 을 읽고, 값은 rule `chart` 채널 (`tooltipRadius` · `tooltipPaddingX` · `tooltipPaddingY` · `tooltipFontSize` · `tooltipLineHeight`) 에서 생성 CSS 변수 (`--chart-tooltip-radius` · `-padding` · `-font-size` · `-line-height`) 로 온다 — 기기 두 벌 토큰이라 터치 기기에서는 S2 처럼 커진다.
- **Chart 축 글자 11 이 글자 토큰** — rule `chart.metrics.fontSize` 가 리터럴 11 에서 `{typography.text-2xs}` (S2 `ui-xs` — desktop 11 · 터치 13) 로. 장면 계산이 숫자 하나를 쓰므로 `resolveChartMetrics` 가 설치된 글자 맵에서 px 로 풀어 Canvas · DOM 에 같이 준다 (`chartMetricFontSize`). 테마가 글자 단계를 바꾸면 축 글자도 따른다.
  - **Why**: 툴팁 모양이 DOM 세 곳에 숫자로 적혀 (rule 밖 — D3 위반) S2 Tooltip 과 달랐고, 축 글자는 S2 단계 밖의 고정 px 였다 (S2 체크리스트 §4.1).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Chart `chart` 채널) · `types/catalog-style.types.ts` · `packages/rendering/src/renderers/CSSGenerator.ts` (`generateChartVariables`) · `packages/rendering/src/chart/computeChartScene.ts` (`chartMetricFontSize`) · `packages/shared/src/components/chart/{chartInteraction,RechartsChart,FamilySceneHost}.tsx` · `components/Chart.components.tsx` (metrics memo 키에 풀린 글자 px).
  - 확인: 테스트 `s2Chart` 5 (S2 원본 식 · rule 값 · 생성 CSS 변수 · 툴팁 셋의 공용 style · 축 글자 토큰 → 11), 원복 RED 4 (rule · 생성 CSS · RechartsChart · 토큰 풀기). 기대값 갱신 2 (`adr306ChartSize` metrics, 리터럴 분류에서 Chart 11 삭제). live (`apps/builder/scripts/s2-chart-live.mjs`, headed Chrome, dev 5173): Canvas 에 Chart 를 놓고 툴팁을 켬 → 축 글자 그려짐 · page error 0, Publish 축 글자 13 개 모두 11px, 막대 hover 툴팁 모서리 8 · 여백 4 / 9 · 글자 12 · 행간 16.

## [FileTrigger — S2 처럼 `FileTrigger > Button` (자기 상자 없음)] - 2026-11-22

### Breaking Changes

- **FileTrigger 가 `children` (글자) · `size` · `isDisabled` 를 받지 않는다** — RAC `FileTriggerProps` 에 없는 축이라 자식 Button 노드로 옮겼다. 옛 문서의 FileTrigger 에 적힌 이 세 값은 검증에서 거절된다 (개발 단계 — 문서 마이그레이션 없음, 사용자 원칙 11-18). 버튼 글자 · 크기 · 비활성은 FileTrigger 안 Button 에서 고친다.

### Changed

- **FileTrigger 원본이 자기 칠 · 크기를 가진 버튼 하나** — S2 (RAC FileTrigger 를 그대로 내보내고 그 안에 S2 Button — `<FileTrigger><Button>Select files</Button></FileTrigger>`) 대로 원본을 `FileTrigger > Button` 으로: FileTrigger 는 요소가 없어 (`display: contents` · 칠 없음 — 자식이 있든 없든) Button 이 부모 흐름에 서고, 보이는 모양은 Button rule 의 것 (전의 밝은 바탕 · 테두리 상자 → S2 Button 기본 모양). FileUpload 안의 trigger 도 같은 원본이라 같은 구조.
  - **Why**: FileTrigger 가 Button rule 을 흉내 낸 자기 rule (크기 · 칠 · 숨은 input 선택자) 로 버튼을 그려, S2 · RAC 에 없는 prop 세 개와 「자식이 있을 때만 요소 없음」 분기 (Canvas · DOM 두 곳) 가 따로 있었다.
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (`component-filetrigger__button`, FileUpload trigger 의 `children` · `size` 삭제) · `catalog/bindings/FileTrigger.binding.ts` · `catalog/document/d2Provenance.ts` · `catalog/generated/componentRulesTable.ts` (FileTrigger rule) · `catalog/runtime/delegatedDom.runtime.ts` (자체 버튼 경로 삭제) · `catalog/runtime/elementless.ts` (`catalogElementlessWithChildren` 삭제 — rule 의 `display: contents` 하나로) · `catalog/runtime/compositionRoot.ts` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `canvasGesture.ts` · `panels/styles/catalog/catalogStylesHost.ts`.
  - 확인: 테스트 `s2FileTrigger` 6 (원본 트리 · 받는 prop · rule · Canvas 상자 = Button 상자 · DOM 요소 없음 + file input · FileUpload 트리), 기대값 갱신 5 파일 (`drawnBoxModel` — 자식을 지워도 상자 없음, `adr276ButtonOrigin` Button 자리 30, `phase4e10FileUpload` — rule 글자 한 줄 판정의 예를 Link 로, `s2VariantRemoval` · `componentRulesTable.static` 의 낡은 FileTrigger 값), 원복 RED 4 (Button 자식 · `size` 받기 · rule 상자 · DOM 자체 버튼 — 모두 실패 · 복원). live (`s2-filetrigger-live.mjs`, 새 프로젝트): Canvas FileTrigger > Button · 상자 100.21 × 32 = Publish Button 100.21 × 32, Publish 에 `.react-aria-FileTrigger` 요소 0 · file input 있음, Button 을 누르면 파일 선택 창이 열림, FileUpload 안 trigger 도 Button, 페이지 오류 0.

## [Sheet — S2 Modal · Dialog 값으로 (폭 480 · 여백 32 · 끝 정렬 닫기 · 여닫힘 fade)] - 2026-11-22

### Changed

- **Sheet 가 폭 360 · 안쪽 여백 24 · 본문 끝의 Close · 즉시 나타나고 사라짐** — 사용자 결정 「S2 값 그대로」 (S2 에 Sheet 가 없어 같은 계열의 `Modal.tsx` · `Dialog.tsx`): 폭 480 (Modal `size` M), 안쪽 여백 32 (Dialog header · content · footer), Close 는 끝 정렬 ButtonGroup 안 · 본문과 32 (footer `paddingTop`), backdrop 이 250ms 동안 나타나고 (ModalOverlay fade) 닫힐 때 Sheet 전체가 130ms 동안 사라진다 (ModalOverlay · Modal 둘 다 `isExiting` 130).
  - **Why**: S2 대응 값과 다르게 RAC starter 값 (360 · 24 · 본문 안 Close) 이 남아 있었다. 닫힘 fade 를 backdrop 에 걸면 RAC 가 overlay 요소 자신의 애니메이션만 기다려 (`useExitAnimation` — `ref.current.getAnimations()`) fade 가 시작되기 전에 지워져 (live 실측), 닫힘 fade 는 SheetOverlay 에 둔다 — S2 도 닫힐 때 바탕과 본체가 함께 사라진다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Sheet `width` 480 · SheetContent padding 32 · SheetBackdrop `&[data-entering]` · SheetOverlay `&[data-exiting]` — `skipCSSGeneration` 해제) · `catalog/document/generated/reusableOriginLibrary.ts` (`component-sheet__actions` ButtonGroup `align: end` · `marginTop` 16 > Close) · `components/styles/index.css` (생성 `SheetOverlay.css` 로드) · 게이트 `componentRulesTable.static.test.ts` (여닫힘 표시는 상태 어휘 밖 — 사유와 함께 등재) · `generatedCssLoadInventory.static.test.ts` (136 · index 118).
  - 확인: 테스트 `s2Sheet` 3 (Canvas 480 · 제목 (32, 32) · Close 가 ButtonGroup 안 · 오른쪽 · 아래 32 · 본문과 32, 생성 CSS 폭 · 여백 · fade, DOM `role=group` 끝 정렬), 기대값 갱신 2 (`racNewComponents` 폭 480 · 높이 144, `adr301Expansion` 구조), 원복 RED 6 (폭 · 여백 · footer 간격 · 정렬 · 닫힘 fade 두 자리 — 모두 실패 · 복원). live (`s2-sheet-live.mjs`, 새 프로젝트): Canvas 와 Publish 가 폭 480 · 제목 (32, 32) · Close 끝 · 아래 32 · 본문과 32 로 같음, Publish 에서 열면 backdrop 투명도 0 → 1 (약 250ms), Close 가 닫고 (ButtonGroup 너머 RAC close slot) 닫히는 동안 overlay 투명도 1 → 0.06 (약 100ms) 뒤 제거, 페이지 오류 0.

## [Autocomplete — S2 예제처럼 라벨 없는 검색 · 목록 위 간격 8] - 2026-11-22

### Changed

- **Autocomplete 원본의 검색 칸에 보이는 라벨 「Search」 가 있고 목록이 검색 칸에 붙어 있음** — S2 Autocomplete 예제 (`Menu.md` — `<SearchField aria-label="Search tags" />` + `<Menu styles={style({marginTop: 8})}>`) 대로: 검색 칸은 보이는 라벨 없이 `aria-label` 「Search items」 로 이름을 갖고, 목록은 검색 칸 아래 8 에 놓인다.
  - **Why**: S2 의 Autocomplete 는 RAC 것을 다시 내보낼 뿐이라 고유 구조가 없고, 공식 예제의 검색은 라벨 행 없이 목록과 8 간격이다. SearchField 는 `aria-label` 을 받지 않아 라벨을 비우면 이름이 없어졌다.
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (`component-autocomplete__search` 의 `label` 비움 · `aria-label`, `__listbox` `marginTop: 8px`) · `catalog/bindings/SearchField.binding.ts` (`aria-label` — 패널에는 숨김, 다른 binding 과 같은 `ARIA_LABELING_PROPS`) · `catalog/runtime/delegatedDom.runtime.ts` (RAC SearchField 에 `aria-label`).
  - 확인: 테스트 `s2Autocomplete` 2 (Canvas 라벨 행 숨김 · 검색 32 · 목록 8 아래, DOM label 요소 없음 · input `aria-label` · ListBox `margin-top` 8), `adr256AutocompleteNodeTree` 의 비교 문서를 새 원본에 맞춤, 원복 RED 3 (라벨 · 간격 · DOM `aria-label` — 모두 실패 · 복원). live (`s2-autocomplete-live.mjs`, 새 프로젝트 · 팔레트 Autocomplete): Canvas 라벨 행 숨김 · 검색 32 · 간격 8 = Publish label 요소 없음 · `aria-label` 「Search items」 · 검색 32 · 간격 8, Publish 에서 「ar」 입력 → Starred · Archive 로 걸러짐, 페이지 오류 0.

## [ListBox 항목 색 — 선택 항목 아이콘 · picker check 를 S2 색으로] - 2026-11-22

### Fixed

- **단독 ListBox 선택 항목의 아이콘이 accent 바탕 위에 어두운 색 · Select · ComboBox 팝오버의 선택 check 가 accent 가 아닌 어두운 색** — S2 Picker 항목 (`Menu.tsx` `icon` — `--iconPrimary: currentColor`, `checkmark` — `baseColor('accent')`) 대로: 항목 아이콘 (`Icon[slot=icon]`) 은 항목 글자색을 따른다 (선택 항목은 label · 설명과 같은 흰색), check 는 accent.
  - **Why**: 항목 색을 물려받는 부품 목록 (`catalogItemLabels`) 이 Text 만 담아 아이콘은 자기 휴지 색에 남았고, DOM 도 그 색을 inline 으로 박아 RAC 선택이 바꾼 항목 색을 받지 못했다. check 는 template 이 색을 토큰 참조 (`{kind:"token"}`) 가 아니라 `"{color.accent}"` 글자로 들고 있어 (8560fece5 부터, 파일 안 유일한 형태) Canvas · DOM 둘 다 읽지 못했다.
  - 위치: `packages/shared/src/catalog/document/manualBoxRules.ts` (`MANUAL_ITEM_LABEL_COLORS.ListBoxItem.iconSlots`) · `catalog/runtime/presence.ts` (`catalogItemLabels` 가 그 slot 의 Icon 도 담음 — Canvas 파생 색 · 갱신 의존) · `runtime/domBinding.runtime.ts` (그 Icon 은 작성 색이 없으면 `color: inherit`) · `document/generated/reusableOriginLibrary.ts` (check 색 = `lib:token:color_accent` 참조).
  - 확인: 테스트 `s2ListBoxItemDetails` +2 (Canvas 파생 색 · DOM `inherit` · check Canvas · DOM accent), 원복 RED 3 (토큰 글자 · `iconSlots` · DOM inherit — 모두 실패 · 복원). live (`s2-listbox-details-live.mjs` ⑤ ⑥, 새 프로젝트): 항목 아이콘 #ffffff (선택) · #292929 · #292929 가 Canvas = Publish, Select 팝오버 check #3b63fb 가 Canvas = Publish, 페이지 오류 0.

## [ListBox 항목 세부 — S2 Picker 의 설명 색 · 간격 · section 구분선 · 선택 check 크기] - 2026-11-22

### Fixed

- **ListBox 항목 설명이 label 과 같은 색 · 간격 2 · section 사이 구분선 없음 · picker 선택 check 가 모든 크기에서 16** — S2 Picker 항목 (`ComboBox.tsx` `listboxItem` · Menu.tsx `description` · `PickerSection`) 대로: 설명 = `neutral-subdued` (단독 목록의 선택 항목은 accent 바탕의 흰 글자 그대로 — 선택 채움 유지 결정 2026-11-14, 팝오버 목록은 선택 채움이 없어 늘), label ↔ 설명 간격 = `space(1)` 1, 「+ Section」 이 S2 Divider (Separator — 12 상자 · 2px · 좌우 edge-to-text) 를 함께 넣고 그 구분선은 목록 끝 · 연속이면 숨김 (Menu 의 11-18 방식을 ListBox 로 일반화 — `catalogCollectionSeparatorHidden`). 구분선이 section 을 나누므로 단독 목록 section 머리의 위아래 선은 지웠다 (바탕 · 글자는 그대로). picker 항목의 선택 check 는 크기를 따른다 (사용자 결정 「크기별로 키움」 — S2 `checkmarkIconSize` 10 · 10 · 12 · 14 를 우리 M 16 기준으로 × 16/10: XS · S · M 16 · L 19.2 · XL 22.4, 상자와 글리프 모두). 같은 template 을 복사하는 Menu 의 check 는 16 그대로.
  - **Why**: Canvas 는 항목 글자 색을 항목 칠 하나로 물려받고 DOM 은 ListBox rule 의 `color: inherit` 를 써, 설명만 다른 색을 줄 자리가 없었다. 구분선은 ListBox 가 Separator 를 자식으로 받지 않았고 (허용 목록 · DOM 자식 거르기 둘 다), 항목 넣기의 section 경로가 Menu 만 알았다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (ListBox 설명 색 선택자 · `.react-aria-Separator` 자리 · Header 선 삭제, ListBoxItem `gap` 1) · `catalog/runtime/presence.ts` (`catalogListBoxDescriptionColor` — Canvas 가 같은 선택자 값을 읽음 · `catalogCollectionSeparatorHidden`) · `runtime/compositionRoot.ts` · `runtime/delegatedDom.runtime.ts` (`LISTBOX_CHILD_TYPES`) · `commands/collections.ts` (`insertCollectionItem` `after`) · `apps/builder/src/builder/catalogRuntime/itemInsert.ts` (`SECTION_DIVIDER_HOSTS`) · `domain/componentTraits.ts` · `document/manualBoxRules.ts` · `document/selectionItemTemplates.ts` (picker 항목 rowGap 1 · Menu check 16 유지) · `document/generated/reusableOriginLibrary.ts` (ListBoxItem check 의 16 고정 삭제 — 작성값이 크기별 rule 값을 덮었다).
  - 확인: 테스트 `s2ListBoxItemDetails` 6 (Canvas 색 · 생성 CSS · 간격 · 구분선 넣기 · 숨김 · 자리 · DOM `role=separator` · Header 선), 기대값 갱신 6 파일 (gap 1 · ListBox 자식 Separator · S2 값 리터럴 등재), 원복 RED 11 (Canvas 색 · 시트 색 · 간격 · DOM 자식 · 넣기 · 숨김 · Header 선 · 구분선 자리 · check 크기 표 · template 16 · Menu 16 — 모두 실패 · 복원). live (`s2-listbox-details-live.mjs`, 새 프로젝트 · Builder 의 「+ Section」 · 「+ Item」): 설명 색 #ffffff (선택) · #505050 · 간격 1 · 구분선 section 기준 x 12 · 아래 5 · 높이 2 · 남는 폭 24 · Header 선 0 · 높이 32 가 Canvas = Publish, 끝 항목을 지우면 구분선 숨김 → Undo 로 다시 보임, Select L 팝오버 선택 항목 check Canvas 상자 · 글리프 19.2 = Publish 상자 · svg 19.2, 페이지 오류 0.

## [ListBox 항목 글자 단계 — S2 Picker 항목처럼 크기를 따른다] - 2026-11-22

### Fixed

- **ListBox 항목의 label · description 글자가 크기와 무관하던 것** — Canvas 는 label 14 · description 12 를 모든 크기에 그렸고 (`manualBoxRules.ts` `listBoxItemParts`), DOM 은 label 만 항목 크기를 따르고 description 은 12 고정이었다 (ListBox rule 의 item 선택자). 이제 S2 `PickerItem` (Menu.tsx `label({size})` · `description({size})`) 대로 label = 항목의 control 글자 · 500, description = 한 단계 아래 (S 11 · M 12 · L 14 · XL 16, XS 는 S2 에 없어 S 값) — 단독 ListBox 와 Select · ComboBox 팝오버 안 목록 모두. 값은 ListBoxItem rule 의 `sizeSelectors` 표 하나를 생성 CSS 와 Canvas part rule 이 같이 읽는다 (MenuItem 과 같은 방식). 단독 목록의 상자 · 선택 채움은 그대로 (사용자 결정 2026-11-14).
  - **Why**: 글자 크기를 두 consumer 가 따로 들고 있었다 — Canvas 는 RAC 레퍼런스 시절의 14 · 12 고정값 (manual part rule), DOM 은 ListBox rule 의 `inherit` · `--text-xs`. 크기별 값의 출처가 없어 M 만 우연히 맞았다. 고정 part rule 은 항목 rule 의 크기별 part rule 을 이기므로 (원복 RED 5) 지워야 표 하나로 모인다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (ListBoxItem `sizeSelectors` · ListBox item 선택자의 고정 크기 삭제) · `catalog/document/manualBoxRules.ts` (`listBoxItemParts`) · 생성 `ListBox.css` · `ListBoxItem.css`.
  - 확인: 테스트 `s2ListBoxItemText` (5 크기 × Canvas · DOM · 생성 CSS) · `d3S2Alignment` (S2 설치본 대조 2), 원복 RED 3 (크기 표 6 · Canvas 고정 5 · ListBox 고정 2 실패). live (`s2-listbox-text-live.mjs`, 새 프로젝트): ListBox S · M · XL 의 label 12 · 14 · 18 / description 11 · 12 · 16 과 항목 높이 40 · 50 · 70 이 Canvas = Publish, 크기 S → L → Undo 가 Canvas 에 바로 반영, Select L 팝오버 항목 label 16. Publish 에 HTTP 응답에 잡히지 않는 404 콘솔 1 건 (브라우저 자체 요청 — 이번 변경과 무관).

## [성능 ratchet — sticky-lists fixture 가 다시 스크롤 목록을 잰다] - 2026-11-22

### Fixed

- **sticky-lists edit `patchCalls` 15 → 195** — 11-22 기준 재설정 (`89608a46d`) 이 「남은 비용」 으로 적었던 값은 fixture 가 바뀐 장면이었다. ListBox 의 기본 overflow 가 빠진 뒤 (`268503f1a`, 11-13) fixture 의 목록 (높이 200) 이 스크롤 상자가 아니게 되어 ADR-267 의 장면 (넘쳐 스크롤하는 목록 + sticky 섹션 머리) 을 재지 않았다 (15 → 75). 그 장면에서 `4a79c6185` 가 큰 fallback patch 하나를 옮겨진 자리마다 작은 patch 로 나눴다 (75 → 195 — 쓰기는 15,225 → 4,125 로 줄었다). fixture 가 ListBox 에 overflow auto 를 직접 준다 (scroll-boxes 와 같다).
  - 위치: `apps/builder/scripts/perf-baseline.mjs` (sticky-lists fixture) · `apps/builder/perf/ratchet.json`.
  - 확인: HEAD 에서 두 번 같은 등급 A 값 — `patchCalls` 15 · `bufferSegmentsPeak` 27 → 3 · `spanCursorSteps` 71,265 → 14,414 · `paragraph.misses` 225 → 45 (11-12 기준 105). 스크롤 상자 몫 8 키는 11-12 기준과 같은 값으로, 저장 바이트는 overflow 값만큼 (5,445 → 6,045) 상한을 올렸다 (사용자 승인 · 만료 2027-05-22). B 경고 `cdp.LayoutCount` · `RecalcStyleCount` 23 → 29~30 (한도 25).

## [성능 계측 — 카메라 순간 이동을 팬 이동 거리 분포에서 뺀다] - 2026-11-22

### Fixed

- **many-pages100 page-jump `panDeviceMax` 460,895 → 1,480,707** — 실행 비용이 늘어난 것이 아니었다. 하니스의 page-jump 는 앞 부류 (zoom) 가 남긴 줌 4.0 에서 홈과 가장 먼 page 로 카메라를 한 프레임에 옮기고, ADR-273 의 팬 이동 거리 분포가 그 순간 이동을 팬 프레임으로 셌다. page 프레임이 내용만큼 자란 뒤 (`8ec1eed18`, 11-13) 100 page 가 약 3.2 배 길어져 (마지막 page y 369,150) 그 거리가 그대로 늘었다. 분포의 목적은 content 여백 크기 판단인데, 한 축이라도 화면 크기 이상 옮긴 프레임은 이전 화면과 겹치는 곳이 없어 어떤 여백으로도 덮을 수 없다 — 그런 프레임은 분포 · 최대에 넣지 않고 `cameraJumpFrames` 로 따로 센다 (`countPanMove`). 여백 이탈 재기록 (`contentRedrawsOutOfPad`) 은 그대로 센다. dev 계측만 바뀌고 렌더 동작은 같다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCounters.ts` (`countPanMove` · `cameraJumpFrames`) · `skia/SkiaRenderer.ts` · `apps/builder/perf/ratchet.json`.
  - 확인: ratchet many-pages100 두 번 측정이 같은 값 — page-jump `panDeviceMax` 1,480,707 → 96 (휠 팬 96 CSS px) · `panDeviceGt128` 2 → 0 · `panFrames` 140 → 138 · `cameraJumpFrames` 2, 다른 키 변화 0. Playwright (dev) 같은 문서에서 pan 부류는 180 프레임 · 최대 24 그대로.

## [Canvas 간격 손잡이 — 스크롤 상자 밖으로 넘친 gap 손잡이를 그리지도 잡지도 않는다] - 2026-11-22

### Fixed

- **항목이 많은 ListBox 를 선택하면 프레임마다 gap 손잡이를 항목 수만큼 그리던 것** — `33b1133b8` (11-13, 자식을 배치하는 모든 요소에 간격 손잡이) 뒤 ListBox 도 손잡이를 갖게 되어, 항목 300 이면 padding 4 + gap 299 를 매 프레임 그리고 (paint 606 대여) 상자 clip 이 거의 전부를 버렸다. 손잡이는 owner 의 가시 영역 (`hitBoundsMap` — 조상 clip 반영) 에 걸칠 때만 그리고 잡는다 — 그리는 판정과 히트 판정이 한 함수 (`spacingHandleInView`). 넘친 gap 손잡이 자리 (상자 아래) 를 누르면 보이지 않는 손잡이가 잡히던 것도 함께 막힌다 (canvas-interaction §8.5 — 보이는 것만 히트). ratchet scroll-boxes scroll `caches.paintPool.hits` 65,168 → 4,882 (상한 하향).
  - 위치: `apps/builder/src/builder/workspace/canvas/interaction/spacingGeometry.ts` (`spacingHandleInView` · hit test 의 `visible`) · `skia/spacingOverlayRenderer.ts` · `catalogRuntime/canvasGesture.ts` (host `hitBounds`) · `catalog/CatalogCanvas.tsx` · `apps/builder/perf/ratchet.json`.
  - 확인: Playwright (dev) scroll-boxes ListBox — 보이는 gap 손잡이 커서 · 넘친 gap 자리 커서 없음 · 휠 240 뒤 새로 보인 손잡이 잡힘 · 끌기로 항목 gap 0 → 16 · console 오류 0.

## [성능 ratchet 기준 재설정 — 11-22 회귀 수리 4 건 뒤 코드] - 2026-11-22

### Changed

- 성능 ratchet 기준을 `ba03990d3` 로 다시 잡았다 (사용자 지시 2026-11-22) — 13 run 을 세 번 재어 `--init` (세 번 같은 값만 A), 새 기준으로 세 측정 + 따로 한 번 더 잰 측정 모두 A · B 초과 0 (`decision=pass`). 이전 기준 (2026-11-12 `f8098fcf3`) 대비 A 키 같음 5,917 · 내려감 155 · 오름 391 · 새 68. 오른 것은 page 프레임 「내용만큼」 (`8ec1eed18`) 이후 남은 비용이다 — page 를 옮기는 편집의 화면 전체 다시 그리기 (app-pages · many-pages100 edit `contentFullRenders` 0 → 9 · nested-flex 0 → 6), page 이동의 옮기기 · 색인 (app-pages edit `translateNodes` 2,568 → 3,009 · `spatialUpsertCells` 2,936 → 23,307), sticky-lists edit (`patchCalls` 15 → 195 · `paragraph.misses` 105 → 225), scroll-boxes scroll `paintPool.hits` 7,598 → 65,168, many-pages100 page-jump `panDeviceMax` 460,895 → 1,480,707, select 함수 호출 +3 ~ 16 %. 이 값들이 새 상한이다. 위치: `apps/builder/perf/ratchet.json`.

## [Canvas page 이동을 page 원점 하나로 — 옮긴 page 의 요소마다 위치 정보를 다시 쓰던 것] - 2026-11-22

### Changed

- **page 높이가 바뀌는 편집 뒤 아래 page 를 옮기는 비용이 page 안 요소 수에 비례하던 것 → page 수에만** — Canvas 명령 stream 의 장면 기하 (상자 · hit 영역 · 조상 clip · 기록 문맥) 를 page 원점 기준으로 저장하고, 공간 색인 (포인터 판정 · 화면 후보) 을 page 마다 grid 하나로 나눠 질의가 그 page 원점을 더한다. page 를 옮기면 그 page 의 원점 하나와 page root 명령 하나만 바뀐다 (요소 항목 쓰기 0). 읽는 쪽은 그대로 `Map` 으로 장면 좌표를 받는다. ratchet: app-pages edit `translateNodes` 61,599 → 3,009 · `spatialUpsertCells` 367,573 → 23,307 · V8 호출 1,325,570 → 477,022 / many-pages100 edit `translateNodes` 272,874 → 3,009 · `spatialUpsertCells` 1,616,299 → 23,307 / 확대 · 축소 `spatialCellsVisited` 56,995 → 5,004 (page grid 가 내용 범위만 본다). dev headless 편집 뒤 2 프레임: page 를 옮기는 편집 ~37 → ~30 ms (옮기지 않는 편집 ~26 ms). 확대 · 끌기의 V8 호출은 +3 ~ 6 % (기하 맵 읽기가 함수 하나를 지난다).
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/pageSpace.ts` (새 — `PageSpace` · `PageLocalMap`) · `renderCommands.ts` (stream `pages`) · `subtreeCommandPatch.ts` (splice 가 page 를 먼저 정함) · `subtreeTranslate.ts` (`planPageMove` · `applyPageMove`) · `wasm-bindings/spatialIndex.ts` (page 별 grid) · `catalogRuntime/canvasBinding.ts` (`movePageRoots`) · 시험 `subtreeTranslate.test.ts` (page 300 벌: 옮김 → 옮긴 page 안 patch → 다시 옮김 = 처음부터 기록, 원점 이동 · page 지정을 빼면 RED) · `spatialIndexPages.test.ts` (page 이동 · 갱신 · 삭제 뒤 질의 = 장면 상자 전수 대조, 원점을 빼면 RED)

## [Canvas page 이동 비용 수리 — Select 가 있는 page 를 옮길 때마다 통째로 다시 기록하던 것] - 2026-11-22

### Fixed

- **page 높이가 바뀌는 편집마다 아래 page 중 Select (· Popover 를 여는 컴포넌트) 가 있는 page 를 통째로 다시 기록함** — 닫힌 Popover 는 `position: fixed` 라 「옮길 수 없는 상자」 로 분류됐고, 그 page 는 옮기기 대신 새 자리에서 다시 기록됐다. fixed 상자는 page 층에 page 기준으로 기록되므로 page root 를 옮기면 같이 옮겨진다 — 이제 page root 를 옮길 때는 fixed 자손을 거절하지 않는다 (page 안 상자를 옮길 때와 drag top layer 는 그대로 거절). app-pages (22 page) 의 높이를 바꾸는 편집 1회에 다시 기록한 명령 9,630 → 14 (편집 · 되돌리기 15회 합 57,906 → 210 — 회귀 전 기준 210), dev headless 편집 뒤 2 프레임 ~48 → ~37 ms. 옮긴 뒤 명령 · 기록 문맥 · clip · 상자 · hit 영역 · 화면이 다시 묶은 결과와 같다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeTranslate.ts` (`checkTranslate`) · 시험 `subtreeTranslate.test.ts` (fixed 자손 · page scroll 을 가진 page root 옮기기 = 처음부터 기록 — 수정 전 RED `top-layer`)
- 남은 것: 옮겨진 page 는 요소마다 상자 · hit · 색인을 고쳐 쓴다 (편집 1회 요소 ~6,800 — page 수 비례 — 같은 날 수리, 위 엔트리). page 를 옮기면 그 아래 화면 전체가 바뀌므로 화면 전체를 다시 그리는 것은 그대로다.

## [Canvas 편집 다시 그리기 회귀 수리 — page 프레임 높이가 바뀌는 편집이 page 전체를 다시 기록 · 화면 전체를 다시 그리던 것] - 2026-11-22

### Fixed

- **page 높이가 바뀌는 편집마다 Canvas 가 그 page 를 통째로 다시 기록하고 화면 전체를 다시 그림 (8ec1eed18 「page 프레임 = 내용만큼」 회귀)** — 프레임 높이가 바뀌면 프레임의 clip 이 바뀌어 모든 자손의 기록 문맥이 달라졌고, 바뀐 요소 (seed) 는 문맥이 같을 때만 자기만 다시 기록할 수 있어 page root 까지 물러났다. 이제 부모 · 그리기 순서가 같고 자리와 clip 만 바뀐 seed 는 새 문맥으로 자기만 다시 기록한다. 그리고 page 를 옮기지 않은 프레임 크기 변화는 화면 전체 대신 patch 의 영역만 다시 그린다. ratchet `render.patchWrites` nested-flex edit 14,679 → 1,155 (기준 1,155) · sticky-lists 15,225 → 4,125 · `placeFallbackSeedContext` 6 · 9 · 60 → 0. 프레임만 자라는 편집 5 회가 전부 부분 다시 그리기 (전 5/5 full), 화면 픽셀은 전체 다시 그린 것과 같다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeTranslate.ts` (`placeRegion` · `placementOnlyChange`) · `subtreeCommandPatch.ts` (`placedContext`) · `catalogRuntime/canvasBinding.ts` · `workspace/canvas/catalog/CatalogCanvas.tsx` · 시험 `subtreeTranslate.test.ts` (무작위 트리 1,000 — 다시 기록은 seed 뿐, 수정 전 273 건이 조상으로 물러남)
- 남은 것: 옮겨진 서브트리에 상자 밖으로 넘친 글자가 있으면 다시 그릴 영역을 모르므로 화면 전체를 그린다 (ADR-263 H1 계약 — nested-flex edit `contentFullRenders` 6 · app-pages 9). app-pages 의 page 이동 비용 (`patchWrites` 86,808) 은 11-19 기록의 「page root 이동」 과제다 (같은 날 수리 — 위 엔트리).

## [Canvas 편집 성능 회귀 수리 — page 프레임 두 상자 · 내용만큼 높이 뒤 엔진이 page 전체를 다시 풀던 것] - 2026-11-21

### Fixed

- **page 안 요소 하나를 고칠 때 엔진이 그 page 전체를 다시 계산함 (8ec1eed18 「page 프레임 = body 그대로」 회귀)** — page 프레임 높이가 내용만큼 (`fit-content`) 이 된 뒤 page 격자의 셀 높이가 컨테이너 높이와 늘 달라, 셀 배치가 프레임 서브트리 전체를 dirty 로 되살렸다 (2026-07-27 처방 — 그때는 증분 skip 키가 dirty 뿐이었다). 되살리기를 지우고 available 키에 맡긴다. 600 요소 nested-flex 편집 1회 1,734 → 74 solve (회귀 전 73) · 하니스 ratchet `engine.solveVisits` nested-flex edit 36,258 → 1,254 · app-pages edit 34,920 → 15,696 (기준 1,284 · 15,576).
- **absolute 자식이 많은 page 의 편집 · 끌기 · 테마 전환이 엔진 계산을 두 번 함 (5f0335963 page body 두 상자 회귀)** — 내용 상자 (명시 `position: static`) 가 absolute 자식을 자기 상자로 먼저 풀고 프레임 (containing block) 이 다시 풀어, 한 칸 skip 캐시가 번갈아 덮였다. 그 자식을 놓을 positioned 조상이 있으면 내용 상자는 풀지 않는다. ratchet `engine.solveVisits` 600 edit 18,076 → 9,076 · 60 drag 125 → 65 · theme-switch 16,899 → 8,499.
  - 위치: `packages/engine/src/tree.rs` (`solve_grid` 셀 배치 · `col_contribution` · `absolutes_placed_by_ancestor`) · 회귀 시험 4 (방문 수 2 — 수정 전 RED 146/398 · 43/163, 증분 = 처음부터 지은 결과 2) · 하니스 `perf-baseline.mjs` scroll-boxes fixture 가 ListBox 에 `overflow: auto` 를 직접 준다 (268503f1a 로 기본 overflow 가 빠져 ratchet 이 시작도 못 했다)
- 남은 것: 편집으로 page 프레임 높이가 바뀌면 프레임 clip 이 바뀌어 page 전체를 다시 기록하고 화면 전체를 다시 그린다 (ratchet `contentFullRenders` 0 → 6 ~ 9 · `patchMovedOnlyCommands`) — 별도 작업.

## [ADR-313 Implemented — 외부 데이터 가져오기 표준] - 2026-11-21

### Changed

- **ADR-313 을 Implemented 로 닫았다** (G5): Oracle · Java 응답의 `"Y"` · 숫자 글자 · 붙여 쓴 날짜 · epoch · 큰 정수가 어느 길 (붙여넣기 · 파일 · 가져오기 · API 실행 · Preview/Publish 조회) 로 들어와도 같은 값이 되고, 필터 · 제출은 서버가 아는 표현으로 되돌려 보낸다. 새 표 「Schema」 는 `api-docs` · JSON Schema 파일로 인터넷 연결 없이 열 · key · API 정의를 만들고, 격자 Export 는 표를 JSON Schema 로 낸다. 본문은 `docs/adr/completed/313-external-data-intake-standard.md`.
- 확인 (외부 요청을 모두 끊은 브라우저): 스키마 가져오기 → CSV 붙여넣기 (`9007199254740993` · `01234` · `Y` · `20261106` 그대로 읽힘) → 타입 · 값 표현 · key 확정 → Table · ListBox 연결 → Builder Preview · Publish 머리글 정렬 (큰 정수 key 가 숫자 순 · 날짜가 시간 순) · 격자 필터 → 새로고침 뒤 같은 값.

## [ADR-315 Phase 7 — 고정 기능이 없는 Table 의 스크롤 속도 회복 · Worker 필요 없음 판정] - 2026-11-21

### Fixed

- **Table 스크롤이 고정 기능을 쓰지 않아도 느려짐 (ADR-315 Phase 4 · 5 회귀)** — 고정 열 · 고정 행 · 행 고정 메뉴의 CSS 가 `:has(...)` 로 모든 Table 에 걸려, 고정이 없는 표에서도 가상 스크롤의 창이 움직일 때마다 브라우저가 그 조건을 다시 판정했다 (10,000 행 표의 스크롤 frame 당 일 +11 % · 긴 조작 뒤 정렬 클릭 CPU 4x +13 ~ 18 %). 그 규칙을 고정이 있는 표에만 붙는 표시 (`data-pinned-columns` · `data-pinned-rows` · `data-row-pinning`) 아래로 옮겼다 — Phase 0 빌드 대비 스크롤 · 정렬 · 로드 · 힙이 모두 1.10 배 안 (스크롤 0.98 ~ 1.01). 고정 동작은 그대로다.
  - 위치: `packages/shared/src/components/styles/Table.css` · `catalog/resolution/tableColumns.ts` (`_pinnedColumns`) · `catalog/runtime/domBinding.runtime.ts` · `catalog/runtime/tableTracks.ts` (`CATALOG_TABLE_PINNED_COLUMNS_PROP`) · 검사 `components/styles/__tests__/tablePinnedHasScope.static.test.ts`

### Changed

- **Worker 계산은 넣지 않는다 · 로컬 조회 상한은 10,000 행 그대로** (ADR-315 Decision 8 · 사용자 결정 7) — 10 만 행에서도 검색 입력의 계산 (가장 무거운 유사 검색 이어 치기 1x 138 ms · CPU 4x 532 ms) 이 정렬 클릭 기준선 안이라 조건을 넘지 않는다.
- 규칙 문서: `.claude/rules/data-interaction.md` 의 Table 실행 절을 ADR-315 의 사실로 갈았고, 문서 크기 상한 때문에 긴 절 셋 (반복 표시 · picker · Table 열 트랙) 의 원문을 `.claude/skills/composition-patterns/reference/` (`row-repeat.md` · `catalog-subparts-details.md` · `table-data-grid.md`) 로 옮겼다.

## [ADR-315 Phase 6 — Table 같은 값 합치기 · 칸 범위 선택 · 복사] - 2026-11-21

### Added

- **Column 「Merge same values」 (Design 패널 Property 탭 Behavior) — 시각 병합**
  - 켠 열에서 보이는 순서로 이어지는 같은 값의 칸을 한 칸처럼 보인다: 첫 칸만 값을 보이고, 이어지는 칸은 값과 그 사이 선을 그리지 않는다. 정렬 · 검색 · 필터 · 묶기가 바뀌면 병합도 따라 바뀐다. 묶음 행 · 상세 행 · 고정 행 · 빈 값은 합치지 않는다. 열을 옮기거나 고정해도 따라간다. Builder Canvas 도 같게 그린다.
  - Preview · Publish 의 DOM 은 행마다 칸을 그대로 두고 글자도 남긴다 (화면 낭독기가 읽는다 — 보이지만 않게). 가상 스크롤 표는 창 안 첫 행이 값을 보인다.
  - 위치: `packages/shared/src/catalog/runtime/tableCellMerge.ts` · `resolution/resolver.ts` (`boundTableRows` · `runRowsOf` · `withMergedRow`) · `resolution/tableColumns.ts` · `runtime/presence.ts` · `generated/componentRulesTable.ts` (Row `cell-lines` · Cell `merge-line`) · `runtime/compositionRoot.ts` (배치 입력) · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`. 회귀 `adr315CellMerge.test.tsx` · `adr315CanvasGroups.test.ts`.
- **Table 「Cell selection」 (Design 패널 Property 탭 Behavior) — 칸 범위 선택 · 복사**
  - Preview · Publish 에서 칸을 끌어 범위를 고르고, Shift 클릭으로 늘리고, Ctrl / Cmd 클릭으로 범위를 더한다. Shift + 화살표 · Ctrl / Cmd + A (전체) · Esc (해제). Ctrl / Cmd + C 는 범위를 탭으로 나눈 글자로 복사한다 — 스프레드시트에 붙여 넣을 수 있다. 가상 스크롤 표는 화면 밖 행까지 복사한다.
  - 행 선택 (Selection mode Single · Multiple) 과 같이 켜지 않는다 — 행 선택을 켜면 이 스위치가 숨고 꺼진다.
  - 위치: `packages/shared/src/catalog/runtime/tableCellSelection.ts` (이 스위치를 켠 표만 읽는 lazy chunk) · `domRegistry.components.tsx` (`CatalogTable` · `CatalogTableCell`) · `domBinding.runtime.ts` · `catalogPreviewSession.ts` (`tableCellText`) · `compositionRoot.ts` (`rowValuesOf`) · `bindings/Table.binding.ts`. 회귀 `adr315CellSelection.test.tsx`. 접근성 예외 범위: `.claude/rules/ssot-hierarchy.md` §1 D1.

### Fixed

- **Canvas 가 네 변이 모두 0 인 테두리를 1px 상자로 그림** — `border-style` 이 있고 네 변이 0 인 노드 (병합 표의 행) 를 rule 칠의 균일 선으로 그렸다. CSS 처럼 아무것도 그리지 않는다 (`authoredPaintCanvas.ts`).

## [ADR-315 Phase 5 — 집계 6 종 · Table 묶음 행 (가상 스크롤 · Canvas 포함) · 합계 행 · 계층 데이터 · 상세 행 · 행 고정 · 서버가 쪽을 나누는 표] - 2026-11-21

### Changed

- **문서 contract 75 → 76** (ADR-315 Phase 5 — 집계 이름 6 종 · `TableFooter` 타입 · Table 원본의 「Totals」 slot): 75 로 저장한 프로젝트는 열리지 않는다 (「This project uses the previous format」). 변환은 없다 (ADR-315 R5 — entry 형 변경을 Phase 2 · 4 · 5 에 모은다).

### Added

- **집계 6 종 (사용자 결정 4 — 「전부 더함」)** — 데이터 보기의 묶기 집계와 Table 묶음 행에 median (중앙값) · unique (값 목록) · uniqueCount (값 종류 수) · extent (최소 – 최대) · first · last (묶음 첫 · 끝 행의 값) 를 더했다. 값은 정확히 같을 때만 같은 값이다 (`"A"` · `"a"` 는 둘 — 묶기와 같은 규칙). Code 보기에서 식으로 쓰고 읽을 수 있다. 위치: `packages/shared/src/collections/view/evaluate.ts` (`viewAggregateOf`) · `document/types.ts` (`VIEW_AGGREGATE_FNS`) · `codeView/generate.ts` · `apps/builder/src/builder/catalogRuntime/codeViewViews.ts`.
- **endpoint 「Median · unique · extent · first · last aggregates」 (Data 패널 API 조회 형식, body 형식)** — 켠 endpoint 에만 6 종 집계를 묶기 요청에 싣는다. 끈 endpoint 에서 6 종을 쓰는 보기는 묶기를 보내지 않고 전체 행을 불러와 (최대 10,000 행) 여기서 묶으며 「그 집계를 계산하지 않는다」 를 알린다. 위치: `collections/view/serialize.ts` (`extendedAggregates` · `AGGREGATE`) · `panels/datatable/editors/QueryFormatSection.tsx`.
- **Table 묶음 행 — Column 「Grouped」 · 「Group aggregate」 · 「Allow grouping」 (Design 패널 Property 탭 Behavior)**
  - 「Grouped」 를 켠 열 (또는 열 메뉴 「Group by column」) 로 Preview · Publish 의 연결된 Table 이 값마다 묶음 행을 보인다 — 묶은 칸은 「값 (개수)」, 「Group aggregate」 를 고른 열은 그 묶음 행 전부의 집계 (Count · Sum · Mean · Median · Min · Max · Extent · Unique values · Unique count · First value · Last value). 묶은 열은 맨 앞으로 오고 (고정 열 다음), 그 칸의 펼침 버튼 (← → 키 · 「Expand」 · 「Collapse」) 으로 묶음의 행이 한 단계 들여 써져 그 아래 나온다. 처음엔 접혀 있다. 여러 열로 묶으면 열 순서대로 중첩된다. 묶은 열로 정렬하면 묶음 순서가 그 정렬을 따른다.
  - 묶음 · 집계는 검색 · 열 필터 · 정렬 뒤의 **모든** 행으로 계산하고, 「더 보기」 · 쪽은 묶음 행으로 센다. 접힌 묶음은 행을 그리지 않는다.
  - 「Allow grouping」 을 켠 열은 열 메뉴에 「Group by column」 · 「Ungroup」 이 생긴다 (표 상태 `grouping` — 문서는 바뀌지 않는다).
  - 위치: `packages/shared/src/catalog/runtime/tableGroupRows.ts` (묶음 행) · `dataBinding.ts` (`boundRowsOf`) · `tableRowSlices.ts` (`catalogTableGrouping`) · `resolution/resolver.ts` (`nestTableRows`) · `resolution/tableColumns.ts` (묶은 열 앞 · `_treeColumn`) · `domRegistry.components.tsx` (`CatalogTableCell` — 펼침 버튼) · `domBinding.runtime.ts` (`treeColumn` · `expandedKeys`) · `catalogPreviewSession.ts` (`expandTableRows`) · `tableColumnMenu.ts` · `Table.css`. 회귀 `tableGroupRows.test.ts` · `adr315GroupRows.test.tsx`. live: production · headed Chrome · 1,000 행 — Dept 메뉴 「Group by column」 → 묶음 12 개의 개수 · Amount 합계가 행 생성기로 따로 센 값과 같음 · 첫 묶음 펼침 101 행 (aria-level 2) · 「Ungroup」 (`--check-group`).
  - **가상 스크롤 Table 의 묶음 (5b-2)** — 펼친 묶음의 행이 수천이어도 화면에 보이는 행 근처 60 행만 내용을 만든다: 행 창을 「묶음, 열린 묶음이면 그 행들」 의 보이는 순서 위에서 자르고, DOM 이 각 행을 그 묶음 안에 넣는다 (창 밖 행은 내용 없는 행 — 스크롤 높이 · 키보드 순서는 그대로). 위치: `resolution/resolver.ts` (`catalogShownGroupRows` · `windowedGroupRows` · `CatalogRowWindowKeys.depths`) · `runtime/domBinding.runtime.ts` (`CatalogWindowRowNest`). 회귀 `adr315GroupWindow.test.tsx`. live: production · headed Chrome · 1,000 행 가상 표 — 「Dept 9 (101)」 펼침 → 끝까지 스크롤하며 101 행 모두 Dept 9 · 보이는 빈 행 0 · DOM 행 최대 18. Phase 5 종결 때 10,000 행으로 다시: 묶음 12 의 개수 · 합 일치 · 「Dept 4 (836)」 펼쳐 끝까지 (스크롤 79 번) 836 행 모두 Dept 4 · 보이는 빈 행 0 · DOM 행 최대 18.
  - **Builder Canvas 의 「Grouped」 (5b-3)** — Canvas 도 작성한 묶음을 Preview 첫 화면처럼 그린다: 묶음마다 접힌 행 하나, 묶은 열이 맨 앞, 그 칸 시작에 펼침 표시 (Canvas 에서는 펼치지 않는다). 위치: `apps/builder/src/builder/catalogRuntime/catalogDataRead.ts` (`catalogBuilderBoundRows` 의 묶음 조각) · `packages/shared/src/catalog/runtime/tableTreeCell.ts` · `boxModel.ts` · `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` (`treeCellChevronShapes`) · `resolution/resolver.ts`. 회귀 `adr315CanvasGroups.test.ts`. live: production · headed Chrome · 1,000 행 — Builder Canvas 묶음 12 행 · Publish 첫 화면 묶음 12 의 개수 · 합계가 따로 센 값과 같고 두 화면이 같은 모양 (`--check-authored-group`).

- **Table 「Totals row」 (Design 패널 Property 탭 Behavior, 연결된 Table) — 합계 행 (5c)**
  - 켜면 표 바닥 (RAC `TableFooter`) 에 행 하나가 생기고, 칸마다 그 열의 「Group · totals aggregate」 (예전 이름 「Group aggregate」 — 묶음 행과 같은 설정) 를 **검색 · 열 필터 뒤의 모든 행** 위에서 보인다 — 「더 보기」 · 쪽 · 가상 스크롤로 일부만 보일 때도 합계는 전체의 것. 집계를 고르지 않은 열은 비어 있다. 끄면 사라진다. Builder Canvas 도 그린다.
  - 열을 더하거나 지우거나 옮기면 합계 행의 칸도 같이 맞춰진다. 합계 행은 선택 · 정렬되지 않고 표의 끝에 선다 (고정되지 않는다).
  - 위치: `packages/shared/src/catalog/bindings/TableFooter.binding.ts` · `document/generated/reusableOriginLibrary.ts` (Table 원본의 「Totals」 slot) · `commands/collections.ts` (`setTableTotalsRow` · `tableRowGroupsOf`) · `runtime/dataBinding.ts` (`catalogRowTotals`) · `runtime/tableRowSlices.ts` (`totals`) · `runtime/tableTracks.ts` · `resolution/resolver.ts` · `apps/builder/src/builder/catalogRuntime/tableTotals.ts` · `panels/properties/catalog/CatalogFilterSection.tsx` (`CatalogTableTotalsSwitch`). 회귀 `adr315TotalsRow.test.tsx` · `adr315CanvasGroups.test.ts`. live: production · headed Chrome · 1,000 행 — Canvas · Publish (가상 · 「더 보기」) 합계가 행 생성기로 따로 센 값과 같음 (`--check-totals`).
  - 아직: 컴포넌트 안의 Table 의 합계.

- **Table 계층 데이터 — 연결의 「Parent ID field」 · 「Children field」 (Design 패널 Collection, 5d)**
  - Tree 처럼 연결된 Table 도 행의 부모 필드 (평평한 행의 부모 key) 또는 자식 배열 필드를 고를 수 있다. 고르면 Preview · Publish 의 표가 부모 · 자식 행이 된다 — 첫 데이터 열 (작성 순서, 숨긴 열 제외) 칸에 펼침 버튼, 처음엔 모두 접힘, 펼친 행의 자식 행은 한 단계 들여 써져 그 아래 나온다 (← → 키 · 「Expand」 · 「Collapse」 — RAC 의 것).
  - 모든 단계의 행이 검색 · 열 필터 · 정렬 · 합계에 들어간다: 검색에 맞은 행은 조상 행과 같이 남고 (그 길이 보인다), 정렬은 단계마다 형제끼리, 합계 행은 남은 모든 단계의 행. 「더 보기」 · 쪽 · 가상 스크롤은 최상위 행으로 센다 (펼친 행의 자식은 그 쪽에 남는다). 접힌 행의 자식 행은 그리지 않는다.
  - Builder Canvas 는 최상위 행을 모두 접힌 채 그리고, 자식이 있는 행의 첫 칸에 펼침 표시를 둔다.
  - 묶은 (Grouped) 표에서는 묶음이 행을 담고 행 자신의 자식 행은 보이지 않는다.
  - 위치: `packages/shared/src/catalog/runtime/dataBinding.ts` (`catalogRowTreeIndex` · `treeBoundRows`) · `tableRowSlices.ts` (`CatalogRowTree`) · `resolution/resolver.ts` (`CatalogBoundRow.tree` · 다시 읽기 · 행 창) · `resolution/tableColumns.ts` (`nested` — 첫 열이 `treeColumn`) · `catalogPreviewSession.ts` (펼침 → 다시 읽기) · `apps/builder/src/builder/components/property/CollectionBinding.tsx`. 회귀 `adr315TreeRows.test.tsx` · `adr315GroupWindow.test.tsx` · `adr315CanvasGroups.test.ts`. live: production · headed Chrome · 1,000 행 (최상위 100) — Canvas 최상위 행 접힘 표시 · Publish treegrid → r0 펼침 → 자식 4 행 · Name 정렬 뒤 최상위와 자식이 각각 정렬 (`--check-tree`, 가상 · 「더 보기」).
- **Table 「Detail row」 (Design 패널 Property 탭 Behavior, 연결된 Table) — 상세 행 (5e)**
  - 켜면 반복 행 템플릿 아래에 칸 하나짜리 행이 생기고 (처음엔 첫 열의 값을 보인다 — 칸 안 내용은 Layers 에서 바꾼다), Preview · Publish 에서 행마다 첫 데이터 열의 펼침 버튼으로 그 행의 상세를 연다. 상세 칸은 보이는 열 전체를 덮고 (열을 숨기거나 더하면 따라간다), 그 행의 값 (`{필드}`) 을 읽는다. 묶음 · 계층 표의 잎 행도 펼친다. 끄면 사라진다.
  - 가상 스크롤 · 「더 보기」 · 쪽 모두 같고, 접힌 행의 상세는 그리지 않는다. Builder Canvas 는 모든 행을 접힌 채 (펼침 표시와 함께) 그린다.
  - 위치: `packages/shared/src/catalog/commands/collections.ts` (`setTableDetailRow` · `rowCells`) · `resolution/resolver.ts` (`catalogDetailRows` · `nestTableRows` · `tableHasDetailRow`) · `resolution/tableColumns.ts` (상세 칸 `colSpan`) · `runtime/compositionRoot.ts` (본문 구조 변경의 갱신 영역) · `domain/componentTraits.ts` (Row 안 Row) · `apps/builder/src/builder/catalogRuntime/tableDetail.ts` · `panels/properties/catalog/CatalogFilterSection.tsx` (`CatalogTableDetailSwitch`). 회귀 `adr315DetailRow.test.tsx` · `adr315CanvasGroups.test.ts`. live: production · headed Chrome · 1,000 행 — Canvas 모든 행 접힘 표시 · Publish r0 펼침 → 상세 행 칸 하나 · 열 6 을 덮음 · r0 의 이름 (`--check-detail`, 가상 · 「더 보기」).
  - 아직: 선택 가능한 표에서 상세 행도 선택된다.
- **Table 「Row pinning」 · 「Keep pinned rows」 (Design 패널 Property 탭 Behavior) — 행 고정 (5f)**
  - 「Row pinning」 을 켜면 Preview · Publish 에서 행마다 마지막 칸 끝에 행 메뉴가 생긴다 (행에 마우스를 올리거나 focus 하면 보인다 — Builder Canvas 는 그리지 않는다). 「Pin to top」 · 「Pin to bottom」 · 「Unpin」 으로 고정한 행은 표의 맨 위 · 맨 아래에 서서 표를 스크롤해도 머리글 바로 아래 · 표 바닥에 머문다 (가상 스크롤 · 「더 보기」 · 쪽 모두). 고정한 행은 고정 표시 (핀) 를 늘 보인다.
  - 고정한 행은 나머지 행의 정렬 · 쪽 · 「더 보기」 밖이다 — 쪽마다 고정 행이 같이 보이고, 쪽 수 · 「더 보기」 는 나머지 행으로 센다. 검색 · 열 필터에 맞지 않는 고정 행은 보이지 않는다 (고정은 남는다). 「Keep pinned rows」 를 켜면 검색과 무관하게 남는다.
  - Do: Row 의 「Pin row to top」 · 「Pin row to bottom」 · 「Unpin row」 (그 규칙이 실행된 행에). 고정은 표 상태 (`pinnedRows`) 라 문서는 바뀌지 않는다.
  - 묶은 표 · 계층 표에서는 아직 고정하지 않는다 (행 메뉴가 없다). 서버가 쪽을 나누는 표는 아래 5g. 상세 행이 있는 표에서 고정한 행은 펼치지 않는다.
  - 위치: `packages/shared/src/catalog/runtime/tableRowSlices.ts` (`CatalogRowPins`) · `runtime/dataBinding.ts` (`catalogPinnedRowOrder`) · `resolution/resolver.ts` (`withPinnedRow` · `withRowPinning` · 행 창 · `rowIndexOf`) · `runtime/domBinding.runtime.ts` (`data-pinned-row` · 행 메뉴 칸) · `runtime/tableOperationsDom.components.tsx` (`CatalogRowPinMenu` · `CatalogTableRowPinMeasure`) · `runtime/catalogVirtualizer.components.tsx` (`CatalogTableLayout` — 고정 행을 늘 만들고 sticky) · `catalogPreviewSession.ts` (`pinTableRow`) · `interactions/concepts/tableColumns.ts` (`rowPinning`) · `Table.css`. 회귀 `adr315RowPinning.test.tsx`. live: production · headed Chrome · 1,000 행 — r3 「Pin to top」 · r5 「Pin to bottom」 → 위 · 가운데 · 끝까지 스크롤하는 동안 r3 은 머리글 바로 아래, r5 는 표 바닥 (1 px 안), 그 자리를 누르면 그 행 (`--check-rowpin`, 가상 · 「더 보기」).

- **서버가 쪽을 나누는 표 (5g) — 묶기 · 합계 · 계층 · 행 고정이 전체 데이터의 것**
  - 쪽 · cursor 로 나눠 주는 endpoint 에 연결한 Table 의 묶기 · 합계 행 · 계층은 이제 받은 쪽이 아니라 **모든 행** 의 것이다. endpoint 가 그 계산을 받지 않으면 모든 쪽을 불러와 (최대 10,000 행 — 넘으면 행 없음 + 경고) 여기서 계산하고, Design 패널이 그 사실을 알린다.
  - Data 패널 API 조회 형식 (body) 의 「묶음의 행 조회 받기 (groupOf)」 를 켠 endpoint 는 서버가 묶는다: 묶음 행은 서버의 묶음 조회 (count · 집계), 묶음을 펼치면 그 묶음의 행만 따로 조회 (`groupOf` — 값 비교 조건이 아니라 식별: `"A"` 와 `"a"`, 빈 값과 `""` 는 다른 묶음), 두 단계 묶기도 단계마다 서버 값, 합계 행은 필드 없는 묶음 조회 하나. 서버가 준 행 수가 묶음 개수와 다르면 한 번 다시 묻고, 그래도 다르면 묶음 행에 「B (2 ≠ 5)」 로 보인다.
  - 「key 로 행 조회 받기 (keys.only · keys.except)」 (body) 또는 「고정 행 (key)」 · 「뺄 행 (key)」 파라미터 (suffix) 를 정한 endpoint 의 표는 다른 쪽에 있는 행도 고정할 수 있다 — 고정 행은 그 key 로 따로 조회하고 쪽 요청은 그 행을 뺀다 (「더 보기」 로 쪽을 더 불러와도 한 번만). key 는 필드 타입대로 보낸다 (숫자 key 5 ≠ 글자 「5」). 선언하지 않은 endpoint 의 표는 행을 고정하지 않고 Design 패널이 이유를 알린다.
  - 위치: `packages/shared/src/catalog/runtime/tableStateQuery.ts` (`catalogTableSliceServable` 의 `grouping` · `totals` · `tree` · `pins`) · `runtime/tableGroupQuery.ts` (묶음 · 합계 조회 번역) · `runtime/catalogPreviewSession.ts` (`loadsWhole` · `syncPinnedRows` · `syncGroupRows` · `syncTotals`) · `runtime/dataBinding.ts` (`CatalogRowPins.rows` · `servedTotals` · `servedSlicesOf`) · `runtime/tableGroupRows.ts` (`catalogServedGroupBoundRows`) · `collections/view/serialize.ts` (`keys` · `groupOf` · `keyRows` · `groupRows`) · `apps/builder/src/builder/panels/datatable/editors/QueryFormatSection.tsx` · `panels/properties/catalog/CatalogFilterSection.tsx` (`CatalogTableWholeRowsNotice` · `CatalogTableRowPinsNotice`) · `apps/builder/scripts/mock-query-server.mjs` (`keys` · `groupOf`).
  - 아직: 서버 묶음 · 합계 값의 소수 잡음 정리 (서버 값 그대로) · 서버 「쪽」 목록 위의 고정 · 서버 묶음.

### Fixed

- **서버가 쪽을 나누는 표의 묶기 · 합계 · 계층 (5g)** — 보기 없이 연결된 표는 불러온 첫 쪽만으로 묶음 · 합계를 보였고 (전체처럼), 정렬 · 검색을 서버에 보내는 표는 묶기 · 합계 · 고정을 통째로 잃었다.
- **집계 값의 부동소수 잡음** — 소수 값의 합 · 평균이 `453013.2899999999` 처럼 보였다 (live 에서 찾음). 합은 입력의 가장 긴 소수 자릿수로 반올림하고, 평균 · 중앙값은 그 합을 한 번 나눈 뒤 마지막 자리의 잡음만 맞춘다 (0.6 / 3 → 0.2 · 400 / 15 는 전체 자릿수 그대로 — 서버의 평균과 같다) (`viewAggregateOf`). 데이터 보기의 sum · mean · median 도 같다.
- **가상 스크롤 Table 의 펼침 표시** — 펼친 묶음의 펼침 버튼이 돌지 않았다 (가상 표는 칸을 한 겹 더 감싸 `Table.css` 의 자식 결합자가 닿지 않았다) — 자손 결합자로.
- **중첩 Row 의 선택 칸** — Table 의 Row 안 Row (묶음의 행) 가 선택 checkbox 칸을 숨기지 않아 RAC 가 예외를 냈다 — Table 찾기가 부모 Row 를 건너 올라간다 (`tableTracks.ts` `catalogTrackTableOf`).

## [ADR-315 Phase 4 — Table 열 숨김 · 순서 · 고정 · 폭 · 열 메뉴 · 열 선택 메뉴 · 머리글 끌기] - 2026-11-21

### Breaking Changes

- **문서 contract 74 → 75** (ADR-315 Phase 4 증분 4d — 노드 필드 `columnsOf`): 74 로 저장한 프로젝트는 열리지 않는다 (「This project uses the previous format」). 변환은 없다 (ADR-315 R5 — entry 형 변경을 Phase 2 · 4 · 5 에 모은다).

### Added

- **Table 「Column visibility menu」 (Design 패널 Property 탭 Behavior) — 열 선택 메뉴**
  - 켜면 표 바로 앞에 「Columns」 메뉴가 들어간다 (데이터에 연결하지 않은 표도). Preview · Publish 에서 메뉴는 표의 데이터 열마다 체크 항목을 보이고, 체크를 풀면 그 열이 숨는다 (표 상태 `hiddenColumns` — 행을 다시 읽지 않는다, 「Remember state」 표는 브라우저에 남는다). 마지막 행 머리글은 꺼져 보이고 풀리지 않는다. 표의 열을 더하거나 이름을 바꾸면 메뉴가 따라온다. 끄면 그 표에 연결된 메뉴가 지워진다.
  - 연결은 메뉴 (MenuTrigger) 노드의 `columnsOf` — Pagination 의 `pagesOf` 와 같은 방식이고, 메뉴의 첫 항목이 열마다 반복된다.
  - 위치: `packages/shared/src/catalog/commands/rowDisplay.ts` (`setColumnChooser`) · `resolution/resolver.ts` (`chooserRows`) · `resolution/tableColumns.ts` (열 머리글 글자) · `runtime/catalogPreviewSession.ts` (`columnChoices` · `chooseTableColumns` · `syncColumnChoosers`) · `runtime/compositionRoot.ts` · `apps/builder/src/builder/catalogRuntime/tableColumnChooser.ts` · `panels/properties/catalog/CatalogFilterSection.tsx` (`CatalogTableColumnsSwitch`). 회귀 `adr315ColumnChooser.test.tsx`. live: dev 서버 Builder 스위치 → Canvas 「Columns」 → Publish 에서 Type 해제 · 다시 체크 · Name 잠김 → 스위치 끔, 콘솔 오류 0.
- **열 Do (Interactions 패널)** — Table 「Show column」 · 「Hide column」 · 「Set shown columns」, Column 「Pin column to start」 · 「Pin column to end」 · 「Unpin column」 · 「Set column filter」 · 「Clear column filter」. Preview · Publish 의 표 상태에 쓰고 문서는 바뀌지 않는다. 작성자의 규칙은 열의 「Allow …」 (보는 사람의 메뉴 허용) 와 무관하게 동작한다. 열 필터 값은 그 열의 지금 비교 (없으면 대화상자의 시작 비교) 로 읽는다. 위치: `packages/shared/src/interactions/concepts/tableColumns.ts` · `componentInteractionSpecs.ts` · `runtime/catalogPreviewInteractions.ts` (`tableColumnState`) · `bindings/Table.binding.ts` · `Column.binding.ts`. 회귀 `adr315ColumnChooser.test.tsx`.

- **머리글 끌기 — Table 「Reorder columns」** — 켠 표의 데이터 열 머리글은 시작 쪽에 끌기 손잡이를 갖는다 (머리글에 마우스를 올리거나 손잡이에 focus 가 있을 때 보인다). 손잡이를 끌어 다른 머리글에 놓으면 그 열의 자리로 옮겨지고 (뒤 열에 놓으면 그 뒤, 앞 열에 놓으면 그 앞 — 놓을 쪽에 2px 선), 키보드로는 손잡이에서 Enter → Tab 으로 대상 → Enter. 고정한 열은 같은 쪽 안에서만 옮겨진다. 순서는 표 상태 `columnOrder` (열 메뉴의 왼쪽 · 오른쪽 이동과 같은 쓰기) 라 행을 다시 읽지 않고 문서는 바뀌지 않으며, 「Remember state」 표는 브라우저에 남는다. 끌기는 정렬을 일으키지 않는다. 손잡이와 놓을 자리는 처음 쓰는 표에서 불러오는 별도 chunk 다. 위치: `packages/shared/src/catalog/runtime/tableColumnDrag.components.tsx` (react-aria `useDrag` · `useDrop`) · `tableColumnMenu.ts` (`catalogColumnDropPatch`) · `catalogPreviewSession.ts` (`dropTableColumn`) · `tableOperationsDom.runtime.ts` · `domBinding.runtime.ts` · `components/styles/Table.css`. 회귀 `adr315ColumnDrag.test.tsx` · `tableColumnMenu.test.ts`. live: production 빌드 — Chrome · WebKit × 가상 · 「더 보기」 표에서 포인터 끌기 (Name → Amount) · 키보드 끌기 (Date → Dept) · 끌기 뒤 머리글 클릭 정렬, 콘솔 오류 0. 알려진 한계: WebKit 은 포인터 끌기 직후 첫 누름에 `pointerdown` 을 보내지 않을 때가 있어 그 클릭 하나가 먹지 않는다 (두 번째부터 정상 — react-aria 만 쓴 시제품에서도 같다).

- **작성된 정렬을 머리글에 표시** — 데이터 보기에 정렬을 적은 Table (Code 보기의 `toSorted` 등) 은 그 정렬을 머리글에 보인다: 정렬 허용 열에 화살표, 여러 열이면 순번. Builder Canvas 도 같이 그린다 (전에는 Canvas · Preview 모두 행만 정렬되고 머리글은 비어 있었다). Preview · Publish 에서 머리글을 누르면 그 방향에서 시작하고 (작성된 오름차순 열 → 내림차순), Shift 는 작성된 목록 끝에 더하며, 「Allow unsorted」 의 마지막 누름은 작성된 정렬로 돌아간다. 화살표와 순번은 한 상자이고 순번 칸은 고정 폭이다 (Canvas 와 같은 폭). 위치: `packages/shared/src/catalog/resolution/tableColumns.ts` (`catalogViewAuthoredSort` · `_authoredSort`) · `resolver.ts` · `runtime/presence.ts` (`catalogTableAuthoredSortShown` · `_sortMark` · `catalogSortMarkWidth`) · `compositionRoot.ts` (정렬 표시 part) · `catalogPreviewSession.ts` (`tableSortNow`) · `domBinding.runtime.ts` · `tableOperationsDom.components.tsx` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`. 회귀 `adr315AuthoredSort.test.tsx` · `tableColumns.test.ts`. live: production 빌드 — Builder Canvas 의 「↑ 1 Dept」 · 「↓ 2 Amount」, Publish 의 같은 표시 · 행 순서 · Amount 클릭 뒤 오름차순, Chrome · WebKit × 가상 · 「더 보기」, 콘솔 오류 0. 알려진 한계: 내용 감싸개가 없는 Column 은 Canvas 에 표시를 그리지 않는다 (Preview 는 그린다).

- **Column 「Hidden by default」 · 「Pinned」 (Design 패널 Property 탭)**
  - 「Hidden by default」 를 켠 열은 처음부터 보이지 않는다 — Canvas · Preview · Publish 모두. 숨긴 열도 검색 · 정렬 · 필터 대상이다. 행 머리글 열이 전부 숨으면 마지막 하나는 남는다. Builder 에서는 숨긴 Column 을 Layers 에서 그대로 고를 수 있다 (그 스위치를 다시 끄기 위해) — 그 줄과 칸 줄은 흐리게, 눈 감은 표시 (「Hidden column」) 와 함께 보인다 (`layerTree.ts` `columnHidden` · `CatalogLayerItem.tsx`).
  - 「Pinned」 (None · Start · End) 로 고정한 열은 가로로 스크롤해도 표의 왼쪽 · 오른쪽 끝에 남는다 — 가상 스크롤 표와 「더 보기」 · 「쪽」 표 모두, 머리글과 칸 둘 다. 고정 쪽 끝 열에는 1px 경계선이 그려진다 (Column · Cell rule 의 `pinned-edge` — Canvas 와 DOM 이 같이 읽는다). 앞 고정이 있으면 선택 checkbox 열도 같이 남는다.
  - 표 상태 (숨김 · 순서 · 고정) 는 Preview · Publish 실행 중 값이고 문서는 바뀌지 않는다. 「Remember state」 를 켠 표는 그 값을 브라우저에 남긴다. 최종 사용자가 쓰는 자리는 아래 열 메뉴 (필터 포함) · 열 선택 메뉴 · 머리글 끌기다.
  - 위치: `packages/shared/src/catalog/resolution/tableColumns.ts` (열 투영 한 곳 — 머리글 · 모든 행의 칸 · 트랙) · `resolver.ts` · `runtime/catalogPreviewSession.ts` (`tableColumnsNow` · 열 조각 변경 때 `root.reprojectColumns` — 행 source 를 부르지 않는다) · `compositionRoot.ts` (`touchesTableRows`) · `domBinding.runtime.ts` (`data-pinned` · `--table-pin-at`) · `tableOperationsDom.components.tsx` (`CatalogTablePinMeasure`) · `catalogVirtualizer.components.tsx` (`isStickyColumn` · 끝 고정 칸) · `components/styles/Table.css` · `bindings/Column.binding.ts`. 회귀 `resolution/__tests__/tableColumns.test.ts` · `adr315Columns.test.tsx`. live: production 빌드 2,000 행 · 가로 700 스크롤 — 가상 · 비가상 × Chrome · WebKit 네 조합에서 고정 열 머리글 · 칸이 끝에 남고 경계선은 고정 쪽 끝 열에만. dev 서버 Builder 에서 「Pinned: Start」 → Canvas · Preview 의 경계선 · sticky, 콘솔 오류 0.
- **열 폭이 표 상태다** — 크기 조절 열을 끌어 놓은 폭이 표 상태에 들어가고, 「Remember state」 표는 새로고침 뒤에도 그 폭으로 열린다. 끌기가 남긴 폭은 표를 다시 만들지 않는다 (스크롤 · focus 유지). 위치: `catalogPreviewSession.ts` (`resizeTableColumns` · `tableColumnWidths`) · `domRegistry.components.tsx` (RAC `onResizeEnd`) · `domBinding.runtime.ts` (Column `defaultWidth`). 회귀 `adr315RememberState.test.tsx`. live: production 빌드 — Name 열 150 → 270 px 끌기 → 새로고침 뒤 270 px, 가상 · 비가상 × Chrome · WebKit PASS.
- **열 메뉴 (S2 `ColumnWithMenu`) — Column 「Allow hiding」 · 「Allow pinning」, Table 「Reorder columns」 (Design 패널 Property 탭)**
  - 크기 조절 · 숨기기 · 고정 중 하나를 허용한 열, 또는 「Reorder columns」 를 켠 표의 모든 데이터 열은 머리글이 메뉴 Button 이 된다 (이름 뒤 ⋮ · 열 끝 선 — Canvas 와 Preview 가 같은 조건 하나 `isMenu` 를 읽는다). 정렬만 허용한 열은 지금처럼 누르면 정렬된다.
  - 메뉴 항목은 허용한 조작만: 오름차순 · 내림차순 정렬, 정렬에 추가 (여러 열 정렬 표), 열 숨기기, 앞에 · 뒤에 고정 · 고정 해제, 왼쪽 · 오른쪽으로 이동, 열 크기 조정. 지금 할 수 없는 항목 (마지막 행 머리글의 숨기기, 끝 열의 이동) 은 꺼져 보인다. 항목이 쓰는 값은 표 상태라 「Remember state」 표는 브라우저에 남는다.
  - 위치: `packages/shared/src/catalog/runtime/tableColumnMenu.ts` (항목 · 쓰기 한 곳) · `resolution/tableColumns.ts` (`catalogColumnHasMenu`) · `resolver.ts` (`applyColumnMenu`) · `catalogPreviewSession.ts` (`tableColumnMenu` · `runTableColumnMenu`) · `tableOperationsDom.components.tsx` · `componentRulesTable.ts` (Column `is-menu`) · `manualBoxRules.ts` (끝 선) · `bindings/Column.binding.ts` · `Table.binding.ts`. 회귀 `tableColumnMenu.test.ts` · `adr315Columns.test.tsx` · `s2TableViewStructure.test.tsx` · `adr257TableOperations.test.tsx`. live: dev 서버 Builder 에서 스위치 → Canvas ⋮ · 끝 선, Publish 메뉴로 고정 · 이동 · 고정 해제 · 내림차순, 콘솔 오류 0.
- **열 메뉴 「필터…」 · 「필터 지우기」 — Column 「Allow filtering」 (Design 패널 Property 탭)**
  - 「Allow filtering」 을 켠 열은 메뉴 Button 이 되고 (`isMenu`), 메뉴의 「필터…」 가 필터 대화상자를 연다: 조건 (그 열 필드 타입의 비교 — 글자는 「포함」, 숫자 · 날짜 · 참거짓은 「같음」 으로 시작, 서버 표는 요청이 담는 비교만), 값 (숫자 · 날짜 입력, 「사이」 는 시작 · 끝, 「최근 기간」 은 단위), 그리고 후보 값 목록 — 다른 조건으로 걸러진 행에서 그 열의 값마다 행 수 (자기 필터는 빼고, 정렬된 순서, 20 개가 넘으면 값 검색). 「같음」 은 후보를 고르면 값이 채워지고, 「그 중 하나」 는 여러 개를 고른다. 「적용」 은 그 열의 필터를 바꾸고 「지우기」 · 메뉴 「필터 지우기」 는 그 열의 필터만 지운다. 데이터에 연결하지 않은 표의 「필터…」 는 꺼져 보인다.
  - 필터는 표 상태 (열마다 조건 하나) 라 검색 · 다른 열 필터와 「그리고」 로 합쳐지고, 「Remember state」 표는 브라우저에 남는다. 대화상자는 처음 열 때 불러오는 별도 chunk 다.
  - 위치: `packages/shared/src/catalog/runtime/tableColumnMenu.ts` (`filter` · `clear-filter` 항목 · `catalogColumnFilterPatch`) · `tableColumnFilterDraft.ts` (입력 → 조건) · `tableColumnFilter.components.tsx` (대화상자 — RAC Dialog · Select · TextField · ListBox) · `catalogPreviewSession.ts` (`tableColumnFilter` · `setTableColumnFilter`) · `tableOperationsDom.components.tsx` · `resolution/tableColumns.ts` · `bindings/Column.binding.ts`. 회귀 `tableColumnMenu.test.ts` · `tableColumnFilterDraft.test.ts` · `adr315Columns.test.tsx`. live: production 빌드 2,000 행 원격 collection — Publish 에서 Dept 「포함 dept 1」 → Amount 「이상 5000」 → Dept 「같음」 후보 12 개의 행 수 · 「Dept 3」 적용 → 「필터 지우기」, 단계마다 행 수가 따로 센 값과 일치 (가상 · 「더 보기」 × Chrome · WebKit 네 조합). dev 서버 Builder 패널 스위치 → 문서 값 · Canvas `isMenu`, 콘솔 오류 0.

### Fixed

- **가상 스크롤 Table 의 열 숨김 · 보이기가 정렬된 표에서 수 초** (ADR-315 Phase 4 증분 1 부터, HC4 측정에서 발견):
  - **Why**: 10,000 행 · 정렬된 표에서 열 선택 메뉴로 열을 숨기면 CPU 4x 2,093 ms · 보이면 2,855 ms (같은 표의 정렬 706 ms). 화면 밖 빈 행의 React key 에 칸 span 서명이 들어 있어 열 수가 바뀌면 행 10,000 개가 묶음 안에서 하나씩 다시 놓였다 (React `getHostSibling` 1,435 ms).
  - 수정: 빈 행은 칸이 없어 key 를 행 key 만으로 두고, 행 모양이 바뀌면 64 행 묶음째 다시 만든다 (`domBinding.runtime.ts` `windowRowKey` · `catalogWindowRowChunkKey`). 4x 572 / 587 ms, 1x 75 / 77 ms (정렬 210 ~ 221 ms). 회귀 `windowRowKeys.test.ts` (원복 RED).
- **원격 collection 표의 필터 후보 값 개수가 0** (ADR-315 Phase 3 의 `tableFacet`, 4c live 에서 발견):
  - **Why**: endpoint 가 채우는 collection 의 묶음 보기는 「데이터의 일부」 표시로 개수를 `"13+"` 글자로 내는데, 후보 값은 그 글자를 숫자로 읽어 0 이 됐다 (Phase 3 의 live 는 후보 값의 집합만 봤다).
  - 수정: 후보 값은 정의상 불러온 행의 것이라 `loaded` 를 지금의 「일부」 판정으로 넘기고, 개수는 숫자 부분을 읽는다 (`catalogPreviewSession.ts` `tableFacet`). 회귀 `adr315FacetItems.test.tsx` (원복 RED).
- **열 메뉴의 「Sort Descending」 이 처음 누르면 오름차순** (ADR-315 Phase 4):
  - **Why**: 메뉴가 RAC 의 `sort(direction)` 을 불렀는데, Phase 2 뒤 Table 의 정렬 변경은 방향을 무시하고 누름 순환 (첫 방향 → 반대) 을 지났다.
  - 수정: Preview · Publish 의 메뉴 정렬은 표 상태의 정렬을 그 방향으로 정한다 (`tableColumnMenu.ts`).
- **정렬된 열을 숨기면 남은 정렬 열의 화살표 · 순번이 사라짐** (ADR-315 Phase 4 증분 1 부터):
  - **Why**: 세션이 정렬을 RAC 에 다시 알리는 것이 정렬이 바뀔 때뿐이라, 숨김 뒤에도 RAC 는 숨은 열을 첫 정렬로 들고 있었다.
  - 수정: 숨김이 바뀌면 보이는 열의 정렬을 다시 알린다 (`catalogPreviewSession.ts` `setTableState`). 회귀 `adr315AuthoredSort.test.tsx` (원복 RED).
- **한쪽 변 테두리만 쓴 칸의 나머지 변** — Cell 의 구분선처럼 한쪽 폭만 있는 inline 테두리는 나머지 변이 CSS 기본 `medium` (3px) 으로 그려졌다. 상자 폭 없이 한쪽 폭만 쓴 요소는 나머지 변을 0 으로 낸다 (`domBinding.runtime.ts`).

## [ADR-315 Phase 3 — Table 검색 · 유사 검색 · 열 필터 · 필터 후보 값] - 2026-11-20

### Added

- **Table 검색 (Preview · Publish)**
  - 연결한 Table 의 「Search」 스위치 (Design 패널 Property 탭 · Collection 구획) 를 켜면 표 앞에 검색 칸 (SearchField) 이 연결된 채 들어간다. 게시한 화면에서 글자를 치면 표의 행이 그 글자를 가진 행으로 좁혀진다 — 「더 보기」 · 「쪽」 · 가상 스크롤 표 모두 거른 전체에서 자기 행을 보이고, 정렬한 순서는 그대로다. 스위치를 끄면 검색 칸도 사라진다.
  - 검색 대상은 Column 의 「Searchable」 (기본 켜짐) 인 열이다. 열을 숨겨도 검색 대상은 바뀌지 않는다.
  - 「Search match」 로 표마다 「Contains」 (기본) · 「Fuzzy」 를 고른다. Fuzzy 는 띄엄띄엄 친 글자 (`prsn` → Person) · 낱말 첫 글자 · 한글 초성과 치는 중인 음절도 찾고, 표에 정렬이 없으면 잘 맞는 행부터 보인다.
  - 「Search text」 로 처음부터 걸려 있을 검색어를 적을 수 있다.
  - 서버가 쪽을 나눠 주는 표: 요청이 검색을 담을 때만 검색이 된다 — `body` 형식은 조건으로, `suffix` 형식은 endpoint 조회 형식의 새 칸 「표 검색어」 에 파라미터 이름 (json-server 의 `q`) 을 적었을 때. 담지 못하는 endpoint 의 표는 검색을 갖지 않고 (받은 쪽 안에서만 거르지 않는다 — 다른 쪽의 행이 빠진다) 패널이 사유를 알려 준다. 서버가 답하는 표의 Fuzzy 는 서버의 「포함」 검색이다. 원격 표는 글자를 멈춘 뒤 0.3 초에 요청한다.
  - 위치: `packages/shared/src/collections/view/rowFilter.ts` · `fuzzy.ts` (거르기 — 보기의 비교 그대로) · `catalog/runtime/tableStateQuery.ts` (번역 · 판정) · `catalogPreviewSession.ts` (`searchTable` · `tableShape`) · `bindings/Table.binding.ts` · `Column.binding.ts` · `collections/view/serialize.ts` (`searchParam`) · `apps/builder/src/builder/catalogRuntime/viewAuthoring.ts` (`catalogTableSearchCommand`) · `panels/properties/catalog/CatalogFilterSection.tsx`. 회귀 `adr315Search.test.tsx` · `runtime/__tests__/tableStateSearch.test.ts` · `collections/view/__tests__/rowFilter.test.ts`. live: production 빌드 10,000 행 — Builder 패널에서 스위치를 누르고 Publish 검색 칸에 「Person 12」 · 「e」 · 「dept 3」 · 「2026-0」 · 「zzz」 를 한 글자씩 → 보이는 행과 행 수가 따로 계산한 값 (258 · 10,000 · 857 · 7,468 · 0) 과 일치.
- **필터 컨트롤의 항목이 데이터의 값 전부다**
  - 「검색 · 필터」 구획에서 새로 넣는 고르기 컨트롤 (Select · RadioGroup · CheckboxGroup · TagGroup …) 의 항목이 그 필드의 모든 값이다 — 전에는 넣는 순간의 표본 20 개가 고정 항목으로 들어갔다. 다른 컨트롤의 선택으로는 좁아지고 자기 선택으로는 줄지 않는다 (고른 값 때문에 다른 값이 사라지지 않는다). 대소문자만 다른 값은 한 항목, 빈 값은 한 항목이다.
  - 전에 넣은 컨트롤의 고정 항목은 그대로다.
  - 위치: 보기의 `facet` (`catalog/document/types.ts` · `collections/view/evaluate.ts` `facetGroups`) · `viewAuthoring.ts` (`liveItems`). 회귀 `collections/view/__tests__/facet.test.ts` · `adr315FacetItems.test.tsx`. live: production 빌드 10,000 행 — 패널에서 `city` 필드의 RadioGroup 필터를 넣고 Publish 에서 항목 51 (「All」 + 도시 50 종) · 「City 7」 을 고르면 표 193 행 (따로 센 값과 일치).
- **열 필터 (표 상태 조각 — 조작 자리는 다음 단계)** — 열마다 조건 하나를 표 상태가 갖고 검색과 「그리고」 로 합쳐 거른다. 서버 표는 그 연산자의 파라미터가 있을 때만 받는다. 최종 사용자가 쓰는 자리 (열 메뉴 「필터」) 는 ADR-315 Phase 4 에서 들어온다.

### Performance

- **가상 스크롤 Table 의 검색 입력 — 결과가 같은 글자 120 ~ 128 → 72 ~ 80 ms (CPU 4x 264 ~ 272 → 128 ~ 144 ms)**
  - **Why**: 검색 한 글자마다, 결과가 같아도 창 60 행을 전부 다시 해석하고 (키당 50 ms) RAC 가 보이는 행을 다시 그렸다 (36 ms). 필터 계산 자체는 6 ms 였다.
  - 수정: 자리 · key 가 같은 행은 record 를 유지하고 (`compositionRoot.reorderRows`), 내용이 같은 행 key 목록은 이전 배열을 그대로 쓰며 (`heldRowWindow` — 새 배열이면 RAC 가 다른 collection 으로 본다), 보이는 행만 먼저 해석하고 나머지 창은 그 frame 이 그려진 뒤에 채운다 (`session.stageRowWindows`). 정렬 · 열 필터 변경도 같은 길이다.
  - **남은 것**: 결과가 바뀌는 글자는 136 ~ 144 ms 다 (전 144 ~ 160). 행 집합이 바뀔 때 RAC collection 을 다시 짜는 비용 (정렬 클릭 155 ~ 170 ms 와 같은 부류) 이다. p95 는 136 ~ 152 ms 로 ADR-315 G3 의 처음 기준 (100 ms) 을 넘어, 사용자 결정으로 기준을 정렬 클릭 기준선에 맞췄다 (계산은 키당 3 ~ 6 ms 라 Worker 로는 줄지 않는다).
  - 측정: production · headed Chrome (50 Hz) · 10,000 행 · 수정 전 · 뒤 빌드 교대 3 쌍, 25 글자의 입력 → 다음 paint. Phase 2 빌드 대비 로드 · 힙 · 정렬 클릭 · 스크롤 비율 0.92 ~ 1.05. 회귀 `adr315SearchWindow.test.tsx`.

### Tests

- **표 상태 모듈은 요청 직렬화기를 첫 화면에 싣지 않는다** — `runtime/__tests__/tableStateQueryImports.static.test.ts`. **Why**: `tableStateQuery.ts` 가 접미사 표를 `view/serialize.ts` 에서 값으로 import 해 직렬화기와 행 변환기 6,082 B 가 Builder 초기 번들에 들어왔다 (Phase 2 대비 +10,589 B → 접미사 표를 `view/querySuffixes.ts` 로 뗀 뒤 +4,612 B).

## [ADR-315 Phase 2 — Table 여러 열 정렬 · 필드 타입별 정렬 · 라이브러리 계약 74] - 2026-11-20

### Added

- **Table 을 여러 열로 정렬 (Preview · Publish)**
  - Table 의 「Multi-column sort」 (Design 패널 Property 탭 · Behavior 구획, 기본 꺼짐) 를 켜면, 게시한 화면에서 Shift 를 누른 채 머리글을 눌러 그 열을 정렬에 더한다. 같은 열을 Shift 로 다시 누르면 그 자리에서 방향이 바뀌고, Shift 없이 누르면 그 열 하나만 남는다.
  - 여러 열로 정렬된 표는 정렬 열마다 화살표 뒤에 순번 (1 · 2 …) 이 붙는다. 화면 낭독기가 읽는 정렬 표시 (`aria-sort`) 는 첫 정렬 열 하나다 (RAC).
  - 「Max sort columns」 로 정렬 열 수를 제한하고, 「Allow unsorted」 를 켜면 한 열을 세 번째 누를 때 정렬이 풀린다 (꺼 두면 지금처럼 오름 ↔ 내림).
  - Column 의 「First direction」 (처음 누를 때의 방향) · 「Empty values」 (빈 값을 뒤 · 앞 — 방향과 무관) — 「Allow Sorting」 을 켠 열에 나온다.
  - 「더 보기」 · 「쪽」 · 가상 스크롤 표는 정렬된 전체에서 자기 행을 보여 준다.
  - 서버가 쪽을 나눠 주는 표: 요청이 정렬 목록 전체를 담을 때만 여러 열 정렬이 된다 — `body` 형식은 `sort` 목록, `suffix` 형식은 endpoint 조회 형식의 새 스위치 「여러 정렬 받기 (쉼표 목록)」 를 켰을 때 `_sort=a,b&_order=asc,desc`. 담지 못하는 endpoint 의 표는 한 열로 정렬되고 (첫 정렬만 보내고 나머지를 받은 행에서 메우지 않는다 — 다른 쪽이 나온다), 패널이 그 사유를 알려 준다.
  - 위치: `packages/shared/src/catalog/runtime/tableStateQuery.ts` (번역 · 판정) · `catalogPreviewSession.ts` (`pressTableSort` · `tableSliceServable` · `uniqueView`) · `domRegistry.components.tsx` (Shift 기억) · `tableOperationsDom.components.tsx` (순번) · `bindings/Table.binding.ts` · `Column.binding.ts` · `collections/view/serialize.ts` (`multiSort`). 회귀 `adr315MultiSort.test.tsx` · `adr315MultiSortModes.test.tsx` · `runtime/__tests__/tableStateQuery.test.ts`. live: production 빌드 10,000 행 — Builder 패널에서 스위치를 누르고 Publish 에서 「Dept」 클릭 → Shift + 「Amount」 두 번 → 첫 행들이 따로 계산한 「Dept 오름, 그 안에서 Amount 내림」 순서 · 순번 표시 `Dept 1` · `Amount 2`.

### Changed

- **정렬이 필드 타입을 읽는다 — 빈 값은 뒤 (Table 머리글 정렬 · 데이터 보기의 정렬 공통)**
  - 날짜 필드는 시각으로, 숫자 필드는 값으로 (숫자 글자 `"10"` 포함), 불리언은 거짓 → 참, 글자는 지금처럼 (대소문자 무시 · 숫자 부분은 값으로) 비교한다.
  - **빈 값이 있는 열을 오름차순으로 정렬하면 빈 값이 맨 앞이 아니라 맨 뒤에 온다** (내림차순은 지금처럼 뒤). 전에는 빈 값을 빈 글자로 읽어 오름차순에서 맨 앞이었다.
  - 정렬 구현이 하나가 됐다 (`collections/view/sortOrder.ts` — 보기 · 표 · 작성한 Row 가 같은 함수). 열의 순위를 보관해 방향을 뒤집거나 둘째 정렬로 쓸 때 값을 다시 읽지 않는다.
  - 회귀 `collections/view/__tests__/sortOrder.test.ts` · `runtime/__tests__/tableSortedRows.test.ts`. production 실측 (Phase 1 빌드와 교대 3 쌍, 10,000 행): 로드 · 힙 · 정렬 클릭 · 스크롤의 비율 0.94 ~ 1.03.
- **라이브러리 계약 74** — 데이터 보기의 정렬 `sort` 가 한 항목에서 목록으로 바뀌어, 이전 계약 (73) 으로 저장한 프로젝트는 열리지 않는다 (마이그레이션 없음).

## [ADR-315 Phase 0 · 1 — Table 의 실행 상태를 한 곳에 · 「Remember state」] - 2026-11-20

### Added

- **Table 의 「Remember state」 스위치 (Design 패널 Property 탭 · Behavior 구획, 기본 꺼짐)**
  - 켠 표는 게시한 화면 (Publish) 에서 사용자가 누른 정렬이 새로고침 뒤에도 그 브라우저에 남는다. 꺼 두면 지금처럼 작성한 순서로 돌아온다.
  - Builder 의 Preview 는 저장하지 않는다 — 디자인 확인이 이전 조작에 물들지 않게.
  - 기억하는 것은 정렬이고, 열 숨김 · 순서 · 고정 · 폭은 그 기능이 들어올 때 (ADR-315 Phase 4) 같이 기억한다.
  - 저장된 값은 열이 지워지면 버린다 (열은 그 열이 보이는 필드의 key 로 적는다).
  - 위치: `packages/shared/src/catalog/bindings/Table.binding.ts` (`rememberState`) · `runtime/tableState.ts` · `runtime/catalogPreviewSession.ts` (`setTableState` · `restoreTableStates`) · `apps/publish/src/catalogSession.ts`. 회귀 `apps/builder/src/preview/catalog/__tests__/adr315RememberState.test.tsx`. live: production 빌드 — Builder 패널에서 스위치를 누르고 Publish 에서 「Name」 머리글 클릭 → 새로고침 → 오름차순 그대로 (끈 표는 작성 순서로).

### Changed

- **Table 의 실행 상태가 한 모델이다 (ADR-315 Phase 1 — 화면 동작은 그대로)**
  - 정렬 · 검색 · 열 필터 · 묶기 / 열 숨김 · 순서 · 고정 · 폭 / 펼침 · 행 고정 · 선택 · 쪽 / 칸 범위를 한 형 (`CatalogTableState`) 으로 두고, 조각 사이 규칙 (없는 열 버리기 · 데이터 조각이 바뀌면 첫 쪽 · 마지막 row header 열은 숨기지 않음) 을 한 함수가 지킨다. 지금 쓰이는 조각은 정렬이다.
  - 세션의 정렬 상태가 이 모델로 들어왔다. 쓰기 · 읽기가 하나씩이고, 정렬 · 검색처럼 행을 바꾸는 조각이 바뀔 때만 행을 다시 읽는다.
  - 이름 없는 열 (key · 글자 · id 가 모두 없는 Column) 의 기본 key 가 읽는 쪽과 명령 쪽에서 달랐다 (`col0` · `column1`) — `column<자리>` 하나로 맞췄다.
  - 위치: `runtime/tableState.ts` · `runtime/tableColumnRoles.ts` · `resolution/resolver.ts` (`tableState` reader) · `collections/resolveCollectionItems.ts` (`catalogDefaultColumnKey`). 회귀 `runtime/__tests__/tableState.test.ts` · `adr315TableState.test.tsx`.
  - production 실측 (변경 전 · 후 빌드 교대 3 쌍, 10,000 행): 로드 · 힙 · 정렬 클릭 · 스크롤의 비율 0.97 ~ 1.006.

### Internal

- **ADR-315 Phase 0 — 시제품 · 기준선** — 설치된 RAC 만으로 고정 열 · 행 창 위 펼침 행 · 고정 행 · Shift 정렬 · 열 메뉴와 머리글 끌기 · 칸 범위 선택이 되는지 실제 브라우저 (Chrome · WebKit) 에서 확인했다 (전부 통과 — 칸 범위 선택의 화면 낭독기 청취만 남음). 10 만 행의 화면 스레드 계산 시간과 속도 · 번들 기준선도 쟀다. `apps/builder/scripts/adr315-phase0-prototypes.mjs` · `adr315-phase0-mainthread.mjs`, 기록은 ADR-315 breakdown §9.

## [연결된 Table — 정렬이 전체 행 기준 · 정렬 클릭과 「포함」 필터 속도] - 2026-11-20

### Fixed

- **「더 보기」 · 「페이지」 방식 Table 의 헤더 정렬이 전체 행을 정렬한다**
  - 250 행을 연결하고 헤더를 눌러 내림차순으로 정렬하면, 보이던 100 행만 뒤집혀 100 번째 행이 맨 위에 왔다 (전체에서 가장 큰 값이 아니라). 「페이지」 방식은 그 쪽의 행끼리만 정렬됐다.
  - **Why**: 행을 표시 창 · 쪽으로 자른 뒤에 정렬했다. 이제 행을 읽는 단계가 정렬을 먼저 하고 자른다 — 「더 보기」 는 정렬된 전체의 첫 100 행, 쪽은 정렬된 전체의 그 쪽. 로컬 「페이지」 목록은 정렬을 바꾸면 1 쪽으로 돌아간다 (필터를 바꿀 때와 같다).
  - 가상 스크롤 Table 은 전부터 전체를 정렬했다. 서버가 정렬하는 Table · 정렬 변수를 쓰는 view 는 그대로다. 원격 「페이지」 목록은 받은 쪽 안에서만 정렬한다 (서버 정렬을 연결해야 전체 기준).
  - 위치: `packages/shared/src/catalog/runtime/dataBinding.ts` `catalogBoundRows` 의 `sort` · `sortedRowOrder`, `resolution/resolver.ts` `tableRowSort`, `runtime/catalogPreviewSession.ts` `sortTable`. 회귀 `apps/builder/src/preview/catalog/__tests__/boundTableSortBeforeWindow.test.tsx`. live: production Publish 탭, 「더 보기」 1,000 행 — 오름차순 · 내림차순 모두 보이는 100 행이 전체 기준 첫 100 행.

- **정렬된 열의 머리글이 다른 머리글보다 높아지지 않는다**
  - 내용 감싸개가 없는 열 (글자를 열에 직접 적은 Column) 을 정렬하면 정렬 화살표가 이름 위 줄로 올라가 그 머리글이 16 px 높아졌다 (32 → 48 px, 「더 보기」 Table 은 머리글 줄 전체가).
  - **Why**: Preview 의 시트에서 `svg` 는 줄 전체를 차지하는 요소인데, 감싸개가 없는 열은 화살표를 글자와 같은 block 안에 그냥 둔다. 화살표를 줄 안 (inline) 요소로 그린다. Quick Connect · 「+」 로 만든 열 (감싸개가 가로 줄) 은 전부터 한 줄이었다.
  - 위치: `packages/shared/src/catalog/runtime/tableOperationsDom.components.tsx` `CatalogSortIndicator`. 회귀 `apps/builder/src/preview/catalog/__tests__/adr257TableOperations.test.tsx`. live: production Publish 탭 — 감싸개 없는 열 32 → 32 px (전 48), 감싸개 있는 열 34 → 34 px.

### Changed

- **정렬 클릭이 빨라졌다 (가상 스크롤 Table)**
  - 정렬은 그 Table 만 다시 계산한다 — 전에는 페이지의 연결된 목록 전부를 다시 계산했다.
  - 10,000 행에서 클릭 486 ms 중 186 ms 가 React 가 순서가 바뀐 행을 하나씩 끼워 넣을 자리를 찾는 데 쓰였다 (행 수의 제곱). 행 묶음 (64 행) 을 「들어 있는 행」 으로 이름 붙여, 정렬 때는 묶음째 새로 넣는다.
  - 화면 밖 행의 빈 껍데기에서 칸을 뺐다 (행만 남김) — 열 6 · 10,000 행 Table 이 RAC 안에서 70,000 개 항목이던 것이 10,000 개가 됐다. 로드 · 메모리 · 스크롤 중 창 이동도 함께 줄었다.
  - production 실측 (headed Chrome 120 Hz, 열 6, 괄호 안은 2026-11-19 「행 창」 뒤 값):
    - 정렬 클릭 → 화면: 10,000 행 155 ~ 170 ms (512 ~ 520 — 순수 RAC 384 ~ 391), 1,000 행 80 ~ 84 ms (111 ~ 118 — 순수 RAC 27 ~ 32). CPU 4x: 10,000 행 0.55 ~ 0.58 s (1.9 ~ 2.1 s — 순수 RAC 1.57 s), 1,000 행 0.25 ~ 0.27 s (0.36 s)
    - 로드 · 메모리: 10,000 행 0.40 s · 155 MB (0.50 s · 210 MB), 1,000 행 0.31 s · 88 MB (0.32 s · 98 MB)
    - 빠른 스크롤 frame 간격 p95: 10,000 행 1x 16.8 ~ 25 ms (33) · 4x 115 ~ 117 ms (175), 1,000 행 4x 100 ms (108). 내용 없는 행이 보인 frame 0 · 콘솔 오류 0 · 스크롤 높이는 전과 같다.
  - 위치: `runtime/domBinding.runtime.ts` `catalogWindowRowChunks` · `catalogWindowRowPending`, `runtime/catalogVirtualizer.components.tsx` `CatalogTableLayout.buildRow`, `runtime/catalogPreviewSession.ts` `sortTable`. 회귀 `packages/shared/src/catalog/runtime/__tests__/windowRowChunks.test.ts` · `boundTableSortBeforeWindow.test.tsx`.
- **필터의 「포함」 비교가 빨라졌다**
  - 전에는 칸마다 글자 위치 하나하나에서 잘라 비교했다. 이제 영문 · 숫자 칸은 한 번에 찾고 (찾은 자리만 원래 비교로 확인), 한글이 든 칸은 검색어의 첫 자모로 시작하는 글자에서만 비교한다. 결과는 전과 같다 — 언어 설정 25 개 · 무작위 440 만 건 대조에서 차이 0.
  - 한글 · 영문이 섞인 10,000 행 × 3 필드: 13 ~ 21 ms → 2.7 ~ 5 ms, 100,000 행: 147 ~ 225 ms → 33 ~ 57 ms (node 실측).
  - (한글은 소문자 변환 방식으로 한 번에 찾지 않는다 — 검색용 비교는 글자를 자모로 풀어 「각가」 와 「가까」 를 같게 본다.)
  - 위치: `packages/shared/src/collections/view/comparison.ts` `textMatch`. 회귀 `collections/view/__tests__/containsFast.test.ts`.

## [가상 스크롤 Table — 보이는 행만 계산 (행 창)] - 2026-11-19

### Changed

- **가상 스크롤 Table 은 Preview · Publish 에서 보이는 행 근처만 계산한다**
  - 전에는 불러온 행 전부를 화면에 그릴 준비 (행마다 record 13 개) 까지 해 두고 그중 보이는 행만 DOM 에 두었다. 이제 보이는 행과 위아래 16 행 (60 행부터, Table 이 크면 그만큼 더) 만 계산하고, 스크롤로 보이는 행이 16 행 벗어날 때마다 그 16 행을 새로 계산한다. 나머지 행은 데이터로만 있고 RAC 에는 key 만 가진 빈 행으로 들어간다 — 스크롤 높이 · 키보드 이동 · 선택 · 행 수 (`aria-rowcount`) 는 전체 행 그대로다.
  - 창이 움직일 때 남는 행은 다시 계산하지 않고, 행 데이터도 다시 읽지 않는다. 빈 행의 높이는 잰 행의 높이를 따른다 (추정 41 · 실제 43 이면 창이 움직일 때마다 뒤 행 전부가 다시 놓이고 스크롤 높이가 흔들렸다).
  - production 실측 (headed Chrome 120 Hz, 열 6, 같은 문서의 순수 RAC Table 대조 — 괄호 안은 이 변경 전):
    - 10,000 행 로드 0.50 s · 메모리 210 MB (6.4 s · 1,079 MB), 1,000 행 0.32 s · 98 MB (0.9 s · 177 MB)
    - 정렬 클릭 → 화면: 1,000 행 111 ~ 118 ms (550 ~ 585), 10,000 행 512 ~ 520 ms (6.1 s — 순수 RAC 410 ~ 419). CPU 4x: 1,000 행 0.36 s (2.3 s), 10,000 행 1.9 ~ 2.1 s (25.6 s — 순수 RAC 1.6 s)
    - 빠른 스크롤 (frame 마다 120 px) 의 frame 당 일: 1x 1,000 행 6.8 ms (6.7) · 10,000 행 8.9 ms (8.9), 4x 30 ms (27) · 42 ms (44) — 평균은 같다
    - **나빠진 것**: 창이 움직이는 frame 이 길다 — frame 간격 p95 가 1x 16.7 ms (8.8) · 33 ms (16.6), 4x 108 ms (35) · 175 ms (58). 창 이동 한 번에 RAC 가 보이는 행을 다시 그리고 (collection 이 바뀌면 전부) 새 16 행을 계산한다. 내용 없는 행이 화면에 보인 frame 은 0.
  - 다른 가상 목록 (ListBox · GridList · CardView) 은 그대로 불러온 행 전부를 계산한다.
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts` `windowedRows` · `keptRowOf`, `runtime/compositionRoot.ts` `moveRowWindow`, `runtime/catalogPreviewSession.ts` `showRows` (`CATALOG_ROW_WINDOW_STEP`), `runtime/domBinding.runtime.ts` `CatalogWindowRows`, `runtime/catalogVirtualizer.components.tsx` `CatalogTableLayout`. 회귀 `apps/builder/src/preview/catalog/__tests__/adr310VirtualTable.test.tsx` (원복 RED: 창 이동이 전체를 다시 계산하면 실패). 측정 하니스 `apps/builder/scripts/datagrid-table-vs-tanstack-live.mjs`.

## [연결된 목록의 행이 많으면 Preview · Publish 탭이 죽던 문제] - 2026-11-19

### Fixed

- **2,000 행 이상에 연결한 Table 이 Preview · Publish 에서 열린다**
  - 가상 스크롤 Table (열 6) 을 원격 데이터 2,000 행에 연결하면 탭이 3 초 안에 죽었다 (1,000 행도 열리는 동안 메모리 1.1 GB).
  - **Why**: 화면 갱신이 실패할 때 되돌리려고 남기는 기록이, 행 하나를 더할 때마다 같은 템플릿에 묶인 행 목록 전체를 복사했다 — 행 수의 제곱. 이제 바뀐 행 하나만 기록한다.
  - production 실측 (headed Chrome, 같은 Table): 1,000 행 로드 0.9 s · 메모리 177 MB, 10,000 행 6.4 s · 1.1 GB (전: 2,000 행부터 탭 죽음).
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` `addSourceInstance` · `removeSourceInstance` · `sourceInRoot`, 회귀 `apps/builder/src/preview/catalog/__tests__/boundRowsJournalLinear.test.tsx`

## [Pagination — 쪽 이동 의미 · Page range 5 · 첫 · 끝 쪽과 생략 표시 · Simple · Icons only · Rows per page] - 2026-11-19

### Added

- **Pagination 에 「Rows per page」 Select 를 켤 수 있다** (사용자 「rows per page [select] 기능도 추가」 — shadcn aria Pagination 의 Icons Only 예제) — Property 의 Show 「Rows per page」 를 켜면 버튼 앞에 옆 라벨 Select 가 나온다. 기존 Select 원본을 그대로 놓고 (사용자 「select 컴퍼넌트도 기존의 컴퍼넌트를 사용」), 목록에 연결하면 그 첫 항목이 10 · 20 · 50 · 100 으로 반복된다 (표본의 나머지 항목은 지운다 — 쪽 번호와 같은 방식). Select 의 값은 연결된 목록의 Rows per page 다 — Canvas 도 목록의 값을 그리고 (사용자 「table 의 시작값을 받아오게」) 목록에서 바꾸면 따라간다. Preview · Publish 에서 보는 사람이 고르면 목록이 그 행 수로 1 쪽부터 다시 나뉜다 (원격 목록은 그 크기로 다시 요청, 문서 값은 그대로). 선택지에 없는 값 (5 등) 도 Select 가 그 수를 보인다. 위치: `bindings/Pagination.binding.ts` `showRowsPerPage` · `resolution/resolver.ts` `paginationPageSize` · `paginationRows` · `commands/rowDisplay.ts` `setPagination` · `runtime/catalogPreviewSession.ts` `setPageSize` · `runtime/catalogPreviewInteractions.ts` `pickPageSize`. 회귀 `adr310Pages.test.tsx` · `adr310BuilderPages.test.ts` · `paginationActionGroup.test.tsx` (목록 값 대신 시작 값을 쓰면 Canvas 가 10 · 고르기가 세션에 닿지 않으면 · Select 숨김을 끄면 실패).

- **Pagination 은 「Rows per page」 와 이동 버튼 묶음 두 덩이다** (사용자 「shadcn 은 rows per page · pagination 이 그룹화 — 좌 rows per page, 우 pagination 배치를 할 수 없다」 — shadcn 예제의 `Field` + `nav` 를 `justify-between` 으로 나란히) — 원본이 `Pagination > Select + frame (Previous · 번호 묶음 · Next)` 이고 Pagination 의 가로 배치가 양 끝 정렬 (space-between · 간격 16) 이다. Styles 에서 Pagination 폭을 늘리면 Select 는 왼쪽 끝, 이동 버튼은 오른쪽 끝에 붙는다 (폭이 내용만큼이면 그대로 나란히). 버튼 묶음 frame 안 간격은 8. 쪽 넘기기 · Controls · 첫 · 끝 쪽 판정은 frame 을 건너 Pagination 을 찾는다. 위치: `document/generated/reusableOriginLibrary.ts` `component-pagination__nav` · `runtime/presence.ts` `catalogPaginationPartHidden` · `runtime/catalogPreviewInteractions.ts` `paginationClick` · `resolution/resolver.ts` `paginationAbove`. 회귀 `paginationActionGroup.test.tsx` (양 끝 정렬을 빼면 · frame 건너기를 빼면 presence 11 건 · 클릭 7 건 · resolver 8 건 실패).

- **Pagination 의 Property 에 Controls (Default · Simple · Icons only) 가 생겼다** (사용자 「simple, icons only 기능도 추가」 — shadcn aria Pagination 의 두 예제) — Simple 은 번호만 (이전 · 다음, 첫 · 끝 쪽, 생략 표시 없음), Icons only 는 화살표 버튼 둘만 (번호 없음 — 글자는 숨고 「Previous」 · 「Next」 가 버튼 이름으로 남는다). 연결된 목록에서 둘 다 쪽을 넘긴다. 위치: `bindings/Pagination.binding.ts` `controls` · `runtime/presence.ts` `catalogPaginationPartHidden` (Canvas · DOM 같은 판정) · `resolution/resolver.ts` (화살표 버튼의 이름 `aria-label`). 회귀 `paginationActionGroup.test.tsx` · `adr310Pages.test.tsx` (숨김 판정을 끄면 2 건 실패).

- **Pagination 의 Property 에 Page range (기본 5) 가 생겼다** (사용자 결정 「기본 page range 를 5 개로」) — 목록을 넘기는 Pagination 이 한 번에 보이는 쪽 번호 수다. 보이는 쪽이 가운데에 오고, 처음 · 끝 쪽에서는 창이 끝에 붙어 늘 그 수만큼 보인다. 쪽이 더 적으면 전부 보인다. 그전에는 쪽 수만큼 번호를 다 그려 250 행 · 20 행/쪽이면 13 개가 한 줄에 나왔다. Pagination 은 S2 · v3 에 없는 composition 컴포넌트라 prop 도 composition 것이다. 위치: `packages/shared/src/catalog/bindings/Pagination.binding.ts` `pageRange` · `document/pageWindow.ts` `catalogPageWindow` · `resolution/resolver.ts` `paginationRows`.
- **첫 · 끝 쪽 버튼과 생략 표시** (shadcn aria Pagination 의 `PaginationEllipsis`, 사용자 「3번까지 진행」) — 창 밖의 첫 쪽 · 끝 쪽을 늘 누를 수 있고, 사이에 건너뛴 쪽이 있으면 「…」 이 보인다: 13 쪽 중 1 쪽 = `1 2 3 4 5 … 13`, 5 쪽 = `1 … 3 4 5 6 7 … 13`, 13 쪽 = `1 … 9 10 11 12 13`. 위치: `runtime/presence.ts` `catalogPaginationPartHidden` (Canvas · DOM 이 같이 읽는다) · `runtime/catalogPreviewInteractions.ts` `paginationClick`.

### Changed

- **Pagination 의 쪽 번호를 「쪽 이동」 으로 읽는다** (shadcn aria Pagination 비교, 사용자 「3번까지 진행」) — 번호 묶음이 하나만 고르는 ToggleButtonGroup 이라 화면 낭독기가 「라디오 3 / 13」 으로 읽었다. 이제 번호는 ActionButtonGroup 안의 ActionButton 이고, 보이는 쪽은 `aria-current="page"` 에 quiet 이 풀린 모양 (나머지는 quiet — shadcn 의 outline · ghost) 이다. 이전 · 다음은 화살표만이던 「←」 · 「→」 에서 화살표 + 「Previous」 · 「Next」 글자가 되어 이름이 글자다. 연결 전 표본은 `‹ Previous 1 2 3 … 10 Next ›`, Builder 에서 연결된 Pagination 은 쪽 정보가 없어 `‹ Previous 1 Next ›` (거짓 쪽 수를 보이지 않는다). 위치: `document/generated/reusableOriginLibrary.ts` `component-pagination` · `commands/rowDisplay.ts` `setPagination` (첫 번호만 반복, 표본의 나머지 번호 삭제 — 첫 · 끝 쪽과 생략은 남김) · `bindings/ActionButton.binding.ts` (`aria-current` · 항목 `id`, 패널 숨김). 회귀 `adr310Pages.test.tsx` · `paginationActionGroup.test.tsx` · `adr310BuilderPages.test.ts` (현재 쪽 표시를 끄면 2 건, 첫 · 끝 · 생략 숨김을 끄면 8 건 실패).

### Breaking

- **라이브러리 계약 73** — Pagination 원본이 바뀌어 이전 계약 (72) 으로 저장한 프로젝트는 열리지 않는다 (마이그레이션 없음).

## [Table 높이는 Styles 한 곳 · 「Pages」 가 Rows per page 를 따름 · Pagination 자동 연결] - 2026-11-19

### Changed

- **Table 의 Property 에서 Height Mode · Height 칸이 없어졌다** (사용자 결정 「나눠서 있을 필요가 없다」, S2 정렬 — S2 TableView 는 높이를 prop 이 아니라 `styles` 로 받는다). Table 의 높이는 Styles 의 Height 하나다. 새 Table 의 기본 높이는 400 그대로이고 (원본 template 의 Styles 높이), 내용만큼 늘리려면 Styles 에서 Hug 로 둔다. 그전에는 Height Mode 네 값 중 Fixed 만 실제로 구분됐고 (Auto · Viewport · Full 은 같은 동작), Styles 에서 높이를 주면 Property 의 Height 는 쓰이지 않았다.
  - 높이에 드는 행만 그리는 계산과 Data source 의 「Virtual scroll」 선택 가능 여부도 Styles 높이를 읽는다 — 다른 목록 (ListBox · GridList) 과 같은 판정. 그전에는 Styles 에서 높이를 240 으로 줄여도 행 수는 Property 의 400 기준이었다.
  - 기본 Table 의 바깥 높이가 402 → 400 (테두리 1px 이 높이 안에 든다 — Styles 의 다른 상자와 같은 border-box).
  - 위치: `packages/shared/src/catalog/bindings/Table.binding.ts` · `resolution/resolver.ts` `tableBoxHeight` · `document/generated/reusableOriginLibrary.ts` `component-table` · `apps/builder/src/builder/components/property/RowDisplayChoice.tsx`. 삭제: `compositionRoot.ts` `catalogTableHeight` · `CatalogTable` 의 높이 분기.

- **「Show rows」 에서 Pages 를 고르면 Pagination 이 같이 놓인다** (사용자 결정 「자동으로 붙여주는 게 편하다」) — 그 목록을 넘기는 Pagination 이 아직 없으면 목록 바로 뒤에 Pagination 을 놓고 연결한다. 한 단계라 Undo 한 번에 둘 다 되돌아가고, 선택은 목록에 그대로 남는다. 이미 연결된 Pagination 이 있으면 표시 방식만 바뀐다. Pages 에서 「Show more at the end」 · 「Virtual scroll」 로 바꾸면 그 목록에 연결된 Pagination 도 같이 지운다 (사용자 결정 — 역시 한 단계, Undo 로 복귀). 그전에는 Pagination 을 따로 놓고 패널의 셀렉트 (기본 None) 에서 골라야 페이지를 넘길 수 있었다 — 그 셀렉트 (Rows per page 아래) 는 연결을 자동으로 하게 되어 없앴다 (사용자 결정). Table · ListBox · GridList · CardView 공통. 위치: `apps/builder/src/builder/catalogRuntime/pagedList.ts` `catalogPagedListCommand` · `catalogUnpagedListCommand` · `paletteInsert.ts` (`beside` — 선택 바로 뒤에 놓기).

### Fixed

- **Table 의 「Pages」 에서 Rows per page 가 듣지 않던 문제** (사용자 보고) — 높이가 정해진 Table 은 Preview · Publish 에서도 「높이에 드는 행」 만 남겼다 (400 → 14 행). 그래서 Rows per page 를 20 · 30 으로 바꿔도 14 행이었고, 「Show more at the end」 도 창의 나머지 행에 닿을 수 없었다. 이제 높이로 자르는 것은 Builder 의 표본뿐이고, Preview 는 표시 방식이 주는 행 (한 페이지 · 더 보기 창 · 가상 스크롤 전체) 을 다 두고 Table 안에서 스크롤한다. 위치: `resolver.ts` `boundTableRows` (`fixed` · `sampled`). 회귀 `adr310Pages.test.tsx` (수정 전 20 → 14) · `adr310ShowMore.test.tsx` (Table 추가).
- **「Pages」 인 목록을 Canvas 가 첫 페이지로 그린다** (사용자 보고 — Compare Mode 에서 CSS · Preview 는 Rows per page 만큼, Canvas 는 전부) — Builder 의 행 읽기가 표시 방식을 보지 않아 Canvas 는 높이에 드는 행을 다 그렸다 (ListBox 는 40 행 전부). 이제 Rows per page 만큼 읽고, 그 페이지가 Canvas 가 세는 전부다 (「+N more」 표시 없음). Table · ListBox · GridList · CardView 공통. 위치: `apps/builder/src/builder/catalogRuntime/catalogDataRead.ts` `catalogBuilderBoundRows` (Builder root 의 `rows`). 회귀 `adr310BuilderPages.test.ts` (수정 전 5 → 14 · 40).
- **Table 머리 줄이 스크롤해도 위에 남는다** (S2 TableView) — 머리 줄을 위에 고정하고 Table 의 바탕으로 아래 행을 가린다. 가상 스크롤 Table 은 고정된 머리 줄이 투명해서 머리 글자가 첫 행 글자와 겹쳐 보였다. 위치: `packages/shared/src/components/styles/Table.css` `[data-node-table]`.

### Breaking

- **library contract 71 → 72** — `heightMode` · `height` prop 삭제. 이전 contract 로 저장한 프로젝트는 열리지 않는다 (변환 없음 — 개발 단계 원칙).

## [가상 스크롤 Table — Preview 에서 행이 보이지 않던 문제] - 2026-11-19

### Fixed

- **가상 스크롤로 둔 Table 의 내용이 Preview · Publish 에서 비어 보이던 문제** (사용자 보고 「가상스크롤시에 table 내의 내용이 보이지 않는다」) — 높이가 고정된 Table 은 넘치는 행을 자르려고 Table 과 TableBody 에 `overflow: hidden` 을 붙인다. 가상 스크롤에서는 RAC `Virtualizer` 가 높이 0 인 body 안에 행을 absolute 로 놓기 때문에, 그 자르기가 모든 행을 잘랐다 (ADR-310 Phase 4 부터). 이제 Preview 에서 가상 스크롤인 Table 은 자르지 않는다. Canvas 의 표본 행 표시는 그대로다. 위치: `packages/shared/src/catalog/resolution/resolver.ts` `BoundTableRows.virtualized` · `finishBoundTable`.
- 확인: 회귀 `adr310VirtualTable.test.tsx` (수정 전 RED). Live (Publish): 가상 Table 에 행이 보이고 스크롤하면 Person488 ~ 493 까지 이어짐, DOM 행 12 개 (가상화 유지), ListBox · CardView 가상화 정상.

## [편집 한 번이 문서 전체를 다시 계산하던 회귀 — page 프레임 = 내용만큼 뒤] - 2026-11-19

### Fixed

- **page 가 많은 문서에서 편집이 느려지던 문제** — page 프레임 높이를 「내용만큼」 으로 바꾼 뒤 (`8ec1eed18`, 2026-11-13) 요소 하나를 고칠 때마다 모든 page 의 배치를 다시 계산하고 Canvas 장면 전체를 다시 묶었다. 실측 (production · throttle 없음 · 편집 1회의 명령 처리 + 다음 프레임): 22 page 105 + 97 ms → 6 + 23 ms, 44 page 220 + 180 ms → 5 + 43 ms (2026-11-11 빌드는 22 page 4 + 11 ms). 세 곳을 고쳤다.
  - **레이아웃 엔진** — page 격자 (grid) 가 page 마다 행 높이 측정과 셀 배치를 서로 다른 available 로 두 번 풀어 캐시 키가 매번 어긋났다. 행 높이 측정 결과를 page 별로 기억해 (`grid_row_measure`, 서브트리 세대 키) 바뀌지 않은 page 는 다시 풀지 않는다. 위치: `packages/engine/src/tree.rs` `solve_grid` · `grid_row_measure_hit`.
  - **Canvas** — 내용이 늘어 page 크기가 바뀌면 그 page 만 다시 기록하고, 밀린 page 는 옮긴다 (fixed 상자 · 열린 overlay 를 가진 page 는 새 자리에서 다시 기록). 전에는 `geometry-reaches-scene-root` · `page-grid` 사유로 모든 page 를 다시 묶었다. 위치: `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` `geometryRegion` · `movePageRoots` · `recordSubtree`.
  - **Breadcrumbs · TagGroup 접힘** — 편집마다 문서의 접힌 목록을 전부 폈다 접으며 배치를 두 번 더 계산했다 (`2e5bbb9e7`). 이제 그 편집이 바꾼 page 의 목록만 다시 잰다. 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` `inRoots` · `settleLayout`.
- 확인: 엔진 `cargo test` 522 + 41 PASS · 회귀 `tree.rs` `page_grid_*` 2 · `phase4PageFrames.test.tsx` 5 · `adr256BreadcrumbsNodeTree.test.tsx` 1 (각각 수정 전 RED). Live (Playwright · production 빌드, 22 · 44 page 문서): page 를 키우고 줄이는 편집 3회마다 patch 된 장면의 상자 (6,841 · 13,644 개) 와 화면 픽셀이 장면을 다시 묶은 결과와 같음, 콘솔 오류 0.
- 남은 것: page 높이가 바뀌는 편집은 아래 page 를 옮기는 비용이 page 수에 비례한다 (44 page 43 ms).

## [Skeleton — 빈 래퍼로 놓기 · 안쪽 데이터의 로딩을 따름 · Preview 의 React Fragment 경고] - 2026-11-19

### Changed

- **Skeleton 안의 Table — 머리 칸 · 칸 글자는 그대로 보인다** (S2 정렬, 사용자 결정 「S2 와 맞게」) — S2 TableView 는 Column · Cell 의 글자를 `Text` 가 아닌 plain `span` (`columnHeaderText` · `cellContent`) 으로 그려 Skeleton 을 따르지 않는다. 그전에는 Table 을 Skeleton 으로 감싸면 머리 글자와 칸 글자가 전부 회색 막대였다 (Column · Cell 원본이 그 글자를 Text 노드로 가져서). 칸 안에 따로 넣은 Text · 머리 칸의 ⋮ · 정렬 화살표 (S2 Icon) 는 지금처럼 로딩 모양이 된다. Canvas · Preview 같은 판정. 위치: `packages/shared/src/catalog/runtime/skeletonContext.ts` `tablePartWords`.

- **Skeleton 의 Data 칸 삭제 — 안쪽에 연결된 데이터의 로딩을 따른다** (ADR-314 결정 변경, 사용자 지적 「Skeleton 과 자식에서 같은 collection 을 두 번 고르는 것은 불편」) — Preview · Publish 에서 Skeleton 은 안쪽 (다음 Skeleton 전까지) 에 collection 을 연결한 컴포넌트 중 하나라도 불러오는 중이면 로딩 모양이 되고, 응답 · 오류 뒤 풀린다. 안쪽에 연결된 것이 없으면 Loading 칸 값 그대로. Canvas 는 지금처럼 Loading 칸 값. 위치: `packages/shared/src/catalog/resolution/resolver.ts` `skeletonContentLoading` · `resolution/skeletonOwner.ts` · `runtime/compositionRoot.ts` `planBindingOwners` (행 갱신 때 그 Skeleton 까지 다시 해석). 이미 Skeleton 에 걸어 둔 연결은 무시된다.

- **팔레트로 놓는 Skeleton 이 비어 있다** (ADR-314 사용자 결정 2 변경) — 그전에는 S2 문서 예시 표본 (`frame > Image 160×120 + frame > 제목 · 본문 Text`) 이 따라 들어왔다. Skeleton 은 실제 내용 (Table 등) 을 감싸는 용도라 표본을 매번 지워야 했다 (사용자 지적). 놓은 Skeleton 은 Canvas 에 점선 자리 (높이 48) 로 보이고, 고른 채 넣는 컴포넌트가 그 안에 들어간다. 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` `component-skeleton`. 이미 놓은 Skeleton 의 표본은 그대로 남는다.

### Fixed

- **Skeleton 안에 Table 을 넣은 Preview 의 콘솔 오류** — 「Invalid prop `id` supplied to `React.Fragment`」. 모든 노드가 자동 HTML id (`skeleton_1`) 를 갖는데, 요소 없이 Fragment 로 그리는 binding (S2 `Skeleton` · `SkeletonCollection` · 자식 하나인 `SubmenuTrigger`) 에도 작성자 id · class · `aria-label` 을 붙이고 있었다. 이제 Fragment 에는 붙이지 않는다 (`domBinding.runtime.ts` `withHtmlId`, 회귀 `adr314SkeletonContext.test.tsx`).

## [S2 TableView 구조 — Table 의 Column · Cell · Column 메뉴] - 2026-11-19

사용자 요청 「table 도 S2 (TableView) 와 같은 구조 패턴으로」 — 설치된 `@react-spectrum/s2` 1.8.2 `TableView.tsx` 대조. 사용자 결정: Cell 글자는 Text 노드로 · Column 메뉴는 S2 대로.

### Changed

- **Column 머리 칸 내용** — S2 `ColumnContents` 처럼 `Column > frame (flex · 가운데 · 열 `align` 에 따라 정렬) > Text`. 그전에는 RAC 예제의 `Group[role=presentation]` 이었고, Canvas 는 끝 정렬 (`align: end`) 머리 글자를 시작 쪽에 그렸다.
- **정렬 화살표** — S2 처럼 정렬됐을 때만 글자 **앞**에 위 · 아래 화살표 (16 · 끝 여백 8). 그전에는 RAC 예제처럼 글자 뒤 chevron 이 늘 자리를 차지했다 (Canvas 가 정렬 가능한 열의 글자 칸을 20 줄였다).
- **Cell 내용** — 표 칸은 S2 `cellContent` 처럼 `Cell > Text` (Cell 원본 — Cell 의 글자가 Text 의 `{children}`). 줄임 (한 줄 · 말줄임) · 줄바꿈 · 정렬이 Text 에 걸린다. 팔레트 Table · 행 추가 · 열 추가 · 데이터 연결 · Quick Connect · 칸 합치기가 만드는 칸이 모두 원본 instance 이고, 선택 칸은 Checkbox 만 담은 plain Cell 그대로. 이미 있는 문서의 plain Cell 은 지금처럼 글자를 직접 그린다.

### Added

- **Column 메뉴** (S2 `ColumnWithMenu`) — 크기 조절 가능한 열 (`allowsResizing`) 은 머리 칸이 메뉴 Button 이다: 이름 뒤 ⋮, 누르면 「Sort Ascending · Sort Descending」 (정렬 가능할 때) · 「Resize column」 (S2 문구 — ko · ja · zh 번역). 크기 조절은 메뉴에서 시작하고 (키보드 화살표로 조정), 끌기 손잡이는 RAC focus 가 건너뛰는 `div` 안에 둔다. 그 열은 좌우 여백이 Button 으로 옮겨 가고 (S2 `paddingX: isMenu 0` · Button 16) 끝에 1px 선이 생긴다. Canvas 도 ⋮ · 여백 · 끝 선을 같이 그린다.

### Notes

- S2 와 남은 차이: S2 TableView 의 뿌리는 늘 `ResizableTableContainer` + 가상화 div 격자이고 우리는 크기 조절 열이 있을 때만 감싼 `<table>` 이다 (열 폭 계산이 RAC 폭으로 바뀌어 모든 Table 의 배치가 달라지므로 이번에 바꾸지 않음). S2 `menuItems` (사용자 메뉴 항목) 는 저작 표면이 없다. ⋮ · 화살표는 우리 아이콘 (lucide `ellipsis-vertical` · `arrow-up/down`) 이다.
- 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (Column 원본 · Cell 원본 `component-table-cell`) · `generated/componentRulesTable.ts` (Column `align` · `allows-resizing`, Cell 의 Text 블록) · `document/manualBoxRules.ts` (메뉴 열 끝 선) · `runtime/presence.ts` · `runtime/tableOperationsDom.*` (`CatalogSortIndicator` · `CatalogColumnMenuButton`) · `runtime/domBinding.runtime.ts` · 회귀 `apps/builder/src/builder/catalogRuntime/__tests__/s2TableViewStructure.test.tsx` · `adr257TableOperations.test.tsx` · `adr310TableTemplate.test.tsx`

## [ADR-314 — Skeleton 을 S2 래퍼로 (Implemented, Breaking · contract 71)] - 2026-11-18

ADR-314 Implemented (G6 — 사용자 확인, 샘플 프로젝트 「Skeleton 샘플」). [본문](adr/completed/314-skeleton-s2-wrapper.md)

### Added

- **SkeletonCollection** (Phase 4, S2) — CardView 를 고른 채 팔레트의 skeleton collection 을 넣으면 그 안에 Card 템플릿 하나를 가진 노드가 들어간다. Preview · Publish 에서 CardView 의 데이터를 불러오는 동안 (`loading` — 처음 · `loadingMore` — 「더 보기」) 그 템플릿이 회색 로딩 모양의 카드로 기존 카드 뒤에 반복되고, 응답 · 오류 뒤에는 사라진다. 반복 수는 S2 (RAC `GridLayout` · `WaterfallLayout`) 와 같은 규칙 — 높이를 정한 CardView 는 화면을 채우고, 내용 높이 CardView 는 지금 행 끝 + 한 행 (waterfall 은 모든 열에 하나). Canvas 는 템플릿 1 개를 로딩 모양으로 보인다 (편집 대상).

### Removed

- **수동 Skeleton 스타일 · 컴포넌트별 자리표시** (Phase 5, 사용자 결정 4) — 수동 `Skeleton.css` (1,189 줄) · 옛 `Skeleton` 컴포넌트 (`components/Skeleton.tsx`) 와 ProgressBar · Link · Slider · Checkbox · Switch · Badge · Tabs · Tree · Breadcrumbs · ListBox · Table 의 `isLoading` 자리표시 분기 (catalog 문서에서는 닿지 않던 경로). 로딩 모양은 Skeleton 래퍼 하나가 낸다.
  - 위치: `packages/shared/src/components/{ProgressBar,Link,Slider,Checkbox,Switch,Badge,Tabs,Tree,Breadcrumbs,ListBox,Table.components}.tsx` · `components/list.ts` · `index.ts` · `styles/index.css` · `apps/builder/src/types/builder/unified.types.ts` (`createDefaultSkeletonProps`). 번들 Phase 0 대비 Builder +818 · Preview +150 B gzip (CSS −2,034) — ADR-201 상한 안. 로딩 요소 200 개의 Preview frame p95 = 대조군과 같음 (1x · 4x).

### Fixed

- **CardView 자리 항목 개수 · 멈춤** (후속, ultrareview) — 로딩 중인 CardView 의 카드 크기 · 간격 · 열 수 · CardView 크기를 바꾸면 자리 항목 개수가 옛 값에 남아 빈칸이 생기거나 넘치던 것, 그리고 높이를 정한 CardView 의 템플릿 높이 · 행 간격이 모두 0 이면 Preview · Publish 탭이 멈추던 것 (grid 개수 계산이 끝나지 않았다 — waterfall 은 자리 항목 10,000 개). 이제 그릴 때마다 다시 재고, 높이를 늘리지 못하는 행은 그 행 끝 (waterfall 은 열마다 하나) 에서 멈춘다.
  - **Why**: 정리 커밋 (`9b9d30cab`) 이 측정 effect 를 측정 함수가 바뀔 때만 돌게 했는데, 그 함수는 `existing` · `waterfall` · `fixedHeight` 만 읽어 모양 편집이 재측정을 일으키지 않았다. grid 개수는 행이 높이를 늘리지 않으면 「viewport 가 남음」 이 늘 참이었다 (RAC `GridLayout` 은 추정 높이가 있어 0 이 없다).
  - 위치: `catalog/runtime/skeletonCollection.components.tsx` (`SkeletonMeasure`) · `skeletonRepeat.ts` · 회귀 `apps/builder/src/preview/catalog/__tests__/adr314SkeletonRepeatRemeasure.test.tsx`
- **로딩 글자 막대 · Link 밑줄** (후속, code-review) — 로딩 중인 Skeleton 안 글자의 Canvas 막대가 Preview 와 달랐던 것: 한 줄에 큰 글자 구간 (RichText) 이 섞이면 막대가 그만큼 높아졌고, `pre` · `pre-wrap` 줄은 줄 끝 공백만큼 짧았고, 말줄임 글자는 막대가 오른쪽 테두리 위까지 덮었다. 그리고 Preview 의 Link 밑줄이 WebKit (Safari) 에서만 막대 위에 보였다 (Chromium 은 숨김 — 이제 두 브라우저 모두 숨기고 Canvas 와 같다).
  - **Why**: Canvas 막대는 그 줄 모든 글자의 사각형을 합쳐 높이를 잡고 공백을 뺀 줄 끝 · 상자 바깥 끝을 썼다. DOM 막대는 로딩 span 의 줄 상자라 자기 서체 높이 · 보존된 공백 · host 의 padding box 에서 잘린다 (Chromium · WebKit 실측). 밑줄은 host 의 장식선이라 span 의 투명 글자색으로 지워지지 않고, Chromium 만 글자 채움색으로 그렸다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/skeletonLines.ts` (새 파일 — `nodeRendererText.ts` 의 클로저를 모듈 함수로) · `packages/shared/src/catalog/rule/skeletonLook.ts` → `generated/CatalogSkeleton.css` · 회귀 `skeletonLines.integration.test.ts` (실제 CanvasKit)
- **CardView 「더 보기」 스피너** — 다음 쪽을 불러오는 동안에도 스피너가 없던 것 (CardView 가 collection 의 로딩 상태를 받지 않았다). 자리 항목이 있으면 S2 처럼 스피너 대신 자리 항목이 보인다.

### Changed

- **Builder 의 로그인 · 대시보드 버튼 로딩** (Phase 5) — 처리 중 버튼이 회색 자리표시 상자 대신 RAC `isPending` (진행 원 · 누르기 막음) 으로 표시된다.
- **로딩 모양** (Phase 3) — 로딩 중인 Skeleton 안의 글자 (Text · Link · Meter 값 · StatusLight 글자) 는 줄마다 둥근 회색 상자, Icon · Badge · Meter 막대 · Image · Avatar 는 회색 상자 (안의 내용은 숨김), StatusLight 점은 옅은 회색이 된다 (S2 값 — `gray-100` · 밝은 띠 `gray-25` / dark `gray-300` · 점 `gray-200`). Preview · Publish 에서는 S2 처럼 밝은 띠가 2 초마다 지나가고 (페이지의 모든 로딩 요소가 함께), 움직임 줄이기 설정이면 움직이지 않는다. Canvas 는 같은 모양의 정지 화면이다. 모양이 붙어도 위치 · 크기는 그대로다.
- **로딩 중 비활성 범위 수정** (Phase 2 수정) — S2 처럼 입력 필드 · Button · Checkbox 등 form 컴포넌트만 비활성이 되고, Link · Tabs · Disclosure · 날짜 · 색 조작기는 비활성이 되지 않는다 (전에는 Canvas 에서 Link 가 흐려졌다).
  - 위치 (Phase 4): `bindings/SkeletonCollection.binding.ts` · `CardView.binding.ts` (`loadingState`) · `componentRulesTable.ts` · `componentCatalog.ts` · `domain/componentTraits.ts` · `reusableOriginLibrary.ts` (`component-skeletoncollection`) · `resolver.ts` (`LOADING_STATE_TYPES`) · `runtime/skeletonCollection.components.tsx` · `skeletonRepeat.ts` · `delegatedDom.runtime.ts` (`cardview`) · `canvasBinding.ts`
  - 위치: `catalog/rule/skeletonLook.ts` (값 한 곳) · `generated/CatalogSkeleton.css` · `styles/index.css` · `colorAliases.ts` · `tokenResolver.ts` (`--skeleton*`) · `runtime/skeletonAnimation.ts` · `skeletonContext.ts` · `inheritedProps.ts` · `providerContexts.ts` · `domBinding.components.tsx` · `domBinding.runtime.ts` · `components/Icon.tsx` · `canvasBinding.ts` · `nodeRendererText.ts`
- **로딩 중인 Skeleton 안의 내용** (Phase 2) — Text · Link · Icon · Badge · Card 등이 로딩 상태를 받아 Preview · Publish 에서 `inert` (클릭 · 포커스 안 됨) 가 되고, 안의 입력 필드 · Button 은 비활성이 된다 (S2). Button 안의 글자 · 아이콘은 로딩 대상이 아니다. 화면 모양 (회색 줄 상자) 은 Phase 3.
- **Skeleton 은 이제 내용을 감싸는 래퍼다** (S2 `Skeleton`) — 자식 없는 회색 자리표시 상자 (`div role="status"`) 가 아니라 실제 내용을 넣고 감싸는 요소 없는 노드다. Preview · Publish 에는 Skeleton 요소가 없고 감싼 내용이 Skeleton 부모의 항목으로 놓인다 (Canvas 도 같은 위치). 팔레트에서 놓으면 S2 문서 예시처럼 표본 내용 (Image + 제목 · 본문 Text) 을 감싼 채 들어오고 (사용자 결정 2), 고른 채 다른 컴포넌트를 넣으면 Skeleton 안에 들어간다. `Loading` 을 끄면 노드를 숨기지 않고 내용이 보통 모양으로 남는다. 감싼 내용의 로딩 모양 (gradient · 글자 줄 상자) 은 Phase 3 에서 붙는다 — 지금은 감싸기만 한다.
- **빈 Skeleton** 은 Canvas 에만 편집용 점선 자리 (높이 48) 가 있어 클릭해 고를 수 있다 (사용자 결정 3). Preview · Publish 에는 아무것도 없다.
- **Breaking — contract 71**: Skeleton 의 `size` 를 지웠다 (S2 · design-data · v3 어디에도 없음). 옛 contract 의 프로젝트는 열리지 않는다 (사용자 결정 1 — 변환 없음).
  - 위치: `bindings/Skeleton.binding.ts` · `componentRulesTable.ts` (Skeleton — `display: contents`) · `nestingRules.ts` · `presence.ts` (`catalogSkeletonIdle` 삭제) · `domBinding.runtime.ts` · `domRegistry.runtime.ts` · `elementless.ts` (`catalogEmptySkeleton`) · `compositionRoot.ts` · `canvasBinding.ts` · `ruleShapes.ts` · `reusableOriginLibrary.ts` (`component-skeleton` — 루트 slot `Content`) · `componentCatalog.ts` · `document/types.ts` (contract 71). ADR-314 Phase 0 인벤토리 (shared 자기 로딩 경로는 catalog 문서에서 닿지 않음 · 번들 기준선) 는 [breakdown §7](adr/design/314-skeleton-s2-wrapper-breakdown.md).

## [S2 정렬 — 미대조 9종 구조 · 결정 대기 반영 (기본값 · Button form 속성)] - 2026-11-18

### Changed

- **기본값을 S2 로** (사용자 결정 §7-5 「전부 S2 로」) — 새로 놓는 Badge `variant` neutral (전 accent), InlineAlert `variant` neutral (전 informative — 아이콘 없음), ButtonGroup `align` start (전 end — Dialog 의 ButtonGroup 은 S2 처럼 end 그대로), Tree `selectionStyle` checkbox (전 highlight — 선택 모드가 있으면 행마다 Checkbox), DatePicker · DateRangePicker · DateField · TimeField `hideTimeZone` false (전 true — 시간대가 있는 시각에 `GMT+9` 같은 시간대가 보인다), Meter · ProgressBar `value` 0 (전 75 · 50). 값을 저장하지 않은 기존 문서는 새 기본값으로 그려진다 (마이그레이션 없음).
- **일반 Button 도 S2 form · focus 속성 10개를 받는다** (사용자 결정 §7-4) — `name` · `value` · `form` · `formAction` · `formMethod` · `formEncType` · `formTarget` · `formNoValidate` · `excludeFromTabOrder` · `preventFocusOnPress`. ActionButton 처럼 Property 탭에는 내지 않고 DOM 의 `button` 에만 실린다. LinkButton 은 받지 않는다 (S2 도 없음).
- **ActionBar = S2 구조** — DOM 순서가 S2 처럼 동작 버튼 묶음 먼저, 지우기 · 개수 묶음 뒤다 (Tab 이동도 동작 버튼 먼저). 화면 배치는 그대로 (지우기 · 개수 왼쪽, 동작 오른쪽 — 엔진에 CSS `order` 가 없어 root 를 `row-reverse` 로). 동작 묶음은 S2 의 감싸개 상자 안에 있고, 묶음 · 지우기 버튼 이름이 S2 문자열로 언어를 따른다 (「액션」 · 「선택 항목 지우기」 — 전에는 영어 고정).
- **SegmentedControl** — 기본 선택이 S2 처럼 첫 항목이다 (비활성이어도 — 전에는 첫 활성 항목). 글자를 지운 항목은 Text 가 없다 (아이콘만 32 × 32).
- **Link 의 quiet** — S2 처럼 단독 (`isStandalone`) 링크만 평소 밑줄이 없고, 문단 안 링크는 quiet 이어도 밑줄을 유지한다. hover 와 키보드 focus 에 밑줄이 다시 생긴다 (전에는 hover 만).
- **Image = S2 `div > img`** — 어디에 두든 상자 `div` 가 크기 · 바탕 · 잘림을 갖고 안 `img` 가 채운다 (전에는 Card 미리보기 밖에서 `img` 하나). Avatar 의 그림은 `alt` 를 적지 않으면 장식 (`alt=""`) 이다 (S2 — 전에는 「Avatar」).
- **정리** — 쓰이지 않던 Link 외부 아이콘 코드 · CSS (binding 에서는 2026-09-10 에 빠짐), Text rule 의 요소 이름 (`p` → 실제 DOM 인 `span`), 테스트만 부르던 `catalogSegmentSelected`.
  - 위치: `reusableOriginLibrary.ts` · `selectionCompositesOrigins.ts` · `rangeSegmentsOrigins.ts` · `rule/selectionComposites.ts` · `rule/conditionTree.ts` (`isStandalone`) · `componentRulesTable.ts` (Link · Text) · `bindings/{Button,ActionButton,LinkButton,Badge,InlineAlert,ButtonGroup,Tree,DatePicker,DateRangePicker,TimeField,Meter,ProgressBar}.binding.ts` · `domBinding.runtime.ts` · `domBinding.components.tsx` · `delegatedDom.runtime.ts` · `presence.ts` · `groupSelection.ts` · `selectionComposites.components.tsx` · `commands/collections.ts` · `ruleShapes.ts`

## [S2 정렬 — DropZone (IllustratedMessage) · Tab 아이콘 자리 · Toast 겹] - 2026-11-18

### Changed

- **DropZone 내용 = S2 IllustratedMessage** — 원본이 `DropZone > IllustratedMessage (Illustration + Heading + Content > Text)` 를 갖는다 (S2 예제 구조). DropZone 의 `label` · `description` 은 그 제목 · 글자이고 (설명이 비면 Text 없음), DropZone 크기 S · M · L 이 IllustratedMessage 로 간다 (그림 96 · 96 · 160 — 전에는 DropZone 이 그리던 32px 아이콘). 그림은 기존 `upload` 글리프이고 끄는 동안 accent 가 된다 (S2 `--iconPrimary`). 전에는 아이콘 · 라벨 · 설명이 노드가 아니라 DropZone 이 그린 글자였다.
- **DropZone 이 그리던 글자 경로 삭제** — 자식 없는 DropZone 이 `label` · `description` · 업로드 아이콘을 직접 그리던 경로 (`dropZoneContent.ts` · Canvas 합성 자식 · 생성 CSS 의 `.dropzone-icon` · `[slot]` 규칙 · DropZone rule 의 `iconSize`) 를 지웠다 (사용자 승인 11-18). 글자는 IllustratedMessage 노드만 그리고, 그것을 지운 DropZone 은 S2 처럼 빈 영역이다.
- **DropZone 크기 · 테두리 수정** — Publish 의 `data-size` 가 크기와 무관하게 늘 M 이던 것 (DropZone 컴포넌트의 기본값이 `toRacProps` 의 값을 덮었다), 생성 CSS 테두리가 Canvas 의 dashed 와 달리 solid 이던 것 (생성기가 variant 의 `borderStyle` 을 읽지 않았다 — S2 대로 휴지 dashed · 끄는 동안 solid).
- **Tab 에 넣은 Icon 은 글자 앞** — S2 Tab 은 아이콘을 CSS `order` 로 글자 앞에 둔다. 엔진 · DOM 은 자식 순서를 따르므로 Tab 에 Icon 을 넣으면 Text 앞 자리에 들어간다 (`Indicator → Icon → Text`). 전에는 끝에 붙어 글자 뒤에 그려졌다.
- **Toast 모양 template = S2 겹** — `Toast > frame (S2 body — flex · 줄바꿈 · 간격 24 / 8) > frame (S2 ToastContent — 간격 8 · baseline) > Text` + action Button. 기본 Toast 와 Site 「토스트 모양」 경로는 그대로 동작하고 상자 치수도 같다 (294 × 56).
  - 위치: `reusableOriginLibrary.ts` (`component-dropzone__message` · `component-toast__body` · `__content`) · `sizePropagation.ts` · `components/DropZone.tsx` · `domBinding.runtime.ts` · `presence.ts` (`catalogIllustrationInDropZone`) · `componentRulesTable.ts` (DropZone) · `generate-css.ts` · `CSSGenerator.ts` (`borderStyle`) · `commands/structure.ts` (`catalogAppendIndex`)

## [S2 정렬 — ContextualHelp (트리거 ActionButton · Popover 여백 상자)] - 2026-11-18

### Changed

- **ContextualHelp 트리거 = S2 quiet ActionButton** — 도움말 버튼이 Button 원본 + quiet 정사각 part rule 대신 S2 처럼 ActionButton 원본의 quiet · icon-only instance 다 (`slot={null}` 그대로 — field 의 Button context 를 받지 않는다). 크기는 ActionButton rule 의 icon-only 정사각 (XS 20 · S 24 — field 크기 S · M → XS, L · XL → S 그대로), 칠 · hover · 누름은 ActionButton 시트 (S2 quiet: 투명 바탕, 누르면 축소). 이름 (「Help」 · 「Information」, field 안에서는 라벨 + 자신) 은 그대로다.
- **ContextualHelp Popover = S2 `ContextualHelpPopover` 구조** — `Popover (여백 0) > frame (폭 268 · 여백 24 · 세로) > Heading + Content + Footer`, 간격은 S2 대로 제목 아래 8 · Footer 위 16 이다. 전에는 Popover 자신이 여백 24 · gap 8 을 갖고 Footer 가 위 여백 8 을 더했다 (보이는 크기는 같다 — 268 × 142). 원본 template 만 바뀌고 이미 놓은 도움말은 옮기지 않는다.
  - 위치: `reusableOriginLibrary.ts` (`component-contextualhelp__trigger` · `__overlay` · `__body`) · `components/ContextualHelp.tsx` (`ContextualHelpButton`) · `domBinding.runtime.ts` · `presence.ts` (`catalogContextualHelpOfTrigger`) · `resolver.ts` (`applyContextualHelpGlyph`) · `sizePropagation.ts` — `rulePartRules.ts` 의 `contextualHelpPartRules` · `quietIconSquareRules` 삭제

## [S2 정렬 — Slider · RangeSlider (라벨 묶음 · 입력 묶음 · track 행 · 막대 · S2 색 · 비활성)] - 2026-11-18

### Changed

- **Slider · RangeSlider 의 행 = S2 `field()` 구조** — `Slider > SliderLabelContainer (FieldLabel + 값 글자) + SliderFieldInput (SliderTrack [+ 값 글자])`. 두 묶음은 새 부품 type (S2 `labelContainer` · `fieldInput()` 의 `div`) 이고, 값 글자는 S2 처럼 라벨 위치를 따라간다 — 위면 라벨 묶음 끝, 옆이면 track 뒤 (원본에 두 자리가 있고 라벨 위치에 맞는 하나만 보인다). 라벨 행과 track 행 사이 간격은 S2 대로 0 (M 높이 54 → 50), 옆 배치는 S2 grid 두 열 (`auto 1fr`, 간격 S 16 · M 16 · L 20 · XL 24 — XL 은 전 20), 값 글자는 S2 `minWidth` 처럼 줄지 않는다.
- **Slider 값 글자 폭 = S2 `Nch` 고정 폭 + `tabular-nums`** — 최소값 · 최대값 표기 중 긴 쪽의 글자 수 (RangeSlider 는 `[min, min+step]` · `[max−step, max]` 범위 표기, 예: 「99–100」 → 6ch) 만큼 폭을 잡고 숫자는 고정폭이라 값이 바뀌어도 글자가 흔들리지 않는다. 위 배치는 끝, 옆 배치는 시작에 둔다 — 값 글자 상자는 flex 라 `text-align` 이 글자를 옮기지 못해 `justify-content` 로 둔다 (S2 는 blockify 된 `<output>` 의 `text-align`). 전에는 글자 폭 그대로라 값마다 상자 폭이 달랐다. `minValue` · `maxValue` · `formatOptions` 를 바꾸면 폭이 따라간다; 작성한 폭이 있으면 그것을 쓴다.
- **Slider 옆 배치에서 값 글자가 사라지던 것 수정** — track 의 `width: 100%` 를 template 작성값에서 SliderTrack rule (S2 `track` `width: 'full'`) 로 옮겼다. 원본이 문서에 저장된 프로젝트에서는 template 값이 작성한 고정 폭으로 읽혀 `flex-shrink: 0` 이 붙었고, 입력 묶음 flex 행에서 track 이 줄지 않아 값 글자가 Slider 밖으로 밀려 잘렸다 (Canvas · Publish 모두).
  - 위치: `runtime/presence.ts` (`catalogSliderValueChars` · `_valueChars` · `_valueAlign`) · `compositionRoot.ts` (`sliderValueWidth`) · `domBinding.runtime.ts` (`sliderValueStyle`) · `ruleShapes.ts` (`sliderValueText`)
- **Slider track = S2 구조** — `SliderTrack` 은 S2 `track` 행 (S 24 · M 32 · L 40 · XL 48, 칠 없음 — 누르면 thumb 가 움직이는 자리) 이고, 그 가운데 막대 `SliderTrackBar` (S2 `upperTrack`, 새 부품 type) 가 있으며 `SliderFill` 은 막대 안에 있다 (`Slider > … > SliderTrack > SliderTrackBar > SliderFill + SliderThumb`). 전에는 track 자신이 4px 막대였고 위아래 margin 으로 행을 만들었다 (Preview 는 `::before` 누르는 상자). thick 막대 (16 · 모서리 4) 는 막대와 채움이 받는다. Slider · RangeSlider 원본 template 에 막대 노드를 넣었다 (template id 유지).
  - 위치: `componentRulesTable.ts` (SliderTrack · SliderTrackBar · SliderFill · SliderThumb) · `bindings/SliderTrackBar.binding.ts` · `components/RangeSlider.tsx` (`SliderTrackBar`) · `runtime/presence.ts` (`catalogSliderTrackOf`)
- **Slider 색 = S2** — 막대 `gray-300` (전: light `gray-100`), 채움 `gray-700` (전: `gray-800`) · 강조면 `accent-900`, 손잡이는 `gray-25` 바탕 + 2px `gray-800` 테두리 (hover · 끌기 `gray-900`). 전에는 채움과 같은 색의 원에 흰 고리였고 강조면 손잡이도 accent 였다 — S2 손잡이는 강조 모양이 없다. 값 글자도 S2 `neutral-subdued` (Slider · ColorSlider).
- **Slider 비활성 = S2 `disabled` 색** — 막대 · 채움 `disabled`, 손잡이 테두리 `border-disabled`, 라벨 · 값 글자 `disabled` 로 칠하고 흐리게 하지 않는다 (Canvas · Publish). 전에는 Slider 전체를 0.38 로 흐렸다.

## [S2 정렬 — Color 조작기 (ColorHandle · 면 바깥선 · ColorWheel 안쪽 고리 · ColorSwatchPicker 선택 테두리)] - 2026-11-18

### Changed

- **Color 손잡이 = S2 `ColorHandle`** — ColorArea · ColorSlider · ColorWheel 의 thumb 가 16 · 흰 테두리 2 · 바깥선 1 `black/42` · 안쪽 고리 1 `black/42` 로, 반투명 색은 체커보드 위에 칠한다 (Canvas · Publish). 전에는 4px `--bg-inset` 고리 + 그림자였다.
  - 위치: `packages/rendering/src/primitives/colorHandle.ts` (두 consumer 의 값) · `componentRulesTable.ts` (ColorThumb) · `skiaPrimitives.ts` `color_thumb` · `runtime/colorHandleDom.runtime.ts`
- **ColorArea · ColorSlider track · ColorWheel 고리 = S2 바깥선** 1 `gray-1000/10` (offset −1, 비활성이면 없음), ColorSlider track 은 체커보드 위 그라데이션, ColorWheel 은 안쪽 고리 `div` 를 하나 더 둔다.
- **Color 조작기 비활성 = S2 `disabled` 색** — ColorArea · ColorSlider track · ColorWheel 고리는 `{color.disabled}`, 손잡이는 같은 바탕 + `{color.border-disabled}` 테두리로 칠하고 흐리게 하지 않는다 (테마를 따른다). 전에는 고정 `gray` 에 손잡이 0.5 · ColorSlider track 0.38 흐림이었다.
- **ColorSlider track 모서리 = S2 `default` 8px** — 전에는 SliderTrack rule 의 pill (9999px) 이 ColorSlider 의 radius 를 덮었다 (Canvas · Publish 모두).
- **ColorSwatch 테두리 = S2 1px `gray-1000/42`** — 견본 색 위에 그린다. 전에는 rule 의 1px `--border` 테두리 위에 수동 CSS 의 inset 링 (`--fg` 10%) 이 겹쳤고, 선택 견본의 accent 테두리 선언은 어느 쪽에도 보이지 않는 죽은 값이었다 (삭제). 반투명 색은 S2 처럼 견본 체커보드 (`#e6e6e6`, `0% 50%`) 위에, 색이 없으면 (alpha 0) 빨간 사선을 그린다 — 전에는 투명 견본이 빈 상자였다.
- **ColorSwatchPicker 선택 표시 = S2 선택 `div`** (테두리 2 `gray-900` · 바깥선 2 `gray-25` offset −4) — 전에는 생성 CSS 의 `::after` 라 Canvas 에 선택 표시가 없었다. 이제 Canvas 도 picker 값과 같은 색의 swatch 에 같은 테두리를 그린다 (`color_swatch`).

### Added

- **Color 손잡이 Loupe** (Preview · Publish) — 끄는 동안 손잡이 위에 S2 Loupe (48 × 64, 체커보드 위 현재 색, elevated 그림자, 125ms 들고 남) 가 뜬다. Canvas 는 끌기가 없어 그리지 않는다. 이동 중에도 보인다 (진입 애니메이션은 열릴 때 한 번 — 매 이동마다 투명에서 다시 시작하던 것을 고침).

## [S2 정렬 — 메뉴 · 태그 묶음 (Menu 항목 grid · Section 머리 · Divider · 빈 상태 글자, DisclosureHeader, SideNav 링크 아이콘 · 패널 묶음, Tag 내용 묶음, disabledKeys, TagGroup 그룹 동작 버튼)] - 2026-11-18

### Changed

- **Menu 항목 = S2 `menuitem` grid** — 선택 표시 · 아이콘 · 라벨 (아래 줄에 설명) · 단축키 · 하위 메뉴 chevron 이 S2 의 열에 놓이고, 간격은 S2 처럼 부품 margin (선택 표시 `text-to-control` · 아이콘 `text-to-visual` · 단축키 · chevron 앞 8) 이다 (Canvas · Publish). 원본 순서도 S2 예제대로 설명 → 단축키.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (MenuItem) · `document/selectionItemTemplates.ts`
- **Menu Section 머리 = `Header > Heading + Text(description)`**, 「+ Section」 이 S2 처럼 Section 뒤 Divider 를 같이 넣는다 — 첫 자리 · 끝 자리 · 다음이 Divider 인 Divider 는 숨김 (S2 `isSeparatorHidden`). Divider 는 항목 글자 시작에 맞춰 안쪽으로 (위아래 5).
- **Menu 빈 상태 = 「No results」 글자 한 줄** (사용자 결정 「S2 대로 글자 한 줄」) — control 높이 · edge-to-text 여백. 다른 컬렉션은 IllustratedMessage 그대로.
- **Menu · ListBox Section 머리 글자색 = S2 `neutral`** (설명 글자는 그대로 `neutral-subdued`) — 전에는 제목도 흐린 회색이었다.
- **TagGroup 「Show all」 · 「Show less」 · 그룹 동작 버튼 = S2 quiet ActionButton** — 크기의 control 높이 (M 32) · 좌우 `edge-to-text` · medium 굵기 · `neutral-content` 글자 · hover 바탕. 전에는 Tag 모양을 흉내 낸 수동 CSS 라 Preview 28 · Canvas 32 로 높이가 달랐고 글자도 accent 색이었다.
- **Disclosure 제목 줄 = S2 `DisclosureHeader`** — `Disclosure > DisclosureHeader > Heading > Button` (새 type, 제목 옆에 ActionButton 을 둘 수 있는 줄).
- **SideNav 항목 아이콘을 링크 안으로** (S2 `treeRowLink`), **SideNavPanel = 내용 묶음 (nav) + 바닥 묶음 (접기 ActionButton, quiet)** — 접기 버튼이 Button 에서 S2 ActionButton 으로.
- **Tag 의 아이콘 · 아바타 · 글자를 내용 묶음 안으로** (S2 `TagWrapper`), 「모두 보기 / 접기」 버튼을 `role=group` 「Actions」 안으로 (S2 `ActionGroup`).

### Added

- **Menu `disabledKeys` · `disallowEmptySelection`, TagGroup `disabledKeys` · `selectionBehavior`, SideNav `disabledKeys`, MenuItem `isDisabled`** (S2) — 이름 붙인 항목은 Canvas 에서도 비활성으로 그린다 (`catalogItemKeyDisabled` — Menu 항목은 rule 의 0.38 흐림, Tag · SideNav 행은 비활성 글자색).
- **TagGroup `groupActionLabel` · When 「그룹 동작 버튼을 누를 때」 (`onGroupAction`)** (S2) — 이름을 적으면 Tag 뒤 (접혀 있으면 「Show all」 뒤) 에 동작 버튼이 생기고, 누르면 그 When 의 규칙이 실행된다 (Canvas · Publish). Tag 가 없으면 버튼도 없다 (S2 `!isEmpty`). S2 는 `onGroupAction` 이 있어야 버튼을 그리지만 Builder 는 이름만으로 그린다 — 규칙 유무를 Canvas 가 알 수 없어서다.
  - 위치: `runtime/compositionRoot.ts` (`settleTagRows` — 버튼 상자) · `runtime/delegatedDom.components.tsx` (`TagListRun`) · `interactions/concepts/groupAction.ts`
- Design 패널 라벨 번역 — Disabled keys · Selection behavior (Toggle · Replace) · Group action label.

### Fixed

- **padding 이 있는 grid 상자의 min-height 가 Canvas 에서 padding 만큼 커지던 것** — 내용이 min-height 보다 낮아 엔진이 min-height 로 다시 풀 때 border-box 높이를 돌려줘 부모가 padding 을 한 번 더 더했다 (`min-height: 32px` + padding 7/7 → 46, Chrome 32).
  - **Why:** grid 재해석이 받은 높이를 그대로 돌려줘 auto 높이 상자의 content-box 계약 (§26) 을 어겼다. 글자 높이가 늦게 오는 Canvas 증분에서 처음 해석이 늘 이 경로를 탄다.
  - 위치: `packages/engine/src/tree.rs` (`solve_grid_tracks` min/max 재해석)
- **비활성 Tag 의 글자가 Canvas 에서 보통 색이던 것** — Preview 는 수동 `TagGroup.css` 의 `[data-disabled]` 회색, Canvas 는 Tag 칠 트리에 비활성 가지가 없어 보통 색이었다. Tag rule 칠 트리에 S2 `color.isDisabled` (`{color.disabled-content}`) 를 둔다.
- **Menu 의 `disabledKeys` 가 Publish 에서 무시되던 것** — 항목에 `isDisabled: false` 를 늘 넘겨 RAC 가 그 값을 따랐다. 비활성 항목만 `isDisabled` 를 넘긴다.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts`

## [S2 정렬 — 선택 부품 묶음 (GridList · Table · CardView 선택 Checkbox · Card 선택 덮개 · 항목 chevron)] - 2026-11-18

### Changed

- **GridList · Table · CardView 의 선택 Checkbox = S2** — S2 처럼 `selectionMode` 가 none 이 아니고 `selectionStyle` 이 checkbox 이면 항목마다 선택 Checkbox 가 보인다 (Canvas · Publish). 원본이 Checkbox 노드를 늘 가져 (Layers 에서 보이고 고칠 수 있음) 모드 · 스타일에 따라 보이고 숨는다 — 이미 놓인 컴포넌트도 원본을 따라 바뀐다.
  - Table 은 맨 앞에 선택 열 (폭 40) 이 생기고, 머리 줄 전체 선택 Checkbox 는 multiple 만. 행 추가 · 데이터 연결 (Quick Connect 교체) · 정렬 연결은 선택 열을 데이터 열로 세지 않는다.
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` · `runtime/presence.ts` (`catalogSelectionCheckboxHidden`) · `runtime/tableTracks.ts` · `commands/collections.ts`
- **CardView 의 Card 선택 모양 = S2** — 선택해도 바탕 · 테두리 칠은 그대로 두고 2px 진한 회색 덮개 (SelectionIndicator) 와 그림자로 표시한다. 선택 Checkbox 는 Card 모서리의 받침 위에 놓인다 (S2 `CardCheckbox`). 단독 Card 에는 둘 다 없다.

### Added

- **CardView `selectionStyle`** (checkbox · highlight) — 2026-10-14 에 뺀 S2 prop 을 다시 넣는다 (highlight = Checkbox 없이 덮개만).
- **GridList 항목 `hasChildItems`** (S2 ListView) — 켜면 항목 끝에 chevron 을 그린다 (새 탭 링크면 링크 아이콘이 우선).

## [S2 정렬 — 날짜 묶음 (Calendar 머리 줄 · picker 팝업 Dialog · 시각 입력)] - 2026-11-18

### Changed

- **Calendar · RangeCalendar = S2 구조** — 달마다 [머리 + 표] 를 반복하던 묶음 대신 S2 처럼 머리 줄 하나 (달별 ‹ 제목 › 묶음) 와 표 줄 하나 (달마다 표) 로 그린다. 머리 줄 ↔ 표 · 달 사이 간격은 S2 의 24. Layers 의 달력 트리가 `CalendarHeader > CalendarMonth` + `frame > CalendarGrid` 로 바뀐다 (이미 놓인 달력도 원본을 따라 바뀐다).
  - Publish 의 칸 크기는 컨테이너 쿼리 대신 고정 표 배치 + 정사각 칸으로 정한다 (Chrome 에서 `table` 은 크기 기준 상자가 아니다).
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` · `resolution/resolver.ts` (`repeatsPerMonth`) · `document/manualBoxRules.ts` · `components/styles/CalendarCommon.css`
- **DatePicker · DateRangePicker 팝업 = S2 `CalendarPopover`** — `Popover > Dialog > 달력`, Popover 는 도움말 앞. 여백은 Dialog 가 갖는다 (위아래 24 · 좌우 16). 팝업의 이름은 picker 라벨에서 온다.

### Added

- **시각 단위 picker 의 시간 입력 (S2)** — DatePicker · DateRangePicker 의 단위가 시 · 분 · 초면 팝업의 달력 아래에 TimeField (`Time`, range 는 `Start time` · `End time`) 가 나타나 picker 의 시각을 보이고 바꾼다 (Canvas · Publish). 단위가 day 면 없다.

## [Grid Columns — auto-fit 셀렉트 유지] - 2026-11-17

### Fixed

- **`auto-fit` 선택 후에도 Columns 셀렉트 유지** — CSS 입력폼으로 전환하지 않고 `auto-fit`을 선택값으로 표시한다. 같은 메뉴에서 숫자 열 개수로 돌아갈 수 있으며, 이미 저장된 최소 너비는 포커스 이동·재선택으로 바뀌지 않는다.
  - **Why:** 자동 반복을 트랙 목록으로 해석할 수 없다는 이유로 일반 복합 CSS 텍스트 입력 분기에 들어갔다.
  - 위치: `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx`

## [Grid Columns — auto-fit 입력 진입] - 2026-11-17

### Fixed

- **Columns 메뉴에 `auto-fit` 추가** — 선택하면 `repeat(auto-fit, minmax(200px, 1fr))`를 적용하고 기존 CSS 텍스트 입력으로 전환한다. 최소 너비를 직접 편집할 수 있고 숫자를 입력하면 고정 열 개수로 돌아온다. 기존 숫자 프리셋과 Rows Auto는 유지한다.
  - **Why:** 복합 템플릿의 표시·편집 경로는 있었지만 숫자 입력에서 진입할 방법이 없었다.
  - 위치: `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx`

## [S2 정렬 — 라벨 행 (FieldLabel) · Meter · ProgressBar 값 글자] - 2026-11-18

### Changed

- **라벨 행 = S2 `FieldLabel`** — 라벨을 가진 원본 21종 (TextField · Select · ComboBox · DatePicker · CheckboxGroup · Slider · Meter · ProgressBar · LabeledValue 등) 이 라벨을 늘 행 노드 `FieldLabel > Label` 로 갖는다 (Layers 에 FieldLabel 행이 보인다). 라벨 글자를 비우면 행도 사라지고, 도움말 (contextual help) 은 이 행에 넣고 뺀다 — 끌 때 행은 남는다. 이미 놓인 문서는 그대로 열린다.
- **LabeledValue 라벨** — Text 대신 S2 처럼 `FieldLabel > Label` (Publish 의 요소는 `span`).
- **Meter · ProgressBar 값 글자 = S2 조건** — 라벨이 있을 때만 보이고, ProgressBar 는 indeterminate 동안 숨는다. `Show Value Label` 칸은 삭제 (S2 에 없는 v3 prop — Slider 는 그대로).
- **라벨 · 값 글자 색 = S2** — Meter · ProgressBar · LabeledValue 의 라벨과 Meter · ProgressBar 의 값 글자가 field 라벨처럼 회색 (`neutral-subdued`) 이다 (그전 진한 #292929).
- **필수 표시** — Publish 에서 라벨 뒤 빈칸과 별표 · 「(필수)」 가 S2 처럼 한 묶음 (`span`, 줄바꿈 없음) 이다.

### Added

- **invalid field 의 경고 아이콘 (S2 `FieldErrorIcon`)** — TextField · TextArea · NumberField · ComboBox · ColorField · DateField · TimeField · DatePicker · DateRangePicker 가 invalid 이면 입력칸 끝 (버튼 앞) 에 빨간 경고 아이콘을 그린다 (Canvas · Publish). disabled 이면 그리지 않는다.

### Fixed

- **static Meter · ProgressBar 라벨 색** — 라벨이 행 안으로 들어가며 static white · black 색을 잃지 않게, Canvas 가 행을 건너 owner 를 찾는다.

## [S2 정렬 — Dialog 구조 · isDismissible] - 2026-11-18

### Added

- **Dialog `isDismissible`** — Property 탭 Behavior 의 Dismissible 을 켜면 S2 처럼 머리 오른쪽에 ✕ 닫기 버튼이 생기고 (Canvas · Publish), 바깥을 눌러도 닫히며, 버튼 줄 (ButtonGroup) 은 사라진다.

### Changed

- **Dialog 원본 = S2 구조** — `Dialog > Heading + Content > Text + ButtonGroup`. 본문 교체 자리 (slot) 가 S2 `Content` 노드가 되고, 본문 글자는 Text (16px · #292929), 버튼 줄은 composition 자체 상자 DialogFooter 대신 S2 `ButtonGroup`.
- **ButtonGroup 간격 = S2** — XS · S 8, M · L · XL 12 (전에는 크기와 상관없이 8). Canvas 와 Publish 가 같은 표를 읽고, 직접 적은 간격은 그대로 이긴다.

### Removed

- **DialogFooter** — Dialog 의 버튼 줄이 S2 `ButtonGroup` 이 되어 쓰지 않는 composition 자체 type 을 지웠다. 예전에 Dialog 를 detach 해 DialogFooter 노드를 가진 문서는 열 때 검증 오류가 난다 (개발 단계 — 마이그레이션 없음).

### Fixed

- **ButtonGroup 안의 `slot="close"` 버튼** — ButtonGroup 이 Dialog 의 닫기 연결을 지워 Close 버튼이 Dialog 를 닫지 못하던 문제.
- **Canvas 에서 열린 overlay 의 글자** — overlay 가 열릴 때 크기가 바뀌지 않은 안쪽 요소가 닫혀 있을 때의 숨김 상태로 남을 수 있던 부분 갱신.

## [S2 정렬 — ProgressCircle · StatusLight 의 Preview · Publish DOM] - 2026-11-18

### Changed

- **ProgressCircle 루트 = RAC `ProgressBar`** — Preview · Publish 의 원형 진행률이 직접 만든 `div[role=progressbar]` 대신 S2 처럼 RAC `ProgressBar` 로 그려진다. 화면 리더가 읽는 값 글자 (`aria-valuetext`, 예: 75%) 가 생겼고 모양 · 크기는 그대로다. Button 의 pending 원 · 목록 로딩 원도 같은 컴포넌트다.
- **ProgressCircle 접근 이름** — 놓은 원은 기본 이름 「Loading…」 (S2 가 직접 쓰는 로딩 원의 이름) 을 갖고, Property 탭 Accessibility 의 ARIA label 칸에서 바꾼다 (칸이 비면 기본 이름을 placeholder 로 보여 준다). 전에는 이름이 없어 화면 리더가 무엇의 진행률인지 알 수 없었다.
- **StatusLight 점 = svg circle** — 상태 점이 `span` 배경이 아니라 S2 처럼 `svg > circle` 의 fill 로 그려진다. 크기 · 색 · 위치는 그대로다.
- 문서 · Canvas 는 바뀌지 않는다.

## [S2 정렬 — Tooltip · InlineAlert · IllustratedMessage 의 글자 감싸기 층] - 2026-11-18

### Changed

- **InlineAlert · IllustratedMessage 본문 = S2 `Content` 안의 Text** — 본문 글자가 RAC 설명 slot (`Description[slot=description]`) 이 아니라 S2 처럼 `Content` 안에 놓인다 (`div.react-aria-Content > span.react-aria-Text`). 글자 크기는 그대로 (InlineAlert S · M · L = 12 · 14 · 16, IllustratedMessage 12 · 14 · 14), 색은 S2 본문 색 #292929 (그전 흐린 #525252).
- **Tooltip 글자 = Text** — Tooltip 안 글자가 설명 slot 없는 Text 가 되어 Tooltip 의 글자 크기 · 색 (12px · #292929) 을 그대로 쓴다. 본문을 Local 컴포넌트로 바꿔 끼우는 `content` slot 자리 (ADR-278) 는 그대로다.
- 기존 문서는 그대로 열린다 (원본 template id 유지 — 문서 형식 버전 변경 없음).

## [ADR-313 Phase 5 — 표의 스키마를 JSON Schema 로 내보내기] - 2026-11-17

### Added

- **Data 패널 격자 → Export → 「Copy JSON Schema」 · 「Download JSON Schema」** — 표의 열을 JSON Schema (2020-12) 로 낸다. 백엔드 (Java · Spring) 가 받을 행 모양 그대로 — 필수 열 · null 허용 · key 필드 (늘 필수) · 라벨 · 기본값. 날짜는 `format` 없는 글자로 낸다 (offset 없는 일시가 `date-time` 검사에서 떨어지지 않게). 값 표현 (`Y`/`N` · 붙여 쓴 날짜 …) 과 key 필드 같은 Composition 정보는 `x-composition-*` 주석이라 다른 도구가 무시해도 스키마가 성립한다.

## [ADR-313 Phase 4 — 스키마 파일로 표 만들기] - 2026-11-17

### Added

- **새 표 → 「Schema」** — 백엔드가 준 `api-docs` (OpenAPI 3.0 · 3.1, springdoc 의 JSON) 나 JSON Schema 파일을 놓거나 붙여넣으면, 인터넷 연결 없이 열 이름 · 타입 · 필수 여부 · 라벨 (`@Schema(description)`) 을 만든다. 응답 스키마를 고르면 행 위치 (`content` 같은 페이지 포장) 와 전체 수 (`totalElements`) 를 알아보고, API 정의 (경로 · 메서드 · 쿼리 파라미터) 도 같이 만든다 — 만들기만 하고 요청은 보내지 않는다. 상속 (`allOf`) · 문서 안 `$ref` · null 허용은 읽고, 읽지 않는 구성 (`oneOf` · 외부 `$ref` …) 과 저장하지 않는 규칙 (`maxLength` · `pattern` · `minimum` …) 은 「Not imported」 에 모두 적는다. YAML 은 읽지 않는다 (JSON 으로 내보내기).

## [ADR-313 Phase 3 — 값 표현 · key 필드 고르기] - 2026-11-17

### Added

- **새 표 미리보기 (붙여넣기 · CSV/JSON · API 저장) 의 열 표** — 열마다 「타입 · 값 표현」 을 고른다. 표본에서 알아본 후보가 「Suggested from the sample」 로 붙는다: `"Y"` / `"N"` · `1` / `0` → 참 · 거짓, `"4500000.00"` → 숫자, `20261106` → 날짜, epoch 밀리초 · 초 (이름이 날짜를 암시하는 열), `[2026, 11, 6]` → 날짜. 후보는 제안일 뿐 고르기 전에는 적용되지 않고, 2^53 을 넘는 정수 열만 「큰 정수 (글자로 보존)」 가 기본이다. 지금 선택으로 읽으면 어긋나는 셀 수 (타입과 다른 셀 · 읽지 못한 셀 · 정밀도를 잃는 셀) 를 열마다 보인다.
- **key 필드 칸** — 표의 PK 열을 고른다 (`id` · `*_ID` 이름에 값이 모두 다르면 「Suggested key」). 그 표를 쓰는 목록 · 표의 항목 key 가 된다.
- 열 편집 팝오버에 「Value notation」 · 「Key field」. 값 표현을 바꾸면 이미 있는 행은 열 타입을 바꿀 때와 같이 — 읽히는 값은 바꾸고 (`"4500000.00"` → `4500000`), 못 읽는 값은 비울지 둘지 묻는다. Undo 한 번.
- 기존 표로 가져오기 미리보기가 열마다 어긋나는 셀 수를 보인다.

## [ADR-313 Phase 2 — 외부 데이터가 어느 길로 들어와도 같은 값] - 2026-11-17

### Changed

- **붙여넣기 · CSV 의 셀은 열 단위로 타입이 정해진다** — 지금까지는 셀마다 모양으로 숫자 · 참/거짓을 정해 우편번호 `01234` 가 `1234` 가 되고, 한 열에 `42` 와 `abc` 가 섞이면 숫자 열에 글자가 들었다. 이제 열의 모든 값 (처음 200 행) 이 숫자로 정확히 읽힐 때만 숫자 열이고, 0 으로 시작하는 값은 글자로 남는다. 열은 첫 행이 아니라 모든 행의 키에서 만든다.
- **기존 표로 JSON 을 가져올 때 값을 열 타입으로 바꾸지 않는다** — `"Y"` · `"42"` 는 그대로 들어오고 (가져오기는 「타입과 다른 셀」 로 센다), 값 표현을 고른 열만 읽힌다 (값 표현을 고르는 화면은 Phase 3). CSV · 탭 표를 가져올 때는 지금처럼 열 타입으로 읽는다.
- 격자 입력 · 붙여넣기 · 행 양식에서 수로 정확히 옮길 수 없는 숫자 (`9007199254740993` 같은 큰 정수) 는 숫자 열에 근삿값으로 들어가지 않고 읽기 실패 (빈 칸) 다.
- 표에 key 필드가 있으면 그 표를 쓰는 목록 · 표의 항목 key 가 그 필드 값이다 (바인딩의 value 칸이 먼저).

### Fixed

- **2^53 을 넘는 정수 (Java `Long` PK) 가 바뀌던 것** — JSON 붙여넣기 · 파일 · 기존 표로 가져오기 · API 실행 (Builder · Preview · Publish) 과 탭 · 쉼표 붙여넣기에서 `9007199254740993` 이 `9007199254740992` 가 됐다. 이제 글자로 보존되고, 서버로 보낼 때는 따옴표 없는 숫자로 나간다.
- 같은 JSON 의 `"Y"` 가 기존 표로 가져올 때만 `true` 가 되던 것 — 네 진입이 같은 값을 만든다.
- 값 표현이 있는 필드는 보기 조건 (쿼리 · body) 과 Form 제출로 서버에 나갈 때 원본 표기로 되돌아간다 (`true` → `"Y"`, 날짜 → `20261106`).

## [ADR-313 Phase 1 — 외부 데이터의 값 표현 · key 필드 저장 계약] - 2026-11-17

### Changed

- **Breaking — contract 70** (ADR-313 Phase 1): Data 패널 표의 필드가 값 표현 `encoding` 을, 표가 key 필드 `keyField` (필드 id) 를 저장할 수 있다. 69 이하 문서는 열리지 않는다 (변환 없음). 값 표현은 원본 (Oracle · Java API) 이 값을 JSON 에 싣는 방식이다 — 참 · 거짓의 표기 (`"Y"`/`"N"` · `1`/`0`) · 숫자 글자 · epoch 밀리초 · 초 · 붙여 쓴 날짜 (`YYYYMMDD` · `YYYYMMDDHHmmss`) · 날짜 배열 · 큰 정수 글자. 저장 값은 늘 타입의 정규 값 (boolean · 숫자 · ISO 날짜 글자 · 큰 정수는 글자) 이다. 아직 화면에서 고르는 곳은 없다 (Phase 3).
- 필드 타입을 바꾸면 그 타입이 받지 않는 값 표현은 같은 편집에서 지워진다 (Undo 가 되살린다). key 필드를 지우면 표의 key 필드 설정도 지워진다.

### Added

- shared `collections/intake` — 값 표현 읽기 · 되돌리기 (서버가 같은 값으로 읽는 JSON 표현), 행 진입 변환기 `normalizeRows` (JSON 원본은 선언 없는 값을 바꾸지 않는다 · 글자 원본은 열 타입으로 읽는다 · 값을 잃는 숫자 읽기는 실패), 큰 정수 (2^53 초과 정수 literal) 를 보존하는 JSON 읽기 · 쓰기. 진입 경로 연결은 Phase 2.

### Removed

- 읽는 코드가 없던 `responseMapping.fieldMappings` 형 선언.

## [Chart 데이터 포맷 정리 — 역할 판정 한 곳] - 2026-11-17

### Changed

- **새 Chart 의 원본 template 이 역할 값 (`dimension` · `metric` · `color`) 을 들지 않는다** — 값이 없는 역할은 기본 열 이름으로 읽힌다. 연결한 표에 없는 열을 가리키는 선택 역할은 그리는 쪽이 한 곳 (`resolveChartRoleDefaults`) 에서 「역할 없음」 으로 읽는다 (예전 template 으로 만든 문서도 같다). 연결 때 물려받은 역할을 빈 글자로 지우던 처리는 없앴다.
- Chart 패널의 열 안내가 날짜 열을 「날짜형」 으로 보인다 (전에는 「타입 불명」) — 연결 때 역할 맞춤과 같은 형 판정 하나.
- parallel 축 이름이 다른 종류와 같은 이름 규칙 (Series 섹션에서 비운 이름 = 빈 이름).

### Fixed

- family 종류에 columns 가 저장된 채 남으면 원천 모드 칸에 「pie · radial 은 값 열을 쓸 수 없다」 안내가 잘못 붙던 것 — 종류 변경과 같은 판정 (`chartKeepsStrandedColumns`).

## [ADR-312 Implemented — Chart 데이터 포맷 표준] - 2026-11-17

### Changed

- **ADR-312 를 Implemented 로 닫았다** (G5 사용자 확인): Chart 36 종이 같은 방식으로 데이터를 받는다 — 역할 표 하나 · 종류마다 입력 형태 · 같은 키의 행 처리 (행 정책) · 시리즈 이름 · 색 · 순서 표 · 날짜 해석 한 곳 · 생성 때 기본 열 이름 · 컬렉션 연결 때 역할 자동 맞춤. 본문은 `docs/adr/completed/312-chart-data-format-standard.md`.
- 확인: 36 종 전부를 Data 패널에서 만든 표 (기본 열 이름과 다른 열 이름) 에 연결해 모두 그려진다.

## [ADR-312 Phase 5 — Chart 날짜 해석 공통 · AI 설명] - 2026-11-17

### Changed

- **calendar · candlestick 이 시간 축과 같은 날짜 해석을 쓴다** — Collection 의 「Date Input Format」 (예: `%d/%m/%Y`) 을 읽고, 비우면 ISO 날짜만 날짜로 본다 (전에는 브라우저의 느슨한 해석이라 「05/01/2026」 이 5 월 1 일로 읽혔다). 위치: `packages/rendering/src/chart/series.ts` `chartTimeParser`.
- AI 가 Chart 를 만들 때 종류마다 입력 형태 · 필수 역할 · 기본 열 이름 · 행 정책을 안다 (역할 표에서 파생).

### Fixed

- **표를 연결한 Scatter · Bubble 이 「No data」 였던 것** — Why: X 가 어떤 형이든 받아 연결 때 첫 글자 열을 골랐다. 이제 X 는 숫자 열 (시간 축이면 날짜 열), 다시 연결하면 형이 맞지 않는 지정도 고쳐진다.
- **표를 연결한 Sparkline 이 모든 행을 하나로 합치던 것** — Why: 원본의 기본 범주 열 (`category`) 이 표에 없는데 연결 때 지워지지 않았다. 연결하면 표에 없는 기본 열 지정은 해제된다.
- **값 열 형태 (Skyline · 값 열 모드) 의 범례에 필드 id (`#0171…`) 가 보이던 것** — Why: 연결한 값 열은 id 로 저장되는데 시리즈 이름에 그대로 썼다. 이제 필드 이름.
- **Bump · Histogram 의 원천 모드 칸에 「pie · radial 에는 값 열을 쓸 수 없다」 안내가 뜨던 것** — Why: 안내 조건을 「값 열 형태가 없는 종류」 로 바꾸면서 pie · radial 밖의 종류까지 포함했다 (ADR-312 Phase 1). 이제 값 열이 저장된 채 남은 때만.

### Performance

- 첫 화면 번들 Builder +4,462 B · Preview +3,303 B gzip (ADR-312 전체 — 역할 · 형태 표, 시리즈 표시 표, 연결 때 역할 맞춤). Builder 증가는 ADR-201 Δ 상한 (+4,096) 을 넘어 사용자 승인으로 수용했다.

## [ADR-312 Phase 4 — Chart 시리즈 표시 표 공통] - 2026-11-17

### Changed

- **시리즈 이름 · 색 · 순서 (Series 섹션) 를 더 많은 차트가 읽는다** — marimekko (계열) · segmented · waffle (조각) · dumbbell (앞 · 뒤) · histogram (묶음) · slope (항목). 패널 Series 섹션이 이 종류에서도 열리고, 그림과 같은 항목 목록을 보인다. 시리즈 경로와 같은 규칙 — 표에 적은 항목이 앞 (표 순서 · 이름 · 색), 나머지는 출현 순서.
- segmented · waffle 의 기본 색은 정렬 뒤 자리가 아니라 **출현 순서** — 값이 바뀌어 순서가 바뀌어도 조각의 색이 그대로다.
- dumbbell · histogram · slope 는 강조 · 기본 칠 (accent · neutral) 을 유지하고, Series 섹션에서 색을 정한 항목만 그 팔레트 색으로 그린다.

### Fixed

- **parallel 의 축 이름이 Series 섹션 이름을 읽지 않던 것** — 축 이름을 원래 필드 key 로 비교해 패널이 저장한 항목 (`["field", key]`) 과 맞지 않았다. Why: 시리즈 표의 identity 형식이 종류마다 갈렸다 (ADR-312 F9). 이제 축 이름 칸만 보인다 (축 순서는 값 열 목록, 선 색은 행마다).

## [ADR-312 Phase 3 — Chart 행 정책 (같은 contract 69 안의 해석 변경)] - 2026-11-17

### Changed

- **같은 키의 행을 종류마다 선언대로 읽는다** — 형태마다 행 정책 (`sum` · `row` · `sample`) 과 키 역할을 적었다 (`ChartForm.rows` · `key`). 범주 × 값 종류 (lollipop · segmented · waffle · funnel · pareto) · bullet · dumbbell 은 같은 범주의 행을 bar 처럼 **합친다** (전에는 행마다 막대). gauge 는 여러 행이면 합 (전에는 첫 행), slope 는 같은 시점 · 항목을 합 (전에는 마지막 행), sparkline 은 범주 열이 있으면 같은 항목을 합한다. 비숫자 값은 0 이 아니라 결측이다.
- **합칠 수 없는 값이 갈리면 경고** `rows.duplicate` — bump 의 순위 (전에는 더했다 — 지금은 첫 행) · bullet 의 구간 경계. 첫 행 값을 쓴다.
- scatter · waterfall · candlestick · parallel (행마다 표식) · box · beeswarm · ridgeline · histogram 값 (행 = 표본) 과 이미 합치던 종류 (시리즈 7 종 · stream · skyline · marimekko · heatmap · calendar · treemap · sunburst · sankey · chord · histogram 구간) 는 그대로다. 표본 차트의 그림은 같다 (표본에는 같은 키의 행이 없다).

## [ADR-312 Phase 2 — Chart 저장 계약 (contract 69)] - 2026-11-17

### Changed (Breaking)

- **contract 68 → 69** — 68 이하 프로젝트는 열리지 않는다 (변환 없음 — 다시 만든다). candlestick 의 종가는 `metric` (옛 `closeField` 는 받지 않는다). `dataMode` 에 `binned` (histogram 구간 개수) · `ranked` (bump 순위 — 기본) · `pair` (slope 앞 · 뒤 값) — 형태는 역할의 유무가 아니라 `dataMode` 로 고른다. parallel 은 값 열 형태 하나.
- **값이 없는 역할은 기본 열 이름으로 읽는다** (`category` · `value` · `series` · `goal` · `start` · `end` …) — 필수 역할은 늘, 선택 역할은 그 열이 데이터에 있을 때만. 새 차트의 표본 열이 이 이름이라 생성 때 역할 값을 쓰지 않는다 (Overrides 에 남지 않는다 — 값 열 목록 같은 목록 역할만).
- **표본 행 편집기 칸이 차트 종류를 따른다** — 그 형태의 역할이 가리키는 열 + 행에만 있는 열 (전에는 7 종에만 맞는 Category · Value · Series 고정).
- **컬렉션을 연결하면 역할이 원천을 따라간다** — 가리키는 열이 없는 필수 역할은 형이 맞는 첫 열로 (날짜 역할은 날짜 열), 묶고 합친 보기를 연결하면 집계 이름 (`total`) 으로, 해제하면 표본으로 다시 그려진다 (같은 명령 · Undo 한 번). 역할 칸 선택지도 보기의 결과 열이다.

### Fixed

- 기본 열 이름 읽기에서 Canvas · Preview 가 Series 해제 (`color: ""`) 를 「없음」 으로 버리던 것 — 해제가 기본 `series` 로 읽혀 두 그림이 갈렸다.

### Tests

- `adr312ChartContract.test.ts` · `adr312ChartBindingColumns.test.ts` · `adr312Roles.test.ts` (기본 열 이름 · 표본 표준화 · 역할 맞춤 G6) · `adr312Inventory.test.ts` (표준 표) · `adr312DataModeControl.test.tsx` · `chartFieldOptions.fieldId.test.ts` · family 테스트 (bump group · slope pair · histogram binned) 갱신 · contract fixture 32. 원복 RED 4.

## [ADR-312 Phase 0 · 1 — Chart 역할 표 하나] - 2026-11-16

### Changed

- **Chart 36 종의 데이터 역할을 표 하나로** (`packages/rendering/src/chart/roles.ts` — 역할 정의 `CHART_ROLE_DEFS` · 종류별 형태 `CHART_FORMS`). 기존 9 항목 (bar · line · area · pie · donut · radar · radial · scatter · bubble) 도 이 표에 들어가 별도 목록이 없어졌다. 패널 칸 · 선택 / 필수 · 라벨, binding 의 역할 칸 · 전달 목록, columns 판정이 이 표에서 나온다. 저장 key · 값은 그대로다 (contract 무변경).
- **역할 칸 라벨이 종류를 따른다**: scatter · bubble 의 X · Y, calendar · candlestick 의 Date, slope 의 Period · Item (형태별), box · ridgeline · beeswarm 의 Groups (`chart.rolePeriod` · `roleItem` · `roleGroup`).
- **parallel 의 원천 모드 칸 (Series source) 을 없앴다** — 값 열 목록만 읽는 종류라 칸을 바꿔도 그림이 같았다. columns 로 저장된 pie · radial 만 되돌리는 칸이 남는다 (ADR-210).
- **연결된 Chart 가 쓰는 필드가 Data 패널의 「사용 중」 에 나온다** — 필드 삭제 · 이름 변경 확인에 Chart 가 보인다 (`fieldUsage.ts` 네 번째 축, 역할 prop 의 `#id` · key · 목록 원소).

### Fixed

- **시리즈 종류에서 역할이 가리키는 열이 데이터에 없을 때 「No data」 로 보이던 것** → 「Check chart settings」 + 어느 역할인지 진단 (`role.missing`, value = 역할 key). 36 종 공통 검증 (`validateChartRoles`) 을 모델 (`resolveChartModel`) 이 읽어 Canvas · Preview 가 같이 받는다. 숫자 역할에 숫자가 하나도 없으면 경고 `role.notNumeric` (그림은 그대로).

### Tests

- `adr312Inventory.test.ts` (Phase 0 — 36 항목의 현재 표: 표본 열 · 저장 역할 · 읽지 않는 역할 (동작 판정) · 범례 · `seriesConfig` · 행 복제) · `adr312Roles.test.ts` · `adr312DataModeControl.test.tsx` · `chartFieldOptions.fieldId.test.ts` · `fieldUsage.test.ts` · `adr306FamilyProps.test.ts` 갱신. 원복 RED 4 (공통 검증 · 사용처 축 · 종류별 라벨 · binding 역할 칸). `computeChartScene` snapshot · `chartParity` 무변경 (HC2).
- `adr312Perf.test.ts` — 1 만 행 scene 시간 기준선 (`ADR312_PERF=<json>` 일 때만).

## [ADR-306 Implemented — Chart 36 종] - 2026-11-16

### Changed

- **ADR-306 을 Implemented 로 닫았다** (G5 사용자 확인): Chart 36 종 (기존 9 항목 보강 + 새 종류 27 — kpi · category · distribution · matrix · network) · 공개 size 삭제 · 공통 상호작용 (강조 · 주석 · 손익 색 · 범위 선택 · 확대 · 동기화). 본문은 `docs/adr/completed/306-chart-36-types-recharts-size-removal.md`.
- **남긴 것**: 36 종이 데이터를 받는 방식이 제각각이다 — 표본 행 편집기 칸이 7 종에만 맞고, 같은 역할 칸의 뜻이 종류마다 다르고, 여러 값 열을 고르는 방식이 세 가지다. 개별 수정 대신 데이터 포맷 표준을 새 ADR 로 정한 뒤 고친다.

## [Chart 를 지우면 앱이 멈추던 것] - 2026-11-16

### Fixed

- **Chart 를 선택해 Backspace (또는 Layers 삭제) 로 지우면 빌더가 하얀 화면으로 멈추던 것**: Layers 의 Chart 줄 아이콘은 그 줄의 `chartType` 을 구독하는데, 지운 노드의 읽기가 실패하자 read model 이 캐시를 지웠고, 트리가 줄을 빼기 전에 한 번 더 그려진 그 줄이 새로 계산하다 `CatalogValidationError` 를 던졌다 (React 오류 경계 밖).
  - 수정: 대상이 사라진 구독 읽기는 마지막 값을 들고 있다가 마지막 구독자가 떠나면 지우고, 대상이 돌아오면 (Undo) 다시 따른다 (`apps/builder/src/builder/catalogRuntime/readModel.ts`).

### Tests

- `phase4cReadModel.test.ts` — 구독 중 노드 삭제 → 다시 읽기 · Undo 뒤 값 변경 추적 (수정 전 RED — 사용자 보고와 같은 오류).

## [Chart Property 패널 — 그 종류에 쓰이지 않는 칸 정리 · family 범례 위치] - 2026-11-16

### Fixed

- **종류에 맞지 않는 Content 칸이 보이던 것**:
  - 범례 (Show Legend) 가 범례를 그리지 않는 family 21 종, 값 이름표 (Value labels) 가 이름표를 그리지 않는 family 12 종에도 보였다.
  - **Why**: 두 칸과 범례 위치를 「전 종류 공통」 으로 보고 표시 조건을 달지 않았는데, ADR-306 family 종류가 생긴 뒤 이 전제가 깨졌다. 표시 조건 검사 (`chartVisibleWhen.test.ts`) 도 조건 없는 칸을 건너뛰어 잡지 못했다.
  - 수정: 읽는 종류만 보인다 — 시리즈 7 종 + 범례 6 종 (dumbbell · segmented · marimekko · stream · skyline · heatmap) · 이름표 15 종 (descriptor 옵션 → binding `visibleWhen`).
  - 구멍 없는 pie 의 Center Label · Show Total (donut 에서만 그림), 점 크기 필드 없는 산점도의 Size Range 도 숨긴다. 표시 조건에 「하나라도 맞으면」 (`any`) 을 더했다.
  - 축이 없는 종류 (pie · radar · radial · family) 에서 비활성 「기준선 추가」 버튼과 안내 문구가 보이던 것을 칸째 숨긴다 (주석 칸과 같은 규칙).
- **family 범례가 Legend Position 을 무시하던 것**: 6 종 모두 위 (segmented 목록은 아래) 에 고정이었다. 이제 위 · 아래 · 왼쪽 · 오른쪽을 따르고, 시리즈 차트와 같은 배치 함수 (`placeLegend` · `carveLegend`) 를 쓴다. segmented 는 목록과 막대의 자리를, heatmap 은 색 단계 띠 (좌 · 우는 세로) 를 옮긴다. 새로 놓는 dumbbell · marimekko · stream · skyline · heatmap 은 지금과 같은 위로 시작한다 (`legendPosition: "top"` — 생성 시에만).
- **범례가 아래 · 오른쪽일 때 차트에 붙던 것** (시리즈 · family 공통): 범례 상자의 여백이 늘 상자 끝에 있어, 아래 범례는 축 글자에 (dumbbell 4px), 오른쪽 범례는 그림 끝에 (0px) 붙었다. 여백을 그림 쪽으로 옮겼다 (`buildLegend`).
- **범례 ↔ 차트 간격 = 차트 내용 기준 16px, 네 방향** (원형 차트의 좌 · 우는 16px 이상 — 아래) (사용자 결정 — 위 · 아래 8px → 16px, 좌우도 16px, `LEGEND_CHART_GAP`): 전에는 종류 · 방향마다 달랐다 (위 · 아래 6 ~ 16px — bar 위 6.5 · 아래 8.2, pie 12 · 6, radar 15.7, radial 13.5, stream 12, dumbbell 9.5 · 11.5 / 좌우 6 ~ 107px — 원형 차트는 남는 폭이 그대로 간격).
  - 범례 상자 = 범례 내용 + 16px. 범례 쪽 가장자리의 차트 자기 여백을 뺀다 — bar · line 은 값 축 맨 위 눈금 글자 반 줄을 그림 안으로 · 아래 범례면 범주 축 남는 여유 0 · 왼쪽 범례면 값 축 글자 앞 여유 0, family 는 그 쪽 여백 0 (dumbbell 행 이름 앞 10 · 오른쪽은 끝 점 · 값 이름표 끝이 경계, marimekko · stream 축 글자, heatmap 행 이름 · 칸 끝 반 간격 · 강조 테두리, segmented 목록).
  - 원형 (pie · radar · radial): 위 · 아래 범례면 중심을 범례 쪽으로 옮겨 원 (radar 는 각도 이름) 끝이 16px — 남는 세로 여백은 반대쪽 (`polarCenterY`). 왼쪽 · 오른쪽 범례면 범례는 부모 상자의 그 쪽 끝, 차트는 **가로 가운데 그대로** (사용자 결정 「범례로 차트가 좌우로 이동되면 안 된다」 · 「범례는 부모 상자의 left · right」) — 그림 영역을 반대쪽에서도 범례 폭만큼 줄여 가운데를 지킨다, 범례와의 간격은 16px 이상 (`layout.ts`). Canvas scene 과 DOM Recharts 가 같은 값을 읽는다.
  - 위치: `packages/rendering/src/chart/legend.ts` · `authoring.ts` · `families/{kpi,category/*,matrix/grid}.ts`, `packages/shared/src/catalog/bindings/Chart.binding.ts`, `apps/builder/src/builder/panels/properties/{ChartReferenceLineControls.tsx,generic/evaluateVisibility.ts}`

### Tests

- `legendPosition.test.ts` — 범례 6 종 × 4 방향: 범례가 그 쪽으로 가고 그림 영역이 범례 밖에 남는다 (수정 전 11 건 RED). bar · line · pie · radar · radial + 범례 family 6 종 × 네 방향이 차트 내용과 16px (± 0.5), 원형 3 종은 좌 · 우 범례에서도 가로 중심이 범례 없을 때와 같고 간격은 16px 이상, 모든 종류의 좌 · 우 범례는 부모 상자 끝에 붙는다. `computeChartScene` 좌표 스냅샷 2 건 (아래 범례 line · 오른쪽 범례 pie) 갱신.
- `chartVisibleWhen.test.ts` — 「보이는데 안 읽힘」 검사가 조건 없는 칸도 보고 kpi family 까지 덮는다 · 구멍 없는 pie · 크기 필드 없는 산점도 (수정 전 29 건 RED).

## [새로 놓은 요소의 Overrides — 원본과 같은 생성 값은 쓰지 않는다] - 2026-11-16

### Fixed

- **팔레트에서 놓은 Chart 가 처음부터 Overrides 30 개 안팎을 보이던 것**:
  - Component 섹션 Overrides 가 놓자마자 `chartType` · `dimension` · `orientation` … `animationEasing` 을 모두 instance 의 자기 값으로 나열했다 (36 종 전부, Bar 포함).
  - **Why**: 생성 props 를 「정의의 `defaults` 와 다를 때만 저장」 으로 걸렀는데, Chart 원본은 composite 라 `defaults: {}` 이고 값은 원본 template 루트에 있다. 그래서 비교 상대가 늘 빈 값이었다.
  - 수정: 비교 기준을 「새 노드가 자기 값 없이 보이는 값」 (Reset 이 돌아가는 값과 같은 계층 — 원본 template 루트 · 프로젝트 기본값 포함) 으로 바꿨다. 잠금 해제한 원본은 프로젝트 사본을 읽는다.
  - 이제 원본 (직접 놓는 Chart = bar · 격자 끔) 과 실제로 다른 값만 남는다: Bar 1 개 (`showGrid`), Line 3 개 (`chartType` · `curve` · `showGrid`), 다른 종류 2 ~ 8 개. 그려지는 값은 같다.
  - 같은 함수를 쓰는 다른 composite 원본도 원본과 같은 생성 값을 쓰지 않는다 (예: ActionButtonGroup 의 `density="regular"` 가 Code 보기에 더는 나오지 않는다).
  - 위치: `apps/builder/src/builder/catalogRuntime/paletteInsert.ts` (`catalogCreationProps` — 첫 인자가 문서 reader), `packages/shared/src/catalog/resolution/fieldSource.ts` (`readDefinitionProp`)

### Tests

- `chartCreationOverrides.test.ts` — 36 종을 놓고 Bar · Line 의 자기 값 목록, 모든 종류의 보이는 값이 팔레트 값과 같은지, 자기 값마다 상속 값과 다른지 확인한다 (수정 전 3 건 RED).

## [ADR-306 Phase 6 — Chart 공통 상호작용: 강조 · 주석 · 손익 색 · 범위 선택 · 동기화] - 2026-11-16

### Added

- **Highlight** (ADR-306 Phase 6): 차트에서 강조할 항목을 고른다 — `max` · `min` · `first` · `last` · `none` 또는 항목 이름 (여럿 가능). Gauge 를 뺀 34 종. 비워 두면 지금 그림 그대로이고, 막대 · 선 · 영역 · 원 같은 시리즈 차트는 강조 밖 시리즈 · 항목이 회색이 된다. Bullet · Dumbbell · Waterfall · Segmented · Waffle · Stream · Marimekko · Skyline 은 지정할 때만 강조하고, Candlestick 은 고른 봉의 종가에 파선과 가격을 그린다. Sparkline 의 표시 점도 이 값으로 고른다.
- **Annotations** (ADR-306 Phase 6): Line · Area · Bar · Candlestick 에 구간 (값 또는 범주 · 날짜 구간) · 사건 · 예측 (그 뒤 선은 파선) · 추세선 · 주말 음영 (시간 축). Content 의 「Add annotation」 으로 추가하고 칸 둘씩 편집한다. 가로 기준선은 기존 Reference lines.
- **Sign Colors · Baseline · Band From · Outside Points** (ADR-306 Phase 6): Line · Area 의 강조 시리즈를 기준값 위 · 아래 색으로, 범위 띠를 예측 시작부터, 띠 밖 점 표시. 기준값은 Sign Colors 를 켰을 때, Band From · Outside Points 는 띠 아래 경계 필드가 있을 때 보인다.
- **Range Select · Sync Group** (ADR-306 Phase 6, Preview · Publish): 그림을 끌어 구간을 고르면 등락 · 최고 · 최저를 보여 주거나 (Select) 그 구간으로 확대하고 「Show all」 로 돌아온다 (Zoom — Shift + 화살표 · Enter · Esc 도). 같은 Sync Group 의 차트끼리 가리킨 범주에 안내선과 값을 보인다. 저장하지 않는 보기 상태이고 Canvas 는 그대로다.

### Fixed

- **주석 · 예측 시작 · 띠 시작의 날짜를 격자와 같은 locale 로 읽는다** (ADR-306 Phase 6 정리):
  - **Why**: 주석 쪽이 `dimensionFormat` 을 en-US 로만 읽어, 값 locale ko-KR 에 월 이름 (`%b`) 형식이면 격자는 읽는 날짜를 주석은 읽지 못해 조용히 사라졌다.
  - 수정: 격자와 주석이 같은 파서 `timeLabelParser` 를 쓴다. 위치: `packages/rendering/src/chart/series.ts`
- **Candlestick 범위 선택의 High · Low 글자가 숫자 형식 (통화 · 퍼센트) 을 따른다** (ADR-306 Phase 6 정리):
  - **Why**: family host 가 `toLocaleString()` 으로 따로 형식을 만들어 축 · 가격 글자와 달랐다. 위치: `packages/shared/src/components/chart/FamilySceneHost.tsx`

### Changed

- **Chart 상호작용 코드 정리** (ADR-306 Phase 6, `/simplify`): 확대 상태 · 「Show all」 · 범위 선택 · 동기화 판정을 두 host (Recharts · family) 가 같은 hook 으로 쓰고, 막대 · radial 의 색 index 를 Canvas 와 DOM 이 같은 함수 (`markColorIndex`) 로 고른다. 선 · 면을 나눠 칠할 때 Canvas 는 이미 만든 path 를 다시 쓴다. 범위 선택 · 동기화를 쓰지 않는 차트는 범주 좌표를 계산하지 않는다. 번들 Builder −954 · Preview −1,067 B.
- **번들 상한 — Builder ≤ 1,435,351 B** (ADR-201 재승인, ADR-306 사용자 결정 2): Phase 6 실측 Builder +5,562 · Preview +4,625 B gzip (시리즈 차트의 주석 · 강조 · 선 나누기는 Canvas 첫 화면 경로, 범위 선택 · 동기화는 Preview).

## [ADR-306 Phase 5 — Chart 종류 4 (network family) · 기존 종류 보강 → 36 종] - 2026-11-16

### Added

- **Chart 종류 4 — Treemap · Sunburst · Sankey Diagram · Chord Diagram** (ADR-306 Phase 5): Treemap 은 계층의 비율을 넓이로 (경로 필드 Path — 위 단계부터, 위 단계 머리글, 칸 안 이름 · 비율, Label content 로 비율만), Sunburst 는 깊이마다 고리 하나 (가운데 구멍 · 바깥 이름표), Sankey 는 출발 → 도착 흐름의 양 (노드 폭 · 간격, 순환 연결은 진단), Chord 는 마디 사이에 주고받은 양 (마디 틈). 가장 큰 항목과 그에 닿는 흐름을 강조하고, 칸 안 글자는 칠 위에서 읽히는 대비 색이다. 고리 조각은 조각 어디를 가리켜도 툴팁이 뜬다.
- **팔레트 Donut Chart · Bubble Chart** — 각각 Pie · Scatter 종류의 기본값 항목 (Donut 은 가운데 합계 · 「Total」, Bubble 은 점 크기 필드). 팔레트 Charts 36 항목 (ztd-charts 36 종 전부).
- **기존 Chart 종류 보강** (ADR-306 Phase 5): Bar · Pie 의 Sort (값 순서), Line · Area 의 Min · Max value (값이 모두 양수여도 Min value 가 축 시작) · Include Zero (Line · Area · Scatter 는 켜진 상태로 보이고, 끄면 축이 0 을 넣지 않음) · Connect Gaps (빈 값을 건너 잇기) · End Labels (선 끝 시리즈 이름) · Band Lower · Band Upper (범위 띠), Radar · Radial 의 Max value (Radial 은 새로 만들면 100 — 진행률), Scatter 의 Size (점 크기 — 면적 비례) · Size Range · Label (점 이름) · Trend Line (최소제곱 추세선) · Quadrant Names (사분면 이름), Pie 의 Center Label (도넛 가운데 글자). Canvas 와 Preview · Publish 가 같은 계산으로 그린다. 누적 Line 의 Connect Gaps 도 두 쪽이 같이 잇고, Treemap · Sunburst 에서 하위 분류가 빈 행의 값은 부모 이름의 칸으로 남는다.
  - 위치: `packages/rendering/src/chart/families/network/` (ztd-charts 0.5.0 계층 · sankey · chord 배치 이식, MIT) · `chart/marks/seriesExtras.ts` · `marks/sizeRange.ts` · `chart/{model,layout,series,budget,authoring,types,paint}.ts` · `marks/{line,area,pie}.ts` · `shared/.../Chart.binding.ts` · `chart/{RechartsChart,FamilySceneHost,svgDecorations}.tsx` · builder 팔레트 아이콘 6 · 테스트 `network.test.ts` 46 · `adr306SeriesEnhancements.test.ts` 20 · `networkSkia.test.ts` 6 · `adr306NetworkHost.browser.test.tsx` 42 · `adr306SeriesEnhancements.browser.test.tsx` 7

### Fixed

- **Library 의 Parallel Coordinates 칸이 비어 있던 것** (Phase 4): 작은 칸에서 축 이름 줄이 그림 높이를 다 차지해 선을 하나도 그리지 않았다 — 높이가 모자라면 축 이름을 빼고 선을 그린다.
- **Design 패널 Chart 의 Sort · Include Zero 기본값**: Bar · Pie · Line 이 같은 칸을 읽게 되면서 기본값 (Descending · 끔) 이 기존 차트를 정렬 · 0 제외로 바꾸지 않도록 기본값을 두지 않는다 (종류마다 비었을 때의 순서는 그 종류가 정한다).

### Changed

- **번들 상한 — Builder ≤ 1,429,789 B** (ADR-201 재승인, ADR-306 사용자 결정 2): Phase 5 실측 Builder +4,277 (판독 수리 +340) · Preview +3,297 (+120) B gzip (종류 목록 · binding · 팔레트 · 시리즈 종류 보강 — 시리즈 Canvas scene 은 첫 화면 경로). network 계산 · 표본은 별도 chunk (7,593 B).

## [ADR-306 Phase 4 — Chart 종류 8 (distribution · matrix family)] - 2026-11-16

### Added

- **Chart 종류 8 — Histogram · Box Plot · Beeswarm · Ridgeline · Heatmap · Calendar Heatmap · Candlestick · Parallel Coordinates** (ADR-306 Phase 4): 팔레트 Charts 가 30 항목. Histogram 은 원시 표본 또는 구간 행 (Bin Start · Bin End · Count) 의 분포 — 그룹 둘까지 같은 경계 · 분위 선 (Percentiles, 기본 p50 · p95) · 기준값 (Threshold) 을 넘는 구간 강조 · 모양 Bar · Dots · Step · 구간 경계 · 폭 · 수 · Log · 밀도 곡선. Box Plot 은 그룹별 사분위 · 수염 (Tukey 또는 백분위) · 이상값 (Box · Violin · Both). Beeswarm 은 값마다 점 하나 · 그룹 중앙값. Ridgeline 은 그룹별 밀도 곡선 (겹침 · 대역폭 · 중앙값 순). Heatmap 은 열 × 행 칸의 합을 4 단계 색으로 (범례 이름). Calendar Heatmap 은 하루하루를 주 단위 격자로 (주 시작 일 · 월, 칸 틈). Candlestick 은 시가 · 고가 · 저가 · 종가 · 거래량 · 이동평균 (봉이 많으면 이웃 봉을 합친다). Parallel Coordinates 는 값 필드마다 축 하나 · 행마다 선 하나 (작은 값이 위인 축). 분포 통계 · 칸 합계는 데이터 전체로 내고, 그리는 점 · 선 · 그룹만 줄인다.
  - 위치: `packages/rendering/src/chart/families/` (`stats.ts` — ztd-charts 0.5.0 통계 이식, MIT · `samples.ts` · `distribution/` · `matrix/`) · `chart/{types,authoring}.ts` · `families/{registry,fields}.ts` · `families/category/common.ts` · `packages/shared/src/catalog/bindings/Chart.binding.ts` · `components/Chart.runtime.ts` · `apps/builder/.../paletteItems.ts`

### Fixed

- **Design 패널 Chart 의 Threshold 칸이 0 ~ 100 % 슬라이더였던 것**: Pareto 의 누적 % 와 Histogram 의 기준값이 같은 칸이라 범위 · 기본값을 두지 않는다 (Pareto 는 비면 80 %). Gauge 의 Min Value 도 기본값을 두지 않는다 (비면 0 — Candlestick 의 가격 축이 0 부터 그려지던 것). 위치: `packages/shared/src/catalog/bindings/Chart.binding.ts`.

### Changed

- **번들 상한 — Builder ≤ 1,425,172 B** (ADR-201 재승인, ADR-306 사용자 결정 2): Phase 4 실측 Builder +2,228 · Preview +1,123 B gzip (종류 목록 · binding · 팔레트). distribution · matrix 계산 · 표본은 별도 chunk (9,655 · 7,097 B). Preview 상한 무변경. 위치: `apps/builder/scripts/adr201-bundle-gate.mjs` · `.github/workflows/deploy.yml` · `CLAUDE.md`.

## [ADR-306 Phase 3 — Chart 종류 12 (category family)] - 2026-11-16

### Added

- **Chart 종류 12 — Lollipop · Segmented Bar · Waffle · Funnel · Pareto · Waterfall · Sparkline · Marimekko · Streamgraph · Bump · Slope · Skyline** (ADR-306 Phase 3, category family): 팔레트 Charts 가 22 항목. Lollipop 은 큰 순서 · 최댓값 강조 (가로 / 세로), Segmented Bar 는 비중 막대 + 목록 (Tall · Thin), Waffle 은 칸 100 개 (칸 수 · 줄 칸 수 · 전체 값 · 요약), Funnel 은 단계 전환율 (이전 / 첫 단계 기준 · 가장 낮은 단계 강조), Pareto 는 큰 순서 막대 + 누적선 · 기준선 (기본 80 %), Waterfall 은 증가 · 감소 · 합계 막대 (Kind 필드의 `total` 행 · 시작 / 끝 합계 · 연결선), Sparkline 은 작은 추세 (Area · Line · Bar · 마지막 값 · 최고 · 최저), Marimekko 는 열 비중 × 열 안 비중, Streamgraph 는 흐름 쌓기 (Wiggle · Silhouette · 순서 정리), Bump 는 순위 변화 (Rank 필드 또는 값으로 순위), Slope 은 두 시점 변화 (시점 2 개 또는 값 필드 2 개), Skyline 은 기간마다 입체 쌓기 + 앞줄 (Front Fields · 뒷벽 · 빗금 · 앞줄 ÷ 뒷줄). Design 패널의 Shape 칸은 종류마다 그 종류의 값만 낸다. Streamgraph · Slope · Skyline 은 값 필드 목록 (Value Columns) 도 받는다.
  - 위치: `packages/rendering/src/chart/families/category/` (`common` · `bars` · `lines` · `blocks` · `index`) · `families/shapes.ts` (ztd-charts 0.5.0 보조 식 이식, MIT) · `chart/{types,authoring}.ts` · `packages/shared/src/catalog/bindings/Chart.binding.ts` · `catalog/types.ts` (`PropContract.options[].visibleWhen`) · `components/chart/FamilySceneHost.tsx` · `apps/builder/.../GenericFieldRenderer.tsx` · `useChartPropertyExtras.tsx` · `ChartAuthoringControls.tsx` · `chartFieldOptions.ts` · `paletteItems.ts`

### Fixed

- **Canvas 의 차트 로드 실패가 세션 내내 남던 것** (ADR-306 Phase 2 열린 항목): 실패 뒤 15 초가 지나 그 Chart 를 다시 그릴 때 다시 받는다. 위치: `apps/builder/src/builder/catalogRuntime/ruleShapes.ts`.
- **새 프로젝트 Library 의 Chart Types 카드가 데이터 없이 저장되던 것** (ADR-306 Phase 2 열린 항목): Library 를 처음 열 때 차트 계산 파일을 받은 뒤 저장한다 (이미 저장된 프로젝트의 카드는 그대로). 위치: `apps/builder/src/builder/catalogRuntime/workspace.ts`.

### Changed

- **번들 상한 — Builder ≤ 1,422,944 B** (ADR-201 재승인, ADR-306 사용자 결정 2): Phase 3 실측 Builder +4,468 · Preview +2,589 B gzip (종류 목록 · binding · 패널). category 계산 · 표본은 별도 chunk (15,762 B). Preview 상한 무변경. 위치: `apps/builder/scripts/adr201-bundle-gate.mjs` · `.github/workflows/deploy.yml` · `CLAUDE.md`.

## [ADR-306 Phase 2 — Chart family 기반 + Gauge · Bullet · Dumbbell] - 2026-11-16

### Added

- **Chart 종류 3 — Gauge · Bullet · Dumbbell** (ADR-306 Phase 2, kpi family): 팔레트 Charts 에 세 항목. Gauge 는 첫 행 값을 Min · Max 범위의 비율로 (모양 Arc · Semicircle · Ring · Ticks, 목표 필드 · 구간 경계 · 가운데 설명), Bullet 은 행마다 값 막대 · 목표선 · 구간 띠 (Range Fields, 행마다 따로 또는 공용 축), Dumbbell 은 행마다 이전 · 이후 두 값 (Start · End 필드, 정렬 · 0 포함). Design 패널의 Collection 에 종류가 읽는 필드 (Goal · Start · End · Range Fields) 만 서고, 시리즈 전용 컨트롤은 나오지 않는다. Preview · Publish 는 hover 와 화살표 키로 값 툴팁을 연다.
  - 위치: `packages/rendering/src/chart/families/` (`registry.ts` · `kpi.ts` · `fields.ts` · `niceScale.ts` — ztd-charts 0.5.0 축 범위 식 이식, MIT) · `chart/{types,authoring,computeChartScene,paint,frame,sceneStates}.ts` · `renderers/skiaPrimitives.ts` · `packages/shared/src/components/chart/FamilySceneHost.tsx` · `RechartsChart.tsx` · `svgDecorations.tsx` · `Chart.components.tsx` · `catalog/bindings/Chart.binding.ts` · `apps/builder/.../ruleShapes.ts` · `canvasBinding.ts` · `canvasScene.ts` · `CatalogCanvas.tsx` · `CatalogComponentsPanel.tsx` · `useChartPropertyExtras.tsx` · `chartFieldOptions.ts`
- **Chart family 기반** (ADR-306 — 나머지 24 종이 Phase 3 ~ 5 에 같은 틀로 들어온다): 새 종류의 계산 · 표본은 family 마다 지연 로드되는 chunk 이고 (첫 화면에 들지 않는다), 로드 전 차트는 빈 상자 → 로드 뒤 Canvas · DOM 이 같은 scene 으로 다시 그린다 (Canvas 는 그 Chart 만 다시 기록). 실패하면 DOM 은 다시 시도 버튼, 팔레트 삽입은 안내. 새 prop 은 목록 하나 (`CHART_FAMILY_PROP_KEYS`) 로 binding · DOM · Canvas 에 같이 닿는다. 색은 시리즈 팔레트 밖의 뜻 있는 역할 (`accent` · `neutral` · `positive` · `negative` · 값 단계) 을 rule `Chart.chart.paint` → `--chart-paint-*` 로 받는다.

### Changed

- **번들 상한 — Builder ≤ 1,418,476 B** (ADR-201 재승인, ADR-306 사용자 결정 2): Phase 2 실측 Builder +4,476 · Preview +2,969 B gzip (종류 목록 · 등록 기구 · prop 목록 · 패널). kpi 계산 · 표본은 별도 chunk (5,174 B). Preview 상한 무변경. 위치: `apps/builder/scripts/adr201-bundle-gate.mjs` · `.github/workflows/deploy.yml` · `CLAUDE.md`.

## [ADR-306 Phase 0 · 1 — Chart 의 공개 size 삭제 (contract 68)] - 2026-11-15

### Removed

- **Breaking — Chart 의 공개 `size` (S/M/L) 와 `data-size` 삭제** (ADR-306 Phase 1):
  - Design 패널의 Chart Size 칸 · binding `accepts.size` · 공개 React 타입 `size` · DOM `data-size` · 생성 CSS 의 `.react-aria-Chart[data-size]` 블록이 없다. 차트 크기는 Layout (기본 16:9 상자 — 2026-11-13) 이 정하고, 축 여백 · 글자 기하는 rule 한 벌 (padding 12 · 글자 11 = 옛 M) 이다.
  - **문서 contract 67 → 68**: typed Chart 원본에서 `size` 를 지웠으므로 contract 67 이하 문서는 Chart 유무와 무관하게 열리지 않는다 (`UNSUPPORTED_LIBRARY_CONTRACT` — 변환 없음, 저장소 정책). 68 문서라도 Chart 에 `size` 를 실으면 `PROP_NOT_ACCEPTED`.
  - **Why**: S/M/L 이 높이 · 여백 · 글자를 함께 묶어 Layout 의 상자 크기와 겹쳤다 — ztd-charts 36종 확장 (ADR-306) 의 전제 「공개 size 제거」.
  - 위치: `packages/shared/src/catalog/bindings/Chart.binding.ts` · `components/Chart.components.tsx` · `Chart.runtime.ts` · `generated/componentRulesTable.ts` (`Chart`) · `document/generated/reusableOriginLibrary.ts` · `document/types.ts` · `packages/rendering/src/chart/computeChartScene.ts` (`resolveChartMetrics(channel, style)`) · `authoring.ts` · `renderers/skiaPrimitives.ts` · `apps/builder/.../ChartBudgetControls.tsx` · `useChartPropertyExtras.tsx`

### Fixed

- **Chart browser 테스트 선행 실패 3건** (ADR-306 Phase 0 재현 → Phase 1 수리): `data-size` 기대 2건 (chart · chart-a11y project) 은 size 없는 계약으로, bar 재전송 동일성 1건은 Recharts 3.10.1 의 animation 마지막 프레임 보간 float (`39.777499999999996`) 와 정적 path 반올림 (`39.7775`) 의 ≈3e-5 px 차이라 0.01 px 로 맞춰 비교한다 (animation 재시작은 그대로 잡힌다). 382/382.

### Added

- **Chart 계약 게이트 `codex:chart-contract`** (ADR-306 Phase 0): `pnpm test:chart-contract` (rendering `src/chart` unit) 를 `codex:preflight` 사슬에 넣었다. 첫 항목은 ztd-charts 0.5.0 (`3c4376c`, MIT) 의 36 항목 · 채널 · 옵션 key 전부를 채택 / 대응 / 제외 / 사용자 결정으로 나눈 분류 census (`ztdRegistry.pinned.ts` — 원본 텍스트에서 옮긴 key · `ztdCoverage.fixture.ts` — 분류, 분류 누락 · 남는 분류를 막는다).

## [ADR-311 설계 — RAC anatomy 기반 SVG 자산 미리보기] - 2026-11-15

### Documentation

- **ADR-311 Proposed — 구현 전 설계**:
  - RAC anatomy와 catalog·layout을 연결해 SVG 본체·치수선·정렬 가이드를 생성하고 hover/focus에서 완성된 모습으로 전환하는 구조를 정의했다.
  - Components·Blocks·Layouts·Templates의 source/activation 경계, Navigator Layouts 보존, 안정 ID·section 변경·의존성 digest·release 이력과 검증 계획을 포함했다.
  - 위치: `docs/adr/311-catalog-anatomy-svg-asset-previews.md`, `docs/adr/design/311-catalog-anatomy-svg-asset-previews-breakdown.md`. Phase 0–6은 실행 계획이며 제품 동작 변경은 없다.
  - Nexvyn 갤러리 실측과 시안 판정을 반영했다 — 최소 카드 폭 160px 가로형 카드, 계층 6종, 진입 연출 1회, hover 700ms 전환, 치수선은 숫자와 함께만, 내용 글자는 막대 유지.

## [ADR-310 Implemented — Phase 8 세로 · 가로 목록 · 카드 grid · Table 의 가상 스크롤] - 2026-11-15

### Added

- **행 표시 「가상 스크롤」**: 높이를 정한 연결 목록은 Design 패널 「행 표시」 에서 가상 스크롤을 고를 수 있다 — Preview · Publish 가 보이는 행만 DOM 에 두고 (250 행 목록에서 13 ~ 14 개) 스크롤 · 키보드 이동 · 선택은 그대로다. 높이가 정해지지 않은 목록은 고를 수 없고 이유가 보인다.
- **카드 grid 의 가상 스크롤**: CardView · GridList (grid 배치) 도 가상 스크롤을 고를 수 있다. 칸 크기 · 간격은 S2 CardView 의 크기 표 (CardView — 크기 prop, 폭에 2열이 들어가지 않으면 한 단계 작게) 와 RAC `GridLayout` 기본값 (GridList) 을 따르고, Canvas 도 같은 열 · 간격으로 칸을 놓는다 (Publish 와 첫 행 위치 같음, 250 장 중 DOM 4 ~ 6 장). waterfall 배치는 아직 고를 수 없다.
- **Table · 가로 목록의 가상 스크롤**: Table 은 Canvas 의 열 트랙을 같은 폭에서 그대로 열 폭으로 쓰고 (RAC 의 정수 열 폭 대신 — 199.33 · 199.33 · 199.33), 행 높이에 Row 의 아래 테두리까지 넣는다 (Canvas 41 = Publish 41). 가로 목록 (Styles 의 flex row) 은 그 방향으로 놓고 항목이 줄 높이를 채운다. 줄바꿈 · 역순 · 여러 열 grid 처럼 한 줄 목록이 아닌 배치는 고를 수 없고 이유가 보인다.

### Fixed

- **가상 스크롤 Table 이 높이에 맞는 행까지만 스크롤** (ADR-310 Phase 8):
  - 300 px Table 에 250 행을 연결해 가상 스크롤로 바꿔도 Publish 는 11 행에서 끝났다.
  - **Why**: 높이를 정한 Table 은 높이에 들어가는 행만 남기는데 (`boundTableRows`), 그 자르기가 가상 스크롤 Table 에도 걸렸다. 이제 Preview · Publish 는 모든 행을 두고 Builder 만 표본으로 자른다.
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts`
- **가상 스크롤 목록의 스크롤 막대 길이** (ADR-310 Phase 8):
  - 1,000 행 (행 32 px) 목록의 전체 높이가 처음 39,800 px 로 잡혀 스크롤하면서 32,008 로 줄었다 — 막대 길이 · 위치가 실제 행과 맞지 않았다.
  - **Why**: Preview · Publish 에는 배치 결과가 없어 행 크기를 추정 40 으로 주는데, 잰 행이 그 뒤 행의 추정에 쓰이지 않았다. 이제 마지막으로 잰 행 크기가 다음 추정값이다 (첫 행을 잰 뒤 바로 32,008).
  - 위치: `packages/shared/src/catalog/runtime/catalogVirtualizer.components.tsx` (`CatalogListLayout`)
- **터치 기기에서 가상 스크롤 Table 의 선택 · drag 열 폭** (ADR-310 Phase 8):
  - 터치 기기 (S2 기기 media · Preview 터치 보기) 에서 가상 스크롤 Table 의 선택 checkbox 열이 S2 52 px 이 아니라 40 px, drag 열이 20 이 아니라 16 px 로 놓였다 (일반 Table 은 52 · 20).
  - **Why**: 가상 스크롤 Table 의 열 폭은 Canvas 의 열 트랙 (데스크톱 px) 에서 풀었고, DOM 이 기기에 따라 바꾸는 트랙 (`{size.table.selection-column}` · drag 열 × 1.25) 을 읽지 않았다. 이제 Canvas 가 트랙을 만드는 함수 (`catalogTableRowTracks`) 를 그 기기의 선택 열 px 로 불러 (drag 열은 그 기기 px) 같은 grid 풀이로 폭을 낸다.
  - 위치: `packages/shared/src/catalog/runtime/virtualListLayout.ts` (`tableTrackInput`) · `tableTracks.ts` (`catalogTableRowTracks` 의 열별 `list`) · `catalogVirtualizer.components.tsx` · `domBinding.runtime.ts` (`useCatalogTableDeviceColumns` — resizable Table 의 선택 · drag RAC 열과 같은 hook) · `domBinding.components.tsx` (그 hook · 트랙 함수를 reader 로 넘긴다: chunk 의 정적 import 는 모듈을 chunk 로 갈라 초기 번들 +1,357 B 였다 → Builder −10 B)
- **Table 선택 checkbox 열의 머리글 높이 Canvas 35 · Preview 32** (ADR-310 Phase 8 후속 — 일반 Table 도):
  - 전체선택 Checkbox (`Checkbox[slot=selection]`) 를 넣은 머리글 행이 Canvas 에서만 S2 32 px 보다 3 px 높았다.
  - **Why**: 칸 안 Checkbox 를 줄 위쪽에 두는 `vertical-align: top` 이 수동 `Table.css` 에만 있어, Canvas 엔진은 inline-flex Checkbox 를 baseline 에 놓고 줄 상자에 글자 descent 만큼 더 잡았다. 이제 Column · Cell rule 의 part rule 이 Checkbox 자식에 그 값을 주고 Canvas 엔진 · DOM inline 이 같이 읽는다 (수동 CSS 규칙 삭제).
  - 위치: `packages/shared/src/catalog/document/rulePartRules.ts` (`tableCellCheckboxPartRules`) · `packages/shared/src/components/styles/Table.css`
- **데이터를 연결한 Table 의 Row 템플릿 안 편집이 거부되던 것** (ADR-310 Phase 4 후속):
  - 연결한 Table 의 Row 템플릿 Cell 글자나 그 안 Checkbox 라벨을 바꾸면 `RESOLVED_INSTANCE_MISSING` 으로 편집이 거부됐다. 라벨을 비운 Checkbox 는 행마다 다시 「Checkbox」 로 보였다.
  - **Why**: ① 반복된 행의 record id 에는 `#row:<key>` 가 붙는데, 증분 해석이 그 id 로 경로를 적어 두고 resolver 는 템플릿 자리 (접미사 없음) 로 물어 경로가 끊겼다. ② 행 템플릿의 리터럴 글자는 표본 글자로 빼는데 (`withoutSampleContent`), 빈 글자 `""` 까지 빼서 원본 기본값이 돌아왔다 — 빈 글자는 표본이 아니라 비운 값이다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`resolvePruned`) · `packages/shared/src/catalog/resolution/resolver.ts` (`withoutSampleContent`)

### Performance

- **가상 스크롤 목록의 스크롤 프레임** (ADR-310 Phase 8 · 사용자 결정 8):
  - CPU 4x · 목록 여럿인 문서에서 1,000 행 가상 목록을 스크롤하면 p95 25 ms (프레임 80 % 손실) 였다 → 17.5 ms (같은 문서 · 같은 입력 조건의 순수 RAC 가상 목록 17.5 ~ 25 ms). 1x 는 9 ms 대 그대로.
  - **Why**: ① 추정 40 과 실제 32 가 달라 새 행마다 RAC 가 목록을 다시 배치하고 행 view 를 재사용하지 못했다 (위 「스크롤 막대」 수리로 함께 해결 — commit 72 → 34). ② RAC 가 행 view 를 다른 행에 재사용할 때 우리 자식 노드의 React key 가 행마다 다른 record id (`…#row:<key>`) 라 하위 트리 전체가 다시 마운트됐다. 데이터 행 아래 자식 · 그린 요소의 key 를 템플릿 자리로 바꿨다 (마운트 280 → 15).
  - G8 frame 기준은 사용자 결정 8 로 「더 보기 대비」 에서 「같은 문서의 순수 RAC 가상 목록 대비」 로 바뀌었다 — 더 보기는 compositor 스크롤이라 main thread 일이 0 이고, 순수 RAC 가상 목록도 같은 조건에서 그보다 늦다 (실측).
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts` (`catalogChildKey` · `catalogRowStableElement`) · `domBinding.components.tsx`

### Tests

- **G8 하니스** `apps/builder/scripts/adr310-g8-virtual-live.mjs` (headed Chrome, dev 또는 `--serve-dist` production): 패널에서 가상 스크롤 선택 · DOM 행 수 · Canvas ↔ DOM 행 위치 1 px (세로 · 가로 · Table · grid) · 원격 끝에서 다음 쪽 · 키보드 · frame A/B (순수 RAC 대조군 `adr310VirtualBaseline.mjs` · 더 보기 참고). `virtualRowReuse.test.ts` 3 (원복 RED 3). G8 ⑦ — 선택 열 있는 가상 Table 의 터치 52 · 데스크톱 40 · 머리글 = 본문 행 (원복 RED: 터치 토큰 52 인데 열 40), `adr256TableNodeTree.test.tsx` 「a virtual Table's Layout lays the columns on the Canvas's tracks」 (실제 root 의 가상 Layout 열 = 데스크톱 Canvas 트랙 · 터치 52, 원복 RED: 데스크톱 40 고정). G8 ⑧ — 행 템플릿 Cell 의 선택 Checkbox 가 보이는 행마다 라벨 없이 (하니스가 Column · Row 템플릿 Cell 둘 다에 넣는다), ② Table 머리글 Canvas 32 = DOM 32. `adr310TableTemplate.test.tsx` 「a field edit inside the bound Row template」 (원복 RED 2 — 행 접미사 키 · 빈 글자 빼기) · `adr256TableNodeTree.test.tsx` 「a selection Checkbox sits at the top」 (원복 RED — part rule 끔). `perfDist.mjs` 가 `publish/` 디렉터리의 index.html 을 낸다.

## [ADR-310 Phase 7 — 연결한 목록의 「페이지」 표시 · Pagination 연결] - 2026-11-15

### Added

- **행 표시 「페이지」**: 데이터를 연결한 목록의 Design 패널 Collection 에 「행 표시」 (끝에서 더 보기 / 페이지) 와 「쪽당 행 수」 가 생겼다. 페이지로 두면 Preview · Publish 가 그 수만큼만 보이고, 고른 Pagination 이 번호를 쪽 수만큼 그린다 (첫 번호 Button 이 템플릿 — 지금 쪽이 선택). 번호 · ← · → 를 누르면 그 쪽으로 간다. 정렬 · 검색을 바꾸면 1 쪽으로 돌아간다.
- **원격 데이터의 쪽**: API 로 받는 데이터는 쪽 목록마다 자기 쪽을 요청한다 — endpoint 의 `{{ page }}` · `{{ pageSize }}` 인자. 같은 데이터를 읽는 다른 목록의 행은 바뀌지 않는다. endpoint 가 쪽 번호를 받지 않으면 번호 없이 ← · → (cursor) 로 오간다.

## [ADR-310 Phase 6 — Code 보기의 반복 항목 · 끌어 옮기기 onMove · 고정 항목 경계] - 2026-11-15

### Changed

- **Code 보기 — 반복 항목 = 렌더 함수**: 데이터를 연결한 목록의 코드가 행 템플릿을 그대로 보인다 — `<ListBox items={users}>{item => <ListBoxItem id={item.id} …/>}</ListBox>`. 고정 항목과 섞인 목록 · 항목에 직접 연결한 구간 · Table 의 행 · Tabs 의 패널은 그 자리에 `<Collection items={…}>`, RadioGroup 같은 그룹은 `{rows.map(item => <Radio key value>…)}`, 하위 행을 읽는 Tree 는 `renderItem` 재귀, 규칙이 편집하는 Tree 는 `useTreeData`. 전에는 템플릿과 무관한 한 줄 (`{item.id}`) 이었다.
- **Code 보기 적용**: `<Collection>` 블록을 옮겨 적용하면 반복 항목이 그 자리로 옮겨진다. 렌더 함수 본문은 읽기 전용 — 고치면 적용하지 않고 그 줄을 알린다. 여는 태그 줄을 바꾸거나 한 instance 의 열 여럿을 고친 코드를 붙여넣어도 노드가 지워지고 다시 만들어지지 않는다.
- **끌어 옮기기 — 고정 항목**: 고정 항목과 데이터 행이 섞인 목록에서 고정 항목은 끌어 옮기는 대상이 아니고, 데이터 행을 고정 항목 앞 · 뒤에 놓으면 그 데이터 구간의 처음 · 끝으로 간다. 한 목록의 서로 다른 데이터 구간은 각자 자기 데이터 type 으로 끌린다.

### Added

- **When 「같은 목록 안에서 옮길 때 (항목 위 포함)」** (RAC `onMove`): ListBox · GridList · Tree · Table. 옮기기 Do 의 놓은 쪽이 `on` (항목 위) 이면 그 항목의 마지막 자식으로 옮긴다 (Tree 의 새 부모).

## [ADR-310 Phase 5 — 한 목록에 데이터 둘 · 묶음 section · Radio 등 그룹 연결] - 2026-11-15

### Added

- **항목에 데이터를 직접 연결**: ListBox · GridList · TagGroup · Breadcrumbs · CardView · SelectBoxGroup 의 항목과 ListBoxSection · GridListSection · MenuSection 의 Design 패널에 데이터 소스 칸이 생겼다. 항목을 연결하면 그 항목이 그 데이터의 행마다 반복된다 — 목록 자체는 연결하지 않아도 되고, 한 목록에 고정 항목과 서로 다른 데이터의 구간 둘 이상을 문서 순서대로 둘 수 있다 (`[Inbox, People 의 행들, Teams 의 행들]`). Layers 의 각 템플릿 행에 그 구간의 「× 행 수」, 두 구간의 key 가 겹치면 경고가 붙는다.
- **묶음 section**: section 을 하위 행이 있는 데이터에 연결하고 「하위 항목 필드」 를 고르면 section 이 묶음마다 반복되고 안의 항목이 그 묶음의 하위 행마다 반복된다.
- **그룹 연결**: RadioGroup · CheckboxGroup · ToggleButtonGroup · SegmentedControl 도 데이터에 연결하면 항목 하나가 행마다 반복된다 (Radio · Checkbox 의 값 = 행 key, 글자 = 행 label).

### Changed

- **구간마다 더 불러오기**: 원격 데이터 구간은 각자 끝에 더 불러오기 표시를 두고 자기 데이터의 다음 쪽을 부른다 (전에는 목록 끝 하나가 목록에 연결된 데이터만 불렀다). 로딩 표시 · 불러온 선택도 구간의 데이터를 따른다.
- 데이터 연결 배지는 구간마다 한 번 (첫 행) 붙는다.

## [ADR-310 Phase 4 — 데이터를 연결한 Table 의 행 템플릿] - 2026-11-15

### Changed

- **연결한 Table 의 행 = Row 템플릿 하나**: 데이터를 연결한 Table 은 TableBody 의 Row 하나를 행 템플릿으로 데이터 행마다 반복한다 — 다른 목록과 같은 반복 표시. 연결하면 열마다 Cell 이 그 열의 필드 (`{name}` 처럼) 를 읽고, Layers 에는 템플릿 행 하나에 「× 행 수」 가 붙는다. 전에는 행 · 칸이 문서에 없는 합성 행이라 칸의 모양을 노드로 편집할 수 없었다.
- **칸 꾸미기**: 템플릿 Cell 에 Badge · Button 같은 노드를 넣으면 모든 행에 보인다 (Badge 의 글자 `{status}` 는 행마다 그 값).
- **열 추가**: 연결한 Table 에 열을 더하면 템플릿 Cell 이 그 열의 필드를 읽는다. 연결하면 각 열의 key 가 지금 값으로 고정돼, 머리글 라벨을 바꿔도 그 열이 읽는 필드와 정렬은 그대로다.

### Added

- **고정 행**: 연결한 Table 도 템플릿 옆에 합계 행 같은 고정 Row 를 받는다 (전에는 거절됐다). 고정 행은 데이터 행 앞 · 뒤 제자리에 그려진다.

## [ADR-310 Phase 3 — 목록에 고정 항목과 데이터 행을 섞는다 (반복 표시)] - 2026-11-15

### Added

- **반복 표시**: 데이터를 연결한 목록 (ListBox · GridList · Menu · TagGroup · Tree · CardView · SelectBoxGroup · Breadcrumbs · Select · ComboBox) 은 표시된 항목 하나를 데이터 행마다 반복하고, 나머지 항목은 고정 항목으로 그 자리에 둔다 — 「전체」 같은 고정 항목을 데이터 앞 · 뒤에 둘 수 있다. Layers 의 템플릿 행에 반복 아이콘과 「× 행 수」가 붙고, Canvas 에서 템플릿을 고르면 반복된 행 전체에 점선 외곽이 보인다 (사용자 결정 3).
- **연결 칸의 선택지**: 고정 항목이 2 개 이상인 목록에 데이터를 고르면 「첫 항목만 템플릿으로 — 나머지 지움」 (기본) 과 「모두 고정 항목으로 두고 데이터는 뒤에」 중 고른다 (사용자 결정 2). 연결 한 번 = Undo 한 단계.
- **「Use as row template」**: Canvas · Layers 우클릭으로 다른 항목을 행 템플릿으로 바꾼다 (Tab 은 짝 TabPanel 도).
- **key 충돌 경고**: 데이터 행의 key 가 고정 항목의 Item ID 와 겹치면 Layers 템플릿 행에 경고가 뜬다 (행은 그대로 보인다).

### Changed

- 연결 해제는 템플릿을 고정 항목 하나로 남긴다. 항목을 모두 지운 목록은 원본의 첫 항목으로 행을 그리지 않는다 — 다시 연결하면 자기 템플릿 항목이 생긴다. 저장 형식은 contract 67 안에서 `repeat` 칸이 늘었다 (Phase 2 와 같은 번호).

## [ADR-310 Phase 2 — Tabs 항목은 노드 (Tab + 짝 TabPanel) · contract 67] - 2026-11-15

### Changed

- **Breaking — contract 66 → 67**: Tabs 의 항목 목록 (`items` 배열 · Properties 의 Tabs 목록 편집기) 을 지웠다. 이제 Tab 과 TabPanel 노드가 정본이고 (사용자 결정 A2), 놓은 Tabs 는 TabList · Tab · TabPanel 을 모두 자기 노드로 갖는다 — Layers 에서 고르고 안에 내용을 넣을 수 있다. 그 전 번호로 저장한 프로젝트는 열리지 않는다 (저장소 정책 — 변환 없음).

### Fixed

- **Tab 삭제 · 복제 뒤 남는 TabPanel**: Tab 을 지우거나 복제해도 짝 TabPanel 은 그대로라, 지운 Tab 의 본문이 남거나 복제한 Tab 에 본문이 없었다. 이제 Tab 삭제는 짝 TabPanel 도 지우고, 복제는 짝 TabPanel 을 새 key 로 복제한다 — 한 번의 Undo 로 둘 다 되돌아간다. 「+」 도 Tab 과 TabPanel 을 함께 넣는다.
- **데이터를 연결한 Tabs 의 본문**: 행의 content 가 TabPanel 본문에 들어간다 (TabPanel 이 노드가 된 뒤에도).
- **Select · ComboBox 목록 끝에서 멈춤 (Phase 1 회귀)**: 다음 페이지 응답이 늦으면 목록 끝이 다시 그려질 때마다 더 불러오기를 호출해 Preview 가 멈출 수 있었다. 새 행이 들어왔을 때만 목록 창을 늘린다.

## [ADR-310 Phase 0 · 1 — 연결한 Menu · CardView · SelectBoxGroup 반복 · 「더 보기」 · 항목 type 표 하나] - 2026-11-15

### Fixed

- **데이터를 연결한 Menu · CardView · SelectBoxGroup**: 연결해도 원본 항목 (Menu 3 · Card 3 · SelectBox 2) 이 그대로 보이고 데이터 행이 반복되지 않았다. 이제 행마다 항목이 반복된다 — Card 는 제목 · 설명 글자에 행의 label · description 이 들어가고 (S2 CardView 예제의 `<Text slot="title">`), SelectBox 는 원본 기본 글자 「Option」 대신 행의 label 을 쓴다. Canvas 는 ListBox 처럼 page 에 보이는 행만 표본으로 그리고 나머지는 「+N more」.
- **연결 칸이 없던 컴포넌트**: CardView · SelectBoxGroup · 팔레트 Menu 의 Design 패널에 Collection › Data source 칸이 없어 연결할 길이 없었다. 이제 칸이 있다 (Menu 는 놓은 instance 에 저장되고 행이 Popover 안 Menu 로 간다).
- **100 행을 넘는 목록**: Preview · Publish 가 연결된 목록의 처음 100 행만 그려, mock 250 행 목록은 끝이 없었고 원격 목록이 다음 페이지로 받은 101 번째 행도 보이지 않았다. 이제 목록 끝이 보이면 다음 100 행을 더 보여 주고 (「더 보기」), 다 보였으면 다음 페이지를 받은 뒤 보여 준다. ListBox · GridList · Tree · Menu · CardView 가 해당한다 — 다시 읽기 · 검색 · 정렬은 처음 100 행으로 돌아간다. (높이를 고정한 연결 Table 은 높이만큼만 그리는 별도 경로 — ADR-310 Phase 4.)
- **항목 ID 가 겹치는 편집**: 같은 목록 · 그룹의 다른 항목이 이미 쓰는 ID 로 고치면 RAC 가 두 항목을 하나로 다뤄 선택이 틀렸다. 이제 그 편집은 거절되고 이유를 알린다. 그룹 안 Radio · Checkbox 의 `value` 를 고치면 그룹의 값도 같이 바뀐다 (전에는 선택이 풀렸다).

### Changed

- **항목 type 목록 하나** (`collectionItems.ts` `COLLECTION_TYPE_TABLE`): 다섯 곳에 손으로 적혀 서로 달랐던 목록 (항목 추가 · 선택 소유 · 행 반복 · Code 보기 · 부품) 을 표 하나에서 계산한다. 정적 게이트가 catalog 의 모든 collection 이 표에 있거나 사유 있는 제외인지 본다 (SideNav 는 연결 계약이 없어 제외로 보고).

## [번들 상한 만료 연장 — 2026-12-25] - 2026-11-15

### Changed

- **ADR-201 initial 번들 상한 만료 2026-11-25 → 2026-12-25** (사용자 연장 승인). 상한 값은 그대로다 (Builder ≤ 1,414,000 · Preview ≤ 327,000 B gzip). ADR-306 설계 재대조에서 Chart 36종 Phase 2 (상한 갱신 시점) 가 11-25 뒤로 예상됐고, 판정기 (`adr201-bundle-gate.mjs`) 는 만료 뒤 값과 무관하게 실패한다. ADR-306 본문 · breakdown 의 낡은 코드 사실 (contract 번호 · Canvas 로드 지점 · 인용 라인) 도 같은 날 고쳤다 (`6a2a03546`).

## [작성값이 사라지던 부품 — Tree 행 · 자식 있는 FileTrigger · OverlayArrow · SheetBackdrop · ColorThumb] - 2026-11-14

### Fixed

- **Tree 안 TreeItem**: 행에 작성한 padding · gap 이 Canvas 와 Preview 모두에서 사라졌다. Preview 의 행 (`div[role=row]`) 은 작성값을 받지 않았고, Canvas 는 TreeItem 을 「행 + 하위 항목」 묶음으로 그리며 padding 을 0 으로 덮었다. 이제 작성값은 Preview 의 행과 Canvas 의 행 상자 (TreeItemContent) 에 같이 들어가고, Styles 패널도 행의 값을 보인다. 작성하지 않은 시트 값 (padding · 폭 · display) 은 행 inline 에 싣지 않는다.
- **자식이 있는 FileTrigger**: RAC FileTrigger 는 자기 요소 없이 자식만 그리는데, Canvas 는 FileTrigger 의 버튼 상자를 자식 둘레에 그렸다. 이제 자식이 있으면 Canvas 도 상자 없이 자식을 부모 흐름에 놓고, 패널 · 간격 손잡이는 「요소 없음」 안내를 낸다 (자식이 없으면 지금처럼 버튼).
- **OverlayArrow · SheetBackdrop**: 페이지에서 열린 overlay 의 화살표에 작성한 크기, Sheet 배경막에 작성한 위치를 Canvas 가 덮었다 (Preview 는 RAC 기본 style 뒤에 작성값을 둬서 작성값이 이겼다). 이제 Canvas 도 작성값이 이기고, 배경막은 RAC 처럼 네 변 inset 0 으로 늘어나 작성한 inset 만큼 줄어든다. 화살표 위치는 두 화면 모두 RAC 가 정한다.
  - **Why**: Canvas 의 overlay 부품 배치가 작성값 위에 덮어쓰였다. Popover 위치 · SheetOverlay 크기 · SheetContent 크기는 Preview 에서도 RAC 가 이겨 (Popover 는 렌더 뒤 요소에 위치를 직접 쓴다, Sheet 본체는 overlay 크기와 무관하게 화면 기준) 지금처럼 두었다.
- **ColorThumb**: 작성한 margin 을 Canvas 가 중앙 정렬 margin 으로 덮었다. 이제 Preview 처럼 중앙 정렬 위에 작성 margin 을 더한다.
- **instance 안 부품에 쓴 px 크기**: 놓은 원본의 부품 자리에 쓴 폭 · 높이를 「작성값」 판정이 읽지 않아, 작성값이 이겨야 할 Canvas 배치 (진행 막대 채움 · Tree chevron · SideNav 행 부품 · 위 overlay 부품) 에서 무시됐다.

## [작성값이 한쪽에만 보이던 부품 3종 — PreviewTrigger Button · Slider thumb · SideNav section] - 2026-11-14

### Fixed

- **PreviewTrigger 안 Button**: Preview · Publish 에서 Button 에 작성한 style 이 전부 사라졌다 (Canvas 는 그렸다). RAC `PreviewTrigger` 가 long press 방지 값을 trigger 에 inline style 로 주고, RAC Button 이 그 값으로 작성 style 을 통째로 덮었다. 이제 그 방지 값은 시트 (`[data-preview-trigger]`) 가 주고 작성 style 은 남는다.
- **Slider thumb**: Canvas 가 작성한 폭을 무시하고 높이로 정사각을 그렸고, Preview 는 작성한 테두리 두께를 지웠다. 이제 두 화면 모두 작성한 폭 · 테두리를 쓴다 (작성하지 않으면 지금처럼 규칙의 원 · 시트의 테두리).
- **SideNav 의 둘째 section 부터**: 작성한 위 여백을 Canvas 가 무시하고 S2 기본 24 를 그렸다. 이제 px 로 작성한 여백은 Canvas 에서도 같은 거리다.

## [컴포넌트 일러스트 경로 정리] - 2026-11-14

### Changed

- **디자인 산출물을 `docs/design/component-illustrations/`로 이동**:
  - 루트 `design/` 생성 금지 규칙에 맞춰 SVG 90종·미리보기·소스·ZIP을 한 주제 폴더에 모았다. 그림 내용은 유지했다.
  - 생성 스크립트의 저장소 기준 경로와 안내 문서를 수정하고 문서 인덱스에 연결했다. 생성 시 ZIP도 갱신하며 검증 시 원본과 압축 파일의 목록·내용 일치를 확인한다.
  - `docs/design/`의 다른 로컬 시안은 Git 제외를 유지하고 이 SVG 패키지만 추적하도록 예외를 추가했다.

## [Components 패널 90종 SVG 일러스트] - 2026-11-14

### Added

- **투명 배경의 300×300 무채색 컴포넌트 일러스트 90종**:
  - Chart 7종과 Layout 전용 Slot을 포함한 현재 Components 팔레트 대응 에셋, 흰색·검은색 배경 미리보기, 등록 목록 manifest와 재생성·검증 스크립트를 추가했다.
  - DateField·TimeField 구분자 중심 정렬, DatePicker 입력폼·달력 너비 일치, DateRangePicker의 두 배 너비·2개월 연속 선택을 표현했다.
  - 위치: `design/component-illustrations/`. 독립 디자인 에셋이며 Builder 런타임 연결은 포함하지 않는다.

## [S2 대응 없는 컴포넌트를 가까운 S2 패턴 값으로 — Toolbar · Pagination · Nav] - 2026-11-14

### Added

- Toolbar 에 S2 `ActionButtonGroup` 의 묶음 축 `density` · `isQuiet` · `isJustified` · `staticColor` · `isDisabled` 를 추가했다 (RAC Toolbar 에 없는 composition 확장). 값은 안의 ActionButton 에 Canvas · Preview 모두 내려가고, compact 는 간격 2px 에 버튼 모서리가 이어진다.
- Nav 에 `selectedRoute` 를 추가했다 (S2 SideNav 의 prop). 그 경로를 `href` 로 가진 Link 가 현재 항목이다 — Preview 는 RAC `aria-current="page"`, 두 화면 모두 굵기 700. 비우면 SideNav 처럼 지금 보이는 페이지의 경로를 쓴다.

### Changed

- Toolbar 의 기본 자식이 Button 3개에서 ActionButton 3개로 바뀌었고, 구분선의 1×20 작성 크기를 지워 S2 Divider 처럼 줄 높이만큼 선다. 구조 계약 버전을 66 으로 올렸다 (이전 계약의 문서는 기존 정책대로 로드를 거부한다).
- Pagination 의 기본 구조가 Button 5개에서 `이전 (quiet ActionButton) + page 번호 ToggleButtonGroup + 다음 (quiet ActionButton)` 으로 바뀌었다. 현재 page 는 그 그룹의 선택이고 (단일 선택 · 빈 선택 없음), 선택된 page 만 S2 선택 칠로 채워진다. Pagination 의 크기는 다섯 버튼에 내려가 모서리가 크기를 따른다 (S 7 · M 8 · L 9 · XL 10).
- PreviewTrigger 본체에 적혀 있던 폭 240px 을 지웠다. 이제 다른 Popover 처럼 크기별 S2 폭 (S 336 · M 416 · L 576) 을 쓴다.
- Toolbar · Pagination 의 묶음 값을 S2 `ActionButtonGroup` 과 같게 했다. 크기는 XS ~ XL 5단, 간격은 XS · S 4px · M ~ XL 8px 이고 묶음 자신의 padding · 모서리 · focus ring · disabled 칠을 지웠다. 묶음의 크기는 안의 ActionButton 에 내려간다. Toolbar 는 안의 ToggleButton 폭을 32px 로 고정하지 않는다.
- Pagination 은 옛 렌더러의 `.pagination-*` 규칙과 `--btn-*` 변수를 지웠다. 그 변수는 Preview 에서만 안의 버튼 글자 크기를 덮고 있었다. 상자가 버튼 줄만큼이라 `space-between` 도 없다.
- Nav 는 칠하지 않는 컨테이너다. 바탕 · 고정 높이 (48 / 56 / 64) · padding · 상태 칠을 지웠고, 가로 줄 배치는 DOM inline 이 아니라 rule 이 갖는다. 높이 · 여백 · 바탕은 Layout · Style 탭에서 준다.
- Nav 의 기본 Link 는 S2 standalone · quiet · secondary 다 (밑줄 없는 중간 굵기의 무채색 링크). Nav 의 크기는 안의 Link 에 내려간다.

### Fixed

- FileUpload 의 업로드 진행 막대에 S2 가 지운 `variant` 를 넘기지 않는다.

## [Tabs를 S2 구조·스타일·프로퍼티로 정렬] - 2026-11-14

### Changed

- 기본 노드 구조를 `Tabs > TabList + TabPanel…`로 바꾸고 `TabPanels` 래퍼를 제거했다. 탭 추가 시 패널도 Tabs 바로 아래에 생성하며 선택·Undo/Redo·저장 복원에서 같은 구조를 유지한다. 구조 계약 버전은 65이며 이전 계약의 문서는 기존 정책대로 로드를 거부한다.
- 새 Tabs는 `{id, title, content}` 항목 목록 하나로 Tab과 TabPanel을 함께 반복한다. Properties에서 제목·본문·추가·삭제를 편집하고, Tabs/TabList의 `+`도 같은 목록에 항목을 추가한다. 안정적인 id로 정렬 후 선택을 유지하며, 빈 목록·재추가·Undo/Redo·저장 복원과 Data Collection 행 갱신을 지원한다. Preview는 `TabList items`와 `Collection`을 사용한다.
- S2에 없는 Size 필드를 숨기고 density, orientation, labelBehavior, keyboardActivation, disabledKeys를 연결했다. 라벨 숨김에서도 접근 가능한 이름을 유지한다.
- 14px/400 글꼴, compact/regular 높이 32/48px, 탭 간격 24/32px, 세로 목록 여백, 패널 여백 4px 및 패딩 0을 적용했다. 선택 표시는 neutral 색상 2px이며 비활성 색상까지 Preview와 Canvas가 같은 catalog 규칙을 읽는다.

### Fixed

- 세로 Tabs에서 드러난 엔진 회귀를 수정했다. auto 폭 flex 항목의 재배치에서 여백을 두 번 차감하지 않으며, min-height로 확정한 높이를 absolute 자식의 백분율 크기에도 전달한다.
- 동적 항목 편집 직후 Layers의 제목·본문·개수가 갱신되지 않던 구독 누락과, 비선택 TabPanel을 샘플링에서 빠진 행으로 오인하여 Canvas에 `+N more`를 그리던 문제를 수정했다.

## [Separator를 S2 Divider 구조·스타일로 정렬] - 2026-11-14

### Changed

- Separator는 S2와 같은 자식 없는 RAC Separator 한 개로 렌더하며, 여백 0 · 둥근 끝 · S/M/L 두께 1/2/4px · 가로/세로 길이축 stretch를 적용한다. S/M은 gray-200, L은 gray-800이며 흰색/검정 staticColor는 각각 0.14/0.85 불투명도를 사용한다. Toolbar의 별도 두께·색상·여백 덮어쓰기도 제거했다.
- 공용 catalog paint의 size 조건을 Canvas에도 전달하고, Separator DOM이 기본 variant 스타일을 읽도록 연결했다. 크기·staticColor 색상 분기는 catalog 규칙 하나에서 생성 CSS와 Canvas가 함께 읽는다.
- 설치된 S2 Divider와 Preview DOM·Canvas의 36개 조합(밝음/어두움 × 가로/세로 × S/M/L × 기본/흰색/검정)을 브라우저에서 대조한다.

## [Navigator Layers 아이콘 더블클릭으로 대상 확대] - 2026-11-14

### Added

- Layers 트리의 노드 아이콘을 더블클릭하면 해당 대상 하나를 선택하고 Canvas의 기존 `Zoom to selection` 명령으로 화면에 맞춰 중앙에 표시한다. 내부 노드는 기존 Layers 선택 경로를 통해 편집 컨텍스트에 진입하며, 이름과 펼침 버튼의 더블클릭은 확대를 실행하지 않는다.

## [Navigator Layers 아이콘 분리 — 펼침 · 종류 · 이름] - 2026-11-14

### Changed

- Origin/Instance 상태 표시를 노드 아이콘 오른쪽 아래에서 오른쪽 위로 이동했다.
- **Input은 `keyboard`, TimeField는 `clock-2` 아이콘으로 변경**: TimeField의 catalog 팔레트 메타를 변경해 Components 패널과 Layers가 동일한 아이콘을 사용한다.
- **Description·FieldError 내부 노드 아이콘을 `rectangle-ellipsis`로 변경**해 일반 Text의 T 아이콘과 구분한다. 위치: `panels/navigator/catalog/CatalogLayerIcon.tsx`.
- **Layers 행을 펼침/접힘 버튼 → 노드·컴포넌트 아이콘 → 이름 순서로 표시**: 자식이 있는 행도 종류 아이콘을 항상 표시하고, 말단 행은 펼침 칸을 비워 정렬한다. 아이콘은 Components 팔레트와 같은 catalog 메타를 사용하며 Origin/Instance 표시는 아이콘 칸에 겹쳐 표시한다.
  - 위치: `apps/builder/src/builder/panels/navigator/catalog/CatalogLayerItem.tsx`, `apps/builder/src/builder/panels/navigator/NavigatorPanel.css`.
- **Figma 레이어 구분을 참고해 컴포넌트와 내부 노드 아이콘을 분리**: 컴포넌트는 Components 팔레트의 실제 아이콘을 재사용한다. 내부 일반 노드는 프레임(#)·그룹(모서리)·텍스트(T)·입력·벡터·이미지·선·도형의 단순한 전용 glyph를 사용하고, 중첩 컴포넌트 인스턴스는 컴포넌트 아이콘을 유지한다.
  - **Why**: 타입 이름만으로 팔레트 아이콘을 조회하면 내부 Text/Button 등의 조각도 독립 컴포넌트처럼 보였다. 트리 생성 중 컴포넌트 조상 여부를 전달하여 template뿐 아니라 소유된 slot 내용도 구분한다.
  - Chart는 7종 팔레트의 실제 `chartType` 아이콘을 공유하고 종류 변경 시 해당 prop 구독으로 갱신한다.
  - 위치: `catalogRuntime/layerTree.ts`, `panels/navigator/catalog/CatalogLayerIcon.tsx` 및 인접 테스트.

## [Breadcrumbs 를 S2 구조 · 스타일로 — 구분자 Icon 편집은 유지] - 2026-11-13

### Changed

- **Breadcrumbs 조각이 RAC 예제 구조 (`Breadcrumb > Link{label} + Icon`) 에서 S2 `Breadcrumb` 구조로 바뀌었다**: 노드는 `Breadcrumb{href} > Text{label} + Icon[slot=separator]` — `href` 는 S2 처럼 조각의 prop, 내용은 Text 노드. DOM 은 S2 그대로 현재가 아닌 조각이면 내용을 RAC `Link` (`.breadcrumb-link`, 조각의 href) 로 감싸고 구분자를 잇고, 현재 조각은 링크 없이 `div.breadcrumb-current` 다 (전에는 현재 조각도 `span role=link aria-disabled`). 구분자는 여전히 편집 가능한 Icon 노드다 — 아이콘 · 크기를 바꾸면 Canvas · Preview 가 같이 바뀐다.
  - S2 값: 구분자 기본 = S2 `ChevronIcon size="M"` (`s2-chevron`, 크기와 관계없이 10 · `neutral`), 내용 ↔ 구분자 = `text-to-visual` (6/14 em — M 6), 조각 사이 = S2 `size(6)` · `size(9)` (M 6 · L 9 · S 4), 링크 = `neutral-subdued` 이고 hover · focus 때 밑줄만 (색 유지), 현재 조각 = `neutral` 700 (전에는 accent), focus = 링크 outline (`--focus-ring` 2 · offset 2, 전에는 accent `::after` 테두리).
  - 위치: `reusableOriginLibrary.ts` (`component-breadcrumb-item-default` · `__label` · `__separator`) · `delegatedDom.runtime.ts` `breadcrumb` · `components/Breadcrumb.tsx` · `Breadcrumbs.css` · `componentRulesTable.ts` `Breadcrumb` · `Breadcrumbs` · `manualBoxRules.ts` · `boxModel.ts` `catalogTextMetrics` · `spectrumIcons.ts` `s2-chevron`. 작성자가 조각 안에 Link 노드를 둔 경우 그 Link 가 조각의 링크다 (링크 안 링크 없음).
  - S2 와 다르게 둔 것 (아래 「S2 차이 마무리」 에서 넘침 접기 · `marginStart` · 터치 크기 · 비활성 색을 S2 대로 바꿨다): 폴더 칸 뒤 구분자는 S2 Chevron (L 12) 대신 첫 조각의 구분자 Icon 을 따른다 — 구분자 편집을 유지하기 위해.
  - Live (새 프로젝트 breadcrumbs-s2-verify, Mobile 390, Compare): Preview `a.breadcrumb-link` ×2 + `div.breadcrumb-current` (700 · #292929), 링크 #505050, gap 6, chevron 10 × 10. Canvas 상자 = DOM 상자 (조각 x 0 · 59.24 · 140.23, 폭 53.24 · 74.99 · 33.72, chevron x 43.24 · 124.23). 첫 구분자를 Icon 칸에서 `slash` 로 바꾸면 Canvas · DOM 둘 다 `slash` · 나머지 `s2-chevron`. hover = 밑줄만. console error 0.
  - 테스트: `adr256BreadcrumbsNodeTree` 가 S2 구조 (현재 = div · 링크 없음) 를 대조 (원복 상태에서 RED 3) · `oneSidedProps` · `phase3Presence` · `componentRulesTable.static` 기대값을 S2 값으로 갱신.
- **S2 차이 마무리 — 넘침 접기 · 앞 여백 · 터치 크기 · 비활성 색, 그리고 현재 조각 굵기 버그**:
  - 넘침 접기 (S2 `CollapsingCollection`): 조각이 목록 폭에 들어가지 않거나 4 개를 넘으면 첫 조각 · 폴더 메뉴 · 끝 조각 1 ~ 2 개만 보인다. 판정은 공용 함수 하나 (`catalog/runtime/breadcrumbsCollapse.ts` — S2 `useCollectionRender` 그대로) 를 Canvas (`compositionRoot.ts` `settleBreadcrumbs` — 배치 뒤 펼쳐 재고 접기, TagGroup `maxRows` 와 같은 방식) 와 DOM (`delegatedDom.components.tsx` `BreadcrumbsRun` — 모두 그려 paint 전에 재고 접기, 폭이 바뀌면 다시 잼) 이 같이 읽는다. 폴더 칸 = RAC `Breadcrumb` 항목 안 `MenuTrigger` · quiet ActionButton (생성 ActionButton 시트, 32 정사각 · S2 폴더 아이콘 `s2-folder-breadcrumb`) + 첫 조각의 구분자, 칸 전체를 목록 간격만큼 당김 (S2 `size(-6)`). 메뉴 = 접힌 조각들의 `MenuItem` (조각 href 링크).
  - 앞 여백: S2 wrapper `marginStart` (M 6 · L 9 · S 4) — `Breadcrumbs` `containerVariants.size` 로 생성 CSS 와 Canvas 가 같이 읽고 DOM 은 기기 길이 (터치 7.5 · 11.25).
  - 터치 크기: 구분자 chevron 이 S2 `10 × --s2-scale` (터치 12.5) — part rule `iconSize` 가 길이 토큰을 받는다 (`codeCatalogLibrary.ts`). Canvas 는 늘 desktop 10.
  - 비활성: opacity 0.38 대신 S2 `disabled` 색 (`{color.disabled-content}`) — 링크 조각의 글자만, 현재 조각은 `neutral` 그대로 (`presence.ts` `_crumbDisabled` → `catalogTextMetrics`, Canvas · DOM 공용).
  - 버그: 편집 한 번 뒤 현재 조각 글자가 굵게 · neutral 이 아니라 보통 · `neutral-subdued` 로 돌아갔다 — 조각 label 판정이 record 객체 동일성 (`includes(node)`) 이라 증분 재해석의 새 객체를 놓쳤다 (id 비교로).
  - Live (breadcrumbs-s2-verify, Mobile, Compare): 폭 150 → Canvas · DOM 모두 Home · 폴더 · Page (DOM x 6 · 59.24 · 107.24, 폴더 칸 42 × 32), wipe 가 폴더 아이콘을 가로질러도 이어짐, 폴더 클릭 → 메뉴 (폭 99, Category `/category`), 폭 300 → 새로고침 없이 다시 펼침. Disabled → 링크 #c6c6c6 · 현재 #292929 700 (Canvas 같음). 터치 보기 → 앞 여백 7.5 · 간격 7.5 · chevron 12.5. console error 0.
  - 테스트: `adr256BreadcrumbsNodeTree` 에 현재 조각 (편집 뒤 — 원복 RED) · 비활성 · 앞 여백 · chevron 기기 길이 · 접기 (맞음 · Canvas 5 조각 · 좁은 폭 · DOM) 8 개 추가.
- **Breadcrumbs 에서 구분자 · 폴더 아이콘을 바꾼다 (사용자 결정)**: Breadcrumbs 에 `Separator icon` · `Menu icon` 칸 (S2 · v3 에 없는 composition 확장 — `d2Provenance.ts`).
  - Separator icon (`separatorIcon`, 기본 `s2-chevron`): 모든 조각의 구분자 Icon 이 따른다. 조각에서 직접 바꾼 구분자 (기본 chevron 이 아닌 값) 는 그 조각만 자기 값을 유지한다. 두 consumer 가 같은 파생값 (`presence.ts` `_ownerIconName`) 을 읽는다 — Tree chevron 회전에 쓰는 Canvas 전용 파생 `iconName` 과 섞지 않기 위해 키를 따로 뒀다.
  - Menu icon (`menuIcon`, 기본 S2 FolderBreadcrumb): 넘침 접기의 폴더 버튼 아이콘 — Canvas `settleBreadcrumbs` · DOM `BreadcrumbsRun` 이 같이 읽는다.
  - Live (breadcrumbs-s2-verify, Compare): Separator icon = `chevrons-right` → 직접 slash 로 바꿔 둔 첫 조각은 slash, 나머지는 » (Canvas · DOM 같음). Menu icon = `ellipsis` + 폭 150 → 둘 다 Home / ••• / Page. console error 0.
  - 테스트: Breadcrumbs 값이 모든 조각에 · 직접 바꾼 조각은 유지 · menuIcon (Canvas) 3 개.
- **버그: 다른 요소를 편집하면 Canvas 의 폴더 상자가 사라졌다 (사용자 보고)** — 화면 크기를 바꾸면 (전체 다시 묶기) 다시 나타났다. 원인: 같은 영역에 요소를 넣거나 지우면 Canvas 가 그 영역의 자식 목록을 record 자식으로만 다시 만들고, 이전 자식 중 record 가 아닌 것을 등록 해제했다 — 접기가 둔 합성 상자 (Breadcrumbs 폴더 · TagGroup Show all) 가 그렇게 지워졌다. 이제 구조 재조정이 합성 상자를 자식 목록에 남기고 지우지 않는다 (`canvasBinding.ts`). Breadcrumbs 를 지우면 그 접기 기록도 지운다 (`compositionRoot.ts` — 낡은 폴더 상자 방지). Live: 접힌 Breadcrumbs 옆에 Text 추가 · 삭제 → 폴더 유지. 테스트 2 (둘 다 원복 RED).

## [NumberField 를 S2 구조 · 스타일로 — 상자 안 증감 버튼] - 2026-11-13

### Changed

- **NumberField 가 RAC 예제 모양 (입력칸 옆에 붙은 높이 정사각 −·+ 버튼) 에서 S2 `NumberField` 모양으로 바뀌었다**: control Group 이 늘 필드 상자 (S2 `FieldGroup` — 테두리 2 · 크기별 모서리 · focus-within) 이고, 증감 버튼은 그 안의 S2 `inputButton` 정사각 (S 16 · M 20 · L 24 · XL 32, 모서리 4, gray-100 바탕, 테두리 없음) 이다. 값 뒤 `text-to-control` (글자의 10/14), 버튼 사이 S2 간격 (S 8 · M 4 · L 8 · XL 8), 끝 여백 (S 2 · M 4 · L 6 · XL 6). 글리프는 S2 UI 아이콘 크기 (XS · S 8 · M 10 · L · XL 12). `hideStepper` 면 입력칸 끝 여백이 S2 `edge-to-text` 로 돌아온다. 노드 구조 (`NumberField > Label + Group(Input + Button[decrement] + Button[increment]) + Description + FieldError`) 와 RAC DOM 은 그대로다.
  - 위치: `fieldPrefix.ts` `CATALOG_BOXED_FIELDS` (prefix 없이도 Group 이 상자 — 기존 prefix 상자 경로를 두 consumer 가 같이 읽음) · `catalogFieldBoxStyle` · `catalogFieldBoxInputEnd` · NumberField rule delegation (버튼 정사각) · Button 정의의 증감 slot 글리프 part rule (`codeCatalogLibrary.ts`) · template 증감 모서리 4. 옛 stepper 덮어쓰기 (`catalogFieldBoxStepper*`) 삭제. 간격은 아래 Added 의 Group · Input layout 값.
  - S2 와 다르게 둔 것: 증감 모서리는 크기 무관 4 (S2 `controlBorderRadius('sm')` 은 L · XL 5 — ComboBox 버튼과 같은 template 값), hover 칠은 secondary Button 의 gray-200 (S2 stepper 는 바탕을 바꾸지 않고 눌림 축소만).
  - Live (새 프로젝트 nf-s2-verify, Mobile 390): Canvas M · XL · hideStepper 모양 확인. Publish M — 상자 32 · 테두리 2 · 모서리 8, 버튼 20 × 20 · y 6 · 간격 10 / 4 / 4 · 글리프 10, 입력 시작 14 (간격은 당시 버튼 margin — 같은 날 Group gap · padding 으로 옮김). Publish XL + hideStepper — 상자 48, 입력 시작 · 끝 여백 18.
  - 테스트: `adr253FieldPartsDom` · `adr259FieldPrefix` · `adr256FieldControlGroup` · `s2ButtonPill` · `phase4e11PreviewFollow` · `phase4eOriginView` 기대값을 S2 값으로 갱신.

### Added

- **NumberField · Meter · ProgressBar · Slider 의 Format 에 S2 (Intl) 항목 추가** (사용자 보고 「S2 의 프로퍼티 Format options 항목들 누락」): 유효 자릿수 (최소 · 최대), 반올림 방식 · 우선 · 단위 (`roundingMode` · `roundingPriority` · `roundingIncrement`), 끝자리 0 (`trailingZeroDisplay`), 자릿수 구분 Auto · Always · Min 2 · Off (`useGrouping` — 전에는 켬/끔), 부호 Negative. 자릿수 · 반올림 · 부호 · 구분 칸은 Format 이 Default 일 때도 보이고, Default 에서 고치면 `style: "decimal"` 을 함께 써서 Format 칸에 드러난다 (Meter · ProgressBar 의 Default 는 percent 라 몰래 바뀌지 않게). 반올림 단위를 고르면 Intl 규칙대로 최소 · 최대 소수 자릿수를 같게 맞춘다.
  - 넣지 않은 것: `notation` · `compactDisplay` — RAC NumberField 의 `NumberParser` 가 compact · scientific 글자를 되읽지 못한다 (나머지 키는 파서가 처리한다 — 기호를 만들 때 유효 자릿수 · 반올림을 초기화).
  - 위치: `numberFormatValue.ts` (값 검사) · `types.ts` `NumberFormatValue` · `NumberFormatField.tsx` · i18n `labels.ts` · `en-US` · `ko-KR`. 테스트: `s2FormatOptions` — 값 검사 (새 키 통과 · 잘못된 조합 거절) 와 Canvas 글자 = RAC 글자 대조에 새 키 3 조합.

- **NumberField 의 Group (S2 상자) 을 Design 패널에서 직접 편집** (사용자 보고 「group 의 design 패널 layout 탭 편집 지원 안 됨」): 전에는 「Edited from the parent」 안내만 냈다 (ADR-256 Phase 6b — field 의 control Group 은 부모 소유). NumberField 의 Group 은 이제 보이는 상자 자체라 자기 style 을 가진다 (`ownsSubpartDirect` 가 `CATALOG_BOXED_FIELDS` 를 뺀다). ComboBox · DatePicker 등 다른 field 의 Group 은 그대로 부모 소유.
  - Why (같이 고친 비대칭): Canvas 는 상자 레이아웃 (`fieldBoxLayout`) 을 작성 값 **뒤**에 덮어 Group 에 쓴 padding · height 가 무시됐고, DOM 은 작성 값을 상자 값 뒤에 써 이겼다. 이제 Canvas 도 작성한 키는 상자 기본값을 내지 않는다. 패널 실효값도 상자 기본값 (padding · height · border) 을 읽는다 — 전에는 Padding 0 · Height auto 로 보였다 (실제 XL 18 · 48).
  - **S2 간격을 자식 margin 이 아니라 객체의 layout 값으로** (사용자 보고 「right padding · gap 이 적용 · 일치하지 않음 — 자식 input · button 을 객체로 인식하지 않는 것인가」): 처음 구현은 − 앞 10 · + 앞 4 · + 뒤 4 를 버튼 margin (NumberField rule delegation) 으로 줘서, Group 의 right padding 0 · gap 0 으로 보이고 고쳐도 margin 이 따로 남았다. 이제 Group gap = S2 stepper gap (S 8 · M 4 · L 8 · XL 8), Group 끝 padding = S2 끝 여백 (S 2 · M 4 · L 6 · XL 6), Input 끝 padding = `text-to-control` − gap (M 10 − 4 = 6), 버튼 margin 없음 — 같은 화면을 세 객체의 값으로 낸다. Input 에 쓴 padding · border · 폭도 상자 기본값을 이긴다 (Canvas · DOM 둘 다). 위치: `fieldPrefix.ts` `catalogFieldBoxStyle(…, stepped)` · `catalogFieldBoxInputEnd`. 테스트: `adr256FieldControlGroup` 「S2's stepper spacing is the parts' own layout …」 (기본 4 · 4 · 6, 작성 gap 12 · 끝 10 · Input 끝 2 가 Canvas 레이아웃 입력과 DOM inline 에 — Canvas 가 작성 gap 을 무시하게 되돌리면 RED).
  - **Canvas 간격 손잡이도 같은 값** (사용자 보고 「gap 은 4 로 보이지만 −, + 에 hover 한 gap 손잡이는 0 · padding 손잡이도 좌우 0」): 손잡이 · 드래그 시작값은 record 의 box model (작성값뿐 → 0) 을 읽었다. 상자 Group · 그 안 Input 의 기본값은 레이아웃 입력에만 있어서다. 그려진 box model 하나 (`catalogRuntime/drawnBoxModel.ts` `catalogDrawnBoxModel`) 를 Styles 패널 실효값 · 간격 손잡이 (`catalogSpacingBands`) · 드래그 (gesture host `boxModel`) 가 같이 읽는다. 테스트: `adr256FieldControlGroup` 「the drawn box model …」 (md 시작 12 · 끝 4 · gap 4 · border 2, Input 끝 6, 손잡이 값 12 · 4 · 4).
  - Live (nf-s2-verify, Mobile): Layout 탭 열림, 표시값 Padding 왼쪽 18 · 나머지 0 · Height 48 (XL), 가로 padding 30 → Canvas 양쪽 30. (간격을 layout 값으로 옮긴 뒤 · 손잡이 수정은 live 미확인 — 브라우저를 사용자가 쓰는 중.) 이 쓰기는 Mobile 층 (`responsive.mobile`) 이라 데스크톱 폭 Publish 는 base 값 — base 쓰기의 DOM 반영은 테스트로 확인. 테스트: `adr256FieldControlGroup` 「a padding written on the Group reaches the Canvas layout and the DOM box」 · `adr253FieldPartsDom` 소유자 단언 갱신.

### Fixed

- **NumberField 증감 버튼마다 Icon 이 둘이던 것** (사용자 보고 「up, down 버튼 내에 icon 이 왜 두 개씩」): 이제 버튼당 Icon 하나 (− · +).
  - Why: Button 원본은 `Button > Icon{icon} + Text{label}` (ADR-276) 인데, NumberField template 의 증감 자리는 `icon` prop 을 채우지 않고 minus · plus Icon 자식을 따로 덧붙였다 — 원본의 빈 `{icon}` Icon (숨김) 과 덧붙인 Icon 이 Layers 에 같이 보였다. ComboBox 버튼처럼 `icon: "minus"` · `"plus"` 로 채우고 덧붙인 노드를 지웠다. 위치: `reusableOriginLibrary.ts` (`component-numberfield__2_2` · `__2_3`).
  - Live (nf-s2-verify, XL): Layers 에서 Button > Icon 하나씩, Publish 버튼마다 `.react-aria-Icon` 1 · svg 1 (12 × 12), + 누르면 값 0 (min). 테스트: `adr253FieldPartsDom` 「its Group holds …」 가 버튼당 Icon 하나 · minus/plus 를 단언 (template 원복 시 2 개로 RED).

- **Styles 패널 값 · Canvas 간격 손잡이가 그려진 값과 다르던 것 — 모든 요소** (사용자 「이 문제가 전체적인 버그 아니었나」 → 「전체 수정」): 패널 실효값과 손잡이는 record 의 box model (작성값 · rule 값) 만 읽어, Canvas 레이아웃이 따로 놓는 값 (part rule 의 border · 묶음의 gap · frame 의 gap longhand · 배치 들여쓰기) 이 0 으로 보였다 — 감사에서 12 가족 (Disclosure · Accordion border 1, CheckboxItems · RadioItems gap 12, Dialog · ActionBar frame gap 8 · 4, ListBoxItem 아이콘 들여쓰기 34, Tree chevron · TreeItem, SideNav 행 …).
  - 1단계 — 표시: `catalogDrawnBoxModel` 이 모든 record 에서 그려진 스타일 (`root.getDrawnLayoutStyle` — page body 는 화면 상자 · 내용 상자로 나뉘기 전 전체 style, 나뉜 화면 상자는 늘 `display: block` · gap 0 이라) 을 읽어 다른 값만 덮는다. flex 는 주축 gap 하나, grid 의 행 · 열 gap 은 record longhand 그대로 (Slider grid 4 · 16).
  - 2단계 — 쓰기가 화면에 닿게: Canvas 가 시트 값으로 덮던 배치 중 DOM 에서 작성 inline 이 이기는 것 — Tree chevron 들여쓰기 (`Tree.css` · DOM `treeChevronSheetBox`) · ListBox 항목 아이콘 들여쓰기 (`ListBox.css` `:has([slot=icon])`) — 은 Canvas 도 문서가 쓴 키를 내지 않는다 (`compositionRoot.ts` `withoutAuthored` — 판정은 문서 쓰기 (`catalogHasExplicitVisual` · breakpoint 층), `catalogAuthoredVisual` 은 Tree rule 의 part rule 값을 작성값으로 읽어 chevron 높이를 지웠다).
  - 남긴 것: SideNav 행 (`SideNavItemContent`) 은 RAC `NavigationTreeItemContent` 라 DOM 요소가 없어 작성 padding 이 DOM 에 닿지 않는다 — Canvas 만 따르면 새 비대칭이라 그대로 둔다 (패널은 그려진 값을 보인다). TreeItem 의 padding 0 (행 상자는 `TreeItemContent`) 도 구조라 그대로.
  - 테스트: `drawnBoxModel.test.ts` — Disclosure border 1 · CheckboxItems gap 12 · page body padding 24 · display flex · gap 20 (`getLayoutInput` 으로 되돌리면 RED) · Tree chevron · ListBoxItem 작성 padding 30 (덮어쓰기로 되돌리면 RED). Live 미확인 (브라우저를 사용자가 쓰는 중).

- **ComboBox · DatePicker 의 Group Layout 탭을 쓸 수 없던 것** (사용자 보고 「combobox - group, datepicker - group 의 layout 탭 사용 안 됨」): field 의 control Group (ComboBox · DatePicker · DateRangePicker · prefix 를 감싼 TextField · TextArea · ColorField) 이 이제 NumberField 의 Group 처럼 자기 style 을 편집한다.
  - Why: ADR-256 Phase 6b 가 control Group 을 두 축 모두 부모 소유로 두어 (`ownsSubpartDirect`) Design 패널이 「Edited from the parent」 안내만 냈다. DOM 은 이미 Group 의 작성 style 을 inline 으로 쓰고 (`nodeTreeControlGroup`) Canvas 도 record 의 작성값을 그려, 막던 것은 패널의 소유 판정뿐이었다. NumberField 만 예외로 풀었던 것을 모든 control Group 으로 넓혔다. Group 의 Properties 도 자기 것 (role · 상태) 이 된다.
  - 위치: `packages/shared/src/catalog/resolvers/resolveDelegatedChildFontSize.ts` `ownsSubpartDirect`. 테스트: `drawnBoxModel.test.ts` 「a field's control Group is edited directly」 (ComboBox · DatePicker — style 소유자 없음 · 작성 padding 30 이 Canvas 레이아웃 입력과 DOM inline 에. 판정을 되돌리면 RED).

- **Select 의 Button 에 Canvas 간격 overlay 가 뜨지 않던 것** (사용자 보고 「select - button 은 Layout 탭 수치 입력은 반영되지만 값 overlay 가 나타나지 않음」): 간격 손잡이 · 값 overlay 는 구조 컨테이너 (Group · Section · Card · frame …) 에만 떴다 (ADR-222 의 첫 범위). 이제 자식을 흐름에 놓는 모든 상자 — Button (글리프 · 글자) · Select trigger (값 · chevron) · 항목 행 — 에도 뜬다. 자식 없는 잎 (Text · Icon · Input) 은 그대로 없음.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` `spacingOwner`. 테스트: `drawnBoxModel.test.ts` 「a Select's trigger Button」 (padding 손잡이 4 — 구조 컨테이너만으로 되돌리면 RED).

- **DatePicker 입력 끝 padding 0 · SearchField 지우기 버튼의 아이콘 하나로** (사용자 「DatePicker 입력의 오른쪽 padding 도 0, searchField-group-button 안에 icon 이 두 개」): DatePicker 의 DateInput 끝 padding (`--dp-end-pad`) 을 없애 버튼 앞 간격은 상자 gap 하나다. SearchField 지우기 버튼은 Button 원본의 `{icon}` 자리 (빈 채 남음) 옆에 십자 Icon 자식을 따로 두어 아이콘이 둘이었다 — template 이 자식 Icon 대신 버튼의 `icon: "s2-cross"` 로 그 자리를 채운다 (NumberField 증감과 같은 방식).
- **TextField · TextArea · ColorField · DateField · TimeField 도 S2 `FieldGroup` 구조** (사용자 「S2 구조 패턴으로 변경해」): 다섯 field 의 원본이 Input · DateInput 을 늘 상자 Group 으로 감싼다 (`Label + Group(Input) + Description + FieldError` — S2 `TextField.tsx` · `DateField.tsx`). 상자는 Group 이 그리고 (Input rule 의 상자 — DOM `.react-aria-FieldBox` · Canvas `fieldBoxShapeInput`, Design 패널의 radius · 테두리 · 바탕 · 배치도 Group 값), 여백은 S2 `control()` 대로 Group 의 시작 · 끝 `edge-to-text`, 안 Input · DateInput 은 상자를 내려놓고 padding 0. DateField · TimeField 의 크기별 최소 폭은 Group 으로 옮겼다. prefix 를 지워도 Group 은 남고 (전에는 감쌌다 풀었다), prefix 를 넣어도 Label 이 사본이 되지 않아 field 의 `label` 을 계속 따른다. DOM 에서 DateField · TimeField 의 RAC Group context 는 안 DateInput 에만 닿는다 (id · role · 키 처리가 두 요소에 겹치지 않게). 화면 크기 · 위치는 그대로 (TextArea 상자 68 = 옛 Input 높이). 이미 저장된 프로젝트는 마이그레이션하지 않는다 (사용자) — Group 없는 옛 TextField 에 prefix 를 넣을 때 감싸 주던 분기 (`CATALOG_PREFIX_WRAP_FIELDS`) 도 지웠다.
- **DateRangePicker 상자 = DatePicker 와 같은 S2 `FieldGroup`** (사용자 「DateRangePicker 를 DatePicker 와 같은 방식으로 · margin 은 완료된 패턴을 참고」): range Group 을 공용 field 상자 (`CATALOG_BOXED_FIELDS`) 로 옮겼다 — 상자는 Input rule 이 그리고 (DOM `.react-aria-FieldBox` · Canvas `fieldBoxShapeInput`), 시작 padding `edge-to-text` · 끝 4 (S2) · gap = 날짜 gap 은 Group 의 layout 기본값 (Design 패널 Layout · Style 탭에 Group 값으로 보인다). 두 DateInput 은 상자를 내려놓고 (template 의 투명 · 테두리 0 · 여백 0 작성값 삭제) 시작 입력은 내용 폭 · 끝 입력이 남는 폭, 끝 입력의 오른쪽 padding (10/14 em − gap) 은 0 — 버튼 앞 간격은 상자 gap 하나 (margin 없음). 지운 것: rule 의 Group bridges (테두리 · 바탕 · 모서리 · 여백 · 최소 높이 · 글자) · DateInput 블록 · end 입력 padding 블록, Canvas 칠 사본 `DATE_RANGE_GROUP_PAINT` 와 DOM 의 그 거르기, template Group `flex row`.
- **Checkbox · Radio · Switch 배치 = S2 field grid** (사용자 「toggle 레이아웃 차이 3개 진행」, 2026-11-15): S2 `Checkbox.tsx` · `Switch.tsx` · `RadioGroup.tsx` 와 대조해 남은 세 가지를 맞췄다. ① Radio 와 그룹 안 Checkbox 의 도움말이 라벨 열 (indicator + `text-to-control`) 에서 시작한다 — 그전에는 indicator 아래. ② 버튼 ↔ 도움말 거리 = 단독 Checkbox · Switch 는 `field 높이 − 줄 높이` (M 14), Radio · 그룹 안 Checkbox 는 1 · 1 · 2 · 2 — 그전에는 모두 `text-to-control` (M 10). ③ indicator 를 라벨 첫 줄에 둔다 (S2 `CenterBaseline` — 버튼 행 위 정렬 + indicator 위 margin `(줄 높이 − indicator) / 2`) — 그전에는 여러 줄 라벨의 가운데. 값은 `packages/shared/src/catalog/rule/toggleLayout.ts` 한 곳 — 생성 sheet 와 Canvas part rule 이 같은 delegation 을 읽고, part rule 이 그룹을 건너 닿지 않는 그룹 안 Checkbox 도움말은 파생 `_toggleItemHelp` 의 length ref 를 Canvas `styleOf` (px) · DOM inline (기기 식 — 터치 기기에서 같이 커진다) 이 같이 읽는다. 이어서 (사용자 「ⓐ ⓑ 도 S2 에 맞춰」) ⓐ Switch 의 위아래 여백 4 를 없앴다 (rule `paddingY` 4 → 0 — ADR-171 이 옛 수동 CSS 에서 옮긴 값, S2 에는 없다). ⓑ 긴 라벨이 field 폭 안에서 줄바꿈된다 (S2 라벨 열 `1fr`) — 그전에는 Label 바인딩의 한 줄 (`nowrap`) 이 toggle 라벨에도 걸려 field 를 넘쳤다 (Canvas · Preview 같이). toggle 원본 template 의 라벨이 `whiteSpace: normal` 이고, Canvas 의 한 줄 판정 (`catalogBindingKeepsOneLine`) 이 표 칸만이 아니라 모든 바인딩에서 record 의 `normal` 을 따른다 (DOM 은 이미 그랬다). indicator 는 긴 라벨 옆에서도 크기를 지킨다 (생성 sheet `flex-shrink: 0` — Canvas part rule 과 같은 값). **엔진 수정**: 세로 flex 안 `align-self` 가 stretch 가 아닌 auto 폭 자식은 CSS 대로 fit-content (내용 폭과 사용 가능한 폭 중 작은 값) 로 배치한다 — 그전에는 내용 폭 (298) 그대로라 버튼이 field 를 넘고 안의 라벨이 줄바꿈되지 않았다 (Chrome 204 · 글자 178, `packages/engine/src/tree.rs` `solve_flex` — max-content 가 넘칠 때만 fit 폭으로 한 번 배치, Rust 테스트 `column_flex_start_item_cross_size_is_fit_content_and_lays_children_at_it`). 테스트: `toggleS2Layout.test.tsx`.
- **staticColor `auto` = S2 방식 (바탕 밝기로 흑 / 백) · 「None」 추가** (사용자 「staticColor auto 를 S2 방식으로」 · 「칠한 단색 바탕도 포함」, 2026-11-14): 그전 `auto` 는 테마 색 (S2 의 「값 없음」) 이었다. 이제 S2 `autoStaticColor` 처럼 놓인 바탕의 LCH 밝기가 49.44 미만이면 흰색, 아니면 검은색 스킴을 쓴다. 바탕 = 가장 가까운 조상의 흑 / 백 static 스킴 · 불투명 단색 칠 (S2 는 컨테이너만 — 사용자 결정으로 포함) · 층 컨테이너 (Card 등) · 없으면 페이지 바탕. 판정은 공용 runtime 한 곳 (`staticBackdrop.ts` → 파생 `staticColor`) 이고 Canvas 칠과 DOM `data-static-color` 가 같은 값을 읽는다. 바탕 칠을 바꾸면 그 아래 auto 노드가 한 step 에 따라온다. 패널 선택지는 None (테마 색 — 새 기본) · Auto · White · Black — Button · ToggleButton · ToggleButtonGroup · ActionButton(Group) · Toolbar · Link · Meter · ProgressBar · ProgressCircle · Separator. 원본 template 의 `staticColor: "auto"` 10 곳을 지웠고, emphasized ActionBar 의 흑 / 백도 같은 LCH 규칙으로 바꿨다 (그전 WCAG 대비). 저장된 옛 `auto` 는 옮기지 않는다 (개발 단계). 테스트: `staticColorAuto.test.tsx`.
- **Canvas: 아이콘 뒤 버튼 글자가 「Acti…」 로 잘리던 문제 수정** (2026-11-14 live 관찰): 원점에서 떨어진 글자 상자의 폭이 float32 계산에서 한 단위 모자라 (x 36 에서 39.97999572, 글자 39.97999954) 말줄임이 붙었다 — 아이콘 + 글자 ActionButton 에서 늘 났다. 말줄임 판정에 Blink 레이아웃 단위 (1/64 px) 만큼의 허용 오차를 둔다 (`textParagraphKey.ts` `textNeedsEllipsis`). 테스트: `textParagraphKey.test.ts` (허용 오차를 빼면 RED).
- **ActionButton 에 Avatar · Badge (S2) + Badge `value`** (사용자 「avatar, badge 는 왜 빠졌지 — 추가하고 Badge 에 value」, 2026-11-14): S2 문서 예제의 `<ActionButton><Avatar/><Text/><NotificationBadge value/></ActionButton>` 을 따라 ActionButton 원본에 Avatar (이미지 URL) · Badge (숫자) 칸을 두었다 — 비어 있으면 그리지 않는다 (Canvas · DOM 같은 판정 `catalogActionButtonPartAbsent`). S2 NotificationBadge 는 새 컴포넌트 대신 Badge 의 `value` 로 받는다 (`isDot` 과 같은 composition 축) — 양의 정수, 99 초과는 `99+`, 한 자리는 정사각형 · 두 자리 이상은 좌우 `edge-to-text` (`data-notification`). 버튼 안에서 Badge 는 S2 크기 (S 12 · M 14 · L 16 · XL 18, 글자 ui-xs · ui-sm · ui) 이고 아이콘 · Avatar 오른쪽 위 모서리에, 글자만 있으면 버튼 오른쪽 위 모서리에 놓인다 (`rule/actionBadge.ts` 한 표를 생성 CSS · Canvas part rule · 위치 계산이 읽는다). Avatar 는 S2 `size: '1lh'`, Avatar 만 있으면 아이콘만 있는 버튼과 같은 정사각형. S2 소스 그대로 — Avatar 가 있으면 Icon 은 그리지 않고 (`<Icon /> or <Avatar />`, 문서 예제 동작), 버튼이 비활성이면 Badge 를 그리지 않으며 (NotificationBadge `display: none`), staticColor white · black 버튼의 Badge 는 그 색 바탕에 반대색 글자 (`transparent-overlay-1000` · `auto`). Type · Auto focus 는 S2 예제 조작 칸에 없어 패널에서 숨겼다 (값은 받는다). 테스트: `actionButtonAvatarBadge.test.tsx`.
- **ActionButton 이 S2 form · focus 속성을 받는다** (사용자 「ActionButton · ActionButtonGroup S2 전환 체크 — 프로퍼티 누락 추가」, 2026-11-14): S2 `ActionButtonProps` 와 대조해 빠진 `name` · `value` · `form` · `formAction` · `formMethod` · `formEncType` · `formTarget` · `formNoValidate` · `excludeFromTabOrder` · `preventFocusOnPress` 를 binding 이 받고 Preview · Publish 의 button 에 넘긴다 — 개발자용 HTML 속성이라 Design 패널에는 내지 않는다 (2026-11-11 결정). ActionButtonGroup 은 S2 prop 이 모두 있어 변경 없음. 테스트: `actionButtonS2Props.test.tsx` (renderer 전달을 빼면 RED).
- **Pagination 기본 크기 = 버튼 줄 크기** (사용자 「Pagination 컴포넌트 width · height fit-content」, 2026-11-14): Pagination rule 에 `width: fit-content` · `height: fit-content` — 그전에는 부모 폭을 채우고 버튼 사이에 남는 폭을 나눴다 (`justify-content: space-between`). Canvas · 생성 `Pagination.css` 같은 값 (`componentRulesTable.ts` Pagination `containerStyles`). 테스트: `paginationFitContent.test.ts` (값을 빼면 폭이 부모 폭 1920 으로 RED).
- **IllustratedMessage 그림 선 두께 1** (사용자 「Illustration 의 stroke-width: 1 로 변경」, 2026-11-14): Illustration 에 `strokeWidth` 속성 (Icon 과 같은 0.5 ~ 4, 기본 1 — 그전에는 Icon 기본값 2 로 그렸다) 을 두었다. Canvas 글리프와 DOM svg 가 같은 값을 읽고, Design 패널 Stroke Width 에서 바꿀 수 있다 (`Illustration.binding.ts`). 테스트: `illustrationStrokeWidth.test.tsx`.
- **Text 기본 크기 = 글자 크기** (사용자 「catalog 기본값 text 컴포넌트는 width · height fit-content」, 2026-11-14): Text rule 의 기본 폭 `100%` → `width: fit-content` · `height: fit-content` — 폭을 따로 주지 않은 Text 상자는 글자만큼만 차지한다 (Canvas · 생성 `Text.css` 같은 값). 부모 폭을 채우던 Text (가운데 · 오른쪽 정렬, flex 행에서 남는 폭을 차지하던 글자) 는 폭을 직접 주어야 한다 (`componentRulesTable.ts` Text `containerStyles`).
- **SearchField Group 오른쪽 여백 0** (사용자 「searchfield-group 에 padding-right:0 으로 변경」, 2026-11-14): 상자 끝 padding 12 → 0 (S2 `FieldGroup` `paddingEnd: 0`) — 지우기 버튼이 상자 끝 (테두리 안쪽) 에 붙는다 (`fieldPrefix.ts` `boxEnd`).
- **SearchField Group 오른쪽 여백 12 · Select 버튼 오른쪽 여백 8** (사용자 「searchfield-group 에 padding-right:12, select - button 에 padding-right:8px」): SearchField 상자의 끝 padding 이 0 에서 시작 padding 과 같은 `edge-to-text` (XS ~ XL 크기별, M 12) 로 — 지우기 버튼이 상자 끝에서 그만큼 안쪽에 선다 (`fieldPrefix.ts` `boxEnd`). Select trigger 의 M 끝 padding 7 → 8 (Select rule `--select-btn-pad-end`).
- **field 상자 정리 — 쓰이지 않는 값 · 중복 값 삭제** (사용자 「catalog 에 불필요한 노드 · 정보 · 값은 모두 삭제되었나」): ColorField · ComboBox · DatePicker · DateRangePicker · NumberField · SearchField · Select rule 의 `sizes[*].iconSize` (34 칸 — 버튼 안 글리프에 닿지 않았고 DOM `--icon-size` 는 Icon 이 덮었다) 를 지웠다. 상자 Group · 안 Input 의 기본값 (`catalogFieldBoxStyle` · `CATALOG_FIELD_BOX_INPUT_STYLE`, 두 consumer 가 inline) 과 겹치던 delegation (ComboBox `.combobox-container` · NumberField · SearchField Group 의 flex · width, 세 field Input 의 min-width · flex, DatePicker Group 의 bridges · DateInput 블록) 과 template 의 Group `layout` (flex row) · DatePicker DateInput 작성값 (fill · border · padding) 도 지웠다 — DOM 의 DatePicker DateInput 이 Input 과 같은 기본값을 받고 (`laidFieldBoxInput`), 끝 padding 0 은 `catalogFieldBoxInputEnd`, Canvas 날짜 글자의 시작 위치는 엔진에 넣은 padding 을 읽는다. 화면 변화 없음. Design 패널 Layout 탭은 상자 Group 의 배치 (flex · row · 가운데 정렬) 를 그려진 값으로 읽는다 — template 값을 지운 뒤 NumberField · ComboBox · DatePicker · SearchField Group 이 `block` 으로 보였다 (사용자 「DatePicker 의 group 는 flex 도 되어 있지 않다」).
- **field 상자의 모양 값을 Group 으로 — Design 패널 · min-height** (사용자 「combobox-group border-radius 가 디자인 패널에 나타나지 않고 이전의 input radius 가 나타난다」 · 「border-color 도 input 에 들어 있다, group 로 다 옮겨지지 않았다」): NumberField · ComboBox · DatePicker · SearchField (와 prefix 상자) 의 Group 은 Input rule 상자 (radius · 테두리 · 바탕) 를 그리는데 패널은 Group 의 0 · Group rule 칠을, 안의 Input · DateInput 은 상자를 내려놓았는데 Input rule 의 radius · 테두리색 · 바탕 · Min H 32 를 보였다. 패널이 그리는 값을 읽는다 (`catalogDrawnFieldBoxVisual` · `catalogFieldBoxRole` → Styles context `drawnPaint`) — 작성값은 그대로 이긴다. 상자 안 Input 의 min-height 32 도 내려놓는다 (`CATALOG_FIELD_BOX_INPUT_STYLE.minHeight: 0` — 전에는 32 상자의 안쪽 28 에 32 높이로 넘쳤다, Canvas · DOM 둘 다).
- **field 버튼 아이콘 크기 XS 12 · S 14 · M 16 · L 18 · XL 20** (사용자 지정): ComboBox · Select chevron, DatePicker · DateRangePicker 달력, NumberField − / + 아이콘이 Button 의 아이콘 단 (14 ~ 22) 대신 이 값을 쓴다 (× 기기 배율 — NumberField 는 S2 `Dash` · `Add` 8 ~ 12 였다). NumberField 는 Button 정의의 증감 slot part rule (`STEPPER_GLYPH_PX`), 나머지는 field rule 의 `.react-aria-Button .react-aria-Icon svg` delegation 을 생성 CSS 와 Canvas part rule 이 같이 읽는다 (control Group 을 건너 — `CATALOG_PART_RULE_PASS_HOSTS.Group`).
- **SearchField 입력 시 ✕ 두 개** (사용자 「search 필드에 입력 시 기본 x 와 중복」): `<input type="search">` 의 브라우저 기본 지우기 버튼 (`::-webkit-search-cancel-button`) 이 field 의 지우기 버튼과 함께 보였다 — S2 처럼 숨긴다 (SearchField rule delegation, 생성 CSS).
- **SearchField Group gap 8 · 입력 칸 안쪽 여백 제거 (SearchField 왼쪽 · NumberField · ComboBox 오른쪽)** (사용자 「searchfield-group 에 gap 8px, searchfield-group-input 의 padding-left 제거, numberfield · combobox-group-input 의 padding-right 제거」): 버튼 · 아이콘과 입력 사이의 간격은 상자 Group 의 gap 하나다 — SearchField 8 (아이콘 ↔ 입력 ↔ 지우기 버튼), NumberField 4 (S · L · XL 8), ComboBox 4. 입력의 시작 · 끝 padding 은 0 (`fieldPrefix.ts` `catalogFieldBoxInputEnd` · `catalogFieldBoxInputStart`). md 글자 ↔ 버튼 거리는 10 → 4 로 좁아졌다 (S2 `text-to-control` 대신 사용자 값).
- **ComboBox Group gap 4 · SearchField Group 시작 padding 12 · Select trigger 끝 padding 7** (사용자 「combobox-group 에 gap 4px, searchfield-group 에 padding-left 12px, select-group 에 padding-right 7px」): ComboBox 상자 gap 4 (모든 크기 — 입력 끝 padding 은 `text-to-control` − 4 = md 6, 글자 ↔ 버튼 거리 10 그대로), SearchField 상자 시작 padding 은 다른 field 와 같은 `edge-to-text` (md 12 — S2 `pill` − 2/14 em 의 14 대신), Select trigger 의 M 끝 padding 4 → 7 (달력 머리의 월 · 연 Select 도 같은 rule). 위치: `fieldPrefix.ts` `boxEnd` · `componentRulesTable.ts` Select `--select-btn-pad-end`.
- **field 앞 글자 (prefix) 뒤 간격을 margin 이 아니라 입력의 시작 padding 으로** (사용자 「prefix 의 margin-inline-end 도 padding · gap 으로」): TextField · TextArea · NumberField · ComboBox · ColorField 의 앞 글자가 `margin-inline-end` (XS 4 · S 5 · M 6 · L 7 · XL 8) 로 입력과 떨어져 있던 것을 입력의 `padding-left` 로 옮겼다 (`fieldPrefix.ts` `catalogFieldBoxInputStart` — 생성 CSS 의 prefix margin 삭제). 상자의 gap 이 있는 NumberField 는 그 gap 을 뺀 나머지가 padding 이다 (md 6 = gap 4 + padding 2 — 전에는 margin 6 + gap 4 = 10 으로 S2 보다 넓었다). 입력의 Layout 탭이 그 값을 보이고 고친다.
- **SearchField 를 S2 구조로 — `Label + Group(검색 아이콘 + 입력 + 지우기 버튼)`, margin 없음** (사용자 「SearchField 는 NumberField 처럼 S2 로 구조 변경 (margin 제외)」): RAC 레퍼런스의 평평한 grid (ADR-256 G5 예제 5 — 글리프 · 지우기 버튼을 `margin-inline-start` 로 입력 상자 위에 겹침) 를 S2 `FieldGroup` 구조로 바꿨다. Group 이 pill 상자를 그리고 (`CATALOG_BOXED_FIELDS`), 간격은 객체의 layout 값이다 — Group 시작 padding = S2 `pill` − 글리프 여백 (md 14) · 끝 padding 0, 입력 시작 padding = `text-to-visual` (md 6), 지우기 버튼 = 높이 폭 (md 32 × 28). Label 옆 배치는 다른 field 와 같은 `auto 1fr` grid. 화면 위치는 같다 (md 글자 시작 40). quiet SearchField 의 상자는 pill 모서리를 inline 에 남기지 않는다. 위치: `reusableOriginLibrary.ts` SearchField template · `componentRulesTable.ts` SearchField · `fieldPrefix.ts` · `presence.ts` (지우기 버튼 · 파생 값이 Group 을 건넌다) · `resolver.ts` `CATALOG_PART_RULE_PASS_HOSTS`.
- **ComboBox · DatePicker 를 S2 구조로 — Group 이 상자, 버튼은 상자 안 (margin 없음)** (사용자 「ComboBox 는 NumberField 처럼 S2 로 구조 변경 (margin 제외), DatePicker 는 DateRangePicker 에서 구분 글자 · 둘째 DateInput 만 뺀 것」): 입력 상자가 테두리를 그리고 버튼을 음수 `margin-inline-start` 로 그 위에 겹치던 구조를, S2 `FieldGroup` 처럼 control Group 이 상자를 그리고 (`CATALOG_BOXED_FIELDS` — Input rule 상자) 입력 · 버튼이 그 안에 차례로 놓이는 구조로 바꿨다. 간격은 객체의 layout 값이다 — ComboBox: Group 끝 padding = 높이 × 3/16 − 테두리 (md 4) · Input 끝 padding = `text-to-control` (md 10), DatePicker: Group 끝 padding S 2 · M 4 · L/XL 6 · gap = DateRangePicker 의 gap · DateInput 끝 padding = DateRangePicker end 입력과 같은 값. 화면 위치는 같고, Group 의 Layout 탭이 그 값을 보이고 고친다. quiet DatePicker 는 Group 이 밑줄을 그리고, 달력 버튼에 focus 가 있는 동안 상자는 focus 테두리 · 고리를 끈다 (S2 `shouldTurnOffFocusRing` — DateRangePicker 와 같다). 위치: `fieldPrefix.ts` `boxEnd` · `componentTraits.ts` `CATALOG_BOXED_FIELDS` · `componentRulesTable.ts` ComboBox · DatePicker delegation · DatePicker template.
- **DateRangePicker 의 버튼 앞 여백을 margin 이 아니라 end 입력의 끝 padding 으로** (사용자 「daterangepicker - group - button 의 CSS 에 margin-inline-start · margin-left 가 생긴다 — margin 은 쓰지 않기로 했다, 제거」): S2 `text-to-control` (글자의 10/14) − Group gap 을 버튼 `margin-inline-start` (Canvas 는 `marginLeft`) 로 주던 것을 end DateInput 의 `padding-right` (`--drp-end-pad`) 로 옮겼다 — DatePicker 의 입력 끝 padding 과 같은 어법. 화면 위치는 같다 (XS 7.86 = 끝 padding 5.86 + gap 2).
  - Why: ADR-295 3c-3b 가 S2 의 버튼 `marginStart` 를 그대로 옮겨 온 값이었다. margin 은 Design 패널의 객체 값 (padding · gap) 으로 보이지 않고 손잡이도 없다 — NumberField 와 같은 이유.
  - 위치: `componentRulesTable.ts` DateRangePicker delegation (`.react-aria-DateInput[slot="end"]` 의 `drp-end` 변수 · 버튼 항목의 margin 삭제) · 생성 `DateRangePicker.css`. 테스트: `drawnBoxModel.test.ts` 「DateRangePicker — no margin on the button」 (end 입력 padding 0 / 6 · 버튼 margin 0 · DOM 끝 padding 식 — bridge 를 지우면 RED) · `d3S2Alignment` 의 S2 대조가 새 변수를 읽는다 · `phase4e10FileUpload` 가 「끝 padding + gap = text-to-control」 로 잰다.

- **편집 값이 한쪽에만 닿던 부품 — 전수 감사** (사용자 「동일한 문제가 다른 컴포넌트에서도 발생 가능 — 전수조사」): 모든 origin 컴포넌트 164 개 (부품 867 행) 에 padding 을 써서 Design 패널 판정 · Canvas 레이아웃 · DOM inline · 간격 손잡이를 대조하는 하니스와, Canvas 덮어쓰기 · DOM 작성 style 경로 · overlay 게이트 코드 감사 셋을 병렬로 돌렸다. 고친 것:
  - **RadioItems · CheckboxItems**: DOM 이 묶음의 작성 style 을 버려 패널 padding 이 Canvas 에만 보였다. 이제 작성값만 inline (group rule 의 orientation 값은 시트 몫 — 섞으면 orientation 이 inline 에 굳는다). 위치: `delegatedDom.runtime.ts` · `domBinding.runtime.ts` `ITEMS_WRAPPER_BINDINGS`.
  - **요소 없는 RAC 부품** (TreeItemContent · SideNavItemContent · SubmenuTrigger · CalendarMonth/YearPicker): DOM 요소가 없어 값이 Publish 에 닿지 않는데 패널은 편집을 받았다. `catalogElementlessType` 이 이들도 요소 없음으로 보아 패널은 안내만, Canvas 간격 손잡이도 뜨지 않는다 (같은 판정 하나). 위의 손잡이 확대가 MenuTrigger · DialogTrigger 같은 요소 없는 노드에 0 값 손잡이를 띄우던 것도 함께 막았다.
  - **Gap 손잡이가 패널의 Gap 을 못 이기던 것**: 한 줄 flex 의 패널 Gap 은 주축 longhand (`columnGap` · `rowGap`) 에 쓰고 레이아웃에서 그것이 `visual.gap` 을 이기는데, 손잡이는 `visual.gap` 에만 써서 드래그 · 숫자 입력이 반영되지 않았다. 손잡이 쓰기가 같은 step 에서 작성 longhand 를 지운다.
  - **패널 · 손잡이가 부풀린 padding 을 보이던 것** (같은 날 1단계 「그려진 값」 의 회귀): Canvas 가 자기가 그리는 부품의 자리를 더한 값 (link-out 글리프 · 정렬 표시 · crumb 구분자 · 표본 목록의 만들지 않은 행) 까지 「그려진 값」 으로 읽어, 다시 쓰면 두 번 더해졌다. `getDrawnLayoutStyle` 은 그 덧붙인 자리를 뺀다.
  - **SideNav 행 부품 (Icon · Text · Link · chevron Button) · indeterminate ProgressBar fill**: Canvas 가 시트 자리 값으로 작성값을 덮었다 (DOM 은 작성 inline 이 이긴다). `withoutAuthored` 로 작성한 키는 내지 않는다.
  - 테스트: `drawnBoxModel.test.ts` (14 — 위 각 수정을 되돌리면 RED).
  - 남긴 것 (결정 필요 또는 작은 영향): Tree 안 TreeItem (DOM 행 요소에 작성 style 이 안 가고, Canvas 는 TreeItem 을 행 + 하위 항목 열로 그려 상자 자체가 다르다) · FileTrigger (자식이 있으면 DOM 은 `display: contents` 표지) · SliderThumb (Canvas 크기가 `sizing` 을 무시 · DOM 이 작성 border 를 지움) · Popover · Sheet · OverlayArrow · ColorThumb margin (작성 inset · 크기 · margin 이 DOM 에서만 이김) · SideNavSection 의 작성 marginTop (Canvas 는 nav gap 을 더한다). 「Edited from the parent」 인데 DOM 요소가 있는 부품은 0 건.

## [빌더 Toast 의 bottom 자리가 화면 아래다 — 액션바와 관계없이 설정 자리에 고정] - 2026-11-13

### Changed

- **빌더 Toast 는 contextual action bar 위치와 관계없이 Settings 「Toast placement」 자리에 고정된다** (사용자 결정 「바 위치와 관계없이 설정에서 정한 Toast 위치에 고정」): 아래 자리는 늘 화면 아래 16 (S2). 바와 겹칠 때 바 위로 올리던 계산 (`useActionBarClearance`) 을 Toast 가 더 쓰지 않는다 — 바가 화면 아래 가운데에 있어도 `bottom` 은 973 (바 937 ~ 973 과 겹침), `bottom end` 973. 위치: `ToastContainer.tsx` · `Toast.css`. 아래 Fixed 의 「겹칠 때만 올린다」 는 이 결정으로 대체됐다.

### Fixed

- **Settings 「Toast placement」 bottom 이 액션바 자리 위에 뜨던 것** (사용자 보고 「bottom 으로 했을 경우 액션바의 위를 bottom 으로 인식한다 · bottom end 는 정상」): 아래 자리는 S2 와 같은 화면 아래 16 이고, contextual action bar 와 가로로 겹칠 때만 바 윗선 + 8 로 올린다.
  - Why 1: 아래 자리 CSS 가 바 한 줄 높이 (60) 를 늘 비워 두었다 — 바가 없거나 화면 밖이어도 bottom · bottom end 모두 60 위. bottom end 는 그 아래에 바가 없어 정상으로 보였다.
  - Why 2: 겹칠 때 올리는 계산 (`useActionBarClearance`) 이 토스트가 생길 때 한 번만 쟀는데, 그때 region 은 아직 DOM 에 없어 0 이었다 (고정 60 이 가리던 결함). region 이 붙거나 크기가 바뀌면 다시 잰다.
  - 위치: `apps/builder/src/builder/components/feedback/Toast.css` · `useActionBarClearance.ts`.
  - Live (aaa, Fit to screen · Button 선택으로 바가 화면 아래 가운데 937 ~ 973): bottom → 바 위 (아래 끝 929), bottom end → 화면 아래 16 (973), 바가 화면 밖일 때 bottom → 973. 확인 뒤 placement bottom 으로 되돌림.
  - 테스트: `actionBarClearance.test.ts` (region 이 나중에 붙어도 44 올림 — 원복 RED).

## [rule 값이 Publish 에서 사라지지 않는다 — 생성 CSS 의 누락 키 · size padding 덮어쓰기 · Publish margin reset] - 2026-11-13

### Fixed

- **SideNav 의 머리글 · 행 간격이 Publish 에서만 붙던 것**: Canvas 는 머리글 → 첫 행 14 · 행 사이 6 (S2) 인데 Publish 는 0 이었다. 이제 둘 다 14 · 6.
  - Why 1: Publish 의 전역 reset `* { margin: 0 }` 이 cascade layer 밖이라 catalog 의 margin (`@layer components`) 을 전부 이겼다. 가장 낮은 layer (`preview-system`) 로 옮겼다 — 브라우저 기본 margin 은 그대로 지운다. 위치: `apps/publish/src/styles/index.css`.
  - Why 2: CSS 생성기 (`emitContainerStyles`) 가 줄이 없는 rule 값을 말없이 버렸다 — SideNavHeader `margin-bottom: 8px` 등. 이제 모든 선언 키를 쓴다 (kebab-case · 토큰은 변수 · `--` 사용자 속성 그대로). Canvas rule 상자도 margin 네 방향을 읽는다 (`CATALOG_CANVAS_BOX_KEYS` · `typedCanvasBox`).
- **rule 이 선언한 padding 한쪽을 size 블록이 덮던 것**: size 에 padding 이 없으면 생성 CSS 가 `padding: 0px 0px` 를 써 SideNavHeader 시작 12 · Toast 네 방향 padding 이 Publish 에서만 0 이었다. 이제 padding 한쪽이라도 선언하면 size padding 을 쓰지 않는다 (Canvas 와 같은 규칙).
- 같이 생성 CSS 에 들어간 값 (같은 블록 아래 선언이 덮어 화면 변화 없음: ActionButton · ToggleButton · SelectBox `border-style`, SideNav `--indent`): TokenInput `white-space: pre-wrap` · `overflow-wrap: anywhere`, Token · SegmentedControlItem `white-space: nowrap`.
  - 게이트: `CSSGenerator.containerStyles.test.ts` 가 모든 rule 의 `structure.containerStyles` 키가 CSS 에 쓰이는지 검사한다 (borderWidth 는 border · size 축이 쓴다). 원복 RED: 일반 출력 제거 3 실패 · padding 판정 원복 1 실패 · Canvas margin 키 원복 1 실패 (`adr300SideNavDom.test.tsx`).
  - Live (aaa · Mobile 390, SideNav > Section > Header + Item 2 → 확인 뒤 삭제): Canvas 행 y 30 · 68, Publish 30 · 68 (머리글 margin-bottom 8 · 행 margin-top 6). body 자식 15 개의 위치가 Canvas = Publish (±2). 콘솔 오류 0. Toast · Token · TokenInput 은 live 로 보지 않았다.
- **Min W 에 0 을 넣으면 값이 지워지던 것**: 지우기가 아니라 최소 0 으로 저장한다. Chart (rule min-width 320) 에 Width 200 · Min W 0 → 200 × 112.5 (전에는 rule 의 320 으로 돌아갔다).
  - Why: Styles 키 표 (`catalogStyleWrites`) 가 Min `0` 을 「값 없음」 으로 다뤘다. rule 에 바닥이 없을 때는 같아 보였지만, flex 안에서 `min-width: 0` 은 auto (내용 크기) 와 다르고 rule 바닥 (Chart 320 · SideNav 160) 을 낮추는 유일한 방법이다.
  - 위치: `apps/builder/src/builder/catalogRuntime/styleFields.ts`.
  - Live (aaa · Mobile, Chart → Width 200px → Min W 0): Canvas 320 × 180 → 200 × 112.5, Publish 200 × 112.5 (inline `min-width: 0px`). 확인 뒤 삭제.
  - 테스트: `phase4eStyleFields.test.ts` · `phase4eSizing.test.tsx` (원복 RED 2).

## [Chart 기본 상자 = 16:9 비율 — 세로 flex body 에서 눌리지 않는다] - 2026-11-13

### Changed

- **Chart 의 기본 크기가 높이 240 (단계별 160 · 240 · 320) 에서 width 100% · min-width 320 · aspect-ratio 16 / 9 로** (사용자 결정 「width 100%, min-width 320, aspect-ratio 16/9 로 바꾸고 단계별 높이를 빼는 것이 더 맞다」): 여러 개를 Height 100% 의 세로 flex body 에 넣어도 높이가 눌리지 않는다.
  - Why: 높이 px 는 flex 의 기본 shrink 를 받는다. 안쪽 차트가 `height: 100%` 라 자동 최소 높이가 테두리 · 여백뿐이어서 body 가 넘치면 26 까지 눌렸다. 비율 상자는 높이가 auto 일 때 자동 최소 높이가 비율 높이라 그 아래로 줄지 않는다 (Chrome 390 × 219 · 엔진 같은 값). overflow 를 숨기면 이 최소 높이가 0 이 되므로 Chart 에는 두지 않는다.
  - 팔레트 · 원본의 `width: 320` 도 지워 rule 의 width 100% 를 따른다. 직접 넣은 Height 는 그대로 이긴다 (두 축이 정해지면 비율은 쓰이지 않는다 · 직접 넣은 크기는 줄지 않는다).
  - 생성 CSS 의 `containerStyles` 가 `min-width` · `aspect-ratio` 를 내고 Canvas rule 상자도 같은 두 값을 읽는다 (`CSSGenerator.emitContainerStyles` · `CATALOG_CANVAS_BOX_KEYS` · `typedCanvasBox`). 그래서 지금까지 두 화면이 모두 버리던 S2 값 2 개도 같이 적용된다 — SideNav `min-width: 160px` (S2 `sideNavWrapper`) · SideNavItemLink `min-width: 0` (S2 `treeRowLink`).
  - Size S · M · L 은 여백 · 글자만 바꾼다 (공개 size 자체는 ADR-306 Phase 1 이 지운다 — 같은 날 ADR 본문도 이 기본값으로 고쳤다).
  - Library 페이지의 Chart 견본 · 종류 칸은 `minWidth: 0` 을 받아 칸 폭 (198) 을 따른다 — 규칙의 320 바닥이 모바일 한 칸을 넓히지 않게 (2026-10-25 「Chart 320px 이 칸을 넓힌다」 와 같은 이유).
  - 위치: `componentRulesTable.ts` `Chart` · `reusableOriginLibrary.ts` · `chart/authoring.ts` · `CSSGenerator.ts` · `resolveCatalogRuleCanvasBox.ts` · `ruleDefinition.ts` · `componentsPage.ts`.
  - Live (aaa · Mobile 390 × 844 · body 세로 flex, Bar chart 3 개 → body Height 100% → 확인 뒤 삭제 · Height 원래대로): Canvas body 844 에서 Chart 3 개 모두 390 × 219.375, Publish (390 × 844 iframe — Publish 앱의 page-nav 220 을 숨겨 같은 폭으로) body 844 · 내용 2152 에서 3 개 모두 390 × 219.375 · inline `aspect-ratio: 16 / 9`. 콘솔 오류 0.
  - 테스트: `bodyColumnFlexSqueeze.test.tsx` (Chart 16:9 높이 유지 — rule 원복 · Canvas 상자 키 원복 각각 RED). Ratio 잠금 테스트의 「rule 높이 고정」 사례는 ColorArea (192) 로 옮겼다.

## [Ratio 가 규칙 기본 크기가 있는 컴포넌트에서도 작동한다 — 따라가는 축을 Fit content 로] - 2026-11-13

### Fixed

- **Chart 에 Width 640 · Ratio 1:1 을 줘도 640 × 240 이던 것** (사용자 보고 「높이가 640 이 되지 않는다」): Ratio 를 켜면 따라가는 축을 Fit content 로 써 둔다 — 640 × 640.
  - Why: CSS `aspect-ratio` 는 폭 · 높이가 둘 다 정해지면 쓰이지 않는다. Ratio 칸 (`catalogRatioCommand`) 은 직접 넣은 Height 만 지워, 규칙이 크기를 주는 컴포넌트 (등록 타입 중 팔레트에 놓이는 79 개 가운데 Chart · ColorArea · ProgressCircle · Nav · ColorSwatch · ColorSlider · SideNavPanel 7 개) 는 두 축이 정해진 채로 남아 Ratio 가 조용히 무시됐다.
  - 따라가는 축은 CSS 규칙대로 고른다 — 직접 정한 축이 기준, Height 만 정했으면 Width 가 따라가고 그 밖은 Height 가 따라간다. `fit-content` 를 쓰는 이유: Chrome 에서 `height: fit-content` 도 비율을 따르고 (640), 세로 flex 안의 따라가는 Width 는 `auto` 면 늘이기에 지지만 (1000) `fit-content` 는 비율대로 (400) 선다.
  - 따라가는 축 판정 (`getRatioDependentAxis` — 패널 표시 · 리사이즈 잠금 · fill 투영) 이 `fit-content` · `min-content` · `max-content` 를 정해지지 않은 축으로 센다 (`isFixedRatioAxis`). Ratio 를 끄면 따라가던 축의 Fit content 를 지우고 잰 px 로 고정한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/sizing.ts` · `packages/shared/src/utils/fillSizing.ts`. 두 렌더러의 계산 (엔진 · 브라우저) 은 그대로다.
  - Live (aaa · Desktop, Bar chart 를 넣어 Width 640 → Ratio 1:1 Square → 확인 뒤 삭제): Canvas 640 × 640 (Height 칸 흐린 640), Publish `height: fit-content; aspect-ratio: 1 / 1` · 640 × 640. 콘솔 오류 0.
  - 테스트: `phase4eSizing.test.tsx` (Chart 640 × 640 · 끄면 640 고정 · Height 만 정한 상자는 Width 가 따라감 — 잠금 원복 · 판정 원복 각각 RED).

## [직접 넣은 Height · Width 가 flex 주축에서 줄어들지 않는다] - 2026-11-13

### Fixed

- **Height 400 을 넣은 Table 이 세로 flex body 에서 128 로 줄던 것** (사용자 보고 「table height 400 을 넣어도 적용이 되지 않는다」): flex 주축에 직접 넣은 크기 (px · % · vh — Size Fixed · Parent · Viewport) 는 `flex-shrink: 0` 으로 그 크기를 지킨다. Table 만이 아니라 크기를 넣은 모든 요소가 같다.
  - Why: 이 계약은 2026-09 에 옛 store 경로 (`sizeModeResolver.resolveFixed`) 가 Fixed 를 고를 때 함께 쓰던 값이었는데, catalog 전환 뒤 Height 칸 (`catalogSizingCommand`) 은 크기만 써서 빠졌다.
  - 위치: 쓸 때 저장하지 않고 해석에서 정한다 (`fillLayout.ts` `catalogFixedMainShrink` → record `fillLayout` — Canvas `styleOf` · DOM inline 이 같이 읽음). 그래서 부모를 나중에 flex 로 바꾸거나 방향을 바꿔도 따라온다. rule 의 기본 길이 (Table `width: 100%`) 는 직접 넣은 값이 아니라 그대로 줄어든다 — 가로 flex 에 나란히 둔 Table 은 지금처럼 나눠 갖는다. 직접 넣은 Shrink 값이 이긴다.
  - Live (aaa · mobile 390×844 · body 세로 flex · Height Parent, Table 을 넣어 Height 400 → 확인 뒤 삭제 · body Height fit 복원): Canvas 선택 상자 390×400, Publish (390×844 iframe) `table` 400 · inline `flex-shrink: 0` · body 844 에 내용 1909. 콘솔 오류 0.
  - 테스트: `bodyColumnFlexSqueeze.test.tsx` (Height 넣은 뒤 flex · flex 안에서 Height — 원복 시 128 로 RED). Chrome 그대로 줄어드는 것을 단언하던 `columnFlexShrinkFloor` · `phase4PageFrames` 는 새 계약으로 갱신 (후자는 Shrink 1 을 직접 넣어 definite column 을 계속 확인).

## [Tree 도 세로 flex 에서 눌리지 않는다 — 기본 overflow 제거] - 2026-11-13

### Fixed

- **Tree**: catalog rule 과 수동 `Tree.css` (`[data-composition-tree]`) 에서 `overflow: auto` 를 뺐다 (사용자 결정 2026-11-13 「tree 제안대로 수정」 — ListBox 와 같은 방식). Height 100% 세로 flex body 에서 Canvas 90 → 38 · Publish 10 으로 눌리던 것이 내용 높이에 머문다 (Canvas · Publish 90). 높이를 저작한 Tree 의 스크롤은 Overflow 저작으로.
  - Table · Chart 는 보류 — 제안했던 `flex-shrink: 0` 은 가로 flex 에서도 걸려, 폭 100% 인 두 Table · Chart 를 나란히 두면 나눠 갖지 않고 넘친다. SideNavPanel · SideNav 는 S2 의도 (화면 높이 안 스크롤) 라 그대로 둔다 (사용자 결정).
  - 테스트: `bodyColumnFlexSqueeze.test.tsx` (Tree) · `resolveContainerStylesFallback.test.ts` · `designDataSurfaceGaps.test.ts`.

## [ListBox 도 세로 flex 에서 눌리지 않는다 — 기본 overflow 제거, picker 팝오버 안 목록만 스크롤] - 2026-11-13

### Fixed

- **ListBox**: catalog rule (top-level · `structure.containerStyles` 두 층) 에서 `overflow: auto` 를 뺐다 (사용자 결정 2026-11-13 「listbox 컴퍼넌트도 catalog rule 에서 overflow 삭제」). Height 100% 세로 flex body 에서 Canvas 105 → 42 · Publish 9 로 눌리던 것이 내용 높이에 머문다 (Publish 191).
  - Select · ComboBox 팝오버 안 목록은 그대로 스크롤한다 — `stateStyles.overflow.inPopover: "auto"` (S2 Picker · ComboBox `listbox` 의 `overflow: auto`). 생성 `ListBox.css` 의 `:is(.react-aria-Popover *)` 블록.
  - **동작 변화**: 높이를 저작한 ListBox 가 더는 저절로 스크롤 상자가 되지 않는다 — 스크롤 (과 Section 머리의 sticky) 은 Overflow 를 Auto 로 저작할 때. 2026-07-29 의 「`overflow:auto` 는 남긴다」 를 이 결정이 대체한다.
  - 테스트: `bodyColumnFlexSqueeze.test.tsx` (원복 RED 105 → 42) · `adr267StickyTransport.test.ts` · `phase4eCanvasOverflowBinding.test.ts` (스크롤 목록은 Overflow 저작) · `resolveContainerStylesFallback.test.ts` · `tokenConsumerDrift` 스냅샷 · `designDataSurfaceGaps.test.ts`.
- **확인만 (고치지 않음)** — 같은 조건 (mobile 390×844 · Height Parent) 에서 아직 눌리는 것과 원인. 모두 브라우저 (Publish) 도 같다:
  - Tree — rule `overflow: auto` (Canvas 90 → 38 · Publish 10). → 같은 날 위 항목에서 수정.
  - Table — 수동 `Table.css` 와 rule 의 `min-height: 40px` (명시 최소 높이라 overflow 와 무관하게 40 까지) + node table `overflow: auto` (Canvas 402 → 129 · Publish 40).
  - Chart — overflow 없음, 그림 상자가 높이를 부모 100% 로 받아 고유 최소 높이가 없다 (Canvas 240 → 96 · Publish 26).
  - SideNavPanel · SideNav — S2 그대로 `minHeight: 0` + `overflow: hidden` / `auto` (Canvas 182 → 62 · 146 → 50).

## [Card · ProgressCircle 도 세로 flex 에서 눌리지 않는다 — Card overflow 제거 · ProgressCircle flex-shrink 0 을 catalog 로] - 2026-11-13

### Fixed

- **Card**: catalog rule 에서 `overflow: hidden` 을 뺐다 (사용자 결정 2026-11-13 「card 컴퍼넌트도 catalog rule 에서 overflow 삭제」). Height 100% 세로 flex body 에서 296 → 118 로 눌리던 것이 내용 높이에 머문다. 그래서 CardPreview 상단 모서리는 Card 의 radius 로 잘리지 않는다 (S2 는 `overflow: clip` 으로 자른다 — clip 은 스크롤 상자가 아니라 flex 자동 최소 크기가 0 이 되지 않는다).
- **ProgressCircle**: Canvas 에서만 눌렸다 (32 → 11, 사용자 보고 「높이 0」). DOM 어댑터 (`ProgressCircle.tsx`) 는 늘 inline `flex-shrink: 0` 이었고 Canvas 는 그 값을 몰랐다 — overflow 가 아니라 두 consumer 의 축 차이. rule `structure.containerStyles.flexShrink: "0"` 로 옮겨 두 consumer 가 같이 읽는다.
  - Canvas 상자 키 (`CATALOG_CANVAS_BOX_KEYS` · `BOX_LAYOUT_KEYS`) 와 CSS 생성기 (`emitContainerStyles` · `ContainerStylesSchema`) 에 `flexShrink` 가 없었다. 그래서 **SegmentedControlItem** 이 rule 에 적어 둔 S2 `flexShrink: 0` (`segmentedControl.ts`) 도 두 consumer 모두 버리고 있었다 — 이번에 함께 적용된다 (생성 `SegmentedControlItem.css` 에 `flex-shrink: 0`).
  - Live (aaa · mobile 390×844 · body 세로 flex · Height Parent, 두 요소를 넣고 확인 뒤 삭제): Canvas ProgressCircle 32×32 · Card 내용 전부, Publish ProgressCircle 32 (`flex-shrink: 0`) · Card 343.5 (`overflow: visible`) · Accordion 101. 콘솔 오류 0. ListBox 둘은 아직 9 로 눌린다 (overflow auto — 이번 범위 밖).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Card · ProgressCircle) · `resolvers/resolveCatalogRuleCanvasBox.ts` · `document/ruleDefinition.ts` · `packages/rendering/src/renderers/CSSGenerator.ts` · `types/spec.types.ts`. 테스트: `bodyColumnFlexSqueeze.test.tsx` (원복 RED — Card 296 → 118 · ProgressCircle 32 → 11, Canvas 상자 키만 되돌려도 ProgressCircle RED).

## [Accordion 이 내용을 자르지 않는다 — 높이가 정해진 세로 flex 에서 0 까지 눌리지 않음] - 2026-11-13

### Fixed

- Accordion 의 catalog rule 에서 `overflow: hidden` 을 뺐다 (생성 `Accordion.css` 도). 세로 flex page body 에 Height 100% 를 주고 내용이 화면보다 길면 Accordion 이 0 까지 눌리던 것이 내용 높이에서 멈춘다 (사용자 결정 2026-11-13 「catalog 에서 Accordion 의 overflow 자체를 제거」).
  - **Why**: flex item 은 `overflow` 가 `visible` 이 아니면 자동 최소 크기가 0 이다 — Chrome 과 Canvas 엔진이 같은 규칙이라 두 쪽 다 눌렸다 (Publish 실측 Accordion 0). S2 Accordion 은 `display: flex` · `flex-direction: column` 뿐이고 내용을 자르지 않는다. Accordion 은 바탕 · 테두리가 없어 모서리를 깎을 것도 없다.
  - Live (aaa · mobile 390×844 · body 세로 flex · Height Parent): Canvas 프레임 390×844 에서 Section 1 · 2 · Content 2 가 다 보이고 스크롤, Publish body 844 · Accordion 101 (전 0) · overflow visible. 콘솔 오류 0.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Accordion `composition.containerStyles`). 테스트: `accordion.test.tsx` (원복 RED — 101 → 35) · `resolveContainerStylesFallback.test.ts` · `CSSGenerator.disclosure.test.ts`.

## [page 프레임 = body 그대로 — Canvas H 제거, Height 가 프레임을 정한다] - 2026-11-13

### Removed

- page 의 **Canvas H** (Design 패널 Layout › Size) 와 문서 필드 `PageEntry.viewportHeights` — 바로 아래 항목에서 넣은 Builder 전용 프레임 높이를 걷어냈다 (사용자 결정 2026-11-13 「height 를 사용해도 충분」).
  - **Why**: body 는 Height 를 지정하지 않으면 Publish 에서도 내용만큼 자란다. Builder 프레임만 화면 높이에 묶여 있어 따로 값이 필요했던 것이라, 프레임이 body 를 그대로 따르면 Height 하나로 두 경우가 다 된다 — Fit content (내용 전체 보기) · Parent 100% / Viewport 100vh (화면 크기로 스크롤해 보기). 같은 뜻이 Publish 에도 그대로 적용된다.
  - 그 사이 저장된 프로젝트에 남은 `viewportHeights` 는 열 때 `entry.viewportHeights` 오류가 난다 (개발 단계 — 변환 코드 없음). 이 기기의 두 프로젝트 (aaa 포함) Home page 에서 그 필드를 지웠다.

### Changed

- page 프레임 높이 = body 의 Height: 지정하지 않음 · `auto` · `fit-content` 면 내용만큼 (최소 Min H, 없으면 breakpoint 화면 높이 — 화면 끝에 점선), `100%` · `vh` 면 breakpoint 화면 기준 높이, px 면 그 값 — 넘치는 내용은 프레임 안에서 스크롤한다. Min H 의 `%` 도 화면 기준으로 읽는다.
  - 세로 flex body 에 Height 100% 를 주면 높이가 정해진 flex 상자가 되어 줄어들 수 있는 자식 (overflow 가 있는 Accordion · ListBox …) 이 눌린다 — Chrome 과 같은 결과다 (Publish 실측: Accordion 0). Height 를 지정하지 않으면 눌리지 않는다. Accordion 은 같은 날 위 항목에서 overflow 를 빼 눌리지 않는다.
- page 아래 · 오른쪽 아래 손잡이: Height 를 지정한 body 는 Height 를, 아니면 Min H 를 px 로 쓴다 (바뀐 축만).
- Publish: `#root` · `.publish-app` · `.publish-layout` 가 `height: 100%` 로 화면 높이 체인을 잇는다 — 전에는 `min-height` 뿐이라 body 의 `100%` 가 화면 높이로 풀리지 않았다. 화면보다 긴 page 는 `.publish-content` 가 스크롤한다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`catalogPageBodyHeightAuthored` · `catalogPageFrameHeight` · `catalogPageContentMinHeight` · `pageBodySplit` · `pageFrameStyle`) · `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`pageBodySizing`) · `apps/publish/src/styles/index.css`. 테스트: `pageBodyResize.test.tsx` 8 · `phase4PageFrames.test.tsx` · `adr275FixedAuthored.test.ts` (원복 RED 8).

## [page 의 Canvas 높이 (Adobe XD Viewport Height) · page Size 절 = 컴포넌트와 같은 크기 방식] - 2026-11-13 (Canvas H 는 같은 날 위 항목에서 제거)

### Added

- page 의 **Canvas H** (Design 패널 Layout › Size, page 선택 시): Builder 에서 보이는 page 프레임 높이. 메뉴는 Reset (page 자신의 높이 — Height, Min H, 없으면 breakpoint 화면 높이) · Fixed (px) · Fit content (프레임이 page 내용 전체 높이에 맞고 내용이 바뀌면 따라간다 — 스크롤 없이 page 전체를 볼 때). Preview · Publish 와 body 의 Height · Min H 는 바뀌지 않는다 (사용자 결정 2026-11-13). page 마다 · breakpoint 마다 따로 저장되고 (`PageEntry.viewportHeights` — 안내선 `guideEntries` 와 같은 자리), 되돌리기 한 번으로 돌아간다. History 에는 「Canvas height」 와 page 이름이 남는다.
- page 아래 · 오른쪽 아래 손잡이를 끌면 같은 Canvas H 를 px 로 쓴다 (직전 항목의 「세로 손잡이 = Min H」 를 대체). 원래 높이로 끌어 놓으면 값이 지워지고, 코너 손잡이를 세로로만 끌면 Width 를 쓰지 않는다.
- 프레임이 breakpoint 화면 높이보다 길면 그 자리에 점선을 그린다 (XD 의 viewport 선 — 기기 화면이 끝나는 곳).
  - **Why**: page 높이를 넘는 내용을 Builder 에서 한 화면에 보려고 Min H 를 늘리면 발행되는 body 의 min-height 까지 바뀌었다. XD 는 artboard 높이 (전체 내용) 와 Viewport Height (보이는 창) 를 나누고, 이 값은 그중 Builder 쪽 화면만 맡는다. body 는 Height 를 지정하지 않으면 이미 내용만큼 자란다 — 화면 높이에 묶여 있던 것은 프레임이라 Fit content 는 Canvas H 에 둔다.

### Changed

- page 의 Width · Height 칸이 컴포넌트와 같은 크기 방식 메뉴를 쓴다 — Reset · Fixed · Fill · Fit content · Parent · Viewport (page 는 채울 부모가 없어 Fill 은 비활성). Height 는 지정하지 않으면 Fit content (내용만큼, 최소 page 높이) 이고 그 높이를 보인다. Height 를 지정한 page 도 Canvas H 를 받는다 — 프레임은 Canvas H, 내용은 지정한 Height 그대로 (넘치면 프레임 안에서 스크롤).
- Min W · Min H · Max W · Max H 도 같은 메뉴 (Reset · Fixed · Parent · Viewport) — 컴포넌트와 page 공통. Fixed 는 지금 크기 (px) 에서, Parent · Viewport 는 100 에서 시작한다. Fill · Fit content 는 상자의 크기라 제한 값에는 없다.
- 빈 page 를 Fit content 로 두면 옆의 긴 page 높이를 따라가던 문제 — 빈 page 의 내용 상자가 엔진 트리에 들어가지 않아 프레임 크기가 0 이 되고, 엔진이 크기 0 인 격자 항목을 셀 (행 높이) 로 채웠다. 이제 page 의 내용 상자는 비어 있어도 놓인다 (`layoutChildrenOf`). 테스트 「an empty page beside a long one」 (수정 전 1880 / 기대 1080).
- 크기 방식 메뉴의 Reset 이 맨 위로 (다른 값 메뉴와 같은 순서, 사용자 지정). 지금과 같은 방식을 다시 고르면 아무것도 쓰지 않는다 — Escape 로 메뉴를 닫을 때 RAC 가 선택된 항목을 다시 알려 빈 「Edit size」 단계가 남던 문제 (live 재현).
  - 위치: `packages/shared/src/catalog/document/types.ts` (`viewportHeights`) · `validation.ts` · `commands/project.ts` (`updatePage`) · `runtime/compositionRoot.ts` (`pageViewportHeight` · `pageFrameStyle` · `pageBodySplit` · `catalogPageOwnFrameHeight` · `catalogPageContentPartId`) · `apps/builder/src/builder/catalogRuntime/pageViewport.ts` · `canvasGesture.ts` · `history.ts` (page 주제) · `workspace/canvas/catalog/catalogOverlay.ts` (점선) · `panels/styles/sections/TransformSection.tsx` (`PageCanvasHeightRow` · `constraintControl`) · `catalog/catalogStylesHost.ts` (`pageViewport`) · `hooks/useLayoutValue.ts` (page Height = 내용 상자) · `components/property/PropertyUnitInput.components.tsx` (메뉴 순서 · 같은 방식 무시). 테스트: `pageBodyResize.test.tsx` 8 · `PropertyUnitInput.test.tsx` · `TransformSection.test.tsx` (원복 RED 8).

## [page body 높이 = 최소 page 높이 — 세로 flex body 가 자식을 누르지 않는다 · page 프레임 크기 손잡이] - 2026-11-13

### Fixed

- body 를 세로 flex (+ gap) 로 두고 내용이 page 높이를 넘으면 Canvas 에서 Accordion · ListBox 같은 자식이 줄어들어 겹치던 문제 (사용자 보고 — aaa 프로젝트, block 일 때는 정상). body 가 page 높이 (모바일 844) 로 고정된 상자라, overflow 가 visible 이 아닌 자식 (Accordion · ListBox · Card · Menu · Tree · SideNav · Meter · ProgressBar · FileTrigger …) 의 최소 높이가 0 이 되어 눌렸다 — Chrome 도 같은 조건이면 0 까지 누른다. 이제 body 는 실제 웹페이지처럼 최소 page 높이에서 내용만큼 자란다: Canvas 는 body 를 「화면 상자 (page 프레임 — 크기 · 스크롤)」 와 「내용 상자 (body 의 display · gap · padding, `min-height: 100%`)」 두 엔진 노드로 두고, 생성 Body CSS 는 `height: 100%` 를 뺐다 (2026-10-21 Compare 모드용 값 — 사용자 결정으로 되돌림). page 프레임은 그대로 page 높이이고 넘친 내용은 프레임 안에서 스크롤한다. 저작 Height 를 넣은 body 는 종전처럼 고정 높이다.
  - **Why**: 옛 레이아웃 파이프라인이 2026-07-28 에 고친 「body 는 뷰포트가 아니다」 (높이 대신 최소 높이) 가 ADR-248 catalog runtime 이관에서 빠졌다. 높이 하나만 최소 높이로 바꾸면 page 격자의 행이 내용 높이로 자라 다음 page 가 밀려서 두 상자로 나눴다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`pageBodyViewportStyle` · `pageBodyContentStyle` · `catalogPageViewportHeight`) · `catalogRuntime/canvasBinding.ts` (`blockFlowSiblingsFixed` 가 자식을 감싼 part 를 읽음) · `componentRulesTable.ts` body · 생성 `Body.css`
- 높이를 고정한 세로 flex 안에서 Icon · ColorWheel 이 Canvas 에서만 줄어들던 문제 (Icon 18 → 12, Chrome 은 svg 내용 높이 18 을 지킨다) — 글리프 · 지름에서 온 높이도 최소 높이로 엔진에 넘긴다.
  - **Why**: 최소 높이 (`contentMinHeight` = min(내용, 명시 높이)) 를 `box.height` 가 숫자일 때만 넘겨, 높이가 글리프 · 지름에서 오는 Icon · ColorWheel 은 빠졌다. 이제 직렬화된 px 높이를 읽는다.
  - 위치: `compositionRoot.ts` `styleOf`

### Changed

- Design 패널 Size 절: page body 는 Width (breakpoint 폭 — 390 PX) · Height (auto) · Min W/H (Min H = breakpoint 높이) · Max W/H · Overflow 를 보인다 (Ratio 는 page 에 없다). Min/Max 는 컴포넌트와 같은 펼침 토글 뒤에 있고 처음엔 접혀 있다. 저작하지 않은 값은 표시만 하고 저장하지 않아 breakpoint 를 바꾸면 따라간다.
- 선택한 page 의 selection box 오른쪽 · 아래 · 오른쪽 아래 손잡이로 page 프레임 크기를 바꾼다 — 가로는 Width, 세로는 Min H (Height 가 아니다 — body 는 계속 내용만큼 자란다) 를 지금 breakpoint 에 쓴다. 왼쪽 · 위 손잡이는 없다 (page 위치는 page 끌기가 옮긴다).

## [수용했던 ratchet 2 건 — 패널 선택칸의 숨은 option · drag 뒤 명령 버퍼 조각] - 2026-11-13

### Changed

- 패널 선택칸 (`PanelSelect` — Property · 바인딩 · 변수 유형 · 데이터 격자 · AI 설정) 이 닫혀 있는 동안 RAC 에 선택된 항목 하나만 준다 (선택이 없으면 첫 항목 — RAC 는 빈 목록을 열지 않는다). 목록 전체는 열릴 때 준다. RAC `Select` 는 항목마다 숨은 native `<option>` 을 만드는데 (폼 제출 · 브라우저 자동 완성용, 300 항목 이하에서 끄는 prop 없음) 패널은 둘 다 쓰지 않는다. Locale 선택칸 (36 항목) 의 숨은 option 37 → 2. 위치: `components/property/PanelSelect.tsx` `closedItems`. 테스트: `PanelSelect.test.tsx`.
  - 달라지는 동작: 닫힌 선택칸에 focus 를 두고 글자 · ← / → 로 값을 바꾸던 것이 없어진다 (열어서 고른다 — ↓ · Enter · 클릭은 그대로).
  - 외부 사례: Radix Select 는 폼 안일 때만 숨은 select 를 만들고, Ark UI 는 항목이 많으면 `HiddenSelect` 를 쓰지 말라고 안내한다.
  - 숨은 `<select>` 를 직접 조작하던 테스트 5 건은 열어서 항목을 누르는 방식으로 바꿨다.
- Canvas 명령 버퍼가 상한 (16 조각, 큰 문서는 span 수 ÷ 64) 을 넘으면 합친다 — drag 의 splice 가 끌린 subtree 마다 2 조각을 남기는데 합치는 동작이 문서 열기 끝 한 번뿐이었다 (측정: 아무것도 바꾸지 않고 끝난 drag 20 회 뒤 32 조각. 옮기는 drop 은 장면을 다시 묶어 1 조각으로 돌아간다). drag 가 끝난 뒤와 sync 뒤 (gesture · 채움 밖) 에 한 번 확인한다 — 조용한 프레임마다 확인하자 drag 부류의 stream 읽기가 +12 였다. 상한이 문서 크기를 따르는 이유: 합치기는 span 을 전부 다시 읽는데, 상한을 16 으로 고정하자 span 3 만 개 이미지 문서가 이미지 22 장을 받는 동안 8 splice 마다 합쳐 `spanCursorSteps` 가 59,915 → 650,099 로 늘었다 (ratchet 재측정). ÷ 64 면 splice 하나가 치르는 합치기 비용이 문서 크기와 무관하다. 위치: `canvasScene.ts` `canvasBufferPieceLimit` · `compactFragmented`, `CatalogCanvas.tsx`. 테스트: `commandBufferPieceLimit.test.ts`.
  - 외부 사례: VS Code 텍스트 버퍼 (piece tree) 가 편집이 쌓일 때의 정리 단계를 검토 과제로 적었고, qem 은 조각 수 상한에서 강제로 합친다.

### Infrastructure

- ratchet 판정에서 `render.bufferSegmentsAtExec` (그리기 호출 수 × 조각 수) 를 뺐다 — 일의 양이 아니라 상태를 곱한 값이다 (drag splice 로 호출은 3.60M → 1.60M 으로 줄었는데 이 값은 182 → 900). 조각 수는 `render.bufferSegmentsPeak` (A) 가 판정한다 (사용자 승인 2026-11-13). 위치: `perf-ratchet-gate.mjs` `EXCLUDED`.
- 성능 ratchet 기준을 두 수정 뒤 코드 (`cddbad466`) 로 다시 잡았다 — dev 5173 에서 13 run 을 세 번 재어 `--init` (run `60` 은 drag 끝 확인 변경 뒤 다시 세 번), 새 기준으로 세 측정 모두 A 초과 0. 내려간 것: select DOM 자식 변경 922 → 382 · select-spread 423 → 243 · sticky-lists select 787 → 432 · scroll-boxes scroll 370 → 33. 오른 A 1 키: drag `canvasBinding.ts#get stream` 27,793 → 27,794 — drag 가 끝난 뒤 조각 수를 한 번 확인하는 읽기 (사용자 승인 2026-11-13). 위치: `apps/builder/perf/ratchet.json`.

## [Property 탭 generic 렌더러 정리 — 섹션 표 하나 · 슬라이더 범위 catalog 이관 · 안 쓰는 목록 편집기 삭제] - 2026-11-12

### Changed

- 숫자 슬라이더의 범위 · 단위를 catalog 계약이 정한다 — 패널 쪽 키 표 (`SLIDER_RANGE`) 를 지우고 Chart prop (Inner radius · Start/End angle · Grid rings · Animation delay/duration) 에 min · max · step · `unit` 을 선언했다 (`PropContract.unit` 추가). 표에만 있던 `gap` · `columns` · `timeout` 은 catalog 에 그런 숫자 prop 이 없어 지웠다 — 사용자 컴포넌트 숫자 prop 이 그 이름이면 이제 스텝퍼다.
- 섹션 순서 · 제목 · 분류 묶음을 `DISPLAY_SECTIONS` 표 하나가 정한다 (`SECTION_ORDER` · `SECTION_MEMBERS` · 제목 예외 세 곳을 합침). 행 배치 예외는 `ROW_LAYOUT`, 「New table」 자리는 `createsInHeader` 한 판정.
- Chart 의 「Add row」 이름과 컬럼 매핑 셀렉트의 원본 키 모드를 catalog · 필드 표시로 옮겼다 (`itemsManager.itemLabel` · `optionsFromData`) — 컴포넌트 이름 하드코딩 · 곁 목록 (`literalOptionFields`) 삭제.
- 섹션 배치 memo 가 배치에 쓰이는 값의 서명으로 산다 — 편집마다 계약이 새로 만들어져도 정렬 · 행 묶기 · 칩 묶음을 다시 돌리지 않는다. 조건부 표시를 가르는 값이 바뀌면 다시 배치한다.

### Removed

- 목록 편집기 (`ItemsManager`) 의 section · separator 편집 (Add section · Add separator · 묶음 행 · 묶음 선택 모드) — catalog 에서 켜는 곳이 0 이었다 (ListBox · Menu 는 ADR-234 로 자식 instance 편집). 기존 데이터의 `type: "section"` 항목은 일반 행으로 보인다. 공용 `editItems` 명령의 section 지원은 그대로 둔다.
- 아무도 넘기지 않던 조건 축 `parentTag` · `parentTagNot`.

## [성능 회귀 2 건 수리 — 선택 시 원본 찾기 · page 전환 시 Layers 두 번 읽기] - 2026-11-12

### Fixed

- 요소를 고를 때마다 편집 계약이 원본 165 개를 처음부터 훑던 것 — 원본 이름을 id 로 바로 찾는다 (`792815efc` 부터). ratchet select 부류 함수 호출 −14,850 (조사 실측 158,816 → 143,777). 위치: `editContract.ts` `ORIGIN_NAME_BY_ID`. 테스트: `editContractOriginLookup.test.ts`.
- page 를 바꿀 때 Layers 가 같은 행을 두 번 읽던 것 — 렌더에서 읽은 뒤 연결할 때 그 사이 문서 · 데이터 행 · root 가 바뀌지 않았으면 다시 읽지 않고 구독만 붙인다 (`33d58176b` 부터). live (프로젝트 「23」, page 3 → 4 → 5): Layers 다시 만들기 6 → 4 회 · 만든 행 52 → 27. 위치: `layerTree.ts` `connect` · `workspace.ts` `layerInputsVersion`. 테스트: `layerTreeConnectRead.test.ts`.
  - **Why**: ratchet 증가 4 건 조사 (ADR-307 후속 1 의 별도 조사) — 나머지 2 건 (선택 시 Locale 선택칸의 DOM 변경 · drag 명령 버퍼 조각) 은 기능 · 구조 변경의 비용이라 수용.

### Infrastructure

- 성능 ratchet 기준을 두 수리 뒤 코드 (`805dc62bd`) 로 다시 잡았다 — dev 5173 에서 13 run 을 세 번 재어 `--init`, 세 번 모두 같은 값만 A. 내려간 것: select 함수 호출 158,619 → 143,748 · page 전환 Layers 다시 만들기 20 → 10 · 만든 행 20 → 10 · editContract 원본 탐색 14,850 → 0 (목록에서 빠짐). 오른 A 2 키 (page 전환 `controller.ts#current` · `get graph` 177 → 187 · 156 → 166) 는 Layers 수리가 연결할 때 문서 revision 을 한 번 읽는 값. 세 측정에서 값이 갈린 select `PropertySelect` · `I18nProvider` 함수 2 키는 B 로 옮겼다 (오전 재설정 때 남긴 관찰이 다시 나옴). 새 기준으로 세 측정을 판정하면 A 초과 0. 위치: `apps/builder/perf/ratchet.json`.

## [Preview · Publish 는 보이는 page 만 만든다 (ADR-307 후속 2)] - 2026-11-12

### Changed

- Preview · Publish 가 열 때 보이는 page 만 다 만들고 나머지 page 는 틀 (page 루트 record 만) 로 둔다 — page 로 옮겨 가면 그때 채운다 (링크 · navigate 규칙 · 편집기의 page 전환 · 보이던 page 삭제 뒤 첫 page · breakpoint 전환의 새 root). 한 번 채운 page 는 그대로 둔다. 6 page 프로젝트 Publish: 열 때 record 186 (2 page) → 모든 page 를 지나면 723 (변경 전 열 때 723).
  - **Why**: 보이는 route 는 하나인데 Preview · Publish 세션이 모든 page 의 record 를 만들었다 (F10 — ADR-307 의 사용자 결정 3 (a) 로 미뤄 둔 범위).
  - Builder 의 Preview snapshot 이 편집기의 page · breakpoint 를 함께 싣는다 (`view`) — 첫 root 를 그 page 로 만들어, 첫 page 를 다 만든 뒤 편집기 page 로 다시 옮기던 일이 없다.
  - 다른 page 에만 있는 데이터 보기는 그 page 를 보일 때 요청에 실린다 (전에는 보이지 않는 page 의 보기도 요청에 들어갔다).
  - 위치: `catalogPreviewSession.ts` (`openingPage` · `fillShown`) · `compositionRoot.ts` `stagedFirstPage` (page 격자 없는 root 도 단계별 열기) · `preview/protocol.ts` snapshot `view` · `previewChannel.ts`. 테스트: `catalogPreviewStagedPages.test.ts`.

## [단계별 열기 후속 — id 읽기 채움 · 성능 기준 재설정 (ADR-307 후속 1 · 3 · 4)] - 2026-11-12

### Fixed

- 아직 채우지 않은 page 의 노드를 id 로 찾는 동작 12 곳이 빈 결과를 받던 것 (ADR-307 후속 3) — Preview 에서 누른 요소를 Canvas 에서 고르기 · AI 도구 5 · 편집 맥락 · Interactions 대상 · State 칸 · 변수 소유자로 이동 · 데이터 변수 이동 · Layout slot 선택이 `workspace.recordsOfNode` (그 page 를 먼저 채우고 읽음, 채움이 끝나면 바로 반환) 를 쓴다.
  - **Why**: 단계별 열기 뒤 다른 page 는 틀만 있어 노드의 record 가 없다 — 전체 순회만 정적 검사가 잡고 id 읽기는 지나갔다.
  - 위치: `catalogRuntime/workspace.ts` `recordsOfNode`. 게이트: `stagedLoadReaders.static.test.ts` (남은 직접 읽기를 파일별 개수 · 분류로 — 새 직접 읽기는 실패).

### Infrastructure

- 성능 ratchet 기준을 지금 코드로 다시 잡았다 (ADR-307 후속 1, 사용자 결정 A). 11-02 기준을 확정 항목 179 ~ 206 키가 넘어 판정이 「측정 불가」 였다. 크게 늘어난 4 건 (선택의 앱 함수 호출 98,176 → 158,739 · 선택의 DOM 자식 변경 280 → 922 · page 전환의 Layers 재구성 10 → 20 · drag 의 명령 버퍼 조각 182 → 900) 은 별도 조사 항목. 위치: `apps/builder/perf/ratchet.json`.
- ratchet 판정에서 진단용 함수 호출 목록 (`v8.topAll` — ADR-307 하니스가 더한 번들 이름별 목록) 을 뺐다 — 기준에 9,600 키가 섞여 들어갔다. 위치: `perf-ratchet-gate.mjs` `EXCLUDED`.

## [Property 탭 섹션 병합 — 5단계 (Chart 데이터 매핑 → Collection)] - 2026-11-12

### Changed

- Chart 의 데이터가 목록과 같은 Collection 섹션에 선다 (사용자 결정 2026-11-12 — 「Data」 섹션 없음): Data source → Series source (모드) · 값 필드 · 시간축 → Category · Value · Series (축 필드) → Sample Rows, 연동하면 그 아래 Search · filter. Content 에는 차트 종류 · 기준선 · 모양만 남는다. Chart 의 데이터 칸 이름도 목록과 같은 「Data source」, Collection 머리글의 「표 만들기」 도 같이 선다.
- 「Add search」 의 Control 목록에서 그 페이지에 놓인 컨트롤 (「Existing · TextField」) 이 새 컨트롤 종류보다 먼저 선다 — 놓아 둔 컨트롤을 잇는 경우가 더 흔하다 (사용자 결정 2026-11-12). 기본 선택은 그대로 필드 종류. 위치: `CatalogFilterSection.tsx` `AddForm`.
- Collection 은 Data source 행이 늘 첫 행이다. 위치: `Chart.binding.ts` (데이터 키 `section: "collection"`) · `useChartPropertyExtras.tsx` (`sectionLeads`) · `GenericFieldRenderer` `sectionLeads` (섹션 앞머리 — Data source 바로 뒤).

## [Property 탭 섹션 병합 — 3 · 4단계 (고정 섹션을 병합 섹션 안으로 · 필터 진입점은 목록 한쪽)] - 2026-11-12

### Removed

- 필터 컨트롤 (SearchField · Select · RadioGroup · TextField · Slider …) 의 「Filter a list」 섹션과 「Filter a list with this control」 — 필터는 데이터가 연동된 목록의 것이라 진입점을 목록의 Collection 「Search · filter」 하나로 줄였다 (사용자 결정 2026-11-12, ADR-284 Decision 7 「진입점 양쪽」 → 목록 한쪽).

### Added

- 「Add search」 의 Control 선택지에 그 페이지에 놓인 필터 컨트롤이 「Existing · TextField」 처럼 선다 — 고르면 새 컨트롤을 넣지 않고 그 컨트롤이 목록을 거른다 (변수 · 규칙 · 조건 한 step, 옛 「Filter a list with this control」 과 같은 planner). ComboBox 처럼 두 가지로 거르는 컨트롤은 값의 모양을 붙여 둘로 선다. 위치: `viewAuthoring.ts` `catalogFilterControlsOnPage` · `CatalogFilterSection.tsx`.

### Changed

- Property 탭에 따로 서던 고정 섹션 9 개가 병합 섹션 안의 묶음이 됐다 (사용자 결정 2026-11-12):
  - Component properties → Component 끝.
  - Slot (부품 교체 · 넣기 · slot 선언) → Content 끝.
  - Item origin 안내 · Item fields · Item roles · 항목 「+」 (Add content) → Collection (Data source 다음, Search · filter 앞).
  - Show when · Accessibility (ID · Aria label) → Behavior 끝.
  - Set by variable → State 안 (추가는 머리글 「+」 대신 묶음 끝 버튼).
- 섹션 순서: Component → (페이지 Layout · Nested routes · Layout preset) → Content → Value → Collection → Series → Behavior → Locale → State. State 가 늘 마지막이다.
- 옮긴 컨트롤만 든 섹션은 그 요소에서 아무것도 그리지 않으면 제목째 숨는다 (페이지 body 의 빈 Content · Collection). 위치: `GenericFieldRenderer` `EXTRAS_ONLY_SECTION` · `panel-system.css` `.section-when-filled`.

## [Property 탭 섹션 병합 — 1 · 2단계 (Content · Behavior · 속성 재분류)] - 2026-11-12

### Changed

- Design 패널 Property 탭의 Appearance 섹션이 Content 로 합쳐졌다 — 글자 (Label · Description · Placeholder · Icon) 다음에 Variant · Size 와 나머지 모양 옵션이 한 섹션에 선다. Label 과 Label position · Label align · Necessity indicator 를 한 곳에서 고친다. Chart 의 Interaction 섹션은 Behavior 로 합쳐졌다. 섹션 순서: Content → Value → Collection → Series → Behavior → Locale (사용자 결정 2026-11-12 — 컴포넌트마다 속성이 달라 분류마다 섹션을 세우면 접기 헤더만 늘었다). 패널이 속성의 분류를 화면 섹션에 모은다 (`GenericFieldRenderer` `SECTION_MEMBERS`).
- 속성 164 개의 자리가 뜻에 맞게 바뀌었다 (모든 컴포넌트에서 같은 속성은 같은 자리):
  - Content → Behavior: Error message · Name (범위의 Start · End name 포함) · Input type · 링크의 Target · Rel · Checkbox · Switch 의 제출 값.
  - Appearance → Behavior: Select · ComboBox · MenuTrigger 의 메뉴 Align · Direction · Menu width, Popover 의 Placement · Offset · Flip.
  - Content → Value: Min value · Max value · Step (날짜 계열 포함) · Granularity · Placeholder value · 색 조작기의 Color space · Channel. SideNav 의 Selected route · Collapsed 도 Value.
  - Content → Locale: 숫자 Format (NumberField · Slider · Meter · ProgressBar · LabeledValue).
  - Behavior → Content: Badge 의 Dot · Pulsing (모양 옵션).
- Behavior 안의 줄은 동작 → 검증 (Error message · Pattern · 길이) → 폼 (Name) → 오버레이 (메뉴 배치) → 접근성 순서로 선다. Disabled · Read only · Required · Invalid 칩은 그대로 한 묶음.

## [날짜 · 시각 값을 문서가 저장한다 — ADR-309 Implemented (Phase 0 ~ 3)] - 2026-11-12

### Added

- DateField · TimeField · DatePicker · DateRangePicker · Calendar · RangeCalendar 가 `value` · `defaultValue` 를 저장한다 (ISO 글자 — 범위는 `{start, end}`, Calendar 다중 선택은 날짜 목록).
- Design 패널 Value 구획에 날짜 칸 — 날짜 · 날짜+시각 (Granularity 를 따름) · 시각 · 범위 (시작 · 끝) · Calendar 다중 선택의 날짜 목록 (추가 · 삭제). 빌더 패널용 RAC DatePicker (`PanelDatePicker` — 월 · 일 · 연 칸 + 달력 팝업, 범위는 한 칸에 시작 · 끝과 범위 달력, 시각은 TimeField) — select · combobox 처럼 패널 모양을 따른다 (사용자 2026-11-12). 시간대 · 초가 있는 기존 값은 고쳐도 그대로 남고, 키보드로 친 날짜는 칸을 떠날 때 (또는 Enter) 저장된다. 변수 표 · 데이터 격자 · 행 폼의 날짜 칸도 같은 달력 칸이다 (`DateValueInput` 이 `PanelDatePicker` 를 감싼다 — Enter · Tab · Esc · ⌘Z 와 칸을 떠날 때 저장은 그대로, 달력을 닫으면 focus 가 칸으로 돌아온다). 시각 칸은 고치는 컴포넌트의 Hour cycle · Force leading zeros 를 따른다 — TimeField 는 기본 24시간, 12 로 바꾸면 AM · PM, 앞자리 0 은 기본 켜짐 (Design 패널 · Interactions 규칙 인자, 사용자 2026-11-12). ISO 글자 전환 버튼은 없어졌다 (사용자 2026-11-12 「불필요한 기능」). Min · Max · Placeholder value 도 같은 날짜 입력이 됐다 — 날짜로 읽을 수 없는 기존 글자는 지우지 않고 표시한다.
- Canvas 가 날짜 값을 그린다 — 입력 칸의 날짜 글자 (Preview 와 같은 형식), 달력의 선택 원과 범위 띠, 선택한 날짜가 있는 달. DatePicker · DateRangePicker 의 달력은 값이 있으면 Placeholder 보다 값의 달을 연다.
- Code 보기가 날짜 값을 레퍼런스 표기로 쓰고 다시 읽는다 — `value={parseDate('2026-11-12')}` · `parseDateTime` · `parseTime` · `parseAbsolute('…', 'UTC')`, 범위 `{{start: …, end: …}}`, Calendar 다중 선택 `{[…]}` (`@internationalized/date` import 포함).
- Interactions 규칙의 날짜 인자 (날짜 계열의 값 · Min · Max · Placeholder 정하기) 가 Design 패널과 같은 날짜 입력이 됐다 — TimeField 는 시각, 범위는 시작 · 끝, 값 고르기는 그대로.

### Changed

- 날짜 글자를 읽는 함수 하나 (`catalog/runtime/dateValueRead.ts`) — Preview DOM · Canvas 달력 · 규칙 시작 값이 같이 읽는다. 시작 값은 `value`, 없으면 `defaultValue` (실행 중 지운 값은 시작 값으로 돌아가지 않는다).
- Canvas 달력의 Min · Max 날짜 읽기가 Preview 와 같아졌다 — 앞뒤 공백을 읽고, 날짜 뒤 덧붙은 글자는 읽지 않으며, offset 이 붙은 시각은 Preview 가 보여 주는 날 (UTC) 로 읽는다.

### Fixed

- 날짜만 있는 값을 시 · 분 · 초 단위의 DateField · DatePicker 에 주면 Preview 가 비던 결함 — 그날 자정으로 넘긴다.
- TimeField 가 날짜+시각 값 (`2026-11-12T10:30`) 을 23:30 으로 보이던 결함 — 그 시각 (10:30) 을 보인다.
- Calendar 다중 선택의 날짜 목록이 Preview 를 멈추고 (RAC 예외), 선택 뒤 쉼표로 이은 글자 하나로 저장되던 결함 — 날짜 목록으로 읽고 쓴다.
- Calendar · RangeCalendar (와 DatePicker · DateRangePicker 의 달력) 에 Min · Max 를 넣어도 Canvas 가 범위 밖 날짜를 흐리게 그리지 않던 결함 — RAC 가 막는 날짜 (`data-disabled`) 를 Canvas 달력도 S2 `disabled` 글자색으로 그린다. **Why**: 흐림 색이 수동 `CalendarCommon.css` 에만 있어 Canvas 가 읽을 곳이 없었다 — catalog rule 날짜 칸 상태 (`color.isDisabled`) 로 옮겨 두 consumer 가 같이 읽는다.
- 변수 표 · 데이터 격자의 날짜 칸에서 달력으로 날짜를 고르면 포커스가 둘레 표 칸으로 가, 편집이 열린 채 Enter 가 먹지 않던 결함 — 달력이 닫힐 때 RAC 의 포커스 복원 이벤트를 날짜 편집기가 자기 안에서 멈춰 포커스가 달력 버튼으로 돌아온다 (둘레 RAC 표가 그 이벤트를 취소하고 자기 칸에 포커스를 주었다).
- 행 폼 · 필드 기본값의 날짜 칸이 오류 문구와 이어지지 않던 결함 (`aria-describedby` 가 날짜 칸에서 버려졌다) — 다른 칸처럼 오류 문구가 날짜 칸을 설명한다.

## [선택 · 펼침은 그룹이 저장한다 — ADR-308 Implemented (Phase 0 ~ 3)] - 2026-11-12

목록 · 탭 · 라디오 · 토글 그룹 · Accordion 의 「무엇이 선택 · 펼쳐졌나」 를 항목이 아니라 그룹이 갖는다 (레퍼런스 S2 · RAC 와 같은 자리 — 그룹의 `selectedKey(s)` · `value` · `expandedKeys`, 항목은 `id`).

### Breaking Changes

- **문서 계약 63 → 64 — 계약 63 프로젝트는 열리지 않는다** (ADR-308 Phase 3 · 사용자 결정 1 (a)): 원본 항목의 선택 기본값이 바뀌고 항목 `isSelected` 계약이 빠져, 저장소 정책대로 이전 계약 문서는 `UNSUPPORTED_LIBRARY_CONTRACT` 로 거부된다 (변환 코드 없음 — 개발 단계). ADR-306 의 계약 올림은 65 로 옮겼다.
- **항목 `isSelected` 삭제**: Tab · Tag · ListBoxItem · GridListItem · TreeItem · Row · SelectBox · Radio 는 `isSelected` 를 받지 않는다 — 선택은 그룹의 값이다. `isSelected` 는 혼자 놓는 Card · Checkbox · Switch · ToggleButton 에만 남는다 (그룹 안이면 그룹이 정한다).

### Changed

- **Design 패널: 그룹의 Value 구획에 선택 칸 하나** (ADR-308 Phase 2 · 사용자 결정 3 · 4):
  - 단일 선택 (Tabs · SegmentedControl · ComboBox · Select · RadioGroup · 단일 펼침 Accordion) 은 항목 드롭다운, 다중 선택 · 펼침 (ListBox · GridList · Table · Tree · TagGroup · Menu · CardView · ToggleButtonGroup · SelectBoxGroup · CheckboxGroup · Tree · 다중 Accordion) 은 항목 체크 목록. 데이터에 연결된 목록은 그려진 표본 행의 key 가 선택지다.
  - 항목의 Selected 스위치는 없어졌다 (그룹 안 Card · ToggleButton · Checkbox 는 「그룹에서 편집」 안내, 혼자 놓인 것은 그대로).
  - 항목 Content 에 **「Item ID」** (사용자 결정 2) — 그룹 선택이 가리키는 이름 (`home` 처럼). 고치면 그룹의 선택 · 펼침 값과 짝 TabPanel 이 같은 단계에서 따라간다. 항목을 지우면 그룹 값에서 그 key 가 빠진다.
  - **Why**: 선택이 항목의 `isSelected` 에 저장돼 그룹 칸은 Tabs · RadioGroup 둘뿐이었고 (나머지는 칸 없음), instance 마다 다른 선택 · 컴포넌트 속성 · 데이터 행 선택이 구조상 불가능했다.
- **Canvas · Preview · 규칙 (Do) 이 같은 판정을 읽는다**: `runtime/groupSelection.ts` 하나 — Preview 의 RAC 에 넘기는 항목 key 도 같은 함수라 HTML id 를 단 Row · 그룹 안 ToggleButton · Accordion 안 Disclosure 가 더 이상 다른 key 로 그려지지 않는다. 그룹 안 항목을 대상으로 한 check · uncheck · 펼치기 · 접기 Do 는 그룹 값에 그 항목 key 를 넣고 뺀다.
- **옛 문서**: 항목에 저장된 Selected · 펼침은 읽지 않는다 (개발 단계 — 변환 코드 없음, ADR-308 Decision 6). 계약 번호는 64 로 올렸다 (위 Breaking).
- **칸 이름 정리** (사용자 요청 2026-11-12): Checkbox · Radio · Switch 의 Content 「Value」 → **「Submit value」** (폼이 보내는 값 · 그룹 안에서는 항목 key — Value 구획 이름과 겹쳐 헷갈렸다), Autocomplete 「Default input value」 → **「Input value」** (Value 구획의 다른 칸처럼 Default 를 뺐다). 빠져 있던 「Item ID」 번역 (「항목 ID」) 도 넣었다.
- **Code 보기 = 레퍼런스 코드 모양** (Phase 3): `<Tabs defaultSelectedKey="tab-2">` · `<Tab id="tab-1">` · `<ListBox defaultSelectedKeys={['starred']}>` — 그룹 값 · 항목 `id` 가 한 번씩 나오고, 항목에 HTML id 가 있어도 `id=` 를 두 번 쓰지 않는다 (R6).

- **Library 원본의 선택 · 펼침 항목이 모두 key 를 갖는다**: Tabs (Tab `tab-1` · `tab-2` + 짝 TabPanel `itemId`) · TagGroup · Menu · Select · ComboBox · ToggleButtonGroup · CardView · Table Row · Accordion 의 항목에 작성 `id`, CheckboxGroup 의 Checkbox 에 `value` (`option1` · `option2`). 새로 놓은 그룹의 Code 보기에 `<Tab id="tab-1">` 처럼 나온다. Row · Card · ToggleButton · Disclosure 가 문서에서 `id` 를 받는다.
- **그룹이 선택 · 펼침 속성을 받는다** (Phase 1): ListBox · GridList · Table · Tree · TagGroup · Menu · CardView · ToggleButtonGroup `selectedKeys` · `defaultSelectedKeys`, ComboBox `selectedKey` · `defaultSelectedKey`, Select `value` · `defaultValue` (S2 Picker — 단일 = key, 다중 = key 목록: 새 값 형 `selectionValue`), CheckboxGroup `value` · `defaultValue`, RadioGroup `defaultValue`, Tabs `selectedKey`, Tree · Accordion `expandedKeys` · `defaultExpandedKeys`.
- **그룹 「+」 가 새 항목에 겹치지 않는 key 를 준다**: ToggleButton `toggle-N` · Disclosure `section-N` · SegmentedControlItem `item-N` · Checkbox · Radio `optionN` — 형제를 복사해 넣어 key 가 겹칠 때도 (전에는 Radio 만, 값이 없을 때만).

### Fixed

- **같은 그룹 안 복제 · 붙여넣기의 key 중복**: 개명이 Tabs · TagGroup · ListBox 등 8 가족에서만 돌았다 — CardView · Table · ToggleButtonGroup · Accordion · SegmentedControl 과 그룹 안 Radio · Checkbox `value` 까지 넓혔다. 항목에 key 가 생긴 뒤 같은 그룹 안 복제가 RAC 「Duplicate key」 로 Preview 전체를 멈추지 않게 (Decision 7 · R4).
- **자식이 있는 TreeItem 을 복제 · 붙여넣으면 자식 항목 key 가 원본과 겹치던 결함** — 놓는 자리가 instance 의 slot 이면 key 수집이 직계 자식만 봤다 (`collectionKeys`).
- **「검색 추가」 로 넣은 CheckboxGroup 이 필터 변수를 보여 준다** (ADR-284 Phase 6 의 「컨트롤이 변수를 읽는다」 가 CheckboxGroup 에서만 빠져 있었다):
  - **Why**: CheckboxGroup 이 `value` 를 받지 않아 변수 연결이 버려졌다. Phase 1 로 받게 되자 변수의 시작값 `null` 이 렌더에 그대로 들어가 Preview 가 멈췄다 → `null` = 빈 선택으로 읽는다 (`delegatedDom.runtime.ts` `checkboxgroup`).
- **단일 선택 ToggleButtonGroup 을 규칙으로 고르면 아무것도 눌리지 않던 결함** (Phase 2 시험이 찾음): 그룹 key 목록을 문자열로 썼다 — 값 모양은 속성 형을 따른다.
- **ComboBox 의 기본 선택을 바꾸면 Canvas 의 옵션 체크가 따라오지 않던 결함**: 옵션 갱신 의존이 Select 에만 있었다.
- **Select · ComboBox · ListBox 의 Value 칸 선택지가 「{label}」 로 나오던 결함** (Phase 3 live 가 찾음):
  - **Why**: 선택지 글자를 항목의 `children` 에서 읽었는데, 원본 항목의 `children` 은 글자가 아니라 template 바인딩 (`{label}`) 이다 → 바인딩 꼴은 건너뛰고 label 부품의 글자 (Aardvark · Cat …) 를 읽는다 (`singleSelection.ts`).
- **Code 보기에서 그룹의 선택 목록을 고치면 적용이 거절되던 결함** (`defaultSelectedKeys={['archive']}` · `expandedKeys` · CheckboxGroup `value`):
  - **Why**: 생성기는 목록을 배열로 쓰는데 되읽기는 `new Set([...])` 만 받았다 — 이 ADR 이 그룹에 목록 속성을 열며 드러났다 → 배열 리터럴을 읽는다 (항목 형은 문서 검증이 본다, `codeViewEdit.ts`).
- 위치: `packages/shared/src/catalog/runtime/groupSelection.ts` (새 판정 함수) · `runtime/{presence,delegatedDom.runtime,domBinding.runtime,catalogPreviewInteractions}.ts` · `interactions/dispatcher.ts` (`groupStateOf`) · `commands/{collections,structure}.ts` · `apps/builder/src/builder/catalogRuntime/singleSelection.ts` (그룹 칸 · Item ID · 항목 선택 쓰기) · `panels/properties/{catalog/CatalogPropertiesPanel.components.tsx,generic/SelectionKeysField.tsx}` · `document/{ruleDefinition,itemLinks,generated/reusableOriginLibrary}.ts` · `bindings/*.binding.ts`.
- 테스트: `adr308SelectionItemKeys.test.tsx` (16 가족 원본 key · 복제 · 붙여넣기 + 「+」) · `adr308GroupSelection.test.tsx` (Canvas = RAC 11 그룹 · 증분 = 새 bind 10 · Item ID · 삭제 · 칸 선택지 글자) · `adr308GroupItemDo.test.tsx` (Do 행렬) · `adr308GroupSelection.static.test.ts` (항목 Selected 읽기 · 쓰기 목록화) · `adr308CodeView.test.tsx` (Code 보기 왕복 4) · `propSectionConsistency.test.ts` (`isSelected` 는 단독 4 type 만 · 17 그룹이 Value 구획에 선택 칸).

### Performance

- 번들 (`vite build` → `adr209-bundle-closure.mjs`, ADR-308 착수 HEAD 대비): Builder initial JS gzip +1,655 B · Preview −1 B (ADR-201 Δ 상한 +4,096 · +3,584 안). 절대 상한 1,414,000 초과는 착수 전 HEAD 부터 (1,522,678 — 원인 미조사).

## [Design 패널 「Value」 구획 — 상태 값 재배치 · 같은 개념 한 칸] - 2026-11-12

사용자 결정 (「중복 제거와 재배치부터」): 컴포넌트가 지금 담고 있는 것 — 레퍼런스 (설치된 S2 · RAC) 의 고유 state — 을 한 구획에 모으고, 빌더에서 같은 일을 하는 두 칸은 하나만 낸다. 칸 모양 (고르기 · 목록) 은 뒤에 정한다.

### Changed

- **새 구획 Value (Content 바로 뒤)**: 값 (`value` — 입력 · 숫자 · Slider · RadioGroup · Color · ProgressBar · Meter 등), 선택 (`isSelected` · `isIndeterminate` · Tabs 「Selected tab」 · SegmentedControl · SelectBoxGroup 선택 키), 열림 (`isOpen` — trigger · picker 14 종), 펼침 (Disclosure `isExpanded`), Autocomplete 입력값이 Content · Behavior 에서 옮겨 왔다. Checkbox · Radio · Switch 의 `value` (폼 전송 값) 는 Content 에 남는다. 2026-10-13 판정 (값 · 선택 = Content, 열림 · 펼침 = Behavior) 을 대체한다.
- **같은 개념은 한 칸**: 「Initially open」 (14 종), SegmentedControl 「Default selected key」 와 「Selected key」, SelectBoxGroup 「Default selected keys」 와 「Selected keys」 를 한 칸씩으로 — 빌더에서는 둘 다 「처음 상태」 로만 쓰여 같은 일을 했다. 숨긴 쪽은 받기는 하므로 옛 문서 값 · Code 출력 · Preview 동작은 그대로다. Color 조작기 4 종의 「Default Value」 라벨은 「Value」 (ColorField 와 같게).
- 위치: `packages/shared/src/catalog/bindings/*.binding.ts` (36) · `overlayOpenProps.ts` · `document/itemLinks.ts` · `apps/builder/src/builder/panels/properties/generic/GenericFieldRenderer.tsx` (`SECTION_ORDER`). 게이트 `propSectionConsistency.test.ts` (Value 구획 · 한 개념 한 칸).

## [열린 Sheet · fixed 상자가 다른 페이지에 그려지던 결함] - 2026-11-12

### Fixed

- **Home 이 아닌 페이지에서 Sheet 의 Open 을 켜면 Sheet 가 Home 페이지 위에 그려지던 결함** (선택 테두리는 제 페이지에 남음):
  - **Why**: fixed 상자 (열린 Sheet · Popover portal · 저작 `position: fixed`) 는 부분 재기록을 막으려고 stream 의 top layer 목록에 들지만, 명령은 자기 페이지 자식 안에 페이지 기준 좌표로 기록된다. viewport · damage 실행의 명령 묶음 (`buildDamageRenderCommandSequence`) 이 이 상자를 조상 없는 root 로 잘라 페이지 이동이 빠졌고, 장면 원점 (= Home 자리) 에 그렸다. 페이지가 원점에 있는 Home 에서는 드러나지 않는다.
  - 수정: 조상 없이 실행하는 root 는 stream 최상위에 장면 좌표로 기록되는 drag top layer (`topLayerSubtree`) 로만 한정 (`workspace/canvas/skia/renderCommands.ts`). 회귀 테스트 `viewportExecution.test.ts` 「fixed 상자는 자기 page 의 원점에서 그린다」 2 건 (viewport · damage).

## [빌더 Toast = S2 모양 · Site 「Toast placement」 select 하나] - 2026-11-11

### Changed

- **빌더 알림 Toast = S2 `Toast`** (사용자 「builder 의 toast 를 S2 형태로」 · 「Compare mode CSS 의 S2 Toast 와 다르다」 → 「빌더 chrome 판 S2」):
  - 구조 · 동작은 Preview 와 같은 `ToastRegion` — 여러 개가 한 장으로 겹쳐 쌓이고 (뒤는 색 조각 3 장까지) 「Show all」 로 펼치면 덮개 · 「Clear all」 · 「Collapse」, view transition 으로 들고 남. RAC toast 접근성 (region · `alertdialog` · F6) 도 그대로.
  - **Why**: 첫 수정은 기존 목록 (전부 세로 나열 — RAC starter 모양) 에 색만 S2 로 칠해 Compare mode 의 S2 Toast 와 달랐다. ADR-305 로 빌더 문서는 `catalog-toast` 시트 · 테마 변수를 싣지 않으므로, `ToastRegion` 에 skin (class 접두 · inline 크기 · 색 · action 버튼 시트 · 문구) 을 받게 하고 빌더는 `builder-toast` 시트를 소유한다 (`packages/shared/src/components/ToastRegion.lazy.tsx` `ToastRegionSkin` · `CATALOG_TOAST_SKIN` — Preview · Publish 는 무변경).
  - 모양: variant 색 면 (S2 semantic 값 — `builder-system.css` `--toast-*`) · 흰 글자 14 · 아이콘 (neutral 없음) · 흰 테두리 pill action (Undo 등) · 원형 닫기 · 최소 높이 56 · 최대 폭 336. S2 toast 에 warning 이 없어 빌더의 `warning` 은 neutral.
  - store (`stores/toast.ts`) 는 그대로 정본 — `ToastContainer` 가 store ↔ RAC queue 를 잇는다 (추가 · 해제 · 닫기 버튼 · 「Clear all」), 자동 해제 시간은 store 의 것이고 region 의 hover · focus 정지가 store 타이머도 멈춘다. region 모듈은 첫 토스트와 함께 읽는다. 위치는 캔버스 우하단 (action bar 비켜 감) 그대로.
  - **자리 = Settings 「Toast placement」 (빌더 설정)** — 빌더 알림 자리는 Settings 의 Appearance 절 (S2 placement 네 값, 기본 `bottom`, `uiStore.toastPlacement` — localStorage, 프로젝트와 무관) 이고, 앱 토스트 자리 (Site 「Toast placement」 — 프로젝트 문서 값) 와 따로다 (사용자 결정 2026-11-12 「setting (빌더측) 와 site 측 각각」). **Why**: 처음엔 `ToastContainer` 가 `bottom end` 고정이었고, 이를 Site 값에 묶으면 앱 토스트 자리를 바꿀 때 빌더 알림까지 움직이고 빌더 취향이 문서 · Undo · Publish 에 섞인다. 위 자리는 헤더 줄 아래 (52px — 16 이면 viewport controls 를 덮는다), 아래 자리는 action bar 한 줄 위.
  - **기본 자리 = `bottom` (S2 `ToastContainer` 기본)** — 빌더 설정 · 앱 (Site — 문서에 값이 없을 때, `catalogToastPlacement`) 둘 다 (사용자 「둘 다 기본값 Bottom 으로」). 종전 앱 기본 `bottom end` → 값을 고르지 않은 프로젝트의 Preview · Publish 토스트가 아래 가운데로 옮겨진다.
  - 위치: `apps/builder/src/builder/components/feedback/{Toast.tsx,ToastContainer.tsx,Toast.css}` · `stores/uiStore.ts` · `panels/settings/SettingsPanel.tsx` · 테스트 `ToastContainer.test.tsx` (stack · store ↔ region 양방향 · 설정 자리) · `SettingsPanel.test.tsx` · `toastSingleContainer.static.test.ts`.
- **Site 패널 앱 절의 토스트 위치를 select 하나로**: 「Toast placement」 (위 · 아래) + 「Toast align」 (가운데 · 끝) 두 칸 → S2 `ToastContainer` `placement` 와 같은 네 값 (Top · Top end · Bottom · Bottom end) 의 select 한 칸 (`panels/site/SitePageSections.tsx`). 저장 값 (`toastPlacement`) 은 변화 없음.

## [Overrides 정리 — 원래 값으로 되돌리면 변경 이력이 남지 않음 · 버튼 문구] - 2026-11-11

### Fixed

- **Style · Fill · 캔버스 글자 편집 · 캔버스 Padding/Gap · 크기 손잡이로 바꿨다가 원래 보이던 값으로 되돌려도 Overrides 에 남던 결함** (사용자 결정 「보이던 값과 같으면 지움」):
  - **Why**: 이 경로들은 원본 값과 비교하지 않고 늘 자기 값을 썼고, Overrides 목록은 자기 값이 있으면 무조건 한 줄로 보인다.
  - 수정: 쓰기 명령을 stage 에 올린 뒤 바뀐 키마다 「그 키를 지운 문서」로 record 를 세 breakpoint 에서 다시 해석해, 값 · 토큰 출처 · fill 이 모두 같으면 같은 step 안에서 지운다 (`catalogRuntime/restoredWrites.ts` `catalogDropRestoredWrites` · composition root `resolveRecordOver`). Undo 한 번이면 바꾼 값으로 돌아간다. 회귀 테스트 `restoredWrites.test.ts` 4 건.
- **직접 만든 컴포넌트의 instance 에서 px 폭 · 높이를 바꿔도 Canvas 에 반영되지 않던 결함**:
  - **Why**: resolver 가 instance 의 `sizing` 을 먼저 놓고 template 노드의 `sizing` 으로 덮었다 — visual · layout 은 instance 가 이기는데 sizing 만 거꾸로였다 (패널은 작성값을 읽어 240 을 보였다).
  - 수정: template 값 다음에 instance 값 (`resolver.ts`). 회귀 테스트 `instanceRootSizing.test.tsx`.
- Size mode 칸이 작성값만 읽어, 규칙이 fit-content 인 요소 (Button) 의 Fit 이 「—」로 보이던 표시 — 작성값이 없으면 그려진 값으로 판정 (`TransformSection.tsx`).

- **Overlay (Dialog · Popover · Sheet · Tooltip) · Menu 의 Behavior 「Open」 을 켰다 끄면 instance Overrides 에 `isOpen` 이 남던 결함**:
  - **Why**: `isOpen` 은 trigger context · `defaultOpen` 을 가리지 않으려고 기본값이 없다 (`OVERLAY_OPEN_PROPS`) — 기준값 = 없음 (꺼짐으로 표시). 칩을 끄면 `false` 를 써서 기준 (없음) 과 달라 override 로 남았다.
  - 수정: 기준값이 없는 boolean 칩을 끄면 `false` 대신 자기 값을 지운다 (`GenericFieldRenderer` `ChipGroupField`). 기준값이 `true` 면 끄기는 그대로 `false`. 회귀 테스트 `GenericFieldRenderer.test.tsx` 「기준값 … 인 isOpen 을 켠 뒤 끄면」 2 건. 이미 `false` 로 남은 override 는 Reset 또는 칩을 켰다 끄면 지워진다.

### Changed

- Design 패널 Overrides 의 일괄 버튼 문구를 줄였다 — 「Reset all changes」 → 「Reset」, 「Push changes to component」 → 「Push」 (한국어 「초기화」 · 「반영」). 접근 이름과 캔버스 메뉴 · History 문구는 그대로.

## [속성 감사 — 맞지 않는 · 불필요한 속성 정리 (page · 컴포넌트)] - 2026-11-11

사용자 지적 (「page 에 disabled · read only · required」 · 「Home 에 parent page 가 있을 수 없다」) 으로 binding 175 종의 속성을 S2 · RAC 출처와 대조했고, 사용자 결정 4 건을 적용했다.

### Changed

- **page 의 Behavior 구획이 없다**: Disabled · Read only · Required 는 page 자신의 상태가 아니라 안쪽 요소에 내려주는 값이라 Design 패널에서 뺐다 (운반 값 — `CATALOG_PAGE_INHERITED_PROP_CONTRACTS`). Interactions 의 「Disable all inside」 등 Do 9 종과 Preview 의 상속은 그대로다 (ADR-281 결정 3 의 패널 노출만 바뀜).
- **frame 의 Behavior 는 Disabled · Read only 둘**: Required 는 field · Form 의 것이라 패널에서 뺐다 (Do 「Make all inside required」 는 그대로).
- **열림 (Open · Initially open) 은 여는 쪽에서만**: trigger · picker 안의 Popover · Modal · Tooltip · SheetOverlay 는 그 두 칸을 내지 않고 「…edited on the DialogTrigger」 안내를 낸다 (`catalogOwnerDecidedProps`). **Why**: 본체가 자기 `isOpen` 을 가지면 RAC 에서 trigger 의 press 가 본체를 열지 못한다. 혼자 선 본체는 그대로 자기 값을 갖는다.
- **개발자용 HTML · ARIA 속성을 패널에서 숨김** (`editorHidden` — 받기는 하므로 옛 문서 값 · Code 는 그대로): Link · LinkButton `download` · `hrefLang` · `ping` · `referrerPolicy` · `aria-current`, TextField · TextArea · SearchField `autoComplete` · `autoCorrect` · `inputMode` · `enterKeyHint` · `spellCheck`, Form `action` · `method` · `encType` · `target`, Autocomplete `disableAutoFocusFirst` · `disableVirtualFocus`, SelectBoxGroup `escapeKeyBehavior`, RangeSlider `form`, 그리고 7 종에만 보이던 `aria-labelledby` · `aria-describedby` · `aria-details`. 숨긴 속성의 유도 Do 도 Interactions 목록에서 빠진다.

### Removed

- **표시용 컴포넌트의 Disabled**: Badge · Avatar · AvatarGroup · StatusLight 의 `isDisabled` (S2 에 없음 — v3 · composition 확장) 를 binding · rule 의 disabled 흐림 · DOM 컴포넌트 · 생성 CSS 에서 지웠다. 옛 문서의 값은 로드 때 버린다 (`s2PropAlignment.ts` `UNUSED_PROPS`).

### Fixed

- **Home 페이지를 다른 페이지 아래로 넣거나 주소를 `/` 밖으로 바꿀 수 있던 결함**:
  - **Why**: Nested routes 구획이 모든 페이지에 조건 없이 나왔고 (`CatalogPageSection`), 부모 후보 목록 · `updatePage` 명령 어디에도 Home 검사가 없었다. 「Generate from title」 은 Home 에 `/home` 을 썼다. Home 판정도 두 벌이었다 — Navigator 는 「부모 없는 route `/`, 없으면 첫 root 페이지」, Canvas 는 첫 페이지.
  - 수정: Home = 프로젝트 첫 페이지 한 정의 (`catalogHomePageId` — Navigator 트리 · Canvas 페이지 격자 · 페이지 설정이 같이 읽는다). Home 에서는 Parent page 칸과 Generate 버튼이 없고 Route `/` 는 읽기 전용이다. 명령도 거절한다 (`HOME_PAGE_FIXED` · 패널 안내 `ROUTE_HOME`). Navigator 검색 중에 Home 이 걸러지면 첫 결과가 Home 아이콘을 받던 것도 같이 고쳐졌다.

- 위치: `packages/shared/src/catalog/bindings/{inheritedProps,Body.binding,Link.binding,Form.binding,…}.ts` · `runtime/ownerDecidedProps.ts` · `commands/project.ts` · `apps/builder/src/builder/catalogRuntime/pageSettings.ts` · `panels/properties/catalog/CatalogPageSection.tsx` · `panels/navigator/tree/PageTree/buildPageTree.ts`. 테스트 `propertySurfaceAudit.test.ts` (신규) · `unusedPropRemoval` · `phase4ePageSettings` · `phase4ePropertySections` · `project.test.ts`, 원복 RED 8/8. 뒤로 미룬 것: 같은 개념의 칸 통일 (SegmentedControl · SelectBoxGroup 의 선택 값, Color 조작기의 `defaultValue`).

## [토큰 칸 끌기 시작값 수리 — PropertyUnitInput scrub] - 2026-11-11

### Fixed

- **토큰 값 칸 (Padding · Gap · Radius · Border Width · Font Size) 을 label 로 끌면 0 부터 시작하던 결함**:
  - **Why**: 칸 글자가 단계 이름 (「M」) 으로 바뀐 뒤 (`1901c0507`) ▲▼ 만 토큰의 해석 px 를 읽게 고쳤고, label 끌기는 그대로 칸 글자를 숫자로 읽어 NaN → 0 에서 시작했다. ⌥ 자유값 끌기는 M(12) 에서 +4 가 4 로, 단계 끌기는 M 에서 한 칸이 L 이 아닌 0 기준 단계로 갔다.
  - 수정: ▲▼ 와 끌기가 보이는 숫자를 한 함수 (`shownNumber`) 로 읽는다 — 토큰은 해석 px.
  - 같은 결함 하나 더: Position inset 칸에서 토큰 (M) 의 단위를 % 로 바꾸면 12% 가 아니라 기본값 100% 가 저장됐다. 단위 변경도 같은 함수를 읽는다.
  - 위치: `apps/builder/src/builder/components/property/PropertyUnitInput.components.tsx`. 회귀 테스트 `adr298TokenPreview.test.tsx` (끊겨 있던 token scrub 3 건 + 단계 끌기 1 건).

## [ADR-307 후속 — 큰 바운드 목록의 행 창 · 문서 graph 한 번만 만들기] - 2026-11-11

### Performance

- **큰 바운드 목록의 행 창 (ADR-157 결정 복원)**:
  - **Why**: Canvas 가 내용 따라 늘어나는 바운드 ListBox · GridList · Table 의 행을 표본 (10 행) 밖까지 전부 record 로 만들고 숨기기만 했다 — 1,000 행 ListBox 가 든 page 의 채움 task 가 4x 251 ms.
  - 변경: 표본 밖 행은 만들지 않는다. 표본 = 그 목록이 page 에서 보이는 행 + 1 — (page 높이 − 첫 행 위치) ÷ 배치에서 잰 줄 간격 + 1 (page 높이를 작성하면 그 높이, 없으면 breakpoint 화면 높이 — page 마다 다를 수 있고, page 아래쪽에서 시작하는 목록은 더 적게 만든다). 나머지 영역은 줄 간격 × 남은 줄 수만큼 비워 두어 목록 아래 요소의 위치는 Preview 와 같고, 그 자리에 「+N more」 를 표시한다. Preview · Publish 는 그대로 모든 행을 그린다.
  - 측정 (production, 교대 3쌍 중앙값): 1,000 행 ListBox page 의 가장 긴 채움 task 4x 249 → 167 ms · 1x 60 → 45 ms, record 7,384 → 6,295. 행 소스가 이미 100 행 창이라 종전에도 100 행만 만들어졌다.
- **문서 열기에서 graph 를 한 번만 만든다**: 저장소에서 읽은 문서를 검사용과 열기용으로 두 번 graph 로 만들던 것을 한 번으로 (`storage.loadGraph`). 66 장 4x 열기 2,768 → 2,415 ms.
- **문서 열기 검증에서 같은 정의의 계약 계산을 재사용한다**: 전체 검증 호출 안에서만 accepts·propChoices를 캐시하며 instance별 검사는 유지한다. 66 장·4x 참조·구조 검사 중앙값 132.4→129.5 ms로 절감 폭은 작고, 전체 열기의 유의한 개선은 미입증이다. 객체 저장 비교는 읽기·쓰기 모두 느려 현행 JSON 형식을 유지한다. [측정과 한계](explanation/research/CATALOG_DOCUMENT_READ_COST_2026-11.md).
- **문서 열기의 entry 검사 · 복제를 줄인다**:
  - **Why**: 저장소에서 읽은 문서의 entry 마다 형식 검사를 세 번 (`createCatalogGraph` · graph 생성자 · `validateView`) 하고, 방금 읽어 graph 만 쥐는 entry 를 다시 `structuredClone` 했다 — page 수에 비례하는 열기 비용.
  - 변경: 형식 검사는 entry 마다 한 번, 저장소에서 읽은 entry 는 복제 없이 제자리에서 굳힌다 (`createCatalogGraph` 의 `adopt` — `storage.loadGraph` 만). import · Preview 처럼 넘긴 문서를 쥐는 길은 종전대로 복제한다.
  - 측정 (production, 교대 3쌍 `ready` 중앙값): 66 장 1x 692 → 637 ms · 4x 2,382 → 2,181 ms · 22 장 4x 2,005 → 1,911 ms (범위 안 겹침), 22 장 1x 는 노이즈. 위치: `packages/shared/src/catalog/document/graph.ts` · `runtime/storage.ts`.

## [ADR-307 Implemented — 문서 열기 단계별 빌드] - 2026-11-11

### Performance

- **ADR-307 Implemented (G6 사용자 확인)**: 큰 문서가 현재 page 부터 열리고 나머지 page 는 차례로 채워진다 (아래 Phase 0 ~ 4 엔트리). 사용자 확인 — 현재 page 가 바로 뜨고 나머지가 차례로 채워짐 · 채우는 중 page 전환 · 편집 · undo 동작. 실제 Chrome (dev) 66 장 문서: 현재 page 0.8 초 · 전체 3.7 초 (1x), 단계별로 연 결과 = 일괄로 연 결과.
  - 후속으로 남긴 것: 큰 바운드 목록 (1,000 행 ListBox) 의 행 창 · 편집 · page 전환 뒤 drag 의 문서 크기 배율 1.36 (이 변경 전부터) · ratchet 기준 재설정 · 문서 읽기 · 검증의 page 당 비용.

## [ADR-307 Phase 4 — 문서 열기 단계별 빌드 기본 켬: 큰 문서가 현재 page 부터 열린다] - 2026-11-11

### Performance

- **ADR-307 Phase 4 닫힘 (G4 · G5)**:
  - **Why**: 문서를 열 때 모든 page 를 한 번에 펼치고 배치해 열기 시간이 page 수에 비례했다 — 66 장 문서가 1x 2.3 초 · 4x (사용자 Chrome 설정) 8.6 초.
  - 변경: 단계별 열기를 기본으로 켰다. page 틀을 먼저 세우고 현재 page 를 채운 뒤, 나머지는 한가할 때 화면에 걸친 page 부터 채운다 (틀 page 에는 옅은 「페이지 불러오는 중…」). 끝나면 종전과 같은 상태다. 채우는 동안 page 전환 · 편집 · undo · 선택은 그대로 된다 (필요한 자리를 먼저 채운다). 끄려면 `localStorage["composition:staged-load"] = "off"`.
  - 측정 (production 하니스, 일괄 ↔ 단계별 교대 3쌍 중앙값): 열기 22 장 1x 1,163 → 603 ms · 66 장 1x 2,262 → 769 ms · 22 장 4x 4,278 → 2,133 ms · 66 장 4x 8,580 → 2,741 ms. 문서 3배의 열기 배율 1.95 → 1.28 (1x). 전부 채워지는 시각은 종전 열기의 1.13 ~ 1.33배, 그동안 pan 의 표시 간격은 평소와 같고 100 ms 넘는 long task 는 없다.
  - 그 밖: 채움이 끝나면 Canvas 명령 버퍼를 한 조각으로 합친다 · AI 의 요소 목록 등 문서 전체를 읽는 곳은 먼저 채운다 · 정적 게이트 (record 맵 전체 순회 자리).
  - 판독 수리 2: 아직 채워지지 않은 자리의 Layers 행 클릭이 버려지던 것 · 마지막 틀 page 를 지우면 채움의 끝 처리가 빠지던 것.
  - 남은 것: 1,000 행 바운드 ListBox 가 든 page 는 채움 단위가 4x 에서 251 ms task (수용 — 행 창은 후속) · drag 의 문서 크기 배율 1.36 (이 변경 전부터 — 별도 작업) · ratchet 기준 재설정 (별도 작업) — 사용자 판정 2026-11-11.

## [ADR-307 Phase 3 — fixed · overlay 를 담은 영역의 편집이 그 page 만 다시 그림 · 틀 page 표시] - 2026-11-11

### Performance

- **ADR-307 Phase 3 닫힘 (G3)**:
  - **Why**: fixed 상자나 열린 overlay (Sheet · Dialog · Select 목록 …) 를 담은 영역이 바뀌면 Canvas 가 그 영역만 고쳐 쓰지 못하고 문서 전체 scene 을 다시 묶었다 (fixed 상자는 page 층에 따로 그려져 영역 교체가 거부됨). 단계별 채움에서는 그런 page 를 채울 때마다 전체 재묶음이 일어나 66 장 · 4x 에서 채움이 49 초, 프레임이 최대 0.9 초였다.
  - 수정: 그런 영역은 그 page (자기 fixed 층 포함) 만 다시 기록한다 — 일반 편집 (fixed 를 담은 컨테이너의 편집 · overlay 열고 닫기) 에도 적용된다. fixed 상자의 좌표는 조상이 움직일 때 다시 읽는다.
  - 단계별 채움 (아직 기본 꺼짐 — Phase 4 에서 켬): 첫 프레임 전 · drag · 카메라 이동 중에는 쉬고 화면에 걸친 page 부터 채운다. 틀 page 에는 옅은 「페이지 불러오는 중…」 표시. 글꼴은 문서에 작성된 글꼴을 미리 읽어 한 번에 요청한다.
  - 측정 (production 하니스, 66 장): 채움 4x 49 s → 10.3 s · long task 87 개 (최대 913 ms) → 27 개 (최대 85 ms), 1x 7.9 s → 2.0 s · long task 0. 채움 뒤 Canvas stream 은 새로 묶은 것과 같다.

## [ADR-307 Phase 2 — page 틀의 백그라운드 채움 · 요청 채움 · 채움 중 편집 (기본 꺼짐)] - 2026-11-11

### Performance

- **ADR-307 Phase 2 닫힘 (G2 — 일반 빌드의 동작 변경 0, `stagedLoad` 는 하니스 빌드 스위치)**:
  - workspace 가 page 틀을 백그라운드로 채운다 (`fillScheduler.ts` — idle 마다 task 하나, 현재 page → 화면 안 page → page 순서). page 전환은 그 page 를 바로 채우고 (100 ms 상한, 나머지는 백그라운드 맨 앞), 노드 id 로 고르거나 명령이 새 노드를 고르면 그 노드까지 먼저 채운다.
  - 채우는 중의 편집: 편집 step 은 아직 채우지 않은 자리를 해석하지 않고, 다음 채움 task 가 고친 문서에서 자식 자리를 다시 읽는다. undo · redo · page 추가 · 삭제 · 순서 변경 · layout template 편집 · 데이터 갱신을 섞어도 끝 상태는 같은 편집을 한 일괄 빌드와 같다 (교차 테스트 67 건, 실제 Builder 66 장 record 18,782 차이 0).
  - 판독에서 나온 결함 2 (수리): layout template 의 중첩을 바꾸면 옮겨진 미반영 자리가 끝내 채워지지 않던 것 · 틀을 지웠다 되돌린 직후의 편집이 중단되던 것.

## [ADR-307 Phase 1 — root 의 page 틀 · 단위 채움 (기본 꺼짐)] - 2026-11-11

### Performance

- **ADR-307 Phase 1 닫힘 (G1 — 일반 빌드의 동작 변경 0, 옵션 `stagedLoad` 는 하니스 빌드의 storage 스위치로만 켜짐)**:
  - composition root 가 첫 page 만 일괄로 빌드하고 나머지 page 는 틀 (root record + frame) 로 세운 뒤 `fill(rootId, { deadline })` 로 단위씩 채운다. resolver 는 바꾸지 않았다 — 틀은 자식 물음을 거절하며 적어 둔 record 이고, 그 물음 하나가 채움 단위다. 한 task 는 단위 여러 개를 엔진에 반영한 뒤 배치 · 전달을 한 번 한다.
  - 실패: 엔진 반영 실패는 task 이전으로 되돌리고 같은 revision 에서 다시 시도하지 않는다. 전달 (구독자) 실패는 record 를 두고 오류를 돌려준다.
  - 검증: 틀 + 채움 뒤 record · geometry · composed part · sticky · page frame 이 일괄 빌드와 같다 (fixture 9 page × 채움 순서 3 × 단위 크기 2, 실제 Builder 22 장 6,317 · 66 장 18,798 record 차이 0). task (상한 75 노드 · 예산 8 ms) 는 4x 에서 p50 17 · 최대 88 ms.
  - 판독에서 나온 결함 1: 달력의 월 반복 사본처럼 한 자리가 record 여러 개로 해석되면 둘째 사본이 비었다 — 그런 자리는 통째로 채운다.

## [ADR-307 Phase 0 — 문서 열기 단계별 빌드 실측 (틀 열기 · 채움 단위 비용)] - 2026-11-11

### Performance

- **ADR-307 Accepted · Phase 0 닫힘 (측정 · 인벤토리 — 제품 동작 변경 0)**:
  - 측정 (production 하니스, `many-pages` 22 · 66 장, 일괄 ↔ 틀 교대 6회 중앙값): 현재 page 만 채우고 나머지는 page 틀만 세우면 열기가 66 장 1x 2,248 → 770 ms · 4x 8,858 → 2,741 ms. `loadInitial` 은 page 수와 무관해지고 (83 → 84 ms), 남는 비례 자리는 문서 읽기 · 검증 (page 당 1x 4.5 · 4x 15 ms — 66 / 22 배율 1.34).
  - 채움: page 한 장 4x 중앙값 66 ms · 최대 287 ms (일괄의 0.9배), 단위 상한 75 문서 노드에서 4x 최대 81 ms. 틀 + 채움 뒤 record · geometry · Canvas 상자는 일괄 빌드와 차이 0 (22 장 6,317 record).
  - 사용자 결정: 상대 게이트 「66 장 ≤ 22 장 × 1.4」 · 절대 게이트 「66 장 · 4x ≤ 3.0 s」 · 채움 전 page 전환 지연 ≤ 150 ms (4x — 화면 단위 먼저, 나머지 비동기) · Preview · Publish 제외.
  - 계측: root 옵션 `stagedProbe` · `probeFill` (하니스 빌드의 storage 스위치로만 켜짐 — Phase 1 구현이 대체). 기록: `docs/adr/design/307-staged-document-open-page-shells-breakdown.md` §6.

## [오래 편집한 뒤에도 pan · zoom 비용이 늘지 않음 — span cursor 이분 탐색] - 2026-11-12

### Performance

- **서로 다른 요소를 많이 고친 뒤 Canvas 의 span 조회가 느려지던 문제**:
  - **Why**: 편집 patch 는 명령 버퍼를 조각 (segment) 으로 나눠 끼우고 다시 합치지 않아, 고친 자리마다 조각이 둘씩 늘었다. 요소의 명령 범위 (span) 를 찾을 때 조각을 처음부터 훑었으므로 pan · zoom · drag 의 조회 비용이 그 세션에 고친 자리 수에 비례했다 (22 장 문서, 같은 요소 반복 편집 뒤 zoom 해석 단계 197,814 · 서로 다른 25 자리 편집 뒤 1,641,641).
  - 수정: 버퍼가 source 배열마다 자기 조각 목록을 들고, span 해석은 그 목록을 이분 탐색한다. 해석 결과는 선형 탐색과 같다 (같은 배열이 두 번 끼워져 조각이 겹치면 선형 탐색으로 간다). 같은 조건에서 zoom 1,641,641 → 165,296 · edit 262,051 → 39,190 · pan 57,236 → 6,168.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`. 측정: dev 카운트 `bufferSegmentsPeak` · `spanCursorSteps` (`renderCounters.ts`) 와 하니스 `--edit-target spread` (seedIds 를 차례로 편집). 검증: `commandSpanMap.test.ts` 4건 (무작위 splice 500 건 대조 · 200 자리 편집 뒤 해석 단계 상한 — 선형 해석이면 160,400 > 7,200 으로 RED) · skia · catalogRuntime 3,802 통과 · 하니스 edit → pan · zoom · drag (콘솔 오류 0).

## [Property 필드의 오류 표시 · 펼침이 다른 요소로 따라가지 않음 — 선택 소속 state] - 2026-11-12

### Fixed

- **같은 타입의 다른 요소를 선택하면 이전 요소의 「잘못된 값」 표시 · 펼친 항목이 그대로 남던 문제** (C1 후속):
  - **Why**: C1 (2026-11-11) 로 같은 타입 선택 사이에 Property 필드를 다시 mount 하지 않게 되자, 필드가 들고 있던 UI 상태가 다음 요소로 넘어갔다. 숫자 서식 칸의 오류 문구와 항목 편집기의 펼친 행이 그 상태였다 (색 · Avatar 크기 칸은 C1 에서 따로 고쳤지만, 원래 요소로 돌아오면 지워진 입력 옆에 오류 문구만 다시 나타났다).
  - 수정: 선택이 바뀌면 처음 값으로 돌아가는 state 하나 (`useSelectionState`) 를 네 곳 (숫자 서식 · Avatar 크기 · 색 칸 · 항목 편집기 행과 구역) 이 같이 쓴다 — 요소마다 필드를 새로 만들던 때와 같은 결과.
  - 위치: `apps/builder/src/builder/components/property/propertySelection.ts` · `panels/properties/generic/{NumberFormatField,AvatarSizeField,GenericFieldRenderer,ItemsManager}.tsx`. 검증: `selectionOwnedState.test.tsx` 3건 (수정 전 RED 1) · properties · design 363 통과 · live (NumberField 2개 통화 서식 — 오류 문구가 둘째 요소 · 첫째로 돌아온 뒤 모두 없음).

## [Canvas 편집 비용이 문서 크기와 무관해짐 — slot 표시 계산] - 2026-11-11

### Performance

- **편집 1회의 비용이 문서의 요소 수를 따라 늘지 않음**:
  - **Why**: 편집 뒤 첫 프레임의 slot 표시 계산이 모든 페이지의 record 마다 문서 노드를 다시 읽었다 (66 장 문서에서 편집 1회 = 조회 18,798).
  - 수정: record 가 이미 갖고 있는 slot 을 읽는다. 표시 결과는 같다. 3배 문서 호출 수 배율 edit 1.25 → 1.07 (66 장 652,443 → 502,378) — 측정한 일곱 부류가 전부 1.2 이하.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/catalogChrome.ts`. 검증: `phase4e8Chrome` 2건 (수정 전 RED 1) · canvas catalog · catalogRuntime 3,451 통과 · live (Library page · layout 정의 보기의 slot 빗금).

## [Canvas 문서 크기 비례 비용 2단계 — Pages 트리 가상화 · 같은 타입 선택 · drag splice] - 2026-11-11

### Performance

- **페이지 전환 · Navigator 열기 비용이 페이지 수와 무관해짐** (B6):
  - **Why**: 활성 페이지가 바뀌면 Pages 트리가 모든 행을 다시 그리고, Navigator 를 열면 모든 행을 mount 했다.
  - 수정: Layers 처럼 RAC Virtualizer 로 보이는 행만 그리고, 행 내용은 바뀐 행만 다시 그린다. 3배 문서 호출 수 배율 page-switch 2.16 → 1.01 · panel-toggle 2.30 → 1.06.
  - 위치: `apps/builder/src/builder/panels/navigator/catalog/CatalogPagesSection.tsx` · `tree/PageTree/PageTreeItemContent.tsx` · `NavigatorPanel.css`
- **같은 타입 요소 사이 선택에서 Property 필드를 다시 mount 하지 않음** (C1):
  - **Why**: 필드 묶음이 요소 id 로 key 가 걸려 Button → Button 선택에도 본문 전체를 다시 만들었다 (645 fiber).
  - 수정: key 를 타입으로 바꿔 값만 바꾼다 (223 fiber). 입력 중인 값은 입력하던 요소에만 쓰인다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogPropertiesPanel.components.tsx`
- **drag 시작 · 끝이 문서 전체를 다시 기록하지 않음** (B3):
  - **Why**: 끌리는 요소를 맨 위 층으로 옮기려고 모든 페이지의 그리기 명령을 다시 만들었다 (66 장 drag 한 번 3.6M 호출).
  - 수정: 끌리는 subtree 만 잘라 옮기고 끝에 제자리로 돌린다 (full build 와 같은 결과 — 못 놓는 경우는 전과 같이 full build). drag 배율 1.80 → 1.14.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/dragLayerSplice.ts` · `catalogRuntime/canvasBinding.ts`

### Fixed

- **drag 직후 첫 편집이 Canvas 장면 전체를 다시 묶던 것**:
  - **Why**: drag 시작 · 끝이 올린 그리기 순번을 편집 patch 의 순번이 따라가지 않아 patch 가 「오래된 순번」 으로 거부됐다.
  - 수정: drag 표시를 바꾼 뒤 patch 순번을 맞춘다.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` `refreshPresentation` · 회귀 `dragLayerSplice.test.ts`

## [Canvas 문서 크기 비례 비용 1단계 — page frame · History · 글꼴 · 부모 맵 · 줄 상자 캐시] - 2026-11-11

### Performance

- **pan · zoom 비용이 문서 크기와 거의 무관해짐** (연구 `docs/explanation/research/CANVAS_PERF_SCALING_2026-11.md` §7):
  - **Why**: 그리기는 화면 넓이에 묶여 있었지만 page frame 조회 (페이지마다 wasm 왕복, 프레임당 ~3회) · History 스냅샷 (step 마다 entry 전부) · 글꼴 동기 (step 마다 record 전부) · fixed 상자 부모 맵 (페이지마다 문서 전체) 이 문서 크기에 비례했다.
  - 3배 문서 (22 → 66 장) 의 같은 입력 호출 수 배율: pan 2.32 → 1.17 · zoom 1.59 → 1.13 · edit 1.67 → 1.25 · drag 1.80 → 1.55 (dev 측정). page-switch · panel-toggle 은 그대로 — Pages 트리 (2단계).
  - 위치: `packages/shared/src/catalog/runtime/{persistentLayoutTree,compositionRoot,controller}.ts` · `apps/builder/src/builder/catalogRuntime/history.ts` · `apps/builder/src/builder/fonts/catalogFontUse.ts` · `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`
- **프로젝트를 처음 열 때 글자 줄 상자 DOM 측정 6,222 → 24 회 (66 장)**:
  - **Why**: 글꼴 로딩 중에는 측정값을 저장하지 않아 text record 마다 강제 레이아웃을 했다. 한 동기 실행 안에서는 글꼴 상태가 바뀌지 않으므로 그 값을 task 끝까지 재사용한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/utils/cssLineBoxMetrics.ts`

## [Settings UI 배율 S · L — chrome 층만 zoom · 끌기 델타 배율 보정] - 2026-11-11

### Fixed

- **Settings 패널의 UI 배율 S · L 이 화면을 깨뜨리던 것** (사용자 보고):
  - **Why**: zoom 이 `.app` 전체에 걸려 `height: 100vh` 에 배율이 곱해졌다 — S 는 아래 20% 가 비고 (live 988 → 790px) L 은 넘쳐 잘렸다. 캔버스는 zoom 이 곱해진 측정 크기를 다시 zoom 안에서 써서 0.8² 로 쪼그라들었다 (1800×988 칸에 1440×632).
  - 수정: zoom 을 chrome 층 (`.app > .panel-workspace` — 헤더 · 레일 · 패널) 에만 건다. 캔버스는 배율과 무관하게 칸을 채우고, 캔버스 배율은 캔버스 zoom 컨트롤의 몫이다.
  - 위치: `packages/shared/src/components/styles/theme/builder-system.css` · 게이트 `PanelWorkspace.static.test.ts`
- **UI 배율 S · L 에서 패널 가장자리 · 분할선 · 이동 손잡이가 커서와 어긋나던 것**:
  - **Why**: useMove 델타 · `clientX` 는 viewport px 인데 패널 레이아웃은 zoom 안쪽 px 다 — L 에서 100px 끌면 120px 움직였다.
  - 수정: 포인터 델타를 손잡이의 `currentCSSZoom` 으로 나눈다 (키보드 한 칸은 그대로 1). PanelSplitter 를 쓰는 패널 · cluster · 섹션 분할 · Data 목록 분할이 같이 고쳐진다.
  - 위치: `apps/builder/src/builder/layout/{chromeZoom.ts,PanelSplitter.tsx,PanelWorkspace.tsx}` · 회귀 `PanelSplitter.test.tsx`

## [빌더 껍데기 구조 — 의미 태그 · 래퍼 2겹 · 읽는 곳 없는 코드 제거] - 2026-11-11

### Changed

- **빌더 DOM 이 `#root > div.app > main.workspace + div.panel-workspace > header · nav ×2 · aside` 다** (사용자 결정 「main · header · nav 등 tag 로 구조화」). `.panel-workspace-host` · `.panel-workspace-main` 래퍼를 걷어내고 `.app` 이 칸 하나짜리 grid 로 캔버스와 chrome 층을 겹친다 (`.app > * { grid-area: 1 / 1 }`). 좌우 토글 레일은 `nav` (이름 = 같은 side 라벨), 패널 표면은 `aside` (이름 = 「패널 작업 영역」 — 이름 없는 div 에 붙어 있던 것을 옮김). 화면 위치는 그대로다.
- 레일의 nav 는 landmark 일 뿐이다 — 옛 `PanelNav` 의 목록 구조 (ul/li) 는 다시 두지 않는다 (`PanelToggleGroup.test.tsx`).
- 위치: `apps/builder/src/builder/layout/PanelWorkspace.tsx` · `.css` · `PanelToggleGroup.tsx` · `styles/layout/header.css` · `canvas.css`.

### Removed

- **읽는 곳이 없던 코드** — 이를 읽던 `useWorkspaceCanvasSizing` 은 ADR-248 Phase 4e-9-1 에서 이미 삭제됐다: host · main 의 `data-layout-version`, `.panel-workspace` 의 `data-page-layout-*` 속성 (coordinator 를 구독해 flush 마다 DOM 에 쓰던 것), `viewportSync` 의 `pageLayoutPanelMetrics` · `setPageLayoutPanelMetrics` · `selectFrameAreaPanelMetrics` (+ 그 테스트 파일), `pageLayoutConstants` 의 `resolvePageLayoutBounds` · `resolveAutoPageColumnCount`.
- **옛 `.app` 3×3 grid (`header / sidebar main inspector / bottom`) 와 `.app aside.sidebar` · `.inspector` · `.header-actions` · `.panel-content` 규칙** — 쓰는 요소가 없었다. `.app main { grid-area: main }` 은 래퍼를 걷자 캔버스를 다른 칸으로 밀어냈다 (live: main 0×0) — 지우고 게이트를 둔다 (`PanelWorkspace.static.test.ts`).

## [패널 작업 공간 — dock 래퍼 제거 · 레일 그림자 잘림] - 2026-11-11

### Changed

- **`.panel-workspace` 가 grid 하나로 헤더 · 좌우 토글 레일 · 표면을 직접 놓는다** — 옛 `.panel-dock > .panel-dock-chrome / .panel-dock-stage` 래퍼 세 겹을 걷어냈다 (사용자 제안). 영역은 `"header header header" / "rail-left surface rail-right"`, 간격은 `gap` 하나 · 바깥 여백은 `padding` (host 칸을 캔버스와 같이 쓰므로 margin 이면 칸이 줄어든다). 화면 위치는 그대로다 (헤더 y 4–44 · 표면 (48, 48)).
- **패널 크기 기준 = 표면 하나** — 레이아웃 초기화 · registry · 패널 표시 경로가 레일까지 포함한 stage 대신 `.panel-dock-surface` 를 잰다. `maxWidth: "100%"` 패널 (3개) 은 이제 표면 폭이 상한이다.
- 위치: `apps/builder/src/builder/layout/PanelWorkspace.tsx` · `.css` · `panelWorkspaceVisibility.ts` · `workspace/components/canvasViewportInset.ts` · `styles/modules/error-loading.css`.

### Fixed

- **좌우 토글 레일 섬의 그림자 좌우가 잘리던 것** (사용자 지적 — 헤더 섬은 온전). **Why:** 레일 `.panel-toggle-rail` 이 `overflow: hidden` 이고 폭이 섬 (`.builder-control-group`) 과 같은 40 이라 섬 바깥에 그려지는 `--chrome-shadow` 가 레일 경계에서 잘렸다. 헤더 섬의 부모는 `overflow: visible` 이다. 레일의 `overflow` 를 지웠다 — 세로로 넘치는 경우는 섬 자신의 `max-height` · `overflow-y` 가 맡는다. 게이트 `PanelWorkspace.static.test.ts`.

## [Canvas 우클릭 메뉴 — 맨 앞 구분선 제거] - 2026-11-11

### Fixed

- **빈 캔버스 우클릭 메뉴가 구분선으로 시작하던 것** (사용자 보고). **Why:** Canvas · 액션 바는 `catalogCanvasMenuItems` 목록을 바로 그려 `buildContextMenuItems` 의 `dropEmptySeparators` (맨 앞 · 맨 뒤 · 연속 구분선 정리) 를 거치지 않았다 — 클립보드가 비어 「붙여넣기」 가 빠지면 그 뒤 `viewport-separator` 가 맨 앞에 남았다. 목록을 만드는 곳에서 정리한다 (두 반환 모두).
- 위치: `apps/builder/src/builder/catalogRuntime/canvasMenu.ts` · 회귀 `phase4eCanvasMenu.test.ts` (수정을 되돌리면 실패 확인).

## [빌더 중립 면 `--bg-muted` — 검정 5%] - 2026-11-11

### Changed

- **빌더 light 의 `--bg-muted` = `rgb(0 0 0 / 0.05)`** (종전 gray-200) — 폼 상자 · 탭 줄 띠 · hover · 선택 표시 등 중립 면이 한 단 연해진다 (사용자 결정: gray-200 은 진하고 gray-100 은 연했다). 반투명이라 흰 표면 위에서 #f2f2f2, 패널 구획 (gray-50) 위에서 약 #edeeee 로 놓인 면보다 같은 만큼 어둡다. dark (zinc-700) 와 `--border` (gray-200) 는 그대로.
- 위치: `packages/shared/src/components/styles/theme/builder-system.css`.

## [패널 셀렉트 값 글자 시작 위치 — 입력칸과 맞춤] - 2026-11-11

### Fixed

- **패널 셀렉트 (Overflow · Ratio · Weight · Wrap · Language …) 의 값 글자가 칸 왼쪽에 붙던 것** — 입력칸은 상자 여백 4 + 입력 여백 4 = 8 에서 글자가 시작하는데 셀렉트 값 (`.react-aria-SelectValue`) 은 여백 0 이라 4 에서 시작했다. 같은 줄 Width · Height 의 앞 아이콘을 빼면서 드러났다 (사용자 지적). **Why:** 셀렉트 값의 왼쪽 여백은 앞 아이콘 (`.control-label`) 이 대신 만들어 주던 것이라, 아이콘 없는 셀렉트에는 처음부터 없었다. 값에 `padding-inline-start: var(--spacing)` — live 실측 Width · Height · Overflow · Ratio 모두 8.
- 위치: `apps/builder/src/builder/components/styles/form-controls.css`.

## [빌더 아이콘 선 굵기 — non-scaling stroke] - 2026-11-11

### Changed

- **빌더 chrome 의 lucide 아이콘이 `strokeWidth` 를 화면 px 그대로 그린다** — 앱 root 의 `LucideProvider nonScalingStroke` 가 모든 아이콘 path 에 `vector-effect="non-scaling-stroke"` 를 붙인다 (사용자 결정). 종전에는 24 기준 그림을 줄이면서 선도 같이 줄어 16px 아이콘의 `strokeWidth: 2` 가 1.33px, 14px 는 1.17px 로 보였다 — 이제 크기와 상관없이 지정값 그대로이고, 굵기는 **1px** 하나다 (사용자 결정 — `iconProps` 계열 7 · Provider 기본 · 호출부 리터럴 10 (1.25 · 1.5 · 2 · 2.5 · 3) · SearchField 자체 SVG · EmptyState CSS 1.25 를 모두 1 로). Preview · Publish 는 다른 React root (`preview.html`) 라 사용자 컴포넌트 아이콘 (Canvas 와 대칭) 은 그대로다.
- 위치: `apps/builder/src/main.tsx` · `utils/ui/uiConstants.ts` · `components/ui/SearchField.tsx` · `components/feedback/EmptyState.css` · 리터럴 호출부 (dashboard · Styles 색 · Gradient · Image fill · Components 목록 · Layout preset · Themes · PropertySelect ✓).

## [패널 입력 앞 표시 — Figma 방식 한 벌] - 2026-11-10

사용자 지적 「패널 입력 · 선택 폼의 앞 아이콘이 있는 것 · 없는 것이 다양하다」 → Figma · Framer · Pen 비교 후 사용자 결정 「Figma 방식」 (legend 위 + 칸 안 앞 표시 — Figma UI3 의 Property labels 를 켠 모양). 2026-09-15 panel-ui 대조 B4 · B13 과 11-02 styles-token-model 의 「숫자 칸 아이콘 없음」 을 뒤집는다.

### Changed

- **숫자 칸은 늘 칸 안 앞 표시를 둔다** — 값 아이콘 (Gap 은 주축 방향, Font size · Line height · Letter spacing, Radius, Blur, Spread, Grid 트랙 Min · Max, Page gap · Column count). 지정이 없는 숫자 칸 (Properties · Data · Chart 의 일반 숫자) 은 `#`. 표시는 끌어서 값 바꾸는 손잡이도 겸한다.
- **Ratio 를 고른 요소의 Height 칸** — 입력 · 끌기 · 단위 메뉴가 모두 비활성 (종전 readOnly 는 focus · 끌기가 됐다), 칸은 「Auto (ratio)」 · 「자동(비율)」 대신 비율로 계산된 px 와 단위 px 를 보인다 (사용자 지정 — 번역 키 `styles.transform.sizeMode.ratioTrigger` 삭제). 위치: `components/property/PropertyUnitInput.components.tsx` · `i18n/messages/{en-US,ko-KR}.ts`.
- **축 · 치수 칸은 앞 표시 없음** — Size 절 Width · Height · Min · Max W · H, Position X · Y, Border Width, Shadow Offset X · Y (사용자 지정 — 처음 붙였던 X · Y · W · H 글자를 뺐다). `PropertyUnitInput` 의 `icon={null}` 이 기본 `#` 을 끈다.
- **Settings Page layout 절 순서** — 「Direction | Page gap」 · 「Column count | This breakpoint」 두 줄 (종전 Page gap | Column count · tier 스위치 · Direction 세 줄, 사용자 지정). 둘째 줄은 Auto 방향에서만.
- **Settings Page layout Direction 의 Auto** — 글자 「Auto」 대신 `LayoutGrid` 아이콘 (가로 · 세로와 같은 아이콘 세그먼트, 글자는 접근 이름 — 사용자 지정). 위치: `panels/settings/SettingsPageLayoutSection.tsx`.
- **Border Radius 칸 앞 표시** — `SquareRoundCorner` (사용자 지정). 위치: `panels/styles/sections/BorderSection.tsx`.
- **Size Ratio** — 비율을 고르면 칸에는 비율만 (「16:9 Video」 → 「16:9」), 목록 항목은 이름까지 (사용자 지정). `PropertySelect` 에 `formatValue` (트리거 짧은 값) 추가. 위치: `panels/styles/sections/TransformSection.tsx` · `components/property/PropertySelect.*`.
- **Grid Columns · Rows 칸 앞 표시** — `Columns2` · `Rows2`, Settings Column count 도 `Columns2` (사용자 지정). 위치: `panels/styles/sections/LayoutSection.tsx` `GridTrackField` · `panels/settings/SettingsPageLayoutSection.tsx`.
- **Padding 칸 아이콘** — 좌우 · 상하 `MoveHorizontal` · `MoveVertical` → `SquarePaddingHorizontal` · `SquarePaddingVertical`, 네 변 펼침 `PanelLeft` · `PanelTop` · `PanelRight` · `PanelBottom` → `SquarePaddingLeft` · `Top` · `Right` · `Bottom` (사용자 지정). 위치: `panels/styles/sections/PaddingFields.tsx`.
- **셀렉트 앞 아이콘을 뺐다** — Apply layout · 데이터 바인딩 · Who can access · Language. 값 · 타입 자체를 보여 주는 아이콘 (Data 필드 타입 글리프) 만 남는다.
- **스위치에서 아이콘을 뺐고 (15 곳) 크기를 36×20 → 26×16 (S2 Switch M) 으로 줄였다** — 칸 안 다른 요소 (체크박스 16 · 아이콘 14~16) 와 같은 높이. 종전 값은 RAC 예제 값을 옮긴 것이었다. Show action bar · tier override 가 눈금자 아이콘을 복사해 쓰던 것도 함께 사라졌다. 예외 — 켜고 끄는 대상이 아이콘으로 분명한 검색 · sitemap 스위치는 아이콘을 둔다 (사용자 지정): 페이지 설정 Hide from search `SearchX` · Hide from sitemap `MapPinOff`, Site Search index `Search` · Sitemap `Network`, Settings Show rulers `RulerDimensionLine` · Snap to objects `Magnet` (둘 다 `ACTION_ICONS`) · Show action bar `Dock` (종전 눈금자 복사를 바로잡음) · Page layout 의 tier 스위치 `PictureInPicture2` (라벨 「This breakpoint only」 · 「이 breakpoint 만」 → 「Breakpoint」 — 반폭 칸에서 잘리던 것).

### Fixed

- Size 절 Height 칸 앞 표시가 90° 돌아 「工」 으로 보이던 것. **Why:** 옛 아이콘 (Width 와 같은 그림을 돌려 쓰던 것) 용 회전 규칙 (`inspector-layout.css` `.height … svg`) 이 남아 새 `H` 글자를 돌렸다 — 규칙을 지웠다.

### Tests

- 게이트: `components/property/fieldPrefixIcon.static.test.ts` (셀렉트 아이콘 허용 목록 · 숫자 칸 기본 표시), `PropertyNumberInput.test.tsx` 기본 `#` 렌더. 위치: `components/property/PropertyUnitInput.components.tsx` · `PropertyNumberInput.tsx` · `PropertySwitch.*` · `styles/widgets/Switch.css` · Styles 섹션 6 · Settings · Site · Properties catalog 섹션.

## [Theme 패널 — 불필요한 Preview 섹션 제거] - 2026-11-10

### Removed

- Theme 패널의 Preview 섹션과 전용 `MiniThemePreview` 컴포넌트, `.mini-preview*` 스타일, `--mp-*` 인라인 변수 계산을 제거했다. 폐기된 미리보기 표본을 언급하던 패널 규칙도 정리했다.
- 위치: `apps/builder/src/builder/panels/themes/ThemesPanel.tsx`, `ThemesPanel.css`, `MiniThemePreview.tsx`.

## [Border Sides — 전체 선택 액션 분리] - 2026-11-10

### Changed

- Design 패널 Style 탭 Border의 Sides는 좌·우·상·하 4개 토글만 표시하고, 전체 선택·해제는 오른쪽 `fieldset-actions actions-icon` 버튼으로 옮겼다. Radius의 코너 펼침 버튼과 같은 패턴이다.
- 전체 선택 상태에서 개별 변 하나를 해제하면 나머지 변 선택을 유지한다. 전체 액션의 선택 표시와 미지원 Border Style 비활성 상태도 개별 변과 동기화한다.
- **Why:** 공통 너비 쓰기가 이전 변별 너비를 남겨 전체 선택이 일부 변에 적용되지 않았다. `catalogRuntime/styleFields.ts`에서 전체 너비와 변별 값 제거를 같은 transaction에 반영한다.
- 위치: `apps/builder/src/builder/panels/styles/sections/BorderSection.tsx`, `apps/builder/src/builder/components/styles/inspector-layout.css`.

## [빌더 chrome 에 Spectrum Hub 개념 적용 — 표면 · 그림자 · 모서리 · 파랑 · 문구] - 2026-11-10

사용자 요청 「빌더에 spectrum hub 의 개념을 적용」 · 「전부 진행」. 사용자 컴포넌트 (catalog) 는 빌더와 분리돼 있어 (ADR-305) 빌더 chrome 만 바뀐다. Hub 의 역할을 따르고 값은 빌더 사다리에서 골랐다.

### Changed

- **떠 있는 표면이 한 층이다** (Hub background layers — elevated). 패널 · header toolbar · action bar · 팝오버 · 메뉴 · Toast · tooltip · command palette · 확인 Dialog 가 같은 표면색 (`--chrome-surface` — light 흰색 · dark zinc-850) 과 같은 그림자 (`--chrome-shadow` — Hub elevated 단) 를 읽는다. 종전: 패널 약한 그림자 · 팝오버 가장 진한 그림자 · Dialog 는 직접 쓴 값과 다른 표면색. dark 에서는 Hub 규칙대로 1px 테두리 선을 더한다 (크기가 바뀌지 않게 그림자 고리). 뒤 가림막이 있는 Dialog 4 종은 그림자가 없다.
- **패널 탭 줄이 회색 띠, 선택 탭은 밝은 pill** (사용자 결정 — 시안 4 안 중 C). 탭 행 32 를 회색 띠 (`--bg-muted`) 로 칠하고 선택 탭만 한 단 밝은 면 (`--bg-overlay` · 높이 24 · 모서리 4). 종전 흰 머리글 위 회색 pill 은 대비가 약했다. 패널 머리글 아래 구분선은 안쪽 그림자 선으로 바꿔 머리글 · 탭 행 · 구획 머리글이 모두 32 다.
- **Navigator 탭이 Design 탭과 같은 아이콘 탭이다** — 선택된 탭만 라벨을 달고, 탭 폭은 아이콘 + 라벨 내용이 정한다 (공통 `PanelIconTabList`). 종전 Navigator 는 폭 320 이상에서 세 탭 모두 라벨 · 같은 폭 · 굵은 라벨이라 Design 탭 줄과 달랐다. 비선택 탭 이름은 hover 설명과 접근 이름으로 남는다.
- **패널 구획 머리글은 제목까지 눌러 접고 편다** (RAC Disclosure 와 같은 누르는 영역). 종전에는 caret 아이콘만 눌렸다. 머리글은 heading 안의 버튼 하나 (이름 = 제목, `aria-expanded` · `aria-controls`) 이고 내용 영역은 제목 이름의 group 이다. RAC 컴포넌트가 아니라 속성을 직접 적어 닫힌 구획의 내용을 계속 렌더하지 않는다 (Design · Navigator 패널 비용 — 빌더 chrome 수동 ARIA 예외, `ssot-hierarchy.md` §1 D1).
- **캔버스 바깥이 pasteboard 토큰 (`--bg-pasteboard`)** — dark 에서 한 단 어두워져 (zinc-950) 패널이 캔버스에 묻히지 않는다.
- **모서리 단이 Hub rounding** — 컨트롤 8 · 패널 10 · Dialog 16 (종전 6 · 8 · 8).
- **팝오버 · toolbar 모서리 12 = 안쪽 모서리 8 + 여백 4** — 첫 · 끝 항목 (toolbar 는 양끝 버튼) 과 바깥 모서리의 간격이 변과 같다. toolbar = 좌우 rail · 헤더 뷰포트 컨트롤 · action group · 액션바. Select · ComboBox · 고르기 목록 항목 (종전 4) · 제안 목록 · 행 메뉴 · 필드 고르기 메뉴 항목 (종전 2) 이 메뉴 항목 · navigator 선택 행 · 필드와 같은 8 이 됐다. Hub 단에 없는 값이라 식 토큰 (`--chrome-radius-popover` · `--chrome-radius-toolbar`) 으로 둔다.
- **패널 안 컨트롤의 그림자를 없앴다** (선택 표시 · ▾ 상자 · 행 버튼 · 토큰 칩 15 곳). 선택은 채움으로 가른다 — 선택 탭은 `--bg-muted`.
- **파랑의 역할을 나눴다** (Hub attention hierarchy). focus 표시는 `--focus-ring`, 캔버스 선택과 그것을 비추는 패널 표시는 `--canvas-selection`, 패널의 선택 표시 (목록 카드 · Data 표 선택 행 · 만들기 방법 · rail 의 선택 글리프 · slider 채움) 는 무채다.
- **패널 문구가 sentence case** (Hub grammar and mechanics) — `Label Position` → `Label position`, `Toggle Design Panel` → `Toggle design panel`. en-US 표시 문구 335 개와 번역 키가 없는 라벨 108 종.
- 한국어 문구 7 건 통일 — 같은 동작이 표면마다 다른 이름이었다 (컨텍스트 메뉴 「상단 정렬 · 수평 균등 분산」 ↔ 명령 「위쪽 정렬 · 가로 분배」, 「개체에 스냅」 ↔ 「객체 스냅」, 「페이지 배치」 ↔ 「페이지 레이아웃」, 「테두리 폭」 ↔ 「테두리 너비」). 영어 대소문자가 달라 일관성 게이트가 같은 문구로 보지 못했다.

### Fixed

- **페이지 헤더의 Play · Close 버튼이 헤더보다 컸다 (30 → 20)** — ActionButton 기반 아이콘 버튼은 위젯 사본의 `min-height: 30px` 를 받아 아이콘 크기 규칙의 높이 (20 · 28) 아래로 줄지 못했다 (ToggleButton 인 Code 는 정상). `builder-control-size.css` 공통 규칙이 높이 최솟값도 아이콘 크기로 되돌린다 — 30 보다 작은 자리의 ActionIconButton 이 모두 같이 바로잡힌다.
- **빌더 dark 에서 그림자가 light 값으로 그려졌다.** 그림자 토큰의 dark 값이 `[data-theme="dark"]` 에 걸려 있었는데 빌더는 `data-builder-theme` 만 세운다 — 8% · 4% 그대로라 패널 · 하단 toolbar 가 캔버스에 묻혔다 (Hub 는 dark 에서 3 배).
- **focus 표시 대비** — light 의 blue-400 은 패널 위 2.52 · 캔버스 바깥 위 2.09 (기준 3:1). blue-600 으로 올렸다 (5.2 · 4.0).
- **보조 글자 대비** — `--fg-muted` 가 `--bg-muted` 위 3.91 (light) · 3.98 (dark). gray-600 · zinc-300 으로 올렸다 (기준 4.5:1).
- **패널 선택 표시가 dark 에서 밝은 파란 면** — `--color-primary-*` 는 light 고정 팔레트다. 무채 선택 (`--accent` 테두리 + `--bg-muted`) 으로 바꿨다.
- 정의 없는 `--shadow-xs` 를 읽던 선언 1 곳 삭제.

### 검증

- 빌더 스냅샷 light 69 화면 재캡처 — 떠 있는 표면 14 종의 표면색 · 그림자 · 모서리가 같은 값. 「바탕과 같은 색이 되어 사라진 면」 분석으로 light 표면색 변경의 이음매를 확인 (`--bg-raised` 는 그대로 두고 `--chrome-surface` 만 흰색).
- light 5 장 · dark 3 장을 눈으로 확인 (Layout · Style · Fill 팝오버 · Data 표 · Components · command palette · 속성 패널 문구). 확인 Dialog 3 종 · 글꼴 관리 창은 캡처 목록에 없어 정적 게이트만 통과.
- 게이트: `chromeIsland.static.test.ts` (떠 있는 표면 · dark 조건 · pasteboard · 모서리 단) — dark 조건을 되돌리면 RED. 빌더 단위 8,463 통과 (`adr298TokenPreview` 3 건은 이 변경 전부터 실패) · shared 2,455 통과 · `pnpm test:css-boundary` 52 통과 · type-check 통과.

### 남긴 것

- 간격 (Hub 고밀도 패널 12px ↔ 현재 8px) — 패널 7 칸 격자 (사용자 결정) 와 부딪혀 두었다. motion 값은 Hub 에 없다. RTL 논리 속성 전환 (166 곳) 은 RTL 화면 검증이 필요해 두었다.
- 빌더 문서에 정의가 없는 위젯 사본 토큰 (`--neutral-surface*` · `--neutral-fill*` 등) 은 ADR-305 분리 직전 화면 그대로라 별도 정리 대상.

## [빌더 팝오버 그림자 한 곳 · ADR-305 뒤 제외 조건 정리] - 2026-11-10

### Changed

- **빌더의 모든 팝오버가 같은 그림자 (`--shadow-lg`) 를 갖는다** (사용자 결정 「Select 목록, combobox 목록, menu 목록 등 모든 popover 에 동일 적용」). Select 목록 · 단위 입력 (ComboBox) 목록은 그림자가 없었다 — 그림자를 팝오버마다 따로 선언해 두 목록이 빠져 있었다. 정본은 위젯 사본 `styles/widgets/Popover.css` 의 `.react-aria-Popover` 규칙 하나이고, 팝오버별 선언 10 곳은 지웠다. RAC 기본 class 를 쓰지 않는 팝오버 (헤더 · 줌 · 컨텍스트 메뉴 · action bar · 기록 · 아이콘) 와 `{{` 변수 제안 목록 (md → lg) 은 자기 시트에서 같은 값을 준다.
  - 빌더 스냅샷 A/B (69 화면 × 2 변형): 차이는 Select · 단위 입력 목록 팝오버의 `box-shadow` 뿐.

### Removed

- 빌더 chrome CSS 의 `[data-catalog-id]` 제외 조건 (`:where()` 밖 28 곳 — ADR-305 뒤 빌더 문서에 사용자 DOM 이 없다) · 쓰는 곳 없는 `.theme-selector` · `.zoom-combobox-*` 규칙. 빌더 스냅샷 69 화면 × 4 변형 Δ 0.

## [Effect 절 그림자 — Spectrum 용도 이름 · rule 의 토큰도 한 행] - 2026-11-10

### Changed

- **그림자 preset 라벨이 S · M · L 에서 Emphasized · Elevated · Dragged 로 바뀌었다** (사용자 결정 — Spectrum Hub `drop-shadow` 의 용도 이름). 셋은 작다 → 크다 순서가 아니라 서로 다른 용도다 (강조 컨테이너 · 다른 내용 위에 뜨는 것 · 끄는 중). 「+」 메뉴 항목과 행의 칩이 같이 바뀐다. 토큰 이름 (`{shadow.sm|md|lg}`) · 값 · 저장 데이터는 그대로다.

### Fixed

- **rule 이 정한 그림자 토큰 (Popover · Toast 의 `{shadow.md}`) 도 칩 + 한 행으로 보인다** (사용자 보고 「Library Popover 는 3개, Button 에 적용하면 1개」). Why: 패널이 rule 의 토큰을 light 리터럴로 풀어 받아 토큰인 줄 모르고 3층을 3행으로 그렸다 — 노드에 저장된 토큰은 한 행이었다. 그려지는 그림자는 둘 다 3층 (key · transition · ambient) 으로 같았다. 이제 rule 값도 토큰의 CSS 변수로 넘긴다.
  - rule 의 그림자 행에서 「−」 를 누르면 `none` 을 쓴다 — 노드에 지울 값이 없어 키를 비우면 그대로였다. Reset 으로 rule 값에 돌아온다.
  - 테스트 `adr298Phase5Panel.test.tsx` ⑤ (Toast) · `specPresetResolver.test.ts` — 수정 전 RED 5.
  - Live (Chrome MCP 5173, 새 프로젝트 `shadow-label-check`): Library Popover 「Elevated · 0 4 12 · 8%」 1행 · Button 에 Dragged 적용 → 1행 + Canvas 그림자 · Home 의 Popover 「−」 → 행 0 · 콘솔 오류 0.
  - 위치: `apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts` · `sections/EffectSection.tsx` · `hooks/useAppearanceValues.ts`

## [Theme 사용자 accent 피커 — Theme 견본 즉시 반영 · Document 팔레트] - 2026-11-10

### Fixed

- **Theme › Accent 「+」 피커에서 색을 고르면 피커 안 Theme 견본 (Accent · …) 이 바로 바뀐다** (사용자 보고 「팝업을 닫고 다시 열어야 반영」). Why: 팔레트의 Theme 견본 memo 가 tint · Tone · 색 모드만 보아, tint 를 바꾸지 않는 사용자 accent (`color.accent` hex) 를 놓쳤다. 이제 테마 설치 신호 `themeVersion` 으로 다시 읽는다.
  - 테스트 `ColorPickerPalettes.theme.test.tsx` — 원복 RED (`vibrant blue` 그대로).
  - Live (Chrome MCP 5173, 새 프로젝트): 피커를 연 채 초록 → 자주 — Accent 견본 3 · 행 끝 견본 · 테마 줄 `#C536F0` 즉시. 콘솔 오류 0.
- **Theme 사용자 accent 피커도 Document 팔레트를 보인다**: Site 패널 색 칸처럼 피커를 Styles host 로 감싼다 — 앞 커밋의 「host 없음」 대체 경로 (`useStylesSelection` · 빈 문서 팔레트) 는 되돌렸다.
  - 정리 (동작 변경 0): `color.accent` 판정을 shared `themeAccentHex` · `THEME_ACCENT_TOKEN` 하나로 (resolver · 테마 key · 패널 3), ▾ 상자 규칙을 `.select-chevron` 하나로 (Select · 팝오버 trigger), 견본 ✓ 한 벌.
  - Live: ▾ 상자 4 (Theme Font 포함) 20 × 20 · 「+」 20 × 20 점선 · 프리셋 선택 → 사용자 색 삭제 (`blue · md`).
  - 위치: `apps/builder/src/builder/panels/styles/components/ColorPickerPalettes.components.tsx` · `panels/themes/ThemesPanel.tsx` · `ThemeListSection.tsx` · `catalog/catalogThemesHost.ts` · `components/styles/form-controls.css` · `packages/shared/src/catalog/runtime/themeLadders.ts`

## [빌더 툴팁 · 색 팝오버의 화살표 제거] - 2026-11-10

### Changed

- **빌더 chrome 오버레이에 화살표 (RAC `OverlayArrow`) 를 그리지 않는다** (사용자 지시 「필수가 아니니 제거」): 아이콘 버튼 · 레일 툴팁 (`ActionTooltip`) 과 색 팝오버 (PropertyColor · Theme 사용자 accent — Fill · Shadow 는 이미 `hideArrow`). 툴팁 CSS 의 화살표 회전 규칙도 지웠다.
  - 사용자 컴포넌트 (catalog Tooltip · Popover 의 화살표, ADR-256) 는 그대로다.
  - 게이트 `chromeOverlayArrow.static.test.ts`: 빌더 JSX 의 `OverlayArrow` 0 · 공용 `Popover` 를 쓰는 빌더 자리마다 `hideArrow`. 원복하면 RED.
  - Live (Playwright 5174): 레일 툴팁 「Navigator ⌥1」 · Theme 사용자 색 팝오버 — `.react-aria-OverlayArrow` 0, 콘솔 오류 0.
  - 위치: `apps/builder/src/builder/components/ui/ActionTooltip.tsx` · `.css` · `components/property/PropertyColor.components.tsx` · `panels/themes/ThemesPanel.tsx`

## [Theme › Colors › Accent 사용자 색 추가] - 2026-11-10

### Added

- **Theme 패널 Accent 에 사용자 색 칸 (「+」)** (사용자 요청): Accent 행 끝 액션 칸 (Font Family 옆 색 칸과 같은 자리 — 프리셋 10 은 1·2열, 첫 줄 견본과 같은 높이) 에 「+」 가 있고, 누르면 Fill 과 같은 색 고르기가 열린다. 고른 색은 활성 테마의 `color.accent` (hex) 로 저장돼 tint 를 대신한다 (ADR-302 — 사다리는 그 색의 c · h 로 생성). 저장된 뒤에는 그 칸이 색 견본 (선택 ✓) 이 되고, 다시 누르면 바꿀 수 있다. 프리셋을 고르면 사용자 색은 지워진다 (tint 변경과 함께 한 단계 — ⌘Z 로 함께 되돌림).
  - host 쓰기 `setActiveThemeAccent({ tint } | { hex })` 하나. 테마 목록 줄 요약은 사용자 색이면 tint 대신 hex 를 보이고 재정의 개수에서 뺀다.
  - 색 고르기의 HEX · 숫자 칸 (`ColorInputFields` · `ScrubInput`) 과 Document 팔레트가 Design 패널 밖에서도 열린다 (요소 선택 없음 = 요소 전환 가드 없음 · Document 팔레트 비어 있음). 전에는 Styles host 가 없으면 예외로 화면 전체가 내려갔다.
  - 테스트 `phase4eTheme.test.tsx` (사용자 색 저장 · 같은 색 단계 0 · 프리셋 = 한 단계로 삭제 · 되돌리기) — 원복 RED.
  - Live (Playwright 5174, 새 프로젝트): 「+」 → HEX `FF5A1F` Enter → 견본 「Custom accent #FF5A1F」 선택 · 테마 `color.accent` 저장 · Green → 사용자 색 삭제 · tint green · ⌘Z → `#FF5A1F` · blue 복원. 콘솔 오류 0.
  - 위치: `apps/builder/src/builder/panels/themes/ThemesPanel.tsx` · `.css` · `ThemeListSection.tsx` · `catalog/catalogThemesHost.ts` · `themesHostContext.ts` · `panels/styles/stylesHost.ts` · `components/ColorInputFields.tsx` · `ScrubInput.tsx` · `hooks/useDocumentColors.ts`

## [Text 탭 Font Family — 다른 Select 칸과 같은 legend · ▾ 상자] - 2026-11-10

### Fixed

- **Design › Text › Typography 의 Font Family 칸에 legend 가 생겼고 ▾ 가 다른 Select 와 같은 20 상자다** (사용자 지적): legend 가 없어 이 칸만 이름이 없었고, ▾ 는 맨 아이콘 16 이었다.
  - Why: 글꼴 칸은 Select 가 아니라 팝오버 trigger (`FontFamilyPicker`) 라 ▾ 상자 규칙 (`.react-aria-Select` 안만) 이 닿지 않았다. legend 는 panel-ui 03 (2026-09-14) 의 「글꼴 이름이 곧 라벨」 로 뺐던 것이다.
  - 같은 trigger 를 쓰는 아이콘 고르기 (suffix 모드) · 슬롯 넣기 칸의 ▾ 도 같은 상자다. Theme 패널 Font 칸도 20 상자.
  - 옆 색 swatch (legend 없음) 는 Font Family 상자 줄에 맞췄다.
  - 「Theme」 칩 (사용자 지시): 바탕은 accent · 글자 on-accent, 높이 20 (`line-height: var(--text-xl)`), 시작 여백은 기본값 (0 — 종전 `--spacing` 4). Live: 칩 20 × 39 · 버튼 시작에서 0.
  - 테스트 `adr298Phase5Panel.test.tsx` ③ 에 legend 단언 — 원복하면 RED.
  - Live (Playwright 5174): Text 탭 Font Family legend · ▾ 20 × 20 (흰 바탕 · 그림자 = Font Weight 와 같은 값) · 상자 28, Theme › Font ▾ 20 × 20.
  - 위치: `panels/styles/sections/TypographySection.tsx` · `panels/fonts/FontFamilyPicker.tsx` · `components/styles/form-controls.css` · `components/styles/inspector-layout.css`

## [ADR-305 Implemented — 빌더 chrome 과 사용자 컴포넌트 CSS 분리] - 2026-11-10

### Changed

- **ADR-305 를 닫았다** (G5 사용자 confirm 「adr-305도 확인되었다」): 빌더 문서는 사용자 컴포넌트 시트 (생성 · 공유 수동 · `preview-system`) 를 싣지 않고 위젯 사본 `styles/widgets/` 를 읽는다. `/publish` 는 별도 HTML 진입이고, Preview · Publish 는 빌더 시트를 싣지 않는다. 그래서 catalog rule (생성 CSS) 을 바꿔도 빌더 패널 모양이 따라 바뀌지 않는다.
  - 결과: 빌더 4 변형 × 69 화면 Δ 0 · Preview · Publish Δ 0 · Builder initial CSS 98,774 → 55,161 B gz · 경계 게이트 (`pnpm test:css-boundary` — preflight · pre-push).
  - ADR-295 Decision 9 의 빌더 쪽 기구 (`builder-catalog-vars.css` · `builder-catalog-pins.css` · 게이트 (c)) 는 이 ADR 이 대체했다 (295 본문 포인터). ADR-028 (변수 스코프) 의 다음 단계다.
  - 위치: `docs/adr/completed/305-builder-chrome-component-css-separation.md` · breakdown `docs/adr/design/305-…-breakdown.md` §5

## [토큰 칸은 단계 이름을 칸에 — 칩 · 버튼 글자 대신] - 2026-11-10

### Changed

- **Design 패널의 토큰 칸 (Padding · Gap · Position · Radius · Border Width · Font Size) 은 고른 단계 이름을 칸 글자로 보인다** (사용자 결정): Padding XS 를 고르면 칸에 「4」 대신 「XS」. 칩은 없고, 버튼은 ▾ 그대로다. 지금 테마의 px 는 칸에 마우스를 올리면 「XS · 4px」, 메뉴에는 「XS · 4」.
  - 바로 앞 변경 (▾ 버튼 안에 단계 글자, `58a8997c4`) 을 대신한다. 그 자리는 Width 에서 단위 (PX · FR) 를 뜻해 「12 M」 이 단위처럼 읽혔다. Width 는 단위 트리거 그대로다.
  - 단계 이름을 치면 (`xs` · `M`, 대소문자 무관) 그 토큰, 숫자를 치면 그 숫자 (스케일 밖이면 점) 다. ▲▼ 는 토큰의 px 에서 숫자로 움직이고, 라벨 끌기는 단계씩 (칸 글자가 S → M).
  - Line Height 의 「auto」 칩도 같다 — 칸 글자 「auto」, 따르는 행간은 풍선 (「auto · 26」).
  - ADR-298 D4 「칩 + 해석값」 표시를 정정했다 (본문 D4 행).
  - 테스트: `PropertyUnitInput.test.tsx` (+ 단계 이름 입력 · ▲ 기준) · `adr298Phase2/3/4Panel.test.tsx`. 원복 (칸에 해석 px) 하면 9 RED.
  - Live (Playwright 5174, 새 Frame): Gap M → 칸 「M」 · 풍선 「M · 12px」, 가로 Padding XS → 「XS」 · 「XS · 4px」, 세로 Padding 에 `l` Enter → 「L」 (토큰), Gap 에 `10` Enter → 「10」, Style › Radius M → 「M」 · 「M · 8px」, Text › Font Size Heading M → 「H M」 · 「H M · 22px」 · Line Height 「auto」 · 「auto · 26」. ▾ 유지 · 칩 0 · 콘솔 오류 0.
  - 위치: `apps/builder/src/builder/components/property/PropertyUnitInput.runtime.ts` (`getInputDisplayValue` · `findMatchingPreset`) · `PropertyUnitInput.components.tsx`

## [토큰 단계는 메뉴 버튼 안 글자 — Width 의 단위 트리거와 같은 자리] - 2026-11-10

### Changed

- **Design 패널의 토큰 칸 (Layout 의 Padding · Gap · Position, Style 의 Radius · Border Width, Text 의 Font Size) 에서 고른 단계 (M · L · thin …) 를 메뉴 버튼 안에 보인다** (사용자 요청): 전에는 입력칸 안에 칩으로 그렸다. 이제 Width 의 단위 트리거 (PX · FR) 처럼 ▾ 자리에 단계 글자 (mono 10) 가 들어가고, 단계가 아닌 값이면 ▾ 그대로다.
  - 버튼은 글자 폭만큼 넓어진다 (최소 20 — 「thick」). 접근 이름에도 단계가 붙는다 (「Horizontal padding presets: L」).
  - Line Height 의 「auto」 칩과 Box Shadows 머리글의 단계 칩은 그대로다.
  - 테스트 `PropertyUnitInput.test.tsx` · `adr298Phase2/3/4Panel.test.tsx` 를 새 자리로 옮겼다. 원복 (버튼 안 ▾ 고정) 하면 4 RED 다.
  - Live (Playwright 5174, 새 Frame): Gap M → 「12 [M]」, Horizontal padding L → 「16 [L]」, Vertical padding 0 → 「0 [▾]」, Style › Radius M → 「8 [M]」. 버튼 20 × 20 · 입력칸 칩 0 · 콘솔 오류 0.
  - 위치: `apps/builder/src/builder/components/property/PropertyUnitInput.components.tsx` · `components/styles/form-controls.css`

## [패널의 native 버튼 · 입력 → RAC] - 2026-11-10

### Changed

- **빌더 패널의 native `<button>` · `<input>` · `<textarea>` 를 RAC 로 바꿨다** (패널 감사 4 — 50 파일 · 약 100 곳 → 허용 6 곳).
  - 버튼 32 곳 → RAC `Button`. 눌림 상태가 있는 것 (Theme 활성 · Gradient 정지점 · Mesh 점 · Data 프리셋 카드 · 날짜 ISO 전환) 은 `ToggleButton` 이다.
  - 입력 · 글 상자 약 45 곳 → RAC `Input` · `TextArea`. hover · focus 상태를 `data-*` 로 낸다. class 가 없던 입력 (AI 설정 · AI 입력창 · 날짜 입력) 에는 class 를 직접 줬다 — RAC 기본 class 가 붙으면 빌더 위젯 Input 모양이 걸린다.
  - RAC `Button` 은 `title` 을 DOM 에 넘기지 않는다. 그래서 설명 풍선은 `ActionTooltipTrigger` 로 옮겼고 (컴포넌트 추가 · 스포이드 · 날짜 ISO), 비활성 버튼의 이유는 새 `DisabledReason` 이 맡는다 (마지막 테마 삭제 · 변수 이름 충돌).
  - Data 프리셋 카드 묶음의 `role="list"` · `listitem` 을 `group` 으로 바꿨다 — 버튼에 listitem 을 달면 버튼 역할이 사라졌다.
- **Image fill 미리보기 · Data CSV 드롭존 · Site 이미지 고르기가 RAC `DropZone` · `FileTrigger` 다**: 옛 Image fill 미리보기는 `div onClick` 이라 키보드로 열 수 없었다. 이제 비어 있으면 상자 전체가 파일 선택 버튼이다.
- **Data API 「기존 표에 붙이기」 가 공용 `Checkbox` 다** (native checkbox).
- **게이트 `nativeControls.static.test.ts`**: 빌더 JSX 의 native `button` · `input` · `textarea` · `select` 는 사유가 적힌 허용 목록만 둔다 — 패널 이동 손잡이 (useMove) · Canvas grid 손잡이 2 · Canvas 글자 편집기 · Canvas 페이지 제목 · 메뉴가 여는 file input 2. 원복하면 RED 다.
- Live (Playwright 5174, 새 프로젝트): Section 접기 · 펼치기, Theme 복제 (1 → 2) · 활성 전환 (aria-pressed), Data 만들기의 프리셋 카드 (눌림 · group) · CSV 드롭존 버튼에 Enter → 파일 선택 창 → `people.csv` 2 × 2 미리보기, 표 이름 입력 focus, 컴포넌트 목록 「text」 hover 툴팁 「Add text element」 · 클릭으로 Text 추가. 콘솔 오류 0. Image fill 은 채움 종류 전환 단계가 하니스에서 막혀 단위 테스트로만 확인했다.
- 위치: `apps/builder/src/builder/nativeControls.static.test.ts` · `components/ui/DisabledReason.tsx` · `panels/**` · `components/**`

## [글꼴 고르기 — 다른 검색 팝오버와 같은 SearchablePicker] - 2026-11-10

### Fixed

- **글꼴 고르기 목록의 안쪽 여백 · 검색 칸 · 키 동작이 다른 검색 팝오버와 같다** (사용자 지적): 전에는 첫 행이 테두리에서 9 였고 (다른 목록은 5), 검색 칸이 손으로 만든 입력이라 모양이 달랐으며 검색 칸에서 ↓ 로 목록에 들어가지 못했다.
  - Why: 빌더 팝업 목록 정본 (`builder-popup-list.css`) 은 행 모양만 정하고 목록 안쪽 여백은 정하지 않았다. 글꼴 고르기는 팝오버 · 검색 · 목록을 따로 조립하면서 옛 「안쪽 pad 8」 (panel-ui 20) 을 적고 있었다.
  - 이제 글꼴 고르기도 `SearchablePicker` 로 그린다. `SearchablePicker` 에 선택 ✓ (`selectedKey`) · 검색 칸 끄기 (`searchable` — 글꼴 7 개 미만) · 목록 아래 줄 (`footer` — 글꼴 관리) 자리를 더했다.
  - 게이트 `builderPopupList.static.test.ts` (e) 를 추가했다. 팝업 목록 ListBox 의 class 에는 패널 CSS 가 padding 을 0 또는 `--spacing-xs` 로만 줄 수 있다. 원복하면 RED 다.
  - Live (Playwright, 새 프로젝트 · 사용자 글꼴 2 개): Theme › Font 를 열면 첫 행이 테두리에서 5 · 행 28 · 폭 233, 검색 칸이 focus 를 받고, 「beta」 입력 → ↓ → Enter 로 Beta Serif 가 골라져 팝오버가 닫힌다. 구역 머리글 (Built-in · My fonts) 과 Manage fonts 줄이 있다. Variant · Font Weight · Font Size · 컴포넌트 교체 목록도 첫 행 5 다.
  - 위치: `apps/builder/src/builder/panels/fonts/FontFamilyPicker.tsx` · `.css` · `components/property/SearchablePicker.tsx` · `.css`

## [패널의 손 ARIA 위젯 → RAC] - 2026-11-10

### Fixed

- **글꼴 업로드 영역을 키보드로 열 수 있다**: 옛 `div role="button" tabIndex=0` 은 클릭만 받아 Enter · Space 가 동작하지 않았다.
  - 이제 RAC `DropZone` + `FileTrigger` + `Button` 이다. 영역 전체가 파일 선택 버튼이고, 끌어 놓기 상태는 `data-drop-target` 이다.
  - Live: Theme › Font › Add fonts 에서 Enter 로 파일 선택 창이 열린다 (여러 개 선택). 120 점선 상자 · focus 테두리는 그대로다.
- **Interactions `{{` 변수 자동완성이 화면 낭독기에 활성 후보를 알린다**: 입력에 `role="combobox"` · `aria-expanded` · `aria-controls` · `aria-activedescendant` 가 없었다.
  - RAC ComboBox · Autocomplete 는 입력 전체 글자로 거른다. 여기는 캐럿 자리의 토큰을 글 중간에 끼우는 동작이라 손 구현을 두고, APG combobox 계약만 다 갖췄다.
  - 테스트 `PropertyInput.stateSuggest.test.tsx` 를 추가했다. 원복하면 RED 다.
- **액션 바 툴팁이 RAC Tooltip 이다**: 옛 ShortcutTooltip 은 hover · focus 를 손으로 받아 `role=tooltip` 을 그렸고, 트리거와 `aria-describedby` 로 잇지 않았다. 이제 다른 아이콘 버튼과 같은 `ActionTooltipTrigger` 를 쓴다. 쓰는 곳이 없어진 `ShortcutTooltip.tsx` · `.css` 와 그 CSS 참조는 지웠다.
  - Live: Detach instance 위에서 「Detach instance ⌘⌥X」 가 뜨고, 트리거의 `aria-describedby` 가 툴팁을 가리킨다. 높이는 28 이다.

### Changed

- **색 입력 모드 (HEX · RGBA · CSS) · 이미지 채움 Mode (Fill · Fit · Stretch) seg 를 RAC `ToggleButtonGroup` 으로 바꿨다**: radiogroup · radio · 방향키 이동을 RAC 가 맡는다. 옛 구현은 button 에 role · aria-checked 를 손으로 달아 방향키가 없었다.
  - 모양은 그대로다. CSS 상태 선택자만 `data-selected` · `data-hovered` · `data-focus-visible` 로 옮겼다.
  - Live: 색 모드 RGBA 클릭 → 방향키 → Space 로 CSS 선택 (선택 칠 · 버튼 20 그대로). 이미지 Mode 는 단위 테스트로 확인했다 — live 에서는 채움 종류를 Image 로 바꾸는 단계가 하니스에서 반영되지 않아 BLOCKED (바꾼 파일과 무관).
- **AI 에이전트 설정의 provider · 키 저장 칸을 패널 컴포넌트로 바꿨다**: native `<select>` 대신 `PanelSelect`, native checkbox 대신 공용 `Checkbox`.
- **유지**: Gradient 정지점 (`role="slider"`). RAC Slider 는 thumb 이 서로 지나가지 못하고 track 을 누르면 thumb 이 옮겨 간다. Gradient 는 정지점이 교차하고, 빈 곳 클릭은 정지점 추가, 아래로 끌면 삭제다. APG slider 키보드는 이미 갖췄다.
- 위치: `panels/fonts/components/FontUploadZone.tsx` · `components/property/PropertyInput.components.tsx` · `components/overlay/actionBar/ContextualActionBar.tsx` · `panels/styles/components/ColorInputModeSelector.tsx` · `ImageFillEditor.tsx` · `panels/ai/components/AgentProfileSettings.tsx`

## [검색 고르기 팝오버 한 벌 — SearchablePicker] - 2026-11-09

### Changed

- **검색되는 고르기 팝오버가 `SearchablePicker` 하나로 그려진다**: Interactions 대상 · 값 고르기, 컴포넌트 교체 (슬롯 삽입 · instance 속성 포함).
  - 부품: 트리거 · 팝오버 · Dialog · 검색 칸 (`SearchField` control) · 구역 머리글 목록 (`SearchablePickerSection`). 항목이 많으면 보이는 행만 그린다 (`virtualized`).
  - Why: 같은 조합을 세 파일이 따로 조립했다. 팝오버 그림자 · Dialog 여백 · 목록 최대 높이 CSS 도 두 벌 (`interactions-target-*` · `component-swap-*`) 이었다. 이제 `SearchablePicker.css` 한 곳이고, 호출부 CSS 에는 최소 폭과 Canvas 에서 가리킨 행 표시만 남았다.
  - 아이콘 고르기는 견본 격자에 개수 표시가 있어 대상에서 뺐다.
  - 게이트 `builderPopupList.static.test.ts` (d): RAC `Autocomplete` 는 SearchablePicker 와 허용 목록 (아이콘 격자 · 명령 팔레트 · 헤더 메뉴) 에서만 쓴다. 원복하면 RED 다.
  - Live (Playwright, 새 프로젝트, 3 PASS):
    - 컴포넌트 교체: 「link」 검색으로 81 → 2, ↓ 로 행 표시. Escape 두 번에 닫히고 focus 가 트리거로 돌아온다.
    - Interactions 대상: 구역 머리글 두 개, Body 고르기
    - 값 고르기: 변수 greeting → 칩 「Variables › greeting」
    - 모두 정본 class · hover 칠이 있고, 그림자 · 여백 4 · 최소 폭 (240 · 260) · 목록 최대 높이 320 은 전과 같다.
  - 위치: `apps/builder/src/builder/components/property/SearchablePicker.tsx` · `.css` · `panels/interactions/catalog/CatalogTargetPicker.tsx` · `panels/interactions/ValueField.tsx` · `panels/properties/catalog/CatalogSwapPicker.tsx`

## [빌더 패널 Select 틀 한 벌 — PanelSelect] - 2026-11-09

### Changed

- **빌더 패널의 Select 가 모두 `PanelSelect` 하나로 그려진다**: PropertySelect · Data 바인딩 (컬렉션 · 필드 매핑) · 변수 유형 (State 절) · API Method · 가져오기 열 동작.
  - Why: PropertySelect 의 마크업 (Select · 트리거 · 팝오버 · 목록) 을 CollectionBinding (2) · VariableTable · CompactSelect 가 복사해 썼다. 그래서 PropertySelect 를 고쳐도 넷은 따라오지 않았고, 팝오버가 닫힐 때 트리거 focus 복원은 Select 마다 있기도 하고 없기도 했다.
  - 트리거 안 내용 (값 · 「라벨: 값」 · 유형 아이콘) 만 호출부가 정한다. 항목은 `PanelSelectItem` 으로, 이름만 · 아래 설명 · 오른쪽 짧은 정보 · 색 점 중에서 고른다.
  - 게이트 `builderPopupList.static.test.ts`:
    - (a) 검사 단위를 파일에서 Popover 로 바꿨다. 파일 단위일 때는 Data › Variables 표의 셀 유형 목록이 같은 파일의 다른 Popover 덕에 검사를 빠져나가 옛 hover 로 남아 있었다.
    - (c) RAC `Select` 는 `PanelSelect.tsx` 에서만 쓴다.
    - 둘 다 원복하면 RED 다.

### Fixed

- **Data › Variables 표의 셀 유형 목록도 hover 행이 뚜렷하다**: 빌더 팝업 목록 정본 class 가 빠져 있었다.
- **Data 바인딩 필드 목록의 유형 표시가 잘리지 않는다**: 전에는 칸이 남아도 「STR…」 로 잘렸다. 행이 목록 폭을 채우지 않아 유형 칸의 최대 폭 (50%) 이 글자 폭 기준으로 계산됐다. 이제 유형이 오른쪽 끝에 붙는다.
- Live (Playwright, 새 프로젝트, 6 PASS):
  - Button Variant 고르기
  - ListBox 데이터 소스 Users · 값 필드 num
  - API Method GET → POST
  - Variables 표 셀 유형 String → Number
  - State 절 유형 String → Boolean
  - 모두 팝오버에 정본 class 가 붙고 hover 행이 칠해졌다. 닫힌 뒤 focus 는 트리거로 돌아온다.
- 위치: `apps/builder/src/builder/components/property/PanelSelect.tsx` · `PropertySelect.components.tsx` · `CollectionBinding.tsx` · `components/variables/VariableTable.tsx` · `panels/datatable/editors/CompactSelect.tsx` · `PropertySelectGrid.css`

## [Select · ComboBox 팝오버 목록 여백 통일 — S2 8px] - 2026-11-09

### Fixed

- **사용자 Select · ComboBox 팝오버 목록 여백이 둘 다 8px 이다** (사용자 지적): 전에는 Select 8px · ComboBox 4px 로 달랐다.
  - 기준은 S2 1.8.2 설치본이다. Picker · ComboBox 둘 다 Popover `padding="none"` 이고 목록 `padding: 8` 이다.
  - Why: Select 는 picker externalStyles 에 목록 여백 8 을 따로 적었고, ComboBox 는 ListBox 의 `inPopover` 가지 (4) 를 읽었다. 이제 ListBox rule 의 `inPopover` 한 값 (`var(--spacing-sm)`) 을 두 picker 가 같이 읽는다.
  - 단독 ListBox · 단독 Menu 의 4px 은 그대로다. 2026-10-13 RAC 레퍼런스 테마 결정이고, S2 에는 스타일 있는 단독 ListBox 가 없다.
  - 게이트: `d3S2Alignment.static.test.ts` 「picker 목록 여백」 — S2 소스 · 8px · picker 가 목록 여백을 다시 적지 않는지 확인. 수정 전 RED.
  - Live: Publish 에서 Select · ComboBox 목록을 열어 봤다. 둘 다 Popover 0 · 목록 8px · 첫 항목 위 8px.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (ListBox · Select) · 생성 `ListBox.css` · `Select.css`

## [빌더 팝업 목록 한 어법 — hover 행이 뚜렷하게] - 2026-11-09

### Fixed

- **빌더의 팝업 목록 hover 행이 뚜렷해졌고 모든 목록이 같은 모양이다** (사용자 지적):
  - 대상: Select · ComboBox · 글꼴 · Interactions 대상 · 값 · 컴포넌트 교체 · 표 참조 · 변수 형식 · 바인딩 목록
  - hover 행 칠: light gray-200 · dark zinc-700. 선택은 ✓, 구역 머리글 (글꼴 Built-in · Mine 등) 은 한 모양
  - Why: catalog Select · ComboBox 목록은 hover 행이 gray-200 이라 뚜렷하다. 빌더 목록은 표면 `--bg-raised` (gray-50) 위에 `--bg-overlay` (white) 를 칠해 hover 가 거의 보이지 않았다. 파일마다 hover 값을 따로 적어 (`--bg-overlay` · `--bg-muted` · 없음) 목록끼리도 달랐고, 구역 머리글은 다섯 벌이었다.
  - 정본은 `styles/modules/builder-popup-list.css` 한 곳이고, 목록 Popover 에 `BUILDER_POPUP_LIST_CLASS` 를 붙인다. 색은 빌더 메뉴 (헤더 · 컨텍스트) 와 같은 `--bg-muted` 다.
  - 게이트 `builderPopupList.static.test.ts` 는 두 가지를 본다: (a) Popover 안 ListBox 파일에 class 가 붙었는지, (b) 패널 CSS 가 행 hover 칠을 따로 선언하지 않는지. 둘 다 원복하면 RED 다.
  - 위치: `apps/builder/src/builder/styles/modules/builder-popup-list.css` · 목록 Popover 10 파일

## [Data 표 선택 checkbox 가 check 표시만 그리던 것 — 빌더 위젯 사본 보충] - 2026-11-09

### Fixed

- **Data 패널 Tables 탭의 선택 열 checkbox 가 다시 상자로 그려진다** (사용자 보고): ADR-305 직후 선택하지 않은 행에도 check 아이콘만 보였다. 지금은 빈 상자 · 선택 (✓) · 일부 선택 (−) 이 분리 전과 같다.
  - Why: 빌더 위젯 사본은 분리 직전에 찍은 빌더 화면 46 에서 쓰인 규칙만 옮겼다. 행이 있는 Data 표가 그 화면에 없어 공용 Checkbox 의 상자 규칙이 빠졌다. 행 편집 Dialog · 메뉴 규칙도 같은 이유로 빠져 있었다.
  - 찍는 화면을 23 늘렸다 (표 생성기 · 표 · 행 선택 · 표 메뉴 4 · 행 편집 · APIs · Variables · Interactions 이벤트 편집 · 명령 팔레트 · Workflow · 눈금자 · Site 패널 · 헤더 하위 메뉴 5 · tooltip). 분리 전 빌더에서 잰 결과로 이식을 다시 돌려 규칙이 245 → 282 가 됐다 (Checkbox 24 · Menu 4 · Table 4 · 생성 Dialog 6 · 생성 Menu 7 · overlays 1).
  - 분리 전 빌더 대비 69 화면 × 4 변형 Δ 0.
  - 게이트 (e): 빌더가 import 하는 공용 컴포넌트마다 위젯 시트에 자기 규칙이 있어야 한다. 수정 전 상태에서 Checkbox 하나가 RED 였다.
  - 위치: `apps/builder/src/builder/styles/widgets/` · `apps/builder/scripts/adr305-builder-snapshot.mjs` · `styles/__tests__/chromeWidgetSheets.static.test.ts`

## [ADR-305 Phase 2 ~ 5 — 빌더와 사용자 컴포넌트 CSS 분리] - 2026-11-09

### Changed

- **빌더 화면이 사용자 컴포넌트 시트 (catalog 생성 · 공유 수동) 를 더는 싣지 않는다**: catalog rule 을 고쳐도 Design 패널 · 헤더 · 대시보드 위젯이 따라 바뀌지 않는다 (2026-11-09 토글 그룹 회귀 — S2 `min-width` 가 빌더 버튼을 30px 로 — 같은 일이 구조적으로 생기지 않는다). 빌더 위젯은 분리 직전 빌더 화면에 맞던 규칙 245 의 사본 (`apps/builder/src/builder/styles/widgets/`) 을 읽는다 — 빌더 4 변형 (light · dark × 패널 폭 228 · 387) × 46 화면 computed style Δ 0.
  - Why: 빌더와 Preview 가 생성 시트 43 · 수동 시트 43 · 서로의 테마 시트를 같이 실어 한쪽을 고치면 다른 쪽이 바뀌었다. ADR-295 뒤 되돌리기 고정 · 게이트 커밋만 25건.
  - Preview · Publish 시트에서 빌더 몫 (빌더 분기 124 규칙 · 빌더 패널 전용 시트 7장 import) 을 뺐다 — Preview · Publish Δ 0.
  - Builder initial CSS 98,774 → 55,161 B gz · Preview CSS 73,391 → 66,729 B gz.
  - 게이트: `pnpm test:css-boundary` (세 HTML 진입의 실제 import 그래프 교집합 = 변수 · `@font-face` 시트만) — `codex:preflight` · pre-push (CSS · 진입 경로 변경) 가 호출한다.
  - 위치: `apps/builder/src/builder/styles/widgets/` · `builder-theme.css` · `main.tsx` · `packages/shared/src/components/styles/*.css` · `theme-preview.css`

## [ADR-305 Phase 0 · 1 — Publish 를 별도 문서로 · 빌더 · 사용자 CSS 분리 하니스] - 2026-11-09

### Changed

- **Publish 가 빌더 문서의 route 가 아니라 자기 문서 (`publish/index.html`) 로 열린다**: 빌더에서 Publish 를 열면 배포 base 아래 `publish/?project=…` 로 간다 (dev `/publish/` · production `/composition/publish/`). 옛 주소 (origin 의 `/publish`) 는 production 에서 base 밖이라 정적 호스팅에서 열리지 않았다.
  - Why: 옛 Publish 문서는 빌더 `index.html` 이라 Tailwind preflight · 빌더 시트를 같이 받아 Preview iframe 과 사용자 DOM 의 computed style 이 19,605 값 달랐다 (ADR-305 Phase 0 하니스). 새 Publish 는 사용자 컴포넌트 시트만 싣는다 — Preview 와의 차이는 뷰포트 폭 · Publish 자체 reset 의 2,013 값만 남고, 보이는 요소의 색 · 글자 크기 · 배경 변화는 0 (바뀐 것은 RAC 숨김 input · select · button 과 svg `vertical-align`).
  - Preview · Publish 테마가 빌더 chrome 테마 (`builder-system.css`) 를 싣지 않는다 — Preview 스냅샷 Δ 0.
  - 번들: Publish 앱은 `import()` 로 싣는다 (정적이면 Preview initial JS 가 151 → 528 KB 로 커지는 것을 실측). Builder +193 · Preview +95 B gz.
  - 위치: `apps/builder/publish/index.html` · `src/publish/main.tsx` · `vite.config.ts` · `openCatalogPublish.ts` · `packages/shared/src/components/theme-preview.css`

### Added

- ADR-305 스냅샷 하니스 — 빌더 45 화면 × 4 변형 · Preview/Publish 28 화면의 computed style (RAC 상태 합성 포함) 과 시트 규칙별 선택자 계수: `apps/builder/scripts/adr305-*.mjs`.

## [Design 패널 토글 그룹 — catalog 생성 CSS 의 최소 폭이 빌더 버튼에 닿던 것] - 2026-11-09

### Fixed

- **Design 패널의 토글 버튼이 20px 에서 30px 로 커져 세 번째 버튼이 칸 밖으로 밀렸다** (사용자 보고): Layout 탭의 Display · Space · Wrap 열이 Alignment · Gap 열보다 넓어졌고 (`114px 84px` — 본문 228px 를 넘어 Padding 줄도 늘어남), Text 탭 Align · Vertical · Style · Decoration · Case 와 Style 탭 Border Style 의 세 번째 버튼이 그룹 밖에 그려졌다. 사용자 ToggleButton rule 에 S2 최소 폭 (`min-width: {size.height}`, 5cf91844f) 이 들어가면서 같은 생성 시트를 읽는 빌더 버튼이 빌더 control 높이 30px 를 최소 폭으로 받았다.
  - Why: 빌더는 catalog 생성 시트 44장을 싣고 새 선언을 `builder-catalog-pins.css` 로 295 전 값에 고정한다. 그 누락을 잡는 게이트 (`builderCatalogVars.static.test.ts` (c)) 가 ToggleButton · ToggleButtonGroup 블록을 통째로 「빌더에 효과 없음」 으로 예외 처리해 `min-width` 와 그룹 기본 `gap` (3ca03f661) 이 통과했다.
  - 빌더 고정에 ToggleButton `min-width: auto` · ToggleButtonGroup 기본 · 크기별 `gap: normal` 을 더했고, 게이트 예외를 블록 단위에서 선언 단위 (빌더 위젯이 쓰지 않는 속성 · 선택자 12건, 각 사유) 로 좁혔다 — 고정을 빼면 원인 12건만 RED.
  - **Border Sides 버튼이 9px 로 눌렸다**: 반폭 칸 (84px) 에 버튼 5개를 두면서 그룹 기본 간격 (`data-density="regular"` 8px) 이 남아 있었다 (ADR-298 Phase 5). 그 그룹만 간격 0 — 버튼 15px.
  - live: Layout 열 `84px 84px 28px` · 본문 넘침 0, Text · Style 탭 그룹 버튼 20px · 넘침 0, Sides 15px.
  - 위치: `builder-catalog-pins.css` · `builderCatalogVars.static.test.ts` · `inspector-layout.css`

## [Design 패널 토글 아이콘 16×16 — indicator 그룹 버튼 여백 2] - 2026-11-09

### Fixed

- **Design 패널 Layout 탭 (Display · Space · Wrap) 의 토글 버튼 아이콘이 12×16 으로 눌렸다** (사용자 보고): 빌더 아이콘 버튼 규격은 아이콘 16 (`iconProps.size`) + 여백 2 = 20 인데, 인스펙터 indicator 그룹 버튼의 여백이 `--spacing-xs` (4) 라 20px 버튼의 내용 폭이 12 가 되어 svg 가 가로로만 줄었다. `--spacing-2xs` (2) 로 — Text · Style 탭의 같은 그룹도 함께.
  - Why: ADR-029 Phase 3 CSS 분할 때부터 4 였고, 아이콘 16 과 버튼 20 의 합이 맞지 않았다.
  - live: Layout 탭 아이콘 버튼 9개 모두 20×20 · padding 2 · svg 16×16.
  - 위치: `apps/builder/src/builder/components/styles/inspector-layout.css`

## [부품 host 를 원본 template 에서 파생 — Badge · TagGroup · Card · Tabs 도 자기 부품만] - 2026-11-09

### Fixed

- **Badge 안에 Button · TagGroup 안에 TextField 가 들어갔다** (사용자 보고 2차): 앞 엔트리의 「부품만」 규칙이 field 19종 손 표였다. 이제 표를 **원본 template 에서 파생**한다 — 합성 원본의 루트가 slot 이 아니고 부품을 가지면 그 type 은 직계 자식으로 자기 부품만 받는다 (field · Card · InlineAlert · Tabs · Toast · Disclosure · Checkbox · Switch · Radio · Button · ToggleButton · MenuTrigger · DialogTrigger · TagGroup · CheckboxGroup · RadioGroup · Autocomplete …). 자유 내용은 원본이 slot 으로 연 자리 (Card 의 Content · Dialog 의 content region · TagGroup 의 TagList · ToggleButtonGroup 의 루트 slot) 에만 — pen.dev 「content goes into slots only」 (ADR-261 사용자 결정 2) · ADR-278. 글자가 prop 인 Badge · StatusLight · Link 는 자식을 그릴 자리가 없어 leaf.
  - Why: 손 표는 보고된 type 만 고치는 반복이었다. 원본 template = S2 anatomy 라 「무엇이 부품인가」 의 정본이 이미 있었다.
  - 그대로인 것: 루트가 slot 인 원본 (Toolbar · Form · ButtonGroup · Nav …) 과 컬렉션 항목 (ListBoxItem · MenuItem · Tag · Tab · Column — S2 가 slot 내용을 자유롭게 받는다) 은 자유 내용. RAC 필수 부품의 대안 (MenuTrigger 의 Button · ActionButton) · 그룹 항목 (RadioGroup 의 Radio) · 감싸개 (FieldLabel · frame · Group) 는 선다. Design 패널 "+" 는 그룹의 항목 목록을 유지하고 그 밖의 부품 host 에서는 비어 있다.
  - 게이트: S2 가 `children` 을 주지 않는 모든 컴포넌트는 부품 host 또는 leaf (`d2S2Alignment.static.test.ts`) · 파생 결과의 모양 (`partsHosts.static.test.ts`). Button 안 Button 은 그대로 HTML 의 이유로 안내한다.
  - 위치: `nestingRules.ts` (`derivePartsHosts` · `catalogPartsHostTypes` · `PART_WRAPPER_TYPES`) · `domain/componentTraits.ts` (`GROUP_ITEM_TYPES` · `GROUP_ITEMS_WRAPPER` 이관) · `slots.ts`

## [field 는 자기 부품만 자식으로 받는다 — 팔레트 · 붙여넣기 · 넣기 목록] - 2026-11-09

### Fixed

- **TextField 를 선택하고 팔레트에서 TextField · NumberField 를 추가하면 선택한 필드 안에 들어갔다** (사용자 보고): 중첩 규칙이 field 가족을 「자유 내용」 으로 두어 (ADR-256 Phase 2b · 6c ~ 6e — RAC `<div>` 의 관찰) 어떤 자식도 받았고, Button 은 HTML 이 막아 형제로 갔을 뿐이었다. 이제 field (TextField · TextArea · NumberField · SearchField · ColorField · DateField · TimeField · DatePicker · DateRangePicker · Select · ComboBox · Slider · RangeSlider · Meter · ProgressBar · ColorArea · ColorSlider · ColorWheel · TokenField) 는 직계 자식으로 **자기 부품** (원본 template 루트의 부품 + FieldLabel · 레이아웃 래퍼 frame · Group) 만 받는다. 팔레트 · 붙여넣기 · AI 추가는 기존 「가까운 허용 조상으로 이동」 안내 그대로 상위 컨테이너에 넣고, Design 패널의 넣기 목록은 field 에서 비어 있다 (부품은 prefix · 도움말 명령으로).
  - Why: 소유자는 D2 의 S2 API — S2 field 컴포넌트는 `children` prop 이 없고 내용은 prop 에 묶인 부품뿐 (게이트 `d2S2Alignment.static.test.ts`; Picker · ComboBox 의 `children` 은 항목이라 안쪽 ListBox 에). 부품 표는 원본 template 과 `fieldPartsMatchOrigins.static.test.ts` 가 대조한다. 2026-09-08 같은 보고 (「textField 내에 textField」) 의 수리 표가 ADR-256 Phase 11 에서 사라진 뒤 재발했다.
  - AI 추가의 부모 탐색이 frame 으로 probe 하던 것을 실제 정의로 바꿨다 — field 는 frame (래퍼) 을 받지만 두 번째 field 는 받지 않아 probe 가 거부될 자리를 골랐다.
  - ToggleButtonGroup ⊃ ToggleButton · frame ⊃ field · Form ⊃ field 는 그대로.
  - **옮겨진 항목은 선택한 요소 바로 다음에 선다** (사용자 보고 2차): 전에는 상위 컨테이너의 맨 끝으로 갔다. 붙여넣기 메뉴의 「자기 다음」 과 같은 규칙 — 팔레트가 선택의 조상으로 올라갈 때마다 그 조상의 어느 자식 안에 선택이 있는지 기억해 그 다음 index 에 넣는다 (`paletteInsert.ts`).
  - AI 의 요소 추가도 같은 배치를 쓴다 (`catalogInsertPlacement` — 팔레트와 한 함수): 선택이 거부하면 선택 바로 다음에, probe 와 실제 insert 가 같은 명령. field 아래 감싸개는 부품 명령이 만드는 `FieldLabel · frame · Group` 만 (Slot 으로 우회 불가).
  - 위치: `nestingRules.ts` (`CATALOG_FIELD_PART_TYPES` · `catalogChildKind` `parts`) · `slots.ts` · `aiHost.ts` · `paletteInsert.ts`

## [날짜 필드 focus ring 은 상자에만 — S2 FieldGroup focusRing] - 2026-11-09

### Fixed

- **DatePicker · DateRangePicker 를 키보드로 focus 하면 Label 까지 감싼 바깥 outline 이 상자 ring 과 함께 그려졌다**: field 루트 rule 에 focus ring 이 있었고, RAC DatePicker · DateRangePicker 는 루트에 `data-focus-visible` 을 `within: true` 로 붙인다. S2 는 ring 을 상자 (`FieldGroup`) 에만 둔다 — 네 날짜 필드 루트에서 ring 을 지우고, DateRangePicker 는 상자 (Group) 가 ring 을 그린다.
  - Why: 날짜 필드 루트만 `FOCUS_RING_STATE` 를 공유했다 (TextField 루트에는 없다).
  - S2 `shouldTurnOffFocusRing` 대로 달력 버튼에 focus 가 있으면 DateRangePicker 상자의 ring · 진한 테두리를 끄고 버튼만 ring 을 그린다 (DatePicker 는 버튼이 상자 밖이라 이미 같다).
  - live (Publish, Tab 이동): DatePicker · DateRangePicker 루트 outline 없음 · 상자 2px ring + 테두리 rgb 19, 달력 버튼 focus 때 상자 ring 없음 · 테두리 rgb 218.
  - 위치: `componentRulesTable.ts` (DateField · TimeField · DatePicker · DateRangePicker)

## [ComboBox 버튼 위치 · 날짜 필드 비활성 · 테두리 두께 토큰 — S2 FieldGroup 후속] - 2026-11-09

### Fixed

- **ComboBox 버튼이 S2 보다 1px 안쪽에 있었다**: 버튼 겹침 여백 식에 `+1px` 가 남아 버튼이 바깥 끝에서 5px 였다. S2 ComboBox 는 `paddingEnd = 높이 × 3/16 − 테두리 2` 를 테두리 안쪽에서 재므로 바깥 끝에서 높이 × 3/16 (M = 6px) 이다. 식에서 `+1` 을 지웠다 — live: Canvas · Publish 모두 끝 6px.
- **비활성 날짜 필드 (DateField · TimeField · DatePicker · DateRangePicker) 가 통째로 흐려졌다**: S2 FieldGroup 은 비활성에 투명도를 쓰지 않고 TextField 처럼 테두리 · Label 을 비활성 색으로 바꾼다. 루트의 투명도를 지우자 날짜 필드 Label 이 비활성 색을 받지 못하던 누락이 드러나, Label 색 트리와 label owner 목록에 네 필드를 더했다. DateRangePicker 상자도 투명도 · 회색 바탕 대신 테두리만 비활성 색이다.
  - Why: 날짜 필드만 `DISABLED_STATE` (opacity) 를 공유해 Input 계열과 다른 비활성 규칙을 썼다.
  - live: 비활성 DateField 루트 투명도 1, Label · 테두리 rgb 198 — Canvas #c6c6c6 과 같다.
  - 위치: `componentRulesTable.ts` · `manualBoxRules.ts` (DateRangePicker Group 비활성 part rule) · `runtime/presence.ts`
- **TokenInput · SelectBox 테두리 두께가 리터럴이었다**: 테두리 두께는 테마가 정하는 축 (ADR-227) 이라 TokenInput M 은 `{border.width.thin}`, SelectBox 는 `{border.width.thick}` 토큰을 쓴다 — 기본 테마 화면 변화는 없고 테마의 두께 설정을 따른다.

## [Disclosure XL chevron · Avatar 크기 Do · 빈 font-size 선언] - 2026-11-09

### Fixed

- **Disclosure XL 의 chevron 이 다른 크기보다 작았고 Canvas · Preview 가 달랐다**: XL 만 S2 ui-icon 표 값 14px 로 svg 를 덮어써, Preview 는 14 · Canvas 는 14 상자에 18 글리프였다. 사용자 결정 (「lucide 로 다른 사이즈와 동일하게」) 대로 덮어쓰기를 지워 XL 도 S · M · L 처럼 trigger 의 lucide Icon 18 을 쓴다 — Canvas · Publish 모두 18×18 (live).
- **Interactions 에서 Avatar · AvatarGroup 의 「크기 정하기」 Do 가 사라졌다**: 크기 종류가 `avatar-size` · `avatar-group-size` 로 바뀐 뒤 Do 유도 표에 없었다. S2 크기 선택지 Do 로 다시 연결하고, 고른 값은 문서의 숫자 크기로 쓴다.
- **날짜 필드 상자가 TextField 와 달랐다 (DateField · TimeField · DatePicker · DateRangePicker)**: S2 는 날짜 필드 상자를 TextField 와 같은 `FieldGroup` 으로 그리는데, S2 정렬 (3ca03f661) 이 Input 만 옮겨 날짜 상자는 테두리 1px · focus 때 accent 2px outline 으로 남았다. Input rule 의 칠 · 테두리 2px · 상태 (focus within = 진한 테두리) 를 같이 쓰고, DatePicker 버튼은 테두리 안 4px 를 지킨다.
  - DateRangePicker 는 Canvas 용 칠 사본이 DOM inline 으로 새어 시트의 hover · focus 테두리를 덮고 있었다 (focus 해도 휴지 테두리 — accent outline 만 보였다). DOM 은 시트에 맡긴다.
  - live (Publish): 세 날짜 상자 휴지 = TextField (2px · rgb 218 · 흰 바탕 · 높이 32), focus 진한 테두리 rgb 19, DatePicker · DateRangePicker 버튼 끝 6px — Canvas 도 같은 값.
  - 위치: `componentRulesTable.ts` (DateInput · DatePicker · DateRangePicker) · `manualBoxRules.ts` · `domBinding.runtime.ts` `sheetPaintedBox`
- **Properties 에서 SegmentedControl 의 선택 (`selectedKey` · `defaultSelectedKey`) 이 State 절에 있었다**: Tabs 등 다른 선택 컴포넌트는 Content 절이다 — 「같은 prop 은 모든 컴포넌트에서 한 절」 (사용자 결정 2026-10-13) 대로 Content 로 옮겼다.
- 생성 CSS 의 빈 `font-size: ;` 선언 44줄 (Avatar · AvatarGroup · MeterFill · ProgressBarFill · SideNav 계열 · SelectBoxGroup · Accordion · Disclosure) 을 내지 않는다 — 브라우저가 버리던 선언이라 화면 변화는 없다.

## [비활성 버튼 칠 · 굵은 InlineAlert 설명 · 정적 선택자 · 낡은 테스트 갱신] - 2026-11-09

### Fixed

- **disabled field 의 버튼이 Preview 에서 활성 색으로 그려졌다**: DOM pass 의 Button props 에는 RAC field context (`isDisabled` · id · aria) 가 합쳐져 있어, 규칙의 disabled 칠과 다른 휴지 `visual` 이 「작성값」 으로 읽혀 inline 에 실렸다 — disabled Select 는 Preview #292929 · Canvas 회색으로 갈렸다. 작성값 판정을 문서 record 로 하고, field 버튼은 field 의 `isDisabled` 를 파생해 Canvas 칠도 S2 disabled 색으로 맞췄다 (NumberField stepper · ComboBox · DatePicker 버튼 포함).
- **비활성 ButtonGroup 의 버튼 글자가 휴지 색이었다**: Canvas 는 disabled 바탕 위에 흰 글자 (accent) 를, Preview 는 inline 휴지 칠로 활성처럼 그렸다. ButtonGroup · field 가 비활성화하는 Button 의 Text · Icon 은 그 Button 의 상태 칠을 따른다 (DOM `color: inherit`, Canvas 는 같은 조건 트리) — 두 쪽 모두 S2 `disabled-content`.
- **InlineAlert `boldFill` 의 설명 글자가 Preview 에서 회색이었다**: 도움말 inline 색을 지우는 규칙이 파생 흰색까지 지웠다. 파생 색은 남긴다.
- **ToggleButtonGroup 의 indicator 모드 press 규칙 3개가 Preview · Publish 에서 적용되지 않았다**: 생성기가 `staticSelectors` 의 `&…` 키를 자손 선택자 (`.root &[…]`) 로 냈다. `&` 는 root 자신으로 붙인다.
- **SearchField 의 터치 글자 시작이 S2 보다 0.33 ~ 0.45px 컸다**: 글리프의 `fontRelative(-2)` 는 터치에서도 2/14em 이라 터치 계수 8/17 − 2/14 (= 39/119) 로 고쳤다 (데스크톱 값 그대로).
- **Properties 의 Content 에 `aria-label` · 항목 `id` 가 Accessibility 절과 함께 두 번 보였다** (Link · Slider · RangeSlider · TokenField · SegmentedControl · SelectBox · SelectBoxGroup · ActionButtonGroup · SheetContent): `editorHidden` (accepts 는 유지 — Code · RAC 통과).
- **ActionBar 「값 설정」 의 입력 라벨에 키 문자열이 보였다** (없는 `capabilityParams.value` → `capabilities.paramValue`) · 텍스트 편집기 로딩 화면의 aria-label 이 한국어 고정이었다 (`canvas.textEditorLoading`). 그 밖에 locale 에 빠진 키 3개 (`actionBarSelection` When 그룹 · `toastShape`) 를 채우고 ko 「기본값」 을 「기본」 으로 맞췄다.

### Tests

- 낡은 builder unit 테스트 갱신 — 실패 62 파일 · 313 건 → 5 파일 · 6 건. 남은 것: DatePicker necessity-label (LOW deferred) · Tree 선택 Checkbox 정적 렌더 remount (production 은 controlled 경로 — LOW) · `docs/how-to/samples` contract 54 (63 과 차이) · 빌더 chrome 치수 295 기준 대비 98 건 (pin 오류에 가려 있던 게이트) · shared 패키지 49 건 (HEAD 와 같음).
- 원복 RED: DOM 작성값 판정 (Select · NumberField · ButtonGroup 3건) · field 버튼 파생 disabled (NumberField) · Button 글자 상태 칠 (NumberField · ButtonGroup) · InlineAlert 설명 흰색. live (Chrome, Publish): disabled Select · NumberField stepper · ButtonGroup 글자 rgb(198,198,198) · 바탕 rgb(233,233,233) — Canvas 와 같음, InlineAlert boldFill 설명 흰색, Undo 뒤 #292929 복귀, indicator 규칙 선택자 적용.

## [후속 4건: 풀리지 않은 slot 바인딩 · SelectBox When · 선택값 줄 높이 · Pagination 카드] - 2026-11-09

### Fixed

- **instance 에 slot 이 없으면 원본 안쪽 overlay 가 `slot="{slot}"` 을 글자 그대로 DOM 에 냈다** (11-07 `792815efc` — 같은 type 의 안쪽 노드에 `{slot}` 을 묶는 라이브러리 pass-through): Popover · Tooltip 원본의 본체 요소가 그 이름을 RAC slot context 에 넘겼다. 값 없는 `{slot}` 은 slot 없음으로 지운다 (`resolver.ts` `withoutUnboundSlot` — 다른 미충족 placeholder 는 그대로, `{icon}` 숨김 판정 유지).
- **SelectBox 의 When onAction 이 패널에는 있는데 실행되지 않았다**: S2 1.8.2 는 SelectBox 에 `onAction` 이 없고 (`SelectBoxGroupProps` Omit), RAC toggle 선택은 선택이 비었을 때만 항목 action 을 낸다 — 첫 상자가 선택된 원본에서는 클릭 · Enter 가 선택만 바꿨다. SelectBox 의 When 목록에서 뺐다 (선택은 SelectBoxGroup `onSelectionChange`).
- **Canvas 의 Select 선택값이 줄 높이 없이 그려졌다** (11-05 `71922bd0f` 이 값을 rule 상자 + 글자 자식으로 그린 뒤): 글자 자식이 서체 기본 줄 높이 (M ≈ 16.7) 를 써 DOM 18 과 달랐고, trigger · 선택값의 lineHeight 편집이 Canvas 에 닿지 않았다. `catalogTextMetrics` (작성값 → trigger 상속값) 를 글자 자식에 싣는다.
- **Library 의 Pagination 카드에 Instance 줄이 생겼다** (`5745593c4` 의 Buttons slot): 같은 Button 묶음인 ButtonGroup · ToggleButtonGroup 처럼 원본만 그린다 (`ORIGIN_ONLY_CARDS`).

### Tests

- 원복 RED: `adr256OverlayArrow` (`slot={slot}`) · `selectBoxGroupS2` 「no item onAction」 (`['onAction']`) · `selectPlaceholderPaint` 10건 (`undefined`). `selectPlaceholderPaint` 는 값을 글자 자식에서 읽고, placeholder 색을 S2 Picker 의 `color: inherit` (trigger 색) 으로 고쳤다. live (Chrome): Publish 문서 `[slot="{slot}"]` 0 · Tooltip 요소 slot 없음, Canvas 선택값 글자 줄 높이 18 (DOM 과 같음), Interactions 패널 「SelectBox provides no triggers」.

## [Preview 회귀 3건: Text HTML id · picker 메뉴 방향 · field 밖 설명 글자 크기] - 2026-11-09

### Fixed

- **Text 에 작성한 HTML id · class · aria-label 이 Preview · Publish DOM 에서 빠졌다** (11-06 `d3aba8255` 회귀): Select 선택값 typography 를 위해 Text 바깥에 둔 wrapper 가 `style` 만 읽고 DOM pass 가 붙인 속성을 버렸다. wrapper 가 `RacSlotScope` 와 같은 `overScopeProps` 로 그린 요소에 넘긴다.
- **Select · ComboBox · MenuTrigger 의 Direction · Align 이 Preview 에서 무시되어 메뉴가 늘 아래 · 시작으로 열렸다** (11-07 `792815efc` 회귀 — Canvas 는 정상): RAC slot context 값을 record 에 합칠 때 picker 의 PopoverContext `placement` 까지 들어가, Popover 가 「작성한 위치 없음」 을 알아보지 못했다. `placement` 는 합치지 않는다.
- **field 밖 Description 이 한 단계 커졌다** (11-06 `3ca03f661` 이 field 도움말을 S2 `controlFont` 로 올린 부작용): Tooltip 12 → 14, IllustratedMessage 설명 S · M · L 14 · 16 · 16 (S2 12 · 14 · 14), InlineAlert 설명 14 · 16 · 18 (S2 `body-sm` 기준 12 · 14 · 16), Popover · PreviewTrigger · Sheet 본문 12 → 14. 원본 크기와 IllustratedMessage 표를 S2 값으로, InlineAlert 의 한 단계 올림 표를 지웠다. Dialog 본문은 S2 `body` 16 과 같아 그대로 둔다.

### Tests

- 원복 RED: `phase4Typography` (id `''` ≠ `greeting`) · `s2OverlayPosition` 4건 (`bottom` ≠ `top` · `right`) · `illustratedMessageNodeTree` 3건 · `adr254ContainerParts` Tooltip 글자 (14 ≠ 12). live (Chrome, Publish): Text `id="text_1"` 출력, Select Direction top · Align end → 메뉴 `data-placement="top"` 오른쪽 끝 정렬, Tooltip 12px · IllustratedMessage · InlineAlert 설명 14px — Canvas record 값과 같음.

## [글자 폭: Canvas 와 Preview 가 같은 서체 기능 · 가변 축으로 글자를 만든다] - 2026-11-09

### Fixed

- **긴 Label 의 줄 나눔이 Canvas 와 Preview 에서 갈렸다** (Pretendard 14px "…and the" Canvas 343.35 / Preview 341.80): Canvas paragraph 는 문서 서체 기능 (`cv02` · `cv03` · `cv04` · `cv11`) 을 늘 쓰는데, Preview 버튼이 여는 Publish 문서에는 그 값이 없었다 (`preview.html` reset 과 Canvas 상수에만 손 복사본). 목록 하나 (`CATALOG_FONT_FEATURES`, `fontDefaults.ts`) 를 Canvas · `applyCatalogPreviewTheme` (Preview · Publish 문서 root) · Preview reset 이 같이 읽는다.
- **opsz 축이 있는 가변 서체가 Canvas 에서만 넓었다** (Inter 16px 문장 Canvas 531.26 / DOM 525.86 — 12 · 14px 는 일치): CSS 는 `font-optical-sizing: auto` 로 `opsz` = 글자 크기를 쓰는데 Canvas 는 넘기지 않았고, `wdth` 는 Adobe Clean 에만 넘기는 서체별 분기였다. `cssFontVariations` (옛 `spectrumFontVariations`) 가 서체와 무관하게 CSS 규칙대로 `wght` · `wdth` · `opsz` 를 넘기고 (없는 축은 CanvasKit 이 무시) 측정 · 그리기가 같이 쓴다.

### Tests

- `documentFontFeatures.browser.test.ts` (Publish stylesheet + 공용 theme 적용 → body 기능 = Canvas 목록) · `variableFontAxes.browser.test.ts` (내장 서체 전부 × 12 · 16 · 24 · 40px × 400 · 600 — Canvas paragraph 폭 = DOM, 0.1px) — 원복 RED: 기능 줄 제거 시 `[]`, `opsz` 제거 시 Inter 16 · 24 · 40px 6건. live: Publish Label 의 줄 나눔 · 아이콘 자리가 Canvas 와 같음 (343.35 · 91.51 · 95.02), Pretendard · Inter 12건 0.2px 이내.

## [컨테이너 층: portal 된 오버레이 · 상태 칠이 바뀐 컨테이너에서 Canvas 와 Preview 가 같은 층 — ADR-303 code-review 후속] - 2026-11-08

### Fixed

- **컨테이너가 아닌 Popover · Modal · Tooltip · SheetOverlay 안의 reader (ListBox · Menu · Nav …) 가 Preview 에서 base 를 칠했다** (ADR-303): Canvas 는 문서 부모를 따라 위 층 (예: layer-1 frame) 을 읽는데, RAC 는 본체를 body 로 portal 해 DOM 의 `--container-bg` 상속이 끊겼다. 본체가 위 층을 `_containerLayer` 로 받아 자기 inline 변수로 싣는다 (`catalogDerivesContainerLayer` · `catalogContainerCss`).
- **컨테이너 판정이 휴지 배경을 `isQuiet` 하나로만 평가했다**: 선택된 Card (accent-subtle) · emphasized ActionBar (neutral) · disabled SelectBox 를 층 컨테이너로, border InlineAlert (base) 를 컨테이너 아님으로 판정해 안쪽 reader 가 실제 칠과 다른 층을 따랐다. 칠과 같은 조건 집합 (`resolvers/paintConditions.ts` `catalogPaintConditions` — `resolveCatalogPaint` 와 공유) 으로 평가한다.

### Tests

- `containerLayer.test.ts` +2 (portal 본체 변수 · 의존 재계획, 상태 조건 5종) — 수정 전 RED 2 · `adr303ContainerParity` browser PASS · live (layer-1 frame 안 hex Popover 의 reader 배경 255 → 248 = layer-1, 선택된 Card 안 ListBox 층 elevated → base · 해제 시 복귀, 콘솔 0).

## [코드에 새로 쓴 `<Popover size="L" />` 가 Apply 된다 — ADR-301 구현 판독 round 3 m1] - 2026-11-08

### Fixed

- **page 코드에 펼치는 Library 원본을 prop 과 함께 새로 쓰면 (`<Popover size="L" />`) Apply 전체가 `notInCode` (size) 로 거절됐다** (ADR-301 회귀): 생성기는 template 자리가 읽는 prop 을 안쪽 요소에 쓰는데 (`<DialogTrigger><Popover size="L">`), 대조는 바깥 root 끼리 비교했다. 새 펼친 요소의 그런 prop 은 그 값을 읽는 자리에서 찾는다 — root 에 남는 prop (`isOpen`) 은 그대로 root 끼리, 어느 자리도 갖지 않는 값은 계속 거절 (`codeViewEdit.ts` `expandedBindingsOf` · `files/overrides.ts` `codeViewExpandedBindingProps`).

### Tests

- `adr301Expansion` +3 (`size` 단독 · `size` + `isOpen` · 읽는 자리 없는 prop 거절) · 원복 RED 2 · live 5174 17/17 (리뷰어 재현 시나리오 `bound-prop-insertion` 포함, 콘솔 0).

## [코드 보기가 Popover · Dialog · Menu · Tabs 를 레퍼런스 모양으로 펼친다 — ADR-301 Phase 0 ~ 4 · Implemented] - 2026-11-08

### Changed

- **코드 패널이 trigger 조립형 · 구조형 Library instance 를 RAC 레퍼런스의 사용 코드 모양으로 쓴다** (ADR-301):
  - Popover · Dialog · Tooltip · Menu · Sheet · PreviewTrigger 는 `<DialogTrigger><Button className="button" /><Popover className="popover"><OverlayArrow …/><div className="frame">…` — trigger 와 본체가 page 코드에 같이 있다. Tabs · Table · CardView 안 Card 는 `<Tabs><TabList>…` · `<Table><TableHeader>…` · `<Card><CardPreview>…<Content>…<Footer>`. Select · ComboBox · TagGroup · ActionBar 같은 필드 래퍼는 지금처럼 요소 하나.
  - 안쪽 요소의 값은 instance 가 작성한 것만 쓴다 (Library 기본값은 `node_modules/@composition/library/<Name>.tsx` 에). 자리를 고치면 그 값을 만든 층에 쓴다 — 자리 patch, 그 자리만 읽는 instance prop (`size`), 없으면 새 patch. Design 패널의 같은 편집과 문서가 같다.
  - `{false && <X/>}` 로 감싸거나 요소를 통째 지우면 그 자리를 숨긴다 (Library 원본의 자리는 없앨 수 없다). 자리 밖 요소 추가 · type 변경 · 자리 이동은 거절되고, 거절 보고의 「Unlock to edit <Name>」 이 원본을 프로젝트 컴포넌트로 만든다.
  - 닫힌 overlay 의 본체는 편집기에서 접힌 채 열린다 — Properties 의 Open 을 켜면 펼쳐진다 (Canvas 와 같은 판정).
  - **Why**: 사용자 원칙 「code view 로 했을 때 그 (레퍼런스) 형태가 그대로 나와야」 — 접힌 `<Popover>` + `<Slot name="content">` 는 trigger · 본체를 `node_modules` 안에 숨겼다.
  - 위치: `packages/shared/src/codeView/generate.ts` (`expandedRootOf` · `writePosition`) · `files/overrides.ts` (`codeViewExpandedRoot` · `codeViewPositionUnit`) · `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts` (`planPosition` · `removedPosition`) · `panels/codeView/CodeEditor.tsx` (`folds`)

### Removed

- 코드 패널 Files 목록의 `node_modules/@composition/catalog/<Type>.css` (편집할 수 없는 생성 시트 — 값은 Design 패널).

### Fixed

- **Unlock 한 Library 원본의 Local 파일을 코드로 고치면 어떤 편집이든 className 줄에서 거절됐다** (ADR-296 결함, 301 G2 에서 발견): 편집 해석이 원본 정의를 읽지 못해 노드 class 표가 비었다. 생성기와 같은 reader 를 쓴다 (`codeViewApply.ts`).

### Tests

- `adr301Expansion` 17 (레퍼런스 구조 동치 · 나머지 불변 · 팔레트 68 × 2 strict 왕복 · 컴포넌트 파일 · 자기 자식이 있는 instance) · `adr301Positions` 18 · `adr301Folds` 12 · 원복 RED 6 · live 5174 16/16 · 번들 Builder +231 B · Preview +1 B (hash).

## [선택한 quiet Card 의 미리보기 그림자가 Canvas 에도 — ADR-303 구현 판독 round 3 m1] - 2026-11-08

### Fixed

- **quiet Card 를 선택 · hover 하면 CardPreview 그림자가 Preview 에만 보이고 Canvas 에는 없었다** (ADR-303 round 3 m1):
  - **Why**: 그림자 값은 Card rule 의 `partStateStyles["&% .react-aria-CardPreview"]` (S2 quiet Card 는 루트가 아니라 미리보기에 `elevated`) 에 있고, 생성 CSS 만 그것을 자손 규칙으로 읽었다. Canvas 는 노드 자신의 상태 그림자만 읽었다.
  - 수정: Canvas 가 같은 트리를 owner (Card) 의 variant · 선택 · 상태로 평가해 CardPreview 에 그리고, Card 를 편집하면 미리보기를 다시 그린다 (미리보기 record 는 그대로라 따로 연결). 작성한 그림자는 그대로 이긴다.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` (`ownerPartShadow` · `withStateBoxShadow`) · `packages/shared/src/catalog/runtime/rulePaint.ts` (`catalogOwnerPartShadowTree`)

### Tests

- `adr303PartShadowParity.browser.test.ts` — 실제 노드 트리를 Canvas · DOM 로 그려 그림자 층 수 대조 (primary 대조군 · quiet 선택 · 해제 · 재선택 · primary 전환 × light · dark = 16).

## [자식이 컨테이너 배경을 따른다 — ADR-303 Phase 2 · 3 · Implemented] - 2026-11-08

### Changed

- **Nav · Breadcrumb(s) · DropZone · Menu · ListBox 의 배경 = 가장 가까운 컨테이너의 층** (ADR-303 Phase 2, 사용자 결정 4 a):
  - layer-1 Card · layer-1/2 Fill 의 Frame · Popover 안에 두면 그 바탕 층과 같은 면이 된다 (전에는 늘 `base` — dark 에서 `#111` 조각이 떠 보였다). 바깥에 두면 지금처럼 `base`.
  - 컨테이너 = 작성한 칠의 맨 위 층이 층 토큰 (base · layer-1 · layer-2 · elevated · pasteboard) 이거나, 칠이 없고 rule 휴지 배경이 층 토큰인 노드. 임의 hex · 그라데이션 · 투명은 컨테이너가 아니다 (위 층을 그대로 물려준다).
  - Group 배경 `base` → 투명 (RAC Group 은 칠하지 않는데 base 로 적혀 있어 안을 끊었다).
  - **Why**: S2 는 자식이 `--s2-container-bg` 를 상속하는데 rule 은 `{color.base}` 고정이라, 층 배정 (Phase 1) 뒤에도 컨테이너 안 목록 · 탐색이 바탕과 다른 색이었다.
  - 구현: 판정 함수 하나 `packages/shared/src/catalog/runtime/containerLayer.ts` — Canvas 는 파생 `_containerLayer` (`presence.ts` → `resolveCatalogPaint.ts`), DOM 은 컨테이너 노드 inline `--container-bg` (`domBinding.runtime.ts`) 를 생성 CSS `var(--container-bg, var(--bg))` 가 상속 (`tokenResolver.ts`). 층 편집은 그 노드의 층이 바뀐 step 에만 안의 reader 를 다시 계획한다 (`compositionRoot.ts`).
  - 생성 CSS 6 (Breadcrumb · Breadcrumbs · DropZone · ListBox · Menu · Nav)

### Performance

- ADR-201 Preview initial JS 상한 325,000 → 327,000 B 재승인 (사용자, 만료 2026-11-25 — 302 가 여유를 썼다). 이 ADR 전체의 Δ: Preview +35 B · Builder +589 B.

### Tests

- `adr303ContainerParity.browser.test.ts` (G2) — 실제 노드 트리를 Canvas · DOM 로 그려 기대 층 hex 와 대조 (Frame 층 · 중첩 · hex 통과 · Card · 투명 Group · 층 편집 · 이동 × light · dark = 60). `containerLayer.test.ts` 6. 대비 · 토큰 게이트 (`adr302*` · `adr290AccentRoles` · `catalogTokenExists`) 는 `container` 를 층 4 로 펼쳐 검사.

## [컨테이너 · 떠 있는 요소의 층 · 그림자를 S2 로 — ADR-303 Phase 0 · 1] - 2026-11-08

### Changed

- **Card · Popover · Modal · Sheet · Dialog · Tooltip · Table 의 배경 층과 그림자 = 설치 S2 1.8.2** (ADR-303 Phase 1, 사용자 결정 1a · 2a · 5a):
  - Card — primary `elevated` · secondary `layer-1` 배경 고정, 그림자 `emphasized` → hover · focus · selected `elevated` (hover 를 배경 단 대신 그림자로). tertiary 는 테두리 `gray-100` → hover · focus `gray-200`, quiet 는 루트 그림자 없이 미리보기 (CardPreview) 에만 그림자.
  - Modal · Sheet · Dialog — 배경 `layer-2` (light 흰색 · dark `#222`), 상시 `dragged` 그림자 삭제 (열린 Modal 은 바탕 막이 분리한다 — S2 Modal 과 같음).
  - Tooltip 그림자 삭제 (S2 Tooltip 에 없음) · Popover accent · neutral 변형 배경 `base` → `layer-2` (dark `#111` → `#222`) · Table 배경의 hover · pressed 단 삭제 (행 상태는 Row 의 몫).
  - Canvas 도 상태 그림자를 variant 조건까지 같이 읽는다 (`catalogStateBoxShadow`) — Builder 와 Preview 가 같은 값 (live 5174 light · dark).
  - **Why**: 층 토큰 (ADR-302) 은 Spectrum 값이 됐지만 어느 컴포넌트가 어느 층 · 그림자를 쓰는지는 옛 값이었다 (Modal 의 끌기 그림자 · Card 그림자 없음 · Tooltip 그림자).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/catalog/runtime/rulePaint.ts` · 생성 CSS 6 (Card · Dialog · Modal · Popover · Sheet · Tooltip)

### Tests

- `adr303S2Layering.static.test.ts` (G1 7) — oracle 은 설치 S2 소스에서 뽑은 `adr303-s2-layering.json` (생성기 `apps/builder/scripts/adr303-s2-layering-extract.mjs`, `--check`). ADR-166 의 「Tooltip < Popover < Modal 서열」 테스트는 S2 배정으로 바꿨다.

## [Badge 글자 대비 회귀 수리 — S2 Badge 칠로 정렬 (ADR-302 후속)] - 2026-11-08

### Fixed

- **Badge subtle · outline 글자가 색 면 위에서 4.5:1 을 못 맞추던 회귀** (codex round 4 h1): Spectrum 값으로 바뀐 뒤 hue 글자 × hue subtle 면 조합이 미달했다 (기본 테마 indigo subtle 6.57 → 4.15, dark turquoise 3.11).
  - S2 `Badge.tsx` 그대로 — subtle · outline 글자 = `gray-1000` (light 검정 · dark 흰색, 새 tone 역할 `{color.gray-1000}` → `--gray-1000`), subtle 면 = 자기 family (gray · seafoam · brown · cinnamon · silver), silver bold 글자 흰색, hover · pressed 칠 없음 (S2 Badge 는 상태가 없다).
  - 결과: Badge 32 조합 × light · dark 최소 대비 4.51, subtle · outline ≥ 7 — Canvas · Preview 같은 값 (live 5174). G3 부채 표 34 → 1 (InlineAlert neutral bold — S2 자신의 값).
  - 생성 CSS 의 남은 `color-mix` 폴백 4 파일 (Code · DateInput · GridListItem · Kbd) 도 재생성으로 정리 — Phase 3 이 변환표를 고친 뒤 생성을 다시 돌리지 않았다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Badge) · `packages/rendering/src/primitives/colorAliases.ts` · `packages/rendering/src/renderers/utils/tokenResolver.ts`

## [Preview 색도 Canvas 와 같은 사다리 — ADR-302 Phase 3 · Implemented] - 2026-11-08

### Changed

- **Preview · Publish 의 색 둘째 파생 삭제 — 테마 색은 resolver 값 하나** (ADR-302 Phase 3):
  - hover · pressed 변수의 `color-mix(… 85% · 75%, black)` 폴백, Preview CSS 의 `--tint` oklch 상대색 사다리 · chart accent 식, resolver 의 `--tint` · `--color-neutral-N` (Tone 의 Tailwind 단) 덮기를 지웠다.
  - 두 축 사다리를 DOM 변수 `--tint-100 ~ 1600` (accent) · `--tone-25 ~ 1000` (tone) 로 싣는다 — Canvas 역할 색과 같은 사다리, 비기본 tint · Tone 은 생성 사다리.
  - DOM 전용 색 (`--link` · `--fg-base` · `--fg-disabled` · `--bg-emphasis` · `--border-pressed` …) 이 그 단을 읽는다 — Tailwind neutral 단에서 Spectrum gray 단으로 (예: `--fg-disabled` `#737373` → `#c6c6c6`, `--fg-base` `#171717` → `#292929`). `--color-neutral-N` 팔레트는 이제 테마와 무관하다 (ADR-191).
  - **Why**: Canvas 는 alias 표 값, DOM 은 CSS 식으로 같은 이름의 색을 두 번 만들었다 (`--focus-ring` · `--link` · `--chart-accent-N`) — 하나가 바뀌어도 다른 쪽이 따라오지 않았다.
  - 위치: `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts` · `packages/shared/src/components/styles/theme/preview-system.css` · `packages/rendering/src/renderers/utils/tokenResolver.ts` · `packages/rendering/scripts/generate-theme-colors.ts` (`SPECTRUM_DEFAULT_LADDERS`)
- **Themes 패널 Tone 견본 · 미니 프리뷰** = 그 Tone 의 생성 사다리 (견본 500 단) — Tailwind 500 단 대신 역할 색과 같은 사다리.

### Removed

- `NEUTRAL_PALETTES` · `resolveNeutralSteps` · chart 의 `CHART_ACCENT_STEPS` · `CHART_ACCENT_DEFAULT_HEX` · `resolveChartPaletteColors` (사용처 0 — 값은 alias 표).

### Tests

- G2 `adr302TwoAxis` 조항 `2b` (DOM 둘째 파생 0) · `themeColorParity.browser` 가 `--tint-N` · `--tone-N` DOM 값 = snapshot 사다리를 50 preset × 2 mode 에서 대조 · `themeCssVarsCoverSkia` 사다리 변수 = 생성기 사다리. ADR-302 Implemented (G0 ~ G5 · live 6/6).

## [tint · Tone 을 바꿔도 Spectrum 대비 규칙 유지 — ADR-302 Phase 2] - 2026-11-08

### Changed

- **기본이 아닌 tint (10) · 사용자 accent hex · Tone (slate · gray · zinc · stone) 의 색 토큰을 Spectrum 사다리 모양으로 생성** (ADR-302 Phase 2):
  - 단마다 기준 사다리 (accent = Spectrum blue 16 단 · Tone = gray 13 단) 의 명도를 쓰고 hue 는 preset, chroma 는 Spectrum blue 사다리의 단별 모양을 따른다 — Tone slate 의 밝은 층이 더는 푸르게 뜨지 않는다. 대비가 모자라면 단을 옮기고, 그래도 안 되면 ±2 단 안에서 명도를 찾는다.
  - accent · Tone 은 따로 바뀐다 (tint blue + Tone slate 면 accent 는 Spectrum blue 그대로). hover · pressed 는 사다리의 다음 단.
  - **사용자 hex 는 색조만 쓴다** — 명도는 사다리가 정한다 (ADR-290 의 「대비를 통과하면 hex 그대로」 는 없어짐).
  - 생성기는 lazy chunk — 비기본 테마는 chunk 로드 뒤 Builder · Preview 가 테마를 다시 적용하고, Publish 는 첫 화면 전에 불러온다.
  - **Why**: 옛 경로 (Tailwind 단 매핑 · 명도 탐색 · 검정 섞기) 는 tint · Tone 에 따라 status 글자 · 층 순서가 무너졌다 (비기본 Tone 4 종 층 붕괴 40/40).
  - 위치: `packages/shared/src/catalog/runtime/ladderGenerate.ts` · `themeLadders.ts` · `resolveThemeSnapshot.ts` · `packages/rendering/src/primitives/colorAliases.ts` (`SEMANTIC_CSS_VARS`)

### Removed

- `semanticPaletteMap.ts` (Tailwind 좌표 표) · `solveAccentRoles` · `createAccentColorTokens` · `mixHexWithBlack` 파생 · Tone 의 Tailwind 단 매핑 (`LIGHT_MAP` · `DARK_MAP`).

### Tests

- **G2 `adr302TwoAxis.static.test.ts`** (catalog 색 참조 = alias 표 · 옛 심볼 0 · hover = pressed = 다음 단 · tone 단 범위 · 고정 hex 0) · **G3 `adr302HubRules.test.ts`** (57 preset × 2 mode 대비 · 층 순서 — 기본 preset 에서 Spectrum 값 자체가 미달인 40 항목은 부채 표로 고정) · `adr302ThemeLadders.test.ts` (lazy 로드 · 늦은 구독).

## [테마 기본 색 = Spectrum 토큰 값 — ADR-302 Phase 0 · 1] - 2026-11-08

### Changed

- **기본 테마 (tint blue · Tone neutral) 의 색 토큰 180 키가 Spectrum 토큰 데이터 값** (ADR-302 Phase 1):
  - 본문 글자 `#171717` → `#292929` (gray-800) · 테두리 `#d4d4d4` → `#dadada` (gray-300) · status 글자 Tailwind 500 대 → Spectrum 900 (light 대비 3.0 ~ 3.8 → 4.5 이상) · accent `#3660f0` → `#3b63fb` (blue-900) 등 — light · dark 모두 alias 표 (역할 → 사다리 단) × 설치된 `@adobe/spectrum-design-data` 사다리.
  - Badge · InlineAlert · Toast 의 status 면은 `{color.<status>-background}`, StatusLight · Meter 채움은 `{color.<status>-visual}` 로 (S2 소비 지점 그대로). Badge bold notice · orange · celery 글자는 검정 (S2).
  - **Why**: 값의 출처가 S2 손 hex · Tailwind 표 · resolver 탐색 셋으로 갈려 있었고, 같은 대비 식에서 Spectrum 값은 통과하지만 composition 은 status 글자 · `on-negative` 가 떨어졌다. 비기본 tint · Tone 의 사다리 생성은 Phase 2.
  - 위치: `packages/rendering/src/primitives/colorAliases.ts` (alias 표) · `generated/spectrumLadders.ts` · `generated/spectrumThemeColors.ts` (`pnpm -F @composition/rendering generate:theme-colors`) · `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts`

### Added

- **`{color.pasteboard}`** (light gray-100 · dark gray-25 — `--bg-pasteboard`) 와 status `-background` · `-visual` 8 키 (ADR-302 Phase 1).

### Removed

- **`{color.raised}`** (ADR-302 사용자 결정 3): rule 7 참조와 ColorThumb · Table 머리글 · Color 조작기 · Skeleton · ColorPicker · CollectionErrorState 의 `--bg-raised` 는 `layer-2` (`--bg-inset`) 로, Popover 화살표는 `--popover-background` 로. Builder chrome 의 `--bg-raised` 는 그대로.

### Tests

- **G1 `adr302SpectrumOracle.static.test.ts`** — 기본 preset 의 모든 역할 = design-data oracle (alias 대조 · resolver 출력 · 키 집합), 원복 RED 확인. oracle 생성기 `adr302-spectrum-color-extract.mjs --check` 가 fixture 와 사다리 모듈을 같이 대조.

## [Library Canvas 진입 오류 — Progress value white-space] - 2026-11-08

### Fixed

- ProgressBarValue · MeterValue의 `whiteSpace`를 Canvas 텍스트 shape와 DOM 값 요소에 전달한다. 줄바꿈 편집과 Undo에서도 두 소비자가 같은 값을 사용한다.
  - **Why**: 공용 `.value` 규칙의 `nowrap`을 Canvas가 미지원 스타일로 거부해 Library scene 전체가 멈췄다. Library 전체 light·dark Canvas 바인딩을 회귀 검사한다.

## [Library 탭 진입 오류 — Typography token classification] - 2026-11-08

### Fixed

- Navigator → Components → Library의 Typography 샘플은 선언된 글자 크기 단계만 생성하고 현재 테마의 크기 값을 사용한다.
  - **Why**: 테마 적용으로 추가된 `sans` 글꼴 문자열까지 글자 크기로 변환해 `STYLE_VALUE_UNSUPPORTED: fontSize = NaN` 오류가 발생했다. 첫 생성·재진입·baseline 조회 회귀를 추가했다.

## [ToggleButtonGroup Justified · 긴 Label] - 2026-11-08

### Fixed

- ToggleButton · ActionButton의 Label에 S2 기본 한 줄 말줄임과 크기별 최소 폭을 적용한다. Justified에서 긴 Label이 여러 줄로 늘어나던 높이를 유지하며, ToggleButtonGroup 내부 콘텐츠 래퍼의 최소 폭도 Canvas · Preview가 같은 catalog 규칙으로 읽는다. 작성한 Text 스타일과 Undo를 보존한다.

## [SelectBox 구조 · 배치 · 글자 — S2 SelectBox] - 2026-11-08

### Changed

- SelectBox 원본이 S2 처럼 Checkbox · Icon · Text (label) · Text (description) 를 직접 담는다 — label · description 을 감싸던 frame 을 없앴다 (ListBoxItem 과 같은 구조).
- 가로형 SelectBox 가 S2 grid 다 (`min-content 10px 1fr` · 행 `23 2 23`): 그림이 첫 열에서 두 행에 걸치고, label (굵게 · 시작 정렬) 과 description 이 마지막 열에서 각 행 가운데. 세로형 label 은 가운데, 가로형은 시작 정렬 — rule 의 방향 블록이 정하고 Canvas 는 SelectBoxGroup 의 part rule (`via: SelectBox`) 로 같은 값을 읽는다.
  - 행 최소 23 = (48 − 2) / 2: S2 행은 `min-content` 이지만, 두 행에 걸친 48 그림의 높이를 Canvas 엔진이 행에 나누지 않아 브라우저가 내는 값을 적었다.

### Fixed

- SelectBox 의 label · description 글자가 S2 `font: ui` (14 / 18) 다. 종전에는 Text rule 기본값 16 / 20 이었다 (Canvas · Preview 공통 — Tab · Tag 와 같은 `itemLabelFontParts` · 생성 CSS `inherit`).

## [컬렉션 항목 복제 · 붙여넣기 key 중복 — Duplicate key] - 2026-11-08

### Fixed

- 컬렉션 항목 (SelectBox · Tab · Tag · ListBoxItem · GridListItem · MenuItem · Breadcrumb · TreeItem) 을 복제 · 붙여넣기 하면, 들어가는 컬렉션에 이미 있는 key (`id`) 는 새 key 를 받는다. 그룹 전체처럼 컬렉션 밖으로 복사한 항목은 key 를 그대로 둔다.
  - **Why**: `duplicateNodes` · `pasteNodes` 가 `id` 를 그대로 복사해 같은 그룹에 key 가 겹쳤고, RAC 가 `Duplicate key "two" found in collection` 을 던져 Preview 전체가 멈췄다.
  - 위치: `packages/shared/src/catalog/commands/collections.ts` `catalogCopiesWithFreshKeys`

## [SelectBoxGroup S2 grid · 상자 그림자] - 2026-11-08

### Fixed

- SelectBoxGroup 이 S2 처럼 같은 폭 열의 grid 로 상자를 가운데 정렬한다 (세로 144 ~ 170 · 가로 188 ~ 368, `auto-fit`). 종전에는 flex wrap 이었다. Group 의 orientation 이 ListBox 에 전달된다 (`data-orientation` · grid 키보드 이동).
- Canvas 가 rule 의 상태별 그림자 (`stateStyles.boxShadow`) 를 그린다 — SelectBox 는 평소 emphasized, hover · 선택 elevated, 비활성 없음. 종전에는 Canvas 가 고정 그림자 (`containerStyles.boxShadow`) 만 읽어 SelectBox 그림자가 Canvas 에서 빠졌다.

## [SelectBox 그림 크기 48] - 2026-11-07

### Fixed

- SelectBox 의 illustration Icon 이 S2 Illustration S 크기 (48) 로 그려진다. 원본이 상자 (Width · Height 48) 만 정해 그림은 Icon 기본 M (18) 에 머물렀다 — 원본의 그림 크기를 48 로 두고 상자는 그것을 따른다 (Canvas · Preview 공통).

## [Icon 크기 단일화 — Layout 크기 · Font Size · Size 숫자] - 2026-11-07

### Fixed

- Icon · Illustration 의 Layout Width · Height (px) 가 그림 크기를 정한다 — 그림이 상자 (작은 축, padding · border 제외) 를 채우고, 한 축만 넣으면 정사각 상자가 된다. 종전에는 상자만 커지고 그림은 Size 단계 크기에 머물렀다 (Canvas · Preview 공통).

### Changed

- Icon · Illustration 의 크기를 한 값으로 보인다: Text 탭 Font Size · Layout Width · Height · Property Size 행이 실제로 그려진 크기를 표시한다. Size 행의 리셋 버튼 자리는 px 숫자 입력 (28 × 28) 이다.
- 마지막 편집이 이긴다: 숫자 입력 · Text Font Size 는 그 크기로 바꾸며 작성한 Width · Height 를 지우고, Size 단계 (XS–XL) 를 고르면 Font Size 와 Width · Height 를 지운다. Tablet · Mobile 에서의 편집은 그 화면 층에만 쓴다.

## [SegmentedControl 긴 텍스트 줄임] - 2026-11-08

### Fixed

- S2의 Text truncate 기본값을 SegmentedControlItem의 공용 자식 규칙에 연결한다. 제한된 폭에서 Canvas·Preview 모두 말줄임하며, 작성한 텍스트 스타일과 Undo를 우선한다.
- Canvas는 레이아웃의 캐시된 정확한 측정 폭으로 실제 넘침을 판정해 짧은 라벨의 잘못된 말줄임을 방지한다. 문단 캐시도 같은 판정을 사용한다.

## [SegmentedControl 모서리와 Justified 정합성] - 2026-11-08

### Fixed

- SegmentedControl의 기본 모서리를 공용 크기 규칙에서 읽어 Canvas와 Preview에 동일하게 적용한다. 사용자 모서리 편집과 기본값 복원을 지원한다.
- Preview 래퍼에 isJustified를 전달하고, 그룹 항목의 flex basis가 Hug에서 콘텐츠 폭을 유지하도록 공통 레이아웃 입력을 정렬한다. 고정 폭·방향 변경과 Undo/Redo·저장 재로드도 같은 항목 배치를 사용한다.

## [SelectBoxGroup 방향 Property 번역 정렬] - 2026-11-07

### Fixed

- SelectBoxGroup의 방향 표시명을 공용 Orientation 라벨에 연결해 Language 설정에 따라 영어 Orientation·한국어 방향으로 표시한다.

## [모든 컴포넌트의 RAC slot Property 정리] - 2026-11-07

### Fixed

- 공통 Property의 RAC slot 선택창을 일반 컴포넌트와 부모 텍스트에 연결된 자식에서 제거하고, Sheet의 일반 slot 필드도 숨긴다. 작성된 역할 이름·기본 context 상속·명시 해제·Code 왕복은 보존하며, Items·Actions 등 자식 추가용 Slot은 계속 제공한다.

## [항목 Slot 전수 점검과 SegmentedControl S2 기본 시각 정렬] - 2026-11-07

### Fixed

- SelectBoxGroup의 Items, Pagination의 Buttons, ColorSwatchPicker의 Swatches, ActionBar 내부 액션 그룹의 Actions Slot을 선언한다. SelectBoxGroup의 컬렉션 추가와 ActionButtonGroup·ActionBar의 그룹 추가를 공통 명령에 연결하고, Checkbox·Radio·ActionBar의 내부 Slot 선택창도 같은 그룹 항목 목록을 사용한다.
- SegmentedControlItem의 HTML ID와 RAC 선택 key를 분리해 Slot 소유 항목의 초기 선택 표시를 복구한다. S2 1.8.2의 루트 배경, 선택·disabled 색상과 테두리, 고정 control 높이, regular 글자, locale 행간과 focus-visible 표시를 공용 catalog에서 정렬한다. 사용자 행간·테두리 편집을 우선하며 그룹 disabled 변경과 Undo에도 갱신한다.

## [SegmentedControl 항목 추가 Slot 복구] - 2026-11-07

### Fixed

- SegmentedControl에 Items Slot과 SegmentedControlItem 추가 계약을 등록한다. ToggleButtonGroup과 같은 Property의 Slot 선택창에서 항목을 추가하고, 공통 명령으로 Undo/Redo·기본 내용 복원·저장 재로드를 처리한다.

## [Avatar 크기 API와 S2 잔여 선택지 정렬] - 2026-11-07

### Fixed

- Avatar의 기본 크기를 숫자 24로 정렬하고 S2 숫자 프리셋·임의 숫자·`lh` 값을 Property, Code, 저장 문서와 Canvas·Preview에 연결한다. 기존 이름 크기의 저장 값과 지름은 보존하며, `lh`는 상속 typography 변경에도 다시 계산한다. AvatarGroup은 7개 숫자 크기와 크기별 겹침·레이블 typography를 제공한다.
- Accordion의 다중 확장 기본값을 false로 정렬하고 Accordion·Disclosure의 XL, CardView의 XS·XL을 자식 크기 상속과 기본 스타일에 연결한다. Disclosure XL은 S2 밀도별 높이와 제목 typography를 사용한다.
- Card의 링크 Target에 Parent Frame·Top Frame을 추가하고 Popover의 22개 Placement를 Property에서 선택·저장·복원할 수 있게 한다.

## [기존 컴포넌트 상속·Slot·Property 공통 계약 보완] - 2026-11-07

### Fixed

- TextArea의 상위 disabled·readOnly·required 수신과 13개 필드의 Canvas 필수 표시를 공통 상속 계산에 연결한다. Form의 크기는 버튼·입력·선택 계열의 기본값보다 먼저 적용하고, ToggleButton도 Form 강조를 받는다.
- RAC·S2 Slot 소비 타입과 실제 context를 공용 계약에서 관리한다. 문서의 Slot 편집·명시 해제·Code 왕복을 연결하고, Menu·Dialog·Popover·Sheet 원본은 내부 controller에 값을 전달한다. Sheet의 Slot은 DOM 전달 속성으로 노출한다.
- S2 전용 leaf와 그룹은 실제 Slot context를 소비하며 기본값·사용자 지정값·ref·이벤트를 병합한다. Card 원본에 Disabled를 노출하고 LinkButton에서 Link 전용 Quiet·Standalone을 제거한다.

## [신규 S2 컴포넌트 조립·상속 — 공통 RAC 패턴 정렬] - 2026-11-07

### Fixed

- SelectBox 내부 Text의 label·description과 ActionBar의 clear Button이 실제 부모 제공자를 공통 Slot 패널에서 선택하도록 연결한다. 부모 텍스트에 연결된 실제 Text 자식에도 Slot 편집을 제공하고, ActionButton의 Slot 해제 명령·Undo/Redo를 문서 계약에서 지원한다. Link·LinkButton, Slider·RangeSlider와 ActionBar의 부모 slot은 명시 해제·Code 왕복·실제 context 소비까지 연결한다.
- LinkButton·RangeSlider·SelectBoxGroup/SelectBox의 상위 disabled와 RangeSlider·LabeledValue의 Form 배치를 공통 수신 계약에 등록한다. RangeSlider의 초기 범위와 SelectBoxGroup의 선택 모드는 부모 context를 반영한 뒤 기본값을 적용한다.
- Link·LinkButton의 ARIA·탐색 속성과 LinkButton의 autoFocus를 Preview·Publish로 전달한다. hrefLang은 RAC의 native render 경로에서 보완하며 Code도 같은 공용 Link를 사용한다.
- LabeledValue 공개 기본 Text가 catalog 크기·줄 높이를 상속하도록 기본 CSS를 생성한다. 직접 편집한 자식 typography가 우선한다.

## [SegmentedControl 그룹 상속 — RAC context 정합성] - 2026-11-07

### Fixed

- SegmentedControl의 자동 선택을 RAC가 해석한 그룹 상태에서 시작해 부모 slot의 초기·controlled 선택을 보존하고, 마운트 시 불필요한 변경 이벤트를 막는다. 접근성 이름과 방향도 부모 context를 먼저 확인하며, 함수형 children과 실제 항목·내용 Frame 조립을 유지한다.
- body·Frame의 disabled가 SegmentedControl과 항목의 Canvas·Preview·Interactions에 함께 적용되도록 공통 수신 계약을 등록한다. Slot 패널의 공통 노출·연결·해제 규칙은 유지한다.

## [ActionBar 자식 배치·icon-only 버튼 기하 정합성] - 2026-11-07

### Fixed

- ActionBar clear 버튼의 Canvas 폭이 Preview보다 작아 count가 약 8.16px 앞에 놓이던 문제를 수정한다. icon-only의 padding·정사각형 비율을 공통 상자 모델에 전달하고, 엔진이 intrinsic 폭에 최소 높이의 aspect ratio 전송을 반영한다. 실제 지정한 크기·padding은 유지하며, 확정된 폭으로 자식을 다시 배치한다.

## [SelectBox 속성·공개 API 계약 보강] - 2026-11-07

### Fixed

- SelectBoxGroup의 선택·초기 선택·비활성 키, focus 정책, Escape 동작, ARIA 참조와 공통 RAC Slot 편집을 연결한다. `selectedKeys="all"`과 `autoFocus="first" | "last"`는 문서·상태 변수·Code에서 원래 타입을 유지한다.
- Code에서 인접 변수의 기본값을 함께 편집할 때 기존 변수 ID와 컴포넌트 연결을 유지한다. native 선택·focus 타입은 페이지와 프로젝트 변수 파일의 생성·역편집에서도 보존한다.
- SelectBox의 접근성 이름과 그룹·항목의 비활성 상태를 함께 반영한다. 공개 SelectBoxGroup의 동적 items·함수형 children·숫자 ID를 복구하고, Code View는 실제 존재하는 Composition 공개 컴포넌트를 import한다.

## [SegmentedControl 선택 전환·입력 계약 보강] - 2026-11-07

### Fixed

- SegmentedControl의 선택 표시가 즉시 바뀌던 문제를 수정한다. catalog 정본에서 RAC 공유 요소의 위치·폭을 S2와 같은 200ms로 전환하고, 모션 감소 환경에서는 실제 indicator 자식의 전환을 끈다.
- SegmentedControl의 orientation·초기 선택·ARIA 참조와 Item의 autoFocus를 노출하고, slot은 Button·Text와 같은 공통 RAC Slot 선택·연결·해제 경로로 처리한다. 누를 때 실제 내용 Frame만 S2의 크기 기반 비율로 줄이고, 선택 배경은 유지한다. Canvas·Preview 모두 같은 Frame과 텍스트 상속을 사용한다.

### Breaking Changes

- 라이브러리 계약을 63으로 올린다. SegmentedControlItem에 편집 가능한 내용 Frame이 추가되며, 이전 개발 문서는 자동 변환하지 않는다.

## [기본 서체 Pretendard — Canvas·DOM 대체 서체 통일] - 2026-11-07

### Changed

- Theme 기본 서체를 Adobe Clean Spectrum 에서 Pretendard 로 바꾼다. Canvas 는 OS 글꼴을 쓸 수 없어 한글이 있는 서체가 기본이어야 한다. Adobe Clean Spectrum 은 서체 목록에서 계속 고를 수 있고, 일본어·중국어의 언어별 기본 서체는 유지한다.
- 고른 서체에 없는 글자는 Canvas 와 CSS 모두 Pretendard 로 대체한다. Inter 같은 영문 전용 서체에 한글을 써도 두 화면이 같고, OS 에 따라 달라지지 않는다.

### Fixed

- Publish 가 Pretendard 를 불러오도록 연결한다. 쓰는 굵기의 글꼴 파일만 내려받는다.

## [Canvas placeholder 글꼴 — 문서 서체 상속] - 2026-11-07

### Fixed

- Input·Select·날짜 조각처럼 rule 이 그리는 글자가 Canvas 에서 코드 기본 서체로 고정되던 문제를 고친다. 이제 Theme 서체와 locale 서체를 DOM 처럼 상속하며, 한글 placeholder 가 Canvas 에서 ☒ 로 나오지 않는다.
- Input 글자 굵기를 `sizes.fontWeight` 400 으로 명시해 Canvas 의 500 폴백과 DOM 400 의 폭 차이를 없앤다.
- 날짜 조각의 폭 측정에 실제 서체를 쓰고, 조각 글자를 locale 서체 요청에 포함한다.

## [S2 독립 컴포넌트 보강 — 4단계] - 2026-11-07

### Breaking Changes

- 라이브러리 계약을 62로 올린다. 새 원본과 구조화된 값 계약을 사용하며, 기존 계약의 개발 문서는 자동 변환하지 않는다.

### Added

- S2 1.8.2의 독립 누락 항목 ActionBar·LinkButton·LabeledValue·RangeSlider·SegmentedControl·SelectBoxGroup과 실제 항목 자식을 catalog·팔레트·Property·Interactions·Code 생성 경로에 연결한다.
- 범위 값은 `{start, end}`, 선택 수는 숫자 또는 `"all"`로 보존하며 전용 편집·검증 경로를 제공한다. LinkButton은 Button의 시각 정본을 공유하고, 생성 코드는 실행 가능한 공용 컴포넌트를 참조한다.
- 새 컴포넌트와 항목의 생성 CSS를 Preview/Publish 및 Builder 번들에 함께 포함한다.
- LabeledValue의 intrinsic 폭과 SelectBox의 variant paint를 공통 Layout·시각 계약으로 연결하고, 접힌 Code의 기본 자식 구성도 catalog 원본을 공유한다.

## [입력 필드 값 편집 — TextArea·ColorField owner 연결] - 2026-11-07

### Fixed

- TextArea·ColorField의 Value 속성을 노출하고, 빈 값에서도 Canvas Input 편집이 실제 필드 owner의 `value`를 갱신하도록 연결한다. DOM과 Canvas가 동일한 가장 가까운 필드 owner를 해석하며, 자식에 독립적인 값 override를 남기지 않는다.
- TextArea 값의 개행 편집은 필드 값으로 보존한다. 일반 텍스트의 개행 표시를 위한 `white-space` 자동 변경을 Input에 적용해 렌더가 실패하던 편집 경로를 수정한다.
- TextArea Input의 기본 `pre-wrap`을 공용 부품 규칙에 기록하고 Canvas paint까지 전달해 저장한 개행을 여러 줄로 표시한다.

## [Collection 전체 선택 — RAC sentinel 보존] - 2026-11-07

### Fixed

- Preview의 ListBox·GridList·Tree에서 전체 선택 값 `"all"`을 배열로 취급해 렌더가 중단되는 경로를 수정한다. RAC 선택 값의 형을 보존하고, 재마운트 key는 sentinel과 실제 항목 키 배열을 구분한다.

## [Preview 글자 smoothing — Publish reset 정렬] - 2026-11-07

### Fixed

- Preview iframe에서 빠져 있던 `-webkit-font-smoothing: antialiased`를 실제 Publish와 동일하게 적용한다. macOS에서 같은 Label의 글자 획 농도가 달라지는 원인을 수정했으며, Canvas는 Skia 직접 렌더를 유지한다.
- Preview reset과 실제 Publish stylesheet의 상속 결과를 Chromium 회귀 검사로 대조한다. 이 수정만으로 Canvas↔Preview의 남은 raster 차이가 모두 해결됐다고 판정하지 않는다.

## [Label baseline 측정과 Canvas 전달] - 2026-11-07

### Fixed

- Label의 inline baseline을 서체별 고정 offset이나 줄 높이 비율로 추정하지 않고, 같은 typography의 실제 CSS 줄 상자를 화면 밖에서 측정한다. 결과를 서체 세대·굵기·크기·스타일·줄 높이·locale·DPR별로 캐시하며, 화면 콘텐츠는 계속 Skia가 직접 그린다.
- Rust가 확정한 fragment baseline과 실제 폭을 Canvas paint에 전달한다. 이 경로는 종전의 일반 텍스트용 ±1px 보정 제한과 100,000px 폭 입력에 의존하지 않는다. native 메트릭을 제공하지 않는 측정기는 자신의 첫 baseline을 우선하고, 그마저 없으면 기존 하단 기준 계약을 사용한다.
- TextField의 같은 조건 비교에서 차이 픽셀이 2,475에서 1,254로 줄었으나 기존 전체 Label 픽셀 검사는 여전히 실패한다. S2 기본 시각의 전체 완료나 모든 환경의 픽셀 일치를 선언하지 않는다.

## [여러 줄 Label — Rust inline fragment 배치] - 2026-11-06

### Fixed

- **여러 줄 본문 마지막 줄에 필수 표시 배치**
  - 위치: `packages/engine/src/inline.rs`, catalog Label rule, Builder `canvasBinding.ts`.
  - 실제 Text·NBSP·Icon 자식의 identity를 유지하고 Rust가 자식 경계에 걸친 줄바꿈과 fragment를 배치한다. DOM은 같은 inline 기본값을 읽으며 Canvas는 확정된 fragment만 그린다.
  - grid intrinsic 측정에서 fragment를 보존하고 inline solve의 dirty 플래그를 해제하여 이후 필수 표시·본문 편집이 조상까지 전파되게 했다. Canvas의 기존 rule-text 중앙 정렬이 줄 조각을 다시 늘리던 문제도 수정했다.
- **텍스트 측정 언어와 편집 상자 보존**
  - Canvas 2D 측정·줄바꿈 캐시·paint baseline에 locale을 전달하고 CSS generic fallback을 보존했다. 언어 전환 시 하위 segment cache가 이전 언어의 폭을 재사용하던 결함도 수정했다. 실제 자식의 편집 상자는 전체 텍스트·줄바꿈 폭을 유지하며 paint 조각의 100,000px 비줄바꿈 측정 폭을 읽지 않는다.
  - 배치·편집 통과와 별개로 실제 glyph raster 불일치는 남아 있다. 전체 S2 기본 시각 또는 Publish 완료를 주장하지 않는다.

## [헤더 저장 상태 아이콘] - 2026-11-06

### Changed

- 헤더의 저장 상태를 글자에서 구름 아이콘과 우측 상단 dot으로 바꿨다. 저장됨은 dot이 없고, 저장 대기·저장 중은 500ms가 지나도 끝나지 않을 때만 dot을 보이며, 실패는 빨강, 다른 탭 충돌·저장 불가 형식은 주황으로 표시한다. 저장이 멈춘 세 상태는 아이콘도 `CloudOff`로 바뀐다.
- 상태 설명은 tooltip과 `aria-label`로, 스크린리더 안내는 버튼 밖 live region으로 옮겼다. 누를 수 없는 상태도 tooltip이 뜨도록 disabled를 쓰지 않으며, 실패 상태만 눌러서 다시 시도한다.

## [CJK Label 줄 높이와 실제 서체 메트릭] - 2026-11-06

### Fixed

- 공용 Label의 한국어·일본어·중국어 기본 줄 높이를 S2 1.8.2의 단위 없는 `1.5`로 정렬했다. M 크기의 한국어 Label은 18px에서 21px로 바뀌며 Canvas·Preview·Publish의 catalog runtime이 같은 값을 읽는다. Label·자식·Library의 명시 스타일과 Theme의 줄 높이 토큰이 우선하고, Reset·Undo/Redo·언어 변경을 반영한다.
- Theme snapshot에 `explicitTypography`를 보존해 seed와 같은 명시 값도 locale 기본값보다 우선한다. Typeface 저장소를 내부 FontMgr 별칭으로 조회해 다른 서체의 ascent/descent를 쓰던 경로를 등록 family·굵기 조회로 수정했다.
- Design의 자식 Text typography 표시와 줄 높이 px 환산도 부모가 전달한 실효값을 사용한다. 실제 14px/21px인 Label 본문에 16px/20px를 표시하고, 28px 편집을 24.5px로 적용할 수 있던 경로를 수정했다.
- 13개 필드의 S/M/L/XL 기본값, 사용자·Library·Theme 편집과 복원을 검증했다. 여러 줄 마지막 줄의 필수 표시 배치와 글리프 raster 차이는 여전히 미완료이며 전체 S2 시각 정렬 완료로 판정하지 않는다.

## [필수 표시 문구의 줄바꿈과 편집 기본값] - 2026-11-06

### Fixed

- 좁은 입력 필드에서 필수/선택 문구가 여러 줄로 갈라지던 문제를 수정했다. 공용 Label의 `necessity-label` 자식에 S2의 `white-space: nowrap`과 축소 방지를 선언하고, typed part rule이 같은 값을 Canvas와 DOM에 전달한다. 사용자의 명시적인 줄바꿈·폭 편집이 우선하며 Reset하면 기본값으로 복원된다.
- 13개 필드의 실제 Builder 자식 편집 검증 하니스와 좁은 폭 회귀를 추가했다. 본문 마지막 줄에 표시를 붙이는 inline 배치와 CJK 기본 줄 높이 차이는 여전히 미완료다. 이 변경을 전체 S2 시각 정렬 완료로 판정하지 않는다.

## [폰트 선택창 공용화 — Theme에서 등록·관리] - 2026-11-06

### Fixed

- **Theme·Design 폰트 목록 불일치**:
  - **Why:** Theme은 고정 목록, Design은 사용자 레지스트리를 사용하는 별도 선택창이라 등록한 폰트를 Theme에서 고를 수 없었다.
  - 두 패널이 `FontFamilyPicker`와 기본·사용자 폰트 목록을 공유한다. 폰트 추가·관리 진입점은 Theme에만 두고, 등록만으로 기본 서체나 개별 선택을 바꾸지 않는다.
  - Theme의 Font legend를 유지하고 긴 폰트명은 한 줄 말줄임으로 표시한다. 트리거의 전체 서체 값은 tooltip에서 확인할 수 있다.
  - Theme의 기본값은 공통 기본 서체로, Design의 기본값은 테마 상속으로 복원한다. 기존 fallback 체인과 목록에 없는 현재 서체도 표시하며 열기만으로 저장값을 바꾸지 않는다.
  - 기본 sans seed가 Theme의 `base-font-family` 선택을 가리던 원인도 수정해 desktop·touch 및 DOM·Canvas가 같은 서체를 읽는다. 명시한 sans 토큰 재정의는 우선한다.
  - Design의 상속 서체 표시도 renderer의 `catalogTextTypography`를 읽는다. Theme에서 서체를 바꿔도 선택창에 이전 기본 서체가 표시되던 문제를 수정한다.
  - 위치: `apps/builder/src/builder/panels/fonts/FontFamilyPicker.tsx`, `panels/themes/ThemesPanel.tsx`, `fonts/customFonts.ts`.

## [S2 필수 표시 — Label의 실제 Text·Icon 자식] - 2026-11-06

### Breaking Changes

- **Library 계약 61**: 13개 입력·선택 필드의 Label에 본문 Text·간격 Text·필수 Icon·필수/선택 Text를 작성 자식으로 추가한다. 계약 60 이하 개발 문서는 거부하며 자동 마이그레이션은 제공하지 않는다.

### Changed

- catalog의 문자열 접미사·React span 주입을 제거한다. 필드 상태, Form 상속, locale에 따라 실제 자식의 내용과 존재를 갱신한다. 표시 자식을 삭제해도 대신 그린 표시를 주입하지 않는다.
- 본문은 Label의 타이포그래피를 상속하고 필수 표시는 편집 가능한 S2 Asterisk Icon을 사용한다. 기본색·disabled 색·크기·baseline 여백은 공통 catalog에서 읽으며 명시적 자식 스타일이 우선한다.
- 표시 앞 간격은 별도 Text 자식으로 유지해 본문 RichText 편집과 분리한다. Label 안의 Icon은 phrasing element인 span으로 렌더한다.
- 설치 S2 1.8.2의 34개 locale 문구를 사용한다. 필수 표시의 접근성 이름 정책과 사용자 텍스트 편집을 유지한다.
- 실제 브라우저에서 상태·테마·크기·색·편집·Undo/Redo·저장 재로드·Form 상속·한국어 및 Code View CSS 보존을 검사했다. 직접 Builder 검증은 연결/네이티브 시간초과로 미완료이며, 전체 픽셀·여러 줄 라벨·Publish 완료를 주장하지 않는다.

## [S2 필수 표시 기반 — 편집 가능한 Asterisk 아이콘] - 2026-11-06

### Added

- S2 1.8.2 Asterisk의 M/L/XL filled SVG 경로와 원래 viewBox를 공통 Icon 데이터에 추가한다. S는 S2 Field처럼 M 경로를 사용한다.
- Icon 검색에서 `s2-asterisk`, `s2-search`, `s2-cross`를 고를 수 있다. 기존 Lucide 아이콘과 별도 이름으로 제공한다.
- 실제 S2 렌더와 네 크기의 경로·viewBox를 비교하고, 공통 Icon의 색·크기 편집과 Undo/Redo·저장 재로드를 검증했다. Label 자동 필수 표시의 자식 조립은 아직 미완료다.

## [S2 필수 표시 — 접근성 이름 정책] - 2026-11-06

### Fixed

- S2 1.8.2 Picker·CheckboxGroup에 맞춰 Select·CheckboxGroup의 필수 표시를 접근성 이름에 포함한다. 일반 입력은 required 중복 안내를 숨기며 optional 문구는 유지한다.
- 실제 RAC 브라우저에서 icon/label과 required 전환의 접근성 이름을 검사한다. 필수 표시의 편집 가능한 Text/Icon 자식 전환은 소비자 감사 단계이며 아직 구현되지 않았다.

## [S2 SearchField — 지우기 상태와 입력 끝 여백] - 2026-11-06

### Fixed

- 빈 값·읽기 전용에서 지우기 버튼이 차지하던 입력 끝 여백을 제거한다. catalog의 상태별 부품 규칙을 Canvas와 DOM이 함께 소비하며, Preview의 직접 입력·지우기에도 즉시 반영한다.
- 기본값과 같은 명시적 여백 편집과 Input 원본의 Library 편집을 유지한다. 상태 전환·Undo/Redo·저장 재로드·복원 및 설치된 S2 1.8.2의 S/M/L/XL 입력 끝 간격을 브라우저 회귀로 검사한다.

## [S2 SearchField — 검색·지우기 아이콘 기본 시각] - 2026-11-06

### Fixed

- SearchField의 검색 아이콘과 크기별 Cross 경로를 S2 1.8.2와 맞추고, 공통 Icon 데이터의 viewBox·fill 정보를 DOM과 Skia가 함께 소비한다. 지우기 버튼은 투명 배경과 S/M/L/XL 입력 높이에 맞는 버튼 영역, 중립색·disabled 색·안쪽 focus outline을 사용한다.
- 편집 가능한 Icon·Button 자식 구조를 유지하며 색·크기·아이콘 변경, Undo/Redo, 저장 재로드, 기본값 복원을 검사했다. 사용자 glyph 크기가 flex 레이아웃에서 축소되는 문제도 수정했다.
- Chromium에서 설치된 S2의 경로·크기·위치·색을 대조하고 실제 CanvasKit fill/stroke 픽셀을 검증했다. 직접 Builder 편집은 Chrome 제어 경합으로 미완료이며, Publish·전체 픽셀·touch·RTL은 미검증이다. 빈 값/읽기 전용일 때 입력 오른쪽 여백과 필수 표시 정렬은 남은 항목이다.

## [S2 SearchField — 읽기 전용 지우기 버튼] - 2026-11-06

### Fixed

- S2 1.8.2의 표시 조건에 따라 읽기 전용 SearchField의 지우기 버튼을 Canvas와 DOM에서 숨긴다. 값이 있어도 숨기며, 읽기 전용 해제·Reset 시 다시 표시한다. disabled와 read-only의 의미는 구분한다.
- Chromium에서 light/dark·S/M/L/XL, 빈 값·일반 값·공백, disabled 조합과 Undo/Redo·저장 재로드·Reset을 확인했다. RAC의 Tab 순서·Escape 지우기·버튼 클릭 후 입력 포커스 유지도 검사했다.
- 직접 Builder 검증은 브라우저 연결 불가와 Chrome 조작 경합으로 미완료다. 지우기 버튼의 크기·색·아이콘 및 필수 표시의 S2 기본 시각 차이는 별도 미해결 항목으로 남는다.

## [S2 입력 필드 — placeholder·label·도움말 기본값] - 2026-11-06

### Fixed

- S2 1.8.2 Field의 placeholder·prefix에 gray-600 역할 토큰을 적용하고, Canvas도 실제 입력값과 placeholder의 색상을 구분한다. 사용자 입력 글자색 편집과 복원은 DOM·Canvas에 동일하게 반영한다.
- 편집 가능한 공통 Label 원본의 기본 굵기를 400으로, Description·FieldError의 크기를 입력 글자와 같은 S/M/L/XL 12/14/16/18px로 정렬한다. 오류색과 disabled 우선순위도 공통 catalog에서 읽는다.
- invalid에서는 도움말 대신 오류를 표시한다. DOM은 RAC 검증 context를 소비하며 기본 validation 메시지 동작을 유지한다.
- ComboBox 선택 항목·라벨 편집이 Canvas 입력값에도 갱신되며, Selected 해제 시 정적 DOM의 이전 선택 문구도 지워진다. 실행 중 Preview의 제어 상태는 유지한다.
- Chromium에서 상태·테마·크기, 스타일 편집·Undo/Redo·저장 재로드·Reset을 검사했다. 직접 Builder 검증은 브라우저 연결 불가와 네이티브 Chrome 사용자 조작 경합으로 미완료이며 전체 픽셀·Publish 정합성을 완료로 판정하지 않는다.

## [S2 입력 필드 — 공통 상태·테두리·focus] - 2026-11-06

### Fixed

- 공통 Input의 바탕·글자·테두리와 hover·pressed·invalid·disabled·focus 우선순위를 S2 1.8.2 FieldGroup 기준으로 정렬한다. 2px 테두리와 조정된 세로 padding으로 컨트롤 높이를 보존한다.
- TextField·TextArea·SearchField·NumberField·ColorField·ComboBox의 중복 disabled opacity를 제거하고 label·입력 부품에 상태를 전달한다. Canvas도 입력 focus ring을 공통 catalog outline으로 소비하며 사용자의 테두리·바탕색 편집이 기본 상태색보다 우선한다.
- Chromium에서 여섯 필드의 light/dark·S/M/L/XL 상태 조합과 스타일 편집/복원을 검증했다. TextField·TextArea·SearchField는 실제 키보드 입력·focus·Read Only 적용/해제도 확인했다. 직접 Builder에서는 TextField 상태 표시·재로드를 확인했으며, 활성 탭 변경으로 나머지 직접 편집 검증은 미완료다. 전체 픽셀·Publish 일치는 아직 판정하지 않았다.

## [S2 선택 그룹 — 상태 상속과 label 기본색] - 2026-11-06

### Fixed

- CheckboxGroup의 disabled·invalid 변경과 해제가 자식 Checkbox의 Canvas 파생 상태에도 반영된다. 자식의 개별 disabled·선택 편집은 유지한다.
  - **Why:** RAC context에만 전달되던 그룹 상태가 Canvas에서 누락됐다. 위치: `packages/shared/src/catalog/runtime/presence.ts`.
- CheckboxGroup·RadioGroup의 중복 disabled opacity를 제거하고 label에 S2 1.8.2의 기본 neutral-subdued·disabled 색상을 적용한다. 기본 neutral 테마도 정확한 light/dark subdued 값을 보존하며 명시된 사용자 색상이 우선한다.
- 이전 RadioGroup 수정의 직접 재검증을 완료했다. 두 그룹의 상태 편집·Undo/Redo·저장 재로드·상태 Reset, Canvas/Compare 표현과 CheckboxGroup의 키보드 다중 선택·Read Only 적용/해제를 확인했다. 전체 픽셀·Publish·입력 기기별 검증은 남아 있다.

## [S2 Checkbox·Radio·Switch — 상태 색상과 선택 편집] - 2026-11-06

### Fixed

- **선택 컨트롤 상태 색상·focus 정렬**: S2 1.8.2의 light/dark 기본·hover·pressed·focus·강조·invalid·disabled 색상과 우선순위를 공통 catalog 상태 트리에서 CSS와 Canvas에 전달한다. label·glyph·thumb의 색상 상속과 indicator focus도 같은 경로를 따른다.
  - **Why:** DOM 상태 트리와 Canvas의 하드코딩된 색상·전체 opacity가 서로 달랐다. 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`, `packages/rendering/src/renderers/skiaPrimitives.ts`.
- **Switch Selected 편집 즉시 반영**: Builder Property 변경 시 static DOM의 초기 선택값도 갱신한다.
  - **Why:** 비제어 RAC 초기값은 동일한 key에서 다시 읽히지 않았다. 위치: `packages/shared/src/catalog/runtime/delegatedDom.runtime.ts`.
- **RadioGroup 상태 전달**: 그룹 value·invalid·disabled 변경이 Radio의 Canvas 파생 상태도 갱신한다.
  - **Why:** RAC context에만 전달되던 상태가 Canvas에서 누락됐다. 위치: `packages/shared/src/catalog/runtime/presence.ts`. Chromium 회귀 검사는 통과했으며 이 후속 수정의 직접 Builder 재검증은 미완료다.
- Chromium에서 상태 색상 512개 조합, 키보드 선택, 테마·focus 변경/복원을 검사했다. 실제 Builder에서 상태 편집, Checkbox·Switch Undo/Redo·재로드, Switch Reset 후 재로드와 Radio 방향키 선택을 확인했다. 전체 픽셀·Publish·입력 기기별 검증은 남아 있다.

## [S2 버튼 그룹 — 상속·배치·focus 정합성] - 2026-11-06

### Fixed

- ActionButtonGroup·ToggleButtonGroup의 크기별 일반 간격(XS/S 4px, M/L/XL 8px), compact 2px, 세로 배치·양끝 모서리를 공통 catalog 규칙으로 정렬한다. XS 버튼 모서리는 S2 1.8.2의 6px로 맞춘다.
- ToggleButtonGroup의 Quiet 편집·저장 경로를 복구하고 그룹의 staticColor·강조·disabled 명시값이 자식에 전달되는 우선순위를 S2로 맞춘다. 기본 그룹은 버튼 전체에 눌림 효과를 적용한다.
- 두 버튼의 static focus ring과 light/dark 기본 focus 색상을 맞추며, Canvas도 사용자 지정 focus 색상·두께·간격을 소비한다. 기존 focus 편집값의 우선순위를 보존한다.
- Builder에서 XL·세로·compact·Quiet 편집과 Canvas/Preview 표현을 확인했다. Chromium에서 크기·방향·밀도 40개 조합과 단일/다중 선택의 방향키·Space 동작을 검증했다. 후속 직접 검증에서 ToggleButtonGroup 크기 Undo/Redo, 저장 재로드, Reset 후 재로드를 확인했다. Preview의 기본·static black focus 및 방향키·Space 선택도 확인했다. Canvas focus 직접 재현과 Publish는 미검증이다.

## [S2 ActionButton·ToggleButton — 상태 색상과 초기 선택값] - 2026-11-06

### Fixed

- ActionButton과 ToggleButton의 배경·글자색을 공통 catalog 상태 트리로 정렬한다. S2 1.8.2의 light/dark, hover·pressed·focus·열림, quiet·selected·emphasized·disabled와 static white/black 투명도를 반영한다.
- ToggleButton의 추가 테두리와 disabled 전체 opacity를 제거하고 제어 높이를 보존한다. 원본의 강제 selected 표시 상태를 제거해 기본 삽입과 Reset은 미선택으로 시작한다.
- 실제 Builder에서 두 버튼의 속성 편집·저장/재로드·Reset, ActionButton Undo/Redo, ToggleButton의 Preview 클릭·Space 선택 전환과 Canvas/Compare 표현을 확인했다.

## [S2 accent·negative Button — 상태 색상과 Canvas 테두리] - 2026-11-06

### Fixed

- Button accent·negative의 fill 기본·hover·pressed·focus 색상을 S2 1.8.2 light/dark 역할값으로 정렬하고 테마 편집·복원 경로에 연결한다. outline은 최종 글자색을 테두리에 사용하며 static white/black의 상태·disabled 표현도 공통 catalog에서 제공한다.
- Canvas의 native binding에서도 `currentColor`를 최종 글자색으로 해석한다. 실제 Builder 비교에서 발견한 static white outline의 검정 테두리를 수정하고 Skia 노드 회귀 검사를 추가했다.
- Theme 색상 직접 편집·Undo/Redo·재로드·Reset과 Canvas/Compare 반영을 확인했다.

## [S2 neutral 역할 — Button 상태 색상] - 2026-11-06

### Fixed

- neutral 내용·진한 배경·옅은 배경·테두리·반전 글자색을 독립 역할로 제공한다. 기본 neutral은 S2 1.8.2 역할값을 사용하며 기존 neutral·neutral-subtle·border 테마 변경은 새 역할에도 연결한다. 새 역할을 명시하면 그 값이 우선한다.
- Button primary·secondary의 fill/outline 기본·hover·pressed·focus 색상을 정렬한다. outline 글자의 상태 변화와 키보드 focus 색상도 공통 catalog 상태 트리에서 CSS·Canvas에 반영한다. primary의 반전 글자색은 페이지 바탕색과 분리한다.
- Builder Theme 패널에서 neutral-content 편집·Undo/Redo·재로드·Reset과 Canvas/Compare 반영을 확인했다.

## [S2 disabled 색상 — Button과 기본 서체 표시] - 2026-11-06

### Fixed

- disabled 배경과 글자색을 별도 역할로 정의하고 S2 1.8.2 light/dark 기본값을 적용한다. Button의 fill·outline·premium·genai disabled 글자는 공통 `disabled-content`를 사용하며 사용자 스타일 변경은 유지한다.
- Theme 패널의 기본 서체 이름을 실제 기본값인 Adobe Clean Spectrum으로 표시한다. Builder에서 Button Disabled 편집·복원·Undo/Redo·재로드와 Canvas/Compare 표현을 확인했다.

## [S2 공통 바탕색 — 기본 테마와 복원] - 2026-11-06

### Fixed

- 기본 neutral 테마의 base·layer-1·layer-2·elevated·disabled 테두리를 S2 1.8.2의 light/dark 역할값으로 정렬한다. 사용자 tone과 명시 색상 변경은 기존 테마 경로로 반영한다.
- 기본 바탕색은 테마 설치 전 값을 보존해 Undo·Reset이 직전에 설치한 사용자 색상을 재사용하지 않도록 한다. 실제 Builder 색상 편집·Undo/Redo·재로드·Reset과 Canvas/Compare 화면을 확인했다.

## [S2 공통 서체 — 기본값과 Canvas 조판] - 2026-11-06

### Changed

- 기본 sans·serif·code·italic을 S2 1.8.2 Adobe Clean Spectrum / Source Code Pro로 정렬하고 Builder·Preview·Publish의 폰트 로딩과 기본 서체 전달을 연결한다. 기본 서체는 S2와 같은 Adobe CDN 자원을 사용하며, 기존 문서의 명시된 서체는 유지한다. 추가 face는 Canvas에서 사용할 때 로딩한다.
- Canvas의 글자 측정과 페인트에 CSS normal의 `wdth=100`을 적용하고 테마 기본 서체·사용자 sans 변경을 DOM `--font-sans`와 함께 전달한다.
- 한국어·일본어·중국어 locale의 S2 기본 서체와 Typekit 동적 subset을 DOM·Canvas에서 공유한다. 텍스트가 추가되면 같은 face의 subset을 교체하고, 사이트 언어를 Canvas 측정·페인트의 OpenType 조판에도 전달한다. 명시한 사용자 서체와 Undo 복원은 같은 catalog 경로를 따른다.

## [S2 메뉴 폭 — 기본값과 사용자 스타일 우선순위] - 2026-11-06

### Fixed

- Select의 `menuWidth`가 기본 `fit-content`에 가려지지 않도록 수정하고 quiet 메뉴의 트리거 폭 − 24px·최소 192px을 반영한다. Select·ComboBox Popover의 사용자 폭 편집·복원·Undo/Redo는 Canvas와 DOM에 동일하게 적용한다.
- ComboBox 등 필드 Group의 저작 스타일을 DOM 제어 상자에 전달한다. Menu ActionButton 측정 fixture와 Toast reduced-motion mock, D2 확장 prop 출처도 현재 계약에 맞춘다.

## [Canvas 내부 선택 — 빈 공간 더블클릭] - 2026-11-06

### Fixed

- Select·ComboBox의 ListBoxItem 등 자식이 있는 컨테이너는 빈 padding을 더블클릭해도 내부 편집 맥락으로 진입한다. 항목의 `{label}` 편집창이 잘못 열리지 않으며, 진입 후 자식 클릭·Text 더블클릭 편집·Escape 복귀를 유지한다.

## [Select 선택값 — 크기 상속] - 2026-11-06

### Fixed

- Compare Mode·Preview에서 Select single과 multiple의 단일 선택값이 목록 Text의 M 크기 inline 스타일을 재사용하던 문제를 수정한다. 선택값 안의 Text는 SelectValue의 font family·size·weight·line-height를 상속하고, 목록에서의 Text 스타일은 유지한다. S/M/L/XL, 미선택·단일 선택·다중 요약, size 편집·Undo를 브라우저 회귀로 검증한다.

## [Canvas overlay — 표시·선택 순서 정합] - 2026-11-06

### Fixed

- Properties에서 Open으로 연 Dialog·Popover와 관련 picker·Menu·Tooltip·Sheet를 페이지의 일반 내용과 fixed 요소 뒤에 그린다. 그리기 순서와 hit-test 순서를 공유해 뒤쪽 요소가 overlay 본문의 클릭·hover를 가로채지 않게 한다.
- Dialog 배경막의 클릭 영역을 표시된 viewport까지 포함하되 선택·hover 테두리는 본체에 유지한다. 닫기·Undo와 페이지 이동 후에도 본체와 배경막의 선택 영역을 함께 갱신한다.

## [Picker 항목 — 중복 왼쪽 여백 제거] - 2026-11-06

### Fixed

- Select single/multiple과 ComboBox의 실제 선택 부품 행에 남아 있던 24px pseudo-check 여백을 제거한다. S/M/L/XL 바깥 여백은 catalog size 값 9/12/15/18px을 한 번만 적용하며, 아이콘은 저작 Layout을 따른다. Canvas/Preview 행 기준 체크·라벨 좌표와 사용자 padding 편집·Undo를 브라우저 회귀로 고정한다.

## [목록 선택 표시 — S2 라벨 행 및 공간 유지] - 2026-11-05

### Breaking Changes

- **Catalog library contract 60**: MenuItem에 실제 선택 Icon/Checkbox 부품을 추가한다. 이전 계약의 개발 프로젝트는 기존 정책에 따라 거부한다.

### Fixed

- Select single·multiple, ComboBox, 선택 가능한 Menu의 선택 부품을 첫 번째 라벨 행에 배치하고 설명은 다음 행에 둔다. 미선택 single 체크는 공간을 유지하며 표시만 숨긴다. 앞선 Select의 전체 높이 중앙 배치 결정을 S2 라벨 행 계약으로 대체한다.
- ComboBox의 선택 부품 제외를 제거하고 Menu의 점/문자 글리프를 실제 Check Icon·Checkbox로 교체한다. Canvas의 선택 표시 갱신과 Preview의 RAC 선택 상태가 같은 항목을 읽는다. ComboBox도 저장한 항목의 `Selected`를 초기 선택값으로 복원한다.

## [Select 선택 부품 — 모드별 Layers 및 Selected 편집 정합] - 2026-11-05

### Fixed

- **single은 실제 Check Icon + Text, multiple은 Checkbox + Text로 표시**
  ListBoxItem 원본에 선택 상태를 읽는 Check Icon 부품을 추가하고, 모드에 맞지 않는 선택 부품은 Canvas·Preview·Layers에서 함께 제외한다. 렌더러가 따로 그리던 single 장식은 제거한다. Check Icon은 Grid 행이 아닌 옵션 전체 높이를 기준으로 배치하고 기존 CSS translate로 중앙 정렬한다. 음수 margin을 중복 적용해 위로 붙는 문제를 제거한다. 24px 선택 열 안의 16px check는 좌우 4px 여백으로 가로 중앙에 맞춘다. multiple Checkbox도 selection 슬롯 폭 24px와 내부 가운데 정렬을 명시해 표시 상자를 열 중앙에 배치한다. 기존 템플릿 주소는 보존한다.
- **옵션 Checkbox의 Selected 편집이 실제 옵션 선택을 갱신**
  필드가 ListBoxItem의 선택값을 읽고 명령으로 편집하도록 연결하며, Preview 초기값도 같은 옵션 선택값에서 계산한다. Canvas 체크 선·DOM 선택 표시·Undo가 함께 갱신된다.

## [Picker Popover — viewport 경계 폭 제한] - 2026-11-05

### Fixed

- **부모 padding이 없을 때 Select Popover가 가로로 넘치는 문제 수정**
  트리거 폭을 보존할 수 있는 만큼만 collision 여백을 사용한다. 부모 padding 0에서는 Select와 Popover가 같은 폭·양쪽 가장자리를 유지한다. Canvas와 CSS Preview는 같은 여백 계산을 사용하고, Preview는 트리거·viewport 리사이즈에도 갱신한다. ComboBox에도 같은 계약을 적용한다.
  **Why:** 전체 폭 트리거와 고정 12px 경계 여백이 충돌했다. 최소 폭만 제한하면 메뉴가 24px 좁아지므로 폭 제한과 위치 보정이 같은 실효 여백을 사용해야 한다.

## [Select — 선택 Checkbox 슬롯과 편집 가능한 옵션 Layout] - 2026-11-05

### Breaking Changes

- **Catalog library contract 59**
  ListBoxItem 원본에 실제 `Checkbox[slot="selection"]` 자식을 추가한다. 기존 개발 문서는 저장 계약에 따라 거부하며 자동 변환하지 않는다.

### Fixed

- **다중 선택 Checkbox와 텍스트의 Canvas 겹침 수정**
  Select 옵션이 체크박스를 직접 그리던 코드를 제거하고 실제 Checkbox·CheckboxButton·CheckboxIndicator 자식으로 배치한다. 옵션이 선택·disabled 상태를 소유하며 DOM에는 독립적인 입력·포커스 대상을 추가하지 않는다.
  **Why:** 목록의 직접 그리기는 레이아웃에 공간을 차지하지 않아 Text와 겹쳤다.
- **Layout 패널·Canvas·Preview의 배치 정본 통일**
  Select 옵션의 grid와 슬롯별 위치를 원본 템플릿에 명시한다. 실행 시점의 강제 grid·padding 보정 없이 작성한 Layout을 소비하며, 일반 흐름으로 배치한 아이콘에는 절대 위치용 텍스트 inset을 적용하지 않는다.
  위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`, `packages/shared/src/catalog/runtime/{pickerSelection,presence,delegatedDom.runtime}.ts`, `apps/builder/src/builder/catalogRuntime/ruleShapes.ts`.

## [Accordion 명칭 통일 — RAC DisclosureGroup 경계 유지] - 2026-11-05

### Breaking Changes

- **Catalog library contract 58**
  DisclosureGroup의 catalog 식별자·원본·템플릿 주소를 Accordion으로 변경한다. 이전 contract의 개발 문서는 기존 정책대로 거부하며 자동 변환하지 않는다.

### Changed

- **사용자 컴포넌트 이름을 Accordion으로 통일**
  팔레트·Library·Property·Interactions·Code View·CSS와 Canvas의 타입 판정을 Accordion으로 변경한다. S2와 동일하게 실제 DOM은 RAC DisclosureGroup을 사용하며, RAC props 타입과 상태 키 참조는 해당 라이브러리의 이름을 유지한다.
  Code View도 `DisclosureGroup as Accordion`으로 가져와 실제 RAC export와 내부 이름을 연결한다.

## [Select — S2 Picker 토큰·상태·정렬 정합] - 2026-11-05

### Fixed

- **Select의 light/dark 상태 색상과 Preview CSS 격리**
  Picker 전용 의미 토큰으로 기본·hover·open·disabled 배경/글자를 정의한다. Builder 폼 CSS가 문서 Select를 덮지 않으며, Disabled는 전체 opacity 대신 전용 색상을 사용한다. Placeholder·선택값은 왼쪽 정렬하고 펼침 아이콘은 trigger 색상을 상속한다.
- **Select 다중 선택의 S2 표시 계약**
  0개는 placeholder, 1개는 선택 항목, 2개 이상은 locale에 따른 선택 개수를 표시해 항목 label의 `width: 100%`가 선택값 영역에 반복되던 문제를 수정한다. 다중 선택 목록은 모든 항목에 checkbox를 표시하고 단일 선택은 선택 항목에만 check를 표시한다. Canvas와 DOM은 같은 indicator 크기·색상 토큰을 사용하며 단일 선택값에는 목록 indicator를 복제하지 않는다.
- **Picker 트리거와 목록 상태 정합**
  실제 pointer 누름과 열린 상태를 분리해 클릭 해제 시 scale을 복구한다. Quiet의 기본 밑줄을 없애고 키보드 focus에서만 선을 표시한다. Invalid는 레이아웃을 바꾸지 않는 2px 표시와 경고 아이콘으로 표현한다. Select의 Popover 목록은 8px inset과 size별 모서리를 사용하며 기존 기본 폭·우측 여백은 유지한다.

## [Menu hover·트리거 누름 상태 — S2 정합] - 2026-11-05

### Fixed

- **메뉴 항목 hover의 브라우저 기본 outline 제거**
  MenuItem·ListBoxItem은 기본 outline을 끄고 키보드 focus에서만 표시한다. Popover 내부 ListBox의 focus 표시를 지우던 부모 규칙도 제거해 S2처럼 바깥쪽 2px offset을 사용한다. Publish 전역 focus 기본값과 Builder chrome의 offset이 catalog 상태 규칙을 덮지 않도록 우선순위·범위를 수정했다.
- **메뉴가 열린 뒤 트리거 축소가 유지되는 문제 수정**
  RAC의 open 상태와 실제 마우스 누름을 분리한다. Underlay가 나타나도 누름은 유지하고, 실제 pointerup·pointercancel·창 blur에서 해제하며 unmount 시 리스너를 정리한다. 열린 ActionButton은 Canvas·CSS 모두 hover 배경을 유지한다.

## [Popover 표면 — Spectrum S2 스타일] - 2026-11-05

### Changed

- **Popover를 S2 크기·여백·표면으로 통일**
  모서리 10px, 기본 여백 8px, S/M/L 폭 336/416/576px, layer-2 배경과 elevated 그림자를 사용한다. light/dark 전용 outline은 레이아웃 크기를 늘리지 않는다. Menu/Submenu는 Popover가 표면을 그리고 목록은 8px inset만 갖는다. Select/ComboBox의 중복 표면 스타일도 제거했다.
- **Popover 전환을 200ms fade와 배치 방향의 4px 이동으로 변경**
  Submenu는 이동 없이 fade하며 reduced-motion에서는 애니메이션을 끈다.
- **메뉴·Popover 내부 목록의 hover와 키보드 focus 배경을 S2 강조색으로 통일**
  light `#e1e1e1` / dark `#323232`를 공용 토큰으로 사용한다. disabled 항목은 강조하지 않고, Popover 밖의 독립 ListBox 선택 스타일은 유지한다.

## [Menu 기본 트리거 — ActionButton 적용] - 2026-11-05

### Breaking Changes

- **Catalog library contract 56 → 57**
  Menu 트리거 원본 교체로 Icon · Text의 템플릿 주소가 바뀐다. 이전 contract 문서는 기존 정책대로 거부하며 자동 변환하지 않는다.

### Changed

- **Menu의 기본 트리거를 Button에서 ActionButton으로 변경**
  `Menu` 라벨, 부모 Size 상속, 기존 모서리 8px를 유지한다. MenuTrigger의 필수 부품 검사도 Button · ActionButton을 모두 인정한다. Canvas의 열린 Popover도 ActionButton을 배치 기준으로 찾는다.
  위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`, `packages/shared/src/catalog/nesting/requiredParts.ts`.

## [작업 버튼 Property — Icon · Label 자식 바인딩 복구] - 2026-11-05

### Fixed

- **ActionButton Property의 Label · Icon을 원본의 자식 바인딩 키로 연결**
  `reusablePropsSchemas.ts`에 ActionButton 원본 편집 스키마를 등록했다. Label은 `label` → Text의 `{label}`, Icon 선택기는 `icon` → Icon의 `{icon}`을 편집한다. **Why:** 원본 스키마가 없어 primitive 계약으로 fallback하면서 Icon이 누락되고 Label이 루트 `children`을 편집했다. 원본의 기본 Label `Action`과 인스턴스 override도 올바르게 읽는다.

### Tests

- `actionButtonProperties.test.tsx`: 단독·그룹 자식의 편집 계약, Label/Icon 자식 반영, 초기화, Undo, 빈 Label의 icon-only 상태. 수정 전 두 경우 RED, 수정 후 PASS.
- 실제 Builder에서 팔레트 삽입 → Label 편집 → Icon 선택 → Canvas/Preview 자식 반영을 확인했다.

## [작업 버튼 — ActionButton · ActionButtonGroup] - 2026-11-05

### Breaking Changes

- **Catalog library contract 55 → 56**
  원본 정의 두 개를 추가했다. 이전 library contract 문서는 기존 버전 검사 정책을 따른다.

### Added

- **Components · Library에 ActionButton과 ActionButtonGroup 추가**
  RAC Button · Toolbar 동작에 catalog 시각 정본을 연결했다. XS–XL, quiet, staticColor, disabled, pending과 그룹의 방향·밀도·justified를 Property에서 편집하며 Canvas와 Preview가 같은 값을 소비한다. 그룹은 선택 상태 없이 방향키 탐색과 공통 속성 상속을 제공한다.
- **Events · Code 왕복 연동**
  ActionButton은 Button의 Press·포인터 이벤트를 제공한다. 그룹에는 가짜 Press·선택 이벤트를 추가하지 않는다. Code에서 속성·자식·Press 동작을 편집해 Apply하고 Undo할 수 있다. 위치: `packages/shared/src/interactions/componentInteractionSpecs.ts`, `packages/shared/src/codeView/generate.ts`.

### Changed

- **Builder 명령 버튼 공통화**
  `components/ui/ActionButton.tsx`를 추가하고 ActionIconButton · 선택 작업 바 · 필터 공유 명령에 적용했다. 기존 토글은 ToggleButton 계약을 유지한다.
- **등록·상태·렌더링 연결**
  위치: `packages/shared/src/catalog/bindings/ActionButton*.binding.ts`, `document/generated/reusableOriginLibrary.ts`, `generated/componentRulesTable.ts`, `runtime/presence.ts`, `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`.

### Tests

- ActionButton family 인접 회귀: 레이아웃·모서리·아이콘 전용·pending·disabled 상속, Events 실행, Code Apply·구조 편집·Undo.
- 실제 Builder: 팔레트 삽입, Property XL·vertical·compact·quiet·disabled, Preview 방향키 이동, Events→Code 편집→Apply→새로고침 유지 확인.

## [코드 보기 — Library 오버레이 instance 는 팔레트 이름 · slot 은 선언 이름] - 2026-11-05

### Fixed

- **`<DialogTrigger>` 로 나오던 Popover · Dialog · Tooltip · Menu · Sheet instance 가 `<Popover>` · `<Dialog>` … 로 나온다**
  팔레트 원본의 instance 는 template 루트의 RAC type 이 아니라 **놓은 팔레트 type** 으로 쓴다 (`generate.ts` `originTag` — `getReusableEntries` 의 reusableId 역조회, `PALETTE_REUSABLE_ORIGIN_TYPES` 한정). **Why**: 코드의 `<Popover>` 는 `catalogPaletteDefinitionId` 가 같은 원본으로 읽지만 `<DialogTrigger>` 는 빈 DialogTrigger 노드로 읽혀 왕복이 깨졌고, RAC 로 읽으면 열리지도 않는 코드였다 (사용자 보고 — RAC 레퍼런스와 나란히 비교). Button · Card 처럼 두 이름이 같은 원본은 그대로.
- **`<Slot name>` 은 template 이 선언한 slot 이름**
  `<Slot name="frame">` (자리 노드의 class) 이 `<Slot name="content">` (Popover · Dialog · Tooltip 의 `slot.name`) 로. Card 는 `Preview` · `Content` · `Footer`, TagGroup 은 `Tags` — 선언 이름 그대로 (`files/overrides.ts` `codeViewSlotKey`). 역방향 (`codeViewAddressOf`) 은 선언 이름을 먼저, 없으면 class 로 찾는다 — 옛 코드의 class 이름도 그대로 읽힌다. `overrides` 키 · CSS 경로 선택자 (`.picker .save-button`) 는 class 경로 그대로.
- 펼친 모양 (`DialogTrigger > Button + Popover > …` 를 page 코드에) 은 ADR-301 (Proposed) 에서 따로 설계한다.

### Tests

- `adr296LibraryOverlay.test.tsx` 7 (Popover 태그 · import · slot 이름 · 5 가족 태그 · 왕복 strict 0 변경 + slot 글자 편집 · 자식 추가 · 새 `<Popover />` 입력 = 원본 instance 한 step) — 변경 전 7 RED. `adr296Component` Card slot 기대값 · golden `plants.tsx.txt` (`tag-list` → `Tags`) 갱신.
- live (5176 worktree): 새 프로젝트 → 팔레트 popover → Code 패널 `pages/Home.tsx` 에 `<Popover>` · `<Slot name="content">` · `import {Description, Heading, Popover} from 'react-aria-components'`.

## [Modal 배경 = Modal rule 값 — Canvas · Preview 가 같은 값을 읽는다] - 2026-11-04

### Changed

- **열린 Modal 의 배경 (scrim) 을 Modal rule 이 소유**
  catalog `Modal` rule 에 `underlay: "{color.overlay-backdrop}"` (S2 1.8.1 `Modal.tsx` `modalOverlayStyles.bg`) 를 두고, 열린 modal 의 record 가 그 값을 `_modalUnderlay` 로 싣는다. Canvas 배경 (`withModalBackdrop`) 과 Preview · Publish 의 `ModalOverlay` 가 같은 값을 칠한다. trigger 바로 아래의 Dialog 가 여는 modal 도 같은 값이다. **Why**: Canvas 는 토큰을 코드에 고정해 두고 DOM 은 수동 시트 (`overlays.css`) 에 맡겨, 두 consumer 가 rule 이 아닌 각자의 사본을 읽었다. 화면 값은 그대로 (`#00000070`).
- shared `Modal` 은 S2 처럼 `ModalOverlay > Modal` 을 직접 그린다. RAC 단독 Modal 이 만드는 overlay 에는 style 을 줄 수 없어서다. DOM 구조와 닫기 동작은 같다 (`adr256DialogModal` 구조 대조 통과).
- 위치: `componentRulesTable.ts` (Modal) · `catalog-style.types.ts` (`underlay`) · `compositionRoot.ts` · `canvasBinding.ts` · `domBinding.runtime.ts` · `components/Modal.tsx` · `components/Dialog.tsx`.

### Fixed

- **ADR-293 게이트 실패 해소**: `preview-system.css` 가 resolver 가 싣는 테마 색 `--overlay-backdrop` 을 50 % 로 또 선언하고 있었다 (`generatedCssVarsDeclared.static.test.ts` 실패). 선언을 지웠다. 바로 아래 항목에서 「Builder chrome 대화상자가 그 50 % 를 쓴다」고 적은 것은 틀렸다. chrome 대화상자 7개는 모두 자기 class 의 배경을 쓰고 이 변수를 읽지 않는다. 그래서 chrome 화면은 바뀌지 않는다.

### Tests

- `modalUnderlay.test.tsx` — Modal rule 값 · 열린 Modal record 의 `_modalUnderlay` · DOM `ModalOverlay` inline `var(--overlay-backdrop)` · trigger 아래 Dialog 의 overlay. 변경 전 3 RED.
- `generatedCssVarsDeclared.static.test.ts` RED → GREEN.
- Live (5175): Canvas 에서 열린 Dialog 뒤 배경이 그려졌다. Publish 문서의 `.react-aria-ModalOverlay` 는 inline `var(--overlay-backdrop)`, 계산값 `rgba(0, 0, 0, 0.44)`, 변수 값 `#00000070` (resolver).

## [Toast 펼친 목록 배경 = overlay-backdrop 토큰 — Preview · Publish] - 2026-11-04

### Fixed

- **Toast 펼친 목록의 덮개가 Modal · Sheet 와 같은 농도**
  Toast 목록을 펼쳤을 때 뒤 화면을 덮는 배경 (`.catalog-toast-backdrop`) 이 하드코딩 검정 50 % 에서 `var(--overlay-backdrop)` (S2 `#00000070`) 로 바뀐다. **Why**: 덮개가 토큰을 읽지 않고 자기 검정을 써서, 토큰을 S2 값으로 맞춘 뒤 Toast 만 진하게 남았다 — S2 는 Toast · Modal 이 같은 `transparent-black-500` 을 칠한다. Canvas 는 펼친 Toast 목록을 그리지 않는다.
- 위치: `packages/shared/src/components/styles/Toast.css`.

### Tests

- `overlayBackdropToken.static.test.ts` — 토큰 = S2 값 (light · dark), Toast 덮개가 토큰을 읽는다. 변경 전 RED.
- Live (5175 Preview): 문서의 `.catalog-toast-backdrop` 규칙이 `var(--overlay-backdrop)` 이고 계산값 `rgba(0, 0, 0, 0.44)` (같은 class 의 시험 요소로 측정 — 실제 펼친 목록은 열지 않았다).

## [Modal · Sheet 배경 = S2 값 — overlay-backdrop 토큰] - 2026-11-04

### Fixed

- **Modal · Sheet 배경이 S2 와 같은 농도**
  열린 Modal · Dialog · Sheet 뒤 배경 (`{color.overlay-backdrop}`) 이 검정 50 % 에서 S2 1.8.1 Modal underlay `transparent-black-500` 인 `#00000070` (검정 112/255 ≈ 44 %) 로 바뀐다 — 색 모드 무관 한 값. **Why**: 토큰 값이 S2 설치본 (`@react-spectrum/s2` `Modal.css`) 과 달랐다 (ADR-295 「값 정본 = S2 설치본」). Canvas (Modal 배경 · SheetBackdrop rule) 와 Preview · Publish (테마 snapshot 이 싣는 `--overlay-backdrop`) 가 같은 토큰을 읽어 함께 바뀐다.
- Builder chrome 의 대화상자 (`CommandPalette` 등) 는 `preview-system.css` 의 기본값 (50 %) 그대로다 — chrome 은 S2 값 대상이 아니다.
- 위치: `packages/rendering/src/primitives/colors.ts` (light · dark).

### Tests

- `racNewComponents.test.tsx` (Sheet 배경 5 위치) · `overlayOpen.test.tsx` (Modal 배경) 이 alpha 112/255 를 단언 — 변경 전 6 RED.
- Live (5175): Canvas Modal 배경 표시 확인 · Preview `.react-aria-ModalOverlay` computed `rgba(0, 0, 0, 0.44)`, Builder chrome `--overlay-backdrop` 0.5 유지. 콘솔 · runtime 오류 0.

## [overlay 화살표 = 본체 칠 — Canvas · Preview] - 2026-11-04

### Fixed

- **화살표 색이 본체와 같다**
  열린 Tooltip · Popover 의 화살표가 고정색 (Tooltip `--accent` 파랑 · Popover `--bg-raised`) 대신 본체의 rule 칠을 따른다 — Tooltip neutral 회색 · informative 연파랑 · negative 연빨강, Popover 바탕 `layer-2` + 테두리 `border` (2px stroke). RAC starter 의 `fill: var(--overlay-background); stroke: var(--border-color)` 와 같은 관계다. **Why**: catalog 에 화살표 칠이 없어 DOM 은 수동 시트의 고정색, Canvas 는 그 값을 복사한 리터럴을 썼다 — 둘은 같았지만 본체와 달랐고 variant 를 몰랐다. 두 consumer 가 한 값 (`catalogOverlayArrowPaint` → 화살표 record 의 `_arrowFill` · `_arrowStroke` · `_arrowStrokeWidth`) 을 읽는다 — DOM 은 svg inline (토큰은 CSS 변수), Canvas 는 같은 토큰을 색 모드로 푼다. 작성한 본체 색도 따라간다.
- 수동 `Tooltip.css` · `Popover.css` 의 화살표 규칙은 Builder chrome (`ActionTooltip` · shared `Popover` · `Tooltip`) 몫으로 남는다 — catalog 노드는 inline 이 이긴다. 수동 시트의 variant 블록 (primary · secondary · tertiary · error · filled) 은 catalog variant 이름과 달라 catalog 노드에는 닿지 않는다.
- 위치: `packages/shared/src/catalog/runtime/rulePaint.ts`, `compositionRoot.ts` (`derivedOf`), `domBinding.runtime.ts` (`overlayarrow`), `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` (`withOverlayArrow`).

### Tests

- `overlayArrowPaint.test.tsx` — Tooltip neutral · informative · negative, Popover 파생 값 · Canvas path 칠 = 본체 칠 · DOM svg `fill:var(--bg-muted)` · Popover `stroke:var(--border)` 2px. 구현 전 6/6 RED.
- Live (5175): Canvas Tooltip informative 화살표 연파랑 = 본체, Popover 화살표 바탕 + 테두리. Preview Tooltip svg computed `fill` rgb(219,234,254) = 본체 `background-color`. 콘솔 · runtime 오류 0.

## [press 효과를 S2 `pressScale` 로 교체 — Preview · Publish] - 2026-11-04

### Changed

- **줄이는 방법 = S2 원근 축소**
  누르는 동안 `scale(0.95)` (크기에 비례 — 큰 카드일수록 많이 줄었다) 대신 S2 1.8.1 `pressScale` 의 `perspective(max(높이, 너비 / 3, 24px)) translate3d(0, 0, -2px)` 를 쓴다. 높이가 크기와 상관없이 약 2px 줄고, 누르지 않을 때도 `will-change: transform` 을 둔다. 식은 catalog (`rule/pressScale.ts`), 누른 요소의 크기만 Preview · Publish runtime 이 잰다 (`runtime/pressScale.runtime.ts` — 문서 하나에 MutationObserver 하나, 변수 2 개는 `@property` `inherits: false`).
- **적용 범위 = S2 호출 위치**
  새로 줄어드는 곳: Checkbox 상자 · Radio 고리 · Switch 손잡이 (옛 가로 늘이기 `scale: 1.2 1` 대체) · Slider thumb (끄는 동안) · Calendar 셀 (옛 수동 `scale: 0.9` 대체) · Menu 항목 · Select · ComboBox 목록 항목 (Popover 안만) · Tag · Tag 지우기 버튼 (옛 수동 0.96 · 0.9 는 catalog 노드에서 끔) · 링크 Card · CardView 항목 · quiet Card 의 preview · SideNav 행 (링크를 눌러도) · Toast 닫기 버튼. ToggleButtonGroup 은 S2 SegmentedControl 처럼 버튼 상자가 아니라 안쪽 내용이 줄어든다.
  더는 줄지 않는 곳: S2 가 press 를 두지 않는 RAC Button — Tree · SideNav 펼침 chevron, 목록 drag 손잡이 (Disclosure trigger 는 전부터 제외).
- 빌더 자체 위젯 (Builder chrome) 은 옛 press 를 유지한다 (`builder-catalog-pins.css`). Canvas 는 전처럼 pressed 상태를 그리지 않는다.
- 위치: `packages/shared/src/catalog/rule/pressScale.ts`, `packages/shared/src/catalog/runtime/pressScale.runtime.ts`, `domView.components.tsx`, `generated/componentRulesTable.ts`, `rule/conditionTree.ts` (`isDragging`), `components/styles/CalendarCommon.css`.

### Tests

- `pressScaleS2.test.ts` — 설치된 S2 `pressScale.ts` · RAC `useSliderThumb` 와 식 대조, 측정 runtime (누름 · 놓음 · 부품 · 해제), 생성 CSS. 측정 쓰기 · 부품 목록 변이 RED 확인. `builderCatalogVars.static.test.ts` (chrome 고정).
- Live (Preview, 5174): Button 73.6×32 → 69.3×30.1 · Checkbox 16 → 14.8 · Calendar 셀 30 → 28.1 · Slider thumb 20 → 18.5 · Switch 손잡이 `perspective(24px)` · Select 항목 · SideNav 행 · 링크 Card · quiet Card preview 가 S2 식대로, Disclosure trigger · ToggleButtonGroup 버튼 상자 · div Card 는 그대로.

## [Open overlay 선택 영역 정합 — Canvas] - 2026-11-04

### Fixed

- **열린 본체 기준의 선택 표시**
  Sheet·Dialog·Popover·Tooltip·Menu·Select·ComboBox·DatePicker·DateRangePicker·ContextualHelp·PreviewTrigger를 Open하면 선택 테두리·hover·치수·눈금자·측정·선택 확대가 본체의 최종 경계를 사용한다. 닫으면 트리거/필드 경계로 돌아간다.
- **선택 대상과 편집 대상의 일치**
  속성 패널의 인스턴스 선택은 유지하고 resize는 표시 본체의 override에 기록한다. 열린 본체를 끌어서 배경 트리거를 이동시키는 것을 방지한다.
- **contents 경계의 fixed 자식 제외**
  최종 viewport 배치 전의 fixed 상자를 contents 보고용 경계에 합치지 않아 트리거 위치·크기가 왜곡되지 않는다. RAC 라이브러리는 수정하지 않는다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasSelectionGeometry.ts`, `canvasScene.ts`, `canvasGesture.ts`, `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx`, `catalogOverlay.ts`, `packages/engine/src/tree.rs`.

### Tests

- 11종 Open/Close/Undo·본체 선택, Sheet·Dialog·Popover resize/취소/Undo, 다중 페이지 이동, 일반 노드의 자손 탐색 없음, 중첩 contents/fixed 좌표의 증분 회귀 검사.

## [Sheet·Dialog 배경 fade와 그림자 정합] - 2026-11-04

### Fixed

- SheetBackdrop과 ModalOverlay가 같은 200ms 진입·150ms 퇴장 fade를 공유한다. Sheet의 슬라이드 종료가 늦어도 사라진 배경이 다시 나타나지 않으며, 동작 줄이기 설정에서는 배경 애니메이션을 생략한다.
- Sheet 본체의 그림자를 Dialog를 감싸는 Modal과 같은 `{shadow.lg}`로 정의하고 CSS를 재생성했다.
- Canvas 효과 변환에서 catalog 기본 그림자를 누락하던 경로를 수정했다. 테마별 값을 사용하고, 직접 지정한 그림자와 `none`이 우선한다. React Aria 라이브러리는 수정하지 않는다.
- CSS box-shadow는 상자 외곽에서 그리도록 filter drop-shadow와 분리했다. 투명한 Modal에서도 그림자가 표시되고, 그림자가 내부로 번지거나 여러 층이 서로의 그림자를 다시 만드는 현상을 방지한다.
- 위치: `packages/shared/src/components/styles/overlays.css`, `packages/shared/src/catalog/generated/componentRulesTable.ts`, `apps/builder/src/builder/catalogRuntime/authoredPaintCanvas.ts`.

### Tests

- 열린 Sheet·Modal 본체의 3층 그림자 일치, backdrop 그림자 없음, light/dark와 저작 override 우선순위 회귀 검사.
- 실제 CanvasKit의 투명 상자 내부·외곽 픽셀, 효과 layer 수와 명령 스트림 회귀 검사. Builder Compare에서 두 컴포넌트의 Open 상태를 Canvas·Preview로 비교하고 Preview fade 프레임을 측정했다.

## [대량 페이지 Canvas 처리 범위 최적화] - 2026-11-04

### Fixed

- 페이지 테두리·slot·badge의 화면 밖 그리기를 줄이고, 실제 겹치는 상위 페이지만 chrome 가림 후보로 조회한다. scene/data가 같은 badge 대상은 재사용한다.
- Compare의 현재 페이지 필터를 geometry 조회·Skia 등록·구독에도 적용한다. 열린 portal과 숨김 자손은 해당 페이지의 소유 관계 안에서 유지한다.
- 자체 공용 runtime의 데이터 갱신을 바인딩 owner 서브트리로 제한한다. 동일 record를 보존하며 mock/API 행, 공유 view와 연쇄 참조, Undo/Redo, transaction 실패 복구를 함께 처리한다.
- 드래그 시작·종료의 명령 순서 변경은 기존 노드·구독·picture를 유지한다. 구조 변경 등의 기존 전체 재구성 경로는 유지한다.
- idle picture 준비의 후보 수집·거리 계산·선택·정렬도 시간 예산을 확인하며 나누어 실행한다. scene revision과 카메라가 바뀌면 이전 준비를 취소한다. Adobe RAC 패키지는 변경하지 않는다.

### Tests

- 300페이지 가림 후보, 50페이지 필터, 무관한 형제 5,000개 데이터 갱신, 30,000개 idle 후보의 작업량 회귀 검사와 전체 재구성 oracle 비교.
- production Builder에서 페이지 전환·겹침·Compare·Open, 행 갱신·Undo/Redo·재로드, 포인터 drag·cancel·drop 확인. 30페이지/7,332 record의 전후 측정은 개별 실행 근거이며 모든 장치의 FPS 향상을 보장하지 않는다.

## [Overlay Canvas 증분 계산 최적화] - 2026-11-04

### Fixed

- fixed overlay의 부모 기준 임시 배치를 제거하고 viewport 단계에서 배치한다. fixed가 없는 서브트리는 순회를 생략하며, 본문·제약이 같은 intrinsic 측정과 최종 크기를 재사용한다.
- 열린 overlay의 body·anchor·조상 좌표를 패스당 한 번 조회하고, 실제 배치 입력이 바뀐 항목만 위치를 계산한다. 닫기·제거·실패한 transaction은 캐시도 함께 정리·복원한다.
- 일반 노드는 overlay owner 조상 탐색을 생략하고, Canvas bind/update 안에서 조상 가시성 판정을 공유한다. Adobe RAC 패키지와 공개 API는 변경하지 않는다.

### Tests

- fixed 증분 결과와 fresh layout 비교(auto/%/inset/viewport/DPR/숨김), 재부모화·삭제·handle 재사용, geometry batch·조상 이동·rollback·재오픈 회귀 검사.

## [Overlay Open 속성 Canvas·Preview 동기화] - 2026-11-03

### Fixed

- Dialog/Modal, Menu, Popover, Tooltip, Select, ComboBox, DatePicker, DateRangePicker, ContextualHelp, PreviewTrigger의 Open 상태를 Canvas의 표시·viewport 배치에 연결했다. 닫기와 Undo도 본문에 전파한다.
- Select·ComboBox·날짜 선택기·Popover·Tooltip에 누락된 Open/Initially Open 속성을 등록했다. ComboBox는 RAC의 공식 state context를 통해 초기 컬렉션 로드 후 열림을 적용한다.
- Modal은 공용 overlay backdrop과 viewport 중앙 배치를 사용한다. 다른 팝업은 trigger 위치·방향·경계 반전·화살표 간격을 반영한다.
- 닫힌 overlay의 자손을 Canvas 페인트에서 제외하고, 숨겨진 portal도 page-level 소속을 유지한다. 종료 시 이전 command span이 남아 idle warmup 순회가 되감기던 지연을 수정했다.
- portal 전용 Menu·선택기·달력 스타일을 catalog part 규칙에서도 소비한다. Popover 크기 제한을 catalog로 통합하고 shared wrapper가 작성된 Size를 사용하도록 수정했다.

### Tests

- 컴포넌트별 Open/Initially Open·닫기·Undo, Modal 배경, 화살표, viewport 반전·폭 제약의 회귀 검사 및 실제 Builder Compare 검증.

## [Sheet Open Canvas·Preview 배치 정합 · 공용 반투명 배경] - 2026-11-03

### Fixed

- **Sheet를 열 때 전체 배경의 검정 반투명 처리 누락**:
  - **Why:** SheetBackdrop의 배경 선언이 `rootSelectors`의 `styles` 밖에 있어 CSS 생성기가 무시했다.
  - catalog 선언을 수정하고 CSS를 재생성하여 공용 `--overlay-backdrop` 토큰을 적용한다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`
- Canvas의 Open Sheet도 페이지 viewport에서 방향별로 정렬하고, 전체 영역에 동일한 검정 50% backdrop을 그린다. Library·Local 원본 본문 편집은 기존 inline 배치를 유지한다.
- Canvas 색상 변환에서 `rgba()` 토큰의 RGB·alpha를 보존한다. flex 재배치에서 백분율 min/max를 원래 부모 기준으로 해석하고, 미해소 백분율 크기의 padding을 중복 계산하지 않아 Sheet 본문 높이가 Preview와 일치한다.

### Changed

- ModalOverlay도 SheetBackdrop과 동일한 `--overlay-backdrop` 토큰을 사용한다. 배경색의 중복 리터럴을 제거하여 토큰 변경 시 두 컴포넌트에 함께 반영하며, 기본 검정 50%는 유지한다.
  - 위치: `packages/shared/src/components/styles/overlays.css`

### Tests

- 실제 catalog rule에서 생성한 SheetBackdrop CSS에 배경색이 포함되는지 회귀 검사한다.
- 방향별 viewport 배치·좁은 화면·Open 반복 전환·Undo·반투명 색상과 Rust flex 제약의 회귀를 검사한다.

## [RAC TokenField · PreviewTrigger · Sheet 추가] - 2026-11-03

### Fixed

- Sheet의 누락된 handle을 Canvas와 CSS에 추가했다. Prevent Dismissal 비활성 시 표시하고 활성 시 숨기며, Swipe Direction에 따른 배치와 치수·색을 공용 정의로 맞췄다. 속성 변경과 Undo도 자식 Sheet에 전파한다.
- Sheet Open을 활성→비활성→활성으로 바꿀 때 자식이 한 지점에 겹치는 문제를 수정했다. Rust 엔진이 `display:none` 서브트리 좌표를 0으로 만들 때 이전 solve 캐시도 무효화하여 재표시 때 자손 레이아웃을 다시 계산한다.
- Sheet 인스턴스의 Property에 Position·Swipe Direction·Snap Points·Prevent Dismissal·Overscroll Padding을 연결했다. Open·Initially Open 변경과 Undo/Redo 시 Canvas 본문의 표시를 재계산하며, 명시적 Open=false가 Initially Open=true보다 우선한다. Library의 원본 본문 견본은 유지한다.

### Added

- Components 패널과 Library에 TokenField, PreviewTrigger, Sheet 원본을 추가했다. PreviewTrigger는 hover·focus·long press로 Popover를 열며, Sheet는 열기 버튼·본문 slot·닫기 버튼과 방향·snap point·닫기 방지 속성을 제공한다.
- TokenField는 일반 텍스트 안의 공백으로 확정한 `@멘션`·`#태그`를 토큰으로 편집한다. 문서에는 문자열을 저장하고 RAC 입력과 Canvas 텍스트 구간은 같은 tokenizer를 사용한다.

### Changed

- 원본 구조 추가에 따라 Library 계약 버전을 55로 올렸다. 기존 개발 문서의 자동 변환은 제공하지 않는다.

## [Packages 데이터 계약·중복 구현·반복 계산 개선] - 2026-11-03

### Fixed

- Collection 보기 캐시가 평가기가 실제 읽은 중첩 참조의 행·schema와 아직 없는 참조 대상을 추적한다. 참조 조회도 공용 snapshot 정책을 사용해 mock fallback·loading·error·빈 성공을 직접 바인딩과 동일하게 처리한다.
- 공용 DOM collection의 기본 데이터 범위에서 Canvas의 100행 표시 상한을 제거했다. TagGroup의 100번째 이후 항목을 표시·검색할 수 있고, ListBox·GridList·TagGroup의 공용 필터는 숫자 `0`과 boolean `false`도 검색한다.

### Changed

- 업로드 큐는 상태 전이에서 활성 개수를 갱신하고 준비된 대기 항목을 처리한다. 자동 시작을 끈 200파일 준비에서 전체 항목 재순회 40,000회를 제거했다.
- 차트 Others 순위는 범주별 점수를 한 번 계산한다. 1,000범주 × 8시리즈 회귀 입력의 값 조회를 133,808회에서 16,000회 이하로 줄이고 순위·합계를 보존한다.
- 차트 마크의 bounds 계산, Toast·SideNav의 모션 감소 설정 구독을 공용화하고 catalog resolver의 상시 진단 로그와 로그용 순회를 제거했다.

## [SideNav 가족 — ADR-300 Phase 4 (팔레트 · Interactions) · Implemented] - 2026-11-03

### Added

- **컴포넌트 패널 Layout 묶음에 side nav panel · side nav** — 패널은 접기 버튼이 있는 사이드바 (폭 240), side nav 는 접기 없이 단독. 넣은 패널의 메뉴 항목은 Layers 에서 바로 고를 수 있고 code view 에도 보인다.
- **Interactions**: 패널 접힘이 바뀔 때 (When) · 패널 접기 · 펴기 · 전환 (Do), side nav 항목 펼침이 바뀔 때 · 항목 펼치기 · 접기.
- **Library 카드 상태 견본**: side nav 의 항목 Current (현재 경로 막대 + 굵게) · Disabled, side nav panel 의 Collapsed (아이콘 줄).
- side nav 의 Aria Label 칸 (RAC NavigationTree 는 이름이 필요).
  - 위치: [docs/adr/completed/300-sidenav-navigation-tree.md](adr/completed/300-sidenav-navigation-tree.md)

### Changed

- 사이드 패널 접기 버튼이 S2 처럼 배경 없는 32 × 32 아이콘 버튼 (전에는 어두운 pill).

### Fixed

- Library 의 Tree 카드 Item 줄이 글자 대신 `{label}` 원문을 보이던 것.

## [첫 텍스트 편집 서식 유지 — ADR-299] - 2026-11-03

### Fixed

- 새로고침·Dashboard 재진입 후 첫 텍스트 더블클릭에서 줄바꿈만 표시되다가 구간 서식이 뒤늦게 적용되는 현상을 수정했다. 텍스트 선택 시 편집기 chunk를 준비하고, 로딩 중 RichText는 원본 서식을 표시하는 읽기 전용 화면을 사용한다. 준비 전 plain 입력으로 구간 서식이 사라지는 경로와 Backspace의 Canvas 삭제 전파도 차단했다.

## [줄별 글자 크기 편집 겹침 수리 — ADR-299] - 2026-11-03

### Fixed

- Enter로 나눈 줄에 서로 다른 글자 크기를 적용할 때 편집 중 글자가 겹치던 문제를 수정했다. Canvas의 px 줄 높이를 편집기 CSS로 옮길 때 원래 비율로 복원해 각 run의 글자 크기에 따라 줄 높이가 계산되도록 했다. Chromium·WebKit에서 16px·64px·24px 다중 줄 회귀를 확인했다.

## [글자 범위 서식 수리 — ADR-299 구현 판독 3건] - 2026-11-02

### Fixed

- Typography·portal에서 Tab으로 편집 범위를 나가면 텍스트 편집을 한 번 커밋한다. 범위 전체의 focus 이탈을 document capture에서 처리한다.
- RichText의 첫 줄 baseline은 측정한 첫 줄에서만 계산하고, 폭 변경 후 줄바꿈 측정의 baseline도 엔진 입력에 전달한다. 뒤쪽 줄의 큰 글자가 첫 줄 정렬을 바꾸지 않는다.
- Canvas 장식선 두께를 Chrome의 device pixel 내림 처리와 맞췄다. G2는 실제 Preview의 transform 확대 방식과 절대 오차 0.5px 기준을 사용하며, 첫 편집 진입 시간을 production 빌드에서 기록했다.

## [SideNav 가족 — ADR-300 Phase 3 (Canvas)] - 2026-11-03

### Added

- **SideNav · SideNavPanel 을 Canvas 에서도 Preview 와 같은 모양으로 그린다** — 행 높이 · 들여쓰기 · 아이콘 간격, 현재 경로 행은 굵게 + 왼쪽 막대 (`selectedRoute` 를 비우면 그 page 의 경로), 펼친 항목의 chevron 은 아래로, 접은 패널은 아이콘 줄 (폭 42 — 글자 · 머리 · 하위 숨김). 행 글자는 행의 크기 · 굵기 · 색을 따르고 (글자에 색을 직접 주면 색만 그 값).
  - 위치: [docs/adr/completed/300-sidenav-navigation-tree.md](adr/completed/300-sidenav-navigation-tree.md)

### Fixed

- Preview 에서 SideNav 펼침 chevron 이 행 색이 아니라 기본 글자색 (또는 흰색) 으로 그려지던 것 — S2 처럼 행 색을 따른다.

### Changed

- 첫 화면 번들 상한 (ADR-201) Builder 1,410,000 → 1,414,000 B 재승인 (만료 2026-11-25 그대로) — SideNav Canvas 그리기는 첫 화면 동기 경로라 lazy 로 뺄 수 없다 (Builder 1,410,880).

## [SideNav 가족 — ADR-300 Phase 2 (Preview DOM)] - 2026-11-02

### Added

- **SideNav · SideNavPanel 을 Preview · Publish 에서 그린다** — RAC `NavigationTree` 그대로 (화살표 이동 · 펼침 · 링크 Enter 이동 · 링크 없는 부모 행 Enter 펼침). 현재 경로 행은 굵게 + 막대, `selectedRoute` 를 비우면 보고 있는 page 경로를 쓴다. 접기 버튼은 S2 처럼 아이콘 줄 (폭 42) 로 접고, 접힌 동안 하위 행은 닫힌다 (펼친 키는 남아 다시 펴면 돌아온다). 애니메이션은 S2 값 (패널 폭 200 ms · 행 펼침 view transition, 움직임 줄이기 설정이면 끔). Canvas 그리기 · 팔레트 노출은 다음 Phase.
  - 첫 화면 번들: SideNav DOM 부품은 처음 쓰일 때 받는 chunk (Builder initial 상한 안 — 1,409,737 / 1,410,000).
  - 배포: GitHub Actions 배포가 build 뒤 initial 번들 상한 (ADR-201) 을 넘으면 실패한다.
  - 위치: [docs/adr/completed/300-sidenav-navigation-tree.md](adr/completed/300-sidenav-navigation-tree.md)

## [SideNav 가족 — ADR-300 Phase 0 · 1 (문서 · catalog · contract 54)] - 2026-11-02

### Changed

- **문서 contract 53 → 54** — S2 SideNav 가족 7 type (`SideNavPanel` · `SideNav` · `SideNavItem` · `SideNavItemContent` · `SideNavItemLink` · `SideNavSection` · `SideNavHeader`) 과 origin 3 을 등록했다. 53 문서는 거부 (변환 없음, 개발 단계 정책). 샘플 프로젝트 파일 3 은 번호만 올림. 팔레트 노출 · Preview · Canvas 그리기는 다음 Phase.
  - 접힌 패널 (S2 아이콘 줄) 의 상태가 자손 rule 에 닿는 길: 조건 `isCollapsed` · `isCurrent` (생성 CSS 는 S2 와 같은 `[data-side-panel-collapsed]` 조상 선택자) · 파생 값 · 숨김 · 증분 dependents — `packages/shared/src/catalog/runtime/sideNav.ts`.
  - 위치: [docs/adr/completed/300-sidenav-navigation-tree.md](adr/completed/300-sidenav-navigation-tree.md)

## [글자 범위 서식 — ADR-299 Implemented] - 2026-11-02

### Changed

- **ADR-299 Implemented** — 글자 노드 하나 안의 구간 서식 (굵기 · 기울임 · 장식선 · 색 · 크기). 문서 형 `RichText` (contract 53) → Canvas · Preview · 측정 · ProseMirror 편집 상자 · Design 패널 · 코드 보기. 구현 `b0d1e77e4`.
  - G5 ratchet: 등급 A 카운트가 직전 커밋 (299 이전) 과 같은 값 — 299 몫 0. 상한과 현재 값의 차이는 299 이전부터 있던 것 (상한 기록 `85363daa6`).
  - live: Chrome MCP 13 시나리오 (결함 5 수리) + native macOS 한글 입력기 사용자 확인.
  - 위치: [docs/adr/completed/299-text-range-formatting-runs.md](adr/completed/299-text-range-formatting-runs.md)

## [글자 범위 서식 — ADR-299 Phase 3 (편집 · 패널 · 코드 보기) · Phase 4 live] - 2026-11-02

### Added

- **글자 일부에 서식**: 글자 편집 상자가 ProseMirror 로 바뀌었다 (편집에 들어갈 때 불러온다 — 첫 화면 번들 0). 선택한 글자에 ⌘B · ⌘I · ⌘U, Design 패널 Typography 의 굵기 · 크기 · 색 · 기울임 · 장식선이 선택한 글자에만 들어간다 — 패널 · 색 팝오버를 눌러도 편집과 선택이 유지되고, 캔버스 · 다른 곳을 누르면 한 번에 커밋 (History 한 단계). 편집 중 ⌘Z 는 편집 상자 안의 되돌리기. `{{ 변수 }}` 일부를 고르면 토큰 전체에 서식. 붙여넣기는 글자만.
- **편집 밖 패널**: 일부만 서식이 있는 축은 「Mixed」 로 보이고, 그 축을 바꾸면 글자 전체가 그 값 (구간의 그 축 서식은 지워짐 — Figma 와 같다).
- **코드 보기**: 구간이 `<span style={{ fontWeight: 700 }}>…</span>` 로 보이고, 코드에서 고치면 문서로 돌아간다 (다섯 키 밖 · 다른 JSX 는 거절).
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/{CatalogTextEditor.tsx,textEditor/}` · `catalogRuntime/{textEditorHandle,canvasText,codeViewEdit}.ts` · `panels/styles/{sections/TypographySection.tsx,catalog/catalogStylesHost.ts}` · `packages/shared/src/codeView/{generate.ts,inverse/parse.ts}`

### Fixed

- 구간 서식 글자를 문자열로 되돌린 뒤 (⌘Z · 코드 보기 · AI 쓰기) Canvas 가 옛 구간 서식을 그리던 결함 — 증분 rebuild 가 이전 record 의 `textRuns` 를 이어받았다 (live 발견).
- Properties 의 글자 칸이 구간 서식 글자를 `[object Object]` 로 보이던 결함 — plain 글자를 보인다 (거기서 쓰면 서식이 초기화된다).
- **Typography 초기화 · 원래 값으로 되돌려도 구간이 남던 결함** (사용자 보고): 초기화가 노드 값만 지워 구간 서식이 Preview DOM 의 `span > span` 으로 남았고, 편집 중 구간 값을 노드와 같은 값으로 되돌려도 그 값이 구간으로 남았다. 이제 초기화는 그 섹션 축의 구간 서식까지 지우고 (구간만 서식이 있어도 초기화 버튼이 보인다), 노드와 같은 값은 구간 서식을 지운다 — 남는 것이 없으면 글자가 다시 문자열이다.
  - **Why**: 초기화는 `catalogResetStyleWrites` (노드 field) 만 썼고 결정 3 의 구간 정리는 `styleCommandOf` 에만 있었다.
  - 위치: `apps/builder/src/builder/panels/styles/catalog/catalogStylesHost.ts` (`resetStyles` · `useDirtyStyleProps`) · `workspace/canvas/catalog/textEditor/EditorField.tsx` (`sameAsNode`)
- **첫 편집의 첫 글자 유실**: 새로고침 뒤 첫 편집에서 편집기를 받는 동안 친 글자를, 편집기가 열리면서 전체 선택해 다음 글자가 덮었다 — 편집기는 대체 입력 상자의 caret 위치로 열린다.

### Tests

- G4 `apps/builder/tests/text-edit/adr299EditorField.browser.test.tsx` Chrome · WebKit 20 (실제 키 · 클릭 — 노드 값으로 되돌림 · 대체 입력 caret 포함) · 원복 RED 4 · `adr299CodeView.test.tsx` 4 · 결정 3 host 1 · 초기화 host 1 · 회귀 1 (+ 원복 RED). 편집 상자 textarea 테스트 2 파일은 편집기 chunk 를 대기로 고정.
- 번들: Builder +1,961 (누적 1,405,808 ≤ 1,410,000) · Preview 0 · 편집기 chunk 58,213 B (initial 밖).

## [글자 범위 서식 — ADR-299 Phase 2 (Canvas · Preview · 측정)] - 2026-11-02

### Added

- **구간 서식 글자를 Canvas 와 Preview 가 같이 그린다**: 레이아웃 측정과 Canvas paragraph 는 run 마다 자기 굵기 · 기울임 · 크기 · 색으로 (`pushStyle`), Preview · Publish 는 run 마다 `<span>` (서식 값만, 토큰은 변수 — `<strong>` · `<em>` 을 쓰지 않아 접근성 의미 무변경). 큰 run 이 있는 줄은 CSS 줄 상자처럼 높아지고, 글자의 baseline 은 strut 과 run 줄 상자 중 가장 낮은 것. 구간 장식선은 run 의 글리프 구간마다 run 색 · 크기로 그린다.
  - **장식선 규칙**: 노드 자신의 장식선은 run 으로 옮긴다 (`none` 인 run 은 실제로 밑줄 없음). 물려받은 장식선 (조상의 값 — DOM 은 글자 요소에 inline 으로 받는다) 은 run 이 지우지 못하고 모든 run 아래 글자 색으로 — Canvas · DOM 같음. Link 의 rule 밑줄도 run 아래 선이고, 작성한 `none` 이 그것을 끈다.
  - 위치: `packages/shared/src/catalog/runtime/{textRunStyles,textRunsDom,compositionRoot,domBinding.runtime}.ts` · `apps/builder/src/builder/catalogRuntime/{textMeasure,textMeasureCache,canvasBinding}.ts` · `apps/builder/src/builder/workspace/canvas/skia/{nodeRendererText,nodeRendererTypes,textParagraphKey}.ts` · `utils/textRunAlign.ts`

### Tests

- G2 `apps/builder/tests/adr248-g3/adr299RichTextParity.browser.test.ts` — fixture 8 (굵기 · 색 · 크기 섞임 1줄 · wrap · 장식선 구간 · 템플릿 · 노드 밑줄 + run none · 조상 밑줄 + run none) 를 500 % 로 Canvas raster ↔ DOM 스크린샷: 잉크 차 ≤ 3 device px (대조 arm 2) · 줄 수 동일 · 엔진 상자 = DOM 상자. 원복 RED 4.
- 번들: Builder +1,946 B (누적 1,403,847) · Preview +1.

## [글자 범위 서식 — ADR-299 Phase 0 · 1 (문서 형 · contract 53)] - 2026-11-02

### Added

- **글자 노드의 `children` 이 구간 서식을 담는다 (`RichText`)**: `{ kind: "text", runs: [{ text, marks? }] }` — mark 는 굵기 · 기울임 · 장식선 · 색 · 크기 다섯 (사용자 결정 1, 노드 visual 과 같은 값 형 — 리터럴 · 토큰 참조). 대상은 Text · Paragraph · Heading · Link 의 자기 `children` 뿐이고 부모 prop 에 묶인 글자 (`label` · `title`) 는 문자열 그대로 (`RICH_TEXT_NOT_ALLOWED`). 정규형 · 읽기 · 구간 쓰기는 `packages/shared/src/catalog/document/textRuns.ts` 하나 — 빈 run · 합칠 이웃 없음, mark 없는 글자는 **문자열로 저장** (저장 모양 무변경).
  - **템플릿 토큰은 원자다**: `{{ … }}` · `\{{` · 행 필드 `{ … }` 안에는 run 경계가 오지 않는다 — 구간 쓰기는 토큰 밖으로 넓히고, 타이핑으로 생긴 경계는 토큰 첫 글자의 서식으로 맞춘다. 그래서 변수 해석 · 참조 수집 · 이름 변경이 run 마다 지금 함수 그대로이고 같은 글자의 문자열 값과 결과가 같다.
  - record 는 `props.children` 에 plain 글자, `textRuns` 에 그릴 run (템플릿 · mark 토큰 해석) 을 싣는다 — `String(children)` 을 읽는 소비자 41 파일은 그대로다. 그리는 곳 (Canvas · DOM) 은 Phase 2.
- **편집 입력 하니스 (G0)**: ProseMirror `EditorView` 안 한글 조합 (「한글」 · 「됐다」 · 전체 선택 위 · 줄바꿈 뒤 · 조합 중 Escape) 이 조합 중 상자가 자라도 끊기지 않음을 Chrome (CDP IME) · WebKit (합성 조합 순서) 에서 확인 — vitest project `text-edit`. 대조 arm (글자 DOM 교체) 은 두 브라우저 모두 깨짐.

### Changed

- **문서 contract 52 → 53** — 52 문서는 거부 (변환 없음, 개발 단계 정책). 샘플 프로젝트 파일 3 은 모양이 같아 번호만 올림.
- **ADR-201 initial 번들 상한 Builder 1,400,000 → 1,410,000 재승인** (ADR-299 사용자 결정 5 — 착수 HEAD 가 이미 1,400,437). Preview 325,000 무변경. Phase 1 몫 Builder +1,464 · Preview +40 B gz.
- 의존성: `prosemirror-model` 1.25.12 · `state` 1.4.4 · `transform` 1.12.2 · `view` 1.42.6 · `keymap` 1.2.3 (MIT, 편집 진입 때 lazy — Phase 3 배선 전 import 0).

### Tests

- `adr299TextRuns.test.ts` 14 (정규형 · 토큰 원자 · 해석 · 참조 · 이름 변경 · 검증 · contract) · `adr299TextRunsRecord.test.ts` 3 · 원복 RED 2 (정규형 제거 5 FAIL · 토큰 넓힘 제거 4 FAIL).

## [테마 전환 중복 처리 제거 — ADR-295 Phase 4 성능 후속] - 2026-11-02

### Performance

- **테마 전환의 문서 전체 처리를 2회에서 1회로 축소**: 새 토큰으로 root를 transaction consumer에서 만들고, 같은 글자·폰트·줄바꿈·폭의 측정 결과는 workspace 안에서 재사용한다. 캐시는 2,048개로 제한하며 폰트 갱신 때 비운다.
  - **Why**: 활성 테마 ID 변경을 project 구조 변경으로 처리한 뒤 같은 명령에서 root를 다시 생성하고 텍스트를 재측정했다.
  - 600요소 production 합성 fixture, headed Chromium·DPR1·CPU1x, 전후 3쌍 교대: 동기 실행 중앙값 `62.3~63.35 → 16.45~17.4ms`, 첫 rAF까지 중앙값 `66.05~66.9 → 22.75~22.95ms`. 최종 paint 완료나 모든 전환의 25ms 이내를 증명하는 수치는 아니다.
  - 위치: `apps/builder/src/builder/catalogRuntime/workspace.ts`, `textMeasureCache.ts`, `packages/shared/src/catalog/runtime/{controller,compositionRoot}.ts`

### Fixed

- 새 테마 root 생성 실패 시 graph·토큰·이전 root·geometry를 함께 원복하며 history·저장 대기열·구독자에는 실패한 전환을 발행하지 않는다. root 구독자 오류는 커밋 뒤 수집하고 다른 구독자도 계속 호출한다.

### Tests

- 전환·Undo/Redo·복합 편집·IndexedDB 저장·원복·폰트 캐시 무효화 회귀와 `theme-switch` ratchet 호출 수 게이트를 추가했다.

## [Button outline 두께 정합성 — S2 borderWidth] - 2026-11-02

### Fixed

- **Button의 outline 테두리를 S2 기준 2px로 수정**: fill은 0px, premium·genai 및 field 소유 버튼은 0px을 사용한다. 테두리 두께에 맞춰 세로 padding을 계산해 크기별 높이와 글자 중심을 Canvas·Preview에서 유지한다. 사용자가 지정한 border·padding은 우선한다.
  - **Why**: 모든 fillStyle에 1px 크기 토큰을 적용하고 조건별 두께를 빠뜨렸다. catalog 조건 트리를 생성 CSS와 typed definition이 함께 읽도록 수정했다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`, `packages/shared/src/catalog/document/codeCatalogLibrary.ts`

## [날짜 선택기 정밀도 보존 — 시간대·초·소수초] - 2026-11-02

### Fixed

- 변수 격자·Design State·데이터 격자·RowForm에서 날짜를 편집해도 원래 시간대와 초·소수초를 유지한다. 선택기는 저장된 시간대의 시각을 표시하며, 분만 고치면 나머지 정보는 그대로 저장한다.
- 시간대 표기와 ISO 원문 편집을 같은 입력기에서 제공한다. native 선택기가 표현하기 어려운 세밀한 값은 원문으로 편집하며, 서머타임의 존재하지 않거나 offset으로 구분되지 않은 시각은 자동 이동하지 않고 검증 오류로 표시한다.
- DatePicker·DateField·DateRangePicker가 시간대 없는 날짜시각을 날짜 전용 파서로 읽어 실패하던 오류를 수정했다. 달력에서 날짜를 고른 뒤 `2026-11-06T00:00:00` 같은 값도 초 단위까지 정상적으로 다시 표시한다.
- **Why**: 선택기용 문자열을 분 단위로 자르고 그 문자열을 저장해 시간대·정밀도가 사라졌다. 공통 투영·병합 경로를 두고 기존 catalog 명령·Undo·IndexedDB 저장 경로를 유지한다.

## [Hook 억제 원인 수리 — 편집기 설정·Table 요청·단축키 구독] - 2026-11-02

### Fixed

- Code View의 자동완성 후보·접근성 이름·편집 설정을 최신 입력과 동기화하면서 입력 내용과 Undo 기록을 유지한다.
- 비동기 Table은 서비스·매핑·요청 인자가 바뀌면 다시 조회하며, 취소되거나 교체된 요청의 늦은 응답은 적용하지 않는다. 무한 스크롤 요청에도 사용자 인자를 전달한다.
- 테이블 생성기의 파일 오류 안내는 언어 변경 후 현재 언어로 표시한다.

### Changed

- 단축키 Hook은 별도 의존성 배열 없이 최신 commit의 handler를 실행하고, 등록 메타데이터 변경 시에만 재등록한다.
- 변수 이름 공급 Hook을 필수 계약으로 만들고, picker의 열기 시점 목록은 명시적인 snapshot으로 보관한다. I18n Context를 컴포넌트 모듈에서 분리하고 불필요한 억제 주석을 제거한다.

## [Canvas 한 줄에 놓인 inline 상자의 세로 자리 — Preview 와 같은 baseline · strut · middle] - 2026-11-02

### Fixed

- **block 안 같은 줄의 Button 옆 Badge 가 Canvas 에서만 3.75px 아래에 놓이던 것** (Compare Mode: CSS y 24.24 · Canvas 28 → 24.25). **Why**: 엔진은 inline 상자를 글자 baseline 으로 줄에 맞추는 입력 (`leafBaseline` · 컨테이너 strut `lineHeight` · `strutBaseline`) 을 받지만, 그 값을 넣던 옛 TS 레이아웃 파이프라인 (`fullTreeLayout`, 2026-09-26) 이 2026-10-05 삭제될 때 catalog `styleOf` 로 옮겨지지 않았다 — baseline 이 없는 상자는 바닥으로 정렬된다 (CSS 2.1 §10.8.1 폴백). `styleOf` (`compositionRoot.ts`) 가 글자 leaf 의 첫 줄 baseline 과 flow 컨테이너의 strut 을 다시 싣는다. strut 의 글자 크기 · 굵기는 CSS 처럼 상속한다 — DOM 이 그 상자에 쓰는 값 (저작 값 · 생성 시트의 크기 값) 이 없으면 가장 가까운 조상의 것 (`domFont` — frame 의 rule 기본 16 은 DOM 에 쓰이지 않아 상속을 끊지 않는다). 글꼴 값은 Canvas 가 그리는 CanvasKit Pretendard 에서 읽는다 (`catalogTextMeasure.fontBox`) — builder 문서의 Canvas 2D 는 글꼴 로딩 전 대체 글꼴 값을 줘 0.5px 가 남았다.
- **Button 의 `vertical-align: middle` 이 Canvas 에 없던 것** — 수동 `Button.css` 에만 있어 엔진은 Button 을 baseline 으로 놓았다. Button rule 의 root 상자 (`containerStyles.verticalAlign`) 로 옮겨 생성 CSS 와 엔진이 같은 값을 읽는다. 엔진의 `middle` 은 x-height 를 0 으로 두었다 — 부모 글꼴의 x-height 입력 (`strutXHeight`, Rust `NodeStyle` 58 필드) 으로 margin box 중심을 baseline 위 x-height/2 에 둔다 (`block.rs` `line_metrics`).

## [Canvas 글자 세로 자리 · 글자 편집 상자 테두리 — Preview 와 같은 줄 상자] - 2026-11-02

### Fixed

- **Canvas 의 글자가 Preview 보다 0.5px 아래에 그려지던 것** (줄 높이를 지정한 글자 — 16px · 줄 20 · 22 등) — 상자 안 세로 가운데가 Preview · 편집 상자와 달랐다 (사용자 보고: 테두리 있는 Text, Compare Mode 에서 CSS 와 편집 상자는 같고 Canvas 만 다름). **Why**: SkParagraph 는 줄의 baseline 을 문단 안에서 정수 px 로 반올림해 그린다 (보고 15.6875 → 그림 16, CanvasKit raster 실측). Chrome 의 줄 상자는 글꼴 ascent · descent 를 먼저 반올림하고 남은 leading 을 반씩 나눈다 (15 + (20 − 19) / 2 = 15.5). Canvas 가 CSS 줄 상자의 baseline 자리로 문단을 옮긴다 (`textGlyphCentering.ts` `resolveCssBaselineCorrection` → `nodeRendererText.ts` `computeDrawY`, DOM 글꼴 값은 `textMeasure.ts` `measureFontBox`).

- **Badge 처럼 위아래 여백 안에 한 줄로 놓인 글자가 g · y · p 같은 글자를 넣으면 위로 올라가던 것** — 같은 글자의 Button 보다 높았고 (사용자 보고: 가이드라인 대조), 더블클릭 편집을 열면 글자가 위아래로 움직였다. **Why**: Canvas 만 그 한 줄을 글리프 잉크 기준으로 가운데 놓았다 (`resolveSingleLineGlyphTop`, ADR-027 D3 2026-09-20) — 아래로 내려가는 글자가 잉크를 늘려 글자 전체가 올라갔다. Preview (CSS) 는 줄 상자로 가운데 놓는다. Canvas 도 줄 상자로 (`nodeRendererText.ts` `computeDrawY`) — 잉크 측정 (`measureActualTextBounds`) 은 쓰는 곳이 없어 지웠다. Compare Mode 에서 Badge "gButton" · "Button" 의 글자 세로 중심이 CSS · Canvas 같다.

- **Canvas 글자가 자간을 넣으면 자간 절반만큼 오른쪽에 그려지던 것** — SkParagraph 는 자간을 글자 앞뒤로 반씩, CSS 는 뒤에만 둔다 (자간 4 → 첫 글자 2px 늦음, CanvasKit raster 실측). 문단을 그 절반만큼 당겨 그린다 (`textDecorationGeometry.ts` `cssLetterSpacingShift` → `nodeRendererText.ts`).

- **Canvas 의 밑줄 · 윗줄 · 취소선이 Preview 보다 얇고 다른 자리에 그려지던 것** — SkParagraph 는 글꼴의 밑줄 메트릭 (16px: 두께 1.1 · baseline 아래 1.15), Chrome 은 자기 규칙 (두께 = 글자 크기 / 10 을 device px 로, 밑줄 baseline + max(1, ⌈두께/2⌉), 윗줄 ascent 위, 취소선 ascent 의 1/3 위 — Chrome 156 실측) 을 쓴다. Canvas 가 장식선을 SkParagraph 에 맡기지 않고 그 규칙으로 직접 그린다 (`resolveCssDecorationLines` → `drawCssDecorations`, 점선 · 파선 · 이중선 · 물결 포함). Compare Mode 에서 밑줄 행 · 길이가 CSS 와 같다.

- **Badge 글자가 Canvas 에서만 가늘던 것** (Canvas 500 · Preview 600) — Canvas 글자 shape 가 굵기를 style → variant `textWeight` → 500 으로만 골라 rule 크기 (sizes) 의 `fontWeight` 를 건너뛰었다. 생성 CSS 가 쓰는 그 값을 읽는다 (`packages/rendering/src/renderers/buildCatalogShapes.ts`). sizes 에 굵기를 둔 다른 컴포넌트도 같이 맞는다.

- 더블클릭 편집 상자의 글자 모양이 Canvas · Preview 와 다르던 것 (예: "a" 가 두 층 모양) — 편집 상자가 Pretendard 대체 글리프 (`cv02` · `cv03` · `cv04` · `cv11`, `cv11` = 한 층 a) 를 켜지 않았다. **Why**: Skia 는 모든 글자에 `DEFAULT_FONT_FEATURES` 를, Preview 는 body `font-feature-settings` 를 쓰는데, ADR-248 catalog 편집기가 옛 편집 오버레이 (ADR-027 D3) 의 이 값을 옮기지 않았다 (`CatalogTextEditor.tsx` `fontFeatureSettings`). 같은 이유로 빠져 있던 나머지 글자 설정 — 기울임 · 자간 · 단어 간격 · 밑줄 등 장식 (선 · 모양 · 색) · 줄바꿈 (word-break · overflow-wrap) · 들여쓰기 · font-variant · font-stretch · 글자 그림자 · 대소문자 — 도 편집 상자가 Skia 가 그리는 값 (`resolveTextEditBox` `source`) 그대로 쓴다.

- 더블클릭 글자 편집 상자의 파란 테두리가 확대 (예: 500%) 에서 selection box (화면 1px) 보다 굵게 (2.5px) 보이던 것 — 이제 어느 확대에서도 화면 1px. 원인: Chrome 이 `outline-width` 를 transform 전에 최소 1 device pixel 로 올린다 (0.2px → DPR 2 에서 0.5px, scale(5) 뒤 2.5px). 테두리를 반올림하지 않는 `box-shadow` spread 로 그린다 (`CatalogTextEditor.tsx`).

## [그라데이션 버튼의 사용자 테두리 보존 — ADR-297 리뷰 수리] - 2026-11-02

### Fixed

- genai·premium Button에 지정한 테두리가 Canvas에서 그라데이션에 가려지지 않는다. 그라데이션을 box 배경층으로 옮겨 테두리·inset shadow·콘텐츠 아래에서 그린다.
- 여러 배경층을 합성할 때 이전 단색의 투명도가 다음 그라데이션에 중복 적용되지 않도록 각 층의 alpha를 독립 적용한다.

### Tests

- CanvasKit 실제 렌더 명령으로 두 variant의 기본·hover·pressed 테두리와 둥근 모서리·콘텐츠, 반투명 배경층 합성을 검사한다. Chromium Canvas·Preview 비교에도 authored 테두리 사례를 추가했다.

## [토큰 scrub 미리보기 복원 — ADR-298 리뷰 수리] - 2026-11-02

### Fixed

- Design 패널의 토큰 단계 scrub이 Canvas에 즉시 반영된다. 취소·원점 복귀·pointer capture 해제는 예약된 RAF와 미리보기를 종료해 문서 값으로 복원한다. 놓을 때만 TokenUse를 한 번 저장하며 Undo도 한 단계로 유지한다.
- 미리보기 길이·행간은 현재 테마의 토큰 값과 필드 단위로 해석한다. 글자 크기 토큰의 auto 행간도 commit과 같은 짝을 따른다.

### Tests

- 실제 PropertyUnitInput·Styles host·CatalogWorkspace·WASM consumer 통합: 단계 미리보기, 자유값 취소/원점 복귀, capture 해제, RAF 취소, TokenUse commit/Undo 및 행간 비율.

## [ADR-297 후속 ⑥ — premium · genai Button 그라데이션을 S2 대로, Canvas 와 Preview 가 같이] - 2026-11-02

### Fixed

- **genai Button 이 Canvas 에서는 보라 단색, Preview 에서는 다른 2 색 그라데이션이던 것** — 이제 두 화면 모두 S2 의 3 색 그라데이션 (빨강 → 자홍 → 남색, hover · pressed 에서 한 단 진하게, disabled 는 회색 바탕에 그림 없음) 을 그린다. **premium 도 S2 대로** 보라 단색에서 자홍 → 남색 → 파랑 그라데이션으로 바뀌었다 (S2 에서 같은 요소 · 같은 규칙). outline 은 fill 과 같은 모양, 테두리 없음, static 색에서도 그라데이션이 남는다 (S2 와 같다).
- 이 Button 에 Fill 을 직접 주면 그 색이 바탕이 되고 그라데이션은 그리지 않는다 (두 화면 같음).
  - **Why**: 칠 조건 트리 (ADR-297) 의 leaf 가 색만 받아 그라데이션을 담을 수 없었다 — Canvas 는 트리의 단색, Preview 는 수동 `Button.css` 의 손으로 적은 2 색이었다. 트리에 그림 칠 축 (`paint.backgroundImage`, 값 = S2 `linearGradient` 와 같은 모양) 을 더해 생성 CSS 는 `background-image` 로, Canvas 는 바탕 위 그라데이션 상자로 같은 트리를 읽는다. 정지점 색은 설치 S2 의 빌드 CSS 값 (light 고정 — S2 `colorScheme: 'light'`).
  - 위치: `packages/shared/src/catalog/rule/rulePaintTree.ts` · `generated/componentRulesTable.ts` (`gradientButtonPaint`) · `packages/rendering/scripts/generate-css.ts` · `document/codeCatalogLibrary.ts` · `apps/builder/src/builder/catalogRuntime/authoredPaintCanvas.ts` · `canvasBinding.ts` · `runtime/domBinding.runtime.ts` · 수동 `Button.css` 블록 삭제 · 테스트 `adr297GradientButton.test.ts` · 하니스 `adr297RealPaintParity` (550 비교 · 불일치 0)

## [Design 패널 숫자 칸 — ↑ 로 값을 올린 뒤 Tab 을 치면 단계 목록의 항목이 저장되던 것] - 2026-11-02

### Fixed

- **단계 메뉴가 있는 칸 (Gap · Padding · Radius · Border Width · Font Size · Position …) 에서 ↑/↓ 로 숫자를 바꾼 뒤 Tab 을 치면, 친 숫자 대신 보이지 않는 목록의 항목이 저장되던 것** — 예: Gap 0 에서 ↑ 세 번 + Tab 은 3 이 아니라 M (12), ↑ 서른 번 + Tab 은 Reset 이 골라져 값이 지워졌다. Enter 로 확정하면 정상이었다. 이제 닫힌 칸의 ↑/↓ 는 숫자만 바꾸고, ▾ 로 목록을 연 동안에는 ↑/↓ 가 목록 항목을 옮긴다.
  - **Why**: 칸이 쓰는 RAC ComboBox 가 ↑/↓ 에서 닫힌 목록을 열고 그 안의 포커스를 옮겼고, Tab 은 열린 목록의 포커스 항목을 확정한다 — 칸의 숫자 stepper 가 키를 막지 않아 둘이 함께 돌았다. ADR-298 이전부터 있던 결함 (`dd7a12602` 에서도 재현).
  - 위치: `apps/builder/src/builder/components/property/PropertyUnitInput.components.tsx` (`handleKeyDown`) · 회귀 테스트 `PropertyUnitInput.test.tsx` 2

## [ADR-298 Implemented — Design 패널 시안 맞춤 (Border 두 줄 · auto 행간 · Theme 서체 · 그림자 한 줄) · 번들 상한 재승인] - 2026-11-02

### Changed

- **Style 탭 Border 가 `Width | Color` · `Style | Sides` 두 줄이 됐다 (ADR-298 Phase 5 — 토큰 모델 A 시안)** — 전에는 Width · Style | Color · Sides 세 줄. Sides 5 버튼은 반 칸 폭을 나눠 쓴다.
  - **Text 탭 Line Height** 가 비어 있고 Font Size 가 단계 (본문 · 제목) 이면 「auto」 칩 옆에 그 단계의 짝 행간 px 를 보인다 (예: 제목 M = auto 26). 전에는 「auto」 글자만.
  - **Text 탭 Font** 에 서체를 고르지 않았으면 「Theme」 칩 + 실제로 쓰이는 서체 이름이 보인다 — 테마의 기본 서체를 따르는 상태. 목록 맨 위 「Theme」 을 고르면 고른 서체를 지우고 테마 서체로 돌아간다.
  - **Box Shadow** 를 단계 (S · M · L) 로 골랐으면 칩 + 요약 한 줄 (「S 0 2 8 · 8%」) 로 보인다. − 는 그림자 전체를 지우고, inset 토글은 모든 레이어에 걸린다. 레이어를 고치면 전처럼 레이어마다 한 행.
  - **Why**: 토큰 모델 A 시안 3 장 (`docs/design/styles-token-model/`) 과 대조해 남은 차이 4 건 — 사용자 결정 「4건 모두 298 에서」.
  - 위치: `panels/styles/sections/BorderSection.tsx` · `TypographySection.tsx` · `EffectSection.tsx` · `components/BoxShadowLayerRow.tsx` · `hooks/useTypographyValues.ts` · `panels/fonts/FontFamilyPicker.tsx` · `components/property/PropertyUnitInput.*` · `components/styles/{inspector-layout,form-controls}.css`
- **ADR-201 initial 번들 상한 재승인 — Builder ≤ 1,400,000 · Preview ≤ 325,000 B gzip (만료 2026-11-25 유지)** — 사용자 결정 「상한 재승인」. ADR-298 몫 Builder +4,577 · Preview +64 (Phase 0 ~ 4) · Phase 5 +326 · −1,375. 착수 시점 여유가 871 B 뿐이었고 같은 구간 ADR-297 몫 (+3,064 · +3,076) 과 합쳐 옛 상한 (1,390,000 · 320,000) 을 넘었다. `apps/builder/scripts/adr201-bundle-gate.mjs` 상수 · CLAUDE.md 표.

### Removed

- **옛 DOM 그림자 · fill 변환 진입점 `adaptElementStyle` (호출 0)** — DOM 은 `catalogAuthoredDomStyle` 이 그림자 preset 리터럴을 변수로 바꾼다 (ADR-298 결정 7). Preview initial 번들 −1,375 B. 읽는 쪽 그림자 역매핑 (Canvas · DOM) 은 298 전에 저장된 리터럴 때문에 유지한다.

### Verified

- ADR-298 G5 — 패널 입력 프레임 p95 (production harness · 3 회): scrub · ↑ · preset 메뉴 모두 idle 바닥 + 0.5 ms 안 · 프레임 누락 0 (대조 arm 47.3 ms). live (5178 Playwright · 저장 인증 세션) 41/41 · 콘솔 0 — 메뉴로 Border · Radius · Shadow · Gap · Font Size → 테마 radius · dark · 터치 보기 · Code · 새로고침 · 시안 4.
- 문서: `docs/adr/completed/298-node-token-reference-panel-token-first.md` (Implemented) · breakdown §6.5 · ADR-201 재승인 절

## [ADR-297 후속 — Canvas 와 Preview 가 다르게 칠하던 8 컴포넌트 (GridList · Table 머리글 · Checkbox · Radio · Tree · Image · Toolbar 구분선 · Tabs · Pagination)] - 2026-11-02

### Fixed

- **Checkbox · Radio 를 색 바탕 위에 두면 Preview 에서만 컨트롤 전체 뒤에 흰 상자가 보이던 것** — 상자 바탕을 루트가 아니라 체크 상자 · 고리에 칠한다 (Canvas 와 같은 자리). Radio 고리 안쪽은 dark 에서도 테마 바탕.
- **Canvas 에서 GridList 상자 (흰 바탕 · 테두리) 와 Table 머리글 바탕이 빠지던 것** — Preview 가 그리던 part rule 값을 Canvas 도 그린다.
- **Preview 의 Pagination 쪽 버튼이 전부 회색이던 것** — 현재 쪽 accent · 나머지 outline (Canvas · template 값). 노드 트리 전 renderer 의 선택자가 남아 Button 칠을 덮고 있었다.
- **Tree 바탕** — Canvas 흰색 · Preview 회색 → 둘 다 투명 (S2 TreeView). **Image** placeholder 회색을 Preview 도 칠한다 (투명 이미지 뒤). **Toolbar 구분선** 색을 Canvas 와 같게. **Tabs** 비선택 탭 글자가 Preview 에서도 옅은 색 (S2).
  - **Why**: ADR-297 Phase 3 닫힘 때 남긴 LOW 목록 (실제 노드 트리 대조 28 행) — 남은 것은 genai 그라데이션 2 행 (rule 칠 형식이 그라데이션을 아직 담지 못한다).
  - 위치: `packages/shared/src/catalog/runtime/rulePaint.ts` · `packages/rendering/src/renderers/CSSGenerator.ts` · `packages/rendering/scripts/generate-css.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/catalog/runtime/domBinding.runtime.ts` · `Tree.css` · 게이트 `apps/builder/tests/parity/adr297RealPaintParity.browser.test.ts`

## [ADR-297 Implemented — rule 상태 칠은 조건 트리 하나 (Canvas · Preview 가 같은 순서로 읽는다)] - 2026-11-02

### Changed

- **컴포넌트의 상태 칠 (hover · pressed · selected · 강조 · quiet · fillStyle · staticColor · disabled · invalid) 이 rule 의 조건 트리 하나다 (ADR-297 Implemented)** — Canvas 는 트리를 평가하고, Preview · Publish 의 생성 CSS 는 같은 트리를 같은 순서로 compile 한다. 상태가 겹칠 때 (invalid + hover · 선택 + hover · static + disabled) 어느 색이 이기는지가 두 화면에서 같다.
  - live (Chrome MCP 5177): Button accent 휴지 · hover · pressed · disabled / quiet ToggleButton 선택 · hover / TextField invalid + hover / 강조 Tag 선택 / 강조 Checkbox 선택 — Canvas 와 Preview 같은 색, Styles 패널 Fill 도 같음. 콘솔 0.
  - Styles 패널의 칠 칸은 휴지 상태 값을 보인다 — hover · pressed 상태 원본을 골라도 휴지 색 (패널은 휴지 칠을 편집하는 곳).
  - **Why**: 상태 표현이 5 방식 · 타입 3 벌로 갈려 Canvas 와 CSS 가 겹친 상태의 우선순위를 다르게 정했다 (S2 style macro 처럼 데이터 한 곳으로).
  - 위치: `packages/shared/src/catalog/rule/conditionTree.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` · 규칙 `.claude/rules/canvas-rendering.md` §2.5.5 · `ssot-hierarchy.md` D3 · 본문 `docs/adr/completed/297-rule-state-condition-tree-single-priority.md`

## [TagGroup 지우기 버튼 높이 · 바탕 수리 · Preview 에서 Button 작성 색이 안 보이던 것] - 2026-11-02

### Fixed

- **`allowsRemoving` 을 켠 TagGroup 의 Tag 가 32 → 46 으로 커지던 것 (Canvas · Preview 모두)** — 지우기 버튼 (`Button[slot=remove]`) 이 Button rule 의 S2 최소 높이 (`{size.height.M}` 32) 를 받아 18 상자가 32 로 늘었다. Tag 의 part rule 이 그 버튼의 18px 상자를 줄 때 최소 폭과 함께 최소 높이도 0 으로 둔다.
  - **Why**: ADR-295 Phase 3a 가 Button 크기에 S2 control 최소 높이를 넣었는데, Tag 의 part rule 은 최소 폭만 풀고 있었다 (사용자 보고).
  - 위치: `packages/shared/src/catalog/document/manualBoxRules.ts` (Tag) · 회귀 `apps/builder/src/builder/catalogRuntime/__tests__/adr256TagGroupNodeTree.test.tsx`
- **Preview · Publish 에서 Button 에 작성한 바탕 · 테두리 · 글자색이 보이지 않던 것** — Styles 패널로 Button 의 Fill 을 바꾸면 Canvas 에는 보이고 Preview 는 variant 색 (primary 검정) 그대로였다. Tag 지우기 버튼도 같은 원인으로 Preview 에서만 검은 바탕 · 흰 X 였다 (Canvas 는 투명 · Tag 글자색). 이제 작성한 색은 inline 으로 나가 hover · pressed 에서도 그대로 (Canvas 와 같은 규칙 — 작성 값이 상태 칠을 이긴다), 지우기 버튼의 X 는 Tag 글자색을 따른다.
  - **Why**: ADR-297 Phase 3e 가 `.button-base` 변수 ramp 를 catalog 노드에서 껐는데, DOM 은 작성 색을 여전히 그 변수 (`--button-color` · `--button-border` · `--button-text`) 로 내고 있었다. 테스트는 변수 문자열만 확인해 결과를 놓쳤다.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts` · `packages/shared/src/components/styles/TagGroup.css` · 회귀 `adr256TagGroupNodeTree.test.tsx` · `adr253FieldPartsDom.test.ts` (변수 → inline 기대값)

## [ADR-298 Phase 4 — Canvas 간격 핸들 · 입력 칸 끌기가 테마 단계를 밟는다] - 2026-11-02

### Changed

- **Canvas 의 padding · gap 핸들을 끌면 테마 간격 단계 (0 · XS 4 · S 8 · M 12 · L 16 · XL 24) 로 맞춰지고, 놓으면 그 토큰이 저장된다 (ADR-298 Phase 4)** — 끄는 동안 값 배지에 단계 이름이 같이 보인다 (「M 12」). 테마의 간격 값을 바꾸면 그 요소도 따라온다. 전에는 1px 단위 숫자가 저장됐다.
  - 1px 단위로 끌고 싶으면 끄는 동안 ⌘ (Windows Ctrl) 를 누른다 (⇧ 를 더하면 10px). ⌥ 는 전처럼 양쪽 변을 같이 끈다.
  - Design 패널 숫자 칸의 라벨 (아이콘 · 이름) 을 좌우로 끌면 값이 바뀐다. 토큰 칸 (Padding · Gap · Radius · Border Width · Font Size · Position) 은 한 번에 한 단계씩, ⌥ 를 누르면 1 단위 숫자. 놓을 때 한 번 저장된다.
  - 테마 단계에 없는 숫자 (예: 옛 문서의 10) 는 칸 앞에 주황 테두리 점이 붙는다. 값은 그대로이고, 메뉴에서 단계를 고르면 토큰이 된다. 비어 있는 칸은 흐린 「—」 (rule 기본값을 따름).
  - Position 의 Left · Top · Right · Bottom ▾ 메뉴에 간격 단계와 단위 (px · %) 가 함께 나온다. 단계를 고르면 토큰, % 를 고르면 % 값.
  - **Why**: 토큰 모델 A — 패널 메뉴만 토큰을 쓰고 Canvas 핸들 · 끌기는 숫자를 저장하면, 같은 화면의 다른 편집 경로가 테마 밖 값을 다시 만든다.
  - 위치: `apps/builder/src/builder/components/property/propertyUnitSteps.ts` · `PropertyUnitInput.components.tsx` · `catalogRuntime/canvasGesture.ts` · `workspace/canvas/skia/spacingOverlayRenderer.ts` · `panels/styles/sections/TransformSection.tsx` · 테스트 `adr298Phase4Panel.test.tsx` · `phase4eCanvasGesture.test.ts`

## [ADR-298 Phase 3 — 색 · 위치 · 간격 칸도 테마 토큰을 쓴다] - 2026-11-02

### Changed

- **색 피커의 Theme 팔레트가 테마 색 토큰이 되었고 맨 위에 온다 (ADR-298 Phase 3, 사용자 결정 2 · 4)** — Accent · Surface · Neutral · Status 묶음의 스와치를 고르면 Fill · 글자색 · 테두리색이 그 토큰을 참조한다. 테마 색이나 dark 모드를 바꾸면 그 요소의 색도 따라 바뀐다 (Canvas · Preview · 내보낸 코드 모두). 전에는 고른 순간의 hex 가 저장돼 모드를 바꿔도 남았다.
  - 칸에는 토큰 이름 (「neutral-subtle」) 과 지금 모드의 색이 보인다. 피커를 끌거나 hex 를 치면 그 색이 리터럴로 저장된다. 옛 accent · neutral 사다리는 토큰이 아니어서 팔레트에서 뺐다.
  - 그라데이션 스톱도 토큰을 받는다. 층 불투명도는 그대로 따로 적용된다.
  - Grid 의 Gap X · Y 단계 (XS ~ XL) 가 그 축에 토큰으로 저장된다 (전에는 그 순간의 px). 한 줄 flex 의 Gap 도 그 축 값으로 저장된다.
  - Position 의 Left · Top · Right · Bottom 이 토큰이면 칸에 단계 칩과 px 가 보인다 (단계 메뉴는 다음 Phase — 지금 메뉴를 붙이면 `%` 단위를 고를 수 없어서).
  - 코드 보기 Page.css 에 `background: var(--bg-muted)` · `left: var(--spacing-lg)` 로 보이고, 고쳐서 Apply 하면 같은 토큰으로 돌아온다.
  - **Why**: 토큰 모델 A — 노드 값이 토큰 이름을 저장해야 테마 · 모드 전환이 rule 값과 노드 값에 같이 닿는다. fills 색 · inset 은 리터럴만 받는 저장 자리였다 (문서 스키마 `string | TokenUse` 로 확장).
  - 위치: `packages/shared/src/catalog/document/types.ts` (`CatalogFillColor` · `LayoutTokenField`) · `resolution/resolver.ts` (`resolvedFills` · `applyLayoutWrites`) · `runtime/authoredStyle.ts` · `runtime/nodeTokenCss.ts` · `utils/fillAdapter.ts` · `codeView/files/styles.ts` · `apps/builder/src/builder/catalogRuntime/panelTokens.ts` · `panels/styles/components/ColorPickerPalettes.*` · 테스트 `adr298Phase3.test.ts` · `adr298Phase3Panel.test.tsx` · `adr298CodeViewRoundTrip.test.tsx`

## [ADR-297 Phase 3 닫힘 — 묶음 컨테이너가 Canvas 에서만 칠하던 바탕 · 테두리 제거] - 2026-11-02

### Fixed

- **CheckboxGroup · RadioGroup · DisclosureGroup · Form · Pagination · Toolbar (Canvas)**: Builder Canvas 가 이 묶음 컨테이너에 흰 바탕을 깔고 Pagination · Toolbar 에는 회색 테두리 상자를 그렸다. Preview · publish 에는 없던 칠이다. 이제 두 화면 모두 칠하지 않는다 (S2 그대로).
  - **Why**: rule 의 칠 트리에 바탕 · 테두리가 적혀 있었지만, 생성 CSS 는 composition 이 상자를 가진 rule 의 variant 칠을 내지 않아 Canvas 만 그것을 읽었다. 트리 하나를 두 소비자가 다르게 읽은 경우다.
  - 판정: 표 전수 칠 대조를 실제 노드 트리 (팔레트 instance 의 같은 record 를 Canvas node data · Preview DOM computed 로) 로 다시 재 536 칸 중 36 이 달랐고, 이 8 칸이 트리 계약 위반이었다. 나머지 28 칸 (수동 CSS 만 칠하는 GridList · Table 선 · Pagination 쪽 버튼 등) 은 ADR-297 전부터 있던 다른 원천이라 후속으로 둔다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · 게이트 `packages/shared/src/catalog/__tests__/adr297ContainerPaintGate.test.ts` · 하니스 `apps/builder/tests/parity/adr297RealPaintParity.browser.test.ts`

## [ADR-298 Phase 2 — Design 패널이 테마 토큰을 먼저 쓴다 (패널)] - 2026-11-01

### Changed

- **Design 패널의 크기 단계 (XS ~ XL · none · thin · thick · S · M · L) 를 고르면 요소에 토큰으로 저장된다 (ADR-298 Phase 2)** — Gap · Padding · Radius · Border Width · Shadow · Font Size. 테마 radius 를 바꾸거나 dark 로 바꾸면 그 요소 값도 Canvas · Preview 에서 같이 바뀐다 (전에는 고른 순간의 숫자가 저장됐다).
  - 칸에는 단계 칩과 지금 테마의 값이 보인다 (「L 10」). 숫자를 직접 치면 그 숫자가 저장된다.
  - Border Width 는 슬라이더 대신 Radius 와 같은 「값 + ▾」 칸 (none · thin · thick, 사용자 결정 3). Font Size 메뉴는 본문 · 제목 두 묶음. 글자 크기가 토큰이면 Line Height 는 「auto」 — 그 단계의 짝 행간을 쓴다.
  - Effect 의 Blur 는 다른 길이 칸과 같은 입력칸이다 (전에는 끌기 숫자). Size · Position 의 오류 · 위치 요약 문구가 절 아래 문단이 아니라 해당 필드 안에 보인다.
  - 코드 보기 Page.css 에는 `var(--spacing-md)` 같은 토큰 변수 줄로 나오고, 고쳐 Apply 해도 같은 토큰으로 돌아온다.
  - 아직: grid 의 Gap X · Y 는 고른 단계의 숫자로 저장된다 (Phase 3).
  - 문서: `docs/adr/298-node-token-reference-panel-token-first.md` · breakdown §6.2

## [ADR-298 Phase 1 — 노드 값의 토큰 참조가 테마 · 색 모드를 따른다 (토큰 층)] - 2026-11-01

### Changed

- **요소에 토큰으로 저장한 값이 Preview · Publish 에서 테마 · 색 모드를 CSS 로 따른다 (ADR-298 Phase 1)** — 지금은 코드 보기에서 `var(--catalog-token-*)` 로 적은 값이 해당 (패널 메뉴는 Phase 2). spacing · radius · border 폭 · 색 토큰은 Preview inline 에 같은 변수로 들어가, 테마 radius 를 바꾸거나 dark 로 바꾸면 Canvas 와 같은 값으로 바뀐다. rule 이 준 값은 그대로.
  - 토큰 단계 전체 (spacing · radius · border · 그림자 · 글자 본문/제목/행간 · 색) 를 요소가 참조할 수 있다 — rule 이 쓰지 않는 단계도.
  - 글자 크기를 토큰으로 바꾸면 행간이 그 단계의 짝으로 맞춰진다 (제목 M 22 → 행간 26). 행간을 직접 적었으면 그 값이 이긴다.
  - 같은 값의 리터럴을 토큰으로 바꿔도 Preview 가 갱신된다.
  - 검증: 테마 radius md → xl · light → dark 전환에서 Preview computed = Canvas (7 축), 콘솔 오류 0.
  - 문서: `docs/adr/298-node-token-reference-panel-token-first.md` · breakdown §6.1

## [ADR-298 Accepted · Phase 0 + 그림자 dark 수리 — Preview 그림자가 Canvas 처럼 색 모드를 따른다] - 2026-11-01

### Fixed

- **Design 패널 Box Shadow preset (S · M · L) 을 고른 요소가 dark 모드 Preview · Publish 에서 light 그림자로 남던 문제** — Canvas 는 dark 그림자를 그리는데 Preview 는 고른 순간의 light 값을 inline 으로 써서 두 화면이 달랐다. 이제 Preview 도 같은 판정으로 테마 그림자 변수 (`var(--shadow-sm|md|lg)`) 를 내 색 모드를 따른다 (`catalogAuthoredDomStyle`). 이미 저장된 문서도 함께 고쳐진다. 임의 CSS 그림자 · inset 은 원문 그대로 (Canvas 와 같다).
  - 원인: ADR-248 의 catalog DOM 경로가 옛 DOM 경로의 그림자 변환 호출을 옮기지 않았다.
  - 검증: dark 테마 새 프로젝트 · Frame 에 preset S → Canvas 알파 0.24 · 0.12 · 0.24 = Preview computed (수정 전 0.08 · 0.04 · 0.08), 콘솔 오류 0.

### Changed

- **ADR-298 (토큰 모델 A — 노드 값의 토큰 참조) Accepted · Phase 0 닫힘**: 인벤토리 (라이브러리 토큰 149 · spacing · shadow · border 토큰 없음) · RED 3 (`adr298Red.test.ts`) · 295 두 arm 기준선 PASS. 사용자 결정 7 = 위 그림자 수리를 먼저. 다음 Phase 1 (토큰 층 — 화면 변화 없음).
  - 문서: `docs/adr/298-node-token-reference-panel-token-first.md` · `docs/adr/design/298-node-token-reference-breakdown.md` §6.0

## [ADR-296 Implemented — 코드 보기 = 프로젝트 파일 트리: 문서 전체를 레퍼런스 모양의 파일로] - 2026-11-01

### Changed

- **ADR-296 완료**: 코드 보기가 page 한 파일에서 프로젝트 전체 파일로 넓어졌다 — `App.tsx` (경로 · layout · toast · 테마) · `pages/<P>.tsx` · `.css` · `theme.css` · `data/` · `api/` · `state/project.ts` · `components/<Name>.tsx` · `.css` · `index.html` · `site.config.ts`. 어느 파일을 고쳐도 패널과 같은 명령으로 반영되고, 여러 파일을 한 번에 Apply 하면 Undo 1 번에 되돌아간다. 한 instance 의 `overrides` 편집은 원본 · 다른 instance 로 번지지 않는다.
  - 검증 (빈 프로젝트, 코드 패널만): 8 파일 한 Apply (data · 그 data 를 쓰는 목록 · api · state · 컴포넌트 원본 + instance 2 · 반응형 CSS · `/about` 경로 · 사이트 제목) → Preview 탭 제목 · 목록 · 빨간 글자 24px · About 이동 · 한 instance 만 원본 규칙을 끈 둘째 Apply 뒤 그 버튼만 토스트 없음 · Undo 1 번씩 · 새로고침 유지 · 콘솔 오류 0. 번들 Builder +216 B gz (ADR 전체) · Preview 0.
  - 이 ADR 밖: 노드 dark 강제는 Canvas · Preview 가 노드 `themeOverride` 를 읽지 않아 화면에 나타나지 않는다 (기존). hover 스타일은 노드 상태를 쓰는 명령이 없어 CSS 에서 읽기 전용.
  - 문서: `docs/adr/completed/296-code-view-project-file-tree-projection.md`

## [ADR-297 Phase 3 (일부 5) — 옛 칠 형식 삭제 (출력 동일)] - 2026-11-02

### Removed

- **variant 칠의 옛 형식 · 변환기 (ADR-297 Phase 3i)** — 칠은 rule 의 조건 트리 하나다. `VariantSpec` · `FillTokenSpec` · `FillStateTokens` · `cssEmitMode`, 생성기의 옛 variant 블록과 어댑터 (`legacyPaintOf` · `variantSourceFor`), shared `legacyVariantPaint`, `@composition/rendering` 의 `resolveFillTokens` · `resolveIndicatorFill` · `resolveStateColors` · `getVariantColors` · `getSizePreset` (소비 0) 와 그 파일 (`fillTokens.ts` · `variantColors.ts` · `stateEffect.ts`). 생성 CSS 109 개는 byte 단위로 같다.
  - **Why**: 트리를 compile 한 뒤 (3a) 옛 블록은 production 에서 닿지 않았고, 옛 형식이 남아 있으면 칠을 두 형식으로 적는 길이 열린다.
  - 위치: `packages/rendering/src/types/spec.types.ts` (`VariantRestPaint`) · `renderers/CSSGenerator.ts` · `scripts/generate-css.ts` · `packages/shared/src/catalog/rule/rulePaintTree.ts`

## [ADR-297 Phase 3 (일부 4) — Button · ToggleButton · InlineAlert 상태 칠을 S2 값으로] - 2026-11-01

### Changed

- **Button 의 눌림 · outline hover · disabled · static 색이 S2 와 같아진다 (ADR-297 Phase 3h, 사용자 결정 2)**
  - 눌림 = hover 색 (테두리가 바탕과 달라 생기던 링이 없다). outline 은 hover · 눌림에 연한 회색 바탕이 깔리고, 테두리는 primary 진한 회색 · secondary 회색 단계를 따른다. accent · negative outline 의 글자는 S2 처럼 중립색.
  - disabled 는 흐리게가 아니라 S2 disabled 색 (회색 바탕 · 회색 글자, opacity 없음) — ButtonGroup 이 끈 Button 도 같다.
  - `staticColor` 는 S2 처럼 흰 · 검정의 반투명 단 (primary 85 % → hover 94 %, secondary 11 % → 14 %). accent · negative 에는 S2 static 칠이 없어 평소 색이다.
  - **Why**: 칠이 S2 순서 · 값과 달랐다 (Phase 0 실측 확정 8 건) — 한 트리를 두 consumer 가 읽게 된 뒤 값만 S2 설치본에 맞췄다. Canvas 는 disabled 를 조건으로 읽지 않았고, Button 라이브러리 정의가 칠을 손으로 옮겨 static 을 불투명으로 고정하고 있었다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (`buttonPaint`) · `catalog/document/codeCatalogLibrary.ts` · `catalog/resolvers/resolveCatalogPaint.ts` · `catalog/runtime/rulePaint.ts`
- **quiet ToggleButton 의 hover · 눌림이 한 단 진해지고, InlineAlert subtleFill 의 Canvas 테두리가 사라진다** (S2 `ActionButton` · `InlineAlert`).

### Tests

- `packages/shared/src/catalog/__tests__/adr297S2Paint.test.ts` — S2 설치본 소스를 oracle 로 7 건 고정 (원복 RED).

## [ADR-297 Phase 3 (일부 3) — 수동 CSS 의 선택 · focus 상태를 rule 트리로] - 2026-11-01

### Changed

- **Checkbox · Radio · Switch 표시 · 달력 날짜 · Tag · Tree · Table 행 · 견본 · Menu 선택 글리프의 선택 · focus 칠이 catalog rule 에서 나온다 (ADR-297 Phase 3g)**
  - 수동 CSS 가 그리던 부품 · 셀 · `::before` · `::after` 의 상태를 rule 의 `partStateStyles` 조건 트리로 옮겼다 — 값은 그대로 (실제 Preview DOM 하니스에서 전후 차이 0). 생성 sheet 가 없던 TagGroup · Tree · Table · GridList · ColorSwatchPicker · Row 는 상태 블록만 담은 생성 sheet 를 싣는다.
  - 수동 규칙은 Builder 자체 위젯 전용으로 좁혔다 — Builder 화면 변화 0.
  - ListBox 항목의 선택 바탕이 Preview 에서도 Canvas · RAC 처럼 진한 accent 에 흰 글자다 (전에는 Preview 만 연한 accent 에 진한 글자 — 사용자 결정).

## [ADR-297 Phase 3 (일부 2) — 상태 스타일 · `&` 상태 선택자 · 선택 variant 를 조건 트리로] - 2026-11-01

### Fixed

- **disabled 흐림 · focus ring · pressed 축소 · quiet 밑줄 · field 버튼 모서리가 Canvas 와 Preview 에서 같은 트리를 읽는다 (ADR-297 Phase 3 — 3b · 3c · 3d)**
  - rule 의 상태 스타일이 `structure.stateStyles` 조건 트리 하나다 (옛 `structure.states` · `rootSelectors` 의 `&[data-*]` 키 42 를 옮김). 생성 CSS 는 같은 트리를 compile 하고 (size 블록 위 층 — 클래스 두 번 + `:where`), Canvas 의 quiet 칠 · invalid 테두리 · Disclosure 테두리 · Color 조작기 disabled 는 같은 트리의 evaluator 로 읽는다.
  - Link · Card · SliderFill · SliderOutput 이 disabled 일 때 Canvas 도 흐려진다 (Preview 는 이미 0.38). RAC 가 disabled 상태를 내지 않는 21 종 (Form · Dialog · Heading …) 의 죽은 disabled 블록은 없앴다.
  - 입력칸 (Input · DateInput) 이 invalid 이면 hover 중에도 빨간 테두리 · 밑줄이다 (S2 — 전에는 Preview 에서 hover 회색이 이겼다). Builder 자체 입력칸도 같다.
  - Tag 선택 · TagGroup 강조 선택 · ColorSwatch 선택 칠이 variant 이름 (`selected`) 이 아니라 `isSelected` 조건이다 — Canvas 값 그대로.
  - 조건 어휘: `fieldButton` · `inGroup` · `isAutofilled` · `isDialogTrigger` · `isCatalogNode` · `isLink`.

## [ADR-297 Phase 3 (일부) — Preview 칠을 Canvas 와 같은 조건 트리 하나로: 생성 CSS compiler 전환 · button-base · static] - 2026-11-01

### Fixed

- **Preview · Publish 의 상태 칠이 Canvas 와 같은 트리 · 같은 순서로 정해진다 (ADR-297 Phase 3 — 3a · 3e · 3f)** — 표 전수 비교 (DOM computed ↔ Canvas, 닿는 입력 2,196 행) 에서 다른 행 557 → 303.
  - 생성 CSS 가 variant 조건 트리를 직접 compile 한다 (`generate-css.ts` `variantPaintCssFor` — 조건 선택자 전부 `:where()`, 트리 순서 = cascade). alpha 0 variant 는 모든 상태에서 배경 없음 (전에는 Link 가 hover 때 흰 바탕을 칠했다).
  - Button · ToggleButton 의 hover · pressed · selected 색이 `.button-base` color-mix ramp 가 아니라 트리 값이다. ramp 와 옛 `--button-*` 변수는 Builder 자체 버튼에만 남는다 (`:not([data-catalog-id])` — Builder 화면 변화 0).
  - staticColor (black · white) 가 트리 가지 (`staticColor` 값 조건) 다 — Canvas 의 static 판정을 codemod 로 옮겨 두 화면이 같은 값을 읽는다. Preview 에서 static white Button 의 hover 가 파랑으로 바뀌던 것, quiet 선택 ToggleButton 이 흰 바탕에 흰 글자로 보이던 것이 고쳐졌다.

## [ADR-297 Phase 2 — rule 190 variant 의 상태 칠을 조건 트리 하나로 (옛 fill · colors 칸 삭제)] - 2026-11-01

### Changed

- **catalog rule 의 상태 칠 (배경 · 글자 · 테두리) 은 이제 variant 의 조건 트리 `paint` 하나다 (ADR-297 Phase 2)** — 나머지 180 variant 를 codemod 로 옮겨 표 전수 190 variant 가 트리이고, 옛 `fill.<style>.<state>` · `colors` 접미사 키는 표 · 타입에서 없어졌다 (`ComponentRuleVariant.paint` 필수 · 배경 투명도는 `alpha`). 화면 값 변화 없음.
  - Canvas: `resolveCatalogPaint` 의 옛 삼항 사슬을 지웠다 — 상태 칠은 트리 evaluator 하나 (Styles 패널 미리보기도 같은 경로).
  - 트리를 읽는 곳: rule → 문서 투영기 (`codeCatalogLibrary.ts` · `ruleDefinition.ts` · `manualBoxRules.ts`) 와 DOM 컴포넌트 (Avatar · StatusLight · ProgressCircle) 는 트리의 한 가지에 적힌 값을 그대로 읽는다 (`paintAt` — `packages/shared/src/catalog/rule/rulePaintTree.ts`). Skia 어댑터 (`ruleVariantToVisual`) 는 칠을 싣지 않는다 — primitive 는 해석된 `paint` 만 읽는다.
  - 생성 CSS 는 Phase 3 에서 `compileConditionTree` 로 바꿀 때까지 트리를 옛 블록 순서 입력으로 읽는다 (`generate-css.ts` `legacyPaintOf` — 출력 동일).
  - `paintVariant` helper 와 `ComponentRuleFill` · `ComponentRuleFillState` · `ComponentRuleVariantColors` 공개 타입은 지웠다 (옛 형식은 `rulePaintTree.ts` 의 전환 단계 타입 `Legacy*` 로만 남는다).
  - 검증: 생성 CSS `validate:sync` diff 0 · paint 기준선 닿는 입력 10,044 행 동일 · library 투영 동일 · 정적 게이트 (`componentRulesTable.static.test.ts` — 옛 칸 0 · 트리 조건 키 ∈ 어휘) · 원복 RED 2 (옛 칸 하나 → 게이트 FAIL · Button accent hover 칸 삭제 → 기준선 4 행 차이) · live (5177 — Badge · Checkbox · Avatar · StatusLight · Button · ToggleButton 의 Canvas 칠과 Preview 값, 콘솔 오류 0).
  - Phase 3 로 옮긴 것: `structure.states` · `rootSelectors` `&[data-*]` · variant 이름 `selected` 의 트리 전환과 `VariantSpec` 삭제 — 셋 다 생성 CSS 선택자가 바뀌어 Phase 2 의 diff 0 안에서 할 수 없다.

## [ADR-297 Phase 0 · 1 — rule 상태 칠의 조건 트리 (evaluator · compiler) + Button 가족 전환] - 2026-11-01

### Changed

- **catalog rule 의 상태 칠을 조건 트리로 적기 시작 (ADR-297 Accepted — 사용자 `/execute-adr 297`)** — S2 style macro 의 **형식** 만 가져온다: 속성 (`backgroundColor` · `color` · `borderColor`) 마다 조건을 중첩하고 같은 깊이의 나중 키가 이긴다. 같은 트리를 Canvas 는 `evaluateConditionTree` (조건 집합 → 값) 로, 생성 CSS 는 `compileConditionTree` (조건 선택자 전부 `:where()` — 블록 specificity 가 같아 cascade = 트리 순서) 로 읽는다 (`packages/shared/src/catalog/rule/conditionTree.ts`). 화면 값 변화 없음.
  - Button · ToggleButton · ToggleButtonGroup · ButtonGroup · FileTrigger 의 10 variant 를 codemod (`apps/builder/scripts/adr297-rule-to-tree.ts`) 로 `paintVariant({ paint })` 로 옮겼다. `resolveCatalogPaint` 는 트리 variant 를 evaluator 로 칠하고, 옛 형식 소비자 (생성 CSS · 투영기) 는 트리에서 되살린 `fill` · `colors` 를 그대로 읽는다 (전환 단계 — Phase 2 에서 전 rule · 소비자 이관).
  - 트리는 지금 Canvas 의 우선순위를 그대로 담는다 — 선택 · outline · subtle 은 그 칸만 칠하는 배타 가지이고, 칸이 비면 `null` (값 없음) 가지를 **컴포넌트가 닿는 축에만** 둔다 (`paintReach.ts` — 선택 = RAC `data-selected` · 컬렉션 항목, fillStyle = binding 이 받는 값).
  - 검증: 생성 CSS `validate:sync` diff 0 · paint 기준선 닿는 입력 10,044 행 동일 (`adr297-baseline.ts`) · library 투영 동일 · 표 전수 동치 (131 rule 의 모든 variant 를 트리로 옮겨도 옛 사슬과 같음 + 왕복 동일) · Chromium computed 대조 (`adr297ConditionCascade.browser.test.ts` — 겹친 조건 조합 전부 == evaluator) · 원복 RED 2 · live (5177 — Button primary · ToggleButton selected / +emphasized / +quiet 의 Canvas 와 Preview 색 일치, 콘솔 오류 0). `resolveCatalogPaint.shadow.test.ts` 는 닿는 입력으로 좁힘 (6,840 → 3,387, diffs 0).

## [Toast = 앱의 토스트 모양 하나 (RAC `MyToastRegion`) — 페이지 요소가 아니다] - 2026-11-01

### Changed

- **Toast 의 구조 (사용자 결정 2026-11-01 「RAC · RSC 레퍼런스가 제공하는 것이 Trigger 없는 Toast 가 맞는가」 → 「제안대로 진행」)** — 레퍼런스 대조 결과: Popover · Modal · Tooltip 은 버튼에 붙는 overlay 라 Trigger 가 열림 상태 · 위치를 소유하지만, Toast 는 **앱 전체 큐** 다 — ToastTrigger 가 없고 어디서든 `queue.add(...)` (S2 `ToastQueue.positive(...)`) 를 부르면 root 의 region 하나가 그린다. RAC `<Toast>` 는 `ToastRegion` 의 render 함수 안에서만 `toast` 객체를 받아 존재하고 S2 는 `<Toast>` 를 노출하지 않는다 (`ToastContainer` + `ToastQueue`). 그래서 사용자가 만드는 것은 **앱의 토스트 모양 하나** (`Toast.tsx` 의 `MyToastRegion` · `MyToast`) 이고, 띄울 때는 데이터만 넘긴다. 페이지에 고정으로 보이는 알림은 InlineAlert 다.
  - **컴포넌트 패널에서 Toast 삽입을 뺀다** (295 후속 C9 의 팔레트 삽입을 되돌림 — `PaletteItem.libraryOnly`). Library 의 Toast 카드 (원본) 는 그대로다 — 잠금을 풀어 고치면 그것이 앱의 토스트 모양이다. swap · slot 추천에서도 빠진다. 이미 페이지에 놓인 Toast 노드는 그대로 둔다 (마이그레이션 없음).
  - **Site 설정 앱 절에 「토스트 모양」** (`ProjectEntry.toastShapeId` · `setToastShape`, 히스토리 「Toast shape」): 기본 (Library Toast) 또는 root 가 Toast 인 사용자 컴포넌트 (사용자 프로젝트의 `ToastTest`). Toast 가 아닌 컴포넌트는 `TOAST_SHAPE_NOT_TOAST` 로 거절, 모양으로 쓰던 컴포넌트를 지우면 기본으로 돌아간다 (`removeWithReferrers`).
  - **Preview · Publish 의 region 이 고른 모양으로 그린다** (`toastShape.ts` · `CatalogToastProvider renderToast`): RAC `<Toast>` (alertdialog · F6 · focus) 안에 그 컴포넌트의 template 을 세션의 정의 보기 root (`toastShapeRoot`) 로 그리고, Do 의 데이터를 record 위에 얹는다 — title 은 Toast 의 첫 글자 (Button 안 제외), actionLabel 은 첫 Button 의 글자 (없으면 Button 숨김), variant 는 root. 모양의 닫기 버튼은 그 토스트를 닫고 (`CatalogToastShapeContext`), Button 은 Do 의 action 을 실행한 뒤 `shouldCloseOnAction` 이면 닫는다. 안쪽 상자는 region 안에서 `role="alert"` 를 내지 않는다 (바깥이 이미 alertdialog). 모양을 고르지 않으면 종전 S2 토스트.
  - Do 「toast」 와 Interactions 패널은 그대로 (데이터만) — 레퍼런스의 호출 방식이다.
  - 위치: `paletteItems.ts` · `ComponentList.tsx` · `swapInstance.ts` · `slots.ts` · `document/types.ts` · `validation.ts` · `graph.ts` (`validateToastShape` · 참조) · `commands/project.ts` (`setToastShape`) · `commands/structure.ts` · `runtime/toastShape.ts` (새) · `toastShapeContext.ts` (새) · `catalogPreviewSession.ts` (`toastShapeRoot`) · `domView.components.tsx` · `delegatedDom.runtime.ts` (`ToastNodeBox` · 닫기) · `components/Toast.tsx` (`ToastRenderer`) · `ToastRegion.lazy.tsx` · `Toast.css` · `panels/site/useCatalogToastShape.ts` (새) · `SitePageSections.tsx` · i18n · `catalogHistoryLabels.ts` · `codeView/fieldCoverage.ts` (`src/Toast.tsx` — code view 는 다음 커밋).
  - 검증: `s2ToastShape` 3 (제목 · variant · Button 숨김 · 닫기 · 안쪽 role 없음 / actionLabel → Button · 누르면 action + 닫힘 / Toast 아닌 컴포넌트 거절 · 컴포넌트 삭제 → 기본 · undo 복원) · 원복 RED 3종 (모양 렌더 끊기 → 2 실패 · 삭제 정리 끊기 → 1 · Button 숨김 끊기 → 1) · `SitePageSections` 모양 picker · `paletteItems` oracle (`libraryOnly`) · `s2ToastNode` · `fieldCoverage` 인벤토리 +1 · type-check · live 5175 (Content 16 → 15 · Toast 원본으로 `ToastTest` 컴포넌트 → Button 규칙 toast → Site › App › Toast Shape 에 「Default (Library Toast)」 · 「ToastTest」 → ToastTest 선택 (히스토리 「Toast shape」) → Preview 에서 버튼 → 오른쪽 아래에 ToastTest 모양 154.9 × 56 · info · 「Message」 · Button display none · 닫기 → 사라짐; 규칙을 negative · actionLabel 「Undo」 · 누르면 닫기로 바꾸고 다시 Preview → 바탕 rgb(251 44 54) · 「Deleted」 · 흰 「Undo」 → 누르면 사라짐, 두 Preview 콘솔 오류 0).
  - **code view 도 같은 구조 (사용자 「code 에서도 동일하게 나타내야겠지」)** — RAC 레퍼런스 `Toast.tsx` 모양으로: 파일 트리에 `src/Toast.tsx` (App 다음) — `export const queue = new ToastQueue<{title; variant?; actionLabel?; onAction?; shouldCloseOnAction?}>()` 와 `MyToastRegion({placement})` = `<ToastRegion queue={queue} data-placement={placement}>{({toast}) => …}</ToastRegion>`; 모양을 골랐으면 `import ToastTest from './components/ToastTest'` + `<ToastTest toast={toast} />`, 아니면 RAC `<Toast toast={toast} data-variant>` 에 `<ToastContent><Text slot="title">` · action Button · `<Button slot="close">`. `App.tsx` 는 `import {MyToastRegion} from './Toast'` + `<MyToastRegion [placement] />` (S2 `<ToastContainer>` 대신), 페이지는 `import {queue} from '../Toast'` + `queue.add({...})` (페이지마다 있던 `const toasts = new UNSTABLE_ToastQueue<…>()` 제거). Toast.tsx 의 읽기 단위는 모양 하나 — `<ShapeB toast={toast} />` 로 고치면 그 컴포넌트가 모양이 되고 (`planCodeViewToast`), 기본 몸체로 돌리면 Library Toast; 큐 타입 · 기본 몸체는 파생이라 바꾸면 거절. 사용자 컴포넌트 파일 (`src/components/<Name>.tsx`) 은 ADR-296 Phase 4 · 5 대상이라 아직 트리에 없다.
  - 위치 (code view): `codeView/files/toast.ts` (새 — `generateToastFile` · `codeViewToastShape`) · `files/tree.ts` (`toast` kind) · `files/app.ts` · `files/names.ts` · `inverse/app.ts` · `inverse/parse.ts` (`toasts` 문 제거) · `generate.ts` (`queue.add` · `../Toast` import) · `vocabulary.ts` (Toast.tsx 행 · App 행) · `types.ts` (`symbols.components`) · `codeViewApp.ts` (`planCodeViewToast` · `compareToastFile`) · `codeViewApply.ts` · `codeViewEdit.ts` (`queue.add` 정규식).
  - 검증 (code view): `adr296Vocabulary` 45 (Toast.tsx 행의 FILE_CASE — ShapeA → ShapeB 로 고치면 모양이 바뀜 · 원복 RED 1/1 · golden fixture 재생성) · `adr296Apply` · `adr296Data` (트리에 Toast.tsx) · `s2CodeViewToast` · shared `codeView` 311 · type-check · live 5175 (Code 패널 Files 에 `src/Toast.tsx` — 열면 `import ToastTest from './components/ToastTest'` · `queue` · `<ToastTest toast={toast} />`, App.tsx 에 `import {MyToastRegion} from './Toast'` · `<MyToastRegion />`, Home.tsx 에 `import {queue} from '../Toast'` · `queue.add({title: 'Deleted', variant: 'negative', …})`; 확인용 컴포넌트 · 노드는 삭제, 콘솔 오류 0).

## [ADR-296 Phase 5 · 6 — 코드 보기 컴포넌트 파일 · instance overrides · 사이트 파일] - 2026-11-01

### Added

- **컴포넌트 파일 (ADR-296 Phase 5 — 사용자 결정 3)** — 코드 보기 파일 트리에 `src/components/<Name>.tsx` · `<Name>.css`. 원본 template 루트가 JSX 루트이고 `type <Name>Props` · variable property (`let {team} = props`) · 컴포넌트 event (`props.on<Name>?.(v)` — ADR-294) 가 나온다. 이 파일 편집은 원본 명령 (모든 instance 에 반영), 함수 이름 변경은 컴포넌트 이름 변경.
  - page 의 instance 는 컴포넌트 이름 (`<Picker …/>` — RAC · Library 이름과 겹치면 `Card2`) 으로 쓰고, instance 몫은 `overrides={{'<안쪽 경로>': {prop, hidden, on<When>: rules({inherited: {…: 'off' | () => {…}}, own: [(value) => {…}]})}}}` — instance 명령만이라 한 instance 의 편집이 원본 · 다른 instance 로 번지지 않는다. 안쪽 자리 스타일은 page CSS 경로 선택자 (`.picker .save-button`).
  - 그동안 코드에 없던 slot 내용 (팔레트로 놓은 Card · ListBox · TagGroup 의 내용) 이 instance 의 JSX children · 안쪽 자리는 `<Slot name="…">` 로 나오고 고칠 수 있다. 노드의 slot · region · placeholder · showWhen 선언은 `composition={{…}}`.
  - Library 원본은 `node_modules/@composition/library/<Name>.tsx` 읽기 전용 (편집 시 「잠금 해제하고 편집」 = Library unlock 한 명령).
  - 패널 Files 의 「새 파일」 로 `src/components/<Name>.tsx` 를 만들고 page 의 `<Name/>` 과 한 Apply (history 1).
  - 위치: `packages/shared/src/codeView/files/{overrides,library}.ts` · `inverse/overrides.ts` · `generate.ts` · `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts` · `codeViewApply.ts` · `panels/codeView/CatalogCodeViewPanel.tsx`
- **사이트 파일 (ADR-296 Phase 6 — 사용자 결정 2, ADR-286 Decision 8 의 해당 문장 Superseded)** — `index.html` (lang · title · description · 아이콘 · 앱 이름 · theme color · og:image) · `site.config.ts` (`siteConfig({search, redirects, access})` — 보호 page 는 이름, 비밀 없음) = Site 패널의 `setSiteSettings` (바뀐 설정만). 정해진 모양 밖의 줄은 거절. 위치: `packages/shared/src/codeView/files/site.ts` · `apps/builder/src/builder/catalogRuntime/codeViewSite.ts`

### Fixed

- **Phase 5 판독 MEDIUM 3 (ADR-296)** — event 값을 읽는 instance 규칙 함수가 매개변수 없이 나와 같은 `overrides` 편집이 거절되던 것 (이제 `(value) => {…}`) · 컴포넌트 파일의 class 이름과 `overrides` 키가 slot 내용이 있을 때 번호가 달라지던 것 (이름표 하나) · ListBox 항목 등 slot 내용이 든 새 컴포넌트 파일이 늘 거절되던 것.
  - 수리 검증에서 더: 규칙만 있는 slot 채움 자리의 `overrides` 키가 역으로 풀리지 않던 것 · endpoint 를 부르는 instance 규칙 함수에 `async` 가 없던 것 · 중첩 instance 의 컴포넌트 event 자리 키가 따옴표 없이 (`property:x:`) 나오던 것.
  - **Why**: 생성기 · 역문법이 같은 이름표 · 같은 slot 채움 경로를 각자 따로 갖고 있었다.

### Tests

- `adr296Component.test.tsx` 19 (G4 — A · B 격리 · 중첩 두 자리 · 원본 편집 = 모든 instance · Library 잠김 / 해제 · 새 컴포넌트 · 판독 3 · 수리 검증 3 + 가설 반증 1, 원복 RED) · `adr296Site.test.tsx` 3 · 어휘표 read 실증 행 추가.

## [ADR-296 Phase 4 — 코드 보기 스타일 파일 (page CSS · theme.css)] - 2026-11-01

### Added

- **`src/pages/<Page>.css`**: page 의 스타일이 CSS 파일로 보이고 고쳐진다 — 노드 하나 = class 하나 (노드 이름 kebab-case, 없으면 type, 같으면 `-2`), 선언 하나 = 문서 field 하나 (Styles 패널의 CSS 키 · 패널에 없는 field 는 `--icon-size` 같은 사용자 속성), `@media (max-width: 1279px | 767px)` = tablet · mobile, `background` = fill 레이어, `color-scheme` · `--theme-tint` = 노드 강제 테마, `display: none` = 숨김. 고친 값은 Styles · Fill 패널과 같은 명령으로 들어간다. page JSX 에는 스타일 있는 노드의 `className` 과 `import './<Page>.css'` 가 나온다.
- **`src/theme.css`**: 테마마다 `[data-theme="<name>"] { color-scheme; --theme-tint; --theme-neutral; --theme-radius; --<token> }` — 테마 추가 · 이름 · 프리셋 · 토큰 추가 · 변경 · 삭제가 Themes 패널 명령으로.
- **읽기 전용 `node_modules/@composition/catalog/<Type>.css`**: page 가 쓰는 컴포넌트의 생성 시트 (열 때 불러옴, 편집 불가).
- token 은 생성 catalog CSS 와 같은 변수 이름 (`var(--catalog-token-radius-md)`) — 터치 기기 값은 resolver 가 그대로 고른다 (ADR-295).

### Fixed

- (판독) 스타일 없는 노드의 작성자 class 가 노드 class 와 같으면 다른 곳을 고친 Apply 에서 지워지던 것 · 한 CSS 속성에 field 둘이 겹치면 앞쪽 편집이 무시되던 것 · `line-height: 24px` 거절 · Design 패널 전용 fill 블록에 `background` 를 넣으면 레이어가 바뀌던 것 · 숨긴 flex frame 의 `display` 를 지우면 거절되던 것.
