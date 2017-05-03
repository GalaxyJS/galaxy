/* global require */
/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var gulp = require('gulp');
var minify = require('gulp-minify');
var gulpDocumentation = require('gulp-documentation');
var pump = require('pump');
var concat = require('gulp-concat');
var watch = require('gulp-watch');

var sources = {
  galaxy: [
    'src/system.js',
    'src/ui.js',
    'src/*.js'
  ],
  galaxy_v3: [
    'src/new/system.js',
    'src/new/*.js'
  ],
  galaxyTags: [
    'src/tags/x-tag-core.js',
    'src/tags/*.js'
  ]
};

gulp.task('default', function () {
  // place code for your default task here
});

gulp.task('build-galaxy', function () {
  return pump([
    gulp.src(sources.galaxy),
    concat('galaxy.js'),
    minify({
      mangle: true
    }),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/')
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
});

gulp.task('build-tags', function () {
  return pump([
    gulp.src(sources.galaxyTags),
    concat('galaxy-tags.js'),
    minify({
      mangle: true
    }),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/')
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
});

gulp.task('build', ['build-galaxy', 'build-tags']);

gulp.task('start-development', ['build'], function () {
  gulp.watch([
    'src/**/*.*',
    'site/**/*.html'
  ], ['build']);
});

gulp.task('build-galaxy-v3', function () {
  return pump([
    gulp.src(sources.galaxy_v3),
    concat('galaxy.js'),
    minify({
      mangle: true
    }),
    gulp.dest('dist/v3/'),
    gulp.dest('site/galaxyjs_v3/')
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
});

//var mocha = require('gulp-mocha');
//
//gulp.task('test-mochas', function () {
//  return gulp.src('src/tests/*.mocha.js', {read: false})
//          // gulp-mocha needs filepaths so you can't have any plugins before it 
//          .pipe(mocha());
//});
//
//gulp.task('watch-and-test', ['test-mochas'], function () {
//  gulp.watch([
//    'src/**/*.*',
//    'site/**/*.html'
//  ], ['test-mochas']);
//});

var jasmineBrowser = require('gulp-jasmine-browser');
var open = require('opn');

gulp.task('jasmine', function () {
  var filesForTest = [
    'node_modules/fetch-mock/es5/client-browserified.js',
    'src/promise-polyfill.js',
    'dist/galaxy-min.js',
    'spec/*-spec.js'
  ];

  open('http://127.0.0.1:8888');

  return gulp.src(filesForTest)
    .pipe(watch(filesForTest))
    .pipe(jasmineBrowser.specRunner())
    .pipe(jasmineBrowser.server({port: 8888}));
});

gulp.task('generate-docs', function () {
  return gulp.src(sources.galaxy)
    .pipe(gulpDocumentation('html', {
      filename: 'galaxy-doc.html'
    }))
    .pipe(gulp.dest('docs'));
});
