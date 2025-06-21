const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://alice-dumpsterfire.forumactif.com';
const START_CATEGORY = '/c2-categorie-2';
const POSTS_PER_PAGE = 5;

const rpStats = {}; // Exemple : { "Alice": 12, "Bob": 5 }

async function fetchHTML(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur HTTP ${response.status} pour ${url}`);
  return await response.text();
}

async function crawlCategory(url) {
  console.log(`→ Catégorie : ${url}`);
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  // Détecter les sous-forums (liens de sous-catégories)
  const subForums = [];
  $('a.forumtitle').each((_, el) => {
    const link = $(el).attr('href');
    if (link && link.startsWith('/f')) {
      subForums.push(new URL(link, BASE_URL).href);
    }
  });

  if (subForums.length > 0) {
    for (const forumUrl of subForums) {
      await crawlCategory(forumUrl);
    }
  }

  // Détecter les liens vers les sujets (topics)
  const topics = [];
  $('a.topictitle').each((_, el) => {
    const link = $(el).attr('href');
    if (link && link.startsWith('/t')) {
      topics.push(new URL(link, BASE_URL).href);
    }
  });

  for (const topicUrl of topics) {
    await crawlTopic(topicUrl);
  }
}

async function crawlTopic(url) {
    console.log(`→ Topic : ${url}`);
    let pageOffset = 0;
    let keepGoing = true;
    const topicMatch = url.match(/\/t(\d+)(?:p\d+)?-(.+)$/);
    if (!topicMatch) return console.warn(`⛔ URL de topic non reconnue : ${url}`);

    const topicId = topicMatch[1];
    const slug = topicMatch[2];

    while (keepGoing) {
    const pageSuffix = pageOffset === 0 ? '' : `p${pageOffset}`;
    const pageUrl = `${BASE_URL}/t${topicId}${pageSuffix ? pageSuffix : ''}-${slug}`;
    console.log(`   ↳ Page : ${pageUrl}`);

    const html = await fetchHTML(pageUrl);
    const $ = cheerio.load(html);

    let postsFound = 0;

    $('.post').each((_, el) => {
      const username = $(el).find('.post_pseudo').first().text().trim();
      if (username) {
        rpStats[username] = (rpStats[username] || 0) + 1;
        postsFound++;
      }
    });

    if (postsFound < POSTS_PER_PAGE) {
      keepGoing = false;
    } else {
      pageOffset += POSTS_PER_PAGE;
    }
  }
}

async function main() {
  await crawlCategory(new URL(START_CATEGORY, BASE_URL).href);

  fs.writeFileSync('rp-stats.json', JSON.stringify(rpStats, null, 2), 'utf-8');
  console.log('✅ Fichier rp-stats.json généré.');
  console.log(rpStats);
}

main().catch(console.error);
