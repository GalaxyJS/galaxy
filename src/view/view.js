/* global Galaxy, Promise */

(function (root, G) {
  var defineProp = Object.defineProperty;
  var setterAndGetter = {
    configurable: true,
    enumerable: false,
    set: null,
    get: null
  };
  var boundPropertyReference = {
    configurable: false,
    enumerable: false,
    value: null
  };
  var setAttr = Node.prototype.setAttribute;
  var nextTick = (function () {
    var callbacks = [];
    var pending = false;
    var timerFunc;

    function nextTickHandler() {
      pending = false;
      var copies = callbacks.slice(0);
      callbacks.length = 0;
      for (var i = 0; i < copies.length; i++) {
        copies[i]();
      }
    }

    var p = Promise.resolve();
    var logError = function (err) {
      console.error(err);
    };
    timerFunc = function () {
      p.then(nextTickHandler).catch(logError);
    };

    return function queueNextTick(cb, ctx) {
      var _resolve;
      callbacks.push(function () {
        if (cb) {
          try {
            cb.call(ctx);
          } catch (e) {
            console.error(e, ctx, 'nextTick');
          }
        } else if (_resolve) {
          _resolve(ctx);
        }
      });
      if (!pending) {
        pending = true;
        timerFunc();
      }
      if (!cb && typeof Promise !== 'undefined') {
        return new Promise(function (resolve, reject) {
          _resolve = resolve;
        });
      }
    };
  })();

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

  GalaxyView.nextTick = nextTick;

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
      name: 'textContent'
    },
    value: {
      type: 'prop',
      name: 'value'
    },
    $for: {
      type: 'reactive',
      name: '$for'
    },
    $if: {
      type: 'reactive',
      name: '$if'
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
  GalaxyView.prototype.append = function (nodeSchema, nodeScopeData, parentNode, position) {
    var _this = this;


    if (nodeSchema instanceof Array) {
      nodeSchema.forEach(function (nodeSchema) {
        _this.append(nodeSchema, nodeScopeData, parentNode);
      });
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      var viewNode = new GalaxyView.ViewNode(_this, nodeSchema);

      parentNode.insertBefore(viewNode.placeholder, position);

      var parentScopeData = nodeScopeData;

      if (nodeSchema['mutator']) {
        viewNode.mutator = nodeSchema['mutator'];
      }

      var behaviors = Object.keys(nodeSchema).filter(function (key) {
        return key.indexOf('$') === 0;
      });

      if (behaviors.length) {
        parentScopeData = _this.addReactiveBehaviors(viewNode, nodeSchema, nodeScopeData, behaviors);
      }

      // viewNode.data = parentScopeData;
      var attributeValue, bind, type;

      for (var attributeName in nodeSchema) {
        if (attributeName.indexOf('$') === 0) {
          continue;
        }

        attributeValue = nodeSchema[attributeName];
        bind = null;
        type = typeof(attributeValue);

        // register behavior if the attributeName refer to a behavior

        if (type === 'string') {
          bind = attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/);
        } else if (type === 'function') {
          bind = [0, attributeValue];
        } else {
          bind = null;
        }

        if (bind) {
          _this.makeBinding(viewNode, nodeScopeData, attributeName, bind[1]);
        } else if (GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName]) {
          _this.setPropertyForNode(viewNode, attributeName, attributeValue);
        }
      }

      if (!viewNode.template) {
        _this.append(nodeSchema.children, parentScopeData, viewNode.node);

        if (viewNode.inDOM) {
          viewNode.setInDOM(true);
        }
      }

      return viewNode;
    }
  };

  GalaxyView.prototype.addReactiveBehaviors = function (viewNode, nodeSchema, nodeScopeData, behaviors) {
    var allScopeData = Object.assign({}, nodeScopeData);

    for (var i = 0, len = behaviors.length; i < len; i++) {
      var key = behaviors[i];
      var behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
      var value = nodeSchema[key];

      if (behavior && value) {
        var matches = behavior.regex ? value.match(behavior.regex) : value;

        viewNode.reactive[key] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
          var CACHE = {};
          if (BEHAVIOR.getCache) {
            CACHE = BEHAVIOR.getCache(MATCHES, BEHAVIOR_SCOPE_DATA);
          }

          return function (_viewNode, _value) {
            return BEHAVIOR.onApply(CACHE, _viewNode, _value, MATCHES, BEHAVIOR_SCOPE_DATA);
          };
        })(behavior, matches, allScopeData);

        behavior.bind(viewNode, nodeScopeData, matches);
      }
    }

    return allScopeData;
  };

  GalaxyView.prototype.setPropertyForNode = function (viewNode, attributeName, value) {
    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];
    var newValue = property.parser ? property.parser(value) : value;

    switch (property.type) {
      case 'attr':
        viewNode.node.setAttribute(attributeName, newValue);
        break;

      case 'prop':
        viewNode.node[property.name] = newValue;
        break;

      case 'reactive':
        viewNode.reactive[property.name](viewNode, newValue);
        break;
    }
  };

  GalaxyView.prototype.getPropertySetter = function (viewNode, attributeName) {
    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];

    if (!property) {
      return null;
    }

    var parser = property.parser;

    switch (property.type) {
      case 'attr':
        return function (value) {
          var newValue = parser ? parser(value) : value;
          setAttr.call(viewNode.node, attributeName, newValue);
        };

      case 'prop':
        return function (value) {
          var newValue = parser ? parser(value) : value;
          viewNode.node[property.name] = newValue;
        };

      case 'reactive':
        var reactiveFunction = viewNode.reactive[property.name];
        return function (value) {
          reactiveFunction(viewNode, value);
        };
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

    var referenceName = '[' + propertyName + ']';
    var boundProperty = dataHostObject[referenceName];
    if (typeof boundProperty === 'undefined') {
      boundProperty = new GalaxyView.BoundProperty(propertyName);
      boundPropertyReference.value = boundProperty;
      defineProp(dataHostObject, referenceName, boundPropertyReference);
    }

    var initValue = dataHostObject[propertyName];
    var enumerable = true;

    if (propertyName === 'length' && dataHostObject instanceof Array) {
      propertyName = '_length';
      enumerable = false;
    }

    setterAndGetter.enumerable = enumerable;
    setterAndGetter.get = function () {
      return boundProperty.value;
    };

    setterAndGetter.set = function (newValue) {
      if (boundProperty.value !== newValue) {
        boundProperty.setValue(attributeName, newValue);
      }
    };

    defineProp(dataHostObject, propertyName, setterAndGetter);

    if (boundProperty) {
      boundProperty.value = initValue;
      if (!childProperty) {
        boundProperty.addNode(viewNode, attributeName);
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

    var changes = {
      original: value,
      type: 'push',
      params: value
    };

    var arr = value;
    var i = 0;
    var args;
    var updateValue = function (attr, changes) {
      boundProperty.updateValue(attr, changes);
    }

    methods.forEach(function (method) {
      var original = arrayProto[method];
      Object.defineProperty(value, method, {
        value: function () {
          i = arguments.length;
          args = new Array(i);
          while (i--) {
            args[i] = arguments[i];
          }

          var result = original.apply(this, args);

          if (typeof arr._length !== 'undefined') {
            arr._length = arr.length;
          }

          changes.type = method;
          changes.params = args;

          updateValue(attributeName, changes);

          return result;
        },
        writable: true,
        configurable: true
      });
    });

    boundProperty.nodes.forEach(function (node) {
      if (node.values[attributeName] !== value) {
        node.values[attributeName] = value;
        boundProperty.value = value;
        updateValue(attributeName, changes);
      }
    });
  };

}(this, Galaxy || {}));
