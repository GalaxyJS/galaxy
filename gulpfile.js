/* global require */
// Core
const gulp = require('gulp');
const pump = require('pump');
// plugins
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
// TTD

let sources = {
  galaxy: [
    // Polyfills
    'src/polyfills/*.js',
    // Core
    'src/core/core.js',
    'src/core/**/*.js',
    // View
    'src/view/view.js',
    'src/view/**/*.js',
    // Module addons
    'src/addons/*.js'
  ]
};

const build = function (done) {
  pump([
    gulp.src(sources.galaxy),
    concat('galaxy.js'),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/'),
    // gulp.dest('../imerce-viewer/assets/'),
    // gulp.dest('C:/xampp/htdocs/TeamScreen/public/assets/galaxyjs')
    gulp.dest('C:/xampp/htdocs/MyBI/app/assets')
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
    gulp.src(sources.galaxy),
    babel(),
    concat('galaxy.min.js'),
    uglify({ compress: true }),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/'),
    gulp.dest('../imerce-viewer/assets/'),
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
  done();
};

const watchAndBuild = function (done) {
  gulp.watch([
    'src/**/*.*',
    'site/**/*.html'
  ], build);
  done();
};

gulp.task('build-galaxy', build);
gulp.task('build-galaxy-production', buildProduction);
gulp.task('start-development', gulp.series(build, watchAndBuild));
