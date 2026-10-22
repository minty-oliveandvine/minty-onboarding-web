// useMounted (@minty/shared/clientValue; was lib/useMounted) -- "has this component
// mounted in a browser?", for portals.

import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useMounted } from "@minty/shared/clientValue";

function Probe() {
  return <span>{useMounted() ? "client" : "server"}</span>;
}

describe("useMounted", () => {
  // Pinned before it moved to @minty/shared (the shared-code refactor, 2026-10-21):
  // false on the server snapshot, true on the client, and no re-subscription churn.

  it("is true once rendered in the browser", () => {
    const { result } = renderHook(() => useMounted());
    expect(result.current).toBe(true);
  });

  it("is false in a server render", () => {
    expect(renderToString(<Probe />)).toBe("<span>server</span>");
  });

  it("stays true across re-renders", () => {
    const { result, rerender } = renderHook(() => useMounted());
    rerender();
    rerender();
    expect(result.current).toBe(true);
  });
});
