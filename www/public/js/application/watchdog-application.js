// To have one place where we define both the 'url' use in the javascript pages and the routes (because the
// $routeProvider cannot use the $rootScope, we have to define a global (beuark) variable here.
var ___g_WatchDogRoutePrefix___ = '/';
angular.module('watchdogApplication', ['ngRoute', 'watchdogServices', 'watchdogControllers'])
    .run(function ($rootScope) {
        $rootScope.baseAPIurl = '/api/v1';
        $rootScope.baseUIurl = '/';
        $rootScope.urlBasePath = ___g_WatchDogRoutePrefix___;
    })
    .config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {
        $routeProvider.
            when(___g_WatchDogRoutePrefix___, {controller: 'WatchdogCtrl', templateUrl: 'views/watchdog.html'}).
            otherwise({redirectTo: ___g_WatchDogRoutePrefix___});
    }])
;