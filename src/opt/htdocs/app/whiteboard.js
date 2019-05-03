
/*utility to copy to clipboard*/
function fallbackCopyTextToClipboard(text, callback) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'Copy is not supported by this device';
        callback(successful, msg)
    } catch (err) {
        callback(false, err)
    }
    document.body.removeChild(textArea);
}
function copyTextToClipboard(text, callback) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text, callback);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        callback(true)
    }, function (err) {
        callback(false, err)
    });
}
/*end of utility to copy to clipboard*/
function dataURLtoFile(dataurl,filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    var blob = new Blob([u8arr]);
    return new File([blob], filename,{type:mime})
}
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

//備份用途的上傳
function backup_resizeAndRotateImage(inImageSource, inMaxLength, inSuccessCallback) {
    inSuccessCallback(null) //will use original file
}
// 暫時取消
function resizeAndRotateImage(inImageSource, inMaxLength, inSuccessCallback) {
    //depends on exif.js
    //borrowed from https://dotblogs.com.tw/lapland/2015/09/25/153444
    var reader = new FileReader();
    reader.readAsDataURL(inImageSource);
    reader.onload = function (e) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext("2d");
        var img = new Image();
        img.onload = function () {
            //設定長邊上限值
            var max_Length = inMaxLength;

            var imgWidth = img.width;
            var imgHeight = img.height;

            var do_resize = false
            var do_rotate = false
            if (imgWidth > imgHeight) {
                if (imgWidth > max_Length) {
                    imgHeight = Math.round(imgHeight *= max_Length / imgWidth);
                    imgWidth = max_Length;
                    do_resize = true
                }
            } else {
                if (imgHeight > max_Length) {
                    imgWidth = Math.round(imgWidth *= max_Length / imgHeight);
                    imgHeight = max_Length;
                    do_resize = true
                }
            }

            canvas.width = imgWidth;
            canvas.height = imgHeight;

            var that = this;
            EXIF.getData(img, function () {
                var orientation = EXIF.getTag(that, 'Orientation');
                //console.log(orientation,'<<<orientation');
                if (orientation == 6 || orientation == 8 || orientation == 3) {
                    var rotateAngle = 0;

                    switch (orientation) {
                        case 3:
                            rotateAngle = 180;
                            break;
                        case 6:
                            rotateAngle = 90;
                            canvas.width = imgHeight;
                            canvas.height = imgWidth;
                            break;
                        case 8:
                            rotateAngle = -90;
                            canvas.width = imgHeight;
                            canvas.height = imgWidth;
                            break;
                    }
                    do_rotate = rotateAngle !== 0
                }
                if (do_resize || do_rotate) {
                    if (do_rotate) {
                        var x = canvas.width / 2;
                        var y = canvas.height / 2;
                        ctx.translate(x, y);
                        ctx.rotate(rotateAngle * Math.PI / 180);
                        ctx.drawImage(img, (-imgWidth / 2), (-imgHeight / 2), imgWidth, imgHeight);
                    }
                    else {
                        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
                    }
                    canvas.toBlob(function (res) {
                        inSuccessCallback(res);
                    }, "image/jpeg", 1.0);
                }
                else {
                    //ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
                    inSuccessCallback(null);
                }
            });

        };
        img.src = e.target.result;
    };
}

function ResourceFactory() {
    //make metadata for creating slide resource by given string
}
ResourceFactory.prototype = {
    from_string: function (text) {
        /*
         Returns:
            * {} for not suported resource
            * {
                type: enum of ['TEXT','URL','FILE','VIDEO','OP']
                kind: usually is content-type or defined by "type"
                <other>: defined by "type" (ex. 'YT' for 'VIDEO')
              }
        */
        var self = this
        //ask helper functions who can handle this text
        var filters = [this.imgdata, this.yt, this.fb, this.op, this.url]
        var promise = new $.Deferred()
        var check_flow = function (index) {
            if (index == filters.length) {
                //default type
                promise.resolve({
                    type: 'TEXT',
                    content: text
                })
                return
            }
            var func = filters[index]
            var ret = func.call(self, text)
            if (ret.done) {
                //a promise returned
                ret.done(function (p_ret) {
                    if (p_ret.type) {
                        //accepted by some filter
                        promise.resolve(p_ret)
                    }
                    else {
                        //check next filter
                        check_flow(index + 1)
                    }
                })
            }
            else if (ret.type) {
                //accepted by some filter
                promise.resolve(ret)
            }
            else {
                //check next filter
                check_flow(index + 1)
            }
        }
        check_flow(0)
        return promise
    },
    imgdata: function (text) {
        //data:image/gif;
        var m = text.match(/^data\:image\/(.+?);/)
        if (m) {
            var ext = m[1]

            // only some types are supported
            var allowed_exts = ['gif','jpeg','png','svg']
            if (allowed_exts.indexOf(ext) == -1) return {}

            var slide_resource = {
                type: 'FILE',
                kind: 'image/'+ext,
                file:dataURLtoFile(text,'image.'+ext)
            }
            return slide_resource
        }
        return {}
    },
    url: function (text) {
        /*
        https://docs.google.com/presentation/d/1VKB9tKinLdU43gTEEeg6JR7BPBq_Zsfzph4NK1o51J4/edit#slide=id.p
        https://drive.google.com/file/d/1hcjUj-epfdi-EkU6bOk3hIx2g_qREnyn/view?usp=sharing
        https://drive.google.com/drive/u/0/folders/14g2boak5klcqEmi-4U6uyu21Z2_oAcbz
        */

        var get_conent_type = function (url) {
            var xhttp = new XMLHttpRequest();
            xhttp.open('HEAD', url);
            var url_promise = new $.Deferred()
            xhttp.onreadystatechange = function () {
                if (this.readyState == this.DONE) {
                    if (this.status == 200) {
                        url_promise.resolve(this.getResponseHeader("Content-Type"));
                    }
                    else {
                        //Ask server
                        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.get_content_type'
                        var cookie = ''
                        var command = new Command(cmd, [url,cookie])
                        window.sdk.send_command(command).done(function (response) {
                            console.log('response=',response)
                            if (response.retcode) {
                                url_promise.resolve(response.stderr)
                            }
                            else{
                                // content_type is response.stdout
                                url_promise.resolve(response.stdout)
                            }

                        })
                    }
                }
            };
            xhttp.send();
            return url_promise
        }

        var pat = /^https?:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]|[^\x00-\x7F]){2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]|[^\x00-\x7F])*/
        var m = text.match(pat)
        if (m) {
            var url = m[0]
            var promise2 = new $.Deferred()
            get_conent_type(url).done(function (content_type) {
                var slide_resource = {}
                slide_resource.type = 'URL'
                console.log('content-type',content_type)
                if (content_type) slide_resource.kind = content_type
                slide_resource.url = url
                promise2.resolve(slide_resource)
            })
            return promise2
        }
        else {
            return {}
        }
    },
    op: function (text) {
        /* Google Slides published presentation */
        //https://docs.google.com/presentation/d/e/2PACX-1vRDf1GKNjh6J6xcZF_Cqb3SiHdh2eL0wGbYkhKxEp97cLspWmPlnp5qKQhOYKa_t8P27I3qjiie0Wxh/embed
        // https://docs.google.com/presentation/d/e/2PACX-1vRDf1GKNjh6J6xcZF_Cqb3SiHdh2eL0wGbYkhKxEp97cLspWmPlnp5qKQhOYKa_t8P27I3qjiie0Wxh/pub?start=false&loop=false&delayms=3000

        //<iframe src="https://docs.google.com/presentation/d/e/2PACX-1vRbneuUjEcUVfYagbUFrw4Q-6Xkmgkan3hulIYqhU6oJ_dOKiVaFy2KEiCg7r3tD7_rkT7-0Trcp1z_/embed?start=false&loop=false&delayms=3000" frameborder="0" width="960" height="569" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
        //             https://docs.google.com/presentation/d/e/2PACX-1vRbneuUjEcUVfYagbUFrw4Q-6Xkmgkan3hulIYqhU6oJ_dOKiVaFy2KEiCg7r3tD7_rkT7-0Trcp1z_/pub?start=false&loop=false&delayms=3000
        var gs_pat = /(src=")?(https:\/\/docs\.google\.com\/presentation\/.+)\/(embed|pub).*?"?/
        var m = text.match(gs_pat)
        var slide_resource = {}
        if (m) {
            slide_resource.type = 'OP'  //online presentation
            slide_resource.kind = 'GS' //subtype
            slide_resource.url = m[2] + '/embed'
            slide_resource.extra = [1]//page_no
        }
        return slide_resource
    },
    yt: function (text) {
        /*
            search url which is supported to create a slide
            returns a slide_resource, which is {} if url not found or
            the returned data will be accessed by slide.resource
            1. https://www.youtube.com/watch?v=MKWWhf8RAV8
            2. https://youtu.be/U0cJLHF3g8g?t=24s
            3. <iframe width="560" height="315" src="https://www.youtube.com/embed/DJsGqx0LykY?rel=0&amp;controls=0&amp;showinfo=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            4. <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/DJsGqx0LykY?start=600" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
        */

        var slide_resource = {}

        if (!(/^http/.test(text) || /^<iframe/.test(text))) return slide_resource

        //length limit for cheep security
        var pat_youtube = /^https:\/\/www\.youtube\.com\/watch\?v=([\w\-]{11,})(\&?.{0,40})/
        var pat_youtube_share = /^https:\/\/youtu\.be\/([\w\-]{11,})(\??.{0,40})/
        var pat_youtube_embed = /src="https:\/\/www\.youtube\.com\/embed\/([\w\-]{11,})([^"]{0,60})"/
        var pat_youtube_embed_nocookie = /src="https:\/\/www\.youtube\-nocookie\.com\/embed\/([\w\-]{11,})([^"]{0,60})"/
        var pats = [pat_youtube, pat_youtube_share, pat_youtube_embed, pat_youtube_embed_nocookie]
        var pat_time1 = /[&\?]?t\=(\d+h)?(\d+?m)?(\d+s)?/
        var pat_time2 = /[&\?]?start\=(\d+)/

        _.some(pats, function (pat) {
            var m = text.match(pat)
            if (!m) return
            slide_resource.type = 'VIDEO'
            var v_id = m[1]
            var player_time = 0
            //find time
            if (pat_time2.test(m[2])) { //must before pat_time1
                var mt = m[2].match(pat_time2)
                player_time = parseInt(mt[1])
            }
            else if (pat_time1.test(m[2])) {
                var mt = m[2].match(pat_time1)
                player_time = parseInt(mt[1] ? mt[1].substring(0, mt[1].length - 1) : 0) * 3600 + parseInt(mt[2] ? mt[2].substring(0, mt[2].length - 1) : 0) * 60 + parseInt(mt[3] ? mt[3].substring(0, mt[3].length - 1) : 0)
            }
            slide_resource.kind = 'YT' //youtube
            slide_resource.vid = v_id
            slide_resource.extra = [0, player_time, 0] //[state, player_time (mutable part), current_time]
            return true
        })
        return slide_resource
    }
    , fb: function (text) {
        /*
            the returned data will be accessed by slide.resource
            1. https://www.facebook.com/FunnyVideosdailyupload/videos/835177126838640/
            2. https://www.facebook.com/suntory.wellness/videos/788890374803551/?t=0
        */

        var slide_resource = {}

        if (!(/^http/.test(text))) return slide_resource

        //length limit for cheep security
        var pat_fbt = /^https:\/\/www\.facebook\.com\/.+\/videos\/(\d{11,})\/\?t=(\d+)/
        var pat_fb = /^https:\/\/www\.facebook\.com\/.+\/videos\/(\d{11,})\/?/
        var pats = [pat_fbt,pat_fb]

        _.some(pats, function (pat) {
            var m = text.match(pat)
            if (!m) return
            slide_resource.type = 'VIDEO'
            var v_id = m[1]
            slide_resource.kind = 'FB' //facebook
            slide_resource.vid = v_id
            var player_time = m[2] || 0
            slide_resource.extra = [0, player_time , 0] //[state, player_time (mutable part), current_time]
            return true
        })
        return slide_resource
    }
}
window.slide_resource_factory = new ResourceFactory()

function DisplayArea(presentation_screen, name) {
    /*
     * Display is used to display content of a layout area
     */
    this.presentation_screen = presentation_screen
    this.page_ele = presentation_screen.page_ele
    this.screen_ele = presentation_screen.screen_ele
    //this.thread = thread
    this.name = name //"type" of w2layout, such as "main","left"

    this.slide = null
}
DisplayArea.prototype = {
    set_slide: function (slide, transition) {
        var self = this
        this.slide = slide
        var promise = new $.Deferred()
        this.refresh(transition).done(function () {
            //2019-03-12T06:43:32+00:00 基本上已經不打算使用w2layout，暫時維持共存的方式
            var ele = w2ui['layout'] ? $('#layout_layout_panel_main > div.w2ui-panel-content')[0] : $('#page')[0]
            var ele_to_load = ele.querySelectorAll('img')
            if (ele_to_load.length == 0) {
                // since there is no image, lets do content_fitting immediately
                self.content_fitting()
                promise.resolve()
            }
            else {
                /*
                注意：目前的實作是放到background去，所以不會有<img> ，這段程式不會被執行
                */
                // do content_fitting(adjust height and width) after all images have loaded
                var _counter = 0
                var plus_counter = function () {
                    _counter += 1
                    if (_counter == ele_to_load.length) {
                        self.content_fitting()
                        promise.resolve()
                    }
                }
                _.each(ele_to_load, function (ele) {
                    if (ele.complete) plus_counter() //in cache
                    else ele.onload = plus_counter //reloading
                })
            }
        })
        return promise
    },
    content: function (html, not_fit, transition) {
        /*
         * not_fit: if true, don't call this.content_fitting()
         */
        // don't do animation in dashboard's embedded scren
        if (this.presentation_screen.presentation.isolated) transition = undefined

        //temporary disable transition because it seems unreliable
        document.querySelector('.slide-content').innerHTML = html
        return $.when()
    },
    _preload: function (resouce_type, url) {
        //helper function for refresh
        //to commit transition after resource has loaded
        //to smooth animation
        var promise = new $.Deferred()
        switch (resouce_type) { // see refresh() for keywords of resource_type
            case 'IMG':
                var img = document.createElement('img')
                img.onload = function () {
                    promise.resolve({ width: this.width, height: this.height })
                }
                img.src = url
                break
            default:
                console.warn('preloading of ' + resouce_type + ' is not supported')
                return $.when()
        }
        return promise
    },
    refresh: function (transition) {
        var self = this
        if (!this.slide) {
            this.content('Blank Slide', undefined, 'pop-in')
            $('#toolbar')[0].style.display = 'none'
            return $.when()
        }

        //先reset一番
        $('#toolbar')[0].style.display = ''
        w2ui['toolbar'].hide('background-play')

        var content = '<img src="/404.png" style="width:250px"/>';
        //var html
        //window.message(this.source_item.title+':'+url,true)
        var resource = this.slide.resource
        //console.log(resource)
        //should be resolved after content of resource(ex image) has been loaded
        var preload_promise;
        //will be resolved after html of resource has rendered into DOM
        var content_completion_promise
        //should be resolevd when this routine has completed rendering
        var final_completion_promise;
        //update toolbar items' disabled property
        var disabled_toolbar_items = {
            'zoomout': true,
            'textmenu': true,
        }
        switch (resource.type) {
            case 'BLANK': //whiteboard slide
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()
                self.presentation_screen.overlay.image_mode = true
                self.presentation_screen.overlay.draw.size(self.presentation_screen.overlay.width, self.presentation_screen.overlay.height)
                if (resource.bg) {
                    disabled_toolbar_items['zoomout'] = false
                    var url = effective_url = this.slide.url

                    //enforce background image to reload by adding timestamp to url if necessary
                    var current_slide_bg = self.presentation_screen.screen_frame_ele.querySelector('.slide-bg')
                    if (current_slide_bg){
                        var bg_url = current_slide_bg.style.backgroundImage
                        var m = bg_url ? bg_url.match(/^url\("?(.+?)"?\)/) : null
                        if (m && m[1].replace(/[\?&]____=\d+$/,'') == url){
                            var ts = Math.round(new Date().getTime())
                            if (url.indexOf('?') >= 0) effective_url += '&____=' + ts
                            else effective_url += '?____=' + ts
                        }
                    }

                    content = '<div class="slide-bg studio-fit-box" style="background-image:url(' + effective_url + ')"></div>'
                    //content = '<div class="slide-bg studio-full-box" style="background-image:url(' + url + ')"></div>'
                    preload_promise = this._preload('IMG', effective_url)
                    var image_size;
                    preload_promise.done(function (size) {
                        image_size = size
                    })
                    content_completion_promise.done(function () {
                        //把尺寸存放起來
                        var ele = self.screen_ele.querySelector('div.slide-bg')
                        ele.setAttribute('size', escape(JSON.stringify({ width: image_size.width, height: image_size.height })))
                        ele.style.width = image_size.width + 'px'
                        ele.style.height = image_size.height + 'px'

                        final_completion_promise.resolve()
                    })
                }
                else {
                    //there is no # in resource.color
                    content = '<div class="studio-full-box blank-slide-bg" style="width:100%;height:100%">&nbsp;</div>'
                    preload_promise = $.when()
                    content_completion_promise.done(function () {
                        final_completion_promise.resolve()
                    })
                }
                break
            case 'TEXT':
                // figure out if content is CJK mode
                // if over 50% line has CJK, then wrap in ckj style
                var ckj_line_count = 0
                var lines = self.slide.resource.content.split('\n')
                _.each(lines, function (line) {
                    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(line)) ckj_line_count += 1
                })
                var ckj_style = (ckj_line_count / lines.length) >= 0.5
                var lines_count = resource.content.split('\n').length
                var lines_per_screen = 35
                var screen_height = self.presentation_screen.content_rect.height
                var screen_width = self.presentation_screen.content_rect.width
                var text_height = Math.floor((self.presentation_screen.content_rect.height - window.scrollbarWidth) / lines_per_screen)
                // 在widget_layer上開洞讓text過長或過寬時的scrollbar可以操作
                self.presentation_screen.widget_layer.style.height = parseInt(self.presentation_screen.widget_layer.style.height) - window.scrollbarWidth + 'px'
                self.presentation_screen.widget_layer.style.width = parseInt(self.presentation_screen.widget_layer.style.width) - window.scrollbarWidth + 'px'

                var text_div_height = text_height * lines_per_screen
                var html = ['<div class="text-viewer" text_height="' + text_height + '" style="margin:0;padding:0;height:' + text_div_height + 'px;">']
                html.push('<table style="width:100%"><tr><td class="line-number"><ol>')
                for (var i = 0; i < lines_count; i++) {
                    html.push('<li style="height:' + text_height + 'px;line-height:' + text_height + 'px"></li>')
                }
                html.push('</ol></td><td style="vertical-align:top;padding-left:15px;">')
                html.push('<div class="text-resource-content" style="font-size:' + (Math.round(text_height * (ckj_style ? 0.6 : 0.7) * 10) / 10) + 'px;line-height:' + text_height + 'px">')
                html.push('</div></td></tr></table>')
                html.push('</div>')//text-viewer
                content = '<div class="studio-full-box text-resource">' + html.join('') + '</div>'
                preload_promise = $.when()
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()

                window.find_line_length = function () {
                    var char = (ckj_style) ? '龜' : 'W'
                    var text = ''.padStart(30, char)
                    var style = window.getComputedStyle(self.presentation_screen.screen_ele.querySelector('.text-viewer .text-resource-content'))
                    //40 is width of line-numbers
                    var width = self.presentation_screen.screen_ele.querySelector('.text-viewer').getBoundingClientRect().width - 40
                    var o = $('<div></div>')
                        .text(text)
                        .css({ 'position': 'absolute', 'float': 'left', 'white-space': 'pre', 'visibility': 'hidden', 'font-family': style['fontFamily'], 'font-size': style['fontSize'] })
                        .appendTo($('body')),
                        w = o.width();

                    var i;
                    for (i = 30; i < 150; i++) {
                        if (w > width) break
                        text += char
                        o.text(text)
                        w = o.width()
                    }
                    o.remove();
                    return i;
                }
                var text_resource_div, text_resource_rect
                var line_number_width
                content_completion_promise.done(function () {
                    text_resource_div = self.screen_ele.querySelector('div.text-resource')
                    text_resource_rect = text_resource_div.getBoundingClientRect()

                    // restore hilight rows
                    for (var i = 0; i < resource.hilight.length; i++) {
                        text_resource_div.querySelector('.text-viewer .line-number ol li:nth-child(' + resource.hilight[i] + ')').className = 'hilight'
                    }
                    if (resource.hilight.length) {
                        w2ui['toolbar'].enable('textmenu:clear-hilights')
                    }
                    else {
                        w2ui['toolbar'].disable('textmenu:clear-hilights')
                    }

                    line_number_width = text_resource_div.querySelector('.text-viewer .line-number').getBoundingClientRect().width
                    //let li shows a line across left to right when has class "hilight"
                    $(text_resource_div).find('.text-viewer .line-number li').width(screen_width - line_number_width - 5)

                    text_resource_div.addEventListener('scroll', scroll_handler, true)

                    //set content, restore inital scrolltop and wrap state
                    self.presentation_screen.presentation.fire('TEXT-WRAP', resource.wrap)
                    self.presentation_screen.overlay.image_mode = false
                    _.delay(function () {
                        //wait 1000ms for text to complete render
                        var text_resource_content_rect = text_resource_div.querySelector('.text-resource-content').getBoundingClientRect()
                        var content_height = Math.max(screen_height, Math.round(text_resource_content_rect.height))
                        if (content_height > screen_height) {
                            //如果頁面變長了才重劃overlay, 只要直接改變draw size，不要用overlay.set_size
                            self.presentation_screen.overlay.draw.size(Math.round(text_resource_content_rect.width), content_height)
                        }
                        if (resource.scroll[1] || resource.scroll[0]) {
                            var scroll_top = (resource.scroll[1] * text_height / 1000)
                            _.delay(function () {
                                //self.presentation_screen.presentation.fire('SCROLL',[0,scroll_top])
                                scroll_by_remote(resource.scroll)
                                final_completion_promise.resolve()
                            }, 10) // must be later than above (draw.size())
                        }
                        else {
                            final_completion_promise.resolve()
                        }
                    }, 1000)

                })

                var go_line_handler = function (line_no) {
                    var scroll_top = Math.abs((line_no - 1)) * text_height
                    text_resource_div.scrollTop = scroll_top
                    self.presentation_screen.overlay.set_scroll(0, scroll_top)
                }
                self.presentation_screen.presentation.on('GO-LINE', go_line_handler)

                //let mousewheel to scroll text contents
                var sensitivity_rate = 5
                var t_id = self.presentation_screen.presentation.current_thread.id
                var s_idx = self.slide.idx
                var mousewheel_lock = false // help scroll event handler to know it is triggered by mousewheel locally
                var mousewheel_unlock = _.debounce(function () { mousewheel_lock = false; }, 500)
                var scrollbar_lock = false // help remote-scroll event handler to know it is triggered by mouse scroll locally
                var scrollbar_unlock = _.debounce(function () { scrollbar_lock = false; }, 500)
                var sync_scroll_lock = false // help remote-scroll event handler to know it is triggered by mouse scroll locally
                var sync_scroll_unlock = _.debounce(function () { sync_scroll_lock = false; }, 500)
                var broadcast_scroll = _.throttle(function (left, top) {
                    self.presentation_screen.presentation.send_to_bus('refresh', ['scroll', t_id, s_idx, left, top])
                }
                    , 100, { tailing: true, leading: false })
                var mousewheel_handler = function (evt) {
                    if (self.presentation_screen.zoomout_enabled) return
                    var movement = - Math.round(evt.wheelDelta / sensitivity_rate)
                    var k = text_resource_div.scrollTop
                    var scroll_top = Math.max(0, text_resource_div.scrollTop + movement)

                    text_resource_div.scrollTop = scroll_top
                    //暫時取消overlay跟著捲動功能，因為在height很長時捲動還不能做的夠好
                    //self.presentation_screen.overlay.set_scroll(-1,scroll_top)

                    mousewheel_unlock.cancel()
                    mousewheel_lock = true
                    mousewheel_unlock()

                    var normalized_scroll_top = Math.round(1000 * scroll_top / text_height)
                    var normalized_scroll_left = -1
                    broadcast_scroll.cancel()
                    broadcast_scroll(normalized_scroll_left, normalized_scroll_top)
                }
                // 2019-03-17T04:38:24+00:00 因overlay_surface已經設定為pointer-events:none,故改為widget-layer接收mousewheel事件
                //document.getElementById('overlay_surface').addEventListener('mousewheel', mousewheel_handler)
                document.getElementById('widget-layer').addEventListener('mousewheel', mousewheel_handler)

                var scroll_handler = function (evt) {
                    //regard remote scroll or mousewheel
                    if (sync_scroll_lock || mousewheel_lock) return
                    scrollbar_unlock.cancel()
                    scrollbar_lock = true
                    scrollbar_unlock()
                    var scroll_left = text_resource_div.scrollLeft
                    var scroll_top = text_resource_div.scrollTop
                    //暫時取消overlay跟著捲動功能，因為在height很長時捲動還不能做的夠好
                    //self.presentation_screen.overlay.set_scroll(scroll_left,scroll_top)
                    //text_height is precise than text_resource_rect.height when normalization
                    var normalized_scroll_top = Math.round(1000 * scroll_top / text_height)
                    // x-axis sync seems to be depended on font
                    var normalized_scroll_left = Math.round(1000 * scroll_left / text_resource_rect.width)
                    broadcast_scroll.cancel()
                    broadcast_scroll(normalized_scroll_left, normalized_scroll_top)
                }

                var swipe_handler = function (up_or_down) {
                    //regard remote scroll or mousewheel
                    var is_up = (up_or_down == 'up')
                    var scroll_top = text_resource_div.scrollTop
                    scroll_top += is_up ? 100 : 100
                    text_resource_div.scrollTop = scroll_top
                    self.presentation_screen.overlay.set_scroll(-1, scroll_top)
                    /*
                    var normalize_scroll_top = Math.round(1000 * scroll_top / text_viewer_rect.height )
                    var normalize_scroll_left = Math.round(1000 * scroll_left / text_viewer_rect.width )
                    broadcast_scroll.cancel()
                    broadcast_scroll(normalize_scroll_left,normalize_scroll_top)
                    */
                }
                self.presentation_screen.presentation.on('SWIPE',swipe_handler)

                self.presentation_screen.page_ele_tap_handler_disable = true
                var click_handler = function (evt) {
                    if (evt.offsetX < line_number_width) {
                        //因為overlay_surface已經不跟著下捲動，所以要把scrollTop加上去
                        var line_no = Math.ceil((evt.offsetY + text_resource_div.scrollTop) / text_height)
                        var $li = $(text_resource_div.querySelector('.line-number ol li:nth-child(' + line_no + ')'))
                        var hilight = ($li.hasClass('hilight')) ? false : true
                        if (hilight) $li.addClass('hilight')
                        else $li.removeClass('hilight')
                        // update local object
                        if (hilight) {
                            resource.hilight.push(line_no)
                        }
                        else {
                            var idx = resource.hilight.indexOf(line_no)
                            resource.hilight.splice(idx, 1)
                        }
                        if (resource.hilight.length) {
                            w2ui['toolbar'].enable('textmenu:clear-hilights')
                        }
                        else {
                            w2ui['toolbar'].disable('textmenu:clear-hilights')
                        }
                        self.presentation_screen.presentation.send_to_bus('refresh', ['text-hilight', t_id, s_idx, line_no, hilight])
                    }
                }
                document.getElementById('widget-layer').addEventListener('click', click_handler, true)
                var clear_hilights_handler = function () {
                    text_resource_div.querySelectorAll('.line-number ol li.hilight').forEach(function (li) {
                        $(li).removeClass('hilight')
                    })
                    resource.hilight.splice(0, resource.hilight.length)
                    w2ui['toolbar'].disable('textmenu:clear-hilights')
                    self.presentation_screen.presentation.send_to_bus('refresh', ['text-hilight', t_id, s_idx, -1, null])
                }
                self.presentation_screen.presentation.on('CLEAR-HILIGHTS', clear_hilights_handler)

                var update_hilights_handler = function (data) {
                    //hilight been updated by remote
                    if (data.line_no == -1) {
                        //remove all hilights
                        text_resource_div.querySelectorAll('.line-number ol li.hilight').forEach(function (li) {
                            $(li).removeClass('hilight')
                        })
                        w2ui['toolbar'].disable('textmenu:clear-hilights')
                    }
                    else {
                        var $li = $(text_resource_div.querySelector('.line-number ol li:nth-child(' + data.line_no + ')'))
                        if (data.hilight) {
                            $li.addClass('hilight')
                        }
                        else {
                            $li.removeClass('hilight')
                        }
                        if (resource.hilight.length) {
                            w2ui['toolbar'].enable('textmenu:clear-hilights')
                        }
                        else {
                            w2ui['toolbar'].disable('textmenu:clear-hilights')
                        }
                    }
                }
                self.presentation_screen.presentation.on('UPDATE-HILIGHTS', update_hilights_handler)

                var scroll_by_remote = function (data) {
                    //called by bus to sync or at initial stage of a Text resource

                    //regard local scroll by mousewheel or scroll bars
                    if (scrollbar_lock || mousewheel_lock) return
                    sync_scroll_unlock.cancel()
                    sync_scroll_lock = true
                    sync_scroll_unlock()
                    //store to local object
                    resource.scroll = data
                    var normalized_scroll_left = data[0]
                    var normalized_scroll_top = data[1]
                    //一個字的高度與寬度，因字型而不同，用字高對位才能移動到相同的行數。
                    // 用pixel對應會跟字對應不起來，因為圖與字的座標不一樣，這也導致overlay無法正確對位。暫時不解決。
                    var scroll_top = Math.round(normalized_scroll_top / 1000 * text_height)
                    var scroll_left = Math.round(normalized_scroll_left / 1000 * text_resource_rect.width)
                    text_resource_div.scrollTop = scroll_top
                    if (normalized_scroll_left >= 0) {
                        text_resource_div.scrollLeft = scroll_left
                    }
                    //暫時取消overlay跟著scroll功能
                    //self.presentation_screen.overlay.set_scroll(scroll_left, scroll_top)
                }
                self.presentation_screen.presentation.on('SCROLL', scroll_by_remote)

                var update_line_numbers = function (count) {
                    var content_div_height = text_resource_div.querySelector('.text-viewer .text-resource-content').getBoundingClientRect().height
                    var line_number_div = text_resource_div.querySelector('.text-viewer .line-number ol')
                    var li = line_number_div.querySelectorAll('li')
                    if (li.length < count) {
                        for (var i = li.length; i < count; i++) {
                            line_number_div.appendChild(li[0].cloneNode(true))
                        }
                    }
                    else if (li.length > count) {
                        var len = li.length
                        for (var i = len - 1; i >= count; i--) {
                            line_number_div.removeChild(li[i])
                        }
                    }
                    text_resource_div.querySelector('.text-viewer .line-number').style.height = content_div_height + 'px'
                    //重算列高
                    text_height = Math.round(100 * content_div_height / count) / 100
                    line_number_div.querySelectorAll('li').forEach(function (li) {
                        li.style.lineHeight = text_height + 'px'
                        li.style.height = text_height + 'px'
                    })
                }
                var text_wrap_handler = function (line_length) {
                    //called by bus to sync or at initial stage of a Text resource
                    var scroll_top = self.screen_ele.querySelector('.text-viewer').scrollTop
                    if (line_length) {
                        var lines = self.slide.resource.content.split('\n')
                        var html = []
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i]
                            if (line.length > line_length) {
                                var indent = line.match(/^\s*/)[0]
                                html.push((line.substring(0, line_length)) + '↵')
                                var pos = line_length
                                var end_pos
                                while (pos < line.length) {
                                    end_pos = pos + line_length - indent.length
                                    html.push((indent + line.substring(pos, end_pos)) + (end_pos < line.length ? '↵' : ''))
                                    pos = end_pos
                                }
                            }
                            else {
                                html.push((line))
                            }
                        }
                        self.screen_ele.querySelector('.text-viewer .text-resource-content').innerText = html.join('\n')
                        self.screen_ele.querySelector('.text-viewer .text-resource-content').setAttribute('mode', 'line-wrap')
                        w2ui['toolbar'].enable('textmenu:line-nowrap')
                        w2ui['toolbar'].disable('textmenu:line-wrap')
                        update_line_numbers(html.length)
                    }
                    else {
                        //self.slide.resource.content
                        self.screen_ele.querySelector('.text-viewer .text-resource-content').innerText = self.slide.resource.content
                        self.screen_ele.querySelector('.text-viewer .text-resource-content').setAttribute('mode', 'line-nowrap')
                        w2ui['toolbar'].disable('textmenu:line-nowrap')
                        w2ui['toolbar'].enable('textmenu:line-wrap')
                        update_line_numbers((self.slide.resource.content.match(/\n/g) || []).length + 1)
                    }
                    self.screen_ele.querySelector('.text-viewer').scrollTop = scroll_top
                    //store to local object
                    resource.wrap = line_length
                    return line_length
                }
                self.presentation_screen.presentation.on('TEXT-WRAP', text_wrap_handler)

                disabled_toolbar_items['textmenu'] = false

                // unregister if page is going to change to other page
                var remove_handler = function () {
                    self.presentation_screen.presentation.off('PAGE-WILL-CHANGE', remove_handler)
                    self.presentation_screen.presentation.off('PAGE-WILL-REFRESH', remove_handler)
                    self.presentation_screen.presentation.off('SCROLL', scroll_by_remote)
                    self.presentation_screen.presentation.off('TEXT-WRAP', text_wrap_handler)
                    self.presentation_screen.presentation.off('SWIPE', swipe_handler)
                    self.presentation_screen.presentation.off('GO-LINE', go_line_handler)
                    self.presentation_screen.presentation.off('CLEAR-HILIGHTS', clear_hilights_handler)
                    self.presentation_screen.presentation.off('UPDATE-HILIGHTS', update_hilights_handler)
                    document.getElementById('widget-layer').removeEventListener('mousewheel', mousewheel_handler)
                    document.getElementById('overlay_surface').removeEventListener('click', click_handler)

                    //關閉在widget_layer上開的洞
                    self.presentation_screen.widget_layer.style.height = parseInt(self.presentation_screen.widget_layer.style.height) + window.scrollbarWidth + 'px'
                    self.presentation_screen.widget_layer.style.width = parseInt(self.presentation_screen.widget_layer.style.width) + window.scrollbarWidth + 'px'

                    delete self.presentation_screen.page_ele_tap_handler_disable

                    w2ui['toolbar'].disable('textmenu')
                }
                self.presentation_screen.presentation.on('PAGE-WILL-CHANGE', remove_handler)
                //重貼文字時會有此事件（因目前slide沒有切換的情況下不會觸發 PAGE-WILL-CHANGE事件），要先解掉
                self.presentation_screen.presentation.on('PAGE-WILL-REFRESH', remove_handler)
                break
            case 'URL':

                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()
                self.presentation_screen.overlay.image_mode = true
                self.presentation_screen.overlay.draw.size(self.presentation_screen.overlay.width, self.presentation_screen.overlay.height)

                if (resource.kind && resource.kind.indexOf('image/') == 0) {
                    //當成BLANK有背景的slide一樣
                    disabled_toolbar_items['zoomout'] = false
                    var url = resource.url
                    content = '<div class="slide-bg studio-fit-box" style="background-image:url(' + url + ')"></div>'
                    preload_promise = this._preload('IMG', url)
                    var image_size;
                    preload_promise.done(function (size) {
                        image_size = size
                    })
                    content_completion_promise.done(function () {
                        //把尺寸存放起來
                        var ele = self.screen_ele.querySelector('div.slide-bg.studio-fit-box')
                        ele.setAttribute('size', escape(JSON.stringify({ width: image_size.width, height: image_size.height })))
                        ele.style.width = image_size.width + 'px'
                        ele.style.height = image_size.height + 'px'
                        final_completion_promise.resolve()
                    })
                }
                else {
                    var url = self.slide.resource.url
                    content = '<div class="studio-full-box"><iframe style="width:100%;height:100%" src="' + url + '"></iframe></div>'
                    preload_promise = $.when()
                    content_completion_promise.done(function () {
                        final_completion_promise.resolve()
                    })
                }
                break

            case 'VIDEO':

                w2ui['toolbar'].show('background-play')

                self.presentation_screen.overlay.image_mode = true
                self.presentation_screen.overlay.draw.size(self.presentation_screen.overlay.width, self.presentation_screen.overlay.height)

                preload_promise = $.when()
                content_completion_promise = new $.Deferred()
                final_completion_promise = new $.Deferred()

                //before player creation handling
                var on_state_changed = null
                if (self.presentation_screen.presentation.isolated || self.presentation_screen.readonly) {
                    //embedded screen in dashboard or audience screen
                    //do not listen on state change
                } else {
                    on_state_changed = function (video_state, video_current_time, player_now) {
                       var item = w2ui['toolbar'].get('background-play')
                       if (video_state == 1){
                            item.icon = 'fa fa-pause active'
                            item.text = 'Pause'
                            w2ui['toolbar'].refresh('background-play')
                        }
                        else if (video_state == 2 || video_state == 0){
                            item.icon = 'fa fa-play'
                            item.text = 'Play'
                            w2ui['toolbar'].refresh('background-play')
                        }
                    }
                }                
                // 不知何故，有時 self.slide.resource.extra 會消失？(why)
                // self.slide.resource.extra = [state(play or pause),(video time),(timestamp when taking state)]
                var video_state = self.slide.resource.extra ? self.slide.resource.extra[0] : 2
                var player_time = self.slide.resource.extra ? Math.floor(self.slide.resource.extra[1]) : 0
                if (video_state == 1 && self.slide.resource.extra[2]) {
                    //影片正在播放，調整影片播放時間
                    var delta_seconds = (Math.round(new Date().getTime() / 1000) - self.slide.resource.extra[2])
                    player_time += delta_seconds
                }
                
                player_time += 0 // 加上載入影片的overhead
                var player_api;
                if (resource.kind == 'YT'){ //youtube
                    player_api = YoutubePlayer.singleton || new YoutubePlayer()
                }
                else if (resource.kind == 'FB'){
                    player_api = FacebookPlayer.singleton || new FacebookPlayer()
                    console.log('facebok')
                }
                if (player_api){
                    var ret = player_api.pre_render({ class: 'studio-fit-box', video_id:self.slide.resource.vid })
                    content = ret.content
                    content_completion_promise.done(function () {
                        player_api.start({
                            player_id: ret.player_id
                            , video_id: self.slide.resource.vid
                            , video_state: video_state
                            , player_time: Math.round(player_time)
                            , on_state_changed: on_state_changed
    
                        }, function (success, player) {
                            if (success) {
                                w2ui['toolbar'].player = player
                            }
                            else {
                                var message = player
                                w2alert(message)
                            }
                            final_completion_promise.resolve()
                        })
                    })
                }
                break

            case 'OP':

                self.presentation_screen.overlay.image_mode = true
                self.presentation_screen.overlay.draw.size(self.presentation_screen.overlay.width, self.presentation_screen.overlay.height)

                var url = self.slide.resource.url
                var kind = self.slide.resource.kind
                if (kind == 'GS') {
                    // google slides
                    var current_page = self.slide.resource.extra ? self.slide.resource.extra[0] : 1
                    if (current_page != 1) {
                        url += '#' + current_page
                    }
                    content = '<iframe class="studio-full-box" style="width:100vw;height:100vh" src="' + url + '"></iframe>'
                    preload_promise = $.when()
                    content_completion_promise = new $.Deferred()
                    final_completion_promise = new $.Deferred()
                    content_completion_promise.done(function () {
                        //create pesudo toolbar
                        var gs_toolbar_div = document.createElement('div')
                        gs_toolbar_div.className = 'gs-toolbar origin-hide-me'
                        gs_toolbar_div.innerHTML = document.getElementById('gs-toolbar-tmpl').innerHTML
                        gs_toolbar_div.querySelector('.page_no').innerHTML = current_page
                        var rect = self.screen_ele.getBoundingClientRect()
                        var toolbar_height = 29 // div.punch-viewer-nav-v2.punch-viewer-nav-fixed
                        gs_toolbar_div.style.top = (rect.top + rect.height - toolbar_height) + 'px'
                        gs_toolbar_div.style.left = (rect.left + 2) + 'px'

                        self.presentation_screen.page_ele.appendChild(gs_toolbar_div)
                        var iframe = self.screen_ele.querySelector('iframe')
                        iframe.onload = function () {
                            window.loading(false)
                        }
                        iframe.onerror = function (err) {
                            window.loading(false)
                            console.log('loading iframe error', err)
                        }

                        self.slide.go_page = function (page_no, call_by_sync) {

                            window.loading(true, 'loading', true)

                            self.slide.resource.extra = [page_no]

                            gs_toolbar_div.querySelector('.page_no').innerHTML = page_no


                            if (current_page !== page_no) {
                                var url = self.slide.resource.url + '#' + page_no
                                iframe.src = url
                                current_page = page_no
                            }

                            if (page_no == 1) {
                                $(gs_toolbar_div.querySelector('.prev')).addClass('disabled')
                                $(gs_toolbar_div.querySelector('.first')).addClass('disabled')
                            }
                            else {
                                $(gs_toolbar_div.querySelector('.prev')).removeClass('disabled')
                                $(gs_toolbar_div.querySelector('.first')).removeClass('disabled')
                            }

                            if (call_by_sync || self.presentation_screen.presentation.isolated) { }
                            else {
                                var t_id = self.presentation_screen.presentation.current_thread.id
                                var s_idx = self.presentation_screen.presentation.current_slide.idx
                                //set "now" to 0, because it doesn't matter
                                var args = [t_id, s_idx, [page_no]]
                                self.presentation_screen.presentation.send_to_bus('slide-sync', args)
                            }
                        }
                        gs_toolbar_div.querySelector('.next').onclick = _.throttle(function (evt) {

                            var page_no = self.slide.resource.extra ? self.slide.resource.extra[0] : 1
                            page_no = page_no + 1

                            self.slide.go_page(page_no)

                        })
                        gs_toolbar_div.querySelector('.prev').onclick = _.throttle(function (evt) {
                            var page_no = self.slide.resource.extra[0]
                            page_no = page_no ? page_no : 1
                            if (page_no == 1) {
                                return
                            }
                            else {
                                page_no -= 1
                            }

                            self.slide.go_page(page_no)
                        })
                        gs_toolbar_div.querySelector('.first').onclick = _.throttle(function (evt) {
                            self.slide.go_page(1)
                        })
                        self.slide.go_page(current_page, true)
                        //initial page will be set with slide.update_resouce_data in presentation.js by resolving promise
                        final_completion_promise.resolve()
                    })
                }
                break
            /* not supported yet
            case 'HTML':
                //console.log('this.resource.url=',this.slide.url)
                if (!this.slide.url) return
                self.presentation_screen.overlay.image_mode = true
                self.presentation_screen.overlay.draw.size(self.presentation_screen.overlay.width,self.presentation_screen.overlay.height)

                var fitting = function(){
                    setTimeout(function(){
                        //wait for the transition of w2ui to complete,
                        //otherwise the DOM has two main-panel
                        self.content_fitting()
                        //also to var user aware the loading
                        w2ui['layout'].unlock(self.name)
                    },1000)
                }

                w2ui['layout'].lock(this.name,'loading',true)
                w2ui['layout'].load(this.name, this.slide.url,'slide-left',function(){
                    fitting()
                })
                return
            */

        }
        //update toolbar items
        for (var name in disabled_toolbar_items) {
            if (disabled_toolbar_items[name]) w2ui['toolbar'].disable(name)
            else w2ui['toolbar'].enable(name)
        }
        if (preload_promise) {
            window.loading(true, 'loading', true)
            preload_promise.done(function () {
                window.loading(false)
                self.content(content, false, transition).done(function () {
                    content_completion_promise.resolve()
                })
            })
        }
        else {
            self.content(content, false, transition).done(function () {
                content_completion_promise.resolve()
            })
        }

        return final_completion_promise
    },
    content_fitting: function () {
        //search for speical classes to adjuest their size
        var self = this
        // keep ratio for .studio-fit-box
        var box = self.screen_ele
        _.each(box.querySelectorAll('.studio-fit-box'), function (ele, idx) {
            //fit this element to its screen but keep ratio
            var content_rect = window.presentation_screen.content_rect
            var presentation_ratio = self.presentation_screen.presentation.settings.ratio
            var screen_ratio = presentation_ratio[0] / presentation_ratio[1]
            var origin_size = ele.getAttribute('size') ? JSON.parse(unescape(ele.getAttribute('size'))) : ele.getBoundingClientRect()
            var ele_rect = origin_size
            var h, w
            var ele_ratio = ele_rect.width / ele_rect.height
            if (ele_rect.width <= content_rect.width && ele_rect.height <= content_rect.height) {
                if (ele_ratio > screen_ratio) fit_width = true
                else fit_width = false
            }
            else if (ele_rect.width > content_rect.width && ele_rect.height > content_rect.height) {
                if (ele_ratio > screen_ratio) fit_width = true
                else fit_width = false
            }
            else if (ele_rect.width > content_rect.width) {
                fit_width = true
            }
            else {//ele_rect.height > content_rect.height;
                fit_width = false
            }
            if (fit_width) {
                w = content_rect.width
                h = content_rect.height * (w / content_rect.width)
            }
            else {//ele_rect.height > content_rect.height;
                h = content_rect.height
                w = ele_rect.width * (h / ele_rect.height)
            }
            ele.style.width = w + 'px'
            ele.style.height = h + 'px'
            //center this ele
            ele.style.position = 'absolute'
            ele.style.left = ((content_rect.width - w) / 2) + 'px'
            ele.style.top = ((content_rect.height - h) / 2) + 'px'
        })

        // use full box  for .studio-full-box
        var rect = window.presentation_screen.content_rect
        _.each(box.querySelectorAll('.studio-full-box'), function (ele) {
            //fit this element to its container but keep ratio
            ele.style.width = rect.width + 'px'
            ele.style.height = rect.height + 'px'
        })
    },
}
/*
 *
 */
function Pointers(presentation_screen) {
    this.presentation_screen = presentation_screen
    this.co_pointers = {}
    this.meta = {
        id: Math.round(Math.random() * 10000),
        color: '#ff0000',
        enable: 1
    }
    this.enabled = false
    this.counter = 0
}
Pointers.prototype = {
    enable: function () {
        var self = this
        this.enabled = true
        this.meta.enable = 1
        //_.delay is not involved like "enable_draw", beause "pointer" would not be enabled at initial phase
        this.presentation_screen.update_toolbar('pointer:enable', true)

        if (this.presentation_screen.draw_enabled) this.presentation_screen.disable_draw()

        var slide = this.presentation_screen.presentation.current_slide

        if (slide.is_embedded) {
            // slide is video or web page
            if (!this.presentation_screen.draw_enabled) {
                this.presentation_screen.overlay.show(true)
                //this.presentation_screen.overlay.show_canvas(false)
            }
        }
        var x0 = -1, y0 = -1, x1 = -1, y1 = -1
        this._show_pointer_timer = setInterval(function () {
            if (x0 != x1 || y0 != y1) {
                var positions = self._get_intermediate_bubbles(x0, y0, x1, y1)
                _.each(positions, function (xy, idx) {
                    self._make_bubble(xy[0], xy[1], (idx + 1) / positions.length * 0.9, self.meta.color)
                })
                self._make_bubble(x1, y1, 1, self.meta.color)
            }
            x0 = x1
            y0 = y1
        }, 250)
        this._show_static_pointer_timer = setInterval(function () {
            if (x0 != x1 || y0 != y1) return
            //mouse not moved
            var bubble = self._make_bubble(x1, y1, 1, self.meta.color)
            bubble.classList.add('static')
        }, 1000)
        var rect = this.presentation_screen.content_rect
        var pointer_offset = 0
        this.presentation_screen.presentation.send_to_bus('pointer-meta', this.meta)

        $(this.presentation_screen.page_ele).on('mousemove touchmove', _.throttle(function (evt) {
            //works for both touch and mouse
            x1 = evt.pageX
            y1 = evt.pageY - 15
            self.counter += 1
            //send color for every 10 times (5sec = 250*20)
            var sync_color = self.counter % 20 == 19
            if (x0 == x1 && y0 == y1 && (!sync_color)) return
            var posX = (x1 - pointer_offset)
            var posY = (y1 - pointer_offset)
            var x = Math.round(10000 * (posX - rect.left) / rect.width)
            var y = Math.round(10000 * (posY - rect.top) / rect.height)
            var data = sync_color ? [self.meta.id, x, y, self.meta.color] : [self.meta.id, x, y]
            self.presentation_screen.presentation.send_to_bus('pointer', data)
        }, 250, { leading: false }))
    },
    disable: function () {
        this.enabled = false
        this.counter = 0
        var self = this
        // delay a while to make restoring "draw" button's red class taking effective
        // when it was disabled by enabling pointer
        _.delay(function () { self.presentation_screen.update_toolbar('pointer:enable', false) }, 50)

        clearInterval(this._show_pointer_timer)
        clearInterval(this._show_static_pointer_timer)
        delete this._show_pointer_timer;
        delete this._show_static_pointer_timer;

        var slide = this.presentation_screen.presentation.current_slide
        if (slide.is_embedded) {
            //slide is video, web page, etc.
            if (!this.presentation_screen.draw_enabled) {
                this.presentation_screen.overlay.show(false)
            }
        }
        $(this.presentation_screen.page_ele).off('mousemove touchmove')
        this.meta.enable = 0
        //this.presentation_screen.presentation.send_to_bus('misc-sync',['pointer',this.meta])
        this.presentation_screen.presentation.send_to_bus('pointer-meta', this.meta)
    },
    sync_meta: function (meta) {
        var self = this
        if (meta.enable) {
            var co_meta = {
                id: meta.id,
                color: meta.color,
                xy: null,
                ts: new Date().getTime()
            }
            co_meta.timer = setInterval(_.bind(function () {
                var now = new Date().getTime()
                //remove a pointer if it has missing over 30 seconds
                if (now - co_meta.ts > 30000) {
                    co_meta.enable = 0
                    _.defer(function (co_meta) { self.sync_meta(co_meta) }, co_meta)
                }
                else if (co_meta.xy) {
                    bubble = self._make_bubble(co_meta.xy[0], co_meta.xy[1], 1, co_meta.color)
                    bubble.classList.add('static')
                }
            }, { co_meta: co_meta }), 1000)
            this.co_pointers[meta.id] = co_meta
        }
        else {
            var co_meta = this.co_pointers[meta.id]
            if (co_meta && co_meta.timer) clearInterval(co_meta.timer)
            delete this.co_pointers[meta.id]
        }
    },
    sync_data: function (data) {
        var rect = this.presentation_screen.content_rect
        var pointer_id = data[0]
        var x = data[1] / 10000 * rect.width + rect.left
        var y = data[2] / 10000 * rect.height + rect.top
        var color = data[3]
        var self = this

        var co_meta = this.co_pointers[pointer_id]
        if (!co_meta) {
            //auto recover this pointer
            co_meta = {
                id: pointer_id,
                color: color || '#ff0000',
                enable: 1
            }
            this.sync_meta(co_meta)
        }
        else if (color && (color !== co_meta.color)) {
            co_meta.color = color
        }
        //kick this co_meta
        co_meta.ts = new Date().getTime()

        var last_xy = this.co_pointers[pointer_id].xy
        if (last_xy) {
            var positions = this._get_intermediate_bubbles(last_xy[0], last_xy[1], x, y)
            _.each(positions, function (xy, idx) {
                self._make_bubble(xy[0], xy[1], (idx + 1) / positions.length * 0.9, co_meta.color)
            })
        }
        this._make_bubble(x, y, 1, co_meta.color)
        this.co_pointers[pointer_id].xy = [x, y]
    },
    set_color: function (color) {
        //call this change pointer's color,
        //this will change the counter to enforce color to be synced
        this.meta.color = color
        if (this.enabled) {
            this.counter = 18
        }
    },
    _get_intermediate_bubbles: function (x0, y0, x1, y1) {
        var positions = []
        var max_gap = 40
        if (x0 != -1 || y0 != -1) {
            var dx = x1 - x0
            var dy = y1 - y0
            if (Math.abs(dx) > Math.abs(dy)) {
                var n = Math.abs(Math.floor(dx / max_gap))
            }
            else {
                var n = Math.abs(Math.floor(dy / max_gap))
            }
            if (n == 0) return []
            for (var i = 1; i <= n; i++) {
                var theta = Math.sin(Math.PI / 2 * (i / n))
                positions.push([x0 + dx * theta, y0 + dy * theta])
            }
        }
        return positions
    },
    _make_bubble: function (x, y, stage, color) {
        //helper of pointer
        /* arguments:
            stage: float, 0.0 ~ 1.0 , bubble's stage, 1 is initial, smaller is close to broken.
        */
        var self = this
        var max_scale = stage * 0.75 + 0.25//0.25 is bubble's initial scale
        var opacity = 1 - stage * 0.9       //0.9 is bubble's (1 - initial opacity)
        var transition_duration = 500 * stage //1000 ms is bubble's total transition duration

        var bubble = document.createElement('span')
        bubble.classList.add('bubble')
        bubble.style.left = (x - 15) + 'px' //bubble's size is 30x30
        bubble.style.top = (y - 15) + 'px'
        bubble.innerHTML = '&nbsp;'
        bubble.style.background = 'radial-gradient(' + color + ', transparent)'
        self.presentation_screen.page_ele.appendChild(bubble)
        _.delay(function (_bubble) {
            _bubble.classList.add('thrink')
            _bubble.style.opacity = opacity
            _bubble.style.transitionDuration = transition_duration + 'ms'
            _bubble.style.transform = 'scale(' + max_scale + ')'
        }, 100, bubble)
        bubble.addEventListener("transitionend", function (evt) {
            //event was fired at every transition end.
            if (evt.propertyName != 'opacity') return
            self.presentation_screen.page_ele.removeChild(evt.srcElement)
        }, false)
        return bubble
    },
}
/*
 * Project Screen
 */
function PresentationScreen(p_id, container, flag_of_token, passcode) {
    /*
     * Arguments:
     *  container: DOM element which contains #screen element
     */
    this.p_id = p_id
    //out box of the screen
    this.page_ele = container
    this.flag_of_token = flag_of_token
    // show contents on the screen
    this.screen_ele = container.querySelector('#screen')
    this.screen_frame_ele = container.querySelector('#screen-frame')
    this.content_rect = null //rect of this.screen_frame_ele, but assigned later when it got stuffs
    // overlay is on top of the page
    var self = this

    this.overlay = new Overlay(container.querySelector('#screen-frame'))
    this.overlay.on_draw_changed = function (draw) {
        //overlay.draw is created after overlay.set_size is called
    }
    //create a layer for widgets after #screen-frame
    this.widget_layer = document.createElement('div')
    this.widget_layer.setAttribute('id', 'widget-layer')
    this.widget_layer.classList.add('origin-hide-me')//Not good solution, but just leave it now
    this.overlay.overlay_surface.parentNode.insertBefore(this.widget_layer, this.overlay.overlay_surface)

    // whiteboard does not isolated
    var isolated_screen = false

    this.presentation = new Presentation(p_id, this, {
        keyboard_shortcut: isolated_screen ? false : true,
        isolated: isolated_screen ? true : false,
        passcode: passcode,
        max_slides: global_config.profile.max_slides
    })
    //hookup WidgetGallery
    //WidgetGallery.singleton.service_to(this.presentation)

    this.overlay.delegate = this.presentation
    this.pointers = new Pointers(this)
    //this.dnd_uploader = new DnDUploader(this,document.body)
    this.dnd_enabler = null
    this.display_areas = {}
    // window.message = this.message

    this.sbs_user = null

    //切換slide時引發的zoomout事件需要此數值判斷是否要更換toolbar的item
    this.toolbar_hidden_group = 2 //initally hide group2

    this.draw_enabled = false
    this.origin_enabled = false
    this.zoomout_enabled = false
    this.dragging_enabled = false

    this.page_head_height = 60  //height of #page-head
}

PresentationScreen.prototype = {
    /* implementations of sbs_user's delegation*/
    on_disconnected: function () {
        w2utils.lock(document.body, 'reconnecting', true)
        //return true to ask sbs_user to reconnect
        return true
    },
    on_connected: function () {
        //called by self.sbs_user
        _.delay(function () {
            w2utils.unlock(document.body)
        }, 500)
        var self = this
        //var sdk = window.sdk //set by self.sbs_user.init()
        this.presentation.init(sdk).done(function () {
            self.sbs_user.call_when_ready(function () {
                //wait until user.preferences to be available
                self.on_presentation_did_init()
            })
        }).fail(function (stderr) {
            w2alert(stderr.message).done(function () {
                if (stderr.retcode == 403) _.defer(function () {
                    //request passcode and init again
                    window.request_passcode(function (value) {
                        self.presentation.passcode = value
                        self.on_connected()
                    })
                })
            })
        })
    },
    _init_touch_features: function () {
        // this is only used for swipe to next or previous slide in moblie device.
        var self = this
        //detect swipe
        document.addEventListener('touchstart', handleTouchStart, false);
        document.addEventListener('touchmove', handleTouchMove, false);
        document.addEventListener('touchend', handleTouchEnd, false);

        var xDown = null;
        var yDown = null;
        var xUp = null;
        var yUp = null;

        //should re-implemented to be event-based someday
        var can_swipe_navigate = function () {
            //return a boolean to say yes or no before presentation requests to change slide
            return (self.pointers.enabled || self.draw_enabled || self.zoomout_enabled) ? false : true
        }

        //讓長按1.5秒鐘能隱藏overlay_surface，用手指移動text-viewer的內容
        //停止移動後2秒鐘，恢復overlay_surface
        var text_resource_div = null
        var trigger_dismiss_interval = 1500
        var restore_overlay_surface = _.debounce(function () {
            document.querySelector('#overlay_surface').style.display = 'block'
            text_resource_div.removeEventListener('scroll', delay_restore_overlay_surface)
        }, 2000, { leading: false, trailing: true })
        var delay_restore_overlay_surface = function () {
            restore_overlay_surface.cancel()
            restore_overlay_surface()
        }
        var dismiss_overlay_surface = _.debounce(function () {
            text_resource_div = self.screen_ele.querySelector('.text-resource')
            document.querySelector('#overlay_surface').style.display = 'none';
            restore_overlay_surface()
            text_resource_div.addEventListener('scroll', delay_restore_overlay_surface)
        }, trigger_dismiss_interval, { leading: false, trailing: true })

        function handleTouchStart(evt) {
            //don't be effective when draw,zoomout,pointer enabled
            if (self.presentation.current_slide.resource.type == 'TEXT') {
                //讓長按一秒鐘能隱藏overlay_surface，用手指移動text-viewer的內容
                if (self.content_rect.height < self.screen_ele.querySelector('.text-resource-content').getBoundingClientRect().height) {
                    //捲動有意義時才啟動
                    dismiss_overlay_surface()
                }
            }
            else if (self.draw_enabled || self.zoomout_enabled || self.pointers.enabled) {
                //self.zoomout 在iOS是自動啟用的
                return
            }
            if (evt.touches.length != 1) {
                xDown = null
                return
            }
            xDown = evt.touches[0].clientX;
            yDown = evt.touches[0].clientY;
        };
        function handleTouchMove(evt) {
            if (!xDown) {
                return;
            }
            xUp = evt.touches[0].clientX;
            yUp = evt.touches[0].clientY;
        }
        function handleTouchEnd(evt) {

            //取消啟動長按一秒鐘能隱藏overlay_surface的功能
            dismiss_overlay_surface.cancel()

            if (!xDown || !xUp) {
                return;
            }
            var xDiff = xDown - xUp;
            var yDiff = yDown - yUp;
            var xThreshold = 30
            var yThreshold = 30

            //if (can_swipe_navigate()) console.log('swiiiii',xDiff, yDiff)
            if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(yDiff) < yThreshold) {/*most significant*/
                if (xDiff > xThreshold) {
                    /* left swipe */
                    if (can_swipe_navigate()) {
                        self.presentation.next_slide()
                    }
                } else if (xDiff < - xThreshold) {
                    /* right swipe */
                    if (can_swipe_navigate()) {
                        self.presentation.previous_slide()
                    }
                }
            }
            else {
                if (yDiff > 0) {
                    // up swipe
                    self.presentation.fire('SWIPE', 'up')
                } else {
                    // down swipe
                    self.presentation.fire('SWIPE', 'down')
                }
            }

            /* reset values */
            xDown = null;
            yDown = null;
            xUp = null;
            yUp = null;
        };
    },
    on_init: function (sbs_user) {
        var self = this

        if (mobileAndTabletcheck()) {
            this._init_touch_features()
        }
        else {
            //support drag-and-drop, paste on page and body
            /*
            定義貼上跟拖放檔案的行為
            在這裡要處理如何避免貼上道具跟貼在背景圖兩者之間的混淆的問題
            道具在被選定的時候要貼在道具上
            沒有被選定的時候要貼在背景上
            可是使用者可能 沒有註意到道具並沒有被選定因此導致他貼在背景上
            可是系統不能undo, 這樣會造成他的困擾
            此問題有待處理
            */
            this.dnd_enabler = new DnDEnabler()
            this.dnd_enabler.enable('sbs', '#page', this)
            this.dnd_enabler.enable_paste('sbs', 'body', this) //must be body to work (why?)
        }

        // navigation button on left and right side
        //enable hover on desktop brower, (disable on mobile device)
        if (self.flag_of_token == 3) {
            // in audience screen

            // remove navi buttons on both side
            $('.nav-btn-bar').remove()

            // only show screen-frame inner area
            document.querySelector('#screen-frame').classList.add('readonly')
        }
        else {
            if (!mobileAndTabletcheck()) {
                $('.nav-btn-bar').hover(function (evt) {
                    evt.currentTarget.style.opacity = 1
                    $(evt.currentTarget).addClass('active')
                }, function (evt) {
                    evt.currentTarget.style.opacity = 0
                    $(evt.currentTarget).removeClass('active')
                })
            }

            var prev_delay = _.debounce(function () {
                $('#prev-btn.nav-btn-bar').removeClass('active')
            }, 3000)
            var next_delay = _.debounce(function () {
                $('#next-btn.nav-btn-bar').removeClass('active')
            }, 3000)

            $('#prev-btn.nav-btn-bar').on('click', function (evt) {
                $('#prev-btn.nav-btn-bar').addClass('active')
                prev_delay.cancel()
                prev_delay()
            })
            $('#next-btn.nav-btn-bar').on('click', function (evt) {
                $('#next-btn.nav-btn-bar').addClass('active')
                next_delay.cancel()
                next_delay()
            })

            $('#prev-btn.nav-btn-bar span').on('click', function (evt) {
                // do action only if nav-btn-bar is visible
                if (mobileAndTabletcheck() && !$('#prev-btn.nav-btn-bar').hasClass('active')) return
                presentation_screen.presentation.previous_slide()
            })
            $('#next-btn.nav-btn-bar span').on('click', function (evt) {
                // do action only if nav-btn-bar is visible for mobile device
                if (mobileAndTabletcheck() && !$('#next-btn.nav-btn-bar').hasClass('active')) return
                presentation_screen.presentation.next_slide()
            })

        }

        //setup thread's layout
        //hard coded, not really implemented
        /*
        2019-03-12T06:36:18+00:00
        只有main，似乎已經沒有意義再使用layout
        $('#layout').w2layout({
            name: 'layout',
            style: 'width:100%;height:100%',
            panels: [
                //overflow:hidden is important for zooming
                / *
                {
                    'type': 'top', size: 200, content: $('#top'), hidden: true, onShow: function () {
                        self.presentation.fire('widget', {
                            name: 'render-user-widgets',
                            box: document.getElementById('top-content')
                        })
                    }, onHide: function () {
                        document.getElementById('top-content').innerHTML = ''
                    }
                }
                * /
                //{ 'type': 'main', 'size': '100%', 'content': ''}
                {type:'main',size:'100%','content': $('#page'), style: 'overflow:hidden'}
            ]
        })
        */

        var toggle_page_head_div = document.getElementById('toggle-page-head-div')
        toggle_page_head_div.querySelector('a#toggle-page-head').onmouseover = function (evt) {
            $(evt.currentTarget).w2tag('Hide/show header', { position: 'left' })
            _.delay(function () { $(evt.currentTarget).w2tag() }, 2000)
        }
        toggle_page_head_div.querySelector('a#toggle-page-head').onmouseout = function (evt) {
            $(evt.currentTarget).w2tag()
        }
        toggle_page_head_div.querySelector('a#toggle-page-head').onclick = function (evt) {
            evt.preventDefault()
            var display = document.getElementById('page-head').style.display == 'none' ? '' : 'none'
            document.getElementById('page-head').style.display = display
            toggle_page_head_div.querySelector('a#toggle-syncing').style.display = display
            //self.page_head_height = (display == 'none' ? 0 : toggle_page_head_div.getBoundingClientRect().height)
            //evt.currentTarget.innerHTML = '<span class="fa fa-'+(display=='none' ? 'compress' : 'expand')+'-arrows-alt icon-12"></span>'
            //讓按鈕區在擴展的時候看起來順眼些
            if (display == 'none') {
                $(toggle_page_head_div).addClass('expanded')
                self.page_head_height = 0
                evt.currentTarget.innerHTML = '<span class="fa fa-compress-arrows-alt icon-12" style="font-size:0.5em;display:inline-block;">↙</span>'
                //listen to escape event
                self.presentation.on('ESCAPE', function show_page_head(){
                    toggle_page_head_div.querySelector('a#toggle-page-head').click()
                })
            }
            else {
                $(toggle_page_head_div).removeClass('expanded')
                self.page_head_height = 60 //toggle_page_head_div.getBoundingClientRect().height
                evt.currentTarget.innerHTML = '<span class="fa fa-expand-arrows-alt icon-12"></span>'
                self.presentation.off('ESCAPE', 'show_page_head')
            }
            window.dispatchEvent(new Event('resize'));
        }
        toggle_page_head_div.querySelector('a#toggle-syncing').onmouseover = function (evt) {
            $(evt.currentTarget).w2tag('Syncing/decoupling', { position: 'left' })
            _.delay(function () { $(evt.currentTarget).w2tag() }, 2000)
        }
        toggle_page_head_div.querySelector('a#toggle-syncing').onmouseout = function (evt) {
            $(evt.currentTarget).w2tag()
        }
        toggle_page_head_div.querySelector('a#toggle-syncing').onclick = function (evt) {
            evt.preventDefault()
            var yes = (!self.presentation.syncing)
            self.presentation.fire('ACTION', { name: 'syncing', yes: yes })
            if (yes) {
                evt.currentTarget.innerHTML = '<span class="fa fa-teeth icon-12"></span>'
            }
            else {
                evt.currentTarget.innerHTML = '<span class="fa fa-teeth-open red-font icon-12"></span>'
            }
        }

        if (self.screen_frame_ele.classList.contains('readonly')){
            //readonly
        }
        else{
            /* 當使用者按在背景上的時候; 決定「貼上」的對象；在cue時會被解掉，cue完後恢復 */
            self.page_ele_tap_handler = function(evt){
                if (self.page_ele_tap_handler_disable) return
                if (evt.srcElement === self.widget_layer){
                    if (Widget.selected.length) {
                        //unselect all selected widget
                        var widgets = Widget.selected.slice()
                        widgets.forEach(function (widget) {
                            widget.select(false)
                        })
                    }
                    else if (self.screen_frame_ele.classList.contains('selected')){
                        self.screen_frame_ele.classList.remove('selected')
                    }
                    else{
                        self.screen_frame_ele.classList.add('selected')
                    }
                }
                else if (evt.srcElement === self.page_ele){
                    self.screen_frame_ele.classList.remove('selected')
                }
            }
            interact(self.page_ele).on('tap',self.page_ele_tap_handler.bind(self))
            WidgetGallery.singleton.on('selected',function(){
                self.screen_frame_ele.classList.remove('selected')
            })
        }

        //add tabsbar to page-head-div
        var tabsbar_div = document.createElement('div')
        tabsbar_div.setAttribute('id', 'tabsbar')
        document.getElementById('page-head').appendChild(tabsbar_div)
        //add toolbar to page_head_div; will be rendered in set_owner()
        //toolbar; will be rendered in set_owner()
        var toolbar_div = document.createElement('div')
        toolbar_div.setAttribute('id', 'toolbar')
        document.getElementById('page-head').appendChild(toolbar_div)

        /*
        * 此處設定整個畫面的各種重要比例與尺寸
        */
        self.set_size = function () {
            var page_ele = self.page_ele
            // 預設是center-align,有widget dashboard存在時為 left-algin
            var left_align = page_ele.classList.contains('left')
            var tabsbar_div = document.getElementById('tabsbar')
            page_ele.style.top = '0px'
            page_ele.style.left = '0px'
            page_ele.style.width = '100vw'
            page_ele.style.height = '100vh'
            var viewport = page_ele.getBoundingClientRect()
            // 刻意留邊（目前沒有）
            var page_paddings = { top: 0, left: 0, right: 0, bottom: 0 }
            // 全部可用區
            var page_rect = {
                width: viewport.width - (page_paddings.left + page_paddings.right),
                height: viewport.height - (page_paddings.top + page_paddings.bottom),
                top: page_paddings.top,
                left: page_paddings.left
            }
            // 依照比例決定呈現內容的矩型的尺寸與位置
            var ratio = self.presentation.settings.ratio

            // 在resize的情況下，保持reference
            if (!self.content_rect) { //內容可用區（不含工具列）
                self.content_rect = {
                    left_offset : 0 // center-align時 左邊寬度
                }
            }
            var content_rect = self.content_rect
            // 使用page全寬時按比例所需的高度為 h
            var h = Math.round(page_rect.width / ratio[0] * ratio[1])
            if (h + self.page_head_height <= page_rect.height) {
                //使用全寬（高度有餘）
                content_rect.height = h;
                content_rect.width = page_rect.width
                content_rect.left = 0
                //垂直置中
                //content_rect.top =  self.page_head_height + Math.round((page_rect.height -  self.page_head_height - content_rect.height) / 2)
                //垂直置頂的效果可能比較好；因使用者可以調整高度
                content_rect.top = self.page_head_height
            }
            else {
                //使用全高（寬度有餘）
                content_rect.height = page_rect.height - self.page_head_height;
                content_rect.width = Math.round(content_rect.height / ratio[1] * ratio[0])
                content_rect.top = self.page_head_height
                content_rect.left_offset = Math.round((page_rect.width - content_rect.width) / 2)
                content_rect.left = left_align ? 0 : content_rect.left_offset
            }

            //apply
            page_ele.style.left = page_rect.left + 'px'
            page_ele.style.top = page_rect.top + 'px'
            page_ele.style.width = page_rect.width + 'px'
            page_ele.style.height = page_rect.height + 'px'
            self.page_rect = page_ele.getBoundingClientRect()
            //screen_ele.parentNode is #screen-frame
            var page_content = page_ele.querySelector('#page-content')
            page_content.style.left = content_rect.left + 'px'
            page_content.style.top = content_rect.top + 'px'
            page_content.style.width = content_rect.width + 'px'
            page_content.style.height = content_rect.height + 'px'

            document.getElementById('widget-drawer').style.width = content_rect.width + 'px'
            document.getElementById('widget-drawer').style.left = content_rect.left + 'px'

            self.screen_frame_ele.style.width = content_rect.width + 'px'
            self.screen_frame_ele.style.height = content_rect.height + 'px'

            self.screen_ele.style.width = content_rect.width + 'px'
            self.screen_ele.style.height = content_rect.height + 'px'
            toggle_page_head_div.style.left = (content_rect.left + content_rect.width - toggle_page_head_div.getBoundingClientRect().width) + 'px'
            //$('#top').css('padding-left', content_rect.left + 'px')
            //$('#top').css('padding-right', content_rect.left + 'px')
            _.defer(function () {
                self.overlay.set_size({
                    width: content_rect.width,
                    height: content_rect.height,
                    top: content_rect.top,
                    left: content_rect.left
                })
                //been added to screen-frame,so left and top are zero
                self.widget_layer.style.width = content_rect.width + 'px'
                self.widget_layer.style.height = content_rect.height + 'px'
            })

            var panel_name = 'main'
            if (!self.display_areas[panel_name]) {
                self.display_areas[panel_name] = new DisplayArea(self, panel_name)
            }
            var toolbar_div = document.getElementById('toolbar')
            toolbar_div.setAttribute('style', 'width:' + content_rect.width + 'px;left:' + content_rect.left + 'px')
            tabsbar_div.style.width = (content_rect.width - 60) + 'px' //60 is space for #toggle-page-head-div
            tabsbar_div.style.left = content_rect.left + 'px'

            //2019-03-12T06:43:32+00:00 基本上已經不打算使用w2layout，暫時維持共存的方式
            //this is especially required when enter fullscreen mode
            if (w2ui['layout']) w2ui['layout'].resize()

            self.presentation.fire('RESIZE',self.content_rect)
            return true
        }

        if (sbs_user) {
            //this page is in a embedded screen of dashboard
            self.sbs_user = sbs_user
            window.sdk = top.sdk
        }
        else {
            self.sbs_user = new SBSUser(this)
            self.sbs_user.init()
        }

        //listen to remote sync of translate
        //var target_ele0 = self.screen_ele
        //var target_ele1 = document.getElementById('overlay_surface')
        var control_ele = self.page_ele
        var control_rect = null
        self.presentation.on('OFFSET', function (data) {
            if (control_rect === null) control_rect = control_ele.getBoundingClientRect()
            var x = Math.round(data[0] / 1000 * control_rect.width)
            var y = Math.round(data[1] / 1000 * control_rect.height)
            self.move(x, y)
        })

        //listen to presentation's event
        self.presentation.on('SLIDE-ADDED', function (metadata) {
            var t_id = metadata[0]
            var s_idx = metadata[1]
            var as_focus = metadata[2]

            if (self.presentation.current_thread.id == t_id) {
                //update tabs bar
                var page_no = _.size(self.presentation.current_thread.slides)
                //w2ui['tabsbar'].insert('add_slide',{ id: 'p'+page_no, text: ''+page_no, page_no:page_no });
                w2ui['tabsbar'].add({ id: 'p' + page_no, text: '' + page_no, page_no: page_no });
                var slides_quota_remain = self.presentation.get_slide_quota(t_id)
                if (slides_quota_remain > 0) {
                    w2ui['tabsbar'].enable('add_slide')
                }
                else {
                    w2ui['tabsbar'].disable('add_slide')
                }
                w2ui['tabsbar'].refresh()

                if (as_focus) {
                    //navigate to next slide as new focus slide
                    var slide = self.presentation.threads[t_id].slides[s_idx]
                    self.presentation.set_slide(slide)
                }
                else {
                    //refresh current slide, this is for whiteboard
                    //when a folder of multiple images were added
                    self.presentation.rerender_current_slide()
                }
            }

        })

        self.presentation.on('SLIDE-REMOVED', function (metadata) {
            //metadata = [t_id]
            var t_id = metadata[0]
            if (self.presentation.current_thread.id == t_id) {
                self.recreate_tabsbar()
            }
        })

        //implement event-based interactions (action event)
        self.presentation.on('ACTION', function (data) {
            switch (data.name) {
                case 'copy-url':
                    var url = data.args[0]
                    var evt = data.args[1]
                    copyTextToClipboard(url, function (success, errmsg) {
                        if (success) {
                            $('#toggle-page-head-div').w2tag('URL has copied', { position: 'right' })
                            _.delay(function () {
                                $('#toggle-page-head-div').w2tag()
                            }, 1000)
                        }
                        else {
                            w2alert('<textarea id="url_to_copy" readonly="readonly" style="font-size:14px;width:100%;height:100%">' + url + '</textarea>', 'Please DIY')
                            _.delay(function () {
                                var textarea = document.getElementById('url_to_copy')
                                $(textarea).w2tag('Press Ctrl-C to copy', { position: 'top' })
                                textarea.focus();
                                textarea.select();
                            }, 500)
                        }
                    })
                    break
                case 'copy-slide-text':
                    var slide = data.args[0]
                    copyTextToClipboard(slide.resource.content, function (success, errmsg) {
                        if (success) {
                            $('#toggle-page-head-div').w2tag('copied', { position: 'right' })
                            _.delay(function () {
                                $('#toggle-page-head-div').w2tag()
                            }, 1000)
                        }
                        else {
                            w2alert('The browser does not support copy', 'Failure')
                        }
                    })
                    break
                case 'download-slide-text':
                    var slide = data.args[0]
                    var data = new Blob([slide.resource.content], { type: 'text/plain' })
                    var link = document.createElement('a')
                    link.href = URL.createObjectURL(data)
                    link.download = 'slide-' + (slide.idx + 1) + '.txt'
                    link.click()
                    break
                case 'show-qrcode':
                    var url = data.args[0]
                    var title = data.args[1]
                    var w = 400
                    var h = 420
                    w2popup.open({
                        width: w + 'px',
                        height: h + 'px',
                        style: 'overflow:hidden;margin:0;padding:0;',
                        title: title,
                        body: '<iframe style="border:none;padding-top:0px;width:100%;height:99%" src="' + url + '"></iframe>',
                        showMax: false
                    })
                    break
                case 'show-quickshortcut':
                    var code_flag = data.type == 'speaker' ? 2 : 3
                    var set_code = function (code_flag) {
                        countdown.start()
                        self.get_quickshortcut_code(code_flag).done(function (code) {
                            $popup.find('div.quickshortcut .quickshortcut-code').html(code)
                        })
                    }
                    var countdown = {
                        timer: null,
                        $ele: null,
                        stop: function () {
                            if (this.timer) clearInterval(this.timer)
                        },
                        start: function () {
                            var self = this
                            this.stop()
                            this.start_ts = new Date().getTime()
                            var seconds_to_countdown = 60
                            this.timer = setInterval(function () {
                                var diff = seconds_to_countdown - (new Date().getTime() - self.start_ts) / 1000
                                if (diff > 0) {
                                    self.$ele.html(Math.round(diff))
                                }
                                else {
                                    self.$ele.html('Timeout')
                                    self.stop()
                                    _.defer(function () { set_code(code_flag) }, 1000)
                                }
                            }, 1000)
                        }
                    }
                    $('#quickshortcut_div').clone().w2popup({
                        modal: true,
                        onClose: function () {
                            countdown.stop()
                            self.cancel_quickshortcut()
                        }
                    });
                    var $popup = $('#w2ui-popup')

                    _.delay(function () { //wait until dialog to be rendered
                        //assgin countdown.$ele
                        countdown.$ele = $popup.find('div.quickshortcut .countdown')
                        set_code(code_flag)
                        $popup.find('div.quickshortcut button.quickshortcut-change').on('click', function () {
                            set_code(code_flag)
                        })
                        $popup.find('span.code-type').html(code_flag == 2 ? '<span style="color:red">Changable</span>' : 'Read only')
                    }, 100)
                    break
                case 'set-passcode':
                    w2confirm({
                        msg: 'Passcode:<input onchange="window._new_passcode=this.value.trim()" placeholder="public accessible" size=20 maxlength=20 class="w2field w2ui-input" id="passcode" value="' + (self.presentation.acl_token.ps || '') + '">',
                        title: 'Access Control',
                        btn_yes: {
                            class: 'w2ui-btn-blue'
                        },
                        btn_no: {
                            text: 'Cancel'
                        }
                    })
                        .yes(function () {
                            self.presentation.keyboard_shortcut.suspend = false
                            var value = window._new_passcode.trim()
                            delete window._new_passcode
                            if (value !== self.presentation.acl_token.ps) {
                                window.loading(true)
                                self.sbs_user.set_passcode({
                                    p_id: self.presentation.p_id,
                                    flag: self.flag_of_token,
                                    passcode: value
                                }).done(function () {
                                    //update local cache
                                    self.presentation.acl_token.ps = value
                                    window.loading(false)
                                    if (value.length == 0) {
                                        w2alert('passcode has removed')
                                    }
                                    else {
                                        w2alert('passcode has set')
                                    }
                                }).fail(function () {
                                    w2alert('failed on setting passcode')
                                    window.loading(false)
                                })
                            }
                        })
                        .no(function () {
                            self.presentation.keyboard_shortcut.suspend = false
                        });
                    self.presentation.keyboard_shortcut.suspend = true

                    break
                case 'set-sbsname':
                    // (2019-03-09T08:20:28+00:00)本來簡報名稱就是sbs_name，現在改了，兩者分開，因為一個人可以有多個簡報
                    var set_sbs_name = function (name) {
                        var promise = new $.Deferred()
                        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.set_sbs_name'
                        var p_id = self.presentation.p_id
                        var flag = self.flag_of_token
                        var command = new Command(cmd, [p_id, flag, name])
                        window.sdk.send_command(command).done(function (response) {
                            if (response.retcode != 0) {
                                return promise.reject(response.retcode, response.stderr.message, response.stderr)
                            }
                            var ret = response.stdout
                            //自己的名字自己改
                            sdk.user.metadata.name = ret.sbs_name
                            document.cookie = ret.cookie
                            console.log(ret,'<<<<')
                            $('.your-name').html(ret.sbs_name)
                            promise.resolve(ret)
                        }).fail(function (jqXHR, textStatus, errorThrown) {
                            promise.reject(jqXHR.status, jqXHR.statusText)
                        })
                        return promise
                    }
                    w2confirm({
                        msg: 'Name: <input onchange="window._new_sbs_name=this.value.trim()" style="font-size:1.5em" placeholder="empty to reset" size=20 maxlength=20 class="w2field w2ui-input" id="new_sbs_name" value="">',
                        title: 'Change Your Name',
                        btn_yes: {
                            class: 'w2ui-btn-blue',
                            text: 'Save'
                        },
                        btn_no: {
                            text: 'Cancel'
                        }
                    })
                    .yes(function (evt) {
                        self.presentation.keyboard_shortcut.suspend = false
                        var value = window._new_sbs_name
                        delete window._new_sbs_name
                        value = value.replace(/";<>/g, '_')
                        if (value.length > 20) {
                            w2alert('max length is 20')
                            return
                        }
                        else if (value !== sdk.user.metadata.name) {
                            set_sbs_name(value)
                        }
                    })
                    .no(function () {
                        delete window._new_sbs_name
                        self.presentation.keyboard_shortcut.suspend = false
                    })
                    _.defer(function () {
                        //不直接放在html裡面，因為當中可能含有引號
                        console.log('==>sdk.user.metadata.name',sdk.user.metadata.name)
                        $('#new_sbs_name').val(sdk.user.metadata.name)
                    })
                    _.defer(function () {
                        $('#new_sbs_name').focus()
                    }, 500)
                    self.presentation.keyboard_shortcut.suspend = true
                    break
                case 'rename-presentation':
                    // (2019-03-09T08:20:28+00:00)本來簡報名稱就是sbs_name，現在改了，兩者分開，因為一個人可以有多個簡報
                    var set_presentation_name = function (name) {
                        var token = self.presentation.p_id
                        var flag = self.flag_of_token
                        return self.sbs_user.rename_presentation(token,flag,name)
                    }
                    w2confirm({
                        msg: 'Name: <input onchange="window._new_presentation_name=this.value.trim()" style="font-size:1.5em" placeholder="empty to reset" size=30 maxlength=80 class="w2field w2ui-input" id="new_presentation_name" value="">',
                        title: 'Change board name',
                        btn_yes: {
                            class: 'w2ui-btn-blue',
                            text: 'Save'
                        },
                        btn_no: {
                            text: 'Cancel'
                        }
                    })
                    .yes(function (evt) {
                        self.presentation.keyboard_shortcut.suspend = false
                        var value = window._new_presentation_name
                        delete window._new_presentation_name
                        value = value.replace(/";<>/g, '_')
                        if (value.length > 80) {
                            w2alert('too long, max length is 80')
                            return
                        }
                        else if (value !== self.presentation.name) {
                            self.presentation.name = value
                            $('.presentation-name').html(value)
                            set_presentation_name(value)
                        }
                    })
                    .no(function () {
                        delete window._new_presentation_name
                        self.presentation.keyboard_shortcut.suspend = false
                    })
                    _.defer(function () {
                        //目前的值不直接放在html裡面，因為當中可能含有引號
                        $('#new_presentation_name').val(self.presentation.name)
                    })
                    _.defer(function () {
                        $('#new_presentation_name').focus()
                    }, 500)
                    self.presentation.keyboard_shortcut.suspend = true
                    break
                case 'enter-fullscreen':
                    self._requesting_fullscreen = true
                    if (!screenfull.enabled) {
                        self.on_message('Fullscreen is not supported in this browser')
                        return
                    }
                    if (!self._fullscreen_callback) {
                        self._fullscreen_callback = function (evt) {
                            evt.preventDefault()
                            //reset overlay(drawing)
                            self.overlay.draw.clear()
                            //resize
                            window.loading(true, 'reloading', true)
                            _.delay(function () {
                                self.set_size()
                                _.delay(function () {
                                    var panel_name = 'main'
                                    self.display_areas[panel_name].content_fitting()
                                    self.overlay.draw_restore(self.presentation.current_slide.slide_overlay.layers[0])
                                }, 100)
                                window.loading(false)
                            }, 1000)
                        }
                        screenfull.on('change', self._fullscreen_callback)
                    }
                    if (screenfull.isFullscreen) {
                        screenfull.exit();
                    } else {
                        screenfull.request();
                    }
                    break
                case 'reset-all-slides':
                    w2confirm({
                        msg: '<span style="vertical-align:middle;color:red;font-size:50px" class="fa fa-exclamation-triangle">&nbsp;</span>Are you sure you want to empty all slides?',
                        title: 'Hands up!',
                        btn_yes: {
                            class: 'w2ui-btn-red'
                        },
                        btn_no: {
                            text: 'Cancel'
                        }
                    })
                        .yes(function () {
                            self.presentation.reset_all_slides(self.presentation.current_thread.id)
                        })
                    break
                case 'remove-all-slides':
                    w2confirm({
                        msg: '<span style="vertical-align:middle;color:red;font-size:50px" class="fa fa-exclamation-triangle">&nbsp;</span>Are you sure you want to remove all slides?',
                        title: 'Hands up!',
                        btn_yes: {
                            class: 'w2ui-btn-red'
                        },
                        btn_no: {
                            text: 'Cancel'
                        }
                    })
                        .yes(function () {
                            self.presentation.remove_slides_of_idx(self.presentation.current_thread.id)
                        })
                    break
                case 'forget-me':
                    var confirm_count = data.confirm_count || 1
                    var message;
                    if (confirm_count == 1) {
                        message = 'Are you sure you want to purge all your assets?'
                    }
                    else if (confirm_count == 2) {
                        message = 'Again, are you sure you want to purge all your assets?'
                    }
                    else if (confirm_count == 3) {
                        message = 'Once Again, are you really sure you want to purge all your assets?'
                    }
                    w2confirm({
                        msg: '<span style="vertical-align:middle;color:red;font-size:50px" class="fa fa-exclamation-triangle">&nbsp;</span> ' + message,
                        title: 'Hands up!',
                        btn_yes: {
                            class: 'w2ui-btn-red'
                        },
                        btn_no: {
                            text: 'Cancel'
                        }
                    })
                    .yes(function () {
                        if (confirm_count < 3) {
                            _.defer(function () {
                                self.presentation.fire('ACTION', { name: 'forget-me', confirm_count: confirm_count + 1 })
                            })
                        }
                        else {
                            self.sbs_user.forget_me().done(function(number_of_presentations){
                                w2alert(number_of_presentations+' presentations has removed, bye-bye!').done(function(){
                                    location.href = '/'
                                })
                            })
                        }
                    })
                    break
                case 'who_are_joining':
                    self.who_are_joining().done(function (joiners) {
                        var html = [document.getElementById('who_are_join_page_header').innerHTML,
                            '<table class="popup-table">',
                            '<tr><th style="width:40px">No</th><th>Name</th></tr>'
                        ]
                        joiners.sort(function (a, b) { return a[0] > b[0] ? 1 : (a[0] < b[0] ? -1 : 0) })

                        _.each(joiners, function (joiner, idx) {
                            var sbs_name = joiner[0]
                            var userhash = joiner[1]
                            var role_flag = joiner[2]
                            var is_me = (sbs_name == sdk.user.metadata.name)
                            var value
                            /*
                            if (is_me){
                                if (self.presentation.is_owner){
                                    value = sbs_name+'(You)' //already in my board
                                }
                                else{
                                    //go my own board
                                    value = '<a href="#" class="go_board" sbs_name="'+escape(sbs_name)+'" userhash="">'+sbs_name+'(You)</a>'
                                }
                            }
                            else{
                                if (self.presentation.name == sbs_name){
                                    value = sbs_name //already in this board
                                }
                                else{
                                    value = '<a href="#" class="go_board" sbs_name="'+escape(sbs_name)+'" userhash="'+escape(userhash)+'">'+sbs_name+'</a>'
                                }
                            }
                            */
                            //不要提供連結
                            if (is_me) {
                                value = sbs_name + '(You)' //already in my board
                            }
                            else {
                                value = sbs_name //already in this board
                            }
                            html.push('<tr><td style="padding:5px">' + (1 + idx) + '</td><td>' + value + '</td>')
                            /* 因binding功能取消，暫時取消此欄位
                            if (role_flag == 1){
                                if (is_me){//i am owner or binder
                                    html.push('<td></td>')
                                }
                                else{
                                    html.push('<td></td>')
                                }
                            }
                            else if (role_flag == 2) { //binder；
                                if (is_me){
                                    html.push('<td><a href="#" class="to_unbind">unbind</a></td>')
                                }
                                else if(userhash){ //i am owner
                                    html.push('<td><a userhash="'+userhash+'" sbs_name="'+escape(sbs_name)+'" href="#" class="to_break">Break binding</a></td>')
                                }
                                else{
                                    html.push('<td></td>')
                                }
                            }
                            else if (userhash){ //i am owner
                                //暫時取消binding功能；降低功能的複雜度
                                //html.push('<td><a userhash="'+userhash+'" href="#" class="to_invite">Invite to bind</a></td>')
                                html.push('<td></td>')
                            }
                            else{
                                html.push('<td></td>')
                            }
                            */
                            html.push('</tr>')
                        })

                        html.push('</table>')
                        w2popup.open({
                            width: 500,
                            height: 500,
                            title: 'Who are joining',
                            body: html.join(''),
                            buttons: ' <div class="w2ui-field"><label>Shortcut code:</label><div><input id="shortcut-code-togo"><button class="w2ui-btn open-shortcut-code">Open</button></div></div>',
                            showMax: false,
                            style: 'padding:0;margin:0;width:100%;background-color:#f0f0f0'
                        })
                        _.delay(function () {
                            var $popup = $('#w2ui-popup')
                            /* 這三個跟bind功能有關，暫時取消
                            $popup.find('a.to_invite').on('click',function(evt){
                                evt.preventDefault()
                                var userhash = evt.currentTarget.getAttribute('userhash')
                                self.invite_binding(userhash).done(function(response){
                                    w2alert('Binding invitation has sent to target device').done(function(){
                                        w2popup.close()
                                    })
                                })
                            })
                            $popup.find('a.to_unbind').on('click',function(evt){
                                evt.preventDefault()
                                self.presentation.fire('ACTION',{name:'to_unbind',args:{sbs_name:self.presentation.name}})
                            })
                            $popup.find('a.to_break').on('click',function(evt){
                                evt.preventDefault()
                                var userhash = evt.currentTarget.getAttribute('userhash')
                                var sbs_name = unescape(evt.currentTarget.getAttribute('sbs_name'))
                                self.presentation.fire('ACTION',{name:'to_unbind',args:{userhash:userhash,sbs_name:sbs_name}})
                            })
                            */
                            /*
                            $popup.find('a.go_board').on('click',function(evt){
                                evt.preventDefault()
                                var userhash = unescape(evt.currentTarget.getAttribute('userhash'))
                                var sbs_name = unescape(evt.currentTarget.getAttribute('sbs_name'))
                                var url = location.pathname + (userhash == '' ? '' : '#0'+userhash)
                                open(url,sbs_name)
                            })
                            */
                            var go_shortcut_code = function (evt) {
                                evt.preventDefault()
                                var shortcut_code = $('#shortcut-code-togo').val()
                                if (/^\d{6}$/.test(shortcut_code)) {
                                    var url = location.pathname + '#0' + shortcut_code
                                    open(url)
                                }
                                else {
                                    w2popup.message({
                                        width: 250,
                                        height: 170,
                                        body: '<div class="w2ui-centered">requires 6 digits</div>',
                                        buttons: '<button class="w2ui-btn" onclick="w2popup.message()">Ok</button>'
                                    });
                                }
                            }
                            $popup.find('#shortcut-code-togo').on('change', go_shortcut_code)
                            $popup.find('button.open-shortcut-code').on('click', go_shortcut_code)
                        }, 500)
                    })
                    break
                case 'syncing':
                    var yes = data.yes
                    self.presentation.syncing = yes
                    if (self.presentation.syncing) {
                        //restore screen
                        var t_id = self.presentation.current_thread.id
                        var my_slide_id = self.presentation.current_slide.id
                        if (my_slide_id == self.presentation.thread_settings[t_id].slide_id) {
                            self.presentation.rerender_current_slide()
                        }
                        else {
                            var slide = self.presentation.current_thread.get_slide_of_id(self.presentation.thread_settings[t_id].slide_id)
                            self.presentation.set_slide(slide)
                        }
                    }
                    break
                case 'to_unbind':
                    var sbs_name = data.args.sbs_name
                    var userhash = data.args.userhash || ''
                    w2confirm({
                        msg: '<span style="vertical-align:middle;font-size:50px;color:red" class="fa fa-exclamation-triangle">&nbsp;</span>Are you sure you would break the binding of ' + sbs_name + '?',
                        title: 'Break Binding',
                        btn_yes: {
                            class: 'w2ui-btn-red',
                            text: 'Break'
                        },
                        btn_no: {
                            text: 'Cancel'
                        },
                        callBack: function (ans) {
                            if (ans != 'Yes') return
                            self.to_unbind(userhash).done(function (ret) {
                                // go default whiteboard
                                if (userhash) {
                                    //self.presentation.fire('UNBIND'
                                    console.log(ret, '<<<')
                                }
                                else {
                                    _.delay(function () {
                                        //aka whiteboard.html without hash
                                        window.sdk.logout().done(function () {
                                            window.location.href = location.pathname
                                        })
                                    }, 500)
                                }
                            }).fail(function (retcode, errmsg) {
                                w2alert(errmsg, 'Failure')
                            })
                        }
                    })
                    break
                /*
                case 'open-widgets':
                    //hide, show the widget gallery's frame
                    if (data.yes) {
                        w2ui.layout.show('top')
                        self.page_ele.style.marginTop = - self.page_head_height + 'px'
                    }
                    else {
                        w2ui.layout.hide('top')
                        self.page_ele.style.marginTop = '0px'
                    }
                    break
                */
                case 'cue-enable':
                    //這裡的code是enable_cue, disable_cue的意義
                    var yes = data.yes

                    //remove selected widget or background
                    if (Widget.selected.length) Widget.selected[0].select(false)
                    self.screen_frame_ele.classList.remove('selected')

                    var rect = self.content_rect
                    var tap_handler_timer = 0
                    var emit_cue_sync = _.throttle(function (point) {                        
                        if (point){
                            point.cw = self.content_rect.width
                            point.ch = self.content_rect.height
                        }
                        self.presentation.send_to_bus('cue-sync', ['cue', point])
                    }, 100, { leading: false })

                    var enable_cue = function(){

                        if (self.zoomout_enabled) {
                            self.disable_zoomout()
                        }
                        if (self.draw_enabled) {
                            self.disable_draw()
                        }
                        if (self.presentation._scale > 1) {
                            self.reset_zooming()
                        }
                        //在螢幕中間顯示一個大長方形
                        self.cue_center_square = document.createElement('div')
                        //self.cue_center_square.style = 'border:solid 1px red;'
                        self.cue_center_square.innerHTML = '<img src="cue.svg" style="width:100%;height:100%"/>'
                        var c200 =  64 //Constant.scale(2 * 32);
                        $(self.cue_center_square).css({
                            position:'absolute',
                            width:  c200+'px',
                            height:  c200+'px',
                            pointerEvents:'none',
                            left:self.content_rect.left + Math.round((self.content_rect.width-c200)/2) + 'px',
                            top:self.content_rect.top + Math.round((self.content_rect.height-c200)/2) + 'px',
                            display:'none'
                        })
                        document.querySelector('#page').appendChild(self.cue_center_square)

                        // 讓cursor變成一個小長方形
                        self.screen_frame_ele.classList.add('cue-enabled')

                        self.cuing_info = null //被cue中的widget

                        /*
                        var selected_handler = function (widget) {
                            //cue的時候可以被選定會比較好用，例如iframe被選定時可以跟內部的網頁互動
                            //widget.select(false)
                            var delay = 0
                            if (self.cuing_info && self.cuing_info.id == widget.id) {
                                //允許使用在這個widget被cue的時候操作此widget
                                return
                            }
                            else if (self.cuing_info) {
                                //another widget got cued
                                //解掉目前的cue,等動畫結束後再cue新選的那個

                                //hide big square
                                //self.cue_center_square.style.display = 'none'
                                //show little square
                                //self.screen_frame_ele.classList.remove('zoomed-in')

                                self.reset_zooming(true)
                                delay = 210 //.cuing的transition是0.2s
                            }

                            var cue_to_widget = function (delay) {
                                //show big square
                                self.cue_center_square.style.display = ''
                                //hide little square
                                self.screen_frame_ele.classList.add('zoomed-in')

                                if (tap_handler_timer) {
                                    clearTimeout(tap_handler_timer)
                                    tap_handler_timer = 0
                                }
                                self.cuing_info = {id:widget.id}
                                var bbox = widget.state_manager.get_bbox()
                                if (bbox.width > rect.width * 0.5) {
                                    var s = Math.round(rect.width/bbox.width* 100)/100
                                }
                                else {
                                    var  s = 2 //zoomin scale
                                }
                                var point = {
                                    x: bbox.cx,
                                    y: bbox.cy,
                                    s: s
                                }
                                self.cue(point,0)
                                emit_cue_sync(point)
                            }
                            if (delay) setTimeout(function () { cue_to_widget() }, delay)
                            else cue_to_widget()
                        }
                        */
                        self.presentation.on('PAGE-WILL-CHANGE',function do_uncue(){
                            disable_cue()
                        })
                        var tap_handler = function (evt) {
                            // 防止screen-frame的tap(select/unselect)事件被驅動
                            // 2019-03-21T13:26:22+00:00 在interact.js 新版中好像沒作用
                            evt.stopPropagation()

                            // 2019-03-21T13:32:02+00:00 目前只要有選定的widget被cue，
                            // 暫時只能點按該widget來解掉cue
                            //if (Widget.selected.length) {
                            //    return
                            //}

                            /*
                             選擇道具時這一個事件會先發生為了避免這個情況的干擾所以用一個計時器來控制
                            */
                            var point = {
                                x: evt.pageX - self.content_rect.left, //touch.js 直接提供pageX,不必判別是否為touch event 
                                y: evt.pageY - self.content_rect.top,
                                s: 2 //scale
                            }
                            if (self.cuing_info) {
                                //解讀為解cue的動作；解掉目前被cue的widget或cursor
                                self.cue(null,210) //.cuing的transition是0.2s
                                emit_cue_sync(null)
                                return
                            }
                            else{
                                self.screen_frame_ele.classList.add('zoomed-in')
                                self.cue(point,210)
                                emit_cue_sync(point)
                            }
                        }

                        //把螢幕translate到物件，請把zoomout screen讓物件成為主角
                        interact(self.screen_frame_ele).on('tap', tap_handler)
                    }
                    var disable_cue = function() {
                        self.cue(null)
                        if (self.cue_center_square){
                            self.cue_center_square.parentNode.removeChild(self.cue_center_square)
                            self.cue_center_square = undefined
                        }
                        self.presentation.off('PAGE-WILL-CHANGE','do_uncue')
                        //delete self.page_ele_tap_handler_disable
                        self.screen_frame_ele.classList.remove('cuing','cued','cue-enabled','zoomed-in')
                        // 拿掉螢幕中間的大長方形
                        //document.querySelector('#page').removeChild(self.cue_center_square)
                        //self.cue_center_square = undefined
                        //把螢幕translate到物件，請把zoomout screen讓物件成為主角
                        interact(self.screen_frame_ele).unset()


                        //WidgetGallery.singleton.off('selected', self._handlers.selected)
                        //delete self._handlers

                    }
                    yes ? enable_cue() : disable_cue()
                    break
                case 'widget-drawer':
                    if (data.yes){
                        document.querySelector('#widget-drawer').classList.remove('close')
                        _.defer(function(){
                            document.querySelector('#widget-drawer').classList.add('open')
                        })
                    }
                    else{
                        document.querySelector('#widget-drawer').classList.remove('open')
                        _.delay(function(){
                            document.querySelector('#widget-drawer').classList.add('close')
                        },100)//transition is 0.1s

                    }
                    break
                case 'show-boards':
                    self.show_boards()
                    break
                case 'page-align':
                    if (data.side == 'left'){
                        self.page_ele.classList.add('left')
                    }
                    else{
                        self.page_ele.classList.remove('left')
                    }
                    self.set_size()
                    break
            }
        })
    },
    //original: fire_event
    update_toolbar: function (name, data) {
        if (this.toolbar_hidden_group == 1) return
        switch (name) {
            case 'pointer:enable':
                var enabled = data
                if (w2ui['toolbar'].get('pointer')) {
                    //audience screen has no this item
                    if (enabled) {
                        w2ui['toolbar'].show('pointercolor')
                        w2ui['toolbar'].get('pointer').icon += ' active'
                    }
                    else {
                        w2ui['toolbar'].hide('pointercolor')
                        w2ui['toolbar'].get('pointer').icon = w2ui['toolbar'].get('pointer').icon.replace(/ active/, '')
                    }
                    w2ui['toolbar'].refresh('pointer')
                }
                break
            case 'camera:enable':
                var enabled = data
                if (w2ui['toolbar'].get('camera')) {
                    //audience screen has no this item
                    if (enabled) {
                    }
                    else {
                    }
                }
                break
            case 'draw:enable':
                //update buttons of draw-family on the toolbar
                var visible = data
                if (w2ui['toolbar'].get('draw')) {
                    //audience screen has no this item
                    if (visible) {
                        _.each(['drawcolor', 'drawsize', 'draweraser', 'drawclear'], function (name) {
                            w2ui['toolbar'].show(name)
                        })
                        _.each(['textmenu', 'slidebgcolor', 'background'], function (name) {
                            w2ui['toolbar'].hide(name)
                        })
                        w2ui['toolbar'].get('draw').icon += ' active'
                    }
                    else {
                        _.each(['drawcolor', 'drawsize', 'draweraser', 'drawclear'], function (name) {
                            w2ui['toolbar'].hide(name)
                        })
                        _.each(['textmenu', 'slidebgcolor', 'background'], function (name) {
                            w2ui['toolbar'].show(name)
                        })
                        w2ui['toolbar'].get('draw').icon = w2ui['toolbar'].get('draw').icon.replace(/ active/, '')
                    }
                    w2ui['toolbar'].refresh('draw')
                }
                break
            case 'zoomout:enable':
                //update buttons of draw-family on the toolbar
                var enabled = data
                if (w2ui['toolbar'].get('zoomout')) {
                    //audience screen has no this item
                    if (enabled) {
                        w2ui['toolbar'].get('zoomout').icon += ' active'
                    }
                    else {
                        w2ui['toolbar'].get('zoomout').icon = w2ui['toolbar'].get('zoomout').icon.replace(/ active/, '')
                    }
                    w2ui['toolbar'].refresh('zoomout')
                }
                break
        }
    },

    on_presentation_did_init: function () {
        var self = this

        // set_size requires "presentation ratio" to be available
        // so it is called here
        self.set_size()
        /*
                    // 等slide 內容render完 ，widget_layer.getBoundingBoxRect()有數值之後再呼叫 set_content，
                    WidgetGallery.singleton.set_context({
                        presentation: self.presentation,
                        layer: self.widget_layer,
                        dashboard: document.querySelector('#widget-dashboard'),
                        drawer:document.querySelector('#widget-drawer')
                    })
                */
        var options = self.sbs_user.preferences.get('screen').draw
        //console.log('options=',options)
        self.overlay.init(options) //should after resize()

        self.readonly = self.presentation.readonly

        //hook to dashboard if this is an embedded screen
        if (self.presentation.isolated) {
            top.dashboard.presentation_screen = self
        }
        else {
            // the code block below is to render slide.
            // it might depends on delegate to be initialized
            // so we run it later after promise.resolve(self) been called
            setTimeout(function () {
                self.presentation.change_to_thread().done(function(){
                    // 等slide 內容render完 ，widget_layer.getBoundingBoxRect()有數值之後再呼叫 set_content，
                    WidgetGallery.singleton.set_context({
                        presentation: self.presentation,
                        layer: self.widget_layer,
                        content_rect:self.content_rect,
                        dashboard: document.querySelector('#widget-dashboard'),
                        drawer:document.querySelector('#widget-drawer')
                    })
                })
                self.recreate_tabsbar()
            })
        }

        if (_.size(self.presentation.threads) == 0) return

        if (!self._escape_handler) {
            //add once only, don't add twice in case of re-connection
            self._escape_handler = function () {
                _.defer(function () { //why defer?
                    if (self.draw_enabled) {
                        self.disable_draw()
                    }
                    if (w2ui['toolbar'].get('cue').icon.indexOf('active') > 0) {
                        //disable cue
                        console.log('call disable cue')
                        w2ui['toolbar'].click('cue')
                    }

                    if (self.zoomout_enabled) {
                        console.log('call disable zooming')
                        self.disable_zoomout(true)
                        self.reset_zooming(true)
                    }
                    else if (self.presentation._scale > 1) { //scale
                        console.log('call reset zooming')
                        self.reset_zooming(true)
                    }
                    else{
                        console.log('do noting to zoom')
                    }
                    self.screen_frame_ele.classList.remove('selected')

                    self.presentation.fire('ACTION', { name: 'widget-drawer', yes:false})

                    if (Widget.selected.length) Widget.selected[0].select(false)

                    _.defer(function () {
                        //delay to avoid sending sync be conflicted with reset_zooming()
                        if (self.pointers.enabled) {
                            self.pointers.disable()
                        }
                    })
                })
            }
            self.presentation.on('ESCAPE', self._escape_handler)
        }

        // create items for toolbar
        var common_items = [] //will not toggle
        var group0_items = [] //will not toggle
        var group1_items = []
        var group2_items = []
        var toolbar_hidden_cache = {} //for restore visible state

        //color candidates for random picking
        var colors = ['ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff']

        if (self.readonly) {
            //for audience screen
            //group1_items.push({type:'button',id:'qrcode_audience',text:'QRcode'})
            group0_items.push({ type: 'spacer' })
            group0_items.push({ type: 'break' })
            group0_items.push({ type: 'html', id: 'members_count', html: '<span class="members-count">' + self.presentation.members_count + '</span>', tooltip: 'number of connections' })
            group0_items.push({ type: 'break' })
            var yourname_items = [
                { id: 'change_your_name', text: 'Change My Name', icon: 'fa fa-address-card' },
                { id: 'my_board', text: 'My Own Board', icon: 'fa fa-chalkboard-teacher' },
            ]
            group0_items.push({ type: 'menu', id: 'your_name', text: '<span class="your-name">' + sdk.user.metadata.name + '</span>', tooltip: 'your name', items: yourname_items, overlay: { width: 150, left: 100 } })
        }
        else {
            // let the embeded iframe to be top layer for original control, ex google slides
            group1_items.push({
                type: 'button', id: 'origin',
                text: 'Unlock', icon: 'fa fa-lock-open', hidden: true,
                tooltip: 'interactive with the original content'
            })

            //for speacker sceeen, dashboard embedded screen
            group1_items.push({ type: 'button', id: 'pointer', text: 'Pointer', icon: 'fa fa-meteor' })
            group1_items.push({ type: 'color', id: 'pointercolor', color: self.pointers.meta.color, hidden: true })

            group1_items.push({ type: 'check', id: 'cue', text: 'Cue', icon: 'fa fa-eye', tooltip: 'cue to the clicked spot' })

            group1_items.push({ type: 'button', id: 'draw', text: 'Marker', tooltip: 'Draw something on the slide', icon: 'fa fa-marker' })

            var color = self.sbs_user.preferences.get('screen').draw.color
            if (color == '') {
                //default state, randomly pickup one
                color = colors[Math.floor(Math.random() * colors.length)]
            }
            group1_items.push({ type: 'color', id: 'drawcolor', color: color, hidden: true, transparent: false })
            self.overlay.set_options({ color: '#' + color })

            group1_items.push({ type: 'button', id: 'drawsize', hidden: true, text: 'Pen Size', icon: 'fa fa-dot-circle' })
            group1_items.push({ type: 'check', id: 'draweraser', hidden: true, text: 'Eraser', icon: 'fa fa-backspace' })
            group1_items.push({ type: 'button', id: 'drawclear', hidden: true, text: 'Clear', icon: 'fa fa-eraser' })

            var textmenu_items = []
            textmenu_items.push({ id: 'copy-code', text: 'Copy', icon: 'fa fa-copy' })
            textmenu_items.push({ id: 'download-code', text: 'Download', icon: 'fa fa-download' })
            textmenu_items.push({ text: '-' })
            textmenu_items.push({ id: 'line-wrap', text: 'Wrap', icon: 'fa fa-exchange-alt' })
            textmenu_items.push({ id: 'line-nowrap', text: 'No Wrap', icon: 'fa fa-bars' })
            textmenu_items.push({ text: '-' })
            textmenu_items.push({ id: 'clear-hilights', text: 'Clear Hilights', icon: 'fa fa-bell-slash', disabled: true })
            textmenu_items.push({ text: '-' })
            textmenu_items.push({ id: 'go-line', text: 'Jump to Line', icon: 'fa fa-arrow-right' })
            textmenu_items.push({ id: 'go-top', text: 'Back to Top', icon: 'fa fa-arrow-up' })
            group1_items.push({ id: 'textmenu', icon: 'fa fa-code', type: 'menu', text: 'Code', items: textmenu_items, disabled: true, tooltip: 'text-related actions', overlay: { width: 150 } })

            if (mobileAndTabletcheck()) {
                // Android can not detect zooming by pinch, only iOS supports zooming
                if (window.is_iOS()) {
                    //zoomout is auto-enabled, and not able to disable, so don't add button here
                    group1_items.push({ type: 'button', id: 'zoomoutreset', text: 'Reset', tooltip: 'reset zoom (escape)', hidden: true, icon: 'fa fa-search-plus' })
                }
            }
            else {
                //desktop; zoom 先隱藏，可能有cue就夠了
                group1_items.push({ type: 'button', id: 'zoomout', text: 'Zoom', hidden: true, tooltip: 'zoom with mouse-wheel', icon: 'fa fa-search-plus', disabled: true })
                group1_items.push({ type: 'button', id: 'zoomoutreset', text: 'Reset', tooltip: 'reset zoom (escape)', hidden: true, icon: 'fa fa-search-plus' })
            }

            group1_items.push({ type: 'spacer' })
            group1_items.push({ type: 'break' })

            //背景是影片時才出現
            group1_items.push({ type: 'button', id: 'background-play', text: 'Play', icon: 'fa fa-play',hidden:false,
                onClick:function(evt){
                    var item = evt.item
                    var yes = item.icon.indexOf('active') == -1 ? true : false
                    if (yes){
                        item.icon = 'fa fa-pause active'
                        item.text = 'Pause'
                    }
                    else{
                        item.icon = 'fa fa-play'
                        item.text = 'Play'
                    }
                    w2ui['toolbar'].refresh(evt.target)

                    // 背景的player有放一份在w2ui['toolbar']這裡，直接取來用（有點怪的實作）
                    var player = w2ui['toolbar'].player
                    var t_id = self.presentation.current_thread.id
                    var s_idx = self.presentation.current_slide.idx
                    var video_state = yes ? 1 : 2 //1 for play, 2 for pause
                    var video_current_time = player.getCurrentTime()
                    var player_now = new Date().getTime()/1000
                    var args = [t_id, s_idx, [video_state, video_current_time, player_now]]
                    self.presentation.send_to_bus('slide-sync', args)

                    //開始播放或停止
                    if (yes) player.playVideo()
                    else player.pauseVideo()
                }
            })

            var background_items = []
            if (mobileAndTabletcheck()) {
                background_items.push({ type: 'button', id: 'getfromcamera', text: 'Camera', icon: 'fa fa-camera' })
                background_items.push({ type: 'button', id: 'getfromphoto', text: 'Photo', icon: 'fa fa-images' })
            }
            else {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    background_items.push({ type: 'button', id: 'getfromwebcam', text: 'WebCam Picture', icon: 'fa fa-camera' })
                    //request webcam testing, if failed, remove webcam button
                    /* temporary disable because safari too noisy
                    _.defer(function(){
                        var constraints = {
                            audio: false,
                            video: true,
                            frameRate : {min: 5, max: 8 },
                            facingMode: { exact: "environment" },
                            video: {width:{min:640},height:{min:480}}
                        };
                        navigator.mediaDevices.getUserMedia(constraints).then(function(stream){
                            stream.getVideoTracks()[0].stop()
                        }).catch(function(){
                            w2ui['toolbar'].remove('background:getfromwebcam')
                        });
                    })*/
                }
                background_items.push({ type: 'button', id: 'getfromupload', text: 'Upload', icon: 'fa fa-file-image' })
                background_items.push({type:'breaker'})
                background_items.push({ type: 'button', id: 'remove', text: 'Remove', icon: 'fa fa-camera' })
                var $upload_ele = $('#upload_ele')
                $upload_ele.on('change', function (e) {
                    if ($upload_ele[0].files.length) {
                        if ($upload_ele[0].files.length == 1) {
                            var data = {
                                is_directory: false,
                                is_file: true,
                                file: $upload_ele[0].files[0]
                            }
                            self.on_dnd(data, null)
                        }
                        else {
                            var data = {
                                is_directory: true,
                                is_file: false,
                                files: $upload_ele[0].files
                            }
                            self.on_dnd(data, null)
                        }
                    }
                })
            }
            group1_items.push({ type: 'menu', id: 'background', text: 'Background', items: background_items, icon: 'fa fa-image', overlay: { width: 180 }, tooltip: 'image of background' })
            group1_items.push({ type: 'color', id: 'slidebgcolor', color: 'ff0000', tooltip: 'color of background' })
            group1_items.push({ type: 'break' })
            /*
            group1_items.push({ type: 'button', id: 'insert_slide', icon: 'fa fa-plus', tooltip: 'insert a new slide' })
            group1_items.push({ type: 'button', id: 'reset_slide', icon: 'fa fa-undo', tooltip: 'reset this slide' })
            group1_items.push({ type: 'button', id: 'remove_slide', icon: 'fa fa-trash', tooltip: 'remove this slide' })
            */
            group1_items.push({ type: 'menu', id: 'slide', text: 'Slide',icon: 'fa fa-image', overlay: { width: 180 },items:[
                { type: 'button', id: 'toggle_widget_panel', text: 'Open widget panel', icon: 'fa fa-puzzle-piece' }
                ,{ type: 'button', id: 'toggle_widget_drawer', text: 'Open widget drawer', icon: 'fa fa-boxes' }
                ,{type:'break'}
                ,{ type: 'button', id: 'save_widget_states', text: 'Save widget states', icon: 'fa fa-save' }
                ,{ type: 'button', id: 'restore_widget_states', text: 'Restore widget states', icon: 'fa fa-share' }
                ,{type:'break'}
                ,{ type: 'button', id: 'insert_slide', text: 'Add new slide', icon: 'fa fa-plus' }
                ,{ type: 'button', id: 'reset_slide', text: 'Reset this slide', icon: 'fa fa-undo' }
                ,{ type: 'button', id: 'remove_slide', text: 'Delete this slide', icon: 'fa fa-trash' }
            ]})

            //group 0 starts
            group0_items.push({ type: 'spacer' })
            group0_items.push({ type: 'break' })
            group0_items.push({ type: 'button', id: 'members_count', text: '<span class="members-count">' + self.presentation.members_count + '</span>', tooltip: 'who are joining' })
            group0_items.push({ type: 'break' })
            var yourname_items = [
                { id: 'change_your_name', text: 'Change My Name', icon: 'fa fa-address-card' },
            ]
            if (!self.presentation.is_owner){
                yourname_items.push({ id: 'my_board', text: 'My Own Board', icon: 'fa fa-chalkboard-teacher' })
            }
            group0_items.push({ type: 'menu', id: 'your_name', text: '<span class="your-name">' + sdk.user.metadata.name + '</span>', tooltip: 'your name', items: yourname_items, overlay: { width: 150, left: 50 } })
            //group0_items.push({type:'button',id:'test',text:'test'})
            //group 2 toolbar items
            var audience_menu_items = [
                { text: '<span style="padding-bottom:5px;display:inline-block;width:100%;font-weight:bold;color:blue;text-align:center">Read Only Sharing</span>' },
                { text: '-' },
                { id: 'copy-url', text: 'Copy URL', tooltip: 'copy the URL of this board', icon: 'fa fa-globe' },
                { id: 'show-qrcode', text: 'Show QRCode', tooltip: 'show the QRcode URL of this board', icon: 'fa fa-qrcode' },
                { id: 'show-quickshortcut', text: 'Shortcut Code', tooltip: 'Show the code for quick access', icon: 'fa fa-directions' },
            ]
            group2_items.push({ type: 'menu', id: 'audience', text: 'Audience', items: audience_menu_items, icon: 'fa fa-globe', tooltip: 'read only access' })

            var speaker_menu_items = [
                { text: '<span style="padding-bottom:5px;display:inline-block;width:100%;font-weight:bold;color:red;text-align:center">Caution: Changable Sharing</span>' },
                { text: '-' },
                { id: 'copy-url', text: 'Copy URL', tooltip: 'copy the URL of this board', icon: 'fa fa-globe' },
                { id: 'show-qrcode', text: 'Show QRCode', tooltip: 'show the QRcode URL of this board', icon: 'fa fa-qrcode' },
                { id: 'show-quickshortcut', text: 'Shortcut Code', tooltip: 'Show the code for quick access', icon: 'fa fa-directions' },
            ]
            group2_items.push({ type: 'menu', id: 'speaker', text: 'Co-Author', items: speaker_menu_items, icon: 'fa fa-user-edit', tooltip: 'be able to change content', overlay: { width: 200 } })
            var next_ratio = self.presentation.settings.ratio[0] == 4 ? '16:9' : '4:3'
            var settings_menu_items = [
                { id: 'enter-fullscreen', text: 'Enter Full Screen', icon: 'fa fa-expand' },
                { id: 'screen-ratio', text: 'Switch to ' + next_ratio, tooltip: '', icon: 'fa fa-map' },
                { text: '-' },
                { id: 'reset-all-slides', text: 'Reset All Slides', tooltip: '', icon: 'fa fa-undo' },
                { id: 'remove-all-slides', text: 'Remove All Slides', tooltip: '', icon: 'fa fa-trash' },
                /*
                {text:'-'},
                {id:'binder-list',text:'Binded Devices',disabled:true, tooltip:'',icon:'fa fa-arrow-up'},
                {id:'break-binding',text:'Break Binding',disabled:true, tooltip:'',icon:'fa fa-arrow-up'},
                */
            ]
            //overlay width make menu popup dialog has no scrollbar in safari
            group2_items.push({ type: 'menu', id: 'settings', text: 'Settings', items: settings_menu_items, icon: 'fa fa-cogs', overlay: { width: 200 } })
            if (self.presentation.is_owner) {
                var privacy_menu_items = [
                    { id: 'set-passcode', text: 'Set Passcode', tooltip: 'set passcode to limit access', icon: 'fa fa-key' },
                    { text: '-' },
                    { id: 'forget-me', text: 'Forget Me', tooltip: 'purge everything', icon: 'fa fa-user-times' },
                ]
                group2_items.push({ type: 'menu', id: 'privacy', text: 'Privacy', items: privacy_menu_items, icon: 'fa fa-recycle', overlay: { width: 150 } })
            }
            group2_items.push({ type: 'spacer' })
            group2_items.push({ type: 'button', id: 'boards', text: 'Boards', tooltip: '', icon: 'fa fa-info-circle' })
            group2_items.push({ type: 'break' })
            group2_items.push({ type: 'menu', id: 'help', text: 'Help', tooltip: '', icon: 'fa fa-info-circle',items:[
                {id:'github',text:'Issues',icon:'fa fa-info'},
                {id:'break1',text:'-'},
                {id:'ccsearch',text:'CC Search',icon:'fa fa-global'}

            ]})

            _.each(group1_items, function (item) {
                item.group = 1
                toolbar_hidden_cache[item.id] = item.hidden || false
            })
            _.each(group2_items, function (item) {
                item.group = 2
                toolbar_hidden_cache[item.id] = item.hidden || false
                item.hidden = true
            })
            var toggle_group_button = { group: 0, type: 'button', text: '<span class="fa fa-hand-pointer icon-15">&nbsp</span>', id: 'toggle-group', icon: '', tooltip: 'toggle toolbar items' }
            common_items.push(toggle_group_button)
            common_items.push({ type: 'break' })
        }
        //group0_item at the end because they are at the right
        var items = _.concat(common_items, group1_items, group2_items, group0_items)
        if (mobileAndTabletcheck()) {
            //remove all tooltips for mobile devices, because w2ui
            //can not handle them well
            _.each(items, function (item) {
                delete item.tooltip
            })
        }

        if (w2ui['toolbar']) w2ui['toolbar'].destroy()

        // scale of toolbar in iOS devices
        // if window.scale2 is changed, should also change whiteboard.css #scale2
        window.scale2 = 1.0
        var toolbar_width = window.is_iOS() ? Math.round(self.content_rect.width / window.scale2) : self.content_rect.width
        $('#toolbar').w2toolbar({
            name: 'toolbar',
            items: items,
            tooltip: 'bottom',
            style: 'width:' + toolbar_width + 'px;',
            onClick: _.throttle(function (evt) {
                switch (evt.target) {
                    case 'toggle-group':
                        self.toolbar_hidden_group = (self.toolbar_hidden_group == 1) ? 2 : 1
                        evt.item.text = self.toolbar_hidden_group == 2 ? '<span class="fa fa-hand-pointer icon-15">&nbsp</span>' : '<span class="fa fa-hand-peace icon-15">&nbsp</span>'

                        _.each(w2ui['toolbar'].items, function (item) {
                            if (!item.group) return
                            if (item.group == self.toolbar_hidden_group) {
                                //save state and enforce to be hidden
                                toolbar_hidden_cache[item.id] = item.hidden
                                item.hidden = true
                            }
                            else {
                                //restore previous state
                                item.hidden = toolbar_hidden_cache[item.id]
                            }
                        })
                        evt.done(function () {
                            w2ui['toolbar'].refresh()
                        })
                        break
                    /*
                    case 'widgets':
                        //show/hide widget gallery

                        //var yes = w2ui.layout.get('top').hidden
                        //self.presentation.fire('ACTION', { name: 'open-widgets', yes: yes })
                        break
                    */
                    case 'background':
                        self.set_toolbar_item_scale('.w2ui-overlay')
                        break
                    case 'zoomout':
                        evt.done(function () {
                            if (self.zoomout_enabled) {
                                self.disable_zoomout(true)
                            }
                            else {
                                self.enable_zoomout()
                            }
                        })
                        break
                    case 'cue':
                        //evt.item.checked is state before click
                        var yes = evt.item.checked ? false : true
                        var delay = 0
                        if (yes) {
                            self.presentation.on('PAGE-WILL-CHANGE',function toolbar_uncue(){
                                self.presentation.off('PAGE-WILL-CHANGE','toolbar_uncue')
                                w2ui['toolbar'].get('cue').icon = 'fa fa-eye'
                                w2ui['toolbar'].uncheck('cue')
                                //遠端沒有此listener，所以要通知遠端un-cue
                                self.presentation.send_to_bus('cue-sync', ['enable', false])
                            })
                            delay = 200
                            w2ui['toolbar'].get('cue').icon = 'fa fa-eye active'
                        }
                        else {
                            self.presentation.off('PAGE-WILL-CHANGE','toolbar_uncue')
                            w2ui['toolbar'].get('cue').icon = 'fa fa-eye'
                        }
                        w2ui['toolbar'].refresh('cue')

                        _.delay(function () {
                            //等 self.presentation.fire('ESCAPE') 完成後再動作
                            self.presentation.fire('ACTION', { name: 'cue-enable', yes: yes })
                            self.presentation.send_to_bus('cue-sync', ['enable', yes])
                        }, delay)

                        break
                    case 'zoomoutreset':
                        self.reset_zooming(true)
                        if (is_iOS() && (detectZoom.zoom() > 1)) {
                            //on iOS,pinch-zooming is not program controlable
                            w2alert('Double tap on screen', 'Please Reset Zoom')
                            _.delay(function () {
                                w2popup.close()
                            }, 3000)
                        }
                        break
                    case 'draw':
                        evt.done(function () {
                            if (self.draw_enabled) {
                                self.disable_draw()
                            }
                            else {
                                self.enable_draw()
                            }
                        })
                        break
                    case 'drawclear':
                        self.overlay.draw.clear()
                        self.presentation.current_slide.slide_overlay.layers[0] = []
                        var t_id = self.presentation.current_thread.id
                        var s_idx = self.presentation.current_slide.idx
                        //self.presentation.send_to_bus('misc-sync',['overlay:clear',t_id, s_idx, 0])
                        self.presentation.send_to_bus('draw-sync', ['clear', t_id, s_idx, 0])
                        break
                    case 'draweraser':
                        //w2ui does not set "checked" value at this moment,
                        //so we defer the running
                        _.defer(function () {
                            var yes = evt.item.checked
                            self.overlay.set_eraser_mode(yes)
                        })
                        break
                    case 'drawsize':
                        // popup a size picker
                        self.set_toolbar_item_scale('.w2ui-overlay')

                        if (self.overlay.eraser_mode) {
                            var size = self.sbs_user.preferences.get('screen').draw.esize
                            var cls = 'eraser'
                            var color = ''
                        }
                        else {
                            var cls = ''
                            var size = self.sbs_user.preferences.get('screen').draw.size
                            var color = self.sbs_user.preferences.get('screen').draw.color
                        }
                        var html = ['<table style="margin:15px">']
                        html.push('<tr><td><input id="drawsize-picker" type="range" min="1" max="20" value="' + size + '"></td></tr>')
                        html.push('<tr><td style="text-align:center;height:30px">')
                        html.push('<span class="' + cls + '" id="drawsize-circle" style="width:' + size + 'px;height:' + size + 'px;background-color:' + color + ';border-radius:' + Math.ceil(size / 2) + 'px">&nbsp;</span>')
                        html.push('<span style="display-inline">' + size + '</span>')
                        html.push('</td></tr>')
                        html.push('</table>')
                        // auto close drawsize's popup dialog by any click event
                        if (w2ui['drawsize_dialog']) {
                            w2ui['drawsize_dialog'].destroy()
                        }
                        $('#tb_toolbar_item_drawsize').w2overlay({
                            name: 'drawsize_dialog',
                            openAbove: window.above,
                            align: window.align,
                            html: html.join('')
                        });
                        var adjust_size = function (n) {
                            var ele = document.getElementById('drawsize-circle')
                            ele.style.width = n + 'px'
                            ele.style.height = n + 'px'
                            ele.style.borderRadius = Math.ceil(n / 2) + 'px'
                            ele.nextSibling.innerHTML = n
                        }
                        document.getElementById('drawsize-picker').oninput = function (evt) {
                            adjust_size(parseInt(evt.currentTarget.value))
                        }
                        document.getElementById('drawsize-picker').onchange = function (evt) {
                            //called once
                            var size = parseInt(evt.currentTarget.value)
                            //set to overlay
                            self.overlay.set_options({ size: size })
                            //save to preferecnes
                            if (self.overlay.eraser_mode) {
                                self.sbs_user.preferences.get('screen').draw.esize = size
                            }
                            else {
                                self.sbs_user.preferences.get('screen').draw.size = size
                            }
                            self.sbs_user.preferences.touch()
                        }
                        break
                    case 'pointercolor':
                        if (typeof (evt.color) == 'undefined') {
                            //fired when user just click on this item only
                            self.set_toolbar_item_scale('#w2ui-overlay')
                        }
                        else if (evt.color == '') {

                        }
                        else {
                            var color = '#' + evt.color
                            self.pointers.set_color(color)
                            //save to preferecnes
                            //self.sbs_user.preferences.get('screen').pointer = {color:color}
                            //self.sbs_user.preferences.touch()
                        }
                        break
                    case 'drawcolor':
                        if (typeof (evt.color) == 'undefined') {
                            //fired when user just click on this item only
                            self.set_toolbar_item_scale('#w2ui-overlay')
                        }
                        else {
                            self.overlay.set_eraser_mode(false)
                            var color
                            if (evt.color == '') {
                                //default state, randomly pickup one
                                color = colors[Math.floor(Math.random() * colors.length)]
                                _.defer(function () {//update toolbar's color item
                                    var tb = w2ui['toolbar'];
                                    tb.colorClick({ name: tb.name, item: tb.get('drawcolor'), color: color, originalEvent: { by_random: 1 } });
                                })
                            }
                            else {
                                color = evt.color
                            }
                            //set to overlay
                            self.overlay.set_options({ color: '#' + color })

                            //save to preferecnes
                            if (!(evt.originalEvent && evt.originalEvent.by_random)) {
                                self.sbs_user.preferences.get('screen').draw.color = evt.color
                                self.sbs_user.preferences.touch()
                            }
                        }
                        break
                    case 'slidebgcolor':
                        if (typeof (evt.color) == 'undefined') {
                            //fired when user just click on this item only
                            self.set_toolbar_item_scale('#w2ui-overlay')
                        }
                        else {
                            var color = evt.color
                            if (color !== self.presentation.current_slide.resource.color) {
                                self.presentation.current_slide.resource.color = color
                                var t_id = self.presentation.current_thread.id
                                var s_idx = self.presentation.current_slide.idx
                                self.presentation.send_to_bus('refresh', ['bgcolor', t_id, s_idx, { color: color }])
                                document.querySelector('#page-content').style.backgroundColor = color ? '#' + color : 'transparent'
                            }
                        }
                        break

                    case 'pointer':
                        evt.done(function () {
                            if (self.pointers.enabled) {
                                self.pointers.disable()
                            }
                            else {
                                self.pointers.enable()
                            }
                        })
                        break
                    //submenu below "textmenu"
                    case 'textmenu:copy-code':
                        self.presentation.fire('ACTION', { name: 'copy-slide-text', args: [self.presentation.current_slide] })
                        break
                    case 'textmenu:download-code':
                        self.presentation.fire('ACTION', { name: 'download-slide-text', args: [self.presentation.current_slide] })
                        break
                    case 'textmenu:line-wrap':
                        if ('line-wrap' != self.screen_ele.querySelector('.text-viewer .text-resource-content').getAttribute('mode')) {
                            var w = window.find_line_length()
                            // reasons to minus 10
                            // 1.leep some space on right
                            // 2.for some smaller screen to see end of line
                            var line_length = w - 10
                            self.presentation.fire('TEXT-WRAP', line_length)
                            var t_id = self.presentation.current_thread.id
                            var s_idx = self.presentation.current_slide.idx
                            self.presentation.send_to_bus('refresh', ['text-wrap', t_id, s_idx, line_length])
                        }
                        break
                    case 'textmenu:line-nowrap':
                        if ('line-wrap' == self.screen_ele.querySelector('.text-viewer .text-resource-content').getAttribute('mode')) {
                            self.presentation.fire('TEXT-WRAP', 0)
                            var t_id = self.presentation.current_thread.id
                            var s_idx = self.presentation.current_slide.idx
                            self.presentation.send_to_bus('refresh', ['text-wrap', t_id, s_idx, 0])
                        }
                        break
                    case 'textmenu:clear-hilights':
                        self.presentation.fire('CLEAR-HILIGHTS')
                        break
                    case 'textmenu:go-top':
                        self.screen_ele.querySelector('.text-resource').scrollTop = 0
                        break
                    case 'textmenu:go-line':
                        w2prompt({
                            label: 'Line Number:',
                            value: '1',
                            title: 'Go To Line',
                            ok_text: 'Go',
                        })
                            .ok(function (value) {
                                self.presentation.fire('GO-LINE', parseInt(value))
                            })
                        break
                    case 'background:getfromwebcam':
                        self.upload_from_webcam()
                        break
                    case 'background:getfromupload':
                        document.getElementById('upload_ele').click()
                        break
                    case 'background:getfromcamera':
                        self.upload_from_photo(true)
                        break
                    case 'background:getfromphoto':
                        self.upload_from_photo()
                        break
                    case 'background:remove':
                        self.presentation.reset_slide_background(self.presentation.current_thread.id, [self.presentation.current_slide.idx])
                        .done(function(changed_slides){
                            console.log(changed_slides)
                        }).fail(function (retcode, errmsg) {
                            w2alert(errmsg)
                        })
                        break
                    case 'slide:insert_slide':
                        var color = w2ui['toolbar'].get('slidebgcolor').color
                        window.loading(true, 'Add slide', true)
                        if (!self.presentation.syncing) {
                            //if we are not syncing, we got to manually sync to new slide
                            var manual_sync = function (metadata) {
                                var t_id = metadata[0]
                                var s_idx = metadata[1]
                                var as_focus = metadata[2]
                                var slide = self.presentation.threads[t_id].slides[s_idx]
                                self.presentation.set_slide(slide)
                                self.presentation.off('SLIDE-ADDED', manual_sync)
                            }
                            self.presentation.on('SLIDE-ADDED', manual_sync)
                        }
                        self.presentation.add_blank_slide(color).done(function () {
                            _.delay(function () { window.loading(false) }, 500)//don't stop too early
                        }).fail(function (retcode, message) {
                            window.loading(false)
                            w2alert(message)
                        })
                        break
                    case 'slide:reset_slide':
                        var idx = self.presentation.current_slide.idx
                        w2confirm({
                            msg: '<span style="vertical-align:middle;color:red;font-size:50px" class="fa fa-exclamation-triangle">&nbsp;</span> Are you sure to reset this slide?',
                            title: 'Hands up!',
                            btn_yes: {
                                class: 'w2ui-btn-red'
                            },
                            callBack: function (ans) {
                                if (ans != 'Yes') return
                                var t_id = self.presentation.current_thread.id
                                var s_idxes = [idx]

                                // delete this slide
                                //self.presentation.remove_slides_of_idx(t_id,s_idxes).fail(function(retcode,errmsg){

                                //remove widgets

                                //reset this slide
                                self.presentation.reset_slides_of_idx(t_id, s_idxes).fail(function (retcode, errmsg) {
                                    w2alert(errmsg)
                                })
                            }
                        })
                        break
                    case 'slide:remove_slide':
                        var idx = self.presentation.current_slide.idx
                        w2confirm({
                            msg: '<span style="vertical-align:middle;color:red;font-size:50px" class="fa fa-exclamation-triangle">&nbsp;</span> Are you sure to remove this slide?',
                            title: 'Hands up!',
                            btn_yes: {
                                class: 'w2ui-btn-red'
                            },
                            callBack: function (ans) {
                                if (ans != 'Yes') return
                                var t_id = self.presentation.current_thread.id
                                var s_idxes = [idx]
                                // delete this slide
                                self.presentation.remove_slides_of_idx(t_id, s_idxes).fail(function (retcode, errmsg) {
                                    w2alert(errmsg)
                                })
                            }
                        })
                        break
                    case 'slide:save_widget_states':
                        WidgetGallery.singleton.presentation.current_slide.widget_manager.state_save(true)
                        window.message('all state saved')
                        break
                    case 'slide:restore_widget_states':
                        WidgetGallery.singleton.presentation.current_slide.widget_manager.state_restore(true)
                        window.message('all state restored')
                        break
                    case 'slide:toggle_widget_drawer':
                        var yes =  (!document.querySelector('#widget-drawer').classList.contains('open'))
                        WidgetGallery.singleton.presentation.fire('ACTION', { name: 'widget-drawer', yes: yes })
                        if (yes){
                            w2ui['toolbar'].get(evt.target).text = 'Close widget drawer'
                            w2ui['toolbar'].get(evt.target).icon = w2ui['toolbar'].get(evt.target).icon + ' active'
                        }
                        else {
                            w2ui['toolbar'].get(evt.target).text = 'Open widget drawer'
                            w2ui['toolbar'].get(evt.target).icon = w2ui['toolbar'].get(evt.target).icon.replace(/ active/,'')
                        }
                        w2ui['toolbar'].refresh('slide')
                        break
                    case 'slide:toggle_widget_panel':
                        //顯示或不顯示dashboard
                        var yes = WidgetGallery.singleton.dashboard_box.classList.contains('active') ? false : true
                        if (yes) {
                            WidgetGallery.singleton.dashboard_box.classList.add('active')
                            w2ui['toolbar'].get('slide:toggle_widget_panel').text = 'Close widget panel'
                            w2ui['toolbar'].get('slide:toggle_widget_panel').icon = w2ui['toolbar'].get(evt.target).icon + ' active'
                            if (Widget.selected.length) {
                                //show #widget-dashboard
                                WidgetGallery.singleton.render_dashboard(Widget.selected[0])
                            }
                            self.presentation.fire('ACTION',{name:'page-align',side:'left'})
                        }
                        else {
                            //hide #widget-dashboard
                            WidgetGallery.singleton.dashboard_box.classList.remove('active')
                            w2ui['toolbar'].get('slide:toggle_widget_panel').text = 'Open widget panel'
                            w2ui['toolbar'].get('slide:toggle_widget_panel').icon = w2ui['toolbar'].get(evt.target).icon.replace(/ active/,'')
                            self.presentation.fire('ACTION',{name:'page-align',side:'center'})
                        }
                        w2ui['toolbar'].refresh('slide')
                        break
                    case 'syncing':
                        self.presentation.fire('ACTION', { name: 'syncing', yes: (!self.presentation.syncing) })
                        break
                    case 'origin':
                        _.defer(function () {
                            if (self.origin_enabled) {
                                self.disable_origin()
                            }
                            else {
                                self.enable_origin()
                            }
                        })
                        break
                    /*
                    case 'widget-drawer':
                        self.presentation.fire('ACTION', { name: 'widget-drawer', yes: (!document.querySelector('#widget-drawer').classList.contains('open')) })
                        break
                    case 'test':

                        var yes = w2ui.layout.get('top').hidden
                        self.presentation.fire('ACTION', { name: 'open-widgets', yes: yes })

                        console.log('hdi=>',w2ui['layout'].get('right').hidden)
                        if (w2ui['layout'].get('right').hidden){
                            w2ui['layout'].show('right')
                        }
                        else{
                            w2ui['layout'].hide('right')
                        }
                        console.log('hdi=>>>',w2ui['layout'].get('right').hidden)
                        break
                        */
                    //
                    //group-2 starts
                    //
                    case 'speaker:copy-url':
                        var url = get_url_from_hash(self.presentation.hostname + ',whiteboard,' + '2' + self.presentation.acl_token.ss)
                        self.presentation.fire('ACTION', { name: 'copy-url', args: [url, evt.originalEvent] })
                        break
                    case 'speaker:show-qrcode':
                        var url = 'qrcode.html#' + get_url_from_hash(self.presentation.hostname + ',whiteboard,' + '2' + self.presentation.acl_token.ss, true)
                        self.presentation.fire('ACTION', { name: 'show-qrcode', args: [url, 'QRcode of Co-Author URL'] })
                        break
                    case 'speaker:show-quickshortcut':
                        self.presentation.fire('ACTION', { name: 'show-quickshortcut', type: 'speaker' })
                        break
                    case 'audience:copy-url':
                        var url = get_url_from_hash(self.presentation.hostname + ',whiteboard,' + '3' + self.presentation.acl_token.as)
                        self.presentation.fire('ACTION', { name: 'copy-url', args: [url, evt.originalEvent] })
                        break
                    case 'audience:show-qrcode':
                        var url = 'qrcode.html#' + get_url_from_hash(self.presentation.hostname + ',whiteboard,' + '3' + self.presentation.acl_token.as, true)
                        self.presentation.fire('ACTION', { name: 'show-qrcode', args: [url, 'QRcode of Audience URL'] })
                        break
                    case 'audience:show-quickshortcut':
                        self.presentation.fire('ACTION', { name: 'show-quickshortcut', type: 'audience' })
                        break
                    case 'settings:enter-fullscreen':
                        self.presentation.fire('ACTION', { name: 'enter-fullscreen' })
                        break
                    case 'settings:screen-ratio':
                        var w = (self.presentation.settings.ratio[0] == 4) ? 16 : 4
                        window.loading(true)
                        self.presentation.set_ratio(w).done(function () {
                            window.loading(false)
                            w2ui['toolbar'].get('settings:screen-ratio').text = 'Switch to ' + (w == 4 ? '16:9' : '4:3')
                            w2ui['toolbar'].refresh('settings:screen-ratio')
                        })
                        break
                    case 'settings:reset-all-slides':
                        self.presentation.fire('ACTION', { name: 'reset-all-slides' })
                        break
                    case 'settings:remove-all-slides':
                        self.presentation.fire('ACTION', { name: 'remove-all-slides' })
                        break
                    case 'privacy:set-passcode':
                        self.presentation.fire('ACTION', { name: 'set-passcode' })
                        break
                    case 'privacy:forget-me':
                        self.presentation.fire('ACTION', { name: 'forget-me' })
                        break
                    case 'members_count':
                        self.presentation.fire('ACTION', { name: 'who_are_joining' })
                        break
                    case 'your_name:change_your_name':
                        self.presentation.fire('ACTION', { name: 'set-sbsname' })
                        break
                    case 'your_name:my_board':
                        open(location.pathname, sdk.user.metadata.name)
                        break
                    case 'boards':
                        self.presentation.fire('ACTION', { name: 'show-boards' })
                        break
                    case 'help:github':
                        open('https://github.com/iapyeh/sidebyside/issues')                        
                        break
                    case 'help:ccsearch':
                        open('https://search.creativecommons.org')
                        break
                    default:
                    //do nothing
                }
            }, 250, { trailing: false })
        })

        //hookup selected widgets ；連結widget系統
        document.addEventListener('copy', function (e) {
            if (Widget.selected.length) {
                var for_clone = true
                var content = JSON.stringify(Widget.selected[0].serialize(for_clone))
                e.clipboardData.setData('text/plain', content);
                e.preventDefault(); // We want to write our data to the clipboard, not data from any user selection
            }
        });

        var enable_dnd_timer = 0
        //開發用
        _.delay(function () {
            //WidgetGallery.all['CardWidget'].create_sample(self.widget_layer).move(200,200)
            //WidgetGallery.all['BoxWidget'].create_sample(self.widget_layer).move(250,250)
            //WidgetGallery.all['IFrameWidget'].create_sample(self.widget_layer).move(350,350)
            //WidgetGallery.all['YoutubeWidget'].create_sample(self.widget_layer).move(300,300)
            //WidgetGallery.all['WebcamWidget'].create_sample(self.widget_layer).move(200,200)
            //WidgetGallery.all['FlipCardWidget'].create_sample(self.widget_layer).move(400,400)
            //WidgetGallery.all['BookWidget'].create_sample(self.widget_layer).move(400,150)
            //WidgetGallery.all['TextBubbleWidget'].create_sample(self.widget_layer).move(400,150)
        }, 10)

        // bind actions for buttons in "settings-page"


        var origin_state_of_items = []
        /* 暫時取消，似乎沒有隱藏的必要
        //zoom_changable_items 是 zoom > 1 時要藏起來的項目
        var zoom_changable_items = ['toggle-group','background','slidebgcolor','textmenu']
        _.each(zoom_changable_items,function(itemname){
            var item = w2ui['toolbar'].get(itemname)
            if (item) origin_state_of_items.push(itemname)
        })
        */
        self.presentation.on('ZOOMOUT', function (_scale) {
            if (self.toolbar_hidden_group == 2) {
                //只有在顯示group==1時做切換
                if (_scale <= 1) {
                    w2ui['toolbar'].hide('zoomoutreset')
                    _.each(origin_state_of_items, function (itemname) {
                        w2ui['toolbar'].show(itemname)
                    })
                }
                else if (_scale > 1) {
                    w2ui['toolbar'].show('zoomoutreset')
                    _.each(origin_state_of_items, function (itemname) {
                        w2ui['toolbar'].hide(itemname)
                    })
                }
            }
        })

        //for iOS, enlarge w2ui popup widgets in toolbar
        //and move them to screen center
        self.set_toolbar_item_scale = function (selector) {
            if ($('#toolbar').hasClass('scale2')) {
                _.delay(function () {
                    var $selector = $(selector)
                    if ($selector.length == 0) return //w2uitoolbar is toggle off
                    $selector.addClass('scale2')
                    var menu_scale2 = 1.5
                    var effective_scale = Math.round(100 * menu_scale2 / self.presentation._scale) / 100
                    $selector.css({ transform: 'scale(' + effective_scale + ')' })
                    var rect = $selector[0].getBoundingClientRect()
                    $selector.css({
                        //left:(self.content_rect.width - rect.width)/2 + self.content_rect.left,
                        left: rect.left + self.content_rect.left + 'px',
                        top: (self.content_rect.height - rect.height) / 2 + self.content_rect.top + 'px',
                    })
                }, 500)//500 is tested on iPad
            }
        }

        //style the toolbar, if is on top of "black area"(#page) set opacity=1
        //(temporary disable)
        if (self.readonly) {
            _.defer(function () { w2ui['toolbar'].box.style.display = 'none' })
        }
        else {
            var opacity = (!self.presentation.isolated && self.page_ele.style.width == self.screen_ele.style.width) ? 1 : 1
            w2ui['toolbar'].box.style.backgroundColor = 'rgba(255,255,255,' + opacity + ')'

            if (mobileAndTabletcheck()) {
                if (window.is_iOS()) {
                    //auto enable zoomout in iOS
                    w2ui['toolbar'].box.classList.add('scale2')
                    w2ui['toolbar'].box.style.transform = 'scale(' + window.scale2 + ')'
                    _.delay(function () {
                        self.enable_zoomout()
                        _.delay(function () {
                            //this is a workaround for problem of w2toolbar refresh
                            //it loses width after resize
                            var toolbar_width = w2ui['toolbar'].box.style.width
                            w2ui['toolbar'].on('resize', function (evt) {
                                if (toolbar_width != w2ui['toolbar'].box.style.width) {
                                    w2ui['toolbar'].box.style.width = toolbar_width
                                }
                            })
                        }, 2000)
                    }, 200)
                }
            }
        }

        //creat slots in widget drawer
        var slot_on_click = function(evt){
            var slot_ele = evt.currentTarget
            if (slot_ele.dataset.id){
                //2019-03-12T10:11:51+00:00 這段程式碼好像不會叫到
                var widget = Widget.all[slot_ele.dataset.id]
                WidgetGallery.singleton.slot_pop(widget)
                widget.sync({id:0,on:'slot'})
            }
            else{
                if (Widget.selected.length == 0) return
                var widget = Widget.selected[0]
                WidgetGallery.singleton.slot_push(slot_ele,widget)
                widget.sync({id:0,on:'slot',slot:slot_ele.getAttribute('slot-idx')})
            }
        }
        var widget_drawer = document.getElementById('widget-drawer')
        //10個slot+margin
        var slot_width = (self.content_rect.width - (2 *3 * 10)) / 10
        widget_drawer.style.height = (slot_width + 2) + 'px'
        var slot_size = {w:slot_width, h:slot_width}
        var slot_count = Math.floor(self.content_rect.width / slot_size.w)
        var slot_html = []
        for (var i=0;i<slot_count;i++){
            slot_html.push('<div class="slot empty" style="height:'+slot_width+'px;width:'+slot_width+'px" slot-idx="'+i+'"></div>')
        }
        widget_drawer.innerHTML = slot_html.join('')
        widget_drawer.querySelectorAll('.slot').forEach(function(slot_ele){
            slot_ele.onclick = slot_on_click
        })
    },
    recreate_tabsbar: function () {
        var self = this
        if (w2ui['tabsbar']) w2ui['tabsbar'].destroy()

        var tooltip_of_boardname = function () {
            return self.presentation.name.length > 10 ? self.presentation.name : 'board name'
        }
        var tabs = [{ id: 'presentation', text: '<span class="presentation-name" style="display:inline-block;max-width:60px;overflow:hidden;text-overflow:ellipsis">' + self.presentation.name + '</span>', page_no: -1, tooltip: tooltip_of_boardname }]
        //var tabs = []
        //tabs.push({id:'add_slide',text:'+',page_no:0,tooltip:'insert a slide'})
        var length = _.size(self.presentation.current_thread.slides)
        var page_no = 0;
        for (var i = 0; i < length; i++) {
            page_no = (i + 1)
            tabs.push({ id: 'p' + page_no, text: '' + (page_no), page_no: page_no })
        }
        var go_slide_of_index = _.throttle(function (index) {
            if (index != self.presentation.current_slide.idx) {
                var slide = self.presentation.current_thread.slides[index]
                self.presentation.set_slide(slide, null, true)
            }
        }, 250, { leading: false, tailing: true })
        $('#tabsbar').w2tabs({
            name: 'tabsbar',
            tabs: tabs,
            tooltip: 'bottom',
            active: 'p' + (self.presentation.current_slide.idx + 1),
            onClick: function (evt) {
                var index = evt.tab.page_no - 1
                if (index == -2) {
                    //if is owner, change name otherwise ignore "boardname" tab (index==-2)
                    if (self.presentation.is_owner) {
                        self.presentation.fire('ACTION', { name: 'rename-presentation'})
                    }
                    evt.preventDefault()
                    return
                }
                else if (self.presentation.readonly && self.presentation.syncing) {
                    evt.preventDefault()
                    return
                }
                go_slide_of_index(index)
            }
        });
        // update "+" tab's look and feel
        var slides_quota_remain = self.presentation.get_slide_quota(self.presentation.current_thread.id)
        if (slides_quota_remain > 0) {
            w2ui['tabsbar'].enable('add_slide')
        }
        else {
            w2ui['tabsbar'].disable('add_slide')
        }

        self.presentation.on('PAGE-DID-CHANGE', function (data) {
            if (w2ui['tabsbar'].active != 'p' + data.page_no) {
                //update active tab
                w2ui['tabsbar'].active = 'p' + data.page_no
                w2ui['tabsbar'].refresh()
            }
            if (self.presentation.readonly) {

            }
            else {
                //update background color in toolbar
                w2ui['toolbar'].get('slidebgcolor').color = self.presentation.current_slide.resource.color
            }
        })
        self.presentation.on('PRESENTATION-NAME-CHANGED', function (name) {
            document.title = name
            $('.presentation-name').html(name)
        })
    },
    /* implements Presentation's delegation */
    _on_unavailable: function (message) {
        //helper of delegates
        this.render_slide(null, null, 'pop-in')
        if (w2ui['toolbar']) _.delay(function () { w2ui['toolbar'].destroy() }, 1000)
    },
    get_flag_of_token: function () {
        return this.flag_of_token
    },
    on_get_presentation_error: function () {
        this._on_unavailable('The presentation is not found')
    },
    on_refresh_state_error: function () {
        //pass
    },
    on_refresh_state_did: function () {
        //pass
    },
    on_added: function (topic, data) {
        //pass
    },
    on_swapped: function (topic, data) {
        //pass
    },
    on_removed: function (topic, data) {
        var self = this
        switch (topic) {
            case 'presentation':
                if (!(this.presentation.isolated)) {
                    document.getElementById('screen').innerHTML = ''
                    w2alert('The presentation has removed').done(function () {
                        //if this is in iframe, to idle_screen.jpg
                        window.location.href = 'index.html'
                    })
                }
                else {
                    this._on_unavailable('The presentation removed')
                }
                break
            case 'thread':
                // do nothing here, because prensention will call on_thread_changed()
                // to render new focus slide
                break
            case 'slides':
                //update page-total showing on page
                /*
                var ret = self.presentation.get_slide_info(self.presentation.current_slide)
                $('.page-no').html(ret.index+1)
                $('.page-total').html('/'+ret.total)
                */
                break
        }
    },
    on_shutdown: function () {
        var self = this
        document.getElementById('screen').innerHTML = ''
        if (!(this.presentation.isolated)) {
            document.getElementById('screen').innerHTML = ''
            w2alert('The screen has shutdown').done(function () {
                //if this is in iframe, to idle_screen.jpg
                window.location.href = 'index.html'
            })
        }
        else {
            this._on_unavailable('The screen has shutdown')
        }
    },
    /*
    on_no_slide: function () {
        this._on_unavailable('No slide to show')
    },
    on_no_thread: function () {
        this._on_unavailable('No slide to show')
    },
    */
    on_no_more_thread: function (no_more) {
        //pass
    },
    on_remote_thread_changed: function (t_id) {
        //pass
    },
    on_message: function (s, keep) {
        window.message(s, keep)
    },
    on_lock_presentation: function (reason) {
        w2alert(reason, 'Board been locked')
        /*
        _.delay(function(){
            window.location.reload()
        },2000)
        */
    },
    render_slide: function (thread, slide, transtion) {
        //clearup current slide

        var self = this

        if (w2ui['toolbar'] && w2ui['toolbar'].player && w2ui['toolbar'].player.sync_current_time_timer) {
            //reset video player
            clearTimeout(w2ui['toolbar'].player.sync_current_time_timer)
            delete w2ui['toolbar'].player.sync_current_time_timer
            w2ui['toolbar'].player = null
        }

        //remove gs-toolbar
        if (document.querySelector('.gs-toolbar')) {
            $('.gs-toolbar').remove()
        }

        //reset overlay(drawing)
        this.overlay.draw.clear()
        //reset zooming should be called in advance
        this.reset_zooming()
        this.disable_zoomout()

        //update toolbar items
        var color = slide.resource.color
        document.querySelector('#page-content').style.backgroundColor = color ? '#' + color : 'transparent' //update background
        if (self.presentation.readonly) {
            //no toolbar item "slidebgcolor"
        }
        else {
            w2ui['toolbar'].get('slidebgcolor').color = color //update toolbar item
            w2ui['toolbar'].refresh('slidebgcolor')
        }
        //render panel's content
        var promise = new $.Deferred()
        //deferred to wait overlay be ready for apply translation if any(workaround for Chrome)
        _.defer(function () {
            var panel_name = 'main'
            var dislpay_promise = self.display_areas[panel_name]
                .set_slide(slide, transtion)
                .done(function () {
                    //redraw overlay, wait a while for better visual looking
                    self.overlay.draw_restore(slide.slide_overlay.layers[0])
                })
            if (slide.is_embedded) {
                w2ui['toolbar'].show('origin')
            }
            else {
                w2ui['toolbar'].hide('origin')
            }

            var name = slide.id.split('.')[0]
            $('.slide-id').html(name)
            $('.thread-name').html(self.presentation.current_thread.id)

            var z = slide.zoom
            var t = slide.translate
            //這個會讓切換到有translate的slide時init的位置可以在0,0
            self.presentation._translate = [0, 0]//caceh性質
            //restore zoom and translate
            dislpay_promise.done(function () {
                if (z[0] == 1 && t[0] == 0 && t[1] == 0) {
                    // do nothing
                }
                else {
                    if (z[0] !== 1) {
                        self.set_zooming(z[0], z[1], z[2], true)
                        self.presentation.fire('ZOOMOUT', z[0])
                    }
                    //注意：OFFSET事件會改變self.presentation._translate，
                    //但是在reset_rooming那裡self.presentation._translate有可能會被覆寫掉
                    if (!(t[0] == 0 && t[1] == 0)) {
                        self.presentation.fire('OFFSET', t)
                    }
                }
                promise.resolve()
            })
        })
        return promise
    },
    toggle_toolbar: function (yes) {
        var _yes = (typeof (yes) == 'undefined' ? $('#toolbar')[0].style.display == 'none' : yes)
        $('#toolbar')[0].style.display = _yes ? '' : 'none'
        return _yes
    },
    on_bus_announce: function (data) {
        var self = this
        switch (data.type) {
            case 'LEAVE':
            case 'JOIN':
                self.presentation.members_count = data.members_count
                $('.members-count').css('display', 'inline-block')
                $('.members-count').html(data.members_count)
                break
        }
    },
    on_pointer: function (pointer_meta, data) {
        //called remotely for syncing pointers
        if (data) {
            this.pointers.sync_data(data)
        }
        else {
            this.pointers.sync_meta(pointer_meta)
        }
    },
    on_origin: function (enabled) {
        if (enabled) {
            this.enable_origin(true)
        }
        else {
            this.disable_origin(true)
        }
    },
    get_video_player: function () {
        return w2ui['toolbar'].player
    },
    /* experimental
    stop_recorder: function(){
        this.recorder_started = false
        this.recorder.stop();
    },
    start_recorder: function(){
        this.recorder_started = true
        var self = this
        const getStreamForWindow = () => navigator.mediaDevices.getUserMedia({
            video: {
                mandatory: {
                    chromeMediaSource: 'screen'
                }
            }
        });
        // we ask for permission to record the audio and video from the camera
        const getStreamForCamera = () => navigator.mediaDevices.getUserMedia({
            audio: true
        });
        const video = document.createElement('video');

        const appendCamera = (stream) => {
          document.body.appendChild(video);
          //video.src = URL.createObjectURL(stream);
          video.srcObject = stream
          video.style.height = '100%';
          video.style.width = '100%';
          video.volume = 0;
          video.play();
        };

        getStreamForCamera().then(streamCamera => {
            // we know have access to the camera, let's append it to the DOM
            appendCamera(streamCamera);
            getStreamForWindow().then(streamWindow => {

              // we now have access to the screen too
              // we generate a combined stream with the video from the
              // screen and the audio from the camera
              var finalStream = new MediaStream();
              const videoTrack = streamWindow.getVideoTracks()[0];
              finalStream.addTrack(videoTrack);
              const audioTrack = streamCamera.getAudioTracks()[0];
              finalStream.addTrack(audioTrack);
              self.recorder = new MediaRecorder(finalStream);

              // we subscribe to 'ondataavailable'.
              // this gets called when the recording is stopped.
              self.recorder.ondataavailable = function(e) {
                // let's create a blob with e.data which has the
                // contents of the video in webm
                var link = document.createElement('a');
                link.setAttribute('href', window.URL.createObjectURL(e.data));
                link.setAttribute('download', 'video_' + Math.floor((Math.random() * 999999)) + '.webm');
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
              // start recording
              self.recorder.start();
            });
        });
    },*/
    set_zooming: function (scale, transform_origin, translate, is_relative) {
        //called by mousewheel, but pinch does not call this
        var self = this
        var presentation = this.presentation
        var origin_x = transform_origin ? transform_origin[0] : 0
        var origin_y = transform_origin ? transform_origin[1] : 0
        presentation._scale = scale
        this.widget_layer.dataset.scale = scale
        //write back to local data(這是需要的嗎，為何只有scale，不更新translate?)
        presentation.current_slide.zoom[0] = scale

        if (is_relative) { //data from remote other screen
            origin_x = Math.round(origin_x * self.content_rect.width)
            origin_y = Math.round(origin_y * self.content_rect.height)
            translate[0] = Math.round(translate[0] * self.content_rect.width)
            translate[1] = Math.round(translate[1] * self.content_rect.height)
        }
        if (transform_origin) {
            self.screen_frame_ele.style.transformOrigin = origin_x + 'px ' + origin_y + 'px 0px'
        }
        self.move(translate[0], translate[1])
        // update scale on if draw_enabled, important!
        // this make drawing position correctly
        if (self.draw_enabled) self.overlay.set_scale(scale)
    },
    enable_zoomout: function () {
        //enable/disable zooming does not synced between speaker screens
        var self = this
        this.zoomout_enabled = true

        //do some side-settings to zoomout button
        //should wait a 50ms interval to let adding red class to button taking effective
        if (this.draw_enabled) this.disable_draw()
        if (this.pointers.enabled) this.pointers.disable()
        _.delay(function () {
            self.update_toolbar('zoomout:enable', true)
        }, 10)

        var sensor_ele = this.overlay.overlay_surface
        //var _screen_ele = this.screen_ele
        var _screen_rect = this.content_rect
        var presentation = this.presentation

        var scale = presentation._scale
        if (scale > 1) self.enable_dragging()
        var _origin_offset = [window.scrollX, window.scrollY]
        var toolbar = document.getElementById('toolbar')
        var toolbar_rect = toolbar.getBoundingClientRect()
        var toolbar_origin_transform = toolbar.style.transform

        var unit_y = 2500 //sensetivity
        var _last_scale = presentation._scale
        var _last_page_xy = [0, 0]
        var _last_offset_xy = [0, 0]
        var current_origin = sensor_ele.style.transformOrigin.match(/\d+/g)
        if (current_origin) _last_offset_xy = [parseInt(current_origin[0]), parseInt(current_origin[1])]

        var send_to_bus_throttle = _.throttle(function (data) {
            //reduce traffic 5x times if throttle set to 1s
            presentation.send_to_bus('zoom-sync', data)
        }, 500, { leading: false })
        var fire_event_throttle = _.throttle(function (_scale) {
            presentation.fire('ZOOMOUT', _scale)
        }, 500, { leading: false })

        var zoom_changed_refresh = function () {
            //remote co-author changes zooming while we are changing it
            var transform_origin = sensor_ele.style.transformOrigin.match(/\d+/g)
            _last_offset_xy = [parseInt(transform_origin[0]), parseInt(transform_origin[1])]
            _last_scale = presentation._scale
        }
        presentation.on('ZOOM_CHANGED', zoom_changed_refresh)

        var mousewheel_handler = function (evt) {
            if (!self.zoomout_enabled) return

            //if (!evt.metaKey) return

            //scale range 1 ~ 10
            scale = Math.floor(1000 * Math.min(10, Math.max(1, presentation._scale + (evt.wheelDelta / unit_y)))) / 1000;
            if (presentation._scale == scale) return //same scale, do nothing
            var t_id = presentation.current_thread.id
            var s_idx = presentation.current_slide.idx
            if (scale == 1) {
                presentation.current_slide.zoom = [1, [0, 0], [0, 0]]
                presentation.current_slide.translate = [0, 0]
                send_to_bus_throttle.cancel()
                fire_event_throttle.cancel()
                self.reset_zooming(true)
            }
            else {
                self.enable_dragging()
                //offsetX,Y is static in relative to image
                var offset_x, offset_x = evt.pageX//evt.offsetX
                var offset_y = evt.pageY// evt.offsetY
                var translate = _.clone(presentation._translate)
                if (_last_scale == 1) {
                    offset_x = evt.offsetX
                    offset_y = evt.offsetY
                    _last_offset_xy = [evt.offsetX, evt.offsetY]
                }
                else {
                    if (evt.pageX !== _last_page_xy[0] || evt.pageY !== _last_page_xy[1]) {
                        offset_x = evt.offsetX
                        offset_y = evt.offsetY
                        translate[0] += Math.round((offset_x - _last_offset_xy[0]) * (_last_scale - 1) / scale)
                        translate[1] += Math.round((offset_y - _last_offset_xy[1]) * (_last_scale - 1) / scale)
                        _last_offset_xy = [offset_x, offset_y]
                    } else {
                        offset_x = _last_offset_xy[0]
                        offset_y = _last_offset_xy[1]
                    }
                }
                self.set_zooming(scale, [offset_x, offset_y], translate)
                var norm_offset_x = Math.round(1000 * offset_x / _screen_rect.width) / 1000
                var norm_offset_y = Math.round(1000 * offset_y / _screen_rect.height) / 1000

                //sync to others
                var norm_translate_x = Math.round(1000 * translate[0] / _screen_rect.width) / 1000
                var norm_translate_y = Math.round(1000 * translate[1] / _screen_rect.height) / 1000
                var data = [t_id, s_idx, scale, [norm_offset_x, norm_offset_y], [norm_translate_x, norm_translate_y]]

                presentation.current_slide.zoom = [scale, [norm_offset_x, norm_offset_y], [norm_translate_x, norm_translate_y]]
                send_to_bus_throttle(data)
                fire_event_throttle(scale)
            }
            _last_scale = scale
            _last_offset = [offset_x, offset_y]

            _last_page_xy = [evt.pageX, evt.pageY]
        }
        sensor_ele.style.pointerEvents = 'auto'
        sensor_ele.addEventListener('mousewheel', mousewheel_handler)

        var pinch_start_handler, pinch_end_handler
        if (mobileAndTabletcheck()) {
            var pinch = false
            var last_tap = 0 //for detecting double-tap
            var start_scale, start_translate //scale and translate when touch start
            pinch_start_handler = function (evt) {

                if (!self.zoomout_enabled) return

                if (evt.touches.length > 1) {
                    //pinch is the "center point" of two fingers
                    pinch = [(evt.touches[1].clientX + evt.touches[0].clientX) / 2, (evt.touches[0].clientY + evt.touches[1].clientY) / 2];
                    pinch[0] = pinch[0] + window.scrollX
                    pinch[1] = pinch[1] + window.scrollY
                    start_scale = Math.round(1000 * detectZoom.zoom()) / 1000
                    start_translate = _.clone(self.presentation._translate)
                    presentation.fire('PINCH:START')
                    return
                }
                else {//if (e.touches.length==1){
                    var now = new Date().getTime()
                    var double_tap = now - last_tap < 350
                    last_tap = now
                    if (double_tap) {
                        _.defer(function () {
                            //reset toolbar
                            self.reset_zooming(true)
                            toolbar.style.transform = toolbar_origin_transform
                            toolbar.style.top = toolbar_rect.top + 'px'
                            toolbar.style.left = toolbar_rect.left + 'px'
                        })
                    }
                }
            }
            pinch_end_handler = function (evt) {

                if (!self.zoomout_enabled) return

                if (pinch) {
                    var scale = Math.round(1000 * detectZoom.zoom()) / 1000
                    presentation.fire('PINCH:END')
                    if (scale !== start_scale) {
                        //DONT do this, this will crash mobile safari's scale (don't know why)
                        //presentation._scale = scale

                        if (scale > 1) {

                            //make overlay to update offset
                            self.overlay.set_scale(self.overlay.scale)

                            self.enable_dragging()
                            var t_id = presentation.current_thread.id
                            var s_idx = presentation.current_slide.idx
                            var zoomdata = [
                                Math.round(1000 * scale) / 1000,
                                [Math.round(100 * pinch[0] / self.content_rect.width) / 100,
                                Math.round(100 * pinch[1] / self.content_rect.height) / 100],
                                [Math.round(100 * start_translate[0] / self.content_rect.width) / 100,
                                Math.round(100 * start_translate[1] / self.content_rect.height) / 100],
                            ]
                            presentation.current_slide.zoom = zoomdata
                            presentation.send_to_bus('zoom-sync', [t_id, s_idx, zoomdata[0], zoomdata[1], zoomdata[2]])

                            _.delay(function () {
                                //var scale2 = 1.5 //actual scale in css
                                var counter_scale = Math.round((1 / scale * 1000)) / 1000 * window.scale2
                                var diff_x = Math.floor(window.scrollX - _origin_offset[0] + toolbar_rect.left / scale)
                                var diff_y = Math.floor(window.scrollY - _origin_offset[1] + toolbar_rect.top / scale)
                                toolbar.style.left = diff_x + 'px'
                                toolbar.style.top = diff_y + 'px'
                                toolbar.style.transformOrigin = 'left top'
                                toolbar.style.transform = 'scale(' + counter_scale + ')'
                            }, 100)

                        }
                        else if (scale == 1) { //scale might less than 1 on pinch zooming
                            presentation.current_slide.zoom = [1, [0, 0], [0, 0]]
                            presentation.current_slide.translate = [0, 0]
                            //reset toolbar
                            self.reset_zooming(true)
                            toolbar.style.transform = toolbar_origin_transform
                            toolbar.style.top = toolbar_rect.top + 'px'
                            toolbar.style.left = toolbar_rect.left + 'px'

                        }
                        self.presentation.fire('ZOOMOUT', scale)
                    }
                    pinch = false;
                    return
                }
            }
            sensor_ele.addEventListener('touchstart', pinch_start_handler)
            sensor_ele.addEventListener('touchend', pinch_end_handler)
        }

        self._disable_zoomout = function (reset_data) {
            sensor_ele.style.pointerEvents = 'none'

            //do some side-settings to zoomout button
            //should wait a 50ms interval to let adding red class to button taking effective
            if (reset_data) {
                presentation.current_slide.zoom = [1, [0, 0], [0, 0]]
                presentation.current_slide.translate = [0, 0]
                console.log('reset data of slide:',presentation.current_slide)
            }

            //dont' disaable zoom out in iOS
            if (window.is_iOS()) return

            self.presentation.off('ZOOM_CHANGED', zoom_changed_refresh)

            _.delay(function () { self.update_toolbar('zoomout:enable', false) }, 10)

            sensor_ele.removeEventListener('mousewheel', mousewheel_handler)

            if (mobileAndTabletcheck()) {
                sensor_ele.removeEventListener('touchstart', pinch_start_handler)
                sensor_ele.removeEventListener('touchend', pinch_end_handler)
            }

            self.zoomout_enabled = false

            self.disable_dragging()

            delete self._disable_zoomout
        }

    },
    disable_zoomout: function (reset_data) {
        if (this._disable_zoomout) this._disable_zoomout(reset_data)
    },
    reset_zooming: function (request_sync) {
        // will set scale to 1 and translate to 0,0
        var self = this
        var presentation = this.presentation
        presentation._scale = 1
        this.widget_layer.dataset.scale = 1

        /*
        _.delay(function(){
            忘記這在寫什麼，一時也測不出問題；暫時取消
            //on macbookpor's touchpad, onmouseup event fired with delay.
            //but "escape" could happen before delay endsup.
            //this listener will override reset value of scale and transform
            //as a workaround, we delay this reset
            presentation._translate[0] = 0
            presentation._translate[1] = 0
        },1000)
        */
        this.screen_frame_ele.transformOrigin = '0px 0px'
        this.move(0, 0)
        _.defer(function () {
            self.overlay.set_scale(1)
        }, 100)
        this.disable_dragging()
        if (request_sync) {
            //upload local data
            presentation.current_slide.zoom[0] = 1
            var t_id = presentation.current_thread.id
            var s_idx = presentation.current_slide.idx
            presentation.send_to_bus('zoom-sync', [t_id, s_idx, 1, [0, 0], [0, 0]])
        }
        self.presentation.fire('ZOOMOUT', 1)
    },
    set_transform: function (transform) {
        document.getElementById('screen-frame').style.transform = transform
    },
    move: function (x, y) {
        var scale = this.presentation._scale
        this.presentation._translate[0] = x
        this.presentation._translate[1] = y
        var transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'
        this.set_transform(transform)
    },
    enable_dragging: function () {
        var self = this
        if (this.dragging_enabled) return
        this.dragging_enabled = true
        var control_rect = this.page_ele.getBoundingClientRect()
        var emit_offset_sync = _.throttle(function () {
            var pos0 = self.presentation._translate[0]
            var pos1 = self.presentation._translate[1]
            var t_id = self.presentation.current_thread.id
            var s_idx = self.presentation.current_slide.idx
            var rel_pos0 = Math.round(pos0 / control_rect.width * 1000)
            var rel_pos1 = Math.round(pos1 / control_rect.height * 1000)
            self.presentation.current_slide.translate[0] = rel_pos0
            self.presentation.current_slide.translate[1] = rel_pos1
            self.presentation.send_to_bus('translate-sync', [t_id, s_idx, rel_pos0, rel_pos1])
        }, 100, { leading: false })

        var x, y
        interact(this.page_ele.querySelector('#screen-frame')).draggable({
            onstart: function () {
                x = self.presentation._translate[0]
                y = self.presentation._translate[1]
            },
            onmove: function (evt) {
                x += evt.dx
                y += evt.dy
                self.move(x, y)
            },
            onend: function () {
                emit_offset_sync()
            }
        })
    },
    disable_dragging: function () {
        var self = this
        if (!self.dragging_enabled) return
        self.dragging_enabled = false
        interact(this.page_ele.querySelector('#screen-frame')).draggable(false)
    },
    /*
    obsoleted_enable_dragging: function(){
        //called when scale > 1
        var self = this
        if (this.dragging_enabled) return
        this.dragging_enabled = true
        //make slide draggable if not drawing
        var control_ele = self.page_ele
        var control_rect = control_ele.getBoundingClientRect()
        var translate = self.presentation._translate

        var pos1, pos2, pos3, pos4
        var is_mouse = false
        var scale = 1
        self.presentation.on('PINCH:START',function(){
        })
        self.presentation.on('PINCH:END',function(){
        })
        var emit_offset_sync = _.throttle(function(){
            var t_id = self.presentation.current_thread.id
            var s_idx = self.presentation.current_slide.idx
            var rel_pos1 = Math.round(pos1/control_rect.width*1000)
            var rel_pos2 = Math.round(pos2/control_rect.height*1000)
            self.presentation.current_slide.translate[0] = rel_pos1
            self.presentation.current_slide.translate[1] = rel_pos2
            self.presentation.send_to_bus('translate-sync',[t_id,s_idx,rel_pos1,rel_pos2])
        },100,{leading:false})
        var mousemove = function(evt){
            if (!(is_mouse || evt.touches.length==1)) return
            // calculate the new cursor position:
            var clientX = is_mouse ? evt.clientX : evt.touches[0].clientX
            var clientY = is_mouse ? evt.clientY : evt.touches[0].clientY
            var delta_x = Math.floor((clientX - pos3)/scale)
            var delta_y = Math.floor((clientY - pos4)/scale)
            pos1 =  delta_x  + translate[0]
            pos2 =  delta_y + translate[1]
            self.move(pos1,pos2)
            emit_offset_sync()
        }//end of mousemove listener
        var mouseup = function(evt){
            if (is_mouse || (evt.touches.length==0)){
                control_ele.removeEventListener('mousemove',mousemove)
                control_ele.removeEventListener('mouseup',mouseup)
                control_ele.removeEventListener('touchmove',mousemove)
                control_ele.removeEventListener('touchend',mouseup)
                translate[0] = pos1
                translate[1] = pos2
            }
        }//end of mouseup listener
        var mousedown = function(evt){

            // response to drawing, not dragging
            if (self.draw_enabled) return

            // if (!self.zoomout_enabled) return

            is_mouse = evt.type=='mousedown'
            //works only for mouse left button and one-finger touch
            if (is_mouse && evt.which !== 1) return
            else if (!is_mouse && evt.touches.length > 1){
                control_ele.removeEventListener('touchmove',mousemove)
                return
            }
            scale = self.presentation._scale
            //translate = _.clone(self.presentation._translate)
            pos1 = translate[0]
            pos2 = translate[1]
            // get the mouse cursor position at startup:
            if (is_mouse){
                pos3 = evt.clientX;
                pos4 = evt.clientY;
            }
            else{
                pos3 = evt.touches[0].clientX;
                pos4 = evt.touches[0].clientY;
            }

            if (is_mouse) {
                control_ele.addEventListener('mousemove',mousemove)
                control_ele.addEventListener('mouseup',mouseup)
            }
            else{
                control_ele.addEventListener('touchmove',mousemove)
                control_ele.addEventListener('touchend',mouseup)
            }

        }//end of mousedown event listner
        if (mobileAndTabletcheck()){
            control_ele.addEventListener('touchstart',mousedown)
        }
        else{
            control_ele.addEventListener('mousedown',mousedown)
        }

        self.disable_dragging = function(){
            if (!self.dragging_enabled) return
            //console.log('disable dragging')
            self.dragging_enabled = false
            var listeners;
            if (mobileAndTabletcheck()) listeners = [['touchstart',mousedown],['touchmove',mousemove],['touchend',mouseup]]
            else listeners = [['mousedown',mousedown],['mousemove',mousemove],['mouseup',mouseup]]
            _.each(listeners, function(listener){
                control_ele.removeEventListener(listener[0],listener[1])
            })
        }
        //fire event (disabled, no listener)
        //self.presentation.fire('DNZ:START')
    },*/
    enable_draw: function () {

        $('#page').on('touchmove.freeze_page',function (evt){
            evt.preventDefault()
        })

        var self = this
        this.draw_enabled = true
        var visible = true

        //do some side-settings to draw button
        //should wait a 50ms interval to let adding red class to button taking effective
        _.delay(function () { self.update_toolbar('draw:enable', true) }, 50)

        if (this.pointers.enabled) this.pointers.disable()
        if (this.zoomout_enabled) this.disable_zoomout()

        var display_none = false
        self.overlay.show(visible, display_none)
        self.overlay.set_scale(self.presentation._scale)

        //enable pointer events
        self.overlay.overlay_surface.style.pointerEvents = 'all'
    },
    disable_draw: function () {

        $('#page').off('.freeze_page')

        var self = this
        this.draw_enabled = false
        var visible = false
        //add some flavor to overlay button
        self.update_toolbar('draw:enable', false)
        var slide = self.presentation.current_slide
        var display_none = slide.is_embedded ? true : false
        self.overlay.show(visible, display_none)

        //disable pointer events
        self.overlay.overlay_surface.style.pointerEvents = ''
    },
    enable_origin: function (called_by_sync) {
        var self = this

        this.origin_enabled = true
        // delay a while to make restoring "draw" button's red class taking effective
        // when it was disabled by enabling pointer
        //_.delay(function(){self.update_toolbar('origin:enable',true)},50)

        _.each($('.origin-hide-me'), function (ele) {
            ele.style.display = 'none'
        })

        w2ui['toolbar'].hide('toggle-group')
        var hided_items = [w2ui['toolbar'].get('toggle-group')]
        _.each(w2ui['toolbar'].items, function (item) {
            //console.log(item.group , self.toolbar_hidden_group)
            if (item.group && (item.group != self.toolbar_hidden_group)) {
                //save state and enforce to be hidden
                if (item.id == 'origin') {
                    item.text = 'Lock'
                    item.icon = 'fa fa-lock'
                    w2ui['toolbar'].refresh(item.id)
                }
                else if (!item.hidden) {
                    hided_items.push(item)
                    w2ui['toolbar'].hide(item.id)
                }
            }
        })
        if (called_by_sync) {
            //pass
        }
        else {
            self.presentation.send_to_bus('misc-sync', ['origin', 1])
        }
        //定義在此以讀取hided_items
        this.disable_origin = function (called_by_sync) {
            self.origin_enabled = false
            // delay a while to make restoring "draw" button's red class taking effective
            // when it was disabled by enabling pointer
            //_.delay(function(){self.update_toolbar('origin:enable',false)},50)
            _.each($('.origin-hide-me'), function (ele) {
                ele.style.display = ''
            })
            _.each(hided_items, function (item) {
                w2ui['toolbar'].show(item.id)
            })
            w2ui['toolbar'].get('origin').text = 'Unlock'
            w2ui['toolbar'].get('origin').icon = 'fa fa-lock-open'
            w2ui['toolbar'].refresh('origin')
            if (called_by_sync) {
                //pass
            }
            else {
                self.presentation.send_to_bus('misc-sync', ['origin', 0])
            }
        }
    },
    disable_camera: function () {
        this.camera_enabled = false
        this.update_toolbar('camera:enable', false)

        document.querySelector('#camera').style.display = 'none'
        _.each(window.stream.getTracks(), function (track) { track.stop() })
        delete window.stream
        window.stream = null
        w2popup.close()
    },
    enable_camera: function () {
        this.camera_enabled = true
        this.update_toolbar('camera:enable', true)

        var self = this
        var camera_box = w2popup.open({
            name: 'camera',
            title: '<button id="camera-box-resize-btn" class="w2ui-popup-btn" tooltip="bottom:drag lower right coner to resize">Resize</button>' +
                '<button style="display:none" id="camera-box-fixsize-btn" class="w2ui-popup-btn">Fix size</button>' +
                '<button style="display:none" id="camera-box-resizedone-btn" class="w2ui-popup-btn">Done</button>',
            opacity: 1,
            width: 320,
            height: 240,
            body: '<div style="width:100%;height:100%" id="camera"><video autoplay></video></div>',
            style: 'padding:0;margin:0;width:100%;background-color:#f0f0f0',
            onClose: function () {
                //self.camera_enabled is true, if this close event
                //is triggerred by self.disable_camera,
                //so we need not to call it again.
                if (self.camera_enabled) self.disable_camera()
            }
        })

        //relayout this popup
        var $popup = $('#camera').closest('.w2ui-popup')
        $popup.find('.w2ui-popup-body').css(
            { 'margin-top': '-32px', 'height': 'auto', 'overflow': 'hidden' }
        )
        $popup.find('.w2ui-popup-title').css(
            { 'background-image': 'none', 'border': 'none' }
        )
        $popup.find('.w2ui-popup-title').hover(
            function (evt) {
                if (resizable || size_fixed) return
                $(evt.currentTarget).css({ 'background-image': '' })
                $('#camera-box-resize-btn').show()
            },
            function (evt) {
                if (resizable || size_fixed) return
                $(evt.currentTarget).css({ 'background-image': 'none' })
                $('#camera-box-resize-btn').hide()
            }
        )
        camera_box.unlockScreen()

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
        var video = window.video = document.querySelector('#camera video');
        video.style.transformOrigin = 'left top'
        var resizable = false
        var size_fixed = false
        var video_settings = null
        var origin_width = 320 //parseInt($('#camera-box')[0].style.width)
        var last_scale = 0
        var update_video_scale = function () {
            var width = video_settings.width
            var height = video_settings.height
            if (last_scale == 0) {
                var scale = Math.round(100 * origin_width / width) / 100
                $popup.height(Math.ceil(height * scale))
            }
            else if (last_scale != scale) {
                var box_width = $popup.width()
                var scale = Math.round(100 * box_width / width) / 100
                //$popup.find('.w2ui-popup-body').height(Math.ceil( box_width * (height/width)) )
            }
            if (scale != last_scale) {
                video.style.transform = 'scale(' + scale + ')'
                last_scale = scale
            }
            if (resizable) setTimeout(function () { update_video_scale() }, 200)
        }

        window.set_tooltip(document.getElementById('camera-box-resize-btn'))//,'drag lower right coner to resize','down')

        //must to listen on mousedown, not click, click will not be called on title
        $('#camera-box-resize-btn').on('mousedown', function (evt) {
            resizable = true
            size_fixed = false
            //must delayed to make it works (no idea why)
            _.delay(function () {
                document.getElementById('camera-box-fixsize-btn').setAttribute('tooltip', 'bottom:fix camera frame size')
                window.set_tooltip(document.getElementById('camera-box-fixsize-btn'))
                $('#camera').closest('.w2ui-popup').css({ 'resize': 'both' })
                $('#camera').closest('.w2ui-box').css({ 'pointer-events': 'none' })
                $('#camera-box-fixsize-btn').show()
                $('#camera-box-resizedone-btn').show()
                $('#camera-box-resize-btn').hide()
            }, 100)
            setTimeout(function () {
                update_video_scale()
            }, 500)
        })
        $('#camera-box-fixsize-btn').on('mousedown', function (evt) {
            evt.preventDefault()
            if (resizable) {
                //enter fixed mode
                evt.currentTarget.innerHTML = 'Rescale'
                document.getElementById('camera-box-fixsize-btn').setAttribute('tooltip', 'bottom:scaling camera frame size to bounding box')
                window.set_tooltip(document.getElementById('camera-box-fixsize-btn'))
                resizable = false
                size_fixed = true
            }
            else {
                //enter rescaling mode
                evt.currentTarget.innerHTML = 'Fix'
                document.getElementById('camera-box-fixsize-btn').setAttribute('tooltip', 'bottom:fix camera frame size')
                window.set_tooltip(document.getElementById('camera-box-fixsize-btn'))
                size_fixed = false
                resizable = true
            }
        })
        $('#camera-box-resizedone-btn').on('mousedown', function () {
            $('#camera').closest('.w2ui-popup').css({ 'resize': 'none' })
            $('#camera').closest('.w2ui-box').css({ 'pointer-events': '' })
            resizable = false
            size_fixed = false //reset
            $('#camera-box-resize-btn').show()
            $('#camera-box-fixsize-btn').hide()
            $('#camera-box-resizedone-btn').hide()
        })
        var handleSuccess = function (stream) {
            //window.stream = stream; // make stream available to browser console
            video.srcObject = stream;
            video_settings = stream.getVideoTracks()[0].getSettings()
            setTimeout(function () { update_video_scale() }, 1000)
        }
        var handleError = function (error) {
            if (resolution_idx < resolutions.length - 1) {
                resolution_idx += 1
                constraints.video = resolutions[resolution_idx]
                request_video()
            }
            else {
                console.log('navigator.getUserMedia error: ', error);
            }

        }
        var request_video = function () {
            navigator.mediaDevices.getUserMedia(constraints).
                then(handleSuccess).catch(handleError);
        }
        request_video()
    },
    upload_from_photo: function (use_camera) { //mobile
        var self = this
        var page_rect = self.page_rect
        var width = page_rect.width * 0.6
        var height = page_rect.height * 0.6
        var camera_box = w2popup.open({
            name: 'camera',
            buttons: '<button disabled style="float:left" id="camera-box-use-btn" class="w2ui-btn w2ui-popup-btn w2ui-btn-blue">Use</button>' +
                (width < 200 ? '' :
                    '<button style="float:left;margin-left:10px" id="camera-box-take-btn" class="w2ui-btn w2ui-popup-btn">Take Again</button>') +
                '<button style="float:right" id="camera-box-cancel-btn" class="w2ui-btn w2ui-popup-btn">Cancel</button>',
            opacity: 1,
            width: width + 5,
            height: height + 40,
            body: '<div style="background-color:black"><input id="camera" multiple type="file" accept="image/*" ' + (use_camera ? 'capture="camera"' : '') + '/><img style="" id="camera_image"/></div>',
            style: 'padding:0;margin:0;width:100%;display:flex;justify-content:center;background-color:black',
            showClose: false
        })

        //relayout popup frame
        var $popup = $('#camera').closest('.w2ui-popup')
        $popup.find('.w2ui-popup-body').css(
            { 'overflow': 'hidden' }
        )
        var camera_ele = document.querySelector('input#camera')
        var camera_image = camera_ele.nextSibling
        var has_image = false
        $popup.find('#camera-box-use-btn').on('click', _.throttle(function () {
            if (!has_image) {
                return
            }
            var file = camera_ele.files[0]
            var name = file.name
            if (!/\d{7,}/.test(name)) {
                //add timestamp to name if there is no sutff like it in file name
                name = Math.round(new Date().getTime() / 1000) + '.' + name
            }
            camera_box.lock('uploading', true)
            _.delay(function () {
                self.on_paste({
                    file: file,
                    is_file: true,
                    is_directory: false,
                    mimetype: file.type,
                    name: name
                }).done(function () {
                    camera_box.unlock()
                    w2popup.close()
                }).fail(function (errcode, errmsg) {
                    camera_box.unlock()
                    w2popup.close()
                    w2alert(errmsg)
                })
            }, 100)
        }, 1000, { trailing: false }))
        $popup.find('#camera-box-cancel-btn').on('click', function () {
            w2popup.close()
        })
        $popup.find('#camera-box-take-btn').on('click', function () {
            camera_ele.click()
        })
        camera_ele.style.display = 'none'
        camera_ele.click()

        camera_ele.addEventListener('change', function (e) {
            if (camera_ele.files.length) {
                //if there is only a single file, show it for confirmation
                //otherwise when there are many files, just submit it directly
                if (camera_ele.files.length == 1) {
                    $popup.find('#camera-box-use-btn').attr('disabled', null)
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        camera_image.setAttribute('src', e.target.result)
                        _.delay(function () {
                            if (camera_image.naturalWidth > camera_image.naturalHeight) {
                                camera_image.style.width = width + 'px'
                                camera_image.style.height = 'auto'
                                var h = width / camera_image.naturalWidth * camera_image.naturalHeight
                                camera_image.style.marginTop = Math.round((height - h) / 2) + 'px'
                            }
                            else {
                                camera_image.style.height = height + 'px'
                                camera_image.style.width = 'auto'
                                camera_image.style.marginTop = 0
                            }
                        }, 100)
                        has_image = true
                    }
                    reader.readAsDataURL(camera_ele.files[0]);
                }
                else {
                    var data = {
                        is_directory: true,
                        is_file: false,
                        files: camera_ele.files
                    }
                    self.on_dnd(data, null)
                    w2popup.close()
                }
            }
        })
    },
    upload_from_webcam: function () { //desktop
        var self = this
        var page_rect = self.page_rect
        var width = page_rect.width * 0.6
        var height = page_rect.height * 0.6
        var video = null
        var camera_box = w2popup.open({
            name: 'webcam',
            buttons: '<button style="float:left" id="webcam-box-use-btn" class="w2ui-btn w2ui-popup-btn w2ui-btn-blue">Use</button>' +
                '<button style="float:right" id="webcam-box-cancel-btn" class="w2ui-btn w2ui-popup-btn">Cancel</button>',
            opacity: 1,
            width: width + 5,
            height: height + 40,
            body: '<div style="background-color:black"><video id="webcam" autoplay></video></div>',
            style: 'padding:0;margin:0;width:100%;display:flex;justify-content:center;background-color:black',
            showClose: false,
            onClose: function () {
                video.pause()
                if (video.srcObject) {
                    video.srcObject.getTracks()[0].stop()
                    video.srcObject = null
                }
                delete video
            }
        })

        video = document.querySelector('video#webcam');
        video.style.transformOrigin = 'left top'

        //relayout popup frame
        var $popup = $('#webcam').closest('.w2ui-popup')
        $popup.find('.w2ui-popup-body').css(
            { 'overflow': 'hidden' }
        )
        $popup.find('#webcam-box-use-btn').on('click', _.throttle(function () {
            //take screenshot
            var canvas = document.createElement('canvas')
            rect = video.getBoundingClientRect()
            canvas.width = rect.width
            canvas.height = rect.height
            //canvas.className = 'invert'
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function (blob) {
                //add timestamp to name if there is no sutff like it in file name
                var name = Math.round(new Date().getTime() / 1000) + '.webcam.jpg'
                var file = new File([blob], name, { type: 'image/jpeg' })
                camera_box.lock('uploading', true)
                _.delay(function () {
                    self.on_paste({
                        file: file,
                        is_file: true,
                        is_directory: false,
                        mimetype: file.type,
                        name: name
                    }).done(function () {
                        camera_box.unlock()
                        w2popup.close()
                    }).fail(function (errcode, errmsg) {
                        camera_box.unlock()
                        w2popup.close()
                        w2alert(errmsg)
                    })
                })
            }, "image/jpeg", 1.0);
        }, 1000, { trailing: false }))
        $popup.find('#webcam-box-cancel-btn').on('click', function () {
            w2popup.close()
        })
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
        var handleSuccess = function (stream) {
            window.stream = stream; // make stream available to browser console
            video.srcObject = stream;
            video_settings = stream.getVideoTracks()[0].getSettings()
            console.log('use resolution', resolutions[resolution_idx])
        }
        var handleError = function (error) {
            if (resolution_idx < resolutions.length - 1) {
                resolution_idx += 1
                constraints.video = resolutions[resolution_idx]
                request_video()
            }
            else {
                console.log('navigator.getUserMedia error: ' + error);
                w2alert(error, 'Failed to get webcam')
            }
        }
        var request_video = function () {
            navigator.mediaDevices.getUserMedia(constraints).
                then(handleSuccess).catch(handleError);
        }
        request_video()


        //video.className = 'invert'

        var take_snapshot = function () {
            var canvas = document.createElement('canvas')
            rect = video.getBoundingClientRect()
            canvas.width = rect.width
            canvas.height = rect.height
            canvas.className = 'invert'
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            var data = canvas.toDataURL('image/jpeg')

            //temporary diable (API changed)
            //self.send_to_bus('snapshot',data,true)

            /*
            var dlLink = document.createElement('a');
            dlLink.download = 'test.jpeg';
            dlLink.href = data;
            dlLink.dataset.downloadurl = ['image/jpeg', dlLink.download, dlLink.href].join(':');

            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
            */
        }

        video.onloadedmetadata = function () {
            //setTimeout(function(){take_snapshot()},100)
        }
    },
    on_resize: function () {
        //called by dashboard
        window.onresize()
    },
    go_secure_version: function () {
        //global_config is a global var in sbs_user
        var ports = global_config.https //defined in sbsuser.js
        var url = location.href.replace('http://', 'https://').replace(':' + global_config.http.port, ':' + global_config.https.port)
        location.href = url
    },
    /* dnd delegation*/
    get_widget_of_node: function (node) {
        //協助on_dnd, on_dnd_string判斷是否投放在widget上
        while (node != this.page_ele) {
            if (node.classList.contains('widget')) {
                return Widget.all[node.getAttribute('id')]
            }
            node = node.parentNode
        }
        return null
    }
    , on_paste: function (data, evt) {
        //先搜尋是否是放在widget上，放在這裡的作法不夠好，但比在選定與非選定時切換
        //dnd_enabler的標的的作法來的有效且使用起來方便
        if (Widget.selected.length) {
            return Widget.selected[0].on_paste(data, evt)
        }
        else if (this.screen_frame_ele.classList.contains('selected')){
            var dst_index = this.presentation.current_slide.idx
            return this._handle_dnd_paste(data, dst_index)
        }
    },
    on_paste_string: function (text, evt) {
        //先搜尋是否是widget的複製貼上，
        //其次看是否有選定的widget
        //再其次由whiteboard處理
        //（放在這裡的作法不夠好，暫時先這樣）
        if (WidgetGallery.singleton.on_paste_string(text, evt)) {
            return
        }
        else if (this.screen_frame_ele.classList.contains('selected')){
            //貼在slide底層
            return this._handle_dnd_paste(text, this.presentation.current_slide.idx)
        }
        else{
            //貼在最底層，暫時不同步
            //2019-03-13T03:06:24+00:00 目前這一段程式碼是多餘的
            var self = this
            window.slide_resource_factory.from_string(text).done(function (slide_resource) {
                if (slide_resource.kind && slide_resource.kind.indexOf('image') == 0){
                    var url = slide_resource.type == 'FILE' ? 'url('+text+')' : slide_resource.url
                    self.page_ele.style.backgroundImage = url
                    self.page_ele.classList.add('image_background')
                }
            })
        }
    },
    on_dnd_string: function (text, evt) {
        //先搜尋是否是放在widget上，放在這裡的作法不夠好，但比在選定與非選定時切換
        //dnd_enabler的標的的作法來的有效且使用起來方便
        var widget = this.get_widget_of_node(evt.target)
        if (widget) return widget.on_dnd_string(text, evt)

        if (evt.target == this.widget_layer){
            return this.on_paste_string(text,evt)
        }
        else if (evt.target == this.page_ele){
            this.page_ele.style.backgroundImage = 'url('+encodeURIComponent(text)+')'
        }
    },
    on_dnd: function (data, evt) {
        //先搜尋是否是放在widget上，放在這裡的作法不夠好，但比在選定與非選定時切換
        //dnd_enabler的標的的作法來的有效且使用起來方便

        var widget = this.get_widget_of_node(evt.target)
        if (widget) return widget.on_dnd(data, evt)

        //hanlde dnd of 1. single file, 2. multiple files 3. a folder
        var self = this
        var invoke = function () {
            delete self._dnd_invoke_timer
            var dst_index = self.presentation.current_slide.idx
            var cached_files = self._dnd_cached_files
            delete self._dnd_cached_files
            var data
            if (cached_files.length == 1) {
                //single file or single folder
                data = cached_files[0]
            }
            else {
                //many files, simulate a folder
                var files = []
                _.each(cached_files, function (cached_item) {
                    files.push(cached_item.file)
                })
                data = {
                    is_directory: true,
                    is_file: false,
                    files: files
                }
            }
            self._handle_dnd_paste(data, dst_index)
        }
        if (this._dnd_cached_files) {
            clearTimeout(this._dnd_invoke_timer)
            this._dnd_cached_files.push(data)
            this._dnd_invoke_timer = setTimeout(function () {
                invoke()
            }, 500)
        }
        else {
            this._dnd_cached_files = [data]
            this._dnd_invoke_timer = setTimeout(function () {
                invoke()
            }, 500)
        }
    },
    _handle_dnd_paste: function (data, dst_index) {
        /*
         * Arguments:
         *  data: (string or object)
        */
        var self = this
        var p_id = this.presentation.p_id
        var t_id = this.presentation.current_thread.id
        var flag = this.flag_of_token
        var s_idx = dst_index
        //var name = data.name
        var promise = new $.Deferred()
        var do_action = function (options, _promise) {
            switch (options.action) {
                case 'add_whiteboard_slides':
                    var slides_quota_remain = self.presentation.get_slide_quota(t_id)
                    if (slides_quota_remain == 0) {
                        _promise.reject(1, 'out of slide quota')
                        w2alert('number of slides is maximum', 'Out of slide quota')
                    }
                    else {
                        //window.loading(true, 'Adding slides', true)
                        self.sbs_user.add_whiteboard_slides({ p_id: self.p_id, t_id: t_id, flag: self.flag_of_token, insert_at: options.dst, files: options.files }).done(function (ret) {
                            //window.loading(false)
                            // no need to update to Presentation's local copy
                            // local copy will got updated from bus by sync
                            _promise.resolve(true)
                        }).fail(function (response) {
                            window.loading(false)
                            _promise.resolve(false)
                            var errmsg = response.stderr ? (response.stderr.message || response.stderr) : response
                            w2alert(errmsg)
                        })
                    }
                    break
                case 'set_slide_resource':
                    //options.name is only used when files.length==1
                    window.loading(true, 'Update background image', true)
                    self.sbs_user.set_slide_resource({
                        p_id: p_id,
                        t_id: t_id,
                        s_idx: options.s_idx || s_idx,
                        flag: flag,
                        file: options.file,
                        name: options.name
                    }).done(function (filename) {
                        window.loading(false)
                        _promise.resolve(filename)
                        // no need to update to Presentation's local copy
                        // local copy will got updated from bus by sync
                    }).fail(function (response) {
                        window.loading(false)
                        console.log('error',response)
                        _promise.reject(response.retcode, response.stderr.message || response.stderr)
                    })
                    break
            }
        }
        var preprocess_file = function (file, callback) {
            if (file.type == 'image/gif') {
                callback(file)
            }
            else if (file.type == 'image/jpeg' || file.type == 'image/png') {
                resizeAndRotateImage(file, 1536, function (blob) {
                    var new_file
                    if (blob) {
                        //new image generated
                        var jpeg_name = file.name.replace(/\.png/, '.jpg');
                        callback(new File([blob], jpeg_name))
                    }
                    else {
                        // nothing changed
                        callback(file)
                    }
                })
            }
            else {
                callback(null)
            }
        }
        if (_.isString(data)) {
            window.slide_resource_factory.from_string(data).done(function (slide_resource) {
                if (slide_resource) {
                    if (slide_resource.type == 'FILE'){
                        _.defer(function(){
                            self._handle_dnd_paste({
                                is_file:true,
                                file:slide_resource.file,
                                mimetype: slide_resource.kind
                            }, dst_index)
                        })
                    }
                    else{
                        //把metadata壓成json，以檔案的方式傳回server
                        var blob = new Blob([JSON.stringify(slide_resource)], { type: "octet/stream" })
                        var filename = 't' + Math.round(new Date().getTime() / 1000) + '.json'
                        var file = new File([blob], filename, { type: "application/json" })
                        var options = {
                            action: 'set_slide_resource',
                            file: file,
                            dst: (typeof (dst_index) == 'undefined' || dst_index === null) ? -1 : parseInt(dst_index)
                        }
                        do_action(options, promise)
                    }
                }
            })
        }
        else if (data.is_directory) {
            var files = []
            window.loading(true, 'Processing files', true)

            _.defer(function () {
                var handle_a_file = function (idx) {
                    var file = data.files[idx]
                    preprocess_file(file, function (new_file) {
                        if (new_file) files.push(new_file)
                        idx += 1
                        if (idx < data.files.length) {
                            handle_a_file(idx)
                        }
                        else {
                            //all files have been processed

                            //resort files
                            files.sort(function (a, b) {
                                return a.name > b.name ? 1 : (a.name < b.name ? -1 : 0)
                            })
                            if (files.length == 0) {
                                window.loading(false)
                                promise.reject(1, 'no files to upload')
                                return
                            }
                            //reset background to all existing slides behinde current slide
                            var total_slides = self.presentation.current_thread.slides.length
                            var slides_to_end = total_slides - self.presentation.current_slide.idx
                            var files_to_set;
                            var files_to_add;
                            if (slides_to_end >= files.length) {
                                files_to_set = files
                                files_to_add = []
                            }
                            else {
                                files_to_set = files.splice(0, slides_to_end)
                                files_to_add = files
                            }
                            //limit length of files_to_add to fit quote
                            var slides_quota_remain = self.presentation.get_slide_quota(t_id)
                            if (slides_quota_remain < files_to_add.length) {
                                files_to_add.splice(slides_quota_remain, files_to_add.length - slides_quota_remain)
                            }
                            var add_a_file = function (idx_to_add) {
                                var file_for_bg = files_to_add[idx_to_add]
                                var options = {
                                    action: 'add_whiteboard_slides',
                                    files: [file_for_bg],
                                    insert_at: -1
                                }
                                var add_promise = new $.Deferred()
                                add_promise.done(function () {
                                    if (idx_to_add + 1 < files_to_add.length) {
                                        _.delay(function () { add_a_file(idx_to_add + 1) },1000)
                                    }
                                    else {
                                        delete files_to_add
                                        window.loading(false)
                                        promise.resolve(true)
                                    }
                                })
                                do_action(options, add_promise)
                            }
                            //the 1st image replaces the background of current slide
                            var s_idx_of_first = s_idx
                            var set_a_file = function (idx_to_set) {
                                var file_for_bg = files_to_set[idx_to_set]
                                var options = {
                                    action: 'set_slide_resource',
                                    file: file_for_bg,
                                    name: file_for_bg.name,
                                    s_idx: s_idx_of_first + idx_to_set
                                }
                                var bg_promise = new $.Deferred()
                                bg_promise.done(function () {
                                    if (idx_to_set + 1 < files_to_set.length) {
                                        _.defer(function () { set_a_file(idx_to_set + 1) })
                                    }
                                    else {
                                        delete files_to_set
                                        if (files_to_add.length) {
                                            add_a_file(0)
                                        }
                                        else {
                                            window.loading(false)
                                            promise.resolve(true)
                                        }
                                    }
                                }).fail(function (errcode, errmsg) {
                                    promise.reject(errcode, errmsg)
                                })
                                do_action(options, bg_promise)
                            }
                            set_a_file(0)
                        }
                    })
                }
                handle_a_file(0)
            })
        }
        else if (data.is_file) {
            window.loading(true, 'Processing files', true)
            preprocess_file(data.file, function (new_file) {
                window.loading(false)
                if (new_file) {
                    var options = {
                        action: 'set_slide_resource',
                        file: new_file,
                        name: data.name
                    }
                    do_action(options, promise)
                }
                else {
                    w2alert(data.file.type + ' not supported')
                    promise.reject(1, data.file.type + ' not supported')
                }
            })
        }
        return promise
    },
    //binding to share ownership
    to_bind: function () {
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.to_bind'
        var command = new Command(cmd, [])
        window.sdk.send_command(command).progress(function (ret) {
            //ret = [binder_code, valid_until_ts]
            promise.notify(ret)
        })
            .done(function (response) {
                if (response.retcode != 0) {
                    return promise.reject(response.retcode, response.stderr.message, response.stderr)
                }
                promise.resolve(response.stdout)
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                promise.reject(jqXHR.status, jqXHR.statusText)
            })
        return promise
    },
    to_unbind: function (userhash) {
        var self = this
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.to_unbind'
        var command = new Command(cmd, [p_id, flag, (userhash || '')])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        })
            .fail(function (jqXHR, textStatus, errorThrown) {
                promise.reject(jqXHR.status, jqXHR.statusText)
            })
        return promise
    },
    /*
    to_be_bind:function(binder_code){
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name +'.root.sidebyside.to_be_bind'
        var command = new Command(cmd,[binder_code])
        window.sdk.send_command(command).done(function(response){
            if (response.retcode != 0) {
                return promise.reject(response.retcode,response.stderr.message,response.stderr)
            }

            //update local copy of binder count
            var binded_count = response.stdout
            self.presentation.is_binded = binded_count
            sdk.user.metadata.binded = binded_count
            self.on_binded_changed({binded_count:binded_count})

            promise.resolve(binded_count)
        }).fail(function(jqXHR, textStatus, errorThrown){
            promise.reject(jqXHR.status,jqXHR.statusText)
        })
        return promise
    },
    */
    invite_binding: function (userhash) {
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.invite_binding'
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var invitor = self.presentation.name
        var command = new Command(cmd, [p_id, flag, invitor, userhash])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    },
    on_binded_changed: function (data) {
        if (this.presentation.is_binded == 0) {
            window.sdk.logout().done(function () {
                window.location.href = location.pathname
            })
        }
        else if (data.binded_count) {
            w2ui['toolbar'].refresh()
        }
        else if (data.binded_sbs_name) {
            w2ui['toolbar'].refresh()
        }
    },
    on_invite_binding: function (data) {
        console.log('invited to be bind by ', data)
        var self = this
        w2confirm({
            msg: 'Do you agree to bind to ' + data.invitor + '?',
            title: 'Invitation of Binding',
            btn_yes: {
                class: 'w2ui-btn-blue'
            },
            callBack: function (ans) {
                if (ans == 'Yes') {
                    self.accept_invite_binding().done(function (ret) {
                        location.href = 'whiteboard.html'
                    })
                }
                else {
                    console.log('deny to bind')
                }
            },
            onClose: function () {
                console.log('deny to bind')
            }
        })
    },
    accept_invite_binding: function () {
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.accept_invite_binding'
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var command = new Command(cmd, [p_id, flag])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    },
    clear_bindings: function () {
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.clear_bindings'
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var command = new Command(cmd, [p_id, flag])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    },
    get_quickshortcut_code: function (code_flag) {
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.get_quickshortcut_code'
        var args = [self.presentation.p_id, self.flag_of_token]
        if (code_flag == 3) {
            args.push(3)
        }
        var command = new Command(cmd, args)
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    },
    cancel_quickshortcut: function () {
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.cancel_quickshortcut'
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var command = new Command(cmd, [p_id, flag])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    },
    whois_binding: function () {
        //request a list of binders, also update binding target's data
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.whois_binding'
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var command = new Command(cmd, [p_id, flag])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    },
    who_are_joining: function () {
        //request a list of binders, also update binding target's data
        //returns [(username, userhash),...]
        var self = this
        var promise = new $.Deferred()
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.who_are_joining'
        var p_id = self.presentation.p_id
        var flag = self.flag_of_token
        var command = new Command(cmd, [p_id, flag])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                return promise.reject(response.retcode, response.stderr.message, response.stderr)
            }
            promise.resolve(response.stdout)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    }
    ,cue:function(point,delay){
        var self = this
        var screen_frame = this.screen_frame_ele
        var promise = new $.Deferred()
        if (point){
            self.cuing_info = { id: 'cursor' }
            self.cue_center_square.style.display = ''
            var rect = this.content_rect
            var scale = point.s
            if (point.cw) {
                //called by remote sync
                point.x = (point.x * this.content_rect.width  / point.cw) 
                point.y = (point.y * this.content_rect.height / point.ch)
            }
            screen_frame.classList.remove('cued')
            screen_frame.classList.add('cuing')
            var dx = point.dx || Math.round((self.content_rect.width / 2) - point.x) * scale 
            var dy = point.dy || Math.round((self.content_rect.height / 2) - point.y) * scale
            this.set_zooming(scale, [Math.round(rect.width / 2), Math.round(rect.height / 2)], [dx,dy])
            var rel_pos0 = Math.round(dx / this.page_rect.width * 1000)
            var rel_pos1 = Math.round(dy / this.page_rect.height * 1000)
            this.presentation.current_slide.translate[0] = rel_pos0
            this.presentation.current_slide.translate[1] = rel_pos1
            if (delay){
                setTimeout(function () {
                    //cuing 是在cue時有動感，cued讓動感消失，拖動的感覺比較好
                    screen_frame.classList.remove('cuing')
                    screen_frame.classList.add('cued')
                    self.enable_dragging()
                    promise.resolve()
                }, 210)//.cuing的transition是0.2s
                return promise
            }
            else return $.when()
        }
        else{
            //disable cue時，self.cue_center_square可能已經被刪掉
            if (self.cue_center_square) self.cue_center_square.style.display = 'none'
            self.screen_frame_ele.classList.remove('zoomed-in')
            self.cuing_info = null
            //reset_zooming()不會寫資料，所以要在這裡寫（因為cue()有寫，在此要寫回來）
            self.presentation.current_slide.zoom = [1, [0, 0], [0, 0]]
            self.presentation.current_slide.translate = [0, 0]
            self.reset_zooming()
            if (delay){
                self.screen_frame_ele.classList.add('cuing')
                self.screen_frame_ele.classList.remove('cued')
                setTimeout(function () {
                    //cuing 是在cue時有動感，cued讓動感消失，拖動的感覺比較好
                    self.screen_frame_ele.classList.remove('cuing')
                    self.screen_frame_ele.classList.add('cued')
                    promise.resolve()
                }, delay)
                return promise
            }
            else {
                return $.when()
            }
        }

    }
    ,show_boards: function () {
        //使用者管理presentation的介面
        var self = this
        var the_grid = null
        // 取消keyboard shortcut，讓輸入正常
        self.presentation.keyboard_shortcut.suspend = true
        w2popup.open({
            name: 'user-presentations',
            width:  this.content_rect.width + 'px',
            height: ( this.content_rect.height * 0.8) + 'px',
            body:'<div class="content" style="width:100%;height:100%"></div>',
            onClose: function () {
                the_grid.destroy()
                // 恢復 keyboard shortcut
                self.presentation.keyboard_shortcut.suspend = false
            }
        })
        _.defer(function () {
            var max_presentation_number = 10
            var $popup = $('#w2ui-popup')
            $popup.find('.content').html('<div style="width:100%;height:100%" class="user-presentations-table"></div>')
            self.sbs_user.get_all_presentations().done(function(presentations_dict){
                $popup.find('.user-presentations-table').w2grid({
                    name:'user-presentations-table',
                    multiSelect:false,
                    columns: [
                         { field: 'default', caption: 'User Default Board', size: '50px', resizable: true,  editable: { type: 'checkbox', style: 'text-align: center' } ,tooltip:'Set as user\s default board'}
                        ,{ field: 'ctime',caption:'Creation Time', size:'100px', resizable: true , info:true}
                        ,{ field: 'name', caption: 'Name', size: '100%', resizable: true, editable:{type:'text'}, tooltip:'double click to change'}
                        ]
                    ,show: {
                        toolbar:true,
                        toolbarAdd:false,
                        toolbarEdit:false,
                        toolbarDelete:true,
                        toolbarSearch:false,
                        toolbarReload:false,
                        toolbarColumns:false,
                        toolbarInput:false,
                        emptyRecords:false,
                        lineNumbers : true
                    },
                    onDelete:function(evt){
                        //w2ui此處有個bug，它會呼叫兩次，但兩次的evt.phase都是before
                        //先defer之後才會有evt.phase=='after'
                        var delete_recid = the_grid.getSelection()[0]
                        var p_id = delete_recid
                        evt.done(function(evt2){
                            window.loading(true)
                            self.sbs_user.remove_presentation(p_id).done(function(result){
                                window.loading(false)
                                if (result.ss && result.ss == self.presentation.p_id){
                                    //本presentation被移除
                                    location.href = location.pathname //remove hash
                                }
                                else if (result.ss){
                                    //移除成功
                                    delete presentations_dict[p_id]
                                    the_grid.get(result.default_p_id).default = true
                                    the_grid.refreshCell(result.default_p_id,'default')
                                    //show "add" button if necessary
                                    if (_.size(presentations_dict) < max_presentation_number && (!the_grid.toolbar.get(the_grid.buttons.add.id))){
                                        the_grid.toolbar.add(the_grid.buttons.add)
                                    }
                                }
                                else{
                                    //移除失敗
                                    console.log('remove failed')
                                }
                            }).fail(function(errmsg,retcode){
                                window.loading(false)
                                console.log('failed to remove presentation',errmsg)
                            })
                        })
                    },
                    onAdd:function(evt){
                        w2popup.message({
                            width:300,
                            height:200,
                            html:'<div style="padding: 60px; text-align: center">Are your sure to add a new board?</div>'+
                                '<div style="text-align: center"><button class="w2ui-btn yes">Yes</button><button onclick="w2popup.message()" class="w2ui-btn">Cancel</button></div>',
                        })
                        _.defer(function(){
                            $popup.find('button.yes').click(function(){
                                w2popup.message()
                                var name = 'my new board'
                                window.loading(true)
                                //不上傳檔案，所以第二參數為 []
                                self.sbs_user.create_presentation(name,[]).done(function(result){
                                    window.loading(false)
                                    // update grid's records
                                    var ctime = result.ctime ? new Date(result.ctime * 1000) : ''
                                    the_grid.add({
                                        recid:result.p_state.id,
                                        ctime:ctime.toLocaleDateString()+' '+ctime.toLocaleTimeString(),
                                        name:name,
                                        //以目前（2019-03-10T06:21:52+00:00）的設計，一定是false
                                        default:false
                                    })
                                    // update local cache
                                    presentations_dict[result.p_state.id] = {
                                        name:name,
                                        ctime:result.ctime,
                                        default:false
                                    }
                                    //removew "add" button if necessary
                                    if (_.size(presentations_dict) >= max_presentation_number && the_grid.toolbar.get(the_grid.buttons.add.id)) {
                                        the_grid.toolbar.remove(the_grid.buttons.add.id)
                                    }
                                })
                            })
                        })
                    },
                    onChange:function(evt){
                        if (evt.phase == 'before'){
                            //evt.done(function(evt){
                                var p_id = evt.recid
                                var column = evt.column //0-based
                                if (column == 0){
                                    var checked = evt.value_new
                                    //只能更換default，不能取消;因為一定要有一個
                                    if (!checked) {
                                        evt.preventDefault()//cancel this changes
                                        return
                                    }
                                    if (_.size(presentations_dict) <= 1) return

                                    // w2ui 必須呼叫save，表示接受這個動作，
                                    // 否則內在的狀態沒改變，refresh不會有效果.
                                    // 此時 the_grid.get(p_id).default 仍為 false
                                    // 需手動變更為 true
                                    the_grid.save()

                                    self.sbs_user.set_presentation_default(p_id).done(function(success){
                                        window.loading(false)
                                        //取消現在這個
                                        for (var  _p_id in presentations_dict){
                                            if (p_id == _p_id) continue
                                            if (presentations_dict[_p_id].default){
                                                the_grid.get(_p_id).default = false
                                                the_grid.refreshCell(_p_id,'default')
                                                presentations_dict[_p_id].default = false
                                            }
                                        }
                                        // check目前的default
                                        // 更新 record 才會一直有onChange event
                                        presentations_dict[p_id].default = true
                                        the_grid.get(p_id).default = true
                                        the_grid.refreshCell(p_id,'default')
                                    })

                                }
                                else if (column == 2){ //change name
                                    //2019-03-09T05:01:46+00:00 : 更新 record 才會一直有onChange event
                                    // flag is 1, 因為此功能只開放給擁有者
                                    evt.done(function(evt){
                                        var name = evt.value_new
                                        window.loading(true)
                                        self.sbs_user.rename_presentation(p_id,1,name).done(function(success){
                                            window.loading(false)
                                            the_grid.get(evt.recid).name = name
                                        })
                                    })
                                }
                            //})
                        }
                    }
                })
                var records = []
                for (var p_id in presentations_dict){
                    var ctime = presentations_dict[p_id].ctime ? new Date(presentations_dict[p_id].ctime * 1000) : ''
                    records.push({
                        recid: p_id,
                        name: presentations_dict[p_id].name,
                        ctime:ctime.toLocaleDateString()+' '+ctime.toLocaleTimeString(),
                        default: presentations_dict[p_id].default
                    })
                }
                _.defer(function(){
                    the_grid = w2ui['user-presentations-table']
                    the_grid.buttons.delete.tooltip = 'Delete selected board'
                    the_grid.buttons.add.tooltip = 'Add new board (max is 10)'
                    the_grid.records = records
                    if (_.size(presentations_dict) < max_presentation_number)  the_grid.toolbar.add(the_grid.buttons.add)
                    the_grid.toolbar.add([{
                        id:'open',
                        type:'button',
                        text:'Open',
                        tooltip:'Goto selected board',
                        icon:'fa fa-external-link-alt',
                        onClick:function(){
                            var p_id = the_grid.getSelection().length ? the_grid.getSelection()[0] : null
                            if (!p_id) return
                            else if (p_id == self.presentation.p_id) return
                            self.sbs_user.get_presentation_token(p_id).done(function(acl_token){
                                var url = location.pathname + '#' + '2' + acl_token.ss
                                open(url)
                            })
                        }
                    }
                    ,{type:'spacer'}
                    ,{
                        id:'go',
                        type:'button',
                        text:'Open Shortcut code',
                        tooltip:'Goto another board by shortcutcode',
                        icon:'fa fa-directions',
                        onClick:function(){
                            w2popup.message({
                                width:300,
                                height:200,
                                html:'<div style="padding: 60px; text-align: center"><input style="font-size:20px;text-align:center" placeholder="shortcut code" class="shortcut-code"></div>'+
                                    '<div style="text-align: center"><button class="w2ui-btn yes">Yes</button><button onclick="w2popup.message()" class="w2ui-btn">Cancel</button></div>',
                            })
                            _.delay(function(){
                                $popup.find('input.shortcut-code').focus()
                                $popup.find('input.shortcut-code').on('change',function(){
                                    $popup.find('button.yes').click()
                                })
                                $popup.find('button.yes').click(function(){
                                    var code = $popup.find('input.shortcut-code').val()
                                    //go_shortcut_code()
                                    if (/^\d{6}$/.test(code)){
                                        w2popup.message()
                                        open(location.pathname + '#0'+code)
                                    }
                                    else{
                                        $popup.find('input.shortcut-code').val('')
                                        $popup.find('input.shortcut-code').prop('placeholder','6 digits')
                                        setTimeout(function(){
                                            $popup.find('input.shortcut-code').prop('placeholder','shortcut code')
                                        },3000)
                                    }
                                })
                            },1000)//wait a second to put focus on <input>
                        }
                    }
                    ])
                    the_grid.refresh()
                })
            })
        })
    }
}

function call_when_ready(passcode) {
    //figure out what hash we have, and recover hash from localstorage if necessary
    var hash = window.location.hash.replace(/^#/, '')

    //flag is always 2 for whteboard
    var flag_of_token
    var p_id
    if (hash) {
        flag_of_token = parseInt(hash.substring(0, 1))
        p_id = hash.substring(1)
    }
    else {
        //default to myown presentation
        flag_of_token = 2
        p_id = global_config.ss_token
        // access my own board, but show URL as a co-author url
        // for user to copy and share to others
        window.location.hash = '2' + p_id
    }
    /*
    window.saved_hash = window.location.hash.substring(1)
    if ("pushState" in window.history){
        window.history.pushState('', document.title, window.location.pathname);
    }else{
        window.location.hash = ''
    }
    */


    window.presentation_screen = new PresentationScreen(p_id, $('#page')[0], flag_of_token, passcode)

    //whiteboard use one thread only
    window.presentation_screen.presentation.max_number_of_thread = 1

    window.presentation_screen.on_init()

    /* 比較不干擾，自動消失的訊息 */
    var _mt;
    window.message = function (html, options) {
        //html: (string), empty to close
        //options:
        // ttl: (int) seconds to keep, default 1
        // position: bottom, top or middle in vertical , default bottom
        if (_mt) { clearTimeout(_mt); _mt = null }
        if (html) {
            var ttl = (options ? (options.ttl || 1) : 1)
            var position = (options ? (options.position || 'bottom') : 'bottom')
            document.getElementById('message').innerHTML = html
            var rect = window.presentation_screen.content_rect
            document.getElementById('message').style.left = rect.left + 'px'
            document.getElementById('message').style.width = rect.width + 'px'
            var height_of_page_header = window.presentation_screen.page_head_height
            var height_of_messge = 20
            if (position == 'top') {
                document.getElementById('message').style.top = height_of_page_header + 'px'
            }
            else if (position == 'middle') {
                document.getElementById('message').style.top = Math.round((rect.height - height_of_messge) / 2) + 'px'
            }
            else {
                //default position (bottom)
                document.getElementById('message').style.top = (rect.height - height_of_messge + height_of_page_header) + 'px'
            }

            document.getElementById('message').style.display = 'block'
            _mt = setTimeout(function () {
                window.message('')
            }, ttl * 1000)
        }
        else {
            document.getElementById('message').style.display = 'none'
            return
        }
    }

    //implement loading
    window.loading = function (yes, message, showSpinner) {
        if (yes && window._loading_count) return ++window._loading_count
        if (yes) {
            window._loading_count = 1
            document.body.cursor = 'wait'
            w2utils.lock(document.body, message, showSpinner)
        }
        else if (window._loading_count) {
            window._loading_count -= 1
            if (window._loading_count == 0) {
                delete window._loading_count
                document.body.cursor = ''
                w2utils.unlock(document.body)
            }
        }
    }


    // no need to listen "orientationchange", because orientation change will trigger resize event too.
    // but pinch would also trigger "resize" event, so we have to prohibit it to occure reload
    var _pinching = false
    window.addEventListener('touchstart', function (evt) {
        _pinching = (evt.touches.length == 2) ? true : false
    }, false)
    window.addEventListener('touchend', function (evt) {
        _pinching = (evt.touches.length == 2) ? true : false
    }, false)

    //handle window resizing
    //called also by dashboard when user adjust panel size
    //rotation in mobile iOS would trigger this event too
    var refresh_overlay = _.throttle(function () {
        //draw drawings on overlay
        window.presentation_screen.overlay.draw.clear()
        window.presentation_screen.overlay.draw_restore(window.presentation_screen.presentation.current_slide.slide_overlay.layers[0])
    }, 1000, { trailing: true, leading: false })

    window.onresize = _.throttle(function (evt) {

        //mobile safari fires a resize event soon after loading, ignore it (好像解了，所以取消）
        //if (evt.timeStamp < 2000) return
        if (_pinching) return

        //triggered by fullscreen request, so we dont need to reload
        if (window.presentation_screen._requesting_fullscreen) {
            delete window.presentation_screen._requesting_fullscreen
            return
        }

        window.presentation_screen.set_size()

        _.defer(function () {
            // gs-toolbar
            var gs_toolbar_div = document.querySelector('.gs-toolbar')
            if (gs_toolbar_div) {
                var rect = window.presentation_screen.content_rect
                var toolbar_height = 29 // div.punch-viewer-nav-v2.punch-viewer-nav-fixed
                gs_toolbar_div.style.top = (rect.top + rect.height - toolbar_height) + 'px'
                gs_toolbar_div.style.left = (rect.left + 2) + 'px'
            }

            refresh_overlay()
            var panel_name = 'main'

            window.presentation_screen.display_areas[panel_name].content_fitting()
        })
    }, 500, { leading: false, trailing: true })

    window.set_tooltip = function (top_ele) {
        /* top_ele, an element has attribute tooltip,
           if it has not, search for all its children.
           tooltip format: "position;content"
           position := top, bottom, right, left
           ex: <a tooltip="bottomLthis is a book">
        */
        var _add_tip = function (ele) {
            $(ele).hover(function (evt) {
                var content = evt.currentTarget.getAttribute('tooltip')
                var pos = content.indexOf(':')
                var position = content.substring(0, pos)
                var message = content.substring(pos + 1)
                $(evt.currentTarget).w2tag(message, { position: position })
            }, function (evt) {
                $(evt.currentTarget).w2tag('')
            })
        }
        if (top_ele.getAttribute('tooltip')) {
            _add_tip(top_ele)
        }
        else {
            _.each(ele.querySelectorAll('[tooltip]'), function (ele) {
                _add_tip(ele)
            })
        }
    }


    //patching (extends)

    SBSUser.prototype.set_passcode = function (options) {
        var cmd = ObjshSDK.metadata.runner_name + '.root.sidebyside.set_passcode'
        var promise = new $.Deferred()
        var p_id = options.p_id
        var flag = options.flag
        var passcode = options.passcode
        var command = new Command(cmd, [p_id, flag, passcode])
        window.sdk.send_command(command).done(function (response) {
            if (response.retcode != 0) {
                w2alert('set passcode failure:', response.stderr)
                return promise.reject(response)
            }
            promise.resolve(true)
        }).fail(function (jqXHR, textStatus, errorThrown) {
            w2alert('add slides failure:', [jqXHR, textStatus, errorThrown])
            promise.reject(jqXHR.status, jqXHR.statusText)
        })
        return promise
    }

    if (window.chrome){
        // try to setup communication to chrome extension
        var extension_id
        if (window.screen.width == 2560){
            extension_id = 'mffjpmpmpllfooonljiibcaigfaecndd' //mac mini
        }
        else if (window.screen.width == 1140 || window.screen.width == 1920){
            extension_id = 'nbfpcfiehejkmpmejabablkffnfknpbj' //macbookpro
        }
        //console.log('extension_id=',extension_id,'screen-width =',window.screen.width)
        if (extension_id){
            // register to chrome extension
            chrome.runtime.sendMessage(extension_id, {do:'hello'},function(response) {
                if (response) {}//console.log('registry succeed')
                else console.warn('registry failed')
            });
            window.addEventListener('whiteboard-extension', function (event) {
                var detail = event.detail
                console.log('>>detail')
                switch(detail.do){
                    case 'paste':
                        if (detail.type == 'image'){
                            if (detail.target == 'background'){
                                //直接貼在slide background
                                window.presentation_screen._handle_dnd_paste(detail.src, window.presentation_screen.presentation.current_slide.idx)
                            }
                            else if (detail.target == 'widget' && Widget.selected.length){
                                Widget.selected[0].on_paste_string(detail.src)
                            }
                        }
                        break
                }
            }, false);
        }
    }
}

window.request_passcode = function (callback) {
    w2prompt('Passcode', 'Access Limited', function (value) {
        if (value.length > 20) value = value.substring(0, 20)
        if (callback) {
            callback(value)
        }
        else {
            call_when_ready(value)
        }
    })
    //catch cancel event, workaround for w2ui v1.5
    _.defer(function () {
        $('#w2ui-popup .w2ui-btn#Cancel').on('click.w2prompt', function (evt) {
            w2alert('Access denied, will direct to your own board').done(function () {
                location.href = 'whiteboard.html'
            })
        });
    }, 1000)
}


window.addEventListener('DOMContentLoaded', function () {
    //disable the page-no and nigation link on left and right side
    //create a tabs bar on footer for doing page navigation
    $('.page-no').hide()
    $('.page-total').hide()
    $('#prev-btn').hide()
    $('#next-btn').hide()
    $('.nav-btn-bar').off('hover')
    $('#prev-btn span').off('click')
    $('#next-btn span').off('click')

    // Create the measurement node
    var scrollDiv = document.createElement("div");
    scrollDiv.className = "scrollbar-measure";
    document.body.appendChild(scrollDiv);
    // Get the scrollbar width(same height)
    window.scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
    // Delete the DIV
    document.body.removeChild(scrollDiv);

    var re_check_interval = 10
    var config_checker = function () {
        if (typeof (global_config) !== 'object' || global_config === null) {
            setTimeout(function () { config_checker() }, re_check_interval)
        }
        else {
            if (global_config.retcode) {
                w2alert(global_config.stderr).done(function () {
                    window.location.href = 'whiteboard.html'
                })
                return
            }
            else if (window.location.hash && window.location.hash.substr(0, 2) == '#0') {
                if (global_config.ss_token) {
                    window.location.hash = '#2' + global_config.ss_token
                }
                else {
                    window.location.hash = '#' + global_config.flag + global_config.token
                }
            }

            if (global_config.redirect) {
                window.location.href = global_config.url
            }
            else if (global_config.delegate_host) {
                //redirect to delegate_host
                setTimeout(function () { config_checker() }, re_check_interval)
                window.request_global_config(global_config.delegate_host)
                global_config = null
                delete window.global_config
                return
            }
            else if (global_config.require_login) {
                //will request config again after login
                var host = global_config.host
                //host is None for single server, so set it to '/'
                var url = (host ? (/\/$/.test(host) ? host : host + '/') : '/') + 'login?type=sbs'
                //auto login
                global_config = null
                delete window.global_config
                $.ajax({
                    url: url,
                    success: function () {
                        window.request_global_config(host)
                        setTimeout(function () {
                            config_checker()
                        }, re_check_interval)
                    }
                })
                return
            }
            else if (global_config.require_passcode) {
                window.request_passcode()
                return
            }
            else {
                //called firstly
                call_when_ready('')

                if (location.pathname.split('/').pop() == 'vscode.html') {
                    // in vscode
                    global_config.vscode = 1
                    window.vscode_client = new VSCodeClient()
                    window.vscode_client.call_when_ready()
                }
            }
            // keep global_config for reconnection
            //delete global_config
        }
    }
    setTimeout(function () { config_checker() }, re_check_interval)
})