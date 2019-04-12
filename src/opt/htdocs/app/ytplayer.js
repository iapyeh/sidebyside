/*
 * API: https://developers.google.com/youtube/iframe_api_reference
 */
function YoutubePlayerController(){
    this.api_ready = false
    this.player = null
}
YoutubePlayerController.prototype = {
    inject_api:function(){
        // <script src="https://www.youtube.com/iframe_api"></script>
        if (this.api_ready) return $.when()
        var self = this
        var promise = new $.Deferred()
        console.log('f83280347237423')
        window.onYouTubeIframeAPIReady = function(evt){
            
            self.api_ready = true
            delete window.onYouTubeIframeAPIReady
            promise.resolve()
        }
        var s = document.createElement('script')
        s.src = 'https://www.youtube.com/iframe_api'
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(s, firstScriptTag);        
        return promise
    },
    create_player:function(panel_name,options){
        // options:{
        //     videId:
        //     width:
        //     height:   
        // }
        
        //remove existing player
        if (document.getElementById('ytplayer')){
            document.getElementById('ytplayer').parentNode.removeChild(document.getElementById('ytplayer'))
        }
        var d = document.createElement('div')
        d.setAttribute('id','ytplayer')
        d.className = 'studio-fit-box'
        var self = this
        w2ui['layout'].content(panel_name,d.outerHTML)
        var promise = new $.Deferred()
        setTimeout(function(){
            window.player = new YT.Player('ytplayer', {
                videoId: options.videoId,
                height: options.height,
                width: options.width,
                events: {
                    'onReady':function(event){
                        console.log('vvvv ready')
                        event.target.playVideo();
                    },
                    'onStateChange': function(event) {
                        console.log('hello!',event);
                        if (event.data == YT.PlayerState.PLAYING) {                    
                        //player.stopVideo();
                        }
                    }
                }
            });
            promise.resolve()
        },1000)
        return promise
    }
}
/*
    //Usage example
    
    var ele = w2ui['layout'].el('main')
    if (!ele) ele = $('#layout_layout_panel_main > div.w2ui-panel-content')[0]
    var iframe = ele.querySelector('iframe')
    console.log('iframe---------',iframe.src)
    if (iframe && iframe.src.indexOf('https://www.youtube.com/embed/')==0){                        
        //https://www.youtube.com/embed/jJMQjbTmIkg
        var videoId = iframe.src.split('/').pop()
        w2ui['layout'].content('main','')
        var rect = iframe.getBoundingClientRect()
        if (!self.youtube_player_controller) {
            self.youtube_player_controller = new YoutubePlayerController()
            self.youtube_player_controller.inject_api().done(function(){
                self.youtube_player_controller.create_player('main',{
                    videoId: videoId,
                    width:rect.width || 560,
                    height:rect.height || 315
                }).done(function(){
                    fitting()
                })
                
            })
        }
        else{
            self.youtube_player_controller.create_player('main',{
                videoId: videoId,
                width:rect.width || 560,
                height:rect.height || 315
            }).done(function(){
                fitting()
            })
        }
    }
*/