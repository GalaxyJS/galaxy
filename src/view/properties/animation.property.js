/* global Galaxy, TweenLite, TimelineLite */
'use strict';

(function (G) {
  G.GalaxyView.NODE_SCHEMA_PROPERTY_MAP['animation'] = {
    type: 'custom',
    name: 'animation',
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
      let enterAnimationConfig = config[':enter'];
      if (enterAnimationConfig) {
        viewNode.populateEnterSequence = function (sequence) {
          sequence.next(function (done) {
            if (enterAnimationConfig.sequence) {
              let animationMeta = AnimationMeta.get(enterAnimationConfig.sequence);
              animationMeta.duration = enterAnimationConfig.duration;
              animationMeta.position = enterAnimationConfig.position;
              animationMeta.NODE = viewNode;

              let lastStep = enterAnimationConfig.to || enterAnimationConfig.from;
              lastStep.clearProps = 'all';
              animationMeta.add(viewNode.node, enterAnimationConfig, done);

              // Add to parent should happen after the animation is added to the child
              if (enterAnimationConfig.parent) {
                const parent = AnimationMeta.get(enterAnimationConfig.parent);
                parent.addChild(animationMeta);
              }
            } else {
              let lastStep = enterAnimationConfig.to || enterAnimationConfig.from;
              lastStep.clearProps = 'all';
              AnimationMeta.createTween(viewNode.node, enterAnimationConfig, done);
            }
          });
        };
      }

      let leaveAnimationConfig = config[':leave'];
      if (leaveAnimationConfig) {
        viewNode.populateLeaveSequence = function (sequence) {
          sequence.next(function (done) {
            if (leaveAnimationConfig.sequence) {
              // debugger;
              let animationMeta = AnimationMeta.get(leaveAnimationConfig.sequence);
              animationMeta.duration = leaveAnimationConfig.duration;
              animationMeta.position = leaveAnimationConfig.position;
              animationMeta.NODE = viewNode;

              // let lastStep = leaveAnimationConfig.to || leaveAnimationConfig.from;
              // lastStep.clearProps = 'all';
              animationMeta.add(viewNode.node, leaveAnimationConfig, done);

              // Add to parent should happen after the animation is added to the child
              if (leaveAnimationConfig.parent) {
                const parent = AnimationMeta.get(leaveAnimationConfig.parent);
                parent.addChild(animationMeta);
              }
            } else {
              // let lastStep = leaveAnimationConfig.to || leaveAnimationConfig.from;
              // lastStep.clearProps = 'all';
              AnimationMeta.createTween(viewNode.node, leaveAnimationConfig, done);
            }
          });
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
                      animationMeta = animationMeta.getGroup(classAnimationConfig.group, classAnimationConfig.duration, classAnimationConfig.position || '+=0');
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

  function AnimationMeta(onComplete) {
    const _this = this;

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
    this.duration = 0;
    this.position = '+=0';
    this.queue = {};
    this.list = [];
    this.lastChildPosition = 0;
    this.parent = null;
  }

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
      AnimationMeta.ANIMATIONS[name] = new AnimationMeta();
    }

    return AnimationMeta.ANIMATIONS[name];
  };

  AnimationMeta.parseSequence = function (sequence) {
    return sequence.split('/').filter(Boolean);
  };

  AnimationMeta.createTween = function (node, config, onComplete) {
    let to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;
    let tween = null;

    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
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

  AnimationMeta.prototype.calculateLastChildPosition = function (duration, position) {
    const calc = AnimationMeta.calculateDuration(duration, position || '+=0');
    const lcp = (this.lastChildPosition * 10);
    const c = (calc * 10);
    this.lastChildPosition = (lcp + c) / 10;

  };

  AnimationMeta.prototype.addChild = function (child, prior) {
    const _this = this;
    child.parent = _this;

    const children = this.timeline.getChildren(false);

    if (children.indexOf(child.timeline) === -1) {
      if (prior) {
        // console.info(child.NODE.node, child.lastChildPosition, _this.duration);
        _this.timeline.add(child.timeline, _this.lastChildPosition);
        _this.calculateLastChildPosition(child.lastChildPosition || child.duration, _this.position);
      } else {
        _this.timeline.add(child.timeline, _this.lastChildPosition);
        _this.calculateLastChildPosition(_this.duration, _this.position);
      }
    } else {
      if (prior) {
        _this.calculateLastChildPosition(child.duration, child.position);
        console.info(child.NODE.node, _this.lastChildPosition);
      }
    }


    // if (children.indexOf(child.timeline) === -1) {
    //   if (prior) {
    //     // _this.lastChildPosition = ((child.lastChildPosition * 10)  ) / 10;
    //     // console.info(child.NODE.node, child.lastChildPosition,
    //     //   '\n====\n', _this.NODE.node.tagName, _this.lastChildPosition);
    //     //
    //     // _this.timeline.add(child.timeline, _this.lastChildPosition);
    //     // const calc = AnimationMeta.calculateDuration(child.lastChildPosition, _this.position);
    //     // let c = ( (calc * 10) - (_this.duration * 10) ) / 10;
    //     // _this.calculateLastChildPosition(calc, child.position);
    //
    //     _this.timeline.add(child.timeline, _this.lastChildPosition);
    //     _this.calculateLastChildPosition(child.duration, child.position);
    //   }
    //   else {
    //     _this.calculateLastChildPosition(child.duration, child.position);
    //     _this.timeline.add(child.timeline, _this.lastChildPosition);
    //   }
    // } else {
    //   if (prior) {
    //     _this.calculateLastChildPosition(child.duration, child.position);
    //     _this.lastChildPosition = ((child.lastChildPosition * 10) + (child.duration * 10) ) / 10;
    //   }
    // }
  };

  AnimationMeta.prototype.add = function (node, config, onComplete) {
    const _this = this;
    let to = Object.assign({}, config.to || {});
    to.onComplete = onComplete;

    let tween = null;
    if (config.from && config.to) {
      tween = TweenLite.fromTo(node,
        config.duration || 0,
        config.from || {},
        to);
    } else if (config.from) {
      let from = Object.assign({}, config.from || {});
      from.onComplete = onComplete;
      tween = TweenLite.from(node,
        config.duration || 0,
        from || {});
    } else {
      tween = TweenLite.to(node,
        config.duration || 0,
        to || {});
    }


    // First animation in the timeline should always start at zero
    if (this.timeline.getChildren(false).length === 0) {
      _this.lastChildPosition = 0;
      // _this.calculateLastChildPosition(config.duration, config.position);
      // _this.calculateLastChildPosition(config.duration, config.position);
      _this.timeline.add(tween, 0);
    } else {
      _this.calculateLastChildPosition(config.duration, config.position);
      _this.timeline.add(tween, _this.lastChildPosition);
    }
  };

  /**
   *
   * @param {number} order
   * @param {callback} operation
   */
  AnimationMeta.prototype.addToQueue = function (order, node, operation) {
    if (this.parent) {
      return this.parent.addToQueue(order, node, operation);
    }

    if (!this.queue[order]) {
      this.queue[order] = [];
    }
    this.queue[order].push({node: node, operation: operation});
    this.list.push({node: node, operation: operation, order: order});
  };
})(Galaxy);
