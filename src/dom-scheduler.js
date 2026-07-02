import { arr_concat } from "./utils.js";

const dom_manipulation_table = {};
const create_order = [], destroy_order = [];
let dom_manipulation_order = [];
let manipulation_done = true,
  dom_manipulations_dirty = false;
let diff = 0,
  preTS = 0,
  too_many_jumps;

const next_action = function (_jump, dirty) {
  if (dirty) {
    return _jump();
  }

  if (this.length) {
    this.shift()(next_action.bind(this, _jump));
  } else {
    _jump();
  }
};

const next_batch_body = function () {
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

const next_batch = function () {
  if (dom_manipulations_dirty) {
    dom_manipulations_dirty = false;
    diff = 0;
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

function comp_asc(a, b) {
  return a > b;
}

function comp_desc(a, b) {
  return a < b;
}

function binary_search(array, key, _fn) {
  let start = 0;
  let end = array.length - 1;
  let index = 0;

  while (start <= end) {
    let middle = Math.floor((start + end) / 2);
    let midVal = array[middle];

    if (_fn(key, midVal)) {
      // continue searching to the right
      index = start = middle + 1;
    } else {
      // search searching to the left
      index = middle;
      end = middle - 1;
    }
  }

  return index;
}

function pos_asc(array, el) {
  if (el < array[0]) {
    return 0;
  }

  if (el > array[array.length - 1]) {
    return array.length;
  }

  return binary_search(array, el, comp_asc);
}

function pos_desc(array, el) {
  if (el > array[0]) {
    return 0;
  }

  if (el < array[array.length - 1]) {
    return array.length;
  }

  return binary_search(array, el, comp_desc);
}

function add_dom_manipulation(index, act, order, search) {
  if (index in dom_manipulation_table) {
    dom_manipulation_table[index].push(act);
  } else {
    dom_manipulation_table[index] = [act];
    order.splice(search(order, index), 0, index);
  }
}

let last_dom_manipulation_id = 0;

function update_dom_manipulation_order() {
  if (last_dom_manipulation_id !== 0) {
    clearTimeout(last_dom_manipulation_id);
    last_dom_manipulation_id = 0;
  }

  dom_manipulation_order = arr_concat(destroy_order, create_order);
  last_dom_manipulation_id = setTimeout(() => {
    if (manipulation_done) {
      manipulation_done = false;
      next_batch.call(dom_manipulation_order);
    }
  });
}

// function update_on_animation_frame() {
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
// function update_on_timeout() {
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
  add_dom_manipulation("<" + index, action, destroy_order, pos_desc);
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
  add_dom_manipulation(">" + index, action, create_order, pos_asc);
  update_dom_manipulation_order();
}

export function max_index() {
  return "@" + performance.now();
}
