#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const username = process.env.GITHUB_USERNAME || process.env.USERNAME;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const theme = (process.env.TROPHY_THEME || 'default').toLowerCase();
const outFile = process.env.OUTPUT_FILE || 'assets/contribution-trophy.svg';
const readmeFile = process.env.README_FILE || 'README.md';
const updateReadme = (process.env.UPDATE_README || 'true').toLowerCase() === 'true';
const animate = (process.env.ANIMATE || 'true').toLowerCase() === 'true';
const startDate = process.env.START_DATE || new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
const endDate = process.env.END_DATE || new Date().toISOString();
const titleText = process.env.TROPHY_TITLE || '🏆 Contribution Trophy';
const showStreak = (process.env.SHOW_STREAK || 'true').toLowerCase() === 'true';
const showStats = (process.env.SHOW_STATS || 'true').toLowerCase() === 'true';
const readmeCentered = (process.env.README_CENTER || 'true').toLowerCase() === 'true';

if (!username) {
  console.error('Error: missing GITHUB_USERNAME');
  process.exit(1);
}

if (!token) {
  console.error('Error: missing GH_TOKEN / GITHUB_TOKEN');
  process.exit(1);
}

const THEMES = {
  default: {
    bg: '#0d1117',
    panel: '#0b1220',
    border: '#30363d',
    text: '#e6edf3',
    subtext: '#9fb0c3',
    empty: '#161b22',
    emptyStroke: '#0f1720',
    glow: '#fff4bf',
    bronze1: '#6f4b16',
    bronze2: '#d59643',
    bronze3: '#ffbd59',
    silver1: '#8e99a7',
    silver2: '#d6dde7',
    silver3: '#f8fbff',
    gold1: '#8f6808',
    gold2: '#f2c14e',
    gold3: '#ffe08a',
    diamond1: '#4ea8de',
    diamond2: '#8ad8ff',
    diamond3: '#e6fbff',
    green1: '#0e4429',
    green2: '#006d32',
    green3: '#26a641',
    green4: '#39d353',
    flame1: '#ff8a3d',
    flame2: '#ff5e57',
    flame3: '#ffd166',
    pillBg: '#101826',
    statBg: '#0f1623',
    streakBlue: '#58a6ff',
  }
};

const C = THEMES[theme] || THEMES.default;

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function fetchContributionDays() {
  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
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

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${token}`,
      'User-Agent': 'github-contribution-trophy-widget'
    },
    body: JSON.stringify({
      query,
      variables: { login: username, from: startDate, to: endDate }
    })
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error('GitHub API error', json);
    process.exit(1);
  }

  const calendar = json.data.user.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks || [];
  const days = weeks.flatMap(w => w.contributionDays || []);

  return {
    days,
    totalContributions: calendar.totalContributions || 0
  };
}

function computeStats(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const activeDays = sorted.filter(d => d.contributionCount > 0).length;

  let longest = 0;
  let running = 0;

  for (const d of sorted) {
    if (d.contributionCount > 0) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].contributionCount > 0) current++;
    else break;
  }

  const latestActive = [...sorted].reverse().find(d => d.contributionCount > 0)?.date || null;

  return { activeDays, currentStreak: current, longestStreak: longest, latestActive };
}

function getAward(activeDays) {
  if (activeDays >= 180) return { tier: 'Diamond', colors: [C.diamond1, C.diamond2, C.diamond3] };
  if (activeDays >= 90) return { tier: 'Gold', colors: [C.gold1, C.gold2, C.gold3] };
  if (activeDays >= 30) return { tier: 'Silver', colors: [C.silver1, C.silver2, C.silver3] };
  if (activeDays >= 7) return { tier: 'Bronze', colors: [C.bronze1, C.bronze2, C.bronze3] };
  return { tier: 'Starter', colors: [C.green1, C.green3, C.green4] };
}

function contributionFill(count) {
  if (count <= 0) return C.empty;
  if (count === 1) return C.green1;
  if (count <= 3) return C.green2;
  if (count <= 6) return C.green3;
  return C.green4;
}

function buildSvg(days, totalContributions, stats, award) {

  const width = 820;
  const height = 320;

  const topInfoY = 34;

  const gridX = 280;
  const gridY = 70;

  const cell = 12;
  const gap = 2;
  const stride = cell + gap;

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  let gridRects = '';
  weeks.forEach((week, wx) => {
    week.forEach((d, wy) => {
      const x = gridX + wx * stride;
      const y = gridY + wy * stride;
      const fill = contributionFill(d.contributionCount);
      gridRects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}" stroke="${C.emptyStroke}" stroke-width="0.6"/>`;
    });
  });

  const topLine = `${stats.activeDays} contribution days · ${totalContributions} total contributions · @${username}`;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">

<rect width="${width}" height="${height}" rx="18" fill="${C.bg}" />

<text x="28" y="${topInfoY}" font-size="12" fill="${C.subtext}">${esc(topLine)}</text>

${gridRects}

<text x="130" y="130" font-size="28" font-weight="900" fill="${award.colors[2]}">${award.tier}</text>
<text x="130" y="166" font-size="28" font-weight="900" fill="${award.colors[1]}">Award</text>

</svg>
`.trim();
}

function updateReadmeFile() {
  if (!updateReadme) return;

  let readme = '';
  if (fs.existsSync(readmeFile)) {
    readme = fs.readFileSync(readmeFile, 'utf8');
  }

  const imgTag = readmeCentered
    ? `<p align="center">\n  <img src="assets/contribution-trophy.svg" alt="${username} contribution trophy" />\n</p>`
    : `<img src="assets/contribution-trophy.svg" alt="${username} contribution trophy" />`;

  const block = `<!-- TROPHY-SVG-START -->\n## ${titleText}\n\n${imgTag}\n<!-- TROPHY-SVG-END -->`;

  const regex = /<!-- TROPHY-SVG-START -->[\s\S]*?<!-- TROPHY-SVG-END -->/m;

  if (regex.test(readme)) {
    readme = readme.replace(regex, block);
  } else {
    readme = `${readme.trimEnd()}\n\n${block}\n`;
  }

  fs.writeFileSync(readmeFile, readme, 'utf8');
}

async function main() {
  const { days, totalContributions } = await fetchContributionDays();
  const stats = computeStats(days);
  const award = getAward(stats.activeDays);
  const svg = buildSvg(days, totalContributions, stats, award);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, svg, 'utf8');

  updateReadmeFile();

  console.log('SVG generated');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
