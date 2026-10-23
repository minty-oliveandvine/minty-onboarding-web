// lib/invites -- the API invitation shape to the wizard's own.
//
// Regression test for a real defect: the cold resume wrote API rows (`first_name`) into
// state unconverted, and the invite cards read `first`, so every resumed invitee showed
// an email and no name.

import { describe, expect, it } from "vitest";
import type { Invitation } from "../api";
import { inviteExpiryLabel, inviteRow, inviteRows } from "../invites";

const api = (over: Partial<Invitation> = {}): Invitation => ({
  id: "inv-1",
  email: "ada@example.com",
  role: "admin",
  status: "pending",
  first_name: "Ada",
  last_name: "Lovelace",
  created_at: "2026-09-14T09:00:00Z",
  ...over,
});

describe("inviteRow", () => {
  it("maps first_name/last_name to first/last -- the defect", () => {
    expect(inviteRow(api())).toEqual({
      id: "inv-1",
      email: "ada@example.com",
      role: "admin",
      first: "Ada",
      last: "Lovelace",
      // when the link lapses (step 3's "Expires in N days"); none on this row
      expiresAt: null,
      expired: false,
    });
  });

  it("drops the fields the wizard does not hold", () => {
    const row = inviteRow(api());
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("created_at");
    expect(row).not.toHaveProperty("first_name");
  });

  it("prefers the API name over a name typed this session", () => {
    // The API's is what was actually sent.
    expect(inviteRow(api(), { first: "Typed", last: "Name" })).toMatchObject({
      first: "Ada",
      last: "Lovelace",
    });
  });

  it("falls back to the session name when the API has none", () => {
    expect(
      inviteRow(api({ first_name: "", last_name: "" }), { first: "Typed", last: "Name" }),
    ).toMatchObject({
      first: "Typed",
      last: "Name",
    });
  });

  it("gives empty strings, never undefined, when neither has a name", () => {
    expect(inviteRow(api({ first_name: "", last_name: "" }))).toMatchObject({
      first: "",
      last: "",
    });
  });
});

describe("inviteRows", () => {
  it("matches prior rows by email, case-insensitively", () => {
    const prior = [{ email: "ADA@example.com", role: "admin", first: "Typed", last: "Name" }];
    const [row] = inviteRows([api({ first_name: "", last_name: "" })], prior);
    expect(row).toMatchObject({ first: "Typed", last: "Name" });
  });

  it("works with no prior rows at all -- the cold-resume case", () => {
    expect(inviteRows([api()])).toHaveLength(1);
    expect(inviteRows([api()])[0].first).toBe("Ada");
  });

  it("keeps the API order", () => {
    const rows = inviteRows([api({ id: "b", email: "b@x.co" }), api({ id: "a", email: "a@x.co" })]);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("does not carry a prior row that the API no longer lists", () => {
    const prior = [{ email: "gone@x.co", role: "admin", first: "G", last: "One" }];
    expect(inviteRows([api()], prior).map((r) => r.email)).toEqual(["ada@example.com"]);
  });
});

describe("inviteExpiryLabel", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

  it("says how many days are left", () => {
    // rounded up: a 7-day invitation sent a moment ago still says 7
    expect(inviteExpiryLabel({ expiresAt: at(6.99) }, now)).toBe("Expires in 7 days");
    expect(inviteExpiryLabel({ expiresAt: at(1.2) }, now)).toBe("Expires in 2 days");
    expect(inviteExpiryLabel({ expiresAt: at(0.3) }, now)).toBe("Expires within a day");
  });

  it("says Expired once the date has passed, or the API says so", () => {
    expect(inviteExpiryLabel({ expiresAt: at(-1) }, now)).toBe("Expired");
    expect(inviteExpiryLabel({ expiresAt: at(3), expired: true }, now)).toBe("Expired");
  });

  it("says nothing for an invitation that never expires", () => {
    expect(inviteExpiryLabel({ expiresAt: null }, now)).toBe("");
  });
});
