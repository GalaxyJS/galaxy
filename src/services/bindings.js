/* global Galaxy */

(function (galaxy) {
  galaxy.registerScopeService('Bindings', Bindings);

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

  function readProperties(node) {
    var properties = [];

    if (!node) {
      return properties;
    }

    var children = Array.prototype.slice.call(node.childNodes);

    properties = properties.concat(extractProperties(node));

    children.forEach(function (node) {
      if (node.childNodes.length) {
        properties = properties.concat(readProperties(node));
      }
    });


    return properties;
  }

  function extractProperties(node) {
    var attrs = node.attributes || [];
    var properties = [];

    for (var i = 0, len = attrs.length; i < len; i++) {
      var attr = attrs[i];

      if (attr.name.indexOf('bind-') === 0) {
        properties.push({
          el: attr.ownerElement,
          name: attr.name.substring(5),
          boundTo: attr.value.replace(/\(|\)/g, '')
        });
      }
    }

    return properties;
  }

  var bindingNamesMap = {
    html: 'innerHTML'
  };

  function makeBinding(property, parent) {
    var dotIndex = property.boundTo.indexOf('.');
    var childName = property.boundTo.substring(0, dotIndex);
    if (dotIndex !== -1 && childName) {
      var childObject = parent[childName] || {};
      parent[childName] = childObject;
      property.boundTo = property.boundTo.substring(dotIndex + 1);

      return makeBinding(property, childObject);      
    }

    var propName = bindingNamesMap[property.name] || property.name;
    var oldValue = property.el[propName];
    Object.defineProperty(parent, property.boundTo, {
      get: function () {
        return property.el[propName];
      },
      set: function (value) {
        if (value !== oldValue) {
          property.el[propName] = oldValue = value;
        }
      },
      enumerable: true,
      configurable: true
    });
  }

})(Galaxy);