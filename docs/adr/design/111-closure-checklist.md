# ADR-111 Phase 2 Closure 5단계 사전 체크리스트

> 본 문서는 [ADR-111](../completed/111-layout-frameset-pencil-redesign.md) Phase 2 closure 를 위해 작성됐던 historical checklist 다. 2026-04-30 이후 ADR-112 base 완료 + ADR-116 선행 결정으로, ADR-111 잔여 G3/G4/G5 는 ADR-116 G2/G5/G6 이후 재개한다.
>
> **2026-05-03 note**: ADR-111 은 2026-05-02 Implemented 로 archive 됐고, direct cutover 후 발견된 FramesTab / Skia frame body / Slot 표시 회귀는 ADR-116 canonical frame scope fix 로 닫았다. 이 checklist 는 historical pre-closure 자료로만 유지한다.

## 진입 prerequisite

| 조건                     | 검증 방법                                                 | 통과 기준                |
| ------------------------ | --------------------------------------------------------- | ------------------------ |
| ADR-116 G2 통과          | canonical store/API + canonical→legacy export adapter API | mutation/export API 존재 |
| ADR-116 G5 baseline 확정 | legacy field quarantine 측정표                            | adapter-only 기준 확정   |
| dev runtime 회귀 0       | Chrome MCP / cross-check skill / 사용자 검증              | 추가 회귀 0건            |

기존 monitoring 기반 Phase 2 Implemented 승격 흐름은 더 이상 다음 작업의 선행 조건이 아니다. 남은 closure 는 ADR-116 이후 G3 canonical-native cascade / G4 legacy adapter 0 / G5 Pencil import-export parity 를 닫은 뒤 재작성한다.

## Closure 재작성 기준

기존 Phase 2 monitoring 기반 closure 5단계 템플릿은 실행하지 않는다. 남은 작업은 아래 순서로 다시 체크리스트를 작성한다.

| 순서 | 작업                                                                                                       | 선행 조건          |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| 1    | ADR-116 G2 canonical store/API + canonical→legacy export adapter API 확정                                  | ADR-116 Phase 0/1  |
| 2    | ADR-111 G3 canonical-native cascade (`deleteReusableFrame` / `duplicateReusableFrame` / `setPageFrameRef`) | ADR-116 G2         |
| 3    | ADR-111 G4 legacy adapter 0 + PanelSlot/BottomPanelSlot 명칭 충돌 해소                                     | ADR-116 G5         |
| 4    | ADR-111 G5 Pencil `.pen` import/export parity + imports resolver/cache boundary 통합                       | ADR-116 G6         |
| 5    | 본문 Status / README / CHANGELOG / archive 여부 재판정                                                     | G3/G4/G5 모두 PASS |

ADR-113 Step 4-4 write-through 은 ADR-111 Phase 2 monitoring 이 아니라 ADR-116 G2 이후 canonical primary/shadow write 정책에 맞춰 재평가한다.

## 관련 문서

- ADR-111: `docs/adr/completed/111-layout-frameset-pencil-redesign.md` (Status: Implemented)
- ADR-111 design breakdown: `docs/adr/design/111-layout-frameset-pencil-redesign-breakdown.md` (843줄)
- ADR-116: `docs/adr/completed/116-canonical-document-ssot-transition.md` (canonical document SSOT 선행)
- 메모리 [feedback-adr-closure-5-step.md] — closure 5단계 패턴 정본
- 메모리 [session-2026-04-27-session45-adr110-implemented.md] — 본 세션 진입 가이드
