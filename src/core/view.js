/* global Galaxy */
Galaxy.View = /** @class */(function (G) {
  const defProp = Object.defineProperty;
  const objKeys = Object.keys;
  const arrConcat = Array.prototype.concat.bind([]);
  // Extracted from MDN
  const validTagNames = [
    'text',
    'comment',
    //
    'a',
    'abbr',
    'acronym',
    'address',
    'applet',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'basefont',
    'bdi',
    'bdo',
    'bgsound',
    'big',
    'blink',
    'blockquote',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'center',
    'cite',
    'code',
    'col',
    'colgroup',
    'content',
    'data',
    'datalist',
    'dd',
    'decorator',
    'del',
    'details',
    'dfn',
    'dir',
    'div',
    'dl',
    'dt',
    'element',
    'em',
    'embed',
    'fieldset',
    'figcaption',
    'figure',
    'font',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'i',
    'iframe',
    'img',
    'input',
    'ins',
    'isindex',
    'kbd',
    'keygen',
    'label',
    'legend',
    'li',
    'link',
    'listing',
    'main',
    'map',
    'mark',
    'marquee',
    'menu',
    'menuitem',
    'meta',
    'meter',
    'nav',
    'nobr',
    'noframes',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'param',
    'plaintext',
    'pre',
    'progress',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'script',
    'section',
    'select',
    'shadow',
    'small',
    'source',
    'spacer',
    'span',
    'strike',
    'strong',
    'style',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'template',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'tt',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
    'xmp'
  ];

  function apply_node_dataset(node, value) {
    if (typeof value === 'object' && value !== null) {
      const stringifyValue = {};
      for (const key in value) {
        const val = value[key];
        if (typeof val === 'object') {
          stringifyValue[key] = JSON.stringify(val);
        } else {
          stringifyValue[key] = val;
        }
      }
      Object.assign(node.dataset, stringifyValue);
    } else {
      node.dataset = null;
    }
  }

  //------------------------------

  Array.prototype.createDataMap = function (keyPropertyName, valuePropertyName) {
    const map = {};
    for (let i = 0, len = this.length; i < len; i++) {
      const item = this[i];
      map[item[keyPropertyName]] = item[valuePropertyName];
    }

    return map;
  };

  View.EMPTY_CALL = function EMPTY_CALL() {
  };

  View.GET_MAX_INDEX = function () {
    return '@' + performance.now();
  };

  View.BINDING_SYNTAX_REGEX = new RegExp('^<([^\\[\\]<>]*)>\\s*([^\\[\\]<>]*)\\s*$|^=\\s*([^\\[\\]<>]*)\\s*$');

  /**
   *
   * @typedef {Object} Galaxy.View.BlueprintProperty
   * @property {string} [key]
   * @property {'attr'|'prop'|'reactive'|'event'} [type]
   * @property {Function} [getConfig]
   * @property {Function} [install]
   * @property {Function} [beforeActivate]
   * @property {Function} [getSetter]
   * @property {Function} [update]
   */

  View.REACTIVE_BEHAVIORS = {
    data: true
  };

  View.COMPONENTS = {};
  /**
   *
   * @type {{[property: string]: Galaxy.View.BlueprintProperty}}
   */
  View.NODE_BLUEPRINT_PROPERTY_MAP = {
    tag: {
      type: 'none'
    },
    props: {
      type: 'none'
    },
    children: {
      type: 'none'
    },
    data_3: {
      type: 'none',
      key: 'data',
    },
    data_8: {
      type: 'none',
      key: 'data',
    },
    // dataset: {
    //   type: 'prop',
    //   update: (vn, value) => {
    //     if (typeof value === 'object' && value !== null) {
    //       Object.assign(vn.node.dataset, value);
    //     } else {
    //       vn.node.dataset = null;
    //     }
    //   }
    // },
    html: {
      type: 'prop',
      key: 'innerHTML'
    },
    data: {
      type: 'reactive',
      key: 'data',
      getConfig: function (scope, value) {
        if (value !== null && (typeof value !== 'object' || value instanceof Array)) {
          throw new Error('data property should be an object with explicits keys:\n' + JSON.stringify(this.blueprint, null, '  '));
        }

        return {
          reactiveData: null,
          subjects: value,
          scope: scope
        };
      },
      install: function (config) {
        if (config.scope.data === config.subjects) {
          throw new Error('It is not allowed to use Scope.data as data value');
        }

        if (!this.blueprint.module) {
          config.reactiveData = G.View.bindSubjectsToData(this, config.subjects, config.scope, true);
          const observer = new G.Observer(config.reactiveData);
          observer.onAll((key, value) => {
            apply_node_dataset(this.node, config.reactiveData);
          });

          return;
        }

        Object.assign(this.data, config.subjects);
        return false;
      },
      update: function (config, value, expression) {
        if (expression) {
          value = expression();
        }

        if (config.subjects === value) {
          value = config.reactiveData;
        }

        apply_node_dataset(this.node, value);
      }
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

  /**
   *
   * @param data
   * @param {string} properties
   * @return {*}
   */
  function safe_property_lookup(data, properties) {
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

    return target === undefined ? null : target;
  }

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

    if (diff > 2) {
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

  function add_dom_manipulation(index, act, order, search) {
    if (dom_manipulation_table.hasOwnProperty(index)) {
      dom_manipulation_table[index].push(act);
    } else {
      dom_manipulation_table[index] = [act];
      order.splice(search(order, index), 0, index);
    }
  }

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

  // function update_on_animation_frame() {
  //   if (last_dom_manipulation_id) {
  //     clearTimeout(last_dom_manipulation_id);
  //     last_dom_manipulation_id = null;
  //   }
  //
  //   dom_manipulation_order = arrConcat(destroy_order, create_order);
  //   last_dom_manipulation_id = setTimeout(() => {
  //     if (manipulation_done) {
  //       manipulation_done = false;
  //       next_batch.call(dom_manipulation_order);
  //     }
  //   });
  // }
  //
  // function update_on_timeout() {
  //   if (last_dom_manipulation_id) {
  //     cancelAnimationFrame(last_dom_manipulation_id);
  //     last_dom_manipulation_id = null;
  //   }
  //
  //   dom_manipulation_order = arrConcat(destroy_order, create_order);
  //   last_dom_manipulation_id = requestAnimationFrame(() => {
  //     if (manipulation_done) {
  //       manipulation_done = false;
  //       next_batch.call(dom_manipulation_order);
  //     }
  //   });
  // }

  /**
   *
   * @param {string} index
   * @param {Function} action
   * @memberOf Galaxy.View
   * @static
   */
  View.DESTROY_IN_NEXT_FRAME = function (index, action) {
    dom_manipulations_dirty = true;
    add_dom_manipulation('<' + index, action, destroy_order, pos_desc);
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
    add_dom_manipulation('>' + index, action, create_order, pos_asc);
    update_dom_manipulation_order();
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

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param value
   * @param name
   */
  View.setAttr = function setAttr(viewNode, value, name) {
    if (value !== null && value !== undefined && value !== false) {
      viewNode.node.setAttribute(name, value === true ? '' : value);
    } else {
      viewNode.node.removeAttribute(name);
    }
  };

  View.setProp = function setProp(viewNode, value, name) {
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

  const arg_default_value = /=\s*'<>(.*)'|=\s*"<>(.*)"/m;
  const function_head = /^\(\s*([^)]+?)\s*\)|^function.*\(\s*([^)]+?)\s*\)/m;
  /**
   *
   * @param {string|Array} value
   * @return {{propertyKeys: *[], isExpression: boolean, expressionFn: null}}
   */
  View.getBindings = function (value) {
    let allProperties = null;
    let propertyKeys = [];
    let propertyValues = [];
    let isExpression = false;
    const valueType = typeof (value);
    let handler = null;

    if (valueType === 'string') {
      const props = value.match(View.BINDING_SYNTAX_REGEX);
      if (props) {
        allProperties = [value];
      }
    } else if (valueType === 'function') {
      const matches = value.toString().match(function_head);
      if (matches) {
        const args = matches[1] || matches [2];
        propertyValues = args.split(',').map(a => {
          const argDef = a.match(arg_default_value);
          return argDef ? '<>' + (argDef[1] || argDef[2]) : undefined;
        });
        allProperties = propertyValues.slice();
        handler = value;
        isExpression = true;
      }
    } else {
      allProperties = null;
    }

    if (allProperties) {
      propertyKeys = allProperties.filter(pkp => {
        return typeof pkp === 'string' && pkp.indexOf('<>') === 0;
      });

      // allProperties.forEach(p => {
      //   if(typeof p === 'string' && p.indexOf('<>') === 0) {
      //     const key = p.replace(/<>/g, '')
      //     propertyKeys.push(p);
      //     propertyValues.push('_prop(scope, "' + key + '")');
      //   } else {
      //     propertyValues.push('_var["' + key + '"]');
      //   }
      // });
    }

    return {
      propertyKeys: propertyKeys ? propertyKeys.map(function (name) {
        return name.replace(/<>/g, '');
      }) : null,
      propertyValues: propertyValues,
      handler: handler,
      isExpression: isExpression,
      expressionFn: null
    };
  };

  View.propertyLookup = function (data, key) {
    key = key.split('.');
    let firstKey = key[0];
    const original = data;
    let target = data;
    let temp = data;
    let nestingLevel = 0;
    let parent;
    if (data[firstKey] === undefined) {
      while (temp.__parent__) {
        parent = temp.__parent__;
        if (parent.hasOwnProperty(firstKey)) {
          target = parent;
          break;
        }

        if (nestingLevel++ >= 1000) {
          throw Error('Maximum nested property lookup has reached `' + firstKey + '`\n' + data);
        }

        temp = parent;
      }

      // if the property is not found in the parents then return the original object as the context
      if (target[firstKey] === undefined) {
        return original;
      }
    }

    return target;
  };

  /**
   *
   * @param data
   * @param absoluteKey
   * @returns {Galaxy.View.ReactiveData}
   */
  View.propertyRDLookup = function (data, absoluteKey) {
    const keys = absoluteKey.split('.');
    const li = keys.length - 1;
    let target = data;
    keys.forEach(function (p, i) {
      target = View.propertyLookup(target, p);

      if (i !== li) {
        if (!target[p]) {
          const rd = target.__rd__.refs.filter(ref => ref.shadow[p])[0];
          target = rd.shadow[p].data;
        } else {
          target = target[p];
        }
      }
    });

    return target.__rd__;
  };

  View.EXPRESSION_ARGS_FUNC_CACHE = {};

  View.createArgumentsProviderFn = function (propertyValues) {
    const id = propertyValues.join();

    if (View.EXPRESSION_ARGS_FUNC_CACHE[id]) {
      return View.EXPRESSION_ARGS_FUNC_CACHE[id];
    }

    let functionContent = 'return [';
    let middle = [];
    for (let i = 0, len = propertyValues.length; i < len; i++) {
      const val = propertyValues[i];
      if (typeof val === 'string') {
        if (val.indexOf('<>this.') === 0) {
          middle.push('_prop(this.data, "' + val.replace('<>this.', '') + '")');
        } else if (val.indexOf('<>') === 0) {
          middle.push('_prop(scope, "' + val.replace(/<>/g, '') + '")');
        }
      } else {
        middle.push('_var[' + i + ']');
      }
    }
    functionContent += middle.join(',') + ']';

    const func = new Function('scope, _prop , _var', functionContent);
    View.EXPRESSION_ARGS_FUNC_CACHE[id] = func;

    return func;
  };

  View.createExpressionFunction = function (host, scope, handler, keys, values) {
    if (!values[0]) {
      if (host instanceof G.View.ViewNode) {
        values[0] = host.data;
      } else {
        values[0] = scope;
      }
    }

    const getExpressionArguments = G.View.createArgumentsProviderFn(values);

    return function () {
      let args = [];
      try {
        args = getExpressionArguments.call(host, scope, safe_property_lookup, values);
      } catch (ex) {
        console.error('Can\'t find the property: \n' + keys.join('\n'), '\n\nIt is recommended to inject the parent object instead' +
          ' of its property.\n\n', scope, '\n', ex);
      }

      return handler.apply(host, args);
    };
  };

  /**
   *
   * @param bindings
   * @param target
   * @param scope
   * @returns {Function|boolean}
   */
  View.getExpressionFn = function (bindings, target, scope) {
    if (!bindings.isExpression) {
      return false;
    }

    if (bindings.expressionFn) {
      return bindings.expressionFn;
    }

    // Generate expression arguments
    try {
      bindings.expressionFn = G.View.createExpressionFunction(target, scope, bindings.handler, bindings.propertyKeys, bindings.propertyValues);
      return bindings.expressionFn;
    } catch (exception) {
      throw Error(exception.message + '\n', bindings.propertyKeys);
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
    const propertyKeys = bindings.propertyKeys;
    const expressionFn = View.getExpressionFn(bindings, root, scopeData);

    let propertyScopeData = scopeData;
    let propertyKey = null;
    let childPropertyKeyPath = null;
    let initValue = null;
    let propertyKeyPathItems = [];
    for (let i = 0, len = propertyKeys.length; i < len; i++) {
      propertyKey = propertyKeys[i];
      childPropertyKeyPath = null;

      propertyKeyPathItems = propertyKey.split('.');
      if (propertyKeyPathItems.length > 1) {
        propertyKey = propertyKeyPathItems[0];
        childPropertyKeyPath = propertyKeyPathItems.slice(1).join('.');
      }

      if (!hostReactiveData && scopeData /*&& !(scopeData instanceof G.Scope)*/) {
        if ('__rd__' in scopeData) {
          hostReactiveData = scopeData.__rd__;
        } else {
          hostReactiveData = new G.View.ReactiveData(null, scopeData, scopeData instanceof Galaxy.Scope ? scopeData.systemId : 'child');
        }
      }
      // When the scopeData is a childScopeData
      // But developer should still be able to access parent/root scopeData
      if (propertyKeyPathItems[0] === 'data' && scopeData && scopeData.hasOwnProperty('__scope__') &&
        propertyKey === 'data') {
        hostReactiveData = null;
      }

      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (propertyKeyPathItems[0] === 'this' && propertyKey === 'this' && root instanceof G.View.ViewNode) {
        propertyKey = propertyKeyPathItems[1];
        bindings.propertyKeys = propertyKeyPathItems.slice(2);
        childPropertyKeyPath = null;
        hostReactiveData = new G.View.ReactiveData('data', root.data, 'this');
        propertyScopeData = View.propertyLookup(root.data, propertyKey);
      } else if (propertyScopeData) {
        // Look for the property host object in scopeData hierarchy
        propertyScopeData = View.propertyLookup(propertyScopeData, propertyKey);
      }

      initValue = propertyScopeData;
      if (propertyScopeData !== null && typeof propertyScopeData === 'object') {
        initValue = propertyScopeData[propertyKey];
      }

      let reactiveData;
      if (initValue instanceof Object) {
        reactiveData = new G.View.ReactiveData(propertyKey, initValue, hostReactiveData || scopeData.__scope__.__rd__);
      } else if (childPropertyKeyPath) {
        reactiveData = new G.View.ReactiveData(propertyKey, null, hostReactiveData);
      } else if (hostReactiveData) {
        // if the propertyKey is used for a repeat reactive property, then we assume its type is Array.
        hostReactiveData.addKeyToShadow(propertyKey, targetKeyName === 'repeat');
      }

      if (childPropertyKeyPath === null) {
        if (!(target instanceof G.View.ViewNode)) {
          defProp(target, targetKeyName, {
            set: function ref_set(newValue) {
              // console.warn('It is not allowed', hostReactiveData, targetKeyName);
              // Not sure about this part
              // This will provide binding to primitive data types as well.
              if (expressionFn) {
                // console.log(newValue, target[targetKeyName], targetKeyName, propertyKey);
                // console.warn('It is not allowed to set value for an expression', targetKeyName, newValue);
                return;
              }

              if (hostReactiveData.data[propertyKey] === newValue) {
                return;
              }

              hostReactiveData.data[propertyKey] = newValue;
            },
            get: function ref_get() {
              if (expressionFn) {
                return expressionFn();
              }

              return hostReactiveData.data[propertyKey];
            },
            enumerable: true,
            configurable: true
          });
        }

        if (hostReactiveData && scopeData instanceof G.Scope) {
          // If the propertyKey is referring to some local value then there is no error
          if (target instanceof G.View.ViewNode && target.localPropertyNames.has(propertyKey)) {
            return;
          }

          // throw new Error('Binding to Scope direct properties is not allowed.\n' +
          //   'Try to define your properties on Scope.data.{property_name}\n' + 'path: ' + scopeData.uri.parsedURL + '\nProperty name: `' +
          //   propertyKey + '`\n');
        }

        hostReactiveData.addNode(target, targetKeyName, propertyKey, expressionFn);
      }

      if (childPropertyKeyPath !== null) {
        View.makeBinding(target, targetKeyName, reactiveData, initValue, Object.assign({}, bindings, { propertyKeys: [childPropertyKeyPath] }), root);
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
    const subjectsClone = cloneSubject ? G.clone(subjects) : subjects;

    let parentReactiveData;
    if (!(data instanceof G.Scope)) {
      parentReactiveData = new G.View.ReactiveData(null, data, 'BSTD');
    }

    for (let i = 0, len = keys.length; i < len; i++) {
      attributeName = keys[i];
      attributeValue = subjectsClone[attributeName];
      const bindings = View.getBindings(attributeValue);
      if (bindings.propertyKeys.length) {
        View.makeBinding(subjectsClone, attributeName, parentReactiveData, data, bindings, viewNode);
        if (viewNode) {
          bindings.propertyKeys.forEach(function (path) {
            try {
              const rd = View.propertyRDLookup(data, path);
              viewNode.finalize.push(() => {
                rd.removeNode(subjectsClone);
              });
            } catch (error) {
              console.error('bindSubjectsToData -> Could not find: ' + path + '\n in', data, error);
            }
          });
        }
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
    const property = View.NODE_BLUEPRINT_PROPERTY_MAP[propertyKey] || { type: 'attr' };
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
    const bpKey = propertyKey + '_' + viewNode.node.nodeType;
    let property = View.NODE_BLUEPRINT_PROPERTY_MAP[bpKey] || View.NODE_BLUEPRINT_PROPERTY_MAP[propertyKey];
    if (!property) {
      property = { type: 'prop' };
      if (!(propertyKey in viewNode.node) && 'setAttribute' in viewNode.node) {
        property = { type: 'attr' };
      }

      View.NODE_BLUEPRINT_PROPERTY_MAP[bpKey] = property;
    }

    property.key = property.key || propertyKey;

    switch (property.type) {
      case 'attr':
      case 'prop':
      case 'reactive':
        View.getPropertySetterForNode(property, viewNode)(value, null);
        break;

      case 'event':
        viewNode.node[propertyKey] = function (event) {
          value.call(viewNode, event, viewNode.data);
        };
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

    if (scope.element instanceof G.View.ViewNode) {
      _this.container = scope.element;
      // Nested views should inherit components from their parent view
      _this._components = Object.assign({}, scope.element.view._components);
    } else {
      _this.container = new G.View.ViewNode({
        tag: scope.element
      }, null, _this);

      _this.container.setInDOM(true);
    }
  }

  View.prototype = {
    _components: {},
    components: function (map) {
      for (const key in map) {
        const comp = map[key];
        if (typeof comp !== 'function') {
          throw new Error('Component must be type of function: ' + key);
        }

        this._components[key] = comp;
      }
    },

    /**
     *
     * @param {string} key
     * @param blueprint
     * @param {Galaxy.Scope|Object} scopeData
     * @returns {*}
     */
    getComponent: function (key, blueprint, scopeData) {
      let componentScope = scopeData;
      let componentBlueprint = blueprint;
      if (key) {
        if (key in this._components) {
          if (blueprint.props && typeof blueprint.props !== 'object') {
            throw new Error('The `props` must be a literal object.');
          }

          componentScope = View.createChildScope(scopeData);
          Object.assign(componentScope, blueprint.props || {});

          View.bindSubjectsToData(null, componentScope, scopeData);
          componentBlueprint = this._components[key].call(null, componentScope, blueprint, this);
          if (blueprint instanceof Array) {
            throw new Error('A component\'s blueprint can NOT be an array. A component must have only one root node.');
          }
        } else if (validTagNames.indexOf(key) === -1) {
          console.warn('Invalid component/tag: ' + key);
        }
      }

      return {
        blueprint: Object.assign(blueprint, componentBlueprint),
        scopeData: componentScope
      };
    },

    /**
     *
     * @param {{enter?: AnimationConfig, leave?:AnimationConfig}} animations
     * @returns Blueprint
     */
    addTimeline: function (animations) {
      return {
        tag: 'comment',
        text: 'timeline',
        animations
      };
    },

    enterKeyframe: function (onComplete, timeline, durOrPos) {
      let position = undefined;
      let duration = durOrPos || .01;
      if (typeof timeline === 'number') {
        duration = timeline;
        timeline = null;
      } else if (typeof timeline === 'string') {
        position = durOrPos;
        duration = .01;
      }

      return {
        tag: 'comment',
        text: 'keyframe:enter',
        animations: {
          enter: {
            duration,
            timeline,
            position,
            onComplete
          }
        }
      };
    },
    leaveKeyframe: function (onComplete, timeline, durOrPos) {
      let position = undefined;
      let duration = durOrPos || .01;
      if (typeof timeline === 'number') {
        duration = timeline;
        timeline = null;
      } else if (typeof timeline === 'string') {
        position = durOrPos;
        duration = .01;
      }

      return {
        tag: 'comment',
        text: 'keyframe:leave',
        animations: {
          leave: {
            duration,
            timeline,
            position,
            onComplete
          }
        }
      };
    },
    /**
     *
     * @param {Blueprint|Blueprint[]} blueprint
     * @return {Galaxy.View.ViewNode|Array<Galaxy.View.ViewNode>}
     */
    blueprint: function (blueprint) {
      const _this = this;
      return this.createNode(blueprint, _this.scope, _this.container, null);
    },
    /**
     *
     * @param {boolean} [hasAnimation]
     */
    clean: function (hasAnimation) {
      this.container.clean(hasAnimation);
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
          // parent.node.appendChild(node);
          const viewNode = new G.View.ViewNode({ tag: node }, parent, _this);
          parent.registerChild(viewNode, position);
          node.parentNode.removeChild(node);
          View.setPropertyForNode(viewNode, 'animations', {});
          viewNode.setInDOM(true);
        });

        return nodes;
      } else if (typeof blueprint === 'function') {
        return blueprint.call(_this);
      } else if (blueprint instanceof Array) {
        const result = [];
        for (i = 0, len = blueprint.length; i < len; i++) {
          result.push(_this.createNode(blueprint[i], scopeData, parent, null));
        }

        return result;
      } else if (blueprint instanceof Object) {
        const component = _this.getComponent(blueprint.tag, blueprint, scopeData);
        let propertyValue, propertyKey;
        const keys = objKeys(component.blueprint);
        const needInitKeys = [];
        const viewNode = new G.View.ViewNode(component.blueprint, parent, _this, component.scopeData);
        parent.registerChild(viewNode, position);

        // Behaviors installation stage
        for (i = 0, len = keys.length; i < len; i++) {
          propertyKey = keys[i];
          const needValueAssign = View.installPropertyForNode(propertyKey, viewNode, propertyKey, component.scopeData);
          if (needValueAssign === false) {
            continue;
          }

          needInitKeys.push(propertyKey);
        }

        // Value assignment stage
        for (i = 0, len = needInitKeys.length; i < len; i++) {
          propertyKey = needInitKeys[i];
          if (propertyKey === 'children') continue;

          propertyValue = component.blueprint[propertyKey];
          const bindings = View.getBindings(propertyValue);
          if (bindings.propertyKeys.length) {
            View.makeBinding(viewNode, propertyKey, null, component.scopeData, bindings, viewNode);
          } else {
            View.setPropertyForNode(viewNode, propertyKey, propertyValue);
          }
        }

        if (!viewNode.virtual) {
          viewNode.setInDOM(true);
          if (component.blueprint.children) {
            _this.createNode(component.blueprint.children, component.scopeData, viewNode, null);
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
