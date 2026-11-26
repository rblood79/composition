/**
 * ADR-324 Decision 1 · 4 · 7 — the collection settings' 「저장」 section (the Data panel's table
 * settings): 「모아서 저장」 on · off, the write connection (rows — update · create · remove endpoints,
 * or one batch endpoint), the conflict detection, the create's idempotency key — and the line that
 * says the guarantee the declared connection gives. A collection whose rules save its edits at once
 * cannot turn it on: their places show, and 「규칙을 지우고 켜기」 is one command (one undo).
 */
import { useCallback, useMemo } from "react";
import { Button } from "react-aria-components/Button";
import { Text } from "react-aria-components/Text";
import { Section } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { runCatalogCommand } from "../../../catalogRuntime/commandRunner";
import {
  useCatalogStepReading,
  useOptionalCatalogWorkspace,
} from "../../../catalogRuntime/react.runtime";
import { catalogCollectionSaveCommand } from "../../../catalogRuntime/collectionSaveCommand";
import {
  catalogImmediateSaveRules,
  catalogSaveMethodAllowed,
  type CatalogSaveConnectionKind,
} from "../../../../../../../packages/shared/src/catalog/document/collectionSave";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import type {
  CollectionSaveSettings,
  DataCollectionId,
  DataEndpointId,
  ProjectEntry,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import type {
  ApiEndpoint,
  DataTable,
} from "../../../../types/builder/data.types";
import { translateKey, useOptionalI18n } from "../../../../i18n";

const endpointId = (raw: string) => `data:endpoint:${raw}` as DataEndpointId;
const rawId = (id: string) => id.slice(id.indexOf(":", 5) + 1);

/** The first connection a new 「모아서 저장」 gets: the endpoints by method (rows). */
export function defaultSaveSettings(
  endpoints: readonly ApiEndpoint[],
): CollectionSaveSettings | undefined {
  const by = (methods: readonly string[]) =>
    endpoints.find((endpoint) => methods.includes(endpoint.method));
  const update = by(["PATCH", "PUT"]);
  const create = by(["POST"]);
  const remove = by(["DELETE"]);
  if (!update && !create && !remove) return undefined;
  return {
    send: {
      shape: "rows",
      ...(update
        ? {
            update: {
              endpointId: endpointId(update.id),
              body: "changed" as const,
            },
          }
        : {}),
      ...(create ? { create: { endpointId: endpointId(create.id) } } : {}),
      ...(remove ? { remove: { endpointId: endpointId(remove.id) } } : {}),
    },
  };
}

export function CollectionSaveSection({
  table,
  endpoints,
}: {
  table: DataTable;
  endpoints: readonly ApiEndpoint[];
}) {
  const workspace = useOptionalCatalogWorkspace();
  if (!workspace) return null;
  return (
    <SaveSection table={table} endpoints={endpoints} workspace={workspace} />
  );
}

function SaveSection({
  table,
  endpoints,
  workspace,
}: {
  table: DataTable;
  endpoints: readonly ApiEndpoint[];
  workspace: NonNullable<ReturnType<typeof useOptionalCatalogWorkspace>>;
}) {
  const i18n = useOptionalI18n();
  const t = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.batchSave.${key}`, fallback) : fallback;
  const collectionId = `data:collection:${table.id}` as DataCollectionId;
  const save = table.save;
  // (The rules that save this collection's edits at once — read over each step.)
  const rules = useCatalogStepReading(workspace, () => {
    const graph = workspace.runtime.graph;
    const project = graph.getEntry(graph.projectId) as ProjectEntry | undefined;
    return catalogImmediateSaveRules(collectionId, {
      get: (id) => graph.getEntry(id),
      interactionIds: project?.interactionIds ?? [],
      parentOf: (id) => {
        const owner = graph.ownerOf(id);
        return owner && graph.getEntry(owner)?.kind === "node"
          ? owner
          : undefined;
      },
    }).map((rule) => {
      const owner = graph.getEntry(rule.ownerId);
      let label = rule.ownerId as string;
      if (owner?.kind === "node")
        try {
          label = owner.name ?? definitionTypeName(graph, owner.definitionId);
        } catch {
          label = owner.name ?? label;
        }
      return { id: rule.id, label: `${label} · ${rule.trigger}` };
    });
  });

  const write = useCallback(
    (
      next: CollectionSaveSettings | undefined,
      extra?: { removeRules?: boolean; bars?: boolean },
    ) => {
      const graph = workspace.runtime.graph;
      runCatalogCommand(
        workspace,
        catalogCollectionSaveCommand(
          graph,
          {
            collectionId,
            save: next,
            ...(extra?.removeRules
              ? { removeRuleIds: rules.map((rule) => rule.id) }
              : {}),
            ...(extra?.bars
              ? {
                  saveBars: {
                    unsaved: t("barUnsaved", "Unsaved changes: {count}"),
                    save: t("barSave", "Save"),
                    discard: t("barDiscard", "Cancel"),
                    keepMine: t("barKeepMine", "Keep mine"),
                    takeServer: t("barTakeServer", "Take server's"),
                    link: t("barLink", "Link row"),
                    resend: t("barResend", "Send again"),
                    dropPending: t("barDropPending", "Stop waiting"),
                  },
                }
              : {}),
          },
          workspace.newId,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace, collectionId, rules],
  );

  // (Each connection takes the endpoints of its own methods only — an update never a DELETE.)
  const endpointsFor = (kind: CatalogSaveConnectionKind) =>
    endpoints.filter((endpoint) =>
      catalogSaveMethodAllowed(kind, endpoint.method),
    );
  const readEndpoints = useMemo(
    () => endpoints.filter((endpoint) => endpoint.method === "GET"),
    [endpoints],
  );
  const first = useMemo(() => defaultSaveSettings(endpoints), [endpoints]);
  const none = { value: "", label: t("none", "None") };
  const optionsFor = (kind: CatalogSaveConnectionKind) =>
    endpointsFor(kind).map((endpoint) => ({
      value: endpoint.id,
      label: `${endpoint.name} (${endpoint.method})`,
    }));
  const fields = (table.schema ?? []).filter(
    (field) => field.id && !field.formula,
  );

  const guarantee = (settings: CollectionSaveSettings): string => {
    const parts: string[] = [];
    parts.push(
      settings.send.shape === "batch"
        ? settings.send.atomic
          ? t("guaranteeAtomic", "All or nothing is saved.")
          : t("guaranteeBatch", "Each item may be saved or not.")
        : t("guaranteeRows", "Each row may be saved or not."),
    );
    const full =
      settings.send.shape === "rows" && settings.send.update?.body === "full";
    parts.push(
      settings.conflict?.by === "version"
        ? t(
            "guaranteeVersion",
            "A row someone else changed first is refused by the server.",
          )
        : settings.conflict?.by === "recheck"
          ? t(
              "guaranteeRecheck",
              "Rows are read just before sending — a change in between is not caught.",
            )
          : full
            ? t(
                "guaranteeNoneFull",
                "No conflict detection — the last write wins, and other cells can be overwritten.",
              )
            : t(
                "guaranteeNone",
                "No conflict detection — the last write wins.",
              ),
    );
    parts.push(
      t("guaranteeDeclared", "This is the level the connection declares."),
    );
    return parts.join(" ");
  };

  if (!save) {
    const blocked = rules.length > 0;
    return (
      <Section
        id="datatable-table-save"
        title={t("title", "Save")}
        collapsible={false}
        className="datatable-settings-section"
      >
        <div className="fieldset-row" data-wide>
          <PropertySwitch
            label={t("batch", "Save changes together")}
            isSelected={false}
            onChange={(on) => {
              if (on && first && !blocked) write(first, { bars: true });
            }}
          />
        </div>
        {!first && (
          <Text className="datatable-save-note">
            {t(
              "noWriteEndpoint",
              "Add a POST · PATCH · PUT · DELETE endpoint to save to.",
            )}
          </Text>
        )}
        {blocked && first && (
          <div className="datatable-save-rules">
            <Text className="datatable-save-note">
              {t(
                "rulesBlock",
                "These rules save each edit at once — they cannot run beside it:",
              )}
            </Text>
            <ul className="datatable-save-rule-list">
              {rules.map((rule) => (
                <li key={rule.id}>{rule.label}</li>
              ))}
            </ul>
            <Button
              className="control-button"
              data-variant="primary"
              onPress={() => write(first, { removeRules: true, bars: true })}
            >
              {t("removeRulesAndTurnOn", "Remove the rules and turn on")}
            </Button>
          </div>
        )}
      </Section>
    );
  }

  const send = save.send;
  const setSend = (next: CollectionSaveSettings["send"]) => {
    // (A batch carries no `If-Match` — the version goes in each item's body.)
    const conflict =
      next.shape === "batch" &&
      save.conflict?.by === "version" &&
      save.conflict.send === "ifMatch"
        ? { ...save.conflict, send: "body" as const }
        : save.conflict;
    write({ ...save, send: next, ...(conflict ? { conflict } : {}) });
  };
  const rowConnection = (kind: "update" | "create" | "remove", raw: string) => {
    if (send.shape !== "rows") return;
    const { [kind]: _old, ...rest } = send;
    setSend({
      ...rest,
      ...(raw
        ? {
            [kind]:
              kind === "update"
                ? {
                    endpointId: endpointId(raw),
                    body: send.update?.body ?? "changed",
                  }
                : { endpointId: endpointId(raw) },
          }
        : {}),
    } as CollectionSaveSettings["send"]);
  };
  const conflictMode = save.conflict?.by ?? "none";
  const setConflict = (mode: string) => {
    const { conflict: _old, ...rest } = save;
    if (mode === "version") {
      const field =
        fields.find((item) => /version|etag|rev/i.test(item.key)) ?? fields[0];
      if (!field?.id) return;
      write({
        ...rest,
        conflict: {
          by: "version",
          fieldId: field.id,
          send: send.shape === "batch" ? "body" : "ifMatch",
        },
      });
    } else if (mode === "recheck") {
      const read = readEndpoints[0];
      if (!read) return;
      write({
        ...rest,
        conflict: { by: "recheck", endpointId: endpointId(read.id) },
      });
    } else write(rest as CollectionSaveSettings);
  };

  return (
    <Section
      id="datatable-table-save"
      title={t("title", "Save")}
      collapsible={false}
      className="datatable-settings-section"
    >
      <div className="fieldset-row" data-wide>
        <PropertySwitch
          label={t("batch", "Save changes together")}
          isSelected
          onChange={(on) => {
            if (!on) write(undefined);
          }}
        />
      </div>
      <div className="fieldset-row" data-wide>
        <PropertySelect
          label={t("shape", "Send as")}
          value={send.shape}
          optionValueMode="literal"
          options={[
            { value: "rows", label: t("shapeRows", "Each row (REST)") },
            { value: "batch", label: t("shapeBatch", "All in one request") },
          ]}
          onChange={(shape) => {
            if (shape === send.shape) return;
            if (shape === "batch") {
              const target = endpointsFor("batch")[0];
              if (target)
                setSend({
                  shape: "batch",
                  endpointId: endpointId(target.id),
                  atomic: true,
                });
            } else {
              const rows = first?.send;
              if (rows) setSend(rows);
            }
          }}
          afterControl={<Text slot="description">{guarantee(save)}</Text>}
        />
      </div>
      {send.shape === "rows" ? (
        <>
          <div
            className="fieldset-row"
            data-wide={send.update ? undefined : true}
          >
            <PropertySelect
              label={t("update", "Update")}
              value={send.update ? rawId(send.update.endpointId) : ""}
              optionValueMode="literal"
              options={[none, ...optionsFor("update")]}
              onChange={(value) => rowConnection("update", value)}
            />
            {send.update && (
              <PropertySelect
                label={t("updateBody", "Body")}
                value={send.update.body}
                optionValueMode="literal"
                options={[
                  {
                    value: "changed",
                    label: t("bodyChanged", "Changed fields"),
                  },
                  { value: "full", label: t("bodyFull", "Whole row") },
                ]}
                onChange={(body) =>
                  setSend({
                    ...send,
                    update: {
                      endpointId: send.update!.endpointId,
                      body: body as "changed" | "full",
                    },
                  })
                }
              />
            )}
          </div>
          <div className="fieldset-row">
            <PropertySelect
              label={t("create", "Add")}
              value={send.create ? rawId(send.create.endpointId) : ""}
              optionValueMode="literal"
              options={[none, ...optionsFor("create")]}
              onChange={(value) => rowConnection("create", value)}
            />
            <PropertySelect
              label={t("remove", "Delete")}
              value={send.remove ? rawId(send.remove.endpointId) : ""}
              optionValueMode="literal"
              options={[none, ...optionsFor("remove")]}
              onChange={(value) => rowConnection("remove", value)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="fieldset-row" data-wide>
            <PropertySelect
              label={t("batchEndpoint", "Batch endpoint")}
              value={rawId(send.endpointId)}
              optionValueMode="literal"
              options={optionsFor("batch")}
              onChange={(value) =>
                value && setSend({ ...send, endpointId: endpointId(value) })
              }
            />
          </div>
          <div className="fieldset-row">
            <PropertySwitch
              label={t("atomic", "All or nothing")}
              isSelected={send.atomic}
              onChange={(atomic) => setSend({ ...send, atomic })}
            />
            <PropertySwitch
              label={t("gzip", "Compress large saves")}
              isSelected={!!send.gzip}
              onChange={(gzip) => {
                const { gzip: _old, ...rest } = send;
                setSend(gzip ? { ...rest, gzip: true } : rest);
              }}
            />
          </div>
        </>
      )}
      <div
        className="fieldset-row"
        data-wide={conflictMode === "none" ? true : undefined}
      >
        <PropertySelect
          label={t("conflict", "Conflict detection")}
          value={conflictMode}
          optionValueMode="literal"
          options={[
            { value: "none", label: t("conflictNone", "None") },
            { value: "version", label: t("conflictVersion", "Version field") },
            {
              value: "recheck",
              label: t("conflictRecheck", "Read before saving"),
            },
          ]}
          disabledKeys={[
            ...(fields.length ? [] : ["version"]),
            ...(readEndpoints.length ? [] : ["recheck"]),
          ]}
          onChange={setConflict}
        />
        {save.conflict?.by === "version" && (
          <PropertySelect
            label={t("versionField", "Field")}
            value={save.conflict.fieldId}
            optionValueMode="literal"
            translateOptions={false}
            options={fields.map((field) => ({
              value: field.id!,
              label: field.key,
            }))}
            onChange={(fieldId) =>
              write({
                ...save,
                conflict: {
                  ...(save.conflict as {
                    by: "version";
                    fieldId: string;
                    send: "body" | "ifMatch";
                  }),
                  fieldId,
                },
              })
            }
          />
        )}
        {save.conflict?.by === "recheck" && (
          <PropertySelect
            label={t("recheckEndpoint", "Read by key")}
            value={rawId(save.conflict.endpointId)}
            optionValueMode="literal"
            options={readEndpoints.map((endpoint) => ({
              value: endpoint.id,
              label: endpoint.name,
            }))}
            onChange={(value) =>
              write({
                ...save,
                conflict: { by: "recheck", endpointId: endpointId(value) },
              })
            }
          />
        )}
      </div>
      {save.conflict?.by === "version" && send.shape === "rows" && (
        <div className="fieldset-row" data-wide>
          <PropertySelect
            label={t("versionSend", "Version goes in")}
            value={save.conflict.send}
            optionValueMode="literal"
            options={[
              { value: "ifMatch", label: "If-Match" },
              { value: "body", label: t("versionBody", "Body field") },
            ]}
            onChange={(where) =>
              write({
                ...save,
                conflict: {
                  ...(save.conflict as {
                    by: "version";
                    fieldId: string;
                    send: "body" | "ifMatch";
                  }),
                  send: where as "body" | "ifMatch",
                },
              })
            }
          />
        </div>
      )}
      <div className="fieldset-row" data-wide>
        <PropertyInput
          label={t("idempotency", "Idempotency key header")}
          value={save.idempotency?.in === "header" ? save.idempotency.name : ""}
          placeholder="Idempotency-Key"
          onChange={(next) => {
            const name = next.trim();
            const { idempotency: _old, ...rest } = save;
            write(
              name
                ? { ...rest, idempotency: { in: "header", name } }
                : (rest as CollectionSaveSettings),
            );
          }}
        />
      </div>
    </Section>
  );
}

