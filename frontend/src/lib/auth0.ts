import { initAuth0 } from '@auth0/nextjs-auth0';

const domain = process.env.AUTH0_DOMAIN || 'your-tenant.auth0.com';
const issuerBaseURL = domain.startsWith('http') ? domain : `https://${domain}`;

export const auth0 = initAuth0({
  secret: process.env.AUTH0_COOKIE_SECRET || 'a-very-long-secret-key-of-at-least-32-characters',
  issuerBaseURL,
  baseURL: process.env.AUTH0_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3000',
  clientID: process.env.AUTH0_CLIENT_ID || 'dummy-client-id',
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  session: {
    rollingDuration: 60 * 60 * 24, // 24 hours
    cookie: {
      domain: process.env.AUTH0_COOKIE_DOMAIN,
    },
  },
  authorizationParams: {
    response_type: 'code',
    audience: process.env.AUTH0_AUDIENCE,
    scope: 'openid profile email offline_access',
  },
});

export type Auth0User = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  'https://cyberoracle.com/roles': string[];
  permissions: string[];
};

export function getUserRoles(user: Auth0User): string[] {
  return user['https://cyberoracle.com/roles'] || ['viewer'];
}

export function hasPermission(user: Auth0User, permission: string): boolean {
  return user.permissions?.includes(permission) || false;
}

export function hasRole(user: Auth0User, role: string): boolean {
  return getUserRoles(user).includes(role);
}