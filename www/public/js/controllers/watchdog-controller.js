angular.module('watchdogControllers', ['watchdogServices'])
    .controller('WatchdogCtrl', function($scope, $location, Watchdog, Process) {
        $scope.watchdog  = Watchdog.get();
        $scope.processes = Process.list();


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

    })
;