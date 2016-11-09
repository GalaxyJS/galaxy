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

gulp.task('default', function () {
  // place code for your default task here
});


gulp.task('build', function (cb) {
  return pump([
    gulp.src([
      'src/system.js',
      'src/ui.js',
      'src/**/*.js'
    ]),
    concat('build.js'),
    minify({
      mangle: false
    }),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/')
  ]);
});

gulp.task('start-development', ['build'], function () {
  gulp.watch([
    'src/**/*.*',
    'site/**/*.html'
  ], ['build']);
});