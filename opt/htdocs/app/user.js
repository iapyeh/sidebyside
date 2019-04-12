/*
 * How this pages behave
 * 1. For a user without valid cookie
 *  - The user will see introductional stuffs of the sidebyside system.
 *  - The user is encouraged to create presentations by 
 *      - drop a folder of images which are exported by PPT or Keynote
 *      - drop a link to a published presentation of Google slides 
 * 2. For a user with valid cookie
 *  - A list of presentations are presented
 *  - A link to switch to permanent user by Oauth of Google or Facebook is presented
 *  - As well as drop-and-create presentation features as new users described in above.
 * 
 */



function Main(){
    this.sbs_user = null
    this.dnd_sensor = null
    this.sdk = null
    this.on_connected_callbacks = []
}
Main.prototype = {
    init:function(){
        /* do rendering-related initialization */
        this.dnd_sensor = new DnDSensor(this,document.body,$('#drop-2-creation-box')[0].getBoundingClientRect())
        this.sbs_user = new SBSUser(this)
        switch(this.sbs_user.kind){
            case 'guest':
            case 'member':
                break
        }

        //helper of init()
        // Layout: 3 areas
        //  - Presentation list
        //  - Create new presentation
        //  - Introductional material

        //finally, let sbs_user to initialize()
        this.sbs_user.init()
    },
    refresh:function(){
        //called when connected
        var self = this
        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.get_assets'
        window.loading(true,'loading user assets',true)
        window.sdk.send_command(new Command(cmd)).done(function(response){
            window.loading(false)
            if (response.retcode != 0){
                //something wrong
                w2alert(response.stderr.message)
                return
            }
            var assets = response.stdout
            self.render_presentation_list(assets.presentations)
        })
    },
    render_presentation_list:function(p_list){
        //called to generate a list of presentations of this user
        var self = this
        //console.log('p_list=',p_list)
        var box = document.getElementById('presentation-list-box')
        var tags = ['']
        var cell =  _.template('<div class="presentation-item"><a href="dashboard.html#<%= debug %><%= p_id %>"><img class="presentation-thumbnail" src="<%= src %>"></a></div>')
        let debug = this.sbs_user.debug ? 'debug,' : ''
        //console.log('deug=',debug,this.sbs_user.debug)
        _.each(p_list,function(p_id,idx){
            tags.push(cell({p_id:p_id,src:'../@/sidebyside/thumbnail?f=1&p='+p_id,debug:debug}))
        })
        tags.push('')
        box.innerHTML = tags.join('')
    },
    //implementation of SDK delegation
    on_connected:function(){
        this.refresh()
    },
    on_disconnected:function(){
    },
    //implementation of DndSensor delegation
    on_dnd_file:function(ret){
        //console.log('create_presentation>>>',ret)
        let self = this
        let name = ret.name
        let files = ret.is_directory ? ret.files : [ret.file]
        window.loading(true,'creating presentation',true)
        this.sbs_user.create_presentation(name,files).done(function(presentation_metadata){
            window.loading(false)
            setTimeout(function(){
                window.location = 'dashboard.html#'+(self.sbs_user.debug ? 'debug,': '')+presentation_metadata.id
            },0)
        }).fail(function(err){
            console.warn(err)
            window.loading(false)
        })
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
window.addEventListener('DOMContentLoaded',function(){
    window.main = new Main()
    window.main.init()    
})

//For cookies , browser takes localhost and 127.0.0.1 as two different domain,
//so we normalize localhost to 127.0.0.1
if (window.location.hostname == 'localhost'){
    var url = window.location.href.replace('//localhost','//127.0.0.1')
    window.location.href = url
}