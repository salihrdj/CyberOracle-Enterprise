import { initAuth0 } from '@auth0/nextjs-auth0';

export const auth0 = initAuth0({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  scope: 'openid profile email offline_access',
  audience: process.env.AUTH0_AUDIENCE,
  redirectUri: process.env.AUTH0_REDIRECT_URI,
  postLogoutRedirectUri: process.env.AUTH0_POST_LOGOUT_REDIRECT_URI,
  session: {
    cookieSecret: process.env.AUTH0_COOKIE_SECRET!,
    cookieLifetime: 60 * 60 * 24, // 24 hours
    cookieDomain: process.env.AUTH0_COOKIE_DOMAIN,
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