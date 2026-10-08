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
- Status 절에 출처를 남깁니다 — `사용자 요청: /create-adr (날짜)` 한 줄과 방향을 정한 사용자
  원문 인용, 사용자가 이미 답한 확인 항목. 이 기록이 전제 확정의 지속 형태입니다.
- 대안과 위험·선택 근거·검증 조건을 구체적으로 작성합니다. 빈 틀을 먼저 만드는
  별도 단계나 고정 작성 순서는 필요 없습니다.
- Gate 의 집행 수단은 저장소 git 정책과 양립해야 합니다 — pre-push 게이트 또는
  `push: main` 워크플로. PR / status check 표현은 이 저장소에 존재하지 않는 수단입니다.
- 4개 결정 지점 밖에서 사용자 판정이 필요한 항목은 질문 대신 본문에 「사용자 결정 N건」
  목록으로 모읍니다. execute-adr 가 그 항목에 닿을 때 묻습니다.
- 다단계 구현·파일 변경표는 `docs/adr/design/` breakdown으로 분리하고 본문에 연결합니다.
  `docs/adr/evidence/` 는 gitignore 된 로컬 폴더이므로 인벤토리·실측의 결론은 breakdown 에 둡니다.
- 기존 ADR 분리는 선행 결정·데이터 모델 경계를 확인합니다. 분리는 결정 지점 ①
  ([premise-decision-points.md](../../rules/premise-decision-points.md))이므로, 사용자가 이번
  요청으로 지시한 분리만 그 요청을 confirm 으로 보고 진행합니다. 요청에 없던 분리·새로운
  저장 스키마·범위 변경은 사용자에게 묻습니다.

README 갱신 범위 — 현황 공지 한 문단 (실측 · 채택 대안 · 사용자 결정 지점 · 열림/합계 수),
「지금 열려 있는 것」 항목 (상태 · 규모 · breakdown 링크), 권장 착수 순서 표.
문서·링크·인덱스 정합성까지 확인합니다.

작성 요청이 리뷰·구현·commit/push 권한을 뜻하지는 않습니다. 리뷰는 사용자가 요청하면
`review-adr` 로 하고 `docs/adr/reviews/NNN.md` writer 에 기록합니다 (승인 round 는 pending 0).
