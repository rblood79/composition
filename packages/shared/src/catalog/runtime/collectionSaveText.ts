/**
 * ADR-324 — 「모아서 저장」 words the viewer reads (a save's toast, a row's save note) by the site's
 * language (`ProjectEntry.site.lang` — en · ko, English otherwise). The
 * judging modules give codes (`SaveReasonCode`); a reason that is no code (`HTTP 422`, a server's
 * own text, a network error) is shown as it came.
 */

export type SaveReasonCode =
  | "noKey"
  | "noConnection"
  | "noVersion"
  | "processing"
  | "pending"
  | "changedFirst"
  | "recheckNoConnection"
  | "recheckFailed"
  | "recheckAmbiguous"
  | "goneOnServer"
  | "authStopped"
  | "noEndpoint"
  | "invalidInput"
  | "notApplied"
  | "batchNotApplied"
  | "conflict"
  | "methodCannotSend"
  | "atomicPartial"
  | "missingInAnswer"
  | "keyRowDiffers"
  | "keyNotFound";

export type SaveMessageCode =
  | "saveOff"
  | "saving"
  | "noChanges"
  | "noConflicts"
  | "noPending"
  | "linkPick"
  | "linked";

type Counted = "saved" | "failed" | "conflicts" | "pending" | "skipped";

interface SaveWords {
  readonly reasons: Readonly<Record<SaveReasonCode, string>>;
  readonly messages: Readonly<Record<SaveMessageCode, string>>;
  readonly counts: Readonly<Record<Counted, (n: number) => string>>;
}

const SAVE_TEXT: Readonly<Record<string, SaveWords>> = {
  en: {
    reasons: {
      noKey: "No key",
      noConnection: "No connection to send it",
      noVersion:
        "No base version — the row read has no version value, so it was not sent",
      processing: "Processing",
      pending: "Result to be checked",
      changedFirst: "Someone else changed it first",
      recheckNoConnection: "No connection to check the row",
      recheckFailed: "Checking the row failed",
      recheckAmbiguous: "The check did not find a single row",
      goneOnServer: "Deleted on the server",
      authStopped: "Not sent — access refused",
      noEndpoint: "No endpoint",
      invalidInput: "Invalid input",
      notApplied: "Not applied",
      batchNotApplied: "The batch was not applied",
      conflict: "Conflict",
      methodCannotSend: "The connection's method cannot send this change",
      atomicPartial: "An all-or-nothing batch was applied in part",
      missingInAnswer: "The answer does not have this item",
      keyRowDiffers: "The row with the sent key has other values",
      keyNotFound:
        "No row with the sent key — the server may have made it with another key",
    },
    messages: {
      saveOff: "This collection does not save changes together",
      saving: "Saving",
      noChanges: "No changes to save",
      noConflicts: "No conflicted rows",
      noPending: "No rows waiting for a result",
      linkPick: "Choose one unlinked row and one server row",
      linked: "Rows linked — saving applies the change to that row",
    },
    counts: {
      saved: (n) => `${n} saved`,
      failed: (n) => `${n} failed`,
      conflicts: (n) => `${n} ${n === 1 ? "conflict" : "conflicts"}`,
      pending: (n) => `${n} to be checked`,
      skipped: (n) => `${n} not sent`,
    },
  },
  ko: {
    reasons: {
      noKey: "key 없음",
      noConnection: "보낼 연결 없음",
      noVersion: "기준 버전 없음 — 조회한 행에 버전 값이 없어 보내지 않음",
      processing: "처리 중",
      pending: "결과 확인 필요",
      changedFirst: "다른 사람이 먼저 바꿈",
      recheckNoConnection: "확인 조회 연결 없음",
      recheckFailed: "확인 조회 실패",
      recheckAmbiguous: "확인 조회가 그 행을 가리지 못함",
      goneOnServer: "서버에서 지워짐",
      authStopped: "인증 거절로 보내지 않음",
      noEndpoint: "endpoint 없음",
      invalidInput: "입력 값 오류",
      notApplied: "반영 안 됨",
      batchNotApplied: "묶음이 반영되지 않음",
      conflict: "충돌",
      methodCannotSend: "연결의 method 가 이 변경을 보낼 수 없음",
      atomicPartial: "원자적 묶음이 일부만 반영",
      missingInAnswer: "응답에 그 항목이 없음",
      keyRowDiffers: "보낸 key 의 행이 다른 값",
      keyNotFound:
        "보낸 key 로 찾지 못함 — 서버가 다른 key 로 만들었을 수 있음",
    },
    messages: {
      saveOff: "「모아서 저장」 이 꺼진 collection 입니다",
      saving: "저장 중입니다",
      noChanges: "저장할 변경이 없습니다",
      noConflicts: "충돌한 행이 없습니다",
      noPending: "결과를 기다리는 행이 없습니다",
      linkPick: "연결할 행 하나와 서버 행 하나를 고르세요",
      linked: "행을 연결했습니다 — 저장하면 그 행에 반영됩니다",
    },
    counts: {
      saved: (n) => `저장 ${n}건`,
      failed: (n) => `실패 ${n}건`,
      conflicts: (n) => `충돌 ${n}건`,
      pending: (n) => `결과 확인 필요 ${n}건`,
      skipped: (n) => `보내지 못함 ${n}건`,
    },
  },
};

/** (`catalogLocalized` without its React import — the session reads this.) */
const catalogLocalized = (
  strings: Readonly<Record<string, SaveWords>>,
  language: string,
): SaveWords => strings[language.split("-")[0] ?? "en"] ?? strings.en!;

const isReason = (words: SaveWords, text: string): text is SaveReasonCode =>
  Object.prototype.hasOwnProperty.call(words.reasons, text);

/** A save reason (a code, or a text shown as it came) and its detail in `language`. */
export function collectionSaveReasonText(
  reason: string,
  detail: string | undefined,
  language: string,
): string {
  const words = catalogLocalized(SAVE_TEXT, language);
  const word = (text: string) =>
    isReason(words, text) ? words.reasons[text] : text;
  return detail ? `${word(reason)} (${word(detail)})` : word(reason);
}

/** A save message (the Do's answer — a toast) in `language`. */
export function collectionSaveMessage(
  code: SaveMessageCode,
  language: string,
): string {
  return catalogLocalized(SAVE_TEXT, language).messages[code];
}

/** A save's counts as one line (`2 saved · 1 conflict`) in `language` — empty for none. */
export function collectionSaveSummary(
  counts: Readonly<Record<Counted, number>>,
  language: string,
): string {
  const words = catalogLocalized(SAVE_TEXT, language).counts;
  return (Object.keys(words) as Counted[])
    .filter((count) => counts[count])
    .map((count) => words[count](counts[count]))
    .join(" · ");
}

/** A save bar's texts (`unsaved` holds `{count}` — the bar writes the changes' count there). */
export interface CollectionSaveBarLabels {
  readonly unsaved: string;
  readonly save: string;
  readonly discard: string;
  /** 사용자 결정 4 — a conflicted row's two choices. */
  readonly keepMine: string;
  readonly takeServer: string;
  /** Decision 5 — an unlinked row put on the server row selected with it. */
  readonly link: string;
  /** 「결과 확인 필요」 — the waiting rows sent again · no longer waited for. */
  readonly resend: string;
  readonly dropPending: string;
}

const SAVE_BAR_TEXT: Readonly<Record<string, CollectionSaveBarLabels>> = {
  en: {
    unsaved: "Unsaved changes: {count}",
    save: "Save",
    discard: "Cancel",
    keepMine: "Keep mine",
    takeServer: "Take server's",
    link: "Link row",
    resend: "Send again",
    dropPending: "Stop waiting",
  },
  ko: {
    unsaved: "저장 안 된 변경 {count}건",
    save: "저장",
    discard: "취소",
    keepMine: "내 값으로 다시 저장",
    takeServer: "서버 값 받기",
    link: "이 행에 적용",
    resend: "다시 저장",
    dropPending: "대기 취소",
  },
};

/**
 * The save bar's texts in `language` — written once into the page when 「모아서 저장」 is turned on
 * (the bar is the page's own nodes: the site's language of that day, not the Builder's).
 */
export function collectionSaveBarLabels(
  language: string,
): CollectionSaveBarLabels {
  return SAVE_BAR_TEXT[language.split("-")[0] ?? "en"] ?? SAVE_BAR_TEXT.en!;
}
