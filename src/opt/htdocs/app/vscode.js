function VSCodeCommand(cmd,args){
    this.id = (new Date().getTime()) + Math.random()
    this.cmd = cmd
    this.args = args
}
VSCodeCommand.prototype = {
    get_content:function(){
        return {
            id:this.id,
            cmd:this.cmd,
            args:this.args
        }
    }
}
function VSCodeClient(){
    console.log('create VSCodeClient')
    this.response_queue = {}
}
VSCodeClient.prototype = {
    init:function(){        
        console.log('init of vscode client called')
        this.init_message_handler()
    },
    init_message_handler:function(){
        // Handle the message inside the webview
        var self = this
        window.addEventListener('message', event => {
            var message = event.data; // The JSON data our extension sent
            console.log(message,'<<')
            if (message.response){
                var promise = this.response_queue[message.response.id]
                delete this.response_queue[message.response.id]
                promise.resolve(message.response)
                return
            }
            
            switch (message.cmd) {
                case 'add-text-to-slide':
                    var content = message.args[0]
                    window.presentation_screen.on_paste_string(content)
                    break;

            }
            
        });        
    },
    send_command:function(vs_command_obj){
        var promise = $.Deferred()
        window.parent.postMessage(vs_command_obj.get_content(),'*')
        this.response_queue[vs_command_obj] = promise 
        return promise
    },
    call_when_ready:function(){
        /*
         * called by whiteboard.js when global_config is available and user has login successed (include given correct passcode)
         */
        var self = this
        this.init()
        //collect data send to hosting extension for persistence
        var state = {
            user:{
                username:global_config.user.username,
                name:global_config.user.name//sbs_name
            }
        }
        if (global_config.token){
            //in my own board
            state.token = global_config.token
        }
        this.send_command(new VSCodeCommand('set_state',[state]))
        
        //if user changes name, save it to extension again
        window.presentation_screen.presentation.add_event_listener('NAME-CHANGED',function(new_name){
            state.user.name = new_name
            self.send_command(new VSCodeCommand('set_state',[state]))
        })


        //remove fullscreen feature
        $('#settings-page .do-fullscreen').remove()
    }
}
/*
window.addEventListener('focus',function(){
    console.log('fcus-------------')
})
window.addEventListener('blur',function(){
    console.log('blur-------------')
})
*/