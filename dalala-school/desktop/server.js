#!/usr/bin/env node
/* Dalala School — standalone central server (optional).
   Runs the same shared-database server the desktop app runs in "host" mode, but without a window,
   so it can live on a spare PC, a mini-PC or a Linux box that stays on all day.
   Every computer in the school then chooses "client" mode and enters this machine's address and key.

   Usage:  node server.js [--port 47630] [--dir ./dalala-data] [--key XXXX-XXXX-XXXX]
   The key is created on first run and kept in <dir>/server.json (use --key to set one). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const net = require('./netserver');

const args = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const dir = path.resolve(String(args.dir || process.env.DALALA_DATA || path.join(process.cwd(), 'dalala-data')));
fs.mkdirSync(dir, { recursive: true });
const cfgFile = path.join(dir, 'server.json');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { /* first run */ }
if (args.port || process.env.DALALA_PORT) cfg.port = +(args.port || process.env.DALALA_PORT);
if (args.key || process.env.DALALA_KEY) cfg.key = String(args.key || process.env.DALALA_KEY).trim().toUpperCase();
cfg.port = Math.min(65000, Math.max(1024, cfg.port || 47630));
if (!cfg.key) cfg.key = net.newKey();
fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 1));

let rules = {}; try { rules = require('./netrules'); } catch (e) { /* no product rules */ }
const server = net.createServer({ rules, port: cfg.port, key: cfg.key, dir: path.join(dir, 'shared'), onEvent: (k, m) => { if (k === 'error') console.error('[error]', m); } });
server.listen().then(() => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log('Dalala School server is running.');
  console.log('  Address for the other computers :', ips.map(i => `${i}:${cfg.port}`).join('  |  ') || `(no network) :${cfg.port}`);
  console.log('  Pairing key                      :', cfg.key);
  console.log('  Data folder                      :', dir);
  console.log('On each computer choose Network > Client, enter the address (without the port) and the key.');
}).catch(e => { console.error('Could not start:', e.message); process.exit(1); });
const stop = () => { Promise.resolve(server.close()).catch(() => {}).then(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
