const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/routes/_app.bills.$id.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  '                      {it.qty}',
  '                      {it.qty} {it.unitSold && it.unitSold !== "Tablet" && it.unitSold !== "Unit" ? (it.qty > 1 ? it.unitSold + "es" : it.unitSold).replace("es", "s").replace("Boxs", "Boxes") : ""}'
);

fs.writeFileSync(filePath, content);
console.log('Fixed _app.bills.$id.tsx');
