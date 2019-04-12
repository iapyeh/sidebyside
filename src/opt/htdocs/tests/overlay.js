/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';
function init_video(){
    var snapshotButton = document.querySelector('button#snapshot');
    var filterSelect = document.querySelector('select#filter');
    
    // Put variables in global scope to make them available to the browser console.
    var video = window.video = document.querySelector('video');
    var canvas = window.canvas = document.querySelector('#canvas');
    canvas.style.width = '480px'
    canvas.style.height = '360px';
    canvas.width = 480;
    canvas.height = 360;
    
    snapshotButton.onclick = function() {
      canvas.className = filterSelect.value;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    };
    
    filterSelect.onchange = function() {
      video.className = filterSelect.value;
    };
    
    var constraints = {
      audio: false,
      video: true
    };
    
    function handleSuccess(stream) {
      window.stream = stream; // make stream available to browser console
      video.srcObject = stream;
      setTimeout(function(){
        window.app.objects.overlay.init()
      },3000)
      
    }
    
    function handleError(error) {
      console.log('navigator.getUserMedia error: ', error);
    }
    
    navigator.mediaDevices.getUserMedia(constraints).
        then(handleSuccess).catch(handleError);
}

window.addEventListener('DOMContentLoaded',function(){
  window.app = {
      objects:{
          overlay:new Overlay()
      }
  }
  try{
    init_video()
  }
  catch(e){
    window.app.objects.overlay.init()
  }
})


// Function to disable "pull-to-refresh" effect present in some webviews.
// Especially Crosswalk 12 and above (Chromium 41+) runtimes.

