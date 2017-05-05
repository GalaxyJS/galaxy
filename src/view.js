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
      type: 'attr'
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
   * @param {Object} nodeDataScope
   * @param {Element} parentNode
   */
  GalaxyView.prototype.append = function (nodeSchema, nodeDataScope, parentNode) {
    var _this = this;

    if (nodeSchema instanceof Array) {
      nodeSchema.forEach(function (nodeSchema) {
        _this.append(nodeSchema, nodeDataScope, parentNode);
      });
    } else if (typeof(nodeSchema) === 'object' && nodeSchema !== null) {
      var node = document.createElement(nodeSchema.t || 'div');
      var nodePlaceholder = document.createComment(node.tagName);
      node._galaxy_view = {
        asTemplate: false,
        placeholder: nodePlaceholder,
        hosts: [],
        destroy: function () {
          node.parentNode.removeChild(this.placeholder);
          node.parentNode.removeChild(node);

          this.hosts.forEach(function (host) {
            if (host.indexOf(node) !== -1) {
              host.splice(host.indexOf(node), 1);
            }
          });

          this.hosts = [];
        }
      };
      parentNode.appendChild(node._galaxy_view.placeholder);

      for (var attributeName in nodeSchema) {
        var attributeValue = nodeSchema[ attributeName ];
        var bind = typeof(attributeValue) === 'string' ? attributeValue.match(/^\[\s*([^\[\]]*)\s*\]$/) : null;
        if (!node._galaxy_view.hasOwnProperty('reactive')) {
          Object.defineProperty(node._galaxy_view, 'reactive', {
            enumerable: true,
            configurable: false,
            value: {}
          });
        }

        if (attributeName === 'reactive') {
          _this.addReactiveBehaviors(node, nodeSchema, nodeDataScope, attributeValue);
          continue;
        }

        if (bind) {
          _this.makeBinding(node, nodeDataScope, attributeName, bind[ 1 ]);
        } else {
          _this.setPropertyForNode(node, attributeName, decodeURI(attributeValue));
        }
      }

      if (!node._galaxy_view.asTemplate) {
        parentNode.appendChild(node);
      }
      _this.append(nodeSchema.children, nodeDataScope, node);

      return node;
    }
  };

  GalaxyView.prototype.addReactiveBehaviors = function (node, nodeSchema, nodeDataScope, behaviors) {
    for (var key in behaviors) {
      var behavior = GalaxyView.REACTIVE_BEHAVIORS[ key ];

      if (behavior) {
        var value = behaviors[ key ];
        var matches = behavior.regex ? value.match(behavior.regex) : value;
        node._galaxy_view.reactive[ key ] = function (inNode, value, a) {
          return behavior.onApply.call(this, inNode, nodeSchema, value, matches);
        };
        behavior.bind.call(this, node, nodeSchema, nodeDataScope, matches);
      }
    }

    return node;
  };

  GalaxyView.prototype.setPropertyForNode = function (node, attributeName, value) {
    if (attributeName.indexOf('reactive_') === 0) {
      var reactiveBehaviorName = attributeName.substring(9);
      if (node._galaxy_view.reactive[ reactiveBehaviorName ]) {
        node._galaxy_view.reactive[ reactiveBehaviorName ].call(this, node, value, reactiveBehaviorName);
      }

      return;
    }

    var property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[ attributeName ];
    if (!property) {
      return;
    }

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

    var items = propertyPath.split('.');
    var propertyName = propertyPath;
    var childProperty = null;
    if (items.length > 1) {
      propertyName = items.shift();
      dataHostObject[ propertyName ] = dataHostObject[ propertyName ] || {};
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

      dataHostObject._binds[ propertyName ] = {
        hosts: []
      };
    }

    if (dataHostObject._binds[ propertyName ].hosts.indexOf(node) === -1 && !childProperty) {
      dataHostObject._binds[ propertyName ].hosts.push(node);
      node._galaxy_view.hosts.push(dataHostObject._binds[ propertyName ].hosts);
      node._galaxy_view.binds = dataHostObject._binds[ propertyName ];
    }

    if (typeof(initValue) !== 'undefined') {
      dataHostObject[ propertyName ] = initValue;
    }

    if (childProperty) {
      _this.makeBinding(node, dataHostObject[ propertyName ], attributeName, childProperty);
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

    hostObject._binds[ propertyName ].hosts.forEach(function (node) {
      _this.setPropertyForNode(node, attributeName, value);
    });
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

    methods.forEach(function (method) {
      var original = arrayProto[ method ];
      Object.defineProperty(value, method, {
        value: function () {
          original.apply(this, arguments);

          clearTimeout(throttle);
          throttle = setTimeout(function () {
            hostObject._binds[ propertyName ].hosts.forEach(function (node) {
              _this.setPropertyForNode(node, attributeName, value);
            });
          }, 1);
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
