function Admin(){
    this.sdk = null
    this.runner_name = null
    //layout pages
    var pstyle = ''
    $('#page').w2layout({
        name: 'page',
        panels: [
            { type: 'top', size:30, style: pstyle, content: 'top' },
            { type: 'left', size: 200, style: pstyle, content: 'left' },
            { type: 'main', style: pstyle, content: '' },
            { type: 'right', size: 400, hidden:true, style: pstyle, content: '',resizable:true },
        ]
    }); 
    //define sidebar
    $().w2sidebar({
        name: 'sidebar',
        nodes: [
            { id: 'cluster', text: 'Cluster', img: 'icon-folder', expanded: true, group: true,
              nodes: [ 
                    { id: 'available-hosts', text: 'Available Hosts', icon: 'fa-star-empty' },
                    { id: 'active-hosts', text: 'Active Hosts', icon: 'fa-star-empty' },                    
                ]
            },
            {id:'available_hosts',text:'Hosts', expanded: true, group:true,
                nodes:[]
            },
            {id:'account',text:'Admin User', expanded: true, group:true,
                nodes:[
                    {id:'logout', text:'Logout'}
                ]
            }
        ]
    }); 
    w2ui['sidebar'].hide('available_hosts')
    w2ui['page'].content('left',w2ui['sidebar'])  
}
Admin.prototype = {
    start:function(){
        var self = this
        this.sdk = new ObjshSDK()
        //should have been login
        this.sdk.login().then(
            function(){
                console.log('username',self.sdk)
                w2ui['page'].content('top','<span style="font-size:1.2em">'+self.sdk.access_path+'</span>')
                self.runner_name = self.sdk.metadata.runner_name
                if (self.sdk.user.username != 'admin'){
                    self.logout()
                    return;
                }
                self.sdk.connect().progress(function (state) {
                    //console.log(state)
                    switch (state) {
                        case 'onopen':
                            self.on_websocket_open()
                            break
                        case 'onclose':
                            if (self.sdk.is_authenticated) {
                            }
                            else {
                                console.log('user logout')
                            }
                            break
                    }
                })
            },
            function (code, reason) {
                // login failure , this is called 
                console.log('login failure',code, reason)
                if (code == 0) {
                    
                }
                else if (code == 403) {
                    // authentication error or logout
                    location.href = 'login.html'
                }
                else if (code == 404){
                }
            }
        )
        
        //bind buttons
        w2ui['sidebar'].on('click',function(evt){
            console.log('..',evt.target)
            switch(evt.target){
                case 'available-hosts':
                    window.admin.update_available_hosts_table()
                    break
                case 'active-hosts':
                    window.admin.update_active_hosts_table()
                    break
                case 'logout':
                    window.admin.logout()
                    break
            }
        })
        $('#do-logout').on('click',function(evt){
            evt.preventDefault()
        })
        $('#update-delegate-host-table').on('click',function(evt){
            evt.preventDefault()
            window.admin.update_delegate_hosts_table()
        })
    },
    logout:function(){
        //ensure user is admin
        var url = this.sdk.access_path + 'logout?next=' + this.sdk.access_path + 'app/login.html'
        location.href = url
    },
    update_available_hosts_table:function(){
        var self = this
        var cmd = this.runner_name+'.root.admin.get_available_hosts'
        var command = new Command(cmd,[])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode !=0) return console.log(response)
            var records = []
            var sidebard_nodes = []
            _.each(response.stdout,function(item,idx){
                var host_id = item[0]
                var data = item[1]
                records.push({recid:host_id,host_id:host_id,access_path:data.access_path,online:data.online,count:data.count})
                sidebard_nodes.push({id:'host:'+host_id,text:host_id+'@'+data.access_path})
            })
            if (w2ui['main-table']) w2ui['main-table'].destroy()
            var tmpl_content = $('#host-record-tmpl')[0].innerHTML.replace(/\&lt\;/g,'<').replace(/\&gt\;/g,'>')
            var host_record_tmpl = _.template(tmpl_content)
            $().w2grid({ 
                name: 'main-table', 
                show:{
                    toolbar:true,
                    toolbarDelete:true,
                },
                columns: [               
                    { field: 'online', caption: 'Online', size: '30' },
                    { field: 'host_id', caption: 'Host Id', size: '100' },
                    { field: 'access_path', caption: 'Host Access Path', size: '100' },
                    { field: 'count', caption: 'count', size: '40'}
                ],
                records:records,
                onDelete:function(evt){
                    if (evt.phase == 'before'){
                        var selection = w2ui['main-table'].getSelection()
                        if (selection.length == 0) return
                        var record = w2ui['main-table'].get(selection[0])
                        evt.done(function(evt){
                            var cmd = self.runner_name+'.root.admin.remove_available_host'
                            var command = new Command(cmd,[record.host_id,record.access_path])
                            self.sdk.send_command(command).done(function(response){
                                if (response.retcode == 0) w2alert('host '+record.host_id+' removed')
                                else w2alert(response.stderr)
                            })
                        })
                    }
                },
                onClick:function(evt){
                    //顯示此host的操作畫面
                    var record =  w2ui['main-table'].get(evt.recid) //records[parseInt(evt.recid)]
                    var access_path = record.access_path
                    //self.sdk.access_path is ended by '/', so here to ensure access_path is ended by / too
                    if (access_path.substring(access_path.length-1) != '/') access_path += '/'
                    if (access_path == self.sdk.access_path){
                        var content = host_record_tmpl(record)
                        w2ui['page'].content('right',content)
                        w2ui['page'].show('right')
                        _.defer(function(){
                            $('.do-health-check-database').on('click',function(){
                                self.do_health_check_database(false)
                            })   
                            $('.do-health-check-database-dryrun').on('click',function(){
                                self.do_health_check_database(true)
                            })   
                            $('.do-cleanup-local-fs').on('click',function(){
                                self.do_cleanup_local_fs(false)
                            })    
                            $('.do-cleanup-local-fs-dryrun').on('click',function(){
                                self.do_cleanup_local_fs(true)
                            })
                            $('.do-database-statistics').on('click',function(){
                                self.do_database_statistics()
                            })
                            $('.do-purge-username').on('click',function(){
                                self.do_purge_username()
                            })
                        })
                    }
                    else{
                        var url = access_path + 'app/login.html'
                        var content = '<a href="'+url+'" target="_blank">Go Admin</a>'
                        w2ui['page'].content('right',content)
                        w2ui['page'].show('right')
                    }
                }
            });
            w2ui['page'].content('main',w2ui['main-table'])
            var sidebar_item = w2ui['sidebar'].get('available_hosts')
            sidebar_item.nodes = sidebard_nodes
            w2ui['sidebar'].set('available_hosts',sidebar_item)
            w2ui['sidebar'].show('available_hosts')
            _.defer(function(){//a workarount to show the records
                w2ui['main-table'].refresh()
                //w2ui['sidebar'].refresh()
            })
        })
    },    
    update_active_hosts_table:function(){
        var self = this
        var cmd = this.runner_name+'.root.admin.get_active_hosts'
        var command = new Command(cmd,[])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode !=0) return console.log(response)
            var records = []
            var sidebard_nodes = []
            for (var access_path in response.stdout){
                var count = response.stdout[access_path].count
                records.push({recid:access_path,count:count,access_path:access_path})
            }
            if (w2ui['main-table']) w2ui['main-table'].destroy()
            var tmpl_content = $('#host-record-tmpl')[0].innerHTML.replace(/\&lt\;/g,'<').replace(/\&gt\;/g,'>')
            var host_record_tmpl = _.template(tmpl_content)
            $().w2grid({ 
                name: 'main-table', 
                show:{
                    toolbar:true,
                    toolbarDelete:true,
                },
                columns: [               
                    { field: 'access_path', caption: 'Host Access Path', size: '300px' },
                    { field: 'count', caption: 'count', size: 40}
                ],
                records:records,
                onDelete:function(evt){
                    if (evt.phase == 'before'){
                        var selection = w2ui['main-table'].getSelection()
                        if (selection.length == 0) return
                        var record = w2ui['main-table'].get(selection[0])
                        evt.done(function(evt){
                            var cmd = self.runner_name+'.root.admin.remove_active_host'
                            var command = new Command(cmd,[record.access_path])
                            self.sdk.send_command(command).done(function(response){
                                if (response.retcode == 0) w2alert('host of access_path '+record.access_path+' removed from active host table')
                                else w2alert(response.stderr)
                            })
                        })
                    }
                },
            });
            w2ui['page'].content('main',w2ui['main-table'])
            _.defer(function(){//a workarount to show the records
                w2ui['main-table'].refresh()
            })
        })
    },    
    update_delegate_hosts_table:function(){
        var cmd = this.runner_name+'.root.admin.get_delegate_host_table'
        var command = new Command(cmd,[])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode !=0) return console.log(response)
            var records = []
            _.each(response.stdout,function(item,idx){
                records.push({recid:idx,access_path:item[1],ss_token:item[0]})
            })
            $().w2grid({ 
                name: 'delegate-host-table', 
                columns: [               
                    { field: 'access_path', caption: 'Host Access Path', size: '100' },
                    { field: 'ss_token', caption: 'Token of Board', size: '200' },
                    { field: 'count', caption: 'Count', size: '40',tooltip:'alive member count' },
                ],
                records:records
            });
            w2ui['page'].content('main',w2ui['delegate-host-table'])
            _.defer(function(){//a workarount to show the records
                w2ui['delegate-host-table'].refresh()
            })
        })
    },
    on_websocket_open:function(){
        console.log('ok')
    },
    do_cleanup_local_fs:function(dryrun){
        // 清除連線主機上，很久無人存取的presentation
        var self = this
        var cmd = this.runner_name+'.root.admin.cleanup_local_fs'
        var command = new Command(cmd,[dryrun])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode==0){
                self.render_cleanup_grid(response.stdout)
            }
            else{
                w2alert(response.stderr)
            }
        })
    },
    /*
    do_host_cleanup_database:function(){
        // 清除連線主機上，很久無人存取的presentation
        var self = this
        var cmd = this.runner_name+'.root.admin.cleanup_database'
        var command = new Command(cmd,[])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode==0){
                w2alert('cleanup completed')
            }
            else{
                w2alert(response.stderr)
            }
        })
    },*/
    do_health_check_database:function(dryrun){
        var self = this
        var cmd = this.runner_name+'.root.admin.health_check_database'
        var command = new Command(cmd,[dryrun])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode==0){
                self.render_cleanup_grid(response.stdout)
            }
            else{
                w2alert(response.stderr)
            }
        })        
    },
    do_database_statistics:function(){
        var self = this
        var cmd = this.runner_name+'.root.admin.database_statistics'
        var command = new Command(cmd,[])
        this.sdk.send_command(command).done(function(response){
            if (response.retcode==0){
                self.render_cleanup_grid(response.stdout)
            }
            else{
                w2alert(response.stderr)
            }
        })
    },
    render_cleanup_grid:function(ret){
        var records = []
        var i = 0
        var recid_to_expand = []
        for (var group in ret){
            var members = ret[group]
            var record = {recid:i,group:group,name:'',desc:'',value:'',w2ui:{children:[]},expanded:true}
            records.push(record)
            recid_to_expand.push(i)
            i += 1
            for (var name in members){
                var child = {recid:i, group:'',name:name,desc:members[name].desc, value:members[name].value}
                if (members[name].attention) child.w2ui = {style:'background-color:red;color:white;'}
                record.w2ui.children.push(child)
                i += 1
            }
        }
        if (w2ui['health-check']) w2ui['health-check'].destroy()
        $().w2grid({ 
            name: 'health-check', 
            columns: [               
                { field: 'group',  caption: 'Group', size: '50' },
                { field: 'name',  caption: 'Name', size: '100' },
                { field: 'value', caption: 'Value', size: '50', attr:'align=right' },
                { field: 'desc',  caption: 'Description', size: '300' },
            ],
            records:records
        })
        //console.log(records)
        w2ui['page'].content('main',w2ui['health-check'])
        _.defer(function(){
            w2ui['health-check'].refresh()
            recid_to_expand.forEach(function(i){
                w2ui['health-check'].expand(i)
            })
        })
    },
    do_purge_username:function(){
        var self = this
        var cmd = this.runner_name+'.root.admin.purge_username'
        w2confirm({
            msg:'<span style="vertical-align:middle;color:red;font-size:50px" class="fa fa-exclamation-triangle">&nbsp;</span> 全部資料都會被清除殆盡，你確定嗎?',
            title:'Please confirm',
            btn_yes:{
                class: 'w2ui-btn-red'
            },
            callBack:function(ans){
                if (ans != 'Yes') return 
                var command = new Command(cmd,[])
                self.sdk.send_command(command).done(function(response){
                    if (response.retcode==0){
                        w2alert('使用者資料'+response.stdout+'筆清除完成,可繼續清除其他資料')
                    }
                    else{
                        w2alert(response.stderr)
                    }
                })
            }
        })
    },    
}
$(function(){
    window.admin = new Admin()
    window.admin.start()
})