const fs = require('fs');
const path = require('path');

const template = fs.readFileSync('champions/template.html', 'utf-8');

(async () => {
  // Get latest version (same logic)
  const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r => r.json());
  const latest = versions[0];
  const champs = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`).then(r => r.json());
  const dir = 'champions';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  Object.values(champs.data).forEach(champ => {
    const page = template.replace(/CHAMPION_NAME/g, champ.name);
    fs.writeFileSync(path.join(dir, `${champ.id}.html`), page);
  });

  console.log(`Created ${Object.keys(champs.data).length} champion pages in /champions`);
})();