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
    this.keyInParent = id;
    this.nodesMap = {};
    this.parent = parent;
    this.refs = [];
    this.shadow = {};

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

    } else {
      this.parent.shadow[id] = this;
    }
  }

  ReactiveData.prototype.setData = function (data) {
    this.removeMyRef();

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
      this.syncAll();
    } else {
      defineProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      if (this.data instanceof Array) {
        this.makeReactiveArray(this.data);
      } else {
        this.walk(this.data);
      }
    }

    this.setupShadowProperties();
  };

  ReactiveData.prototype.walk = function (data) {
    const _this = this;
    if (data instanceof Array) {
      _this.makeReactiveArray(data);
      // data.forEach(function (item, i) {
      //   new Galaxy.GalaxyView.ReactiveData(i, item, _this);
      // });
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
        // This means that the property suppose to be an object and there probably active binds to it
        if (_this.shadow[key]) {
          _this.makeKeyEnum(key);
          // setData provide downward data flow
          _this.shadow[key].setData(val);
        }

        if (value === val) {
          return;
        }

        value = val;

        if (value instanceof Array) {
          _this.updateNode(key, _this.makeReactiveArray(value));
        } else {
          _this.notify(key);
        }
      },
      enumerable: !shadow,
      configurable: true
    });

    /*if (value instanceof Array) {
      console.warn('makeReactive: Array is not implemented yet');
      debugger;
    } else*/
    if (value instanceof Object) {
      this.data[key] = value;
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
    let changes = {
      original: value,
      type: 'reset',
      params: value
    };

    let oldChanges = Object.assign({}, changes);

    if (value.hasOwnProperty('live')) {
      return changes;
    }

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
    // let arr = value;
    let i = 0;
    let args;

    // boundPropertyReference.value = true;
    // defineProp(value, 'reactive', boundPropertyReference);
    _this.makeReactiveObject(value, 'live', true);
    _this.sync('length');

    methods.forEach(function (method) {
      let original = arrayProto[method];
      defineProp(value, method, {
        value: function () {
          i = arguments.length;
          args = new Array(i);
          while (i--) {
            args[i] = arguments[i];
          }

          let result = original.apply(this, args);

          // if (typeof arr._length !== 'undefined') {
          //   arr._length = arr.length;
          // }

          changes.type = method;
          changes.params = args;
          changes.result = result;

          // length nodes will be in this ReactiveData object
          _this.sync('length');
          // $for nodes will be in parent ReactiveData object
          _this.parent.update(_this.keyInParent, changes, oldChanges);
          oldChanges = Object.assign({}, changes);

          return result;
        },
        writable: false,
        configurable: true
      });
    });

    return changes;
  };

  ReactiveData.prototype.notify = function (key, refs) {
    const _this = this;

    if (this.refs === refs) {
      console.info('same refs', this.id);
      // TODO: it seems that there is not need to sync ui here but test more to be sure!
      // _this.sync(key);
      return;
    }

    _this.refs.forEach(function (ref) {
      if (_this === ref) {
        return;
      }

      ref.notify(key, _this.refs);
    });

    _this.sync(key);
    _this.parent.sync(_this.keyInParent);
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
      node.setters[key](value);
    } else {
      node[key] = value;
    }
  };

  ReactiveData.prototype.update = function (key, changes) {
    const _this = this;

    if (changes) {
      if (changes.type === 'push' || changes.type === 'reset' || changes.type === 'unshift') {
        changes.params.forEach(function (item) {
          new Galaxy.GalaxyView.ReactiveData(changes.original.indexOf(item), item, _this);
        });
        // GV.installParentFor(changes.params, this);
      } else if (changes.type === 'shift' || changes.type === 'pop') {
        // GV.uninstallParentFor([changes.result], this);
        // debugger;
        // uninstallRefFor([changes.result], _this);
        // debugger;
      } else if (changes.type === 'splice' || changes.type === 'reset') {
        // GV.uninstallParentFor(changes.result, this);
        // uninstallRefFor(changes.result, _this);
      }
    }

    this.updateNode(key, changes);
  };

  ReactiveData.prototype.updateNode = function (key, changes) {
    const _this = this;
    const map = this.nodesMap[key];

    if (map) {
      let key;
      map.nodes.forEach(function (node, i) {
        key = map.keys[i];
        _this.syncNode(node, key, changes);
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

  ReactiveData.prototype.removeMyRef = function () {
    if (this.data && this.data.hasOwnProperty('__rd__')) {
      if (this.data.__rd__ !== this) {
        this.refs = [this];
        this.data.__rd__.removeRef(this);
      } else if (this.refs.length === 1) {
        // TODO: Should be tested as much as possible to make sure it works with no bug
        delete this.data.__rd__;
      }
    }
  };

  ReactiveData.prototype.getRefById = function (id) {
    return this.refs.filter(function (ref) {
      return ref.id === id;
    })[0];
  };

  ReactiveData.prototype.addNode = function (node, nodeKey, dataKey, expression/*, scopeProperty*/) {
    console.info('rd', nodeKey, dataKey);

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

      if (initValue instanceof Array) {
        // this can not be in the syncNode because in the case of array, it is only called once
        if (node instanceof Galaxy.GalaxyView.ViewNode) {
          node.setters[nodeKey](this.makeReactiveArray(initValue));
        } else {
          node[nodeKey] = initValue;
        }
      } else {
        this.syncNode(node, nodeKey, initValue);
      }
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
      defineProp(this.data, key, desc);
    }
  };

  return ReactiveData;

})();
