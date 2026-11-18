import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { setupSoundtrack } from "../module/soundtrack.mjs";

test("soundtrack has eleven ordered, portable OGG assets and sequential playback", () => {
  const pack = buildPacks().packs.soundtrack;
  assert.equal(pack.type, "Playlist");
  const album = pack.docs[0];
  assert.equal(album.mode, 0);
  assert.equal(album.sorting, "m");
  const sounds = album.embedded.sounds;
  assert.equal(sounds.length, 11);
  assert.match(sounds[0].name, /Where the Trains Run Under$/);
  assert.match(sounds.at(-1).name, /Run It Quiet$/);
  assert.equal(new Set(sounds.map(s => s._id)).size, 11);
  for (const sound of sounds) {
    assert.equal(sound.playing, false);
    assert.equal(sound.repeat, false);
    const bytes = readFileSync(new URL(`../${sound.path.replace("systems/spycraft2/", "")}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "OggS");
    assert.ok(bytes.includes(Buffer.from("vorbis")));
  }
});

test("soundtrack setup imports once and recovers when creation succeeded before the setting saved", async () => {
  let done = false;
  const playlists = [];
  let created = 0;
  const album = {
    getFlag: () => "where-the-trains-run-under",
    sounds: { size: 11 },
    toObject: () => ({ _id: "source", name: "Album", sounds: [], playing: false })
  };
  globalThis.game = {
    user: { isGM: true, id: "gm" },
    users: { activeGM: { id: "gm" } },
    playlists,
    settings: {
      get: () => done,
      set: async (_system, _key, value) => {
        done = value;
      }
    },
    packs: new Map([["spycraft2.soundtrack", { getDocuments: async () => [album] }]])
  };
  globalThis.Playlist = {
    create: async data => {
      assert.equal(data._id, undefined);
      created++;
      playlists.push(album);
    }
  };
  try {
    await setupSoundtrack();
    await setupSoundtrack();
    assert.equal(created, 1);
    done = false;
    await setupSoundtrack();
    assert.equal(created, 1);
    assert.equal(done, true);
  } finally {
    delete globalThis.game;
    delete globalThis.Playlist;
  }
});

test("existing albums update only bundled WAV paths even after initial setup", async () => {
  const updates = [];
  globalThis.game = {
    user: { isGM: true, id: "gm" },
    users: { activeGM: { id: "gm" } },
    settings: { get: () => true },
    playlists: [
      {
        getFlag: () => "where-the-trains-run-under",
        sounds: {
          contents: [
            { id: "bundled", path: "systems/spycraft2/assets/audio/where-the-trains-run-under/01-title.wav" },
            { id: "custom", path: "worlds/custom/title.wav" }
          ]
        },
        updateEmbeddedDocuments: async (type, data) => {
          assert.equal(type, "PlaylistSound");
          updates.push(...data);
        }
      }
    ]
  };
  try {
    await setupSoundtrack();
    assert.deepEqual(updates, [
      { _id: "bundled", path: "systems/spycraft2/assets/audio/where-the-trains-run-under/01-title.ogg" }
    ]);
  } finally {
    delete globalThis.game;
  }
});
