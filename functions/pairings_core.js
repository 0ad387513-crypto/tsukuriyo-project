"use strict";

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomizedRoundRobinPairings(seed, round) {
  const seats = [1, 2, 3, 4];
  const random = mulberry32(((Number(seed) || 0) ^ 0x51F15E) | 0);
  for (let i = seats.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  const [a, b, c, d] = seats;
  const schedule = {
    1: [[a, b], [c, d]],
    2: [[a, c], [b, d]],
    3: [[a, d], [b, c]],
  };
  return schedule[Number(round)] || [];
}

function cpuSeats(session) {
  return [1, 2, 3, 4].filter(seat => session?.seats?.[seat]?.isCpu === true);
}

function pairingsForSession(session, round) {
  const cpus = cpuSeats(session);
  // Four humans, four CPUs, and solo verification (one human + three CPUs)
  // all use the same three-round round-robin.
  if (cpus.length !== 2) return randomizedRoundRobinPairings(session?.seed, round);
  const humans = [1, 2, 3, 4].filter(seat => !cpus.includes(seat));
  // Keep the normal two-human/two-CPU tables separated as before.
  return [humans.slice(0, 2), cpus.slice(0, 2)];
}

module.exports = { randomizedRoundRobinPairings, pairingsForSession };
