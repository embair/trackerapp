/** Simple node.js script for benchmarking the application */

'use strict';

var request = require('request');

var sent = 0;
var rcvd = 0;
var failed = 0;
var startTime = process.hrtime();

function updateResult() {
    var t = process.hrtime(startTime)[0] + process.hrtime(startTime)[1]/1e9;
    console.log(Math.floor(rcvd/t).toString()+' req/s '+(sent-rcvd)+' processing '+ failed + ' rejected ' + rcvd + ' total');
}

function trackReqCallback(err, resp) {
    if (err || resp.statusCode !== 200) {
        ++failed;
    } else {
        ++rcvd;
    }
}

function sendTrackRequest() {
    while (sent - rcvd - failed < 100) { //juggle at most 100 unresolved requests at once
        ++sent;
        request.post('http://localhost:8000/track?count=1&foo=bar', {}, trackReqCallback);
    }
}

function sendCountRequest() {
    ++sent;
    request.get('http://localhost:8000/count', function(err, resp) {
        if (err || resp.statusCode !== 200) {
            ++failed;
        } else {
            ++rcvd;
        }
    });
}

setInterval(updateResult,100);
setInterval(sendTrackRequest,10);
setInterval(sendCountRequest,1000);



