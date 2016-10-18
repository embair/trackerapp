/*
 * Provides a factory for listeners that handle /track and /count HTTP requests.
 *
 * Usage:
 * var listener = require('http-listener.js').create({
 *      getCount : function(callback) { //retrieve counter value }
 *      incrCount : function(value) { //set counter value }
 *      dumpQueryParams : function(data) { //dump query params as json data }
 * })
 */
'use strict';

const assert = require('assert');
const express = require('express');
const url = require('url');

// --- Public interface ---
module.exports = {
    create : create
};

// --- Implementation ---

/*
 * Factory method creating a single listener which will handle /track and /count requests on
 * the specified port.
 *
 * @param {Object} options configuration parameters
 * @param {Function} options.getCount function(callback) ... should implement retrieval of the
 *     stored counter value; the callback is to be called with the retrieved value as its first
 *     attribute
 * @param {Function} options.incrCount function(number) ... should implement incrementing 
 *     of the stored counter value by the amount specified in the attribute
 * @param {Function} [options.dumpQueryParams] function(obj) ... should implement storing the obj
 *     object into the JSON dump file
 * @param {Number} [options.httpPort] HTTP listening port
 */
function create(options) {

    // parse options    
    options = options || {};
    var logger = options.logger || console;
    var httpPort = options.httpPort;
    var ext = {
        getCount : options.getCount,
        incrCount : options.incrCount,
        dumpQueryParams : options.dumpQueryParams || () => {},
    };
    // validate options
    assert.equal(typeof options.httpPort, 'number');
    for(var func in ext) { 
        assert.equal(typeof ext[func],'function', 'ext.' + func + 'is not a function!');
    }

    // other intialization
    var httpServer = express();
    var running = false;
    var listener = null;

    // handle POST request on /track
    httpServer.post('/track', function(request, response) {
            // dump query params as JSON data to file
            var query = url.parse(request.url, true).query;
            ext.dumpQueryParams(query);
            var count = request.query.count;
            // ignore count unless it's a number bigger than 0
            if (count && !isNaN(Number(count)) && count > 0) {
                ext.incrCount(Math.floor(count));
            }
            // respond immediately, no need to wait for redis callback
            response.status(200).send();
    });
    // handle GET request on /count
    httpServer.get('/count', function(request, response) {
        //get count
        ext.getCount((err, res) => {
            response.header('Content-Type', 'text/plain');
            if (err) {
                response.status(500).send('Oops... Try again later!');
                logger.error('Error retrieving counter from redis:',err);
            } else {
                response.status(200).send(res.toString());
            }
        });   
    });

    // Public interface
    //
    // Note: creating methods in this factory function instead of assigning them to prototype makes
    // creating multiple listener instances a little slower, but makes it easier to pass the method 
    // references around (no need for explicit bind(), since we don't rely on "this")
    return {
        get httpPort() { return httpPort; },
        start : function(callback) {
            callback = callback || ()=>{};
            if (running) return callback('Listener already running');
            running = true;
            listener = httpServer.listen(httpPort, function() {
                console.log('HTTP server listening on port', httpPort);
                callback();
            });        
        },
        stop : function(callback) {
            running = false;
            listener.close();
            callback();
        }
    };
}







