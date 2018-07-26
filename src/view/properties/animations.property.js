/* global Galaxy, TweenLite, TimelineLite */
'use strict';

(function (G) {
  if (!window.TweenLite || !window.TimelineLite) {
    return console.warn('please load GSAP - GreenSock in order to activate animations');
  }

  G.View.NODE_SCHEMA_PROPERTY_MAP['animations'] = {
    type: 'prop',
    name: 'animations',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param attr
     * @param animations
     * @param oldConfig
     * @param scopeData
     */
    value: function (viewNode, attr, animations, oldConfig, scopeData) {
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
          }, 'populate-enter-sequence', 'self-enter');
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
          oldClasses = oldClasses || [];
          const classSequence = viewNode.sequences.classList;
          try {
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
          }
          catch (exception) {
            console.warn(exception);
          }
        });
      };

      viewNode.rendered.then(classAnimationsHandler);
    }
  };

  /**
   *
   * @typedef {Object} AnimationConfig
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
   * @property {number} [duration]
   * @property {object} [from]
   * @property {object} [to]
   */

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
   * @param {galaxy.View.ViewNode} viewNode
   * @return {*}
   */
  AnimationMeta.getParentTimeline = function (viewNode) {
    let node = viewNode;
    let animations = null;

    while (!animations) {
      if (node.parent) {
        animations = node.parent.cache.animations;
      } else {
        return null;
      }

      node = node.parent;
    }

    return animations.timeline;
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
        animationMeta.add(viewNode, newConfig);
      } else {
        animationMeta.add(viewNode, newConfig, onComplete);
      }

      // Add to parent should happen after the animation is added to the child
      if (newConfig.parent) {
        const parent = AnimationMeta.get(newConfig.parent);
        const animationMetaTypeConfig = animationMeta.configs[type] || {};
        const parentTypeConfig = animationMeta.configs[type] || {};

        parent.addChild(viewNode, type, animationMeta, animationMetaTypeConfig);
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
      // paused: true,
      autoRemoveChildren: true,
      smoothChildTiming: true,
      onComplete: function () {
        if (_this.parent) {
          _this.parent.timeline.remove(_this.timeline);
        }
        _this.onCompletesActions.forEach(function (action) {
          action();
        });
        _this.children = [];
        _this.onCompletesActions = [];
      }
    });
    _this.onCompletesActions = [];

    _this.timeline.addLabel('beginning', 0);
    _this.configs = {};
    _this.parent = null;
    _this.children = [];
    _this.timelinesMap = [];
  }

  /**
   *
   * @param {callback} action
   */
  AnimationMeta.prototype.addOnComplete = function (action) {
    this.onCompletesActions.push(action);
  };

  /**
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'leave'|'enter'} type
   * @param {AnimationMeta} child
   * @param {AnimationConfig} childConf
   */
  AnimationMeta.prototype.addChild = function (viewNode, type, child, childConf) {
    const _this = this;
    const animationTypeConfig = _this.configs[type] || {};
    // const index = _this.children.indexOf(child.timeline);
    const parentNodeTimeline = AnimationMeta.getParentTimeline(viewNode);
    const parentNodeTimelineChildren = parentNodeTimeline.getChildren(false);

    child.parent = _this;

    if (parentNodeTimelineChildren.indexOf(viewNode.cache.animations.timeline) === -1) {
      if (childConf.chainToParent) {
        parentNodeTimeline.add(viewNode.cache.animations.timeline, childConf.position);
        debugger;
        const paaaarentNodeTimelineChildren = parentNodeTimeline.getChildren(false);
      } else if (_this.children.indexOf(child.timeline) === -1) {
        // const parentChildren = parentNodeTimeline.getChildren(false, true, true);
        // debugger;
        // _this.children.push(child.timeline);
        // child.timeline.pause();
        // parentNodeTimeline.add(function () {
        //   child.timeline.resume();
        // });
        // parentNodeTimeline.resume();
        //
        // debugger;
      } else {
        const parentChildren = parentNodeTimeline.getChildren(false, true, true);
        // debugger;
      }

    }

    // const parentChildren = parentNodeTimeline.getChildren(false, true, true);
    //
    // parentNodeTimeline.clear();
    // parentChildren.forEach(function (item) {
    //   if (item.data) {
    //     // console.log(item.data)
    //     const conf = item.data.config;
    //     parentNodeTimeline.add(item, conf.position);
    //   } else {
    //     parentNodeTimeline.add(item);
    //   }
    // });
    // const asdasd = _this.timeline.getChildren(false, true, true);
    // debugger;
    // parentNodeTimeline.play(0);
  };

  AnimationMeta.prototype.add = function (viewNode, config, onComplete) {
    const _this = this;
    const to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;
    to.onStartParams = [viewNode];

    let onStart = config.onStart;
    to.onStart = onStart;

    let tween = null;
    let duration = config.duration;
    if (duration instanceof Function) {
      duration = config.duration.call(viewNode);
    }

    if (config.from && config.to) {
      tween = TweenLite.fromTo(viewNode.node,
        duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      from.onStartParams = [viewNode];
      from.onStart = onStart;
      tween = TweenLite.from(viewNode.node,
        duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(viewNode.node,
        duration || 0,
        to || {});
    }

    // tween.data = {
    //   am: _this,
    //   config: config
    // };

    const children = _this.timeline.getChildren(false, true, true);

    viewNode.cache.animations = viewNode.cache.animations || {
      timeline: new TimelineLite({
        autoRemoveChildren: true,
        smoothChildTiming: true
      })
    };

    const nodeTimeline = viewNode.cache.animations.timeline;
    nodeTimeline.data = {
      am: _this,
      config: config
    };

    if (children.indexOf(nodeTimeline) === -1) {
      _this.children.push(nodeTimeline);
      let progress = _this.timeline.progress();
      // if (config.parent) {
      //   _this.timeline.add(nodeTimeline, config.chainToParent ? '+=0' : config.position);
      // } else {
      _this.timeline.add(nodeTimeline, config.position);
      // }

      if (!progress) {
        _this.timeline.play(0);
      }
    } else {
      _this.timeline.add(nodeTimeline, config.position);
    }

    const test = AnimationMeta.getParentTimeline(viewNode);

    nodeTimeline.add(tween);
// debugger;
    if (_this.parent) {
      const parentChildren = _this.parent.timeline.getChildren(false, true, true);
      // debugger;
      _this.parent.timeline.clear();
      parentChildren.forEach(function (item) {
        if (item.data) {
          // console.log(item.data)
          const conf = item.data.config;
          _this.parent.timeline.add(item, conf.position);
        } else {
          _this.parent.timeline.add(item);
        }
      });

      _this.parent.timeline.play(0);
      // debugger;
    } else if (test) {
      // console.log(test.data.am === _this);
      // debugger;
    }
  };

})(Galaxy);
