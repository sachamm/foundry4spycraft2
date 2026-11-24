import test from "node:test";
import assert from "node:assert/strict";
import { portraitPath, canBrowseFiles } from "../module/apps/portrait-picker.mjs";

test("a picture can be a web address or a Data folder path ending in an image type", () => {
  assert.equal(portraitPath(" https://example.com/a/agent.webp "), "https://example.com/a/agent.webp");
  assert.equal(portraitPath("http://example.com/agent.PNG?size=2"), "http://example.com/agent.PNG?size=2");
  assert.equal(portraitPath("worlds/test/portraits/Mara Voss.jpg"), "worlds/test/portraits/Mara Voss.jpg");
  assert.equal(portraitPath("systems/spycraft2/assets/agent.svg"), "systems/spycraft2/assets/agent.svg");
});

test("anything that is not an image address is refused", () => {
  for (const bad of [
    "",
    "   ",
    "javascript:alert(1)//a.png",
    "data:image/png;base64,AAAA",
    "file:///C:/pics/a.png",
    "https://example.com/page.html",
    "worlds/test/notes.txt",
    "../../secret.png",
    "//evil.example/a.png",
    "worlds/a.png\nother"
  ])
    assert.equal(portraitPath(bad), null, bad);
});

test("only users with Foundry's file browser permission get the file picker", () => {
  assert.equal(canBrowseFiles({ can: key => key === "FILES_BROWSE" }), true);
  assert.equal(canBrowseFiles({ can: () => false }), false);
  assert.equal(canBrowseFiles(null), false);
});
