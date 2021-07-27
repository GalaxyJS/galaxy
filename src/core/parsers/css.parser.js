(function (GMC) {
  GMC.registerParser('text/css', parser);

  const hosts = {};

  function getHostId(id) {
    if (hosts.hasOwnProperty(id)) {
      return hosts[id];
    }
    const index = Object.keys(hosts).length;
    const ids = {
      host: 'gjs-host-' + index,
      content: 'gjs-content-' + index,
    };

    hosts[id] = ids;

    return ids;
  }

  function rulesForCssText(styleContent) {
    const doc = document.implementation.createHTMLDocument(''),
      styleElement = document.createElement('style');

    styleElement.textContent = styleContent;
    // the style will only be parsed once it is added to a document
    doc.body.appendChild(styleElement);

    return styleElement;
  }

  function applyContentAttr(children, ids) {
    if (!(children instanceof Array) && children !== null && children !== undefined) {
      children = [children];
    }

    children.forEach((child) => {
      if (child.tag === 'comment') return;
      child[ids.content] = '';

      if (child.children) {
        applyContentAttr(child.children, ids);
      }
    });
  }

  function parser(content) {
    return {
      imports: [],
      source: async function (Scope) {
        const ids = getHostId(Scope.systemId);
        const cssRules = rulesForCssText(content);
        const hostSuffix = '[' + ids.host + ']';
        // const contentSuffix = '[' + ids.content + ']';
        const parsedCSSRules = [];
        const host = /(:host)/g;
        const selector = /([^\s+>~,]+)/g;
        const selectorReplacer = function (item) {
          if (item === ':host') {
            return item;
          }

          return item /*+ contentSuffix*/;
        };

        Array.prototype.forEach.call(cssRules.sheet.cssRules, function (css) {
          let selectorText = css.selectorText.replace(selector, selectorReplacer);

          css.selectorText = selectorText.replace(host, hostSuffix);
          parsedCSSRules.push(css.cssText);
        });
        const parsedCSSText = parsedCSSRules.join('\n');

        Scope.export = {
          _temp: true,
          tag: 'style',
          type: 'text/css',
          id: Scope.systemId,
          text: parsedCSSText,
          _apply() {
            this.parent.node.setAttribute(ids.host, '');
            const children = this.parent.blueprint.children || [];
            applyContentAttr(children, ids);
          }
        };
      }
    };
  }
})(Galaxy.Module.Content);
