import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

/** Multiple scene tokens for one shared actor require a position choice, rather than overwriting it with the last ring. */
export function measuredBlastActors(caught = []) {
  const measured = new Map();
  for (const row of caught ?? []) {
    if (!row.actor) continue;
    const prior = measured.get(row.actor.uuid);
    measured.set(
      row.actor.uuid,
      prior ? { ...prior, ambiguous: true, positions: [...prior.positions, row] } : { ...row, positions: [row] }
    );
  }
  return measured;
}

export function blastTargetRows(actors, measured, increment) {
  return actors
    .map((actor, index) => {
      const measuredRow = measured.get(actor.uuid),
        row = measuredRow?.ambiguous ? null : measuredRow,
        blocked = row?.behindWall === true;
      return `<tr><td><label><input type="checkbox" name="hit${index}"${row && !blocked ? " checked" : ""} /> ${esc(actor.isOwner ? actor.name : loc`${actor.name} (sent to the GC)`)}</label>${measuredRow?.ambiguous ? `<p class="hint">${loc`Multiple tokens share this character. Enter the actual position once:`} ${measuredRow.positions.map(position => esc(loc`${position.name}: ${position.ring * increment} ft.`)).join("; ")}</p>` : ""}${blocked ? `<small>${loc`Map: intervening wall`}</small>` : ""}</td><td><input type="number" name="feet${index}" aria-label="${esc(loc`${actor.name}: feet from Ground Zero`)}" min="0" step="any" value="${row ? row.ring * increment : ""}" class="w-2" /></td><td>${row ? row.damage : ""}</td><td><label>${loc`Direct path`} <select name="route${index}"><option value="clear"${blocked ? "" : " selected"}>${loc`No blocking cover`}</option><option value="blocked"${blocked ? " selected" : ""}>${loc`Cover stopped blast`}</option><option value="breached">${loc`Cover failed Damage save`}</option></select></label><details><summary>${loc`Cover evidence`}</summary><label>${loc`Cover and actual save result`} <input name="coverNote${index}" maxlength="2048" /></label></details></td></tr>`;
    })
    .join("");
}

export function blastGeometryFields() {
  return `<label>${loc`Blast shape`} <select name="shape"><option value="circle">${loc`Circle`}</option><option value="cone">${loc`90-degree cone`}</option></select></label><label><input name="routeConfirmed" type="checkbox" /> ${loc`The GC confirms the selected targets are inside the shape, with direct paths and all character or scenery cover accounted for`}</label><p class="hint">${loc`Blast follows straight paths. Cover stops it unless that cover actually failed its Damage save; record that result before choosing a breached path. Resolve any contained-blast increase on the original damage card before applying it (p.343). Each character then receives its own required saves.`}</p>`;
}
