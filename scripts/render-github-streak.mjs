import fs from "node:fs/promises";

const darkOutputPath = process.argv[2] ?? "assets/github-streak.svg";
const lightOutputPath = process.argv[3] ?? "assets/github-streak-light.svg";
const username = process.argv[4] ?? "pranavjindal29";
const today = new Date();
const todayString = formatIsoDate(today);

const themes = {
  dark: {
    background: "#1A1B27",
    border: "#000000",
    borderOpacity: "0",
    divider: "#E4E2E2",
    primary: "#70A5FD",
    accent: "#BF91F3",
    secondary: "#38BDAE",
  },
  light: {
    background: "#FFFEFE",
    border: "#d0d7de",
    borderOpacity: "1",
    divider: "#d0d7de",
    primary: "#151515",
    accent: "#FB8C00",
    secondary: "#464646",
  },
};

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatIsoDate(date);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripHtml(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(dateString, includeYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${dateString}T00:00:00Z`));
}

function formatRange(start, end, includeYear = true) {
  if (!start || !end) return "None yet";
  if (start === end) return formatDate(start, includeYear);

  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const sameYear = startYear === endYear;
  return `${formatDate(start, includeYear && !sameYear)} - ${formatDate(end, includeYear)}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchProfile() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-streak-card-generator",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  return fetchJson(`https://api.github.com/users/${username}`, {
    headers,
  });
}

async function fetchGraphqlYear(year) {
  const query = `
    query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;
  const endDate = year === today.getUTCFullYear() ? todayString : `${year}-12-31`;
  const data = await fetchJson("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "github-streak-card-generator",
    },
    body: JSON.stringify({
      query,
      variables: {
        login: username,
        from: `${year}-01-01T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
    }),
  });

  if (data.errors?.length) {
    throw new Error(data.errors.map((error) => error.message).join("; "));
  }

  const calendar = data.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error(`No contribution calendar returned for ${year}`);
  return calendar.weeks.flatMap((week) => week.contributionDays);
}

async function fetchPublicYear(year) {
  const url = `https://github.com/users/${username}/contributions?from=${year}-01-01&to=${year}-12-31`;
  const response = await fetch(url, {
    headers: { "User-Agent": "github-streak-card-generator" },
  });
  if (!response.ok) throw new Error(`Request failed for ${url}: ${response.status}`);
  const html = await response.text();
  const days = [];
  const dayPattern = /<td\b([^>]*)class="ContributionCalendar-day"[^>]*><\/td>\s*<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/g;

  for (const match of html.matchAll(dayPattern)) {
    const date = match[1].match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    if (!date || date > todayString || !date.startsWith(`${year}-`)) continue;
    const label = stripHtml(match[2]);
    const contributionCount = Number(label.match(/([\d,]+) contributions?/)?.[1].replaceAll(",", "") ?? 0);
    days.push({ date, contributionCount });
  }

  if (days.length === 0) throw new Error(`Could not parse contribution calendar for ${year}`);
  return days;
}

async function fetchContributionDays(firstYear) {
  const years = [];
  for (let year = firstYear; year <= today.getUTCFullYear(); year += 1) years.push(year);

  if (process.env.GITHUB_TOKEN) {
    try {
      return (await Promise.all(years.map(fetchGraphqlYear))).flat();
    } catch (error) {
      console.warn(`GitHub GraphQL failed; using the public contribution calendar: ${error.message}`);
    }
  }

  return (await Promise.all(years.map(fetchPublicYear))).flat();
}

function calculateStats(days, accountCreatedDate) {
  const counts = new Map(days.map((day) => [day.date, day.contributionCount]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  let longest = { count: 0, start: null, end: null };
  let runStart = null;
  let runCount = 0;

  for (let date = accountCreatedDate; date <= todayString; date = addUtcDays(date, 1)) {
    if ((counts.get(date) ?? 0) > 0) {
      runStart ??= date;
      runCount += 1;
      if (runCount > longest.count) longest = { count: runCount, start: runStart, end: date };
    } else {
      runStart = null;
      runCount = 0;
    }
  }

  let currentEnd = todayString;
  if ((counts.get(currentEnd) ?? 0) === 0) currentEnd = addUtcDays(currentEnd, -1);
  let currentStart = currentEnd;
  let currentCount = 0;
  while ((counts.get(currentStart) ?? 0) > 0) {
    currentCount += 1;
    currentStart = addUtcDays(currentStart, -1);
  }
  currentStart = currentCount > 0 ? addUtcDays(currentStart, 1) : null;

  return {
    total,
    longest,
    current: {
      count: currentCount,
      start: currentStart,
      end: currentCount > 0 ? currentEnd : todayString,
    },
  };
}

function renderCard({ displayName, accountCreatedDate, stats, themeName }) {
  const theme = themes[themeName];
  const totalRange = `${formatDate(accountCreatedDate, true)} - Present`;
  const currentRange = formatRange(stats.current.start ?? stats.current.end, stats.current.end, false);
  const longestRange = formatRange(stats.longest.start, stats.longest.end, true);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 495 195" width="495" height="195" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(displayName)} GitHub contribution streak</title>
  <desc id="desc">${stats.total.toLocaleString("en-US")} total contributions, a ${stats.current.count}-day current streak, and a ${stats.longest.count}-day longest streak.</desc>
  <style>
    @keyframes currstreak { 0% { font-size: 3px; opacity: 0.2; } 80% { font-size: 34px; opacity: 1; } 100% { font-size: 28px; opacity: 1; } }
    @keyframes fadein { 0% { opacity: 0; } 100% { opacity: 1; } }
  </style>
  <defs>
    <clipPath id="outer_rectangle"><rect width="495" height="195" rx="4.5"/></clipPath>
    <mask id="mask_out_ring_behind_fire"><rect width="495" height="195" fill="white"/><ellipse cx="247.5" cy="32" rx="13" ry="18" fill="black"/></mask>
  </defs>
  <g clip-path="url(#outer_rectangle)">
    <rect stroke="${theme.border}" stroke-opacity="${theme.borderOpacity}" fill="${theme.background}" rx="4.5" x="0.5" y="0.5" width="494" height="194"/>
    <line x1="165" y1="28" x2="165" y2="170" stroke-width="1" stroke="${theme.divider}"/>
    <line x1="330" y1="28" x2="330" y2="170" stroke-width="1" stroke="${theme.divider}"/>
    <g fill="${theme.primary}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif">
      <text x="82.5" y="80" font-size="28" font-weight="700" style="opacity:0;animation:fadein .5s linear forwards .6s">${escapeXml(stats.total.toLocaleString("en-US"))}</text>
      <text x="82.5" y="116" font-size="14" style="opacity:0;animation:fadein .5s linear forwards .7s">Total Contributions</text>
      <text x="412.5" y="80" font-size="28" font-weight="700" style="opacity:0;animation:fadein .5s linear forwards 1.2s">${stats.longest.count}</text>
      <text x="412.5" y="116" font-size="14" style="opacity:0;animation:fadein .5s linear forwards 1.3s">Longest Streak</text>
    </g>
    <g fill="${theme.secondary}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="12">
      <text x="82.5" y="146" style="opacity:0;animation:fadein .5s linear forwards .8s">${escapeXml(totalRange)}</text>
      <text x="247.5" y="166" style="opacity:0;animation:fadein .5s linear forwards .9s">${escapeXml(currentRange)}</text>
      <text x="412.5" y="146" style="opacity:0;animation:fadein .5s linear forwards 1.4s">${escapeXml(longestRange)}</text>
    </g>
    <circle cx="247.5" cy="71" r="40" fill="none" stroke="${theme.accent}" stroke-width="5" mask="url(#mask_out_ring_behind_fire)" style="opacity:0;animation:fadein .5s linear forwards .4s"/>
    <g transform="translate(247.5 19.5)" fill="${theme.accent}" style="opacity:0;animation:fadein .5s linear forwards .6s">
      <path d="M1.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73s-3.62-1.67-3.62-3.73l.03-.36A13.76 13.76 0 0 0-8 13.99 8 8 0 0 0 0 22a8 8 0 0 0 8-8.01C8 8.6 5.41 3.79 1.5.67ZM-.29 19a3.18 3.18 0 0 1-3.22-3.14c0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04A4.8 4.8 0 0 1-.29 19Z"/>
    </g>
    <g fill="${theme.accent}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="700">
      <text x="247.5" y="80" font-size="28" style="animation:currstreak .6s linear forwards">${stats.current.count}</text>
      <text x="247.5" y="140" font-size="14" style="opacity:0;animation:fadein .5s linear forwards .9s">Current Streak</text>
    </g>
  </g>
</svg>
`;
}

async function main() {
  let profile;
  try {
    profile = await fetchProfile();
  } catch (error) {
    if (!process.env.GITHUB_ACCOUNT_CREATED) throw error;
    console.warn(`GitHub profile API failed; using the supplied account date: ${error.message}`);
    profile = {
      created_at: process.env.GITHUB_ACCOUNT_CREATED,
      login: username,
      name: process.env.GITHUB_DISPLAY_NAME,
    };
  }
  const accountCreatedDate = profile.created_at.slice(0, 10);
  const days = await fetchContributionDays(Number(accountCreatedDate.slice(0, 4)));
  const stats = calculateStats(days, accountCreatedDate);
  const cardData = {
    displayName: profile.name || profile.login,
    accountCreatedDate,
    stats,
  };

  await Promise.all([
    fs.writeFile(darkOutputPath, renderCard({ ...cardData, themeName: "dark" }), "utf8"),
    fs.writeFile(lightOutputPath, renderCard({ ...cardData, themeName: "light" }), "utf8"),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
