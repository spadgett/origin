'use strict';

/**
 * @ngdoc function
 * @name openshiftConsole.controller:PipelineController
 * @description
 * # PipelineController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('PipelineController',
              function ($filter,
                        $interval,
                        $routeParams,
                        $scope,
                        ApplicationService,
                        BuildsService,
                        DataService,
                        DeploymentsService,
                        ImageStreamResolver,
                        Logger,
                        PipelineService,
                        PodsService,
                        ProjectsService,
                        RoutesService) {
    $scope.projectName = $routeParams.project;
    var watches = [];
    var intervals = [];
    var services, deployments, pods, builds, imageStreams;

    $scope.imagesByDockerReference = {};
    $scope.imageStreamImageRefByDockerReference = {}; // lets us determine if a particular container's docker image reference belongs to an imageStream

    var groupDeployments = function() {
      if (deployments && deployments) {
        $scope.deploymentsByService = DeploymentsService.groupByService(deployments, services);
      }
    };

    var groupPods = function() {
      if (pods && deployments) {
        $scope.podsByDeployment = PodsService.groupByDeployment(pods, deployments);
      }
    };

    var imageObjectRef = $filter('imageObjectRef');
    var updateRecentBuildsByOutputImage = function() {
      if (!builds) {
        return;
      }

      $scope.recentBuildsByOutputImage = BuildsService.recentByOutputImage(builds);

      // Find the builds for each deployment config.
      $scope.recentBuildsForDC = {};
      _.each($scope.deploymentConfigs, function(dc, name) {
        var triggers = _.get(dc, 'spec.triggers', []);
        triggers = _.filter(triggers, function(trigger) {
          return _.get(trigger, 'imageChangeParams.from.kind') === 'ImageStreamTag';
        });

        var images = _.map(triggers, function(trigger) {
          return _.get(trigger, 'imageChangeParams.from');
        });

        _.each(images, function(image) {
          var outputImage = imageObjectRef(image, $scope.projectName);
          var recentBuildsForImage = $scope.recentBuildsByOutputImage[outputImage];
          if (!_.isEmpty(recentBuildsForImage)) {
            $scope.recentBuildsForDC[name] =
              _.get($scope, ['recentBuildsForDC', name], []).concat(recentBuildsForImage);
          }
        });
      });
    };

    ProjectsService
      .get($routeParams.project)
      .then(_.spread(function(project, context) {
        $scope.project = project;

        var fetchReferencedImageStreamImages = function() {
          ImageStreamResolver.fetchReferencedImageStreamImages(pods,
                                                               $scope.imagesByDockerReference,
                                                               $scope.imageStreamImageRefByDockerReference,
                                                               context);
        };


        watches.push(DataService.watch("pods", context, function(podsData) {
          pods = podsData.by("metadata.name");
          groupPods();
          fetchReferencedImageStreamImages();
          Logger.log("pods", pods);
        }));

        watches.push(DataService.watch("services", context, function(serviceData) {
          services = serviceData.by("metadata.name");
          $scope.servicesByApp = ApplicationService.groupByApp(services);
          groupDeployments();
          Logger.log("services (list)", services);
        }));

        watches.push(DataService.watch("routes", context, function(routesData) {
          var routes = routesData.by("metadata.name");
          $scope.routesByService = RoutesService.groupByService(routes);
          Logger.log("routes (subscribe)", $scope.routesByService);
        }));

        // Sets up subscription for deployments
        watches.push(DataService.watch("replicationcontrollers", context, function(deploymentData) {
          deployments = deploymentData.by("metadata.name");
          groupDeployments();
          groupPods();
          Logger.log("deployments (subscribe)", deployments);
        }));

        // Sets up subscription for imageStreams
        watches.push(DataService.watch("imagestreams", context, function(imageStreamData) {
          imageStreams = imageStreamData.by("metadata.name");
          ImageStreamResolver.buildDockerRefMapForImageStreams(imageStreams,
                                                               $scope.imageStreamImageRefByDockerReference);
          fetchReferencedImageStreamImages();
          Logger.log("imagestreams (subscribe)", $scope.imageStreams);
        }));

        // Sets up subscription for deploymentConfigs, associates builds to triggers on deploymentConfigs
        watches.push(DataService.watch("deploymentconfigs", context, function(deploymentConfigs) {
          $scope.deploymentConfigs = deploymentConfigs.by("metadata.name");
          updateRecentBuildsByOutputImage();
          Logger.log("deploymentconfigs (subscribe)", $scope.deploymentConfigs);
        }));

        var setupRecentBuildInterval = _.once(function() {
          intervals.push($interval(updateRecentBuildsByOutputImage, 5 * 60 * 1000)); // prune the list every 5 minutes
        });

        // Sets up subscription for builds, associates builds to triggers on deploymentConfigs
        watches.push(DataService.watch("builds", context, function(buildData) {
          $scope.builds = builds = buildData.by("metadata.name");
          updateRecentBuildsByOutputImage();
          setupRecentBuildInterval();
          Logger.log("builds (subscribe)", builds);
        }));

        $scope.$on('$destroy', function(){
          DataService.unwatchAll(watches);
          _.each(intervals, function (interval){
            $interval.cancel(interval);
          });
        });
      }));
  });
