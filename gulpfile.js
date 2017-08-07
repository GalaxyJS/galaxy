/* global require */

var gulp = require('gulp');
// var minify = require('gulp-minify');
var uglify = require('gulp-uglify');
var gulpDocumentation = require('gulp-documentation');
var pump = require('pump');
var concat = require('gulp-concat');
var Server = require('karma').Server;

var sources = {
  galaxy: [
    'src/polyfills/*.js',
    'src/core.js',
    'src/*.js',
    'src/view/view.js',
    'src/view/**/*.js'
  ]
};

gulp.task('build-galaxy', function () {
  return pump([
    gulp.src(sources.galaxy),
    concat('galaxy.js'),
    // uglify({
    //   compress: {
    //     drop_debugger: false
    //   },
    //   mangle: false
    // }),
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

gulp.task('build-galaxy-production', function () {
  return pump([
    gulp.src(sources.galaxy),
    concat('galaxy.min.js'),
    uglify(),
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
  ], ['build-galaxy', 'build-galaxy-production']);
});

gulp.task('generate-docs', function () {
  return gulp.src(sources.galaxy)
    .pipe(gulpDocumentation('html', {
      filename: 'galaxy-doc.html'
    }))
    .pipe(gulp.dest('docs'));
});

gulp.task('tdd', function (done) {
  new Server({
    configFile: __dirname + '/karma.config.js'
  }, done).start();
});
