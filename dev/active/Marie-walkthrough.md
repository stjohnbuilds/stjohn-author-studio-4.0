# Marie's hands-on walkthrough — 2026-05-26

After today's fixes, here's a tight checklist to confirm everything
works on YOUR real files. Tick each one. If something feels off, stop
and message the AI — don't power through.

## Run the app

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```

Paste and hit Enter. Wait for the window.

---

## Quill (desktop)

1. **Sign in** with your real account (not dev-skip).
2. **Open Quill mode**.
3. **+ New project** → upload a .docx that has scenes (H2 sub-headings).
4. **Check the "Split scenes" toggle** at the top — flip it ON. Confirm the chapter list shows scene rows underneath each chapter, with the SCENE TITLES (e.g. character names), NOT "Beginning".
5. **Pick the chapters** you want, click Import & open.
6. On the book detail page, click **Edit book data**.
   - Untick a CHAPTER → save → it disappears from the chapter list AND the bulk audio dropdown.
   - Untick INDIVIDUAL SCENES (click the `▾ N/M scenes` badge next to a chapter to expand) → save → that scene drops out of the chapter view.
7. On the book detail page, **attach an audio file** to a chapter using Bulk audio.
8. **Close the app**. **Reopen it**. The audio file name should still be on the chapter; click to re-pick the actual file to play.
9. **Open a chapter** → reader appears. **Drag across some words** → annotation popover. Pick a class + option. Save.
10. The annotation appears in the sidebar list. Click it to jump back.

## Phone (browser, real account)

1. On your phone, open `https://stjohn-author-studio-4.vercel.app/` — you should land directly on the phone UI (no `/phone` in the URL bar).
2. Sign in with the SAME account you used on desktop.
3. Pick **Quill & Ink** from the service picker.
4. Your project from desktop should appear in the list.
5. **Tap a chapter**. The reader opens.
6. **Double-tap a word** → handles appear → drag to extend → tap `+` → write a note → save.
7. Go back to desktop. **Click Resync** (or reopen the project) — the annotation you made on phone should be in the sidebar.
8. Back on phone. On the chapter list, **tap the round ○ next to a chapter title** — it should fill with `✓` and the chapter title strikes through. That's the "done" mark.
9. Reload the phone — the tick should still be there.
10. On desktop, click Resync — the same chapter should now show as done in the side nav (✓).

## Proof (desktop)

1. Open Proof mode → open a book that has audio attached.
2. Open Edit book data → untick scenes the same way as in Quill above.
3. Tick chapters off as you finish proofing them (the round button next to each scene title).

## Stop signs

- "Beginning" should never appear as a row name.
- Untick + save should ALWAYS make the unticked thing disappear from every other UI on the same page (bulk audio dropdown, side nav, chapter list).
- A tick made on phone should show on desktop after Resync, and vice versa.
- Audio file names should survive a full app close + reopen.

## What's left after this run

If everything above passes, the last two items on the list are:

- **Reader code sharing cleanup** — extract the HTML walker into a shared util (still works fine without this, just removes duplicate code)
- **Windows installer** — build it last, when nothing else is in flight

If anything fails, screenshot it and send to the AI BEFORE moving on.
