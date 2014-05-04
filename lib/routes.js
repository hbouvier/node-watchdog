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

        // GET version
        app.get('/api/v1/watchdog', function (req, res) {
            res.json({version:config.version});
            res.end();
        });

        // PUT reload config
        app.put('/api/v1/watchdog', function (req, res) {
            config.watchdog.reload();
            res.json({status:'OK'});
            res.end();
        });

        // DELETE shutdown
        app.delete('/api/v1/watchdog', function (req, res) {
            config.watchdog.shutdown();
            res.json({status:'OK'});
            res.end();
        });

        // GET status
        app.get('/api/v1/process/:name?', function (req, res) {
            var result = config.watchdog.status(req.params.name);
            res.json(result);
            res.end();
        });

        // PUT start
        app.put('/api/v1/process/:name', function (req, res) {
            var result = config.watchdog.start(req.params.name);
            res.json(result);
            res.end();
        });

        // DELETE stop / remove
        app.delete('/api/v1/process/:name', function (req, res) {
            var result;
            if (req.query.remove) {
                result = config.watchdog.remove(req.params.name, req.query.remove);
            } else {
                result = config.watchdog.stop(req.params.name);
            }
            res.json(result);
            res.end();
        });

    }

    return routes;
}();