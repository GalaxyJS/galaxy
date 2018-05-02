/* global Galaxy, Promise */
'use strict';

Galaxy.View = /** @class */(function (G) {
  const defProp = Object.defineProperty;
  const setAttr = Element.prototype.setAttribute;
  const removeAttr = Element.prototype.removeAttribute;

  //------------------------------

  View.BINDING_SYNTAX_REGEX = new RegExp('^<([^\\[\\]\<\>]*)>\\s*([^\\[\\]\<\>]*)\\s*$');
  View.BINDING_EXPRESSION_REGEX = new RegExp('(?:["\'][\w\s]*[\'"])|([^\d\s=+\-|&%{}()<>!/]+)', 'g');

  View.REACTIVE_BEHAVIORS = {};

  View.NODE_SCHEMA_PROPERTY_MAP = {
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
    scrollTop: {
      type: 'prop',
      name: 'scrollTop'
    },
    scrollLeft: {
      type: 'prop',
      name: 'scrollLeft'
    },
    disabled: {
      type: 'attr',
      name: 'disabled'
    }
  };

  View.setAttr = function (viewNode, name, value, oldValue) {
    viewNode.notifyObserver(name, value, oldValue);
    if (value) {
      setAttr.call(viewNode.node, name, value, oldValue);
    } else {
      removeAttr.call(viewNode.node, name);
    }
  };

  View.createMirror = function (obj, forObj) {
    let result = forObj || {};

    defProp(result, '__parent__', {
      enumerable: false,
      value: obj
    });

    return result;
  };

  View.getAllViewNodes = function (node) {
    let item, viewNodes = [];

    const childNodes = Array.prototype.slice(node.childNodes, 0);
    for (let i = 0, len = childNodes.length; i < len; i++) {
      item = node.childNodes[i];

      if (item['galaxyViewNode'] !== undefined) {
        viewNodes.push(item.galaxyViewNode);
      }

      viewNodes = viewNodes.concat(View.getAllViewNodes(item));
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
  View.getBindings = function (value) {
    let propertyKeysPaths = null;
    let isExpression = false;
    const type = typeof(value);
    let modifiers = null;
    let handler = null;

    if (type === 'string') {
      const props = value.match(View.BINDING_SYNTAX_REGEX);
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
      handler = propertyKeysPaths.pop();
      isExpression = true;
    } else if (value instanceof Function && value.watch) {
      propertyKeysPaths = value.watch.slice(0);
      handler = value;
      isExpression = true;
    } else {
      propertyKeysPaths = null;
    }

    return {
      modifiers: modifiers,
      propertyKeysPaths: propertyKeysPaths ? propertyKeysPaths.map(function (name) {
        return name.replace(/<>/g, '');
      }) : null,
      handler: handler,
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
  View.safePropertyLookup = function (data, properties) {
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

    if (target instanceof Galaxy.View.ArrayChange) {
      return target.getInstance();
    }

    return target;
  };

  View.propertyLookup = function (data, properties) {
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
   * @returns {Galaxy.View.ReactiveData}
   */
  View.propertyScopeLookup = function (data, property) {
    const properties = property.split('.');
    const li = properties.length - 1;
    let target = data;
    properties.forEach(function (p, i) {
      target = View.propertyLookup(target, p);

      if (i !== li) {
        if (!target[p]) {
          const rd = target.__rd__.refs.filter(function (ref) {
            return ref.shadow[p];
          })[0];
          target = rd.shadow[p].data;
          // target = target.__rd__.shadow[p].data;
        } else {
          target = target[p];
        }
      }
    });

    return target.__rd__;
  };

  View.EXPRESSION_ARGS_FUNC_CACHE = {};

  View.createExpressionArgumentsProvider = function (variables) {
    const id = variables.join();

    if (View.EXPRESSION_ARGS_FUNC_CACHE[id]) {
      return View.EXPRESSION_ARGS_FUNC_CACHE[id];
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
    View.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  View.createExpressionFunction = function (host, handler, variables, scope) {
    let getExpressionArguments = Galaxy.View.createExpressionArgumentsProvider(variables);

    const fn = function () {
      let args = [];
      try {
        args = getExpressionArguments.call(host, Galaxy.View.safePropertyLookup, scope);
      } catch (ex) {
        console.error('Can\'t find the property: \n' + variables.join('\n'), '\n\nIt is recommended to inject the parent object instead' +
          ' of its property.\n\n', scope, '\n', ex);
      }

      return handler.apply(host, args);
    };

    fn.getArgs = function () {
      return getExpressionArguments.call(host, Galaxy.View.safePropertyLookup, scope);
    };
    return fn;
  };

  /**
   *
   * @param target
   * @param targetKeyName
   * @param scope
   * @param bindings
   * @returns {Function|boolean}
   */
  View.prepareExpression = function (target, targetKeyName, scope, bindings) {
    if (!bindings.isExpression) {
      return false;
    }

    const dependencies = bindings.propertyKeysPaths;
    // bindings.propertyKeysPaths = dependencies.map(function (name) {
    //   return name.replace(/<>/g, '');
    // });

    // Generate expression arguments
    try {
      bindings.expressionFn = Galaxy.View.createExpressionFunction(target, bindings.handler, dependencies, scope);
      return bindings.expressionFn;
    }
    catch (exception) {
      throw console.error(exception.message + '\n', dependencies);
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode | Object} target
   * @param {String} targetKeyName
   * @param {Galaxy.View.ReactiveData} parentReactiveData
   * @param {Galaxy.View.ReactiveData} scopeData
   * @param {Object} bindings
   */
  View.makeBinding = function (target, targetKeyName, parentReactiveData, scopeData, bindings, root) {
    let value = scopeData;

    if (!parentReactiveData && !(scopeData instanceof Galaxy.GalaxyScope)) {
      if (scopeData.hasOwnProperty('__rd__')) {
        parentReactiveData = scopeData.__rd__;
      } else {
        parentReactiveData = new Galaxy.View.ReactiveData(targetKeyName, value);
      }
    }

    const propertyKeysPaths = bindings.propertyKeysPaths;
    const expressionFn = bindings.expressionFn || View.prepareExpression(root, targetKeyName, value, bindings);

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
      // if (propertyKeyPath === 'this') debugger;
      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (i === 0 && propertyKeyPath === 'this' && root instanceof Galaxy.View.ViewNode) {
        i = 1;
        propertyKeyPath = propertyKeyPathItems.shift();
        bindings.propertyKeysPaths = propertyKeyPathItems;
        childPropertyKeyPath = null;
        parentReactiveData = new Galaxy.View.ReactiveData('data', root.data);
        // debugger;
        value = View.propertyLookup(root.data, propertyKeyPath);
        // debugger;
      } else {
        if (value) {
          value = View.propertyLookup(value, propertyKeyPath);
        }
      }

      initValue = value;
      if (value !== null && typeof value === 'object') {
        initValue = value[propertyKeyPath];
      }

      let reactiveData;

      if (initValue instanceof Object) {
        reactiveData = new Galaxy.View.ReactiveData(propertyKeyPath, initValue, parentReactiveData);
      } else if (childPropertyKeyPath) {
        reactiveData = new Galaxy.View.ReactiveData(propertyKeyPath, null, parentReactiveData);
      } else {
        parentReactiveData.addKeyToShadow(propertyKeyPath);
      }

      if (childPropertyKeyPath === null) {
        if (!(target instanceof Galaxy.View.ViewNode)) {
          defProp(target, targetKeyName, {
            // set: function (newValue) {
            // console.warn('It is not allowed', parentReactiveData.id, targetKeyName);
            // value[propertyKeyPath] = newValue;
            // },
            get: function ref() {
              if (expressionFn) {
                return expressionFn();
              }

              return parentReactiveData.data[propertyKeyPath];
              // this has a bug
              // if (value === null || value === undefined) {
              //   return value;
              // }
              //
              // return value[propertyKeyPath];
            },
            enumerable: true,
            configurable: true
          });
        }

        // The parentReactiveData would be empty when the developer is trying to bind to a direct property of GalaxyScope
        if (!parentReactiveData && scopeData instanceof Galaxy.GalaxyScope) {
          // if (scopeData instanceof Galaxy.GalaxyScope) {
          throw new Error('Binding to Scope direct properties is not allowed.\n' +
            'Try to define your properties on Scope.data.{property_name}\n' + 'path: ' + scopeData.uri.paresdURL + '\n');
        }

        parentReactiveData.addNode(target, targetKeyName, propertyKeyPath, expressionFn, scopeData);
      }

      if (childPropertyKeyPath !== null) {
        View.makeBinding(target, targetKeyName, reactiveData, initValue, {
          propertyKeysPaths: [childPropertyKeyPath],
          isExpression: false,
          expressionFn: expressionFn
        }, root);
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
  View.bindSubjectsToData = function (viewNode, subjects, data, cloneSubject) {
    const keys = Object.keys(subjects);
    let attributeName;
    let attributeValue;
    const subjectsClone = cloneSubject ? Galaxy.clone(subjects) : subjects;

    let parentReactiveData;
    if (!(data instanceof Galaxy.GalaxyScope)) {
      parentReactiveData = new Galaxy.View.ReactiveData('@', data);
    }

    for (let i = 0, len = keys.length; i < len; i++) {
      attributeName = keys[i];
      attributeValue = subjectsClone[attributeName];

      const bindings = View.getBindings(attributeValue);

      if (bindings.propertyKeysPaths) {
        View.makeBinding(subjectsClone, attributeName, parentReactiveData, data, bindings, viewNode);
        bindings.propertyKeysPaths.forEach(function (path) {
          try {
            const rd = View.propertyScopeLookup(data, path);
            viewNode.addDependedObject(rd, subjectsClone);
          } catch (error) {
            console.error('Could not find: ' + path + '\n', error);
          }
        });
      }

      if (attributeValue && typeof attributeValue === 'object' && !(attributeValue instanceof Array)) {
        View.bindSubjectsToData(viewNode, attributeValue, data);
      }
    }

    return subjectsClone;
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param property
   * @returns {Function}
   */
  View.createPropertySetter = function (node, property) {
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
   * @param {Galaxy.View.ViewNode} node
   * @param {string} attributeName
   * @param property
   * @returns {Function}
   */
  View.createCustomSetter = function (node, attributeName, property) {
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
   * @param {Galaxy.View.ViewNode} node
   * @param {string} attributeName
   * @returns {Function}
   */
  View.createDefaultSetter = function (node, attributeName) {
    return function (value, oldValue) {
      if (value instanceof Promise) {
        const asyncCall = function (asyncValue) {
          View.setAttr(node, attributeName, asyncValue, oldValue);
        };
        value.then(asyncCall).catch(asyncCall);
      } else {
        View.setAttr(node, attributeName, value, oldValue);
      }
    };
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param {string} key
   * @param scopeData
   */
  View.installReactiveBehavior = function (node, key, scopeData) {
    let behavior = View.REACTIVE_BEHAVIORS[key];
    let bindTo = node.schema[key];

    if (behavior) {
      const matches = behavior.regex ? (typeof(bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;
      const data = behavior.prepare.call(node, matches, scopeData);
      if (data !== undefined) {
        node.cache[key] = data;
      }

      const needValueAssign = behavior.install.call(node, data);
      return needValueAssign === undefined || needValueAssign === null ? true : needValueAssign;
    }

    return true;
  };

  View.PROPERTY_SETTERS = {
    'none': function () {
      return function () {

      };
    }
  };

  View.createSetter = function (viewNode, key, scopeProperty, expression) {
    let property = View.NODE_SCHEMA_PROPERTY_MAP[key];

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

    return View.PROPERTY_SETTERS[property.type](viewNode, key, property, expression);
  };

  View.setPropertyForNode = function (viewNode, attributeName, value) {
    const property = View.NODE_SCHEMA_PROPERTY_MAP[attributeName] || { type: 'attr' };

    switch (property.type) {
      case 'attr':
        View.createDefaultSetter(viewNode, attributeName)(value, null);
        break;

      case 'prop':
        View.createPropertySetter(viewNode, property)(value, null);
        break;

      case 'reactive': {
        // const reactiveApply = View.createSetter(viewNode, attributeName, null, scopeData);
        if (viewNode.setters[property.name]) {
          value;
          viewNode.node;
          debugger;
          return;
        }
        // if(value instanceof Array) debugger;
        const reactiveApply = View.createSetter(viewNode, attributeName, null, null);
        viewNode.setters[property.name] = reactiveApply;

        reactiveApply(value, null);
        break;
      }

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;

      case 'custom':
        View.createCustomSetter(viewNode, attributeName, property)(value, null);
        break;
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} parent
   * @param {Object} scopeData
   * @param {Object} nodeSchema
   * @param position
   */
  View.createNode = function (parent, scopeData, nodeSchema, position, refNode) {
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
        View.createNode(parent, scopeData, nodeSchema[i], null, refNode);
      }
    } else if (nodeSchema !== null && typeof(nodeSchema) === 'object') {
      let attributeValue, attributeName;
      const keys = Object.keys(nodeSchema);
      const needInitKeys = [];

      const viewNode = new View.ViewNode(nodeSchema, null, refNode);
      parent.registerChild(viewNode, position);

      // Behaviors definition stage
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        if (View.REACTIVE_BEHAVIORS[attributeName]) {
          const needValueAssign = View.installReactiveBehavior(viewNode, attributeName, scopeData);
          if (needValueAssign !== false) {
            needInitKeys.push(attributeName);
          }
        } else {
          needInitKeys.push(attributeName);
        }
      }

      // Value assignment stage
      for (i = 0, len = needInitKeys.length; i < len; i++) {
        attributeName = needInitKeys[i];
        attributeValue = nodeSchema[attributeName];

        let bindings = View.getBindings(attributeValue);
        if (bindings.propertyKeysPaths) {
          View.makeBinding(viewNode, attributeName, null, scopeData, bindings, viewNode);
        } else {
          View.setPropertyForNode(viewNode, attributeName, attributeValue);
        }
      }

      viewNode.callLifecycleEvent('postInit');
      if (!viewNode.virtual) {
        if (viewNode.inDOM) {
          viewNode.setInDOM(true);
        }

        View.createNode(viewNode, scopeData, nodeSchema.children, null, refNode);
        viewNode.inserted.then(function () {
          viewNode.callLifecycleEvent('postChildrenInsert');
        });
      }

      // viewNode.onReady promise will be resolved after all the dom manipulations are done
      requestAnimationFrame(function () {
        viewNode.sequences.enter.nextAction(function () {
          viewNode.hasBeenRendered();
        });
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
  function View(scope) {
    const _this = this;
    _this.scope = scope;
    _this.dataRepos = {};
    _this.config = {
      cleanContainer: false
    };

    if (scope.element instanceof View.ViewNode) {
      _this.container = scope.element;
    } else {
      _this.container = new View.ViewNode({
        tag: scope.element.tagName
      }, scope.element);

      _this.container.sequences.enter.nextAction(function () {
        _this.container.hasBeenRendered();
      });
    }

    _this.renderingFlow = this.container.renderingFlow;
  }

  View.prototype = {
    setupRepos: function (repos) {
      this.dataRepos = repos;
    },
    init: function (schema) {
      const _this = this;

      if (_this.config.cleanContainer) {
        _this.container.node.innerHTML = '';
      }

      _this.container.renderingFlow.next(function (next) {
        View.createNode(_this.container, _this.scope, schema, null);
        _this.container.sequences.enter.nextAction(function () {
          next();
        });
      });
    },
    broadcast: function (event) {
      this.container.broadcast(event);
    },
    createNode: function (schema, parent, position) {
      return View.createNode(parent || this.container, this.scope, schema, position);
    }
  };

  return View;
}(Galaxy || {}));
