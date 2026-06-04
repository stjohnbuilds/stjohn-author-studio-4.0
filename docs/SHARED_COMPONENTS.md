# Shared components — cheat sheet

**Rule:** if a mode needs a piece of UI that another mode already has,
import it from `app/components/` or `packages/`. **Never** write a fresh
inline copy in the mode file.

The whole point of v4.0 is "fix once, fixed everywhere." Every time a
session adds an inline `function SomeMode_BookDetail(...)` instead of
importing `BookDetail`, Marie ends up bug-hunting four copies. The
`.claude/hooks/build-checker.sh` post-edit hook warns when this
happens.

If a shared component doesn't have the shape you need, **extend it
with a new prop or a slot** — don't fork it. Slots beat new props for
mode-specific extras (Proof audio queue, Duet scan navigator, etc.).

---

## Component map

| Component | File | Used by | Purpose |
|---|---|---|---|
| `BookDetail`, `ChapterRow` | `app/components/BookDetail.js` | Quill. Duet + Proof migration pending (see TODO). | The "click into a book" page. Sticky title bar, optional action button row, chapter list, optional pre/post panels, optional delete. Chapter rows via `<ChapterRow />` or custom children. |
| `ChapterReader`, `getChapterReaderWordEl`, `computeChapterReaderPopoverPos` | `app/components/ChapterReader.js` | Quill. Proof migration pending (see TODO). | The shared manuscript reader. Owns: sticky bar (chapter X of N + prev/next + save badge + custom action slot), centered paper at `READER_WIDTH`, HTML walker, word splitter, controlled selection state + floating action-button overlay in the line's left margin, bottom dock slot. Modes pass `unitDecoration(idx)` for per-word styling and `onUnitPointerDown` / `onUnitPointerEnter` / `onUnitDoubleClick` for interaction. **Prep and Duet do NOT use this** — Prep operates on dialogue spans (different unit), Duet is read-only block-display (different rendering model). |
| `ImportFlow`, `parseChaptersFromHtml` | `app/components/ImportFlow.js` | Prep, Duet, Quill. Proof has its own `ManuscriptSetup` — migration pending. | The .docx upload + chapter-picker flow. Props: heading, accent, allowSceneSplitting, defaultSplitScenes, defaultChapterLevel, initialTitle. |
| `StickyTopBar`, `HomeBackPill`, `SaveBadge`, `ChapterContextPill`, `HomePill` | `app/components/ReaderChrome.js` | Quill, Prep, Duet (StickyTopBar). Proof still inline. | Top-of-screen nav primitives. Same shape across modes. |
| `MODE_TOKENS`, `pickContrastText`, `topBtnStyle`, `pillBtnStyle` | `app/components/ReaderChrome.js` | All four modes. | Per-mode pastel palette (`ink` / `accent` / `pastel`), button factories, contrast-aware text picker. |
| `READER_WIDTH`, `READER_PAGE_BG`, `READER_FONT_SIZE`, `READER_LINE_HEIGHT`, `HOME_CONTAINER` | `app/components/ReaderChrome.js` | Quill, Prep. Duet + Proof should switch when their readers move into the shared chrome. | Shared paper dimensions / typography. |
| `useDismissable` | `app/components/ReaderChrome.js` | Quill (popover), Prep (popovers). | Close-on-outside-click + Escape for any popover / inline editor. |
| `AppDialog` | `app/components/AppDialog.js` | Quill About, Proof About, Duet About, Prep About, Transfer Notice, Tutorial Start, Tutorial Wrap-Up (any new fixed-position modal). | Accessible modal primitive: `role="dialog"` + `aria-modal="true"`, optional `aria-labelledby` (via `titleId`) or `aria-label`, Escape close, configurable click-outside close, Tab/Shift+Tab focus trap, auto-focus on open, focus return to opener on close. Style is pass-through via `containerStyle` (backdrop) and `panelStyle` (inner panel) so each mode keeps its own look. |
| `idsForAnnotationBundle` | `packages/quill-engine/annotations.js` | Quill delete paths. | Given a main Quill annotation, returns the set of ids to drop together: the annotation itself plus any same-section/same-range character markers. Keeps load/save/delete agreeing on what counts as one annotation bundle. |
| `isSafeBookId` | `app/page.js` | Proof `importBooks`. | Mirrors `main.js safeJoinInsideDir`'s rejection rules on the renderer side so a backup import with a poisoned id (`../`, path separators, scheme-like prefix, null byte, non-string non-number) gets regenerated with a fresh `Date.now()`-style id at the boundary instead of being persisted and failing later. |
| `assertResolvedInsideDir`, `safeJoinInsideDir` | `main.js` (Electron main process) | `getManuscriptSourcePath`, transfer-import path rewrites. | Path-boundary helpers that reject `..` segments, absolute paths, scheme-like inputs, and null bytes, then assert the resolved path stays inside the given root. Use these for any file path built from data that came from outside the app (imported books, transfer manifests, IPC payloads). |
| `PinnedTabPanel` | `app/components/ReaderChrome.js` | New shared tab container. SessionsView still inlines the pattern; future tab UI should use this. | Tab strip pinned to the top of a flex-column container, content scrolls below — prevents the "Nav/Queue strip jumps" bug. Props: `tabs`, `active`, `onChange`, `tone`, `minHeight`, `maxHeight`, `style`. Build-checker soft-warns when a mode file adds new `*Tab` state + ternary render without it. |
| `getSupabaseClient`, `pushQuillProject`, `pullQuillProjects`, `deleteQuillProject`, `signIn`, `signUp`, `signOut`, `forgotPassword`, `resendConfirmation` | `packages/cloud-sync/` | Login screen (`account.js`), Quill (`quill-sync.js`). | The one Supabase client and account helpers + per-table CRUD. **Every Supabase call must go through this package.** |
| `stripAudioPaths` (audio guard) | `packages/cloud-sync/audio-guard.js` | Quill sync. Will gate Proof + Prep sync when those land. | Removes audio file paths before any upload. Audio NEVER touches Supabase. |
| Quill annotation engine: `htmlToPlainText`, `buildWordSpans`, `buildSelectionTextContext`, `BASE_ANNOTATION_CLASSES`, `getAnnotationClassTree`, `createCustomOption`, `resolveAnnotationSelection`, `createAnnotation`, `buildAnnotationsCsv`, `buildInDesignJsx` | `packages/quill-engine/` | Quill desktop + (future) phone Quill. | Word splitting, annotation tree, CSV / InDesign exporters. |
| Manuscript engine: `detectDialogueSpansInHtml`, `stripHtml` | `packages/manuscript-engine/` | Prep. | Dialogue detection + safe HTML→text. |

## What's NOT shared yet (and probably should be)

These are tracked in `TODO.md` as next-session refactors:

- **Reader (Proof migration)** — Quill uses `<ChapterReader>` as of 2026-05-24. Proof still has its own `ProofingReader.js` (1546 lines, audio sync + flag tapping) and is logged for next-session migration; high risk because it's Marie's anchor mode. Prep and Duet stay on their own readers permanently because their interaction models are structurally different (Prep = dialogue spans, Duet = read-only block highlights).
- **Phone reader** — `app/phone/_components/PhoneReader.js` is a separate component from the desktop `<ChapterReader>`. The build plan's "one shared reader" target hasn't reached the phone yet. Don't claim a `packages/reader-engine/` or `app/components/Reader/` exists — neither does today.
- **Home view** — each mode has its own project-list page. Quill's is the simplest. Extract a `ModeHome` component using Quill as the baseline.
- **Confirm dialogs** — every mode uses `window.confirm()`. The new `<AppDialog>` (added Block 9, 2026-06-03) is the accessible modal primitive; a future `<ConfirmDialog />` could compose on top of it.

## How to extend (instead of fork)

If `BookDetail` doesn't fit, your first instinct should be one of:

1. **Add a prop** — small, well-named, single purpose. E.g. `subtitle`, `actionButtons`, `onBackHome`.
2. **Add a slot** — `prePanels`, `postPanels`, or `children` for mode-specific blocks. Slots are how Proof's audio queue and Duet's scan navigator will fit without bloating BookDetail itself.
3. **Compose with the helpers** — `MODE_TOKENS[tone]`, `topBtnStyle(tone, 'solid')`, `pickContrastText(bg)`, `<SaveBadge tone={tone} />`. Most mode-specific visual differences are already one prop away.

**Don't:**
- Copy the file and rename it (e.g. `QuillBookDetail.js` next to `BookDetail.js`).
- Add an `if (tone === 'quill')` branch — that's a fork dressed up as a prop.
- Reinvent the sticky bar / pill / save badge inline because the import "felt heavy."

If you genuinely need something the shared component can't do, **add it to this list** in the same commit so future sessions can find it.
