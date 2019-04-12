/*
 * Features of this page
 * - show QRcode for screen and remote controller
 * - add/remove/replace slides to thread
 * - add/remove thread
 * - show/set focus thread/slide
 * - set presentation settings (config)
 * - show user's response
 * 
 * z-index
 * # 100 toolbar
 * 
 * icons: https://fontawesome.com/icons?d=listing&m=free
 */
function VirtualOverlay(dashboard){
    this.dashboard = dashboard
    this.scale = 1.0
}
VirtualOverlay.prototype={
    show:function(visible){
    },
    set_scale:function(scale,offsetX,offsetY){
        this.scale = scale
    },
    draw_sync:function(){
        //pass
    },
    erase:function(){
        //pass
    },
    clear:function(){
        //pass
    }
}
function Dashboard(p_id,flag_of_token){
    this.p_id = p_id
    this.flag_of_token = flag_of_token
    this.overlay = new VirtualOverlay(this)
    
    this.presentation = new Presentation(p_id,this,{
        keyboard_shortcut:false,
        isolated: false
    })
    //this.presentation.isolated = true

    this.dnd_enabler = null
    this.sbs_user = null
    this.p_state = null

    // use myown keyboard-shortcut(disable the one in Presentation)
    this.keyboard_shortcut = new KeyboardShortcut(this)
    //reset keyboard shortcuts
    this.keyboard_shortcut.handler = {}

    // dashboard-settings
    this.settings = {
        scale:1.0,//slide thumbnail's scale
    }

    // dashboard's private presentation_screen(screen.js in iframe)
    this.presentation_screen = null

}
Dashboard.prototype = {
    init:function(){
        var self = this
        this.sbs_user = new SBSUser(this)
        //do rending-related initialization here
        
        //main layout
        /*
        self.toolbar_update_speaker_menuitem = function(do_ss_start){
            // skip this update if current state is what wanted
            if ((do_ss_start ^ w2ui['toolbar'].get('speaker_screen:open').disabled)) return
            var subItem = w2ui['toolbar'].get('speaker_screen:start')
            if (do_ss_start){
                subItem.text = 'Shutdown Speaker Screen'
                w2ui['toolbar'].enable('speaker_screen:open')
                w2ui['toolbar'].enable('speaker_screen:open_qrcode')
                w2ui['toolbar'].enable('speaker_screen:camera') 
                
                w2ui['toolbar'].enable('remote_controller')
                w2ui['toolbar'].enable('audience')
                //because we enable remote_controller,audidence too so wait 100ms to make this click works
                setTimeout(function(){w2ui['toolbar'].click('speaker_screen')},100)
            }
            else{
                subItem.text = 'Start Speaker Screen'
                w2ui['toolbar'].disable('speaker_screen:open')
                w2ui['toolbar'].disable('speaker_screen:open_qrcode')
                w2ui['toolbar'].disable('speaker_screen:camera') 
                //also shutdown remote controller
                w2ui['toolbar'].disable('remote_controller')
                //also shutdown audience screen
                w2ui['toolbar'].disable('audience')
                w2ui['toolbar'].get('audience:start').text = 'Start Audience Screen'
                w2ui['toolbar'].disable('audience:open')
                w2ui['toolbar'].disable('audience:open_qrcode')
                w2ui['toolbar'].disable('audience:asking')
                w2ui['toolbar'].disable('audience:chatting')
            }    
        }
        self.toolbar_update_audience_menuitem = function(do_as_start){
            // skip this update if current state is what wanted
            if ((do_as_start ^ w2ui['toolbar'].get('audience:open').disabled)) return
            var subItem = w2ui['toolbar'].get('audience:start')
            if (do_as_start){
                subItem.text = 'Shutdown Audience Screen'
                w2ui['toolbar'].enable('audience:open')
                w2ui['toolbar'].enable('audience:open_qrcode')
                w2ui['toolbar'].enable('audience:asking')
                w2ui['toolbar'].enable('audience:chatting')
                w2ui['toolbar'].click('audience')   
            }
            else{
                subItem.text = 'Start Audience Screen'
                w2ui['toolbar'].disable('audience:open')
                w2ui['toolbar'].disable('audience:open_qrcode')
                w2ui['toolbar'].disable('audience:asking')
                w2ui['toolbar'].disable('audience:chatting')
            }
        }
        self.toolbar_update_sharing_menuitem = function(do_ds_start){
            // skip this update if current state is what wanted
            if ((do_ds_start ^ w2ui['toolbar'].get('dashboard_sharing:open_qrcode').disabled)) return
            var subItem = w2ui['toolbar'].get('dashboard_sharing:start')
            if (do_ds_start){
                subItem.text = 'Shutdown Dashboard Sharing'
                w2ui['toolbar'].enable('dashboard_sharing:open')
                w2ui['toolbar'].enable('dashboard_sharing:open_qrcode')
                w2ui['toolbar'].click('dashboard_sharing')   
            }
            else{
                subItem.text = 'Start Dashboard Sharing'
                w2ui['toolbar'].disable('dashboard_sharing:open')
                w2ui['toolbar'].disable('dashboard_sharing:open_qrcode')
            }    
        }
        */
        $('#toolbar').w2toolbar({
            name:'toolbar',
            style:'background-color:orange;color:white;',
            items:[
                { type: 'html', html:'<a id="go-home" href="index.html'+'">Home</a>'},                       
                { type: 'break'},
                { type: 'html', html:'<a id="go-user" href="user.html'+'">Presentations</a>'},                       
                { type: 'break'},
                { type: 'button',id: 'screens', caption: 'Screens'},
                { type: 'button',id: 'interactions', caption: 'Interactions'},
                { type: 'button',id: 'settings', caption: 'Settings'},
                { type: 'break'},
                /*
                { type: 'menu',id: 'remote_controller', caption: 'Remote Controller',
                    icon:'fas fa-diagnoses',
                    disabled:true,
                    tooltip:'Features for the speecher(you)',
                    items:[
                        {text:'Open Remote Controller', id:'open'},
                        {text:'Open Remote Controller\'s QRcode', id:'open_qrcode'},
                    ]},
                */
                { type: 'button', id:'user_guide',
                    icon:'fas fa-book',
                    text:'User Guide',
                    items:[
                        {text:'Keyboard Shortcuts', id:'keyboardshortcuts'},
                    ]},
                { type: 'spacer'},
                {type:'button',id:'test',caption:'Test'},
                { id:'remove_presentation', text:'Delete Presentation', icon:'w2ui-icon-cross'} 
            ],
            onClick:function(event){                
                var title = false              
                switch(event.target){//id
                    case 'screens':
                        $('#screens').w2popup()
                        break
                    case 'remove_presentation':
                        w2confirm({
                            msg:'Delete this presentation? can not undo.',
                            title:'Are you sure?',
                            btn_yes:{
                                class: 'w2ui-btn-red'
                            },
                            callBack:function(ans){
                                if (ans != 'Yes') return 
                                self.sbs_user.remove_presentation(self.p_id).done(function(){                               
                                    window.location.href = document.getElementById('go-home').getAttribute('href')
                                })
                            }
                        })
                        break
                    case 'interactions':
                        var form_options = {
                            name:'interactions',
                            style: 'border: 0px; background-color: transparent;',
                            url:'',
                            fields:[
                                {field:'ask_questions',type:'toggle'}
                            ]
                        }
                        if (!w2ui.interactions){
                            $('#interactions-form').w2form(form_options) 
                        }
                        var w = $('#page').width()
                        var h = $('#page').height()
                        $().w2popup('open', {
                            title   : 'Interactions',
                            body    : '<div id="interactions-form-popup" style="width: 100%; height: 100%;"></div>',
                            style   : 'padding: 15px 0px 0px 0px',
                            width   : w * 0.5,
                            height  : h * 0.9, 
                            showMax : true,
                            onToggle: function (event) {
                                $(w2ui.interactions.box).hide();
                                event.onComplete = function () {
                                    $(w2ui.interactions.box).show();
                                    w2ui.interactions.resize();
                                }
                            },
                            onOpen: function (event) {
                                event.onComplete = function () {
                                    // specifying an onOpen handler instead is equivalent to specifying an onBeforeOpen handler, which would make this code execute too early and hence not deliver.
                                    $('#interactions-form-popup').w2render('interactions');
                                }
                            }
                        });
                        
                        break
                    case 'settings':
                        var form_options = form_options = {
                            name:'settings',
                            url:'',
                            style: 'border: 0px; background-color: transparent;',
                            fields:[
                                {field:'ratio',type:'list',options:{
                                    selected:{id:'43',text:'4:3'},
                                    items:[
                                        {id:'43',text:'4:3'},
                                        {id:'169',text:'16:9'}
                                    ]}
                                },
                                {field:'free_navigation',type:'toggle'},
                                {field:'per_slide_drawing',type:'toggle'}
                            ]
                        }
                        if (!w2ui.settings){
                            $('#settings-form').w2form(form_options)
                        }
                        //render attachment-list
                        if (w2ui['references-list']) w2ui['references-list'].destroy()
                        
                        //delay to wait DOM be ready
                        _.delay(function(){
                            $('#settings-form-popup .references-list').w2grid({ 
                                name: 'references-list', 
                                header:'<span style="float:right">Edit</span>',
                                columns: [                
                                    { field: 'name', caption: 'Name', size: '50%' }
                                ],
                                show:{
                                    header:true,
                                    toolbar:false,
                                    columnHeaders:false,
                                    lineNumbers: true
                                },
                                records:[] //assign value here does not work (?)
                            });

                            //assign records
                            var records = [
                                {recid:1, name:'No item'}
                            ]
                            w2ui['references-list'].records = records
                            w2ui['references-list'].refresh()
                        },1000)

                        var w = $('#page').width()
                        var h = $('#page').height()
                        $().w2popup('open', {
                            title   : 'Settings',
                            body    : '<div id="settings-form-popup" style="width: 100%; height: 100%;"></div>',
                            style   : 'padding: 15px 0px 0px 0px',
                            width   : w * 0.5,
                            height  : h * 0.9, 
                            showMax : true,
                            onToggle: function (event) {
                                $(w2ui.settings.box).hide();
                                event.onComplete = function () {
                                    $(w2ui.settings.box).show();
                                    w2ui.settings.resize();
                                }
                            },
                            onOpen: function (event) {
                                event.onComplete = function () {
                                    // specifying an onOpen handler instead is equivalent to specifying an onBeforeOpen handler, which would make this code execute too early and hence not deliver.
                                    $('#settings-form-popup').w2render('settings');
                                }
                            }
                        });
                        
                        break

                    case 'test':
                        var url = 'https://www.googleapis.com/pagespeedonline/v4/runPagespeed?'
                        url += 'screenshot=true&strategy=desktop'
                        url += '&url=https://www.youtube.com/embed/1yUiZ9U-XH8'
                        $.ajax({
                            url:url,
                            dataType:'jsonp',
                            success:function(obj){
                                console.log(obj)
                            },
                            fail:function(err){
                                console.warn(err)
                            }
                        })
                        break
                    case 'test2':
                        /*
                        //https://developers.google.com/speed/docs/insights/v4/reference/pagespeedapi/runpagespeed
                        var url = 'http://www.google.com'
                        var url = 'https://www.youtube.com/embed/1yUiZ9U-XH8'
                        var url = 'https://www.youtube.com/watch?v=1yUiZ9U-XH8'
                        */
                        var url = 'https://www.googleapis.com/pagespeedonline/v4/runPagespeed?'
                        url += 'screenshot=1&strategy=desktop'
                        console.log('url=',url)
                        //break
                        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.content_for_thumbnail'
                        window.sdk.send_command(new Command(cmd,[url])).done(function(response){
                            if (response.retcode != 0){
                                console.log(response.stderr)
                                return
                            }
                            console.log(response.stdout)
                            /*
                            document.getElementById('page').style.display = 'none'
                            var div = document.createElement('div')
                            div.style.zIndex = '1025'
                            div.style.width = '100vw'
                            div.style.height = '80vw'                            
                            document.body.appendChild(div)
                            div.innerHTML = response.stdout
                            */
                        }).fail(function(err){
                            console.warn(err)                           
                        })
                        break
                }
                if (title){ //open sidebar of right
                    w2ui['layout_main'].show('right')
                    setTimeout(function(){
                        w2ui['layout_main'].el('right').parentNode.querySelector('.w2ui-panel-title').innerHTML = title+'<a class="close-title-btn" href="">Close</a>'
                        w2ui['layout_main'].el('right').parentNode.querySelector('.w2ui-panel-title .close-title-btn').onclick = function(evt){
                            evt.preventDefault()
                            w2ui['layout_main'].hide('right')
                        }
                    },0)
                }
                else{
                    w2ui['layout_main'].hide('right')
                }
            }    
        })
        // event listeners
        $('#screens-body .w2ui-toggle').on('change',function(evt){
            //console.log(evt.target.getAttribute('name'), evt.target.checked)
            switch(evt.target.getAttribute('name')){
                case 'speaker-screen-toggle':
                    if (evt.target.checked){
                        window.loading(true,'Start Speaker Screen')
                        self.speaker_screen(true).done(function(token){
                            window.loading(false)
                            self.p_state.acl_token.ss = token
                            $('#screens-body .ss .w2ui-btn').attr('disabled',null)
                        }).fail(function(err){
                            window.loading(false)
                            w2alert(err,'Failed to start speaker screen')
                        })            
                    }else{
                        window.loading(true,'Shutdown Speaker Screen')
                        self.speaker_screen(false).done(function(){
                            window.loading(false)
                            self.p_state.acl_token.ss = null
                            $('#screens-body .ss .w2ui-btn').attr('disabled',1)
                        }).fail(function(err){
                            window.loading(false)
                            w2alert(err,'Failed to speaker audience screen')
                        })            
                    }
                    break
                case 'audience-screen-toggle':
                    if (evt.target.checked){
                        window.loading(true,'Start Audience Screen')
                        self.audience_screen(true).done(function(token){
                            window.loading(false)
                            self.p_state.acl_token.as = token
                            $('#screens-body .as .w2ui-btn').attr('disabled',null)
                        }).fail(function(err){
                            window.loading(false)
                            w2alert(err,'Failed to start audience screen')
                        })            
                    }else{
                        window.loading(true,'Shutdown Audience Screen')
                        self.audience_screen(false).done(function(){
                            window.loading(false)
                            self.p_state.acl_token.as = null
                            $('#screens-body .as .w2ui-btn').attr('disabled',1)
                        }).fail(function(err){
                            window.loading(false)
                            w2alert(err,'Failed to shutdown audience screen')
                        })            
                    }
                    break
                case 'shared-dashboard-toggle':
                    if (evt.target.checked){
                        //currently, it is disabled, lets do start
                        window.loading(true,'Start Dashboard Sharing')
                        self.dashboard_sharing(true).done(function(token){
                            window.loading(false)
                            self.p_state.acl_token.ds = token
                            $('#screens-body .ds .w2ui-btn').attr('disabled',null)
                        }).fail(function(err){
                            window.loading(false)
                            w2alert(err,'Failed to start dashboard sharing')
                        })
                    }else{
                        window.loading(true,'Shutdown Dashboard Sharing')
                        self.dashboard_sharing(false).done(function(){
                            window.loading(false)
                            self.p_state.acl_token.ds = null
                            $('#screens-body .ds .w2ui-btn').attr('disabled',1)
                        }).fail(function(err){
                            window.loading(false)
                            w2alert(err, 'Failed to shutdown dashboard sharing')
                        })            
                    }
                    break

            }
        })
        self.presentation.add_event_listener('PRESENTATION-SCREEN-OPEN',function(){
            open(get_url_from_hash(self.p_state.hostname+',screen,'+'2'+self.p_state.acl_token.ss),'speaker_screen')    
        })
        self.presentation.add_event_listener('PRESENTATION-SCREEN-QRCODE',function(){
            open('qrcode.html#'+get_url_from_hash(self.p_state.hostname+',screen,'+'2'+self.p_state.acl_token.ss,true)+encodeURIComponent('\tSpeaker Screen'),'speaker_screen_qrcode')
        })
        self.presentation.add_event_listener('REMOTE-CONTROL-OPEN',function(){
            open(get_url_from_hash(self.p_state.hostname+',remotecontroller,'+self.p_state.acl_token.ss),'remote_controller')
        })
        self.presentation.add_event_listener('REMOTE-CONTROL-QRCODE',function(){
            open('qrcode.html#'+get_url_from_hash(self.p_state.hostname+',remotecontroller,'+self.p_state.acl_token.ss,true)+encodeURIComponent('\tRemote Controller'),'remote_controller_qrcode')
        })
        self.presentation.add_event_listener('AUDIENCE-SCREEN-OPEN',function(){
            open(get_url_from_hash(self.p_state.hostname+',screen,'+'3'+self.p_state.acl_token.as),'audience_screen')    
        })
        self.presentation.add_event_listener('AUDIENCE-SCREEN-QRCODE',function(){
            open('qrcode.html#'+get_url_from_hash(self.p_state.hostname+',screen,'+'3'+self.p_state.acl_token.as,true)+encodeURIComponent('\tAudience Screen'),'audience_screen_qrcode')
        })
        self.presentation.add_event_listener('SHARED-DASHBOARD-OPEN',function(){
            open(get_url_from_hash(self.p_state.hostname+',dashboard,4!'+self.p_state.acl_token.ds),'dashboard_sharing')
        })
        self.presentation.add_event_listener('SHARED-DASHBOARD-QRCODE',function(){
            open('qrcode.html#'+get_url_from_hash(self.p_state.hostname+',dashboard,4!'+self.p_state.acl_token.ss,true)+encodeURIComponent('\tShared Dashboard'),'dashboard_sharing_qrcode')
        })


        // enable delete slides
        self.remove_slides_by_indexes = function(indexes){
            var slide_ids = []
            //user might selecting thumbnails with random order,
            //so we need to sort again
            indexes.sort(function(a,b){return a>b ? 1 : (a<b ? -1 : 0)})
            //console.log('removing slide of ',indexes)
            var thread = self.presentation.threads[w2ui['thread-tabs'].active]
            _.each(indexes,function(idx){
                slide_ids.push(thread.slides[idx].id)
            })
            w2confirm({
                msg:'Remove selected '+indexes.length+' slides?',
                title:'Are you sure',
                btn_yes:{
                    class: 'w2ui-btn-red'
                },
                callBack:function(answer){
                    if (answer == 'No') return
                    var t_id = thread.id
                    window.loading(true,'removing slides',true)
                    self.sbs_user.remove_slides_of_id(self.p_id, t_id, slide_ids,self.flag_of_token).done(function(){
                        window.loading(false)
                        /*
                        indexes.reverse()
                        miso
                        for(var i=0;i<indexes.length;i++){
                            thread.slides.splice(indexes[i],1)
                        }
                        */
                        //refresh this thread's slide thumbnails
                        //w2ui['thread-tabs'].click(thread.id)
                    }).fail(function(response){
                        w2alert(response.stderr)
                        window.loading(false)
                        console.log(response)
                    })
                }
            })
        }
      
        //adjust #page's height
        var page_height = $('#page').height()-$('#toolbar')[0].getBoundingClientRect().height-1//toolbar's height
        $('#page').height(page_height)
        var page_width = $('#page').width()
        var tab_content_width = 235
        var tabs_bar_width = 30 //vertically width (height in horizental)
        $('#page').w2layout({
            name:'layout',
            panels:[
                {   type:'main',
                    size: page_width - (tab_content_width+tabs_bar_width),
                    resizable: true,
                    style:'background-color:white'
                },
                {   type:'left',
                    size:  (tab_content_width+tabs_bar_width) ,
                    resizable:true,
                    style:'margin-left:0px;background-color:white',
                    content:'<div id="thread-tabs-box"></div>',
                    style:'background-color:#f0f0f0',
                    toolbar:{
                        tooltip:'right',
                        items:[
                            {type:'button',id:'bigger',text:'Bigger',icon:'',tooltip:'Enlarge slide thumbnails'},
                            {type:'button',id:'smaller',text:'Smaller',icon:'', disabled:self.settings.scale==1},
                            {type:'break'},
                            {type:'button',id:'remove_slides',text:'Del',icon:'fa fas-delete',tooltip:'Delete selected slides'}
                        ],
                        style:'background-color:transparent',
                        onClick:function(event){
                            //console.log(event)
                            switch(event.target){
                                case 'bigger':
                                    self.settings.scale += 0.2
                                    _.each($('.thread-slide'),function(ele,i){
                                        ele.style.marginRight  = Math.round(200 * (self.settings.scale-1) + 2) +'px'
                                        ele.style.marginBottom = Math.round(150 * (self.settings.scale-1) +20) +'px'
                                        ele.style.transform = 'scale('+self.settings.scale+')'
                                    })
                                    w2ui['layout'].get('left').toolbar.enable('smaller')
                                    break
                                case 'smaller':
                                    self.settings.scale = Math.max(1,self.settings.scale - 0.1)
                                    _.each($('.thread-slide'),function(ele,i){
                                        ele.style.marginRight  = Math.round(200 * (self.settings.scale-1) + 2) +'px'
                                        ele.style.marginBottom = Math.round(150 * (self.settings.scale-1) +20) +'px'
                                        ele.style.transform = 'scale('+self.settings.scale+')'
                                    })
                                    if (self.settings.scale==1) w2ui['layout'].get('left').toolbar.disable('smaller')
                                    break
                                case 'remove_slides':
                                    //remove selected slide                                    
                                    var indexes = []
                                    $('.thread-slide .slide-thumbnail.selected').each(function(idx, ele){                    
                                        //ele.className = ele.className.replace(' selected','')
                                        var idx = parseInt(ele.getAttribute('slideidx'))
                                        if (idx==-1) return //"New" slide
                                        indexes.push(idx)
                                    })
                                    if (indexes.length==0) return
                                    self.remove_slides_by_indexes(indexes)
                                    break
                                    /*
                                    //when this event is fired, event.item.checked is yet updated
                                    //so we got to "not" it
                                    var visible = !event.item.checked
                                    var t_id = w2ui['thread-tabs'].active
                                    var s_idx = parseInt(self._last_selected_thumbnail.getAttribute('slideidx'))                                    
                                    self.presentation.send_to_bus('misc-sync',['overlay:visible',t_id,s_idx,visible])
                                    */                                
                            }
                        }
                    } //end toolbar                
                },
                //{type:'right', size:'50%', resizable: true}
            ],
            onResize:function(evt){
                if (evt.panel=='left'){


                    //resize iframe's dimension(screen.html)
                    var rect = w2ui['layout'].el('main').getBoundingClientRect()
                    console.log('resize iframe to ',rect)                    
                    $('#embedded-screen').width(rect.width - 2)
                    $('#embedded-screen').height(rect.height - 2)

                    if (evt.init) {
                        //initial call, do nothing
                    }
                    else{
                        //resize trigger by user adjustment

                        setTimeout(function(){
                            self.presentation_screen.on_resize()
                        },10)

                        //resize thread_tab_content_div
                        //by doing so to let vertical scrollbar be visible to user
                        document.getElementById('thread-tab-content').style.width = (w2ui['layout'].get('left').size - tabs_bar_width)+'px'
                    }
                }
            }
        })
        var layout_main = $().w2layout({
            name:'layout_main',
            panels:[
                {type:'main', size:'50%', resizable: true,
                    content:'<div id="embedded-screen-box"><iframe frameborder="0" id="embedded-screen"></iframe></div>'
                },
                {type:'preview', size:'50%', title:'', resizable: true},
            ]
        })
        w2ui['layout'].content('main',layout_main)
        w2ui['layout_main'].hide('preview')

        // de-select all selected with escape
        this.keyboard_shortcut.handler['ESCAPE'] =  function(){
            _.each($('.thread-slide .selected'),function(ele){
                ele.className = ele.className.replace(/\sselected/,'')
            })
        }
        this.keyboard_shortcut.handler['T'] =  function(){
            self.toggle_toolbar()
        }        
        // delete   
        this.keyboard_shortcut.add_handler_of_regex(/(DELETE|BACKSPACE)/, _.throttle(function(keyname){
            w2ui['layout'].get('left').toolbar.click('remove_slides')
        }))
        // navigate to prev slide
        this.keyboard_shortcut.add_handler_of_regex(/(ARROWUP|ARROWLEFT)/, _.throttle(function(keyname){
            var idx = parseInt(self._last_selected_thumbnail.getAttribute('slideidx'))
            if (idx == 0) return
            var slide_thumbnail = document.querySelector('#thread-tab-content').querySelector('.slide-thumbnail[slideidx="'+(idx-1)+'"]')
            if (slide_thumbnail.getBoundingClientRect().top < 0){
                slide_thumbnail.scrollIntoView()
            }
            $(slide_thumbnail).mouseup()
        }))
        // navigate to next slide
        this.keyboard_shortcut.add_handler_of_regex(/(ARROWDOWN|ARROWRIGHT)/, _.throttle(function(keyname){
            var idx = parseInt(self._last_selected_thumbnail.getAttribute('slideidx'))
            if (idx >= self.presentation_screen.presentation.current_thread.slides.length - 1) return
            var slide_thumbnail = document.querySelector('#thread-tab-content').querySelector('.slide-thumbnail[slideidx="'+(idx+1)+'"]')
            if (slide_thumbnail.getBoundingClientRect().bottom > w2ui['layout'].get('left').height){
                slide_thumbnail.scrollIntoView()
            }
            $(slide_thumbnail).mouseup()
        }))
        // navigate to next thread
        this.keyboard_shortcut.add_handler_of_regex(/^TAB$/, _.throttle(function(keyname){
            var tab_idx = -1
            _.each(w2ui['thread-tabs'].tabs,function(tab,idx){
                if (tab.id == w2ui['thread-tabs'].active){
                    tab_idx = idx
                }
            })
            var next_idx = tab_idx==0 ? w2ui['thread-tabs'].tabs.length-1 : tab_idx - 1
            w2ui['thread-tabs'].click(w2ui['thread-tabs'].tabs[next_idx].id)
        }))
        this.keyboard_shortcut.add_handler_of_regex(/SHIFT-TAB/, _.throttle(function(keyname){
            var tab_idx = -1
            _.each(w2ui['thread-tabs'].tabs,function(tab,idx){
                if (tab.id == w2ui['thread-tabs'].active){
                    tab_idx = idx
                }
            })
            var next_idx = (tab_idx >= w2ui['thread-tabs'].tabs.length-1) ? 0 : tab_idx + 1
            w2ui['thread-tabs'].click(w2ui['thread-tabs'].tabs[next_idx].id)
        }))        

        //wait a while before continue rendering 
        setTimeout(function(){
            self.sbs_user.init()
        },1000)
    },
    connected_init:function(){
        //threads management in "preview"
        var self = this
        var tabs = []

        // set inital state of toggles
            if (self.p_state.acl_token.ss){
                $('#screens-body .ss .w2ui-toggle').attr('checked',1)
                $('#screens-body .ss .w2ui-btn').attr('disabled',null)
            }
            if (self.p_state.acl_token.as){
                $('#screens-body .as .w2ui-toggle').attr('checked',1)
                $('#screens-body .as .w2ui-btn').attr('disabled',null)
            }
            if (self.p_state.acl_token.ds){
                $('#screens-body .ds .w2ui-toggle').attr('checked',1)
                $('#screens-body .ds .w2ui-btn').attr('disabled',null)
            }
        
        // render preview panel (threads start)
            var t_ids = _.keys(this.p_state.threads)
            t_ids.sort(function(a,b){return a>b ? 1 : (a<b ? -1 : 0)})
            t_ids.reverse()

            //tabs.push({ id: 'settings', caption: 'Settings', tooltip:'Settings of the presentation'})

            //tabs.push({ id: 'interaction', caption: 'Interaction', tooltip:'Interaction features'})

            if (t_ids.length < this.p_state.max_number_of_thread){
                tabs.push({ id: 'new', caption: 'New', tooltip:'Add new thread by drop files'})
            } 

            _.each(t_ids,function(t_id,index){
                tabs.push({id:t_id, caption:'<span class="v-tab-caption">'+t_id+'</span>', closable:false, t_state:self.p_state.threads[t_id]})
            })
            /* for testing many many tabs
            _.each(t_ids,function(t_id,index){
                tabs.push({id:t_id+'.1', caption:'<span class="v-tab-caption">'+t_id+'</span>', closable:false, t_state:self.p_state.threads[t_id]})
            })
            _.each(t_ids,function(t_id,index){
                tabs.push({id:t_id+'.2', caption:'<span class="v-tab-caption">'+t_id+'</span>', closable:false, t_state:self.p_state.threads[t_id]})
            })
            _.each(t_ids,function(t_id,index){
                tabs.push({id:t_id+'.3', caption:'<span class="v-tab-caption">'+t_id+'</span>', closable:false, t_state:self.p_state.threads[t_id]})
            })
            */
            $().w2tabs({
                name: 'thread-tabs',
                active:'', //empty space to hint page is just loaded
                tabs: tabs,
                flow: 'down',
                onClick: function (event) {                    
                    if (event.tab.id=='new'){
                        self.render_thread_tab(event.tab)
                        $('#trashcan-box').hide()
                    }
                    /*
                    else if (event.tab.id=='settings'){

                        if (w2ui['settings']) w2ui['settings'].destroy()
                        thread_tab_content_div.innerHTML =  $('#settings-form').html()

                        var form_options = {
                            name:'settings',
                            url:'',
                            header:'Presentation Settings',
                            fields:[
                                {field:'ratio',type:'list',options:{
                                    selected:{id:'43',text:'4:3'},
                                    items:[
                                        {id:'43',text:'4:3'},
                                        {id:'169',text:'16:9'}
                                    ]}
                                },
                                {field:'free_navigation',type:'toggle'},
                                {field:'per_slide_drawing',type:'toggle'}
                            ]
                        }
                       
                        var setting_form = $(thread_tab_content_div).w2form(form_options)
                        //render attachment-list
                        if (w2ui['references-list']) w2ui['references-list'].destroy()
                        _.defer(function(){

                            $(thread_tab_content_div).find('.references-list').w2grid({ 
                                name: 'references-list', 
                                header:'<span style="float:right">Edit</span>',
                                columns: [                
                                    { field: 'name', caption: 'Name', size: '50%' }
                                ],
                                show:{
                                    header:true,
                                    toolbar:false,
                                    columnHeaders:false,
                                    lineNumbers: true
                                },
                                records:[] //assign value here does not work (?)
                            });

                            //assign records
                            var records = [
                                {recid:1, name:'No item'}
                            ]
                            w2ui['references-list'].records = records
                            w2ui['references-list'].refresh()
                        })
                        
                        //set init values
                        //console.log(setting_form.get('free_navigation').el)
                    }
                    
                    else if (event.tab.id=='interaction'){
                        if (w2ui['interaction']) w2ui['interaction'].destroy()
                        thread_tab_content_div.innerHTML =  $('#interaction-form').html()
                        var form_options = {
                            name:'interaction',
                            url:'',
                            header:'Interaction Features',
                            fields:[
                                {field:'ask_questions',type:'toggle'}
                            ]
                        }
                       
                        var setting_form = $(thread_tab_content_div).w2form(form_options)                        
                    }
                    */
                    else {
                        $('#trashcan-box').show()
                        self.render_thread_tab(event.tab)
                    }
                },
                /*
                onClose:function(event){
                    event.preventDefault()
                    var tab = event.object //this is a workaround for in-consistance of w2ui                    
                    w2confirm({
                        msg:'Delete this thread?',
                        title:'Are you sure',
                        btn_yes:{
                            class: 'w2ui-btn-red'
                        },
                        callBack:function(answer){
                            if (answer != 'Yes') return
                            loading(true,'Deleting thread')
                            self.sbs_user.remove_thread(self.p_id,tab.t_state.id,self.flag_of_token).done(function(){
                                loading(false)
                                delete self.p_state.threads[tab.t_state.id]
                                //console.log('after deleted, current threads', self.p_state.threads)
                                //new focus to previous tab or next tab
                                if ( w2ui['thread-tabs'].active == tab.id) {
                                    var index = w2ui['thread-tabs'].tabs.indexOf(tab)
                                    var new_index = (index==0) ? 1 : index-1
                                    var new_id = w2ui['thread-tabs'].tabs[new_index].id
                                    //console.log('new_id',new_id)
                                    w2ui['thread-tabs'].click(new_id)
                                }
                                
                                //remove this tab
                                w2ui['thread-tabs'].remove(tab.id)
                                w2ui['thread-tabs'].update_position()

                            }).fail(function(err){
                                w2alert(err.message)
                                loading(false)
                            })
                        }
                    })
                }
                */
            });
            //w2ui['layout'].content('preview',w2ui['thread-tabs'])
            //w2ui['layout'].content('left',w2ui['thread-tabs'])
            w2ui['thread-tabs'].render($('#thread-tabs-box'))
            
            //create a div below tabs bar to render toolbar bar
            //var thread_tab_toolbar_div = document.createElement('div')
            //thread_tab_toolbar_div.setAttribute('id','thread-tab-toolbar')


            //create a div below tabs bar to render tab's content
            var thread_tab_content_div = document.createElement('div')
            thread_tab_content_div.setAttribute('id','thread-tab-content')
            var tabs_bar_width = 30
            thread_tab_content_div.style.width = (w2ui['layout'].get('left').size - tabs_bar_width)+'px'
            this.thread_tab_content_div = thread_tab_content_div
            var current_thread_tab = null //tab object now is on focus

            // enable #thread-tab-content once only
            self.dnd_enabler = new DnDEnabler(self,'dragover')
            //self.dnd_enabler.enable('#trashcan-box')
        
            thread_tab_content_div.addEventListener('dragenter',function(){
                //cancel current selected .slide-drop-sensor and .slide-thumbnail elements
                _.each($('.thread-slide .selected'),function(ele){
                    ele.className = ele.className.replace(/\sselected/,'')
                })
            })
           

            this.render_thread_tab = function(tab){
                //render tab content except and "New" tab  
                current_thread_tab = tab
                var t_state = tab.t_state

                var html = []
                html.push('<div class="thread-slides">')

                var _drop_sensor = _.template('<div class="slide-drop-sensor" slideidx="<%= idx %>" title="click and paste to insert, or drag and drop to insert">&nbsp;</div>')                

                if (t_state){
                    //a tab of thread
                    var _slide = _.template('<div class="thread-slide<%= cls %>" title="<%= title %>" style="<%= style %>">')
                    var _thumbnail_image = _.template('<div class="slide-thumbnail" slideidx="<%= idx %>" draggable="true" ondragstart="event.dataTransfer.setData(\'slide/index\',\'<%= idx %>\')" style="background-image:url(\'../@/sidebyside/thumbnail?f=<%= f %>&p=<%= p %>&t=<%= t %>&s=<%= s %>\')"></div>')
                    var _thumbnail_video = _.template('<div class="slide-thumbnail" slideidx="<%= idx %>" draggable="true" ondragstart="event.dataTransfer.setData(\'slide/index\',\'<%= idx %>\')" style="background-image:url(\'thumbnail_video.jpg\')"></div>')
                    var _thumbnail_url = _.template('<div class="slide-thumbnail" slideidx="<%= idx %>" draggable="true" ondragstart="event.dataTransfer.setData(\'slide/index\',\'<%= idx %>\')" style="background-image:url(\'thumbnail_url.jpg\')"></div>')
                    var _thumbnail_op = _.template('<div class="slide-thumbnail" slideidx="<%= idx %>" draggable="true" ondragstart="event.dataTransfer.setData(\'slide/index\',\'<%= idx %>\')" style="background-image:url(\'thumbnail_op.jpg\')"></div>')
                    var _slide_label = _.template('<span class="slide-label"><%= no %></span>')
                    var _style = '';
                    if (self.settings.scale > 1){
                        var mr =  Math.round(200 * (self.settings.scale-1) + 2) +'px'
                        var mb =  Math.round(150 * (self.settings.scale-1) +20) +'px'
                        var tf =  'scale('+self.settings.scale+')'
                        _style = 'margin-right:'+mr+';margin-bottom:'+mb+';transform:'+tf
                    }
                    //add "screen-focus" class to slide
                    var screen_focus_slideidx = -1
                    if (t_state.id == self.presentation.current_thread.id){
                        screen_focus_slideidx = self.presentation.current_thread.slides.indexOf(self.presentation.current_slide)                    
                    }
                    
                    /* Disabled for simplicity, maybe thread needn't a name
                    html.push('<div class="thread-metadata">')
                    html.push('<span class="thread-name">'+t_state['name']+'</span>')
                    html.push('</div>')//thread-metadata
                    */
                    _.each(t_state.slides,function(s_state,idx){
                        html.push(_slide({cls:(idx==screen_focus_slideidx ? ' screen-focus' : ''),title:s_state.id, style:_style}))
                        html.push(_drop_sensor({idx:idx}))
                        html.push(_slide_label({no:idx+1}))                        
                        if (s_state.resource.type == 'IMG'){
                            html.push(_thumbnail_image({p:self.p_id,f:self.flag_of_token,t:t_state.id,s:s_state.id,idx:idx}))
                        }
                        else if (s_state.resource.type == 'VIDEO'){
                            html.push(_thumbnail_video({p:self.p_id,f:self.flag_of_token,t:t_state.id,s:s_state.id,idx:idx}))
                        }
                        else if (s_state.resource.type == 'URL'){
                            html.push(_thumbnail_url({p:self.p_id,f:self.flag_of_token,t:t_state.id,s:s_state.id,idx:idx}))
                        }
                        else if (s_state.resource.type == 'OP'){
                            html.push(_thumbnail_op({p:self.p_id,f:self.flag_of_token,t:t_state.id,s:s_state.id,idx:idx}))
                        }                        
                        html.push('</div>') //close .thread-slide
                    })
                
                } //end of if (t_state)
                
                //add "new-slide" at the end
                // .droparea will show a + in background
                html.push('<div class="thread-slide  droparea" title="Add new slide">')
                html.push(_drop_sensor({idx:-1}))
                html.push('<div class="slide-thumbnail" slideidx="-1">')
                //html.push('<p style="width:100%;text-align:center;margin:30% auto;">Drop files here or click-then-paste to append slides.</p>')
                html.push('</div></div>') 

                //add information about what types of slide is accepted
                //its content is in "supported-slide-type"
                if (!t_state){
                    html.push(document.getElementById('supported-slide-type').innerHTML)
                }

                html.push('</ul>')//close <thread-slides

                thread_tab_content_div.innerHTML = html.join('')

                //click on a slide thumbnail
                //listen on mouseup(not click), because user might click-to-selected then drag a slide-thumbnail
                //if we listen on click, the second-click of dragging would become to unselect the slide-thumbnail                
                self._last_selected_thumbnail = null                    
                $('.thread-slide .slide-thumbnail').mouseup(_.throttle(function(evt){
                    //prehibit #thread_tab_content_div to receive click event
                    evt.stopPropagation()

                    if (self._last_selected_thumbnail == evt.currentTarget) return 

                    //cancel current selected .slide-drop-sensor elements
                    _.each($('.thread-slide .slide-drop-sensor.selected'),function(ele){
                        ele.className = ele.className.replace(/\sselected/,'')
                    })

                    var s_idx = parseInt(evt.currentTarget.getAttribute('slideidx'))
                    //unselect already selected items if click on "new" or without matakey is down
                    if (s_idx==-1 || (!(evt.metaKey || evt.shiftKey))){
                        // de-select others if no meta-key is presessed
                        _.each($('.thread-slide .slide-thumbnail.selected'),function(ele){
                            ele.className = ele.className.replace(/\sselected/,'')
                        })
                    }

                    var t_id = w2ui['thread-tabs'].active
                    
                    if (s_idx == -1) {
                        $(evt.currentTarget).addClass('selected')
                        self._last_selected_thumbnail = null
                        if (t_state){
                            //"New" slide at the end of some thread
                            self.presentation_screen.presentation.set_thread_and_slide(t_id,null)
                        }
                        else{
                            //New slide at a new thread (not been saved)

                        }
                    }
                    else{
                        //set to embedded presentation screen                           
                        var s_id = self.presentation.threads[t_id].slides[s_idx].id
                        self.presentation_screen.presentation.set_thread_and_slide(t_id,s_id)

                        //Do multiple selection together with shift-key or Meta-key 
                        if (evt.shiftKey && self._last_selected_thumbnail){
                            var last_idx = parseInt(self._last_selected_thumbnail.getAttribute('slideidx'))
                            var idxes = [s_idx,last_idx]
                            idxes.sort(function(a,b){return a>b ? 1 : (a<b ? -1 : 0)})
                            var start_slideidx = idxes[0]
                            var end_slideidx = idxes[1]
                            for (var i=start_slideidx;i<=end_slideidx;i++){
                                var ele = $('.slide-thumbnail[slideidx="'+i+'"]')[0]
                                $(ele).addClass('selected')//.className = ele.className + ' selected'
                            }
                        }
                        else{
                            $(evt.currentTarget).addClass('selected')
                        }
                            
                        self._last_selected_thumbnail = evt.currentTarget

                    }                        
                }))

                // _dragging_thumbnails is a workaround for the problem:
                // twhen dragging starts, someone de-selected slide-thumbnails
                self._dragging_thumbnails = null
                $('.thread-slide .slide-thumbnail').on('dragstart',function(evt){
                    evt.currentTarget.style.opacity=0.5
                    self._dragging_thumbnails = [evt.currentTarget]
                    _.each($('.thread-slide .slide-thumbnail.selected'),function(ele){
                        if (ele == evt.currentTarget) return
                        ele.style.opacity=0.5
                        self._dragging_thumbnails.push(ele)
                    })                        
                })

                $('.thread-slide .slide-thumbnail').on('dragend',function(evt){
                    _.each(self._dragging_thumbnails,function(ele){
                        ele.style.opacity=1
                    })
                    dragging_thumbnails = null
                })

                //(obsoleted)
                //make height of div.thread-slides to expand to the bottom
                //var rect = $('#thread-tab-content')[0].getBoundingClientRect()
                //$('div.thread-slides').height(rect.height - $('.thread-metadata').height()-40)

                //adjuest thumbnail size by ratio
                var ratio = self.p_state.presentation_layout.ratio
                var width = 200;
                var height = (width/ratio[0] * ratio[1])
                $('.slide-thumbnail').each(function(idx,ele){
                    ele.style.height = height + 'px'
                })
                    
                var slide_height = $('.thread-slide').height()
                $('.slide-drop-sensor').each(function(idx,ele){
                    ele.style.height = slide_height + 'px'
                })
                    
                $('.slide-drop-sensor').mouseup(function(evt){
                    //prehibit parent #thread_tab_content_div to receive click event
                    evt.stopPropagation()
                    if (evt.currentTarget.className.indexOf('selected')==-1){
                        //cancel current selected .slide-drop-sensor and .slide-thumbnail elements
                        _.each($('.thread-slide .selected'),function(ele){
                            ele.className = ele.className.replace(/\sselected/,'')
                        })
                        //mark the selected one                            
                        evt.currentTarget.className = evt.currentTarget.className + ' selected'

                        self._last_selected_thumbnail = evt.currentTarget

                    }
                    else{
                        evt.currentTarget.className = evt.currentTarget.className.replace(/\sselected/,'')

                        self._last_selected_thumbnail = null

                    }
                })

                //self.dnd_enabler.enable_paste('.thread-slide .slide-drop-sensor, .thread-slide .slide-thumbnail')
                self.dnd_enabler.enable_paste('body')
                self.dnd_enabler.enable('.thread-slide')
            
            
                //select a default slide after shows slide thumbnails
                var set_selected_slide = function(){
                    if (self.presentation_screen){
                        // get from the isolated presentation of embedded screen.
                        // because it is the slide been selected last time by current dashboard user.
                        // it defaults to focus slide of each thread at beginning after the dashboard is loaded.
                        var ss_id = self.presentation_screen.presentation.thread_settings[t_state.id].slide_id
                        var selected_slide =  t_state.get_slide_of_id(ss_id)
                        if (!selected_slide){
                            // in case of selected slides are removed, 
                            // the self.presentation_screen.presentation.thread_settings might not been updated
                            // when this function has been called. so we failover to self.presentation.thread_settings
                            ss_id = self.presentation.thread_settings[t_state.id].slide_id
                            selected_slide =  t_state.get_slide_of_id(ss_id)                                
                        }
                        // ss is still null if this thread has no any slide
                        var idx = selected_slide ? selected_slide.idx : '-1'
                        setTimeout(function(){
                            var slide_thumbnail = document.querySelector('#thread-tab-content').querySelector('.slide-thumbnail[slideidx="'+idx+'"]')
                            if (slide_thumbnail.getBoundingClientRect().bottom > w2ui['layout'].get('left').height){
                                slide_thumbnail.scrollIntoView()
                            }
                            $(slide_thumbnail).mouseup()
                        },100)    
                    }
                    else{                            
                        setTimeout(function(){set_selected_slide(),500})
                    }
                }

                // set default selected slide of thread except for "new" tab
                if (t_state) set_selected_slide()
                
            } //end of render_thread_tab()
            
            //wait a while to var DOM to update for w2ui-tabs
            setTimeout(function(){
                w2ui['layout'].el('left').appendChild(thread_tab_content_div)
                //disable the x-scroll bar (because vertial tabs, panel content shifts right 30px)
                thread_tab_content_div.parentNode.style.overflowX = 'hidden'

                //make the thread-tabs be virtical
                //visible_height = height of thread_tabs_content on viewport
                var visible_height = w2ui['layout'].get('left').height - w2ui['layout'].get('left').toolbar.box.getBoundingClientRect().bottom
                var max_width = visible_height - 50
                
                // update ths vertical tabs bar's width (aka height) and top 
                w2ui['thread-tabs'].update_position = function(){
                    var top = Math.min($(document.querySelector('#thread-tabs-box .w2ui-scroll-wrapper > table')).width(), max_width)
                    document.querySelector('#thread-tabs-box').style.width = (top+15)+'px'
                    document.querySelector('#thread-tabs-box').style.top = (top+15)+'px'    
                }
                w2ui['thread-tabs'].update_position()

                //deselect all if clicked on thread_tab_content_div
                thread_tab_content_div.onmouseup = function(){
                    _.each($('.thread-slide .selected'),function(ele){                    
                        ele.className = ele.className.replace(' selected','')
                    })
                }

                // do initial rendering of threads-Tabs
                if (_.size(self.presentation.threads) == 0){
                    w2ui['thread-tabs'].click('new')
                }
                else{
                    // this is called after 10ms, to wait for
                    // self.presentation.current_slide to be availabe
                    // it is not available when this function is called at initial stage.
                    setTimeout(function(){
                        //scroll the tabs bar to top
                        w2ui['thread-tabs'].scroll('right')
                      
                        // render the thread of current focus screen miso
                        //w2ui['thread-tabs'].click(self.presentation.current_thread.id)
                    },100)
                }
            },10)
            
            $('#trashcan-box').mouseup(_.throttle(function(evt){
                evt.stopPropagation()
                var t_id = w2ui['thread-tabs'].active
                w2confirm({
                    msg:'Delete the "'+ t_id+'" thread?',
                    title:'Are you sure',
                    btn_yes:{
                        class: 'w2ui-btn-red'
                    },
                    callBack:function(answer){
                        if (answer != 'Yes') return
                        loading(true,'Deleting thread')
                        self.sbs_user.remove_thread(self.p_id,t_id,self.flag_of_token).done(function(){
                            loading(false)
                            // do nothing here, because the GUI component got updated by bus-sync
                        }).fail(function(err){
                            w2alert(err.message)
                            loading(false)
                        })
                    }
                })
            }))
    },
    call_when_ready:function(callback){
        var self = this
        if (this._is_ready){
            callback(this.presentation, this.sbs_user)
            // render the thread of current focus screen.
            // here is the right timing to ask for initial rendering of both
            // dashboard and embedded screen. Becasue the embedded screen might 
            // reload several times on resize event. everytime it calls this function.
            if (w2ui['thread-tabs'].active) w2ui['thread-tabs'].click(w2ui['thread-tabs'].active) //iframe reload
            else w2ui['thread-tabs'].click(self.presentation.current_thread.id) //first call
        } 
        else{
            setTimeout(function(){self.call_when_ready(callback)},100)
        }
    },
    /* implementations of  sbs_user's delegation*/
    on_connected:function(is_reconnection){
        //called by self.sbs_user
        if (is_reconnection){
            /*
             * Currently, this code block doen't work well.
             * Should be re-implement if necessary.
            **/
            return    
        }

        var self = this
        var sdk = window.sdk //set by self.sbs_user.init()
        this.presentation.init(sdk).done(function(){
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
            
            //alias
            self.p_state = self.presentation
            
            //for shared dashboard to do presentation management
            self.rest_id = self.presentation.rest_id

            //assign src to embedded_screen_iframe
            
            var embedded_screen_iframe = document.getElementById('embedded-screen')
            var src = 'screen.html#'+ self.flag_of_token +self.p_id
            embedded_screen_iframe.setAttribute('src',src)
            
            //adjust size of embedded iframe
            w2ui['layout'].trigger({ phase: 'before', panel:'left',target: 'layout', type: 'resize', init:true})
            
            self.connected_init()

            //allow embedded screen to initiailize itself.
            self._is_ready = true

        }).fail(function(message){
            w2alert(message)
        })
    },
    on_disconnected:function(){
        
        w2utils.lock(document.body,'reconnecting',true)
        
        //return true to ask sbs_user to reconnect
        //return true 

        //currently, we can not handle reconnection well, so ask for reload
        //delay to tell normal forward from abnormal disconnection
        _.delay(function(){
            w2confirm({
                msg:'Reload the dashboard?',
                title:'Disconnected from server',
                callBack:function(ans){
                    if (ans != 'Yes') return 
                    window.location.reload()
                }
            })    
        },3000)
    },
    //implement operation on dashboard
    on_setting_changed:function(name){
        //name:changed setting name
        switch(name){
            case 'hook':

                break
        }
    },
    //implementation of DndEnabler delegation
    on_paste:function(data,evt){
        //if none slide-thumbnail is selected, paste to last
        var dst_index = -1 //-1 means  to add at end
        if ($('.slide-thumbnail.selected, .slide-drop-sensor.selected').length){
            //if this._last_selected_thumbnail is null, user pastes on "new" slide
            dst_index = this._last_selected_thumbnail ? this._last_selected_thumbnail.getAttribute('slideidx') : -1
        }
        this._handle_dnd_paste(data,dst_index)
    },
    on_paste_string:function(text,evt){
        //if none slide-thumbnail is selected, paste to last
        var dst_index = -1 //-1 means  to add at end
        if ($('.slide-thumbnail.selected, .slide-drop-sensor.selected').length){
            //if this._last_selected_thumbnail is null, user pastes on "new" slide
            dst_index = this._last_selected_thumbnail ? this._last_selected_thumbnail.getAttribute('slideidx') : -1
        }
        this._handle_dnd_paste(text,dst_index)
    },
    on_dnd_string:function(text,evt){
        this.on_paste_string(text,evt)
    },
    on_dnd:function(data,evt){
        var dst_index
        if (evt.currentTarget.className.indexOf('thread-slide')>=0){
            dst_index = evt.currentTarget.querySelector('.slide-thumbnail').getAttribute('slideidx')
        }
        else{
            dst_index = evt.currentTarget.getAttribute('slideidx')
        }
        this._handle_dnd_paste(data,dst_index)
    },
    _handle_dnd_paste:function(data,dst_index){
        var self = this
        // drop_target could be slide-thumbnail or thread-tab-content
        var active_tab = null
        w2ui['thread-tabs'].tabs.some(function(tab){
            if (tab.id == w2ui['thread-tabs'].active){active_tab = tab; return true}
        })

        if (active_tab.t_state){
            //on existing thread
            var t_id = active_tab.t_state.id
            var t_name = ''//don't matter
        }
        else{
            // add a new thread
            var t_id = '__new__'
            var t_name = ''//will be assigned later
        }
        var do_action = function(options){
            switch(options.action){
                case 'add_slides':
                    window.loading(true,'Add slide',true)
                    if (t_id == '__new__'){
                        //take the 1st file's name as thread name
                        t_name = options.files[0].name
                    }
                    //options.name is only used when files.length==1
                    self.sbs_user.add_slides({p_id:self.p_id,t_id:t_id,t_name:t_name,name:options.name,flag:self.flag_of_token,insert_at:options.dst,files:options.files}).done(function(ret){
                        window.loading(false)
                        // no need to update to Presentation's local copy
                        // local copy will got updated from bus by sync
                    }).fail(function(response){
                        w2alert(response.stderr.message || response.stderr)
                        window.loading(false)
                        console.log(response)
                    })
                    break
                case 'swap_slide':
                    window.loading(true,'Swaping slides',true)
                    self.sbs_user.swap_slides(self.p_id,self.flag_of_token,t_id,options.src,options.dst).done(function(response){
                        window.loading(false)
                        // local thread state
                        // will be update via bus-syncing
                    }).fail(function(response){
                        w2alert(response.stderr.message || response.stderr)
                        window.loading(false)
                        console.log(response)
                    })
                break
            }
        }

        if (_.isString(data)){
            //creating slide with string
            if (dst_index=='trashcan') return //make no-sense

            var slide_resource = window.slide_resource_factory.from_string(data)
            console.log('data -->',data, slide_resource,'<--')
            if (slide_resource && slide_resource.type){
                var blob = new Blob([JSON.stringify(slide_resource)], {type: "octet/stream"})
                var filename = 't'+Math.round(new Date().getTime()/1000)+'.json'
                var file = new File([blob], filename,{type: "application/json"})                
                var options = {
                    action: 'add_slides',
                    files:[file],
                    name:file.name,
                    dst:(typeof(dst_index)=='undefined' || dst_index===null) ? -1 : parseInt(dst_index)
                }
                do_action(options)                
            }
            return
        }
        else if (data.is_directory){
            //console.log('is folder',data.name)
            //var dst_index = drop_target.getAttribute('slideidx')
            if (dst_index=='trashcan') return //make no-sense
            var options = {
                action: 'add_slides',
                files:data.files,
                name:data.name,
                dst:(typeof(dst_index)=='undefined' || dst_index===null) ? -1 : parseInt(dst_index)
            }
            do_action(options)
        }
        else if (data.is_file){
            //var dst_index = drop_target.getAttribute('slideidx')
            if (dst_index=='trashcan') return //make no-sense
            //console.log('add-slide to', dst_index)
            var options = {
                action: 'add_slides',
                files:[data.file],
                name:data.name,
                dst:(typeof(dst_index)=='undefined' || dst_index===null) ? -1 : parseInt(dst_index)
            }
            do_action(options)
        }
        else if (data.item.type=='slide/index'){
            // dropped is a slide-thumbnail
            // on a slide-sensor or on a slide-thumbnail?
            data.item.getAsString(function(src_index_str){
                var src_slide_thumbnail = $('.slide-thumbnail[slideidx="'+src_index_str+'"]')[0]
                var src_index = parseInt(src_index_str)
                
                var selected_indexes = []
                _.each(self._dragging_thumbnails,function(ele){
                    var slideidx = parseInt(ele.getAttribute('slideidx'))
                    if (slideidx == -1) return //skip "New Slide"
                    selected_indexes.push(slideidx)
                })
                //dragging to traschcan, means to remove slides
                if (dst_index == 'trashcan'){                    
                    self.remove_slides_by_indexes(selected_indexes)
                    return
                }

                //convert dst_index to integer
                dst_index = parseInt(dst_index)
                
                // if dragging slide-thumbnail is not selected, add it into selection
                if (selected_indexes.indexOf(src_index) == -1){
                    selected_indexes.push(src_index)
                }
                
                // swap with self or next position make no sense
                var probidden_indexes = []
                _.each(selected_indexes,function(idx){
                    probidden_indexes.push(idx)
                    probidden_indexes.push(idx+1)
                })
                // push -1 in the probidden_indexes if the last slide-thumbnail is in probidden_indexes
                var slides_count = $('#thread-tab-content .slide-thumbnail').length-1
                if (probidden_indexes.indexOf(slides_count) >= 0){
                    probidden_indexes.push(-1)
                }
                if (probidden_indexes.indexOf(dst_index)>=0){
                    //console.log(selected_indexes,probidden_indexes,dst_index,'conflict')
                    return
                }

                selected_indexes.sort(function(a,b){return a>b ? 1 : (a<b ? -1 : 0)})
                var options = {
                    action: 'swap_slide',
                    src:selected_indexes,
                    dst:dst_index
                } 
                do_action(options)
            })           
        }
        else return //ignored
    },
    /* acl related implementation */
    audience_screen:function(start){
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.audience_screen'
        start = typeof(start)=='undefined' ? true : start
        window.sdk.send_command(new Command(cmd,[self.p_id,self.flag_of_token,start])).done(function(response){
            if (response.retcode != 0){
                promise.reject(response.stderr)
                return
            }
            promise.resolve(response.stdout)
        }).fail(function(err){
            console.warn(err)
            promise.reject(err)
        })
        return promise
    },
    speaker_screen:function(start){
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.speaker_screen'
        start = typeof(start)=='undefined' ? true : start
        window.sdk.send_command(new Command(cmd,[self.p_id,self.flag_of_token,start])).done(function(response){
            if (response.retcode != 0){
                promise.reject(response.stderr)
                return
            }
            promise.resolve(response.stdout)
        }).fail(function(err){
            console.warn(err)
            promise.reject(err)
        })
        return promise
    },
    dashboard_sharing:function(start){
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.dashboard_sharing'
        start = typeof(start)=='undefined' ? true : start
        window.sdk.send_command(new Command(cmd,[self.p_id,start])).done(function(response){
            if (response.retcode != 0){
                promise.reject(response.stderr)
                return
            }
            promise.resolve(response.stdout)
        }).fail(function(err){
            console.warn(err)
            promise.reject(err)
        })
        return promise
    },
    /*
    Implements of Presentation's delegation starts 
    */
    _on_unavailable:function(){
        //handy helper for implmentation
        w2ui['toolbar'].destroy()
        document.getElementById('page').style.display = 'flex'
        document.getElementById('page').style.backgroundColor = 'white'
        document.getElementById('page').innerHTML = '<img style="margin:auto" src="idle_screen.jpg"/>'
    },   
    get_zooming_area:function(){return null},//no zooming
    toggle_toolbar:function(){
        //divert to embedded screen
        this.presentation_screen.presentation.delegate.toggle_toolbar()
    },
    get_flag_of_token:function(){return this.flag_of_token},
    fire_event:function(){},
    render_slide:function(panel_name,thread,slide){
        //remove current focus
        $('#thread-tab-content .thread-slide.screen-focus').removeClass('screen-focus')

        var pat = /screen-focus/
        var thread_changed = false
        _.each(w2ui['thread-tabs'].tabs,function(tab){
            if (tab.id == thread.id && (!pat.test(tab.text))){
                tab.text = '<span class="v-tab-caption screen-focus">'+tab.id+'</span>'
                thread_changed = true
            }
            else if (tab.id !== thread.id && pat.test(tab.text)) {
                tab.text = '<span class="v-tab-caption">'+tab.id+'</span>'
                thread_changed = true
            }
        })
        if (thread_changed) w2ui['thread-tabs'].refresh()

        if (thread && thread.id == w2ui['thread-tabs'].active){
            if (slide){
                var idx = thread.slides.indexOf(slide)
                $('#thread-tab-content .thread-slide .slide-thumbnail[slideidx="'+idx+'"]').parent().addClass('screen-focus')
            }
        }
        return $.when(true)
    },
    on_get_presentation_error:function(){
        this._on_unavailable()
    },
    on_refresh_state_did:function(topic, value){
        switch(topic){
            case 'acl_token':
                //this.toolbar_update_speaker_menuitem(value.ss ? true : false)
                if (value.ss) {
                    //reload embedded screen(workaround to enforce iframe to reload)
                    document.getElementById('embedded-screen').src = 'about:blank'
                    setTimeout(function(){document.getElementById('embedded-screen').src = 'screen.html#'+'2'+value.ss},100)
                }
                //this.toolbar_update_audience_menuitem(value.as ? true : false)
                //this.toolbar_update_sharing_menuitem(value.ds ? true : false)
                break
        }
    },
    on_refresh_state_error:function(error){
        //pass
    },
    on_added:function(topic,data){
        var self = this
        var do_refresh = function(tab_id){
            if (!self._on_add_throttle){
                loading(true,'receiving new slides',true)
                self._on_add_throttle = _.throttle(
                    function(){                        

                        delete self._on_add_throttle
                        loading(false)

                        //if currently is at "new" or the added thread,
                        //click to refresh this thread
                        if ([tab_id,'new'].indexOf(w2ui['thread-tabs'].active) >=0){
                            //focus on this new thread, if current focus tab is New
                            w2ui['thread-tabs'].click(tab_id)
                        }
                    },
                    1500,
                    {trailing:true,leading:false}
                )    
            }
            self._on_add_throttle()            
        }
        switch(topic){
            case 'thread':
                var t_state = this.presentation.threads[data.t_id]
                var caption = '<span class="v-tab-caption">'+data.t_id+'</span>' 
                var thread_tab = {id:data.t_id, caption:caption, t_state:t_state}
                // for v-style tabs bar
                if (w2ui['thread-tabs'].tabs.length==1){
                    //no threads, only "new" tab
                    w2ui['thread-tabs'].add(thread_tab)
                }
                else {
                    // insert before "new" which is at index 1
                    w2ui['thread-tabs'].insert(w2ui['thread-tabs'].tabs[1].id,thread_tab)
                }
                w2ui['thread-tabs'].update_position()
                do_refresh(data.t_id)
                break
            case 'slides':
                //click the table to enforce rending again
                do_refresh(data.t_id)
                break
        }
    },
    on_removed:function(topic,data){
        switch(topic){
            case 'presentation':
                this._on_unavailable()
                break
            case 'thread':
                if (w2ui['thread-tabs'].active==data.t_id_removed){
                    w2ui['thread-tabs'].click(data.t_id_focus)
                }
                setTimeout(function(){
                    w2ui['thread-tabs'].remove(data.t_id_removed)
                    w2ui['thread-tabs'].update_position()    
                },100)
                break
            case 'slides':
                w2ui['thread-tabs'].click(data.t_id)
                break
        }
    },
    on_swapped:function(t_state){
        if (w2ui['thread-tabs'].active == t_state.id){
            w2ui['thread-tabs'].click(t_state.id)
        }
    },
    on_shutdown:function(){
        var self = this
        if (window == top){
            document.getElementById('page').innerHTML = ''
            w2alert('The screen has shutdown').done(function(){
                //if this is in iframe, to idle_screen.jpg
                window.location.href = 'index.html'
            })    
        }
        else{
            this._on_unavailable()
        }
    },
    on_message:function(s,keep){
        return
    },  
    on_no_slide:function(){
        //pass
    },
    on_no_thread:function(){
        // go new tab
        w2ui['thread-tabs'].click('new')
    },
    on_no_more_thread:function(no_more){
        if (no_more) w2ui['thread-tabs'].remove('new')
        else if (!w2ui['thread-tabs'].get('new')){
            w2ui['thread-tabs'].add({id:'new', caption:'New'})
        }
        w2ui['thread-tabs'].update_position()
    },
    get_video_player:function(){
        return null
    },
    on_pointer:function(){
        //pass
    },
    on_origin:function(){
        //pass
    },
    set_zooming:function(){
        //pass
    },
    reset_zooming:function(){
        //pass
    }
}

//implement loading
window.loading = function(yes,message,showSpinner){
    if (yes && window._loading_count) return ++window._loading_count
    if (yes){
        window._loading_count = 1
        w2utils.lock(document.body,message,showSpinner)
    }
    else if (window._loading_count){
        window._loading_count -= 1
        if (!window._loading_count){
            delete window._loading_count
            w2utils.unlock(document.body)
        }
    }
}
//implement i18n message (later)
window.get_readable_message = function(response){
    if (response.retcode != 0){
        if (response.stderr.data){
            var _compiled = _.template(response.stderr.message)
            return _compiled(response.stderr.data)
        }
        else return response.stderr.message
    }
    return response.stdout    
}

function ResourceFactory(){
    /* 在whiteboard.js已經有新的implementation 2018/11/6*/
}
ResourceFactory.prototype = {
    from_string:function(text){
        var resource_metadata = {}
        var self = this
        _.some([this.yt, this.op, this.url],function(func){
            var ret = func.call(self,text)
            if (ret.type){
                resource_metadata = ret
                return true
            }
        })
        return resource_metadata
    },
    url:function(text){
        /*
        https://docs.google.com/presentation/d/1VKB9tKinLdU43gTEEeg6JR7BPBq_Zsfzph4NK1o51J4/edit#slide=id.p
        https://drive.google.com/file/d/1hcjUj-epfdi-EkU6bOk3hIx2g_qREnyn/view?usp=sharing
        https://drive.google.com/drive/u/0/folders/14g2boak5klcqEmi-4U6uyu21Z2_oAcbz
        */
        var pat = /https?:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]|[^\x00-\x7F]){2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]|[^\x00-\x7F])*/
        var m = text.match(pat)
        var slide_resource = {}
        if (m){
            slide_resource.type = 'URL'
            slide_resource.url = m[0]
        }
        return slide_resource
    },
    op:function(text){
        /* Google Slides published presentation */
        //https://docs.google.com/presentation/d/e/2PACX-1vRDf1GKNjh6J6xcZF_Cqb3SiHdh2eL0wGbYkhKxEp97cLspWmPlnp5qKQhOYKa_t8P27I3qjiie0Wxh/embed
       // https://docs.google.com/presentation/d/e/2PACX-1vRDf1GKNjh6J6xcZF_Cqb3SiHdh2eL0wGbYkhKxEp97cLspWmPlnp5qKQhOYKa_t8P27I3qjiie0Wxh/pub?start=false&loop=false&delayms=3000
        var gs_pat = /(https:\/\/docs\.google\.com\/presentation\/.+)\/(embed|pub).*?"?/
        var m = text.match(gs_pat)
        var slide_resource = {}
        if (m){
            slide_resource.type = 'OP'  //online presentation
            slide_resource.kind = 'GS' //subtype
            slide_resource.url = m[1]+'/embed'
            slide_resource.extra = [1]//page_no
        }
        return slide_resource        
    }, 
    yt:function(text){
        /*
            search url which is supported to create a slide
            returns a slide_resource, which is {} if url not found or
            the returned data will be accessed by slide.resource

            1. https://www.youtube.com/watch?v=MKWWhf8RAV8
            2. https://youtu.be/U0cJLHF3g8g?t=24s
            3. <iframe width="560" height="315" src="https://www.youtube.com/embed/DJsGqx0LykY?rel=0&amp;controls=0&amp;showinfo=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            4. <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/DJsGqx0LykY?start=600" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>        
        */
        var slide_resource = {}
        //length limit for cheep security
        var pat_youtube =  /^https:\/\/www\.youtube\.com\/watch\?v=([\w\-]{11,})(\&?.{0,40})/s
        var pat_youtube_share =  /^https:\/\/youtu\.be\/([\w\-]{11,})(\??.{0,40})/s
        var pat_youtube_embed =  /src="https:\/\/www\.youtube\.com\/embed\/([\w\-]{11,})([^"]{0,60})"/s
        var pat_youtube_embed_nocookie =  /src="https:\/\/www\.youtube\-nocookie\.com\/embed\/([\w\-]{11,})([^"]{0,60})"/s
        var pats = [pat_youtube,pat_youtube_share,pat_youtube_embed,pat_youtube_embed_nocookie]
        var pat_time1 = /[&\?]?t\=(\d+h)?(\d+?m)?(\d+s)?/
        var pat_time2 = /[&\?]?start\=(\d+)/
        _.some(pats,function(pat){
            var m = text.match(pat)
            if (!m) return
            slide_resource.type = 'VIDEO'
            var v_id = m[1]
            var player_time = 0
            //find time
            if(pat_time2.test(m[2])){ //must before pat_time1
                var mt = m[2].match(pat_time2)
                player_time = parseInt(mt[1])
            }
            else if (pat_time1.test(m[2])){
                var mt = m[2].match(pat_time1)
                player_time = parseInt(mt[1] ? mt[1].substring(0,mt[1].length-1) : 0) * 3600 + parseInt(mt[2] ? mt[2].substring(0,mt[2].length-1) : 0) * 60 + parseInt(mt[3] ? mt[3].substring(0,mt[3].length-1) : 0)
            }
            slide_resource.kind = 'YT' //youtube
            slide_resource.vid = v_id
            slide_resource.extra = [0, player_time,0] //[state, player_time (mutable part), current_time]
            return true
        }) 
        return slide_resource
    }
}
window.slide_resource_factory = new ResourceFactory()

window.addEventListener('DOMContentLoaded',function(){
    //figure out what hash we have, and recover hash from localstorage if necessary
    var hash = window.location.hash.replace(/^#/,'')
    if (!hash) {
        if (!hash){
            window.location.href = '/index.html'    
            return
        }    
    }
    //dashboard need not hash to allow bookmarking

    var _reload_timer
    window.onresize =  function(evt){
        if (_reload_timer) clearTimeout(_reload_timer)
        //setup a throttle of 1 second
        _reload_timer = setTimeout(function(){
            window.location.reload()
        },500)
    }

    var p_id = hash

    //1 for p_id, 4 for token of dashboard-sharing
    var flag_of_token = p_id.substring(0,2)=='4!' ? 4 : 1
    if (flag_of_token == 4) {
        p_id = p_id.substring(2)
        // keep hash, so owner can copy and paste to others if necessary
        //window.location.hash = ''
    }
    window.dashboard = new Dashboard(p_id,flag_of_token)
    window.dashboard.init()  

    //disable browser's drop behavior, such as open a link     
    $(document).on("drop", function(evt) {
        evt.preventDefault();
    })
    $(document).on('dragover',function(evt){
        evt.preventDefault()
    })
})