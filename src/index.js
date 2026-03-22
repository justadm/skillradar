const fs = require('fs');
const path = require('path');

const PID_PATH = '/tmp/gridai-bot.pid';

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
  const disableBot = String(process.env.DISABLE_BOT || '').toLowerCase() === 'true';
  const disableWeb = String(process.env.DISABLE_WEB || '').toLowerCase() === 'true';
  if (!disableBot) {
    const jobsToken = process.env.TELEGRAM_BOT_TOKEN_JOBS;
    const hrToken = process.env.TELEGRAM_BOT_TOKEN_HR;
    const legacyToken = process.env.TELEGRAM_BOT_TOKEN;

    if (jobsToken || hrToken) {
      if (jobsToken) {
        startBot({ audience: 'jobs', token: jobsToken });
      }
      if (hrToken) {
        startBot({ audience: 'hr', token: hrToken });
      }
    } else if (legacyToken) {
      startBot({ audience: 'combined', token: legacyToken });
    } else {
      throw new Error('No Telegram bot token configured');
    }
  }
  if (!disableWeb) startWebServer();
}

main();
