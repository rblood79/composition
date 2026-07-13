# Events Panel Wireframe Design

## Purpose

이 문서는 `Events Panel`의 화면 구조와 섹션 배치를 텍스트 와이어프레임 수준으로 정의한다.

상위 결정 문서:

- [ADR-034](../completed/034-events-panel-renovation.md)
- [ADR-032](../completed/032-events-data-integration.md)

---

## Desktop Wireframe

```text
┌──────────────────────────────────────────────┐
│ Events                         Button · 3    │
│ 2 warnings · Connected to Users              │
├──────────────────────────────────────────────┤
│ Connection Status                            │
│ Connected to: Users table                    │
│ Recipes applied: 2                           │
│ State: 1 broken binding                      │
├──────────────────────────────────────────────┤
│ Recommended Recipes                          │
│ [Selection sync] [Open detail modal]         │
│ [Filter collection]                          │
├──────────────────────────────────────────────┤
│ Handlers                                     │
│ ! onSelectionChange     Recipe   2 effects   │
│   onAction              Manual   1 effect    │
│ x onOpenChange          Broken   1 effect    │
├──────────────────────────────────────────────┤
│ Handler Editor                               │
│ WHEN onSelectionChange                       │
│ IF selectedItem != null                      │
│ THEN setState(selectedUser)                  │
│ THEN showModal(user-detail)                  │
│ ELSE showToast("No selection")               │
├──────────────────────────────────────────────┤
│ Diagnostics                                  │
│ Error: field 'avatar_url' no longer exists   │
│ [Choose replacement field]                   │
├──────────────────────────────────────────────┤
│ Preview                                      │
│ This flow updates selectedUser and opens     │
│ the detail modal when a row is selected.     │
└──────────────────────────────────────────────┘
```

---

## Narrow Width Wireframe

좁은 패널에서는 섹션을 모두 열어두지 않는다.

기본 순서:

1. Header
2. Connection Status
3. Recommended Recipes
4. Handlers
5. Selected Handler Editor
6. Diagnostics

`Preview`는 기본 collapse 상태로 둔다.

---

## Section Sizing

### Fixed Priority

- `PanelHeader`: 고정 높이
- `ConnectionStatusSection`: compact summary
- `RecommendedRecipesSection`: 최대 3~5개 카드

### Flexible Priority

- `HandlersListSection`: 중간 높이
- `HandlerEditorSection`: 가장 큰 비중

### Conditional Priority

- `DiagnosticsSection`: 문제 있을 때 강조
- `PreviewSection`: 선택된 recipe/handler 있을 때 확장

---

## Empty Wireframe

```text
┌──────────────────────────────────────────────┐
│ Events                         TextField · 0 │
├──────────────────────────────────────────────┤
│ No events yet                                │
│ Start with a recommended recipe or           │
│ add an empty handler.                        │
│                                              │
│ [Apply recommended recipe]                   │
│ [Add empty handler]                          │
└──────────────────────────────────────────────┘
```

---

## Visual Hierarchy Rules

1. 연결 상태는 항상 추천보다 위에 있다.
2. 추천 recipe는 목록보다 위에 있다.
3. 상세 편집기는 선택 상태가 없으면 최소화된다.
4. diagnostics는 warning/error가 있으면 자동 확장된다.

---

## Open Questions

1. 핸들러 목록과 편집기를 split view처럼 나눌지 여부
2. recipe 카드를 chip 형태로 할지 compact card 형태로 할지 여부
3. preview를 항상 하단에 둘지 inline drawer로 둘지 여부
