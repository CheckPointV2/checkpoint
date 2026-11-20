// Loads a browser-only CheckPoint script (one written as an IIFE against
// window/document) into a throwaway Node vm context, just enough for it to
// define itself without crashing, so its pure exported functions (the
// regex-based parsers, the business-rule helpers) can be called and tested
// directly — without adding a real DOM library as a dependency.
//
// This deliberately does NOT support calling anything that touches the DOM
// at runtime (renderX(), bindX(), anything under CP.sheet/CP.toast). Those
// stay covered by the Playwright checks run manually against the app; this
// shim exists for the parsing/business-logic functions that don't need a
// screen at all.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Deliberately NOT vm.createContext(): that creates a separate JS realm, so
// an array or object returned from the loaded script would have a different
// Array/Object constructor than this test file's own, and Node's
// assert.deepStrictEqual treats that as unequal even when the contents are
// identical. vm.runInThisContext runs in the same realm (sharing Array,
// Object, etc. with the caller) while still letting us control exactly what
// `window` and `localStorage` resolve to via real globals.
function loadWindow(scriptPaths) {
  const store = {};
  global.window = { CP: {} };
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  global.window.localStorage = global.localStorage;
  scriptPaths.forEach(p => {
    const code = fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    vm.runInThisContext(code, { filename: p });
  });
  return global.window;
}

module.exports = { loadWindow };
