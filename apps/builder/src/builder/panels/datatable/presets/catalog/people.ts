/**
 * People — randomuser.me `results[]` 를 평탄화했다.
 *
 * randomuser 한 건: gender · name{title,first,last} · location{street,city,state,country,
 * postcode,coordinates{latitude,longitude},timezone} · email · login{username,password} ·
 * dob{date,age} · registered{date} · phone · cell · picture{large,medium,thumbnail} · nat.
 * 앞 컬럼 (gender · first · last) 을 뒤 컬럼이 읽어 이름 ↔ 이메일 ↔ 초상이 한 사람이다.
 */

import { definePreset, type DataTablePreset } from "../types";
import { col, idCol } from "./column";

export const profiles: DataTablePreset = definePreset({
  id: "profiles",
  name: "Profiles",
  descriptionKey: "presetMeta.profiles",
  category: "people",
  icon: "Contact",
  defaultSampleCount: 10,
  columns: [
    idCol({ kind: "uuid" }),
    col("gender", "string", "gender", { kind: "gender" }, { required: true }),
    col(
      "firstName",
      "string",
      "firstName",
      { kind: "firstName", genderKey: "gender" },
      {
        required: true,
      },
    ),
    col(
      "lastName",
      "string",
      "lastName",
      { kind: "lastName" },
      { required: true },
    ),
    col("fullName", "string", "name", {
      kind: "fullName",
      firstKey: "firstName",
      lastKey: "lastName",
    }),
    col("email", "email", "email", {
      kind: "email",
      firstKey: "firstName",
      lastKey: "lastName",
      unique: true,
    }),
    col("username", "string", "username", {
      kind: "username",
      firstKey: "firstName",
      lastKey: "lastName",
      unique: true,
    }),
    col("picture", "image", "avatar", {
      kind: "avatar",
      genderKey: "gender",
      size: "large",
    }),
    col("thumbnail", "image", "thumbnail", {
      kind: "avatar",
      genderKey: "gender",
      size: "thumbnail",
    }),
    col("birthDate", "date", "birthDate", {
      kind: "birthDate",
      minAge: 18,
      maxAge: 75,
    }),
    col("age", "number", "age", { kind: "age", birthDateKey: "birthDate" }),
    col("phone", "string", "phone", { kind: "phone" }),
    col("cell", "string", "cell", { kind: "cell" }),
    col("street", "string", "street", { kind: "streetAddress" }),
    col("city", "string", "city", { kind: "city" }),
    col("state", "string", "region", { kind: "region" }),
    col("country", "string", "country", { kind: "country" }),
    col("postcode", "string", "postcode", { kind: "postcode" }),
    col("latitude", "number", "latitude", { kind: "latitude" }),
    col("longitude", "number", "longitude", { kind: "longitude" }),
    col("timezone", "string", "timezone", { kind: "timezone" }),
    col("registeredAt", "datetime", "registeredAt", {
      kind: "pastDate",
      years: 5,
    }),
  ],
});

export const contacts: DataTablePreset = definePreset({
  id: "contacts",
  name: "Contacts",
  descriptionKey: "presetMeta.contacts",
  category: "people",
  icon: "BookUser",
  defaultSampleCount: 15,
  columns: [
    idCol(),
    col("gender", "string", "gender", { kind: "gender" }),
    col(
      "name",
      "string",
      "name",
      { kind: "fullName", genderKey: "gender" },
      {
        required: true,
      },
    ),
    col("avatar", "image", "avatar", {
      kind: "avatar",
      genderKey: "gender",
      size: "medium",
    }),
    col("company", "string", "company", { kind: "company" }, { blank: 0.2 }),
    col("jobTitle", "string", "jobTitle", { kind: "jobTitle" }, { blank: 0.2 }),
    col("email", "email", "email", { kind: "email", unique: true }),
    col("phone", "string", "phone", { kind: "cell" }),
    col("address", "string", "address", { kind: "address" }, { blank: 0.3 }),
    col("tags", "array", "tags", {
      kind: "list",
      pool: "tags",
      min: 0,
      max: 2,
    }),
    col("favorite", "boolean", "favorite", { kind: "boolean", trueRatio: 0.2 }),
    col(
      "notes",
      "string",
      "notes",
      { kind: "sentence", words: 8 },
      { blank: 0.5 },
    ),
    col(
      "lastContactedAt",
      "datetime",
      "lastContactedAt",
      { kind: "pastDate", days: 90 },
      {
        blank: 0.25,
      },
    ),
  ],
});

export const employees: DataTablePreset = definePreset({
  id: "employees",
  name: "Employees",
  descriptionKey: "presetMeta.employees",
  category: "people",
  icon: "BadgeCheck",
  defaultSampleCount: 20,
  columns: [
    idCol({ kind: "sequence", prefix: "EMP-", pad: 4 }),
    col("gender", "string", "gender", { kind: "gender" }),
    col(
      "name",
      "string",
      "name",
      { kind: "fullName", genderKey: "gender" },
      {
        required: true,
      },
    ),
    col("avatar", "image", "avatar", {
      kind: "avatar",
      genderKey: "gender",
      size: "thumbnail",
    }),
    col("email", "email", "email", {
      kind: "formula",
      compute: ({ index }) =>
        `emp${String(index + 1).padStart(4, "0")}@company.com`,
    }),
    col("department", "string", "departmentName", { kind: "department" }),
    col("jobTitle", "string", "jobTitle", { kind: "jobTitle" }),
    col("jobLevel", "string", "jobLevel", {
      kind: "weightedPool",
      name: "jobLevels",
      weights: [4, 4, 3, 1, 1],
    }),
    // 직급이 높을수록 급여 구간이 위 — jobLevel 인덱스 × 구간
    col("salary", "number", "salary", {
      kind: "formula",
      compute: ({ row, mock }) => {
        const levels = mock.helpers.poolAll("jobLevels");
        const tier = Math.max(0, levels.indexOf(String(row.jobLevel)));
        const base = 40000 + tier * 20000;
        return mock.random.int(base, base + 25000);
      },
    }),
    col("hireDate", "date", "hireDate", {
      kind: "pastDate",
      years: 10,
      withTime: false,
    }),
    col("managerId", "string", "managerId", {
      kind: "formula",
      compute: ({ index, mock }) =>
        index === 0
          ? null
          : `EMP-${String(mock.random.int(1, index)).padStart(4, "0")}`,
    }),
    col("remote", "boolean", "remote", { kind: "boolean", trueRatio: 0.35 }),
    col("status", "string", "status", {
      kind: "weighted",
      options: [
        { value: "active", weight: 8 },
        { value: "on-leave", weight: 1 },
        { value: "terminated", weight: 1 },
      ],
    }),
  ],
});

export const PEOPLE_PRESETS = { profiles, contacts, employees };
