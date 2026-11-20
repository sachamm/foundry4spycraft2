import { computeNpcProfile, defaultNpcProfile } from "../../module/rules/npcs.mjs";
import { defaultMission } from "../../module/rules/gc/mission.mjs";
import { configureGlassWakeMission } from "./glass-wake-setup.mjs";

/** Assemble original scenario content around the current sample actors and maps, never a saved world. */
export function buildGlassWake(data, packs, { stats }) {
  const materialize = doc => {
    const { embedded, ...source } = structuredClone(doc);
    return { ...source, ...embedded };
  };
  const folder = label => {
    const match = data.folders.find(f => f.name === `Glass Wake — ${label}`);
    if (!match) throw new Error(`Glass Wake: missing ${label} folder`);
    return match._id;
  };
  const actors = data.actors.map(spec => {
    let actor;
    if (spec.pack) {
      const source = packs[spec.pack]?.docs.find(
        doc => (doc.flags?.spycraft2?.sampleAgent ?? doc.flags?.spycraft2?.sampleNpc) === spec.source
      );
      if (!source) throw new Error(`Glass Wake: unknown ${spec.pack}/${spec.source}`);
      actor = JSON.parse(JSON.stringify(materialize(source)).replaceAll(source._id, spec._id));
    } else {
      actor = {
        type: "npc",
        img: "icons/svg/mystery-man.svg",
        items: [],
        effects: [],
        system: {
          npcType: "standard",
          threatLevel: 1,
          followMission: true,
          abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: 10 }])),
          vitality: { value: 0 },
          wounds: { value: 0 },
          npcProfile: {
            ...defaultNpcProfile(),
            enabled: true,
            skills: [{ key: "notice", grade: 1 }],
            equipment: { weapons: [], gear: [], vehicles: [] }
          }
        },
        prototypeToken: { actorLink: false, disposition: 0, texture: { src: "icons/svg/mystery-man.svg" } }
      };
    }
    actor._id = spec._id;
    actor.name = spec.name;
    actor.folder = folder(actor.type === "agent" ? "Agents" : "NPCs");
    actor.ownership = { default: 0 };
    actor._stats = stats;
    actor.flags = { spycraft2: { ...actor.flags?.spycraft2, glassWake: spec.key } };
    for (const key of ["sampleAgent", "sampleClass", "sampleCompanions", "sampleNpc"])
      delete actor.flags.spycraft2[key];
    actor.prototypeToken.name = actor.name;
    if (spec.biography) actor.system.biography = spec.biography + (actor.system.biography ?? "");
    return actor;
  });
  const actorByKey = new Map(data.actors.map((spec, index) => [spec.key, actors[index]]));
  const scenes = data.scenes.map(spec => {
    const original = packs["sample-scenes"].docs.find(doc => doc.flags?.spycraft2?.sampleScene === spec.source);
    if (!original) throw new Error(`Glass Wake: unknown scene ${spec.source}`);
    const scene = materialize(original);
    Object.assign(scene, {
      _id: spec._id,
      name: spec.name,
      folder: folder("Encounters"),
      navigation: true,
      active: false,
      ownership: { default: 0 },
      flags: { spycraft2: { glassWakeScene: spec.source } },
      thumb: scene.levels[0].background.src,
      journal: data.journals[0]._id,
      journalEntryPage: data.journals[0].pages.find(p => p.name.startsWith("Session 1"))._id,
      tokens: spec.tokens.map(token => {
        const actor = actorByKey.get(token.actor);
        if (!actor) throw new Error(`Glass Wake: unknown token actor ${token.actor}`);
        return {
          ...structuredClone(actor.prototypeToken),
          _id: token._id,
          actorId: actor._id,
          name: token.name,
          x: token.x,
          y: token.y,
          level: scene.initialLevel,
          hidden: false
        };
      })
    });
    return scene;
  });
  const mission = { ...defaultMission(), ...structuredClone(data.mission) };
  mission.antagonists = mission.antagonists.map(entry => {
    const actor = actors.find(a => a._id === entry.uuid.split(".")[1]);
    if (!actor || actor.type !== "npc") throw new Error(`Glass Wake: unknown antagonist ${entry.uuid}`);
    const result = computeNpcProfile(actor.system.npcProfile, actor.system.npcType, 1, actor.system.abilities);
    if (!result.complete) throw new Error(`Glass Wake: invalid antagonist ${actor.name}`);
    return { ...entry, xp: result.xp, type: actor.system.npcType };
  });
  if (mission.team.some(id => !actors.some(actor => actor._id === id && actor.type === "agent")))
    throw new Error("Glass Wake: the mission team must use imported agents");
  const setup = {
    mission,
    emptyMission: defaultMission(),
    participants: data.actors.map((spec, index) => ({ id: spec._id, key: spec.key, type: actors[index].type }))
  };
  const journals = data.journals.map(spec => ({
    _id: spec._id,
    name: spec.name,
    folder: folder("Briefing and GM Notes"),
    ownership: structuredClone(spec.ownership),
    flags: { spycraft2: { glassWake: true } },
    _stats: stats,
    pages: spec.pages.map(page => ({
      _id: page._id,
      name: page.name,
      type: "text",
      sort: page.sort,
      title: { show: true, level: 1 },
      text: { format: 1, content: page.content },
      ownership: { default: -1 }
    }))
  }));
  const adventure = {
    _id: data._id,
    name: data.name,
    img: scenes[0].levels[0].background.src,
    caption: data.caption,
    description: data.description,
    actors,
    scenes,
    journal: journals,
    macros: [
      {
        ...data.macro,
        type: "script",
        scope: "global",
        img: "icons/svg/book.svg",
        folder: folder("Mission Setup"),
        ownership: { default: 0 },
        command: `await (${configureGlassWakeMission.toString()})(${JSON.stringify(setup)});`,
        _stats: stats
      }
    ],
    folders: structuredClone(data.folders),
    items: [],
    combats: [],
    tables: [],
    cards: [],
    playlists: [],
    folder: null,
    sort: 0,
    flags: { core: { sheetClass: "core.AdventureImporterV2" }, spycraft2: { glassWake: 1 } },
    _stats: stats
  };
  return { label: "Operation Glass Wake", type: "Adventure", collection: "adventures", folders: [], docs: [adventure] };
}
