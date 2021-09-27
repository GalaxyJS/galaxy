/* global Galaxy */
Galaxy.View.ReactiveData = /** @class */ (function (G) {
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
      notify: function () {
      },
      notifyDown: function () {
      },
      sync: function () {
      },
      makeReactiveObject: function () {
      },
      addKeyToShadow: function () {
      }
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
        // TODO: Don't know if this is a proper fix
        if (this.parent.data[id]) {
          new ReactiveData(id, this.parent.data[id], this.parent);
        } else {
          this.parent.makeReactiveObject(this.parent.data, id, true);
        }
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
          if (this.shadow[key] instanceof ReactiveData) {
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
          this.sync('length', this.data.length);
          this.sync('changes', this.data.changes);
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
      if (data instanceof Node) return;

      if (data instanceof Array) {
        this.makeReactiveArray(data);
      } else if (data instanceof Object) {
        for (let key in data) {
          this.makeReactiveObject(data, key);
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
      const property = Object.getOwnPropertyDescriptor(data, key);
      const getter = property && property.get;
      const setter = property && property.set;
      let value = data[key];

      defProp(data, key, {
        get: function () {
          return getter ? getter.call(data) : value;
        },
        set: function (val) {
          const thisRD = data.__rd__;
          setter && setter.call(data, val);
          if (value === val) {
            // If value is array, then sync should be called so nodes that are listening to array itself get updated
            if (val instanceof Array) {
              thisRD.sync(key, val);
            } else if (val instanceof Object) {
              thisRD.notifyDown(key);
            }
            return;
          }

          value = val;

          // This means that the property suppose to be an object and there is probably an active binds to it
          // the active bind could be in one of the ref so we have to check all the ref shadows
          for (let i = 0, len = thisRD.refs.length; i < len; i++) {
            const ref = thisRD.refs[i];
            if (ref.shadow[key]) {
              ref.makeKeyEnum(key);
              // setData provide downward data flow
              ref.shadow[key].setData(val);
            }
          }

          thisRD.notify(key, value);
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
      this.sync(key, value);
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
        return arr.changes.init;
      }

      const initialChanges = new G.View.ArrayChange();

      initialChanges.original = arr;
      initialChanges.type = 'reset';
      initialChanges.params = arr;
      for (let i = 0, len = initialChanges.params.length; i < len; i++) {
        const item = initialChanges.params[i];
        if (item !== null && typeof item === 'object') {
          new ReactiveData(initialChanges.original.indexOf(item), item, _this);
        }
      }

      _this.sync('length', arr.length);
      initialChanges.init = initialChanges;
      defProp(arr, 'changes', {
        enumerable: false,
        configurable: true,
        value: initialChanges
      });

      // We override all the array methods which mutate the array
      ARRAY_MUTATOR_METHODS.forEach(function (method) {
        const originalMethod = ARRAY_PROTO[method];
        defProp(arr, method, {
          value: function () {
            const thisRD = this.__rd__;
            let i = arguments.length;
            const args = new Array(i);
            while (i--) {
              args[i] = arguments[i];
            }

            const returnValue = originalMethod.apply(this, args);
            const changes = new G.View.ArrayChange();
            const _original = changes.original = arr;
            changes.type = method;
            changes.params = args;
            changes.returnValue = returnValue;
            changes.init = initialChanges;

            switch (method) {
              case 'push':
              case 'reset':
              case 'unshift':
                for (let i = 0, len = changes.params.length; i < len; i++) {
                  const item = changes.params[i];
                  if (item !== null && typeof item === 'object') {
                    new ReactiveData(_original.indexOf(item), item, thisRD);
                  }
                }
                break;

              case 'pop':
              case 'shift':
                if (returnValue !== null && typeof returnValue === 'object' && '__rd__' in returnValue) {
                  returnValue.__rd__.removeMyRef();
                }
                break;

              case 'splice':
                changes.params.slice(2).forEach(function (item) {
                  if (item !== null && typeof item === 'object') {
                    new ReactiveData(_original.indexOf(item), item, thisRD);
                  }
                });
                break;
            }

            // if (method === 'push' || method === 'reset' || method === 'unshift') {
            //   for (let i = 0, len = changes.params.length; i < len; i++) {
            //     const item = changes.params[i];
            //     if (item !== null && typeof item === 'object') {
            //       new ReactiveData(changes.original.indexOf(item), item, thisRD);
            //     }
            //   }
            // } else if (method === 'pop' || method === 'shift') {
            //   if (returnValue !== null && typeof returnValue === 'object' && returnValue.hasOwnProperty('__rd__')) {
            //     returnValue.__rd__.removeMyRef();
            //   }
            // } else if (method === 'splice') {
            //   changes.params.slice(2).forEach(function (item) {
            //     if (item !== null && typeof item === 'object') {
            //       new ReactiveData(changes.original.indexOf(item), item, thisRD);
            //     }
            //   });
            // }

            defProp(arr, 'changes', {
              enumerable: false,
              configurable: true,
              value: changes
            });
            thisRD.notifyDown('length');
            thisRD.notifyDown('changes');
            thisRD.notify(thisRD.keyInParent, this);

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
     * @param {any} value
     * @param refs
     */
    notify: function (key, value, refs) {
      if (this.refs === refs) {
        this.sync(key, value);
        return;
      }

      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        if (this === ref) {
          continue;
        }

        ref.notify(key, value, this.refs);
      }

      this.sync(key, value);
      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        const keyInParent = ref.keyInParent;
        const refParent = ref.parent;
        ref.parent.notify(keyInParent, refParent.data[keyInParent], refParent.refs);
      }
    },

    notifyDown: function (key) {
      const value = this.data[key];

      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        if (this === ref) {
          continue;
        }

        ref.notify(key, value, this.refs);
      }

      this.sync(key, this.data[key]);
    },
    /**
     *
     * @param {string} propertyKey
     * @param {*} value
     */
    sync: function (propertyKey, value) {
      const _this = this;

      const map = _this.nodesMap[propertyKey];
      // const value = _this.data[propertyKey];

      // notify the observers on the data
      G.Observer.notify(_this.data, propertyKey, value);

      if (map) {
        for (let i = 0, len = map.nodes.length; i < len; i++) {
          const node = map.nodes[i];
          const key = map.keys[i];
          _this.syncNode(node, key, value);
        }
      }
    },
    /**
     *
     */
    syncAll: function () {
      const _this = this;
      const keys = objKeys(_this.data);
      for (let i = 0, len = keys.length; i < len; i++) {
        _this.sync(keys[i], _this.data[keys[i]]);
      }
    },
    /**
     *
     * @param node
     * @param {string} key
     * @param {*} value
     */
    syncNode: function (node, key, value) {
      // Pass a copy of the ArrayChange to every bound
      if (value instanceof G.View.ArrayChange) {
        value = value.getInstance();
      }

      if (node instanceof G.View.ViewNode) {
        node.setters[key](value);
      } else {
        node[key] = value;
      }

      G.Observer.notify(node, key, value);
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
      // Ensure that same node with different property bind can exist
      if (index === -1 || map.keys[index] !== nodeKey) {
        this.nodeCount++;
        if (node instanceof G.View.ViewNode && !node.setters[nodeKey]) {
          node.registerActiveProperty(nodeKey, this, expression);
        }

        map.keys.push(nodeKey);
        map.nodes.push(node);

        let initValue = this.data[dataKey];
        // if the value is a instance of Array, then we should set its change property to its initial state
        if (initValue instanceof Array && initValue.changes) {
          // initValue.changes = initValue.changes.init;
          defProp(initValue, 'changes', {
            enumerable: false,
            configurable: true,
            value: initValue.changes.init
          });
        }

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
      for (let i = 0, len = this.refs.length; i < len; i++) {
        this.removeNodeFromRef(this.refs[i], node);
      }
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
     * @param {boolean} isArray
     */
    addKeyToShadow: function (key, isArray) {
      // Don't empty the shadow object if it exist
      if (!this.shadow[key]) {
        if (isArray) {
          this.shadow[key] = new ReactiveData(key, [], this);
        } else {
          this.shadow[key] = null;
        }
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
        if (this.shadow[key] instanceof ReactiveData) {
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

})(Galaxy);
