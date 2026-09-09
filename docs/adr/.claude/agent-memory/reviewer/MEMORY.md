# Reviewer Agent Memory

## 주요 검토 패턴

### 문서-코드 불일치 유형 (반복 발생)
1. **미구현 표기 오류**: 설계 문서에 "미구현"으로 기재된 항목이 실제로 구현되어 있는 경우 빈번.
   - 예: ScrubInput, @dnd-kit 의존성, Phase 4 컴포넌트
2. **Schema 파라미터명 불일치**: 문서의 JSON Schema 예시가 실제 코드와 파라미터명 차이 존재.
   - 예: search_elements의 `prop/value` vs `propName/propValue`
3. **삭제 상태 오기재**: 삭제했다고 기재된 파일이 실제로 존재하는 경우.
   - 예: PixiColorSwatchPicker.tsx

### O(1) 조회 규칙 위반 패턴
- `systemPrompt.ts` 등 서비스 레이어에서 `elements.find()` 배열 순회가 발생할 수 있음.
- `BuilderContext`가 배열 형태(`elements: Array<...>`)로 전달되어 구조적으로 O(1) 조회 불가.
- 이 경우 호출 전에 `elementsMap`에서 미리 조회 후 전달하는 패턴으로 개선 권고.

### 프로젝트 관련 경로 참조
- AI 서비스: `apps/builder/src/services/ai/`
- AI 타입: `apps/builder/src/types/integrations/`
- AI 패널: `apps/builder/src/builder/panels/ai/`
- Color Picker: `apps/builder/src/builder/panels/styles/`
- Fill 타입: `apps/builder/src/types/builder/fill.types.ts`
- Feature Flags: `apps/builder/src/utils/featureFlags.ts`

### 확인된 구현 현황 (2026-03-03 기준)
- AI Tool Calling (7개 도구): 구현 완료
- Agent Loop (AgentService): 구현 완료
- Color Picker Phase 1~4: 구현 완료 (문서 일부에 미착수 오기재)
- ScrubInput: 구현 완료 (문서에 미구현 오기재)
- @dnd-kit/sortable: 설치 및 사용 중 (문서에 미설치 오기재)
- G.3 AI 시각 피드백 (aiVisualFeedback.ts, aiEffects.ts): 구현 완료
