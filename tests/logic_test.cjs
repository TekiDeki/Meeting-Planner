#!/usr/bin/env node
/* Meeting Planner · logic tests
 * SPDX-License-Identifier: Apache-2.0
 *
 * node tests/logic_test.cjs
 * Pure engine and city list only: no browser, no network.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');

const P = require(path.join(__dirname, '..', 'src', 'planner.js'));
const C = require(path.join(__dirname, '..', 'src', 'cities.js'));

let checks = 0;
function ok(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}
function eq(actual, expected, message) {
  checks += 1;
  assert.strictEqual(actual, expected, message + ' (got ' + actual + ', wanted ' + expected + ')');
}

/* ---------------------------------------------------------------- offsets */

const WINTER = Date.UTC(2026, 0, 15, 12, 0);
const SUMMER = Date.UTC(2026, 6, 15, 12, 0);

eq(P.zoneOffset('Europe/Belgrade', WINTER), 60, 'Belgrade in January is UTC+1');
eq(P.zoneOffset('Europe/Belgrade', SUMMER), 120, 'Belgrade in July is UTC+2');
eq(P.zoneOffset('America/New_York', WINTER), -300, 'New York in January is UTC-5');
eq(P.zoneOffset('America/New_York', SUMMER), -240, 'New York in July is UTC-4');
eq(P.zoneOffset('Asia/Kolkata', WINTER), 330, 'Kolkata keeps a half hour offset');
eq(P.zoneOffset('Asia/Kathmandu', WINTER), 345, 'Kathmandu keeps a quarter hour offset');
eq(P.zoneOffset('Pacific/Chatham', WINTER), 825, 'Chatham is UTC+13:45 in January');
eq(P.zoneOffset('UTC', WINTER), 0, 'UTC is zero');

/* Opposing hemispheres switch on different dates, which is the whole reason a
 * static offset table in the page would be wrong half the year. */
eq(P.zoneOffset('Australia/Sydney', Date.UTC(2026, 0, 15)), 660, 'Sydney in January is UTC+11');
eq(P.zoneOffset('Europe/London', Date.UTC(2026, 1, 1)), 0, 'London in February is UTC+0');
eq(P.zoneOffset('Europe/London', Date.UTC(2026, 7, 1)), 60, 'London in August is UTC+1');

/* ------------------------------------------------------------------ clock */

eq(P.hhmm(0), '00:00', 'midnight');
eq(P.hhmm(9 * 60 + 30), '09:30', 'half past nine');
eq(P.hhmm(1439), '23:59', 'last minute');
eq(P.hhmm(1440), '00:00', 'midnight wraps');
eq(P.hhmm(-60), '23:00', 'negative minutes wrap');

eq(P.addDays('2026-10-31', 1), '2026-11-01', 'day after the 31st');
eq(P.addDays('2026-12-31', 1), '2027-01-01', 'day after new year');
eq(P.addDays('2026-03-01', -1), '2026-02-28', 'leap year check');
eq(P.dayOffsetBetween('2026-10-19', '2026-10-20'), 1, 'next day offset');
eq(P.dayOffsetBetween('2026-10-20', '2026-10-19'), -1, 'previous day offset');
eq(P.dayOffsetBetween('2026-10-19', '2026-10-19'), 0, 'same day offset');

/* ------------------------------------------------------------- day starts */

eq(P.wallKey('Europe/Belgrade', P.dayStartUtc('Europe/Belgrade', '2026-10-19')), '2026-10-19',
  'day start lands on the right date');
eq(P.localMinutes('Europe/Belgrade', P.dayStartUtc('Europe/Belgrade', '2026-10-19')), 0,
  'day start is local midnight');

/* On 2026-03-29 Belgrade jumps from 02:00 to 03:00. Midnight exists, but the
 * 02:00 hour does not, and the grid must not invent it. */
const spring = P.rows('Europe/Belgrade', '2026-03-29', null);
ok(spring.length === 24, 'the grid always has 24 rows');
ok(spring.some((row) => row.label === '02:00') === false, 'the skipped hour is absent');
ok(spring.some((row) => row.label === '03:00'), 'the hour after the jump exists');

/* On 2026-10-25 the hour from 02:00 to 03:00 happens twice. */
const autumn = P.rows('Europe/Belgrade', '2026-10-25', null);
ok(autumn.some((row) => row.label === '02:00'), 'the repeated hour appears');

/* ------------------------------------------------------------- classifying */

eq(P.classify(9 * 60, 9, 18), P.WORK, '09:00 is working');
eq(P.classify(17 * 60 + 59, 9, 18), P.WORK, '17:59 is working');
eq(P.classify(18 * 60, 9, 18), P.AWAKE, '18:00 is off work');
eq(P.classify(7 * 60, 9, 18), P.AWAKE, '07:00 is awake but early');
eq(P.classify(19 * 60 + 30, 9, 18), P.AWAKE, '19:30 is awake but late');
eq(P.classify(3 * 60, 9, 18), P.NIGHT, '03:00 is the night');
eq(P.classify(23 * 60, 9, 18), P.NIGHT, '23:00 is the night');

/* A night shift crosses midnight, so the range has to wrap. */
eq(P.classify(23 * 60, 22, 6), P.WORK, '23:00 inside a night shift');
eq(P.classify(2 * 60, 22, 6), P.WORK, '02:00 inside a night shift');
/* For somebody working 22 to 06, noon is the middle of their night. */
eq(P.classify(12 * 60, 22, 6), P.NIGHT, 'noon is sleep for a night shift');
eq(P.classify(20 * 60, 22, 6), P.AWAKE, '20:00 is awake before a night shift');

/* ----------------------------------------------------------------- overlap */

const belgrade = 'Europe/Belgrade';
const newYork = 'America/New_York';

const two = P.overlap([belgrade, newYork], {
  dateKey: '2026-10-19', homeZone: belgrade, workStart: 9, workEnd: 18
});
eq(two.kind, 'all', 'Belgrade and New York overlap on a working day');
eq(two.startLabel, '15:00', 'the window opens at 15:00 Belgrade');
eq(two.endLabel, '18:00', 'the window closes at 18:00 Belgrade');
eq(two.minutes, 180, 'three hours of overlap');
eq(two.rows[1].start, '09:00', 'and it is 09:00 in New York');

/* Belgrade plus Sydney plus Los Angeles cannot fit inside 9 to 18. */
const three = P.overlap([belgrade, 'Australia/Sydney', 'America/Los_Angeles'], {
  dateKey: '2026-10-19', homeZone: belgrade, workStart: 9, workEnd: 18
});
ok(three.kind === 'partial' || three.kind === 'none', 'three far cities do not all fit');
ok(three.citiesInWork >= 1 && three.citiesInWork <= 3, 'the count stays inside the list');

/* Half hour zones must not be rounded into a false overlap: Kolkata is +5:30,
 * so 09:00 in Belgrade is 12:30 there and 13:30 at the end of the window. */
const india = P.overlap([belgrade, 'Asia/Kolkata'], {
  dateKey: '2026-10-19', homeZone: belgrade, workStart: 9, workEnd: 18
});
eq(india.kind, 'all', 'Belgrade and Kolkata overlap');
eq(india.rows[1].start, '12:30', 'Kolkata starts at 12:30');
/* The end is exclusive, so 14:30 in Belgrade really is 18:00 in Kolkata. */
eq(india.rows[1].end, '18:00', 'Kolkata ends at 18:00');
eq(india.minutes, 330, 'five and a half hours, not six');

/* One city is its own overlap, all day. */
const single = P.overlap([belgrade], {
  dateKey: '2026-10-19', homeZone: belgrade, workStart: 9, workEnd: 18
});
eq(single.kind, 'all', 'a single city always overlaps itself');
eq(single.minutes, 9 * 60, 'nine working hours');

/* A window that wraps midnight still works. */
const night = P.overlap([belgrade], {
  dateKey: '2026-10-19', homeZone: belgrade, workStart: 22, workEnd: 6
});
eq(night.kind, 'all', 'a night shift has a window');

/* ---------------------------------------------------------------- readings */

const noonUtc = Date.UTC(2026, 9, 19, 12, 0);
const reading = P.reading('America/New_York', noonUtc, belgrade, '2026-10-19');
eq(reading.label, '08:00', 'noon UTC is 08:00 in New York in October');
eq(reading.dayOffset, 0, 'same calendar day');

const lateUtc = Date.UTC(2026, 9, 19, 23, 0);
const nextDay = P.reading('Asia/Tokyo', lateUtc, belgrade, '2026-10-19');
eq(nextDay.label, '08:00', '23:00 UTC is 08:00 in Tokyo');
eq(nextDay.dayOffset, 1, 'and it is already tomorrow there');

/* ------------------------------------------------------------------- state */

const encoded = P.encodeState({
  cities: [{ zone: 'Europe/Rome', name: 'Milan' }, { zone: 'America/New_York', name: 'New York' }],
  dateKey: '2026-10-19', workStart: 9, workEnd: 18
});
const decoded = P.decodeState('#' + encoded);
eq(decoded.cities.length, 2, 'two cities survive the round trip');
eq(decoded.cities[0].name, 'Milan', 'the chosen city name survives, not the zone name');
eq(decoded.cities[0].zone, 'Europe/Rome', 'the zone survives');
eq(decoded.dateKey, '2026-10-19', 'the day survives');
eq(decoded.workStart, 9, 'the start hour survives');

eq(P.decodeState(''), null, 'an empty hash gives nothing');
eq(P.decodeState('#z=Nonsense/Zone&d=2026-10-19').cities, null, 'a made up zone is dropped');
ok(P.decodeState('#d=19-10-2026').dateKey === null, 'a badly written date is dropped');

/* --------------------------------------------------------------- city list */

eq(C.list.length, 117, 'the shipped city list has 117 entries');
eq(C.findCity('belgrade').zone, 'Europe/Belgrade', 'lookup ignores case');
eq(C.findCity('SÃO PAULO').zone, 'America/Sao_Paulo', 'lookup ignores accents and case');
eq(C.findCity('nowhere'), null, 'an unknown name gives nothing');
eq(C.byZone('America/New_York').name, 'New York', 'reverse lookup by zone');
eq(C.findByNameOrZone('Asia/Tokyo').name, 'Tokyo', 'a zone typed in full is recognised');
ok(C.search('lon', 3).length > 0, 'prefix search returns something');
eq(C.search('lon', 1)[0].name, 'London', 'prefix search puts the best match first');
eq(C.search('york', 1)[0].name, 'New York', 'search also matches inside a name');

let bad = 0;
for (const city of C.list) {
  if (!P.isValidZone(city.zone)) bad += 1;
}
eq(bad, 0, 'every shipped zone is valid in this runtime');

let duplicate = 0;
const seen = new Set();
for (const city of C.list) {
  if (seen.has(city.name)) duplicate += 1;
  seen.add(city.name);
}
eq(duplicate, 0, 'no city name appears twice');

/* Every zone must resolve through Intl, which is the promise the page makes:
 * no offset table, only the browser. */
ok(P.isValidZone('Europe/Belgrade'), 'a real zone is valid');
ok(!P.isValidZone('Europe/Nowhere'), 'an invented zone is not');
ok(!P.isValidZone(''), 'an empty zone is not');

console.log('logic: ' + checks + ' checks passed');
