module.exports = {
  apps: [
    {
      name: "medistock-backend",
      cwd: "/home/teklin.in/medistock.teklin.in/backend",
      script: "npm",
      args: "run start",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
    {
      name: "medistock-frontend",
      cwd: "/home/teklin.in/medistock.teklin.in",
      script: "npm",
      args: "run start:frontend",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
  ],
};
