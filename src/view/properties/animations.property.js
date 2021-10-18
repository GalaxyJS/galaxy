/* global Galaxy, gsap */
(function (G) {
  if (!window.gsap) {
    G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
      type: 'prop',
      key: 'animations',
      /**
       *
       * @param {Galaxy.View.ViewNode} viewNode
       * @param value
       */
      update: function (viewNode, value) {
        if (value.enter && value.enter.onComplete) {
          viewNode.populateEnterSequence = value.enter.onComplete;
        }
        viewNode.populateLeaveSequence = (onComplete) => {
          onComplete();
        };
      }
    };

    window.gsap = {
      to: function (node, props) {
        requestAnimationFrame(() => {
          if (typeof node === 'string') {
            node = document.querySelector(node);
          }

          const style = node.style;
          if (style) {
            const keys = Object.keys(props);
            for (let i = 0, len = keys.length; i < len; i++) {
              const key = keys[i];
              const value = props[key];
              switch (key) {
                case 'duration':
                case 'ease':
                  break;

                case 'opacity':
                case 'z-index':
                  style.setProperty(key, value);
                  break;

                case 'scrollTo':
                  node.scrollTop = typeof value.y === 'string' ? document.querySelector(value.y).offsetTop : value.y;
                  node.scrollLeft = typeof value.x === 'string' ? document.querySelector(value.x).offsetLeft : value.x;
                  break;

                default:
                  style.setProperty(key, typeof value === 'number' && value !== 0 ? value + 'px' : value);
              }
            }
          } else {
            Object.assign(node, props);
          }
        });
      },
    };

    console.info('%cPlease load GSAP - GreenSock in order to activate animations', 'color: yellowgreen; font-weight: bold;');
    console.info('%cYou can implement most common animations by loading the following resources', 'color: yellowgreen;');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/gsap.min.js');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/ScrollToPlugin.min.js');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/EasePack.min.js\n\n');
    return;
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

          AnimationMeta.installGSAPAnimation(this, 'enter', enter);
        };
      }

      const leave = value.leave;
      if (leave) {
        // We need an empty enter animation in order to have a proper behavior for if
        if (!enter && viewNode.blueprint.if) {
          console.warn('The following node has `if` and a `leave` animation but does NOT have a `enter` animation.' +
            '\nThis can result in unexpected UI behavior.\nTry to define a `enter` animation that negates the leave animation to prevent unexpected behavior\n\n');
          console.warn(viewNode.node);
        }

        viewNode.populateLeaveSequence = function (finalize) {
          const active = AnimationMeta.parseStep(viewNode, leave.active);
          if (active === false) {
            return leave_with_parent.call(viewNode, finalize);
          }

          const withParentResult = AnimationMeta.parseStep(viewNode, leave.withParent);
          viewNode.leaveWithParent = withParentResult === true;
          const _node = this.node;
          if (gsap.getTweensOf(_node).length) {
            gsap.killTweensOf(_node);
          }

          if (withParentResult) {
            // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
            const parent = this.parent;
            if (parent.transitory) {
              // We dump this _viewNode so it gets removed when the leave's animation's origin node is detached.
              // This fixes a bug where removed elements stay in DOM if the cause of the leave animation is a if
              return this.dump();
            }
          }

          // in the case which the _viewNode is not visible, then ignore its animation
          const rect = _node.getBoundingClientRect();
          if (rect.width === 0 ||
            rect.height === 0 ||
            _node.style.opacity === '0' ||
            _node.style.visibility === 'hidden') {
            gsap.killTweensOf(_node);
            return finalize();
          }

          AnimationMeta.installGSAPAnimation(this, 'leave', leave, finalize);
        };

        // Hide timeline is the same as leave timeline.
        // The only difference is that hide timeline will add `display: 'none'` to the node at the end
        viewNode.populateHideSequence = viewNode.populateLeaveSequence.bind(viewNode, () => {
          viewNode.node.style.display = 'none';
        });
      } else {
        // By default, imitate leave with parent behavior
        viewNode.populateLeaveSequence = leave_with_parent.bind(viewNode);
      }

      if (viewNode.cache.class && viewNode.cache.class.observer) {
        viewNode.rendered.then(function () {
          viewNode.cache.class.observer.onAll((key) => {

          });
        });
      }
    }
  };

  function leave_with_parent(finalize) {
    if (gsap.getTweensOf(this.node).length) {
      gsap.killTweensOf(this.node);
    }

    if (this.parent.transitory) {
      this.dump();
    } else {
      finalize();
    }
  }

  G.View.AnimationMeta = AnimationMeta;

  /**
   *
   * @typedef {Object} AnimationConfig
   * @property {string} [timeline]
   * @property {Promise} [await]
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
   * @property {number} [duration]
   * @property {object} [from]
   * @property {object} [to]
   * @property {string} [addTo]
   * @property {Function} [onStart]
   * @property {Function} [onComplete]
   */

  AnimationMeta.ANIMATIONS = {};
  AnimationMeta.TIMELINES = {};

  AnimationMeta.createSimpleAnimation = function (viewNode, config, finalize) {
    finalize = finalize || G.View.EMPTY_CALL;
    const node = viewNode.node;
    let from = AnimationMeta.parseStep(viewNode, config.from);
    let to = AnimationMeta.parseStep(viewNode, config.to);
    const duration = AnimationMeta.parseStep(viewNode, config.duration) || 0;

    if (to) {
      to = Object.assign({}, to);
      to.duration = duration;
      to.onComplete = finalize;

      if (config.onComplete) {
        const userDefinedOnComplete = config.onComplete;
        to.onComplete = function () {
          userDefinedOnComplete();
          finalize();
        };
      }
    }

    let tween;
    if (from && to) {
      tween = gsap.fromTo(node, from, to);
    } else if (from) {
      from = Object.assign({}, from);
      from.duration = duration;
      from.onComplete = finalize;

      if (config.onComplete) {
        const userDefinedOnComplete = config.onComplete;
        from.onComplete = function () {
          userDefinedOnComplete();
          finalize();
        };
      }

      tween = gsap.from(node, from);
    } else if (to) {
      tween = gsap.to(node, to);
    } else if (config.onComplete) {
      const userDefinedOnComplete = config.onComplete;
      const onComplete = function () {
        userDefinedOnComplete();
        finalize();
      };

      tween = gsap.to(node, {
        duration: duration,
        onComplete: onComplete
      });
    } else {
      tween = gsap.to(node, {
        duration: duration,
        onComplete: finalize
      });
    }

    return tween;
  };

  /**
   *
   * @param stepDescription
   * @param onStart
   * @param onComplete
   * @param viewNode
   * @return {*}
   */
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
      return step.call(node, node.data);
    }

    return step;
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'enter'|'leave'|'class-add'|'class-remove'} type
   * @param {AnimationConfig} descriptions
   * @param {Function} [finalize]
   */
  AnimationMeta.installGSAPAnimation = function (viewNode, type, descriptions, finalize) {
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
    let timelineName = newConfig.timeline;

    if (newConfig.timeline instanceof Function) {
      timelineName = newConfig.timeline.call(viewNode);
    }

    let parentAnimationMeta = null;
    if (timelineName) {
      const animationMeta = new AnimationMeta(timelineName);

      // if(sequenceName === 'dots')debugger;
      // viewNode.index;
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
        let parentTimeline = animationMeta.timeline;
        // console.log(parentTimeline.getChildren(false));
        while (parentTimeline.parent !== gsap.globalTimeline) {
          if (!parentTimeline.parent) return;
          parentTimeline = parentTimeline.parent;
        }

        animationMeta.awaits.push(newConfig.await);

        // The pauseTween will be removed from the parentTimeline by GSAP the moment the pause is hit
        const pauseTween = parentTimeline.addPause(newConfig.position, () => {
          if (viewNode.transitory || viewNode.destroyed.resolved) {
            return parentTimeline.resume();
          }

          newConfig.await.then(removeAwait);
        }).recent();

        const removeAwait = ((_pause) => {
          const index = animationMeta.awaits.indexOf(newConfig.await);
          if (index !== -1) {
            animationMeta.awaits.splice(index, 1);
            // Do not remove the pause if it is already executed
            if (_pause._initted) {
              parentTimeline.resume();
            } else {
              const children = parentTimeline.getChildren(false);
              if (children.indexOf(_pause) !== -1) {
                parentTimeline.remove(_pause);
              }
            }
          }
        }).bind(null, pauseTween);
        // We don't want the animation wait for the await, if this `viewNode` is destroyed before await gets a chance
        // to be resolved. Therefore, we need to remove await.
        viewNode.finalize.push(removeAwait);
      }

      animationMeta.add(viewNode, newConfig, finalize);

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
      AnimationMeta.createSimpleAnimation(viewNode, newConfig, finalize);
    }
  };

  /**
   *
   * @param {string} name
   * @class
   */
  function AnimationMeta(name) {
    const exist = AnimationMeta.ANIMATIONS[name];
    if (exist) {
      if (!exist.timeline.getChildren().length && !exist.timeline.isActive()) {
        exist.timeline.clear();
        exist.timeline.invalidate();
      }
      return exist;
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
     * @param finalize
     */
    add: function (viewNode, config, finalize) {
      const _this = this;
      let tween = null;
      let duration = config.duration;
      if (duration instanceof Function) {
        duration = config.duration.call(viewNode);
      }

      if (config.from && config.to) {
        const to = AnimationMeta.createStep(config.to, config.onStart, config.onComplete, viewNode);
        to.duration = duration || 0;
        tween = gsap.fromTo(viewNode.node, config.from, to);
      } else if (config.from) {
        const from = AnimationMeta.createStep(config.from, config.onStart, config.onComplete, viewNode);
        from.duration = duration || 0;
        tween = gsap.from(viewNode.node, from);
      } else {
        const to = AnimationMeta.createStep(config.to, config.onStart, config.onComplete, viewNode);
        to.duration = duration || 0;
        tween = gsap.to(viewNode.node, to);
      }

      if (finalize) {
        if (tween.vars.onComplete) {
          const userDefinedOnComplete = tween.vars.onComplete;
          return function () {
            userDefinedOnComplete.apply(this, arguments);
            finalize();
          };
        } else {
          tween.vars.onComplete = finalize;
        }
      }

      const tChildren = _this.timeline.getChildren(false);
      const firstChild = tChildren[0];
      if (tChildren.length === 0) {
        _this.timeline.add(tween);
      }
      // This fix a bug where if the enter animation has addTo, then the leave animation is ignored
      else if (tChildren.length === 1 && !firstChild.hasOwnProperty('timeline') && firstChild.getChildren(false).length === 0) {
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
