/* global Galaxy */

Galaxy.GalaxyView.ReactiveData = /** @class */ (function () {
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
  const scopeBuilder = function () {
    return {
      id: 'Scope',
      shadow: {},
      data: {},
      notify: function () {

      },
      sync: function () {

      },
      makeReactiveObject: function () {

      }
    };
  };

  /**
   * @param {string} id
   * @param {Object} data
   * @param {Galaxy.GalaxyView.ReactiveData} p
   * @constructor
   * @memberOf Galaxy.GalaxyView
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
    this.oldValue = undefined;

    if (this.data && this.data.hasOwnProperty('__rd__')) {
      this.refs = this.data.__rd__.refs;
      const refExist = this.getRefById(this.id);
      if (refExist) {
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

      defProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      this.walk(this.data);
    }

    if (this.parent.data instanceof Array) {
      this.keyInParent = this.parent.keyInParent;
    } else {
      this.parent.shadow[id] = this;
    }
  }

  ReactiveData.prototype.setData = function (data) {
    this.removeMyRef(data);

    if (!(data instanceof Object)) {
      this.data = {};

      for (let key in this.shadow) {
        this.notify(key);
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

    this.setupShadowProperties();
  };

  ReactiveData.prototype.walk = function (data) {
    const _this = this;
    if (data instanceof Array) {
      _this.makeReactiveArray(data);
    } else if (data instanceof Object) {
      for (let key in data) {
        _this.makeReactiveObject(data, key);
      }
    }
  };

  ReactiveData.prototype.makeReactiveObject = function (data, key, shadow) {
    const _this = this;
    let value = data[key];

    defProp(data, key, {
      get: function () {
        return value;
      },
      set: function (val) {
        if (value === val) {
          // If value is array, then sync should be called so nodes that are listening to array itself get updated
          if (val instanceof Array) {
            _this.sync(key);
          }
          return;
        }

        _this.oldValue = value;
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
  };

  ReactiveData.prototype.makeReactiveArray = function (value) {
    /**
     *
     * @type {Galaxy.GalaxyView.ReactiveData}
     * @private
     */
    const _this = this;

    if (value.hasOwnProperty('live')) {
      return value.changes;
    }
    _this.makeReactiveObject(value, 'live', true);

    const initialChanges = {
      original: value,
      type: 'reset',
      params: value
    };

    initialChanges.params.forEach(function (item) {
      new Galaxy.GalaxyView.ReactiveData(initialChanges.original.indexOf(item), item, _this);
    });

    let i = 0;
    let args;

    _this.sync('length');
    _this.oldValue = Object.assign({}, initialChanges);
    initialChanges.init = initialChanges;
    value.changes = initialChanges;
    _this.makeReactiveObject(value, 'changes');

    // We override all the array methods which mutate the array
    ARRAY_MUTATOR_METHODS.forEach(function (method) {
      const originalMethod = ARRAY_PROTO[method];
      defProp(value, method, {
        value: function () {
          i = arguments.length;
          args = new Array(i);
          while (i--) {
            args[i] = arguments[i];
          }

          const result = originalMethod.apply(this, args);
          const changes = {
            original: value,
            type: 'reset',
            params: value
          };

          changes.type = method;
          changes.params = args;
          changes.result = result;
          changes.init = initialChanges;

          _this.oldValue = value.changes;

          if (method === 'push' || method === 'reset' || method === 'unshift') {
            changes.params.forEach(function (item) {
              new Galaxy.GalaxyView.ReactiveData(changes.original.indexOf(item), item, _this);
            });
          } else if (method === 'pop' || method === 'splice' || method === 'shift') {
            //
          }

          // For arrays we have to sync length manually
          // if we use notify here we will get
          _this.sync('length');
          value.changes = changes;

          return result;
        },
        writable: false,
        configurable: true
      });
    });

    return initialChanges;
  };

  ReactiveData.prototype.notify = function (key, refs) {
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
    _this.parent.notify(_this.keyInParent);
  };

  ReactiveData.prototype.sync = function (key) {
    const _this = this;

    const map = this.nodesMap[key];
    const value = this.data[key];

    if (map) {
      let key;
      map.nodes.forEach(function (node, i) {
        key = map.keys[i];
        _this.syncNode(node, key, value);
      });
    }
  };

  ReactiveData.prototype.syncAll = function () {
    const _this = this;
    const keys = objKeys(this.data);
    keys.forEach(function (key) {
      _this.sync(key);
    });
  };

  ReactiveData.prototype.syncNode = function (node, key, value) {
    if (node instanceof Galaxy.GalaxyView.ViewNode) {
      node.setters[key](value, this.oldValue);
    } else {
      node[key] = value;
    }

    Galaxy.GalaxyObserver.notify(node, key, value, this.oldValue);
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveData} reactiveData
   */
  ReactiveData.prototype.addRef = function (reactiveData) {
    if (this.refs.indexOf(reactiveData) === -1) {
      this.refs.push(reactiveData);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ReactiveData} reactiveData
   */
  ReactiveData.prototype.removeRef = function (reactiveData) {
    const index = this.refs.indexOf(reactiveData);
    if (index !== -1) {
      this.refs.splice(index, 1);
    }
  };

  ReactiveData.prototype.removeMyRef = function () {
    if (this.data && this.data.hasOwnProperty('__rd__')) {
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

        const nextOwener = this.refs[0];
        defProp(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: nextOwener
        });

        nextOwener.walk(this.data);

        this.refs = [this];
      }
    }

  };

  ReactiveData.prototype.getRefById = function (id) {
    return this.refs.filter(function (ref) {
      return ref.id === id;
    })[0];
  };

  ReactiveData.prototype.addNode = function (node, nodeKey, dataKey, expression/*, scopeProperty*/) {
    let map = this.nodesMap[dataKey];
    if (!map) {
      map = this.nodesMap[dataKey] = {
        keys: [],
        nodes: []
      };
    }

    const index = map.nodes.indexOf(node);
    // Check if the node with the same property already exist
    // Insure that same node with different property bind can exist
    if (index === -1 || map.keys[index] !== nodeKey) {
      if (node instanceof Galaxy.GalaxyView.ViewNode && !node.setters[nodeKey]) {
        node.installSetter(this, nodeKey, expression);
      }

      map.keys.push(nodeKey);
      map.nodes.push(node);

      let initValue = this.data[dataKey];
      // We need initValue for cases where ui is bound to a property of an null object
      if ((initValue === null || initValue === undefined) && this.shadow[dataKey]) {
        initValue = {};
      }

      // if initValue is a change object,then we have to use its init for nodes that are newly being added
      if (this.data instanceof Array && initValue) {
        initValue = initValue.init;
      }

      this.syncNode(node, nodeKey, initValue);
    }
  };

  ReactiveData.prototype.removeNode = function (node) {
    const _this = this;
    this.refs.forEach(function (ref) {
      _this.removeNodeFromRef(ref, node);
    });
  };

  ReactiveData.prototype.removeNodeFromRef = function (ref, node) {
    let map;
    for (let key in ref.nodesMap) {
      map = ref.nodesMap[key];

      let index = -1;
      while ((index = map.nodes.indexOf(node)) !== -1) {
        map.nodes.splice(index, 1);
        map.keys.splice(index, 1);
      }
    }
  };

  ReactiveData.prototype.addKeyToShadow = function (key) {
    this.shadow[key] = null;
  };

  ReactiveData.prototype.setupShadowProperties = function () {
    for (let key in this.shadow) {
      if (!this.data.hasOwnProperty(key)) {
        this.makeReactiveObject(this.data, key, true);
      } else if (this.shadow[key] instanceof Galaxy.GalaxyView.ReactiveData) {
        this.shadow[key].setData(this.data[key]);
      }
    }
  };

  ReactiveData.prototype.makeKeyEnum = function (key) {
    const desc = Object.getOwnPropertyDescriptor(this.data, key);
    if (desc && desc.enumerable === false) {
      desc.enumerable = true;
      defProp(this.data, key, desc);
    }
  };

  return ReactiveData;

})();
