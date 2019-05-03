/* 
Handles drag-and-drop and paste.
Depends on JQuery 
*/
function DnDEnabler(){
    /*
     * delegate protocol:
     * on_dnd({
            is_directory:false,
            is_file:true,
            item:item,
            name:file.name or folder's name  if is_directory is true,
            mimetype:item.type,
            file:file or [file] if is_directory is true
        })
     * on_dnd_string( text, event )
     * on_paste({
            is_directory:false,
            is_file:true,
            item:item,
            name:'image.'+$timestamp+'.png'
            mimetype:item.type,
            file:file
     * })
     * on_paste_string(text, event)
     */
    this.dragover_classname = 'dragover'
}
DnDEnabler.prototype = {
    disable:function(namespace,selector){
       $(selector).off('.'+namespace)
    },
    enable:function(namespace,selector,delegate){
        /*
         * enable selected elements to be droppable. (used by dashboard.js)
         */
        var self = this
        namespace = '.'+namespace
        $(selector).on('dragenter'+namespace,function(evt){
            evt.currentTarget.classList.add(self.dragover_classname)
        })
        $(selector).on('dragleave'+namespace,function(evt){
           evt.currentTarget.classList.remove(self.dragover_classname)
        })
        $(selector).on('dragover'+namespace,function(evt){
            evt.preventDefault()//must have this to enable drop on selector
            if (!evt.currentTarget.classList.contains(self.dragover_classname))
                evt.currentTarget.classList.add(self.dragover_classname)
        })
        $(selector).on('drop'+namespace,function(evt){
            evt.currentTarget.classList.remove(self.dragover_classname)
            //let browser not to display image if dropped file is an image
            evt.preventDefault()
            evt.stopPropagation()
            self.on_drop(evt,delegate)
        })
    },
    on_drop:function(evt,delegate){
        var self = this
        var items = evt.originalEvent.dataTransfer.items
        //1次drop會產生plain 跟 html兩種item（或以上），只取一個;
        //貼上用右鍵選單所複製圖片時甚至會有plain, html, file 三種;
        var the_item;//only use this one
        for (var i = 0; i < items.length; i++) { 
            var item = items[i]; 
            if (item.kind=='string' && item.type=='text/plain'){
                //first priority
                the_item = item
                break
            }
            else if (item.kind == 'file'){
                //second priority
                the_item = item
            }
            else {
                //pass (such as text/uri-list)
                console.log('ignore drop type:'+item.kind+';'+item.type)
            }
        }
        if (!the_item){

        }
        else if (the_item.kind === 'string'){
            the_item.getAsString(function(text){
                delegate.on_dnd_string(text,evt)
            })
        }
        else if (the_item.webkitGetAsEntry){
            //chrome, safari
            var entry = the_item.webkitGetAsEntry()
            if (entry && entry.isDirectory){
                //console.log(entry)
                var dirReader = entry.createReader();
                var ret = {
                    is_directory:true,
                    is_file:false,
                    item:the_item,
                    name:entry.name,
                    files:[]
                }
                dirReader.readEntries(function(entries) {
                    //array of [FileEntry] ,
                    //Caution: nested directory not handled yet
                    var idx = 0
                    var read_file = function(idx){
                        if (idx >= entries.length) {
                            delegate.on_dnd(ret,evt)
                            return
                        }
                        entries[idx].file(function(f){
                            if (f){
                                ret.files.push(f)
                            }
                            read_file(idx+1)
                        })
                    }
                    read_file(0)
                })
            }
            else if (the_item.type.indexOf('image/')==0){
                var f = the_item.getAsFile()
                delegate.on_dnd({
                    is_directory:false,
                    is_file:true,
                    item:the_item,
                    name:f.name,
                    mimetype:the_item.type,
                    file:f
                },evt)                  
            }
            else if (the_item.type.indexOf('application/pdf')==0){
                entry.file(function(f){
                    delegate.on_dnd({
                        is_directory:false,
                        is_file:true,
                        item:the_item,
                        name:f.name,
                        mimetype:the_item.type,
                        file:f
                    },evt)
                })
            }
            else if (entry){
                //console.log('@2',[item,entry])
                entry.file(function(f){
                    //self.message('found '+f.name)
                    delegate.on_dnd({
                        is_directory:false,
                        is_file:true,
                        item:the_item,
                        name:f.name,
                        mimetype:the_item.type,
                        file:f
                    },evt)
                })
            }
            else {
                delegate.on_dnd({
                    is_directory:false,
                    is_file:false,
                    item:the_item //DataTransferItem
                },evt)
            }    
        }
        else{
            //not supported browser
            delegate.on_dnd({
                is_directory:false,
                is_file:false,
                item:the_item
            },evt)      
        }
    },
    enable_paste:function(namespace,selector,delegate){
        var self = this
        $(selector).on('paste.'+namespace,function(evt){
            //如果是<input> or <textarea> 不要做任何動作（讓default運作）
            if (evt.target.tagName == 'INPUT' || evt.target.tagName == 'TEXTAREA') return
            self.on_paste(evt,delegate)
        })
    },
    on_paste:function(evt,delegate){
        /* Due to that Chrome accepts image paste only,
         * Currently, only image is handled
         */
        evt.stopPropagation()
        var self = this
        var items = (evt.clipboardData || evt.originalEvent.clipboardData).items;
        //1次複製會產生plain 跟 html兩種item，只取一個;
        //貼上用右鍵選單所複製圖片時甚至會有plain, html, file 三種;
        var the_item;//only use this one
        for (var i = 0; i < items.length; i++) { 
            var item = items[i]; 
            if (item.kind == 'file'){
                the_item = item
                break
            }
            else if (item.kind=='string' && item.type=='text/plain'){
                the_item = item
            }
            else {
                //pass
            }
        }
        
        if (the_item.kind=='string'){
            the_item.getAsString(function(s){
                //For Chrome, if a non-image file is pasted, we got filename here.
                //    if some text from webpage is pasted, we got html here.
                //    or just some pure text such as copied from LINE
                delegate.on_paste_string(s,evt)
            })
        }
        else if (the_item.kind == 'file'){
            if (the_item.webkitGetAsEntry){
                //chrome, safari
                var entry = the_item.webkitGetAsEntry()
                if (entry && entry.isDirectory){
                    //browser does not support
                    //this case wont happen, just as a placeholder here.
                }
                else {
                    var file = the_item.getAsFile()
                    //console.log('>>>>',item,file)
                    if (file){
                        //1. an image in clipboard(such as screenshot)
                        //2. an image file in clipboard(such as copy an .png,.pdf file)

                        //inject timestamp into filename
                        var parts = file.name.split('.')
                        parts.splice(parts.length-1,0,new String(Math.round(new Date().getTime()/1000)))

                        var ret = {
                            is_directory:false,
                            is_file:true,
                            name:parts.join('.'),
                            mimetype:the_item.type,
                            file:file
                        }
                        delegate.on_paste(ret,evt)
                    }
                    else{
                        //other kind of file is pasted in Chrome
                        console.log('@3',the_item)
                    }
                }    
            }
            else{
                //not supported browser
                console.log('@4',the_item)
            }
        }                
    }
}

/*
 *
 *  only used by index.js
 */
/*
 * Drag and Drop to upload
 */

function DnDSensor(delegate,box,rect){
    /* If user drag a file enter "box",
     * show up an area(element;aka sensor) at "rect"(position).
     * 
     * delegate should implement
     * on_dnd_file(files)
     * on_dnd_message()
     */

     /* 2019-03-21T03:53:39+00:00 disabled, because iindex.js seems not call this anymore */
    console.warn('DnDSensor is deprecated')
    return

    this.delegate = delegate
    this._div_id = '_dnd_sensor'
    // this box is the outer (first) sensor area, usually is document.body
    this.box = box
    //this element accepts droping files
    this.drop_responser = null
    // use this to control show/hide the self.drop_responser element
    // because we have an extra drogleave event when drogover self.drop_responser
    this._drogover_counter = 0

    this.z_index = 300
    //the position to put sensor
    //rect:{width,height,top,left}, the position to put sensor
    this.rect = rect
    this.init()
}
DnDSensor.prototype = {
    init:function(){
        var self = this
        // drop_responser is the area where user drop files
        var rect = this.rect
        if (rect){
            //create the area for dropping files
            this.drop_responser = document.createElement('div')
            this.drop_responser.setAttribute('id',self._div_id)
            this.drop_responser.setAttribute('style','display:none;background-color:rgba(0,0,255,0.5);width:'+rect.width+'px;height:'+rect.height+'px;position:fixed;left:'+rect.left+'px;top:'+rect.top+'px;')        
            // the input file is required to trigger on_paste and on_drop event
            this.drop_responser.innerHTML = '<h1 style="position:absolute;top:25%">&nbsp;</h1>'+
                '<input type="file" name="dragupload[]" multiple="multiple" style="position:absolute;top:0;left:0;right:0;opacity:0.1;bottom:0;width:100%;height:100%;backround-color:yellow;" />'
            this.drop_responser.ondrop = function(e){
                self._drogover_counter = 0
                self.drop_responser.style.display = 'none'
                self.on_drop(e)
            }
            document.body.appendChild(this.drop_responser)    

            /* 2019-03-21T03:44:43+00:00  use winddow.message 
            //create myown message element, because original message board might be covered below 
            this.message_div = document.createElement('div')
            this.message_div.setAttribute('id',this._div_id+'_message')
            this.message_div.setAttribute('style','width:'+rect.width+'px;text-align:center;z-index:'+(this.z_index+1)+';display:none;position:absolute')
            this.message_div.style.left = rect.left+'px'
            this.message_div.style.top = Math.round(rect.top+rect.height/2)+'px'
            document.body.appendChild(this.message_div)
            */

            //a box to detect dragging and show the drop-area to user
            var on_dragenter = function(evt){
                console.log(evt)
                self._drogover_counter += 1
                //bring up drop_responser by z-index only when it is visible
                self.drop_responser.style.display = ''
                self.drop_responser.style.zIndex = self.z_index
            }
            var on_dragleave = function(evt){
                self._drogover_counter -= 1        
                if (self._drogover_counter==0) {
                    self.drop_responser.style.display = 'none'
                    self.drop_responser.style.zIndex = ''
                }
            }        
            this.box.ondragenter =  function(e){on_dragenter(e)}
            this.box.ondragleave =  function(e){on_dragleave(e)}
        }
    },
    message:function(text){
        return window.message(text)
        /*
        if (this.rect){
            if (this._message_timer) clearTimeout(this._message_timer)
            this.message_div.style.display = ''
            document.getElementById(this._div_id+'_message').innerHTML = html

            var self = this
            this._message_timer = setTimeout(function(){
                self._message_timer = 0
                self.message_div.style.display = 'none'
                document.getElementById(self._div_id+'_message').innerHTML = ''
            },1500)
        }
        else{
            this.delegate.on_dnd_image(html)
        }
        */
    },
    on_drop:function(evt){
        var self = this
        for (var i = 0; i < evt.dataTransfer.items.length; i++) { 
            var item = evt.dataTransfer.items[i]; 
            if (!item.kind=='file') continue;            
            if (item.webkitGetAsEntry){
                //chrome, safari
                var entry = item.webkitGetAsEntry()
                if (entry && entry.isDirectory){
                    var dirReader = entry.createReader();
                    var ret = {
                        is_directory:true,
                        name:entry.name,
                        files:[]
                    }
                    dirReader.readEntries(function(entries) {
                        //array of [FileEntry] ,
                        //Caution: nested directory not handled yet
                        var idx = 0
                        var read_file = function(idx){
                            if (idx >= entries.length) {
                                self.message('found '+entry.name+' and #'+ret.files.length+' files')
                                self.delegate.on_dnd_file(ret)
                                return
                            }
                            entries[idx].file(function(f){
                                if (f){
                                    ret.files.push(f)
                                }
                                read_file(idx+1)
                            })
                        }
                        read_file(0)
                    })
                }
                else if (item.type.indexOf('image/')==0){
                    var f = item.getAsFile()
                    self.message('found '+f.name)
                    self.delegate.on_dnd_file({
                        is_directory:false,
                        name:f.name,
                        mimetype:item.type,
                        file:f
                    })                  
                }
                else if (item.type.indexOf('application/pdf')==0){
                    entry.file(function(f){
                        self.message('found '+f.name)
                        self.delegate.on_dnd_file({
                            is_directory:false,
                            name:f.name,
                            mimetype:item.type,
                            file:f
                        })
                    })
                }
                else if (entry){
                    //console.log('@2',[item,entry])
                    //self.delegate.on_dnd_file(entry)
                    entry.file(function(f){
                        self.message('found '+f.name)
                        self.delegate.on_dnd_file({
                            is_directory:false,
                            name:f.name,
                            mimetype:item.type,
                            file:f
                        })
                    })
                }
                else {
                    self.message('skip '+item.type) 
                    console.log('@2',[item,entry])
                }    
            }
            else{
                //not supported browser                
                console.log('@3',item)
            }
        }        
    },
    on_paste:function(evt){        
        /* Due to that Chrome accepts image paste only,
         * Currently, only image is handled
         */
        console.log(evt)
        var self = this
        var items = (evt.clipboardData || evt.originalEvent.clipboardData).items;
        for (var i = 0; i < items.length; i++) { 
            var item = items[i]; 
            if (item.kind=='string'){
                item.getAsString(function(s){
                    //For Chrome, if a non-image file is pasted, we got filename here.
                    //    if some text from webpage is pasted, we got html here.
                    //    or just some pure text such as copied from LINE
                    console.log('string=',s)
                })
                continue
            }
            else if (item.kind != 'file') continue;            
            if (item.webkitGetAsEntry){
                //chrome, safari
                var entry = item.webkitGetAsEntry()
                if (entry && entry.isDirectory){
                    //browser does not support, this case wont happen, just as a placeholder here.
                }
                else {
                    var file = item.getAsFile()
                    if (file){
                        //1. an image in clipboard(such as screenshot)
                        //2. an image file in clipboard(such as copy an .png,.pdf file)                        
                        self.handle_image_file(item.type,file)
                    }
                    else{
                        //other kind of file is pasted in Chrome
                        console.log('@3',item)
                    }
                }    
            }
            else{
                //not supported browser
                console.log('@4',item)
            }
        }        
    },
    handle_image_file:function(mimetype,file){
        //update myself's main panel (temporary quick-and-dirty workaround)
        self.delegate.on_dnd_image(file,mimetype)
    },
    handle_embedded_file:function(mimetype,file){
        //update myself's main panel (temporary quick-and-dirty workaround)
        var self = this
        var url =  URL.createObjectURL(file)
        self.project_screen.set_panel_embedded_file('main',{mimetype:mimetype,url:url})    
        // sync to server
        /*
        this.project_screen.send_to_bus('embedded',file,{
            blob:true,
            mimetype:mimetype,
            name:file.name,
        })
        */
    }
         
}
