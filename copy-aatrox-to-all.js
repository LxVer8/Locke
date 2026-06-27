const fs = require('fs');
const path = require('path');

const championsDir = path.join(__dirname, 'champions');
const sourceFile = path.join(championsDir, 'Aatrox.json');

// Read Aatrox template
let template;
try {
  template = fs.readFileSync(sourceFile, 'utf8');
  // Validate JSON
  JSON.parse(template);
} catch (err) {
  console.error(`❌ Could not read/parse Aatrox.json: ${err.message}`);
  process.exit(1);
}

// Get all .json files except Aatrox.json itself
const files = fs.readdirSync(championsDir).filter(f => f.endsWith('.json') && f !== 'Aatrox.json');

if (files.length === 0) {
  console.log('No other champion files found.');
  process.exit(0);
}

for (const file of files) {
  const filePath = path.join(championsDir, file);
  try {
    fs.writeFileSync(filePath, template, 'utf8');
    console.log(`✅ Overwritten: ${file}`);
  } catch (err) {
    console.warn(`⚠️  Could not write ${file}: ${err.message}`);
  }
}

console.log(`\n🎉 Done! Copied Aatrox.json to ${files.length} champion files.`);