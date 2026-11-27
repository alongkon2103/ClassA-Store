// Run from the same published release as the website and PayPal worker.
module.exports = {
  apps: [{
    name: 'classa-membership-sync',
    cwd: __dirname,
    script: './worker/membershipWorker.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx --env-file=.env',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 20,
    restart_delay: 5000,
    watch: false,
    time: true,
  }],
}
