const fs = require('fs');
const https = require('https');

const API_KEY = process.env.RIOT_API_KEY;
if (!API_KEY) {
  console.error('RIOT_API_KEY environment variable not set');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('streamers.json', 'utf8'));
console.log('Loaded', config.length, 'creators from streamers.json');

function riotRequest(hostname, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      path: path,
      headers: { 'X-Riot-Token': API_KEY }
    };
    console.log(`  Requesting: https://${hostname}${path}`);
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function getLP(entry) {
  try {
    const [gameName, tagLine] = entry.summonerName.split('#');
    console.log(`\nProcessing ${gameName}#${tagLine} (continent: ${entry.continent}, region: ${entry.region})`);

    // 1. Account API
    const account = await riotRequest(
      `${entry.continent}.api.riotgames.com`,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    console.log(`  Account found: ${account.puuid}`);

    // 2. Summoner API
    const summoner = await riotRequest(
      `${entry.region}.api.riotgames.com`,
      `/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
    );
    console.log(`  Summoner found: ${summoner.id}`);

    // 3. League API
    const leagues = await riotRequest(
      `${entry.region}.api.riotgames.com`,
      `/lol/league/v4/entries/by-summoner/${summoner.id}`
    );
    console.log(`  Leagues:`, JSON.stringify(leagues));

    const soloQ = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');
    if (!soloQ) {
      console.log('  No Solo/Duo rank found – using fallback (0 LP)');
      return {
        twitch: entry.twitch,
        displayName: entry.displayName || gameName,
        tier: 'Unranked',
        rank: '',
        leaguePoints: 0,
        wins: 0,
        losses: 0,
        winRate: '0'
      };
    }

    console.log(`  Rank: ${soloQ.tier} ${soloQ.rank} – ${soloQ.leaguePoints} LP`);
    return {
      twitch: entry.twitch,
      displayName: entry.displayName || gameName,
      tier: soloQ.tier,
      rank: soloQ.rank,
      leaguePoints: soloQ.leaguePoints,
      wins: soloQ.wins,
      losses: soloQ.losses,
      winRate: soloQ.wins + soloQ.losses > 0
        ? ((soloQ.wins / (soloQ.wins + soloQ.losses)) * 100).toFixed(1)
        : '0'
    };
  } catch (err) {
    console.error(`  ERROR for ${entry.summonerName}:`, err.message);
    return null;
  }
}

(async () => {
  const leaderboard = [];
  for (const entry of config) {
    const data = await getLP(entry);
    if (data) leaderboard.push(data);
    await new Promise(r => setTimeout(r, 2000)); // 2 second delay
  }

  leaderboard.sort((a, b) => b.leaguePoints - a.leaguePoints);
  fs.writeFileSync('leaderboard.json', JSON.stringify(leaderboard, null, 2));
  console.log(`\nleaderboard.json written with ${leaderboard.length} players`);
})();