/* Meeting Planner · TekiDeki - interface
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Kristian Mario Miskovic (TekiDeki)
 *
 * All state lives in this file plus the address bar. There is no request to
 * any server, including the first one.
 */
(function () {
  'use strict';

  var P = window.TD_PLANNER;
  var C = window.TD_CITIES;
  var LOCALES = window.TD_LOCALES;

  var MAX_CITIES = 8;
  var STORE = 'td-zones.';

  var LOCALE_TAG = {
    'en': 'en-GB',
    'ro': 'ro-RO',
    'sr-latn': 'sr-Latn-RS',
    'sr-cyrl': 'sr-Cyrl-RS'
  };

  var state = {
    lang: 'en',
    theme: 'light',
    cities: [],
    dateKey: null,
    workStart: 9,
    workEnd: 18,
    picked: null
  };

  var undoStack = [];

  /* ------------------------------------------------------------ utilities */

  function $(id) { return document.getElementById(id); }

  function t(key) {
    var table = LOCALES[state.lang] || LOCALES.en;
    if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    return (LOCALES.en && LOCALES.en[key]) || key;
  }

  function fill(key, values) {
    var out = t(key);
    Object.keys(values || {}).forEach(function (name) {
      out = out.split('{' + name + '}').join(String(values[name]));
    });
    return out;
  }

  function store(key, value) {
    try { window.localStorage.setItem(STORE + key, value); } catch (error) { /* private mode */ }
  }

  function stored(key) {
    try { return window.localStorage.getItem(STORE + key); } catch (error) { return null; }
  }

  function localZone() {
    try { return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (error) { return 'UTC'; }
  }

  function cityForZone(zone) {
    var known = C.byZone(zone);
    return { zone: zone, name: known ? known.name : P.zoneLabel(zone) };
  }

  function homeZone() {
    return state.cities.length ? state.cities[0].zone : localZone();
  }

  function todayKey() {
    return P.wallKey(homeZone(), Date.now());
  }

  function dayLabel(key) {
    var parts = key.split('-');
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0));
    return new Intl.DateTimeFormat(LOCALE_TAG[state.lang] || 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
    }).format(date);
  }

  function shortDayLabel(key) {
    var parts = key.split('-');
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0));
    return new Intl.DateTimeFormat(LOCALE_TAG[state.lang] || 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
    }).format(date);
  }

  /* ------------------------------------------------------------- language */

  function detectLang() {
    var saved = stored('lang');
    if (saved && LOCALES[saved]) return saved;
    var nav = (navigator.language || 'en').toLowerCase();
    if (nav.indexOf('ro') === 0) return 'ro';
    if (nav.indexOf('sr') === 0) return 'sr-latn';
    return 'en';
  }

  function applyLang() {
    var dict = LOCALES[state.lang] || LOCALES.en;
    document.documentElement.lang = state.lang;

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i += 1) {
      var key = nodes[i].getAttribute('data-i18n');
      if (dict[key]) nodes[i].textContent = dict[key];
    }
    var titled = document.querySelectorAll('[data-i18n-title]');
    for (var j = 0; j < titled.length; j += 1) {
      var tkey = titled[j].getAttribute('data-i18n-title');
      if (dict[tkey]) titled[j].setAttribute('title', dict[tkey]);
    }
    var labelled = document.querySelectorAll('[data-i18n-aria-label]');
    for (var k = 0; k < labelled.length; k += 1) {
      var akey = labelled[k].getAttribute('data-i18n-aria-label');
      if (dict[akey]) labelled[k].setAttribute('aria-label', dict[akey]);
    }
    var placed = document.querySelectorAll('[data-i18n-placeholder]');
    for (var m = 0; m < placed.length; m += 1) {
      var pkey = placed[m].getAttribute('data-i18n-placeholder');
      if (dict[pkey]) placed[m].setAttribute('placeholder', dict[pkey]);
    }

    $('langSelect').value = state.lang;
    $('workFrom').setAttribute('aria-label', t('workFrom'));
    $('workTo').setAttribute('aria-label', t('workTo'));
    $('grid').setAttribute('aria-label', t('gridAria'));
    $('cityInput').setAttribute('placeholder', t('cityPlaceholder'));
  }

  /* ---------------------------------------------------------------- theme */

  function applyTheme() {
    document.documentElement.classList.toggle('theme-dark', state.theme === 'dark');
  }

  /* ----------------------------------------------------------------- data */

  function pushUndo() {
    undoStack.push(state.cities.map(function (city) { return { zone: city.zone, name: city.name }; }));
    if (undoStack.length > 40) undoStack.shift();
    $('undoBtn').disabled = false;
  }

  function save() {
    store('cities', JSON.stringify(state.cities));
    store('date', state.dateKey);
    store('from', String(state.workStart));
    store('to', String(state.workEnd));
    store('theme', state.theme);
    store('lang', state.lang);

    var hash = '#' + P.encodeState({
      cities: state.cities, dateKey: state.dateKey,
      workStart: state.workStart, workEnd: state.workEnd
    });
    try { window.history.replaceState(null, '', hash); } catch (error) { /* file:// */ }
  }

  function restore() {
    var fromHash = P.decodeState(window.location.hash);
    if (fromHash && fromHash.cities && fromHash.cities.length) {
      state.cities = fromHash.cities;
      if (fromHash.dateKey) state.dateKey = fromHash.dateKey;
      if (typeof fromHash.workStart === 'number' && fromHash.workStart >= 0) state.workStart = fromHash.workStart;
      if (typeof fromHash.workEnd === 'number' && fromHash.workEnd >= 0) state.workEnd = fromHash.workEnd;
      return;
    }

    var savedCities = null;
    try { savedCities = JSON.parse(stored('cities') || 'null'); } catch (error) { savedCities = null; }
    if (Array.isArray(savedCities) && savedCities.length) {
      state.cities = savedCities.filter(function (city) {
        return city && P.isValidZone(city.zone);
      }).slice(0, MAX_CITIES);
    }
    if (!state.cities.length) {
      state.cities = defaults();
    }

    var savedDate = stored('date');
    if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate)) state.dateKey = savedDate;
    var savedFrom = parseInt(stored('from'), 10);
    var savedTo = parseInt(stored('to'), 10);
    if (savedFrom >= 0 && savedFrom < 24) state.workStart = savedFrom;
    if (savedTo >= 0 && savedTo < 24) state.workEnd = savedTo;
  }

  /* Three cities on first load, so the page explains itself before anyone
   * touches it. The local zone always wins the first slot. */
  function defaults() {
    var home = cityForZone(localZone());
    var used = {};
    used[home.zone] = true;
    var list = [home];
    ['Europe/London', 'America/New_York', 'Asia/Tokyo'].forEach(function (zone) {
      if (list.length >= 3 || used[zone] || !P.isValidZone(zone)) return;
      used[zone] = true;
      list.push(cityForZone(zone));
    });
    return list;
  }

  /* -------------------------------------------------------------- render */

  function renderCities() {
    var box = $('cityChips');
    box.textContent = '';
    state.cities.forEach(function (city, index) {
      var chip = document.createElement('span');
      chip.className = 'chip';

      var name = document.createElement('span');
      name.textContent = city.name;
      chip.appendChild(name);

      if (city.zone !== city.name) {
        var zone = document.createElement('span');
        zone.className = 'chip-zone';
        zone.textContent = city.zone;
        chip.appendChild(zone);
      }

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-x';
      remove.setAttribute('data-index', String(index));
      remove.setAttribute('aria-label', fill('removeCity', { city: city.name }));
      remove.title = fill('removeCity', { city: city.name });
      remove.textContent = '\u00d7';
      chip.appendChild(remove);

      box.appendChild(chip);
    });

    $('cityEmpty').hidden = state.cities.length > 0;
    $('undoBtn').disabled = undoStack.length === 0;
  }

  function renderDate() {
    $('dateLabel').textContent = dayLabel(state.dateKey);
    $('todayBadge').hidden = state.dateKey !== todayKey();
  }

  function renderHours() {
    function options(select, selected) {
      select.textContent = '';
      for (var hour = 0; hour < 24; hour += 1) {
        var option = document.createElement('option');
        option.value = String(hour);
        option.textContent = P.hhmm(hour * 60);
        if (hour === selected) option.selected = true;
        select.appendChild(option);
      }
    }
    options($('workFrom'), state.workStart);
    options($('workTo'), state.workEnd);
  }

  function renderGrid() {
    var head = $('gridHead');
    var body = $('gridBody');
    head.textContent = '';
    body.textContent = '';

    if (!state.cities.length) return;
    $('grid').style.setProperty('--cols', String(state.cities.length));

    var headRow = document.createElement('tr');
    var corner = document.createElement('th');
    corner.setAttribute('scope', 'col');
    corner.textContent = t('gridCorner');
    headRow.appendChild(corner);

    state.cities.forEach(function (city) {
      var th = document.createElement('th');
      th.setAttribute('scope', 'col');
      th.appendChild(document.createTextNode(city.name));
      if (city.zone !== city.name) {
        var zone = document.createElement('span');
        zone.className = 'zone';
        zone.textContent = city.zone;
        th.appendChild(zone);
      }
      headRow.appendChild(th);
    });
    head.appendChild(headRow);

    var home = homeZone();
    var rows = P.rows(home, state.dateKey, Date.now());

    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      if (state.picked === row.index) tr.className = 'is-picked';
      tr.setAttribute('data-row', String(row.index));

      var th = document.createElement('th');
      th.setAttribute('scope', 'row');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'hourbtn';
      button.setAttribute('data-row', String(row.index));
      button.setAttribute('aria-pressed', state.picked === row.index ? 'true' : 'false');
      button.textContent = row.label;
      th.appendChild(button);
      if (row.isNow) {
        var dot = document.createElement('span');
        dot.className = 'nowdot';
        dot.setAttribute('aria-hidden', 'true');
        th.appendChild(dot);
      }
      tr.appendChild(th);

      state.cities.forEach(function (city) {
        var td = document.createElement('td');
        var cell = document.createElement('div');
        var reading = P.reading(city.zone, row.at, home, state.dateKey);
        cell.className = 'cell ' + P.classify(reading.minutes, state.workStart, state.workEnd);
        cell.textContent = reading.label;
        if (reading.dayOffset !== 0) {
          var mark = document.createElement('span');
          mark.className = 'daymark';
          mark.textContent = (reading.dayOffset > 0 ? '+' : '') + reading.dayOffset;
          cell.appendChild(mark);
        }
        td.appendChild(cell);
        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }

  function renderResult() {
    var box = $('result');
    box.className = 'result';

    if (state.cities.length < 2) {
      box.hidden = state.cities.length === 0;
      $('resultTitle').textContent = t('bestAllTitle');
      $('resultBody').textContent = state.cities.length === 1
        ? dayLabel(state.dateKey) + ' · ' + state.cities[0].name
        : '';
      return;
    }
    box.hidden = false;

    var zones = state.cities.map(function (city) { return city.zone; });
    var best = P.overlap(zones, {
      dateKey: state.dateKey,
      homeZone: homeZone(),
      workStart: state.workStart,
      workEnd: state.workEnd
    });

    if (best.kind === 'all') {
      box.classList.add('is-all');
      $('resultTitle').textContent = t('bestAllTitle');
      $('resultBody').textContent = fill('bestAllBody', { start: best.startLabel, end: best.endLabel });
    } else if (best.kind === 'partial') {
      box.classList.add('is-partial');
      $('resultTitle').textContent = t('bestPartialTitle');
      $('resultBody').textContent = fill('bestPartialBody', { count: best.citiesInWork, total: zones.length }) +
        ' ' + fill('bestAllBody', { start: best.startLabel, end: best.endLabel });
    } else {
      box.classList.add('is-none');
      $('resultTitle').textContent = t('bestNoneTitle');
      $('resultBody').textContent = t('bestNoneBody');
    }
  }

  function renderPicked() {
    var box = $('picked');
    if (state.picked === null || !state.cities.length) {
      box.hidden = true;
      return;
    }

    var home = homeZone();
    var rows = P.rows(home, state.dateKey, Date.now());
    var row = rows[state.picked];
    if (!row) { state.picked = null; box.hidden = true; return; }

    box.hidden = false;
    var list = $('pickedList');
    list.textContent = '';

    state.cities.forEach(function (city) {
      var reading = P.reading(city.zone, row.at, home, state.dateKey);
      var li = document.createElement('li');

      var left = document.createElement('span');
      left.className = 'city';
      left.textContent = city.name;
      var small = document.createElement('small');
      small.textContent = reading.dayOffset > 0 ? '+' + reading.dayOffset + 'd'
        : (reading.dayOffset < 0 ? reading.dayOffset + 'd' : '');
      if (small.textContent) left.appendChild(small);

      var right = document.createElement('span');
      right.className = 'time' + (P.classify(reading.minutes, state.workStart, state.workEnd) === P.WORK ? ' is-work' : '');
      right.textContent = reading.label;

      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    });
  }

  function renderAll() {
    applyLang();
    applyTheme();
    renderCities();
    renderDate();
    renderHours();
    renderResult();
    renderGrid();
    renderPicked();
    $('workFrom').value = String(state.workStart);
    $('workTo').value = String(state.workEnd);
  }

  /* --------------------------------------------------------------- actions */

  function select(hourIndex) {
    state.picked = state.picked === hourIndex ? null : hourIndex;
    renderGrid();
    renderPicked();
  }

  function addCity(raw) {
    var value = String(raw || '').trim();
    if (!value) return;

    var match = C.findByNameOrZone(value);
    if (!match) {
      var candidates = C.search(value, 1);
      if (candidates.length && C.normalise(candidates[0].name).indexOf(C.normalise(value)) === 0) {
        match = candidates[0];
      }
    }

    var zone;
    var name;
    if (match) {
      zone = match.zone;
      name = match.name;
    } else if (P.isValidZone(value)) {
      zone = value;
      name = P.zoneLabel(value);
    } else {
      message(fill('cityUnknown', { query: value }), false);
      return;
    }

    for (var i = 0; i < state.cities.length; i += 1) {
      if (state.cities[i].zone === zone) {
        message(fill('cityDuplicate', { city: name }), false);
        return;
      }
    }
    if (state.cities.length >= MAX_CITIES) {
      message(t('cityLimit'), false);
      return;
    }

    pushUndo();
    state.cities.push({ zone: zone, name: name });
    state.picked = null;
    message('', true);
    save();
    renderAll();
    $('cityInput').value = '';
  }

  function removeCity(index) {
    if (index < 0 || index >= state.cities.length) return;
    pushUndo();
    state.cities.splice(index, 1);
    state.picked = null;
    message('', true);
    save();
    renderAll();
  }

  function undo() {
    if (!undoStack.length) return;
    state.cities = undoStack.pop();
    state.picked = null;
    message('', true);
    save();
    renderAll();
  }

  function message(text, good) {
    var box = $('cityMsg');
    box.textContent = text;
    box.className = 'msg' + (good ? ' good' : '');
  }

  function shiftDay(delta) {
    state.dateKey = P.addDays(state.dateKey, delta);
    state.picked = null;
    save();
    renderAll();
  }

  function copyText() {
    if (state.picked === null) return '';
    var home = homeZone();
    var rows = P.rows(home, state.dateKey, Date.now());
    var row = rows[state.picked];
    if (!row) return '';

    var first = state.cities[0];
    var lines = [fill('shareHeader', {
      day: shortDayLabel(state.dateKey),
      time: row.label,
      city: first ? first.name : P.zoneLabel(home)
    })];

    state.cities.forEach(function (city) {
      var reading = P.reading(city.zone, row.at, home, state.dateKey);
      lines.push(city.name + ': ' + reading.label);
    });
    return lines.join('\n');
  }

  function copyToClipboard() {
    var text = copyText();
    if (!text) return;

    function done() {
      var button = $('copyBtn');
      button.textContent = t('copiedBtn');
      window.setTimeout(function () { button.textContent = t('copyBtn'); }, 1600);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }

    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', 'readonly');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (error) { /* nothing else to try */ }
      document.body.removeChild(area);
      done();
    }
  }

  /* ----------------------------------------------------------------- boot */

  function boot() {
    state.lang = detectLang();
    state.theme = stored('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    restore();
    if (!state.dateKey) state.dateKey = todayKey();
    if (state.workEnd === state.workStart) state.workEnd = (state.workStart + 9) % 24;

    var list = $('cityList');
    C.list.forEach(function (city) {
      var option = document.createElement('option');
      option.value = city.name;
      option.label = city.zone;
      list.appendChild(option);
    });

    $('cityForm').addEventListener('submit', function (event) {
      event.preventDefault();
      addCity($('cityInput').value);
    });

    $('cityChips').addEventListener('click', function (event) {
      var button = event.target.closest('.chip-x');
      if (!button) return;
      removeCity(parseInt(button.getAttribute('data-index'), 10));
    });

    $('undoBtn').addEventListener('click', undo);
    $('prevDayBtn').addEventListener('click', function () { shiftDay(-1); });
    $('nextDayBtn').addEventListener('click', function () { shiftDay(1); });
    $('todayBtn').addEventListener('click', function () {
      state.dateKey = todayKey();
      state.picked = null;
      save();
      renderAll();
    });

    $('workFrom').addEventListener('change', function () {
      var value = parseInt(this.value, 10);
      state.workStart = value;
      if (state.workEnd === state.workStart) {
        state.workEnd = (value + 9) % 24;
        $('workTo').value = String(state.workEnd);
      }
      state.picked = null;
      save();
      renderAll();
    });

    $('workTo').addEventListener('change', function () {
      var value = parseInt(this.value, 10);
      state.workEnd = value;
      if (state.workEnd === state.workStart) {
        state.workStart = (value + 15) % 24;
        $('workFrom').value = String(state.workStart);
      }
      state.picked = null;
      save();
      renderAll();
    });

    $('gridBody').addEventListener('click', function (event) {
      var target = event.target.closest('[data-row]');
      if (!target) return;
      select(parseInt(target.getAttribute('data-row'), 10));
    });

    $('copyBtn').addEventListener('click', copyToClipboard);
    $('clearBtn').addEventListener('click', function () {
      state.picked = null;
      renderGrid();
      renderPicked();
    });

    $('themeBtn').addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      store('theme', state.theme);
    });

    $('langSelect').addEventListener('change', function () {
      var value = this.value;
      if (!LOCALES[value]) return;
      state.lang = value;
      store('lang', value);
      renderAll();
    });

    renderAll();
    save();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.TD_APP = { state: state, copyText: copyText, addCity: addCity };
}());
