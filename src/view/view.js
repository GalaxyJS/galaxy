/* global Galaxy, Promise */
'use strict';

Galaxy.GalaxyView = /** @class */(function (G) {
  const defineProp = Object.defineProperty;
  const setAttr = Element.prototype.setAttribute;
  const removeAttr = Element.prototype.removeAttribute;

  let setterAndGetter = {
    configurable: true,
    enumerable: false,
    set: null,
    get: null
  };
  let boundPropertyReference = {
    configurable: false,
    writable: true,
    enumerable: true,
    value: null
  };

  GalaxyView.BINDING_SYNTAX_REGEX = new RegExp('^<([^\\[\\]<>]*)>\\s*([^\\[\\]<>]*)\\s*$');
  GalaxyView.BINDING_EXPRESSION_REGEX = new RegExp('(?:["\'][\w\s]*[\'"])|([^\d\s=+\-|&%{}()<>!/]+)', 'g');

  GalaxyView.PORTAL_PROPERTY_IDENTIFIER = '__portal__';

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

  GalaxyView.cleanProperty = function (obj, key) {
    delete obj[key];
  };

  GalaxyView.createMirror = function (obj, forObj) {
    let result = forObj || {};

    defineProp(result, '__parent__', {
      enumerable: false,
      value: obj
    });

    return result;
  };

  GalaxyView.createClone = function (source) {
    let cloned = Galaxy.clone(source);

    GalaxyView.link(source, cloned);

    return cloned;
  };

  GalaxyView.link = function (from, to) {
    // const medium = GalaxyView.getPortal(from);
    // debugger;
    // for (let key in from) {
    //   const refKey = '<>' + key;
    //   if (medium.hasOwnProperty(key)) {
    //     debugger;
    //     // boundPropertyReference.value = from[refKey];
    //     // defineProp(to, refKey, boundPropertyReference);
    //     // defineProp(to, key, Object.getOwnPropertyDescriptor(from, key));
    //   }
    // }
    // debugger;
    defineProp(to, GalaxyView.PORTAL_PROPERTY_IDENTIFIER, {
      writable: true,
      configurable: true,
      enumerable: false,
      value: GalaxyView.getPortal(from)
    });
    // debugger;
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
   * @param host
   * @return {Array<Galaxy.GalaxyView.ReactiveProperty>}
   */
  GalaxyView.getBoundProperties = function (host) {
    const portal = host[GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    return portal ? portal.getPropertiesList() : [];
  };

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
      propertyKeysPaths = value;
      isExpression = true;
    } else {
      propertyKeysPaths = null;
    }

    return {
      modifiers: modifiers,
      propertyKeysPaths: propertyKeysPaths,
      isExpression: isExpression
    };
  };

  GalaxyView.propertyLookup = function (data, property) {
    property = property.split('.')[0];
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

  GalaxyView.exactPropertyLookup = function (data, property) {
    const properties = property.split('.');
    let target = data;
    properties.forEach(function (p) {
      target = GalaxyView.propertyLookup(target, p)[p];
    });

    return target;
  };

  GalaxyView.getPortal = function (host, parent) {
    const portal = host[GalaxyView.PORTAL_PROPERTY_IDENTIFIER] || new GalaxyView.Portal();

    if (parent) {
      portal.addParent(parent);
    }

    if (!host.hasOwnProperty(GalaxyView.PORTAL_PROPERTY_IDENTIFIER)) {
      defineProp(host, GalaxyView.PORTAL_PROPERTY_IDENTIFIER, {
        writable: true,
        configurable: true,
        enumerable: false,
        value: portal
      });
    }

    return portal;
  };

  /**
   *
   * @param {Object|Array} host
   * @param {string} propertyName
   * @param {any} config
   * @returns {Galaxy.GalaxyView.ReactiveProperty}
   */
  GalaxyView.createReactiveProperty = function (host, propertyName, config) {
    const portal = GalaxyView.getPortal(host);
    const referenceName = propertyName;
    let scope = host;
    let reactiveProperty;

    if (config.referencePropertyName) {
      // If referencePropertyName is set and it refers to a value of the type of object
      // then host[propertyName] is going to be the config.scope[referencePropertyName]
      // this means that there will be only one ReactiveProperty for each property and we are going to bind to that
      // through this property
      scope = config.referencePropertyScope;
      const reference = scope[GalaxyView.PORTAL_PROPERTY_IDENTIFIER].props[config.referencePropertyName];
      if (reference.structure || reference.value instanceof Array) {
        reactiveProperty = reference;
      }
    }

    if (!reactiveProperty) {
      reactiveProperty = new GalaxyView.ReactiveProperty(config.expression ? {} : portal, config.alias || propertyName, config.initValue);

      if (config.initValue === null || config.initValue === undefined) {
        const defaultValueStructure = {};
        GalaxyView.getPortal(defaultValueStructure);
        reactiveProperty.setValueStructure(defaultValueStructure);
      } else if (typeof config.initValue === 'object') {
        GalaxyView.getPortal(config.initValue);
        reactiveProperty.setValueStructure(config.initValue);
      }
    }

    portal.setProperty(reactiveProperty, propertyName);

    // Default getter
    let getter = function () {
      const property = this[GalaxyView.PORTAL_PROPERTY_IDENTIFIER].props[referenceName];
      if (property.placeholderFor) {
        return property.placeholderFor;
      }

      return property.value;
    };

    // Default setter
    let setter = function (newValue) {
      const portal = this[GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
      let oldValue = portal.getValueOf(referenceName);
      /** @type {Galaxy.GalaxyView.ReactiveProperty} */
      let referencePortalProperty = portal.props[referenceName];

      if (oldValue === newValue) {
        return;
      }

      // If newValue is an array, then set it through. Binding will be handled by ReactiveProperty
      if (newValue instanceof Array) {
        return referencePortalProperty.setValue(newValue, scope);
      }

      if ((newValue === null || typeof newValue !== 'object') && referencePortalProperty.structure !== null) {
        const oldKeys = Object.keys(referencePortalProperty.structure);
        debugger;
        if (oldValue && oldKeys.length) {
          // let old = referencePortalProperty.structure;
          // console.info(referencePortalProperty.structure.__portal__ === oldValue.__portal__)
          oldKeys.forEach(function (key) {
            oldValue[key] = undefined;
          });

          return referencePortalProperty.setValue(newValue, scope);
        }
        debugger;

      }

      if (newValue !== null && typeof newValue === 'object') {
        const valueStructure = referencePortalProperty.structure;
        debugger;
        if (!valueStructure) {
          return referencePortalProperty.setValue(newValue, scope);
        }

        // If nweValue has no portal, that man it is a new object
        if (!newValue.hasOwnProperty(GalaxyView.PORTAL_PROPERTY_IDENTIFIER)) {
          // RRemove the placeholder for this property because it is no longer valid
          referencePortalProperty.removePlaceholder();
          // debugger;
          const valueStructurePortal = valueStructure[GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
          const newValuePortal = GalaxyView.getPortal(newValue);
          newValuePortal.parents = valueStructurePortal.parents.slice(0);
          const valueStructureProps = valueStructurePortal.props;
          const oldKeys = Object.keys(valueStructureProps);
          // debugger;
          oldKeys.forEach(function (key) {
            // CLone the old property for the newValuePortal
            // if we don't use clone, the changes will muted the original object
            const cloned = valueStructureProps[key].clone(newValuePortal);
            newValuePortal.setProperty(cloned, key);
            cloned.setValue(newValue[key], scope);
            defineProp(newValue, key, Object.getOwnPropertyDescriptor(valueStructure, key));
          });

        } else {
          let valueStructure = referencePortalProperty.structure;
          const valueStructurePortal = valueStructure[GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
          const newValuePortal = newValue[GalaxyView.PORTAL_PROPERTY_IDENTIFIER];

          if (referencePortalProperty.placeholderFor) {
            if (referencePortalProperty.placeholderFor === newValue) {
              debugger;
              return referencePortalProperty.setValue(newValue, scope);
            }
          }

          referencePortalProperty.placeholderFor = newValue;
          const oldKeys = Object.keys(valueStructure);
          oldValue;
          debugger;
          oldKeys.forEach(function (key) {
            // if (referencePortalProperty.value) {
            //   valueStructurePortal.props[key].value = referencePortalProperty.value[key];
            // }
            valueStructure[key] = newValue[key];
          });
          // debugger
        }
      }

      referencePortalProperty.setValue(newValue, scope);
    };

    if (config.expression) {
      getter = function exp() {
        console.info('exp getter', this);
        return config.expression();
      };
      setter = undefined;
    }

    setterAndGetter.enumerable = config.enumerable;
    setterAndGetter.get = getter;
    setterAndGetter.set = setter;
    defineProp(host, propertyName, setterAndGetter);

    return reactiveProperty;
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
   * @param {Galaxy.GalaxyView.ReactiveProperty | String} targetKeyName
   * @param {Object} scopeData
   * @param {Object} bindings
   * @param {number} expressionArgumentsCount
   */
  GalaxyView.makeBinding = function (target, targetKeyName, scopeData, bindings, expressionArgumentsCount) {
    if (typeof scopeData !== 'object') {
      return;
    }

    let valueStructure = scopeData;
    let dataObject = scopeData;
    let propertyKeysPaths = bindings.propertyKeysPaths;
    let expression = bindings.isExpression;

    if (scopeData instanceof GalaxyView.ReactiveProperty) {
      valueStructure = scopeData.structure;
      dataObject = scopeData.value;
    }

    // expression === true means that a expression function is available and should be extracted
    if (expression === true) {
      const handler = propertyKeysPaths.pop();
      // variables = variables.slice(0, variables.length - 1);
      expressionArgumentsCount = propertyKeysPaths.length;
      propertyKeysPaths = propertyKeysPaths.map(function (name) {
        return name.replace(/<>/g, '');
      });

      // Generate expression arguments
      try {
        expression = Galaxy.GalaxyView.createExpressionFunction(target, handler, propertyKeysPaths, dataObject, targetKeyName);
      }
      catch (exception) {
        throw console.error(exception.message + '\n', propertyKeysPaths);
      }
    } else if (!expression) {
      expressionArgumentsCount = 1;
    }

    let propertyKeyPath = null;
    let childPropertyKeyPath = null;
    let initValue = null;
    let aliasPropertyName = false;
    let propertyKeyPathItems = [];

    for (let i = 0, len = propertyKeysPaths.length; i < len; i++) {
      propertyKeyPath = propertyKeysPaths[i];
      childPropertyKeyPath = null;
      aliasPropertyName = false;

      propertyKeyPathItems = propertyKeyPath.split('.');
      if (propertyKeyPathItems.length > 1) {
        propertyKeyPath = propertyKeyPathItems.shift();
        childPropertyKeyPath = propertyKeyPathItems.join('.');
      }

      const dataObjectPortal = GalaxyView.getPortal(valueStructure);

      // If the property name is `this` and its index is zero, then it is pointing to the ViewNode.data property
      if (i === 0 && propertyKeyPath === 'this' && target instanceof Galaxy.GalaxyView.ViewNode) {
        i = 1;
        propertyKeyPath = propertyKeyPathItems.shift();
        childPropertyKeyPath = null;
        aliasPropertyName = 'this.' + propertyKeyPath;
        valueStructure = GalaxyView.propertyLookup(target.data, propertyKeyPath);
      } else {
        valueStructure = GalaxyView.propertyLookup(valueStructure, propertyKeyPath);
      }

      initValue = dataObject ? dataObject[propertyKeyPath] : null;

      let enumerable = true;
      if (propertyKeyPath === 'length' && dataObject instanceof Array) {
        propertyKeyPath = '_length';
        aliasPropertyName = 'length';
        enumerable = false;
      }

      const referenceName = propertyKeyPath;

      /** @type Galaxy.GalaxyView.ReactiveProperty */
      let reactiveProperty = dataObjectPortal.props[referenceName];

      if (typeof reactiveProperty === 'undefined') {
        reactiveProperty =
          GalaxyView.createReactiveProperty(valueStructure, propertyKeyPath, {
            alias: aliasPropertyName,
            enumerable: enumerable,
            initValue: initValue
          });
      }

      if (initValue !== null && typeof initValue === 'object' && !(initValue instanceof Array)) {
        const initValuePortal = GalaxyView.getPortal(initValue, dataObjectPortal.props[propertyKeyPath]);

        for (let key in initValue) {
          if (initValue.hasOwnProperty(key) && !initValuePortal.props.hasOwnProperty(key)) {
            GalaxyView.createReactiveProperty(initValue, key, {
              enumerable: true,
              initValue: initValue[key]
            });
          }
        }
      }

      if (childPropertyKeyPath === null) {
        if (!(target instanceof Galaxy.GalaxyView.ViewNode)) {
          // If referenceName is not null target[targetKeyName] will be dataObject[referenceName]
          // so any operation on target[targetKeyName] will actually happen on dataObject[referenceName]
          GalaxyView.createReactiveProperty(target, targetKeyName, {
            referencePropertyName: referenceName,
            referencePropertyScope: dataObject,
            enumerable: enumerable,
            initValue: initValue,
            expression: expression
          });
        }

        reactiveProperty.addNode(target, targetKeyName, expression);
      }

      if (childPropertyKeyPath !== null) {
        // If initValue is null, then use structure.
        // This makes sure that structure will always correctly represent how the value will be
        GalaxyView.makeBinding(target, targetKeyName, reactiveProperty, {
          propertyKeysPaths: [childPropertyKeyPath],
          isExpression: expression
        }, expressionArgumentsCount);

      }
      // Call init value only on the last variable binding,
      // so the expression with multiple arguments get called only once
      else if (/*typeof dataObject === 'object' &&*/ expressionArgumentsCount === 1) {
        reactiveProperty.initValueFor(target, targetKeyName, initValue, dataObject);
      }
      expressionArgumentsCount--;
    }
  };

  GalaxyView.createBindingStructure = function (propertyKeyPath) {
    let structure = null;
    const items = propertyKeyPath.split('.');

    if (items.length) {
      structure = {};
    }

    let placeholder = structure;
    items.forEach(function (key) {
      placeholder[key] = {};
      placeholder = placeholder[key];
    });

    return structure;
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
      attributeValue = subjectsClone[attributeName];

      let bindings = GalaxyView.getBindings(attributeValue);

      if (bindings.propertyKeysPaths) {
        GalaxyView.makeBinding(subjectsClone, attributeName, data, bindings);
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
        const newValue = property.parser ? property.parser(value, GalaxyView.getBindings(node.schema[property.name])) : value;
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

    if (value['reactive']) {
      return changes;
    }

    const arrayProto = Array.prototype;
    const methods = [
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
    defineProp(value, 'reactive', boundPropertyReference);

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
  GalaxyView.installReactiveBehavior = function (node, key, scopeData) {
    let behavior = GalaxyView.REACTIVE_BEHAVIORS[key];
    let bindTo = node.schema[key];

    if (behavior) {
      // let matches = behavior.regex ? (typeof(bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;

      // node.setters[key] = (function (_behavior, _matches, _scopeData) {
      //   let _cache = {};
      //   if (_behavior.getCache) {
      //     _cache = _behavior.getCache.call(node, _matches, _scopeData);
      //   }

      // return function (vn, value, structure, expression) {
      //   return _behavior.onApply.call(vn, _cache, value, structure, _scopeData, expression);
      // };
      // })(behavior, matches, scopeData);

      const matches = behavior.regex ? (typeof(bindTo) === 'string' ? bindTo.match(behavior.regex) : bindTo) : bindTo;
      const data = behavior.prepareData.call(node, matches, scopeData);
      if (data !== undefined) {
        node.cache[key] = data;
      }

      behavior.install.call(node, data);
    }
  };

  GalaxyView.PROPERTY_SETTERS = {
    'none': function () {
      return function () {

      };
    }
  };

  GalaxyView.createSetter = function (viewNode, attributeName, expression, dataObject) {
    let property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName];

    if (!property) {
      property = {
        type: 'attr'
      };
    }

    if (property.util) {
      property.util(viewNode, attributeName, expression, dataObject);
    }

    // if viewNode is virtual, then the expression should be ignored
    if (property.type !== 'reactive' && viewNode.virtual) {
      return function () { };
    }

    return GalaxyView.PROPERTY_SETTERS[property.type](viewNode, attributeName, property, expression, dataObject);
  };

  GalaxyView.setPropertyForNode = function (viewNode, attributeName, value, scopeData) {
    const property = GalaxyView.NODE_SCHEMA_PROPERTY_MAP[attributeName] || {type: 'attr'};

    switch (property.type) {
      case 'attr':
        GalaxyView.createDefaultSetter(viewNode, attributeName, property.parser)(value, null);
        break;

      case 'prop':
        GalaxyView.createPropertySetter(viewNode, property)(value, null);
        break;

      case 'reactive': {
        const reactiveApply = GalaxyView.createSetter(viewNode, attributeName, null, scopeData);
        viewNode.setters[property.name] = reactiveApply;
        reactiveApply(value, null);
        break;
      }

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
      // make scopeData reactive ready
      // GalaxyView.makeReactiveReady(scopeData);

      let viewNode = new GalaxyView.ViewNode(null, nodeSchema, null, localScope);
      parent.registerChild(viewNode, position);

      // if (nodeSchema['mutator']) {
      //   viewNode.mutator = nodeSchema['mutator'];
      // }

      let keys = Object.keys(nodeSchema);
      let attributeValue, attributeName;

      // Definition stage
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        if (GalaxyView.REACTIVE_BEHAVIORS[attributeName]) {
          GalaxyView.installReactiveBehavior(viewNode, attributeName, scopeData);
        }
      }

      // Value assignment stage
      for (i = 0, len = keys.length; i < len; i++) {
        attributeName = keys[i];
        attributeValue = nodeSchema[attributeName];

        let bindings = GalaxyView.getBindings(attributeValue);

        if (bindings.propertyKeysPaths) {
          GalaxyView.makeBinding(viewNode, attributeName, scopeData, bindings);
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
    _this.config = {
      cleanContainer: false
    };

    if (scope.element instanceof GalaxyView.ViewNode) {
      _this.container = scope.element;
    } else {
      _this.container = new GalaxyView.ViewNode(null, {
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
