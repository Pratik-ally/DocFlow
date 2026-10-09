export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isCurrentSessionVersion(authVersion: unknown, databaseVersion: unknown): boolean {
  const currentVersion = typeof databaseVersion === 'number' &&
    Number.isSafeInteger(databaseVersion) &&
    databaseVersion >= 0
    ? databaseVersion
    : 0;

  return typeof authVersion === 'number' &&
    Number.isSafeInteger(authVersion) &&
    authVersion >= 0 &&
    authVersion === currentVersion;
}

export function createFailedLoginUpdatePipeline(lockedUntil: Date) {
  return [
    {
      $set: {
        failedLoginCount: {
          $add: [{ $ifNull: ['$failedLoginCount', 0] }, 1],
        },
      },
    },
    {
      $set: {
        lockedUntil: {
          $cond: [
            { $gte: ['$failedLoginCount', MAX_LOGIN_FAILURES] },
            { $literal: lockedUntil },
            '$lockedUntil',
          ],
        },
        failedLoginCount: {
          $cond: [
            { $gte: ['$failedLoginCount', MAX_LOGIN_FAILURES] },
            0,
            '$failedLoginCount',
          ],
        },
      },
    },
  ];
}
