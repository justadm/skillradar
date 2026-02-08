const fs = require('fs');
const path = require('path');

const PID_PATH = '/tmp/skillradar-bot.pid';

function ensureSingleInstance() {
  if (fs.existsSync(PID_PATH)) {
    const pid = Number(fs.readFileSync(PID_PATH, 'utf8')) || 0;
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        console.error(`Bot already running with pid ${pid}. Exiting.`);
        process.exit(1);
      } catch (_) {
        // stale pid file
      }
    }
  }
  fs.writeFileSync(PID_PATH, String(process.pid));
  const cleanup = () => {
    if (fs.existsSync(PID_PATH)) {
      try { fs.unlinkSync(PID_PATH); } catch (_) {}
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

function ensureEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  const examplePath = path.join(__dirname, '../.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
  }
}

ensureSingleInstance();
ensureEnvFile();
require('dotenv').config();

const { initDb } = require('./db');
const { startBot } = require('./bot/bot');
const { startWebServer } = require('./web/server');

function main() {
  initDb();
  startBot();
  startWebServer();
}

main();
