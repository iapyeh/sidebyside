
/*
 * Drag and Drop to upload
 */
function DnDUploader(project_screen,box){
    this.project_screen = project_screen
    //;this.form_id = 'uploadform'
    this.div_id = 'uploaddiv'
    this.box = box
    //this element accepts droping files
    this.drop_responser = null
    // use this to control show/hide the self.drop_responser element
    // because we have an extra drogleave event when drogover self.drop_responser
    this._drogover_counter = 0
}
DnDUploader.prototype = {
    init:function(rect){
        var self = this
        this.drop_responser = document.createElement('div')
        this.drop_responser.setAttribute('id',self.div_id)
        this.drop_responser.setAttribute('style','display:none;background-color:rgba(0,0,255,0.5);width:'+rect.width+'px;height:'+rect.height+'px;position:fixed;left:'+rect.left+'px;top:'+rect.top+'px;')        
        // the input file is required to trigger on_paste and on_drop event
        this.drop_responser.innerHTML = '<h1 style="position:absolute;top:25%">Things can be dragged and dropped here!</h1>'+
            '<input type="file" name="dragupload[]" multiple="multiple" style="position:absolute;top:0;left:0;right:0;opacity:0.1;bottom:0;width:100%;height:100%;backround-color:yellow;" />'+
        document.body.appendChild(this.drop_responser)
        this.box.ondragenter =  function(e){self.on_dragenter(e)}
        this.box.ondragleave =  function(e){self.on_dragleave(e)}
        this.drop_responser.ondrop = function(e){self.on_drop(e)}        
    },
    on_dragenter:function(evt){
        this._drogover_counter += 1
        //bring up drop_responser by z-index only when it is visible
        this.drop_responser.style.display = ''
        this.drop_responser.style.zIndex = 300
    },
    on_dragleave:function(evt){
        this._drogover_counter -= 1        
        if (this._drogover_counter==0) {
            this.drop_responser.style.display = 'none'
            this.drop_responser.style.zIndex = ''
        }
    },
    on_drop:function(evt){
        this._drogover_counter = 0
        this.drop_responser.style.display = 'none'
        var self = this
        for (var i = 0; i < evt.dataTransfer.items.length; i++) { 
            var item = evt.dataTransfer.items[i]; 
            if (!item.kind=='file') continue;            
            if (item.webkitGetAsEntry){
                //chrome, safari
                var entry = item.webkitGetAsEntry()
                if (entry && entry.isDirectory){
                    var dirReader = entry.createReader();
                    dirReader.readEntries(function(entries) {
                        //array of [FileEntry] ,
                        //Caution: nested directory not handled yet
                        var idx = 0
                        var send = function(idx){
                            if (idx >= entries.length) return
                            entries[idx].file(function(f){
                                if (f){
                                    //console.log('@11',f)
                                    self.handle_image_file(f.type,f)    
                                }
                                setTimeout(function(){send(idx+1)},2000)
                            })
                        }
                        send(0)
                    })
                }
                else if (item.type.indexOf('image/')==0){
                    self.handle_image_file(item.type,item.getAsFile())                    
                }
                else if (item.type.indexOf('application/pdf')==0){
                    var mimetype = item.type
                    entry.file(function(f){
                        self.handle_embedded_file(mimetype,f)
                    })
                }
                else {
                    console.log('@2',item,entry)
                }    
            }
            else{
                //not supported browser
            }
        }        
    },
    on_paste:function(evt){        
        /* Due to that Chrome accepts image paste only,
         * Currently, only image is handled
         */
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
                    //this case wont happen, just as a placeholder here.
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
        var reader = new FileReader();
        reader.addEventListener("loadend", function() {
            self.project_screen.set_panel_image('main',{src:reader.result})
        });
        reader.readAsDataURL(file)        
        
        // sync to server
        self.project_screen.send_to_bus('snapshot',file,{
            blob:true,
            mimetype:mimetype,
            name:file.name,
        })
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
