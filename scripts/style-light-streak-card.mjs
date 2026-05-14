import fs from "node:fs/promises";

const filePath = process.argv[2];
const borderColor = process.argv[3] ?? "#d0d7de";

if (!filePath) {
  console.error("Usage: node scripts/style-light-streak-card.mjs <file> [borderColor]");
  process.exit(1);
}

async function main() {
  const svg = await fs.readFile(filePath, "utf8");
  const updatedSvg = svg.replace(
    /(<rect[^>]*?)stroke='#000000'([^>]*?)stroke-opacity='0'/,
    `$1stroke='${borderColor}'$2stroke-opacity='1'`,
  );

  await fs.writeFile(filePath, updatedSvg, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
