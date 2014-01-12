module.exports = function () {
    var fs         = require('fs'),
        spawn      = require('child_process').spawn,
        configfile = null,
        config     = {},
        logger     = null,
        meta       = null;

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

    function loadConfig(event, filename, callback) {
        logger.log('info', 'loading|file=%s', configfile, meta);
        fs.readFile(configfile, function (err, data) {
            if (err) {
                logger.log('warn', 'IGNORING|config-file-change|read|file=%s|error=%j', configfile, err, meta);
                return;
            }
            try {
                updateProcessesState(data);
                if (callback)
                    callback(null);
            } catch (exception) {
                logger.log('warn', 'IGNORING|config-file-change|parse|file=%s|exception=%j', configfile, exception, meta);
                if (callback)
                    callback(exception);
            }
        });
    }

    function updateProcessesState(data) {
        var name,
            daemon,
            newConfig;

        try {
            // Parse the new configuration
            newConfig = JSON.parse(data);
        } catch (exception) {
            logger.log('warn', 'IGNORING|update|file=%s|parse-exception=%j|data=%s', configfile, exception, data, meta);
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

    function getDaemon(name_or_daemon) {
        if (typeof(name_or_daemon) === 'object')
            return name_or_daemon;
        return config[name_or_daemon];
    }

    function terminateProcess(name_or_daemon) {
        var daemon = getDaemon(name_or_daemon);
        if (daemon && daemon.runtime && daemon.runtime.childInfo) { // !== undefined && daemon.runtime.childInfo !== null) {
            logger.log('info', 'terminateProcess|name=%s', daemon.name, meta);
            daemon.state = 'stop';
            daemon.runtime.state = 'terminating';
            // SIGHUP:1, SIGQUIT:3, SIGABRT:6, SIGKILL:9, SIGTERM:15
            daemon.runtime.childInfo.kill('SIGHUP');
            // TODO: Should set a timer to verify if it died
            return null;
        }
        return -1;
    }

    function startProcess(name_or_daemon) {
        var daemon = getDaemon(name_or_daemon);
        if (!daemon) return -1;

        if (!daemon.runtime) daemon.runtime = {};
        if (daemon && (daemon.runtime.childInfo === undefined || daemon.runtime.childInfo === null)) {
            logger.log('info', 'Spawning|name=%s', daemon.name, meta);
            daemon.runtime.epoch = new Date().getTime();
            daemon.runtime.logstream  = fs.createWriteStream(daemon.logDirectory + '/' + daemon.name + '.log');
            daemon.runtime.childInfo = spawn(daemon.command, daemon['arguments'], daemon.options);
            daemon.runtime.state = 'running';
            daemon.runtime.childInfo.on('exit', function (code, signal) {
                var epoch = new Date().getTime();
                if (!daemon.runtime) daemon.runtime = {};

                daemon.runtime.exitCode = code === undefined ? 0 : code;
                if (daemon.state === 'enable' && daemon.keepalive) {
                    // 1) Check if the daemon has forked and becomes unmonitored.
                    if (code !== undefined && code === 0 && epoch - daemon.runtime.epoch < 1000 * 60) {
                        logger.log('info', '%s Exitied after %d second(s), with a code of %s, assuming a successful fork()', daemon.name, (epoch - daemon.runtime.epoch) / 1000, code, meta);
                        daemon.runtime.state = 'forked';
                        return null;
                    }
                    // 2) Check if the process constantly crash and respawn too quickly.
                    if (epoch - daemon.runtime.epoch < 1000 * 60 * 5) { // less than 5 minutes
                        // 2.1) it's the first time, we will try in 10 seconds to restart it.
                        if (daemon.runtime.delay === undefined) {
                            daemon.runtime.delay = 1000 * 10; // 10 seconds;
                            logger.log('verbose', '%s crashed for the first time, we will restart it in %d seconds', daemon.name, (daemon.runtime.delay /1000), meta);
                        } else {
                        // 2.2) Ok, it is not the first time, lets double the time we
                        //      wait before restarting it.
                            daemon.runtime.delay *= 2; // avoid process respawning too rapidly
                            logger.log('info', '%s crashed again in less than five minutes, we will restart it in %d seconds', daemon.name, (daemon.runtime.delay /1000), meta);
                        }
                    } else {
                    // 3) Ok, it crashed after more than 5 minutes, we will restrart it
                    //    in one second.
                        daemon.runtime.delay = 1000 * 1; // 1 second
                        logger.log('%s crashed after more than five minutes, we will restart it in %d second(s)', daemon.name, (daemon.runtime.delay /1000), meta);
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
                if (daemon.runtime.childInfo && daemon.runtime.logstream) daemon.runtime.logstream.write('STDOUT: ' + data + '\n');
            });
            daemon.runtime.childInfo.stderr.on('data', function (data) {
                if (daemon.runtime.childInfo && daemon.runtime.logstream) daemon.runtime.logstream.write('STDERR: ' + data + '\n');
            });
        }
        return null;
    }

    function updateProcessState(daemon) {
        if (daemon.state === 'enable') {
            startProcess(daemon);
        } else if (daemon.state === 'disable' || daemon.state === 'disabled' ||
                   daemon.state === 'stop'    || daemon.state === 'stopped') {
            terminateProcess(daemon);
        }
    }
    function shutdown() {
        // TODO: should look at the depends field
        for (var name in config) {
            terminateProcess(name);
        }
    }
    function statusProcess(name_or_daemon) {
        var obj = {};
        var daemon = getDaemon(name_or_daemon);
        if (daemon) {
            obj.state  = daemon.runtime && daemon.runtime.state ? daemon.runtime.state : 'unknown';
            obj.status = 'OK';
            obj.message = 'I have nothign to say to you';
            return obj;
        }
        obj.message = 'Process ' + name_or_daemon + ' is not configured';
        obj.status  = 'FAILED';
        return obj;
    }



    function start(config, app) {
        meta       = config.meta;
        logger     = config.logger;
        configfile = config.config;

        process.on('exit', function (code) {
            logger.log('info', 'EXIT|code=%s|SHUTING-DOWN-NODE-WATCHDOG', code, meta);
            shutdown();
        });

        updateProcessesState(fs.readFileSync(configfile));
        fs.watch(configfile, {persistent: true, interval: 1}, loadConfig);


        return {
            status   : statusProcess, // name --> {state:, status:, message:}
            reload   : loadConfig,    // callback(err)
            start    : function (name) {
                var daemon = getDaemon(name);
                if (daemon) {
                    daemon.state = 'enable';
                }
                startProcess(name)
            },
            stop     : terminateProcess, // name
            shutdown : function () {
                    shutdown();
                    process.nextTick(function () {
                        process.exit(0);
                    });
            }
        };

    }
    return {
        start : start
    };
}();
