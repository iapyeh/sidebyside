/*
 * Z-index:
 * base: body
 * #1 page
 * #2 screen
 * #2 qrcode-btn
 * #199 overlay
 * #200 nav-btn(next,prev)
 * #250 PIXI (webGL)
 * #300 drag and drop, web-cam (video)
 * #1020 (w2ui main content)
 * #1021 (toolbar)
 * #1022 (message)
 * #1023 (bubble of pointer,gs-toolbar-div)
 */

function DisplayArea(presentation_screen,name){
    /*
     * Display is used to display content of a layout area
     */
    this.presentation_screen = presentation_screen
    this.page_ele = presentation_screen.page_ele
    this.screen_ele = presentation_screen.screen_ele
    //this.thread = thread
    this.name = name //"type" of w2layout, such as "main","left"

    this.slide = null    
}
DisplayArea.prototype = {
    set_slide:function(slide,transition){
        this.slide = slide
        return this.refresh(transition)
    },
    content:function(html,not_fit,transition){        
        /*
         * not_fit: if true, don't call this.content_fitting()
         */

        // don't do animation in dashboard's embedded scren
        if (this.presentation_screen.presentation.isolated) transition = undefined
        
        //temporary disable transition because it seems unreliable
        w2ui['layout'].content(this.name,'<div class="slide-content">'+html+'</div>')
        
        if (not_fit) return $.when()

        var self = this
        var promise = new $.Deferred()
        
        _.defer(function(){
            //there might be some bug of w2ui, the ele sometimes become unavailable
            var ele = $('#layout_layout_panel_main > div.w2ui-panel-content')[0]
            var ele_to_load = ele.querySelectorAll('img')
            if (ele_to_load.length==0) {
                // since there is no image, lets do content_fitting immediately
                self.content_fitting()
            }
            else{
                // do content_fitting(adjust height and width) after all images have loaded 
                var _counter = 0
                var plus_counter = function(){
                    _counter += 1
                    if (_counter==ele_to_load.length){
                        self.content_fitting()
                    }                    
                }
                _.each(ele_to_load,function(ele){
                    if (ele.complete) plus_counter() //in cache
                    else ele.onload = plus_counter //reloading
                })
            }
            promise.resolve()

        })
        return promise
    },
    _preload: function(resouce_type,url){
        //helper function for refresh
        //to commit transition after resource has loaded
        //to smooth animation
        var promise = new $.Deferred()
        switch(resouce_type){ // see refresh() for keywords of resource_type
            case 'IMG':
                var img = document.createElement('img')
                img.onload = function(){
                    promise.resolve()
                }
                img.src = url
                break
            default:
                console.warn('preloading of '+resouce_type+' is not supported')
                return $.when()
        }
        return promise
    },
    refresh:function(transition){
        var self = this

        if (!this.slide){
            this.content('Blank Slide',undefined, 'pop-in')
            $('#toolbar')[0].style.display = 'none'
            return $.when()
        }

        $('#toolbar')[0].style.display = ''


        var c = '<img src="/404.png" style="width:250px"/>';
        //var html
        //window.message(this.source_item.title+':'+url,true)
        var resource = this.slide.resource
        //console.log(resource)
        var preload_promise;
        var content_completion_promise
        var final_completion_promise;
        switch(resource.type){
            case 'Whiteboard':
                console.log(resource)
                if (resource.bg){
                    var url = resource.bg 
                    c = '<img class="studio-fit-box" src="'+url+'" style="background-image:url('+url+')"/>'
                    preload_promise = this._preload('IMG',url)    
                }
                else{
                    c = '<div class="studio-full-box" style="background-color:green;width:100%;height:100%">&nbsp;</div>'
                    preload_promise = $.when()
                }
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()
                content_completion_promise.done(function(){
                    final_completion_promise.resolve()
                })                
                break
            case 'IMG':
                var url = this.slide.url
                c = '<img class="studio-fit-box" src="'+url+'" style="background-image:url('+url+')"/>'
                preload_promise = this._preload('IMG',url)
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()
                content_completion_promise.done(function(){
                    final_completion_promise.resolve()
                })
                break
            case 'VIDEO':
                //only youtube supported implementation
                c = '<div id="player" class="studio-full-box"></div>'
                var video_id = self.slide.resource.vid
                
                preload_promise = $.when()
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()

                var player;    
                w2ui['toolbar'].player = null //release existing video player

                var last_current_time;
                var sync_current_time_interval = 1500
                //var sync_current_time_timer = null
                var sync_current_time = function(){
                    // sync the current_time at pause state
                    //stop checking if player is null or state is not paused
                    if (player === null) return
                    var video_state = player.getPlayerState()
                    if (video_state !== 2) return
                    var ts = player.getCurrentTime()
                    var emit_sync =  (ts != last_current_time)
                    if (emit_sync){
                        var t_id = self.presentation_screen.presentation.current_thread.id
                        var s_idx = self.presentation_screen.presentation.current_slide.idx
                        var panel_name = 'main'
                        //set "now" to 0, because it doesn't matter
                        var args = [panel_name,t_id,s_idx,[video_state,ts,0]]
                        self.presentation_screen.presentation.send_to_bus('slide-sync',args)
                    }
                    /*
                    var data = player.getSphericalProperties()
                    console.log('---------->getSphericalProperties=',data)
                    */
                    last_current_time = ts
                    player.sync_current_time_timer =  _.delay(sync_current_time,sync_current_time_interval)
                }

                var create_player = function(_promise){
                    var events = {
                        onReady: function(evt){
                            w2ui['toolbar'].player = evt.target //player
                            //default to be muted
                            player.mute()                           
                            //this is at inital stage of player.
                            //so apply extra to restore video state
                            var video_state = self.slide.resource.extra[0]
                            _.delay(function(){
                                //resolve final_completion_promise                                
                                /*
                                * there might be a bug in youtube's api.
                                * player should be played before calling seek.
                                * so, it the initial state is not playing,
                                * let it playing for 1 seconds before calling seek
                                */
                                if (video_state == 1){
                                    _.defer(_promise.resolve)
                                }
                                else{
                                    player._no_sync = true
                                    player.playVideo()
                                    _.delay(function(){
                                        player.pauseVideo()
                                        //delay a second to prevent state change was synced to remove
                                        _.delay(function(){
                                            _promise.resolve
                                            player._no_sync = false
                                        },1000)
                                    },1000)//should at least 1second
                                }
                            },10)
                        },
                        onError:function(err){
                            console.log('Error on create player',err)
                            _promise.reject(err)
                        },
                        onStateChange: function(evt){
                            // player state changing is called by presentation.js not by user's interaction
                            // (syncing to remote or at intial loading)
                            if (self.presentation_screen.readonly || player._no_sync) return
                            var video_state = evt.data
                            //0-stop, 1-playing, 2=paused
                            player.sync_state_to_bus(video_state)    
                        }
                    }
                    //before player creation handling
                    if (self.presentation_screen.presentation.isolated || self.presentation_screen.readonly) {
                        //embedded screen in dashboard or audience screen
                        //do not listen on state change
                        delete events.onStateChange
                    }
                    var player_time = Math.floor(self.slide.resource.extra[1])
                    player = new YT.Player('player', {
                        playerVars: { 
                            autoplay: 0,
                            rel:0,
                            //showinfo:1, default
                            controls: 1,
                            enablejsapi: 1,
                            start: player_time //initial position
                        },
                        videoId:video_id,
                        events: events
                    });
                    //after player creation handling
                    if (self.presentation_screen.presentation.isolated || self.presentation_screen.readonly) {
                        //do nothing
                    }
                    else{
                        //embedded screen in dashboard or audience screen
                        //do not listen on state change
                        player.sync_state_to_bus = function(video_state){
                            if (player._no_sync) return
                            var ts = Math.floor(player.getCurrentTime())
                            if (video_state >=0 && video_state <= 2){

                                var t_id = self.presentation_screen.presentation.current_thread.id
                                var s_idx = self.presentation_screen.presentation.current_slide.idx
                                var panel_name = 'main'
                                //set "now" to 0, because it doesn't matter
                                var now = Math.round(new Date().getTime()/1000)
                                var args = [panel_name,t_id,s_idx,[video_state,ts,now]]
                                self.presentation_screen.presentation.send_to_bus('slide-sync',args)
                                //fire a time to check current-time if paused
                                if (video_state == 2){
                                    last_current_time = ts
                                    player.sync_current_time_timer = _.delay(sync_current_time,sync_current_time_interval)
                                }
                            }
                        }
                    }
                }
                var inject_api = function(_promise){
                    if (document.getElementById('youtubeiframapi')){
                        create_player(_promise)
                    }
                    else{
                        window.onYouTubeIframeAPIReady = function(evt){
                            create_player(_promise)
                            delete window.onYouTubeIframeAPIReady
                        }
                        // <script src="https://www.youtube.com/iframe_api"></script>
                        var s = document.createElement('script')
                        s.setAttribute('id','youtubeiframapi')
                        s.src = 'https://www.youtube.com/iframe_api'
                        var firstScriptTag = document.getElementsByTagName('script')[0];
                        firstScriptTag.parentNode.insertBefore(s, firstScriptTag);    
                    }
                } 
                content_completion_promise.done(function(){
                    inject_api(final_completion_promise)
                })
                break
            case 'URL':
                var url = self.slide.resource.data.url
                console.log('url----->',url)
                c = '<iframe class="studio-full-box" style="width:100vw;height:100vh" src="'+url+'"></iframe>'
                preload_promise = $.when()
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()
                content_completion_promise.done(function(){
                    final_completion_promise.resolve()
                })
                break
            case 'OP':
                var url = self.slide.resource.url
                var kind = self.slide.resource.kind
                if (kind == 'GS'){
                    // google slides
                    var current_page = self.slide.resource.extra ? self.slide.resource.extra[0] : 1
                    if (current_page != 1) {
                        url += '#'+current_page                        
                    }
                    //console.log('gs----->',self.slide.resource,current_page)
                    c = '<iframe class="studio-full-box" style="width:100vw;height:100vh" src="'+url+'"></iframe>'
                    preload_promise = $.when()
                    content_completion_promise = new $.Deferred()
                    final_completion_promise = new $.Deferred()
                    content_completion_promise.done(function(){
                        //create pesudo toolbar                        
                        var gs_toolbar_div = document.createElement('div')
                        gs_toolbar_div.className = 'gs-toolbar origin-hide-me'
                        gs_toolbar_div.innerHTML = document.getElementById('gs-toolbar-tmpl').innerHTML
                        gs_toolbar_div.querySelector('.page_no').innerHTML = current_page

                        var rect = self.screen_rect
                        var toolbar_height = 29 // div.punch-viewer-nav-v2.punch-viewer-nav-fixed
                        gs_toolbar_div.style.top = (rect.top+rect.height - toolbar_height )+'px'
                        gs_toolbar_div.style.left = (rect.left+2)+'px'

                        self.presentation_screen.page_ele.appendChild(gs_toolbar_div)
                        var iframe = self.screen_ele.querySelector('iframe')
                        iframe.onload = function(){
                            window.loading(false)
                        }
                        iframe.onerror = function(err){
                            window.loading(false)
                            console.log('loading iframe error',err)
                        }

                        self.slide.go_page = function(page_no,call_by_sync){
                           
                            window.loading(true,'loading',true)

                            self.slide.resource.extra = [page_no]

                            gs_toolbar_div.querySelector('.page_no').innerHTML = page_no

                            
                            if (current_page !== page_no){
                                var url = self.slide.resource.url + '#' + page_no
                                iframe.src = url
                                current_page = page_no
                            }

                            if (page_no == 1){
                                $(gs_toolbar_div.querySelector('.prev')).addClass('disabled')
                                $(gs_toolbar_div.querySelector('.first')).addClass('disabled')
                            } 
                            else {
                                $(gs_toolbar_div.querySelector('.prev')).removeClass('disabled')
                                $(gs_toolbar_div.querySelector('.first')).removeClass('disabled')
                            }

                            if (call_by_sync || self.presentation_screen.presentation.isolated){}
                            else{
                                var t_id = self.presentation_screen.presentation.current_thread.id
                                var s_idx = self.presentation_screen.presentation.current_slide.idx
                                var panel_name = 'main'
                                //set "now" to 0, because it doesn't matter
                                var args = [panel_name,t_id,s_idx,[page_no]]
                                self.presentation_screen.presentation.send_to_bus('slide-sync',args)    
                            }
                        }
                        gs_toolbar_div.querySelector('.next').onclick = _.throttle(function(evt){

                            var page_no = self.slide.resource.extra ? self.slide.resource.extra[0] : 1
                            page_no = page_no + 1
                            
                            self.slide.go_page(page_no)
                            
                        })
                        gs_toolbar_div.querySelector('.prev').onclick = _.throttle(function(evt){
                            var page_no = self.slide.resource.extra[0]
                            page_no = page_no ? page_no : 1
                            if (page_no == 1){
                                return
                            }
                            else{
                                page_no -= 1
                            }

                            self.slide.go_page(page_no)                            
                        })
                        gs_toolbar_div.querySelector('.first').onclick = _.throttle(function(evt){
                            self.slide.go_page(1)
                        })
                        self.slide.go_page(current_page,true)
                        //initial page will be set with slide.update_resouce_data in presentation.js by resolving promise
                        final_completion_promise.resolve()
                    })
                }
                break                
            /* not supported yet 
            case 'HTML':
                //console.log('this.resource.url=',this.slide.url)
                if (!this.slide.url) return
                
                var fitting = function(){
                    setTimeout(function(){
                        //wait for the transition of w2ui to complete,
                        //otherwise the DOM has two main-panel
                        self.content_fitting()
                        //also to var user aware the loading
                        w2ui['layout'].unlock(self.name)
                    },1000)                    
                }
                
                w2ui['layout'].lock(this.name,'loading',true)
                w2ui['layout'].load(this.name, this.slide.url,'slide-left',function(){                
                    fitting()
                })                
                return
            */
        }


        if (preload_promise){
            window.loading(true,'loading',true)
            preload_promise.done(function(){
                window.loading(false)
                self.content(c,false,transition).done(function(){
                    content_completion_promise.resolve()
                })
            })    
        }
        else{
            self.content(c,false,transition).done(function(){
                content_completion_promise.resolve()
            })
        }
        
        return final_completion_promise
    },
    content_fitting:function(){
        //search for speical classes to adjuest their size
        var self = this        
        // keep ratio for .studio-fit-box
        var box = self.screen_ele
        _.each(box.querySelectorAll('.studio-fit-box'),function(ele,idx){
            //fit this element to its container but keep ratio
            var rect = window.presentation_screen.screen_rect
            var rect_ele = ele.getBoundingClientRect()
            
            var height_padding = 0
            var width_padding = height_padding/rect.height * rect.width
            var rect_box = {
                width:rect.width - width_padding,
                height:rect.height - height_padding
            }
            
            var page_rect = self.page_ele.getBoundingClientRect()
            var page_ratio = page_rect.width / page_rect.height
            var p_ratio = window.presentation_screen.presentation.presentation_layout.ratio
            var presentation_ratio = p_ratio[0] / p_ratio[1]
            var fit_width = page_rect <= presentation_ratio
            
            if (fit_width){
                var height = Math.round(rect_box.width/rect_ele.width * rect_ele.height)
                ele.style.width = rect_box.width + 'px'
                ele.style.height = height + 'px'
                ele.style.position = 'absolute' //var "top" to work
                ele.style.top = ((rect.height - height)/2) + 'px'
            }
            else{
                //fit height
                var width =  Math.round(rect_box.height/rect_ele.height * rect_ele.width)
                ele.style.height = rect_box.height + 'px'
                ele.style.width = width + 'px'
                ele.style.left = ((rect.width - width)/2) + 'px'             
            }
            //console.log('fitting=>',fit_width, ele.style.width, ele.style.height)
        })
        
        // use full box  for .studio-full-box
        _.each(box.querySelectorAll('.studio-full-box'),function(ele){
            //fit this element to its container but keep ratio
            var box = self.screen_ele
            var rect = self.screen_rect
            ele.style.width = rect.width + 'px'
            ele.style.height = rect.height + 'px'
        })        
    },
}
/*
 * 
 */
function Pointers(presentation_screen){
    this.presentation_screen = presentation_screen
    this.co_pointers={}
    this.meta = {
        id:Math.round(Math.random()*10000),
        color:'#ff0000',
        enable:1
    }
    this.enabled = false
    this.counter = 0
}
Pointers.prototype ={
    enable:function(){
        var self = this
        this.enabled = true
        this.meta.enable = 1
        //_.delay is not involved like "enable_draw", beause "pointer" would not be enabled at initial phase
        this.presentation_screen.fire_event('pointer:enable',true)

        var slide = this.presentation_screen.presentation.current_slide

        if (slide.is_embedded){
            // slide is video or web page
            if (!this.presentation_screen.draw_enabled){
                this.presentation_screen.overlay.show(true)
                this.presentation_screen.overlay.show_canvas(false)
            } 
        }
        var x0=-1,y0=-1,x1=-1,y1=-1    
        this._show_pointer_timer = setInterval(function(){
            if (x0 != x1 || y0 != y1){
                var positions = self._get_intermediate_bubbles(x0,y0,x1,y1)
                _.each(positions,function(xy,idx){
                    self._make_bubble(xy[0],xy[1],(idx+1)/positions.length*0.9,self.meta.color)    
                })    
                self._make_bubble(x1,y1,1,self.meta.color)
            }
            x0 = x1
            y0 = y1 
        },250)
        this._show_static_pointer_timer = setInterval(function(){
            if (x0 != x1 || y0 != y1) return
            //mouse not moved
            var bubble = self._make_bubble(x1,y1,1,self.meta.color)
            bubble.className += ' static'
        },1000)        
        var rect = this.presentation_screen.screen_rect
        var pointer_offset = 0
        this.presentation_screen.presentation.send_to_bus('misc-sync',['pointer',this.meta])       

        $(this.presentation_screen.page_ele).on('mousemove touchmove',_.throttle(function(evt){
            //works for both touch and mouse
            x1 = evt.pageX
            y1 = evt.pageY - 15
            self.counter += 1
            //send color for every 10 times (5sec = 250*20) 
            var sync_color = self.counter % 20 == 19
            if (x0 == x1 && y0 == y1 && (!sync_color))  return
            var posX = (x1 - pointer_offset)
            var posY = (y1 - pointer_offset)
            var x = Math.round(10000*(posX-rect.left)/rect.width)
            var y = Math.round(10000*(posY-rect.top)/rect.height)
            var data = sync_color ? [self.meta.id,x,y,self.meta.color] : [self.meta.id,x,y] 
            self.presentation_screen.presentation.send_to_bus('pointer',data)
        },250))         
    },
    disable:function(){
        this.enabled = false
        this.counter = 0
        var self = this
        // delay a while to make restoring "draw" button's red class taking effective
        // when it was disabled by enabling pointer
        _.delay(function(){self.presentation_screen.fire_event('pointer:enable',false)},50)        
            
        clearInterval(this._show_pointer_timer)
        clearInterval(this._show_static_pointer_timer)
        delete this._show_pointer_timer;
        delete this._show_static_pointer_timer;

        var slide = this.presentation_screen.presentation.current_slide
        if (slide.is_embedded){
            //slide is video, web page, etc.
            if (!this.presentation_screen.draw_enabled){
                this.presentation_screen.overlay.show(false)
            }            
        }
        $(this.presentation_screen.page_ele).off('mousemove touchmove') 
        this.meta.enable = 0      
        this.presentation_screen.presentation.send_to_bus('misc-sync',['pointer',this.meta])        
    },
    sync_meta:function(meta){
        var self = this
        if (meta.enable){
            var co_meta = {
                id:meta.id,
                color:meta.color,
                xy:null,                
                ts:new Date().getTime()
            }
            co_meta.timer = setInterval(_.bind(function(){
                var now = new Date().getTime()
                //remove a pointer if it has missing over 30 seconds
                if ( now - co_meta.ts > 30000){
                    co_meta.enable = 0
                    _.defer(function(co_meta){self.sync_meta(co_meta)},co_meta)
                }
                else if (co_meta.xy) {
                    bubble = self._make_bubble(co_meta.xy[0],co_meta.xy[1],1,co_meta.color)
                    bubble.className += ' static'
                }
             },{co_meta:co_meta}),1000)
             this.co_pointers[meta.id] = co_meta         
        }
        else{
            var co_meta = this.co_pointers[meta.id]
            clearInterval(co_meta.timer)
            delete this.co_pointers[meta.id]
        }
    },
    sync_data:function(data){
        var rect = this.presentation_screen.screen_rect
        var pointer_id = data[0]
        var x = data[1]/10000 * rect.width + rect.left
        var y = data[2]/10000 * rect.height + rect.top
        var color = data[3]
        var self = this

        var co_meta = this.co_pointers[pointer_id]
        if (!co_meta){
            //auto recover this pointer
            co_meta = {
                id: pointer_id,
                color: color || '#ff0000',
                enable:1
            }
            this.sync_meta(co_meta)
        }
        else if (color && (color !== co_meta.color)){
            co_meta.color = color
        }
        //kick this co_meta
        co_meta.ts = new Date().getTime()

        var last_xy = this.co_pointers[pointer_id].xy
        if (last_xy){
            var positions = this._get_intermediate_bubbles(last_xy[0],last_xy[1],x,y)
            _.each(positions,function(xy,idx){
                self._make_bubble(xy[0],xy[1],(idx+1)/positions.length*0.9,co_meta.color)
            })
        }
        this._make_bubble(x,y,1,co_meta.color) 
        this.co_pointers[pointer_id].xy = [x,y]
    },
    set_color:function(color){
        //call this change pointer's color, 
        //this will change the counter to enforce color to be synced
        this.meta.color = color
        if (this.enabled){
            this.counter = 18
        }
    },
    _get_intermediate_bubbles:function(x0,y0,x1,y1){
        var positions = []
        var max_gap = 40
        if (x0 != -1 || y0 != -1){
            var dx = x1 - x0
            var dy = y1 - y0
            if (Math.abs(dx) > Math.abs(dy)){
                var n = Math.abs(Math.floor(dx/max_gap))
            }
            else{
                var n =  Math.abs(Math.floor(dy/max_gap))
            }
            if (n == 0) return []
            for (var i=1;i<=n;i++){
                var theta = Math.sin(Math.PI/2*(i/n))
                positions.push([x0+dx*theta,y0+dy*theta])
            }
        }
        return positions
    },
    _make_bubble:function(x,y,stage,color){
        //helper of pointer
        /* arguments:
            stage: float, 0.0 ~ 1.0 , bubble's stage, 1 is initial, smaller is close to broken.
        */
        var self = this
        var max_scale = stage  * 0.75 + 0.25//0.25 is bubble's initial scale
        var opacity = 1 - stage * 0.9       //0.9 is bubble's (1 - initial opacity)
        var transition_duration = 500 * stage //1000 ms is bubble's total transition duration

        var bubble = document.createElement('span')
        bubble.className='bubble'
        bubble.style.left = (x-15)+'px' //bubble's size is 30x30
        bubble.style.top = (y-15)+'px'
        bubble.innerHTML = '&nbsp;'
        bubble.style.background = 'radial-gradient('+color+', transparent)'
        self.presentation_screen.page_ele.appendChild(bubble)
        _.delay(function(_bubble){
            _bubble.className = 'bubble thrink'
            _bubble.style.opacity = opacity
            _bubble.style.transitionDuration = transition_duration+'ms'
            _bubble.style.transform = 'scale('+max_scale+')'
        },100,bubble) 
        bubble.addEventListener("transitionend",function(evt){
            //event was fired at every transition end.
            if (evt.propertyName != 'opacity') return
            self.presentation_screen.page_ele.removeChild(evt.srcElement)    
        },false)
        return bubble
    },     
}
/*
 * Project Screen
 */
function PresentationScreen(p_id,container, flag_of_token){
    /*
     * Arguments:
     *  container: DOM element which contains #screen element
     */
    this.p_id = p_id
    //out box of the screen
    this.page_ele = container 
    // show contents on the screen
    this.screen_ele = container.querySelector('#screen')
    this.flag_of_token = flag_of_token
    // overlay is on top of the page
    var self = this
    
    this.overlay = new Overlay(this.page_ele)
    //show created after this.overlay, but set to be overlay.delegate 
    var isolated_screen = (top == window) ? false : true
    this.presentation = new Presentation(p_id,this,{
        keyboard_shortcut: isolated_screen ? false : true,
        isolated: isolated_screen ? true : false,
    })
    this.overlay.delegate = this.presentation
    this.pointers = new Pointers(this)
    //this.dnd_uploader = new DnDUploader(this,document.body)
    this.dispaly_areas = {}
    // window.message = this.message

    this.sbs_user = null

    this.draw_enabled = false
    this.origin_enabled = false
    this.zoomout_enabled = false
    this.dragging_enabled = false
}
PresentationScreen.prototype = {
    _init_touch_features:function(){
        //set behavior of swipe on mobile devices
        
        var self = this

        //detect swipe 
        document.addEventListener('touchstart', handleTouchStart, false);        
        document.addEventListener('touchmove', handleTouchMove, false);
        document.addEventListener('touchend', handleTouchEnd, false);
        
        var xDown = null;                                                        
        var yDown = null;
        var xUp   = null;
        var yUp   = null;                                                     
        
        //should re-implemented to be event-based someday
        var can_swipe_navigate = function(){
            //return a boolean to say yes or no before presentation requests to change slide
            return (self.pointers.enabled || self.draw_enabled || self.zoomout_enabled) ? false : true
        }

        function handleTouchStart(evt) {
            if (evt.touches.length != 1) {
                xDown = null
                return
            }
            xDown = evt.touches[0].clientX;                                      
            yDown = evt.touches[0].clientY;                                      
        };                                                
        function handleTouchMove(evt) {
            if ( ! xDown ) {
                return;
            }
            xUp = evt.touches[0].clientX;
            yUp = evt.touches[0].clientY;
        }
        function handleTouchEnd(evt) {       
            if ( ! xDown || ! xUp ) {
                return;
            }
            var xDiff = xDown - xUp;
            var yDiff = yDown - yUp;
            var xThreshold = 30
            var yThreshold = 50
            if (can_swipe_navigate()) console.log('swiiiii',xDiff, yDiff)
            if ( Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(yDiff) < yThreshold ) {/*most significant*/
                if ( xDiff > xThreshold ) {
                    /* left swipe */ 
                    if (can_swipe_navigate()) {
                        self.presentation.next_slide()
                    }
                } else if (xDiff < - xThreshold) {
                    /* right swipe */
                    if (can_swipe_navigate()) {
                        self.presentation.previous_slide()
                    }
                }                       
            }
            /*
            else {
                if ( yDiff > 0 ) {
                    // up swipe 
                } else { 
                    // down swipe
                }                                                                 
            }
            */
            /* reset values */
            xDown = null;
            yDown = null;
            xUp   = null;
            yUp   = null;            
        };
    },
    init:function(sbs_user){        
        var self = this
        
        if (mobileAndTabletcheck()) this._init_touch_features()

        // navigation button on left and right side
        //enable hover on desktop brower, (disable on mobile device)
        if (self.flag_of_token == 3){
            // in audience screen
            // remove navi buttons on both side
            $('.nav-btn-bar').remove()
        }
        else{
            if (!mobileAndTabletcheck()){
                $('.nav-btn-bar').hover(function(evt){
                    evt.currentTarget.style.opacity = 1
                    $(evt.currentTarget).addClass('active')
                },function(evt){
                    evt.currentTarget.style.opacity = 0
                    $(evt.currentTarget).removeClass('active')  
                })    
            }
            
            var prev_delay = _.debounce(function(){
                    $('#prev-btn.nav-btn-bar').removeClass('active')            
                },3000)
            var next_delay = _.debounce(function(){
                    $('#next-btn.nav-btn-bar').removeClass('active')
                },3000)

            $('#prev-btn.nav-btn-bar').on('click tap',function(evt){
                $('#prev-btn.nav-btn-bar').addClass('active')
                prev_delay.cancel()
                prev_delay()
            })
            $('#next-btn.nav-btn-bar').on('click tap',function(evt){
                $('#next-btn.nav-btn-bar').addClass('active')
                next_delay.cancel()
                next_delay()
            })                

            $('#prev-btn.nav-btn-bar span').on('click tap',function(evt){
                // do action only if nav-btn-bar is visible
                if (mobileAndTabletcheck() && !$('#prev-btn.nav-btn-bar').hasClass('active')) return
                presentation_screen.presentation.previous_slide()
            })        

            $('#next-btn.nav-btn-bar span').on('click tap',function(evt){
                // do action only if nav-btn-bar is visible for mobile device
                if (mobileAndTabletcheck() && !$('#next-btn.nav-btn-bar').hasClass('active')) return
                presentation_screen.presentation.next_slide()
            })
        }

        //setup thread's layout
        //hard coded, not really implemented
        var panel_name = 'main'
        $(self.screen_ele).w2layout({
            name:'layout',
            style:'width:100%;height:100%',
            panels: [
                //overflow:hidden is important for zooming
                {'type':panel_name, 'size':'100%', 'content':'', style:'overflow:hidden'}
            ]
        })
        
        //w2ui['layout'].el('main').style.width = screen_ele.style.width
        //w2ui['layout'].el('main').style.height = screen_ele.style.height

        //toolbar; will be rendered in set_owner()
        var toolbar_div = document.createElement('div')
        toolbar_div.setAttribute('id','toolbar')
        document.body.appendChild(toolbar_div)

        self.set_size = function(){
            var page_ele = self.page_ele
            var screen_ele = self.screen_ele
            page_ele.style.top = '0px'
            page_ele.style.left = '0px'
            page_ele.style.width = '100vw'
            page_ele.style.height = '100vh'
            var viewport = page_ele.getBoundingClientRect()
            
            var paddings = {top:0,left:0,right:0,bottom:0}
            
            var page_rect = {
                width:viewport.width-(paddings.left + paddings.right),
                height:viewport.height-(paddings.top + paddings.bottom),
                top:paddings.top,
                left:paddings.left
            }
            var ratio = self.presentation.presentation_layout.ratio
            var screen_rect = {}
            self.screen_rect = screen_rect
            var h = Math.round(page_rect.width / ratio[0] * ratio[1])
            if (h <= page_rect.height){
                screen_rect.height = h;
                screen_rect.width = page_rect.width
                screen_rect.left = 0
                screen_rect.top = Math.round((page_rect.height-screen_rect.height)/2)
            }
            else{
                screen_rect.height = page_rect.height;
                screen_rect.width = Math.round(page_rect.height / ratio[1] * ratio[0])
                screen_rect.top = 0
                screen_rect.left =  Math.round((page_rect.width-screen_rect.width)/2)            
            }

            //apply
            page_ele.style.left = page_rect.left+'px'
            page_ele.style.top = page_rect.top+'px'
            page_ele.style.width = page_rect.width+'px'
            page_ele.style.height = page_rect.height+'px'
            screen_ele.style.left = screen_rect.left+'px'
            screen_ele.style.top = screen_rect.top+'px'
            screen_ele.style.width = screen_rect.width+'px'
            screen_ele.style.height = screen_rect.height+'px'
            
            self.overlay.set_size({
                width:screen_rect.width,
                height:screen_rect.height,
                top:screen_rect.top, 
                left:screen_rect.left
            })
            
            var panel_name = 'main'
            self.dispaly_areas[panel_name] = new DisplayArea(self,panel_name)
            
            //toolbar; will be rendered in set_owner()
            var toolbar_div = document.getElementById('toolbar')
            toolbar_div.setAttribute('style','position:fixed;top:0px;left:0px;z-index:1021;width:'+screen_ele.style.width+';left:'+screen_ele.style.left)

            //this is especially required when enter fullscreen mode
            w2ui['layout'].resize()
            
            return true
        }

        
        if (sbs_user){
            //this page is in a embedded screen of dashboard
            self.sbs_user = sbs_user
            window.sdk = top.sdk
        }
        else{
            self.sbs_user = new SBSUser(this)
            self.sbs_user.init()    
        }

        //listen to remote sync of translate
        var target_ele0 = document.getElementById('screen')
        var target_ele1 = document.getElementById('overlay_surface') 
        var control_ele = document.getElementById('page')
        var control_rect = null
        self.presentation.add_event_listener('OFFSET',function(data){
            if (control_rect === null) control_rect = control_ele.getBoundingClientRect()
            var _scale = self.presentation._scale
            var _pos1 = Math.round(data[0]/100 * control_rect.width)
            var _pos2 = Math.round(data[1]/100 * control_rect.height)
            var transform = 'scale('+_scale+') translate('+_pos1+'px,'+_pos2+'px)'
            target_ele0.style.transform = transform
            target_ele1.style.transform = transform
        })        
    },
    request_fullscreen:function(){
        if (!screenfull.enabled) {
            this.on_message('Fullscreen is not supported in this browser')
            return
        }
        if (!this._fullscreen_callback){
            var self = this
            this._fullscreen_callback = function(evt){
                evt.preventDefault()
                //resize
                window.loading(true,'reloading',true)
                _.delay(function(){
                    self.set_size()
                    setTimeout(function(){
                        var panel_name = 'main'
                        self.dispaly_areas[panel_name].content_fitting()                        
                        if (!self.presentation.current_slide.slide_overlay.visible) self.overlay.show(false)
                        self.overlay.draw_restore(self.presentation.current_slide.slide_overlay.layers[0])
                    },100)
                    window.loading(false)
                },1000)
            }
            screenfull.on('change',this._fullscreen_callback)
        }
        if (screenfull.isFullscreen) {
    		screenfull.exit();
        } else {            
            screenfull.request();
        }       
    },
    fire_event:function(name,data){
        switch(name){
            case 'pointer:enable':
                var enabled = data
                if (w2ui['toolbar'].get('pointer')){
                    //audience screen has no this item  
                    if (enabled){
                        w2ui['toolbar'].show('pointercolor')
                        if (this.draw_enabled){
                            _.each(['draw','drawcolor','drawsize','draweraser','drawclear'],function(name){
                                w2ui['toolbar'].disable(name)
                            })    
                        }
                        else{
                            w2ui['toolbar'].disable('draw')
                        }
                        $('#tb_toolbar_item_pointer tr').first().addClass('red')
                        $('#tb_toolbar_item_pointer td.w2ui-tb-caption').css('color','white')

                    }
                    else{
                        w2ui['toolbar'].hide('pointercolor')
                        if (this.draw_enabled){
                            _.each(['draw','drawcolor','drawsize','draweraser','drawclear'],function(name){
                                w2ui['toolbar'].enable(name)
                            })
                            //should wait 50ms to recover draw button's red style
                            _.delay(function(){
                                $('#tb_toolbar_item_draw tr').first().addClass('red')
                                $('#tb_toolbar_item_draw td.w2ui-tb-caption').css('color','white')        
                            },50)
                        }
                        else{
                            w2ui['toolbar'].enable('draw')
                        }

                        $('#tb_toolbar_item_pointer tr').first().removeClass('red')
                        $('#tb_toolbar_item_pointer td.w2ui-tb-caption').css('color','black')

                    }
                }                
                break            
            case 'camera:enable':
                var enabled = data
                if (w2ui['toolbar'].get('camera')){
                    //audience screen has no this item
                    if (enabled){
                    }
                    else{
                    }
                }                
                break
            case 'overlay:visible':
                //update buttons of draw-family on the toolbar
                var visible = data
                if (w2ui['toolbar'].get('draw')){
                    //audience screen has no this item
                    if (visible){
                        _.each(['drawcolor','drawsize','draweraser','drawclear'],function(name){
                            w2ui['toolbar'].show(name)
                        })
                        $('#tb_toolbar_item_draw tr').first().addClass('red')
                        $('#tb_toolbar_item_draw td.w2ui-tb-caption').css('color','white')
                    }
                    else{
                        _.each(['drawcolor','drawsize','draweraser','drawclear'],function(name){
                            w2ui['toolbar'].hide(name)
                        })
                        $('#tb_toolbar_item_draw tr').first().removeClass('red')
                        $('#tb_toolbar_item_draw td.w2ui-tb-caption').css('color','black')                        
                    }
                }                
                break
            case 'zoomout:enable':
                //update buttons of draw-family on the toolbar
                var enabled = data
                if (w2ui['toolbar'].get('zoomout')){
                    //audience screen has no this item
                    if (enabled){
                        $('#tb_toolbar_item_zoomout tr').first().addClass('red')
                        $('#tb_toolbar_item_zoomout td.w2ui-tb-caption').css('color','white')
                    }
                    else{
                        $('#tb_toolbar_item_zoomout tr').first().removeClass('red')
                        $('#tb_toolbar_item_zoomout td.w2ui-tb-caption').css('color','black')                        
                    }
                }
                break                
        }
    },
    /* implementations of sbs_user's delegation*/
    on_disconnected:function(){
        w2utils.lock(document.body,'reconnecting',true)
        //return true to ask sbs_user to reconnect
        return true
    },
    on_connected:function(){
        //called by self.sbs_user
        _.delay(function(){
            w2utils.unlock(document.body)
        },500)
        var self = this
        //var sdk = window.sdk //set by self.sbs_user.init()
        this.presentation.init(sdk).done(function(){
                self.sbs_user.call_when_ready(function(){
                    //wait for user.preferences to be available
                    self.on_presentation_did_init()
                })                
            }).fail(function(message){
                w2alert(message)
            })
    },
    on_presentation_did_init:function(){``
        var self = this

        // set_size requires "presentation ratio" to be available
        // so it is called here
        self.set_size()
        var options = self.sbs_user.preferences.get('screen').draw
        //console.log('options=',options)
        self.overlay.init(options) //should after resize()

        self.readonly = self.presentation.readonly
        console.log(self.presentation.threads.A.slides,'<<')
        //hook to dashboard if this is an embedded screen
        if (top == window){
            // the code block below is to render slide.
            // it might depends on delegate to be initialized
            // so we run it later after promise.resolve(self) been called
            setTimeout(function(){
                try{
                    if (_.size(self.presentation.threads)) {
                        self.presentation.on_thread_changed()
                    }
                    else{
                        self.on_no_slide()
                    }    
                }
                catch(e){
                    console.error(e)
                }
            },0)        
        }
        else{
            top.dashboard.presentation_screen = self
        }
        
        if (_.size(self.presentation.threads)==0) return
                       
      
        // create items for toolbar
        var items = []
        
        // let the embeded iframe to be top layer for original control, ex google slides
        items.push({type: 'button',  id: 'origin',  
            caption: 'Origin', img: 'icon-save', hidden:true,
            tooltip:'Bring embedded slide to top'
        })

        if (self.readonly){
            //for audience screen            
            items = items.concat([
                {type: 'button',  id: 'ask',  caption: 'Ask', img: 'icon-save'},
                
                // no chatting
                //{type: 'button',  id: 'chatroom',  caption: 'Chat', img: 'icon-save'},


                {type: 'button',  id: 'emotion',  caption: 'Emotion', img: 'icon-save'},
                
                {type: 'button',  id: 'sticker',  caption: 'Sticker', img: 'icon-save'},

            ])
            
            //mobile device does n't support fullscreen
            if (screenfull.enabled) items.push({type:'button', id:'fullscreen', caption:'Full Screen',img:'fa fas-camera'})
            
            items.push({type:'menu',id:'references',text:'References',items:[
                
            ]})

            items.push({type:'button',id:'qrcode_audience',text:'QRcode'})


            items.push({type:'spacer'})
            items.push({type: 'button',  id: 'aboutme',  caption: 'Who Am I', img: 'icon-save'})
       
            /* should be optional by dashboard
            items.push({type:'check',id:'pointer',text:'Pointer'})
            */
        }
        else{
            //for speacker sceeen, dashboard embedded screen
            items.push({type:'check',id:'zoomout',text:'Zoom',tooltip:'zoom out'})
            //items.push({type:'button',id:'escape',text:'Reset'})
            items.push({type:'break'})

            items.push({type:'check',id:'pointer',text:'Pointer'})
            //var pointer_color = self.sbs_user.preferences.get('screen').pointer.color
            items.push({type:'color', id:'pointercolor',color:self.pointers.meta.color,hidden:true})            
            items.push({type:'break'})

            items.push({type:'check',id:'draw',text:'Draw',tooltip:'Draw something on the slide'})
            var color = self.sbs_user.preferences.get('screen').draw.color
            items.push({type:'color', id:'drawcolor',color:color})
            items.push({type:'button', id:'drawsize',hidden:true,text:'Size'})
            items.push({type:'check', id:'draweraser',hidden:true,text:'Eraser'})
            items.push({type:'button', id:'drawclear',hidden:true,text:'Clear'})
            items.push({type:'break'})
            
            if (top == window){
                // these are not available to embedded screen in dashboard
                
                items.push({type:'check', id:'camera', caption:'Camera',img:'fa fas-camera',tooltip:'Show webcam (useful for screen recording)'})
                
                /* experimental
                items.push({type:'button', id:'recorder', caption:'Recorder',img:'fa fas-camera'})
                */
    
                //mobile device does n't support fullscreen
                if (screenfull.enabled){
                    items.push({type:'break'})
                    items.push({type:'button', id:'fullscreen', caption:'Full Screen',img:'fa fas-camera'})
                } 
                
                //seperate from "questions"
                items.push({type:'break'})
            }

            items.push({type:'check',id:'questions',text:'Questions'})

            items.push({type:'menu',id:'references',text:'References',items:[

            ]})

            items.push({type:'menu',id:'timer',text:'Timer', items:[
                {id:'timer', text:'Timer'},
                {id:'count_down', text:'Count Down Timer'}
                ]
            })

            //add video controller
            /*
            items.push({type:'break'})
            items.push({id:'video_play',type:'check',caption:'Play',img:'fa fa-play',hidden:true})
            items.push({id:'video_stop',type:'button',caption:'Stop',img:'fa fa-stop',hidden:true})
            */
           
            //items.push({type:'button',id:'qrcode',text:'QRcode'})

            items.push({type:'menu',id:'qrcode',text:'QRcode', items:[
                {id:'speaker', text:'For Speaker'},
                {id:'audience', text:'For Audience'}
            ]
            })
            items.push({type:'spacer'})
            if (self.presentation.isolated){
                items.push({type:'button', id:'sync', caption:'Sync',img:'fa fas-camera'})
                items.push({type:'break'})
            }
            items.push(
                {type:'html',  id: 'pageno',  html:function(){
                    return '[<span class="thread-name"></span>:<span class="slide-id"></span>]<span class="page-no">100</span>/<span class="page-total">100</span>'
                }, img:''},    
            )
        }
        $('#toolbar').w2toolbar({
            name:'toolbar',
            items:items,
            tooltip:'bottom',
            onClick:_.throttle(function(evt){
                switch(evt.target){
                    case 'zoomout':
                        evt.done(function(){
                            if (self.zoomout_enabled) {
                                self.disable_zoomout(true)
                            } 
                            else {
                                self.enable_zoomout()
                            }
                        })
                        break
                    /*
                    case 'escape':
                        //simulate 'escape' was pressed for mobile
                        self.presentation.keyboard_shortcut.handler['ESCAPE']()
                        break
                    */
                    case 'draw':
                        _.defer(function(){
                            if (self.draw_enabled) {
                                self.disable_draw()
                            } 
                            else {
                                self.enable_draw()
                            }
                        })
                        break
                    case 'drawclear':
                        self.overlay.clear()
                        self.presentation.current_slide.slide_overlay.layers[0] = []                        
                        var t_id = self.presentation.current_thread.id
                        var s_idx = self.presentation.current_slide.idx
                        self.presentation.send_to_bus('misc-sync',['overlay:clear',t_id, s_idx, 0])
                        break
                    case 'draweraser':
                        //w2ui does not set "checked" value at this moment,
                        //so we defer the running
                        _.defer(function(){
                            var yes = evt.item.checked
                            self.overlay.set_eraser_mode(yes)    
                        })
                        break
                    case 'drawsize':
                        // popup a color picker
                        if (self.overlay.eraser_mode){
                            var size = self.sbs_user.preferences.get('screen').draw.esize
                            var cls = 'eraser'
                            var color = ''
                        }
                        else{
                            var cls = ''
                            var size = self.sbs_user.preferences.get('screen').draw.size
                            var color = self.sbs_user.preferences.get('screen').draw.color
                        }
                        var html = ['<table style="margin:15px">']
                        html.push('<tr><td><input id="drawsize-picker" type="range" min="1" max="20" value="'+size+'"></td></tr>')
                        html.push('<tr><td style="text-align:center;height:30px">')
                        html.push('<span class="'+cls+'" id="drawsize-circle" style="width:'+size+'px;height:'+size+'px;background-color:'+color+';border-radius:'+Math.ceil(size/2)+'px">&nbsp;</span>')
                        html.push('<span style="display-inline">'+size+'</span>')
                        html.push('</td></tr>')
                        html.push('</table>')
                        // auto close drawsize's popup dialog by any click event
                        if (w2ui['drawsize_dialog']) {
                            w2ui['drawsize_dialog'].destroy()
                        }                        
                        $('#tb_toolbar_item_drawsize').w2overlay({
                            name:'drawsize_dialog',
                            openAbove: window.above,
                            align: window.align,
                            html: html.join('')
                        });
                        var adjust_size = function(n){
                            var ele = document.getElementById('drawsize-circle')
                            ele.style.width = n+'px'
                            ele.style.height = n+'px'
                            ele.style.borderRadius = Math.ceil(n/2)+'px'
                            ele.nextSibling.innerHTML = n
                        }
                        document.getElementById('drawsize-picker').oninput = function(evt){
                            adjust_size(parseInt(evt.currentTarget.value))
                        }
                        document.getElementById('drawsize-picker').onchange = function(evt){
                            //called once
                            var size = parseInt(evt.currentTarget.value)
                            //set to overlay
                            self.overlay.set_options({size:size})
                            //save to preferecnes
                            if (self.overlay.eraser_mode){
                                self.sbs_user.preferences.get('screen').draw.esize = size
                            }
                            else{
                                self.sbs_user.preferences.get('screen').draw.size = size
                            }                            
                            self.sbs_user.preferences.touch()
                        }                        
                        break
                    case 'pointercolor':
                        if (typeof(evt.color)=='undefined'){
                            //fired when user just click on this item only
                        }
                        else if (evt.color==''){
                            
                        }
                        else{
                            var color = '#'+evt.color
                            self.pointers.set_color(color)
                            //save to preferecnes
                            //self.sbs_user.preferences.get('screen').pointer = {color:color}
                            //self.sbs_user.preferences.touch()
                        }
                        break
                    case 'drawcolor':
                        if (typeof(evt.color)=='undefined'){
                            //fired when user just click on this item only
                        }
                        else if (evt.color==''){
                            self.overlay.set_eraser_mode(true)
                        }
                        else{
                            self.overlay.set_eraser_mode(false)
                            var color = '#'+evt.color
                            //set to overlay
                            self.overlay.set_options({color:color})
                            //save to preferecnes
                            self.sbs_user.preferences.get('screen').draw.color = color
                            self.sbs_user.preferences.touch()    
                        }
                        break                        
                    case 'camera':
                        evt.done(function(){
                            if (window.location.protocol.indexOf('https')==0){
                                if (self.camera_enabled) self.disable_camera()
                                else self.enable_camera()
                            }else{
                                w2ui['toolbar'].uncheck('camera')
                                w2popup.open({
                                    title:'Camera requires https',
                                    body:'<p>Due to browser\'s limitation, camera is only available on https</p>',
                                    buttons:'<button class="w2ui-btn" onclick="window.presentation_screen.go_secure_version()">Go</button><button class="w2ui-btn" onclick="w2popup.close()">Cancel</button>'
                                })
                            }    
                        })
                        break
                    /* experimental
                    case 'recorder':
                        if (self.recorder_started) self.stop_recorder()
                        else self.start_recorder()
                        break
                    */
                    case 'sync':
                        var t_id = self.presentation.current_thread.id
                        var s_idx = self.presentation.current_slide.idx
                        var panel_name = 'main'
                        var args = [panel_name,t_id,s_idx]
                        if (self.presentation.current_slide.resource.type == 'VIDEO'){
                            var extra = [
                                w2ui['toolbar'].player.getPlayerState(),
                                player_time = Math.floor(w2ui['toolbar'].player.getCurrentTime()),
                                Math.round(new Date().getTime()/1000),
                            ]
                            args.push(extra)
                        }
                        else if (self.presentation.current_slide.resource.type == 'OP'){
                            //kind = 'GS'
                            var extra = self.presentation.current_slide.resource.extra
                            args.push(extra)
                        }
                        self.presentation.send_to_bus('slide-sync',args)
                        break
                    case 'fullscreen':
                        self._requesting_fullscreen = true
                        self.request_fullscreen()
                        break
                    case 'pointer':
                        _.defer(function(){
                            if (self.pointers.enabled){
                                self.pointers.disable()
                            }
                            else{
                                self.pointers.enable()
                            }
                        })
                        break
                    case 'qrcode_audience':
                    case 'qrcode:speaker':
                        // copy the same url as current url, so this might be in 
                        // speaker or audience screen
                        var url = 'qrcode.html#'+encodeURIComponent(window.location.href)+'\t '//no title, so end with \t
                        var w = 300
                        var h = 320
                        w2popup.open({
                            width   : w+'px',
                            height  : h+'px',
                            title   : evt.target == 'qrcode' ? 'Audience Screen' : 'Speaker Screen',
                            body    : '<iframe style="border:none;padding-top:15px;width:'+(w-20)+'px;height:270px" src="'+url+'"></iframe>',
                            showMax : false
                        })                    
                        break
                    case 'qrcode:audience':
                        if (self.presentation.acl_token.as){
                            var url = 'qrcode.html#'+get_url_from_hash(self.presentation.hostname+',screen,'+'3'+self.presentation.acl_token.as,true)+'\t '//no title, so end with \t
                            var w = 300
                            var h = 320
                            w2popup.open({
                                width   : w+'px',
                                height  : h+'px',
                                title   : 'Audience Screen',
                                body    : '<iframe style="border:none;padding-top:15px;width:'+(w-20)+'px;height:270px" src="'+url+'"></iframe>',
                                showMax : false
                            })    
                        }
                        else{
                            w2alert('Audience screen is not available')
                        }  
                        break
                    case 'origin':
                        _.defer(function(){
                            if (self.origin_enabled){
                                self.disable_origin()
                            }
                            else{
                                self.enable_origin()
                            }
                        })
                        break
                }
            })
        })
        
        //style the toolbar, if is on top of "black area"(#page) set opacity=1
        //(temporary disable)
        var opacity = (!self.presentation.isolated && self.page_ele.style.width == self.screen_ele.style.width) ? 1 : 1
        w2ui['toolbar'].box.style.backgroundColor = 'rgba(255,255,255,'+opacity+')'
        w2ui['toolbar'].box.style.outline = '#c0c0c0 solid thin'

        /* temporary disabled for all
        // auto hide toolbar
        if (top==window && (! mobileAndTabletcheck())){
            //auto-hide feature are not avialable to mobile devices and embedded screen
            var fade_out_toolbar_timer = setTimeout(function(){
                w2ui['toolbar'].box.style.opacity = 0
            },3000)
            $('#toolbar').hover(function(){
                w2ui['toolbar'].box.style.opacity = 1
                if (fade_out_toolbar_timer) clearTimeout(fade_out_toolbar_timer)
            },function(){
                fade_out_toolbar_timer = setTimeout(function(){
                   w2ui['toolbar'].box.style.opacity = 0
                },3000)
            })    
        }
        */
    },
    /* implements Presentation's delegation */
    _on_unavailable:function(message){
        //helper of delegates
       this.render_slide('main',null,null,'pop-in')
       if (w2ui['toolbar']) w2ui['toolbar'].destroy()
    },
    get_flag_of_token:function(){
        return this.flag_of_token
    },
    on_get_presentation_error:function(){
        this._on_unavailable('The presentation is not found')
    },
    on_refresh_state_error:function(){
        //pass
    },
    on_refresh_state_did:function(){
        //pass
    },
    on_added:function(topic,data){
        //pass
    },
    on_swapped:function(topic,data){
        //pass
    },
    on_removed:function(topic,data){
        var self = this
        switch(topic){
            case 'presentation':
                if (!(this.presentation.isolated)){
                    document.getElementById('screen').innerHTML = ''
                    w2alert('The presentation has removed').done(function(){
                        //if this is in iframe, to idle_screen.jpg
                        window.location.href = 'index.html'
                    })    
                }
                else{
                    this._on_unavailable('The presentation removed')
                }                
                break
            case 'thread':
                // do nothing here, because prensention will call on_thread_changed() 
                // to render new focus slide
                break
            case 'slides':
                //do nothing, because the presentation instance will call render_slide if necessary
                break
        }
    },    
    on_shutdown:function(){
        var self = this
        document.getElementById('screen').innerHTML = ''
        if (!(this.presentation.isolated)){
            document.getElementById('screen').innerHTML = ''
            w2alert('The screen has shutdown').done(function(){
                //if this is in iframe, to idle_screen.jpg
                window.location.href = 'index.html'
            })    
        }
        else{
            this._on_unavailable('The screen has shutdown')
        }
    },
    on_no_slide:function(){
        this._on_unavailable('No slide to show')
    },
    on_no_thread:function(){
        this._on_unavailable('No slide to show')
    },
    on_no_more_thread:function(no_more){
        //pass
    },
    on_remote_thread_changed:function(t_id){
        //pass
    },
    on_message:function(s,keep){
        window.message(s,keep)
    },
    render_slide:function(panel_name,thread,slide,transtion){
        //clearup current slide
        var self = this
        
        if (w2ui['toolbar'].player && w2ui['toolbar'].player.sync_current_time_timer) {
            //reset video player
            clearTimeout(w2ui['toolbar'].player.sync_current_time_timer)
            delete w2ui['toolbar'].player.sync_current_time_timer
            w2ui['toolbar'].player = null
        }

        //remove gs-toolbar
        if (document.querySelector('.gs-toolbar')){
            $('.gs-toolbar').remove()
        }

        //reset overlay(drawing)
        this.overlay.clear()

        //reset zooming should be called in advance
        //this.reset_zooming()
        this.disable_zoomout()
        
        if (slide){
            //render panel's content
            var promise = new $.Deferred()
            //_.defer(function(){
                var dislpay_promise = self.dispaly_areas[panel_name].set_slide(slide,transtion)
                //redraw overlay, wait a while for better visual looking
                setTimeout(function(){
                    _.defer(function(){
                        //manually update the state of toolbar-draw button
                        //this code block is delayed so that when
                        //enable_draw or disable_draw fired event those
                        //listeners of 'DRAW:START' or 'DRAW:END' are ready
                        if (slide.slide_overlay.visible) {
                            w2ui['toolbar'].check('draw')
                            self.enable_draw(true)
                        }
                        else {
                            w2ui['toolbar'].uncheck('draw')
                            self.disable_draw(true)
                        }
                    })
                    self.overlay.draw_restore(slide.slide_overlay.layers[0])
                },250)

                if (slide.is_embedded){
                    w2ui['toolbar'].show('origin')
                }
                else{
                    w2ui['toolbar'].hide('origin')
                }

                //render page-no
                var ret = self.presentation.get_slide_info(slide)
                $('.page-no').html(ret.index+1)
                $('.page-total').html(ret.total)
                var name = slide.id.split('.')[0]
                $('.slide-id').html(name)
                $('.thread-name').html(self.presentation.current_thread.id)

                var z = slide.zoom
                var t = slide.translate
                self.presentation._scale = z[0]
                self.presentation._translate = [t[0],t[0]]
                //restore zoom and translate
                dislpay_promise.done(function(){
                    if (z[0]==1 && t[0]==0 && t[1]==0) {
                        // do nothing
                    }
                    else{
                        //we need to wait 100ms for reset zoom to complete
                        var _init_slide_transform = function(z,t){
                            if (z[0] !== 1){
                                self.set_zooming(z[0],z[1],z[2],true)
                            }
                            if (t[0]!== 0 || t[1] !== 0){
                                self.presentation.fire_event('OFFSET',t)
                            }
                        }
                        //setTimeout(function(){
                            _init_slide_transform(z,t)
                        //},10)
                    }
                    promise.resolve()
                })
            //})
            return promise
        }
        else{
            //simply display a black screen
            this.overlay.clear()
            this.overlay.show(false)
            this.dispaly_areas[panel_name].set_slide(null,transtion)
            $('.page-no').html('')
            $('.page-total').html('')
            $('.slide-id').html('')
            $('.thread-name').html('')
            return $.when()
        }

        
    },
    toggle_toolbar:function(yes){
        var _yes = (typeof(yes)=='undefined' ? $('#toolbar')[0].style.display=='none' : yes)
        $('#toolbar')[0].style.display = _yes  ? '' : 'none'
        return _yes
    },
    /* obsoleted
    get_zooming_area:function(){
        //sensor area, scale-together area
        return [this.overlay.overlay_surface,this.screen_ele]
    },
    */
    on_pointer:function(pointer_meta,data){
        //called remotely for syncing pointers
        if (data){
            this.pointers.sync_data(data)
        }
        else{
            this.pointers.sync_meta(pointer_meta)
        }
    },
    on_origin:function(enabled){
        if (enabled){
            this.enable_origin(true)
        }
        else{
            this.disable_origin(true)
        }
    },
    get_video_player:function(){
        return w2ui['toolbar'].player
    },
    /* experimental 
    stop_recorder: function(){
        this.recorder_started = false
        this.recorder.stop();
    },
    start_recorder: function(){
        this.recorder_started = true
        var self = this
        const getStreamForWindow = () => navigator.mediaDevices.getUserMedia({
            video: {
                mandatory: {
                    chromeMediaSource: 'screen'
                }
            }
        });
        // we ask for permission to record the audio and video from the camera
        const getStreamForCamera = () => navigator.mediaDevices.getUserMedia({
            audio: true
        });        
        const video = document.createElement('video');

        const appendCamera = (stream) => {
          document.body.appendChild(video);
          //video.src = URL.createObjectURL(stream);
          video.srcObject = stream
          video.style.height = '100%';
          video.style.width = '100%';
          video.volume = 0;
          video.play();
        };

        getStreamForCamera().then(streamCamera => {
            // we know have access to the camera, let's append it to the DOM
            appendCamera(streamCamera);
            getStreamForWindow().then(streamWindow => {
        
              // we now have access to the screen too
              // we generate a combined stream with the video from the
              // screen and the audio from the camera
              var finalStream = new MediaStream();
              const videoTrack = streamWindow.getVideoTracks()[0];
              finalStream.addTrack(videoTrack);
              const audioTrack = streamCamera.getAudioTracks()[0];
              finalStream.addTrack(audioTrack);
              self.recorder = new MediaRecorder(finalStream);
        
              // we subscribe to 'ondataavailable'.
              // this gets called when the recording is stopped.
              self.recorder.ondataavailable = function(e) {
                // let's create a blob with e.data which has the
                // contents of the video in webm
                var link = document.createElement('a');
                link.setAttribute('href', window.URL.createObjectURL(e.data));
                link.setAttribute('download', 'video_' + Math.floor((Math.random() * 999999)) + '.webm');
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }        
              // start recording
              self.recorder.start();
            });
        });                
    },*/
    set_zooming:function(scale,offsetX,offsetY,is_relative){
        var self = this
        var presentation = this.presentation
        presentation._scale = scale
        
        //auto enable zooming out if necessary,
        //this will enable zooming for another presenter screen
        if (scale > 1 && !this.zoomout_enabled){
            this.enable_zoomout()
        }

        var _sensor_ele = this.overlay.overlay_surface
        var _screen_ele = this.screen_ele

        if (is_relative){
            var _screen_rect = self.screen_rect
            offsetX =  Math.round(offsetX * _screen_rect.width)
            offsetY =  Math.round(offsetY * _screen_rect.height)
        }
        /*
         * This function will not change current slide's zoom property.
         * It should be changed before calling this function to apply on rendering.
         */
        // centric to mouse position (make this point static)
        var translate = presentation._translate
        var transform = 'scale('+scale+') translate('+translate[0]+'px,'+translate[1]+'px)'
        var transformOrigin = offsetX+'px '+offsetY+'px 0px'
        
        _sensor_ele.style.transformOrigin= transformOrigin
        _sensor_ele.style.transform = transform
        _sensor_ele.style.webkitTransformOrigin = transformOrigin
        _sensor_ele.style.webkitTransform = transform
        
        _screen_ele.style.transformOrigin = transformOrigin
        _screen_ele.style.transform = transform
        _screen_ele.style.webkitTransformOrigin = transformOrigin
        _screen_ele.style.webkitTransform = transform
        
        self.enable_dragging()
        
        // update scale on if draw_enabled, important!
        // this make drawing position correctly
        if (self.draw_enabled) self.overlay.set_scale(scale)

        //auto hide toolbar if scale > 1.1
        /* disabled, seems not necessary and prohibit to press "reset" button
        if (scale > 1.1 && (!this._toolbar_setting_timer) && this._toolbar_visible){
            var self = this
            this._toolbar_setting_timer = setTimeout(function(){
                delete self._toolbar_setting_timer
                self.delegate.toggle_toolbar(false)
            },1000)
        } 
        */
    },    
    enable_zoomout:function(){   
        //enable/disable zooming does not synced between speaker screens
        var self = this
        this.zoomout_enabled = true

        //do some side-settings to zoomout button
        //should wait a 50ms interval to let adding red class to button taking effective
        _.delay(function(){self.fire_event('zoomout:enable',true)},50)

        var _sensor_ele = this.overlay.overlay_surface
        var _screen_ele = this.screen_ele
        var _screen_rect = this.screen_rect
        var presentation = this.presentation
        
        var scale = presentation._scale
        var translate = presentation._translate

        var transform = 'scale('+scale+') translate('+translate[0]+'px,'+translate[1]+'px)'      
        //these two are necessary
        _sensor_ele.style.transform = transform
        _screen_ele.style.transform = transform

        var unit_y = 2500 //sensetivity
        var mousewheel_handler = function(evt){
            
            if (!self.zoomout_enabled) return 

            if (!evt.metaKey) return

            //scale range 1 ~ 2.5
            scale = Math.round(1000 * Math.min(2.5, Math.max(1, presentation._scale+(evt.wheelDelta/unit_y))))/1000;
            if (presentation._scale == scale) return //same scale, do nothing
            presentation._scale = scale
            var t_id = presentation.current_thread.id
            var s_idx = presentation.current_slide.idx
            if (scale==1){
                presentation.current_slide.zoom = [1,0,0]
                presentation.current_slide.translate = [0,0]                
                self.reset_zooming(true)
            }
            else {
                self.set_zooming(scale,evt.offsetX,evt.offsetY)
                //normalize offsetX,offsetY (relative to width and height repectively)
                var offset_x = Math.round(100*evt.offsetX/_screen_rect.width)/100
                var offset_y = Math.round(100*evt.offsetY/_screen_rect.height)/100
                presentation.current_slide.zoom = [scale,offset_x,offset_y]
                
                //sync to others
                var data = [t_id,s_idx,scale,offset_x,offset_y]
                presentation.send_to_bus('zoom-sync',data)
            }
        }
        _sensor_ele.addEventListener('mousewheel',mousewheel_handler)

        var pinch_start_hander, pinch_end_hander
        if (mobileAndTabletcheck()){
            var pinch = false
            var last_tap = 0 //for detecting double-tap
            var start_scale
            pinch_start_handler = function(evt){
                
                if (!self.zoomout_enabled) return 

                if (evt.touches.length>1) {
                    pinch=[(evt.touches[1].clientX+evt.touches[0].clientX)/2,(evt.touches[0].clientY+evt.touches[1].clientY)/2];
                    start_scale = detectZoom.zoom()
                    presentation.fire_event('PINCH:START')
                    return
                }
                else {//if (e.touches.length==1){
                    var now = new Date().getTime()
                    var double_tap = now - last_tap < 350
                    last_tap = now
                    if (double_tap){
                        //evt.preventDefault()
                        //evt.stopPropagation()
                        _.defer(function(){
                            /*
                            presentation.current_slide.zoom = [1,0,0]
                            presentation.current_slide.translate = [0,0]
                            */
                            self.disable_zoomout(true)
                        })
                    } 
                }        
            }
            pinch_end_hander = function(evt){
                
                if (!self.zoomout_enabled) return 

                if (pinch) {
                    var scale = detectZoom.zoom();
                    presentation.fire_event('PINCH:END')
                    if (scale !== start_scale) {
                        if (scale > 1){
                            
                            self.overlay.set_scale(scale)

                            self.enable_dragging()
                            var t_id = presentation.current_thread.id
                            var s_idx = presentation.current_slide.idx
                            presentation.current_slide.zoom = [Math.round(1000*scale)/1000,Math.round(100*pinch[0]/self.screen_rect.width)/100,Math.round(100*pinch[1]/self.screen_rect.height)/100]
                            presentation.send_to_bus('zoom-sync',[t_id,s_idx].concat(presentation.current_slide.zoom))
                        }
                        else{
                            presentation.current_slide.zoom = [1,0,0]
                            presentation.current_slide.translate = [0,0]
                            self.reset_zooming(true)
                        }    
                    }
                    pinch=false;
                    return
                }            
            }
            _sensor_ele.addEventListener('touchstart',pinch_start_handler)
            _sensor_ele.addEventListener('touchend',pinch_end_hander)
        }

        var escape_handler = function (){
            //self.reset_zooming(true)
            _.defer(self._disable_zoomout)
        } 
        presentation.add_event_listener('ESCAPE',escape_handler)

        self._disable_zoomout = function(reset_data){
            //do some side-settings to zoomout button
            //should wait a 50ms interval to let adding red class to button taking effective
            if (reset_data){
                presentation.current_slide.zoom = [1,0,0]
                presentation.current_slide.translate = [0,0]    
            }

            _.delay(function(){self.fire_event('zoomout:enable',false)},50)
    
            _sensor_ele.removeEventListener('mousewheel',mousewheel_handler)

            if (mobileAndTabletcheck()){
                _sensor_ele.removeEventListener('touchstart',pinch_start_handler)
                _sensor_ele.removeEventListener('touchend',pinch_end_hander)                
            }

            presentation.remove_event_listener('ESCAPE',escape_handler)

            self.zoomout_enabled = false
            self.reset_zooming(true)

            delete self._disable_zoomout
        }

    },
    disable_zoomout:function(reset_data){
        if (this._disable_zoomout) this._disable_zoomout(reset_data)
    },
    reset_zooming:function(request_sync){
        // will set scale to 1 and translate to 0,0
        var self = this
        var presentation = this.presentation
        presentation._scale = 1
        _.delay(function(){
            //on macbookpor's touchpad, onmouseup event fired with delay.
            //but "escape" could happen before delay endsup.
            //this listener will override reset value of scale and transform
            //as a workaround, we delay this reset
            presentation._translate[0] = 0
            presentation._translate[1] = 0    
        },1000)

        var _sensor_ele = this.overlay.overlay_surface
        var _screen_ele = this.screen_ele
        /*
        * This function will not change current slide's zoom property.
        * It should be changed before calling this function to apply on rendering.
        */        
        _sensor_ele.style.transformOrigin= '0px 0px'
        _screen_ele.style.transformOrigin= '0px 0px'
        _sensor_ele.style.transform = 'scale(1.0) translate(0px,0px)'
        _screen_ele.style.transform = 'scale(1.0) translate(0px,0px)'

        _.defer(function(){self.overlay.set_scale(1)},100)
        
        //dragging might not been enabled
        if (this.disable_dragging) {
            this.disable_dragging()
        } 
        
        /*
        //restore toolbar
        if (presentation._toolbar_setting_timer) {
            clearTimeout(presentation._toolbar_setting_timer)
            delete presentation._toolbar_setting_timer
        }
        //reset directly by delegate
        this.toggle_toolbar(presentation._toolbar_visible)
        */

        if (request_sync){
            var t_id = presentation.current_thread.id
            var s_idx = presentation.current_slide.idx
            presentation.send_to_bus('zoom-sync',[t_id,s_idx,1,0,0])
        }
        
    },    
    enable_dragging: function(){
        //called when scale > 1
        var self = this
        if (this.dragging_enabled) return
        this.dragging_enabled = true
        //make slide draggable if not drawing 
        var target_ele0 = document.getElementById('screen')
        var target_ele1 = document.getElementById('overlay_surface')
        var control_ele = document.getElementById('page')
        var control_rect = control_ele.getBoundingClientRect()
        var last_offset = self.presentation._translate

        var pos1=last_offset[0], pos2=last_offset[0], pos3, pos4
        var is_mouse = false
        var scale = 1
        self.presentation.add_event_listener('PINCH:START',function(){
        })
        self.presentation.add_event_listener('PINCH:END',function(){
        })
        var emit_offset_sync = _.throttle(function(){
            var t_id = self.presentation.current_thread.id
            var s_idx = self.presentation.current_slide.idx
            var rel_pos1 = Math.round(pos1/control_rect.width*100)
            var rel_pos2 = Math.round(pos2/control_rect.height*100)
            self.presentation.send_to_bus('translate-sync',[t_id,s_idx,rel_pos1,rel_pos2])
        },100)        
        var mousemove = function(evt){

            if (!(is_mouse || evt.touches.length==1)) return

            // calculate the new cursor position:
            var clientX = is_mouse ? evt.clientX : evt.touches[0].clientX
            var clientY = is_mouse ? evt.clientY : evt.touches[0].clientY
            pos1 =  Math.floor((clientX - pos3)/scale)  + last_offset[0]
            pos2 =  Math.floor((clientY - pos4)/scale)  + last_offset[1]            
            
            var transform = 'scale('+scale+') translate('+pos1+'px,'+pos2+'px)'
            target_ele0.style.transform = transform
            target_ele1.style.transform = transform
            
            emit_offset_sync()
        }//end of mousemove listener   
        var mouseup = function(evt){
            if (is_mouse || (evt.touches.length==0)){
                control_ele.removeEventListener('mousemove',mousemove)
                control_ele.removeEventListener('mouseup',mouseup)
                control_ele.removeEventListener('touchmove',mousemove)
                control_ele.removeEventListener('touchend',mouseup)
                last_offset[0] = pos1
                last_offset[1] = pos2
                
            }
        }//end of mouseup listener             
        var mousedown = function(evt){
            //response to drawing when zoom out
            if (self.draw_enabled) return

            is_mouse = evt.type=='mousedown'
            //works only for mouse left button and one-finger touch 
            if (is_mouse && evt.which !== 1) return
            else if (!is_mouse && evt.touches.length > 1){
                control_ele.removeEventListener('touchmove',mousemove)
                return
            }
            scale = self.presentation._scale

            // get the mouse cursor position at startup:
            if (is_mouse){
                pos3 = evt.clientX;
                pos4 = evt.clientY;
            }
            else{
                pos3 = evt.touches[0].clientX;
                pos4 = evt.touches[0].clientY;
            }

            if (is_mouse) {
                control_ele.addEventListener('mousemove',mousemove)
                control_ele.addEventListener('mouseup',mouseup)
            }
            else{
                control_ele.addEventListener('touchmove',mousemove)
                control_ele.addEventListener('touchend',mouseup)
            } 

        }//end of mousedown event listner
        if (mobileAndTabletcheck()){
            control_ele.addEventListener('touchstart',mousedown)
        }
        else{
            control_ele.addEventListener('mousedown',mousedown)
        }

        self.disable_dragging = function(){
            if (!self.dragging_enabled) return
            self.dragging_enabled = false
            var listeners;
            if (mobileAndTabletcheck()) listeners = [['touchstart',mousedown],['touchmove',mousemove],['touchend',mouseup]]             
            else listeners = [['mousedown',mousedown],['mousemove',mousemove],['mouseup',mouseup]]
            _.each(listeners, function(listener){
                control_ele.removeEventListener(listener[0],listener[1])
            }) 
        }
        //fire event (disabled, no listener)
        //self.presentation.fire_event('DNZ:START')
    },
    enable_draw:function(){
        var self = this
        this.draw_enabled = true
        var visible = true
        
        //do some side-settings to draw button
        //should wait a 50ms interval to let adding red class to button taking effective
        _.delay(function(){self.fire_event('overlay:visible',visible)},50)
        
        var slide = self.presentation.current_slide
        var display_none = false
        self.overlay.show(visible,display_none)
        self.overlay.set_scale(self.presentation._scale)

        //this is no more used, shoulde be cancelled
        //slide.slide_overlay.visible = visible

        //fire event (disabled, no listener)
        //self.presentation.fire_event('DRAW:START')
    },
    disable_draw:function(){
        var self = this
        this.draw_enabled = false
        var visible = false
        //add some flavor to overlay button
        self.fire_event('overlay:visible',visible)
        var slide = self.presentation.current_slide
        var display_none = slide.is_embedded ? true : false
        self.overlay.show(visible,display_none)
        slide.slide_overlay.visible = visible

        //fire event (disabled since no listener)
        //self.presentation.fire_event('DRAW:END')
    },
    enable_origin:function(called_by_sync){
        var self = this

        this.origin_enabled = true
        // delay a while to make restoring "draw" button's red class taking effective
        // when it was disabled by enabling pointer
        _.delay(function(){self.fire_event('origin:enable',true)},50)        

        _.each($('.origin-hide-me'),function(ele){
            if (self.origin_enabled){
                ele.style.display = 'none'
            }
            else{
                ele.style.display = ''
            }
        })

        if (self.draw_enabled) {
            self.disable_draw()
            w2ui['toolbar'].uncheck('draw') //solve a timing issue
        }
        if (self.pointers.enabled) {
            self.pointers.disable()
            w2ui['toolbar'].uncheck('pointer')  //solve a timing issue
        }
        _.each(['pointer','draw','camera','fullscreen'],function(name){
            w2ui['toolbar'].disable(name)
        })    

        if (called_by_sync){
            //pass
        }
        else{
            self.presentation.send_to_bus('misc-sync',['origin',1]) 
        }

        //fire event (disabled since no listener)
        //self.presentation.fire_event('ORIGIN:START')

    },    
    disable_origin:function(called_by_sync){
        var self = this

        this.origin_enabled = false
        // delay a while to make restoring "draw" button's red class taking effective
        // when it was disabled by enabling pointer
        _.delay(function(){self.fire_event('origin:enable',false)},50)        


        _.each($('.origin-hide-me'),function(ele){
            ele.style.display = ''
        })

        _.each(['pointer','draw','camera','fullscreen'],function(name){
            w2ui['toolbar'].enable(name)
        })    

        if (called_by_sync){
            //pass
        }
        else{
            self.presentation.send_to_bus('misc-sync',['origin',0]) 
        }

        //fire event (disabled since no listener)
        //self.presentation.fire_event('ORIGIN:END')

    },
    disable_camera:function(){
        this.camera_enabled = false
        this.fire_event('camera:enable',false)

        document.querySelector('#camera').style.display = 'none'
        _.each(window.stream.getTracks(),function(track){track.stop()})
        delete window.stream
        window.stream = null
        w2popup.close()
    },
    enable_camera:function(){      
        this.camera_enabled = true
        this.fire_event('camera:enable',true)

        var self = this
        var camera_box = w2popup.open({
            name:'camera',
            title:'<button id="camera-box-resize-btn" class="w2ui-popup-btn" tooltip="bottom:drag lower right coner to resize">Resize</button>'+
                '<button style="display:none" id="camera-box-fixsize-btn" class="w2ui-popup-btn">Fix size</button>'+
                '<button style="display:none" id="camera-box-resizedone-btn" class="w2ui-popup-btn">Done</button>',
            opacity:1,
            width:320,
            height:240,
            body:'<div style="width:100%;height:100%" id="camera"><video autoplay></video></div>',
            style:'padding:0;margin:0;width:100%;background-color:#f0f0f0',
            onClose:function(){
                //self.camera_enabled is true, if this close event
                //is triggerred by self.disable_camera,
                //so we need not to call it again.
                if (self.camera_enabled) self.disable_camera()
            }
        })

        //relayout this popup
        var $popup = $('#camera').closest('.w2ui-popup')
        $popup.find('.w2ui-popup-body').css(
            {'margin-top':'-32px','height':'auto','overflow':'hidden'}
        )
        $popup.find('.w2ui-popup-title').css(
            {'background-image':'none','border':'none'}
        )
        $popup.find('.w2ui-popup-title').hover(
            function(evt){
                if (resizable || size_fixed) return
                $(evt.currentTarget).css({'background-image':''})
                $('#camera-box-resize-btn').show()
            },
            function(evt){
                if (resizable || size_fixed) return
                $(evt.currentTarget).css({'background-image':'none'})
                $('#camera-box-resize-btn').hide()
            }
        )        
        camera_box.unlockScreen()

        // create camera object and handles resizing
        var resolutions = [
            {width:{min:2048},height:{min:1536}},
            {width:{min:1024},height:{min:768}},
            {width:{min:640},height:{min:480}}
        ]
        // figure out the max available resolution 
        var resolution_idx = 0
        var constraints = {
            audio: false,
            video: true,
            frameRate : {min: 5, max: 8 },
            facingMode: { exact: "environment" },
            video: resolutions[resolution_idx]
        };        
        var video = window.video = document.querySelector('#camera video');
        video.style.transformOrigin = 'left top'
        var resizable = false
        var size_fixed = false
        var video_settings = null
        var origin_width = 320 //parseInt($('#camera-box')[0].style.width)
        var last_scale = 0 
        var update_video_scale = function(){
            var width = video_settings.width
            var height = video_settings.height
            if (last_scale==0){
                var scale = Math.round(100 * origin_width/width)/100
                $popup.height(Math.ceil(height * scale))
            }
            else if (last_scale != scale){
                var box_width = $popup.width()
                var scale = Math.round(100 * box_width/width)/100
                //$popup.find('.w2ui-popup-body').height(Math.ceil( box_width * (height/width)) )    
            }
            if (scale != last_scale){
                video.style.transform = 'scale('+scale+')'
                last_scale = scale
            }
            if (resizable) setTimeout(function(){update_video_scale()},200)
        }

        window.set_tooltip(document.getElementById('camera-box-resize-btn'))//,'drag lower right coner to resize','down')

        //must to listen on mousedown, not click, click will not be called on title
        $('#camera-box-resize-btn').on('mousedown',function(evt){
            resizable = true
            size_fixed = false
            //must delayed to make it works (no idea why)
            _.delay(function(){
                document.getElementById('camera-box-fixsize-btn').setAttribute('tooltip','bottom:fix camera frame size')
                window.set_tooltip(document.getElementById('camera-box-fixsize-btn'))
                $('#camera').closest('.w2ui-popup').css({'resize':'both'})
                $('#camera').closest('.w2ui-box').css({'pointer-events':'none'})             
                $('#camera-box-fixsize-btn').show()
                $('#camera-box-resizedone-btn').show()
                $('#camera-box-resize-btn').hide()   
            },100)
            setTimeout(function(){
                update_video_scale()
            },500)
        })
        $('#camera-box-fixsize-btn').on('mousedown',function(evt){
            evt.preventDefault()
            if (resizable){
                //enter fixed mode
                evt.currentTarget.innerHTML = 'Rescale'
                document.getElementById('camera-box-fixsize-btn').setAttribute('tooltip','bottom:scaling camera frame size to bounding box')
                window.set_tooltip(document.getElementById('camera-box-fixsize-btn'))
                resizable = false
                size_fixed = true
            }
            else{
                //enter rescaling mode
                evt.currentTarget.innerHTML = 'Fix'
                document.getElementById('camera-box-fixsize-btn').setAttribute('tooltip','bottom:fix camera frame size')
                window.set_tooltip(document.getElementById('camera-box-fixsize-btn'))
                size_fixed = false
                resizable = true
            }            
        })
        $('#camera-box-resizedone-btn').on('mousedown',function(){
            $('#camera').closest('.w2ui-popup').css({'resize':'none'})
            $('#camera').closest('.w2ui-box').css({'pointer-events':''})    
            resizable = false
            size_fixed = false //reset
            $('#camera-box-resize-btn').show()
            $('#camera-box-fixsize-btn').hide()
            $('#camera-box-resizedone-btn').hide()
        })


       


        var handleSuccess = function(stream) {
            window.stream = stream; // make stream available to browser console
            video.srcObject = stream;
            //console.log(stream.getVideoTracks()[0].getSettings(),'<<')
            video_settings = stream.getVideoTracks()[0].getSettings()
            setTimeout(function(){update_video_scale()},1000)
            console.log('use resolution',resolutions[resolution_idx])
        }          
        var handleError = function(error) {            
            if (resolution_idx < resolutions.length-1){
                resolution_idx += 1
                constraints.video = resolutions[resolution_idx]
                request_video()
            }
            else{
                console.log('navigator.getUserMedia error: ', error);
            }

        }
        var request_video = function(){
            navigator.mediaDevices.getUserMedia(constraints).
            then(handleSuccess).catch(handleError);    
        }
        request_video()
        

        //video.className = 'invert'

        var take_snapshot = function(){
            var canvas = document.createElement('canvas')
            rect = video.getBoundingClientRect()
            canvas.width = rect.width
            canvas.height = rect.height
            canvas.className = 'invert'
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            var data = canvas.toDataURL('image/jpeg')
            
            //temporary diable (API changed)
            //self.send_to_bus('snapshot',data,true)
            
            /*
            var dlLink = document.createElement('a');
            dlLink.download = 'test.jpeg';
            dlLink.href = data;
            dlLink.dataset.downloadurl = ['image/jpeg', dlLink.download, dlLink.href].join(':');
        
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
            */
        }

        video.onloadedmetadata = function(){
            //setTimeout(function(){take_snapshot()},100)
        }


    },
    on_resize:function(){
        //called by dashboard
        window.onresize()
    },
    go_secure_version:function(){
        //sidebyside_config is a global var in sbs_user
        var SIDEBYSIDE_SERVER = sidebyside_config.server
        var ports = SIDEBYSIDE_SERVER.https //defined in sbsuser.js
        var url = location.href.replace('http://','https://').replace(':'+SIDEBYSIDE_SERVER.http.port,':'+SIDEBYSIDE_SERVER.https.port)
        location.href=url
    }
}

$(function(){
    //figure out what hash we have, and recover hash from localstorage if necessary
    var hash = window.location.hash.replace(/^#/,'')
    if (!hash) {
        window.location.href = 'index.html'
    }

    var flag_of_token = parseInt(hash.substring(0,1))//1,2,3 or 4

    var p_id = hash.substring(1)
    
    window.presentation_screen = new PresentationScreen(p_id, $('#page')[0],flag_of_token)

    if (!(window.presentation_screen.presentation.isolated)){
        
        window.presentation_screen.init()

        //enable the QRcode button on lower left
        /*
        $('#qrcode-btn').on('click',function(){
            var url = 'qrcode.html#'+encodeURIComponent(window.location.href)+'\t'
            var rect = document.getElementById('screen').getBoundingClientRect()
            var w = 300
            var h = 300
            w2popup.open({
                width   : w+'px',
                height  : h+'px',
                //title   : 'QRcode of this page',
                body    : '<iframe style="border:none;padding-top:15px;width:'+(w-20)+'px;height:'+(h-20)+'px" src="'+url+'"></iframe>',
                showMax : false
            })
        }) 
        */   
    }
    else{
        //in iframe (dashboard.html)

        //don't need to show qrcode
        $('#qrcode-btn').hide()
        
        //don't show h-scrollbar
        document.body.style.overflowX = 'hidden' 

        //add callback to dashboard for this embedded screen
        top.dashboard.call_when_ready(function(presentation,sbs_user){
            window.presentation_screen.init(sbs_user)
            window.presentation_screen.presentation.clone(presentation)
            window.presentation_screen.on_presentation_did_init()
        })
    }

    /* implement window.message */
    var _mt;
    window.message = function(html, keep){
        /* keep:(boolean) */
        if (_mt) {clearTimeout(_mt);_mt=null}
        if (html){
            document.getElementById('message').innerHTML = html   
            document.getElementById('message').style.display = 'block'    
            if (keep) return
            _mt = setTimeout(function(){
                window.message('')
            },500)
        }
        else{
            document.getElementById('message').style.display = 'none'
            return
        }
    }

    //implement loading
    window.loading = function(yes,message,showSpinner){
        if (yes && window._loading_count) return ++window._loading_count
        if (yes){
            window._loading_count = 1
            document.body.cursor = 'wait'
            w2utils.lock(document.body,message,showSpinner)
        }
        else if (window._loading_count){
            window._loading_count -= 1
            if (!window._loading_count){
                delete window._loading_count
                document.body.cursor = ''
                w2utils.unlock(document.body)
            }
        }
    }

    // no need to listen "orientationchange", because orientation change will trigger resize event too.
    // but pinch would also trigger "resize" event, so we have to prohibit it to occure reload
    var _pinching = false 
    window.addEventListener('touchstart',function(evt){
        _pinching = (evt.touches.length==2) ? true : false
    },false)
    window.addEventListener('touchend',function(evt){
        _pinching = (evt.touches.length==2) ? true : false
    },false)

    //handle window resizing
    //called also by dashboard when user adjust panel size
    //rotation in mobile iOS would trigger this event too
    var refresh_overlay = _.throttle(function(){
            //draw drawings on overlay 
            window.presentation_screen.overlay.draw_restore(window.presentation_screen.presentation.current_slide.slide_overlay.layers[0])
        },  1000, {trailing:true,leading:false})
    
    window.onresize =  _.throttle(function(evt){
        
        //mobile safari fires a resize event soon after loading, ignore it
        if (evt.timeStamp < 3000) return

        if (_pinching) return

        //triggered by fullscreen request, so we dont need to reload
        if (window.presentation_screen._requesting_fullscreen){
            delete window.presentation_screen._requesting_fullscreen
            return
        }

        window.presentation_screen.set_size() 
        var panel_name = 'main'
        window.presentation_screen.dispaly_areas[panel_name].content_fitting()
        var slide = window.presentation_screen.presentation.current_slide
        if (!slide.slide_overlay.visible){
            var display_none = slide.is_embedded ? true : false
            window.presentation_screen.overlay.show(false,display_none)
        }

        // gs-toolbar
        var gs_toolbar_div = document.querySelector('.gs-toolbar')
        if (gs_toolbar_div){
            var rect = window.presentation_screen.screen_rect
            var toolbar_height = 29 // div.punch-viewer-nav-v2.punch-viewer-nav-fixed
            gs_toolbar_div.style.top = (rect.top+rect.height - toolbar_height )+'px'
            gs_toolbar_div.style.left = (rect.left+2)+'px'
        }

        refresh_overlay()

    },200)

    window.set_tooltip = function(top_ele){
        /* top_ele, an element has attribute tooltip,
           if it has not, search for all its children.
           tooltip format: "position;content"
           position := top, bottom, right, left
           ex: <a tooltip="bottomLthis is a book">
        */
        var _add_tip = function(ele){
            $(ele).hover(function(evt){
                var content = evt.currentTarget.getAttribute('tooltip')
                var pos = content.indexOf(':')
                var position = content.substring(0,pos)
                var message =  content.substring(pos+1)
                $(evt.currentTarget).w2tag(message,{position:position})
            },function(evt){
                $(evt.currentTarget).w2tag('')
            })
        }
        if (top_ele.getAttribute('tooltip')){
            _add_tip(top_ele)
        }
        else{
            _.each(ele.querySelectorAll('[tooltip]'),function(ele){
                _add_tip(ele)
            })    
        }
    }
})