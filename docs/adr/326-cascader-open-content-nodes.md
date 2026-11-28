# ADR-326: Cascader 열린 목록을 원본 노드로 — Select 와 같은 구조 · Canvas 펼침 (ADR-322 결정 11 · R6 대체)

## Status

Accepted — 2026-11-28 (사용자 `/execute-adr 326` · [reviews/326.md](reviews/326.md) Round 1 · 2 pending 0 — h1 · m5 를 Phase 0 시제품이 판정해 fixed, CRITICAL/HIGH 전부 fixed) · Proposed — 2026-11-28

> **Phase 0 (G0) 닫힘 (2026-11-28)** — [breakdown §9](design/326-cascader-open-content-nodes-breakdown.md#9-phase-결과): F1 ~ F19 재대조 차이 0 · 시제품 아홉 go. P8 (시작 경로 보존 — 무작위 6,480 건 불일치 0) · P6 (경로 자리 넷 — Chrome · WebKit 8 입력에서 전부 그린 Breadcrumbs 와 보이는 crumb · 메뉴 key 같음, 180 px 메뉴의 `D` → `onAction("D")`) · P1 · P2 · P3 (catalog Popover 노드 + `trigger: "Cascader"` + 한 `Autocomplete` + tree 의 `Dialog` `display: contents` — 지금의 조립과 focus · 가상 focus · 이름 · 접근성 트리 같음, **조건 하나**: 공용 Popover 의 FocusScope 복원을 꺼야 바깥 클릭 뒤 focus 가 여는 Button 으로 돌아온다 → Phase 2) · P4 (owner 가 그리는 글자 · chevron — 코드 선례) · P5 (drill 의 통과 항목 두 단 — 엔진 시험 + 원복 RED) · P9 (행 ↔ record — 쓴 style 이 그 행에만 · 모양 편집은 표 입력 불변). 번들: 기준선 1,668,315 B, 상한 1,677,000 (결정 1 + ADR-323 몫 합산). 다음 Phase 1 — 사용자 결정 2 의 답이 필요하다.
>
> - 발견 (이 ADR 밖): Select 의 열린 목록도 바깥 클릭 뒤 focus 가 `body` 로 간다 (같은 공용 Popover 의 FocusScope — Chrome · WebKit). 사용자에게 보고.

> **Phase 1 (G1) 닫힘 (2026-11-28)** — [breakdown §9](design/326-cascader-open-content-nodes-breakdown.md#9-phase-결과): 문서 구조 (원본 `Popover > SearchField + Breadcrumbs + 「뒤로」 + CascaderList > CascaderItem > Text · Icon` · `accepts.mode` · `bindingMaps.cascaderDrill` · contract 88) · 항목 읽기 한 함수 · 시작 경로 보존 (Builder 표본 창이 시작 값을 자르지 않음 · 단계별 원격 로드의 읽지 않은 가지도 두 쪽이 같은 판정 함수). 판독 1 (HIGH 9) + 수리 검증 1 (HIGH 5) 모두 재현 · 수리. HC4: 항목당 record 3 (결정 2) 이 드러낸 결함 — 연결된 Cascader 의 묶인 prop 쓰기가 record 마다 행 계층 전체를 해석 (3,917 record 67 s) → 같은 instance 아래 record 를 한 번에 해석 (0.37 s). 열기는 Select 1,000 대비 Chrome 1x ×0.31 ~ 0.35 · 4x ×0.21 ~ 0.24 · WebKit 1x ×0.35 ~ 0.58. G1: ADR-322 단위 · live G4 6/6 · G6 11/12 (3번만 실패 — Phase 1 이전 판에서도 실패) · preflight — guard · format · typecheck · registration · css-boundary · chart-contract · agent-catalog 통과, rule-size 만 실패 (`canvas-rendering.md` 55,244 > 55,100 · `panel-structure.md` 39,913 > 39,624 — 이 Phase 가 고치지 않은 규칙 파일, HEAD 그대로 · 보고). 다음 Phase 2 (DOM columns).

> **Phase 2 (G2) 닫힘 (2026-11-28)** — [breakdown §9](design/326-cascader-open-content-nodes-breakdown.md#9-phase-결과): columns 의 열린 내용 = 원본 노드 (Popover 노드 `trigger: "Cascader"` > SearchField + CascaderList = RAC `Menu` > 항목 record 의 행 — catalog id · class · 작성 style · 상태 값 · label Text · 가지 chevron Icon). 필드가 RAC MenuTrigger context 를 늘 주고, `CatalogPopover` 의 내용 감싸기 context 가 검색 범위 (Autocomplete · 검색어 = 열린 동안만) 를 그 Popover 에만 넣는다 · 공용 Popover 의 focus 복원 끔 (P1 조건) · 모든 단계 Menu `escapeKeyBehavior="none"` (루트 잎 Esc 결함). 폭 = 필드 · 테두리 하나 · 목록 최대 300 scroll. 판독 1 (HIGH 1 · MEDIUM 3) + 수리 검증 1 (HIGH 0 · MEDIUM 1 — 300 상한 회귀) 모두 재현 · 수리 — 행 라벨 · chevron 색 상속, 필드 size → 목록 · 모든 단계 행 · 라벨 글자 (연결된 Cascader 의 size 쓰기는 묶음 해석 — resolver 방문 record × 4 안), 원본 Hover 등 상태 값 → 행. G2: live 하니스 Chrome · WebKit 12/12 · 원복 RED 단위 10 + live 3 · ADR-322 G4 6/6 · G6 11/12 (3번만 — Phase 1 이전부터). 번들 Builder initial 1,676,996 / 1,677,000 (Phase 2 +1,141 · 여유 4) — 다음 Phase 의 첫 화면 몫은 상한 재승인이 필요하다. tree · drill 은 Phase 3 까지 ADR-322 조립 그대로. 다음 Phase 3 (DOM tree · drill).

- **출처**: 사용자 요청 `/create-adr` (2026-11-28). 방향을 정한 사용자 원문 (같은 날):
  - 「category컴퍼넌트도 select컴퍼넌트처럼 프러퍼티패널 value section 에서 value 선택과 open 이 되어야 하지않나?」
  - 「Canvas 에도 펼쳐 그림 — Select 처럼 Open 을 켜면 Canvas 에도 펼친 목록을 그려야 Preview · Publish 와 동일한 동작이지 않나」
  - 「popover 의 width가 category 의 width와 동일 하지않다.」
  - 「popover와 목록에 border가 2중이다. 팝오버 구조가 왜 다르지? 동일한 패턴인데 동일하게 해야 일관성이 있지.」
  - 「cascader 프러퍼티 mode를 drill 일때 popover에 breadcumb 의 간격이 컴퍼넌트의 간격과 맞지않다. 그대로 사용하면 되지않나?」
  - 「cascader 프러퍼티에 search 프러퍼티는 제거하고 항상 나타나게 수정」
- **사용자가 이미 답한 확인 항목**:
  - Open 칸의 범위 = 「Canvas 에도 펼쳐 그림」 (2026-11-28 — ADR-322 결정 11 · R6 을 바꾼다).
  - 진행 방식 = 「새 ADR 로 진행」 (2026-11-28 선택 질문 — 구조 전환을 ADR-322 후속 phase 가 아니라 새 ADR 로).
- **같은 날 ADR 밖에서 먼저 고친 것** (이 ADR 의 전제): Design 패널 Value 칸 = 고를 수 있는 항목의 드롭다운 (경로 이름, 다중이면 여러 개 고르기) · `isSearchable` prop 삭제 — 검색 칸은 세 방식 모두 늘 있다.
- **분리 점검 4 질문** (사용자 지시한 분리 — 위 「새 ADR 로 진행」 이 confirm):
  1. base · 응용: ADR-322 가 컴포넌트 자체 (base), 이 ADR 은 같은 컴포넌트의 열린 내용 구조 개정 — 322 가 선행.
  2. schema: 직교가 아니다 — 322 의 원본 template 을 고친다 (322 의 specialization). 그래서 322 뒤.
  3. 선행 전제 재검증: 322 의 전제 「열린 내용은 노드가 아니고 Canvas 는 닫힌 필드만 그린다」 (결정 11 · R6) 를 **승계하지 않는다** — 사용자 결정으로 뒤집는다. 322 의 나머지 결정 (값 = key · 방식 셋 · 데이터 세 모양 · 닫힌 D1 예외 · 단계별 로드) 은 그대로다 (코드 대조 — breakdown §2).
  4. 전제 검증은 이 문서에서 끝낸다 — 판독 라운드로 미루지 않는다.

> **리뷰 Round 1 반영 (2026-11-28, reviewer codex — [reviews/326.md](reviews/326.md))**: 승인 보류 5 건 (HIGH 4 · MEDIUM 1) 을 실행자가 인용 자리의 코드로 모두 확인했고 설계를 고쳤다. 수리 검증 round 는 아직이다.
>
> - **h1 표본 밖 시작 key** → 결정 6 「시작 경로 보존」 · HC2 · G5 (F15). ADR-322 의 「표본 밖 key 는 Canvas 에서 key 글자 — 설계된 비대칭」 도 같이 대체한다.
> - **h2 Library 자리의 `repeat`** → 경로 줄을 반복 행이 아니라 고정 자리 넷으로 (결정 1 · breakdown §4.4, F8 정정 · F18).
> - **h3 항목 개별 스타일** → 보이는 RAC 행을 항목 record 에 잇는다 (결정 2 · HC2 · G5, F17).
> - **h4 `bindingMaps.from`** → 원본 `accepts.mode` · 기본값 (결정 1 · G1, F16).
> - **m5 접힌 경로의 단계 이동** → Breadcrumbs 의 접힌 메뉴가 `onAction` 을 같은 key 로 부른다 (결정 2 · G3, F18).
> - **l6 (LOW deferred)** → Gates 의 집행 수단 문구를 실제 hook 범위로 고쳤다.
>
> **리뷰 Round 2 반영 (2026-11-28, 수리 검증 — reviewer codex)**: h2 · h3 · h4 · l6 종결, h1 (HIGH) · m5 (MEDIUM) 가 남았다. 둘 다 코드로 확인했고 설계를 다시 고쳤다. 설계 판독은 이 두 라운드로 마친다 (reviews/326.md 「Round 2 이후 결정」) — h1 은 Phase 0 시제품 P8, m5 는 P6 이 판정하고, 통과하면 실행자가 근거를 붙여 Round 1 · 2 의 같은 ID 를 `fixed` 로 갱신한다. 그때까지 두 outcome 은 `pending` 이다.
>
> - **h1 가지가 잎으로 바뀜** → 표본 행이 원래의 자식 유무를 싣고, 단계별 로드의 읽지 않은 가지도 두 쪽이 같은 판정 함수를 쓴다 (결정 6, F19). P8 에 무작위 대조를 더했다.
> - **m5 폭이 좁을 때 바로 위 조상** → 폴더 메뉴의 항목을 미리 정하지 않고 전체 경로와 폭 판정 뒤 보이는 끝 crumb 수에서 낸다 (결정 2 · breakdown §4.4).

## Context

### 도메인

- **D1 (DOM · 접근성)**: 변화 없음이 목표다. 열린 내용의 role · `aria-*` · 키 동작은 지금처럼 RAC 가 낸다 (`Menu` + `SubmenuTrigger` · `Tree` · `GridList` · `Breadcrumbs` · `Autocomplete`). ADR-322 의 닫힌 D1 예외 (폼 값 input — `ssot-hierarchy.md` §1) 목록은 넓히지 않는다.
- **D2 (Props)**: Cascader 에 S2 Picker 의 `isOpen` · `defaultOpen` 을 더한다 (Select 가 쓰는 `OVERLAY_OPEN_PROPS` 그대로 — 실행 중 값은 이미 받는다). 새 부품 type 하나 (`CascaderList`) 는 사용자 prop 0. `isSearchable` 은 이미 삭제. Breadcrumbs 의 `onAction` 은 S2 처럼 접힌 메뉴 항목에서도 불린다 (F18 — prop 추가 아님).
- **D3 (시각)**: 열린 상자 · 검색 칸 · 경로 줄 · 항목 행의 모양을 catalog rule 로 옮겨 Canvas 와 DOM 이 같이 읽게 한다. 지금은 DOM 전용 CSS (`CASCADER_PANEL_STYLES`) 다 — D3 대칭 밖.

### 문제

Cascader (ADR-322, 2026-11-27 Implemented) 의 닫힌 필드는 Select 의 부품 노드이지만, 열린 내용은 문서 노드가 아니다 — 실행할 때 항목 표에서 RAC 요소를 직접 만든다. 그 결과 Select 와 같은 picker 인데 다섯 가지가 다르다 (사용자 보고 2026-11-28):

1. Design 패널에 Open 칸이 없고, Canvas 는 펼친 목록을 그리지 못한다 (그릴 record 가 없다).
2. 열린 상자의 폭이 필드 폭과 다르다.
3. 상자와 목록의 테두리가 겹쳐 두 줄로 보인다.
4. drill 방식의 경로 줄 간격이 Breadcrumbs 컴포넌트와 다르다.
5. 열린 내용의 모양이 Cascader 전용 CSS 라 Styles 패널 · 테마 변경이 닿지 않는다.

### 코드 사실 (2026-11-28 실측, HEAD `4438dd4a7` + 같은 날 작업 트리 — F15 ~ F18 은 리뷰 Round 1 뒤 HEAD `a84343a8f` 에서)

- **F1** Select 원본은 열린 내용을 노드로 갖는다 — `component-select` 루트의 자식 `__popover` (`type-Popover`) > `__listbox` (ListBox 원본 instance, 항목은 `slotFills`) (`catalog/document/generated/reusableOriginLibrary.ts:6559-6972`). Cascader 원본에는 Popover 가 없고 `CascaderItem` 이 루트 직계 자식이다 (`catalog/document/cascaderOrigins.ts:48-60`).
- **F2** Select 의 Popover 노드는 catalog renderer 가 그린다 — `popover: CatalogPopover` (`runtime/domRegistry.runtime.ts:146`) 가 RAC `PopoverContext` 를 읽고, 공용 `Popover` 가 늘 `data-size` 를 싣는다 (`components/Popover.tsx:84`). Cascader 는 lazy chunk 가 RAC `Popover` 를 직접 그려 `data-size` 가 없다 (`runtime/cascaderMenu.components.tsx:167`, `cascaderPanel.components.tsx:213` · `:311`).
- **F3** 2중 테두리 · 폭의 원인: Menu 시트의 「Popover 안 Menu 는 테두리 없음」 규칙은 `.react-aria-Popover[data-trigger="MenuTrigger"][data-size] > .react-aria-Menu` 다 (`components/styles/generated/Menu.css:72-86`) — `data-size` 없는 Cascader 의 Popover 에는 걸리지 않아 Popover 기본 (padding 8 · 폭 416) 과 Menu 자기 테두리가 같이 남는다. Select 의 폭은 rule 블록 `.react-aria-Popover[data-trigger="Select"]` 의 `width: var(--trigger-width)` 다 (`generated/componentRulesTable.ts:1862-1893`).
- **F4** Canvas 는 그 rule 블록을 부품 규칙으로 읽는다 — `overlayExternalPartRules` 가 선택자에 `.react-aria-Popover[data-trigger="<부모 type>"]` 이 든 블록만 번역한다 (`catalog/document/rulePartRules.ts:2187-2242`). Cascader 의 블록은 `.react-aria-Popover.cascader-panel` 이라 Canvas 에 닿지 않는다 (`componentRulesTable.ts:1637-1751`).
- **F5** Canvas 는 열린 overlay 를 떠 있는 층으로 그리는 장치를 갖고 있다 — 소유자 (`OVERLAY_OPEN_OWNERS` — `runtime/overlayState.ts:12-23`, Select · ComboBox 포함 · Cascader 없음) 의 `isOpen` 이면 본체를 숨기지 않고 (`presence.ts:1600-1617`), 닻 요소 기준으로 놓으며 (`overlayLayout.ts:62-114` — picker 는 여는 Button), Select · ComboBox 의 폭은 닻 폭이다 (`compositionRoot.ts:6445-6463` `catalogPickerMenuWidth`).
- **F6** Cascader 의 항목 읽기는 모두 「Cascader 의 직계 자식 중 `CascaderItem`」 을 전제한다 — `cascaderStaticItems` (`runtime/cascader.ts:284-314`), 바인딩 명령이 반복 항목을 Cascader 직계에 넣는 것 (`apps/builder/src/builder/catalogRuntime/dataBindingCommand.ts:106-130`), resolver 의 행 전달 (`resolution/resolver.ts:3667-3670` `["Tabs","TabList","Cascader"]`), 항목 표 (`document/collectionItems.ts:127-134` — `list` 없음), DOM 의 자식 구독 (`runtime/delegatedDom.runtime.ts:4682-4785`). `catalogRowItemGroups` (`commands/rowTemplate.ts:55-79`) 만 감싸개를 건넌다.
- **F7** template 노드를 prop 값에 따라 넣고 빼는 장치가 있다 — 정의의 `bindingMaps` (prop 값 → 글자) 와 노드의 `presentWith` (그 글자가 비면 자리 없음) (`resolver.ts:4309-4314`, 쓰임 `document/filterBarOrigins.ts:51-56`). prop 쓰기는 그 자리를 다시 해석한다.
- **F8** (Round 1 정정) 반복 항목의 행을 데이터 밖에서 주는 소스 (Select 값 모양 · Pagination 쪽 번호 · Table 열 메뉴) 는 모두 **project 노드** 의 `repeat` 위에 선다 — resolver `repeats()` 가 `lib:` 자리를 빼고 (`resolution/resolver.ts:1731-1735`) `repeatRows` 가 거기서 바로 끝난다 (`:1749`). library template 은 `repeat` 필드를 받지 않는다 (`document/validation.ts:3116-3138` — `UNKNOWN_FIELD`). 원본 template 의 자리를 행으로 늘릴 장치는 없다.
- **F9** 엔진은 `display: contents` 를 구현한다 (`.claude/rules/layout-engine.md` §display: contents) — 상자 없는 노드의 자식을 부모 흐름에 놓는다.
- **F10** RAC `Popover` 가 `trigger` 이름으로 가르는 동작은 `SubmenuTrigger` · `PreviewTrigger` 둘뿐이다 (`react-aria-components@1.22.1/dist/private/Popover.mjs:90` · `:124-137`) — 그 밖의 이름은 `data-trigger` 값으로만 쓰인다 (`:196`).
- **F11** 노드가 아닌 것을 owner 가 자기 상자에 그리는 선례: Step 의 표식 · 선 (`runtime/stepList.ts:131` `catalogStepChromeDom`), Rating 의 별, Select 의 chevron 글리프 (`.claude/rules/catalog-subparts.md`).
- **F12** `LIBRARY_CONTRACT_VERSION` 87 (`document/types.ts:217`) — 옛 contract 의 문서는 열리지 않고 변환하지 않는다 (`:221`).
- **F13** Builder initial 번들 1,667,731 B — 절대 상한 1,668,000 까지 **269 B** (`apps/builder/scripts/adr201-bundle-gate.mjs:28` · ADR-322 breakdown §8 Phase 6). Preview 상한 327,000.
- **F14** 성능 선례: Preview 는 Cascader 의 행을 전부 읽고 (`catalogPreviewSession.ts:4967-4973` `readsWholeRows`), 열린 내용은 보이는 단계만 RAC collection 에 넣는다 (tree = 펼친 가지 · columns = 하위 menu 를 열 때) — 5,000 끝 항목에서 Select 1,000 대비 ×0.19 ~ 0.43 (ADR-322 HC5).
- **F15** Builder 와 Preview 는 같은 연결에서 다른 행을 읽는다 — Builder 는 기본 창 (`collections/resolveCollectionItems.ts:37` 100) 으로 읽어 (`apps/builder/src/builder/catalogRuntime/catalogDataRead.ts:119-141`) 평면 계층의 뿌리를 100 에서 자르고 (`runtime/dataBinding.ts:1380-1382`), 중첩 계층은 뿌리 행 100 (`:1333`), 단계 표는 단계마다 창 100 뒤에 부모로 거른 다음 화면 높이 표본으로 한 번 더 자른다 (`resolver.ts:1752-1763` · `:1519-1539`). Preview 는 전부 읽는다 (`catalogPreviewSession.ts:3484-3490`). 부모 120 × 자식 1 에서 시작 값 `R120-1` 은 Builder 표에서 `missing` · Preview 표에서 `item` (부모 `R120`) 이다 (리뷰 재현). ADR-322 는 이것을 닫힌 필드의 「설계된 비대칭」 으로 두었다 (322 breakdown Phase 4 기록).
- **F16** `bindingMaps.from` 은 그 composite 정의의 `accepts` 에 있는 키여야 한다 (`document/validation.ts:3090-3107` — `BINDING_MAP_FROM`). Cascader 원본의 `accepts` 는 `label` · `description` · `errorMessage` · `placeholder` · `iconName` 뿐이고 `mode` 가 없다 (`document/cascaderOrigins.ts:15-21`).
- **F17** 항목 표는 항목 record 를 가리키지 않는다 — `cascaderStaticItems` 가 key · 이름 · 비활성 · 하위만 옮기고 (`runtime/cascader.ts:284-314`), 열린 RAC 행은 `id={entry.pathId}` 뿐이다 (`runtime/cascaderMenu.components.tsx:132-158`). 항목 record 에 쓴 배경색은 record 에만 남고 DOM 행에는 `data-catalog-id` 도 inline style 도 없다 (리뷰 재현).
- **F18** S2 Breadcrumbs 가 그리는 crumb 은 많아야 넷이다 — 다 들어가고 넷 이하면 전부, 아니면 첫 crumb + 폴더 메뉴 + 끝 한둘 (`runtime/breadcrumbsCollapse.ts:13-14` · `:82-112` · `:120`, Canvas `settleBreadcrumbs` 와 DOM `BreadcrumbsRun` 이 같이 읽는다). 접힌 crumb 의 메뉴 항목은 `href` 만 받고 `onAction` 을 부르지 않는다 (`runtime/delegatedDom.components.tsx:659-672`). S2 는 그 메뉴에 Breadcrumbs 의 `onAction` 을 그대로 준다 (`@react-spectrum/s2@1.8.2/src/Breadcrumbs.tsx:195`).
- **F19** (Round 2) 항목이 가지인지 잎인지는 표를 만들 때 남아 있는 자식에서 다시 정해진다 — `hasChildren = children.length > 0 || hasChildItems` · `pickable = anyLevel || !hasChildren` (`runtime/cascader.ts:113` · `:123`), 겹침은 고를 수 있는 항목끼리만 센다 (`:140-143`). 창이 자식을 모두 자른 가지는 잎이 되어 겹침 판정이 바뀐다. 단계별 로드의 읽지 않은 가지 (`branchKeys` — `runtime/catalogPreviewSession.ts:3044-3115`) 는 Preview 의 표에만 들어온다 (`runtime/delegatedDom.runtime.ts:4749`) — Canvas 의 표는 받지 않는다 (`runtime/presence.ts:1367` · `:4456` · `:4843`, `apps/builder/src/builder/catalogRuntime/singleSelection.ts:221`). 같은 캐시 행에서 시작 값 `11` 이 Builder 는 「서울」, Preview 는 `11` 이다 (리뷰 재현). 막 연 Preview 는 자식 단계를 읽지 않는다 — 세 방식 모두 첫 열기의 `load` 0 회 (리뷰 실측).

### 레퍼런스

- **Select · ComboBox (이 저장소)**: `picker > … + Popover > ListBox > 항목` — 열린 내용이 부품 노드이고 Canvas · DOM · Layers · Styles 패널이 같은 노드를 읽는다 (`.claude/rules/catalog-subparts.md` 「picker 의 선택 목록」).
- **S2 Picker** (`@react-spectrum/s2` 1.8.2): 열린 목록의 폭은 `menuWidth`, 없으면 트리거 폭. Cascader 는 S2 에 없어 (ADR-322 F1) 필드로서의 값은 Picker 를 따른다.
- **S2 Breadcrumbs** (같은 판): 접힘 규칙과 접힌 메뉴의 `onAction` (F18).
- 대조 표는 [breakdown §2](design/326-cascader-open-content-nodes-breakdown.md).

### Hard constraints

- **HC1** ADR-322 의 HC1 (새 런타임 의존성 0) · HC2 (D1 예외 목록 그대로 — 정적 검사 `adr322D1Static.static.test.ts`) · HC4 (값 = key) · HC7 (키보드만으로 전부) 을 그대로 지킨다.
- **HC2** 대칭: 같은 작성 값에서 Open 을 켠 Canvas 와 Preview 를 막 연 화면의, 열린 상자 rect 와 보이는 항목 행 (열린 상자의 잘림 안에 있는 행) 의 key · rect 가 방식 셋 모두 ±1 px 로 같다 (기준값 = 실제 Chrome). 시작 값이 Builder 의 표본 창 밖에 있어도 (F15), 항목 하나에만 모양을 써도 (F17) 같다.
- **HC3** Cascader 전용 열린 모양 CSS 0 — `CASCADER_PANEL_STYLES` 를 지우고, 열린 내용의 모든 값은 Canvas 가 읽는 rule 에서 나온다 (정적 검사).
- **HC4** 성능: ADR-322 HC5 유지 — 5,000 끝 항목 · 4 단에서 열기 → 첫 목록이 Select 기준선의 1.5 배 안 (1x · 4x). Preview 의 record 수는 지금보다 항목 수에 비례해 늘지 않는다.
- **HC5** 번들: initial Δ 는 사용자 결정 1 의 몫 안 (지금 여유 269 B — F13). 열린 내용 조립은 lazy chunk 로 남는다.
- **HC6** 문서 변환 코드 0 — contract 를 올리고 옛 문서는 열리지 않는다 (F12 · 개발 단계 정책).

### Soft constraints

- 사용자는 비개발자다 — 같은 종류의 필드 (Select · Cascader) 는 패널 · Layers · Canvas 에서 같은 방식으로 다뤄져야 한다.
- 방식 셋 (`columns` · `tree` · `drill`) 은 그대로 둔다 (ADR-322 사용자 결정 1).
- Builder 의 데이터 행은 디자인 표본이다 — Canvas 의 펼친 목록도 표본 행으로 그린다. 다만 시작 값이 가리키는 행은 표본에 남긴다 (결정 6 — 「표본 행만 정확」 의 그 행이다).

## Alternatives Considered

### 대안 A: 구조는 그대로, 실행 중 요소에 공용 시트만 걸기

- 설명: lazy chunk 가 그리는 RAC `Popover` 에 `data-size` 를 주고 Cascader 전용 CSS 를 줄여 Menu · Breadcrumbs 시트가 걸리게 한다. 폭은 CSS 한 줄. 문서 구조 · contract 무변경. Canvas 는 닫힌 채로 둔다.
- 근거: 가장 작은 변경 — 2 ~ 4 번 (폭 · 테두리 · 경로 줄) 은 고쳐진다.
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 한계: 1 번 (Canvas 펼침 — 사용자 결정) 과 5 번을 풀지 못한다. 열린 모양이 계속 DOM 전용이라 D3 대칭 밖에 남는다.

### 대안 B: 원본에 열린 내용의 껍데기 노드 — Popover · 검색 칸 · 경로 줄 · 목록 상자, 항목은 그 목록 상자 안으로 (채택)

- 설명: Cascader 원본에 Select 와 같은 자리의 `Popover` 노드를 넣는다. 그 안에 검색 칸 (SearchField 원본 instance), drill 방식에만 서는 경로 줄 (`Breadcrumbs` 노드 + crumb 자리 넷) · 「뒤로」 버튼 (F7 의 장치), 그리고 단계 목록 상자 (새 부품 type `CascaderList`) 를 두고, `CascaderItem` 계층을 목록 상자 안으로 옮긴다. 방식을 바꿔도 노드 구조는 같다.
  - **DOM**: Popover · 검색 칸 · 경로 줄은 catalog renderer 가 필드의 RAC context 안에서 그린다 (Select 와 같은 길 — F2). 목록 상자 자리에는 지금의 lazy chunk 가 방식에 맞는 RAC 컬렉션 (`Menu` · `Tree` · `GridList`) 을 항목 표에서 만든다 — 보이는 단계만 만드는 지금 방식 그대로 (F14). 그려지는 행은 자기 항목 record 의 DOM 입력 (id · 작성 모양) 을 받는다 (F17).
  - **Canvas**: Open 이면 Popover 를 떠 있는 층에 그리고 (F5), 「막 연 화면」 을 그린다 — 어떤 항목이 보이고 어디가 펼쳐졌는지를 순수 함수 하나가 정하고 Preview 의 시작 상태도 그 함수를 읽는다. 항목 행 (이름 · chevron · 선택 표시) 은 `CascaderItem` 이 자기 상자에 그린다 (F11 — 노드 수 그대로). 시작 값의 경로 행은 표본 창이 자르지 않는다 (F15).
  - **모양**: 열린 상자 규칙은 Cascader rule 의 `[data-trigger="Cascader"]` 블록 하나 (Select 의 블록과 같은 값 — F3 · F4 · F10), 항목 행은 `CascaderItem` rule. 전용 CSS 는 지운다.
- 근거: Select · ComboBox 의 구조 (레퍼런스) 와 같다. 이미 있는 장치 (F5 · F7 · F9 · F11 · F18) 를 쓰고 새 그리기 경로를 만들지 않는다.
- 위험: 기술(M) / 성능(M) / 유지보수(L) / 마이그레이션(M)
  - 기술: 항목 위치를 전제한 읽기 다섯 곳 (F6) 과 Canvas 의 방식별 항목 표시 (drill 은 조상 항목이 상자 없이 통과 — F9), 행 읽기의 시작 경로 보존 (F15), 경로 자리 넷의 접힘 판정 (F18) 을 같이 고친다.
  - 성능: Preview 의 항목 record 마다 표시 상태 파생이 붙는다 — 항목 수 × 1 (HC4 로 잰다).
  - 마이그레이션: contract +1, 옛 문서는 열리지 않는다 (HC6).

### 대안 C: 방식마다 catalog 컴포넌트 전체를 노드로 — Menu + SubmenuTrigger · Tree · GridList + Breadcrumbs

- 설명: 열린 내용을 기존 컴포넌트의 완전한 노드 트리로 둔다. 항목은 방식에 따라 `MenuItem` (가지는 `SubmenuTrigger > MenuItem + Popover > Menu`) · `TreeItem` · `GridListItem` 노드다. 방식을 바꾸면 명령이 본문 서브트리를 통째로 바꾼다.
- 근거: 새 부품 type 0 — 기존 renderer · rule 을 그대로 쓴다.
- 위험: 기술(**H**) / 성능(**H**) / 유지보수(**H**) / 마이그레이션(M)
  - 기술: 방식 변경이 항목 type 셋 사이의 변환 명령이 된다 (작성한 항목 · 반복 표시 · 단계별 연결을 옮김). Menu 는 계층 행 연결이 없다 (`collectionItems.ts:83-91` — MenuItem 에 `recursive` 없음, `resolver.ts:1685-1692` `isTreeItemRecord` 가 MenuItem 을 뺀다, `SubmenuTrigger` 는 행 type 이 아니다).
  - 성능: 항목마다 노드 3 ~ 5 (MenuItem 원본의 부품) — 5,000 항목에서 record 가 몇 배가 되고, catalog renderer 는 모든 항목을 요소로 만든다 (보이는 단계만 만드는 지금 구조 — F14 — 를 잃는다).
  - 유지보수: 값 · 겹치는 key · 단계별 로드 · 검색이 세 구조에 각각 붙는다.

### 대안 D: 문서는 그대로, Canvas 가 항목 표에서 열린 목록을 직접 그리기

- 설명: 대안 A 에 더해, Canvas 가 record 없이 항목 표를 읽어 Popover · 행을 Skia 로 합성한다.
- 근거: contract 무변경으로 Canvas 펼침을 얻는다.
- 위험: 기술(M) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)
  - 유지보수: 열린 모양의 정의가 둘이 된다 (DOM 은 시트, Canvas 는 합성 코드) — `ssot-hierarchy.md` §6 의 「Skia 전용 시각 표현」 · 「한 consumer 에만」 금지에 닿는다. record 가 없어 선택 · Layers · Styles 패널 · 눈금자 · hit 판정이 모두 예외 경로가 된다 (`canvasBinding.ts` · `canvasSelectionGeometry.ts` · `targetPick.ts` 가 overlay 본체 record 를 읽는다).

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| ---- | :--: | :--: | :------: | :----------: | :---: |
| A    |  L   |  L   |    M     |      L       |   0   |
| B    |  M   |  M   |    L     |      M       |   0   |
| C    |  H   |  H   |    H     |      M       |   3   |
| D    |  M   |  L   |    H     |      L       |   1   |

HIGH 0 인 대안이 둘 (A · B) 이라 루프는 필요 없다. A 는 위험이 가장 낮지만 사용자 결정 (Canvas 펼침) 을 채우지 못해 요구 미달이다.

## Decision

**대안 B** — Cascader 원본에 열린 내용의 껍데기 노드를 두고, 항목 계층을 목록 상자 안으로 옮긴다.

1. **구조** — `Cascader > 라벨 행 + Button + Description + FieldError + Popover > SearchField + Breadcrumbs (drill) + 「뒤로」 Button (drill) + CascaderList > CascaderItem…`. Select 의 `Popover > ListBox > 항목` 과 같은 자리 · 같은 깊이다. 방식 (`mode`) 은 노드 구조를 바꾸지 않는다 — drill 전용 부품만 `bindingMaps` + `presentWith` 로 선다. 그 조건이 읽는 `mode` 를 원본의 입력으로 선언한다 (`accepts.mode` · 기본값 `columns` — F16). 경로 줄은 반복 행이 아니라 **crumb 자리 넷** 이다 — 원본 template 의 자리는 행으로 늘릴 수 없고 (F8), S2 Breadcrumbs 가 그리는 crumb 은 많아야 넷이다 (F18).
2. **DOM** — Popover · SearchField · Breadcrumbs 노드는 catalog renderer 가 필드의 RAC context 안에서 그린다. `CascaderList` 자리는 lazy chunk 가 방식에 맞는 RAC 컬렉션을 항목 표에서 만든다 (보이는 단계만). 그려지는 행은 항목 표가 가리키는 항목 record 의 DOM 입력을 받는다 — catalog renderer 가 노드에 붙이는 것과 같은 id · 작성 모양 (F17). 하위 단계 Popover (columns) 는 catalog Menu 의 하위 메뉴 시트를 그대로 받는다. 경로 줄의 접힌 조상은 폴더 메뉴 항목이고, 보이는 crumb 과 같은 key 로 단계를 옮긴다 (Breadcrumbs 공용 수정 — S2 와 같게, F18). 메뉴의 항목은 미리 정하지 않는다 — 전체 경로에서, 폭 판정 뒤 실제로 보이는 끝 crumb 을 뺀 사이 전부다 (보이지도 메뉴에 있지도 않은 조상 0).
3. **Canvas** — Cascader 를 열림 소유자 목록에 넣는다. Open 이면 「막 연 화면」 을 그린다: columns = 첫 단계, tree = 첫 단계 + 고른 항목의 조상 펼침, drill = 고른 항목의 단계 + 경로. 그 판정은 순수 함수 하나이고 Preview 의 시작 상태가 같은 함수를 읽는다. 경로 줄의 crumb 글자 · 접힘도 순수 함수 하나에서 나온다. 하위 단계 (columns 의 둘째 열부터) 는 그리지 않는다 — 막 연 Preview 에도 없다.
4. **모양** — 열린 상자 (폭 = 필드 폭 · 안쪽 여백 · 테두리 하나) 는 Cascader rule 의 한 블록, 항목 행은 `CascaderItem` rule, 검색 칸 · 경로 줄은 자기 컴포넌트의 rule. Canvas 부품 규칙과 생성 CSS 가 같은 블록을 읽는다. `CASCADER_PANEL_STYLES` 는 지운다.
5. **Design 패널** — Value 절에 Open (Select 의 `OVERLAY_OPEN_PROPS`). 안쪽 Popover 의 Open 칸은 내지 않는다 (Select 와 같다 — `catalogOwnerDecidedProps`).
6. **데이터 · 시작 경로 보존** — 연결은 지금처럼 Cascader 노드에, 반복 항목은 `CascaderList` 안에 선다. 세 모양 (중첩 · 평면 · 단계마다 다른 표) · 단계별 로드 · 겹치는 key 판정은 그대로다 — 읽는 자리만 옮긴다. 달라지는 것은 Builder 의 표본 창 하나다: 시작 값의 판정 (항목 · 겹침 · 없음) 과 조상 사슬을 **계층 전체에서 먼저** 정하고, 표본 창은 그 뒤에 자르되 시작 key 를 가진 행 (겹침 판정이 같도록 모두) · 그 조상 · 막 연 화면에서 열리는 단계의 행을 남긴다 (F15). 남긴 표본의 행은 **원래의 자식 유무** 를 싣는다 — 창이 자식을 잘라도 가지는 가지다 (F19). 단계별 로드의 읽지 않은 가지도 두 쪽이 같은 판정 함수로 정한다 (Canvas 는 「아직 아무 단계도 읽지 않은」 상태 = 막 연 Preview). 그래서 Canvas 와 Preview 의 항목 표는 시작 값에 대해 같은 답을 내고, 보이는 행의 chevron 도 같다. ADR-322 의 「표본 밖 key 는 Canvas 에서 key 글자」 는 닫힌 필드에서도 없어진다.
7. **ADR-322 와의 관계** — 322 의 결정 11 (「Canvas 는 닫힌 필드만」) · R6 · breakdown §4.6 · Phase 4 기록의 「설계된 비대칭」 을 이 ADR 이 대체한다. 나머지 결정은 유효하다. 322 본문의 대체 표시는 이 ADR 이 Implemented 될 때 넣는다.

**위험 수용 근거**: B 의 M 셋은 모두 이미 있는 장치 위의 변경이고 (떠 있는 overlay · 조건부 template 자리 · `display: contents` · owner 가 그리는 부품 · Breadcrumbs 접힘 판정), 각 위험에 되돌릴 수 있는 Gate 가 있다 (G0 시제품 · G1 기존 322 게이트 재통과 · G5 대칭 · G6 성능 · 번들).

**기각 사유**

- **A**: 사용자 결정 「Canvas 에도 펼쳐 그림」 을 채우지 못하고, 열린 모양이 DOM 전용으로 남는다 (5 번).
- **C**: 방식 변경이 구조 변환이 되고, Menu 에 없는 계층 행 연결을 새로 만들어야 하며, 5,000 항목 성능 구조 (보이는 단계만) 를 잃는다 — HIGH 3.
- **D**: 열린 모양의 정의가 둘이 되고 record 없는 그리기가 선택 · Layers · 패널 전부에 예외를 만든다 — 유지보수 HIGH, D3 금지 패턴.

경로 줄에서 버린 길 둘 (Round 1 h2):

- **library template 자리에 반복 행을 허용**: ADR-310 의 「반복 = project 노드」 계약을 넓힌다 — resolver 의 반복 세 경로 · 행 안 편집 대상 · Code 보기의 렌더 함수가 모두 project 노드를 전제한다. 경로 줄 하나를 위해 넓힐 계약이 아니다.
- **팔레트로 놓을 때 Cascader 가 소유하는 반복 crumb 노드를 같이 넣기**: `mode` 는 패널 말고도 변수 · instance override · 상태 규칙으로 바뀌는데 그 길들은 노드를 넣지 못한다. 사용자가 그 노드를 지우면 경로 줄이 사라진다.

> 구현 상세: [326-cascader-open-content-nodes-breakdown.md](design/326-cascader-open-content-nodes-breakdown.md)

### 사용자 결정 (3 건 — 그 Phase 에 닿을 때 묻는다)

1. **번들 몫 · 상한** (Phase 1 전) — **확정 (사용자 답 2026-11-28): Builder 절대 상한 1,672,000 재승인** (만료 2026-12-25 그대로 — Phase 0 P7 기준선 1,668,315 B 가 이미 315 B 초과, 이 ADR 몫 약 +3,000). Builder initial 여유가 269 B 다 (F13). 권고: 이 ADR 의 몫 +3,000 B · 절대 상한 재승인 (전용 CSS 삭제분이 일부 상쇄 — Phase 0 에서 기준선을 재고 숫자를 다시 보고한다).
2. **항목 글자를 노드로 둘지** (Phase 1) — **확정 (사용자 답 2026-11-28): 대안 — 항목마다 Text · Icon 자식 노드** (권고 「직접 그림」 대신. 항목당 record 가 늘어 HC4 를 Phase 1 에서 다시 잰다). 권고: `CascaderItem` 이 이름 · chevron 을 직접 그린다 (노드 수 그대로, Layers 는 항목 한 줄). 대안: 항목마다 Text · Icon 자식 노드 (Layers 에서 글자를 따로 고를 수 있지만 항목당 record 3 배 — HC4 재측정 필요).
3. **Library page 의 열린 표본** (Phase 6) — 권고: 넣지 않는다 (Select · ComboBox 카드도 닫힌 채다). 대안: Cascader 카드에 열린 표본 하나.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                          | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 항목 자리 이동이 데이터 연결을 깬다 — 직계 자식을 전제한 읽기 다섯 곳: `runtime/cascader.ts:284-314` (`cascaderStaticItems`), `apps/builder/src/builder/catalogRuntime/dataBindingCommand.ts:106-130`, `resolution/resolver.ts:3667-3670` · `:4633-4638`, `document/collectionItems.ts:127-134`, `runtime/delegatedDom.runtime.ts:4682-4785`                                                                  |  HIGH  | 읽기를 「Cascader 의 항목 목록」 함수 하나로 모은다. G1 — ADR-322 의 단위 (data · levels · wiring · form · run) 와 live G4 · G6 (연결 세 모양 · 단계별 로드) 재통과 · 원복 RED                                                                                                                                                       |
| R2  | Canvas 의 막 연 화면이 Preview 와 갈린다 — 방식별 보이는 항목 · 펼침 · 선택 표시 · 상자 폭 (`runtime/presence.ts:1508-1617` 숨김 판정, `runtime/overlayLayout.ts:62-114` 닻, `runtime/compositionRoot.ts:6330-6480` `settleOverlays`, `runtime/cascaderPanel.components.tsx` 의 시작 `expanded` · `level`)                                                                                                    |  HIGH  | 시작 상태를 순수 함수 하나로 — Canvas 표시 파생과 DOM 초기 state 가 같이 읽는다. G5 — 세 방식 × 값 있음 · 없음의 대칭 하니스 (Chrome rect ±1 px) · `/cross-check`                                                                                                                                                                    |
| R3  | 번들 — 여유 269 B (`apps/builder/scripts/adr201-bundle-gate.mjs:28`, `.github/workflows/deploy.yml:93-94`, ADR-322 breakdown §8 Phase 6). 첫 화면에 실리는 것: rule 블록 · 표시 파생 · 열림 목록                                                                                                                                                                                                              |  HIGH  | 사용자 결정 1 · Phase 마다 A/B 실측 · 조립은 lazy chunk 유지. 넘으면 그 Phase 를 닫지 않고 보고                                                                                                                                                                                                                                      |
| R4  | 성능 — 항목 record 마다 표시 상태 파생, Preview 는 행 전부를 읽는다 (`catalogPreviewSession.ts:4967-4973`). Builder 는 시작 key 를 계층 전체에서 찾는다 (중첩 · 단계 표 모양은 원본 행 훑기)                                                                                                                                                                                                                  |  MED   | 파생은 열려 있을 때만 · 항목당 O(1) (부모 사슬 캐시). 시작 key 색인은 원본 행 배열 단위로 memo. G6 — ADR-322 HC5 하니스 재측정 + 닫힌 필드의 값 변경 1 회 비용 + Builder 편집 1 회 (5,000 행 연결)                                                                                                                                   |
| R5  | D1 — catalog Popover 노드로 옮기며 RAC context 연결 (메뉴 이름 · focus 복원 · Esc) 이 달라질 수 있다. tree · drill 의 RAC `Dialog` 는 문서 노드가 아니라 배치를 맞춰야 한다                                                                                                                                                                                                                                   |  MED   | Phase 0 시제품 (context 이름 · `Dialog` 배치의 접근성 트리 — Chrome · WebKit) · `adr322D1Static` 유지 · G2 / G3 의 키보드 · 접근성 트리 판정 · G6 VoiceOver 청취 (사용자 확인)                                                                                                                                                       |
| R6  | contract +1 — 옛 문서 (ADR-322 뒤 하루치 Cascader 포함) 가 열리지 않는다                                                                                                                                                                                                                                                                                                                                      |  LOW   | 개발 단계 정책 (변환 없음 — HC6). CHANGELOG 에 적는다                                                                                                                                                                                                                                                                                |
| R7  | 경로 줄 — crumb 자리 넷의 접힘이 「모든 crumb 을 그린 뒤 접는」 S2 판정과 어긋날 수 있다 (실제 crumb 수가 넷을 넘을 때 · 폭이 좁을 때)                                                                                                                                                                                                                                                                        |  MED   | 접힘 판정 함수에 실제 crumb 수를 넘긴다 (한 함수 — Canvas · DOM). 메뉴 항목은 전체 경로와 판정 결과에서 낸다. Phase 0 P6 이 깊이 2 · 4 · 6 × 폭 둘 (끝 둘이 보이는 폭 · 하나만 보이는 폭) 에서 「전부 그린 Breadcrumbs」 와 보이는 crumb · rect · 메뉴의 모든 key 를 대조한다. 어긋나면 멈추고 보고                                  |
| R8  | 표본 창이 시작 경로를 자른다 — 같은 값에서 Canvas 와 Preview 가 다른 단계를 연다. 자르는 자리 넷: `runtime/dataBinding.ts:1380-1382` (평면 뿌리) · `:1333` (중첩 뿌리), `resolution/resolver.ts:1752-1763` (단계 표의 창 · 부모 거르기 · 높이 표본), `apps/builder/src/builder/catalogRuntime/catalogDataRead.ts:119-141` (기본 창). Preview 는 `runtime/catalogPreviewSession.ts:3484-3490` 에서 전부 읽는다 |  HIGH  | 결정 6 — 판정을 창 앞에 두고 보존 행과 자식 유무를 남긴다 (`runtime/cascader.ts:113` · `:123` 의 가지 판정이 표본에서도 같게). Phase 0 P8 이 세 모양에서 표를 대조하고 (선택 key 의 판정 · 시작 부모 — 무작위 계층 × 창 대조 포함), G5 가 부모 120 × 자식 1 · 시작 `R120-1` 을 세 방식 × 세 모양으로 잰다 (행 key 와 rect). 원복 RED |
| R9  | 항목 하나에 쓴 모양이 Preview 행에 닿지 않는다 — 표가 record 를 가리키지 않는다 (`runtime/cascader.ts:284-314`), RAC 행은 `pathId` 뿐 (`runtime/cascaderMenu.components.tsx:132-158` · `cascaderPanel.components.tsx` 의 Tree · GridList 행 · `cascaderSearch.components.tsx` 의 결과 행). Canvas 는 그 record 를 그리므로 갈린다                                                                             |  HIGH  | 결정 2 — 표 항목에 record id, 그려지는 행이 그 record 의 DOM 입력을 받는다. G5 — 한 항목의 배경 편집 · Undo 를 이웃 행과 같이 Canvas · Chrome 에서 대조 (세 방식 + 검색 결과)                                                                                                                                                        |
| R10 | drill 전용 부품의 조건이 등록에서 거부되거나 (`document/validation.ts:3090-3107`) 방식 변경에 서고 사라지지 않는다 (`document/cascaderOrigins.ts:15-21` 의 `accepts`, `resolution/resolver.ts:2609-2641` `templateBindings`, `:4309-4314` `presentWith`)                                                                                                                                                      |  MED   | 결정 1 — `accepts.mode` · 기본값. G1 — 원본 등록 검증 통과 + `mode` 를 drill ↔ columns 로 쓰기 · Undo · instance override 에서 두 부품 record 가 서고 사라짐 (Canvas record · DOM)                                                                                                                                                   |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                   | 실패 시 대안                                                             |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | Phase 0 끝 | 코드 사실 F1 ~ F19 재대조 · 시제품 아홉 (breakdown §6) go — P6 · P8 통과가 리뷰 m5 · h1 의 종결 근거 · 번들 기준선 · 사용자 결정 1 답                                                                                                                       | no-go 항목은 breakdown 의 대체 길로, 대체 길도 막히면 멈추고 사용자 보고 |
| G1   | Phase 1 끝 | 새 구조 · contract 88 에서 ADR-322 의 기존 판정 전부 재통과 — 단위 (data · levels · wiring · form · run) · live G4 · G6 (Chrome · WebKit) · 원복 RED · `pnpm codex:preflight` (R1). 원본 등록 검증 통과 · 방식 변경에 drill 부품이 서고 사라짐 (R10)        | 깨진 읽기를 항목 목록 함수로 다시 모은다 — 구조 변경은 되돌리지 않는다   |
| G2   | Phase 2 끝 | columns: 열린 상자 폭 = 필드 폭 · 테두리 하나 (Chrome computed style) · 키보드 · 접근성 트리가 322 G2 와 같음 · 전용 CSS 의 columns 몫 0                                                                                                                    | 어긋나는 값은 rule 블록에서 고친다 (DOM 전용 CSS 금지)                   |
| G3   | Phase 3 끝 | tree · drill: 경로 줄이 Breadcrumbs 컴포넌트의 computed 간격과 같음 · 보이는 crumb 과 접힌 메뉴의 모든 항목이 그 단계로 이동 (깊이 6 × 폭 둘) · 322 G3 의 키보드 · 접근성 트리 · `CASCADER_PANEL_STYLES` 삭제 (HC3 정적 검사)                               | 경로 줄 판정이 어긋나면 멈추고 보고 (R7)                                 |
| G4   | Phase 4 끝 | Design 패널 Open → Canvas 에 columns 의 막 연 화면 · 끄면 닫힘 · Undo · Preview 의 시작 열림 · 열린 상자 선택 테두리 (live)                                                                                                                                 | 열림 목록 누락을 breakdown §5 표와 대조                                  |
| G5   | Phase 5 끝 | 대칭 하니스 — 세 방식 × (값 없음 · 깊은 값 · 표본 창 밖 값) × 크기에서 열린 상자 · 보이는 행의 key 와 rect 가 Canvas = Chrome ±1 px, 선택 key 의 판정 · 시작 부모가 같음 (HC2 · R2 · R8). 한 항목의 모양 편집 · Undo 가 그 행에만 닿음 (R9). `/cross-check` | 어긋난 축을 시작 상태 함수 · 보존 규칙 · rule 에서 고친다                |
| G6   | Phase 6 끝 | HC4 재측정 (322 HC5 하니스 — 1x · 4x) · 번들 합계가 결정 1 안 (R3) · live 종결 (Chrome · WebKit) · VoiceOver 청취 (사용자 확인) · 규칙 문서 · ADR-322 대체 표시                                                                                             | 성능 미달이면 표시 파생의 범위를 좁힌다 · 번들 초과면 사용자 보고        |

집행 수단: 단위 · 정적 검사와 `pnpm codex:preflight` · 번들 Δ (`adr201-bundle-gate.mjs` — before 빌드가 필요하다) 는 실행자가 Phase 를 닫기 전에 직접 돌린다. 저장소 pre-push hook 이 스스로 막는 것은 변경 경로에 따른 성능 ratchet 과 CSS 문서 경계뿐이고, `push: main` 배포 workflow 가 initial 번들의 절대 상한을 막는다. live 는 `apps/builder/scripts/` 의 Playwright 스크립트.

측정 조건 (`measurement-validity.md` §1):

- **기준값은 밖에서** — G2 · G3 · G5 의 폭 · 간격 · rect 기준은 실제 Chrome 의 `getComputedStyle` · `getBoundingClientRect` 이고, 기대값은 테스트 파일에 따로 적는다 (Canvas 값으로 기대값을 만들지 않는다). 대칭 하니스는 실제 노드 트리 (palette 에서 놓은 Cascader) 로 잰다.
- **불리한 경우** — G5 는 값이 깊은 단계에 있는 경우 (tree 의 조상 펼침 · drill 의 경로 3 단) · 「어느 단계든」 · 다중 · 연결된 목록 · 시작 값이 표본 창 밖인 연결 (부모 120 × 자식 1 — 평면 · 중첩 · 단계 표) · 겹치는 key 가 창 밖에 하나 더 있는 경우 · 같은 key 의 가지가 자식을 창 밖에 둔 경우 (Round 2 의 `X` 입력) · 단계별 로드에서 읽지 않은 가지의 key 가 시작 값인 경우 (`11`) 를 포함한다. G6 은 5,000 끝 항목 · 4 단 (322 HC5 문서) 과 닫힌 필드의 값 변경을 잰다.
- **대조군** — G6 의 성능 · 번들은 이 ADR 의 변경만 되돌린 빌드와 나란히 (교대 3 쌍 중앙값 · CPU 1x 와 4x 병기 · 보이는 탭). 번들은 일반 `vite build` 로 잰다.
- **가동 확인** — G4 는 §5 표 (breakdown) 의 목록마다 「넣었다」 가 아니라 그 목록을 읽는 동작 (Canvas 열림 · 선택 테두리 · Preview 시작 열림 · 규칙 「열기 · 닫기」) 으로 확인한다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Select 와 Cascader 가 같은 구조다 — Design 패널의 Open, Canvas 의 펼친 목록, Layers 의 `Popover > 목록 > 항목`, Styles 패널로 열린 상자 편집.
- 열린 모양이 D3 대칭 안으로 들어온다 — Canvas · Preview · Publish 가 같은 rule 을 읽고, 테마 · 크기 변경이 열린 내용에 닿는다.
- 폭 · 2중 테두리 · 경로 줄 간격이 개별 수정이 아니라 구조의 결과로 맞는다.
- DOM 전용 CSS 110 여 줄 (`CASCADER_PANEL_STYLES`) 삭제.
- 표본 창 밖의 시작 값도 Canvas 에서 경로로 보인다 (닫힌 필드 포함 — ADR-322 의 비대칭 해소).
- Breadcrumbs 컴포넌트의 접힌 메뉴가 `onAction` 을 부른다 (S2 와 같게 — Cascader 밖의 Breadcrumbs 에도 닿는 수정).

### Negative

- contract +1 — 지금까지 만든 문서가 열리지 않는다 (개발 단계 정책).
- 새 부품 type 하나 (`CascaderList`) 와 Canvas 의 방식별 항목 표시 판정이 생긴다.
- 행 읽기에 「남길 key」 입력이 하나 생긴다 (Cascader 와 그 단계 항목만 쓴다).
- 경로 줄의 crumb 자리는 넷으로 고정이다 — Layers 에 자리 넷이 보이고 글자는 편집 대상이 아니다 (파생 값).
- Canvas 는 「막 연 화면」 만 그린다 — columns 의 둘째 열 이후, 검색 결과, 단계 이동 뒤 화면은 Preview 에서 본다 (Select 의 열린 목록도 스크롤 · hover 상태는 그리지 않는다).
- Builder initial 번들이 는다 (사용자 결정 1).
- 영향 파일: `cascaderOrigins.ts` · `Cascader.binding.ts` · `componentRulesTable.ts` · `cascader*.tsx` 7 · `cascader.ts` · `presence.ts` · `overlayState.ts` · `overlayLayout.ts` · `compositionRoot.ts` · `runtimeStateProps.ts` · `domBinding.runtime.ts` · `delegatedDom.runtime.ts` · `delegatedDom.components.tsx` · `breadcrumbsCollapse.ts` · `dataBinding.ts` · `resolver.ts` · `collectionItems.ts` · `componentTraits.ts` · `dataBindingCommand.ts` · `catalogDataRead.ts` · 생성 CSS · 테스트 · live 스크립트 (breakdown §8).
