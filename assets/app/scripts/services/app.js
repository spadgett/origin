'use strict';

angular.module('openshiftConsole')
  .factory('ApplicationService', function($filter) {
    var label = $filter('label');

    var getApp = function(resource) {
      // TODO: Make the app label configurable
      return label(resource, 'app');
    };

    var groupByApp = function(resources) {
      return _.groupBy(resources, function(resource) {
        return getApp(resource) || '';
      });
    };

    return {
      getApp: getApp,
      groupByApp: groupByApp
    };
  });

