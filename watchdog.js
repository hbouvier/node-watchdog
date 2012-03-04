var util     = require('util'),
    fs       = require('fs'),
    http     = require('http'),
    url      = require('url'),
    JSONUtil = require('./modules/JSONUtil.js').JSONUtil(),
    spawn    = require('child_process').spawn,
    port       = process.env.PORT || 8088,
    version    = '0.0.1',
    server     = null,
    appName    = getAppName(process.argv[1]),
    configfile = '../config/'+appName+'.json',
    newConfig  = {},
    config     = {},
    logstream  = fs.createWriteStream(appName + '.log');
log(JSON.stringify(process.argv));log('\n'+JSONUtil.stringify(process.argv));

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
    logstream.write(message);
}

/**
 * [ {
 *     "name":"freeswitch",
 *     "description":"A service that restart freeswitch if it dies",
 *     "options":{ "cwd": "/usr/local/freeswitch",
 *                 "env": { 
 *                          "DEBUG":true
 *                        },
 *                 "customFds": [-1, -1, -1]
 *               },
 *     "command":"/usr/local/freeswitch/bin/freeswitch",
 *     "arguments":["-waste","-hp"],
 *     "logDirectory":"/var/log",
 *     "keepalive":true,
 *     "state":"enable"
 *   }
 * ]
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
    var i;
    try {
        newConfig = JSON.parse(data);
        log('updateProcessesState(' + JSON.stringify(newConfig) + ')');
        log('updateProcessesState(' + JSONUtil.stringify(newConfig) + ')');
        process.exit(1);
    } catch (exception) {
        log('ERROR parsing ' + configfile + ' >>>>> ' + exception + ' <<<<< IGNORING UPDATE\n---------------------------\n' + data);
        return;
    }
    try {
        for (i = 0 ; i < newConfig.length ; ++i ) {
            log ('updating ' + JSONUtil.stringify(newConfig[i]));
            var daemon = getDaemon(newConfig[i].name);
            if (daemon) {
                newConfig[i].runtime = daemon.runtime;
            }
            updateProcessState(newConfig[i]);
        }
    } catch (e) {
        log('ERROR updating process ' + e + ' <<<<< IGNORING UPDATE');
        newConfig = null;
        return;
    }
    config = newConfig;
    newConfig = null;
}

log('Watching ' + configfile);
fs.watch(configfile, {persistent: true, interval: 1}, loadConfig);

log('Creating HTTP Server on port ' + port);
server = http.createServer(function(req, res){
    var obj = {'application':appName, 'version' : version};
    var path  = url.parse(req.url).pathname;
    var query = url.parse(req.url, true).query;
    var clientIPAddress = req.headers['x-forwarded-for'] === undefined ? req.connection.remoteAddress : (req.headers['x-forwarded-for'] + '/' +req.connection.remoteAddress);

    if (path.indexOf('/shutdown') === 0 && clientIPAddress == '127.0.0.1') {
        log('SHUTING DOWN NODE-WATCHDOG');
        for (var i = config.length ; i >= 0 ; --i) {
            terminateProcess(config[i]);
        }
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
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify(statusProcess(query.name)));
        res.end();
    } else if (path.indexOf('/start') === 0) {
        res.writeHead(200, {"Content-Type": "application/json"});
        var daemon = getDaemon(query.name);
        if (daemon) {
            daemon.state = 'enable';
        }
        res.write(JSON.stringify(startProcess(query.name)));
        res.end();
    } else if (path.indexOf('/stop') === 0) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify(terminateProcess(query.name)));
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
    for (var i = 0 ; i < config.length ; ++i) {
        if (config[i].name == name_or_daemon) {
            return config[i];
        }
    }
    return null;
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
    if (daemon && daemon.childInfo !== undefined && daemon.childInfo !== null) {
        log('terminateProcess ' + daemon.name);
        daemon.state = 'stopped';
        daemon.runtime.state = 'terminating';
        // SIGHUP:1, SIGQUIT:3, SIGABRT:6, SIGKILL:9, SIGTERM:15
        daemon.childInfo.kill('SIGHUP');
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
    
    if (daemon && (daemon.childInfo === undefined || daemon.childInfo === null)) {
        log('startProcess ' + daemon.name);
        obj.status = 'OK';
        if (daemon.runtime === undefined)
            daemon.runtime = {};
        daemon.runtime.epoch = new Date().getTime();
        daemon.runtime.logstream  = fs.createWriteStream(daemon.logDirectory + '/' + daemon.name + '.log');
        daemon.childInfo = spawn(daemon.command, daemon['arguments'], daemon.options);
        daemon.runtime.state = 'running';
        daemon.childInfo.on('exit', function (code, signal) {
            var epoch = new Date().getTime();
            if (epoch - daemon.runtime.epoch < 1000 * 60 * 5) { // less than 5 minutes
                if (daemon.runtime.delay === undefined)
                    daemon.runtime.delay = 1000 * 10; // 10 seconds;
                else
                    daemon.runtime.delay *= 2; // avoid process respawning too rapidly
            } else {
                daemon.runtime.delay = 1000 * 1; // 1 second
            }
            daemon.runtime.epoch = epoch;
            daemon.runtime.exitCode = code === undefined ? 0 : code;
            daemon.runtime.state = 'exitted with code ' + daemon.runtime.exitCode;
            log(daemon.name + ' ' + daemon.runtime.state + (signal === undefined ? '' : ' with signal ' + signal));
            daemon.runtime.logstream.write('EXIT: ' + daemon.runtime.exitCode + '\n');
            daemon.runtime.logstream = null;
            daemon.childInfo = null;
            if (daemon.keepalive && daemon.state == 'enable') {
                // TODO: Should trottle
                
                setTimeout(function() {
                    updateProcessState(daemon);
                }, daemon.runtime.delay);
            }
       });
        daemon.childInfo.stdout.on('data', function (data) {
            if (daemon.childInfo && daemon.childInfo.logstream) daemon.runtime.logstream.write('STDOUT: ' + data);
        });
        daemon.childInfo.stderr.on('data', function (data) {
            if (daemon.childInfo && daemon.childInfo.logstream) daemon.runtime.logstream.write('STDERR: ' + data);
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

