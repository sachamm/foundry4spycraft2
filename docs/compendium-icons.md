# Compendium icons

All 1,921 catalog Item entries and the four GC possession tables have explicit icon assignments in `src/data/compendium-icons.json`. Related models, Caliber variants and feat progressions share artwork. The registry contains 157 original icon subjects. Each published icon is a 128 × 128 opaque WebP, encoded at quality 82 with a maximum size of 16 KiB. The images use simple cream and brass shapes on dark teal for small-list readability.

The artwork was created with the built-in OpenAI image generator. `assets/icons/generation-prompts.json` records the prompts, hashes and final file sizes. The selected generated images were resized and compressed with Pillow's WebP encoder. The high-resolution generation outputs are not needed by Foundry and are not bundled with the module.

`tools/lib/compendium-icons.mjs` applies the source mapping before the NPC library and optional packages are assembled. Catalog items keep their IDs, rules and other data. NPC inventories inherit the new item images, while their separate portraits and circular token textures remain in place. Common Items and ammunition inventory entries receive their own suitable shared icons. The build rejects missing, duplicate, renamed or unknown assignments so newly added entries cannot silently publish with an unrelated default image.

Scene backgrounds and NPC portrait artwork are preserved. Foundry v14 Playlist and PlaylistSound documents have no image field, so the soundtrack documents are unchanged. No unsupported image properties are added to them.

Run `npm run build` after changing assignments. Fresh compendium imports include the new icons; existing world items retain their current artwork. The icon gallery under `assets/icons/catalog.html` provides a compact visual index with the entries assigned to each icon.
