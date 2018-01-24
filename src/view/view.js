/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxyView = /** @class */(function (G) {
  const defineProp = Object.defineProperty;
  const setAttr = Element.prototype.setAttribute;
  const removeAttr = Element.prototype.removeAttribute;
  // const worker = new Worker('galaxyjs/galaxy-web-worker.js');

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

  GalaxyView.BINDING_SYNTAX_REGEX = new RegExp('^<>\\s*([^\\[\\]]*)\\s*$');
  GalaxyView.BINDING_EXPRESSION_REGEX = new RegExp('(?:["\'][\w\s]*[\'"])|([^\d\s=+\-|&%{}()<>!/]+)', 'g');

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
      type: 'prop',
      name: 'style'
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
        const textNode = viewNode.node['[text]'];
        const textValue = typeof value === 'undefined' ? '' : value;
        if (textNode) {
          textNode.textContent = textValue;
        } else {
          viewNode.node['[text]'] = document.createTextNode(textValue);
          viewNode.node.insertBefore(viewNode.node['[text]'], viewNode.node.firstChild);
        }
      }
    },
    checked: {
      type: 'prop',
      name: 'checked'
    },
    value: {
      type: 'prop',
      name: 'value'
    },
    disabled: {
      type: 'attr'
    }
  };

  GalaxyView.defineProp = defineProp;

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

  GalaxyView.createMirror = function (obj, newProp) {
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
      if (from.hasOwnProperty('<>' + key)) {
        boundPropertyReference.value = from['<>' + key];
        defineProp(to, '<>' + key, boundPropertyReference);
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

    const childNodes = Array.prototype.slice(node.childNodes, 0);
    for (let i = 0, len = childNodes.length; i < len; i++) {
      item = node.childNodes[i];

      if (item['__viewNode__'] !== undefined) {
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
      variableNamePaths = value.match(GalaxyView.BINDING_SYNTAX_REGEX);
      variableNamePaths = variableNamePaths ? variableNamePaths[1] : null;

      if (/^\s*{\s*(.*)\s*}\s*/g.test(value)) {
        variableNamePaths = [];

        let match = null;
        const args = [];
        let functionBody = value.match(/\s*{\s*(.*)\s*}\s*/)[1];
        value = value.replace(/["'](.*["'])/g, '');
        while ((match = GalaxyView.BINDING_EXPRESSION_REGEX.exec(value)) !== null) {
          variableNamePaths.push(match[1]);
          args.push(match[1].replace(/\./g, '_'));
        }

        functionBody = functionBody.replace(variableNamePaths, args);

        isExpression = true;
        variableNamePaths.push(new Function(args.join(','), 'return ' + functionBody + ';'));
      }
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
    let original = data;
    let target = data;
    let temp = data;
    // var nestingLevel = 0;
    if (data[property] === undefined) {
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

      // if the property is not found in the parents then return the original object as the context
      if (target[property] === undefined) {
        return original;
      }
    }

    return target;
  };

  GalaxyView.exactPropertyLookup = function (data, property) {
    const properties = property.split('.');
    let target = data;
    properties.forEach(function (p) {
      target = GalaxyView.propertyLookup(target, p)[p];
    });

    return target;
  };

  /**
   *
   * @param dataObject
   * @param {string} propertyName
   * @param {string} referenceName
   * @param {boolean} enumerable
   * @param childProperty
   * @param initValue
   * @param {boolean} useLocalScope
   * @returns {Galaxy.GalaxyView.BoundProperty}
   */
  GalaxyView.createBoundProperty = function (dataObject, propertyName, aliasName, referenceName, enumerable, childProperty, initValue) {
    let boundProperty = new GalaxyView.BoundProperty(dataObject, aliasName || propertyName, initValue);
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
              if (hidden.indexOf('<>' + key) !== -1) {
                descriptors['<>' + key].value.setValue(newValue[key], dataObject);

                defineProp(newValue, '<>' + key, descriptors['<>' + key]);
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

  GalaxyView.EXPRESSION_ARGS_FUNC_CACHE = {};

  GalaxyView.createExpressionArgumentsProvider = function (variables) {
    const id = variables.join();

    if (GalaxyView.EXPRESSION_ARGS_FUNC_CACHE[id]) {
      return GalaxyView.EXPRESSION_ARGS_FUNC_CACHE[id];
    }

    let functionContent = 'return [';

    let middle = '';
    for (let i = 0, len = variables.length; i < len; i++) {
      middle += 'prop(scope, "' + variables[i] + '").' + variables[i] + ',';
    }

    // Take care of variables that contain square brackets like '[variable_name]'
    // for the convenience of the programmer

    // middle = middle.substring(0, middle.length - 1).replace(/<>/g, '');
    functionContent += middle.substring(0, middle.length - 1) + ']';

    const func = new Function('prop, scope', functionContent);
    GalaxyView.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  GalaxyView.createExpressionFunction = function (host, handler, variables, scope, on) {
    let getExpressionArguments = Galaxy.GalaxyView.createExpressionArgumentsProvider(variables);

    return function () {
      let args = getExpressionArguments.call(host, Galaxy.GalaxyView.propertyLookup, scope);
      return handler.apply(host, args);
    };
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode | Object} target
   * @param {Object} dataHostObject
   * @param {String} targetKeyName
   * @param {string|Array<string>} variableNamePaths
   */
  GalaxyView.makeBinding = function (target, scopeData, targetKeyName, variableNamePaths, expression, expressionArgumentsCount) {
    if (typeof scopeData !== 'object') {
      return;
    }

    let dataObject = scopeData;
    let variables = variableNamePaths instanceof Array ? variableNamePaths : [variableNamePaths];

    // expression === true means that a expression function is available and should be extracted
    if (expression === true) {
      let handler = variables[variables.length - 1];
      variables = variables.slice(0, variables.length - 1);
      expressionArgumentsCount = variables.length;
      variables = variables.map(function (name) {
        return name.replace(/<>/g, '');
      });

      // \{\s*(.*)\s*\}
      // ((\w+)[\w\.]*)

      // Generate expression arguments
      try {
        expression = Galaxy.GalaxyView.createExpressionFunction(target, handler, variables, dataObject, targetKeyName);
      }
      catch (exception) {
        throw console.error(exception.message + '\n', variables);
      }
    } else if (!expression) {
      expressionArgumentsCount = 1;
    }

    let variableNamePath = null;
    let propertyName = null;
    let childProperty = null;
    let initValue = null;
    let aliasPropertyName = false;

    for (let i = 0, len = variables.length; i < len; i++) {
      variableNamePath = variables[i];
      propertyName = variableNamePath;
      childProperty = null;
      aliasPropertyName = false;

      let variableName = variableNamePath.split('.');
      if (variableName.length > 1) {
        propertyName = variableName.shift();
        childProperty = variableName.join('.');
      }

      if (i === 0 && propertyName === 'this') {
        i++;
        propertyName = variableName.shift();
        childProperty = null;
        aliasPropertyName = 'this.' + propertyName;
        dataObject = GalaxyView.propertyLookup(target.data, propertyName);
      } else {
        dataObject = GalaxyView.propertyLookup(dataObject, propertyName);
      }

      initValue = dataObject[propertyName];

      let enumerable = true;
      if (propertyName === 'length' && dataObject instanceof Array) {
        propertyName = '_length';
        aliasPropertyName = 'length';
        enumerable = false;
      }

      const referenceName = '<>' + propertyName;
      let boundProperty = dataObject[referenceName];

      if (typeof boundProperty === 'undefined') {
        boundProperty = GalaxyView.createBoundProperty(dataObject, propertyName, aliasPropertyName, referenceName, enumerable, childProperty, initValue);
      }

      // if (dataObject['__lists__'] !== undefined) {
      //   boundProperty.lists = dataObject['__lists__'];
      // }
      // When target is not a ViewNode, then add target['[targetKeyName]']
      if (!(target instanceof Galaxy.GalaxyView.ViewNode) && !childProperty && !target.hasOwnProperty('<>' + targetKeyName)) {
        boundPropertyReference.value = boundProperty;
        // Create a BoundProperty for targetKeyName if the value is an expression
        // the expression it self will be treated as a BoundProperty
        if (expression) {
          boundPropertyReference.value = GalaxyView.createBoundProperty({}, targetKeyName, false, '<>' + targetKeyName, false, null, null);
        }
        // console.info(boundPropertyReference.value,referenceName );
        // Otherwise the data is going to be bound through alias.
        // In other word, [targetKeyName] will refer to original BoundProperty.
        // This will make sure that there is always one BoundProperty for each data entry
        defineProp(target, '<>' + targetKeyName, boundPropertyReference);

        setterAndGetter.enumerable = enumerable;
        setterAndGetter.get = (function (_boundProperty, _expression) {
          // If there is an expression for the property, then apply it on get because target is not ViewNode
          // and can not have any setter for its properties
          if (_expression) {
            return function () {
              return _expression();
            };
          }

          return function () {
            return _boundProperty.value;
          };
        })(boundPropertyReference.value, expression);

        setterAndGetter.set = (function (BOUND_PROPERTY, DATA) {
          return function (value) {
            BOUND_PROPERTY.setValue(value, DATA);
          };
        })(boundPropertyReference.value, dataObject);

        defineProp(target, targetKeyName, setterAndGetter);
      }

      if (!childProperty) {
        boundProperty.addNode(target, targetKeyName, expression);
      }

      if (childProperty !== null) {
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

  /**
   *
   * @param subjects
   * @param data
   * @param cloneSubject
   * @returns {*}
   */
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

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param property
   * @returns {Function}
   */
  GalaxyView.createPropertySetter = function (node, property) {
    if (!property.name) {
      throw new Error('createPropertySetter: property.name is mandatory in order to create property setter');
    }

    return function (value, oldValue) {
      if (value instanceof Promise) {
        let asyncCall = function (asyncValue) {
          let newValue = property.parser ? property.parser(asyncValue) : asyncValue;
          node.node[property.name] = newValue;
          node.notifyObserver(property.name, newValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        const newValue = property.parser ? property.parser(value) : value;
        node.node[property.name] = newValue;
        node.notifyObserver(property.name, newValue, oldValue);
      }
    };
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} attributeName
   * @param property
   * @returns {Function}
   */
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

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} attributeName
   * @param {Function} parser
   * @returns {Function}
   */
  GalaxyView.createDefaultSetter = function (node, attributeName, parser) {
    return function (value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          const newValue = parser ? parser(asyncValue) : asyncValue;
          GalaxyView.setAttr(node, attributeName, newValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        const newValue = parser ? parser(value) : value;
        GalaxyView.setAttr(node, attributeName, newValue, oldValue);
      }
    };
  };

  /**
   *
   * @param {Array} value
   * @param {Function} onUpdate
   * @returns {{original: *, type: string, params: *}}
   */
  GalaxyView.createActiveArray = function (value, onUpdate) {
    let changes = {
      original: value,
      type: 'push',
      params: value
    };

    let oldChanges = Object.assign({}, changes);

    if (value['live']) {
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
    defineProp(value, 'live', boundPropertyReference);

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
          changes.result = result;

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

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} key
   * @param scopeData
   */
  GalaxyView.addReactiveBehavior = function (node, key, scopeData) {
    let behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
    let bindTo = node.schema[key];

    if (behavior) {
      let matches = behavior.regex ? (typeof(bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;

      node.behaviors[key] = (function (_behavior, _matches, _scopeData) {
        let _cache = {};
        if (_behavior.getCache) {
          _cache = _behavior.getCache.call(node, _matches, _scopeData);
        }

        return function (vn, value, oldValue, expression) {
          return _behavior.onApply.call(vn, _cache, value, oldValue, _scopeData, expression);
        };
      })(behavior, matches, scopeData);

      behavior.bind.call(node, scopeData, matches);
    }
  };

  GalaxyView.PROPERTY_SETTERS = {
    'prop': function (viewNode, property, expression) {
      const setter = GalaxyView.createPropertySetter(viewNode, property);

      if (expression) {
        return function (none, oldValue) {
          let expressionValue = expression(none);
          setter(expressionValue, oldValue);
        };
      }

      return setter;
    },
    'reactive': function (viewNode, property, expression) {
      const reactiveFunction = viewNode.behaviors[property.name];

      if (!reactiveFunction) {
        console.error('Reactive handler not found for: ' + property.name);
      }

      return function (value, oldValue) {
        reactiveFunction(viewNode, value, oldValue, expression);
      };
    },
    'custom': function (viewNode, property, expression, attributeName) {
      const setter = GalaxyView.createCustomSetter(viewNode, attributeName, property);

      if (expression) {
        return function (none, oldValue, scopeData) {
          let expressionValue = expression(none);
          setter(expressionValue, oldValue, scopeData);
        };
      }

      return setter;
    },
    'attr': function (viewNode, property, expression, attributeName) {
      let parser = property.parser;
      const setter = GalaxyView.createDefaultSetter(viewNode, attributeName, parser);
      if (expression) {
        return function (none, oldValue) {
          let expressionValue = expression(none);
          setter(expressionValue, oldValue);
        };
      }

      return setter;
    },
    'none': function () {
      return function () {

      };
    }
  };

  GalaxyView.createSetter = function (viewNode, attributeName, expression, dataObject) {
    let property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];

    if (!property) {
      // return function (value) {
      //   setAttr.call(viewNode.node, attributeName, value);
      // };
      property = {
        type: 'attr'
      };
    }

    if (property.util) {
      property.util(viewNode, attributeName, expression, dataObject);
    }

    // expressing for reactive property should be handled by that property handler
    // if viewNode is virtual, then the expression should be ignored
    if (property.type !== 'reactive' && viewNode.virtual) {
      // return console.info('virtual node, attr: ', attributeName, property.name);
      return function () {

      };
    }

    return GalaxyView.PROPERTY_SETTERS[property.type](viewNode, property, expression, attributeName);
  };

  GalaxyView.setPropertyForNode = function (viewNode, attributeName, value, scopeData) {
    const property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName] || {type: 'attr'};
    // let newValue = value;
    // let parser = property.parser;
    // worker.postMessage({viewNode: viewNode});

    switch (property.type) {
      case 'attr':
        GalaxyView.createDefaultSetter(viewNode, attributeName, property.parser)(value, null);
        // if (value instanceof Promise) {
        //   const asyncCall = function (asyncValue) {
        //     const newValue = parser ? parser(asyncValue) : asyncValue;
        //     GalaxyView.setAttr(viewNode, attributeName, newValue, null);
        //   };
        //   value.then(asyncCall).catch(asyncCall);
        // } else {
        //   const newValue = parser ? parser(value) : value;
        //   GalaxyView.setAttr(viewNode, attributeName, newValue, null);
        // }
        break;

      case 'prop':
        GalaxyView.createPropertySetter(viewNode, property)(value, null);
        break;

      case 'reactive':
        viewNode.behaviors[property.name](viewNode, value, null);
        break;

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;

      case 'custom':
        GalaxyView.createCustomSetter(viewNode, attributeName, property)(value, null, scopeData);
        break;
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} parent
   * @param {Object} scopeData
   * @param {Object} nodeSchema
   * @param position
   * @param {Array} domManipulationBus
   * @param {null|Object} localScope
   */
  GalaxyView.createNode = function (parent, scopeData, nodeSchema, position, localScope) {
    let i = 0, len = 0;

    if (nodeSchema instanceof Array) {
      for (i = 0, len = nodeSchema.length; i < len; i++) {
        GalaxyView.createNode(parent, scopeData, nodeSchema[i], null);
      }
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      let viewNode = new GalaxyView.ViewNode(null, nodeSchema, null, localScope);
      // viewNode.domManipulationBus = parent.domManipulationBus;
      parent.registerChild(viewNode, position);

      if (nodeSchema['mutator']) {
        viewNode.mutator = nodeSchema['mutator'];
      }

      let keys = Object.keys(nodeSchema);
      let attributeValue, attributeName;

      // Definition stage
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        if (GalaxyView.REACTIVE_BEHAVIORS[attributeName]) {
          GalaxyView.addReactiveBehavior(viewNode, attributeName, scopeData);
        }
      }

      // Value assignment stage
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = nodeSchema[attributeName];

        let bindings = GalaxyView.getBindings(attributeValue);

        if (bindings.variableNamePaths) {
          GalaxyView.makeBinding(viewNode, scopeData, attributeName, bindings.variableNamePaths, bindings.isExpression);
        } else {
          GalaxyView.setPropertyForNode(viewNode, attributeName, attributeValue, scopeData);
        }
      }

      if (!viewNode.virtual) {
        viewNode.callLifecycleEvent('postInit');
        if (viewNode.inDOM) {
          viewNode.setInDOM(true);
        }

        GalaxyView.createNode(viewNode, scopeData, nodeSchema.children, null);
        viewNode.inserted.then(function () {
          viewNode.callLifecycleEvent('postChildrenInsert');
        });
      } else {
        viewNode.callLifecycleEvent('postInit');
      }

      // viewNode.onReady promise will be resolved after all the dom manipulations are done
      // this make sure that the viewNode and its child elements are rendered
      // setTimeout(function () {
      viewNode.sequences.enter.nextAction(function () {
        viewNode.callLifecycleEvent('rendered');
        viewNode.hasBeenRendered();
      });

      return viewNode;
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyScope} scope
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxyView(scope) {
    const _this = this;
    _this.scope = scope;
    _this.dataRepos = {};

    if (scope.element instanceof GalaxyView.ViewNode) {
      _this.container = scope.element;
    } else {
      // removing the content of element seems not necessary
      // scope.element.innerHTML = '';
      _this.container = new GalaxyView.ViewNode(null, {
        tag: scope.element.tagName
      }, scope.element);

      // _this.container.domManipulationSequence.nextAction(function () {
      //   _this.container.hasBeenRendered();
      // });

      _this.container.sequences.enter.nextAction(function () {
        _this.container.hasBeenRendered();
      });
    }

    _this.renderingFlow = this.container.renderingFlow;
    // _this.domManipulationSequence = this.container.domManipulationSequence;
  }

  GalaxyView.prototype.setupRepos = function (repos) {
    this.dataRepos = repos;
  };

  GalaxyView.prototype.init = function (schema) {
    const _this = this;

    _this.container.renderingFlow.next(function (next) {
      GalaxyView.createNode(_this.container, _this.scope, schema, null);

      _this.container.sequences.enter.nextAction(function () {
        // debugger;
        next();
      });
      // setTimeout(function () {
      //   Promise.all(_this.container.domBus).then(function () {
      //     _this.container.domBus = [];
      //     next();
      //   });
      // });
    });
  };

  return GalaxyView;
}(Galaxy || {}));
