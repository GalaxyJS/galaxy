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
