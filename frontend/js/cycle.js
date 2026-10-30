// Serves items one at a time in shuffled "rounds".
// - Every item appears once per round before any item repeats.
// - When a round ends, the items are reshuffled and the next round starts.
// - The first item of a new round is never the last item of the previous round
//   (when there is more than one item).
// - With loop: false it stops after one round and next() returns null.
function shuffled(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createCycler(items, { loop = true, random = Math.random } = {}) {
  const pool = [...items];
  let queue = [];
  let last = null;
  let cycle = 0;
  let position = 0;

  function refill() {
    queue = shuffled(pool, random);
    if (last && queue.length > 1 && queue[0].id === last.id) {
      const j = 1 + Math.floor(random() * (queue.length - 1));
      [queue[0], queue[j]] = [queue[j], queue[0]];
    }
    cycle += 1;
    position = 0;
  }

  return {
    next() {
      if (!pool.length) return null;
      if (!queue.length) {
        if (cycle > 0 && !loop) return null;
        refill();
      }
      last = queue.shift();
      position += 1;
      return last;
    },
    get cycle() {
      return Math.max(cycle, 1);
    },
    get position() {
      return position;
    },
    get size() {
      return pool.length;
    },
    get remaining() {
      return queue.length;
    },
  };
}