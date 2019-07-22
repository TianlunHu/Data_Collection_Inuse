'use strict';
function getConnection() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || navigator.msConnection;
}

function updateNetworkInfo(info) {
    document.getElementById('networkType').innerHTML = info.type;
    document.getElementById('effectiveNetworkType').innerHTML = info.effectiveType;
    document.getElementById('downlinkMax').innerHTML = info.downlinkMax;
}

var info = getConnection();
if (info) {
    info.addEventListener('change', updateNetworkInfo);
    updateNetworkInfo(info);
}

function runWebSocket(){
    if ("WebSocket" in window){
        //alert("WebSocket is available");
        //var ws = new WebSocket("ws://localhost:9998/echo");
        var ws = new WebSocket("wss://192.168.2.107:9998/echo");
        ws.onopen = function(){
            ws.send('Send Data');
            document.getElementById('Data').innerHTML = 'Sending Data';
        };

        ws.onmessage = function(evt){
            var received_msg = evt.data;
            document.getElementById('Receive').innerHTML = 'Data Received';
        };

        ws.onclose = function(){
            //document.getElementById('Socket').innerHTML = 'Connection closed';
            alert('Connection closed');
        }

    }

    else {
        document.getElementById('Socket').innerHTML = 'WebSocket is not available in your browser';
    }
}