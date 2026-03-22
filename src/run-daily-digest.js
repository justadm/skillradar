require('dotenv').config();

const { initDb } = require('./db');
const { runDailyDigest } = require('./bot/job-digest');

async function main() {
  initDb();
  const summary = await runDailyDigest();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('[daily-digest]', err);
  process.exitCode = 1;
});
