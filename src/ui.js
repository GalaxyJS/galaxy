/* global Galaxy, TweenLite, Node */

(function (galaxy) {
  galaxy.GalaxyUI = GalaxyUI;
  galaxy.ui = new galaxy.GalaxyUI();

  function GalaxyUI () {
  }

  GalaxyUI.prototype.setContent = function (parent, nodes) {
    var parentNode = parent;
    if (typeof parent === 'string') {
      parentNode = document.querySelector(parent);
    }

    if (!parentNode) {
      throw new Error('parent element can not be null: ' + parent +
        '\r\n try to set ui-view on your target element and reference it via Scope.views');
    }

    var children = Array.prototype.slice.call(parentNode.childNodes);
    var tweens = [];
    children.forEach(function (child) {
      tweens = TweenLite.getTweensOf(child);
      tweens.forEach(function (item) {
        item.progress(1);
      });

      parentNode.removeChild(child);
    });

    if (!nodes.hasOwnProperty('length')) {
      nodes = [ nodes ];
    }

    for (var i = 0, len = nodes.length; i < len; i++) {
      var item = nodes[ i ];
      parentNode.appendChild(item);
    }
  };

  GalaxyUI.prototype.clone = function (obj) {
    var target = {};
    for (var i in obj) {
      if (obj.hasOwnProperty(i)) {
        target[ i ] = obj[ i ];
      }
    }
    return target;
  };

  GalaxyUI.prototype.getCenterPoint = function (rect) {
    // var pos = document.activeElement.getBoundingClientRect();
    return {
      left: rect.left + (rect.width / 2),
      top: rect.top + (rect.height / 2)
    };
  };

  // ------ utility ------ //

  GalaxyUI.prototype.utility = {
    layoutPositions: [
      'fixed',
      'absolute',
      'relative'
    ]
  };

  GalaxyUI.prototype.utility.toTreeObject = function (element) {
    var jsTree = {
      _: element,
      _children: []
    };
    var indexIndicator = {};
    for (var index in element.childNodes) {
      var node = element.childNodes[ index ];

      if (node.nodeType === Node.ELEMENT_NODE) {
        var key = node.nodeName.toLowerCase();
        if (indexIndicator[ key ]) {
          indexIndicator[ key ]++;
          jsTree[ key + '_' + indexIndicator[ key ] ] = galaxy.ui.utility.toTreeObject(node);
        } else {
          indexIndicator[ key ] = 1;
          jsTree[ node.nodeName.toLowerCase() ] = galaxy.ui.utility.toTreeObject(node);
        }

        jsTree._children.push(node);
      }
    }

    return jsTree;
  };

  GalaxyUI.prototype.utility.getContentHeight = function (element, withPaddings) {
    var height = 0;
    var children = element.children;
    var elementCSS = window.getComputedStyle(element, null);

    if (GalaxyUI.prototype.utility.layoutPositions.indexOf(elementCSS.position) === -1) {
      element.style.position = 'relative';
    }

    for (var index = 0, length = children.length; index < length; index++) {
      if (children[ index ].__ui_neutral) {
        continue;
      }

      var cs = window.getComputedStyle(children[ index ], null);

      if (cs.position === 'absolute') {
        continue;
      }

      var dimension = children[ index ].offsetTop + children[ index ].offsetHeight;
      var marginBottom = parseInt(cs.marginBottom || 0);

      height = dimension + marginBottom > height ? dimension + marginBottom : height;
    }

    if (withPaddings) {
      height += parseInt(window.getComputedStyle(element).paddingBottom || 0);
    }

    element.style.position = '';

    return height;
  };

  GalaxyUI.prototype.utility.findParent = function (node, name) {
    var parent = node.parentNode;
    if (parent) {
      if (parent.nodeName.toUpperCase() === name.toUpperCase()) {
        return parent;
      }

      return GalaxyUI.prototype.utility.findParent(parent, name);
    }

    return null;
  };

  // ------ animations ------ //
  GalaxyUI.prototype.animations = {};
}(Galaxy));
