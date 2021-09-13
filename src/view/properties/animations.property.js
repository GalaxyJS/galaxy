/* global Galaxy, gsap */
(function (G) {
  if (!window.gsap) {
    G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
      type: 'prop',
      key: 'animations',
    };

    return console.warn('please load GSAP - GreenSock in order to activate animations');
  }

  function hasParentEnterAnimation(viewNode) {
    if (!viewNode.parent) return false;

    const parent = viewNode.parent;
    if (parent.blueprint.animations && parent.blueprint.animations.enter && gsap.getTweensOf(parent.node).length) {
      return true;
    }

    return hasParentEnterAnimation(viewNode.parent);
  }

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
    type: 'prop',
    key: 'animations',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param value
     */
    update: function (viewNode, value) {
      if (viewNode.virtual || !value) {
        return;
      }

      const enter = value.enter;
      if (enter) {
        viewNode.populateEnterSequence = function () {
          value.config = value.config || {};
          if (enter.withParent) {
            // if parent has a enter animation, then ignore this node's animation
            // so this node enters with its parent
            if (hasParentEnterAnimation(this)) {
              return;
            }

            const parent = this.parent;
            // if enter.withParent flag is there, then only apply animation to the nodes are rendered rendered
            if (!parent.rendered.resolved) {
              return;
            }
          }

          const _node = this.node;
          if (gsap.getTweensOf(_node).length) {
            gsap.killTweensOf(_node);
          }

          AnimationMeta.installGSAPAnimation(this, 'enter', enter, value.config, enter.onComplete);
        };
      }

      const leave = value.leave;
      if (leave) {
        // We need an empty enter animation in order to have a proper behavior for $if
        if (!enter && viewNode.blueprint.$if) {
          console.warn('The following node has `$if` and a `leave` animation but does NOT have a `enter` animation.' +
            '\nThis can result in unexpected UI behavior.\nTry to define a `enter` animation that negates the leave animation to prevent unexpected behavior\n\n');
          console.warn(viewNode.node);
        }

        viewNode.leaveWithParent = leave.withParent === true;
        viewNode.populateLeaveSequence = function (onComplete) {
          const _node = this.node;

          value.config = value.config || {};
          if (leave.withParent) {
            // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
            const parent = this.parent;

            if (parent.transitory) {
              if (gsap.getTweensOf(_node).length) {
                gsap.killTweensOf(_node);
              }

              // We dump this _viewNode so it gets removed when the leave animation origin node is detached.
              // This fixes a bug where removed elements stay in DOM if the cause of the leave animation is a $if
              return this.dump();
            }
          }

          if (gsap.getTweensOf(_node).length) {
            gsap.killTweensOf(_node);
          }

          // in the case which the _viewNode is not visible, then ignore its animation
          const rect = _node.getBoundingClientRect();
          if (rect.width === 0 ||
            rect.height === 0 ||
            _node.style.opacity === '0' ||
            _node.style.visibility === 'hidden') {
            gsap.killTweensOf(_node);
            return onComplete();
          }

          AnimationMeta.setupOnComplete(leave, onComplete);
          AnimationMeta.installGSAPAnimation(this, 'leave', leave, value.config, leave.onComplete);
        };

        // Hide sequence is the same as leave sequence.
        // The only difference is that hide sequence will add `display: 'none'` to the node at the end
        viewNode.populateHideSequence = viewNode.populateLeaveSequence.bind(viewNode, () => {
          viewNode.node.style.display = 'none';
        });
      } else {
        viewNode.populateLeaveSequence = function (onComplete) {
          if (gsap.getTweensOf(this.node).length) {
            gsap.killTweensOf(this.node);
          }

          AnimationMeta.installGSAPAnimation(this, 'leave', {
            sequence: 'DESTROY',
            duration: 0
          }, {}, onComplete);
        };
      }
    }
  };

  G.View.AnimationMeta = AnimationMeta;

  /**
   *
   * @typedef {Object} AnimationConfig
   * @property {string} [sequence]
   * @property {Promise} [await]
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
   * @property {number} [duration]
   * @property {object} [from]
   * @property {object} [to]
   * @property {string} [addTo]
   * @property {Function} [onStart]
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
      to = Object.assign({ duration: duration }, to);

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
      tween = gsap.fromTo(node, from, to);
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

      from.duration = duration;
      tween = gsap.from(node, from);
    } else if (to) {
      tween = gsap.to(node, duration, to);
    } else {
      onComplete();
    }

    return tween;
  };

  AnimationMeta.createStep = function (stepDescription, onStart, onComplete, viewNode) {
    const step = Object.assign({}, stepDescription);
    step.callbackScope = viewNode;
    step.onStart = onStart;
    step.onComplete = onComplete;

    return step;
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

  AnimationMeta.setupOnComplete = function (step, onComplete) {
    if (step.onComplete) {
      const userDefinedOnComplete = step.onComplete;
      step.onComplete = function () {
        userDefinedOnComplete();
        onComplete();
      };
    } else {
      step.onComplete = onComplete;
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'enter'|'leave'|'class-add'|'class-remove'} type
   * @param {AnimationConfig} descriptions
   * @param config
   * @param {Function} onComplete
   */
  AnimationMeta.installGSAPAnimation = function (viewNode, type, descriptions, config, onComplete) {
    const from = AnimationMeta.parseStep(viewNode, descriptions.from);
    let to = AnimationMeta.parseStep(viewNode, descriptions.to);

    if (type !== 'leave' && to) {
      to.clearProps = to.hasOwnProperty('clearProps') ? to.clearProps : 'all';
    }

    if (type.indexOf('add:') === 0 || type.indexOf('remove:') === 0) {
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

    let parentAnimationMeta = null;
    if (sequenceName) {
      const animationMeta = new AnimationMeta(sequenceName);

      // By calling 'addTo' first, we can provide a parent for the 'animationMeta.timeline'
      if (newConfig.addTo) {
        parentAnimationMeta = new AnimationMeta(newConfig.addTo);
        const children = parentAnimationMeta.timeline.getChildren(false);
        if (children.indexOf(animationMeta.timeline) === -1) {
          parentAnimationMeta.timeline.add(animationMeta.timeline, newConfig.positionInParent);
        }
      }

      // Make sure the await step is added to highest parent as long as that parent is not the 'gsap.globalTimeline'
      if (newConfig.await && animationMeta.awaits.indexOf(newConfig.await) === -1) {
        let parent = animationMeta.timeline;

        while (parent.parent !== gsap.globalTimeline) {
          if (!parent.parent) return;
          parent = parent.parent;
        }

        parent.add(() => {
          if (viewNode.destroyed.resolved) {
            return;
          }

          parent.pause();

          const removeAwait = () => {
            const index = animationMeta.awaits.indexOf(newConfig.await);
            if (index !== -1) {
              animationMeta.awaits.splice(index, 1);
            }
            parent.resume();
          };
          // We don't want the animation wait for the await, if this `viewNode` is destroyed before await gets a chance
          // to be resolved. Therefore, we need to remove await.
          viewNode.finalize.push(removeAwait);

          newConfig.await.then(() => {
            const index = animationMeta.awaits.indexOf(newConfig.await);
            if (index !== -1) {
              animationMeta.awaits.splice(index, 1);
            }
            parent.resume();
          });
        }, newConfig.position);

        animationMeta.awaits.push(newConfig.await);
      }

      animationMeta.add(viewNode, newConfig, onComplete);

      // In the case where the addToAnimationMeta.timeline has no child then animationMeta.timeline would be
      // its only child and we have to resume it if it's not playing
      if (newConfig.addTo && parentAnimationMeta) {
        // const addToAnimationMeta = new AnimationMeta(newConfig.addTo);
        if (!parentAnimationMeta.started) {
          parentAnimationMeta.started = true;
          parentAnimationMeta.timeline.resume();
        }
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
    _this.timeline = gsap.timeline({
      autoRemoveChildren: true,
      smoothChildTiming: false,
      paused: true,
      onComplete: function () {
        _this.onCompletesActions.forEach((action) => {
          action(_this.timeline);
        });
        _this.nodes = [];
        _this.awaits = [];
        _this.children = [];
        _this.onCompletesActions = [];
        AnimationMeta.ANIMATIONS[name] = null;
      }
    });
    _this.timeline.data = { name };
    _this.onCompletesActions = [];
    _this.started = false;
    _this.configs = {};
    _this.children = [];
    _this.nodes = [];
    _this.awaits = [];
    _this.timelinesMap = [];

    AnimationMeta.ANIMATIONS[name] = this;
  }

  AnimationMeta.prototype = {
    addOnComplete: function (action) {
      this.onCompletesActions.push(action);
    },
    addTo(sequenceName, pip) {
      const parent = new AnimationMeta(sequenceName);
      const children = parent.timeline.getChildren(false);
      if (children.indexOf(this.timeline) === -1) {
        parent.timeline.add(this.timeline, pip);
      }
    },

    /**
     *
     * @param viewNode
     * @param config {AnimationConfig}
     * @param onComplete
     */
    add: function (viewNode, config, onComplete) {
      const _this = this;
      let tween = null;
      let duration = config.duration;
      if (duration instanceof Function) {
        duration = config.duration.call(viewNode);
      }

      if (config.from && config.to) {
        const to = AnimationMeta.createStep(config.to, config.onStart, onComplete, viewNode);
        to.duration = duration || 0;
        tween = gsap.fromTo(viewNode.node, config.from, to);
      } else if (config.from) {
        const from = AnimationMeta.createStep(config.from, config.onStart, onComplete, viewNode);
        from.duration = duration || 0;
        tween = gsap.from(viewNode.node, from);
      } else {
        const to = AnimationMeta.createStep(config.to, config.onStart, onComplete, viewNode);
        to.duration = duration || 0;
        tween = gsap.to(viewNode.node, to);
      }

      const tChildren = _this.timeline.getChildren(false);
      if (tChildren.length === 0) {
        _this.timeline.add(tween);
      }
      // This fix a bug where if the enter animation has addTo, then the leave animation is ignored
      else if (tChildren.length === 1 && !tChildren[0].hasOwnProperty('timeline')) {
        _this.timeline.clear();
        _this.timeline.add(tween, config.position || '+=0');
      } else {
        _this.timeline.add(tween, config.position || '+=0');
      }

      if (!_this.started) {
        _this.started = true;
        _this.timeline.resume();
      }
    }
  };
})(Galaxy);
