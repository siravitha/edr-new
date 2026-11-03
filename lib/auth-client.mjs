/**
 * Client-side auth helpers.
 *
 * - installAuthInterceptor(): wraps window.fetch so that any 401 response from a
 *   protected API (except the /api/auth endpoints themselves) raises a single
 *   "uth-auth-unauthorized" event. The AuthProvider listens for it and switches
 *   the UI back to the login screen (session expired / revoked).
 * - onUnauthorized(cb): subscribe to that event; returns an unsubscribe fn.
 *
 * The interceptor is idempotent: calling installAuthInterceptor() many times
 * (e.g. React StrictMode double-invoking effects) never double-wraps fetch.
 */

const EVENT_NAME = "uth-auth-unauthorized";
const WRAPPED_FLAG = "__UTH_FETCH_WRAPPED__";
const NATIVE_KEY = "__UTH_NATIVE_FETCH__";

export function onUnauthorized(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

export function installAuthInterceptor() {
  if (typeof window === "undefined") return () => {};

  if (!window[WRAPPED_FLAG] && typeof window.fetch === "function") {
    window[NATIVE_KEY] = window.fetch.bind(window);
    const nativeFetch = window[NATIVE_KEY];

    const wrapped = function authFetch(input, init) {
      const url =
        typeof input === "string"
          ? input
          : input && typeof input.url === "string"
            ? input.url
            : "";
      return nativeFetch(input, init).then((response) => {
        if (response && response.status === 401 && url.indexOf("/api/auth") === -1) {
          window.dispatchEvent(new Event(EVENT_NAME));
        }
        return response;
      });
    };

    window.fetch = wrapped;
    window[WRAPPED_FLAG] = true;
  }

  // Returns a dispose fn that restores the original fetch (used in effect cleanup).
  return () => {
    window[WRAPPED_FLAG] = false;
    if (window[NATIVE_KEY]) window.fetch = window[NATIVE_KEY];
  };
}

export { EVENT_NAME as AUTH_UNAUTHORIZED_EVENT };

export default installAuthInterceptor;
