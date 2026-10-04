import test, { describe } from "node:test";
import assert from "node:assert";
import SectionSearchIndex from "./index";

describe("SectionSearchIndex emitter", () => {
  test("factory returns the stock emitter contract", () => {
    const plugin = SectionSearchIndex({ enableSiteMap: true, enableRSS: true });
    assert.strictEqual(plugin.name, "SectionSearchIndex");
    assert.strictEqual(typeof plugin.emit, "function");
    assert.strictEqual(typeof plugin.partialEmit, "function");
  });

  test("options default when omitted", () => {
    const plugin = SectionSearchIndex();
    assert.strictEqual(plugin.name, "SectionSearchIndex");
  });
});
