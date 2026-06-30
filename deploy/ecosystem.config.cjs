// PM2 process manager config — runs the two long-lived processes.
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup    (to survive reboots)
//
// Both apps read PORT from the environment, so they MUST be given different
// ports explicitly (otherwise they collide).
module.exports = {
  apps: [
    {
      name: 'tbs-api',
      cwd: __dirname + '/..',
      script: 'npm',
      args: 'run server:start',
      env: { NODE_ENV: 'production', PORT: '3000' },
      max_memory_restart: '512M',
      // If a process crashes on boot (e.g. a missing env var), back off
      // exponentially and give up after 10 tries instead of hammering fork()
      // and exhausting the per-user process limit.
      max_restarts: 10,
      exp_backoff_restart_delay: 200,
    },
    {
      name: 'tbs-ssr',
      cwd: __dirname + '/..',
      script: 'npm',
      args: 'run serve:ssr:TheBlogSphere',
      env: { NODE_ENV: 'production', PORT: '4000' },
      max_memory_restart: '512M',
      // If a process crashes on boot (e.g. a missing env var), back off
      // exponentially and give up after 10 tries instead of hammering fork()
      // and exhausting the per-user process limit.
      max_restarts: 10,
      exp_backoff_restart_delay: 200,
    },
  ],
};
