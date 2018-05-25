/* global xtag */

(function () {
  var Field = {
    prototype: HTMLDivElement.prototype,
    lifecycle: {
      created: function () {
        var element = this;
        element._states = [];

        var input = this.querySelectorAll('input, textarea, select');
        if (input.length > 1) {
          console.warn('Only one input field is allowed inside system-field', this);
        }

        element.xtag._input = this.querySelectorAll('input, textarea, select')[ 0 ];

        element.init();
      },
      inserted: function () {
        var element = this;
        if (!element.xtag._input) {
          element.xtag._input = element.querySelectorAll('input, textarea, select')[ 0 ];
          element.init();
        }

        element.xtag.observer = setInterval(function () {
          if (element.xtag._input && element.xtag._input.value !== element.xtag.oldValue) {
            element.setEmptiness();
            element.xtag.oldValue = element.xtag._input.value;
          }
        }, 250);

        element.setEmptiness();
      },
      removed: function () {
        clearInterval(this.xtag.observer);
      }
    },
    accessors: {},
    events: {},
    methods: {
      init: function () {
        var element = this;
        if (element.xtag._input) {
          element.setEmptiness();

          element.xtag._input.addEventListener('focus', function () {
            element.setState('focus', '');
            element.setEmptiness();
          });

          element.xtag._input.addEventListener('blur', function () {
            element.setState('focus', null);
          });

          element.xtag._input.onchange = function (e) {
            element.setEmptiness();
          };

          element.xtag._input.addEventListener('input', function (e) {
            element.setEmptiness();
          });
        }

        element.xtag._label = this.getElementsByTagName('label')[ 0 ];
        if (element.xtag._label && !element.xtag._label._galaxy_field_onclick) {
          element.xtag._label._galaxy_field_onclick = element.xtag._input.focus.bind(element.xtag._input);
          element.xtag._label.addEventListener('click', element.xtag._label._galaxy_field_onclick);
        }
      },
      setState: function (state, value) {
        var element = this;
        if (value === null) {
          element.removeAttribute(state);
          if (element._states.indexOf(state) !== -1) {
            element._states.splice(element._states.indexOf(state), 1);
          }
        } else {
          element.setAttribute(state, '');
          if (element._states.indexOf(state) === -1) {
            element._states.push(state);
          }
        }
      },
      setEmptiness: function () {
        var element = this;

        if (element.xtag._input.value || element.xtag._input.type === 'file') {
          element.setState('empty', null);
        } else {
          element.setState('empty', '');
        }
      }
    }
  };

  xtag.register('galaxy-field', Field);
})();
