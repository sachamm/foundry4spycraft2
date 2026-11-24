/**
 * Changing the picture on a sheet.
 *
 * Foundry's file browser needs the "Use File Browser" permission, which the Player role lacks by default; without it a
 * click on the picture did nothing at all. Users who can browse get Foundry's picker as before. Everyone else who may
 * edit the sheet gets a small dialog that takes a web address or a path in the Data folder.
 */
import { loc } from "../i18n.mjs";
import { refuse } from "../error-notices.mjs";
import { systemDialog } from "./dialog-theme.mjs";

const IMAGE_EXTENSIONS = ["apng", "avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"];

/**
 * A usable picture path from what the user typed, or null: a web address (http or https) or a relative path in the
 * Data folder, ending in an image file type. Query strings and fragments are allowed after the file name.
 */
export function portraitPath(text) {
  const value = String(text ?? "").trim();
  if (!value || /[\t\n\r]/.test(value)) return null;
  let path = value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    path = url.pathname;
  } else if (value.startsWith("//") || value.includes("..")) return null;
  const extension = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.includes(extension) ? value : null;
}

/** Whether this user can open Foundry's file browser. */
export const canBrowseFiles = (user = globalThis.game?.user) => user?.can?.("FILES_BROWSE") === true;

/**
 * The sheets' `editImage` action. `this` is the sheet; `target` is the clicked `<img data-edit>`.
 */
export async function editPortrait(event, target) {
  const foundryEditImage = foundry.applications.api.DocumentSheetV2.DEFAULT_OPTIONS.actions.editImage;
  if (canBrowseFiles()) return foundryEditImage.call(this, event, target);
  if (!this.isEditable) return;
  const attr = target.dataset.edit || "img";
  const document = this.document;
  const current = foundry.utils.getProperty(document._source, attr) ?? "";
  const esc = foundry.utils.escapeHTML;
  const input = await systemDialog.input({
    window: { title: loc`Change picture: ${document.name}` },
    position: { width: 560 },
    rejectClose: false,
    content: `<div class="sc2-portrait-picker">
        <img class="sc2-portrait-preview" src="${esc(current)}" alt="${esc(loc`Preview`)}" />
        <div class="form-group stacked">
          <label for="sc2-portrait-path">${loc`Picture address or path`}</label>
          <input type="text" id="sc2-portrait-path" name="path" value="${esc(current)}"
            placeholder="https://example.com/portrait.webp" autocomplete="off" />
          <p class="hint">${loc`Paste a web address, or a path in the Foundry Data folder such as worlds/my-world/portraits/agent.webp.`}</p>
          <p class="hint">${loc`To pick from files instead, the GC can turn on Use File Browser for players in Configure Permissions.`}</p>
        </div>
      </div>`,
    ok: { label: loc`Use this picture`, icon: "fa-solid fa-image" },
    render: (_event, dialog) => {
      const root = dialog.element ?? dialog;
      const field = root.querySelector('input[name="path"]');
      const preview = root.querySelector(".sc2-portrait-preview");
      field?.addEventListener("input", () => {
        const path = portraitPath(field.value);
        if (path) preview.src = path;
        preview.classList.toggle("sc2-invalid", !path);
      });
      field?.select();
    }
  });
  if (!input) return;
  const path = portraitPath(input.path);
  if (!path)
    return refuse(
      loc`Picture not changed: that is not an image address. Use a web address or a Data folder path ending in .webp, .png, .jpg or another image type.`
    );
  if (path === current) return;
  await document.update({ [attr]: path });
}
