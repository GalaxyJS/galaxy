/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var gulp = require('gulp');
var path = require('path');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var minify = require('gulp-minify');
var pump = require('pump');
var concat = require('gulp-concat');
var watch = require('gulp-watch');

gulp.task('default', function () {
  // place code for your default task here
});


gulp.task('build-galaxy', function () {
  return pump([
    gulp.src([
      'src/system.js',
      'src/ui.js',
      'src/*.js'
    ]),
    concat('galaxy.js'),
    minify({
      mangle: false
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
    gulp.src([
      'src/tags/x-tag-core.js',
      'src/tags/*.js'
    ]),
    concat('galaxy-tags.js'),
    minify({
      mangle: false
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
    'dist/build-min.js',
    'spec/mocks/*.js',
    'spec/*-spec.js'
  ];

  open('http://127.0.0.1:8888');

  return gulp.src(filesForTest)
          .pipe(watch(filesForTest))
          .pipe(jasmineBrowser.specRunner())
          .pipe(jasmineBrowser.server({port: 8888}));
});