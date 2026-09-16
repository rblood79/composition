import type { PrimitiveBinding } from "../types";

/**
 * FileUpload — 대용량 파일 업로드 compound (ADR-201 Phase 3).
 *
 * **D1 = internal source**: RAC 에 FileUpload primitive 가 없다. DOM 은 canonical 자식
 *   DropZone(RAC) · FileTrigger(RAC) · 샘플 행 (frame › Text + ProgressBar) 을 그대로 그리고,
 *   런타임 파일 목록만 RAC `GridList` 로 self-compose 한다 (ARIA 수동 작성 0).
 *
 * **D2 = prop 별 원천 판정 표 (ADR-201 Context 확정, 2026-09-17 review-adr h3)**. RSP v3·S2
 *   에 FileUpload 가 없어 RAC prop 명 + 업계 표준 클라이언트 (tus-js-client · Uppy) 옵션 명을
 *   참조 원천으로 둔다. 아래 11개 **만** accepts 에 둔다 — 표 밖 prop 신설 금지.
 *
 *   | prop                | 원천                            | 근거                                                      |
 *   | ------------------- | ------------------------------- | --------------------------------------------------------- |
 *   | `acceptedFileTypes` | RAC `FileTriggerProps`          | 그대로 자식 FileTrigger 에 투영                           |
 *   | `allowsMultiple`    | RAC `FileTriggerProps`          | 〃                                                        |
 *   | `acceptDirectory`   | RAC `FileTriggerProps`          | 〃 (폴더 선택)                                            |
 *   | `isDisabled`        | RAC `DropZoneProps`             | DropZone/FileTrigger Button 양쪽 비활성                   |
 *   | `endpoint`          | tus-js-client `endpoint`        | 값은 `ApiEndpointDefinition.id` 참조 — URL·헤더는 Data 패널 |
 *   | `chunkSize`         | tus-js-client `chunkSize`       | 바이트. 기본 8MB (Apache `Timeout` 60s 하 1청크 전송 시간) |
 *   | `retryDelays`       | tus-js-client `retryDelays`     | ms 배열                                                   |
 *   | `parallelUploads`   | tus-js-client `parallelUploads` | 동시 파일 수 (1~3)                                        |
 *   | `maxFileSize`       | Uppy `restrictions.maxFileSize` | 바이트, 0 = 무제한                                        |
 *   | `autoProceed`       | Uppy `autoProceed`              | 선택 즉시 시작. (`autoUpload` 아님 — Uppy 명으로 정렬)    |
 *   | `showPreview`       | custom                          | 파일 행 썸네일 on/off 는 D3 시각 표면 — 참조 라이브러리는  |
 *   |                     |                                 | UI 플러그인 옵션으로만 가짐. boolean 1개 한정              |
 *
 *   제거된 후보: `protocol` (tus/cloud/multipart) — D2 표면이 아니라 endpoint 정의에서 파생하는
 *   엔진 어댑터 선택이다 (renderer 내부 결정, v1 은 tus 고정).
 *
 * **D3 = catalog rule**: `COMPONENT_RULES_TABLE.FileUpload` 는 컨테이너 shell (투명 fill ·
 *   column flex · gap) 만. 자식 시각은 DropZone/FileTrigger/ProgressBar/frame 기존 rule.
 *   신규 시각 채널 0 → generate-css 확장 없음.
 *
 * **propPassthrough 전량**: 업로드 옵션은 엔진 큐의 **입력**이지 CSS selector 부가속성이
 *   아니다 (Chart 선례 — `feedback-boolean-visual-prop-falls-through-toracprops`).
 */
export const fileUploadBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "fileupload",
  },
  props: {
    accepts: {
      // ── content — 전송 대상 (ApiEndpointDefinition.id 참조, 정적 비밀 0 — ADR-201 HC7) ──
      endpoint: {
        kind: "string",
        label: "Endpoint",
        section: "content",
      },
      // ── state — RAC FileTriggerProps ──
      acceptedFileTypes: {
        kind: "string-array",
        label: "Accepted File Types",
        section: "state",
      },
      allowsMultiple: {
        kind: "boolean",
        label: "Allow Multiple",
        section: "state",
        default: true,
      },
      acceptDirectory: {
        kind: "boolean",
        label: "Accept Directory",
        section: "state",
      },
      // ── state — 전송 옵션 (tus-js-client / Uppy) ──
      chunkSize: {
        kind: "number",
        label: "Chunk Size",
        section: "state",
        default: 8388608,
        min: 65536,
        step: 65536,
      },
      parallelUploads: {
        kind: "number",
        label: "Parallel Uploads",
        section: "state",
        default: 1,
        min: 1,
        max: 3,
        step: 1,
      },
      retryDelays: {
        kind: "string-array",
        label: "Retry Delays",
        section: "state",
        default: ["0", "1000", "3000", "5000"],
      },
      maxFileSize: {
        kind: "number",
        label: "Max File Size",
        section: "state",
        default: 0,
        min: 0,
      },
      autoProceed: {
        kind: "boolean",
        label: "Auto Proceed",
        section: "state",
        default: true,
      },
      // ── appearance ──
      showPreview: {
        kind: "boolean",
        label: "Show Preview",
        section: "appearance",
        default: false,
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
    propPassthrough: [
      "endpoint",
      "acceptedFileTypes",
      "allowsMultiple",
      "acceptDirectory",
      "chunkSize",
      "parallelUploads",
      "retryDelays",
      "maxFileSize",
      "autoProceed",
      "showPreview",
      "isDisabled",
    ],
  },
};
