window.mobilecheck = function () {
    var check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};
window.mobileAndTabletcheck = function () {
    var check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};
window.is_iOS = function () {
    return /(iPad|iPhone|iPod)/g.test(navigator.userAgent)
}
window.get_url_from_hash = function (hash, do_encode) {
    // call this to generate url for QRcode
    // given hash should not start with #
    var parts = hash.split(',')
    var hostname = parts[0]
    var filename = parts[1]
    var url_hash = parts[2]
    var default_port = window.location.protocol == 'https:' ? 443 : 80
    var port = (window.location.port == '' || window.location.port == default_port) ? '' : (':' + window.location.port)
    var base = window.location.pathname.replace(/[^\/]+\.html$/, '')
    var url = window.location.protocol + '//' + hostname + port + base + filename + '.html#' + url_hash
    return do_encode ? encodeURIComponent(url) : url
}

/*
 * keyboard shortcut
 */
function KeyboardShortcut(delegate) {
    this.delegate = delegate

    this.handler = {} //{keyname: function}
    this.re_handler = []
    this.re_handler_count = 0

    this.suspend = false

    var self = this
    document.addEventListener('keyup', function () {
        if (self.suspend) return
        var keyid = (window.event) ? window.event.keyCode : evt.keyCode;
    }, false)

    document.addEventListener('keydown', function (evt) {

        if (self.suspend) return

        var key = evt.key.toUpperCase()
        // convert key to upper case
        // prefix keyname with special keys
        var prefix = (evt.metaKey ? 'META' : '') + (evt.ctrlKey ? 'CONTROL' : '') + (evt.altKey ? 'ALT' : '') + (evt.shiftKey ? 'SHIFT' : '')
        var keyname = (prefix == key) ? key : (prefix + (prefix.length ? '-' : '') + key)
        //prevent default to prohibit behavior like "TAB" which focus on navigation bar
        if (self.handle_keyname(keyname)) evt.preventDefault()
    }, false)
}
KeyboardShortcut.prototype = {
    add_hander: function (name, callback) {
        this.handler[name] = callback
    },
    add_handler_of_regex: function (regex, callback) {
        this.re_handler.push([regex, callback])
        this.re_handler_count += 1
    },
    handle_keyname: function (keyname) {
        if (this.handler[keyname]) {
            if (typeof (evt) != 'undefined') {
                evt.preventDefault()
                this.handler[keyname](evt)
            }
            else this.handler[keyname]()
            return true
        }
        else {
            for (var i = 0; i < this.re_handler_count; i++) {
                if (this.re_handler[i][0].test(keyname)) {
                    var callback = this.re_handler[i][1]
                    setTimeout(function () { callback(keyname) }, 0)
                    return true
                }
            }
        }
    }
}


function Resource() {
    this.type = null
    this.html = null
}
Resource.prototype = {
    set_state: function (state) {
        this.type = state.type
        this.html = state.html
    }
}
function Theme() {
    this.classname = null
}
Theme.prototype = {
    set_state: function (state) {
        this.classname = state.classname
    }
}
function SlideOverlay() {
    //this.visible = null
    this.layers = null
}
SlideOverlay.prototype = {
    set_state: function (state) {
        this.layers = state.layers
        //this.visible = state.visible
    },
    add_data: function (layer_index, data) {
        this.layers[layer_index].push(data)
    },
    erase_polyline: function (layer_index, data) {
        //data = color, width, height, length, x0,y0, last_x, last_y (on_draw_erase())
        var chunks = this.layers[layer_index]
        var idx_of_chunk = -1
        for (var i = 0; i < chunks.length; i++) {
            //color, alpha, storke width, width, height, x of first point , y of first point, x1, y1, ....
            var chunk = chunks[i]
            if (chunk[0] == data[0] && chunk[3] == data[1] && chunk[4] == data[2] && chunk.length == (data[3] * 2 + 5) &&
                chunk[5] == data[4] && chunk[6] == data[5] &&
                chunk[chunk.length - 2] == data[6] && chunk[chunk.length - 1] == data[7]) {
                chunks.splice(i, 1)
                idx_of_chunk = i
                break
            }
        }
        return idx_of_chunk
    }
}

/*
function Attachment(){
    this.resoures = []
}
Attachment.prototype = {
    set_state:function(state){

    }
}
*/

function Slide(t_id) {
    /*
     * convert server-side SlideState to js object
     */
    this.t_id = t_id //thread-id
    this.id = null
    this.resource = null
    this.widget_manager = new SlideWidgetManager(this) //see widget.js
    this.slide_overlay = new SlideOverlay()
    this.attachments = []
    this.zoom = [1, [0, 0], [0, 0]]
    this.translate = [0, 0]
    this.idx = null

    //this.extra = null //for video slide this is [state,time of playhead,timestamp]

    // this value is generated in thread because t_id is required
    this.url = '/404.html'

    //video, google slide, url, etc
    this.is_embedded = false

}
Slide.prototype = {
    set_state: function (state) {
        this.id = state.id
        this.resource = state.resource
        this.slide_overlay.set_state(state.overlay)
        // state.widget is temporary not available for all slides (in development)
        if (state.widgets) this.widget_manager.set_state(state.widgets)
        this.zoom = state.zoom
        this.translate = state.translate
        this.on_state_changed()
    },
    make_url: function (p_id, flag, t_id) {
        if (this.resource.type == 'BLANK') {
            if (this.resource.bg) {
                this.url = window.sdk.access_path + '@/sidebyside/raw_whiteboard?p=' + p_id + '&f=' + flag + '&t=' + t_id + '&b=' + this.resource.bg
            }
            else {
                this.url = null
            }
        }
        else if (this.resource.type == 'VIDEO') {
            //do nothing
        }
    },
    set_bg: function (p_id, flag, t_id, filename) {
        this.resource.bg = filename
        this.make_url(p_id, flag, t_id)
    },
    on_state_changed: function () {
        this.is_embedded = this.resource.type == 'VIDEO' ||
            (this.resource.type == 'URL' && !(this.resource.kind && /image/.test(this.resource.kind))) ||
            (this.resource.type == 'OP' && this.resource.kind == 'GS')
    },
    update_resouce_data: function (presentation, data) {
        //before calling this, ensure self.resource.data has been updated
        //this is called to sync detail state of embedded slide (ex, VIDEO, Google slides)
        var self = this

        var video_sync = function () {
            //sync video of youtube
            var player_state, player_time, player_now
            if (data) {
                player_state = data[0]
                player_time = data[1]
                player_now = data[2]
                self.resource.extra[0] = player_state
                self.resource.extra[1] = player_time
            }
            else {
                player_state = self.resource.extra[0]
                player_time = self.resource.extra[1]
                player_now = Math.floor(new Date().getTime() / 1000)
            }
            var player = presentation.delegate.get_video_player()
            if (player && (!presentation.isolated)) {
                // embedded screen ignores video sync unless it is interanlly called

                //prohibit player's broadcat sync event
                player._no_sync = true
                //allow play to broadcast sync event after 3 seconds
                _.delay(function () {
                    player._no_sync = false
                }, 3000)


                var ts = player.getCurrentTime()
                // if state is playing, add transimisson time difference to player_time
                var time_diff = (new Date().getTime() / 1000 - player_now)
                var seek_time = player_time + (player_state == 1 ? (time_diff > 0 ? time_diff : 0) : 0)
                var do_seek = Math.abs(ts - seek_time) > 2
                //console.log('doskeek =',do_seek, time_diff, ts, seek_time)
                var state = player.getPlayerState()

                if (do_seek) {
                    player.seekTo(seek_time)
                }
                var change_stage = state !== player_state
                //console.log('======= ',do_seek, player_time, seek_time,change_stage, player_state)                    
                if (change_stage) {
                    _.delay(function () {
                        //console.log('video state change:',player.getPlayerState(),'to', player_state,'seek to ',player_time)
                        //adjuest playertime with transvesal time                            
                        switch (player_state) {
                            case 0://dended
                                player.stopVideo()
                                break
                            case 1://playing
                                player.playVideo()
                                break
                            case 2://pause
                                player.pauseVideo()
                                break
                        }
                    }, 1000)
                }
            }
        }
        var gs_sync = function () {
            var page_no = data ? data[0] : self.resource.extra[0]
            self.go_page(page_no, true)
            //update local data
            if (data) self.resource.extra[0] = page_no
        }

        switch (self.resource.type) {
            case 'VIDEO':
                video_sync()
                break
            case 'OP':
                //if slide.resource.data.kind == 'GS'
                gs_sync()
                break
        }
    }
}
function Thread() {
    this.name = null
    this.theme = new Theme()
    this.slides = []
    this.id = null
    //this.slide_index = -1 obsoleted
    this._slide = null //cache
}
Thread.prototype = {
    set_state: function (p_id, flag, t_state) {
        var self = this
        this.id = t_state.id
        this.name = t_state.name
        this.theme.set_state(t_state.theme)
        this.slides = []
        _.each(t_state.slides, function (s_state, idx) {
            self.add_slide(p_id, flag, s_state, -1)
            s_state.idx = idx
        })
    },
    reindex: function () {
        var self = this
        _.each(self.slides, function (s_state, idx) {
            s_state.idx = idx
        })
    },
    add_slide: function (p_id, flag, s_state, insert_at) {
        var slide = new Slide(this.id)
        slide.set_state(s_state)
        //generate slide's url property
        slide.make_url(p_id, flag, this.id)
        if (insert_at == -1) {
            this.slides.push(slide)
            slide.idx = this.slides.length - 1
        }
        else {
            this.slides.splice(insert_at, 0, slide)
            //re-index
            for (var idx = insert_at; idx < this.slides.length; idx++) {
                this.slides[idx].idx = idx
            }
        }
    },
    get_slide_of_id: function (s_id) {
        for (var i = 0; i < this.slides.length; i++) {
            if (this.slides[i].id == s_id) return this.slides[i]
        }
        return null
    },
    set_slide_by_id: function (presentation, s_id, transition, promise) {
        //called locallly and remotely, not to ask for sync
        /*
         * Argumenst: instance of Presentaion()
         *  Why? beacuse Thread object could be shared by two Presentation instances.(dashboard and its embedded screen)
         */
        var self = this
        presentation.fire('PAGE-WILL-CHANGE')
        var slide = this.get_slide_of_id(s_id)
        // starts the rendering process of the slide      
        //auto choose transition if not given and not in iframe (dashboard's embeded screen)
        if (!transition) {
            // if idx is the same, use 'pop-in', otherwise, slide-right or slide-left(next)
            transition = self._slide ? (slide.idx == self._slide.idx ? 'pop-in' : (slide.idx > self._slide.idx ? 'slide-left' : 'slide-right')) : ''
        }
        this._slide = slide
        presentation.current_slide = slide
        presentation.delegate.render_slide(this, slide, transition).done(function (ignored) {
            if (ignored) {
                if (promise) _.defer(function (x) { x.resolve() }, promise)
                //this ignored value is true in remotecontroller.js (dummy delegate)
                return
            }
            //update zooming
            if (promise) _.defer(function (x) { x.resolve() }, promise)
            presentation.fire('PAGE-DID-CHANGE', { page_no: slide.idx + 1 })
        })
        return slide
    }
}

function Presentation(p_id, delegate, options) {
    this.p_id = p_id //p_id is acutally the token to access the presentation(without flag)
    /* 
     * delegate should implement: 
     *   get_zooming_area()//return null, if not having to support zoom
     *   get_flag_of_token()
     *   on_message()
     * 
     *   // called if presentation has no slide
     *   on_no_slide() 
     *
     *   // called if thread, slides added
     *   on_added([thread|slides],{t_id:t_id, slides:slides}) 
     *   // called if the presentation, thread or slides has removed from server
     *   on_removed([presentation|thread|slides]) 
     *   // called if the slides swapped
     *   on_swapped(thread)
     * 
     *   //called to set pointer's state
     *   on_pointer(enable_disable_boolean, pointer_positio)
     *   
     *   on_origin(enabled)
     *
     *   // called if there is no thread in presentation anymore (after thread removed)
     *   on_no_thread()
     * 
     *   // called if there is (or not) thread can be created
     *   on_no_more_thread(boolean)
     * 
     *   // called if failed to get presentation of give p_id
     *   on_get_presentation_error() 
     *   
     *   // called if failed to refresh presentation's some state
     *   on_refresh_state_error()
     * 
     *   // called if succeed refresh presentation's some state
     *   on_refresh_state_did(topic, value)
     * 
     *   // called if speaker screen or audience screen has shutdown
     *   on_shutdown()
     *   render_slide(thread,slide,transtion)
     *   toggle_toolbar()
     * 
     * options:
     *  keyboard_shortcut:false. boolean, (true to enable)
     *  isolated:false, if true, keyboard_shortcut enforced to be false
    */

    //will be assigned later if not readonly
    this.delegate = delegate
    this.options = options
    this.passcode = options.passcode
    this.max_slides = options.max_slides
    // isolated state is used if this is an embedded screen of the dashboard
    // isolated screen does not sync current slide to or from others
    // so, its current_thread and current_slide is not of the same meaning as a sync-ed screen.
    this.isolated = typeof (options.isolated) == 'undefined' ? false : options.isolated
    // enable keyboard_shortcut only not isolated
    if (options.keyboard_shortcut && (!this.isolated)) {
        var self = this
        this.keyboard_shortcut = new KeyboardShortcut(this)
        var ks = this.keyboard_shortcut
        /* define keyboard shortcut handler */
        // move to next slide: space, arrow-down, arrow-right
        ks.handler[' '] = ks.handler['PAGEDOWN'] = ks.handler['ARROWRIGHT'] = ks.handler['ARROWDOWN'] = _.throttle(
            function () { self.next_slide() }
            , 250)

        // move to previous slide: arrow-up, arrow-left
        ks.handler['ARROWLEFT'] = ks.handler['PAGEUP'] = ks.handler['ARROWUP'] = _.throttle(
            function () { self.previous_slide() }
            , 250)

        // change source (for temporary developing)
        ks.handler['TAB'] = _.throttle(function () { self.next_thread() }, 500)
        ks.handler['SHIFT-TAB'] = _.throttle(function () { self.previous_thread() }, 500)

        ks.handler['T'] = function () { self.toggle_toolbar() }

        ks.handler['ESCAPE'] = function () {
            self.fire('ESCAPE')
        }
    }
    else {
        this.keyboard_shortcut = null;
    }
    this.name = ''
    this.sdk = null
    this.threads = {}
    this.thread_settings = null
    //this.presentation_layout = new PresentationLayout()
    this.settings = {}
    this._change_lock = false
    this._change_lock_interval = 250

    //cache to speed up callback of overlay.ondraw
    this.current_slide = null
    this.current_thread = null

    //temporary cached, per browser to decide, not synced, not saved
    this._toolbar_visible = true

    // trying to enable supports of zooming slide
    this._screen_rect = null
    //scale of current slide, just cache, don't trust
    this._scale = 1
    //translate of current slide
    this._translate = [0, 0]

    this.acl_token = null
    this.bus_room_id = null
    this.flag = null
    this.is_owner = false //presentation owner
    this.is_binder = false //binding to other
    this.is_binded = false //binded by others
    this.hostname = null

    //for audience, this can not change presentation's state
    this.readonly = null
    this.max_number_of_thread = 26
    //an presentation to share bus payload (aka embedded screen's presentation)
    this.co_presentation = null

    this.members_count = 1 //how many members in this presentation
    this.listener = {}

    //allow user to break syncing with others
    this.syncing = true
    //block these topics to be send when this.syncing is false
    this.no_sync_topics = ['slide-sync']
    //this.no_sync_topics = ['refresh','slide-sync','pointer-meta','pointer']
}

Presentation.prototype = {
    on: function (name, callback) {
        // evtname currently supports: 
        // ESCAPE
        /*
        if (this.listener[evtname]) this.event_listener[evtname].push(callback)
        else this.event_listener[evtname] = [callback]
        */

        if (!this.listener[name]) {
            this.listener[name] = {}
        }
        var func_name = callback.name || ('f' + Widget.counter++)
        this.listener[name][func_name] = callback
        return func_name

    },
    off: function (name, callback) {
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
    fire: function (name) {
        /*
        if (this.event_listener[evtname]) {
            _.each(this.event_listener[evtname], function (callback) {
                //如果 fire delay的話，listener取到的資料可能已經過時了
                //例如， PAGE-WILL-CHANGE收到時，current_slide已經改變
                //所以 delay被取消了。
                //setTimeout(function(){
                try {
                    if (callback) callback(evtdata)
                }
                catch (e) {
                    //console.log('evtname = ',evtname,'callback=',callback)
                    console.warn(e)
                }
                //})
            })
        }
        */
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
        if (this.listener[name]) {
            args.shift()//remove name
            for (var func_name in self.listener[name]) {
                try {
                    self.listener[name][func_name].apply(self, args)
                } catch (e) { console.warn(e) }
            }
        }       
    },    
    clone: function (src_presentation) {
        //screen.js call this to get value for its instance of presentation
        this.name = src_presentation.name
        this.sdk = src_presentation.sdk
        this.threads = src_presentation.threads
        //this.presentation_layout = src_presentation.presentation_layout.clone()
        this.settings = _.clone(src_presentation.settings)
        this.hostname = src_presentation.hostname
        this.bus_room_id = src_presentation.bus_room_id
        this.acl_token = src_presentation.acl_token
        //objects to clone
        this.thread_settings = _.clone(src_presentation.thread_settings)
        //registered to share bus's payload
        src_presentation.co_presentation = this
        this.co_presentation = src_presentation
        //get from myself's delegate
        this.flag = this.delegate.get_flag_of_token()
        this.passcode = src_presentation.passcode

    },
    init: function (sdk) {
        this.sdk = sdk
        this.flag = this.delegate.get_flag_of_token()
        var self = this
        var promise = new $.Deferred()
        // 2019-03-09T08:35:55+00:00 這個取回簡報資料的功能似乎應該移到sbs_user比較一致
        var cmd = sdk.metadata.runner_name + '.root.sidebyside.get_presentation_state'
        sdk.send_command(new Command(cmd, [this.p_id, this.flag, null, this.passcode])).done(function (response) {
            if (response.retcode == 400) {
                //binder error, should remove cookie,logout and reload                
                document.cookie = response.stderr.data.cookie
                w2alert('Binding has breaken').done(function () {
                    location.href = '../logout?next=' + location.pathname
                })
                return
            }
            else if (response.retcode == 0) {
                //initial rendering
                var p_state = response.stdout
                //console.log(p_state)
                //hostname is used when generating qrcode

                if (window.location.hostname == 'localhost') {
                    self.hostname = p_state.hostname
                }
                else if (/\d+\.\d+\.\d+\.\d+/.test(window.location.hostname)) {
                    //replace IP with hostname
                    self.hostname = p_state.hostname
                }
                else {
                    self.hostname = window.location.hostname
                }
                //console.log('p_state=',p_state)
                self.name = p_state.name
                self.acl_token = p_state.acl_token
                self.bus_room_id = p_state.bus
                self.readonly = (self.flag == 3) ? true : false //audience screen is readonly
                self.is_owner = p_state.is_owner

                self.is_binder = p_state.binding.binder || false //if true, this is binded board's name
                self.is_binded = p_state.binding.binded //if true, this is number of binder
                //delete p_state.binding

                //fix a samentic confusion
                if (self.is_binder) self.is_owner = false

                document.title = self.name

                // if is in iframe, do not enable keyboard-shortcut
                //set keyboard bindings               
                if (self.keyboard_shortcut) {
                    if (self.readonly) {
                        // in audience screen
                        // partially keep handlers
                        self.keyboard_shortcut.handler = {
                            T: self.keyboard_shortcut.handler['T'] //toggle toolbar
                        }
                    }
                    else {
                        // in speaker screen
                        // add ESC to restore zooming and slide's position
                        //self.keyboard_shortcut.handler['Escape'] = function () {
                        self.on('ESCAPE',function(){
                            self.current_slide.zoom = [1, [0, 0], [0, 0]]
                            self.current_slide.translate = [0, 0]
                            self.delegate.reset_zooming()
                            //scale = 1.0 //?why this
                            var t_id = self.current_thread.id
                            var s_idx = self.current_thread.slides.indexOf(self.current_slide)
                            self.send_to_bus('zoom-sync', [t_id, s_idx, 1, [0, 0], [0, 0]])
                        })
                    }

                }
                self.thread_settings = p_state.thread_settings
                //self.presentation_layout.set_state(p_state.presentation_layout)
                self.settings = p_state.settings

                for (var t_id in p_state.threads) {
                    var thread = new Thread(self)
                    thread.set_state(self.p_id, self.flag, p_state.threads[t_id])
                    self.threads[t_id] = thread
                }

                //open thread to sync with server
                self.join_bus()

                //this is a chance for delegate to initialize after p_state is available
                promise.resolve(self)
            }
            else {
                console.warn(response.stderr)
                //self.delegate.on_get_presentation_error({code:response.retcode,message:response.stderr})
                promise.reject(response.stderr,response.retcode)
            }
        }).fail(function (err) {
            console.warn(err)
            promise.reject({ code: -1, message: err })
            self.delegate.on_refresh_state_error(err)
        })
        return promise
    },
    refresh_state: function (topic) {
        //retrieve partical property of the presentation
        var self = this
        var promise = new $.Deferred()
        var cmd = sdk.metadata.runner_name + '.root.sidebyside.get_presentation_state'
        sdk.send_command(new Command(cmd, [this.p_id, this.flag, topic, this.passcode])).done(function (response) {
            if (response.retcode == 0) {
                //initial rendering                
                var value = response.stdout
                switch (topic) {
                    case 'acl_token':
                        self.acl_token = value
                        self.delegate.on_refresh_state_did('acl_token', value)
                        break
                }
                promise.resolve({ topic: topic, value: value })
            }
            else {
                console.warn(response.stderr)
                promise.reject({ code: response.retcode, message: response.stderr })
                self.delegate.on_refresh_state_error(response.stderr)
            }
        }).fail(function (err) {
            console.warn(err)
            promise.reject({ code: -1, message: err })
            self.delegate.on_refresh_state_error(err)
        })
        return promise
    },
    /*
    get_current_thread: function () {
        //var t_id = this.presentation_layout.panels[panel_name]
        var t_id = this.settings.focus
        return t_id ? this.threads[t_id] : null
    },*/
    //previous on_thread_changed
    change_to_thread: function (t_id) {
        //call this to update rendering when thread_index has changed
        // before calling this, two variable has to be set
        // 1. this.presentation_layout.panels[panel_name] to id of the new thread
        // 2. this.thread_settings[thread.id].slide_id    to id of the slide of the new thread
        //var panel_name = 'main'
        //var thread = this.get_current_thread()
        //var t_id = this.settings.focus
        
        if (typeof(t_id) == 'undefined') t_id = this.settings.focus
        else this.settings.focus = t_id

        var thread = this.threads[t_id] || null
        this.current_thread = thread
        if (thread == null) {
            // no thread
            this.current_slide = null
            this.delegate.on_no_thread()
            return $.when()
        }
        else {
            var promise = new $.Deferred()
            var slide_id = this.thread_settings[thread.id].slide_id
            thread.set_slide_by_id(this, slide_id, 'pop-in', promise)
            return promise
        }
    },
    //implement KeyboardShortcut delegation
    save: function () {
        /*
        this.sdk.bus.broadcast(this.p_id,{
            topic:'save'
        })
        */
    },
    //sync to server
    on_bus: function (payload, interally_called) {
        //interally_called is true, if this is not triggered by remote sync
        var self = this
        //console.log(location.pathname+':bus>>',payload,'delegate to',self.delegate.constructor.name)
        switch (payload.topic) {
            //case 'test':
            //    self.delegate.overlay.img.move(payload.data[0], payload.data[1])
            //   break
            case 'draw-sync':
                var action = payload.data[0]
                var t_id = payload.data[1]
                var s_idx = payload.data[2]
                var layer_index = payload.data[3]
                switch (action) {
                    case 'draw':
                        var data = payload.data[4]
                        if (t_id == self.current_thread.id && s_idx == self.current_slide.idx) {
                            self.current_slide.slide_overlay.add_data(layer_index, data)
                            //make a copy of chunk
                            self.delegate.overlay.draw_sync(payload.data[4].slice(0))
                        }
                        else {
                            self.threads[t_id].slides[s_idx].slide_overlay.add_data(layer_index, data)
                        }
                        break
                    case 'erase':
                        var slide
                        if (t_id == self.current_thread.id && s_idx == self.current_slide.idx) {
                            self.delegate.overlay.eraser_sync(payload.data[4])
                            slide = self.current_slide
                        }
                        else {
                            slide = self.threads[t_id].slides[s_idx]
                        }
                        slide.slide_overlay.erase_polyline(layer_index, payload.data[4])
                        break
                    case 'clear':
                        if (t_id == self.current_thread.id && s_idx == self.current_slide.idx) {
                            self.current_slide.slide_overlay.layers[layer_index] = []
                            self.delegate.overlay.clear()
                        }
                        else {
                            self.threads[t_id].slides[s_idx].slide_overlay.layers[layer_index] = []
                        }
                        break
                }
                break
            case 'slide-sync':
                //var panel_name = payload.data[0]
                var t_id = payload.data[0]
                var s_idx = payload.data[1]
                var thread = self.threads[t_id]

                //update local data structure
                var slide
                if (s_idx == null) {
                    var s_id = self.thread_settings[t_id].slide_id
                    slide = thread.get_slide_of_id(s_id)
                }
                else if (t_id == self.current_thread.id && s_idx == self.current_slide.idx) {
                    slide = self.current_slide
                }
                else {
                    slide = thread.slides[s_idx]
                    self.thread_settings[t_id].slide_id = slide.id
                }

                //update screen
                if (self.isolated) {
                    /*skip (screen.html in dashboard)*/
                }
                else if (self.syncing) {
                    if (self.current_thread.id == t_id) {
                        var slide_resouce_data = payload.data.length > 2 ? payload.data[2] : false
                        self.set_slide(slide, slide_resouce_data)
                    }
                    else {
                        //by setting these two to change thread
                        //self.presentation_layout.panels[panel_name] = t_id
                        //self.settings.focus = t_id
                        self.change_to_thread(t_id).done(function () {
                            if (payload.data.length > 2) slide.update_resouce_data(self, payload.data[2])
                        })
                    }
                }
                else {
                    //do nothing
                }
                break
            case 'zoom-sync':
                //  payload.data is [scale,offsetX, offsetY]
                var t_id = payload.data[0]
                var s_idx = payload.data[1]
                var zoom_data = _.slice(payload.data, 2) //exclude t_id,s_id from payload_data
                if (zoom_data[0] == 1) {
                    self.threads[t_id].slides[s_idx].zoom = [1, 0, 0]
                    self.threads[t_id].slides[s_idx].translate = [0, 0]
                }
                else {
                    self.threads[t_id].slides[s_idx].zoom = zoom_data
                }
                if (self.syncing && t_id == self.current_thread.id && s_idx == self.current_slide.idx) {
                    if (zoom_data[0] == 1) {
                        //self.current_slide.zoom = [1,0,0]
                        //self.current_slide.translate = [0,0]
                        self.delegate.reset_zooming()
                    }
                    else {
                        //self.current_slide.zoom = zoom_data
                        self.delegate.set_zooming(zoom_data[0], zoom_data[1], zoom_data[2], true)
                        //inform delegate to update zooming data
                        self.fire('ZOOM_CHANGED')
                    }
                }
                break
            case 'translate-sync':
                var t_id = payload.data[0]
                var s_idx = payload.data[1]
                var left = payload.data[2]
                var top = payload.data[3]
                self.threads[t_id].slides[s_idx].translate[0] = left
                self.threads[t_id].slides[s_idx].translate[1] = top
                if (self.syncing && t_id == self.current_thread.id && s_idx == self.current_slide.idx) {
                    //current slide
                    self.fire('OFFSET', [left, top])
                }
                else {
                    //ignore
                }
                break
            case 'cue-sync':
                var t_id = payload.data[0]
                var s_idx = payload.data[1]
                var point = payload.data[2]
                point.x = point.x/1000 * self.delegate.page_rect.width
                point.y =  point.y/1000 * self.delegate.page_rect.height
                self.delegate.cue(point)
                break
            // managemental sync starts
            case 'shutdown':
                if (self.isolated) {
                    /*skip*/
                }
                else {
                    // even !this.syncing should response to this message
                    switch (payload.data[0]) {
                        case 'speaker-screen':
                            //close both speaker-screen and audience-screen
                            if (self.flag == 2 || self.flag == 3) {
                                self.delegate.on_shutdown('speaker_screen')
                            }
                            else if (self.flag == 1 || self.flag == 4) {
                                //also trigger acl_token refresh event for dashboard
                                if (self.acl_token.ss) {
                                    self.acl_token.ss = null
                                    self.delegate.on_refresh_state_did('acl_token', self.acl_token)
                                }
                            }
                            break
                        case 'audience-screen':
                            if (self.flag == 3) {
                                self.delegate.on_shutdown('audience_screen')
                            }
                            else if (self.flag == 1 || self.flag == 4) {
                                //also trigger acl_token refresh event for dashboard
                                if (self.acl_token.as) {
                                    self.acl_token.as = null
                                    self.delegate.on_refresh_state_did('acl_token', self.acl_token)
                                }
                            }
                            break
                        case 'dashboard-sharing':
                            if (self.flag == 4) {
                                //also trigger acl_token refresh event for dashboard
                                //owner's dashboard is not included, because owner 
                                //can enable/disable dashboard only                                
                                self.delegate.on_shutdown()
                                self.acl_token.ds = null
                                self.delegate.on_refresh_state_did('acl_token', self.acl_token)
                            }
                            break
                    }
                }
                break
            case 'refresh':
                switch (payload.data[0]) {
                    case 'acl_token':
                        // even !this.syncing should response to this message
                        if (self.flag == 1 || self.flag == 4) {
                            self.refresh_state('acl_token')
                        }
                        break
                    case 'slides':
                        //"reset-all-slides" is called
                        //slide reset in whiteboard (['slide',t_id, s_state])
                        var t_id = payload.data[1]
                        var changed_s_states = payload.data[2]
                        var thread = self.threads[t_id]
                        var current_slide_has_reset = false
                        for (var i = 0; i < changed_s_states.length; i++) {
                            var s_idx = changed_s_states[i][0]
                            if (s_idx == self.current_slide.idx) current_slide_has_reset = true
                            thread.slides[s_idx].widget_manager.purge_widgets()
                            thread.slides[s_idx].set_state(changed_s_states[i][1])
                        }
                        //refresh slide
                        if (current_slide_has_reset) {
                            self.rerender_current_slide()
                        }
                        break
                    case 'bgcolor':
                        // many events like change background color, change resource content (like paste text)
                        // would annouce this message(bad?)
                        // even !this.syncing should response to this message
                        var t_id = payload.data[1]
                        var s_idx = payload.data[2]
                        var resource_state = payload.data[3]
                        var thread = self.threads[t_id]
                        var slide = thread.slides[s_idx]
                        for (var name in resource_state) {
                            slide.resource[name] = resource_state[name]
                        }
                        slide.on_state_changed()
                        var filename = resource_state.bg
                        if (self.current_slide == slide) {
                            var flag = self.delegate.get_flag_of_token()
                            self.current_slide.set_bg(self.p_id, flag, t_id, filename)
                            self.rerender_current_slide()
                        }
                        else {
                            var flag = self.delegate.get_flag_of_token()
                            self.threads[t_id].slides[s_idx].set_bg(self.p_id, flag, t_id, filename)
                        }
                        break
                    case 'scroll':
                        var t_id = payload.data[1]
                        var s_idx = payload.data[2]
                        var normalized_scroll_left = payload.data[3]
                        var normalized_scroll_top = payload.data[4]
                        var thread = self.threads[t_id]
                        var slide = thread.slides[s_idx]
                        slide.resource.scroll = [normalized_scroll_left, normalized_scroll_top]
                        if (self.syncing && self.current_slide == slide) {
                            //to access DOM by presentation.js is not good style
                            self.fire('SCROLL', [normalized_scroll_left, normalized_scroll_top])
                        }
                        break
                    case 'text-hilight':
                        var t_id = payload.data[1]
                        var s_idx = payload.data[2]
                        var line_no = payload.data[3]
                        var hilight = payload.data[4]
                        var thread = self.threads[t_id]
                        var slide = thread.slides[s_idx]
                        if (hilight) {
                            slide.resource.hilight.push(line_no)
                        }
                        else if (line_no == -1) {
                            //remove all hilights
                            slide.resource.hilight.splice(0, slide.resource.hilight.length)
                        }
                        else {
                            var idx = slide.resource.hilight.indexOf(line_no)
                            slide.resource.hilight.splice(idx, 1)
                        }
                        if (self.syncing && self.current_slide == slide) {
                            self.fire('UPDATE-HILIGHTS', { hilight: hilight, line_no: line_no })
                        }
                        break
                    case 'text-wrap':
                        var t_id = payload.data[1]
                        var s_idx = payload.data[2]

                        var thread = self.threads[t_id]
                        var slide = thread.slides[s_idx]
                        if (self.syncing && self.current_slide == slide) {
                            var line_length = payload.data[3]
                            self.fire('TEXT-WRAP', line_length)
                        }
                        break
                    case 'ratio':
                        if (payload.data[1] == 4) {
                            self.settings.ratio[0] = 4
                            self.settings.ratio[1] = 3
                        }
                        else {
                            self.settings.ratio[0] = 16
                            self.settings.ratio[1] = 9
                        }
                        window.dispatchEvent(new Event('resize'));
                        break
                }
                break
            case 'add':
                switch (payload.data[0]) {
                    case 'slide':
                        var t_id = payload.data[1].t
                        var s_state = payload.data[1].s
                        var insert_at = payload.data[1].i
                        var as_focus = payload.data[1].fo
                        var thread, topic
                        thread = self.threads[t_id]
                        self.threads[t_id].add_slide(self.p_id, self.flag, s_state, insert_at)
                        topic = payload.data[0]
                        var s_idx = insert_at == -1 ? thread.slides.length - 1 : insert_at
                        _.defer(function () { self.fire('SLIDE-ADDED', [t_id, s_idx, as_focus]) })
                        break
                    /* obsoleted in whiteboard.js, maybe dashboard has broken 
                    case 'slides':
                        var t_state = payload.data[1].t
                        var s_ids = payload.data[1].s
                        var insert_at =  payload.data[1].i
                        var as_focus = payload.data[1].fo
                        var t_id = t_state.id
                        var thread, topic
                        if (self.threads[t_id]){
                            thread = self.threads[t_id]
                            
                            self.threads[t_id].set_state(self.p_id,self.flag,t_state)
                            if (self.current_thread.id == t_id){
                                //because thread's slide objects has been recreated by calling set_state()
                                //so we have to re-build the link value of self.current_slide
                                self.current_slide = self.threads[t_id].get_slide_of_id(self.thread_settings[t_id].slide_id)
                            }
                            topic = 'slides'
                            _.defer(function(){self.fire('SLIDE-ADDED',[t_id,s_ids,as_focus])})
                        }
                        else{
                            thread = new Thread(self)
                            thread.set_state(self.p_id,self.flag,t_state)
                            self.threads[t_id] = thread
                            if (_.size(self.threads) >= self.max_number_of_thread) self.delegate.on_no_more_thread(true)
                            topic = 'thread'
                        }
                        //refresh thread-settings if not having slide-id in thread-settings
                        if ((!(self.thread_settings[t_id] && self.thread_settings[t_id].slide_id)) && thread.slides.length){
                            self.thread_settings[t_id] = {slide_id:thread.slides[0].id}

                            //ask to render slide if currently is no-slide
                            var panel_name = 'main'
                            
                            if (!self.presentation_layout.panels[panel_name]){
                                self.presentation_layout.panels[panel_name] = t_id
                                self.on_thread_changed()
                            }
                            else if (self.presentation_layout.panels[panel_name] == t_id){
                                self.on_thread_changed()
                            }
                            
                        }
                        self.delegate.on_added(topic,{t_id:t_id})
                        break
                    */
                }
                break
            case 'remove':
                switch (payload.data[0]) {
                    case 'presentation':
                        self.delegate.on_removed('presentation')
                        break
                    case 'thread':
                        var t_id_removed = payload.data[1]
                        var t_id_focus = payload.data[2]
                        //update local data copy
                        delete self.threads[t_id_removed]
                        delete self.thread_settings[t_id_removed]
                        self.change_to_thread(t_id_focus)
                        t_id_removed
                        self.delegate.on_removed('thread', { t_id_removed: t_id_removed, t_id_focus: t_id_focus })
                        self.delegate.on_no_more_thread(false)
                        break
                    case 'slides-idx':
                        var t_id = payload.data[1]
                        var s_idxes = payload.data[2]
                        // update data model
                        if (s_idxes == '__ALL__') {
                            // payload.data[3][0] = [0, new state of slide(0)]
                            var new_1st_state = payload.data[3][0][1]
                            self.threads[t_id].slides.splice(1)
                            self.threads[t_id].slides[0].widget_manager.purge_widgets()
                            self.threads[t_id].slides[0].set_state(new_1st_state)
                            var new_s_id = self.threads[t_id].slides[0].id
                            var slide_id_changed = true //enforce to refresh

                        }
                        else {
                            var s_index_to_remove = s_idxes
                            s_index_to_remove.sort(function (a, b) { return a > b ? 1 : (a < b ? -1 : 0) })
                            s_index_to_remove.reverse()
                            _.each(s_index_to_remove, function (idx) {
                                self.threads[t_id].slides[idx].widget_manager.purge_widgets()
                                self.threads[t_id].slides.splice(idx, 1)
                            })
                            var slide_id_changed = false
                            var new_s_idx = payload.data[3]
                            var new_s_id = null
                            if (new_s_idx >= 0) {
                                // when new_s_idx == -1, current focus slide would not be changed
                                // according to server-side's data
                                slide_id_changed = true
                                new_s_id = self.threads[t_id].slides[new_s_idx].id
                            }
                        }
                        self.threads[t_id].reindex()
                        if (slide_id_changed) {
                            self.thread_settings[t_id].slide_id = new_s_id
                        }

                        //udpate rendering slide
                        if (slide_id_changed && self.current_thread.id == t_id) {
                            self.current_thread.set_slide_by_id(self, new_s_id)
                        }

                        //inform delegate
                        self.delegate.on_removed('slides', { t_id: t_id })

                        _.defer(function () { self.fire('SLIDE-REMOVED', [t_id]) })

                        break
                }
                break
            case 'swap':
                switch (payload.data[0]) {
                    case 'slides':
                        var src_states = []
                        var src_indexes = []
                        var t_id = payload.data[1]
                        var t_state = self.threads[t_id]
                        var remote_src = payload.data[2] //a list
                        var remote_dst = payload.data[3]
                        _.each(remote_src, function (idx) {
                            src_states.push(t_state.slides[idx])
                            //src_indexes.push(idx)
                        })
                        var dst_state = t_state.slides[remote_dst]
                        //src_index.sort()
                        remote_src.sort(function (a, b) { return a > b ? 1 : (a < b ? -1 : 0) })
                        remote_src.reverse()
                        //src_index.reverse()
                        for (var i = 0; i < remote_src.length; i++) {
                            t_state.slides.splice(remote_src[i], 1)
                        }
                        if (remote_dst == -1) {
                            var dst_new_idx = t_state.slides.length
                        }
                        else {
                            var dst_new_idx = t_state.slides.indexOf(dst_state)
                        }
                        var args = [dst_new_idx, 0].concat(src_states)
                        t_state.slides.splice.apply(t_state.slides, args)
                        //self.render_thread_tab(active_tab)
                        self.delegate.on_swapped(t_state)
                        break
                }
                break
            case 'pointer':
                if (self.syncing) self.delegate.on_pointer(null, payload.data)
                break
            case 'pointer-meta':
                self.delegate.on_pointer(payload.data)
                break
            case 'misc-sync':
                switch (payload.data[0]) {
                    /* overlay:visible seems to be obsoleted
                    case 'overlay:visible':
                        var t_id = payload.data[1]
                        var s_idx = payload.data[2]
                        var visible = payload.data[3]
                        //console.log('overy-visible',self.isolated, t_id,s_idx,'current=',self.current_thread.id,self.current_slide.idx )
                        if (t_id == self.current_thread.id && s_idx==self.current_slide.idx){
                            self.current_slide.slide_overlay.visible = visible
                            self.delegate.overlay.show(visible)
                            //temporary implementation
                            self.delegate.fire('overlay:visible',visible)
                        }
                        else{
                            self.threads[t_id].slides[s_idx].slide_overlay.visible = visible                                
                        }
                        break
                    */
                    /* moved to be draw-sync
                    case 'overlay:clear':
                        var t_id = payload.data[1]
                        var s_idx = payload.data[2]
                        var layer_idx = payload.data[3]
                        if (t_id == self.current_thread.id && s_idx==self.current_slide.idx){
                            self.current_slide.slide_overlay.layers[layer_idx] = []
                            self.delegate.overlay.clear()
                        }
                        else{
                            self.threads[t_id].slides[s_idx].slide_overlay.layers[layer_idx] = []                           
                        }
                        break
                    */
                    /* moved to pointer-meta
                    case 'pointer':
                        self.delegate.on_pointer(payload.data[1])
                        break */
                    case 'origin':
                        if (!self.readonly) {
                            var enabled = payload.data[1] == 1
                            self.delegate.on_origin(enabled)
                        }
                        break
                    case 'unbinded':
                        //this sync is targeting a binding target
                        //if not is_binded, no need to handle this event
                        if (self.is_binded) {
                            //request the most updated binded count
                            var cmd = sdk.metadata.runner_name + '.root.sidebyside.update_binded_count'
                            sdk.send_command(new Command(cmd, [])).done(function (response) {
                                if (response.retcode == 0) {
                                    var binded_count = response.stdout
                                    self.is_binded = binded_count
                                    sdk.user.metadata.binded = binded_count
                                    //if binded_count is 0, logout is required, it is called in delegate
                                    if (self.delegate.on_binded_changed) self.delegate.on_binded_changed({ binded_count: binded_count })
                                }
                            })
                        }
                        break
                    case 'unbinded_all':
                        //this sync is targeting a binder when "clear binding was called"
                        if (self.is_binder) {
                            //reset cookie
                            var cookie = payload.data[1]
                            document.cookie = cookie
                            location.href = '../logout?next=' + location.pathname
                        }
                        break
                    case 'binded_sbs_name':
                        //this is issued for binder to update binded's sbs_name
                        if (self.is_binder) {
                            if (self.is_binder !== payload.data[1]) {
                                var binded_sbs_name = payload.data[1]
                                self.is_binder = binded_sbs_name
                                self.delegate.on_binded_changed({ binded_sbs_name: binded_sbs_name })
                            }
                        }
                        break
                    case 'presentation_name_changed': 
                        var name = payload.data[1]
                        self.name = name
                        self.fire('PRESENTATION-NAME-CHANGED', name)
                        break
                    case 'sbs_name_changed':
                        var origin_name = payload.data[1]
                        var name = payload.data[2]
                        self.fire('MEMBER-NAME-CHANGED', origin_name, name)
                        break
                    case 'has-passcode':
                        w2alert('Owner has set passcode')
                        _.delay(function () {
                            //w2popup.message()
                            window.location.reload()
                        }, 2000)
                        break
                    case 'lock-presentation':
                        self.delegate.on_lock_presentation(payload.data[1])
                        break
                }
                break

            case 'slide-bg':
                /*
                //payload.data = [t_id,s_idx,slugified_filename]
                var t_id = payload.data[0]
                var s_idx = payload.data[1]
                var filename = payload.data[2]
                if (t_id == self.current_thread.id && s_idx==self.current_slide.idx){
                    var flag = self.delegate.get_flag_of_token()
                    self.current_slide.set_bg(self.p_id, flag, t_id,filename)
                    //render the same slide again
                    / * old implmentation
                    var promise = new $.Deferred()
                    var transition = 'pop-in'
                    self.current_thread.set_slide_by_id(self,self.current_slide.id,transition,promise) 
                    * /
                    self.rerender_current_slide()
                }
                else{//set_bg
                    var flag = self.delegate.get_flag_of_token()
                    self.threads[t_id].slides[s_idx].set_bg(self.p_id,flag,t_id,filename)
                }
                */
                break
            /*
            case 'video':
                var player = self.delegate.get_video_player()
                if (player && ((!self.isolated) || interally_called)){
                    // embedded screen ignores video sync unless it is interanlly called

                    //prohibit player's broadcat sync event
                    player._no_sync = true 
                    //allow play to broadcast sync event after 3 seconds
                    _.delay(function(){player._no_sync = false},3000)
                    
                    var player_state = payload.data[0]
                    var player_time =  Math.round(payload.data[1])
                    var master_time = payload.data[2]
                    
                    var ts = player.getCurrentTime()
                    // if state is playing, add transimisson time difference to player_time
                    var time_diff = (new Date().getTime()/1000 - master_time)
                    var seek_time =  player_time  + (player_state == 1  ? (time_diff >  0 ? time_diff : 0) : 0)
                    var do_seek = Math.abs(ts - seek_time) > 3                    
                    var state = player.getPlayerState()
                    
                    if (do_seek){
                        player.seekTo(seek_time)
                        state = 1
                    }
                    var change_stage = state !== player_state
                    //console.log('======= ',do_seek, player_time, seek_time,change_stage, player_state)                    
                    if (change_stage){
                        _.delay(function(){
                            //console.log('video state change:',player.getPlayerState(),'to', player_state,'seek to ',player_time)
                            //adjuest playertime with transvesal time                            
                            switch(player_state){
                                case 0://dended
                                    player.stopVideo()
                                    break
                                case 1://playing
                                    player.playVideo()
                                    break
                                case 2://pause
                                    player.pauseVideo()
                                    break
                            }
                        },1000)
                    }
                }
                break
            */
            case 'snapshot':
                break
            case 'embedded':
                break
            case 'welcome':
                //self.delegate.on_message('join bus success')
                break
            case '_ANNOUNCE_':
                if (self.delegate.on_bus_announce) self.delegate.on_bus_announce(payload.data)
                break
            case '_INVITE_BINDING_':
                if (self.delegate.on_invite_binding) self.delegate.on_invite_binding(payload.data)
                break
            /* widget-related starts */
            case 'widget-sync':
                WidgetGallery.singleton.on_bus(payload.data)
                break
        }
    },
    join_bus: function () {
        var self = this
        this.sdk.bus.join(this.bus_room_id).progress(function (payload) {
            // if payload is not modified in on_bus, don't need to clone
            //self.on_bus(Deep(payload)) //in case modification is unavoidable
            self.on_bus(payload)
            if (self.co_presentation) {
                self.co_presentation.on_bus(payload)
            }
        })
    },
    send_to_bus: function (topic, data, options) {

        if (this.readonly) {
            return
        }
        else if ((!this.syncing) && (this.no_sync_topics.indexOf(topic) >= 0)) {
            //user requests to not syncing
            return
        }

        if (!options) {
            var payload = { topic: topic, data: data }
            this.sdk.bus.broadcast(this.bus_room_id, payload)
            if (this.co_presentation) this.co_presentation.on_bus(payload)
        }
        else if (options.blob) {
            //send large data to server via sdk.bus's broadcast_raw thread
            delete options.blob
            options.topic = topic
            this.sdk.bus.broadcast_raw(
                this.bus_room_id,
                options,
                data
            )
            // not implmented for co_presentation. because
            //  
        }
        else {
            //not implemented
        }
    },
    //implement keyboard delegate
    previous_slide: function () {
        //called locally

        //this is bad implementation, should not call top.dashboard.keyboard_shortcut directly
        if (this.isolated) {
            top.dashboard.keyboard_shortcut.handle_keyname('ARROWUP')
            return
        }

        var self = this

        // in mobile and tablet, disable swiping navigation when overlay is enabled
        //if (mobileAndTabletcheck()  && self.current_slide.slide_overlay.visible) return

        //this._change_lock is to lock previous_slide, next_slide, next_thread as a group
        if (this._change_lock) return
        this._change_lock = true

        var panel_name = 'main'
        var thread = this.current_thread
        var slide_index = this.current_slide.idx
        if (slide_index == 0) {
            self.delegate.on_message('no previouse slide')
            this._change_lock = false
            return
        }
        //this.fire('PAGE-WILL-CHANGE')
        var slide = this.current_thread.slides[slide_index - 1]
        this.thread_settings[thread.id].slide_id = slide.id
        thread.set_slide_by_id(this, slide.id)

        if (!self.isolated) this.send_to_bus('slide-sync', [thread.id, slide.idx])

        setTimeout(function () {
            self._change_lock = false
        }, this._change_lock_interval)
    },
    next_slide: function () {
        //called locally

        //this is bad implementation, should not call top.dashboard.keyboard_shortcut directly
        if (this.isolated) {
            top.dashboard.keyboard_shortcut.handle_keyname('ARROWDOWN')
            return
        }

        //called locally
        var self = this

        // in mobile and tablet, disable swiping navigation when overlay is enabled
        //if (mobileAndTabletcheck()  && self.current_slide.slide_overlay.visible) return

        //this this._change_lock is to lock previous_slide, next_slide, next_thread as a group
        if (this._change_lock) return
        this._change_lock = true

        var thread = this.current_thread
        var slide_index = this.current_slide.idx

        if (slide_index + 1 == thread.slides.length) {
            self.delegate.on_message('no next slide')
            this._change_lock = false
            return
        }

        //this.fire('PAGE-WILL-CHANGE')
        var slide = thread.slides[slide_index + 1]
        this.thread_settings[thread.id].slide_id = slide.id
        thread.set_slide_by_id(this, slide.id)

        if (!self.isolated) this.send_to_bus('slide-sync', [thread.id, slide.idx])

        setTimeout(function () { self._change_lock = false }, this._change_lock_interval)
    },
    set_slide: function (slide, slide_resouce_data, do_sync) {
        /* 
         * Set given slide to be current slide or refresh it if it is current slide.
         * This call will not sync to bus.
         * 
         * Arguments:
         *  slide_resouce_data: (any) if given, slide's resouce content has changed.
         *          render it again even it is current slide.
         */

        var self = this
        if (self.current_slide.id == slide.id) {
            //same slide
            if (slide_resouce_data) {
                slide.update_resouce_data(self, slide_resouce_data)
            }
        }
        else {
            //change to another slide
            //this.fire('PAGE-WILL-CHANGE')
            var promise = new $.Deferred()
            var transition = 'slide-left'
            promise.done(function () {
                if (slide_resouce_data) slide.update_resouce_data(self, slide_resouce_data)
            })
            self.current_thread.set_slide_by_id(self, slide.id, transition, promise)
            if (do_sync && (!self.isolated)) this.send_to_bus('slide-sync', [self.current_thread.id, slide.idx])
        }
    },
    previous_thread: function () {
        var self = this

        //this._change_lock is to lock previous_slide, next_slide, next_thread as a group
        if (this._change_lock) return
        this._change_lock = true

        if (_.size(this.threads) < 2) return

        var t_ids = _.keys(this.threads)
        t_ids.sort(function (a, b) { return a > b ? 1 : (a < b ? -1 : 0) })
        var idx = t_ids.indexOf(this.current_thread.id)
        var prev_idx = (idx == 0) ? t_ids.length - 1 : idx - 1
        var prev_t_id = t_ids[prev_idx]
        self.change_to_thread(prev_t_id) 
        if (!self.isolated) this.send_to_bus('slide-sync', [this.current_thread.id, this.current_slide.idx])
        setTimeout(function () { self._change_lock = false }, this._change_lock_interval)
    },
    next_thread: function () {

        var self = this

        //this._change_lock is to lock previous_slide, next_slide, next_thread as a group
        if (this._change_lock) return
        this._change_lock = true

        if (_.size(this.threads) < 2) return
        var t_ids = _.keys(this.threads)
        t_ids.sort(function (a, b) { return a > b ? 1 : (a < b ? -1 : 0) })
        var idx = t_ids.indexOf(this.current_thread.id)
        var next_idx = (idx == t_ids.length - 1) ? 0 : idx + 1
        var next_t_id = t_ids[next_idx]

        panel_name = 'main'
        //self.presentation_layout.panels[panel_name] = next_t_id
        //self.settings.focus = next_t_id
        //s_id = self.thread_settings[next_t_id].slide_id
        self.change_to_thread(next_t_id)
        //var slide = self.threads[next_t_id].get_slide_of_id(s_id)
        // ask others to sync
        if (!self.isolated) this.send_to_bus('slide-sync', [this.current_thread.id, this.current_slide.idx])

        setTimeout(function () { self._change_lock = false }, this._change_lock_interval)
    },
    set_thread_and_slide: function (t_id, s_id) {
        //should be called locally (callde by dashboard when embedded inside it)
        var self = this

        //this._change_lock is to lock previous_slide, next_slide, next_thread as a group
        if (this._change_lock) return
        this._change_lock = true

        var thread = this.threads[t_id]
        panel_name = 'main'
        //  self.current_thread would be null at beginning in an embedded screen
        //  because it does not initially call on_thread_change to have an inital 
        //  value self self.current_thread
        if (self.current_thread && t_id == self.current_thread.id) {
            self.thread_settings[t_id].slide_id = s_id
            thread.set_slide_by_id(self, s_id)
        }
        else {
            //self.presentation_layout.panels[panel_name] = t_id
            //self.settings.focus = t_id
            self.thread_settings[t_id].slide_id = s_id
            self.change_to_thread(t_id)
        }

        // ask others to sync
        if (!this.isolated) this.send_to_bus('slide-sync', [this.current_thread.id, this.current_slide.idx])

        setTimeout(function () { self._change_lock = false }, this._change_lock_interval)
    },
    rerender_current_slide: function () {
        //render the same slide again
        this.fire('PAGE-WILL-REFRESH')
        var promise = new $.Deferred()
        var transition = 'pop-in'
        this.current_thread.set_slide_by_id(this, this.current_slide.id, transition, promise)
        var self = this
        promise.done(function () { self.fire('PAGE-DID-REFRESH') })
        return promise
    },
    add_blank_slide: function (color) {
        var self = this
        var t_id = self.current_thread.id
        var slides_quota_remain = self.get_slide_quota(t_id)
        var promise = new $.Deferred()
        if (slides_quota_remain == 0) {
            _.delay(function () { promise.reject(1, 'no more quota') }, 10)
        }
        else {
            var p_id = self.p_id
            var insert_at = self.current_slide.idx + 1
            if (insert_at == self.current_thread.slides.length) insert_at = -1
            var t_id = self.current_thread.id
            var flag = self.flag
            var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.add_blank_slide'
            var job = function (idx) {
                var args = { p: p_id, t: t_id, f: flag, c: color, y: self.syncing }
                if (insert_at != -1) {
                    args['i'] = insert_at
                    insert_at += 1
                }
                var command = new Command(cmd, [args])
                window.sdk.send_command(command).done(function (response) {
                    if (response.retcode != 0) {
                        console.log('add slides failure:', response.stderr)
                        return promise.reject(response.retcode, response.stderr)
                    }
                    promise.resolve(true)
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    console.log('add slides failure:', [jqXHR, textStatus, errorThrown])
                    promise.reject(jqXHR.status, jqXHR.statusText)
                })
            }
            job(0)
        }
        return promise
    },
    remove_slides_of_idx: function (t_id, s_idxes) {
        var self = this
        var p_id = self.p_id
        var flag = self.flag
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.remove_slides_of_idx'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd, [p_id, flag, t_id, s_idxes])).done(function (response) {
            if (response.retcode != 0) return promise.reject(response.retcode, response.stderr)
            promise.resolve(response.stdout)
        }).fail(function (err) {
            promise.reject(-1, err)
        })
        return promise
    },
    reset_slides_of_idx: function (t_id, s_idxes) {
        var self = this
        var p_id = self.p_id
        var flag = self.flag
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.reset_slides_of_idx'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd, [p_id, flag, t_id, s_idxes])).done(function (response) {
            if (response.retcode != 0) return promise.reject(response.retcode, response.stderr)
            promise.resolve(response.stdout)
        }).fail(function (err) {
            promise.reject(-1, err)
        })
        return promise
    },
    reset_all_slides: function (t_id) {
        var self = this
        var p_id = self.p_id
        var flag = self.flag
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.reset_slides_of_idx'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd, [p_id, flag, t_id, null])).done(function (response) {
            if (response.retcode != 0) return promise.reject(response.retcode, response.stderr)
            promise.resolve(response.stdout)
        }).fail(function (err) {
            promise.reject(-1, err)
        })
        return promise
    },
    //
    toggle_toolbar: function (yes) {
        this._toolbar_visible = this.delegate.toggle_toolbar(yes)
    },
    //overlay's delegate implementation
    on_draw: function (data) {
        //if (data.length < 9) return //do nothing if data.length==9 (w,h,x0,y0)
        //0 = layer_index (currently)        
        this.current_slide.slide_overlay.add_data(0, data)
        var s_idx = this.current_slide.idx
        this.send_to_bus('draw-sync', ['draw', this.current_thread.id, s_idx, 0, data])
    },
    on_draw_eraser: function (data) {
        //data = [this.width, this.height, length, s_point.x, s_point.y , e_point.x, e_point.y]
        //0 = layer_index (currently)
        var chunks = this.current_slide.slide_overlay.layers[0]
        var width = data[0] //width of overlay
        var height = data[1]//height of overlay
        var threshold = 1.5
        var chunk_found = null
        for (var i = 0; i < chunks.length; i++) {
            //chunks[i]= color, alpha, storke width, width, height, x of first point , y of first point, x1, y1, ....
            var chunk = chunks[i]
            //check length
            if ((chunk.length - 5) != data[2] * 2) continue
            //check start point
            var w = width / chunk[3], h = height / chunk[4]
            var x = chunk[5] * w, y = chunk[6] * h
            var dx = Math.abs(data[3] - x), dy = Math.abs(data[4] - y)
            if (dx > threshold && dy > threshold) continue
            //check end point
            x = chunk[chunk.length - 2] * w, y = chunk[chunk.length - 1] * h
            dx = Math.abs(data[5] - x), dy = Math.abs(data[6] - y)
            if (dx > threshold && dy > threshold) continue
            chunk_found = chunk
            //update localdata
            chunks.splice(i, 1)
            break
        }
        var s_idx = this.current_slide.idx
        //color, width, height, number of points, x0,y0, last_x, last_y
        var data_for_sync = [chunk_found[0], chunk_found[3], chunk_found[4], data[2], chunk_found[5], chunk_found[6], chunk_found[chunk_found.length - 2], chunk_found[chunk_found.length - 1]]
        this.send_to_bus('draw-sync', ['erase', this.current_thread.id, s_idx, 0, data_for_sync])
    },
    get_slide_quota: function (t_id) {
        //implemented in whiteboard
        return Math.max(0, this.max_slides - this.threads[t_id].slides.length)
    },
    set_ratio: function (w) {
        //w is 4 for 4:3, or 16 for 16:9
        var self = this
        var p_id = self.p_id
        var flag = self.flag
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.set_ratio'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd, [p_id, flag, w])).done(function (response) {
            if (response.retcode != 0) return promise.reject(response.retcode, response.stderr)
            promise.resolve(response.stdout)
        }).fail(function (err) {
            promise.reject(-1, err)
        })
        return promise
    }
}
