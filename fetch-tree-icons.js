const fs = require('fs');
const path = require('path');
const https = require('https');

const RUNES_DIR = path.join(__dirname, 'images', 'runes');

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => { file.close(resolve); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

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
    const runesData = await fetchJSON(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`);

    if (!fs.existsSync(RUNES_DIR)) fs.mkdirSync(RUNES_DIR, { recursive: true });

    for (const tree of runesData) {
      const treeName = tree.name; // e.g. "Precision"
      const iconPath = tree.icon; // e.g. "perk-images/Styles/7200_Precision.png"
      const url = `https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`;
      const dest = path.join(RUNES_DIR, `${treeName}.png`);   // e.g. Precision.png
      await downloadImage(url, dest);
      console.log(`✅ Downloaded ${treeName} icon`);
    }
    console.log('🎉 All tree icons saved to images/runes/');
  } catch (err) {
    console.error('Error:', err);
  }
})();