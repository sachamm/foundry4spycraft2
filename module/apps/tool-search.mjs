import { loc } from "../i18n.mjs";

/** Search local tool sections without changing form values or saved disclosure preferences. */
export function installToolSearch(root, selector, caption = loc`Find a tool`, state = {}) {
  if (!root || root.querySelector(".sc2-tool-search")) return;
  const sections = [...root.querySelectorAll(selector)];
  if (!sections.length) return;
  state.open ??= {};
  const key = section => section.dataset.section ?? section.querySelector("summary")?.textContent.trim();
  const original = new Map(sections.map(section => [section, state.open[key(section)] ?? section.open]));
  const toolbar = document.createElement("div");
  toolbar.className = "sc2-tool-search";
  const label = document.createElement("label");
  label.textContent = caption;
  const search = document.createElement("input");
  search.type = "search";
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
    for (const section of sections) {
      section.dataset.toolSearchActive = String(!!query);
      section.hidden = !!query && !section.textContent.toLocaleLowerCase().includes(query);
      if (!section.hidden) count++;
      // The console's toggle handler can distinguish search changes from the GC's saved preference.
      const open = query ? !section.hidden : original.get(section);
      section.dataset.searchOpen = String(open);
      section.open = open;
    }
    status.textContent =
      count === 1 ? loc`1 section shown` : count ? loc`${count} sections shown` : loc`No matching tools`;
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
