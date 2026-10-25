// Cookies de session : jamais lisibles en JavaScript (httpOnly), jamais envoyés par un autre site
import { isProduction } from "./env.js";

// Préfixe __Secure- en production : le navigateur refuse ces cookies s'ils ne viennent pas
// d'une connexion HTTPS (ils ne peuvent pas être posés par une page non chiffrée)
const prefix = isProduction ? "__Secure-" : "";
export const ACCESS_COOKIE = `${prefix}gba_at`;
export const REFRESH_COOKIE = `${prefix}gba_rt`;

export const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const base = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
};

// Le cookie d'accès sert à toute l'API ; celui de renouvellement uniquement aux routes /auth
export const accessCookieOptions = { ...base, path: "/api", maxAge: ACCESS_TTL_MS };
export const refreshCookieOptions = { ...base, path: "/api/auth", maxAge: REFRESH_TTL_MS };

export function setSessionCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
}

export function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: "/api" });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/auth" });
}
