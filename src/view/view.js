/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxyView = /** @class */(function (G) {
  const defineProp = Object.defineProperty;
  const setAttr = Element.prototype.setAttribute;
  const removeAttr = Element.prototype.removeAttribute;

  //------------------------------

  GalaxyView.BINDING_SYNTAX_REGEX = new RegExp('^<([^\\[\\]\<\>]*)>\\s*([^\\[\\]\<\>]*)\\s*$');
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

  GalaxyView.createMirror = function (obj, forObj) {
    let result = forObj || {};

    defineProp(result, '__parent__', {
      enumerable: false,
      value: obj
    });

    return result;
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

  /**
   *
   * @param {string|Array} value
   * @return {{modifiers: *, propertyKeysPaths: *[], isExpression: boolean, expressionFn: null}}
   */
  GalaxyView.getBindings = function (value) {
    let propertyKeysPaths = null;
    let isExpression = false;
    const type = typeof(value);
    let modifiers = null;

    if (type === 'string') {
      const props = value.match(GalaxyView.BINDING_SYNTAX_REGEX);
      if (props) {
        modifiers = props[1] || null;
        propertyKeysPaths = [props[2]];
      } else {
        modifiers = null;
        propertyKeysPaths = null;
      }
    }
    else if (value instanceof Array && typeof value[value.length - 1] === 'function') {
      propertyKeysPaths = value.slice(0);
      isExpression = true;
    } else {
      propertyKeysPaths = null;
    }

    return {
      modifiers: modifiers,
      propertyKeysPaths: propertyKeysPaths,
      isExpression: isExpression,
      expressionFn: null
    };
  };

  /**
   *
   * @param data
   * @param {string} properties
   * @return {*}
   */
  GalaxyView.safePropertyLookup = function (data, properties) {
    properties = properties.split('.');
    let property = properties[0];
    const original = data;
    let target = data;
    let temp = data;
    // var nestingLevel = 0;
    if (data[property] === undefined) {
      while (temp.__parent__) {
        if (temp.__parent__.hasOwnProperty(property)) {
          target = temp.__parent__;
          break;
        }

        temp = temp.__parent__;
      }

      // if the property is not found in the parents then return the original object as the context
      if (target[property] === undefined) {
        target = original;
      }
    }

    target = target || {};
    const lastIndex = properties.length - 1;
    properties.forEach(function (key, i) {
      target = target[key];

      if (i !== lastIndex && !(target instanceof Object)) {
        target = {};
      }
    });

    return target;
  };

  GalaxyView.propertyLookup = function (data, properties) {
    properties = properties.split('.');
    let property = properties[0];
    const original = data;
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

  /**
   *
   * @param data
   * @param property
   * @returns {Galaxy.GalaxyView.ReactiveData}
   */
  GalaxyView.propertyScopeLookup = function (data, property) {
    const properties = property.split('.');
    const li = properties.length - 1;
    let target = data;
    properties.forEach(function (p, i) {
      target = GalaxyView.propertyLookup(target, p);

      if (i !== li) {
        if (!target[p]) {
          target = target.__rd__.shadow[p].data;
        } else {
          target = target[p];
        }
      }
    });

    return target.__rd__;
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
      // middle += 'prop(scope, "' + variables[i] + '").' + variables[i] + ',';
      middle += 'prop(scope, "' + variables[i] + '"),';
    }

    // Take care of variables that contain square brackets like '[variable_name]'
    // for the convenience of the programmer

    // middle = middle.substring(0, middle.length - 1).replace(/<>/g, '');
    functionContent += middle.substring(0, middle.length - 1) + ']';

    const func = new Function('prop, scope', functionContent);
    GalaxyView.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  GalaxyView.createExpressionFunction = function (host, handler, variables, scope) {
    let getExpressionArguments = Galaxy.GalaxyView.createExpressionArgumentsProvider(variables);

    return function () {
      let args = [];
      try {
        args = getExpressionArguments.call(host, Galaxy.GalaxyView.safePropertyLookup, scope);
      } catch (ex) {
        console.error('Can\'t find the property: \n' + variables.join('\n'), '\n\nIt is recommended to inject the parent object instead' +
          ' of its property.\n\n', scope, '\n', ex);
      }
      return handler.apply(host, args);
    };
  };

  /**
   *
   * @param target
   * @param targetKeyName
   * @param scope
   * @param bindings
   * @returns {Function|boolean}
   */
  GalaxyView.prepareExpression = function (target, targetKeyName, scope, bindings) {
    if (!bindings.isExpression) {
      return false;
    }

    const dependencies = bindings.propertyKeysPaths;
    // Extracting the function from the list of dependencies
    const handler = dependencies.pop();
    bindings.propertyKeysPaths = dependencies.map(function (name) {
      return name.replace(/<>/g, '');
    });

    // Generate expression arguments
    try {
      bindings.expressionFn = Galaxy.GalaxyView.createExpressionFunction(target, handler, dependencies, scope, targetKeyName);
      return bindings.expressionFn;
    }
    catch (exception) {
      throw console.error(exception.message + '\n', dependencies);
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode | Object} target
   * @param {String} targetKeyName
   * @param {Galaxy.GalaxyView.ReactiveData} parentReactiveData
   * @param {Galaxy.GalaxyView.ReactiveData} scopeData
   * @param {Object} bindings
   */
  GalaxyView.makeBinding = function (target, targetKeyName, parentReactiveData, scopeData, bindings) {
    let value = scopeData;

    if (!parentReactiveData && !(scopeData instanceof Galaxy.GalaxyScope)) {
      if (scopeData.hasOwnProperty('__rd__')) {
        parentReactiveData = scopeData.__rd__;
      } else {
        parentReactiveData = new Galaxy.GalaxyView.ReactiveData(targetKeyName, value);
      }
    }

    const propertyKeysPaths = bindings.propertyKeysPaths;
    const expressionFn = bindings.expressionFn || GalaxyView.prepareExpression(target, targetKeyName, value, bindings);

    let propertyKeyPath = null;
    let childPropertyKeyPath = null;
    let initValue = null;
    let propertyKeyPathItems = [];

    for (let i = 0, len = propertyKeysPaths.length; i < len; i++) {
      propertyKeyPath = propertyKeysPaths[i];
      childPropertyKeyPath = null;

      propertyKeyPathItems = propertyKeyPath.split('.');
      if (propertyKeyPathItems.length > 1) {
        propertyKeyPath = propertyKeyPathItems.shift();
        childPropertyKeyPath = propertyKeyPathItems.join('.');
      }
      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (i === 0 && propertyKeyPath === 'this' && target instanceof Galaxy.GalaxyView.ViewNode) {
        i = 1;
        propertyKeyPath = propertyKeyPathItems.shift();
        childPropertyKeyPath = null;
        // aliasPropertyName = 'this.' + propertyKeyPath;
        // shadow = GalaxyView.propertyLookup(target.data, propertyKeyPath);
      } else {
        if (value) {
          value = GalaxyView.propertyLookup(value, propertyKeyPath);
        }
      }

      initValue = value;
      if (value !== null && typeof value === 'object') {
        initValue = value[propertyKeyPath];
      }

      let reactiveData;

      if (initValue instanceof Object) {
        reactiveData = new Galaxy.GalaxyView.ReactiveData(propertyKeyPath, initValue, parentReactiveData);
      } else if (childPropertyKeyPath) {
        reactiveData = new Galaxy.GalaxyView.ReactiveData(propertyKeyPath, null, parentReactiveData);
      } else {
        parentReactiveData.addKeyToShadow(propertyKeyPath);
      }

      if (childPropertyKeyPath === null) {
        if (!(target instanceof Galaxy.GalaxyView.ViewNode)) {
          defineProp(target, targetKeyName, {
            // set: function (newValue) {
            // console.warn('It is not allowed', parentReactiveData.id, targetKeyName);
            // value[propertyKeyPath] = newValue;
            // },
            get: function ref() {
              if (expressionFn) {
                return expressionFn();
              }

              if (value === null || value === undefined) {
                return value;
              }

              return value[propertyKeyPath];
            },
            enumerable: true,
            configurable: true
          });
        }
        parentReactiveData.addNode(target, targetKeyName, propertyKeyPath, expressionFn, scopeData);
      }

      if (childPropertyKeyPath !== null) {
        GalaxyView.makeBinding(target, targetKeyName, reactiveData, initValue, {
          propertyKeysPaths: [childPropertyKeyPath],
          isExpression: false,
          expressionFn: expressionFn
        });
      }
    }
  };

  /**
   * Bind subjects to the data and takes care of dependent objects
   * @param viewNode
   * @param subjects
   * @param data
   * @param cloneSubject
   * @returns {*}
   */
  GalaxyView.bindSubjectsToData = function (viewNode, subjects, data, cloneSubject) {
    const keys = Object.keys(subjects);
    let attributeName;
    let attributeValue;
    const subjectsClone = cloneSubject ? Galaxy.clone(subjects) : subjects;

    let parentReactiveData;
    if (!(data instanceof Galaxy.GalaxyScope)) {
      parentReactiveData = new Galaxy.GalaxyView.ReactiveData('@', data);
    }

    for (let i = 0, len = keys.length; i < len; i++) {
      attributeName = keys[i];
      attributeValue = subjectsClone[attributeName];

      const bindings = GalaxyView.getBindings(attributeValue);

      if (bindings.propertyKeysPaths) {
        GalaxyView.makeBinding(subjectsClone, attributeName, parentReactiveData, data, bindings);
        bindings.propertyKeysPaths.forEach(function (path) {
          try {
            const rd = GalaxyView.propertyScopeLookup(data, path);
            viewNode.addDependedObject(rd, subjectsClone);
          } catch (error) {
            console.info(path);
            console.error(error);
          }
        });
      }

      if (attributeValue && typeof attributeValue === 'object' && !(attributeValue instanceof Array)) {
        GalaxyView.bindSubjectsToData(viewNode, attributeValue, data);
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
        const asyncCall = function (asyncValue) {
          node.node[property.name] = asyncValue;
          node.notifyObserver(property.name, asyncValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        node.node[property.name] = value;
        node.notifyObserver(property.name, value, oldValue);
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
    return function (value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          property.handler(node, attributeName, asyncValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        property.handler(node, attributeName, value, oldValue);
      }
    };
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} attributeName
   * @returns {Function}
   */
  GalaxyView.createDefaultSetter = function (node, attributeName) {
    return function (value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          GalaxyView.setAttr(node, attributeName, asyncValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        GalaxyView.setAttr(node, attributeName, value, oldValue);
      }
    };
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} node
   * @param {string} key
   * @param scopeData
   */
  GalaxyView.installReactiveBehavior = function (node, key, scopeData) {
    let behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
    let bindTo = node.schema[key];

    if (behavior) {
      const matches = behavior.regex ? (typeof(bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;
      const data = behavior.prepareData.call(node, matches, scopeData);
      if (data !== undefined) {
        node.cache[key] = data;
      }

      const needValueAssign = behavior.install.call(node, data);
      return needValueAssign === undefined || needValueAssign === null ? true : needValueAssign;
    }

    return true;
  };

  GalaxyView.PROPERTY_SETTERS = {
    'none': function () {
      return function () {

      };
    }
  };

  GalaxyView.createSetter = function (viewNode, key, scopeProperty, expression) {
    let property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[key];

    if (!property) {
      property = {
        type: 'attr'
      };
    }

    if (property.util) {
      property.util(viewNode, scopeProperty, key, expression);
    }

    // if viewNode is virtual, then the expression should be ignored
    if (property.type !== 'reactive' && viewNode.virtual) {
      return function () { };
    }

    return GalaxyView.PROPERTY_SETTERS[property.type](viewNode, key, property, expression);
  };

  GalaxyView.setPropertyForNode = function (viewNode, attributeName, value) {
    const property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName] || {type: 'attr'};

    switch (property.type) {
      case 'attr':
        GalaxyView.createDefaultSetter(viewNode, attributeName)(value, null);
        break;

      case 'prop':
        GalaxyView.createPropertySetter(viewNode, property)(value, null);
        break;

      case 'reactive': {
        // const reactiveApply = GalaxyView.createSetter(viewNode, attributeName, null, scopeData);
        if (viewNode.setters[property.name]) {
          value;
          viewNode.node;
          debugger;
          return;
        }
        // if(value instanceof Array) debugger;
        const reactiveApply = GalaxyView.createSetter(viewNode, attributeName, null, null);
        viewNode.setters[property.name] = reactiveApply;

        reactiveApply(value, null);
        break;
      }

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;

      case 'custom':
        GalaxyView.createCustomSetter(viewNode, attributeName, property)(value, null);
        break;
    }
  };

  /**
   *
   * @param {Galaxy.GalaxyView.ViewNode} parent
   * @param {Object} scopeData
   * @param {Object} nodeSchema
   * @param position
   * @param {null|Object} localScope
   */
  GalaxyView.createNode = function (parent, scopeData, nodeSchema, position, localScope) {
    let i = 0, len = 0;

    if (typeof nodeSchema === 'string') {
      const content = document.createElement('div');
      content.innerHTML = nodeSchema;
      const nodes = Array.prototype.slice.call(content.childNodes);
      nodes.forEach(function (node) {
        parent.node.appendChild(node);
      });

      return nodes;
    }

    if (nodeSchema instanceof Array) {
      for (i = 0, len = nodeSchema.length; i < len; i++) {
        GalaxyView.createNode(parent, scopeData, nodeSchema[i], null);
      }
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      let attributeValue, attributeName;
      const keys = Object.keys(nodeSchema);
      const needInitKeys = [];
      // keys.splice(keys.indexOf('tag'), 1);

      const viewNode = new GalaxyView.ViewNode(nodeSchema);
      parent.registerChild(viewNode, position);

      // Behaviors definition stage
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        if (GalaxyView.REACTIVE_BEHAVIORS[attributeName]) {
          const needValueAssign = GalaxyView.installReactiveBehavior(viewNode, attributeName, scopeData);
          if (needValueAssign !== false) {
            needInitKeys.push(attributeName);
          }
        } else {
          needInitKeys.push(attributeName);
        }
      }

      let bindings;
      // Value assignment stage
      for (i = 0, len = needInitKeys.length; i < len; i++) {
        attributeName = needInitKeys[i];
        attributeValue = nodeSchema[attributeName];

        bindings = GalaxyView.getBindings(attributeValue);
        if (bindings.propertyKeysPaths) {
          GalaxyView.makeBinding(viewNode, attributeName, null, scopeData, bindings);
        } else {
          GalaxyView.setPropertyForNode(viewNode, attributeName, attributeValue);
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
    _this.config = {
      cleanContainer: false
    };

    if (scope.element instanceof GalaxyView.ViewNode) {
      _this.container = scope.element;
    } else {
      _this.container = new GalaxyView.ViewNode({
        tag: scope.element.tagName
      }, scope.element);

      _this.container.sequences.enter.nextAction(function () {
        _this.container.hasBeenRendered();
      });
    }

    _this.renderingFlow = this.container.renderingFlow;
  }

  GalaxyView.prototype.setupRepos = function (repos) {
    this.dataRepos = repos;
  };

  GalaxyView.prototype.init = function (schema) {
    const _this = this;

    if (_this.config.cleanContainer) {
      _this.container.node.innerHTML = '';
    }

    _this.container.renderingFlow.next(function (next) {
      GalaxyView.createNode(_this.container, _this.scope, schema, null);
      _this.container.sequences.enter.nextAction(function () {
        next();
      });
    });
  };

  GalaxyView.prototype.broadcast = function (event) {
    this.container.broadcast(event);
  };

  return GalaxyView;
}(Galaxy || {}));
