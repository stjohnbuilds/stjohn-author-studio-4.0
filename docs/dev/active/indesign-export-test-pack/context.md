# Context

Marie asked for a few-page document to put into InDesign and identical
app code to try.

This is for testing the Quill & Ink InDesign export path. It should not
change app behavior or touch real project data.

Source rules checked:

- Quill & Ink annotations are exported by
  `packages/quill-engine/exporters.js`.
- The InDesign JSX should come from `buildInDesignJsx(project)`.
- The CSV should come from `buildAnnotationsCsv(project)`.
- No fake app data is being added to the app itself; this is an isolated
  test artifact.

