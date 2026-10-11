(function () {
  'use strict';

  /* ==================== Pure calculation functions ==================== */
  // Every unit is stored as a factor to the category's base unit
  // (m, kg, Pa, J). Temperature is handled separately because it is not linear.
  const UNIT_TABLE = {
    Length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
    Mass: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.45359237 / 16, lb: 0.45359237 },
    Pressure: {
      Pa: 1, kPa: 1000, MPa: 1e6, bar: 100000, atm: 101325,
      psi: 6894.757293168, mmHg: 133.322387415
    },
    Energy: {
      J: 1, kJ: 1000, MJ: 1e6, cal: 4.184, kcal: 4184, Wh: 3600,
      kWh: 3600000, BTU: 1055.05585262, eV: 1.602176634e-19
    },
    Temperature: { '°C': 'temperature', '°F': 'temperature', K: 'temperature' }
  };

  function convertUnit(value, from, to) {
    value = Number(value);
    if (!Number.isFinite(value)) return NaN;
    const category = Object.keys(UNIT_TABLE).find((name) =>
      Object.prototype.hasOwnProperty.call(UNIT_TABLE[name], from));
    if (!category || !Object.prototype.hasOwnProperty.call(UNIT_TABLE[category], to)) return NaN;
    if (category === 'Temperature') {
      const kelvin = from === 'K' ? value : from === '°C' ? value + 273.15 : (value - 32) * 5 / 9 + 273.15;
      return to === 'K' ? kelvin : to === '°C' ? kelvin - 273.15 : (kelvin - 273.15) * 9 / 5 + 32;
    }
    return value * UNIT_TABLE[category][from] / UNIT_TABLE[category][to];
  }

  function formatNumber(x, sig) {
    let value = Number(x);
    const significantDigits = sig == null
      ? 5
      : Math.max(1, Math.min(12, Number(sig) || 5));
    if (!Number.isFinite(value)) return '—';
    if (Object.is(value, -0)) value = 0;
    const absolute = Math.abs(value);
    if (absolute >= 1e9 || (absolute > 0 && absolute < 1e-4)) {
      const parts = value.toExponential(significantDigits - 1).split('e');
      const mantissa = parts[0].replace(/(?:\.0+|(?:(\.\d*?)0+))$/, '$1');
      // Scientific notation for very large or very small values, e.g. 1.6022 × 10⁻¹⁹.
      const superscripts = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
      const exponent = String(Number(parts[1])).replace(/[-\d]/g, (character) => superscripts[character]);
      return mantissa + ' × 10' + exponent;
    }
    const decimals = absolute === 0
      ? 0
      : Math.max(0, significantDigits - 1 - Math.floor(Math.log10(absolute)));
    const parts = value.toFixed(Math.min(12, decimals))
      .replace(/(?:\.0+|(?:(\.\d*?)0+))$/, '$1').split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function categoryOf(unit) {
    return Object.keys(UNIT_TABLE).find((category) =>
      Object.prototype.hasOwnProperty.call(UNIT_TABLE[category], unit));
  }

  // Exported so the maths can be checked from Node: node -e "console.log(require('./app.js').convertUnit(1,'km','mi'))"
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { convertUnit, formatNumber, UNIT_TABLE, categoryOf };
  }
  if (typeof document === 'undefined') return;

  /* ==================== UI helpers ==================== */
  const THEME_KEY = 'unitconv.theme';
  const HISTORY_KEY = 'unitconv.history';

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  const ICONS = {
    all: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };
  const SVG_STYLE = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  function icon(name) {
    return '<svg viewBox="0 0 24 24" ' + SVG_STYLE + ' aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }
  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }
  function announce(text) {
    const live = document.getElementById('live');
    if (live) live.textContent = text;
  }
  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; }
  }
  function setValue(element, text) {
    if (!element || element.textContent === String(text)) return;
    element.textContent = String(text);
    if (prefersReducedMotion()) return;
    element.classList.remove('el-value-pop');
    void element.offsetWidth;
    element.classList.add('el-value-pop');
  }
  function near(got, expected, decimals) {
    const scale = 10 ** decimals;
    return Number.isFinite(Number(got)) &&
      Math.round(Number(got) * scale) === Math.round(Number(expected) * scale);
  }

  function testCard(options) {
    const cases = options.cases;
    const rows = cases.map((testCase, index) =>
      '<div class="el-test-row">' +
      '<span class="el-test-description">' + escapeHtml(testCase.label) + '</span>' +
      '<button type="button" class="el-test" data-test-index="' + index + '">' +
      '<span class="el-test__icon">▸</span>' +
      '<span>Run · expected ' + escapeHtml(testCase.expected) + '</span>' +
      '</button></div>').join('');
    return '<section class="el-card el-marks el-test-card">' +
      '<div class="el-card__head">' +
      '<span class="el-label">' + escapeHtml(options.title || 'Test cases') + '</span>' +
      '<span class="el-tag" data-test-counter>0 / ' + cases.length + ' passed</span>' +
      '</div><div class="el-test-list">' + rows + '</div></section>';
  }

  function wireTests(root, cases) {
    root.querySelectorAll('[data-test-index]').forEach((button, index) => {
      button.addEventListener('click', () => {
        const result = cases[index].run();
        const label = result.pass
          ? 'Matches · expected ' + cases[index].expected
          : 'Does not match · expected ' + cases[index].expected + ' · got ' + result.got;
        button.className = 'el-test ' + (result.pass ? 'el-test--pass' : 'el-test--fail');
        button.innerHTML = '<span class="el-test__icon">' + (result.pass ? '✓' : '✗') +
          '</span><span>' + escapeHtml(label) + '</span>';
        const passed = root.querySelectorAll('.el-test--pass').length;
        root.querySelector('[data-test-counter]').textContent = passed + ' / ' + cases.length + ' passed';
        announce(label);
      });
    });
  }

  const TOOL = {
    code: 'ALL', field: 'Anyone', tool: 'Unit converter', icon: 'all',
    tags: ['5 categories', 'history'],
    lead: 'Convert between common engineering units and keep a history of your last conversions.'
  };

  function toolHead(d) {
    const tags = d.tags.map((tag) => '<span class="el-tag">' + escapeHtml(tag) + '</span>').join('');
    return '<header class="el-toolhead"><div class="el-toolhead__id"><span class="el-icontile el-icontile--lg">' + icon(d.icon) + '</span>' +
      '<div class="el-toolhead__text"><div class="el-label">' + escapeHtml(d.code) + ' · ' + escapeHtml(d.field) + '</div>' +
      '<h1 id="page-title" tabindex="-1">' + escapeHtml(d.tool) + '</h1><p class="el-toolhead__lead">' + escapeHtml(d.lead) + '</p></div></div>' +
      '<div class="el-toolhead__right"><div class="el-tags">' + tags + '</div></div></header>';
  }

  /* ==================== Unit converter ==================== */
  function renderConverter(root, discipline) {
    const categories = ['Length', 'Mass', 'Pressure', 'Energy', 'Temperature'];
    const cases = [
      { label: '1 km → mi', expected: '0.621371 mi',
        run() { return run('Length', 1, 'km', 'mi', 0.621371); } },
      { label: '100 °C → °F', expected: '212 °F',
        run() { return run('Temperature', 100, '°C', '°F', 212); } },
      { label: '1 atm → psi', expected: '14.6959 psi',
        run() { return run('Pressure', 1, 'atm', 'psi', 14.6959); } }
    ];
    const categoryButtons = categories.map((category, index) =>
      '<button type="button" class="el-pill" data-cat="' + category + '" aria-pressed="' +
      (index === 0) + '">' + category + '</button>').join('');

    root.innerHTML = toolHead(discipline) +
      '<div class="el-converter-layout"><div>' +
      '<section class="el-card el-marks"><div class="el-card__head">' +
      '<span class="el-label">Category</span></div>' +
      '<div class="el-pills el-category-pills" role="group" aria-label="Unit category">' +
      categoryButtons + '</div><div class="el-converter-flow">' +
      '<div class="el-converter-row"><div class="el-field">' +
      '<label class="el-label" for="conv-value">Value</label>' +
      '<div class="el-input"><input id="conv-value" type="number" step="any" ' +
      'inputmode="decimal" value="1"></div></div>' +
      '<div class="el-field"><label class="el-label" for="conv-from">From unit</label>' +
      '<div class="el-select-wrap"><select id="conv-from"></select></div></div>' +
      '</div><button class="el-iconbtn el-swap" type="button" aria-label="Swap units">' +
      icon('all') + '</button>' +
      '<div class="el-converter-row"><div class="el-converter-output">' +
      '<span class="el-label">Result</span><output id="conv-result" aria-live="polite">—</output>' +
      '</div><div class="el-field"><label class="el-label" for="conv-to">To unit</label>' +
      '<div class="el-select-wrap"><select id="conv-to"></select></div></div>' +
      '</div><p id="conv-formula" class="el-converter-formula"></p></div></section>' +
      testCard({ title: 'Test cases', cases }) + '</div>' +
      '<section class="el-card el-marks el-history"><div class="el-card__head">' +
      '<span class="el-label">Recent conversions</span>' +
      '<button type="button" class="el-btn el-btn--ghost el-btn--sm" data-clear>' +
      icon('trash') + 'Clear</button></div><div id="history"></div></section></div>';

    const valueInput = root.querySelector('#conv-value');
    const fromSelect = root.querySelector('#conv-from');
    const toSelect = root.querySelector('#conv-to');
    let category = 'Length';
    let timer = null;
    let restoring = false;

    function setCategory(nextCategory, fromUnit, toUnit) {
      category = nextCategory;
      root.querySelectorAll('[data-cat]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.cat === category));
      });
      const options = (selectedUnit) => Object.keys(UNIT_TABLE[category]).map((unit) =>
        '<option value="' + escapeHtml(unit) + '"' +
        (unit === selectedUnit ? ' selected' : '') + '>' + escapeHtml(unit) + '</option>').join('');
      fromSelect.innerHTML = options(fromUnit);
      toSelect.innerHTML = options(toUnit);
    }

    function readHistory() {
      try {
        const stored = JSON.parse(storeGet(HISTORY_KEY) || '[]');
        if (!Array.isArray(stored)) return [];
        return stored.filter((item) => item && categories.includes(item.category) &&
          Number.isFinite(Number(item.value)) && Number.isFinite(Number(item.time)) &&
          categoryOf(item.from) === item.category && categoryOf(item.to) === item.category).slice(0, 10);
      } catch (error) {
        return [];
      }
    }

    let history = readHistory();
    function saveHistory() {
      storeSet(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
    }
    function displayHistoryItem(item) {
      const converted = convertUnit(item.value, item.from, item.to);
      return formatNumber(item.value, 6) + ' ' + item.from + ' = ' +
        formatNumber(converted, 6) + ' ' + item.to;
    }
    function dateText(timestamp) {
      const date = new Date(timestamp);
      const today = new Date();
      return date.toDateString() === today.toDateString()
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    function showHistory() {
      const historyBox = root.querySelector('#history');
      if (!history.length) {
        historyBox.innerHTML = '<p class="el-history-empty">No conversions yet. Your last 10 will show up here.</p>';
        return;
      }
      const rows = history.map((item, index) =>
        '<button type="button" class="el-history-row" data-history="' + index + '">' +
        '<span class="el-history-row__main">' + escapeHtml(displayHistoryItem(item)) + '</span>' +
        '<span class="el-history-row__meta">' + escapeHtml(item.category) + ' · ' +
        escapeHtml(dateText(item.time)) + '</span></button>').join('');
      historyBox.innerHTML = '<div class="el-history-list">' + rows + '</div>';
      historyBox.querySelectorAll('[data-history]').forEach((button) => {
        button.addEventListener('click', () => {
          const item = history[Number(button.dataset.history)];
          restoring = true;
          setCategory(item.category, item.from, item.to);
          valueInput.value = item.value;
          restoring = false;
          compute(false);
        });
      });
    }
    function addHistoryItem() {
      if (restoring || valueInput.value === '' || !Number.isFinite(Number(valueInput.value))) return;
      const item = {
        category,
        value: Number(valueInput.value),
        from: fromSelect.value,
        to: toSelect.value,
        time: Date.now()
      };
      // Remove a matching entry before adding it at the front, keeping history free of duplicates.
      const duplicateIndex = history.findIndex((previous) =>
        previous.category === item.category && Number(previous.value) === item.value &&
        previous.from === item.from && previous.to === item.to);
      if (duplicateIndex >= 0) history.splice(duplicateIndex, 1);
      history.unshift(item);
      history = history.slice(0, 10);
      saveHistory();
      showHistory();
    }
    function compute(debounce = true) {
      const inputValue = valueInput.value === '' ? NaN : Number(valueInput.value);
      const convertedValue = convertUnit(inputValue, fromSelect.value, toSelect.value);
      setValue(root.querySelector('#conv-result'), Number.isFinite(convertedValue)
        ? formatNumber(convertedValue, 6)
        : '—');
      const formula = category === 'Temperature'
        ? formatNumber(inputValue, 6) + ' ' + fromSelect.value + ' = ' +
          formatNumber(convertedValue, 6) + ' ' + toSelect.value
        : '1 ' + fromSelect.value + ' = ' +
          formatNumber(convertUnit(1, fromSelect.value, toSelect.value), 6) + ' ' + toSelect.value;
      root.querySelector('#conv-formula').textContent = Number.isFinite(convertedValue) ? formula : '';
      if (timer != null) clearTimeout(timer);
      // Debounce history writes so typing produces one entry after a one-second pause.
      if (debounce && Number.isFinite(convertedValue)) timer = setTimeout(addHistoryItem, 1000);
    }

    setCategory('Length', 'km', 'mi');
    showHistory();
    compute(false);
    root.querySelectorAll('[data-cat]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextCategory = button.dataset.cat;
        const units = Object.keys(UNIT_TABLE[nextCategory]);
        setCategory(nextCategory, units[0], units[1] || units[0]);
        compute();
      });
    });
    valueInput.addEventListener('input', () => compute());
    fromSelect.addEventListener('change', () => compute());
    toSelect.addEventListener('change', () => compute());
    root.querySelector('.el-swap').addEventListener('click', () => {
      const oldFrom = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = oldFrom;
      compute();
    });
    root.querySelector('[data-clear]').addEventListener('click', () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      history = [];
      saveHistory();
      showHistory();
    });

    function run(nextCategory, input, fromUnit, toUnit, expected) {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      restoring = true;
      setCategory(nextCategory, fromUnit, toUnit);
      valueInput.value = input;
      restoring = false;
      compute(false);
      const convertedValue = convertUnit(input, fromUnit, toUnit);
      const decimals = (String(expected).split('.')[1] || '').length;
      return {
        pass: near(convertedValue, expected, decimals),
        got: formatNumber(convertedValue, 6) + ' ' + toUnit
      };
    }
    wireTests(root, cases);
  }

  /* ==================== Theme + start ==================== */
  function initApp() {
    const app = document.getElementById('app');
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-toggle');
    const stored = storeGet(THEME_KEY);
    let explicitChoice = stored === 'light' || stored === 'dark';
    if (explicitChoice) root.setAttribute('data-theme', stored);
    else root.removeAttribute('data-theme');

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    function isDark() {
      return root.getAttribute('data-theme') === 'dark' ||
        (!root.hasAttribute('data-theme') && systemTheme.matches);
    }
    function updateThemeButton() {
      themeButton.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
      themeButton.innerHTML = icon(isDark() ? 'sun' : 'moon');
    }
    themeButton.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      explicitChoice = true;
      root.setAttribute('data-theme', next);
      storeSet(THEME_KEY, next);
      updateThemeButton();
    });
    const onSystemChange = () => {
      if (!explicitChoice) {
        root.removeAttribute('data-theme');
        updateThemeButton();
      }
    };
    if (systemTheme.addEventListener) systemTheme.addEventListener('change', onSystemChange);
    else if (systemTheme.addListener) systemTheme.addListener(onSystemChange);

    const page = document.createElement('div');
    page.className = prefersReducedMotion() ? 'el-page' : 'el-page el-page--enter';
    app.replaceChildren(page);
    renderConverter(page, TOOL);
    document.title = 'Unit converter';
    updateThemeButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
  else initApp();
})();
