// CSV + InDesign exporters. Ported from the quill-and-ink alpha at
// packages/exporters/src/csv/build-csv.js and packages/exporters/src/indesign/build-jsx.js.
//
// The InDesign script is what Marie opens in InDesign and runs against
// the matching layout — it walks the document with GREP search, applies
// a character style per annotation, and inserts [INSERT IMG] / [name]
// markers where needed.

import { buildSelectionTextContext, buildWordSpans, htmlToPlainText } from './normalize.js';

export function buildAnnotationsCsv(project) {
  const rows = [
    ['Project', 'Section', 'Type', 'Selected Text', 'Timestamp', 'Note'],
    ...(project.annotations || []).map((annotation) => [
      project.title || '',
      annotation.sectionTitle || project.chapters?.[0]?.title || '',
      annotation.label || '',
      annotation.selectedText || '',
      Number.isFinite(annotation.timestamp) ? annotation.timestamp.toFixed(2) : '',
      annotation.note || '',
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function scriptString(value) {
  return JSON.stringify(String(value || ''));
}

function sourceTextForAnnotation(project, annotation) {
  const chapters = Array.isArray(project.chapters) ? project.chapters : [];
  const source = chapters.find((chapter) => chapter.id && chapter.id === annotation.sectionId)
    || (Number.isFinite(Number(annotation.chapterNumber)) ? chapters[Math.max(0, Number(annotation.chapterNumber) - 1)] : null)
    || chapters[0]
    || null;
  if (!source) return '';
  return source.plainText || htmlToPlainText(source.textHtml || source.html || '');
}

function enrichAnnotationContext(project, annotation) {
  if (annotation?.textContext?.phrase && annotation?.textContext?.target) return annotation;
  const source = sourceTextForAnnotation(project, annotation);
  if (!source) return annotation;
  const textContext = buildSelectionTextContext(
    source,
    buildWordSpans(source),
    annotation.wordStart,
    annotation.wordEnd ?? annotation.wordStart
  );
  return textContext ? { ...annotation, textContext } : annotation;
}

export function buildInDesignJsx(project) {
  const annotations = Array.isArray(project.annotations)
    ? project.annotations.map((annotation) => enrichAnnotationContext(project, annotation))
    : [];
  annotations.sort((a, b) => (
    (Number(a.chapterNumber || 0) - Number(b.chapterNumber || 0))
    || (Number(a.wordStart || 0) - Number(b.wordStart || 0))
    || String(a.id || '').localeCompare(String(b.id || ''))
  ));

  const annotationsJson = JSON.stringify(annotations, null, 2);
  const projectTitle = scriptString(project.title || 'Untitled');

  return `// Quill and Ink Design Studio InDesign annotation applier
// Project: ${project.title || 'Untitled'}
// Open the matching InDesign document, then run this script.

(function () {
  var projectTitle = ${projectTitle};
  var lovewornAnnotations = ${annotationsJson};

  if (app.documents.length === 0) {
    alert("Open the matching InDesign document before running this Quill and Ink script.");
    return;
  }

  var doc = app.activeDocument;
  var placed = 0;
  var missing = [];
  var ambiguous = [];
  var used = {};
  var lastRangeKey = "";
  var lastTarget = null;

  function cleanName(value) {
    var text = String(value || "Annotation");
    var invalid = "\\\\/:*?\\"<>|";
    for (var n = 0; n < invalid.length; n += 1) {
      text = text.split(invalid.charAt(n)).join(" ");
    }
    return text.replace(/^\\s+/, "").replace(/\\s+$/, "");
  }

  function hexToRgb(hex) {
    var clean = String(hex || "#c66f8d").replace("#", "");
    if (clean.length !== 6) clean = "c66f8d";
    return [
      parseInt(clean.substr(0, 2), 16),
      parseInt(clean.substr(2, 2), 16),
      parseInt(clean.substr(4, 2), 16)
    ];
  }

  function getColor(name, hex) {
    var colorName = cleanName(name);
    var rgb = hexToRgb(hex);
    var color = doc.colors.itemByName(colorName);
    try {
      color.name;
      color.colorValue = rgb;
      return color;
    } catch (error) {
      return doc.colors.add({
        name: colorName,
        model: ColorModel.PROCESS,
        space: ColorSpace.RGB,
        colorValue: rgb
      });
    }
  }

  function isImageAnnotation(annotation) {
    return annotation.classId === "image" || annotation.classId === "small-image" || annotation.classId === "full-page-spread";
  }

  function isCharacterAnnotation(annotation) {
    return annotation.classId === "character" || annotation.markerOnly === true;
  }

  function annotationRangeKey(annotation) {
    return [
      annotation.sectionId || annotation.sectionTitle || "",
      annotation.chapterNumber || "",
      annotation.wordStart || 0,
      annotation.wordEnd || annotation.wordStart || 0,
      annotation.selectedText || ""
    ].join(":");
  }

  function relatedCharacterLabel(annotation) {
    var rangeKey = annotationRangeKey(annotation);
    if (!rangeKey) return "";
    var names = [];
    for (var r = 0; r < lovewornAnnotations.length; r += 1) {
      var item = lovewornAnnotations[r];
      if (!isCharacterAnnotation(item) || annotationRangeKey(item) !== rangeKey) continue;
      var label = item.optionLabel || item.label || "";
      if (label) names.push(label);
    }
    return names.join(" + ");
  }

  function styleLabel(annotation) {
    if (isImageAnnotation(annotation)) return "Image";
    if (annotation.classId === "highlight") return "Highlight";
    if (annotation.classId === "character") return "Character > " + (annotation.optionLabel || annotation.label || "Character");
    if (annotation.classId === "emotion") {
      var emotionLabel = annotation.optionLabel || annotation.label || annotation.classLabel || "Emotion";
      var characterLabel = relatedCharacterLabel(annotation);
      return "E > " + emotionLabel + (characterLabel ? " > " + characterLabel : "");
    }
    return annotation.optionLabel || annotation.label || annotation.classLabel || "Annotation";
  }

  function trySet(target, values) {
    for (var key in values) {
      if (!values.hasOwnProperty(key)) continue;
      try { target[key] = values[key]; } catch (error) {}
    }
  }

  function getCharacterStyle(annotation) {
    var label = styleLabel(annotation);
    var styleName = cleanName(label);
    var style = doc.characterStyles.itemByName(styleName);
    var color = getColor(label, annotation.color);
    try { style.name; } catch (error) {
      style = doc.characterStyles.add({ name: styleName });
    }
    if (annotation.classId === "highlight") {
      trySet(style, { pointSize: 16, underline: true, underlineColor: color, underlineWeight: 8, underlineOffset: -3 });
    } else {
      trySet(style, { pointSize: 16, fillColor: color, underline: false, underlineWeight: 1, underlineOffset: 0 });
    }
    return style;
  }

  function getImageMarkerStyle() {
    var styleName = "Image";
    var color = getColor("Image", "#d82828");
    var style = doc.characterStyles.itemByName(styleName);
    try { style.name; } catch (error) {
      style = doc.characterStyles.add({ name: styleName });
    }
    trySet(style, { pointSize: 16, fillColor: color, underline: false, underlineWeight: 1, underlineOffset: 0 });
    return { style: style, color: color };
  }

  function annotationName(annotation) {
    var parts = [];
    if (annotation.classLabel) parts.push(annotation.classLabel);
    if (annotation.optionLabel && annotation.optionLabel !== annotation.classLabel) parts.push(annotation.optionLabel);
    if (!parts.length && annotation.label) parts.push(annotation.label);
    return parts.join(" / ") || "Annotation";
  }

  function shortText(text, limit) {
    var value = String(text || "").replace(/\\s+/g, " ");
    if (value.length <= limit) return value;
    return value.substr(0, limit - 3) + "...";
  }

  function escapeGrep(text) {
    return String(text || "")
      .replace(/[\\\\^$.*+?()[\\]{}|]/g, "\\\\$&")
      .replace(/\\s+/g, "\\\\s+");
  }

  function clearFind() {
    app.findGrepPreferences = NothingEnum.NOTHING;
    app.changeGrepPreferences = NothingEnum.NOTHING;
  }

  function matchKey(item, duplicateIndex) {
    try { return item.parentStory.id + ":" + item.index + ":" + item.length; }
    catch (error) { return item.contents + ":" + duplicateIndex; }
  }

  function contextScore(item, annotation) {
    var score = 0;
    try {
      var story = item.parentStory;
      var start = Math.max(0, item.index - 3000);
      var before = story.characters.itemByRange(start, Math.max(start, item.index - 1)).contents.toLowerCase();
      var sectionTitle = String(annotation.sectionTitle || "").toLowerCase();
      var chapterText = annotation.chapterNumber ? ("chapter " + annotation.chapterNumber) : "";
      if (sectionTitle && before.lastIndexOf(sectionTitle) !== -1) score += 20;
      if (chapterText && before.lastIndexOf(chapterText) !== -1) score += 10;
    } catch (error) {}
    return score;
  }

  function chooseMatch(matches, annotation) {
    var best = null;
    var bestKey = "";
    var bestScore = -1;
    for (var m = 0; m < matches.length; m += 1) {
      var key = matchKey(matches[m], m);
      if (used[key]) continue;
      var score = contextScore(matches[m], annotation);
      if (!best || score > bestScore) {
        best = matches[m];
        bestKey = key;
        bestScore = score;
      }
    }
    if (!best) best = matches[0];
    used[bestKey || matchKey(best, 0)] = true;
    return best;
  }

  function tagTarget(target, annotation) {
    try {
      if (target.insertLabel) {
        target.insertLabel("QuillAndInkAnnotationId", String(annotation.id || ""));
        target.insertLabel("QuillAndInkAnnotation", annotationName(annotation));
        target.insertLabel("QuillAndInkNote", String(annotation.note || ""));
      }
    } catch (error) {}
  }

  function sanitizeMarkerText(text) {
    return String(text || "").replace(/[\\r\\n]+/g, " ").replace(/^\\s+/, "").replace(/\\s+$/, "");
  }

  function markerText(annotation) {
    var noteText = sanitizeMarkerText(annotation.note || "");
    if (isImageAnnotation(annotation)) {
      var imageLabel = annotation.optionId === "image-full-spread" || annotation.classId === "full-page-spread"
        ? "INSERT FULL SPREAD"
        : "INSERT IMG";
      return "[" + imageLabel + (noteText ? ": " + noteText : "") + "]";
    }
    if (isCharacterAnnotation(annotation)) {
      return "[" + sanitizeMarkerText(annotation.optionLabel || annotation.label || "CHARACTER") + "]";
    }
    if (noteText) return "[" + noteText + "]";
    return "";
  }

  function insertStyledAfter(target, text, style, overrides) {
    if (!text) return null;
    try {
      var story = target.parentStory;
      var start = target.index + target.length;
      var marker = " " + text;
      target.insertionPoints.item(-1).contents = marker;
      var inserted = story.characters.itemByRange(start, start + marker.length - 1);
      inserted.appliedCharacterStyle = style;
      if (overrides) trySet(inserted, overrides);
      return inserted;
    } catch (error) { return null; }
  }

  function forceTextRangeStyle(textRange, style, overrides) {
    if (!textRange) return;
    try { textRange.appliedCharacterStyle = style; } catch (error) {}
    if (overrides) trySet(textRange, overrides);
    try {
      for (var c = 0; c < textRange.characters.length; c += 1) {
        var character = textRange.characters.item(c);
        try { character.appliedCharacterStyle = style; } catch (styleError) {}
        if (overrides) trySet(character, overrides);
      }
    } catch (error) {}
  }

  function forceAllImageMarkerStyles() {
    var imageMarkerStyle = getImageMarkerStyle();
    clearFind();
    try {
      app.findGrepPreferences.findWhat = "\\\\[INSERT (IMG|FULL SPREAD)[^\\\\]]*\\\\]";
      var markers = doc.findGrep();
      for (var m = 0; m < markers.length; m += 1) {
        forceTextRangeStyle(markers[m], imageMarkerStyle.style, { pointSize: 16, fillColor: imageMarkerStyle.color, underline: false });
      }
    } catch (error) {}
    clearFind();
  }

  function applyAnnotation(target, annotation) {
    if (isImageAnnotation(annotation)) {
      var imageMarkerStyle = getImageMarkerStyle();
      var insertedMarker = insertStyledAfter(target, markerText(annotation), imageMarkerStyle.style, { pointSize: 16, fillColor: imageMarkerStyle.color, underline: false });
      forceTextRangeStyle(insertedMarker, imageMarkerStyle.style, { pointSize: 16, fillColor: imageMarkerStyle.color, underline: false });
      return;
    }
    var style = getCharacterStyle(annotation);
    if (isCharacterAnnotation(annotation)) {
      insertStyledAfter(target, markerText(annotation), style);
      return;
    }
    var originalFillColor = null;
    try { if (annotation.classId === "highlight") originalFillColor = target.fillColor; } catch (error) {}
    target.appliedCharacterStyle = style;
    try { if (annotation.classId === "highlight" && originalFillColor) target.fillColor = originalFillColor; } catch (error) {}
    insertStyledAfter(target, markerText(annotation), style);
  }

  function getTextContext(annotation) {
    var context = annotation.textContext || annotation.locatorContext || null;
    if (!context || !context.phrase || !context.target) return null;
    return context;
  }

  function findTextIndexes(haystack, needle) {
    var indexes = [];
    if (!haystack || !needle) return indexes;
    var start = 0;
    var index = haystack.indexOf(needle, start);
    while (index !== -1) {
      indexes.push(index);
      start = index + Math.max(1, needle.length);
      index = haystack.indexOf(needle, start);
    }
    return indexes;
  }

  function chooseClosestIndex(indexes, expected) {
    if (!indexes.length) return -1;
    var best = indexes[0];
    var bestDistance = Math.abs(best - expected);
    for (var x = 1; x < indexes.length; x += 1) {
      var distance = Math.abs(indexes[x] - expected);
      if (distance < bestDistance) {
        best = indexes[x];
        bestDistance = distance;
      }
    }
    return best;
  }

  function targetFromContextMatch(contextMatch, annotation) {
    var context = getTextContext(annotation);
    if (!context) return null;
    var contents = String(contextMatch.contents || "");
    var expected = parseInt(context.targetOffset, 10);
    if (isNaN(expected)) expected = String(context.before || "").length;
    var targetText = String(context.target || annotation.selectedText || "");
    var indexes = findTextIndexes(contents, targetText);
    if (!indexes.length && annotation.selectedText && annotation.selectedText !== targetText) {
      targetText = String(annotation.selectedText || "");
      indexes = findTextIndexes(contents, targetText);
    }
    var targetIndex = chooseClosestIndex(indexes, expected);
    if (targetIndex < 0) return null;
    try { return contextMatch.characters.itemByRange(targetIndex, targetIndex + targetText.length - 1); }
    catch (error) { return null; }
  }

  function findContextMatches(annotation) {
    var context = getTextContext(annotation);
    if (!context) return [];
    clearFind();
    app.findGrepPreferences.findWhat = escapeGrep(context.phrase);
    var contextMatches = doc.findGrep() || [];
    clearFind();
    var targets = [];
    for (var c = 0; c < contextMatches.length; c += 1) {
      var target = targetFromContextMatch(contextMatches[c], annotation);
      if (target) targets.push(target);
    }
    return targets;
  }

  function findSelectedTextMatches(text) {
    clearFind();
    app.findGrepPreferences.findWhat = escapeGrep(text);
    var found = doc.findGrep();
    clearFind();
    return found || [];
  }

  function findMatches(annotation) {
    var contextMatches = findContextMatches(annotation);
    if (contextMatches.length) return { matches: contextMatches, usedContext: true };
    return { matches: findSelectedTextMatches(annotation.selectedText || ""), usedContext: false };
  }

  if (!confirm("Apply " + lovewornAnnotations.length + " Quill and Ink annotations to the open InDesign document?")) {
    return;
  }

  for (var i = 0; i < lovewornAnnotations.length; i += 1) {
    var annotation = lovewornAnnotations[i];
    var text = annotation.selectedText || "";
    if (!text) { missing.push("(blank annotation " + (annotation.id || i) + ")"); continue; }

    var rangeKey = annotationRangeKey(annotation);
    var target = null;
    if (rangeKey && rangeKey === lastRangeKey && lastTarget) {
      target = lastTarget;
    } else {
      var result = findMatches(annotation);
      var matches = result.matches;
      if (!matches.length) { missing.push((annotation.sectionTitle || "Unknown section") + " - " + text); continue; }
      if (matches.length > 1) {
        ambiguous.push((annotation.sectionTitle || "Unknown section") + " - " + text + " (" + matches.length + (result.usedContext ? " context" : " text") + " matches)");
      }
      target = chooseMatch(matches, annotation);
      lastRangeKey = rangeKey;
      lastTarget = target;
    }
    applyAnnotation(target, annotation);
    tagTarget(target, annotation);
    placed += 1;
  }

  forceAllImageMarkerStyles();

  var message = "Quill and Ink annotations for " + projectTitle + "\\n\\n"
    + "Applied: " + placed + "\\n"
    + "Missing: " + missing.length + "\\n"
    + "Duplicate text matches: " + ambiguous.length;
  if (missing.length) {
    for (var missingIndex = 0; missingIndex < missing.length && missingIndex < 10; missingIndex += 1) {
      missing[missingIndex] = shortText(missing[missingIndex], 130);
    }
    message += "\\n\\nMissing first 10:\\n- " + missing.slice(0, 10).join("\\n- ");
  }
  if (ambiguous.length) {
    for (var duplicateIndex = 0; duplicateIndex < ambiguous.length && duplicateIndex < 10; duplicateIndex += 1) {
      ambiguous[duplicateIndex] = shortText(ambiguous[duplicateIndex], 130);
    }
    message += "\\n\\nDuplicate first 10:\\n- " + ambiguous.slice(0, 10).join("\\n- ");
  }
  alert(message);
}());
`;
}
