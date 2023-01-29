import { startDevServer } from '@web/dev-server';
import pump from 'pump';
import gulp from 'gulp';
import concat from 'gulp-concat';

let sources = {
  galaxy: ['src/**/*.js']
};

const build = function (done) {
  pump([
    gulp.src(sources.galaxy),
    concat('galaxy.js'),
    gulp.dest('./dist/'),
    gulp.dest('./site/assets/galaxyjs/'),
    gulp.dest('./galaxy-app-template/src/assets/galaxyjs'),
  ], function (error) {
    if (error) {
      console.error('error in: ', error.plugin);
      console.error(error.message);
      console.info(error.stack);
    } else {
      console.info('Build successfully');
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

gulp.task('watch-and-build', gulp.series(build, watchAndBuild));

// function fileChanged(err) {
//   if (err) {
//     console.error('error', err);
//   }
//   console.info('changed', f);
// }
//
// watch.createMonitor('./src', function (monitor) {
//   monitor.on('created', function (f, stat) {
//     // Handle new files
//   });
//   monitor.on('changed', function (f, curr, prev) {
//     // Handle file changes
//     gulp.task('build-galaxy')(fileChanged);
//   });
//   monitor.on('removed', function (f, stat) {
//     // Handle removed files
//   });
//   // monitor.stop(); // Stop watching
// });

gulp.task('watch-and-build')((err) => {
  if (err) {
    console.error(err);
  }

  console.info('Watching source code is initiated.');
});


async function main() {
  const server = await startDevServer({
    config: {
      rootDir: 'site',
      port: 8000,
      appIndex: 'site/index.html'
      // watch: true,
    },
    readCliArgs: false,
    readFileConfig: false,
  });
}

main();

