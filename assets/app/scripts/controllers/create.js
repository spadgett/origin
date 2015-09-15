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
    var projectImageRepos,
        openshiftImageRepos,
        projectTemplates,
        openshiftTemplates;

    // The tags to use for categories in the order we want to display. The
    // empty string corresponds to the "Other" category.
    $scope.categoryTags = [
      "instant-app", "java", "php", "ruby", "perl", "python", "nodejs", "database", "messaging", ""
    ];

    $scope.categoryLabels = {
      "instant-app": "Instant Apps",
      java: "Java",
      php: "PHP",
      ruby: "Ruby",
      python: "Python",
      perl: "Perl",
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

    $scope.sourceURLPattern = /^((ftp|http|https|git):\/\/(\w+:{0,1}[^\s@]*@)|git@)?([^\s@]+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;

    // List templates in the project namespace as well as the shared
    // `openshift` namespace.
    DataService.list("templates", $scope, function(templates) {
      projectTemplates = templates.by("metadata.name");
      angular.forEach(projectTemplates, categorizeTemplate);
      updateState();
      Logger.info("project templates", projectTemplates);
    });

    DataService.list("templates", {namespace: "openshift"}, function(templates) {
      openshiftTemplates = templates.by("metadata.name");
      angular.forEach(openshiftTemplates, categorizeTemplate);
      updateState();
      Logger.info("openshift templates", openshiftTemplates);
    });

    // List image streams in the project namespace as well as the shared
    // `openshift` namespace.
    DataService.list("imagestreams", $scope, function(imageRepos) {
      projectImageRepos = imageRepos.by("metadata.name");
      imagesForRepos(projectImageRepos);
      updateState();
      Logger.info("project image repos", projectImageRepos);
    });

    DataService.list("imagestreams", {namespace: "openshift"}, function(imageRepos) {
      openshiftImageRepos = imageRepos.by("metadata.name");
      imagesForRepos(openshiftImageRepos);
      updateState();
      Logger.info("openshift image repos", openshiftImageRepos);
    });

    function addImageToCategory(image, category) {
      if (!$scope.builderImagesByCategory[category]) {
        $scope.builderImagesByCategory[category] = [];
      }

      $scope.builderImagesByCategory[category].push(image);
    }

    function imagesForRepos(imageRepos) {
      angular.forEach(imageRepos, function(imageRepo) {
        if (!imageRepo.status) {
          return;
        }

        // Create a map of spec tags so we can find them efficiently later when
        // looking at status tags.
        var specTags = {};
        if (imageRepo.spec && imageRepo.spec.tags) {
          angular.forEach(imageRepo.spec.tags, function(tag) {
            if (tag.annotations && tag.annotations.tags) {
              specTags[tag.name] = tag.annotations.tags.split(/\s*,\s*/);
            }
          });
        }

        // Loop over status tags to categorize the images.
        angular.forEach(imageRepo.status.tags, function(tag) {
          var imageRepoTag = tag.tag;
          var image = {
            imageRepo: imageRepo,
            imageRepoTag: imageRepoTag,
            name: imageRepo.metadata.name + ":" + imageRepoTag,
            version: imageStreamTagAnnotationFilter(imageRepo, 'version', imageRepoTag)
          };
          var category, categoryTags = specTags[imageRepoTag] || [];
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
          if (tags[j] === $scope.categoryTags[i]) {
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
        projectImageRepos &&
        openshiftImageRepos;

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
