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

  GalaxyView.nextTick = nextTick;

  GalaxyView.defineProp = defineProp;

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

  GalaxyView.createClone = function (source) {
    var cloned = Object.assign({}, source);

    for (var key in source) {
      if (source.hasOwnProperty('[' + key + ']')) {
        boundPropertyReference.value = source['[' + key + ']'];
        defineProp(cloned, '[' + key + ']', boundPropertyReference);
        defineProp(cloned, key, Object.getOwnPropertyDescriptor(source, key));
      }
    }

    return cloned;
  };

  GalaxyView.getPropertyContainer = function (data, propertyName) {
    var container = data;
    var tempData = data.hasOwnProperty(propertyName);

    while (tempData.__parent__) {
      if (tempData.__parent__.hasOwnProperty(propertyName)) {
        container = tempData.__parent__;
        break;
      }

      tempData = data.__parent__;
    }

    return container;
  };

  GalaxyView.getAllViewNodes = function (node) {
    var item, viewNodes = [];

    for (var i = 0, len = node.childNodes.length; i < len; i++) {
      item = node.childNodes[i];
      viewNodes = viewNodes.concat(GalaxyView.getAllViewNodes(item));

      if (item.hasOwnProperty('__viewNode__')) {
        viewNodes.push(item.__viewNode__);
      }
    }

    return viewNodes.filter(function (value, index, self) {
      return self.indexOf(value) === index;
    });
  };

  GalaxyView.getBoundProperties = function (host) {
    var all = Object.getOwnPropertyNames(host);
    var visible = Object.keys(host);
    var properties = [];

    all.forEach(function (key) {
      if (host[key] instanceof GalaxyView.BoundProperty && visible.indexOf(key) === -1) {
        properties.push(host[key]);
      }
    });

    return properties;
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
      type: 'prop'
    },
    css: {
      type: 'attr',
      name: 'style'
    },
    html: {
      type: 'prop',
      name: 'innerHTML'
    },
    text: {
      type: 'custom',
      handler: function (viewNode, attr, value) {
        var textNode = viewNode.node['[text]'];
        var textValue = typeof value === 'undefined' ? '' : value;
        if (textNode) {
          textNode.textContent = textValue;
        } else {
          viewNode.node['[text]'] = document.createTextNode(textValue);
          viewNode.node.insertBefore(viewNode.node['[text]'], viewNode.node.firstChild);
        }
      }
    },
    checked: {
      type: 'prop'
    },
    click: {
      type: 'event',
      name: 'click'
    }
  };

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
        tag: scope.element.tagName
        // node: scope.element
      }, scope.element);
    }

    this.container = rootElement;
  }

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
          _this.setPropertyForNode(viewNode, attributeName, attributeValue, parentScopeData);
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
      var matches = behavior.regex ? (typeof(value) === 'string' ? value.match(behavior.regex) : value) : value;

      viewNode.properties.__behaviors__[key] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
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

  GalaxyView.prototype.setPropertyForNode = function (viewNode, attributeName, value, scopeData) {
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
        viewNode.properties.__behaviors__[property.name](viewNode, newValue);
        break;

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;

      case 'custom':
        property.handler(viewNode, attributeName, value, scopeData);
        break;
    }
  };

  GalaxyView.prototype.getPropertySetter = function (viewNode, attributeName) {
    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];

    if (!property) {
      return function (value) {
        setAttr.call(viewNode.node, attributeName, value);
      };
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
        var reactiveFunction = viewNode.properties.__behaviors__[property.name];

        if (!reactiveFunction) {
          console.error('Reactive handler not found for: ' + property.name);
        }

        return function (value) {
          reactiveFunction(viewNode, value);
        };

      case 'custom':
        return function (value, scopeData) {
          property.handler(viewNode, attributeName, value, scopeData);
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
   * @param {Galaxy.GalaxyView.ViewNode | Object} target
   * @param {Object} dataHostObject
   * @param {String} targetKeyName
   * @param dataValueKey
   */
  GalaxyView.prototype.makeBinding = function (target, data, targetKeyName, dataValueKey) {
    var _this = this;
    var dataObject = data;
    if (typeof dataObject !== 'object') {
      return;
    }

    var propertyName = dataValueKey;
    var childProperty = null;

    if (typeof dataValueKey === 'function') {
      propertyName = '[mutator]';
      dataObject[propertyName] = dataObject[propertyName] || [];
      dataObject[propertyName].push({
        for: targetKeyName,
        action: dataValueKey
      });
      return;
    } else {
      var items = dataValueKey.split('.');
      if (items.length > 1) {
        propertyName = items.shift();
        childProperty = items.join('.');
      }
    }

    if (!dataObject.hasOwnProperty(propertyName)) {
      var tempData = dataObject;

      while (tempData.__parent__) {
        if (tempData.__parent__.hasOwnProperty(propertyName)) {
          dataObject = tempData.__parent__;
          break;
        }

        tempData = dataObject.__parent__;
      }
    }

    var initValue = dataObject[propertyName];
    var enumerable = true;
    if (propertyName === 'length' && dataObject instanceof Array) {
      propertyName = '_length';
      enumerable = false;
    }

    var referenceName = '[' + propertyName + ']';
    var boundProperty = dataObject[referenceName];

    if (typeof boundProperty === 'undefined') {
      boundProperty = new GalaxyView.BoundProperty(propertyName, initValue);
      boundPropertyReference.value = boundProperty;
      defineProp(dataObject, referenceName, boundPropertyReference);

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
                  descriptors['[' + key + ']'].value.setValue(newValue[key], data);

                  defineProp(newValue, '[' + key + ']', descriptors['[' + key + ']']);
                  defineProp(newValue, key, descriptors[key]);
                }
              });
            }

            boundProperty.setValue(newValue, data);
          }
        };
      } else {
        setterAndGetter.set = function (value) {
          boundProperty.setValue(value, data);
        };
      }

      defineProp(dataObject, propertyName, setterAndGetter);
    }

    if (!(target instanceof Galaxy.GalaxyView.ViewNode) && !childProperty && !target.hasOwnProperty('[' + targetKeyName + ']')) {
      boundPropertyReference.value = boundProperty;
      defineProp(target, '[' + targetKeyName + ']', boundPropertyReference);

      setterAndGetter.enumerable = enumerable;
      setterAndGetter.get = function () {
        return boundProperty.value;
      };
      setterAndGetter.set = function (value) {
        boundProperty.setValue(value, data);
      };

      defineProp(target, targetKeyName, setterAndGetter);
    }

    if (!childProperty /*&& target instanceof Galaxy.GalaxyView.ViewNode*/) {
      boundProperty.addNode(target, targetKeyName);
    }

    if (childProperty) {
      _this.makeBinding(target, dataObject[propertyName] || {}, targetKeyName, childProperty);
    } else if (typeof dataObject === 'object') {
      boundProperty.initValueFor(target, targetKeyName, initValue, data);
    }
  };

  GalaxyView.createActiveArray = function (value, onUpdate) {
    var changes = {
      original: value,
      type: 'push',
      params: value
    };

    if (value.hasOwnProperty('[live]')) {
      return changes;
    }

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
    var arr = value;
    var i = 0;
    var args;

    boundPropertyReference.value = true;
    defineProp(value, '[live]', boundPropertyReference);

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

          onUpdate(changes);

          return result;
        },
        writable: false,
        configurable: true
      });
    });


    return changes;
  };

}(this, Galaxy || {}));
