/* global Galaxy, gsap, TimelineLite */
'use strict';

(function (Galaxy) {
  if (!window.gsap || !window.TimelineLite) {
    return console.warn('please load GSAP - GreenSock in order to activate animations');
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
        viewNode.populateEnterSequence = function () {
          value.config = value.config || {};

          // if enterWithParent flag is there, then only apply animation only to the nodes are rendered
          if (value.config.withParent) {
            const parent = viewNode.parent;
            if (!parent.rendered.resolved) {
              return;
            }
          }

          if (gsap.getTweensOf(viewNode.node).length) {
            gsap.killTweensOf(viewNode.node);
          }

          AnimationMeta.installGSAPAnimation(viewNode, 'enter', enter, value.config);
        };
      }

      const leave = value.leave;
      if (leave) {
        // We need an empty enter animation in order to have a proper behavior for $if
        if (!enter && viewNode.schema.$if) {
          console.warn('The following node has `$if` and a `leave` animation but does NOT have a `enter` animation.' +
            '\nThis can result in unexpected UI behavior.\nTry to define a `enter` animation that negates the leave animation to prevent unexpected behavior\n\n');
          console.warn(viewNode.node);
        }

        viewNode.leaveWithParent = leave.withParent === true;
        viewNode.populateLeaveSequence = function (flag) {
          value.config = value.config || {};

          // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
          if (value.leave.withParent) {
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
          // in the case which the viewNode is not visible, then ignore its animation
          if (rect.width === 0 ||
            rect.height === 0 ||
            viewNode.node.style.opacity === '0' ||
            viewNode.node.style.visibility === 'hidden') {
            gsap.killTweensOf(viewNode.node);
            return Galaxy.View.ViewNode.REMOVE_SELF.call(viewNode, flag);
          }

          AnimationMeta.installGSAPAnimation(viewNode, 'leave', leave, value.config, Galaxy.View.ViewNode.REMOVE_SELF.bind(viewNode, flag));
        };
      } else {
        viewNode.populateLeaveSequence = function (flag) {
          AnimationMeta.installGSAPAnimation(viewNode, 'leave', {
            sequence: 'DESTROY',
            duration: .000001
          }, {}, Galaxy.View.ViewNode.REMOVE_SELF.bind(this, flag));
        };
      }

      const classAnimationsHandler = function () {
        viewNode.observer.on('classList', function (classes, oldClasses) {
          oldClasses = oldClasses || [];

          try {
            classes.forEach(function (item) {
              if (item && oldClasses.indexOf(item) === -1) {
                if (item.indexOf('@') === 0) {
                  const classEvent = value[item];
                  if (classEvent) {
                    viewNode.node.classList.remove(item);
                    AnimationMeta.installGSAPAnimation(viewNode, item, classEvent, value.config);
                  }

                  return;
                }

                const _config = value['+=' + item] || value['.' + item];
                if (!_config) {
                  return;
                }

                viewNode.node.classList.remove(item);
                AnimationMeta.installGSAPAnimation(viewNode, '+=' + item, _config, value.config);
              }
            });

            oldClasses.forEach(function (item) {
              if (item && classes.indexOf(item) === -1) {
                const _config = value['-=' + item] || value['.' + item];
                if (!_config) {
                  return;
                }

                viewNode.node.classList.add(item);
                AnimationMeta.installGSAPAnimation(viewNode, '-=' + item, _config, value.config);
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

  Galaxy.View.AnimationMeta = AnimationMeta;

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
      const animationMeta = new AnimationMeta(sequenceName);

      // By calling 'addTo' first, we can provide a parent for the 'animationMeta.timeline'
      if (newConfig.addTo) {
        animationMeta.addTo(newConfig.addTo, newConfig.positionInParent);
      }

      // Make sure the await step is added to highest parent as long as that parent is not the 'gsap.globalTimeline'
      if (newConfig.await && animationMeta.awaits.indexOf(newConfig.await) === -1) {
        let parent = animationMeta.timeline;
        while (parent.parent !== gsap.globalTimeline) {
          parent = parent.parent;
        }

        parent.add(() => {
          parent.pause();
          newConfig.await.then(() => {
            parent.resume();
          });
        });

        animationMeta.awaits.push(newConfig.await);
      }

      // add node with it's animation to the 'animationMeta.timeline'
      if (type === 'leave' && config.batchLeaveDOMManipulation !== false) {
        animationMeta.add(viewNode, newConfig, onComplete);
      } else {
        animationMeta.add(viewNode, newConfig, onComplete);
      }
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
    if (AnimationMeta.ANIMATIONS[name]) {
      return AnimationMeta.ANIMATIONS[name];
    }

    const _this = this;
    _this.name = name;
    _this.timeline = new TimelineLite({
      autoRemoveChildren: true,
      smoothChildTiming: false,
      paused: true,
      onComplete: function () {
        if (_this.parent) {
          _this.parent.timeline.remove(_this.timeline);
        }
        _this.onCompletesActions.forEach(function (action) {
          action(_this.timeline);
        });
        _this.nodes = [];
        _this.awaits = [];
        _this.children = [];
        _this.onCompletesActions = [];
        AnimationMeta.ANIMATIONS[name] = null;
      }
    });
    _this.onCompletesActions = [];
    _this.started = false;
    _this.configs = {};
    _this.children = [];
    _this.nodes = [];
    _this.awaits = [];
    _this.timelinesMap = [];

    AnimationMeta.ANIMATIONS[name] = this;
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
      const animationMeta = new AnimationMeta(sequenceName);
      const children = animationMeta.timeline.getChildren(false);
      if (children.indexOf(this.timeline) === -1) {
        animationMeta.timeline.add(this.timeline, pip);
        if (!animationMeta.started) {
          animationMeta.started = true;
          animationMeta.timeline.resume();
        }
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

      if (_this.timeline.getChildren(false).length === 0) {
        _this.timeline.add(tween);
      } else {
        _this.timeline.add(tween, config.position || '+=0');
      }

      if (!_this.started) {
        _this.started = true;
        _this.timeline.resume();
      }
    }
  };
  window.AM = AnimationMeta;
})(Galaxy);
