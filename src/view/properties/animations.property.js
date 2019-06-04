/* global Galaxy, TweenLite, TimelineLite */
'use strict';

(function (Galaxy) {
  if (!window.TweenLite || !window.TimelineLite) {
    return console.warn('please load GSAP - GreenSock in order to activate animations');
  }

  function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
  }

  function removeChild(node, child) {
    node.removeChild(child);
  }

  Galaxy.View.NODE_SCHEMA_PROPERTY_MAP['animations'] = {
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

        viewNode.populateEnterSequence = function (sequence1) {
          value.config = value.config || {};

          // sequence.onTruncate(function animationEnter() {
          //   const cssText = viewNode.node.style.cssText;
          //   TweenLite.killTweensOf(viewNode.node);
          //   requestAnimationFrame(function () {
          //     viewNode.node.style.cssText = cssText;
          //   });
          // });

          // if enterWithParent flag is there, then only apply animation only to the nodes are rendered
          if (value.config.enterWithParent) {
            const parent = viewNode.parent;
            if (!parent.rendered.resolved) {
              return;
            }
          }

          // sequence.next(function (done) {
          // If the node is not in the DOM at this point, then skip its animations
          // if (viewNode.node.offsetParent === null) {
          if (document.body.contains(viewNode.node) === null) {
            // return done();
            return;
          }

          AnimationMeta.installGSAPAnimation(viewNode, 'enter', enter, value.config);
          // });
        };
      }

      const leave = value.leave;
      if (leave) {
        if (leave.sequence) {
          AnimationMeta.get(leave.sequence).configs.leave = leave;
        }

        viewNode.populateLeaveSequence = function (flag) {
          value.config = value.config || {};

          // sequence.onTruncate(function () {
          //   TweenLite.killTweensOf(viewNode.node);
          // });

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

          // let animationDone;
          // const waitForAnimation = new Promise(function (resolve) {
          //   animationDone = resolve;
          // });

          // sequence.next(function (done) {
          //   waitForAnimation.then(done);
          // });

          AnimationMeta.installGSAPAnimation(viewNode, 'leave', leave, value.config, function () {
            if (!flag) {
              if (!viewNode.placeholder.parentNode) {
                insertBefore(viewNode.node.parentNode, viewNode.placeholder, viewNode.node);
              }

              if (viewNode.node.parentNode) {
                removeChild(viewNode.node.parentNode, viewNode.node);
              }
            } else {
              viewNode.node.parentNode && removeChild(viewNode.node.parentNode, viewNode.node);
              viewNode.placeholder.parentNode && removeChild(viewNode.placeholder.parentNode, viewNode.placeholder);
            }
          });
        };
      } else {
        viewNode.populateLeaveSequence = function (flag) {
          if (!flag) {
            if (!viewNode.placeholder.parentNode) {
              insertBefore(viewNode.node.parentNode, viewNode.placeholder, viewNode.node);
            }

            if (viewNode.node.parentNode) {
              removeChild(viewNode.node.parentNode, viewNode.node);
            }
          } else {
            viewNode.node.parentNode && removeChild(viewNode.node.parentNode, viewNode.node);
            viewNode.placeholder.parentNode && removeChild(viewNode.placeholder.parentNode, viewNode.placeholder);
          }
        };
      }

      const classAnimationsHandler = function () {
        viewNode.observer.on('classList', function (classes, oldClasses) {
          oldClasses = oldClasses || [];

          // const classSequence = viewNode.sequences.classList;
          try {
            classes.forEach(function (item) {
              if (item && oldClasses.indexOf(item) === -1) {
                if (item.indexOf('@') === 0) {
                  const classEvent = value[item];
                  if (classEvent) {
                    // classSequence.nextAction(function () {
                    viewNode.node.classList.remove(item);
                    AnimationMeta.installGSAPAnimation(viewNode, item, classEvent, value.config);
                    // });
                  }

                  return;
                }

                const _config = value['+=' + item] || value['.' + item];
                if (!_config) {
                  return;
                }

                // classSequence.nextAction(function (done) {
                viewNode.node.classList.remove(item);
                AnimationMeta.installGSAPAnimation(viewNode, '+=' + item, _config, value.config, done);
                // });
              }
            });

            oldClasses.forEach(function (item) {
              if (item && classes.indexOf(item) === -1) {
                const _config = value['-=' + item] || value['.' + item];
                if (!_config) {
                  return;
                }

                // classSequence.nextAction(function (done) {
                viewNode.node.classList.add(item);
                AnimationMeta.installGSAPAnimation(viewNode, '-=' + item, _config, value.config, done);
                // });
              }
            });
          } catch (exception) {
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
   * @property {string} [parent]
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
   * @property {number} [duration]
   * @property {object} [from]
   * @property {object} [to]
   * @property {string} [attachTo]
   * @property {string} [addTo]
   * @property {string} [appendTo]
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

  AnimationMeta.createTween = function (viewNode, config, onComplete) {
    const node = viewNode.node;
    let from = AnimationMeta.parseStep(viewNode, config.from);
    let to = AnimationMeta.parseStep(viewNode, config.to);
    const duration = AnimationMeta.parseStep(viewNode, config.duration) || 0;

    if (to) {
      to = Object.assign({}, to);

      if (to.onComplete) {
        const userDefinedOnComplete = to.onComplete;
        to.onComplete = function () {
          userDefinedOnComplete();
          if (onComplete) {
            onComplete();
          }
        };
      } else {
        to.onComplete = onComplete;
      }
    }

    let tween = null;
    if (from && to) {
      tween = TweenLite.fromTo(node,
        duration,
        from,
        to);
    } else if (from) {
      from = Object.assign({}, from || {});

      if (from.onComplete) {
        const userDefinedOnComplete = from.onComplete;
        from.onComplete = function () {
          userDefinedOnComplete();
          onComplete();
        };
      } else {
        from.onComplete = onComplete;
      }

      tween = TweenLite.from(node,
        duration,
        from);
    } else if (to) {
      tween = TweenLite.to(node,
        duration,
        to);
    } else {
      onComplete();
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
      return step.call(node);
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

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'enter'|'leave'|'class-add'|'class-remove'} type
   * @param {AnimationConfig} descriptions
   * @param config
   * @param {callback} onComplete
   */
  AnimationMeta.installGSAPAnimation = function (viewNode, type, descriptions, config, onComplete) {
    const from = AnimationMeta.parseStep(viewNode, descriptions.from);
    let to = AnimationMeta.parseStep(viewNode, descriptions.to);

    const classModification = type.indexOf('+=') === 0 || type.indexOf('-=') === 0;

    if (type !== 'leave' && !classModification && to) {
      to.clearProps = to.hasOwnProperty('clearProps') ? to.clearProps : 'all';
    } else if (classModification) {
      to = Object.assign(to || {}, { className: type, overwrite: 'none' });
    } else if (type.indexOf('@') === 0) {
      to = Object.assign(to || {}, { overwrite: 'none' });
    }
    /** @type {AnimationConfig} */
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
      // if (newConfig.parent) {
      //   animationMeta.addChild(viewNode, type, newConfig);
      // }

      // if(newConfig.attachTo === 'main-nav-items') debugger;
      if (newConfig.addTo) {
        animationMeta.addTo(newConfig.addTo, newConfig.positionInParent);
      }

      if (newConfig.attachTo) {
        animationMeta.attachTo(newConfig.attachTo, newConfig.positionInParent);
      }

      if (newConfig.appendTo) {
        animationMeta.appendTo(newConfig.appendTo, newConfig.positionInParent);
      }

      // if (newConfig.startAfter) {
      //   const parent = AnimationMeta.get(newConfig.startAfter);
      //   const animationMetaTypeConfig = animationMeta.configs[type] || {};
      //
      //   parent.addAtEnd(viewNode, type, animationMeta, animationMetaTypeConfig);
      // }

    } else {
      AnimationMeta.createTween(viewNode, newConfig, onComplete);
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
      smoothChildTiming: false,
      onComplete: function () {
        // if(name === 'sub-nav-container') {
        //   // const cc = _this.timeline.getChildren(false);
        //   debugger;
        // }
        if (_this.parent) {
          _this.parent.timeline.remove(_this.timeline);
        }
        _this.onCompletesActions.forEach(function (action) {
          action();
        });
        _this.children = [];
        _this.onCompletesActions = [];
        // AnimationMeta.ANIMATIONS[_this.name].timeline.clear();
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
    addTo(sequenceName, pip) {
      console.log(sequenceName);
      const animationMeta = AnimationMeta.get(sequenceName);
      const children = animationMeta.timeline.getChildren(false);
      const farChildren = children.filter((item) => !item._time);
      debugger;
      if (children.indexOf(this.timeline) === -1) {
        animationMeta.timeline.pause();
        // if(sequenceName ==='main-nav-items' ) debugger;
        animationMeta.timeline.add(this.timeline, this.timeline._time);
        animationMeta.timeline.resume();
      }
    },
    attachTo(sequenceName, pip) {
      const animationMeta = AnimationMeta.get(sequenceName);
      const children = animationMeta.timeline.getChildren(false);

      if (animationMeta.children.indexOf(this.timeline) === -1) {
        this.timeline.pause();
        // debugger;
        animationMeta.timeline.add(() => {
          this.timeline.resume();
        }, pip || '+=0');
        animationMeta.children.push(this.timeline);
        // animationMeta.timeline.add(this.timeline, pip || '+=0');
      }
    },
    appendTo(sequenceName) {
      const animationMeta = AnimationMeta.get(sequenceName);

      this.timeline.pause();
      animationMeta.timeline.eventCallback('onComplete', () => {
        this.timeline.resume();
      });
    },
    /**
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {'leave'|'enter'} type
     * @param {AnimationConfig} config
     */
    // addChild: function (viewNode, type, config) {
    //   const _this = this;
    //   const parent = config.parent;
    //   let parentNodeTimeline = AnimationMeta.getParentTimeline(viewNode);
    //
    //   if (parent === true) {
    //     parentNodeTimeline = AnimationMeta.getParentTimeline(viewNode);
    //   } else if (parent) {
    //     parentNodeTimeline = AnimationMeta.get(config.parent).timeline;
    //   }
    //
    //   // console.log(config);
    //   // if (type === 'leave') {
    //   //   parentNodeTimeline = AnimationMeta.get(config.parent).timeline;
    //   //   // debugger;
    //   //   // return;
    //   // }
    //   const children = parentNodeTimeline.getChildren(false);
    //   _this.timeline.pause();
    //
    //   if (_this.children.indexOf(parentNodeTimeline) === -1) {
    //     const i = _this.children.push(parentNodeTimeline);
    //     let posInParent = config.positionInParent || '+=0';
    //
    //     // In the case that the parentNodeTimeline has not timeline then its _startTime should be 0
    //     if (parentNodeTimeline.timeline === null || children.length === 0) {
    //       parentNodeTimeline.pause();
    //       parentNodeTimeline._startTime = 0;
    //       parentNodeTimeline.play(0);
    //
    //       if (posInParent.indexOf('-') === 0) {
    //         posInParent = null;
    //       }
    //     }
    //     parentNodeTimeline.add(function () {
    //       _this.children.splice(i - 1, 1);
    //       _this.timeline.resume();
    //     }, posInParent);
    //
    //   }
    //
    //   parentNodeTimeline.resume();
    // },
    /**
     * @param {Galaxy.View.ViewNode} viewNode
     * @param {'leave'|'enter'} type
     * @param {AnimationMeta} child
     * @param {AnimationConfig} childConf
     */
    addAtEnd: function (viewNode, type, child, childConf) {
      const _this = this;

      const children = _this.timeline.getChildren(false, true, true);
      if (children.indexOf(child.timeline) !== -1) {
        // Do nothing for now
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
      to.callbackScope = viewNode;

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

      // viewNode.cache.animations = viewNode.cache.animations || {
      //   timeline: new TimelineLite({
      //     autoRemoveChildren: true,
      //     smoothChildTiming: true
      //   })
      // };

      // const nodeTimeline = viewNode.cache.animations.timeline;
      // nodeTimeline.data = {
      //   am: _this,
      //   config: config,
      //   n: viewNode.node
      // };
      // if (this.name === 'sub-nav-items') {
      //   debugger;
      // }

      // nodeTimeline.add(tween);

      // if the animation has no parent but its parent animation is the same as its own animation
      // then it should intercept the animation in order to make the animation proper visual wise
      // const sameSequenceParentTimeline = AnimationMeta.getParentAnimationByName(viewNode, _this.name);
      // if (sameSequenceParentTimeline) {
      //   const currentProgress = sameSequenceParentTimeline.progress();
      //   // if the currentProgress is 0 or bigger than the nodeTimeline start time
      //   // then we can intercept the parentNodeTimeline
      //   if (nodeTimeline.startTime() < currentProgress || currentProgress === 0) {
      //     _this.timeline.add(nodeTimeline, config.position || '+=0');
      //     return;
      //   }
      // }
      // const indexes =
// debugger;
      if (children.indexOf(tween) === -1) {
        // _this.children.push(nodeTimeline);
        let progress = _this.timeline.progress();
        if (children.length) {
          _this.timeline.add(tween, config.position);
        } else {
          _this.timeline.add(tween);
        }

        if (progress === undefined) {
          _this.timeline.play(0);
        }
      } else {
        _this.timeline.add(tween, config.position);
      }
    }
  };
  window.AM = AnimationMeta;
})(Galaxy);
