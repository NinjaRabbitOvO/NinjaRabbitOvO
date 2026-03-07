#!/usr/bin/env node

const username = process.env.GITHUB_USERNAME || process.env.USERNAME;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const theme = (process.env.TROPHY_THEME || 'default').toLowerCase();
const outFile = process.env.OUTPUT_FILE || 'dist/trophy-contrib.svg';
const readmeFile = process.env.README_FILE || 'README.md';
const updateReadme = (process.env.UPDATE_README || 'true').toLowerCase() === 'true';
const animate = (process.env.ANIMATE || 'true').toLowerCase() === 'true';
const startDate = process.env.START_DATE || new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
const endDate = process.env.END_DATE || new Date().toISOString();

if (!username) {
  console.error('Missing GITHUB_USERNAME env var.');
  process.exit(1);
}

const THEMES = {
  default: {
    bg: '#0d1117',
    panel: '#0d1117',
    border: '#30363d',
    empty: '#161b22',
    text: '#c9d1d9',
    subtext: '#8b949e',
    brass: ['#d9a441', '#b87333', '#8c5a2b'],
    silver: ['#f2f4f8', '#b8c2cc', '#7d8793'],
    gold: ['#ffd966', '#f4b400', '#b7791f'],
    diamond: ['#dff6ff', '#7dd3fc', '#2563eb'],
    glow: '#fff7cc'
  },
  light: {
    bg: '#ffffff',
    panel: '#ffffff',
    border: '#d0d7de',
    empty: '#ebedf0',
    text: '#24292f',
    subtext: '#57606a',
    brass: ['#d9a441', '#b87333', '#8c5a2b'],
    silver: ['#f2f4f8', '#b8c2cc', '#7d8793'],
    gold: ['#ffd966', '#f4b400', '#b7791f'],
    diamond: ['#dff6ff', '#7dd3fc', '#2563eb'],
    glow: '#ffe58f'
  },
  emerald: {
    bg: '#051b11',
    panel: '#051b11',
    border: '#1d4d3b',
    empty: '#0d281d',
    text: '#d7ffe8',
    subtext: '#8fd9b6',
    brass: ['#e2b868', '#b87333', '#8e5c2c'],
    silver: ['#f4f8fb', '#c6d2dc', '#8292a3'],
    gold: ['#ffe07a', '#f1b500', '#b7791f'],
    diamond: ['#e9fbff', '#8be3ff', '#2a88d8'],
    glow: '#fff8cf'
  }
};

const themeColors = THEMES[theme] || THEMES.default;

async function fetchContributionDays(login, authToken) {
  const endpoint = 'https://api.github.com/graphql';
  const query = `
    query($login:String!, $from:DateTime!, $to:DateTime!) {
      user(login:$login) {
        contributionsCollection(from:$from, to:$to) {
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

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'github-trophy-widget'
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: { login, from: startDate, to: endDate } })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub GraphQL error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks || [];
  const days = weeks.flatMap(w => w.contributionDays);
  const activeDays = days.filter(d => d.contributionCount > 0);
  return { days, activeDaysCount: activeDays.length };
}

function getAward(activeDaysCount) {
  if (activeDaysCount >= 180) return { tier: 'diamond', label1: 'Diamond', label2: 'Award', accent: themeColors.diamond };
  if (activeDaysCount >= 90) return { tier: 'gold', label1: 'Gold', label2: 'Award', accent: themeColors.gold };
  if (activeDaysCount >= 30) return { tier: 'silver', label1: 'Silver', label2: 'Award', accent: themeColors.silver };
  if (activeDaysCount >= 7) return { tier: 'bronze', label1: 'Bronze', label2: 'Award', accent: themeColors.brass };
  return null;
}

function trophyCells() {
  return [
    [2,0],[3,0],[4,0],
    [1,1],[5,1],
    [1,2],[5,2],
    [1,3],[2,3],[3,3],[4,3],[5,3],
    [2,4],[3,4],[4,4],
    [3,5],
    [2,6],[3,6],[4,6]
  ];
}

function renderSVG({ days, activeDaysCount }) {
  const award = getAward(activeDaysCount);
  const weeksCount = Math.max(53, Math.ceil(days.length / 7));
  const cell = 11;
  const gap = 3;
  const pitch = cell + gap;
  const gridX = 24;
  const gridY = 40;
  const gridW = weeksCount * pitch;
  const gridH = 7 * pitch;
  const width = 820;
  const height = 220;

  const rects = [];
  let idx = 0;
  for (let wx = 0; wx < weeksCount; wx++) {
    for (let wy = 0; wy < 7; wy++) {
      const d = days[idx++] || null;
      const x = gridX + wx * pitch;
      const y = gridY + wy * pitch;
      const fill = d && d.contributionCount > 0 ? (d.color || '#39d353') : themeColors.empty;
      const opacity = d && d.contributionCount > 0 ? 1 : 0.95;
      const title = d ? `${d.date}: ${d.contributionCount} contribution(s)` : 'padding cell';
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}" opacity="${opacity}"><title>${escapeXml(title)}</title></rect>`);
    }
  }

  if (award) {
    const cells = trophyCells();
    cells.forEach(([cx, cy], i) => {
      const x = gridX + cx * pitch;
      const y = gridY + cy * pitch;
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="url(#${award.tier}Grad)">${animate ? `<animate attributeName="opacity" values="0.85;1;0.85" dur="2.4s" begin="${(i%5)*0.18}s" repeatCount="indefinite" />` : ''}</rect>`);
    });
  }

  const sparkle = award && animate ? `
    <g opacity="0.9">
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 70} ${gridY + 16}) scale(0.65)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
      </path>
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 318} ${gridY + 104}) scale(0.45)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="2.1s" begin="0.45s" repeatCount="indefinite" />
      </path>
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 650} ${gridY + 42}) scale(0.55)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="0.9s" repeatCount="indefinite" />
      </path>
    </g>` : '';

  const labelX = gridX + 8 * pitch;
  const tierText = award ? `${award.label1}\n${award.label2}` : 'Keep\nGoing';
  const [label1, label2] = tierText.split('\n');
  const fill1 = award ? award.accent[0] : themeColors.text;
  const fill2 = award ? award.accent[1] : themeColors.subtext;

  const legend = `
    <text x="${labelX}" y="${gridY + 38}" font-family="Verdana,Segoe UI,Arial" font-size="34" font-weight="700" fill="${fill1}">${label1}</text>
    <text x="${labelX}" y="${gridY + 76}" font-family="Verdana,Segoe UI,Arial" font-size="34" font-weight="700" fill="${fill2}">${label2}</text>
    <text x="${labelX}" y="${gridY + 110}" font-family="Verdana,Segoe UI,Arial" font-size="16" fill="${themeColors.text}">${activeDaysCount} active contribution day${activeDaysCount === 1 ? '' : 's'} in the last year</text>
    <text x="${labelX}" y="${gridY + 138}" font-family="Verdana,Segoe UI,Arial" font-size="13" fill="${themeColors.subtext}">7=Bronze · 30=Silver · 90=Gold · 180=Diamond</text>
    <text x="${labelX}" y="${gridY + 160}" font-family="Verdana,Segoe UI,Arial" font-size="13" fill="${themeColors.subtext}">@${escapeXml(username)}</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">GitHub contribution trophy for ${escapeXml(username)}</title>
  <desc id="desc">Contribution heatmap with a trophy and award text based on active contribution days.</desc>
  <defs>
    <linearGradient id="bronzeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${themeColors.brass[0]}" />
      <stop offset="55%" stop-color="${themeColors.brass[1]}" />
      <stop offset="100%" stop-color="${themeColors.brass[2]}" />
    </linearGradient>
    <linearGradient id="silverGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${themeColors.silver[0]}" />
      <stop offset="55%" stop-color="${themeColors.silver[1]}" />
      <stop offset="100%" stop-color="${themeColors.silver[2]}" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${themeColors.gold[0]}" />
      <stop offset="55%" stop-color="${themeColors.gold[1]}" />
      <stop offset="100%" stop-color="${themeColors.gold[2]}" />
    </linearGradient>
    <linearGradient id="diamondGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${themeColors.diamond[0]}" />
      <stop offset="55%" stop-color="${themeColors.diamond[1]}" />
      <stop offset="100%" stop-color="${themeColors.diamond[2]}" />
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect x="0.5" y="0.5" width="${width-1}" height="${height-1}" rx="14" fill="${themeColors.panel}" stroke="${themeColors.border}" />
  <text x="24" y="24" font-family="Verdana,Segoe UI,Arial" font-size="16" font-weight="600" fill="${themeColors.text}">${activeDaysCount} contribution days in the last year</text>
  <g filter="url(#softGlow)">
    ${rects.join('\n    ')}
  </g>
  ${legend}
  ${sparkle}
</svg>`;

  return svg;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { days, activeDaysCount } = await fetchContributionDays(username, token);
  const svg = renderSVG({ days, activeDaysCount });

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, svg, 'utf8');

  if (updateReadme) {
    let readme = '';
    try {
      readme = await fs.readFile(readmeFile, 'utf8');
    } catch {
      readme = `# ${username}\n\n<!-- TROPHY-SVG-START -->\n<!-- TROPHY-SVG-END -->\n`;
    }

    const relPath = path.relative(path.dirname(readmeFile), outFile).replace(/\\/g, '/');
    const block = `<!-- TROPHY-SVG-START -->\n## Contribution Trophy\n\n<img src="${relPath}" alt="${username} contribution trophy" />\n\n<!-- TROPHY-SVG-END -->`;
    if (/<!-- TROPHY-SVG-START -->[\s\S]*<!-- TROPHY-SVG-END -->/.test(readme)) {
      readme = readme.replace(/<!-- TROPHY-SVG-START -->[\s\S]*<!-- TROPHY-SVG-END -->/, block);
    } else {
      readme += `\n\n${block}\n`;
    }
    await fs.writeFile(readmeFile, readme, 'utf8');
  }

  console.log(`Generated ${outFile} for @${username} with ${activeDaysCount} active days.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
