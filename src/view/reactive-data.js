/* global Galaxy */

// const data = {
//   a: {
//     b: {
//       c: 'something',
//       _c_path: ['a.b.c', 'x.y.a.b.c']
//     },
//     _b_path: ['a.b', 'x.y.a.b']
//   },
//   _a_path: ['a', 'x.y.a']
// };
//
// const data2 = {
//   x: {
//     y: data,
//     _y_path: ['x.y']
//   },
//   _x_path: ['x']
// };
//
// const fromTemplate = {
//   'a.b.c': {
//     keys: ['text'],
//     nodes: ['p']
//   },
//   'x.y.a.b.c': {
//     keys: ['text'],
//     nodes: ['h3']
//   },
//   'a.b': {
//     keys: ['text'],
//     nodes: ['pre']
//   }
// };

Galaxy.View.ReactiveData = /** @class */ (function () {
  const ARRAY_PROTO = Array.prototype;
  const ARRAY_MUTATOR_METHODS = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse'
  ];
  const objKeys = Object.keys;
  const defProp = Object.defineProperty;
  const scopeBuilder = function (id) {
    return {
      id: '{Scope}',
      shadow: {},
      data: {},
      notify: function () { },
      notifyDown: function () {},
      sync: function () { },
      makeReactiveObject: function () { },
      addKeyToShadow: function () { }
    };
  };

  const getKeys = function (obj) {
    if (obj instanceof Array) {
      const keys = ['length'];
      if (obj.hasOwnProperty('changes')) {
        keys.push('changes');
      }
      return keys;
    } else {
      return Object.keys(obj);
    }
  };

  ReactiveData.UPDATE_DIRECTION_TOP_DOWN = 1;
  ReactiveData.UPDATE_DIRECTION_BOTTOM_UP = 2;

  /**
   * @param {string} id
   * @param {Object} data
   * @param {Galaxy.View.ReactiveData} p
   * @constructor
   * @memberOf Galaxy.View
   */
  function ReactiveData(id, data, p) {
    const parent = p || scopeBuilder();
    this.data = data;
    this.id = parent.id + '.' + id;
    this.keyInParent = id;
    this.nodesMap = {};
    this.parent = parent;
    this.refs = [];
    this.shadow = {};
    this.oldValue = {};
    this.nodeCount = -1;

    if (this.data && this.data.hasOwnProperty('__rd__')) {
      this.refs = this.data.__rd__.refs;
      // if (this.id === '{Scope}.data.products') debugger;
      const refExist = this.getRefById(this.id);
      if (refExist) {
        // Sometimes an object is already reactive, but its parent is dead, meaning all references to it are lost
        // In such a case that parent con be replace with a live parent
        if (refExist.parent.isDead) {
          refExist.parent = parent;
        }

        this.fixHierarchy(id, refExist);
        return refExist;
      }

      this.refs.push(this);
    } else {
      this.refs.push(this);
      // data === null means that parent does not have this id
      if (this.data === null) {
        // if a property with same id already exist in the parent shadow, then return it instead of making a new one
        if (this.parent.shadow[id]) {
          return this.parent.shadow[id];
        }
        this.data = {};
        this.parent.makeReactiveObject(this.parent.data, id, true);
      }

      if (!Object.isExtensible(this.data)) {
        return;
      }

      defProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      this.walk(this.data);
    }

    this.fixHierarchy(id, this);
  }

  ReactiveData.prototype = {
    get isDead() {
      return this.nodeCount === 0 && this.refs.length === 1 && this.refs[0] === this;
    },
    // If parent data is an array, then this would be an item inside the array
    // therefore its keyInParent should NOT be its index in the array but the
    // array's keyInParent. This way we redirect each item in the array to the
    // array's reactive data
    fixHierarchy: function (id, refrence) {
      if (this.parent.data instanceof Array) {
        this.keyInParent = this.parent.keyInParent;
      } else {
        this.parent.shadow[id] = refrence;
      }
    },
    setData: function (data) {
      this.removeMyRef();

      if (!(data instanceof Object)) {
        this.data = {};

        for (let key in this.shadow) {
          // Cascade changes down to all children reactive data
          if (this.shadow[key] instanceof Galaxy.View.ReactiveData) {

            this.shadow[key].setData(data);
          } else {
            // changes should only propagate downward
            this.notifyDown(key);
            // Reflect.deleteProperty(this.shadow, key);
          }
        }

        return;
      }

      this.data = data;
      if (data.hasOwnProperty('__rd__')) {
        this.data.__rd__.addRef(this);
        this.refs = this.data.__rd__.refs;

        if (this.data instanceof Array) {
          this.sync('length');
          this.sync('changes');
        } else {
          this.syncAll();
        }
      } else {
        defProp(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: this
        });

        this.walk(this.data);
      }

      this.setupShadowProperties(getKeys(this.data));
    },
    /**
     *
     * @param data
     */
    walk: function (data) {
      const _this = this;

      if (data instanceof Node) return;

      if (data instanceof Array) {
        _this.makeReactiveArray(data);
      } else if (data instanceof Object) {
        for (let key in data) {
          _this.makeReactiveObject(data, key);
        }
      }
    },
    /**
     *
     * @param data
     * @param {string} key
     * @param shadow
     */
    makeReactiveObject: function (data, key, shadow) {
      const _this = this;
      const property = Object.getOwnPropertyDescriptor(data, key);
      const getter = property && property.get;
      let value = data[key];

      defProp(data, key, {
        get: function () {
          return getter ? getter.call(data) : value;
        },
        set: function (val) {
          if (value === val) {
            // If value is array, then sync should be called so nodes that are listening to array itself get updated
            if (val instanceof Array) {
              _this.sync(key);
            } else if (val instanceof Object) {
              _this.notifyDown(key);
            }
            return;
          }

          _this.oldValue[key] = value;
          value = val;

          // This means that the property suppose to be an object and there probably active binds to it
          if (_this.shadow[key]) {
            _this.makeKeyEnum(key);
            // setData provide downward data flow
            _this.shadow[key].setData(val);
          }

          _this.notify(key);
        },
        enumerable: !shadow,
        configurable: true
      });

      if (this.shadow[key]) {
        this.shadow[key].setData(value);
      } else {
        this.shadow[key] = null;
      }

      // Update the ui for this key
      // This is for when the makeReactive method has been called by setData
      this.sync(key);

      _this.oldValue[key] = value;
    },
    /**
     *
     * @param arr
     * @returns {*}
     */
    makeReactiveArray: function (arr) {
      /**
       *
       * @type {Galaxy.View.ReactiveData}
       * @private
       */
      const _this = this;

      if (arr.hasOwnProperty('changes')) {
        return arr.changes;
      }
      // _this.makeReactiveObject(value, 'changes', true);

      const initialChanges = new Galaxy.View.ArrayChange();
      initialChanges.original = arr;
      initialChanges.snapshot = arr.slice(0);
      initialChanges.type = 'reset';
      initialChanges.params = arr;
      initialChanges.params.forEach(function (item) {
        if (item !== null && typeof item === 'object') {
          new Galaxy.View.ReactiveData(initialChanges.original.indexOf(item), item, _this);
        }
      });

      _this.sync('length');
      initialChanges.init = initialChanges;
      arr.changes = initialChanges;
      // _this.oldValue['changes'] = Object.assign({}, initialChanges);
      _this.makeReactiveObject(arr, 'changes');

      // We override all the array methods which mutate the array
      ARRAY_MUTATOR_METHODS.forEach(function (method) {
        const originalMethod = ARRAY_PROTO[method];
        defProp(arr, method, {
          value: function () {
            let i = arguments.length;
            const args = new Array(i);
            while (i--) {
              args[i] = arguments[i];
            }

            const returnValue = originalMethod.apply(this, args);
            const changes = new Galaxy.View.ArrayChange();
            changes.original = arr;
            changes.snapshot = arr.slice(0);
            changes.type = method;
            changes.params = args;
            changes.returnValue = returnValue;
            changes.init = initialChanges;

            if (method === 'push' || method === 'reset' || method === 'unshift') {
              changes.params.forEach(function (item) {
                if (item !== null && typeof item === 'object') {
                  new Galaxy.View.ReactiveData(changes.original.indexOf(item), item, _this);
                }
              });
            } else if (method === 'pop' || method === 'shift') {
              if (returnValue !== null && typeof returnValue === 'object' && returnValue.hasOwnProperty('__rd__')) {
                returnValue.__rd__.removeMyRef();
              }
            } else if (method === 'splice') {
              changes.params.slice(2).forEach(function (item) {
                if (item !== null && typeof item === 'object') {
                  new Galaxy.View.ReactiveData(changes.original.indexOf(item), item, _this);
                }
              });
            }

            // const cacheOldValue = value.changes;
            // _this.oldValue['changes'] = cacheOldValue;
            // For arrays we have to sync length manually
            // if we use notify here we will get
            _this.notifyDown('length');
            arr.changes = changes;

            return returnValue;
          },
          writable: false,
          configurable: true
        });
      });

      return initialChanges;
    },
    /**
     *
     * @param {string} key
     * @param refs
     */
    notify: function (key, refs) {
      const _this = this;

      if (this.refs === refs) {
        _this.sync(key);
        return;
      }

      _this.refs.forEach(function (ref) {
        if (_this === ref) {
          return;
        }

        ref.notify(key, _this.refs);
      });

      _this.sync(key);
      // if (this.id === '{Scope}.data.p') debugger;
      // if (_this.refs.length > 1/* && _this.data instanceof Array*/) {
      // const seen = {};
      // seen[_this.keyInParent] = true;
      const allKeys = _this.refs.map((item) => item.keyInParent);
      // const keys = allKeys.filter((item) => {
      //   return seen.hasOwnProperty(item) ? false : (seen[item] = true);
      // });

      allKeys.forEach((kip, i) => {
        _this.refs[i].parent.notify(kip);
      });
      // } else {
      //   _this.parent.notify(_this.keyInParent);
      // }
    },

    notifyDown: function (key) {
      const _this = this;

      _this.refs.forEach(function (ref) {
        if (_this === ref) {
          return;
        }

        ref.notify(key, _this.refs);
      });

      _this.sync(key);
    },
    /**
     *
     * @param {string} propertyKey
     */
    sync: function (propertyKey) {
      const _this = this;

      const map = _this.nodesMap[propertyKey];
      const oldValue = _this.oldValue[propertyKey];
      const value = _this.data[propertyKey];

      // notify the observers on the data
      Galaxy.Observer.notify(_this.data, propertyKey, value, oldValue);

      if (map) {
        map.nodes.forEach(function (node, i) {
          const key = map.keys[i];
          _this.syncNode(node, key, value, oldValue);
        });
      }
    },
    /**
     *
     */
    syncAll: function () {
      const _this = this;
      const keys = objKeys(_this.data);

      keys.forEach(function (key) {
        _this.sync(key);
      });
    },
    /**
     *
     * @param node
     * @param {string} key
     * @param {*} value
     * @param {*} oldValue
     */
    syncNode: function (node, key, value, oldValue) {
      // Pass a copy of the ArrayChange to every bound
      if (value instanceof Galaxy.View.ArrayChange) {
        value = value.getInstance();
      }

      if (node instanceof Galaxy.View.ViewNode) {
        node.setters[key](value, oldValue);
      } else {
        node[key] = value;
      }

      Galaxy.Observer.notify(node, key, value, oldValue);
    },
    /**
     *
     * @param {Galaxy.View.ReactiveData} reactiveData
     */
    addRef: function (reactiveData) {
      if (this.refs.indexOf(reactiveData) === -1) {
        this.refs.push(reactiveData);
      }
    },
    /**
     *
     * @param {Galaxy.View.ReactiveData} reactiveData
     */
    removeRef: function (reactiveData) {
      const index = this.refs.indexOf(reactiveData);
      if (index !== -1) {
        this.refs.splice(index, 1);
      }
    },
    /**
     *
     */
    removeMyRef: function () {
      if (!this.data || !this.data.hasOwnProperty('__rd__')) return;
      // if I am not the original reference, then remove me from the refs
      if (this.data.__rd__ !== this) {
        this.refs = [this];
        this.data.__rd__.removeRef(this);
      }
      // if I am the original reference and the only one, then remove the __rd__
      else if (this.refs.length === 1) {
        // TODO: Should be tested as much as possible to make sure it works with no bug
        delete this.data.__rd__;
        if (this.data instanceof Array) {
          delete this.data.live;
          delete this.data.changes;
        }
      }
      // if I am the original reference and not the only one
      else {
        this.data.__rd__.removeRef(this);
        const nextOwner = this.refs[0];
        defProp(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: nextOwner
        });
        nextOwner.walk(this.data);
        this.refs = [this];
      }

    },
    /**
     *
     * @param {string} id
     * @returns {*}
     */
    getRefById: function (id) {
      return this.refs.filter(function (ref) {
        return ref.id === id;
      })[0];
    },
    /**
     *
     * @param {Galaxy.View.ViewNode} node
     * @param {string} nodeKey
     * @param {string} dataKey
     * @param expression
     */
    addNode: function (node, nodeKey, dataKey, expression) {
      let map = this.nodesMap[dataKey];
      if (!map) {
        map = this.nodesMap[dataKey] = {
          keys: [],
          nodes: []
        };
      }

      if (this.nodeCount === -1) this.nodeCount = 0;

      const index = map.nodes.indexOf(node);
      // Check if the node with the same property already exist
      // Insure that same node with different property bind can exist
      if (index === -1 || map.keys[index] !== nodeKey) {
        this.nodeCount++;
        if (node instanceof Galaxy.View.ViewNode && !node.setters[nodeKey]) {
          node.installSetter(this, nodeKey, expression);
        }

        map.keys.push(nodeKey);
        map.nodes.push(node);

        let initValue = this.data[dataKey];
        // We need initValue for cases where ui is bound to a property of an null object
        // TODO: This line seem obsolete
        // if ((initValue === null || initValue === undefined) && this.shadow[dataKey]) {
        //   initValue = {};
        // }

        // if initValue is a change object, then we have to use its init for nodes that are newly being added
        // if the dataKey is length then ignore this line and use initValue which represent the length of array
        if (this.data instanceof Array && dataKey !== 'length' && initValue) {
          initValue = initValue.init;
        }

        this.syncNode(node, nodeKey, initValue);
      }
    },
    /**
     *
     * @param node
     */
    removeNode: function (node) {
      const _this = this;
      this.refs.forEach(function (ref) {
        _this.removeNodeFromRef(ref, node);
      });
    },
    /**
     *
     * @param ref
     * @param node
     */
    removeNodeFromRef: function (ref, node) {
      let map;
      for (let key in ref.nodesMap) {
        map = ref.nodesMap[key];

        let index = -1;
        while ((index = map.nodes.indexOf(node)) !== -1) {
          map.nodes.splice(index, 1);
          map.keys.splice(index, 1);
          this.nodeCount--;
        }
      }
    },
    /**
     *
     * @param {string} key
     */
    addKeyToShadow: function (key) {
      // Don't empty the shadow object if it exist
      if (!this.shadow[key]) {
        this.shadow[key] = null;
      }

      if (!this.data.hasOwnProperty(key)) {
        this.makeReactiveObject(this.data, key, false);
      }
    },
    /**
     *
     */
    setupShadowProperties: function (keys) {
      for (let key in this.shadow) {
        // Only reactive properties should be added to data
        if (this.shadow[key] instanceof Galaxy.View.ReactiveData) {
          if (!this.data.hasOwnProperty(key)) {
            this.makeReactiveObject(this.data, key, true);
          }
          this.shadow[key].setData(this.data[key]);
        } else if (keys.indexOf(key) === -1) {
          // This will make sure that UI is updated properly
          // for properties that has been removed from data
          this.sync(key);
        }
      }
    },
    /**
     *
     * @param {string} key
     */
    makeKeyEnum: function (key) {
      const desc = Object.getOwnPropertyDescriptor(this.data, key);
      if (desc && desc.enumerable === false) {
        desc.enumerable = true;
        defProp(this.data, key, desc);
      }
    }
  };

  return ReactiveData;

})();
