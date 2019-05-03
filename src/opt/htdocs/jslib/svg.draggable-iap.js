//modified by iap
//import { Box, Element, G, extend, off, on } from '@svgdotjs/svg.js'
var Box = SVG.Box
var Element= SVG.Element
var G = SVG.G
var extend = SVG.extend
var off = SVG.off
var on = SVG.on
//end of modification
const getCoordsFromEvent = (ev) => {
  if (ev.changedTouches) {
    ev = ev.changedTouches[0]
  }
  return { x: ev.clientX, y: ev.clientY }
}

// Creates handler, saves it
class DragHandler {
  constructor (el) {
    el.remember('_draggable', this)
    this.el = el

    this.drag = this.drag.bind(this)
    this.startDrag = this.startDrag.bind(this)
    this.endDrag = this.endDrag.bind(this)
  }

  // Enables or disabled drag based on input
  init (enabled) {
    if (enabled) {
      this.el.on('mousedown.drag', this.startDrag)
      this.el.on('touchstart.drag', this.startDrag)
    } else {
      this.el.off('mousedown.drag')
      this.el.off('touchstart.drag')
    }
  }

  // Start dragging
  startDrag (ev) {
    const isMouse = !ev.type.indexOf('mouse')

    // Check for left button
    if (isMouse && (ev.which || ev.buttons) !== 1) {
      return
    }

    // Fire beforedrag event
    if (this.el.fire('beforedrag', { event: ev, handler: this }).defaultPrevented) {
      return
    }

    // Prevent browser drag behavior as soon as possible
    ev.preventDefault()

    // Prevent propagation to a parent that might also have dragging enabled
    ev.stopPropagation()

    // Make sure that start events are unbound so that one element
    // is only dragged by one input only
    this.init(false)

    //modified by iap
    this.box = (this.el.type=='g') ? this.el.gbox() : this.el.bbox()
    this.lastClick = getCoordsFromEvent(ev)

    // drag correctly for a rotated element
    var r = this.el.remember('angel')
    if (r){
      const xy = this.lastClick
      r = SVG.utils.radians(-r)
      const m =  new SVG.Matrix(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0)
      const a =  m.around(xy.x, xy.y)
      const p = new SVG.Point(xy.x, xy.y)
      this.lastClick = p.transform(a)
    } 

    //end of modification
    // We consider the drag done, when a touch is canceled, too
    const eventMove = (isMouse ? 'mousemove' : 'touchmove') + '.drag'
    const eventEnd = (isMouse ? 'mouseup' : 'touchcancel.drag touchend') + '.drag'

    // Bind drag and end events to window
    on(window, eventMove, this.drag)
    on(window, eventEnd, this.endDrag)

    // Fire dragstart event
    this.el.fire('dragstart', { event: ev, handler: this, box: this.box })
  }

  // While dragging
  drag (ev) {
    const { box, lastClick } = this
    var xy = getCoordsFromEvent(ev)
    
    var r = this.el.remember('angel')
    if (r){
      r = SVG.utils.radians(-r)
      const m =  new SVG.Matrix(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0)
      const a =  m.around(xy.x, xy.y)
      const p = new SVG.Point(xy.x, xy.y)
      xy = p.transform(a)
    }    
    //modified by iap
    const currentClick = xy
    //end of modification
    const x = box.x + (currentClick.x - lastClick.x)
    const y = box.y + (currentClick.y - lastClick.y)
    const newBox = new Box(x, y, box.w, box.h)
    if (this.el.fire('dragmove', {
      event: ev,
      handler: this,
      box: newBox
    }).defaultPrevented) {
      return
    }
    this.move(x,y)
    return newBox
  }

  move (x, y) {
    // Svg elements bbox depends on their content even though they have
    // x, y, width and height - strange!
    // Thats why we handle them the same as groups
    if (this.el.type === 'svg') {
      G.prototype.move.call(this.el, x, y)
    } 
    else {
      if (this.el.masker) {
        this.el.masker.each(function(){
          this.move(x,y)
        })
      }
      
      var r = this.el.remember('angel')
      if (r && this.el.type=='g'){
        //目前這是失敗的情況，在群組有角度之下的拖動不能運作
        r = SVG.utils.radians(-r)
        const m =  new SVG.Matrix(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0)
        this.el.each(function(){
          var bbox = this.bbox()
          const a =  m.around(bbox.x,bbox.y)
          const p = new SVG.Point(bbox.x, bbox.y)
          const xy = p.transform(a)          
          this.move(xy.x, xy.y)
        })       
      }
      else{
        this.el.move(x, y)
      }
      
    }
    //this.el.fire('move',[x,y])
  }

  endDrag (ev) {
    // final drag
    const box = this.drag(ev)

    // fire dragend event
    this.el.fire('dragend', { event: ev, handler: this, box })

    // unbind events
    off(window, 'mousemove.drag')
    off(window, 'touchmove.drag')
    off(window, 'mouseup.drag')
    off(window, 'touchend.drag')

    // Rebind initial Events
    this.init(true)
  }
}

extend(Element, {
  draggable (enable = true) {
    const dragHandler = this.remember('_draggable') || new DragHandler(this)
    dragHandler.init(enable)
    return this
  }
})
