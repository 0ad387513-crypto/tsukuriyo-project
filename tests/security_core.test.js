"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const { nextRateLimit } = require("../functions/security_core.js");
test("頻度制限は時間窓内の上限を拒否し、次の窓でリセットする", () => { let value = null; for (let i = 0; i < 3; i++) { const result = nextRateLimit(value, 100 + i, 1000, 2); value = result.value; assert.equal(result.allowed, i < 2); } const reset = nextRateLimit(value, 1200, 1000, 2); assert.equal(reset.allowed, true); assert.equal(reset.value.count, 1); });
