/* global xtag, Galaxy */

(function () {
  var List = {
    lifecycle: {
      created: function () {
        this.template = this.innerHTML;
        this.xtag.selectedStyle = 'selected';
        this.xtag.action = '[item]';
        this.innerHTML = "";
        this.links = {};
        this.data = [];
        this.value = -1;
      },
      inserted: function () {
      },
      attributeChanged: function (attrName, oldValue, newValue) {
      }
    },
    methods: {
      render: function (data, action) {
        //var data = this.data;
        this.innerHTML = "";
        var selectableItem = null;
        for (var i = 0, len = data.length; i < len; i++) {
          //data[i]._itemIndex = i;
          var item = xtag.createFragment(Galaxy.ui.utility.populate(this.template, data[i]));
          if (action) {
            selectableItem = xtag.query(item, action)[0];

            if (selectableItem) {
              selectableItem.dataset.index = i;
              selectableItem.setAttribute('item', '');

              if (data[i].id) {
                this.links[data[i].id] = selectableItem;
              }

              this.links[i] = selectableItem;
            }
          }

          this.appendChild(item);
        }
      },
      selectItem: function (i, element) {
        var oldItem = this.links[this.xtag.value];
        if (oldItem) {
          Galaxy.ui.utility.removeClass(oldItem, this.xtag.selectedStyle);
        }

        var newItem = this.links[i];
        if (this.data[i].id) {
          newItem = this.links[this.data[i].id];
        }

        Galaxy.ui.utility.addClass(newItem, this.xtag.selectedStyle);

        xtag.fireEvent(this, 'item-selected', {
          detail: {
            index: i,
            data: this.xtag.data[i],
            element: element
          }
        });
      }
    },
    accessors: {
      data: {
        set: function (value) {
          var element = this;

          this.value = -1;
          if ("object" !== typeof value) {
            this.xtag.data = [];
            value = [];
          }

          var toRender = value;

          this.xtag.data = value;

          if (this.onSetData) {
            this.onSetData(toRender);
          }

          this.render(toRender, this.xtag.action);
        },
        get: function () {
          return this.xtag.data;
        }
      },
      onSetData: {
        attribute: {
          validate: function (value) {
            this.xtag.onSetData = value;
            return '[ function ]';
          }
        },
        set: function (value) {
        },
        get: function (value) {
          return this.xtag.onSetData;
        }
      },
      selectedStyle: {
        attribute: {},
        set: function (value) {
          this.xtag.selectedStyle = value;
        },
        get: function () {
          return this.xtag.selectedStyle;
        }
      },
      value: {
        attribute: {},
        set: function (value, oldValue) {
          if (value === oldValue) {
            return;
          }

          value = parseInt(value);

          if (value > -1 && /*value !== this.xtag.value && */this.xtag.data.length) {
            this.selectItem(value, this.links[value]);
          }

          this.xtag.value = value;


        },
        get: function () {
          return this.xtag.value;
        }
      },
      action: {
        attribute: {},
        set: function (value) {
          this.xtag.action = value;
        },
        get: function () {
          return this.xtag.action;
        }
      }
    },
    events: {
      "click:delegate([item])": function (e) {
        e.preventDefault();
        e.currentTarget.value = this.dataset.index;
      },
      "tap:delegate([item])": function (e) {
        e.preventDefault();
        e.currentTarget.value = this.dataset.index;
      }
    }
  };

  xtag.register('system-list', List);
})();
