---
description: 새 ADR 생성 — 번호 자동 할당 + Risk-First 템플릿 + README.md 동시 갱신
argument-hint: [ADR 제목]
---

`create-adr` skill을 호출하여 "$ARGUMENTS" 제목의 ADR을 생성한다.

필수 사항:

- 번호 할당: docs/adr/ + docs/adr/completed/ 양쪽 스캔, **900 미만 정규 밴드 최대 + 1** (900+ 밴드는 인프라/렌더링 특수 트랙 — 사용자 명시 요청 시에만)
- Risk-First 템플릿 (Context → Alternatives → Threshold Check → Decision → **Risks** → Gates 순서)
- 구현 상세는 docs/adr/design/NNN-\*-breakdown.md로 분리
- docs/adr/README.md 테이블 동시 갱신
- rules/adr-writing.md 검증 체크리스트 전체 + 반복 패턴 선차단 항목 통과
