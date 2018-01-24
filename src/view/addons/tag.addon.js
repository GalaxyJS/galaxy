/* global Galaxy */

(function (G) {

  const elements = [
    // Content sectioning
    'address',
    'article',
    'aside',
    'footer',
    'header',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hgroup',
    'nav',
    'section',
    // Text content
    'blockquote',
    'div',
    'li',
    'main',
    'ol',
    'p',
    'pre',
    'ul',
    // Inline text semantics
    'a',
    'br',
    'code',
    'span',
    'strong',
    'time',
    // Image and multimedia
    'area',
    'audio',
    'img',
    'map',
    'track',
    'video',
    // Embedded content
    'object',
    'param',
    // Table content
    'caption',
    'col',
    'colgroup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    // Forms
    'button',
    'datalist',
    'fieldset',
    'form',
    'input',
    'label',
    'legend',
    'meter',
    'optgroup',
    'option',
    'output',
    'progress',
    'select',
    'textarea',
    // Interactive elements
    'details',
    'dialog',
    // 'menu',
    // 'menuitem',
    'summary',
    // Web Components
    // 'content',
    // 'element',
    // 'shadow',
    'slot',
    'template'
  ];
  const decorators = [
    // 'accept',
    // 'accept-charset',
    // 'accesskey',
    // 'action',
    // 'alt',
    // 'autocomplete',
    // 'autofocus',
    // 'autoplay',
    // 'buffered',
    // 'challenge',
    // 'charset',
    // 'checked',
    // 'cite',
    // 'cols',
    // 'colspan',
    // 'content',
    // 'contenteditable',
    // 'contextmenu',
    // 'controls',
    // 'coords',
    // 'class',
    // 'crossorigin',
    // 'data',
    // 'datetime',
    // 'default',
    // 'dir',
    // 'dirname',
    // 'disabled',
    // 'download',
    // 'dragable',
    // 'dropzone',
    // 'enctype',
    // 'for',
    // 'form',
    // 'formaction',
    // 'headers',
    // 'hidden',
    // 'high',
    // 'href',
    // 'hreflang',
    // 'href-equiv',
    // 'icon',
    // 'id',
    // 'ismap',
    // 'itemprop',
    // 'keytype',
    // 'kind',
    // 'label',
    // 'lang',
    // 'list',
    // 'loop',
    // 'low',
    // 'max',
    // 'maxlength',
    // 'minlength',
    // 'media',
    // 'method',
    // 'min',
    // 'multiple',
    // 'muted',
    // 'name',
    // 'novalidate',
    // 'open',
    // 'optimum',
    // 'pattern',
    // 'ping',
    // 'placeholder',
    // 'poster',
    // 'period',
    // 'radiogroup',
    // 'readonly',
    // 'rel',
    // 'required',
    // 'reversed',
    // 'rows',
    // 'rowspan',
    // 'sandbox',
    // 'scope',
    // 'scoped',
    // 'seamless',
    // 'selected',
    // 'shape',
    // 'size',
    // 'sizes',
    // 'slot',
    // 'span',
    // 'spellcheck',
    // 'src',
    // 'srcdoc',
    // 'srclang',
    // 'srcset',
    // 'start',
    // 'step',
    // 'style',
    // 'summary',
    // 'tabindex',
    // 'target',
    // 'title',
    // 'type',
    // 'translate',
    // 'text',
    // 'usemap',
    // 'value',
    // 'wrap',
    // 'html'
    'type',
    'text',
    'html',
    'value',
    'checked',
    'disabled',
    'id',
    'title',
    'translate',
    'dir',
    'lang',
    'spellcheck',
    'draggable',
    'dropzone',
    'hidden',
    'accesskey',
    'tabindex',
    'lifecycle',
    'inputs',
    'for',
    'if'
  ];

  function Tag(tag) {
    const _this = this;
    _this.tag = tag;

  }

  Object.defineProperty(Tag.prototype, '_decorate', {
    value: function (id, value) {
      if (value === undefined) {
        Reflect.deleteProperty(this, id);

        return this;
      }

      this[id] = value;

      return this;
    },
    enumerable: false
  });

  Object.defineProperty(Tag.prototype, '_attr', {
    value: function (id, value) {
      if (value === undefined) {
        Reflect.deleteProperty(this, id);

        return this;
      }

      this[id] = value;

      return this;
    },
    enumerable: false
  });

  Object.defineProperty(Tag.prototype, 'class', {
    value: function (value) {
      return this._decorate('class', value);
    },
    enumerable: false,
    writable: true
  });

  Object.defineProperty(Tag.prototype, 'css', {
    value: function (value) {
      return this._decorate('style', value);
    },
    enumerable: false
  });

  Object.defineProperty(Tag.prototype, 'onEvent', {
    value: function (event, handler) {
      this.on = this.on || {};

      this.on[event] = handler;

      return this;
    },
    enumerable: false
  });

  decorators.forEach(function (decorator) {
    Object.defineProperty(Tag.prototype, decorator, {
      value: function (value) {
        return this._decorate(decorator, value);
      },
      enumerable: false,
      writable: true
    });
  });

  elements.forEach(function (element) {
    Tag[element] = function (text) {
      const tag = new Tag(element);

      if (text) {
        tag.text(text);
      }

      return tag;
    };
  });

  G.registerAddOnProvider('galaxy/tag', function (scope) {
    return {
      create: function () {
        return Tag;
      },
      finalize: function () {

      }
    };
  });
})(Galaxy);
