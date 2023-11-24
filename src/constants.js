/**
 *
 * @typedef {Object} Galaxy.View.BlueprintProperty
 * @property {string} [key]
 * @property {'attr'|'prop'|'reactive'|'event'|'none'} [type]
 * @property {Function} [getConfig]
 * @property {Function} [install]
 * @property {Function} [beforeActivate]
 * @property {Function} [getSetter]
 * @property {Function} [update]
 */
/**
 *
 * @type {{[property: string]: Galaxy.View.BlueprintProperty}}
 */
export const NODE_BLUEPRINT_PROPERTY_MAP = {
  tag: {
    type: 'none'
  },
  node: {
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
  html: {
    type: 'prop',
    key: 'innerHTML'
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

// Extracted from MDN
export const VALID_TAG_NAMES = [
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
