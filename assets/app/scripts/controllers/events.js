'use strict';

/**
 * @ngdoc function
 * @name openshiftConsole.controller:EventsController
 * @description
 * # EventsController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('EventsController', function ($scope, DataService, Logger) {
    $scope.events = {};
    var watches = [];

    watches.push(DataService.watch("events", $scope, function(events) {
      $scope.events = events.by("lastTimestamp");
      $scope.emptyMessage = "No events to show";
      Logger.log("events (subscribe)", $scope.events);
    }));

    $scope.$on('$destroy', function(){
      DataService.unwatchAll(watches);
    });
  });

