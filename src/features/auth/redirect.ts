// Lecture du lien de retour d'un e-mail Supabase (confirmation d'inscription).
// Module pur, testé. Formats possibles :
//   sauge://#access_token=...&refresh_token=...&type=signup   (flux implicite)
//   sauge://?code=...                                         (flux PKCE)
//   sauge://#error=access_denied&error_description=...        (lien expiré)

export type AuthRedirect =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

function params(part: string): URLSearchParams {
  return new URLSearchParams(part.replace(/^[#?]/, ''));
}

export function parseAuthRedirect(url: string | null | undefined): AuthRedirect {
  if (!url) return { kind: 'none' };
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? params(url.slice(hashIndex)) : new URLSearchParams();
  const query = queryIndex >= 0 ? params(url.slice(queryIndex, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined)) : new URLSearchParams();
  const get = (k: string) => hash.get(k) ?? query.get(k);

  const error = get('error_description') ?? get('error');
  if (error) return { kind: 'error', message: error.replace(/\+/g, ' ') };
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  const code = get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'none' };
}
