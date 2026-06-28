const fs = require('fs');
const https = require('https');

const API_KEY = process.env.RIOT_API_KEY;
if (!API_KEY) {
  console.error('RIOT_API_KEY environment variable not set');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('streamers.json', 'utf8'));
const leaderboard = [];

function riotRequest(path, region) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${region}.api.riotgames.com`,
      path: path,
      headers: { 'X-Riot-Token': API_KEY }
    };
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`Status ${res.statusCode}: ${data}`));
      });
    }).on('error', reject);
  });
}

async function getLP(entry) {
  try {
    // 1. Get summoner ID
    const summoner = await riotRequest(
      `/lol/summoner/v4/summoners/by-name/${encodeURIComponent(entry.summonerName)}`,
      entry.region
    );

    // 2. Get ranked stats
    const leagues = await riotRequest(
      `/lol/league/v4/entries/by-summoner/${summoner.id}`,
      entry.region
    );

    // Find Solo/Duo queue
    const soloQ = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');
    if (!soloQ) return null;

    return {
      twitch: entry.twitch,
      displayName: entry.displayName || entry.summonerName,
      tier: soloQ.tier,
      rank: soloQ.rank,
      leaguePoints: soloQ.leaguePoints,
      wins: soloQ.wins,
      losses: soloQ.losses,
      winRate: ((soloQ.wins / (soloQ.wins + soloQ.losses)) * 100).toFixed(1),
      profileIcon: summoner.profileIconId
    };
  } catch (err) {
    console.error(`Failed for ${entry.summonerName}:`, err.message);
    return null;
  }
}

(async () => {
  for (const entry of config) {
    const data = await getLP(entry);
    if (data) leaderboard.push(data);
  }

  // Sort by LP descending
  leaderboard.sort((a, b) => b.leaguePoints - a.leaguePoints);

  fs.writeFileSync('leaderboard.json', JSON.stringify(leaderboard, null, 2));
  console.log('leaderboard.json updated');
})();