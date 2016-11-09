/* global xtag */

(function () {
  var InputJson = {
    lifecycle: {
      created: function () {
        this.xtag.elementType = 'input';
        this.xtag.allFields = [];
        this.xtag.fields = [];
        this.xtag.lastField = this.createField('', '');
        this.xtag.active = this.xtag.lastField;

        this.elementType = this.xtag.elementType;

        this.updateFieldsCount();
      }
    },
    methods: {
      createField: function (nameValue, valueValue) {
        var jsonInput = this;
        var name = document.createElement('input');
        name.value = nameValue;
        name.className = 'name';
        name.placeholder = 'name';

        var value = document.createElement('input');
        if ('object' === typeof valueValue) {
          value = document.createElement('system-input-json');
        }
        value.value = valueValue;
        value.className = 'value';
        value.placeholder = 'value';
        value.elementType = '';

        var field = document.createElement('p');

        name.addEventListener('keyup', function (e) {
          jsonInput.updateFieldsCount();
        });

        name.addEventListener('focus', function (e) {
          jsonInput.xtag.active = field;
        });

        value.addEventListener('keyup', function (e) {
          jsonInput.updateFieldsCount();
        });

        value.addEventListener('focus', function (e) {
          jsonInput.xtag.active = field;
        });

        field._name = name;
        field.appendChild(name);
        field.appendChild(value);

        this.xtag.allFields.push({
          name: name,
          value: value,
          field: field
        });

        this.appendChild(field);

        return {
          name: name,
          value: value,
          field: field
        };
      },
      updateFieldsCount: function () {
        var jsonInput = this;
        var newFields = [];
        this.xtag.fields = [];
        this.xtag.allFields.forEach(function (item) {
          if (!item.name.value && (!item.value.value || Object.keys(item.value.value).length === 0) && item.field.parentNode && item.field !== jsonInput.xtag.lastField.field) {
            item.field.parentNode.removeChild(item.field);
            return;
          }

          if (item.value.nodeName === 'INPUT' && item.value.value === '{}') {
            var json = document.createElement('system-input-json');
            json.className = 'value';
            item.field.replaceChild(json, item.value);
            item.value = json;
            json.focus();
          }

          if (item.field !== jsonInput.xtag.lastField.field) {
            jsonInput.xtag.fields.push(item);
          }

          newFields.push(item);
        });

        this.xtag.allFields = newFields;

        if (!jsonInput.xtag.lastField.name || jsonInput.xtag.lastField.name.value) {
          jsonInput.xtag.lastField = this.createField('', '');
        }

        if (jsonInput.xtag.active && jsonInput.xtag.active.parentNode) {
          jsonInput.xtag.active.focus();
        } else {
          jsonInput.xtag.lastField.name.focus();
        }
      },
      focus: function () {
        this.xtag.allFields[this.xtag.allFields.length - 1].name.focus();
      }
    },
    accessors: {
      value: {
        set: function (data) {
          var jsonInput = this;

          if (jsonInput.xtag.allFields)
            jsonInput.xtag.allFields.forEach(function (item) {
              if (item.field.parentNode)
                item.field.parentNode.removeChild(item.field);
            });

          jsonInput.xtag.allFields = [];
          jsonInput.xtag.fields = [];

          if ('string' === typeof data)
            data = JSON.parse(data);

          if ('object' !== typeof data) {
            return;
          }

          if (Object.keys(data).length === 0) {
            jsonInput.xtag.lastField = jsonInput.createField('', '');
            jsonInput.xtag.allFields.push(jsonInput.xtag.lastField);
          } else {
            for (var key in data) {
              if (data.hasOwnProperty(key)) {
                jsonInput.xtag.lastField = jsonInput.createField(key, data[key]);
                jsonInput.xtag.allFields.push(jsonInput.xtag.lastField);
              }
            }

            jsonInput.xtag.lastField = {};
          }

          jsonInput.updateFieldsCount();
        },
        get: function () {
          var value = {};
          this.xtag.fields.forEach(function (item) {
            if (item.name.value !== '') {
              value[item.name.value] = item.value.value;
            }
          });

          return value;
        }
      },
      elementType: {
        attribute: {},
        set: function (value) {
          this.xtag.elementType = value;
        },
        get: function () {
          return this.xtag.elementType;
        }
      }
    }
  };

  xtag.register('system-input-json', InputJson);
})();