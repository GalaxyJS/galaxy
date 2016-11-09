/* global xtag */

(function () {
  var UITemplate = {
    lifecycle: {
      created: function () {
        this.xtag.validate = false;
        this.xtag.show = true;

        if (!this.name) {
          throw "system-ui-view missing the `name` attribute";
        }

        this.xtag.placeholder = document.createComment(' ' + this.module + '/' + this.name + ' ');
      },
      inserted: function () {
        if (this.xtag.validate) {
          this.xtag.originalParent = this.parentNode;
          return;
        }

        this.xtag.originalParent = this.parentNode;
        if (this.xtag.showWhenAdded) {
          this.xtag.showWhenAdded = null;
          this.show();
          return;
        }
      },
      removed: function () {
        this.xtag.validate = false;
      }
    },
    methods: {
      show: function () {
        this.xtag.validate = true;
        this.xtag.shouldBeShown = true;
        if (!this.xtag.originalParent) {
          this.xtag.showAsSoonAsAdded = true;
          return;
        }
        if (this.xtag.placeholder.parentNode)
          this.xtag.originalParent.replaceChild(this, this.xtag.placeholder);
      },
      hide: function () {
        this.xtag.originalParent = this.parentNode;
        this.xtag.originalParent.replaceChild(this.xtag.placeholder, this);
      }
    },
    accessors: {
      name: {
        attribute: {}
      },
      module: {
        attribute: {}
      },
      validate: {
        attribute: {},
        set: function (value) {
          this.xtag.validate = value;
        },
        get: function (value) {
          return this.xtag.validate;
        }
      }
    }
  };

  xtag.register('system-ui-view', UITemplate);
})();