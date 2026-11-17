/** Search documents rather than the paged chat DOM. Never index private roll placeholders. */
export const CHAT_ROLL_TYPES = [
  ['roll', 'All rolls'], ['attack', 'Attack'], ['damage', 'Damage'],
  ['skill', 'Skill check'], ['save', 'Saving throw'], ['ability', 'Attribute check'],
  ['initiative', 'Initiative'], ['actionDie', 'Action die'], ['knowledge', 'Knowledge'],
  ['gear', 'Gear check'], ['request', 'Request check'], ['other', 'Other roll'],
  ['message', 'Messages & events']
];
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
const readable = message => message.visible === true && message.isContentVisible === true;

export function chatRollType(message, flavor = '') {
  const kind = message.flags?.spycraft2?.checkKind;
  if (CHAT_ROLL_TYPES.some(([id]) => id === kind && !['roll', 'other', 'message'].includes(id))) return kind;
  if (message.flags?.core?.initiativeRoll || message.flags?.['core.initiativeRoll']) return 'initiative';
  // Older system messages predate typed roll flags. Infer only from their displayed label.
  if (message.isRoll) {
    if (/^Attack:/i.test(flavor)) return 'attack';
    if (/^Damage:/i.test(flavor)) return 'damage';
    if (/^(Fortitude|Reflex|Will)\b/i.test(flavor)) return 'save';
    if (/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/i.test(flavor)) return 'ability';
    if (/\brolls for Initiative!|^Initiative\b/i.test(flavor)) return 'initiative';
    if (/^Spend an action die\b/i.test(flavor)) return 'actionDie';
    if (/^Knowledge\b/i.test(flavor)) return 'knowledge';
    if (/^Gear check\b/i.test(flavor)) return 'gear';
    if (/^Request\b/i.test(flavor)) return 'request';
    if (/^(Acrobatics|Analysis|Athletics|Blend|Bluff|Bureaucracy|Computers|Cultures|Drive|Electronics|Falsify|Impress|Intimidate|Investigation|Manipulate|Mechanics|Medicine|Networking|Notice|Profession|Resolve|Science|Search|Security|Sense Motive|Sleight of Hand|Sneak|Streetwise|Survival|Tactics)\s*\(/i.test(flavor)) return 'skill';
    return 'other';
  }
  return 'message';
}

/** htmlToText must remove unrevealed secrets when includeSecrets is false. */
export function chatSearchRecord(message, htmlToText) {
  if (!readable(message)) return null;
  const includeSecrets = message.speakerActor?.isOwner ?? globalThis.game?.user?.isGM ?? false;
  const flavor = htmlToText(message.flavor ?? '', includeSecrets);
  const content = htmlToText(message.content ?? '', includeSecrets);
  const character = String(message.speaker?.alias || message.alias || message.author?.name || 'Unknown speaker');
  const rolls = (message.rolls ?? []).map(roll => `${roll.formula ?? ''} ${roll.total ?? ''}`).join(' ');
  const type = chatRollType(message, flavor);
  return {
    id: message.id, character, characterKey: normalize(character), type,
    timestamp: Number(message.timestamp) || 0,
    text: [flavor, content, rolls].filter(Boolean).join(' · '),
    searchText: normalize([flavor, content, rolls].join(' '))
  };
}

export function searchChatRecords(records, {character = '', type = '', text = ''} = {}) {
  const terms = normalize(text).split(/\s+/).filter(Boolean);
  return records.filter(record => (!character || record.characterKey === character)
    && (!type || (type === 'roll' ? record.type !== 'message' : record.type === type))
    && terms.every(term => record.searchText.includes(term)))
    .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
}

export function chatHTMLToText(html, includeSecrets = false) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script, style, template').forEach(node => node.remove());
  if (!includeSecrets) doc.querySelectorAll('section.secret:not(.revealed)').forEach(node => node.remove());
  doc.querySelectorAll('br, p, div, li, section, h1, h2, h3, h4, tr').forEach(node => node.append(' '));
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const panels = new Map();
let installed = false;
const pageSize = 50;
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function mountChatSearch(app, html) {
  const root = html instanceof HTMLElement ? html : app.element;
  const scroll = root?.querySelector('.chat-scroll');
  if (!scroll || root.querySelector('.sc2-chat-search')) return;
  const panel = make('section', 'sc2-chat-search');
  panel.setAttribute('aria-label', 'Search chat history');
  const heading = make('div', 'sc2-chat-search-heading');
  heading.append(make('strong', '', 'Search chat'));
  const clear = make('button', '', 'Clear');
  clear.type = 'button'; clear.setAttribute('aria-label', 'Clear chat filters');
  heading.append(clear);
  const textLabel = make('label', 'sc2-chat-text', 'Text');
  const text = make('input');
  text.type = 'search'; text.placeholder = 'Search messages and rolls…';
  text.setAttribute('aria-label', 'Search chat text');
  textLabel.append(text);
  const filters = make('div', 'sc2-chat-filter-row');
  const characterLabel = make('label', '', 'Character');
  const character = make('select'); character.setAttribute('aria-label', 'Chat character');
  characterLabel.append(character);
  const typeLabel = make('label', '', 'Roll type');
  const type = make('select'); type.setAttribute('aria-label', 'Chat roll type');
  for (const [value, label] of [['', 'All types'], ...CHAT_ROLL_TYPES]) type.append(new Option(label, value));
  typeLabel.append(type); filters.append(characterLabel, typeLabel);
  const status = make('p', 'sc2-chat-search-status', 'Search all readable chat history.');
  status.setAttribute('role', 'status');
  panel.append(heading, textLabel, filters, status);
  const results = make('div', 'sc2-chat-search-results'); results.hidden = true;
  results.setAttribute('aria-label', 'Chat search results');
  scroll.before(panel, results);
  const state = {root, panel, scroll, results, character, type, text, status, limit: pageSize};
  panels.set(root, state);
  const update = () => { state.limit = pageSize; refreshChatSearch(state); };
  let timer;
  text.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 120); });
  character.addEventListener('change', update); type.addEventListener('change', update);
  clear.addEventListener('click', () => {
    clearTimeout(timer); text.value = ''; character.value = ''; type.value = '';
    update(); text.focus();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target === text) { event.preventDefault(); clearTimeout(timer); update(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); clear.click(); }
  });
  refreshChatSearch(state);
}

function refreshChatSearch(state) {
  const {scroll, results, character, type, text, status} = state;
  const records = [...(game.messages ?? [])].map(message => chatSearchRecord(message, chatHTMLToText)).filter(Boolean);
  const selected = character.value;
  const names = new Map(records.map(record => [record.characterKey, record.character]));
  const options = [new Option('All characters', '')];
  for (const [key, name] of [...names].sort((a, b) => a[1].localeCompare(b[1]))) options.push(new Option(name, key));
  // Keep an active character filter after its last message is removed, rather than broadening the query.
  if (selected && !names.has(selected)) options.push(new Option(character.selectedOptions[0]?.textContent || selected, selected));
  character.replaceChildren(...options); character.value = selected;
  const active = !!(character.value || type.value || text.value.trim());
  scroll.hidden = active; results.hidden = !active; results.replaceChildren();
  if (!active) { status.textContent = 'Search all readable chat history.'; return; }
  const matches = searchChatRecords(records, {character: character.value, type: type.value, text: text.value});
  const shown = matches.slice(0, state.limit);
  status.textContent = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} · newest first${matches.length > shown.length ? ` · showing ${shown.length}` : ''}`;
  if (!shown.length) results.append(make('p', 'sc2-chat-search-empty', 'No messages match these filters.'));
  for (const record of shown) {
    const item = make('article', 'sc2-chat-search-result');
    const title = make('div', 'sc2-chat-result-title');
    title.append(make('strong', '', record.character), make('span', '', CHAT_ROLL_TYPES.find(([id]) => id === record.type)?.[1] ?? 'Message'));
    const time = make('time', '', new Date(record.timestamp).toLocaleString());
    time.dateTime = new Date(record.timestamp).toISOString();
    const excerpt = make('p', '', record.text.length > 450 ? record.text.slice(0, 450) + '…' : record.text);
    const open = make('button', '', 'Open message'); open.type = 'button';
    open.addEventListener('click', async () => {
      const message = game.messages.get(record.id);
      if (!message || !readable(message)) { refreshChatSearch(state); return; }
      await new foundry.applications.sidebar.apps.ChatPopout({message}).render({force: true});
    });
    item.append(title, time, excerpt, open); results.append(item);
  }
  if (matches.length > shown.length) {
    const more = make('button', 'sc2-chat-search-more', 'Show more matches'); more.type = 'button';
    more.addEventListener('click', () => { state.limit += pageSize; refreshChatSearch(state); });
    results.append(more);
  }
}

export function installChatSearchHooks() {
  if (installed) return;
  installed = true;
  Hooks.on('renderChatLog', mountChatSearch);
  const refresh = () => {
    for (const [root, state] of panels) {
      if (!root.isConnected) { panels.delete(root); continue; }
      refreshChatSearch(state);
    }
  };
  for (const event of ['createChatMessage', 'updateChatMessage', 'deleteChatMessage', 'updateUser', 'updateActor']) Hooks.on(event, refresh);
}
