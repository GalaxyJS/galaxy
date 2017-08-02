/* global Galaxy, TweenLite, TimelineLite */

(function (G) {
  var ANIMATIONS = {};

  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['animation'] = {
    type: 'custom',
    name: 'animation',
    /**
     *
     * @param {Galaxy.GalaxyView.ViewNode} viewNode
     * @param attr
     * @param config
     * @param scopeData
     */
    handler: function (viewNode, attr, config, scopeData) {
      if (!viewNode.virtual) {
        var enterAnimationConfig = config[':enter'];
        if (enterAnimationConfig) {
          viewNode.sequences[':enter'].next(function (done) {
            if (enterAnimationConfig.sequence) {
              var animationMeta = AnimationMeta.get(enterAnimationConfig.sequence);

              if (enterAnimationConfig.group) {
                animationMeta = animationMeta.getGroup(enterAnimationConfig.group);
              }

              animationMeta.add(viewNode.node, enterAnimationConfig, done);
            } else {
              var to = Object.assign({}, enterAnimationConfig.to || {});
              to.onComplete = done;
              to.clearProps = 'all';
              TweenLite.fromTo(viewNode.node,
                enterAnimationConfig.duration || 0,
                enterAnimationConfig.from || {},
                to);
            }
          });
        }

        var leaveAnimationConfig = config[':leave'];
        if (leaveAnimationConfig) {
          viewNode.sequences[':destroy'].next(function (done) {
            viewNode._destroyed = true;
            done();
          });

          viewNode.sequences[':leave'].next(function (done) {
            if (leaveAnimationConfig.sequence) {
              var animationMeta = AnimationMeta.get(leaveAnimationConfig.sequence);

              // if the animation has order it will be added to the queue according to its order.
              // No order means lowest order
              if (typeof leaveAnimationConfig.order === 'number') {
                if (!animationMeta.queue[leaveAnimationConfig.order]) animationMeta.queue[leaveAnimationConfig.order] = [];

                animationMeta.queue[leaveAnimationConfig.order].push(function () {
                  if (leaveAnimationConfig.group) {
                    animationMeta = animationMeta.getGroup(leaveAnimationConfig.group);
                  }

                  animationMeta.add(viewNode.node, leaveAnimationConfig, done);

                });

                // When viewNode is the one which is destroyed, then run the queue
                // The queue will never run if the destroyed viewNode has the lowest order
                if (viewNode._destroyed) {
                  for (var key in animationMeta.queue) {
                    animationMeta.queue[key].forEach(function (item) {
                      item();
                    });
                  }

                  animationMeta.queue = {};
                  delete viewNode._destroyed;
                }

                return;
              }

              if (leaveAnimationConfig.group) {
                animationMeta = animationMeta.getGroup(leaveAnimationConfig.group);
              }

              animationMeta.add(viewNode.node, leaveAnimationConfig, done);
            } else {
              var to = Object.assign({}, leaveAnimationConfig.to || {});
              to.onComplete = done;
              to.clearProps = 'all';
              TweenLite.fromTo(viewNode.node,
                leaveAnimationConfig.duration || 0,
                leaveAnimationConfig.from || {},
                to);
            }
          });
        }

        // parseAnimationConfig(config);
        // var _class = config['class'];
        // if (_class) {
        //   viewNode.sequences[':class'].next(function (done) {
        //     var classAnimationConfig = _class;
        //     var to = Object.assign({}, {className: classAnimationConfig.to || ''});
        //     to.onComplete = done;
        //     to.clearProps = 'all';
        //
        //     if (classAnimationConfig.sequence) {
        //       var timeline = classAnimationConfig.__timeline__ || new TimelineLite();
        //
        //       timeline.add(TweenLite.fromTo(viewNode.node,
        //         classAnimationConfig.duration || 0,
        //         {
        //           className: classAnimationConfig.from || ''
        //         },
        //         to), classAnimationConfig.position || null);
        //
        //       classAnimationConfig.__timeline__ = timeline;
        //     } else {
        //       TweenLite.fromTo(viewNode.node,
        //         classAnimationConfig.duration || 0,
        //         classAnimationConfig.from || {},
        //         to);
        //     }
        //   });
        //
        // }
      }
    }
  };

  function AnimationMeta() {
    this.timeline = new TimelineLite({
      autoRemoveChildren: true
    });
    this.groups = {};
    this.queue = {};
  }

  AnimationMeta.get = function (name) {
    if (!ANIMATIONS[name]) {
      ANIMATIONS[name] = new AnimationMeta();
    }


    return ANIMATIONS[name];
  };

  AnimationMeta.prototype.getGroup = function (name) {
    if (!this.groups[name]) {
      this.groups[name] = new AnimationMeta();
    }

    if (this.timeline.getChildren().indexOf(this.groups[name].timelin) === -1) {
      this.timeline.add(this.groups[name].timeline);
    }

    return this.groups[name];
  };

  AnimationMeta.prototype.add = function (node, config, onComplete) {
    var to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;
    // to.clearProps = 'all';

    if (this.timeline.getChildren().length > 0) {
      this.timeline.add(TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to), config.position || null);
    } else {
      this.timeline.add(TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to), null);
    }
  };

  function getSequenceTimeline(name) {
    if (!ANIMATIONS[name]) {
      ANIMATIONS[name] = new AnimationMeta();
    }


    return ANIMATIONS[name];
  }

  function parseAnimationConfig(config) {
    for (var key in config) {
      if (config.hasOwnProperty(key)) {
        var groups = key.match(/([^\s]*)\s+to\s+([^\s]*)/);
        console.info(groups);
      }
    }

    return [];
  }

  function getAnimationConfigOf(name, config) {

  }
})(Galaxy);
