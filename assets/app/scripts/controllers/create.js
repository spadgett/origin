'use strict';

/**
 * @ngdoc function
 * @name openshiftConsole.controller:CreateController
 * @description
 * # CreateController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('CreateController', function ($scope, DataService, tagsFilter, uidFilter, hashSizeFilter, imageStreamTagAnnotationFilter, LabelFilter, $location, Logger) {
    var projectImageStreams,
        openshiftImageStreams,
        projectTemplates,
        openshiftTemplates;

    // The tags to use for categories in the order we want to display. Empty string corresponds to the "Other" category.
    $scope.categoryTags = [
      "instant-app", "xpaas", "java", "php", "ruby", "perl", "python", "nodejs", "database", "messaging", ""
    ];

    $scope.categoryLabels = {
      "instant-app": "Instant Apps",
      java: "Java",
      xpaas: "xPaaS",
      php: "PHP",
      ruby: "Ruby",
      perl: "Perl",
      python: "Python",
      nodejs: "NodeJS",
      database: "Databases",
      messaging: "Messaging",
      "": "Other"
    };

    $scope.templatesByCategory = {};
    $scope.builderImagesByCategory = {};
    $scope.nonBuilderImages = [];

    // Set to true when everything has finished loading.
    $scope.loaded = false;

    // Set to false if there is data to show.
    $scope.emptyCatalog = true;

    $scope.filterByTag = function(tag) {
      $scope.searchTerm = tag;
    };

    // List templates in the project namespace as well as the shared
    // `openshift` namespace.
    DataService.list("templates", $scope, function(templates) {
      projectTemplates = templates.by("metadata.name");
      angular.forEach(projectTemplates, categorizeTemplate);
      updateState();
    });

    DataService.list("templates", {namespace: "openshift"}, function(templates) {
      openshiftTemplates = templates.by("metadata.name");
      angular.forEach(openshiftTemplates, categorizeTemplate);
      updateState();
    });

    // List image streams in the project namespace as well as the shared
    // `openshift` namespace.
    DataService.list("imagestreams", $scope, function(imageStreams) {
      projectImageStreams = imageStreams.by("metadata.name");
      imagesForStreams(projectImageStreams);
      updateState();
    });

    DataService.list("imagestreams", {namespace: "openshift"}, function(imageStreams) {
      openshiftImageStreams = imageStreams.by("metadata.name");
      imagesForStreams(openshiftImageStreams);
      updateState();
    });

    function addImageToCategory(image, category) {
      if (!$scope.builderImagesByCategory[category]) {
        $scope.builderImagesByCategory[category] = [];
      }

      $scope.builderImagesByCategory[category].push(image);
    }

    function imagesForStreams(imageStreams) {
      angular.forEach(imageStreams, function(imageStream) {
        if (!imageStream.status) {
          return;
        }

        // Create a map of spec tags so we can find them efficiently later when
        // looking at status tags.
        var specTags = {};
        if (imageStream.spec && imageStream.spec.tags) {
          angular.forEach(imageStream.spec.tags, function(tag) {
            if (tag.annotations && tag.annotations.tags) {
              specTags[tag.name] = tag.annotations.tags.split(/\s*,\s*/);
            }
          });
        }

        // Loop over status tags to categorize the images.
        angular.forEach(imageStream.status.tags, function(tag) {
          var imageStreamTag = tag.tag;
          var image = {
            imageStream: imageStream,
            imageStreamTag: imageStreamTag,
            name: imageStream.metadata.name + ":" + imageStreamTag,
            version: imageStreamTagAnnotationFilter(imageStream, 'version', imageStreamTag)
          };
          var category, categoryTags = specTags[imageStreamTag] || [];
          if (categoryTags.indexOf("builder") >= 0) {
            // Add the builder image to its category.
            category = getCategory(categoryTags);
            addImageToCategory(image, category);
          } else {
            // Group non-builder images separately so we can hide them by default.
            $scope.nonBuilderImages.push(image);
          }
        });
      });
    }

    function getCategory(tags) {
      var i, j;

      // Find the first category that is in tags.
      for (i = 0; i < $scope.categoryTags.length; i++) {
        for (j = 0; j < tags.length; j++) {
          if (tags[j].toLowerCase() === $scope.categoryTags[i]) {
            return tags[j];
          }
        }
      }

      return "";
    }

    function categorizeTemplate(template) {
      var tags = tagsFilter(template);
      var category = getCategory(tags);
      if (!$scope.templatesByCategory[category]) {
        $scope.templatesByCategory[category] = [];
      }

      $scope.templatesByCategory[category].push(template);
    }

    function updateState() {
      // Have we finished loading all of the templates and image streams in
      // both the project and openshift namespaces? If undefined, they're no
      // loaded.
      $scope.loaded =
        projectTemplates &&
        openshiftTemplates &&
        projectImageStreams &&
        openshiftImageStreams;

      if ($scope.loaded) {
        Logger.info("templates by category", $scope.templatesByCategory);
        Logger.info("builder images", $scope.builderImagesByCategory);
        Logger.info("non-builder images", $scope.nonBuilderImages);
      }

      // Does anything we've loaded so far have data we show by default?
      $scope.emptyCatalog =
        hashSizeFilter(projectTemplates) === 0 &&
        hashSizeFilter(openshiftTemplates) === 0 &&
        $scope.builderImagesByCategory.length === 0;
    }
  });
