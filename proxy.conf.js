const { env } = require('process');

const target = 'http://localhost:8080';

const PROXY_CONFIG = [
  {
    context: ['/api'],
    target: target,
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/generate-captcha': '/api/generateCaptcha',
      '^/api/validate-login': '/api/validateLogin'
    },
  },
];

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;
