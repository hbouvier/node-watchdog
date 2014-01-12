module.exports = function () {
    var connect = require('connect');

    ////////////////////////////////////////////////////////////////////////////

    function bodyparser(app, config) {
        app.use(connect.urlencoded());
        app.use(connect.json());
    }

    return bodyparser;
}();