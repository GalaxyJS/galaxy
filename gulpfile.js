/* global require */
// Core
const gulp = require('gulp');
const pump = require('pump');
// plugins
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const concat = require('gulp-concat');

let sources = ['src/**/*.js'];

const build = function (done) {
  pump([
    gulp.src(sources),
    concat('galaxy.js'),
    gulp.dest('dist/'),
    gulp.dest('site/assets/galaxyjs/'),
    gulp.dest('galaxy-app-template/src/assets/galaxyjs'),
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
  done();
};

const buildProduction = function (done) {
  pump([
    gulp.src(sources),
    concat('galaxy.min.js'),
    babel(),
    uglify({ compress: true }),
    gulp.dest('dist/'),
    gulp.dest('site/assets/galaxyjs/'),
    gulp.dest('galaxy-app-template/src/assets/galaxyjs'),
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
  done();
};

// const watchAndBuild = function (done) {
//   gulp.watch([
//     'src/**/*.*',
//     'site/**/*.html'
//   ], build);
//   done();
// };

gulp.task('build-galaxy', build);
gulp.task('build-galaxy-production', buildProduction);
// gulp.task('watch-and-build', gulp.series(build, watchAndBuild));
