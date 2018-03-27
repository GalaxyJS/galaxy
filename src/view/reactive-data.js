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

      makeReactive: function () {

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
        debugger;
        this.data = {};
        this.parent.makeReactive(this.parent.data, id);
      }

      defineProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      this.walk(this.data);
    }

    // this.parent.shadow[id] = this.shadow;
    this.parent.shadow[id] = this;
  }

  ReactiveData.prototype.setData = function (data) {
    this.removeMyRef();

    this.data = data;
    if (data.hasOwnProperty('__rd__')) {
      this.data.__rd__.addRef(this);
      this.refs = this.data.__rd__.refs;
    } else {
      defineProp(this.data, '__rd__', {
        enumerable: false,
        configurable: true,
        value: this
      });

      this.walk(this.data);
      debugger;
    }

    // Setup shadow properties
    for (let key in this.shadow) {
      if (!this.data.hasOwnProperty(key)) {
        this.makeReactive(this.data, key);
      }
    }
    debugger;
  };

  ReactiveData.prototype.walk = function (data) {
    if (data instanceof Array) {
      throw Error('Not implemented yet');
    } else if (data instanceof Object) {
      for (let key in data) {
        this.makeReactive(data, key);
      }
    }
  };

  ReactiveData.prototype.makeReactive = function (data, key) {
    const _this = this;
    let value = data[key];

    defineProp(data, key, {
      get: function () {
        return value;
      },
      set: function (val) {
        if (_this.shadow[key]) {
          _this.shadow[key].setData(val);
        }

        if (value === val) {
          return;
        }

        value = val;

        _this.notify(key);
      },
      enumerable: true,
      configurable: true
    });

    if (value instanceof Array) {
      throw Error('Not implemented yet');
    } else if (value instanceof Object) {
      this.data[key] = value;
      // new Galaxy.GalaxyView.ReactiveData(key, value, _this);
    } else {
      this.shadow[key] = null;
    }
  };

  ReactiveData.prototype.notify = function (key) {
    const _this = this;
    _this.refs.forEach(function (ref) {
      if (_this === ref) {
        return;
      }

      ref.notify(key);
    });

    // _this.sync(key);
    _this.parent.sync(key);
  };

  ReactiveData.prototype.sync = function (key) {
    const map = this.nodesMap[key];
    const value = this.data[key];
    if (map) {
      let key;
      map.nodes.forEach(function (node, i) {
        key = map.keys[i];
        if (node instanceof Galaxy.GalaxyView.ViewNode) {
          node.setters[key](value);
        } else {
          node[key] = value;
        }
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
    if (this.data && this.data.hasOwnProperty('__rd__') && this.data.__rd__ !== this) {
      this.refs = [this];
      this.data.__rd__.removeRef(this);
    }
  };

  ReactiveData.prototype.getRefById = function (id) {
    return this.refs.filter(function (ref) {
      return ref.id === id;
    })[0];
  };

  ReactiveData.prototype.addNode = function (node, nodeKey, dataKey, expression, scopeProperty) {
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
        // node.installPropertySetter(this, nodeKey, expression, scopeProperty);
      }

      map.keys.push(nodeKey);
      map.nodes.push(node);
    }
  };

  ReactiveData.prototype.addKeyToShadow = function (key) {
    this.shadow[key] = null;
    // debugger;
    // this.makeReactive(this.data, key);
  };

  return ReactiveData;

})();
