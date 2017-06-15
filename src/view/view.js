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
  var setAttr = Element.prototype.setAttribute;
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
    this.dataRepos = {};
    var rootElement;

    if (scope.element instanceof GalaxyView.ViewNode) {
      rootElement = scope.element;
    } else {
      rootElement = new GalaxyView.ViewNode(this, {
        tag: scope.element.tagName,
        node: scope.element
      });
    }

    this.container = rootElement;
  }

  GalaxyView.nextTick = nextTick;

  GalaxyView.cleanProperty = function (obj, key) {
    delete obj[key];
  };

  GalaxyView.createMirror = function (obj) {
    var result = {};

    defineProp(result, '__parent__', {
      enumerable: false,
      value: obj
    });

    return result;
  };

  GalaxyView.REACTIVE_BEHAVIORS = {};

  GalaxyView.NODE_SCHEMA_PROPERTY_MAP = {
    tag: {
      type: 'none'
    },
    children: {
      type: 'none'
    },
    content: {
      type: 'none'
    },
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
    click: {
      type: 'event',
      name: 'click'
    }
  };

  GalaxyView.prototype.setupRepos = function (repos) {
    this.dataRepos = repos;
  };

  GalaxyView.prototype.init = function (schema) {
    this.append(schema, this.scope, this.container);
  };

  /**
   *
   * @param {Object} nodeSchema
   * @param {Object} nodeScopeData
   * @param {Element} parentViewNode
   */
  GalaxyView.prototype.append = function (nodeSchema, parentScopeData, parentViewNode, position) {
    var _this = this;
    var i = 0, len = 0;
    if (nodeSchema instanceof Array) {
      for (i = 0, len = nodeSchema.length; i < len; i++) {
        _this.append(nodeSchema[i], parentScopeData, parentViewNode);
      }
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      var viewNode = new GalaxyView.ViewNode(_this, nodeSchema);
      parentViewNode.append(viewNode, position);

      if (nodeSchema['mutator']) {
        viewNode.mutator = nodeSchema['mutator'];
      }

      var keys = Object.keys(nodeSchema);
      var attributeValue, bind, type, attributeName;
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = nodeSchema[attributeName];

        if (GalaxyView.REACTIVE_BEHAVIORS[attributeName]) {
          _this.addReactiveBehavior(viewNode, nodeSchema, parentScopeData, attributeName);
        }

        bind = null;
        type = typeof(attributeValue);

        if (type === 'string') {
          bind = attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/);
        } else if (type === 'function') {
          // bind = [0, attributeValue];
        } else {
          bind = null;
        }

        if (bind) {
          _this.makeBinding(viewNode, parentScopeData, attributeName, bind[1]);
        } else {
          _this.setPropertyForNode(viewNode, attributeName, attributeValue);
        }
      }

      if (!viewNode.template) {
        _this.append(nodeSchema.children, parentScopeData, viewNode);

        if (viewNode.inDOM) {
          viewNode.setInDOM(true);
        }
      }

      return viewNode;
    }
  };

  GalaxyView.prototype.addReactiveBehavior = function (viewNode, nodeSchema, nodeScopeData, key) {
    var behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
    var value = nodeSchema[key];

    if (behavior) {
      var matches = behavior.regex ? value.match(behavior.regex) : value;

      viewNode.properties[key] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
        var CACHE = {};
        if (BEHAVIOR.getCache) {
          CACHE = BEHAVIOR.getCache(viewNode, MATCHES, BEHAVIOR_SCOPE_DATA);
        }

        return function (_viewNode, _value) {
          return BEHAVIOR.onApply(CACHE, _viewNode, _value, MATCHES, BEHAVIOR_SCOPE_DATA);
        };
      })(behavior, matches, nodeScopeData);

      behavior.bind(viewNode, nodeScopeData, matches);
    }
  };

  GalaxyView.prototype.setPropertyForNode = function (viewNode, attributeName, value) {
    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName] || {type: 'attr'};
    var newValue = value;

    switch (property.type) {
      case 'attr':
        newValue = property.parser ? property.parser(value) : value;
        viewNode.node.setAttribute(attributeName, newValue);
        break;

      case 'prop':
        newValue = property.parser ? property.parser(value) : value;
        viewNode.node[property.name] = newValue;
        break;

      case 'reactive':
        viewNode.properties[property.name](viewNode, newValue);
        break;

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;

      case 'custom':
        property.handler(viewNode, attributeName, value);
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
        var reactiveFunction = viewNode.properties[property.name];
        return function (value) {
          reactiveFunction(viewNode, value);
        };

      case 'custom':
        return function (value) {
          property.handler(viewNode, attributeName, value);
        };

      default:
        return function (value) {
          var newValue = parser ? parser(value) : value;
          setAttr.call(viewNode.node, attributeName, newValue);
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
  GalaxyView.prototype.makeBinding = function (viewNode, hostObject, attributeName, propertyValue) {
    var _this = this;
    var hostDataObject = hostObject;
    if (typeof hostDataObject !== 'object') {
      return;
    }

    var propertyName = propertyValue;
    var childProperty = null;

    if (typeof propertyValue === 'function') {
      propertyName = '[mutator]';
      hostDataObject[propertyName] = hostDataObject[propertyName] || [];
      hostDataObject[propertyName].push({
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

    if (!hostDataObject.hasOwnProperty(propertyName) && hostDataObject.__parent__ && hostDataObject.__parent__.hasOwnProperty(propertyName)) {
      hostDataObject = hostDataObject.__parent__;
    }

    var initValue = hostDataObject[propertyName];
    var enumerable = true;
    if (propertyName === 'length' && hostDataObject instanceof Array) {
      propertyName = '_length';
      enumerable = false;
    }

    var referenceName = '[' + propertyName + ']';
    var boundProperty = hostDataObject[referenceName];

    if (typeof boundProperty === 'undefined') {
      boundProperty = new GalaxyView.BoundProperty(propertyName);
      boundPropertyReference.value = boundProperty;
      defineProp(hostDataObject, referenceName, boundPropertyReference);

      setterAndGetter.enumerable = enumerable;
      setterAndGetter.get = function () {
        return boundProperty.value;
      };

      if (childProperty) {
        setterAndGetter.set = function (newValue) {
          if (boundProperty.value !== newValue) {
            if (newValue !== null && typeof boundProperty.value === 'object') {
              var all = Object.getOwnPropertyNames(boundProperty.value);
              var visible = Object.keys(boundProperty.value);
              var newVisible = Object.keys(newValue);
              var descriptors = {};
              var hidden = all.filter(function (key) {
                descriptors[key] = Object.getOwnPropertyDescriptor(boundProperty.value || {}, key);
                return visible.indexOf(key) === -1;
              });

              newVisible.forEach(function (key) {
                if (hidden.indexOf('[' + key + ']') !== -1) {
                  descriptors['[' + key + ']'].value.value = newValue[key];
                  descriptors['[' + key + ']'].value.setValue(newValue[key]);

                  defineProp(newValue, '[' + key + ']', descriptors['[' + key + ']']);
                  defineProp(newValue, key, descriptors[key]);
                }
              });
            }

            boundProperty.setValue(newValue);
          }
        };
      } else {
        setterAndGetter.set = function (newValue) {
          if (boundProperty.value !== newValue) {
            boundProperty.setValue(newValue);
          }
        };
      }

      defineProp(hostDataObject, propertyName, setterAndGetter);
    }

    if (boundProperty) {
      boundProperty.value = initValue;
      if (!childProperty) {
        boundProperty.addNode(viewNode, attributeName);
      }
    }

    if (childProperty) {
      _this.makeBinding(viewNode, hostDataObject[propertyName] || {}, attributeName, childProperty);
    } else if (typeof hostDataObject === 'object') {
      if (initValue instanceof Array) {
        this.setArrayValue(boundProperty, attributeName, initValue, viewNode);
      } else {
        boundProperty.setValueFor(viewNode, attributeName, initValue);
      }
    }
  };

  GalaxyView.prototype.setArrayValue = function (boundProperty, attributeName, value, viewNode) {
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
    var updateValue = function (changes) {
      boundProperty.updateValue(changes);
    };

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

          updateValue(changes);

          return result;
        },
        writable: true,
        configurable: true
      });
    });

    if (viewNode.values[attributeName] !== value) {
      viewNode.values[attributeName] = value;
      boundProperty.value = value;
      boundProperty.setUpdateFor(viewNode, attributeName, changes);
    }
  };

}(this, Galaxy || {}));
