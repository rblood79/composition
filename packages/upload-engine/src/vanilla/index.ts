/**
 * `@composition/upload/vanilla` — 최소 DOM 바인딩 (JSP `<script>` 1줄, IIFE global `CompositionUpload`).
 * 파일명은 `textContent` 로만 쓴다 (§3-6 — innerHTML 0).
 */
import { createUploadQueue } from "../core/queue";
import type {
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "../types";

export { createUploadQueue } from "../core/queue";
export type {
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "../types";

export interface VanillaOptions extends UploadQueueOptions {
  /** 기존 `<input type=file>` 을 쓴다. 없으면 el 안에 만든다 */
  input?: HTMLInputElement;
  /** 폴더 선택 (`webkitdirectory`) */
  directory?: boolean;
  multiple?: boolean;
  /** 상태 문구 (i18n) */
  labels?: Partial<
    Record<
      UploadItemState["status"] | "pause" | "resume" | "cancel" | "retry",
      string
    >
  >;
}

const DEFAULT_LABELS: Record<string, string> = {
  queued: "대기",
  creating: "준비 중",
  uploading: "전송 중",
  paused: "일시정지",
  done: "완료",
  error: "오류",
  pause: "일시정지",
  resume: "재개",
  cancel: "취소",
  retry: "다시 시도",
};

const fmt = (n: number): string =>
  n >= 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(2)} GB`
    : n >= 1024 ** 2
      ? `${(n / 1024 ** 2).toFixed(1)} MB`
      : `${Math.ceil(n / 1024)} KB`;

export function create(el: HTMLElement, options: VanillaOptions): UploadQueue {
  const {
    input: givenInput,
    directory,
    multiple,
    labels: givenLabels,
    ...queueOptions
  } = options;
  const labels = { ...DEFAULT_LABELS, ...givenLabels };
  const queue = createUploadQueue(queueOptions);
  const doc = el.ownerDocument;

  const input = givenInput ?? doc.createElement("input");
  if (!givenInput) {
    input.type = "file";
    input.multiple = multiple !== false;
    if (directory) input.setAttribute("webkitdirectory", "");
    el.appendChild(input);
  }
  const list = doc.createElement("ul");
  list.className = "composition-upload-list";
  el.appendChild(list);

  input.addEventListener("change", () => {
    if (input.files?.length) queue.add(Array.from(input.files));
    input.value = "";
  });

  const rows = new Map<
    string,
    {
      li: HTMLLIElement;
      name: HTMLSpanElement;
      bar: HTMLProgressElement;
      status: HTMLSpanElement;
      btn: HTMLButtonElement;
      cancel: HTMLButtonElement;
    }
  >();

  const render = (items: UploadItemState[]) => {
    const seen = new Set<string>();
    for (const it of items) {
      seen.add(it.id);
      let row = rows.get(it.id);
      if (!row) {
        const li = doc.createElement("li");
        li.className = "composition-upload-item";
        const name = doc.createElement("span");
        name.className = "composition-upload-name";
        const bar = doc.createElement("progress");
        bar.max = 1000;
        const status = doc.createElement("span");
        status.className = "composition-upload-status";
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.addEventListener("click", () => {
          const cur = queue.getItems().find((x) => x.id === it.id);
          if (!cur) return;
          if (cur.status === "uploading" || cur.status === "creating")
            queue.pause(it.id);
          else if (cur.status === "paused") queue.resume(it.id);
          else if (cur.status === "error" || cur.status === "queued")
            queue.start(it.id);
        });
        const cancel = doc.createElement("button");
        cancel.type = "button";
        cancel.textContent = labels.cancel ?? "";
        cancel.addEventListener("click", () => queue.remove(it.id));
        li.append(name, bar, status, btn, cancel);
        list.appendChild(li);
        row = { li, name, bar, status, btn, cancel };
        rows.set(it.id, row);
      }
      row.name.textContent = it.relativePath ?? it.name;
      row.bar.value = it.size ? Math.round((it.offset / it.size) * 1000) : 1000;
      row.status.textContent =
        it.status === "error" && it.lastError
          ? `${labels.error}: ${it.lastError.code}`
          : `${labels[it.status]} ${fmt(it.offset)} / ${fmt(it.size)}`;
      row.li.dataset.status = it.status;
      row.btn.textContent =
        (it.status === "paused"
          ? labels.resume
          : it.status === "error" || it.status === "queued"
            ? labels.retry
            : labels.pause) ?? "";
      row.btn.hidden = it.status === "done";
    }
    for (const [id, row] of rows) {
      if (!seen.has(id)) {
        row.li.remove();
        rows.delete(id);
      }
    }
  };
  queue.subscribe(render);
  render(queue.getItems());
  return queue;
}
