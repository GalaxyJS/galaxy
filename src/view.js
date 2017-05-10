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
  function GalaxyView (scope) {
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
      node._galaxy_view = {
        _nodeSchema: nodeSchema,
        _template: false,
        toTemplate: function () {
          this.placeholder.nodeValue = JSON.stringify(this._nodeSchema, null, 2);
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
            node._galaxy_view.placeholder.parentNode.insertBefore(node, node._galaxy_view.placeholder.nextSibling);
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

      parentNode.appendChild(node._galaxy_view.placeholder);

      if (!node._galaxy_view.hasOwnProperty('reactive')) {
        Object.defineProperty(node._galaxy_view, 'reactive', {
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
        var bind = typeof(attributeValue) === 'string' ? attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/) : null;

        if (bind) {
          _this.makeBinding(node, nodeScopeData, attributeName, bind[ 1 ]);
        } else {
          _this.setPropertyForNode(node, attributeName, decodeURI(attributeValue));
        }
      }

      if (!node._galaxy_view._template && node._galaxy_view._inDOM) {
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

        node._galaxy_view.reactive[ key ] = (function (BEHAVIOR, MATCHES, NODE_SCHEMA, BEHAVIOR_SCOPE_DATA) {
          return function (_node, _value) {
            return BEHAVIOR.onApply.call(this, _node, NODE_SCHEMA, _value, MATCHES, BEHAVIOR_SCOPE_DATA);
          };
        })(behavior, matches, nodeSchema, allScopeData);

        behavior.bind.call(this, node, nodeSchema, nodeScopeData, matches);
      }
    }

    return allScopeData;
  };

  GalaxyView.prototype.setPropertyForNode = function (node, attributeName, value) {
    if (attributeName.indexOf('reactive_') === 0) {
      var reactiveBehaviorName = attributeName.substring(9);
      if (node._galaxy_view.reactive[ reactiveBehaviorName ]) {
        node._galaxy_view.reactive[ reactiveBehaviorName ].call(this, node, value);
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
      dataHostObject._binds[ propertyName ] = {
        hosts: []
      };

      // if(dataHostObject.isDefined())
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
        enumerable: true,
        configurable: true
      });
    }

    if (dataHostObject._binds[ propertyName ]) {
      if (dataHostObject._binds[ propertyName ].hosts.indexOf(node) === -1 && !childProperty) {
        dataHostObject._binds[ propertyName ].hosts.push(node);
        node._galaxy_view.addHost(dataHostObject._binds[ propertyName ].hosts);
        node._galaxy_view.binds = dataHostObject._binds[ propertyName ];
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
          var i = arguments.length;
          var args = new Array(i);
          while (i--) {
            args[ i ] = arguments[ i ];
          }
          var result = original.apply(this, args);

          clearTimeout(throttle);
          throttle = setTimeout(function () {
            console.log(propertyName)
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
