import fs from "fs";
import vm from "vm";

const code = fs.readFileSync("src/routes/bills.js", "utf8");
const lines = code.split("\n");

for (let i = 1; i <= lines.length; i++) {
  const snippet = lines.slice(0, i).join("\n");
  try {
    new vm.Script(snippet);
  } catch (err) {
    if (!err.message.includes("Unexpected end of input") && !err.message.includes("Unexpected token")) {
      console.log(`Line ${i} error: ${err.message}`);
    }
  }
}
