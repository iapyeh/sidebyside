// depends on cookie.js, guid.js
function SBSUser(delegate){  
    this.delegate = delegate
    var self = this   
    /*
    * a dict from server
    * assets = {
    *      presentations:[ list of presentation id of user]
    * }
    */
    this.assets = null  

    this.p_state = null //presentation_state

    this.preferences = null
    
    this.is_reconnection = false
    this.ready = false
    this.ready_callbacks = []
}

SBSUser.prototype = {
    init:function(){
        var self = this
        
        // "global_config" is loaded from "../@/sidebyside/config" like this:
        //<script src="../@/sidebyside/config"></script>
        //<script src="sbsuser.js"></script>       
        var protocol = window.location.protocol.split(':')[0]//http or https
        var options = global_config[protocol]
        if (!window.sdk) {
            window.sdk = new ObjshSDK(options)
            sdk.user.call_when_ready(function(){
                //init preferences
                self.preferences = sdk.user.preferences
                //self.preferences.clear()
                if (!self.preferences.get('dashboard')){
                    self.preferences.set('dashboard',{
                        
                    })
                }
                if (!self.preferences.get('screen')){
                    self.preferences.set('screen',{
                        camera:{},
                        draw:{
                            color:'ff0000', // don't prefix #
                            size:2, //pen size
                            esize:2,//eraser size
                        }
                    })
                }
                self.ready = true
                _.each(self.ready_callbacks,function(callback){
                    callback()
                })
                delete self.ready_callbacks
            })
        }
    
        var login_data = {type:'sbs'}
        window.sdk.login(login_data).then(function(response){
            //success        
            window.sdk.connect().progress(function(state){
                switch(state){
                    case 'onopen':
                        self._last_connection_ts = new Date().getTime()
                        self.delegate.on_connected(self.is_reconnection)
                        self.set_heartbeat(global_config.heartbeat)
                        break
                    case 'onclose':
                        console.warn('disconnected')
                        console.log('connection duration:',new Date().getTime() - self._last_connection_ts)
                        var reconnect = self.delegate.on_disconnected()
                        if (reconnect){
                            self.is_reconnection = true              
                            _.delay(function(){self.init()},1000)
                        }
                        break
                }
            })        
        },function(e){
            //failure (one reason is that server restarts)
            //console.warn(e)
            var reconnect = self.delegate.on_disconnected()
            if (reconnect){                            
                _.delay(function(){self.init()},5000)
            }
        })
    },
    call_when_ready:function(callback){
        if (this.ready){
            _.defer(callback)
        }
        else{
            this.ready_callbacks.push(callback)
        }
    },
    set_heartbeat:function(s){
        if (!s) return //set to 0 to disable
        var self = this
        var ping = function(){
            if (window.sdk.is_connected){
                var command = new Command(ObjshSDK.metadata.runner_name+'.root.sidebyside.heartbeat')
                window.sdk.send_command(command).done(function(response){
                })    
            }
            //else{console.log('giveup heartbeat, disconnected')}
            _.delay(ping,s*1000)
        }
        _.delay(ping,s*1000)
    },
    filter_files:function(files){
        //called to filter out non-supported file before creating slide
        // supported mimetype: 'image/png','image/jpeg','image/gif'
        // and filename can not starts with .
        var ret = []
        var supported = ['image/png','image/jpeg','image/gif','application/json']
        for (var i=0;i<files.length;i++){
            console.log('file===>',files[i].type, files[i].name)
            if ((supported.indexOf(files[i].type)==-1) || (files[i].name.substr(0,1)=='.')) {
                console.warn('skip',files[i].name)
                continue
            }
            ret.push(files[i])
        }
        return ret
    },
    create_presentation:function(name,_files){
        //2019-03-10T05:53:33+00:00
        // 重新允許使用者增加簡報；目前的implement是比較複雜的，它允許用拖放檔案的方式建立新的簡報
        var files = this.filter_files(_files)
        var self = this
        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.create_presentation'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd,[name])).done(function(response){
            if (response.retcode != 0) {
                promise.reject(response.stderr)
                return
            }
            // result is a dict: result.p_state and result.ctime
            var result = response.stdout
            if (files.length==0) {
                promise.resolve(result)
                return
            }
            // update files; 
            // 2019-03-10T06:13:32+00:00
            // 目前這一段沒有用到，或許將來用到時可以改用progress callback; 
            var p_id = p_state.id
            var t_name = name
            var t_id = '__new__'
            var options = {
                p_id:p_id,
                t_id:t_id,
                t_name:t_name,
                name:name,
                flag:1, //now, only owner can create presentation
                files:files,
                insert_at: -1
            }
            self.add_slides(options).done(function(result){
                // add_slides no more returns useful data, so no need to pickup its result
                //p_state.threads[result.t_state.id] = result.t_state
                promise.resolve(result)
            }).fail(function(err){
                promise.reject(err)
            })
        })
        return promise
    },
    remove_presentation:function(p_id){
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.remove_presentation'
        window.sdk.send_command(new Command(cmd,[p_id])).done(function(response){
            if (response.retcode == 0) promise.resolve(response.stdout)
            else promise.reject(response.stderr,response.retcode)
        }).fail(function(error){
            console.log('remove_presentation failure',error)
            promise.reject(error)
        })
        return promise
    },
    rename_presentation:function(p_id,flag,name){
        // (2019-03-09T08:18:57+00:00) p_id 實際上是token
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.rename_presentation'
        window.sdk.send_command(new Command(cmd,[p_id,flag,name])).done(function(response){
            if (response.retcode == 0) promise.resolve(response.stdout)
            else promise.reject(response.stderr,response.retcode)
        }).fail(function(error){
            promise.reject(error)
        })
        return promise
    }, 
    set_presentation_default:function(p_id){
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.set_presentation_default'
        window.sdk.send_command(new Command(cmd,[p_id])).done(function(response){
            if (response.retcode == 0) promise.resolve(response.stdout)
            else promise.reject(response.stderr,response.retcode)
        }).fail(function(error){
            console.log('remove_presentation failure',error)
            promise.reject(error)
        })
        return promise
    },
    get_presentation_token:function(p_id){
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.get_presentation_token'
        window.sdk.send_command(new Command(cmd,[p_id])).done(function(response){
            if (response.retcode == 0) promise.resolve(response.stdout)
            else promise.reject(response.stderr,response.retcode)
        }).fail(function(error){
            console.log('remove_presentation failure',error)
            promise.reject(error)
        })
        return promise
    },            
    /* retrieve list of all user's presentations */
    get_all_presentations:function(){
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.get_all_presentations'
        window.sdk.send_command(new Command(cmd,[])).done(function(response){
            promise.resolve(response.stdout)
        }).fail(function(error){
            promise.reject(error)
            console.log('remove_presentation failure',error)
        })
        return promise
    }    
    ,forget_me:function(){
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.forget_me'
        window.sdk.send_command(new Command(cmd,[])).done(function(response){
            promise.resolve(response.stdout)
        }).fail(function(error){
            promise.reject(error)
            console.log('remove_presentation failure',error)
        })
        return promise
    }
    ,add_slides:function(options){
        
        //disabled in whiteboard 
        return 

        //options.name is only used when files.length==1
        //why this work without prefix ObjshSDK.metadata.runner_name ?
        //beause this is a ajax request since it is an uploading action
        var cmd = 'root.sidebyside.add_slides'
        var promise = new $.Deferred()
        var p = options.p_id
        // if options.t_id is '__new__'
        // a new thread will be created, t_state will be resolved
        var t_id = options.t_id 
        var tn = options.t_name
        var flag = options.flag
        var files = this.filter_files(options.files)
        if (files.length==0) return $.when([])

        //resort file by name
        files.sort(function(a,b){
            if (a.name > b.name) return 1
            else if (a.name < b.name) return -1
            else return 0
        })

        var s_states = []
        var t_state = null
        var job = function(idx,insert_at){
            //console.log('job idx=',idx,', insert_at=',insert_at)
            var file = files[idx]
            var s_name = files.length==1 ? options.name : file.name
            var args = {p:p,t:t_id,tn:tn,n:s_name,f:flag}
            if (insert_at != -1){
                args['i'] = insert_at
                //console.log('i=',insert_at)
                insert_at += 1
            } 
            window.sdk.send_command(new Command(cmd,[args],file)).done(function(response){
                if (response.retcode != 0) return promise.reject(response)               
                if (t_id == '__new__'){
                    //a new thread should be added
                    //let next slides added to this new thread
                    t_id = response.stdout 
                }
                if (idx == files.length-1){
                    //promise.resolve({t_state:t_state,s_states:s_states})
                    promise.resolve(true)
                }
                else{
                    setTimeout(function(){job(idx+1,insert_at)},0)
                }
            }).fail(function(jqXHR, textStatus, errorThrown){
                console.log('add slides failure:',[jqXHR, textStatus, errorThrown])
                promise.reject(jqXHR.status,jqXHR.statusText)
                //console.log(err)
                //promise.reject(err)
            })
        }
        job(0,typeof(options.insert_at)=='undefined' ? -1 : options.insert_at)
        return promise
    },
    /* deprecated
    remove_slides_of_id:function(p_id,flag_of_token,t_id,s_ids){
        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.remove_slides_of_id'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd,[p_id,flag_of_token,t_id,s_ids])).done(function(response){
            if (response.retcode != 0) return promise.reject({errcode:response.retcode,message:response.stderr})
            promise.resolve(response.stdout)
        }).fail(function(err){
            console.log(err)
            promise.reject({errcode:-1,message:err})
        })
        return promise
    },*/
    /* moved to presentation.js
    remove_slides_of_idx:function(p_id,flag_of_token,t_id,s_idxes){
        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.remove_slides_of_idx'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd,[p_id,flag_of_token,t_id,s_idxes])).done(function(response){
            if (response.retcode != 0) return promise.reject({errcode:response.retcode,message:response.stderr})
            promise.resolve(response.stdout)
        }).fail(function(err){
            console.log(err)
            promise.reject({errcode:-1,message:err})
        })
        return promise
    },*/
    remove_all_slides:function(p_id,flag_of_token,t_id){
        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.remove_all_slides'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd,[p_id,flag_of_token,t_id])).done(function(response){
            if (response.retcode != 0) return promise.reject({errcode:response.retcode,message:response.stderr})
            promise.resolve(response.stdout)
        }).fail(function(err){
            console.log(err)
            promise.reject({errcode:-1,message:err})
        })
        return promise
    },    
    swap_slides:function(p_id,flag,t_id,src_indexes,dst_index){
        //disabled in whiteboard 
        return 

        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.swap_slides'
        var promise = new $.Deferred()
        //console.log(p_id,t_id,src_indexes,dst_index)
        window.sdk.send_command(new Command(cmd,[p_id,flag,t_id,src_indexes,dst_index])).done(function(response){
            if (response.retcode != 0) return promise.reject(response)
            promise.resolve(response)
        }).fail(function(err){
            console.log(err)
            promise.reject(err)
        })
        return promise        
    },
    remove_thread:function(p_id,t_id,flag_of_token){
        //disabled in whiteboard 
        return 
        var cmd = ObjshSDK.metadata.runner_name+'.root.sidebyside.remove_thread'
        var promise = new $.Deferred()
        window.sdk.send_command(new Command(cmd,[p_id,t_id,flag_of_token])).done(function(response){            
            if (response.retcode != 0) {
                promise.reject({errcode:response.retcode,message:response.stderr})
                return
            }
            promise.resolve(response.stdout)
        })
        return promise
    },
    set_slide_resource:function(options){        
        var cmd = 'root.sidebyside.set_slide_resource' 
        var promise = new $.Deferred()
        var name = options.name || options.file.name
        var args = {p:options.p_id,t:options.t_id,s:options.s_idx,f:options.flag,n:name}
        window.sdk.send_command(new Command(cmd,[args],options.file)).done(function(response){
            if (response.retcode != 0) {
                promise.reject(response) 
                return
            }            
            promise.resolve(response.stdout)
        }).fail(function(jqXHR, textStatus, errorThrown){
            console.warn('set_slide_resource failure:',[jqXHR, textStatus, errorThrown])
            promise.reject(jqXHR.status,jqXHR.statusText)
        })
        return promise
    },
    add_whiteboard_slides:function(options){
        /*  options:{
            p_id:(str)
            t_id:(str)
            flag:(int)
            insert_at:(int)
            file:([file+])
            }
        */
        //why this work without prefix ObjshSDK.metadata.runner_name ?
        //beause this is a ajax request since it is an uploading action
        var cmd = 'root.sidebyside.add_whiteboard_slide'
        var promise = new $.Deferred()
        var p = options.p_id
        var t_id = options.t_id 
        var flag = options.flag
        var files = options.files
        
        //resort file by name
        files.sort(function(a,b){
            if (a.name > b.name) return 1
            else if (a.name < b.name) return -1
            else return 0
        })
        var s_states = []
        var t_state = null
        var job = function(idx,insert_at){
            var file = files[idx]
            var s_name = files.length==1 ? (options.name || file.name) : file.name
            var args = {p:p,t:t_id,n:s_name,f:flag,i:-1}
            if (insert_at != -1){
                args['i'] = insert_at
                insert_at += 1 //for next insert
            } 
            window.sdk.send_command(new Command(cmd,[args],file)).done(function(response){
                if (response.retcode != 0) return promise.reject(response)               
                if (idx == files.length-1){
                    promise.resolve(true)
                }
                else{
                    setTimeout(function(){
                        job(idx+1,insert_at)
                    },500)//留一點空隙以接收新的slide資料
                }
            }).fail(function(jqXHR, textStatus, errorThrown){
                console.log('add slides failure:',[jqXHR, textStatus, errorThrown])
                promise.reject(jqXHR.status,jqXHR.statusText)
            })
        }
        job(0,typeof(options.insert_at)=='undefined' ? -1 : options.insert_at)
        return promise
    }
    /* obsoleted
    set_owner:function(owner){
        this.is_guest =  !((owner && this.u_id==owner))
        var readonly = this.is_guest
        return readonly
    }
    */
}
