/*
 * patching scripts for testing in development stage
 */
var testing = {
    origin_send_command:null,
    sdk: null,
    logs:[],
    recording_start:false,
    playback_running:false,
    mute:false,
    p_id:null, //ss token
    bus_room_id:null,
    init:function(){
        //called when w2ui['toolbar'] is existing
        this.p_id = window.presentation_screen.presentation.p_id
        this.bus_room_id = window.presentation_screen.presentation.bus_room_id
        this.add_testing_buttons()
    },
    playback:function(repeat,idx){        
        if (!this.playback_running) return
        var self = this
        //console.log('playback #',(1+idx),'/',self.logs.length)
        var item = this.logs[idx]
        var command_obj = new Command()
        command_obj.content.cmd = item[0]
        command_obj.content.args = item[1]
        if (!this.sdk) this.sdk = window.sdk  
        this.sdk.send_command.apply(this.sdk,[command_obj])
        // move to next
        setTimeout(function(){
            idx += 1
            if (idx >= self.logs.length) {
                repeat -= 1
                console.log('playback completed, remain ',repeat)
                var bus = self.sdk.bus.room_id
                var report_hash_command = new Command(ObjshSDK.metadata.runner_name+'.root.testing.ask_report_hash',[bus])
                self.sdk.send_command(report_hash_command).done(function(response){
                    if (response.retcode==0){
                        if (repeat){
                            setTimeout(function(){
                                self.playback(repeat,0)
                            },3000)
                        }
                        else{
                            w2ui['toolbar'].enable('testing:recording_playback_start')
                            w2ui['toolbar'].disable('testing:recording_playback_stop')
                            alert('playback completed totally')
                            self.playback_running = false
                            return
                        }        
                    }
                    else{
                        alert(response.stderr)
                    }
                })
            }
            else{
                self.playback(repeat,idx)                    
            }
        },100)
    },
    add_testing_buttons:function(){
        //add buttons to toolbar
        var self = this
        w2ui['toolbar'].insert('title',{
            id:'testing',
            type:'menu',
            text:'Testing',
            items:[
                {'id':'recording_start',text:'Recording Start'},
                {'id':'recording_stop',text:'Recording Stop',disabled:true},
                {text:'-'},
                {'id':'recording_reset',text:'Recording Reset',disabled:true},
                {text:'-'},
                {'id':'recording_playback_start',text:'Recording Start Playback',disabled:true},
                {'id':'recording_playback_stop',text:'Recording Stop Playback',disabled:true},
                {text:'-'},
                {'id':'recording_download',text:'Download Recording',disabled:true},
                {'id':'recording_upload',text:'Upload Recording'},
                {text:'-'},
                {'id':'recording_mute',text:'Mute this board',tooltip:'does not send command'},
                //{'id':'recording_test',text:'test',tooltip:'does not send command'},
            ]
        })
        w2ui['toolbar'].on('click',function(evt){
            switch(evt.target){
                case 'testing:recording_test':
                    console.log(window.presentation_screen.presentation.current_slide)
                    break
                case 'testing:recording_start':
                    self.recording_start = true
                    w2ui['toolbar'].get('testing').text = 'Recording'
                    w2ui['toolbar'].disable('testing:recording_start')
                    w2ui['toolbar'].enable('testing:recording_stop')
                    break
                case 'testing:recording_stop':
                    w2ui['toolbar'].get('testing').text = 'Testing'
                    self.recording_start = false
                    w2ui['toolbar'].enable('testing:recording_start')
                    w2ui['toolbar'].disable('testing:recording_stop')
                    self.on_logs_change()
                    break
                case 'testing:recording_reset':
                    self.logs.splice(0)
                    //same as  recording_stop
                    w2ui['toolbar'].get('testing').text = 'Testing'
                    self.recording_start = false
                    w2ui['toolbar'].enable('testing:recording_start')
                    w2ui['toolbar'].disable('testing:recording_stop')
                    self.on_logs_change()
                    break
                case 'testing:recording_playback_start':
                    self.recording_start = false
                    self.playback_running = true
                    var repeat = parseInt(prompt('how many repeats?',1))
                    var start_from_index = 0
                    w2ui['toolbar'].disable('testing:recording_playback_start')
                    w2ui['toolbar'].enable('testing:recording_playback_stop')
                    self.playback(repeat,start_from_index)
                    break
                case 'testing:recording_playback_stop':
                    w2ui['toolbar'].enable('testing:recording_playback_start')
                    w2ui['toolbar'].disable('testing:recording_playback_stop')
                    self.playback_running = false
                    break
                case 'testing:recording_download':
                    var logs = []
                    _.each(self.logs,function(item){
                        //replace p_id in args
                        // cmd, args = item
                        var _args = []
                        for (var i=0;i<item[1].length;i++){
                            //console.log('>>>',[item[1][i],'>>',self.bus_room_id],'<<<',item[1][i]==self.bus_room_id)
                            if (item[1][i] == self.p_id) _args.push('_P_ID_')
                            else if (item[1][i] == 'R'+self.bus_room_id) _args.push('_BUS_ROOM_ID_')
                            else if (_.isPlainObject(item[1][i])){
                                var _obj = {}
                                for (var key in item[1][i]){
                                    if (item[1][i][key] == self.p_id){
                                        _obj[key] = '_P_ID_'
                                    }
                                    else{
                                        _obj[key] = item[1][i][key]
                                    }
                                }
                                _args.push(_obj)
                            }
                            else{
                                _args.push(item[1][i])
                            }
                        }
                        logs.push([item[0],_args])
                    })
                    //console.log('saveto ',logs)
                    var content = JSON.stringify(logs)
                    var a = document.createElement('a');
                    var blob = new Blob([content], {'type': 'application/json'});
                    a.href = window.URL.createObjectURL(blob);
                    a.download = 'testing_recording.json';
                    a.click();
                    break
                case 'testing:recording_upload':
                    //<input type="file" id="files" name="files[]" multiple />
                    var input = document.createElement('input')
                    input.setAttribute('type','file')
                    input.setAttribute('accept','application/json,*.json')
                    input.onchange = function(evt){
                        var file = evt.target.files[0]; // FileList object
                        var reader = new FileReader();
                        reader.onload =function(e){                            
                            var logs_template = JSON.parse(e.target.result)
                            var logs = []
                            console.log('uploaded',logs_template)
                            _.each(logs_template,function(item){
                                var cmd = item[0]
                                var _args = item[1]
                                var args = []
                                _.each(_args,function(_arg){
                                    if (_arg == '_BUS_ROOM_ID_'){
                                        args.push('R'+self.bus_room_id)
                                    }
                                    else if (_arg == '_P_ID_'){
                                        args.push(self.p_id)
                                    }
                                    else if (_.isPlainObject(_arg)){
                                        var arg = {}
                                        for(var key in _arg){
                                            if (_arg[key] == '_P_ID_'){
                                                arg[key] = self.p_id
                                            }
                                            else if (_arg[key] == '_BUS_ROOM_ID_'){
                                                arg[key] = 'R'+self.bus_room_id
                                            }
                                            else{
                                                arg[key] = _arg[key]
                                            }
                                        }
                                        args.push(arg)
                                    }
                                    else{
                                        args.push(_arg)
                                    }
                                })
                                logs.push([cmd,args])
                            })
                            self.logs = logs
                            console.log('upload parsed',self.logs)
                            self.on_logs_change()
                            //alert('uploaded, command size='+self.logs.length)
                        };
                        reader.readAsText(file);
                    }
                    input.click()
                    break
                case 'testing:recording_mute':
                    self.mute = true
            }
        })
    },
    on_logs_change:function(){
        //update toolbar items
        if (this.logs.length){
            w2ui['toolbar'].enable('testing:recording_playback_start')
            w2ui['toolbar'].get('testing:recording_playback_start').count = this.logs.length
            w2ui['toolbar'].enable('testing:recording_download')
            w2ui['toolbar'].enable('testing:recording_reset')
        }
        else{
            w2ui['toolbar'].disable('testing:recording_playback_start')
            delete w2ui['toolbar'].get('testing:recording_playback_start').count
            w2ui['toolbar'].disable('testing:recording_download')
            w2ui['toolbar'].disable('testing:recording_reset')
        }
        w2ui['toolbar'].refresh()
    },
    install:function(){
        this.origin_send_command = ObjshSDK.prototype.send_command 
        var self = this
        
        ObjshSDK.prototype.send_command = function(command_obj){
            //console.log('sending command',command_obj)
            if (self.mute){
                console.warn('this board has been muted, command not sent',command_obj)
                return
            }
            else if (self.recording_start) {
                if (!self.sdk) self.sdk = this
                self.logs.push([_.clone(command_obj.content.cmd), _.clone(command_obj.content.args)])
                self.on_logs_change()
            }
            return self.origin_send_command.apply(this,[command_obj])
        }        
        var checking_toolbar = function(){
            if (w2ui['toolbar']) {
                //do initialization of whiteboard-testing
                self.init()
            }
            else setTimeout(function(){checking_toolbar()},1000)
        }
        _.delay(function(){
            checking_toolbar()
        },1000)    
    }
}
window.addEventListener('DOMContentLoaded',function(){
    testing.install()
    //add buttons to toolbar
})
