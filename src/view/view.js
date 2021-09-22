/* global Galaxy */
Galaxy.View = /** @class */(function (G) {
  const defProp = Object.defineProperty;
  const objKeys = Object.keys;
  const arrConcat = Array.prototype.concat.bind([]);

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
   * @property {string} [key]
   * @property {'attr'|'prop'|'reactive'} [type]
   * @property {Function} [getConfig]
   * @property {Function} [install]
   * @property {Function} [beforeActivate]
   * @property {Function} [getSetter]
   * @property {Function} [update]
   */

  View.REACTIVE_BEHAVIORS = {};

  View.COMPONENTS = {};
  /**
   *
   * @type {{[property: string]: Galaxy.View.BlueprintProperty}}
   */
  View.NODE_BLUEPRINT_PROPERTY_MAP = {
    tag: {
      type: 'none'
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
      key: 'innerHTML'
    },
    nodeValue: {
      type: 'prop',
    },
    scrollTop: {
      type: 'prop',
    },
    scrollLeft: {
      type: 'prop',
    },
    disabled: {
      type: 'attr',
    },
    onchange: {
      type: 'event'
    },
    onclick: {
      type: 'event'
    },
    ondblclick: {
      type: 'event'
    },
    onmouseover: {
      type: 'event'
    },
    onmouseout: {
      type: 'event'
    },
    onkeydown: {
      type: 'event'
    },
    onkeypress: {
      type: 'event'
    },
    onkeyup: {
      type: 'event'
    },
    onmousedown: {
      type: 'event'
    },
    onmouseup: {
      type: 'event'
    },
    onload: {
      type: 'event'
    },
    onabort: {
      type: 'event'
    },
    onerror: {
      type: 'event'
    },
    onfocus: {
      type: 'event'
    },
    onblur: {
      type: 'event'
    },
    onreset: {
      type: 'event'
    },
    onsubmit: {
      type: 'event'
    },
  };

  View.PROPERTY_SETTERS = {
    'none': function () {
      return View.EMPTY_CALL;
    }
  };

  /**
   *
   * @param {Array<Galaxy.View.ViewNode>} toBeRemoved
   * @param {boolean} hasAnimation
   * @memberOf Galaxy.View
   * @static
   */
  View.DESTROY_NODES = function (toBeRemoved, hasAnimation) {
    let remove = null;

    for (let i = 0, len = toBeRemoved.length; i < len; i++) {
      remove = toBeRemoved[i];
      remove.destroy(hasAnimation);
    }
  };

  // let opt_count = 0;
  // const _next_batch = function (_jump, dirty) {
  //   if (dirty) {
  //     return _jump();
  //   }
  //
  //   if (opt_count > 233) {
  //     opt_count = 0;
  //     // console.log(performance.now());
  //     return requestAnimationFrame(() => {
  //       if (dirty) {
  //         return _jump();
  //       }
  //
  //       if (this.length) {
  //         this.shift()(_next_batch.bind(this, _jump));
  //       } else {
  //         _jump();
  //       }
  //     });
  //   }
  //
  //   opt_count++;
  //   if (this.length) {
  //     this.shift()(_next_batch.bind(this, _jump));
  //   } else {
  //     _jump();
  //   }
  // };

  const dom_manipulation_table = View.DOM_MANIPLATION = {};
  const create_order = [], destroy_order = [];
  let dom_manipulation_order = [];
  let manipulation_done = true, dom_manipulations_dirty = false;
  let diff = 0, preTS = 0, too_many_jumps;

  const next_action = function (_jump, dirty) {
    if (dirty) {
      return _jump();
    }

    if (this.length) {
      this.shift()(next_action.bind(this, _jump));
    } else {
      _jump();
    }
  };

  const next_batch_body = function () {
    if (this.length) {
      let key = this.shift();
      let batch = dom_manipulation_table[key];
      if (!batch.length) {
        return next_batch.call(this);
      }

      next_action.call(batch, next_batch.bind(this), dom_manipulations_dirty);
    } else {
      manipulation_done = true;
      preTS = 0;
      diff = 0;
    }
  };

  const next_batch = function () {
    if (dom_manipulations_dirty) {
      dom_manipulations_dirty = false;
      diff = 0;
      return next_batch.call(dom_manipulation_order);
    }

    const now = performance.now();
    preTS = preTS || now;
    diff = diff + (now - preTS);
    preTS = now;

    if (diff > 3) {
      diff = 0;
      if (too_many_jumps) {
        clearTimeout(too_many_jumps);
        too_many_jumps = null;
      }

      too_many_jumps = setTimeout((ts) => {
        preTS = ts;
        next_batch_body.call(this);
      });
    } else {
      next_batch_body.call(this);
    }
  };

  function comp_asc(a, b) {
    return a > b;
  }

  function comp_desc(a, b) {
    return a < b;
  }

  function binary_search(array, key, _fn) {
    let start = 0;
    let end = array.length - 1;
    let index = 0;

    while (start <= end) {
      let middle = Math.floor((start + end) / 2);
      let midVal = array[middle];

      if (_fn(key, midVal)) {
        // continue searching to the right
        index = start = middle + 1;
      } else {
        // search searching to the left
        index = middle;
        end = middle - 1;
      }
    }

    return index;
  }

  function pos_asc(array, el) {
    if (el < array[0]) {
      return 0;
    }

    if (el > array[array.length - 1]) {
      return array.length;
    }

    return binary_search(array, el, comp_asc);
  }

  function pos_desc(array, el) {
    if (el > array[0]) {
      return 0;
    }

    if (el < array[array.length - 1]) {
      return array.length;
    }

    return binary_search(array, el, comp_desc);
  }

  // View.TO_BE_DESTROYED = {};
  // View.TO_BE_CREATED = {};


  function add_dom_manipulation(index, act, order, search) {
    if (dom_manipulation_table.hasOwnProperty(index)) {
      dom_manipulation_table[index].push(act);
    } else {
      dom_manipulation_table[index] = [act];
      order.splice(search(order, index), 0, index);
    }
  }

  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.DESTROY_IN_NEXT_FRAME = function (index, action) {
    dom_manipulations_dirty = true;
    add_dom_manipulation('!' + index, action, destroy_order, pos_desc);
    update_dom_manipulation_order();
  };

  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.CREATE_IN_NEXT_FRAME = function (index, action) {
    dom_manipulations_dirty = true;
    add_dom_manipulation(index, action, create_order, pos_asc);
    update_dom_manipulation_order();
  };

  let last_dom_manipulation_id;

  function update_dom_manipulation_order() {
    if (last_dom_manipulation_id) {
      clearTimeout(last_dom_manipulation_id);
      last_dom_manipulation_id = null;
    }

    dom_manipulation_order = arrConcat(destroy_order, create_order);
    last_dom_manipulation_id = setTimeout(() => {
      if (manipulation_done) {
        manipulation_done = false;
        next_batch.call(dom_manipulation_order);
      }
    });
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param value
   * @param oldValue
   * @param name
   */
  View.setAttr = function setAttr(viewNode, value, oldValue, name) {
    if (value !== null && value !== undefined && value !== false) {
      viewNode.node.setAttribute(name, value === true ? '' : value);
    } else {
      viewNode.node.removeAttribute(name);
    }
  };

  View.setProp = function setProp(viewNode, value, oldValue, name) {
    viewNode.node[name] = value;
  };

  View.createChildScope = function (parent) {
    let result = {};

    defProp(result, '__parent__', {
      enumerable: false,
      value: parent
    });

    defProp(result, '__scope__', {
      enumerable: false,
      value: parent.__scope__ || parent
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
          handler = (a) => {
            return !a;
          };
          propertyVariables.push(handler);
          isExpression = true;
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
    for (let i = 0, len = variables.length; i < len - 1; i++) {
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
      // When the node belongs to a nested _repeat, the scopeData would refer to the for item data
      // But developer should still be able to access root scopeData
      if (propertyKeyPathItems[0] === 'data' && scopeData && scopeData.hasOwnProperty('__scope__') &&
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
        // if the propertyKey is used for a _repeat reactive property, then we assume its type is Array.
        hostReactiveData.addKeyToShadow(propertyKey, targetKeyName === '_repeat');
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
    const keys = objKeys(subjects);
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
   * @param {string} blueprintKey
   * @param {Galaxy.View.ViewNode} node
   * @param {string} key
   * @param scopeData
   * @return boolean
   */
  View.installPropertyForNode = function (blueprintKey, node, key, scopeData) {
    if (blueprintKey in View.REACTIVE_BEHAVIORS) {
      const reactiveProperty = View.NODE_BLUEPRINT_PROPERTY_MAP[blueprintKey];
      const data = reactiveProperty.getConfig.call(node, scopeData, node.blueprint[key]);
      if (data !== undefined) {
        node.cache[key] = data;
      }

      return reactiveProperty.install.call(node, data);
    }

    return true;
  };

  /**
   *
   * @param viewNode
   * @param {string} propertyKey
   * @param {Galaxy.View.ReactiveData} scopeProperty
   * @param expression
   */
  View.activatePropertyForNode = function (viewNode, propertyKey, scopeProperty, expression) {
    /**
     *
     * @type {Galaxy.View.BlueprintProperty}
     */
    const property = View.NODE_BLUEPRINT_PROPERTY_MAP[propertyKey] || {type: 'attr'};
    property.key = property.key || propertyKey;
    if (typeof property.beforeActivate !== 'undefined') {
      property.beforeActivate(viewNode, scopeProperty, propertyKey, expression);
    }

    viewNode.setters[propertyKey] = View.getPropertySetterForNode(property, viewNode, scopeProperty, expression);
  };

  /**
   *
   * @param {Galaxy.View.BlueprintProperty} blueprintProperty
   * @param {Galaxy.View.ViewNode} viewNode
   * @param [scopeProperty]
   * @param {Function} [expression]
   * @returns {Galaxy.View.EMPTY_CALL|(function())}
   */
  View.getPropertySetterForNode = function (blueprintProperty, viewNode, scopeProperty, expression) {
    // if viewNode is virtual, then the expression should be ignored
    if (blueprintProperty.type !== 'reactive' && viewNode.virtual) {
      return View.EMPTY_CALL;
    }

    // This is the lowest level where the developer can modify the property setter behavior
    // By defining 'createSetter' for the property you can implement your custom functionality for setter
    if (typeof blueprintProperty.getSetter !== 'undefined') {
      return blueprintProperty.getSetter(viewNode, blueprintProperty, blueprintProperty, expression);
    }

    return View.PROPERTY_SETTERS[blueprintProperty.type](viewNode, blueprintProperty, expression);
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {string} propertyKey
   * @param {*} value
   */
  View.setPropertyForNode = function (viewNode, propertyKey, value) {
    const property = View.NODE_BLUEPRINT_PROPERTY_MAP[propertyKey] || {type: 'attr'};
    property.key = property.key || propertyKey;
    // View.getPropertySetterForNode(property, viewNode)(value, null);

    switch (property.type) {
      case 'attr':
      case 'prop':
      case 'reactive':
        View.getPropertySetterForNode(property, viewNode)(value, null);
        break;

      case 'event':
        viewNode.node[propertyKey] = value.bind(viewNode);
        break;
    }
  };

  /**
   *
   * @param {string} key
   * @param blueprint
   * @param {Galaxy.Scope|Object} scopeData
   * @param {Galaxy.View} view
   * @returns {*}
   */
  View.getComponent = function (key, blueprint, scopeData, view) {
    if (key && key in View.COMPONENTS) {
      return View.COMPONENTS[key](blueprint, scopeData, view);
    }

    return blueprint;
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
    _this.config = {
      cleanContainer: false
    };

    if (scope.element instanceof G.View.ViewNode) {
      _this.container = scope.element;
    } else {
      _this.container = new G.View.ViewNode({
        tag: scope.element
      }, null, _this);

      _this.container.hasBeenRendered();
    }
  }

  View.prototype = {
    enterKeyframe: function (onComplete, sequence, duration) {
      if (typeof onComplete === 'string') {
        duration = sequence;
        sequence = onComplete;
        onComplete = View.EMPTY_CALL;
      }

      return {
        tag: 'comment',
        nodeValue: 'keyframe:enter',
        _animations: {
          enter: {
            duration: duration !== undefined ? duration : .01,
            sequence,
            onComplete
          }
        }
      };
    },
    leaveKeyframe: function (onComplete, sequence, duration) {
      return {
        tag: 'comment',
        nodeValue: 'keyframe:leave',
        _animations: {
          enter: {
            duration: duration !== undefined ? duration : .01,
            sequence,
            onComplete
          }
        }
      };
    },
    init: function (blueprint) {
      const _this = this;

      if (_this.config.cleanContainer) {
        _this.container.node.innerHTML = '';
      }

      return this.createNode(blueprint, _this.scope, _this.container, null);
    },
    dispatchEvent: function (event) {
      this.container.dispatchEvent(event);
    },
    /**
     *
     * @param {Object} blueprint
     * @param {Object} scopeData
     * @param {Galaxy.View.ViewNode} parent
     * @param {Node|Element|null} position
     * @return {Galaxy.View.ViewNode|Array<Galaxy.View.ViewNode>}
     */
    createNode: function (blueprint, scopeData, parent, position) {
      const _this = this;
      let i = 0, len = 0;
      if (typeof blueprint === 'string') {
        const content = document.createElement('div');
        content.innerHTML = blueprint;
        const nodes = Array.prototype.slice.call(content.childNodes);
        nodes.forEach(function (node) {
          parent.node.appendChild(node);
        });

        return nodes;
      } else if (typeof blueprint === 'function') {
        return blueprint();
      } else if (blueprint instanceof Array) {
        const result = [];
        for (i = 0, len = blueprint.length; i < len; i++) {
          result.push(_this.createNode(blueprint[i], scopeData, parent, null));
        }

        return result;
      } else if (blueprint instanceof Object) {
        // blueprint = View.getComponent(blueprint.tag, blueprint, scopeData, _this);
        let propertyValue, propertyKey;
        const keys = objKeys(blueprint);
        const needInitKeys = [];
        const viewNode = new G.View.ViewNode(blueprint, parent, _this, scopeData);
        parent.registerChild(viewNode, position);

        // Behaviors installation stage
        for (i = 0, len = keys.length; i < len; i++) {
          propertyKey = keys[i];
          const needValueAssign = View.installPropertyForNode(propertyKey, viewNode, propertyKey, scopeData);
          if (needValueAssign === false) {
            continue;
          }

          needInitKeys.push(propertyKey);
        }

        // Value assignment stage
        for (i = 0, len = needInitKeys.length; i < len; i++) {
          propertyKey = needInitKeys[i];
          if (propertyKey === 'children') continue;

          propertyValue = blueprint[propertyKey];
          const bindings = View.getBindings(propertyValue);
          if (bindings.propertyKeysPaths) {
            View.makeBinding(viewNode, propertyKey, null, scopeData, bindings, viewNode);
          } else {
            View.setPropertyForNode(viewNode, propertyKey, propertyValue);
          }
        }

        if (!viewNode.virtual) {
          viewNode.setInDOM(true);
          if (blueprint.children) {
            _this.createNode(blueprint.children, scopeData, viewNode, null);
          }
        }

        return viewNode;
      } else {
        throw Error('blueprint can not be null');
      }
    }
  };

  return View;
})(Galaxy);
