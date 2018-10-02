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
     * @param value
     */
    value: function (viewNode, value) {
      if (viewNode.virtual || !value) {
        return;
      }

      const enter = value.enter;
      if (enter) {
        if (enter.sequence) {
          AnimationMeta.get(enter.sequence).configs.enter = enter;
        }

        viewNode.populateEnterSequence = function (sequence) {
          value.config = value.config || {};

          sequence.onTruncate(function animationEnter() {
            const cssText = viewNode.node.style.cssText;
            TweenLite.killTweensOf(viewNode.node);
            requestAnimationFrame(function () {
              viewNode.node.style.cssText = cssText;
            });
          });

          // if enterWithParent flag is there, then only apply animation only to the nodes are rendered
          if (value.config.enterWithParent) {
            const parent = viewNode.parent;
            if (!parent.rendered.resolved) {
              return;
            }
          }

          sequence.next(function (done) {
            // If the node is not in the DOM at this point, then skip its animations
            // if (viewNode.node.offsetParent === null) {
            if (document.body.contains(viewNode.node) === null) {
              return done();
            }

            AnimationMeta.installGSAPAnimation(viewNode, 'enter', enter, value.config, done);
          });
        };
      }

      const leave = value.leave;
      if (leave) {
        if (leave.sequence) {
          AnimationMeta.get(leave.sequence).configs.leave = leave;
        }

        viewNode.populateLeaveSequence = function (sequence) {
          value.config = value.config || {};

          sequence.onTruncate(function () {
            TweenLite.killTweensOf(viewNode.node);
          });

          // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
          if (value.config.leaveWithParent) {
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

          AnimationMeta.installGSAPAnimation(viewNode, 'leave', leave, value.config, animationDone);
        };
      }

      const classAnimationsHandler = function () {
        viewNode.observer.on('class', function (classes, oldClasses) {
          oldClasses = oldClasses || [];

          const classSequence = viewNode.sequences.classList;
          try {
            classes.forEach(function (item) {
              if (item && oldClasses.indexOf(item) === -1) {
                const _config = value['.' + item];
                if (!_config) {
                  return;
                }

                classSequence.next(function (done) {
                  const classAnimationConfig = Object.assign({}, _config);
                  classAnimationConfig.to = Object.assign({ className: '+=' + item || '' }, _config.to || {});
                  AnimationMeta.installGSAPAnimation(viewNode, 'class-add', classAnimationConfig, value.config, done);
                });
              }
            });

            oldClasses.forEach(function (item) {
              if (item && classes.indexOf(item) === -1) {
                const _config = value['.' + item];
                if (!_config) {
                  return;
                }

                classSequence.next(function (done) {
                  const classAnimationConfig = Object.assign({}, _config);
                  classAnimationConfig.to = { className: '-=' + item || '' };
                  AnimationMeta.installGSAPAnimation(viewNode, 'class-remove', classAnimationConfig, value.config, done);
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
    /** @type {galaxy.View.ViewNode}  */
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
   * @param {galaxy.View.ViewNode} viewNode
   * @param {string} sequenceName
   * @return {*}
   */
  AnimationMeta.getParentAnimationByName = function (viewNode, sequenceName) {
    let node = viewNode.parent;
    let animation = node.cache.animations;
    let sequence = null;

    while (!sequence) {
      animation = node.cache.animations;
      if (animation && animation.timeline.data && animation.timeline.data.am.name === sequenceName) {
        sequence = animation;
      } else {
        node = node.parent;

        if (!node) {
          return null;
        }
      }
    }

    return sequence.timeline;
  };

  // AnimationMeta.refresh = function (timeline) {
  //   const parentChildren = timeline.getChildren(false, true, true);
  //   timeline.clear();
  //   parentChildren.forEach(function (item) {
  //     if (item.data) {
  //       const conf = item.data.config;
  //       timeline.add(item, conf.position);
  //     } else {
  //       timeline.add(item);
  //     }
  //   });
  // };

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
    let sequenceName = newConfig.sequence;

    if (newConfig.sequence instanceof Function) {
      sequenceName = newConfig.sequence.call(viewNode);
    }

    if (sequenceName) {
      const animationMeta = AnimationMeta.get(sequenceName);

      if (type === 'leave' && config.batchLeaveDOMManipulation !== false) {
        animationMeta.addOnComplete(onComplete);
        animationMeta.add(viewNode, newConfig);
      } else {
        animationMeta.add(viewNode, newConfig, onComplete);
      }

      // Add to parent should happen after the animation is added to the child
      if (newConfig.parent) {
        // const parent = AnimationMeta.get(newConfig.parent);
        const animationMetaTypeConfig = animationMeta.configs[type] || {};
        // const parentTypeConfig = animationMeta.configs[type] || {};
// debugger;
        animationMeta.addChild(viewNode, type, animationMetaTypeConfig);
      }

      if (newConfig.startAfter) {
        const parent = AnimationMeta.get(newConfig.startAfter);
        const animationMetaTypeConfig = animationMeta.configs[type] || {};

        parent.addAtEnd(viewNode, type, animationMeta, animationMetaTypeConfig);
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
    _this.timeline = new TimelineLite({
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
    // _this.parent = null;
    _this.children = [];
    _this.timelinesMap = [];
  }

  /**
   *
   * @param {callback} action
   */
  AnimationMeta.prototype = {
    addOnComplete: function (action) {
      this.onCompletesActions.push(action);
    },
    /**
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {'leave'|'enter'} type
     * @param {AnimationConfig} childConf
     */
    addChild: function (viewNode, type, childConf) {
      const _this = this;
      const parentNodeTimeline = AnimationMeta.getParentTimeline(viewNode);
      const children = parentNodeTimeline.getChildren(false);
      _this.timeline.pause();

      if (_this.children.indexOf(parentNodeTimeline) === -1) {
        const i = _this.children.push(parentNodeTimeline);
        let posInParent = childConf.positionInParent || '+=0';

        // In the case that the parentNodeTimeline has not timeline then its _startTime should be 0
        if (parentNodeTimeline.timeline === null || children.length === 0) {
          parentNodeTimeline.pause();
          parentNodeTimeline._startTime = 0;
          parentNodeTimeline.play(0);

          if (posInParent.indexOf('-') === 0) {
            posInParent = null;
          }
        }
        parentNodeTimeline.add(function () {
          _this.children.splice(i - 1, 1);
          _this.timeline.resume();
        }, posInParent);

      }

      parentNodeTimeline.resume();
    },
    /**
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {'leave'|'enter'} type
     * @param {AnimationMeta} child
     * @param {AnimationConfig} childConf
     */
    addAtEnd: function (viewNode, type, child, childConf) {
      const _this = this;

      // if (_this.timeline.progress() !== undefined) {
      //   child.timeline.pause();
      // }
      //
      // _this.timeline.add(function () {
      //   child.timeline.resume();
      // });

      const children = _this.timeline.getChildren(false, true, true);

      if (children.indexOf(child.timeline) !== -1) {
      } else if (children.length) {
        _this.timeline.add(child.timeline);
        _this.timeline.add(function () {
          _this.timeline.remove(child.timeline);
          child.timeline.resume();
        });
      }
    },

    add: function (viewNode, config, onComplete) {
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
        config: config,
        n: viewNode.node
      };
      nodeTimeline.add(tween);

      // if the animation has no parent but its parent animation is the same as its own animation
      // then it should intercept the animation in order to make the animation proper visual wise
      const sameSequenceParentTimeline = AnimationMeta.getParentAnimationByName(viewNode, _this.name);
      if (sameSequenceParentTimeline) {
        const currentProgress = sameSequenceParentTimeline.progress();
        // if the currentProgress is 0 or bigger than the nodeTimeline start time
        // then we can intercept the parentNodeTimeline
        if (nodeTimeline.startTime() < currentProgress || currentProgress === 0) {
          _this.timeline.add(nodeTimeline, config.position || '+=0');
          return;
        }
      }

      if (children.indexOf(nodeTimeline) === -1) {
        // _this.children.push(nodeTimeline);
        let progress = _this.timeline.progress();
        if (children.length) {
          _this.timeline.add(nodeTimeline, config.position);
        } else {
          _this.timeline.add(nodeTimeline);
        }

        if (progress === undefined) {
          _this.timeline.play(0);
        }
      } else {
        _this.timeline.add(nodeTimeline, config.position);
      }
    }
  };

})(Galaxy);
