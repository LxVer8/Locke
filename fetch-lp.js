const fs = require('fs');
const https = require('https');

const API_KEY = process.env.RIOT_API_KEY;
if (!API_KEY) {
  console.error('RIOT_API_KEY environment variable not set');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('streamers.json', 'utf8'));

function riotRequest(hostname, path, region) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname.replace('REGION', region),
      path: path,
      headers: { 'X-Riot-Token': API_KEY }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`Riot API ${res.statusCode}: ${data}`));
      });
    }).on('error', reject);
  });
}

async function getLP(entry) {
  try {
    // 1. Get PUUID via Account API (supports Riot IDs like "Name#TAG")
    const [gameName, tagLine] = entry.summonerName.split('#');
    const account = await riotRequest(
      'REGION.api.riotgames.com',
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine || '')}`,
      entry.region  // e.g., 'europe' for EUW, 'americas' for NA – see region mapping below
    );

    // 2. Get summoner ID from PUUID (using regional routing, not continental)
    const summoner = await riotRequest(
      `${entry.region}.api.riotgames.com`,
      `/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
      entry.region
    );

    // 3. Get ranked stats
    const leagues = await riotRequest(
      `${entry.region}.api.riotgames.com`,
      `/lol/league/v4/entries/by-summoner/${summoner.id}`,
      entry.region
    );

    const soloQ = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');
    if (!soloQ) {
      // Unranked player – still show them at the bottom with 0 LP
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
    console.error(`Failed for ${entry.summonerName}:`, err.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const leaderboard = [];

  for (const entry of config) {
    const data = await getLP(entry);
    if (data) leaderboard.push(data);
    await sleep(2000); // stay under rate limit
  }

  leaderboard.sort((a, b) => b.leaguePoints - a.leaguePoints);
  fs.writeFileSync('leaderboard.json', JSON.stringify(leaderboard, null, 2));
  console.log('leaderboard.json updated with', leaderboard.length, 'players');
})();