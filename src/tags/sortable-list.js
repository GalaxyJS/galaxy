(function () {
  var SortableList = {
    lifecycle: {
      created: function () {
        this.xtag.placeHolder = document.createElement("li");
        this.xtag.placeHolder.className += "placeholder";

        this.xtag.glass = document.createElement("div");
        this.xtag.glass.style.position = "absolute";
        this.xtag.glass.style.width = "100%";
        this.xtag.glass.style.height = "100%";

        this.style.overflow = "hidden";
        this.isValidParent = function () {
          return true;
        };
        this.onDrop = function () {
        };
      },
      inserted: function () {

      },
      removed: function () {

      }
    },
    events: {
      mousedown: function (event) {
        //console.log("down");
      },
      "mousedown:delegate(.handle)": function (e) {
        var dim = this.getBoundingClientRect();
        e.currentTarget.xtag.initDragPosition = {
          x: e.pageX - dim.left,
          y: e.pageY - dim.top
        };

        var draggedItem = this;
        while (draggedItem.tagName.toLowerCase() !== "li") {
          draggedItem = draggedItem.parentNode;
        }

        var diDimension = draggedItem.getBoundingClientRect();
        e.currentTarget.xtag.draggedItem = draggedItem;
        draggedItem.style.position = "fixed";
        draggedItem.style.width = diDimension.width + "px";
        draggedItem.style.height = diDimension.height + "px";
        e.currentTarget.xtag.glass.width = diDimension.width + "px";
        e.currentTarget.xtag.glass.height = diDimension.height + "px";
        draggedItem.appendChild(e.currentTarget.xtag.glass);
        Galaxy.ui.utility.addClass(draggedItem, "dragged");

        //console.log(e, draggedItem);
        e.stopPropagation();
        e.preventDefault();
      },
      "mouseup:delegate(.handle)": function (e) {
        e.stopPropagation();
        e.preventDefault();
      },
      mousemove: function (event) {
        if (!this.xtag.draggedItem)
          return;

        var groups = this.querySelectorAll("ul");
        var groupDim = [
        ];
        for (var i = 0, len = groups.length; i < len; i++) {
          groupDim.push(groups[i].getBoundingClientRect());
        }

        var parent = null;
        var index = 0;
        var indexElement = null;

        for (var i = groupDim.length - 1; i >= 0; i--) {
          var parentDim = groupDim[i];
          if (event.pageX > parentDim.left && event.pageX < parentDim.right && event.pageY > parentDim.top && event.pageY < parentDim.bottom) {
            parent = groups[i];
            //indexElement = parent.lastChild;
            var children = parent.childNodes || [
            ];
            var childElements = [
            ];
            //index = childElements.length;
            for (var n = 0; n < children.length; n++) {
              if (children[n].tagName.toLowerCase() !== "li" || children[n] === this.xtag.draggedItem /*|| children[n].className === "placeholder"*/)
                continue;
              childElements.push(children[n]);
            }
            //console.log(childElements)
            var extra = {
              height: 0,
              left: 0
            };
            for (n = childElements.length - 1; n >= 0; n--) {
              if (childElements[n].className === "placeholder") {
                //extra = childElements[n].getBoundingClientRect();
                //console.log(extra.height)
                continue;
              }

              var childDim = childElements[n].getBoundingClientRect();

              if (event.pageY > childDim.top && event.pageY < childDim.top + (childDim.height / 2) /*&& event.pageY + extra.height < childDim.bottom - (childDim.height / 2)*/) {
                index = n;
                indexElement = childElements[index] /*|| parent.firstChild*/;
                //console.log("above", index);
                //console.log(childDim, event.pageY, n)
                break;
              } else if (event.pageY >= childDim.top + (childDim.height / 2) /*&& event.pageY < childDim.bottom*/) {
                index = n + 1;
                indexElement = childElements[index];
                //console.log("lower", index);
                //console.log(childDim, event.pageY, n)
                break;
              } else {
                indexElement = this.xtag.tempIndexElement;
                //console.log(extra, event.pageY)
              }
              //console.log(extra)
              //extra.height = 0;
              //extra.top = 0;
            }
            break;
          }
        }

        this.xtag.draggedItem.style.left = event.pageX - this.xtag.initDragPosition.x + "px";
        this.xtag.draggedItem.style.top = event.pageY - this.xtag.initDragPosition.y + "px";

        if (parent && (this.xtag.tempParent !== parent || this.xtag.tempIndexElement !== indexElement)) {
          this.xtag.tempParent = parent;
          this.xtag.tempIndex = index;
          this.xtag.tempIndexElement = indexElement;
          if (this.isValidParent(this.xtag.draggedItem, parent, this.xtag.tempIndex)) {
            //console.log(indexElement)
            if (indexElement && indexElement.parentNode === parent)
              parent.insertBefore(this.xtag.placeHolder, indexElement);
            else if (!indexElement)
              parent.insertBefore(this.xtag.placeHolder, indexElement);
          }
        }
      },
      mouseup: function (event) {
        //console.log("up");
        if (this.xtag.draggedItem) {
          this.xtag.draggedItem.style.position = "";
          this.xtag.draggedItem.style.width = "";
          this.xtag.draggedItem.style.height = "";
          this.xtag.draggedItem.style.left = "";
          this.xtag.draggedItem.style.top = "";
          this.xtag.draggedItem.removeChild(this.xtag.glass);
          Galaxy.ui.utility.removeClass(this.xtag.draggedItem, "dragged");

          if (this.xtag.placeHolder.parentNode) {
            this.onDrop(this.xtag.draggedItem, this.xtag.tempParent, this.xtag.tempIndex);
            this.xtag.placeHolder.parentNode.replaceChild(this.xtag.draggedItem, this.xtag.placeHolder);
          }

          this.xtag.draggedItem = null;
          this.xtag.tempParent = null;
          this.xtag.tempIndex = null;
        }
        event.preventDefault();
        event.stopPropagation();
      }

    }
  };

  xtag.register('system-sortable-list', SortableList);
})();