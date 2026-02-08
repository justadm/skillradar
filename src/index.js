require('dotenv').config();

const { initDb } = require('./db');
const { startBot } = require('./bot/bot');

function main() {
  initDb();
  startBot();
}

main();
