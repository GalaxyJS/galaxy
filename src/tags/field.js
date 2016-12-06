/* global xtag */

(function () {
  var Field = {
    lifecycle: {
      created: function () {
        var element = this;
        var input = this.querySelectorAll('input, textarea, select');
        if (input.length > 1) {
          console.warn('Only one input field is allowed inside system-field', this);
        }

        element.xtag._input = this.querySelectorAll('input, textarea, select')[0];

        element.xtag._label = this.querySelectorAll('label')[0];
        if (element.xtag._label) {
          element.xtag._label.addEventListener('click', element.xtag._input.focus.bind(element.xtag._input));
        }

        if (element.xtag._input) {
          element.setEmptiness();

          element.xtag._input.addEventListener('focus', function () {
            element.setAttribute('focus', '');
            element.setEmptiness();
          });

          element.xtag._input.addEventListener('blur', function () {
            element.removeAttribute('focus');
          });

          element.xtag._input.onchange = function (e) {
            element.setEmptiness();
          };

          element.xtag._input.addEventListener('input', function (e) {
            element.setEmptiness();
          });
        }
      },
      inserted: function () {
        var tag = this;
        tag.xtag.observer = setInterval(function () {
          if (tag.xtag._input.value !== tag.xtag.oldValue) {
            tag.setEmptiness();
            tag.xtag.oldValue = tag.xtag._input.value;
          }
        }, 250);

        tag.setEmptiness();
      },
      removed: function () {
        clearInterval(this.xtag.observer);
      }
    },
    accessors: {
    },
    events: {
    },
    methods: {
      setEmptiness: function () {
        var element = this;

        if (element.xtag._input.value || element.xtag._input.type === 'file') {
          element.removeAttribute('empty');
        } else {
          element.setAttribute('empty', '');
        }
      }
    }
  };

  xtag.register('galaxy-field', Field);
})();