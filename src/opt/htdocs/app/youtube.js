/*
 * API: https://developers.google.com/youtube/iframe_api_reference
 * API: https://developers.facebook.com/docs/plugins/embedded-video-player/api?locale=zh_TW
 * 用於顯示Youtube影片跟管理; 本檔案也是Webcam control所在
 Dependencey: jquery.js
 */
function YoutubePlayer() {
    if (YoutubePlayer.singleton) throw "YoutubePlayer.singleton existed, plase use YoutubePlayer.singleton"
    YoutubePlayer.singleton = this
    this.api_ready = false
    this.api_ready_listeners = []
    var self = this
    window.onYouTubeIframeAPIReady = function (evt) {
        self.api_ready_listeners.forEach(function(item){
            self._create_player.apply(self,item)//item=(options, callback)
        })
        self.api_ready = true
        window.onYouTubeIframeAPIReady = undefined
    }
}

//YoutubePlayer 是factory性質，所以透過singleton使用，
//跟webcamplayer不一樣，webcam player不是factory，是一般class
//其性質類似於 YoutubePlayer產生的player
YoutubePlayer.singleton = null
YoutubePlayer.counter = 0
YoutubePlayer.prototype = {
    _inject_api: function (options, callback) {
        /* 第一次呼叫時載入api,此後等api ready之後再呼叫 this._create_player */
        var self = this
        if (document.getElementById('youtubeiframapi')) {
            if (this.api_ready) {
                //密集load兩個video時，必須分開一下
                _.defer(function(){self._create_player(options, callback)})
            }
            else {
                this.api_ready_listeners.push([options, callback])
            }
        }
        else {
            this.api_ready_listeners.push([options, callback])
            var s = document.createElement('script')
            s.setAttribute('id', 'youtubeiframapi')
            s.src = '//www.youtube.com/iframe_api'
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(s, firstScriptTag);
        }
    }
    , _create_player: function (options, callback) {
        var self = this
        var events = {
            options: options,
            callback: callback,
            player: null,
            onReady: function (evt) {
                //此函式會在每次video loaded完成時被呼叫。
                //而且 yt player會觀察DOM，如果append到新的node，video 會再被load一次。
                //（這也可能是iframe的行為）
                var player = this.player
                var callback = this.callback
                var options = this.options
                var current_time = player.getCurrentTime()
                var target_current_time = options.player_time ? Math.floor(options.player_time) : 0
                if (target_current_time != current_time){
                    player.playVideo()
                    // Youtube有時會非常慢，loading一直轉，先play 1秒
                    _.delay(function(){
                        player.pauseVideo()
                        player.seekTo(target_current_time)
                        self.post_loaded(player, options, function () {
                            callback(true, player)
                        })    
                    },1000)
                }
                else{
                    self.post_loaded(player, options, function () {
                        callback(true, player)
                    })    
                }
            },
            onError: function (err) {
                console.log('Error on create youtube player')
                console.warn('Error code:#'+err.data)
                this.callback(false, 'Youtube API Error:#'+err.data)
            },
            onStateChange: function (evt) {
                //var player = this.player
                // player state changing is called by presentation.js not by user's interaction
                // (syncing to remote or at intial loading)
                //   -1 (unstarted) 
                //    0 (ended) YT.PlayerState.ENDED
                //    1 (playing) YT.PlayerState.PLAYING
                //    2 (paused) YT.PlayerState.PAUSED
                //    3 (buffering) YT.PlayerState.BUFFERING
                //    5 (video cued). YT.PlayerState.CUED
                var video_state = evt.data
                options.on_state_changed(video_state)
            }
        }
        events.onReady = events.onReady.bind(events)
        events.onError = events.onError.bind(events)
        events.onStateChange = events.onStateChange.bind(events)
        var player = new YT.Player(options.player_id, {
            playerVars: {
                autoplay: 0,
                rel: 0,
                //showinfo:1, default
                controls: 1,
                enablejsapi: 1,
                start: options.player_time ? Math.floor(options.player_time) : 0
            },
            videoId: options.video_id,
            events: events
        });
        events.player = player
    }
    , pre_render: function (options) {
        /*
         call this to get "content" to insert into DOM and player_id to call this.start()
        */
        var player_id = 'ytplayer' + YoutubePlayer.counter
        var content = '<div id="' + player_id + '" class="' + (options ? (options.class || '') : '') + '"></div>'
        YoutubePlayer.counter += 1
        return {
            content: content,
            player_id: player_id
        }
    }
    ,post_loaded : function (player, options, callback) {
        player.mute()
        player.playVideo()
        //this is at inital stage of player.
        //so apply extra to restore video state
        setTimeout(function () {
            if (options.video_state == 1) {
                //initially, the video is playing, so we have completed the video creatation job
                setTimeout(function () {
                    //callback(true, player)
                    callback()
                })
            }
            else {
                /*
                * there might be a bug in youtube's api.
                * player should be played before calling seek.
                * so, the initial state is not playing,
                * let it playing for 1 seconds before calling seek
                */
                setTimeout(function () {
                    try {
                        player.pauseVideo()
                    }
                    catch (e) {
                        //有時候slide切換太快會導致 The YouTube player is not attached to the DOM. 的錯誤 
                        //若是這樣，就放棄不繼續以下的seek了
                        callback()
                        return
                    }
                    //delay a second to prevent state change was synced to remove
                    setTimeout(function () {
                        if (options.player_time != player.getCurrentTime()) player.seekTo(options.player_time)
                        callback()
                    }, 1000)
                }, 1000)//should at least 1second
            }
        }, 10)
    }    
    ,start: function (options, callback) {
        /*
        options = {
            player_id: got by call this.pre_render() s
            video_id:  //video to play
            video_state: 1 or 2 //initial state (playing , paused)
            player_time: 0 //initial position
            on_state_changed:(callback function(video_state))
        }
        callback: callback(true,player) or callback(false, error)
        Return:
            content
        */
        return this._inject_api(options, callback)
    }
}

function WebcamPlayer(box) {
    this.video = null
    this.box = box
    this.ele = box.querySelector('.webcam-player')
    if (this.ele) {
        //clone
        this.video = this.ele.querySelector('video')
    }
    else {
        this.ele = document.createElement('div')
        this.ele.classList.add('webcam-player')
        this.ele.style.overflow = 'hidden'
        this.video = document.createElement('video')
        this.video.style.width = '100%'
        this.video.style.height = '100%'
        this.ele.appendChild(this.video)
        this.box.appendChild(this.ele)
    }
    this.video_settings = null
    // 確認使用者有攝影機可以用（也可能因安全理由被擋住）；這不是最後結果，還要看create video是否成功
    this.available = navigator.mediaDevices
}
WebcamPlayer.prototype = {
    create_video: function () {
        var self = this
        var promise = new $.Deferred()
        // create camera object and handles resizing
        var resolutions = [
            { width: { min: 2048 }, height: { min: 1536 } },
            { width: { min: 1024 }, height: { min: 768 } },
            { width: { min: 640 }, height: { min: 480 } }
        ]
        // figure out the max available resolution 
        var resolution_idx = 0
        var constraints = {
            audio: false,
            video: true,
            frameRate: { min: 5, max: 8 },
            facingMode: { exact: "environment" },
            video: resolutions[resolution_idx]
        };
        var request_video = function () {
            var handleSuccess = function (stream) {
                self.video.srcObject = stream;
                //video_settings = {aspectRatio: 1.3333333333333333, 
                //    deviceId: "71123ab8350b500614e1a8a24ad3ef118bc7b756b6f28dd28dd925470f4da166",
                //    frameRate: 30.000030517578125, 
                //    groupId: "cedf3af4577de671565035453a10498e02e17c168bd7c7cbb9e9237b1e395367", 
                //    height: 480, …}
                self.video_settings = stream.getVideoTracks()[0].getSettings()
                promise.resolve(true)
            }
            var handleError = function (error) {
                if (resolution_idx < resolutions.length - 1) {
                    //try next constrain
                    resolution_idx += 1
                    constraints.video = resolutions[resolution_idx]
                    request_video()
                }
                else {
                    self.available = false
                    promise.reject(error)
                    console.log('navigator.getUserMedia error: ' + error);
                }
            }
            if (navigator.mediaDevices) {
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(handleSuccess)
                    .catch(handleError);
            
            }else{
                promise.reject('No webcam available (security reason)')
                self.available = false
            }
        }
        this.video.onloadedmetadata = function () {
            //setTimeout(function(){take_snapshot()},100)
        }
        request_video()
        return promise
    }
    , take_snapshot: function () {
        var canvas = document.createElement('canvas')
        var rect = this.video.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        //canvas.className = 'invert' //add filter here
        canvas.getContext('2d').drawImage(this.video, 0, 0, canvas.width, canvas.height);
        var promise = new $.Deferred()
        //var data = canvas.toDataURL('image/jpeg')
        canvas.toBlob(function (blob) {
            //add timestamp to name if there is no sutff like it in file name
            var name = Math.round(new Date().getTime() / 1000) + '.webcam.jpg'
            var file = new File([blob], name, { type: 'image/jpeg' })
            promise.resolve({
                file: file,
                is_file: true,
                is_directory: false,
                mimetype: file.type,
                name: name
            })
        }, "image/jpeg", 1.0);
        return promise
    }
    , destroy: function () {
        this.video.pause()
        if (this.video.srcObject) {
            this.video.srcObject.getTracks()[0].stop()
            this.video.srcObject = null
        }
        this.video = null
        this.box.removeChild(this.ele)

    }
    /* 以下三個盡量跟youtube api 一樣*/
    , playVideo: function () {
        if (this.video.srcObject) {
            this.video.play()
            return $.when(true)
        }
        else {
            var promise = new $.Deferred()
            var self = this
            this.create_video().done(function () {
                self.video.play()
                promise.resolve(true)
            }).fail(function(err_message){
                promise.reject(err_message)
            })
            return promise
        }
    }
    , pauseVideo: function () {
        if (this.video) this.video.pause()
    }
    , getPlayerState: function () {
        //2: paused, 1:playing
        if (this.video) return this.video.paused ? 2 : 1
        return -1
    }
}

function FacebookPlayer() {
    if (FacebookPlayer.singleton) throw "FacebookPlayer.singleton existed, plase use FacebookPlayer.singleton"
    FacebookPlayer.singleton = this
    this.api_ready = false
    this.api_ready_listeners = []
    var self = this
    this.api = null 
    window.fbAsyncInit = function() {
        self.api_ready_listeners.forEach(function(item){
            self._create_player.apply(self,item)//item=(options, callback)
        })
        self.api_ready = true
        window.fbAsyncInit = undefined
  };   
}

//FacebookPlayer 是factory性質，所以透過singleton使用，
//跟webcamplayer不一樣，webcam player不是factory，是一般class
//其性質類似於 FacebookPlayer產生的player
FacebookPlayer.singleton = null
FacebookPlayer.counter = 0

FacebookPlayer.prototype = {
    _inject_api: function (options, callback) {
        /* 第一次呼叫時載入api,此後等api ready之後再呼叫 this._create_player */
        var self = this
        if (document.getElementById('facebook-jssdk')) {
            if (this.api_ready) {
                //密集load兩個video時，必須分開一下
                _.defer(function(){self._create_player(options, callback)})
            }
            else {
                this.api_ready_listeners.push([options, callback])
            }
        }
        else {
            this.api_ready_listeners.push([options, callback])
            var s = document.createElement('script')
            s.setAttribute('id', 'facebook-jssdk')
            s.src = 'https://connect.facebook.net/en_US/sdk.js'
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(s, firstScriptTag);
        }
    }
    , _create_player: function (options, callback) {

        // Get Embedded Video Player API Instance
        // FB的API必須每次呼叫init，才能得到player，所以必須每次subscribe跟unsubscribe
        FB.init({
            appId      : '2673744362641355',
            xfbml      : true,
            version    : 'v3.2'
        });
        FB.Event.subscribe('xfbml.ready', function ready_handler(msg) {
            FB.Event.unsubscribe('xfbml.ready', ready_handler)
            if (msg.type === 'video') {
                //wrap the facebook video api to youtube api
                var PlayerWrapper = function(fbplayer,options){
                    this.player = fbplayer
                    this.options = _.clone(options)
                    this.state = 2 //stopped
                    var self = this
                    this.player.subscribe('startedPlaying',function(e){
                        self.state = 1
                        if (self.options.on_state_changed) self.options.on_state_changed(self.state)
                    })
                    this.player.subscribe('paused',function(e){
                        self.state = 2
                        if (self.options.on_state_changed) self.options.on_state_changed(self.state)
                    })
                    this.player.subscribe('finishedPlaying',function(e){
                        self.state = 0
                        if (self.options.on_state_changed) self.options.on_state_changed(self.state)
                    })
                    
                    if (options.player_time) this.seekTo(options.player_time)
                    if (options.video_state == 1) this.playVideo()
                }
                PlayerWrapper.prototype = {
                    getCurrentTime:function(){
                        return this.player.getCurrentPosition()
                    }
                    , seekTo:function(t){
                        this.player.seek(t)
                    }
                    , playVideo:function(){
                        this.player.play()
                    }
                    , pauseVideo:function(){
                        this.player.pause()
                    }
                    , getPlayerState:function(){
                        return this.state
                    }
                    , loadVideoById:function(video_id){
                        //FB 的API 目前不知道或無法更換已經下載的影片，這功能沒用處
                        var href='https://www.facebook.com/facebook/videos/' +video_id + '/'
                        var ele = document.getElementById(this.options.player_id)
                        ele.dataset.href = href
                    }
                    , mute:function(){
                        this.player.mute()
                    }
                    ,destroy:function(){
                        //do nothing
                    }
                }
                callback(true, new PlayerWrapper(msg.instance, options))
            }
        });        
    }
    , pre_render: function (options) {
        /*
         call this to get "content" to insert into DOM and player_id to call this.start()
        */
        var player_id = 'fbplayer' + FacebookPlayer.counter
        var content = '<div id="' + player_id + '" class="fb-video'+ (options && options.class ? ' '+options.class : '') +'" data-href="https://www.facebook.com/facebook/videos/' + options.video_id + '/" data-allowfullscreen="false"></div>'
        FacebookPlayer.counter += 1
        return {
            content: content,
            player_id: player_id
        }        
    }
    ,post_loaded : function (player, options, callback) {
        player.mute()
        player.playVideo()
        //this is at inital stage of player.
        //so apply extra to restore video state
        setTimeout(function () {
            if (options.video_state == 1) {
                //initially, the video is playing, so we have completed the video creatation job
                setTimeout(function () {
                    //callback(true, player)
                    callback()
                })
            }
            else {
                //delay a second to prevent state change was synced to remove
                setTimeout(function () {
                    if (options.player_time != player.getCurrentTime()) player.seekTo(options.player_time)
                    callback()
                }, 1000)
            }
        }, 10)
    }    
    , start: function (options, callback) {
        /*
        options = {
            player_id: got by call this.pre_render() s
            video_id:  //video to play
            video_state: 1 or 2 //initial state (playing , paused)
            player_time: 0 //initial position
            on_state_changed:(callback function(video_state))
        }
        callback: callback(true,player) or callback(false, error)
        Return:
            content
        */
        return this._inject_api(options, callback)
    }
}
