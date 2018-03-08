/* global Galaxy */
'use strict';

Galaxy.GalaxyObserver = /** @class */ (function () {
  const G = Galaxy;

  GalaxyObserver.notify = function (obj, key, value, oldValue, caller) {
    const observers = obj.__observers__;
    let portal;
    if (obj instanceof Galaxy.GalaxyView.Portal) {
      portal = obj;
    } else {
      portal = obj[G.GalaxyView.PORTAL_PROPERTY_IDENTIFIER];
    }
// debugger;
    if (observers !== undefined) {
      observers.forEach(function (observer) {
        observer.notify(key, value, oldValue);
      });
    }

    if (portal !== undefined) {
      // debugger;
      portal.getParents().forEach(function (reactive) {
        // portal;
        // key;
        // caller
        // console.info(reactive.portal === caller, portal === caller);
        //
        // if (portal !== caller) {
        //   debugger;
        //   reactive.refresh();
        // } else {
        //   debugger;
        //   // GalaxyObserver.notify(reactive.portal, key, value, oldValue, caller);
        // }

        // let item = reactive.portal.props[reactive.name];
        // // let item = reactive.portal;
        // if (item.portal !== caller) {
        //   debugger
        //   GalaxyObserver.notify(item.valueStructure, key, value, oldValue, item.portal);
        // } else {
        //   item.valueStructure
        //   debugger
        //   // item.valueStructure[G.GalaxyView.PORTAL_PROPERTY_IDENTIFIER].props.forEach(function (con) {
        //   //   if (key === 'children') {
        //   //     debugger
        //   //   }
        //   //   con.refresh();
        //   // });
        // }
      });
    }
  };

  /**
   *
   * @param {Object} context
   * @constructor
   * @memberOf Galaxy
   */
  function GalaxyObserver(context) {
    this.context = context;
    this.subjectsActions = {};
    this.allSubjectAction = [];

    if (!this.context.hasOwnProperty('__observers__')) {
      G.defineProp(context, '__observers__', {
        value: [],
        writable: true,
        configurable: true
      });
    }

    this.context.__observers__.push(this);
  }

  GalaxyObserver.prototype.remove = function () {
    let index = this.context.__observers__.indexOf(this);
    if (index !== -1) {
      this.context.__observers__.splice(index, 1);
    }
  };

  GalaxyObserver.prototype.notify = function (key, value, oldValue) {
    const _this = this;

    if (_this.subjectsActions.hasOwnProperty(key)) {
      _this.subjectsActions[key].call(_this.context, value, oldValue);
    }

    _this.allSubjectAction.forEach(function (action) {
      action.call(_this.context, key, value, oldValue);
    });
  };

  GalaxyObserver.prototype.on = function (subject, action) {
    this.subjectsActions[subject] = action;
  };

  GalaxyObserver.prototype.onAll = function (action) {
    if (this.allSubjectAction.indexOf(action) === -1) {
      this.allSubjectAction.push(action);
    }
  };

  return GalaxyObserver;
})();
