export default function (scope) {
  const view = scope.useView();

  console.log(scope);
  console.log(view);

  scope.data.counter = 0;
  setInterval(() => {
    scope.data.counter++;
  }, 1000);

  view.blueprint({
    tag: 'div',
    children: [
      {
        tag: 'h1',
        text: 'Hello World'
      },
      {
        tag: 'p',
        text: 'This is a paragraph'
      },
      {
        tag: 'p',
        children: [
          {
            tag: 'strong',
            text: 'Counter: '
          },
          {
            tag: 'span',
            text: '<>data.counter'
          }
        ]
      }
    ]
  });
}
