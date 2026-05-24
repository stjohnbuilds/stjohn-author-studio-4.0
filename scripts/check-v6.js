const fs = require("fs");
const d = JSON.parse(fs.readFileSync("Save Data/books.json","utf8"));
const sec = d[0].chapters[0].sections[0];
const al = sec.whisperAlignment || [];
const ww = sec.whisperWords || [];

console.log("Alignment entries:", al.length);
console.log("Matched:", al.filter(Boolean).length);

for (let i = 0; i < 8; i++) {
  const m = al[i];
  if (m) {
    console.log(`al[${i}]: wordIdx=${m.wordIdx} word="${ww[m.wordIdx]?.word}" conf=${m.confidence?.toFixed(2)}`);
  } else {
    console.log(`al[${i}]: null`);
  }
}

console.log("");
const m1 = al[1];
if (m1 && m1.wordIdx === 1) {
  console.log(">>> v6 alignment IS saved - new code was used");
} else if (m1 && m1.wordIdx === 3) {
  console.log(">>> OLD alignment still saved - app did NOT pick up v6 code!");
  console.log(">>> You need to RESTART the app (close + npm start) then Re-align again");
} else {
  console.log(">>> Unknown alignment pattern - wordIdx=" + (m1?.wordIdx));
}
