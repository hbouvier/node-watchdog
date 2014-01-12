angular.module('watchdogServices', ['ngResource'])
    .filter('objectFilter', function ($rootScope) {
        return function (input, query) {
            if (!query) return input;
            var result = [];

            angular.forEach(input, function (object) {
                var copy = {};
                var regex = new RegExp(query, 'im');
                for (var i in object) {
                    // angular adds '$$hashKey' to the object.
                    if (object.hasOwnProperty(i) && i !== '$$hashKey')
                        copy[i] = object[i];
                }
                if (JSON.stringify(copy).match(regex)) {
                    result.unshift(object);
                }
            });
            return result;
        };
    })
    .factory('Process', function ($rootScope, $resource) {
        return $resource($rootScope.baseAPIurl + '/process/:name?', null, {
            "list"    : { method : "GET", isArray : true  },
            "get"     : { method : "GET", isArray : false },
            "put"     : { method : "PUT" },
            "delete"  : { method : "DELETE" }
        });
    })
    .factory('Watchdog', function ($rootScope, $resource) {
        return $resource($rootScope.baseAPIurl + '/watchdog', null, {
            "put"     : { method : "PUT" }
        });
    })
;