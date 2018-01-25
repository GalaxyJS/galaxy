/* global Galaxy, TweenLite, TimelineLite */
'use strict';

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
      if (viewNode.virtual || !config) {
        return;
      }
      let enterAnimationConfig = config.enter;
      if (enterAnimationConfig) {
        if (enterAnimationConfig.sequence) {
          AnimationMeta.get(enterAnimationConfig.sequence).configs.enter = enterAnimationConfig;
        }

        viewNode.populateEnterSequence = function (sequence) {
          sequence.onTruncate(function () {
            TweenLite.killTweensOf(viewNode.node);

            // if (enterAnimationConfig.sequence && AnimationMeta.ANIMATIONS[enterAnimationConfig.sequence]) {
            //   AnimationMeta.ANIMATIONS[enterAnimationConfig.sequence].lastChildPosition = 0;
            //   AnimationMeta.ANIMATIONS[enterAnimationConfig.sequence].parent = null;
            //   // AnimationMeta.ANIMATIONS[enterAnimationConfig.sequence] = null;
            // }
            //
            // if (enterAnimationConfig.parent && AnimationMeta.ANIMATIONS[enterAnimationConfig.parent]) {
            //   AnimationMeta.ANIMATIONS[enterAnimationConfig.parent].lastChildPosition = 0;
            //   AnimationMeta.ANIMATIONS[enterAnimationConfig.parent].parent = null;
            //   // AnimationMeta.ANIMATIONS[enterAnimationConfig.parent] = null;
            // }
          });

          sequence.next(function (done) {
            viewNode.visible = true;
            if (enterAnimationConfig.sequence) {
              let animationMeta = AnimationMeta.get(enterAnimationConfig.sequence);
              // animationMeta.NODE = viewNode;
              // if(enterAnimationConfig.sequence ==='card')debugger;
              let lastStep = enterAnimationConfig.to || enterAnimationConfig.from;
              lastStep.clearProps = 'all';
              animationMeta.add(viewNode.node, enterAnimationConfig, done);

              // Add to parent should happen after the animation is added to the child
              if (enterAnimationConfig.parent) {
                const parent = AnimationMeta.get(enterAnimationConfig.parent);
                parent.addChild(animationMeta, animationMeta.configs.enter || {}, parent.configs.enter || {});
              }
            } else {
              let lastStep = enterAnimationConfig.to || enterAnimationConfig.from;
              lastStep.clearProps = 'all';
              AnimationMeta.createTween(viewNode.node, enterAnimationConfig, done);
            }
          });
        };
      }

      let leaveAnimationConfig = config.leave;
      if (leaveAnimationConfig) {
        if (leaveAnimationConfig.sequence) {
          AnimationMeta.get(leaveAnimationConfig.sequence).configs.leave = leaveAnimationConfig;
        }

        viewNode.populateLeaveSequence = function (sequence) {
          sequence.onTruncate(function () {
            TweenLite.killTweensOf(viewNode.node);
            // debugger;
            // if (leaveAnimationConfig.sequence && AnimationMeta.ANIMATIONS[leaveAnimationConfig.sequence]) {
            //   AnimationMeta.ANIMATIONS[leaveAnimationConfig.sequence].lastChildPosition = 0;
            //   AnimationMeta.ANIMATIONS[leaveAnimationConfig.sequence].parent = null;
            //   // AnimationMeta.ANIMATIONS[leaveAnimationConfig.sequence] = null;
            // }
            //
            // if (leaveAnimationConfig.parent && AnimationMeta.ANIMATIONS[leaveAnimationConfig.parent]) {
            //   AnimationMeta.ANIMATIONS[leaveAnimationConfig.parent].lastChildPosition = 0;
            //   AnimationMeta.ANIMATIONS[leaveAnimationConfig.parent].parent = null;
            //   // AnimationMeta.ANIMATIONS[leaveAnimationConfig.parent] = null;
            // }
          });

          // debugger;
          // in the case which the viewNode is not visible, then ignore its animation
          if (viewNode.node.offsetWidth === 0 || viewNode.node.offsetHeight === 0) {
            return sequence.next(function (done) {
              done();
            });
          }

          let animationDone;
          const pr = new Promise(function (res) {
            animationDone = res;
          });

          sequence.next((function (promise) {
            return function (done) {
              promise.then(done);
            };
          })(pr));

          if (leaveAnimationConfig.sequence) {
            // in the case which the viewNode is not visible, then ignore its animation
            // if (viewNode.node.offsetWidth === 0 || viewNode.node.offsetHeight === 0) {
            //   return animationDone();
            // }

            const animationMeta = AnimationMeta.get(leaveAnimationConfig.sequence);
            // animationMeta.NODE = viewNode;
            // if (enterAnimationConfig.sequence === 'card') debugger;

            animationMeta.add(viewNode.node, leaveAnimationConfig, animationDone);

            // Add to parent should happen after the animation is added to the child
            if (leaveAnimationConfig.parent) {
              const parent = AnimationMeta.get(leaveAnimationConfig.parent);
              parent.addChild(animationMeta, animationMeta.configs.leave || {}, parent.configs.leave || {});
            }
          } else {
            // let lastStep = leaveAnimationConfig.to || leaveAnimationConfig.from;
            // lastStep.clearProps = 'all';
            AnimationMeta.createTween(viewNode.node, leaveAnimationConfig, animationDone);
          }

          // sequence.next(function (done) {
          //   if (leaveAnimationConfig.sequence) {
          //
          //     // in the case which the viewNode is not visible, then ignore its animation
          //     if (viewNode.node.offsetWidth === 0 || viewNode.node.offsetHeight === 0) {
          //       return done();
          //     }
          //
          //     const animationMeta = AnimationMeta.get(leaveAnimationConfig.sequence);
          //     // animationMeta.NODE = viewNode;
          //     // if (enterAnimationConfig.sequence === 'card') debugger;
          //
          //     animationMeta.add(viewNode.node, leaveAnimationConfig, done);
          //
          //     // Add to parent should happen after the animation is added to the child
          //     if (leaveAnimationConfig.parent) {
          //       const parent = AnimationMeta.get(leaveAnimationConfig.parent);
          //       // debugger;
          //       parent.addChild(animationMeta, animationMeta.configs.leave || {}, parent.configs.leave || {});
          //     }
          //   } else {
          //     // let lastStep = leaveAnimationConfig.to || leaveAnimationConfig.from;
          //     // lastStep.clearProps = 'all';
          //     AnimationMeta.createTween(viewNode.node, leaveAnimationConfig, done);
          //   }
          // });
        };
      }

      viewNode.rendered.then(function () {
        viewNode.observer.on('class', function (value, oldValue) {
          value.forEach(function (item) {
            if (item && oldValue.indexOf(item) === -1) {
              let _config = config['.' + item];
              if (_config) {
                viewNode.sequences[':class'].next(function (done) {
                  let classAnimationConfig = _config;
                  classAnimationConfig.to = Object.assign({className: '+=' + item || ''}, _config.to || {});

                  if (classAnimationConfig.sequence) {
                    let animationMeta = AnimationMeta.get(classAnimationConfig.sequence);

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
              let _config = config['.' + item];
              if (_config) {
                viewNode.sequences[':class'].next(function (done) {
                  let classAnimationConfig = _config;
                  classAnimationConfig.to = {className: '-=' + item || ''};

                  if (classAnimationConfig.sequence) {
                    let animationMeta = AnimationMeta.get(classAnimationConfig.sequence);

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

  function AnimationMeta(name) {
    const _this = this;
    _this.name = name;
    this.timeline = new TimelineLite({
      autoRemoveChildren: true,
      smoothChildTiming: true,
      onComplete: function () {
        _this.lastChildPosition = 0;
        if (_this.parent) {
          _this.parent.timeline.remove(_this.timeline);
        }
      }
    });

    this.timeline.addLabel('beginning', 0);
    // this.duration = 0;
    // this.position = '+=0';
    this.configs = {};
    this.lastChildPosition = 0;
    this.parent = null;
  }

  AnimationMeta.ANIMATIONS = {};
  AnimationMeta.TIMELINES = {};

  AnimationMeta.getTimeline = function (name, onComplete) {
    if (!AnimationMeta.TIMELINES[name]) {
      AnimationMeta.TIMELINES[name] = new TimelineLite({
        autoRemoveChildren: true,
        onComplete: onComplete
      });
    }

    return AnimationMeta.TIMELINES[name];
  };

  AnimationMeta.get = function (name) {
    if (!AnimationMeta.ANIMATIONS[name]) {
      AnimationMeta.ANIMATIONS[name] = new AnimationMeta(name);
    }

    return AnimationMeta.ANIMATIONS[name];
  };

  AnimationMeta.parseSequence = function (sequence) {
    return sequence.split('/').filter(Boolean);
  };

  AnimationMeta.createTween = function (node, config, onComplete) {
    let to = Object.assign({}, config.to || {});

    if (to.onComplete) {
      const userOnComplete = to.onComplete;
      to.onComplete = function () {
        userOnComplete();
        onComplete();
      };
    } else {
      to.onComplete = onComplete;
    }
    let tween = null;

    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});

      if (from.onComplete) {
        const userOnComplete = to.onComplete;
        from.onComplete = function () {
          userOnComplete();
          onComplete();
        };
      } else {
        from.onComplete = onComplete;
      }

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
    let po = position.replace('=', '');
    return ((duration * 10) + (Number(po) * 10)) / 10;
  };

  AnimationMeta.prototype.calculateLastChildPosition = function (duration, position) {
    const calc = AnimationMeta.calculateDuration(duration, position || '+=0');
    const lcp = (this.lastChildPosition * 10);
    const c = (calc * 10);
    this.lastChildPosition = (lcp + c) / 10;

  };

  AnimationMeta.prototype.addChild = function (child, childConf, parentConf) {
    const _this = this;
    child.parent = _this;

    const children = this.timeline.getChildren(false);

    if (children.indexOf(child.timeline) === -1) {
      if (_this.timeline.getChildren(false, true, false).length === 0) {
        // _this.calculateLastChildPosition(parentConf.duration);
        _this.timeline.add(child.timeline, 0);
      } else {
        // debugger
        // _this.calculateLastChildPosition(childConf.duration, childConf.position);
        // _this.calculateLastChildPosition(childConf.duration, childConf.chainToParent ? childConf.position : null);
        _this.lastChildPosition = AnimationMeta.calculateDuration(_this.lastChildPosition, childConf.chainToParent ? childConf.position : '+=0');
        _this.timeline.add(child.timeline, _this.lastChildPosition);
      }
    } else {
      _this.calculateLastChildPosition(childConf.duration, childConf.chainToParent ? childConf.position : null);
    }
  };

  AnimationMeta.prototype.add = function (node, config, onComplete) {
    const _this = this;
    let to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;

    let tween = null;
    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      tween = TweenLite.from(node,
        config.duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        config.duration || 0,
        to || {});
    }

    // First animation in the timeline should always start at zero
    if (this.timeline.getChildren(false, true, false).length === 0) {
      // let a = this.timeline.getChildren(true, true, true);
      // debugger;
      // _this.lastChildPosition = 0;
      let progress = _this.timeline.progress();
      _this.timeline.add(tween, _this.lastChildPosition);
      // debugger;
      if (!progress) {
        _this.timeline.play(0);
      }
      _this.calculateLastChildPosition(config.duration, config.position);
    } else {
      // debugger;
      _this.timeline.add(tween, _this.lastChildPosition);
      _this.calculateLastChildPosition(config.duration, config.position);
    }
  };

  /**
   *
   * @param {number} order
   * @param {callback} operation
   */
  // AnimationMeta.prototype.addToQueue = function (order, node, operation) {
  //   if (this.parent) {
  //     return this.parent.addToQueue(order, node, operation);
  //   }
  //
  //   if (!this.queue[order]) {
  //     this.queue[order] = [];
  //   }
  //   this.queue[order].push({node: node, operation: operation});
  //   this.list.push({node: node, operation: operation, order: order});
  // };
})(Galaxy);
