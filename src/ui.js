/* global Galaxy, TweenLite, Node */

(function (galaxy) {
  galaxy.GalaxyUI = GalaxyUI;
  galaxy.ui = new galaxy.GalaxyUI();

  function GalaxyUI() {
    this.DEFAULTS = {
      animationDuration: 1
    };

    this.COMPONENT_STRUCTURE = {
      el: null,
      events: {},
      on: function (event, handler) {
        this.events[event] = handler;
      },
      trigger: function (event) {
        if (this.events[event])
          this.events[event].apply(this, Array.prototype.slice.call(arguments, 1));
      }
    };

    this.body = document.getElementsByTagName('body')[0];
  }

  GalaxyUI.prototype.utility = {
    viewRegex: /\{\{([^\{\}]*)\}\}/g
  };

  // Simply replace {{key}} with its value in the template string and returns it
  GalaxyUI.prototype.utility.populate = function (template, data) {
    template = template.replace(this.viewRegex, function (match, key) {
      //eval make it possible to reach nested objects
      return eval("data." + key) || "";
    });
    return template;
  };

  GalaxyUI.prototype.utility.hasClass = function (element, className) {
    if (element.classList)
      return  element.classList.contains(className);
    else
      return new RegExp('(^| )' + className + '( |$)', 'gi').test(element.className);
  };

  GalaxyUI.prototype.utility.addClass = function (el, className) {
    if (!el)
      return;

    if (el.classList)
      el.classList.add(className);
    else
      el.className += ' ' + className;
  };

  GalaxyUI.prototype.utility.removeClass = function (el, className) {
    if (!el)
      return;

    if (el.classList)
      el.classList.remove(className);
    else
      el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  };

  GalaxyUI.prototype.utility.toTreeObject = function (element) {
    var jsTree = {
      _: element,
      _children: []
    };
    var indexIndicator = {};
    for (var index in element.childNodes) {
      var node = element.childNodes[index];

      if (node.nodeType === Node.ELEMENT_NODE) {
        var key = node.nodeName.toLowerCase();
        if (indexIndicator[key]) {
          indexIndicator[key]++;
          jsTree[key + '_' + indexIndicator[key]] = galaxy.ui.utility.toTreeObject(node);
        } else {
          indexIndicator[key] = 1;
          jsTree[node.nodeName.toLowerCase()] = galaxy.ui.utility.toTreeObject(node);
        }

        jsTree._children.push(node);
      }
    }

    return jsTree;
  };

  GalaxyUI.prototype.utility.getContentHeight = function (element, withPaddings) {
    var height = 0;
    var logs = [];
    var children = element.children;

    for (var index = 0, length = children.length; index < length; index++) {
      if (children[index].__ui_neutral) {
        continue;
      }

      var cs = window.getComputedStyle(children[index], null);

      if (cs.position === 'absolute') {
        continue;
      }

      //var dimension = children[index].getBoundingClientRect();
      var dimension = children[index].offsetTop + children[index].offsetHeight;
      var marginBottom = parseInt(cs.marginBottom || 0);

      height = dimension + marginBottom > height ? dimension + marginBottom : height;
    }

    if (withPaddings) {
      height += parseInt(window.getComputedStyle(element).paddingBottom || 0);
    }

    return height;
  };

  GalaxyUI.prototype.setContent = function (parent, nodes) {
    var children = Array.prototype.slice.call(parent.childNodes);

    children.forEach(function (child) {
      parent.removeChild(child);
    });

    if (!nodes.hasOwnProperty('length')) {
      nodes = [nodes];
    }

    for (var i = 0, len = nodes.length; i < len; i++) {
      var item = nodes[i];
      parent.appendChild(item);
    }
  };



  GalaxyUI.prototype.clone = function (obj) {
    var target = {};
    for (var i in obj) {
      if (obj.hasOwnProperty(i))
      {
        target[i] = obj[i];
      }
    }
    return target;
  };

  GalaxyUI.prototype.getCenterPoint = function (rect) {
    var pos = document.activeElement.getBoundingClientRect();
    return         {
      left: rect.left + (rect.width / 2),
      top: rect.top + (rect.height / 2)
    };
  };

  GalaxyUI.prototype.animations = {};
}(Galaxy));