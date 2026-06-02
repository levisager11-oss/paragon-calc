// LocalStorage-backed store for named calculator builds. Each build holds a
// share-state object (see shareState.js), so saving, sharing and embedding all
// describe a build the same way.

const KEY = "paragon-calc:builds";
const MAX_BUILDS = 50;

function read() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(builds) {
  try {
    localStorage.setItem(KEY, JSON.stringify(builds));
  } catch {
    // storage unavailable or quota exceeded — saving is best-effort
  }
}

const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function listBuilds() {
  return read();
}

export function saveBuild(name, state) {
  const builds = read();
  const clean = String(name || "").trim().slice(0, 60) || "Untitled build";
  const build = { id: newId(), name: clean, state, savedAt: Date.now() };
  builds.unshift(build);
  write(builds.slice(0, MAX_BUILDS));
  return build;
}

export function deleteBuild(id) {
  write(read().filter((b) => b.id !== id));
}
