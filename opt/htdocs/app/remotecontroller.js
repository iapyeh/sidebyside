function DummyDelegator(u_id){
    this.u_id = u_id
    this.readonly
}
DummyDelegator.prototype = {
    render_slide:function(thread,slide,transtion){
        var slide_total = thread.slides.length
        document.getElementById('pageno').innerHTML = (slide.idx+1)+'<span class="total-slides">/'+slide_total+'</span>'
        return $.when(true)
    },
    toggle_toolbar:function(){

    },
    get_zooming_area:function(){
        return null
    },
    get_flag_of_token(){
        //remote controller shares the same token with speaker screen
        return 2
    },
    on_message:function(s,keep){
        window.message(s,keep)
    },
    get_video_player:function(){
        return null
    }
}
function RemoteController(p_id, container){
    this.p_id = p_id
    this.sbs_user = new SBSUser(this)
    
    var screen_ele = null
    this.presentation = new Presentation(p_id,new DummyDelegator(this.sbs_user.u_id),{
        keyboard_shortcut: false,
        isolated: false
    })
    
    this.container = container //DOM element

    //should follow the common slide controller API
    //this.keyboard_shortcut = new KeyboardShortcut(this)
}
RemoteController.prototype = {
    init:function(){

        //finally, var sbs_user to initialize
        this.sbs_user.init()

    },
    init_render:function(){
        
    },
    //implement SBSUser delegations
    on_connected:function(){
        //called by self.sbs_user
        _.delay(function(){
            w2utils.unlock(document.body)
        },500)        
        var sdk = window.sdk
        var self = this
        this.presentation.init(sdk).done(function(){
            /*
            if (self.presentation.readonly){
                window.location.href = 'screen.html#'+self.p_id
            }
            else self.init_render()
            */

            self.init_render()
            
            // trigger persentation to do initial rendering
            self.presentation.on_thread_changed()

            if (_.size(self.presentation.threads)==1){
                //disable thread changes
                $('.thread.action').hide()
            }
        })
    },
    on_disconnected:function(){
        w2utils.lock(document.body,'reconnecting',true)
        //return true to ask sbs_user to reconnect
        return true        
    }
}


$(function(){
    var call_when_ready = function(){
        var p_id = global_config.token.ss
        //console.log('p_id=',hash)
        //var p_id = hash
        window.remote_controller = new RemoteController(p_id, $('#remote_control')[0])
        window.remote_controller.init()
    }

    window.message = function(s,keep){
        // console.log(s)
        if (this._mt) clearTimeout(this._mt)
        document.getElementById('message').innerHTML = s
        
        if (keep) return
        this._mt = setTimeout(function(){
            document.getElementById('message').innerHTML = ''
        },500)
    }

    var config_checker = function(){
        if (typeof(global_config)=='undefined'){
            setTimeout(function(){config_checker()},10)
        }
        else{
            // in vscode
            if (location.pathname.split('/').pop()=='vscode.html'){
                global_config.vscode = 1
                window.vscode_client = new VSCodeClient()
            }
            if (!global_config.user){
                //will request config again after login
                delete global_config
                var script = document.getElementById('config-script')
                var src = script.src
                script.parentNode.removeChild(script)
                //auto login
                $.ajax({
                    url:'../login?type=sbs',
                    success:function(){
                        //console.log('getting config agin')
                        var script = document.createElement('script')
                        script.setAttribute('id','config-script')
                        script.src = src
                        document.body.append(script)
                        setTimeout(function(){config_checker()},10)             
                    }
                })        
            }
            else if (global_config.require_passcode){
                window.request_passcode()
            }
            else{
                //called firstly
                call_when_ready('')
                
                                
                //called secondary
                if (global_config.vscode){
                    window.vscode_client.call_when_ready()
                }                
            }
            //clean up
            delete global_config
        }
    }
    config_checker()
    /*

    //figure out what hash we have, and recover hash from localstorage if necessary
    var hash = window.location.hash.replace(/^#/,'')
    if (!hash) {
        //window.location.href = '/index.html'    
        return
    }
    var p_id = global_config.token.ss
    //console.log('p_id=',hash)
    //var p_id = hash
    
    window.remote_controller = new RemoteController(p_id, $('#remote_control')[0])
    window.remote_controller.init()

    $('#open_qrcode').on('click',function(){
        open('qrcode.html#remotecontroller,'+p_id+',','remotecontroller_qrcode')
    })
    */
})