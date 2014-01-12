module.exports = function () {

    ////////////////////////////////////////////////////////////////////////////
/*
            start    : function (name) {
                var daemon = getDaemon(name);
                if (daemon) {
                    daemon.state = 'enable';
                }
                startProcess(name)
            },
            stop     : terminateProcess, // name
*/
    function routes(app, config) {
        app.get('/api/v1/version', function (req, res) {
            res.json({version:config.version});
            res.end();
        });
        app.get('/api/v1/status/:name', function (req, res) {
            var result = config.watchdog.status(req.param.name);
            res.json(result);
            res.end();
        });

        app.get('/api/v1/start/:name', function (req, res) {
            var result = config.watchdog.start(req.param.name);
            res.json(result);
            res.end();
        });
        app.get('/api/v1/stop/:name', function (req, res) {
            var result = config.watchdog.stop(req.param.name);
            res.json(result);
            res.end();
        });

        app.get('/api/v1/reload', function (req, res) {
            config.watchdog.reload(function (err) {
                if (err) {
                    res.json({status:'FAIL'});
                } else {
                    res.json({status:'OK'});
                }
                res.end();
            });
        });



        app.get('/api/v1/shutdown', function (req, res) {
            config.watchdog.shutdown();
            res.json({status:'OK'});
            res.end();
        });

    }

    return routes;
}();