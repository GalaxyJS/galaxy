/* global Galaxy, gsap, TimelineLite */
'use strict';

(function (Galaxy) {
  if (!window.gsap || !window.TimelineLite) {
    return console.warn('please load GSAP - GreenSock in order to activate animations');
  }

  const recursiveKill = (node) => {
    Array.prototype.forEach.call(node.childNodes, recursiveKill);
    if (gsap.getTweensOf(node).length) {
      gsap.killTweensOf(node);
    }
  };

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

        viewNode.populateEnterSequence = function () {
          value.config = value.config || {};

          // if enterWithParent flag is there, then only apply animation only to the nodes are rendered
          if (value.config.enterWithParent) {
            const parent = viewNode.parent;
            if (!parent.rendered.resolved) {
              return;
            }
          }

          AnimationMeta.installGSAPAnimation(viewNode, 'enter', enter, value.config);
        };
      }

      const leave = value.leave;
      if (leave) {
        viewNode.populateLeaveSequence = function (flag) {
          value.config = value.config || {};

          // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
          if (value.config.leaveWithParent || value.leave.withParent) {
            const parent = viewNode.parent;

            if (parent.transitory) {
              if (gsap.getTweensOf(viewNode.node).length) {
                gsap.killTweensOf(viewNode.node);
              }
              return;
            }
          }

          if (gsap.getTweensOf(viewNode.node).length) {
            gsap.killTweensOf(viewNode.node);
          }

          const rect = viewNode.node.getBoundingClientRect();
          // if (viewNode.node.classList.contains('box')) {
          //   viewNode.node.style.border = '1px solid red';
          //   console.log(viewNode.node.offsetHeight, rect.height)
          // }
          // in the case which the viewNode is not visible, then ignore its animation
          if (rect.width === 0 ||
            rect.height === 0 ||
            viewNode.node.style.opacity === '0' ||
            viewNode.node.style.visibility === 'hidden') {
            gsap.killTweensOf(viewNode.node);
            return Galaxy.View.ViewNode.REMOVE_SELF.call(viewNode, flag);
          }

          // if (viewNode.node.offsetWidth === 0 ||
          //   viewNode.node.offsetHeight === 0 ||
          //   viewNode.node.style.opacity === '0' ||
          //   viewNode.node.style.visibility === 'hidden') {
          //   gsap.killTweensOf(viewNode.node);
          //   return Galaxy.View.ViewNode.REMOVE_SELF.call(viewNode, flag);
          // }

          AnimationMeta.installGSAPAnimation(viewNode, 'leave', leave, value.config, Galaxy.View.ViewNode.REMOVE_SELF.bind(viewNode, flag));
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
   * @property {Promise} [await]
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
   * @property {number} [duration]
   * @property {object} [from]
   * @property {object} [to]
   * @property {string} [addTo]
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
      tween = gsap.fromTo(node,
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

      tween = gsap.from(node,
        duration,
        from);
    } else if (to) {
      tween = gsap.to(node,
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
      if (newConfig.await && animationMeta.awaits.indexOf(newConfig.await) === -1) {
        animationMeta.timeline.add(function() {
          console.log('inja',newConfig.position)
          newConfig.await.then(() => {
            animationMeta.timeline.resume();
          });
        }, newConfig.position);
        animationMeta.timeline.addPause(newConfig.position);

        animationMeta.awaits.push(newConfig.await);
      }

      if (type === 'leave' && config.batchLeaveDOMManipulation !== false) {
        animationMeta.add(viewNode, newConfig, onComplete);
      } else {
        animationMeta.add(viewNode, newConfig, onComplete);
      }

      if (newConfig.addTo) {
        animationMeta.addTo(newConfig.addTo, newConfig.positionInParent);
      }

      // if (newConfig.attachTo) {
      //   animationMeta.attachTo(newConfig.attachTo, newConfig.positionInParent);
      // }
      //
      // if (newConfig.appendTo) {
      //   animationMeta.appendTo(newConfig.appendTo, newConfig.positionInParent);
      // }

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
      autoRemoveChildren: true,
      smoothChildTiming: false,
      onComplete: function () {
        AnimationMeta.ANIMATIONS[name] = null;
        if (_this.parent) {
          _this.parent.timeline.remove(_this.timeline);
        }
        _this.onCompletesActions.forEach(function (action) {
          action();
        });
        _this.nodes = [];
        _this.awaits = [];
        _this.children = [];
        _this.onCompletesActions = [];
      }
    });
    _this.onCompletesActions = [];

    _this.timeline.addLabel('beginning', 0);
    _this.configs = {};
    _this.children = [];
    _this.nodes = [];
    _this.awaits = [];
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
      // const farChildren = children.filter((item) => !item._time);
     if(this.timeline.paused()) {
       debugger;
     }
      if (children.indexOf(this.timeline) === -1) {
        animationMeta.timeline.add(this.timeline);
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
        this.timeline.play(0);
      });
    },
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
        tween = gsap.fromTo(viewNode.node,
          duration || 0,
          config.from || {},
          to);
      } else if (config.from) {
        let from = Object.assign({}, config.from || {});
        from.onComplete = onComplete;
        from.onStartParams = [viewNode];
        from.onStart = onStart;
        tween = gsap.from(viewNode.node,
          duration || 0,
          from || {});
      } else {
        tween = gsap.to(viewNode.node,
          duration || 0,
          to || {});
      }

      // if (_this.nodes.indexOf(viewNode) === -1) {
      //   _this.nodes.push({
      //     v: viewNode,
      //     t: tween,
      //     p: config.position
      //   });
      // }

      const time = _this.timeline._time;
      // _this.timeline.pause();
      // _this.timeline.clear();
      // const aliveNodes = _this.nodes.filter((actor) => !actor.v.destroyed.resolved);
      // console.log(aliveNodes);
      // aliveNodes.forEach((actor) => {
      //   // if (actor.v.destroyed.resolved) return;
      //
      //   // console.log(actor.v)
      //   _this.timeline.add(actor.t, actor.p || '+=0');
      // });

      // if (time) {
      //
      //   _this.timeline.play(time);
      // } else {
      // if(config.wait)debugger;
      _this.timeline.add(tween, config.position || '+=0');
      // _this.timeline.play(0);
      // }
    }
  };
  window.AM = AnimationMeta;
})(Galaxy);
