/* global Galaxy */
Galaxy.View = /** @class */(function (G) {
  const defProp = Object.defineProperty;

  //------------------------------

  Array.prototype.createComputable = function (f) {
    const reactive = this.slice();
    reactive.push(f);
    return reactive;
  };

  Array.prototype.createDataMap = function (keyPropertyName, valuePropertyName) {
    const map = {};
    for (let i = 0, len = this.length; i < len; i++) {
      const item = this[i];
      map[item[keyPropertyName]] = item[valuePropertyName];
    }

    return map;
  };

  View.EMPTY_CALL = function () {
  };
  View.BINDING_SYNTAX_REGEX = new RegExp('^<([^\\[\\]\<\>]*)>\\s*([^\\[\\]\<\>]*)\\s*$|^=\\s*([^\\[\\]<>]*)\\s*$');

  /**
   *
   * @typedef {Object} Galaxy.View.BlueprintProperty
   * @property {'attr'|'prop'|'reactive'} [type]
   * @property {Function} [setup]
   * @property {Function} [createSetter]
   * @property {Function} [value]
   */

  View.NODE_BLUEPRINT_PROPERTY_MAP = {
    tag: {
      type: 'none'
      // setup: function(viewNode, scopeReactiveData, property, expression) {}
      // createSetter: function(viewNode, attrName, property, expression, scope) {}
      // value: function(viewNode, attr, value, oldValue) {}
    },
    children: {
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
    nodeValue: {
      type: 'prop',
      name: 'nodeValue'
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

  View.REACTIVE_BEHAVIORS = {
    // example: {
    //   regex: null,
    //   prepare: function (matches, scope) {},
    //   install: function (config) {},
    //   apply: function (config, value, oldValue, expressionFn) {}
    // }
  };

  View.PROPERTY_SETTERS = {
    'none': function () {
      return View.EMPTY_CALL;
    }
  };

  /**
   *
   * @param {Array<Galaxy.View.ViewNode>} toBeRemoved
   * @memberOf Galaxy.View
   * @static
   */
  View.destroyNodes = function (toBeRemoved, hasAnimation) {
    let remove = null;

    for (let i = 0, len = toBeRemoved.length; i < len; i++) {
      remove = toBeRemoved[i];
      remove.destroy(hasAnimation);
    }
  };

  View.TO_BE_DESTROYED = {};
  View.LAST_FRAME_ID = null;
  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.DESTROY_IN_NEXT_FRAME = function (index, action) {
    if (View.LAST_FRAME_ID) {
      cancelAnimationFrame(View.LAST_FRAME_ID);
      View.LAST_FRAME_ID = null;
    }

    if (View.TO_BE_DESTROYED[index]) {
      View.TO_BE_DESTROYED[index].push(action);
    } else {
      View.TO_BE_DESTROYED[index] = [action];
    }

    View.LAST_FRAME_ID = requestAnimationFrame(() => {
      const keys = Object.keys(View.TO_BE_DESTROYED).sort().reverse();
      keys.forEach((key) => {
        const batch = View.TO_BE_DESTROYED[key];
        if (!batch) {
          return;
        }

        let action;
        while (batch.length) {
          action = batch.shift();
          action();
        }
      });
    });
  };

  View.TO_BE_CREATED = {};
  View.LAST_CREATE_FRAME_ID = null;
  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.CREATE_IN_NEXT_FRAME = function (index, action) {
    if (View.LAST_CREATE_FRAME_ID) {
      cancelAnimationFrame(View.LAST_CREATE_FRAME_ID);
      View.LAST_CREATE_FRAME_ID = null;
    }

    const target = View.TO_BE_CREATED[index] || [];
    target.push(action);
    View.TO_BE_CREATED[index] = target;

    View.LAST_CREATE_FRAME_ID = requestAnimationFrame(() => {
      const keys = Object.keys(View.TO_BE_CREATED).sort();
      keys.forEach((key) => {
        const batch = View.TO_BE_CREATED[key];
        if (!batch) {
          return;
        }
        while (batch.length) {
          const action = batch.shift();
          action();
        }
      });
    });
  };

  View.setAttr = function setAttr(viewNode, value, oldValue, name) {
    viewNode.notifyObserver(name, value, oldValue);
    if (value !== null && value !== undefined && value !== false) {
      viewNode.node.setAttribute(name, value === true ? '' : value);
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

  /**
   *
   * @param {string|Array} value
   * @return {{propertyKeysPaths: *[], isExpression: boolean, expressionFn: null}}
   */
  View.getBindings = function (value) {
    let allProperties = null;
    let propertyKeyPaths = null;
    let propertyVariables = [];
    let isExpression = false;
    const type = typeof (value);
    let handler = null;

    if (type === 'string') {
      const props = value.match(View.BINDING_SYNTAX_REGEX);
      if (props) {
        allProperties = ['<>' + props[2]];

        if (props[2].indexOf('!') === 0) {
          allProperties = ['<>' + props[2].slice(1)];
          propertyVariables = allProperties;
          isExpression = true;
          handler = (a) => {
            return !a;
          };
        }
      } else {
        allProperties = null;
      }
    } else if (value instanceof Array && typeof value[value.length - 1] === 'function') {
      propertyVariables = value;
      allProperties = value.slice(0);
      handler = allProperties.pop();
      isExpression = true;
    } else if (value instanceof Function && value.watch) {
      propertyVariables = value;
      allProperties = value.watch.slice(0);
      handler = value;
      isExpression = true;
    } else {
      allProperties = null;
    }

    if (allProperties) {
      propertyKeyPaths = allProperties.filter(pkp => {
        return typeof pkp === 'string' && pkp.indexOf('<>') === 0;
      });
    }

    return {
      propertyKeysPaths: propertyKeyPaths ? propertyKeyPaths.map(function (name) {
        return name.replace(/<>/g, '');
      }) : null,
      propertyVariables: propertyVariables,
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

    if (target instanceof G.View.ArrayChange) {
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
    let nestingLevel = 0;
    let parent;
    if (data[property] === undefined) {
      while (temp.__parent__) {
        parent = temp.__parent__;
        if (parent.hasOwnProperty(property)) {
          target = parent;
          break;
        }

        if (nestingLevel++ >= 1000) {
          throw console.error('Maximum nested property lookup has reached `' + property + '`', data);
        }

        temp = parent;
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

  View.createExpressionArgumentsProvider = function (properties, variables) {
    const id = properties.join();

    if (View.EXPRESSION_ARGS_FUNC_CACHE[id]) {
      return View.EXPRESSION_ARGS_FUNC_CACHE[id];
    }

    let functionContent = 'return [';

    let middle = '';
    for (let i = 0, len = variables.length; i < len-1; i++) {
      const variable = variables[i];

      if (typeof variable === 'string' && variable.indexOf('<>') === 0) {
        middle += 'lookUpFn(scope, "' + variable.replace(/<>/g, '') + '"),';
      } else {
        middle += 'vars[' + i + '],';
      }
    }
    // Take care of variables that contain square brackets like '[variable_name]'
    // for the convenience of the programmer
    functionContent += middle.substring(0, middle.length - 1) + ']';

    const func = new Function('lookUpFn, scope, vars', functionContent);
    View.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  View.createExpressionFunction = function (host, handler, scope, properties, vairables) {
    const getExpressionArguments = G.View.createExpressionArgumentsProvider(properties, vairables);

    const fn = function () {
      let args = [];
      try {
        args = getExpressionArguments.call(host, G.View.safePropertyLookup, scope, vairables);
      } catch (ex) {
        console.error('Can\'t find the property: \n' + properties.join('\n'), '\n\nIt is recommended to inject the parent object instead' +
          ' of its property.\n\n', scope, '\n', ex);
      }

      return handler.apply(host, args);
    };

    fn.getArgs = function () {
      return getExpressionArguments.call(host, G.View.safePropertyLookup, scope, properties);
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

    const properties = bindings.propertyKeysPaths;

    // Generate expression arguments
    try {
      bindings.expressionFn = G.View.createExpressionFunction(target, bindings.handler, scope, properties, bindings.propertyVariables);
      return bindings.expressionFn;
    } catch (exception) {
      throw console.error(exception.message + '\n', properties);
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode | Object} target
   * @param {String} targetKeyName
   * @param {Galaxy.View.ReactiveData} hostReactiveData
   * @param {Galaxy.View.ReactiveData} scopeData
   * @param {Object} bindings
   * @param {Galaxy.View.ViewNode | undefined} root
   */
  View.makeBinding = function (target, targetKeyName, hostReactiveData, scopeData, bindings, root) {
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

      if (!hostReactiveData && scopeData && !(scopeData instanceof G.Scope)) {
        if (scopeData.hasOwnProperty('__rd__')) {
          hostReactiveData = scopeData.__rd__;
        } else {
          hostReactiveData = new G.View.ReactiveData(targetKeyName, scopeData, null);
        }
      }
      // When the node belongs to a nested repeat, the scopeData would refer to the for item data
      // But developer should still be able to access root scopeData
      if (propertyKeyPathItems[0] === 'data' && scopeData && scopeData.hasOwnProperty('__rootScopeData__') &&
        propertyKey === 'data') {
        hostReactiveData = null;
      }

      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (propertyKeyPathItems[0] === 'this' && propertyKey === 'this' && root instanceof G.View.ViewNode) {
        propertyKey = propertyKeyPathItems[1];
        bindings.propertyKeysPaths = propertyKeyPathItems.slice(2);
        childPropertyKeyPath = null;
        hostReactiveData = new G.View.ReactiveData('data', root.data);
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
        reactiveData = new G.View.ReactiveData(propertyKey, initValue, hostReactiveData);
      } else if (childPropertyKeyPath) {
        reactiveData = new G.View.ReactiveData(propertyKey, null, hostReactiveData);
      } else if (hostReactiveData) {
        hostReactiveData.addKeyToShadow(propertyKey);
      }

      if (childPropertyKeyPath === null) {
        if (!(target instanceof G.View.ViewNode)) {
          defProp(target, targetKeyName, {
            // set: function (newValue) {
            // console.warn('It is not allowed', parentReactiveData.id, targetKeyName);
            // value[propertyKeyPath] = newValue;
            // },
            get: function ref() {
              if (expressionFn) {
                return expressionFn();
              }

              return hostReactiveData.data[propertyKey];
            },
            enumerable: true,
            configurable: true
          });
        }

        // The parentReactiveData would be empty when the developer is trying to bind to a direct property of Scope
        if (!hostReactiveData && scopeData instanceof G.Scope) {
          // If the propertyKey is referring to some local value then there is no error
          if (target instanceof G.View.ViewNode && target.localPropertyNames.has(propertyKey)) {
            return;
          }

          throw new Error('Binding to Scope direct properties is not allowed.\n' +
            'Try to define your properties on Scope.data.{property_name}\n' + 'path: ' + scopeData.uri.parsedURL + '\nProperty name: `' +
            propertyKey + '`\n');
        }

        hostReactiveData.addNode(target, targetKeyName, propertyKey, expressionFn);
      }

      if (childPropertyKeyPath !== null) {
        View.makeBinding(target, targetKeyName, reactiveData, initValue, {
          propertyKeysPaths: [childPropertyKeyPath],
          propertyVariables: bindings.propertyVariables,
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
    const subjectsClone = cloneSubject ? G.clone(subjects)/*Object.assign({}, subjects)*/ : subjects;

    let parentReactiveData;
    if (!(data instanceof G.Scope)) {
      parentReactiveData = new G.View.ReactiveData('@', data);
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
            // if (path === 'filterOption.UniqueId') {
            //   console.log(rd,data, path);
            // }
            viewNode.finalize.push(() => {
              rd.removeNode(subjectsClone);
            });
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
   * @param {string} key
   * @param scopeData
   */
  View.installReactiveBehavior = function (behavior, node, key, scopeData) {
    const bindTo = node.blueprint[key];
    const matches = behavior.regex ? (typeof (bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;
    const data = behavior.prepare.call(node, matches, scopeData);
    if (data !== undefined) {
      node.cache[key] = data;
    }

    const needValueAssignment = behavior.install.call(node, data);
    return needValueAssignment === undefined || needValueAssignment === null ? true : needValueAssignment;
  };

  View.createSetter = function (viewNode, key, scopeProperty, expression) {
    /**
     *
     * @type {Galaxy.View.BlueprintProperty}
     */
    const property = View.NODE_BLUEPRINT_PROPERTY_MAP[key] || { type: 'attr' };

    if (property.setup && scopeProperty) {
      property.setup(viewNode, scopeProperty, key, expression);
    }

    // if viewNode is virtual, then the expression should be ignored
    if (property.type !== 'reactive' && viewNode.virtual) {
      return View.EMPTY_CALL;
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
    const property = View.NODE_BLUEPRINT_PROPERTY_MAP[attributeName] || { type: 'attr' };

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

    if (scope.element instanceof G.View.ViewNode) {
      _this.container = scope.element;
    } else {
      _this.container = new G.View.ViewNode(null, {
        tag: scope.element
      }, _this);

      _this.container.hasBeenRendered();
    }
  }

  View.prototype = {
    setupRepos: function (repos) {
      this.dataRepos = repos;
    },
    getAnimation: function (id) {
      return new G.View.AnimationMeta(id);
    },
    nextFrame: function (callback) {
      return window.requestAnimationFrame(callback);
    },
    keyframe: {
      /**
       *
       * @param {Function} onComplete
       * @param {string} [sequence]
       * @param {number} [duration=.01]
       * @returns {{animations: {enter: {duration: number, sequence, onComplete}}, tag: string}}
       */
      enter: function (onComplete, sequence, duration) {
        duration = duration || .01;

        return {
          tag: 'comment',
          nodeValue: 'keyframe:enter',
          animations: {
            enter: {
              duration,
              sequence,
              onComplete
            }
          }
        };
      },
      /**
       *
       * @param {Function} onComplete
       * @param {string} [sequence]
       * @param {number} [duration=.01]
       * @returns {{animations: {enter: {duration: number, sequence, onComplete}}, tag: string}}
       */
      leave: function (onComplete, sequence, duration) {
        duration = duration || .01;

        return {
          tag: 'comment',
          nodeValue: 'keyframe:leave',
          animations: {
            leave: {
              duration,
              sequence,
              onComplete
            }
          }
        };
      }
    },
    init: function (blueprint) {
      const _this = this;

      if (_this.config.cleanContainer) {
        _this.container.node.innerHTML = '';
      }

      return this.createNode(blueprint, _this.container, _this.scope, null);
    },
    broadcast: function (event) {
      this.container.broadcast(event);
    },
    /**
     *
     * @param {Object} blueprint
     * @param {Galaxy.View.ViewNode} parent
     * @param {Object} scopeData
     * @param {Node|Element|null} position
     * @param {Node|Element|null} refNode
     * @param {any} nodeData
     * @return {Galaxy.View.ViewNode}
     */
    createNode: function (blueprint, parent, scopeData, position, refNode, nodeData) {
      const _this = this;
      let i = 0, len = 0;
      if (typeof blueprint === 'string') {
        const content = document.createElement('div');
        content.innerHTML = blueprint;
        const nodes = Array.prototype.slice.call(content.childNodes);
        nodes.forEach(function (node) {
          parent.node.appendChild(node);
        });
      } else if (typeof blueprint === 'function') {
        blueprint();
      } else if (blueprint instanceof Array) {
        for (i = 0, len = blueprint.length; i < len; i++) {
          _this.createNode(blueprint[i], parent, scopeData, null, refNode, nodeData);
        }
      } else if (blueprint instanceof Object) {
        let attributeValue, attributeName;
        const keys = Object.keys(blueprint);
        const needInitKeys = [];
        const viewNode = new G.View.ViewNode(parent, blueprint, refNode, _this, nodeData);
        parent.registerChild(viewNode, position);
        // Behaviors installation stage
        for (i = 0, len = keys.length; i < len; i++) {
          attributeName = keys[i];
          const behavior = View.REACTIVE_BEHAVIORS[attributeName];
          if (behavior) {
            const needValueAssign = View.installReactiveBehavior(behavior, viewNode, attributeName, scopeData);
            if (!needValueAssign) {
              continue;
            }
          }

          needInitKeys.push(attributeName);
        }

        // Value assignment stage
        for (i = 0, len = needInitKeys.length; i < len; i++) {
          attributeName = needInitKeys[i];
          if (attributeName === 'children') continue;

          attributeValue = blueprint[attributeName];
          const bindings = View.getBindings(attributeValue);
          if (bindings.propertyKeysPaths) {
            View.makeBinding(viewNode, attributeName, null, scopeData, bindings, viewNode);
          } else {
            View.setPropertyForNode(viewNode, attributeName, attributeValue);
          }
        }

        if (!viewNode.virtual) {
          viewNode.setInDOM(true);
          _this.createNode(blueprint.children, viewNode, scopeData, null, refNode, nodeData);
        }

        return viewNode;
      }
    }
  };

  return View;
})(Galaxy);
