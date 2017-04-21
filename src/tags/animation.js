/* global xtag, Galaxy */

(function () {
  GalaxyAnimation = {
    CONFIG: {
      baseDuration: .5,
      staggerDuration: .05
    },
    effects: {},
    sequences: {},
    disable: function (element) {
      var tags = element.getElementsByTagName('galaxy-animation');
      Array.prototype.forEach.call(tags, function (tag) {
        tag.__ui_neutral = true;
      });
    },
    enable: function (element) {
      var tags = element.getElementsByTagName('galaxy-animation');
      Array.prototype.forEach.call(tags, function (tag) {
        tag.__ui_neutral = false;
        delete tag.__ui_neutral;
      });
    }
  };

  var Animation = {
    lifecycle: {
      created: function () {
        var element = this;
        element.xtag.animations = {};
        element.xtag.effects = [];
        element.xtag.registeredAnimations = [];
      },
      inserted: function () {
        this.xtag.effects = this.getAttribute('effects').split(/[\s,]+/).filter(Boolean);
        if (this.xtag.effects.length && !this.__ui_neutral) {
          this.prepare();
        }
      },
      removed: function () {
        if (!this.__ui_neutral) {
          this.xtag.effects = [];
          this.prepare();
        }
      }
    },
    accessors: {
      effects: {
        attribute: {},
        set: function (value, oldValue) {
          if (value === oldValue) {
            return;
          }

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
    events: {},
    methods: {
      prepare: function () {
        var element = this;
        this.xtag.effects.forEach(function (item) {
          if (element.xtag.registeredAnimations.indexOf(item) !== -1) {
            return null;
          }

          if (!GalaxyAnimation.effects[ item ]) {
            return console.warn('effect not found:', item);
          }

          var animation = GalaxyAnimation.effects[ item ].install(element);
          if (!animation) {
            return console.warn('effect.install should return and object', item, element);
          } else {
            element.xtag.animations[ item ] = animation;
          }
          element.xtag.registeredAnimations.push(item);
        });

        this.xtag.registeredAnimations = this.xtag.registeredAnimations.filter(function (item) {
          if (element.xtag.effects.indexOf(item) === -1) {
            GalaxyAnimation.effects[ item ].uninstall(element, element.xtag.animations[ item ]);
            delete element.xtag.animations[ item ];
            return false;
          }

          return true;
        });
      }
    }
  };

  xtag.register('galaxy-animation', Animation);
})();
