/** One queue for the GC client's writes to Initiative Counts, so a doubling and an end-of-round pass never interleave. */
let chain = Promise.resolve();
export function queueInitiative(work) {
  const run = chain.then(work, work);
  chain = run.catch(() => {});
  return run;
}
