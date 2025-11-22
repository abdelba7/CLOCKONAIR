module.exports = {
  apps: [
    {
      name: "clock-onair-prod",
      script: "server.js",
      env: {
        PORT: 3000,
        NODE_ENV: "production"
      }
    },
    {
      name: "clock-onair-dev",
      script: "server.js",
      env_file: ".env.dev",
      watch: false,
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
