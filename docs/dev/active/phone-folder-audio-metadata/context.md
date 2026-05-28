# Phone folder audio + metadata context

Marie clarified that the phone app should stay simple:

- Open a synced Proof or Quill project.
- Pick one local audio folder/files for that project.
- Match audio by the file names already synced from the desktop.
- Audio files stay local to the phone.
- Proof saves flags with page, timestamp, narrator, type, quote, and note.
- Quill saves annotations with the same practical metadata needed for phone export.
- Both phone modes should export CSV.

Current inspection on 2026-05-27:

- Proof phone already has a book-level audio folder picker, local audio matching, player speed controls, sync toggle, flag fields, pending flag queue, and CSV export.
- Quill phone already has project/chapter list, annotations, and CSV export.
- Quill phone is missing project-level audio folder matching, a player, sync highlight, and timestamp capture for new annotations.

Important source rules:

- Do not upload audio to Supabase.
- Do not create duplicate reader/audio concepts.
- Use existing `PhoneReader`, `PhoneAudioDock`, and `audioLibrary` helpers.
- Phone cannot transcribe.
