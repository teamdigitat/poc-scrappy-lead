/**
 * LinkedIn Job Scraper — No Login + Google AI Studio (Gemini)
 *
 * Install: npm install axios cheerio @google/generative-ai
 * Usage:   node scraper.js "find me mern stack roles in mumbai"
 *          node scraper.js "senior react developer pune 5 years exp" --max 75
 *          node scraper.js "work from home python developer"
 *
 * Set your key:  export GEMINI_API_KEY=AIza...
 *                or create a .env file:  GEMINI_API_KEY=AIza...
 *
 * Get a free key at: https://aistudio.google.com/app/apikey
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

/**
 * LinkedIn Scraper — LLM Pipeline
 *
 *  RAW QUERY
 *      │
 *      ▼
 *  [STAGE 1] Gemini refines the query into clean search terms
 *      │
 *      ▼
 *  [STAGE 2] Gemini identifies intent → jobs | people | posts | companies
 *      │
 *      ▼
 *  [STAGE 3] Route to correct scraper
 *      │
 *      ▼
 *  [STAGE 4] Gemini re-ranks results by relevance
 *      │
 *      ▼
 *   RESULTS
 *
 * Install: npm install axios cheerio @google/generative-ai
 * Usage:   node scraper.js "list of all people working at Catalyst Media Integrated LLP"
 *          node scraper.js "mern jobs mumbai fresher"
 *          node scraper.js "latest posts about AI in india"
 *          node scraper.js "find infosys company profile"
 *
 * Set key:  export GEMINI_API_KEY=AIza...
 *           or .env:  GEMINI_API_KEY=AIza...
 */

// ── Load .env ──
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf-8')
    .split('\n')
    .forEach((line) => {
      const [k, ...v] = line.split('=');
      if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim();
    });
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

const sleep = ([mn, mx]) =>
  new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * (mx - mn + 1)) + mn),
  );

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

const headers = (ref = 'https://www.google.com/') => ({
  'User-Agent': UA_LIST[Math.floor(Math.random() * UA_LIST.length)],
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: ref,
  'Cache-Control': 'no-cache',
});

function log(icon, label, value) {
  const val = value !== undefined ? `${label}: ${value}` : label;
  console.log(`   ${icon}  ${val}`);
}

function divider(title = '') {
  const line = '─'.repeat(58);
  if (title) console.log(`\n${line}\n  ${title}\n${line}\n`);
  else console.log(line);
}

// ─── GEMINI ───────────────────────────────────────────────────────────────────

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error(
      '\n❌  GEMINI_API_KEY not set. Get free key → https://aistudio.google.com/app/apikey\n',
    );
    process.exit(1);
  }
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
}

async function ask(gemini, prompt) {
  const res = await gemini.generateContent(prompt);
  return JSON.parse(res.response.text());
}

// ══════════════════════════════════════════════════════════════════════════════
//  STAGE 1 — QUERY REFINEMENT
//  Takes messy natural language → clean, structured search terms
// ══════════════════════════════════════════════════════════════════════════════

async function refineQuery(rawQuery, gemini) {
  process.stdout.write('\n📝  [Stage 1] Refining query… ');

  const result = await ask(
    gemini,
    `
You are a LinkedIn search query optimizer.
Take the user's raw input and rewrite it into precise, effective search terms.

Return ONLY valid JSON:
{
  "refined": "the cleaned up, optimized version of the query (remove typos, filler words, make it precise)",
  "keywords": ["keyword1", "keyword2"],     // core search keywords extracted
  "company": "company name if mentioned, else ''",
  "person": "person name if mentioned, else ''",
  "location": "city/region if mentioned, else ''",
  "topic": "topic or subject if searching for posts/content, else ''",
  "timeframe": "recent | last week | last month | any — inferred from context",
  "notes": "any other important context from the query"
}

Raw query: "${rawQuery}"
`,
  );

  console.log('✓');
  log('✏️ ', 'Refined', result.refined);
  if (result.keywords?.length)
    log('🔑', 'Keywords', result.keywords.join(', '));
  if (result.company) log('🏢', 'Company', result.company);
  if (result.person) log('👤', 'Person', result.person);
  if (result.location) log('📍', 'Location', result.location);
  if (result.topic) log('💬', 'Topic', result.topic);

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  STAGE 2 — INTENT DETECTION
//  Decides WHAT to scrape and extracts scraper-ready parameters
// ══════════════════════════════════════════════════════════════════════════════

async function detectIntent(refinedQuery, gemini) {
  process.stdout.write('\n🎯  [Stage 2] Detecting intent… ');

  const result = await ask(
    gemini,
    `
You are a LinkedIn intent classifier. Based on the refined query data,
determine exactly what the user wants to find on LinkedIn.

Refined query context: ${JSON.stringify(refinedQuery)}

Intents available:
- "jobs"      → searching for job openings/listings
- "people"    → searching for people / employees at a company or with a title
- "posts"     → searching for LinkedIn posts / articles / content on a topic
- "company"   → searching for a company profile / info

Return ONLY valid JSON:
{
  "intent": "jobs" | "people" | "posts" | "company",
  "confidence": 0-100,
  "reason": "one sentence explaining why this intent was chosen",

  "params": {
    // For "jobs":
    "keyword": "job title or skill set (e.g. 'MERN Stack Developer')",
    "location": "city/region or ''",
    "seniority": "internship|entry|associate|mid-senior|director|executive|''",
    "jobType": "full-time|part-time|contract|temporary|internship|''",
    "remote": "on-site|remote|hybrid|''",

    // For "people":
    "company": "exact company name",
    "role": "job title to filter by or ''",
    "location": "city to filter by or ''",

    // For "posts":
    "topic": "topic/keywords to search for posts about",
    "author": "specific person's name if searching their posts, else ''",

    // For "company":
    "name": "company name to look up"
  }
}
`,
  );

  console.log('✓');
  log('🎯', 'Intent', result.intent.toUpperCase());
  log('💯', 'Confidence', `${result.confidence}%`);
  log('💡', 'Reason', result.reason);

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  STAGE 3 — SCRAPERS
// ══════════════════════════════════════════════════════════════════════════════

// ── 3A: JOBS ─────────────────────────────────────────────────────────────────

const SENIORITY = {
  internship: '1',
  entry: '2',
  associate: '3',
  'mid-senior': '4',
  director: '5',
  executive: '6',
};
const JOB_TYPE = {
  'full-time': 'F',
  'part-time': 'P',
  contract: 'C',
  temporary: 'T',
  internship: 'I',
};
const REMOTE = { 'on-site': '1', remote: '2', hybrid: '3' };

async function scrapeJobs(params, max) {
  divider('SCRAPING JOBS');
  const allJobs = [];
  const seen = new Set();
  let start = 0,
    empty = 0;

  while (allJobs.length < max && empty < 3) {
    process.stdout.write(`   📄  Batch ${start}–${start + 24}… `);

    try {
      const query = {
        keywords: params.keyword,
        location: params.location || '',
        start,
        f_TPR: 'r2592000',
      };
      if (params.seniority && SENIORITY[params.seniority])
        query.f_E = SENIORITY[params.seniority];
      if (params.jobType && JOB_TYPE[params.jobType])
        query.f_JT = JOB_TYPE[params.jobType];
      if (params.remote && REMOTE[params.remote])
        query.f_WT = REMOTE[params.remote];

      const { data } = await axios.get(
        'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search',
        {
          params: query,
          headers: headers('https://www.google.com/'),
          timeout: 15000,
        },
      );

      const $ = cheerio.load(data);
      const fresh = [];

      $('li').each((_, el) => {
        const c = $(el);
        const title = c.find('.base-search-card__title').text().trim();
        const company = c.find('.base-search-card__subtitle').text().trim();
        const loc = c.find('.job-search-card__location').text().trim();
        const posted = c.find('time').attr('datetime') || '';
        const link =
          c.find('a.base-card__full-link').attr('href')?.split('?')[0] || '';
        const jobId = link.match(/view\/(\d+)/)?.[1] || '';
        if (title && !seen.has(jobId)) {
          seen.add(jobId);
          fresh.push({ title, company, location: loc, posted, jobId, link });
        }
      });

      if (!fresh.length) {
        empty++;
        console.log('(empty)');
      } else {
        empty = 0;
        fresh.slice(0, max - allJobs.length).forEach((j) => allJobs.push(j));
        console.log(
          `✓  +${Math.min(fresh.length, max - allJobs.length)}  (total: ${allJobs.length})`,
        );
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      break;
    }

    start += 25;
    await sleep([900, 2000]);
  }

  // Enrich top 10
  console.log('\n   🔎  Enriching top 10 with details…');
  for (let i = 0; i < Math.min(10, allJobs.length); i++) {
    try {
      const { data } = await axios.get(
        `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${allJobs[i].jobId}`,
        { headers: headers(), timeout: 10000 },
      );
      const $ = cheerio.load(data);
      const txt = $('.description__text').text().replace(/\s+/g, ' ').trim();
      const cr = $('span.description__job-criteria-text');
      Object.assign(allJobs[i], {
        seniority: cr.eq(0).text().trim(),
        employmentType: cr.eq(1).text().trim(),
        description: txt.slice(0, 500) + (txt.length > 500 ? '…' : ''),
      });
    } catch {
      /* skip */
    }
    await sleep([400, 800]);
  }

  return allJobs;
}

// ── 3B: PEOPLE ────────────────────────────────────────────────────────────────

async function scrapePeople(params, max) {
  divider('SCRAPING PEOPLE');
  const { company, role, location } = params;

  const queries = [
    `site:linkedin.com/in "${company}"`,
    role ? `site:linkedin.com/in "${company}" "${role}"` : null,
    location ? `site:linkedin.com/in "${company}" "${location}"` : null,
    `site:linkedin.com/in "${company}" employee`,
  ].filter(Boolean);

  const all = [];
  const seen = new Set();

  for (const q of queries) {
    if (all.length >= max) break;
    process.stdout.write(`   🔎  DDG: "${q}"… `);

    try {
      const { data } = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q, kl: 'in-en' },
        headers: headers('https://duckduckgo.com/'),
        timeout: 15000,
      });

      const $ = cheerio.load(data);
      let added = 0;

      $('.result').each((_, el) => {
        if (all.length >= max) return;
        const r = $(el);
        const rawUrl =
          r.find('a.result__url').text().trim() ||
          r.find('.result__a').attr('href') ||
          '';
        const m = rawUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/);
        if (!m) return;

        const profileUrl = `https://www.linkedin.com/in/${m[1]}`;
        if (seen.has(profileUrl)) return;
        seen.add(profileUrl);

        const titleTxt = r
          .find('.result__a')
          .text()
          .trim()
          .replace(/\s*\|\s*LinkedIn\s*$/i, '');
        const snippetTxt = r.find('.result__snippet').text().trim();

        // Parse "Name - Title at Company"
        const dash = titleTxt.match(/^(.+?)\s*[-–]\s*(.+)$/);
        let name = titleTxt,
          jobTitle = '',
          co = '';
        if (dash) {
          name = dash[1].trim();
          const at = dash[2].match(/^(.+?)\s+at\s+(.+)$/i);
          jobTitle = at ? at[1].trim() : dash[2].trim();
          co = at ? at[2].trim() : '';
        }

        all.push({
          name,
          jobTitle,
          company: co,
          profileUrl,
          snippet: snippetTxt,
        });
        added++;
      });

      console.log(`✓  +${added}  (total: ${all.length})`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }

    await sleep([1200, 2500]);
  }

  return all;
}

// ── 3C: POSTS ─────────────────────────────────────────────────────────────────

async function scrapePosts(params, max) {
  divider('SCRAPING POSTS');
  const { topic, author } = params;

  const q = author
    ? `site:linkedin.com/posts "${author}" ${topic}`
    : `site:linkedin.com/posts ${topic}`;

  process.stdout.write(`   🔎  DDG: "${q}"… `);

  const posts = [];
  try {
    const { data } = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q, kl: 'in-en' },
      headers: headers('https://duckduckgo.com/'),
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    $('.result').each((_, el) => {
      if (posts.length >= max) return;
      const r = $(el);
      const rawUrl = r.find('a.result__url').text().trim() || '';
      if (!rawUrl.includes('linkedin.com')) return;

      const title = r.find('.result__a').text().trim();
      const snippet = r.find('.result__snippet').text().trim();
      const link = r.find('a.result__a').attr('href') || '';

      // Extract author from title "Post by Name"
      const authorMatch = title.match(/(?:by|from)\s+(.+?)(?:\s*[-|]|$)/i);
      posts.push({
        title,
        author: authorMatch?.[1]?.trim() || '',
        snippet,
        link,
      });
    });

    console.log(`✓  found ${posts.length} posts`);
  } catch (e) {
    console.log(`❌ ${e.message}`);
  }

  return posts;
}

// ── 3D: COMPANY ───────────────────────────────────────────────────────────────

async function scrapeCompany(params, max) {
  divider('SCRAPING COMPANY');
  const q = `site:linkedin.com/company "${params.name}"`;
  process.stdout.write(`   🔎  DDG: "${q}"… `);

  const companies = [];
  try {
    const { data } = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q, kl: 'in-en' },
      headers: headers('https://duckduckgo.com/'),
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    $('.result').each((_, el) => {
      if (companies.length >= max) return;
      const r = $(el);
      const rawUrl = r.find('a.result__url').text().trim() || '';
      if (!rawUrl.includes('linkedin.com/company')) return;

      const name = r
        .find('.result__a')
        .text()
        .trim()
        .replace(/\s*\|\s*LinkedIn\s*$/i, '');
      const snippet = r.find('.result__snippet').text().trim();
      const m = rawUrl.match(/linkedin\.com\/company\/([a-zA-Z0-9\-_]+)/);
      const link = m ? `https://www.linkedin.com/company/${m[1]}` : '';

      companies.push({ name, snippet, link });
    });

    console.log(`✓  found ${companies.length} companies`);
  } catch (e) {
    console.log(`❌ ${e.message}`);
  }

  return companies;
}

// ══════════════════════════════════════════════════════════════════════════════
//  STAGE 4 — RE-RANK
// ══════════════════════════════════════════════════════════════════════════════

async function rerank(items, intent, originalQuery, gemini) {
  if (!items.length) return items;
  process.stdout.write(
    `\n🏆  [Stage 4] Gemini re-ranking ${items.length} results… `,
  );

  const list = items
    .slice(0, 40)
    .map((item, i) => {
      switch (intent) {
        case 'jobs':
          return `${i}: ${item.title} @ ${item.company} (${item.location})`;
        case 'people':
          return `${i}: ${item.name} — ${item.jobTitle} at ${item.company}`;
        case 'posts':
          return `${i}: ${item.title} — ${item.snippet?.slice(0, 80)}`;
        case 'company':
          return `${i}: ${item.name} — ${item.snippet?.slice(0, 80)}`;
      }
    })
    .join('\n');

  const result = await ask(
    gemini,
    `
Rank these LinkedIn ${intent} results by relevance to the user's original query.

Original query: "${originalQuery}"
Type: ${intent}

Results:
${list}

Return ONLY valid JSON:
{ "rankings": [ { "index": 0, "score": 95, "reason": "exact match" } ] }

Include ALL ${items.slice(0, 40).length} items. Score 0–100. Reason: max 8 words.
`,
  );

  console.log('✓');

  return items
    .map((item, i) => {
      const r = result.rankings.find((r) => r.index === i);
      return { ...item, score: r?.score ?? 50, reason: r?.reason ?? '' };
    })
    .sort((a, b) => b.score - a.score);
}

// ══════════════════════════════════════════════════════════════════════════════
//  PRINT
// ══════════════════════════════════════════════════════════════════════════════

function printResults(items, intent) {
  const MAX_PRINT = intent === 'people' ? 20 : 10;
  divider(`RESULTS — ${intent.toUpperCase()} (ranked by Gemini)`);

  items.slice(0, MAX_PRINT).forEach((item, i) => {
    const n = String(i + 1).padStart(3);
    const score = item.score ? ` [${item.score}/100]` : '';

    switch (intent) {
      case 'jobs':
        console.log(`${n}.${score} ${item.title}`);
        console.log(`     🏢  ${item.company}`);
        console.log(`     📍  ${item.location}   📅  ${item.posted}`);
        if (item.seniority)
          console.log(
            `     🎯  ${item.seniority}   💼  ${item.employmentType}`,
          );
        if (item.reason) console.log(`     ✨  ${item.reason}`);
        if (item.description)
          console.log(`     📝  ${item.description.slice(0, 110)}…`);
        console.log(`     🔗  ${item.link}\n`);
        break;

      case 'people':
        console.log(`${n}.${score} ${item.name || 'Unknown'}`);
        if (item.jobTitle) console.log(`     💼  ${item.jobTitle}`);
        if (item.company) console.log(`     🏢  ${item.company}`);
        if (item.reason) console.log(`     ✨  ${item.reason}`);
        console.log(`     🔗  ${item.profileUrl}\n`);
        break;

      case 'posts':
        console.log(`${n}.${score} ${item.title}`);
        if (item.author) console.log(`     👤  ${item.author}`);
        if (item.snippet)
          console.log(`     📝  ${item.snippet.slice(0, 120)}…`);
        if (item.reason) console.log(`     ✨  ${item.reason}`);
        console.log(`     🔗  ${item.link}\n`);
        break;

      case 'company':
        console.log(`${n}.${score} ${item.name}`);
        if (item.snippet)
          console.log(`     📝  ${item.snippet.slice(0, 120)}…`);
        if (item.reason) console.log(`     ✨  ${item.reason}`);
        console.log(`     🔗  ${item.link}\n`);
        break;
    }
  });

  if (items.length > MAX_PRINT)
    console.log(
      `     … and ${items.length - MAX_PRINT} more saved in results.json`,
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ══════════════════════════════════════════════════════════════════════════════

async function run(rawQuery, max) {
  divider(`LINKEDIN SCRAPER PIPELINE`);
  console.log(`   Query: "${rawQuery}"`);

  const gemini = getModel();

  // ── Stage 1: Refine ──
  const refined = await refineQuery(rawQuery, gemini);

  // ── Stage 2: Intent ──
  const { intent, confidence, reason, params } = await detectIntent(
    refined,
    gemini,
  );

  // ── Stage 3: Scrape ──
  let results;
  switch (intent) {
    case 'jobs':
      results = await scrapeJobs(params, max);
      break;
    case 'people':
      results = await scrapePeople(params, max);
      break;
    case 'posts':
      results = await scrapePosts(params, max);
      break;
    case 'company':
      results = await scrapeCompany(params, max);
      break;
    default:
      console.error(`\n❌  Unknown intent: ${intent}`);
      process.exit(1);
  }

  console.log(`\n   ✅  Collected ${results.length} raw results.`);

  // ── Stage 4: Re-rank ──
  const ranked = await rerank(results, intent, rawQuery, gemini);

  // ── Print ──
  printResults(ranked, intent);

  // ── Save ──
  const output = {
    rawQuery,
    intent,
    confidence,
    intentReason: reason,
    refinedQuery: refined,
    params,
    scrapedAt: new Date().toISOString(),
    total: ranked.length,
    results: ranked,
  };
  fs.writeFileSync('results.json', JSON.stringify(output, null, 2));
  console.log(`\n💾  Full results → results.json\n`);
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const max = maxIdx !== -1 ? parseInt(args[maxIdx + 1]) || 50 : 50;
const query = args.filter((_, i) => i !== maxIdx && i !== maxIdx + 1).join(' ');

if (!query) {
  console.log(`
Usage: node scraper.js <query> [--max N]

Examples:
  node scraper.js "list all people at Catalyst Media Integrated LLP" --max 100
  node scraper.js "mern developer jobs in mumbai fresher"
  node scraper.js "latest posts about AI startups in india"
  node scraper.js "find tata consultancy company profile"
  node scraper.js "senior python developer remote" --max 75
`);
  process.exit(1);
}

run(query, max).catch((err) => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
