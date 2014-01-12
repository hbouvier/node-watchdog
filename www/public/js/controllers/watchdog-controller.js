angular.module('watchdogControllers', ['watchdogServices'])
    .controller('WatchdogCtrl', function($scope, $location, Watchdog, Process) {
        $scope.shutdown = function () {
            Watchdog.get();
        };
    })
;