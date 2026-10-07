# ADR-254 breakdown — 바탕의 부품 사슬

> 본문: [ADR-254](../254-base-part-chain.md) (Proposed 2026-10-07). 대안 A 기준. 줄 번호는 main `e6360e0d2` 기준이며 Phase 0 에서 다시 확인한다. 경로 약어는 본문과 같다.

## 1. 전제 확정 기록

fork 4 질문 (adr-writing.md) 과 사용자 confirm:

1. **base / 응용**: ADR-253 (부품 = 원본의 instance · DOM 이 부품 노드를 그림 · library slot 채움) 이 base 이고, 이 ADR 은 그 개념을 바탕 (컨테이너 5종의 제목 · 설명) 으로 넓히는 응용이다. 254 → 253 → 248 의존. 의존 방향 반전 없음.
2. **schema 직교성**: 문서 schema 변경 0. 바뀌는 것은 library 내용 (Heading 원본 · 자리 9곳의 정의 id) 과 `LIBRARY_CONTRACT_VERSION` (5 → 6). ADR-253 이 만든 표현 (부품 원본 · slot 채움) 의 specialization 이지 새 schema 가 아니다.
3. **선행 ADR 전제 reverse 검증**: ADR-253 Decision 8 의 전제 「바탕은 공용 바탕 원본으로 재사용한다」 는 G5 에서 틀렸음이 확인됐다 (ADR-253 breakdown 「G5 판정」 — instance 루트 type · 레퍼런스 구조). 이 ADR 은 그 전제를 승계하지 않고 「바탕이 공유하는 것은 부품이다」 로 바꾼다. 나머지 (원본 → instance · 모양은 부품 rule · 글자는 부모 prop) 는 ADR-253 의 확정된 전제 그대로다.
4. **판독 시점**: 본문 작성 뒤 리뷰 1회 (판독 1 + 수리 검증 1 상한).

사용자 confirm: ADR-253 G5 의 후퇴안 「Decision 8 을 미루고 ADR 을 닫는다 (후속은 사용자 결정)」 + 2026-10-07 사용자 지시 「바탕 사슬 후속 ADR 작성해라」. 후속 ADR 작성 자체가 confirm 이고, 모양 (대안 A) 의 confirm 은 리뷰 뒤 Accepted 에서 받는다.

## 2. 인벤토리 — 제목 · 설명 자리 9곳 (2026-10-07, `L`)

| 컨테이너    | 자리                                  | 지금 정의          | props                                           | 자리의 모양 값                                      | 전환 뒤                                                               |
| ----------- | ------------------------------------- | ------------------ | ----------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Dialog      | `component-dialog__2_1`               | `heading`          | children "Dialog Title" · size lg               | fontWeight 600 · display block                      | Heading instance · `slot: "title"` · size lg (patch)                  |
| Dialog      | `component-dialog__2_2`               | `type-Description` | children "Dialog content goes here." · size lg  | display block                                       | Description instance · size lg (patch)                                |
| Popover     | `component-popover__1`                | `heading`          | children "Popover Title" · size sm              | fontWeight 600 · display block                      | Heading instance · size sm (patch)                                    |
| Popover     | `component-popover__2`                | `type-Description` | children "Popover content goes here." · size md | display block                                       | Description instance · size md (patch)                                |
| Card        | `component-card__title`               | `heading`          | children `{title}` · size md                    | fontWeight 600 · margin 0 · flex 1 1 0%             | Heading instance · 배치 (margin · flex) 만 남김                       |
| Card        | `component-card__description`         | `type-Description` | children `{description}` · size lg              | width 100% · color `#49454f`                        | Description instance · width (배치) · 색은 G0 판정                    |
| InlineAlert | `component-inline-alert__title`       | `heading`          | slot label · children `{title}`                 | (InlineAlert rule 이 size 별 선언 — 14/16/18 · 700) | Heading instance · slot label 유지 · size 전달 (같은 단계)            |
| InlineAlert | `component-inline-alert__description` | `type-Description` | slot description · children `{description}`     | (InlineAlert rule 이 size 별 선언 — 12/14/16 · 400) | Description instance · slot description 유지 · size 전달 (한 단계 위) |
| Tooltip     | `component-tooltip__1`                | `type-Description` | children "Tooltip text" · size md               | display block                                       | Description instance · size md (patch)                                |

- 글자 정본: Card · InlineAlert 는 컨테이너 prop (`title` · `description`) — 판정은 자리의 바인딩 (`children: "{title}"`) 으로 (Decision 5 — Card 는 직계 부모가 CardHeader · CardContent 라 type 표로는 못 찾는다). Dialog · Popover · Tooltip 은 노드 자신.
- `fontWeight: 600` 은 Heading rule `variants.default.textWeight` 600 과 같다 (`T:5427`) — 지워도 값 변화 0 (G0 에서 record 로 확인).
- Card 설명의 색 `#49454f` 는 Description rule 의 색 (`{color.neutral-subtle}` 계열) 과 다르다 — G0 에서 레퍼런스 (Card 는 RAC 밖 — composition 자체 값) 와 대조해 patch 로 남길지 rule 로 모을지 정한다.
- InlineAlert rule 의 size 별 제목 · 설명 선언 (`T:5763-5797` `headingFontSize` · `headingFontWeight` · `descFontSize` · `descFontWeight` — Canvas 는 `rulePartRules.ts` `childFontPartRules`, DOM 은 `CSSGenerator.ts` → `generated/InlineAlert.css` 의 `[data-size]` 규칙) 은 부품 rule 로 옮기고 InlineAlert 가 `size` 를 전달한다. 단계 대응: 제목 sm/md/lg → Heading sm/md/lg (14/16/18 — 같은 값) · 설명 sm/md/lg → Description md/lg/xl (12/14/16 — 같은 값). 굵기 700 → 600 만 바뀐다 (G0 목록). 남는 것은 배치 (방향 · gap) 뿐이어야 한다.
- Heading 은 팔레트에 없다 (`paletteItems.ts` `PALETTE_ORDER` 에 Text 만). Heading 노드의 진입 경로는 AI 레이아웃 템플릿 (`apps/builder/src/services/ai/templates/layoutTemplates.ts` · `catalog/dynamicInjection.ts`) 이다. 부품 원본 집합에 든 type 의 primitive 는 `placeable: false` 가 되고 (`C:1470-1476`), AI 생성 mode 는 `getReusableOriginId` 로 정해진다 (`compositeMode.ts:11-14`) — Heading 도 Label · Description 처럼 AI 가 넣으면 instance 다 (Decision 1, 예외 없음). manifest 의 Heading 항목은 `creationMode` · `reusableId` 만 바뀌어야 한다.
- Dialog 의 접근성 이름: shared Dialog 는 `aria-labelledby` 가 없으면 `aria-label="Dialog"` 를 넣고 (`S/components/Dialog.tsx:33-37`), RAC `useDialog` 는 `aria-label` 이 있으면 `titleId` 를 버린다 (react-aria 3.52.0 `dist/private/dialog/useDialog.mjs:27`). 그래서 heading 에 `slot="title"` 을 넘기는 것만으로는 연결되지 않는다 — 폴백을 binding 으로 옮긴다 (제목 노드가 없을 때만 `aria-label`).
- Popover · Tooltip 은 DOM 출력 0 (`X/domBinding.tsx:758-772`) 이라 DOM 대조 대상이 아니다. DOM oracle 은 열린 Dialog (실제 마운트) · Card · InlineAlert 로 한정한다.

## 3. Phase

### Phase 0 — inventory · oracle (G0)

- 전환 전 빌드 (main `e6360e0d2`) 에서 다섯 컨테이너 × size 5 (Card · InlineAlert 는 prop 조합 포함) 의 제목 · 설명 record (`visual` · `layout`) 를 fixture 로 뜬다. DOM 마크업 oracle 은 DOM 을 내는 셋 — Dialog (DialogTrigger 안에서 열어 실제 마운트) · Card · InlineAlert (SSR) — 만 (ADR-253 Phase 3 의 `fixtures/adr253-field-dom.json` 방식). Popover · Tooltip 은 record 만.
- 자리 값 · InlineAlert rule 을 부품 rule 로 옮길 때 바뀌는 값을 px 로 목록화 (굵기 · 크기 · 줄 높이 · 색). 목록 밖 변화 0 이 G3 의 기준.
- Heading 을 다루는 코드 경로 목록 (R1): AI 삽입 (`layoutTemplates.ts` · `dynamicInjection.ts` · AI compiler — 각 경로가 `creationMode: reusable` 을 따라 instance 를 만드는지, primitive 를 직접 넣는 경로가 있는지) · Canvas 인라인 글자 편집 · Properties 패널의 Heading 항목 · `presence.ts` (Disclosure 의 Heading = trigger) · `domBinding.tsx` heading binding · 시각 하니스 census. 컨테이너 안 제목 (instance 루트) 에서 각 경로가 「primitive 노드」 를 전제하는지 적는다. Dialog 안 Button instance (Phase 3) 가 같은 경로를 어떻게 지나는지가 기준.
- 글자 바인딩 경로 (Decision 5): resolver 가 `{title}` · `{label}` 을 어느 조상 prop 에서 푸는지 (`resolver.ts:1047-1052` 에서 이미 값으로 풀린다) 와 바인딩 소스를 추적하는 방법 확인 — record 의 `templateProps` 는 `{{ state }}` 변수 원문용이라 (`compositionRoot.ts:1453-1477`) 쓸 수 없고, library 의 template · instance 주소로 추적해야 한다. 지금 결함의 live 재현 1회 — TextField 의 Label 을 Canvas 에서 더블클릭해 고친 뒤 TextField `label` 을 바꾸면 화면이 자식 값에 남는지 (ADR-253 자리). 재현되면 Phase 2 의 수리 대상에 넣고 CHANGELOG 의 수정 항목으로 적는다.

### Phase 1 — Heading 원본 (G1 일부 · G3)

- `origin-component-heading` 등록: `C` `BASE_PART_ORIGIN_TYPES` 에 `"Heading"`, `L` 에 정의 (`accepts: { children }`) + template (`component-heading` 루트 = `heading` 정의, children `{children}`). Components page 의 부품 칸에 Heading 카드.
- 생성 계약: `apps/builder/src/builder/catalogRuntime/creationContract.ts:23-29` 의 `definitionOf` 가 `lib:definition:type-*` 만 풀어 Heading 원본의 루트 (`lib:definition:heading` — `codeCatalogLibrary.ts:656-661`) 를 못 찾는다 → `instanceContract` 가 원본 accepts (`children`) 만 돌려 `size` 가 빠진다. code-catalog id 를 `catalogTypeDefinitionId` 의 역으로 (등록 type 전체) 풀도록 고친다 — 원본 accepts 에 `size` 중복 선언 금지. 회귀 조건: `create_element` `Heading { children, size: "lg" }` 가 등록 전후 모두 성공 · `catalogCreationEditFields("Heading")` 의 size 선택지가 전환 전과 같음 (원복 RED).
- AI manifest 의 Heading 항목: `creationMode` `leaf → reusable` · `reusableId` `component-heading` 외 변화 0 을 unit 으로. AI 생성 경로 (Phase 0 목록) 가 Heading 원본의 instance 를 만드는지 unit 으로.
- unit: Heading 원본 편집 (색 · 굵기 · 크기) 이 원본 sample 과 (Phase 2 뒤) 컨테이너 안 제목의 record 와 DOM 에 닿음 (원복 RED).
- `LIBRARY_CONTRACT_VERSION` 6 (이 Phase 의 병합에서 한 번).

### Phase 2 — 다섯 컨테이너의 제목 · 설명 (G1 · G2 · G3)

- `L`: 자리 9곳을 Heading · Description 원본의 instance 로, `fontWeight: 600` 제거, 크기 · 색은 명시 patch (§2 표의 「전환 뒤」). Dialog 제목 자리에 `slot: "title"`.
- `T`: InlineAlert rule 의 Heading · Description 모양 선언 → 부품 rule. 컨테이너 5 rule 에 배치만. 정적 게이트 `adr253PartShapeOwner.static.test.ts` 의 대상에 Dialog · Popover · Card · InlineAlert · Tooltip 추가.
- DOM: heading binding 이 `slot` 을 넘긴다 (`X/domBinding.tsx:498-505` — Button binding 의 `slot` 전달과 같은 조건: 문서가 쓴 값만). dialog binding 이 제목 노드 (`slot: "title"` 인 heading 자식) 가 없을 때만 `aria-label="Dialog"` 를 넘기고, `S/components/Dialog.tsx` 의 폴백 (`:33-37`) 을 지운다 — 그래야 RAC `useDialog` 가 `titleId` 를 살려 `aria-labelledby` 를 단다. Builder 자체 UI 가 shared Dialog 를 직접 쓰는 곳은 Phase 0 에서 세어 `aria-label` 을 넘기게 한다.
- 글자 소유 (Decision 5): 바인딩된 글자 (`{title}` · `{description}` · `{label}`) 의 소유자 = 바인딩 소스 — `catalogSubpartOwnerType` (Properties) 이 바인딩으로 판정하고 (Card 의 CardHeader · CardContent 너머 포함, 자유 slot 의 독립 텍스트는 제외), Canvas 인라인 편집 (`CatalogCanvas.tsx:1203-1213` → `catalogTextCommand`) 은 바인딩된 글자면 소스 prop 에 쓴다. 기존 `TEXT_ONLY_SUBPART_PARENTS` 는 Properties 판정이 바인딩으로 같은 결과를 내는 범위에서 유지 · 정리 (Phase 0 대조). `CATALOG_SIZE_PROPAGATION` 에 InlineAlert → 제목 (같은 단계) · 설명 (한 단계 위) 을 넣는다 — Dialog · Popover · Card · Tooltip 은 지금도 size 를 전달하지 않으므로 자리의 patch 가 정한다.
- unit: DOM 구조 대조 (Phase 0 oracle — 열린 Dialog · Card · InlineAlert) · 값 순서 (자리 patch > 원본 override) · Dialog 제목 `aria-labelledby` 와 `aria-label` 부재 (실제 마운트) · 제목 없는 Dialog 의 `aria-label="Dialog"` · InlineAlert sm/md/lg 의 제목 · 설명 크기 전환 전과 같음 · Card · InlineAlert 의 `title` · `description` prop 이 부품 글자로 (자리표시) · 편집 순서 반례 (부모 prop → 자식 인라인 편집 → 부모 재편집 → undo — Card · InlineAlert · TextField Label 각각 화면 글자가 부모 prop 하나를 따름) · 자유 slot Text 의 인라인 편집은 자기 노드에. 원복 RED. live: Heading · Description 원본 편집 → Dialog (열어서) · Card · InlineAlert 의 Canvas record 와 Preview computed style · Popover · Tooltip 은 record 까지 · Dialog 제목 글자 편집 · undo · Card 제목 더블클릭 편집 뒤 Card `title` 재편집.

### Phase 3 — 정리 · 문서 (G3 · G4)

- 승인 기록 (`approvedDifferences.ts`) 에 G0 목록. `.claude/rules/ssot-hierarchy.md` 의 부품 절에 「바탕의 제목 · 설명」 한 줄. README · CHANGELOG. Live Exercise 절 · Implemented 승격 (G4 사용자 확인 뒤).

## 4. 검증

- unit: 원본 편집 전파 (AI 가 넣은 Heading · 컨테이너 안 제목 · 설명) · 글자 바인딩 소유 (편집 순서 반례) · 값 순서 · DOM 구조 oracle · `aria-labelledby` · 자리표시 전달 · contract 5 거부. 핵심 행은 원복 RED (편집 역적용 — `git checkout` 금지).
- 정적: 컨테이너 5 rule 의 Heading · Description 모양 선언 0.
- 시각 하니스 (`vitest.adr248-g3.browser.config.ts`) 전 case — 승인 차이 증가는 G0 목록만.
- live: 실제 Builder (Compare Mode) — Heading 원본 · Description 원본 편집이 Dialog (열어서) · Card · InlineAlert · AI 가 넣은 Heading 에 양쪽으로 닿음. 스크립트 `apps/builder/scripts/adr254-*-live.mjs`.
- G3: `pnpm gate:perf-ratchet` (커밋 뒤) · `adr209-bundle-closure.mjs` (production 빌드).

## 5. 실행 기록

(착수 뒤 기재)
