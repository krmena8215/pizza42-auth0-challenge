export const auth0Config = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || 'dev-if2hx088kpqzkcd7.us.auth0.com',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || 'https://pizza42-api',
  redirectUri: process.env.REACT_APP_AUTH0_REDIRECT_URI || window.location.origin,
};

export const apiConfig = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
};
