/**
 * Application entry point. Opens a Redis DB connection, opens a dump file and
 * a starts listening on localhost:8000 for incoming HTTP requests.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const redis = require('redis');

const async = require('async');
const httpListener = require('./http-listener.js');

// Command line options
const opt = require('node-getopt').create([
    ['l','listen-on=ARG' ,'HTTP server port (default 6379)'],
    ['r','redis-port=ARG','Redis server port (default 8000)'],
    ['d','dump-file=ARG' ,'File into which /track request parameters will be dumped (default trackdata.txt)'],
    ['h','help'          ,'display this help']
])
.bindHelp()
.parseSystem();

// --- Overridable constants ---

// Port on which local redis server is expected to listen
var REDIS_PORT=Number(opt.options['redis-port']) || 6379;
// HTTP server port 
var HTTP_PORT=Number(opt.options.port) || 8000;
// JSON data from /track requests will be dumped to this file
var DUMP_FILE='trackdata.txt';
// Max number of miliseconds to wait for graceful shutdown before commiting seppuku
var GRACEFUL_SHUTDOWN_TIMEOUT = 2000;

// process exit codes
const EXIT = {
    SUCCESS : 0,
    ERROR : 1
};

// database fields
const DB = {
    COUNT : 'count'
};

// --- Application startup sequence ---


// validate command line parameters
[HTTP_PORT,REDIS_PORT].forEach((value) => {
    assert(value > 0 && value <= 65535, value + ' is not a valid port number');    
});

var dumpStream; //stream for dumping query params
var dbClient; //database client

// Prepare the write stream for dumping JSON data to file
function initDumpStream(callback) {
    dumpStream = fs.createWriteStream(DUMP_FILE, { flags: 'a' });
    dumpStream.on('open', ()=>{callback();});
}

// Prepare the DB connection for storing count
function initDbClient(callback) {
    dbClient = redis.createClient(REDIS_PORT);
    dbClient.on('connect', () => {
        console.log('Connected to Redis DB on port '+REDIS_PORT);
        if (callback) {
            callback();
            // prevent redundant callback call on further reconnects;
            callback = null;
        }
    });
    dbClient.on('error', function(error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('Redis Server on port '+REDIS_PORT+
                        ' not answering, will retry in a few seconds...');
        } else {
            console.log('Redis error: '+ error.code);
        }
    });
}

// Reset count in DB to 0
function resetCount(callback) {
    dbClient.set(DB.COUNT,0,callback);
}

// prepare a single HTTP listener to act as our HTTP server
var listenerInstance = httpListener.create({ 
    httpPort: HTTP_PORT,
    getCount: function(callback) {
        assert.equal(typeof callback,'function');
        dbClient.get(DB.COUNT, callback);
    },
    incrCount: function(value) {
        assert.equal(typeof value, 'number');
        dbClient.incrby(DB.COUNT, value);
    },
    dumpQueryParams: function(data) {
        assert.equal(typeof data, 'object');
        dumpStream.write(JSON.stringify(data)+'\n');
    }
});

// Run the initialization sequence
async.series([
    initDumpStream,
    initDbClient,
    resetCount,
    listenerInstance.start
], function(err) {
    if (err) {
        console.error('Error launching application:', err);
        process.exit(EXIT.ERROR);
    }
});

// --- Application shutdown sequence ---

// Shutdown method - closes db connection and writestream
function gracefulShutdown() {
    console.log('Application shutting down...');
    setTimeout(function() {
        'Graceful shudtown failed, exiting now.'; 
        process.exit(EXIT.ERROR); 
    },GRACEFUL_SHUTDOWN_TIMEOUT);

    function closeDbConnection(callback) {
        if (dbClient && dbClient.connected) {
            dbClient.quit(callback);
        } else {
            callback();
        }
    }

    function closeDumpStream(callback) {
        if (dumpStream) {
            dumpStream.close(callback);
        } else {
            callback();
        }
    }

    async.series([
        closeDbConnection,
        closeDumpStream
    ], (err) => {
        if (err) {
            console.warn('Error in cleanup:',err);
            process.exit(EXIT.ERROR);
        }
        process.exit(EXIT.SUCCESS);
    });
}
// Handle signals
['SIGINT','SIGHUP','SIGTERM'].forEach((signal) => { process.on(signal, gracefulShutdown); });
