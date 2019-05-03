/* 
以下是個別Widget的實作 與 helper class
*/

// 所有unit必須 inherited 此class 
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
            // scale is a normalized value
            if (self.metadata.scale) { 
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
    , on_paste: function () {

    }
    , on_dnd: function () {

    }
    , on_paste_string: function () {

    }
    , on_dnd_string: function () {

    }
    , sync: function (payload, do_normalize) {
        //unit's common sync function
        payload.id = this.id
        this.widget.sync(payload, do_normalize)
    }
    , destroy: function () {
        // only remove the unit's node from DOM
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
    , draggable: function () {
        //make this unit draggable
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
    , resizable: function (options) {
        //make this unit resizable and scalable
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
    , load_url: function (url, add_to_metadata) {
        /* 此處不要發出sync事件，避免導致無限循環*/
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
        if (add_to_metadata) this.metadata.src = url.replace(/[&\?]_widget_ts=\d+/, '')
        return promise
    }
    , load_file:function(filename, add_timestamp) {
        /* 
            此file 是在自己的server上的, 寫在metadata.file 而不是 metadata.src
         */
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
    , on_dnd_string: function (text) {
        this.on_paste_string(text)
    }
    , on_paste: function () {
    }
    , on_dnd: function () {
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
