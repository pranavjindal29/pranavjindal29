import fs from "node:fs/promises";

const filePath = process.argv[2];
const lineColor = process.argv[3];

if (!filePath || !lineColor) {
  console.error("Usage: node scripts/tint-github-activity-graph.mjs <file> <lineColor>");
  process.exit(1);
}

async function main() {
  const svg = await fs.readFile(filePath, "utf8");
  const updatedSvg = svg.replace(
    /(\.ct-line\s*\{[\s\S]*?stroke:\s*)#[0-9a-fA-F]+(;[\s\S]*?\})/,
    `$1${lineColor}$2`,
  );

  await fs.writeFile(filePath, updatedSvg, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
