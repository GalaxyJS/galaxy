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
        if (viewNode.virtual || !config) {
          return;
        }

        var enterAnimationConfig = config[':enter'];
        if (enterAnimationConfig) {
          viewNode.sequences[':enter'].next(function (done) {
            if (enterAnimationConfig.sequence) {
              var animationMeta = AnimationMeta.get(enterAnimationConfig.sequence);
              animationMeta.duration = enterAnimationConfig.duration;
              animationMeta.position = enterAnimationConfig.position;
              // if (enterAnimationConfig.group) {
              // animationMeta = animationMeta.getGroup(enterAnimationConfig.group, enterAnimationConfig.duration, enterAnimationConfig.position || '+=0');
              // }

              if (enterAnimationConfig.parent) {
                console.info('gonna set parent', enterAnimationConfig.parent, 'on', enterAnimationConfig.sequence);
                // animationMeta.timeline.pause();
                animationMeta.setParent(AnimationMeta.get(enterAnimationConfig.parent));
              }

              var lastStep = enterAnimationConfig.to || enterAnimationConfig.from;
              lastStep.clearProps = 'all';
              animationMeta.add(viewNode.node, enterAnimationConfig, done);
            } else {
              AnimationMeta.createTween(viewNode.node, enterAnimationConfig, done);
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
              // debugger;
              if (typeof leaveAnimationConfig.order === 'number') {
                animationMeta.addToQueue(leaveAnimationConfig.order, viewNode.node, (function (viewNode, am, conf) {
                  return function () {
                    // if (conf.group) {
                    //   am = am.getGroup(conf.group, conf.duration, conf.position || '+=0');
                    // }
                    if (conf.parent) {
                      am.setParent(AnimationMeta.get(conf.parent));
                    }

                    am.add(viewNode.node, conf, done);
                  };
                })(viewNode, animationMeta, leaveAnimationConfig));

                // When viewNode is the one which is destroyed, then run the queue
                // The queue will never run if the destroyed viewNode has the lowest order
                if (viewNode._destroyed) {
                  var finishImmediately = false;
                  while (animationMeta.parent) {
                    animationMeta = animationMeta.parent;
                  }
                  var queue = animationMeta.queue;

                  for (var key in queue) {
                    var item;
                    for (var i = 0, len = queue[key].length; i < len; i++) {
                      item = queue[key][i];
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
              AnimationMeta.createTween(viewNode.node, leaveAnimationConfig, done);
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
                    var animationMeta = AnimationMeta.get(classAnimationConfig.sequence);

                    if (classAnimationConfig.group) {
                      animationMeta = animationMeta.getGroup(classAnimationConfig.group, classAnimationConfig.duration, classAnimationConfig.position || '+=0');
                    }

                    animationMeta.add(viewNode.node, classAnimationConfig, done);
                  } else {
                    AnimationMeta.createTween(viewNode.node, classAnimationConfig, done);
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
                    var animationMeta = AnimationMeta.get(classAnimationConfig.sequence);

                    if (classAnimationConfig.group) {
                      animationMeta = animationMeta.getGroup(classAnimationConfig.group);
                    }

                    animationMeta.add(viewNode.node, classAnimationConfig, done);
                  } else {
                    AnimationMeta.createTween(viewNode.node, classAnimationConfig, done);
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

    this.timeline.addLabel('beginning', 0);
    this.duration = 0;
    this.position = '+=0';
    this.subSequences = {};
    this.queue = {};
    // this.commands = new Galaxy.GalaxySequence();
    // this.commands.start();
    this.beginOffset = 0;
    this.beginOffset2 = 0;
    this.offset = 0;
    this.parent = null;
  }

  AnimationMeta.ANIMATIONS = {};

  AnimationMeta.get = function (name) {
    if (!AnimationMeta.ANIMATIONS[name]) {
      AnimationMeta.ANIMATIONS[name] = new AnimationMeta();
    }

    return AnimationMeta.ANIMATIONS[name];
  };

  AnimationMeta.parseSequence = function (sequence) {
    return sequence.split('/').filter(Boolean);
  };

  AnimationMeta.createTween = function (node, config, onComplete) {
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

  AnimationMeta.calculateDuration = function (duration, position) {
    var po = position.replace('=', '');
    return duration + Number(po);
  };

  AnimationMeta.prototype.setParent = function (parent) {
    var _this = this;
    _this.parent = parent;
    if (_this.parent.timeline.getChildren().indexOf(_this.timeline) === -1) {
      // console.info('set parent', _this.parent.beginOffset, _this.parent.duration);
      // If parent time line is active then add this time line at the end of the parent item time line
      if (_this.parent.timeline.getChildren().length > 0) {
        var cal = AnimationMeta.calculateDuration(_this.parent.duration, _this.parent.position);
        console.info(_this.parent.beginOffset2)
        _this.parent.beginOffset2 += cal;
        _this.parent.timeline.add(this.timeline, 'beginning+=' + this.parent.beginOffset2);
        _this.parent.timeline.add(function () {
          _this.parent.beginOffset2 -= cal;
        });
        // _this.parent.beginOffset2 += cal;
      } else {
        this.parent.beginOffset += this.parent.duration;
        this.parent.timeline.add(this.timeline, 'beginning');
      }
    }
  };

  AnimationMeta.prototype.getGroup = function (name, duration, position) {
    var _this = this;
    // var group = this.groups[name];
    // if (!group) {
    //   group = this.groups[name] = new AnimationMeta();
    // }

    var group = AnimationMeta.get(name);
    group.parent = _this;
    if (this.timeline.getChildren().indexOf(group.timeline) === -1) {
      // if the parent animation is still running, then add the group time line to the end of the parent animation
      // when and only when the parent time line has reached its end
      // group time line will be paused till the parent time line reaches its end
      var calPosition = AnimationMeta.calculateDuration(duration, position);
      group.offset++;
      _this.timeline.add(group.timeline, 'group+=' + _this.groupPosition);
      _this.timeline.add((function (cp) {
        return function () {
          group.offset--;
          _this.groupPosition -= cp;
        };
      })(calPosition));
      _this.groupPosition += calPosition;
      // if (this.timeline.progress() !== undefined) {
      //   group.timeline.pause();
      //   group.added = true;
      //
      //   _this.timeline.add(function () {
      //     _this.commands.next(function (done) {
      //       _this.timeline.add(group.timeline);
      //       group.added = false;
      //       group.timeline.resume();
      //       done();
      //     });
      //   });
      // }
      // // If the parent time line is not running, then add the group time line to it immediately
      // else {
      //   _this.timeline.add(group.timeline);
      // }
    }


    return group;
  };

  AnimationMeta.prototype.add = function (node, config, onComplete) {
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

    var cal;
    if (this.timeline.getChildren().length > this.offset) {
      cal = AnimationMeta.calculateDuration(config.duration, config.position || '+=0');
      this.beginOffset += cal;
      this.timeline.add(tween, 'beginning+=' + this.beginOffset);
      this.timeline.add(function () {
        this.beginOffset -= cal;
      });

    } else {
      cal = AnimationMeta.calculateDuration(config.duration, config.position || '+=0');
      this.beginOffset += cal;
      this.timeline.add(tween, config.position);
    }
  };

  /**
   *
   * @param {number} order
   * @param {callback} operation
   */
  AnimationMeta.prototype.addToQueue = function (order, node, operation) {
    if (this.parent) {
      return this.parent.addToQueue(order, node, operation);
    }

    if (!this.queue[order]) {
      this.queue[order] = [];
    }

    this.queue[order].push({node: node, operation: operation});
  };
})(Galaxy);
