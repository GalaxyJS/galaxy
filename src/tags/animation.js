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
//        tag.prepare();
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
        this.xtag.cachedAnimations = this.getAttribute('effects') || '';
      },
      attributeChanged: function (attrName, oldValue, newValue) {
      },
      inserted: function () {
//        console.log(this.xtag.cachedAnimations, !this.xtag.effects.length , !this.__ui_neutral, this);
        if (this.xtag.cachedAnimations && !this.xtag.effects.length && !this.__ui_neutral) {
          this.setAttribute('effects', this.xtag.cachedAnimations);
          this.xtag.cachedAnimations = null;

          this.prepare();
        }        
      },
      removed: function () {
        this.xtag.cachedAnimations = this.getAttribute('effects');
        if (!this.__ui_neutral) {          
          this.xtag.effects = [];
          this.prepare();
        }
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

          var animation = GalaxyAnimation.effects[item].register(element);
          if (!animation) {
            return console.warn('effect registerer should return and object', item, element);
          } else {
            element.xtag.animations[item] = animation;
          }
          element.xtag.registeredAnimations.push(item);
        });
//console.log(element.xtag.effects);
        this.xtag.registeredAnimations = this.xtag.registeredAnimations.filter(function (item) {
          if (element.xtag.effects.indexOf(item) === -1) {
            GalaxyAnimation.effects[item].deregister(element);
            delete element.xtag.animations[item];
            return false;
          }

          return true;
        });
      }
    }
  };

  xtag.register('galaxy-animation', Animation);
})();