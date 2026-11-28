/** Build complete level-1 example agents from explicit creation plans and ordinary catalog items. */
import { computeAgent } from "../../module/rules/engine.mjs";
import { SPYCRAFT } from "../../module/config.mjs";
import {
  ammunitionConfiguration,
  ammunitionStockpilePlan,
  compatibleAmmunition
} from "../../module/rules/ammunition.mjs";
import { missionCaliberPlan } from "../../module/rules/mission-gear.mjs";
import { computeNpcProfile, defaultNpcProfile, npcTableValue } from "../../module/rules/npcs.mjs";
import { animalPartnerReview, animalPartnerCap } from "../../module/rules/companions.mjs";
import { iconPath } from "./compendium-icons.mjs";
const PACK = "sample-agents";
const esc = text =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const paragraphs = text => `<p>${esc(text)}</p>`;
export function sampleAgentState(spec, data) {
  return {
    abilities: Object.fromEntries(Object.entries(spec.abilities).map(([key, base]) => [key, { base, misc: 0 }])),
    pointBuyBudget: 36,
    progression: [
      {
        classId: spec.classId,
        vitality: 0,
        careerEntryId: `sample-${spec.id}-level-1`,
        skills: structuredClone(spec.skills)
      }
    ],
    xp: 1000,
    codename: spec.codename,
    details: structuredClone(spec.details),
    proficiencies: structuredClone(spec.proficiencies),
    skills: {},
    focuses: structuredClone(spec.focuses),
    skillFortes: structuredClone(spec.skillFortes),
    interests: spec.interests,
    contacts: structuredClone(spec.contacts),
    subplots: structuredClone(spec.subplots),
    identities: structuredClone(spec.identities ?? []),
    activeIdentity: "",
    wealthAllocation: structuredClone(spec.wealthAllocation),
    affiliationType: "faction",
    resourcesInitialized: true,
    reputation: 2,
    netWorth: 0,
    missionReserves: {
      epoch: "initial",
      initialized: true,
      initializationSource: "intel",
      caliber: data.missionCaliber,
      procureAtIntel: false,
      picks: {},
      charismaPicks: {},
      common: 0,
      spent: {},
      spentCommon: 0,
      attempts: {}
    },
    vitality: { value: 0 },
    wounds: { value: 0 },
    actionDice: { value: 0 },
    misc: {},
    startingIntelligenceModifier: null
  };
}
export function buildSampleAgents(data, packs, { id, stats, commonCatalog, ammoCatalog, iconData }) {
  const classIds = [...new Set(data.agents.map(a => a.classId))];
  const folders = classIds.map((key, index) => ({
    _id: id(PACK, "folder", key),
    name: packs.classes.docs.find(c => c.system.identifier === key).name,
    type: "Actor",
    folder: null,
    sorting: "a",
    sort: (index + 1) * 100000,
    color: null,
    flags: {},
    _stats: stats
  }));
  const docs = [],
    companions = [],
    computed = new Map();
  for (const [index, spec] of data.agents.entries()) {
    const items = [];
    const add = (pack, name, patch = {}) => {
      const source = packs[pack]?.docs.find(item => item.name === name);
      if (!source) throw Error(`${spec.name}: unknown ${pack}/${name}`);
      const item = structuredClone(source);
      item._id = id(PACK, spec.id, pack, source._id, String(items.length));
      item.folder = null;
      item.sort = (items.length + 1) * 100000;
      Object.assign(item.system, patch);
      item._stats = { ...stats, compendiumSource: `Compendium.spycraft2.${pack}.Item.${source._id}` };
      item.flags = {
        ...item.flags,
        core: { ...item.flags?.core, sourceId: `Compendium.spycraft2.${pack}.Item.${source._id}` }
      };
      items.push(item);
      return item;
    };
    const clsSource = packs.classes.docs.find(c => c.system.identifier === spec.classId && !c.system.expert);
    if (!clsSource) throw Error(`${spec.name}: choose a base class.`);
    const cls = add("classes", clsSource.name, {
      choices: structuredClone(spec.classChoices),
      skillChoices: structuredClone(spec.skillChoices)
    });
    add("origins", spec.talent, { originChoices: structuredClone(spec.talentChoices ?? {}) });
    const specialty = add("origins", spec.specialty, { originChoices: structuredClone(spec.originChoices ?? {}) });
    const grants = new Set([
      ...(specialty.system.grants ?? []),
      ...(cls.system.featGrants ?? []).filter(g => g.level <= 1).map(g => g.feat)
    ]);
    for (const name of grants) add("feats", name, { granted: true, featKind: "permanent", acquiredAtLevel: 1 });
    for (const feat of spec.feats)
      add("feats", feat.name, { granted: false, featKind: "permanent", acquiredAtLevel: 1, choice: feat.choice ?? "" });
    const state = sampleAgentState(spec, data);
    state.progression[0].vitality = cls.system.vitalityDie;
    let firstWeapon = true,
      firstArmor = true;
    const ammoEntries = [];
    const primary =
      spec.loadout.find(entry => entry.pick === "W") ?? spec.loadout.find(entry => entry.pack === "weapons");
    for (const [loadIndex, entry] of spec.loadout.entries()) {
      const item = add(entry.pack, entry.name, {
        pick: entry.funding === "mission" ? entry.pick : "",
        possessionSource: entry.funding === "wealth" ? "wealth" : "",
        possessionApproved: entry.funding === "wealth",
        reserve: false,
        carried: entry.carried !== false
      });
      item.flags.spycraft2 = {
        ...item.flags.spycraft2,
        sampleFunding: {
          kind: entry.funding,
          category: entry.category,
          missionCaliber: data.missionCaliber,
          stowage: entry.carried === false ? "Lantern support vehicle / safe house" : "Carried",
          upgrades: entry.upgradeDecision
        }
      };
      if (entry.pack === "kits") item.system.gearCategory = entry.category;
      if (item.type === "armor") {
        item.system.equipped = firstArmor && item.system.carried;
        firstArmor = false;
      }
      if (item.type === "weapon") {
        item.system.equipped = entry === primary && item.system.carried && firstWeapon;
        if (item.system.equipped) firstWeapon = false;
        item.system.useHands = item.system.equipped ? (/2h/i.test(item.system.sizeHands ?? "") ? 2 : 1) : 0;
        item.system.fireMode = item.system.fireModes?.includes("single") ? "single" : "";
      }
      if (item.system.kitNonPortable) item.system.kitLocation = "Lantern safe-house workshop";
      if (entry.ammunition) {
        item.system.ammoCodeChoice = entry.ammunition.code;
        const config = ammunitionConfiguration(item.system),
          ammo = compatibleAmmunition(item.system, ammoCatalog).find(a => a.id === entry.ammunition.id);
        if (config.needsReview || config.requiresChoice || !ammo?.firstStockpile)
          throw Error(`${spec.name}: invalid included ammunition for ${item.name}.`);
        const plan = ammunitionStockpilePlan(item.system, ammoCatalog, {
          ammunitionId: ammo.id,
          stockpiles: 1,
          initial: true
        });
        ammoEntries.push({
          _id: id(PACK, spec.id, "ammo", String(loadIndex)),
          name: `${ammo.name} ammunition — ${item.name}`,
          type: "gear",
          img: iconPath(iconData, iconData.npcAmmunition),
          system: {
            description: paragraphs(
              `One included ${plan.code} stockpile: ${plan.totalShots} shots. The quantity counts stockpiles. This entry comes with the weapon and costs no additional mission pick or Common Items.`
            ),
            source: `Table 4.62 p.${ammo.sourcePage}`,
            quantity: 1,
            weight: plan.totalWeight,
            caliber: 0,
            gearCategory: "W",
            pick: "",
            common: false,
            carried: item.system.carried,
            equipped: false
          },
          effects: [],
          folder: null,
          ownership: { default: 0 },
          flags: {
            spycraft2: {
              sampleAmmunition: {
                weaponId: item._id,
                ammunitionId: ammo.id,
                code: plan.code,
                shots: plan.totalShots,
                includedStockpiles: 1,
                upgradeCost: plan.upgradeCost,
                commonItemCost: plan.commonItemCost
              }
            }
          },
          _stats: stats
        });
      }
      if (entry.funding === "mission" && item.system.caliber > data.missionCaliber && !entry.missionAbility)
        throw Error(`${spec.name}: ${item.name} exceeds mission Caliber.`);
      if (entry.missionAbility) {
        const derived = computeAgent(
          structuredClone(state),
          items.map(i => ({ ...i, id: i._id })),
          SPYCRAFT
        );
        const plan = missionCaliberPlan(
          derived,
          items.map(i => ({ ...i, id: i._id })),
          { source: entry.missionAbility, itemId: item._id, intelConfirmed: true }
        );
        state.missionCaliberPicks ??= {};
        state.missionCaliberPicks[plan.key] = plan.record;
        item.system.missionCaliberGrant = plan.stamp;
      }
    }
    items.push(...ammoEntries);
    for (const key of spec.commonItems) {
      const common = [...commonCatalog, ...(data.commonSupplies ?? [])].find(c => c.id === key);
      if (!common) throw Error(`${spec.name}: unknown Common Item ${key}`);
      items.push({
        _id: id(PACK, spec.id, "common", key),
        name: common.name,
        type: "gear",
        img: iconPath(iconData, common.icon ?? iconData.npcCommonItems[key]),
        system: {
          description: paragraphs(common.description),
          source: "Common Item, p.213; sample weight estimate",
          quantity: 1,
          weight:
            common.weight ??
            {
              "cell-phone": 0.3,
              flashlight: 0.5,
              notebook: 0.5,
              backpack: 1,
              canteen: 2,
              multitool: 0.5,
              compass: 0.1,
              binoculars: 1,
              "duct-tape": 0.5,
              "storage-media": 0.1,
              stretcher: 10,
              "road-flares": 1,
              handcuffs: 0.5
            }[key] ??
            0,
          caliber: 0,
          pick: "",
          common: true,
          carried: key !== "stretcher",
          equipped: false
        },
        folder: null,
        effects: [],
        ownership: { default: 0 },
        flags: { spycraft2: { sampleCommonItem: key } },
        _stats: stats
      });
    }
    const derived = computeAgent(
      structuredClone(state),
      items.map(i => ({ ...i, id: i._id })),
      SPYCRAFT
    );
    if (derived.warnings.length || derived.todo.length)
      throw Error(`${spec.name}: ${[...derived.warnings, ...derived.todo.map(t => t.text)].join("; ")}`);
    if (derived.pointBuy.remaining !== 0 || derived.skillPoints.some(sp => sp.remaining !== 0))
      throw Error(`${spec.name}: incomplete creation budget.`);
    state.startingIntelligenceModifier = derived.abilities.int.mod;
    state.progression[0].intelligenceModifier = derived.abilities.int.mod;
    state.vitality.value = derived.vitality.max;
    state.wounds.value = derived.wounds.max;
    state.actionDice.value = derived.actionDice.max;
    const companions = (data.companions ?? []).filter(c => c.owner === spec.id);
    state.biography = [
      paragraphs(spec.background),
      `<h3>${esc(spec.role)}</h3>`,
      paragraphs(
        `Level 1 ${cls.name}; ${spec.talent} / ${spec.specialty}. Nationality: ${spec.nationality}. Birthplace: ${spec.birthplace}. Codename: ${spec.codename}.`
      ),
      paragraphs(
        `This sample uses a 36-point build, maximum first-level vitality, and an example Caliber-II Lantern Office mission. Personal Possessions, mission picks and Common Items are accounted for separately. Optional included upgrades are deliberately declined; they confer no benefit. Starting resources: 2 Reputation; no mission rewards have been earned.`
      ),
      paragraphs(spec.carryNotes),
      `<h3>Equipment funding</h3><ul>${spec.loadout.map(e => `<li>${esc(e.name)} — ${e.funding === "wealth" ? "Personal Possession" : esc(e.pick) + " mission pick"}${e.carried === false ? "; stowed at support vehicle / safe house" : "; carried"}${e.missionAbility ? "; Custom Ride applies" : ""}</li>`).join("")}</ul>`,
      paragraphs(
        `Common Items: ${spec.commonItems.length} of the starting ${derived.commonItems.count} selected. The remaining ${derived.commonItems.count - spec.commonItems.length} starting choices and the normal ${derived.commonItems.perMission} replacements remain available for mission needs.`
      ),
      paragraphs(
        companions.length
          ? `Animal Partner: ${companions.map(c => c.name).join(", ")}. Importing this sample creates and links its included companion.`
          : "No companion-granting feat is selected. Contacts are recorded on Training; they are relationships, not combat followers."
      ),
      paragraphs(
        "The Lantern Office and every biography are original sample campaign material. Change the faction, background or loadout to suit the campaign; later mission allowances remain subject to that mission's Caliber."
      )
    ].join("");
    const actor = {
      _id: id(PACK, "agent", spec.id),
      // One person, one name: the sheet carries the person's name and the token (and so each card) the code name with it.
      name: spec.name,
      type: "agent",
      img: spec.portrait,
      system: state,
      prototypeToken: {
        name: `${spec.codename} (${spec.name})`,
        actorLink: true,
        disposition: 1,
        sight: { enabled: true },
        texture: { src: spec.token }
      },
      items: items.map(i => i._id),
      effects: [],
      folder: folders.find(f => f.name === cls.name)._id,
      sort: (index + 1) * 100000,
      ownership: { default: 0 },
      flags: {
        spycraft2: { sampleAgent: spec.id, sampleClass: spec.classId, sampleCompanions: companions.map(c => c.id) }
      },
      _stats: stats,
      embedded: { items }
    };
    docs.push(actor);
    computed.set(spec.id, derived);
  }
  for (const spec of data.companions ?? []) {
    const owner = docs.find(d => d.flags.spycraft2.sampleAgent === spec.owner),
      ownerSystem = computed.get(spec.owner);
    if (!owner || !ownerSystem.activeFeatNames.includes(spec.feat))
      throw Error(`${spec.name}: companion owner is not eligible.`);
    const profile = {
      ...defaultNpcProfile(),
      enabled: true,
      tier: 3,
      group: false,
      grades: structuredClone(spec.grades),
      skills: structuredClone(spec.skills),
      qualities: structuredClone(spec.qualities),
      equipment: { weapons: [], gear: [], vehicles: [] }
    };
    const abilities = Object.fromEntries(Object.entries(spec.abilities).map(([key, value]) => [key, { value }]));
    const result = computeNpcProfile(profile, "animal", 1, abilities);
    const review = animalPartnerReview(ownerSystem, { npcType: "animal", npcProfile: profile, npcBuild: result });
    if (!result.complete || review.warnings.length)
      throw Error(`${spec.name}: ${[...result.warnings, ...review.warnings].join("; ")}`);
    const health = npcTableValue("health", Math.min(10, spec.grades.health + 1), 1);
    const granted = structuredClone(packs.feats.docs.find(f => f.name === "Wolfpack Mastery"));
    granted._id = id(PACK, spec.id, "feat");
    granted.folder = null;
    Object.assign(granted.system, { granted: true, acquiredAtLevel: 0 });
    const bite = {
      _id: id(PACK, spec.id, "bite"),
      name: "Bite II",
      type: "weapon",
      img: iconPath(iconData, "dog"),
      system: {
        description: paragraphs(
          "Natural bite, Caliber II. Included through the animal's paid Natural Attack quality; it uses an Unarmed Standard Attack."
        ),
        source: "Table 7.12 p.449",
        quantity: 1,
        caliber: 0,
        weight: 0,
        common: false,
        pick: "",
        carried: true,
        equipped: true,
        proficiency: "unarmed",
        damage: "1d8",
        error: 2,
        threat: 18,
        range: 0,
        sizeHands: "M/0h",
        useHands: 0,
        gearCategory: "W"
      },
      effects: [],
      folder: null,
      flags: { spycraft2: { sampleNaturalAttack: true } },
      _stats: stats
    };
    const companionItems = [granted, bite];
    companions.push({
      _id: id(PACK, "companion", spec.id),
      name: `${spec.name} — Animal Partner`,
      type: "npc",
      img: spec.portrait,
      system: {
        npcType: "animal",
        threatLevel: 1,
        followMission: false,
        abilities,
        npcProfile: profile,
        companionOf: { ownerUuid: `Compendium.spycraft2.${PACK}.Actor.${owner._id}`, feat: spec.feat },
        vitality: { value: health[0] },
        wounds: { value: health[1] },
        disposition: { base: "helpful", toward: {} },
        biography: [
          paragraphs(spec.background),
          paragraphs(
            `${spec.size} animal partner of ${owner.name}. Counted XP before two free trained qualities: ${review.xp}; cap ${animalPartnerCap(ownerSystem)}. Free training: Rescue and Seek on Command. Wolf Pack Mastery is the free Medium-size companion grant, not a purchased quality. Health is one grade higher; Threat Level is owner level minus 2, minimum 1. No action dice; the owner may spend theirs.`
          )
        ].join("")
      },
      prototypeToken: {
        name: spec.name,
        actorLink: true,
        disposition: 1,
        sight: { enabled: true },
        texture: { src: spec.token }
      },
      items: companionItems.map(i => i._id),
      effects: [],
      folder: folders.find(f => f.name === "Scout")._id,
      sort: 9900000,
      ownership: { default: 0 },
      flags: {
        spycraft2: {
          sampleCompanion: spec.id,
          sampleOwner: spec.owner,
          companionFreeTraining: spec.freeTrainedQualities
        }
      },
      _stats: stats,
      embedded: { items: companionItems }
    });
  }
  return { label: data.label, type: "Actor", collection: "actors", folders, docs, companions };
}
