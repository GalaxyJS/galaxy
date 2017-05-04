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

  GalaxyView.SCHEME_PROPERTY_MAP = {
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
      name: 'innerTEXT'
    },
    value: {
      type: 'prop',
      name: 'value'
    }
  };

  GalaxyView.prototype.init = function (schema) {
    this.append(schema, this.element);
  };

  GalaxyView.prototype.append = function (nodeSchema, parent) {
    var _this = this;

    if (nodeSchema instanceof Array) {
      nodeSchema.forEach(function (nodeSchema) {
        _this.append(nodeSchema, parent);
      });
    } else if (typeof(nodeSchema) === 'object' && nodeSchema !== null) {
      var node = document.createElement(nodeSchema.t || 'div');

      var attributeName = null;

      for (var key in nodeSchema) {
        attributeName = key;

        if (attributeName.indexOf('bind_') === 0) {
          attributeName = attributeName.substring(5);

          _this.makeBinding(node, _this.scope, attributeName, nodeSchema[ key ]);
        } else {
          _this.setPropertyForNode(node, attributeName, nodeSchema[ key ]);
        }
      }

      parent.appendChild(node);

      _this.append(nodeSchema.children, node);
    }
  };

  GalaxyView.prototype.setPropertyForNode = function (node, attributeName, value) {
    var property = GalaxyView.SCHEME_PROPERTY_MAP[ attributeName ];
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

  GalaxyView.prototype.makeBinding = function (node, hostObject, attributeName, propertyPath) {
    var _this = this;

    var items = propertyPath.split('.');
    var propertyName = propertyPath;
    var childProperty = null;
    if (items.length > 1) {
      propertyName = items.shift();
      hostObject[ propertyName ] = hostObject[ propertyName ] || {};
      childProperty = items.join('.');
    }

    var initValue = hostObject[ propertyName ];

    if (!hostObject.hasOwnProperty('_binds')) {
      Object.defineProperty(hostObject, '_binds', {
        enumerable: false,
        configurable: false,
        value: {
          hosts: []
        }
      });
    }

    if (!hostObject._binds[ propertyName ]) {
      Object.defineProperty(hostObject, propertyName, {
        get: function () {
          return hostObject._binds[ propertyName ].value;
        },
        set: function (newValue) {
          hostObject._binds[ propertyName ].value = newValue;

          // if(typeof(newValue) === 'object' && newValue !== null) {
          //   return;
          // }

          _this.setValueFor(hostObject, attributeName, propertyName, newValue);
        },
        enumerable: true,
        configurable: true
      });

      hostObject._binds[ propertyName ] = {
        hosts: [],
        value: initValue
      };
    }

    if (hostObject._binds[ propertyName ].hosts.indexOf(node) === -1 && !childProperty) {
      hostObject._binds[ propertyName ].hosts.push(node);
    }

    if (typeof(initValue) !== 'undefined') {
      hostObject[ propertyName ] = initValue;
    }

    if (childProperty) {
      _this.makeBinding(node, hostObject[ propertyName ], attributeName, childProperty);
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

    methods.forEach(function (method) {
      var original = arrayProto[ method ];
      Object.defineProperty(value, method, {
        value: function () {
          original.apply(this, arguments);
          hostObject._binds[ propertyName ].hosts.forEach(function (node) {
            _this.setPropertyForNode(node, attributeName, value);
          });
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
