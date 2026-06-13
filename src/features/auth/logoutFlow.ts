type PerformOptimisticLogoutOptions = {
  requestLogout: () => Promise<unknown>;
  clearSession: () => void;
  onLoggedOut: () => void;
};

type PerformLocalLogoutOptions = {
  clearSession: () => void;
  onLoggedOut: () => void;
};

export function performLocalLogout({
  clearSession,
  onLoggedOut,
}: PerformLocalLogoutOptions) {
  clearSession();
  onLoggedOut();
}

export function performOptimisticLogout({
  requestLogout,
  clearSession,
  onLoggedOut,
}: PerformOptimisticLogoutOptions) {
  const remoteLogout = requestLogout();
  performLocalLogout({ clearSession, onLoggedOut });
  void Promise.resolve(remoteLogout).catch(() => {
    // Remote logout is best-effort only.
  });
}
