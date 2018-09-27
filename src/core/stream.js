/* global Galaxy */
'use strict';

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
        for (const subGroup in this.subStreams) {
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

    subscribe: function (handler) {
      if (this.handlers.indexOf(handler) === -1) {
        this.handlers.push(handler);
      }
    },

    subscribeOnce: function (handler) {
      if (this.singleCallHandlers.indexOf(handler) === -1) {
        this.singleCallHandlers.push(handler);
      }
    }
  };

  return Stream;
})();
