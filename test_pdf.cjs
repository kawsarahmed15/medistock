const { jsPDF } = require("jspdf");
const doc = new jsPDF({ unit: "pt", format: "a4" });
const address = "123 Pharmacy St\nCity, State 12345";
const addressLines = doc.splitTextToSize(address, 300);
console.log("addressLines:", addressLines);
doc.text(addressLines, 40, 50);
console.log("Success");
