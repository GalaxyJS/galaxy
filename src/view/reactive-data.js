/* global Galaxy */

Galaxy.GalaxyView.ReactiveData = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  const objKeys = Object.keys;
  const defineProp = Object.defineProperty;
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

  const uninstallRefFor = function (list, ref) {
    let itemRD;
    list.forEach(function (item) {
      itemRD = item.__rd__;
      if (itemRD) {
        itemRD.removeRef(ref);
      }
    });
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
    // if (p && p.data instanceof Array) {
    //   this.keyInParent = p.keyInParent;
    // } else {
    this.keyInParent = id;
    // }
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
        this.data = {};
        this.parent.makeReactiveObject(this.parent.data, id, true);
      }

      defineProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      this.walk(this.data);
    }

    // this.parent.shadow[id] = this.shadow;
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
      }
    } else {
      defineProp(this.data, '__rd__', {
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

    defineProp(data, key, {
      get: function () {
        return value;
      },
      set: function (val) {
        // if (key === 'people') {
        //   this;
        //   debugger;
        // }
        // This means that the property suppose to be an object and there probably active binds to it
        if (_this.shadow[key]) {
          // debugger;
          _this.makeKeyEnum(key);
          // setData provide downward data flow
          _this.shadow[key].setData(val);
          // debugger;
        }

        if (value === val) {
          // If value is array, then sync should be called so nodes that are listening to array itself get updated
          if (val instanceof Array) {
            _this.sync(key);
          }
          return;
        }

        _this.oldValue = value;

        value = val;

        // if (value instanceof Array) {
        //   // _this.makeReactiveArray(value);
        //   // _this.update(key, _this.makeReactiveArray(value));
        // } else {
        _this.notify(key);
        // }
      },
      enumerable: !shadow,
      configurable: true
    });

    /*if (value instanceof Array) {
      new Galaxy.GalaxyView.ReactiveData(key, value, this);
      debugger;
      return this.data[key] = value;
    } else */
    if (value instanceof Object) {
      this.data[key] = value;
    } else if (this.shadow[key]) {
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

    // debugger;

    const arrayProto = Array.prototype;
    const methods = [
      'push',
      'pop',
      'shift',
      'unshift',
      'splice',
      'sort',
      'reverse'
    ];

    let i = 0;
    let args;

    _this.sync('length');
    _this.oldValue = Object.assign({}, initialChanges);
    initialChanges.init = initialChanges;
    value.changes = initialChanges;
    _this.makeReactiveObject(value, 'changes');

    methods.forEach(function (method) {
      let original = arrayProto[method];
      defineProp(value, method, {
        value: function () {
          i = arguments.length;
          args = new Array(i);
          while (i--) {
            args[i] = arguments[i];
          }

          const result = original.apply(this, args);
          const changes = {
            original: value,
            type: 'reset',
            params: value
          };

          changes.type = method;
          changes.params = args;
          changes.result = result;
          changes.init = initialChanges;

          if (method === 'push' || method === 'reset' || method === 'unshift') {
            // if (!_this.shadow[key]) {
            //   console.error('no shadow for array')
            //   debugger;
            // }

            changes.params.forEach(function (item) {
              new Galaxy.GalaxyView.ReactiveData(changes.original.indexOf(item), item, _this);
            });

            // debugger;
          }

          _this.sync('length');

          value.changes = changes;
          // debugger;
          // For arrays we have to sync length manually
          // if we use notify here we will get
          // length nodes will be in this ReactiveData object

          // $for nodes will be in parent ReactiveData object
          // _this.parent.update(_this.keyInParent, changes);
          // _this.parent.notify(_this.keyInParent);
          _this.oldValue = Object.assign({}, changes);

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

      // console.info('same refs', this.id);
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
    // if (key === 'done' || key === 'items' || key === 'inputs') {
    //   this;
    //   debugger;
    // }
    // this will cause that $for get the array instead of the changes
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

  ReactiveData.prototype.update = function (key, changes) {
    const _this = this;

    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        // if (!_this.shadow[key]) {
        //   console.error('no shadow for array')
        //   debugger;
        // }

        const arrayItemParent = _this.shadow[key];
        changes.params.forEach(function (item) {
          new Galaxy.GalaxyView.ReactiveData(changes.original.indexOf(item), item, arrayItemParent);
        });
        debugger;
      } else if (changes.type === 'shift' || changes.type === 'pop') {
      } else if (changes.type === 'splice' || changes.type === 'reset') {
      }
    }

    this.updateNode(key, changes);
  };

  /**
   *
   * @param key
   * @param changes
   */
  ReactiveData.prototype.updateNode = function (key, changes) {
    const _this = this;
    const map = this.nodesMap[key];

    if (map) {
      let key;
      map.nodes.forEach(function (node, i) {
        key = map.keys[i];
        if (node instanceof Galaxy.GalaxyView.ViewNode) {
          node.setters[key](changes, _this.oldValue);
        } else {
          node[key] = changes.original;
        }

        Galaxy.GalaxyObserver.notify(node, key, changes, _this.oldValue);
      });
    }
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

  ReactiveData.prototype.removeRef = function (reactiveData) {
    const index = this.refs.indexOf(reactiveData);
    if (index !== -1) {
      this.refs.splice(index, 1);
    }
  };

  ReactiveData.prototype.removeMyRef = function (data) {

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
        // debugger
        this.data.__rd__.removeRef(this);

        const nextOriginal = this.refs[0];
        defineProp(this.data, '__rd__', {
          enumerable: false,
          configurable: true,
          value: nextOriginal
        });
        // debugger
        nextOriginal.walk(this.data);
        // debugger
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
    // console.info('rd', nodeKey, dataKey);

    let map = this.nodesMap[dataKey];
    if (!map) {
      map = this.nodesMap[dataKey] = {
        keys: [],
        nodes: []
      };
    }

    let index = map.nodes.indexOf(node);
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
    let map;
    for (let prop in this.nodesMap) {
      map = this.nodesMap[prop];

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
        // debugger
        this.makeReactiveObject(this.data, key, true);
        // debugger;
      } else if (this.shadow[key] instanceof Galaxy.GalaxyView.ReactiveData) {
        // debugger;
        if (!(this.data[key] instanceof Array)) {
          this.shadow[key].setData(this.data[key]);
        }
      }
    }
  };

  ReactiveData.prototype.makeKeyEnum = function (key) {
    const desc = Object.getOwnPropertyDescriptor(this.data, key);
    if (desc && desc.enumerable === false) {
      desc.enumerable = true;
      defineProp(this.data, key, desc);
    }
  };

  return ReactiveData;

})();
