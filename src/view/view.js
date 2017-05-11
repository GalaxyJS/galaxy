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

      if (!viewNode.hasOwnProperty('reactive')) {
        Object.defineProperty(viewNode, 'reactive', {
          enumerable: true,
          configurable: false,
          value: {}
        });
      }

      var parentScopeData = nodeScopeData;

      if (nodeSchema[ 'mutator' ]) {
        viewNode.mutator = nodeSchema[ 'mutator' ];
      }

      if (nodeSchema[ 'reactive' ]) {
        parentScopeData = _this.addReactiveBehaviors(viewNode, nodeSchema, nodeScopeData, nodeSchema[ 'reactive' ]);
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
          _this.makeBinding(viewNode, nodeScopeData, attributeName, bind[ 1 ]);
        } else {
          _this.setPropertyForNode(viewNode, attributeName, decodeURI(attributeValue));
        }
      }

      if (!viewNode.template) {
        if (viewNode.inDOM) {
          parentNode.appendChild(viewNode.node);
        }

        _this.append(nodeSchema.children, parentScopeData, viewNode.node);
      }

      return viewNode;
    }
  };

  GalaxyView.prototype.addReactiveBehaviors = function (viewNode, nodeSchema, nodeScopeData, behaviors) {
    var allScopeData = Object.assign({}, nodeScopeData);

    for (var key in behaviors) {
      var behavior = GalaxyView.REACTIVE_BEHAVIORS[ key ];

      if (behavior) {
        viewNode.scope[ key ] = allScopeData;
        var value = behaviors[ key ];
        var matches = behavior.regex ? value.match(behavior.regex) : value;

        viewNode.reactive[ key ] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
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
      if (viewNode.reactive[ reactiveBehaviorName ]) {
        viewNode.reactive[ reactiveBehaviorName ].call(this, viewNode, value);
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
        viewNode.node.setAttribute(attributeName, value);
        break;

      case 'prop':
        viewNode.node[ property.name ] = value;
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

    if (typeof dataHostObject !== 'object') {
      return;
    }

    var propertyName = propertyValue;
    var childProperty = null;

    if (typeof propertyValue === 'function') {
      propertyName = '[mutator]';
      dataHostObject[ propertyName ] = dataHostObject[ propertyName ] || [];
      dataHostObject[ propertyName ].push({
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
    if (!dataHostObject.hasOwnProperty(referenceName)) {
      boundProperty = new GalaxyView.BoundProperty();

      Object.defineProperty(dataHostObject, referenceName, {
        enumerable: false,
        configurable: false,
        value: boundProperty
      });
    }

    var initValue = dataHostObject[ propertyName ];

    var enumerable = true;

    if (propertyName === 'length' && dataHostObject instanceof Array) {
      propertyName = '_length';
      enumerable = false;
    }

    Object.defineProperty(dataHostObject, propertyName, {
      get: function () {
        return dataHostObject[ referenceName ].value;
      },
      set: function (newValue) {
        if (dataHostObject[ referenceName ].value !== newValue) {
          _this.setValueFor(dataHostObject, attributeName, propertyName, newValue);
        }

        dataHostObject[ referenceName ].value = newValue;
      },
      enumerable: enumerable,
      configurable: true
    });


    if (dataHostObject[ referenceName ]) {
      if (dataHostObject[ referenceName ].hosts.indexOf(viewNode) === -1 && !childProperty) {
        dataHostObject[ referenceName ].hosts.push(viewNode);
        viewNode.addHostNode(dataHostObject[ referenceName ].hosts);
        boundProperty.addNode(viewNode);
      }

      dataHostObject[ referenceName ].value = initValue;
    }

    if (childProperty) {
      _this.makeBinding(viewNode, dataHostObject[ propertyName ] || {}, attributeName, childProperty);
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
    var boundProperty = hostObject[ '[' + propertyName + ']' ];
    if (boundProperty) {
      boundProperty.setValue(attributeName, value);
    }
  };

  GalaxyView.prototype.setArrayValue = function (hostObject, attributeName, propertyName, value) {
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

    var boundProperty = hostObject[ '[' + propertyName + ']' ];

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

            boundProperty.setValue(attributeName, value);
          }, 0);

          return result;
        },
        writable: true,
        configurable: true
      });
    });

    boundProperty.setValue(attributeName, value);

  };
}(this, Galaxy || {}));
