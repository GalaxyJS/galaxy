export const def_prop = Object.defineProperty;
export const del_prop = Reflect.deleteProperty;
export const obj_keys = Object.keys;
export const arr_concat = Array.prototype.concat.bind([]);
export function clone(obj) {
  let clone_instance = obj instanceof Array ? [] : {};
  clone_instance.__proto__ = obj.__proto__;
  for (let i in obj) {
    if (obj.hasOwnProperty(i)) {
      const v = obj[i];
      // Some objects can not be cloned and must be passed by reference
      if (v instanceof Promise || v instanceof Galaxy.Router) {
        clone_instance[i] = v;
      } else if (typeof (v) === 'object' && v !== null) {
        if (i === 'animations' && v && typeof v === 'object') {
          clone_instance[i] = v;
        } else {
          clone_instance[i] = clone(v);
        }
      } else {
        clone_instance[i] = v;
      }
    }
  }

  return clone_instance;
}

