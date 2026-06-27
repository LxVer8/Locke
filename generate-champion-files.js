const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'champions');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    const versions = await fetchJSON('https://ddragon.leagueoflegends.com/api/versions.json');
    const version = versions[0];
    console.log(`Latest version: ${version}`);

    const champsData = await fetchJSON(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );
    const champions = Object.values(champsData.data);

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    let created = 0;
    for (const champ of champions) {
      const filePath = path.join(OUT_DIR, `${champ.id}.json`);
      if (fs.existsSync(filePath)) {
        console.log(`⏭️  ${champ.id}.json already exists – skipped`);
        continue;
      }
      // Skeleton with empty fields
      const skeleton = {
        difficulty: 5,
        generalTip: "",
        earlyGame: "",
        midGame: "",
        lateGame: "",
        matchupNote: "",
        items: [],
        runes: {}
      };
      fs.writeFileSync(filePath, JSON.stringify(skeleton, null, 2), 'utf8');
      created++;
      console.log(`✅ Created ${champ.id}.json`);
    }
    console.log(`\nDone – ${created} new skeleton files created in ${OUT_DIR}`);
  } catch (err) {
    console.error('Error:', err);
  }
})();