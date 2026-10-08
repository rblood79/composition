# Composition 리뷰 계약

변경된 경로에 해당하는 항목만 확인합니다. 판정의 심각도는 실제 영향으로 정합니다.
정본 규칙과 해당 ADR의 현재 승인 내용을 우선합니다. 여기 적힌 심볼이 소스에 없으면
이 파일이 낡은 것이므로 지적하지 말고 보고합니다 (2026-10-08 catalog runtime 기준 개정 —
ADR-248 Phase 4 이전의 Zustand store · spec 경로 항목은 걷어냈습니다).

## 권위·소비자

- DOM·접근성은 RAC, Props는 Spectrum 참조와 custom 계약, 시각은 catalog
  `COMPONENT_RULES_TABLE` + theme/tokens. Canvas와 Preview는 대등한 소비자이며 대칭은
  시각 결과를 뜻합니다 (`.claude/rules/ssot-hierarchy.md`).
- 컴포넌트당 spec 파일 · `packages/specs` · `TAG_SPEC_MAP` 등록은 없습니다. 신규 컴포넌트는
  `catalog/bindings/{Name}.binding.ts` + `componentCatalog.ts` + rule + `pnpm generate:css`.
- Label·Input·Description 등 독립 부품의 모양은 자기 rule이 정본이며 부모는 배치를
  선언합니다. `OWNER_DRAWN_PART_OWNERS`의 indicator·chevron과
  `FIELD_CONTROL_GROUP_HOSTS` 아래 control Group은 부모가 시각도 소유하는 예외입니다.
  모든 부품에 자기 rule을 강제하지 않습니다. 실제 소유 판정은
  `packages/shared/src/catalog/resolvers/resolveDelegatedChildFontSize.ts`의
  `resolveSubpartStyleOwnerType`·`resolveDelegatedSubpartOwnerType`을 읽고,
  Builder `catalogRuntime/subpart.ts`의 소비와 [SSOT](../../../rules/ssot-hierarchy.md)를 대조합니다.
- 기본 원본 라이브러리 (`codeCatalogLibrary.ts`) 구조를 바꾸면 `LIBRARY_CONTRACT_VERSION`
  을 올리고, 옛 개발 프로젝트 거부와 새 문서의 주소 보존을 함께 봅니다. 자동 이관을 추가하지 않습니다.
- 자식·RAC slot·필수 부품·상태 주체·값 바인딩 변경은 [RAC 조립 계약](../../composition-patterns/rules/domain-rac-composition.md)을
  적용합니다. 미전환 family 제한과 DOM 구조/시각 검증을 구분합니다.
- Builder 아이콘 버튼은 `ActionIconButton`, 패널 섹션은 기존 `Section` (`.claude/rules/panel-structure.md`).

## 상태·동기화 (`.claude/rules/state-management.md`)

- 문서를 바꾸는 길은 `CatalogCommand` → `workspace.execute` 하나입니다. graph 직접 수정 ·
  손으로 만든 op 를 `runtime` 에 넣는 코드 · 요소 Zustand store 신설 (`elementsMap` ·
  `childrenMap` 류) 은 결함입니다.
- `applyCatalogTransaction` 의 history 의도는 필수입니다. `skip` 사유는 `project-create` ·
  `load` · `fixture` · `sync` 넷뿐 — 사용자 편집이 skip 으로 들어가면 결함입니다.
- 요소 순서는 `NodeEntry.children` · `PageEntry.children` 배열이 정본이고 `order_num` 은
  없습니다. 순서를 바꾸는 명령이 배열을 보존하는지 봅니다.
- 문서 밖 상태 (collections · 변수) 의 편집은 `useDataStore.applyDataChange` 하나이고 히스토리는
  `recordExternal` 로 같은 스택에 들어갑니다. `set()` 직접 변경 · 히스토리 없는 데이터 편집 ·
  `HUMAN_ONLY_DATA_OPS` 의 AI 노출은 결함입니다.
- 구독은 field 단위 (`subscribeEntryField` · `subscribeResolvedField` · `useCatalog*`).
  step 전체를 구독해 매번 다시 계산하는 패널은 성능 결함입니다.
- Preview 동기화는 `CatalogPreviewChannel` 의 `CATALOG_DELTA` / `CATALOG_SNAPSHOT` 이며,
  `CatalogPreviewFrame.tsx` 의 `event.source` · `event.origin` 검증을 유지합니다.
- Styles 패널 값은 typed field (`visual` · `layout` · `sizing`) 에 저장되고 매핑은
  `catalogStyleWrites` (`styleFields.ts`) 가 유일합니다. 담을 수 없는 값은
  `CatalogStyleValueError` — 값을 버리거나 `props.style` 로 우회하면 결함입니다
  (`.claude/rules/style-ssot.md`).

## 렌더·레이아웃 (`.claude/rules/layout-engine.md` · `canvas-rendering.md`)

- 레이아웃 재계산은 `operationAffectsLayout` · `PAINT_ONLY_VISUAL_KEYS` (제외 방식) →
  `CatalogCompositionRoot.plan` → `styleOf` 직렬화 → `PersistentLayoutTree` 증분 → `canvasBinding`
  rect diff 순서입니다. 새 레이아웃 키는 `styleOf` 가 내보내야 엔진에 닿고, 상자를 바꾸는 키를
  paint-only 목록에 넣으면 재계산이 빠집니다.
- 부모 (owner) 값으로 그리기만 하는 자식 노드는 record 가 같으면 증분 갱신에서 다시 그려지지
  않습니다 — `catalogDerivedPropsDependents` 만으로는 부족하고 `canvasBinding.update()` 의
  dirty 확장이 필요합니다. 그런 자식을 새로 만든 변경은 "owner 필드 변경 → `canvas.update()` →
  자식 칠 변경" 회귀 테스트를 요구합니다.
- 닫힌 overlay 자식 (Popover 안 ListBox · 달력) 은 Canvas 가 그리지 않습니다
  (`TRIGGER_OVERLAY_CHILDREN`). DOM 은 RAC Popover 안에 그립니다.
- `TokenRef` 숫자 연산은 `resolveToken` 경유, fill 은 `resolveFillTokens`/`resolveIndicatorFill`
  경유. gap/padding 은 longhand 우선과 shorthand fallback 을 함께 처리합니다.
- Skia 전용 시각 효과 (DOM/CSS 로 재현 불가) 도입은 D3 대칭 위반입니다. 한쪽 소비자만 고친
  렌더 수정은 `/cross-check` 결과를 요구합니다.
- 상태 변수 `{{ name }}` 은 Canvas 가 기본값 env, Preview/publish 가 런타임 env — 설계된
  비대칭이라 결함으로 올리지 않습니다.

## 조용한 실패 — fallback 이 기본값과 같으면 끊긴 채널이 보이지 않는다

해소기 · 바인딩 · 소비자에 `?? default` · `catch {}` · 빈 분기가 추가되거나 바뀐 변경은
다음을 확인합니다.

- fallback 값이 그 축의 catalog/theme 기본값과 같은가. 같으면 채널이 끊겨도 기본 문서에서는
  증상이 없고 사용자가 값을 바꿀 때만 드러납니다. 판정은 **기본값과 다른 값 · 실제 저장
  형태** (px 문자열 등) 로 한 번 통과시켜 확인합니다.
- `catch` 가 삼킨 오류가 toast · `CatalogSubscriberError` · `operationNotice` 중 어디로도 가지
  않으면 결함입니다. 저장 (`CatalogStorage.commit` 의 `REVISION_CONFLICT`) 과 transaction
  검증 실패는 반드시 사용자에게 닿아야 합니다.
- 선언한 prop 을 소비자가 읽지 않아 한쪽 leg (DOM 또는 Canvas) 만 조용히 빠지는 경우 —
  `accepts` 에 추가한 prop 은 binding 과 Canvas rule 양쪽 도달을 봅니다.
- Canvas 선택 · hover · 편집 맥락은 `CatalogSession.reconcile()` 이 사라진 대상을 뺍니다.
  삭제 뒤 stale id 가 남는 경로를 새로 만들면 결함입니다.

## 이력 — 같은 결함의 재발인가

변경 파일마다 `git log --oneline -15 -- <path>` 로 최근 fix/revert 를 보고 다음을 확인합니다.

- 같은 파일 · 같은 scope 에 최근 30일 fix 가 반복되면 (세션 시작 집계: canvas · adr-248 ·
  styles-panel 상위) 이번 변경이 그 fix 가 막은 증상을 다시 열지 않는지 봅니다. 그 fix 의
  회귀 테스트가 아직 그 행을 지키는지 (삭제 · skip 되지 않았는지) 확인합니다.
- 변경이 `docs/adr/reviews/{NNN}.md` 의 `fixed` 이슈를 되돌리면 그 round 의 실패 재현
  방법으로 다시 확인합니다.
- 메모리 "착수 전 필독 (함정)" 의 항목이 변경 영역에 해당하면 그 함정이 재현되는 입력으로
  한 번 통과시킵니다. 함정 기록이 없는 새 패턴의 결함은 결과 요약에 한 줄로 남겨 메인
  세션이 메모리에 기록하게 합니다.

성능은 해당 hot path와 현재 ADR 예산 (initial 번들 상한 · 결정적 카운트 ratchet) 의 근거로
판단합니다. TypeScript·스타일 일반 규칙은 기존 lint·typecheck 결과를 활용하며 의미 없는
체크리스트 항목을 추가하지 않습니다.
