import { arr_concat } from "./utils.js";

const dom_manipulation_table = {};
const create_order = [], destroy_order = [];
let dom_manipulation_order = [];
let manipulation_done = true, dom_manipulations_dirty = false;
let diff = 0, preTS = 0, too_many_jumps;
let create_order_dirty = false, destroy_order_dirty = false;
let dom_manipulation_update_scheduled = false;

const schedule_microtask = typeof queueMicrotask === "function"
  ? queueMicrotask
  : (cb) => Promise.resolve().then(cb);
console.log(dom_manipulation_table);
const next_action = function(_jump, dirty) {
  if (dirty) {
    return _jump();
  }

  if (this.length) {
    this.shift()(next_action.bind(this, _jump));
  } else {
    _jump();
  }
};

const next_batch_body = function() {
  if (this.length) {
    let key = this.shift();
    let batch = dom_manipulation_table[key];
    if (!batch.length) {
      return next_batch.call(this);
    }

    next_action.call(batch, next_batch.bind(this), dom_manipulations_dirty);
  } else {
    manipulation_done = true;
    preTS = 0;
    diff = 0;
  }
};

const next_batch = function() {
  if (dom_manipulations_dirty) {
    dom_manipulations_dirty = false;
    diff = 0;
    refresh_dom_manipulation_order();
    return next_batch.call(dom_manipulation_order);
  }

  const now = performance.now();
  preTS = preTS || now;
  diff = diff + (now - preTS);
  preTS = now;

  if (diff > 2) {
    diff = 0;
    if (too_many_jumps) {
      clearTimeout(too_many_jumps);
      too_many_jumps = null;
    }

    too_many_jumps = setTimeout((ts) => {
      preTS = ts;
      next_batch_body.call(this);
    });
  } else {
    next_batch_body.call(this);
  }
};

function add_dom_manipulation(index, act, order, mark_order_dirty) {
  if (index in dom_manipulation_table) {
    dom_manipulation_table[index].push(act);
  } else {
    dom_manipulation_table[index] = [act];
    order.push(index);
    mark_order_dirty();
  }
}

function refresh_dom_manipulation_order() {
  if (destroy_order_dirty) {
    destroy_order.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    destroy_order_dirty = false;
  }

  if (create_order_dirty) {
    create_order.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    create_order_dirty = false;
  }

  dom_manipulation_order = arr_concat(destroy_order, create_order);
}

function update_dom_manipulation_order() {
  if (dom_manipulation_update_scheduled) {
    return;
  }

  dom_manipulation_update_scheduled = true;

  schedule_microtask(() => {
    dom_manipulation_update_scheduled = false;
    refresh_dom_manipulation_order();

    if (manipulation_done) {
      manipulation_done = false;
      next_batch.call(dom_manipulation_order);
    }
  });
}

// function update_on_timeout() {
//   if (last_dom_manipulation_id) {
//     clearTimeout(last_dom_manipulation_id);
//     last_dom_manipulation_id = null;
//   }
//
//   dom_manipulation_order = arrConcat(destroy_order, create_order);
//   last_dom_manipulation_id = setTimeout(() => {
//     if (manipulation_done) {
//       manipulation_done = false;
//       next_batch.call(dom_manipulation_order);
//     }
//   });
// }
//
// function update_on_animation_frame() {
//   if (last_dom_manipulation_id) {
//     cancelAnimationFrame(last_dom_manipulation_id);
//     last_dom_manipulation_id = null;
//   }
//
//   dom_manipulation_order = arrConcat(destroy_order, create_order);
//   last_dom_manipulation_id = requestAnimationFrame(() => {
//     if (manipulation_done) {
//       manipulation_done = false;
//       next_batch.call(dom_manipulation_order);
//     }
//   });
// }

/**
 *
 * @param {string} index
 * @param {Function} action
 * @static
 */
export function destroy_in_next_frame(index, action) {
  dom_manipulations_dirty = true;
  add_dom_manipulation("<" + index, action, destroy_order, () => {
    destroy_order_dirty = true;
  });
  update_dom_manipulation_order();
}

/**
 *
 * @param {string} index
 * @param {Function} action
 * @static
 */
export function create_in_next_frame(index, action) {
  dom_manipulations_dirty = true;
  add_dom_manipulation(">" + index, action, create_order, () => {
    create_order_dirty = true;
  });
  update_dom_manipulation_order();
}

export function max_index() {
  return "@" + performance.now();
}
