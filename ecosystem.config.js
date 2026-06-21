/**
 * PM2 process configuration for production.
 *   Start:   pm2 start ecosystem.config.js --env production
 *   Logs:    pm2 logs drivex-motors
 *   Restart: pm2 restart drivex-motors
 *   Persist: pm2 save && pm2 startup
 *
 * Note: runs in single-instance "fork" mode. better-sqlite3 is an in-process
 * embedded database, so do NOT scale this app with cluster mode / multiple
 * instances against the same SQLite file.
 */
module.exports = {
  apps: [
    {
      name: 'drivex-motors',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '350M',
      time: true,
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
