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
    'src/*.js'
  ]
};

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

gulp.task('start-development', ['build-galaxy'], function () {
  gulp.watch([
    'src/**/*.*',
    'site/**/*.html'
  ], ['build']);
});

gulp.task('generate-docs', function () {
  return gulp.src(sources.galaxy)
    .pipe(gulpDocumentation('html', {
      filename: 'galaxy-doc.html'
    }))
    .pipe(gulp.dest('docs'));
});
