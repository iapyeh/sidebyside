function Studio(){
    this.sdk = null;
    this.data = {}
}
Studio.prototype = {
    init:function(sdk){
        //assert sdk.is_authenticated==true
        var self = this
        sdk.connect().progress(function(state){
            switch(state){
                case 'onopen':
                    self.refresh_projects()
                    break
            }
        })
        
    },
    refresh_projects:function(){
        var self = this
        
        // render
        var render_list = function(){
            var html = []
            for (var name in self.data){
                //content: self.data.projects[name]
                html.push('<li>'+name)
                html.push('<a href="dashboard.html#'+name+'">Dashboard</a>')
                html.push(' <a href="screen.html#'+name+'">Screen</a>')
                html.push(' <a href="remotecontroller.html#'+name+'">Remote Controller</a>')
                html.push('</li>')
            }
            $('#project-list').html(html.join(''))    
        }

        // get data from server
        var command_line = 'root.sidebyside.state'
        sdk.run_command_line(command_line).done(function(response){
            console.log(response)
            self.data = response.stdout
            render_list()
        })
    }
}
$(function(){
    window.sdk = new ObjshSDK({port:2780,ws_port:2781})
    window.studio = new Studio()
    sdk.login().then(function(response){
        //success
        console.log('login success',response)
        window.studio.init(sdk)
    },function(){
        //failure
        location.href = 'login.html'
        //console.log('failure login')
    })
})