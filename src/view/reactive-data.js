/* global Galaxy */
(function (_galaxy) {
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

  const KEYS_TO_REMOVE_FOR_ARRAY = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'changes',
    '__rd__'
  ];
  const obj_keys = Object.keys;
  const def_prop = Object.defineProperty;
  const scope_builder = function (id) {
    return {
      id: id || 'Scope',
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

  const get_keys = function (obj) {
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

  function create_array_value(arr, method, initialChanges) {
    const originalMethod = ARRAY_PROTO[method];
    return function array_value() {
      const __rd__ = this.__rd__;

      let i = arguments.length;
      const args = new Array(i);
      while (i--) {
        args[i] = arguments[i];
      }

      const returnValue = originalMethod.apply(this, args);
      const changes = new _galaxy.View.ArrayChange();
      const _original = changes.original = arr;
      changes.type = method;
      changes.params = args;
      changes.returnValue = returnValue;
      changes.init = initialChanges;

      switch (method) {
        case 'push':
        case 'reset':
        case 'unshift':
          const _length = _original.length - 1;
          for (let i = 0, len = changes.params.length; i < len; i++) {
            const item = changes.params[i];
            if (item !== null && typeof item === 'object') {
              new ReactiveData(_length + i, item, __rd__);
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
              new ReactiveData(_original.indexOf(item), item, __rd__);
            }
          });
          break;
      }

      // repeat reactive property uses array.changes to detect the type of the mutation on array and react properly.
      arr.changes = changes;
      __rd__.notifyDown('length');
      __rd__.notifyDown('changes');
      __rd__.notify(__rd__.keyInParent, this);

      return returnValue;
    };
  }

  const SYNC_NODE = {
    _(node, key, value) {
      // Pass a copy of the ArrayChange to every bound
      if (value instanceof _galaxy.View.ArrayChange) {
        value = value.getInstance();
      }

      if (node instanceof _galaxy.View.ViewNode) {
        node.setters[key](value);
      } else {
        node[key] = value;
      }

      _galaxy.Observer.notify(node, key, value);
    },
    self(node, key, value, sameObjectValue, fromChild) {
      if (fromChild || sameObjectValue)
        return;

      SYNC_NODE._(node, key, value);
    },
    props(node, key, value, sameObjectValue, fromChild) {
      if (!fromChild)
        return;

      SYNC_NODE._(node, key, value);
    },
  };

  function NodeMap() {
    this.keys = [];
    this.nodes = [];
    this.types = [];
  }

  /**
   *
   * @param nodeKey
   * @param node
   * @param bindType
   */
  NodeMap.prototype.push = function (nodeKey, node, bindType) {
    this.keys.push(nodeKey);
    this.nodes.push(node);
    this.types.push(bindType);
  };

  /**
   * @param {string|number} id
   * @param {Object} data
   * @param {Galaxy.View.ReactiveData} p
   * @constructor
   * @memberOf Galaxy.View
   */
  function ReactiveData(id, data, p) {
    const parent = p instanceof ReactiveData ? p : scope_builder(p);
    this.data = data;
    this.id = parent.id + (id ? '.' + id : '|Scope');
    this.keyInParent = id;
    this.nodesMap = Object.create(null);
    this.parent = parent;
    this.refs = [];
    this.shadow = Object.create(null);
    this.nodeCount = -1;

    if (this.data && this.data.hasOwnProperty('__rd__')) {
      this.refs = this.data.__rd__.refs;
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
        if (this.parent.data[id]) {
          new ReactiveData(id, this.parent.data[id], this.parent);
        } else {
          this.parent.makeReactiveObject(this.parent.data, id, true);
        }
      }

      if (!Object.isExtensible(this.data)) {
        return;
      }

      def_prop(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      if (this.data instanceof Galaxy.Scope || this.data.__scope__) {
        this.addKeyToShadow = _galaxy.View.EMPTY_CALL;
      }

      if (this.data instanceof Galaxy.Scope) {
        this.walkOnScope(this.data);
      } else {
        this.walk(this.data);
      }
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
    fixHierarchy: function (id, reference) {
      if (this.parent.data instanceof Array) {
        this.keyInParent = this.parent.keyInParent;
      } else {
        this.parent.shadow[id] = reference;
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
          }
        }

        return;
      }

      this.data = data;
      if (data.hasOwnProperty('__rd__')) {
        this.data.__rd__.addRef(this);
        this.refs = this.data.__rd__.refs;

        if (this.data instanceof Array) {
          this.sync('length', this.data.length, false, false);
          this.sync('changes', this.data.changes, false, false);
        } else {
          this.syncAll();
        }
      } else {
        def_prop(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: this
        });

        this.walk(this.data);
      }

      this.setupShadowProperties(get_keys(this.data));
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
          this.makeReactiveObject(data, key, false);
        }
      }
    },

    walkOnScope: function (scope) {
      // this.makeReactiveObject(scope, 'data');
    },
    /**
     *
     * @param data
     * @param {string} key
     * @param shadow
     */
    makeReactiveObject: function (data, key, shadow) {
      let value = data[key];
      if (typeof value === 'function') {
        return;
      }

      const property = Object.getOwnPropertyDescriptor(data, key);
      const getter = property && property.get;
      const setter = property && property.set;

      def_prop(data, key, {
        get: function () {
          return getter ? getter.call(data) : value;
        },
        set: function (val) {
          const thisRD = data.__rd__;
          setter && setter.call(data, val);
          if (value === val) {
            // If value is array, then sync should be called so nodes that are listening to array itself get updated
            if (val instanceof Array) {
              thisRD.sync(key, val, true, false);
            } else if (val instanceof Object) {
              thisRD.notifyDown(key);
            }

            return;
          }

          value = val;

          // This means that the property suppose to be an object and there is probably an active binds to it
          // the active bind could be in one of the ref, so we have to check all the ref shadows
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
      this.sync(key, value, false, false);
    },
    /**
     *
     * @param arr
     * @returns {*}
     */
    makeReactiveArray: function (arr) {
      if (arr.hasOwnProperty('changes')) {
        return arr.changes.init;
      }

      const _this = this;
      const initialChanges = new _galaxy.View.ArrayChange();
      initialChanges.original = arr;
      initialChanges.type = 'reset';
      initialChanges.params = arr;
      for (let i = 0, len = initialChanges.params.length; i < len; i++) {
        const item = initialChanges.params[i];
        if (item !== null && typeof item === 'object') {
          new ReactiveData(initialChanges.original.indexOf(item), item, _this);
        }
      }

      _this.sync('length', arr.length, false, false);
      initialChanges.init = initialChanges;
      def_prop(arr, 'changes', {
        enumerable: false,
        configurable: false,
        writable: true,
        value: initialChanges
      });

      // We override all the array methods which mutate the array
      ARRAY_MUTATOR_METHODS.forEach(function (method) {
        def_prop(arr, method, {
          value: create_array_value(arr, method, initialChanges),
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
     * @param {boolean} fromChild
     */
    notify: function (key, value, refs, fromChild) {
      if (this.refs === refs) {
        this.sync(key, value, false, fromChild);
        return;
      }

      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        if (this === ref) {
          continue;
        }

        ref.notify(key, value, this.refs, fromChild);
      }

      this.sync(key, value, false, fromChild);
      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        const keyInParent = ref.keyInParent;
        const refParent = ref.parent;
        ref.parent.notify(keyInParent, refParent.data[keyInParent], null, true);
      }
    },

    notifyDown: function (key) {
      const value = this.data[key];
      this.notifyRefs(key, value);
      this.sync(key, value, false, false);
    },

    notifyRefs: function (key, value) {
      for (let i = 0, len = this.refs.length; i < len; i++) {
        const ref = this.refs[i];
        if (this === ref) {
          continue;
        }

        ref.notify(key, value, this.refs);
      }
    },
    /**
     *
     * @param {string} propertyKey
     * @param {*} value
     * @param {boolean} sameValueObject
     * @param {boolean} fromChild
     */
    sync: function (propertyKey, value, sameValueObject, fromChild) {
      const _this = this;
      const map = _this.nodesMap[propertyKey];
      // notify the observers on the data
      _galaxy.Observer.notify(_this.data, propertyKey, value);

      if (map) {
        for (let i = 0, len = map.nodes.length; i < len; i++) {
          _this.syncNode(map.types[i], map.nodes[i], map.keys[i], value, sameValueObject, fromChild);
        }
      }
    },
    /**
     *
     */
    syncAll: function () {
      const _this = this;
      const keys = obj_keys(_this.data);
      for (let i = 0, len = keys.length; i < len; i++) {
        _this.sync(keys[i], _this.data[keys[i]], false, false);
      }
    },
    /**
     *
     * @param {string} bindType
     * @param node
     * @param {string} key
     * @param {*} value
     * @param {boolean} sameObjectValue
     * @param {boolean} fromChild
     */
    syncNode: function (bindType, node, key, value, sameObjectValue, fromChild) {
      SYNC_NODE[bindType].call(null, node, key, value, sameObjectValue, fromChild);
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
      // if I am the original reference and the only one, then remove the __rd__ and reactive functionalities
      else if (this.refs.length === 1) {
        const _data = this.data;
        if (_data instanceof Array) {
          for (const method of KEYS_TO_REMOVE_FOR_ARRAY) {
            Reflect.deleteProperty(_data, method);
          }
        }
        // This cause an issue since the properties are still reactive
        // else if (_data instanceof Object) {
        //   Reflect.deleteProperty(_data, '__rd__');
        // }
        // TODO: Should be tested as much as possible to make sure it works with no bug
        // TODO: We either need to return the object to its original state or do nothing
      }
      // if I am the original reference and not the only one
      else {
        this.data.__rd__.removeRef(this);
        const nextOwner = this.refs[0];
        def_prop(this.data, '__rd__', {
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
     * @param {string} bindType
     * @param expression
     */
    addNode: function (node, nodeKey, dataKey, bindType, expression) {
      let map = this.nodesMap[dataKey];
      if (!map) {
        map = this.nodesMap[dataKey] = new NodeMap();
      }

      bindType = bindType || '_';

      if (this.nodeCount === -1) this.nodeCount = 0;

      const index = map.nodes.indexOf(node);
      // Check if the node with the same property already exist
      // Ensure that same node with different property bind can exist
      if (index === -1 || map.keys[index] !== nodeKey) {
        this.nodeCount++;
        if (node instanceof _galaxy.View.ViewNode && !node.setters[nodeKey]) {
          node.registerActiveProperty(nodeKey, this, expression);
        }

        map.push(nodeKey, node, bindType);

        // map.keys.push(nodeKey);
        // map.nodes.push(node);
        // map.types.push(bindType);

        let initValue = this.data[dataKey];
        // if the value is an instance of Array, then we should set its change property to its initial state
        if (initValue instanceof Array && initValue.changes) {
          if (initValue.hasOwnProperty('changes')) {
            initValue.changes = initValue.changes.init;
          } else {
            def_prop(initValue, 'changes', {
              enumerable: false,
              configurable: false,
              writable: true,
              value: initValue.changes.init
            });
          }
        }

        // if initValue is a change object, then we have to use its init for nodes that are newly being added
        // if the dataKey is length then ignore this line and use initValue which represent the length of array
        if (this.data instanceof Array && dataKey !== 'length' && initValue) {
          initValue = initValue.init;
        }

        this.syncNode('_', node, nodeKey, initValue, false, false);
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
          map.types.splice(index, 1);
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
      // Don't empty the shadow object if it exists
      if (!(key in this.shadow)) {
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
          this.sync(key, undefined, false, false);
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
        def_prop(this.data, key, desc);
      }
    }
  };

  _galaxy.View.ReactiveData = ReactiveData;

})(Galaxy);
