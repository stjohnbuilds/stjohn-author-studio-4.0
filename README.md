# StJohn Author Studio

Desktop app for preparing and proofing self-published audiobooks and special-edition print manuscripts, with a phone companion for two of its modes. Built on Electron and Next.js. Current version: 4.0.32.

## Modes

Four desktop modes, switched from one home screen:

- **Proof Listen** — listen to finished audiobook audio against the manuscript and flag mistakes.
- **Prep Manuscript** — assign dialogue to characters and narrators before recording; export a highlighted script and a narrator chapter list.
- **Duet Prep** — find and edit duet/engineer markers in audio.
- **Quill & Ink** — annotate a manuscript for special-edition print design and export it for page layout.

Two phone modes, each a companion to one desktop mode:

- **Script** — companion to Proof Listen. Read along and tap to add a flag.
- **Quill** — companion to Quill & Ink. Read along and tap to add an annotation.

All four desktop modes share one manuscript reader, one audio engine, and one cloud-sync path. Audio files never leave the device that played them.

## Running in development

```bash
npm install
npm run dev      # Next.js only, in a browser
npm start        # Next.js + Electron together, the full desktop app
npm test          # run the test suite
```

## Building and releasing

```bash
npm run whisper:model      # fetch the transcription model (first time / after a clean)
npm run ffmpeg:mac         # or ffmpeg:win — fetch the platform audio-check binary
npm run release:mac        # package the Mac app and copy it into the releases folder
npm run release:win        # package the Windows build and copy it into the releases folder
```

Packaged builds land in `Script and Sync Releases/` (the folder name is kept from an earlier product name; the files inside carry the current name, "StJohn Author Studio"). The previous release is archived into `Script and Sync Releases/Old/` first, never deleted.

Packaging alone does not make a build available to already-installed copies. That needs a separate publish of a GitHub Release in `stjohnbuilds/stjohn-author-studio-downloads` — the installed app's auto-updater only checks the newest published, non-draft release.

The same build also produces the phone companion's static web pages; deployed to the web, the site serves the phone companion at its root address instead of the desktop shell.

## Where user data lives

All project data is saved locally, to a folder chosen on first run (`Save Data/` by default) — never uploaded as a whole. A small Supabase cloud sync carries only text and metadata for Proof Listen and Quill & Ink (flags, annotations, project and chapter index) between desktop and phone. Prep Manuscript and Duet Prep are local-only. Audio files are never uploaded; only an audio file's name is synced, so a companion device can match its own local copy.

## Downloads and updates

Install: the Mac app lives in `/Applications/StJohn Author Studio.app` (a build also lands in `Script and Sync Releases/` next to the Windows installer). Once installed, the app checks the GitHub Releases of the downloads repository and updates itself when a newer version has been published there.
