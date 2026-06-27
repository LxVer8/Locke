const fs = require('fs');
const path = require('path');
const https = require('https');

// ---------- CONFIG ----------
const ITEMS_DIR = path.join(__dirname, 'images', 'items');

// ---------- HELPERS ----------
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

// Sanitise item name to a safe file name
function safeFileName(name) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 \-\'\.]/g, '')   // keep letters, numbers, spaces, hyphens, apostrophes, dots
    .replace(/\s+/g, '_')                   // replace spaces with underscores
    .replace(/'/g, '')                      // remove apostrophes
    .replace(/\.+/g, '_')                   // dots to underscores (avoid confusion with extension)
    .replace(/_+/g, '_')                    // collapse multiple underscores
    .replace(/^_|_$/g, '')                  // trim leading/trailing underscores
    || 'unknown_item';                      // fallback if name becomes empty
}

// ---------- MAIN ----------
(async () => {
  try {
    console.log('🔍 Fetching latest Data Dragon version...');
    const versions = await fetchJSON('https://ddragon.leagueoflegends.com/api/versions.json');
    const version = versions[0];
    console.log(`📦 Latest version: ${version}`);

    console.log('📋 Fetching item list...');
    const itemsData = await fetchJSON(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`
    );
    const items = itemsData.data;
    console.log(`🔢 Total items in data: ${Object.keys(items).length}`);

    // Only Summoner's Rift (map 11)
    const riftItems = Object.entries(items).filter(([id, item]) => {
      return item.maps && item.maps['11'] === true;
    });
    console.log(`🎯 Summoner's Rift items: ${riftItems.length}`);

    if (!fs.existsSync(ITEMS_DIR)) {
      fs.mkdirSync(ITEMS_DIR, { recursive: true });
      console.log(`📁 Created folder: ${ITEMS_DIR}`);
    }

    let downloaded = 0;
    const total = riftItems.length;

    for (const [id, item] of riftItems) {
      const safeName = safeFileName(item.name);
      const url = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
      const dest = path.join(ITEMS_DIR, `${safeName}.png`);

      try {
        await downloadImage(url, dest);
        downloaded++;
        console.log(`✅ [${downloaded}/${total}] ${item.name} → ${safeName}.png`);
      } catch (err) {
        console.warn(`⚠️  Failed to download ${item.name}: ${err.message}`);
      }
    }

    console.log(`\n🎉 Done! Downloaded ${downloaded} item icons with clean names into:\n   ${ITEMS_DIR}`);
  } catch (err) {
    console.error('❌ Script failed:', err);
  }
})();