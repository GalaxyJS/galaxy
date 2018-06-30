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
     * @param oldConfig
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
            TweenLite.killTweensOf(viewNode.node);
          });

          // if enterWithParent flag is there, then only apply animation only to the nodes are rendered
          if (animations.config.enterWithParent) {
            const parent = viewNode.parent;
            if (!parent.rendered.resolved) {
              return;
            }
          }

          sequence.next(function (done) {
            // If the node is not in the DOM at this point, then skip its animations
            if (viewNode.node.offsetParent === null) {
              return done();
            }

            AnimationMeta.installGSAPAnimation(viewNode, 'enter', enter, animations.config, done);
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
            TweenLite.killTweensOf(viewNode.node);
          });

          // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
          if (animations.config.leaveWithParent) {
            const parent = viewNode.parent;
            if (parent.transitory) {
              return;
            }
          }

          // in the case which the viewNode is not visible, then ignore its animation
          if (viewNode.node.offsetWidth === 0 ||
            viewNode.node.offsetHeight === 0 ||
            viewNode.node.style.opacity === '0' ||
            viewNode.node.style.visibility === 'hidden') {
            return;
          }

          let animationDone;
          const waitForAnimation = new Promise(function (resolve) {
            animationDone = resolve;
          });

          sequence.next(function (done) {
            waitForAnimation.then(done);
          });

          AnimationMeta.installGSAPAnimation(viewNode, 'leave', leave, animations.config, animationDone);
        };
      }

      const classAnimationsHandler = function () {
        viewNode.observer.on('class', function (classes, oldClasses) {
          const classSequence = viewNode.sequences.classList;
          classes.forEach(function (item) {
            if (item && oldClasses.indexOf(item) === -1) {
              const _config = animations['.' + item];
              if (!_config) {
                return;
              }

              classSequence.next(function (done) {
                const classAnimationConfig = Object.assign({}, _config);
                classAnimationConfig.to = Object.assign({ className: '+=' + item || '' }, _config.to || {});
                AnimationMeta.installGSAPAnimation(viewNode, 'class-add', classAnimationConfig, animations.config, done);
              });
            }
          });

          oldClasses.forEach(function (item) {
            if (item && classes.indexOf(item) === -1) {
              const _config = animations['.' + item];
              if (!_config) {
                return;
              }

              classSequence.next(function (done) {
                // requestAnimationFrame(function () {
                const classAnimationConfig = Object.assign({}, _config);
                classAnimationConfig.to = { className: '-=' + item || '' };
                AnimationMeta.installGSAPAnimation(viewNode, 'class-remove', classAnimationConfig, animations.config, done);
                // });
              });
            }
          });
        });
      };

      viewNode.rendered.then(classAnimationsHandler);
    }
  };

  AnimationMeta.ANIMATIONS = {};
  AnimationMeta.TIMELINES = {};

  /**
   *
   * @param {string} name
   * @return {AnimationMeta}
   */
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

    let duration = config.duration;
    if (duration instanceof Function) {
      duration = config.duration.call(node);
    }

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
        duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        duration || 0,
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

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'enter'|'leave'|'class-add'|'class-remove'} type
   * @param descriptions
   * @param {callback} onComplete
   */
  AnimationMeta.installGSAPAnimation = function (viewNode, type, descriptions, config, onComplete) {
    const from = AnimationMeta.parseStep(viewNode, descriptions.from);
    const to = AnimationMeta.parseStep(viewNode, descriptions.to);

    if (type !== 'leave' && to) {
      to.clearProps = to.hasOwnProperty('clearProps') ? to.clearProps : 'all';
    }

    const newConfig = Object.assign({}, descriptions);
    newConfig.from = from;
    newConfig.to = to;

    if (newConfig.sequence) {
      const animationMeta = AnimationMeta.get(newConfig.sequence);

      if (type === 'leave' && config.batchLeaveDOMManipulation !== false) {
        animationMeta.addOnComplete(onComplete);
        animationMeta.add(viewNode.node, newConfig);
      } else {
        animationMeta.add(viewNode.node, newConfig, onComplete);
      }

      // Add to parent should happen after the animation is added to the child
      if (newConfig.parent) {
        const parent = AnimationMeta.get(newConfig.parent);
        const animationMetaTypeConfig = animationMeta.configs[type] || {};
        const parentTypeConfig = animationMeta.configs[type] || {};
        parent.addChild(animationMeta, animationMetaTypeConfig, parentTypeConfig);
      }
    } else {
      AnimationMeta.createTween(viewNode.node, newConfig, onComplete);
    }
  };

  /**
   *
   * @param {string} name
   * @class
   */
  function AnimationMeta(name) {
    const _this = this;
    _this.name = name;
    this.timeline = new TimelineLite({
      autoRemoveChildren: true,
      smoothChildTiming: true,
      onComplete: function () {
        if (_this.parent) {
          _this.parent.timeline.remove(_this.timeline);
        }
        _this.onCompletesActions.forEach(function (action) {
          action();
        });
        _this.onCompletesActions = [];
      }
    });
    _this.onCompletesActions = [];

    _this.timeline.addLabel('beginning', 0);
    _this.configs = {};
    _this.parent = null;
  }

  /**
   *
   * @param {callback} action
   */
  AnimationMeta.prototype.addOnComplete = function (action) {
    this.onCompletesActions.push(action);
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
    const to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;
    to.onStartParams = [node['galaxyViewNode']];

    let onStart = config.onStart;
    to.onStart = onStart;

    let tween = null;
    let duration = config.duration;
    if (duration instanceof Function) {
      duration = config.duration.call(node);
    }

    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      from.onStartParams = [node['galaxyViewNode']];
      from.onStart = onStart;
      tween = TweenLite.from(node,
        duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        duration || 0,
        to || {});
    }

    tween.data = {
      am: _this,
      config: config
    };

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
      _this.timeline.add(tween, config.position);
    }
  };

})(Galaxy);
