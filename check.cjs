const fs = require("fs");
const db = JSON.parse(fs.readFileSync(".medistock/bills.json", "utf8"));

const d = new Date();
const monthStart1 = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

const d2 = new Date();
d2.setHours(0, 0, 0, 0);
d2.setDate(1);
const monthStart2 = d2.getTime();

const end = new Date();
end.setHours(23, 59, 59, 999);
const endT = end.getTime();

const bills1 = db.filter((b) => new Date(b.createdAt).getTime() >= monthStart1);
const bills2 = db.filter((b) => {
  const t = new Date(b.createdAt).getTime();
  return t >= monthStart2 && t <= endT;
});

const sales1 = bills1.reduce((s, b) => s + b.total, 0);
const sales2 = bills2.reduce((s, b) => s + b.total, 0);

console.log("Dashboard sales:", sales1);
console.log("Revenue sales:", sales2);
console.log("Dashboard count:", bills1.length);
console.log("Revenue count:", bills2.length);

const d3 = new Date();
d3.setHours(0, 0, 0, 0);
d3.setDate(d3.getDate() - 29);
const start30 = d3.getTime();
const bills30 = db.filter((b) => {
  const t = new Date(b.createdAt).getTime();
  return t >= start30 && t <= endT;
});
console.log(
  "30d sales:",
  bills30.reduce((s, b) => s + b.total, 0),
);
