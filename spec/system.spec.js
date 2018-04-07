// /* global Galaxy, fetchMock, Promise */
//
// describe('GalaxyJS Core', function () {
//   it('Galaxy.Core exist', function () {
//     expect(Galaxy.Core).toBeDefined();
//   });
//
//   it('Galaxy.Core instance', function () {
//     var sample = new Galaxy.Core();
//
//     expect(sample).toBeDefined();
//   });
// });
//
// // describe('Galaxy boot:', function () {
// //   var MockGalaxy = null;
// //
// //   beforeEach(function () {
// //     MockGalaxy = new Galaxy.Core();
// //   });
// //
// //   afterEach(function () {
// //     MockGalaxy = null;
// //   });
// //
// //   it('Won\'t load main if no root element is specified ', function (done) {
// //     fetchMock.setImplementations({Promise: Promise});
// //     fetchMock.mock('main.js?', {
// //       'status': 200,
// //       'body': 'console.log("main.js is here!")',
// //       'headers': {
// //         'content-type': 'text/javascript'
// //       }
// //     });
// //     var doneFn = jasmine.createSpy('success');
// //
// //     expect(function () {
// //       MockGalaxy.boot({
// //         url: 'main.js',
// //         // element: document.createElement('div')
// //       }).then(function (module) {
// //         doneFn(module);
// //       });
// //     }).toThrow(new Error('element property is mandatory'));
// //
// //     setTimeout(function () {
// //       expect(doneFn).not.toHaveBeenCalled();
// //       done();
// //     }, 100);
// //   });
// //
// //   it('Main module is loaded', function (done) {
// //     fetchMock.setImplementations({Promise: Promise});
// //     fetchMock.mock('main.js?', {
// //       'status': 200,
// //       'body': 'console.log("main.js is here!")',
// //       'headers': {
// //         'content-type': 'text/javascript'
// //       }
// //     });
// //
// //     expect(MockGalaxy.bootModule).toBeNull();
// //
// //     var doneFn = jasmine.createSpy('success');
// //     MockGalaxy.boot({
// //       url: 'main.js',
// //       element: document.createElement('div')
// //     }).then(function (module) {
// //       expect(module.id).toBe('system');
// //       doneFn(module.scope.path);
// //     });
// //
// //     expect(MockGalaxy.bootModule).toBeDefined();
// //
// //     setTimeout(function () {
// //       expect(doneFn).toHaveBeenCalledWith('/');
// //       done();
// //     }, 100);
// //   });
// // });
//
