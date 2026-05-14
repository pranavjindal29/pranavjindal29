import fs from "node:fs/promises";

const filePath = process.argv[2];
const accentColor = process.argv[3];
const borderColor = process.argv[4] ?? "#d0d7de";

if (!filePath || !accentColor) {
  console.error("Usage: node scripts/tint-github-activity-graph.mjs <file> <accentColor> [borderColor]");
  process.exit(1);
}

async function main() {
  const svg = await fs.readFile(filePath, "utf8");
  const updatedSvg = svg
    .replace(
      /(\n\s*\.ct-point\s*\{[^}]*?stroke:\s*)#[0-9a-fA-F]+(;)/,
      `$1${accentColor}$2`,
    )
    .replace(
      /(\n\s*\.ct-line\s*\{[^}]*?stroke:\s*)#[0-9a-fA-F]+(;)/,
      `$1${accentColor}$2`,
    )
    .replace(
      /(\n\s*\.ct-series-a \.ct-area,\s*[\s\S]*?fill:\s*)#[0-9a-fA-F]+(;)/,
      `$1${accentColor}$2`,
    )
    .replace(
      /(<rect[^>]*data-testid="card_bg"[^>]*rx=")([^"]*)(")/,
      `$112$3`,
    )
    .replace(/(style=")stroke:#(?:[0-9a-fA-F]{4}|[0-9a-fA-F]{6})(; stroke-width:1;")/, `$1stroke:${borderColor}$2`);

  await fs.writeFile(filePath, updatedSvg, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
