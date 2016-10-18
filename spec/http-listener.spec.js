'use strict';

var async = require('async');
var assert = require('assert');
var request = require('request');
var httpListener = require('../http-listener.js');

var HTTP_PORT = 8000;
var SERVICE_URL = 'http://localhost:'+HTTP_PORT;

describe('HTTP Listener', function() {

    // mock environment
    var ext = {
        count : 0,              // substitute for 'count' database field
        dumpData : [],          // substitute for dump file
        reset : function() {
            this.count = 0;
            this.dumpData = [];
        }
    };

    // mock listener using ext object in place of database and dumpfile
    var listener = httpListener.create({ 
        httpPort: HTTP_PORT,
        getCount: function(callback) {
            callback(null,ext.count);
        },
        incrCount: function(value) {
            ext.count += value;
        },
        dumpQueryParams: function(data) {
            ext.dumpData.push(data);
        }
    });

    // start a single listener process
    beforeAll((done) => { listener.start(done); });
    // reset environment before each spec
    beforeEach(function() { ext.reset(); });

    // stop the listener after all tests are done
    afterAll((done) => { listener.stop(done); });

    /**
     * Returns an utility function that can be used as a callback for request.get()/post() calls.
     * The function will test attributes of the HTTP response.
     * @param done final callback to be called after the response was processed 
     * @param expectedStatus (optional) expected HTTP status code
     * @param expectedBody (optional) expected content of the response body
     */ 
    function expectResponse(done, expectedStatus, expectedBody) {
        return function(err, resp, body) {
            expect(err).toBeFalsy();
            expect(body).toBeDefined();
            if (expectedStatus !== undefined) expect(resp && resp.statusCode).toBe(expectedStatus);
            if (expectedBody !== undefined ) expect(body).toEqual(expectedBody);
            done();
        };
    }

    it('shouldn\'t accept POST requests on /count', function(done) {
        request.post(SERVICE_URL+'/count', expectResponse(done, 404));
    });

    it('shouldn\'t accept GET requests on /random/path', function(done) {
        request.post(SERVICE_URL+'/random/path', expectResponse(done, 404));
    });

    it('shouldn\'t accept GET requests on root path', function(done) {
        request.post(SERVICE_URL, expectResponse(done, 404));
    });

    /**
     * Generates a function that sends POST request on /track, expecting to receive a 200 OK status
     * code
     * @param {Object} queryParams map of query parameters
     */
    function track(queryParams) {
        var params = [];
        for (var key in queryParams) {
            params.push(key+'='+queryParams[key]);
        }
        return function(done) {
            request.post(SERVICE_URL+'/track?'+params.join('&'), {}, expectResponse(done, 200));
        };
    }

    /**
     * Generates a function that sends a GET request on /count, expecting to receive a specific
     * number as an answer
     * @param {Number} number the expected response
     */
    function expectCount(number) {
        return function(done) {
            request.get(SERVICE_URL+'/count', expectResponse(done,200,number.toString()));
        };
    }

    /**
     * Generates a function that will send a /track request, followed by a /count request to verify
     * the new count value.
     * @param {Object} formData hash table of form data for the /track request
     * @param {Number} number expected count after resolving the /track request
     */
    function testTrackResult(formData, number) {
        assert(formData && formData instanceof Object);
        assert(number !== undefined && typeof number === 'number');
        return function(done) {
            async.series([
                track(formData),
                expectCount(number),
            ],
            function(err) {
                if (err) {
                    done.fail(err);  
                } else {
                    done();
                }
            });            
        };
    }

    it('processes /track request', testTrackResult({count:15, foo:'bar'}, 15));

    it('ignores non-numeric counts', testTrackResult({count:'12dropTableStudents'}, 0));

    it('rounds down float counts', testTrackResult({count:1.9}, 1));

    it('ignores negative counts', testTrackResult({count:-1}, 0));

    it('appends query params into dumpFile', function(done) {
        var firstObj = {count: '1', name :'first', foo: 'bar'};
        var secondObj = { name :'second' };
        async.series([
            track(firstObj),
            track(secondObj),
            (callback) => {
                expect(ext.dumpData).toEqual([firstObj,secondObj]);
                callback();
            }
        ],done);
    });


    // generate random Integer from an interval
    function randomInt (low, high) {
        return Math.floor(Math.random() * (high - low) + low);
    }

    /**
     * Generates a bunch of functions that will each send a /track request when called
     * @param num Number of functions to generate
     * @param list The functions will be appended to this array
     * @returns total count increment that should be caused by running all the generated 
     * functions
     */
    function generateTrackRequests(num, list) {
        var total = 0;
        for (var i = 0; i < num; ++i) {
            var count = randomInt(0,1000);
            total += count;
            list.push(track({count:count}));
        }
        return total;
    }

    it ('handles concurrency', function(done) {
        var requests = [];
        var numRequests = 20;
        var totalCount = generateTrackRequests(numRequests, requests);
        async.parallel(
            requests,
        function(err) {
            expect(err).toBeNull();
            expect(ext.count).toEqual(totalCount);
            expect(ext.dumpData.length).toEqual(numRequests);
            done();
        });
    });

}); 

