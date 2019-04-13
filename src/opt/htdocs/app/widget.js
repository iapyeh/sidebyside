/*
 Gallery's widgets
Dependence of Widget class

Dependence of WidgetGallery class
 * lodash.js - create object-oriented class
 *  
*/
Array.prototype.indexOfObject = function (obj) {
    return this.findIndex(function (value) {
        if (value === obj) return true
    })
}
Array.prototype.removeObject = function (obj) {
    var self = this
    var idx = this.indexOfObject(obj)
    if (idx >= 0) this.splice(idx, 1)
    return idx
}
function isElement(o) {
    return (
        typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
            o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string"
    );
}
function uuidv4() { // Public Domain/MIT
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxxxxxxxxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function getActuralRect(ele){
    //找出一element真正的尺寸（下找一層）
    var rect = ele.getBoundingClientRect()
    var outer_rect = {
        top:rect.top,
        left:rect.left,
        width:rect.width,
        height:rect.height,
        right:rect.right,
        bottom:rect.bottom
    }
    for (var i=0;i<ele.children.length;i++){
        var r = ele.children[i].getBoundingClientRect()
        if (r.top < outer_rect.top) outer_rect.top = r.top
        if (r.left < outer_rect.left) outer_rect.left = r.left
        if (r.right > outer_rect.right) outer_rect.right = r.right
        if (r.bottom > outer_rect.bottom) outer_rect.bottom = r.bottom
        if (r.width > outer_rect.width) outer_rect.width = r.width
        if (r.height > outer_rect.height) outer_rect.height = r.height
    }
    return outer_rect
}
var Constant = {
    in_styles: [
        {id:'0',text:'Just in'},
        {id:'bt',text:'Bounce from top',name:'bounceInDown'},
        {id:'br',text:'Bounce from right',name:'bounceInRight'},
        {id:'bb',text:'Bounce from bottom',name:'bounceInUp'},
        {id:'bl',text:'Bounce from left',name:'bounceInLeft'},
        {id:'fi',text:'Fade in',name:'fadeIn'},
        {id:'ri',text:'Roll in',name:'rollIn'},
        {id:'roi',text:'Rotate in',name:'rotateIn'},
        {id:'zi',text:'Zoom in',name:'zoomIn'},
    ]
    ,at_styles: [
        {id:'0',text:'Same place'},
        {id:'t',text:'At top'},
        {id:'r',text:'At right'},
        {id:'b',text:'At bottom'},
        {id:'l',text:'At left'}
    ]
    ,out_styles: [
        {id:'0',text:'Just out'},
        {id:'bt',text:'Bounce to top',name:'bounceOutUp'},
        {id:'br',text:'Bounce to right',name:'bounceOutRight'},
        {id:'bb',text:'Bounce to bottom',name:'bounceOutDown'},
        {id:'bl',text:'Bounce to left',name:'bounceOutLeft'},
        {id:'fo',text:'Fade out',name:'fadeOut'},
        {id:'ro',text:'Roll out',name:'rollOut'},
        {id:'roo',text:'Rotate out',name:'rotateOut'},
        {id:'no',text:'Stay in place'},
        {id:'st',text:'Stay, shift to top'},
        {id:'sr',text:'Stay, shift to right'},
        {id:'sb',text:'Stay, shift to bottom'},
        {id:'sl',text:'Stay, shift to left'},
        {id:'zo',text:'Zoom out',name:'zoomOut'},
    ]
}
/* helper to slide */

function SlideWidgetManager(slide) {
    this.slide = slide
    this.widgets = {}
    //make the update_to_server to be throttled
    this.update_to_server = _.throttle(this._update_to_server.bind(this), 3000, { leading: false, trailing: true })
}
SlideWidgetManager.prototype = {
    serialize: function (for_clone) {
        var data = []
        for (var widget_id in this.widgets) {
            data.push(this.widgets[widget_id].serialize(for_clone))
        }
        return data
    }
    , set_state: function (data) { //deserialize
        //初始時期產生的widget(restore而來)
        var self = this
        //data is an array of serialized widget
        data.forEach(function (item) {
            // not been added into DOM yet；
            // 只產生widget物件，不放到DOM
            try{
                var widget = WidgetGallery.all[item.classname].create_sample()
                widget.deserialize(item)
                self.widgets[widget.id] = widget
                Widget.all[widget.id] = widget
                // 通知WidgetGallery 接上event handler
                WidgetGallery.singleton.on_widget_created(widget)
            }
            catch(e){
                console.warn(e)
            }
        })
        // 所有widget都產生之後再建立階層關係之間的連結，確保搜尋時找得到其對應的widget物件
        for (var widget_id in self.widgets) {
            self.widgets[widget_id].find_parent_widget()
        }
    }
    , state_save:function(do_sync){
        //slide為current slide時（widget在DOM上）
        for (var widget_id in this.widgets) {
            this.widgets[widget_id].state_manager.state_save()
        }
        if (do_sync) {
            this.update_to_server()
            var s_idx = this.slide.idx
            var t_id = this.slide.t_id
            WidgetGallery.singleton.presentation.send_to_bus('widget-sync', ['state', t_id, s_idx,1])
        }
    }
    , state_restore:function(do_sync){
        //slide為current slide時（widget在DOM上）
        for (var widget_id in this.widgets) {
            this.widgets[widget_id].state_manager.state_restore()
        }        
        if (do_sync) {
            this.update_to_server()
            var s_idx = this.slide.idx
            var t_id = this.slide.t_id
            WidgetGallery.singleton.presentation.send_to_bus('widget-sync', ['state', t_id, s_idx,-1])
        }
    }
    , add_widget: function (widget, do_sync) {
        // 中途產生的 widget (使用者新增或sync而來）
        // (DOM is not touched)
        Widget.all[widget.id] = widget
        this.widgets[widget.id] = widget
        WidgetGallery.singleton.on_widget_created(widget) //hook up handlers
        widget.find_parent_widget()
        if (do_sync) {
            this.update_to_server()
            var s_idx = this.slide.idx
            var t_id = this.slide.t_id
            var data = widget.serialize()
            WidgetGallery.singleton.presentation.send_to_bus('widget-sync', ['add', t_id, s_idx, data])
        }
    }
    , remove_widget: function (widget_id, do_sync) {
        // 中途刪除的 widget (使用者刪除widget, slide, reset slide,或因sync而刪除）
        // (DOM is not touched)
        delete this.widgets[widget_id]
        delete Widget.all[widget_id]
        if (do_sync) {
            this.update_to_server()
            var s_idx = this.slide.idx
            var t_id = this.slide.t_id
            WidgetGallery.singleton.presentation.send_to_bus('widget-sync', ['remove', t_id, s_idx, widget_id])
        }
    }
    , purge_widgets: function () {
        //called when slide was removed or reset (called by presentation.js)
        // (DOM is touched)
        // presentation 會呼叫sync,此處不需要，此處是被presentation呼叫而執行的
        var widget_ids = []
        for (var widget_id in this.widgets) {
            widget_ids.push(widget_id)
        }
        var self = this
        var remove_from_dom = (this.slide == WidgetGallery.singleton.presentation.current_slide)
        widget_ids.forEach(function (widget_id) {
            if (remove_from_dom) self.widgets[widget_id].ele.remove()
            self.remove_widget(widget_id)
        })
    }
    , get_file_url: function (filename) {
        var p_id = WidgetGallery.singleton.presentation.p_id
        var flag = WidgetGallery.singleton.presentation.flag
        var t_id = this.slide.t_id
        var url = window.sdk.access_path + '@/sidebyside/raw_whiteboard?p=' + p_id + '&f=' + flag + '&t=' + t_id + '&b=' + filename
        return url
    }
    , _update_to_server: function () {
        var s_idx = this.slide.idx
        var t_id = this.slide.t_id
        WidgetGallery.singleton.presentation.send_to_bus('widget-save', [t_id, s_idx, this.serialize()])
        window.message('updated to server')
    }
    , on_hide: function () {
        //this slide is going to be blur
        //在此處將widget ele自DOM移除
        for (var id in this.widgets) {
            var widget = this.widgets[id]
            widget.ele.remove()
        }
    }
    , on_show: function () {
        //this slide becomes current_slide
        //在此處將widget加入DOM
        for (var id in this.widgets) {
            var widget = this.widgets[id]
            if (widget.metadata.slot) {
                var slot_ele = WidgetGallery.singleton.widget_drawer.querySelector('.slot[slot-idx="' + widget.metadata.slot + '"]')
                WidgetGallery.singleton.slot_push(slot_ele, widget)
            }
            else {
                WidgetGallery.singleton.widget_layer.appendChild(widget.ele)
            }
        }
    }
}

/*
 * Helper class to Wiget class
 * - 控制顯態與隱態
 * - 控制widget及其所屬unit的save state與restore state; state 包括：
 *   expandion: type , yes or no,
 *   postion:x,y, degree ; aka move() and rotate()
 *   size: w, h, scale ; aka resize() and zoom()
 *   slot: in slot or not
 *   others: defined by unit's state_save() and state_restore()
 */
function WidgetStateManager(widget) {
    this.widget = widget
    this.cache = {} //主要是保留widget顯態時的scale，degree數值
    this.state_data = {
        expand:{
            yes:true, //if false, in collapsed state
            /*
            { id: -1, text: 'None' }, //none, do not collapse
            { id: 0, text: 'Top Collapsed' },//'collapsed-top'
            { id: 1, text: 'Right Collapsed' },//'collapsed-right',
            { id: 2, text: 'Bottom Collapsed' }, //'collapsed-bottom'
            { id: 3, text: 'Left Collapsed' }, //'collapsed-left'
            { id: 4, text: 'Top-Left Collapsed' }, //'collapsed-top-left'
            { id: 5, text: 'Top-Right Collapsed' }, //'collapsed-top-right'
            { id: 6, text: 'Bottom-Right Collapsed' },//'collapsed-bottom-right'
            { id: 7, text: 'Bottom-Left Collapsed' } //'collapsed-bottom-left'
            */            
            type:4,
        }
        ,slot:{ //animation style of in ant out
            in:'0' 
            ,out:'0'
        }
        ,state: null
    }
}
WidgetStateManager.prototype = {
    serialize: function (for_clone) {
        this.state_data.cache = this.cache
        var data = _.cloneDeep(this.state_data)
        delete this.state_data.cache
        return data
    }
    , deserialize: function (data, is_clone) {
        this.state_data = _.cloneDeep(data)
        this.cache = this.state_data.cache
        delete this.state_data.cache
        if (!(data.expand && data.expand.yes)) { //check data.expand  for backward compatibility
            //widget被還原在隱態，還原widget該有的class
            //要作這個動作有點奇怪，不是很好的實作，以後有機會再改
            this.widget.ele.classList.add('collapsed')
        }
    }
    ,state_save:function(){
        this.state_data.state = {
            x:this.widget.x,
            y:this.widget.y,
            w:this.widget.w,
            h:this.widget.h,
            o0:this.widget.origin[0],
            o1:this.widget.origin[1],
            s:this.widget.scale,
            d:this.widget.degree[2],
            ey:this.state_data.expand.yes ? 1 : 0,
            et:this.state_data.expand.type,
            units:{}
        }
        if (this.widget.ele.classList.contains('inslot')) {
            this.state_data.state.slot = this.widget.ele.parentNode.getAttribute('slot-idx')
        }
        for (var unit_id in this.widget.units){
            var data = this.widget.units[unit_id].state_save()
            if (data) this.state_data.state.units[unit_id] = data
        }
        return this.state_data
    }
    ,state_restore:function(data){
        //注意：restore時不會restore因被upload而改變的圖檔
        for (var unit_id in this.state_data.state.units){
            if (this.widget.units[unit_id])  this.widget.units[unit_id].state_restore(this.state_data.state.units[unit_id])
        }
        // restore "slot" state
        var slot_restore_flag = 0
        var widget_in_slot = typeof(this.widget.metadata.slot) != 'undefined'
        var restore_to_slot = typeof(this.state_data.state.slot) != 'undefined'
        if (widget_in_slot && restore_to_slot && (this.widget.metadata.slot == this.state_data.state.slot)){
            //已經在該在的slot上，不需作任何事
            return
        }
        else if (restore_to_slot && ((!widget_in_slot) || (this.widget.metadata.slot != this.state_data.state.slot))){
            slot_restore_flag = 1
            //不是在原本的slot上的話，則先跳出slot
            if (widget_in_slot) WidgetGallery.singleton.slot_pop(this.widget)
        }
        else if((!restore_to_slot) && widget_in_slot){
            slot_restore_flag = -1
        }
        //resotre size, angle, position, scale
        this.widget.origin[0] = this.state_data.state.o0
        this.widget.origin[1] = this.state_data.state.o1
        this.widget.ele.style.transformOrigin = this.widget.origin[0]+'% '+this.widget.origin[1]+'%'
        this.widget.move(this.state_data.state.x, this.state_data.state.y)
        this.widget.rotate(this.state_data.state.d)
        this.widget.zoom(this.state_data.state.s)
        this.widget.resize(this.state_data.state.w, this.state_data.state.h)
        //restore expand or collapse state
        this.state_data.expand.type = this.state_data.state.et
        if (this.state_data.expand.yes &&  (this.state_data.state.ey==0)){
            this.collapse()
        }
        else if ((!this.state_data.expand.yes) && this.state_data.state.et==1){
            this.expand(false)//no animate
        }
        //restore in-slot or not state
        if (slot_restore_flag == 1){
            var slot_ele = WidgetGallery.singleton.widget_drawer.querySelector('.slot[slot-idx="'+this.state_data.state.slot+'"]')
            WidgetGallery.singleton.slot_push(slot_ele, this.widget)
        }
        else if (slot_restore_flag == -1){
            WidgetGallery.singleton.slot_pop(this.widget)
        }
        this.widget.update_handles()
    }    
    , change_expand_type: function (new_type) {
        if (this.state_data.expand.type == new_type) return
        if (this.state_data.expand.yes) {
            this.state_data.expand.type = new_type
        }
        else {
            // 此時在收縮狀態，先在沒有動畫下展開，以使得要collapse時取得正確的 bbox,
            // 如此被 cue 時才會正確定位
            this.expand(false)
            this.state_data.expand.type = new_type
            if (this.state_data.expand.type != -1) this.collapse()
        }
    }
    , collapse: function () {
        //隱態；從resize改成 rotateX, rotateY 跟 scale的方式，主要原因是
        //可以連同子元件一起變化，若用resize必須所有子元件一起作resize，非常不好
        var self = this
        if (!this.state_data.expand.yes) return
        this.state_data.expand.yes = false
        if (this.widget.selected) this.widget.select(false)
        //目前的動畫效果（只有向下、向右的方向可以，向上與向左的方向不行）
        //而且，有角度還是不行。所以暫時取消（在CSS上）
        var after_transition = function () {
            //self.widget.update_handles()
            self.widget.ele.removeEventListener('transitionend', after_transition)
        }
        this.widget.ele.classList.add('collapsing')
        switch (this.state_data.expand.type) {
            //case 'collapsed-top':
            case 0:
                this.widget.ele.addEventListener('transitionend', after_transition)
                //物件的位置會移動，需保持物件不動
                this.cache.degree = this.widget.degree[0]
                this.widget.degree[0] = 89
                this.widget.update_css_transform()
                //css的translate不受角度影響
                var dy = - self.widget.h * self.widget.origin[1] / 100, dx = 0
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                self.cache.dxy = JSON.stringify(dxy)
                self.widget.move(self.widget.x + dxy[0], self.widget.y + dxy[1])

                break
            //case 'collapsed-bottom':
            case 2:
                //物件的位置會移動，需保持物件不動
                this.cache.degree = this.widget.degree[0]
                this.widget.degree[0] = 86
                this.widget.update_css_transform()
                //css的translate不受角度影響
                var dy = self.widget.h * (100 - self.widget.origin[1]) / 100, dx = 0
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                self.cache.dxy = JSON.stringify(dxy)
                self.widget.move(self.widget.x + dxy[0], self.widget.y + dxy[1])
                break
            //case 'collapsed-left':
            case 3:
                //動畫效果（只有向下、向右的方向可以，向上與向左的方向不行）                
                this.widget.ele.classList.add('collapsing')
                this.widget.ele.addEventListener('transitionend', after_transition)

                this.cache.degree = this.widget.degree[1]
                this.widget.degree[1] = 86
                this.widget.update_css_transform()
                //css的translate不受角度影響
                var dx = - self.widget.w * self.widget.origin[0] / 100, dy = 0
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                self.cache.dxy = JSON.stringify(dxy)
                self.widget.move(self.widget.x + dxy[0], self.widget.y + dxy[1])
                break
            //case 'collapsed-right':
            case 1:
                this.cache.degree = this.widget.degree[1]
                this.widget.degree[1] = 86
                this.widget.update_css_transform()
                //css的translate不受角度影響
                var dx = self.widget.w * (100 - self.widget.origin[0]) / 100, dy = 0
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                self.cache.dxy = JSON.stringify(dxy)
                self.widget.move(self.widget.x + dxy[0], self.widget.y + dxy[1])
                break
            //case 'collapsed-top-left':
            case 4:
                this.widget.ele.classList.add('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)
                var scale = Math.round(100 * Math.max(30 / this.widget.h, 30 / this.widget.w)) / 100
                this.cache.scale = this.widget.scale
                this.widget.zoom(scale)
                var dx = - self.widget.w * (self.widget.origin[0]) / 100,
                    dy = - self.widget.h * (self.widget.origin[1]) / 100
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                this.cache.dxy = JSON.stringify(dxy)
                this.widget.move(this.widget.x + dxy[0], this.widget.y + dxy[1])
                break
            //case 'collapsed-bottom-right':
            case 6:
                this.widget.ele.classList.add('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)
                var scale = Math.round(100 * Math.max(30 / this.widget.h, 30 / this.widget.w)) / 100
                this.cache.scale = this.widget.scale
                this.widget.zoom(scale)
                var dx = self.widget.w * (100 - self.widget.origin[0]) / 100,
                    dy = self.widget.h * (100 - self.widget.origin[1]) / 100
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                this.cache.dxy = JSON.stringify(dxy)
                this.widget.move(this.widget.x + dxy[0], this.widget.y + dxy[1])
                break
            //case 'collapsed-top-right':
            case 5:
                this.widget.ele.classList.add('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)
                var scale = Math.round(100 * Math.max(30 / this.widget.h, 30 / this.widget.w)) / 100
                this.cache.scale = this.widget.scale
                this.widget.zoom(scale)
                var dx = self.widget.w * (100 - self.widget.origin[0]) / 100,
                    dy = - self.widget.h * (self.widget.origin[1]) / 100
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                this.cache.dxy = JSON.stringify(dxy)
                this.widget.move(this.widget.x + dxy[0], this.widget.y + dxy[1])
                break
            //case 'collapsed-bottom-left':
            case 7:
                this.widget.ele.classList.add('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)
                var scale = Math.round(100 * Math.max(30 / this.widget.h, 30 / this.widget.w)) / 100
                this.cache.scale = this.widget.scale
                this.widget.zoom(scale)
                var dx = - self.widget.w * (self.widget.origin[0]) / 100,
                    dy = self.widget.h * (100 - self.widget.origin[1]) / 100
                var dxy = Widget.utils.transform(dx, dy, self.widget.degree[2])
                this.cache.dxy = JSON.stringify(dxy)
                this.widget.move(this.widget.x + dxy[0], this.widget.y + dxy[1])
                break
            default:
                return
        }
        setTimeout(function () {
            // 遮照要在動畫結束後才出現，收縮過程保持道具的原貌
            self.widget.ele.classList.remove('collapsing')
            self.widget.ele.classList.add('collapsed')
            self.widget.fire('collapsed')
        }, 310) //collapsing的動畫時間是0.3s
    }
    , expand: function (animate) {
        //顯態
        // animate:boolean, default to true ;this.change_type() use this to speedup type-changing
        //
        if (this.state_data.expand.yes) return
        if (typeof (animate) == 'undefined') animate = true
        var self = this
        this.state_data.expand.yes = true
        this.bbox = null
        var after_transition = function () {
            //self.widget.update_handles()
            self.widget.ele.removeEventListener('transitionend', after_transition)
        }
        if (animate) self.widget.ele.classList.add('expanding')
        switch (this.state_data.expand.type) {
            //case 'collapsed-top':
            case 0:
                this.widget.ele.addEventListener('transitionend', after_transition)
                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.degree[0] = parseFloat(this.cache.degree)
                this.widget.update_css_transform()
                break
            //case 'collapsed-bottom':
            case 2:
                this.widget.ele.addEventListener('transitionend', after_transition)
                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.degree[0] = parseFloat(this.cache.degree)
                this.widget.update_css_transform()
                break
            //case 'collapsed-left':
            case 1:
                this.widget.ele.addEventListener('transitionend', after_transition)
                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.degree[1] = parseFloat(this.cache.degree)
                this.widget.update_css_transform()
                break
            //case 'collapsed-right':
            case 3:
                this.widget.ele.addEventListener('transitionend', after_transition)
                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.degree[1] = parseFloat(this.cache.degree)
                this.widget.update_css_transform()
                break
            //case 'collapsed-top-left':
            case 4:
                //動畫效果（只有向下、向右的方向可以，向上與向左的方向不行）
                this.widget.ele.classList.remove('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)
                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.zoom(parseFloat(this.cache.scale))
                break
            //case 'collapsed-bottom-right':
            case 6:
                //動畫效果（只有向下、向右的方向可以，向上與向左的方向不行）
                this.widget.ele.classList.remove('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)

                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.zoom(parseFloat(this.cache.scale))
                break
            //case 'collapsed-top-right':
            case 5:
                //動畫效果（只有向下、向右的方向可以，向上與向左的方向不行）
                this.widget.ele.classList.remove('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)

                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.zoom(parseFloat(this.cache.scale))
                break
            //case 'collapsed-bottom-left':
            case 7:
                //動畫效果（只有向下、向右的方向可以，向上與向左的方向不行）
                this.widget.ele.classList.remove('corner')
                this.widget.ele.addEventListener('transitionend', after_transition)
                var dxy = JSON.parse(this.cache.dxy)
                this.widget.move(this.widget.x - dxy[0], this.widget.y - dxy[1])
                this.widget.zoom(parseFloat(this.cache.scale))
                break
            default:
                return
        }
        // 遮照要在動畫開始後就拿開，現出道具的原貌
        self.widget.ele.classList.remove('collapsed')
        if (animate) {
            setTimeout(function () {
                self.widget.ele.classList.remove('expanding')
                self.widget.fire('expanded')
            }, 310) //expanding的動畫時間是0.3s
        }
        else {
            this.widget.fire('expanded')
        }
    }
    , get_bbox: function () {
        //在collapsed時被cue的話也能提供正確的尺寸與中心點位置，以便於cue到正確的位置
        if (this.expanded) return this.widget.get_bbox()
        var current_bbox = this.widget.get_bbox()
        var rect = this.widget.ele.getBoundingClientRect()
        switch (this.type) {
            //case 'collapsed-top':
            //case 'collapsed-left':
            //case 'collapsed-top-left':
            case 0:
            case 3:
            case 4:
                break
            //case 'collapsed-bottom-left':
            //case 'collapsed-bottom':
            case 2:
            case 7:
                current_bbox.y = current_bbox.y - current_bbox.height + rect.height
                break
            //case 'collapsed-top-right':
            //case 'collapsed-right':
            case 1:
            case 5:
                current_bbox.x = current_bbox.x - current_bbox.width + rect.width
                break
            //case 'collapsed-bottom-right':
            case 6:
                current_bbox.x = current_bbox.x - current_bbox.width + rect.width
                current_bbox.y = current_bbox.y - current_bbox.height + rect.height
                break
        }
        current_bbox.cx = current_bbox.x + current_bbox.width / 2
        current_bbox.cy = current_bbox.y + current_bbox.height / 2
        return current_bbox
    }

}
var Widget = function(ele) {
    if (!(isElement(ele))) throw 'Widget need an element to create'
    Widget.counter += 1
    this.id = ele.getAttribute('id')
    if (!this.id) {
        this.id = 'w' + new Date().getTime() + Widget.counter
        ele.setAttribute('id', this.id)
    }

    this.state = null //for restore 
    this.listener = {}
    this.units = {} //a dict for units of this widget to register
    this.ele = ele
    //ensure to have "widget" class, this is important for clone()
    this.ele.classList.add('widget')
    this.ele.style.zIndex = Widget.zindex_start + Widget.counter

    this.box = document.createElement('div')
    this.box.classList.add('widget-box')
    ele.appendChild(this.box)

    this.intractable = interact(ele)
    this.selected = false
    var style = window.getComputedStyle(this.ele)
    this.x = parseInt(style.left)
    this.y = parseInt(style.top)
    this.w = parseInt(this.ele.offsetWidth) || 200
    this.h = parseInt(this.ele.offsetHeight) || 200
    this.degree = [0, 0, 0] //x, y, z rotation
    this.origin = [50, 50] //transform orgin in %
    this.scale = 1 //zooming
    this.metadata = {
        handle: 0,
        css: {}//與預設值不一樣的css
    }
    //this.rect與scale的一致性有關
    this.rect = null //assign later
    this.rel_scale = 1
    //this.css = {} 
    // 設定初始 tranfrom
    this.ele.style.transformOrigin = '50% 50%'
    this.update_css_transform()
    //internal flag to be work-around of not knowing how to cancel event in interact.js
    //this._changing_degree = false //aka rotating
    this._changing_origin = false
    this._changing_size = false
    this.child_widgets = []
    var draggable = ele.classList.contains('draggable')
    var zoomable = ele.classList.contains('zoomable')
    if (draggable || zoomable) this.selectable() // 變動layer用，因此一定要selectable
    if (draggable) this.draggable() //all widget are default to be draggable
    if (zoomable) this.zoomable()
    //顯態及隱態
    this.state_manager = new WidgetStateManager(this) //null 不變化
}
Widget.zindex_start = 100
Widget.counter = 0 //generate widget id and registration name for anonymous
Widget.all = {} //get wiget by id
Widget.selected = [] //current focus items
Widget.listener = {}
Widget.utils = {
    radians: function (deg) {
        return deg % 360 * Math.PI / 180
    }
    , transform: function (x, y, deg) {
        if (deg == 0) return [x, y]
        var _x = x, _y = y, r = Widget.utils.radians(deg)
        x = Math.cos(r) * _x - Math.sin(r) * _y
        y = Math.sin(r) * _x + Math.cos(r) * _y
        return [x, y]
    }
}
Widget.fire = function (name, data) {
    var args = [name]
    for (var i = 1; i < arguments.length; i++) {
        args.push(arguments[i])
    }
    if (Widget.listener['*']) {
        for (var func_name in Widget.listener['*']) {
            try {
                Widget.listener['*'][func_name].apply(Widget, args)
            } catch (e) { console.warn(e) }
        }
    }
    if (Widget.listener[name]) {
        args.shift()//remove name
        for (var func_name in Widget.listener[name]) {
            try {
                Widget.listener[name][func_name].apply(Widget, args)
            } catch (e) { console.warn(e) }
        }
    }
}
Widget.on = function (name, callback) {
    if (!Widget.listener[name]) {
        Widget.listener[name] = {}
    }
    var func_name = callback.name || ('f' + Widget.counter++)
    Widget.listener[name][func_name] = callback
    return func_name
}
Widget.off = function (name, callback) {
    if (typeof (callback) == 'string') {
        delete Widget.listener[name][callback]
        if (Widget.listener[name].length == 0) delete Widget.listener[name]
    }
    else if (typeof (callback) == 'function') {
        var target_func_name;
        for (var func_name in Widget.listener[name]) {
            if (Widget.listener[name][func_name] === callback) {
                target_func_name = func_name
                break
            }
        }
        if (target_func_name) {
            delete Widget.listener[name][target_func_name]
            if (Widget.listener[name].length == 0) delete Widget.listener[name]
        }
    }
    else {
        delete Widget.listener[name]
    }
}
Widget.factory = function (ele) {
    return new Widget(ele)
}
Widget.create_sample = function (box) {
    var div = document.createElement('div')
    div.setAttribute('style', 'width:100px;height:100px;background-color:blue')
    div.className = 'widget resizable'
    div.innerHTML = 'A sample generic widget'
    if (box) box.appendChild(div)
    return Widget.factory(div)
}
Widget.prototype = {
    serialize: function (for_clone) {
        if (this.rect == null) {
            this.rect = {
                w: WidgetGallery.singleton.widget_layer_rect.width,
                h: WidgetGallery.singleton.widget_layer_rect.height
            }
        }
        var data = {
            id: this.id,
            classname: this.constructor.name,
            degree: this.degree,
            origin: this.origin,
            scale: this.scale,
            w: this.w,
            h: this.h,
            x: this.x,
            y: this.y,
            rect: this.rect,
            state_manager: this.state_manager.serialize(for_clone),
            metadata: this.metadata,
            // 不包括state，這是故意的，避免在save, restore當中呼叫serialize時產生循環呼叫
            //state:this.state
        }
        WidgetGallery.singleton.normalize(data)//for w,h,x, y,
        return data
    }    
    , deserialize: function (data, is_clone) {
        //deserialize a widget, maybe:
        // 1. load/reload a presentation
        // 2. change slide or resize the browser frame
        // 3. clone, copy-paste a widget
        // 4. generate a new widget by sync
        if (!data.units) data.units = [] //temporary to be able to load old data

        if (is_clone) {
            //保留現在的臨時性ID（變成永久性）
        }
        else if (data.id) {
            //使用之前的id
            this.id = data.id
            if (this.ele) this.ele.setAttribute('id', data.id)
        }
        this.origin = data.origin
        this.rect = data.rect

        var self = this
        var call_with_context = function () {
            WidgetGallery.singleton.denormalize(data)
            if (data.metadata) {
                self.metadata = data.metadata
                if (data.metadata.handle) {
                    //restore handle
                    if (data.metadata.handle >> 4) {
                        self.set_fixed_handle('v' + (data.metadata.handle >> 4))
                    }
                    if (data.metadata.handle & 3) {
                        self.set_fixed_handle('h' + (data.metadata.handle & 3))
                    }
                }
                if (data.metadata.css) {
                    //restore css (includes layer)
                    for (var name in data.metadata.css) {
                        self.box.style[name] = data.metadata.css[name]
                    }
                }
            }

            self.rel_scale = WidgetGallery.singleton.widget_layer_rect.width / self.rect.w
            self.degree[0] = data.degree[0]//還原因collapse而產生的X角度
            self.degree[1] = data.degree[1]
            self.degree[2] = data.degree[2]
            if (data.scale != 1) self.zoom(data.scale)
            self.rotate(data.degree[2])
            self.resize(data.w, data.h)
            self.move(data.x, data.y)
            self.state_manager.deserialize(data.state_manager, is_clone)
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)

        return this
    }
    , reset: function () {
        this.zoom(1, true)
        this.rotate(0, true)
        this.origin = [50, 50]
        this.resize()
        //pending:reset all css
        this.ele.style.opacity = 1
        for(var id in this.units){this.units[id].reset()}
    }
    , get_actions:function(){
        return []
    }
    , get_dashboard:function(dashboard){
    }
    /*
    , state_save: function () {
        //implement this in subsclass, assign value to this.state
        this.state = _.cloneDeep(this.serialize())
        return this.state
    }
    , state_restore: function () {
        //restore時不會restore因被upload而改變的圖檔
        var slot_restore_flag = 0
        var widget_in_slot = typeof(this.metadata.slot) != 'undefined'
        var restore_to_slot = typeof(this.state.metadata.slot) != 'undefined'
        if (widget_in_slot && restore_to_slot && (this.metadata.slot == this.state.metadata.slot)){
            //已經在該在的slot上，不需作任何事
            return
        }
        else if (restore_to_slot && ((!widget_in_slot) || (this.metadata.slot != this.state.metadata.slot))){
            slot_restore_flag = 1
            //不是在原本的slot上的話，則先跳出slot
            if (widget_in_slot) WidgetGallery.singleton.slot_pop(this)
        }
        else if((!restore_to_slot) && widget_in_slot){
            slot_restore_flag = -1
        }
        this.deserialize(_.cloneDeep(this.state))
        if (slot_restore_flag == 1){
            var slot_ele = WidgetGallery.singleton.widget_drawer.querySelector('.slot[slot-idx="'+this.state.metadata.slot+'"]')
            WidgetGallery.singleton.slot_push(slot_ele, this)
        }
        else if (slot_restore_flag == -1){
            WidgetGallery.singleton.slot_pop(this)
        }
    }
    */
    , sync: function (data, do_normalize) {
        //widget's common sync function
        if (typeof(data.id)=='undefined') data.id = 0 //sent to widget itself on another browser
        if (do_normalize) {
            WidgetGallery.singleton.normalize(data)
        }
        WidgetGallery.singleton.sync(this, data)
    }
    , fire: function (name) {
        var self = this
        var args = [name]
        for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i])
        }
        if (this.listener['*']) {
            for (var func_name in self.listener['*']) {
                try {
                    self.listener['*'][func_name].apply(self, args)
                } catch (e) { console.warn(e) }
            }
        }
        //把this 加在最後面，如果hanlder被bind到別的this時，可以取得此widget
        args.push(this)
        if (this.listener[name]) {
            args.shift()//remove name
            for (var func_name in self.listener[name]) {
                try {
                    self.listener[name][func_name].apply(self, args)
                } catch (e) { console.warn(e) }
            }
        }
    }
    , on: function (name, callback) {
        if (!this.listener[name]) {
            this.listener[name] = {}
        }
        var func_name = callback.name || ('f' + Widget.counter++)
        this.listener[name][func_name] = callback
        return func_name
    }
    , off: function (name, callback) {
        /*
        if (callback) {
            this.listener[name].removeObject(callback)
            if (this.listener[name].length == 0) delete this.listener[name]
        }
        else {
            delete this.listener[name]
        }
        */
        if (typeof (callback) == 'string') {
            delete this.listener[name][callback]
            if (this.listener[name].length == 0) delete this.listener[name]
        }
        else if (typeof (callback) == 'function') {
            var target_func_name;
            for (var func_name in this.listener[name]) {
                if (this.listener[name][func_name] === callback) {
                    target_func_name = func_name
                    break
                }
            }
            if (target_func_name) {
                delete this.listener[name][target_func_name]
                if (this.listener[name].length == 0) delete this.listener[name]
            }
        }
        else {
            delete this.listener[name]
        }
    },
    add_child_widget: function (widget) {
        //只是維護階層關係
        if (this.child_widgets.indexOfObject(widget) == -1) {
            this.child_widgets.push(widget)
        }
    },
    remove_child_widget: function (widget) {
        //只是維護階層關係
        if (this.child_widgets.indexOfObject(widget) >= 0) {
            this.child_widgets.splice(this.child_widgets.indexOfObject(widget), 1)
        }
    },
    find_parent_widget: function () {
        // 維護階層關係
        // 假設widgent物件的建立是由上而下，每一個parent node (class=widget) in DOM都已經有widget物件
        // 這與clone()及layer的調整有關係
        var p = this.ele.parentNode
        while (p && p != document) {
            if (p.classList.contains('widget')) {
                var parent = Widget.all[p.getAttribute('id')]
                parent.add_child_widget(this)
                return parent
            }
            p = p.parentNode
        }
        return null
    },
    get_parent_degree: function () { //z-axis
        if (!this.parent_widget) return 0
        return (this.parent_widget.degree[2] + this.parent_widget.get_parent_degree()) % 360
    },
    get_parent_scale: function () {
        if (!this.parent_widget) return 1
        return (this.parent_widget.scale * this.parent_widget.get_parent_scale())
    },
    get_bbox: function () {
        //回傳this.ele在degree=0時的left,top,width, height的數值
        //此物件在取值時，有可能是有旋轉角度的，
        //但是getBoundingClientRect 取到的資料在物件有轉角度的時候是正四方形的外框
        //不等於物件本身的長與寬,因此需要校正角度以取得正確的長寬.
        //原理：物件的中心點在任何角度下，都在但是BoundingRect的對角線上
        var _rect = this.ele.getBoundingClientRect() //會受scale影養
        var cx = (_rect.left + _rect.right) / 2
        var cy = (_rect.top + _rect.bottom) / 2
        var rect = {
            width: this.ele.offsetWidth,//不受scale影響
            height: this.ele.offsetHeight,
            cx: cx, //物件中心x，不是旋轉中心；相對於螢幕的絕對位置;會受scale影養
            cy: cy,
            x: cx - (_rect.width / 2), //角度0時左上角的位置, 不受scale影響
            y: cy - (_rect.height / 2)
        }
        return rect
    }
    , get_corners: function () {
        //物件四角在螢幕的絕對座標
        var widget = this
        var bbox = widget.get_bbox()
        var abs_scale = (widget.scale * widget.get_parent_scale())
        var ow = (widget.origin[0] - 50) / 100 * bbox.width * abs_scale
        var oh = (widget.origin[1] - 50) / 100 * bbox.height * abs_scale
        var degree = widget.degree[2] + widget.get_parent_degree()
        var dxy = Widget.utils.transform(ow, oh, degree)
        // 旋轉中心的位置(transform)
        var ox = bbox.cx + dxy[0]
        var oy = bbox.cy + dxy[1]
        // 右上角 (相對於物件中心)
        var w = bbox.width / 2 * abs_scale
        var h = bbox.height / 2 * abs_scale
        var dxy = Widget.utils.transform(w, -h, degree)
        var rx = bbox.cx + dxy[0]
        var ry = bbox.cy + dxy[1]
        // 左上角(相對於物件中心)
        dxy = Widget.utils.transform(-w, -h, degree)
        var lx = bbox.cx + dxy[0]
        var ly = bbox.cy + dxy[1]
        // 左下角 (相對於物件中心)
        dxy = Widget.utils.transform(-w, h, degree)
        var lbx = bbox.cx + dxy[0]
        var lby = bbox.cy + dxy[1]
        // 右下角 (相對於物件中心)
        dxy = Widget.utils.transform(w, h, degree)
        var rbx = bbox.cx + dxy[0]
        var rby = bbox.cy + dxy[1]
        return {
            origin: { x: ox, y: oy },
            top_left: { x: lx, y: ly },
            top_right: { x: rx, y: ry },
            bottom_left: { x: lbx, y: lby },
            bottom_right: { x: rbx, y: rby }
        }
    },
    selectable: function () {
        var self = this
        interact(this.ele).on('tap', function (evt) {
            

            /* 2019-03-12T07:29:49+00:00 這一段是之前有利用到doubletap事件而寫的，因為已經沒有doubletap事件，應該不必這樣複雜了
            if (self._tap_timer) {
                //不要動作，以觸發doubletap事件
                clearTimeout(self._tap_timer)
                self._tap_timer = 0
                return
            }
            self._tap_timer = setTimeout(function () {
                //先等一下，確認不是doubletap
                self._tap_timer = 0
                if (self.ele.classList.contains('inslot')) {
                    //restore out of slot
                    WidgetGallery.singleton.slot_pop(self)
                }
                else {
                    var yes = !self.selected
                    self.select(yes);
                }
            }, 0)
            */
            if (self.ele.classList.contains('inslot')) {
                //restore out of slot
                WidgetGallery.singleton.slot_pop(self)
                self.sync({id:0,on:'slot'})
            }
            else {
                var yes = !self.selected
                self.select(yes);
            }            
        })
        return this
    },
    draggable: function () {
        var self = this
        var parent_degree = 0
        var effective_scale = 1
        interact(this.ele).on('hold', function (evt) {
            //  因cue時會自動expand，所以不會跟自動解除cue衝突
            //  另一個選擇是用hold，但hold有時會黏住滑鼠
            //  此外，因為widget在最下面，上面有unit，
            //  本來此事件在提把跟收縮時才會被觸發。後因tap事件有偵測doubletap，才有作用
            //  後來改用hold，因為double tap不靈光，且連續按兩下很累

            //only response to mouse's left-button 
            if (evt.which != 1) return
            if (self.state_manager.state_data.expand.yes) {
                //收起來
                self.state_manager.collapse()
                self.sync({ on: 'collapse' })
            }
            else {
                //展開
                self.state_manager.expand()
                self.sync({ on: 'expand' })
            }
            self.update_handles()
            evt.preventDefault()
            evt.stopPropagation()
        })

        var _update_handles = _.throttle(function () {
            self.update_handles()
            //sync to remove counterpart widget by set id = 0
            self.sync({ id: 0, on: 'move', x: self.x, y: self.y }, true) //true for do normalize
        })
        interact(this.ele).draggable({
            // enable inertial throwing
            inertia: true,
            autoScroll: true,
            onstart: function (evt) {
                self._changing_xy = true //aka moving
                parent_degree = self.get_parent_degree()
                effective_scale = self.get_parent_scale() * parseFloat(WidgetGallery.singleton.widget_layer.dataset.scale)
            },
            onmove: function (evt) {
                var dx = evt.dx, dy = evt.dy
                if (parent_degree) {
                    var dxy = Widget.utils.transform(dx, dy, -parent_degree)
                    dx = dxy[0]
                    dy = dxy[1]
                }
                var x = self.x + Math.round(dx / effective_scale)
                var y = self.y + Math.round(dy / effective_scale)
                self.move(x, y)
                _update_handles()
            },
            onend: function () {
                setTimeout(function () {
                    self._changing_xy = false
                    /* 暫時不需要，改成使用者手動設定
                    var has_added = false
                    self.iterate_siblings(function(widget){
                        if (widget.ele.style.zIndex < self.ele.style.zIndex) {
                            //this one is blow me
                            widget.update_drag_handle_by(self)
                        }
                        else if (has_added){
                            //since has added, just skip
                        }
                        else {
                            //check if I should add a drag-handle
                            has_added = self.update_drag_handle_by(widget)
                            console.log('dragging end has_added=',has_added)
                        }
                    })
                    */
                }, 0)
            }
        })
        return this
    },
    /* 暫時不需要，改成使用者手動設定
    update_drag_handle_by:function(widget){
        //決定是否要加上拖出把手(drag-handler-right等)
        //widget一定要在本物件之上（z-index bigger)
        var self = this
        var rect = self.ele.getBoundingClientRect()
        var area = rect.width * rect.height
        var _rect = widget.ele.getBoundingClientRect()
        var add_to_side = null
        // if I am bigger over 1/4 , dont care it
        var sides= ['top','right','bottom','left']
        if ((area - _rect.width * _rect.height) < area * 0.25) {
            var interset = {
                left:Math.max(rect.left,_rect.left),
                right:Math.min(rect.right,_rect.right),
                top:Math.max(rect.top,_rect.top),
                bottom:Math.min(rect.bottom,_rect.bottom)
            }
            // the area of intersection is less than 75%, don't care it
            if (((interset.right - interset.left) * (interset.bottom - interset.top)) > area * 0.75) {            
                //自動加上拖出來的把手
                var closest_side = ''
                var min_value = Infinity
                sides.forEach(function(side){
                    if (Math.abs(rect[side] - _rect[side]) < min_value){
                        min_value = Math.abs(rect[side] - _rect[side])
                        closest_side = side
                    }
                }) 
                add_to_side = closest_side
            }
        }
        if (add_to_side){
            //如果自己本身有角度，則要根據角度修正把手所在的邊，修正時以45度為分界線
            var shift = Math.ceil((self.degree - 45) / 90)
            var idx = sides.indexOf(add_to_side)
            add_to_side = sides[(4-shift+idx)%4]
            console.log('add_to_side =',add_to_side)
        }
        sides.forEach(function(side){
            if (side == add_to_side) self.ele.classList.add('drag-handle-'+side)
            else self.ele.classList.remove('drag-handle-'+side)
        })
        return add_to_side ? true : false
    }, */
    update_handles: function (options) {
        //if (this.selected && window.WidgetGallery) 
        return window.WidgetGallery.singleton.update_handles(this, options)
    }
    , show_handler: function () {
        //dummy for failover when widget is not rotatable
    }
    /*
    rotatable: function () {
        var self = this
        //使用WidgetGallery的轉動把手
        if (window.WidgetGallery) return this


        console.warn('在開發模式下轉動')
        var rotator = this.ele.querySelector('.rotator')
        if (!rotator) {
            rotator = document.createElement('div') //旋轉把手
            rotator.className = 'rotator'
            this.ele.insertBefore(rotator, this.ele.firstChild)
        }
        var origin_handle = this.ele.querySelector('.origin_handle')
        if (!origin_handle) {
            origin_handle = document.createElement('div') //旋轉中心點的把手
            origin_handle.className = 'origin_handle'
            this.ele.insertBefore(origin_handle, this.ele.firstChild)
        }
        var origin_handle_rect = null
        var rect = null
        self.show_handler = function (yes) {
            rotator.style.opacity = yes ? 1 : 0
            origin_handle.style.opacity = yes ? 1 : 0
        }
        self.update_handles = function () {
            //origin_handler 不會變動，只取一次就好,先讓他出現以取得size
            origin_handle.style.display = 'inline-block'
            if (!origin_handle_rect) origin_handle_rect = origin_handle.getBoundingClientRect()
            var rotator_rect = rotator.getBoundingClientRect()
            origin_handle.style.display = ''

            rect = self.get_bbox()
            rotator.style.left = Math.round((rect.width - rotator_rect.width) / 2) + 'px' //center
            origin_handle.style.left = Math.round((self.origin[0] / 100 * rect.width) - origin_handle_rect.width / 2) + 'px'
            origin_handle.style.top = Math.round((self.origin[1] / 100 * rect.height) - origin_handle_rect.height / 2) + 'px'
        }
        self.update_handles()
        var origin = null //rotation origin starting point        
        var starting_degree = 0
        //var rect_for_rotation = null
        var origin_center = null
        var sDegree
        interact(rotator).draggable({
            // enable inertial throwing
            inertia: true,
            // keep the element within the area of it's parent
            restrict: {
                restriction: "parent",
                endOnly: true,
                elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
            },
            autoScroll: true,
            onstart: function (evt) {
                evt.stopPropagation()
                //self._changing_degree = true
                rect = self.get_bbox()
                origin = { x: evt.pageX, y: evt.pageY }
                //旋轉中心點
                origin_center = [rect.cx, rect.cy]

                if (self.origin[0] != 50 || self.origin[1] != 50) {
                    //旋轉中心點不在物件中央，根據目前物件角度而調整，求得旋轉中心點的確實位置
                    var offset_x = (self.origin[0] - 50) / 100 * rect.width, offset_y = (self.origin[1] - 50) / 100 * rect.height
                    var xy = Widget.utils.transform(offset_x, offset_y, self.degree[2] + self.get_parent_degree())
                    origin_center[0] += (xy[0])
                    origin_center[1] += (xy[1])
                }
                //旋轉把手與旋轉中心的角度
                sDegree = Math.atan2((origin.y - origin_center[1]), (origin.x - origin_center[0]));
                starting_degree = self.degree[2]
            },
            onmove: function (evt) {
                evt.stopPropagation()
                var current = { x: evt.pageX, y: evt.pageY }
                var pDegree = Math.atan2((current.y - origin_center[1]), (current.x - origin_center[0]));
                var degree = starting_degree + (pDegree - sDegree) * 180 / Math.PI;
                self.rotate(degree)
            },
            onend: function (evt) {
                evt.stopPropagation()
                //setTimeout(function(){self._changing_degree = false},1)
            }
        })
        //移動旋轉中心把手
        var base_xy = null
        var changing_origin = null
        var hander_parent_degree = 0
        interact(origin_handle).draggable({
            onstart: function (evt) {
                evt.stopPropagation()
                self._changing_origin = true
                base_xy = [parseInt(evt.target.style.left), parseInt(evt.target.style.top)]
                changing_origin = [self.origin[0], self.origin[1]]
                hander_parent_degree = self.get_parent_degree()
                rect = self.get_bbox()
                return false
            },
            onmove: function (evt) {
                evt.stopPropagation()
                var dx = evt.dx, dy = evt.dy
                if (self.degree[2] + hander_parent_degree) {
                    var dxy = Widget.utils.transform(dx, dy, -(self.degree[2] + hander_parent_degree))
                    dx = dxy[0]
                    dy = dxy[1]
                }
                var x = base_xy[0] + Math.round(dx / self.scale)
                var y = base_xy[1] + Math.round(dy / self.scale)
                base_xy[0] = x
                base_xy[1] = y
                evt.target.style.left = x + 'px'
                evt.target.style.top = y + 'px'
                changing_origin[0] = Math.round((x + origin_handle_rect.width / 2) / rect.width * 100)
                changing_origin[1] = Math.round((y + origin_handle_rect.height / 2) / rect.height * 100)
            },
            onend: function (evt) {
                evt.stopPropagation()
                self.origin[0] = changing_origin[0]
                self.origin[1] = changing_origin[1]
                var _rect1 = self.get_bbox()
                self.ele.style.transformOrigin = self.origin[0] + '% ' + self.origin[1] + '%'
                setTimeout(function () {
                    //變更TransformOrigin圖案會跳一下，所以把位置調整回來
                    //目前這個作法會使得畫面閃一下
                    var _rect2 = self.get_bbox()
                    var dx = _rect2.cx - _rect1.cx // + _parent_rect1.cx
                    var dy = _rect2.cy - _rect1.cy //+ _parent_rect1.cy
                    var parent_degree = self.get_parent_degree()
                    if (parent_degree) {
                        var xy = Widget.utils.transform(dx, dy, -parent_degree)
                        dx = xy[0]
                        dy = xy[1]
                    }
                    self.move(self.x - dx, self.y - dy)
                    self._changing_origin = false
                    self.fire('origin', self.origin)
                })
                return false
            }
        })
        return this
    }
    */
    /*
    , resizable: function () {
        if (window.WidgetGallery) return this

        var self = this
        var resizer = this.ele.querySelector('.resizer')
        if (!resizer) {
            resizer = document.createElement('div')
            resizer.className = 'resizer'
            this.ele.insertBefore(resizer, this.ele.firstChild)
        }
        var do_moving = _.throttle(
            function (w, h) {
                self.resize(w, h)
                self.update_handles()
            }, 100)
        this.intractable.resizable({
            edges: {
                top: false,       // Use pointer coords to check for resize.
                left: false,      // Disable resizing from left edge.
                bottom: false,      // Resize if pointer target matches selector
                right: '.widget.selected .resizer'    // Resize if pointer target is the given Element
            },

            // Width and height can be adjusted independently. When `true`, width and
            // height are adjusted at a 1:1 ratio.
            square: false,

            // Width and height can be adjusted independently. When `true`, width and
            // height maintain the aspect ratio they had when resizing started.
            preserveAspectRatio: self.ele.getAttribute('preserveAspectRatio') ? true : false,
            onstart: function (event) {
                self._rect = self.get_bbox()
                self._changing_size = true
                self.show_handler(false)
            },
            onmove: function (event) {
                var dx = event.dx
                var dy = event.dy
                if (self.degree[2]) {
                    var dxy = Widget.utils.transform(dx, dy, -self.degree[2])
                    dx = dxy[0]
                    dy = dxy[1]
                }
                self._rect.width += Math.round(dx / self.scale)
                self._rect.height += Math.round(dy / self.scale)
                do_moving(self._rect.width, self._rect.height)
            },
            onend: function (event) {
                delete self._rect
                self.show_handler(true)
                setTimeout(function () {
                    self._changing_size = false
                }, 10)
            },
        })
        return this
    },
    */
    , set_origin: function (px, py) {
        var self = this
        this.origin[0] = px // 45 => percent 45%
        this.origin[1] = py
        var _rect1 = this.get_bbox() // 儲存變動前的中心位置
        this.ele.style.transformOrigin = this.origin[0] + '% ' + this.origin[1] + '%'
        setTimeout(function () {
            var _rect2 = self.get_bbox()
            var dx = _rect2.cx - _rect1.cx
            var dy = _rect2.cy - _rect1.cy
            var parent_degree = self.get_parent_degree()
            if (parent_degree) {
                var xy = Widget.utils.transform(dx, dy, -parent_degree)
                dx = xy[0]
                dy = xy[1]
            }
            self.move(self.x - dx, self.y - dy)
            //this._changing_origin = false
        })
        this.fire('origin', this.origin)
    }
    , zoomable: function () {
        // 這個function似乎應該搬到WidgetGallery去，放在這裡有點怪
        var unit_y = 2500 //sensetivity
        var self = this
        var do_sync = _.throttle(function (scale) {
            self.sync({ id: 0, on: 'zoom', scale: scale })
        }, 1000, { leading: false, trailing: true })
        var handler = function (evt) {
            var min_scale = 0.3
            var max_scale = 10
            var scale = Math.floor(1000 * Math.min(max_scale, Math.max(min_scale, self.scale + (evt.wheelDelta / unit_y)))) / 1000;
            //不要讓尺寸小於 10,
            var after_zoom_width = this.w * scale
            var after_zoom_height = this.h * scale
            if (after_zoom_height < 10 || after_zoom_width < 10) {
                scale = Math.round(100 * Math.max(10 / this.w, 10 / this.h)) / 100
            }
            self.zoom(scale)
            do_sync(scale)
            if (self.selected) self.update_handles()
        }
        this.on('selected', function () {
            WidgetGallery.singleton.origin_handle.addEventListener('mousewheel', handler)
        })
        this.on('unselected', function () {
            WidgetGallery.singleton.origin_handle.removeEventListener('mousewheel', handler)
        })
    }
    , set_background: function (url) {
        if (!url) {
            //remove background image
            self.ele.classList.remove('image_background')
            self.ele.style.backgroundImage = 'none'
            return
        }
        //add background image
        var self = this
        var image = new Image()
        image.onload = function () {
            self.ele.classList.add('image_background')
            //self.resize(image.naturalWidth,image.naturalHeight)
            self.ele.style.backgroundImage = 'url("' + url + '")'
        }
        image.onerror = function () {
            window.message('unable to load image')
        }
        image.src = url
        return this
    }
    ,set_background_color: function (color) {
        this.ele.style.backgroundColor = color
    }
    ,iterate_siblings: function (callback) {
        //跟同一層次的widget比較
        //if callback return true, then stop iteration

        //搜索的範圍
        var range = this.parent_widget ? this.parent_widget.child_widgets : WidgetGallery.singleton.presentation.current_slide.widget_manager.widgets

        var self = this
        if (range.some) { //list, in a group
            range.some(function (item, idx) {
                if (item == self) return
                else return callback(item, idx)
            })
        }
        else { //dict (Widget.all)
            for (var key in range) {
                if (key == self.id || range[key].parent_widget) continue
                else if (callback(range[key], key)) break
            }
        }
    }
    , set_fixed_handle: function (value) {
        // 8 bit = 4bit(v) + 4bit(h)
        switch (value) {
            case 'h0':
                this.ele.classList.remove('fixed-handle-left')
                this.ele.classList.remove('fixed-handle-right')
                this.metadata.handle = this.metadata.handle & (3 << 4)
                break
            case 'h1':
                this.ele.classList.add('fixed-handle-left')
                this.ele.classList.remove('fixed-handle-right')
                this.metadata.handle = this.metadata.handle & (3 << 4) | 1
                break
            case 'h2':
                this.ele.classList.remove('fixed-handle-left')
                this.ele.classList.add('fixed-handle-right')
                this.metadata.handle = this.metadata.handle & (3 << 4) | 2
                break
            case 'v0':
                this.ele.classList.remove('fixed-handle-top')
                this.ele.classList.remove('fixed-handle-bottom')
                this.metadata.handle = this.metadata.handle & 3
                break
            case 'v1':
                this.ele.classList.add('fixed-handle-top')
                this.ele.classList.remove('fixed-handle-bottom')
                this.metadata.handle = (1 << 4) | (this.metadata.handle & 3)
                break
            case 'v2':
                this.ele.classList.remove('fixed-handle-top')
                this.ele.classList.add('fixed-handle-bottom')
                this.metadata.handle = (2 << 4) | (this.metadata.handle & 3)
                break
        }
    }
    , layer_up: function () {
        var self = this
        var target = null //element
        var min = Infinity
        this.iterate_siblings(function (widget) {
            if ((!self.parent_widget) && widget.parent_widget) {
                return
            }
            if ((widget.ele.style.zIndex > self.ele.style.zIndex) && (widget.ele.style.zIndex < min)) {
                target = widget
                min = widget.ele.style.zIndex
            }
        })
        if (target === null) return
        target.ele.style.zIndex = this.ele.style.zIndex
        target.metadata.css.zIndex = target.ele.style.zIndex
        this.ele.style.zIndex = min
        this.metadata.css.zIndex = this.ele.style.zIndex
    }
    , layer_down: function () {
        var self = this
        var target = null
        var max = -Infinity
        this.iterate_siblings(function (widget) {
            if ((!self.parent_widget) && widget.parent_widget) {
                return
            }
            if ((widget.ele.style.zIndex < self.ele.style.zIndex) && (widget.ele.style.zIndex > max)) {
                target = widget
                max = widget.ele.style.zIndex
            }
        })
        if (target === null) return
        target.ele.style.zIndex = this.ele.style.zIndex
        target.metadata.css.zIndex = target.ele.style.zIndex
        this.ele.style.zIndex = max
        this.metadata.css.zIndex = this.ele.style.zIndex
    },
    layer_bottom: function () {
        var self = this
        var target = null
        var min = Infinity
        this.iterate_siblings(function (widget) {
            if ((!self.parent_widget) && widget.parent_widget) {
                return
            }
            if ((widget.ele.style.zIndex < self.ele.style.zIndex) && (widget.ele.style.zIndex < min)) {
                target = widget
                min = widget.ele.style.zIndex
            }
        })
        if (target === null) return
        target.ele.style.zIndex = this.ele.style.zIndex
        target.metadata.css.zIndex = target.ele.style.zIndex
        this.ele.style.zIndex = min
        this.metadata.css.zIndex = this.ele.style.zIndex
    },
    layer_top: function () {
        var self = this
        var target = null
        var max = -Infinity
        this.iterate_siblings(function (widget) {
            if ((!self.parent_widget) && widget.parent_widget) {
                return
            }
            if ((widget.ele.style.zIndex > self.ele.style.zIndex) && (widget.ele.style.zIndex > max)) {
                target = widget
                max = widget.ele.style.zIndex
            }
        })
        if (target === null) return
        target.ele.style.zIndex = this.ele.style.zIndex
        target.metadata.css.zIndex = target.ele.style.zIndex
        this.ele.style.zIndex = max
        this.metadata.css.zIndex = this.ele.style.zIndex
    },
    select: function (yes) {
        var self = this
        //console.log('selected==>',this.selected, yes)
        if (this.selected === yes) return //no changes
        this.selected = yes
        if (yes) {
            this.ele.classList.add('selected')
            //window.presentation_screen.screen_frame_ele.classList.remove('selected')
            //unselect others
            Widget.selected.forEach(function (_widget) {
                _widget.select(false)
            })
            Widget.selected.push(this)
            this.fire('selected')
        }
        else {
            this.ele.classList.remove('selected')
            Widget.selected.removeObject(this)
            this.fire('unselected')
        }
    }
    ,css:function(css_name,css_value){
        if (_.isObject(css_name)){
            for(var name in css_name){
                this.box.style[name] = css_name[name]
            }
            _.assign(this.metadata.css, css_name)
        }
        else{
            this.metadata.css[css_name] = css_value
            this.box.style[css_name] = css_value
        }
    }
    , attention:function(name){
        //讓此widget得到注意。不作用在widget.ele上，因為css animation使用transform與widget.ele的位置衝突。
        var attention_ele = this.box
        var handler = function(){
            attention_ele.removeEventListener('animationend',handler)
            attention_ele.classList.remove('animated',name)
        }
        attention_ele.addEventListener('animationend',handler)
        attention_ele.classList.add('animated',name)
    }
    ,resize: function (w, h, delta) {
        if (typeof (w) == 'undefined') {
            w = this.w
            h = this.h
        }
        else {
            this.w = w
            this.h = h
        }
        this.ele.style.width = this.w + 'px'
        this.ele.style.height = this.h + 'px'
        this.ele.dataset.width = this.w
        this.ele.dataset.height = this.h
        this.fire('resize', { width: this.w, height: this.h, delta: delta })
    },
    move: function (x, y) {
        // update the posiion attributes
        this.x = x
        this.y = y
        this.update_css_transform()
        this.fire('move', { x: x, y: y })
    },
    zoom: function (scale, deep) {
        var self = this
        /* why? scale 本來就會影響到child，此參數似乎是不必要的
        if (deep){
            this.child_widgets.forEach(function(child){
                child.zoom(scale,true)
            })    
        }
        */
        if (this.scale == scale) return //same scale, do nothing
        this.scale = scale
        this.update_css_transform()
        this.fire('zoom', scale)
    },
    rotate: function (degree, deep) { //z-axis
        degree = Math.round(degree % 360 * 100)/100
        if (deep) {
            this.child_widgets.forEach(function (child) {
                child.rotate(degree, true)
            })
        }
        if (this.degree[2] == degree[2]) return
        this.degree[2] = degree
        this.update_css_transform()
    },
    remove: function () {
        //只會從DOM中刪除，不會從資料結構中刪除
        //注意：widget.remove(), unit.destroy() 這兩種命名不一致，暫時先這樣
        if (this.selected) this.select(false)
        //刪除每一個child widget
        var child_widgets = this.child_widgets.slice()
        child_widgets.forEach(function (child) {
            child.remove()
        })
        delete this.child_widgets

        //卸除與parent widget的關係
        if (this.parent_widget) this.parent_widget.remove_child_widget(this)

        //刪除每一個unit,此會引發unit的destoryed事件而讓unit釋放其資源(ex WebcamUnit釋放player)
        //此一作法也讓每個unit只要listen 自己的destroyed 事件不需要listen widget的removed事件
        //而且一個unit若有子unit,也不需要呼叫子unit的destroy
        for (var unit_id in this.units) {
            this.units[unit_id].destroy()
        }

        // 從 DOM 中卸除
        this.ele.remove() //parentNode.removeChild(this.ele)
        this.fire('removed', this)
    },
    //clone and deserialize related routines
    clone: function (parent_ele, factory) {
        // 注意：element的dataset不會被複製
        if (!parent_ele) parent_ele = this.ele.parentNode
        this.select(false)
        // 如果是subclass of Widget應該要傳factory進來
        var data = this.serialize()
        delete data.id //不要使用既有的widget id
        //不做deep clone,因為child widget要負責自己clone自己的element
        var ele = this.ele.cloneNode()
        ele.removeAttribute('id')
        parent_ele.appendChild(ele)
        //複製非widget的element(假設child widget應該都放在後面的child node)
        for (var i = 0; i < this.ele.childNodes.length; i++) {
            var node = this.ele.childNodes[i]
            if (node.nodeType == 1 && node.classList.contains('widget')) continue
            ele.appendChild(node.cloneNode(true))
        }
        var is_clone = true
        var widget = factory ? factory(ele).deserialize(data, is_clone) : new Widget(ele).deserialize(data, is_clone)
        this.child_widgets.forEach(function (child_widget) {
            child_widget.clone(ele)
        })
        widget.move(this.x + 20, this.y + 20)
        return widget
    }
    , update_css_transform: function () {
        //rotate X,Y,Z的順序是有關係的，Z要在前，collapse一個有角度的widget才會有預期的行為
        this.ele.style.webkitTransform =
            this.ele.style.transform = 'translate(' + this.x + 'px, ' + this.y + 'px) rotateZ(' + this.degree[2] + 'deg) rotateX(' + this.degree[0] + 'deg) rotateY(' + this.degree[1] + 'deg) scale(' + this.scale + ')';
    }
    /*
    , on_slide_show:function(){
        //當此widget所屬的slide被render時會被呼叫，以讓此widget找到其parent widget
    }
    */
    /* dummy dnd and paste delegate */
    , on_dnd: function (data, evt) {
        //basically, redirect dnd to paste
        this.on_paste(data,evt)
    }
    , on_dnd_string: function (data, evt) {
        //basically, redirect dnd to paste
        this.on_paste_string(data,evt)
    }
    , on_paste: function (data, evt) {
        window.message(this.constructor.metadata.caption + ' does not accept pasting file')
    }
    , on_paste_string: function (data, evt) {
        window.message(this.constructor.metadata.caption + ' does not accept pasting text')
    }
    , on_sync: function (data) {
        var self = this
        switch (data.on) {
            case 'resize':
                this.resize(data.w, data.h)
                return true
            case 'move':
                this.move(data.x, data.y)
                this.update_handles()
                return true
            case 'rotate':
                this.rotate(data.degree)
                return true
            case 'zoom':
                this.zoom(data.scale)
                return true
            case 'origin':
                this.set_origin(data.origin[0], data.origin[1])
                this.update_handles()
                return true
            case 'collapse':
                this.state_manager.collapse()
                this.update_handles()
                return true
            case 'expand':
                this.state_manager.expand()
                this.update_handles()
                return true
            case 'collapse-type':
                this.state_manager.change_expand_type(data.type)
                return true
            case 'css':
                for (var name in data.css) {
                    this.metadata.css[name] = data.css[name]
                    this.box.style[name] = data.css[name]
                }
                return true
            case 'layer':
                [this.layer_top, this.layer_up, this.layer_down, this.layer_bottom][data.layer].call(this)
                return true
            case 'handle':
                /*
                data.add.forEach(function(cssclass){
                    self.ele.classList.add('fixed-handle-'+cssclass)  
                })
                data.remove.forEach(function(cssclass){
                    self.ele.classList.remove('fixed-handle-'+cssclass)  
                })
                */
                this.set_fixed_handle(data.value)
                return true
            case 'reset':
                this.reset()
                return true
            case 'slot':
                if (typeof (data.slot) == 'undefined') {
                    WidgetGallery.singleton.slot_pop(this)
                }
                else {
                    var slot_ele = WidgetGallery.singleton.widget_drawer.querySelector('.slot[slot-idx="' + data.slot + '"]')
                    WidgetGallery.singleton.slot_push(slot_ele, this)
                }
                return true
            case 'state': 
                if (data.do == 'save'){
                    this.state_manager.state_save()
                }
                else if (data.do == 'restore'){
                    this.state_restore()
                }
                else if (data.do == 'set'){
                    if (data.slot) _.assign(this.state_manager.state_data.slot, data.slot)
                }
                return true
            case 'attention':
                this.attention(data.name)
                return true
        }
        return false
    }
}
Widget.metadata = {
    actions: [
        {
            id: 'rotate'
            , type: 'button'
            , text: ''
            , tooltip: 'rotate widget'
            , icon: 'fa fa-redo'
            , onClick: function (widget, toolbar) {
                //toggle
                var yes = WidgetGallery.singleton.rotator.style.display == 'none' ? true : false
                WidgetGallery.singleton.update_handles(widget, { rotate: yes })
            }
        }
        , {
            id: 'resize'
            , type: 'button'
            , text: ''
            , tooltip: 'resize widget'
            , icon: 'fa fa-expand'
            , onClick: function (widget, toolbar) {
                //toggle
                var yes = WidgetGallery.singleton.resizer.style.display == 'none' ? true : false
                WidgetGallery.singleton.update_handles(widget, { resize: yes })
            }
        }
        /*
        ,{
            id:'widget-cue',
            type: 'button',
            text:'Cue',            
            icon:'fa fa-plus-circle',
            tooltip:'Cue this widget',
            onClick:function(widget,toolbar){
                var yes = !widget.state_manager.cuing
                widget.state_manager.cue(yes)
                
            }
        } */
        /*
        , {
            id: 'widget-state',
            type: 'menu',
            text: 'State',
            icon: 'fa fa-save',
            tooltip: 'save current state',
            items: [
                { id: 'save', text: 'Save State', icon: 'fa fa-save' },
                { id: 'restore', text: 'Restore State', icon: 'fa fa-undo' },
            ],
            onClick: function (widget, toolbar, evt) {
                if (evt.target == 'widget-state:save') {
                    widget.save_state()
                }
                else if (evt.target == 'widget-state:restore') {
                    widget.restore_state()
                }
            }
        },
        {
            id: 'widget-dummy',
            type: 'button',
            text: '',
            icon: 'fa fa-arrows-alt',
            onClick: function (widget, toolbar) {
            }
        },
        */
    ],    
    dashboard: [
        {
            id: 'widget-state',
            text: 'Widget',
            items: [
                [
                    {
                        type:'button-row',
                        label:'Attention',
                        buttons:[
                            {
                                icon:'fa fa-shake',
                                button_label:'Bounce',
                                onClick:function(widget,button_ele){
                                    widget.attention('bounce')
                                    widget.sync({on:'attention',name:'bounce'})
                                }
                            },{
                                icon:'fa fa-shake',
                                button_label:'Flash',
                                onClick:function(widget,button_ele){
                                    widget.attention('flash')
                                    widget.sync({on:'attention',name:'flash'})
                                }
                            },{
                                icon:'fa fa-shake',
                                button_label:'HeartBeat',
                                onClick:function(widget,button_ele){
                                    widget.attention('heartBeat')
                                    widget.sync({on:'attention',name:'heartBeat'})
                                }
                            },{
                                icon:'fa fa-shake',
                                button_label:'Shake',
                                onClick:function(widget,button_ele){
                                    widget.attention('shake')
                                    widget.sync({on:'attention',name:'shake'})
                                }
                            }
                        ]
                    }
                ]
                ,[ //row 
                    {
                        type:'button-row',
                        label:'Collapse',
                        buttons:[
                            {
                                button_label: '',
                                icon: 'fa fa-compress-arrows-alt',
                                tooltip:'Collapse',
                                onClick: function (widget) {
                                    widget.state_manager.collapse()
                                    widget.sync({ on: 'collapse' })
                                },
                            }
                            , {
                                button_label: '',
                                icon: 'fa fa-expand-arrows-alt',
                                tooltip:'Expand',
                                onClick: function (widget) {
                                    widget.state_manager.expand()
                                    widget.sync({ on: 'expand' })
                                },
                            }
                        ]
                    }
                    , {
                        type: 'list',
                        label: 'Toggle Type',
                        options: {
                            items: [
                                { id: -1, text: 'None' }, //none
                                { id: 0, text: 'Top Collapsed' },//'collapsed-top'
                                { id: 1, text: 'Right Collapsed' },//'collapsed-right',
                                { id: 2, text: 'Bottom Collapsed' }, //'collapsed-bottom'
                                { id: 3, text: 'Left Collapsed' }, //'collapsed-left'
                                { id: 4, text: 'Top-Left Collapsed' }, //'collapsed-top-left'
                                { id: 5, text: 'Top-Right Collapsed' }, //'collapsed-top-right'
                                { id: 6, text: 'Bottom-Right Collapsed'}, //'collapsed-bottom-right'
                                { id: 7, text: 'Bottom-Left Collapsed' }//'collapsed-bottom-left'
                            ]
                        },
                        get: function (widget) {
                            return widget.state_manager.state_data.expand.type
                        },
                        set: function (widget, input_ele) {
                            var value = input_ele.value
                            widget.state_manager.change_expand_type(value.id)
                            widget.sync({ on: 'collapse-type', type: value.id })
                        }
                    }
                ],[
                    {
                        type: 'list',
                        label: 'Go stage',
                        style:'width:100%',
                        legend: 'style of getting out of drawer',
                        options:{
                            items:Constant.in_styles
                        },
                        get:function(widget){
                            //slot."out" 對slot是退場，對畫面是進場
                            return widget.state_manager.state_data.slot.out
                        },
                        set:function(widget,item){
                            widget.state_manager.state_data.slot.out = item.value.id
                            widget.sync({on:'state',do:'set',slot:{out:item.value.id}})
                        }
                    }
                    ,{
                        type: 'list',
                        label: 'Go Drawer',
                        style:'width:100%',
                        legend: 'style of backing to drawer',
                        options:{
                            items:Constant.out_styles
                        },
                        get:function(widget){
                            //slot."in" 對slot是進場，對畫面是離場
                            return widget.state_manager.state_data.slot.in
                        },
                        set:function(widget,item){
                            widget.state_manager.state_data.slot.in = item.value.id
                            widget.sync({on:'state',do:'set',slot:{in:item.value.id}})
                        }
                    }
                ],[ //row 
                    {
                        type: 'color',
                        label: 'Background',
                        get: function (widget) {
                            var color = widget.box.style.backgroundColor
                            if (color == 'transparent') {
                                return ''
                            }
                            else if (/rgb\(/.test(color)) {
                                var rgb = []
                                color.match(/\d+/g).forEach(function (v) {
                                    rgb.push((v < 16 ? '0' : '') + Number(v).toString(16))
                                })
                                return rgb.join('')
                            }
                            else if (/^#/.test(color)) {
                                return color.replace(/^#/, '')
                            }
                            //還有一種是名稱定義的，尚未處理
                            return color || 'ffffff'
                        },
                        set: function (widget, input_ele) {
                            var value = input_ele.value
                            widget.box.style.backgroundColor = value ? '#' + value : 'transparent'
                            widget.metadata.css.backgroundColor = widget.box.style.backgroundColor
                            widget.sync({ id: 0, on: 'css', css: { backgroundColor: widget.box.style.backgroundColor } })
                        }
                    },
                    {
                        type: 'range',
                        min: -20,
                        max: 20,
                        step: 0.05,
                        label: 'Shadow',
                        get: function (widget) {
                            var boxShadow = window.getComputedStyle(widget.box).boxShadow
                            return (boxShadow && boxShadow != 'none') ? parseFloat(boxShadow.match(/(\-?\d+)px/)[1]) : 0
                        },
                        set: function (widget, input_ele) {
                            var value = parseFloat(input_ele.value)
                            if (value) {
                                var color = widget.box.style.backgroundColor || '#000000'
                                widget.box.style.boxShadow = color + ' ' + value + 'px ' + value + 'px ' + Math.abs(Math.round(100 * value * 2) / 100) + 'px'
                            }
                            else {
                                widget.box.style.boxShadow = 'none'
                            }
                            widget.metadata.css.boxShadow = widget.box.style.boxShadow
                            widget.sync({ id: 0, on: 'css', css: { boxShadow: widget.box.style.boxShadow } })
                        }
                    },
                    {
                        type: 'range',
                        min: 0.1,
                        max: 1,
                        step: 0.05,
                        label: 'Opacity',
                        get: function (widget) {
                            return typeof (widget.metadata.css.opacity) == 'undefined' ? 1 : widget.metadata.css.opacity
                        },
                        set: function (widget, input_ele) {
                            var value = input_ele.value
                            widget.box.style.opacity = value
                            widget.metadata.css.opacity = value
                            widget.sync({ id: 0, on: 'css', css: { opacity: value } })
                        }
                    },
                    {
                        type: 'range',
                        min: 0,
                        max: 10,
                        step: 0.1,
                        label: 'Border',
                        get: function (widget) {
                            var v = window.getComputedStyle(widget.box).outlineWidth
                            return parseFloat(v)
                        },
                        set: function (widget, input_ele) {
                            var value = input_ele.value
                            widget.box.style.outlineWidth = value + 'px'
                            widget.box.style.outlineColor = widget.box.style.backgroundColor
                            if (value) {
                                widget.box.style.outlineStyle = 'solid'
                            }
                            else {
                                widget.box.style.outlineStyle = 'none'
                            }
                            var css = {
                                outlineStyle: widget.box.style.outlineStyle
                                , outlineWidth: widget.box.style.outlineWidth
                                , outlineColor: widget.box.style.outlineColor
                            }
                            for (var name in css) {
                                widget.metadata.css[name] = css[name]
                            }
                            widget.sync({ id: 0, on: 'css', css: css })
                        }
                    },
                    {
                        type: 'range',
                        min: 0,
                        max: 50,
                        step: 0.5,
                        label: 'Border Radius',
                        get: function (widget) {
                            var v = widget.box.style.borderRadius
                            return (v ? (v == 'none' ? 0 : parseFloat(v)) : 0)
                        },
                        set: function (widget, input_ele) {
                            var value = parseFloat(input_ele.value)
                            widget.box.style.borderRadius = value ? value + '%' : 'none'
                            widget.metadata.css.borderRadius = widget.box.style.borderRadius
                            widget.sync({ id: 0, on: 'css', css: { borderRadius: widget.box.style.borderRadius } })
                        }
                    }
                ]
                , [ //row 3
                    {
                        type: 'radio',
                        tooltip: 'add a fixed handle on left or right',
                        icon: 'fa fa-angle-double-up',
                        label: 'H-Handle', //not button text
                        options: {
                            items: [
                                { id: 0, text: 'None' },
                                { id: 1, text: 'Left' },
                                { id: 2, text: 'Right' }
                            ]
                        },
                        get: function (widget, value) {
                            return widget.ele.classList.contains('fixed-handle-left') ? 1 : (widget.ele.classList.contains('fixed-handle-right') ? 2 : 0)
                        },
                        set: function (widget, input_ele, item) {
                            widget.set_fixed_handle('h' + input_ele.value)
                            widget.sync({ id: 0, on: 'handle', value: 'h' + input_ele.value })
                        }
                    }
                    , {
                        type: 'radio',
                        tooltip: 'add a fixed handle on top or bottom',
                        icon: 'fa fa-angle-double-up',
                        label: 'V-Handle', //not button text
                        options: {
                            items: [
                                { id: 0, text: 'None' },
                                { id: 1, text: 'Top' },
                                { id: 2, text: 'Bottom' }
                            ]
                        },
                        get: function (widget, value) {
                            return widget.ele.classList.contains('fixed-handle-top') ? 1 : (widget.ele.classList.contains('fixed-handle-bottom') ? 2 : 0)
                        },
                        set: function (widget, input_ele, item) {
                            widget.set_fixed_handle('v' + input_ele.value)
                            widget.sync({ id: 0, on: 'handle', value: 'v' + input_ele.value })
                        }
                    }
                ]
                , [{ //row 4
                    type: 'button-row',
                    label: 'Layer',
                    legend: 'adjust layer of the widget',
                    buttons: [
                        {
                            icon: 'fa fa-angle-up',
                            button_label: 'Up',
                            tooltip: 'up a layer',
                            onClick: function (widget, value) {
                                widget.layer_up()
                                widget.sync({ id: 0, on: 'layer', layer: 1 })
                            }
                        }
                        , {
                            tooltip: 'top layer',
                            icon: 'fa fa-angle-double-up',
                            button_label: 'Top',
                            onClick: function (widget, value) {
                                widget.layer_top()
                                widget.sync({ id: 0, on: 'layer', layer: 0 })
                            }
                        }
                        , {
                            type: 'button',
                            tooltip: 'down a layer',
                            icon: 'fa fa-angle-down',
                            button_label: 'Down',
                            onClick: function (widget, value) {
                                widget.layer_down()
                                widget.sync({ id: 0, on: 'layer', layer: 2 })
                            }
                        }
                        , {
                            type: 'button',
                            tooltip: 'bottom layer',
                            icon: 'fa fa-angle-double-down',
                            button_label: 'Bottom',
                            onClick: function (widget, value) {
                                widget.layer_bottom()
                                widget.sync({ id: 0, on: 'layer', layer: 3 })
                            }
                        }
                    ]//end of .buttons
                    }
                ]//end of row 4
                , [
                    {
                        type:'button-row',
                        label:'State',
                        legend: 'save state for restore',
                        buttons:[
                                {
                                    type: 'button',
                                    tooltip: 'save current state',
                                    icon: 'fa fa-save',
                                    button_label: 'Save',
                                    onClick: function (widget, button_ele) {
                                        widget.state_manager.state_save()
                                        window.message('state saved')
                                        widget.sync({id:0,on:'state',do:'save'})
                                    }
                                }
                                , {
                                    type: 'button',
                                    tooltip: 'restore state',
                                    icon: 'fa fa-share',
                                    button_label: 'Restore',
                                    onClick: function (widget, button_ele) {
                                        widget.state_manager.state_restore()
                                        window.message('state restored')
                                        widget.sync({id:0,on:'state',do:'restore'})
                                    }
                                }
                            ]//end of buttons
                    }//end of button-row
                ]
                , [{
                        type: 'button',
                        tooltip: 'restore scale to 1, angle to 0',
                        icon: 'fa fa-undo',
                        button_label: '',
                        label: 'Reset', //not button text
                        legend:'restore scale to 1, angle to 0',
                        onClick: function (widget, value) {
                            widget.reset()
                            widget.update_handles()
                            widget.sync({ id: 0, on: 'reset' })
                        }
                    }
                ]
            ]//end of tab's items
        }//end of Widget tab
        ,{
            id: 'slide-tab',
            text: 'Slide',
            items: [
                [ //row
                    {
                        type:'button-row',
                        label:'Slide State',
                        legend: 'save all widgets state and restore later',
                        buttons:[
                            {
                                type: 'button',
                                tooltip: 'save state of all widgets',
                                icon: 'fa fa-save',
                                button_label: 'Save',
                                onClick: function (widget, button_ele) {
                                    WidgetGallery.singleton.presentation.current_slide.widget_manager.state_save(true)
                                    window.message('all state saved')
                                    widget.sync({id:0,on:'state',do:'save'})
                                }
                            }
                            , {
                                type: 'button',
                                tooltip: 'restore state of all widgets',
                                icon: 'fa fa-share',
                                button_label: 'Restore',
                                onClick: function (widget, button_ele) {
                                    WidgetGallery.singleton.presentation.current_slide.widget_manager.state_restore(true)
                                    window.message('all state restored')
                                    widget.sync({id:0,on:'state',do:'restore'})
                                }
                            }
                        ]//end of buttons
                    }//end of button-row                    
                ]//end of row
            ]//end of tab's items
        }//end of Slide tab's
    ]
}
/*
 雖然不是好的方式，但為了簡化架構 WidgetGallery 混合很多的功能。
 WidgetGallery 的功能是擔任whiteboard系統與widget子系統之間的橋樑。
 1 管理widget-class的註冊與產生物件
 2.管理使用者所擁有的widget
 3.當作UI產生器(based on w2ui)
 */
var WidgetGallery = function(){
    var self = this
    this.context_ready = false
    this.listener = {}
    this._destroyed_uuid = []
    WidgetGallery.singleton = this
    this._destroyed_uuid_refresh = _.throttle(this.flush_destroyed_uuid.bind(this), 1000, { leading: false, trailing: true })
}
//取得WidgetGallery的方式
WidgetGallery.singleton = null
WidgetGallery.prototype = {
    _send_command: function (name, args, file) {
        var promise = new $.Deferred()
        if (typeof (name) == 'object') {
            var command = name
        } else {
            var command = new Command((file ? ObjshSDK.metadata.resource_route_name : ObjshSDK.metadata.runner_name) + '.root.sidebyside.' + name, args, file)
        }
        window.sdk.send_command(command)
            .progress(function (ret) {
                promise.notify(ret)
            })
            .done(function (response) {
                if (response.retcode != 0) {
                    return promise.reject(response.retcode, response.stderr.message, response.stderr)
                }
                promise.resolve(response.stdout)
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                promise.reject(jqXHR.status, jqXHR.statusText)
            })
        return promise
    }
    /* 以下是製造widget的相關功能*/
    , on_widget_created: function (widget, do_sync) {
        //一個widget產生之後，所進行的與WidgetGallery連結的程序
        widget.on('selected', this._widget_selected_handler.bind(this))
        widget.on('unselected', this._widget_unselected_handler.bind(this))
    }
    , _widget_selected_handler: function (widget) {
        var self = this
        this.update_handles(widget)
        //使用者設定要顯示才顯示（在whiteboard.js中）
        if (this.dashboard_box.classList.contains('active')) {
            setTimeout(function () {
                //稍候再render，因為selected可能被取消（例如被cue的時候）
                if (widget.selected) {
                    //trigger the dashboard to be updated
                    self.render_dashboard(widget)
                }
            }, 500)
        }
        window.presentation_screen.screen_frame_ele.classList.remove('selected')
        //trigger presentation to be updated
        this.fire('selected', widget)
    },
    _widget_unselected_handler: function (widget) {
        this.rotator.style.display = 'none'
        this.origin_handle.style.display = 'none'
        this.resizer.style.display = 'none'
        this.attention_shape.style.display = 'none'
        this.fire('unselected', widget)
    }
    , sync: function (widget, data) {
        var t_id = this.presentation.current_thread.id
        var s_idx = this.presentation.current_slide.idx
        this.presentation.send_to_bus('widget-sync', ['sync', t_id, s_idx, { id: widget.id, data: data }])
        //update to server in next loop
        var self = this
        //只要有sync,就一定有update_to_server
        _.defer(function () {
            self.presentation.current_slide.widget_manager.update_to_server()
        })
    }
    , normalize: function (data) {
        //轉成相對尺寸用於同步
        var rect = this.widget_layer_rect
        if (typeof (data.x) != 'undefined') {
            data.x = Math.round(1000 * data.x / rect.width) / 10
            data.y = Math.round(1000 * data.y / rect.height) / 10
        }
        if (typeof (data.w) != 'undefined') {
            data.w = Math.round(1000 * data.w / rect.width) / 10
            data.h = Math.round(1000 * data.h / rect.height) / 10
        }
        // add _n to hint been normalized
        data._n = 1
        return data
    }
    , denormalize: function (data) {
        //把來自同步的相對尺寸轉成自己的絕對尺寸
        if (!data._n) return
        var rect = this.widget_layer_rect
        if (typeof (data.x) != 'undefined') {
            data.x = Math.round(data.x * rect.width / 100)
            data.y = Math.round(data.y * rect.height / 100)
        }
        if (typeof (data.w) != 'undefined') {
            data.w = Math.round(data.w * rect.width / 100)
            data.h = Math.round(data.h * rect.height / 100)
        }
        delete data._n
        return data
    }
    , on_bus: function (data) {
        //peer calls send_to_bus('widget-sync',[topic, t_id, s_idx, payload])
        //從presentation.js 傳來的遠端widget同步訊息的第一站
        //console.log('bus >>',data)
        switch (data[0]) {
            case 'sync': //widget內部unit異動，轉發給unit自己處理
                var t_id = data[1]
                var s_idx = data[2]
                var payload = data[3]
                WidgetGallery.singleton.denormalize(payload.data)
                var slide = this.presentation.threads[t_id].slides[s_idx]
                var widget = slide.widget_manager.widgets[payload.id]
                if (!widget){
                    console.warn('widget', payload.id, 'not existed')
                }
                else if (payload.data.id) {
                    //message to unit
                    var unit = widget.units[payload.data.id]
                    if (unit) unit.on_sync(payload.data)
                    else console.warn('unit', payload.data.id, 'not existed in ',widget)
                }
                else {
                    //message to widget
                    widget.on_sync(payload.data)
                }
                break
            case 'add': //新增widget到slide
                var t_id = data[1]
                var s_idx = data[2]
                var wdata = data[3]//serialized data 
                var slide = this.presentation.threads[t_id].slides[s_idx]
                var box = (slide == this.presentation.current_slide) ? this.widget_layer : null
                //指定box會讓此widget加入DOM
                var widget = WidgetGallery.all[wdata.classname].create_sample(box)
                widget.deserialize(wdata)
                slide.widget_manager.add_widget(widget)//local only, no-sync
                break
            case 'remove': //remove widget from slide
                var t_id = data[1]
                var s_idx = data[2]
                var widget_id = data[3]
                var slide = this.presentation.threads[t_id].slides[s_idx]
                var widget = slide.widget_manager.widgets[widget_id]
                //從DOM中刪除
                widget.remove()
                //從資料結構中刪除
                slide.widget_manager.remove_widget(widget_id)//local only, no sync
                break
            case 'state':
                var t_id = data[1]
                var s_idx = data[2]
                var save_flag = data[3]
                var slide = this.presentation.threads[t_id].slides[s_idx]
                if (save_flag == 1) slide.widget_manager.state_save()
                else if (save_flag == -1) slide.widget_manager.state_restore()
                break
        }
    }
    , update_handles: function (widget, options) {
        if (Widget.selected.length == 0) return //maybe called by move()
        //
        // options: (dict)
        //      rotate:(boolean)
        //      resize:(boolean)
        //      if options is not presented, figure it by this.rotator and this.resizer
        //
        var rect = this.widget_layer_rect
        if (widget.state_manager.state_data.expand.yes) {
            //如果沒有options則使用與前一次相同的options
            if (!options) {
                options = this._last_option
                if (!options) {
                    options = {
                        rotate: this.rotator.style.display == 'none' ? false : true,
                        resize: this.resizer.style.display == 'none' ? false : true,
                    }
                }
            }
            this._last_option = options

            var bbox = widget.get_bbox()
            var abs_scale = (widget.scale * widget.get_parent_scale())
            var min_handles_scale = 20 / 60;//希望不小於20，實際大小是60
            var handles_scale = abs_scale > 1 ? 1 : (abs_scale < min_handles_scale ? min_handles_scale : abs_scale)
            var degree = widget.degree[2] + widget.get_parent_degree()

            this.attention_shape.style.display = 'inline-block'
            this.attention_shape.style.transformOrigin = widget.ele.style.transformOrigin
            this.attention_shape.style.transform = widget.ele.style.transform
            this.attention_shape.style.width = widget.ele.clientWidth + 'px'
            this.attention_shape.style.height = widget.ele.clientHeight + 'px'

            if (options.rotate) {
                //更新轉動中心點的位置
                this.resizer.style.display = 'none'
                if (widget.ele.classList.contains('rotatable')) {
                    var ow = (widget.origin[0] - 50) / 100 * bbox.width * abs_scale
                    var oh = (widget.origin[1] - 50) / 100 * bbox.height * abs_scale
                    var dxy = Widget.utils.transform(ow, oh, degree)
                    var ox = bbox.cx + dxy[0] - rect.left
                    var oy = bbox.cy + dxy[1] - rect.top
                    // 旋轉中心的位置
                    this.origin_handle.style.display = 'inline-block'
                    this.origin_handle.style.transform = 'translate(' + Math.round(ox) + 'px,' + Math.round(oy) + 'px) scale(' + handles_scale + ')'
                    this.origin_handle.dataset.x = ox
                    this.origin_handle.dataset.y = oy
                    // 更動旋轉把手的位置（固定在右上角）
                    var w = bbox.width / 2 * abs_scale
                    var h = bbox.height / 2 * abs_scale
                    var dxy = Widget.utils.transform(w, -h, degree)
                    var rx = bbox.cx + dxy[0] - rect.left
                    var ry = bbox.cy + dxy[1] - rect.top
                    this.rotator.style.transform = 'translate(' + Math.round(rx) + 'px,' + Math.round(ry) + 'px) scale(' + handles_scale + ')'
                    this.rotator.style.display = 'inline-block'
                }
            }
            else if (options.resize) {
                this.rotator.style.display = 'none'
                this.origin_handle.style.display = 'none'
                if (widget.ele.classList.contains('resizable')) {
                    // 更動尺寸把手的位置
                    var w = bbox.width / 2 * abs_scale
                    var h = bbox.height / 2 * abs_scale
                    var dxy = Widget.utils.transform(w, h, degree)
                    var rx = bbox.cx + dxy[0] - rect.left
                    var ry = bbox.cy + dxy[1] - rect.top
                    this.resizer.style.transform = 'translate(' + Math.round(rx) + 'px,' + Math.round(ry) + 'px) scale(' + handles_scale + ')'
                    this.resizer.style.display = 'inline-block'
                }
            }
            else {
                this.rotator.style.display = 'none'
                this.resizer.style.display = 'none'
                this.origin_handle.style.display = 'none'
            }
        }
        else {
            // do nothing when this widget is not expanded
        }
    }
    , fire: function (name) {
        if (!this.listener[name]) return
        var self = this
        var _args = []
        for (var i = 1; i < arguments.length; i++) {
            _args.push(arguments[i])
        }
        self.listener[name].forEach(function (callback) {
            try {
                callback.apply(self, _args)
            } catch (e) { console.warn(e) }
        })
    },
    on: function (name, callback) {
        if (this.listener[name]) this.listener[name].push(callback)
        else this.listener[name] = [callback]
    },
    off: function (name, callback) {
        if (callback) {
            this.listener[name].removeObject(callback)
            if (this.listener[name].length == 0) delete this.listener[name]
        }
        else {
            delete this.listener[name]
        }
    },
    factory: function (classname, ele) {
        return WidgetGallery.all[classname].factory(ele)
    },
    /* 以下是當作GUI產生器的相關功能(called by whiteboard.js) */
    set_context: function (context) {
        //called when first slide (background) has rendered
        //hook the gallery to presentation
        var self = this
        this.context_ready = true
        this.widget_layer = context.layer
        this.widget_layer_rect = context.content_rect
        this.widget_drawer = context.drawer
        this.presentation = context.presentation
        this.presentation.on('RESIZE',function(content_rect){
            self.widget_layer_rect = content_rect
        })
        this.presentation.on('widget', function (data) {
            switch (data.name) {
                case 'show-gallery':
                    self.show_gallery()
                    return
            }
        })

        this.init_dashboard(context.dashboard)
        this.presentation.on('PAGE-WILL-CHANGE', function (data) {
            var slide = self.presentation.current_slide
            if (!slide) return //at initial phase, no current slide
            Widget.selected.forEach(function (widget) {
                widget.select(false)
            })
            Widget.selected = []
            slide.widget_manager.on_hide()
            WidgetGallery.singleton.slot_purge()
        })
        this.presentation.on('PAGE-DID-CHANGE', function (data) {
            var slide = self.presentation.current_slide
            slide.widget_manager.on_show()
        })

        this.fire('context-ready')

        //讓第一張slide的widget開始render(因為其PAGE-DID-CHANGE事件已經發出過）
        //這要在 fire 'context-ready' 事件之後，因為on_show需要widget.metadata已經完全restore之後
        //決定其show的方式（如同slide之間跳來跳去的情況）
        self.presentation.current_slide.widget_manager.on_show()
    },
    init_dashboard: function (box) {
        var self = this
        //建立控制面板
        this.dashboard_box = box //#widget-dashboard
        this.dashboard_toolbar = box.querySelector('#widget-dashboard-toolbar')
        this.dashboard_form = box.querySelector('#widget-dashboard-form')
        // adjust box's position; 
        this.dashboard_box.classList.add('active') //讓此Node可見以取尺寸
        var box_rect = this.dashboard_box.getBoundingClientRect()
        this.dashboard_box.classList.remove('active')
        // top,left各留1px做區隔
        this.dashboard_box.style.top = '1px'
        //this.dashboard_box.style.left = ((this.widget_layer_rect.left - this.widget_layer_rect.left_offset) + this.widget_layer_rect.width - box_rect.width) + 'px'
        this.dashboard_box.style.left = ( 1 + (this.widget_layer_rect.left - this.widget_layer_rect.left_offset) + this.widget_layer_rect.width) + 'px'
        // 60 is height of page's header
        this.dashboard_box.style.height =  (this.widget_layer_rect.height) + 'px'

        //建立轉動把手
        var z_index = 2000
        this.rotator = document.createElement('div') //旋轉把手
        this.rotator.className = 'widget-rotator'
        this.rotator.innerHTML = '<span class="fa fa-undo"></span>'
        this.rotator.style.zIndex = z_index
        this.rotator.style.display = 'none'
        this.origin_handle = document.createElement('div') //旋轉把手
        this.origin_handle.className = 'widget-origin_handle'
        this.origin_handle.innerHTML = '<span class="fa fa-dot-circle"></span>'
        this.origin_handle.style.zIndex = z_index
        this.origin_handle.style.display = 'none'
        this.resizer = document.createElement('div') //RESIZER把手
        this.resizer.className = 'widget-resizer'
        this.resizer.innerHTML = '<span class="fa fa-expand"></span>'
        this.resizer.style.zIndex = z_index
        this.resizer.style.display = 'none'

        // 顯示在被選定的widget上方，當其所屬的unit長大時，依然能看到widget的邊緣
        this.attention_shape = document.createElement('div')
        this.attention_shape.classList.add('attention-shape')

        this.widget_layer.appendChild(this.rotator)
        this.widget_layer.appendChild(this.origin_handle)
        this.widget_layer.appendChild(this.resizer)
        this.widget_layer.appendChild(this.attention_shape)

        var widget; //selected widget
        var origin_center
        var sDegree
        var do_rotate = _.throttle(function (degree) {
            widget.rotate(degree)
            self.update_handles(widget)
            widget.sync({ id: 0, on: 'rotate', degree: degree })
        })
        interact(this.rotator).draggable({
            // enable inertial throwing
            inertia: true,
            // keep the element within the area of it's parent
            restrict: {
                restriction: "parent",
                endOnly: true,
                elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
            },
            autoScroll: true,
            onstart: function (evt) {
                evt.stopPropagation()
                widget = Widget.all[WidgetGallery.singleton.dashboard_box.dataset.widget_id]
                widget.ele.classList.add('freeze') //讓內容不可互動
                var rect = widget.get_bbox()
                var origin = { x: evt.pageX, y: evt.pageY }
                //旋轉中心點
                origin_center = [rect.cx, rect.cy]

                if (widget.origin[0] != 50 || widget.origin[1] != 50) {
                    //旋轉中心點不在物件中央，根據目前物件角度而調整，求得旋轉中心點的確實位置
                    var offset_x = (widget.origin[0] - 50) / 100 * rect.width, offset_y = (widget.origin[1] - 50) / 100 * rect.height
                    var xy = Widget.utils.transform(offset_x, offset_y, widget.degree[2] + widget.get_parent_degree())
                    origin_center[0] += xy[0]
                    origin_center[1] += xy[1]
                }
                //旋轉把手與旋轉中心的角度
                sDegree = Math.atan2((origin.y - origin_center[1]), (origin.x - origin_center[0]));
                starting_degree = widget.degree[2]
            },
            onmove: function (evt) {
                evt.stopPropagation()
                var current = { x: evt.pageX, y: evt.pageY }
                var pDegree = Math.atan2((current.y - origin_center[1]), (current.x - origin_center[0]));
                var degree = starting_degree + (pDegree - sDegree) * 180 / Math.PI;
                do_rotate(degree)
            },
            onend: function (evt) {
                widget.ele.classList.remove('freeze') //恢復內容可互動
                evt.stopPropagation()
                //setTimeout(function(){widget._changing_degree = false},1)
            }
        })
        //移動旋轉中心把手
        //var base_xy = null
        //var changing_origin = null
        //var hander_parent_degree = 0
        //var origin_handle_rect = this.origin_handle.getBoundingClientRect()
        var x, y, rect
        var do_move = _.throttle(function (x, y) {
            self.origin_handle.style.transform = 'translate(' + x + 'px,' + y + 'px)'
        })
        interact(this.origin_handle).draggable({
            inertia: true,
            autoScroll: true,
            onstart: function (evt) {
                evt.stopPropagation()
                widget = Widget.all[WidgetGallery.singleton.dashboard_box.dataset.widget_id]
                //widget._changing_origin = true
                widget.ele.classList.add('freeze') //讓內容不可互動
                x = parseFloat(self.origin_handle.dataset.x)
                y = parseFloat(self.origin_handle.dataset.y)
                rect = widget.get_bbox()
                return false
            },
            onmove: function (evt) {
                evt.stopPropagation()
                var dx = evt.dx, dy = evt.dy
                x += Math.round(dx)
                y += Math.round(dy)
                do_move(x, y)
            },
            onend: function (evt) {
                widget.ele.classList.remove('freeze') //恢復內容可互動
                self.origin_handle.dataset.x = x
                self.origin_handle.dataset.y = y
                evt.stopPropagation()
                //比較目前origin_handle跟物件中心的距離，計算最新的轉動中心比例（原始點為物件中心的50%,50%)
                //因為get_bbox是以getBoundingClientRect()算cx,cy，所以o_rect也取getBoundingClientRect()
                var o_rect = self.origin_handle.getBoundingClientRect()
                //加上15是因為origin_handle本身有margin，所以要做調整
                var dx = ((o_rect.left + 15) - rect.cx) / widget.scale
                var dy = ((o_rect.top + 15) - rect.cy) / widget.scale
                // 求此距離反轉回到0度時的距離及比例
                var dxy = Widget.utils.transform(dx, dy, -(widget.degree[2] + widget.get_parent_degree()))
                var dxy_percent = [Math.round(dxy[0] / rect.width * 100), Math.round(dxy[1] / rect.height * 100)]
                // 以50，50為原點，修正得到新的比例
                widget.origin[0] = 50 + dxy_percent[0]
                widget.origin[1] = 50 + dxy_percent[1]
                self.update_handles(widget)


                //變更TransformOrigin圖案會跳一下，所以根據中心位置（cx,cy)不變的原則把位置調整回來
                //目前這個作法會使得畫面閃一下,但似乎沒有更好的作法        
                var _rect1 = widget.get_bbox() // 儲存變動前的中心位置
                widget.ele.style.transformOrigin = widget.origin[0] + '% ' + widget.origin[1] + '%'
                setTimeout(function () {
                    var _rect2 = widget.get_bbox()
                    var dx = _rect2.cx - _rect1.cx
                    var dy = _rect2.cy - _rect1.cy
                    var parent_degree = widget.get_parent_degree()
                    if (parent_degree) {
                        var xy = Widget.utils.transform(dx, dy, -parent_degree)
                        dx = xy[0]
                        dy = xy[1]
                    }
                    widget.move(widget.x - dx, widget.y - dy)
                    widget._changing_origin = false
                })
                widget.fire('origin', widget.origin)

                //sync to remove
                widget.sync({ id: 0, on: 'origin', origin: widget.origin })
                return false
            }
        })
        var abs_degree
        var abs_scale
        var preserveAspectRatio = 0
        var dx, dy
        var do_resize = _.throttle(function (w, h, delta) {
            //限制不可低於10x10
            if (w * abs_scale < 10 || h * abs_scale < 10) return
            // 改變大小後，若有scale transform，
            // 因左上角位置也會變，移動物件以保持左上角固定
            var corners0 = widget.get_corners()
            widget.resize(w, h, delta)
            widget.sync({ id: 0, on: 'resize', w: w, h: h }, true)
            var corners1 = widget.get_corners()
            var dx = widget.x - (corners1.top_left.x - corners0.top_left.x),
                dy = widget.y - (corners1.top_left.y - corners0.top_left.y)
            widget.move(dx, dy)
            self.update_handles(widget)
        })
        interact(this.resizer).draggable({
            onstart: function (event) {
                widget = Widget.all[WidgetGallery.singleton.dashboard_box.dataset.widget_id]
                rect = { w: widget.w, h: widget.h }
                preserveAspectRatio = widget.ele.getAttribute('preserveAspectRatio') ? (rect.w / rect.h) : 0
                widget.ele.classList.add('freeze') //讓內容不可互動
                abs_degree = widget.degree[2] + widget.get_parent_degree()
                abs_scale = widget.scale * widget.get_parent_scale()
                dx = 0
                dy = 0
            },
            onmove: function (evt) {
                if (abs_degree) {
                    var dxy = Widget.utils.transform(evt.dx, evt.dy, - abs_degree)
                    dx += dxy[0]
                    dy += dxy[1]
                }
                else {
                    dx += evt.dx
                    dy += evt.dy
                }
                if (preserveAspectRatio) dx = dy * preserveAspectRatio

                var delta = {
                    dx: Math.round(100 * dx / abs_scale) / 100,
                    dy: Math.round(100 * dy / abs_scale) / 100
                }
                do_resize(rect.w + delta.dx, rect.h + delta.dy, delta)
            },
            onend: function (event) {
                widget.ele.classList.remove('freeze') //恢復內容可互動
                setTimeout(function () {
                    widget._changing_size = false
                }, 10)
            }
        })
        //draggable dashboard
        //var x, y
        //box =is this.dashboard_box, aka #widget-dashboard
        interact(this.dashboard_box.querySelector('#widget-dashboard-header')).draggable({
            inertia: true,
            onstart: function () {
                rect = box.getBoundingClientRect()
                x = rect.x
                y = rect.y
            },
            onmove: function (evt) {
                x += evt.dx
                y += evt.dy
                box.style.left = x + 'px'
                box.style.top = y + 'px'
            },
            onend: function () {

            }
        })
        //resizable
        var w, h
        var dashboard_resizer = document.querySelector('#widget-dashboard-resizer')
        interact(dashboard_resizer).draggable({
            onstart: function () {
                rect = box.getBoundingClientRect()
                rect2 = self.dashboard_form.getBoundingClientRect()
                w = rect.width
                h = rect.height
            }
            , onmove: function (evt) {
                w += evt.dx
                h += evt.dy
                box.style.width = w + 'px'
                box.style.height = h + 'px'
                self.dashboard_form.style.width = w + 'px'
            }
        })
        /* toolbar at top of dashboard */
        var items = [
            { type: 'button', id: 'toggle', caption: '<span class="fa fa-sort"></span>' }
            ,{ type: 'button', id: 'widget-drawer', text: 'Drawer', icon: 'fa fa-boxes', overlay: { width: 120 }, tooltip: 'a place to store widgets' }

        ]
        items.push({ type: 'spacer' })
        // render toolbar items for every Widget
        var start_idx = items.length
        Widget.metadata.actions.forEach(function (action, idx) {
            var item = { action: action, id: action.id, idx: idx + start_idx, type: action.type, text: action.text, icon: action.icon, tooltip: action.tooltip }
            Array.prototype.forEach.call(['items', 'html'], function (name) {
                if (action[name]) item[name] = action[name]
            })
            items.push(item)
        })
        items.push({ type: 'break' })
        items.push({ type: 'button', id: 'add', caption: '', icon: 'fa fa-plus', tooltip: 'create widget' })
        items.push({ type: 'break' })
        items.push({ type: 'button', id: 'remove', caption: '', icon: 'fa fa-backspace', tooltip: 'remove widget' })
        $(this.dashboard_box.querySelector('#widget-dashboard-header')).w2toolbar({
            name: 'widget-dashboard-header',
            items: items,
            onClick: function (evt) {
                switch (evt.target) {
                    case 'toggle':
                        var show = self.dashboard_form.style.display == 'none' ? true : false
                        if (show) {
                            self.dashboard_form.style.display = ''
                            dashboard_resizer.style.display = ''
                            self.dashboard_box.style.height = self.dashboard_box.dataset.height
                            setTimeout(function () {
                                //強迫重新render
                                var widget = Widget.all[self.dashboard_box.dataset.widget_id]
                                self.dashboard_box.dataset.widget_id = ''
                                self.render_dashboard(widget)
                            })
                        }
                        else {
                            self.dashboard_form.style.display = 'none'
                            dashboard_resizer.style.display = 'none'
                            self.dashboard_box.dataset.height = self.dashboard_box.style.height
                            self.dashboard_box.style.height = '60px'
                        }
                        break
                    case 'remove':
                        if (Widget.selected.length) {
                            w2confirm({
                                msg: 'Hands up, are you sure to remvoe the selected widget?',
                                title: 'Remove Widget',
                                btn_yes: {
                                    class: 'w2ui-btn-red'
                                },
                                btn_no: {
                                    text: 'Cancel'
                                }
                            })
                                .yes(function () {
                                    var widget = Widget.selected[0]
                                    widget.select(false)
                                    WidgetGallery.singleton.destroy_dashboard(widget)
                                    //從DOM中刪除
                                    widget.remove()
                                    //從資料結構中刪除，並且同步
                                    WidgetGallery.singleton.presentation.current_slide.widget_manager.remove_widget(widget.id, true)
                                })
                        }
                        break
                    case 'add':
                        /*
                        //for developing
                        //var widget = WidgetGallery.all['FlipCardWidget'].create_sample(self.widget_layer)
                        var widget = WidgetGallery.all['BoxWidget'].create_sample(self.widget_layer)
                        self.presentation.current_slide.widget_manager.add_widget(widget, true)
                        _.defer(function () {
                            widget.move(200, 200)
                            widget.sync({ id: 0, on: 'move', x: 200, y: 200 })
                        })
                        */
                        //show/hide widget gallery
                        WidgetGallery.singleton.show_gallery()
                        break
                    case 'widget-drawer':
                        WidgetGallery.singleton.presentation.fire('ACTION', { name: 'widget-drawer', yes: (!document.querySelector('#widget-drawer').classList.contains('open')) })
                        break
                    default:
                        if (Widget.selected.length) {
                            items.some(function (item) {
                                if (item.id != evt.target) return
                                var widget = Widget.selected[0]
                                item.action.onClick(widget, w2ui['widget-dashboard-header'], evt)
                                return true
                            })
                        }
                        break
                }
            }
        })
    }
    , destroy_dashboard: function (widget) {
        //called when widget.remove() been called
        //只有在dashboard所render的widget，是所給定的widget的時候，強迫更新dashboard的內容
        var self = this
        if (this._destroy_dashboard_timer) clearTimeout(this._destroy_dashboard_timer)
        this._destroy_dashboard_timer = setTimeout(function () {
            //避免nested unit被destroy時連續呼叫好幾次
            if (self.dashboard_box.dataset.widget_id !== widget.id) return
            if (w2ui['dashboard-form']) w2ui['dashboard-form'].destroy()
            if (w2ui['dashboard-toolbar']) w2ui['dashboard-toolbar'].destroy()
        }, 100)
    }
    , update_dashboard: function (widget) {
        //只有在dashboard所render的widget，是所給定的widget的時候，強迫更新dashboard的內容
        var self = this
        if (this._update_dashboard_timer) clearTimeout(this._update_dashboard_timer)
        this._update_dashboard_timer = setTimeout(function () {
            //避免nested unit被destroy時連續呼叫好幾次
            if (self.dashboard_box.dataset.widget_id !== widget.id) return
            self.dashboard_box.dataset.widget_id = ''
            self.render_dashboard(widget)
        }, 100)
    }
    , render_dashboard: function (widget) {
        //在box (htmlelement)中顯示widget的控制面盤
        // render toolbar items only if widget is changed
        // if necessary, call update_dashboard() to enforce re-rendering
        if (this.dashboard_box.dataset.widget_id == widget.id) return
        var self = this
        this.dashboard_box.dataset.widget_id = widget.id
        var actions = widget.get_actions()
        var toolbar_items = []
        actions.forEach(function (action, idx) {
            var toolbar_item = { id: action.id, idx: idx, type: action.type, text: action.text, icon: action.icon, tooltip: action.tooltip, disabled:action.disabled }
            Array.prototype.forEach.call(['items', 'html'], function (name) {
                if (action[name]) toolbar_item[name] = action[name]
            })
            toolbar_items.push(toolbar_item)
        })
        if (w2ui['dashboard-toolbar']) {
            w2ui['dashboard-toolbar'].destroy()
        }
        $(self.dashboard_toolbar).w2toolbar({
            name: 'dashboard-toolbar',
            items: toolbar_items,
            onClick: function (evt) {
                switch (evt.target) {
                    default:
                        var item = evt.item
                        var action = item.idx < actions.length ? actions[item.idx] : Widget.metadata.actions[item.idx - actions.length]
                        action.onClick(widget, w2ui['dashboard-toolbar'], evt)
                }
            }
        })        
        /* 隱藏的話不需要render form */
        if (self.dashboard_form.style.display == 'none') return
        /* field type supported by w2ui: http://w2ui.com/web/docs/1.5/w2form.fields */
        var widget_dashboard_items = []
        widget.get_dashboard(widget_dashboard_items)
        var dashboard = _.concat(widget_dashboard_items,Widget.metadata.dashboard)
    
        var html = []
        var fields = []
        var tabs = []
        var record = {}
        var groups = []
        // 把這幾個TAB放到最後面
        var default_groupid = ['Widget', 'Box']
        var default_groups = {}
        dashboard.forEach(function (group, d_idx) { //
            if (default_groupid.indexOf(group.id) >= 0) default_groups[group.id] = [group, d_idx]
            else groups.push([group, d_idx])
        })
        //groups.sort(function(a,b){return a[0] > b[0] ? 1 : (a[0] < b[0] ? -1 : 0)})
        default_groupid.forEach(function (name) {
            if (default_groups[name]) groups.push(default_groups[name])
        })
        groups.forEach(function (groupitem, g_idx) {
            var group = groupitem[0]
            var d_idx = groupitem[1]
            tabs.push({ id: 'tab' + d_idx, caption: group.text })
            html.push('<div class="dashboard-page w2ui-page page-' + (g_idx) + '">')
            var rows = _.isArray(group.items) ? group.items : [group.items]
            group.rows = rows.length
            rows.forEach(function (items, c_idx) {
                html.push('<div class="dashboard-column w2ui-column">')
                items.forEach(function (item, idx) {
                    var name = 'f-' + d_idx + '-' + c_idx + '-' + idx
                    //special field type, not supported by w2ui
                    if (item.type == 'button') {
                        html.push('<div class="w2ui-field dashboard-item' + (item.item_class ? ' ' + item.item_class : '') + '">')
                        var tooltip = item.tooltip ? ' onmouseout="$(this).w2tag()" onmouseover="$(this).w2tag(unescape(\'' + escape(item.tooltip) + '\'));"' : ''
                        html.push('<label' + tooltip + '>' + item.label + '</label><div>')
                        html.push('<button'+ (item.disabled ? ' disabled="1"' : '')+' name="' + name + '" class="w2ui-btn' + (item.class ? ' ' + item.class : '') + '" style="' + (item.style || '') + '"><span class="' + item.icon + '"> ' + item.button_label + '</span></button>')
                        if (item.legend) html.push('<div class="legend">' + item.legend + '</div>')
                        html.push('</div></div>') // end this item
                        return
                    }
                    else if (item.type == 'button-row') {
                        html.push('<div class="w2ui-field dashboard-item' + (item.item_class ? ' ' + item.item_class : '') + '">')
                        html.push('<label>' + item.label + '</label>')
                        html.push('<div class="button-row-buttons">')
                        item.buttons.forEach(function (subitem, idx) {
                            var tooltip = subitem.tooltip ? ' onmouseout="$(this).w2tag()" onmouseover="$(this).w2tag(unescape(\'' + escape(subitem.tooltip) + '\'));"' : ''
                            html.push('<button' + tooltip + (subitem.disabled ? ' disabled="1"' : '')+' name="' + name + '" idx="' + idx + '" class="w2ui-btn' + (subitem.class ? ' ' + subitem.class : '') + '" style="' + (subitem.style || '') + '"><span class="' + subitem.icon + '"> ' + subitem.button_label + '</span></button>')
                        })
                        html.push('</div>')
                        if (item.legend) html.push('<div class="legend">' + item.legend + '</div>')
                        html.push('</div>') // end this item
                        return
                    }
                    else if (item.type == 'html') {
                        html.push('<div class="w2ui-field dashboard-item">')
                        item.html(widget, html)
                        html.push('</div>') // end this item
                        return
                    }                    

                    var field = { field: name, type: item.type }
                    
                    // format: {group:'some group name' , column:0} 
                    // see w2ui's document: http://w2ui.com/web/demos/#!forms/forms-11
                    Array.prototype.forEach.call(['html', 'options'], function (prop_name) {
                        //copy specific prop to field
                        if (item[prop_name]) {
                            //如果options是一個function，雖然底下會再設定一次，這裡還是要有，否則選項會在變換tab之後消失
                            field[prop_name] = typeof (item[prop_name]) == 'function' ? item[prop_name](widget) : item[prop_name]
                        }
                    })
                    fields.push(field)
                    var tooltip = item.tooltip ? ' onmouseout="$(this).w2tag()" onmouseover="$(this).w2tag(unescape(\'' + escape(item.tooltip) + '\'));"' : ''
                    html.push('<div class="dashboard-item w2ui-field' + (item.item_class ? ' ' + item.item_class : '') + '">')
                    html.push('<label' + tooltip + '>' + item.label + '</label>')
                    record[name] = item.get(widget)
                    html.push('<div>')
                    switch (item.type) {
                        case 'range': //not supported by w2ui
                            html.push('<input style="' + (item.style || '') + '" name="' + name + '" type="range" step="' + item.step + '" min="' + item.min + '" max="' + item.max + '" oninput="this.nextSibling.innerText=this.value"><span class="range-value r-' + name + '">' + record[name] + '</span>')
                            break
                        case 'color':
                            html.push('<input type="text" style="' + (item.style || '') + '" name="' + name + '">')
                            break
                        case 'textarea':
                            html.push('<textarea name="' + name + '" style="' + (item.style || '') + '"></textarea>')
                            break
                        case 'select':
                        case 'list':
                            html.push('<input type="list" style="' + (item.style || '') + '" name="' + name + '">')
                            break
                        case 'radio':
                            field.options.items.forEach(function (option) {
                                html.push('<label style="display:inline-block;white-space:nowrap;overflow:hidden;"><input name="' + name + '" type="radio" value="' + option.id + '"/> ' + option.text + '</label>')
                            })
                            break
                        default:
                            html.push('<input type="' + item.type + '" style="' + (item.style || '') + '" name="' + name + '">')
                    }
                    if (item.legend) html.push('<div class="legend">' + item.legend + '</div>')
                    html.push('</div>') //field
                    html.push('</div>') //item                
                })
                html.push('</div>') //column
            })
            html.push('</div>') //tab page
        })
        //utility
        var get_item = function (name) {
            var index = name.split('-')
            var group = dashboard[parseInt(index[1])]
            var item
            if (group.rows) {
                item = group.items[parseInt(index[2])][parseInt(index[3])]
            }
            else {
                item = group.items[parseInt(index[3])]
            }
            return item
        }
        
        //restore to same tab if any
        if (w2ui['dashboard-form']) {
            w2ui['dashboard-form'].tabs.tabs.some(function(tab,idx){
                if (tab.id == w2ui['dashboard-form'].tabs.active ){
                    active_tab_idx = idx
                    tabs[idx].active = true
                    return true
                }
            })
            w2ui['dashboard-form'].destroy()
        }
        this.dashboard_form.innerHTML = html.join('')
        $(this.dashboard_form).w2form({
            name: 'dashboard-form',
            tabs: tabs,
            fields: fields,
            focus: 'f',//可以亂給，不能空白
            //style:'height:100%',
            record: record,
            onChange: function (evt) {
                //一些w2ui自己的元件，如list，會從這裡呼叫
                var item = get_item(evt.target)
                if (item._ignore) return
                // evt.target 只是string類型的id, 此處模擬一個<input>讓item.set使用
                item.set(widget, { value: evt.value_new }, item,w2ui['dashboard-form']) 
            },
            toolbar: toolbar
        })
        //讓改變可以即時反應
        var value_changed = function (evt) {
            var item = get_item(evt.currentTarget.getAttribute('name'))
            item._ignore = true //已經在oninput事件中改變的屬性，不要在最後重複設定
            item.set(widget, evt.currentTarget, item, w2ui['dashboard-form']) //miso
        }
        this.dashboard_form.querySelectorAll('.dashboard-item input, .dashboard-item textarea').forEach(function (ele) {
            //不要讓presentation的keyboard事件干擾輸入
            ele.onfocus = function (evt) {
                WidgetGallery.singleton.presentation.keyboard_shortcut.suspend = true
            }
            ele.onblur = function (evt) {
                WidgetGallery.singleton.presentation.keyboard_shortcut.suspend = false
            }
            ele.addEventListener('input', value_changed)

            if (ele.getAttribute('type') == 'list' || ele.getAttribute('type') == 'select' || ele.getAttribute('type') == 'radio') {
                var item = get_item(ele.getAttribute('name'))
                var options = typeof (item.options) == 'function' ? item.options(widget) : _.cloneDeep(item.options)
                if (typeof (options.selected) == 'undefined' || options.selected === null) {
                    //figure out the selected option
                    options.selected = item.get(widget)
                }
                $(ele).w2field(ele.getAttribute('type'), options)
            }
        })
        var button_clicked = function (evt) {
            var item = get_item(evt.currentTarget.getAttribute('name'))
            if (item.type == 'button-row') {
                var subitem = item.buttons[parseInt(evt.currentTarget.getAttribute('idx'))]
                subitem.onClick(widget, evt.currentTarget)
            }
            else item.onClick(widget, evt.currentTarget)
        }
        this.dashboard_box.querySelectorAll('.dashboard-item button').forEach(function (ele) {
            ele.onclick = button_clicked
        })

    }
    /*
    ,save_slide_widgets:function(slide){
        // data is an array of serialzed data of widgets belongs to this slide
        var serialized_data = []
        for (var id in Widget.all){
            serialized_data.push(Widget.all[id].serialize())
        }
        slide.update_widget_data = serialized_data
    }
    ,restore_slide_widgets:function(slide){
        // data is an array of serialzed data of widgets belongs to this slide
        var self = this
        
        // delete all existing widgets
        Widget.selected.forEach(function(widget){
            widget.select(false)
        })
        Widget.selected = []
        for (var id in Widget.all){
            Widget.all[id].remove()
        }
        Widget.all = {}

        var serialized_data = slide.widget_data
        if (serialized_data) {
            serialized_data.forEach(function(item){
                var widget = WidgetGallery.all[item.classname].create_sample(self.widget_layer)
                widget.deserialize(item)
            })
        }
    }
    , render_user_widgets_handler: function (box) {
        //顯示使用者擁有的可使用的widget及一個「增加widget」的按鈕
        //依賴於w2ui.js
        var self = this
        var html = [
            '<div class="user-widget-list flex-box">',
            '<div class="flex-item"><button class="add-widget">Add</button></div>',
        ]
        / *
        for(var kind in this.widget_class){
            var a_class = this.widget_class[kind]
            html.push('<div class="widget-option"><span class="display_name">'+a_class.display_name+'</span>'+
                '<p class="description">'+a_class.description+'</p>'+
                '<button class="add" kind="'+kind+'"> Add</button>'+
                '</div>')
        }
        * /
        html.push('</div>')
        box.innerHTML = html.join('')
        box.querySelector('button.add-widget').onclick = function (evt) {
            self.presentation.fire('widget', { name: 'show-gallery' })
        }
    },
    */
    ,show_gallery: function () {
        //讓使用者挑選widget以新增
        var self = this
        var screen_rect = this.widget_layer_rect// document.getElementById('screen-frame').getBoundingClientRect()
        $().w2popup({
            name: 'widget-gallery',
            width: screen_rect.width + 'px',
            height: (screen_rect.height * 0.8) + 'px',
            onClose: function () {
                w2ui['widget-category'].destroy()
                w2ui['widget-gallery-frame'].destroy()
            }
        })
        _.defer(function () {
            var $popup = $('#w2ui-popup')
            $popup.w2layout({
                name: 'widget-gallery-frame',
                panels: [
                    { type: 'left', size: 300, resizable: true, content: 'sidebar' },
                    { type: 'main', size: 200, resizable: false, style: 'padding:10px', content: '<h3 class="widget-classname"><span></span><button disabled class="do-add-widget w2ui-btn w2ui-btn-blue">Add</button></h3><div style="line-height:1.25em" class="widget-description"></div>' },
                    { type: 'preview', size: (screen_rect.height * 0.8 - 200), resizable: true, content: '<div class="widget-video"></div>'}
                ]
            });
            //sidebar for category
            var categories = [
                {
                    category: 'general',
                    caption: 'General',
                    icon: 'fa fa-folder'
                }
            ]
            var nodes = []
            categories.forEach(function (item) {
                var item_nodes = [] //2nd level items
                WidgetGallery.all_by_category[item.category].forEach(function (a_class) {
                    item_nodes.push({
                        id: a_class.name,
                        text: a_class.metadata.caption,
                        icon: a_class.metadata.icon
                    })
                })
                nodes.push({ //1st level items
                    id: item.category,
                    text: item.caption,
                    icon: item.icon,
                    expanded: true, group: true,
                    nodes: item_nodes
                })
            })
            $().w2sidebar({
                name: 'widget-category',
                nodes: nodes,
                topHTML: '<div style="background-color: #eee; padding: 10px 5px; border-bottom: 1px solid silver">Widget Gallery</div>',
                onClick: function (evt) {
                    var classname = evt.target //aka item_node's id
                    var a_class = WidgetGallery.all[classname]
                    //$popup.find('.do-add-widget').html('Add ' + a_class.metadata.caption)
                    $popup.find('.do-add-widget').attr('kind', classname)
                    $popup.find('.widget-classname span').html(a_class.metadata.caption)
                    $popup.find('.widget-description').html(a_class.metadata.description)
                    var whratio = 560/315
                    var space_size = $popup.find('.widget-video').parent()[0].getBoundingClientRect()
                    var width, height
                    if (space_size.width / space_size.height > whratio){//fit height
                        height = space_size.height
                        width = Math.round(height * whratio)
                    }
                    else{
                        width = space_size.width
                        height = Math.round(width / whratio)
                    }
                    var video_iframe = '<iframe width="'+width+'" height="'+height+'" src="https://www.youtube.com/embed/'+a_class.metadata.video+'" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'

                    $popup.find('.widget-video').html(video_iframe)
                    $popup.find('.do-add-widget').attr('disabled', null)
                }
            });
            w2ui['widget-gallery-frame'].content('left', w2ui['widget-category'])
            $popup.find('.do-add-widget').on('click', function () {
                var classname = $popup.find('.do-add-widget').attr('kind')
                var a_class = WidgetGallery.all[classname]
                var widget = a_class.create_sample(self.widget_layer)
                //這一方式會讓此widget被WidgetGallery送到遠端同步
                self.presentation.current_slide.widget_manager.add_widget(widget, true)
                w2popup.close()
                //auto select this new widget
                widget.select(true)
            })
        })
    }

    /* divert dnd and paste delegate to selected widget*/
    , on_dnd: function (data, evt) {
        this.on_paste(data, evt)
    }
    , on_dnd_string: function (text, evt) {
        this.on_paste_string(text,evt)
    }
    , on_paste: function (data, evt) {
        if (Widget.selected.length) Widget.selected[0].on_paste(data, evt)
    }
    , on_paste_string: function (text, evt) {
        // return true if this paste been handled
        var obj = null
        try {
            //figure if user pasting copied-widget
            obj = JSON.parse(text)
        } catch (e) { }
        if (obj && obj.classname) {
            //Widget.all[obj.id].clone()
            var widget = WidgetGallery.all[obj.classname].create_sample(this.widget_layer)
            var is_clone = true
            widget.deserialize(obj, is_clone)
            //這一方式會讓此widget被WidgetGallery送到遠端同步
            this.presentation.current_slide.widget_manager.add_widget(widget, true)
            return true
        }
        if (Widget.selected.length) {
            Widget.selected[0].on_paste_string(text, evt)
            return true
        }
        return false
    }
    /* update file to server (copied from whiteboard.js)*/
    , preprocess_file: function (file) {
        /* image檔案的前處理 */
        var promise = new $.Deferred()
        if (file.type == 'image/gif') {
            promise.resolve(file) // nothing changed
        }
        else if (file.type == 'image/jpeg' || file.type == 'image/png') {
            resizeAndRotateImage(file, 1536, function (blob) {

                if (blob) {
                    //new image generated
                    var jpeg_name = file.name.replace(/\.png/, '.jpg');
                    promise.resolve(new File([blob], jpeg_name))
                }
                else {
                    // nothing changed
                    promise.resolve(file)
                }
            })
        }
        else {
            promise.reject('not image file')
        }
        return promise
    }
    , upload_widget_file: function (options) {
        /*
         options:
            file: blob
            uuid: string
            name: string; (optional)
            t_id:(optional)
            s_idx:(optional)
            flag:(optional)
        */
        window.message('uploading file')
        var promise = new $.Deferred()
        var t_id = this.presentation.current_thread.id
        var s_idx = this.presentation.current_slide.idx
        var flag = this.presentation.flag
        var args = [{
            p: this.presentation.p_id,
            t: options.t_id || t_id,
            s: options.s_idx || s_idx,
            u: options.uuid,
            f: options.flag || flag,
            n: options.name || options.file.name
        }]
        if (!options.file instanceof File){
            console.error('options.file is not file, failed to upload',options.file)
            return
        }
        this._send_command('upload_widget_file', args, options.file).done(function (filename) {
            window.message('uploading completed')
            promise.resolve(filename)
            // no need to update to Presentation's local copy
            // local copy will got updated from bus by sync
        }).fail(function (response) {
            console.log('error', response)
            promise.reject(response.retcode, response.stderr.message || response.stderr)
        })
        return promise
    }
    , clone_widget_file: function (options) {
        /*
         options:
            file: string(filename to clone)
            uuid: string(filename of cloned file)
            t_id:(optional)
            s_idx:(optional)
            flag:(optional)
        */
        window.message('copying file')
        var promise = new $.Deferred()
        var t_id = this.presentation.current_thread.id
        var s_idx = this.presentation.current_slide.idx
        var flag = this.presentation.flag
        var args = [
            this.presentation.p_id,
            options.flag || flag,
            options.t_id || t_id,
            options.s_idx || s_idx,
            options.uuid,
            options.file
        ]
        this._send_command('clone_widget_file', args).done(function (filename) {
            window.message('copying completed')
            promise.resolve(filename)
        }).fail(function (response) {
            console.log('error', response)
            promise.reject(response.retcode, response.stderr.message || response.stderr)
        })
        return promise
    }
    , flush_destroyed_uuid: function () {
        var uuids = this._destroyed_uuid
        this._destroyed_uuid = []
        var promise = new $.Deferred()
        var args = [
            this.presentation.p_id,
            this.presentation.flag,
            this.presentation.current_thread.id,
            uuids
        ]
        this._send_command('remove_widget_files', args).done(function () {
            promise.resolve()
            window.message('flush destroyed files completed')
        }).fail(function (err_message) {
            console.warn('flush destroyed files error:' + err_message)
        })
        return promise
    }
    , remove_widget_file: function (uuid) {
        //由widget_manager統一批次通知server，此unit被刪除了，需刪除他的圖檔
        this._destroyed_uuid.push(uuid)
        this._destroyed_uuid_refresh()
    }
    , slot_push: function (slot_ele, widget) {
        //把widget放入slot(可能是使用者，或者是slide異動
        widget.select(false)
        if (slot_ele.dataset.id && slot_ele.dataset.id != widget.id){
            //slot上有其他的widget的話，則先將其踢出slot
            WidgetGallery.singleton.slot_pop(Widget.all[slot_ele.dataset.id])
        }
        if (widget.ele.dataset.transform) {
            // case 1: 被放到slot之後，換slide被移出，現又回到該slide而重新被放回 slot; 
            // case 2: 在別的slot,要搬到此slot; switch slot (such as when restoring state)
            // case 2-1: 此slot是空的，case 2-2: 此slot有別的slot（因為已經被踢出，此情況不會發生）
            // 不需作任何css style的改變
            if (widget.metadata.slot == slot_ele.getAttribute('slot-idx')){
                if (widget.ele.parentNode){ 
                    //widget.ele.parentNode is not widget-layer, because
                    //"widget.ele.dataset.transform" is removed when a widget has pop out of slot
                    //why? (push the same widget twice?)
                    console.warn('case unknow 1')
                    return
                }
                else{
                    //case 1
                    slot_ele.dataset.id = widget.id
                }
            }
            else{
                if (widget.ele.parentNode){
                    var src_slot = widget.ele.parentNode
                    //case 2
                    if (slot_ele.dataset.id){
                        console.warn('case unknow 2-2')
                        return
                    }
                    else{
                        //case 2-1
                        // reset src slot
                        delete src_slot.dataset.id
                        src_slot.classList.add('empty')
                        slot_ele.dataset.id = widget.id
                    }
                }
                else{
                    // why?
                    console.warn('case unknow 2')
                    return
                }
            }
            slot_ele.classList.remove('empty')
            slot_ele.appendChild(widget.ele)
        }
        else {
            var callback = function(){
                //初次被放到slot
                slot_ele.dataset.id = widget.id
                widget.metadata.slot = slot_ele.getAttribute('slot-idx') //must be string type to evalute true
                //inform object in widget that the widget is going into slot
                widget.fire('hide')
                widget.ele.dataset.transform = widget.ele.style.transform
                widget.ele.style.transform = ''
                _.defer(function () {
                    var slot_rect = { width: parseFloat(slot_ele.style.width), height: parseFloat(slot_ele.style.height) }
                    var widget_rect = { width: widget.w, height: widget.h }
                    var scale_w = slot_rect.width / widget_rect.width
                    var scale_h = slot_rect.height / widget_rect.height
                    var scale = Math.round(100 * Math.min(scale_w, scale_h)) / 100
                    widget.ele.style.transform = 'scale(' + scale + ')'
                    //調整到中心位置
                    if (scale_w <= scale_h) {
                        widget.ele.style.top = Math.round((slot_rect.height - widget_rect.height * scale) / 2) + 'px'
                    }
                    else {
                        widget.ele.style.left = Math.round((widget_rect.width * scale - slot_rect.width) / 2) + 'px'
                    }
                    widget.ele.classList.add('inslot')
                })
                slot_ele.classList.remove('empty')
                slot_ele.appendChild(widget.ele) 
            }

            var do_animation = function(callback){
                //以進入slot而言，這是最早的步驟
                var animation_name;
                Constant.out_styles.some(function(item){
                    if (widget.state_manager.state_data.slot.in == item.id){
                        animation_name = item.name
                        return true
                    }
                })
                if (!widget.ele.parentNode || !animation_name  || animation_name == '0'){
                    // no animation; 
                    // ex.slide 一開始時widget.ele不在DOM內，沒有parentNode，不必有動畫
                    callback()
                }
                else{
                    var animationend = function(){
                        widget.box.classList.remove('animated',animation_name)
                        widget.box.removeEventListener('animationend',animationend)
                        callback()
                    }
                    widget.box.addEventListener('animationend',animationend)
                    widget.box.classList.add('animated',animation_name)    
                }            
            }
            
            do_animation(callback)
        }
        
    }
    , slot_pop: function (widget) {
        //把widget移出slot
        delete widget.metadata.slot
        var slot_ele = widget.ele.parentNode
        widget.ele.classList.remove('inslot')
        delete slot_ele.dataset.id
        slot_ele.classList.add('empty')
        //widget.ele 是靠transform定位的，所以把style.left,top恢復為0
        widget.ele.style.left = '0px'
        widget.ele.style.top = '0px'
        this.widget_layer.appendChild(widget.ele)
        widget.ele.style.transform = widget.ele.dataset.transform
        delete widget.ele.dataset.transform
        //inform object in widget that the widget is going out of slot
        var animation_name;
        Constant.in_styles.some(function(item){
            if (widget.state_manager.state_data.slot.out == item.id){
                animation_name = item.name
                return true
            }
        })
        if (!animation_name  || animation_name == '0'){
            //no animation
            widget.fire('show')
        }
        else{
            var animationend = function(){
                widget.box.classList.remove('animated',animation_name)
                widget.box.removeEventListener('animationend',animationend)
                widget.fire('show')
            }
            widget.box.addEventListener('animationend',animationend)
            widget.box.classList.add('animated',animation_name)    
        }
    }
    , slot_purge: function () {
        //清空slot, ex. reset slide
        this.widget_drawer.querySelectorAll('.slot').forEach(function (slot_ele) {
            delete slot_ele.dataset.id
            slot_ele.classList.add('empty')
        })
    }
}
WidgetGallery.all = {} //所有widget class的註冊
WidgetGallery.all_by_category = {}
WidgetGallery.register = function (a_class) {
    if (!a_class instanceof Widget) {
        console.warn('widget should subclass GenericGallery, registration failure for', a_class)
        return
    }
    WidgetGallery.all[a_class.name] = a_class
    var category = a_class.metadata.category || 'general'
    if (WidgetGallery.all_by_category[category]) WidgetGallery.all_by_category[category].push(a_class)
    else WidgetGallery.all_by_category[category] = [a_class]
}
window.addEventListener('DOMContentLoaded', function () {
    new WidgetGallery()
})


/* 以下是個別Widget的實作 與 helper class*/
/* 所有unit必須 inherited 此class */
function GenericUnit(widget, box, func_name) {
    if (!(widget.ele && widget.ele.classList.contains('widget'))) throw ('given widget might not "widget"')
    this.widget = widget
    this.id = uuidv4()//Math.round(new Date().getTime() - 1551881432483) + '-' + Math.round(Math.random() * 10000)
    this.widget.units[this.id] = this
    this.box = box //container element belongs to parent unit or widget
    //this.ele 是此unit的最上層node，如果有值的話是clone的情況，此ele在呼叫destroy時會自動從DOM移除
    //在此，this.ele只會assign，不會create；ele要有classname是其所屬的unit的名稱
    this.ele = func_name ? (box.querySelector('div.' + func_name) || null) : null
    if (this.ele) this.ele.setAttribute('id', this.id)
    //this.relay = this
    this.listener = {}
    this.metadata = {
        id: this.id
        , classname: func_name
        , css:{}
    }

    this.resizable_options = null
}
GenericUnit.prototype = {
    constructor: GenericUnit
    /* utility function to create Unit's ele */
    , create_ele: function (options) {
        this.ele = document.createElement('div')
        this.ele.classList.add('unit', options.classname)
        for (var prop in options.style) {
            this.ele.style[prop] = options.style[prop]
        }
        this.box.appendChild(this.ele)
    }
    , get_actions: function () { return [] }
    , get_dashboard: function (dashboard) {}
    , serialize: function (for_clone) {
        return _.cloneDeep(this.metadata)
    }
    , deserialize: function (metadata, is_clone) {
        if (is_clone) {
            //use current id
            this.metadata = _.cloneDeep(metadata)
            this.metadata.id = this.id
        }
        else if (metadata.id) {
            //unregister current id, it is temporary generated
            delete this.widget.units[this.id]
            this.id = metadata.id
            //re-reigister new id
            this.widget.units[this.id] = this
            if (this.ele) this.ele.setAttribute('id', this.id)
            this.metadata = _.cloneDeep(metadata)
        }

        // 等WidgetGallery被set_context之後再恢復位置跟大小
        var self = this
        var call_with_context = function () {
            if (self.metadata.scale) { // this is a normalized scale value
                //YoutubeUnit 在一開始，video還沒載入時，不能resize
                if (self.resizable_options && self.resizable_options.scale_target) {
                    self.resizable_options.scale_target.dataset.scale = self.metadata.scale
                    //把normalize的scale轉成實際的scale
                    var scale = self.metadata.scale * self.widget.rel_scale
                    self.zoom(scale)
                }
            }
            if (self.metadata.resize) {
                //YoutubeUnit 在一開始，video還沒載入時，不能resize 
                if (self.resizable_options && self.resizable_options.resize_target) {
                    var resize = _.clone(self.metadata.resize)
                    WidgetGallery.singleton.denormalize(resize)
                    self.resize(resize.w, resize.h)
                }
            }
            if (self.metadata.move) {
                var move = _.clone(self.metadata.move)
                WidgetGallery.singleton.denormalize(move)
                self.move(move.x, move.y)
            }
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)
    }
    ,state_save:function(){
        var data = {}
        if (this.ele){
            if (this.metadata.move){
                data.x = this.metadata.move.x
                data.y = this.metadata.move.y
            }
            else {
                var drag_target = this.ele
                var normal_xy = WidgetGallery.singleton.normalize({
                    w:parseFloat(drag_target.style.left),
                    h:parseFloat(drag_target.style.top)})
                data.x = normal_xy.x
                data.y = normal_xy.y
            }
        }
        if (this.resizable_options && this.resizable_options.resize_target){
            if (this.metadata.resize){
                data.w = this.metadata.resize.w
                data.h = this.metadata.resize.h    
            }
            else{
                var normal_wh = WidgetGallery.singleton.normalize({w:parseFloat(this.resizable_options.resize_target.style.width),
                    h:parseFloat(this.resizable_options.resize_target.style.height)})
                data.w = normal_wh.w
                data.h = normal_wh.h
            }
            if (this.resizable_options.scale_target) data.s = this.metadata.scale || 1
        }
        if (_.size(data) == 0 ) return null
        data._n = 1 //data的數值都是normalized過的，手動加上flag
        return data
    }
    ,state_restore:function(_data){
        // unit
        var data = _.cloneDeep(_data)
        WidgetGallery.singleton.denormalize(data)
        if (data.x || data.y) this.move(data.x, data.y)
        if (this.resizable_options){
            if (data.w || data.h) this.resize(data.w, data.h)
            if (data.s && data.s != 1) {
                this.metadata.scale = data.s
                //重新把normalize的scale寫回ele.dataset，使得手動縮放時可得到正確的scale
                //這個作法不是很好，暫時先這樣了
                this.resizable_options.scale_target.dataset.scale = data.s
                var denormalized_scale = this.resizable_options.static_scale  ? data.s : data.s * this.widget.rel_scale
                this.zoom(denormalized_scale)
            }
        }
    }
    , reset:function(){
        this.move(0,0)
        this.zoom(1)
    }
    , get_info:function(){
        // dashboard 以grid顯示此unit時會用到,subclass需複寫
        return {
            type:this.constructor.name,
            content:''
        }
    }
    ,css:function(css_name,css_value){
        if (_.isObject(css_name)){
            for(var name in css_name){
                this.box.style[name] = css_name[name]
            }
            _.assign(this.metadata.css, css_name)
        }
        else{
            this.metadata.css[css_name] = css_value
            this.box.style[css_name] = css_value
        }
    }    
    , fire: function (name) {
        var self = this
        var args = [name]
        for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i])
        }
        if (this.listener['*']) {
            for (var func_name in self.listener['*']) {
                try {
                    self.listener['*'][func_name].apply(self, args)
                } catch (e) { console.warn(e) }
            }
        }
        //把this 加在最後面，如果hanlder被bind到別的this時，可以取得此widget
        args.push(this)
        if (this.listener[name]) {
            args.shift()//remove name
            for (var func_name in self.listener[name]) {
                try {
                    self.listener[name][func_name].apply(self, args)
                } catch (e) { console.warn(e) }
            }
        }
    }
    , on: function (name, callback) {
        if (!this.listener[name]) {
            this.listener[name] = {}
        }
        var func_name = callback.name || ('f' + Widget.counter++)
        this.listener[name][func_name] = callback
        return func_name
    }
    , off: function (name, callback) {
        if (typeof (callback) == 'string') {
            delete this.listener[name][callback]
            if (this.listener[name].length == 0) delete this.listener[name]
        }
        else if (typeof (callback) == 'function') {
            var target_func_name;
            for (var func_name in this.listener[name]) {
                if (this.listener[name][func_name] === callback) {
                    target_func_name = func_name
                    break
                }
            }
            if (target_func_name) {
                delete this.listener[name][target_func_name]
                if (this.listener[name].length == 0) delete this.listener[name]
            }
        }
        else {
            delete this.listener[name]
        }
    }
    , on_dnd: function (data,evt) {
        //basically, redirect dnd to paste
        this.on_paste(data,evt)
    }
    , on_dnd_string: function (data,evt) {
        //basically, redirect dnd to paste
        this.on_paste(data,evt)
    }
    , on_paste: function (data,evt) {
    }
    , on_paste_string: function (data,evt) {
    }
    , sync: function (payload, do_normalize) {
        //unit's common sync function
        payload.id = this.id
        this.widget.sync(payload, do_normalize)
    }
    // only remove the unit's node from DOM
    , destroy: function () {
        if (this.ele) {
            this.ele.remove()
            this.ele = null
        }
        // 解除在this.widget.units當中的id註冊
        delete this.widget.units[this.id]
        // 通知子資源進行刪除(ex. YoutubeUnit's player)
        this.fire('destroyed')
    }
    , move: function (x, y) {
        if (!this.ele) return
        var drag_target_style = this.ele.style
        drag_target_style.left = x + 'px'
        drag_target_style.top = y + 'px'
        this.metadata.move = WidgetGallery.singleton.normalize({ x: x, y: y })
    }
    //make this unit draggable
    , draggable: function () {
        var self = this
        var drag_target = this.ele
        var x, y, parent_ele, effective_scale
        var dragger = document.createElement('div')
        dragger.classList.add('dragger')
        this.ele.appendChild(dragger)
        dragger.innerHTML = '⌘'
        interact(dragger).draggable({
            onstart: function (evt) {
                x = drag_target.offsetLeft
                y = drag_target.offsetTop
                drag_target.classList.add('freeze')
                parent_degree = self.widget.get_parent_degree() + self.widget.degree[2]
                effective_scale = self.widget.scale * self.widget.get_parent_scale() * parseFloat(WidgetGallery.singleton.widget_layer.dataset.scale)
            }
            , onmove: function (evt) {
                var dx = evt.dx, dy = evt.dy
                if (parent_degree) {
                    var dxy = Widget.utils.transform(dx, dy, -parent_degree)
                    dx = dxy[0]
                    dy = dxy[1]
                }
                x += Math.round(dx / effective_scale)
                y += Math.round(dy / effective_scale)
                self.move(x, y)
            }
            , onend: function (evt) {
                drag_target.classList.remove('freeze')
                self.sync({ topic: 'move', x: x, y: y }, true)
            }
        })
    }
    , zoom: function (scale) {
        if (!this.resizable_options) return
        //注意：本scale需是已經 denormalize過的scale
        if (this.resizable_options.scale_keep_size) {
            //讓scale_target保持一樣的尺寸，IframeUnit需要這個效果，YoutbueUnit不需要
            this.resizable_options.scale_target.style.width = Math.round(100 * 1 / scale) + '%'
            this.resizable_options.scale_target.style.height = Math.round(100 * 1 / scale) + '%'
        }
        this.resizable_options.scale_target.style.transform = 'scale(' + scale + ')'
    }
    , resize: function (w, h) {
        this.resizable_options.resize_target.style.width = w + 'px'
        this.resizable_options.resize_target.style.height = h + 'px'
        this.metadata.resize = WidgetGallery.singleton.normalize({ w: w, h: h })
        //TextboxUnit need this to fit_size
        this.fire('resize', { width:w, height: h})//, target: this.resizable_options.resize_target })
    }
    //make this unit resizable and scalable
    , resizable: function (options) {
        var self = this
        this.resizable_options = options
        var resize_target = options.resize_target
        var resize_in_ele = options.resize_in_ele
        var scale_target = options.scale_target
        //先不要取值，因為此時尚無值可取
        var ele_scale = null
        if (resize_target) {
            /* 這個方式比用::after穩定，::after經常會讓滑鼠黏住放不開*/
            this.resizer = this.ele.querySelector('.resizer')
            if (this.resizer) {
                //cloned or this function been called twice
            }
            else {
                this.resizer = document.createElement('div')
                this.resizer.classList.add('resizer')
                //this.resizer.innerHTML = '<span class="fa fa-expand"></span>' //⛢
                this.ele.appendChild(this.resizer)
            }

            //只能resize時，用方形的符號
            this.resizer.innerHTML = '<span>◲</span>'

            var rect, in_rect, w, h;
            var abs_degree, abs_scale, dx, dy
            var do_resize = _.throttle(function () {
                self.resize(w, h)
            })

            //release previous handler in case
            interact(this.resizer).draggable(false)

            interact(this.resizer).draggable({
                onstart: function (evt) {
                    if (ele_scale === null) ele_scale = (scale_target && scale_target.dataset && scale_target.dataset.scale) ? parseFloat(scale_target.dataset.scale) : 1
                    rect = { w: self.ele.clientWidth, h: self.ele.clientHeight }
                    abs_degree = self.widget.get_parent_degree() + self.widget.degree[2]
                    abs_scale = self.widget.scale * self.widget.get_parent_scale() * parseFloat(WidgetGallery.singleton.widget_layer.dataset.scale)
                    in_rect = resize_in_ele ? resize_in_ele.getBoundingClientRect() : { width: Infinity, height: Infinity }
                    resize_target.classList.add('freeze')
                    dx = 0
                    dy = 0
                }
                , onmove: function (evt) {
                    if (abs_degree) {
                        var dxy = Widget.utils.transform(evt.dx, evt.dy, - abs_degree)
                        dx += dxy[0]
                        dy += dxy[1]
                    }
                    else {
                        dx += evt.dx
                        dy += evt.dy
                    }
                    //if (preserveAspectRatio) dx = dy * preserveAspectRatio
                    var delta = {
                        dx: Math.round(100 * dx / abs_scale) / 100,
                        dy: Math.round(100 * dy / abs_scale) / 100
                    }
                    w = rect.w + delta.dx, h = rect.h + delta.dy
                    if (w < in_rect.width && h < in_rect.height) {
                        do_resize()
                    }
                }
                , onend: function () {
                    resize_target.classList.remove('freeze')
                    self.sync({ topic: 'resize', w: w, h: h }, true)
                }
            })
        }

        //避免註冊兩次
        if (this._scaling_handler)
            this.ele.removeEventListener('mousewheel', this._scaling_handler)

        if (scale_target) {

            //可以scale時，用圓形的符號
            this.resizer.innerHTML = '<span>◶</span>'

            //this is required to be scaled
            scale_target.style.transformOrigin = 'top left'
            scale_target.parentNode.style.textAlign = 'left'

            var unit_y = 2500 //sensetivity
            var do_sync = _.throttle(function (scale) {
                //往外同步與寫回metadata（下次reload時會用到），需正規化(除了YoutubeUnit)
                //YoutubeUnit 的特性是scale時保持一致，不必管widget.rel_scale
                var normalized_scale = self.resizable_options.static_scale ? scale : scale / self.widget.rel_scale
                self.metadata.scale = normalized_scale
                scale_target.dataset.scale = normalized_scale
                self.sync({ topic: 'scale', scale: normalized_scale, static: self.resizable_options.static_scale })
            }, 1000, { leading: false, trailing: true })

            //因為ele的scale可能在別地方被改變（ex state_restore)，所以三秒後重設ele_scale
            var reset_ele_scale = _.debounce(function(){
                ele_scale = null
            },3000)
            this._scaling_handler = function (evt) {

                //initial ele_scale ; 從scale_target.dataset取出前次normalized的scale,轉成denormalized的scale
                //ele_scale是目前scale的數值，讓scale的改變從現有scale開始，這樣會比較平滑
                if (ele_scale === null)
                    ele_scale = ((scale_target.dataset && scale_target.dataset.scale) ? parseFloat(scale_target.dataset.scale) : 1) * self.widget.rel_scale

                var min_scale = 0.3
                var max_scale = 10
                var scale = Math.floor(1000 * Math.min(max_scale, Math.max(min_scale, ele_scale + (evt.wheelDelta / unit_y)))) / 1000;
                //不要讓尺寸小於 10,
                var after_zoom_width = self.ele.clientWidth * scale
                var after_zoom_height = self.ele.clientHeight * scale
                if (after_zoom_height < 10 || after_zoom_width < 10) {
                    scale = Math.round(100 * Math.max(10 / self.ele.clientWidth, 10 / self.ele.clientHeight)) / 100
                }
                self.zoom(scale)
                ele_scale = scale
                do_sync(scale)

                //restart timer of resetting ele_scale
                reset_ele_scale.cancel()
                reset_ele_scale()
            }
            this.ele.addEventListener('mousewheel', this._scaling_handler)
        }
    }
    , hide:function(){
        if (this.ele) this.ele.style.display = 'none'
    }
    , show:function(){
        if (this.ele) this.ele.style.display = ''
    }
    , on_sync: function (data) {
        switch (data.topic) {
            case 'resize':
                this.resize(data.w, data.h)
                return true
            case 'move':
                this.move(data.x, data.y)
                return true
            case 'scale':
                this.resizable_options.scale_target.dataset.scale = data.scale
                this.metadata.scale = data.scale
                //YoutubeUnit 的特性是scale時保持一致，不必管widget.rel_scale
                var scale = data.static ? data.scale : data.scale * this.widget.rel_scale
                this.zoom(scale)
                return true
        }
        return false
    }
}

/* Template for creating a widget class
function SampleWidget(ele){
    Widget.call(this,ele)
    var self = this
    var self = this
}
SampleWidget.prototype = _.create(Widget.prototype,{
    constructor: SampleWidget,
    clone:function(parent_ele){
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是CardWidget
        var widget = Widget.prototype.clone.call(this,parent_ele,this.constructor.factory)
        return widget
    },
    serialize:function(for_clone){
        var data = Widget.prototype.serialize.call(this)
        return data
    },
    deserialize:function(data){
        Widget.prototype.deserialize.call(this,data)
        return this
    }
    ,reset:function(){
        Widget.prototype.reset.call(this)
    }
    ,on_paste:function(data,evt){
    }
    ,on_paste_string:function(text,evt){
    }
})
SampleWidget.metadata = {
    category:'general',
    caption:'Image Book', //display name for i18n
    description:'book-style box of images',
    icon:'fa fa-card',
    //information to render items on action-menu for user to take
    actions:[ 
    ],
    dashboard:[
    ]
}
SampleWidget.factory = function(ele,features){
    ele.setAttribute('kind','SampleWidget')
    if (typeof(features) == 'undefined') features = ['draggable','resizable','rotatable','zoomable','flippable']
    features.forEach(function(feature){ele.classList.add(feature)})
    return new SampleWidget(ele)
}
SampleWidget.create_sample = function(box){
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    if (box) box.appendChild(div)
    return SampleWidget.factory(div)
}
WidgetGallery.register(SampleWidget)
*/
function ImageUnit(widget, box) {
    var func_name = arguments.callee.name //TextBoxUnit
    GenericUnit.call(this, widget, box, func_name)
    //這可能可以視為一個系統常數
    if (this.ele) {
        this.image_ele = this.ele.querySelector('img')
    }
    else {
        this.create_ele({
            classname: func_name,
            style: {
                width: '200px'//widget_rect.width + 'px'
                , height: '200px'//widget_rect.height + 'px'
            }
        })
        this.image_ele = document.createElement('img')
        this.ele.appendChild(this.image_ele)
    }
    var self = this
    var set_base_rect = function () {
        //因為unit會放大跟縮放，在deserialize時候為了還原之前的狀態，load_url(image)之後需要有一個基準尺寸
        //這個基準尺寸是widget產生時的初始尺寸
        var widget_rect = {
            width: parseFloat(self.widget.ele.style.width),
            height: parseFloat(self.widget.ele.style.height)
        }
        self.ele.dataset.base_rect = JSON.stringify({ w: widget_rect.width, h: widget_rect.height })
    }
    if (WidgetGallery.singleton.context_ready) set_base_rect()
    else WidgetGallery.singleton.on('context-ready', set_base_rect)

    this.resizable({
        resize_target: this.ele,
        scale_target: this.image_ele,
    })
    this.draggable()

    this.on('destroyed', function () {
        //由WidgetGallery統一批次通知server，此unit被刪除了，需刪除他的圖檔
        WidgetGallery.singleton.remove_widget_file(self.id)
    })
}
ImageUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: ImageUnit
    , serialize: function (for_clone) {
        var data = GenericUnit.prototype.serialize.call(this, for_clone)
        return data
    }
    , deserialize: function (data, is_clone) {
        GenericUnit.prototype.deserialize.call(this, data, is_clone)
        var self = this
        //data is now self.metadata
        var call_with_context = function () {
            if (self.metadata.file) {
                if (is_clone) {
                    WidgetGallery.singleton.clone_widget_file({
                        file: self.metadata.file,
                        uuid: self.id
                    }).done(function (filename) {
                        self.metadata.file = filename
                        self.load_file(self.metadata.file, false)
                    }).fail(function (retcode, err_message) {
                        delete self.metadata.file
                        console.warn(err_message)
                    })
                }
                else {
                    self.load_file(self.metadata.file, false)
                }
            }
            else if (self.metadata.src) {
                self.load_url(self.metadata.src, false)
            }
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)
        return this
    }
    , get_actions: function () {
        var self = this
        return [
            /*
            {
                id: 'roll',
                type: 'button',
                text: 'Roll',
                icon: 'fa fa-trash',
                onClick: function (widget, toolbar) {
                }
            }
            */
        ]
    }
    , get_dashboard: function (dashboard) {
    }
    , get_info:function(){
        var filename = this.metadata.file 
        var src = filename ? WidgetGallery.singleton.presentation.current_slide.widget_manager.get_file_url(filename) : this.metadata.src
        var content = src ? '<img style="width:auto;max-height:50px" src="'+src+'"/>' : ''
        return {
            type:'Image',
            content: content
        }
    }
    /*
    , on_paste_string: function (text) {
        var self = this
        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            if (slide_resource.type == 'IMG' || (slide_resource.type == 'URL' && slide_resource.kind && slide_resource.kind.indexOf('image') == 0)) {
                self.load_url(slide_resource.url)
            }
        })
    }*/

    /* 此處不要發出sync事件，避免導致無限循環*/
    , load_url: function (url, add_to_metadata) {
        var self = this
        var promise = new $.Deferred()
        this.image_ele.onload = function () {
            _.defer(function () {
                var base_rect = JSON.parse(self.ele.dataset.base_rect)
                var h = base_rect.width * (self.image_ele.naturalHeight / self.image_ele.naturalWidth)
                self.image_ele.style.width = base_rect.width + 'px'
                self.image_ele.style.height = h + 'px'
                // 恢復前次的scale（需乘上本次的相對scale)
                var init_scale = typeof (self.metadata.scale) == 'undefined' ? 1 : self.metadata.scale
                var scale = self.widget.rel_scale * init_scale
                self.image_ele.style.transform = 'scale(' + scale + ')'
                self.image_ele.dataset.scale = scale
                // 通知內容有變動，可以讓dashboard的圖形清單（ex BoxUnit)更新
                self.fire('content')
                promise.resolve(true)
            }, 100)
        }
        this.image_ele.src = url
        //"_widget_ts" 是額外加的，不放入metadata
        if (add_to_metadata) {
            this.metadata.src = url.replace(/[&\?]_widget_ts=\d+/, '')
        }
        return promise
    }
    /* 
        此file 是在自己的server上的, 寫在metadata.file 而不是 metadata.src
        */
    , load_file:function(filename, add_timestamp) {
        var url = WidgetGallery.singleton.presentation.current_slide.widget_manager.get_file_url(filename)

        if (add_timestamp) {
            url += (/\?/.test(url) ? '&' : '?') + '_widget_ts=' + Math.round(Math.random() * 1000000)
        }
        this.load_url(url, false)
        this.metadata.file = filename
    }
    , on_sync: function (data) {
        // check default sync in advance
        if (GenericUnit.prototype.on_sync.call(this, data)) return

        switch (data.topic) {
        }
    }
})

/*
 * Text box
 * a unit for a widget to provide text feature
 */
function TextBoxUnit(widget, box) {
    var func_name = arguments.callee.name //TextBoxUnit
    GenericUnit.call(this, widget, box, func_name)
    if (this.ele) {
        //clone
        this.textbox = this.ele.querySelector('span')
    }
    else {
        this.create_ele({
            classname: func_name,
            style: {
                width: (this.widget.w - 20) + 'px'
                , height: '100px'
                , left: '10px'
                , top: '10px'
                , textAlign: 'center'
            }
        })
        this.textbox = document.createElement('span')
        this.ele.appendChild(this.textbox)
        this.reset()
    }
    //initial event listeners
    var self = this
    //initial value
    this.set_text('text')
    this.draggable()
    this.resizable({
        resize_target: this.ele
    })
    var self = this
    this.on('resize', function (data) {
        self.fit_fontsize()
    })
}
TextBoxUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: TextBoxUnit
    , font_family_options: [
        { id: 0, text: 'Georgia, serif' },
        { id: 1, text: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
        { id: 2, text: '"Times New Roman", Times, serif' },
        { id: 3, text: 'Arial, Helvetica, sans-serif' },
        { id: 4, text: '"Arial Black", Gadget, sans-serif' },
        { id: 5, text: '"Comic Sans MS", cursive, sans-serif' },
        { id: 6, text: 'Impact, Charcoal, sans-serif' },
        { id: 7, text: '"Lucida Sans Unicode", "Lucida Grande", sans-serif' },
        { id: 8, text: 'Tahoma, Geneva, sans-serif' },
        { id: 9, text: '"Trebuchet MS", Helvetica, sans-serif' },
        { id: 10, text: 'Verdana, Geneva, sans-serif' },
        { id: 11, text: '"Courier New", Courier, monospace' },
        { id: 12, text: '"Lucida Console", Monaco, monospace' }
    ]
    , deserialize: function (data, is_clone) {
        GenericUnit.prototype.deserialize.call(this, data, is_clone)
        var self = this
        $(self.textbox).css(self.metadata.css) //lazy implement
        var call_with_context = function () {
            //context-ready還不足以取得rect,再等下一輪，故defer
            _.defer(function(){
                self.set_text(self.metadata.text)
            })
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)

        return this
    }
    ,reset: function () {
        this.metadata.css.color = '#000000'
        this.metadata.css['fontFamily'] = this.font_family_options[0]
        this.metadata.scroll = { speed:250 }
        $(this.textbox).css(this.metadata.css) //lazy implement
        this.set_text('text')
    }
    ,get_actions:function(){
        var self = this
        return [
            {
                id: 'scroll',
                type: 'button',
                text: 'Scroll',
                icon: 'fa fa-undo',
                onClick: function (widget, toolbar) {
                    var yes = self.scrolling_timer ? false : true
                    toolbar.get('scroll').text = yes ? 'Stop' : 'Scroll'
                    toolbar.refresh('scroll')
                    self.scroll(yes).done(function(){
                        toolbar.get('scroll').text = 'Scroll'
                        toolbar.refresh('scroll')
                    })
                    self.sync({topic: 'scroll', yes:yes})
                }
            }
        ] 
    }
    ,get_dashboard:function(dashboard){
        //加到第一個tab的最後面
        var self = this
        dashboard[0].items.push([
            {
                type: 'range',
                label: 'Scroll Interval',
                tooltip: 'insert webcam to this face',
                icon: 'fa fa-camera',
                min:10,
                max:500,
                step:10,
                legend: '',
                get:function(widget){
                    return self.metadata.scroll.speed
                },
                set:function(widget,input_ele){
                    var value = input_ele.value
                    self.metadata.scroll.speed = parseInt(value)
                    self.sync({topic: 'scroll-speed', speed:parseInt(value)})
                }
            }
        ])
    }
    , get_info:function(){
        return {
            type:'Text',
            content:this.metadata.text.substring(0,20) + (this.metadata.text.length > 20 ? '...' : '')
        }
    }    
    , on_paste_string: function (text) {
        this.set_text(text)
        this.widget.update_handles()
    }
    , on_sync: function (data) {
        //來自遠端對應的unit傳來同步訊息
        if (GenericUnit.prototype.on_sync.call(this, data)) return
        var self = this
        //console.log('sync>>', data)
        switch (data.topic) {
            case 'scroll':
                this.scroll(data.yes)
                break
            case 'scroll-speed':
                this.metadata.scroll.speed = data.speed
                break
        }
    }
    , set_text: function (content) {
        this.textbox.innerText = content
        this.metadata.text = content
        if (content) {
            this.ele.style.display = ''
            this.fit_fontsize()
        }
        else {
            this.ele.style.display = 'none'
        }
        this.fire('content')
    },
    /*
    editable:function(yes){
        this.textbox.contentEditable = yes
        WidgetGallery.singleton.presentation.keyboard_shortcut.suspend = yes
        if (yes){
            var self = this
            this.textbox.oninput = function(evt){
                self.fit_fontsize()
            }
            //失焦時，自動關閉編輯
            this._unedit = this.on('unselected',function(){
                self.edit_text(false)
                delete self._unedit
            })
            //要這樣，不然會觸發unselected事件
            this.textbox.focus()
        }
        else{
            if (this._unedit) this.off('unselected',this._unedit)
            this.textbox.oninput = null
        }
    },*/
    fit_fontsize: function () {
        var t = this.textbox
        var rect = this.ele.getBoundingClientRect()
        // in display='none' state, such as been cloned when collapsed
        // don't fit size under this state
        if (!rect.height) return
        var rect_t //should adjust to degree later
        var curr_size = parseInt(t.style.fontSize) || 9
        var direction = 0 //samll to big
        for (var size = curr_size; size >= 9 && size <= 900; size += direction) {
            t.style.lineHeight =
                t.style.fontSize = size + 'px'
            rect_t = t.getBoundingClientRect()
            var smaller = rect_t.width <= rect.width && rect_t.height <= rect.height
            var bigger = !smaller
            if (smaller && (direction == 1 || direction == 0)) {
                direction = 1
                continue
            }
            else if (bigger && (direction == -1 || direction == 0)) {
                direction = -1
                continue
            }
            else if (bigger && direction == 1) {
                t.style.lineHeight =
                    t.style.fontSize = (size - 1) + 'px'
                break
            }
            else if (smaller && direction == -1) {
                break
            }
        }
        this.metadata.css.fontsize = this.textbox.style.fontSize
    }
    ,scroll:function(yes){
        if (!yes){
            if (this.scrolling_timer) clearInterval(this.scrolling_timer)
            delete this.scrolling_timer
            this.textbox.innerText = this.metadata.text
            return $.when()
        }
        var promise = new $.Deferred()
        var self = this
        this.scrolling_timer = 0
        var text =  this.metadata.text
        this.textbox.innerHTML = ''
        var cursor = 0, end = text.length
        var scrolling = function(){
            if (cursor >= end) {
                clearInterval(self.scrolling_timer)
                delete self.scrolling_timer
                promise.resolve()
                return
            }
            var span = document.createElement('span')
            span.innerText = text.substr(cursor,1)
            self.textbox.appendChild(span)
            cursor += 1
        }
        self.scrolling_timer = setInterval(scrolling,this.metadata.scroll.speed)
        return promise
    }
})


function CardUnit(widget, box) {
    /* This is a more likely "wrapper-unit" for ImageUnit, IframeUnit, ... */
    var func_name = arguments.callee.name
    GenericUnit.call(this, widget, box, func_name)
    //本unit 沒有 this.ele
    var self = this
    this.supported_units = [YoutubeUnit, WebcamUnit, ImageUnit, TextBoxUnit, IframeUnit]
    this.empty_card = box.querySelector('.unit.empty-card')
    this.unit = null
    if (this.empty_card) {
        //cloned when card is emtpy
    }
    else {
        this.empty_card = document.createElement('div')
        this.empty_card.classList.add('unit', 'empty-card')
        this.supported_units.some(function (unit_class) {
            if (box.querySelector('.' + unit_class.name)) {
                //self.unit = 
                self.set_unit(new unit_class(self.widget, self.box))
                return true
            }
        })
        if (self.unit) {
            //cloned when card has content unit
        }
        else {
            //a blank new instance of the CardUnit
            this.box.appendChild(this.empty_card)
        }
    }
}
CardUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: CardUnit
    , serialize: function (for_clone) {
        var data = GenericUnit.prototype.serialize.call(this)
        if (this.unit) data.units = [this.unit.serialize(for_clone)]
        return data
    }
    , deserialize: function (data, is_clone) {
        GenericUnit.prototype.deserialize.call(this, data, is_clone)
        if (data.units) {
            //this.box.removeChild(this.empty_card)
            this.empty_card.remove()
            var self = this
            self.supported_units.some(function (unit_class) {
                if (unit_class.name == data.units[0].classname) {
                    self.set_unit(new unit_class(self.widget, self.box))
                    self.unit.deserialize(data.units[0], is_clone)
                    return true
                }
            })
        }
    }
    , get_actions: function () {
        if (this.unit === null) return []
        else return this.unit.get_actions()
    }
    , get_dashboard: function (dashboard) {
        if (this.unit === null) return
        this.unit.get_dashboard(dashboard)
    }
    , on_paste_string: function (text) {
        var self = this

        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            if (slide_resource.type == 'FILE'){
                self.on_paste({
                    is_file:true,
                    file:slide_resource.file,
                    mimetype:slide_resource.kind
                })
            }
            else if (slide_resource.type == 'VIDEO' && slide_resource.kind == 'YT') {
                if (self.unit && self.unit.constructor.name == 'YoutubeUnit') {
                    //reuse exiting unit
                }
                else {
                    self.reset_unit(true)
                    self.set_unit(new YoutubeUnit(self.widget, self.box))
                }
                self.unit.load_video(slide_resource.vid)
                // sync to remote
                var metadata = self.unit.serialize(false)
                // 這是不等load_url完成才取unit.serialized()之下的權宜作法
                metadata.video_id = slide_resource.vid
                //self.widget.sync({ id: self.id, topic: 'new-unit', metadata: metadata })
                self.sync({topic: 'new-unit', metadata: metadata })
            }
            else if (slide_resource.kind && slide_resource.kind.indexOf('image') == 0){
                //image
                var handle_image = function(url){
                    var sync_data = {}
                    if (self.unit && self.unit.constructor.name == 'ImageUnit') {
                        //reuse exiting unit, do nothing
                        sync_data.topic = 'tainted'
                    }
                    else {
                        self.reset_unit(true)
                        self.set_unit(new ImageUnit(self.widget, self.box))
                        sync_data.topic = 'new-unit'
                    }
                    //second parameter "true" means "add to metadata"
                    self.unit.load_url(slide_resource.url, true).done(function () {
                        // sync to remote
                        if (sync_data.topic == 'new-unit') {
                            sync_data.metadata = self.unit.serialize(false)
                            // 這是不等load_url完成才取unit.serialized()之下的權宜作法
                            sync_data.metadata.src = slide_resource.url
                        }
                        else sync_data.url = slide_resource.url
                        self.sync(sync_data)
                    })    
                }
                if (slide_resource.type == 'URL'){
                    handle_image(slide_resource.url)
                }
            }
            else if (slide_resource.type == 'URL') {
                if (self.unit && self.unit.constructor.name == 'IframeUnit') {
                    //reuse exiting unit
                }
                else {
                    self.reset_unit(true)
                    self.set_unit(new IframeUnit(self.widget, self.box))
                }
                self.unit.load_url(slide_resource.url).done(function () {
                    // sync to remote
                    var metadata = self.unit.serialize(false)
                    // 這是不等load_url完成才取unit.serialized()之下的權宜作法
                    metadata.src = slide_resource.url
                    self.sync({topic: 'new-unit', metadata: metadata })
                })
            }
            else {
                if (self.unit && self.unit.constructor.name == 'TextBoxUnit') {
                    //reuse exiting unit
                }
                else {
                    self.reset_unit(true)
                    self.set_unit(new TextBoxUnit(self.widget, self.box))
                }
                self.unit.set_text(text)
                // sync to remote
                var metadata = self.unit.serialize(false)
                // 這是不等load_url完成才取unit.serialized()之下的權宜作法
                metadata.text = text
                self.sync({topic: 'new-unit', metadata: metadata })
            }

            _.delay(function(){
                //request re-render dashboard; wait a while for some unit to be ready. (ex. youtube unit)
                WidgetGallery.singleton.update_dashboard(self.widget)
            },500)
        })
    }
    , on_paste: function (data) {
        var self = this
        var promise = new $.Deferred()
        if (data.is_file) {
            if (data.mimetype.indexOf('image/') == 0) {
                /* 上傳到系統前，先做圖形處理*/
                WidgetGallery.singleton.preprocess_file(data.file).done(function (file) {
                    /*此處也要處理將現有的image刪除的問題*/
                    if (self.unit && self.unit.constructor.name == 'ImageUnit') {
                        //use existing one
                        topic = 'tainted'
                    }
                    else {
                        topic = 'new-unit'
                        self.reset_unit(true)
                        self.set_unit(new ImageUnit(self.widget, self.box))
                    }
                    /* 上傳到系統*/
                    WidgetGallery.singleton.upload_widget_file({
                        file: file,
                        name: file.name,
                        uuid: self.unit.id
                    }).done(function (filename) {
                        self.unit.load_file(filename, topic == 'tainted')
                        var sync_data = { topic: topic }
                        if (topic == 'new-unit') {
                            sync_data.metadata = self.unit.serialize(false)
                        }
                        else {
                            sync_data.file = filename
                        }
                        self.sync(sync_data)
                        promise.resolve(true)
                    }).fail(function(err){
                        console.warn(err)
                    })
                })
            }
            else promise.reject('not supported')
        }
        else {
            promise.reject('not supported')
        }
        return promise
    }
    , on_sync: function (data) {
        //來自遠端對應的unit傳來同步訊息
        if (GenericUnit.prototype.on_sync.call(this, data)) return
        var self = this
        console.log('CardUnit sync>>', data)
        switch (data.topic) {
            case 'new-unit':
                var metadata = data.metadata
                self.reset_unit(true) //true means not to add "empty-card"
                self.supported_units.some(function (unit_class) {
                    if (metadata.classname == unit_class.name) {
                        self.set_unit(new unit_class(self.widget, self.box))
                        self.unit.deserialize(metadata)
                        return true
                    }
                })
                break
            case 'tainted':
                if (data.file) this.unit.load_file(data.file)
                else if (data.url) this.unit.load_url(data.url,true)
                break
            case 'reset-unit':
                self.reset_unit()
                break

        }
    }
    , destroy(){
        GenericUnit.prototype.destroy.call(this)
        if (this.unit) this.unit.destroy()
    }
    , hide:function(){
        if (this.unit) this.unit.hide()
    }
    , show:function(){
        if (this.unit) this.unit.show()
    }    
    , set_unit:function(unit){
        this.unit = unit
        var self = this
        //divert unit's content event
        this.unit.on('content',function(){
            self.fire('content')
        })
    }
    , reset_unit: function (no_empty_card) {
        //remove current unit and add an empty_card unless no_empty_card is true
        //aka reset to initial state
        if (this.unit) {
            this.unit.destroy()
            this.unit = null
        }
        if (no_empty_card) {
            if (this.empty_card.parentNode == this.box) {
                //this.box.removeChild(this.empty_card)
                this.empty_card.remove()
            }
        }
        else {
            this.box.appendChild(this.empty_card)
        }
    }
    , insert_webcam_unit: function () {
        //don't insert twice
        if (this.unit && this.box.querySelector('.webcam-unit')) return
        this.reset_unit()
        this.unit = new WebcamUnit(this.widget, this.box)
        var self = this
        var promise = new $.Deferred()
        self.unit.play().done(function () {
            WidgetGallery.singleton.update_dashboard(self.widget)
            promise.resolve(true)
        }).fail(function (err_message) {
            self.reset_unit()
            promise.reject(err_message)
        })
        return promise
    }
    , move: function (x, y) {
        if (this.unit) this.unit.move(x,y)
    }

})


var CardWidget = function(ele) {
    /* 單張卡片，可以貼各種素材 */
    Widget.call(this, ele)
    //預設一個容易辨識的顏色
    //this.css('backgroundColor','#a0a0a0')

    this.unit = new CardUnit(this, this.box)
    var self = this
}
CardWidget.prototype = _.create(Widget.prototype, {
    constructor: CardWidget
    , clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是FlipCardWidget
        var widget = Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
        return widget
    }
    , serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this, for_clone)
        data.units = [this.unit.serialize(for_clone)]
        return data
    }
    , deserialize: function (data, is_clone) {
        Widget.prototype.deserialize.call(this, data, is_clone)
        this.unit.deserialize(data.units[0], is_clone)
        return this
    }
    , on_sync: function (data) {
        //處理遠端widget傳來同步訊息
        if (Widget.prototype.on_sync.call(this, data)) return
        switch(data.on){
        }
    }
    , on_paste_string: function (text, evt) {
        this.unit.on_paste_string(text, evt)
    }
    , on_paste: function (data, evt) {
        this.unit.on_paste(data, evt)
    }
    , get_actions: function () {
        return this.unit.get_actions()
    }
    , get_dashboard: function (dashboard_items) {
        var self = this
        dashboard_items.push(
            {
                id: 'card',
                text: 'Card',
                items: [
                   [
                        {
                            type: 'button',
                            label: 'Insert Webcam',
                            tooltip: 'insert webcam to this face',
                            icon: 'fa fa-camera',
                            button_label: '',
                            legend: '',
                            onClick: function (widget) {
                                self.unit.insert_webcam_unit()
                            }
                        }
                    ]
                ]//end of items
            }
        )
        this.unit.get_dashboard(dashboard_items)
    }
})
CardWidget.metadata = {
    category: 'general',
    caption: 'Card', //display name for i18n
    description: 'The Card is a single face widget. It can display \
        text, image, Youtube video, web-cam and webpage in IFrame. Please be noted, not every URL\
        can be loaded into an IFrame.',
    video:'xSglOJP1OtY', //video id
    icon: 'fa fa-image',
}
CardWidget.factory = function (ele, features) {
    ele.setAttribute('kind', 'CardWidget')
    if (typeof (features) == 'undefined') features = ['draggable', 'resizable', 'rotatable', 'zoomable']
    features.forEach(function (feature) { ele.classList.add(feature) })
    return new CardWidget(ele)
}
CardWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    if (box) box.appendChild(div)
    return CardWidget.factory(div)
}
WidgetGallery.register(CardWidget)

function FlipCardUnit(widget, box) {
    //GenericUnit.call(this, widget, box)
    var func_name = arguments.callee.name
    GenericUnit.call(this, widget, box, func_name)    
    var self = this
    this.box.classList.add('flippable')
    this.flipper_ele = this.box.querySelector('.flipper')
    if (this.flipper_ele) {
        //cloned
        this.front_ele = this.flipper_ele.querySelector('.front')
        this.front_unit = new CardUnit(this.widget, this.front_ele)
        this.back_ele = this.flipper_ele.querySelector('.back')
        this.back_unit = new CardUnit(this.widget, this.back_ele)
        this.is_front = this.front_ele.classList.contains('flipped') ? false : true
    }
    else {
        //this.box.style.overflow = 'hidden';//讓圓形邊界有作用
        this.flipper_ele = document.createElement('div')
        this.flipper_ele.classList.add('flipper')
        this.box.appendChild(this.flipper_ele)

        this.front_ele = document.createElement('div')
        this.front_ele.classList.add('front')
        this.flipper_ele.appendChild(this.front_ele)
        this.front_unit = new CardUnit(this.widget, this.front_ele)

        this.back_ele = document.createElement('div')
        this.back_ele.classList.add('back')
        this.flipper_ele.appendChild(this.back_ele)
        this.back_unit = new CardUnit(this.widget, this.back_ele)

        this.is_front = true //default is front face
    }
    this.metadata.flip_options = {
        direction: 'h',
        speed: 0.3,
        is_front: true,
        origin: [50, 50]//center 50%, 50%
    }
    //this.unit is a symbolic link 
    this.unit = (this.is_front ? this.front_unit : this.back_unit)


    this.on('destroyed', function () {
        //self.front_unit.destroy()
        //self.back_unit.destroy()
    })

    this.widget.on('origin', function () {
        //self.update_flip_options({direction:self.flip_options.direction})
    })
    this.widget.on('resize', function (data) {

    })

}
FlipCardUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: FlipCardUnit
    , serialize: function (for_clone) {
        var data = GenericUnit.prototype.serialize.call(this)
        data.units = [
            this.front_unit.serialize(for_clone)
            , this.back_unit.serialize(for_clone)
        ]
        data.flip_options = this.metadata.flip_options
        return data
    }
    , deserialize: function (data, is_clone) {
        GenericUnit.prototype.deserialize.call(this, data, is_clone)
        this.back_unit.deserialize(data.units[1], is_clone)
        this.front_unit.deserialize(data.units[0], is_clone)

        var self = this
        var call_with_context = function () {
            if (!self.metadata.flip_options.is_front) self.flip()
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)
    }
    , state_save:function(){
        return _.cloneDeep(this.metadata.flip_options)
    }
    , state_restore:function(data){
        /*
        direction: 'h',
        speed: 0.3,
        is_front: true,
        origin: [50, 50]//center 50%, 50%
        */
        this.metadata.flip_options.direction = data.direction
        this.metadata.flip_options.speed = data.speed
        this.metadata.flip_options.origin = data.origin
        if (this.metadata.flip_options.is_front != data.is_front){
            this.flip() //toggle
        }
    }
    , get_actions: function () {
        var self = this
        var actions = [
            {
                id: 'flip',
                type: 'button',
                text: 'Flip',
                icon: 'fa fa-undo',
                onClick: function (widget, toolbar) {
                    self.flip()
                    self.widget.sync({ id: self.id, topic: 'flip', go_back: (self.is_front ? false : true) })
                }
            }
        ]
        return _.concat(actions, this.unit.get_actions())
    }
    , get_dashboard: function (dashboard) {
        var self = this
        dashboard.push(
            {
                id: 'flipcard',
                text: 'FlipCard',
                items: [
                    [
                        {
                            type: 'range',
                            min: 0.1,
                            max: 5,
                            step: 0.1,
                            label: 'Flipping Speed',
                            legend: '',
                            get: function (widget) {
                                return self.metadata.flip_options.speed
                            },
                            set: function (widget, input_ele) {
                                var value = input_ele.value
                                self.change_options({ speed: value })
                                self.sync({ topic: 'options', options: { speed: value } })
                            }
                        }
                        , {
                            type: 'list',
                            label: 'Direction',
                            options: {
                                items: [
                                    { id: 'h', text: 'Horizental' }
                                    , { id: 'v', text: 'Vertical' }
                                ]
                                , selected: null
                            }, //if given here, should be id
                            legend: '',
                            get: function (widget) {
                                //when options.selected is null or undefined,
                                //this get() will be called, should return item's value, not item's id
                                //otherwise a new option will be created
                                //return widget.flip_options.direction == 'v' ? 'Vertical' : 'Horizental'
                                return self.metadata.flip_options.direction
                            },
                            set: function (widget, input_ele) {
                                var value = input_ele.value
                                self.change_options({ direction: value.id })
                                self.sync({ topic: 'options', options: { direction: value.id } })
                            }
                        },
                        , {
                            type: 'button',
                            label: 'Remove face',
                            icon: 'fa fa-backspace',
                            tooltip: 'remove content of current face',
                            button_label: self.is_front ? 'Front' : 'Back',
                            legend: '',
                            onClick: function (widget) {
                                self.unit.reset_unit()
                                self.unit.sync({ topic: 'reset-unit' })
                            }
                        }
                    ]
                    , [{
                        type: 'button',
                        label: 'Insert Webcam',
                        tooltip: 'insert webcam to this face',
                        icon: 'fa fa-camera',
                        button_label: '',
                        legend: '',
                        onClick: function (widget) {
                            self.unit.insert_webcam_unit()
                            //self.unit.sync({topic:'reset-unit'})
                        }
                    }
                    ]
                ]//end of items
            }
        )
        this.unit.get_dashboard(dashboard)
    }
    , on_paste_string: function (text) {
        this.unit.on_paste_string(text)
    }
    , on_paste: function (data) {
        this.unit.on_paste(data)
    }
    , change_options: function (options) {
        for (var name in options) {
            this.metadata.flip_options[name] = options[name]
            switch (name) {
                case 'speed':
                    this.flipper_ele.style.transition = this.metadata.flip_options['speed'] + 's'
                    break
                case 'direction':
                    var bbox = this.widget.get_bbox()
                    if (this.metadata.flip_options['direction'] == 'v') {
                        this.flipper_ele.classList.add('vertical')
                        this.flipper_ele.style.transformOrigin = '100% ' + Math.round(this.metadata.flip_options.origin[1] / 100 * bbox.height) + 'px'
                    }
                    else {
                        this.flipper_ele.classList.remove('vertical')
                        this.flipper_ele.style.transformOrigin = Math.round(this.metadata.flip_options.origin[0] / 100 * bbox.width) + 'px 100%'
                    }
                    break
            }
        }
    }
    , on_sync: function (data) {
        //來自遠端對應的unit傳來同步訊息
        switch (data.topic) {
            case 'flip':
                this.flip(data.go_back)
                break
            case 'options':
                this.change_options(data.options)
                break
        }
    }
    , flip: function (yes) {
        //這裡不發出同步事件，避免無限循環
        var self = this
        //if yes is not given, do toggle 
        var go_back = (typeof (yes) == 'undefined') ? this.is_front : yes
        if (go_back) this.flipper_ele.classList.add('flipped')
        else this.flipper_ele.classList.remove('flipped')
        this.unit.fire('hide') //inform current unit that it is hidden
        this.unit = go_back ? this.back_unit : this.front_unit
        this.unit.fire('show')//inform new focus unit that it is shown
        this.is_front = !go_back
        this.metadata.flip_options.is_front = this.is_front
        this.fire('flip', go_back)
        //request re-render dashboard; wait a while to allow unit to response to "hide/show" (ex. YoutubeUnit)
        setTimeout(function () { WidgetGallery.singleton.update_dashboard(self.widget) }, 100)
    }
})

var FlipCardWidget = function(ele) {
    /* 單張可翻面卡片，可以貼各種素材 */
    Widget.call(this, ele)
    //預設一個容易辨識的顏色
    this.css('backgroundColor','#c0c0c0')

    this.unit = new FlipCardUnit(this, this.box)
    var self = this

    /* 有unit的widget,須將unit的tainted事件轉發成此類型的自己的tainted事件*/
    // 好像用不到了？
    /*
    this.unit.on('tainted', function (data) {
        self.fire('tainted', { target: 'unit', payload: data })
    })
    */
}
FlipCardWidget.prototype = _.create(Widget.prototype, {
    constructor: FlipCardWidget
    , clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是FlipCardWidget
        var widget = Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
        return widget
    }
    , serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this, for_clone)
        data.units = [this.unit.serialize(for_clone)]
        return data
    }
    , deserialize: function (data, is_clone) {
        Widget.prototype.deserialize.call(this, data, is_clone)
        this.unit.deserialize(data.units[0], is_clone)
        return this
    }
    , on_sync: function (data) {
        //處理遠端widget傳來同步訊息
        if (Widget.prototype.on_sync.call(this, data)) return
        /*
        switch(data.on){
            case 'move':
                this.move(data.x,data.y)
                break
        }
        */
    }
    , on_paste_string: function (text, evt) {
        this.unit.on_paste_string(text, evt)
    }
    , on_paste: function (data, evt) {
        this.unit.on_paste(data, evt)
    }
    , get_actions: function () {
        return this.unit.get_actions()
    }
    , get_dashboard: function (dashboard) {
        this.unit.get_dashboard(dashboard)
    }
})
FlipCardWidget.metadata = {
    category: 'general',
    caption: 'Flip-card', //display name for i18n
    description: 'The Flip-card is a two-face widget. Both front and back faces can display \
        text, image, Youtube video, web-cam and webpage in IFrame. Please be noted, not every URL\
        can be loaded into an IFrame.',
    video:'gy5Ys3UVOMU',
    icon: 'fa fa-images'
}
FlipCardWidget.factory = function (ele, features) {
    ele.setAttribute('kind', 'FlipCardWidget')
    if (typeof (features) == 'undefined')
        features = ['draggable', 'resizable', 'rotatable', 'zoomable', 'flippable']
    features.forEach(function (feature) { ele.classList.add(feature) })
    return new FlipCardWidget(ele)
}
FlipCardWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    if (box) box.appendChild(div)
    return FlipCardWidget.factory(div)
}
WidgetGallery.register(FlipCardWidget)

/*
* Multiple-cards
* Box-Unit and Box-Widget
*/
function BoxUnitSlideshow(boxunit){
    this.boxunit = boxunit
    this.units = this.boxunit.units
    this.metadata = {
        show:false, //true if started
        pos:-1,//initial hide
        in:'0',//none,
        out:'0',//none,
        at:'0'//same place
    }

}
BoxUnitSlideshow.prototype = {
    serialize:function(for_clone){
        return _.cloneDeep(this.metadata)
    }
    ,deserialize:function(data,is_clone){
        this.metadata = _.cloneDeep(data)
        if (this.metadata.show) {
            //在showing的半途，追上進度
            var self = this
            var count = this.metadata.pos
            _.defer(function(){
                self.start()
                for (var i=0;i<=count;i++){
                    self.next()
                }    
            })
        }
    }
    ,start:function(){
        this.boxunit.ele.style.overflow = 'visible' //default is hidden
        this.boxunit.widget.box.style.overflow = 'visible' ///default is hidden

        this.metadata.show = true
        this.metadata.pos = -1
        var self = this
        var offset_x = 0, offset_y = 0
        this.units.forEach(function(unit){
            self.move_unit(unit,offset_x,offset_y)

            self.show_unit(unit,true)
            var rect = getActuralRect(unit.box)
            unit.box.dataset.width = rect.width
            unit.box.dataset.height = rect.height
            //計算下一張的位置
            if (self.metadata.at == 't'){
                offset_y -= rect.height
            }
            else if (self.metadata.at == 'r'){
                offset_x += rect.width
            }
            else if (self.metadata.at == 'b'){
                offset_y += rect.height
            }
            else if (self.metadata.at == 'l'){
                offset_x -= rect.width
            }
            self.show_unit(unit,false)
        })    
    }
    ,next:function(dst_pos){
        //anitmation features, see https://github.com/daneden/animate.css
        var self = this
        
        var prev_unit = null, prev_unit_idx = null, next_unit = null, next_unit_idx = null
        if (this.metadata.pos >= 0){
            prev_unit_idx  = this.metadata.pos
            prev_unit = this.units[this.metadata.pos]
        }
        if (this.metadata.pos < this.units.length - 1) {
            this.metadata.pos += 1
            next_unit_idx = this.metadata.pos
            next_unit = this.units[this.metadata.pos]
        }
        

        var slide_in = function(unit_idx){
            var unit = self.units[unit_idx]
            var speed_class='faster', animation_name
            self.show_unit(unit,true)

            var animationend = function(){
                unit.box.classList.remove('animated',speed_class,animation_name)
                unit.box.removeEventListener('animationend',animationend)
            }
            var animation_name;
            Constant.in_styles.some(function(item){
                if (self.metadata.in == item.id){
                    animation_name = item.name
                    return true
                }
            })
            switch(self.metadata.in){
                case '0':
                    break
                default:
                    unit.box.addEventListener('animationend',animationend)
                    unit.box.classList.add('animated',speed_class,animation_name)
            }
        }
        var slide_out = function(unit_idx,callback){
            var unit = self.units[unit_idx]
            var next_unit = unit_idx == self.units.length - 1 ? null : self.units[unit_idx+1]
            var prev_speed_class='faster', prev_animation_name
            var prev_animationend = function(){
                this.box.classList.remove('animated',prev_speed_class,prev_animation_name)
                this.box.removeEventListener('animationend',this._handler)
                if (this.hide_unit_flag) self.show_unit(this,false)
                if (this.call_callback_flag) callback()
                delete this.hide_unit_flag
                delete this.call_callback_flag
                delete this._handler
            }
            var prev_animation_name;
            Constant.out_styles.some(function(item){
                if (self.metadata.out == item.id){
                    prev_animation_name = item.name
                    return true
                }
            })            
            switch(self.metadata.out){
                case '0':
                    self.show_unit(unit,false)
                    callback()
                    break
                case 'no':
                    callback()
                    break                    
                case 'sr':
                    //prev_animation_class = 'slideInLeft'
                    var offset = parseFloat(next_unit.box.dataset.width)
                    for (var i=0;i<=unit_idx;i++){
                        var _unit = self.units[i]
                        var top = parseFloat(_unit.box.style.top)
                        var left = parseFloat(_unit.box.style.left)
                        /* No amimation
                        _unit.hide_unit_flag = false
                        if (i == unit_idx) {
                            _unit.call_callback_flag = false
                        }
                        else {
                            _unit.call_callback_flag = false
                        }                        
                        _unit._handler = prev_animationend.bind(_unit)
                        _unit.box.addEventListener('animationend',_unit._handler)
                        self.move_unit(_unit,left+offset,top)
                        _unit.box.classList.add('animated',prev_speed_class,prev_animation_class) 
                        */
                        self.move_unit(_unit,left+offset,top)
                    }
                    callback()
                    break
                case 'sl':
                    var offset = parseFloat(next_unit.box.dataset.width)
                    for (var i=0;i<=unit_idx;i++){
                        var _unit = self.units[i]
                        var top = parseFloat(_unit.box.style.top)
                        var left = parseFloat(_unit.box.style.left)
                        self.move_unit(_unit,left-offset,top)
                    }
                    callback()
                    break
                case 'st':
                    var offset = parseFloat(next_unit.box.dataset.height)
                    for (var i=0;i<=unit_idx;i++){
                        var _unit = self.units[i]
                        var top = parseFloat(_unit.box.style.top)
                        var left = parseFloat(_unit.box.style.left)
                        self.move_unit(_unit,left,top-offset)
                    }
                    callback()
                    break 
                case 'sb':
                    var offset = parseFloat(next_unit.box.dataset.height)
                    for (var i=0;i<=unit_idx;i++){
                        var _unit = self.units[i]
                        var top = parseFloat(_unit.box.style.top)
                        var left = parseFloat(_unit.box.style.left)
                        self.move_unit(_unit,left,top+offset)
                    }
                    callback()
                    break
                default:
                    unit.call_callback_flag = true
                    unit.hide_unit_flag = true
                    unit._handler = prev_animationend.bind(unit)
                    unit.box.addEventListener('animationend',unit._handler)
                    unit.box.classList.add('animated',prev_speed_class,prev_animation_name)
                    break                                     
            }
        }
        if (next_unit) {
            //first unit has no prev_unit
            if (prev_unit){
                slide_out(prev_unit_idx,function(){
                    //last unit has no next_unit
                    slide_in(next_unit_idx)
                })    
            }
            else slide_in(next_unit_idx)
        }
        else if (prev_unit){
            //last slide
            slide_out(prev_unit_idx,function(){
            })
        }
        return next_unit ? true : false
    }
    ,stop:function(){
        this.boxunit.ele.style.overflow = ''//restore to default (hide)
        this.boxunit.widget.box.style.overflow = '' //restore to default (hide)
        this.metadata.show = false
        this.metadata.pos = -1
        //show all at stop()
        var self = this
        this.units.forEach(function(unit){
            self.show_unit(unit,true)
        })
    }
    ,move_unit:function(unit,x,y){
        //unitity function
        unit.box.style.left = x+'px'
        unit.box.style.top = y+'px'
    }
    ,show_unit:function(unit,yes){
        //unitity function
        unit.box.style.display = yes ? '' : 'none'
    }  
}

function BoxUnit(widget, box) {
    var func_name = arguments.callee.name //WebcamUnit
    GenericUnit.call(this, widget, box, func_name)
    if (this.ele) {
        //cloned
    }
    else {
        this.create_ele({
            classname: func_name,
            style: {
                width: '100%'
                , height: '100%'
            }
        })
        this.box.appendChild(this.ele)
    }
    this.ele.style.pointerEvents = 'none'
    this.units = []
    this.metadata.cursor = -1 //current focus image (unit),for navigation
    this.slideshow = new BoxUnitSlideshow(this)
}

BoxUnit.prototype = _.create(GenericUnit.prototype, {
    constructor:BoxUnit
    ,serialize:function(for_clone){
        var data = GenericUnit.prototype.serialize.call(this,for_clone)
        var units = []
        this.units.forEach(function(unit){
            units.push(unit.serialize(for_clone))
        })
        data.units = units
        data.slideshow = this.slideshow.serialize(for_clone)
        return data
    }
    ,deserialize:function(data,is_clone){
        GenericUnit.prototype.deserialize.call(this,data, is_clone)
        /* 本函式要負責從serialized的data把widget的內容生回來*/
        var self = this
        var call_with_context = function () {
            data.units.forEach(function(unit_data,idx){
                var unit = self.add_unit(unit_data)
            })
            self.slideshow.deserialize(data.slideshow,is_clone)
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)
    }
    , get_actions:function(){
        if (this.units.length == 0) return []
        var self = this
        return [
            {
                id: 'start',
                type: 'button',
                text:  self.slideshow.metadata.show ? 'Next' : 'Start',
                icon: 'fa fa-play',
                tooltip:'start slide show',
                onClick: function (widget, toolbar) {

                    if (self.slideshow.metadata.show){
                        if (!self.slideshow.next()){
                            // no more next unit
                            toolbar.disable('start')
                        }
                        self.sync({topic:'slideshow',do:'next'})//,pos:self.slideshow.metadata.pos})
                    }
                    else{
                        self.slideshow.start()
                        self.sync({topic:'slideshow',do:'start'})
                        //update GUI
                        toolbar.get('start').text = 'Next'
                        toolbar.refresh('start')
                        toolbar.enable('stop')
                    }
                }
            }
            ,{
                id: 'stop',
                type: 'button',
                text:'Stop',
                disabled: !self.slideshow.metadata.show,
                icon: 'fa fa-pause',
                tooltip:'stop slide show',
                onClick: function (widget, toolbar) {
                    self.slideshow.stop()
                    self.sync({topic:'slideshow',do:'stop'})
                    toolbar.disable('stop')
                    toolbar.enable('start')
                    toolbar.get('start').text = 'Start'
                    toolbar.refresh('start')
                }
            }
        ]
    }
    ,get_dashboard:function(dashboard){
        var self = this
        var my_dashboard =
            {
                id: 'cardbox',
                text: 'CardBox',
                items: [
                    [ //row 1
                        {
                            type: 'button',
                            label: 'Show All',
                            button_label:'Show All',
                            legend: '',
                            onClick:function(widget,button_ele){
                                self.sync({topic:'showall'})
                                self.units.forEach(function(unit){
                                    self.slideshow.show_unit(unit,true)
                                })
                            }
                        }
                        ,{
                            type: 'button',
                            label: 'Hide All',
                            button_label:'Hide All',
                            legend: '',
                            onClick:function(widget,button_ele){
                                self.sync({topic:'hideall'})
                                self.units.forEach(function(unit){
                                    self.slideshow.show_unit(unit,false)
                                })
                            }
                        }
                        , {
                            type: 'button',
                            label: 'Reverse',
                            button_label:'Reverse',
                            legend: '',
                            onClick:function(widget,button_ele){
                                self.reverse_units()
                                w2ui['boxunit-units'].records.reverse()
                                w2ui['boxunit-units'].refresh()
                                self.sync({topic:'reverse'})
                            }
                        }
                        ,{
                            type: 'list',
                            label: 'In Style',
                            style:'width:100%',
                            legend: 'animation style of the next one',
                            options:{
                                items:Constant.in_styles
                                ,selected: self.slideshow.metadata.in
                            },
                            get:function(widget){
                                return self.slideshow.metadata.in
                            },
                            set:function(widget,item){
                                self.slideshow.metadata.in = item.value.id
                                self.sync({topic:'slideshow',do:'set',data:{in:self.slideshow.metadata.in}})
                            }
                        }
                        ,{
                            type: 'list',
                            label: 'Place',
                            style:'width:100%',
                            legend: 'Where the next one goes to',
                            options:{
                                items:Constant.at_styles,
                                selected: self.slideshow.metadata.at
                            },
                            get:function(widget){
                                return self.slideshow.metadata.at
                            },
                            set:function(widget,field, item,w2dashboard_form){
                                self.slideshow.metadata.at = field.value.id
                                self.sync({topic:'slideshow',do:'set',data:{at:self.slideshow.metadata.at}})
                            }
                        }                        
                        ,{
                            type: 'list',
                            label: 'Out Style',
                            style:'width:100%',
                            legend: 'Out-going style of the current one',
                            options:{
                                items:Constant.out_styles
                                ,selected:self.slideshow.metadata.out
                            },
                            get:function(widget){
                                return self.slideshow.metadata.out
                            },
                            set:function(widget,field){
                                self.slideshow.metadata.out = field.value.id
                                self.sync({topic:'slideshow',do:'set',data:{out:self.slideshow.metadata.out}})
                            }
                        }
                    ]
                    ,[
                        {
                            type:'html',
                            html:function(widget, tags){
                                //tags is an array for pushing html tags
                                if (self.units.length == 0) return 
                                
                                var records = []
                                for (var i=0;i<self.units.length;i++){
                                    // 注意：至少有3個地方在產生這份清單
                                    var info = self.units[i].unit ? self.units[i].unit.get_info() : {}
                                    info.recid = self.units[i].id
                                    records.push(info)
                                }
                                
                                var table_height = self.units.length > 5 ? 400 : 300;
                                tags.push('<div class="boxunit-grid" style="height:'+table_height+'px;width:100%;margin-left:0px"></div>')
                                _.defer(function(){
                                    if (w2ui['boxunit-units']) w2ui['boxunit-units'].destroy()
                                    var grid = document.querySelector('.boxunit-grid')
                                    $(grid).w2grid({ 
                                        name: 'boxunit-units',
                                        recordHeight : 50,
                                        show: {
                                            toolbar:true,
                                            toolbarAdd:false,
                                            toolbarDelete:true,
                                            toolbarSearch:false,
                                            toolbarReload:false,
                                            toolbarColumns:false,
                                            toolbarInput:false,
                                            emptyRecords:false,
                                            lineNumbers : true
                                        },
                                        multiSelect:false,
                                        reorderRows: true,
                                        columns: [    
                                            { field: 'type', caption: 'Type', size: '50px', resizable: true },
                                            { field: 'content',caption:'Content',size:'100%',render:function(record){
                                                //recorder時，此block會先呼叫（以舊的order)
                                                var cardunit
                                                self.units.some(function(unit){
                                                    if (unit.id == record.recid) {cardunit = unit;return true}
                                                })
                                                
                                                if (cardunit && cardunit.unit){// && cardunit.unit.constructor.name == 'ImageUnit'){
                                                    return cardunit.unit.get_info().content
                                                    /*
                                                    var filename = cardunit.unit.metadata.file 
                                                    var src = filename ? WidgetGallery.singleton.presentation.current_slide.widget_manager.get_file_url(filename) : cardunit.unit.metadata.src
                                                    return src ? '<img style="width:auto;max-height:50px" src="'+src+'"/>' : ''
                                                    */
                                                }
                                                else return ''
                                            }}
                                        ],
                                        records: records,
                                        onSelect:function(evt){
                                            var target_idx
                                            w2ui['boxunit-units'].records.some(function(record,idx){
                                                if (record.recid == evt.recid) {target_idx = idx;return true}
                                            })                                            
                                            var unit = self.units[target_idx]
                                            unit.box.style.display = ''
                                            self.sync({topic:'show',uid:unit.id})
                                        },
                                        onReorderRow:function(evt){
                                            //注意：不論變換幾次，evt.recid跟evt.moveAfter都是最早一開始設定的那個值
                                            //所以，需要每次更新 record.idx使其與 self.units的順序一致
                                            if (typeof(evt.moveAfter) == 'undefined') return //no change
                                            var from_idx
                                            w2ui['boxunit-units'].records.some(function(record,idx){
                                                if (record.recid == evt.recid) {from_idx = idx;return true}
                                            })
                                            var to_idx;
                                            w2ui['boxunit-units'].records.some(function(record,idx){
                                                if (record.recid == evt.moveAfter) {to_idx = idx;return true}
                                            })
                                            evt.done(function(){
                                                //要放在done裡面重組self.units，因為re-render rows，使用的是舊的recid
                                                if (from_idx < to_idx) to_idx -= 1
                                                if (from_idx == to_idx) return //make no sense
                                                var src_unit = self.units[from_idx]
                                                self.units.splice(from_idx,1) //remove from array
                                                self.units.splice(to_idx,0,src_unit) //add back to array
                                                
                                                //swap DOM nodes
                                                var src_box = self.ele.querySelector('div[unit="'+src_unit.id+'"]')
                                                src_box.remove()
                                                var prev_box = to_idx == 0 ? null : self.ele.querySelector('div[unit="'+self.units[to_idx-1].id+'"]')
                                                if (prev_box) self.ele.insertBefore(src_box, prev_box)
                                                else self.ele.appendChild(src_box)

                                                self.sync({topic:'reorder',from:from_idx, to:to_idx})
                                            })
                                            
                                        },
                                        onDelete:function(evt){
                                            //w2ui此處有個bug，它會呼叫兩次，但兩次的evt.phase都是before
                                            //先defer之後才會有evt.phase=='after'
                                            var delete_recid = w2ui['boxunit-units'].getSelection()[0]
                                            evt.done(function(evt2){
                                                //只有回答yes才會執行此區塊
                                                //w2ui.grid有bug, 刪除時他會根據recid重新sort，以至於只能再重新產生一次
                                                var records = []
                                                var target_idx = -1
                                                self.units.forEach(function(unit,idx){
                                                    // 注意：至少有3個地方在產生這份清單
                                                    if (unit.id == delete_recid) {
                                                        target_idx = idx
                                                    }
                                                    else{
                                                        var info = unit.unit ? unit.get_info() : {}
                                                        info.recid = unit.id
                                                        records.push(info)
                                                    }
                                                })
                                                if (target_idx >=0) self.remove_unit(target_idx)
                                                w2ui['boxunit-units'].records = records
                                                w2ui['boxunit-units'].refresh()
                                                self.sync({topic:'remove',uid:delete_recid})
                                            })
                                        }
                                    })
                                    w2ui['boxunit-units'].refresh()
                                })
                            }
                        }
                    ]
                ]// end of items
            }         
        
        dashboard.push(my_dashboard)
    }    
    , on_paste: function (data) {
        if (data.is_file) {
            var unit = this.add_unit()
            //必要時在dashboard的unit清單中增加一列
            if (WidgetGallery.singleton.dashboard_box.dataset.widget_id == this.widget.id &&
                w2ui['boxunit-units']){
                w2ui['boxunit-units'].records.push({
                    recid:unit.id,
                    type:unit.unit ?  unit.unit.constructor.name : ''
                })
                w2ui['boxunit-units'].refresh()
            }            
            unit.on_paste(data)
            this.sync({topic:'add',data:unit.serialize()})
        }
    }
    , on_paste_string: function (text) {
       /* 本函式要負責從使用者給的URL中生出內容*/
        var unit = this.add_unit()
        this.sync({topic:'add',data:unit.serialize()}) //sync "add" 要立刻送，才能接收後續的content
        console.log('add unit syck')
        //必要時在dashboard的unit清單中增加一列
        if (WidgetGallery.singleton.dashboard_box.dataset.widget_id == this.widget.id &&
            w2ui['boxunit-units']){
            w2ui['boxunit-units'].records.push({
                recid:unit.id,
                type:unit.unit ?  unit.unit.constructor.name : ''
            })
            w2ui['boxunit-units'].refresh()
        }
        unit.on_paste_string(text)
    }
    ,add_unit: function (unit_data) {
        //Add a new unit into box
        //新增加的在底下
        var box = document.createElement('div')
        box.classList.add('boxunit-slice')
        box.style.position = 'absolute'
        this.ele.insertBefore(box, this.ele.firstChild)
        var unit = new CardUnit(this.widget,box)
        if (unit_data) unit.deserialize(unit_data)
        box.setAttribute('unit',unit.id)

        this.units.push(unit)
        var self = this
        unit.on('content',function(src_unit){
            //如果此unit內容改變時（例如有了圖），必要時更新dashboard的unit清單
            if (WidgetGallery.singleton.dashboard_box.dataset.widget_id == self.widget.id &&
                w2ui['boxunit-units']){
                w2ui['boxunit-units'].records.some(function(record){
                    if (record.recid == src_unit.id){
                        record.type = src_unit.unit ? src_unit.unit.constructor.name : ''
                    }
                })
                w2ui['boxunit-units'].refresh()
            } 
        })
        this.fire('unit-added')
        return unit
    }
    ,remove_unit:function(idx){
        //var unit = this.units[idx]
        var units = this.units.splice(idx,1)
        units[0].destroy()
        this.fire('unit-removed')
    }
    , reverse_units:function(){
        //reverse DOM nodes
        this.units.reverse()
        var count = this.units.length
        for (var i=count-1;i>=0;i--){
            var box = this.units[i].box
            box.remove()
            this.ele.appendChild(box)
        }
    }
    ,on_sync:function(data){
        switch(data.topic){
            case 'add':
                var unit = this.add_unit(data.data)
                //必要時在dashboard的unit清單中增加一列
                if (WidgetGallery.singleton.dashboard_box.dataset.widget_id == this.widget.id &&
                    w2ui['boxunit-units']){
                    var info = unit.unit ? unit.get_info() : {}
                    info.recid = unit.id
                    w2ui['boxunit-units'].records.push(info)
                    w2ui['boxunit-units'].refresh()
                }
                break
            case 'remove':
                var target_idx = -1;
                this.units.some(function(unit,idx){
                    if (unit.id == data.uid) {
                        target_idx = idx;
                        return true
                    }
                })
                if (target_idx >= 0) this.remove_unit(target_idx)
                if (WidgetGallery.singleton.dashboard_box.dataset.widget_id == this.widget.id &&
                    w2ui['boxunit-units']){
                    // w2ui.grid有bug, 刪除時他會根據recid重新sort，以至於只能再重新產生一次
                    // 注意：至少有3個地方在產生這份清單
                    var records = []
                    this.units.forEach(function(unit,idx){
                        var info = unit.unit ? unit.get_info() : {}
                        info.recid = unit.id
                        records.push(info)
                    })                        
                    w2ui['boxunit-units'].records = records
                    w2ui['boxunit-units'].refresh()
                }
                break
            case 'slideshow':
                if (data.do == 'start') this.slideshow.start()
                else if (data.do == 'next') this.slideshow.next()
                else if (data.do == 'stop') this.slideshow.stop()
                else if (data.do == 'prev') this.slideshow.prev()
                else if (data.do == 'set') _.assign(this.slideshow.metadata,data.data)
                //更動幅度太大，應只要部分更新；暫時先這樣
                WidgetGallery.singleton.update_dashboard(this.widget)
                break
            case 'reorder':

                var src_unit = this.units[data.from]
                this.units.splice(data.from,1)
                this.units.splice(data.to,0,src_unit)
                
                var src_box = this.ele.querySelector('div[unit="'+src_unit.id+'"]')
                src_box.remove()
                var prev_box = data.to == 0 ? null : this.ele.querySelector('div[unit="'+this.units[data.to-1].id+'"]')
                if (prev_box) this.ele.insertBefore(src_box, prev_box)
                else this.ele.appendChild(src_box)

                if (WidgetGallery.singleton.dashboard_box.dataset.widget_id == this.widget.id &&
                    w2ui['boxunit-units']){
                    var records = w2ui['boxunit-units'].records
                    var record = records[data.from]
                    records.splice(data.from,1)
                    //這裡的data.to直接使用，不需要像在reorder那裡作 -= 1 的調整
                    records.splice(data.to,0,record)
                    w2ui['boxunit-units'].refresh()
                }
                break
            case 'reverse':
                this.reverse_units()
                //更動幅度太大，應只要部分更新；暫時先這樣
                WidgetGallery.singleton.update_dashboard(this.widget)
                break
            case 'hideall':
                this.units.forEach(function(unit){
                    unit.box.style.display = 'none'
                })
                break
            case 'showall':
                this.units.forEach(function(unit){
                    unit.box.style.display = ''
                })
                break
            case 'show':
                this.units.some(function(unit){
                    if (unit.id == data.uid){
                        unit.box.style.display = ''
                        return true
                    }
                })
                break
        }
    }
    
})

var BoxWidget = function(ele) {
    var self = this
    Widget.call(this, ele)
    this.unit = new BoxUnit(this, this.box)
    
    // 預設一個容易辨識的顏色 
    this.ele.classList.add('empty')
    this.unit.on('unit-added',function(){
        self.ele.classList.remove('empty')
    })
    this.unit.on('unit-removed',function(){
        if (self.unit.units.length == 0) self.ele.classList.add('empty')
    })
}

BoxWidget.prototype = _.create(Widget.prototype, {
    constructor: BoxWidget,
    clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是CardWidget
        return Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
    }
    ,serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this,for_clone)
        data.unit = this.unit.serialize(for_clone)
        return data
    }
    ,deserialize: function (data,is_clone) {
        Widget.prototype.deserialize.call(this,data,is_clone)
        this.unit.deserialize(data.unit, is_clone)
    }
    ,get_actions:function(){
        return this.unit.get_actions()
    }
    ,get_dashboard:function(dashboard){
        this.unit.get_dashboard(dashboard)
    }
    , on_paste: function (data) {
        this.unit.on_paste(data)
    }
    , on_paste_string: function (text) {
        this.unit.on_paste_string(text)
    }
})
BoxWidget.create_sample = function (box, features) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    if (box) box.appendChild(div)
    return BoxWidget.factory(div, features)
}
BoxWidget.metadata = {
    category: 'general',
    caption: 'Card Box', //display name for i18n
    description: 'a box to holding many Cards',
    video:'15NL8LqH-qc',
    icon: 'fa fa-box'
}
BoxWidget.factory = function (ele, features) {
    ele.setAttribute('kind', 'BoxWidget')
    if (typeof (features) == 'undefined') {
        features = ['draggable', 'resizable', 'rotatable', 'zoomable']
    }
    features.forEach(function (feature) { ele.classList.add(feature) })
    return new BoxWidget(ele)
}
WidgetGallery.register(BoxWidget)

/*
function ImageBoxUnit(widget){
    / * CardWidget, FlipCardWidget 共用，管理多張圖片的元件 * /
    this.widget = widget
    this.box = box
    //在active情況下才會有把照片拖出去丟掉的功能
    this.active = false
    this.images = []
    this.images_src = []
    this.ele = this.widget.ele.querySelector('div.imagebox')
    if (this.ele){
        //in scenario of clone
        var self = this
        this.ele.childNodes.forEach(function(ele){
            if (ele.tagName != 'IMG') return
            //因為img.src部分可能因節省記憶體的目的而被刪除，所以此處不處理 self.images_src
            //而是在serialize與 desericalize的地方處理
            self.images.push(ele)
        })
    }
    else{
        this.ele = document.createElement('div')
        this.ele.className = 'imagebox'
        this.widget.ele.appendChild(this.ele)
    }
}
ImageBox.prototype = {
    fake_blank_image: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
    ,serialize:function(for_clone){
        return this.images_src.slice()
    }
    ,deserialize:function(data){
        this.images_src = data.slice()
    }
    ,reset:function(){
        this.images = []
    }
    ,on_paste:function(data){
        if (data.is_file){
            var urlCreator = window.URL || window.webkitURL;
            var img_ele = document.createElement('img')
            img_ele.src = urlCreator.createObjectURL(data.file);
            this.push_image(img_ele)            
        }
        else{
            window.message('failed to load image')
        }
    }
    ,on_paste_string:function(text){
        if (/^https?\:\/\//.test(text) && /\.(jpeg|jpg|gif|svg)/i.test(text)){
            this.load_image(text)
        }
        else if (/^data\:image/.test(text)){
            var img_ele = document.createElement('img')
            img_ele.src = text
            this.push_image(img_ele)
        }
        else{
            window.message('failed to load image')
        }
    }
    ,activate:function(yes){
        this.active = yes
        this.top_image_draggable(yes)
    }    
    ,top_image_draggable:function(yes){
        if (this.images.length == 0) return 
        var self = this
        var img_ele = this.images[this.images.length-1]
        if (yes){
            interact(img_ele).draggable({
                inertia: true,
                onstart:function(evt){
                    var img_ele = evt.target
                    img_ele.dataset.x = parseFloat(img_ele.style.left) || 0
                    img_ele.dataset.y = parseFloat(img_ele.style.top) || 0
                    //讓拖動時可以看見全圖
                    self.ele.style.overflow = 'visible'
                    console.log('start')
                },
                onmove:function(evt){
                    var img_ele = evt.target
                    var x = parseFloat(img_ele.dataset.x) + evt.dx
                    var y = parseFloat(img_ele.dataset.y) + evt.dy
                    img_ele.style.left = x + 'px'
                    img_ele.style.top = y + 'px'
                    img_ele.dataset.x = x
                    img_ele.dataset.y = y
                },
                onend:function(evt){
                    //恢復overflow:hidden的狀態（定義在widget.css)
                    self.ele.style.overflow = ''
                    var img_ele = evt.target
                    var rect = self.widget.ele.getBoundingClientRect()
                    var _rect = img_ele.getBoundingClientRect()
                    var interset = {
                        left:Math.max(rect.left,_rect.left),
                        right:Math.min(rect.right,_rect.right),
                        top:Math.max(rect.top,_rect.top),
                        bottom:Math.min(rect.bottom,_rect.bottom)
                    }
                    var inserset_rect = {w:interset.right - interset.left,h:interset.bottom - interset.top}
                    var area_ratio = inserset_rect.w * inserset_rect.h / (self.widget.h * self.widget.w)
                    if (area_ratio < 0.25){
                        self.pop_image()
                    }
                }
            })
        }
        else{
            interact(img_ele).unset()
        }
    }
    ,push_image:function(img_ele){
        //顯示最後貼進來的一張圖
        var self = this

        //手動解除目前的上圖可拖動；disable draggable of the current top image
        if (this.active) this.top_image_draggable(false)
        
        this.ele.appendChild(img_ele)
        this.images.push(img_ele)
        this.images_src.push(img_ele.src)
        
        if (this.images.length > 2){
            //只留兩張圖，把前張的前張刪掉，以節省記憶體
            this.images[this.images.length - 3].src = this.fake_blank_image
        }

        // 手動讓上圖可拖動
        if (this.active) this.top_image_draggable(true)

        this.widget.ele.style.border = 'none'
        this.widget.ele.setAttribute('preserveAspectRatio','1')
        if (this.images.length == 1){
            //第一張圖之後保持比例;
            setTimeout(function(){
                //稍等圖載入完成後以取得尺寸
                var w = img_ele.naturalWidth, h = img_ele.naturalHeight
                h = self.widget.w * (h/w)
                self.widget.resize(self.widget.w,h)
                self.widget.update_handles()
            })
        }
        
    }
    ,pop_image:function(){
        //把最上面的圖踢掉
        //手動解除目前的上圖可拖動；
        if (this.active) this.top_image_draggable(false)
        if (this.images.length > 2){
            //因為只留兩張圖，恢復前張的前張圖
            this.images[this.images.length - 3].src = this.images_src[this.images.length - 3]
        }

        var img_ele = this.images.pop()
        this.ele.removeChild(img_ele)
        this.images_src.pop()

        if (this.images.length == 0){
            //如果沒有圖了，不再保持比例
            this.widget.ele.style.border = ''
            this.widget.ele.removeAttribute('preserveAspectRatio')
        }
        else if (this.active) {
            //讓目前的上圖可拖動；
            this.top_image_draggable(true)
        }
    }
    ,load_image:function(url){
        var self = this
        var image = new Image()
        image.onload = function(){
            var img_ele = document.createElement('img')
            img_ele.src = url
            self.push_image(img_ele)
        }
        image.onerror = function(){
            //self.ele.style.border = ''
            window.message('unable to load image')
        }
        image.src = url
    }
}
 
function CardWidget(ele){
    Widget.call(this,ele)    
    var self = this
    this.image_box = new ImageBox(this)
    this.on('selected',function(){
        if (self.state_manager.expanded) self.image_box.activate(true)
    })
    this.on('unselected',function(){
        self.image_box.activate(false)
    })
}

CardWidget.prototype = _.create(Widget.prototype,{
    constructor: CardWidget,
    //brower無法移除圖片，用這個假裝
    fake_blank_image: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
    clone:function(parent_ele){
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是CardWidget
        return Widget.prototype.clone.call(this,parent_ele,this.constructor.factory)
    },
    serialize:function(for_clone){
        var data = Widget.prototype.serialize.call(this)
        data.card = {
            //src:this.image_ele.src,
            //opacity:this.image_ele.style.opacity,
            image_box: this.image_box.serialize()
        }
        return data
    },
    deserialize:function(data){
        Widget.prototype.deserialize.call(this,data)
        if (data.card) {
            //this.image_ele.style.opacity = data.image.opacity
            //this.load_image(data.image.src)
            this.image_box.deserialize(data.card.image_box)
        }
        return this
    }
    ,reset:function(){
        Widget.prototype.reset.call(this)
        //this.load_image()
        this.image_box.reset()
        this.roll(false)
    }
    ,on_paste:function(data){
       this.image_box.on_paste(data)
    }
    ,on_paste_string:function(text){
        this.image_box.on_paste_string(text)
    }
    ,load_image:function(url){
        this.image_box.load_image(url)
    }
})
CardWidget.create_sample = function(box,features){
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    box.appendChild(div)
    return CardWidget.factory(div,features)
}
CardWidget.metadata = {
    category:'general',
    caption:'Card', //display name for i18n
    description:'a box of images',
    icon:'fa fa-card',
    //information to render items on action-menu for user to take
    actions:[ 
        {
            id:'roll',
            type: 'button',
            text:'Start',            
            icon:'fa fa-trash',
            onClick:function(widget,toolbar){
                toolbar.get('roll').text = roll ? 'Stop' : 'Start'
                toolbar.refresh('roll')
            }
        }
    ],
    dashboard:[
        {
            //http://html5-demos.appspot.com/static/css/filters/index.html
            id:'Filter',
            text:'Filter',
            items:[
                {
                    type:'range',
                    min: 0.1,
                    max: 1,
                    step: 0.05,
                    label:'Opacity',
                    get:function(widget){
                        return 1//widget.image_ele.style.opacity || 1
                    },
                    set:function(widget,input_ele){
                        var value = input_ele.value
                        //widget.image_ele.style.opacity = value
                    }
                }
            ]
        },
        {
            //http://html5-demos.appspot.com/static/css/filters/index.html
            id:'Image',
            text:'Image',
            items:[
                {
                    type:'range',
                    min: 0.1,
                    max: 1,
                    step: 0.05,
                    label:'Opacity',
                    get:function(widget){
                        return widget.ele.style.opacity || 1
                    },
                    set:function(widget,input_ele){
                        var value = input_ele.value
                        widget.ele.style.opacity = value
                    }
                }
            ]
        }
    ]
}
CardWidget.factory = function(ele,features){
    ele.setAttribute('kind','CardWidget')
    if (typeof(features) == 'undefined') features = ['draggable','resizable','rotatable','zoomable']
    features.forEach(function(feature){ele.classList.add(feature)})
    / * 測試內在群組時使用
    setTimeout(function(){ //要等一下，先讓上層的widget建立起來
        var block = document.createElement('div')
        ele.append(block)
        var widget = BlockWidget.factory(block)
        widget.resize(100,50)
        widget.set_text('card')
        widget.ele.style.bottom = 0
    })   * /  
    return new CardWidget(ele)
}
WidgetGallery.register(CardWidget)
*/

function YoutubeUnit(widget, box) {
    var func_name = arguments.callee.name //YoutubeUnit
    GenericUnit.call(this, widget, box, func_name)
    //box is a HTMLElement within widget.ele 
    //box is the container of this unit
    //a widget might have many YoutubeUnit, so container might not be widget.ele
    var vid = ''
    if (this.ele) {
        //this is celled by clone() call
        vid = this.ele.querySelector('.YoutubeUnit-player').getAttribute('vid')
    }
    else {
        this.create_ele({
            classname: func_name,
            style: {
                height: '200px'
                , width: '200px'
            }
        })
    }
    /* (require youtube.js)*/
    var ret = (YoutubePlayer.singleton || new YoutubePlayer()).pre_render({ class: 'YoutubeUnit-player' })
    this.ele.innerHTML = ret.content
    this.metadata.player_id = ret.player_id //DOM element's id
    this.metadata.video_id = vid
    this.metadata.video_time = 0
    this.metadata.video_state = 0
    this.metadata.state_time = 0
    this.draggable()
    this.player = null
    if (vid) {
        setTimeout(function () {
            //enforce load_video() to load 
            self.ele.querySelector('.YoutubeUnit-player').setAttribute('vid', '')
            self.load_video(vid)
        })
    }

    var self = this
    this.widget.on('collapsed', function (data) {
        if (!self.player) return
        self.pause()
    })

    //在flip前後恢復播放狀態
    var is_playing_when_hide = false
    this.widget.on('hide', function () {
        if (!self.player) return
        if (self.get_state() == 1) {
            is_playing_when_hide = true
            self.pause()
        }
        self.ele.style.display = 'none' //這樣比較省記憶體
        //display the thumbnail
        self._ele = self.ele
        self.ele = document.createElement('img')
        self._ele.parentNode.insertBefore(self.ele,self._ele)
        self.ele.src = 'https://img.youtube.com/vi/'+self.metadata.video_id+'/default.jpg'
        /*
        self.ele.onerror = function(){
            delete self.ele.onerror
            self.ele.src = 'https://img.youtube.com/vi/'+self.metadata.video_id+'/0.jpg'
        }
        */
    })
    this.widget.on('show', function () {
        if (!self.player) return
        //remove thumbnail from DOM and restore original self.ele
        self.ele.remove() 
        self.ele = self._ele
        delete self._ele
        self.ele.style.display = ''
        if (is_playing_when_hide) {
            is_playing_when_hide = false//reset this value
            self.play()
        }
    })

    //使用者調整時間時希望能同步到其他設備，但因為無此事件
    //所以暫時借用unselected事件
    this.widget.on('unselected', function () {
        if (!self.player) return
        if (self.get_state() == 2) {
            self.sync({ topic: 'seek', seek: self.player.getCurrentTime() })
        }
    })
    //被刪除時做徹底的清理(只需聽destroyed,不需聽widget.on(removed)
    this.on('destroyed', function () {
        //widget.destroy() or unit.destroy() been called
        if (!self.player) return
        self.player.destroy()
    })
    //使用者直接從影片操作時，更新dashboard的按鈕狀態
    this.on('state', function (state) {

        //分辨此改變是使用者直接操作影片，或是透過dashboard的toolbar做的
        if (self._changed_from_toolbar) return

        // 因為youtubeplayer會自己先play又pause以克服api不能直接seek的bug,
        // 所以self.player不會馬上就有值
        if (!(self.player && (state == 1 || state == 2))) return
        WidgetGallery.singleton.update_dashboard(self.widget)
        self.sync({ topic: (state == 1 ? 'play' : 'pause'), seek: self.player.getCurrentTime() })
    })
    this.on('resize', function () {
        //console.log('you tube resize')
    })
}
YoutubeUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: YoutubeUnit
    , serialize: function (for_clone) {
        var data = GenericUnit.prototype.serialize.call(this)
        if (this.player) data.video_time = this.player.getCurrentTime()
        return data
    }
    , deserialize: function (data, is_clone) {
        //don't override player_id
        data.player_id = this.metadata.player_id
        GenericUnit.prototype.deserialize.call(this, data, is_clone)

        var self = this
        var call_with_context = function () {
            if (self.metadata.video_id) {
                self.load_video(self.metadata.video_id).done(function () {
                    self.player.seekTo((self.metadata.video_time || 0))
                    //YoutubeUnit的特性是要等影片載入之後才能resize跟scale
                    if (self.metadata.resize) {
                        var resize = _.clone(self.metadata.resize)
                        WidgetGallery.singleton.denormalize(resize)
                        self.resize(resize.w, resize.h)
                    }
                    if (self.metadata.scale) {
                        self.resizable_options.scale_target.dataset.scale = self.metadata.scale
                        //YoutubeUnit 的特性是scale時保持一致，不必管widget.rel_scale
                        var scale = self.metadata.scale
                        self.zoom(scale)
                    }
                })
            }
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)

        return this
    }
    , state_save:function(){
        if (!this.player) return null
        return {
            p: (this.get_state()==1) //playing
            ,t: this.player.getCurrentTime()
            ,v: this.metadata.video_id
        }
    }
    ,state_restore:function(data){
        if (!this.player) return
        var self = this
        var seek_ts_and_state = function(){
            self.player.seekTo(data.t)
            if (data.p) self.play()
            else self.pause()    
        }
        if ( this.metadata.video_id != data.v){
            this.load_video(data.v).done(function(){
                seek_ts_and_state()
            })
        }
        else{
            seek_ts_and_state()
        }
    }
    , get_actions: function () {
        // player產生的速度需要好幾秒，剛產生的youtube unit會在player生成之前呼叫get_actions()
        // 所以改用 metadata.video_id 判斷
        if (!this.metadata.video_id) return [];        
        var self = this
        var state = this.get_state() || 2 //default to be stop
        return [
            {
                id: 'video',
                type: 'button',
                text: state == 1 ? 'Pause' : 'Play',
                icon: 'fa '+(state == 1 ? 'fa-pause' : 'fa-play'),
                onClick: function (widget, toolbar) {
                    var do_play = self.get_state() == 1 ? false : true
                    do_play ? self.play() : self.pause()
                    if (do_play) {
                        self.sync({ topic: 'play', seek: self.player.getCurrentTime() })
                        setTimeout(function () { self.play() })
                    }
                    else {
                        self.pause()
                        self.sync({ topic: 'pause', seek: self.player.getCurrentTime() })
                    }
                    toolbar.get('video').icon = do_play ? 'fa fa-pause' : 'fa fa-play'
                    toolbar.get('video').text = do_play ? 'Pause' : 'Play'
                    toolbar.refresh('video')
                    // 讓state-change listener知道state是因為toolbar做的改變
                    // 不需要重新render dashboard
                    self._changed_from_toolbar = true
                    _.delay(function(){
                        delete self._changed_from_toolbar
                    },1000)
                }
            }
        ]
    }
    , get_info:function(){
        return {
            type:'Video',
            content:'<a href="https://www.youtube.com/watch?v='+this.metadata.video_id+'" target="blank"><img style="width:auto;max-height:50px" src="https://img.youtube.com/vi/'+this.metadata.video_id+'/default.jpg"></a>'
        }
    }
    , on_sync: function (data) {
        if (GenericUnit.prototype.on_sync.call(this, data)) return
        switch (data.topic) {
            case 'play':
                //1.5 is the estimate of message overhead
                this.player.seekTo(data.seek + 1.5)
                this.play()
                break
            case 'pause':
                this.player.seekTo(data.seek)
                this.pause()
                break
            case 'seek':
                this.player.seekTo(data.seek)
                break
        }
    }
    , load_video: function (video_id) {
        //before player creation handling

        var current_vid = this.ele.querySelector('.YoutubeUnit-player').getAttribute('vid')
        if (current_vid == video_id) return //do nothing

        this.metadata.video_id = video_id
        this.ele.querySelector('.YoutubeUnit-player').setAttribute('vid', video_id)

        var self = this
        var on_state_changed = function (video_state) {
            self.fire('state', video_state)
        }
        var video_state = 2
        var player_time = 0
        var promise = new $.Deferred()
        var options = {
            player_id: this.metadata.player_id
            , video_id: video_id
            , video_state: video_state
            , player_time: player_time
            , on_state_changed: on_state_changed

        }
        if (self.player) {
            self.player.pauseVideo()
            self.player.loadVideoById(video_id);
            YoutubePlayer.post_loaded(self.player, options, function () {
                promise.resolve(true)
                self.fire('content')
            })
            return promise
        }
        else {
            var youtube_player = YoutubePlayer.singleton || new YoutubePlayer()
            youtube_player.start(options, function (success, player) {
                //此youtube player有一特性是當他被放到slot時，此函式會被呼叫一次，導致
                //resize成錯誤的size。因此要跳過此情況。
                if (self.widget.ele.classList.contains('inslot')) return
                if (success) {
                    self.player = player
                    var player_ele = self.ele.querySelector('#' + self.metadata.player_id)
                    var player_rect = player_ele.getBoundingClientRect()
                    var ele_rect = self.ele.getBoundingClientRect()
                    //keep ele's width, adjust its heigh to be same aspect ratio as the video
                    var h = ele_rect.width * (player_rect.height / player_rect.width)
                    self.ele.style.height = h + 'px'
                    self.fire('resize', { width: ele_rect.width, height: h })
                    player_ele.style.width = '100%'
                    player_ele.style.height = '100%'

                    self.resizable({
                        resize_target: self.ele,
                        scale_target: player_ele,
                        //YoutubeUnit 的特性是scale時保持一致，不必管widget.rel_scale
                        static_scale: true
                    })
                    promise.resolve(self.player)
                    self.fire('content')
                }
                else {
                    // in this case, player is error message
                    promise.reject(player)
                }
            })
            return promise
        }
    }
    , play: function () {
        if (this.player) this.player.playVideo()
    }
    , pause: function () {
        try {
            if (this.player) this.player.pauseVideo()
        }
        catch (e) {
            console.log(e)
        }
    }
    , get_state: function () {
        if (this.player) return this.player.getPlayerState()
    }
})
/* Youtube Video (require youtube.js)
function YoutubeWidget(ele) {
    ele.classList.add('resizable', 'rotatable', 'zoomable', 'draggable')
    //ele.setAttribute('preserveAspectRatio',1)
    Widget.call(this, ele)

    //this.ele.classList.add('center-items')
    this.unit = new YoutubeUnit(this, this.ele)

    var self = this
    this.unit.on('resize', function (data) {
        //self.resize(data.width, data.height)
    })
    _.delay(function () {
        self.unit.load_video('d6fhPgoukZw').done(function () {
            self.unit.play()
        })
    }, 500)

}
YoutubeWidget.prototype = _.create(Widget.prototype, {
    constructor: YoutubeWidget
    , clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是BlockWidget
        return Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
    }
    , serialize: function () {
        var data = Widget.prototype.serialize.call(this)
        data.unit = this.unit.serialize()
        return data
    }
    , deserialize: function (data) {
        Widget.prototype.deserialize.call(this, data)
        this.unit.deserialize(data.unit)
        return this
    }
    , on_paste_string: function (text) {
        // ex: https://www.youtube.com/watch?v=2ckqOukGKK8&t=1501s
        var self = this
        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            if (slide_resource.type == 'VIDEO' && slide_resource.kind == 'YT') {
                self.unit.load_video(slide_resource.vid)
            }
            else {
                window.message('not Youtube URL')
            }
        })
    }
    , on_dnd_string: function (text) {
        this.on_paste_string(text)
    }

})
YoutubeWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    div.setAttribute('kind', 'YoutubeWidget')
    div.className = 'widget'
    if (box) box.appendChild(div)
    return YoutubeWidget.factory(div)
}
YoutubeWidget.metadata = {
    category: 'general',
    caption: 'Youtube', //display name for i18n
    description: 'a panel to block something',
    icon: 'fa fa-card',
    //information to render items on action-menu for user to take
    actions: [
        {
            id: 'play',
            type: 'button',
            text: 'Play',
            icon: 'fa fa-trash',
            tooltip: 'hide and show',
            onClick: function (widget, toolbar) {
                widget.unit.play()
            }
        }
    ],
    dashboard: [
        {
            id: 'Video',
            text: 'Video',
            items: [
                {
                    type: 'range',
                    min: 0.1,
                    max: 1,
                    step: 0.05,
                    label: 'Opacity',
                    get: function (widget) {
                        return widget.ele.style.opacity || 1
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.ele.style.opacity = value
                    }
                }
            ]
        }
    ]
}
YoutubeWidget.factory = function (ele) {
    return new YoutubeWidget(ele)
}
WidgetGallery.register(YoutubeWidget);
*/

/* WebcamWidget (requires youtube.js)*/
function WebcamUnit(widget, box) {
    var func_name = arguments.callee.name //WebcamUnit
    GenericUnit.call(this, widget, box, func_name)
    //box is a HTMLElement within widget.ele 
    //box is the container of this unit
    //a widget might have many YoutubeUnit, so container might not be widget.ele

    //;this.ele = box.querySelector('.webcam-unit')
    if (this.ele) {
        //this is celled by clone() call
    }
    else {
        this.create_ele({
            classname: func_name,
            style: {
                height: '100%'
                , width: '100%'
            }
        })
    }
    /* (require youtube.js)*/
    this.player = new WebcamPlayer(this.ele)
    var self = this
    this.widget.on('collapsed', function (data) {
        self.player.pauseVideo()
    })
    var is_playing_when_hide = false
    this.widget.on('hide', function () {
        if (self.get_state() == 1) {
            is_playing_when_hide = true
            self.pause()
        }
    })
    this.widget.on('show', function () {
        if (is_playing_when_hide) {
            is_playing_when_hide = false//reset this value
            self.play()
        }
    })

    this.on('destroyed', function () {
        if (!self.player) return
        self.player.destroy()
        self.player = null
    })

    this.resizable({
        resize_target: this.ele,
        scale_target: this.player.ele
    })
    //make this unit resizable    
    this.draggable()
}
WebcamUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: WebcamUnit
    , deserialize: function (data, is_clone) {
        GenericUnit.prototype.deserialize.call(this, data, is_clone)
        return this
    }
    , get_actions: function () {
        var self = this
        var is_playing = this.get_state() == 1
        return [
            {
                id: 'webcam',
                type: 'button',
                text: (is_playing ? 'Pause' : 'Play'),
                icon: 'fa fa-' + (is_playing ? 'pause' : 'play'),
                tooltip: 'start the webcam',
                onClick: function (widget, toolbar) {
                    var do_play = self.get_state() == 1 ? false : true
                    do_play ? self.play() : self.pause()
                    toolbar.get('webcam').icon = 'fa fa-' + (do_play ? 'pause' : 'play')
                    toolbar.get('webcam').text = do_play ? 'Pause' : 'Play'
                    toolbar.refresh('webcam')
                }
            }
            , {
                id: 'camshot',
                type: 'button',
                text: 'Snapshot',
                icon: 'fa fa-camera',
                tooltip: 'take a snapshot',
                onClick: function (widget, toolbar) {
                    self.player.take_snapshot().done(function (data) {
                        var widget = WidgetGallery.all['FlipCardWidget'].create_sample(WidgetGallery.singleton.widget_layer)
                        WidgetGallery.singleton.presentation.current_slide.widget_manager.add_widget(widget, true)
                        _.defer(function () {
                            widget.resize(self.widget.w, self.widget.h)
                            widget.sync({ id: 0, on: 'resize', h: self.widget.h, w: self.widget.w })
                            widget.move(self.widget.x + 50, self.widget.y + 50)
                            widget.sync({ id: 0, on: 'move', x: self.widget.x + 50, y: self.widget.y + 50 })
                            widget.unit.on_paste(data)
                        })

                    })
                }
            }
            , {
                id: 'camdownload',
                type: 'button',
                text: 'Download',
                icon: 'fa fa-file',
                tooltip: 'download a snapshot',
                onClick: function (widget, toolbar) {
                    self.player.take_snapshot().done(function (data) {
                        var link = document.createElement('a')
                        link.href = URL.createObjectURL(data.file)
                        link.download = 'webcam.jpeg'
                        link.click()
                    })
                }
            }
        ]
    }
    , play: function () {
        var self = this
        return this.player.playVideo().done(function () {
            var h = (1 / self.player.video_settings.aspectRatio) * (self.ele.clientWidth)
            self.ele.style.height = h + 'px'
            self.fire('content')
        }).fail(function (err_message) {
            window.message(err_message)
        })
    }
    , pause: function () {
        this.player.pauseVideo()
    }
    , get_state: function () {
        return this.player.getPlayerState()
    }
})

var WebcamWidget = function(ele) {
    ele.classList.add('resizable', 'rotatable', 'zoomable', 'draggable')
    //ele.setAttribute('preserveAspectRatio',1)
    Widget.call(this, ele)

    this.unit = new WebcamUnit(this, this.ele)
    ele.style.overflow = 'hidden'

}
WebcamWidget.prototype = _.create(Widget.prototype, {
    constructor: WebcamWidget
    , clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是BlockWidget
        return Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
    }
    , serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this)
        data.unit = this.unit.serialize(for_clone)
        return data
    }
    , deserialize: function (data, is_clone) {
        Widget.prototype.deserialize.call(this, data, is_clone)
        this.unit.deserialize(data.unit, is_clone)
        return this
    }
    , on_dnd_string: function (text) {
        this.on_paste_string(text)
    }
    , on_paste: function (data, evt) {
        if (data.is_file && data.mimetype.indexOf('image/') == 0) {
            // 上傳到系統前，先做圖形處理
            WidgetGallery.singleton.preprocess_file(data.file).done(function (file) {
                // 此處也要處理將現有的image刪除的問題
                // 上傳到系統
                WidgetGallery.singleton.upload_widget_file({
                    file: file,
                    name: file.name,
                    uuid: self.unit.id
                }).done(function (filename) {
                    var url = WidgetGallery.singleton.presentation.current_slide.widget_manager.get_file_url(filename)
                    self.set_background(url)
                })
            })
        }
        else {
            console.log('failed to set background image')
        }
    }
    , on_paste_string: function (text, evt) {
        var self = this
        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            if (slide_resource.type == 'FILE'){
                self.on_paste({
                    is_file:true,
                    file:slide_resource.file,
                    mimetype:slide_resource.kind
                })
            }
            else if (slide_resource.type == 'URL'){
                //only image url make sense
                self.set_background(slide_resource.url)
            }
            else {
                this.textbox.set_text(text)
            }
        })
    }
    /* 2019-03-13T04:14:21+00:00 obsoleted implmentation
    , on_paste_string: function (text) {
        var self = this
        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            // 2019-03-13T03:10:25+00:00 pending: 需接受 type == FILE
            if (slide_resource.type == 'URL' && slide_resource.kind.indexOf('image') == 0) {
                self.set_background(slide_resource.url)
            }
            else {
                window.message('should be URL')
            }
        })
    }
    */

})
WebcamWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    div.setAttribute('kind', 'WebcamWidget')
    div.className = 'widget'
    if (box) box.appendChild(div)
    return WebcamWidget.factory(div)
}
WebcamWidget.metadata = {
    category: 'general',
    caption: 'Webcam', //display name for i18n
    description: 'show you on webcam',
    icon: 'fa fa-card',
    //information to render items on action-menu for user to take
    actions: [
        {
            id: 'play',
            type: 'button',
            text: 'Play',
            icon: 'fa fa-trash',
            tooltip: 'start the webcam',
            onClick: function (widget, toolbar) {
                widget.unit.play()
            }
        }
        , {
            id: 'pause',
            type: 'button',
            text: 'Pause',
            icon: 'fa fa-trash',
            tooltip: 'pause the webcam',
            onClick: function (widget, toolbar) {
                widget.unit.pause()
            }
        }
    ],
    dashboard: [
        {
            id: 'Video',
            text: 'Video',
            items: [
                {
                    type: 'range',
                    min: 0.1,
                    max: 1,
                    step: 0.05,
                    label: 'Opacity',
                    get: function (widget) {
                        return widget.unit.ele.style.opacity || 1
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.unit.ele.style.opacity = value
                    }
                }
            ]
        }
    ]
}
WebcamWidget.factory = function (ele) {
    return new WebcamWidget(ele)
}
//WidgetGallery.register(WebcamWidget);

/* Embeded Web URL
install Chrome extention to remove all X-Frame-Option headers if necessary
https://chrome.google.com/webstore/detail/ignore-x-frame-headers/gleekbfjekiniecknbkamfmkohkpodhe/related
*/

function IframeUnit(widget, box) {
    var func_name = arguments.callee.name //YoutubeUnit
    GenericUnit.call(this, widget, box, func_name)

    //box is a HTMLElement within widget.ele 
    //box is the container of this unit
    //a widget might have many IframeUnit, so container might not be widget.ele
    if (this.ele) {
        //this is celled by clone() call
        this.iframe = this.ele.querySelector('iframe')
    }
    else {
        this.create_ele({
            classname: func_name
            , style: {
                height: '100%'
                , width: '100%'
            }
        })
        this.iframe = document.createElement('iframe')
        this.iframe.style.height = '100%'
        this.iframe.style.width = '100%'
        this.iframe.style.transformOrigin = 'top left' //zoom時保持在左上角
        this.ele.appendChild(this.iframe)
    }
    this.resizable({
        resize_target: this.ele,
        scale_target: this.iframe,
        scale_keep_size: true
    })
    this.draggable()

    var self = this
    this.widget.on('collapsed', function (data) {
    })
    this.widget.on('zoom', function () {
    })
    this.widget.on('hide', function () {
        self.iframe.style.display = 'none'
    })
    this.widget.on('show', function () {
        self.iframe.style.display = ''
    })

}
IframeUnit.prototype = _.create(GenericUnit.prototype, {
    constructor: IframeUnit
    , deserialize: function (data, is_clone) {
        GenericUnit.prototype.deserialize.call(this, data, is_clone)

        var self = this
        var call_with_context = function () {
            if (self.metadata.src) self.load_url(self.metadata.src)
        }
        if (WidgetGallery.singleton.context_ready) call_with_context()
        else WidgetGallery.singleton.on('context-ready', call_with_context)

        return this
    }
    , get_info:function(){
        return {
            type:'URL',
            content:'<a href="'+this.metadata.src+'" target="blank">'+this.metadata.src.replace(/^.+\:\/\//,'')+'</a>'
        }
    }    
    , state_save:function(){
        return {url:this.metadata.src || ''}
    }
    , state_restore:function(data){
        this.load_url(data.url || 'about:blank')
    }
    , on_paste_string: function (text) {
        var self = this
        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            if (slide_resource.type == 'URL') {
                self.load_url(slide_resource.url)
            }
            else {
                window.message('should be URL')
            }
        })
    }
    , on_dnd_string: function (text) {
        this.on_paste_string(text)
    }
    , load_url: function (url) {
        var promise = new $.Deferred()
        this.iframe.src = url
        var self = this
        this.iframe.onload = function () {
            promise.resolve(true)
            self.fire('content')
        }
        this.metadata.src = url
        return promise
    }
    , load_html: function (text) {
        var content = '<div style="width:100%;height:100%" contenteditable="true">' + text + '</div>'
        var url = "data:text/html;charset=utf-8," + escape(content);
        this.load_url(url)
    }
})
/*
function IFrameWidget(ele) {
    ele.classList.add('resizable', 'rotatable', 'draggable')
    //ele.setAttribute('preserveAspectRatio',1)
    Widget.call(this, ele)

    this.unit = new IframeUnit(this, this.ele)

    //initial event listeners
    var self = this
    this.on('resize', function (data) {
    })
    this.on('zoom', function (data) {
    })
    this.unit.on('resize', function (data) {
    })
}
IFrameWidget.prototype = _.create(Widget.prototype, {
    constructor: IFrameWidget
    , clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是BlockWidget
        return Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
    }
    , serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this)
        data.unit = this.unit.serialize(for_clone)
        return data
    }
    , deserialize: function (data) { 
        Widget.prototype.deserialize.call(this, data)
        this.unit.deserialize(data.unit)

        return this
    }
    , reset: function () {
        Widget.prototype.reset.call(this)
        this.load_url()
    }
    , on_paste_string: function (text) {
        this.unit.on_paste_string(text)
    },
    on_dnd_string: function (text) {
        this.on_paste_string(text)
    },
    load_html: function (text) {
        this.unit.load_html(url)
    },
    load_url: function (url) {
        this.unit.load_url(url)
    }
})
IFrameWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    div.setAttribute('kind', 'IFrameWidget')
    div.className = 'widget'
    if (box) box.appendChild(div)
    return IFrameWidget.factory(div)
}
IFrameWidget.metadata = {
    category: 'general',
    caption: 'Embedded Web Page', //display name for i18n
    description: 'a panel to block something',
    icon: 'fa fa-card',
    //information to render items on action-menu for user to take
    actions: [
    ],
    dashboard: [
        {
            id: 'IFrame',
            text: 'IFrame',
            items: [
            ]
        }
    ]
}
IFrameWidget.factory = function (ele) {
    return new IFrameWidget(ele)
}
WidgetGallery.register(IFrameWidget);
*/

/*
 * Flip box of images
 */


var BookImageBox = function(widget) {
    // Helper of BookWidget
    this.widget = widget
    //在active情況下才會翻頁的功能
    this.active = false
    this.pages = []
    //this.images = []
    this.images_src = []
    this.ele = this.widget.ele.querySelector('div.bookimagebox')
    if (this.ele) {
        //in scenario of clone
        var self = this
    }
    else {
        this.ele = document.createElement('div')
        this.ele.classList.add('bookimagebox', 'flippable', 'book')
        this.widget.ele.appendChild(this.ele)
    }
    this.create_page()
}
BookImageBox.prototype = {
    fake_blank_image: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
    , serialize: function (for_clone) {
        return this.images_src.slice()
    }
    , deserialize: function (data, is_clone) {
        this.images_src = data.slice()
    }
    , reset: function () {
        this.images = []
    }
    , on_paste: function (data, evt) {
        if (data.is_file || data.is_directory) {
            var self = this
            var push_files = function (files, idx) {
                if (idx >= files.length) return //completed
                var a_file = files[idx]
                if (a_file.type.indexOf('image/') == 0) {
                    var urlCreator = window.URL || window.webkitURL;
                    var img_ele = document.createElement('img')
                    img_ele.src = urlCreator.createObjectURL(a_file);
                    img_ele.onload = function () {
                        img_ele.onload = null
                        //載入完成後再push，如此才能取得naturalHeight
                        self.push_image(img_ele)
                        push_files(files, idx + 1)
                    }
                }
                else {
                    push_files(files, idx + 1)
                }
            }
            push_files(data.is_directory ? data.files : [data.file], 0)
        }
        else {
            window.message('failed to load image')
        }
    }
    , on_paste_string: function (text, evt) {
        var self = this
        if (/^https?\:\/\//.test(text)) {
            var self = this
            window.slide_resource_factory.from_string(text).done(function (slide_resource) {
                if (slide_resource.kind && slide_resource.kind.indexOf('image') == 0) {
                    self.load_image(slide_resource.url)
                }
                else {
                    window.message('unable to load image')
                }
            })
        }
        else if (/^data\:image/.test(text)) {
            var img_ele = document.createElement('img')
            img_ele.src = text
            img_ele.onload = function () {
                img_ele.onload = null
                //載入完成後再push，如此才能取得naturalHeight
                self.push_image(img_ele)
            }
        }
        else {
            window.message('failed to load image')
        }
    }
    , activate: function (yes) {
        this.active = yes
        this.top_image_draggable(yes)
    }
    , create_page: function () {
        var max_pages_length = 100
        var page_ele = document.createElement('div')
        page_ele.classList.add('page', 'flipper')
        page_ele.style.zIndex = (max_pages_length - this.pages.length)
        var page_no = this.pages.length // 0-based
        this.ele.insertBefore(page_ele, this.ele.firstChild)
        page_ele.setAttribute('page_no', page_no)

        var back_ele = document.createElement('div')
        back_ele.classList.add('back')
        page_ele.appendChild(back_ele)
        //back_ele.innerHTML = 'back of page #'+page_no

        var front_ele = document.createElement('div')
        front_ele.classList.add('front')
        page_ele.appendChild(front_ele)
        //front_ele.innerHTML = 'front of page #'+page_no  

        this.pages.push({
            no: page_no,
            ele: page_ele,
            front: front_ele,
            back: back_ele
        })
    }
    , make_draggable: function (face_ele, yes) {
        //face_ele:(ele) back or front ele of a page
        //yes: (boolean)
        var self = this
        if (yes) {
            interact(face_ele).draggable({
                inertia: true,
                onstart: function (evt) {
                    var face_ele = evt.target
                    face_ele.dataset.x = 0
                    face_ele.dataset.y = 0
                    face_ele.dataset.stop = ''
                    face_ele.dataset.page_no = face_ele.parentNode.getAttribute('page_no')
                    evt.preventDefault()
                    evt.stopPropagation()
                },
                onmove: function (evt) {
                    evt.preventDefault()
                    evt.stopPropagation()
                    evt.stopImmediatePropagation()
                    var face_ele = evt.target
                    if (face_ele.dataset.stop !== '') return
                    var x = parseFloat(face_ele.dataset.x) + evt.dx
                    var y = parseFloat(face_ele.dataset.y) + evt.dy
                    var threshold = 30;
                    if (Math.abs(x) > threshold) {
                        var page = self.pages[parseInt(face_ele.dataset.page_no)]
                        var flipped = page.ele.classList.contains('flipped')
                        if (x > threshold && (!flipped)) self.open_to_right(page, true)
                        else if (x < 0 && (flipped) && (page.ele.classList.contains('right-open'))) self.open_to_right(page, false)
                        else if (x < threshold && (!flipped)) self.open_to_left(page, true)
                        else if (x > 0 && (flipped) && (page.ele.classList.contains('left-open'))) self.open_to_left(page, false)
                        //stop the dragging and enable it to be draggable later
                        face_ele.dataset.stop = 1
                        //不要讓下層的overlay_surface收到dragover的事件，否則會造成畫面閃一下
                        face_ele.style.pointerEvents = 'none'
                        setTimeout(function () { face_ele.style.pointerEvents = '' }, 500)
                    }
                    else if (Math.abs(y) > threshold) {
                        var page = self.pages[parseInt(face_ele.dataset.page_no)]
                        var flipped = page.ele.classList.contains('flipped')
                        if (y > threshold && (!flipped)) self.open_to_down(page, true)
                        else if (y < threshold && (flipped)) self.open_to_down(page, false)
                        else if (y < threshold && (!flipped)) self.open_to_up(page, true)
                        else if (y > threshold && (flipped)) self.open_to_up(page, false)
                        //stop the dragging and enable it to be draggable later
                        face_ele.dataset.stop = 1
                        //不要讓下層的overlay_surface收到dragover的事件，否則會造成畫面閃一下
                        face_ele.style.pointerEvents = 'none'
                        setTimeout(function () { face_ele.style.pointerEvents = '' }, 500)
                    }
                    else {
                        face_ele.dataset.x = x
                        face_ele.dataset.y = y
                    }
                },
                onend: function (evt) {

                }
            })
        }
        else {
            interact(face_ele).unset()
        }
    }
    , push_image: function (img_ele) {
        //顯示最後貼進來的一張圖
        var self = this
        //最多100頁（200張圖)
        var max_length = 200
        if (this.images_src.length >= max_length) {
            window.message('too many images in a image box')
            return
        }
        //手動解除目前的上圖可拖動；disable draggable of the current top image
        //if (this.active) this.top_image_draggable(false)
        if (this.images_src.length == 0) {
            //第一張；保持widget寬度,依照圖片比例調整高度（暫時性策略）
            var w = img_ele.naturalWidth, h = img_ele.naturalHeight
            h = this.widget.w * h / w
            this.widget.resize(this.widget.w, h)
            this.widget.ele.setAttribute('preserveAspectRatio', '1')
        }
        var current_length = this.images_src.length
        this.images_src.push(img_ele.src)
        var current_page = this.pages[Math.floor(current_length / 2)]
        var front = current_length % 2 == 0
        if (front) {
            current_page.front.appendChild(img_ele)
            this.make_draggable(current_page.front, true)
        }
        else {
            current_page.back.appendChild(img_ele)
            this.create_page()
        }
    }
    , pop_image: function () {
        //把最上面的圖踢掉
        //手動解除目前的上圖可拖動；
        if (this.active) this.top_image_draggable(false)
        if (this.images.length > 2) {
            //因為只留兩張圖，恢復前張的前張圖
            this.images[this.images.length - 3].src = this.images_src[this.images.length - 3]
        }

        var img_ele = this.images.pop()
        //this.ele.removeChild(img_ele)
        img_ele.remove()
        this.images_src.pop()

        if (this.images.length == 0) {
            //如果沒有圖了，不再保持比例
            this.widget.ele.style.border = ''
            this.widget.ele.removeAttribute('preserveAspectRatio')
        }
        else if (this.active) {
            //讓目前的上圖可拖動；
            this.top_image_draggable(true)
        }
    }
    , load_image: function (url) {
        var self = this
        var image = new Image()
        image.onload = function () {
            var img_ele = document.createElement('img')
            img_ele.src = url
            self.push_image(img_ele)
        }
        image.onerror = function () {
            //self.ele.style.border = ''
            window.message('unable to load image')
        }
        image.src = url
    }
    , open_to_right: function (page, yes) {
        //page:(object), item of this.pages
        var self = this
        if (typeof (yes) == 'undefined') yes = !page.ele.classList.contains('flipped')
        if (yes) {
            page.ele.classList.add('flipped', 'right-open')
            setTimeout(function () {
                page.ele.style.zIndex = - Math.abs(parseInt(page.ele.style.zIndex))
                self.make_draggable(page.front, false)
                self.make_draggable(page.back, true)
            })
        }
        else {
            page.ele.style.zIndex = Math.abs(parseInt(page.ele.style.zIndex))
            setTimeout(function () {
                page.ele.classList.remove('flipped', 'left-open', 'right-open', 'down-open', 'up-open')
                self.make_draggable(page.front, true)
                self.make_draggable(page.back, false)
            }, 150)//停一下的翻頁視覺效果比較好 
        }
        this.widget.fire('flip', yes)
    }
    , open_to_left: function (page, yes) {
        //page:(object), item of this.pages
        //var page = this.pages[1]
        var self = this
        if (typeof (yes) == 'undefined') yes = !page.ele.classList.contains('flipped')
        if (yes) {
            page.ele.classList.add('flipped', 'left-open')
            setTimeout(function () {
                page.ele.style.zIndex = - Math.abs(parseInt(page.ele.style.zIndex))
                self.make_draggable(page.front, false)
                self.make_draggable(page.back, true)
            })
        }
        else {
            page.ele.style.zIndex = Math.abs(parseInt(page.ele.style.zIndex))
            setTimeout(function () {
                page.ele.classList.remove('flipped', 'left-open', 'right-open', 'down-open', 'up-open')
                self.make_draggable(page.front, true)
                self.make_draggable(page.back, false)
            }, 150)//停一下的翻頁視覺效果比較好            
        }
        this.widget.fire('flip', yes)
    }
    , open_to_down: function (page, yes) {
        //page:(object), item of this.pages
        //var page = this.pages[1]
        var self = this
        if (typeof (yes) == 'undefined') yes = !page.ele.classList.contains('flipped')
        if (yes) {
            page.ele.classList.add('flipped', 'down-open')
            setTimeout(function () {
                page.ele.style.zIndex = - Math.abs(parseInt(page.ele.style.zIndex))
                self.make_draggable(page.front, false)
                self.make_draggable(page.back, true)
            })
        }
        else {
            page.ele.style.zIndex = Math.abs(parseInt(page.ele.style.zIndex))
            setTimeout(function () {
                page.ele.classList.remove('flipped', 'left-open', 'right-open', 'down-open', 'up-open')
                self.make_draggable(page.front, true)
                self.make_draggable(page.back, false)
            }, 150)//停一下的翻頁視覺效果比較好          
        }
        this.widget.fire('flip', yes)
    }
    , open_to_up: function (page, yes) {
        //page:(object), item of this.pages
        //var page = this.pages[1]
        var self = this
        if (typeof (yes) == 'undefined') yes = !page.ele.classList.contains('flipped')
        if (yes) {
            page.ele.classList.add('flipped', 'up-open')
            setTimeout(function () {
                page.ele.style.zIndex = - Math.abs(parseInt(page.ele.style.zIndex))
                self.make_draggable(page.front, false)
                self.make_draggable(page.back, true)
            })
        }
        else {
            page.ele.style.zIndex = Math.abs(parseInt(page.ele.style.zIndex))
            setTimeout(function () {
                page.ele.classList.remove('flipped', 'left-open', 'right-open', 'down-open', 'up-open')
                self.make_draggable(page.front, true)
                self.make_draggable(page.back, false)
            }, 150)//停一下的翻頁視覺效果比較好           
        }
        this.widget.fire('flip', yes)
    }
}
var BookWidget = function(ele) {
    Widget.call(this, ele)
    var self = this
    this.image_box = new BookImageBox(this)
}
BookWidget.prototype = _.create(Widget.prototype, {
    constructor: BookWidget,
    clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是CardWidget
        var widget = Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
        return widget
    },
    serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this)
        return data
    },
    deserialize: function (data, is_clone) {
        Widget.prototype.deserialize.call(this, data, is_clone)
        return this
    }
    , reset: function () {
        Widget.prototype.reset.call(this)
    }
    , on_paste: function (data) {
        this.image_box.on_paste(data)
    }
    , on_paste_string: function (text) {
        this.image_box.on_paste_string(text)
    }
})
BookWidget.metadata = {
    category: 'general',
    caption: 'Image Book', //display name for i18n
    description: 'book-style box of images',
    icon: 'fa fa-card',
    //information to render items on action-menu for user to take
    actions: [
        {
            id: 'flip',
            type: 'button',
            text: 'Open-R',
            icon: 'fa fa-trash',
            onClick: function (widget, toolbar) {
                widget.image_box.open_to_right()
            }
        }
        , {
            id: 'flip-left',
            type: 'button',
            text: 'Open-L',
            icon: 'fa fa-trash',
            onClick: function (widget, toolbar) {
                widget.image_box.open_to_left()
            }
        }
    ],
    dashboard: [
    ]
}
BookWidget.factory = function (ele, features) {
    ele.setAttribute('kind', 'BookWidget')
    if (typeof (features) == 'undefined') features = ['draggable', 'resizable', 'rotatable', 'zoomable', 'flippable']
    features.forEach(function (feature) { ele.classList.add(feature) })
    return new BookWidget(ele)
}
BookWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    if (box) box.appendChild(div)
    return BookWidget.factory(div)
}
//WidgetGallery.register(BookWidget)

/*
 * 有圖跟文
 
var TextBubbleWidget = function(ele) {
    Widget.call(this, ele)
    this.ele.classList.add('image_background')
    var self = this
    this.textbox = new TextBoxUnit(this)
}
TextBubbleWidget.prototype = _.create(Widget.prototype, {
    constructor: TextBubbleWidget,
    clone: function (parent_ele) {
        //這個一定要有，如果直接呼叫widget.clone會造成clone出來的物件是Widget，而不是CardWidget
        var widget = Widget.prototype.clone.call(this, parent_ele, this.constructor.factory)
        return widget
    },
    serialize: function (for_clone) {
        var data = Widget.prototype.serialize.call(this)
        return data
    },
    deserialize: function (data, is_clone) {
        Widget.prototype.deserialize.call(this, data, is_clone)
        return this
    }
    , reset: function () {
        Widget.prototype.reset.call(this)
    }
    , on_paste: function (data, evt) {
        if (data.is_file && data.mimetype.indexOf('image/') == 0) {
            // 上傳到系統前，先做圖形處理
            WidgetGallery.singleton.preprocess_file(data.file).done(function (file) {
                //此處也要處理將現有的image刪除的問題
                // 上傳到系統
                WidgetGallery.singleton.upload_widget_file({
                    file: file,
                    name: file.name,
                    uuid: self.unit.id
                }).done(function (filename) {
                    var url = WidgetGallery.singleton.presentation.current_slide.widget_manager.get_file_url(filename)
                    self.set_background(url)
                })
            })
        }
        else {
            console.log('failed to set background image')
        }
    }
    , on_paste_string: function (text, evt) {
        var self = this
        window.slide_resource_factory.from_string(text).done(function (slide_resource) {
            if (slide_resource.type == 'FILE'){
                self.on_paste({
                    is_file:true,
                    file:slide_resource.file,
                    mimetype:slide_resource.kind
                })
            }
            else if (slide_resource.type == 'URL'){
                //only image url make sense
                self.set_background(slide_resource.url)
            }
            else {
                this.textbox.set_text(text)
            }
        })
    }
})
TextBubbleWidget.metadata = {
    category: 'general',
    caption: 'Text Bubble', //display name for i18n
    description: 'a text and an image background',
    icon: 'fa fa-card',
    //information to render items on action-menu for user to take
    actions: [
    ],
    dashboard: [
        {
            id: 'Text',
            text: 'Text',
            items: [
                {
                    type: 'list',
                    label: 'Family',
                    style: 'width:200px',
                    options: function (widget) {
                        return { items: widget.textbox.font_family_options }
                    },
                    get: function (widget) {
                        var style = window.getComputedStyle(widget.textbox.textbox)
                        var family = style.getPropertyValue('font-family')
                        var selected = null
                        var font_family_options = widget.textbox.font_family_options
                        font_family_options.some(function (option) {
                            if (option.text.toLowerCase().indexOf(family.toLowerCase()) >= 0) {
                                selected = option
                                return true
                            }
                        })
                        if (selected == null) {
                            selected = { id: font_family_options.length, text: family }
                            font_family_options.push(selected)
                        }
                        return selected.id
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.textbox.textbox.style.fontFamily = value.text
                        widget.textbox.css['font-family'] = value.text
                    }
                },
                {
                    type: 'color',
                    label: 'Color',
                    get: function (widget) {
                        var color = widget.textbox.css.color
                        if (/rgb\(/.test(color)) {
                            var rgb = []
                            color.match(/\d+/g).forEach(function (v) {
                                rgb.push((v < 16 ? '0' : '') + Number(v).toString(16))
                            })
                            return '' + rgb.join('')
                        }
                        return (color || '000000')
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.textbox.textbox.style.color = '#' + value
                        widget.textbox.css.color = '#' + value
                    }
                },
                {
                    type: 'text',
                    style: 'width:90%;height:25px',
                    label: 'Content',
                    get: function (widget) {
                        return widget.textbox.textbox.innerText
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.textbox.set_text(value)
                    }
                }
                , {
                    type: 'range',
                    style: '',
                    min: 0,
                    max: 10,
                    step: 0.1,
                    label: 'Text Shadow',
                    get: function (widget) {
                        return widget.textbox.css['text-shadow'] || 0
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.textbox.css['text-shadow'] = value
                        var color = widget.textbox.css['shadow-color'] || widget.textbox.css['color']
                        widget.textbox.textbox.style.textShadow = value + 'px ' + value + 'px ' + value + 'px ' + color
                    }
                }
                , {
                    type: 'color',
                    label: 'Shadow Color',
                    get: function (widget) {
                        var color = widget.textbox.css['shadow-color'] || widget.textbox.css['color']
                        if (/rgb\(/.test(color)) {
                            var rgb = []
                            color.match(/\d+/g).forEach(function (v) {
                                rgb.push((v < 16 ? '0' : '') + Number(v).toString(16))
                            })
                            return '' + rgb.join('')
                        }
                        return (color || '000000')
                    },
                    set: function (widget, input_ele) {
                        var value = input_ele.value
                        widget.textbox.css['shadow-color'] = '#' + value
                        var color = '#' + value
                        var value = widget.textbox.css['text-shadow']
                        widget.textbox.textbox.style.textShadow = value + 'px ' + value + 'px ' + value + 'px ' + color
                    }
                },
            ]
        }
    ]
}
TextBubbleWidget.factory = function (ele, features) {
    ele.setAttribute('kind', 'TextBubbleWidget')
    if (typeof (features) == 'undefined') features = ['draggable', 'resizable', 'rotatable', 'zoomable', 'flippable']
    features.forEach(function (feature) { ele.classList.add(feature) })
    return new TextBubbleWidget(ele)
}
TextBubbleWidget.create_sample = function (box) {
    //Gallery呼叫此程式產生樣本物件展示給使用者看
    var div = document.createElement('div')
    if (box) box.appendChild(div)
    return TextBubbleWidget.factory(div)
}
//WidgetGallery.register(TextBubbleWidget)
*/