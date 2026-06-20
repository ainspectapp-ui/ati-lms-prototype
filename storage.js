/**
 * Server-aware progress adapter.
 *
 * Sets window.storage to talk to /api/progress when the visitor is logged in,
 * and falls back to localStorage otherwise (so the public preview still works).
 * The pages' inline localStorage shim sees window.storage already defined and
 * defers to this. Loaded before the page script via <script src="/storage.js">.
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.storage && window.storage.get) return; // a native store already won

  var mem = {};
  var local = {
    get: function (k) {
      try { var v = window.localStorage.getItem(k); return v != null ? { value: v } : null; }
      catch (e) { return mem[k] != null ? { value: mem[k] } : null; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; }
      return { value: v };
    },
    del: function (k) {
      try { window.localStorage.removeItem(k); } catch (e) { delete mem[k]; }
    },
  };

  // Detect auth once; cache the promise.
  var authed = null;
  function isAuthed() {
    if (!authed) {
      authed = fetch('/api/me', { credentials: 'same-origin' })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    }
    return authed;
  }

  window.storage = {
    get: function (k) {
      return isAuthed().then(function (server) {
        if (!server) return local.get(k);
        return fetch('/api/progress/' + encodeURIComponent(k), { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (j) { return j && j.value != null ? { value: JSON.stringify(j.value) } : null; })
          .catch(function () { return local.get(k); });
      });
    },
    set: function (k, v) {
      return isAuthed().then(function (server) {
        if (!server) return local.set(k, v);
        var body; try { body = JSON.parse(v); } catch (e) { body = v; }
        return fetch('/api/progress/' + encodeURIComponent(k), {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: body }),
        }).then(function () { return { value: v }; }).catch(function () { return local.set(k, v); });
      });
    },
    delete: function (k) { local.del(k); return Promise.resolve({ deleted: true }); },
  };
})();
