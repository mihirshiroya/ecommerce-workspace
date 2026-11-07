const fs = require("fs"),
  JSZip = require("../Backend/node_modules/jszip"),
  { XMLParser } = require("../Backend/node_modules/fast-xml-parser");
(async () => {
  for (const file of fs
    .readdirSync("data")
    .filter((f) => f.endsWith(".xlsx"))) {
    const z = await JSZip.loadAsync(fs.readFileSync("data/" + file)),
      xml = await z.file("xl/worksheets/sheet2.xml").async("string");
    console.log(file);
    console.log(xml.match(/<extLst>[\s\S]*?<\/extLst>/)?.[0]);
    console.log(xml.match(/<dataValidations[\s\S]*?<\/dataValidations>/)?.[0]);
  }
})();
