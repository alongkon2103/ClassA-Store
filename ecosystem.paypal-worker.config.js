// PM2 config for the PayPal.me email-verification worker — a SEPARATE process
// from the Next.js web app (this project had resource-sharing slowdowns before,
// so the worker must run on its own).
//
//   pm2 start ecosystem.paypal-worker.config.js
//   pm2 logs paypal-mail-worker
//   pm2 restart paypal-mail-worker
//
// Runs the TypeScript worker directly via tsx (a Node import hook) and loads
// secrets from .env with Node's built-in --env-file (requires Node >= 20.6).

module.exports = {
  apps: [
    {
      name: "paypal-mail-worker",
      // __dirname pins cwd to this project folder so `--env-file=.env` and the
      // relative script path resolve correctly no matter where `pm2 start` /
      // `pm2 resurrect` (after a reboot) is invoked from.
      cwd: __dirname,
      script: "./worker/paypalWorker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx --env-file=.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      watch: false,
      time: true,
    },
  ],
}
