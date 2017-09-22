/* global Galaxy, Promise */

(function (root, G) {
  let defineProp = Object.defineProperty;
  let setterAndGetter = {
    configurable: true,
    enumerable: false,
    set: null,
    get: null
  };
  let boundPropertyReference = {
    configurable: false,
    enumerable: false,
    value: null
  };
  let setAttr = Element.prototype.setAttribute;
  let removeAttr = Element.prototype.removeAttribute;
  let nextTick = (function () {
    let callbacks = [];
    let pending = false;
    let timerFunc;

    function nextTickHandler() {
      pending = false;
      let copies = callbacks.slice(0);
      callbacks.length = 0;
      for (let i = 0; i < copies.length; i++) {
        copies[i]();
      }
    }

    let p = Promise.resolve();
    let logError = function (err) {
      console.error(err);
    };
    timerFunc = function () {
      p.then(nextTickHandler).catch(logError);
    };

    return function queueNextTick(cb, ctx) {
      let _resolve;
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

  GalaxyView.defineProp = G.defineProp;

  GalaxyView.setAttr = function (viewNode, name, value, oldValue) {
    viewNode.notifyObserver(name, value, oldValue);
    if (value) {
      setAttr.call(viewNode.node, name, value, oldValue);
    } else {
      removeAttr.call(viewNode.node, name);
    }
  };

  GalaxyView.cleanProperty = function (obj, key) {
    delete obj[key];
  };

  GalaxyView.createMirror = function (obj) {
    let result = {};

    defineProp(result, '__parent__', {
      enumerable: false,
      value: obj
    });

    return result;
  };

  GalaxyView.createClone = function (source) {
    let cloned = Object.assign({}, source);

    GalaxyView.link(source, cloned);

    return cloned;
  };

  GalaxyView.link = function (from, to) {
    for (let key in from) {
      if (from.hasOwnProperty('[' + key + ']')) {
        boundPropertyReference.value = from['[' + key + ']'];
        defineProp(to, '[' + key + ']', boundPropertyReference);
        defineProp(to, key, Object.getOwnPropertyDescriptor(from, key));
      }
    }
  };

  GalaxyView.getPropertyContainer = function (data, propertyName) {
    let container = data;
    let tempData = data.hasOwnProperty(propertyName);

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
    let item, viewNodes = [];

    for (let i = 0, len = node.childNodes.length; i < len; i++) {
      item = node.childNodes[i];

      if (item.hasOwnProperty('__viewNode__')) {
        viewNodes.push(item.__viewNode__);
      }

      viewNodes = viewNodes.concat(GalaxyView.getAllViewNodes(item));
    }

    return viewNodes.filter(function (value, index, self) {
      return self.indexOf(value) === index;
    });
  };

  GalaxyView.getBoundProperties = function (host) {
    let all = Object.getOwnPropertyNames(host);
    let visible = Object.keys(host);
    let properties = [];

    all.forEach(function (key) {
      if (host[key] instanceof GalaxyView.BoundProperty && visible.indexOf(key) === -1) {
        properties.push(host[key]);
      }
    });

    return properties;
  };

  GalaxyView.getBindings = function (value) {
    let variableNamePaths = null;
    let isExpression = false;
    let type = typeof(value);

    if (type === 'string') {
      variableNamePaths = value.match(/^\[\s*([^\[\]]*)\s*\]$/);
      variableNamePaths = variableNamePaths ? variableNamePaths[1] : null;
    }
    else if (value instanceof Array && typeof value[value.length - 1] === 'function') {
      variableNamePaths = value;
      isExpression = true;
    } else {
      variableNamePaths = null;
    }

    return {
      variableNamePaths: variableNamePaths,
      isExpression: isExpression
    };
  };

  GalaxyView.propertyLookup = function (data, property) {
    property = property.split('.')[0];
    let target = data;
    let temp = data;
    // var nestingLevel = 0;
    if (!data.hasOwnProperty(property)) {
      while (temp.__parent__) {
        if (temp.__parent__.hasOwnProperty(property)) {
          target = temp.__parent__;
          break;
        }

        // if (nestingLevel++ >= 1000) {
        //   throw console.error('Maximum nested property lookup has reached `' + property + '`', data);
        // }

        temp = temp.__parent__;
      }
    }

    return target;
  };

  GalaxyView.createBoundProperty = function (dataObject, propertyName, referenceName, enumerable, childProperty, initValue) {
    let boundProperty = new GalaxyView.BoundProperty(dataObject, propertyName, initValue);
    boundPropertyReference.value = boundProperty;
    defineProp(dataObject, referenceName, boundPropertyReference);

    setterAndGetter.enumerable = enumerable;
    setterAndGetter.get = (function (bp) {
      return function () {
        return bp.value;
      };
    })(boundProperty);

    if (childProperty) {
      setterAndGetter.set = function (newValue) {
        if (boundProperty.value !== newValue) {
          if (newValue && typeof boundProperty.value === 'object') {
            let all = Object.getOwnPropertyNames(boundProperty.value);
            let visible = Object.keys(boundProperty.value);
            let newVisible = Object.keys(newValue);
            let descriptors = {};
            let hidden = all.filter(function (key) {
              descriptors[key] = Object.getOwnPropertyDescriptor(boundProperty.value || {}, key);
              return visible.indexOf(key) === -1;
            });

            newVisible.forEach(function (key) {
              if (hidden.indexOf('[' + key + ']') !== -1) {
                descriptors['[' + key + ']'].value.setValue(newValue[key], dataObject);

                defineProp(newValue, '[' + key + ']', descriptors['[' + key + ']']);
                defineProp(newValue, key, descriptors[key]);
              }
            });
          }

          boundProperty.setValue(newValue, dataObject);
        }
      };
    } else {
      setterAndGetter.set = function (value) {
        boundProperty.setValue(value, dataObject);
      };
    }

    defineProp(dataObject, propertyName, setterAndGetter);

    return boundProperty;
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode | Object} target
   * @param {Object} dataHostObject
   * @param {String} targetKeyName
   * @param {string|Array<string>} variableNamePaths
   */
  GalaxyView.makeBinding = function (target, data, targetKeyName, variableNamePaths, expression, expressionArgumentsCount) {
    let dataObject = data;
    if (typeof dataObject !== 'object') {
      return;
    }

    let variables = variableNamePaths instanceof Array ? variableNamePaths : [variableNamePaths];
    // expression === true means that a expression function is available and should be extracted
    if (expression === true) {
      let handler = variables[variables.length - 1];
      variables = variables.slice(0, variables.length - 1);
      expressionArgumentsCount = variables.length;
      let functionContent = 'return [';
      functionContent += variables.map(function (path) {
        return 'prop(scope, "' + path + '").' + path;
      }).join(', ');
      functionContent += ']';

      // Generate expression arguments
      try {
        let getExpressionArguments = new Function('prop, scope', functionContent);
        expression = (function (scope) {
          return function () {
            let args = getExpressionArguments.call(target, Galaxy.GalaxyView.propertyLookup, scope);
            return handler.apply(target, args);
          };
        })(dataObject);
      }
      catch (expection) {
        throw console.error(expection.message + '\n', variables);
      }
    } else if (!expression) {
      expressionArgumentsCount = 1;
    }

    let variableNamePath;
    let propertyName = null;
    let childProperty = null;
    let initValue = null;

    for (let i = 0, len = variables.length; i < len; i++) {
      variableNamePath = variables[i];
      propertyName = variableNamePath;

      let variableName = variableNamePath.split('.');
      if (variableName.length > 1) {
        propertyName = variableName.shift();
        childProperty = variableName.join('.');
      }

      dataObject = GalaxyView.propertyLookup(dataObject, propertyName);

      initValue = dataObject[propertyName];

      let enumerable = true;
      if (propertyName === 'length' && dataObject instanceof Array) {
        propertyName = '_length';
        enumerable = false;
      }

      let referenceName = '[' + propertyName + ']';
      let boundProperty = dataObject[referenceName];

      if (typeof boundProperty === 'undefined') {
        boundProperty = GalaxyView.createBoundProperty(dataObject, propertyName, referenceName, enumerable, childProperty, initValue);
      }

      // When target is not a ViewNode, then add target['[targetKeyName]']
      if (!(target instanceof Galaxy.GalaxyView.ViewNode) && !childProperty && !target.hasOwnProperty('[' + targetKeyName + ']')) {
        boundPropertyReference.value = boundProperty;
        defineProp(target, '[' + targetKeyName + ']', boundPropertyReference);

        setterAndGetter.enumerable = enumerable;
        setterAndGetter.get = (function (BOUND_PROPERTY, EXPRESSION) {
          // If there is an expression for the property, then apply it on get because target is not ViewNode
          // and can not have any setter for its properties
          if (EXPRESSION) {
            return function () {
              return EXPRESSION();
            };
          }

          return function () {
            return BOUND_PROPERTY.value;
          };
        })(boundProperty, expression);

        setterAndGetter.set = (function (BOUND_PROPERTY, DATA) {
          return function (value) {
            BOUND_PROPERTY.setValue(value, DATA);
          };
        })(boundProperty, dataObject);

        defineProp(target, targetKeyName, setterAndGetter);
      }

      if (!childProperty) {
        boundProperty.addNode(target, targetKeyName, expression);
      }

      if (childProperty) {
        GalaxyView.makeBinding(target, dataObject[propertyName] || {}, targetKeyName, childProperty, expression, expressionArgumentsCount);
      }
      // Call init value only on the last variable binding,
      // so the expression with multiple arguments get called only once
      else if (typeof dataObject === 'object' && expressionArgumentsCount === 1) {
        boundProperty.initValueFor(target, targetKeyName, initValue, dataObject);
      }
      expressionArgumentsCount--;
    }
  };

  GalaxyView.bindSubjectsToData = function (subjects, data, cloneSubject) {
    let keys = Object.keys(subjects);
    let attributeName;
    let attributeValue;
    let subjectsClone = cloneSubject ? GalaxyView.createClone(subjects) : subjects;

    for (let i = 0, len = keys.length; i < len; i++) {
      attributeName = keys[i];
      attributeValue = subjects[attributeName];

      let bindings = GalaxyView.getBindings(attributeValue);

      if (bindings.variableNamePaths) {
        GalaxyView.makeBinding(subjectsClone, data, attributeName, bindings.variableNamePaths, bindings.isExpression);
      }

      if (attributeValue && typeof attributeValue === 'object' && !(attributeValue instanceof Array)) {
        GalaxyView.bindSubjectsToData(attributeValue, data);
      }
    }

    return subjectsClone;
  };

  GalaxyView.createPropertySetter = function (node, property) {
    return function (value, oldValue) {
      if (value instanceof Promise) {
        let asyncCall = function (asyncValue) {
          let newValue = property.parser ? property.parser(asyncValue) : asyncValue;
          node.node[property.name] = newValue;
          node.notifyObserver(property.name, newValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        let newValue = property.parser ? property.parser(value) : value;
        node.node[property.name] = newValue;
        node.notifyObserver(property.name, newValue, oldValue);
      }
    };
  };

  GalaxyView.createCustomSetter = function (node, attributeName, property) {
    return function (value, oldValue, scopeData) {
      if (value instanceof Promise) {
        let asyncCall = function (asyncValue) {
          property.handler(node, attributeName, asyncValue, oldValue, scopeData);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        property.handler(node, attributeName, value, oldValue, scopeData);
      }
    };
  };

  GalaxyView.createDefaultSetter = function (node, attributeName, parser) {
    return function (value, oldValue) {
      if (value instanceof Promise) {
        let asyncCall = function (asyncValue) {
          let newValue = parser ? parser(asyncValue) : asyncValue;
          GalaxyView.setAttr(node, attributeName, newValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        let newValue = parser ? parser(value) : value;
        GalaxyView.setAttr(node, attributeName, newValue, oldValue);
      }
    };
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
        let textNode = viewNode.node['[text]'];
        let textValue = typeof value === 'undefined' ? '' : value;
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
    let rootElement;

    if (scope.element instanceof GalaxyView.ViewNode) {
      rootElement = scope.element;
    } else {
      scope.element.innerHTML = '';
      rootElement = new GalaxyView.ViewNode(this, {
        tag: scope.element.tagName
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
   * @param {GalaxyView.ViewNode} parentViewNode
   */
  GalaxyView.prototype.append = function (nodeSchema, parentScopeData, parentViewNode, position, domManipulationSequence) {
    let _this = this;
    let i = 0, len = 0;

    if (nodeSchema instanceof Array) {
      for (i = 0, len = nodeSchema.length; i < len; i++) {
        _this.append(nodeSchema[i], parentScopeData, parentViewNode, null, domManipulationSequence);
      }
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      let viewNode = new GalaxyView.ViewNode(_this, nodeSchema, null, domManipulationSequence);
      parentViewNode.registerChild(viewNode, position);

      domManipulationSequence = domManipulationSequence || viewNode.domManipulationSequence;

      if (nodeSchema['mutator']) {
        viewNode.mutator = nodeSchema['mutator'];
      }

      let keys = Object.keys(nodeSchema);
      let attributeValue, attributeName;
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = nodeSchema[attributeName];

        if (GalaxyView.REACTIVE_BEHAVIORS[attributeName]) {
          _this.addReactiveBehavior(viewNode, nodeSchema, parentScopeData, attributeName);
        }

        let bindings = GalaxyView.getBindings(attributeValue);

        if (bindings.variableNamePaths) {
          GalaxyView.makeBinding(viewNode, parentScopeData, attributeName, bindings.variableNamePaths, bindings.isExpression);
        } else {
          _this.setPropertyForNode(viewNode, attributeName, attributeValue, parentScopeData);
        }
      }

      if (!viewNode.virtual) {
        if (viewNode.inDOM) {
          viewNode.setInDOM(true);
        }

        _this.append(nodeSchema.children,
          parentScopeData,
          viewNode, null, domManipulationSequence);
      }

      // viewNode.onReady promise will be resolved after all the dom manipulations are done
      // this make sure that the viewNode and its children elements are rendered
      viewNode.domManipulationSequence.next(function (done) {
        viewNode.ready();
        done();
      });

      return viewNode;
    }
  };

  GalaxyView.prototype.addReactiveBehavior = function (viewNode, nodeSchema, nodeScopeData, key) {
    let behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
    let bindTo = nodeSchema[key];

    if (behavior) {
      let matches = behavior.regex ? (typeof(bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;

      viewNode.properties.behaviors[key] = (function (BEHAVIOR, MATCHES, BEHAVIOR_SCOPE_DATA) {
        let CACHE = {};
        if (BEHAVIOR.getCache) {
          CACHE = BEHAVIOR.getCache(viewNode, MATCHES, BEHAVIOR_SCOPE_DATA);
        }

        return function (vn, value, oldValue) {
          return BEHAVIOR.onApply(CACHE, vn, value, oldValue, MATCHES, BEHAVIOR_SCOPE_DATA);
        };
      })(behavior, matches, nodeScopeData);

      behavior.bind(viewNode, nodeScopeData, matches);
    }
  };

  GalaxyView.prototype.setPropertyForNode = function (viewNode, attributeName, value, scopeData) {
    let property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName] || {type: 'attr'};
    let newValue = value;

    switch (property.type) {
      case 'attr':
        GalaxyView.createDefaultSetter(viewNode, attributeName, property.parser)(newValue, null);
        break;

      case 'prop':
        GalaxyView.createPropertySetter(viewNode, property)(newValue, null);
        break;

      case 'reactive':
        viewNode.properties.behaviors[property.name](viewNode, newValue, null);
        break;

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;

      case 'custom':
        GalaxyView.createCustomSetter(viewNode, attributeName, property)(value, null, scopeData);
        break;
    }
  };

  GalaxyView.prototype.getPropertySetter = function (viewNode, attributeName, expression) {
    let property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];

    if (!property) {
      return function (value) {
        setAttr.call(viewNode.node, attributeName, value);
      };
    }

    let parser = property.parser;
    let setter;

    switch (property.type) {
      case 'prop':
        setter = GalaxyView.createPropertySetter(viewNode, property);

        if (expression) {
          return function (none, oldValue) {
            let expressionValue = expression(none);
            setter(expressionValue, oldValue);
          };
        }

        return setter;

      case 'reactive':
        var reactiveFunction = viewNode.properties.behaviors[property.name];

        if (!reactiveFunction) {
          console.error('Reactive handler not found for: ' + property.name);
        }

        return function (value, oldValue) {
          reactiveFunction(viewNode, value, oldValue);
        };

      case 'custom':
        setter = GalaxyView.createCustomSetter(viewNode, attributeName, property);

        if (expression) {
          return function (none, oldValue, scopeData) {
            let expressionValue = expression(none);
            setter(expressionValue, oldValue, scopeData);
          };
        }

        return setter;

      default:
        setter = GalaxyView.createDefaultSetter(viewNode, attributeName, parser);
        if (expression) {
          return function (none, oldValue) {
            let expressionValue = expression(none);
            setter(expressionValue, oldValue);
          };
        }

        return setter;
    }
  };

  GalaxyView.createActiveArray = function (value, onUpdate) {
    let changes = {
      original: value,
      type: 'push',
      params: value
    };

    let oldChanges = Object.assign({}, changes);

    if (value.hasOwnProperty('[live]')) {
      return changes;
    }

    let arrayProto = Array.prototype;
    let methods = [
      'push',
      'pop',
      'shift',
      'unshift',
      'splice',
      'sort',
      'reverse'
    ];
    let arr = value;
    let i = 0;
    let args;

    boundPropertyReference.value = true;
    defineProp(value, '[live]', boundPropertyReference);

    methods.forEach(function (method) {
      let original = arrayProto[method];
      Object.defineProperty(value, method, {
        value: function () {
          i = arguments.length;
          args = new Array(i);
          while (i--) {
            args[i] = arguments[i];
          }

          let result = original.apply(this, args);

          if (typeof arr._length !== 'undefined') {
            arr._length = arr.length;
          }

          changes.type = method;
          changes.params = args;

          onUpdate(changes, oldChanges);
          oldChanges = Object.assign({}, changes);

          return result;
        },
        writable: false,
        configurable: true
      });
    });


    return changes;
  };

}(this, Galaxy || {}));
