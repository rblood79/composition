/** ADR-323 G1 — the date-axis role table (R6 — one table, three components). */
import { describe, expect, it } from "vitest";

import {
  dateAxisRoleAccepts,
  dateAxisRolesOf,
  resolveDateAxisRoles,
} from "../dateAxisRoles";

describe("date-axis roles", () => {
  it("each component's roles (breakdown §5.1)", () => {
    expect(dateAxisRolesOf("Timeline")).toEqual(["start", "title", "color"]);
    expect(dateAxisRolesOf("EventCalendar")).toEqual([
      "start",
      "end",
      "allDay",
      "title",
      "color",
      "resource",
    ]);
    expect(dateAxisRolesOf("Gantt")).toEqual([
      "start",
      "end",
      "title",
      "color",
      "progress",
      "predecessors",
    ]);
  });

  it("field types a role takes", () => {
    expect(dateAxisRoleAccepts("start", "date")).toBe(true);
    expect(dateAxisRoleAccepts("start", "string")).toBe(false);
    expect(dateAxisRoleAccepts("resource", "reference")).toBe(true);
    expect(dateAxisRoleAccepts("progress", "number")).toBe(true);
    expect(dateAxisRoleAccepts("predecessors", "array")).toBe(true);
    expect(dateAxisRoleAccepts("allDay", undefined)).toBe(false);
  });

  it("fieldMap ids → row keys, only the component's roles", () => {
    const schema = [
      { id: "f-s", key: "startsAt" },
      { id: "f-e", key: "endsAt" },
      { id: "f-p", key: "done" },
    ];
    const fieldMap = {
      start: "f-s",
      end: "f-e",
      progress: "f-p",
      title: "name",
      value: "f-s",
    };
    expect(resolveDateAxisRoles(fieldMap, schema, "EventCalendar")).toEqual({
      start: "startsAt",
      end: "endsAt",
      title: "name",
    });
    expect(resolveDateAxisRoles(fieldMap, schema, "Gantt")).toEqual({
      start: "startsAt",
      end: "endsAt",
      title: "name",
      progress: "done",
    });
    expect(
      resolveDateAxisRoles({ value: "f-s" }, schema, "Timeline"),
    ).toBeUndefined();
    expect(resolveDateAxisRoles(undefined, schema, "Timeline")).toBeUndefined();
    expect(
      resolveDateAxisRoles({ start: "" }, undefined, "Timeline"),
    ).toBeUndefined();
  });
});
