/* global Galaxy, TweenLite, TimelineLite */
'use strict';

(function (G) {
  if (!window.TweenLite || !window.TimelineLite) {
    return console.warn('please load GSAP - GreenSock in order to activate animations');
  }

  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['animations'] = {
    type: 'custom',
    name: 'animations',
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
          });

          sequence.next(function (done) {
            // if (enterAnimationConfig.cssName) {
            //   AnimationMeta.installCSSAnimation(viewNode, enterAnimationConfig, done);
            // } else {
            AnimationMeta.installGSAPAnimation(viewNode, enterAnimationConfig, done);
            // }
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
          });

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

          if (leaveAnimationConfig.sequence) {
            // in the case which the viewNode is not visible, then ignore its animation
            // if (viewNode.node.offsetWidth === 0 || viewNode.node.offsetHeight === 0) {
            //   return animationDone();
            // }

            const animationMeta = AnimationMeta.get(leaveAnimationConfig.sequence);
            animationMeta.add(viewNode.node, leaveAnimationConfig, animationDone);

            // Add to parent should happen after the animation is added to the child
            if (leaveAnimationConfig.parent) {
              const parent = AnimationMeta.get(leaveAnimationConfig.parent);
              parent.addChild(animationMeta, animationMeta.configs.leave || {}, parent.configs.leave || {});
            }
          } else {
            AnimationMeta.createTween(viewNode.node, leaveAnimationConfig, animationDone);
          }
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

  // AnimationMeta.installCSSAnimation = function (viewNode, config, onComplete) {
  //   const duration = typeof config.duration === 'string' ? (config.duration || '0s') : (config.duration || 0) + 's';
  //   viewNode.node.style.animationName = config.cssName;
  //   viewNode.node.style.animationDuration = duration;
  //   const onAnimationEnd = function (event) {
  //     if (event.animationName === config.cssName) {
  //       viewNode.node.style.animationName = null;
  //       viewNode.node.style.animationDuration = null;
  //       onComplete();
  //       viewNode.node.removeEventListener('animationend', onAnimationEnd);
  //     }
  //   };
  //
  //   viewNode.node.addEventListener('animationend', onAnimationEnd);
  // };

  AnimationMeta.installGSAPAnimation = function (viewNode, config, onComplete) {
    if (config.sequence) {
      let animationMeta = AnimationMeta.get(config.sequence);
      let lastStep = config.to || config.from;
      lastStep.clearProps = 'all';
      animationMeta.add(viewNode.node, config, onComplete);

      // Add to parent should happen after the animation is added to the child
      if (config.parent) {
        const parent = AnimationMeta.get(config.parent);
        parent.addChild(animationMeta, animationMeta.configs.enter || {}, parent.configs.enter || {});
      }
    } else {
      let lastStep = config.to || config.from;
      lastStep.clearProps = 'all';
      AnimationMeta.createTween(viewNode.node, config, onComplete);
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
    to.onStartParams = [node['__viewNode__']];

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
      from.onStartParams = [node['__viewNode__']];
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
