/* global Galaxy, gsap */
(function (G) {
  if (!window.gsap) {
    G.setupTimeline = function () {};
    G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
      type: 'prop',
      key: 'animations',
      /**
       *
       * @param {Galaxy.View.ViewNode} viewNode
       * @param animationDescriptions
       */
      update: function (viewNode, animationDescriptions) {
        if (animationDescriptions.enter && animationDescriptions.enter.to.onComplete) {
          viewNode.processEnterAnimation = animationDescriptions.enter.to.onComplete;
        }
        viewNode.processLeaveAnimation = (onComplete) => {
          onComplete();
        };
      }
    };

    window.gsap = {
      to: function (node, props) {
        return requestAnimationFrame(() => {
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

    console.info('%cIn order to activate animations, load GSAP - GreenSock', 'color: yellowgreen; font-weight: bold;');
    console.info('%cYou can implement most common animations by loading the following resources before galaxy.js', 'color: yellowgreen;');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/gsap.min.js');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/ScrollToPlugin.min.js');
    console.info('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/EasePack.min.js\n\n');
    return;
  }

  function has_parent_enter_animation(viewNode) {
    if (!viewNode.parent) return false;

    const parent = viewNode.parent;
    if (parent.blueprint.animations && parent.blueprint.animations.enter && gsap.getTweensOf(parent.node).length) {
      return true;
    }

    return has_parent_enter_animation(viewNode.parent);
  }

  const document_body = document.body;

  G.View.NODE_BLUEPRINT_PROPERTY_MAP['animations'] = {
    type: 'prop',
    key: 'animations',
    /**
     *
     * @param {Galaxy.View.ViewNode} viewNode
     * @param animations
     */
    update: function (viewNode, animations) {
      if (viewNode.virtual || !animations) {
        return;
      }

      const enter = animations.enter;
      if (enter) {
        viewNode.processEnterAnimation = function () {
          process_enter_animation(this, enter);
        };
      }

      const leave = animations.leave;
      if (leave) {
        // We need an empty enter animation in order to have a proper behavior for if
        if (!enter && viewNode.blueprint.if) {
          console.warn('The following node has `if` and a `leave` animation but does NOT have a `enter` animation.' +
            '\nThis can result in unexpected UI behavior.\nTry to define a `enter` animation that negates the leave animation to prevent unexpected behavior\n\n');
          console.warn(viewNode.node);
        }

        viewNode.processLeaveAnimation = function (finalize) {
          process_leave_animation(this, leave, finalize);
        };

        // Hide timeline is the same as leave timeline.
        // The only difference is that hide timeline will add `display: 'none'` to the node at the end
        viewNode.populateHideSequence = viewNode.processLeaveAnimation.bind(viewNode, () => {
          viewNode.node.style.display = 'none';
        });
      } else {
        // By default, imitate leave with parent behavior
        viewNode.processLeaveAnimation = leave_with_parent.bind(viewNode);
      }

      const viewNodeCache = viewNode.cache;
      if (viewNodeCache.class && viewNodeCache.class.observer) {
        viewNode.rendered.then(function () {
          const classes = viewNodeCache.class.observer.context;

          // Apply final state for class animations
          for (const key in classes) {
            const type = Boolean(classes[key]);
            const animationConfig = get_class_based_animation_config(animations, type, key);
            if (animationConfig) {
              if (animationConfig.to.keyframes instanceof Array) {
                for (let i = 0, len = animationConfig.to.keyframes.length; i < len; i++) {
                  gsap.set(viewNode.node, Object.assign({ callbackScope: viewNode }, animationConfig.to.keyframes[i] || {}));
                }
              } else {
                gsap.set(viewNode.node, Object.assign({ callbackScope: viewNode }, animationConfig.to || {}));
              }

              if (type) {
                viewNode.node.classList.add(key);
              } else {
                viewNode.node.classList.remove(key);
              }
            }
          }

          let oldHash = JSON.stringify(classes);
          viewNodeCache.class.observer.onAll((className) => {
            const newHash = JSON.stringify(classes);
            if (oldHash === newHash) {
              return;
            }

            oldHash = newHash;
            const addOrRemove = Boolean(classes[className]);
            const animationConfig = get_class_based_animation_config(animations, addOrRemove, className);

            if (animationConfig) {
              const tweenKey = 'tween:' + className;
              if (viewNodeCache[tweenKey]) {
                viewNodeCache[tweenKey].forEach(t => t.kill());
                Reflect.deleteProperty(viewNodeCache, tweenKey);
              }

              // if(!viewNode.rendered.resolved) {
              //   console.log(viewNode.node)
              // }

              process_class_animation(viewNode, viewNodeCache, tweenKey, animationConfig, addOrRemove, className);
            }
          });
        });
      }
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {AnimationConfig} animationConfig
   * @returns {*}
   */
  function process_enter_animation(viewNode, animationConfig) {
    const _node = viewNode.node;
    if (animationConfig.withParent) {
      // if parent has an enter animation, then ignore viewNode's animation
      // so viewNode can enter with its parent
      if (has_parent_enter_animation(viewNode)) {
        return gsap.set(_node, Object.assign({}, animationConfig.to || {}));
      }

      const parent = viewNode.parent;
      // if enter.withParent flag is there, then only apply animation to the nodes are rendered
      if (!parent.rendered.resolved) {
        return;
      }
    }

    if (gsap.getTweensOf(_node).length) {
      gsap.killTweensOf(_node);
    }

    // if a parent node is rendered detached, then this node won't be in the DOM
    // therefore, their animations should be ignored.
    if (!document_body.contains(_node)) {
      // console.log(_node);
      // if the node is not part of the DOM/body then probably it's being rendered detached,
      // and we should skip its enter animation
      return;
    }

    AnimationMeta.installGSAPAnimation(viewNode, 'enter', animationConfig);
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {AnimationConfig} animationConfig
   * @param {Function} [finalize]
   */
  function process_leave_animation(viewNode, animationConfig, finalize) {
    const active = animationConfig.active;
    if (active === false) {
      return leave_with_parent.call(viewNode, finalize);
    }

    const withParentResult = animationConfig.withParent;
    viewNode.leaveWithParent = withParentResult === true;
    const _node = viewNode.node;
    // if (gsap.getTweensOf(_node).length) {
    //   gsap.killTweensOf(_node);
    // }

    if (withParentResult) {
      // if the leaveWithParent flag is there, then apply animation only to non-transitory nodes
      const parent = viewNode.parent;
      if (parent.transitory) {
        gsap.killTweensOf(_node);
        // We dump _node, so it gets removed when the leave's animation's origin node is detached.
        // This fixes a bug where removed elements stay in DOM if the cause of the leave animation is a 'if'
        return viewNode.dump();
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

    const tweens = gsap.getTweensOf(_node);
    for (const t of tweens) {
      if (t.parent) {
        t.parent.pause();
        t.parent.remove(t);
      } else {
        t.pause();
      }
    }

    AnimationMeta.installGSAPAnimation(viewNode, 'leave', animationConfig, finalize);
  }

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {Object} viewNodeCache
   * @param {string} tweenKey
   * @param {AnimationConfig} animationConfig
   * @param {boolean} addOrRemove
   * @param {string} className
   */
  function process_class_animation(viewNode, viewNodeCache, tweenKey, animationConfig, addOrRemove, className) {
    const IN_NEXT_FRAME = addOrRemove ? G.View.create_in_next_frame : G.View.destroy_in_next_frame;
    IN_NEXT_FRAME(viewNode.index, (_next) => {
      const tweenExist = Boolean(viewNodeCache[tweenKey]);

      if (addOrRemove && (!viewNode.node.classList.contains(className) || tweenExist)) {
        AnimationMeta.setupOnComplete(animationConfig, () => {
          viewNode.node.classList.add(className);
        });
      } else if (!addOrRemove && (viewNode.node.classList.contains(className) || tweenExist)) {
        AnimationMeta.setupOnComplete(animationConfig, () => {
          viewNode.node.classList.remove(className);
        });
      }

      viewNodeCache[tweenKey] = viewNodeCache[tweenKey] || [];
      viewNodeCache[tweenKey].push(AnimationMeta.installGSAPAnimation(viewNode, null, animationConfig));
      _next();
    });
  }

  /**
   *
   * @param {*} animations
   * @param {boolean} type
   * @param {string} key
   * @returns {*}
   */
  function get_class_based_animation_config(animations, type, key) {
    const animationKey = type ? 'add:' + key : 'remove:' + key;
    return animations[animationKey];
  }

  function leave_with_parent(finalize) {
    // if (gsap.getTweensOf(this.node).length) {
    //   gsap.killTweensOf(this.node);
    // }
    const tweens = gsap.getTweensOf(this.node);
    for (const t of tweens) {
      if (t.parent) {
        // t.pause();
        t.parent.pause();
        t.parent.remove(t);
      } else {
        t.pause();
      }
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
   * @property {boolean} [withParent]
   * @property {string} [timeline]
   * @property {string[]} [labels]
   * @property {Promise} [await]
   * @property {string|number} [startPosition]
   * @property {string|number} [positionInParent]
   * @property {string|number} [position]
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
    let from = config.from;
    let to = config.to;

    if (to) {
      to = Object.assign({}, to);
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
        duration: config.duration || 0,
        onComplete: onComplete
      });
    } else {

      tween = gsap.to(node, {
        duration: config.duration || 0,
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
  AnimationMeta.addCallbackScope = function (stepDescription, viewNode) {
    const step = Object.assign({}, stepDescription);
    step.callbackScope = viewNode;

    return step;
  };

  AnimationMeta.setupOnComplete = function (description, onComplete) {
    if (description.onComplete) {
      const userDefinedOnComplete = description.onComplete;
      description.onComplete = function () {
        userDefinedOnComplete();
        onComplete();
      };
    } else {
      description.onComplete = () => {
        onComplete();
      };
    }
  };

  /**
   *
   * @param {Galaxy.View.ViewNode} viewNode
   * @param {'enter'|'leave'|null} type
   * @param {AnimationConfig} descriptions
   * @param {Function} [finalize]
   */
  AnimationMeta.installGSAPAnimation = function (viewNode, type, descriptions, finalize) {
    const from = descriptions.from;
    let to = descriptions.to;

    if (type !== 'leave' && to && viewNode.node.nodeType !== Node.COMMENT_NODE) {
      to.clearProps = to.hasOwnProperty('clearProps') ? to.clearProps : 'all';
    }

    // if (type.indexOf('add:') === 0 || type.indexOf('remove:') === 0) {
    //   to = Object.assign(to || {}, { overwrite: 'none' });
    // }
    /** @type {AnimationConfig} */
    const newConfig = Object.assign({}, descriptions);
    newConfig.from = from;
    newConfig.to = to;
    let timelineName = newConfig.timeline;

    let parentAnimationMeta = null;
    if (timelineName) {
      const animationMeta = new AnimationMeta(timelineName);
      // Class animation do not have a type since their `enter` and `leave` states are not the same a
      // node's `enter` and `leave`. A class can be added or in other word, have an `enter` state while its timeline
      // is in a `leave` state or vice versa.
      type = type || animationMeta.type;
      // By calling 'addTo' first, we can provide a parent for the 'animationMeta.timeline'
      // if (newConfig.addTo) {
      //   parentAnimationMeta = new AnimationMeta(newConfig.addTo);
      //   const children = parentAnimationMeta.timeline.getChildren(false);
      //   if (children.indexOf(animationMeta.timeline) === -1) {
      //     parentAnimationMeta.timeline.add(animationMeta.timeline, parentAnimationMeta.parsePosition(newConfig.positionInParent));
      //   }
      // }

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
        // We don't want the animation wait for await, if this `viewNode` is destroyed before await gets a chance
        // to be resolved. Therefore, we need to remove await.
        viewNode.finalize.push(() => {
          // if the element is removed before await is resolved, then make sure the element stays hidden
          if (animationMeta.awaits.indexOf(newConfig.await) !== -1 && viewNode.node.style) {
            viewNode.node.style.display = 'none';
          }
          removeAwait();
        });
      }

      // The first tween of an animation type(enter or leave) should use startPosition
      if (animationMeta.type && animationMeta.type !== type && !newConfig.keyframe && (newConfig.position && newConfig.position.indexOf('=') !== -1)) {
        // newConfig.position = newConfig.startPosition;
      }

      const children = animationMeta.timeline.getChildren(false);
      if (children.length) {
        const lastTween = children[children.length - 1];
        if (lastTween.data === 'timeline:start') {
          newConfig.position = '+=0';
        }
      }

      animationMeta.type = type;
      // console.log(newConfig)
      const tween = animationMeta.add(viewNode, newConfig, finalize);

      // In the case where the addToAnimationMeta.timeline has no child then animationMeta.timeline would be
      // its only child and, we have to resume it if it's not playing
      if (newConfig.addTo && parentAnimationMeta) {
        if (!parentAnimationMeta.started /*&& parentAnimationMeta.name !== '<user-defined>'*/) {
          parentAnimationMeta.started = true;
          parentAnimationMeta.timeline.resume();
        }
      }

      return tween;
    } else {
      return AnimationMeta.createSimpleAnimation(viewNode, newConfig, finalize);
    }
  };

  const TIMELINE_SETUP_MAP = {};
  G.setupTimeline = function (name, labels) {
    TIMELINE_SETUP_MAP[name] = labels;
    const animationMeta = AnimationMeta.ANIMATIONS[name];
    if (animationMeta) {
      animationMeta.setupLabels(labels);
    }
  };
  Galaxy.TIMELINE_SETUP_MAP = TIMELINE_SETUP_MAP;

  /**
   *
   * @param {string} name
   * @class
   */
  function AnimationMeta(name) {
    const _this = this;
    if (name && typeof name !== 'string') {
      if (name.__am__) {
        return name.__am__;
      }

      const onComplete = name.eventCallback('onComplete') || Galaxy.View.EMPTY_CALL;

      _this.name = '<user-defined>';
      _this.timeline = name;
      _this.timeline.__am__ = this;
      _this.timeline.eventCallback('onComplete', function () {
        onComplete.call(_this.timeline);
        _this.onCompletesActions.forEach((action) => {
          action(_this.timeline);
        });
        _this.nodes = [];
        _this.awaits = [];
        _this.children = [];
        _this.onCompletesActions = [];
      });
      _this.parsePosition = (p) => p;
    } else {
      const exist = AnimationMeta.ANIMATIONS[name];
      if (exist) {
        if (!exist.timeline.getChildren().length && !exist.timeline.isActive()) {
          exist.timeline.clear(false);
          exist.timeline.invalidate();
        }
        return exist;
      }

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
      _this.labelCounter = 0;
      _this.labelsMap = {};

      const labels = TIMELINE_SETUP_MAP[name];
      if (labels) {
        _this.setupLabels(labels);
      }

      AnimationMeta.ANIMATIONS[name] = this;
    }

    _this.type = null;
    _this.onCompletesActions = [];
    _this.started = false;
    _this.configs = {};
    _this.children = [];
    _this.nodes = [];
    _this.awaits = [];
  }

  AnimationMeta.prototype = {
    setupLabels: function (labels) {
      for (const label in labels) {
        const newLabel = 'label_' + this.labelCounter++;
        const position = labels[label];
        this.labelsMap[label] = newLabel;
        this.timeline.addLabel(newLabel, typeof position === 'number' ? '+=' + position : position);
      }
    },
    parsePosition: function (p) {
      let position = this.labelsMap[p] || p;
      let label = null;
      if (position || typeof position === 'number') {
        if (position.indexOf('+=') !== -1) {
          const parts = position.split('+=');
          label = parts[0];
        } else if (position.indexOf('-=') !== -1) {
          const parts = position.split('-=');
          label = parts[0];
        }
      }

      if (label && label !== '<' && label !== '>') {
        position = position.replace(label, this.labelsMap[label]);
      }
      return position;
    },
    addOnComplete: function (action) {
      this.onCompletesActions.push(action);
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

      if (config.from && config.to) {
        const to = AnimationMeta.addCallbackScope(config.to, viewNode);
        tween = gsap.fromTo(viewNode.node, config.from, to);
      } else if (config.from) {
        const from = AnimationMeta.addCallbackScope(config.from, viewNode);
        tween = gsap.from(viewNode.node, from);
      } else {
        const to = AnimationMeta.addCallbackScope(config.to, viewNode);
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

      const position = this.parsePosition(config.position);
      const tChildren = _this.timeline.getChildren(false);
      const firstChild = tChildren[0];
      // console.log(config)

      if (tChildren.length === 0) {
        // if the tween is the very first child then its position can not be negative
        _this.timeline.add(tween, (position && position.indexOf('-=') === -1) ? position : null);
      } else if (tChildren.length === 1 && !firstChild.hasOwnProperty('timeline') && firstChild.getChildren(false).length === 0) {
        // This fix a bug where if the 'enter' animation has addTo, then the 'leave' animation is ignored
        debugger
        _this.timeline.clear(false);
        _this.timeline.add(tween, position);
      } else {
        _this.timeline.add(tween, position);
      }

      if (_this.name === '<user-defined>')
        return tween;

      if (!_this.started) {
        _this.started = true;
        _this.timeline.resume();
      } else if (_this.timeline.paused()) {
        _this.timeline.resume();
      }

      return tween;
    }
  };
})(Galaxy);
