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
    dimText: '#7d8590',
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
  },
  light: {
    bg: '#ffffff',
    panel: '#f6f8fa',
    border: '#d0d7de',
    text: '#24292f',
    subtext: '#57606a',
    dimText: '#6e7781',
    empty: '#ebedf0',
    emptyStroke: '#d8dee4',
    glow: '#ffeaa7',
    bronze1: '#8b5a1b',
    bronze2: '#cd8d36',
    bronze3: '#f3b25c',
    silver1: '#94a0ad',
    silver2: '#d7dee7',
    silver3: '#f9fbfd',
    gold1: '#9a720d',
    gold2: '#e0b84c',
    gold3: '#ffe08a',
    diamond1: '#5fa8d3',
    diamond2: '#8ad8ff',
    diamond3: '#eefcff',
    green1: '#9be9a8',
    green2: '#40c463',
    green3: '#30a14e',
    green4: '#216e39',
    flame1: '#ff8a3d',
    flame2: '#ff5e57',
    flame3: '#ffd166',
    pillBg: '#ffffff',
    statBg: '#ffffff',
    streakBlue: '#0969da',
  },
  emerald: {
    bg: '#08140f',
    panel: '#0b1b14',
    border: '#214438',
    text: '#e7fff5',
    subtext: '#a6d8c4',
    dimText: '#7bb69d',
    empty: '#102019',
    emptyStroke: '#0c1712',
    glow: '#dcffe4',
    bronze1: '#6f4b16',
    bronze2: '#d59643',
    bronze3: '#ffbd59',
    silver1: '#8e99a7',
    silver2: '#d6dde7',
    silver3: '#f8fbff',
    gold1: '#8f6808',
    gold2: '#f2c14e',
    gold3: '#ffe08a',
    diamond1: '#58c4dd',
    diamond2: '#9df0ff',
    diamond3: '#ebffff',
    green1: '#0f5132',
    green2: '#198754',
    green3: '#20c997',
    green4: '#6ee7b7',
    flame1: '#ff8a3d',
    flame2: '#ff5e57',
    flame3: '#ffd166',
    pillBg: '#0d2018',
    statBg: '#0d2018',
    streakBlue: '#7ee787',
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
                color
                contributionCount
                date
                weekday
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
      variables: {
        login: username,
        from: startDate,
        to: endDate,
      }
    })
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error('Error: GitHub GraphQL error', JSON.stringify(json.errors || json, null, 2));
    process.exit(1);
  }

  const calendar = json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    console.error('Error: contribution calendar not found');
    process.exit(1);
  }

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
      running += 1;
      if (running > longest) longest = running;
    } else {
      running = 0;
    }
  }

  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].contributionCount > 0) current += 1;
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

function trophyCells() {
  return [
    [2,0],[3,0],[4,0],[5,0],
    [1,1],[5,1],
    [1,2],[5,2],
    [1,3],[2,3],[3,3],[4,3],[5,3],
    [2,4],[3,4],[4,4],
    [3,5],
    [2,6],[3,6],[4,6],
    [3,7],
    [3,8],
    [2,9],[3,9],[4,9],
    [1,10],[2,10],[3,10],[4,10],[5,10]
  ];
}

function diamondCells() {
  return [
    [3,0],
    [2,1],[3,1],[4,1],
    [1,2],[2,2],[3,2],[4,2],[5,2],
    [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
    [1,4],[2,4],[3,4],[4,4],[5,4],
    [2,5],[3,5],[4,5],
    [3,6]
  ];
}

function contributionFill(count) {
  if (count <= 0) return C.empty;
  if (count === 1) return C.green1;
  if (count <= 3) return C.green2;
  if (count <= 6) return C.green3;
  return C.green4;
}

function pixelCluster(cells, originX, originY, size, colors, glowId = '') {
  let out = '';
  for (const [cx, cy] of cells) {
    const fill = cy < 2 ? colors[2] : cy < 5 ? colors[1] : colors[0];
    out += `<rect x="${originX + cx * size}" y="${originY + cy * size}" width="${size - 2}" height="${size - 2}" rx="2" fill="${fill}" ${glowId ? `filter="url(#${glowId})"` : ''}/>`;
  }
  return out;
}

function pill({ x, y, w, h, icon, text, accent }) {
  const iconText = icon ? `<text x="${x + 16}" y="${y + 18}" font-size="12" fill="${accent}" dominant-baseline="middle">${esc(icon)}</text>` : '';
  const textX = icon ? x + 32 : x + 12;
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${C.pillBg}" stroke="${C.border}" />
      ${iconText}
      <text x="${textX}" y="${y + 18}" font-size="11.5" font-weight="700" fill="${accent}" dominant-baseline="middle">${esc(text)}</text>
    </g>
  `;
}

function statCard({ x, y, w, h, label, value, valueColor = C.text }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${C.statBg}" stroke="${C.border}" />
      <text x="${x + 14}" y="${y + 17}" font-size="11" fill="${C.subtext}">${esc(label)}</text>
      <text x="${x + 14}" y="${y + 39}" font-size="16" font-weight="800" fill="${valueColor}">${esc(value)}</text>
    </g>
  `;
}

function buildSvg(days, totalContributions, stats, award) {
  const width = 820;
  const height = 320;

  const outerX = 10;
  const outerY = 10;
  const outerW = 800;
  const outerH = 300;

  const titleY = 30;
  const topInfoY = 46;

  const gridX = 286;
  const gridY = 72;
  const cell = 12;
  const gap = 2;
  const stride = cell + gap;

  const trophyX = 40;
  const trophyY = 84;
  const trophySize = 14;

  const awardTextX = 130;
  const awardTextY1 = 130;
  const awardTextY2 = 166;

  const middleRowY = 206;
  const cardsY = 248;
  const cardW = 178;
  const cardH = 48;

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  let gridRects = '';
  weeks.forEach((week, wx) => {
    week.forEach((d, wy) => {
      const x = gridX + wx * stride;
      const y = gridY + wy * stride;
      const fill = contributionFill(d.contributionCount);
      const glow = d.contributionCount >= 6 ? 'filter="url(#greenGlow)"' : '';
      gridRects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}" stroke="${C.emptyStroke}" stroke-width="0.6" ${glow} />`;
    });
  });

  const trophy = pixelCluster(trophyCells(), trophyX, trophyY, trophySize, award.colors, 'trophyGlow');
  const rightBadge = pixelCluster(diamondCells(), 662, 96, 14, [C.flame1, C.flame2, C.flame3], 'flameGlow');

  const topLine = `${stats.activeDays} contribution days · ${totalContributions} total contributions · @${username}`;

  const pills = [];
  pills.push(
    pill({
      x: 128,
      y: middleRowY,
      w: 235,
      h: 26,
      icon: '',
      text: '7=Bronze · 30=Silver · 90=Gold · 180=Diamond',
      accent: C.subtext
    })
  );

  if (showStreak) {
    pills.push(
      pill({
        x: 377,
        y: middleRowY,
        w: 136,
        h: 26,
        icon: '🔥',
        text: `${stats.currentStreak} day streak`,
        accent: C.flame2
      })
    );
    pills.push(
      pill({
        x: 526,
        y: middleRowY,
        w: 136,
        h: 26,
        icon: '⚡',
        text: `longest ${stats.longestStreak} days`,
        accent: C.streakBlue
      })
    );
  }

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${esc(titleText)}</title>
  <desc id="desc">${esc(username)} GitHub contribution trophy</desc>

  <defs>
    <filter id="trophyGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 0.8 0 0 0  0 0 0.4 0 0  0 0 0 0.8 0"/>
      <feBlend in="SourceGraphic" mode="screen"/>
    </filter>

    <filter id="flameGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 0.5 0 0 0  0 0 0.2 0 0  0 0 0 0.9 0"/>
      <feBlend in="SourceGraphic" mode="screen"/>
    </filter>

    <filter id="greenGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.95  0 0 0 0 0.6  0 0 0 0.9 0"/>
      <feBlend in="SourceGraphic" mode="screen"/>
    </filter>

    <linearGradient id="panelShine" x1="0" y1="0" x2="820" y2="320" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="white" stop-opacity="0.04"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" rx="18" fill="${C.bg}" />
  <rect x="${outerX}" y="${outerY}" width="${outerW}" height="${outerH}" rx="16" fill="${C.panel}" stroke="${C.border}" />
  <rect x="${outerX}" y="${outerY}" width="${outerW}" height="${outerH}" rx="16" fill="url(#panelShine)" />

  <text x="28" y="${titleY}" font-size="16" font-weight="800" fill="${C.text}">${esc(titleText)}</text>
  <text x="28" y="${topInfoY}" font-size="11.5" fill="${C.subtext}">${esc(topLine)}</text>

  ${gridRects}
  ${trophy}
  ${rightBadge}

  <text x="${awardTextX}" y="${awardTextY1}" font-size="28" font-weight="900" fill="${award.colors[2]}" filter="url(#trophyGlow)">${esc(award.tier)}</text>
  <text x="${awardTextX}" y="${awardTextY2}" font-size="28" font-weight="900" fill="${award.colors[1]}" filter="url(#trophyGlow)">Award</text>

  ${pills.join('\n')}

  ${showStats ? `
    ${statCard({ x: 28, y: cardsY, w: cardW, h: cardH, label: 'Active days', value: String(stats.activeDays) })}
    ${statCard({ x: 218, y: cardsY, w: cardW, h: cardH, label: 'Total contributions', value: String(totalContributions) })}
    ${statCard({ x: 408, y: cardsY, w: cardW, h: cardH, label: 'Current tier', value: award.tier, valueColor: award.colors[2] })}
    ${statCard({ x: 598, y: cardsY, w: cardW, h: cardH, label: 'Last active', value: stats.latestActive || '--' })}
  ` : ''}

  ${animate ? `
    <g opacity="0.95">
      <rect x="86" y="110" width="4" height="4" rx="1" fill="${C.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="2.2s" repeatCount="indefinite"/>
      </rect>
      <rect x="93" y="117" width="3" height="3" rx="1" fill="${C.glow}">
        <animate attributeName="opacity" values="0;0.8;0" dur="1.8s" begin="0.35s" repeatCount="indefinite"/>
      </rect>
      <rect x="704" y="126" width="4" height="4" rx="1" fill="${C.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="1.9s" begin="0.25s" repeatCount="indefinite"/>
      </rect>
      <rect x="716" y="118" width="3" height="3" rx="1" fill="${C.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="0.8s" repeatCount="indefinite"/>
      </rect>
    </g>
  ` : ''}
</svg>`.trim();
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

  console.log(`Generated ${outFile}`);
  console.log(`User: ${username}`);
  console.log(`Active days: ${stats.activeDays}`);
  console.log(`Total contributions: ${totalContributions}`);
  console.log(`Current streak: ${stats.currentStreak}`);
  console.log(`Longest streak: ${stats.longestStreak}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
