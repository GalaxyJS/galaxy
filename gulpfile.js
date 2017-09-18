/* global require */

let gulp = require('gulp');
// var minify = require('gulp-minify');
let uglify = require('gulp-uglify');
let babel = require('gulp-babel');
// let gulpDocumentation = require('gulp-documentation');
let pump = require('pump');
let concat = require('gulp-concat');
let Server = require('karma').Server;

let sources = {
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
    // babel({
    //   'plugins': ['transform-es2015-modules-commonjs'],
    //   presets: ['es2015', {
    //     loose: true,
    //     'modules': false
    //   }]
    // }),
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
    babel({presets: ['es2015']}),
    concat('galaxy.min.js'),
    uglify({compress: true}),
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
  ], ['build-galaxy']);
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
