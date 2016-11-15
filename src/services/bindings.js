/* global Galaxy, Node */

(function (galaxy) {
  galaxy.registerScopeService('Bindings', process);

  function process(module) {
    var data = {}

    var binds = extractBinds(module.html);

    bindToData(binds, data);
    console.log(data);
    return data;
  }

  function extractBinds(nodes) {
    var binds = [];

    for (var i = 0, len = nodes.length; i < len; i++) {
      var node = nodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.match(/\[\[\s*([^\[\]\s]*)\s*\]\]/)) {
          binds.push(parseBind(node));
        }
      } else {
        var attrs = node.attributes;
        for (var ai = 0, alen = attrs.length; ai < alen; ai++) {
          var attr = attrs[ai];

          if (attr.name.indexOf('bind-') === 0) {
            binds.push(parseBind(attr));
          }
        }

        if (node.hasAttribute('bind-list')) {
          node._binds_scope = {};
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
    }

    return bind;
  }

  function bindToData(binds, data) {
    binds.forEach(function (item) {
      console.log(item);
      makeBinding(item, data);
    });
  }

  function makeBinding(bind, data) {
    var valueName = bind.boundTo[0];

    var scopeData = bind.el._binds_scope;
    var links = data['_links_of_' + valueName] || [];

    if (!data['_links_of_' + valueName]) {
      data['_links_of_' + valueName] = links;
    }

    links.push(bind);

    var oldValue = null;
    var originalValue = data[valueName];

    Object.defineProperty(data, valueName, {
      set: function (value) {
        if (value !== oldValue) {
          oldValue = value;
          if (scopeData) {
            scopeData[valueName] = value;
          } else {
            setPropertiesValue(links, value);
          }
        }
      },
      get: function () {
        return oldValue;
      },
      configurable: true,
      enumerable: true
    });

    if (scopeData) {
      Object.defineProperty(scopeData, valueName, {
        set: function (value) {
          setPropertiesValue(links, value);
        },
        get: function () {
          return oldValue;
        },
        configurable: true,
        enumerable: true
      });
      
      bindToData(extractBinds(bind.el.childNodes), scopeData);      
    }

//    data[valueName] = originalValue;
  }

  function setPropertiesValue(properties, value) {
    properties.forEach(function (property) {
      if (property.attr === 'textContent') {
        property.el['textContent'] = property.originalContent.replace('$' + property.boundTo[0] + '$', value);
      } else if (property.attr === 'list') {
        debugger;
      } else {
        property.el[property.attr] = value;
      }
    });
  }

})(Galaxy);