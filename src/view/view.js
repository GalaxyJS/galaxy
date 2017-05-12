/* global Galaxy */

(function (root, G) {
  root.Galaxy = G;
  /**
   *
   * @returns {Galaxy.GalaxyView}
   */
  G.GalaxyView = GalaxyView;

  /**
   *
   * @param {Galaxy.GalaxyScope} scope
   * @constructor
   */
  function GalaxyView(scope) {
    this.scope = scope;
    this.element = scope.element;
  }

  GalaxyView.REACTIVE_BEHAVIORS = {};

  GalaxyView.NODE_SCHEMA_PROPERTY_MAP = {
    id: {
      type: 'attr'
    },
    class: {
      type: 'attr',
      parser: function (value) {
        if (value instanceof Array) {
          return value.join(' ');
        }

        return value || '';
      }
    },
    title: {
      type: 'attr'
    },
    for: {
      type: 'attr'
    },
    href: {
      type: 'attr'
    },
    src: {
      type: 'attr'
    },
    alt: {
      type: 'attr'
    },
    style: {
      type: 'attr'
    },
    html: {
      type: 'prop',
      name: 'innerHTML'
    },
    text: {
      type: 'prop',
      name: 'innerText'
    },
    value: {
      type: 'prop',
      name: 'value'
    }
  };

  GalaxyView.prototype.init = function (schema) {
    this.append(schema, this.scope, this.element);
  };

  /**
   *
   * @param {Object} nodeSchema
   * @param {Object} nodeScopeData
   * @param {Element} parentNode
   */
  GalaxyView.prototype.append = function (nodeSchema, nodeScopeData, parentNode) {
    var _this = this;
    if (nodeSchema instanceof Array) {
      nodeSchema.forEach(function (nodeSchema) {
        _this.append(nodeSchema, nodeScopeData, parentNode);
      });
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      var viewNode = new GalaxyView.ViewNode(_this, nodeSchema);

      parentNode.appendChild(viewNode.placeholder);

      if (typeof viewNode.reactive === 'undefined') {
        Object.defineProperty(viewNode, 'reactive', {
          enumerable: true,
          configurable: false,
          value: {}
        });
      }

      var parentScopeData = nodeScopeData;

      if (nodeSchema['mutator']) {
        viewNode.mutator = nodeSchema['mutator'];
      }

      if (nodeSchema['reactive']) {
        parentScopeData = _this.addReactiveBehaviors(viewNode, nodeSchema, nodeScopeData, nodeSchema['reactive']);
      }

      viewNode.scope = parentScopeData;
      var attributeValue, bind, type;

      for (var attributeName in nodeSchema) {
        if (attributeName === 'reactive') {
          continue;
        }

        attributeValue = nodeSchema[attributeName];
        bind = null;
        type = typeof(attributeValue);

        if (type === 'string') {
          bind = attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/);
        } else if (type === 'function') {
          bind = [0, attributeValue];
        } else {
          bind = null;
        }

        if (bind) {
          _this.makeBinding(viewNode, nodeScopeData, attributeName, bind[1]);
        } else {
          _this.setPropertyForNode(viewNode, attributeName, attributeValue);
        }
      }

      if (!viewNode.template) {
        _this.append(nodeSchema.children, parentScopeData, viewNode.node);

        if (viewNode.inDOM) {
          parentNode.appendChild(viewNode.node);
        }
      }

      return viewNode;
    }
  };

  GalaxyView.prototype.addReactiveBehaviors = function (viewNode, nodeSchema, nodeScopeData, behaviors) {
    var allScopeData = Object.assign({}, nodeScopeData);

    for (var key in behaviors) {
      var behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
      var value = behaviors[key];

      if (behavior && value) {
        var matches = behavior.regex ? value.match(behavior.regex) : value;

        viewNode.reactive[key] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
          return function (_viewNode, _value) {
            return BEHAVIOR.onApply.call(this, _viewNode, _value, MATCHES, BEHAVIOR_SCOPE_DATA);
          };
        })(behavior, matches, allScopeData);

        behavior.bind.call(this, viewNode, nodeScopeData, matches);
      }
    }

    return allScopeData;
  };

  GalaxyView.prototype.setPropertyForNode = function (viewNode, attributeName, value) {
    if (attributeName.indexOf('reactive_') === 0) {
      var reactiveBehaviorName = attributeName.substring(9);
      if (viewNode.reactive[reactiveBehaviorName]) {
        viewNode.reactive[reactiveBehaviorName].call(this, viewNode, value);
      }

      return;
    }

    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];
    if (!property) {
      return;
    }

    value = property.parser ? property.parser(value) : value;

    switch (property.type) {
      case 'attr':
        viewNode.node.setAttribute(attributeName, value);
        break;

      case 'prop':
        viewNode.node[property.name] = value;
        break;
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} viewNode
   * @param {Object} dataHostObject
   * @param {String} attributeName
   * @param propertyValue
   */
  GalaxyView.prototype.makeBinding = function (viewNode, dataHostObject, attributeName, propertyValue) {
    var _this = this;
    // var t = performance.now();

    if (typeof dataHostObject !== 'object') {
      return;
    }

    var propertyName = propertyValue;
    var childProperty = null;

    if (typeof propertyValue === 'function') {
      propertyName = '[mutator]';
      dataHostObject[propertyName] = dataHostObject[propertyName] || [];
      dataHostObject[propertyName].push({
        for: attributeName,
        action: propertyValue
      });
      return;
    } else {
      var items = propertyValue.split('.');
      if (items.length > 1) {
        propertyName = items.shift();
        childProperty = items.join('.');
      }
    }

    if (typeof dataHostObject.__schemas__ === 'undefined') {
      Object.defineProperty(dataHostObject, '__schemas__', {
        enumerable: false,
        configurable: false,
        value: []
      });
    }

    var referenceName = '[' + propertyName + ']';
    var boundProperty = dataHostObject[referenceName];
    if (typeof dataHostObject[referenceName] === 'undefined') {
      boundProperty = new GalaxyView.BoundProperty(propertyName);

      Object.defineProperty(dataHostObject, referenceName, {
        enumerable: false,
        configurable: false,
        value: boundProperty
      });
    }

    var initValue = dataHostObject[propertyName];

    var enumerable = true;

    if (propertyName === 'length' && dataHostObject instanceof Array) {
      propertyName = '_length';
      enumerable = false;
    }

    Object.defineProperty(dataHostObject, propertyName, {
      get: function () {
        return boundProperty.value;
      },
      set: function (newValue) {
        if (boundProperty.value !== newValue) {
          boundProperty.setValue(attributeName, newValue);
        }
      },
      enumerable: enumerable,
      configurable: true
    });


    if (boundProperty) {
      boundProperty.value = initValue;
      if (!childProperty) {
        boundProperty.addNode(viewNode);
        viewNode.addProperty(boundProperty);

        if (viewNode.nodeSchema.mother && dataHostObject.__schemas__.indexOf(viewNode.nodeSchema.mother) === -1) {
          dataHostObject.__schemas__.push(viewNode.nodeSchema.mother);
        }
      }
    }

    if (childProperty) {
      _this.makeBinding(viewNode, dataHostObject[propertyName] || {}, attributeName, childProperty);
    } else if (typeof dataHostObject === 'object') {
      _this.setInitValue(boundProperty, attributeName, initValue);
    }
  };

  GalaxyView.prototype.setInitValue = function (boundProperty, attributeName, value) {
    if (value instanceof Array) {
      this.setArrayValue(boundProperty, attributeName, value);
    } else {
      this.setSingleValue(boundProperty, attributeName, value);
    }
  };

  GalaxyView.prototype.setSingleValue = function (boundProperty, attributeName, value) {
    boundProperty.nodes.forEach(function (node) {
      if (node.values[attributeName] !== value) {
        boundProperty.setValueFor(node, attributeName, value);
      }
    });
  };

  GalaxyView.prototype.setArrayValue = function (boundProperty, attributeName, value) {
    var arrayProto = Array.prototype;
    var methods = [
      'push',
      'pop',
      'shift',
      'unshift',
      'splice',
      'sort',
      'reverse'
    ];

    var throttle = null;

    // var boundProperty = hostObject['[' + propertyName + ']'];
    methods.forEach(function (method) {
      var original = arrayProto[method];
      Object.defineProperty(value, method, {
        value: function () {
          var arr = this;
          var i = arguments.length;
          var args = new Array(i);
          while (i--) {
            args[i] = arguments[i];
          }
          // method;
          var result = original.apply(this, args);
          // debugger
          // clearTimeout(throttle);
          // throttle = setTimeout(function () {
          if (typeof arr._length !== 'undefined') {
            arr._length = arr.length;
          }
// debugger;
          boundProperty.setValue(attributeName, value, args);
          // });

          return result;
        },
        writable: true,
        configurable: true
      });
    });

    boundProperty.nodes.forEach(function (node) {
      if (node.values[attributeName] !== value) {
        boundProperty.setValueFor(node, attributeName, value);
      }
    });
  };

}(this, Galaxy || {}));
