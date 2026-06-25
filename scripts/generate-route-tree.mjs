import path from "node:path";
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const config = getConfig({}, root);

const generator = new Generator({
  config,
  root,
});

await generator.run();

const crawlingResult = await generator.getCrawlingResult();

if (!crawlingResult) {
  throw new Error("Route tree generation failed: crawling result was not produced.");
}

console.log(`Generated ${path.relative(root, config.generatedRouteTree)}`);