# ADR-301: 코드 보기의 Library 원본 instance 펼치기 — 접힌 `<Popover>` 대신 RAC 레퍼런스 모양의 전개

## Status

Proposed — 2026-11-05

- 사용자 요청: `/create-adr` (2026-11-05) — 같은 대화에서 Popover 의 RAC 레퍼런스 코드 (`<DialogTrigger><Button …/><Popover><div style={{display:'flex', …}}><Switch>…</Switch></div></Popover></DialogTrigger>`) 와 코드 패널 출력 (`<DialogTrigger><Slot name="frame"><Heading …/><Description …/></Slot></DialogTrigger>`) 을 나란히 보인 뒤 → 「B. 접은 모양 유지 + 결함 2개만 수리로 진행하고, /create-adr A. 레퍼런스처럼 펼치기. 는 병렬로 설계해」.
- 방향을 정한 사용자 원칙: 「code view 로 했을 때 그 (레퍼런스) 형태가 그대로 나와야겠지」 (2026-10-26, 메모리 `project-code-view-is-rac-reference-code`) · 코드 편집은 닫힌 어휘 전체 양방향 (2026-10-27, ADR-285) · 「불가 → 스크립트 escape」 금지 (`project-builder-purpose-labor-cost-consistency`).
- 사용자가 이미 답한 것: **B 는 ADR-296 범위 안의 수리로 메인 세션이 진행한다** (slot 이름 = template 이 선언한 `slot.name` · 접힌 태그 = 놓은 **팔레트 type** `<Popover>` — `react-aria-components` import 그대로, `catalogPaletteDefinitionId` 가 같은 원본으로 읽는 이름. B 는 2026-11-05 메인 세션이 끝냈다 — `generate.ts` `originTag` · `files/overrides.ts` `codeViewSlotKey`, `adr296LibraryOverlay.test.tsx` 7) — 이 ADR 은 **B 위에 얹힌다**. Library 원본은 읽기 전용 + 「unlock」 (ADR-282 · 296 사용자 결정 3) 을 그대로 둔다.
- ADR 분리 4 질문 lock-in (adr-writing §fork): [breakdown §1](design/301-code-view-library-instance-expansion-breakdown.md) — 이 요청 자체가 「296 Decision 4 의 Library instance 부분을 새 ADR 로」 의 confirm 이다 (사용자 지시 「/create-adr A」). 재질문하지 않는다.
- 범위 밖: **Local (project) 컴포넌트 instance** — 지금처럼 `<Name …/>` + `overrides={{…}}` (296 Decision 4 그대로, 원본 파일 `src/components/<Name>.tsx` 가 펼친 모양을 가진다). 컴포넌트 파일 안에서 Library 원본 instance 를 쓰는 자리 (template 안 template) 는 이 ADR 의 같은 규칙으로 펼친다.
- 리뷰 · 착수는 사용자 요청 때 (`/review-adr 301` → `/execute-adr 301`).

## Context

### 도메인

- 코드 보기는 문서의 **투영** 이다 (ADR-284 Decision 9 · 285 · 296). D1 — 펼친 요소 이름은 설치된 RAC 이름 그대로 (`DialogTrigger` · `Popover` · `OverlayArrow` · `Heading`), 코드가 DOM · ARIA 를 지정하지 않는다. D2 — 펼친 요소의 prop 은 binding `accepts` 안 (지금 규칙). D3 — 스타일은 계속 `*.css` 투영 (296 Phase 4) 이고 이 ADR 이 CSS 생성 (`generate-css.ts`) 을 건드리지 않는다. **경계 이동 없음**. 문서 스키마 (`catalog/document/types.ts`) · 문서 명령 신설 **0** — 코드 보기 anchor 종류 하나 (`position`) 가 는다 (코드 보기 타입 `codeView/types.ts`, 문서가 아니다).

### 현재 (실측 2026-11-05, main `79a99eb1b` — B 수리 전)

- **접힘**: page 파일의 Library 원본 instance (`definitionId` 가 `lib:definition:origin-component-*` — composite 157 · template 노드 531) 는 `generate.ts` `writeNode` 가 **template 루트 type 하나** 로 쓴다 — `componentTag` (`generate.ts:2722`) 가 `lib:` 를 건너뛰어 project 컴포넌트 이름이 없고, 태그는 `this.doc.typeOf(node)` = template 루트 type (`DialogTrigger`). 안쪽 (Button trigger · Popover · OverlayArrow · content frame) 은 page 코드에 없다. slot 채움만 `<Slot name=…>` (`generate.ts:2970-3003`, 키 = `codeViewAddressKey` `files/overrides.ts:103` = 노드 class 경로 — B 가 `slot.name` 으로 고친다).
- **펼친 모양은 다른 파일에 있다**: `node_modules/@composition/library/<Name>.tsx` (`files/library.ts` — `codeViewLibraryReader` 가 template 노드를 문서 노드처럼 보여 컴포넌트 생성기가 `export function Popover(props)` 를 쓴다, 읽기 전용 · 편집 = `readOnlyFile` + unlock 스니펫 `codeViewApply.ts:427`). 레퍼런스 (`.claude/skills/react-aria/references/components/Popover.md` — `<DialogTrigger><Button/><Popover><OverlayArrow>…</OverlayArrow>…`) 는 page 코드에 trigger · 본체가 **같이** 있다. 사용자가 비교한 것이 이 차이다.
- **instance 몫의 표현**: 안쪽 자리의 patch (`DescendantPatchFields` `types.ts:607` — props · enabled · visual · interactions …) 는 `overrides={{'<path>': {…}}}` 객체 prop 하나 (`generate.ts:2587` `overridesCode`, 역문법 `codeViewEdit.ts:1600` `planOverrides` → `setFields({targets:[{kind:"descendant", ownerId, address}]})` · `setWholeField(enabled)` · 상속 규칙 명령 · address 규칙). 스타일은 CSS 파일의 **경로 선택자** (`files/styles.ts:672-681` — `codeViewAddressKey` 로 `.picker .save-button`). 즉 안쪽 자리를 가리키는 키 (= `InstanceAddress` 의 문자열화) 는 이미 두 파일이 같이 쓴다.
- **값 투영**: template prop 의 `{key}` 바인딩 (`lib:template:component-popover__overlay` 의 `size: "{size}"` …) 은 resolver `bindTemplateValue` (`resolution/resolver.ts:612`) 가 instance 의 root prop 으로 치환하고, 안쪽 자리의 patch 는 `overridesAt` · `layeredOverride` (`resolution/templateOwners.ts:67 · :124`) 가 「투영 경로 owner 들, 바깥이 이김」 으로 읽는다. 펼친 코드가 보여야 할 값은 이 두 함수의 결과다 — 코드 보기 안에 둘째 해석기를 두지 않는다.
- **원본 규칙**: Library template 에는 interaction entry 가 없다 (`reusableOriginLibrary.ts` 에 `"kind": "interaction"` 0) — Library instance 의 `rules({inherited})` 는 비어 있고 `own` 만 실제로 쓰인다.
- **Canvas 전용 정보**: 오버레이 본체의 `displayState: "open"` (ADR-278 — Components page 샘플만) · Library page 의 ◆ (`originOf`, ADR-282) · `presence.ts` 의 닫힌 오버레이 숨김 — 코드와 무관한 Builder 표시 상태.
- **원본 크기 (template 노드 수)**: Popover 7 · Tooltip 6 · Menu 8 · ContextualHelp 8 · Dialog 10 · Tabs 7 · Card 8 · Table 10 · DatePicker 9 · Select 13 · ComboBox 13. 한 instance 를 펼치면 그 수만큼의 요소가 page 코드에 들어간다. 중첩: Library template 안의 자리는 다시 Library 원본 instance 일 수 있다 (Popover 의 trigger = `origin-component-button` instance → `Button > Icon + Text`) — instance 체인 (`address.instances`) 이 길어진다.

### 제약

- **Hard**: Builder initial JS gz ≤ 1,414,000 (ADR-201 재승인 — 지금 1,411,708, 여유 2,292 B) · Preview ≤ 325,000 (323,910, 여유 1,090 B). 코드 보기는 lazy chunk (`panels/core/panelConfigs.ts:73` `import("../codeView/CatalogCodeViewPanel")` · 편집기 `CodeEditor` lazy) 라 생성기 · 역문법 변경은 그 chunk 의 일이어야 한다 (296 G5 와 같은 조건 — initial 에 공유 chunk 로 새지 않을 것).
- **Hard**: 285 의 왕복 불변식 — 편집 뒤 명령을 stage 에 적용한 문서의 재생성 코드가 편집본과 같아야 적용 (`codeViewEdit.ts:3412` `compareRegenerated`) · 수용 집합 golden 5 (plants · photos · kanban · ios-list · emoji) 구조 동치 유지 · 296 G1 필드 대조 (`fieldCoverage.ts` 의 모든 키에 파일 · emit · read) 유지.
- **Hard**: 문서 스키마 · 문서 명령 신설 0 (296 선례) — 펼친 안쪽 편집은 지금 `planOverrides` 가 부르는 **같은 명령** (descendant `setFields` · `setWholeField(enabled)` · address 규칙 · `insertNodes`/`moveNodes` 의 descendant 부모 · `unlockOrigin`) 으로 돌아간다.
- **Hard**: ADR-282 — Library 원본은 읽기 전용, 고치려면 명시적 `unlockOrigin` (296 사용자 결정 3). 펼친 코드의 어떤 편집도 Library template 을 바꾸지 않는다.
- **Soft**: 생성 시간 — 가장 큰 page 0.32 ms (296 Phase 0 기준) · 레퍼런스 코드 길이 (RAC Select 예제 ≈ 15 줄 · Popover ≈ 12 줄) 가 페이지 코드 길이의 상한 감각.

## Alternatives Considered

### 대안 A: 전부 펼침 — Library instance = template 트리를 page 코드에 inline, 안쪽 요소 편집 = instance 명령

- 설명: instance 루트는 template 루트 type (`<DialogTrigger>`), 안쪽은 resolver 가 투영한 template 트리 (type · instance 가 쓴 값 · slot 자리의 채움을 그 자리에 inline — `<Slot>` 태그 없음, frame 은 `<div className="content">`). 안쪽 요소의 anchor 는 새 종류 `position` (`{ownerId, address}` — 키 = `codeViewAddressKey`, CSS 경로 선택자와 같은 문자열). 역문법: prop → descendant patch · 요소 삭제 → `enabled:false` patch · slot 안 추가 · 이동 → `fillSlot` · handler → address 규칙 · 구조 변경 (template 자리 밖 추가 · type 변경 · template 노드 이동) → 거절 + unlock 스니펫. Library instance 의 `overrides` prop 은 사라진다 (안쪽 patch 가 그 요소의 attribute 로 나온다 — 한 사실 한 표현).
- 위험: 기술(M — anchor 종류 1 + 역문법의 descendant 분기, 중첩 instance 체인) / 성능(L — 생성은 template 노드 수에 선형, lazy chunk) / 유지보수(M — Library template 모양이 바뀌면 golden 이 바뀐다; 그러나 그것이 정본의 변화라 맞다) / 마이그레이션(L — 문서 무변경, 코드 보기 chunk 만 롤백)

### 대안 B: 접힌 모양 유지 (B 수리만 — 팔레트 type 태그 `<Popover>` + 선언 slot 이름 + `overrides`)

- 설명: 지금 모양 + 결함 2 수리 (2026-11-05 완료 — 태그는 팔레트 type, slot 은 선언 이름). 펼친 모양은 Library 파일을 열어야 보인다.
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L). 그러나 사용자 원칙 (레퍼런스 모양 그대로) 을 Library instance 에서 충족하지 못한다 — 레퍼런스 page 코드에는 trigger 와 본체가 같이 있고, 우리는 본체를 `node_modules` 안에 숨긴다. 위험이 낮은 것이 아니라 목표를 비우는 것이다.

### 대안 C: 펼치되 안쪽은 읽기 전용 (표시만)

- 설명: A 의 생성 방향만, 안쪽 편집은 전부 거절 (「패널에서」 또는 unlock).
- 위험: 기술(L) / 성능(L) / 유지보수(M — 「코드에 보이는데 못 고치는」 자리가 수십 개 생겨 거절 사유 표가 커진다) / 마이그레이션(L). 10-27 결정 (닫힌 어휘 전체 양방향) 과 296 의 「읽기 전용 파일은 `notInCode` 를 늘리는 셈」 (대안 D 기각 사유) 에 정면으로 어긋난다.

### 대안 D: 펼치고, 안쪽을 고치면 자동 unlock (Local 로 복사한 뒤 원본 명령)

- 설명: 안쪽 편집 = `unlockOrigin` 을 먼저 실행해 template 을 프로젝트로 복사하고 그 사본에 쓴다.
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(**H** — prop 하나 고쳤는데 instance 가 Local 컴포넌트로 바뀌고 같은 원본의 다른 instance 와 갈라진다; 패널의 같은 편집 (Design 패널은 descendant patch 를 쓴다) 과 결과가 달라져 「누가 해도 같은 결과」 가 깨진다). ADR-282 의 「unlock 은 명시적」 과 충돌.

### 대안 E: 가족별 — 오버레이 가족 (DialogTrigger · MenuTrigger · TooltipTrigger · ContextualHelp) 만 펼치고 field · picker · 컬렉션은 접은 채

- 설명: 레퍼런스가 trigger + 본체를 같이 쓰는 가족만 펼친다. 나머지는 `<Select>` import.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 「어느 원본이 펼쳐지는가」 가 코드 보기 안의 손 목록이 되고, 새 원본마다 판정이 필요하다; RAC 레퍼런스는 Select · ComboBox · DatePicker 도 전개 (`<Select><Label/><Button><SelectValue/></Button><Popover><ListBox>…`) 라 접을 근거가 레퍼런스에 없다) / 마이그레이션(L).

### Risk Threshold Check

| 대안 | HIGH+            | 판정                                                     |
| ---- | ---------------- | -------------------------------------------------------- |
| A    | 0                | 채택 후보 (MEDIUM 2 — anchor · 역문법 분기, golden 결합) |
| B    | 0                | 목표 미충족 (위험이 아니라 범위 0)                       |
| C    | 0                | 10-27 결정 위반                                          |
| D    | 1 (마이그레이션) | 기각                                                     |
| E    | 1 (유지보수)     | 기각                                                     |

HIGH 0 인 대안 (A) 이 있어 루프 종료. A 의 MEDIUM 둘은 Gates (G1 · G2) 가 기계적으로 잰다.

## Decision

**대안 A — 전부 펼침.** B 수리 위에서:

1. **생성** — Library 원본 instance 는 page (와 컴포넌트) 파일에서 **template 트리로 펼친다**. 루트 요소 = template 루트 type (anchor 는 지금처럼 `{kind:"node", nodeId: instance}`), 안쪽 요소 = template 노드 (type 은 지금 `writeNode` 규칙 — frame 은 `div`, 요소 없는 노드도 RAC 이름이 있으면 그 이름 (`DialogTrigger` · `MenuTrigger`), slot 자리의 frame 은 `<div className="<slot 이름>">` 으로 채움을 **그 자리에 inline** (`<Slot>` 태그 없음 — 레퍼런스의 `<div style={{display:'flex' …}}>` 자리). 값은 resolver 가 instance 에 투영한 것 — `{key}` 바인딩은 instance root prop 으로 치환 (`bindTemplateValue`), 안쪽 patch 는 `overridesAt` · `layeredOverride` 결과. **코드에는 instance 가 작성한 값만** 적는다 (Library 기본값은 생략 — 레퍼런스의 `{...props}` 자리, 사용자 결정 3). 중첩 Library instance (template 안의 원본 자리) 는 같은 규칙으로 재귀 (instance 체인 = `address.instances`). Canvas 전용 상태 (`displayState` · ◆ · 닫힌 오버레이 숨김) 는 쓰지 않는다. 안쪽 요소의 `className` = 그 자리 키의 마지막 segment (CSS 경로 선택자 `files/styles.ts` 와 같은 `codeViewAddressKey`) — 스타일 파일과 page 파일이 같은 이름으로 같은 자리를 가리킨다.
2. **anchor** — 안쪽 요소는 새 종류 `{kind:"position", ownerId, key}` (`key` = `codeViewAddressKey` 문자열, 역변환 `codeViewAddressOf` — 둘 다 있다). 같은 원본 instance 둘 · 바깥 instance 안 같은 원본 둘은 `ownerId` + instance 체인으로 갈린다 (296 round 2 h1 과 같은 근거). attribute · text anchor 는 `nodeId` 자리에 같은 `position` 참조를 든다.
3. **역문법 — 쓰기 경계는 「자리」 다** (296 Decision 4 의 「파일 경계」 를 Library instance 에 한해 바꾼다). 펼친 안쪽 요소의
   - prop 변경 → 그 자리의 descendant patch (`setFields({targets:[{kind:"descendant", ownerId, address}]})`) — 지금 `planOverrides` 와 같은 명령. 단, 바꾼 attribute 가 template 에서 `{key}` 바인딩인 자리면 **instance root 의 그 prop** 에 쓴다 (`setInstanceProperty` / instance `setFields`) — resolver 가 그 값을 거기서 읽기 때문이다 (binding 자리에 patch 를 쓰면 instance prop 이 가려진다).
   - handler (`onPress={…}`) → 그 자리의 address 규칙 (`InteractionEntry {ownerId: instance, address}`) — 지금 `own` 과 같다. Library template 에 원본 규칙이 없으므로 `rules({inherited})` 는 쓰이지 않는다.
   - 요소 삭제 (anchor `deleted`) → `enabled: false` patch (`setWholeField(enabled)`) — 코드에서는 `{false && <Button …/>}` 로 남아 복원 가능 (사용자 결정 4 · 5). slot 안 채움 노드 (소유 노드) 의 삭제는 지금처럼 `removeTargets`.
   - slot 자리 안 요소 추가 · 이동 → `insertNodes` · `moveNodes` 의 descendant 부모 (`fillSlot`) — 지금 `<Slot>` 안 편집과 같은 명령.
   - **거절** (`readOnlyPosition` + unlock 스니펫 — 296 사용자 결정 3 유지): template 자리 밖에 요소 추가 (Popover 에 둘째 자식) · 요소 type 변경 · template 노드 이동 · Library 기본값 자체를 바꾸는 편집. 스니펫은 `unlockOrigin` 한 명령 → 그 뒤 instance 가 Local 컴포넌트가 되어 `src/components/<Name>.tsx` 에서 고친다.
   - 재생성 대조 (285) 는 그대로 — 명령을 stage 에 적용한 문서를 다시 펼친 코드가 편집본과 같아야 적용. 자리 키가 deterministic 이라 성립한다.
4. **`overrides` prop 은 Library instance 에서 사라진다** — 안쪽 patch 가 각 요소의 attribute · `{false &&}` · handler 로 나오므로 같은 사실을 두 번 쓰지 않는다. Local 컴포넌트 instance 의 `overrides` 는 그대로 (범위 밖). 역문법은 Library instance 에 적힌 `overrides` 를 `outsideVocabulary` 로 거절한다.
5. **바운드 컬렉션 instance** (ListBox · GridList · Table 등 `binding` 이 있는 instance) 는 행 (`{item => <ListBoxItem …>}`) 을 지금 모양으로 두고, 행 밖 template 부품 (EmptyState IllustratedMessage · Label · 머리글 Column 등) 만 펼친다 (사용자 결정 6).
6. **Library 파일** (`node_modules/@composition/library/<Name>.tsx`) 은 그대로 둔다 — 원본 전체 모양 · 기본값의 참조이고 unlock 의 진입점이다.

**위험 수용 근거**: 문서 스키마 · 명령 신설 0 이라 되돌리기는 코드 보기 chunk 만의 일이고, 안쪽 편집이 부르는 명령은 지금 `planOverrides` 가 부르는 것과 같아 Design 패널의 같은 편집과 결과가 같다 (G2 가 패널 명령과 문서 동일을 잰다). anchor 종류 하나와 역문법의 자리 분기 (MEDIUM) 는 G1 · G2 의 반례 (같은 원본 둘 · 중첩 · 바인딩 자리 · 삭제 · 거절) 와 원복 RED 가 막는다.

**기각 사유**: B — 목표 (레퍼런스 모양) 를 Library instance 에서 비운다 (B 수리는 이 ADR 의 선행으로 남는다). C — 10-27 「닫힌 어휘 전체 양방향」 위반, 거절 표만 커진다. D — prop 하나로 instance 가 Local 로 갈라져 패널과 결과가 다르고 282 의 명시적 unlock 과 충돌. E — 펼침 여부가 손 목록이 되고 레퍼런스에 접을 근거가 없다.

> 구현 상세: [301-code-view-library-instance-expansion-breakdown.md](design/301-code-view-library-instance-expansion-breakdown.md)

### 사용자 결정 7 건 (execute-adr 가 그 항목에 닿을 때 묻는다 — 4 결정 지점 밖)

1. **긴 원본 접기 여부** — Select · ComboBox (13 노드) · Table (10) 도 펼칠지, 길이 상한을 두고 접을지. 권고: **접지 않는다** (레퍼런스도 전개 · 편집기 fold 로 읽는다 — E 기각 사유).
2. **OverlayArrow 표기** — 문서 노드 (`type-OverlayArrow`, DOM 이 svg 를 그린다) 를 `<OverlayArrow />` 로 쓸지, 레퍼런스처럼 `<OverlayArrow><svg …/></OverlayArrow>` 로 쓸지, 생략할지. 권고: **`<OverlayArrow />`** (문서 노드 1:1 · svg 는 rule 이 그린다 — D3).
3. **바인딩 prop 표기** — instance 가 작성한 값만 vs Library 기본값까지 전부. 권고: **작성한 값만** (레퍼런스 `{...props}` 자리 · 기본값은 Library 파일에).
4. **숨긴 template 노드 표기** — `{false && <X/>}` vs 생략 (`enabled:false` patch 의 코드 모양). 권고: **`{false &&}`** (296 Phase 2 의 노드 off 와 같은 어휘 · 복원 가능).
5. **안쪽 요소 삭제의 뜻** — `enabled:false` patch (권고) vs 거절.
6. **바운드 컬렉션 instance 펼침 범위** — 행 밖 부품만 (권고) vs 행 template 까지.
7. **슬롯 frame 의 태그** — `<div className="content">` (권고 — 레퍼런스의 div) vs 이름 없는 `<>` fragment.

## Risks

| ID  | 위험                                                                                                                                                                                      | 심각도 | 대응                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 안쪽 자리 anchor 오판 — 같은 원본 instance 둘 · 바깥 instance 안 같은 원본 둘 · 같은 template 의 같은 type 형제 (Button ×2) 를 identity 가 섞어 patch 가 다른 instance · 다른 자리에 간다 |  HIGH  | Decision 2 — `position` 키 = `ownerId` + `codeViewAddressKey` (instance 체인 포함) · identity 의 kept 짝은 같은 키만. G2 반례: A · B instance 각각 · `outer/left/trigger` vs `outer/right/trigger` · Button 형제 둘 · 원복 RED (키에서 체인을 빼면 RED) |
| R2  | 바인딩 자리 쓰기 오류 — `{size}` 자리에 descendant patch 를 써서 instance prop 이 가려지고 패널 (Properties 는 instance prop 을 편집) 과 코드가 다른 문서를 만든다                        |  HIGH  | Decision 3 — template 값이 `{key}` 바인딩이면 instance root prop 으로. G2 반례: `<Popover size="L">` 편집 → instance `props.size` · patch 0 · Properties 패널의 같은 편집과 문서 동일 · 원복 RED                                                        |
| R3  | 왕복 깨짐 — 펼친 코드를 통째 붙여넣어도 재생성 대조가 거절 (Canvas 전용 상태 · 기본값 생략 · 중첩 체인 순서)                                                                              |  HIGH  | G1 strict 왕복 (프로젝트 모든 파일 + golden 5 + Library 원본 157 전수 instance fixture) 거절 0 · 명령 0                                                                                                                                                 |
| R4  | 코드 길이 · 생성 시간 — picker 10 개 page 가 수백 줄, 생성이 template 노드 수에 비례                                                                                                      |  MED   | 선형 (531 노드 상한 × instance 수) · G4 생성 시간 ≤ Phase 0 기준 × 2 (측정 조건 기록) · 결정 1 로 접기 재논의 가능                                                                                                                                      |
| R5  | Library template 변경이 golden 을 흔든다 (원본 노드 추가 = 모든 instance 코드 변경)                                                                                                       |  MED   | golden 은 정본 변화에 따라가는 것이 맞다 — `docs:stale-symbols` 처럼 golden 재생성 PR 없이 같은 커밋에서 갱신, 의미 변경 0 단언                                                                                                                         |
| R6  | 거절 표면 — 「보이는데 못 고치는」 편집 (type 변경 · 자리 밖 추가) 을 사용자가 결함으로 받는다 (10-27 사례)                                                                               |  MED   | 거절 문구에 unlock 스니펫 한 번 적용 (296 결정 3) · 거절 종류는 구조 변경 3 뿐 — 값 · 규칙 · 삭제 · slot 추가는 전부 받는다                                                                                                                             |
| R7  | 번들 — 역문법 분기 · anchor 가 initial 공유 chunk 로 샌다                                                                                                                                 |  MED   | G4 Builder initial Δ ≤ +256 B · Preview Δ 0 (285 의 `codeViewActions.ts` registry 패턴)                                                                                                                                                                 |

## Gates

측정 착수 전 5-질문 (measurement-validity §1): 대상 = 사람이 만든 문서 (CMS 22 page 재현 + golden 5 + Library 원본 157 을 하나씩 놓은 fixture) · 불리 케이스 = 같은 원본 instance 둘 · 바깥 instance 안 같은 원본 둘 · Select (13 노드) 10 개 page · 바인딩 자리 편집 · 대조군 = B 수리 직후 HEAD worktree (번들 · 생성 시간 · golden) · 소비 경로 = 코드가 부른 명령이 Canvas · Preview 에 반영 (G5 live) · oracle = RAC 레퍼런스 (`.claude/skills/react-aria/references/components/*.md` 예제 — 외부) 와 Design 패널의 같은 편집이 만든 문서 (코드 보기 자신이 아니다).

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 실패 시 대안                                            |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G0   | Phase 0     | B 수리 main 반영 확인 · inventory freeze — Library composite 157 의 template 모양 표 (노드 수 · slot 자리 · 바인딩 자리 · 중첩 깊이 최대 · 바운드 행 자리) · RED (`adr301Phase0.test.tsx` — 펼침 0 · anchor 없음 · `overrides` 존재) · 번들 · 생성 시간 before (HEAD worktree) · 사용자 결정 1 ~ 7 중 Phase 1 이 닿는 것 (2 · 3 · 7)                                                                                                                                                                                                                                                                                                                      | 표에 빈 칸이면 Phase 1 착수 금지                        |
| G1   | Phase 1 ~ 3 | **레퍼런스 대조** (R3) — Popover · Dialog · Menu · Tooltip · ContextualHelp · Select 의 instance 코드가 로컬 RAC 예제와 구조 동치 (요소 · 중첩 · 순서; 값은 instance 것) · **전수 왕복** — 157 원본 각각을 놓은 fixture + golden 5 + CMS 재현을 생성 → 통째 붙여넣기 → 거절 0 · 명령 0 (strict) · 296 필드 대조 (`fieldCoverage.ts`) 유지 · `position` anchor 가 모든 안쪽 요소에 하나씩                                                                                                                                                                                                                                                                  | 왕복 차이 하나라도 있으면 Phase 닫힘 금지               |
| G2   | Phase 2 ~ 3 | **자리 쓰기** (R1 · R2) — 안쪽 prop → descendant patch 한 자리 · 바인딩 자리 → instance prop · handler → address 규칙 · 삭제 → `enabled:false` · slot 추가 → `fillSlot` · 각각 history 1 · Undo 1 · **격리** — 같은 원본 A · B · `outer/left/trigger` vs `outer/right/trigger` · Button 형제 둘 서로 무영향 · **패널 동일** — Design · Properties 의 같은 편집과 문서 동일 (id 제외) · **거절** — 자리 밖 추가 · type 변경 · template 이동 · Library instance 의 `overrides` → 거절 + unlock 스니펫 → `unlockOrigin` 한 명령 뒤 Local 파일에서 같은 편집 성공 · **원복 RED** — 키에서 instance 체인 제거 → 격리 반례 RED · 바인딩 분기 제거 → R2 반례 RED | 명령이 없는 변경은 거절 + 대안 문구 — 새 명령 신설 금지 |
| G3   | Phase 3     | 바운드 컬렉션 instance — 행 모양 유지 · 행 밖 부품 펼침 · golden plants · photos (바운드 ListBox · GridList) 구조 동치 유지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 행 template 까지 펼쳐야 통과하면 사용자 결정 6 재질문   |
| G4   | Phase 4     | 번들 — Builder initial Δ ≤ **+256 B gz** (`adr201-bundle-gate.mjs`, HEAD worktree 대조 · 상한 1,414,000 안) · Preview Δ 0 · 생성 시간 — Select 10 개 page ≤ Phase 0 before × 2 (측정 조건 기록)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 공유 chunk 로 새면 registry 주입                        |
| G5   | Phase 4     | live (별도 dev 서버, Chrome MCP) — Popover instance 를 놓고 코드 패널에서 ① 본체 Heading 글자 변경 ② trigger Button `label` 변경 (바인딩 자리) ③ content 에 `<Switch>` 추가 ④ Description 삭제 → Apply 1 → Canvas · Preview (열어서) 반영 · 같은 원본 둘째 instance 무변화 · ⌘Z 1 번씩 · 새로고침 유지 · 콘솔 0 · 사용자 confirm                                                                                                                                                                                                                                                                                                                          | FAIL 은 `/fix` — 증상 수정 금지                         |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- page 코드가 RAC 레퍼런스와 같은 모양 — trigger 와 본체가 한 자리에 보이고, 개발자가 Library 파일을 열지 않아도 무엇이 그려지는지 읽힌다 (사용자 원칙 10-26 을 Library instance 에서 충족).
- instance 몫이 요소 자리에 붙는다 — `overrides` 객체의 경로 키를 읽지 않아도 「어느 요소의 어느 prop」 인지 코드가 말한다. Design 패널의 descendant patch 와 같은 단위.
- 스타일 파일의 경로 선택자 (`.popover .content`) 와 page 파일의 `className` 이 같은 키라 두 파일이 서로를 가리킨다.

### Negative

- page 코드가 길어진다 (instance 당 6 ~ 13 요소). 결정 1 이 접기를 열어 둔다.
- Library template 이 바뀌면 그것을 쓰는 모든 page 의 golden 이 바뀐다 (R5).
- 안쪽 편집의 거절 종류 3 (자리 밖 추가 · type 변경 · template 이동) 이 「보이는데 못 고치는」 자리로 남는다 — unlock 스니펫이 출구.
- 296 Decision 4 의 「쓰기 경계 = 파일 경계」 가 Library instance 에 한해 「쓰기 경계 = 자리」 로 바뀐다 — 296 본문에 한 줄 (Superseded in part by ADR-301) 이 들어간다.
