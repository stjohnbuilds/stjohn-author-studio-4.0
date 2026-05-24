# TODO — StJohn Author Studio 4.0

Active and recently archived tasks. Rules for this file are in
`CLAUDE.md` under "TODO.md rules".

## Active Tasks

### Phase 1 — Bootstrap (in progress)

- [x] Create `~/Dev/StJohn-Author-Studio-4.0/` and copy Script and Sync
      3.0 in as the base — completed 2026-05-23
- [x] Set up `.claude/` with scope-locked hooks per bible Step 2.5 —
      completed 2026-05-23
- [x] Write `CLAUDE.md` — completed 2026-05-23
- [ ] Write `docs/BUILD_PLAN_V4.md` — phased plan, definition of done
      per phase, shared-reader rule baked in.
- [ ] Write truth tree skeletons (`docs/FRONT_FUNCTION_TREE.md`,
      `docs/INTERNAL_FUNCTION_TREE.md`, `docs/WIRING_MATRIX.md`)
      populated from Script and Sync 3.0 as the baseline, with empty
      rows for Prep / Duet / Quill / Phone to fill in as each is added.

### Phase 2 — Git + GitHub

- [ ] `git init`, first commit "4.0 bootstrap from Script and Sync 3.0"
- [ ] Create GitHub repo `stjohn-author-studio-4.0`, push main
- [ ] Confirm hooks fire after the push (one entry in
      `.claude/hook-activity.log` for the next prompt cycle)

### Phase 3 — Archive the dead

(Marie has already said yes to all these.)

- [ ] Rename in Google Drive (add `-ARCHIVED-2026-05-23` suffix):
      - `StJohn Author Studio 2.0` (the failed rebuild)
      - `Script and Sync` (the older proofer — NOT the 3.0)
      - `Quill and Ink` (the alpha — port the parts we need first, then
        archive the standalone)
      - `Phone` (the standalone phone — port into 4.0 first)
- [ ] Archive matching GitHub repos (use `gh repo archive`).
- [ ] **Leave `Script and Sync 3.0` alone** — it's still our reference.

### Phase 4 — Rebrand the base

- [ ] Rename package: `script-and-sync` → `stjohn-author-studio-4.0` in
      `package.json` and any user-visible strings.
- [ ] Update Electron `productName`, app id, window title.
- [ ] Update the "READ ME FIRST" + build-script names.
- [ ] Update the home-screen mode switcher: today Script and Sync only
      shows one mode (Proof Listen). 4.0 needs the four-mode segmented
      switcher (we liked the colored tabs from the 2.0 rebuild).
- [ ] First Mac packaged build to confirm rebrand works end-to-end.

### Phase 5 — Mode 1: Proof Listen working on real file

- [ ] Mark every Proof Listen button as `verified live` in
      `WIRING_MATRIX.md` after Marie clicks it on her real audiobook.
- [ ] Confirm Save Data lands in the right folder.

### Phase 6 — Mode 2: Prep Manuscript

- [ ] Port from current `packages/manuscript-engine/` (real, working).
- [ ] Build the dialogue-assignment UI on top of the shared reader.
- [ ] Export highlighted DOCX + narrator chapter list.

### Phase 7 — Mode 3: Duet Prep

- [ ] Port marker logic from `Timestamp Finder Duet Edition 2.0`
      reference.
- [ ] Reuse shared reader + audio engine.

### Phase 8 — Mode 4: Quill & Ink

- [ ] Port annotation list UI (the + and edit icons Marie liked) from
      the alpha Quill reference.
- [ ] Reuse shared reader.
- [ ] Wire InDesign export.

### Phase 9 — Phone companion

- [ ] Port phone Next.js scaffold from
      `StJohn Author Apps/apps/phone` reference.
- [ ] Login (Supabase auth).
- [ ] Project list + chapter open + transcript text.
- [ ] Local audio picker + matching.
- [ ] Script flags + Quill annotations save to cloud.
- [ ] CSV export from phone.
- [ ] Deploy to Vercel.

### Phase 10 — Real-file end-to-end pass

- [ ] Marie runs every minimum-release check on her actual books +
      audiobooks. Every row in `WIRING_MATRIX.md` flips to
      `verified live`.
- [ ] Phone signed-in proof: real flag + real annotation saved from
      phone, seen on desktop.

### Phase 11 — Release

- [ ] Mac + Windows packaged builds.
- [ ] Phone deploy live.
- [ ] First user release.

## Archived

(empty — Phase 1 still in progress)
