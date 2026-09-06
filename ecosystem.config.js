// PM2 process manager config
// Install: npm install -g pm2
// Start:   pm2 start ecosystem.config.js
// Status:  pm2 status
// Logs:    pm2 logs zag-brakes

module.exports = {
  apps: [{
    name: "zag-brakes",
    script: "server.js",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    // Auto-restart if crash
    autorestart: true,
    max_memory_restart: "500M",
    // Log files
    error_file: "logs/error.log",
    out_file: "logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
};
