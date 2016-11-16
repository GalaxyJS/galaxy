/* global Galaxy, Node */

(function (galaxy) {
  galaxy.registerScopeService('Bindings', process);

  function process(module) {
    var data = {};

    var binds = extractBinds(module.html);

    bindToData(binds, data, []);

//    var test = makeBinds(module.html, data, []);
    console.log(data);
//    debugger;
    return data;
  }

  function makeBinds(nodes, data, localvariables) {
    var binds = [];

    for (var i = 0, len = nodes.length; i < len; i++) {
      var node = nodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        var match = node.textContent.match(/\[\[\s*([^\[\]\s]*)\s*\]\]/);
        if (match) {
          binds.push(new Bind(node, data, localvariables));
        }
      } else if (node.nodeType !== Node.COMMENT_NODE) {
        var attrs = node.attributes;
        var shouldBind = false;
        for (var ai = 0, alen = attrs.length; ai < alen; ai++) {
          var attr = attrs[ai];

          if (attr.name.indexOf('bind-') === 0) {
            shouldBind = true;
            break;
          }
        }

        if (shouldBind) {
          binds.push(new Bind(node, data, localvariables));
        }

        if (node.hasAttribute('bind-list') && !node._bindsScope) {
          localvariables = [];
          localvariables.push(node.getAttribute('bind-list').split(/\s+/g)[0]);
          node.removeAttribute('bind-list');
        }

        binds = binds.concat(makeBinds(node.childNodes, data, localvariables));
      }
    }

    return binds;
  }

  function extractBinds(nodes) {
    var binds = [];
    var data = {};

    for (var i = 0, len = nodes.length; i < len; i++) {
      var node = nodes[i];
      /*if (node.nodeType === Node.TEXT_NODE) {
       var match = node.textContent.match(/\[\[\s*([^\[\]\s]*)\s*\]\]/);
       if (match) {
       binds.push(parseBind(node));
       }
       } else */if (node.nodeType === Node.ELEMENT_NODE) {
        var attrs = node.attributes;

        for (var ai = 0, alen = attrs.length; ai < alen; ai++) {
          var attr = attrs[ai];

          if (attr.name.indexOf('bind-') === 0) {
            binds.push(parseBind(attr));
          }
        }

        if (node.hasAttribute('bind-list') && !node._bindsScope) {
          node._bindsScope = {
            itemName: node.getAttribute('bind-list').split(/\s+/g)[0]
          };
          node.removeAttribute('bind-list');
          continue;
        }

        binds = binds.concat(extractBinds(node.childNodes));
      }
    }

    return binds;
  }

  function parseBind(item) {
    var bind = {};

    if (item.nodeType === Node.TEXT_NODE) {
      item.textContent = item.textContent.replace(/\[\[\s*([^\[\]\s]*)\s*\]\]/, function (matches, value) {

        bind.attr = 'textContent';
        bind.boundTo = value.split('.');
        bind.el = item;

        return '$' + value + '$';
      });

      bind.originalContent = item.textContent;
    } else {
      var value = item.value.split(/\s+/g);
      bind.attr = item.name.substring(5);
      bind.boundTo = (value.pop() || '').split('.');
      bind.itemName = value[0] || null;
      bind.el = item.ownerElement;

      if (bind.attr === 'list') {
        bind.placeholder = document.createComment(' list ');
        bind.el.parentNode.insertBefore(bind.placeholder, bind.el);
        bind.el.parentNode.removeChild(bind.el);
      }
    }

    return bind;
  }

  function bindToData(binds, data, scope) {
    binds.forEach(function (item) {
//      console.log(item, itemName);

      makeBinding(item, data, scope);
    });
  }

  function makeBinding(bind, data, localVariables) {
    var valueName = bind.boundTo[0];

    data._links = data._links || {};
    var links = data._links[valueName] || [];

    if (!data._links[valueName]) {
      data._links[valueName] = links;
    }

    data._links[valueName] = links = links.filter(function (link) {
      return link.delete !== true;
    });

    if (localVariables.indexOf(valueName) !== -1) {
      delete data._links[valueName];
      links = [];
    }
//
    links.push(bind);

    var oldValue = null;
    var originalValue = data[valueName];

//    data._linked = data._linked || {};
//    data._linked[valueName] = true;

    Object.defineProperty(data, valueName, {
      set: function (value) {
        if (value !== oldValue) {
          oldValue = value;
          var links = data._links[valueName];

          if (localVariables.indexOf(valueName) !== -1) {
            links = [bind];
          }

          if (value instanceof Array) {
            arrayValue(links, value, data);
          }
//          debugger
          setPropertiesValue(links, value, data);
        }
      },
      get: function () {
        return oldValue;
      },
      configurable: true,
      enumerable: true
    });

    data[valueName] = originalValue;
  }

  var bindToAttributeMaps = {
    html: 'innerHTML'
  };

  function setPropertiesValue(properties, value, data) {
    properties.forEach(function (property) {
      if (property.attr === 'textContent') {
        property.el['textContent'] = property.originalContent.replace('$' + property.boundTo[0] + '$', value);
      } else if (property.attr === 'list') {
        renderList(property, data);
      } else {
        property.el[bindToAttributeMaps[property.attr] || property.attr] = value;
      }
    });
  }

  function renderList(property, data) {
    var value = data[property.boundTo[0]] || [];
    var list = [];
    var localVariables = [property.itemName];
    var parentNode = property.placeholder.parentNode;

    if (property.childs) {
      property.childs.forEach(function (item) {
        item._links.forEach(function (link) {
          link.delete = true;
        });
        parentNode.removeChild(item);
      });
    }
//    debugger;
    var binds;
    value.forEach(function (item) {
      var node = property.el.cloneNode(true);
//      var listScopeData = {};

//      listScopeData[property.itemName] = item;
      binds = extractBinds([node]);

//      Galaxy.utility.extend(listScopeData, data);
//      listScopeData._links = data._links;
      
      bindToData(binds, data, localVariables);
      data[property.itemName] = item;
      
      node._links = binds;      

      list.push(node);
    });
//    debugger;
    property.childs = list;

    list.forEach(function (node) {
      parentNode.insertBefore(node, property.placeholder);
    });
  }

  function arrayValue(properties, value, data) {
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

    methods.forEach(function (method) {
      var original = arrayProto[method];

      Object.defineProperty(value, method, {
        value: function () {
          original.apply(this, arguments);
          setPropertiesValue(properties, this, data);
        },
        writable: true,
        configurable: true
      });
    });
  }

  /**
   * 
   * @param {type} element
   * @param {type} data
   * @param {type} localVariables
   * @returns {Bind}
   */
  function Bind(element, data, localVariables) {
    this.element = element;
    this.properties = this.getBinds();
    this.data = data;
    this.locals = localVariables || [];

    element._bind = this;


    this.properties.forEach(function (prop) {
      var valueName = prop.boundTo[0];
      if (data._links && data._links[valueName]) {
        if (localVariables.indexOf(valueName) !== -1) {
//          data._links[valueName] = [prop];
        } else {
          var links = data._links[valueName];
          debugger;
          links.push(prop);
        }
      } else {
        data._links = data._links || {};

        data._links[valueName] = data._links[valueName] || [];
        data._links[valueName].push(prop);
//        debugger;
//        makeBinding(prop, data, localVariables);

        Object.defineProperty(data, valueName, {
          set: function (value) {
            if (value !== this['__' + valueName]) {
              this['__' + valueName] = value;
              var links = data._links[valueName];

              if (localVariables.indexOf(valueName) !== -1) {
                links = [prop];
              }

              if (value instanceof Array) {
                arrayValue(links, value, data);
              }
//          debugger
              setPropertiesValue(links, value, data);
            }
          },
          get: function () {
            return this['__' + valueName];
          },
          configurable: true,
          enumerable: true
        });
      }
    });
  }

  Bind.prototype.getBinds = function () {
    var binds = [];
    var element = this.element;

    if (element.nodeType === Node.TEXT_NODE) {
      var match = element.textContent.match(/\[\[\s*([^\[\]\s]*)\s*\]\]/);
      if (match) {
        binds.push(parseBind(element));
      }
    } else {
      var attrs = element.attributes || [];
      for (var i = 0, len = attrs.length; i < len; i++) {
        var attr = attrs[i];

        if (attr.name.indexOf('bind-') === 0) {
          binds.push(parseBind(attr));
        }
      }
    }

//    var nodes = element.childNodes;
//    for (var i = 0, len = nodes.length; i < len; i++) {
//      var node = nodes[i];
//
//      if (node.nodeType === Node.TEXT_NODE) {
//        var match = node.textContent.match(/\[\[\s*([^\[\]\s]*)\s*\]\]/);
//        if (match) {
//          binds.push(parseBind(node));
//        }
//      }
//    }

    return binds;
  };



})(Galaxy);