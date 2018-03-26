/* global Galaxy */

Galaxy.GalaxyView.ReactiveData = /** @class */ (function () {
  const GV = Galaxy.GalaxyView;
  const objKeys = Object.keys;
  const defineProp = Object.defineProperty;

  /**
   *
   * @param {Object} data
   * @param {Galaxy.GalaxyView.ReactiveData} parent
   * @constructor
   * @memberOf Galaxy.GalaxyView
   */
  function ReactiveData(id, data, p) {
    const parent = p || {id: ''};
    this.data = data;
    this.id = parent.id + '.' + id;
    this.nodesMap = {};
    this.parent = parent;
    this.refs = [];
    this.shadow = {};

    if (data && data.hasOwnProperty('__portal__')) {
      this.refs = data.__portal__.refs;
      this.refs.push(this);
    } else {
      this.refs.push(this);
      this.walk(data);
    }
  }

  ReactiveData.prototype.walk = function (data) {
    if (data instanceof Array) {

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
        value = val;
        _this.notify(key);
      },
      enumerable: true,
      configurable: true
    });
  };

  ReactiveData.prototype.notify = function (key) {
    const _this = this;
    _this.refs.forEach(function (ref) {
      if (_this === ref) return;

      ref.notify(key);
    });

    _this.sync(key);
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

  return ReactiveData;

})();
