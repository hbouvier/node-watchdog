angular.module('watchdogControllers', ['watchdogServices'])
    .controller('WatchdogCtrl', function($scope, $location, $routeParams, Watchdog, Process) {
        $scope.watchdog  = Watchdog.get();
        $scope.processes = Process.list();
        $scope.process = {
            description  : "",
            options : {
                cwd : "/tmp/",
                env :  "",
                customFds : [ -1, -1, -1]
            },
            command      : "",
            arguments    : "",
            logDirectory : "/tmp/",
            depends      : "",
            keepalive    : true,
            enable       : true
        };
        var process;

        if ($routeParams.name) {
            console.log('id:', $routeParams.name);
            
            Process.get({name:$routeParams.name}).$promise.then(function (data) {
                process = data;
            console.log('process:', process);
            $scope.process.options.env = JSON.stringify(process.options.env);
            $scope.process.depends = JSON.stringify(process.depends);
            $scope.process.arguments = JSON.stringify(process.arguments);

            });
        }

        $scope.shutdown = function () {
            Watchdog.delete();
        };

        $scope.reload = function () {
            Watchdog.put();
        };


        $scope.restart = function (name) {
            Process.put({name:name}, null);
        };
        $scope.kill = function (name) {
            //name = typeof(name) === 'string' ? name : (''+name);
            Process.delete({name:name}).$promise.then(function (result) {
                //console.log('KILLED:', name);
            }).catch(function (reason) {
                alert('FAIL to KILL:' +  name +  ", because of " + reason);
            });
        };

        $scope.remove = function (name) {
            Process.delete({name:name, remove:true});
        };

    })
;