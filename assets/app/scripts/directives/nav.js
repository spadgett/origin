'use strict';

angular.module('openshiftConsole')
  .directive('sidebar', function(HawtioNav) {
    return {
      restrict: 'E',
      templateUrl: 'views/_sidebar.html',
      link: function($scope, element, attrs) {
        var selectedTab = HawtioNav.selected();
        if (selectedTab) {
          $scope.sidebarHeading = selectedTab.title();
        }
      }
    };
  })
  .directive('sidebarNavItem', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: "views/_sidebar-main-nav-item.html"
    };
  })
  .directive('projectNav', function($timeout, $location, $filter, LabelFilter) {
    return {
      restrict: 'E',
      templateUrl: 'views/_project-nav.html',
      link: function ($scope, element, attrs) {
        var select = $('.selectpicker', element);

        var updateOptions = function() {
          // Locally add the "current" project to the projects list if it doesn't exist
          var projects = $scope.projects || {};
          if ($scope.project && $scope.projectName && !projects[$scope.projectName]) {
            projects = angular.extend({$scope.projectName: $scope.project}, projects);
          }

          var sortedProjects = $filter('orderByDisplayName')(projects);
          // Create options from the sorted array.
          angular.forEach(sortedProjects, function(project) {
            $('<option>')
              .attr("value", project.metadata.name)
              .attr("selected", project.metadata.name == $scope.projectName)
              .text($filter('displayName')(project))
              .appendTo(select);
          });
          // TODO add back in when we support create project
          // <option data-divider="true"></option>
          // <option>Create new</option>
        };

        updateOptions();

        select.selectpicker({
              iconBase: 'fa',
              tickIcon: 'fa-check'
          }).change(function() {
          var newProject = $( this ).val();
          var currentURL = $location.url();
          var currProjRegex = /\/project\/[^\/]+/;
          var currProjPrefix = currProjRegex.exec(currentURL);
          var newURL = currentURL.replace(currProjPrefix, "/project/" + encodeURIComponent(newProject));
          $scope.$apply(function() {
            $location.url(newURL);
          });
        });

        var clearAndUpdateOptions = function() {
          select.empty();
          updateOptions();
          select.selectpicker('refresh');
        };
        $scope.$watch("project", clearAndUpdateOptions);
        $scope.$watch("projects", clearAndUpdateOptions);

        LabelFilter.setupFilterWidget($(".navbar-filter-widget", element), $(".active-filters", element));
        LabelFilter.toggleFilterWidget(!$scope.renderOptions || !$scope.renderOptions.hideFilterWidget);

        $scope.$watch("renderOptions", function(renderOptions) {
          LabelFilter.toggleFilterWidget(!renderOptions || !renderOptions.hideFilterWidget);
        });
      }
    };
  })
  .directive('projectPage', function() {
    return {
      restrict: 'E',
      transclude: true,
      templateUrl: 'views/_project-page.html'
    };
  })
  .directive('back', ['$window', function($window) {
    return {
      restrict: 'A',
      link: function (scope, elem) {
        elem.bind('click', function () {
          $window.history.back();
        });
      }
    };
  }]);
