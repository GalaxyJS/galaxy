/* global Galaxy, TweenLite, TimelineLite */
'use strict';

(function (G) {
  if (!window.TweenLite || !window.TimelineLite) {
    return console.warn('please load GSAP - GreenSock in order to activate animations');
  }

  G.View.NODE_SCHEMA_PROPERTY_MAP['animations'] = {
    type: 'custom',
    name: 'animations',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param attr
     * @param animations
     * @param scopeData
     */
    handler: function (viewNode, attr, animations, oldConfig, scopeData) {
      if (viewNode.virtual || !animations) {
        return;
      }

      const enter = animations.enter;
      if (enter) {
        if (enter.sequence) {
          AnimationMeta.get(enter.sequence).configs.enter = enter;
        }

        viewNode.populateEnterSequence = function (sequence) {
          animations.config = animations.config || {};

          sequence.onTruncate(function () {
            const tweens = TweenLite.getTweensOf(viewNode.node);
            tweens.forEach(function (tween) {
              if(tween.vars.onComplete) {
                tween.vars.onComplete();
              }
            });
            TweenLite.killTweensOf(viewNode.node);
          });

          if (animations.config.enterWithParent) {
            const parent = viewNode.parent;
            if (!parent.rendered.resolved) {
              return;
            }
          }

          sequence.next(function (done) {
            this.l = 'ap';
            AnimationMeta.installGSAPAnimation(viewNode, 'enter', enter, done);
          });
        };
      }

      const leave = animations.leave;
      if (leave) {
        if (leave.sequence) {
          AnimationMeta.get(leave.sequence).configs.leave = leave;
        }

        viewNode.populateLeaveSequence = function (sequence) {
          animations.config = animations.config || {};

          sequence.onTruncate(function () {
            const tweens = TweenLite.getTweensOf(viewNode.node);
            tweens.forEach(function (tween) {
              if(tween.vars.onComplete) {
                tween.vars.onComplete();
              }
            });
            TweenLite.killTweensOf(viewNode.node);
          });

          if (animations.config.leaveWithParent) {
            const parent = viewNode.parent;
            if (parent.transitory) {
              return;
            }
          }

          // in the case which the viewNode is not visible, then ignore its animation
          if (viewNode.node.offsetWidth === 0 || viewNode.node.offsetHeight === 0) {
            return sequence.next(function (done) {
              done();
            });
          }

          let animationDone;
          const waitForAnimation = new Promise(function (resolve) {
            animationDone = resolve;
          });

          sequence.next((function (promise) {
            return function (done) {
              promise.then(done);
            };
          })(waitForAnimation));

          AnimationMeta.installGSAPAnimation(viewNode, 'leave', leave, animationDone);

          // if (leave.sequence) {
          //   const animationMeta = AnimationMeta.get(leave.sequence);
          //   animationMeta.add(viewNode.node, leave, animationDone);
          //
          //   // Add to parent should happen after the animation is added to the child
          //   if (leave.parent) {
          //     const parent = AnimationMeta.get(leave.parent);
          //     parent.addChild(animationMeta, animationMeta.configs.leave || {}, parent.configs.leave || {});
          //   }
          // } else {
          //   AnimationMeta.createTween(viewNode.node, leave, animationDone);
          // }
        };
      }

      viewNode.rendered.then(function () {
        viewNode.observer.on('class', function (value, oldValue) {
          value.forEach(function (item) {
            if (item && oldValue.indexOf(item) === -1) {
              let _config = animations['.' + item];
              if (_config) {
                viewNode.sequences[':class'].next(function (done) {
                  let classAnimationConfig = _config;
                  classAnimationConfig.to = Object.assign({ className: '+=' + item || '' }, _config.to || {});

                  if (classAnimationConfig.sequence) {
                    let animationMeta = AnimationMeta.get(classAnimationConfig.sequence);

                    if (classAnimationConfig.group) {
                      animationMeta =
                        animationMeta.getGroup(classAnimationConfig.group, classAnimationConfig.duration, classAnimationConfig.position ||
                          '+=0');
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
              let _config = animations['.' + item];
              if (_config) {
                viewNode.sequences[':class'].next(function (done) {
                  let classAnimationConfig = _config;
                  classAnimationConfig.to = { className: '-=' + item || '' };

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

  AnimationMeta.ANIMATIONS = {};
  AnimationMeta.TIMELINES = {};

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

  /**
   *
   * @param {Galaxy.View.ViewNode} node
   * @param {Object|Function} step
   * @return {*}
   */
  AnimationMeta.parseStep = function (node, step) {
    if (step instanceof Function) {
      return step(node);
    }

    return step;
  };

  AnimationMeta.installGSAPAnimation = function (viewNode, type, config, onComplete) {
    const from = AnimationMeta.parseStep(viewNode, config.from);
    const to = AnimationMeta.parseStep(viewNode, config.to);
    // const lastStep = to || from;
    if (type !== 'leave' && to) {
      to.clearProps = to.hasOwnProperty('clearProps') ? to.clearProps : 'all';
    }

    const newConfig = Object.assign({}, config);
    newConfig.from = from;
    newConfig.to = to;

    if (newConfig.sequence) {
      const animationMeta = AnimationMeta.get(newConfig.sequence);
      animationMeta.add(viewNode.node, newConfig, onComplete);

      // Add to parent should happen after the animation is added to the child
      if (newConfig.parent) {
        const parent = AnimationMeta.get(newConfig.parent);
        const animationMetaTypeConfig = animationMeta.configs[type] || {};
        const parentTypeConfig = animationMeta.configs[type] || {};
        parent.addChild(animationMeta, animationMetaTypeConfig, parentTypeConfig);
      }
    } else {
      // let lastStep = config.to || config.from;
      // lastStep.clearProps = 'all';
      AnimationMeta.createTween(viewNode.node, newConfig, onComplete);
    }

    // if (config.sequence) {
    //   const animationMeta = AnimationMeta.get(config.sequence);
    //   const lastStep = config.to || config.from;
    //   lastStep.clearProps = 'all';
    //   animationMeta.add(viewNode.node, config, onComplete);
    //
    //   // Add to parent should happen after the animation is added to the child
    //   if (config.parent) {
    //     const parent = AnimationMeta.get(config.parent);
    //     parent.addChild(animationMeta, animationMeta.configs.enter || {}, parent.configs.enter || {});
    //   }
    // } else {
    //   const lastStep = config.to || config.from;
    //   lastStep.clearProps = 'all';
    //   AnimationMeta.createTween(viewNode.node, config, onComplete);
    // }
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
    this.configs = {};
    this.lastChildPosition = 0;
    this.parent = null;
  }

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
        _this.timeline.add(child.timeline, 0);
      } else {
        _this.timeline.add(child.timeline, childConf.chainToParent ? childConf.position : '+=0');
      }
    }
  };

  AnimationMeta.prototype.add = function (node, config, onComplete) {
    const _this = this;
    let to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;
    to.onStartParams = [node['galaxyViewNode']];

    let onStart = config.onStart;
    to.onStart = onStart;

    let tween = null;
    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      from.onStartParams = [node['galaxyViewNode']];
      from.onStart = onStart;
      tween = TweenLite.from(node,
        config.duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        config.duration || 0,
        to || {});
    }

    tween.data = {
      am: _this,
      config: config
    };
    // debugger;
    // First animation in the timeline should always start at zero
    if (this.timeline.getChildren(false, true, false).length === 0) {
      let progress = _this.timeline.progress();
      if (config.parent) {
        _this.timeline.add(tween, config.chainToParent ? config.position : '+=0');
      } else {
        _this.timeline.add(tween, config.position);
      }

      if (!progress) {
        _this.timeline.play(0);
      }
    } else {
      // if (config.parent) {
      //   _this.timeline.add(tween, config.chainToParent ? config.position : '+=0');
      // } else {
      _this.timeline.add(tween, config.position);
      // }
    }
  };

})(Galaxy);
