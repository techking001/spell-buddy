// Saves changes automatically, with a short wait so quick repeated changes
// (like dragging a slider) become one save.
//   save(patch)    - callback that stores the merged changes and returns true/false
//   preview(patch) - optional: applies a change immediately, before it is saved
//   onState(state) - 'saving' | 'saved' | 'error'
export function createAutosaver({ save, preview, onState, delay = 400 }) {
  let pending = {};
  let failed = {};
  let timer = null;

  function run() {
    clearTimeout(timer);
    timer = null;
    const patch = { ...failed, ...pending };
    pending = {};
    if (!Object.keys(patch).length) return true;

    let ok = false;
    try {
      ok = save(patch) === true;
    } catch {
      ok = false;
    }
    if (ok) {
      failed = {};
      onState('saved');
    } else {
      failed = patch; // kept, so "Try again" and the next change include it
      onState('error');
    }
    return ok;
  }

  return {
    // immediate: true for one-tap controls (menus, checkboxes); false for sliders.
    save(patch, { immediate = false } = {}) {
      pending = { ...pending, ...patch };
      if (preview) preview(patch);
      onState('saving');
      clearTimeout(timer);
      if (immediate) return run();
      timer = setTimeout(run, delay);
      return null;
    },
    // Writes anything still waiting (used when the page is being closed or hidden).
    flush() {
      if (timer || Object.keys(failed).length) return run();
      return true;
    },
    retry() {
      onState('saving');
      return run();
    },
    // Forgets anything not yet saved (used by "Reset to defaults").
    clear() {
      clearTimeout(timer);
      timer = null;
      pending = {};
      failed = {};
    },
  };
}