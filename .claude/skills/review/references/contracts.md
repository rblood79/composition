# Composition 리뷰 계약

변경된 경로에 해당하는 항목만 확인합니다. 판정의 심각도는 실제 영향으로 정합니다.
정본 규칙과 해당 ADR의 현재 승인 내용을 우선합니다.

## 권위·소비자

- DOM·접근성은 RAC, Props는 Spectrum 참조와 custom 계약, 시각은 catalog + theme/tokens.
  Canvas와 Preview는 대등한 소비자이며 대칭은 시각 결과를 뜻합니다.
- catalog 컴포넌트를 잔존 spec이나 TAG_SPEC_MAP에 새로 등록하지 않습니다.
- CSS의 `@sync`는 시각 정본을 가리키며 소비자끼리 서로의 기준이 되지 않습니다.
- Builder 아이콘 버튼은 `ActionIconButton`, 패널 섹션은 기존 `Section`을 사용합니다.

## 상태·동기화

- canonical mutation과 기존 history/persistence action을 사용합니다.
  derived `elementsMap`·legacy `order_num`을 쓰기 SSOT로 만들지 않습니다.
- page-bound mutation은 commit 시점 `readImmediateSelectionSnapshot()`으로 만든
  FromSelection 경로, 또는 `contextReason`을 갖는 Explicit 경로를 사용합니다.
  deferred selection의 stale pageId를 commit source로 캡처하지 않습니다.
- Preview postMessage는 origin 검증과 PREVIEW_READY 버퍼 경계를 유지합니다.
- UI 컴포넌트에서 IndexedDB를 직접 호출해 store action을 우회하지 않습니다.

## 렌더·레이아웃

- DirectContainer는 엔진이 산출한 좌표를 배치합니다. display별 엔진 선택은
  `.claude/rules/layout-engine.md`를 따릅니다.
- grid 컨테이너·자식 서브트리 등록과 `GRID_REBUILD_TRIGGER_KEYS` 변경은
  full rebuild 필요 여부를 확인합니다. incremental 갱신의 stale degrade를 검사합니다.
- 레이아웃 영향 변경은 trigger와 cache signature 양쪽에 반영되는지 확인합니다.
  canonical `children[]` 순서를 보존합니다.
- `TokenRef`는 `resolveToken`, fill은 `resolveFillTokens`/`resolveIndicatorFill` 경로를 사용합니다.
  gap/padding은 longhand 우선과 shorthand fallback을 함께 처리합니다.
- collection renderer root의 `element.props.style` 전달을 확인합니다.
- `sceneNodesMap`은 진단용입니다. render node가 없을 때 scene node로 대체해
  렌더 오류를 숨기지 않습니다.

성능은 해당 hot path와 현재 ADR 예산의 근거로 판단합니다. TypeScript·스타일 일반 규칙은
기존 lint·typecheck 결과를 활용하며 의미 없는 체크리스트 항목을 추가하지 않습니다.
