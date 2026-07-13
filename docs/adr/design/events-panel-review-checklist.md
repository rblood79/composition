# Events Panel Review Checklist

## Purpose

이 문서는 `ADR-032`, `ADR-034`, 그리고 관련 상세 설계 문서를 리뷰할 때 확인할 항목을 한곳에 모은 체크리스트다.

관련 문서:

- [ADR-032](../completed/032-events-data-integration.md)
- [ADR-034](../completed/034-events-panel-renovation.md)
- [events-panel-wireframe.md](events-panel-wireframe.md)
- [events-panel-state-model.md](events-panel-state-model.md)
- [events-panel-recipe-system.md](events-panel-recipe-system.md)
- [events-panel-binding-diagnostics.md](events-panel-binding-diagnostics.md)

---

## 1. Scope Check

- `ADR-032`가 플랫폼 아키텍처 범위를 명확히 정의하고 있는가
- `ADR-034`가 패널 UX 개편 범위를 명확히 정의하고 있는가
- 상위 ADR과 하위 상세 설계의 책임 경계가 겹치지 않는가
- 구현 세부가 ADR에 과도하게 침투하지 않았는가

---

## 2. User Flow Check

- 사용자가 패널을 열었을 때 첫 행동이 명확한가
- 데이터가 없는 상태와 있는 상태의 시작 UX가 충분히 다른가
- 초보자 경로와 숙련자 경로가 모두 설명되는가
- 추천에서 편집으로 넘어가는 흐름이 자연스러운가
- broken 상태를 발견하고 수정하는 흐름이 설계되어 있는가

---

## 3. Information Architecture Check

- `ConnectionStatusSection`이 추천보다 먼저 오는 이유가 타당한가
- `RecommendedRecipesSection`이 이벤트 추천보다 상위 개념으로 충분히 설득력 있는가
- `HandlersListSection`과 `HandlerEditorSection`의 역할 분리가 명확한가
- `DiagnosticsSection`이 별도 섹션으로 존재해야 하는 이유가 충분한가
- `PreviewSection`의 필요성과 우선순위가 타당한가

---

## 4. State Model Check

- panel-local 상태와 저장 대상 상태가 구분되어 있는가
- `selectedHandlerId`, `selectedRecipeId`, `selectedDiagnosticId` 등 selection 모델이 충분히 명확한가
- manual / recipe / broken / warning / disabled 상태 우선순위가 일관적인가
- diagnostics 계산 시점이 과도하게 복잡하지 않은가

---

## 5. Recipe System Check

- recipe가 정말 event보다 더 적절한 추천 단위인가
- recipe 적용, 재적용, drift 개념이 충분히 정의되었는가
- 동일 recipe 중복 적용 시 정책이 필요한가
- recipe-generated handler를 수동 수정했을 때의 상태 정의가 충분한가

---

## 6. Diagnostics Check

- 어떤 문제를 error / warning / info로 나눌지 기준이 명확한가
- broken binding이 패널에서 조기에 보이도록 설계되어 있는가
- fix action이 실제 사용자 행동으로 충분히 연결되는가
- diagnostics가 너무 시끄럽지 않도록 우선순위가 설계되어 있는가

---

## 7. Architecture Consistency Check

- `TriggerRegistry`, `EffectRegistry`, `CapabilityRegistry`, `RecipeRegistry`의 경계가 논리적으로 분리되어 있는가
- `EffectRegistry`가 UI 메타데이터와 런타임 실행을 함께 가져도 되는지 합의 가능한가
- `BindingRef`와 `Condition DSL` 전환의 필요성이 충분히 설명되는가
- 현재 코드베이스의 제약과 제안 모델 사이의 간극이 과도하지 않은가

---

## 8. Migration Risk Check

- 현재 패널에서 새 패널로 넘어가는 전환 단계가 현실적인가
- 기존 저장 포맷과의 호환 전략이 충분한가
- 과도기 동안 old/new 시스템 공존 리스크가 식별되어 있는가
- 런타임과 편집기 간 불일치 리스크가 줄어드는 방향인가

---

## 9. Naming / Documentation Check

- `Events`, `Recipe`, `Handler`, `Effect`, `Binding`, `Diagnostics` 용어가 문서 간 일관적인가
- 문서 링크가 모두 유효한가
- ADR 번호 체계에 충돌이나 혼동 요소가 없는가
- ADR 번호 체계가 충돌 없이 정리되었는가

---

## 10. Decision Readiness Check

- 지금 단계에서 팀이 결정해야 할 항목과 보류할 항목이 구분되어 있는가
- 구현 전에 꼭 닫아야 할 open question이 무엇인지 분명한가
- wireframe 수준 합의만으로 다음 설계 단계로 넘어갈 수 있는가

---

## Recommended Review Order

1. [ADR-032](../completed/032-events-data-integration.md)
2. [ADR-034](../completed/034-events-panel-renovation.md)
3. [events-panel-wireframe.md](events-panel-wireframe.md)
4. [events-panel-state-model.md](events-panel-state-model.md)
5. [events-panel-recipe-system.md](events-panel-recipe-system.md)
6. [events-panel-binding-diagnostics.md](events-panel-binding-diagnostics.md)
7. [events-panel-review-checklist.md](events-panel-review-checklist.md)
