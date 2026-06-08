const { contextBridge, ipcRenderer } = require('electron');

// Expose safe Electron APIs to the renderer
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  readData:       ()         => ipcRenderer.invoke('read-data'),
  writeData:      (books)    => ipcRenderer.invoke('write-data', books),
  readPrebuildData: ()       => ipcRenderer.invoke('read-prebuild-data'),
  writePrebuildData: (projects) => ipcRenderer.invoke('write-prebuild-data', projects),
  readPrepData:   ()         => ipcRenderer.invoke('read-prep-data'),
  writePrepData:  (projects) => ipcRenderer.invoke('write-prep-data', projects),
  readQuillData:  ()         => ipcRenderer.invoke('read-quill-data'),
  readQuillProjectList: ()   => ipcRenderer.invoke('read-quill-project-list'),
  readQuillProject: (id)     => ipcRenderer.invoke('read-quill-project', id),
  writeQuillData: (projects) => ipcRenderer.invoke('write-quill-data', projects),
  writeQuillProject: (project) => ipcRenderer.invoke('write-quill-project', project),
  deleteQuillProjectData: (id) => ipcRenderer.invoke('delete-quill-project-data', id),
  getDataLocation:()         => ipcRenderer.invoke('get-data-location'),
  chooseDataLocation:()      => ipcRenderer.invoke('choose-data-location'),
  openAudioDialog:(options)  => ipcRenderer.invoke('open-audio-dialog', options),
  getAudioUrl:    (path)     => ipcRenderer.invoke('get-audio-url', path),
  exportBackup:   (books)    => ipcRenderer.invoke('export-backup', books),
  importBackup:   ()         => ipcRenderer.invoke('import-backup'),
  exportCsv:      (args)     => ipcRenderer.invoke('export-csv', args),
  exportMarkersFolder:(args) => ipcRenderer.invoke('export-markers-folder', args),
  exportTransferBundle:(book) => ipcRenderer.invoke('export-transfer-bundle', book),
  importTransferBundle:()    => ipcRenderer.invoke('import-transfer-bundle'),
  readAudioFile:  (filePath) => ipcRenderer.invoke('read-audio-file', filePath),
  convertDocxToPdf:(args)    => ipcRenderer.invoke('convert-docx-to-pdf', args),
  convertDocxToPageMap:(args)=> ipcRenderer.invoke('convert-docx-to-page-map', args),
  extractPdfPaging:(args)    => ipcRenderer.invoke('extract-pdf-paging', args),
  saveManuscriptSource:(args)=> ipcRenderer.invoke('save-manuscript-source', args),
  rescanBookPdf:  (args)     => ipcRenderer.invoke('rescan-book-pdf', args),
  rescanBookPageMap:(args)   => ipcRenderer.invoke('rescan-book-page-map', args),
  // whisper.cpp native transcription
  whisperGetInfo:   ()       => ipcRenderer.invoke('whisper-get-info'),
  whisperSetArch:   (arch)   => ipcRenderer.invoke('whisper-set-arch', arch),
  whisperTranscribe:(args)   => ipcRenderer.invoke('whisper-transcribe', args),
  whisperCancel:    ()       => ipcRenderer.invoke('whisper-cancel'),
  onWhisperProgress:(cb)     => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('whisper-progress', handler);
    return () => ipcRenderer.removeListener('whisper-progress', handler);
  },
  onTransferProgress:(cb)    => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('transfer-progress', handler);
    return () => ipcRenderer.removeListener('transfer-progress', handler);
  },
  // Drive snapshot backups (Marie 2026-05-27).
  makeBackupSnapshot:(args)  => ipcRenderer.invoke('backup-make-snapshot', args),
  getBackupInfo:    ()       => ipcRenderer.invoke('backup-get-info'),
  pruneBackups:     (args)   => ipcRenderer.invoke('backup-prune', args),
  // Auto-update from GitHub Releases. The renderer subscribes to the
  // four lifecycle events (available / progress / downloaded / error)
  // and calls startUpdateDownload + installUpdateNow when the user
  // clicks. getVersionInfo populates the "v4.0.2 · built YYYY-MM-DD"
  // stamp at the bottom of the app.
  getVersionInfo:        ()  => ipcRenderer.invoke('app:get-version-info'),
  startUpdateDownload:   ()  => ipcRenderer.invoke('update:start-download'),
  installUpdateNow:      ()  => ipcRenderer.invoke('update:install-now'),
  onUpdateAvailable: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  onUpdateDownloaded: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  onUpdateError: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.removeListener('update:error', handler);
  },
});
