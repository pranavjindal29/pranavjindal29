import fs from "node:fs/promises";

const outputPath = process.argv[2] ?? "assets/github-stats.svg";
const username = process.argv[3] ?? "pranavjindal29";
const colorMode = process.argv[4] ?? "dark";
const statsYear = new Date().getUTCFullYear();

const themes = {
  dark: {
    background: "#1a1b27",
    divider: "#E4E2E2",
    title: "#bf91f3",
    value: "#70a5fd",
    label: "#38bdae",
  },
  light: {
    background: "#FFFEFE",
    divider: "#d0d7de",
    title: "#8250df",
    value: "#0969da",
    label: "#1a7f37",
  },
};

async function fetchJson(url, accept = "application/vnd.github+json") {
  const headers = {
    "User-Agent": "github-pulse-fallback-generator",
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.json();
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function renderMetric({ centerX, value, label, delay, theme }) {
  return `
    <g transform="translate(${centerX} 0)">
      <text
        x="0"
        y="106"
        text-anchor="middle"
        fill="${theme.value}"
        font-family="'Segoe UI', Ubuntu, Sans-Serif"
        font-size="29"
        font-weight="700"
        style="opacity: 0; animation: stat-pop 0.65s ease-out forwards ${delay}s"
      >${escapeXml(formatNumber(value))}</text>
      <text
        x="0"
        y="132"
        text-anchor="middle"
        fill="${theme.label}"
        font-family="'Segoe UI', Ubuntu, Sans-Serif"
        font-size="13"
        font-weight="500"
        style="opacity: 0; animation: fade-in-up 0.55s ease-out forwards ${(
          delay + 0.12
        ).toFixed(2)}s"
      >${escapeXml(label)}</text>
    </g>`;
}

async function main() {
  const theme = themes[colorMode] ?? themes.dark;
  const commitSearchUrl = new URL("https://api.github.com/search/commits");
  commitSearchUrl.searchParams.set(
    "q",
    `author:${username} author-date:${statsYear}-01-01..${statsYear}-12-31`,
  );
  commitSearchUrl.searchParams.set("per_page", "100");

  const [user, repos, commitSearch] = await Promise.all([
    fetchJson(`https://api.github.com/users/${username}`),
    fetchJson(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`),
    fetchJson(commitSearchUrl.toString(), "application/vnd.github.cloak-preview+json"),
  ]);

  const totalStars = repos
    .filter((repo) => !repo.fork)
    .reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const displayName = user.name || user.login;
  const yearlyCommits = commitSearch.total_count ?? 0;
  const contributedRepos = new Set(
    (commitSearch.items ?? []).map((item) => item.repository?.full_name).filter(Boolean),
  ).size;

  const svg = `<svg width="495" height="195" viewBox="0 0 495 195" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(displayName)} GitHub stats</title>
  <desc id="desc">Local ${escapeXml(colorMode)} GitHub stats card for ${escapeXml(displayName)}.</desc>
  <style>
    @keyframes fade-in-up {
      0% { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes stat-pop {
      0% { opacity: 0; transform: translateY(16px) scale(0.9); }
      70% { opacity: 1; transform: translateY(0) scale(1.05); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
  </style>
  <rect stroke="#000000" stroke-opacity="0" fill="${theme.background}" rx="4.5" x="0.5" y="0.5" width="494" height="194"/>
  <line x1="165" y1="28" x2="165" y2="170" stroke="${theme.divider}" stroke-width="1" style="opacity: 0; animation: fade-in-up 0.45s ease-out forwards 0.15s"/>
  <line x1="330" y1="28" x2="330" y2="170" stroke="${theme.divider}" stroke-width="1" style="opacity: 0; animation: fade-in-up 0.45s ease-out forwards 0.2s"/>
  <text
    x="247.5"
    y="42"
    text-anchor="middle"
    fill="${theme.title}"
    font-family="'Segoe UI', Ubuntu, Sans-Serif"
    font-size="16"
    font-weight="700"
    style="opacity: 0; animation: fade-in-up 0.5s ease-out forwards 0.1s"
  >GitHub Pulse</text>
  ${renderMetric({ centerX: 82.5, value: totalStars, label: "Total Stars", delay: 0.3, theme })}
  ${renderMetric({ centerX: 247.5, value: yearlyCommits, label: `${statsYear} Commits`, delay: 0.5, theme })}
  ${renderMetric({ centerX: 412.5, value: contributedRepos, label: "Contributed To", delay: 0.7, theme })}
</svg>
`;

  await fs.writeFile(outputPath, svg, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
