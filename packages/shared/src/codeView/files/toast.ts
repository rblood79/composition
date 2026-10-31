/**
 * `src/Toast.tsx` — the app's toast queue and region as the RAC reference writes them
 * (`react-aria-components` Toast docs, `Toast.tsx`: one global `queue`, `MyToastRegion` at the app's
 * root rendering each queued toast). User 2026-11-01: Toast is the app's one toast shape, not a page
 * element — a `toast` Do is `queue.add({title, …})` (data only); the shape is RAC's `<Toast>` with
 * the S2 look, or the project component the Site panel chose (`ProjectEntry.toastShapeId` —
 * `<Shape toast={toast} />`, the component's own file under `src/components/`).
 */
import type {
  CatalogReader,
  DefinitionEntry,
  ProjectEntry,
} from "../../catalog/document/types";
import { CATALOG_TOAST_VARIANTS } from "../../catalog/document/types";
import type { CodeViewResult } from "../types";
import { CodeWriter } from "../writer";
import { pascal } from "./names";

type Reader = Pick<CatalogReader, "projectId" | "getEntry">;

/** The code name of the shape component (its file `src/components/<Name>.tsx`); none = RAC's Toast. */
export function codeViewToastShape(
  reader: Reader,
): { id: string; name: string } | undefined {
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  if (!project.toastShapeId) return undefined;
  const definition = reader.getEntry(project.toastShapeId) as
    DefinitionEntry | undefined;
  if (definition?.kind !== "definition") return undefined;
  return { id: definition.id, name: pascal(definition.name, "ToastShape") };
}

/** The queue's content type: S2's toast options (one queue per app — every Do's options fit it). */
export const CODE_VIEW_TOAST_CONTENT_TYPE = `{title: string; variant?: ${CATALOG_TOAST_VARIANTS.map(
  (variant) => `'${variant}'`,
).join(
  " | ",
)}; actionLabel?: string; onAction?: () => void; shouldCloseOnAction?: boolean}`;

export function generateToastFile(input: { reader: Reader }): CodeViewResult {
  const shape = codeViewToastShape(input.reader);
  const out = new CodeWriter();
  out.anchorLine(
    "import {UNSTABLE_Toast as Toast, UNSTABLE_ToastContent as ToastContent, UNSTABLE_ToastQueue as ToastQueue, UNSTABLE_ToastRegion as ToastRegion, Button, Text} from 'react-aria-components';",
    { kind: "derived", key: "import:react-aria-components" },
  );
  if (shape)
    out.anchorLine(`import ${shape.name} from './components/${shape.name}';`, {
      kind: "derived",
      key: `import:shape:${shape.id}`,
    });
  out.line();
  out.anchorLine(
    `export const queue = new ToastQueue<${CODE_VIEW_TOAST_CONTENT_TYPE}>();`,
    { kind: "derived", key: "queue" },
  );
  out.line();
  out.line(
    "export function MyToastRegion({placement}: {placement?: 'top' | 'top end' | 'bottom' | 'bottom end'}) {",
  );
  out.in().line("return (").in();
  out.line("<ToastRegion queue={queue} data-placement={placement}>").in();
  out.start();
  const from = out.length;
  if (shape) out.write(`{({toast}) => <${shape.name} toast={toast} />}`);
  else out.write("{({toast}) => (");
  out.anchor(from, { kind: "derived", key: "shape" }).end();
  if (!shape) {
    out.in();
    out.line(
      "<Toast toast={toast} data-variant={toast.content.variant ?? 'info'}>",
    );
    out.in();
    out.line("<ToastContent>").in();
    out.line('<Text slot="title">{toast.content.title}</Text>');
    out.out().line("</ToastContent>");
    out.line("{toast.content.actionLabel && (").in();
    out.line(
      "<Button onPress={() => { toast.content.onAction?.(); if (toast.content.shouldCloseOnAction) queue.close(toast.key); }}>{toast.content.actionLabel}</Button>",
    );
    out.out().line(")}");
    out.line('<Button slot="close" aria-label="Close">✕</Button>');
    out.out().line("</Toast>");
    out.out().line(")}");
  }
  out.out().line("</ToastRegion>");
  out.out().line(");").out().line("}");
  return {
    ...out.done(),
    symbols: {
      variables: {},
      fields: {},
      ...(shape ? { components: { [shape.name]: shape.id } } : {}),
    },
  };
}
