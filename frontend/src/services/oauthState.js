const STORAGE_KEY = "aidss_github_oauth_state";

export function createOAuthState(storage = sessionStorage, cryptoApi = crypto) {
  const state = cryptoApi.randomUUID();
  storage.setItem(STORAGE_KEY, state);
  return state;
}

export function consumeOAuthState(returnedState, storage = sessionStorage) {
  const expectedState = storage.getItem(STORAGE_KEY);
  storage.removeItem(STORAGE_KEY);
  return Boolean(returnedState && expectedState && returnedState === expectedState);
}
