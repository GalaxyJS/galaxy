/* global Galaxy, Promise */
'use strict';

Galaxy.View = /** @class */(function () {
  const defProp = Object.defineProperty;

  //------------------------------

  View.EMPTY_CALL = function () {
  };
  View.BINDING_SYNTAX_REGEX = new RegExp('^<([^\\[\\]\<\>]*)>\\s*([^\\[\\]\<\>]*)\\s*$');
  View.BINDING_EXPRESSION_REGEX = new RegExp('(?:["\'][\w\s]*[\'"])|([^\d\s=+\-|&%{}()<>!/]+)', 'g');

  View.REACTIVE_BEHAVIORS = {
    // example: {
    //   regex: null,
    //   prepare: function (matches, scope) {},
    //   install: function (config) {},
    //   apply: function (config, value, oldValue, expressionFn) {}
    // }
  };

  View.TO_BE_CREATED = {};

  View.LAST_CREATE_FRAME_ID = null;

  View.CREATE_IN_NEXT_FRAME = function (node, action) {
    if (View.LAST_CREATE_FRAME_ID) {
      cancelAnimationFrame(View.LAST_CREATE_FRAME_ID);
      View.LAST_CREATE_FRAME_ID = null;
    }

    View.TO_BE_CREATED[node.index] = {
      node,
      action
    };

    const keys = Object.keys(View.TO_BE_CREATED).sort();

    View.LAST_CREATE_FRAME_ID = requestAnimationFrame(() => {
      console.log(keys);
      keys.forEach((key) => {
        const batch = View.TO_BE_CREATED[key];
        if (!batch) {
          return;
        }
        batch.action();
        Reflect.deleteProperty(View.TO_BE_CREATED, key);
      });
    });
  };

  /**
   *
   * @typedef {Object} Galaxy.View.SchemaProperty
   * @property {string} [type]
   * @property {Function} [setup]
   * @property {Function} [createSetter]
   * @property {Function} [value]
   */

  View.NODE_SCHEMA_PROPERTY_MAP = {
    tag: {
      type: 'none'
      // setup: function(viewNode, scopeReactiveData, property, expression) {}
      // createSetter: function(viewNode, attrName, property, expression, scope) {}
      // value: function(viewNode, attr, value, oldValue) {}
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

  View.setAttr = function setAttr(viewNode, value, oldValue, name) {
    viewNode.notifyObserver(name, value, oldValue);
    if (value !== null && value !== undefined) {
      viewNode.node.setAttribute(name, value);
    } else {
      viewNode.node.removeAttribute(name);
    }
  };

  View.setProp = function setProp(viewNode, value, oldValue, name) {
    viewNode.node[name] = value;
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
    const type = typeof (value);
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
    } else if (value instanceof Array && typeof value[value.length - 1] === 'function') {
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
      // middle += 'properties(scope, "' + variables[i] + '").' + variables[i] + ',';
      middle += 'properties(scope, "' + variables[i] + '"),';
    }

    // Take care of variables that contain square brackets like '[variable_name]'
    // for the convenience of the programmer

    functionContent += middle.substring(0, middle.length - 1) + ']';

    const func = new Function('properties, scope', functionContent);
    View.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  View.createExpressionFunction = function (host, handler, variables, scope) {
    const getExpressionArguments = Galaxy.View.createExpressionArgumentsProvider(variables);

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

    // Generate expression arguments
    try {
      bindings.expressionFn = Galaxy.View.createExpressionFunction(target, bindings.handler, dependencies, scope);
      return bindings.expressionFn;
    } catch (exception) {
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
   * @param {Galaxy.View.ViewNode | undefined} root
   */
  View.makeBinding = function (target, targetKeyName, parentReactiveData, scopeData, bindings, root) {
    const propertyKeysPaths = bindings.propertyKeysPaths;
    const expressionFn = bindings.expressionFn || View.prepareExpression(root, targetKeyName, scopeData, bindings);

    let value = scopeData;
    let propertyKey = null;
    let childPropertyKeyPath = null;
    let initValue = null;
    let propertyKeyPathItems = [];
    for (let i = 0, len = propertyKeysPaths.length; i < len; i++) {
      propertyKey = propertyKeysPaths[i];
      childPropertyKeyPath = null;

      propertyKeyPathItems = propertyKey.split('.');
      if (propertyKeyPathItems.length > 1) {
        propertyKey = propertyKeyPathItems[0];
        childPropertyKeyPath = propertyKeyPathItems.slice(1).join('.');
      }
      if (!parentReactiveData && !(scopeData instanceof Galaxy.Scope)) {
        if (scopeData.hasOwnProperty('__rd__')) {
          parentReactiveData = scopeData.__rd__;
        } else {
          parentReactiveData = new Galaxy.View.ReactiveData(targetKeyName, scopeData);
        }
      }
      // When the node belongs to a nested $for, the scopeData would refer to the for item data
      // But developer should still be able to access root scopeData
      if (propertyKeyPathItems[0] === 'data' && scopeData && scopeData.hasOwnProperty('__rootScopeData__') &&
        propertyKey === 'data') {
        parentReactiveData = null;
      }

      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (propertyKeyPathItems[0] === 'this' && propertyKey === 'this' && root instanceof Galaxy.View.ViewNode) {
        propertyKey = propertyKeyPathItems[1];
        bindings.propertyKeysPaths = propertyKeyPathItems.slice(2);
        childPropertyKeyPath = null;
        parentReactiveData = new Galaxy.View.ReactiveData('data', root.data);
        value = View.propertyLookup(root.data, propertyKey);
      } else if (value) {
        value = View.propertyLookup(value, propertyKey);
      }

      initValue = value;
      if (value !== null && typeof value === 'object') {
        initValue = value[propertyKey];
      }

      let reactiveData;
      if (initValue instanceof Object) {
        reactiveData = new Galaxy.View.ReactiveData(propertyKey, initValue, parentReactiveData);
      } else if (childPropertyKeyPath) {
        reactiveData = new Galaxy.View.ReactiveData(propertyKey, null, parentReactiveData);
      } else if (parentReactiveData) {
        parentReactiveData.addKeyToShadow(propertyKey);
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

              return parentReactiveData.data[propertyKey];
            },
            enumerable: true,
            configurable: true
          });
        }

        // The parentReactiveData would be empty when the developer is trying to bind to a direct property of Scope
        if (!parentReactiveData && scopeData instanceof Galaxy.Scope) {
          // If the propertyKey is refering to some local value then there is no error
          if (target instanceof Galaxy.View.ViewNode && target.localPropertyNames.has(propertyKey)) {
            return;
          }

          throw new Error('Binding to Scope direct properties is not allowed.\n' +
            'Try to define your properties on Scope.data.{property_name}\n' + 'path: ' + scopeData.uri.parsedURL + '\nProperty name: `' +
            propertyKey + '`\n');
        }

        parentReactiveData.addNode(target, targetKeyName, propertyKey, expressionFn, scopeData);
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
    const subjectsClone = cloneSubject ? Galaxy.clone(subjects)/*Object.assign({}, subjects)*/ : subjects;

    let parentReactiveData;
    if (!(data instanceof Galaxy.Scope)) {
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
   * @param {string} key
   * @param scopeData
   */
  View.installReactiveBehavior = function (behavior, node, key, scopeData) {
    const bindTo = node.schema[key];
    const matches = behavior.regex ? (typeof (bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;
    const data = behavior.prepare.call(node, matches, scopeData);
    if (data !== undefined) {
      node.cache[key] = data;
    }

    const needValueAssignment = behavior.install.call(node, data);
    return needValueAssignment === undefined || needValueAssignment === null ? true : needValueAssignment;
  };

  View.PROPERTY_SETTERS = {
    'none': function () {
      return function () {

      };
    }
  };

  View.createSetter = function (viewNode, key, scopeProperty, expression) {
    /**
     *
     * @type {Galaxy.View.SchemaProperty}
     */
    const property = View.NODE_SCHEMA_PROPERTY_MAP[key] || {type: 'attr'};

    if (property.setup && scopeProperty) {
      property.setup(viewNode, scopeProperty, key, expression);
    }

    // if viewNode is virtual, then the expression should be ignored
    if (property.type !== 'reactive' && viewNode.virtual) {
      return function () {
      };
    }

    // This is the lowest level where the developer can modify the property setter behavior
    // By defining 'createSetter' for the property you can implement your custom functionality for setter
    if (property.createSetter) {
      return property.createSetter(viewNode, key, property, expression);
    }

    return View.PROPERTY_SETTERS[property.type](viewNode, key, property, expression);
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {string} attributeName
   * @param {*} value
   */
  View.setPropertyForNode = function (viewNode, attributeName, value) {
    const property = View.NODE_SCHEMA_PROPERTY_MAP[attributeName] || {type: 'attr'};

    switch (property.type) {
      case 'attr':
      case 'prop':
        View.createSetter(viewNode, attributeName, null, null)(value, null);
        break;

      case 'reactive': {
        if (viewNode.setters[property.name]) {
          return;
        }
        const reactiveApply = View.createSetter(viewNode, attributeName, null, null);
        viewNode.setters[property.name] = reactiveApply;

        reactiveApply(value, null);
        break;
      }

      case 'event':
        viewNode.node.addEventListener(attributeName, value.bind(viewNode), false);
        break;
    }
  };

  /**
   *
   * @param {Galaxy.Scope} scope
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

    if (scope.element instanceof Galaxy.View.ViewNode) {
      _this.container = scope.element;
    } else {
      _this.container = new Galaxy.View.ViewNode(null, {
        tag: scope.element.tagName
      }, scope.element, _this);

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

      // _this.container.renderingFlow.next(function (next) {
      _this.createNode(schema, _this.container, _this.scope, null);
      // _this.container.sequences.enter.nextAction(function () {
      //   next();
      // }, null, 'container-enter');
      // });
    },
    style: function (styleSchema) {
      // this.createNode(Object.assign({}, styleSchema));
    },
    broadcast: function (event) {
      this.container.broadcast(event);
    },
    /**
     *
     * @param {Object} nodeSchema
     * @param {Galaxy.View.ViewNode} parent
     * @param {Object} scopeData
     * @param {Node|Element|null} position
     * @param {Node|Element|null} refNode
     */
    createNode: function (nodeSchema, parent, scopeData, position, refNode) {
      const _this = this;
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
          _this.createNode(nodeSchema[i], parent, scopeData, null, refNode);
        }
      } else if (nodeSchema !== null && typeof (nodeSchema) === 'object') {
        let attributeValue, attributeName;
        const keys = Object.keys(nodeSchema);
        const needInitKeys = [];

        const viewNode = new Galaxy.View.ViewNode(parent, nodeSchema, null, refNode, _this);
        parent.registerChild(viewNode, position);

        // Behaviors installation stage
        for (i = 0, len = keys.length; i < len; i++) {
          attributeName = keys[i];
          const behavior = View.REACTIVE_BEHAVIORS[attributeName];
          if (behavior) {
            const needValueAssign = View.installReactiveBehavior(behavior, viewNode, attributeName, scopeData);
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

          const bindings = View.getBindings(attributeValue);
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

          _this.createNode(nodeSchema.children, viewNode, scopeData, null, refNode);

          viewNode.inserted.then(function () {
            // console.log(viewNode.index)
            viewNode.callLifecycleEvent('postChildrenInsert');
          });
        }

        // viewNode.onReady promise will be resolved after all the dom manipulations are done
        // viewNode.sequences.enter.nextAction(function () {
        //   requestAnimationFrame(function () {
        //     viewNode.hasBeenRendered();
        //   });
        // });

        return viewNode;
      }
    }
  };

  return View;
}());
