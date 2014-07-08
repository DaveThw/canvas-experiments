//3456789 123456789 123456789 123456789 123456789 123456789 123456789 123456789 123456789 1234567890

(function(window, document, undefined){

// default values
var gridSize = 10;
var canvasWidth = 300;
var canvasHeight = 300;

// references to items in the HTML DOM
var canvasElement;
var drawingContext;
var status = {};

// global variables
var stack
var current_stack
var mouse
var items


var timings = [ {label: "init", time: new Date().getTime()} ];
defObjProp(timings, "add", function (label) {
    // console.timeStamp(label)
    /*
    var thisTime = new Date().getTime()
    var lastTime = timings[timings.length-1].time
    var delay = thisTime - lastTime
    if (label) this.push({label: label, time: thisTime, delay: delay})
    else this.push({time: thisTime, delay: delay})
    if (delay > 1000) console.log("---------------------------------------------------------------")
    console.log(label, delay)
    */
} )


// to make life a little easier, here's a function to add a property (with optional flags) to an
// object
function defObjProp(obj, prop, val, writ, conf, enu) {
    switch (arguments.length) {
        case 2:  val = undefined
        case 3:  writ = false
        case 4:  conf = false
        case 5:  enu = false
    }
    var def = defObjProp.def || ( defObjProp.def = {} )
    def.value = val
    //  value: the value of the property! can be any valid Javascript value (number, object,
    //         function, etc)
    def.writable = writ
    //  writable: if true, the value of this property can be changed with an assignment operator
    def.configurable = conf
    //  configurable: if true, this property can be deleted, and have its type changed
    //                if false, this property cannot be re-assigned with another call to
    //                  defObjProp()
    def.enumerable = enu
    //  enumerable: if true, this property will show up during a "for (x in y)" loop
    Object.defineProperty(obj, prop, def)
}

function defObjPropSetGet(obj, prop, set, get, conf, enu) {
    switch (arguments.length) {
        case 2:  set = undefined
        case 3:  get = undefined
        case 4:  conf = false
        case 5:  enu = false
    }
    var def = defObjPropSetGet.def || ( defObjPropSetGet.def = {} )
    def.set = set
    //  set: a function that will set the value of this property
    def.get = get
    //  get: a function that will return the value of this property
    def.configurable = conf
    //  configurable: if true, this property can be deleted, and have its type changed
    //                if false, this property cannot be re-assigned with another call to
    //                  defObjProp()
    def.enumerable = enu
    //  enumerable: if true, this property will show up during a "for (x in y)" loop
    Object.defineProperty(obj, prop, def)
}

// this is how we are supposed to do 'classical inheritance' - see here:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create#Classical_inheritance_with_Object.create
// but to make life a little easier, here's a function to do it for us.
function setObjProto(obj, proto) {
    obj.prototype = Object.create(proto.prototype)
    // obj.prototype.constructor = obj
    defObjProp(obj.prototype, "constructor", obj)
}

// and finally (for now) in the making-life-a-little-easier group of functions, here's one to call
// the parent constructor, from within a constructor function for which we set the parent prototype
// to something specific - for example by calling setObjProto above!..
function callParentConstructor(me, myPrototype) {
    switch (arguments.length) {
        case 0: return
        case 1: myPrototype = Object.getPrototypeOf(me)
    }
    // Check to see if we've been passed a function (instead of its prototype)
    if (isFunction(myPrototype)) myPrototype = myPrototype.prototype
    // Object.getPrototypeOf(Object.getPrototypeOf(me)).constructor.call(me)
    if (myPrototype !== Object.prototype) {
        var that = Object.getPrototypeOf(myPrototype)
        // so, 'that' is the prototype of the parent of the thing that called this function
        if (that !== Object.prototype) {
            that.constructor.call(me)
        }
    }
}

// based on results on my browser from here:
// http://jsperf.com/alternative-isfunction-implementations/9
// (linked from the one of the comments here:
//  http://stackoverflow.com/questions/5999998/how-can-i-check-if-a-javascript-variable-is-function-type#comment11456457_7356528 )
function isFunction(obj) {
    return typeof(obj) === 'function';
}



/**************************************************************************************************\
*                                   Master structure definitions                                   *
\**************************************************************************************************/


// 'items' Object, containing all our items, referenced by unique id numbers
// I use...
// items[id] to get at a specific item
// (and items[id].xxx to get at that items properties...)
// items.push(item) to add an item
//   - change to use items.add(item) instead
// items.splice(index, 1) to remove an item
//   - change to use items.delete(item) instead
// items.length to get number of items
//   - could change to use items.count() instead..?
// for loop to check through all items
//   - mainly this is for drawing the items (so can loop through stacking order instead), or
//     working out if we are hovering over an item (loop through stacking order instead), or
//     selecting all items (could do this by looping through stacking order, although that's
//     less scemantically pleasing...)
//   note, we should use "for (var i = items.length; --i >= 0 ; ) {" as (apparently) it is the
//   fastest way of going through the array.  "for (var i in items) {" shouldn't really be used
//   on an array, as it can throw up additional 'methods' and things...  see here:
//   http://stackoverflow.com/questions/500504/why-is-using-for-in-with-array-iteration-such-a-bad-idea
// items = [] to intialise it, once - now moved from init function to initial declaration here
//
// Hmm.. okay, here's an idea - seperate the display order (or stacking order) out into a
// separate array of itemId's.  Then change items into an object, with the itemId being the key
// of each Item - these can be accessed as items[itemId].
// Pros - easier direct access to items by their itemId - will be useful in the future
//      - stacking order becomes an array of itemId's - with 'methods' for re-ordering items
// Cons - less easy to iterate through all items - using "for (var item in items) {" would also
//        pick up on other 'methods' and variables within the items object...
//      - when we delete an item we'd ought to update the stacking order array too (or does it
//        tidy itself up / fail gracefully when it finds an item that no longer exists..?)
//         - will need to think about this also for other things that might reference items by
//           their itemId - like a line linking two items together...
// Done! - although more work on this idea still to be done...
function ListOfItems() {
    defObjProp(this, "length", 0, true)
}
defObjProp(ListOfItems.prototype, "add", function(item) {
    // check if we already know about this item
    if (!this[item.id]) {
        this[item.id] = item
        this.length++
    }
} )
/*
defObjProp(ListOfItems.prototype, "remove", function(id) {
    stack.remove(id)
    if (this[id] != undefined) {
        delete this[id]
        return this.length--
    } else {
        return this.length
    }
} )
*/
defObjProp(ListOfItems.prototype, "delete", function(item) {
    // stack.remove(item)
    if (item.id !== undefined && this[item.id] !== undefined) {
        delete this[item.id]
        // item.id = null
        return this.length--
    } else {
        return this.length
    }
} )
/*
defObjProp(ListOfItems.prototype, "removeItem", function(item) {
    return this.remove(item.id)
} )
*/
defObjProp(ListOfItems.prototype, "count", function() {
    return this.length
} )




// Add an 'Item' object - this is the prototype for all Groups, Shapes and CompoundItems
// this will define properties that everything needs - like parent, selected, visible, etc...
// could also be used to add 'delete' 'select' and so on, that actually call methods on the parent
//   object - or the selection list within the parent object...
function Item() {
    defObjProp(this, "id", Item.nextItemId++, false, true, true)
    defObjProp(this, "parent", null, false, true)
    defObjProp(this, "selected", false, true)
    defObjProp(this, "visible", true, true, true, true)
    defObjProp(this, "cursorStyle", "pointer", true, true, true)
    // add item to the items list... do we still need to keep a separate list of all items..?
    if (items) items.add(this)
    defObjProp(Item, "count", ++Item.count, false, true)
}
defObjProp(Item, "nextItemId", 0, true)
defObjProp(Item, "count", 0, false, true)
defObjProp(Item, "delete", function(item) {
    if (items) items.delete(item)
    // mark this item as deleted, in case the base object is referenced from anywhere else
    defObjProp(item, "deleted", true)
    defObjProp(item, "id", undefined, false, true)
    defObjProp(Item, "count", --Item.count, false, true)
} )
defObjProp(Item.prototype, "isSelected", function() {
    if (current_stack === this) return false
    return ( (this.parent === current_stack) ? this.selected : (this.parent ? this.parent.isSelected() : false) )
} )


/**************************************************************************************************\
                                        *  'Group' object  *
                                        ********************
- should look / work a little bit like a normal array...
  - by which I mean:
    - every time we add an item, it gets a 'index' that is one greater than the current largest one
    - we have a 'length' property, which tells us how many items we have
    - first item has index [0]
    - we should always have items from index [0] though to index [length]
    - we can use 'for (index in group)' to iterate through all members of the group
    - (and we might steal a few functions from the Array.prototype !...)
  - plus we also have 'add' and 'remove' methods for adding/removing an item to/from the group
- could therefore iterate through the list (with a 'for (index in group)' loop) to draw things in
  'stacking' order, or to find out what is at a specific point on the canvas (eg under the mouse)
  - will also need methods for moving item(s) forward and backward in the stacking order
  - maybe also separate(?) methods for moving all selected item(s) forward and backward in the
    stacking order
    - or do we always apply these moves to the current selection - which might only be one item..?
- long term: would be great to be able to visually 'move into' a group to edit its contents without
  ungrouping...
  - maybe draw items 'outside' the group greyed out..?
- then also have a 'selection' list to keep track of which items are selected within the context of
  this group
  - need most (all?) methods on the selection list as previously defined
    - would be nice to have a selection prototype...
  - order within this list isn't significant (?)
  - might need a method of looking back up the group tree to see if an item is within a group that
    is selected...
- could the co-ordinates of the items within a group be relative to a 'group position'..?
  - might make moving groups (and their subgroups) around easier
  - but might make drawing items more complicated...
    - and it wouldn't be that hard to iterate through the items within a group as we move that group
      around
- items within a group could be one of:
  - a number (or simple object) pointing to an items ID
    - actually, could it not refer directly to the item itself (within the items list)..?
      - wow, can we move away from using items IDs anywhere, and just point directly to items..?
        - this might mean we don't need an 'items' list any more... yay! (at least, I think "yay"?)
  - another group object, for a sub group
  - a 'compound item' object..?
- items might need to keep track of which group they belong to..?
  - how..??
  - each item might need a 'parent' property
  - groups would also benefit from a 'parent' property
- each item should belong to one and only one group (or compound item)
  - can make use of an item's 'parent' property to check it's only in one group
    - and automatically remove it from another group when adding it to this one..?
- I think each group needs to be able to draw itself...
  - by which I mean, iteratively call the draw fuctions for all its children
  - should a group show a bounding box around itself when selected..?

\**************************************************************************************************/

function Group() {
    callParentConstructor(this, Group.prototype)
    defObjProp(this, "length", 0, false, true)
    defObjProp(this, "selection", new Selection(this))
    defObjProp(this, "bounds", new Bounds())
    // this.cursorStyle = "pointer"
    defObjProp(this, "dragOffset", mouse.dragNoOffset, false, true)
}
setObjProto(Group, Item)
defObjProp(Group.prototype, "splice", Array.prototype.splice )
defObjProp(Group.prototype, "add", function(item) {
    // check to see if item is already in this group
    if (item.parent === this) {
        return item
    } else {
        if (item.parent) {
            // item is already somewhere within our global Group tree structure...
            if (item.parent.constructor === Group) {
                // item is already in another group - remove it from there...
                item.parent.remove(item)
            } else {
                // item is within a compound item (or something else...) - cannot remove it
                return null
            }
        }
        // keep a reference to this item's index within the group
        // item.index = this.length
        defObjProp(item, "index", this.length, false, true)
        // add the item to this group
        this[this.length] = item
        defObjProp(this, "length", this.length+1, false, true)
        // item.parent = this
        defObjProp(item, "parent", this, false, true)
        // if the item has a create function, call it...
        if (item.create !== undefined) item.create();
        // mark our bounds as (potentially) out of date
        this.bounds.maxX = new IntVal()
        return item
    }
} )
defObjProp(Group.prototype, "delete", function(item) {
    // check to see if item is in this group
    if (item.parent !== this) {
        // can't delete an item from another group!
        return -1
    } else {
        var index = item.index
        if (index !== undefined) {
            // unselect this item, if necessary
            if (item.selected) this.selection.remove(item)
            // if the item has a destroy function, call it...
            // note: if item is a group, then destroying the group will delete all if the items
            //   within it (desired behaviour).  When the last item gets deleted, it will notice
            //   that it is the last item in the group, and delete the group (normally desired
            //   behaviour).  However this means that when this call returns, the 'item' that we are
            //   currently in the process of deleting, will have already been deleted (but only if
            //   this item is a group).  Therefore, when we update out list in the loop below, we
            //   wind up removing another item from the group, making it into a bit of a ghost!
            // this is now fixed further down...
            if (item.destroy !== undefined) item.destroy();
            // do any generic Item-relative deleting (set the 'deleted' flag, unset the id, etc...)
            Item.delete(item)
            // unset the item's parent property, in case the base object is referenced from anywhere
            // item.parent = null
            defObjProp(item, "parent", undefined, false, true)
            // item.index = undefined
            defObjProp(item, "index", undefined, false, true)
            // finally, remove the item from our group
            // however, this.splice doesn't work if we are trying to keep track of each item's index
            // this.splice(index, 1)
            // this loop should do the same job - don't know if it'll be faster or slower..?
            // don't need to delete the 'original' item, as it's about to be overwritten!
            // delete this[index]
            for (; ++index<this.length; ) {
                this[index-1] = this[index]
                // this[index-1].index--
                defObjProp(this[index-1], "index", index-1, false, true)
            }
            defObjProp(this, "length", this.length-1, false, true)
            delete this[this.length]
        }
        // if this leaves us with nothing in this group, we should also delete ourselves
        // (and if we are currently editing the group, move up a level...)
        // - but we shouldn't delete the 'root' group...
        // more specifically, if we are editing a group and delete the final item from the group,
        //   then we should (try to) move up a level and delete the now-empty group.  However, if
        //   we are acually in the process of deleting a sub-group (ie we are editing the parent of
        //   this group, or some other ancestor), then we should neither mess about with
        //   current_stack, nor attempt to delete ourselves (as the iteration process will do that
        //   just after we leave this call)
        if (this.length == 0) {
            if (current_stack === this && this.parent) {
                current_stack = this.parent
                this.parent.delete(this)
            }
        } else {
            // mark our bounds as (potentially) out of date
            this.bounds.maxX = new IntVal()
        }
        return index
    }
} )
// this is similar to delete() above, but doesn't mark the item as deleted or call its destroy()
// fucntion - this function is used when an item is moving to another group somewhere else...
defObjProp(Group.prototype, "remove", function(item) {
    // check to see if item is in this group
    if (item.parent !== this) {
        // can't remove an item from another group!
        return -1
    } else {
        var index = item.index
        if (index !== undefined) {
            // unset the item's parent property, in case the base object is referenced from anywhere
            // item.parent = null
            defObjProp(item, "parent", undefined, false, true)
            // item.index = undefined
            defObjProp(item, "index", undefined, false, true)
            // remove the item from our group
            // this.splice(index, 1)
            for (; ++index<this.length; ) {
                this[index-1] = this[index]
                // this[index-1].index--
                defObjProp(this[index-1], "index", index-1, false, true)
            }
            defObjProp(this, "length", this.length-1, false, true)
            delete this[this.length]
            // mark our bounds as (potentially) out of date
            this.bounds.maxX = new IntVal()
        }
        return index
    }
} )
// this gets called when this group is being deleted - we need to iterate through each of our items
// and delete them too
defObjProp(Group.prototype, "destroy", function() {
    for (var index=this.length; --index>=0; ) {
        this.delete(this[index])
    }
} )
// this is currently here for backwards compatability...
defObjProp(Group.prototype, "count", function() {
    return this.length
} )
// this is currently here for backwards compatability...
defObjProp(Group.prototype, "get", function(index) {
    return this[index]
} )
defObjProp(Group.prototype, "draw", function(active) {
    // do we also need to add parameters for context, colour, line_colour..?
    if (!active) active = (current_stack === this)
    var maxX = 0
    var maxY = 0
    var minX = canvasElement.width
    var minY = canvasElement.height
    var tmp
    var thisIsSelected = (this.parent === current_stack) && this.selected
    for (var index = 0; index<this.length; index++) {
        if (thisIsSelected && this[index].maxX) {
            tmp = this[index].maxX(); maxX = (tmp>maxX ? tmp : maxX)
            tmp = this[index].minX(); minX = (tmp<minX ? tmp : minX)
            tmp = this[index].maxY(); maxY = (tmp>maxY ? tmp : maxY)
            tmp = this[index].minY(); minY = (tmp<minY ? tmp : minY)
        }
        if (this[index].constructor === Group) {
            this[index].draw(active)
        } else {
            if (active) this[index].draw()
            else this[index].draw(drawingContext, this[index].colour.withRelAlpha(0.5), this[index].line_colour.withRelAlpha(0.5))
        }
    }
    if (thisIsSelected) {
        drawingContext.strokeStyle = this.selection.line_colour.withRelAlpha(0.5)
        drawingContext.lineWidth = this.selection.line_width
        // drawingContext.strokeRect(minX, minY, maxX-minX, maxY-minY)
        if (this.bounds.notDefined) this.updateBounds()
        drawingContext.strokeRect(this.bounds.minX + this.dragOffset.x, this.bounds.minY + this.dragOffset.y, this.bounds.maxX-this.bounds.minX, this.bounds.maxY-this.bounds.minY)
    }
} )
defObjProp(Group.prototype, "whichItem", function(recurse) {
    for (var index=this.length; --index>=0; ) {
        if (this[index].constructor === Group) {
            var temp = this[index].whichItem(recurse)
            if (temp !== null) {
                if (recurse) {
                    return temp
                } else {
                    return this[index]
                }
            }
        } else {
            if (this[index].isMouseOver()) return this[index]
        }
    }
    return null
} )
defObjProp(Group.prototype, "setDragOffset", function(offset) {
    defObjProp(this, "dragOffset", offset, false, true)
    Selection.prototype.setDragOffset.call(this, offset)
} )
defObjProp(Group.prototype, "moveAndResetDragOffset", function(offset) {
    defObjProp(this, "dragOffset", offset, false, true)
    Selection.prototype.moveAndResetDragOffset.call(this, offset)
} )
defObjProp(Group.prototype, "editStart", function() {
} )
defObjProp(Group.prototype, "editFinish", function() {
    this.updateBounds()
} )
defObjProp(Group.prototype, "updateBounds", function() {
    var index=this.length-1
    if (index >= 0) {
        this.bounds.minX = this[index].bounds.minX
        this.bounds.minY = this[index].bounds.minY
        this.bounds.maxX = this[index].bounds.maxX
        this.bounds.maxY = this[index].bounds.maxY
        for (; --index>=0; ) {
            this.bounds.minX = (this[index].bounds.minX < this.bounds.minX ? this[index].bounds.minX : this.bounds.minX)
            this.bounds.minY = (this[index].bounds.minY < this.bounds.minY ? this[index].bounds.minY : this.bounds.minY)
            this.bounds.maxX = (this[index].bounds.maxX > this.bounds.maxX ? this[index].bounds.maxX : this.bounds.maxX)
            this.bounds.maxY = (this[index].bounds.maxY > this.bounds.maxY ? this[index].bounds.maxY : this.bounds.maxY)
        }
    }
} )

// 'stack' Object, for keeping track of the order in which items are to be displayed
// this object should be intrinsically tied with the list of items - every item should appear
//   once, and only once, in the stack...
// it would be great to turn this into more of a 'tree' like object...
//   - individual nodes for individual items
//   - branches for grouped items
//   - branches for 'compound' items
//      (similar to grouped items, but the user cannot ungroup them)
// note: we could 'hide' item by removing them from the stack...  might be better to give them
//   a 'hidden' flag to prevent them being drawn - this way they'll remember their position in
//   the stack whilst hidden.  Would also be easier to find hidden items and therefore unhide
//   them!..
/*
var stack = new function() {
    this.list = []
    this.count = function() {
        return this.list.length
    }
    this.add = function(id) {
        var index = this.list.indexOf(id)
        if (index == -1) {
            return (this.list.push(id) - 1)
        } else {
            // don't add item a second time!..
            return index
        }
    }
    this.remove = function(id) {
        var index = this.list.indexOf(id)
        if (index != -1) {
            this.list.splice(index, 1)
        }
        return index
    }
    this.get = function(index) {
        return this.list[index]
    }
}
*/

// 'selection' Object, for keeping track of which items are currently selected
function Selection(parent) {
    defObjProp(this, "length", 0, false, true)
    defObjProp(this, "parent", parent)
}
defObjProp(Selection.prototype, "indexOf", Array.prototype.indexOf )
defObjProp(Selection.prototype, "splice", Array.prototype.splice )
defObjProp(Selection.prototype, "colour", null, true)
defObjProp(Selection.prototype, "line_width", 1, true)
defObjProp(Selection.prototype, "line_colour", new Colour(255,0,0), true)
// this is currently here for backwards compatability...
defObjProp(Selection.prototype, "count", function() {
    return this.length
} )
defObjProp(Selection.prototype, "any", function() {
    return (this.length > 0)
} )
// this is currently here for backwards compatability...
defObjProp(Selection.prototype, "get", function(index) {
    return this[index].id
} )
defObjProp(Selection.prototype, "clear", function() {
    for (; this.length>0; ) {
        defObjProp(this, "length", this.length-1, false, true)
        this[this.length].selected = false
        // if the item has a nowUnSelected() function, call it...
        if (this[this.length].nowUnSelected !== undefined) this[this.length].nowUnSelected();
        delete this[this.length]
    }
    return true
} )
defObjProp(Selection.prototype, "delete", function() {
    for (; this.length>0; ) {
        // deleting an item also automatically unselects it (by calling Selection.remove())
        // defObjProp(this, "length", this.length-1, false, true)
        this[this.length-1].parent.delete(this[this.length-1])
        // delete this[this.length]
    }
    return true
} )
defObjProp(Selection.prototype, "add", function(item) {
//    item.selected = true
//    var index = this.indexOf(item)
//    if (index == -1) {
    if (!item.selected) {
        this[this.length] = item
        defObjProp(this, "length", this.length+1, false, true)
        item.selected = true
        // if the item has a nowSelected() function, call it...
        if (item.nowSelected !== undefined) item.nowSelected();
//        return this.length
    } else {
        // don't add item a second time!..
//        return index
    }
} )
defObjProp(Selection.prototype, "solo", function(item) {
    for (; this.length>0; ) {
        defObjProp(this, "length", this.length-1, false, true)
        // we only want to 'un-select' everything other than the item given to us
        if (this[this.length] !== item) {
            this[this.length].selected = false
            // if the item has a nowUnSelected() function, call it...
            if (this[this.length].nowUnSelected !== undefined) this[this.length].nowUnSelected();
        }
        // but we want to remove everything from the list
        delete this[this.length]
    }
    // at this point this.length should be 0...
    this[this.length] = item
    defObjProp(this, "length", this.length+1, false, true)
    // if the item was previous not selected, mark is as now selected
    if (!item.selected) {
        item.selected = true
        // if the item has a nowSelected() function, call it...
        if (item.nowSelected !== undefined) item.nowSelected();
    }
//    return 0
} )
defObjProp(Selection.prototype, "remove", function(item) {
//    var index = this.indexOf(item)
//    if (index != -1) {
    if (item.selected) {
        item.selected = false
        // if the item has a nowUnSelected() function, call it...
        if (item.nowUnSelected) item.nowUnSelected();
        // this.splice(this.indexOf(item), 1)
        for (var index = this.indexOf(item); ++index<this.length; ) {
            this[index-1] = this[index]
        }
        defObjProp(this, "length", this.length-1, false, true)
        delete this[this.length]
    }
//    return index
} )
defObjProp(Selection.prototype, "addAll", function() {
    for (var index=this.parent.length; --index>=0; ) {
        if (!this.parent[index].selected) {
            this.parent[index].selected = true
            // if the item has a nowSelected() function, call it...
            if (this.parent[index].nowSelected) this.parent[index].nowSelected();
            this[this.length] = this.parent[index]
            defObjProp(this, "length", this.length+1, false, true)
        }
    }
    return true
} )
defObjProp(Selection.prototype, "setDragOffset", function(offset) {
    for (var index=this.length; --index>=0; ) {
        if (this[index].setDragOffset) this[index].setDragOffset(offset)
        else this[index].dragOffset = offset
    }
} )
defObjProp(Selection.prototype, "moveAndResetDragOffset", function(offset) {
    for (var index=this.length; --index>=0; ) {
        if (this[index].moveAndResetDragOffset) this[index].moveAndResetDragOffset(offset)
        else Shape.prototype.moveAndResetDragOffset.call(this[index], offset)
    }
} )




/**************************************************************************************************\
*                                    Position and Mouse objects                                    *
\**************************************************************************************************/


function Position(x, y) {
    this.x = x
    this.y = y
}

function Mouse() {
    this.x = null
    this.y = null
    this.updatePosition = function (e) {
        /* returns a copy of self (with .x and .y properties) */
        // This version also caches our mouse coordinates - mainly for use with key-press events
        if (e.pageX != undefined && e.pageY != undefined) {
            this.x = e.pageX
            this.y = e.pageY
        } else {
            this.x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft
            this.y = e.clientY + document.body.scrollTop  + document.documentElement.scrollTop
        }
        this.x -= canvasElement.offsetLeft
        this.y -= canvasElement.offsetTop
        
        return this
    }
    this.dragging = false
    this.dragStart = new Position(null, null)
    this.dragOffset = new Position(null, null)
    this.dragNoOffset = new Position(0, 0)
    this.startDrag = function () {
        if (!this.dragging) {
            this.dragging = true
            this.dragStart.x = this.x
            this.dragStart.y = this.y
            this.dragOffset.x = this.dragOffset.y = 0
            current_stack.selection.setDragOffset(this.dragOffset)
        }
    }
    this.doDrag = function () {
        if (this.dragging) {
            this.dragOffset.x = this.x - this.dragStart.x
            this.dragOffset.y = this.y - this.dragStart.y
        }
    }
    this.stopDrag = function () {
        if (this.dragging) {
            if (current_stack.selection.any()) {
                this.dragOffset.x = this.x - this.dragStart.x
                this.dragOffset.y = this.y - this.dragStart.y
                // one or more items selected - move them!
                current_stack.selection.moveAndResetDragOffset(this.dragNoOffset)
            }
            this.dragging = false
            this.dragStart.x = this.dragStart.y = this.dragOffset.x = this.dragOffset.y = null
        }
    }
    this.cancelDrag = function () {
        current_stack.selection.setDragOffset(this.dragNoOffset)
        this.dragging = false
        this.dragStart.x = this.dragStart.y = this.dragOffset.x = this.dragOffset.y = null
    }
}
setObjProto(Mouse, Position)





/**************************************************************************************************\
*                                     'fake variable' objects                                      *
\**************************************************************************************************/


// This is a form of an integer 'variable'
// it can either be an integer, or 'undefined'
// its value can be changed with x.set(2) (note: whatever is passed with get convered to an integer
//   using a ~~ operation - seems to be speediest across most browsers:
//   http://jsperf.com/performance-of-parseint/42 )
// its value can be referred to with just x (or x.get() if you prefer, or x.value)
// the main reason I've made this is that it is an object, so can be 'copied' by reference and
//   linked from multiple places - each 'copy' will point to the same original object, and therefore
//   keep up with any changes made.
// we can optionally set x.undefinedString to (a string) to be returned by toString if our value is
//   undefined.  Defaults to an empty string, but could be 'undefined' or '<none>' for example...
function IntVal(val) {
    this.set(val)
}
defObjProp(IntVal.prototype, "set", function(val) {
    defObjProp(this, "value", (val!==undefined ? ~~val : val), false, true)
} )
defObjProp(IntVal.prototype, "valueOf", function() {
    return this.value
} )
defObjProp(IntVal.prototype, "get", IntVal.prototype.valueOf)
defObjProp(IntVal.prototype, "toString", function() {
    return (this.value!==undefined ? '' + this.value : '' + this.undefinedString)
} )
defObjProp(IntVal.prototype, "undefinedString", '')






/**************************************************************************************************\
*                                          Colour object                                           *
\**************************************************************************************************/


function Colour(r,g,b,a) {
    switch (arguments.length) {
        case 0:  r=g=b=255; a=1; break
        case 1:  g=b=r; a=1; break
        case 2:  a=g; g=b=r; break
        case 3:  a=1; break
    }
    this.r = r
    this.g = g
    this.b = b
    this.a = a
}
defObjProp(Colour.prototype, "toString", function() {
    return "rgba("+this.r+", "+this.g+", "+this.b+", "+this.a+")"
} )
defObjProp(Colour.prototype, "withAlpha", function(alpha) {
    return "rgba("+this.r+", "+this.g+", "+this.b+", "+alpha+")"
} )
defObjProp(Colour.prototype, "withRelAlpha", function(alpha) {
    return "rgba("+this.r+", "+this.g+", "+this.b+", "+this.a*alpha+")"
} )




/**************************************************************************************************\
*                                      Shape item definitions                                      *
\**************************************************************************************************/


function Bounds() {
    this.minX = new IntVal();
    this.minY = new IntVal();
    this.maxX = new IntVal();
    this.maxY = new IntVal();
}
defObjProp(Bounds.prototype, "notDefined", function() {
    return (this.maxX.value === undefined || this.maxY.value === undefined || this.minX.value === undefined || this.minY.value === undefined)
} )


// Set up the Shape prototype.
// I think we are unlikely to create any Shapes directly, but we will set this as the __proto__ for
//   other shape types, so that we can inherit (default) functions and values from Shape
function Shape() {
    callParentConstructor(this, Shape.prototype)
    this.x = new IntVal()
    this.y = new IntVal()
    defObjProp(this, "bounds", new Bounds())
    this.colour = new Colour(255, 255, 255)
    this.line_width = new IntVal(3)
    this.line_colour = new Colour(119, 119, 119)
    this.cursorStyle = "pointer"
    this.dragOffset = mouse.dragNoOffset
}
setObjProto(Shape, Item)
defObjProp(Shape.prototype, "draw", function(context, colour, line_colour) {
    switch (arguments.length) {
        case 0:  context = drawingContext
        case 1:  colour = this.colour
        case 2:  line_colour = this.line_colour
    }
    if (this.selected) {
        // item is selected
        if (this.parent.selection.colour) colour = this.parent.selection.colour
        if (this.parent.selection.line_colour) line_colour = this.parent.selection.line_colour
    }
    
    // not sure what to draw for a 'default' here... maybe a small cross, or something..?
} )
defObjProp(Shape.prototype, "isMouseOver", function() {
    return ( (this.x == mouse.x) && (this.y == mouse.y) )
} )
defObjProp(Shape.prototype, "isSelected", function() {
    return ( (this.parent === current_stack) ? this.selected : (this.parent ? this.parent.isSelected() : false) )
} )
defObjProp(Shape.prototype, "moveAndResetDragOffset", function(offset) {
    this.x.set(this.x + this.dragOffset.x)
    this.y.set(this.y + this.dragOffset.y)
    this.bounds.minX.set(this.x-1)
    this.bounds.maxX.set(this.x+1)
    this.bounds.minY.set(this.y-1)
    this.bounds.maxY.set(this.y+1)
    this.dragOffset = offset
} )


function Rectangle(x, y, width, height, colour, line_width, line_colour) {
    // deal with default values for any missing arguments...
    // (borrowed from here: http://stackoverflow.com/a/9363769)
    switch (arguments.length) {
        case 2:  width = 10;
        case 3:  height = 10;
        case 4:  colour = new Colour(255, 255, 255);
        case 5:  line_width = 3;
        case 6:  line_colour = new Colour(119, 119, 119);
    }
    callParentConstructor(this, Rectangle.prototype)
    // this.type = "rectangle";
    // this.id = newItemId++;
    this.x.set(x);
    this.y.set(y);
    this.width = new IntVal(width);
    this.height = new IntVal(height);
    this.colour = colour;
    this.line_width.set(line_width);
    this.line_colour = line_colour;
}
setObjProto(Rectangle, Shape)


function Circle(x, y, radius, colour, line_width, line_colour) {
    // deal with default values for any missing arguments...
    // (borrowed from here: http://stackoverflow.com/a/9363769)
    switch (arguments.length) {
        case 2:  radius = 10;
        case 3:  colour = new Colour(255, 255, 255);
        case 4:  line_width = 3;
        case 5:  line_colour = new Colour(119, 119, 119);
    }
    // Call the Shape constructor function:
    // Shape.call(this)
    //   more generic version:
    // Object.getPrototypeOf(Object.getPrototypeOf(this)).constructor.call(this)
    //   neater version:
    callParentConstructor(this, Circle.prototype)
    // this.type = "circle";
    //  could instead use item.constructor.name (which gives "Circle")
    //  or item.constructior === Circle to see if an item is a Circle
    // this.id = newItemId++;
    //  now the id is initialised by items.add()...
    //  and now the id is initialied by the Item constructor function
    this.x.set(x)
    this.y.set(y)
    this.radius = new IntVal(radius)
    this.colour = colour
    this.line_width.set(line_width)
    this.line_colour = line_colour
    this.cursorStyle = "pointer"
    this.updateBounds()
}
setObjProto(Circle, Shape)

// add some 'methods' to our genreal Circle.prototype
// this (I think) means that we only really have one instance of each function - it just gets called
//   with a different 'this' depending on which Circle is using it
//   (as apposed to defining them within the creator function above, in which case each new Circle
//   creates its own instance of each function - which must use more resources, surely..?)
// this also means we can make functions non-enumerable - probably less useful for Circles and the
//   like, but may be useful for other things...
defObjProp(Circle.prototype, "draw", function(context, colour, line_colour) {
    switch (arguments.length) {
        case 0:  context = drawingContext
        case 1:  colour = this.colour
        case 2:  line_colour = this.line_colour
    }
    if (this.isSelected()) {
        // item is selected, or is part of a group that is selected
        if (this.parent.selection.colour) colour = this.parent.selection.colour
        if (this.parent.selection.line_colour) line_colour = this.parent.selection.line_colour
    }
    
    context.beginPath()
    context.arc(this.getX(), this.getY(), this.radius, 0, Math.PI*2, false)
    context.closePath()
    
    context.fillStyle = colour.toString()
	context.fill()
    
    context.strokeStyle = line_colour.toString()
    context.lineWidth = this.line_width
    context.stroke()
} )

defObjProp(Circle.prototype, "isMouseOver", function() {
    return ( (Math.pow(this.getX() - mouse.x,2) + Math.pow(this.getY() - mouse.y,2)) <= Math.pow(this.radius,2) )
} )

defObjProp(Circle.prototype, "moveAndResetDragOffset", function(offset) {
    this.x.set(this.x + this.dragOffset.x)
    this.y.set(this.y + this.dragOffset.y)
    this.updateBounds()
    this.dragOffset = offset
} )
defObjProp(Circle.prototype, "updateBounds", function() {
    this.bounds.minX.set(this.x - this.radius - (this.line_width / 2))
    this.bounds.maxX.set(this.x + this.radius + (this.line_width / 2))
    this.bounds.minY.set(this.y - this.radius - (this.line_width / 2))
    this.bounds.maxY.set(this.y + this.radius + (this.line_width / 2))
} )

defObjProp(Circle.prototype, "getX", function() {
    return ( this.x + this.dragOffset.x )
} )
defObjProp(Circle.prototype, "getY", function() {
    return ( this.y + this.dragOffset.y )
} )

defObjProp(Circle.prototype, "maxX", function() {
    return ( this.x + this.dragOffset.x + this.radius + (this.line_width / 2) )
} )
defObjProp(Circle.prototype, "minX", function() {
    return ( this.x + this.dragOffset.x - this.radius - (this.line_width / 2) )
} )
defObjProp(Circle.prototype, "maxY", function() {
    return ( this.y + this.dragOffset.y + this.radius + (this.line_width / 2) )
} )
defObjProp(Circle.prototype, "minY", function() {
    return ( this.y + this.dragOffset.y - this.radius - (this.line_width / 2) )
} )




/**************************************************************************************************\
*                                          Event handlers                                          *
\**************************************************************************************************/


// Mouse Click Events sequence:
// 1) MouseDown
// 2) MouseUp
// 3) Click
//
// 4) MouseDown
// 5) MouseUp
// 6) Click
// 7) DoubleClick
//
// Because the browser considers the canvas to be one element (it doesn't know about our 'items'),
// we tend to receive most of these even if the mouse moves about a bit between the MouseDown and
// MouseUp.  If the MouseDown happens outside the canvas, but the MouseUp happens within the canvas,
// then we don't get a Click after the MouseUp.  Pressing Escape between MouseDown and MouseUp
// doesn't appear to cancel the Click.  Doesn't seem to matter how long the pause between the
// MouseDown and MouseUp - we still get a Click.


function canvasMouseDown(e) {
    timings.add("MouseDown - start")
    // button detection needs improving, espeically if this is ever to become cross-browser compatible!.. see here:
    // http://javascript.info/tutorial/mouse-events#getting-the-button-info-which-button
    // or here:
    // http://www.quirksmode.org/js/events_properties.html#button
    if (e.button == 0) {
        // normal left-click
        
        // prevent default actions - in particular for a double click (tends to highlight some text
        //   around the canvas!..)
//        e.preventDefault();
        // unfortunately this also prevents the canvas from getting the focus when we click on it,
        //   which prevents us from receiving KeyDown events...
        // see here for methods to work out if our convas has the focus at the moment (not straight
        //   forward!): http://www.whatwg.org/specs/web-apps/current-work/#focus-management-apis
//        if ( !(document.hasFocus() && (document.activeElement == canvasElement)) ) {
            // Now, 'manually' pulling focus to the canvas like this seems to move the window around
            //   (which I don't really want), so...
            // (window.scrollX and .scrollY don't seem to work..? although they should do! see here:
            // https://developer.mozilla.org/en-US/docs/Web/API/window.scrollY
            // and here:
            // http://stackoverflow.com/questions/3791336/why-were-window-scrolly-and-window-scrollx-introduced )
            // var scroll_x = window.pageXOffset;
            // var scroll_y = window.pageYOffset;
            // This is more robust across various browsers...
//            var scroll_x = (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
//            var scroll_y = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
//            canvasElement.focus();
//            window.scroll(scroll_x,scroll_y);
//        }
        mouse.updatePosition(e);
        
        // try to work out if we have clicked on an existing item or not...
        var this_item = which_item()
        
        if (this_item === null) {
            // we've clicked in empty space...
            if (current_stack.selection.any()) {
                // one or more items currently selected - unselect everything
                current_stack.selection.clear();
            } else {
                // nothing currently selected - do nothing for now..?
            }
        } else {
            // we've clicked on an item...
            
            if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.altGraphKey && !e.metaKey) {
                // straight forward click - select this item only
                // ...unless this item is already selected (or part of a larger selection), in which case don't change anything...
                if (!this_item.selected) {
                    // not currently selected - select it!
                    current_stack.selection.solo(this_item)
                }
            } else if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.altGraphKey && !e.metaKey) {
                // shift-click - add this item to the selection (if not already selected!)
                current_stack.selection.add(this_item)
            } else if (!e.shiftKey && e.ctrlKey && !e.altKey && !e.altGraphKey && !e.metaKey) {
                // control-click - toggle this item 'selected' state
                // is this item already selected..?
                if (this_item.selected) {
                    // yes - remove it from the list!
                    current_stack.selection.remove(this_item);
                } else {
                    // no - add it to the list!
                    current_stack.selection.add(this_item);
                }
            } else {
                // some other form of click... do nothing..?
            }
            
            mouse.startDrag()
        }
  
        // update canvas
        draw();
        // update mouse pointer
        setCursorStyle(this_item);
    } else {
        // right-click (or maybe middle-click?)
    }
    timings.add("MouseDown - end")
}

// This gets called just after a mouse up event - regardless of whether there's been any mouse movment... (on Chrome on my Chromebook)
function canvasClick(e) {
    // currently, all the code that was here is now in MouseDown, above... 
    timings.add("Click - start/end")
}

// this is very similar to MouseOut, below...
function canvasMouseUp(e) {
    timings.add("MouseUp - start")
    if (mouse.dragging) {
        mouse.updatePosition(e);
        mouse.stopDrag()
        
        // not certain if we really need to re-draw here or not...
        // ... but I guess that the mouse could have moved since we received out last mouseMove
        //   event..?
        draw();
        // update mouse pointer
        setCursorStyle(which_item());
    }
    timings.add("MouseUp - end")
}

// this is very similar to MouseUp, above...
function canvasMouseOut(e) {
    timings.add("MouseOut - start")
    if (mouse.dragging) {
        // if we call this, we can potentially move items outside our canvas more easily...
        // if we dont' call it, then we'll stop the drag at the previous known mouse position (which
        //   should be within the canvas)
        // mouse.updatePosition(e);
        mouse.stopDrag()

        // not certain if we really need to re-draw here or not...
        draw();
    }
    // update mouse pointer
    setCursorStyle(null);
    timings.add("MouseOut - end")
}

// This gets called when the user double clicks with a mouse (or on a touch screen..?)
// When the user double clicks with a mouse, we receive one Click event for the first click, then a second Click event followed by a DoubleClick event for the second click
function canvasDoubleClick(e) {
    timings.add("DoubleClick - start")
    mouse.updatePosition(e);

    // try to work out if we have clicked on an existing item or not...
    var this_item = which_item()

    if (this_item === null) {
        // double click not on an item - add a new circle to our items list, where we clicked...
        // add it to the list, and update this_item - mainly for the benefit of the call to
        //   setCursor below
        current_stack.add(new Circle(mouse.x, mouse.y, 10+Math.floor(Math.random()*11)));
        this_item = which_item()
    } else {
        // we've double clicked on an item...
        
        if (current_stack.selection.length == 1 && this_item.selected) {
            // 'edit' the object we've double clicked on
            switch (this_item.constructor) {
                case Group:
                    current_stack = this_item
                    current_stack.editStart()
                    this_item = which_item()
                    break;
            }
        } else {
            // select only this item
            current_stack.selection.solo(this_item)
        }
    }
    
    // prevent default actions for a double click (tends to highlight some text around the canvas!..)
    // e.preventDefault();
    // this doesn't work - we need to prevent mouse-down events, above...
    // ... or with canvasElement.onselectstart, down below (in init)

    // update canvas
    draw();
    // update mouse pointer
    setCursorStyle(this_item);
    timings.add("DoubleClick - end")
}

function canvasMouseMove(e) {
    mouse.updatePosition(e);
    if (mouse.dragging) {
        timings.add("MouseMove-dragging - start")
        mouse.doDrag()
        draw()
        timings.add("MouseMove-dragging - end")
    }

    // try to work out if we are over an existing item or not...
    setCursorStyle(which_item())
}

function canvasKeyDown(e) {
    console.log("KeyDown event:", "e.keyIdentifier:", e.keyIdentifier)
    switch (e.keyIdentifier) {
    case "U+007F": // Delete (alt-backspace)
    case "U+0008": // Backspace
        // if we want to prevent the Backspace button from moving us to the previous page in the
        //   browser history, then we need to catch the KeyDown event (for e.keyIdentifier =
        //   "U+0008") and run e.preventDefault()
        // note: the move to the previous page normally happens on the key down event, so if we wait
        //   for the key up event it'll be too late!.. (in Chrome, on my Chromebook, at least...)
        e.preventDefault();
        if (current_stack.selection.any()) {
            // one or more items selected - delete them!
            current_stack.selection.delete();
            draw();
            setCursorStyle(which_item());
        }
        break;
    case "U+0041": // A
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.altGraphKey && !e.metaKey) {
            // Ctrl-A - select all items!
            current_stack.selection.addAll();
            e.preventDefault();
            draw();
            setCursorStyle(which_item());
        } else {
            // do nothing..?
        }
        break;
    case "U+0047": // G
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.altGraphKey && !e.metaKey) {
            // Ctrl-G - group selected items! (if more than one item currently selected...)
            if (current_stack.selection.length > 1) {
                var new_group = current_stack.add(new Group())
                // now, we really want items in the group to retain the same (relative) stacking
                //   order as they currently have.  So we can't just iterate through
                //   current_stack.selection, as this doesn't keep track of stacking order...
                // also... it would be nice if we were able to insert our new group at some
                //   appropriate point in the stacking order - either in the same place as the
                //   front-most item of the selection, or the back-most item, or some kind of
                //   'average' position...
                for (var index=0; index<current_stack.length; index++) {
                    if (current_stack[index].selected) {
                        current_stack.selection.remove(current_stack[index])
                        new_group.add(current_stack[index])
                        // note, this will remove this item from current_stack, which will mess up
                        // our iteration, unless be do this...
                        index--
                    }
                }
                current_stack.selection.add(new_group)
            }
            e.preventDefault()
            draw()
            setCursorStyle(which_item())
        } else {
            // do nothing..?
        }
        break;
    case "U+0055": // U
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.altGraphKey && !e.metaKey) {
            // Ctrl-U - un-group selected items!
            e.preventDefault();
            if (current_stack.selection.length >= 1) {
                // really, we should insert the un-grouped items at the same point in the stack
                //   as there group presiously was...
                // now, we really want items in the group to retain the same (relative) stacking
                // order as they currently have.  So we can't just iterate through
                // current_stack[index].selection, as this doesn't keep track of stacking order...
                var length = current_stack.length
                for (var index=0; index<length; index++) {
                    if (current_stack[index].selected && (current_stack[index].constructor === Group) ) {
                        // pop all item items out of this sub-group, into the current stack level
                        // ideally we want to keep their stacking order in-tact, so start at the
                        //   back and work forwards until there's nothing left in the sub-group...
                        for (; current_stack[index].length>0; ) {
                            current_stack.selection.add(current_stack.add(current_stack[index][0]))
                        }
                        current_stack.delete(current_stack[index])
                        // note, this will remove this item from current_stack, which will mess up
                        // our iteration, unless be do this...
                        index--; length--
                    }
                }
            }
            draw();
            setCursorStyle(which_item());
        } else {
            // do nothing..?
        }
        break;
    case "U+001B": // Esc
        if (mouse.dragging) {
            // cancel the drag
            mouse.cancelDrag()
            draw();
            setCursorStyle(which_item());
        } else if (current_stack !== stack) {
            // if we are editing a group, come up a level out of the group
            current_stack.editFinish()
            current_stack = current_stack.parent
            draw();
            setCursorStyle(which_item());
        }
        break;
    case "U+0050": // P
        if (!e.ctrlKey && !e.shiftKey && e.altKey && !e.altGraphKey && !e.metaKey) {
            // Alt-P - call the debugger and pause this script
            debugger
        }
        break;
    }
}

// go through all the items (in reverse stacking order) to see which, if any, we are over
function which_item() {
    return current_stack.whichItem(false)
//    for (var index = current_stack.length; --index>=0; ) {
//        if (current_stack[index].isMouseOver()) return current_stack[index];
//    }
//    return null;
}

function setCursorStyle(item) {
    var cursor
    if (mouse.dragging) {
		cursor = "move";
    } else if (item === null) {
        // not over any existing items
		cursor = "default";
    } else {
        // over an item
        if (item.getCursorStyle) cursor = item.getCursorStyle();
        if (cursor === undefined) cursor = item.cursorStyle;
        if (cursor === undefined) cursor = "default";
    }
    if (canvasElement.style.cursor != cursor) canvasElement.style.cursor = cursor;

    status['thisId'].innerHTML = (item ? item.id+" ("+item.constructor.name+")" : "&lt;none&gt;")
}

function draw() {
    timings.add("draw - start")
    // start from scratch - clear the whole canvas
    drawingContext.clearRect(0, 0, canvasWidth, canvasHeight);

    // draw our background
    var gradient = drawingContext.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, "#d0d0d0");
    gradient.addColorStop(1, "#fbfbfb");
    // gradient.addColorStop(0, "#ff0000");
    // gradient.addColorStop(0.25, "#ffff00");
    // gradient.addColorStop(0.5, "#00ff00");
    // gradient.addColorStop(0.75, "#00ffff");
    // gradient.addColorStop(1, "#0000ff");
    drawingContext.fillStyle = gradient;
    // drawingContext.fillStyle = "#eee";
    drawingContext.fillRect(0, 0, canvasWidth, canvasHeight)

    stack.draw(false)

    status['totalCount'].innerHTML = Item.count
    status['nextId'].innerHTML = Item.nextItemId
    status['groupCount'].innerHTML = current_stack.length
    status['selectionCount'].innerHTML = current_stack.selection.length
    timings.add("draw - end", true)
}

function init() {
    // check if canvas already exists in the html document, and create one if not
    canvasElement = document.getElementById('myCanvas');
    if (!canvasElement) {
        canvasElement = document.createElement("canvas");
    	canvasElement.id = "myCanvas";
    	document.body.appendChild(canvasElement);
    }
    // set the height and width of out canvas
    canvasElement.width = canvasWidth;
    canvasElement.height = canvasHeight;
    canvasElement.tabIndex = 1;
    // get the drawign context for the canvas
    drawingContext = canvasElement.getContext("2d");

    // New Groups refer to mouse.dragNoOffset, so we need to define mouse before stack...
    mouse = new Mouse()
    
    // 'stack' is the variable that always points to the top level group
    stack = new Group()
    // 'current_stack' points to the group that we are currently viewing/editing
    current_stack = stack
    
    items = new ListOfItems()

    // listen out for clicks
    //canvasElement.addEventListener("click", canvasClick, false);
    // listen out for double-clicks
    canvasElement.addEventListener("dblclick", canvasDoubleClick, false);
    // listen out for mouse down events
    canvasElement.addEventListener("mousedown", canvasMouseDown, false);
    // ... and for mouse moves
    canvasElement.addEventListener("mousemove", canvasMouseMove, false);
    // ... and for mouse up events
    canvasElement.addEventListener("mouseup", canvasMouseUp, false);
    // ... and for mouse out events
    canvasElement.addEventListener("mouseout", canvasMouseOut, false);
    // ... and for key-down events
    // note: the canvas element doesn't take the input focus when clicked on, so therefore it doesn't receive any key events
    // document.body.addEventListener("keydown", bodyKeyDown, false);
    // okay, if you give the canvas element a tabindex, then it can and will take the input focus!..
    // (this information found here: http://stackoverflow.com/a/57332)
    canvasElement.addEventListener("keydown", canvasKeyDown, false);
    // prevent double-clicks on the canvas from selecting a block of text
    // (may not work well across browsers..?)
    canvasElement.onselectstart = function() { return false; }

    // check if a counter already exists in the html document, and create one if not
    status['totalCount'] = document.getElementById('totalCount');
    if (!status['totalCount']) {
        status['totalCount'] = document.createElement("p");
	    document.body.appendChild(status['totalCount']);
    }

    // check if a 'next id' already exists in the html document, and create one if not
    status['nextId'] = document.getElementById('nextId');
    if (!status['nextId']) {
        status['nextId'] = document.createElement("p");
	    document.body.appendChild(status['nextId']);
    }

    // check if a 'this id' already exists in the html document, and create one if not
    status['thisId'] = document.getElementById('thisId');
    if (!status['thisId']) {
        status['thisId'] = document.createElement("p");
	    document.body.appendChild(status['thisId']);
    }

    // check if a counter already exists in the html document, and create one if not
    status['groupCount'] = document.getElementById('groupCount');
    if (!status['groupCount']) {
        status['groupCount'] = document.createElement("p");
	    document.body.appendChild(status['groupCount']);
    }

    // check if a counter already exists in the html document, and create one if not
    status['selectionCount'] = document.getElementById('selectionCount');
    if (!status['selectionCount']) {
        status['selectionCount'] = document.createElement("p");
	    document.body.appendChild(status['selectionCount']);
    }

    // set up a bunch of random circles...
    for (var i = 0; i < 10; i++) {
        stack.add(new Circle(Math.floor(Math.random() * canvasWidth), Math.floor(Math.random() * canvasHeight), 10+Math.floor(Math.random()*11)));
    }
    
    // add a sub-group, with a few more random circles in it...
    var sub_group = new Group()
    stack.add(sub_group)
    for (var i = 0; i < 4; i++) {
        sub_group.add(new Circle(Math.floor(Math.random() * canvasWidth), Math.floor(Math.random() * canvasHeight), 10+Math.floor(Math.random()*11), new Colour(238, 238, 238)));
    }
    
    // do an initial drawing of our (blank?) canvas
    draw();
}

init()

})(window, document);