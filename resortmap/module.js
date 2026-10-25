/* Resort Map — loader called by the hub (shared/app.js).
   The map itself is an ES module (resortmap/app.mjs) so it can import
   the vendored Three.js; this classic script just hands it the container. */
(function () {
  window.CPMountResortMap = async function (container) {
    if (window.CPResortMapMounted) return;
    window.CPResortMapMounted = true;
    try {
      const mod = await import(new URL("resortmap/app.mjs", document.baseURI).href);
      await mod.mount(container);
    } catch (err) {
      window.CPResortMapMounted = false;
      throw err;
    }
  };
})();
