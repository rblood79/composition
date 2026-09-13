---
name: create-adr
description: 사용자가 새 ADR 작성을 요청할 때 문서와 ADR 인덱스를 작성.
user-invocable: true
disable-model-invocation: true
---

# ADR 작성

요청한 결정을 현재 코드와 근거에 맞게 문서화하고 `docs/adr/README.md`를 함께 갱신합니다.
[ADR 작성 규칙](../../rules/adr-writing.md)의 구조·상태·번호 계약을 사용합니다.

- 일반 번호는 `docs/adr/`와 `docs/adr/completed/` 양쪽의 900 미만 최대 번호 + 1.
  900 이상 특수 트랙은 사용자가 지정했을 때만 사용합니다.
- 주제에서 한글 제목과 kebab-case 파일명을 정할 수 있으면 스스로 정합니다.
- 대안과 위험·선택 근거·검증 조건을 구체적으로 작성합니다. 빈 틀을 먼저 만드는
  별도 단계나 고정 작성 순서는 필요 없습니다.
- 다단계 구현·파일 변경표는 `docs/adr/design/` breakdown으로 분리하고 본문에 연결합니다.
- 기존 ADR 분리는 선행 결정·데이터 모델 경계를 확인합니다. 기존 승인 범위면
  재승인 없이 진행하고, 새로운 저장 스키마나 범위 변경의 결정만 사용자에게 묻습니다.

문서·링크·인덱스 정합성까지 확인합니다. 작성 요청이 구현·commit/push 권한을 뜻하지는 않습니다.
