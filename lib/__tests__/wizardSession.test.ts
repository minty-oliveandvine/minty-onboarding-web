import { afterEach, describe, expect, it } from "vitest";

import {
  TAB_ENTITY_KEY,
  TAB_TOKEN_KEY,
  clearTabEntity,
  tabResume,
  writeTabEntity,
  writeTabToken,
} from "../wizardSession";

// A JWT whose payload is all that's read here (no signature check client-side).
const jwt = (exp: number) => `h.${btoa(JSON.stringify({ user_id: "u1", exp }))}.s`;
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

afterEach(() => window.sessionStorage.clear());

describe("tabResume - what a plain reload resumes from (2026-10-27)", () => {
  it("resumes the company this tab was onboarding, with its token", () => {
    const token = jwt(inAnHour());
    writeTabToken(token);
    writeTabEntity("entity-1");
    expect(tabResume()).toEqual({ entityId: "entity-1", token });
  });

  it("has nothing to resume before a company exists", () => {
    writeTabToken(jwt(inAnHour()));
    expect(tabResume()).toBeNull();
  });

  it("has nothing to resume without a token", () => {
    writeTabEntity("entity-1");
    expect(tabResume()).toBeNull();
  });

  it("does not resume on an expired token", () => {
    writeTabToken(jwt(Math.floor(Date.now() / 1000) - 10));
    writeTabEntity("entity-1");
    expect(tabResume()).toBeNull();
  });

  it("forgets the company when told to (a fresh '+' launch)", () => {
    writeTabToken(jwt(inAnHour()));
    writeTabEntity("entity-1");
    clearTabEntity();
    expect(window.sessionStorage.getItem(TAB_ENTITY_KEY)).toBeNull();
    expect(tabResume()).toBeNull();
    expect(window.sessionStorage.getItem(TAB_TOKEN_KEY)).not.toBeNull();
  });

  it("ignores an empty id rather than clearing the stored one", () => {
    writeTabEntity("entity-1");
    writeTabEntity("");
    expect(window.sessionStorage.getItem(TAB_ENTITY_KEY)).toBe("entity-1");
  });
});
