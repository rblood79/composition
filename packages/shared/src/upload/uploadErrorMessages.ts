/**
 * FileUpload 의 오류 문구 (S2 체크리스트 §4.1 FileUpload, 2026-11-23) — 엔진 · 껍데기의 오류 코드
 * (`@composition/upload` R1 표 · `E_NO_ENDPOINT` · `E_UNAUTHORIZED` · `E_ENGINE_UNAVAILABLE`) 를 사람이
 * 읽는 문장으로. 코드는 요소의 `data-code` 로 남는다. 언어는 InlineAlert 아이콘 이름과 같은 셋
 * (`CATALOG_INLINE_ALERT_ICON_LABELS` — 없으면 영어).
 */

type Messages = Readonly<Record<string, string>>;

/** The alert's title — a file that failed · the uploader that cannot send. */
const TITLES: Readonly<Record<string, { file: string; blocked: string }>> = {
  en: { file: "Upload failed", blocked: "Uploads unavailable" },
  ko: { file: "업로드 실패", blocked: "업로드할 수 없음" },
  ja: {
    file: "アップロードに失敗しました",
    blocked: "アップロードできません",
  },
};

const REASONS: Readonly<Record<string, Messages>> = {
  en: {
    E_TOO_LARGE: "The file is larger than the allowed size.",
    E_UNAUTHORIZED: "You are not allowed to upload. Sign in again.",
    E_NETWORK: "The connection was lost.",
    E_REJECTED: "The server did not accept this file.",
    E_SERVER: "The server could not save the file.",
    E_PATCH_BLOCKED: "The server does not allow resumable uploads.",
    E_PROXY_TIMEOUT: "The upload took too long.",
    E_OFFSET_MISMATCH: "The upload could not resume.",
    E_EXPIRED: "The upload could not resume.",
    E_CHECKSUM: "The upload could not resume.",
    E_CANCELLED: "The upload was cancelled.",
    E_NO_ENDPOINT: "No upload address is set.",
    E_ENGINE_UNAVAILABLE: "The uploader could not load.",
    default: "Something went wrong.",
  },
  ko: {
    E_TOO_LARGE: "허용된 크기보다 큰 파일입니다.",
    E_UNAUTHORIZED: "업로드 권한이 없습니다. 다시 로그인하세요.",
    E_NETWORK: "연결이 끊겼습니다.",
    E_REJECTED: "서버가 이 파일을 받지 않았습니다.",
    E_SERVER: "서버가 파일을 저장하지 못했습니다.",
    E_PATCH_BLOCKED: "서버가 이어 올리기를 허용하지 않습니다.",
    E_PROXY_TIMEOUT: "업로드 시간이 너무 오래 걸렸습니다.",
    E_OFFSET_MISMATCH: "업로드를 이어 갈 수 없습니다.",
    E_EXPIRED: "업로드를 이어 갈 수 없습니다.",
    E_CHECKSUM: "업로드를 이어 갈 수 없습니다.",
    E_CANCELLED: "업로드를 취소했습니다.",
    E_NO_ENDPOINT: "업로드 주소가 없습니다.",
    E_ENGINE_UNAVAILABLE: "업로드 기능을 불러오지 못했습니다.",
    default: "문제가 생겼습니다.",
  },
  ja: {
    E_TOO_LARGE: "許可されたサイズを超えるファイルです。",
    E_UNAUTHORIZED:
      "アップロードの権限がありません。もう一度サインインしてください。",
    E_NETWORK: "接続が切れました。",
    E_REJECTED: "サーバーがこのファイルを受け付けませんでした。",
    E_SERVER: "サーバーがファイルを保存できませんでした。",
    E_PATCH_BLOCKED: "サーバーが再開可能なアップロードを許可していません。",
    E_PROXY_TIMEOUT: "アップロードに時間がかかりすぎました。",
    E_OFFSET_MISMATCH: "アップロードを再開できません。",
    E_EXPIRED: "アップロードを再開できません。",
    E_CHECKSUM: "アップロードを再開できません。",
    E_CANCELLED: "アップロードをキャンセルしました。",
    E_NO_ENDPOINT: "アップロード先が設定されていません。",
    E_ENGINE_UNAVAILABLE: "アップローダーを読み込めませんでした。",
    default: "問題が発生しました。",
  },
};

const language = (locale: string) => {
  const code = locale.split("-")[0] ?? "en";
  return REASONS[code] ? code : "en";
};

/** The alert's title — `blocked` for the uploader's own state (no address · no engine · no access). */
export function uploadErrorTitle(locale: string, blocked: boolean): string {
  const titles = TITLES[language(locale)]!;
  return blocked ? titles.blocked : titles.file;
}

/** The sentence for an error code (its language's fallback, then English). */
export function uploadErrorMessage(locale: string, code: string): string {
  const reasons = REASONS[language(locale)]!;
  return reasons[code] ?? reasons.default!;
}
