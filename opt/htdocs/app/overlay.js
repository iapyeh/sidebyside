/*
 * Depends on concrete-2.0.min.js
 * REF: http://www.concretejs.com/#examples
 */
'use strict';

function Overlay(surface_container_ele){
   
    this.overlay_surface = document.createElement('div')
    this.overlay_surface.setAttribute('id','overlay_surface')
    this.overlay_surface.style.userSelect = 'none'
    this.overlay_surface.className = 'origin-hide-me' //be hidden in screen "origin" mode
    surface_container_ele.appendChild(this.overlay_surface)
    this.visible = true
    this.paused = false

    this.ctx = null
    this.flag = false
    this.prevX = 0
    this.currX = 0
    this.prevY = 0
    this.currY = 0
    this.dot_flag = false;

    this.x = 'rgba(0,0,0,1)' //color
    this.y = 2;  //stroke width
    this.eraser_mode = false

    this.width = 0;
    this.height = 0

    /* a chunk of drawing data */
    this._draw_data = []

    this.scale = 1
    //support infinite long canvas by 2 canvas
    this.canvas_a = null
    this.canvas_b = null
    /*
     * delegate should implement:
     *  on_draw()
     */
    this.delegate = null

    //for compatible to overlay_svg.js
    this.draw = {
        size:function(){}
    }

}
Overlay.prototype = {
    set_options:function(options){
        if (options.color) {
            this.x = options.color
        }
        if (options.size){
            this.y = options.size
            this._set_filter(this.y)
        } 
    },
    set_scroll:function(){
        //for compability only
    },
    _set_filter:function(n){
        //internally called to set blur 
        //auto set blur effect
        
        return
        
        if (n > 2){
            var b = Math.ceil(n/6)
            this.ctx.filter = 'blur('+b+'px)'     
        }
        else{
            this.ctx.filter = ''
        }
    },
    init:function(options){
        //options comes from preferences
        this.set_options(options)
        var container = this.overlay_surface
        var self = this
        var pinch = false //pinch is used for zoom-in, zoom-out
        var mouse_down = function (e) {
            self.findxy('down', e)
        }
        var touch_start = function (e) {
            if (e.touches.length>1) {
                pinch=[(e.touches[1].clientX+e.touches[0].clientX)/2,(e.touches[0].clientY+e.touches[1].clientY)/2];
                self.findxy('up', e); 
                return
            }
            self.findxy('down', e)
        }
        var mouse_move =  function (e) {
            self.findxy('move', e)
        }
        var touch_move =  function (e) {
            if (pinch) return
            self.findxy('move', e)
        }
        var mouse_up = function (e) {
            self.findxy('up', e)
        }
        var touch_end = function (e) {
            if (pinch) {
                pinch=false;
                return
            }
            self.findxy('up', e)
        }
        var mouse_out =  function (e) {
            self.findxy('out', e)
        }
        this.enable_listeners = function(){
            container.addEventListener("mousedown", mouse_down , false);
            container.addEventListener("touchstart", touch_start, false);
            container.addEventListener("mousemove", mouse_move, false);
            container.addEventListener("touchmove",touch_move, false);        
            container.addEventListener("mouseup", mouse_up, false);
            container.addEventListener("touchend", touch_end, false);
            container.addEventListener("mouseout", mouse_out, false);    
        }
        this.disable_listeners = function(){
            container.removeEventListener("mousedown", mouse_down , false);
            container.removeEventListener("touchstart", touch_start, false);
            container.removeEventListener("mousemove", mouse_move, false);
            container.removeEventListener("touchmove",touch_move, false);        
            container.removeEventListener("mouseup", mouse_up, false);
            container.removeEventListener("touchend", touch_end, false);
            container.removeEventListener("mouseout", mouse_out, false);                
        }
    },
    set_size:function(rect){
        //this will create the 1st canvas
        this.rect = rect
        //viewport size
        var orientation = rect.width > rect.height ? 'landscape' : 'portrait'
        
        //if (mobilecheck() || mobileAndTabletcheck()){
        if (mobileAndTabletcheck()){ //defined in presentation.js
            //in mobile device        
            var w = screen.width
            var h = screen.height
            if (w > h) {orientation = 'landscape'}
        }

        this.width = rect.width
        this.height = rect.height
        
        //remove existing this.concrete_viewport, when "resize" happened
        if (this.concrete_viewport) this.concrete_viewport.destroy()

        this.concrete_viewport = new Concrete.Viewport({
            container: this.overlay_surface,
            width: this.width,
            height:  this.height
        });
        //detach from parent to document.body
        /* CSS settings
        #overlay_canvas{
            position:absolute;
            top:0;
            left:0px;
            z-index:199;
        }
        */

        this.overlay_surface.style.display = 'block'
        this.overlay_surface.style.opacity = '1.0'
        this.overlay_surface.style.top = rect.top+'px'
        this.overlay_surface.style.left = rect.left+'px'
        this.overlay_surface.style.width = this.width+'px'
        this.overlay_surface.style.height = this.height+'px'
       
        this.overlay_surface_rect = this.overlay_surface.getBoundingClientRect()
       
        var canvas_a = this.overlay_surface.querySelector('canvas')
        canvas_a.setAttribute('id','overlay_canvas')
        canvas_a.style.display = 'block'
        canvas_a.style.top = '0px'
        canvas_a.style.left = '0px'
        canvas_a.style.position = 'absolute'
        this.canvas_a = canvas_a;
        this.canvas = canvas_a
        /* 兩個替換的作法過於複雜，想清楚再說。（20181110）
        var canvas_b = canvas_a.cloneNode()
        canvas_b.removeAttribute('id')
        canvas_b.style.top = this.height+'px'
        this.overlay_surface.appendChild(canvas_b)
        this.canvas_b = canvas_b
        */
        
        // get to top-left offset
        //var rect = this.canvas.getBoundingClientRect();
        this.offset = [0,0];// [this.rect.left,this.rect.top];

        /* fixed the body when writing */
        (function () {
            var _overlay = document.getElementById('overlay_canvas');
            var _clientY = null; // remember Y position on touch start
          
            _overlay.addEventListener('touchstart', function (event) {
                if (event.targetTouches.length === 1) {
                    // detect single touch
                    _clientY = event.targetTouches[0].clientY;
                }
            }, false);
          
            _overlay.addEventListener('touchmove', function (event) {
                if (event.targetTouches.length === 1) {
                    // detect single touch
                    disableRubberBand(event);
                }
            }, false);
          
            function disableRubberBand(event) {
                var clientY = event.targetTouches[0].clientY - _clientY;
          
                if (_overlay.scrollTop === 0 && clientY > 0) {
                    // element is at the top of its scroll
                    event.preventDefault();
                }
          
                if (isOverlayTotallyScrolled() && clientY < 0) {
                    //element is at the top of its scroll
                    event.preventDefault();
                }
            }
          
            function isOverlayTotallyScrolled() {
                // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#Problems_and_solutions
                return _overlay.scrollHeight - _overlay.scrollTop <= _overlay.clientHeight;
            }
          }())
        this.scroll_top = 0
        this.scroll_left = 0
        this.new_layer()
    },
    set_pages:function(number_of_pages){

        for (var i=0;i<number_of_pages;i++){

        }
    },
    set_scroll_top:function(top){
        this.scroll_top = top
        this.canvas_a.style.top = - top +'px'
        this.canvas_b.style.top = (- top + this.height) +'px'
    },
    new_layer:function(){       
        this.curr_layer = new Concrete.Layer();
        this.concrete_viewport.add(this.curr_layer)
        this.ctx = this.curr_layer.scene.context;
        this.ctx.globalCompositeOperation='source-over'
        //this.ctx.filter = 'blur(2px)'
    },
   _draw_chunk(chunk,offset){
        //helper of draw_sync and draw_restore
        var w = this.width/chunk[2], h = this.height/chunk[3]
        if (chunk[0]){
            if (this.eraser_mode) this.set_eraser_mode(false)
            this.ctx.strokeStyle = chunk[0]
        }
        else if (!this.eraser_mode){
            this.set_eraser_mode(true)
            this.ctx.strokeStyle = '#000000'
        }
        this.ctx.lineWidth = chunk[1]
        this._set_filter(chunk[1])
        this.ctx.beginPath();
        this.ctx.moveTo(chunk[4]*w-offset[0],chunk[5]*h-offset[1]);
        var len = chunk.length
        for (var j=6;j<len;j+=2){
            this.ctx.lineTo(chunk[j]*w-offset[0],chunk[j+1]*h-offset[1])
        }
        this.ctx.stroke();
        this.ctx.closePath();
    },
    draw_sync:function(chunk){
        //sync drawing from server (trigger by other client)
        // No need to invole scale and offset in computing
        var yes = this.eraser_mode
        var y = this.y
        this._draw_chunk(chunk,[0,0])
        this.concrete_viewport.render()
        
        // restore
        this.set_eraser_mode(yes) //restore eraser mode
        this._set_filter(y) //restore blur filter
    },   
    draw_restore:function(draw_data_chunks){
        //restore drawing becasue of slides-navigation
        var yes = this.eraser_mode
        var y = this.y

        for (var i=0;i<draw_data_chunks.length;i++){
            var chunk = draw_data_chunks[i]
            this._draw_chunk(chunk,this.offset)
        }
        this.concrete_viewport.render()
        
        //storts
        this.set_eraser_mode(yes) //restore eraser mode
        this._set_filter(y) //restore blur filter
    }, 
    pause:function(yes){
        this.paused = yes
        if (yes){
            this.disable_listeners()
        }
        else{
            this.enable_listeners()
        }
    },
    clear:function () {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.concrete_viewport.render()
    },    
    save:function() {
        var dataURL = this.canvas.toDataURL();
    },
    show_canvas:function(yes){
        this.curr_layer.visible = yes
        this.concrete_viewport.render()
    },
    show:function(yes,display_none){
        /*
         * display_none is true, set display to 'none'
         * to make elements below overlay_serface to receive mouse event.
         * for example, video player. But it also prohibits zooming.
         */
        this.visible = yes
        if (yes) {
            // this concerns to zooming feature
            // so we dont use this: this.overlay_surface.style.display = yes ? '' : 'none'
            // but use opacity
            
            //call this to update offset

            this.overlay_surface.style.display = ''       
            this.overlay_surface.style.opacity = 1
            
            this.overlay_surface.style.cursor = 'crosshair'
            this.enable_listeners()
            
            //this.curr_layer.visible = true
            this.concrete_viewport.render()
        }
        else {
            
            if (display_none) this.overlay_surface.style.display = 'none'
            
            //don't "hide" drawing anymore (20180823)
            //this.overlay_surface.style.opacity = 0

            this.overlay_surface.style.cursor = 'inherit'
            this.disable_listeners()

            //don't "hide" drawing anymore (20180823)
            //this.curr_layer.visible = false
            this.concrete_viewport.render()
        }
    },
    set_scale:function(scale){
        //update offset and/or update scale
        if (scale) this.scale = scale
        
        var _rect = this.overlay_surface.getBoundingClientRect()
        //mobile pinch would scroll window
        this.offset = [ 
            _rect.left - this.rect.left + window.scrollX,
            _rect.top - this.rect.top + window.scrollY
        ]
    },
    set_eraser_mode(yes){
        if (yes){
            this.ctx.globalCompositeOperation='destination-out'
            this.eraser_mode = true
            this.overlay_surface.style.cursor = 'pointer'
        }else{
            this.ctx.globalCompositeOperation='source-over'
            this.eraser_mode = false
            this.overlay_surface.style.cursor = (this.visible ? 'crosshair' : 'inherit')
        }
    },
    findxy:function(res, e) {
        
        //somewhat not smooth line
        var rnd = Math.round    
        
        if (res == 'down') {
            this.prevX = this.currX;
            this.prevY = this.currY;
            var currX = this.scroll_left + ((e.pageX - this.rect.left)||  (e.touches[0].pageX - this.rect.left))
            var currY = ((e.pageY - this.rect.top) ||  (e.touches[0].pageY - this.rect.top)) + this.scroll_top
            this.currX = rnd((currX - this.offset[0])/this.scale)
            this.currY = rnd((currY - this.offset[1])/this.scale)
            this.flag = true;
            
            //recreate a new chuck of drawing data
            this._draw_data.length = []
            //empty color means eraser mode
            this._draw_data.push(this.eraser_mode ? '' : this.x) //line color
            this._draw_data.push(this.y)//line size
            this._draw_data.push(this.width)
            this._draw_data.push(this.height)
            this._draw_data.push(this.currX)
            this._draw_data.push(this.currY)

            //starts a new path
            this.ctx.strokeStyle = this.x;//color
            this.ctx.lineWidth = this.y;//size
            this._set_filter(this.y)
            this.ctx.beginPath();
            this.ctx.moveTo(this.currX,this.currY)
            this.dot_flag = true;
            if (this.dot_flag) {
                this.ctx.beginPath();
                this.ctx.fillStyle = this.x;
                this.ctx.fillRect(this.currX, this.currY, 2, 2);
                this.ctx.closePath();
                this.dot_flag = false;
            }
        }
        if (res == 'up' || res == "out") {
            this.flag = false;
            if (this._draw_data.length>8){ // 8 = 4(color,size,width,height)+4(x0,y0,x1,y1) at least 2 points
                this.delegate.on_draw(this._draw_data.slice())
                this._draw_data.length = 0
            }
            
            // end current path
            this.ctx.closePath();

            //this.new_layer()//would slow down
        }
        if (res == 'move') {
            
            if (this.flag) { //mousedown (drawing)
                this.prevX = this.currX;
                this.prevY = this.currY;
                var currX = ((e.pageX - this.rect.left)||  (e.touches[0].pageX - this.rect.left)) + this.scroll_left
                var currY = ((e.pageY - this.rect.top) ||  (e.touches[0].pageY - this.rect.top)) + this.scroll_top
                this.currX = rnd((currX - this.offset[0])/this.scale)
                this.currY = rnd((currY - this.offset[1])/this.scale)
                if (this.prevX==this.currX && this.prevY==this.currY) {
                    return // not moving
                }
                //this.draw();
                this.ctx.lineTo(this.currX, this.currY)
                this.ctx.stroke();
                this.concrete_viewport.render()

                this._draw_data.push(this.currX)
                this._draw_data.push(this.currY)
                // send to bus per 25 points
                var n = this._draw_data.length
                if (n > 50){
                    this.delegate.on_draw(this._draw_data.slice())
                    
                    // keep last point as the 1st point of next chunk
                    var header = [
                        this.eraser_mode ? '' : this.x,
                        this.y,
                        this.width,
                        this.height
                    ]                    
                    this._draw_data = header.concat(this._draw_data.slice(n-2))
                }
            }
        }
    }
    
}

