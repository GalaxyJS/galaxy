export const visible_property = {
  type: 'reactive',
  key: 'visible',
  getConfig: function () {
    return {
      throttleId: 0,
    };
  },
  install: function () {
    return true;
  },
  update: function (config, value, expression) {
    if (config.throttleId !== 0) {
      window.clearTimeout(config.throttleId);
      config.throttleId = 0;
    }

    if (expression) {
      value = expression();
    }

    // setTimeout is called before requestAnimationTimeFrame
    config.throttleId = window.setTimeout(() => {
      if (this.visible !== value) {
        this.setVisibility(value);
      }
    });
  }
};

