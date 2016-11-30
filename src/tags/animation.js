/* global xtag, Galaxy */

(function () {
  GalaxyAnimation = {
    CONFIG: {
      baseDuration: .5,
      staggerDuration: .05
    },
    effects: {}
  };

  var Animation = {
    lifecycle: {
      created: function () {
        var element = this;
        element.xtag.effects = [];
        element.xtag.registeredAnimations = [];
        this.xtag.cachedAnimations = this.getAttribute('effects');
      },
      attributeChanged: function (attrName, oldValue, newValue) {
      },
      inserted: function () {
        if (this.xtag.cachedAnimations && !this.xtag.effects.length) {
          this.setAttribute('effects', this.xtag.cachedAnimations);
          this.xtag.cachedAnimations = null;
          this.prepare();
        }
      },
      removed: function () {
        this.xtag.cachedAnimations = xtag.clone(this.xtag.effects).join(',');
        this.xtag.effects = [];
        this.prepare();
      }
    },
    accessors: {
      effects: {
        attribute: {
        },
        set: function (value) {
          var element = this;
          if (typeof value === 'string') {
            this.xtag.effects = value.split(/[\s,]+/).filter(Boolean);
          } else {
            this.xtag.effects = [];
          }

          element.prepare();
        },
        get: function () {
          return this.xtag.effects;
        }
      }
    },
    events: {
    },
    methods: {
      prepare: function () {
        var element = this;
        this.xtag.effects.forEach(function (item) {
          if (element.xtag.registeredAnimations.indexOf(item) !== -1) {
            return null;
          }

          if (!GalaxyAnimation.effects[item]) {
            return console.warn('spirit animation not found:', item);
          }

          GalaxyAnimation.effects[item].register(element);
          element.xtag.registeredAnimations.push(item);
        });

        this.xtag.registeredAnimations = this.xtag.registeredAnimations.filter(function (item) {
          if (element.xtag.effects.indexOf(item) === -1) {
            GalaxyAnimation.effects[item].deregister(element);
            return false;
          }

          return true;
        });
      }
    }
  };

  xtag.register('galaxy-animation', Animation);
})();