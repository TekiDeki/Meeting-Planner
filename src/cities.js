/* Meeting Planner · TekiDeki - city list
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Kristian Mario Miskovic (TekiDeki)
 *
 * A short list of well known cities, plus the rule that any IANA zone can be
 * typed by hand. Shipping a full city database would add megabytes and go
 * stale; the browser already knows every zone and every offset.
 *
 * Names stay in their common English form in every language: they are proper
 * nouns, and transliterating Tokyo into three scripts helps nobody.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TD_CITIES = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RAW = [
    ['Belgrade', 'Europe/Belgrade', 'RS'],
    ['Zagreb', 'Europe/Zagreb', 'HR'],
    ['Sarajevo', 'Europe/Sarajevo', 'BA'],
    ['Skopje', 'Europe/Skopje', 'MK'],
    ['Podgorica', 'Europe/Podgorica', 'ME'],
    ['Ljubljana', 'Europe/Ljubljana', 'SI'],
    ['Budapest', 'Europe/Budapest', 'HU'],
    ['Bucharest', 'Europe/Bucharest', 'RO'],
    ['Sofia', 'Europe/Sofia', 'BG'],
    ['Athens', 'Europe/Athens', 'GR'],
    ['Istanbul', 'Europe/Istanbul', 'TR'],
    ['Vienna', 'Europe/Vienna', 'AT'],
    ['Berlin', 'Europe/Berlin', 'DE'],
    ['Zurich', 'Europe/Zurich', 'CH'],
    ['Prague', 'Europe/Prague', 'CZ'],
    ['Bratislava', 'Europe/Bratislava', 'SK'],
    ['Warsaw', 'Europe/Warsaw', 'PL'],
    ['Kyiv', 'Europe/Kyiv', 'UA'],
    ['Moscow', 'Europe/Moscow', 'RU'],
    ['Minsk', 'Europe/Minsk', 'BY'],
    ['Chisinau', 'Europe/Chisinau', 'MD'],
    ['Tirana', 'Europe/Tirane', 'AL'],
    ['London', 'Europe/London', 'GB'],
    ['Dublin', 'Europe/Dublin', 'IE'],
    ['Lisbon', 'Europe/Lisbon', 'PT'],
    ['Madrid', 'Europe/Madrid', 'ES'],
    ['Paris', 'Europe/Paris', 'FR'],
    ['Amsterdam', 'Europe/Amsterdam', 'NL'],
    ['Brussels', 'Europe/Brussels', 'BE'],
    ['Luxembourg', 'Europe/Luxembourg', 'LU'],
    ['Copenhagen', 'Europe/Copenhagen', 'DK'],
    ['Stockholm', 'Europe/Stockholm', 'SE'],
    ['Oslo', 'Europe/Oslo', 'NO'],
    ['Helsinki', 'Europe/Helsinki', 'FI'],
    ['Tallinn', 'Europe/Tallinn', 'EE'],
    ['Riga', 'Europe/Riga', 'LV'],
    ['Vilnius', 'Europe/Vilnius', 'LT'],
    ['Rome', 'Europe/Rome', 'IT'],
    ['Milan', 'Europe/Rome', 'IT'],
    ['Valletta', 'Europe/Malta', 'MT'],
    ['Reykjavik', 'Atlantic/Reykjavik', 'IS'],
    ['Nicosia', 'Asia/Nicosia', 'CY'],
    ['Tbilisi', 'Asia/Tbilisi', 'GE'],
    ['Yerevan', 'Asia/Yerevan', 'AM'],
    ['Baku', 'Asia/Baku', 'AZ'],
    ['Casablanca', 'Africa/Casablanca', 'MA'],
    ['Algiers', 'Africa/Algiers', 'DZ'],
    ['Tunis', 'Africa/Tunis', 'TN'],
    ['Cairo', 'Africa/Cairo', 'EG'],
    ['Lagos', 'Africa/Lagos', 'NG'],
    ['Accra', 'Africa/Accra', 'GH'],
    ['Nairobi', 'Africa/Nairobi', 'KE'],
    ['Addis Ababa', 'Africa/Addis_Ababa', 'ET'],
    ['Johannesburg', 'Africa/Johannesburg', 'ZA'],
    ['Cape Town', 'Africa/Johannesburg', 'ZA'],
    ['Dubai', 'Asia/Dubai', 'AE'],
    ['Riyadh', 'Asia/Riyadh', 'SA'],
    ['Doha', 'Asia/Qatar', 'QA'],
    ['Kuwait City', 'Asia/Kuwait', 'KW'],
    ['Tel Aviv', 'Asia/Jerusalem', 'IL'],
    ['Beirut', 'Asia/Beirut', 'LB'],
    ['Amman', 'Asia/Amman', 'JO'],
    ['Baghdad', 'Asia/Baghdad', 'IQ'],
    ['Tehran', 'Asia/Tehran', 'IR'],
    ['Karachi', 'Asia/Karachi', 'PK'],
    ['Mumbai', 'Asia/Kolkata', 'IN'],
    ['Delhi', 'Asia/Kolkata', 'IN'],
    ['Bengaluru', 'Asia/Kolkata', 'IN'],
    ['Colombo', 'Asia/Colombo', 'LK'],
    ['Kathmandu', 'Asia/Kathmandu', 'NP'],
    ['Dhaka', 'Asia/Dhaka', 'BD'],
    ['Yangon', 'Asia/Yangon', 'MM'],
    ['Bangkok', 'Asia/Bangkok', 'TH'],
    ['Hanoi', 'Asia/Ho_Chi_Minh', 'VN'],
    ['Jakarta', 'Asia/Jakarta', 'ID'],
    ['Singapore', 'Asia/Singapore', 'SG'],
    ['Kuala Lumpur', 'Asia/Kuala_Lumpur', 'MY'],
    ['Manila', 'Asia/Manila', 'PH'],
    ['Hong Kong', 'Asia/Hong_Kong', 'HK'],
    ['Shanghai', 'Asia/Shanghai', 'CN'],
    ['Beijing', 'Asia/Shanghai', 'CN'],
    ['Taipei', 'Asia/Taipei', 'TW'],
    ['Seoul', 'Asia/Seoul', 'KR'],
    ['Tokyo', 'Asia/Tokyo', 'JP'],
    ['Ulaanbaatar', 'Asia/Ulaanbaatar', 'MN'],
    ['Perth', 'Australia/Perth', 'AU'],
    ['Sydney', 'Australia/Sydney', 'AU'],
    ['Melbourne', 'Australia/Melbourne', 'AU'],
    ['Brisbane', 'Australia/Brisbane', 'AU'],
    ['Auckland', 'Pacific/Auckland', 'NZ'],
    ['Honolulu', 'Pacific/Honolulu', 'US'],
    ['Anchorage', 'America/Anchorage', 'US'],
    ['Vancouver', 'America/Vancouver', 'CA'],
    ['Calgary', 'America/Edmonton', 'CA'],
    ['Toronto', 'America/Toronto', 'CA'],
    ['Montreal', 'America/Toronto', 'CA'],
    ['New York', 'America/New_York', 'US'],
    ['Boston', 'America/New_York', 'US'],
    ['Washington DC', 'America/New_York', 'US'],
    ['Chicago', 'America/Chicago', 'US'],
    ['Austin', 'America/Chicago', 'US'],
    ['Denver', 'America/Denver', 'US'],
    ['Phoenix', 'America/Phoenix', 'US'],
    ['Los Angeles', 'America/Los_Angeles', 'US'],
    ['San Francisco', 'America/Los_Angeles', 'US'],
    ['Seattle', 'America/Los_Angeles', 'US'],
    ['Mexico City', 'America/Mexico_City', 'MX'],
    ['Bogota', 'America/Bogota', 'CO'],
    ['Lima', 'America/Lima', 'PE'],
    ['Santiago', 'America/Santiago', 'CL'],
    ['Buenos Aires', 'America/Argentina/Buenos_Aires', 'AR'],
    ['Montevideo', 'America/Montevideo', 'UY'],
    ['Sao Paulo', 'America/Sao_Paulo', 'BR'],
    ['Rio de Janeiro', 'America/Sao_Paulo', 'BR'],
    ['Caracas', 'America/Caracas', 'VE'],
    ['Panama City', 'America/Panama', 'PA'],
    ['Havana', 'America/Havana', 'CU']
  ];

  var CITIES = RAW.map(function (row) {
    return { name: row[0], zone: row[1], country: row[2] };
  });

  /* Accent and case insensitive match, so "sao paulo" finds "Sao Paulo" and
   * "novi sad" style typing does not need the exact spelling. */
  function normalise(text) {
    var lower = String(text || '').toLowerCase();
    if (lower.normalize) {
      lower = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return lower.replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function findCity(name) {
    var wanted = normalise(name);
    if (!wanted) return null;
    for (var i = 0; i < CITIES.length; i += 1) {
      if (normalise(CITIES[i].name) === wanted) return CITIES[i];
    }
    return null;
  }

  function findByNameOrZone(value) {
    var raw = String(value || '').trim();
    if (!raw) return null;
    var byName = findCity(raw);
    if (byName) return byName;
    for (var i = 0; i < CITIES.length; i += 1) {
      if (CITIES[i].zone === raw) return CITIES[i];
    }
    return null;
  }

  function search(query, limit) {
    var wanted = normalise(query);
    var max = limit || 8;
    if (!wanted) return CITIES.slice(0, max);
    var starts = [];
    var contains = [];
    for (var i = 0; i < CITIES.length; i += 1) {
      var name = normalise(CITIES[i].name);
      if (name.indexOf(wanted) === 0) starts.push(CITIES[i]);
      else if (name.indexOf(wanted) > 0) contains.push(CITIES[i]);
    }
    return starts.concat(contains).slice(0, max);
  }

  function byZone(zone) {
    for (var i = 0; i < CITIES.length; i += 1) {
      if (CITIES[i].zone === zone) return CITIES[i];
    }
    return null;
  }

  return {
    list: CITIES,
    findCity: findCity,
    findByNameOrZone: findByNameOrZone,
    byZone: byZone,
    search: search,
    normalise: normalise
  };
}));
