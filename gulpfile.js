/* global require */
// COre
const gulp = require('gulp');
const pump = require('pump');
// plugins
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
// TTD
const Server = require('karma').Server;

let sources = {
  galaxy: [
    // Polyfills
    'src/polyfills/*.js',
    // Core
    'src/core.js',
    'src/*.js',
    // View
    'src/view/view.js',
    'src/view/**/*.js',
    // Module addons
    'src/addons/*.js'
  ]
};

gulp.task('build-galaxy', function () {
  return pump([
    gulp.src(sources.galaxy),
    concat('galaxy.js'),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/'),
    gulp.dest('../imerce-viewer/assets/')

  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    }
  });
});

gulp.task('build-galaxy-production', function () {
  return pump([
    gulp.src(sources.galaxy),
    babel({
      presets: ['es2015-script']
    }),
    concat('galaxy.min.js'),
    uglify({compress: true}),
    gulp.dest('dist/'),
    gulp.dest('site/galaxyjs/'),
    gulp.dest('../imerce-viewer/assets/')
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
  ], ['build-galaxy']);
});

gulp.task('tdd', function (done) {
  new Server({
    configFile: __dirname + '/karma.config.js'
  }, done).start();
});
