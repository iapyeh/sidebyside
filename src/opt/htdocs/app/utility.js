function Utility(){
}
Utility.prototype = {
    get_header:function(url,callback){
        var xmlhttp = new XMLHttpRequest();
        http.open('HEAD', url);
        http.onreadystatechange = function() {
            if (xmlhttp.readyState==2){
                var header_lines = xmlhttp.getAllResponseHeaders().split('\n')
                var headers = {}
                for (var i=0;i<header_lines.length;i++){
                    var p = line.indexOf(':')
                    headers[line.substring(0,p).trim()] = line.substring(p+1).trim()
                }
                callback(this.status,headers)
            }            
        };
        http.send();
    },
    http_get:function(theUrl,callback,is_blob,progress_callback)
    {
        var xmlhttp=new XMLHttpRequest();
        if (is_blob) xmlhttp.responseType = "blob";
        var content_length = 1;
        var content_type = null;
        
        xmlhttp.onprogress = function(oEvent){
            if (oEvent.lengthComputable) {
                var percentComplete = oEvent.loaded / oEvent.total;
                if (progress_callback) progress_callback(percentComplete)
            } else {
                if (progress_callback) progress_callback('...')
            }            
        };
               
        xmlhttp.open("GET", theUrl, true );
        xmlhttp.send();    
        xmlhttp.onreadystatechange=function()
        {
            if (xmlhttp.readyState==4 && xmlhttp.status==200)
            {
                callback(content_type,content_length,xmlhttp.response);
            }            
            else if (xmlhttp.readyState==2){
                var headers = xmlhttp.getAllResponseHeaders().split('\n')
                for (var i=0;i<headers.length;i++){
                    var line = headers[i].toLowerCase()
                    if (line.indexOf('content-length')==0){
                        content_length = parseInt(line.substring(16))
                    }
                    else if (line.indexOf('content-type')==0){
                        content_type = line.substring(13).trim()
                    }
                }
            }
        }
    },
}