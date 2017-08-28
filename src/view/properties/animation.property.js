/* global Galaxy, TweenLite, TimelineLite */

(function (G) {
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
    handler: function (viewNode, attr, config, oldConfig, scopeData) {
      viewNode.rendered.then(function () {
        if (viewNode.virtual) {
          return;
        }

        var enterAnimationConfig = config[':enter'];
        if (enterAnimationConfig) {
          viewNode.sequences[':enter'].next(function (done) {
            if (enterAnimationConfig.sequence) {
              var animationMeta = AnimationMeta.GET(enterAnimationConfig.sequence);

              if (enterAnimationConfig.group) {
                animationMeta = animationMeta.getGroup(enterAnimationConfig.group);
              }

              var lastStep = enterAnimationConfig.to || enterAnimationConfig.from;
              lastStep.clearProps = 'all';
              animationMeta.add(viewNode.node, enterAnimationConfig, done);
            } else {
              AnimationMeta.CREATE_TWEEN(viewNode.node, enterAnimationConfig, done);
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
              var animationMeta = AnimationMeta.GET(leaveAnimationConfig.sequence);

              // if the animation has order it will be added to the queue according to its order.
              // No order means lowest order
              if (typeof leaveAnimationConfig.order === 'number') {
                animationMeta.addToQueue(leaveAnimationConfig.order, viewNode.node, function () {
                  if (leaveAnimationConfig.group) {
                    animationMeta = animationMeta.getGroup(leaveAnimationConfig.group);
                  }

                  animationMeta.add(viewNode.node, leaveAnimationConfig, done);
                });

                // When viewNode is the one which is destroyed, then run the queue
                // The queue will never run if the destroyed viewNode has the lowest order
                if (viewNode._destroyed) {
                  var finishImmediately = false;
                  for (var key in animationMeta.queue) {
                    var item;
                    for (var i = 0, len = animationMeta.queue[key].length; i < len; i++) {
                      item = animationMeta.queue[key][i];
                      item.operation();

                      // If the the current queue item.node is the destroyed node, then all the animations in
                      // queue should be ignored
                      if (item.node === viewNode.node) {
                        finishImmediately = true;
                        break;
                      }
                    }

                    if (finishImmediately) break;
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
              AnimationMeta.CREATE_TWEEN(viewNode.node, leaveAnimationConfig, done);
            }
          });
        }

        viewNode.observer.on('class', function (value, oldValue) {
          value.forEach(function (item) {
            if (item && oldValue.indexOf(item) === -1) {
              var _config = config['.' + item];
              if (_config) {
                viewNode.sequences[':class'].next(function (done) {

                  var classAnimationConfig = _config;
                  classAnimationConfig.to = Object.assign({className: '+=' + item || ''}, _config.to || {});

                  if (classAnimationConfig.sequence) {
                    var animationMeta = AnimationMeta.GET(classAnimationConfig.sequence);

                    if (classAnimationConfig.group) {
                      animationMeta = animationMeta.getGroup(classAnimationConfig.group);
                    }

                    animationMeta.add(viewNode.node, classAnimationConfig, done);
                  } else {
                    AnimationMeta.CREATE_TWEEN(viewNode.node, classAnimationConfig, done);
                  }
                });
              }
            }
          });

          oldValue.forEach(function (item) {
            if (item && value.indexOf(item) === -1) {
              var _config = config['.' + item];
              if (_config) {
                viewNode.sequences[':class'].next(function (done) {
                  var classAnimationConfig = _config;
                  classAnimationConfig.to = {className: '-=' + item || ''};

                  if (classAnimationConfig.sequence) {
                    var animationMeta = AnimationMeta.GET(classAnimationConfig.sequence);

                    if (classAnimationConfig.group) {
                      animationMeta = animationMeta.getGroup(classAnimationConfig.group);

                    }

                    animationMeta.add(viewNode.node, classAnimationConfig, done);
                  } else {
                    AnimationMeta.CREATE_TWEEN(viewNode.node, classAnimationConfig, done);
                  }
                });
              }
            }
          });
        });
      });
    }
  };

  function AnimationMeta(onComplete) {
    this.timeline = new TimelineLite({
      autoRemoveChildren: true,
      onComplete: onComplete
    });
    this.groups = {};
    this.queue = {};
    this.commands = new Galaxy.GalaxySequence();
    this.commands.start();
    this.added = false;
  }

  AnimationMeta.ANIMATIONS = {};

  AnimationMeta.GET = function (name) {
    if (!AnimationMeta.ANIMATIONS[name]) {
      AnimationMeta.ANIMATIONS[name] = new AnimationMeta();
    }

    return AnimationMeta.ANIMATIONS[name];
  };

  AnimationMeta.CREATE_TWEEN = function (node, config, onComplete) {
    var to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;
    var tween = null;

    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      var from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      tween = TweenLite.from(node,
        config.duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        config.duration || 0,
        to || {});
    }

    return tween;
  };

  AnimationMeta.prototype.getGroup = function (name) {
    var _this = this;
    var group = this.groups[name];
    if (!group) {
      group = this.groups[name] = new AnimationMeta();
    }

    if (!group.added && this.timeline.getChildren().indexOf(group.timeline) === -1) {
      // if the parent animation is still running, then add the group time line to the end of the parent animation
      // when and only when the parent time line has reached its end
      // group time line will be paused till the parent time line reaches its end
      if (this.timeline.progress() !== undefined) {
        group.timeline.pause();
        group.added = true;

        _this.timeline.add(function () {
          _this.commands.next(function (done) {
            _this.timeline.add(group.timeline);
            group.added = false;
            group.timeline.resume();
            done();
          });
        });
      }
      // If the parent time line is not running, then add the group time line to it immediately
      else {
        _this.timeline.add(group.timeline);
      }
    }


    return group;
  };

  AnimationMeta.prototype.add = function (node, config, onComplete) {
    var to = Object.assign({}, config.to || {});

    var tween = null;
    // var onStart = function () {
    //   console.info(node.offsetParent);
    //   if (node.offsetParent === null) {
    //     tween.progress(1);
    //   }
    // };

    to.onComplete = onComplete;

    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      var from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      tween = TweenLite.from(node,
        config.duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        config.duration || 0,
        to || {});
    }

    if (this.timeline.getChildren().length > 0) {
      this.timeline.add(tween, config.position || null);
    } else {
      this.timeline.add(tween, null);
    }
  };

  /**
   *
   * @param {number} order
   * @param {callback} operation
   */
  AnimationMeta.prototype.addToQueue = function (order, node, operation) {
    if (!this.queue[order]) {
      this.queue[order] = [];
    }

    this.queue[order].push({node: node, operation: operation});
  };
})(Galaxy);
