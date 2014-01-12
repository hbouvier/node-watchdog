module.exports = function () {
    var fs         = require('fs'),
        spawn      = require('child_process').spawn,
        Q          = require('q'),
        state      = {
            alive   : "alive",
            dead    : "dead",
            forked  : "Elvis (neither dead, nor alive... forked)",
            unknown : "unknown"
        }

    function Watchdog(config, app) {
        var $this = this;
        this.logger    = config.logger;
        this.meta      = config.meta;
        this.filename  = config.config;
        this.app       = app;

        this.processes = {};

        // Install exit hook
        process.on('exit', function (code) {
            $this.logger.log('info', 'EXIT|code=%s|SHUTING-DOWN-NODE-WATCHDOG', code, $this.meta);
            $this.shutdown();
        });

        // Load the configuration file
        this.reload();

        // Reload the config if the file is changed
        fs.watch(this.filename, {
            persistent : true, 
            interval   : 1
        }, function () {
            $this.reload();
        });
    }

    Watchdog.prototype.reload = function (filename) {
        var $this = this;
        
        filename = filename || this.filename;
        this.readJSON(filename).then(function (object) {
            $this.update(object.processes);
        }).fail(function (reason) {
            console.log('reason:', reason);
            $this.logger.log('warn','IGNORED|reload|invalid-config-file=%s|reason=%j', $this.filename, reason, $this.meta);
        }).done();
    };

    Watchdog.prototype.terminate = function (name) {
        var process = this.processes[name];
        if (process && process.runtime && process.runtime.childInfo) {
            this.logger.log('info', 'terminate|name=%s', process.name, this.meta);
            process.enable = false;
            process.runtime.state = state.dead;
            process.runtime.childInfo.kill('SIGHUP'); // SIGHUP:1, SIGQUIT:3, SIGABRT:6, SIGKILL:9, SIGTERM:15
            // TODO: Should set a timer to verify if it died
            return 0;
        }
        return -1;
    };

    Watchdog.prototype.start = function (name) {
        var $this   = this,
            process = this.processes[name];

        // If no process with that name is configured OR if it is already started
        // return an error
        if (!process || (process.runtime && process.runtime.state !== state.dead)) return -1;
        this.logger.log('info', 'start|spawning|name=%s', name, this.meta);
        process.runtime = {
            epoch      : new Date().getTime(),
            logstream  : fs.createWriteStream((process.logDirectory ? process.logDirectory : '.') + '/' + process.name + '.log'),
            childInfo  : spawn(process.command, process['arguments'], process.options),
            state      : state.alive
        };

        process.runtime.childInfo.on('exit', function (code, signal) {
            process.runtime.logstream.end();

            var epoch = new Date().getTime();
            if (process.enable && process.keepalive) {
                // 1) Check if the daemon has forked and becomes unmonitored.
                if (code !== undefined && code === 0 && epoch - process.runtime.epoch < 1000 * 60) {
                    $this.logger.log('info', '%s|exit|Exitied after %d second(s)|code=%s|assuming a successful fork()', 
                        name, (epoch - process.runtime.epoch) / 1000, code, $this.meta);
                    process.runtime.state = state.forked;
                    return;
                }
                // 2) Check if the process constantly crash and respawn too quickly.
                if (epoch - process.runtime.epoch < 1000 * 60 * 5) { // less than 5 minutes
                    // 2.1) Ok, it is not the first time, lets double the time we
                    //      wait before restarting it.
                    if (process.runtime.dealy) {
                        process.runtime.delay *= 2; // avoid process respawning too rapidly
                        $this.logger.log('info', '%s|crashed again in less than five minutes|we will restart it in %d seconds', 
                            name, (process.runtime.delay /1000), $this.meta);
                    } else {
                        // 2.2) it's the first time, we will try in 10 seconds to restart it.
                        process.runtime.delay = 1000 * 10; // 10 seconds
                        $this.logger.log('verbose', '%s|crashed for the first time|we will restart it in %d seconds', 
                            name, (process.runtime.delay /1000), $this.meta);
                    }
                } else {
                    // 3) Ok, it crashed after more than 5 minutes, we will restrart it
                    //    in one second.
                    process.runtime.delay = 1000 * 1; // 1 second
                    $this.logger.log('%s|crashed after more than five minutes|we will restart it in %d second(s)', 
                        process.name, (process.runtime.delay /1000), $this.meta);
                }
                // 5) Throttle it!
                setTimeout(function() {
                    $this.monitor(name);
                }, process.runtime.delay);
                process.runtime.state = state.dead;

            } else {
                process.runtime.state = state.dead;
            }
        });
        process.runtime.childInfo.stdout.on('data', function (data) {
            if (process.runtime && process.runtime.childInfo && process.runtime.logstream) process.runtime.logstream.write('STDOUT: ' + data + '\n');
        });
        process.runtime.childInfo.stderr.on('data', function (data) {
            if (process.runtime && process.runtime.childInfo && process.runtime.logstream) process.runtime.logstream.write('STDERR: ' + data + '\n');
        });
        return 0;
    };


     Watchdog.prototype.shutdown = function () {
        // TODO: should look at the depends field
        var name, process;
        for (name in this.processes) {
            this.terminate(name);
        }
    };

    Watchdog.prototype.status = function (name) {
        var $this = this;

        function getStatus(processName) {
            var process = $this.processes[processName];
            if (process) {
                var result = {
                    status    : 'OK',
                    name      : processName,
                    enable    : process.enable,
                    keepalive : process.keepalive,
                    state     : process.runtime ? process.runtime.state : 'disable'
                };
                if (process.runtime && process.runtime.childInfo) {
                    result.exitCode   = process.runtime.childInfo.exitCode;
                    result.killed     = process.runtime.childInfo.killed;
                    result.pid        = process.runtime.childInfo.pid;
                    result.signalCode = process.runtime.childInfo.signalCode;
                }
                return result;
            }
            return {
                status  : 'FAIL',
                name    : processName,
                state   : state.unknown,
                message : 'Process ' + processName + ' is not configured'
            };
        }

        if (name) {
            return getStatus(name);
        }

        var name, process,
           list = [];
                
        for (name in this.processes) {
            list.push(getStatus(name));
        }
        return list;
    };


    ///////////////////////////////////////////////////////////////////////////

    Watchdog.prototype.readFile = function (filename) {
        return Q.nfcall(fs.readFile, filename);
    };

    Watchdog.prototype.readJSON = function (filename) {
        var deferred = Q.defer();
        this.readFile(filename).then(function (data) {
            try {
                var object = JSON.parse(data);
                deferred.resolve(object);
            } catch (e) {
                deferred.reject(new Error('readJSON|filename=' + filename + '|exception=' + e + '|data=' + data));
            }
        }).fail(function (reason) {
            deferred.reject(new Error('readJSON|filename=' + filename + '|reason=' + reason));
        }).done();
        return deferred.promise;
    };

    Watchdog.prototype.monitor = function (name) {
        var process = this.processes[name];
        if (process) {
            if (process.enable) {
                this.logger.log('info', 'monitor|name=%s', process.name, this.meta);
                this.start(name);
            } else {
                this.terminate(name);
            }
        }
    };

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
     *         "enable":true
     *     }
     * }
     */

    Watchdog.prototype.update = function (processes) {
        if (!processes) {
            this.logger.log('warn', 'IGNORED|update|empty-processes', this.meta);
            return;
        }

        var name, process;
        for (name in processes) {
            process = processes[name];
            process.name = name;

            if (this.processes[process.name]) {
                // Copy the current runtime info into the new updated processes list
                process.runtime = this.processes[process.name].runtime;

                // Nullify the current processes list. The ones that are left un-touched
                // are going to be terminated
                this.processes[process.name].runtime = null;
            }
        }

        // The daemons that are running and that are NOT present in the NEW
        // configuration will be terminated
        for (name in this.processes) {
            process = this.processes[name];
            if (process && process.runtime) {
                this.terminate(name);
            }
        }

        // The NEW configuration is not the ACTIVE configuration
        this.processes = processes;


        for (name in this.processes) {
            this.monitor(name);
        }
    };


    function start(config, app) {
        var watchdog = new Watchdog(config, app);

        return {
            status   : function (name) { return watchdog.status(name); }, // name(opt) --> {state:, status:, message:}
            reload   : function (name) { return watchdog.reload(name); }, // name(opt)
            start    : function (name) { 
                var process = watchdog.processes[name];
                if (process) process.enable = true;
                watchdog.start(name);
            },
            stop     : function (name) { return watchdog.terminate(name); }, // name
            shutdown : function () {
                    watchdog.shutdown();
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
