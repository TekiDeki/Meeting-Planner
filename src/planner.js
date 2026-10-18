/* Meeting Planner · TekiDeki - time zone engine
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Kristian Mario Miskovic (TekiDeki)
 *
 * No offset table ships with this file. Every offset comes from the browser's
 * own Intl data, so daylight saving changes are correct on the day the
 * government changes them, including half hour zones such as India and
 * Newfoundland.
 *
 * Pure functions only: no DOM, no network, no clock reads except where an
 * argument says so.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TD_PLANNER = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MINUTE = 60000;
  var DAY_MINUTES = 1440;

  var formatters = Object.create(null);

  /* hourCycle h23 is explicit on purpose: with hour12 false some engines
   * report midnight as "24" and every offset calculation after it is wrong. */
  function formatterFor(zone) {
    var found = formatters[zone];
    if (found) return found;
    found = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    formatters[zone] = found;
    return found;
  }

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function isValidZone(zone) {
    if (!zone || typeof zone !== 'string') return false;
    try {
      formatterFor(zone).format(new Date(0));
      return true;
    } catch (error) {
      return false;
    }
  }

  /* Wall clock reading for an instant in a zone. */
  function wall(zone, ms) {
    var parts = formatterFor(zone).formatToParts(new Date(ms));
    var out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
    for (var i = 0; i < parts.length; i += 1) {
      var type = parts[i].type;
      if (type === 'year' || type === 'month' || type === 'day' ||
          type === 'hour' || type === 'minute' || type === 'second') {
        out[type] = parseInt(parts[i].value, 10);
      }
    }
    if (out.hour === 24) out.hour = 0;
    return out;
  }

  function wallKey(zone, ms) {
    var w = wall(zone, ms);
    return w.year + '-' + pad2(w.month) + '-' + pad2(w.day);
  }

  function localMinutes(zone, ms) {
    var w = wall(zone, ms);
    return w.hour * 60 + w.minute;
  }

  function localHour(zone, ms) {
    return wall(zone, ms).hour;
  }

  /* Offset in minutes such that local time = UTC + offset. */
  function zoneOffset(zone, ms) {
    var whole = Math.floor(ms / 1000) * 1000;
    var w = wall(zone, ms);
    var asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return Math.round((asUtc - whole) / MINUTE);
  }

  function parseDateKey(key) {
    var parts = String(key).split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
  }

  function dateKeyOf(year, month, day) {
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  function addDays(key, count) {
    var p = parseDateKey(key);
    var shifted = new Date(Date.UTC(p.year, p.month - 1, p.day) + count * 86400000);
    return dateKeyOf(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  }

  function dayOffsetBetween(fromKey, toKey) {
    var a = parseDateKey(fromKey);
    var b = parseDateKey(toKey);
    return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
  }

  /* First instant whose wall date in this zone is on or after `key`.
   *
   * A binary search rather than arithmetic because midnight does not always
   * exist: several zones have skipped 00:00 on a DST switch, so "start of day"
   * has to be discovered, not calculated. */
  function dayStartUtc(zone, key) {
    var p = parseDateKey(key);
    var naive = Date.UTC(p.year, p.month - 1, p.day);
    var low = naive - 16 * 60 * MINUTE;
    var high = naive + 16 * 60 * MINUTE;
    if (wallKey(zone, high) < key) return high;
    while (high - low > MINUTE) {
      var mid = low + Math.floor((high - low) / MINUTE / 2) * MINUTE;
      if (mid <= low) mid = low + MINUTE;
      if (wallKey(zone, mid) >= key) high = mid;
      else low = mid;
    }
    return high;
  }

  function nowKey(zone, nowMs) {
    return wallKey(zone, nowMs);
  }

  function hhmm(minutes) {
    var value = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    return pad2(Math.floor(value / 60)) + ':' + pad2(value % 60);
  }

  function inRange(minute, start, end) {
    var a = ((start % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    var b = ((end % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    if (a === b) return false;
    if (a < b) return minute >= a && minute < b;
    return minute >= a || minute < b;
  }

  var WORK = 'work';
  var AWAKE = 'awake';
  var NIGHT = 'night';

  /* Three bands: working hours, awake but off work, sleep. The awake band is
   * two hours wider on each side. */
  function classify(minute, workStart, workEnd) {
    var start = workStart * 60;
    var end = workEnd * 60;
    if (inRange(minute, start, end)) return WORK;
    if (inRange(minute, start - 120, end + 120)) return AWAKE;
    return NIGHT;
  }

  function zoneLabel(zone) {
    return zone ? zone.replace(/_/g, ' ') : '';
  }

  /* Cross zone reading at one instant. */
  function reading(zone, ms, homeZone, homeKey) {
    var minutes = localMinutes(zone, ms);
    var key = wallKey(zone, ms);
    return {
      zone: zone,
      label: hhmm(minutes),
      minutes: minutes,
      dateKey: key,
      dayOffset: homeKey ? dayOffsetBetween(homeKey, key) : 0
    };
  }

  /* Rows of the grid: 24 hourly instants from home midnight.
   * Labels are read back from the real instant, so on a spring forward day the
   * 02:00 row simply does not appear instead of showing invented data. */
  function rows(homeZone, homeKey, nowMs) {
    var start = dayStartUtc(homeZone, homeKey);
    var list = [];
    var now = typeof nowMs === 'number' ? nowMs : null;
    for (var i = 0; i < 24; i += 1) {
      var at = start + i * 60 * MINUTE;
      list.push({
        index: i,
        at: at,
        hour: localHour(homeZone, at),
        minute: localMinutes(homeZone, at),
        label: hhmm(localMinutes(homeZone, at)),
        isNow: now !== null && now >= at && now < at + 60 * MINUTE
      });
    }
    return list;
  }

  /* Best window where every city is inside working hours.
   *
   * Searched at half hour steps because a five and a half hour offset would
   * otherwise be rounded into a false overlap. */
  function overlap(zones, options) {
    var opts = options || {};
    var homeKey = opts.dateKey;
    var homeZone = opts.homeZone;
    var workStart = typeof opts.workStart === 'number' ? opts.workStart : 9;
    var workEnd = typeof opts.workEnd === 'number' ? opts.workEnd : 18;
    var step = opts.step || 30;

    var start = dayStartUtc(homeZone, homeKey);
    var slots = [];
    for (var i = 0; i < DAY_MINUTES; i += step) {
      var at = start + i * MINUTE;
      var inWork = 0;
      for (var z = 0; z < zones.length; z += 1) {
        if (classify(localMinutes(zones[z], at), workStart, workEnd) === WORK) inWork += 1;
      }
      slots.push({ at: at, inWork: inWork, all: inWork === zones.length });
    }

    function runs(predicate) {
      var found = [];
      var open = null;
      for (var s = 0; s < slots.length; s += 1) {
        if (predicate(slots[s])) {
          if (!open) open = { from: s, to: s + 1 };
          else open.to = s + 1;
        } else if (open) {
          found.push(open);
          open = null;
        }
      }
      if (open) found.push(open);
      return found;
    }

    function longest(list) {
      var best = null;
      for (var i = 0; i < list.length; i += 1) {
        if (!best || (list[i].to - list[i].from) > (best.to - best.from)) best = list[i];
      }
      return best;
    }

    function windowOf(run) {
      var first = slots[run.from].at;
      var last = slots[run.to - 1].at + step * MINUTE;
      return {
        from: first,
        to: last,
        minutes: Math.round((last - first) / MINUTE),
        startLabel: hhmm(localMinutes(homeZone, first)),
        endLabel: hhmm(localMinutes(homeZone, last)),
        rows: zones.map(function (zone) {
          return {
            zone: zone,
            label: zoneLabel(zone),
            start: hhmm(localMinutes(zone, first)),
            end: hhmm(localMinutes(zone, last)),
            dayOffset: dayOffsetBetween(homeKey, wallKey(zone, first))
          };
        })
      };
    }

    var full = longest(runs(function (slot) { return slot.all; }));
    if (full) {
      var one = windowOf(full);
      one.kind = 'all';
      one.citiesInWork = zones.length;
      return one;
    }

    var most = 0;
    for (var s = 0; s < slots.length; s += 1) {
      if (slots[s].inWork > most) most = slots[s].inWork;
    }
    if (most === 0) {
      return { kind: 'none', minutes: 0, citiesInWork: 0, rows: [] };
    }
    var partial = longest(runs(function (slot) { return slot.inWork === most; }));
    var two = windowOf(partial);
    two.kind = 'partial';
    two.citiesInWork = most;
    return two;
  }

  function dayNameIndex(key) {
    var p = parseDateKey(key);
    return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  }

  /* Cities travel through the URL as "zone~Name" pairs. Two cities can share
   * a zone (Milan and Rome do), and the row has to keep the name the person
   * picked, so the zone alone is not enough. */
  function parseCities(value) {
    if (!value) return [];
    var seen = Object.create(null);
    var out = [];
    String(value).split(',').forEach(function (part) {
      var bits = part.split('~');
      var zone = decodeURIComponent(bits[0] || '').trim();
      var name = decodeURIComponent((bits[1] || '').replace(/\+/g, ' ')).trim();
      if (!zone || seen[zone] || !isValidZone(zone)) return;
      seen[zone] = true;
      out.push({ zone: zone, name: name || zoneLabel(zone) });
    });
    return out;
  }

  function encodeCities(cities) {
    return (cities || []).map(function (city) {
      var zone = typeof city === 'string' ? city : city.zone;
      var name = typeof city === 'string' ? '' : city.name;
      var label = name && name !== zoneLabel(zone) ? '~' + encodeURIComponent(name).replace(/%20/g, '+') : '';
      return encodeURIComponent(zone) + label;
    }).join(',');
  }

  function encodeState(state) {
    return [
      'z=' + encodeCities(state.cities || state.zones || []),
      'd=' + state.dateKey,
      's=' + state.workStart,
      'e=' + state.workEnd
    ].join('&');
  }

  function decodeState(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    if (!raw) return null;
    var out = { cities: null, dateKey: null, workStart: null, workEnd: null };
    raw.split('&').forEach(function (pair) {
      var index = pair.indexOf('=');
      if (index < 0) return;
      var key = pair.slice(0, index);
      var value = pair.slice(index + 1);
      if (key === 'z') out.cities = parseCities(value);
      else if (key === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(value)) out.dateKey = value;
      else if (key === 's') out.workStart = parseInt(value, 10);
      else if (key === 'e') out.workEnd = parseInt(value, 10);
    });
    if (out.cities && !out.cities.length) out.cities = null;
    return out;
  }

  var ENGINE = {
    MINUTE: MINUTE,
    WORK: WORK,
    AWAKE: AWAKE,
    NIGHT: NIGHT,
    wall: wall,
    wallKey: wallKey,
    localMinutes: localMinutes,
    localHour: localHour,
    zoneOffset: zoneOffset,
    dayStartUtc: dayStartUtc,
    addDays: addDays,
    dateKeyOf: dateKeyOf,
    dayOffsetBetween: dayOffsetBetween,
    nowKey: nowKey,
    hhmm: hhmm,
    inRange: inRange,
    classify: classify,
    reading: reading,
    rows: rows,
    overlap: overlap,
    dayNameIndex: dayNameIndex,
    parseCities: parseCities,
    encodeCities: encodeCities,
    encodeState: encodeState,
    decodeState: decodeState,
    isValidZone: isValidZone,
    zoneLabel: zoneLabel
  };

  return ENGINE;
}));
