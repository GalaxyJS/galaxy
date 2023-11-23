import Router from './router.js';

export function EMPTY_CALL() {}

export const def_prop = Object.defineProperty;
export const del_prop = Reflect.deleteProperty;

export const obj_keys = Object.keys;
export const arr_concat = Array.prototype.concat.bind([]);

export const arr_slice = Array.prototype.slice;

export function clone(obj) {
  let cloned = obj instanceof Array ? [] : {};
  cloned.__proto__ = obj.__proto__;
  for (let i in obj) {
    if (obj.hasOwnProperty(i)) {
      const v = obj[i];
      // Some objects can not be cloned and must be passed by reference
      if (v instanceof Promise || v instanceof Router) {
        cloned[i] = v;
      } else if (typeof (v) === 'object' && v !== null) {
        if (i === 'animations' && v && typeof v === 'object') {
          cloned[i] = v;
        } else {
          cloned[i] = clone(v);
        }
      } else {
        cloned[i] = v;
      }
    }
  }

  return cloned;
}
