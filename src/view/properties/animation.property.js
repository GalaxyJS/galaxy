/* global Galaxy, TweenLite, TimelineLite */

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
    handler: function (viewNode, attr, config, scopeData) {
      if (!viewNode.virtual) {
        if (config['enter']) {
          viewNode.sequences['enter'].next(function (done) {
            var enterAnimationConfig = config['enter'];
            var to = Object.assign({}, enterAnimationConfig.to || {});
            to.onComplete = done;
            to.clearProps = 'all';

            if (enterAnimationConfig.sequence) {
              var timeline = enterAnimationConfig.__timeline__ || new TimelineLite({
                autoRemoveChildren: true
              });

              if (timeline.getChildren().length > 0) {
                timeline.add(TweenLite.fromTo(viewNode.node,
                  enterAnimationConfig.duration || 0,
                  enterAnimationConfig.from || {},
                  to), enterAnimationConfig.position || null);
              } else {
                timeline.add(TweenLite.fromTo(viewNode.node,
                  enterAnimationConfig.duration || 0,
                  enterAnimationConfig.from || {},
                  to), null);
              }

              enterAnimationConfig.__timeline__ = timeline;
            } else {
              TweenLite.fromTo(viewNode.node,
                enterAnimationConfig.duration || 0,
                enterAnimationConfig.from || {},
                to);
            }
          });
        }

        if (config['leave']) {
          viewNode.sequences['leave'].next(function (done) {
            var leaveAnimationConfig = config['leave'];
            var to = Object.assign({}, leaveAnimationConfig.to || {});
            to.onComplete = done;
            to.clearProps = 'all';

            if (leaveAnimationConfig.sequence) {
              var timeline = leaveAnimationConfig.__timeline__ || new TimelineLite();

              timeline.add(TweenLite.fromTo(viewNode.node,
                leaveAnimationConfig.duration || 0,
                leaveAnimationConfig.from || {},
                to), leaveAnimationConfig.position || null);

              leaveAnimationConfig.__timeline__ = timeline;
            } else {
              TweenLite.fromTo(viewNode.node,
                leaveAnimationConfig.duration || 0,
                leaveAnimationConfig.from || {},
                to);
            }
          });
        }
      }
    }
  };
})(Galaxy);
