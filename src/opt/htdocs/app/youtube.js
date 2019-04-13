/*
 * API: https://developers.google.com/youtube/iframe_api_reference
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
        delete window.onYouTubeIframeAPIReady
    }
}

//YoutubePlayer 是factory性質，所以透過singleton使用，
//跟webcamplayer不一樣，webcam player不是factory，是一般class
//其性質類似於 YoutubePlayer產生的player
YoutubePlayer.singleton = null
YoutubePlayer.counter = 0
YoutubePlayer.post_loaded = function (player, options, callback) {
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

YoutubePlayer.prototype = {
    _inject_api: function (options, callback) {
        /* 第一次呼叫時載入api,此後等api ready之後再呼叫 this._create_player */
        var self = this
        if (document.getElementById('youtubeiframapi')) {
            if (this.api_ready) this._create_player(options, callback)
            else this.api_ready_listeners.push([options, callback])
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
                //default to be muted
                YoutubePlayer.post_loaded(player, options, function () {
                    callback(true, player)
                })
            },
            onError: function (err) {
                console.log('Error on create youtube player')
                console.warn(err)
                this.callback(false, err)
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
        player = new YT.Player(options.player_id, {
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
    },
    start: function (options, callback) {
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
        //this.ele.style.width = '100%'
        //this.ele.style.height = '100%'
        this.ele.style.overflow = 'hidden'
        this.video = document.createElement('video')
        //this.video.class,'webcam'+Math.round(Math.random()*1000)
        this.video.style.width = '100%'
        this.video.style.height = '100%'
        //this.video.setAttribute('autoplay','1')
        this.ele.appendChild(this.video)
        this.box.appendChild(this.ele)
    }
    this.video_settings = null
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
                    promise.reject(error)
                    console.log('navigator.getUserMedia error: ' + error);
                }
            }
            navigator.mediaDevices.getUserMedia(constraints).
                then(handleSuccess).catch(handleError);
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