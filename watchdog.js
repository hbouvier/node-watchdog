#!/usr/bin/env node
var util     = require('util'),
    fs       = require('fs'),
    http     = require('http'),
    url      = require('url'),
    JSONUtil = require('JSONUtil').JSONUtil(),
    spawn    = require('child_process').spawn,
    port       = process.env.PORT || 8088,
    version    = '0.0.1',
    server     = null,
    appName    = getAppName(process.argv[1]),
    configfile = '../config/'+appName+'.json',
    config     = {},
    logstream  = fs.createWriteStream(appName + '.log');


///////////////////////////////////////////////////////////////////////////////
process.on('exit', function (code) {
    log('EVENT:exit [code:' + code  + '] --- SHUTING DOWN NODE-WATCHDOG');
    shutdown();
});

/*
process.on('uncaughtException', function (err) {
    log('EVENT:uncaughtException [' + err + '] --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
*/
process.on('SIGHUP', function () {
    log('EVENT:SIGHUP --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGINT', function () {
    log('EVENT:SIGINT (CTRL-C) --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGQUIT', function () {
    log('EVENT:SIGQUIT --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGILL', function () {
    log('EVENT:SIGILL --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGTRAP', function () {
    log('EVENT:SIGTRAP --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGABRT', function () {
    log('EVENT:SIGABRT --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGEMT', function () {
    log('EVENT:SIGEMT --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGFPE', function () {
    log('EVENT:SIGFPE --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGKILL', function () {
    log('EVENT:SIGKILL --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGBUS', function () {
    log('EVENT:SIGBUS --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGSEGV', function () {
    log('EVENT:SIGSEGV --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGSYS', function () {
    log('EVENT:SIGSYS --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGPIPE', function () {
    log('EVENT:SIGPIPE --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGALRM', function () {
    log('EVENT:SIGALRM --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGTERM', function () {
    log('EVENT:SIGTERM --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGURG', function () {
    log('EVENT:SIGURG --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
/*
process.on('SIGSTOP', function () {
    log('EVENT:SIGSTOP --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGTSTP', function () {
    log('EVENT:SIGTSTP --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGCONT', function () {
    log('EVENT:SIGCONT --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});

process.on('SIGCHLD', function () {
    log('EVENT:SIGCHLD --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
*/
process.on('SIGTTIN', function () {
    log('EVENT:SIGTTIN --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGTTOU', function () {
    log('EVENT:SIGTTOU --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGIO', function () {
    log('EVENT:SIGIO --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGXCPU', function () {
    log('EVENT:SIGXCPU --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGXFSZ', function () {
    log('EVENT:SIGXFSZ --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGVTALRM', function () {
    log('EVENT:SIGVTALRM --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGPROF', function () {
    log('EVENT:SIGPROF --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGWINCH', function () {
    log('EVENT:SIGWINCH --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGINFO', function () {
    log('EVENT:SIGINFO --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGUSR1', function () {
    log('EVENT:SIGUSR1 --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});
process.on('SIGUSR2', function () {
    log('EVENT:SIGUSR2 --- SHUTING DOWN NODE-WATCHDOG');
    process.exit(-1);
});

///////////////////////////////////////////////////////////////////////////////

if (process.argv.length === 4 && process.argv[2] == '--config')
    configfile = process.argv[3];
    
function getAppName(name) {
    var regex  = /.*\/(.*)\.js$/;
    var capture = name.match(regex);
    return capture[1];
}

function log(msg) {
    var message = appName + ': ' + msg;
    util.log(message);
    logstream.write(message + '\n');
}

///////////////////////////////////////////////////////////////////////////////

/**
 * {
 *     "freeswitch":{
 *         "description":"A service that restart freeswitch if it dies",
 *         "options":{ "cwd": "/usr/local/freeswitch",
 *                     "env": { 
 *                              "DEBUG":true
 *                            },
 *                     "customFds": [-1, -1, -1]
 *                   },
 *         "command":"/usr/local/freeswitch/bin/freeswitch",
 *         "arguments":["-waste","-hp"],
 *         "logDirectory":"/var/log",
 *         "keepalive":true,
 *         "depends":["firewall"],
 *         "state":"enable"
 *     }
 * }
 */

function loadConfig(/*curr, prev*/) {
    log('loading configuration file [' + configfile + ']');
    fs.readFile(configfile, function (err, data) {
        if (err) {
            log('ERROR reloading ' + configfile + ' >>>>> ' + JSONUtil.stringify(err) + ' <<<<< IGNORING UPDATE');
            return;
        }
        try {
            updateProcessesState(data);
        } catch (exception) {
            log('ERROR parsing ' + configfile + ' >>>>> ' + JSONUtil.stringify(exception) + ' <<<<< IGNORING UPDATE');
        }
    });
}

log('Reading ' + configfile);
updateProcessesState(fs.readFileSync(configfile));
 
function updateProcessesState(data) {
    var name,
        daemon,
        newConfig;
        
    try {
        // Parse the new configuration
        newConfig = JSON.parse(data);
    } catch (exception) {
        log('ERROR parsing ' + configfile + ' >>>>> ' + exception + ' <<<<< IGNORING UPDATE\n---------------------------\n' + data);
        return;
    }
    
    // Move the runtime info into the NEW configuration
    for (name in newConfig) {
        daemon = getDaemon(name);
        if (daemon) {
            newConfig[name].runtime = daemon.runtime;
            config[name].runtime = null;
        }
    }
    
    // The daemons that are running and that are NOT present in the NEW
    // configuration will be terminated
    for (name in config) {
        daemon = getDaemon(name);
        if (daemon && daemon.runtime) {
            terminateProcess(daemon);
        }
    }
    
    // The NEW configuration is not the ACTIVE configuration
    config = newConfig;
    newConfig = null;
    for (name in config) {
        daemon = getDaemon(name);
        daemon.name = name;  // copy the name into the object
        updateProcessState(daemon);
    }
}

log('Watching ' + configfile);
fs.watch(configfile, {persistent: true, interval: 1}, loadConfig);

log('Creating HTTP Server on port ' + port);
server = http.createServer(function(req, res){
    var obj = {'application':appName, 'version' : version};
    var path  = url.parse(req.url).pathname;
    var query = url.parse(req.url, true).query;
    var clientIPAddress = req.headers['x-forwarded-for'] === undefined ? 
                                    req.connection.remoteAddress : 
                                    (req.headers['x-forwarded-for'] + '/' +req.connection.remoteAddress);

    if (path.indexOf('/shutdown') === 0 && clientIPAddress == '127.0.0.1') {
        log('HTTP SHUTING DOWN NODE-WATCHDOG');
        shutdown();
        res.writeHead(200, {"Content-Type": "application/json"});
        obj.status = 'OK';
        obj.message = 'Shutting down';
        res.write(JSON.stringify(obj));
        res.end();
        process.nextTick(function () {
            process.exit(0);
        });
        
    } else if (path.indexOf('/version') === 0) {
        res.writeHead(200, {"Content-Type": "application/json"});
        obj.status = 'OK';
        obj.message = 'Version ' + version;
        res.write(JSON.stringify(obj));
        res.end();
    } else if (path.indexOf('/status') === 0) {
        log('HTTP STATUS ' + query.name);
        if (query.name) {
            res.writeHead(200, {"Content-Type": "application/json"});
            res.write(JSON.stringify(statusProcess(query.name)));
        } else {
            res.writeHead(404, {"Content-Type": "application/json"});
            obj.status = 'FAILED';
            obj.message = 'Invalid request ' + req.url;
            res.write(JSON.stringify(obj));
        }
        res.end();
    } else if (path.indexOf('/start') === 0) {
        log('HTTP START ' + query.name);
        if (query.name) {
            res.writeHead(200, {"Content-Type": "application/json"});
            var daemon = getDaemon(query.name);
            if (daemon) {
                daemon.state = 'enable';
            }
            res.write(JSON.stringify(startProcess(query.name)));
        } else {
            res.writeHead(404, {"Content-Type": "application/json"});
            obj.status = 'FAILED';
            obj.message = 'Invalid request ' + req.url;
            res.write(JSON.stringify(obj));
        }
        res.end();
    } else if (path.indexOf('/stop') === 0) {
        log('HTTP STOP ' + query.name);
        if (query.name) {
            res.writeHead(200, {"Content-Type": "application/json"});
            res.write(JSON.stringify(terminateProcess(query.name)));
        } else {
            res.writeHead(404, {"Content-Type": "application/json"});
            obj.status = 'FAILED';
            obj.message = 'Invalid request ' + req.url;
            res.write(JSON.stringify(obj));
        }
        res.end();
    } else if (path.indexOf('/favicon.ico') === 0) {
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end();
    } else {
        log('Invalid request ' + req.url);
        res.writeHead(404, {"Content-Type": "application/json"});
        obj.status = 'FAILED';
        obj.message = 'Invalid request ' + req.url;
        res.write(JSON.stringify(obj));
        res.end();
    }
}).listen(port);

function getDaemon(name_or_daemon) {
    if (typeof(name_or_daemon) === 'object')
        return name_or_daemon;
    return config[name_or_daemon];
}
function statusProcess(name_or_daemon) {
    var obj = {'application':appName, 'version' : version};
    var daemon = getDaemon(name_or_daemon);
    if (daemon) {    
        obj.state  = daemon.runtime.state;
        obj.status = 'OK';
        obj.message = 'I have nothign to say to you';
        return obj;
    }
    obj.message = 'Process ' + name_or_daemon + ' is not configured';
    obj.status  = 'FAILED';
    return obj;
}

function terminateProcess(name_or_daemon) {
    var obj = {'application':appName, 'version' : version};
    var daemon = getDaemon(name_or_daemon);
    if (daemon && daemon.runtime && daemon.runtime.childInfo) { // !== undefined && daemon.runtime.childInfo !== null) {
        log('terminateProcess ' + daemon.name);
        daemon.state = 'stop';
        daemon.runtime.state = 'terminating';
        // SIGHUP:1, SIGQUIT:3, SIGABRT:6, SIGKILL:9, SIGTERM:15
        daemon.runtime.childInfo.kill('SIGHUP');
        obj.status = 'OK';
        obj.message = 'Sent SIGUP to ' + daemon.name;
        // TODO: Should set a timer to verify if it died
    } else {
        obj.status = 'FAILED';
    }
    return obj;
}

function startProcess(name_or_daemon) {
    var obj = {'application':appName, 'version' : version};
    var daemon = getDaemon(name_or_daemon);
    if (!daemon) return;
    
    if (!daemon.runtime) daemon.runtime = {};
    if (daemon && (daemon.runtime.childInfo === undefined || daemon.runtime.childInfo === null)) {
        log('Spawning "' + daemon.name + '"');
        obj.status = 'OK';
        if (daemon.runtime === undefined)
            daemon.runtime = {};
        daemon.runtime.epoch = new Date().getTime();
        daemon.runtime.logstream  = fs.createWriteStream(daemon.logDirectory + '/' + daemon.name + '.log');
        daemon.runtime.childInfo = spawn(daemon.command, daemon['arguments'], daemon.options);
        daemon.runtime.state = 'running';
        daemon.runtime.childInfo.on('exit', function (code, signal) {
            var epoch = new Date().getTime();
            
            daemon.runtime.exitCode = code === undefined ? 0 : code;
            if (daemon.state == 'enable' && daemon.keepalive) {
                // 1) Check if the daemon has forked and becomes unmonitored.
                if (code !== undefined && code === 0 && epoch - daemon.runtime.epoch < 1000 * 60) {
                    log(daemon.name + 'Exitied after ' + (epoch - daemon.runtime.epoch) / 1000 + ' second(s), with a code of ' + code + ', assuming a successful fork()');
                    daemon.runtime.state = 'forked';
                    return;
                }
                // 2) Check if the process constantly crash and respawn too quickly.
                if (epoch - daemon.runtime.epoch < 1000 * 60 * 5) { // less than 5 minutes
                    // 2.1) it's the first time, we will try in 10 seconds to restart it.
                    if (daemon.runtime.delay === undefined) {
                        daemon.runtime.delay = 1000 * 10; // 10 seconds;
                        log(daemon.name + ' crashed for the first time, we will restart it in ' + (daemon.runtime.delay /1000) + ' seconds');
                    } else {
                    // 2.2) Ok, it is not the first time, lets double the time we
                    //      wait before restarting it.
                        daemon.runtime.delay *= 2; // avoid process respawning too rapidly
                        log(daemon.name + ' crashed again in less than five minutes, we will restart it in ' + (daemon.runtime.delay /1000) + ' seconds');
                    }
                } else {
                // 3) Ok, it crashed after more than 5 minutes, we will restrart it
                //    in one second.
                    daemon.runtime.delay = 1000 * 1; // 1 second
                    log(daemon.name + ' crashed after more than five minutes, we will restart it in ' + (daemon.runtime.delay /1000) + ' second(s)');
                }
                
                // 4) Let's reset the time stamp at which it was started
                daemon.runtime.epoch = epoch;
                
                // 5) Throttle it!
                setTimeout(function() {
                    updateProcessState(daemon);
                }, daemon.runtime.delay);
            }
            daemon.runtime.state = signal === undefined ? 'crash' : 'signal';
            daemon.runtime.logstream = null;
            daemon.runtime.childInfo = null;
       });
        daemon.runtime.childInfo.stdout.on('data', function (data) {
            if (daemon.runtime.childInfo && daemon.runtime.childInfo.logstream) daemon.runtime.logstream.write('STDOUT: ' + data + '\n');
        });
        daemon.runtime.childInfo.stderr.on('data', function (data) {
            if (daemon.runtime.childInfo && daemon.runtime.childInfo.logstream) daemon.runtime.logstream.write('STDERR: ' + data + '\n');
        });
    }
    return obj;
}

function updateProcessState(daemon) {
    if (daemon.state == 'enable') {
        startProcess(daemon);
    } else if (daemon.state == 'disable' || daemon.state == 'disabled' || 
               daemon.state == 'stop'    || daemon.state == 'stopped') {
        terminateProcess(daemon);
    }
}
function shutdown() {
    // TODO: should look at the depends field
    for (var name in config) {
        terminateProcess(name);
    }
}
