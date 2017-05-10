/* global Galaxy */

(function () {
  /**
   *
   * @returns {Galaxy.GalaxyView}
   */
  Galaxy.GalaxyView = GalaxyView;

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
      var node = document.createElement(nodeSchema.t || 'div');
      var nodePlaceholder = document.createComment(node.tagName);
      node.__galaxyView__ = {
        node: node,
        nodeSchema: nodeSchema,
        _template: false,
        toTemplate: function () {
          this.placeholder.nodeValue = JSON.stringify(this.nodeSchema, null, 2);
          this._template = true;
        },
        placeholder: nodePlaceholder,
        _hosts: [],
        addHost: function (item) {
          this._hosts.push(item);
        },
        _inDOM: true,
        setInDOM: function (flag) {
          this._inDOM = flag;
          if (flag && !node.parentNode && !this._template) {
            node.__galaxyView__.placeholder.parentNode.insertBefore(node, node.__galaxyView__.placeholder.nextSibling);
          } else if (!flag && node.parentNode) {
            node.parentNode.removeChild(node);
          }
        },
        destroy: function () {
          if (this._inDOM) {
            node.parentNode.removeChild(this.placeholder);
            node.parentNode.removeChild(node);
          } else {
            this.placeholder.parentNode.removeChild(this.placeholder);
          }

          var nodeIndexInTheHost = -1;
          this._hosts.forEach(function (host) {
            nodeIndexInTheHost = host.indexOf(node);
            if (nodeIndexInTheHost !== -1) {
              host.splice(nodeIndexInTheHost, 1);
            }
          });

          this._hosts = [];
        }
      };

      parentNode.appendChild(node.__galaxyView__.placeholder);

      if (!node.__galaxyView__.hasOwnProperty('reactive')) {
        Object.defineProperty(node.__galaxyView__, 'reactive', {
          enumerable: true,
          configurable: false,
          value: {}
        });
      }

      var parentScopeData = nodeScopeData;

      if (nodeSchema[ 'reactive' ]) {
        parentScopeData = _this.addReactiveBehaviors(node, nodeSchema, nodeScopeData, nodeSchema[ 'reactive' ]);
      }

      for (var attributeName in nodeSchema) {
        if (attributeName === 'reactive') {
          continue;
        }

        var attributeValue = nodeSchema[ attributeName ];
        var bind = null;

        switch (typeof(attributeValue)) {
          case 'string':
            bind = attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/);
            break;
          case 'function':
            bind = [ 0, attributeValue ];
            break;
          default:
            bind = null;
        }

        if (bind) {
          _this.makeBinding(node, nodeScopeData, attributeName, bind[ 1 ]);
        } else {
          _this.setPropertyForNode(node, attributeName, decodeURI(attributeValue));
        }
      }

      if (!node.__galaxyView__._template && node.__galaxyView__._inDOM) {
        parentNode.appendChild(node);
      }
      _this.append(nodeSchema.children, parentScopeData, node);

      return node;
    }
  };

  GalaxyView.prototype.addReactiveBehaviors = function (node, nodeSchema, nodeScopeData, behaviors) {
    var allScopeData = Object.assign({}, nodeScopeData);

    for (var key in behaviors) {
      var behavior = GalaxyView.REACTIVE_BEHAVIORS[ key ];

      if (behavior) {
        var value = behaviors[ key ];
        var matches = behavior.regex ? value.match(behavior.regex) : value;

        node.__galaxyView__.reactive[ key ] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
          return function (_galaxyView, _value) {
            return BEHAVIOR.onApply.call(this, _galaxyView, _value, MATCHES, BEHAVIOR_SCOPE_DATA);
          };
        })(behavior, matches, allScopeData);

        behavior.bind.call(this, node.__galaxyView__, nodeScopeData, matches);
      }
    }

    return allScopeData;
  };

  GalaxyView.prototype.setPropertyForNode = function (node, attributeName, value) {
    if (attributeName.indexOf('reactive_') === 0) {
      var reactiveBehaviorName = attributeName.substring(9);
      if (node.__galaxyView__.reactive[ reactiveBehaviorName ]) {
        node.__galaxyView__.reactive[ reactiveBehaviorName ].call(this, node.__galaxyView__, value);
      }

      return;
    }

    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[ attributeName ];
    if (!property) {
      return;
    }

    value = property.parser ? property.parser(value) : value;

    switch (property.type) {
      case 'attr':
        node.setAttribute(attributeName, value);
        break;

      case 'prop':
        node[ property.name ] = value;
        break;
    }
  };

  GalaxyView.prototype.makeBinding = function (node, dataHostObject, attributeName, propertyPath) {
    var _this = this;

    if (typeof dataHostObject !== 'object') {
      return;
    }

    if (typeof propertyPath === 'function') {
      debugger;
    }

    var items = propertyPath.split('.');
    var propertyName = propertyPath;
    var childProperty = null;
    if (items.length > 1) {
      propertyName = items.shift();
      // dataHostObject[ propertyName ] = dataHostObject[ propertyName ] || {};
      childProperty = items.join('.');
    }

    var initValue = dataHostObject[ propertyName ];

    if (!dataHostObject.hasOwnProperty('_binds')) {
      Object.defineProperty(dataHostObject, '_binds', {
        enumerable: false,
        configurable: false,
        value: {}
      });
    }

    if (!dataHostObject._binds[ propertyName ]) {
      var enumerable = true;

      if (propertyName === 'length' && dataHostObject instanceof Array) {
        propertyName = '_length';
        enumerable = false;
      }


      dataHostObject._binds[ propertyName ] = {
        hosts: []
      };

      Object.defineProperty(dataHostObject, propertyName, {
        get: function () {
          return dataHostObject._binds[ propertyName ].value;
        },
        set: function (newValue) {
          if (dataHostObject._binds[ propertyName ].value !== newValue) {
            _this.setValueFor(dataHostObject, attributeName, propertyName, newValue);
          }

          dataHostObject._binds[ propertyName ].value = newValue;
        },
        enumerable: enumerable,
        configurable: true
      });

    }

    if (dataHostObject._binds[ propertyName ]) {
      if (dataHostObject._binds[ propertyName ].hosts.indexOf(node) === -1 && !childProperty) {
        dataHostObject._binds[ propertyName ].hosts.push(node);
        node.__galaxyView__.addHost(dataHostObject._binds[ propertyName ].hosts);
        node.__galaxyView__.binds = dataHostObject._binds[ propertyName ];
      }

      // if (typeof(initValue) !== 'undefined') {
      //   dataHostObject[ propertyName ] = initValue;
      // }
      dataHostObject._binds[ propertyName ].value = initValue;
    }

    if (childProperty) {
      _this.makeBinding(node, dataHostObject[ propertyName ] || {}, attributeName, childProperty);
    } else if (typeof dataHostObject === 'object') {
      _this.setValueFor(dataHostObject, attributeName, propertyName, initValue);
    }
  };

  GalaxyView.prototype.setValueFor = function (hostObject, attributeName, propertyName, value) {
    if (value instanceof Array) {
      this.setArrayValue(hostObject, attributeName, propertyName, value);
    } else {
      this.setSingleValue(hostObject, attributeName, propertyName, value);
    }
  };

  GalaxyView.prototype.setSingleValue = function (hostObject, attributeName, propertyName, value) {
    var _this = this;

    if (hostObject._binds[ propertyName ]) {
      hostObject._binds[ propertyName ].hosts.forEach(function (node) {
        _this.setPropertyForNode(node, attributeName, value);
      });
    }
  };

  GalaxyView.prototype.setArrayValue = function (hostObject, attributeName, propertyName, value) {
    var _this = this;
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

    var propertyBind = hostObject._binds[ propertyName ];

    methods.forEach(function (method) {
      var original = arrayProto[ method ];
      Object.defineProperty(value, method, {
        value: function () {
          var arr = this;
          var i = arguments.length;
          var args = new Array(i);
          while (i--) {
            args[ i ] = arguments[ i ];
          }
          var result = original.apply(this, args);


          clearTimeout(throttle);
          throttle = setTimeout(function () {
            if (arr.hasOwnProperty('_length')) {
              arr._length = arr.length;
            }

            propertyBind.hosts.forEach(function (node) {
              _this.setPropertyForNode(node, attributeName, value);
            });
          }, 0);

          return result;
        },
        writable: true,
        configurable: true
      });
    });

    hostObject._binds[ propertyName ].hosts.forEach(function (node) {
      _this.setPropertyForNode(node, attributeName, value);
    });
  };
}());
