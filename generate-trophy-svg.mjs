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
const titleText = process.env.TROPHY_TITLE || '🏆 Contribution Trophy';
const showStreak = (process.env.SHOW_STREAK || 'true').toLowerCase() === 'true';
const showStats = (process.env.SHOW_STATS || 'true').toLowerCase() === 'true';
const readmeCentered = (process.env.README_CENTER || 'true').toLowerCase() === 'true';
const showInternalTitle = (process.env.SHOW_INTERNAL_TITLE || 'true').toLowerCase() === 'true';

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
    silver: ['#f8fafc', '#cbd5e1', '#94a3b8'],
    gold: ['#ffd966', '#f4b400', '#b7791f'],
    diamond: ['#eefcff', '#7dd3fc', '#2563eb'],
    accent: '#58a6ff',
    glow: '#fff7cc',
    streak: ['#ffb86b', '#ff7b72', '#ff4d4d']
  },
  light: {
    bg: '#ffffff',
    panel: '#ffffff',
    border: '#d0d7de',
    empty: '#ebedf0',
    text: '#24292f',
    subtext: '#57606a',
    brass: ['#d9a441', '#b87333', '#8c5a2b'],
    silver: ['#f8fafc', '#dbe4ee', '#94a3b8'],
    gold: ['#ffd966', '#f4b400', '#b7791f'],
    diamond: ['#eefcff', '#7dd3fc', '#2563eb'],
    accent: '#0969da',
    glow: '#ffe58f',
    streak: ['#ffb86b', '#ff7b72', '#d1242f']
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
    accent: '#34d399',
    glow: '#fff8cf',
    streak: ['#ffd166', '#f97316', '#ef4444']
  }
};

const themeColors = applyOverrides(THEMES[theme] || THEMES.default);

function applyOverrides(base) {
  const clone = JSON.parse(JSON.stringify(base));
  const map = [
    ['empty', process.env.COLOR_EMPTY],
    ['text', process.env.COLOR_TEXT],
    ['subtext', process.env.COLOR_SUBTEXT],
    ['border', process.env.COLOR_BORDER],
    ['panel', process.env.COLOR_PANEL],
    ['accent', process.env.COLOR_ACCENT],
    ['glow', process.env.COLOR_GLOW]
  ];
  for (const [k, v] of map) if (v) clone[k] = v;
  if (process.env.COLOR_BRONZE_1) clone.brass[0] = process.env.COLOR_BRONZE_1;
  if (process.env.COLOR_BRONZE_2) clone.brass[1] = process.env.COLOR_BRONZE_2;
  if (process.env.COLOR_BRONZE_3) clone.brass[2] = process.env.COLOR_BRONZE_3;
  if (process.env.COLOR_SILVER_1) clone.silver[0] = process.env.COLOR_SILVER_1;
  if (process.env.COLOR_SILVER_2) clone.silver[1] = process.env.COLOR_SILVER_2;
  if (process.env.COLOR_SILVER_3) clone.silver[2] = process.env.COLOR_SILVER_3;
  if (process.env.COLOR_GOLD_1) clone.gold[0] = process.env.COLOR_GOLD_1;
  if (process.env.COLOR_GOLD_2) clone.gold[1] = process.env.COLOR_GOLD_2;
  if (process.env.COLOR_GOLD_3) clone.gold[2] = process.env.COLOR_GOLD_3;
  if (process.env.COLOR_DIAMOND_1) clone.diamond[0] = process.env.COLOR_DIAMOND_1;
  if (process.env.COLOR_DIAMOND_2) clone.diamond[1] = process.env.COLOR_DIAMOND_2;
  if (process.env.COLOR_DIAMOND_3) clone.diamond[2] = process.env.COLOR_DIAMOND_3;
  return clone;
}

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
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
          nodes {
            stargazerCount
            forkCount
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
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
const totalContributions = json?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions || 0;

const repos = json?.data?.user?.repositories?.nodes || [];
const totalStars = repos.reduce((sum, repo) => sum + (repo?.stargazerCount || 0), 0);
const totalForks = repos.reduce((sum, repo) => sum + (repo?.forkCount || 0), 0);

// 汇总代码语言字节数
const languageMap = new Map();

for (const repo of repos) {
  const edges = repo?.languages?.edges || [];
  for (const edge of edges) {
    const langName = edge?.node?.name;
    const langColor = edge?.node?.color || '#888888';
    const langSize = edge?.size || 0;
    if (!langName || langSize <= 0) continue;

    if (!languageMap.has(langName)) {
      languageMap.set(langName, {
        name: langName,
        color: langColor,
        size: 0
      });
    }

    languageMap.get(langName).size += langSize;
  }
}

const languageStats = [...languageMap.values()]
  .sort((a, b) => b.size - a.size);

const totalLanguageSize = languageStats.reduce((sum, item) => sum + item.size, 0);

const languageBreakdown = languageStats.map(item => ({
  ...item,
  percent: totalLanguageSize > 0 ? (item.size / totalLanguageSize) * 100 : 0
}));
  
return {
  days,
  activeDaysCount: activeDays.length,
  totalContributions,
  totalStars,
  totalForks,
  languageBreakdown,
  stats: computeStreakStats(days)
};
}

function computeStreakStats(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let current = 0;
  let running = 0;

  for (const d of sorted) {
    if (d.contributionCount > 0) {
      running += 1;
      if (running > longest) longest = running;
    } else {
      running = 0;
    }
  }

  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].contributionCount > 0) current += 1;
    else break;
  }

  const latestActive = [...sorted].reverse().find(d => d.contributionCount > 0)?.date || null;
  return { current, longest, latestActive };
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

function flameCells() {
  return [
    [0,3],[1,2],[1,3],[1,4],[2,1],[2,2],[2,3],[2,4],[2,5],
    [3,0],[3,1],[3,2],[3,3],[3,4],[4,1],[4,2],[4,3],[5,2]
  ];
}

function getIntensityFill(d) {
  if (!d || d.contributionCount <= 0) return themeColors.empty;
  return d.color || '#39d353';
}

function estimatePillWidth(text, fontSize = 12, horizontalPadding = 28) {
  const s = String(text);

  let units = 0;
  for (const ch of s) {
    if (ch === ' ') units += 0.35;
    else if ('🥉🥈🥇💎🔥⚡'.includes(ch)) units += 1.35;
    else if ('≥=·:-'.includes(ch)) units += 0.55;
    else if (/[0-9]/.test(ch)) units += 0.72;
    else if (/[A-Z]/.test(ch)) units += 0.82;
    else if (/[a-z]/.test(ch)) units += 0.68;
    else units += 0.75;
  }

  return Math.ceil(units * fontSize + horizontalPadding * 2);
}

function pill(x, y, width, text, color) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="30" rx="15" fill="rgba(255,255,255,0.03)" stroke="${themeColors.border}" />
      <text
        x="${x + width / 2}"
        y="${y + 20}"
        text-anchor="middle"
        font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,Verdana,Segoe UI,Arial"
        font-size="12"
        font-weight="700"
        fill="${color}"
      >${escapeXml(text)}</text>
    </g>`;
}

function renderSVG({ days, activeDaysCount, totalContributions, totalStars, totalForks, languageBreakdown, stats }) {
  const award = getAward(activeDaysCount);
  const weeksCount = Math.max(53, Math.ceil(days.length / 7));
  const cell = 11;
  const gap = 3;
  const pitch = cell + gap;
  const awardShift = 5 * pitch;
  const gridX = 24;
  const gridY = 62;
  const width = 840;
  const height = 400;
  const labelX = gridX + 8 * pitch;
 
  const trophyOffsetX = 0;
  const trophyOffsetY = 0;
  const awardOffsetX = -8;
  const trophyVisualCenterY = gridY + 3.5 * pitch;
  const awardLineGap = 34;
  const awardTopY = trophyVisualCenterY - 10;
  
  const metaRowY = 176;
  const cardY = 220;
  const cardHeight = 50;
  
  const statsX = 24;
  const statsGap = 16;
  const statsRight = gridX + weeksCount * pitch;   // 和上方格子区右边界对齐
  const statsAvailableWidth = statsRight - statsX;
  const statsCardW = Math.floor((statsAvailableWidth - statsGap * 3) / 4);
  const statsCardH = 50;
  
  const statsCard1X = statsX;
  const statsCard2X = statsCard1X + statsCardW + statsGap;
  const statsCard3X = statsCard2X + statsCardW + statsGap;
  const statsCard4X = statsCard3X + statsCardW + statsGap;

  const languageBarX = statsCard1X;
  const languageBarY = cardY + statsCardH + 38;
  const languageBarW = statsCard4X + statsCardW - statsCard1X;
  const languageBarH = 14; 

  const contentBaseLeft = gridX;
  const contentBaseRight = Math.max(
    gridX + weeksCount * pitch,
    statsCard4X + statsCardW);
  const contentWidth = contentBaseRight - contentBaseLeft;

  const panelInnerLeft = 24;
  const panelInnerRight = width - 24;
  const panelInnerWidth = panelInnerRight - panelInnerLeft;
  const contentShiftX = Math.round((panelInnerWidth - contentWidth) / 2) - (contentBaseLeft - panelInnerLeft);

  const heatmapRightX = gridX + (weeksCount - 1) * pitch + cell + contentShiftX;
  const headerMetaRightX = heatmapRightX - 4; 
  
  const rects = [];
  const overlay = [];
  let idx = 0;
  for (let wx = 0; wx < weeksCount; wx++) {
    for (let wy = 0; wy < 7; wy++) {
      const d = days[idx++] || null;
      const x = gridX + wx * pitch;
      const y = gridY + wy * pitch;
      const fill = getIntensityFill(d);
      const opacity = d && d.contributionCount > 0 ? 1 : 0.95;
      const title = d ? `${d.date}: ${d.contributionCount} contribution(s)` : 'padding cell';
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}" opacity="${opacity}"><title>${escapeXml(title)}</title></rect>`);
    }
  }

  if (award) {
    trophyCells().forEach(([cx, cy], i) => {
      const x = gridX + cx * pitch + awardShift;
      const y = gridY + cy * pitch;
      overlay.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="url(#${award.tier}Grad)">${animate ? `<animate attributeName="opacity" values="0.82;1;0.82" dur="2.6s" begin="${(i % 5) * 0.16}s" repeatCount="indefinite" />` : ''}</rect>`);
    });
  }

  if (showStreak && stats.current >= 3) {
    const flameStartWeek = weeksCount - 12;
    flameCells().forEach(([cx, cy], i) => {
      const x = gridX + (flameStartWeek + cx) * pitch;
      const y = gridY + cy * pitch;
      overlay.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="url(#streakGrad)">${animate ? `<animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" begin="${(i % 4) * 0.12}s" repeatCount="indefinite" />` : ''}</rect>`);
    });
  }

const legend = award
  ? `
    <text x="${labelX + awardOffsetX + awardShift}" y="${awardTopY}" font-family="Verdana,Segoe UI,Arial" font-size="34" font-weight="700" fill="${award.accent[0]}">${award.label1}</text>
    <text x="${labelX + awardOffsetX + awardShift}" y="${awardTopY + awardLineGap}" font-family="Verdana,Segoe UI,Arial" font-size="34" font-weight="700" fill="${award.accent[1]}">${award.label2}</text>
  `
  : `
    <text x="${labelX}" y="${awardTopY}" font-family="Verdana,Segoe UI,Arial" font-size="28" font-weight="700" fill="${themeColors.text}">Keep Going</text>
    <text x="${labelX}" y="${awardTopY + 32}" font-family="Verdana,Segoe UI,Arial" font-size="16" fill="${themeColors.subtext}">Reach 7 active days for Bronze Award</text>
  `;
  
  const pills = [];

  const ruleText = '🥉≥7 · 🥈≥30 · 🥇≥90 · 💎≥180';
  const currentText = `🔥 ${stats.current} Day Streak`;
  const longestText = `⚡ Longest ${stats.longest} Days`;

  const pillGap = 14;

  const ruleWidth = estimatePillWidth(ruleText, 12, 18);
  const currentWidth = estimatePillWidth(currentText, 12, 18);
  const longestWidth = estimatePillWidth(longestText, 12, 18);

  const totalPillWidth = ruleWidth + currentWidth + longestWidth + pillGap * 2;

  // 胶囊区独立居中，不跟奖杯/Award 偏移绑定
  const pillAreaCenter = 392;
  const pillStartX = Math.round(pillAreaCenter - totalPillWidth / 2);

  const pill2X = pillStartX + ruleWidth + pillGap;
  const pill3X = pill2X + currentWidth + pillGap;

  pills.push(
    pill(
      pillStartX,
      metaRowY,
      ruleWidth,
      ruleText,
      themeColors.subtext
    )
  );

  if (showStreak) {
    pills.push(
      pill(
        pill2X,
        metaRowY,
        currentWidth,
        currentText,
        themeColors.streak[1]
      )
    );

    pills.push(
      pill(
        pill3X,
        metaRowY,
        longestWidth,
        longestText,
        themeColors.accent
      )
    );
  }

  const statCards = showStats
    ? `
    <g>
      <rect x="${statsCard1X}" y="${cardY}" width="${statsCardW}" height="${statsCardH}" rx="10" fill="rgba(255,255,255,0.02)" stroke="${themeColors.border}" />
      <text x="${statsCard1X + 16}" y="${cardY + 18}" font-family="Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}">Active days</text>
      <text x="${statsCard1X + 16}" y="${cardY + 38}" font-family="Verdana,Segoe UI,Arial" font-size="18" font-weight="700" fill="${themeColors.text}">${activeDaysCount}</text>

      <rect x="${statsCard2X}" y="${cardY}" width="${statsCardW}" height="${statsCardH}" rx="10" fill="rgba(255,255,255,0.02)" stroke="${themeColors.border}" />
      <text x="${statsCard2X + 16}" y="${cardY + 18}" font-family="Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}">Total contributions</text>
      <text x="${statsCard2X + 16}" y="${cardY + 38}" font-family="Verdana,Segoe UI,Arial" font-size="18" font-weight="700" fill="${themeColors.text}">${totalContributions}</text>

      <rect x="${statsCard3X}" y="${cardY}" width="${statsCardW}" height="${statsCardH}" rx="10" fill="rgba(255,255,255,0.02)" stroke="${themeColors.border}" />
      <text x="${statsCard3X + 16}" y="${cardY + 18}" font-family="Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}">Current tier</text>
      <text x="${statsCard3X + 16}" y="${cardY + 38}" font-family="Verdana,Segoe UI,Arial" font-size="18" font-weight="700" fill="${award ? award.accent[0] : themeColors.text}">${award ? award.label1 : 'Unranked'}</text>

      <rect x="${statsCard4X}" y="${cardY}" width="${statsCardW}" height="${statsCardH}" rx="10" fill="rgba(255,255,255,0.02)" stroke="${themeColors.border}" />
      <text x="${statsCard4X + 16}" y="${cardY + 18}" font-family="Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}">Last active</text>
      <text x="${statsCard4X + 16}" y="${cardY + 38}" font-family="Verdana,Segoe UI,Arial" font-size="16" font-weight="700" fill="${themeColors.text}">${stats.latestActive || 'No activity yet'}</text>
    </g>`
    : '';

  const topLanguages = (languageBreakdown || []).slice(0, 6);

  let languageSegments = '';
  let segmentCursor = languageBarX;
  
  for (let i = 0; i < topLanguages.length; i++) {
    const lang = topLanguages[i];
  
    let segW;
    if (i === topLanguages.length - 1) {
      segW = languageBarX + languageBarW - segmentCursor;
    } else {
      segW = Math.max(2, Math.round((lang.percent / 100) * languageBarW));
    }
  
    if (segW <= 0) continue;
  
    languageSegments += `
      <rect x="${segmentCursor}" y="${languageBarY}" width="${segW}" height="${languageBarH}" fill="${lang.color || themeColors.accent}" />
      <rect x="${segmentCursor}" y="${languageBarY}" width="${segW}" height="${Math.max(2, Math.floor(languageBarH * 0.42))}" fill="white" opacity="0.08" />
    `;
  
    if (i < topLanguages.length - 1) {
      languageSegments += `
        <rect x="${segmentCursor + segW - 4}" y="${languageBarY}" width="8" height="${languageBarH}" fill="url(#langBlend)" />
      `;
    }
  
    segmentCursor += segW;
  }

  let languageLegend = '';
  let legendCursorX = languageBarX;
  const legendY = languageBarY + 32;
  const legendDotR = 4;
  const legendDotGap = 8;
  const legendItemGap = 22;
  
  for (let i = 0; i < topLanguages.length; i++) {
    const lang = topLanguages[i];
    const displayPercent = lang.percent < 0.01 && lang.percent > 0 ? '<0.01' : lang.percent.toFixed(2);
    const label = `${lang.name} ${displayPercent}%`;  
    
    const labelWidth = Math.ceil(label.length * 6.6);
    const itemWidth = legendDotR * 2 + legendDotGap + labelWidth + legendItemGap;
  
    languageLegend += `
      <g>
        <circle cx="${legendCursorX + legendDotR}" cy="${legendY - 4}" r="${legendDotR}" fill="${lang.color || themeColors.accent}" />
        <text x="${legendCursorX + legendDotR * 2 + legendDotGap}" y="${legendY}" font-family="Verdana,Segoe UI,Arial" font-size="11" fill="${themeColors.subtext}">
          ${escapeXml(label)}
        </text>
      </g>
    `;
  
    legendCursorX += itemWidth;
  }

    const footerY = legendY + 42;
    const footerLineY = footerY - 16;
    const footerLeftX = languageBarX;
    const footerRightX = languageBarX + languageBarW;
    const footerTextColor = themeColors.subtext;
    const footerLinkColor = themeColors.accent;
    
    const footerBlock = `
      <g>
        <!-- 分割线底轨 -->
        <rect
          x="${footerLeftX}"
          y="${footerLineY - 1}"
          width="${languageBarW}"
          height="2"
          rx="1"
          fill="url(#footerLineBase)"
        />
    
        <!-- 分割线外轮廓，模仿进度条边框 -->
        <rect
          x="${footerLeftX - 1}"
          y="${footerLineY - 2}"
          width="${languageBarW + 2}"
          height="4"
          rx="2"
          fill="none"
          stroke="url(#langBorderFlow)"
          stroke-opacity="0.35"
        />
    
        <!-- 从中间向两边滑动的两个光块 -->
        ${animate ? `
          <g>
            <rect x="${footerLeftX + languageBarW / 2 - 24}" y="${footerLineY - 2}" width="24" height="4" rx="2" fill="url(#footerLineGlow)">
              <animate attributeName="x"
                       values="${footerLeftX + languageBarW / 2 - 24};${footerLeftX};${footerLeftX + languageBarW / 2 - 24}"
                       dur="3.6s"
                       repeatCount="indefinite" />
            </rect>
    
            <rect x="${footerLeftX + languageBarW / 2}" y="${footerLineY - 2}" width="24" height="4" rx="2" fill="url(#footerLineGlow)">
              <animate attributeName="x"
                       values="${footerLeftX + languageBarW / 2};${footerRightX - 24};${footerLeftX + languageBarW / 2}"
                       dur="3.6s"
                       repeatCount="indefinite" />
            </rect>
          </g>
        ` : ''}
    
        <!-- 左侧信息 -->
        <text x="${footerLeftX}" y="${footerY}" font-family="Verdana,Segoe UI,Arial" font-size="11.5" fill="${footerTextColor}">
          Get the same:
        </text>
        <a href="https://github.com/NinjaRabbitOvO/Contribution-Trophy" target="_blank">
          <text x="${footerLeftX + 82}" y="${footerY}" font-family="Verdana,Segoe UI,Arial" font-size="11.5" font-weight="700" fill="${footerLinkColor}">
            Contribution-Trophy
          </text>
        </a>
    
        <!-- 右侧作者信息，整体右对齐 -->
        <text x="${footerRightX - 165}" y="${footerY}" font-family="Verdana,Segoe UI,Arial" font-size="11.5" fill="${footerTextColor}">
          Author:
        </text>
    
        <a href="https://github.com/NinjaRabbitOvO" target="_blank">
          <text x="${footerRightX - 118}" y="${footerY}" font-family="Verdana,Segoe UI,Arial" font-size="11.5" fill="${footerLinkColor}">
            @NinjaRabbitOvO
          </text>
        </a>
    
        <text x="${footerRightX - 15}" y="${footerY}" text-anchor="end" font-family="Verdana,Segoe UI,Arial" font-size="11.5" fill="${footerTextColor}">
          ,
        </text>
    
        <a href="https://chatgpt.com" target="_blank">
          <text x="${footerRightX}" y="${footerY}" text-anchor="end" font-family="Verdana,Segoe UI,Arial" font-size="11.5" fill="${footerLinkColor}">
            @ChatGPT
          </text>
        </a>
      </g>
    `;

  
  const languageBlock = topLanguages.length
    ? `
        <!-- 这样整个语言条都会轻微呼吸。 -->
        <g opacity="0.96">
          ${animate ? `
          <animate attributeName="opacity"
                   values="0.96;1;0.96"
                   dur="5.5s"
                   repeatCount="indefinite" />
          ` : ``}
          
          <text x="${languageBarX}" y="${languageBarY - 12}" font-family="Verdana,Segoe UI,Arial" font-size="13" font-weight="700" fill="${themeColors.text}">Used Languages</text>
  
          <!-- 最外层亮边框 -->
          <rect
            x="${languageBarX - 2}"
            y="${languageBarY - 2}"
            width="${languageBarW + 4}"
            height="${languageBarH + 4}"
            rx="8"
            fill="none"
            stroke="url(#langBorderFlow)"
            stroke-width="1.2"
            filter="url(#langOuterGlow)"
          />
  
          <!-- 外层暗壳 -->
          <rect
            x="${languageBarX - 1}"
            y="${languageBarY - 1}"
            width="${languageBarW + 2}"
            height="${languageBarH + 2}"
            rx="7"
            fill="rgba(0,0,0,0.22)"
            stroke="${themeColors.border}"
            stroke-opacity="0.95"
          />
  
          <!-- 玻璃底 -->
          <rect
            x="${languageBarX}"
            y="${languageBarY}"
            width="${languageBarW}"
            height="${languageBarH}"
            rx="6"
            fill="url(#langGlassBg)"
          />
  
          <!-- 顶部高光，制造玻璃感 -->
          <rect
            x="${languageBarX + 1}"
            y="${languageBarY + 1}"
            width="${languageBarW - 2}"
            height="${Math.max(3, Math.floor(languageBarH * 0.42))}"
            rx="5"
            fill="url(#langGlassHighlight)"
          />
  
          <!-- 底部暗线，制造厚度 -->
          <line
            x1="${languageBarX + 2}"
            y1="${languageBarY + languageBarH - 1}"
            x2="${languageBarX + languageBarW - 2}"
            y2="${languageBarY + languageBarH - 1}"
            stroke="black"
            stroke-opacity="0.22"
          />
  
          <!-- 彩色分段 -->
          <g clip-path="url(#langClip)">
            ${languageSegments}
          </g>
  
          <!-- 扫光 -->
          ${animate ? `
            <g clip-path="url(#langClip)">
              <rect x="${languageBarX - languageBarW}" y="${languageBarY}" width="${languageBarW}" height="${languageBarH}" fill="url(#langShine)">
                <animate attributeName="x" values="${languageBarX - languageBarW};${languageBarX + languageBarW}" dur="4.8s" repeatCount="indefinite" />
              </rect>
            </g>
          ` : ''}
  
          ${languageLegend}
          ${footerBlock}
        </g>`
    : '';



  const sparkle = animate ? `
    <g opacity="0.9">
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 74} ${gridY + 20}) scale(0.65)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
      </path>
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 318} ${gridY + 110}) scale(0.45)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="2.1s" begin="0.45s" repeatCount="indefinite" />
      </path>
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 650} ${gridY + 48}) scale(0.55)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="0.9s" repeatCount="indefinite" />
      </path>
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${gridX + 710} ${gridY + 66}) scale(0.4)" fill="${themeColors.glow}">
        <animate attributeName="opacity" values="0;1;0" dur="1.4s" begin="1.2s" repeatCount="indefinite" />
      </path>
    </g>` : '';

  const headerTitleX = 24;
  const headerTitleY = 30;
  const headerMetaY = 30;
  const headerSpacerY = 48;
  
  const header = showInternalTitle ? `
    <text x="${headerTitleX}" y="${headerTitleY}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,Verdana,Segoe UI,Arial" font-size="16" font-weight="700" fill="${themeColors.text}">${escapeXml(titleText)}</text>
    <text x="${headerMetaRightX}" y="${headerMetaY}" text-anchor="end" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}">⭐ ${totalStars} stars · 🍴 ${totalForks} forks · @${escapeXml(username)}</text>
    <text x="${headerTitleX}" y="${headerSpacerY}" font-family="Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}"></text>`
    : `
    <text x="${headerMetaRightX}" y="${headerMetaY}" text-anchor="end" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}">⭐ ${totalStars} stars · 🍴 ${totalForks} forks · @${escapeXml(username)}</text>
    <text x="${headerTitleX}" y="${headerSpacerY}" font-family="Verdana,Segoe UI,Arial" font-size="12" fill="${themeColors.subtext}"></text>`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">GitHub contribution trophy for ${escapeXml(username)}</title>
  <desc id="desc">Contribution heatmap with a pixel trophy, streak stats, and award tier based on active contribution days.</desc>
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
    <linearGradient id="streakGrad" x1="0" y1="1" x2="0.8" y2="0">
      <stop offset="0%" stop-color="${themeColors.streak[2]}" />
      <stop offset="60%" stop-color="${themeColors.streak[1]}" />
      <stop offset="100%" stop-color="${themeColors.streak[0]}" />
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    
    <filter id="langOuterGlow" x="-20%" y="-80%" width="140%" height="260%">
      <feGaussianBlur stdDeviation="2.2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <linearGradient id="footerLineBase" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8ecbff" stop-opacity="0.10" />
      <stop offset="50%" stop-color="#bfe4ff" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#8ecbff" stop-opacity="0.10" />
    </linearGradient>
    
    <linearGradient id="footerLineGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="white" stop-opacity="0" />
      <stop offset="50%" stop-color="white" stop-opacity="0.85" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </linearGradient>
    
    <linearGradient id="langGlassBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.16" />
      <stop offset="18%" stop-color="white" stop-opacity="0.08" />
      <stop offset="55%" stop-color="white" stop-opacity="0.03" />
      <stop offset="100%" stop-color="white" stop-opacity="0.06" />
    </linearGradient>
    
    <linearGradient id="langGlassHighlight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.28" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </linearGradient>
    
    <linearGradient id="langShine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="white" stop-opacity="0" />
      <stop offset="45%" stop-color="white" stop-opacity="0" />
      <stop offset="50%" stop-color="white" stop-opacity="0.28" />
      <stop offset="55%" stop-color="white" stop-opacity="0" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </linearGradient>
    
    <linearGradient id="langBlend" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="white" stop-opacity="0" />
      <stop offset="50%" stop-color="white" stop-opacity="0.30" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </linearGradient>
    
    <linearGradient id="langTrackBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.10" />
      <stop offset="100%" stop-color="white" stop-opacity="0.03" />
    </linearGradient>
    
    <linearGradient id="langBorderFlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8ecbff" stop-opacity="0.30" />
      <stop offset="50%" stop-color="#bfe4ff" stop-opacity="0.90" />
      <stop offset="100%" stop-color="#8ecbff" stop-opacity="0.30" />
    </linearGradient>
    
    <clipPath id="langClip">
      <rect x="${languageBarX}" y="${languageBarY}" width="${languageBarW}" height="${languageBarH}" rx="6" />
    </clipPath>
      
  </defs>
  
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="16" fill="${themeColors.panel}" stroke="${themeColors.border}" />
  ${header}

  <g transform="translate(${contentShiftX},0)">
    <g filter="url(#softGlow)">
      ${rects.join('\n    ')}
      ${overlay.join('\n    ')}
    </g>

    ${legend}

    <g>
      ${pills.join('\n')}
    </g>

    ${statCards}
    ${languageBlock}
    ${sparkle}
  </g>
</svg>`;
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
  const { days, activeDaysCount, totalContributions, totalStars, totalForks, languageBreakdown, stats } = await fetchContributionDays(username, token);
  const svg = renderSVG({ days, activeDaysCount, totalContributions, totalStars, totalForks, languageBreakdown, stats });

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
    const imageTag = readmeCentered
      ? `<p align="center">\n  <img src="${relPath}" alt="${username} contribution trophy" />\n</p>`
      : `<img src="${relPath}" alt="${username} contribution trophy" />`;
    const block = `<!-- TROPHY-SVG-START -->\n## ${titleText}\n\n${imageTag}\n\n<!-- TROPHY-SVG-END -->`;

    if (/<!-- TROPHY-SVG-START -->[\s\S]*<!-- TROPHY-SVG-END -->/.test(readme)) {
      readme = readme.replace(/<!-- TROPHY-SVG-START -->[\s\S]*<!-- TROPHY-SVG-END -->/, block);
    } else {
      readme += `\n\n${block}\n`;
    }
    await fs.writeFile(readmeFile, readme, 'utf8');
  }

  console.log(`Generated ${outFile} for @${username} with ${activeDaysCount} active days, ${totalContributions} total contributions, current streak ${stats.current}, longest streak ${stats.longest}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
