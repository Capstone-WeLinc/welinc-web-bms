// Run: node tests/zip-codes.cjs [directory containing the five source workbooks]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const xlsx = require('xlsx');

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.resolve(__dirname, '../src/lib', name + '.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', source)(exports, dependency => load(dependency.replace('./', '')));
  cache.set(name, exports);
  return exports;
}
const { WORKBOOK_LOCATIONS, WORKBOOK_ROUTE_CODES, getZipCodes, getZipCode } = load('zip-codes');
const { AREAS } = load('location-data');
const counts = { Bulacan: 572, Cavite: 803, Laguna: 681, Rizal: 189, NCR: 1715 };
for (const [area, expectedCount] of Object.entries(counts)) {
  const cities = WORKBOOK_LOCATIONS[area];
  assert.equal(Object.values(cities).reduce((sum, rows) => sum + Object.keys(rows).length, 0), expectedCount);
  assert.deepEqual(new Set(AREAS[area].cities), new Set(Object.keys(cities)));
  for (const [city, rows] of Object.entries(cities)) {
    assert.deepEqual(new Set(AREAS[area].barangaysByCity[city]), new Set(Object.keys(rows)));
    for (const [barangay, row] of Object.entries(rows)) {
      const codes = [...new Set(row.zip.split(',').map(code => code.trim()))];
      assert.deepEqual(getZipCodes(area, barangay, city), codes);
      assert.equal(getZipCode(area, barangay, city), codes.length === 1 ? codes[0] : '');
    }
  }
  if (process.argv[2]) {
    const workbook = xlsx.readFile(path.join(process.argv[2], area + '.xlsx'));
    let count = 0;
    for (const sheet of workbook.SheetNames) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: '' });
      if (sheet === 'Codes') {
        assert.deepEqual(WORKBOOK_ROUTE_CODES, rows.slice(1).filter(row => row[0]).map(([code, places, province]) => ({ code, places, province })));
        continue;
      }
      for (const row of rows.slice(1).filter(row => row.some(value => value !== ''))) {
        const [barangay, city, province, zip, code] = row.map(value => String(value).trim());
        assert.deepEqual(cities[city][barangay], { province, zip, code });
        count++;
      }
    }
    assert.equal(count, expectedCount);
  }
}
assert.equal(getZipCode('Bulacan', 'Sapang Palay', 'San Jose Del Monte'), '3024');
assert.deepEqual(getZipCodes('NCR', 'Alabang', 'Muntinlupa'), ['1799', '1781']);
assert.equal(getZipCode('NCR', 'Unknown', 'Muntinlupa'), '');
assert.equal(getZipCode('NCR', '', 'Muntinlupa'), '');
assert.equal(getZipCode('Pampanga', 'Balibago', 'Angeles'), '2009');
assert.equal(getZipCode('Batangas', 'Alangilan', 'Batangas City'), '4200');
console.log('Passed: 3,960 locations, dropdown coverage, ZIP options, fallback areas' + (process.argv[2] ? ', and full workbook parity.' : '.'));
