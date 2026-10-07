import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  catalogBoundTextCommand,
  catalogTextCommand,
  catalogTextKey,
  catalogTextOf,
} from "../../../catalogRuntime/canvasText";
import { catalogTextBinding } from "../../../catalogRuntime/textBinding";
import type { CatalogSelectionItem } from "../../../catalogRuntime/session";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { BoundingBox } from "../selection/types";
import { subscribeCanvasFrames } from "../skia/frameScheduler";
import { viewportState } from "../viewport/viewportState";

export interface CatalogTextEditorProps {
  workspace: CatalogWorkspace;
  /** Scene box of a drawn record (the Canvas scene's bound stream). */
  boundsOf: (identity: string) => BoundingBox | undefined;
}

/**
 * ADR-248 Phase 4e-3b: inline text editing of the open project — a DOM textarea over the edited
 * record (scene box × camera, typed in scene px and scaled by the zoom) while the Canvas leaves
 * that record's text out. Escape, ⌘/Ctrl+Enter and leaving the field commit (one command when the
 * text changed); Enter is a new line.
 */
export function CatalogTextEditor({
  workspace,
  boundsOf,
}: CatalogTextEditorProps) {
  const editing = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().textEditing,
  );
  if (!editing) return null;
  return (
    <TextField
      key={editing.identity}
      workspace={workspace}
      item={editing}
      boundsOf={boundsOf}
    />
  );
}

function TextField({
  workspace,
  item,
  boundsOf,
}: CatalogTextEditorProps & { item: CatalogSelectionItem }) {
  const [start] = useState(() => {
    const record = workspace.root.domInputs.get(item.identity);
    const key = catalogTextKey(record);
    // A text the template binds to its instance's prop (a Card's title, a field's Label): the edit
    // writes that prop (ADR-254 Decision 5) — shown and typed as the prop's text.
    const binding =
      key && record
        ? catalogTextBinding(
            workspace.runtime.graph.library,
            workspace.root.domInputs,
            record,
            key,
          )
        : undefined;
    const target = binding && workspace.itemOfRecord(binding.source.id)?.target;
    return {
      record,
      key,
      bound: binding && target ? { target, prop: binding.prop } : undefined,
      // (A bound text shows the prop's value: the position draws it as resolved.)
      text: key && record ? catalogTextOf(record, key) : "",
    };
  });
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(false);
  /** The typed text — still readable when the field unmounts (the edit ended elsewhere). */
  const draft = useRef(start.text);
  const place = () => {
    const box = boundsOf(item.identity);
    return box
      ? {
          box,
          x: viewportState.x,
          y: viewportState.y,
          zoom: viewportState.zoom,
        }
      : undefined;
  };
  const [placement, setPlacement] = useState(place);
  const placeRef = useRef(place);
  placeRef.current = place;
  // The camera moves while editing (wheel pan/zoom): follow it — one subscription, and a frame
  // that moved nothing renders nothing.
  useEffect(
    () =>
      subscribeCanvasFrames(() =>
        setPlacement((current) => {
          const next = placeRef.current();
          return current &&
            next &&
            current.x === next.x &&
            current.y === next.y &&
            current.zoom === next.zoom &&
            current.box.x === next.box.x &&
            current.box.y === next.box.y &&
            current.box.width === next.box.width &&
            current.box.height === next.box.height
            ? current
            : next;
        }),
      ),
    [],
  );

  /** One command when the text changed. */
  const save = () => {
    if (committed.current) return;
    const command =
      start.key &&
      (start.bound
        ? catalogBoundTextCommand(
            workspace.runtime.graph,
            item,
            start.key,
            start.bound,
            start.text,
            draft.current,
            start.record?.visual.whiteSpace,
          )
        : catalogTextCommand(
            item,
            start.key,
            start.text,
            draft.current,
            start.record?.visual.whiteSpace,
          ));
    if (!command) return;
    committed.current = true;
    workspace.execute(command);
  };
  const commit = () => {
    try {
      save();
    } finally {
      workspace.session.endTextEdit();
    }
  };
  // The edit ended elsewhere (another selection, a reconcile): keep what was typed. The session's
  // edit is no longer this one, so it is not ended again here.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      try {
        saveRef.current();
      } catch (error) {
        // The element is gone (an undo removed it) — nothing to write to.
        console.warn("[CatalogTextEditor] text not saved:", error);
      }
    },
    [],
  );
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    field.select();
  }, []);

  if (!start.record || !start.key || !placement) return null;
  const visual = start.record.visual as Readonly<Record<string, unknown>>;
  const fontSize = Number(visual.fontSize) > 0 ? Number(visual.fontSize) : 16;
  const lineHeight =
    typeof visual.lineHeight === "number"
      ? visual.lineHeight > 4
        ? `${visual.lineHeight}px`
        : visual.lineHeight
      : typeof visual.lineHeight === "string"
        ? visual.lineHeight
        : "normal";
  const { box, x, y, zoom } = placement;
  const style: CSSProperties = {
    position: "absolute",
    left: x + box.x * zoom,
    top: y + box.y * zoom,
    width: Math.max(box.width, 24),
    minHeight: box.height,
    transform: `scale(${zoom})`,
    transformOrigin: "0 0",
    zIndex: 3,
    margin: 0,
    padding: 0,
    border: "none",
    outline: "1px solid var(--color-primary-500, #3b82f6)",
    background: "transparent",
    resize: "none",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    fontSize,
    lineHeight,
    fontWeight:
      typeof visual.fontWeight === "number" ||
      typeof visual.fontWeight === "string"
        ? visual.fontWeight
        : undefined,
    fontFamily:
      typeof visual.fontFamily === "string" ? visual.fontFamily : undefined,
    color: typeof visual.color === "string" ? visual.color : undefined,
    textAlign:
      typeof visual.textAlign === "string"
        ? (visual.textAlign as CSSProperties["textAlign"])
        : undefined,
  };
  return (
    <textarea
      ref={fieldRef}
      className="catalog-text-editor"
      data-testid="catalog-text-editor"
      defaultValue={start.text}
      style={style}
      spellCheck={false}
      onChange={(event) => {
        draft.current = event.target.value;
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" ||
          (event.key === "Enter" && (event.metaKey || event.ctrlKey))
        ) {
          event.preventDefault();
          event.stopPropagation();
          commit();
        }
      }}
    />
  );
}
