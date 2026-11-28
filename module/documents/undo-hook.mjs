/**
 * A document step that should leave an Undo note runs through here. module/apps/undo.mjs registers its `withUndo`
 * when it loads, so the documents layer need not import the apps layer; until then the step simply runs.
 */
export const undoHook = {
  /** @type {(actors: object[], label: string, work: () => Promise<any>) => Promise<any>} */
  run: (actors, label, work) => work()
};
