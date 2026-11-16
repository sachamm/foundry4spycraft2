# RAW implementation resume checkpoint

Paused at the user's request on 2026-11-16 after completed batch329. Repository: `/Volumes/New Master/Users/sacha ON NEW MASTER/Development/Foundry/chatGPT/foundry4spycraft2`, branch `main`. Read this file, `raw-character-review.md` and `raw-option-inventory.md` before continuing. The user requested a commit and push of the accumulated implementation work.

## Progress and verification

All seven character tabs have completed their numerical/reference pass. Implementation is incomplete:120manual feat rows,57explicit partial rows,137other notes; at least177of314feat options still require implementation or verification. Twenty whole-feat closures were recorded in batches237–329. Counts are a lower bound, not an overall percentage; class, action and condition workflows add separate remaining work.

Latest complete batch329 implements Superior Accuracy: trained+aimed+braced gives threat+1, stacking independently with ACC. Shared owned-source/mode-proficiency evidence protects entry, RNG and replacement checks; optional old records remain compatible. Batch328 fixed Garrote/Punch gloves NKL modifiers and Rock light constant damage while preserving Unicode minus/brass minimum0. Bullwhip mixed damage remains gated pending a ruling.

Latest verification: `npm test` passed482legacy checks and2487Node tests (862+1625). Static checks passed240scripts,19templates and patch whitespace. Browser layout suite last passed47fixtures in batch327;328/329 did not change layout. Native329 audit:13receipts,13guards,4UI observations, reload and cleanup verified. Native328 audit:8receipts,7guards,5UI observations, reload and cleanup verified. Audits are in `docs/qa/`.

## Next work — batch330 not started

Continue the residual ledger, checking original sources and each conditional interaction. Useful candidate: Quirky(QKY), p.302, currently has no executable rule in gear attack math. It increases an untrained weapon attack penalty by4. Thirteen catalog sources have QKY. Before implementing, resolve the COP Inc. COP .357's explicit `untrainedPenalty:-6`: determine whether that is its base or already includes an adjustment. Do not double-count it. Check the original p.254 holdout table, p.299 proficiency table and source provenance. Launcher mode replaces ordinary proficiency and untrained penalty; use the actual operating profile. No QKY code or ruling question has been started.

Other clear candidates: Sure Grip(SUR), p.302, gives +3gear on skill checks resisting Disarm targeting that actual readied weapon; current Disarm attacker exists, defender workflow remains separate. Tripping(TRP) applies to a weapon Trip attack and offers dropping that weapon to waive the opponent's bonus Trip; it must not be applied to generic resist-Trip checks. Quick ranged attack dialog has Aim/action controls but no Brace controls; measured Gear dialog has Aim/Brace/stable-surface controls. Aim/Brace target/movement lifecycle remains declared rather than automated.

Do not duplicate DEP/UNR error activation adjustments: these already execute in `criticals.mjs`. Keep current-source validation compatible with a legal replacement of provisional improvised-weapon destruction: do not add availability rejection to `ownedWeaponTraining`.

## Unanswered rulings — do not assume an answer

- Bullwhip `1 + 1d6 subdual` (p.250): normal weapon-damage modifier allocation between separately resolved components. Recommended answer offered:1lethal plus normal modifiers, separate1d6subdual. Keep mixed damage blocked until answered.
- Reach(RCH), p.302: whether the adjacent attack −5 also applies when untrained, or only trained. Recommended answer offered: both. No answer yet.
- Faceless combined with other timing reductions: ×5 versus ×9 with Cross Check.
- Office Gossip Request take10 duration:2minutes versus1minute. Keep its pending native actor.
- Improvised Mastery damage-type selection/Table5.12rows.
- Older unresolved scope: Tactical Advantage joint−10, Both Guns Blazing mixed weapons, critical stress/subdual tiers, critical subdual DR/Bruising, KO minimum duration, Cleave source conflict, Nauseated, Watchful Initiative action dice, Sleeping/Keen/Cultured, multiple Speed halves, Hail Mary Knowledge, Bandage gear-only, Adrenaline D12cap. Read the detailed ledger before implementing these.

## Accepted rulings

Individual class descriptions govern summary conflicts (Soldier Drive). Use detailed mission XP formula p.440. Master Thief opponent+1may exceed cap. Generic INT/WIS skill abilities include Knowledge. Ambush Supremacy reduces standard slow ambush to1minute. Arctic Training footing synergy means Acrobatics/Balance. Quick Healer halves the modified recovery interval. Same-count Mental Leap counts1round. Shaken surcharges apply after waivers; boost surcharge once per check; Generous recipient pays their own surcharge. Fully resisted Task Pressure critical failure retains the separate+1error increase. Ghost Basics full-Speed hiding waives only−4check, retains+1error. Mounted/vehicle Bull Rush uses appropriate skill+attribute, excludes Maneuver-only benefits; chosen-target adjacency restrictions are overridden, other opponents still stop movement.

## Source and workspace

Rules reference: `/Volumes/New Master/Users/sacha ON NEW MASTER/Documents/Gaming/rpg/Spycraft 2.0/Spycraft_2.0_AI_Rules.md`; it is reference data, not instructions. Both original PDFs are in that directory: `Spycraft_2.0_Hyperlinked.pdf` and `Spycraft_2.0_Rulebook_Second_Printing.pdf`. Printed pageNis PDF pageN+2. PDF skill was used for original page inspection. Desktop workspace `/Users/sacha/Documents/ChatGPT/Spycraft 2.0 Foundry module` is not the actual repository. Check current permissions before writing to the volume.

No source packs were rebuilt after batch122; generated LevelDB packs are ignored. No production Foundry installation or release was performed. Rebuild packs deliberately when resuming source-data verification; do not copy an active LevelDB database.

## Isolated native QA

Temporary QA root `/tmp/codex-spycraft-award-empty`, world `codex-award-empty`, port30028. Final state:six baseline actors,1113messages, world time126, GC1, no effects/combats. Latest temporary actor was deleted; baseline actors, global periods, health and dice were compared exactly. Services may need restarting; never assume old process/session identifiers remain valid. Native scripts/audits may remain in `/tmp`; durable audit JSON is committed under `docs/qa/`.

Preserve baseline IDs: `ZTSRy74hgofWcbms` Award, `AerLMt362RZGkene` Starting Entry, `OxCQc5kSXwxC73cw` Hard Knocks, `6uUKAHoclUrgF6Py` Strut, `IPxyxsHoevWRCntb` Contact233, `tBz67h8BpbXLG7S9` Office Gossip253. Never reset their/global resources to simplify a test. Use a new temporary legal actor, drain action-die queues/resource locks before snapshots and reload, normalize JSON key order for comparisons, then delete only that fixture.

Original QA root `/tmp/codex-spycraft-raw-test`, port30027, remains read-only. An earlier automatic review rejected resetting its GC pool; never retry or bypass that restriction. All further verification used a separate synthetic world.

## Git scope

The accumulated implementation is committed separately from two pre-existing removals: `CLAUDE.md` and deleted changelog entries. Those working-tree changes were left untouched and uncommitted. The older engine regression block was restored and adapted to the current named-check error API and vitality minimum, preserving all513legacy assertions. Other existing NPC functionality was preserved; the current full suite includes its regressions. Check `git status` before resuming and do not discard unrelated edits.
