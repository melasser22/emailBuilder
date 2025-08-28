// instanceTracker.ts
const userInstanceCounters: Record<string, number> = {};
const devModeMounts: Record<string, boolean> = {};

export function getNewInstanceId(userId: string, tenantId: string): number {
  const key = `${userId}_${tenantId}`;

  // If we already mounted once in dev, don’t increment again
  if (process.env.NODE_ENV !== 'production' && devModeMounts[key]) {
    return userInstanceCounters[key];
  }

  if (!userInstanceCounters[key]) {
    userInstanceCounters[key] = 0;
  }
  userInstanceCounters[key] += 1;

  if (process.env.NODE_ENV !== 'production') {
    devModeMounts[key] = true;
  }

  return userInstanceCounters[key];
}

export function releaseInstanceId(userId: string, tenantId: string) {
  const key = `${userId}_${tenantId}`;
  delete userInstanceCounters[key];
  delete devModeMounts[key];
}
