/* global Galaxy, Node */

(function (galaxy) {
  galaxy.registerScopeService('Bindings', Bindings);

  var BINDING_NAME_MAP = {
    html: 'innerHTML',
    class: 'className'
  };

  var PROPERTY_VALUE_PARSERS = {
    className: function (data, node) {
      if (data instanceof Array) {
        return data.join(' ');
      }

      return data;
    }
  };

  var PROPERY_BINDERS = {
    default: function (attributeName, property, parent, nodes) {
      var oldValue = property.el[attributeName];
      var originalValue = parent[property.boundTo];

      Object.defineProperty(parent, property.boundTo, {
        get: function () {
          return oldValue;
        },
        set: function (value) {
          if (value !== oldValue) {
            oldValue = value;

            if (value instanceof Array) {
              arrayValue(value, nodes);
            }
//            attributeName, property, parent, nodes;

//            if (attributeName === 'list') {
//
//              var listData = parent[property.boundTo];
//              var list = [];
//              listData.forEach(function (item) {
//                var data = {};
//                data[property.itemName] = item;
//                property.el.cloneNode(true)
//
//                list.push(bindDataToElement(property.el.cloneNode(true), parent));
//              });
//
//              list.forEach(function (node) {
//                property.placeholder.parentNode.insertBefore(node, property.placeholder);
//              });
// debugger;
//              return;
//            }
           
            setValueForNodes(value, nodes);
          }
        },
        enumerable: true,
        configurable: true
      });
//debugger;
      parent[property.boundTo] = originalValue;
    },
    list: function (attributeName, property, parent, nodes) {

//     var listData =  
      debugger;
    }
  };

  function Bindings(module) {
    var properties = [];

    module.html.forEach(function (node) {
      properties = properties.concat(readProperties(node));
    });

    var binds = {};

    properties.forEach(function (property) {
      makeBinding(property, binds);
    });

    console.log(binds);
    return binds;
  }

  function initBindings(element) {
    var properties = readProperties(element);

    for (var i = 0, len = element.childNodes.length; i < len; i++) {
      var node = element.childNodes[i];
      properties = properties.concat(readProperties(node));
    }

    var binds = {};

    properties.forEach(function (property) {
      makeBinding(property, binds);
    });

    return properties;
  }

  function readProperties(node, scoped) {
    var properties = [];

    if (!node) {
      return properties;
    }

    var children = node.childNodes;

//    if (node.nodeType === Node.ELEMENT_NODE && !node._bindingScope && node.hasAttribute('bind-list')) {
//      node._bindingScope = true;
//      debugger;
//      return initBindings(node);
//    }

    properties = properties.concat(extractProperties(node, scoped));

    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      if (node.childNodes.length) {
        properties = properties.concat(readProperties(node, node.hasAttribute('bind-list')));
      }
    }

    return properties;
  }

  function extractProperties(node, scoped) {
    var attrs = node.attributes || [];
    var properties = [];

    for (var i = 0, len = node.childNodes.length; i < len; i++) {
      var textNode = node.childNodes[i];
      if (textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent.replace(/\[\[\s*([^\[\]\s]*)\s*\]\]/, function (matches, value) {
          properties.push({
            scope: scoped,
            el: textNode,
            name: 'textContent',
            boundTo: value
          });

          return null;
        });
      }
    }


    for (i = 0, len = attrs.length; i < len; i++) {
      var attr = attrs[i];

      if (attr.name.indexOf('bind-') === 0) {
        properties.push({
          el: attr.ownerElement,
          name: attr.name.substring(5),
          boundTo: attr.value.replace(/\(|\)/g, '')
        });

        attr.ownerElement.removeAttribute(attr.name);
      }
    }

    return properties;
  }

  function makeBinding(property, parent) {
    var boundTo = property.boundTo.split(/\s+/g);
    var variableName = boundTo.pop();
    var dotIndex = variableName.indexOf('.');
    var childName = variableName.substring(0, dotIndex);

    if (dotIndex !== -1 && childName) {
      var childObject = parent[childName] || {};
      parent[childName] = childObject;

      property.boundTo = variableName.substring(dotIndex + 1);

      return makeBinding(property, childObject);
    } else {
      if (property.name === 'list') {
        property.itemName = boundTo[0];
        property.placeholder = document.createComment('list');
        property.el.parentNode.insertBefore(property.placeholder, property.el);
        property.el.parentNode.removeChild(property.el);
      }
      property.boundTo = variableName;

//      makeBinding(property, parent);
    }

    applyBinding(property, parent);
  }

  function applyBinding(property, parent) {
    var attributeName = BINDING_NAME_MAP[property.name] || property.name;

    var nodes = parent[property.boundTo + '_nodes'];

    if (nodes) {
      nodes.push({
        el: property.el,
        attr: attributeName
      });
    } else {
      nodes = [
        {
          el: property.el,
          attr: attributeName
        }
      ];

      parent[property.boundTo + '_nodes'] = nodes;
    }

    var binder = PROPERY_BINDERS['default'];
    binder.call(null, attributeName, property, parent, nodes);
  }

  function setValueForNodes(value, nodes) {
    for (var i = 0, len = nodes.length; i < len; i++) {
      var dataParser = PROPERTY_VALUE_PARSERS[nodes[i].attr];
      nodes[i].el[nodes[i].attr] = dataParser ? dataParser.call(null, value) : value;
    }
  }

  function arrayValue(value, nodes) {
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
          setValueForNodes(value, nodes);
        },
        writable: true,
        configurable: true
      });
    });
  }

  function bindDataToElement(element, data) {
    var properties = [];

    for (var i = 0, len = element.childNodes.length; i < len; i++) {
      var node = element.childNodes[i];
      properties = properties.concat(readProperties(node));
    }

    properties.forEach(function (property) {
      makeBinding(property, data);
    });
    debugger;
    return element;
  }

})(Galaxy);