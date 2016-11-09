(function () {
  var Spirit = {
    lifecycle: {
      created: function () {
        var element = this;
        element.xtag.animations = [];
        element.xtag.registeredAnimations = [];
        this.xtag.cachedAnimations = this.getAttribute('animations');
      },
      attributeChanged: function (attrName, oldValue, newValue) {
      },
      inserted: function () {
        if (this.xtag.cachedAnimations && !this.xtag.animations.length) {
          this.setAttribute('animations', this.xtag.cachedAnimations)
          this.xtag.cachedAnimations = null;
          this.prepare();
        }
      },
      removed: function () {
        this.xtag.cachedAnimations = xtag.clone(this.xtag.animations).join(',');
        this.xtag.animations = [];
        this.prepare();
      }
    },
    accessors: {
      animations: {
        attribute: {
        },
        set: function (value) {
          var element = this;
          if (typeof value === 'string') {
            this.xtag.animations = value.split(/[\s,]+/).filter(Boolean);
          } else {
            this.xtag.animations = [];
          }

          element.prepare();
        },
        get: function () {
          return this.xtag.animations;
        }
      }
    },
    events: {
    },
    methods: {
      prepare: function () {
        var element = this;
        this.xtag.animations.forEach(function (item) {
          if (element.xtag.registeredAnimations.indexOf(item) !== -1) {
            return null;
          }

          if (!Galaxy.spiritAnimations[item]) {
            return console.warn('spirit animation not found:', item);
          }

          Galaxy.spiritAnimations[item].register(element);
          element.xtag.registeredAnimations.push(item);
        });

        this.xtag.registeredAnimations = this.xtag.registeredAnimations.filter(function (item) {
          if (element.xtag.animations.indexOf(item) === -1) {
            Galaxy.spiritAnimations[item].deregister(element);
            return false;
          }

          return true;
        });
      }
    }
  };

  xtag.register('system-spirit', Spirit);
})();