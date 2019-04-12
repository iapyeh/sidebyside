/*
 * Depends on SVG.js
 * REF: https://svgjs.com/
 */
'use strict';
function color_to_int(c){
    return parseInt(c, 16) 
}
function int_to_color(i){
    //convert interger(65535) to color (FFFFFF) 
    var red = Number(i >> 16 & 0xFF).toString(16)
    if (red.length==1) red = '0'+red
    var green = Number(i >> 8 & 0xFF).toString(16)
    if (green.length==1) green = '0'+green
    var blue = Number(i & 0xFF).toString(16)
    if (blue.length==1) blue = '0'+blue
    return red+green+blue
}
function Overlay(surface_container_ele){
   
    this.overlay_surface = document.createElement('div')
    this.overlay_surface.setAttribute('id','overlay_surface')
    this.overlay_surface.style.userSelect = 'none'
    this.overlay_surface.style.overflow = 'hidden'
    this.overlay_surface.className = 'origin-hide-me' //be hidden in screen "origin" mode
    surface_container_ele.appendChild(this.overlay_surface)
    this.visible = true
    this.paused = false

    this.draw = null //SVG instance

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
    this.image_mode = true

    /*
     * delegate should implement:
     *  on_draw()
     */
    this.delegate = null

}
Overlay.prototype = {
    set_options:function(options){
        if (options.color) {
            this.x = options.color
        }
        if (options.size){
            this.y = options.size
            //this._set_filter(this.y)
        } 
    },
    _set_filter:function(n){
        return //obsoleted
        
        //internally called to set blur 
        //auto set blur effect
        
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
        //注意：chrome有個隱藏的bug，有時按下滑鼠左鍵滑動時，不會有move事件。重開chrome可以解決。
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
            //self.findxy('out', e) //too sensitive
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
        //呼叫成本高，不要常呼叫
        //console.warn('overlay reset size')
        var self = this
        this.rect = rect
        this.width = rect.width
        this.height = rect.height
        this.overlay_surface.style.display = 'block'
        this.overlay_surface.style.opacity = '1.0'
        //放在screen-frame之下以後不需要設定left,top了
        //this.overlay_surface.style.top = rect.top+'px'
        //this.overlay_surface.style.left = rect.left+'px'
        this.overlay_surface.style.width = (this.width  - window.scrollbarWidth) +'px'
        this.overlay_surface.style.height = (this.height  - window.scrollbarWidth) +'px'
        //this.draw物件必須重建，不能只呼叫 this.draw.size()，
        //否則scrooTop會失效，無法跟著捲動。可能是因為某webkit的bug的緣故。
        this.draw = SVG('overlay_surface')
            .size(this.width  - window.scrollbarWidth, this.height  - window.scrollbarWidth)
        this.on_draw_changed(this.draw)//assign to widget_gallery
        this.overlay_surface_rect = this.overlay_surface.getBoundingClientRect()
        // get to top-left offset
        //var rect = this.canvas.getBoundingClientRect();
        this.offset = [0,0];// [this.rect.left,this.rect.top];
        
        // in iPad, fixed the body when writing  // temporary disabled
        (function () {
            var _overlay = self.draw.node
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
          
            function isOverlayTotallyScrolled() {
                // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#Problems_and_solutions
                return _overlay.scrollHeight - _overlay.scrollTop <= _overlay.clientHeight;
            }

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
        }())
        
        this.scroll_top = 0
        this.scroll_left = 0
        
    },
    set_pages:function(number_of_pages){
        for (var i=0;i<number_of_pages;i++){

        }
    },
    set_scroll:function(left,top){
        if (left >= 0){
            this.scroll_left = left
            this.overlay_surface.scrollLeft = left 
            //this.draw.node.scrollLeft = left
        }
        if (top >= 0){
            this.scroll_top = top
            this.overlay_surface.scrollTop = top 
            //this.draw.node.scrollTop = top //this is useless and not necessary
        }
        //console.log('top=',top, this.overlay_surface.scrollTop,this.draw.node.scrollTop)
    },
   _draw_chunk:function(_chunk,offset){
        //helper of draw_sync and draw_restore
        var self = this
        var chunk = _chunk
        var w = this.width/_chunk[3]
        // 文字模式(this.image_mode == false) 時，top的位置依據列高(text_height)而調整
        // 參見 slide.resource.type == 'TEXT'時的使用方式
        var h = this.image_mode ? (this.height/_chunk[4]) : (Math.floor((this.height - window.scrollbarWidth)/35) / Math.floor((_chunk[4] - window.scrollbarWidth)/35))
        var color = '#'+int_to_color(_chunk[0])
        var alpha = _chunk[1]
        var width = _chunk[2]
        var chunk = []
        for (var i=5;i<_chunk.length;i+=2){
            chunk.push(Math.round(_chunk[i] * w ) - offset[0])
            chunk.push(Math.round(_chunk[i+1] * h )- offset[1])
        }
        var polyline = this.create_a_polyline(chunk, width, color)
    },
    draw_sync:function(chunk){
        //sync drawing from server (trigger by other client)
        // No need to invole scale and offset in computing
        var yes = this.eraser_mode
        var y = this.y
        this._draw_chunk(chunk,[0,0])
        
        // restore
        this.set_eraser_mode(yes) //restore eraser mode
        this._set_filter(y) //restore blur filter
    },
    eraser_sync:function(data){
        //data =  color, width, height, length, x0,y0, last_x, last_y (on_draw_erase())
        var w = this.width/data[1], h = this.height/data[2]
        var length = data[3]
        var s_point_x = data[4] * w
        var s_point_y = data[5] * h
        var threshhold = 1.5
        this.draw.children().forEach(function(child){            
            var dx = Math.abs(s_point_x - child.node.points.getItem(0).x)
            var dy = Math.abs(s_point_y - child.node.points.getItem(0).y)
            if (( dx < threshhold) && (dy < threshhold) && (child.node.points.numberOfItems==length)){
                var e_point_x = data[6] * w
                var e_point_y = data[7] * h
                dx = Math.abs(e_point_x - child.node.points.getItem(length-1).x)
                dy = Math.abs(e_point_y - child.node.points.getItem(length-1).y)
                if ((dx < threshhold) && (dy < threshhold)){
                    child.remove()
                }
            }
        })
    },
    draw_restore:function(draw_data_chunks){
        //restore drawing becasue of slides-navigation
        var yes = this.eraser_mode
        var y = this.y
        for (var i=0;i<draw_data_chunks.length;i++){
            var chunk = draw_data_chunks[i]
            this._draw_chunk(chunk,this.offset)
        }
       
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
        this.draw.clear()
        this.draw.size(this.width, this.height)
        this.set_scroll(0,0)
    },
    save:function() {
        var dataURL = this.canvas.toDataURL();
    },
    /*
    show_canvas:function(yes){
        this.curr_layer.visible = yes
        this.concrete_viewport.render()
    },*/
    show:function(yes,display_none){
        /*
         * when yes is false:
         *       display_none (boolean): if true, set display to 'none'
         *          to make elements below overlay_serface to receive mouse event.
         *          for example, video player. But it also prohibits zooming.
         */
        this.visible = yes
        if (yes) {
            // this concerns to zooming feature
            // so we dont use this: this.overlay_surface.style.display = yes ? '' : 'none'
            // but use opacity
            
            //call this to update offset

            this.overlay_surface.style.display = ''       
            this.overlay_surface.style.opacity = 1
            
            //this.overlay_surface.style.cursor = 'crosshair'
            this.enable_listeners()
            
        }
        else {
            
            if (display_none) this.overlay_surface.style.display = 'none'
            
            //this.overlay_surface.style.cursor = 'inherit'
            this.disable_listeners()

        }
    },
    set_scale:function(scale){
        //update offset and/or update scale
        if (scale) this.scale = scale
        
        var _rect = this.overlay_surface.getBoundingClientRect()
        //mobile pinch would scroll window
        //support MISE
        this.offset = [ 
            _rect.left - this.rect.left + (typeof(window.scrollX)=='undefined' ? document.documentElement.scrollLeft : window.scrollX),
            _rect.top - this.rect.top + (typeof(window.scrollY)=='undefined' ? document.documentElement.scrollTop : window.scrollY)
        ]
    },
    set_eraser_mode:function(yes){
        if (yes){
            this.eraser_mode = true
            //this.overlay_surface.style.cursor = 'pointer'
            this.overlay_surface.className += ' eraser_mode'
        }else{
            this.eraser_mode = false
            //this.overlay_surface.style.cursor = (this.visible ? 'crosshair' : 'inherit')
            this.overlay_surface.className = this.overlay_surface.className.replace(/eraser_mode/,'').trim()
        }
    },
    remove_svg_obj:function(obj){
        //obj: svg.js element
        //width, height, number of points, first and last point
        var s_point = obj.node.points.getItem(0)
        var length = obj.node.points.numberOfItems
        var e_point = obj.node.points.getItem(length-1)
        var data = [this.width, this.height, length, s_point.x, s_point.y , e_point.x, e_point.y]
        this.delegate.on_draw_eraser(data)
        obj.remove()
    },
    create_a_polyline:function(points,width, color){
        var self = this
        var polyline = this.draw.polyline(points).fill('none').stroke({width:width,color:color})
        polyline.style('stroke-linecap','round')
        polyline.on('click',function(evt){
            if (self.eraser_mode) self.remove_svg_obj(this)
        })
        polyline.node.addEventListener('mouseover',function(evt){
            if (!self.eraser_mode) return
            //console.log('hover ',evt.currentTarget)
        })
        return polyline
    },
    findxy:function(res, e) {
        //somewhat not smooth line
        var rnd = Math.round    
        var self = this
        var is_touch = e.touches ? true : false
        if (res == 'down') {
            this.prevX = this.currX;
            this.prevY = this.currY;
            var currX = this.scroll_left + (is_touch ? (e.touches[0].pageX - this.rect.left) : (e.pageX - this.rect.left))
            var currY = this.scroll_top + (is_touch ?  (e.touches[0].pageY - this.rect.top) : (e.pageY - this.rect.top))
            
            this.currX = rnd((currX - this.offset[0])/this.scale)
            this.currY = rnd((currY - this.offset[1])/this.scale)
            this.flag = true;
            
            //recreate a new chuck of drawing data
            this._draw_data.length = []
            //empty color means eraser mode
            this._draw_data.push(this.eraser_mode ? -1 : color_to_int(this.x.substring(1))) //line color
            this._draw_data.push(1.0)//alpha
            this._draw_data.push(this.y)//line size
            this._draw_data.push(this.width)
            this._draw_data.push(this.height)
            this._draw_data.push(this.currX)
            this._draw_data.push(this.currY)
            this._polyline_points = [this.currX, this.currY]
            this._polyline = this.create_a_polyline(this._polyline_points, this.y, this.x )
        }
        else if (res == 'up' || res == "out") {
            this.flag = false;            
            if (this._draw_data.length>9){ // 9 = 5(color,alpha,size,width,height)+4(x0,y0,x1,y1) at least 2 points
                this.delegate.on_draw(this._draw_data.slice())
                this._draw_data.length = 0
            }            
        }
        else if (res == 'move') {
            if (this.flag) { //mousedown (drawing)
                this.prevX = this.currX;
                this.prevY = this.currY;
                var currX = (is_touch ?  (e.touches[0].pageX - this.rect.left) : (e.pageX - this.rect.left)) + this.scroll_left
                var currY = (is_touch ?  (e.touches[0].pageY - this.rect.top) : (e.pageY - this.rect.top)) + this.scroll_top
                this.currX = rnd((currX - this.offset[0])/this.scale)
                this.currY = rnd((currY - this.offset[1])/this.scale)
                //console.log(this.prevX,this.currX ,this.prevY,this.currY)
                if (this.prevX==this.currX && this.prevY==this.currY) {
                    return // not moving
                }
                this._draw_data.push(this.currX)
                this._draw_data.push(this.currY)    

                this._polyline_points.push(this.currX)
                this._polyline_points.push(this.currY)
                //update this line
                this._polyline.plot(this._polyline_points)
                
                // send to bus per 25 points
                var n = this._draw_data.length
                if (n > 50){
                    this.delegate.on_draw(this._draw_data.slice())                    
                    // keep last point as the 1st point of next chunk
                    this._draw_data = [
                        this.eraser_mode ? -1 : color_to_int(this.x.substring(1)),
                        1.0,//alpha
                        this.y,
                        this.width,
                        this.height,
                        this.currX,
                        this.currY
                    ]
                    this._polyline_points = [this.currX, this.currY]
                    this._polyline = this.create_a_polyline(this._polyline_points, this.y, this.x )
                }
            }
        }
    }
    
}

