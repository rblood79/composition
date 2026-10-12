# ADR-259 breakdown — S2 도움말 · 앞 글자 · 항목 링크

> 본문: [ADR-259](../259-s2-contextual-help-prefix-item-links.md). 이 문서는 Phase · 파일 · 확인 항목만 둔다. 결정 · 대안 · 위험은 본문이 정본이다.

## 1. 범위 고정

- 한 ADR · 네 Phase (사용자 「하나로 + href 포함」, 2026-10-12). Phase 순서는 작은 것부터 — 링크 (기존 부품만) → 앞 글자 (기존 Group 경로) → 도움말 (새 type 2).
- 선행 ADR 의존: ADR-255 (trigger + overlay 노드) · ADR-256 (레퍼런스 노드 트리 · 레이아웃 frame 건너뛰기 · G5) · ADR-253 (기본 원본 · quiet = Input rule) · ADR-257 (항목 전파 `CATALOG_OVERFLOW_MODE_OWNERS`). 방향 반전 없음 — 이 ADR 은 그 결정들의 응용이다.
- 기존 원본 템플릿 변경 0 → contract 41 유지 (본문 Decision 4). 이 전제가 깨지면 Phase 0 에서 멈춘다.

## 2. Phase

### Phase 0 — 인벤토리 · oracle (G0)

- 템플릿 변경 0 확인: 이 ADR 이 손대는 원본 정의 · 템플릿 목록 (새 원본 = ContextualHelp 하나, 새 type = ContextualHelp · FieldLabel) 과 기존 템플릿 diff 0.
- oracle 고정 (`apps/builder/tests/fixtures/adr259-s2-oracle.json`): 설치 `@react-spectrum/s2` 를 jsdom 에 마운트 —
  - `TextField contextualHelp={<ContextualHelp variant>…}` 의 버튼 `aria-label` · `aria-labelledby` (라벨 id + 도움말 id) · 버튼 이름 계산 결과 (variant 2)
  - Popover 의 `role` · `aria-labelledby` (제목 id)
  - `prefix` 다섯 field 의 input `aria-labelledby` · 이름 계산 결과 (글자 · 아이콘)
  - RAC 항목 7 type 의 링크 DOM (`<a href target rel>` / `data-href` · `data-target` · `data-rel`)
- S2 치수 → 우리 토큰 대응표: 라벨 행 (`&nbsp;` 간격 · baseline) · 도움말 버튼 (XS · S, quiet) · Popover (폭 268 · padding 24 · heading-xs · body-sm · Footer margin-top 16) · 앞 글자 (`gray-600` · `text-to-visual` · 아이콘 `1lh`) · 바깥 링크 글리프 (ListView M · Menu S→M … , 자리). 값은 S2 소스 (`ContextualHelp.tsx:36-42` · `Field.tsx:291-311` · `ListView.tsx:807-814` · `Menu.tsx:440-448, 788-793`) 에서 읽는다.
- WebKit 합성 링크 실측 (R3): Preview 에 `data-href` GridListItem 하나 · Enter / 클릭 → iframe URL 변화 여부.

### Phase 1 — 항목 링크 (G1)

- accepts: ListBoxItem · Tab · Tag · TreeItem · GridListItem · Row binding 에 `href` · `target` · `rel` (Link 정의 재사용). MenuItem 은 rule type 이라 `ruleTypeDefinition` 의 item accepts 경로 (`ruleDefinition.ts:326-330` 근처) 에 같은 세 키.
- DOM: 각 항목 binding 이 RAC 에 그대로 (`<a>` · `data-href` 는 RAC 가 만든다). `<a>` 의 기본 링크 칠 중화는 rule 의 항목 선택자에서 (R4).
- `hideLinkOutIcon`: GridList · Menu accepts, 항목 파생 값으로 전파 (`CATALOG_OVERFLOW_MODE_OWNERS` 와 같은 표).
- 바깥 링크 글리프 (사용자 결정 1 = L1, 2026-10-12): GridListItem · MenuItem binding 이 `href && target === "_blank" && !hideLinkOutIcon` 일 때 끝에 `external-link` 아이콘, Canvas 는 resolver 파생 `_linkOut` 을 읽어 같은 자리에 `icon_font` 로 그린다 (필수 표시 suffix 의 「파생 표시」 경로).
- Preview 탐색: `catalogPreviewLinkClick` 유지 · G0 ③ 이 새면 `RouterProvider` 를 Preview · Publish 루트에 (navigate = page 이동).
- Design 패널: 항목에 「Link」 필드 (Link 와 같은 href · target · rel). AI manifest 의 항목 accepts.

### Phase 2 — 앞 글자 (G2)

- NumberField · ComboBox: Group 맨 앞의 Text · Icon 노드 `slot=prefix`.
- TextField · TextArea · ColorField: 패널 「앞 글자 추가」 = Input 을 Group 으로 감싸고 앞 글자 노드를 넣는 명령 하나 (제거 = 풀기). 감싼 field 는 `FIELD_CONTROL_GROUP_HOSTS` · `CATALOG_WRAPPED_CONTROL_FIELDS` 판정을 「Group 자식이 있으면」 으로 넓힌다 (type 고정 집합 → type + 실제 자식).
- 칠: 상자 · quiet · invalid · focus · disabled 를 Group 쪽에서 (NumberField 와 같은 delegation), 앞 글자 모양은 field rule `[slot=prefix]`.
- 접근성: 앞 글자 노드 id 를 input 의 `aria-labelledby` 끝에 (S2 `Field.tsx:248-253`).
- 포커스 전달 (리뷰 r1-m2): 앞 글자가 있는 상자 Group 의 DOM 이 S2 `FieldGroup` 처럼 `onPointerDown` (mouse) · `onTouchEnd` 에서 대상이 `button,input,textarea,[role="button"]` 밖이면 안 input · textarea 를 focus (`Field.tsx:258-273`). disabled field 는 넘기지 않음. 일반 Group (`components/Group.tsx`) 은 손대지 않는다 — field binding 쪽에서.
- Canvas: Group flex row 그대로 — 새 primitive 없음.

### Phase 3 — 도움말 (G3)

- 새 type `ContextualHelp` (binding · rule · 생성 CSS · `TRIGGER_OVERLAY_CHILDREN` · `componentTraits` · nesting) 와 원본 `component-contextualhelp` (`ContextualHelp > Button > Icon + Popover > Heading[slot=title] + Content + Footer`, Popover 의 위치 prop 바인딩).
- `variant` → Icon 글리프 (`circle-question-mark` · `info`) · 버튼 이름 (S2 문자열) 파생. 버튼 크기 = field size 파생.
- trigger Button 은 원본에서 `slot: false` (리뷰 r1-h1) → RAC `slot={null}` — field ButtonContext 차단. 이름 = `aria-label` (variant 문자열) + field 안이면 `aria-labelledby` = 라벨 id + 도움말 id (S2 `ContextualHelpContext`).
- 제목 연결 (리뷰 r1-m1): ContextualHelp binding 이 안정된 title id 를 만들어 title slot Heading 의 `id` 와 Popover 의 `aria-labelledby` 에 준다 (S2 `ContextualHelpPopover`). 제목 Heading 이 없으면 RAC 기본 (trigger 이름). ContextualHelp 밖 Popover 는 무변경.
- 새 type `FieldLabel` (사용자 prop 0) — 부품 조회 건너뛰기 (`PART_FRAME_TYPES` · `catalogDomPartParent` · DOM watch), field rule 의 side label 1열 선택자에 `> .field-label`, 라벨 행 rule (한 줄 · baseline).
- Content · Footer owners 에 Popover.
- Design 패널 field 「도움말 추가 · 제거」 = Label 감싸기 + 원본 instance 삽입 명령 하나. 사용자 결정 2 = 팔레트 overlay 묶음의 Popover 뒤 (2026-10-12).
- AI manifest: ContextualHelp · FieldLabel 생성 규칙.

### Phase 4 — 마감 (G4)

- pre-push ratchet · 번들 · live 하니스 (`apps/builder/scripts/adr259-live.mjs`) · CHANGELOG · README · 조사 문서 §6.1 「라」 · 「링크」 갱신 · `ssot-hierarchy.md` D3 sub-part 절에 라벨 행 · 앞 글자 · 도움말 한 줄.

## 3. 확인 항목 요약

| Gate | 핵심                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| G0   | 템플릿 변경 0 · S2/RAC oracle · WebKit 합성 링크 · 치수 대응표                       |
| G1   | 링크 7 type 쓰기 · DOM oracle · Preview 탐색 Chrome/WebKit · 글리프 Canvas = Preview |
| G2   | 앞 글자 5 × 2 × 4 Canvas = Preview · input 이름 · 명령 하나 · 없는 field 무변경      |
| G3   | 라벨 행 16 × 2 × 3 Canvas = Preview · 버튼/Popover 접근성 · 필수 표시 · 편집         |
| G4   | ratchet · 번들 · live                                                                |

## 4. Phase 결과

(실행 시 Phase 마다 기록)
