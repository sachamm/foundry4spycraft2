import { loc } from "../i18n.mjs";

const CONTROLS = "button, a[data-action], [data-search-terms]";
/** Every word a control answers to: its label, its tooltip and the extra terms it was given. */
const words = element =>
  [element.textContent, element.dataset?.tooltip, element.dataset?.searchTerms, element.getAttribute?.("aria-label")]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
/** A section or control matches when every word typed appears in it, in any order. */
export const searchMatches = (text, query) =>
  query
    .split(/\s+/)
    .filter(Boolean)
    .every(word => text.includes(word));

/**
 * Search local tool sections without changing form values or saved disclosure preferences.
 * `options.terms` maps a `data-action` to extra search words; `options.elsewhere` maps a phrase to a line that says where
 * a tool this surface does not have lives.
 */
export function installToolSearch(root, selector, caption = loc`Find a tool`, state = {}, options = {}) {
  if (!root || root.querySelector(".sc2-tool-search")) return;
  const sections = [...root.querySelectorAll(selector)];
  if (!sections.length) return;
  for (const [action, terms] of Object.entries(options.terms ?? {}))
    for (const control of root.querySelectorAll(`[data-action="${action}"]`))
      control.dataset.searchTerms = [control.dataset.searchTerms, terms].filter(Boolean).join(" ");
  state.open ??= {};
  const key = section => section.dataset.section ?? section.querySelector("summary")?.textContent.trim();
  const original = new Map(sections.map(section => [section, state.open[key(section)] ?? section.open]));
  const toolbar = document.createElement("div");
  toolbar.className = "sc2-tool-search";
  const label = document.createElement("label");
  label.textContent = caption;
  const search = document.createElement("input");
  search.type = "search";
  search.setAttribute("aria-label", caption);
  search.value = state.query ?? "";
  for (const section of sections)
    section.addEventListener("toggle", () => {
      if (!search.value && section.dataset.searchOpen !== String(section.open)) {
        original.set(section, section.open);
        state.open[key(section)] = section.open;
      }
    });
  label.append(search);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = loc`Clear search`;
  const status = document.createElement("span");
  status.setAttribute("role", "status");
  toolbar.append(label, clear, status);
  sections[0].before(toolbar);
  const filter = () => {
    state.query = search.value;
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const hit of root.querySelectorAll(".sc2-search-hit")) hit.classList.remove("sc2-search-hit");
    for (const section of sections) {
      section.dataset.toolSearchActive = String(!!query);
      const controls = query ? [...section.querySelectorAll(CONTROLS)].filter(c => searchMatches(words(c), query)) : [];
      section.hidden = !!query && !controls.length && !searchMatches(words(section), query);
      if (!section.hidden) count++;
      // Mark the controls that matched, and open the inner lists that hold them.
      for (const control of controls) {
        control.classList.add("sc2-search-hit");
        for (let inner = control.parentElement?.closest("details"); inner && inner !== section;)
          ((inner.open = true), (inner = inner.parentElement?.closest("details")));
      }
      // The console's toggle handler can distinguish search changes from the GC's saved preference.
      const open = query ? !section.hidden : original.get(section);
      section.dataset.searchOpen = String(open);
      section.open = open;
    }
    // With nothing typed the count says nothing useful, and a view may be hiding some of the sections.
    const away = query
      ? Object.entries(options.elsewhere ?? {}).find(([phrase]) => searchMatches(phrase.toLocaleLowerCase(), query))
      : null;
    status.textContent = !query
      ? ""
      : count === 1
        ? loc`1 section shown`
        : count
          ? loc`${count} sections shown`
          : (away?.[1] ?? loc`No matching tools`);
    clear.disabled = !search.value;
  };
  search.addEventListener("input", filter);
  search.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !search.value) return;
    event.preventDefault();
    event.stopPropagation();
    search.value = "";
    filter();
  });
  clear.addEventListener("click", () => {
    search.value = "";
    filter();
    search.focus();
  });
  filter();
}
