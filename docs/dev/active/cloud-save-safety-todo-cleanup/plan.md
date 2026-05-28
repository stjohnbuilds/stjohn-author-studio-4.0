# Cloud Save Safety + TODO Cleanup

## Goal

Make the active checklist truthful again and patch the next real cloud
save safety items without changing unrelated app behavior.

## Steps

1. Clean the active TODO list so completed emergency items are no longer
   labelled as blockers.
2. Strengthen Proof flag saves so desktop flag adds/deletes get the
   same single-row cloud safety queue as phone flags.
3. Use Quill row content hashes on pull so unchanged rows can safely
   keep known local data.
4. Update cloud docs / structure docs so the next AI does not work from
   stale “not built yet” notes.
5. Run tests and re-check source goals before handoff.

## Verification

- `npm run test`
- Code inspection of the edited cloud paths.
- No packaging unless code/tests are stable and Marie asks for a build.

