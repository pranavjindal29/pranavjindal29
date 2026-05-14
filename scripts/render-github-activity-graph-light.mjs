import fs from "node:fs/promises";

const inputPath = process.argv[2] ?? "assets/github-activity-graph.svg";
const outputPath = process.argv[3] ?? "assets/github-activity-graph-light.svg";

async function main() {
  const svg = await fs.readFile(inputPath, "utf8");

  const lightSvg = svg
    .replaceAll("#1a1b27", "#f7f9fc")
    .replaceAll("#70a5fd", "#0969da")
    .replaceAll("#a9b1d6", "#57606a")
    .replaceAll("#E4E2E2", "#d0d7de")
    .replaceAll("stroke:#0000;", "stroke:#d0d7de;");

  await fs.writeFile(outputPath, lightSvg, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
