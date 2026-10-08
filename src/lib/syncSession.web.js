const KEY = "activecard.cloud.refresh.v1";
export async function readRefreshToken() {
  return window.sessionStorage.getItem(KEY) || window.localStorage.getItem(KEY);
}
export const readRememberSession = async () => Boolean(window.localStorage.getItem(KEY));
export async function saveRefreshToken(token, remember = false) {
  if (token) {
    (remember ? window.localStorage : window.sessionStorage).setItem(KEY, token);
    (remember ? window.sessionStorage : window.localStorage).removeItem(KEY);
    return;
  }
  window.sessionStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY);
}
