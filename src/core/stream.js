/* global Galaxy */
Galaxy.Stream = /** @class */ (function () {
  function Stream(source) {
    this.handlers = [];
    this.singleCallHandlers = [];
    this.source = source;
    this.subStreams = {};
  }

  Stream.prototype = {
    pour: function (data, path) {
      this.handlers.forEach(function (handler) {
        handler.call(null, data);
      });

      this.singleCallHandlers = this.singleCallHandlers.filter(function (handler) {
        handler.call(null, data);
        return false;
      });

      if (path) {
        const pathParts = path.split(' ');
        const currentType = pathParts.shift();
        this.filter(currentType).pour(data, pathParts.join(' '));
      } else {
        for (let subGroup in this.subStreams) {
          if (this.subStreams.hasOwnProperty(subGroup)) {
            const stream = this.subStreams[subGroup];
            stream.pour(data);
          }
        }
      }
    },

    filter: function (type) {
      const stream = this.subStreams[type] || new Stream(this);
      this.subStreams[type] = stream;

      return stream;
    },

    /**
     *
     * @param handler
     * @return {function} unsubscribe callback
     */
    subscribe: function (handler) {
      const _this = this;
      if (_this.handlers.indexOf(handler) === -1) {
        _this.handlers.push(handler);
      }

      return function unsubscribe() {
        const index = _this.handlers.indexOf(handler);
        if (index === -1) {
          _this.handlers.splice(index, 1);
        }
      };
    },

    subscribeOnce: function (handler) {
      if (this.singleCallHandlers.indexOf(handler) === -1) {
        this.singleCallHandlers.push(handler);
      }
    }
  };

  return Stream;
})();
