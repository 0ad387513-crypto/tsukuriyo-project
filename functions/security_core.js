"use strict";
function nextRateLimit(current, now, windowMs, maxCount) {
  const existing = current && Number(current.windowStartedAt) > 0 ? current : null;
  if (!existing || now - Number(existing.windowStartedAt) >= windowMs) return { allowed: true, value: { windowStartedAt: now, count: 1, updatedAt: now } };
  const count = Number(existing.count || 0) + 1;
  return { allowed: count <= maxCount, value: { windowStartedAt: existing.windowStartedAt, count, updatedAt: now } };
}
module.exports = { nextRateLimit };
